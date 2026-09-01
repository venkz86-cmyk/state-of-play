"""
nudge.py — quarterly free-to-paid conversion nudge (September/October
roadmap). Keeps a Ghost label in sync so the email itself can be drafted
and sent through Ghost's own newsletter feature, targeted at that label.

Ghost's own "status" field only reflects Ghost-native (Stripe) subscriptions.
Since TSOP bills entirely through Razorpay, every real paid member here
(standard or student) is technically "status: free" inside Ghost — their
actual paid status lives only in labels (see tiers.py's PAID_LABELS). A
plain Ghost segment filter like "status:free" would therefore also catch
paying subscribers when sending a "you should subscribe" email.

This module keeps ONE label, `nudge-eligible`, correct at all times, so the
quarterly email can target a single, always-accurate Ghost segment:
label:nudge-eligible. It does NOT draft or send the email — that's a human
step each cycle (the subscriber-nudge skill drafts it, Venkat reviews and
publishes it in Ghost), on purpose: the ask was fresh copy each time, not
one resent template.

Provides:
  * POST /api/nudge/refresh-eligibility   — admin-only (ADMIN_KEY). Sweeps
    every Ghost member, adds 'nudge-eligible' to anyone whose tier is
    'free' or 'trial', removes it from anyone who has since become
    'standard'/'student'/comped. Safe to re-run any time — each run leaves
    the label in the correct state regardless of what a prior run did.
    Called by the quarterly reminder before drafting, so the segment is
    never stale by the time the email actually goes out.

Dependencies: GHOST_URL, GHOST_ADMIN_API_KEY, ADMIN_KEY (all existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Header

from tiers import resolve_tier, is_paid_from_labels

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

NUDGE_LABEL = 'nudge-eligible'

router = APIRouter()


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


async def _ghost_list_all_members(token: str) -> list[dict]:
    """Every Ghost member with their labels, paginated (mirrors server.py's
    _ghost_seq_for_member listing loop)."""
    members: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=20.0) as client:
        while True:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/admin/members/',
                params={'limit': 100, 'page': page, 'include': 'labels'},
                headers={'Authorization': f'Ghost {token}'},
            )
            if r.status_code != 200:
                logger.warning(f'Ghost member list HTTP {r.status_code} on page {page}')
                break
            payload = r.json()
            members.extend(payload.get('members', []))
            pages = (payload.get('meta', {}).get('pagination') or {}).get('pages') or 1
            if page >= pages:
                break
            page += 1
    return members


async def _set_member_label_state(member_id: str, existing_labels: list[str], label: str, should_have: bool) -> bool:
    """PATCH `label` on or off an existing Ghost member so its presence
    matches `should_have`. No-ops (returns True without a network call) if
    already correct."""
    has_it = label in existing_labels
    if has_it == should_have:
        return True
    token = _create_ghost_admin_token()
    if not token:
        return False
    new_labels = [*existing_labels, label] if should_have else [l for l in existing_labels if l != label]
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


@router.post('/api/nudge/refresh-eligibility')
async def refresh_eligibility(x_admin_key: str = Header(default='')):
    if not ADMIN_KEY or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Forbidden')
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    members = await _ghost_list_all_members(token)

    checked = added = removed = failed = 0
    for member in members:
        raw_labels = [(lbl.get('name') or '') for lbl in (member.get('labels') or [])]
        lowered = [l.lower() for l in raw_labels]
        tier = resolve_tier(lowered, is_paid_from_labels(lowered))
        should_have = tier in ('free', 'trial')

        checked += 1
        currently_has = NUDGE_LABEL in raw_labels
        if currently_has == should_have:
            continue

        ok = await _set_member_label_state(member['id'], raw_labels, NUDGE_LABEL, should_have)
        if not ok:
            failed += 1
        elif should_have:
            added += 1
        else:
            removed += 1

    return {
        'status': 'ok',
        'checked': checked,
        'added': added,
        'removed': removed,
        'failed': failed,
        'segment_filter': f'label:{NUDGE_LABEL}',
    }
