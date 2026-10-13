"""The Left Field as a running feed of notes, for the app.

Each edition on Substack is split into notes: the opener (without the
greeting), each item under its H3 headline, and sections like The Position
and The Stack as one note each. Editions are separated into notes at the
divider lines (<hr>), which is the most reliable marker in how Venkat
writes them; the headline is the H3 (or the section's H2, or a short first
line when a headline wasn't marked as one).

Read from the Substack feed (which carries each free edition's full text)
every 10 minutes by push.watch_loop, and kept in lf_notes. The website
doesn't use this: there, The Left Field sends readers to Substack.

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
    ALLOWED = {'p', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'br', 'blockquote'}
    RENAME = {'b': 'strong', 'i': 'em', 'h4': 'p', 'h5': 'p', 'h6': 'p'}
    DROP_CONTENT = {'script', 'style', 'iframe', 'object', 'svg', 'button', 'form', 'noscript', 'figure', 'img'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.open = [], 0, []

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
        if tag == 'a':
            href = dict(attrs).get('href') or ''
            if urlparse(href).scheme not in ('http', 'https'):
                self.open.append(None)
                return
            self.out.append(f'<a href="{htmllib.escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">')
            self.open.append('a')
            return
        if tag == 'br':
            self.out.append('<br>')
            return
        self.out.append(f'<{tag}>')

    def handle_endtag(self, tag):
        if tag in self.DROP_CONTENT:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        tag = self.RENAME.get(tag, tag)
        if tag == 'a':
            if self.open and self.open.pop() == 'a':
                self.out.append('</a>')
            return
        if tag in self.ALLOWED and tag != 'br':
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
    return out.strip()


# ─── editions into notes ────────────────────────────────────────────────────
def _is_widget(block: dict) -> bool:
    cls = (block['attrs'].get('class') or '').lower()
    return any(h in cls for h in WIDGET_HINTS)


def _headline_block(block: dict) -> Optional[str]:
    """A block that is a headline: a heading, or a one-item list or short
    line standing in for one."""
    t = block['text']
    if block['tag'] in ('h1', 'h2', 'h3', 'h4'):
        return t
    if block['tag'] in ('ul', 'ol') and block['html'].count('<li') == 1 and 0 < len(t) <= 120:
        return t
    if block['tag'] == 'p' and 0 < len(t) <= 100 and not t.endswith(('.', ':', '?', '!')) and '<strong' not in block['html']:
        return t
    return None


def split_edition(html: str) -> list:
    """[{'kind': 'opener'|'note', 'section', 'headline', 'html'}]"""
    chunks, cur = [], []
    for b in blocks_of(html):
        if b['tag'] == 'hr':
            chunks.append(cur)
            cur = []
        elif not _is_widget(b):
            cur.append(b)
    chunks.append(cur)
    notes = []
    for i, chunk in enumerate(c for c in chunks if c):
        blocks = list(chunk)
        section = headline = None
        if i == 0 and not any(b['tag'] in ('h1', 'h2', 'h3') for b in blocks):
            while blocks and GREETING.match(blocks[0]['text']):
                blocks.pop(0)
            kind = 'opener'
        else:
            kind = 'note'
            if blocks and blocks[0]['tag'] == 'h2' and len(blocks) > 1 and _headline_block(blocks[1]) and blocks[1]['tag'] != 'p':
                section = blocks.pop(0)['text']
            if blocks and _headline_block(blocks[0]):
                headline = blocks.pop(0)['text']
        body = clean(''.join(b['html'] for b in blocks))
        words = len(re.sub(r'<[^>]+>', ' ', body).split())
        if words < 8:
            continue  # sign-offs, share and subscribe leftovers
        notes.append({'kind': kind, 'section': section, 'headline': headline, 'html': body})
    return notes


def _first_paragraph(html: str) -> str:
    m = re.search(r'<(p|ul|ol|blockquote)>.*?</\1>', html, re.S)
    return m.group(0) if m else html


def _slug(link: str) -> str:
    path = urlparse(link or '').path.rstrip('/')
    return path.split('/')[-1] or re.sub(r'\W+', '-', link)[-40:]


# ─── reading the feed ───────────────────────────────────────────────────────
def _read_feed() -> list:
    import feedparser
    out = []
    for e in feedparser.parse(FEED_URL).entries:
        content = ''
        if e.get('content'):
            content = e['content'][0].get('value') or ''
        stamp = e.get('published_parsed') or e.get('updated_parsed')
        if not content or not stamp:
            continue
        out.append({
            'slug': _slug(e.get('link')), 'url': e.get('link') or '', 'title': (e.get('title') or '').strip(),
            'published': datetime.fromtimestamp(calendar.timegm(stamp), tz=timezone.utc), 'html': content,
        })
    return out


async def ingest(editions: Optional[list] = None) -> int:
    """Splits every edition in the feed into notes and keeps them; an edited
    edition replaces its notes. Returns how many notes were written."""
    if _db is None:
        return 0
    editions = editions if editions is not None else await asyncio.to_thread(_read_feed)
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
         'edition_title': d.get('edition_title'), 'edition_url': d.get('edition_url')}
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
