"""
trial_tracking.py — the access side of Trial ("The Ten"), ₹590.

Nothing in the codebase tracked WHEN a trial started or ended before this
module — tiers.py's `tier-trial` label says someone is on Trial, but not
since when, or which 10 stories they're allowed to read. This module is
that missing piece: a Mongo record per trial signup, snapshotting
Venkat's currently admin-curated Ten at that moment (a fixed set, not
rolling -- see _get_curated_ten_slugs and the admin panel's "Edit The
Ten" button) and computing the 30-day window around it.

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
from pydantic import BaseModel, EmailStr

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


THE_TEN_CONFIG_ID = 'the_ten'  # singleton _id, same pattern as payments.py's payments_meta doc


async def _get_curated_ten_slugs() -> list[str]:
    """What a brand-new signup's permanent Ten actually is: Venkat's own
    admin-curated list (trial_config's singleton doc), not an automatic
    pick -- see the admin panel's "Edit The Ten" button. Falls back to
    the old auto-pick (most recent premium stories) if the list hasn't
    been set up yet, or has been emptied out, so start_trial() always
    has something sensible to snapshot rather than an empty Ten."""
    if _db is not None:
        doc = await _db.trial_config.find_one({'_id': THE_TEN_CONFIG_ID})
        if doc and doc.get('slugs'):
            return doc['slugs']
    return await _fetch_recent_premium_slugs()


async def start_trial(email: str, ghost_member_id: str = '', country: str = 'IN') -> Optional[dict]:
    """Snapshot Venkat's currently curated Ten (see _get_curated_ten_slugs)
    and open a 30-day window from right now. Idempotent on email — re-running (e.g. a
    retried webhook) updates rather than duplicating, but does NOT reset
    an already-running trial's clock; only inserts fresh state if none
    exists yet. Sends the day-1 welcome email exactly once, as a side
    effect of the insert actually happening (a retried call that finds an
    existing record returns early above and never re-sends it).

    country ('IN' or 'INTL') is derived by the caller from Razorpay's own
    payment currency, not trusted from the client -- stored so the day-25/
    day-37 upgrade emails can quote the correct, geo-specific
    trial-upgrade price instead of a flat number."""
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
        'country': country if country in ('IN', 'INTL') else 'IN',
        'snapshot_slugs': await _get_curated_ten_slugs(),
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


async def _fetch_slug_visibility(slugs: list[str]) -> dict[str, str]:
    """slug -> Ghost's current visibility ('public', 'members', 'paid'),
    for whichever of the given slugs still exist and are published.
    Used to catch drift: a slug snapshotted into someone's permanent Ten
    while it was paid/members can later be unlocked to public by an
    editorial decision made well after that trial started (aging a
    story out of the paywall is a normal, separate workflow this module
    has no visibility into when it runs) -- the snapshot itself never
    re-checks, so a member's "ten premium stories" can quietly include
    one that's now free for everyone. A missing slug (deleted/renamed)
    is simply absent from the returned dict, same as a fetch failure."""
    if not GHOST_CONTENT_API_KEY or not slugs:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/content/posts/',
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'limit': len(slugs),
                    'filter': f"slug:[{','.join(slugs)}]",
                    'fields': 'slug,visibility,status',
                },
            )
        if r.status_code == 200:
            return {p['slug']: p.get('visibility', '') for p in r.json().get('posts', []) if p.get('status') == 'published'}
        logger.warning(f'Ghost slug-visibility fetch HTTP {r.status_code}')
    except Exception as e:
        logger.warning(f'Ghost slug-visibility fetch failed: {e!r}')
    return {}


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
    f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}/trial" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Subscribe &rarr;</a></p>'
)

# /signup's own checkout has no idea this reader already paid for a
# trial -- it charges the plain new-signup price and never applies
# 'trial-upgrade', which is the only plan that credits the trial fee
# and grants the thirteen-months-for-twelve bonus. /trial's own second
# checkout button is the one place that plan is actually reachable, so
# every upgrade CTA in this file must point there, not at /signup.


def _trial_upgrade_price_text(country: str) -> str:
    """The live trial-upgrade price for this reader's geo, resolved
    through razorpay_orders.py's own pricing config rather than a
    number hardcoded here -- that price is flat and never changes, but
    reading it from the shared config still means this line can't go
    stale if that ever changes again. Imported locally rather than at
    module level: razorpay_orders.py imports start_trial from this
    module, so a module-level import back here would be circular."""
    from razorpay_orders import _resolve_plan_config
    config = _resolve_plan_config('trial-upgrade', country)
    amount = config['amount']
    if config.get('currency') == 'INR':
        return f'₹{amount // 100:,} all in'
    return f'${amount // 100}'


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


def _trial_reminder_email_html(days_left: int, available_count: int = 0, read_count: int = 0, country: str = 'IN') -> str:
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
    price_text = _trial_upgrade_price_text(country)
    return _trial_email_shell(
        headline,
        (
            f'<p>Your trial closes in {days_left} days. Everything new we\'ve published since you joined, on top of your original ten, goes with it.</p>'
            f'{opening}'
            f'<p>Upgrading now is {price_text}, less than signing up fresh, since you\'ve already paid for the trial. And because you\'re upgrading from The Ten, you get thirteen months instead of twelve.</p>'
            + _SUBSCRIBE_CTA
            + '<p style="color: #555555;">If the trial wasn’t for you, that’s fine. Access simply ends, nothing to cancel.</p>'
        ),
    )


def _trial_winback_email_html(country: str = 'IN') -> str:
    """Sent ~day 37 of the 30-day trial (7 days after it closed)."""
    price_text = _trial_upgrade_price_text(country)
    return _trial_email_shell(
        'Still thinking <em style="font-style: italic;">about it?</em>',
        (
            '<p>Your State of Play trial ended a week ago. Your original ten stories are still yours, for keeps. Everything published since closed with the trial.</p>'
            '<p>If any of it was useful, the full subscription gets you a new story every week, plus the twice-weekly Left Field briefing and the entire archive.</p>'
            f'<p>Upgrading now is {price_text}, less than signing up fresh, since you\'ve already paid for the trial. And you get thirteen months instead of twelve, since you\'re upgrading from The Ten.</p>'
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


@router.get('/api/admin/trials/drift-check')
async def trials_drift_check(_admin: None = Depends(require_admin_key_or_session)):
    """Scans every trial member's permanent snapshot_slugs for one that's
    since been unlocked to a free/public visibility in Ghost -- see
    _fetch_slug_visibility's own docstring for why this can happen well
    after a trial starts, with this module having no way to know at the
    time. Read-only: reports what's drifted so Venkat can pick a real
    replacement story himself (an editorial judgment call, not something
    to auto-pick) via the admin panel's per-member story editor
    (GET .../{email}/stories, POST .../add-slug, POST .../remove-slug
    below). Batches one Ghost lookup per unique slug across every
    member, not one call per member."""
    if _db is None:
        return {'affected': [], 'count': 0}

    all_slugs: set[str] = set()
    records = []
    async for record in _db.trial_members.find({}, {'email': 1, 'snapshot_slugs': 1}):
        records.append(record)
        all_slugs.update(record.get('snapshot_slugs') or [])

    visibility = await _fetch_slug_visibility(list(all_slugs))

    affected = []
    for record in records:
        drifted = [
            slug for slug in (record.get('snapshot_slugs') or [])
            if visibility.get(slug) == 'public'
        ]
        if drifted:
            affected.append({'email': record.get('email'), 'drifted_slugs': drifted})
    return {'affected': affected, 'count': len(affected)}


ADMIN_CANDIDATE_STORIES_LIMIT = 30  # plenty of recent premium stories to pick an addition from


async def _fetch_recent_premium_stories(limit: int = ADMIN_CANDIDATE_STORIES_LIMIT) -> list[dict]:
    """Like _fetch_recent_premium_slugs, but for the admin picker below --
    titles too (an admin recognizes a story by its headline, not its
    slug), and a bigger limit than a real signup's fixed-10 snapshot."""
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
                    'fields': 'slug,title,published_at',
                },
            )
        if r.status_code == 200:
            return [
                {'slug': p['slug'], 'title': p.get('title', p['slug']), 'published_at': p.get('published_at')}
                for p in r.json().get('posts', [])
            ]
        logger.warning(f'Ghost recent-premium-stories fetch HTTP {r.status_code}')
    except Exception as e:
        logger.warning(f'Ghost recent-premium-stories fetch failed: {e!r}')
    return []


async def _fetch_titles(slugs: list[str]) -> dict[str, str]:
    """slug -> title, for whichever of the given slugs still resolve in
    Ghost (a removed/renamed slug just won't have an entry -- the admin
    UI falls back to showing the bare slug for those)."""
    if not GHOST_CONTENT_API_KEY or not slugs:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/content/posts/',
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'limit': len(slugs),
                    'filter': f"slug:[{','.join(slugs)}]",
                    'fields': 'slug,title',
                },
            )
        if r.status_code == 200:
            return {p['slug']: p.get('title', p['slug']) for p in r.json().get('posts', [])}
        logger.warning(f'Ghost title fetch HTTP {r.status_code}')
    except Exception as e:
        logger.warning(f'Ghost title fetch failed: {e!r}')
    return {}


@router.get('/api/admin/trials/{email}/stories')
async def trial_stories_detail(email: str, _admin: None = Depends(require_admin_key_or_session)):
    """Backs the admin panel's per-member story editor: this member's
    current permanent Ten with real titles (not just slugs) plus a
    visibility flag so a drifted-to-free story is visibly flagged in the
    UI too, not just in the drift-check sweep -- and a candidates list of
    recent premium stories not already in their snapshot, to add from."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    record = await _db.trial_members.find_one({'email': email.lower().strip()})
    if not record:
        raise HTTPException(status_code=404, detail='No trial found for this email')

    slugs = record.get('snapshot_slugs') or []
    titles = await _fetch_titles(slugs)
    visibility = await _fetch_slug_visibility(slugs)
    current = [
        {'slug': s, 'title': titles.get(s, s), 'visibility': visibility.get(s, 'unknown')}
        for s in slugs
    ]

    candidates = [
        story for story in await _fetch_recent_premium_stories()
        if story['slug'] not in slugs
    ]
    return {'email': record.get('email'), 'current': current, 'candidates': candidates}


async def _validate_addable_slug(slug: str, existing_slugs: list[str]) -> None:
    """The one rule both the per-member and the global add-endpoints
    need: not already in the list, and a real, currently published
    paid/members story -- so neither can be used to add a free one by
    mistake. Raises HTTPException(400) with a message naming which
    check failed; callers just await this and continue on success."""
    if slug in existing_slugs:
        raise HTTPException(status_code=400, detail=f'{slug!r} is already in this Ten')
    visibility = await _fetch_slug_visibility([slug])
    if visibility.get(slug) not in ('paid', 'members'):
        raise HTTPException(
            status_code=400,
            detail=f'{slug!r} is not a currently published paid/members story',
        )


class TrialSlugRequest(BaseModel):
    email: EmailStr
    slug: str


@router.post('/api/admin/trials/add-slug')
async def add_trial_slug(req: TrialSlugRequest, _admin: None = Depends(require_admin_key_or_session)):
    """Adds one story to a member's permanent snapshot_slugs -- e.g. a
    replacement after removing one that drifted to free."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    email = req.email.lower().strip()
    record = await _db.trial_members.find_one({'email': email})
    if not record:
        raise HTTPException(status_code=404, detail='No trial found for this email')

    slugs = record.get('snapshot_slugs') or []
    await _validate_addable_slug(req.slug, slugs)

    updated = slugs + [req.slug]
    await _db.trial_members.update_one({'email': email}, {'$set': {'snapshot_slugs': updated}})
    return {'email': email, 'snapshot_slugs': updated}


@router.post('/api/admin/trials/remove-slug')
async def remove_trial_slug(req: TrialSlugRequest, _admin: None = Depends(require_admin_key_or_session)):
    """Removes one story from a member's permanent snapshot_slugs -- e.g.
    one drift-check flagged as having gone free. Leaves the member with
    fewer than ten until/unless an add-slug call tops it back up; that's
    fine, this is a rare manual correction, not something that needs to
    self-balance."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    email = req.email.lower().strip()
    record = await _db.trial_members.find_one({'email': email})
    if not record:
        raise HTTPException(status_code=404, detail='No trial found for this email')

    slugs = record.get('snapshot_slugs') or []
    if req.slug not in slugs:
        raise HTTPException(status_code=400, detail=f'{req.slug!r} is not in this member’s Ten')

    updated = [s for s in slugs if s != req.slug]
    await _db.trial_members.update_one({'email': email}, {'$set': {'snapshot_slugs': updated}})
    return {'email': email, 'snapshot_slugs': updated}


@router.get('/api/admin/trials/the-ten')
async def the_ten_detail(_admin: None = Depends(require_admin_key_or_session)):
    """The global admin-curated Ten every NEW signup's permanent
    snapshot is copied from (see _get_curated_ten_slugs) -- same shape
    as GET .../{email}/stories, just reading/resolving the trial_config
    singleton instead of one member's snapshot_slugs. Doesn't touch any
    existing member's already-locked-in Ten; this only sets what a
    signup from this point forward gets."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    doc = await _db.trial_config.find_one({'_id': THE_TEN_CONFIG_ID})
    slugs = (doc or {}).get('slugs') or []

    titles = await _fetch_titles(slugs)
    visibility = await _fetch_slug_visibility(slugs)
    current = [
        {'slug': s, 'title': titles.get(s, s), 'visibility': visibility.get(s, 'unknown')}
        for s in slugs
    ]
    candidates = [
        story for story in await _fetch_recent_premium_stories()
        if story['slug'] not in slugs
    ]
    return {'current': current, 'candidates': candidates}


class TheTenSlugRequest(BaseModel):
    slug: str


@router.post('/api/admin/trials/the-ten/add')
async def the_ten_add(req: TheTenSlugRequest, _admin: None = Depends(require_admin_key_or_session)):
    """Adds one story to the curated default list -- affects new
    signups from this point on, never an already-signed-up member's own
    locked-in snapshot_slugs (use .../add-slug for that)."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    doc = await _db.trial_config.find_one({'_id': THE_TEN_CONFIG_ID})
    slugs = (doc or {}).get('slugs') or []
    await _validate_addable_slug(req.slug, slugs)

    updated = slugs + [req.slug]
    await _db.trial_config.update_one(
        {'_id': THE_TEN_CONFIG_ID},
        {'$set': {'slugs': updated, 'updated_at': datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {'slugs': updated}


@router.post('/api/admin/trials/the-ten/remove')
async def the_ten_remove(req: TheTenSlugRequest, _admin: None = Depends(require_admin_key_or_session)):
    """Removes one story from the curated default list -- same "future
    signups only" scope as the-ten/add above."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    doc = await _db.trial_config.find_one({'_id': THE_TEN_CONFIG_ID})
    slugs = (doc or {}).get('slugs') or []
    if req.slug not in slugs:
        raise HTTPException(status_code=400, detail=f'{req.slug!r} is not in the current Ten')

    updated = [s for s in slugs if s != req.slug]
    await _db.trial_config.update_one(
        {'_id': THE_TEN_CONFIG_ID},
        {'$set': {'slugs': updated, 'updated_at': datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {'slugs': updated}


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
                html=_trial_reminder_email_html(days_left, available_count, read_count, record.get('country', 'IN')),
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
                html=_trial_winback_email_html(record.get('country', 'IN')),
            )
        await _db.trial_members.update_one(
            {'_id': record['_id']},
            {'$set': {'reminder_winback_sent': bool(sent)}},
        )
        if sent:
            winbacks_sent += 1

    return {'progress_sent': progress_sent, 'reminders_sent': reminders_sent, 'winbacks_sent': winbacks_sent}
