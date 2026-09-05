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

import jwt
from fastapi import APIRouter, HTTPException, Depends

from admin_auth import require_admin_key_or_session
from tiers import list_all_ghost_members, resolve_tier, is_paid_from_labels
from payments import get_subscriber_payment_summaries
from corporate import fetch_accounts as fetch_corporate_accounts

logger = logging.getLogger(__name__)

router = APIRouter()

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

MAX_ROWS = 5000
SYNTHETIC_CYCLE_DAYS = 365  # a real paid annual member's cheap expiry estimate
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
    if last_payment and last_payment.get('razorpay_created_at'):
        try:
            paid_at = datetime.fromisoformat(last_payment['razorpay_created_at'])
            # payments._iso() already attaches UTC before this string is
            # built, so this should always be aware -- guarded anyway,
            # matching the trial/nomination branches above, since a naive
            # datetime here is exactly what crashed this endpoint once a
            # real payment's date flowed through it (real MongoDB returns
            # naive datetimes by default; the fake-Mongo test harness this
            # was verified against didn't, which is why it wasn't caught).
            if paid_at.tzinfo is None:
                paid_at = paid_at.replace(tzinfo=timezone.utc)
            return (paid_at + timedelta(days=SYNTHETIC_CYCLE_DAYS)).isoformat(), 'payment_estimate'
        except (ValueError, TypeError):
            pass
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
        corp_account_id = _corp_account_id(label_names)
        company_name = corp_name_map.get(corp_account_id) if corp_account_id else None

        computed_expiry, expiry_source = _compute_expiry(
            label_names, last_payment, trial_map.get(email), nomination_map.get(email),
            ghost_subscription_expires,
            corp_renewal_map.get(corp_account_id) if corp_account_id else None,
        )

        expired_but_still_paid = False
        if paid and computed_expiry:
            try:
                exp_dt = datetime.fromisoformat(computed_expiry)
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                expired_but_still_paid = exp_dt < datetime.now(timezone.utc)
            except (ValueError, TypeError):
                pass

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


@router.get('/api/admin/overview')
async def admin_overview(_admin: None = Depends(require_admin_key_or_session)):
    """Cheap aggregate counts over data every earlier phase already built
    -- no new collection, no new source of truth. The one thing this
    dashboard was built to finally answer in one place: who's subscribed,
    what did they pay, what's expiring, what needs attention today."""
    now = datetime.now(timezone.utc)
    rows = await _build_subscriber_rows()

    paid_rows = [r for r in rows if r['is_paid']]
    converted_from_free_rows = [r for r in rows if r['converted_from_free']]
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
        },
        'attention': {
            'expired_but_still_paid': [_attention_row(r) for r in expired_but_still_paid[:25]],
            'expiring_7d': [_attention_row(r) for r in expiring_7d[:25]],
            'pending_comments': pending_comments,
        },
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
