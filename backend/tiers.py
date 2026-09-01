"""
tiers.py — plan/tier infrastructure for TSOP (September roadmap, P0).

Adds a `tier` concept on top of the existing paid/free boolean, driven by two
new Ghost labels: `tier-student`, `tier-trial`. Ghost's own paid/free status
stays canonical for billing; these labels only distinguish WHICH paid plan a
member is on, so product code (curated trial homepage, student renewal
pricing, etc. — later phases) can branch on something more specific than
"is_paid".

Provides:
  * TIER_LABELS, resolve_tier()   — read side: label names -> tier name.
                                     Imported by server.py's verify_ghost_member
                                     and get_member_details.
  * add_member_tier_label()       — write side: PATCH a tier label onto an
                                     EXISTING Ghost member by id. First of its
                                     kind in this codebase — every other
                                     label-write here (nominations.py's
                                     _ghost_create_free_member) only sets a
                                     label while creating a brand-new member.
                                     Ghost's PATCH replaces the whole labels
                                     array, so this reads current labels first
                                     and sends the union.
  * POST /api/tiers/grant         — admin-only (ADMIN_KEY), grants a tier to
                                     a member by email. This is the same
                                     action P2's student-verification
                                     "Approve" button will call once that
                                     moderation UI exists; exposed now so it
                                     can be exercised by hand ahead of it.

Dependencies: GHOST_URL, GHOST_ADMIN_API_KEY, ADMIN_KEY (all existing, no new
env vars).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

# Ghost label -> tier name.
TIER_LABELS = {
    'tier-student': 'student',
    'tier-trial': 'trial',
}

router = APIRouter()


def _create_ghost_admin_token() -> Optional[str]:
    """JWT for Ghost Admin API; identical algorithm to server.py/nominations.py/comments.py."""
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


def resolve_tier(label_names: list[str], is_paid: bool) -> str:
    """Given a member's lowercased label names and their existing paid/free
    boolean, return the tier: 'student' | 'trial' | 'standard' | 'free'.
    A tier label wins over the generic paid signal, since a student or
    trial member's labels also happen to satisfy the generic paid check."""
    for label, tier in TIER_LABELS.items():
        if label in label_names:
            return tier
    return 'standard' if is_paid else 'free'


async def _ghost_find_member(email: str, token: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f'{GHOST_URL}/ghost/api/admin/members/',
            params={'filter': f"email:'{quote(email, safe='')}'", 'include': 'labels'},
            headers={'Authorization': f'Ghost {token}'},
        )
    if r.status_code == 200:
        members = r.json().get('members', [])
        return members[0] if members else None
    logger.warning(f'Ghost member lookup HTTP {r.status_code} for {email}')
    return None


async def add_member_tier_label(member_id: str, existing_labels: list[str], tier_label: str) -> bool:
    """PATCH `tier_label` onto an existing Ghost member, preserving whatever
    labels they already carry. Returns True on success (including the
    already-has-it no-op case)."""
    if tier_label in existing_labels:
        return True
    token = _create_ghost_admin_token()
    if not token:
        return False
    new_labels = [*existing_labels, tier_label]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            return True
        logger.warning(f'Ghost label update HTTP {r.status_code}: {r.text[:200]}')
    except Exception as e:
        logger.warning(f'Ghost label update failed: {e!r}')
    return False


class GrantTierRequest(BaseModel):
    email: EmailStr
    tier: str  # 'student' | 'trial'


@router.post('/api/tiers/grant')
async def grant_tier(req: GrantTierRequest, x_admin_key: str = Header(default='')):
    """Admin-only. Grants a tier label to an existing Ghost member by email."""
    if not ADMIN_KEY or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Forbidden')

    label_by_tier = {v: k for k, v in TIER_LABELS.items()}
    tier_label = label_by_tier.get(req.tier)
    if not tier_label:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tier '{req.tier}'. Expected one of: {list(label_by_tier)}",
        )

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    member = await _ghost_find_member(req.email, token)
    if not member:
        raise HTTPException(status_code=404, detail='No matching Ghost member found')

    existing_labels = [(lbl.get('name') or '') for lbl in (member.get('labels') or [])]
    ok = await add_member_tier_label(member['id'], existing_labels, tier_label)
    if not ok:
        raise HTTPException(status_code=502, detail='Ghost label update failed')

    return {'status': 'ok', 'email': member.get('email', req.email), 'tier': req.tier}
