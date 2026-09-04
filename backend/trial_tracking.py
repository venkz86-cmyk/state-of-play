"""
trial_tracking.py — the access side of Trial ("The Ten"), ₹590.

Nothing in the codebase tracked WHEN a trial started or ended before this
module — tiers.py's `tier-trial` label says someone is on Trial, but not
since when, or which 10 stories they're allowed to read. This module is
that missing piece: a Mongo record per trial signup, snapshotting the 10
most recent premium stories at that moment (a fixed set, not rolling) and
computing the 30-day window around it.

Two access rules (see is_trial_slug_accessible's own docstring for the
full reasoning): the original 10-story snapshot is a PERMANENT keepsake,
readable forever regardless of expiry or conversion. Anything published
during the 30 days on top of that (the "floor not ceiling" growth bonus)
only stays readable while the trial window is open. Enforced server-side
in server.py's /ghost/article-content -- the real content-serving gate,
not just a frontend display decision.

Sends the two reminder emails on the trial's own clock (a 30-day trial:
day 25 is 5 days before expiry, day 37 is 7 days after) via
POST /api/trial/reminder-check, a daily admin-triggered sweep -- same
shape as nominations.py's /api/nominations/access/expire-check, wired to
the Apps Script's own daily time-driven trigger.

Provides:
  * start_trial(email, ghost_member_id)  — called by razorpay_orders.py's
    verify_payment right after a trial payment is confirmed and the
    member is labeled. Snapshots 10 recent premium slugs, computes
    started_at/expires_at (+30 days), upserts the record.
  * GET /api/trial/status?email=         — what a trial member is
    entitled to and how long they have left. Will back the curated trial
    homepage once that's built.
  * POST /api/trial/reminder-check       — admin-only daily sweep. Sends
    the 5-days-left reminder (day 25) and the 7-days-after winback
    (day 37), once each per trial, via Resend -- matches nominations.py's
    email pattern, not Apps Script's MailApp.
  * GET /api/admin/trials                — bulk listing for the admin
    dashboard.

Dependencies: GHOST_URL, GHOST_CONTENT_API_KEY, RESEND_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends

from admin_auth import require_admin_key_or_session
from resend_email import send_email as _send_email

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_CONTENT_API_KEY = os.environ.get('GHOST_CONTENT_API_KEY', '')
PUBLIC_BASE_URL = 'https://www.stateofplay.club'

TRIAL_DAYS = 30
SNAPSHOT_SIZE = 10
REMINDER_DAYS_BEFORE_EXPIRY = 5   # sent ~day 25 of the 30-day trial
WINBACK_DAYS_AFTER_EXPIRY = 7     # sent ~day 37 of the 30-day trial

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


async def is_trial_slug_accessible(email: str, slug: str, published_at: Optional[datetime] = None) -> bool:
    """The single source of truth for "can this Trial member read this
    specific story right now" -- called from server.py's
    /ghost/article-content, the actual content-serving gate (not just a
    frontend display decision).

    Two different access rules, deliberately (Venkat's call, Sept 2026):

    1. The original 10-story snapshot from signup is a PERMANENT keepsake
       -- accessible forever, trial expired or not, converted to a real
       subscriber or not. "The Ten" always means at least ten, for
       keeps, whatever else happens. This is what keeps the offer from
       reading as a rental: pay once, those ten are yours.
    2. Anything published AFTER signup (the "floor not ceiling" growth
       bonus -- stay the full 30 days, get more than ten) only stays
       accessible while the trial window is still open. This is what
       still gives the 30-day deadline real teeth: the bonus stories are
       what a reader actually loses by not converting, not the original
       ten they already own outright.

    Nothing is ever taken away mid-trial by a newer story bumping an
    older one out of the snapshot -- the snapshot is frozen at signup,
    only the growth-bonus check is time-boxed, and it's computed live,
    never written back to the record.

    published_at is the story's own Ghost published_at, passed in by the
    caller (which already has it from fetching the article) rather than
    fetched again here."""
    if _db is None:
        return False
    record = await _db.trial_members.find_one({'email': email.lower().strip()})
    if not record:
        return False

    if slug in (record.get('snapshot_slugs') or []):
        return True

    now = datetime.now(timezone.utc)
    expires_at = _aware(record.get('expires_at'))
    if not expires_at or now >= expires_at:
        return False

    started_at = _aware(record.get('started_at'))
    pub = _aware(published_at)
    return bool(started_at and pub and pub > started_at)


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


def _trial_reminder_email_html(days_left: int) -> str:
    """Sent ~day 25 of the 30-day trial (5 days left). Same visual
    template as nominations.py's welcome/expiry emails -- Gloock headline,
    burgundy CTA, Left Field Ventures footer -- so every transactional
    email on the site reads as one system."""
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        f'<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        f'{days_left} days left on <em style="font-style: italic;">The Ten.</em>'
        '</h1>'
        '<p>Dear reader,</p>'
        f'<p>Your trial closes in {days_left} days. Everything new we\'ve published since you joined, on top of your original ten, goes with it.</p>'
        '<p>Your original ten stories are yours to keep either way, no matter what you decide.</p>'
        '<p>An annual subscription is Rs 2,499 + GST: one properly reported story a week on the business of Indian sport, the twice-weekly Left Field briefing, and the full archive, not just ten stories.</p>'
        f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}/signup" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Subscribe &rarr;</a></p>'
        '<p style="color: #555555;">If the trial wasn’t for you, that’s fine. Access simply ends, nothing to cancel.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">'
        '<p style="font-size: 12px; color: #999999; line-height: 1.7;">'
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001'
        '</p>'
        '</div>'
    )


def _trial_winback_email_html() -> str:
    """Sent ~day 37 of the 30-day trial (7 days after it closed)."""
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        'Still thinking <em style="font-style: italic;">about it?</em>'
        '</h1>'
        '<p>Dear reader,</p>'
        '<p>Your State of Play trial ended a week ago. Your original ten stories are still yours, for keeps. Everything published since closed with the trial.</p>'
        '<p>If any of it was useful, the full subscription gets you a new story every week, plus the twice-weekly Left Field briefing and the entire archive.</p>'
        '<p>Rs 2,499 + GST a year.</p>'
        f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}/signup" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Subscribe &rarr;</a></p>'
        '<p style="color: #555555;">If it wasn’t for you, no hard feelings, and you won’t hear from me again.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">'
        '<p style="font-size: 12px; color: #999999; line-height: 1.7;">'
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001'
        '</p>'
        '</div>'
    )


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


@router.post('/api/trial/reminder-check')
async def trial_reminder_check(_admin: None = Depends(require_admin_key_or_session)):
    """Daily cron sweep (same pattern as nominations.py's
    /api/nominations/access/expire-check): sends the two trial emails,
    each exactly once per trial.

      * 5-days-left reminder -- expires_at within the next
        REMINDER_DAYS_BEFORE_EXPIRY days, trial still active.
      * 7-days-after winback -- expires_at more than
        WINBACK_DAYS_AFTER_EXPIRY days in the past.

    Access itself isn't gated by this sweep (that's separate frontend
    work) -- this only sends email and flips the two *_sent flags so a
    re-run of the sweep never double-sends."""
    if _db is None:
        return {'reminders_sent': 0, 'winbacks_sent': 0}

    now = datetime.now(timezone.utc)
    reminder_cutoff = now + timedelta(days=REMINDER_DAYS_BEFORE_EXPIRY)
    winback_cutoff = now - timedelta(days=WINBACK_DAYS_AFTER_EXPIRY)

    reminders_sent = 0
    cursor = _db.trial_members.find({
        'reminder_5day_sent': False,
        'expires_at': {'$gt': now, '$lte': reminder_cutoff},
    })
    async for record in cursor:
        email = record.get('email')
        expires_at = _aware(record.get('expires_at'))
        days_left = max(0, (expires_at - now).days) if expires_at else REMINDER_DAYS_BEFORE_EXPIRY
        sent = False
        if email:
            sent = await _send_email(
                to=email,
                subject=f'{days_left} days left on your trial',
                html=_trial_reminder_email_html(days_left),
            )
        await _db.trial_members.update_one(
            {'_id': record['_id']},
            {'$set': {'reminder_5day_sent': bool(sent)}},
        )
        if sent:
            reminders_sent += 1

    winbacks_sent = 0
    cursor = _db.trial_members.find({
        'reminder_winback_sent': False,
        'expires_at': {'$lte': winback_cutoff},
    })
    async for record in cursor:
        email = record.get('email')
        sent = False
        if email:
            sent = await _send_email(
                to=email,
                subject='Still thinking about it?',
                html=_trial_winback_email_html(),
            )
        await _db.trial_members.update_one(
            {'_id': record['_id']},
            {'$set': {'reminder_winback_sent': bool(sent)}},
        )
        if sent:
            winbacks_sent += 1

    return {'reminders_sent': reminders_sent, 'winbacks_sent': winbacks_sent}
