"""
razorpay_orders.py — dynamic Razorpay Orders API checkout, built ahead of the
October 1st anniversary launch (Student, Trial, WhatsApp add-on all ship
together that day).

The two live Razorpay Payment Buttons (still untouched, still working) can
only ever represent ONE fixed amount each, set by hand in the Razorpay
dashboard. That doesn't scale once several plans (standard, trial, student)
and later add-on combinations (WhatsApp delivery, bundled at renewal) all
need their own price — every combination would need its own dashboard
button. This module creates a Razorpay Order server-side for whatever
plan/amount our own code decides, and verifies the payment signature when
checkout completes, instead of relying on a pile of static buttons.

Flow:
  1. Frontend calls POST /api/razorpay/create-order with {plan, country}.
  2. This module looks up the price in PLAN_PRICING, creates a Razorpay
     order, returns {order_id, amount, currency, key_id} for Razorpay
     Checkout (checkout.js) to open directly — no dashboard button involved.
  3. On success, Checkout's handler callback calls POST
     /api/razorpay/verify-payment with the returned payment id/order
     id/signature. The signature is verified server-side (never trust the
     client alone) using the same SDK the two-button flow already imports
     (see server.py's `razorpay_client`, reused here rather than
     re-initialized), then the Ghost member for that email is found or
     created with the plan's labels.

Provides:
  * PLAN_PRICING, PLAN_LABELS      — plan+country -> price; plan -> labels
  * POST /api/razorpay/create-order
  * POST /api/razorpay/verify-payment

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (new — not yet set on
Render; `razorpay_client` is None and both routes 503 until they are),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from tiers import PLAN_LABELS, ensure_member_labeled
from trial_tracking import start_trial
from referrals import resolve_referral_code, REFERRED_SIGNUP_AMOUNT_PAISE, REFERRED_SIGNUP_LABEL

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

router = APIRouter()

# Injected by server.py at mount time: the already-initialized razorpay SDK
# client (None if RAZORPAY_KEY_ID/SECRET aren't set) and the same
# recent_payments dict the webhook already writes to for seamless post-payment
# login, so a wrapper-driven payment behaves identically to a button-driven one.
_razorpay_client = None
_recent_payments: Optional[dict] = None


def init(razorpay_client, recent_payments: dict):
    global _razorpay_client, _recent_payments
    _razorpay_client = razorpay_client
    _recent_payments = recent_payments


def _create_ghost_admin_token() -> Optional[str]:
    """JWT for Ghost Admin API; identical algorithm to every other module here."""
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


# plan -> country -> price. Amounts are in the smallest currency unit
# (paise for INR, cents for USD), as Razorpay's Orders API requires.
# Trial and Student are India-only for now — no international price has
# been set for either.
PLAN_PRICING = {
    'standard': {
        'IN': {'amount': 294900, 'currency': 'INR', 'label': 'Annual Membership'},   # ₹2,499 + 18% GST = ₹2,949
        'INTL': {'amount': 12000, 'currency': 'USD', 'label': 'Annual Membership'},  # $120
    },
    'trial': {
        'IN': {'amount': 59000, 'currency': 'INR', 'label': 'Trial Pack'},           # ₹500 + 18% GST = ₹590
    },
    'student': {
        'IN': {'amount': 177000, 'currency': 'INR', 'label': 'Student Membership'},  # ₹1,500 + 18% GST = ₹1,770
    },
}

def _resolve_plan_config(plan: str, country: str) -> Optional[dict]:
    plans = PLAN_PRICING.get(plan)
    if not plans:
        return None
    geo = country if country in plans else ('IN' if 'IN' in plans else None)
    return plans.get(geo)


class CreateOrderRequest(BaseModel):
    plan: str
    country: str = 'IN'


@router.post('/api/razorpay/create-order')
async def create_order(req: CreateOrderRequest, request: Request):
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    config = _resolve_plan_config(req.plan, req.country)
    if not config:
        raise HTTPException(
            status_code=400,
            detail=f"No pricing configured for plan='{req.plan}' country='{req.country}'",
        )

    # A referred new-India-signup pays the existing/renewal rate instead
    # of the standard new-signup rate — no third price point, matching
    # Venkat's call. Only applies to plain 'standard' signups; trial,
    # student, and community-offer amounts are untouched.
    amount = config['amount']
    label = config['label']
    notes = {'plan': req.plan}
    referral_code = resolve_referral_code(request) if req.plan == 'standard' and req.country == 'IN' else None
    if referral_code:
        amount = REFERRED_SIGNUP_AMOUNT_PAISE
        label = REFERRED_SIGNUP_LABEL
        notes['referral_code'] = referral_code

    try:
        order = _razorpay_client.order.create({
            'amount': amount,
            'currency': config['currency'],
            'payment_capture': 1,
            'notes': notes,
        })
    except Exception as e:
        logger.error(f'Razorpay order creation failed: {e!r}')
        raise HTTPException(status_code=502, detail='Could not create payment order')

    return {
        'order_id': order['id'],
        'amount': amount,
        'currency': config['currency'],
        'key_id': os.environ.get('RAZORPAY_KEY_ID', ''),
        'plan': req.plan,
        'label': label,
    }


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    email: EmailStr
    name: Optional[str] = ''
    plan: str


@router.post('/api/razorpay/verify-payment')
async def verify_payment(req: VerifyPaymentRequest):
    """Called from Razorpay Checkout's success handler, immediately after
    payment. Verifies the signature server-side (a client can't be trusted
    to just say 'it worked'), then makes sure a correctly-labeled Ghost
    member exists for this email — creating one if this is a brand-new
    signup, or adding the plan's labels if they already had a free account."""
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    if req.plan not in PLAN_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{req.plan}'")

    try:
        _razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature,
        })
    except Exception:
        logger.warning(f'Razorpay signature verification failed for order={req.razorpay_order_id}')
        raise HTTPException(status_code=400, detail='Payment signature verification failed')

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    email = req.email.lower().strip()
    wanted_labels = PLAN_LABELS[req.plan]

    member = await ensure_member_labeled(
        email, req.name or '', wanted_labels, token,
        strip_unintended_paid_labels=(req.plan == 'trial'),
    )
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Payment verified but member setup failed, contact support',
        )

    if req.plan == 'trial':
        await start_trial(email, member.get('id', ''))

    if _recent_payments is not None:
        _recent_payments[email] = datetime.now(timezone.utc)

    return {'verified': True, 'email': email, 'plan': req.plan}
