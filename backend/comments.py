"""
comments.py — self-hosted article comments for TSOP.

Ghost's native Comments/Portal widgets were tried twice and abandoned both
times: first for an unwanted floating Subscribe button, then for internal
auth/CORS failures inside the widget itself that couldn't be debugged from
outside Ghost. This is a fully decoupled replacement — our own MongoDB
collection, our own endpoints, our own React component. It reuses the
existing member-verification pattern (Ghost Admin API lookup by email) that
already works reliably elsewhere in this backend, not Portal's separate and
broken auth flow.

Provides:
  * POST   /api/comments/submit           — member-only, creates a comment
                                             with status=pending
  * GET    /api/comments/{slug}           — public, approved comments only
  * GET    /api/comments/pending          — admin-only (ADMIN_KEY)
  * POST   /api/comments/{id}/moderate    — admin-only, approve or reject
  * DELETE /api/comments/{id}             — admin-only, remove a comment

Datastore:
  Mongo collection `comments`. Indexes (defensive, idempotent):
    post_slug + status + created_at  (article comment list)
    status + created_at              (moderation queue)

Dependencies:
  - GHOST_URL, GHOST_ADMIN_API_KEY   (existing)
  - ADMIN_KEY                        (existing)
"""
from __future__ import annotations

import os
import logging
import uuid
import html as html_lib
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field, EmailStr

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────────────────────────
GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

MAX_BODY_LENGTH = 2000

# ─── Module state injected by server.py at boot ──────────────────────────────
_db = None  # Motor Mongo client


def init(db_handle):
    global _db
    _db = db_handle


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.comments.create_index(
            [('post_slug', 1), ('status', 1), ('created_at', 1)]
        )
        await _db.comments.create_index([('status', 1), ('created_at', -1)])
    except Exception as e:
        logger.warning(f'comments index ensure failed (non-fatal): {e!r}')


router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _create_ghost_admin_token() -> Optional[str]:
    """JWT for Ghost Admin API; identical algorithm to server.py."""
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


async def _is_paid_ghost_member(email: str) -> bool:
    """Server-side membership check — mirrors /api/ghost/verify-member's
    is_paid logic, so a reader can't just POST an arbitrary email and have
    a comment accepted. Fails closed: any error means not verified."""
    token = _create_ghost_admin_token()
    if not token:
        return False
    try:
        encoded_email = quote(email, safe='')
        url = f"{GHOST_URL}/ghost/api/admin/members/?filter=email:'{encoded_email}'"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, headers={'Authorization': f'Ghost {token}'})
        if r.status_code != 200:
            return False
        members = r.json().get('members', [])
        if not members:
            return False
        member = members[0]
        status = member.get('status', 'free')
        labels = member.get('labels', [])
        label_names = [lbl.get('name', '').lower() for lbl in labels]
        has_paid_label = (
            any(label in label_names
                for label in ['paid-via-razorpay', 'paid-via-invoice', 'premium-subscriber', 'paid', 'premium', 'corporate-member'])
            or any(name.startswith('team-') for name in label_names)
        )
        return (
            status in ['paid', 'comped']
            or len(member.get('subscriptions', [])) > 0
            or has_paid_label
        )
    except Exception as e:
        logger.warning(f'comments membership check failed: {e!r}')
        return False


def _require_admin(x_admin_key: Optional[str]):
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail='Admin key not configured on server')
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Invalid admin key')


def _serialize(doc: dict) -> dict:
    return {
        'id': doc.get('comment_id'),
        'post_slug': doc.get('post_slug'),
        'parent_id': doc.get('parent_id'),
        'author_name': doc.get('author_name'),
        'author_email': doc.get('author_email'),
        'body': doc.get('body'),
        'status': doc.get('status'),
        'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
    }


# ─── Models ──────────────────────────────────────────────────────────────────
class CommentSubmit(BaseModel):
    post_slug: str = Field(..., min_length=1, max_length=300)
    author_email: EmailStr
    author_name: str = Field('', max_length=200)
    body: str = Field(..., min_length=1, max_length=MAX_BODY_LENGTH)
    # Set only for a reply. Must reference an approved, top-level comment
    # on the same post — one level of threading, no replies-to-replies.
    parent_id: Optional[str] = None


class CommentModerate(BaseModel):
    action: str  # 'approve' | 'reject'


# ─── Endpoints ───────────────────────────────────────────────────────────────
@router.post('/api/comments/submit')
async def submit_comment(req: CommentSubmit):
    """Member-only. Verifies the submitting email against Ghost server-side
    before accepting — never trusts a client-supplied membership claim.
    Always lands as status=pending; a human approves before it's public."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Comment store unavailable')
    await ensure_indexes()

    email_norm = req.author_email.lower().strip()
    if not await _is_paid_ghost_member(email_norm):
        raise HTTPException(status_code=403, detail='Comments are for subscribers')

    body_clean = html_lib.escape(req.body.strip())
    if not body_clean:
        raise HTTPException(status_code=400, detail='Comment cannot be empty')

    post_slug = req.post_slug.strip()
    parent_id = (req.parent_id or '').strip() or None
    if parent_id:
        parent = await _db.comments.find_one({
            'comment_id': parent_id,
            'post_slug': post_slug,
            'status': 'approved',
            'parent_id': None,
        })
        if not parent:
            raise HTTPException(status_code=400, detail='Cannot reply to that comment')

    comment_id = str(uuid.uuid4())
    doc = {
        'comment_id': comment_id,
        'post_slug': post_slug,
        'parent_id': parent_id,
        'author_email': email_norm,
        'author_name': (req.author_name or '').strip() or email_norm.split('@')[0],
        'body': body_clean,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc),
        'reviewed_at': None,
    }
    await _db.comments.insert_one(doc)
    return {'success': True, 'id': comment_id, 'status': 'pending'}


@router.get('/api/comments/pending')
async def get_pending_comments(
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
):
    """Admin-only moderation queue. Newest first.
    Registered before /api/comments/{slug} — FastAPI matches routes in
    registration order, and a literal path must come before a same-shape
    parameterized one or "pending" would be swallowed as a slug value."""
    _require_admin(x_admin_key)
    if _db is None:
        return []
    cursor = _db.comments.find({'status': 'pending'}).sort('created_at', -1)
    docs = await cursor.to_list(length=500)
    out = [_serialize(d) for d in docs]

    # Attach a snippet of the parent comment to replies, so a moderator has
    # context without a second lookup.
    parent_ids = {c['parent_id'] for c in out if c.get('parent_id')}
    if parent_ids:
        parents = await _db.comments.find({'comment_id': {'$in': list(parent_ids)}}).to_list(length=len(parent_ids))
        parent_by_id = {p['comment_id']: p for p in parents}
        for c in out:
            if c.get('parent_id') and c['parent_id'] in parent_by_id:
                p = parent_by_id[c['parent_id']]
                c['parent_preview'] = {
                    'author_name': p.get('author_name'),
                    'body': (p.get('body') or '')[:140],
                }
    return out


@router.get('/api/comments/{slug}')
async def get_comments(slug: str):
    """Public. Approved comments only, oldest first."""
    if _db is None:
        return []
    cursor = _db.comments.find(
        {'post_slug': slug, 'status': 'approved'}
    ).sort('created_at', 1)
    docs = await cursor.to_list(length=500)
    return [_serialize(d) for d in docs]


@router.post('/api/comments/{comment_id}/moderate')
async def moderate_comment(
    comment_id: str,
    req: CommentModerate,
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
):
    _require_admin(x_admin_key)
    if req.action not in ('approve', 'reject'):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    if _db is None:
        raise HTTPException(status_code=503, detail='Comment store unavailable')

    new_status = 'approved' if req.action == 'approve' else 'rejected'
    result = await _db.comments.update_one(
        {'comment_id': comment_id},
        {'$set': {'status': new_status, 'reviewed_at': datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Comment not found')
    return {'success': True, 'id': comment_id, 'status': new_status}


@router.delete('/api/comments/{comment_id}')
async def delete_comment(
    comment_id: str,
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
):
    _require_admin(x_admin_key)
    if _db is None:
        raise HTTPException(status_code=503, detail='Comment store unavailable')
    result = await _db.comments.delete_one({'comment_id': comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Comment not found')
    return {'success': True, 'id': comment_id}
