"""Hands a story from the browser to the home-screen app on the same phone.

A link tapped in an email opens in the browser, and on iPhone a link can't
open a home-screen app at all. So a story page on a phone offers "Read this
in the app": tapping it leaves a hand-off here (POST), and when the reader
opens the app within two minutes, the app asks for it (GET) and opens on
that story.

The browser and the app on one phone are matched by account when the
reader is signed in on both, otherwise by IP address and device (the
part of the user agent naming the phone and its system, which the browser
and the app share). iCloud Private Relay can give the two different IP
addresses; then nothing is waiting and the app opens as usual.

Stored: the path, a hash of IP and device, the email when signed in, and
an expiry two minutes on (a TTL index removes it); a claim deletes it.
Only story and Left Field edition paths are accepted, so this can't send
the app anywhere else.
"""
import hashlib
import logging
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

TTL = timedelta(minutes=2)
_PATH = re.compile(r'^/(?:left-field/e/)?[a-z0-9][a-z0-9-]{0,150}$')
_RATE: dict = defaultdict(lambda: {'t': 10.0, 'at': time.monotonic()})


def init(db_handle):
    global _db
    _db = db_handle


async def ensure_indexes():
    if _db is not None:
        await _db.app_handoffs.create_index('expires_at', expireAfterSeconds=0)


def _ip(request: Request) -> str:
    return (request.headers.get('x-forwarded-for', '').split(',')[0].strip()
            or getattr(getattr(request, 'client', None), 'host', None) or '0.0.0.0')


def _device(request: Request) -> str:
    """'(iPhone; CPU iPhone OS 18_0 like Mac OS X)': the same in Safari and
    in the home-screen app, unlike the rest of the user agent."""
    m = re.search(r'\(([^)]*)\)', request.headers.get('user-agent', ''))
    return m.group(1) if m else ''


def _key(request: Request) -> str:
    return hashlib.sha256(f'{_ip(request)}|{_device(request)}'.encode()).hexdigest()


def _email(request: Request) -> str:
    try:
        from session_auth import _read_session
        s = _read_session(request) or {}
        return (s.get('email') or '').lower().strip()
    except Exception:
        return ''


def _allowed(request: Request) -> bool:
    b = _RATE[_ip(request)]
    now = time.monotonic()
    b['t'] = min(10.0, b['t'] + (now - b['at']) / 6)  # 10 in a row, then one every 6s
    b['at'] = now
    if b['t'] >= 1:
        b['t'] -= 1
        return True
    return False


class OfferBody(BaseModel):
    path: str


@router.post('/api/handoff')
async def offer(body: OfferBody, request: Request):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    path = (body.path or '').split('?')[0].split('#')[0].rstrip('/') or '/'
    if not _PATH.match(path):
        raise HTTPException(status_code=400, detail='Not a story')
    if not _allowed(request):
        raise HTTPException(status_code=429, detail='Too many requests')
    await ensure_indexes()
    now = datetime.now(timezone.utc)
    await _db.app_handoffs.update_one(
        {'key': _key(request)},
        {'$set': {'path': path, 'email': _email(request), 'created_at': now, 'expires_at': now + TTL}},
        upsert=True,
    )
    return {'ok': True}


@router.get('/api/handoff')
async def claim(request: Request):
    """The story waiting for this phone, once, or {'path': None}."""
    if _db is None or not _allowed(request):
        return {'path': None}
    now = datetime.now(timezone.utc)
    email = _email(request)
    query = {'expires_at': {'$gt': now}}
    doc = None
    if email:
        doc = await _db.app_handoffs.find_one_and_delete({**query, 'email': email}, sort=[('created_at', -1)])
    if not doc:
        doc = await _db.app_handoffs.find_one_and_delete({**query, 'key': _key(request)})
    return {'path': doc['path'] if doc else None}
