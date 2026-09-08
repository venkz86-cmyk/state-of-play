"""
paypal_client.py — the shared bit paypal_orders.py and
paypal_subscriptions.py both need: an OAuth2 access token and a small
authed-request helper. No SDK -- PayPal's REST API is plain HTTPS,
same "one httpx call, no dependency" choice resend_email.py already
made for Resend.

PayPal alongside Razorpay for every INTL plan (standard, trial,
student, trial-upgrade, renewal), per Venkat's call -- India stays
Razorpay-only. Nothing in this module (or paypal_orders.py/
paypal_subscriptions.py) does anything until PAYPAL_CLIENT_ID/
PAYPAL_CLIENT_SECRET are set; every route 503s cleanly until then,
same shape as razorpay_client being None before Razorpay's keys exist.

PAYPAL_MODE controls sandbox vs live -- defaults to 'sandbox' so a
misconfigured/missing env var can never accidentally point at real
money. Set to 'live' only once Venkat is ready to actually charge
people.

Provides:
  * get_access_token() -- cached in memory, refetched a minute before
    PayPal's own expiry so a request never races an expiring token.
  * paypal_request(method, path, json=None) -> httpx.Response -- every
    authed call to PayPal's API goes through this, so the token-cache/
    refresh logic exists exactly once.
  * is_configured() -- whether PAYPAL_CLIENT_ID/SECRET are both set.

Dependencies: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (new), PAYPAL_MODE
(new, optional, defaults to 'sandbox').
"""
from __future__ import annotations

import os
import base64
import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PAYPAL_CLIENT_ID = os.environ.get('PAYPAL_CLIENT_ID', '')
PAYPAL_CLIENT_SECRET = os.environ.get('PAYPAL_CLIENT_SECRET', '')
PAYPAL_MODE = os.environ.get('PAYPAL_MODE', 'sandbox')

PAYPAL_API_BASE = (
    'https://api-m.paypal.com' if PAYPAL_MODE == 'live'
    else 'https://api-m.sandbox.paypal.com'
)

# Module-level cache -- one token shared by every request this process
# makes, refreshed only when it's actually close to expiring rather
# than once per call. PayPal's own tokens last ~9 hours.
_cached_token: Optional[str] = None
_token_expires_at: float = 0.0
_REFRESH_MARGIN_SECONDS = 60


def is_configured() -> bool:
    return bool(PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET)


async def get_access_token() -> Optional[str]:
    global _cached_token, _token_expires_at
    if not is_configured():
        return None
    if _cached_token and time.time() < _token_expires_at - _REFRESH_MARGIN_SECONDS:
        return _cached_token

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f'{PAYPAL_API_BASE}/v1/oauth2/token',
                data={'grant_type': 'client_credentials'},
                auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
        if resp.status_code != 200:
            logger.error(f'PayPal OAuth token request failed: {resp.status_code} {resp.text[:300]!r}')
            return None
        data = resp.json()
        _cached_token = data.get('access_token')
        _token_expires_at = time.time() + (data.get('expires_in') or 0)
        return _cached_token
    except Exception as e:
        logger.error(f'PayPal OAuth token request errored: {e!r}')
        return None


async def paypal_request(method: str, path: str, json: Optional[dict] = None) -> Optional[httpx.Response]:
    """Every authed PayPal API call goes through here. Returns None only
    if a token couldn't be obtained at all (not configured, or PayPal's
    own token endpoint failed) -- an actual API error still returns its
    real httpx.Response so the caller can read PayPal's own error body."""
    token = await get_access_token()
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            return await client.request(
                method, f'{PAYPAL_API_BASE}{path}',
                json=json,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json',
                },
            )
    except Exception as e:
        logger.error(f'PayPal API request failed ({method} {path}): {e!r}')
        return None


def amount_minor_units_to_paypal_value(amount_minor_units: int) -> str:
    """PLAN_PRICING stores amounts the Razorpay way -- an integer count
    of the currency's smallest unit (cents for USD). PayPal's Orders/
    Subscriptions APIs want a decimal string instead ('120.00', not
    12000) -- every dollar amount in this codebase is USD-only for
    PayPal (INTL scope, cents), so dividing by 100 is always correct
    here, unlike payments.py's formatCurrency equivalent which also
    has to handle INR."""
    return f'{amount_minor_units / 100:.2f}'
