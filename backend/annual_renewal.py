"""
annual_renewal.py — lifecycle handling for a one-time-payment annual
member (Standard, trial-upgrade, or a community offer -- anything whose
access came from a single Razorpay Order, not a Subscription) whose year
lapses without being renewed.

Distinct from subscription_grace.py, which only reacts to a real
Razorpay/PayPal Subscription's FAILED CHARGE webhook. A plain one-time
Order never attempts to charge again at all -- there's no event to hang
a response on. So this instead runs as a daily date-driven sweep over
every standard-equivalent member's computed synthetic expiry
(payments.compute_synthetic_expiry), the exact same date the account
page and the admin Renewals panel already show. Before this module,
nothing read that date except for display -- a lapsed one-time payer
kept full paid access forever unless Venkat noticed the Renewals panel's
"Overdue, still labeled paid" filter and stripped their labels by hand.

Explicitly OUT of scope, left exactly as they are today:
  * Anyone whose last payment carries a subscription_id (a real
    auto-renewing Razorpay Subscription) -- subscription_grace.py
    already owns their lifecycle via the actual failed-charge event;
    this sweep would be guessing at the wrong signal for them.
  * Student ('tier-student') -- renewal there is a manual ID
    re-verification, not a quiet auto-lapse. A different policy if
    Venkat wants one built for it.
  * corp-* -- resolved against the Corporate Subscriptions Sheet's own
    renewal_date (admin_dashboard.py), not a synthetic guess.
  * Trial ('tier-trial') -- its own 30-day window, unrelated.
  * Team-5/Team-10 -- excluded automatically: tiers.PLAN_LABELS never
    grants the payer 'premium-subscriber' (the payer isn't necessarily a
    seat-holder), so they never match this sweep's own filter below.

Same shape as the failed-charge policy already live for a real
subscription: a timely nudge, one explicit "your year's up" notice, then
access actually goes at the end of a grace window -- never cut off the
moment the day arrives.

  Day -14  reminder email: "renews soon"
  Day   0  (expiry day)    grace-start email: "has lapsed, N days left"
  Day  +7  silent downgrade: paid-via-razorpay + premium-subscriber
                             stripped, no email (matches
                             subscription_grace.py's own silence here)

Idempotency: a member's current cycle is identified by their exact
computed expiry timestamp. A renewal moves that timestamp into the
future, which both exits them from every window below AND opens a fresh
notice cycle automatically -- no explicit "clear" step needed, unlike
subscription_grace.py (which reacts to a point-in-time webhook rather
than a value recomputed fresh on every run). The notices collection only
needs to remember "already sent X for THIS expiry," never a full history.

Provides:
  * POST /api/admin/annual-renewal/sweep -- admin-gated, same shape as
    subscription_grace.py's expire-check and nominations.py's own
    sweeps. Wire this to a daily Render Cron Job. Reports counts for
    every action taken.

Dependencies: db (via init()), RESEND_API_KEY (via resend_email.py),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends

from admin_auth import require_admin_key_or_session
from tiers import list_all_ghost_members
from payments import get_subscriber_payment_summaries, compute_synthetic_expiry
from resend_email import send_email
from email_layout import email_shell, email_cta_button

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

REMINDER_DAYS_BEFORE = 14
GRACE_PERIOD_DAYS = 7
# Same pair subscription_grace.py reverses -- a one-time Standard/
# trial-upgrade/community payment only ever confers exactly these two.
_DOWNGRADE_LABELS = ('paid-via-razorpay', 'premium-subscriber')
_EXCLUDED_LABELS = ('tier-trial', 'tier-student')

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


def _create_ghost_admin_token() -> Optional[str]:
    """JWT for Ghost Admin API; identical algorithm to every other module."""
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
        await _db.annual_renewal_notices.create_index(
            [('email', 1), ('expiry', 1)], unique=True
        )
    except Exception as e:
        logger.warning(f'annual_renewal_notices index ensure failed (non-fatal): {e!r}')


def _reminder_email_html(expiry_date_str: str) -> str:
    """The personal version of this notice -- Venkat's own words, not
    boilerplate -- since this is the one email in the whole lifecycle
    aimed at someone who already chose to pay once and might choose to
    again, not someone being sold to cold. Deliberately not reused for
    _grace_email_html below: that one is the practical "your access is
    about to pause" notice, where restating this would read as padding
    rather than sincerity."""
    return email_shell(
        'Your membership <em style="font-style: italic;">renews soon.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>I don’t take it for granted that you paid for this a year ago, before there was much proof it was worth it. '
            'It’s still the reason I get to do this work. Thank you.</p>'
            '<p>There’s more reporting I want to do this year than last, and I’d like you there for it.</p>'
            f'<p>Your year is up on {expiry_date_str}. If you’d like to continue:</p>'
            + email_cta_button('Renew your membership &rarr;', 'https://www.stateofplay.club/subscribe')
            + '<p>Thank you</p>'
        ),
        signoff_title='Founder and editor,<br>The State of Play',
    )


def _grace_email_html() -> str:
    return email_shell(
        'Your membership <em style="font-style: italic;">has lapsed.</em>',
        (
            '<p>Your annual membership was due today and hasn’t been renewed yet. Your access is still active for now.</p>'
            f'<p>You have {GRACE_PERIOD_DAYS} days to renew before access pauses.</p>'
            + email_cta_button('Renew your membership &rarr;', 'https://www.stateofplay.club/subscribe')
        ),
    )


async def _downgrade_member(member_id: str, existing_labels: list[str], token: str) -> bool:
    """Reverses exactly what a one-time Standard-equivalent payment
    granted. Removing only one of the two labels would leave the other
    still satisfying tiers.is_paid_from_labels(), so access wouldn't
    actually change -- see subscription_grace.py's identical note."""
    new_labels = [l for l in existing_labels if l not in _DOWNGRADE_LABELS]
    if new_labels == existing_labels:
        return True  # already doesn't carry paid access
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f'Annual-renewal downgrade PUT failed for member {member_id}: {e!r}')
        return False


@router.post('/api/admin/annual-renewal/sweep')
async def annual_renewal_sweep(_admin: None = Depends(require_admin_key_or_session)):
    """Daily cron sweep. For every standard-equivalent, one-time-payment
    member (carries 'premium-subscriber', last payment has no
    subscription_id, not Trial/Student/corp/a native Ghost subscription):
    sends the day -14 reminder once, the day 0 grace-start notice once,
    and silently strips paid access once past the end of grace. Reports
    what it did; safe to re-run as often as the cron schedule likes."""
    if _db is None:
        return {'checked': 0, 'reminded': 0, 'grace_started': 0, 'downgraded': 0}
    await _ensure_indexes()
    token = _create_ghost_admin_token()
    if not token:
        return {
            'checked': 0, 'reminded': 0, 'grace_started': 0, 'downgraded': 0,
            'error': 'Ghost Admin API not configured',
        }

    members = await list_all_ghost_members(token)
    payment_summaries = await get_subscriber_payment_summaries()
    now = datetime.now(timezone.utc)

    checked = reminded = grace_started = downgraded = 0

    for member in members:
        email = (member.get('email') or '').lower().strip()
        if not email:
            continue
        label_names = [(l.get('name') or '') for l in (member.get('labels') or [])]
        lower_labels = [l.lower() for l in label_names]

        if 'premium-subscriber' not in lower_labels:
            continue
        if any(l in _EXCLUDED_LABELS for l in lower_labels):
            continue
        if any(l.startswith('corp-') for l in lower_labels):
            continue
        if member.get('subscriptions'):
            continue  # a real Ghost-native subscription/comp -- not this lifecycle

        summary = payment_summaries.get(email)
        last_payment = summary.get('last_payment') if summary else None
        if not last_payment or last_payment.get('subscription_id'):
            continue  # no payment on file, or an auto-renewing subscription -- subscription_grace.py's job

        expiry_iso = compute_synthetic_expiry(last_payment)
        if not expiry_iso:
            continue
        expiry_dt = datetime.fromisoformat(expiry_iso)
        if expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)

        checked += 1
        days_to_expiry = (expiry_dt - now).total_seconds() / 86400
        if days_to_expiry > REMINDER_DAYS_BEFORE:
            continue  # not due for any notice yet

        if days_to_expiry <= -GRACE_PERIOD_DAYS:
            if 'paid-via-razorpay' in lower_labels:
                ok = await _downgrade_member(member['id'], label_names, token)
                if ok:
                    downgraded += 1
            continue

        notice = await _db.annual_renewal_notices.find_one({'email': email, 'expiry': expiry_iso})

        if days_to_expiry <= 0:
            if not notice or not notice.get('grace_sent'):
                await send_email(to=email, subject='Your membership has lapsed', html=_grace_email_html())
                await _db.annual_renewal_notices.update_one(
                    {'email': email, 'expiry': expiry_iso},
                    {'$set': {'grace_sent': now}},
                    upsert=True,
                )
                grace_started += 1
            continue

        if not notice or not notice.get('reminder_sent'):
            expiry_date_str = expiry_dt.strftime('%d %B %Y')
            await send_email(to=email, subject='Your membership renews soon', html=_reminder_email_html(expiry_date_str))
            await _db.annual_renewal_notices.update_one(
                {'email': email, 'expiry': expiry_iso},
                {'$set': {'reminder_sent': now}},
                upsert=True,
            )
            reminded += 1

    return {'checked': checked, 'reminded': reminded, 'grace_started': grace_started, 'downgraded': downgraded}
