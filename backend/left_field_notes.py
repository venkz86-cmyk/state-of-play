"""The Left Field as a running feed of notes, for the app.

Each edition on Substack is split into notes: the opener (without the
greeting), each item under its H3 headline, and sections like The Position
and The Stack as one note each. Editions are separated into notes at the
divider lines (<hr>), which is the most reliable marker in how Venkat
writes them; the headline is the H3 (or the section's H2, or a short first
line when a headline wasn't marked as one).

Read from the Substack feed (which carries each free edition's full text)
every 10 minutes by push.watch_loop, and kept in lf_notes. The website
doesn't show notes: there, The Left Field sends readers to Substack. It
does use the editions kept here (lf_editions) for its list of briefs.

The HTML shown in the app is rebuilt from a short allow-list (paragraphs,
bold, italics, lists, quotes, http(s) links); everything else, scripts and
Substack's own widgets included, is dropped.

  GET /api/left-field/notes?page=0   newest edition first, notes in reading order
  GET /api/left-field/notes/{id}     one note
"""
from __future__ import annotations

import asyncio
import calendar
import html as htmllib
import logging
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

FEED_URL = 'https://theleftfield.substack.com/feed'
PAGE_SIZE = 20
GREETING = re.compile(r'^(good (morning|afternoon|evening)|hello|hi|hey)( all| everyone)?[,.!]?$', re.I)
WIDGET_HINTS = ('subscription-widget', 'subscribe-widget', 'button-wrapper', 'share-button', 'captioned-button')


def init(db_handle):
    global _db
    _db = db_handle


# ─── HTML: top-level blocks, and a strict allow-list ────────────────────────
VOID = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr'}


class _Blocks(HTMLParser):
    """Splits HTML into its top-level elements: [(tag, attrs, html, text)]."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks, self.depth, self.cur = [], 0, None

    def _start(self, tag, attrs, raw):
        if self.depth == 0:
            self.cur = {'tag': tag, 'attrs': dict(attrs), 'html': [], 'text': []}
        if self.cur is not None:
            self.cur['html'].append(raw)
            # class hints from nested elements (Substack widgets nest)
            cls = dict(attrs).get('class') or ''
            if cls:
                self.cur['attrs']['class'] = (self.cur['attrs'].get('class') or '') + ' ' + cls

    def handle_starttag(self, tag, attrs):
        self._start(tag, attrs, self.get_starttag_text() or f'<{tag}>')
        if tag in VOID:
            if self.depth == 0:
                self._close()
        else:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        self._start(tag, attrs, self.get_starttag_text() or f'<{tag}/>')
        if self.depth == 0:
            self._close()

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.cur is not None:
            self.cur['html'].append(f'</{tag}>')
        self.depth = max(0, self.depth - 1)
        if self.depth == 0:
            self._close()

    def handle_data(self, data):
        if self.cur is None:
            if data.strip():
                self.blocks.append({'tag': 'p', 'attrs': {}, 'html': f'<p>{htmllib.escape(data)}</p>', 'text': data.strip()})
            return
        self.cur['html'].append(htmllib.escape(data))
        self.cur['text'].append(data)

    def _close(self):
        if self.cur is not None:
            self.cur['html'] = ''.join(self.cur['html'])
            self.cur['text'] = re.sub(r'\s+', ' ', ''.join(self.cur['text'])).strip()
            self.blocks.append(self.cur)
        self.cur = None


def blocks_of(html: str) -> list:
    p = _Blocks()
    p.feed(html or '')
    p.close()
    p._close()
    return p.blocks


class _Clean(HTMLParser):
    ALLOWED = {'p', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'br', 'blockquote', 'figure', 'figcaption', 'img'}
    RENAME = {'b': 'strong', 'i': 'em', 'h4': 'p', 'h5': 'p', 'h6': 'p'}
    DROP_CONTENT = {'script', 'style', 'iframe', 'object', 'svg', 'button', 'form', 'noscript', 'h1', 'h2', 'h3'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.open = [], 0, []

    def handle_startendtag(self, tag, attrs):
        # <img ... /> and the like: a start with no end to wait for
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_starttag(self, tag, attrs):
        if tag in self.DROP_CONTENT:
            if tag not in VOID:
                self.skip += 1
            return
        if self.skip:
            return
        tag = self.RENAME.get(tag, tag)
        if tag not in self.ALLOWED:
            return
        a = dict(attrs)
        if tag == 'a':
            href = a.get('href') or ''
            if urlparse(href).scheme not in ('http', 'https'):
                self.open.append(None)
                return
            self.out.append(f'<a href="{htmllib.escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">')
            self.open.append('a')
            return
        if tag == 'img':
            src = a.get('src') or ''
            if urlparse(src).scheme == 'https':
                alt = htmllib.escape(a.get('alt') or '', quote=True)
                self.out.append(f'<img src="{htmllib.escape(src, quote=True)}" alt="{alt}" loading="lazy">')
            return
        if tag == 'br':
            self.out.append('<br>')
            return
        self.out.append(f'<{tag}>')

    def handle_endtag(self, tag):
        if tag in self.DROP_CONTENT:
            if tag not in VOID:
                self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        tag = self.RENAME.get(tag, tag)
        if tag == 'a':
            if self.open and self.open.pop() == 'a':
                self.out.append('</a>')
            return
        if tag in self.ALLOWED and tag not in VOID:
            self.out.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.skip:
            self.out.append(htmllib.escape(data))


def clean(html: str) -> str:
    c = _Clean()
    c.feed(html or '')
    c.close()
    out = ''.join(c.out)
    out = re.sub(r'<p>\s*(<br>)?\s*</p>', '', out)
    out = re.sub(r'<figure>\s*</figure>', '', out)
    return out.strip()


# ─── editions into notes ────────────────────────────────────────────────────
# How Venkat writes an edition: an opener after the greeting, then items
# each under an H3 headline (sometimes inside a bullet), sections like The
# Signals as an H2 above their first item, and The Position and The Stack
# as an H2 with text under it. Divider lines separate most parts. Substack
# wraps each divider in a <div>, and an edition can start with an image, so
# a note starts at every divider and at every headline.
_HEADING = re.compile(r'<h([1-4])\b', re.I)
_INLINE_GREETING = re.compile(
    r'^(<p[^>]*>)\s*(good (morning|afternoon|evening)|hello|hi|hey)( all| everyone)?[,.!]?\s*(<br\s*/?>\s*)+', re.I)


def _is_widget(block: dict) -> bool:
    cls = (block['attrs'].get('class') or '').lower()
    return any(h in cls for h in WIDGET_HINTS)


def _is_hr(block: dict) -> bool:
    return block['tag'] == 'hr' or (not block['text'] and '<hr' in block['html'].lower() and '<img' not in block['html'].lower())


def _is_image(block: dict) -> bool:
    return '<img' in block['html'].lower() and len(block['text'].split()) <= 30


def _heading_level(block: dict) -> Optional[int]:
    """2 for an H2, 3 for an H3 or H4 (or a one-item bullet holding one)."""
    if block['tag'] in ('h1', 'h2'):
        return 2
    if block['tag'] in ('h3', 'h4'):
        return 3
    if block['tag'] in ('ul', 'ol') and block['html'].lower().count('<li') == 1:
        m = _HEADING.search(block['html'])
        if m:
            return 2 if m.group(1) in ('1', '2') else 3
    return None


def _headline_block(block: dict) -> Optional[str]:
    """A headline that wasn't marked as one: a one-item bullet or a short
    line with no full stop."""
    t = block['text']
    if block['tag'] in ('ul', 'ol') and block['html'].lower().count('<li') == 1 and 0 < len(t) <= 120:
        return t
    if block['tag'] == 'p' and 0 < len(t) <= 100 and not t.endswith(('.', ':', '?', '!', ',')) and '<strong' not in block['html']:
        return t
    return None


def _title(text: str) -> str:
    """A headline without the bullet Substack puts in front of one in a list."""
    return re.sub(r'^[•·▪◦‣\-–—*]\s*', '', text).strip()


def _segments(html: str) -> list:
    segs, cur = [], []
    has_body = lambda: any(_heading_level(b) is None and not _is_image(b) and b['text'] for b in cur)
    for b in blocks_of(html):
        if _is_widget(b):
            continue
        if _is_hr(b):
            segs.append(cur)
            cur = []
            continue
        if _heading_level(b) is not None and has_body():
            segs.append(cur)
            cur = []
        cur.append(b)
    segs.append(cur)
    return [s for s in segs if s]


def split_edition(html: str) -> list:
    """[{'kind': 'opener'|'note', 'section', 'headline', 'html', 'image'}]"""
    notes = []
    section_now = None
    for seg in _segments(html):
        blocks = list(seg)
        heads, lead = [], []
        while blocks and (_heading_level(blocks[0]) is not None or _is_image(blocks[0]) or not blocks[0]['text']):
            b = blocks.pop(0)
            if _heading_level(b) is not None:
                heads.append(b)
            elif _is_image(b):
                lead.append(b)
        greeted = False
        while blocks and GREETING.match(blocks[0]['text']):
            blocks.pop(0)
            greeted = True
        if blocks and _INLINE_GREETING.match(blocks[0]['html']):
            first = dict(blocks[0])
            first['html'] = _INLINE_GREETING.sub(r'\1', first['html'])
            blocks[0] = first
            greeted = True
        section = headline = None
        if greeted or (not notes and not heads):
            kind = 'opener'
        else:
            kind = 'note'
            if len(heads) >= 2:
                section_now = _title(heads[0]['text'])
                headline = _title(heads[-1]['text'])
            elif heads:
                headline = _title(heads[0]['text'])
                if _heading_level(heads[0]) == 2:
                    section_now = None  # The Position, The Stack: their own note
            elif blocks and _headline_block(blocks[0]):
                headline = _title(blocks.pop(0)['text'])
            section = section_now if headline != section_now else None
        body = clean(''.join(b['html'] for b in lead + blocks))
        words = len(re.sub(r'<[^>]+>', ' ', re.sub(r'<figure>.*?</figure>', ' ', body, flags=re.S)).split())
        if words < 8:
            continue  # sign-offs, share and subscribe leftovers, lone images
        m = re.search(r'<img src="([^"]+)" alt="([^"]*)"', body)
        notes.append({'kind': kind, 'section': section, 'headline': headline, 'html': body,
                      'image': htmllib.unescape(m.group(1)) if m else None,
                      'image_alt': htmllib.unescape(m.group(2)) if m else ''})
    return notes


def _first_paragraph(html: str) -> str:
    m = re.search(r'<(p|ul|ol|blockquote)>.*?</\1>', re.sub(r'<figure>.*?</figure>', '', html, flags=re.S), re.S)
    return m.group(0) if m else html


def _slug(link: str) -> str:
    path = urlparse(link or '').path.rstrip('/')
    return path.split('/')[-1] or re.sub(r'\W+', '-', link)[-40:]


# ─── reading the feed ───────────────────────────────────────────────────────
# Fetched with a browser's headers and a status check, so a refusal from
# Substack shows up in the dashboard's errors box instead of as an empty list.
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
}
LIVE_RETRY_SECONDS = 300
_last_live_try = 0.0


def _plain(value: str, limit: Optional[int] = None) -> str:
    text = htmllib.unescape(re.sub(r'<[^>]+>', ' ', value or ''))
    text = re.sub(r'\s+', ' ', text).strip()
    if limit and len(text) > limit:
        text = text[:limit].rsplit(' ', 1)[0].rstrip(' ,.;:') + '…'
    return text


def _fetch_feed() -> list:
    """Every edition in the Substack feed, newest first. Raises when the
    feed can't be read, saying why (the status Substack answered with)."""
    import feedparser
    import httpx
    r = httpx.get(FEED_URL, headers=HEADERS, timeout=20, follow_redirects=True)
    if r.status_code != 200:
        raise RuntimeError(f'Left Field feed: Substack answered HTTP {r.status_code}')
    parsed = feedparser.parse(r.content)
    out = []
    for e in parsed.entries:
        stamp = e.get('published_parsed') or e.get('updated_parsed')
        link = e.get('link') or ''
        if not stamp or not link:
            continue
        content = (e['content'][0].get('value') or '') if e.get('content') else ''
        out.append({
            'guid': str(e.get('id') or link), 'slug': _slug(link), 'url': link,
            'title': _plain(e.get('title') or ''), 'subtitle': _plain(e.get('summary') or '', 200),
            'author': e.get('author') or 'The Left Field',
            'published': datetime.fromtimestamp(calendar.timegm(stamp), tz=timezone.utc), 'html': content,
        })
    if not out:
        raise RuntimeError(f'Left Field feed: no editions in the reply ({len(r.content)} bytes)')
    return out


async def refresh() -> list:
    """Reads the feed once, keeps the editions for the website (lf_editions)
    and splits them into the app's notes. Called every 10 minutes by
    push.watch_loop; returns the editions for the notification check."""
    editions = await asyncio.to_thread(_fetch_feed)
    if _db is not None:
        for ed in editions:
            await _db.lf_editions.update_one({'_id': ed['slug']}, {'$set': {
                k: ed[k] for k in ('guid', 'url', 'title', 'subtitle', 'author', 'published')}}, upsert=True)
        await ingest([ed for ed in editions if ed['html']])
    return editions


async def website_feed(limit: int = 15) -> list:
    """The editions as /api/substack/feed has always returned them, from the
    copy kept by refresh(). A page view never waits on Substack: the home
    page gives up after 5 seconds and was showing "The latest briefs are on
    Substack" when the live fetch took longer."""
    global _last_live_try
    if _db is None:
        return []
    docs = await _db.lf_editions.find({}).sort([('published', -1)]).limit(limit).to_list(limit)
    if not docs and time.monotonic() - _last_live_try > LIVE_RETRY_SECONDS:
        _last_live_try = time.monotonic()
        try:
            await refresh()
        except Exception as e:
            logger.error(f'{e}')
        docs = await _db.lf_editions.find({}).sort([('published', -1)]).limit(limit).to_list(limit)
    out = []
    for d in docs:
        p = d.get('published')
        if isinstance(p, datetime) and p.tzinfo is None:
            p = p.replace(tzinfo=timezone.utc)
        out.append({'id': d.get('guid') or d['url'], 'title': d.get('title') or '', 'subtitle': d.get('subtitle') or '',
                    'author': d.get('author') or 'The Left Field', 'external_url': d.get('url') or '',
                    'created_at': p.isoformat() if isinstance(p, datetime) else '', 'image_url': None})
    return out


async def ingest(editions: Optional[list] = None) -> int:
    """Splits editions into notes and keeps them; an edited edition
    replaces its notes. Returns how many notes were written."""
    if _db is None:
        return 0
    editions = editions if editions is not None else [e for e in await asyncio.to_thread(_fetch_feed) if e['html']]
    written = 0
    for ed in editions:
        notes = split_edition(ed['html'])
        ids = []
        for n, note in enumerate(notes):
            nid = f"{ed['slug']}-{n + 1}"
            ids.append(nid)
            await _db.lf_notes.update_one({'_id': nid}, {'$set': {
                **note, 'first_html': _first_paragraph(note['html']), 'index': n,
                'edition_slug': ed['slug'], 'edition_title': ed['title'], 'edition_url': ed['url'],
                'published': ed['published'],
            }}, upsert=True)
            written += 1
        await _db.lf_notes.delete_many({'edition_slug': ed['slug'], '_id': {'$nin': ids}})
    return written


def _out(d: dict, full: bool) -> dict:
    p = d.get('published')
    if isinstance(p, datetime) and p.tzinfo is None:
        p = p.replace(tzinfo=timezone.utc)
    o = {'id': d['_id'], 'kind': d.get('kind'), 'section': d.get('section'), 'headline': d.get('headline'),
         'published': p.isoformat() if isinstance(p, datetime) else None,
         'edition_title': d.get('edition_title'), 'edition_url': d.get('edition_url'),
         'image': d.get('image'), 'image_alt': d.get('image_alt') or ''}
    o['html' if full else 'first_html'] = d.get('html' if full else 'first_html') or ''
    if not full:
        o['more'] = (d.get('html') or '') != (d.get('first_html') or '')
    return o


@router.get('/api/left-field/notes')
async def list_notes(page: int = 0):
    if _db is None:
        return {'notes': [], 'more': False}
    page = max(0, min(page, 200))
    docs = []
    async for d in _db.lf_notes.find({}).sort([('published', -1), ('index', 1)]).skip(page * PAGE_SIZE).limit(PAGE_SIZE + 1):
        docs.append(d)
    return {'notes': [_out(d, False) for d in docs[:PAGE_SIZE]], 'more': len(docs) > PAGE_SIZE}


@router.get('/api/left-field/notes/{note_id}')
async def get_note(note_id: str):
    if _db is None or not re.fullmatch(r'[\w-]{1,200}', note_id):
        raise HTTPException(status_code=404, detail='Note not found')
    d = await _db.lf_notes.find_one({'_id': note_id})
    if not d:
        raise HTTPException(status_code=404, detail='Note not found')
    return _out(d, True)
