"""
trial_tracking.py — the 30-day expiry side of Trial ("The Ten"), ₹590.

Nothing in the codebase tracked WHEN a trial started or ended before this
module — tiers.py's `tier-trial` label says someone is on Trial, but not
since when, or which 10 stories they're allowed to read. This module is
that missing piece: a Mongo record per trial signup, snapshotting the 10
most recent premium stories at that moment (a fixed set, not rolling) and
computing the 30-day window around it.

This does NOT send the two reminder emails (5 days before expiry, 7 days
after) — that's a daily sweep + email-drafting job, a separate follow-up
once this exists to sweep over. It also doesn't gate access yet — that's
frontend work (Paywall.js / AuthContext), also a follow-up.

Provides:
  * start_trial(email, ghost_member_id)  — called by razorpay_orders.py's
    verify_payment right after a trial payment is confirmed and the
    member is labeled. Snapshots 10 recent premium slugs, computes
    started_at/expires_at (+30 days), upserts the record.
  * GET /api/trial/status?email=         — what a trial member is
    entitled to and how long they have left. Will back the curated trial
    homepage once that's built.

Dependencies: GHOST_URL, GHOST_CONTENT_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends

from admin_auth import require_admin_key_or_session

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_CONTENT_API_KEY = os.environ.get('GHOST_CONTENT_API_KEY', '')

TRIAL_DAYS = 30
SNAPSHOT_SIZE = 10

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.trial_members.create_index('email', unique=True)
        await _db.trial_members.create_index('expires_at')
    except Exception as e:
        logger.warning(f'trial_members index creation failed (non-fatal): {e!r}')


async def _fetch_recent_premium_slugs(limit: int = SNAPSHOT_SIZE) -> list[str]:
    """The most recently published premium (paid-only) stories, same
    visibility convention the frontend already uses (ghostAPI.js:
    visibility === 'paid' || 'members')."""
    if not GHOST_CONTENT_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/content/posts/',
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'limit': limit,
                    'order': 'published_at desc',
                    'filter': 'status:published+visibility:[paid,members]',
                    'fields': 'slug,published_at',
                },
            )
        if r.status_code == 200:
            return [p['slug'] for p in r.json().get('posts', [])]
        logger.warning(f'Ghost premium-post fetch HTTP {r.status_code}')
    except Exception as e:
        logger.warning(f'Ghost premium-post fetch failed: {e!r}')
    return []


async def start_trial(email: str, ghost_member_id: str = '') -> Optional[dict]:
    """Snapshot the current 10 most recent premium stories and open a
    30-day window from right now. Idempotent on email — re-running (e.g. a
    retried webhook) updates rather than duplicating, but does NOT reset
    an already-running trial's clock; only inserts fresh state if none
    exists yet."""
    if _db is None:
        logger.warning('trial_tracking: no db handle, skipping start_trial')
        return None

    await ensure_indexes()

    email = email.lower().strip()
    existing = await _db.trial_members.find_one({'email': email})
    if existing:
        return existing

    now = datetime.now(timezone.utc)
    record = {
        'email': email,
        'ghost_member_id': ghost_member_id or '',
        'snapshot_slugs': await _fetch_recent_premium_slugs(),
        'started_at': now,
        'expires_at': now + timedelta(days=TRIAL_DAYS),
        'reminder_5day_sent': False,
        'reminder_winback_sent': False,
        'created_at': now,
    }
    await _db.trial_members.insert_one(record)
    logger.info(f'Trial started for {email}: {len(record["snapshot_slugs"])} stories, expires {record["expires_at"].isoformat()}')
    return record


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Motor/MongoDB returns naive datetimes by default (a UTC value with
    no tzinfo) unless the client is created with tz_aware=True -- this
    codebase's isn't. A bare .isoformat() on a naive value silently drops
    the UTC-ness (a frontend `new Date(iso)` then misreads it as local
    time), and comparing it against an aware datetime.now(timezone.utc)
    elsewhere raises TypeError -- confirmed live in admin_dashboard.py's
    /api/admin/subscribers once a real payment's date flowed through an
    equivalent unguarded path. Always coerce to aware before using."""
    if not isinstance(dt, datetime):
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@router.get('/api/trial/status')
async def trial_status(email: str):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    record = await _db.trial_members.find_one({'email': email.lower().strip()})
    if not record:
        raise HTTPException(status_code=404, detail='No trial found for this email')

    now = datetime.now(timezone.utc)
    expires_at = _aware(record['expires_at'])
    started_at = _aware(record.get('started_at'))
    days_left = max(0, (expires_at - now).days)

    return {
        'email': record['email'],
        'slugs': record.get('snapshot_slugs', []),
        'started_at': started_at.isoformat() if started_at else None,
        'expires_at': expires_at.isoformat(),
        'days_left': days_left,
        'expired': now >= expires_at,
    }


@router.get('/api/admin/trials')
async def list_trials(_admin: None = Depends(require_admin_key_or_session)):
    """Every Trial ("The Ten") member, admin-only -- trial_status above
    is a single-email lookup, this is the bulk listing the dashboard
    needs. Same days_left/expired computation as trial_status, just
    looped over every record instead of one."""
    if _db is None:
        return {'trials': []}
    now = datetime.now(timezone.utc)
    trials = []
    async for record in _db.trial_members.find({}).sort('expires_at', 1):
        expires_at = _aware(record.get('expires_at'))
        started_at = _aware(record.get('started_at'))
        trials.append({
            'email': record.get('email'),
            'ghost_member_id': record.get('ghost_member_id') or '',
            'snapshot_slugs': record.get('snapshot_slugs', []),
            'started_at': started_at.isoformat() if started_at else None,
            'expires_at': expires_at.isoformat() if expires_at else None,
            'days_left': max(0, (expires_at - now).days) if expires_at else None,
            'expired': (now >= expires_at) if expires_at else None,
            'reminder_5day_sent': record.get('reminder_5day_sent', False),
            'reminder_winback_sent': record.get('reminder_winback_sent', False),
        })
    return {'trials': trials, 'count': len(trials)}
