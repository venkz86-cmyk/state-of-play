"""
admin_dashboard.py — GET /api/admin/subscribers, the "who's subscribed,
what did they pay, what's expiring" view that started this whole build.
Composes data from four places, live on every request (nothing cached,
nothing precomputed and gone stale):

  * Ghost members + labels        (tiers.list_all_ghost_members)
  * Payment history               (payments.get_subscriber_payment_summaries)
  * Trial ("The Ten") windows     (trial_members collection)
  * Nomination access windows     (nomination_access collection)

"Expiry" is deliberately never a stored field -- it's computed per member
at read time from whichever of the above actually applies (see
_compute_expiry's docstring). Corporate accounts (Phase 4) are joined in
too, via corporate.fetch_accounts() -- a corp-* labeled member's expiry
resolves to their company's real renewal_date from the Corporate
Subscriptions Sheet.

The single most useful thing this view can show that nothing else can:
a member who is_paid (carries a paid label) but whose computed_expiry has
already passed -- the label and the money have drifted apart. Neither
Ghost's own admin nor Razorpay's own dashboard can see that, because
neither system knows about the other's side of the business.

Dataset-size assumption, stated once: hundreds of subscribers, not
hundreds of thousands -- this returns everything in one response (capped,
with a logged warning past MAX_ROWS) for a single-admin internal tool's
frontend to search/sort/paginate client-side. Not built for scale beyond
that on purpose.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from admin_auth import require_admin_key_or_session
from tiers import list_all_ghost_members, resolve_tier, is_paid_from_labels, delete_ghost_member
from payments import get_subscriber_payment_summaries, compute_synthetic_expiry
from corporate import fetch_accounts as fetch_corporate_accounts

logger = logging.getLogger(__name__)

router = APIRouter()

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

MAX_ROWS = 5000
FREE_TO_PAID_MIN_GAP_HOURS = 24  # see _is_free_to_paid_conversion

_db = None
_razorpay_client = None


def init(db_handle, razorpay_client=None):
    global _db, _razorpay_client
    _db = db_handle
    _razorpay_client = razorpay_client


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


async def _load_trial_and_nomination_maps() -> tuple[dict, dict]:
    """{email: expires_at datetime} for each, read once per request rather
    than once per member -- two collection scans instead of N lookups."""
    trial_map: dict = {}
    nomination_map: dict = {}
    if _db is None:
        return trial_map, nomination_map
    try:
        async for doc in _db.trial_members.find({}):
            email = doc.get('email')
            if email:
                trial_map[email] = doc.get('expires_at')
    except Exception as e:
        logger.warning(f'trial_members scan failed (non-fatal): {e!r}')
    try:
        async for doc in _db.nomination_access.find({'status': 'active'}):
            email = doc.get('nominee_email')
            if email:
                nomination_map[email] = doc.get('expires_at')
    except Exception as e:
        logger.warning(f'nomination_access scan failed (non-fatal): {e!r}')
    return trial_map, nomination_map


async def _load_corporate_maps() -> tuple[dict, dict]:
    """{account_id: renewal_date} and {account_id: company_name}, loaded
    once per request. Apps Script being unreachable is non-fatal here --
    the Subscribers list still renders, corp members just keep the
    unresolved ('corporate', None) fallback _compute_expiry already had
    before this phase, exactly as documented on that function."""
    renewal_map: dict = {}
    name_map: dict = {}
    try:
        accounts = await fetch_corporate_accounts()
        for acct in accounts:
            account_id = acct.get('account_id')
            if not account_id:
                continue
            renewal_map[account_id] = acct.get('renewal_date')
            name_map[account_id] = acct.get('company_name')
    except Exception as e:
        logger.warning(f'corporate accounts fetch failed (non-fatal): {e!r}')
    return renewal_map, name_map


def _ghost_subscription_end(subscriptions: Optional[list]) -> Optional[datetime]:
    """A Ghost-native complimentary subscription (granted by hand in Ghost
    Admin, e.g. the pre-existing 'sandbox-event-comp' label some members
    carry -- a narrow comp mechanism that predates and is unrelated to
    this session's own Trial ("The Ten") product) carries its own real
    end date here. Distinct from is_paid's own status/label check --
    this is only about finding a genuine expiry to show, when one exists."""
    if not subscriptions:
        return None
    sub = subscriptions[0]
    end = sub.get('current_period_end')
    if not end:
        return None
    try:
        dt = datetime.fromisoformat(str(end).replace('Z', '+00:00'))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except ValueError:
        return None


def _is_free_to_paid_conversion(signup_date, first_payment: Optional[dict]) -> bool:
    """True only when the Ghost account demonstrably existed as a free
    member before the first real payment, not merely "has ever paid".
    A payment's own find-or-create step (tiers.ensure_member_labeled)
    creates a brand-new Ghost member at the moment someone pays if they
    didn't already have one -- so a member whose signup and first-payment
    timestamps land in the same instant was never actually a free reader
    first, they paid on day one. Requiring the gap to exceed
    FREE_TO_PAID_MIN_GAP_HOURS filters that same-instant creation out
    without needing a dedicated flag anywhere upstream. This is the
    "sign up date vs. complimentary date" split Venkat asked for, where
    complimentary date = the date of the first real payment."""
    if not signup_date or not first_payment or not first_payment.get('razorpay_created_at'):
        return False
    try:
        signup_dt = (
            datetime.fromisoformat(str(signup_date).replace('Z', '+00:00'))
            if not isinstance(signup_date, datetime) else signup_date
        )
        if signup_dt.tzinfo is None:
            signup_dt = signup_dt.replace(tzinfo=timezone.utc)
        paid_dt = datetime.fromisoformat(first_payment['razorpay_created_at'])
        if paid_dt.tzinfo is None:
            paid_dt = paid_dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return False
    return paid_dt - signup_dt > timedelta(hours=FREE_TO_PAID_MIN_GAP_HOURS)


def _corp_account_id(label_names: list[str]) -> Optional[str]:
    for l in label_names:
        if l.startswith('corp-'):
            return l[len('corp-'):]
    return None


def _compute_expiry(
    label_names: list[str], last_payment: Optional[dict],
    trial_expires: Optional[datetime], nomination_expires: Optional[datetime],
    ghost_subscription_expires: Optional[datetime] = None,
    corp_renewal: Optional[str] = None,
) -> tuple[Optional[str], str]:
    """Returns (computed_expiry_iso, source). Priority: a corp-* label
    resolved against the Corporate Subscriptions Sheet's own renewal_date
    (Phase 4 -- if the label exists but doesn't resolve, e.g. the Apps
    Script is unreachable or the label is orphaned, this falls back to
    unresolved rather than guessing), then a genuine Ghost-native
    subscription/comp end date (real data, outranks every synthetic guess
    below), then a Trial window, then a nomination-access window, then a
    real payment's synthetic 12-month cycle, then nothing (free)."""
    if any(l.startswith('corp-') for l in label_names):
        return corp_renewal, 'corporate'
    if ghost_subscription_expires:
        return ghost_subscription_expires.isoformat(), 'ghost_subscription'
    if 'tier-trial' in label_names and trial_expires:
        exp = trial_expires
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp.isoformat(), 'trial'
    if 'nomination-access' in label_names and nomination_expires:
        exp = nomination_expires
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp.isoformat(), 'nomination'
    payment_expiry = compute_synthetic_expiry(last_payment)
    if payment_expiry:
        return payment_expiry, 'payment_estimate'
    return None, 'none'


async def _build_subscriber_rows() -> list[dict]:
    """The full per-subscriber row set -- shared by GET /api/admin/subscribers
    (Phase 2) and GET /api/admin/overview (Phase 6), so the overview's
    counts are always derived from the exact same logic the Subscribers
    table shows, not a second, potentially-drifting computation."""
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    members = await list_all_ghost_members(token)
    if len(members) > MAX_ROWS:
        logger.warning(f'admin/subscribers: {len(members)} Ghost members exceeds MAX_ROWS={MAX_ROWS}, truncating')
        members = members[:MAX_ROWS]

    payment_summaries = await get_subscriber_payment_summaries()
    trial_map, nomination_map = await _load_trial_and_nomination_maps()
    corp_renewal_map, corp_name_map = await _load_corporate_maps()
    grant_map = {}
    if _db is not None:
        try:
            async for g in _db.complimentary_grants.find({}):
                grant_map[g['email']] = g
        except Exception as e:
            logger.warning(f'complimentary grants load failed (non-fatal): {e!r}')

    rows = []
    for member in members:
        email = (member.get('email') or '').lower().strip()
        if not email:
            continue
        label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
        paid = is_paid_from_labels(label_names) or member.get('status') in ('paid', 'comped')
        tier = resolve_tier(label_names, paid)
        # Display-only override, scoped to this endpoint alone -- NOT
        # added to tiers.TIER_LABELS, which nudge.py's own nudge-eligible
        # sweep also reads (that's real access/business logic this
        # dashboard fix has no business changing). A member who falls
        # through to the generic 'standard' bucket but carries the
        # pre-existing sandbox-event-comp label is a comp, not a real
        # annual subscriber -- shown as such here only.
        if tier == 'standard' and 'sandbox-event-comp' in label_names:
            tier = 'comped'
        summary = payment_summaries.get(email)
        last_payment = summary.get('last_payment') if summary else None
        first_payment = summary.get('first_payment') if summary else None
        converted_from_free = _is_free_to_paid_conversion(member.get('created_at'), first_payment)
        ghost_subscription_expires = _ghost_subscription_end(member.get('subscriptions'))
        # A Razorpay member comped in Ghost by hand (to keep Ghost's lists
        # right) has a $0 comp with its own date; their real year comes
        # from the Razorpay payment, same as on their account page.
        if (member.get('status') == 'comped' and last_payment
                and not last_payment.get('subscription_id') and last_payment.get('plan') != 'trial'):
            ghost_subscription_expires = None
        corp_account_id = _corp_account_id(label_names)
        company_name = corp_name_map.get(corp_account_id) if corp_account_id else None

        computed_expiry, expiry_source = _compute_expiry(
            label_names, last_payment, trial_map.get(email), nomination_map.get(email),
            ghost_subscription_expires,
            corp_renewal_map.get(corp_account_id) if corp_account_id else None,
        )

        # A complimentary year (complimentary.py): its own end date.
        grant = grant_map.get(email)
        if grant and 'complimentary' in label_names and 'paid-via-razorpay' not in label_names:
            tier = 'complimentary'
            grant_end = _utc(grant.get('ends_at'))
            if grant_end:
                computed_expiry, expiry_source = grant_end.isoformat(), 'complimentary'

        expired_but_still_paid = False
        if paid and computed_expiry:
            try:
                exp_dt = datetime.fromisoformat(computed_expiry)
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                expired_but_still_paid = exp_dt < datetime.now(timezone.utc)
            except (ValueError, TypeError):
                pass

        # Ghost's own native "Complimentary" subscription silently expires
        # on its own clock (observed: ~3 months), unrelated to and
        # invisible from our label system. A real Razorpay-paying member
        # who was also given a native comp grant (by hand in Ghost Admin,
        # or by the still-parallel Zap) can drop to Ghost's own
        # status='free' the moment that native grant lapses -- while still
        # correctly carrying paid-via-razorpay, so OUR OWN paywall
        # (label-based, never checks Ghost's native status) keeps working
        # for them. The real damage is anything that runs off Ghost's own
        # native status instead of our labels -- most plausibly Ghost's
        # own newsletter delivery, which is not something this codebase
        # controls or can verify from here. restore_to_date is what their
        # real cycle should read (their own last real payment + 365 days,
        # not "when a comp grant happened to lapse") -- surfaced so this
        # can be fixed by hand in Ghost Admin, or later automated once the
        # exact Admin API call for re-granting a dated comp subscription
        # is confirmed against a real record instead of guessed at.
        ghost_status_downgraded = 'paid-via-razorpay' in label_names and (member.get('status') or 'free') == 'free'
        restore_to_date = compute_synthetic_expiry(last_payment) if ghost_status_downgraded else None

        rows.append({
            'email': email,
            'name': member.get('name') or '',
            'ghost_status': member.get('status') or 'free',
            'is_paid': paid,
            'tier': tier,
            'label_names': label_names,
            'created_at': member.get('created_at'),
            'last_payment': last_payment,
            'first_payment': first_payment,
            'ghost_status_downgraded': ghost_status_downgraded,
            'restore_to_date': restore_to_date,
            'converted_from_free': converted_from_free,
            'total_paid': summary.get('total_paid') if summary else {'INR': 0, 'USD': 0},
            'payment_count': summary.get('payment_count') if summary else 0,
            'computed_expiry': computed_expiry,
            'expiry_source': expiry_source,
            'expired_but_still_paid': expired_but_still_paid,
            'company_name': company_name,
        })

    return rows


@router.get('/api/admin/subscribers')
async def list_subscribers(_admin: None = Depends(require_admin_key_or_session)):
    rows = await _build_subscriber_rows()
    return {'subscribers': rows, 'count': len(rows)}


def _within_days(computed_expiry: Optional[str], days: int, now: datetime) -> bool:
    """True if computed_expiry is a real future date within `days` from
    now -- already-expired dates don't count as 'expiring soon', they're
    expired_but_still_paid's job."""
    if not computed_expiry:
        return False
    try:
        exp_dt = datetime.fromisoformat(computed_expiry)
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return False
    return now <= exp_dt <= now + timedelta(days=days)


# ─── Today: what the overview adds for the Today page ───────────────────────
IST = timezone(timedelta(hours=5, minutes=30))
ANNUAL_PLANS = ('standard', 'renewal', 'trial-upgrade', 'unknown')
# Matches the renewal sweep (annual_renewal.GRACE_PERIOD_DAYS).
GRACE_DAYS = 30
# The nightly renewal run is at 4:10am IST; more than this since the last
# one means it didn't happen.
RENEWAL_RUN_OVERDUE_HOURS = 26


def _utc(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _renewals_this_month(now: datetime) -> dict:
    """This calendar month (IST) from the payments ledger: every annual
    year that ends this month, and what happened to it. A later payment by
    the same email counts as renewed; otherwise it's still to come, in its
    grace period, or lapsed. Collected is this month's renewal payments."""
    local = now.astimezone(IST)
    start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start + timedelta(days=32)).replace(day=1)
    out = {'month': start.strftime('%B'), 'due': 0, 'renewed': 0, 'upcoming': 0,
           'in_grace': 0, 'lapsed': 0, 'collected': {'INR': 0, 'USD': 0}}
    if _db is None:
        return out
    by_email: dict = {}
    async for doc in _db.payments.find({'plan': {'$in': list(ANNUAL_PLANS)}}):
        email = (doc.get('email') or '').lower().strip()
        if email:
            by_email.setdefault(email, []).append(doc)
    for docs in by_email.values():
        docs.sort(key=lambda d: _utc(d.get('razorpay_created_at')) or now)
        for i, doc in enumerate(docs):
            paid_at = _utc(doc.get('razorpay_created_at'))
            if doc.get('plan') == 'renewal' and paid_at and start <= paid_at < end:
                currency = doc.get('currency')
                if currency in out['collected']:
                    out['collected'][currency] += doc.get('amount') or 0
            if doc.get('subscription_id'):
                continue
            year_ends = _utc(compute_synthetic_expiry({
                'plan': doc.get('plan'), 'razorpay_created_at': doc.get('razorpay_created_at'),
                'access_from': doc.get('access_from'),
            }))
            if not year_ends or not (start <= year_ends < end):
                continue
            out['due'] += 1
            if i < len(docs) - 1:
                out['renewed'] += 1
            elif year_ends > now:
                out['upcoming'] += 1
            elif now - year_ends <= timedelta(days=GRACE_DAYS):
                out['in_grace'] += 1
            else:
                out['lapsed'] += 1
    return out


async def _last_renewal_run(now: datetime) -> dict:
    run = None
    if _db is not None:
        try:
            async for doc in _db.renewal_runs.find({}).sort('ran_at', -1).limit(1):
                run = doc
        except Exception as e:
            logger.warning(f'overview renewal run lookup failed (non-fatal): {e!r}')
    if not run:
        return {'ran_at': None, 'overdue': True}
    ran_at = _utc(run.get('ran_at'))
    return {
        'ran_at': ran_at.isoformat() if ran_at else None,
        'overdue': not ran_at or now - ran_at > timedelta(hours=RENEWAL_RUN_OVERDUE_HOURS),
        'reminded': run.get('reminded', 0), 'grace_started': run.get('grace_started', 0),
        'downgraded': run.get('downgraded', 0), 'checked': run.get('checked', 0),
    }


def _comps_to_remove(rows: list, now: datetime) -> list:
    """Former annual members past their grace period who are still comped in
    Ghost, so they keep reading until the comp comes off by hand."""
    out = []
    for r in rows:
        last = r.get('last_payment')
        if r.get('ghost_status') != 'comped' or is_paid_from_labels(r.get('label_names') or []):
            continue
        if not last or last.get('subscription_id') or last.get('plan') in ('trial', 'student'):
            continue
        year_ends = _utc(compute_synthetic_expiry(last))
        if year_ends and now - year_ends > timedelta(days=GRACE_DAYS):
            out.append({'email': r['email'], 'name': r['name'], 'year_ended': year_ends.isoformat()})
    return sorted(out, key=lambda x: x['year_ended'])


def _unmatched_payments(rows: list, summaries: dict) -> list:
    """Payments whose email has no Ghost account: usually someone who paid
    with a different email than the one they read with (Tools → Link a
    payment email). Gifts and team plans are bought for other people, so
    they're left out."""
    ghost_emails = {r['email'] for r in rows}
    out = []
    for email, summary in summaries.items():
        last = summary.get('last_payment') or {}
        plan = last.get('plan') or ''
        if email in ghost_emails or plan == 'gift' or plan.startswith('team'):
            continue
        out.append({'email': email, 'plan': plan, 'amount': last.get('amount'),
                    'currency': last.get('currency'), 'paid_at': last.get('razorpay_created_at')})
    return sorted(out, key=lambda x: x['paid_at'] or '', reverse=True)


async def _recent_email_failures(now: datetime) -> list:
    out = []
    if _db is None:
        return out
    try:
        async for doc in _db.email_failures.find(
            {'dismissed': False, 'at': {'$gte': now - timedelta(days=14)}}
        ).sort('at', -1).limit(50):
            at = _utc(doc.get('at'))
            out.append({'id': str(doc.get('_id')), 'to': doc.get('to'), 'subject': doc.get('subject'),
                        'reason': doc.get('reason'), 'at': at.isoformat() if at else None})
    except Exception as e:
        logger.warning(f'overview email failures lookup failed (non-fatal): {e!r}')
    return out


@router.post('/api/admin/email-failures/dismiss')
async def dismiss_email_failures(_admin: None = Depends(require_admin_key_or_session)):
    """Clears the failed-email list on Today once Venkat has dealt with it."""
    if _db is None:
        return {'dismissed': 0}
    result = await _db.email_failures.update_many({'dismissed': False}, {'$set': {'dismissed': True}})
    return {'dismissed': getattr(result, 'modified_count', 0)}


@router.get('/api/admin/overview')
async def admin_overview(_admin: None = Depends(require_admin_key_or_session)):
    """Cheap aggregate counts over data every earlier phase already built
    -- no new collection, no new source of truth. The one thing this
    dashboard was built to finally answer in one place: who's subscribed,
    what did they pay, what's expiring, what needs attention today."""
    now = datetime.now(timezone.utc)
    rows = await _build_subscriber_rows()
    payment_summaries = await get_subscriber_payment_summaries()

    paid_rows = [r for r in rows if r['is_paid']]
    converted_from_free_rows = [r for r in rows if r['converted_from_free']]
    ghost_downgraded_rows = [r for r in rows if r['ghost_status_downgraded']]
    expired_but_still_paid = [r for r in paid_rows if r['expired_but_still_paid']]
    expiring_7d = [r for r in paid_rows if _within_days(r['computed_expiry'], 7, now)]
    expiring_30d = [r for r in paid_rows if _within_days(r['computed_expiry'], 30, now)]

    revenue_30d = {'INR': 0, 'USD': 0}
    revenue_365d = {'INR': 0, 'USD': 0}
    if _db is not None:
        try:
            cutoff_365 = now - timedelta(days=365)
            async for doc in _db.payments.find({'razorpay_created_at': {'$gte': cutoff_365}}):
                paid_at = doc.get('razorpay_created_at')
                if paid_at and paid_at.tzinfo is None:
                    paid_at = paid_at.replace(tzinfo=timezone.utc)
                currency = doc.get('currency')
                amount = doc.get('amount') or 0
                if currency not in revenue_365d:
                    continue
                revenue_365d[currency] += amount
                if paid_at and paid_at >= now - timedelta(days=30):
                    revenue_30d[currency] += amount
        except Exception as e:
            logger.warning(f'overview revenue scan failed (non-fatal): {e!r}')

    pending_comments = 0
    active_nominations = 0
    active_trials = 0
    if _db is not None:
        try:
            pending_comments = await _db.comments.count_documents({'status': 'pending'})
        except Exception as e:
            logger.warning(f'overview pending_comments count failed (non-fatal): {e!r}')
        try:
            active_nominations = await _db.nomination_access.count_documents({'status': 'active'})
        except Exception as e:
            logger.warning(f'overview active_nominations count failed (non-fatal): {e!r}')
        try:
            active_trials = await _db.trial_members.count_documents({'expires_at': {'$gt': now}})
        except Exception as e:
            logger.warning(f'overview active_trials count failed (non-fatal): {e!r}')

    pending_students = 0
    if _db is not None:
        try:
            pending_students = await _db.student_applications.count_documents({'status': 'pending'})
        except Exception as e:
            logger.warning(f'overview pending_students count failed (non-fatal): {e!r}')
    mixed_zone_unread = 0
    if _db is not None:
        try:
            mixed_zone_unread = await _db.mixed_zone_replies.count_documents({'read': {'$ne': True}})
        except Exception as e:
            logger.warning(f'overview mixed_zone_unread count failed (non-fatal): {e!r}')
    comps_to_remove = _comps_to_remove(rows, now)
    unmatched = _unmatched_payments(rows, payment_summaries)
    email_failures = await _recent_email_failures(now)

    corporate_accounts = 0
    try:
        corporate_accounts = len(await fetch_corporate_accounts())
    except Exception as e:
        logger.warning(f'overview corporate_accounts fetch failed (non-fatal): {e!r}')

    def _attention_row(r: dict) -> dict:
        return {
            'email': r['email'], 'name': r['name'], 'tier': r['tier'],
            'computed_expiry': r['computed_expiry'], 'expiry_source': r['expiry_source'],
        }

    return {
        'kpis': {
            'total_subscribers': len(rows),
            'paid': len(paid_rows),
            'free': len(rows) - len(paid_rows),
            'corporate_accounts': corporate_accounts,
            'active_trials': active_trials,
            'active_nominations': active_nominations,
            'pending_comments': pending_comments,
            'revenue_30d': revenue_30d,
            'revenue_365d': revenue_365d,
            'expiring_30d': len(expiring_30d),
            'expiring_7d': len(expiring_7d),
            'expired_but_still_paid': len(expired_but_still_paid),
            'free_to_paid_conversions': len(converted_from_free_rows),
            'ghost_status_downgraded': len(ghost_downgraded_rows),
        },
        'attention': {
            'expired_but_still_paid': [_attention_row(r) for r in expired_but_still_paid[:25]],
            'expiring_7d': [_attention_row(r) for r in expiring_7d[:25]],
            'ghost_status_downgraded': [
                {**_attention_row(r), 'restore_to_date': r['restore_to_date']}
                for r in ghost_downgraded_rows[:25]
            ],
            'pending_comments': pending_comments,
            'pending_students': pending_students,
            'mixed_zone_unread': mixed_zone_unread,
            'comps_to_remove': comps_to_remove[:50],
            'comps_to_remove_count': len(comps_to_remove),
            'unmatched_payments': unmatched[:50],
            'unmatched_payments_count': len(unmatched),
            'email_failures': email_failures,
        },
        'renewal_run': await _last_renewal_run(now),
        'renewals_month': await _renewals_this_month(now),
    }


@router.get('/api/admin/subscribers/{email}/subscription-status')
async def subscriber_subscription_status(
    email: str,
    _admin: None = Depends(require_admin_key_or_session),
):
    """Live Razorpay lookup, only fetched on row-expand -- not on every
    dashboard load. Needs the subscriber's subscription_id, which their
    most recent recorded payment carries if they're on the auto-renewing
    Subscription product."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    if _razorpay_client is None:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    doc = await _db.payments.find_one(
        {'email': email.lower().strip(), 'subscription_id': {'$nin': ['', None]}},
        sort=[('razorpay_created_at', -1)],
    )
    if not doc:
        return {'has_subscription': False}

    try:
        subscription = _razorpay_client.subscription.fetch(doc['subscription_id'])
    except Exception as e:
        logger.warning(f'subscription.fetch failed for {doc["subscription_id"]!r}: {e!r}')
        raise HTTPException(status_code=502, detail='Could not reach Razorpay')

    return {
        'has_subscription': True,
        'subscription_id': subscription.get('id'),
        'status': subscription.get('status'),
        'current_start': subscription.get('current_start'),
        'current_end': subscription.get('current_end'),
        'charge_at': subscription.get('charge_at'),
    }


# Rough "does this look like a photo credit" check -- not a real parser,
# just enough to separate "Photo: X / Y" or an actual <a href> link from
# a plain descriptive sentence like "A picture from the PKL final". Never
# auto-fixes anything -- only Venkat knows the real source for a given
# photo; this is a punch-list, not a corrector.
_CREDIT_MARKERS = ('photo', 'credit', 'courtesy', 'via ', '<a ', 'source:')


def _looks_like_credit(caption: str) -> bool:
    lowered = (caption or '').lower()
    return any(marker in lowered for marker in _CREDIT_MARKERS)


async def _fetch_all_published_posts_with_images(token: str) -> list[dict]:
    """Same paginated-listing shape tiers.list_all_ghost_members already
    uses, applied to posts instead of members."""
    posts: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=20.0) as client:
        while True:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/admin/posts/',
                params={
                    'limit': 100,
                    'page': page,
                    'filter': 'status:published',
                    'fields': 'slug,title,feature_image,feature_image_caption,published_at',
                },
                headers={'Authorization': f'Ghost {token}'},
            )
            if r.status_code != 200:
                logger.warning(f'Ghost posts list HTTP {r.status_code} on page {page}')
                break
            payload = r.json()
            posts.extend(payload.get('posts', []))
            pages = (payload.get('meta', {}).get('pagination') or {}).get('pages') or 1
            if page >= pages:
                break
            page += 1
    return posts


@router.get('/api/admin/image-captions/audit')
async def audit_image_captions(_admin: None = Depends(require_admin_key_or_session)):
    """Punch-list of published stories whose feature image has no
    credit-shaped caption -- doesn't edit anything, just flags what to
    go check in Ghost. Only stories that actually have a feature image
    are considered; a story with no image has nothing to credit."""
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Could not create Ghost admin token')

    posts = await _fetch_all_published_posts_with_images(token)
    with_image = [p for p in posts if p.get('feature_image')]
    flagged = [
        {
            'slug': p.get('slug'),
            'title': p.get('title'),
            'published_at': p.get('published_at'),
            'caption': p.get('feature_image_caption') or '',
        }
        for p in with_image
        if not _looks_like_credit(p.get('feature_image_caption') or '')
    ]
    return {
        'checked_count': len(with_image),
        'flagged_count': len(flagged),
        'flagged': flagged,
    }


def _is_junk_free_signup(member: dict) -> bool:
    """A free-registration signup worth a manual look: either tagged
    'email-gate-signup' (every register-free signup from here on --
    see session_auth.py's register_free) or carrying no labels at all
    (every one created before that label existed, e.g. the
    abc@gmail.com case that prompted this panel) -- and, either way,
    never actually paid. A real labeled free member (nominated-reader,
    tier-trial, etc.) never matches this."""
    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    if is_paid_from_labels(label_names) or member.get('status') in ('paid', 'comped'):
        return False
    return label_names == [] or label_names == ['email-gate-signup']


@router.get('/api/admin/free-registrations')
async def list_free_registrations(_admin: None = Depends(require_admin_key_or_session)):
    """Free, email-gate-style signups worth a manual look -- register-free
    creates a real Ghost member (joining the newsletter list) from
    nothing more than a syntax-valid email, and a domain-deliverability
    check can't catch an address like abc@gmail.com (real domain, junk
    local part). This is the fast-cleanup counterpart: list them so
    Venkat can spot and delete junk ones in one click instead of hunting
    through Ghost's own admin UI by hand."""
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Could not create Ghost admin token')

    members = await list_all_ghost_members(token)
    rows = []
    for m in members:
        if not _is_junk_free_signup(m):
            continue
        label_names = [(lbl.get('name') or '') for lbl in (m.get('labels') or [])]
        rows.append({
            'id': m.get('id'),
            'email': m.get('email'),
            'name': m.get('name') or '',
            'created_at': m.get('created_at'),
            'label_names': label_names,
            'reason': 'email-gate-signup' if label_names else 'no labels',
        })
    rows.sort(key=lambda r: r.get('created_at') or '', reverse=True)
    return {'count': len(rows), 'members': rows}


class DeleteFreeRegistrationBody(BaseModel):
    member_id: str


@router.post('/api/admin/free-registrations/delete')
async def delete_free_registration(
    req: DeleteFreeRegistrationBody, _admin: None = Depends(require_admin_key_or_session),
):
    """Deletes one flagged member from Ghost entirely, including off the
    newsletter list. Re-checks the member still qualifies as junk right
    before deleting -- never trusts a client-supplied id alone, so a
    stale or mistaken call (e.g. someone paid in the meantime) can't
    delete a real member."""
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Could not create Ghost admin token')

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f'{GHOST_URL}/ghost/api/admin/members/{req.member_id}/',
            params={'include': 'labels'},
            headers={'Authorization': f'Ghost {token}'},
        )
    if r.status_code != 200 or not r.json().get('members'):
        raise HTTPException(status_code=404, detail='Member not found')
    member = r.json()['members'][0]
    if not _is_junk_free_signup(member):
        raise HTTPException(status_code=403, detail='This member no longer qualifies for cleanup deletion')

    if not await delete_ghost_member(req.member_id, token):
        raise HTTPException(status_code=502, detail='Could not delete member')
    return {'deleted': True, 'email': member.get('email')}


# The Left Field offer list (payments.import_left_field_readers) minus
# everyone who is or was a TSOP subscriber, so the ₹2,499 Left Field rate
# can't become a cheaper way back in than the ₹2,999 renewal. Checkout
# refuses them the rate anyway (session_auth.early_rate_for_email); this
# keeps the list itself, and its numbers, true.
LEFT_FIELD_GHOST_JOINED_BEFORE = datetime(2026, 10, 6, tzinfo=timezone(timedelta(hours=5, minutes=30)))


def _is_tsop_subscriber(member: dict) -> bool:
    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = member.get('status') in ('paid', 'comped') or is_paid_from_labels(label_names)
    return is_paid or resolve_tier(label_names, is_paid) != 'free'


@router.post('/api/admin/left-field-readers/audit')
async def audit_left_field_readers(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    members = await list_all_ghost_members(token)
    ghost = {(m.get('email') or '').lower().strip(): m for m in members}
    subscribers = {e for e, m in ghost.items() if e and _is_tsop_subscriber(m)}
    # Anyone who has paid for more than The Ten, current or lapsed.
    async for doc in _db.payments.find({'plan': {'$ne': 'trial'}}, {'email': 1}):
        if doc.get('email'):
            subscribers.add(doc['email'].lower().strip())

    listed = []
    async for doc in _db.left_field_readers.find({}, {'email': 1}):
        if doc.get('email'):
            listed.append(doc['email'])
    to_remove = [e for e in listed if e in subscribers]
    if to_remove:
        await _db.left_field_readers.delete_many({'email': {'$in': to_remove}})

    remaining = [e for e in listed if e not in subscribers]
    ghost_free_early = 0
    for e in remaining:
        joined = ghost.get(e, {}).get('created_at')
        try:
            joined_at = datetime.fromisoformat(str(joined).replace('Z', '+00:00')) if joined else None
        except ValueError:
            joined_at = None
        if joined_at and joined_at < LEFT_FIELD_GHOST_JOINED_BEFORE:
            ghost_free_early += 1
    result = {
        'checked': len(listed),
        'removed_subscribers': len(to_remove),
        'total': len(remaining),
        'ghost_free_before_cutover': ghost_free_early,
        'ghost_free_after_cutover': sum(1 for e in remaining if e in ghost) - ghost_free_early,
        'substack_only': sum(1 for e in remaining if e not in ghost),
    }
    logger.info(f'left-field audit: {result}')
    return result
