"""Graphics a reader can share from a story, in the app.

Venkat marks a graphic in Ghost by starting the image's alt text with
"Graphic:" (alt text shows nowhere: not on the website, in the app or in
emails). The app puts a share button on each one and asks here for the
graphic framed in the house style: the logo above it, its caption as the
source line, the story's headline below.

  GET /api/story-graphic/{slug}/{n}?format=post   1080x1350, for WhatsApp,
                                                    LinkedIn and the feed
  GET /api/story-graphic/{slug}/{n}?format=story  1080x1920, for Stories

n counts the story's marked graphics from 0, in the order they appear
(the app counts them the same way). Paid stories' graphics are shareable
too: Venkat chose to mark them.
"""
import html as htmllib
import logging
import os
import re
from io import BytesIO
from typing import Awaitable, Callable, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

logger = logging.getLogger(__name__)
router = APIRouter()

_get_post: Optional[Callable[[str], Awaitable[Optional[dict]]]] = None
_CACHE: dict = {}  # (slug, n, format, updated_at) -> png bytes
_CACHE_MAX = 60

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
BG = (250, 249, 247)
INK = (26, 26, 26)
MUTED = (100, 100, 100)
RULE = (229, 226, 220)
RED = (160, 41, 28)

_IMG = re.compile(r'<img\b[^>]*>', re.I)
_ATTR = lambda name: re.compile(rf'\b{name}\s*=\s*"([^"]*)"', re.I)
_SRC, _ALT = _ATTR('src'), _ATTR('alt')
_MARK = re.compile(r'^\s*graphic\s*:', re.I)


def init(get_post: Callable[[str], Awaitable[Optional[dict]]]):
    global _get_post
    _get_post = get_post


def _text(fragment: str) -> str:
    return re.sub(r'\s+', ' ', htmllib.unescape(re.sub(r'<[^>]+>', ' ', fragment or ''))).strip()


def graphics(body: str) -> list:
    """The story's marked graphics, in order: [{src, caption}]."""
    out = []
    for m in _IMG.finditer(body or ''):
        tag = m.group(0)
        alt, src = _ALT.search(tag), _SRC.search(tag)
        if not (alt and src and _MARK.match(htmllib.unescape(alt.group(1)))):
            continue
        rest = body[m.end():]
        end = rest.find('</figure>')
        within = rest[:end] if end >= 0 else ''
        cap = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', within, re.S | re.I)
        out.append({'src': htmllib.unescape(src.group(1)), 'caption': _text(cap.group(1)) if cap else ''})
    return out


def _wrap(draw, text, font, width, max_lines):
    lines, cur = [], ''
    for w in text.split():
        test = f'{cur} {w}'.strip()
        if draw.textlength(test, font=font) <= width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1].rstrip('.,;:')
        while last and draw.textlength(last + '…', font=font) > width:
            last = last[:-1].rstrip()
        lines[-1] = last + '…'
    return lines


def render(graphic_bytes: bytes, title: str, caption: str, fmt: str) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    story = fmt == 'story'
    W, H = (1080, 1920) if story else (1080, 1350)
    pad = 72
    top, bottom = (230, 270) if story else (72, 72)  # Stories cover the top and bottom edges

    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 9], fill=RED)

    head_font = ImageFont.truetype(os.path.join(ASSETS, 'fonts', 'Gloock.ttf'), 50 if story else 44)
    cap_font = ImageFont.truetype(os.path.join(ASSETS, 'fonts', 'SchibstedGrotesk.ttf'), 26 if story else 24)

    logo = Image.open(os.path.join(ASSETS, 'tsop-logo-blue.png')).convert('RGBA')
    lh = 72 if story else 64
    logo = logo.resize((int(lh * logo.width / logo.height), lh), Image.LANCZOS)
    img.paste(logo, (pad, top), logo)

    # The graphic, its source line, a rule and the headline, as one block
    # centred in the space below the logo.
    inner = W - 2 * pad
    head = _wrap(d, title, head_font, inner, 3)
    head_lh = int(head_font.size * 1.18)
    cap = _wrap(d, caption, cap_font, inner, 2) if caption else []
    cap_lh = int(cap_font.size * 1.4)
    cap_h = 18 + cap_lh * len(cap) if cap else 0
    text_h = cap_h + 40 + 1 + 36 + head_lh * len(head)
    area_top, area_bottom = top + lh + 56, H - bottom

    g = Image.open(BytesIO(graphic_bytes))
    g = g.convert('RGBA') if g.mode in ('P', 'LA', 'RGBA') else g.convert('RGB')
    scale = min(inner / g.width, (area_bottom - area_top - text_h) / g.height)
    g = g.resize((max(1, int(g.width * scale)), max(1, int(g.height * scale))), Image.LANCZOS)

    y = area_top + max(0, (area_bottom - area_top - g.height - text_h) // 2)
    gx = pad + (inner - g.width) // 2
    if g.mode == 'RGBA':
        img.paste(g, (gx, y), g)
    else:
        img.paste(g, (gx, y))
    y += g.height
    for i, line in enumerate(cap):
        d.text((pad, y + 18 + i * cap_lh), line, fill=MUTED, font=cap_font)
    y += cap_h + 40
    d.rectangle([pad, y, W - pad, y], fill=RULE)
    y += 37
    for i, line in enumerate(head):
        d.text((pad, y + i * head_lh), line, fill=INK, font=head_font)

    out = BytesIO()
    img.save(out, format='PNG', optimize=True)
    return out.getvalue()


@router.get('/api/story-graphic/{slug}/{n}')
async def story_graphic(slug: str, n: int, format: str = 'post'):
    fmt = 'story' if format == 'story' else 'post'
    post = await _get_post(slug) if _get_post else None
    if not post:
        raise HTTPException(status_code=404, detail='Story not found')
    found = graphics(post.get('html') or '')
    if not 0 <= n < len(found):
        raise HTTPException(status_code=404, detail='Graphic not found')
    key = (slug, n, fmt, post.get('updated_at'))
    png = _CACHE.get(key)
    if png is None:
        src = found[n]['src']
        if src.startswith('/'):
            src = 'https://www.stateofplay.club' + src
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                r = await client.get(src)
            r.raise_for_status()
            png = render(r.content, post.get('title') or 'The State of Play', found[n]['caption'], fmt)
        except Exception as e:
            logger.error(f'story graphic {slug}/{n} failed: {e!r}')
            raise HTTPException(status_code=502, detail='Graphic could not be made')
        _CACHE[key] = png
        if len(_CACHE) > _CACHE_MAX:
            _CACHE.pop(next(iter(_CACHE)))
    return Response(content=png, media_type='image/png', headers={
        'Cache-Control': 'public, max-age=86400',
        'Content-Disposition': f'inline; filename={slug}-graphic-{n + 1}.png',
    })
