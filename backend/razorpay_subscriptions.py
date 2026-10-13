"""
razorpay_subscriptions.py — real auto-renewing membership, for anyone who
has ALREADY paid at least once and is renewing. Companion to
razorpay_orders.py — a brand-new signup always pays through that module's
plain one-time Orders flow instead (plan='standard'), never touches a
Subscription object, and makes no promise about what they'll pay next
year. Renewal price is next year's decision, made at renewal time.

Deliberately simple, one case: a subscriber renewing right now pays the
current renewal rate in ONE Checkout step, and that same payment sets up
real auto-renewal from this point forward (`start_at` = now, so the
payment itself is the subscription's first charge). Nothing is deferred,
nothing bridges two different prices in one signup -- an earlier version
of this module tried to also handle a brand-new signup being pre-
authorised today for a *different* price a year out, which needed two
separate Checkout popups back to back for that one case. Cut, per
Venkat's call: renewal pricing is only ever shown to an existing
subscriber in the first place, so there's nothing to pre-promise a new
signup at all.

Provides:
  * SUBSCRIPTION_PLANS                     — country -> plan config
  * POST /api/razorpay/create-subscription — creates the renewal
    Subscription, returns what the frontend needs to open Razorpay
    Checkout in subscription mode (subscription_id, not order_id).
  * POST /api/razorpay/verify-subscription — verifies the checkout
    signature, then finds-or-creates the Ghost member and applies labels,
    mirroring razorpay_orders.py's verify_payment.
  * POST /api/razorpay/webhook already exists in server.py for one-time
    payment events; subscription lifecycle events (authenticated,
    activated, charged, halted, cancelled) are handled separately here —
    see handle_subscription_webhook_event(), called from server.py's
    webhook handler for subscription.* event types.

When a renewal auto-charge fails and Razorpay gives up retrying, it
sends `subscription.halted` -- Venkat's call: a one-week grace period,
not an immediate downgrade. Handled by subscription_grace.py:
start_grace_period() records the halt and emails the
subscriber once; POST /api/subscriptions/grace/expire-check (an
admin-gated sweep, wired to run daily via a Render Cron Job) strips
paid access from anyone still in grace past their `grace_ends_at`. If
the subscription successfully charges again first (`subscription.
charged`, handled in server.py's main webhook branch),
clear_grace_period() cancels the pending downgrade.

Both Plan IDs below are real, created in the Razorpay dashboard --
IN and INTL renewal both work end to end.

Confirmed against the installed razorpay SDK (2.0.x, utility/utility.py):
`client.utility.verify_subscription_payment_signature` exists and takes
exactly `razorpay_subscription_id`/`razorpay_payment_id`/`razorpay_signature`,
matching what this module already sends -- no longer a guess.

Dependencies: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (existing, now live),
GHOST_URL, GHOST_ADMIN_API_KEY (existing).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import APIRouter

from subscription_grace import start_grace_period
from email_layout import email_shell

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
PUBLIC_BASE_URL = 'https://www.stateofplay.club'

router = APIRouter()

# Injected by server.py at mount time — same pattern as razorpay_orders.py.
_razorpay_client = None
_recent_payments: Optional[dict] = None


def init(razorpay_client, recent_payments: dict):
    global _razorpay_client, _recent_payments
    _razorpay_client = razorpay_client
    _recent_payments = recent_payments


def _create_ghost_admin_token() -> Optional[str]:
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


# country -> Plan config, the one renewal rate. plan_id is filled in once
# Venkat creates each Plan in the Razorpay dashboard -- IN already done,
# INTL still a placeholder.
SUBSCRIPTION_PLANS = {
    'IN': {'plan_id': 'plan_TX2KRKBrC6HNC1', 'amount': 353900, 'currency': 'INR', 'label': 'Annual Membership'},   # 2,999 + 18% GST = 3,538.82 -> 3,539
    'INTL': {'plan_id': 'plan_TZOohCLUkhJAFy', 'amount': 14900, 'currency': 'USD', 'label': 'Annual Membership'},  # $149
}

# A Razorpay Subscription needs a finite total_count, not true "forever".
# 100 yearly cycles reads as effectively indefinite for a publication.
TOTAL_COUNT_YEARS = 100


def _renewal_thank_you_email_html() -> str:
    """Sent once, right after a real renewal completes -- verify_subscription
    is only ever called for an existing, lapsing/lapsed Standard member
    setting up real auto-renewal (SUBSCRIPTION_PLANS has no live 'new'-
    signup path yet), so every successful call here already IS a renewal;
    no extra gating needed beyond the call succeeding. Venkat's own
    drafted copy."""
    preheader = (
        '<div style="display:none;max-height:0;overflow:hidden;">'
        'You’ve seen a full year of the work. You chose a second.</div>'
        '<div style="display:none;max-height:0;overflow:hidden;">' + ('&nbsp;&zwnj;' * 20) + '</div>'
    )
    return preheader + email_shell(
        'Thank you for <em style="font-style: italic;">staying.</em>',
        (
            '<p>Dear reader,</p>'
            '<p>Thank you for renewing.</p>'
            '<p>When you first subscribed, you were backing a promise. This time you had a full year of the '
            'work in front of you, the stories that landed and the Fridays that didn’t, and you chose to stay '
            'anyway. For a one-person publication, that is the strongest vote there is. I don’t take it '
            'lightly.</p>'
            '<p>Your renewal pays for the same things it did last year. The time to make one more call. To go '
            'back over the numbers. To stay with a story until the explanation holds up.</p>'
            '<p>Here is what the next twelve months look like for you:</p>'
            '<ul style="padding-left: 20px; margin: 0 0 20px;">'
            '<li style="margin-bottom: 8px;">A deeply reported story every week, in your inbox and on the '
            'site. These usually go out on Fridays.</li>'
            '<li style="margin-bottom: 8px;">Priority access to our events, and the ability to gift up to '
            'five stories a month to anyone, on us.</li>'
            '<li style="margin-bottom: 8px;">The Left Field briefing on Mondays and Wednesdays.</li>'
            '<li style="margin-bottom: 8px;">The full archive of every reported story, searchable.</li>'
            '<li>A direct line to me. Reply to this email for any issue. It comes to me, and I read '
            'everything.</li>'
            '</ul>'
            f'<p>Your GST invoice is ready to download from '
            f'<a href="{PUBLIC_BASE_URL}/account?invoice=1" style="color: #1A1A1A;">your account page</a>.</p>'
            '<p>What stays the same is the promise: independent reporting on the business of Indian sport. '
            'Who is paying. Who owns what. What changes because of it. What changes is that I intend to do it '
            'better: clearer writing, more sources on the record, and more support around the publication so '
            'it doesn’t all rest on one person.</p>'
            '<p>If a story leaves you with a question, or you know something I should be looking at, write to '
            'me.</p>'
            f'<p>Sign in any time with the email you used to subscribe: '
            f'<a href="{PUBLIC_BASE_URL}/login" style="color: #1A1A1A;">{PUBLIC_BASE_URL}/login</a>.</p>'
            '<p>Add hello@stateofplay.club to your contacts so issues stay out of Promotions.</p>'
            '<p>Thank you for another year. I’ll try to earn it.</p>'
        ),
        signoff_title='Founder and editor,<br>The State of Play',
    )


async def handle_subscription_webhook_event(event: str, payload: dict) -> None:
    """Called from server.py's razorpay_webhook for subscription.* events
    other than .activated and .charged — those two now get the same Ghost
    labeling + Slack treatment as payment.captured, handled directly in
    server.py's primary webhook branch (which also calls
    clear_grace_period() there for a successful charge)."""
    subscription_entity = payload.get('payload', {}).get('subscription', {}).get('entity', {})
    sub_id = subscription_entity.get('id', 'unknown')

    if event == 'subscription.halted':
        await start_grace_period(sub_id)
    elif event in ('subscription.authenticated', 'subscription.cancelled'):
        logger.info(f'Subscription event {event}: {sub_id}')
    else:
        logger.info(f'Unhandled subscription event {event}: {sub_id}')
