"""
razorpay_subscriptions.py — real auto-renewing membership, for anyone who
has ALREADY paid at least once and is renewing. Companion to
razorpay_orders.py — a brand-new signup always pays through that module's
plain one-time Orders flow instead (plan='standard'), never touches a
Subscription object, and makes no promise about what they'll pay next
year. Renewal price is next year's decision, made at renewal time.

Deliberately simple, one case: a subscriber renewing right now pays the
current renewal rate in ONE Checkout step, and that same payment sets up
real auto-renewal from this point forward (`start_at` = now, so the
payment itself is the subscription's first charge). Nothing is deferred,
nothing bridges two different prices in one signup -- an earlier version
of this module tried to also handle a brand-new signup being pre-
authorised today for a *different* price a year out, which needed two
separate Checkout popups back to back for that one case. Cut, per
Venkat's call: renewal pricing is only ever shown to an existing
subscriber in the first place, so there's nothing to pre-promise a new
signup at all.

Provides:
  * SUBSCRIPTION_PLANS                     — country -> plan config
  * POST /api/razorpay/create-subscription — creates the renewal
    Subscription, returns what the frontend needs to open Razorpay
    Checkout in subscription mode (subscription_id, not order_id).
  * POST /api/razorpay/verify-subscription — verifies the checkout
    signature, then finds-or-creates the Ghost member and applies labels,
    mirroring razorpay_orders.py's verify_payment.
  * POST /api/razorpay/webhook already exists in server.py for one-time
    payment events; subscription lifecycle events (authenticated,
    activated, charged, halted, cancelled) are handled separately here —
    see handle_subscription_webhook_event(), called from server.py's
    webhook handler for subscription.* event types.

When a renewal auto-charge fails and Razorpay gives up retrying, it
sends `subscription.halted` -- Venkat's call: a one-week grace period,
not an immediate downgrade. `_start_grace_period()` records the halt
and emails the subscriber once; `subscription-grace/expire-check` (an
admin-gated sweep, same shape as nominations.py's own expire-check
endpoints -- wire it to run daily via a Render Cron Job) strips paid
access from anyone still in the grace collection past their
`grace_ends_at`. If the subscription successfully charges again before
that (`subscription.charged`, handled in server.py's main webhook
branch), `clear_grace_period()` cancels the pending downgrade so the
sweep doesn't act on stale state.

Both Plan IDs below are real, created in the Razorpay dashboard --
IN and INTL renewal both work end to end.

Confirmed against the installed razorpay SDK (2.0.x, utility/utility.py):
`client.utility.verify_subscription_payment_signature` exists and takes
exactly `razorpay_subscription_id`/`razorpay_payment_id`/`razorpay_signature`,
matching what this module already sends -- no longer a guess.

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (existing, now live),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from admin_auth import require_admin_key_or_session
from tiers import PLAN_LABELS, ensure_member_labeled, find_ghost_member
from payments import fetch_and_record, get_last_payment_by_subscription_id
from resend_email import send_email

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

# Same two labels PLAN_LABELS['standard'] grants -- a subscription only
# ever confers standard-equivalent access (see module docstring), so a
# grace-period downgrade just reverses exactly that grant, nothing more.
GRACE_PERIOD_DAYS = 7
_DOWNGRADE_LABELS = ('paid-via-razorpay', 'premium-subscriber')

router = APIRouter()

# Injected by server.py at mount time — same pattern as razorpay_orders.py.
_razorpay_client = None
_recent_payments: Optional[dict] = None
_db = None


def init(razorpay_client, recent_payments: dict, db_handle=None):
    global _razorpay_client, _recent_payments, _db
    _razorpay_client = razorpay_client
    _recent_payments = recent_payments
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


# country -> Plan config, the one renewal rate. plan_id is filled in once
# Venkat creates each Plan in the Razorpay dashboard -- IN already done,
# INTL still a placeholder.
SUBSCRIPTION_PLANS = {
    'IN': {'plan_id': 'plan_TX2KRKBrC6HNC1', 'amount': 353900, 'currency': 'INR', 'label': 'Annual Membership'},   # 2,999 + 18% GST = 3,538.82 -> 3,539
    'INTL': {'plan_id': 'plan_TZOohCLUkhJAFy', 'amount': 14900, 'currency': 'USD', 'label': 'Annual Membership'},  # $149
}

# A Razorpay Subscription needs a finite total_count, not true "forever".
# 100 yearly cycles reads as effectively indefinite for a publication.
TOTAL_COUNT_YEARS = 100


def _resolve_plan_config(country: str) -> Optional[dict]:
    geo = country if country in SUBSCRIPTION_PLANS else 'IN'
    return SUBSCRIPTION_PLANS.get(geo)


class CreateSubscriptionRequest(BaseModel):
    country: str = 'IN'


@router.post('/api/razorpay/create-subscription')
async def create_subscription(req: CreateSubscriptionRequest):
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    config = _resolve_plan_config(req.country)
    if not config:
        raise HTTPException(
            status_code=400,
            detail=f"No pricing configured for country='{req.country}'",
        )
    if not config['plan_id']:
        raise HTTPException(
            status_code=503,
            detail=f"Razorpay Plan not yet created for country='{req.country}'",
        )

    try:
        subscription = _razorpay_client.subscription.create({
            'plan_id': config['plan_id'],
            'customer_notify': 1,
            'total_count': TOTAL_COUNT_YEARS,
            'notes': {'country': req.country},
        })
    except Exception as e:
        logger.error(f'Razorpay subscription creation failed: {e!r}')
        raise HTTPException(status_code=502, detail='Could not create subscription')

    return {
        'subscription_id': subscription['id'],
        'amount': config['amount'],
        'currency': config['currency'],
        'key_id': os.environ.get('RAZORPAY_KEY_ID', ''),
        'label': config['label'],
    }


class VerifySubscriptionRequest(BaseModel):
    razorpay_subscription_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    email: EmailStr
    name: Optional[str] = ''


@router.post('/api/razorpay/verify-subscription')
async def verify_subscription(req: VerifySubscriptionRequest):
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    try:
        _razorpay_client.utility.verify_subscription_payment_signature({
            'razorpay_subscription_id': req.razorpay_subscription_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature,
        })
    except Exception:
        logger.warning(f'Razorpay subscription signature verification failed for subscription={req.razorpay_subscription_id}')
        raise HTTPException(status_code=400, detail='Payment signature verification failed')

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    email = req.email.lower().strip()

    # Same full paid membership access as the one-shot standard plan --
    # just billed on a real recurring schedule instead of once.
    member = await ensure_member_labeled(email, req.name or '', PLAN_LABELS['standard'], token)
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Payment verified but member setup failed, contact support',
        )

    if _recent_payments is not None:
        _recent_payments[email] = datetime.now(timezone.utc)

    await fetch_and_record(
        _razorpay_client, req.razorpay_payment_id, source='subscription_verify',
        fallback_email=email, fallback_plan='',
    )

    return {'verified': True, 'email': email}


async def _ensure_grace_indexes():
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


async def _start_grace_period(subscription_id: str) -> None:
    if _db is None:
        logger.error(f'Subscription {subscription_id} halted but no DB configured -- cannot start grace period')
        return
    last_payment = await get_last_payment_by_subscription_id(subscription_id)
    email = (last_payment or {}).get('email') or ''
    if not email:
        logger.error(f'Subscription {subscription_id} halted but no payment record found -- cannot start grace period or notify')
        return

    await _ensure_grace_indexes()
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
    """Called from server.py's main webhook branch when a previously
    halted subscription charges successfully again -- cancels the
    pending downgrade so the sweep below doesn't act on stale state."""
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


@router.post('/api/razorpay/subscription-grace/expire-check')
async def subscription_grace_expire_check(_admin: None = Depends(require_admin_key_or_session)):
    """Cron sweep (admin-gated, same shape as nominations.py's own
    expire-check endpoints) -- for every grace record still 'in_grace'
    past its grace_ends_at, strips paid access from that member. Wire
    this to run daily via a Render Cron Job (or Apps Script's
    time-driven trigger, same as the nominations sweeps)."""
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


async def handle_subscription_webhook_event(event: str, payload: dict) -> None:
    """Called from server.py's razorpay_webhook for subscription.* events
    other than .activated and .charged — those two now get the same Ghost
    labeling + Slack treatment as payment.captured, handled directly in
    server.py's primary webhook branch (which also calls
    clear_grace_period() there for a successful charge)."""
    subscription_entity = payload.get('payload', {}).get('subscription', {}).get('entity', {})
    sub_id = subscription_entity.get('id', 'unknown')

    if event == 'subscription.halted':
        await _start_grace_period(sub_id)
    elif event in ('subscription.authenticated', 'subscription.cancelled'):
        logger.info(f'Subscription event {event}: {sub_id}')
    else:
        logger.info(f'Unhandled subscription event {event}: {sub_id}')
