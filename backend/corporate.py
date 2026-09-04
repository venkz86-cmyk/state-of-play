"""
corporate.py — GET /api/admin/corporate/accounts, Phase 4 of the admin
dashboard build. Corporate/team subscribers live entirely outside this
backend, in a Google Sheet fronted by an Apps Script web app
(corporate-subscriptions/apps-script-backend.js) — the only prior caller
of that script here was server.py's generate_team_gst_invoice, a single-
account token lookup. This module is the first "list every account" view
this backend has ever had.

No Mongo collection of its own: this is a pure Apps-Script proxy with a
short in-process cache (accounts change rarely — a new signup, a seat
count — so hammering the script's execution quota on every dashboard
poll isn't worth it, unlike the genuinely real-time member/payment data
elsewhere in this dashboard).

Dependencies: APPS_SCRIPT_URL (existing, already used by server.py),
ADMIN_KEY (existing, admin_auth.py's shared secret — the Apps Script
side must have a matching ADMIN_KEY Script Property for the new
list_accounts action to authorize the request).
"""
from __future__ import annotations

import os
import time
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends

from admin_auth import require_admin_key_or_session

logger = logging.getLogger(__name__)

router = APIRouter()

APPS_SCRIPT_URL = os.environ.get(
    "APPS_SCRIPT_URL",
    "https://script.google.com/macros/s/AKfycbxuRQHvQZfZFYCxLirt8ry2mbiwYGlVKm7N3oe-Oy4-GuosggZZU1t5AV1Q97HmyIZ6Pg/exec",
)
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

CACHE_TTL_SECONDS = 60

_cache: dict = {'accounts': None, 'fetched_at': 0.0}


async def fetch_accounts(force: bool = False) -> list[dict]:
    """Every corporate account row (minus dashboard_token), served from a
    60s cache unless force=True. Raises HTTPException on a real failure
    rather than returning an empty list silently -- callers (the
    Subscribers join) treat that as non-fatal on their own end, but this
    function itself should be honest about what happened."""
    now = time.time()
    if not force and _cache['accounts'] is not None and (now - _cache['fetched_at']) < CACHE_TTL_SECONDS:
        return _cache['accounts']

    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail='ADMIN_KEY not configured')

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                APPS_SCRIPT_URL,
                json={'action': 'list_accounts', 'admin_key': ADMIN_KEY},
                follow_redirects=True,
            )
    except httpx.HTTPError as e:
        logger.warning(f'corporate.fetch_accounts: Apps Script request failed: {e!r}')
        raise HTTPException(status_code=502, detail='Could not reach corporate accounts service')

    try:
        body = r.json()
    except ValueError:
        logger.warning(f'corporate.fetch_accounts: non-JSON response, status {r.status_code}')
        raise HTTPException(status_code=502, detail='Corporate accounts service returned an invalid response')

    if not body.get('success'):
        error = body.get('error', 'Unknown error')
        logger.warning(f'corporate.fetch_accounts: Apps Script returned failure: {error}')
        raise HTTPException(status_code=502, detail=f'Corporate accounts service error: {error}')

    accounts = (body.get('data') or {}).get('accounts') or []
    _cache['accounts'] = accounts
    _cache['fetched_at'] = now
    return accounts


def init():
    """No DB dependency -- kept for consistency with every other admin
    module's wiring line in server.py rather than a special case."""
    return


@router.get('/api/admin/corporate/accounts')
async def list_corporate_accounts(refresh: bool = False, _admin: None = Depends(require_admin_key_or_session)):
    accounts = await fetch_accounts(force=refresh)
    return {'accounts': accounts, 'count': len(accounts)}
