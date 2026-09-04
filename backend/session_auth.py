"""
session_auth.py — a real, backend-owned member session, via a typed code.

Second attempt at this (see the plan file for the first one, reverted the
same day it shipped): same underlying problem — the site's only
"who's logged in" check (frontend/src/contexts/AuthContext.js's
verifyMember) trusts a plain email string with no proof of ownership,
fine for UI convenience, not something to authorize money off of (the
gift subscription feature is what surfaced this) — but two things
changed this time:

1. Email delivery goes through resend_email.py (Resend), confirmed
   working end-to-end (real inbox delivery + visible delivery logs) —
   not Apps Script/MailApp, where the first attempt's email silently
   never arrived with no way to diagnose why.
2. A typed 6-digit code instead of a magic link. A link has a real UX
   trap: click it from a different device/browser than the one you
   started on (e.g. open the email on your phone, but you were signing
   in on your laptop) and only the phone ends up signed in. A code
   avoids that entirely — it's typed back into wherever the reader
   actually started, same tab, no redirect dance, no token-in-URL to
   worry about leaking via referrers or link previews.

Flow:
  1. POST /api/auth/request-code {email} — if the email matches a real
     Ghost member, invalidate any previous unused code for that email,
     generate a fresh 6-digit code (10-minute expiry), email it via
     Resend. Always returns the same generic response either way — no
     enumeration signal.
  2. POST /api/auth/verify-code {email, code} — checks the code (right
     email, unexpired, unused, under the attempt limit), re-checks Ghost
     fresh (never trusts anything cached), mints a signed session cookie
     (httponly/secure/samesite=none -- the frontend calls this API
     cross-origin, same as every other endpoint here, so the cookie has
     to survive a cross-site fetch; samesite=lax would silently never be
     sent back), returns the member as JSON (no redirect — the frontend
     navigates itself, since everything happens on one page now).
  3. GET /api/auth/me — reads and verifies the session cookie (proves
     *identity*), then does a live Ghost lookup for current is_paid/tier
     (proves *current entitlement* — deliberately not cached in the
     cookie, since entitlement can change after a session is issued).
  4. POST /api/auth/logout — clears the cookie.

Wrong-code attempts are capped (MAX_ATTEMPTS) so a 6-digit code — far
weaker than a long random token — can't just be brute-forced within its
10-minute window.

get_current_member(request) is exported for other modules (gifts) to get
a cryptographically-proven identity + live entitlement, returning None if
not signed in.

Deliberately NOT wired into AuthContext.js yet — same caution as before:
build and test in isolation first, only swap the live flow over once
Venkat has run it end to end himself. The old verify-member endpoint
stays in place, unused by this module, as a fallback during any
transition.

Dependencies: JWT_SECRET, GHOST_URL, GHOST_ADMIN_API_KEY (all existing),
RESEND_API_KEY (via resend_email.py).
"""
from __future__ import annotations

import os
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, EmailStr

from tiers import find_ghost_member, is_paid_from_labels, resolve_tier
from resend_email import send_email

logger = logging.getLogger(__name__)

GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', '')

SESSION_COOKIE_NAME = 'sop_session'
SESSION_TTL_DAYS = 60
CODE_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


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


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.login_codes.create_index('email_normalized')
        await _db.login_codes.create_index('expires_at')
    except Exception as e:
        logger.warning(f'session_auth index creation failed (non-fatal): {e!r}')


def _generate_code() -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(6))


def _mint_session(email: str, ghost_member_id: str) -> Optional[str]:
    if not JWT_SECRET:
        return None
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        'email': email,
        'ghost_member_id': ghost_member_id,
        'iat': now,
        'exp': now + SESSION_TTL_DAYS * 24 * 60 * 60,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def _read_session(request: Request) -> Optional[dict]:
    """Bearer token (Authorization header) is the primary mechanism -- it
    doesn't depend on any cookie policy at all (SameSite, a browser's
    third-party-cookie rules, or whether a proxying layer between the
    browser and this backend forwards Set-Cookie faithfully), so it
    behaves identically in every browser and every deployment topology.
    The cookie is still read as a fallback so an existing session set
    before this changed keeps working, but nothing in the frontend relies
    on the cookie being sent any more."""
    auth_header = request.headers.get('authorization', '')
    token = ''
    if auth_header.lower().startswith('bearer '):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME, '')
    if not token or not JWT_SECRET:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None


async def get_current_member(request: Request) -> Optional[dict]:
    """The real thing other modules (gifts) should check identity against
    — a cryptographically-proven email plus a live-looked-up entitlement.
    Returns None if there's no valid session."""
    session = _read_session(request)
    if not session:
        return None

    admin_token = _create_ghost_admin_token()
    if not admin_token:
        return None

    member = await find_ghost_member(session['email'], admin_token)
    if not member:
        return None

    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = is_paid_from_labels(label_names) or member.get('status') in ('paid', 'comped')

    return {
        'email': session['email'],
        'ghost_member_id': member.get('id', ''),
        'name': member.get('name', ''),
        'is_paid': is_paid,
        'is_free': not is_paid,
        # Matches server.py's /ghost/verify-member exactly: a member whose
        # sandbox-event comp lapsed and is no longer paid -- lets the
        # paywall show a targeted "your trial has ended" message.
        'trial_expired': 'sandbox-event-comp' in label_names and not is_paid,
        # tier is separate from is_paid -- resolve_tier() distinguishes
        # WHICH paid-adjacent plan a member is on (student/trial/
        # nomination/standard). Trial ("The Ten") members read this as
        # tier == 'trial' despite is_paid being False for them (deliberate
        # -- see tiers.PAID_LABELS's own comment on why tier-trial isn't
        # a paid label). ArticleMockup.js uses this to know when to try
        # the trial-specific content-access check.
        'tier': resolve_tier(label_names, is_paid),
        'status': member.get('status', 'free'),
        'label_names': label_names,
    }


def _code_email_html(code: str) -> str:
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 28px; line-height: 1.15; margin: 0 0 24px;">'
        'Your sign-in <em style="font-style: italic;">code.</em>'
        '</h1>'
        '<p>Enter this code where you started signing in. It expires in 10 minutes.</p>'
        '<p style="margin: 32px 0; font-family: ui-monospace, monospace; font-size: 36px; font-weight: 600; letter-spacing: 0.15em; color: #A0291C;">'
        f'{code}'
        '</p>'
        '<p style="color: #555555;">'
        'If you didn’t request this, you can safely ignore this email — the code simply won’t be used.'
        '</p>'
        '<p style="margin-top: 32px;">'
        'Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">'
        '<p style="font-size: 12px; color: #999999; line-height: 1.7;">'
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001'
        '</p>'
        '</div>'
    )


class RequestCodeBody(BaseModel):
    email: EmailStr


@router.post('/api/auth/request-code')
async def request_code(req: RequestCodeBody):
    if _db is None or not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    email = req.email.lower().strip()
    logger.info(f'request-code: received email repr={email!r} (raw req.email repr={req.email!r})')
    generic_response = {'success': True, 'message': 'If that email has an account, a sign-in code is on its way.'}

    admin_token = _create_ghost_admin_token()
    if not admin_token:
        logger.warning('request-code: could not mint Ghost admin token, skipping send')
        return generic_response

    member = await find_ghost_member(email, admin_token)
    if not member:
        # Same response whether or not the email matched — no enumeration
        # in what the CLIENT sees. Server-side log is fine — it's the only
        # way to tell this apart from a delivery failure when debugging.
        logger.info(f'request-code: no Ghost member found for {email!r}, not sending')
        return generic_response

    logger.info(f'request-code: found Ghost member {member.get("id")!r} for {email!r}, generating code')
    await ensure_indexes()

    # Invalidate any previous unused code for this email so only the
    # freshest one is ever valid — avoids ambiguity if someone requests
    # a code twice.
    await _db.login_codes.update_many(
        {'email_normalized': email, 'used': False},
        {'$set': {'used': True}},
    )

    code = _generate_code()
    now = datetime.now(timezone.utc)
    await _db.login_codes.insert_one({
        'email_normalized': email,
        'code': code,
        'ghost_member_id': member.get('id', ''),
        'created_at': now,
        'expires_at': now + timedelta(minutes=CODE_TTL_MINUTES),
        'attempts': 0,
        'used': False,
    })

    sent = await send_email(
        to=email,
        subject=f'{code} is your State of Play sign-in code',
        html=_code_email_html(code),
    )
    logger.info(f'request-code: send_email for {email!r} returned {sent}')

    return generic_response


class VerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


@router.post('/api/auth/verify-code')
async def verify_code(req: VerifyCodeBody, response: Response):
    if _db is None or not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    await ensure_indexes()

    email = req.email.lower().strip()
    code = req.code.strip()

    record = await _db.login_codes.find_one({
        'email_normalized': email,
        'used': False,
    }, sort=[('created_at', -1)])

    now = datetime.now(timezone.utc)
    expires_at = record.get('expires_at') if record else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not record or not expires_at or now >= expires_at:
        raise HTTPException(status_code=400, detail='That code has expired. Request a new one.')

    if record.get('attempts', 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail='Too many attempts. Request a new code.')

    if record['code'] != code:
        await _db.login_codes.update_one({'_id': record['_id']}, {'$inc': {'attempts': 1}})
        raise HTTPException(status_code=400, detail='Incorrect code.')

    # Mark used immediately, before the Ghost re-check — a code can never
    # be replayed even if something below fails.
    await _db.login_codes.update_one({'_id': record['_id']}, {'$set': {'used': True}})

    admin_token = _create_ghost_admin_token()
    member = await find_ghost_member(email, admin_token) if admin_token else None
    if not member:
        raise HTTPException(status_code=400, detail='Account no longer found')

    session_token = _mint_session(email, member.get('id', ''))
    if not session_token:
        raise HTTPException(status_code=503, detail='Could not create session')

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite='none',
        path='/',
    )

    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = is_paid_from_labels(label_names) or member.get('status') in ('paid', 'comped')

    return {
        'email': email,
        'ghost_member_id': member.get('id', ''),
        'name': member.get('name', ''),
        'is_paid': is_paid,
        'is_free': not is_paid,
        'trial_expired': 'sandbox-event-comp' in label_names and not is_paid,
        'tier': resolve_tier(label_names, is_paid),
        'status': member.get('status', 'free'),
        'label_names': label_names,
        # The frontend stores this and sends it back as
        # `Authorization: Bearer <token>` on every request from here on --
        # see _read_session's docstring for why that's now the mechanism
        # this actually depends on, not the cookie set above.
        'session_token': session_token,
    }


@router.get('/api/auth/me')
async def auth_me(request: Request):
    member = await get_current_member(request)
    if not member:
        raise HTTPException(status_code=401, detail='Not signed in')
    return member


@router.post('/api/auth/logout')
async def logout():
    response = Response(status_code=200, content='{"success": true}', media_type='application/json')
    # Must match set_cookie's attributes exactly -- this Starlette version's
    # delete_cookie defaults to secure=False, samesite='lax' regardless of
    # how the cookie was originally set.
    response.delete_cookie(SESSION_COOKIE_NAME, path='/', secure=True, samesite='none')
    return response
