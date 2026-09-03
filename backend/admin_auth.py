"""
admin_auth.py — Venkat's own admin session for the internal dashboard.

Same mechanism shape as session_auth.py's reader session (email -> 6-digit
code via Resend -> JWT bearer token, no cookie dependency at all -- that
already proved unreliable across browsers for the reader session, no
reason to repeat it here) but cryptographically SEPARATE: a distinct
secret (ADMIN_JWT_SECRET, never JWT_SECRET) and an explicit
`aud: 'tsop-admin'` claim checked on every verify, so a reader session can
never be mistaken for, or escalated into, an admin session -- even in the
worst-case operator mistake of both secrets being set identically, the
audience mismatch still fails closed.

There's exactly one admin identity (ADMIN_EMAIL), not an entitlement to
check against Ghost -- request-code never looks anything up, it just
compares the submitted email against that one constant.

Also exports `require_admin_key_or_session`, the shared FastAPI dependency
other modules' existing admin endpoints migrate to: accepts EITHER the
existing X-Admin-Key header (so Render Cron Jobs hitting the sweep
endpoints keep working unchanged) OR a valid admin bearer session -- so
the dashboard frontend never has to know ADMIN_KEY exists, and every
existing admin endpoint gets real login-backed access without a second,
duplicated check.

Flow:
  1. POST /api/admin/auth/request-code {email} -- only sends a code if
     the email matches ADMIN_EMAIL. Always returns the same generic
     response either way -- no signal about which email is the real one.
  2. POST /api/admin/auth/verify-code {email, code} -- validates the code,
     mints the admin JWT, returns {admin_session_token, email}. No cookie
     is ever set for this session.
  3. GET /api/admin/auth/me -- validates the bearer token.
  4. POST /api/admin/auth/logout -- stateless 200 (nothing server-side to
     invalidate for a bearer JWT; kept for symmetry with the reader flow
     and as a hook for a future revocation list if that's ever needed).

Dependencies: ADMIN_EMAIL, ADMIN_JWT_SECRET (both new), ADMIN_KEY
(existing, reused), RESEND_API_KEY (via resend_email.py).
"""
from __future__ import annotations

import os
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr

from resend_email import send_email

logger = logging.getLogger(__name__)

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'hello@venkatananth.me').lower().strip()
ADMIN_JWT_SECRET = os.environ.get('ADMIN_JWT_SECRET', '')
# Only read here to guard against reusing the READER session's secret --
# this module never mints or verifies a reader token.
_READER_JWT_SECRET = os.environ.get('JWT_SECRET', '')
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

# Shorter than the reader session's 60 days -- this is higher-stakes data
# (every subscriber's payment history), worth a more frequent re-login.
ADMIN_SESSION_TTL_DAYS = 30
ADMIN_CODE_TTL_MINUTES = 10
ADMIN_MAX_ATTEMPTS = 5
ADMIN_JWT_AUDIENCE = 'tsop-admin'

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


def _secret_is_safe() -> bool:
    """Refuses to mint or verify anything if the admin secret isn't
    genuinely separate from the reader session's -- an explicit equality
    guard, not just a naming convention someone could get wrong once and
    never notice."""
    return bool(ADMIN_JWT_SECRET) and ADMIN_JWT_SECRET != _READER_JWT_SECRET


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.admin_login_codes.create_index('email_normalized')
        await _db.admin_login_codes.create_index('expires_at')
    except Exception as e:
        logger.warning(f'admin_auth index creation failed (non-fatal): {e!r}')


def _generate_code() -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(6))


def _mint_admin_session() -> Optional[str]:
    if not _secret_is_safe():
        logger.error(
            'admin_auth: refusing to mint a session -- ADMIN_JWT_SECRET is '
            'unset or equal to JWT_SECRET (the reader session\'s secret)'
        )
        return None
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        'sub': 'admin',
        'email': ADMIN_EMAIL,
        'aud': ADMIN_JWT_AUDIENCE,
        'iat': now,
        'exp': now + ADMIN_SESSION_TTL_DAYS * 24 * 60 * 60,
    }
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm='HS256')


def _read_admin_session(request: Request) -> Optional[dict]:
    """Bearer-only, deliberately -- unlike the reader session (which kept
    a cookie fallback through its own migration), this subsystem starts
    clean with no cookie path at all."""
    auth_header = request.headers.get('authorization', '')
    if not auth_header.lower().startswith('bearer '):
        return None
    token = auth_header[7:].strip()
    if not token or not _secret_is_safe():
        return None
    try:
        return jwt.decode(
            token, ADMIN_JWT_SECRET, algorithms=['HS256'], audience=ADMIN_JWT_AUDIENCE,
        )
    except Exception:
        return None


async def require_admin_session(request: Request) -> dict:
    """FastAPI dependency: 401s unless a valid admin bearer session is
    present. For admin-only endpoints that should NEVER be reachable via
    the machine-to-machine X-Admin-Key -- use require_admin_key_or_session
    below for anything a cron job might also need to hit."""
    session = _read_admin_session(request)
    if not session:
        raise HTTPException(status_code=401, detail='Admin sign-in required')
    return session


async def require_admin_key_or_session(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
) -> None:
    """The shared gate every existing admin-key-only endpoint migrates to:
    accepts EITHER a valid X-Admin-Key (so Render Cron Jobs hitting the
    existing sweep endpoints keep working unchanged) OR a valid admin
    bearer session (so the dashboard frontend never has to know ADMIN_KEY
    exists at all). Raises 403 if neither is present -- matches the
    status code every existing inline check already used, so this is a
    behavior-preserving swap for callers using the key."""
    if x_admin_key and ADMIN_KEY and x_admin_key == ADMIN_KEY:
        return
    if _read_admin_session(request):
        return
    raise HTTPException(status_code=403, detail='Admin access required')


def _admin_code_email_html(code: str) -> str:
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play · Admin —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 28px; line-height: 1.15; margin: 0 0 24px;">'
        'Dashboard sign-in <em style="font-style: italic;">code.</em>'
        '</h1>'
        '<p>Enter this code where you started signing in. It expires in 10 minutes.</p>'
        '<p style="margin: 32px 0; font-family: ui-monospace, monospace; font-size: 36px; font-weight: 600; letter-spacing: 0.15em; color: #A0291C;">'
        f'{code}'
        '</p>'
        '<p style="color: #555555;">'
        'If you didn’t request this, ignore it — the code simply won’t be used.'
        '</p>'
        '</div>'
    )


class AdminRequestCodeBody(BaseModel):
    email: EmailStr


@router.post('/api/admin/auth/request-code')
async def admin_request_code(req: AdminRequestCodeBody):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')

    generic_response = {
        'success': True,
        'message': 'If that email is the admin account, a sign-in code is on its way.',
    }

    email = req.email.lower().strip()
    if email != ADMIN_EMAIL:
        # Same response either way -- no signal about which email is real.
        logger.info(f'admin request-code: non-admin email attempted ({email!r})')
        return generic_response

    await ensure_indexes()

    # Invalidate any previous unused code so only the freshest is valid.
    await _db.admin_login_codes.update_many(
        {'email_normalized': email, 'used': False},
        {'$set': {'used': True}},
    )

    code = _generate_code()
    now = datetime.now(timezone.utc)
    await _db.admin_login_codes.insert_one({
        'email_normalized': email,
        'code': code,
        'created_at': now,
        'expires_at': now + timedelta(minutes=ADMIN_CODE_TTL_MINUTES),
        'attempts': 0,
        'used': False,
    })

    sent = await send_email(
        to=email,
        subject=f'{code} is your TSOP admin sign-in code',
        html=_admin_code_email_html(code),
    )
    logger.info(f'admin request-code: send_email returned {sent}')
    return generic_response


class AdminVerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


@router.post('/api/admin/auth/verify-code')
async def admin_verify_code(req: AdminVerifyCodeBody):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    await ensure_indexes()

    email = req.email.lower().strip()
    code = req.code.strip()

    if email != ADMIN_EMAIL:
        # Never a distinct error for "wrong email" vs "wrong code" -- no
        # enumeration signal from the verify step either.
        raise HTTPException(status_code=400, detail='Incorrect code.')

    record = await _db.admin_login_codes.find_one({
        'email_normalized': email,
        'used': False,
    }, sort=[('created_at', -1)])

    now = datetime.now(timezone.utc)
    expires_at = record.get('expires_at') if record else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not record or not expires_at or now >= expires_at:
        raise HTTPException(status_code=400, detail='That code has expired. Request a new one.')

    if record.get('attempts', 0) >= ADMIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail='Too many attempts. Request a new code.')

    if record['code'] != code:
        await _db.admin_login_codes.update_one({'_id': record['_id']}, {'$inc': {'attempts': 1}})
        raise HTTPException(status_code=400, detail='Incorrect code.')

    # Mark used immediately, before minting -- a code can never be replayed
    # even if minting fails below.
    await _db.admin_login_codes.update_one({'_id': record['_id']}, {'$set': {'used': True}})

    session_token = _mint_admin_session()
    if not session_token:
        raise HTTPException(status_code=503, detail='Could not create admin session')

    return {'admin_session_token': session_token, 'email': ADMIN_EMAIL}


@router.get('/api/admin/auth/me')
async def admin_auth_me(admin: dict = Depends(require_admin_session)):
    return {'email': admin.get('email', ADMIN_EMAIL), 'authenticated': True}


@router.post('/api/admin/auth/logout')
async def admin_logout():
    return {'success': True}
