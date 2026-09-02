"""
referrals.py — flat Rs 500-both-ways referral programme.

Design (Sept 2 2026, agreed with Venkat, deliberately simpler than the
community-written spec this replaces): a referrer earns Rs 500 banked
credit per successful individual referral, applied at their own next
renewal. The referred friend pays the same rate as an existing/renewal
subscriber (the SUBSCRIPTION_PLANS['existing'] price) instead of the
standard new-signup rate, so no new price point is invented.

There is deliberately no Ghost comp-grant mechanism here (unlike the
original spec) — the reward is a discount at a normal checkout, reusing
the same Razorpay Orders + webhook + Ghost-labeling pipeline every other
plan already goes through. tiers.py's PAID_LABELS/resolve_tier is the
only thing that has ever decided access in this codebase; Ghost's native
subscription/comp status is not read anywhere, and this module doesn't
change that.

Fraud/integrity rules, unchanged from the original spec: no self-referral,
one credit per referred email ever (not per purchase — enforced by a
unique index on referrals.referred_email), credit stays 'pending' for a
30-day refund-safe hold before it 'cleared's. Only the amount changed —
flat Rs 500, not a tiered formula.

Attribution is first-touch: a referral cookie is only set if the visitor
doesn't already carry a valid one, so the first friend who shared a link
gets credit, not the last one clicked before purchase (Venkat's explicit
call, the reverse of what the original spec recommended).

NOT YET BUILT (see the plan file's build order — this is Stage 1 only):
  * the daily clearing job that moves pending credit to cleared/expired
  * refund handling (rejecting/reversing credit)
  * the /account/referrals member-facing progress page
  * applying banked credit at renewal checkout (needs the renewal flow
    to exist first)
  * the frontend route/redirect for /r/{code} — this module returns a
    real redirect response, but nothing in frontend/vercel.json routes
    that path to the backend yet the way /s/:token already does for cold
    links. Needs a one-line vercel.json rewrite before links actually work.

Provides:
  * ensure_referral_account(ghost_member_id, email) -> referral_code
  * GET  /api/referrals/me?email=       — code + balance (ledger deferred)
  * GET  /r/{code}                       — sets attribution cookie, redirects
  * resolve_referral_code(request)       — used by razorpay_orders.py
  * record_referral_earn(...)            — called from server.py's webhook
  * REFERRED_SIGNUP_AMOUNT_PAISE, REFERRED_SIGNUP_LABEL — for razorpay_orders.py

Dependencies: JWT_SECRET (existing, reused to sign the attribution cookie
— same tool already imported everywhere else in this codebase, no new
secret needed), GHOST_URL (existing).
"""
from __future__ import annotations

import os
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse

from razorpay_subscriptions import SUBSCRIPTION_PLANS

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get('JWT_SECRET', '')

REFERRAL_COOKIE_NAME = 'sop_ref'
REFERRAL_COOKIE_TTL_DAYS = 30
REFERRAL_HOLD_DAYS = 30
REFERRAL_CREDIT_EXPIRY_DAYS = 730  # 2 years, from clear date
REFERRAL_CREDIT_PAISE = 50000  # Rs 500, flat, both sides

# The referred friend pays the same rate as an existing/renewal
# subscriber — referenced from razorpay_subscriptions.py, never
# duplicated, so a future price change only needs one edit.
REFERRED_SIGNUP_AMOUNT_PAISE = SUBSCRIPTION_PLANS['existing']['IN']['amount']
REFERRED_SIGNUP_LABEL = 'Annual Membership (referred)'

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.referral_accounts.create_index('ghost_member_id', unique=True)
        await _db.referral_accounts.create_index('referral_code', unique=True)
        await _db.referrals.create_index('referred_email', unique=True)
        await _db.credit_ledger.create_index('owner_ghost_member_id')
    except Exception as e:
        logger.warning(f'referrals index creation failed (non-fatal): {e!r}')


def _sign_cookie(referral_code: str) -> Optional[str]:
    if not JWT_SECRET:
        return None
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        'code': referral_code,
        'iat': now,
        'exp': now + REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def _read_cookie(token: str) -> Optional[str]:
    if not JWT_SECRET or not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('code')
    except Exception:
        return None


def resolve_referral_code(request: Request) -> Optional[str]:
    """Called from razorpay_orders.py's create_order to check for a valid
    attribution cookie on the checkout request. Returns the referral code
    if present and well-formed, None otherwise — does not touch the
    database (that happens at webhook time, once payment is confirmed)."""
    token = request.cookies.get(REFERRAL_COOKIE_NAME, '')
    return _read_cookie(token)


async def ensure_referral_account(ghost_member_id: str, email: str) -> Optional[str]:
    """Idempotent — returns the existing code if one exists, otherwise
    mints a new one. Mirrors trial_tracking.start_trial's lazy-create
    pattern."""
    if _db is None:
        logger.warning('referrals: no db handle, skipping ensure_referral_account')
        return None

    await ensure_indexes()

    existing = await _db.referral_accounts.find_one({'ghost_member_id': ghost_member_id})
    if existing:
        return existing['referral_code']

    code = secrets.token_urlsafe(9)[:12]  # ~12 URL-safe chars, non-sequential
    record = {
        'ghost_member_id': ghost_member_id,
        'email': email.lower().strip(),
        'referral_code': code,
        'status': 'active',
        'created_at': datetime.now(timezone.utc),
    }
    try:
        await _db.referral_accounts.insert_one(record)
    except Exception as e:
        # Extremely unlikely code collision — retry once with a fresh code
        # rather than fail the whole request.
        logger.warning(f'referral_accounts insert failed, retrying once: {e!r}')
        code = secrets.token_urlsafe(9)[:12]
        record['referral_code'] = code
        await _db.referral_accounts.insert_one(record)
    return code


async def record_referral_earn(
    referral_code: str,
    referred_email: str,
    razorpay_payment_id: str,
    captured_at_unix: Optional[int],
) -> None:
    """Called from server.py's webhook when a captured payment carries a
    referral_code in its notes. Creates the referrals row and a pending
    earn ledger entry — or rejects outright (self-referral, duplicate
    referred_email) rather than silently dropping."""
    if _db is None:
        logger.warning('referrals: no db handle, skipping record_referral_earn')
        return

    await ensure_indexes()

    referred_email = referred_email.lower().strip()
    account = await _db.referral_accounts.find_one({'referral_code': referral_code})
    if not account:
        logger.warning(f'record_referral_earn: unknown referral_code {referral_code!r}')
        return

    if account['email'] == referred_email:
        logger.info(f'Self-referral rejected for {referred_email}')
        return

    captured_at = (
        datetime.fromtimestamp(captured_at_unix, tz=timezone.utc)
        if captured_at_unix else datetime.now(timezone.utc)
    )
    available_at = captured_at + timedelta(days=REFERRAL_HOLD_DAYS)

    referral_doc = {
        'referred_email': referred_email,
        'referrer_ghost_member_id': account['ghost_member_id'],
        'razorpay_payment_id': razorpay_payment_id,
        'status': 'pending',
        'available_at': available_at,
        'created_at': datetime.now(timezone.utc),
    }
    try:
        result = await _db.referrals.insert_one(referral_doc)
    except Exception as e:
        # Unique index on referred_email — this is "one credit per
        # referred person ever," not a bug.
        logger.info(f'Referral for {referred_email} already exists, not double-crediting: {e!r}')
        return

    await _db.credit_ledger.insert_one({
        'owner_ghost_member_id': account['ghost_member_id'],
        'entry_type': 'earn',
        'amount_paise': REFERRAL_CREDIT_PAISE,
        'status': 'pending',
        'available_at': available_at,
        'expires_at': None,  # set when it clears, per the 2yr-from-clear rule
        'related_referral_id': str(result.inserted_id),
        'reason': f'Referral: {referred_email}',
        'created_at': datetime.now(timezone.utc),
    })
    logger.info(f'Referral earn recorded: {account["email"]} referred {referred_email}, pending until {available_at.isoformat()}')


@router.get('/api/referrals/me')
async def referrals_me(email: str):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')

    email = email.lower().strip()
    account = await _db.referral_accounts.find_one({'email': email})
    if not account:
        raise HTTPException(status_code=404, detail='No referral account for this email')

    now = datetime.now(timezone.utc)
    cleared_paise = 0
    pending_paise = 0
    async for entry in _db.credit_ledger.find({'owner_ghost_member_id': account['ghost_member_id']}):
        if entry['entry_type'] == 'earn' and entry['status'] == 'cleared':
            cleared_paise += entry['amount_paise']
        elif entry['entry_type'] == 'earn' and entry['status'] == 'pending':
            pending_paise += entry['amount_paise']
        elif entry['entry_type'] in ('consumption', 'reversal', 'expiry'):
            cleared_paise += entry['amount_paise']  # stored negative

    return {
        'referral_code': account['referral_code'],
        'cleared_paise': max(0, cleared_paise),
        'pending_paise': pending_paise,
    }


@router.get('/r/{code}')
async def referral_landing(code: str, request: Request):
    """Sets a first-touch attribution cookie and redirects home. Not yet
    reachable in production — frontend/vercel.json needs a rewrite for
    /r/:code -> this route, same pattern as /s/:token."""
    if _db is None:
        return RedirectResponse(url='/')

    account = await _db.referral_accounts.find_one({'referral_code': code, 'status': 'active'})
    response = RedirectResponse(url='/')
    if not account:
        return response  # invalid/suspended code — no cookie, just redirect

    existing_code = resolve_referral_code(request)
    if existing_code:
        # First-touch: an existing valid cookie wins, don't overwrite it.
        return response

    token = _sign_cookie(code)
    if token:
        response.set_cookie(
            key=REFERRAL_COOKIE_NAME,
            value=token,
            max_age=REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60,
            httponly=True,
            secure=True,
            samesite='lax',
            path='/',
        )
    return response
