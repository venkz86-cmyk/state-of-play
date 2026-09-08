"""
paypal_subscriptions.py — real auto-renewing membership via PayPal,
the PayPal-side counterpart to razorpay_subscriptions.py. Same one
case, same policy: an existing subscriber renewing right now pays the
current renewal rate ($149/year) in one step, and that same approval
sets up real recurring billing from this point forward. INTL-only --
India stays on Razorpay entirely, per Venkat's call to run PayPal
alongside (not instead of) Razorpay for international payments only.

PayPal's Subscriptions API needs a Product and a Billing Plan created
ahead of time (PayPal's equivalent of Razorpay's Plan ID) -- unlike
Razorpay, this module can create both itself via ensure_billing_plan(),
a one-time setup call (see its own docstring), rather than making
Venkat click through PayPal's dashboard by hand.

Flow:
  1. One-time setup: ensure_billing_plan() creates a PayPal Product +
     Billing Plan for the $149/year renewal, prints the resulting
     plan_id to store in PAYPAL_PLAN_ID (Render env var) -- run once,
     not on every request.
  2. Frontend calls POST /api/paypal/create-subscription. Creates a
     PayPal Subscription against PAYPAL_PLAN_ID, returns
     {subscription_id} for the PayPal JS SDK's subscription Buttons
     (createSubscription) to open the approval flow.
  3. On the buyer's approval, PayPal's JS SDK onApprove callback gives
     back the same subscription_id directly (no redirect needed) --
     the frontend calls POST /api/paypal/verify-subscription with it.
     This module checks the subscription's real status via PayPal's
     own API (GET .../billing/subscriptions/{id}) rather than trusting
     the client, then finds-or-creates the Ghost member and applies
     labels, mirroring razorpay_subscriptions.py's verify_subscription.
  4. Subscription lifecycle webhooks (BILLING.SUBSCRIPTION.ACTIVATED,
     .SUSPENDED, .CANCELLED, PAYMENT.SALE.COMPLETED for each recurring
     charge) feed the SAME subscription_grace.py machinery
     razorpay_subscriptions.py uses -- a failed recurring charge gets
     the same one-week grace period Venkat decided on, regardless of
     which provider it came through.

Provides:
  * ensure_billing_plan() -- one-time setup helper, not a route.
  * POST /api/paypal/create-subscription
  * POST /api/paypal/verify-subscription
  * POST /api/paypal/webhook -- subscription lifecycle events.

Dependencies: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (paypal_client.py),
PAYPAL_PLAN_ID (new -- set once ensure_billing_plan() has been run),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).

NOT YET TESTED against a live PayPal account -- same caveat as
paypal_orders.py. PayPal's webhook signature verification
(PAYPAL-TRANSMISSION-SIG etc.) is intentionally NOT implemented yet --
flagged below, not guessed at, the same way this codebase treats
anything it hasn't confirmed against the real thing.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from paypal_client import paypal_request, is_configured, amount_minor_units_to_paypal_value
from tiers import PLAN_LABELS, ensure_member_labeled
from payments import record_payment
from subscription_grace import start_grace_period, clear_grace_period
from razorpay_subscriptions import _create_ghost_admin_token  # shared Ghost JWT helper

logger = logging.getLogger(__name__)

router = APIRouter()

_recent_payments: Optional[dict] = None


def init(recent_payments: dict):
    global _recent_payments
    _recent_payments = recent_payments


PAYPAL_PLAN_ID = os.environ.get('PAYPAL_PLAN_ID', '')

# Same $149/year renewal rate as razorpay_subscriptions.py's
# SUBSCRIPTION_PLANS['INTL'] -- kept as its own constant here (rather
# than importing that dict) since PayPal's Billing Plan bakes the
# price in at creation time in PayPal's own system, not per-request
# the way Razorpay's create-subscription passes an amount each time.
RENEWAL_AMOUNT_MINOR_UNITS = 14900  # $149
RENEWAL_CURRENCY = 'USD'
RENEWAL_LABEL = 'Annual Membership'


async def ensure_billing_plan() -> Optional[str]:
    """One-time setup, not wired to any route -- run by hand (e.g. from
    a Python shell against this module) once, the resulting plan_id
    goes into PAYPAL_PLAN_ID on Render. Re-running this creates a
    SECOND Product/Plan rather than reusing the first -- PayPal has no
    natural idempotency key for this the way Mongo upserts do -- so
    this is deliberately not something that runs automatically at
    startup or per-request."""
    if not is_configured():
        logger.error('ensure_billing_plan: PayPal not configured')
        return None

    product_resp = await paypal_request('POST', '/v1/catalogs/products', json={
        'name': 'The State of Play — Annual Membership',
        'description': 'Weekly reported publication on the business of Indian sport.',
        'type': 'SERVICE',
        'category': 'MEDIA_CONTENT_AND_INFORMATION_SERVICES',
    })
    if product_resp is None or product_resp.status_code not in (200, 201):
        body = product_resp.text[:400] if product_resp is not None else 'no response'
        logger.error(f'PayPal product creation failed: {body!r}')
        return None
    product_id = product_resp.json()['id']

    plan_resp = await paypal_request('POST', '/v1/billing/plans', json={
        'product_id': product_id,
        'name': 'Annual Membership — $149/year',
        'billing_cycles': [{
            'frequency': {'interval_unit': 'YEAR', 'interval_count': 1},
            'tenure_type': 'REGULAR',
            'sequence': 1,
            'total_cycles': 0,  # 0 = runs indefinitely
            'pricing_scheme': {
                'fixed_price': {
                    'value': amount_minor_units_to_paypal_value(RENEWAL_AMOUNT_MINOR_UNITS),
                    'currency_code': RENEWAL_CURRENCY,
                },
            },
        }],
        'payment_preferences': {
            'auto_bill_outstanding': True,
            # Matches razorpay_subscriptions.py's grace-period policy --
            # PayPal's own retry/suspend behavior is separate from (and
            # faster than) our 7-day grace period, so this just needs to
            # be lenient enough that PAYMENT.SALE.COMPLETED gets a real
            # chance to land before PayPal gives up on its own.
            'payment_failure_threshold': 3,
        },
    })
    if plan_resp is None or plan_resp.status_code not in (200, 201):
        body = plan_resp.text[:400] if plan_resp is not None else 'no response'
        logger.error(f'PayPal billing plan creation failed: {body!r}')
        return None

    plan_id = plan_resp.json()['id']
    logger.warning(f'PayPal billing plan created: {plan_id} -- set this as PAYPAL_PLAN_ID')
    return plan_id


@router.post('/api/paypal/create-subscription')
async def paypal_create_subscription():
    if not is_configured():
        raise HTTPException(status_code=503, detail='PayPal not configured')
    if not PAYPAL_PLAN_ID:
        raise HTTPException(status_code=503, detail='PayPal billing plan not yet created (run ensure_billing_plan())')

    resp = await paypal_request('POST', '/v1/billing/subscriptions', json={
        'plan_id': PAYPAL_PLAN_ID,
    })
    if resp is None or resp.status_code not in (200, 201):
        body = resp.text[:400] if resp is not None else 'no response'
        logger.error(f'PayPal subscription creation failed: {body!r}')
        raise HTTPException(status_code=502, detail='Could not create PayPal subscription')

    subscription = resp.json()
    return {
        'subscription_id': subscription['id'],
        'amount': RENEWAL_AMOUNT_MINOR_UNITS,
        'currency': RENEWAL_CURRENCY,
        'label': RENEWAL_LABEL,
    }


class VerifySubscriptionRequest(BaseModel):
    subscription_id: str
    email: EmailStr
    name: Optional[str] = ''


@router.post('/api/paypal/verify-subscription')
async def paypal_verify_subscription(req: VerifySubscriptionRequest):
    """Unlike Razorpay Checkout, PayPal's JS SDK doesn't hand back a
    signature to verify -- the trustworthy step is calling PayPal's own
    API to confirm the subscription is really ACTIVE, not accepting
    the client's word for it."""
    if not is_configured():
        raise HTTPException(status_code=503, detail='PayPal not configured')

    resp = await paypal_request('GET', f'/v1/billing/subscriptions/{req.subscription_id}')
    if resp is None or resp.status_code != 200:
        raise HTTPException(status_code=400, detail='Could not verify PayPal subscription')

    subscription = resp.json()
    if subscription.get('status') != 'ACTIVE':
        raise HTTPException(status_code=400, detail=f'Subscription is not active (status={subscription.get("status")!r})')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    email = req.email.lower().strip()
    member = await ensure_member_labeled(email, req.name or '', PLAN_LABELS['standard'], token)
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Subscription verified but member setup failed, contact support',
        )

    if _recent_payments is not None:
        _recent_payments[email] = datetime.now(timezone.utc)

    await record_payment(
        payment_id=f'paypal-sub-{req.subscription_id}-{int(datetime.now(timezone.utc).timestamp())}',
        email=email,
        amount=RENEWAL_AMOUNT_MINOR_UNITS,
        currency=RENEWAL_CURRENCY,
        plan='standard',
        source='paypal_subscription_verify',
        subscription_id=req.subscription_id,
        name=req.name or '',
    )

    return {'verified': True, 'email': email}


@router.post('/api/paypal/webhook')
async def paypal_webhook(request: Request):
    """PayPal's subscription lifecycle events. Signature verification
    (PayPal's /v1/notifications/verify-webhook-signature endpoint,
    using the transmission headers PayPal sends) is NOT implemented
    yet -- flagged here rather than silently skipped. Low real risk
    today (a spoofed event can only start a grace period early or
    clear one, neither of which grants or charges anything by itself),
    but this needs finishing before going live for real."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid JSON')

    event_type = payload.get('event_type', '')
    resource = payload.get('resource', {})
    subscription_id = resource.get('id') or resource.get('billing_agreement_id') or 'unknown'

    if event_type == 'PAYMENT.SALE.COMPLETED':
        # A recurring charge succeeded -- if this subscription was
        # previously in a grace period (an earlier failed charge),
        # cancel that pending downgrade.
        await clear_grace_period(subscription_id)
    elif event_type in ('BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'):
        await start_grace_period(subscription_id)
    elif event_type in ('BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.CANCELLED'):
        logger.info(f'PayPal subscription event {event_type}: {subscription_id}')
    else:
        logger.info(f'Unhandled PayPal webhook event {event_type}: {subscription_id}')

    return {'status': 'ok'}
