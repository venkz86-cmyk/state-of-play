"""Keeps a renewing member's Ghost comp in step with what they paid for.

Razorpay members are comped in Ghost so Ghost lists them as paying (and
sends them paid-only emails). Their access on the site comes from their
labels and payments; the comp is Ghost's own copy of the end date, set
for their first year. A renewal paid before that year ends starts when it
ends, but nothing moved the comp, so on the old end date Ghost dropped
them to free while they had paid for another year (Dhananjay Jayaraman,
renewed October 8, 2026, comp ended October 13).

extend_comp() moves the comp's end to the end of the year they paid for.
It runs when a membership payment is recorded (payments.ON_NEW_PAYMENT)
and every night for everyone who has renewed (annual_renewal's sweep), so
someone who renewed before this existed is caught too. It only ever moves
an end date later, and skips Ghost's own paying members (status 'paid')
and anyone without the paid-via-razorpay label.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

import payments as PM

logger = logging.getLogger(__name__)
GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
_db = None


def init(db_handle):
    global _db
    _db = db_handle
    if on_new_payment not in PM.ON_NEW_PAYMENT:
        PM.ON_NEW_PAYMENT.append(on_new_payment)


def _utc(value) -> Optional[datetime]:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _member(client, email: str, token: str) -> Optional[dict]:
    r = await client.get(
        f'{GHOST_URL}/ghost/api/admin/members/',
        params={'filter': f"email:'{email}'", 'include': 'labels,tiers'},
        headers={'Authorization': f'Ghost {token}'},
    )
    if r.status_code != 200:
        return None
    members = r.json().get('members') or []
    return members[0] if members else None


async def extend_comp(email: str, token: Optional[str] = None) -> dict:
    """{'email', 'action': 'extended' | 'comped' | 'ok' | 'skip', 'reason', 'to'}"""
    from admin_dashboard import _create_ghost_admin_token, _paid_tier_id, _same_instant
    email = (email or '').lower().strip()
    out = {'email': email, 'action': 'skip', 'reason': ''}
    access = await PM.membership_access(email)
    end = _utc(access['access_to']) if access else None
    if not end or end <= datetime.now(timezone.utc):
        out['reason'] = 'no paid year running'
        return out
    if end - datetime.now(timezone.utc) > timedelta(days=400):
        out['reason'] = 'end date more than a year away; left for a person to check'
        return out
    token = token or _create_ghost_admin_token()
    if not token:
        out['reason'] = 'Ghost Admin API not configured'
        return out
    async with httpx.AsyncClient(timeout=15.0) as client:
        member = await _member(client, email, token)
        if not member:
            out['reason'] = 'no Ghost member'
            return out
        labels = [(l.get('name') or '').lower() for l in (member.get('labels') or [])]
        status = member.get('status') or 'free'
        if 'paid-via-razorpay' not in labels:
            out['reason'] = 'not a Razorpay member'
            return out
        if status == 'paid':
            out['reason'] = 'paying through Ghost itself'
            return out
        tier_id, problem = await _paid_tier_id(client, token)
        if not tier_id:
            out['reason'] = problem
            return out
        ends = [_utc(t.get('expiry_at')) for t in (member.get('tiers') or []) if t.get('id') == tier_id]
        if status == 'comped':
            if any(e is None or e >= end - timedelta(hours=24) for e in ends):
                out.update(action='ok', reason='comp already runs to the end of their year')
                return out
        elif access.get('plan') != 'renewal':
            # Free in Ghost on a first year: Today's "Paying, but Ghost shows
            # free" list, where Venkat restores them after checking.
            out['reason'] = 'free in Ghost on a first year; left to Today'
            return out
        r = await client.put(
            f"{GHOST_URL}/ghost/api/admin/members/{member['id']}/",
            json={'members': [{'tiers': [{'id': tier_id, 'expiry_at': access['access_to']}]}]},
            headers={'Authorization': f'Ghost {token}'},
        )
        if r.status_code != 200:
            out['reason'] = f'Ghost refused the change (HTTP {r.status_code})'
            logger.error(f'ghost_comp: {email}: {out["reason"]} {r.text[:200]}')
            return out
        after = await _member(client, email, token) or {}
    after_ends = [t.get('expiry_at') for t in (after.get('tiers') or []) if t.get('id') == tier_id]
    after_labels = [(l.get('name') or '').lower() for l in (after.get('labels') or [])]
    ok = (after.get('status') == 'comped' and any(_same_instant(e, access['access_to']) for e in after_ends)
          and all(l in after_labels for l in labels if l in ('paid-via-razorpay', 'premium-subscriber')))
    out.update(action=('extended' if status == 'comped' else 'comped') if ok else 'skip',
               to=access['access_to'], reason='' if ok else f"Ghost shows status {after.get('status')}, ends {after_ends}")
    (logger.info if ok else logger.error)(f'ghost_comp: {email} to {access["access_to"]}: {out}')
    return out


async def on_new_payment(doc: dict):
    if (doc.get('plan') or '') not in PM.MEMBERSHIP_PLANS or doc.get('subscription_id'):
        return
    try:
        await extend_comp(doc.get('email') or '')
    except Exception as e:
        logger.warning(f"ghost_comp: new payment for {doc.get('email')!r}: {e!r}")


async def extend_renewed_comps(token: Optional[str] = None) -> list:
    """Everyone who renewed in the last 400 days. Returns the changes made."""
    if _db is None:
        return []
    since = datetime.now(timezone.utc) - timedelta(days=400)
    emails = await _db.payments.distinct('email', {'plan': 'renewal', 'razorpay_created_at': {'$gte': since}, **PM.COUNTS_FOR_ACCESS})
    changed = []
    for email in emails:
        try:
            r = await extend_comp(email, token)
        except Exception as e:
            logger.warning(f'ghost_comp: nightly check for {email!r}: {e!r}')
            continue
        if r['action'] in ('extended', 'comped'):
            changed.append(r)
    return changed
