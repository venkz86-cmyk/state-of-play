"""
mixed_zone.py — Mixed Zone: short notes Venkat has heard, for annual members.

Named for the area where reporters catch athletes walking off after a
game. Internally each note is still a "drop" (drop_id, the drop/note
wording in this file); readers only ever see "note".

A drop is a few lines with a status that moves as the reporting does
(heard -> checking -> confirmed, or didnt_hold). Every status change is
kept with its date, so a reader can see a lead turn into a story; when it
does, the drop links to the story.

Members answer privately: a reply reaches Venkat only. He can post one
under the drop as an update, credited the way the reader allowed (their
title only if they ticked "OK to quote me by my title", otherwise a
credit line he writes himself).

Nothing here sends email. New drops show on the site as a count since the
member's last visit.

Who can read: annual members, i.e. anyone tiers.is_genuinely_paid passes
except on a 14-day nomination pass alone. Trial ("The Ten") is already
excluded by is_genuinely_paid.

Provides:
  * GET    /api/mixed-zone                       — member: every live drop
  * GET    /api/mixed-zone/new-count             — member: drops since last visit
  * POST   /api/mixed-zone/seen                  — member: mark the feed as read
  * POST   /api/mixed-zone/{id}/reply            — member: private reply
  * GET    /api/admin/mixed-zone                 — admin: drops with reply counts
  * POST   /api/admin/mixed-zone                 — admin: new drop
  * PATCH  /api/admin/mixed-zone/{id}            — admin: edit text, tags, status, story link
  * DELETE /api/admin/mixed-zone/{id}            — admin: remove a drop and its replies
  * GET    /api/admin/mixed-zone/{id}/replies    — admin: replies to one drop (marks them read)
  * POST   /api/admin/mixed-zone/{id}/updates    — admin: post an update under a drop
  * DELETE /api/admin/mixed-zone/{id}/updates/{update_id}

Datastore: Mongo `mixed_zone_notes`, `mixed_zone_replies`, `mixed_zone_visits` (email -> seen_at).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from admin_auth import require_admin_key_or_session
from tiers import is_genuinely_paid

logger = logging.getLogger(__name__)

router = APIRouter()
_db = None

STATUSES = ('heard', 'checking', 'confirmed', 'didnt_hold')
MAX_DROP_LENGTH = 1500
MAX_REPLY_LENGTH = 2000
MAX_TAGS = 6


def init(db_handle):
    global _db
    _db = db_handle


async def ensure_indexes():
    if _db is None:
        return
    try:
        await _db.mixed_zone_notes.create_index('drop_id', unique=True)
        await _db.mixed_zone_notes.create_index([('created_at', -1)])
        await _db.mixed_zone_replies.create_index([('drop_id', 1), ('created_at', -1)])
        await _db.mixed_zone_visits.create_index('email', unique=True)
    except Exception as e:
        logger.warning(f'mixed zone index ensure failed (non-fatal): {e!r}')


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value) -> Optional[str]:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _clean_tags(tags) -> list:
    out = []
    for tag in tags or []:
        tag = ' '.join(str(tag).split())[:40]
        if tag and tag.lower() not in (t.lower() for t in out):
            out.append(tag)
    return out[:MAX_TAGS]


async def is_annual_member(member: Optional[dict]) -> bool:
    """Paid, and not only on a nomination pass. A nominee's 14 days of
    full access come from the 'nomination-access' label alone; checking
    again without it tells a nominee from a member who also holds a
    nomination."""
    if not member or not member.get('is_paid'):
        return False
    labels = member.get('label_names') or []
    if 'nomination-access' not in labels:
        return True
    others = [name for name in labels if name != 'nomination-access']
    return await is_genuinely_paid(others, member.get('status', 'free'), member.get('email', ''))


async def _require_annual_member(request: Request) -> dict:
    from session_auth import get_current_member
    member = await get_current_member(request)
    if not member:
        raise HTTPException(status_code=401, detail='Sign in to read the Mixed Zone.')
    if not await is_annual_member(member):
        raise HTTPException(status_code=403, detail='The Mixed Zone is for annual members.')
    return member


def _serialize_drop(doc: dict) -> dict:
    return {
        'id': doc.get('drop_id'),
        'body': doc.get('body', ''),
        'tags': doc.get('tags') or [],
        'status': doc.get('status', 'heard'),
        'history': [
            {'status': h.get('status'), 'at': _iso(h.get('at'))}
            for h in (doc.get('history') or [])
        ],
        'story_url': doc.get('story_url') or '',
        'story_title': doc.get('story_title') or '',
        'updates': [
            {'id': u.get('update_id'), 'body': u.get('body', ''), 'credit': u.get('credit', ''), 'at': _iso(u.get('at'))}
            for u in (doc.get('updates') or [])
        ],
        'created_at': _iso(doc.get('created_at')),
        'updated_at': _iso(doc.get('updated_at')),
    }


def _serialize_reply(doc: dict) -> dict:
    return {
        'id': doc.get('reply_id'),
        'drop_id': doc.get('drop_id'),
        'email': doc.get('email', ''),
        'name': doc.get('name', ''),
        'title': doc.get('title', ''),
        'quote_ok': bool(doc.get('quote_ok')),
        'body': doc.get('body', ''),
        'created_at': _iso(doc.get('created_at')),
        'read': bool(doc.get('read')),
        'posted': bool(doc.get('posted')),
    }


# ─── Member side ─────────────────────────────────────────────────────────────
@router.get('/api/mixed-zone')
async def list_drops(request: Request):
    member = await _require_annual_member(request)
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    docs = await _db.mixed_zone_notes.find({}).sort('created_at', -1).to_list(length=500)
    visit = await _db.mixed_zone_visits.find_one({'email': member['email']})
    return {
        'drops': [_serialize_drop(d) for d in docs],
        'last_seen_at': _iso((visit or {}).get('seen_at')),
    }


@router.get('/api/mixed-zone/new-count')
async def new_drops_count(request: Request):
    """0 for anyone who can't read drops, so the site can call it for
    every signed-in reader without a separate eligibility check. 'eligible'
    lets the account page decide whether to link to the feed."""
    from session_auth import get_current_member
    member = await get_current_member(request)
    if _db is None or not await is_annual_member(member):
        return {'eligible': False, 'count': 0}
    visit = await _db.mixed_zone_visits.find_one({'email': member['email']})
    query = {}
    if visit and visit.get('seen_at'):
        query['created_at'] = {'$gt': visit['seen_at']}
    return {'eligible': True, 'count': await _db.mixed_zone_notes.count_documents(query)}


@router.post('/api/mixed-zone/seen')
async def mark_drops_seen(request: Request):
    member = await _require_annual_member(request)
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    await _db.mixed_zone_visits.update_one(
        {'email': member['email']}, {'$set': {'seen_at': _now()}}, upsert=True,
    )
    return {'success': True}


class ReplyBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=MAX_REPLY_LENGTH)
    title: str = Field('', max_length=80)
    quote_ok: bool = False


@router.post('/api/mixed-zone/{drop_id}/reply')
async def reply_to_drop(drop_id: str, req: ReplyBody, request: Request):
    member = await _require_annual_member(request)
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    if not await _db.mixed_zone_notes.find_one({'drop_id': drop_id}):
        raise HTTPException(status_code=404, detail='That note is no longer up.')
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail='Write something first.')
    title = ' '.join(req.title.split())
    doc = {
        'reply_id': str(uuid.uuid4()),
        'drop_id': drop_id,
        'email': member['email'],
        'name': member.get('name') or '',
        'title': title,
        'quote_ok': bool(req.quote_ok and title),
        'body': body,
        'created_at': _now(),
        'read': False,
        'posted': False,
    }
    await _db.mixed_zone_replies.insert_one(doc)
    return {'success': True}


# ─── Admin side ──────────────────────────────────────────────────────────────
class DropCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=MAX_DROP_LENGTH)
    tags: list[str] = []
    status: str = 'heard'


class DropEdit(BaseModel):
    body: Optional[str] = Field(None, max_length=MAX_DROP_LENGTH)
    tags: Optional[list[str]] = None
    status: Optional[str] = None
    story_url: Optional[str] = Field(None, max_length=500)
    story_title: Optional[str] = Field(None, max_length=300)


class UpdateCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=MAX_REPLY_LENGTH)
    credit: str = Field('', max_length=120)
    reply_id: Optional[str] = None


def _check_status(status: str) -> str:
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail=f'status must be one of {", ".join(STATUSES)}')
    return status


def _check_story_url(url: str) -> str:
    url = url.strip()
    if url and not (url.startswith('https://') or url.startswith('/')):
        raise HTTPException(status_code=400, detail='The story link must start with https:// or /')
    return url


@router.get('/api/admin/mixed-zone')
async def admin_list_drops(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'drops': [], 'unread': 0}
    docs = await _db.mixed_zone_notes.find({}).sort('created_at', -1).to_list(length=500)
    counts = {}
    async for row in _db.mixed_zone_replies.aggregate([
        {'$group': {
            '_id': '$drop_id',
            'replies': {'$sum': 1},
            'unread': {'$sum': {'$cond': [{'$eq': ['$read', True]}, 0, 1]}},
        }},
    ]):
        counts[row['_id']] = row
    out = []
    for d in docs:
        item = _serialize_drop(d)
        c = counts.get(d.get('drop_id')) or {}
        item['replies'] = c.get('replies', 0)
        item['unread'] = c.get('unread', 0)
        out.append(item)
    return {'drops': out, 'unread': sum(item['unread'] for item in out)}


@router.post('/api/admin/mixed-zone')
async def admin_create_drop(req: DropCreate, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    await ensure_indexes()
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail='Write the note first.')
    status = _check_status(req.status)
    now = _now()
    doc = {
        'drop_id': uuid.uuid4().hex[:12],
        'body': body,
        'tags': _clean_tags(req.tags),
        'status': status,
        'history': [{'status': status, 'at': now}],
        'story_url': '',
        'story_title': '',
        'updates': [],
        'created_at': now,
        'updated_at': now,
    }
    await _db.mixed_zone_notes.insert_one(doc)
    return _serialize_drop(doc)


@router.patch('/api/admin/mixed-zone/{drop_id}')
async def admin_edit_drop(drop_id: str, req: DropEdit, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    doc = await _db.mixed_zone_notes.find_one({'drop_id': drop_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Note not found')
    now = _now()
    changes = {}
    push = None
    if req.body is not None:
        body = req.body.strip()
        if not body:
            raise HTTPException(status_code=400, detail='A note cannot be empty.')
        changes['body'] = body
    if req.tags is not None:
        changes['tags'] = _clean_tags(req.tags)
    if req.status is not None and req.status != doc.get('status'):
        changes['status'] = _check_status(req.status)
        push = {'history': {'status': req.status, 'at': now}}
    if req.story_url is not None:
        changes['story_url'] = _check_story_url(req.story_url)
    if req.story_title is not None:
        changes['story_title'] = req.story_title.strip()
    if not changes:
        return _serialize_drop(doc)
    changes['updated_at'] = now
    update = {'$set': changes}
    if push:
        update['$push'] = push
    await _db.mixed_zone_notes.update_one({'drop_id': drop_id}, update)
    return _serialize_drop(await _db.mixed_zone_notes.find_one({'drop_id': drop_id}))


@router.delete('/api/admin/mixed-zone/{drop_id}')
async def admin_delete_drop(drop_id: str, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    result = await _db.mixed_zone_notes.delete_one({'drop_id': drop_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Note not found')
    await _db.mixed_zone_replies.delete_many({'drop_id': drop_id})
    return {'success': True}


@router.get('/api/admin/mixed-zone/{drop_id}/replies')
async def admin_drop_replies(drop_id: str, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return []
    docs = await _db.mixed_zone_replies.find({'drop_id': drop_id}).sort('created_at', -1).to_list(length=500)
    await _db.mixed_zone_replies.update_many({'drop_id': drop_id, 'read': {'$ne': True}}, {'$set': {'read': True}})
    return [_serialize_reply(d) for d in docs]


@router.post('/api/admin/mixed-zone/{drop_id}/updates')
async def admin_post_update(drop_id: str, req: UpdateCreate, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    if not await _db.mixed_zone_notes.find_one({'drop_id': drop_id}):
        raise HTTPException(status_code=404, detail='Note not found')
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail='An update cannot be empty.')
    credit = ' '.join(req.credit.split())
    if req.reply_id:
        reply = await _db.mixed_zone_replies.find_one({'reply_id': req.reply_id, 'drop_id': drop_id})
        if not reply:
            raise HTTPException(status_code=404, detail='Reply not found')
        # A reader's title goes out only if they said it could.
        if credit and credit == reply.get('title') and not reply.get('quote_ok'):
            raise HTTPException(status_code=400, detail='This reader did not agree to be quoted by title.')
    now = _now()
    update = {'update_id': uuid.uuid4().hex[:12], 'body': body, 'credit': credit, 'at': now}
    await _db.mixed_zone_notes.update_one(
        {'drop_id': drop_id},
        {'$push': {'updates': update}, '$set': {'updated_at': now}},
    )
    if req.reply_id:
        await _db.mixed_zone_replies.update_one({'reply_id': req.reply_id}, {'$set': {'posted': True, 'read': True}})
    return _serialize_drop(await _db.mixed_zone_notes.find_one({'drop_id': drop_id}))


@router.delete('/api/admin/mixed-zone/{drop_id}/updates/{update_id}')
async def admin_delete_update(drop_id: str, update_id: str, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Mixed Zone unavailable')
    result = await _db.mixed_zone_notes.update_one(
        {'drop_id': drop_id}, {'$pull': {'updates': {'update_id': update_id}}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Note not found')
    return {'success': True}
