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

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, GHOST_URL,
GHOST_ADMIN_API_KEY (all existing, shared with razorpay_orders.py).
"""
from __future__ import annotations

import os
import uuid
import html
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from razorpay_orders import _create_ghost_admin_token, PLAN_LABELS
from tiers import ensure_member_labeled
from payments import record_payment, reassign_payment_email
from resend_email import send_email
from session_auth import get_current_member

logger = logging.getLogger(__name__)

router = APIRouter()

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


def init(razorpay_client, db_handle):
    global _razorpay_client, _db
    _razorpay_client = razorpay_client
    _db = db_handle


async def _record_gift_payment(payment_id: str, order_id: str, email: str, name: str, source: str, raw_notes: dict) -> None:
    """Fetches what Razorpay itself says was charged, same "trust the
    processor's own record, not our own pricing tables" principle
    payments.fetch_and_record uses -- but files it under whichever
    email actually needs the payment history (recipient for a direct
    gift, buyer while a code is unredeemed), not whatever email
    Razorpay's own payment object happens to carry (the card-holder's,
    always the buyer's, regardless of who the gift is for)."""
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
    )


async def _ensure_indexes():
    if _db is None:
        return
    try:
        await _db.gift_subscriptions.create_index('code', unique=True)
        await _db.gift_subscriptions.create_index('status')
    except Exception as e:
        logger.warning(f'gift_subscriptions index ensure failed (non-fatal): {e!r}')


def _gift_direct_email_html(buyer_name: str, personal_note: str) -> str:
    note_block = ''
    if personal_note:
        note_block = (
            '<p style="margin: 24px 0; padding: 16px 20px; background: #F4F2EE; '
            'border-left: 2px solid #A0291C; font-style: italic; color: #333;">'
            f'{html.escape(personal_note)}'
            '</p>'
        )
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        f'{html.escape(buyer_name or "Someone")} gave you a year of <em style="font-style: italic;">The State of Play.</em>'
        '</h1>'
        '<p>Dear reader,</p>'
        f'<p>{html.escape(buyer_name or "A reader")} has gifted you a full annual membership — every weekly story, the Left Field briefing, and the complete archive, for the next twelve months. Already paid for, already yours.</p>'
        f'{note_block}'
        f'<p style="margin: 32px 0;"><a href="{PUBLIC_BASE_URL}/login" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Start reading &rarr;</a></p>'
        '<p style="color: #555555;">Sign in anytime with just your email (no password) — you\'re already set up.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


def _gift_receipt_email_html(redeem_url: str) -> str:
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        'Your gift is <em style="font-style: italic;">ready to send.</em>'
        '</h1>'
        '<p>Thanks for gifting a year of The State of Play. Send this link to whoever it\'s for — they redeem it with their own email, whenever they\'re ready:</p>'
        f'<p style="margin: 32px 0;"><a href="{redeem_url}" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">{redeem_url}</a></p>'
        '<p style="color: #555555;">Already paid for — this link is just how they claim it.</p>'
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
        member = await ensure_member_labeled(
            recipient_email, '', PLAN_LABELS['standard'], token,
        )
        if not member:
            raise HTTPException(
                status_code=502,
                detail='Payment verified but recipient setup failed, contact support',
            )
        await send_email(
            to=recipient_email,
            subject=f'{buyer_name or "Someone"} gave you a year of The State of Play',
            html=_gift_direct_email_html(buyer_name, personal_note),
        )
        await _record_gift_payment(
            req.razorpay_payment_id, req.razorpay_order_id, recipient_email, '',
            source='gift_subscription_direct',
            raw_notes={'gifted_by': buyer_email, 'personal_note': personal_note},
        )
        return {'verified': True, 'delivery': 'direct', 'recipient_email': recipient_email}

    # No recipient named -- mint a redeemable code instead. Nobody
    # gets access until it's redeemed.
    await _ensure_indexes()
    code = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    if _db is not None:
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
        })

    redeem_url = f'{PUBLIC_BASE_URL}/gift/redeem?code={code}'
    await send_email(
        to=buyer_email,
        subject='Your gift is ready to send',
        html=_gift_receipt_email_html(redeem_url),
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
    gift = await _db.gift_subscriptions.find_one({'code': code})
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

    gift = await _db.gift_subscriptions.find_one({'code': req.code})
    if not gift:
        raise HTTPException(status_code=404, detail='This gift link is invalid.')
    if gift.get('status') != 'unredeemed':
        raise HTTPException(status_code=409, detail='This gift has already been redeemed.')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    session = await get_current_member(request)
    email = session['email'] if session else req.email.lower().strip()

    member = await ensure_member_labeled(email, req.name or '', PLAN_LABELS['standard'], token)
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Could not set up your account, contact support',
        )

    now = datetime.now(timezone.utc)
    await _db.gift_subscriptions.update_one(
        {'code': req.code},
        {'$set': {'status': 'redeemed', 'redeemed_at': now, 'redeemed_email': email}},
    )
    # The real charge already happened when the buyer paid -- this
    # moves that one payment record to the redeemer's email (needed
    # for their own /account renewal date to compute correctly, via
    # get_last_payment_for_email) rather than recording a second,
    # double-counted payment for the same Razorpay charge.
    payment_id = gift.get('razorpay_payment_id') or ''
    moved = await reassign_payment_email(payment_id, email) if payment_id else False
    if not moved:
        logger.warning(f'gift redeem: could not reassign payment {payment_id!r} to {email!r} (code={req.code})')
    return {'redeemed': True, 'email': email}
