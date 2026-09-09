"""
gift_subscriptions.py — buy a real annual membership as a gift for
someone else. Distinct from nominations.py's two "gift" concepts: not
a 72-hour link to one article (`/api/gifts/create`, gifter must
already be a paying subscriber), not a free 14-day taste (nomination
access). This is the real thing: anyone, subscriber or not, pays the
normal annual rate and someone else ends up with the real paid
account. Standard plan only, priced identically to a normal signup
(razorpay_orders.py's own PLAN_PRICING['standard']/_resolve_plan_config,
reused as-is) -- no separate gift pricing, no gift-specific discount.

Reuses razorpay_orders.py's existing POST /api/razorpay/create-order
UNCHANGED for the payment step (plan='standard' -- there's no reason
to duplicate identical pricing logic). This module only adds what's
actually different: what happens once payment succeeds.

Two delivery paths, decided by whether the buyer knows the recipient's
email at checkout time -- both charge the same amount immediately;
the difference is only in who gets access and when:
  * Direct: recipient's email given -> their Ghost member is labeled
    immediately, they get a "you've been gifted a year" email. No
    redemption step.
  * Code: recipient's email left blank -> a redeemable code is minted
    and stored in the new `gift_subscriptions` collection; nobody has
    access until the code is redeemed via /api/gifts/subscription/
    redeem. The buyer gets the redemption link by email as a
    backup/receipt. This is a real gift card, not a reservation --
    the payment has already happened either way.

Provides:
  * POST /api/gifts/subscription/verify-payment — the gift-aware
    capture step, mirroring razorpay_orders.py's verify_payment.
  * GET  /api/gifts/subscription/{code} — public, validates a code
    before the redemption page renders its form.
  * POST /api/gifts/subscription/redeem — public, claims a code.
  * POST /api/gifts/subscription/nudge-check — admin-gated sweep,
    reminds a buyer whose code has sat unclaimed, up to three times.

Two real correctness rules, both live in _resolve_access_start():
  * A redeemable code's year starts on the CLAIM date, not the
    purchase date -- a link sitting unopened in a chat for a month
    shouldn't burn a month of the recipient's paid access.
  * If the recipient (direct or via redeem) already has active paid
    access -- a very real case, since the most likely gifter is a
    reader and the most likely giftee is one too -- this ADDS a year
    onto their existing paid-through date instead of resetting the
    clock to today (which would silently shrink time they already
    paid for) or erroring out (the worst version: a real charge, and
    nothing to show for it). One caveat worth knowing: if the
    recipient has an actual auto-renewing Subscription (not a
    one-time payment), that Subscription still auto-charges on its
    own real schedule regardless -- this only extends the synthetic
    "your access runs until" date the account page and admin
    dashboard show, it doesn't reach into Razorpay to delay a real
    subscription's next charge. Deliberately not automated -- rare
    enough at this scale to hand to Venkat by hand, so the
    "already subscribed" email just asks them to reply if their plan
    auto-renews, rather than this module reaching into Razorpay's
    Subscription API for a case that barely happens.

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, GHOST_URL,
GHOST_ADMIN_API_KEY (all existing, shared with razorpay_orders.py).
"""
from __future__ import annotations

import os
import secrets
import html
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr

from admin_auth import require_admin_key_or_session
from razorpay_orders import _create_ghost_admin_token, PLAN_LABELS
from tiers import ensure_member_labeled, find_ghost_member, is_paid_from_labels
from payments import record_payment, reassign_payment_email, get_last_payment_for_email, compute_synthetic_expiry
from resend_email import send_email
from session_auth import get_current_member

logger = logging.getLogger(__name__)

router = APIRouter()

# A gift code that's sat unclaimed gets up to three reminder emails to
# the buyer, roughly weekly, with the link again -- otherwise a real
# payment can just quietly go nowhere if the link dies in a chat
# somewhere. Three, then stop -- nudge_count gates each one so the
# sweep (run daily) advances a gift through this schedule exactly
# once per threshold, never re-sends, and never nudges a 4th time.
NUDGE_SCHEDULE_DAYS = [7, 14, 21]

_db = None
# Own copy, set via init() -- NOT imported from razorpay_orders, whose
# own _razorpay_client is None at import time and only set later, when
# server.py calls razorpay_orders_init(). `from razorpay_orders import
# _razorpay_client` would capture that early None permanently: `from x
# import name` binds the value name has at import time, and never
# tracks a later reassignment of x.name. Same "each module gets its
# own client reference via init()" pattern razorpay_subscriptions.py
# already uses.
_razorpay_client = None

PUBLIC_BASE_URL = 'https://www.stateofplay.club'

# A UUID isn't something anyone reads out loud or copies off a printed
# card. 8 characters, split XXXX-XXXX, drawn from a charset with 0/O
# and 1/I removed so a spoken or handwritten code can't be misread --
# the same alphabet Crockford base32 uses for exactly this reason.
_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _generate_gift_code() -> str:
    raw = ''.join(secrets.choice(_CODE_CHARSET) for _ in range(8))
    return f'{raw[:4]}-{raw[4:]}'


def _normalize_code(raw: str) -> str:
    """Accepts a code in any case/spacing (typed by hand, pasted from a
    lowercase URL, read off a card) and returns the canonical stored
    form -- uppercase, XXXX-XXXX. Codes are looked up through this
    everywhere, so a redeem link shown in lowercase (reads better in a
    URL) and the same code spelled out in uppercase (reads better
    standalone) both resolve to the same record."""
    cleaned = ''.join(ch for ch in raw.upper() if ch.isalnum())
    if len(cleaned) == 8:
        return f'{cleaned[:4]}-{cleaned[4:]}'
    return cleaned


def init(razorpay_client, db_handle):
    global _razorpay_client, _db
    _razorpay_client = razorpay_client
    _db = db_handle


async def _record_gift_payment(payment_id: str, order_id: str, email: str, name: str, source: str, raw_notes: dict, created_at: Optional[datetime] = None) -> None:
    """Fetches what Razorpay itself says was charged, same "trust the
    processor's own record, not our own pricing tables" principle
    payments.fetch_and_record uses -- but files it under whichever
    email actually needs the payment history (recipient for a direct
    gift, buyer while a code is unredeemed), not whatever email
    Razorpay's own payment object happens to carry (the card-holder's,
    always the buyer's, regardless of who the gift is for). created_at
    optionally overrides when the payment is dated for expiry-
    computation purposes -- see _resolve_access_start()."""
    amount = None
    currency = 'USD'
    if _razorpay_client:
        try:
            payment = _razorpay_client.payment.fetch(payment_id)
            amount = payment.get('amount')
            currency = payment.get('currency') or currency
        except Exception as e:
            logger.warning(f'gift payment.fetch failed for {payment_id!r}: {e!r}')
    await record_payment(
        payment_id=payment_id,
        order_id=order_id,
        email=email,
        name=name,
        amount=amount,
        currency=currency,
        plan='standard',
        source=source,
        raw_notes=raw_notes,
        razorpay_created_at_unix=int(created_at.timestamp()) if created_at else None,
    )


async def _resolve_access_start(email: str, token: str) -> tuple[datetime, bool]:
    """When should this recipient's year start? 'now' (or the claim
    date, for a redeemed code) by default -- but if they ALREADY have
    active paid access, stack onto their existing paid-through date
    instead of resetting the clock to today. Checked BEFORE
    ensure_member_labeled runs, since that call grants the labels this
    function needs to check are or aren't already present. Returns
    (effective_date, was_already_subscribed)."""
    member = await find_ghost_member(email, token)
    if member:
        existing_labels = [(l.get('name') or '').lower() for l in (member.get('labels') or [])]
        if is_paid_from_labels(existing_labels):
            last_payment = await get_last_payment_for_email(email)
            existing_expiry_iso = compute_synthetic_expiry(last_payment) if last_payment else None
            if existing_expiry_iso:
                existing_expiry = datetime.fromisoformat(existing_expiry_iso)
                if existing_expiry.tzinfo is None:
                    existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                if existing_expiry > datetime.now(timezone.utc):
                    return existing_expiry, True
    return datetime.now(timezone.utc), False


async def _ensure_indexes():
    if _db is None:
        return
    try:
        await _db.gift_subscriptions.create_index('code', unique=True)
        await _db.gift_subscriptions.create_index('status')
        await _db.gift_subscriptions.create_index('created_at')
    except Exception as e:
        logger.warning(f'gift_subscriptions index ensure failed (non-fatal): {e!r}')


def _gift_direct_email_html(buyer_name: str, personal_note: str, already_subscribed: bool) -> str:
    note_block = ''
    if personal_note:
        note_block = (
            '<p style="margin: 24px 0; padding: 16px 20px; background: #F4F2EE; '
            'border-left: 2px solid #A0291C; font-style: italic; color: #333;">'
            f'{html.escape(personal_note)}'
            '</p>'
        )
    buyer = html.escape(buyer_name or 'Someone')
    if already_subscribed:
        headline = f'{buyer} added a year to your <em style="font-style: italic;">State of Play.</em>'
        body = (
            f'{html.escape(buyer_name or "A reader")} gave you a full extra year, added on top of your '
            'current membership. Nothing changes today. It just means your access runs a year longer than it '
            'would have. If your plan renews automatically, reply to this and I\'ll sort it.'
        )
    else:
        headline = f'{buyer} gave you a year of <em style="font-style: italic;">The State of Play.</em>'
        body = f'{html.escape(buyer_name or "A reader")} gave you a full annual membership. Every weekly story, the Left Field briefing, and the complete archive, for the next twelve months. Already paid for, already yours.'
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        f'<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">{headline}</h1>'
        '<p>Hello,</p>'
        f'<p>{body}</p>'
        f'{note_block}'
        f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}/login" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Start reading &rarr;</a></p>'
        '<p style="color: #555555;">Sign in anytime with just your email (no password). You\'re already set up.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


def _gift_claimed_email_html(redeemer_email: str, redeemer_name: str = '') -> str:
    # The buyer knows the person, not the address -- name it if we have
    # one (collected right there on the claim form), fall back to just
    # the email if somehow not.
    who = f'{html.escape(redeemer_name)} ({html.escape(redeemer_email)})' if redeemer_name else html.escape(redeemer_email)
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        'Your gift was <em style="font-style: italic;">claimed.</em>'
        '</h1>'
        f'<p>{who} just claimed the year you gave them. They\'re all set. Nothing more for you to do.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


def _gift_receipt_email_html(redeem_url: str, code: str) -> str:
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        'Your gift is <em style="font-style: italic;">ready to send.</em>'
        '</h1>'
        '<p>Thanks for giving a year of The State of Play. Send this link to whoever it\'s for. They redeem it with their own email, whenever they\'re ready:</p>'
        f'<p style="margin: 32px 0;"><a href="{redeem_url}" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">{redeem_url}</a></p>'
        f'<p style="color: #555555;">Or give them the code: <strong style="color: #1A1A1A;">{html.escape(code)}</strong>. They can enter it at stateofplay.club/gift/redeem.</p>'
        '<p style="color: #555555;">Already paid for. This link (or the code) is just how they claim it.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


class GiftVerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    email: EmailStr  # the buyer's own email (payer identity / receipt)
    name: Optional[str] = ''
    plan: str  # always 'standard' -- kept for RazorpayCheckoutButton's shared payload shape
    recipient_email: Optional[str] = None
    personal_note: Optional[str] = None


@router.post('/api/gifts/subscription/verify-payment')
async def gift_subscription_verify_payment(req: GiftVerifyPaymentRequest, request: Request):
    """Gift-aware counterpart to razorpay_orders.py's verify_payment --
    same signature verification, same shared Razorpay client, but the
    Ghost labeling target depends on whether a recipient was named at
    checkout (see module docstring)."""
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')
    if req.plan != 'standard':
        raise HTTPException(status_code=400, detail="Gifting only supports plan='standard'")

    try:
        _razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature,
        })
    except Exception:
        logger.warning(f'Gift payment signature verification failed for order={req.razorpay_order_id}')
        raise HTTPException(status_code=400, detail='Payment signature verification failed')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    # Same "never trust a client-supplied identity when a real session
    # exists" rule every other checkout applies -- to the BUYER's
    # identity here (who's paying), not the recipient's (who's
    # deliberately someone else).
    session = await get_current_member(request)
    buyer_email = session['email'] if session else req.email.lower().strip()
    buyer_name = req.name or ''
    recipient_email = (req.recipient_email or '').strip().lower()
    personal_note = (req.personal_note or '').strip()

    if recipient_email:
        # Checked BEFORE ensure_member_labeled grants them the labels
        # this check looks for -- see _resolve_access_start's docstring.
        effective_date, already_subscribed = await _resolve_access_start(recipient_email, token)

        member = await ensure_member_labeled(
            recipient_email, '', PLAN_LABELS['standard'], token,
        )
        if not member:
            raise HTTPException(
                status_code=502,
                detail='Payment verified but recipient setup failed, contact support',
            )
        subject = (
            f'{buyer_name or "Someone"} added a year to your State of Play'
            if already_subscribed else
            f'{buyer_name or "Someone"} gave you a year of The State of Play'
        )
        await send_email(
            to=recipient_email,
            subject=subject,
            html=_gift_direct_email_html(buyer_name, personal_note, already_subscribed),
        )
        await _record_gift_payment(
            req.razorpay_payment_id, req.razorpay_order_id, recipient_email, '',
            source='gift_subscription_direct',
            raw_notes={'gifted_by': buyer_email, 'personal_note': personal_note, 'stacked': already_subscribed},
            created_at=effective_date,
        )
        return {'verified': True, 'delivery': 'direct', 'recipient_email': recipient_email, 'already_subscribed': already_subscribed}

    # No recipient named -- mint a redeemable code instead. Nobody
    # gets access until it's redeemed.
    await _ensure_indexes()
    now = datetime.now(timezone.utc)
    code = _generate_gift_code()
    if _db is not None:
        # code has a unique index -- an 8-char draw from a 32-char
        # alphabet is astronomically unlikely to collide, but retry
        # rather than assume, same discipline as generating any other
        # access-granting token in this codebase.
        for _ in range(5):
            try:
                await _db.gift_subscriptions.insert_one({
                    'code': code,
                    'buyer_email': buyer_email,
                    'buyer_name': buyer_name,
                    'personal_note': personal_note,
                    'razorpay_payment_id': req.razorpay_payment_id,
                    'razorpay_order_id': req.razorpay_order_id,
                    'status': 'unredeemed',
                    'created_at': now,
                    'redeemed_at': None,
                    'redeemed_email': '',
                    'nudge_count': 0,
                    'last_nudge_at': None,
                })
                break
            except Exception as e:
                if 'duplicate key' not in str(e).lower():
                    raise
                code = _generate_gift_code()

    # Lowercase in the URL -- reads better there, and _normalize_code()
    # uppercases on the way back in, so it still resolves regardless.
    redeem_url = f'{PUBLIC_BASE_URL}/gift/redeem?code={code.lower()}'
    await send_email(
        to=buyer_email,
        subject='Your gift is ready to send',
        html=_gift_receipt_email_html(redeem_url, code),
    )
    await _record_gift_payment(
        req.razorpay_payment_id, req.razorpay_order_id, buyer_email, buyer_name,
        source='gift_subscription_pending',
        raw_notes={'gift_code': code, 'personal_note': personal_note},
    )
    return {'verified': True, 'delivery': 'code', 'code': code, 'redeem_url': redeem_url}


@router.get('/api/gifts/subscription/{code}')
async def gift_subscription_lookup(code: str):
    """Public -- the redemption page's own load call. Deliberately
    returns only what that page needs to render (buyer name/note,
    whether it's already claimed), not the buyer's email or any
    payment identifiers."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    gift = await _db.gift_subscriptions.find_one({'code': _normalize_code(code)})
    if not gift:
        raise HTTPException(status_code=404, detail='This gift link is invalid.')
    return {
        'buyer_name': gift.get('buyer_name') or '',
        'personal_note': gift.get('personal_note') or '',
        'status': gift.get('status'),
    }


class RedeemGiftRequest(BaseModel):
    code: str
    email: EmailStr
    name: Optional[str] = ''


@router.post('/api/gifts/subscription/redeem')
async def gift_subscription_redeem(req: RedeemGiftRequest, request: Request):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')

    code = _normalize_code(req.code)
    gift = await _db.gift_subscriptions.find_one({'code': code})
    if not gift:
        raise HTTPException(status_code=404, detail='This gift link is invalid.')
    if gift.get('status') != 'unredeemed':
        raise HTTPException(status_code=409, detail='This gift has already been redeemed.')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    session = await get_current_member(request)
    email = session['email'] if session else req.email.lower().strip()

    # Checked BEFORE ensure_member_labeled grants the labels this
    # check looks for. Also decides the redeemer's access-start date:
    # 'now' (the claim date, not whenever the buyer originally paid)
    # for a fresh recipient, or their existing paid-through date if
    # they already subscribe.
    effective_date, already_subscribed = await _resolve_access_start(email, token)

    member = await ensure_member_labeled(email, req.name or '', PLAN_LABELS['standard'], token)
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Could not set up your account, contact support',
        )

    now = datetime.now(timezone.utc)
    await _db.gift_subscriptions.update_one(
        {'code': code},
        {'$set': {'status': 'redeemed', 'redeemed_at': now, 'redeemed_email': email}},
    )
    # The real charge already happened when the buyer paid -- this
    # moves that one payment record to the redeemer's email (needed
    # for their own /account renewal date to compute correctly, via
    # get_last_payment_for_email) rather than recording a second,
    # double-counted payment for the same Razorpay charge. Also
    # backdates razorpay_created_at to effective_date, so the
    # redeemer's year is computed from the right start (claim date, or
    # their existing expiry if they're stacking) instead of whenever
    # the buyer actually paid.
    payment_id = gift.get('razorpay_payment_id') or ''
    moved = await reassign_payment_email(payment_id, email, new_created_at=effective_date) if payment_id else False
    if not moved:
        logger.warning(f'gift redeem: could not reassign payment {payment_id!r} to {email!r} (code={req.code})')

    # Both sides of a claim get told -- the giftee (welcome, or "a year
    # was added" if they already subscribed), and the buyer (their
    # gift found its person). Direct delivery already covers both of
    # these at payment time on its own; redemption needed both added
    # explicitly, since the giftee's identity isn't known until this
    # exact moment and nothing previously told the buyer their code
    # got used at all.
    buyer_name = gift.get('buyer_name') or ''
    personal_note = gift.get('personal_note') or ''
    giftee_subject = (
        f'{buyer_name or "Someone"} added a year to your State of Play'
        if already_subscribed else
        f'{buyer_name or "Someone"} gave you a year of The State of Play'
    )
    await send_email(
        to=email,
        subject=giftee_subject,
        html=_gift_direct_email_html(buyer_name, personal_note, already_subscribed),
    )

    buyer_email = gift.get('buyer_email') or ''
    if buyer_email:
        await send_email(
            to=buyer_email,
            subject='Your gift was claimed',
            html=_gift_claimed_email_html(email, req.name or ''),
        )

    return {'redeemed': True, 'email': email, 'already_subscribed': already_subscribed}


def _unclaimed_nudge_email_html(redeem_url: str, code: str) -> str:
    # One neutral line covers all three nudges (day 7, 14, 21) --
    # "a few weeks ago" would just be wrong on the first one.
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        'Your gift is still <em style="font-style: italic;">waiting.</em>'
        '</h1>'
        '<p>A little while back you gave a year of The State of Play, but it hasn\'t been claimed yet. Here it is again, in case it got lost:</p>'
        f'<p style="margin: 32px 0;"><a href="{redeem_url}" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">{redeem_url}</a></p>'
        f'<p style="color: #555555;">Or give them the code: <strong style="color: #1A1A1A;">{html.escape(code)}</strong>. They can enter it at stateofplay.club/gift/redeem.</p>'
        '<p style="color: #555555;">Already paid for. Nothing more to do than pass it along.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


@router.post('/api/gifts/subscription/nudge-check')
async def gift_subscription_nudge_check(_admin: None = Depends(require_admin_key_or_session)):
    """Cron sweep (admin-gated, same shape as nominations.py's own
    expire-check endpoints and subscription_grace.py's) -- advances
    every unredeemed gift through NUDGE_SCHEDULE_DAYS's three
    thresholds, at most one nudge per run per gift. One targeted query
    per threshold (gifts sitting at exactly nudge_count=N, older than
    that threshold), same "let Mongo's own query do the date
    comparison" pattern subscription_grace.py's sweep uses, rather
    than pulling every unredeemed gift and doing the math in Python.
    Wire this to run daily via a Render Cron Job, same as the other
    sweeps."""
    if _db is None:
        return {'nudged_count': 0}
    now = datetime.now(timezone.utc)
    nudged_count = 0

    for nudge_index, days in enumerate(NUDGE_SCHEDULE_DAYS):
        cutoff = now - timedelta(days=days)
        cursor = _db.gift_subscriptions.find({
            'status': 'unredeemed',
            'created_at': {'$lt': cutoff},
            'nudge_count': nudge_index,
        })
        async for gift in cursor:
            buyer_email = gift.get('buyer_email') or ''
            code = gift.get('code') or ''
            if not buyer_email or not code:
                continue
            redeem_url = f'{PUBLIC_BASE_URL}/gift/redeem?code={code.lower()}'
            sent = await send_email(
                to=buyer_email,
                subject='Your gift is still waiting to be claimed',
                html=_unclaimed_nudge_email_html(redeem_url, code),
            )
            if sent:
                await _db.gift_subscriptions.update_one(
                    {'code': code},
                    {'$set': {'nudge_count': nudge_index + 1, 'last_nudge_at': now}},
                )
                nudged_count += 1
    return {'nudged_count': nudged_count}
