"""
complimentary.py — complimentary annual memberships Venkat gives by hand.

Admin → Tools → Give a complimentary year. One record per email in
`complimentary_grants`:
  {email, name, granted_at, ends_at, note, ghost_comp, history}

Access comes from the 'complimentary' Ghost label (tiers.PAID_LABELS), so
it works whether or not Ghost's own comp could be set. Ghost's comp (a
paid tier with expiry_at = ends_at) is attempted too, so Ghost's own
free/paid lists stay right; the Admin API call for it hasn't been run
against the live Ghost before, so a failure is reported back to the
dashboard ("comp them in Ghost by hand") rather than treated as fatal.

The end of the year is annual_renewal.py's job: the complimentary-year
letter 14 days before, the lapsed note on the day, and the label coming
off a week later (complimentary_sweep below, called from the sweep).
A renewal in the meantime starts when the free year ends
(payments.renewal_access_from).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from admin_auth import require_admin_key_or_session
from tiers import ensure_member_labeled, find_ghost_member, remove_member_label
from resend_email import send_email
from email_layout import email_shell, email_cta_button

logger = logging.getLogger(__name__)

router = APIRouter()
_db = None

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
LABEL = 'complimentary'
YEAR_DAYS = 365
ENDING_SOON_DAYS = 30
SIGN_IN_URL = 'https://www.stateofplay.club/login'
SIGNUP_URL = 'https://www.stateofplay.club/signup?ref=complimentary'
# The lengths Venkat can give, in months. A year ends with the ₹2,999
# renewal offer; the shorter ones end with the new-reader price, and a
# month gets its ending letter 7 days out instead of 14.
LENGTHS = {1: 'month', 3: 'three months', 6: 'six months', 12: 'year'}
SHORT_LETTER_DAYS = 7


def months_of(grant: dict) -> int:
    return grant.get('months') or 12


def add_length(start: datetime, months: int) -> datetime:
    """A year is 365 days, like a paid one; shorter lengths are calendar
    months (7 Oct + 3 months = 7 Jan, 31 Jan + 1 month = 28 Feb)."""
    if months == 12:
        return start + timedelta(days=YEAR_DAYS)
    month_index = start.month - 1 + months
    year, month = start.year + month_index // 12, month_index % 12 + 1
    for day in (start.day, 30, 29, 28):
        try:
            return start.replace(year=year, month=month, day=day)
        except ValueError:
            continue
    return start + timedelta(days=30 * months)


def init(db_handle):
    global _db
    _db = db_handle


def _create_ghost_admin_token() -> Optional[str]:
    if not GHOST_ADMIN_API_KEY or ':' not in GHOST_ADMIN_API_KEY:
        return None
    try:
        kid, secret = GHOST_ADMIN_API_KEY.split(':', 1)
        iat = int(datetime.now(timezone.utc).timestamp())
        payload = {'iat': iat, 'exp': iat + 5 * 60, 'aud': '/admin/'}
        return jwt.encode(payload, bytes.fromhex(secret), algorithm='HS256', headers={'kid': kid})
    except Exception as e:
        logger.warning(f'Ghost admin token failed: {e!r}')
        return None


def _aware(value) -> Optional[datetime]:
    if not value:
        return None
    dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def first_name(name: str) -> str:
    return (name or '').strip().split(' ')[0] or 'reader'


def long_date(dt: datetime) -> str:
    return f'{dt.day} {dt.strftime("%B %Y")}'


# ─── Emails (Venkat's copy, proofread) ──────────────────────────────────────

WELCOME_LINE = {
    1: 'I’ve set up a complimentary month of The State of Play for you.',
    3: 'I’ve set up three complimentary months of The State of Play for you.',
    6: 'I’ve set up six complimentary months of The State of Play for you.',
    12: 'I’ve set up a complimentary year of The State of Play for you.',
}
WELCOME_SUBJECT = {1: 'A month', 3: 'Three months', 6: 'Six months', 12: 'A year'}


def welcome_subject(months: int = 12) -> str:
    return f'{WELCOME_SUBJECT[months]} of The State of Play'


def welcome_email_html(name: str, ends_at: datetime, note: str = '', months: int = 12) -> str:
    personal = f'<p>{escape(note.strip())}</p>' if note and note.strip() else ''
    return email_shell(
        f'{WELCOME_SUBJECT[months]} of <em style="font-style: italic;">The State of Play.</em>',
        (
            f'<p>Dear {escape(first_name(name))},</p>'
            f'<p>{WELCOME_LINE[months]}</p>'
            '<p>You’ll receive one reported story a week about the business of Indian sport, usually on '
            'Fridays, with access to the full archive whenever you want to catch up.</p>'
            + personal
            + '<p>To start reading, go to stateofplay.club and sign in with this email address. We’ll send you a '
            'one-time code, so there is no password to remember.</p>'
            f'<p>Your complimentary membership runs until {long_date(ends_at)}. Nothing will be charged, now or '
            'later.</p>'
            + email_cta_button('Start reading &rarr;', SIGN_IN_URL)
        ),
    )


def ending_email_html(name: str, ends_at: datetime, renew_url: str) -> str:
    end = long_date(ends_at)
    return email_shell(
        f'Your year of <em style="font-style: italic;">The State of Play</em> ends on {end}.',
        (
            f'<p>Dear {escape(first_name(name))},</p>'
            f'<p>The year I gave you ends on {end}.</p>'
            '<p>If you’d like to keep reading, a second year is ₹2,999 + GST (₹3,539 in all), or $149 outside '
            'India. That’s the rate our first members renew at; new readers pay ₹3,499 + GST, or $169.</p>'
            '<p>The link below signs you in and takes you to your account, where you can renew. Renew before '
            f'{end} and the new year starts when this one ends.</p>'
            + email_cta_button('Renew for a second year &rarr;', renew_url)
        ),
    )


NEW_READER_PRICE = ('a year of The State of Play is ₹3,499 + GST (₹4,129 in all), or $169 outside India.')


def short_ending_email_html(name: str, ends_at: datetime, months: int) -> str:
    end = long_date(ends_at)
    period = 'The month I gave you ends' if months == 1 else f'The {LENGTHS[months]} I gave you end'
    return email_shell(
        f'Your complimentary membership <em style="font-style: italic;">ends on {end}.</em>',
        (
            f'<p>Dear {escape(first_name(name))},</p>'
            f'<p>{period} on {end}.</p>'
            f'<p>If you’d like to keep reading, {NEW_READER_PRICE}</p>'
            f'<p>Subscribe before {end} and your year starts when this one ends.</p>'
            + email_cta_button('Subscribe for a year &rarr;', SIGNUP_URL)
        ),
    )


def short_ended_email_html(name: str) -> str:
    return email_shell(
        'Your complimentary membership <em style="font-style: italic;">has ended.</em>',
        (
            f'<p>Dear {escape(first_name(name))},</p>'
            '<p>Your complimentary membership ended today, and you can still read everything for seven more '
            f'days. After that, {NEW_READER_PRICE}</p>'
            + email_cta_button('Subscribe for a year &rarr;', SIGNUP_URL)
        ),
    )


# ─── Ghost's own comp (best effort) ─────────────────────────────────────────

async def _set_ghost_comp(member_id: str, ends_at: datetime, token: str) -> bool:
    """Comps the member on Ghost's paid tier until ends_at, so Ghost's own
    paid list includes them and the comp lapses there by itself. Returns
    False (and logs why) on anything unexpected."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/admin/tiers/',
                params={'filter': 'type:paid+active:true', 'limit': 'all'},
                headers={'Authorization': f'Ghost {token}'},
            )
            tiers = (r.json() or {}).get('tiers') if r.status_code == 200 else None
            if not tiers:
                logger.warning(f'complimentary: no paid Ghost tier found ({r.status_code})')
                return False
            expiry = ends_at.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'tiers': [{'id': tiers[0]['id'], 'expiry_at': expiry}]}]},
                headers={'Authorization': f'Ghost {token}'},
            )
            if r.status_code != 200:
                logger.warning(f'complimentary: Ghost comp PUT {r.status_code} {r.text[:300]!r}')
                return False
            member = ((r.json() or {}).get('members') or [{}])[0]
            return member.get('status') == 'comped'
    except Exception as e:
        logger.warning(f'complimentary: Ghost comp failed: {e!r}')
        return False


# ─── Admin endpoints ────────────────────────────────────────────────────────

class GrantRequest(BaseModel):
    email: str
    name: str = ''
    note: str = ''
    months: int = 12


def _status(grant: dict, now: datetime, renewed: bool) -> str:
    ends_at = _aware(grant.get('ends_at'))
    if renewed:
        return 'renewed'
    if not ends_at or ends_at <= now:
        return 'ended'
    if ends_at - now <= timedelta(days=ENDING_SOON_DAYS):
        return 'ending soon'
    return 'active'


async def _renewed_since(email: str, since) -> bool:
    """Paid for a membership after the complimentary year was given."""
    since = _aware(since)
    if _db is None or not since:
        return False
    async for doc in _db.payments.find({'email': email, 'plan': {'$nin': ['trial', 'gift']}}):
        paid_at = _aware(doc.get('razorpay_created_at'))
        if paid_at and paid_at > since:
            return True
    return False


@router.post('/api/admin/complimentary')
async def grant_complimentary_year(req: GrantRequest, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    email = (req.email or '').lower().strip()
    if '@' not in email or '.' not in email.split('@')[-1] or ' ' in email:
        raise HTTPException(status_code=400, detail='Enter a valid email address.')
    if req.months not in LENGTHS:
        raise HTTPException(status_code=400, detail='Choose a month, three months, six months or a year.')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    member = await ensure_member_labeled(email, req.name.strip(), [LABEL], token)
    if not member or not member.get('id'):
        raise HTTPException(status_code=502, detail='Could not set up their Ghost account. Try again.')
    name = req.name.strip() or member.get('name') or ''

    now = datetime.now(timezone.utc)
    existing = await _db.complimentary_grants.find_one({'email': email})
    current_end = _aware(existing.get('ends_at')) if existing else None
    # Giving more time extends what they have instead of overlapping it.
    start = current_end if current_end and current_end > now else now
    ends_at = add_length(start, req.months)

    ghost_comp = await _set_ghost_comp(member['id'], ends_at, token)
    entry = {'granted_at': now, 'ends_at': ends_at, 'months': req.months, 'note': req.note.strip()}
    await _db.complimentary_grants.update_one(
        {'email': email},
        {'$set': {'email': email, 'name': name, 'ends_at': ends_at, 'ghost_comp': ghost_comp,
                  'ghost_member_id': member['id'], 'last_granted_at': now, 'months': req.months},
         '$setOnInsert': {'granted_at': now},
         '$push': {'history': entry}},
        upsert=True,
    )
    sent = await send_email(
        to=email, subject=welcome_subject(req.months),
        html=welcome_email_html(name, ends_at, req.note, req.months),
    )
    logger.info(f'complimentary: {email} until {ends_at.date()} (ghost comp {ghost_comp}, email {sent})')
    return {'email': email, 'name': name, 'ends_at': ends_at.isoformat(), 'ghost_comp': ghost_comp,
            'months': req.months,
            'email_sent': sent, 'extended': bool(current_end and current_end > now)}


@router.get('/api/admin/complimentary')
async def list_complimentary_years(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'grants': []}
    now = datetime.now(timezone.utc)
    grants = []
    async for g in _db.complimentary_grants.find({}):
        renewed = await _renewed_since(g['email'], g.get('last_granted_at') or g.get('granted_at'))
        ends_at = _aware(g.get('ends_at'))
        grants.append({
            'email': g['email'], 'name': g.get('name') or '',
            'granted_at': _aware(g.get('granted_at')).isoformat() if g.get('granted_at') else None,
            'ends_at': ends_at.isoformat() if ends_at else None,
            'ghost_comp': bool(g.get('ghost_comp')), 'status': _status(g, now, renewed),
            'months': months_of(g), 'length': LENGTHS.get(months_of(g), 'year'),
        })
    grants.sort(key=lambda g: g['ends_at'] or '')
    return {'grants': grants}


# ─── End of the year (called from annual_renewal's sweep) ───────────────────

async def complimentary_sweep(now: datetime, dry_run: bool, token: str, *, reminder_days: int,
                              grace_days: int, mint_link, notices) -> dict:
    """The complimentary-year version of the renewal sweep. Returns the
    people in each group (each marked complimentary=True) for the sweep's
    preview and counts. `notices` is the sweep's annual_renewal_notices
    collection, keyed by email and the year's end, so nobody is emailed
    twice; `mint_link(email, member_id)` is session_auth's renewal link."""
    out = {'letter': [], 'lapsed_note': [], 'downgrade': []}
    if _db is None:
        return out
    async for g in _db.complimentary_grants.find({}):
        email = g['email']
        ends_at = _aware(g.get('ends_at'))
        if not ends_at:
            continue
        days = (ends_at - now).total_seconds() / 86400
        months = months_of(g)
        if days > (SHORT_LETTER_DAYS if months == 1 else reminder_days):
            continue
        renewed = await _renewed_since(email, g.get('last_granted_at') or g.get('granted_at'))
        person = {'email': email, 'name': g.get('name') or '', 'year_ends': ends_at.isoformat(),
                  'days': round(days, 1), 'still_comped': False, 'complimentary': True,
                  'length': LENGTHS.get(months, 'year')}

        if days <= -grace_days:
            # The label comes off even after a renewal: their paid labels
            # carry their access from here, and the renewal sweep looks
            # after that year.
            member = await find_ghost_member(email, token)
            labels = [(l.get('name') or '') for l in (member or {}).get('labels') or []]
            if member and LABEL in labels:
                if dry_run or await remove_member_label(member['id'], labels, LABEL, token):
                    out['downgrade'].append(person)
            continue
        if renewed:
            continue

        expiry_iso = ends_at.isoformat()
        notice = await notices.find_one({'email': email, 'expiry': expiry_iso}) or {}
        member_id = g.get('ghost_member_id') or ''
        renew_url = f'https://www.stateofplay.club/renew?t={mint_link(email, member_id)}&next=account'
        if days > 0:
            if notice.get('reminder_sent'):
                continue
            out['letter'].append(person)
            if not dry_run:
                if months == 12:
                    await send_email(to=email, subject=f'Your year of The State of Play ends on {long_date(ends_at)}',
                                     html=ending_email_html(g.get('name') or '', ends_at, renew_url))
                else:
                    await send_email(to=email, subject=f'Your complimentary membership ends on {long_date(ends_at)}',
                                     html=short_ending_email_html(g.get('name') or '', ends_at, months))
                await notices.update_one({'email': email, 'expiry': expiry_iso},
                                         {'$set': {'reminder_sent': now}}, upsert=True)
            continue
        if notice.get('grace_sent'):
            continue
        out['lapsed_note'].append(person)
        if not dry_run:
            if months == 12:
                from annual_renewal import _grace_email_html
                await send_email(to=email, subject='Your membership has lapsed', html=_grace_email_html(renew_url))
            else:
                await send_email(to=email, subject='Your complimentary membership has ended',
                                 html=short_ended_email_html(g.get('name') or ''))
            await notices.update_one({'email': email, 'expiry': expiry_iso},
                                     {'$set': {'grace_sent': now}}, upsert=True)
    return out
