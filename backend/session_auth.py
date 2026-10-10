"""
session_auth.py — a real, backend-owned member session, via a typed code.

Second attempt at this (see the plan file for the first one, reverted the
same day it shipped): same underlying problem — the site's only
"who's logged in" check (frontend/src/contexts/AuthContext.js's
verifyMember) trusts a plain email string with no proof of ownership,
fine for UI convenience, not something to authorize money off of (the
gift subscription feature is what surfaced this) — but two things
changed this time:

1. Email delivery goes through resend_email.py (Resend), confirmed
   working end-to-end (real inbox delivery + visible delivery logs) —
   not Apps Script/MailApp, where the first attempt's email silently
   never arrived with no way to diagnose why.
2. A typed 6-digit code instead of a magic link. A link has a real UX
   trap: click it from a different device/browser than the one you
   started on (e.g. open the email on your phone, but you were signing
   in on your laptop) and only the phone ends up signed in. A code
   avoids that entirely — it's typed back into wherever the reader
   actually started, same tab, no redirect dance, no token-in-URL to
   worry about leaking via referrers or link previews.

Flow:
  1. POST /api/auth/request-code {email} — if the email matches a real
     Ghost member, invalidate any previous unused code for that email,
     generate a fresh 6-digit code (10-minute expiry), email it via
     Resend. Always returns the same generic response either way — no
     enumeration signal.
  2. POST /api/auth/verify-code {email, code} — checks the code (right
     email, unexpired, unused, under the attempt limit), re-checks Ghost
     fresh (never trusts anything cached), mints a signed session cookie
     (httponly/secure/samesite=none -- the frontend calls this API
     cross-origin, same as every other endpoint here, so the cookie has
     to survive a cross-site fetch; samesite=lax would silently never be
     sent back), returns the member as JSON (no redirect — the frontend
     navigates itself, since everything happens on one page now).
  3. GET /api/auth/me — reads and verifies the session cookie (proves
     *identity*), then does a live Ghost lookup for current is_paid/tier
     (proves *current entitlement* — deliberately not cached in the
     cookie, since entitlement can change after a session is issued).
  4. POST /api/auth/logout — clears the cookie.
  5. POST /api/auth/register-free {email, name}: creates a brand-new
     FREE Ghost member (no payment) and mints a session immediately,
     skipping steps 1-2 entirely. There's no existing account to prove
     ownership of; the email typed in IS the new account.

Wrong-code attempts are capped (MAX_ATTEMPTS) so a 6-digit code — far
weaker than a long random token — can't just be brute-forced within its
10-minute window.

get_current_member(request) is exported for other modules (gifts) to get
a cryptographically-proven identity + live entitlement, returning None if
not signed in.

Deliberately NOT wired into AuthContext.js yet — same caution as before:
build and test in isolation first, only swap the live flow over once
Venkat has run it end to end himself. The old verify-member endpoint
stays in place, unused by this module, as a fallback during any
transition.

Dependencies: JWT_SECRET, GHOST_URL, GHOST_ADMIN_API_KEY (all existing),
RESEND_API_KEY (via resend_email.py).
"""
from __future__ import annotations

import os
import logging
import secrets
import asyncio
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

import dns.resolver
import jwt
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, EmailStr

from tiers import find_ghost_member, create_ghost_member, is_genuinely_paid, resolve_tier, is_paid_from_labels
from payments import has_paid_beyond_trial, is_left_field_reader
from resend_email import send_email
from email_layout import email_shell, email_cta_button

logger = logging.getLogger(__name__)

GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', '')
PUBLIC_BASE_URL = 'https://www.stateofplay.club'

SESSION_COOKIE_NAME = 'sop_session'
SESSION_TTL_DAYS = 60
CODE_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

router = APIRouter()

_db = None

# The existing-reader rate. From October 6 a new annual membership costs
# ₹3,499 + GST ($169). Free members who joined before then, and have
# never paid for a membership, can still buy one at the old ₹2,499 + GST
# ($120) until October 31, once signed in. EXISTING_READER_JOINED_BEFORE
# is the same instant as razorpay_orders.OCT_1_CUTOFF (that module
# imports this one, so it can't be imported from there).
IST = timezone(timedelta(hours=5, minutes=30))
EXISTING_READER_JOINED_BEFORE = datetime(2026, 10, 6, tzinfo=IST)
EXISTING_READER_RATE_ENDS = datetime(2026, 11, 1, tzinfo=IST)
EXISTING_READER_RATE_LAST_DAY = '2026-10-31'


def _now() -> datetime:
    return datetime.now(IST)


def _ghost_time(value) -> Optional[datetime]:
    """Ghost's created_at ('2026-03-01T10:00:00.000Z') as a datetime."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None


async def existing_reader_rate_until(member: dict, label_names: list, is_paid: bool, email: str) -> Optional[str]:
    """'2026-10-31' if this Ghost member can buy the annual membership at
    the old rate today, else None. The one check both the site (to show
    the price) and create_order (to charge it) use."""
    now = _now()
    if not (EXISTING_READER_JOINED_BEFORE <= now < EXISTING_READER_RATE_ENDS):
        return None
    if is_paid or is_paid_from_labels(label_names) or resolve_tier(label_names, is_paid) != 'free':
        return None
    joined = _ghost_time(member.get('created_at'))
    # A Ghost account opened after October 6 still qualifies if the email
    # read The Left Field on Substack before then.
    if (not joined or joined >= EXISTING_READER_JOINED_BEFORE) and not await is_left_field_reader(email):
        return None
    if await has_paid_beyond_trial(email):
        return None
    return EXISTING_READER_RATE_LAST_DAY


async def early_rate_for_email(email: str) -> Optional[str]:
    """existing_reader_rate_until for someone who isn't signed in, from
    the email they typed at checkout: a free Ghost member by the same
    rule, or, with no Ghost account, a Left Field reader on Substack from
    before October 6 who has never paid. create_order then sells the
    membership to that email only, so the rate can't be used for anyone
    else."""
    email = (email or '').lower().strip()
    now = _now()
    if not email or not (EXISTING_READER_JOINED_BEFORE <= now < EXISTING_READER_RATE_ENDS):
        return None
    admin_token = _create_ghost_admin_token()
    member = await find_ghost_member(email, admin_token) if admin_token else None
    if member:
        label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
        is_paid = await is_genuinely_paid(label_names, member.get('status', 'free'), email)
        return await existing_reader_rate_until(member, label_names, is_paid, email)
    if not await is_left_field_reader(email) or await has_paid_beyond_trial(email):
        return None
    return EXISTING_READER_RATE_LAST_DAY

# register-free is the one endpoint here that creates a brand-new Ghost
# member from an unverified email with zero round-trip (see its own
# docstring) -- no other check in this file stops someone from hammering
# it with syntactically-valid junk. Own token-bucket copy, same shape as
# server.py's _check_article_rate_limit, kept local rather than imported
# since server.py imports THIS module (importing back would be circular).
# Tighter than the article buckets -- creating an account is heavier than
# reading one -- burst 3, then one more every minute from the same IP.
_REGISTER_BUCKET: dict = defaultdict(lambda: {'tokens': 3.0, 'last': 0.0})
_REGISTER_BUCKET_BURST = 3.0
_REGISTER_BUCKET_REFILL_PER_SEC = 1 / 60


def _check_register_rate_limit(client_ip: str) -> bool:
    """Token-bucket. Returns True if the request is allowed."""
    import time as _t
    now = _t.monotonic()
    bucket = _REGISTER_BUCKET[client_ip]
    elapsed = now - bucket['last']
    bucket['tokens'] = min(
        _REGISTER_BUCKET_BURST,
        bucket['tokens'] + elapsed * _REGISTER_BUCKET_REFILL_PER_SEC,
    )
    bucket['last'] = now
    if bucket['tokens'] >= 1.0:
        bucket['tokens'] -= 1.0
        return True
    return False


def _domain_can_receive_mail(domain: str) -> bool:
    """MX first (the normal case), falling back to A/AAAA for the rarer
    domain that accepts mail with no explicit MX record. False means the
    domain can't receive mail at all -- the objective bar for "is this a
    real address," rather than guessing at what looks fake."""
    try:
        return len(dns.resolver.resolve(domain, 'MX', lifetime=3.0)) > 0
    except Exception:
        try:
            dns.resolver.resolve(domain, 'A', lifetime=3.0)
            return True
        except Exception:
            return False


def init(db_handle):
    global _db
    _db = db_handle


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


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.login_codes.create_index('email_normalized')
        await _db.login_codes.create_index('expires_at')
    except Exception as e:
        logger.warning(f'session_auth index creation failed (non-fatal): {e!r}')


def _generate_code() -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(6))


def _mint_session(email: str, ghost_member_id: str) -> Optional[str]:
    if not JWT_SECRET:
        return None
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        'email': email,
        'ghost_member_id': ghost_member_id,
        'iat': now,
        'exp': now + SESSION_TTL_DAYS * 24 * 60 * 60,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


# Long enough to cover the 30 days' grace after a year ends, with room.
RENEWAL_LINK_TTL_DAYS = 60


def mint_renewal_link_token(email: str, ghost_member_id: str) -> Optional[str]:
    """A separate, single-purpose JWT for annual_renewal.py's reminder/
    grace emails -- a per-subscriber link that signs the reader straight
    into /account, so a renewal nudge doesn't dead-end on a sign-in-code
    round-trip. Deliberately NOT just _mint_session with a longer/shorter
    exp: the 'purpose' claim (checked by _read_session below, and again
    by POST /api/auth/renewal-link) stops this token from being usable
    as a direct Authorization: Bearer session, so a link mailed out in
    bulk can only ever do the one thing it was minted for -- exchange
    itself for a real session via that one endpoint -- not silently
    double as a long-lived bearer credential in its own right."""
    if not JWT_SECRET:
        return None
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        'email': email,
        'ghost_member_id': ghost_member_id,
        'purpose': 'renewal_link',
        'iat': now,
        'exp': now + RENEWAL_LINK_TTL_DAYS * 24 * 60 * 60,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def _read_session(request: Request) -> Optional[dict]:
    """Bearer token (Authorization header) is the primary mechanism -- it
    doesn't depend on any cookie policy at all (SameSite, a browser's
    third-party-cookie rules, or whether a proxying layer between the
    browser and this backend forwards Set-Cookie faithfully), so it
    behaves identically in every browser and every deployment topology.
    The cookie is still read as a fallback so an existing session set
    before this changed keeps working, but nothing in the frontend relies
    on the cookie being sent any more."""
    auth_header = request.headers.get('authorization', '')
    token = ''
    if auth_header.lower().startswith('bearer '):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME, '')
    if not token or not JWT_SECRET:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None
    # A mint_renewal_link_token() JWT carries a 'purpose' claim a real
    # session token never does -- reject it here so that token can only
    # ever be spent through POST /api/auth/renewal-link's own exchange,
    # never presented directly as a session.
    if payload.get('purpose'):
        return None
    return payload


async def get_current_member(request: Request) -> Optional[dict]:
    """The real thing other modules (gifts) should check identity against
    — a cryptographically-proven email plus a live-looked-up entitlement.
    Returns None if there's no valid session."""
    session = _read_session(request)
    if not session:
        return None

    admin_token = _create_ghost_admin_token()
    if not admin_token:
        return None

    member = await find_ghost_member(session['email'], admin_token)
    if not member:
        return None

    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = await is_genuinely_paid(label_names, member.get('status', 'free'), session['email'])

    return {
        'email': session['email'],
        'ghost_member_id': member.get('id', ''),
        'name': member.get('name', ''),
        'is_paid': is_paid,
        'is_free': not is_paid,
        # Matches server.py's /ghost/verify-member exactly: a member whose
        # sandbox-event comp lapsed and is no longer paid -- lets the
        # paywall show a targeted "your trial has ended" message.
        'trial_expired': 'sandbox-event-comp' in label_names and not is_paid,
        # tier is separate from is_paid -- resolve_tier() distinguishes
        # WHICH paid-adjacent plan a member is on (student/trial/
        # nomination/standard). Trial ("The Ten") members read this as
        # tier == 'trial' despite is_paid being False for them (deliberate
        # -- see tiers.PAID_LABELS's own comment on why tier-trial isn't
        # a paid label). ArticleMockup.js uses this to know when to try
        # the trial-specific content-access check.
        'tier': resolve_tier(label_names, is_paid),
        'status': member.get('status', 'free'),
        'label_names': label_names,
        # Set only for a free member who qualifies for the existing-reader
        # rate (see existing_reader_rate_until).
        'early_rate_until': await existing_reader_rate_until(member, label_names, is_paid, session['email']),
    }


def _code_email_html(code: str) -> str:
    return email_shell(
        'Your sign-in <em style="font-style: italic;">code.</em>',
        (
            '<p>Enter this code where you started signing in. It expires in 10 minutes.</p>'
            '<p style="margin: 32px 0; font-family: ui-monospace, monospace; font-size: 36px; font-weight: 600; letter-spacing: 0.15em; color: #A0291C;">'
            f'{code}'
            '</p>'
            '<p style="color: #555555;">'
            'If you didn’t request this, ignore this email. The code won’t be used.'
            '</p>'
        ),
        compliance_footer=True,
    )


class RequestCodeBody(BaseModel):
    email: EmailStr


@router.post('/api/auth/request-code')
async def request_code(req: RequestCodeBody):
    if _db is None or not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    email = req.email.lower().strip()
    logger.info(f'request-code: received email repr={email!r} (raw req.email repr={req.email!r})')
    generic_response = {'success': True, 'message': 'If that email has an account, a sign-in code is on its way.'}

    admin_token = _create_ghost_admin_token()
    if not admin_token:
        logger.warning('request-code: could not mint Ghost admin token, skipping send')
        return generic_response

    member = await find_ghost_member(email, admin_token)
    if not member:
        # Same response whether or not the email matched — no enumeration
        # in what the CLIENT sees. Server-side log is fine — it's the only
        # way to tell this apart from a delivery failure when debugging.
        logger.info(f'request-code: no Ghost member found for {email!r}, not sending')
        return generic_response

    logger.info(f'request-code: found Ghost member {member.get("id")!r} for {email!r}, generating code')
    await ensure_indexes()

    # Invalidate any previous unused code for this email so only the
    # freshest one is ever valid — avoids ambiguity if someone requests
    # a code twice.
    await _db.login_codes.update_many(
        {'email_normalized': email, 'used': False},
        {'$set': {'used': True}},
    )

    code = _generate_code()
    now = datetime.now(timezone.utc)
    await _db.login_codes.insert_one({
        'email_normalized': email,
        'code': code,
        'ghost_member_id': member.get('id', ''),
        'created_at': now,
        'expires_at': now + timedelta(minutes=CODE_TTL_MINUTES),
        'attempts': 0,
        'used': False,
    })

    sent = await send_email(
        to=email,
        subject=f'{code} is your State of Play sign-in code',
        html=_code_email_html(code),
    )
    logger.info(f'request-code: send_email for {email!r} returned {sent}')

    return generic_response


class VerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


@router.post('/api/auth/verify-code')
async def verify_code(req: VerifyCodeBody, response: Response):
    if _db is None or not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    await ensure_indexes()

    email = req.email.lower().strip()
    code = req.code.strip()

    record = await _db.login_codes.find_one({
        'email_normalized': email,
        'used': False,
    }, sort=[('created_at', -1)])

    now = datetime.now(timezone.utc)
    expires_at = record.get('expires_at') if record else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not record or not expires_at or now >= expires_at:
        raise HTTPException(status_code=400, detail='That code has expired. Request a new one.')

    if record.get('attempts', 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail='Too many attempts. Request a new code.')

    if record['code'] != code:
        await _db.login_codes.update_one({'_id': record['_id']}, {'$inc': {'attempts': 1}})
        raise HTTPException(status_code=400, detail='Incorrect code.')

    # Mark used immediately, before the Ghost re-check — a code can never
    # be replayed even if something below fails.
    await _db.login_codes.update_one({'_id': record['_id']}, {'$set': {'used': True}})

    admin_token = _create_ghost_admin_token()
    member = await find_ghost_member(email, admin_token) if admin_token else None
    if not member:
        raise HTTPException(status_code=400, detail='Account no longer found')

    session_token = _mint_session(email, member.get('id', ''))
    if not session_token:
        raise HTTPException(status_code=503, detail='Could not create session')

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite='none',
        path='/',
    )

    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = await is_genuinely_paid(label_names, member.get('status', 'free'), email)

    return {
        'email': email,
        'ghost_member_id': member.get('id', ''),
        'name': member.get('name', ''),
        'is_paid': is_paid,
        'is_free': not is_paid,
        'trial_expired': 'sandbox-event-comp' in label_names and not is_paid,
        'tier': resolve_tier(label_names, is_paid),
        'status': member.get('status', 'free'),
        'label_names': label_names,
        'early_rate_until': await existing_reader_rate_until(member, label_names, is_paid, email),
        # The frontend stores this and sends it back as
        # `Authorization: Bearer <token>` on every request from here on --
        # see _read_session's docstring for why that's now the mechanism
        # this actually depends on, not the cookie set above.
        'session_token': session_token,
    }


class RenewalLinkBody(BaseModel):
    token: str


@router.post('/api/auth/renewal-link')
async def renewal_link(req: RenewalLinkBody, response: Response):
    """Exchanges a mint_renewal_link_token() JWT (embedded as ?t=... in
    annual_renewal.py's reminder/grace emails) for a real session --
    called by the frontend's /renew page via fetch, not a bare redirect,
    since the SPA's actual auth state lives in a bearer token read from a
    JSON response (see AuthContext.js), not a cookie. Returns the exact
    same shape verify_code does, so the frontend can reuse the same
    response handling. Re-looks-up the Ghost member fresh rather than
    trusting the token's own ghost_member_id -- labels can have changed
    since the link was minted."""
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    try:
        payload = jwt.decode(req.token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        raise HTTPException(status_code=400, detail='This link has expired. Request a new sign-in code.')

    if payload.get('purpose') != 'renewal_link':
        raise HTTPException(status_code=400, detail='This link has expired. Request a new sign-in code.')

    email = payload.get('email', '')
    admin_token = _create_ghost_admin_token()
    member = await find_ghost_member(email, admin_token) if admin_token else None
    if not member:
        raise HTTPException(status_code=400, detail='Account no longer found')

    session_token = _mint_session(email, member.get('id', ''))
    if not session_token:
        raise HTTPException(status_code=503, detail='Could not create session')

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite='none',
        path='/',
    )

    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = await is_genuinely_paid(label_names, member.get('status', 'free'), email)

    return {
        'email': email,
        'ghost_member_id': member.get('id', ''),
        'name': member.get('name', ''),
        'is_paid': is_paid,
        'is_free': not is_paid,
        'trial_expired': 'sandbox-event-comp' in label_names and not is_paid,
        'tier': resolve_tier(label_names, is_paid),
        'status': member.get('status', 'free'),
        'label_names': label_names,
        'session_token': session_token,
    }


def _free_welcome_email_html() -> str:
    """Sent once, only to a brand-new free signup -- someone re-hitting
    register-free with an email that already has an account (free or
    paid) never gets this again, see is_new_signup below.

    Venkat's own drafted copy, not a generic transactional note -- longer
    and more personal than the standard-signup welcome deliberately,
    since a free reader hasn't paid for anything yet and the whole job
    of this email is to earn a reason to come back: what TSOP actually
    is, what a free subscriber gets vs. a paying one, three real stories
    to start with, and a genuine open invitation to just reply."""
    # Gmail/Apple Mail show this ahead of the subject line in the inbox
    # list -- hidden in the body itself since email_shell has no
    # preview-text concept of its own (shared by 14 other templates,
    # not worth changing there for one email). The zero-width padding
    # row stops the client falling back to quoting the email's own
    # visible first line instead.
    preheader = (
        '<div style="display:none;max-height:0;overflow:hidden;">'
        'One reported story a week on the business of Indian sport.</div>'
        '<div style="display:none;max-height:0;overflow:hidden;">' + ('&nbsp;&zwnj;' * 20) + '</div>'
    )
    return preheader + email_shell(
        'You’re <em style="font-style: italic;">in.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>Thank you for signing up. I’m Venkat, and I write The State of Play.</p>'
            '<p>It’s a publication about the business of Indian sport: the deals, rights, ownership, money '
            'and people moving it. I’m a journalist, and every story is reported, not assembled from press '
            'releases. Recent ones have covered why India is playing a one-off T20 against Japan, and what '
            'India’s Women’s World Cup win means for the business of the game. Another went inside the '
            'broadcast economics behind ICC Women’s Cricket.</p>'
            '<p>Here’s what to expect as a free subscriber:</p>'
            '<ul style="padding-left: 20px; margin: 0 0 20px;">'
            '<li style="margin-bottom: 8px;">Free stories from the archive, and new ones as we publish them.</li>'
            '<li style="margin-bottom: 8px;"><a href="https://theleftfield.substack.com" style="color: #1A1A1A;">'
            'The Left Field</a>, our free publication on the business of Indian sport, twice a week, straight '
            'to your inbox.</li>'
            '<li>One deeply reported story each week goes to paying members. You’ll see the start of it in '
            'your inbox, and can read the rest by upgrading.</li>'
            '</ul>'
            '<p>If you’d like a place to begin, these three show what the publication does best:</p>'
            '<ul style="padding-left: 20px; margin: 0 0 20px;">'
            f'<li style="margin-bottom: 8px;"><a href="{PUBLIC_BASE_URL}/why-india-is-playing-japan" '
            'style="color: #1A1A1A;">Why India is playing Japan in a one-off T20</a></li>'
            f'<li style="margin-bottom: 8px;"><a href="{PUBLIC_BASE_URL}/icc-womens-cricket-sanjog-gupta" '
            'style="color: #1A1A1A;">Inside ICC Women’s Cricket’s rights deal</a></li>'
            f'<li><a href="{PUBLIC_BASE_URL}/india-world-cup-win-business" style="color: #1A1A1A;">'
            'The business behind India’s Women’s World Cup win</a></li>'
            '</ul>'
            f'<p>More of my picks are on one page: <a href="{PUBLIC_BASE_URL}/start-here" '
            'style="color: #1A1A1A;">Start here</a>.</p>'
            '<p>If you enjoy it and want the full weekly story, you can become a paying member here. It pays '
            'for the time and independence this kind of reporting needs. No pressure at all. Reading is '
            'plenty.</p>'
            + email_cta_button('Become a paying member &rarr;', f'{PUBLIC_BASE_URL}/signup')
            + '<p>Two small requests. If this email lands in Promotions or Spam, drag it to your Primary '
            'inbox so the next one reaches you. And if something here is useful, pass it to one person who '
            'should be reading it.</p>'
            '<p>You can also just reply to this email. It comes to me, and I read everything.</p>'
            '<p>Thanks for reading,</p>'
        ),
        signoff_title='Founder and editor,<br>The State of Play',
    )


class RegisterFreeBody(BaseModel):
    email: EmailStr
    name: Optional[str] = ''
    # Where the sign-up came from (see payments.record_signup).
    source: Optional[str] = ''
    ref: Optional[str] = ''
    landing: Optional[str] = ''


@router.post('/api/auth/register-free')
async def register_free(req: RegisterFreeBody, http_request: Request, response: Response):
    """Registers a brand-new FREE Ghost member (no payment, no labels
    beyond whatever Ghost applies on its own) and signs them straight
    in -- deliberately not routed through request-code/verify-code
    above: those exist to prove ownership of an email tied to an
    EXISTING account before trusting it with something (money, an
    already-paid entitlement). Here there's no existing account and
    nothing paid to protect -- the email just typed in IS the account
    being created, so minting a session immediately is both safe and
    the point: a reader shouldn't have to wait on a code email just to
    keep reading the free story they were already reading.

    That no-round-trip design does mean nothing here ever proves the
    address is real, unlike request-code (which only emails an
    ALREADY-existing member) -- so this checks the one thing that
    matters instead: can the domain actually receive mail at all
    (_domain_can_receive_mail), plus a per-IP rate limit so the check
    can't just be brute-forced past with a pile of valid-but-random
    domains.

    Ghost's own site-level "subscribe new members to newsletter X by
    default" setting applies automatically here, the same as every
    other free-member path in this codebase (nominations.py's
    _ghost_create_free_member, tiers.create_ghost_member itself) --
    none of them ever set Ghost's `newsletters` field explicitly."""
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail='Not configured')

    client_ip = (
        http_request.headers.get('x-forwarded-for', '').split(',')[0].strip()
        or (http_request.client.host if http_request.client else '0.0.0.0')
    )
    if not _check_register_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail='Too many requests. Please slow down.')

    email = req.email.lower().strip()
    domain = email.rsplit('@', 1)[-1]
    if not await asyncio.to_thread(_domain_can_receive_mail, domain):
        raise HTTPException(
            status_code=400,
            detail="We couldn't verify that email address can receive mail. Please use a real one.",
        )

    admin_token = _create_ghost_admin_token()
    if not admin_token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    # Known ahead of creation, not inferred from the result -- create_ghost_member
    # falls back to a lookup on Ghost's 422 (already exists), so its return
    # value alone can't tell a brand-new signup apart from someone re-hitting
    # this endpoint with an email that already has an account. Only the
    # former should get the welcome email below.
    is_new_signup = await find_ghost_member(email, admin_token) is None

    # An email that already has an account must never be signed in from
    # here: nothing on this path proves the person typing it owns it, so
    # minting a session would let anyone sign in as any member (paid
    # included) by typing their address. Existing members sign in through
    # request-code/verify-code, which emails a code first.
    if not is_new_signup:
        raise HTTPException(status_code=409, detail='You already have an account with this email.')

    # Tagged (rather than the empty label list this used to pass) so an
    # admin cleanup panel can reliably tell a register-free signup apart
    # from every other kind of Ghost member -- there was no way to do
    # that before this label existed.
    from payments import record_signup, source_label
    labels = ['email-gate-signup']
    if source_label(req.source):
        labels.append(source_label(req.source))
    member = await create_ghost_member(email, (req.name or '').strip(), labels, admin_token)
    if not member:
        raise HTTPException(status_code=502, detail='Could not create account')

    if is_new_signup:
        await record_signup('free', email, source=req.source, ref=req.ref, landing=req.landing)
        sent = await send_email(to=email, subject='Welcome to The State of Play', html=_free_welcome_email_html())
        if not sent:
            logger.warning(f'register-free: welcome email failed to send for {email}')

    session_token = _mint_session(email, member.get('id', ''))
    if not session_token:
        raise HTTPException(status_code=503, detail='Could not create session')

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite='none',
        path='/',
    )

    label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
    is_paid = await is_genuinely_paid(label_names, member.get('status', 'free'), email)

    return {
        'email': email,
        'ghost_member_id': member.get('id', ''),
        'name': member.get('name', ''),
        'is_paid': is_paid,
        'is_free': not is_paid,
        'trial_expired': False,
        'tier': resolve_tier(label_names, is_paid),
        'status': member.get('status', 'free'),
        'label_names': label_names,
        'session_token': session_token,
    }


@router.get('/api/auth/me')
async def auth_me(request: Request):
    member = await get_current_member(request)
    if not member:
        raise HTTPException(status_code=401, detail='Not signed in')
    return member


@router.post('/api/auth/logout')
async def logout():
    response = Response(status_code=200, content='{"success": true}', media_type='application/json')
    # Must match set_cookie's attributes exactly -- this Starlette version's
    # delete_cookie defaults to secure=False, samesite='lax' regardless of
    # how the cookie was originally set.
    response.delete_cookie(SESSION_COOKIE_NAME, path='/', secure=True, samesite='none')
    return response
