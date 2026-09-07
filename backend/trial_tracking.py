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

Sends four lifecycle emails across the trial's own clock (a 30-day
trial: day 1 on signup, day 10 and day 25 via the daily sweep, day 37 a
week after expiry) via POST /api/trial/reminder-check -- same shape as
nominations.py's /api/nominations/access/expire-check, wired to the
Apps Script's own daily time-driven trigger. The day-25 email leads with
a real "read X of Y" count when one exists, computed from opened_slugs
(see record_trial_open) and a live count of stories published since
signup -- not a generic day-count reminder, the reader's own behavior.

Provides:
  * start_trial(email, ghost_member_id)  — called by razorpay_orders.py's
    verify_payment right after a trial payment is confirmed and the
    member is labeled. Snapshots 10 recent premium slugs, computes
    started_at/expires_at (+30 days), upserts the record, sends the
    day-1 welcome email.
  * record_trial_open(email, slug)       — called by server.py's
    /ghost/article-content right after is_trial_slug_accessible returns
    True, so the day-25 email can say how many of the available stories
    were actually read.
  * GET /api/trial/status?email=         — what a trial member is
    entitled to and how long they have left: the permanent snapshot
    slugs, any bonus slugs published since signup (while the window is
    still open), which of those they've opened, and the days remaining.
    Backs the "The Ten" reading-list panel on /account.
  * POST /api/trial/reminder-check       — admin-only daily sweep. Sends
    the day-10 progress email, the day-25 reminder, and the day-37
    winback, once each per trial, via Resend -- matches nominations.py's
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
PROGRESS_DAYS_AFTER_START = 10    # sent ~day 10 of the 30-day trial
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
    exists yet. Sends the day-1 welcome email exactly once, as a side
    effect of the insert actually happening (a retried call that finds an
    existing record returns early above and never re-sends it)."""
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
        'opened_slugs': [],
        'started_at': now,
        'expires_at': now + timedelta(days=TRIAL_DAYS),
        'reminder_5day_sent': False,
        'reminder_winback_sent': False,
        'progress_10day_sent': False,
        'created_at': now,
    }
    await _db.trial_members.insert_one(record)
    logger.info(f'Trial started for {email}: {len(record["snapshot_slugs"])} stories, expires {record["expires_at"].isoformat()}')

    sent = await _send_email(
        to=email,
        subject='Your ten stories are live',
        html=_trial_welcome_email_html(),
    )
    if not sent:
        logger.warning(f'Trial welcome email failed to send for {email}')

    return record


async def record_trial_open(email: str, slug: str) -> None:
    """Fire-and-forget: records that a trial member actually opened a
    story they were entitled to (called from server.py's
    /ghost/article-content right after is_trial_slug_accessible returns
    True). This is the only place trial "engagement" is tracked at all —
    nothing before this recorded which of the entitled stories a trial
    member actually read, so the day-25 email had no way to say "you've
    read X of Y" without it. $addToSet so re-opening the same story never
    double-counts. Never raises: a tracking miss should never break the
    read itself."""
    if _db is None or not email or not slug:
        return
    try:
        await _db.trial_members.update_one(
            {'email': email.lower().strip()},
            {'$addToSet': {'opened_slugs': slug}},
        )
    except Exception as e:
        logger.warning(f'record_trial_open failed (non-fatal) for {email!r}/{slug!r}: {e!r}')


async def _count_premium_published_since(started_at: datetime) -> int:
    """How many premium stories have published since a trial started —
    the "floor not ceiling" bonus count, computed live rather than
    tracked incrementally (nothing else in this module updates a running
    counter on new publishes, and this only needs to run twice per
    trial, at day 10 and day 25, not on every request). Returns 0 on any
    failure rather than raising — a missed count degrades an email's
    copy, it should never block the sweep that sends it."""
    if not GHOST_CONTENT_API_KEY:
        return 0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/content/posts/',
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'limit': 1,
                    'filter': f"status:published+visibility:[paid,members]+published_at:>'{started_at.strftime('%Y-%m-%d %H:%M:%S')}'",
                    'fields': 'slug',
                },
            )
        if r.status_code == 200:
            return int(r.json().get('meta', {}).get('pagination', {}).get('total', 0))
        logger.warning(f'Ghost published-since count HTTP {r.status_code}')
    except Exception as e:
        logger.warning(f'Ghost published-since count failed: {e!r}')
    return 0


BONUS_SLUGS_LIMIT = 50  # plenty for a 30-day window; matches this module's other safety caps


async def _fetch_bonus_slugs(started_at: datetime) -> list[str]:
    """The actual slugs of premium stories published since a trial
    started -- same query _count_premium_published_since runs for the
    reminder emails' headline number, but returning the posts themselves
    (for the reading-list page's "unlocked since you joined" section)
    instead of just a count. Returns [] on any failure rather than
    raising -- a missed fetch should degrade to an empty bonus section,
    never break the page around it."""
    if not GHOST_CONTENT_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/content/posts/',
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'limit': BONUS_SLUGS_LIMIT,
                    'order': 'published_at desc',
                    'filter': f"status:published+visibility:[paid,members]+published_at:>'{started_at.strftime('%Y-%m-%d %H:%M:%S')}'",
                    'fields': 'slug',
                },
            )
        if r.status_code == 200:
            return [p['slug'] for p in r.json().get('posts', [])]
        logger.warning(f'Ghost bonus-slugs fetch HTTP {r.status_code}')
    except Exception as e:
        logger.warning(f'Ghost bonus-slugs fetch failed: {e!r}')
    return []


async def _trial_access_counts(record: dict) -> tuple[int, int]:
    """(available_count, read_count) for a trial record right now:
    available_count is the original ten plus however many bonus stories
    have published since started_at (the same "floor not ceiling" count
    the growth model promises, not a guess); read_count is how many
    distinct stories this member has actually opened, capped at
    available_count in case a story counted in opened_slugs later fell
    out of the live bonus window (it can't -- access is never revoked
    mid-trial -- but this stays correct even if that assumption ever
    changes)."""
    snapshot_slugs = record.get('snapshot_slugs') or []
    started_at = _aware(record.get('started_at'))
    bonus_count = await _count_premium_published_since(started_at) if started_at else 0
    available_count = len(snapshot_slugs) + bonus_count
    read_count = min(len(record.get('opened_slugs') or []), available_count)
    return available_count, read_count


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


def _trial_email_shell(headline_html: str, body_html: str) -> str:
    """Shared chrome for every Trial email -- masthead line, Gloock
    headline, Left Field Ventures footer -- factored out once the count
    reached four templates so the visual system can't drift between
    them. body_html is everything between the greeting and the sign-off;
    callers own their own <p> tags."""
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        f'<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        f'{headline_html}'
        '</h1>'
        '<p>Dear reader,</p>'
        f'{body_html}'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">'
        '<p style="font-size: 12px; color: #999999; line-height: 1.7;">'
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001'
        '</p>'
        '</div>'
    )


_SUBSCRIBE_CTA = (
    f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}/signup" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Subscribe &rarr;</a></p>'
)


def _trial_welcome_email_html() -> str:
    """Sent immediately on day 1, from start_trial() itself rather than
    the daily sweep -- there's no "5 days from now" to wait for, the
    moment to welcome someone is the moment their ten stories unlock."""
    return _trial_email_shell(
        'Welcome to <em style="font-style: italic;">The Ten.</em>',
        (
            '<p>Your ten stories are live, starting now. They\'re the ten most recent State of Play originals at the moment you signed up, and they\'re yours to keep, whatever you decide at the end of the month.</p>'
            '<p>Stay the full 30 days and everything we publish in that window is yours too, on top of the original ten. That bonus access closes with the trial. The original ten never do.</p>'
            f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Start reading &rarr;</a></p>'
            '<p style="color: #555555;">Questions any time, just reply to this email.</p>'
        ),
    )


def _trial_progress_email_html(available_count: int, bonus_count: int) -> str:
    """Sent once, ~day 10 of the 30-day trial. Reports the real, computed
    access count (original ten plus whatever's published since signup),
    not a generic reminder -- the whole point is to make the "floor not
    ceiling" growth model tangible partway through, not just at the
    expiry pitch."""
    if bonus_count > 0:
        opening = f'<p>{available_count} stories are unlocked on your account right now: the original ten, plus {bonus_count} more we\'ve published since you joined.</p>'
    else:
        opening = f'<p>{available_count} stories are unlocked on your account right now, still just the original ten. New stories publish most weeks, so check back before the month is out.</p>'
    return _trial_email_shell(
        'Ten days in.',
        (
            f'{opening}'
            '<p>Stay through day 30 and that number keeps growing. Whatever publishes between now and then is yours too, on top of what you already have.</p>'
            '<p>If it\'s working for you, the annual subscription keeps it going all year: a new story every week, the twice-weekly Left Field briefing, and the full archive.</p>'
            + _SUBSCRIBE_CTA
        ),
    )


def _trial_reminder_email_html(days_left: int, available_count: int = 0, read_count: int = 0) -> str:
    """Sent ~day 25 of the 30-day trial (5 days left). Leads with actual
    read/available counts when they're known (read_count > 0) -- "12 of
    14" is a sharper conversion pitch than a generic day-count, because
    it's the reader's own behavior, not a marketing line. Falls back to
    the original day-count framing when nothing's been read yet (an
    accusatory "0 of 10" would read worse than no count at all) or the
    counts couldn't be computed (Ghost unreachable at sweep time)."""
    if read_count > 0 and available_count > 0:
        headline = f'{read_count} of {available_count}. <em style="font-style: italic;">That\'s where you\'re at.</em>'
        opening = f'<p>You\'ve read {read_count} of the {available_count} stories your trial has unlocked so far. Your original ten are yours either way, no matter what you decide.</p>'
    else:
        headline = f'{days_left} days left on <em style="font-style: italic;">The Ten.</em>'
        opening = '<p>Your original ten stories are yours to keep either way, no matter what you decide.</p>'
    return _trial_email_shell(
        headline,
        (
            f'<p>Your trial closes in {days_left} days. Everything new we\'ve published since you joined, on top of your original ten, goes with it.</p>'
            f'{opening}'
            '<p>An annual subscription is Rs 2,499 + GST: one properly reported story a week on the business of Indian sport, the twice-weekly Left Field briefing, and the full archive, not just a month of it.</p>'
            + _SUBSCRIBE_CTA
            + '<p style="color: #555555;">If the trial wasn’t for you, that’s fine. Access simply ends, nothing to cancel.</p>'
        ),
    )


def _trial_winback_email_html() -> str:
    """Sent ~day 37 of the 30-day trial (7 days after it closed)."""
    return _trial_email_shell(
        'Still thinking <em style="font-style: italic;">about it?</em>',
        (
            '<p>Your State of Play trial ended a week ago. Your original ten stories are still yours, for keeps. Everything published since closed with the trial.</p>'
            '<p>If any of it was useful, the full subscription gets you a new story every week, plus the twice-weekly Left Field briefing and the entire archive.</p>'
            '<p>Rs 2,499 + GST a year.</p>'
            + _SUBSCRIBE_CTA
            + '<p style="color: #555555;">If it wasn’t for you, no hard feelings, and you won’t hear from me again.</p>'
        ),
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
    expired = now >= expires_at

    # No point paying for the Ghost round trip once the window that would
    # make bonus stories visible has already closed.
    bonus_slugs = await _fetch_bonus_slugs(started_at) if (started_at and not expired) else []

    return {
        'email': record['email'],
        'slugs': record.get('snapshot_slugs', []),
        'bonus_slugs': bonus_slugs,
        'opened_slugs': record.get('opened_slugs', []),
        'started_at': started_at.isoformat() if started_at else None,
        'expires_at': expires_at.isoformat(),
        'days_left': days_left,
        'expired': expired,
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
            'opened_count': len(record.get('opened_slugs') or []),
            'progress_10day_sent': record.get('progress_10day_sent', False),
            'reminder_5day_sent': record.get('reminder_5day_sent', False),
            'reminder_winback_sent': record.get('reminder_winback_sent', False),
        })
    return {'trials': trials, 'count': len(trials)}


@router.post('/api/trial/reminder-check')
async def trial_reminder_check(_admin: None = Depends(require_admin_key_or_session)):
    """Daily cron sweep (same pattern as nominations.py's
    /api/nominations/access/expire-check): sends three of the trial's
    four lifecycle emails, each exactly once per trial (the fourth, the
    day-1 welcome, fires immediately from start_trial() -- there's
    nothing to sweep for on day 1).

      * 10-days-in progress -- started_at at least PROGRESS_DAYS_AFTER_START
        days ago, trial still active.
      * 5-days-left reminder -- expires_at within the next
        REMINDER_DAYS_BEFORE_EXPIRY days, trial still active.
      * 7-days-after winback -- expires_at more than
        WINBACK_DAYS_AFTER_EXPIRY days in the past.

    Access itself isn't gated by this sweep (that's separate frontend
    work) -- this only sends email and flips the *_sent flags so a
    re-run of the sweep never double-sends."""
    if _db is None:
        return {'progress_sent': 0, 'reminders_sent': 0, 'winbacks_sent': 0}

    now = datetime.now(timezone.utc)
    progress_cutoff = now - timedelta(days=PROGRESS_DAYS_AFTER_START)
    reminder_cutoff = now + timedelta(days=REMINDER_DAYS_BEFORE_EXPIRY)
    winback_cutoff = now - timedelta(days=WINBACK_DAYS_AFTER_EXPIRY)

    progress_sent = 0
    cursor = _db.trial_members.find({
        'progress_10day_sent': False,
        'started_at': {'$lte': progress_cutoff},
        'expires_at': {'$gt': now},
    })
    async for record in cursor:
        email = record.get('email')
        sent = False
        if email:
            available_count, _read_count = await _trial_access_counts(record)
            bonus_count = max(0, available_count - len(record.get('snapshot_slugs') or []))
            sent = await _send_email(
                to=email,
                subject='What you’ve got so far',
                html=_trial_progress_email_html(available_count, bonus_count),
            )
        await _db.trial_members.update_one(
            {'_id': record['_id']},
            {'$set': {'progress_10day_sent': bool(sent)}},
        )
        if sent:
            progress_sent += 1

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
            available_count, read_count = await _trial_access_counts(record)
            subject = (
                f'You’ve read {read_count} of {available_count} stories'
                if read_count > 0 and available_count > 0
                else f'{days_left} days left on your trial'
            )
            sent = await _send_email(
                to=email,
                subject=subject,
                html=_trial_reminder_email_html(days_left, available_count, read_count),
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

    return {'progress_sent': progress_sent, 'reminders_sent': reminders_sent, 'winbacks_sent': winbacks_sent}
