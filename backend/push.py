"""Phone notifications for new stories (web push).

Readers who install the site (iPhone: Add to Home Screen; Android: Install
app) can turn on notifications. When a story is published in Ghost, every
device that did gets "<headline>" with its dek, and tapping it opens the
story. It doesn't depend on email, so it never lands in Promotions.

  * Keys: the VAPID key pair push services need is made on first use and
    kept in Mongo (app_settings, _id 'vapid'), so there is no secret to set.
  * Devices: push_subscriptions, one per browser endpoint, with the
    reader's email when they were signed in. An endpoint the push service
    says is gone (404/410) is removed.
  * Stories: a loop checks Ghost every 5 minutes. The first time it runs it
    marks what's already published as sent, so only stories published from
    then on go out. Each story is claimed once in push_sent before sending,
    so a restart or a second process can't send it twice. Only stories
    published in the last 6 hours count, so a backdated post stays quiet.
  * Dashboard: GET /api/admin/push (devices, last sent, paused),
    POST /api/admin/push/pause, POST /api/admin/push/test.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from admin_auth import require_admin_key_or_session, _read_admin_session

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

PUBLIC_BASE_URL = 'https://www.stateofplay.club'
GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
CHECK_EVERY_SECONDS = 300
FRESH_HOURS = 6
VAPID_CONTACT = 'mailto:venkat@stateofplay.club'
# The server sends to whatever address a browser gives it, so only the
# browsers' own push services are accepted (no sending to arbitrary hosts).
PUSH_HOSTS = (
    'fcm.googleapis.com', 'android.googleapis.com',   # Chrome, Android
    'updates.push.services.mozilla.com',              # Firefox
    'web.push.apple.com',                             # Safari, iPhone
    'notify.windows.com',                             # Edge on Windows
)


def init(db_handle):
    global _db
    _db = db_handle


def _allowed_endpoint(endpoint: str) -> bool:
    try:
        u = urlparse(endpoint)
    except Exception:
        return False
    host = (u.hostname or '').lower()
    return u.scheme == 'https' and any(host == h or host.endswith('.' + h) for h in PUSH_HOSTS)


# ─── keys ───────────────────────────────────────────────────────────────────
async def _vapid() -> dict:
    """{'private_pem', 'public_key'}, made once and kept."""
    doc = await _db.app_settings.find_one({'_id': 'vapid'})
    if doc:
        return doc
    from py_vapid import Vapid01
    from cryptography.hazmat.primitives import serialization
    v = Vapid01()
    v.generate_keys()
    raw = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    doc = {'_id': 'vapid', 'private_pem': v.private_pem().decode(),
           'public_key': base64.urlsafe_b64encode(raw).rstrip(b'=').decode(),
           'created_at': datetime.now(timezone.utc)}
    try:
        await _db.app_settings.insert_one(doc)
    except Exception:
        doc = await _db.app_settings.find_one({'_id': 'vapid'})  # another process made it first
    return doc


# ─── sending ────────────────────────────────────────────────────────────────
def _send_one(sub: dict, payload: str, private_pem: str) -> int:
    """Returns the push service's status code (201 is success)."""
    from pywebpush import webpush, WebPushException
    from py_vapid import Vapid01
    try:
        r = webpush(
            subscription_info={'endpoint': sub['endpoint'], 'keys': sub['keys']},
            data=payload,
            vapid_private_key=Vapid01.from_pem(private_pem.encode()),
            vapid_claims={'sub': VAPID_CONTACT},
            ttl=24 * 3600,
            timeout=10,
        )
        return getattr(r, 'status_code', 201)
    except WebPushException as e:
        return getattr(getattr(e, 'response', None), 'status_code', 0) or 0
    except Exception as e:
        logger.warning(f'push: send failed: {e!r}')
        return 0


async def send(title: str, body: str, url: str, query: Optional[dict] = None) -> dict:
    """Sends to every device (or those matching query). Removes devices the
    push service says no longer exist."""
    keys = await _vapid()
    payload = json.dumps({'title': title, 'body': body, 'url': url})
    sent = gone = failed = 0
    async for sub in _db.push_subscriptions.find(query or {}):
        status = await asyncio.to_thread(_send_one, sub, payload, keys['private_pem'])
        if 200 <= status < 300:
            sent += 1
            await _db.push_subscriptions.update_one({'_id': sub['_id']}, {'$set': {'last_ok_at': datetime.now(timezone.utc)}})
        elif status in (404, 410):
            gone += 1
            await _db.push_subscriptions.delete_one({'_id': sub['_id']})
        else:
            failed += 1
    return {'sent': sent, 'gone': gone, 'failed': failed}


# ─── readers ────────────────────────────────────────────────────────────────
class SubscribeBody(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=1000)
    keys: dict


@router.get('/api/push/key')
async def public_key():
    if _db is None:
        raise HTTPException(status_code=503, detail='Notifications are unavailable right now.')
    return {'key': (await _vapid())['public_key']}


@router.post('/api/push/subscribe')
async def subscribe(body: SubscribeBody, request: Request):
    if _db is None:
        raise HTTPException(status_code=503, detail='Notifications are unavailable right now.')
    if not _allowed_endpoint(body.endpoint):
        raise HTTPException(status_code=400, detail='This browser’s notifications aren’t supported.')
    p256dh, auth = str(body.keys.get('p256dh') or ''), str(body.keys.get('auth') or '')
    if not (20 <= len(p256dh) <= 200 and 8 <= len(auth) <= 100):
        raise HTTPException(status_code=400, detail='This browser’s notifications aren’t supported.')
    from session_auth import _read_session
    session = _read_session(request) or {}
    now = datetime.now(timezone.utc)
    await _db.push_subscriptions.update_one(
        {'_id': hashlib.sha1(body.endpoint.encode()).hexdigest()},
        {'$set': {'endpoint': body.endpoint, 'keys': {'p256dh': p256dh, 'auth': auth},
                  'email': (session.get('email') or '').lower() or None,
                  'agent': (request.headers.get('user-agent') or '')[:200], 'updated_at': now},
         '$setOnInsert': {'created_at': now}},
        upsert=True,
    )
    return {'ok': True}


class UnsubscribeBody(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=1000)


@router.post('/api/push/unsubscribe')
async def unsubscribe(body: UnsubscribeBody):
    if _db is not None:
        await _db.push_subscriptions.delete_one({'_id': hashlib.sha1(body.endpoint.encode()).hexdigest()})
    return {'ok': True}


# ─── new stories ────────────────────────────────────────────────────────────
async def _latest_posts() -> list:
    from tiers import _create_ghost_admin_token
    token = _create_ghost_admin_token()
    if not token:
        return []
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f'{GHOST_URL}/ghost/api/admin/posts/',
            params={'filter': 'status:published', 'order': 'published_at desc', 'limit': 5,
                    'fields': 'id,slug,title,custom_excerpt,published_at'},
            headers={'Authorization': f'Ghost {token}'},
        )
    return (r.json().get('posts') or []) if r.status_code == 200 else []


def _aware(v) -> Optional[datetime]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace('Z', '+00:00')) if not isinstance(v, datetime) else v
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def check_new_stories() -> list:
    """One pass: notify for stories not yet sent. Returns what was sent."""
    posts = await _latest_posts()
    if not posts:
        return []
    if not await _db.push_sent.find_one({'_id': 'started'}):
        # First run: what's already out was never meant to buzz phones.
        for p in posts:
            await _db.push_sent.update_one({'_id': p['id']}, {'$setOnInsert': {'title': p.get('title'), 'skipped': True}}, upsert=True)
        await _db.push_sent.insert_one({'_id': 'started', 'at': datetime.now(timezone.utc)})
        return []
    settings = await _db.app_settings.find_one({'_id': 'push'}) or {}
    now = datetime.now(timezone.utc)
    out = []
    for p in reversed(posts):  # oldest first
        published = _aware(p.get('published_at'))
        if not published or now - published > timedelta(hours=FRESH_HOURS):
            continue
        try:
            await _db.push_sent.insert_one({'_id': p['id'], 'title': p.get('title'), 'claimed_at': now})
        except Exception:
            continue  # already sent (or being sent)
        if settings.get('paused'):
            await _db.push_sent.update_one({'_id': p['id']}, {'$set': {'skipped': True, 'reason': 'paused'}})
            continue
        result = await send(p.get('title') or 'The State of Play', (p.get('custom_excerpt') or '')[:140],
                            f"{PUBLIC_BASE_URL}/{p['slug']}?source=push")
        await _db.push_sent.update_one({'_id': p['id']}, {'$set': {**result, 'sent_at': datetime.now(timezone.utc)}})
        logger.info(f"push: '{p.get('title')}' {result}")
        out.append({'title': p.get('title'), **result})
    return out


async def watch_loop():
    await asyncio.sleep(30)
    while True:
        try:
            if _db is not None:
                await check_new_stories()
        except Exception as e:
            logger.error(f'push: story check failed: {e!r}')
        await asyncio.sleep(CHECK_EVERY_SECONDS)


# ─── dashboard ──────────────────────────────────────────────────────────────
@router.get('/api/admin/push')
async def push_status(_admin: None = Depends(require_admin_key_or_session)):
    if _db is None:
        return {'devices': 0, 'paused': False, 'last': None}
    devices = await _db.push_subscriptions.count_documents({})
    settings = await _db.app_settings.find_one({'_id': 'push'}) or {}
    last = None
    async for d in _db.push_sent.find({'sent_at': {'$exists': True}}).sort('sent_at', -1).limit(1):
        last = {'title': d.get('title'), 'sent': d.get('sent', 0), 'at': _aware(d.get('sent_at')).isoformat()}
    return {'devices': devices, 'paused': bool(settings.get('paused')), 'last': last}


class PauseBody(BaseModel):
    paused: bool


@router.post('/api/admin/push/pause')
async def push_pause(body: PauseBody, _admin: None = Depends(require_admin_key_or_session)):
    await _db.app_settings.update_one({'_id': 'push'}, {'$set': {'paused': body.paused}}, upsert=True)
    return {'paused': body.paused}


class TestBody(BaseModel):
    email: Optional[str] = None


@router.post('/api/admin/push/test')
async def push_test(body: TestBody, request: Request, _admin: None = Depends(require_admin_key_or_session)):
    """Sends a test to the phones signed in with this email (default: the
    admin's own)."""
    email = (body.email or (_read_admin_session(request) or {}).get('email') or '').lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail='Give the email your phone is signed in with.')
    if not await _db.push_subscriptions.count_documents({'email': email}):
        raise HTTPException(status_code=404, detail=f'No phone has notifications on while signed in as {email}.')
    result = await send('The State of Play', 'Notifications are working. You’ll get new stories here.',
                        f'{PUBLIC_BASE_URL}/', {'email': email})
    return {'email': email, **result}
