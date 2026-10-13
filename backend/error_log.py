"""Server errors, kept for the dashboard's Today page.

Every ERROR line the backend logs is also saved here, grouped by what it
says (emails, ids and numbers taken out, so one bug hitting ten readers is
one row with a count of ten). Today shows the groups seen since they were
last cleared, so a crash like the October sign-up preview one shows up the
day it starts instead of a week later in a reader's email.

Known noise (crawlers asking for share images of pages that aren't
stories) is skipped. Rows are kept 30 days.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from admin_auth import require_admin_key_or_session

router = APIRouter()
_db = None
_loop = None

KEEP_DAYS = 30
SHOW_HOURS = 48
NOISE = (
    'OG image generation error',
    'OG meta fetch failed',
    'sitemap ghost fetch failed',
)


def _shape(message: str) -> str:
    """The message with the parts that vary taken out, for grouping."""
    m = re.sub(r'[\w.+-]+@[\w-]+(\.[\w-]+)+', '<email>', message)
    m = re.sub(r'\b(pay|order|sub|plan|cust|inv|rfnd)_[A-Za-z0-9]+', r'\1_<id>', m)
    m = re.sub(r'\b[0-9a-f]{20,}\b', '<id>', m)
    m = re.sub(r'\d+', '#', m)
    return m[:300]


async def _save(logger_name: str, message: str, at: datetime) -> None:
    try:
        shape = _shape(message)
        key = hashlib.sha1(f'{logger_name}|{shape}'.encode()).hexdigest()
        await _db.error_log.update_one(
            {'_id': key},
            {'$set': {'last_at': at, 'last_message': message[:1000], 'logger': logger_name, 'shape': shape},
             '$setOnInsert': {'first_at': at},
             '$inc': {'count': 1}},
            upsert=True,
        )
    except Exception:
        pass  # never let saving an error cause another one


class _Handler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        if _db is None or _loop is None or record.name == __name__:
            return
        try:
            message = record.getMessage()
        except Exception:
            return
        if any(n in message for n in NOISE):
            return
        at = datetime.now(timezone.utc)
        try:
            if asyncio.get_running_loop() is _loop:
                _loop.create_task(_save(record.name, message, at))
                return
        except RuntimeError:
            pass
        try:
            _loop.call_soon_threadsafe(lambda: _loop.create_task(_save(record.name, message, at)))
        except Exception:
            pass


def install(db_handle) -> None:
    """Start saving ERROR lines. Called once the database is connected,
    from inside the running server (so the event loop is known)."""
    global _db, _loop
    _db = db_handle
    try:
        _loop = asyncio.get_running_loop()
    except RuntimeError:
        _loop = asyncio.get_event_loop()
    root = logging.getLogger()
    if not any(isinstance(h, _Handler) for h in root.handlers):
        handler = _Handler(level=logging.ERROR)
        root.addHandler(handler)


async def ensure_indexes() -> None:
    if _db is None:
        return
    try:
        await _db.error_log.create_index('last_at', expireAfterSeconds=KEEP_DAYS * 86400)
    except Exception:
        pass


@router.get('/api/admin/errors')
async def recent_errors(_admin: None = Depends(require_admin_key_or_session)):
    """Error groups seen in the last 48 hours and not cleared, newest first."""
    if _db is None:
        return {'errors': []}
    since = datetime.now(timezone.utc) - timedelta(hours=SHOW_HOURS)
    out = []
    async for d in _db.error_log.find({'last_at': {'$gte': since}}):
        cleared = d.get('cleared_at')
        last = d.get('last_at')
        if cleared and last and _aware(cleared) >= _aware(last):
            continue
        out.append({
            'id': d['_id'], 'message': d.get('last_message') or '', 'where': d.get('logger') or '',
            'count': d.get('count', 0) - d.get('count_at_clear', 0),
            'first_at': _aware(d.get('first_at')).isoformat() if d.get('first_at') else None,
            'last_at': _aware(last).isoformat() if last else None,
        })
    out.sort(key=lambda e: e['last_at'] or '', reverse=True)
    return {'errors': out}


@router.post('/api/admin/errors/clear')
async def clear_errors(_admin: None = Depends(require_admin_key_or_session)):
    """Hides what's listed now; a group comes back if it happens again."""
    if _db is None:
        return {'cleared': 0}
    now = datetime.now(timezone.utc)
    n = 0
    async for d in _db.error_log.find({'last_at': {'$lte': now}}):
        await _db.error_log.update_one({'_id': d['_id']}, {'$set': {'cleared_at': now, 'count_at_clear': d.get('count', 0)}})
        n += 1
    return {'cleared': n}


def _aware(dt):
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)
