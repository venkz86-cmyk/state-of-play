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
  * POST   /api/comments/{id}/edit        — comment owner only, edits an
                                             already-approved comment's body
                                             in place. No re-moderation —
                                             the comment was already vetted
                                             once; this matches how e.g.
                                             Reddit treats edits, not how a
                                             brand-new comment is treated.
  * GET    /api/comments/{slug}           — public, approved comments only
  * GET    /api/comments/pending          — admin-only
  * POST   /api/comments/{id}/moderate    — admin-only, approve or reject
  * DELETE /api/comments/{id}             — admin-only, remove a comment

Datastore:
  Mongo collection `comments`. Indexes (defensive, idempotent):
    post_slug + status + created_at  (article comment list)
    status + created_at              (moderation queue)

Dependencies:
  - GHOST_URL, GHOST_ADMIN_API_KEY   (existing)
  - Admin gate is admin_auth.require_admin_key_or_session (X-Admin-Key or
    an admin dashboard session -- see admin_auth.py)
"""
from __future__ import annotations

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr

from admin_auth import require_admin_key_or_session
from tiers import find_ghost_member, is_genuinely_paid

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────────────────────────
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')

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
        await _db.comments.create_index([('author_email', 1), ('created_at', -1)])
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
    """Server-side membership check. Single source of truth is
    tiers.is_genuinely_paid -- the same check every other paid-access
    gate in this codebase now uses. Was previously its own fourth
    independent copy of the same flawed status/subscription/label
    check (see tiers.py's own docstring on why that's wrong): a
    mislabeled Trial member -- carrying a stray paid label or native
    subscription left over from the now-retired Razorpay Zap -- could
    have posted comments despite Trial explicitly not including that
    access. Fails closed: any error means not verified."""
    token = _create_ghost_admin_token()
    if not token:
        return False
    try:
        member = await find_ghost_member(email, token)
        if not member:
            return False
        label_names = [(lbl.get('name') or '').lower() for lbl in (member.get('labels') or [])]
        return await is_genuinely_paid(label_names, member.get('status', 'free'), email)
    except Exception as e:
        logger.warning(f'comments membership check failed: {e!r}')
        return False


def _serialize(doc: dict, *, viewer_email: Optional[str] = None, include_email: bool = True) -> dict:
    """include_email=False is for the public /{slug} endpoint: other
    people's emails have no reason to be visible to every reader, and
    since edits now apply immediately with no moderation step to catch a
    forged author_email, keeping them out of the public payload closes
    off the easy way to find one to impersonate. viewer_email, when
    given, adds an is_own flag instead — enough for the frontend to show
    its own Edit button without needing the raw address."""
    out = {
        'id': doc.get('comment_id'),
        'post_slug': doc.get('post_slug'),
        'parent_id': doc.get('parent_id'),
        'author_name': doc.get('author_name'),
        'author_title': doc.get('author_title'),
        'body': doc.get('body'),
        'status': doc.get('status'),
        'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
        'edited_at': doc.get('edited_at').isoformat() if doc.get('edited_at') else None,
    }
    if include_email:
        out['author_email'] = doc.get('author_email')
    if viewer_email:
        out['is_own'] = (doc.get('author_email') or '') == viewer_email
    return out


# ─── Models ──────────────────────────────────────────────────────────────────
class CommentSubmit(BaseModel):
    post_slug: str = Field(..., min_length=1, max_length=300)
    author_email: EmailStr
    author_name: str = Field('', max_length=200)
    # Optional context line — "Portfolio Manager, XYZ Capital" — shown next
    # to the name. Same 50-char cap as Ghost's own version of this field.
    author_title: str = Field('', max_length=50)
    body: str = Field(..., min_length=1, max_length=MAX_BODY_LENGTH)
    # Set only for a reply. Must reference an approved, top-level comment
    # on the same post — one level of threading, no replies-to-replies.
    parent_id: Optional[str] = None


class CommentModerate(BaseModel):
    action: str  # 'approve' | 'reject'


class CommentEdit(BaseModel):
    author_email: EmailStr
    body: str = Field(..., min_length=1, max_length=MAX_BODY_LENGTH)


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

    # Store as plain text, not HTML-escaped — the frontend renders this via
    # plain JSX text interpolation, which already escapes on display. Storing
    # pre-escaped text here would double-escape (an apostrophe would render
    # as the literal string "&#x27;" instead of "'").
    body_clean = req.body.strip()
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
        'author_title': (req.author_title or '').strip(),
        'body': body_clean,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc),
        'reviewed_at': None,
    }
    await _db.comments.insert_one(doc)
    return {'success': True, 'id': comment_id, 'status': 'pending'}


@router.post('/api/comments/{comment_id}/edit')
async def edit_comment(comment_id: str, req: CommentEdit):
    """A commenter editing their own, already-live comment. Applies
    immediately -- no moderation queue, unlike a brand-new comment. The
    comment already went through review once to get published; an edit
    to it is the author's own prerogative from there, the same way
    Reddit lets you edit a live comment without it vanishing back into
    a mod queue. Ownership is the stored author_email matching the
    caller's -- the same trust boundary submit_comment already uses (a
    real, Ghost-verified email), not a separate session token this
    module has no concept of."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Comment store unavailable')

    email_norm = req.author_email.lower().strip()
    doc = await _db.comments.find_one({'comment_id': comment_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Comment not found')
    if doc.get('author_email') != email_norm:
        raise HTTPException(status_code=403, detail='You can only edit your own comment')
    if doc.get('status') != 'approved':
        raise HTTPException(status_code=400, detail='Only a published comment can be edited')

    body_clean = req.body.strip()
    if not body_clean:
        raise HTTPException(status_code=400, detail='Comment cannot be empty')
    if body_clean == doc.get('body'):
        raise HTTPException(status_code=400, detail='No changes to submit')

    edited_at = datetime.now(timezone.utc)
    await _db.comments.update_one(
        {'comment_id': comment_id},
        {'$set': {'body': body_clean, 'edited_at': edited_at}},
    )
    return {'success': True, 'id': comment_id, 'body': body_clean, 'edited_at': edited_at.isoformat()}


@router.get('/api/comments/my-title')
async def get_my_title(email: str):
    """The commenter's own title/affiliation, so the field can be
    pre-filled on any device rather than only remembered per-browser.
    Derived from their most recent comment that set one — no separate
    profile store needed. Public data (it's shown on every comment they
    post anyway), so no auth beyond knowing the email.
    Registered before /api/comments/{slug} for the same route-ordering
    reason as /pending and /approved above."""
    if _db is None:
        return {'title': ''}
    doc = await _db.comments.find_one(
        {'author_email': email.lower().strip(), 'author_title': {'$nin': [None, '']}},
        sort=[('created_at', -1)],
    )
    return {'title': (doc or {}).get('author_title', '')}


@router.get('/api/comments/pending')
async def get_pending_comments(
    _admin: None = Depends(require_admin_key_or_session),
):
    """Admin-only moderation queue. Newest first — brand-new comments only.
    An edit to an already-live comment applies immediately (see
    edit_comment) and never lands here.
    Registered before /api/comments/{slug} — FastAPI matches routes in
    registration order, and a literal path must come before a same-shape
    parameterized one or "pending" would be swallowed as a slug value."""
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


@router.get('/api/comments/approved')
async def get_approved_comments(
    _admin: None = Depends(require_admin_key_or_session),
):
    """Admin-only. Every live (approved) comment across all posts, newest
    first — the only way to find something to delete after the fact, since
    the public /{slug} endpoint is scoped to one post. Also registered
    before /api/comments/{slug} for the same route-ordering reason as
    /pending above."""
    if _db is None:
        return []
    cursor = _db.comments.find({'status': 'approved'}).sort('created_at', -1)
    docs = await cursor.to_list(length=500)
    return [_serialize(d) for d in docs]


@router.get('/api/comments/{slug}')
async def get_comments(slug: str, viewer_email: Optional[str] = None):
    """Public. Approved comments only, oldest first. Never includes any
    author's raw email (see _serialize) — viewer_email, when passed, only
    gets back an is_own flag on the caller's own comments, enough for the
    frontend to show its own Edit button."""
    if _db is None:
        return []
    cursor = _db.comments.find(
        {'post_slug': slug, 'status': 'approved'}
    ).sort('created_at', 1)
    docs = await cursor.to_list(length=500)
    viewer_norm = viewer_email.lower().strip() if viewer_email else None
    return [_serialize(d, viewer_email=viewer_norm, include_email=False) for d in docs]


@router.post('/api/comments/{comment_id}/moderate')
async def moderate_comment(
    comment_id: str,
    req: CommentModerate,
    _admin: None = Depends(require_admin_key_or_session),
):
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
    _admin: None = Depends(require_admin_key_or_session),
):
    if _db is None:
        raise HTTPException(status_code=503, detail='Comment store unavailable')
    result = await _db.comments.delete_one({'comment_id': comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Comment not found')
    return {'success': True, 'id': comment_id}
