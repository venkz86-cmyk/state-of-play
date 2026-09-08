"""
paypal_orders.py — PayPal's Orders v2 API, the PayPal-side counterpart
to razorpay_orders.py's create-order/verify-payment for every
INTL-only one-time payment: standard (new signup), trial, student,
trial-upgrade. Team-5/Team-10 are excluded on purpose -- Venkat's own
"only INR for now" call already scoped those to Razorpay/India only,
so there's no PayPal path for them.

Deliberately reuses razorpay_orders.py's own PLAN_PRICING/
_resolve_plan_config rather than keeping a second copy of the same
prices -- the single most important property of offering two payment
providers side by side is that they can never quote a different price
for the same plan. Only ever called with country='INTL' in practice
(India stays Razorpay-only), but takes country like the Razorpay
version in case that ever changes.

Flow:
  1. Frontend calls POST /api/paypal/create-order with {plan}. Prices
     the plan via razorpay_orders.py's own resolver, creates a PayPal
     Order (intent=CAPTURE), returns {order_id, client_id} -- the
     PayPal JS SDK's Buttons widget uses these directly, unlike
     Razorpay Checkout.js which needs the full amount/currency too
     (PayPal already knows the amount, since it was set at order-
     creation time server-side).
  2. On the buyer's approval, the frontend calls POST
     /api/paypal/capture-order with {order_id, plan, email, name}.
     This module captures the payment via PayPal's own API (the only
     place "did this actually get paid" is trustworthy -- there's no
     client-side signature to verify the way Razorpay Checkout
     returns one), then finds-or-creates the Ghost member and applies
     the plan's labels, mirroring razorpay_orders.py's verify_payment
     as closely as the two providers' APIs allow.

Provides:
  * POST /api/paypal/create-order
  * POST /api/paypal/capture-order

Dependencies: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (paypal_client.py,
new -- not yet set on Render; every route 503s until they are), GHOST_URL,
GHOST_ADMIN_API_KEY (existing).

NOT YET TESTED against a live PayPal account -- built to PayPal's
documented Orders v2 API shape, same rigor as razorpay_orders.py, but
unlike that module's confirmed-against-the-installed-SDK note, this
has had no real request/response round-trip yet. Exercise this against
PayPal's Sandbox before trusting it with a real payment.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from paypal_client import paypal_request, is_configured, amount_minor_units_to_paypal_value
from razorpay_orders import _resolve_plan_config, _create_ghost_admin_token, TEAM_SEATS
from tiers import PLAN_LABELS, ensure_member_labeled, remove_member_label
from trial_tracking import start_trial
from payments import record_payment
from session_auth import get_current_member

logger = logging.getLogger(__name__)

router = APIRouter()

_recent_payments: Optional[dict] = None


def init(recent_payments: dict):
    global _recent_payments
    _recent_payments = recent_payments


class CreateOrderRequest(BaseModel):
    plan: str


@router.post('/api/paypal/create-order')
async def paypal_create_order(req: CreateOrderRequest):
    if not is_configured():
        raise HTTPException(status_code=503, detail='PayPal not configured')
    if req.plan in TEAM_SEATS:
        raise HTTPException(status_code=400, detail='Team plans are not available via PayPal')

    config = _resolve_plan_config(req.plan, 'INTL')
    if not config or config.get('currency') != 'USD':
        raise HTTPException(
            status_code=400,
            detail=f"No PayPal pricing configured for plan='{req.plan}'",
        )

    resp = await paypal_request('POST', '/v2/checkout/orders', json={
        'intent': 'CAPTURE',
        'purchase_units': [{
            'amount': {
                'currency_code': config['currency'],
                'value': amount_minor_units_to_paypal_value(config['amount']),
            },
            'description': config['label'],
            'custom_id': req.plan,
        }],
    })
    if resp is None or resp.status_code not in (200, 201):
        body = resp.text[:400] if resp is not None else 'no response'
        logger.error(f'PayPal order creation failed: {body!r}')
        raise HTTPException(status_code=502, detail='Could not create PayPal order')

    order = resp.json()
    return {
        'order_id': order['id'],
        'plan': req.plan,
        'label': config['label'],
    }


class CaptureOrderRequest(BaseModel):
    order_id: str
    email: EmailStr
    name: Optional[str] = ''
    plan: str


@router.post('/api/paypal/capture-order')
async def paypal_capture_order(req: CaptureOrderRequest, request: Request):
    """Called from the frontend's PayPal Buttons onApprove callback.
    Captures the payment via PayPal's own API -- that capture actually
    succeeding, confirmed server-side, is what's trustworthy here,
    since (unlike Razorpay Checkout) there's no client-returned
    signature to verify independently."""
    if not is_configured():
        raise HTTPException(status_code=503, detail='PayPal not configured')
    if req.plan not in PLAN_LABELS or req.plan in TEAM_SEATS:
        raise HTTPException(status_code=400, detail=f"Unknown or unsupported plan '{req.plan}'")

    resp = await paypal_request('POST', f'/v2/checkout/orders/{req.order_id}/capture')
    if resp is None:
        raise HTTPException(status_code=502, detail='Could not reach PayPal to capture payment')
    if resp.status_code not in (200, 201):
        logger.warning(f'PayPal capture failed for order={req.order_id}: {resp.status_code} {resp.text[:400]!r}')
        raise HTTPException(status_code=400, detail='PayPal payment capture failed')

    capture_data = resp.json()
    if capture_data.get('status') != 'COMPLETED':
        logger.warning(f'PayPal order {req.order_id} captured but status={capture_data.get("status")!r}')
        raise HTTPException(status_code=400, detail='PayPal payment was not completed')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    # Same "never trust a client-supplied identity when a real session
    # exists" rule razorpay_orders.py's verify_payment applies.
    session = await get_current_member(request)
    email = session['email'] if session else req.email.lower().strip()
    wanted_labels = PLAN_LABELS[req.plan]

    member = await ensure_member_labeled(
        email, req.name or '', wanted_labels, token,
        strip_unintended_paid_labels=(req.plan == 'trial'),
    )
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Payment captured but member setup failed, contact support',
        )

    if req.plan == 'trial':
        await start_trial(email, member.get('id', ''))

    if req.plan == 'trial-upgrade' and member.get('id'):
        existing_labels = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
        if 'tier-trial' in existing_labels:
            await remove_member_label(member['id'], existing_labels, 'tier-trial', token)

    if _recent_payments is not None:
        _recent_payments[email] = datetime.now(timezone.utc)

    # What PayPal itself says was captured -- purchase_units[0]'s own
    # capture record, not PLAN_PRICING, same "trust the processor's own
    # record of the charge" principle payments.fetch_and_record uses
    # for Razorpay.
    try:
        capture = capture_data['purchase_units'][0]['payments']['captures'][0]
        amount_value = capture['amount']['value']
        currency = capture['amount']['currency_code']
        capture_id = capture['id']
        amount_minor_units = round(float(amount_value) * 100)
    except (KeyError, IndexError, ValueError):
        capture_id = req.order_id
        amount_minor_units = None
        currency = 'USD'

    await record_payment(
        payment_id=capture_id,
        email=email,
        amount=amount_minor_units,
        currency=currency,
        plan=req.plan,
        source='paypal_order_capture',
        order_id=req.order_id,
        name=req.name or '',
    )

    return {'verified': True, 'email': email, 'plan': req.plan}
