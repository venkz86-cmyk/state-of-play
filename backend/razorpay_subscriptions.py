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
not an immediate downgrade. Handled by subscription_grace.py, shared
with paypal_subscriptions.py so two payment providers can't disagree
on this policy: start_grace_period() records the halt and emails the
subscriber once; POST /api/subscriptions/grace/expire-check (an
admin-gated sweep, wired to run daily via a Render Cron Job) strips
paid access from anyone still in grace past their `grace_ends_at`. If
the subscription successfully charges again first (`subscription.
charged`, handled in server.py's main webhook branch),
clear_grace_period() cancels the pending downgrade.

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
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from tiers import PLAN_LABELS, ensure_member_labeled
from payments import fetch_and_record
from subscription_grace import start_grace_period

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

router = APIRouter()

# Injected by server.py at mount time — same pattern as razorpay_orders.py.
_razorpay_client = None
_recent_payments: Optional[dict] = None


def init(razorpay_client, recent_payments: dict):
    global _razorpay_client, _recent_payments
    _razorpay_client = razorpay_client
    _recent_payments = recent_payments


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


async def handle_subscription_webhook_event(event: str, payload: dict) -> None:
    """Called from server.py's razorpay_webhook for subscription.* events
    other than .activated and .charged — those two now get the same Ghost
    labeling + Slack treatment as payment.captured, handled directly in
    server.py's primary webhook branch (which also calls
    clear_grace_period() there for a successful charge)."""
    subscription_entity = payload.get('payload', {}).get('subscription', {}).get('entity', {})
    sub_id = subscription_entity.get('id', 'unknown')

    if event == 'subscription.halted':
        await start_grace_period(sub_id)
    elif event in ('subscription.authenticated', 'subscription.cancelled'):
        logger.info(f'Subscription event {event}: {sub_id}')
    else:
        logger.info(f'Unhandled subscription event {event}: {sub_id}')
