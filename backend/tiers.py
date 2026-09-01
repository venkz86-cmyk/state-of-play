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
  * find_ghost_member(), create_ghost_member(), ensure_member_labeled() —
                                     the find-or-create-and-label dance every
                                     payment-success path needs. Was
                                     duplicated near-identically in
                                     razorpay_orders.py and
                                     razorpay_subscriptions.py; consolidated
                                     here so server.py's generic webhook
                                     (which replaces the "Razorpay Payment
                                     Capture" Zap for the two original static
                                     Payment Buttons) doesn't become a third
                                     copy.
  * PLAN_LABELS                   — plan name -> Ghost labels it confers.
                                     Shared by razorpay_orders.py and
                                     server.py's webhook so a plan's labels
                                     are defined once, not per caller.
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

# Every label that confers real paid access. Single source of truth — was
# previously duplicated inline in server.py's verify_ghost_member and
# get_member_details (and would have been a third copy in nudge.py), which
# is exactly how a label gets added in one place and silently missed in
# another. 'tier-trial' is deliberately absent: trial access is a 10-story
# snapshot, not the full archive.
PAID_LABELS = [
    'paid-via-razorpay', 'paid-via-invoice', 'premium-subscriber',
    'paid', 'premium', 'corporate-member', 'tier-student',
]


def is_paid_from_labels(label_names: list[str]) -> bool:
    """label_names must already be lowercased."""
    return (
        any(label in label_names for label in PAID_LABELS)
        or any(name.startswith('team-') for name in label_names)
    )


# plan -> Ghost labels a successful payment for that plan confers.
# 'trial' is deliberately NOT paid-conferring — see PAID_LABELS above.
# Falls back to 'standard' for any payment that carries no plan/tier note at
# all — i.e. the two original static Payment Buttons, which predate the
# plan system and never set one.
PLAN_LABELS = {
    'standard': ['paid-via-razorpay'],
    'student': ['paid-via-razorpay', 'tier-student'],
    'trial': ['tier-trial'],
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


async def find_ghost_member(email: str, token: str) -> Optional[dict]:
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


async def add_member_label(member_id: str, existing_labels: list[str], label: str) -> bool:
    """PATCH `label` onto an existing Ghost member, preserving whatever
    labels they already carry. Returns True on success (including the
    already-has-it no-op case). Generic — used for tier labels here and for
    plan-conferred labels (e.g. paid-via-razorpay) by razorpay_orders.py."""
    if label in existing_labels:
        return True
    token = _create_ghost_admin_token()
    if not token:
        return False
    new_labels = [*existing_labels, label]
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


async def create_ghost_member(email: str, name: str, labels: list[str], token: str) -> Optional[dict]:
    """Create a brand-new Ghost member with the given labels. Mirrors
    nominations.py's _ghost_create_free_member, generalized to accept any
    label set instead of one hardcoded label."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f'{GHOST_URL}/ghost/api/admin/members/?send_email=false',
            json={'members': [{
                'email': email,
                'name': name or '',
                'labels': [{'name': l} for l in labels],
            }]},
            headers={'Authorization': f'Ghost {token}'},
        )
    if r.status_code in (200, 201):
        return r.json()['members'][0]
    logger.warning(f'Ghost member create HTTP {r.status_code}: {r.text[:200]}')
    return None


async def ensure_member_labeled(email: str, name: str, labels: list[str], token: str) -> Optional[dict]:
    """Find-or-create a Ghost member and make sure they carry every label in
    `labels`, adding whatever's missing. The one place every payment-success
    path (Orders, Subscriptions, and server.py's generic webhook) does this,
    so the logic exists exactly once rather than duplicated per caller."""
    member = await find_ghost_member(email, token)
    if member:
        existing_labels = [(lbl.get('name') or '') for lbl in (member.get('labels') or [])]
        for label in labels:
            if label not in existing_labels:
                if await add_member_label(member['id'], existing_labels, label):
                    existing_labels.append(label)
        return member
    return await create_ghost_member(email, name, labels, token)


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

    member = await find_ghost_member(req.email, token)
    if not member:
        raise HTTPException(status_code=404, detail='No matching Ghost member found')

    existing_labels = [(lbl.get('name') or '') for lbl in (member.get('labels') or [])]
    ok = await add_member_label(member['id'], existing_labels, tier_label)
    if not ok:
        raise HTTPException(status_code=502, detail='Ghost label update failed')

    return {'status': 'ok', 'email': member.get('email', req.email), 'tier': req.tier}
