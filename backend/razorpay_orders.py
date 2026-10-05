"""
razorpay_orders.py — dynamic Razorpay Orders API checkout, built ahead of the
October 5th anniversary launch (Student, Trial, WhatsApp add-on all ship
together that day).

The two live Razorpay Payment Buttons (still untouched, still working) can
only ever represent ONE fixed amount each, set by hand in the Razorpay
dashboard. That doesn't scale once several plans (standard, trial, student)
and later add-on combinations (WhatsApp delivery, bundled at renewal) all
need their own price — every combination would need its own dashboard
button. This module creates a Razorpay Order server-side for whatever
plan/amount our own code decides, and verifies the payment signature when
checkout completes, instead of relying on a pile of static buttons.

Flow:
  1. Frontend calls POST /api/razorpay/create-order with {plan, country}.
  2. This module looks up the price in PLAN_PRICING, creates a Razorpay
     order, returns {order_id, amount, currency, key_id} for Razorpay
     Checkout (checkout.js) to open directly — no dashboard button involved.
  3. On success, Checkout's handler callback calls POST
     /api/razorpay/verify-payment with the returned payment id/order
     id/signature. The signature is verified server-side (never trust the
     client alone) using the same SDK the two-button flow already imports
     (see server.py's `razorpay_client`, reused here rather than
     re-initialized), then the Ghost member for that email is found or
     created with the plan's labels.

Provides:
  * PLAN_PRICING, PLAN_LABELS      — plan+country -> price; plan -> labels
  * POST /api/razorpay/create-order
  * POST /api/razorpay/verify-payment

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (new — not yet set on
Render; `razorpay_client` is None and both routes 503 until they are),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from tiers import PLAN_LABELS, ensure_member_labeled, remove_member_label, find_ghost_member
from trial_tracking import start_trial
from payments import fetch_and_record, has_paid_beyond_trial, compute_synthetic_expiry, claim_payment, record_signup, source_label, clean_tag
from session_auth import get_current_member, _free_welcome_email_html
from resend_email import send_email
from email_layout import email_shell, email_cta_button
from admin_auth import require_admin_key_or_session

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
PUBLIC_BASE_URL = 'https://www.stateofplay.club'

# Same Apps Script the corporate accounts system already runs on
# (corporate.py, server.py's /invoice/generate-team) -- Team-5/10's
# checkout calls its 'create_account' action directly, taking over the
# job a Zapier automation used to do by watching the old static Payment
# Links. create_account itself takes no admin_key (it was designed for
# an external, unauthenticated caller); by the time this module reaches
# it, the Razorpay signature is already verified, so this is at least as
# trustworthy a caller as Zapier ever was.
APPS_SCRIPT_URL = os.environ.get(
    "APPS_SCRIPT_URL",
    "https://script.google.com/macros/s/AKfycbxuRQHvQZfZFYCxLirt8ry2mbiwYGlVKm7N3oe-Oy4-GuosggZZU1t5AV1Q97HmyIZ6Pg/exec",
)
TEAM_SEATS = {'team-5': 5, 'team-10': 10}
TEAM_PLAN_NAME = {'team-5': 'Team-5', 'team-10': 'Team-10'}

router = APIRouter()

# Injected by server.py at mount time: the already-initialized razorpay SDK
# client (None if RAZORPAY_KEY_ID/SECRET aren't set) and the same
# recent_payments dict the webhook already writes to for seamless post-payment
# login, so a wrapper-driven payment behaves identically to a button-driven one.
_razorpay_client = None
_recent_payments: Optional[dict] = None


def init(razorpay_client, recent_payments: dict):
    global _razorpay_client, _recent_payments
    _razorpay_client = razorpay_client
    _recent_payments = recent_payments


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


# plan -> country -> price. Amounts are in the smallest currency unit
# (paise for INR, cents for USD), as Razorpay's Orders API requires.
#
# 'standard' is a brand-new signup's one-time payment -- always a plain
# Order, never a Subscription. A new subscriber only ever sees and pays
# the current new-signup rate, once; they don't set up auto-renewal
# until they actually come back to renew a year later, at which point
# they're an "existing" subscriber and use razorpay_subscriptions.py's
# single-step Subscription checkout instead, at the (lower) renewal
# rate. No promise about a future price is ever made at signup time --
# next year's rate is next year's decision. 'trial-upgrade' is a
# DELIBERATELY separate plan from razorpay_subscriptions.py's renewal
# rate, even though the amount lands on the same number from 6 October
# on: an upgrade from The Ten carries the thirteen-months-for-twelve
# bonus (see admin_dashboard.py's _compute_expiry), which only applies
# to this plan, not to a normal renewal at the same price. The amount
# here is the STEADY-STATE (post-6-October) figure -- see
# TRIAL_UPGRADE_LAUNCH_PRICING below for the cheaper pre-cutoff price.
PLAN_PRICING = {
    'standard': {
        'IN': {'amount': 294900, 'currency': 'INR', 'label': 'Annual Membership'},   # ₹2,499 + 18% GST = ₹2,949, through 5 October
        'INTL': {'amount': 12000, 'currency': 'USD', 'label': 'Annual Membership'},  # $120, through 5 October
    },
    'trial': {
        'IN': {'amount': 59000, 'currency': 'INR', 'label': '30-Day Trial (one-time payment, not a subscription)'},  # ₹500 + 18% GST = ₹590
        'INTL': {'amount': 900, 'currency': 'USD', 'label': '30-Day Trial (one-time payment, not a subscription)'},  # $9
    },
    'student': {
        'IN': {'amount': 177000, 'currency': 'INR', 'label': 'Student Membership'},  # ₹1,500 + 18% GST = ₹1,770
        'INTL': {'amount': 2900, 'currency': 'USD', 'label': 'Student Membership'},  # $29
    },
    'trial-upgrade': {
        'IN': {'amount': 353900, 'currency': 'INR', 'label': 'Annual Membership (upgrade from The Ten)'},  # ₹2,999 + 18% GST = ₹3,539 -- new ₹3,499 rate minus the ₹590 trial fee already paid
        'INTL': {'amount': 16000, 'currency': 'USD', 'label': 'Annual Membership (upgrade from The Ten)'},  # $169 new-signup rate minus the $9 trial fee = $160
    },
    # Team-5/Team-10: replaces the static Razorpay Payment Links (opening
    # in a new tab -- "ugly," Venkat's own words) with the site's own
    # on-brand checkout, AND takes over the account-provisioning job a
    # Zapier zap used to do by watching those links -- see
    # _create_team_account() below, called from verify_payment. Real
    # seats still get added by the team's own admin afterward (they get
    # emailed their /teams/manage link), same self-serve flow as today,
    # just triggered directly instead of through Zapier. IN-only, per
    # Venkat's own "only INR for now."
    'team-5': {
        'IN': {'amount': 1180000, 'currency': 'INR', 'label': 'Team-5 Membership'},   # ₹10,000 + 18% GST = ₹11,800
    },
    'team-10': {
        'IN': {'amount': 2360000, 'currency': 'INR', 'label': 'Team-10 Membership'},  # ₹20,000 + 18% GST = ₹23,600
    },
}

# Everything below pivots on the same instant: 6 October 00:00 IST, when
# the new-signup rate rises from ₹2,499/$120 to ₹3,499/$169, and the
# trial-upgrade launch discount (below) ends. 5 October runs the full
# day at the current rate (moved from 1 October -- Venkat's call, to
# keep pushing The Ten right through 5 October).
IST = timezone(timedelta(hours=5, minutes=30))
OCT_1_CUTOFF = datetime(2026, 10, 6, tzinfo=IST)

# The new-signup rate itself, from 6 October on -- this is the one
# place that number is actually charged (a new signup never touches a
# Subscription object at all, see the PLAN_PRICING comment above).
NEW_SIGNUP_RATE_RISE_PRICING = {
    'IN': {'amount': 412900, 'currency': 'INR', 'label': 'Annual Membership'},   # ₹3,499 + 18% GST = ₹4,129
    'INTL': {'amount': 16900, 'currency': 'USD', 'label': 'Annual Membership'},  # $169
}

# Launch-window price on the trial-upgrade: through 5 October, upgrading
# costs exactly today's direct-signup rate -- no discount for the trial
# fee already paid, Venkat's explicit call. From 6 October, PLAN_PRICING
# ['trial-upgrade'] above takes over instead: the new, higher direct
# rate minus the ₹590/$9 trial fee, so the trial fee is effectively
# refunded for anyone who upgrades after the price rise.
TRIAL_UPGRADE_LAUNCH_PRICING = {
    'IN': {'amount': 294900, 'currency': 'INR', 'label': 'Annual Membership (upgrade from The Ten, launch price)'},  # ₹2,499 + 18% GST = ₹2,949
    'INTL': {'amount': 12000, 'currency': 'USD', 'label': 'Annual Membership (upgrade from The Ten, launch price)'},  # $120
}


def _resolve_plan_config(plan: str, country: str) -> Optional[dict]:
    plans = PLAN_PRICING.get(plan)
    if not plans:
        return None
    geo = country if country in plans else ('IN' if 'IN' in plans else None)
    config = plans.get(geo)
    before_cutoff = datetime.now(IST) < OCT_1_CUTOFF
    if plan == 'trial-upgrade' and before_cutoff:
        config = TRIAL_UPGRADE_LAUNCH_PRICING.get(geo, config)
    elif plan == 'standard' and not before_cutoff:
        config = NEW_SIGNUP_RATE_RISE_PRICING.get(geo, config)
    return config


class CreateOrderRequest(BaseModel):
    plan: str
    country: str = 'IN'
    # Required for plan='student': the payment token from an approved
    # application's /students/pay link.
    student_token: Optional[str] = None
    # Where the purchase came from (see payments.record_signup).
    source: Optional[str] = ''
    ref: Optional[str] = ''
    landing: Optional[str] = ''


async def _approved_student_application(student_token: Optional[str]) -> Optional[dict]:
    """The approved, not-yet-paid application a /students/pay token
    belongs to, or None. The Student price is only for applicants whose
    ID Venkat checked by hand, so it can only be bought through one."""
    if not student_token:
        return None
    import student_applications
    if student_applications._db is None:
        return None
    return await student_applications._db.student_applications.find_one(
        {'payment_token': student_token, 'status': 'approved'}
    )


@router.post('/api/razorpay/create-order')
async def create_order(req: CreateOrderRequest, request: Request):
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    # Discounted plans are only sold to the people they're for. The buyer
    # is written into the order's notes here, server-side, and
    # verify_payment grants access to that email and that plan only.
    order_notes = {'plan': req.plan}
    # Carried on the order so verify_payment can record where the buyer
    # came from. Razorpay limits notes to 256 characters each.
    for key, value in (('source', clean_tag(req.source)), ('ref', clean_tag(req.ref)),
                       ('landing', (req.landing or '')[:200])):
        if value:
            order_notes[key] = value
    if req.plan == 'student':
        application = await _approved_student_application(req.student_token)
        if not application or not application.get('email'):
            raise HTTPException(status_code=403, detail='This student link is invalid or has expired.')
        order_notes['email'] = application['email'].lower().strip()
        order_notes['student_token'] = req.student_token
    elif req.plan == 'trial-upgrade':
        member = await get_current_member(request)
        if not member or member.get('tier') != 'trial':
            raise HTTPException(status_code=403, detail='Sign in with the account you joined The Ten with to upgrade.')
        order_notes['email'] = member['email'].lower().strip()

    config = _resolve_plan_config(req.plan, req.country)
    if not config:
        raise HTTPException(
            status_code=400,
            detail=f"No pricing configured for plan='{req.plan}' country='{req.country}'",
        )

    amount = config['amount']
    label = config['label']
    notes = order_notes

    try:
        order = _razorpay_client.order.create({
            'amount': amount,
            'currency': config['currency'],
            'payment_capture': 1,
            'notes': notes,
        })
    except Exception as e:
        logger.error(f'Razorpay order creation failed: {e!r}')
        raise HTTPException(status_code=502, detail='Could not create payment order')

    return {
        'order_id': order['id'],
        'amount': amount,
        'currency': config['currency'],
        'key_id': os.environ.get('RAZORPAY_KEY_ID', ''),
        'plan': req.plan,
        'label': label,
    }


def _standard_welcome_email_html(expiry_date_str: str) -> str:
    """Sent once, only to a brand-new member whose first payment is a
    plain Standard annual signup (plan == 'standard') -- Trial, Student
    and gift recipients each already get their own tailored confirmation
    elsewhere and should never also get this generic one.

    Venkat's own drafted copy. expiry_date_str is this exact payment's
    computed access-through date (payments.compute_synthetic_expiry,
    the same number the account page's renewal banner shows) -- a plain
    Standard signup is a one-time payment, not an auto-renewing
    subscription, so this deliberately does NOT say "renews" or "cancel
    any time"; it says what's actually true."""
    preheader = (
        '<div style="display:none;max-height:0;overflow:hidden;">'
        'Thank you for backing independent reporting on Indian sport.</div>'
        '<div style="display:none;max-height:0;overflow:hidden;">' + ('&nbsp;&zwnj;' * 20) + '</div>'
    )
    return preheader + email_shell(
        'You’re <em style="font-style: italic;">in.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>Thank you for becoming a paying member. I’m Venkat, and I write The State of Play. This is '
            'the email I’d send you if we were having coffee: a proper thank you, and a short note on what '
            'you’ve signed up for.</p>'
            '<p>The State of Play exists because enough readers decided independent reporting on the '
            'business of Indian sport was worth paying for. Your subscription pays for the time and the '
            'travel this reporting takes. It’s also what lets me say no to stories that aren’t ready.</p>'
            '<p>What you get as a member:</p>'
            '<ul style="padding-left: 20px; margin: 0 0 20px;">'
            '<li style="margin-bottom: 8px;">A deeply reported story every week, usually on Fridays, in '
            'your inbox and on the site.</li>'
            '<li style="margin-bottom: 8px;">The full archive, including the older stories on rights, '
            'ownership and sponsorship.</li>'
            '<li style="margin-bottom: 8px;">A direct line to me. Reply to any issue or to this email and '
            'you’re talking to me, not a support desk.</li>'
            '<li style="margin-bottom: 8px;">Priority access to our events, and the ability to gift up to '
            'five stories a month to anyone, on us.</li>'
            '<li>The ability to comment on stories, and talk with other members.</li>'
            '</ul>'
            '<p>A few ways to get started:</p>'
            '<ul style="padding-left: 20px; margin: 0 0 20px;">'
            f'<li style="margin-bottom: 8px;">The stories I’d read first are on one page: '
            f'<a href="{PUBLIC_BASE_URL}/start-here" style="color: #1A1A1A;">Start here</a>.</li>'
            f'<li style="margin-bottom: 8px;">Read the archive. If you read one older story, make it '
            f'<a href="{PUBLIC_BASE_URL}/inside-the-rcb-sale-birla-blitzer-times-blackstone" '
            'style="color: #1A1A1A;">this</a>: a tick-tock of how a Blitzer-led consortium struck a $1.78 '
            'billion deal for Royal Challengers Bengaluru.</li>'
            f'<li style="margin-bottom: 8px;">Set up your account and manage your subscription from '
            f'<a href="{PUBLIC_BASE_URL}/account" style="color: #1A1A1A;">your account page</a>.</li>'
            '<li>Add hello@stateofplay.club to your contacts so issues stay out of Promotions.</li>'
            '</ul>'
            f'<p>Your access runs through {expiry_date_str}. This is a one-time payment, not an '
            'auto-renewing subscription. You’ll get a reminder before it lapses, and you can renew any '
            'time from your account page.</p>'
            '<p>One honest note. This is a one-person publication. Some Fridays, flu or a story that isn’t '
            'ready means an issue arrives late, and I’d rather tell you that than publish something thin. '
            'You’ll always hear about it from me.</p>'
            '<p>If you know someone who’d like it, a '
            f'<a href="{PUBLIC_BASE_URL}/gift" style="color: #1A1A1A;">gift subscription</a> is the nicest '
            'thing you can do for the publication.</p>'
            '<p>Thank you for backing this.</p>'
        ),
        signoff_title='Founder and editor,<br>The State of Play',
    )


def _student_welcome_email_html() -> str:
    """Sent once, only to a brand-new member whose first payment is the
    Student plan (plan == 'student') -- gated the same way the Standard
    welcome is, on genuinely new rather than merely newly-paid, which
    also stops a retried verify-payment call from sending this twice.
    Venkat's own drafted copy."""
    preheader = (
        '<div style="display:none;max-height:0;overflow:hidden;">'
        'The weekly story and the full archive, at a student price.</div>'
        '<div style="display:none;max-height:0;overflow:hidden;">' + ('&nbsp;&zwnj;' * 20) + '</div>'
    )
    return preheader + email_shell(
        'You’re <em style="font-style: italic;">in.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>Thank you for becoming a member. I’m Venkat, and I write The State of Play.</p>'
            '<p>You have the same membership as any annual reader, at a student price. The discount changes '
            'what you pay, not what you can read. Your membership runs for twelve months.</p>'
            '<p>The State of Play reports on the business of Indian sport: the deals, the rights, the '
            'ownership, the money and the people moving it. Your subscription pays for the time and phone '
            'calls that reporting needs. Thank you for choosing to back it while you’re studying.</p>'
            '<p>What you get as a member:</p>'
            '<ul style="padding-left: 20px; margin: 0 0 20px;">'
            '<li style="margin-bottom: 8px;">A deeply reported story every week, in your inbox and on the '
            'site. These usually go out on Fridays.</li>'
            '<li style="margin-bottom: 8px;">The Left Field briefing twice a week.</li>'
            '<li style="margin-bottom: 8px;">The full archive of every reported story since launch, '
            'searchable.</li>'
            '<li>A direct line to me. Reply to an issue or to this email. It comes to me, and I read '
            'everything.</li>'
            '</ul>'
            '<p>If you only read one older story to begin with, make it the RCB sale story.</p>'
            + email_cta_button('Read it &rarr;', f'{PUBLIC_BASE_URL}/inside-the-rcb-sale-birla-blitzer-times-blackstone')
            + f'<p>More of my picks are on one page: <a href="{PUBLIC_BASE_URL}/start-here" '
            'style="color: #1A1A1A;">Start here</a>.</p>'
            + f'<p>Sign in with the email you used for your student application: '
            f'<a href="{PUBLIC_BASE_URL}/login" style="color: #1A1A1A;">{PUBLIC_BASE_URL}/login</a>.</p>'
            '<p>Add hello@stateofplay.club to your contacts so issues stay out of Promotions.</p>'
            '<p>The student price is for currently enrolled students. We’ll check your student status again '
            'when it’s time to renew. If you’ve graduated by then, you can move to the annual plan.</p>'
            '<p>One honest note. This is a one-person publication. Some Fridays, flu or a story that isn’t '
            'ready means an issue arrives late, and I’d rather tell you than publish something thin. You’ll '
            'always hear about it from me.</p>'
            '<p>Thank you for backing this.</p>'
        ),
        signoff_title='Founder and editor,<br>The State of Play',
    )


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    email: EmailStr
    name: Optional[str] = ''
    plan: str
    company_name: Optional[str] = None  # required in practice for plan in ('team-5', 'team-10')


@router.post('/api/razorpay/verify-payment')
async def verify_payment(req: VerifyPaymentRequest, request: Request):
    """Called from Razorpay Checkout's success handler, immediately after
    payment. Verifies the signature server-side (a client can't be trusted
    to just say 'it worked'), then makes sure a correctly-labeled Ghost
    member exists for this email — creating one if this is a brand-new
    signup, or adding the plan's labels if they already had a free account.

    Whose email actually gets labeled is NOT simply whatever the client
    sent: if the browser carries a valid reader session, that session's
    own cryptographically-proven email wins, full stop, regardless of
    what req.email says. Otherwise a reader who's signed into one account
    could type a different email into the checkout form and pay for a
    trial that lands on some other, orphaned Ghost member instead of the
    account they actually use -- same "never trust a client-supplied
    identity when a real session exists" fix already applied to
    /api/gifts/create and /api/nominations/submit. req.email is only
    ever actually used for a genuine anonymous checkout, where there's no
    session to derive an identity from in the first place."""
    if not _razorpay_client:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    try:
        _razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature,
        })
    except Exception:
        logger.warning(f'Razorpay signature verification failed for order={req.razorpay_order_id}')
        raise HTTPException(status_code=400, detail='Payment signature verification failed')

    # The signature proves this order was paid; the order itself says what
    # it was for. Its notes were written by create_order, server-side, so
    # the plan comes from there, never from the browser: trusting req.plan
    # let a ₹590 The Ten payment be verified as a full annual or team plan.
    try:
        order = _razorpay_client.order.fetch(req.razorpay_order_id)
    except Exception as e:
        logger.error(f'verify-payment: order.fetch failed for {req.razorpay_order_id}: {e!r}')
        raise HTTPException(status_code=502, detail='Could not confirm the order with Razorpay')
    order_notes = order.get('notes') or {}
    if isinstance(order_notes, list):  # Razorpay returns [] for empty notes
        order_notes = {}
    order_plan = order_notes.get('plan') or ''
    if order_notes.get('gift') == 'true' or order_plan not in PLAN_LABELS:
        raise HTTPException(status_code=400, detail='This order is not for a membership')
    if req.plan != order_plan:
        logger.warning(
            f'verify-payment: plan mismatch for order={req.razorpay_order_id}: '
            f'client said {req.plan!r}, order is {order_plan!r}'
        )
        raise HTTPException(status_code=400, detail='This payment does not match the plan requested')

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    session = await get_current_member(request)
    email = session['email'] if session else req.email.lower().strip()
    # Student and The Ten upgrade orders were sold to one specific person
    # (see create_order); they're granted to that person only.
    if order_notes.get('email'):
        email = order_notes['email'].lower().strip()

    # One payment, one account (see payments.claim_payment).
    is_repeat = await claim_payment(req.razorpay_payment_id, email, 'order') == 'repeat'
    wanted_labels = list(PLAN_LABELS[req.plan])
    if source_label(order_notes.get('source')):
        wanted_labels.append(source_label(order_notes.get('source')))

    # Known ahead of ensure_member_labeled, not inferred from its result --
    # it finds-or-creates, so its return value alone can't tell a brand-new
    # signup apart from an existing free/newsletter member buying their
    # first Standard/Student plan. Only checked for 'standard'/'student':
    # the two plans here that get a generic welcome email below (Trial,
    # trial-upgrade and the team plans each have their own existing
    # confirmation, or none wanted yet).
    is_new_standard_signup = not is_repeat and req.plan == 'standard' and await find_ghost_member(email, token) is None
    is_new_student_signup = not is_repeat and req.plan == 'student' and await find_ghost_member(email, token) is None

    # Only strip stray paid labels when this email has never genuinely
    # paid us for real access before -- an existing Ghost member (e.g. a
    # prior free/newsletter signup) buying their first Trial is exactly
    # as eligible for this as a brand-new signup; what matters is real
    # payment history, not whether the Ghost member already existed.
    strip_stray_paid_labels = req.plan == 'trial' and not await has_paid_beyond_trial(email)
    member = await ensure_member_labeled(
        email, req.name or '', wanted_labels, token,
        strip_unintended_paid_labels=strip_stray_paid_labels,
    )
    if not member:
        raise HTTPException(
            status_code=502,
            detail='Payment verified but member setup failed, contact support',
        )

    # Records what Razorpay itself says was charged -- not PLAN_PRICING,
    # which can drift from the actual amount (a discount already applied
    # at create-order time). Done here,
    # before the trial/trial-upgrade branches below, so a 'trial' payment
    # can also pass its real geo into start_trial(): Razorpay's own
    # currency on the actual charge, not a client-supplied field, decides
    # IN vs INTL for the trial-upgrade emails later. Also needed before the
    # welcome email below, which quotes this exact payment's computed
    # expiry -- the same number the account page's renewal banner shows.
    payment_record = await fetch_and_record(
        _razorpay_client, req.razorpay_payment_id, source='order_verify',
        fallback_email=email, fallback_plan=req.plan,
    )

    if not is_repeat:
        await record_signup(
            'paid', email, source=order_notes.get('source', ''), ref=order_notes.get('ref', ''),
            plan=req.plan, amount=(payment_record or {}).get('amount'),
            currency=(payment_record or {}).get('currency') or '', payment_id=req.razorpay_payment_id,
            landing=order_notes.get('landing', ''),
        )

    if is_new_standard_signup:
        expiry_dt = compute_synthetic_expiry(payment_record)
        expiry_date_str = (
            datetime.fromisoformat(expiry_dt).strftime('%d %B %Y') if expiry_dt else 'a year from today'
        )
        sent = await send_email(
            to=email, subject="You’re in. Welcome to The State of Play",
            html=_standard_welcome_email_html(expiry_date_str),
        )
        if not sent:
            logger.warning(f'verify-payment: standard welcome email failed to send for {email}')

    if is_new_student_signup:
        sent = await send_email(
            to=email, subject="You’re in. Welcome to The State of Play",
            html=_student_welcome_email_html(),
        )
        if not sent:
            logger.warning(f'verify-payment: student welcome email failed to send for {email}')

    if req.plan == 'trial':
        country = 'IN' if (payment_record and payment_record.get('currency') == 'INR') else 'INTL'
        await start_trial(email, member.get('id', ''), country)

    if req.plan == 'trial-upgrade' and member.get('id'):
        # A trial member graduating to the annual membership must lose
        # 'tier-trial' -- resolve_tier checks tier labels before the
        # generic paid signal, so leaving it on would keep reporting this
        # member as still on the trial even after they paid to upgrade.
        existing_labels = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
        if 'tier-trial' in existing_labels:
            await remove_member_label(member['id'], existing_labels, 'tier-trial', token)

    if _recent_payments is not None:
        _recent_payments[email] = datetime.now(timezone.utc)

    # A retried verify for the same payment must not set up a second team.
    if req.plan in TEAM_SEATS and not is_repeat:
        await _create_team_account(req, email)

    # Close the student link once it has been paid for, server-side,
    # rather than relying on the browser's mark-paid call.
    if order_notes.get('student_token'):
        import student_applications
        if student_applications._db is not None:
            await student_applications._db.student_applications.update_one(
                {'payment_token': order_notes['student_token'], 'status': 'approved'},
                {'$set': {'status': 'paid', 'paid_at': datetime.now(timezone.utc)}},
            )

    return {'verified': True, 'email': email, 'plan': req.plan}


async def _create_team_account(req: VerifyPaymentRequest, email: str) -> None:
    """Fires the same Apps Script action ('create_account') a Zapier zap
    used to call after a payment on the old static Team-5/10 Payment
    Links, then 'send_dashboard_link' to actually email the buyer their
    team management link -- replicating the real, working self-serve
    flow Venkat already has, not inventing a new one. Non-fatal: the
    payment is already real and already recorded by the time this runs,
    so a failure here logs loudly but doesn't fail the request -- the
    alternative (raising) would tell a customer their real payment
    failed when it didn't."""
    if not req.company_name:
        logger.error(
            f'Team account creation skipped: no company_name on a {req.plan} '
            f'payment (payment_id={req.razorpay_payment_id}, email={email}) -- '
            f'needs manual follow-up in the Corporate Subscriptions Sheet.'
        )
        return

    config = PLAN_PRICING[req.plan]['IN']
    amount_rupees = config['amount'] // 100

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            create_res = await client.post(APPS_SCRIPT_URL, json={
                'action': 'create_account',
                'company_name': req.company_name,
                'admin_email': email,
                'plan_name': TEAM_PLAN_NAME[req.plan],
                'seats': TEAM_SEATS[req.plan],
                'amount_paid': amount_rupees,
                'currency': 'INR',
                'razorpay_payment_id': req.razorpay_payment_id,
            })
            body = create_res.json() if create_res.status_code == 200 else {}
            if not body.get('success'):
                logger.error(
                    f'Team account creation failed for {req.plan} payment '
                    f'{req.razorpay_payment_id} ({email}): {body.get("error") or create_res.text[:300]!r} '
                    f'-- needs manual follow-up in the Corporate Subscriptions Sheet.'
                )
                return
            await client.post(APPS_SCRIPT_URL, json={'action': 'send_dashboard_link', 'email': email})
    except Exception as e:
        logger.error(
            f'Team account creation request failed for {req.plan} payment '
            f'{req.razorpay_payment_id} ({email}): {e!r} -- needs manual '
            f'follow-up in the Corporate Subscriptions Sheet.'
        )


class TestWelcomeEmailRequest(BaseModel):
    template: str  # 'free' | 'standard'
    to: EmailStr


@router.post('/api/admin/test-welcome-email')
async def test_welcome_email(
    req: TestWelcomeEmailRequest, _admin: None = Depends(require_admin_key_or_session),
):
    """Admin-only. Fires a real send of either welcome email template
    through the live Resend account, with no Ghost member created and no
    payment involved -- a one-off way to eyeball a template exactly as
    it lands in a real inbox (logo, fonts, link rendering) without going
    through the actual signup/checkout flow it's normally triggered
    from. 'standard' has no real payment to compute an expiry from, so
    it quotes a representative date one year out rather than a real
    member's own."""
    if req.template == 'free':
        html = _free_welcome_email_html()
        subject = 'Welcome to The State of Play'
    elif req.template == 'standard':
        sample_expiry = (datetime.now(timezone.utc) + timedelta(days=365)).strftime('%d %B %Y')
        html = _standard_welcome_email_html(sample_expiry)
        subject = "You’re in. Welcome to The State of Play"
    else:
        raise HTTPException(status_code=400, detail="template must be 'free' or 'standard'")

    sent = await send_email(to=req.to, subject=subject, html=html)
    if not sent:
        raise HTTPException(status_code=502, detail='Resend send failed, check server logs')
    return {'sent': True, 'template': req.template, 'to': req.to}
