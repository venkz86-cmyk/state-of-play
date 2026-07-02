"""
nominations.py — Session 2 build for TSOP.

Provides:
  * POST /api/nominations/submit          — create Ghost free member + token + hand off
  * GET  /api/story-token/validate/{token} — token lookup + open counter
  * POST /api/cold-link/generate          — admin-only cold link mint (ADMIN_KEY)
  * POST /api/cold-link/event             — log signup events, fire Slack
  * POST /api/cold-link/expire-check      — cron sweep, marks expired
  * GET  /s/{token}                       — server-rendered article page

Datastore:
  Mongo collection `story_tokens` — mirrors the spec's Supabase schema 1:1.
  Indexes (defensive, idempotent):  token_id (unique), expires_at, status.

Dependencies:
  - GHOST_URL, GHOST_ADMIN_API_KEY     (existing)
  - APPS_SCRIPT_URL                    (existing; falls back to hardcoded)
  - ADMIN_KEY                          (new — generated and stored in Render env)
  - SLACK_WEBHOOK_URL                  (optional; Slack pings are non-fatal)
"""
from __future__ import annotations

import os
import logging
import uuid
import html
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, EmailStr

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────────────────────────
GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
GHOST_CONTENT_API_KEY = os.environ.get('GHOST_CONTENT_API_KEY', '')

APPS_SCRIPT_URL = os.environ.get(
    'APPS_SCRIPT_URL',
    'https://script.google.com/macros/s/AKfycbxuRQHvQZfZFYCxLirt8ry2mbiwYGlVKm7N3oe-Oy4-GuosggZZU1t5AV1Q97HmyIZ6Pg/exec',
)

ADMIN_KEY = os.environ.get('ADMIN_KEY', '')
SLACK_WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL', '')

TOKEN_LIFETIME_DAYS = 14
PUBLIC_BASE_URL = 'https://www.stateofplay.club'

# ─── Module state injected by server.py at boot ──────────────────────────────
_db = None  # Motor Mongo client


def init(db_handle):
    """Called by server.py once Mongo is wired so we can persist tokens."""
    global _db
    _db = db_handle


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


async def _ghost_create_free_member(email: str, name: str, label: str = 'nominated-reader') -> Optional[str]:
    """Best-effort Ghost free member creation. Returns ghost_member_id or None.
    Failures and 'already exists' are non-fatal."""
    token = _create_ghost_admin_token()
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f'{GHOST_URL}/ghost/api/admin/members/?send_email=false',
                json={'members': [{
                    'email': email,
                    'name': name or '',
                    'labels': [{'name': label}],
                }]},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code in (200, 201):
            return r.json()['members'][0]['id']
        if r.status_code == 422:
            # Most common cause: member already exists. Look it up.
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    look = await client.get(
                        f'{GHOST_URL}/ghost/api/admin/members/',
                        params={'filter': f"email:'{email}'"},
                        headers={'Authorization': f'Ghost {token}'},
                    )
                if look.status_code == 200:
                    members = look.json().get('members', [])
                    if members:
                        return members[0].get('id')
            except Exception:
                pass
            logger.info(f'Ghost member 422 (likely exists) for {email}')
            return None
        logger.warning(f'Ghost member create HTTP {r.status_code}: {r.text[:200]}')
    except Exception as e:
        logger.warning(f'Ghost member create failed: {e!r}')
    return None


async def _ghost_fetch_post(slug: str) -> Optional[dict]:
    """Fetch full post via Ghost Admin API so paywalled bodies are returned."""
    token = _create_ghost_admin_token()
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/admin/posts/slug/{slug}/',
                params={'formats': 'html', 'include': 'tags,authors'},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code == 200:
            posts = r.json().get('posts', [])
            return posts[0] if posts else None
        logger.warning(f'Ghost fetch post HTTP {r.status_code} for slug={slug}')
    except Exception as e:
        logger.warning(f'Ghost fetch post failed: {e!r}')
    return None


async def _ghost_fetch_related(post: dict, limit: int = 3) -> list:
    """Up to N related posts via Content API, filtered by primary tag."""
    if not GHOST_CONTENT_API_KEY:
        return []
    primary_tag = (post.get('primary_tag') or {}).get('slug')
    if not primary_tag:
        tags = post.get('tags') or []
        primary_tag = (tags[0] or {}).get('slug') if tags else None
    if not primary_tag:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f'{GHOST_URL}/ghost/api/content/posts/',
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'filter': f'tag:{primary_tag}',
                    'limit': str(limit + 1),
                    'include': 'tags',
                    'fields': 'id,slug,title,custom_excerpt,excerpt,feature_image,reading_time',
                },
            )
        if r.status_code == 200:
            related = [p for p in r.json().get('posts', []) if p.get('slug') != post.get('slug')]
            return related[:limit]
    except Exception as e:
        logger.warning(f'Ghost related fetch failed: {e!r}')
    return []


async def _post_to_apps_script(payload: dict) -> None:
    """Fire-and-forget POST to Apps Script. Failure is non-fatal."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            await client.post(APPS_SCRIPT_URL, content=httpx.json_dumps(payload),
                              headers={'Content-Type': 'text/plain;charset=utf-8'})
    except Exception as e:
        logger.warning(f'Apps Script POST failed: {e!r}')


def _post_to_apps_script_payload_json(payload: dict) -> str:
    import json
    return json.dumps(payload)


async def _slack_post(text: str) -> None:
    """Fire-and-forget Slack webhook ping."""
    if not SLACK_WEBHOOK_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(SLACK_WEBHOOK_URL, json={'text': text})
    except Exception as e:
        logger.warning(f'Slack ping failed: {e!r}')


async def _ensure_token_indexes() -> None:
    """Idempotent; creates indexes if Mongo is up."""
    if _db is None:
        return
    try:
        await _db.story_tokens.create_index('token_id', unique=True)
        await _db.story_tokens.create_index('expires_at')
        await _db.story_tokens.create_index('status')
        # Abuse-prevention indexes (session 8):
        # Quota query filters by (subscriber_email, token_type, created_at range).
        # Duplicate-nominee filter uses (subscriber_email, nominee_email, token_type).
        await _db.story_tokens.create_index(
            [('subscriber_email', 1), ('token_type', 1), ('created_at', -1)]
        )
        await _db.story_tokens.create_index(
            [('subscriber_email', 1), ('nominee_email', 1), ('token_type', 1)]
        )
    except Exception as e:
        logger.warning(f'story_tokens index ensure failed (non-fatal): {e!r}')


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Abuse-prevention constants ──────────────────────────────────────────────
MONTHLY_NOMINATION_QUOTA = 5      # per calendar month per subscriber
DUPLICATE_NOMINEE_LIMIT = 2       # all-time per (subscriber, nominee) pair


def _current_month_bounds(now: Optional[datetime] = None) -> tuple:
    """Return (start_of_this_month_utc, start_of_next_month_utc)."""
    now = now or _utcnow()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        nxt = start.replace(year=start.year + 1, month=1)
    else:
        nxt = start.replace(month=start.month + 1)
    return start, nxt


async def _count_monthly_nominations(subscriber_email: str) -> int:
    """Count this subscriber's nominations in the current calendar month.
    Returns 0 if Mongo is unavailable (fail-open — the endpoint itself will
    still fail gracefully when it tries to insert without a DB)."""
    if _db is None or not subscriber_email:
        return 0
    start, nxt = _current_month_bounds()
    try:
        return await _db.story_tokens.count_documents({
            'subscriber_email': subscriber_email.lower().strip(),
            'token_type': 'nomination',
            'created_at': {'$gte': start, '$lt': nxt},
        })
    except Exception as e:
        logger.warning(f'monthly-nomination count failed: {e!r}')
        return 0


async def _count_pair_nominations(subscriber_email: str, nominee_email: str) -> int:
    """Count all-time nominations from this subscriber to this specific nominee."""
    if _db is None or not (subscriber_email and nominee_email):
        return 0
    try:
        return await _db.story_tokens.count_documents({
            'subscriber_email': subscriber_email.lower().strip(),
            'nominee_email': nominee_email.lower().strip(),
            'token_type': 'nomination',
        })
    except Exception as e:
        logger.warning(f'pair-nomination count failed: {e!r}')
        return 0


def _month_reset_label() -> str:
    """Human-readable reset date, e.g. '1 August'."""
    _, nxt = _current_month_bounds()
    return nxt.strftime('%-d %B') if hasattr(nxt, 'strftime') else '1st of next month'


# ─── Pydantic models ─────────────────────────────────────────────────────────
class NominationSubmit(BaseModel):
    subscriber_ghost_id: Optional[str] = ''
    subscriber_name: str = Field('', max_length=200)
    subscriber_email: EmailStr
    nominee_name: str = Field(..., min_length=1, max_length=200)
    nominee_email: EmailStr
    post_slug: Optional[str] = None      # optional curator pick
    personal_note: Optional[str] = Field('', max_length=200)   # accepted for back-compat
    nominee_context: Optional[str] = Field('', max_length=400) # what Venkat reads


class ColdLinkGenerate(BaseModel):
    post_slug: str = Field(..., min_length=1)


class ColdLinkEvent(BaseModel):
    token_id: str
    event_type: str = Field(..., description='signup_free | signup_paid | open')
    nominee_email: Optional[EmailStr] = None


# ─── Routes ──────────────────────────────────────────────────────────────────
@router.post('/api/nominations/submit')
async def nominations_submit(req: NominationSubmit):
    """One-shot nomination handler.

    Order (session 8): abuse checks → Ghost member → token row → hand-off.
    The two checks must run before any external side effect so a rejected
    submission never creates orphan Ghost accounts or leaks nominee emails
    to Apps Script.
    """
    await _ensure_token_indexes()

    nominee_email_norm = req.nominee_email.lower().strip()
    nominee_name = (req.nominee_name or '').strip()
    subscriber_email_norm = (req.subscriber_email or '').lower().strip()

    # 0a) Monthly quota
    used_this_month = await _count_monthly_nominations(subscriber_email_norm)
    if used_this_month >= MONTHLY_NOMINATION_QUOTA:
        return {
            'success': False,
            'error': 'quota_exceeded',
            'nominations_remaining': 0,
            'quota': MONTHLY_NOMINATION_QUOTA,
            'resets_on': _month_reset_label(),
        }

    # 0b) All-time cap on nominating the same email
    pair_count = await _count_pair_nominations(subscriber_email_norm, nominee_email_norm)
    if pair_count >= DUPLICATE_NOMINEE_LIMIT:
        return {
            'success': False,
            'error': 'duplicate_nominee',
            'nominations_remaining': MONTHLY_NOMINATION_QUOTA - used_this_month,
        }

    # 1) Ghost free member (non-fatal)
    ghost_id = await _ghost_create_free_member(nominee_email_norm, nominee_name)

    # 2) Create token row
    token_id = str(uuid.uuid4())
    now = _utcnow()
    expires = now + timedelta(days=TOKEN_LIFETIME_DAYS)
    token_doc = {
        'token_id': token_id,
        'post_slug': req.post_slug or '',
        'token_type': 'nomination',
        'created_by': req.subscriber_email,
        'subscriber_ghost_id': req.subscriber_ghost_id or '',
        'subscriber_name': req.subscriber_name or '',
        'subscriber_email': subscriber_email_norm,
        'nominee_name': nominee_name,
        'nominee_email': nominee_email_norm,
        'personal_note': (req.personal_note or '').strip() or (req.nominee_context or '').strip(),
        'created_at': now,
        'expires_at': expires,
        'open_count': 0,
        'status': 'active',
        'ghost_member_id': ghost_id or '',
    }
    if _db is not None:
        try:
            await _db.story_tokens.insert_one(token_doc)
        except Exception as e:
            logger.warning(f'Token insert failed (non-fatal): {e!r}')

    story_url = f'{PUBLIC_BASE_URL}/s/{token_id}'

    # 3) Hand-off to Apps Script — Sheet log + Slack + nominee email
    await _post_to_apps_script({
        'action': 'nomination_submitted',
        'subscriber_ghost_id': req.subscriber_ghost_id or '',
        'subscriber_name': req.subscriber_name or '',
        'subscriber_email': req.subscriber_email,
        'nominee_name': nominee_name,
        'nominee_email': nominee_email_norm,
        'nominee_context': req.nominee_context or req.personal_note or '',
        'post_slug': req.post_slug or '',
        'token_id': token_id,
        'story_url': story_url,
        'expires_at': expires.isoformat(),
    })

    # Mongo response carries _no_ ObjectId — token_doc was built fresh.
    return {
        'success': True,
        'token_id': token_id,
        'story_url': story_url,
        'nominations_remaining': max(0, MONTHLY_NOMINATION_QUOTA - (used_this_month + 1)),
    }


@router.get('/api/nominations/quota')
async def nominations_quota(subscriber_email: str):
    """Return the current subscriber's nomination quota state.

    Query param `subscriber_email`. Response:
      { used: int, quota: int, remaining: int, resets_on: str }
    Fail-open: if Mongo is unavailable, returns full quota available.
    """
    used = await _count_monthly_nominations(subscriber_email)
    return {
        'used': used,
        'quota': MONTHLY_NOMINATION_QUOTA,
        'remaining': max(0, MONTHLY_NOMINATION_QUOTA - used),
        'resets_on': _month_reset_label(),
    }


@router.get('/api/story-token/validate/{token}')
async def story_token_validate(token: str):
    if _db is None:
        raise HTTPException(status_code=503, detail='Token store unavailable')
    doc = await _db.story_tokens.find_one({'token_id': token}, {'_id': 0})
    if not doc:
        return {'valid': False, 'reason': 'not_found'}
    if doc.get('status') != 'active':
        return {'valid': False, 'reason': doc.get('status') or 'expired'}
    expires_at = doc.get('expires_at')
    # Mongo returns tz-aware if stored as such; coerce defensively.
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < _utcnow():
            await _db.story_tokens.update_one(
                {'token_id': token}, {'$set': {'status': 'expired'}})
            return {'valid': False, 'reason': 'expired'}

    # Increment open counter (non-fatal)
    try:
        await _db.story_tokens.update_one(
            {'token_id': token},
            {'$inc': {'open_count': 1}, '$set': {'last_opened_at': _utcnow()}},
        )
    except Exception as e:
        logger.warning(f'open_count increment failed: {e!r}')

    return {
        'valid': True,
        'post_slug': doc.get('post_slug'),
        'token_type': doc.get('token_type'),
        'subscriber_name': doc.get('subscriber_name'),
        'nominee_name': doc.get('nominee_name'),
        'open_count': (doc.get('open_count') or 0) + 1,
    }


@router.post('/api/cold-link/generate')
async def cold_link_generate(
    req: ColdLinkGenerate,
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
):
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail='Admin key not configured on server')
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Invalid admin key')
    await _ensure_token_indexes()

    token_id = str(uuid.uuid4())
    now = _utcnow()
    expires = now + timedelta(days=TOKEN_LIFETIME_DAYS)
    doc = {
        'token_id': token_id,
        'post_slug': req.post_slug,
        'token_type': 'cold',
        'created_by': 'admin',
        'subscriber_name': '',
        'subscriber_email': '',
        'nominee_name': '',
        'nominee_email': '',
        'personal_note': '',
        'created_at': now,
        'expires_at': expires,
        'open_count': 0,
        'status': 'active',
    }
    if _db is not None:
        try:
            await _db.story_tokens.insert_one(doc)
        except Exception as e:
            logger.warning(f'cold token insert failed: {e!r}')
    return {
        'token_id': token_id,
        'url': f'{PUBLIC_BASE_URL}/s/{token_id}',
        'expires_at': expires.isoformat(),
    }


@router.post('/api/cold-link/event')
async def cold_link_event(req: ColdLinkEvent):
    """Conversion ping from the frontend after a Ghost signup happens
    with ?ref=shared-story. Logs the event + fires Slack."""
    if _db is None:
        return {'success': True, 'persisted': False}
    doc = await _db.story_tokens.find_one({'token_id': req.token_id}, {'_id': 0})
    if not doc:
        return {'success': True, 'persisted': False, 'reason': 'not_found'}

    update = {'$inc': {f'events.{req.event_type}': 1}}
    if req.event_type in ('signup_free', 'signup_paid'):
        update['$set'] = {
            'status': 'converted',
            'converted_at': _utcnow(),
            'converted_kind': req.event_type,
        }
        if req.nominee_email:
            update['$set']['nominee_email'] = req.nominee_email.lower().strip()
    try:
        await _db.story_tokens.update_one({'token_id': req.token_id}, update)
    except Exception as e:
        logger.warning(f'event log failed: {e!r}')

    # Slack ping
    if req.event_type in ('signup_free', 'signup_paid'):
        nominee_disp = doc.get('nominee_name') or doc.get('nominee_email') or 'A reader'
        kind = 'paid' if req.event_type == 'signup_paid' else 'free'
        subscriber = doc.get('subscriber_name') or doc.get('subscriber_email') or '—'
        days = '—'
        created_at = doc.get('created_at')
        if isinstance(created_at, datetime):
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            days = max(0, (_utcnow() - created_at).days)
        await _slack_post(
            '*NOMINATION CONVERTED*\n\n'
            f'{nominee_disp} just signed up ({kind})\n'
            f'Nominated by: {subscriber}\n'
            f'Story: {doc.get("post_slug") or "—"}\n'
            f'Days from nomination to signup: {days}'
        )
        # Tell Apps Script so it can update the sheet + offer YES → Gmail draft
        await _post_to_apps_script({
            'action': 'nomination_converted',
            'token_id': req.token_id,
            'nominee_email': doc.get('nominee_email'),
            'nominee_name': doc.get('nominee_name'),
            'subscriber_email': doc.get('subscriber_email'),
            'subscriber_name': doc.get('subscriber_name'),
            'post_slug': doc.get('post_slug'),
            'conversion_kind': kind,
            'days_to_convert': days,
        })
    return {'success': True, 'persisted': True}


@router.post('/api/cold-link/expire-check')
async def cold_link_expire_check(
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
):
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail='Admin key not configured on server')
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Invalid admin key')
    if _db is None:
        return {'expired_count': 0}
    result = await _db.story_tokens.update_many(
        {'status': 'active', 'expires_at': {'$lt': _utcnow()}},
        {'$set': {'status': 'expired'}},
    )
    return {'expired_count': result.modified_count}


# ─── /s/{token} server-rendered article ──────────────────────────────────────
EXPIRED_HTML = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>This link has expired — The State of Play</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{
    background:#FAF9F7;color:#1A1A1A;font-family:'DM Sans',-apple-system,sans-serif;
    margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  }}
  .wrap{{max-width:480px;padding:48px 24px;text-align:center}}
  .overline{{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#999;margin-bottom:32px}}
  h1{{font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:28px;line-height:1.15;margin:0 0 16px}}
  p{{color:#555;line-height:1.6;font-size:16px;margin:0 0 32px;}}
  a.cta{{display:inline-block;background:#A0291C;color:#fff;text-decoration:none;
    font-size:14px;letter-spacing:.05em;text-transform:uppercase;font-weight:500;
    padding:14px 28px;}}
</style></head>
<body><div class="wrap">
  <div class="overline">— The State of Play —</div>
  <h1>This link has expired.</h1>
  <p>The story it pointed to lives at The State of Play.</p>
  <a href="{base}" class="cta">Go to stateofplay.club &rarr;</a>
</div></body></html>"""


def _attribution_block(token_doc: dict) -> str:
    subscriber_first = (token_doc.get('subscriber_name') or '').split(' ')[0]
    is_nom = token_doc.get('token_type') == 'nomination' and subscriber_first
    cta = f'{PUBLIC_BASE_URL}?ref=shared-story'
    if is_nom:
        return f"""
        <aside class="tsop-attribution" data-kind="nomination">
          <p class="tsop-attribution__hed">{html.escape(subscriber_first)} thought you should read this.</p>
          <p>Reported intelligence on the business of Indian sport. No noise. No aggregation. Just reporting.</p>
          <a class="tsop-attribution__cta" href="{cta}">Start reading free &rarr;</a>
        </aside>
        """
    return f"""
    <aside class="tsop-attribution" data-kind="cold">
      <p class="tsop-attribution__hed">You're reading a State of Play story.</p>
      <p>Reported intelligence on the business of Indian sport. Read by professionals across private capital, franchise management, media, and sports governance.</p>
      <a class="tsop-attribution__cta" href="{cta}">Start reading free &rarr;</a>
    </aside>
    """


def _related_card(post: dict) -> str:
    title = html.escape(post.get('title') or '')
    excerpt = html.escape((post.get('custom_excerpt') or post.get('excerpt') or '')[:160])
    image = post.get('feature_image') or ''
    slug = post.get('slug') or ''
    img_html = (
        f'<div class="tsop-related-card__image" style="background-image:url(\'{html.escape(image)}\');"></div>'
        if image else ''
    )
    return f"""
    <a class="tsop-related-card" href="{PUBLIC_BASE_URL}/{html.escape(slug)}">
      {img_html}
      <div class="tsop-related-card__body">
        <h3 class="tsop-related-card__title">{title}</h3>
        <p class="tsop-related-card__excerpt">{excerpt}</p>
        <span class="tsop-related-card__cta">Read more at stateofplay.club &rarr;</span>
      </div>
    </a>
    """


def _shared_story_page(token_doc: dict, post: dict, related: list, token_id: str) -> str:
    title = html.escape(post.get('title') or 'The State of Play')
    excerpt = html.escape((post.get('custom_excerpt') or post.get('excerpt') or '')[:200])
    image = html.escape(post.get('feature_image') or f'{PUBLIC_BASE_URL}/og-default.png')
    # Dynamic, branded OG card (Fraunces masthead + headline) for socials
    og_card = f"{PUBLIC_BASE_URL}/api/og-image/{html.escape(post.get('slug') or '')}"
    canonical_url = f"{PUBLIC_BASE_URL}/{post.get('slug') or ''}"
    body_html = post.get('html') or ''
    authors = post.get('authors') or []
    author = (authors[0] or {}).get('name') if authors else 'The State of Play'
    published = post.get('published_at') or ''
    try:
        if published:
            published = datetime.fromisoformat(published.replace('Z', '+00:00')).strftime('%d %B %Y')
    except Exception:
        pass
    related_html = ''.join(_related_card(p) for p in (related or []))

    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>{title} — The State of Play</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{excerpt}">
<meta name="robots" content="noindex">
<link rel="canonical" href="{canonical_url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{excerpt}">
<meta property="og:image" content="{og_card}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{PUBLIC_BASE_URL}/s/{html.escape(token_id)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{excerpt}">
<meta name="twitter:image" content="{og_card}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
  :root{{
    --bg:#FAF9F7;
    --text:#1A1A1A;
    --muted:#444;
    --label:#888;
    --rule:#E5E2DC;
    --accent:#A0291C;
    --editorial:'Fraunces','Source Serif 4',Georgia,serif;
    --reading:'Newsreader','Source Serif 4',Georgia,serif;
    --ui:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }}
  *{{box-sizing:border-box;}}
  html,body{{margin:0;padding:0;}}
  body{{
    background:var(--bg);
    color:var(--text);
    font-family:var(--reading);
    font-feature-settings:"liga","kern";
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
  }}

  /* ─── Masthead ─── */
  .tsop-mast{{
    position:sticky;top:0;z-index:50;
    background:#fff;border-bottom:1px solid var(--rule);
  }}
  .tsop-mast__inner{{
    max-width:1400px;margin:0 auto;
    padding:0 24px;
    display:flex;justify-content:space-between;align-items:center;
    height:64px;
  }}
  @media(min-width:1024px){{ .tsop-mast__inner{{padding:0 48px;height:80px;}} }}
  .tsop-mast__logo{{display:flex;align-items:center;text-decoration:none;}}
  .tsop-mast__logo img{{height:40px;width:auto;display:block;}}
  @media(min-width:1024px){{ .tsop-mast__logo img{{height:48px;}} }}
  .tsop-mast__cta{{
    font-family:var(--ui);
    font-size:13px;font-weight:500;
    letter-spacing:.04em;text-transform:uppercase;
    color:var(--accent);text-decoration:none;
    padding:10px 18px;border:1px solid var(--accent);
    transition:background .15s ease,color .15s ease;
  }}
  .tsop-mast__cta:hover{{background:var(--accent);color:#fff;}}

  /* ─── Dateline strip ─── */
  .tsop-dateline{{
    max-width:1280px;margin:0 auto;
    padding:40px 24px 12px;
  }}
  @media(min-width:1024px){{ .tsop-dateline{{padding:48px 48px 12px;}} }}
  .tsop-dateline__inner{{
    display:flex;justify-content:space-between;align-items:baseline;
    border-bottom:1px solid var(--rule);padding-bottom:14px;
    font-family:var(--ui);font-size:14px;color:#444;
  }}
  .tsop-dateline a{{color:inherit;text-decoration:none;}}
  .tsop-dateline a:hover{{color:var(--accent);}}

  /* ─── Article ─── */
  .tsop-article{{
    max-width:680px;margin:0 auto;
    padding:48px 24px 32px;
  }}
  @media(min-width:1024px){{ .tsop-article{{padding:64px 0 48px;}} }}

  .tsop-article__kicker{{
    font-family:var(--ui);
    font-size:11px;font-weight:500;
    letter-spacing:.12em;text-transform:uppercase;
    color:var(--label);
    margin:0 0 20px;
  }}
  .tsop-article__title{{
    font-family:var(--editorial);
    font-weight:600;
    font-size:40px;line-height:1.08;
    letter-spacing:-0.012em;
    margin:0 0 20px;
    max-width:24ch;
  }}
  @media(min-width:768px){{ .tsop-article__title{{font-size:48px;}} }}
  .tsop-article__sub{{
    font-family:var(--reading);
    font-style:italic;
    font-size:20px;line-height:1.5;
    color:var(--muted);
    margin:0 0 28px;
    max-width:55ch;
  }}
  .tsop-article__byline{{
    font-family:var(--ui);
    font-size:13px;color:var(--muted);
    margin:0 0 24px;
    padding-bottom:20px;
    border-bottom:1px solid var(--rule);
  }}
  .tsop-article__hero{{
    margin:0 -24px 32px;
  }}
  @media(min-width:1024px){{ .tsop-article__hero{{margin:0 0 32px;}} }}
  .tsop-article__hero img{{
    width:100%;display:block;
    filter:saturate(0);transition:filter .7s ease;
  }}
  .tsop-article__hero:hover img{{filter:saturate(1);}}

  /* ─── Article body ─── */
  .tsop-article__body{{
    font-family:var(--reading);
    font-size:19px;line-height:1.7;
    color:#222;
  }}
  .tsop-article__body p{{margin:0 0 1.3em;}}
  .tsop-article__body a{{color:var(--accent);text-decoration:underline;text-underline-offset:3px;}}
  .tsop-article__body h2{{
    font-family:var(--editorial);
    font-weight:600;
    font-size:26px;line-height:1.2;letter-spacing:-0.005em;
    margin:48px 0 16px;
  }}
  .tsop-article__body h3{{
    font-family:var(--editorial);
    font-weight:500;
    font-size:21px;line-height:1.25;
    margin:36px 0 12px;
  }}
  .tsop-article__body blockquote{{
    border-left:2px solid var(--accent);
    padding:4px 0 4px 22px;
    margin:32px 0;
    font-style:italic;color:#333;
    font-size:20px;line-height:1.55;
  }}
  .tsop-article__body img{{
    max-width:100%;height:auto;
    margin:24px 0;
  }}
  .tsop-article__body figure{{margin:24px 0;}}
  .tsop-article__body figcaption{{
    font-family:var(--ui);font-size:12px;font-style:italic;
    color:var(--label);margin-top:8px;
  }}
  .tsop-article__body ul,.tsop-article__body ol{{
    padding-left:24px;margin:0 0 1.3em;
  }}
  .tsop-article__body li{{margin:0 0 .5em;}}

  /* ─── Attribution block ─── */
  .tsop-attribution{{
    margin:56px -24px 0;
    background:#1A1A1A;color:#fff;
    padding:48px 24px;
  }}
  @media(min-width:1024px){{ .tsop-attribution{{margin:64px 0 0;padding:56px 48px;}} }}
  .tsop-attribution__hed{{
    font-family:var(--editorial);font-weight:600;
    font-size:26px;line-height:1.2;letter-spacing:-0.005em;
    margin:0 0 14px;color:#fff;
  }}
  .tsop-attribution p{{
    font-family:var(--ui);font-size:15px;line-height:1.6;
    color:#bbb;margin:0 0 24px;
  }}
  .tsop-attribution__cta{{
    display:inline-block;background:var(--accent);color:#fff;
    font-family:var(--ui);font-size:13px;font-weight:500;
    letter-spacing:.06em;text-transform:uppercase;
    padding:14px 28px;text-decoration:none;
    transition:opacity .15s ease;
  }}
  .tsop-attribution__cta:hover{{opacity:.88;}}

  /* ─── Related ─── */
  .tsop-related{{
    max-width:1280px;margin:0 auto;
    padding:64px 24px;
  }}
  @media(min-width:1024px){{ .tsop-related{{padding:80px 48px;}} }}
  .tsop-related__label{{
    font-family:var(--ui);font-size:11px;font-weight:500;
    letter-spacing:.12em;text-transform:uppercase;
    color:var(--label);
    margin:0 0 28px;
    border-top:1px solid var(--rule);padding-top:24px;
  }}
  .tsop-related__grid{{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
    gap:32px;
  }}
  .tsop-related-card{{
    display:block;color:var(--text);text-decoration:none;
    transition:opacity .2s ease;
  }}
  .tsop-related-card:hover{{opacity:.7;}}
  .tsop-related-card__image{{
    aspect-ratio:16/9;background-size:cover;background-position:center;
    margin-bottom:16px;
    filter:saturate(0);transition:filter .5s ease;
  }}
  .tsop-related-card:hover .tsop-related-card__image{{filter:saturate(1);}}
  .tsop-related-card__title{{
    font-family:var(--editorial);font-weight:600;
    font-size:20px;line-height:1.22;letter-spacing:-0.005em;
    margin:0 0 8px;
  }}
  .tsop-related-card__excerpt{{
    font-family:var(--reading);
    font-size:15px;line-height:1.5;
    color:var(--muted);
    margin:0 0 12px;
  }}
  .tsop-related-card__cta{{
    font-family:var(--ui);font-size:11px;font-weight:500;
    letter-spacing:.1em;text-transform:uppercase;
    color:var(--accent);
  }}

  /* ─── Footer ─── */
  .tsop-foot{{
    border-top:1px solid var(--rule);background:#fff;
    padding:32px 24px;text-align:center;
    font-family:var(--ui);font-size:12px;color:var(--label);
  }}
</style>
</head>
<body>
  <header class="tsop-mast"><div class="tsop-mast__inner">
    <a class="tsop-mast__logo" href="{PUBLIC_BASE_URL}">
      <img src="https://www.stateofplay.club/tsop-logo.png" alt="The State of Play">
    </a>
    <a class="tsop-mast__cta" href="{PUBLIC_BASE_URL}?ref=shared-story">Subscribe &rarr;</a>
  </div></header>

  <div class="tsop-dateline"><div class="tsop-dateline__inner">
    <span><a href="{PUBLIC_BASE_URL}">&larr; The State of Play</a> · {published if published else 'Year Two'}</span>
    <span style="font-variant-numeric:tabular-nums;">Year Two</span>
  </div></div>

  <main class="tsop-article">
    <p class="tsop-article__kicker">{html.escape((post.get('primary_tag') or {{}}).get('name') or 'Reportage')} · For Subscribers</p>
    <h1 class="tsop-article__title">{title}</h1>
    {'<p class="tsop-article__sub">' + excerpt + '</p>' if excerpt else ''}
    <p class="tsop-article__byline">By {html.escape(author or '')}{' · ' + published if published else ''}</p>
    {'<figure class="tsop-article__hero"><img alt="" src="' + image + '"></figure>' if image else ''}
    <div class="tsop-article__body">{body_html}</div>
    {_attribution_block(token_doc)}
  </main>

  {'<section class="tsop-related"><p class="tsop-related__label">More from The State of Play</p><div class="tsop-related__grid">' + related_html + '</div></section>' if related_html else ''}

  <footer class="tsop-foot">
    &copy; The State of Play · Left Field Ventures · Bengaluru
  </footer>

  <script>
    // Conversion-tracking: stash this token so the homepage can ping the
    // backend if a Ghost signup follows shortly with ?ref=shared-story.
    try {{
      sessionStorage.setItem('tsop_referrer_token','{html.escape(token_id)}');
    }} catch (e) {{}}
  </script>
</body></html>"""


@router.get('/s/{token}', response_class=HTMLResponse, include_in_schema=False)
@router.get('/api/shared/{token}', response_class=HTMLResponse)
async def shared_story_page(token: str, request: Request):
    if _db is None:
        return HTMLResponse(EXPIRED_HTML.format(base=PUBLIC_BASE_URL), status_code=503)

    doc = await _db.story_tokens.find_one({'token_id': token}, {'_id': 0})
    if not doc:
        return HTMLResponse(EXPIRED_HTML.format(base=PUBLIC_BASE_URL), status_code=404)

    expires_at = doc.get('expires_at')
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if doc.get('status') != 'active' or expires_at < _utcnow():
            await _db.story_tokens.update_one(
                {'token_id': token}, {'$set': {'status': 'expired'}})
            return HTMLResponse(EXPIRED_HTML.format(base=PUBLIC_BASE_URL), status_code=410)

    post = await _ghost_fetch_post(doc.get('post_slug') or '')
    if not post:
        return HTMLResponse(EXPIRED_HTML.format(base=PUBLIC_BASE_URL), status_code=404)

    # increment open counter
    try:
        await _db.story_tokens.update_one(
            {'token_id': token},
            {'$inc': {'open_count': 1}, '$set': {'last_opened_at': _utcnow()}},
        )
    except Exception:
        pass

    related = await _ghost_fetch_related(post, limit=3)
    return HTMLResponse(_shared_story_page(doc, post, related, token))
