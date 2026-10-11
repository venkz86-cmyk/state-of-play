"""
Refunds (October 2026).

Venkat refunds a payment from the dashboard (Money, Refunds) without going
to Razorpay: in full or in part, with or without ending the membership,
with or without a note to the reader. Two cases refund themselves, the
moment the payment is recorded:

  * Paid twice. The same email pays for the same thing (an annual year,
    The Ten, the Student membership) again within 24 hours: the later
    payment is refunded in full. Access isn't touched; the first payment
    stands.
  * Overpaid. Someone who has been an annual member before pays the
    new-reader price (₹3,499 + GST / $169) instead of the renewal rate
    (₹2,999 + GST / $149): the difference is refunded and the payment
    becomes their renewal, so their new year starts when the current one
    ends. Checkout already charges returning members the renewal rate
    (razorpay_orders._returning_member_email); this catches anything that
    slips past it (a Razorpay link, an old tab).

Both only look at live payments (the last 48 hours, never the backfill
import), never at gifts (one buyer, several recipients), team plans (a
company can buy two) or auto-renewing Subscriptions.

Refunds made in Razorpay's own dashboard come back through the webhook
(refund.created / refund.processed / refund.failed, server.py) and are
read from Razorpay itself, not from the webhook body, so a forged webhook
can't mark anything refunded.

A payment refunded in full stops counting toward the member's year
(payments.COUNTS_FOR_ACCESS) unless Venkat let them keep access. Revenue
on the dashboard is net of refunds.

Endpoints (admin only):
  GET  /api/admin/refunds/lookup?q=   payments for an email or payment ID
  POST /api/admin/refunds             refund one payment
  GET  /api/admin/refunds/recent      refunds in the last 60 days
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from admin_auth import require_admin_key_or_session
from email_layout import email_shell
from resend_email import send_email
import payments as PM

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_razorpay_client = None

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')

DUPLICATE_WINDOW = timedelta(hours=24)
LIVE_WINDOW = timedelta(hours=48)
# What counts as "the same thing" for paid-twice: a year bought as a
# new reader, a renewal or an upgrade from The Ten is one annual year.
_SAME_THING = {
    'standard': 'annual', 'renewal': 'annual', 'trial-upgrade': 'annual', 'community-ftwtsop': 'annual',
    'trial': 'trial', 'student': 'student',
}
_PLAN_NAME = {
    'annual': 'a year of The State of Play', 'trial': 'The Ten', 'student': 'the Student membership',
}
# New-reader price and renewal rate, by currency (minor units).
NEW_READER_PRICE = {'INR': 412900, 'USD': 16900}
RENEWAL_PRICE = {'INR': 353900, 'USD': 14900}

REASONS = {
    'paid_twice': 'Paid twice',
    'overpaid': 'Paid the new-reader price',
    'asked': 'Asked for a refund',
    'other': 'Other',
}


def init(db_handle, razorpay_client=None):
    global _db, _razorpay_client
    _db = db_handle
    _razorpay_client = razorpay_client
    if check_new_payment not in PM.ON_NEW_PAYMENT:
        PM.ON_NEW_PAYMENT.append(check_new_payment)


def _utc(value) -> Optional[datetime]:
    if not value:
        return None
    dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def money(amount_minor, currency: str) -> str:
    """₹3,539 / ₹1,18,000 / $149 / $9.50"""
    units = (amount_minor or 0) / 100
    whole = units == int(units)
    if currency == 'INR':
        n = int(units)
        s = str(n)
        if len(s) > 3:
            head, tail = s[:-3], s[-3:]
            groups = []
            while len(head) > 2:
                groups.insert(0, head[-2:])
                head = head[:-2]
            if head:
                groups.insert(0, head)
            s = ','.join(groups) + ',' + tail
        return f'₹{s}' if whole else f'₹{s}.{int(round((units - n) * 100)):02d}'
    return f'${units:,.0f}' if whole else f'${units:,.2f}'


def _date(dt) -> str:
    dt = _utc(dt)
    return dt.strftime('%B %-d, %Y') if dt else ''


# ─── Emails to the reader ────────────────────────────────────────────────────

def _paid_twice_email(thing: str, paid_on: str, amount: str) -> tuple[str, str]:
    return 'We’ve refunded your second payment', email_shell(
        'Your second payment <em style="font-style: italic;">is on its way back.</em>',
        (
            '<p>Dear reader,</p>'
            f'<p>You paid for {thing} twice on {paid_on}. We’ve refunded the second payment of {amount} '
            'in full.</p>'
            '<p>Razorpay usually returns it to your card or account within 5 to 7 working days. Your '
            'membership is unaffected.</p>'
        ),
        compliance_footer=True,
    )


def _overpaid_email(paid: str, renewal: str, difference: str, starts: str) -> tuple[str, str]:
    start_line = f'Your new year starts when your current one ends, on {starts}.' if starts else \
        'Your new year starts today.'
    return f'We’ve refunded {difference}', email_shell(
        'You paid <em style="font-style: italic;">too much.</em>',
        (
            '<p>Dear reader,</p>'
            f'<p>You’ve been a member before, so your year should have cost the renewal rate of {renewal}. '
            f'You paid the new-reader price of {paid}, and we’ve refunded the difference of {difference}.</p>'
            f'<p>Razorpay usually returns it within 5 to 7 working days. {start_line}</p>'
        ),
        compliance_footer=True,
    )


def _manual_email(amount: str, paid_on: str, thing: str, ended: bool) -> tuple[str, str]:
    end_line = ('<p>Your membership has ended with this refund. Thank you for reading The State of Play.</p>'
                if ended else '')
    return 'Your refund is on its way', email_shell(
        'Your refund <em style="font-style: italic;">is on its way.</em>',
        (
            '<p>Dear reader,</p>'
            f'<p>We’ve refunded {amount} of your {paid_on} payment for {thing}.</p>'
            '<p>Razorpay usually returns it to your card or account within 5 to 7 working days.</p>'
            + end_line
        ),
        compliance_footer=True,
    )


# ─── Razorpay ────────────────────────────────────────────────────────────────

async def _razorpay_refund(payment_id: str, amount: int, reason: str, by: str) -> dict:
    if _razorpay_client is None:
        raise RuntimeError('Razorpay is not configured')
    data = {'amount': int(amount), 'speed': 'normal', 'notes': {'reason': reason, 'by': by}}
    return await asyncio.to_thread(_razorpay_client.payment.refund, payment_id, data)


async def _record_refund(doc: dict, refund: dict, reason: str, by: str, keeps_access: bool) -> dict:
    """Writes Razorpay's refund onto our payment row."""
    amount = int(refund.get('amount') or 0)
    refunded = int(doc.get('amount_refunded') or 0) + amount
    entry = {
        'refund_id': refund.get('id') or '', 'amount': amount, 'reason': reason, 'by': by,
        'status': refund.get('status') or 'pending', 'at': datetime.now(timezone.utc),
    }
    full = refunded >= int(doc.get('amount') or 0)
    update = {
        '$push': {'refunds': entry},
        '$set': {
            'amount_refunded': refunded,
            'status': 'refunded' if full else 'partially_refunded',
            **({'keeps_access': True} if full and keeps_access else {}),
        },
    }
    await _db.payments.update_one({'payment_id': doc['payment_id']}, update)
    return entry


async def _end_access(email: str, plan: str) -> str:
    """Removes the labels this plan gave, unless another payment or a
    complimentary year still covers them. Returns what happened, for the
    dashboard."""
    last = await PM.get_last_membership_payment_for_email(email)
    end = _utc(PM.compute_synthetic_expiry(last)) if last else None
    now = datetime.now(timezone.utc)
    if end and end > now:
        return f'Kept their access: another payment covers them until {_date(end)}.'
    grant = await PM.complimentary_grant_for(email)
    if grant and _utc(grant.get('ends_at')) and _utc(grant.get('ends_at')) > now:
        return f'Kept their access: their complimentary membership runs until {_date(grant.get("ends_at"))}.'
    from tiers import PLAN_LABELS, find_ghost_member, _create_ghost_admin_token
    token = _create_ghost_admin_token()
    member = await find_ghost_member(email, token) if token else None
    if not member:
        return 'No Ghost account found, so there was no access to remove.'
    labels = [l.get('name') for l in (member.get('labels') or []) if l.get('name')]
    remove = set(PLAN_LABELS.get(plan) or PLAN_LABELS['standard'])
    new_labels = [l for l in labels if l.lower() not in remove]
    if new_labels == labels:
        return 'They had no paid labels left to remove.'
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member["id"]}/',
                json={'members': [{'labels': [{'name': l} for l in new_labels]}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            return 'Ended their membership.'
        return f'Could not remove their access (Ghost said {r.status_code}). Remove the paid labels in Ghost.'
    except Exception as e:
        logger.warning(f'refunds: label removal failed for {email}: {e!r}')
        return 'Could not reach Ghost to remove their access. Remove the paid labels in Ghost.'


async def _log_failure(email: str, what: str, reason: str):
    try:
        from resend_email import _record_failure
        await _record_failure(email, what, reason)
    except Exception:
        logger.error(f'refunds: {what} for {email}: {reason}')


# ─── Automatic: paid twice, overpaid ─────────────────────────────────────────

async def check_new_payment(doc: dict):
    """Runs once per genuinely new payment (payments.record_payment)."""
    if _db is None or _razorpay_client is None:
        return
    pid = doc.get('payment_id') or ''
    paid_at = _utc(doc.get('razorpay_created_at'))
    notes = doc.get('raw_notes') or {}
    if (not pid.startswith('pay_') or doc.get('source') == 'backfill' or doc.get('subscription_id')
            or str(notes.get('gift', '')).lower() == 'true' or not paid_at
            or datetime.now(timezone.utc) - paid_at > LIVE_WINDOW):
        return
    thing = _SAME_THING.get(doc.get('plan') or '')
    if not thing:
        return
    # One look per payment, even if the hook ever ran twice.
    claimed = await _db.payments.update_one(
        {'payment_id': pid, 'auto_checked': {'$exists': False}},
        {'$set': {'auto_checked': datetime.now(timezone.utc)}},
    )
    if not getattr(claimed, 'modified_count', 0):
        return
    try:
        if await _refund_if_paid_twice(doc, thing, paid_at):
            return
        await _refund_if_overpaid(doc, paid_at)
    except Exception as e:
        logger.error(f'refunds: automatic check failed for {pid}: {e!r}')
        await _log_failure(doc.get('email', ''), f'Automatic refund check for {pid}', repr(e)[:300])


async def _refund_if_paid_twice(doc: dict, thing: str, paid_at: datetime) -> bool:
    email, pid = doc.get('email') or '', doc['payment_id']
    plans = [p for p, t in _SAME_THING.items() if t == thing]
    earlier = None
    async for other in _db.payments.find({
        'email': email, 'plan': {'$in': plans}, 'status': {'$ne': 'refunded'},
        'razorpay_created_at': {'$gte': paid_at - DUPLICATE_WINDOW, '$lte': paid_at},
    }):
        if other.get('payment_id') == pid or other.get('subscription_id'):
            continue
        if str((other.get('raw_notes') or {}).get('gift', '')).lower() == 'true':
            continue
        o_at = _utc(other.get('razorpay_created_at'))
        if o_at < paid_at or (o_at == paid_at and other['payment_id'] < pid):
            earlier = other
            break
    if not earlier:
        return False
    amount = int(doc.get('amount') or 0)
    try:
        refund = await _razorpay_refund(pid, amount, 'paid_twice', 'automatic')
    except Exception as e:
        await _log_failure(email, f'Automatic refund: paid twice ({pid})', repr(e)[:300])
        return True
    await _record_refund(doc, refund, 'paid_twice', 'automatic', keeps_access=False)
    logger.info(f'refunds: {pid} refunded in full, {email} paid twice (first {earlier["payment_id"]})')
    subject, html = _paid_twice_email(_PLAN_NAME[thing], _date(paid_at), money(amount, doc.get('currency') or 'INR'))
    await send_email(to=email, subject=subject, html=html)
    return True


async def _refund_if_overpaid(doc: dict, paid_at: datetime) -> bool:
    email, pid = doc.get('email') or '', doc['payment_id']
    currency = doc.get('currency') or 'INR'
    notes = doc.get('raw_notes') or {}
    if doc.get('plan') != 'standard' or notes.get('rate') or int(doc.get('amount') or 0) != NEW_READER_PRICE.get(currency):
        return False
    previous = await _db.payments.find_one({
        'email': email, 'payment_id': {'$ne': pid},
        'plan': {'$in': ['standard', 'renewal', 'trial-upgrade', 'community-ftwtsop', '']},
        **PM.COUNTS_FOR_ACCESS,
    })
    grant = await PM.complimentary_grant_for(email)
    year_grant = bool(grant) and (grant.get('months') or 12) == 12
    if not previous and not year_grant:
        return False
    difference = NEW_READER_PRICE[currency] - RENEWAL_PRICE[currency]
    try:
        refund = await _razorpay_refund(pid, difference, 'overpaid', 'automatic')
    except Exception as e:
        await _log_failure(email, f'Automatic refund: paid the new-reader price ({pid})', repr(e)[:300])
        return True
    await _record_refund(doc, refund, 'overpaid', 'automatic', keeps_access=False)
    starts = await PM.renewal_access_from(email, paid_at, exclude_payment_id=pid)
    await _db.payments.update_one(
        {'payment_id': pid},
        {'$set': {'plan': 'renewal', 'access_from': starts, 'was_plan': 'standard'}},
    )
    logger.info(f'refunds: {pid} part-refunded {difference}, {email} is a returning member; now a renewal')
    subject, html = _overpaid_email(
        money(NEW_READER_PRICE[currency], currency), money(RENEWAL_PRICE[currency], currency),
        money(difference, currency), _date(starts) if starts > paid_at else '',
    )
    await send_email(to=email, subject=subject, html=html)
    return True


# ─── Refunds made in Razorpay's own dashboard ────────────────────────────────

async def sync_from_razorpay(payment_id: str) -> Optional[dict]:
    """Reads a payment's refunds from Razorpay and brings our row in step.
    Called by the webhook's refund.* events."""
    if _db is None or _razorpay_client is None or not payment_id:
        return None
    doc = await _db.payments.find_one({'payment_id': payment_id})
    if not doc:
        return None
    try:
        payment = await asyncio.to_thread(_razorpay_client.payment.fetch, payment_id)
        items = (await asyncio.to_thread(_razorpay_client.payment.fetch_multiple_refund, payment_id)).get('items') or []
    except Exception as e:
        logger.warning(f'refunds: Razorpay lookup failed for {payment_id}: {e!r}')
        return None
    ours = {r.get('refund_id'): r for r in (doc.get('refunds') or [])}
    merged = []
    for item in items:
        mine = ours.get(item.get('id')) or {}
        merged.append({
            'refund_id': item.get('id'), 'amount': int(item.get('amount') or 0),
            'reason': mine.get('reason') or (item.get('notes') or {}).get('reason') or 'other',
            'by': mine.get('by') or 'razorpay',
            'status': item.get('status') or 'pending',
            'at': mine.get('at') or (datetime.fromtimestamp(item['created_at'], tz=timezone.utc)
                                     if item.get('created_at') else datetime.now(timezone.utc)),
        })
    refunded = sum(r['amount'] for r in merged if r['status'] != 'failed')
    full = refunded >= int(doc.get('amount') or 0) or payment.get('status') == 'refunded'
    status = 'refunded' if full else ('partially_refunded' if refunded else 'captured')
    await _db.payments.update_one(
        {'payment_id': payment_id},
        {'$set': {'refunds': merged, 'amount_refunded': refunded, 'status': status}},
    )
    for r in merged:
        if r['status'] == 'failed' and ours.get(r['refund_id'], {}).get('status') != 'failed':
            await _log_failure(doc.get('email', ''), f'Refund failed ({payment_id})',
                               f'Razorpay could not refund {money(r["amount"], doc.get("currency") or "INR")}')
    return {'status': status, 'amount_refunded': refunded}


# ─── Dashboard ───────────────────────────────────────────────────────────────

def _row(doc: dict) -> dict:
    currency = doc.get('currency') or 'INR'
    amount = int(doc.get('amount') or 0)
    refunded = int(doc.get('amount_refunded') or 0)
    plan = doc.get('plan') or ''
    difference = None
    if plan == 'standard' and amount == NEW_READER_PRICE.get(currency) and not refunded:
        difference = NEW_READER_PRICE[currency] - RENEWAL_PRICE[currency]
    return {
        'payment_id': doc.get('payment_id'), 'email': doc.get('email'), 'plan': plan,
        'amount': amount, 'currency': currency, 'paid_at': PM._iso(doc.get('razorpay_created_at')),
        'amount_refunded': refunded, 'refundable': max(amount - refunded, 0),
        'status': doc.get('status') or 'captured',
        'refunds': [{**r, 'at': PM._iso(r.get('at'))} for r in (doc.get('refunds') or [])],
        'renewal_difference': difference,
        # The Ten keeps its stories either way; teams are managed in the Sheet.
        'can_end_access': plan in ('standard', 'renewal', 'trial-upgrade', 'student', 'community-ftwtsop', ''),
        'is_razorpay': (doc.get('payment_id') or '').startswith('pay_'),
    }


@router.get('/api/admin/refunds/lookup')
async def lookup(q: str, _admin: None = Depends(require_admin_key_or_session)):
    q = (q or '').strip()
    if _db is None or not q:
        return {'payments': []}
    query = {'payment_id': q} if q.startswith('pay_') else {'email': q.lower()}
    docs = await _db.payments.find(query).sort('razorpay_created_at', -1).to_list(length=100)
    return {'payments': [_row(d) for d in docs]}


class RefundBody(BaseModel):
    payment_id: str
    amount: Optional[int] = None  # minor units; None means everything still refundable
    reason: str = 'asked'
    end_access: bool = False
    notify: bool = True


@router.post('/api/admin/refunds')
async def refund(body: RefundBody, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None or _razorpay_client is None:
        raise HTTPException(status_code=503, detail='Refunds need Razorpay and the database, and one of them is not set up.')
    doc = await _db.payments.find_one({'payment_id': body.payment_id})
    if not doc:
        raise HTTPException(status_code=404, detail='No payment with that ID.')
    if not body.payment_id.startswith('pay_'):
        raise HTTPException(status_code=400, detail='Only Razorpay payments can be refunded from here.')
    row = _row(doc)
    amount = row['refundable'] if body.amount is None else int(body.amount)
    if amount <= 0 or amount > row['refundable']:
        raise HTTPException(status_code=400, detail=f'You can refund up to {money(row["refundable"], row["currency"])} on this payment.')
    reason = body.reason if body.reason in REASONS else 'other'
    full = amount == row['refundable']
    end_access = body.end_access and full and row['can_end_access']
    lock = await _db.payments.update_one(
        {'payment_id': body.payment_id, 'refund_lock': {'$ne': True}}, {'$set': {'refund_lock': True}},
    )
    if not getattr(lock, 'modified_count', 0):
        raise HTTPException(status_code=409, detail='A refund for this payment is already going through.')
    try:
        try:
            refund_obj = await _razorpay_refund(body.payment_id, amount, reason, 'dashboard')
        except Exception as e:
            raise HTTPException(status_code=502, detail=f'Razorpay did not take the refund: {str(e)[:200]}')
        entry = await _record_refund(doc, refund_obj, reason, 'dashboard', keeps_access=full and not end_access)
    finally:
        await _db.payments.update_one({'payment_id': body.payment_id}, {'$unset': {'refund_lock': ''}})
    access_note = ''
    if end_access:
        access_note = await _end_access(doc.get('email') or '', doc.get('plan') or 'standard')
    elif full:
        access_note = 'Their access stays as it is.'
    emailed = False
    if body.notify and doc.get('email'):
        thing = _PLAN_NAME.get(_SAME_THING.get(row['plan'], 'annual'), 'your membership')
        ended = access_note == 'Ended their membership.'
        subject, html = _manual_email(money(amount, row['currency']), _date(doc.get('razorpay_created_at')), thing, ended)
        emailed = await send_email(to=doc['email'], subject=subject, html=html)
    return {
        'refunded': amount, 'display': money(amount, row['currency']), 'status': entry['status'],
        'access': access_note, 'emailed': emailed,
    }


@router.get('/api/admin/refunds/recent')
async def recent(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'refunds': []}
    since = datetime.now(timezone.utc) - timedelta(days=60)
    out = []
    async for doc in _db.payments.find({'refunds.0': {'$exists': True}}):
        for r in doc.get('refunds') or []:
            at = _utc(r.get('at'))
            if at and at >= since:
                out.append({
                    'payment_id': doc.get('payment_id'), 'email': doc.get('email'),
                    'plan': doc.get('was_plan') or doc.get('plan'), 'amount': r.get('amount'),
                    'currency': doc.get('currency') or 'INR', 'reason': REASONS.get(r.get('reason'), 'Other'),
                    'by': r.get('by'), 'status': r.get('status'), 'at': PM._iso(at),
                })
    out.sort(key=lambda r: r['at'] or '', reverse=True)
    return {'refunds': out}


async def automatic_this_week() -> list:
    """For Today: automatic refunds in the last 7 days."""
    if _db is None:
        return []
    since = datetime.now(timezone.utc) - timedelta(days=7)
    out = []
    async for doc in _db.payments.find({'refunds.by': 'automatic'}):
        for r in doc.get('refunds') or []:
            if r.get('by') == 'automatic' and _utc(r.get('at')) and _utc(r.get('at')) >= since:
                out.append({'email': doc.get('email'), 'reason': REASONS.get(r.get('reason'), 'Other'),
                            'display': money(r.get('amount'), doc.get('currency') or 'INR'),
                            'at': PM._iso(r.get('at'))})
    return out
