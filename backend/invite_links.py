"""
invite_links.py — private invite links for a first year at the old price.

Venkat makes a link in the dashboard for one person ("Rohan") or for an
event (named by Venkat), with an optional cap on how many
people can use it and an optional last day. Whoever opens it gets a year
at the pre-October 6 price (razorpay_orders.PLAN_PRICING['standard']:
₹2,499 + GST, or $120). A year later they renew at the normal renewal
rate like any member; nothing here touches renewals.

A link can also be made for one email address: it then works once, for
that address only, and the person is emailed the link with a note from
Venkat. Event links have no email and come with a QR code in the
dashboard.

Links are never listed anywhere public. The page at /invite/<code> only
learns whether the code works, never its name or who used it.

Provides:
  * GET  /api/invites/{code}                — public: can this link be used?
  * GET  /api/admin/invites                 — admin: every link, with uses
  * POST /api/admin/invites                 — admin: make a link
  * POST /api/admin/invites/{code}/close    — admin: stop a link working

Used by razorpay_orders.create_order (invite_usable) and verify_payment
(record_invite_use).

Datastore: Mongo `invite_links`.
"""
from __future__ import annotations

import logging
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from admin_auth import require_admin_key_or_session
from email_layout import email_cta_button, email_shell
from resend_email import send_email

logger = logging.getLogger(__name__)

router = APIRouter()
_db = None

IST = timezone(timedelta(hours=5, minutes=30))
_ALPHABET = string.ascii_lowercase + string.digits
SITE_URL = 'https://www.stateofplay.club'


def init(db_handle):
    global _db
    _db = db_handle


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value) -> Optional[datetime]:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _iso(value) -> Optional[str]:
    value = _aware(value)
    return value.isoformat() if value else None


def _clean_code(code: str) -> str:
    code = (code or '').strip().lower()
    return code if code and len(code) <= 32 and all(c in _ALPHABET for c in code) else ''


def _state(doc: Optional[dict], now: Optional[datetime] = None) -> str:
    """'open', or why the link no longer works."""
    if not doc:
        return 'unknown'
    now = now or _now()
    if doc.get('closed'):
        return 'closed'
    expires = _aware(doc.get('expires_at'))
    if expires and now >= expires:
        return 'expired'
    cap = doc.get('max_uses')
    if cap and len(doc.get('uses') or []) >= cap:
        return 'full'
    return 'open'


async def invite_usable(code: str) -> Optional[dict]:
    """The link, if it can be used right now; otherwise None."""
    code = _clean_code(code)
    if _db is None or not code:
        return None
    doc = await _db.invite_links.find_one({'code': code})
    return doc if _state(doc) == 'open' else None


async def record_invite_use(code: str, email: str, payment_id: str) -> None:
    """Counts a paid use. Never raises: a payment must not fail over this.
    A payment already counted (a retried verify) isn't counted twice."""
    code = _clean_code(code)
    if _db is None or not code:
        return
    try:
        await _db.invite_links.update_one(
            {'code': code, 'uses.payment_id': {'$ne': payment_id}},
            {'$push': {'uses': {'email': (email or '').lower().strip(), 'payment_id': payment_id, 'at': _now()}}},
        )
    except Exception as e:
        logger.warning(f'invite use not recorded for {code}: {e!r}')


# Lookups of /invite/<code> are rate-limited per IP so codes can't be
# guessed by trying many: burst 10, then one more every 30 seconds.
_BUCKET: dict = {}


def _allow(ip: str) -> bool:
    now = time.monotonic()
    tokens, last = _BUCKET.get(ip, (10.0, now))
    tokens = min(10.0, tokens + (now - last) / 30)
    if tokens < 1:
        _BUCKET[ip] = (tokens, now)
        return False
    _BUCKET[ip] = (tokens - 1, now)
    return True


@router.get('/api/invites/{code}')
async def check_invite(code: str, request: Request):
    ip = (request.headers.get('x-forwarded-for', '').split(',')[0].strip()
          or (request.client.host if request.client else '0.0.0.0'))
    if not _allow(ip):
        raise HTTPException(status_code=429, detail='Too many tries. Wait a minute and try again.')
    code = _clean_code(code)
    doc = await _db.invite_links.find_one({'code': code}) if (_db is not None and code) else None
    state = _state(doc)
    return {
        'state': state if state in ('open', 'expired', 'full', 'closed') else 'unknown',
        'expires_at': _iso(doc.get('expires_at')) if doc and state == 'open' else None,
        # A one-person link is checked out under its own address; only
        # the person holding the link sees it.
        'email': (doc.get('email') or '') if doc and state == 'open' else '',
    }


class InviteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    # Empty for no cap; 1 for a one-person link.
    max_uses: Optional[int] = Field(None, ge=1, le=10000)
    # Last day the link works, 'YYYY-MM-DD' (India time, to the end of that day).
    last_day: Optional[str] = None
    # For one person: the link works once, for this address only, and is
    # emailed to them with an optional line from Venkat.
    email: Optional[EmailStr] = None
    note: str = Field('', max_length=400)


def invite_url(code: str) -> str:
    return f'{SITE_URL}/invite/{code}'


def first_name(name: str) -> str:
    return (name or '').strip().split(' ')[0].rstrip(',') or 'there'


def long_date(dt: datetime) -> str:
    return f'{dt.strftime("%B")} {dt.day}, {dt.year}'


INVITE_SUBJECT = 'An invitation to The State of Play'


def invite_email_html(name: str, code: str, note: str = '', expires_at: Optional[datetime] = None) -> str:
    """Venkat's copy, proofread."""
    personal = f'<p>{escape(note.strip())}</p>' if note and note.strip() else ''
    last_day = ''
    if expires_at:
        last = _aware(expires_at).astimezone(IST) - timedelta(seconds=1)
        last_day = f' It’s open until {long_date(last)}.'
    return email_shell(
        'An invitation to <em style="font-style: italic;">The State of Play.</em>',
        (
            f'<p>Hi {escape(first_name(name))},</p>'
            + personal
            + '<p>I’d like you to read The State of Play. This invitation gives you your first year at the price our '
            'first readers paid: ₹2,499 + GST (₹2,949 in all), or $120 outside India. New readers now pay '
            '₹3,499 + GST, or $169.</p>'
            f'<p>The link is yours alone and works once.{last_day}</p>'
            + email_cta_button('Accept the invitation', invite_url(code))
            + '<p>Every week there’s one reported story on the business of Indian sport, usually on a Friday, and '
            'the full archive is yours from the first day. It’s one payment for the year, and nothing renews on '
            'its own.</p>'
        ),
    )


def _serialize(doc: dict) -> dict:
    uses = doc.get('uses') or []
    return {
        'code': doc['code'],
        'name': doc.get('name', ''),
        'max_uses': doc.get('max_uses'),
        'expires_at': _iso(doc.get('expires_at')),
        'created_at': _iso(doc.get('created_at')),
        'used': len(uses),
        'uses': [{'email': u.get('email', ''), 'at': _iso(u.get('at'))} for u in uses],
        'state': _state(doc),
        'email': doc.get('email') or '',
        'email_sent': doc.get('email_sent'),
        'url': invite_url(doc['code']),
    }


@router.get('/api/admin/invites')
async def list_invites(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'invites': []}
    docs = await _db.invite_links.find({}).sort('created_at', -1).to_list(length=500)
    return {'invites': [_serialize(d) for d in docs]}


@router.post('/api/admin/invites')
async def create_invite(req: InviteCreate, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Invites unavailable')
    expires_at = None
    if req.last_day:
        try:
            day = datetime.strptime(req.last_day, '%Y-%m-%d').replace(tzinfo=IST)
        except ValueError:
            raise HTTPException(status_code=400, detail='Last day must be a date.')
        expires_at = (day + timedelta(days=1)).astimezone(timezone.utc)
        if expires_at <= _now():
            raise HTTPException(status_code=400, detail='The last day has already passed.')
    try:
        await _db.invite_links.create_index('code', unique=True)
    except Exception as e:
        logger.warning(f'invite index ensure failed (non-fatal): {e!r}')
    email = (str(req.email) if req.email else '').lower().strip()
    doc = {
        'code': ''.join(secrets.choice(_ALPHABET) for _ in range(10)),
        'name': ' '.join(req.name.split()),
        # A one-person link works once.
        'max_uses': 1 if email else req.max_uses,
        'expires_at': expires_at,
        'created_at': _now(),
        'uses': [],
        'closed': False,
        'email': email,
    }
    await _db.invite_links.insert_one(doc)
    if email:
        sent = await send_email(
            to=email, subject=INVITE_SUBJECT,
            html=invite_email_html(doc['name'], doc['code'], req.note, expires_at),
        )
        doc['email_sent'] = bool(sent)
        await _db.invite_links.update_one({'code': doc['code']}, {'$set': {'email_sent': bool(sent)}})
    return _serialize(doc)


@router.post('/api/admin/invites/{code}/close')
async def close_invite(code: str, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Invites unavailable')
    result = await _db.invite_links.update_one({'code': _clean_code(code)}, {'$set': {'closed': True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Link not found')
    return {'success': True}
