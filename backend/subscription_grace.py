"""
subscription_grace.py — shared grace-period handling for a failed
recurring-subscription charge, used by BOTH razorpay_subscriptions.py
and paypal_subscriptions.py. Extracted out of razorpay_subscriptions.py
(where this was first built) so two payment providers' worth of
subscription lifecycle don't each reimplement -- and risk disagreeing
on -- the same policy: Venkat's call is a one-week grace period before
paid access is pulled, never an immediate downgrade.

One subscription_grace Mongo collection, keyed by subscription_id --
Razorpay's own ids ("sub_...") and PayPal's ("I-...") look nothing
alike, so there's no realistic collision between the two providers
sharing it.

Provides:
  * GRACE_PERIOD_DAYS
  * start_grace_period(subscription_id) -- resolves who the
    subscription belongs to via payments.get_last_payment_by_
    subscription_id (works for either provider -- both record their
    payments with a subscription_id, via payments.record_payment/
    fetch_and_record), records the halt, emails the subscriber once.
    Idempotent against a re-delivered webhook.
  * clear_grace_period(subscription_id) -- cancels a pending downgrade
    when the subscription successfully charges again.
  * POST /api/subscriptions/grace/expire-check -- the one admin-gated
    sweep both providers' halted subscriptions feed into. Wire this to
    a daily Render Cron Job.

Dependencies: db (via init()), RESEND_API_KEY (via resend_email.py),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends

from admin_auth import require_admin_key_or_session
from tiers import find_ghost_member
from payments import get_last_payment_by_subscription_id
from resend_email import send_email

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

# A subscription (either provider) only ever confers standard-equivalent
# access -- see razorpay_subscriptions.py/paypal_subscriptions.py's own
# docstrings -- so a downgrade just reverses exactly that grant.
GRACE_PERIOD_DAYS = 7
_DOWNGRADE_LABELS = ('paid-via-razorpay', 'premium-subscriber')

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


def _create_ghost_admin_token() -> Optional[str]:
    if not GHOST_ADMIN_API_KEY or ':' not in GHOST_ADMIN_API_KEY:
        return None
    try:
        kid, secret = GHOST_ADMIN_API_KEY.split(':', 1)
        iat = int(datetime.now(timezone.utc).timestamp())
        payload = {'iat': iat, 'exp': iat + 5 * 60, 'aud': '/admin/'}
        return jwt.encode(payload, bytes.fromhex(secret), algorithm='HS256',
                          headers={'kid': kid})
    except Exception as e:
        logger.warning(f'Ghost JWT mint failed: {e!r}')
        return None


async def _ensure_indexes():
    if _db is None:
        return
    try:
        await _db.subscription_grace.create_index('subscription_id', unique=True)
        await _db.subscription_grace.create_index('status')
        await _db.subscription_grace.create_index('grace_ends_at')
    except Exception as e:
        logger.warning(f'subscription_grace index ensure failed (non-fatal): {e!r}')


def _grace_period_email_html() -> str:
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        'Your renewal payment <em style="font-style: italic;">didn’t go through.</em>'
        '</h1>'
        '<p>We tried to charge your card for your annual renewal and it didn’t go through. Your access is still active for now.</p>'
        f'<p>You have {GRACE_PERIOD_DAYS} days to update your payment method before access pauses. Reply to this email or write to '
        '<a href="mailto:venkat@stateofplay.club" style="color: #A0291C;">venkat@stateofplay.club</a> and we’ll help you sort it out.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


async def start_grace_period(subscription_id: str) -> None:
    if _db is None:
        logger.error(f'Subscription {subscription_id} halted but no DB configured -- cannot start grace period')
        return
    last_payment = await get_last_payment_by_subscription_id(subscription_id)
    email = (last_payment or {}).get('email') or ''
    if not email:
        logger.error(f'Subscription {subscription_id} halted but no payment record found -- cannot start grace period or notify')
        return

    await _ensure_indexes()
    now = datetime.now(timezone.utc)
    result = await _db.subscription_grace.update_one(
        {'subscription_id': subscription_id},
        {'$setOnInsert': {
            'subscription_id': subscription_id,
            'email': email,
            'halted_at': now,
            'grace_ends_at': now + timedelta(days=GRACE_PERIOD_DAYS),
            'status': 'in_grace',
        }},
        upsert=True,
    )
    if getattr(result, 'upserted_id', None) is not None:
        logger.warning(f'Subscription {subscription_id} halted for {email} — {GRACE_PERIOD_DAYS}-day grace period started')
        await send_email(
            to=email,
            subject='Your renewal payment didn’t go through',
            html=_grace_period_email_html(),
        )
    # else: already in grace from an earlier delivery of the same event —
    # $setOnInsert means the clock isn't reset by a re-delivered webhook.


async def clear_grace_period(subscription_id: str) -> None:
    """Called when a previously halted subscription charges successfully
    again -- cancels the pending downgrade so the sweep below doesn't
    act on stale state."""
    if _db is None or not subscription_id:
        return
    await _db.subscription_grace.update_one(
        {'subscription_id': subscription_id, 'status': 'in_grace'},
        {'$set': {'status': 'resolved'}},
    )


async def _downgrade_member(email: str, token: str) -> bool:
    """Reverses exactly what a subscription payment granted -- strips
    'paid-via-razorpay' and 'premium-subscriber' (PLAN_LABELS['standard'])
    from the member. Removing only one of the two would leave the other
    still satisfying tiers.is_paid_from_labels(), so access wouldn't
    actually change."""
    member = await find_ghost_member(email, token)
    if not member:
        return False
    existing_labels = [(l.get('name') or '') for l in (member.get('labels') or [])]
    new_labels = [l for l in existing_labels if l not in _DOWNGRADE_LABELS]
    if new_labels == existing_labels:
        return True  # already doesn't carry paid access
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member["id"]}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f'Grace-period downgrade PUT failed for {email}: {e!r}')
        return False


@router.post('/api/subscriptions/grace/expire-check')
async def subscription_grace_expire_check(_admin: None = Depends(require_admin_key_or_session)):
    """Cron sweep (admin-gated, same shape as nominations.py's own
    expire-check endpoints) -- for every grace record still 'in_grace'
    past its grace_ends_at, strips paid access from that member,
    regardless of which provider's subscription it came from. Wire
    this to run daily via a Render Cron Job."""
    if _db is None:
        return {'downgraded_count': 0}
    token = _create_ghost_admin_token()
    now = datetime.now(timezone.utc)
    downgraded_count = 0

    cursor = _db.subscription_grace.find({'status': 'in_grace', 'grace_ends_at': {'$lt': now}})
    async for record in cursor:
        email = record.get('email') or ''
        ok = bool(token and email) and await _downgrade_member(email, token)
        await _db.subscription_grace.update_one(
            {'_id': record['_id']},
            {'$set': {'status': 'downgraded', 'downgraded_at': now, 'downgrade_succeeded': ok}},
        )
        if ok:
            downgraded_count += 1
    return {'downgraded_count': downgraded_count}
