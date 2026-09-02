"""
razorpay_subscriptions.py — real auto-renewing membership, built for the
Nov 1 2026 pricing transition. Companion to razorpay_orders.py — one-time
Orders stay the mechanism for Student and Trial; this module is only for
the ongoing annual membership.

Three signup/renewal cases, one underlying mechanism (a Razorpay
Subscription with either a deferred or an immediate first charge):

  X — signs up now, before Nov 1: pays today's one-time price through the
      EXISTING Orders flow (razorpay_orders.py, plan='standard',
      unchanged — still 294900 paise). Alongside that, a Subscription is
      created here on the 'existing' (grandfathered) Plan with `start_at`
      set ~1 year out, so the mandate is authorised today but the first
      auto-charge, at the grandfathered rate, only happens at their real
      renewal next year.
  Y — an existing subscriber renewing right now: a Subscription on the
      same 'existing' Plan, but `start_at` = now, so the renewal payment
      itself IS the subscription's first charge, and it recurs from there.
  Z — signs up from Nov 1 onward: a Subscription on the 'new' Plan,
      `start_at` = now. No bridge order — there's no old rate to honour.

Provides:
  * SUBSCRIPTION_PLANS                     — tier+country -> plan config
  * POST /api/razorpay/create-subscription — creates the Subscription for
    X/Y/Z per the above, returns what the frontend needs to open Razorpay
    Checkout in subscription mode (subscription_id, not order_id).
  * POST /api/razorpay/verify-subscription — verifies the checkout
    signature, then finds-or-creates the Ghost member and applies labels,
    mirroring razorpay_orders.py's verify_payment.
  * POST /api/razorpay/webhook already exists in server.py for one-time
    payment events; subscription lifecycle events (authenticated,
    activated, charged, halted, cancelled) are handled separately here —
    see handle_subscription_webhook_event(), called from server.py's
    webhook handler for subscription.* event types.

NOT YET DECIDED, deliberately not guessed at: what happens to paid access
when a renewal auto-charge fails and a subscription goes `halted` —
immediate downgrade or a grace period first. Until that's decided,
`subscription.halted` is logged only; the paid label is left untouched.

Plan IDs below are placeholders (empty string). Venkat creates the four
real Plans (existing/new x IN/INTL) in the Razorpay dashboard's
Subscriptions product and hands back the plan_ids.

Two things flagged as needing a live test in Razorpay's test mode before
this goes live, not just a code review: (1) that a `start_at`-deferred
subscription actually lets the mandate authenticate now while deferring
the charge, without an unexpected small verification charge landing on
the customer; (2) the exact SDK method for verifying a subscription
checkout's signature — this module assumes
`client.utility.verify_subscription_payment_signature`, mirroring
`verify_payment_signature` used for Orders, but that name should be
confirmed against the installed razorpay SDK version before relying on it.

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (existing, now live),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from tiers import PLAN_LABELS, ensure_member_labeled

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


# tier -> country -> Plan config. 'existing' is the grandfathered rate for
# anyone who was a member before Nov 1 (X's deferred year-2 billing, and
# Y's renewal-now billing, both land here). 'new' is Z's rate.
# plan_id is filled in once Venkat creates these in the Razorpay dashboard.
SUBSCRIPTION_PLANS = {
    'existing': {
        'IN': {'plan_id': '', 'amount': 353900, 'currency': 'INR', 'label': 'Annual Membership'},   # 2,999 + 18% GST = 3,538.82 -> 3,539
        'INTL': {'plan_id': '', 'amount': 14900, 'currency': 'USD', 'label': 'Annual Membership'},  # $149
    },
    'new': {
        'IN': {'plan_id': '', 'amount': 412900, 'currency': 'INR', 'label': 'Annual Membership'},   # 3,499 + 18% GST = 4,128.82 -> 4,129
        'INTL': {'plan_id': '', 'amount': 16900, 'currency': 'USD', 'label': 'Annual Membership'},  # $169
    },
}

# A Razorpay Subscription needs a finite total_count, not true "forever".
# 100 yearly cycles reads as effectively indefinite for a publication.
TOTAL_COUNT_YEARS = 100



def _resolve_plan_config(tier: str, country: str) -> Optional[dict]:
    plans = SUBSCRIPTION_PLANS.get(tier)
    if not plans:
        return None
    geo = country if country in plans else ('IN' if 'IN' in plans else None)
    return plans.get(geo)


class CreateSubscriptionRequest(BaseModel):
    tier: str          # 'existing' | 'new'
    country: str = 'IN'
    deferred: bool = False  # True for X: mandate now, first charge ~1 year out


@router.post('/api/razorpay/create-subscription')
async def create_subscription(req: CreateSubscriptionRequest):
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    config = _resolve_plan_config(req.tier, req.country)
    if not config:
        raise HTTPException(
            status_code=400,
            detail=f"No pricing configured for tier='{req.tier}' country='{req.country}'",
        )
    if not config['plan_id']:
        raise HTTPException(
            status_code=503,
            detail=f"Razorpay Plan not yet created for tier='{req.tier}' country='{req.country}'",
        )

    params = {
        'plan_id': config['plan_id'],
        'customer_notify': 1,
        'total_count': TOTAL_COUNT_YEARS,
        'notes': {'tier': req.tier, 'country': req.country},
    }
    if req.deferred:
        params['start_at'] = int(time.time()) + 365 * 24 * 60 * 60

    try:
        subscription = _razorpay_client.subscription.create(params)
    except Exception as e:
        logger.error(f'Razorpay subscription creation failed: {e!r}')
        raise HTTPException(status_code=502, detail='Could not create subscription')

    return {
        'subscription_id': subscription['id'],
        'amount': config['amount'],
        'currency': config['currency'],
        'key_id': os.environ.get('RAZORPAY_KEY_ID', ''),
        'tier': req.tier,
        'deferred': req.deferred,
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

    # Every subscription tier (existing/grandfathered or new) is a full paid
    # membership product-wise, just at a different price point — same label
    # set as the one-shot standard plan.
    member = await ensure_member_labeled(email, req.name or '', PLAN_LABELS['standard'], token)
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Payment verified but member setup failed, contact support',
        )

    if _recent_payments is not None:
        _recent_payments[email] = datetime.now(timezone.utc)

    return {'verified': True, 'email': email}


def handle_subscription_webhook_event(event: str, payload: dict) -> None:
    """Called from server.py's razorpay_webhook for subscription.* events
    other than .activated and .charged — those two now get the same Ghost
    labeling + Slack treatment as payment.captured, handled directly in
    server.py's primary webhook branch. .halted is logged, not acted on —
    see the module docstring for why."""
    subscription_entity = payload.get('payload', {}).get('subscription', {}).get('entity', {})
    sub_id = subscription_entity.get('id', 'unknown')

    if event == 'subscription.halted':
        logger.warning(
            f'Subscription halted (renewal charge failed): {sub_id} — '
            f'no automatic action taken, grace-period policy not yet decided'
        )
    elif event in ('subscription.authenticated', 'subscription.activated', 'subscription.cancelled'):
        logger.info(f'Subscription event {event}: {sub_id}')
    else:
        logger.info(f'Unhandled subscription event {event}: {sub_id}')
