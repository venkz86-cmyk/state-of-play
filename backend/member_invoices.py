"""GST invoices for members, one per payment, from the payments ledger.

The old self-serve invoice (server.py, until October 2026) took its date
from when the reader's Ghost account was created and charged everyone
₹2,499 + GST, so a renewer downloaded last year's invoice at last year's
price, and the number came from the member's position in a Ghost listing.
Here everything comes from the payment itself: the date it was paid, what
was paid (less any refund), the Razorpay payment id, and the membership
period it bought (a renewal's year starts when the previous one ends).

Numbers are a new series, TSOP/<FY>/B0001 upwards, so they can never
repeat a number the old scheme already issued. Each payment gets its
number once and keeps it: downloading again, even with corrected billing
details, gives the same number and date.

Only the signed-in reader can list or download, and only for payments
they made. A gift's invoice belongs to the person who bought it, not the
person it was for.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from invoice_generator import fiscal_year, validate_gstin, build_invoice_pdf
from payments import compute_synthetic_expiry

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


IST = timezone(timedelta(hours=5, minutes=30))
SERIES = 'B'
SELLER_STATE = '29'
# Team plans have their own invoice on /teams/manage.
TEAM_PLANS = ('team-5', 'team-10')
DESCRIPTIONS = {
    'standard': 'The State of Play, annual membership',
    'unknown': 'The State of Play, annual membership',
    'renewal': 'The State of Play, annual membership (renewal)',
    'trial-upgrade': 'The State of Play, annual membership (upgrade from The Ten)',
    'student': 'The State of Play, student membership',
    'trial': 'The Ten, 30 days of The State of Play',
}
SHORT_NAMES = {
    'standard': 'Annual membership', 'unknown': 'Annual membership',
    'renewal': 'Renewal', 'trial-upgrade': 'Upgrade from The Ten',
    'student': 'Student membership', 'trial': 'The Ten',
}
TRIAL_DAYS = 30
GIFT_DAYS = 365

INDIAN_STATES = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
    "37": "Andhra Pradesh", "38": "Ladakh",
}


# ─── dates ──────────────────────────────────────────────────────────────────
def _aware(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _day(dt: Optional[datetime]) -> str:
    # Invoices are Indian documents: dates are the day in India.
    return dt.astimezone(IST).strftime('%B %-d, %Y') if dt else ''


# ─── who paid, for what ─────────────────────────────────────────────────────
def _is_gift(doc: dict) -> bool:
    notes = doc.get('raw_notes') or {}
    return bool(notes.get('gifted_by') or notes.get('gift_code')
                or str(doc.get('source') or '').startswith('gift_subscription'))


async def _gift_record(payment_id: str) -> Optional[dict]:
    if _db is None:
        return None
    return await _db.gift_subscriptions.find_one({'razorpay_payment_id': payment_id})


async def _payer(doc: dict) -> tuple[str, Optional[dict]]:
    """(payer email, gift record or None). A gift's payer is its buyer:
    a direct gift is filed under the recipient with gifted_by in its
    notes; a code's payment sits under the buyer until it's redeemed,
    then moves to whoever redeemed it."""
    email = (doc.get('email') or '').lower().strip()
    if not _is_gift(doc):
        return email, None
    notes = doc.get('raw_notes') or {}
    gift = await _gift_record(doc.get('payment_id'))
    buyer = (notes.get('gifted_by') or (gift or {}).get('buyer_email') or email).lower().strip()
    return buyer, gift


def _paid_at(doc: dict) -> Optional[datetime]:
    # A gift's razorpay_created_at is moved to when the recipient's year
    # starts; when it was recorded is when it was paid.
    if _is_gift(doc):
        return _aware(doc.get('created_at')) or _aware(doc.get('razorpay_created_at'))
    return _aware(doc.get('razorpay_created_at'))


def _net_minor(doc: dict) -> Optional[int]:
    if doc.get('amount') is None:
        return None
    return int(doc.get('amount') or 0) - int(doc.get('amount_refunded') or 0)


def _what(doc: dict, gift: Optional[dict]) -> dict:
    """Description, period and a short name for one payment."""
    plan = doc.get('plan') or 'unknown'
    paid = _paid_at(doc)
    if _is_gift(doc):
        notes = doc.get('raw_notes') or {}
        recipient = (doc.get('email') or '').lower().strip()
        code = notes.get('gift_code') or (gift or {}).get('code')
        unredeemed = gift is not None and gift.get('status') == 'unredeemed'
        if unredeemed or (code and recipient == ((gift or {}).get('buyer_email') or '').lower()):
            return {'description': 'The State of Play, one year given as a gift',
                    'period_line': f'Gift code {code}, one year from when it is redeemed',
                    'short': 'Gift'}
        start = _aware(doc.get('razorpay_created_at'))
        end = start + timedelta(days=GIFT_DAYS) if start else None
        return {'description': f'The State of Play, one year given as a gift to {recipient}',
                'period_start': _day(start), 'period_end': _day(end), 'short': f'Gift for {recipient}'}
    if plan == 'trial':
        end = paid + timedelta(days=TRIAL_DAYS) if paid else None
        return {'description': DESCRIPTIONS['trial'], 'period_start': _day(paid), 'period_end': _day(end),
                'short': SHORT_NAMES['trial']}
    start = _aware(doc.get('access_from')) or paid
    end = _aware(compute_synthetic_expiry({
        'plan': plan, 'razorpay_created_at': doc.get('razorpay_created_at'), 'access_from': doc.get('access_from'),
    }))
    return {'description': DESCRIPTIONS.get(plan, DESCRIPTIONS['standard']),
            'period_start': _day(start), 'period_end': _day(end),
            'short': SHORT_NAMES.get(plan, 'Membership')}


def _blocked(doc: dict) -> str:
    """Why this payment can't have an invoice here, or ''."""
    if doc.get('plan') in TEAM_PLANS:
        return 'Team invoices are on your team page.'
    if doc.get('status') == 'refunded':
        return 'Refunded.'
    net = _net_minor(doc)
    if net is None:
        return 'We need to check this payment. Write to venkat@stateofplay.club for its invoice.'
    if net <= 0:
        return 'Refunded.'
    if (doc.get('currency') or 'INR') not in ('INR', 'USD'):
        return 'Write to venkat@stateofplay.club for this invoice.'
    if not _paid_at(doc):
        return 'Write to venkat@stateofplay.club for this invoice.'
    return ''


async def payments_for(email: str) -> list[dict]:
    """Every payment this person made, newest first: their own, plus gifts
    they bought (wherever the gift's payment is filed now)."""
    if _db is None or not email:
        return []
    email = email.lower().strip()
    seen, docs = set(), []

    async def add(cursor):
        async for d in cursor:
            if d.get('payment_id') and d['payment_id'] not in seen:
                seen.add(d['payment_id']); docs.append(d)

    await add(_db.payments.find({'email': email}))
    await add(_db.payments.find({'raw_notes.gifted_by': email}))
    async for g in _db.gift_subscriptions.find({'buyer_email': email}):
        pid = g.get('razorpay_payment_id')
        if pid and pid not in seen:
            d = await _db.payments.find_one({'payment_id': pid})
            if d:
                seen.add(pid); docs.append(d)
    mine = []
    for d in docs:
        payer, _ = await _payer(d)
        if payer == email:
            mine.append(d)
    mine.sort(key=lambda d: _paid_at(d) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return mine


# ─── money ──────────────────────────────────────────────────────────────────
def _major(minor: int) -> Decimal:
    return (Decimal(minor) / 100).quantize(Decimal('0.01'))


def amounts(net_minor: int, currency: str, state_code: Optional[str]) -> dict:
    """Split what was paid into taxable value and tax, in rupees (or
    dollars). Prices are set as whole rupees plus 18% GST, and Razorpay
    charges whole rupees, so the taxable value is the whole-rupee price
    (₹3,539 paid → ₹2,999) and any paise left over show as a round off."""
    total = _major(net_minor)
    if currency != 'INR':
        return {'taxable': total, 'tax': {'cgst': 0, 'sgst': 0, 'igst': 0, 'round_off': Decimal('0'),
                                          'total': total, 'is_export': True,
                                          'tax_label': 'Export under LUT, no GST charged'}}
    taxable = (total / Decimal('1.18')).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    nine = (taxable * Decimal('0.09')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if state_code == SELLER_STATE:
        cgst = sgst = nine; igst = Decimal('0')
    else:
        cgst = sgst = Decimal('0'); igst = (taxable * Decimal('0.18')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    round_off = total - taxable - cgst - sgst - igst
    return {'taxable': taxable, 'tax': {'cgst': cgst, 'sgst': sgst, 'igst': igst, 'round_off': round_off,
                                        'total': total, 'is_export': False, 'tax_label': None}}


# ─── numbers ────────────────────────────────────────────────────────────────
async def _existing(payment_id: str) -> Optional[dict]:
    return await _db.payment_invoices.find_one({'payment_id': payment_id})


async def _number_for(payment_id: str, issued_at: datetime, email: str) -> dict:
    """The invoice record for this payment, numbering it the first time.
    The record is claimed before a number is taken, so two clicks at once
    can't use up two numbers (no gaps in the series)."""
    try:
        await _db.payment_invoices.create_index('payment_id', unique=True)
    except Exception as e:
        logger.warning(f'payment_invoices index ensure failed (non-fatal): {e!r}')
    for _ in range(3):
        rec = await _existing(payment_id)
        if rec and rec.get('invoice_number'):
            return rec
        if rec is None:
            claim = uuid.uuid4().hex
            try:
                await _db.payment_invoices.insert_one({
                    'payment_id': payment_id, 'email': email, 'claim': claim,
                    'claimed_at': datetime.now(timezone.utc),
                })
            except Exception:
                await asyncio.sleep(0.5)
                continue  # someone else claimed it; read theirs
            fy = fiscal_year(issued_at.astimezone(IST))
            counter = await _db.invoice_counters.find_one_and_update(
                {'_id': f'{SERIES}-{fy}'}, {'$inc': {'seq': 1}}, upsert=True, return_document=True,
            )
            number = f"TSOP/{fy}/{SERIES}{int(counter['seq']):04d}"
            await _db.payment_invoices.update_one(
                {'payment_id': payment_id, 'claim': claim},
                {'$set': {'invoice_number': number, 'fy': fy, 'issued_at': issued_at}},
            )
            logger.info(f'invoice {number} issued for payment {payment_id} ({email})')
            return await _existing(payment_id)
        # Claimed but not numbered yet: wait for the other request, and
        # take over a claim abandoned for over a minute.
        await asyncio.sleep(0.5)
        claimed_at = _aware(rec.get('claimed_at'))
        if claimed_at and datetime.now(timezone.utc) - claimed_at > timedelta(minutes=1):
            await _db.payment_invoices.delete_one({'payment_id': payment_id, 'claim': rec.get('claim'),
                                                    'invoice_number': {'$exists': False}})
    raise HTTPException(status_code=503, detail='Could not number this invoice. Try again in a minute.')


# ─── endpoints ──────────────────────────────────────────────────────────────
def _session_email(request: Request) -> str:
    from session_auth import _read_session
    session = _read_session(request)
    if not session or not session.get('email'):
        raise HTTPException(status_code=401, detail='Sign in to download your invoice.')
    return session['email'].lower().strip()


@router.get('/api/invoice/payments')
async def list_invoice_payments(request: Request):
    """The signed-in reader's payments, each with whether it can have an
    invoice and its number if it already has one, plus the billing details
    they used last time (to fill the form in)."""
    email = _session_email(request)
    if _db is None:
        raise HTTPException(status_code=503, detail='Invoices are unavailable right now. Try again in a few minutes.')
    out = []
    for d in await payments_for(email):
        payer, gift = await _payer(d)
        what = _what(d, gift)
        rec = await _existing(d['payment_id'])
        out.append({
            'payment_id': d['payment_id'],
            'name': what['short'],
            'paid_on': _paid_at(d).isoformat() if _paid_at(d) else None,
            'paid_on_day': _day(_paid_at(d)),
            # What they paid; a refunded payment shows what it was, marked refunded.
            'amount': _net_minor(d) if (_net_minor(d) or 0) > 0 else d.get('amount'),
            'currency': d.get('currency') or 'INR',
            'period_start': what.get('period_start'), 'period_end': what.get('period_end'),
            'invoice_number': (rec or {}).get('invoice_number'),
            'blocked': _blocked(d),
        })
    billing = await _db.invoice_billing.find_one({'email': email}) or {}
    return {
        'payments': out,
        'billing': {k: billing.get(k) for k in ('legal_name', 'gstin', 'address', 'state_code')} if billing else None,
    }


class InvoiceDownloadRequest(BaseModel):
    payment_id: str = Field(..., min_length=4, max_length=100)
    legal_name: str = Field(..., min_length=2, max_length=200)
    gstin: Optional[str] = None
    address: str = Field(..., min_length=5, max_length=500)
    state_code: Optional[str] = None


@router.post('/api/invoice/download')
async def download_invoice(req: InvoiceDownloadRequest, request: Request):
    email = _session_email(request)
    if _db is None:
        raise HTTPException(status_code=503, detail='Invoices are unavailable right now. Try again in a few minutes.')
    doc = await _db.payments.find_one({'payment_id': req.payment_id})
    if not doc:
        raise HTTPException(status_code=404, detail='We could not find that payment.')
    payer, gift = await _payer(doc)
    if payer != email:
        raise HTTPException(status_code=404, detail='We could not find that payment.')
    blocked = _blocked(doc)
    if blocked:
        raise HTTPException(status_code=409, detail=blocked)

    currency = doc.get('currency') or 'INR'
    gstin = (req.gstin or '').strip().upper() or None
    state_code = (req.state_code or '').strip() or None
    if currency == 'INR':
        if gstin and not validate_gstin(gstin):
            raise HTTPException(status_code=400, detail='That GSTIN is not in the right format. It has 15 characters, like 29ABCDE1234F1Z5.')
        if gstin and not state_code:
            state_code = gstin[:2]
        if state_code not in INDIAN_STATES:
            raise HTTPException(status_code=400, detail='Choose your state.')
        if gstin and gstin[:2] != state_code:
            raise HTTPException(status_code=400, detail=f'Your GSTIN is registered in {INDIAN_STATES.get(gstin[:2], "another state")}. Choose that state.')
    else:
        gstin, state_code = None, None

    issued_at = _paid_at(doc)
    rec = await _number_for(doc['payment_id'], issued_at, email)
    issued_at = _aware(rec.get('issued_at')) or issued_at
    buyer = {'legal_name': req.legal_name.strip(), 'gstin': gstin, 'address': req.address.strip(), 'state_code': state_code}
    await _db.payment_invoices.update_one({'payment_id': doc['payment_id']},
                                          {'$set': {'buyer': buyer, 'last_downloaded_at': datetime.now(timezone.utc)}})
    await _db.invoice_billing.update_one({'email': email}, {'$set': {**buyer, 'email': email}}, upsert=True)

    what = _what(doc, gift)
    money = amounts(_net_minor(doc), currency, state_code)
    pdf = build_invoice_pdf({
        'invoice_number': rec['invoice_number'],
        'issued_at': issued_at.astimezone(IST),
        'buyer': {
            'name': buyer['legal_name'], 'gstin': gstin, 'address': buyer['address'],
            'state_name': INDIAN_STATES.get(state_code or '', 'Outside India'),
            'state_code': state_code or '96',
            'is_international': currency != 'INR',
        },
        'description_override': what['description'],
        'period_start': what.get('period_start'), 'period_end': what.get('period_end'),
        'period_line': what.get('period_line'),
        'paid_on': _day(_paid_at(doc)),
        'razorpay_ref': doc['payment_id'],
        'currency': currency,
        'taxable_value': money['taxable'],
        'tax': money['tax'],
    })
    filename = rec['invoice_number'].replace('/', '-')
    return Response(content=pdf, media_type='application/pdf',
                    headers={'Content-Disposition': f'attachment; filename="{filename}.pdf"'})
