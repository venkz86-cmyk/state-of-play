"""
admin_dashboard.py — GET /api/admin/subscribers, the "who's subscribed,
what did they pay, what's expiring" view that started this whole build.
Composes data from four places, live on every request (nothing cached,
nothing precomputed and gone stale):

  * Ghost members + labels        (tiers.list_all_ghost_members)
  * Payment history               (payments.get_subscriber_payment_summaries)
  * Trial ("The Ten") windows     (trial_members collection)
  * Nomination access windows     (nomination_access collection)

"Expiry" is deliberately never a stored field -- it's computed per member
at read time from whichever of the above actually applies (see
_compute_expiry's docstring). Corporate accounts (Phase 4) aren't joined
in yet; a corp-* labeled member shows no computed expiry until then.

The single most useful thing this view can show that nothing else can:
a member who is_paid (carries a paid label) but whose computed_expiry has
already passed -- the label and the money have drifted apart. Neither
Ghost's own admin nor Razorpay's own dashboard can see that, because
neither system knows about the other's side of the business.

Dataset-size assumption, stated once: hundreds of subscribers, not
hundreds of thousands -- this returns everything in one response (capped,
with a logged warning past MAX_ROWS) for a single-admin internal tool's
frontend to search/sort/paginate client-side. Not built for scale beyond
that on purpose.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends

from admin_auth import require_admin_key_or_session
from tiers import list_all_ghost_members, resolve_tier, is_paid_from_labels
from payments import get_subscriber_payment_summaries

logger = logging.getLogger(__name__)

router = APIRouter()

GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

MAX_ROWS = 5000
SYNTHETIC_CYCLE_DAYS = 365  # a real paid annual member's cheap expiry estimate

_db = None
_razorpay_client = None


def init(db_handle, razorpay_client=None):
    global _db, _razorpay_client
    _db = db_handle
    _razorpay_client = razorpay_client


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


async def _load_trial_and_nomination_maps() -> tuple[dict, dict]:
    """{email: expires_at datetime} for each, read once per request rather
    than once per member -- two collection scans instead of N lookups."""
    trial_map: dict = {}
    nomination_map: dict = {}
    if _db is None:
        return trial_map, nomination_map
    try:
        async for doc in _db.trial_members.find({}):
            email = doc.get('email')
            if email:
                trial_map[email] = doc.get('expires_at')
    except Exception as e:
        logger.warning(f'trial_members scan failed (non-fatal): {e!r}')
    try:
        async for doc in _db.nomination_access.find({'status': 'active'}):
            email = doc.get('nominee_email')
            if email:
                nomination_map[email] = doc.get('expires_at')
    except Exception as e:
        logger.warning(f'nomination_access scan failed (non-fatal): {e!r}')
    return trial_map, nomination_map


def _compute_expiry(
    label_names: list[str], last_payment: Optional[dict],
    trial_expires: Optional[datetime], nomination_expires: Optional[datetime],
) -> tuple[Optional[str], str]:
    """Returns (computed_expiry_iso, source). Priority: a corp-* label
    (Phase 4 fills this in; for now it's left unresolved rather than
    guessed at), then a Trial window, then a nomination-access window,
    then a real payment's synthetic 12-month cycle, then nothing (free)."""
    if any(l.startswith('corp-') for l in label_names):
        return None, 'corporate'
    if 'tier-trial' in label_names and trial_expires:
        exp = trial_expires
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp.isoformat(), 'trial'
    if 'nomination-access' in label_names and nomination_expires:
        exp = nomination_expires
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp.isoformat(), 'nomination'
    if last_payment and last_payment.get('razorpay_created_at'):
        try:
            paid_at = datetime.fromisoformat(last_payment['razorpay_created_at'])
            return (paid_at + timedelta(days=SYNTHETIC_CYCLE_DAYS)).isoformat(), 'payment_estimate'
        except (ValueError, TypeError):
            pass
    return None, 'none'


@router.get('/api/admin/subscribers')
async def list_subscribers(_admin: None = Depends(require_admin_key_or_session)):
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail='Ghost Admin API not configured')
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Failed to create Ghost admin token')

    members = await list_all_ghost_members(token)
    if len(members) > MAX_ROWS:
        logger.warning(f'admin/subscribers: {len(members)} Ghost members exceeds MAX_ROWS={MAX_ROWS}, truncating')
        members = members[:MAX_ROWS]

    payment_summaries = await get_subscriber_payment_summaries()
    trial_map, nomination_map = await _load_trial_and_nomination_maps()

    rows = []
    for member in members:
        email = (member.get('email') or '').lower().strip()
        if not email:
            continue
        label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
        paid = is_paid_from_labels(label_names) or member.get('status') in ('paid', 'comped')
        tier = resolve_tier(label_names, paid)
        summary = payment_summaries.get(email)
        last_payment = summary.get('last_payment') if summary else None

        computed_expiry, expiry_source = _compute_expiry(
            label_names, last_payment, trial_map.get(email), nomination_map.get(email),
        )

        expired_but_still_paid = False
        if paid and computed_expiry:
            try:
                exp_dt = datetime.fromisoformat(computed_expiry)
                expired_but_still_paid = exp_dt < datetime.now(timezone.utc)
            except ValueError:
                pass

        rows.append({
            'email': email,
            'name': member.get('name') or '',
            'ghost_status': member.get('status') or 'free',
            'is_paid': paid,
            'tier': tier,
            'label_names': label_names,
            'created_at': member.get('created_at'),
            'last_payment': last_payment,
            'total_paid': summary.get('total_paid') if summary else {'INR': 0, 'USD': 0},
            'payment_count': summary.get('payment_count') if summary else 0,
            'computed_expiry': computed_expiry,
            'expiry_source': expiry_source,
            'expired_but_still_paid': expired_but_still_paid,
        })

    return {'subscribers': rows, 'count': len(rows)}


@router.get('/api/admin/subscribers/{email}/subscription-status')
async def subscriber_subscription_status(
    email: str,
    _admin: None = Depends(require_admin_key_or_session),
):
    """Live Razorpay lookup, only fetched on row-expand -- not on every
    dashboard load. Needs the subscriber's subscription_id, which their
    most recent recorded payment carries if they're on the auto-renewing
    Subscription product."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    if _razorpay_client is None:
        raise HTTPException(status_code=503, detail='Razorpay not configured')

    doc = await _db.payments.find_one(
        {'email': email.lower().strip(), 'subscription_id': {'$nin': ['', None]}},
        sort=[('razorpay_created_at', -1)],
    )
    if not doc:
        return {'has_subscription': False}

    try:
        subscription = _razorpay_client.subscription.fetch(doc['subscription_id'])
    except Exception as e:
        logger.warning(f'subscription.fetch failed for {doc["subscription_id"]!r}: {e!r}')
        raise HTTPException(status_code=502, detail='Could not reach Razorpay')

    return {
        'has_subscription': True,
        'subscription_id': subscription.get('id'),
        'status': subscription.get('status'),
        'current_start': subscription.get('current_start'),
        'current_end': subscription.get('current_end'),
        'charge_at': subscription.get('charge_at'),
    }
