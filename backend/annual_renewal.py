"""
annual_renewal.py — lifecycle handling for a one-time-payment annual
member (Standard, trial-upgrade, or a community offer -- anything whose
access came from a single Razorpay Order, not a Subscription) whose year
lapses without being renewed.

Distinct from subscription_grace.py, which only reacts to a real
Razorpay/PayPal Subscription's FAILED CHARGE webhook. A plain one-time
Order never attempts to charge again at all -- there's no event to hang
a response on. So this instead runs as a daily date-driven sweep over
every standard-equivalent member's computed synthetic expiry
(payments.compute_synthetic_expiry), the exact same date the account
page and the admin Renewals panel already show. Before this module,
nothing read that date except for display -- a lapsed one-time payer
kept full paid access forever unless Venkat noticed the Renewals panel's
"Overdue, still labeled paid" filter and stripped their labels by hand.

Explicitly OUT of scope, left exactly as they are today:
  * Anyone whose last payment carries a subscription_id (a real
    auto-renewing Razorpay Subscription) -- subscription_grace.py
    already owns their lifecycle via the actual failed-charge event;
    this sweep would be guessing at the wrong signal for them.
  * Student ('tier-student') -- renewal there is a manual ID
    re-verification, not a quiet auto-lapse. A different policy if
    Venkat wants one built for it.
  * corp-* -- resolved against the Corporate Subscriptions Sheet's own
    renewal_date (admin_dashboard.py), not a synthetic guess.
  * Trial ('tier-trial') -- its own 30-day window, unrelated.
  * Team-5/Team-10 -- excluded automatically: tiers.PLAN_LABELS never
    grants the payer 'premium-subscriber' (the payer isn't necessarily a
    seat-holder), so they never match this sweep's own filter below.

Same shape as the failed-charge policy already live for a real
subscription: a timely nudge, one explicit "your year's up" notice, then
access actually goes at the end of a grace window -- never cut off the
moment the day arrives.

  Day -14  reminder email: "renews soon"
  Day   0  (expiry day)    grace-start email: "has lapsed, N days left"
  Day  +7  silent downgrade: paid-via-razorpay + premium-subscriber
                             stripped, no email (matches
                             subscription_grace.py's own silence here)

Idempotency: a member's current cycle is identified by their exact
computed expiry timestamp. A renewal moves that timestamp into the
future, which both exits them from every window below AND opens a fresh
notice cycle automatically -- no explicit "clear" step needed, unlike
subscription_grace.py (which reacts to a point-in-time webhook rather
than a value recomputed fresh on every run). The notices collection only
needs to remember "already sent X for THIS expiry," never a full history.

Provides:
  * POST /api/admin/annual-renewal/sweep -- admin-gated, same shape as
    subscription_grace.py's expire-check and nominations.py's own
    sweeps. Wire this to a daily Render Cron Job. Reports counts for
    every action taken.

Dependencies: db (via init()), RESEND_API_KEY (via resend_email.py),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from admin_auth import require_admin_key_or_session
from tiers import list_all_ghost_members, is_paid_from_labels
from payments import get_subscriber_payment_summaries, compute_synthetic_expiry
from resend_email import send_email
from email_layout import email_shell, email_cta_button
from session_auth import mint_renewal_link_token
from complimentary import complimentary_sweep

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

REMINDER_DAYS_BEFORE = 14
# Days a member keeps reading after their year ends, before the sweep
# removes paid access. Was 7; 30 since October 10, 2026 (Venkat: give
# them time to renew). Complimentary memberships keep their own week
# (COMP_GRACE_DAYS).
GRACE_PERIOD_DAYS = 30
COMP_GRACE_DAYS = 7
# Plans a one-time annual year comes from (what the sweep reminds,
# downgrades, and gives back).
_ANNUAL_PLANS = ('standard', 'renewal', 'trial-upgrade', '')
# Same pair subscription_grace.py reverses -- a one-time Standard/
# trial-upgrade/community payment only ever confers exactly these two.
_DOWNGRADE_LABELS = ('paid-via-razorpay', 'premium-subscriber')
_EXCLUDED_LABELS = ('tier-trial', 'tier-student')

router = APIRouter()

_db = None


def init(db_handle):
    global _db
    _db = db_handle


def _create_ghost_admin_token() -> Optional[str]:
    """JWT for Ghost Admin API; identical algorithm to every other module."""
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


async def _ensure_indexes():
    if _db is None:
        return
    try:
        await _db.annual_renewal_notices.create_index(
            [('email', 1), ('expiry', 1)], unique=True
        )
    except Exception as e:
        logger.warning(f'annual_renewal_notices index ensure failed (non-fatal): {e!r}')


def _reminder_email_html(expiry_date_str: str, renew_url: str) -> str:
    """The personal version of this notice -- Venkat's own words, not
    boilerplate -- since this is the one email in the whole lifecycle
    aimed at someone who already chose to pay once and might choose to
    again, not someone being sold to cold. Deliberately not reused for
    _grace_email_html below: that one is the practical "your access is
    about to pause" notice, where restating this would read as padding
    rather than sincerity.

    renew_url carries a per-subscriber mint_renewal_link_token() --
    signs the reader straight into /account instead of the generic,
    same-for-everyone URL this used to link to."""
    preheader = (
        '<div style="display:none;max-height:0;overflow:hidden;">'
        'Thank you for the first. I’d like to earn another.</div>'
        '<div style="display:none;max-height:0;overflow:hidden;">' + ('&nbsp;&zwnj;' * 20) + '</div>'
    )
    return preheader + email_shell(
        'A second year of <em style="font-style: italic;">The State of Play.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>A few of you have written to me over the past year, or sent me a text, to say I charge too little '
            'for The State of Play. I usually laughed it off. But I have thought about those messages a lot.</p>'
            '<p>You were telling me that the work mattered to you. For someone trying to build a publication on '
            'his own, that is a lot to hear.</p>'
            '<p>When you subscribed, there was no first year to look back on. You paid for a promise: independent '
            'reporting on the business of Indian sport, one deeply reported story at a time. You gave me the '
            'chance to find out what I could make of it.</p>'
            '<p>Now there is a year of work to judge.</p>'
            '<p>We followed the money behind the RCB and Rajasthan Royals sale processes. We looked at the BCCI’s '
            'title-rights economy and how Agilitas is building a sportswear business. Another traced what growth '
            'looks like for kabaddi and volleyball. Different stories, same questions underneath: who is paying, '
            'who owns what, what changes because of it.</p>'
            '<p>Your subscription paid for the time to keep asking those questions. To make another call. To go '
            'back over the numbers. To stay with a story when the first explanation did not hold up.</p>'
            '<p>I am proud of that work. I also know where it fell short.</p>'
            '<p>Some stories could have been told better. There were Fridays when health or exhaustion meant '
            'there was no story, or the reporting just wasn’t ready. I want more sources on the record and '
            'clearer writing. I want more support around the publication, so everything doesn’t depend on one '
            'person’s bandwidth. Those are things I have to work on.</p>'
            f'<p>Your first year of membership is coming to an end. As I wrote in September, renewing for another '
            'twelve months costs ₹2,999 + GST. That is ₹500 more than the introductory price you paid, and '
            '₹500 less than the new annual price. I wanted to recognise the readers who backed this early.</p>'
            '<p>Another year gets you the weekly reported story and The Left Field twice a week, plus the full '
            'archive. The promise stays the same. My job is to do it better.</p>'
            '<p>I do not assume that because you subscribed once, you will subscribe again. You have a year’s '
            'work in front of you now. If it has earned a place in your week, I would love to keep writing for '
            'you.</p>'
            + email_cta_button('Renew for another year &rarr;', renew_url)
            + '<p>If the price no longer works for you, there are no hard feelings. And if you have a question, '
            'or something you want me to do better, reply to this email. It comes to me.</p>'
            '<p>Thank you for giving The State of Play its first year.</p>'
        ),
        signoff_title='Founder and editor,<br>The State of Play',
    )


def _grace_email_html(renew_url: str) -> str:
    return email_shell(
        'Your membership <em style="font-style: italic;">has lapsed.</em>',
        (
            '<p>Your annual membership was due today and hasn’t been renewed yet. Your access is still active for now.</p>'
            f'<p>You have {GRACE_PERIOD_DAYS} days to renew before access pauses.</p>'
            + email_cta_button('Renew your membership &rarr;', renew_url)
        ),
    )


async def _restore_member(member_id: str, existing_labels: list[str], token: str) -> bool:
    """Puts back the two labels _downgrade_member removes. For members the
    sweep cut off after 7 days, before the grace period became 30."""
    lower = [l.lower() for l in existing_labels]
    new_labels = existing_labels + [l for l in _DOWNGRADE_LABELS if l not in lower]
    if new_labels == existing_labels:
        return True
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            return True
        logger.error(f'annual_renewal: restore failed for {member_id}: HTTP {r.status_code} {r.text[:200]}')
    except Exception as e:
        logger.error(f'annual_renewal: restore failed for {member_id}: {e!r}')
    return False


async def _downgrade_member(member_id: str, existing_labels: list[str], token: str) -> bool:
    """Reverses exactly what a one-time Standard-equivalent payment
    granted. Removing only one of the two labels would leave the other
    still satisfying tiers.is_paid_from_labels(), so access wouldn't
    actually change -- see subscription_grace.py's identical note."""
    new_labels = [l for l in existing_labels if l not in _DOWNGRADE_LABELS]
    if new_labels == existing_labels:
        return True  # already doesn't carry paid access
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f'Annual-renewal downgrade PUT failed for member {member_id}: {e!r}')
        return False


# ─── Lapsed members, emailed by hand from the admin dashboard ────────────────
# Members whose year has ended (and grace period passed) and who haven't
# renewed. The sweep above never writes to them again; this lets Venkat
# send a renewal note from the Renewals panel, at most once every
# LAPSED_EMAIL_GAP_DAYS per person.
LAPSED_EMAIL_GAP_DAYS = 30
SEND_CAP = 100
SEND_PAUSE_SECONDS = 0.5
RENEW_PAGE = 'https://www.stateofplay.club/renew'


def _lapsed_email_html(end_date_str: str, renew_url: str) -> str:
    return email_shell(
        'Your first year <em style="font-style: italic;">has ended.</em>',
        (
            '<p>Dear reader,</p>'
            f'<p>Your membership ended on {end_date_str}. Thank you for that year.</p>'
            '<p>You backed The State of Play before there was much to judge it by. I haven’t forgotten that.</p>'
            '<p>If you’d like a second year, it costs ₹2,999 + GST (₹3,539 in all), or $149 outside India. '
            'That is the renewal rate, ₹500 less than what new readers now pay. Your new year starts the day '
            'you renew.</p>'
            + email_cta_button('Renew for another year &rarr;', renew_url)
            + '<p style="color: #555555;">The button signs you in and takes you to a short note I wrote for '
            'readers at the end of their first year.</p>'
            '<p>If it isn’t for you right now, no hard feelings. Reply and tell me why, if you like. I read '
            'everything.</p>'
        ),
        compliance_footer=True,
    )


def _apology_email_html(year_ended: bool, renew_url: str) -> str:
    """For members whose renewal link (before October 10, 2026) showed a
    page with no way to pay."""
    timing = ('Your new year starts the day you renew.' if year_ended else
              'Your new year starts when the current one ends, so renewing early costs you nothing.')
    return email_shell(
        'Your renewal link <em style="font-style: italic;">works now.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>You clicked your renewal link this week and the page gave you no way to pay. That was a glitch '
            'on our side, and I’m sorry it cost you the time.</p>'
            '<p>It’s fixed. The button below signs you in and takes you straight to the payment step. It works '
            'as many times as you need for the next 60 days.</p>'
            + email_cta_button('Renew for another year &rarr;', renew_url)
            + f'<p>Renewal is ₹2,999 + GST (₹3,539 in all), or $149 outside India. {timing}</p>'
        ),
        compliance_footer=True,
    )


APOLOGY_SUBJECT = 'Your renewal link works now'


def _as_utc(value) -> Optional[datetime]:
    if not value:
        return None
    dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _lapsed_rows(token: str) -> dict:
    """{email: row} for every former annual member whose year has ended,
    who has no paid access now and hasn't renewed. Same exclusions as the
    sweep: not Trial/Student, not a team, not auto-renewing."""
    members = await list_all_ghost_members(token)
    payment_summaries = await get_subscriber_payment_summaries()
    now = datetime.now(timezone.utc)
    rows = {}
    for member in members:
        email = (member.get('email') or '').lower().strip()
        if not email:
            continue
        lower_labels = [(l.get('name') or '').lower() for l in (member.get('labels') or [])]
        if is_paid_from_labels(lower_labels) or member.get('status') == 'paid':
            continue
        if any(l in _EXCLUDED_LABELS for l in lower_labels):
            continue
        if any(l.startswith(('corp-', 'team-')) for l in lower_labels):
            continue
        summary = payment_summaries.get(email)
        last_payment = (summary.get('last_membership_payment') or summary.get('last_payment')) if summary else None
        if not last_payment or last_payment.get('subscription_id'):
            continue
        if last_payment.get('plan') in ('trial', 'student'):
            continue
        expiry_iso = compute_synthetic_expiry(last_payment)
        expiry_dt = _as_utc(expiry_iso)
        if not expiry_dt or expiry_dt >= now:
            continue
        rows[email] = {
            'email': email,
            'name': member.get('name') or '',
            'ghost_member_id': member.get('id', ''),
            'expiry': expiry_iso,
            'last_payment': last_payment,
            'last_emailed': None,
            # Still comped in Ghost: they keep access (and Ghost's paid
            # list) until Venkat removes the comp by hand.
            'still_comped': member.get('status') == 'comped',
            'lapsed_sent': None,
        }
    if rows and _db is not None:
        async for notice in _db.annual_renewal_notices.find({'email': {'$in': list(rows)}}):
            row = rows.get(notice.get('email'))
            if not row:
                continue
            for key in ('reminder_sent', 'grace_sent', 'lapsed_sent'):
                sent = _as_utc(notice.get(key))
                if sent and (row['last_emailed'] is None or sent > _as_utc(row['last_emailed'])):
                    row['last_emailed'] = sent.isoformat()
                if key == 'lapsed_sent' and sent and notice.get('expiry') == row['expiry']:
                    row['lapsed_sent'] = sent.isoformat()
    return rows


@router.get('/api/admin/annual-renewal/lapsed')
async def list_lapsed_members(_admin: None = Depends(require_admin_key_or_session)):
    token = _create_ghost_admin_token()
    if not token:
        return {'members': [], 'error': 'Ghost Admin API not configured'}
    rows = await _lapsed_rows(token)
    members = sorted(rows.values(), key=lambda r: r['expiry'], reverse=True)
    for r in members:
        r.pop('ghost_member_id', None)
    return {'members': members, 'count': len(members), 'gap_days': LAPSED_EMAIL_GAP_DAYS}


class SendBody(BaseModel):
    emails: list[EmailStr] = []
    test_to: Optional[EmailStr] = None


@router.post('/api/admin/annual-renewal/send-lapsed')
async def send_lapsed_emails(body: SendBody, _admin: None = Depends(require_admin_key_or_session)):
    """Emails the lapsed-member note to each address that still qualifies
    (re-checked here, not trusted from the dashboard) and hasn't had it in
    the last LAPSED_EMAIL_GAP_DAYS. test_to sends one sample and records
    nothing."""
    if body.test_to:
        sample_end = (datetime.now(timezone.utc) - timedelta(days=5)).strftime('%B %-d, %Y')
        ok = await send_email(
            to=body.test_to, subject='[Test] Your first year of The State of Play',
            html=_lapsed_email_html(sample_end, RENEW_PAGE),
        )
        return {'sent': 1 if ok else 0, 'skipped': [], 'test': True}

    if _db is None:
        return {'sent': 0, 'skipped': [], 'error': 'Database not configured'}
    token = _create_ghost_admin_token()
    if not token:
        return {'sent': 0, 'skipped': [], 'error': 'Ghost Admin API not configured'}
    await _ensure_indexes()
    rows = await _lapsed_rows(token)
    now = datetime.now(timezone.utc)
    sent, skipped = 0, []
    for raw in list(dict.fromkeys(e.lower().strip() for e in body.emails))[:SEND_CAP]:
        row = rows.get(raw)
        if not row:
            skipped.append({'email': raw, 'reason': 'No longer lapsed (renewed, or not an annual member)'})
            continue
        last = _as_utc(row['lapsed_sent'])
        if last and now - last < timedelta(days=LAPSED_EMAIL_GAP_DAYS):
            skipped.append({'email': raw, 'reason': f'Emailed {(now - last).days} days ago'})
            continue
        renewal_token = mint_renewal_link_token(raw, row['ghost_member_id'])
        renew_url = f'{RENEW_PAGE}?t={renewal_token}&ref=lapsed-email' if renewal_token else f'{RENEW_PAGE}?ref=lapsed-email'
        end_str = _as_utc(row['expiry']).strftime('%B %-d, %Y')
        ok = await send_email(
            to=raw, subject='Your first year of The State of Play',
            html=_lapsed_email_html(end_str, renew_url),
        )
        if not ok:
            skipped.append({'email': raw, 'reason': 'Email failed to send'})
            continue
        await _db.annual_renewal_notices.update_one(
            {'email': raw, 'expiry': row['expiry']},
            {'$set': {'lapsed_sent': now}},
            upsert=True,
        )
        sent += 1
        await asyncio.sleep(SEND_PAUSE_SECONDS)
    return {'sent': sent, 'skipped': skipped}


# ─── Renewal links sent by hand from the dashboard ──────────────────────────
# For anyone who can renew (razorpay_orders.renewal_eligibility, the rule
# checkout uses): Venkat sends their personal renewal email, or copies the
# link to send himself. Whose year hasn't ended gets the letter ("A second
# year of The State of Play"); whose has gets the ended note.
LINK_EARLIEST_DAYS = 60  # further out than this, there's nothing to renew yet


async def _renewal_target(email: str, token: str) -> tuple[Optional[dict], str]:
    """(target, '') for someone who can renew now, else (None, reason)."""
    from razorpay_orders import renewal_eligibility
    from tiers import find_ghost_member, resolve_tier, is_genuinely_paid
    from payments import get_last_membership_payment_for_email, complimentary_grant_for
    member = await find_ghost_member(email, token)
    if not member:
        return None, 'No account with this email'
    labels = [(l.get('name') or '').lower() for l in (member.get('labels') or [])]
    is_paid = await is_genuinely_paid(labels, member.get('status', 'free'), email)
    ok, reason = await renewal_eligibility({'email': email, 'tier': resolve_tier(labels, is_paid), 'label_names': labels})
    if not ok:
        return None, {'auto': 'Renews automatically', 'not_annual': 'Not an annual member (student, The Ten, or no membership payment)'}.get(reason, 'Cannot renew')
    end_iso = compute_synthetic_expiry(await get_last_membership_payment_for_email(email))
    if not end_iso:
        grant = await complimentary_grant_for(email)
        ends = (grant or {}).get('ends_at')
        end_iso = _as_utc(ends).isoformat() if ends else None
    end_dt = _as_utc(datetime.fromisoformat(end_iso)) if end_iso else None
    now = datetime.now(timezone.utc)
    if end_dt and end_dt - now > timedelta(days=LINK_EARLIEST_DAYS):
        return None, f'Their year runs to {end_dt.strftime("%B %-d, %Y")}, so there is nothing to renew yet'
    return {'email': email, 'member_id': member.get('id', ''), 'end': end_dt, 'end_iso': end_iso}, ''


def _renew_url(email: str, member_id: str, ref: str) -> str:
    renewal_token = mint_renewal_link_token(email, member_id)
    return f'{RENEW_PAGE}?t={renewal_token}&ref={ref}' if renewal_token else f'{RENEW_PAGE}?ref={ref}'


class LinkBody(BaseModel):
    emails: list[EmailStr] = []
    test_to: Optional[EmailStr] = None
    apology: bool = False  # the "link works now" note instead of the letter


@router.post('/api/admin/annual-renewal/send-link')
async def send_renewal_links(body: LinkBody, _admin: None = Depends(require_admin_key_or_session)):
    """Sends each address its personal renewal email, if they can renew
    (re-checked here). Skips, with a reason, anyone who can't. test_to
    sends one sample letter and records nothing."""
    if body.test_to:
        sample_end = (datetime.now(timezone.utc) + timedelta(days=10)).strftime('%B %-d, %Y')
        subject, html = ((APOLOGY_SUBJECT, _apology_email_html(False, RENEW_PAGE)) if body.apology
                         else ('A second year of The State of Play', _reminder_email_html(sample_end, RENEW_PAGE)))
        ok = await send_email(to=str(body.test_to), subject=f'[Test] {subject}', html=html)
        return {'sent': 1 if ok else 0, 'skipped': [], 'test': True}
    token = _create_ghost_admin_token()
    if not token:
        return {'sent': 0, 'skipped': [], 'error': 'Ghost Admin API not configured'}
    if _db is not None:
        await _ensure_indexes()
    now = datetime.now(timezone.utc)
    sent, skipped = 0, []
    for raw in list(dict.fromkeys(str(e).lower().strip() for e in body.emails))[:SEND_CAP]:
        target, reason = await _renewal_target(raw, token)
        if not target:
            skipped.append({'email': raw, 'reason': reason})
            continue
        url = _renew_url(raw, target['member_id'], 'admin-link')
        end = target['end']
        if body.apology:
            subject, html = APOLOGY_SUBJECT, _apology_email_html(not (end and end > now), url)
        elif end and end > now:
            subject, html = 'A second year of The State of Play', _reminder_email_html(end.strftime('%B %-d, %Y'), url)
        else:
            end_str = end.strftime('%B %-d, %Y') if end else 'recently'
            subject, html = 'Your first year of The State of Play', _lapsed_email_html(end_str, url)
        if not await send_email(to=raw, subject=subject, html=html):
            skipped.append({'email': raw, 'reason': 'Email failed to send'})
            continue
        if _db is not None and target['end_iso']:
            await _db.annual_renewal_notices.update_one(
                {'email': raw, 'expiry': target['end_iso']}, {'$set': {'link_sent': now}}, upsert=True,
            )
        sent += 1
        await asyncio.sleep(SEND_PAUSE_SECONDS)
    return {'sent': sent, 'skipped': skipped}


@router.get('/api/admin/annual-renewal/link')
async def renewal_link_for(email: EmailStr, _admin: None = Depends(require_admin_key_or_session)):
    """The member's personal renewal link, for Venkat to send himself."""
    token = _create_ghost_admin_token()
    if not token:
        return {'url': '', 'error': 'Ghost Admin API not configured'}
    raw = str(email).lower().strip()
    target, reason = await _renewal_target(raw, token)
    if not target:
        return {'url': '', 'error': reason}
    return {'url': _renew_url(raw, target['member_id'], 'admin-link')}


@router.post('/api/admin/annual-renewal/sweep')
async def annual_renewal_sweep(
    dry_run: bool = False, details: bool = False,
    _admin: None = Depends(require_admin_key_or_session),
):
    """Daily cron sweep. For every standard-equivalent, one-time-payment
    member (carries 'premium-subscriber', last payment has no
    subscription_id, not Trial/Student/corp, not billed by Ghost itself):
    sends the renewal letter once from 14 days before their year ends,
    the short lapsed note once from day 0 (or the letter, if they never
    had it), and strips paid labels once past the grace period. Safe to
    re-run as often as the cron schedule likes.

    dry_run=true (the dashboard's Preview) sends nothing and changes
    nothing; it returns who would get what, so Venkat can check before
    sending. The people behind each count are listed only for a preview
    or with details=true (the dashboard): the nightly cron prints this
    response into Render's logs, which shouldn't hold member emails."""
    empty = {'checked': 0, 'reminded': 0, 'grace_started': 0, 'downgraded': 0, 'restored': 0,
             'downgraded_still_comped': 0, 'dry_run': dry_run,
             'letter': [], 'lapsed_note': [], 'downgrade': []}
    if _db is None:
        return empty
    await _ensure_indexes()
    token = _create_ghost_admin_token()
    if not token:
        return {**empty, 'error': 'Ghost Admin API not configured'}

    members = await list_all_ghost_members(token)
    payment_summaries = await get_subscriber_payment_summaries()
    now = datetime.now(timezone.utc)

    checked = reminded = grace_started = downgraded = still_comped = restored = 0
    letter, lapsed_note, downgrade = [], [], []

    async def send_letter(email, member, expiry_dt, expiry_iso, fields):
        renewal_token = mint_renewal_link_token(email, member['id'])
        renew_url = f'https://www.stateofplay.club/renew?t={renewal_token}'
        await send_email(
            to=email, subject='A second year of The State of Play',
            html=_reminder_email_html(expiry_dt.strftime('%B %-d, %Y'), renew_url),
        )
        await _db.annual_renewal_notices.update_one(
            {'email': email, 'expiry': expiry_iso}, {'$set': fields}, upsert=True,
        )

    for member in members:
        email = (member.get('email') or '').lower().strip()
        if not email:
            continue
        label_names = [(l.get('name') or '') for l in (member.get('labels') or [])]
        lower_labels = [l.lower() for l in label_names]

        if 'premium-subscriber' not in lower_labels:
            # Cut off at 7 days, before the grace period became 30: if
            # their year ended less than GRACE_PERIOD_DAYS ago, give their
            # access back. Harmless once nobody is in that position.
            if not any(l in _EXCLUDED_LABELS for l in lower_labels) and not any(l.startswith('corp-') for l in lower_labels):
                summary = payment_summaries.get(email) or {}
                annual = summary.get('last_membership_payment')
                if annual and not annual.get('subscription_id') and (annual.get('plan') or '') in _ANNUAL_PLANS:
                    end_iso = compute_synthetic_expiry(annual)
                    if end_iso:
                        end_dt = datetime.fromisoformat(end_iso)
                        if end_dt.tzinfo is None:
                            end_dt = end_dt.replace(tzinfo=timezone.utc)
                        days_past = (now - end_dt).total_seconds() / 86400
                        if 0 < days_past < GRACE_PERIOD_DAYS:
                            ok = True if dry_run else await _restore_member(member['id'], label_names, token)
                            if ok:
                                restored += 1
                                logger.info(f'annual_renewal: access given back to {email} (year ended {end_iso[:10]}, inside the {GRACE_PERIOD_DAYS}-day grace)')
            continue
        if any(l in _EXCLUDED_LABELS for l in lower_labels):
            continue
        if any(l.startswith('corp-') for l in lower_labels):
            continue
        if member.get('status') == 'paid':
            continue  # billed by Ghost/Stripe itself -- not this lifecycle
        # A Ghost comp ('comped') doesn't exclude them: Venkat comps
        # Razorpay members by hand so Ghost's free/paid lists stay right,
        # and their year still comes from the Razorpay payment below.

        summary = payment_summaries.get(email)
        last_payment = summary.get('last_payment') if summary else None
        if not last_payment or last_payment.get('subscription_id'):
            continue  # no payment on file, or an auto-renewing subscription -- subscription_grace.py's job

        expiry_iso = compute_synthetic_expiry(last_payment)
        if not expiry_iso:
            continue
        expiry_dt = datetime.fromisoformat(expiry_iso)
        if expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)

        checked += 1
        days_to_expiry = (expiry_dt - now).total_seconds() / 86400
        if days_to_expiry > REMINDER_DAYS_BEFORE:
            continue  # not due for any notice yet
        person = {
            'email': email, 'name': member.get('name') or '', 'year_ends': expiry_iso,
            'days': round(days_to_expiry, 1), 'still_comped': member.get('status') == 'comped',
        }

        if days_to_expiry <= -GRACE_PERIOD_DAYS:
            if 'paid-via-razorpay' in lower_labels:
                ok = True if dry_run else await _downgrade_member(member['id'], label_names, token)
                if ok:
                    downgraded += 1
                    downgrade.append(person)
                    # Ghost's 'comped' status also grants access on the
                    # site, so until Venkat removes the comp they keep
                    # reading. Listed on the Renewals panel's Lapsed tab.
                    if person['still_comped']:
                        still_comped += 1
            continue

        notice = await _db.annual_renewal_notices.find_one({'email': email, 'expiry': expiry_iso})

        if days_to_expiry <= 0:
            # Someone in their grace period who never got the renewal letter
            # (the first renewals, before this sweep ran, or a payment made
            # less than 14 days before its year ended) gets the letter in
            # place of the short lapsed note: one email, not two.
            if not notice or not (notice.get('reminder_sent') or notice.get('grace_sent')):
                if not dry_run:
                    await send_letter(email, member, expiry_dt, expiry_iso, {'reminder_sent': now, 'grace_sent': now})
                reminded += 1
                letter.append(person)
                continue
            if not notice.get('grace_sent'):
                if not dry_run:
                    renewal_token = mint_renewal_link_token(email, member['id'])
                    renew_url = f'https://www.stateofplay.club/renew?t={renewal_token}'
                    await send_email(to=email, subject='Your membership has lapsed', html=_grace_email_html(renew_url))
                    await _db.annual_renewal_notices.update_one(
                        {'email': email, 'expiry': expiry_iso},
                        {'$set': {'grace_sent': now}},
                        upsert=True,
                    )
                grace_started += 1
                lapsed_note.append(person)
            continue

        if not notice or not notice.get('reminder_sent'):
            if not dry_run:
                await send_letter(email, member, expiry_dt, expiry_iso, {'reminder_sent': now})
            reminded += 1
            letter.append(person)

    # Complimentary years (complimentary.py) end the same way, with their
    # own letter in place of the paying members' one.
    try:
        comp = await complimentary_sweep(
            now, dry_run, token, reminder_days=REMINDER_DAYS_BEFORE, grace_days=COMP_GRACE_DAYS,
            mint_link=mint_renewal_link_token, notices=_db.annual_renewal_notices,
        )
        letter += comp['letter']; lapsed_note += comp['lapsed_note']; downgrade += comp['downgrade']
        reminded += len(comp['letter']); grace_started += len(comp['lapsed_note'])
        downgraded += len(comp['downgrade'])
    except Exception as e:
        logger.warning(f'complimentary sweep failed: {e!r}')

    result = {'checked': checked, 'reminded': reminded, 'grace_started': grace_started,
              'downgraded': downgraded, 'downgraded_still_comped': still_comped, 'restored': restored,
              'dry_run': dry_run}
    if not dry_run:
        # The dashboard's Today page shows the last run, and flags it when
        # the nightly one hasn't happened (the cron has failed silently
        # before, when its admin key was missing).
        try:
            await _db.renewal_runs.insert_one({
                'ran_at': now, 'checked': checked, 'reminded': reminded,
                'grace_started': grace_started, 'downgraded': downgraded, 'restored': restored,
                'downgraded_still_comped': still_comped,
            })
        except Exception as e:
            logger.warning(f'could not record the renewal run: {e!r}')
    if dry_run or details:
        by_date = lambda rows: sorted(rows, key=lambda r: r['year_ends'])
        result.update(letter=by_date(letter), lapsed_note=by_date(lapsed_note), downgrade=by_date(downgrade))
    return result
