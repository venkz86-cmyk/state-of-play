"""Tests for OG (Open Graph) endpoints used by social bots (WhatsApp, Twitter, etc.)
Background: Vercel rewrites bot UAs from /{slug} to backend /api/og/{slug}.
Backend must always return 200 HTML with OG meta tags (never redirect -> would loop).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
REAL_SLUG = "pio-oci-aiff-sports-passport"
FAKE_SLUG = "this-slug-does-not-exist-1234"

BOT_UAS = {
    "whatsapp": "WhatsApp/2.23.20.0 A",
    "facebook": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "twitter": "Twitterbot/1.0",
    "linkedin": "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "slack": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
}
BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


@pytest.fixture
def session():
    s = requests.Session()
    return s


# --- /api/og/{slug} with various bot UAs on a REAL slug ---
@pytest.mark.parametrize("bot_name,ua", list(BOT_UAS.items()))
def test_og_meta_real_slug_with_bot_ua(session, bot_name, ua):
    """Bot UAs must get 200 + OG meta with real Ghost data."""
    r = session.get(
        f"{BASE_URL}/api/og/{REAL_SLUG}",
        headers={"User-Agent": ua},
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 200, f"[{bot_name}] expected 200 got {r.status_code}"
    assert "text/html" in r.headers.get("content-type", ""), \
        f"[{bot_name}] expected text/html got {r.headers.get('content-type')}"
    body = r.text
    assert '<meta property="og:title" content="Passported out">' in body, \
        f"[{bot_name}] missing or wrong og:title. Body snippet: {body[:500]}"
    assert f'<meta property="og:image" content="https://www.stateofplay.club/api/og-image/{REAL_SLUG}">' in body, \
        f"[{bot_name}] missing or wrong og:image"
    assert '<meta property="og:type" content="article">' in body
    assert '<meta name="twitter:card" content="summary_large_image">' in body


def test_og_meta_real_slug_with_browser_ua(session):
    """Backend bot-detection was removed; browser UA must also get 200 + OG HTML."""
    r = session.get(
        f"{BASE_URL}/api/og/{REAL_SLUG}",
        headers={"User-Agent": BROWSER_UA},
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 200, f"expected 200 got {r.status_code}"
    assert "text/html" in r.headers.get("content-type", "")
    assert '<meta property="og:title" content="Passported out">' in r.text


def test_og_meta_unknown_slug_no_redirect(session):
    """CRITICAL: Unknown slug must return 200 with site defaults, NEVER 301/302 (would infinite-loop)."""
    r = session.get(
        f"{BASE_URL}/api/og/{FAKE_SLUG}",
        headers={"User-Agent": BOT_UAS["whatsapp"]},
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 200, \
        f"CRITICAL: Unknown slug returned {r.status_code} (must be 200, not redirect). Headers: {dict(r.headers)}"
    assert r.status_code not in (301, 302, 307, 308), "MUST NOT redirect"
    assert "text/html" in r.headers.get("content-type", "")
    body = r.text
    # Site defaults expected
    assert 'og:title' in body
    assert 'og:image' in body
    assert f'https://www.stateofplay.club/api/og-image/{FAKE_SLUG}' in body
    assert '<meta property="og:type" content="article">' in body


# --- /api/og-image/{slug} ---
def test_og_image_real_slug(session):
    """Dynamic 1200x630 PNG generation must return real PNG > 50KB."""
    r = session.get(f"{BASE_URL}/api/og-image/{REAL_SLUG}", allow_redirects=True, timeout=30)
    assert r.status_code == 200, f"expected 200 got {r.status_code}"
    assert r.headers.get("content-type") == "image/png", \
        f"expected image/png got {r.headers.get('content-type')}"
    assert len(r.content) > 50000, f"PNG too small ({len(r.content)} bytes) - probably error redirect"
    # PNG magic bytes
    assert r.content[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG file"


def test_og_image_unknown_slug_graceful(session):
    """Unknown slug should fallback to a PNG (200) or graceful redirect — NOT a 500."""
    r = session.get(
        f"{BASE_URL}/api/og-image/this-totally-fake-slug-xyz-999",
        allow_redirects=False,
        timeout=30,
    )
    assert r.status_code != 500, f"500 error! Body: {r.text[:500]}"
    assert r.status_code in (200, 301, 302, 307, 308), f"Unexpected status {r.status_code}"


# --- /api/sitemap.xml ---
def test_sitemap_xml(session):
    r = session.get(f"{BASE_URL}/api/sitemap.xml", timeout=20)
    assert r.status_code == 200, f"expected 200 got {r.status_code}"
    ctype = r.headers.get("content-type", "")
    assert "xml" in ctype, f"expected xml got {ctype}"
    url_count = r.text.count("<url>")
    assert url_count >= 12, f"expected at least 12 <url> entries, got {url_count}"


# --- /api/robots.txt ---
def test_robots_txt(session):
    r = session.get(f"{BASE_URL}/api/robots.txt", timeout=20)
    assert r.status_code == 200, f"expected 200 got {r.status_code}"
    assert "Sitemap: https://www.stateofplay.club/sitemap.xml" in r.text, \
        f"sitemap line missing. Body: {r.text}"


# --- vercel.json validity ---
def test_vercel_json_valid_and_has_bot_rewrite():
    import json
    with open("/app/frontend/vercel.json") as f:
        cfg = json.load(f)
    assert "rewrites" in cfg
    bot_rewrite = None
    for r in cfg["rewrites"]:
        if "has" in r:
            for h in r["has"]:
                if h.get("key", "").lower() == "user-agent":
                    bot_rewrite = r
                    break
    assert bot_rewrite is not None, "No user-agent has-rule rewrite found"
    ua_value = bot_rewrite["has"][0]["value"].lower()
    for needle in ["whatsapp", "facebookexternalhit", "twitterbot", "linkedinbot", "slackbot"]:
        assert needle in ua_value, f"UA regex missing {needle}"
    assert bot_rewrite["destination"] == "https://stateofplay-backend.onrender.com/api/og/:slug"


# --- Mongo independence check ---
def test_og_endpoint_no_mongo_dependency(session):
    """Even with fake slug (which won't query Mongo anyway), OG endpoint should return 200."""
    r = session.get(
        f"{BASE_URL}/api/og/some-random-slug-xyz",
        headers={"User-Agent": BOT_UAS["whatsapp"]},
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 200
