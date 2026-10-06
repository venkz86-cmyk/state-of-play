"""
payments.py — the payments ledger. Nothing in this codebase has ever
persisted a structured, queryable record of what a subscriber actually
paid: razorpay_orders.py and razorpay_subscriptions.py verify a signature
and label the Ghost member, but write no Mongo record at all; the
Razorpay webhook (server.py) writes amount (no currency) into a Ghost
member's `note` field, which is OVERWRITTEN on every subsequent payment --
no history. This module is that missing ledger.

Trusts Razorpay's own record of a payment, not this codebase's pricing
tables (PLAN_PRICING/SUBSCRIPTION_PLANS), which drift -- community
offers, the Nov 1 pricing transition. Every write
path (the webhook, both verify-* endpoints, and the historical backfill)
funnels through record_payment(), which upserts on Razorpay's own
`payment_id` -- first writer wins, every later call for the same payment
is a true no-op. That's what makes it safe for all four sources to
potentially see the same payment without double-counting it.

Provides:
  * record_payment(...)              — the one write path, idempotent.
  * fetch_and_record(client, id, ...) — calls Razorpay's payment.fetch(),
    then record_payment(). Shared by razorpay_orders.verify_payment and
    razorpay_subscriptions.verify_subscription.
  * get_subscriber_payment_summaries() — {email: {last_payment,
    total_paid: {INR, USD}, payment_count}}, used by admin_dashboard.py.
  * GET  /api/admin/payments               — admin-only, a subscriber's
    (or everyone's) payment history.
  * POST /api/admin/payments/backfill      — admin-only, one-time pull of
    historical payments from Razorpay's own API.
  * GET  /api/admin/payments/backfill/status — admin-only, when the
    backfill last ran.

Dependencies: none new -- reuses the razorpay client + Mongo handle
server.py already has.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from admin_auth import require_admin_key_or_session

logger = logging.getLogger(__name__)

router = APIRouter()

_db = None
_razorpay_client = None

BACKFILL_PAGE_SIZE = 100
# A pause between pages, not a rate-limit requirement -- good-citizen
# pacing on an endpoint that's triggered once by hand, not on a schedule.
BACKFILL_PAGE_DELAY_SECONDS = 0.25


def init(db_handle, razorpay_client=None):
    global _db, _razorpay_client
    _db = db_handle
    _razorpay_client = razorpay_client


async def _ensure_indexes():
    if _db is None:
        return
    try:
        await _db.payments.create_index('payment_id', unique=True)
        await _db.payments.create_index('email')
        await _db.payments.create_index('razorpay_created_at')
    except Exception as e:
        logger.warning(f'payments index ensure failed (non-fatal): {e!r}')


async def claim_payment(payment_id: str, email: str, kind: str) -> str:
    """Binds one Razorpay payment to the one account (and one kind of
    grant: 'order', 'gift' or 'subscription') it paid for, so a payment
    can only ever grant access once.

    The verify-* endpoints are called from the browser with Razorpay's
    order/payment ids and signature. That signature proves the payment
    happened, but nothing stopped the same three values being sent
    again with a different email, giving any number of accounts access
    off one payment. Returns 'new' the first time, 'repeat' when the same
    payment comes back for the same account and kind (a retried call;
    callers skip the welcome email), and raises 409 for anything else.

    Fails open if Mongo is unavailable: blocking a real buyer who just
    paid is worse than the replay window during an outage."""
    if _db is None or not payment_id:
        logger.error(f'claim_payment: no store, not recording {payment_id!r}')
        return 'new'
    email = (email or '').lower().strip()
    try:
        await _db.payment_grants.create_index('payment_id', unique=True)
    except Exception as e:
        logger.warning(f'payment_grants index ensure failed (non-fatal): {e!r}')
    try:
        await _db.payment_grants.insert_one({
            'payment_id': payment_id, 'email': email, 'kind': kind,
            'created_at': datetime.now(timezone.utc),
        })
        return 'new'
    except Exception as e:
        existing = await _db.payment_grants.find_one({'payment_id': payment_id})
        if not existing:
            logger.error(f'claim_payment: insert failed for {payment_id!r}: {e!r}')
            return 'new'
        if existing.get('email') == email and existing.get('kind') == kind:
            return 'repeat'
        logger.warning(
            f'claim_payment: payment {payment_id!r} already used for '
            f'{existing.get("email")!r}/{existing.get("kind")!r}, refused for {email!r}/{kind!r}'
        )
        raise HTTPException(status_code=409, detail='This payment has already been used.')


def _iso(dt) -> Optional[str]:
    """Motor/MongoDB returns naive datetimes by default (a UTC value with
    no tzinfo attached) unless the client was created with tz_aware=True
    -- this codebase's isn't. A bare .isoformat() on that silently drops
    the UTC-ness: the resulting string carries no offset, so (a) a JS
    `new Date(iso)` reading it on the frontend interprets it as LOCAL
    time rather than UTC, and (b) parsing it back into a datetime and
    comparing it against an aware `datetime.now(timezone.utc)` elsewhere
    raises TypeError (confirmed live -- this is exactly what crashed
    GET /api/admin/subscribers the first time a real payment's date flowed
    through this path; the fake-Mongo test harness never caught it
    because it happened to only ever store already-aware datetimes).
    Always attach UTC explicitly before turning a Mongo datetime into a
    string -- every serialization site in this module goes through here."""
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _serialize(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k != '_id'}
    for key in ('razorpay_created_at', 'created_at'):
        if key in out:
            out[key] = _iso(out[key])
    return out


async def record_payment(
    payment_id: str,
    email: str,
    amount,
    currency: str,
    plan: str,
    source: str,
    order_id: str = '',
    subscription_id: str = '',
    name: str = '',
    razorpay_created_at_unix: Optional[int] = None,
    raw_notes: Optional[dict] = None,
    access_from: Optional[datetime] = None,
) -> bool:
    """Upserts on payment_id. Returns True if this call was the one that
    actually inserted the row (a genuinely new payment), False if the
    payment was already recorded (by any source) -- the signal every
    caller uses to avoid double-counting across the webhook, both
    verify-* endpoints, and the backfill."""
    if _db is None or not payment_id:
        return False
    await _ensure_indexes()

    email = (email or '').lower().strip()
    currency = currency or 'INR'
    country = 'IN' if currency == 'INR' else 'INTL'
    razorpay_created_at = (
        datetime.fromtimestamp(razorpay_created_at_unix, tz=timezone.utc)
        if razorpay_created_at_unix else datetime.now(timezone.utc)
    )
    # A renewal's year starts when the current one ends, not on the day
    # it was paid, so renewing early never costs the member days they
    # already paid for. Worked out here, before this payment is inserted,
    # so the verify endpoint and the webhook (whichever records it first)
    # agree. The charge date itself stays in razorpay_created_at.
    if plan == 'renewal' and access_from is None:
        access_from = await renewal_access_from(email, razorpay_created_at)

    doc = {
        'payment_id': payment_id,
        'order_id': order_id or '',
        'subscription_id': subscription_id or '',
        'email': email,
        'name': name or '',
        'amount': amount,
        'currency': currency,
        'plan': plan or 'unknown',
        'country': country,
        'source': source,
        'status': 'captured',
        'razorpay_created_at': razorpay_created_at,
        'raw_notes': raw_notes or {},
    }
    if access_from is not None:
        doc['access_from'] = access_from
    try:
        result = await _db.payments.update_one(
            {'payment_id': payment_id},
            {'$setOnInsert': {**doc, 'created_at': datetime.now(timezone.utc)}},
            upsert=True,
        )
        return getattr(result, 'upserted_id', None) is not None
    except Exception as e:
        logger.warning(f'record_payment failed (non-fatal) for {payment_id!r}: {e!r}')
        return False


async def fetch_and_record(
    razorpay_client, payment_id: str, source: str,
    fallback_email: str = '', fallback_plan: str = '',
) -> Optional[dict]:
    """Calls Razorpay's own payment.fetch(), then record_payment() with
    what Razorpay itself says about the payment -- not this codebase's
    own pricing tables, which can drift from what was actually charged
    (a community offer). Shared by
    razorpay_orders.verify_payment and razorpay_subscriptions.
    verify_subscription so this "trust Razorpay's own record" logic
    exists exactly once."""
    if not razorpay_client or not payment_id:
        return None
    try:
        payment = razorpay_client.payment.fetch(payment_id)
    except Exception as e:
        logger.warning(f'payments.fetch_and_record: payment.fetch failed for {payment_id!r}: {e!r}')
        return None

    notes = payment.get('notes') or {}
    email = (payment.get('email') or notes.get('email') or fallback_email or '').lower().strip()
    plan = notes.get('plan') or fallback_plan or 'unknown'

    is_new = await record_payment(
        payment_id=payment.get('id') or payment_id,
        order_id=payment.get('order_id') or '',
        subscription_id=payment.get('subscription_id') or '',
        email=email,
        name=notes.get('name') or '',
        amount=payment.get('amount'),
        currency=payment.get('currency') or 'INR',
        plan=plan,
        source=source,
        razorpay_created_at_unix=payment.get('created_at'),
        raw_notes=notes,
    )
    return {
        'is_new': is_new, 'email': email, 'amount': payment.get('amount'),
        'currency': payment.get('currency'), 'plan': plan,
    }


async def renewal_access_from(email: str, paid_at: datetime) -> datetime:
    """When a renewal paid at paid_at starts: the end of the member's
    current year if that's still ahead, otherwise the payment date."""
    current_end_iso = compute_synthetic_expiry(await get_last_payment_for_email(email))
    if current_end_iso:
        current_end = datetime.fromisoformat(current_end_iso)
        if current_end.tzinfo is None:
            current_end = current_end.replace(tzinfo=timezone.utc)
        if current_end > paid_at:
            return current_end
    return paid_at


async def get_subscriber_payment_summaries() -> dict:
    """{email: {last_payment: {...}, first_payment: {...}, total_paid:
    {INR: int, USD: int}, payment_count: int}}. The two currencies are
    never summed together -- a subscriber's total is always shown as two
    separate figures, never converted. `first_payment` is the earliest
    captured payment on record for that email -- the conversion-date
    signal admin_dashboard.py joins against a Ghost member's signup date
    to answer "did a free reader ever become a paying one, and when."
    Used by admin_dashboard.py's subscriber listing, not exposed as its
    own endpoint."""
    if _db is None:
        return {}
    summaries: dict = {}
    # Sorted newest-first: the first doc seen per email is the last
    # payment, and since we keep overwriting first_payment on every
    # subsequent doc for that email, whichever write happens last (the
    # oldest doc, seen last in this descending scan) is the true earliest
    # payment once the cursor is exhausted.
    cursor = _db.payments.find({}).sort('razorpay_created_at', -1)
    async for doc in cursor:
        email = doc.get('email')
        if not email:
            continue
        payment_snapshot = {
            'payment_id': doc.get('payment_id'),
            'amount': doc.get('amount'),
            'currency': doc.get('currency'),
            'plan': doc.get('plan'),
            # annual_renewal.py skips auto-renewing members by this.
            'subscription_id': doc.get('subscription_id') or '',
            'razorpay_created_at': _iso(doc.get('razorpay_created_at')),
            'access_from': _iso(doc.get('access_from')),
        }
        if email not in summaries:
            summaries[email] = {
                'last_payment': payment_snapshot,
                'first_payment': payment_snapshot,
                'total_paid': {'INR': 0, 'USD': 0},
                'payment_count': 0,
            }
        summary = summaries[email]
        summary['first_payment'] = payment_snapshot
        summary['payment_count'] += 1
        currency = doc.get('currency')
        if currency in summary['total_paid']:
            summary['total_paid'][currency] += doc.get('amount') or 0
    return summaries


async def reassign_payment_email(payment_id: str, new_email: str, new_created_at: Optional[datetime] = None) -> bool:
    """Moves an existing payment record to a different email -- used by
    gift_subscriptions.py's redeem step, where the real Razorpay charge
    already happened (and was recorded under the buyer, while the gift
    code sat unredeemed) and redemption itself isn't a second charge --
    it's the moment the payment's real beneficiary becomes known. A
    second record_payment() call for the same payment_id would either
    no-op (record_payment upserts on payment_id) or, if given a
    different synthetic id to dodge that, double-count one real charge
    as two ledger rows. This mutates the one row in place instead.

    new_created_at optionally backdates razorpay_created_at too --
    gift_subscriptions.py uses this so a redeemer's year starts on
    their claim date, not the (possibly much earlier) purchase date a
    link sat unclaimed for, and so it can stack a gifted year onto an
    already-subscribed recipient's existing paid-through date instead
    of resetting their clock to today. razorpay_created_at already
    functions as "cycle start date" everywhere else in this codebase
    (compute_synthetic_expiry, trial-upgrade's bonus days), not a
    strictly literal charge timestamp, so this isn't a new precedent."""
    if _db is None or not payment_id:
        return False
    update = {'email': new_email.lower().strip()}
    if new_created_at is not None:
        update['razorpay_created_at'] = new_created_at
    result = await _db.payments.update_one(
        {'payment_id': payment_id},
        {'$set': update},
    )
    return result.matched_count > 0


async def get_last_payment_by_subscription_id(subscription_id: str) -> Optional[dict]:
    """Reverse lookup of get_last_payment_for_email -- resolves which
    email a given Razorpay subscription belongs to. A subscription.*
    webhook event carries only the subscription's own id, never the
    subscriber's email, so razorpay_subscriptions.py's grace-period
    handling needs this to know who to notify/eventually downgrade."""
    if _db is None or not subscription_id:
        return None
    doc = await _db.payments.find_one(
        {'subscription_id': subscription_id}, sort=[('razorpay_created_at', -1)],
    )
    if not doc:
        return None
    return {
        'payment_id': doc.get('payment_id'),
        'email': doc.get('email'),
        'amount': doc.get('amount'),
        'currency': doc.get('currency'),
    }


async def get_last_payment_for_email(email: str) -> Optional[dict]:
    """Single-email version of get_subscriber_payment_summaries()'s
    last_payment -- for a caller (server.py's /ghost/member-details) that
    only needs one member's record, not every subscriber's."""
    if _db is None:
        return None
    doc = await _db.payments.find_one(
        {'email': email.lower().strip()}, sort=[('razorpay_created_at', -1)],
    )
    if not doc:
        return None
    return {
        'payment_id': doc.get('payment_id'),
        'amount': doc.get('amount'),
        'currency': doc.get('currency'),
        'plan': doc.get('plan'),
        'subscription_id': doc.get('subscription_id') or '',
        'razorpay_created_at': _iso(doc.get('razorpay_created_at')),
        'access_from': _iso(doc.get('access_from')),
    }


async def has_paid_before(email: str, exclude_payment_id: str = '') -> bool:
    """True if this email has a real, non-Trial payment on the ledger
    other than exclude_payment_id. verify_payment uses it to decide
    whether this is someone's first membership payment (and so gets the
    welcome email): Razorpay's webhook often records the same payment a
    few seconds before verify runs, so that payment has to be left out."""
    if _db is None:
        return False
    query = {'email': email.lower().strip(), 'plan': {'$ne': 'trial'}}
    if exclude_payment_id:
        query['payment_id'] = {'$ne': exclude_payment_id}
    return await _db.payments.find_one(query) is not None


async def has_paid_beyond_trial(email: str) -> bool:
    """True if this email has a real, non-Trial payment on our own
    ledger -- used to gate ensure_member_labeled's stray-paid-label
    strip (tiers.py) so a genuine subscriber who separately buys a
    ₹590 Trial never has real paid labels stripped, while a member who
    has only ever bought a Trial (and picked up an unintended paid
    label from the still-live "Razorpay Payment Capture" Zap) does get
    cleaned up -- regardless of whether they were a brand-new Ghost
    signup or already existed as a free/newsletter member. Callers
    check this BEFORE recording the current payment (fetch_and_record
    hasn't run yet at that point in verify_payment), so a first-ever
    Trial purchase never counts itself as prior history."""
    if _db is None:
        return False
    doc = await _db.payments.find_one({'email': email.lower().strip(), 'plan': {'$ne': 'trial'}})
    return doc is not None


# A real paid annual member's cheap expiry estimate (no Ghost-native
# subscription/comp end date to trust instead) -- last real payment's
# date + 365 days, +30 more for a trial-upgrade payment's
# thirteen-months-for-twelve bonus. Shared by admin_dashboard.py's
# _compute_expiry/restore_to_date and server.py's /ghost/member-details,
# so the two surfaces can't disagree on when a subscriber's year is up.
SYNTHETIC_CYCLE_DAYS = 365
TRIAL_UPGRADE_BONUS_DAYS = 30


def compute_synthetic_expiry(last_payment: Optional[dict]) -> Optional[str]:
    # A renewal counts from access_from (the end of the year before it),
    # everything else from the payment date.
    start = (last_payment or {}).get('access_from') or (last_payment or {}).get('razorpay_created_at')
    if not start:
        return None
    try:
        paid_at = datetime.fromisoformat(start) if isinstance(start, str) else start
        if paid_at.tzinfo is None:
            paid_at = paid_at.replace(tzinfo=timezone.utc)
        cycle_days = SYNTHETIC_CYCLE_DAYS
        if last_payment.get('plan') == 'trial-upgrade':
            cycle_days += TRIAL_UPGRADE_BONUS_DAYS
        return (paid_at + timedelta(days=cycle_days)).isoformat()
    except (ValueError, TypeError):
        return None


# ─── Where members come from ────────────────────────────────────────────────
# Every sign-up and checkout button on the site sends a short name for
# itself (`source`), and the site passes along the first ?ref= tag the
# visitor arrived with (`ref`, kept 30 days in their browser). Both are
# recorded here, in the `signups` collection, once per new free member or
# new payment, and summarised by GET /api/admin/attribution.

# The buttons that exist. Only these become Ghost labels (source-<name>),
# so a made-up value can't fill Ghost with junk labels; anything else is
# still recorded here, as given.
SIGNUP_SOURCES = {
    'story-email-gate', 'left-field-form', 'signup-page', 'paywall',
    'trial-page', 'trial-via-paywall', 'trial-upgrade-page', 'account-ten-panel', 'account-renew', 'renew-page',
    'student-pay-link', 'gift-page', 'teams-page',
}
_TAG_CLEAN = re.compile(r'[^a-z0-9-]+')


def clean_tag(value, max_len: int = 40) -> str:
    """Lowercase, letters/digits/hyphens only, so 'LinkedIn ' and
    'linkedin' count as one source."""
    value = _TAG_CLEAN.sub('-', (value or '').strip().lower()).strip('-')
    return value[:max_len]


def source_label(source) -> Optional[str]:
    cleaned = clean_tag(source)
    return f'source-{cleaned}' if cleaned in SIGNUP_SOURCES else None


async def record_signup(
    kind: str, email: str, source: str = '', ref: str = '', plan: str = '',
    amount=None, currency: str = '', payment_id: str = '', landing: str = '',
) -> None:
    """kind: 'free' (new free member), 'paid' (a new membership payment)
    or 'gift' (a gift bought). Never raises: tracking must not break a
    sign-up or a payment."""
    if _db is None:
        return
    try:
        await _db.signups.insert_one({
            'kind': kind,
            'email': (email or '').lower().strip(),
            'source': clean_tag(source) or 'unknown',
            'ref': clean_tag(ref) or 'direct',
            'plan': plan or '',
            'amount': amount,
            'currency': currency or '',
            'payment_id': payment_id or '',
            'landing': (landing or '')[:200],
            'created_at': datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f'record_signup failed (non-fatal) for {email!r}: {e!r}')


def _week_start(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    monday = (dt - timedelta(days=dt.weekday())).date()
    return monday.isoformat()


def summarise_signups(docs: list) -> dict:
    """Weekly counts, newest week first, plus totals for the window."""
    def blank():
        return {'free': 0, 'paid': 0, 'gift': 0,
                'free_by_source': {}, 'paid_by_plan': {}, 'paid_by_source': {}, 'by_ref': {}}

    def add(bucket, d):
        kind = d.get('kind') if d.get('kind') in ('free', 'paid', 'gift') else 'free'
        bucket[kind] += 1
        src, ref = d.get('source') or 'unknown', d.get('ref') or 'direct'
        if kind == 'free':
            bucket['free_by_source'][src] = bucket['free_by_source'].get(src, 0) + 1
        else:
            plan = 'gift' if kind == 'gift' else (d.get('plan') or 'unknown')
            bucket['paid_by_plan'][plan] = bucket['paid_by_plan'].get(plan, 0) + 1
            bucket['paid_by_source'][src] = bucket['paid_by_source'].get(src, 0) + 1
        r = bucket['by_ref'].setdefault(ref, {'free': 0, 'paid': 0})
        r['free' if kind == 'free' else 'paid'] += 1

    weeks, totals = {}, blank()
    for d in docs:
        created = d.get('created_at')
        if not isinstance(created, datetime):
            continue
        add(weeks.setdefault(_week_start(created), blank()), d)
        add(totals, d)
    return {
        'weeks': [{'week_start': k, **v} for k, v in sorted(weeks.items(), reverse=True)],
        'totals': totals,
    }


@router.get('/api/admin/attribution')
async def attribution_summary(
    weeks: int = 8,
    _admin: None = Depends(require_admin_key_or_session),
):
    """Where new members and payments came from, week by week."""
    if _db is None:
        return summarise_signups([])
    weeks = max(1, min(weeks, 52))
    since = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    docs = await _db.signups.find({'created_at': {'$gte': since}}).to_list(length=20000)
    return summarise_signups(docs)


@router.get('/api/admin/payments')
async def list_payments(
    email: str = '',
    _admin: None = Depends(require_admin_key_or_session),
):
    """A subscriber's payment history (email=...), or everyone's if
    omitted -- the drill-down behind a subscriber row in the dashboard."""
    if _db is None:
        return {'payments': []}
    query = {'email': email.lower().strip()} if email else {}
    cursor = _db.payments.find(query).sort('razorpay_created_at', -1)
    docs = await cursor.to_list(length=1000)
    return {'payments': [_serialize(d) for d in docs]}


class BackfillRequest(BaseModel):
    from_date: Optional[str] = None  # 'YYYY-MM-DD'
    to_date: Optional[str] = None


@router.post('/api/admin/payments/backfill')
async def backfill_payments(
    req: BackfillRequest,
    _admin: None = Depends(require_admin_key_or_session),
):
    """One-time (safe to re-run) pull of historical payments straight
    from Razorpay's own Payments API -- the only place amount/currency/
    plan/date exists for anyone who paid before this ledger did. Only
    sees whichever mode (test/live) the configured Razorpay keys are in.
    Paces itself between pages; each payment goes through the same
    record_payment() idempotency the webhook and verify-* endpoints use,
    so re-running this after real traffic has already recorded some of
    the same payments just no-ops on those."""
    if _razorpay_client is None:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    params: dict = {}
    if req.from_date:
        try:
            params['from'] = int(datetime.fromisoformat(req.from_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid from_date: {req.from_date!r}")
    if req.to_date:
        try:
            params['to'] = int(datetime.fromisoformat(req.to_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid to_date: {req.to_date!r}")

    scanned = recorded = skipped_existing = unmatched_email_count = 0
    skip = 0
    while True:
        page_params = {**params, 'count': BACKFILL_PAGE_SIZE, 'skip': skip}
        try:
            page = _razorpay_client.payment.all(page_params)
        except Exception as e:
            logger.error(f'payments backfill: payment.all failed at skip={skip}: {e!r}')
            break

        items = page.get('items') or []
        if not items:
            break

        for payment in items:
            scanned += 1
            if payment.get('status') != 'captured':
                continue
            notes = payment.get('notes') or {}
            email = (payment.get('email') or notes.get('email') or '').lower().strip()
            if not email:
                unmatched_email_count += 1
                continue
            is_new = await record_payment(
                payment_id=payment.get('id'),
                order_id=payment.get('order_id') or '',
                subscription_id=payment.get('subscription_id') or '',
                email=email,
                name=notes.get('name') or '',
                amount=payment.get('amount'),
                currency=payment.get('currency') or 'INR',
                plan=notes.get('plan') or 'unknown',
                source='backfill',
                razorpay_created_at_unix=payment.get('created_at'),
                raw_notes=notes,
            )
            if is_new:
                recorded += 1
            else:
                skipped_existing += 1

        if len(items) < BACKFILL_PAGE_SIZE:
            break
        skip += BACKFILL_PAGE_SIZE
        await asyncio.sleep(BACKFILL_PAGE_DELAY_SECONDS)

    result = {
        'scanned': scanned,
        'recorded': recorded,
        'skipped_existing': skipped_existing,
        'unmatched_email_count': unmatched_email_count,
        'date_range': {'from': req.from_date, 'to': req.to_date},
    }

    if _db is not None:
        try:
            await _db.payments_meta.update_one(
                {'_id': 'backfill'},
                {'$set': {'last_run_at': datetime.now(timezone.utc), **result}},
                upsert=True,
            )
        except Exception as e:
            logger.warning(f'payments_meta write failed (non-fatal): {e!r}')

    return result


@router.get('/api/admin/payments/backfill/status')
async def backfill_status(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'last_run_at': None}
    doc = await _db.payments_meta.find_one({'_id': 'backfill'})
    if not doc:
        return {'last_run_at': None}
    return {
        'last_run_at': _iso(doc.get('last_run_at')),
        'scanned': doc.get('scanned'),
        'recorded': doc.get('recorded'),
        'skipped_existing': doc.get('skipped_existing'),
        'unmatched_email_count': doc.get('unmatched_email_count'),
    }
