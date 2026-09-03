"""
tiers.py — plan/tier infrastructure for TSOP (September roadmap, P0).

Adds a `tier` concept on top of the existing paid/free boolean, driven by two
new Ghost labels: `tier-student`, `tier-trial`. Ghost's own paid/free status
stays canonical for billing; these labels only distinguish WHICH paid plan a
member is on, so product code (curated trial homepage, student renewal
pricing, etc. — later phases) can branch on something more specific than
"is_paid".

Provides:
  * TIER_LABELS, resolve_tier()   — read side: label names -> tier name.
                                     Imported by server.py's verify_ghost_member
                                     and get_member_details.
  * add_member_tier_label()       — write side: PATCH a tier label onto an
                                     EXISTING Ghost member by id. First of its
                                     kind in this codebase — every other
                                     label-write here (nominations.py's
                                     _ghost_create_free_member) only sets a
                                     label while creating a brand-new member.
                                     Ghost's PATCH replaces the whole labels
                                     array, so this reads current labels first
                                     and sends the union.
  * find_ghost_member(), create_ghost_member(), ensure_member_labeled() —
                                     the find-or-create-and-label dance every
                                     payment-success path needs. Was
                                     duplicated near-identically in
                                     razorpay_orders.py and
                                     razorpay_subscriptions.py; consolidated
                                     here so server.py's generic webhook
                                     (which replaces the "Razorpay Payment
                                     Capture" Zap for the two original static
                                     Payment Buttons) doesn't become a third
                                     copy.
  * PLAN_LABELS                   — plan name -> Ghost labels it confers.
                                     Shared by razorpay_orders.py and
                                     server.py's webhook so a plan's labels
                                     are defined once, not per caller.
  * POST /api/tiers/grant         — admin-only (ADMIN_KEY), grants a tier to
                                     a member by email. This is the same
                                     action P2's student-verification
                                     "Approve" button will call once that
                                     moderation UI exists; exposed now so it
                                     can be exercised by hand ahead of it.

Dependencies: GHOST_URL, GHOST_ADMIN_API_KEY, ADMIN_KEY (all existing, no new
env vars).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

# Ghost label -> tier name.
TIER_LABELS = {
    'tier-student': 'student',
    'tier-trial': 'trial',
    'nomination-access': 'nomination',
}

# Every label that confers real paid access. Single source of truth — was
# previously duplicated inline in server.py's verify_ghost_member and
# get_member_details (and would have been a third copy in nudge.py), which
# is exactly how a label gets added in one place and silently missed in
# another. 'tier-trial' is deliberately absent: trial access is a 10-story
# snapshot, not the full archive. 'nomination-access' IS full access,
# deliberately time-boxed (14 days) by nominations.py's own Mongo record
# and expiry sweep rather than by anything in this list — the same way
# 'tier-trial'/'tier-student' are permanent labels with no expiry logic at
# all, 'nomination-access' is the one label here whose owner (nominations.py)
# actively removes it again once its window closes.
PAID_LABELS = [
    'paid-via-razorpay', 'paid-via-invoice', 'premium-subscriber',
    'paid', 'premium', 'corporate-member', 'tier-student', 'nomination-access',
]


def is_paid_from_labels(label_names: list[str]) -> bool:
    """label_names must already be lowercased."""
    return (
        any(label in label_names for label in PAID_LABELS)
        or any(name.startswith('team-') for name in label_names)
    )


# plan -> Ghost labels a successful payment for that plan confers.
# 'trial' is deliberately NOT paid-conferring — see PAID_LABELS above.
# Falls back to 'standard' for any payment that carries no plan/tier note at
# all — i.e. the two original static Payment Buttons, which predate the
# plan system and never set one. 'standard' carries both paid-via-razorpay
# and premium-subscriber to match exactly what the "Razorpay Payment
# Capture" Zap has always applied to an annual signup — confirmed against a
# real member's labels, not assumed.
PLAN_LABELS = {
    'standard': ['paid-via-razorpay', 'premium-subscriber'],
    'student': ['paid-via-razorpay', 'tier-student'],
    'trial': ['tier-trial'],
    # Community offers: a Razorpay Payment Link shared directly outside the
    # website (a Slack/WhatsApp/email link, not a checkout the site itself
    # offers), so there's no notes.plan to read the way the site's own
    # checkout flow sets one. Full paid access, same as Standard, plus one
    # extra label so Venkat can filter/report how many signups came through
    # this specific link.
    'community-ftwtsop': ['paid-via-razorpay', 'premium-subscriber', 'community-ftwtsop'],
}

# Payment amount (paise) -> plan, for payments that carry no notes.plan at
# all — i.e. a Payment Link/Button created directly in the Razorpay
# dashboard for something outside the site's own checkout, recognized by
# its price alone rather than any note we'd have to remember to set by hand
# in Razorpay's UI (which the two original static buttons never did either,
# and still don't need to).
AMOUNT_TO_PLAN = {
    235900: 'community-ftwtsop',  # ₹1,999 + 18% GST = ₹2,359 — FTWTSOP
}

router = APIRouter()


def _create_ghost_admin_token() -> Optional[str]:
    """JWT for Ghost Admin API; identical algorithm to server.py/nominations.py/comments.py."""
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


def resolve_tier(label_names: list[str], is_paid: bool) -> str:
    """Given a member's lowercased label names and their existing paid/free
    boolean, return the tier: 'student' | 'trial' | 'standard' | 'free'.
    A tier label wins over the generic paid signal, since a student or
    trial member's labels also happen to satisfy the generic paid check."""
    for label, tier in TIER_LABELS.items():
        if label in label_names:
            return tier
    return 'standard' if is_paid else 'free'


async def find_ghost_member(email: str, token: str) -> Optional[dict]:
    filter_str = f"email:'{email}'"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f'{GHOST_URL}/ghost/api/admin/members/',
            params={'filter': filter_str, 'include': 'labels'},
            headers={'Authorization': f'Ghost {token}'},
        )
    if r.status_code == 200:
        members = r.json().get('members', [])
        if not members:
            logger.info(f'Ghost member lookup: 0 matches for filter={filter_str!r} (email repr={email!r})')
        return members[0] if members else None
    logger.warning(f'Ghost member lookup HTTP {r.status_code} for {email!r}: {r.text[:300]!r}')
    return None


async def add_member_label(member_id: str, existing_labels: list[str], label: str) -> bool:
    """PATCH `label` onto an existing Ghost member, preserving whatever
    labels they already carry. Returns True on success (including the
    already-has-it no-op case). Generic — used for tier labels here and for
    plan-conferred labels (e.g. paid-via-razorpay) by razorpay_orders.py."""
    if label in existing_labels:
        return True
    token = _create_ghost_admin_token()
    if not token:
        return False
    new_labels = [*existing_labels, label]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            return True
        logger.warning(f'Ghost label update HTTP {r.status_code}: {r.text[:200]}')
    except Exception as e:
        logger.warning(f'Ghost label update failed: {e!r}')
    return False


async def remove_member_label(member_id: str, existing_labels: list[str], label: str, token: str) -> bool:
    """PATCH `label` off an existing Ghost member, preserving every other
    label they carry. Mirrors add_member_label's shape, opposite direction.
    Used to correct a paid label something else (the still-not-plan-aware
    Zap, in practice) added to a member it shouldn't have — see
    ensure_member_labeled's strip_unintended_paid_labels."""
    if label not in existing_labels:
        return True
    new_labels = [l for l in existing_labels if l != label]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'labels': new_labels}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            return True
        logger.warning(f'Ghost label removal HTTP {r.status_code}: {r.text[:200]}')
    except Exception as e:
        logger.warning(f'Ghost label removal failed: {e!r}')
    return False


async def create_ghost_member(email: str, name: str, labels: list[str], token: str, note: str = '') -> Optional[dict]:
    """Create a brand-new Ghost member with the given labels. Mirrors
    nominations.py's _ghost_create_free_member, generalized to accept any
    label set instead of one hardcoded label.

    Handles Ghost's 422 the same way nominations.py's original does: it
    means the member already exists, most likely because something else
    (the still-live "Razorpay Payment Capture" Zap, another payment path)
    created them in the same window this call was racing against. Falls
    back to a lookup instead of failing outright, so a benign race doesn't
    surface as "payment succeeded but member setup failed" to the reader.
    """
    payload = {'email': email, 'name': name or '', 'labels': [{'name': l} for l in labels]}
    if note:
        payload['note'] = note
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f'{GHOST_URL}/ghost/api/admin/members/?send_email=false',
            json={'members': [payload]},
            headers={'Authorization': f'Ghost {token}'},
        )
    if r.status_code in (200, 201):
        return r.json()['members'][0]
    if r.status_code == 422:
        logger.info(f'Ghost member create 422 (likely already exists) for {email}, looking up instead')
        return await find_ghost_member(email, token)
    logger.warning(f'Ghost member create HTTP {r.status_code}: {r.text[:200]}')
    return None


async def set_member_note(member_id: str, note: str, token: str) -> bool:
    """Overwrite an existing Ghost member's note field — used for the
    payment-details note the "Razorpay Payment Capture" Zap has always
    written (Payment ID / Contact / Amount), so a member's Ghost profile
    carries that lookup trail regardless of which system, this backend or
    the Zap kept as a backup, actually processed the payment."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f'{GHOST_URL}/ghost/api/admin/members/{member_id}/',
                json={'members': [{'note': note}]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            return True
        logger.warning(f'Ghost note update HTTP {r.status_code}: {r.text[:200]}')
    except Exception as e:
        logger.warning(f'Ghost note update failed: {e!r}')
    return False


async def ensure_member_labeled(
    email: str, name: str, labels: list[str], token: str,
    strip_unintended_paid_labels: bool = False, note: str = '',
) -> Optional[dict]:
    """Find-or-create a Ghost member and make sure they carry every label in
    `labels`, adding whatever's missing. The one place every payment-success
    path (Orders, Subscriptions, and server.py's generic webhook) does this,
    so the logic exists exactly once rather than duplicated per caller.

    Applies `labels` AFTER settling on a member, not just on the
    already-existed branch — create_ghost_member's own 422 fallback can
    also return a member that something else (the still-live Zap, another
    payment path) just created, carrying none of our labels yet. Skipping
    the apply step on that path was the actual bug behind an earlier
    "payment verified but member setup failed" error: the create attempt
    hit a race, fell back to a lookup, and returned without ever adding the
    plan's labels.

    strip_unintended_paid_labels: for Trial specifically. The "Razorpay
    Payment Capture" Zap is not yet plan-aware — it applies its generic
    paid labels to ANY successful payment, ₹590 Trial included, which
    would silently grant full access the moment a real trial payment
    lands, regardless of whether/when the Zap gets fixed. When set, and
    only for a member who did NOT exist a moment ago (never touches an
    existing member's prior history — a genuine paying member separately
    buying a trial keeps their real access), any label in PAID_LABELS
    that isn't part of the intended `labels` is stripped. On a brand-new
    signup, such a label can only have come from something else racing
    this same payment — there is no legitimate prior state it could be
    honoring."""
    member = await find_ghost_member(email, token)
    is_new_signup = member is None
    if not member:
        member = await create_ghost_member(email, name, labels, token, note=note)
        if not member:
            return None
    if note and member.get('id'):
        # Always set it explicitly, even right after create — don't rely on
        # Ghost's create response echoing back the note we just sent (never
        # confirmed it does), and if create_ghost_member fell back to a
        # lookup after a 422 (someone else, most likely the Zap, created
        # this member first with none of our note text on it), this is the
        # only place that note ever actually gets written.
        await set_member_note(member['id'], note, token)

    existing_labels = [(lbl.get('name') or '') for lbl in (member.get('labels') or [])]
    for label in labels:
        if label not in existing_labels:
            if await add_member_label(member['id'], existing_labels, label):
                existing_labels.append(label)

    if strip_unintended_paid_labels and is_new_signup:
        stray = [l for l in existing_labels if l in PAID_LABELS and l not in labels]
        for label in stray:
            if await remove_member_label(member['id'], existing_labels, label, token):
                existing_labels.remove(label)
                logger.info(f'Stripped unintended paid label {label!r} from new trial signup {email}')

    return member


class GrantTierRequest(BaseModel):
    email: EmailStr
    tier: str  # 'student' | 'trial'


@router.post('/api/tiers/grant')
async def grant_tier(req: GrantTierRequest, x_admin_key: str = Header(default='')):
    """Admin-only. Grants a tier label to an existing Ghost member by email."""
    if not ADMIN_KEY or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Forbidden')

    label_by_tier = {v: k for k, v in TIER_LABELS.items()}
    tier_label = label_by_tier.get(req.tier)
    if not tier_label:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tier '{req.tier}'. Expected one of: {list(label_by_tier)}",
        )

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')

    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    member = await find_ghost_member(req.email, token)
    if not member:
        raise HTTPException(status_code=404, detail='No matching Ghost member found')

    existing_labels = [(lbl.get('name') or '') for lbl in (member.get('labels') or [])]
    ok = await add_member_label(member['id'], existing_labels, tier_label)
    if not ok:
        raise HTTPException(status_code=502, detail='Ghost label update failed')

    return {'status': 'ok', 'email': member.get('email', req.email), 'tier': req.tier}
