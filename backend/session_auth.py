"""
session_auth.py — a real, backend-owned member session.

Why this exists: the site's only "who's logged in" check
(frontend/src/contexts/AuthContext.js's verifyMember) POSTs a plain email
string to /api/ghost/verify-member and trusts whatever comes back, storing
it in localStorage. Nothing proves the caller owns that email — anyone who
knows a paying subscriber's address can get is_paid: true for it. Fine for
UI convenience, not something to authorize money off of (the gift
subscription feature is what surfaced this).

Ghost's own magic-link session isn't usable here either: Ghost is on a
separate ghost.io domain from stateofplay.club, so its session cookie
can't be read by this site's own backend, and properly reverse-proxying
Ghost onto this domain is a bigger infrastructure change than "add a
login system" (see the plan file). So this module owns the whole flow
instead, using the same signed-token pattern already used elsewhere in
this codebase (Ghost admin JWTs, cold-link tokens, the referral cookie).

Flow:
  1. POST /api/auth/request-login {email} — if the email matches a real
     Ghost member, create a single-use 15-minute token and email a link
     via Apps Script (action=send_login_link, same webhook nominations.py
     already uses to reach a reader's inbox). Always returns the same
     generic response either way — no enumeration signal.
  2. GET /api/auth/verify?token=... — checks the token, marks it used,
     re-checks Ghost fresh (never trusts the token record's snapshot),
     mints a signed session cookie (httponly/secure/samesite=lax), and
     redirects to /account.
  3. GET /api/auth/me — reads and verifies the session cookie (proves
     *identity*), then does a live Ghost lookup for current is_paid/tier
     (proves *current entitlement* — deliberately not baked into the
     cookie at mint time, since paid status can change after a session
     is issued).
  4. POST /api/auth/logout — clears the cookie.

get_current_member(request) is exported for other modules (gifts) to get
a cryptographically-proven identity + live entitlement, returning None if
not signed in.

Deliberately NOT wired into AuthContext.js yet — built and tested in
isolation first. The old verify-member endpoint stays in place, unused by
this module, as a fallback during the transition. See the plan file for
the full migration approach.

Dependencies: JWT_SECRET, GHOST_URL, GHOST_ADMIN_API_KEY, APPS_SCRIPT_URL
(all existing), PUBLIC_BASE_URL (new, defaults to the production domain).
"""
from __future__ import annotations

import os
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr

from tiers import find_ghost_member, is_paid_from_labels

logger = logging.getLogger(__name__)

GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', '')
APPS_SCRIPT_URL = os.environ.get('APPS_SCRIPT_URL', '')
PUBLIC_BASE_URL = os.environ.get('PUBLIC_BASE_URL', 'https://www.stateofplay.club').rstrip('/')

SESSION_COOKIE_NAME = 'sop_session'
SESSION_TTL_DAYS = 60
LOGIN_TOKEN_TTL_MINUTES = 15

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
        await _db.login_tokens.create_index('token', unique=True)
        await _db.login_tokens.create_index('expires_at')
    except Exception as e:
        logger.warning(f'session_auth index creation failed (non-fatal): {e!r}')


async def _post_to_apps_script(payload: dict) -> None:
    if not APPS_SCRIPT_URL:
        logger.warning('APPS_SCRIPT_URL not set, cannot send login-link email')
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(APPS_SCRIPT_URL, json=payload)
            if resp.status_code >= 400:
                logger.warning(f'Apps Script send_login_link POST non-2xx: {resp.status_code} {resp.text[:300]!r}')
    except Exception as e:
        logger.warning(f'Apps Script send_login_link POST failed: {e!r}')


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
        'status': member.get('status', 'free'),
        'label_names': label_names,
    }


class RequestLoginBody(BaseModel):
    email: EmailStr


@router.post('/api/auth/request-login')
async def request_login(req: RequestLoginBody):
    if _db is None or not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    email = req.email.lower().strip()
    generic_response = {'success': True, 'message': 'If that email has an account, a sign-in link is on its way.'}

    admin_token = _create_ghost_admin_token()
    if not admin_token:
        return generic_response

    member = await find_ghost_member(email, admin_token)
    if not member:
        # Same response whether or not the email matched — no enumeration.
        return generic_response

    await ensure_indexes()
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await _db.login_tokens.insert_one({
        'token': token,
        'email_normalized': email,
        'ghost_member_id': member.get('id', ''),
        'created_at': now,
        'expires_at': now + timedelta(minutes=LOGIN_TOKEN_TTL_MINUTES),
        'used': False,
    })

    # Goes through the existing /api/* -> Render catch-all Vercel rewrite —
    # no new routing needed. (Not /login/verify: that's not a real page,
    # nothing serves it, and it would 404.)
    login_url = f'{PUBLIC_BASE_URL}/api/auth/verify?token={token}'
    await _post_to_apps_script({
        'action': 'send_login_link',
        'email': email,
        'login_url': login_url,
    })

    return generic_response


@router.get('/api/auth/verify')
async def verify_login(token: str):
    if _db is None or not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    await ensure_indexes()
    record = await _db.login_tokens.find_one({'token': token})

    now = datetime.now(timezone.utc)
    expires_at = record.get('expires_at') if record else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not record or record.get('used') or not expires_at or now >= expires_at:
        raise HTTPException(status_code=400, detail='This sign-in link is invalid or has expired')

    # Mark used immediately — before the Ghost re-check — so a link can
    # never be replayed even if something below fails.
    await _db.login_tokens.update_one({'token': token}, {'$set': {'used': True}})

    admin_token = _create_ghost_admin_token()
    member = await find_ghost_member(record['email_normalized'], admin_token) if admin_token else None
    if not member:
        raise HTTPException(status_code=400, detail='Account no longer found')

    session_token = _mint_session(record['email_normalized'], member.get('id', ''))
    if not session_token:
        raise HTTPException(status_code=503, detail='Could not create session')

    response = RedirectResponse(url=f'{PUBLIC_BASE_URL}/account')
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite='lax',
        path='/',
    )
    return response


@router.get('/api/auth/me')
async def auth_me(request: Request):
    member = await get_current_member(request)
    if not member:
        raise HTTPException(status_code=401, detail='Not signed in')
    return member


@router.post('/api/auth/logout')
async def logout():
    response = Response(status_code=200, content='{"success": true}', media_type='application/json')
    response.delete_cookie(SESSION_COOKIE_NAME, path='/')
    return response
