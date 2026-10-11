"""
Group story links (October 2026).

Venkat shares one paid story with a WhatsApp group: a short link
(/g/<code>) that opens the story in full for anyone in the group who
signs in with their email, until the link's last day (3 days by default).
Reading takes a 6-digit code to that email, so a forwarded link still
names every reader and a made-up address gets nowhere. Every reader is
logged against the link; a new email becomes a free member (label
'group-link').

The end of the story offers a first year at ₹2,949 (₹2,499 + GST, $120
outside India) until the same last day. That offer is an ordinary event
invite (invite_links.py) created with the group link, so checkout, the
price and purchase tracking are the invite system's own.

Endpoints:
  GET  /api/group-links/{code}               public: headline, preview, state
  POST /api/group-links/{code}/request-code  public: email a sign-in code
  GET  /api/group-links/{code}/story         signed in: the full story
  GET  /api/group-links/{code}/og            link preview for WhatsApp etc.
  GET  /api/admin/group-links                admin: links with counts
  POST /api/admin/group-links                admin: create
  GET  /api/admin/group-links/{code}/readers admin: who read it
  POST /api/admin/group-links/{code}/close   admin: close early
  DELETE /api/admin/group-links/{code}       admin: delete (e.g. to send later)
"""
from __future__ import annotations

import asyncio
import html as _html
import logging
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

from admin_auth import require_admin_key_or_session

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

IST = timezone(timedelta(hours=5, minutes=30))
BASE = 'https://www.stateofplay.club'
GHOST_ORIGIN = 'https://the-state-of-play.ghost.io'
DEFAULT_DAYS = 3
READER_LABEL = 'group-link'
_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'


def init(db_handle):
    global _db
    _db = db_handle


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value) -> Optional[datetime]:
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _iso(value) -> Optional[str]:
    value = _aware(value)
    return value.isoformat() if value else None


def _clean(code: str) -> str:
    code = (code or '').strip().lower()
    return code if code and len(code) <= 16 and all(c in _ALPHABET for c in code) else ''


def _state(doc: Optional[dict]) -> str:
    if not doc:
        return 'unknown'
    if doc.get('closed'):
        return 'closed'
    if _now() >= _aware(doc['expires_at']):
        return 'expired'
    return 'open'


def long_date(dt: datetime) -> str:
    return dt.astimezone(IST).strftime('%B %-d, %Y')


def last_day_of(doc: dict) -> str:
    """The last day readers can open it (the link closes at the end of it)."""
    return long_date(_aware(doc['expires_at']) - timedelta(seconds=1))


def slug_from(story: str) -> str:
    story = (story or '').strip()
    if '://' in story or story.startswith('www.') or '/' in story:
        path = urlparse(story if '://' in story else f'https://{story}').path
        parts = [p for p in path.split('/') if p]
        story = parts[-1] if parts else ''
    return story if re.fullmatch(r'[a-z0-9][a-z0-9-]{0,190}', story or '') else ''


def _site_links(html: str) -> str:
    return (html or '').replace(GHOST_ORIGIN, BASE)


def _preview(html: str) -> str:
    """What anyone with the link sees before signing in: the story up to
    Ghost's paywall marker, or its first two paragraphs."""
    html = html or ''
    if '<!--members-only-->' in html:
        return _site_links(html.split('<!--members-only-->')[0])
    paras = re.findall(r'<p[^>]*>.*?</p>', html, flags=re.S)
    return _site_links(''.join(paras[:2]))


async def _post(slug: str) -> Optional[dict]:
    from nominations import _ghost_fetch_post
    return await _ghost_fetch_post(slug)


# Public lookups are rate-limited per IP, like invite links.
_BUCKET: dict = {}


def _allow(ip: str, burst: float = 20.0, refill: float = 1 / 10) -> bool:
    import time
    now = time.monotonic()
    b = _BUCKET.setdefault(ip, {'t': burst, 'at': now})
    b['t'] = min(burst, b['t'] + (now - b['at']) * refill)
    b['at'] = now
    if b['t'] >= 1:
        b['t'] -= 1
        return True
    return False


def _ip(request: Request) -> str:
    return (request.headers.get('x-forwarded-for', '').split(',')[0].strip()
            or getattr(getattr(request, 'client', None), 'host', None) or '0.0.0.0')


async def _link(code: str) -> Optional[dict]:
    code = _clean(code)
    if _db is None or not code:
        return None
    return await _db.group_links.find_one({'code': code})


# ─── Public ──────────────────────────────────────────────────────────────────

@router.get('/api/group-links/{code}')
async def public_link(code: str, request: Request):
    if not _allow(_ip(request)):
        raise HTTPException(status_code=429, detail='Too many tries. Wait a minute.')
    doc = await _link(code)
    state = _state(doc)
    if state == 'unknown':
        return {'state': 'unknown'}
    out = {
        'state': state, 'group_name': doc['group_name'], 'title': doc['title'],
        'excerpt': doc.get('excerpt') or '', 'feature_image': doc.get('feature_image') or '',
        'author': doc.get('author') or 'Venkat Ananth', 'published_at': doc.get('published_at'),
        'last_day': last_day_of(doc), 'expires_at': _iso(doc['expires_at']),
        'invite_code': doc.get('invite_code') if state == 'open' else '', 'slug': doc['slug'],
    }
    if state == 'open':
        out['preview_html'] = doc.get('preview_html') or ''
    return out


class CodeBody(BaseModel):
    email: EmailStr


@router.post('/api/group-links/{code}/request-code')
async def request_code_for_link(code: str, body: CodeBody, request: Request):
    """Emails a 6-digit sign-in code. A new email first becomes a free
    member (so the site's own code sign-in can send to it); nobody is
    signed in until the code comes back."""
    if not _allow('code:' + _ip(request), burst=6.0, refill=1 / 60):
        raise HTTPException(status_code=429, detail='Too many tries. Wait a minute and try again.')
    doc = await _link(code)
    if _state(doc) != 'open':
        raise HTTPException(status_code=410, detail='This link has closed.')
    import session_auth as SA
    from tiers import find_ghost_member, create_ghost_member, _create_ghost_admin_token
    email = str(body.email).lower().strip()
    domain = email.rsplit('@', 1)[-1]
    if not await asyncio.to_thread(SA._domain_can_receive_mail, domain):
        raise HTTPException(status_code=400, detail="That email address can't receive mail. Check it and try again.")
    token = _create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail='Sign-in is unavailable for a moment. Try again shortly.')
    if not await find_ghost_member(email, token):
        member = await create_ghost_member(email, '', [READER_LABEL], token, note=f'Read a shared story via {doc["group_name"]}')
        if not member:
            raise HTTPException(status_code=502, detail='Could not set up your sign-in. Try again shortly.')
        await _db.group_link_readers.update_one(
            {'code': doc['code'], 'email': email},
            {'$setOnInsert': {'code': doc['code'], 'email': email, 'new_member': True, 'asked_at': _now()}},
            upsert=True,
        )
        try:
            from payments import record_signup
            await record_signup('free', email, source='group-link', ref=doc['code'], landing=f'/g/{doc["code"]}')
        except Exception as e:
            logger.warning(f'group-links: signup not recorded for {email}: {e!r}')
    await SA.request_code(SA.RequestCodeBody(email=email))
    return {'sent': True}


@router.get('/api/group-links/{code}/story')
async def full_story(code: str, request: Request):
    from session_auth import get_current_member
    member = await get_current_member(request)
    if not member:
        raise HTTPException(status_code=401, detail='Sign in to read this story.')
    doc = await _link(code)
    if _state(doc) != 'open':
        raise HTTPException(status_code=410, detail='This link has closed.')
    post = await _post(doc['slug'])
    if not post:
        raise HTTPException(status_code=502, detail='The story could not be loaded. Try again shortly.')
    email = member['email'].lower().strip()
    now = _now()
    await _db.group_link_readers.update_one(
        {'code': doc['code'], 'email': email},
        {'$setOnInsert': {'code': doc['code'], 'email': email, 'new_member': False, 'asked_at': now},
         '$set': {'last_read_at': now}, '$inc': {'reads': 1}},
        upsert=True,
    )
    await _db.group_link_readers.update_one(
        {'code': doc['code'], 'email': email, 'first_read_at': {'$exists': False}},
        {'$set': {'first_read_at': now}},
    )
    return {'html': _site_links(post.get('html') or ''), 'is_paid': bool(member.get('is_paid'))}


_OG = """<!doctype html><html><head><meta charset="utf-8">
<title>{title}</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="The State of Play">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
{image}<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
</head><body><p><a href="{url}">{title}</a></p></body></html>"""


@router.get('/api/group-links/{code}/og', response_class=HTMLResponse)
async def og(code: str):
    """What WhatsApp, LinkedIn and the like show when the link is pasted."""
    doc = await _link(code)
    if not doc:
        return HTMLResponse(_OG.format(title='The State of Play', desc='Reporting on the business of Indian sport.',
                                       url=BASE, image=''), status_code=404)
    desc = f'Shared with {doc["group_name"]}. Free to read until {last_day_of(doc)}.'
    image = f'<meta property="og:image" content="{_html.escape(doc["feature_image"])}">\n' if doc.get('feature_image') else ''
    return HTMLResponse(_OG.format(title=_html.escape(doc['title']), desc=_html.escape(desc),
                                   url=f'{BASE}/g/{doc["code"]}', image=image))


# ─── Dashboard ───────────────────────────────────────────────────────────────

class CreateBody(BaseModel):
    story: str
    group_name: str
    days: int = DEFAULT_DAYS


def _new_code() -> str:
    return ''.join(secrets.choice(_ALPHABET) for _ in range(7))


async def _counts(doc: dict) -> dict:
    readers = await _db.group_link_readers.find({'code': doc['code']}).to_list(length=10000)
    read = [r for r in readers if r.get('first_read_at')]
    invite = await _db.invite_links.find_one({'code': doc.get('invite_code')}) if doc.get('invite_code') else None
    joined = (invite or {}).get('uses') or []
    return {'readers': len(read), 'new_members': sum(1 for r in read if r.get('new_member')), 'joined': len(joined)}


async def _serialize(doc: dict) -> dict:
    return {
        'code': doc['code'], 'url': f'{BASE}/g/{doc["code"]}', 'group_name': doc['group_name'],
        'title': doc['title'], 'slug': doc['slug'], 'state': _state(doc),
        'created_at': _iso(doc['created_at']), 'expires_at': _iso(doc['expires_at']), 'last_day': last_day_of(doc),
        'whatsapp_text': f'{doc["title"]}. Free to read until {last_day_of(doc)}: {BASE}/g/{doc["code"]}',
        **(await _counts(doc)),
    }


@router.post('/api/admin/group-links')
async def create(body: CreateBody, _admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        raise HTTPException(status_code=503, detail='Unavailable')
    slug = slug_from(body.story)
    group = ' '.join((body.group_name or '').split())
    if not slug:
        raise HTTPException(status_code=400, detail='Paste the story’s link from the site, or its slug.')
    if not group:
        raise HTTPException(status_code=400, detail='Name the group, so readers see who shared it.')
    days = max(1, min(int(body.days or DEFAULT_DAYS), 14))
    post = await _post(slug)
    if not post:
        raise HTTPException(status_code=404, detail=f'No story found at “{slug}”.')
    today = _now().astimezone(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    expires_at = (today + timedelta(days=days + 1)).astimezone(timezone.utc)
    import invite_links as IL
    invite = {
        'code': IL._new_code(), 'name': f'Group: {group}', 'max_uses': None, 'kind': 'event',
        'expires_at': expires_at, 'created_at': _now(), 'uses': [], 'closed': False, 'email': '',
        'group_link': True,
    }
    await _db.invite_links.insert_one(invite)
    try:
        await _db.group_links.create_index('code', unique=True)
        await _db.group_link_readers.create_index([('code', 1), ('email', 1)], unique=True)
    except Exception as e:
        logger.warning(f'group-links index ensure failed (non-fatal): {e!r}')
    doc = {
        'code': _new_code(), 'slug': slug, 'group_name': group, 'title': post.get('title') or slug,
        'excerpt': post.get('custom_excerpt') or post.get('excerpt') or '',
        'feature_image': post.get('feature_image') or '', 'author': ((post.get('authors') or [{}])[0]).get('name') or '',
        'published_at': post.get('published_at'), 'preview_html': _preview(post.get('html') or ''),
        'invite_code': invite['code'], 'created_at': _now(), 'expires_at': expires_at, 'closed': False,
    }
    await _db.group_links.insert_one(doc)
    return await _serialize(doc)


@router.get('/api/admin/group-links')
async def list_links(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'links': []}
    docs = await _db.group_links.find({}).sort('created_at', -1).to_list(length=200)
    return {'links': [await _serialize(d) for d in docs]}


@router.get('/api/admin/group-links/{code}/readers')
async def readers(code: str, _admin: None = Depends(require_admin_key_or_session)):
    doc = await _link(code)
    if not doc:
        raise HTTPException(status_code=404, detail='Link not found')
    rows = await _db.group_link_readers.find({'code': doc['code'], 'first_read_at': {'$exists': True}}).to_list(length=10000)
    invite = await _db.invite_links.find_one({'code': doc.get('invite_code')}) or {}
    joined = {u.get('email') for u in invite.get('uses') or []}
    rows.sort(key=lambda r: _aware(r.get('first_read_at')) or _now())
    return {'readers': [{'email': r['email'], 'first_read_at': _iso(r.get('first_read_at')),
                         'new_member': bool(r.get('new_member')), 'joined': r['email'] in joined} for r in rows]}


@router.post('/api/admin/group-links/{code}/close')
async def close(code: str, _admin: None = Depends(require_admin_key_or_session)):
    doc = await _link(code)
    if not doc:
        raise HTTPException(status_code=404, detail='Link not found')
    await _db.group_links.update_one({'code': doc['code']}, {'$set': {'closed': True}})
    if doc.get('invite_code'):
        await _db.invite_links.update_one({'code': doc['invite_code']}, {'$set': {'closed': True}})
    return {'success': True}


@router.delete('/api/admin/group-links/{code}')
async def delete(code: str, _admin: None = Depends(require_admin_key_or_session)):
    """Removes the link, its reader log and its offer, so it can be made
    again later in the week with a fresh window. An offer someone already
    paid through is kept (closed), so the payment's record stays whole."""
    doc = await _link(code)
    if not doc:
        raise HTTPException(status_code=404, detail='Link not found')
    await _db.group_links.delete_one({'code': doc['code']})
    await _db.group_link_readers.delete_many({'code': doc['code']})
    if doc.get('invite_code'):
        invite = await _db.invite_links.find_one({'code': doc['invite_code']}) or {}
        if invite.get('uses'):
            await _db.invite_links.update_one({'code': doc['invite_code']}, {'$set': {'closed': True}})
        else:
            await _db.invite_links.delete_one({'code': doc['invite_code']})
    return {'success': True}
