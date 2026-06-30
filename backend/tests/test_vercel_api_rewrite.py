"""Tests for iteration_5 fix: the new /api/:path* Vercel rewrite.

Background: Without an /api/* rewrite in vercel.json, requests to
https://www.stateofplay.club/api/og-image/{slug} were caught by the
catch-all `/(.*) -> /index.html` and served the React SPA HTML instead
of the dynamic PNG from the Render backend. Social bots (Twitter,
LinkedIn) saw the wrong content-type and dropped the og:image -> no
preview card. Fix: explicit `/api/:path*` rewrite to the Render
backend, placed BEFORE the /:slug UA-conditional rewrite and BEFORE
the catch-all.

Vercel evaluates rewrites in document order, first match wins.
"""
import json
import re

import pytest

VERCEL_JSON_PATH = "/app/frontend/vercel.json"
BACKEND_ORIGIN = "https://stateofplay-backend.onrender.com"


@pytest.fixture(scope="module")
def cfg():
    with open(VERCEL_JSON_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def rewrites(cfg):
    assert "rewrites" in cfg, "rewrites key missing from vercel.json"
    return cfg["rewrites"]


# --- Shape ----------------------------------------------------------------
def test_vercel_json_is_valid_json():
    with open(VERCEL_JSON_PATH) as f:
        json.load(f)  # raises if invalid


def test_rewrites_count_is_seven(rewrites):
    assert len(rewrites) == 7, f"expected 7 rewrites, got {len(rewrites)}"


# --- The new /api/:path* rewrite (the fix) --------------------------------
def test_api_path_rewrite_at_index_4(rewrites):
    r = rewrites[4]
    assert r.get("source") == "/api/:path*", \
        f"expected source '/api/:path*' at index 4, got {r.get('source')!r}"
    assert r.get("destination") == f"{BACKEND_ORIGIN}/api/:path*", \
        f"wrong destination: {r.get('destination')!r}"
    # No conditional `has` rule — must always apply.
    assert "has" not in r, "/api/:path* must not be UA-conditional"


# --- Ordering -------------------------------------------------------------
EXPECTED_ORDER = [
    "/content/:path*",
    "/s/:token",
    "/sitemap.xml",
    "/robots.txt",
    "/api/:path*",
    None,          # /:slug UA-conditional (regex source — checked separately)
    "/(.*)",
]


def test_rewrite_order(rewrites):
    actual_sources = [r["source"] for r in rewrites]
    for i, expected in enumerate(EXPECTED_ORDER):
        if expected is None:
            # /:slug UA-conditional check
            assert actual_sources[i].startswith("/:slug"), \
                f"index {i} should be /:slug UA-conditional rewrite, got {actual_sources[i]!r}"
        else:
            assert actual_sources[i] == expected, \
                f"index {i}: expected {expected!r}, got {actual_sources[i]!r}"


def test_api_rewrite_before_slug_rewrite(rewrites):
    """The new /api/:path* MUST come before the UA-conditional /:slug rewrite."""
    api_idx = next(i for i, r in enumerate(rewrites) if r["source"] == "/api/:path*")
    slug_idx = next(i for i, r in enumerate(rewrites) if r["source"].startswith("/:slug"))
    assert api_idx < slug_idx, \
        f"/api/:path* (idx {api_idx}) must come before /:slug (idx {slug_idx})"


def test_api_rewrite_before_catchall(rewrites):
    """The new /api/:path* MUST come before the catch-all /(.*) rewrite."""
    api_idx = next(i for i, r in enumerate(rewrites) if r["source"] == "/api/:path*")
    catch_idx = next(i for i, r in enumerate(rewrites) if r["source"] == "/(.*)")
    assert api_idx < catch_idx, \
        f"/api/:path* (idx {api_idx}) must come before /(.*) (idx {catch_idx})"


# --- Specific rewrites still present (regression) -------------------------
def test_sitemap_rewrite_preserved(rewrites):
    sm = next((r for r in rewrites if r["source"] == "/sitemap.xml"), None)
    assert sm is not None, "/sitemap.xml rewrite missing"
    assert sm["destination"] == f"{BACKEND_ORIGIN}/api/sitemap.xml"


def test_robots_rewrite_preserved(rewrites):
    rb = next((r for r in rewrites if r["source"] == "/robots.txt"), None)
    assert rb is not None, "/robots.txt rewrite missing"
    assert rb["destination"] == f"{BACKEND_ORIGIN}/api/robots.txt"


def test_sitemap_and_robots_before_api_path(rewrites):
    """Vercel evaluates in order. Specific /sitemap.xml and /robots.txt must
    sit BEFORE /api/:path* so they keep their specific destinations even
    though /api/:path* would also match conceptually (sitemap/robots are
    served from the root domain, not /api/* on Vercel's edge)."""
    sources = [r["source"] for r in rewrites]
    api_idx = sources.index("/api/:path*")
    assert sources.index("/sitemap.xml") < api_idx
    assert sources.index("/robots.txt") < api_idx


# --- /:slug UA-conditional rewrite still excludes api/ --------------------
def test_slug_rewrite_negative_lookahead_excludes_api(rewrites):
    slug = next((r for r in rewrites if r["source"].startswith("/:slug")), None)
    assert slug is not None, "/:slug UA-conditional rewrite missing"
    source = slug["source"]
    # The negative lookahead should contain 'api/'
    assert "api/" in source, \
        f"/:slug source missing 'api/' in negative lookahead: {source!r}"
    # Specifically, the negative lookahead pattern (?!api/|...) must contain api/
    m = re.search(r"\(\?!([^)]+)\)", source)
    assert m, f"No negative-lookahead group found in /:slug source: {source!r}"
    excluded = m.group(1)
    assert "api/" in excluded, \
        f"'api/' not in negative lookahead exclusion list: {excluded!r}"


def test_slug_rewrite_has_user_agent_condition(rewrites):
    slug = next((r for r in rewrites if r["source"].startswith("/:slug")), None)
    assert slug is not None
    assert "has" in slug, "/:slug must be UA-conditional"
    ua_rules = [h for h in slug["has"] if h.get("key", "").lower() == "user-agent"]
    assert ua_rules, "/:slug must have a user-agent has-rule"
    # Confirm key social bots remain in the UA regex
    ua_re = ua_rules[0]["value"].lower()
    for bot in ["twitterbot", "linkedinbot", "facebookexternalhit", "whatsapp", "slackbot"]:
        assert bot in ua_re, f"/:slug UA regex missing {bot}"


# --- Catch-all is last ----------------------------------------------------
def test_catchall_is_last(rewrites):
    assert rewrites[-1]["source"] == "/(.*)", \
        f"last rewrite must be /(.*) catch-all, got {rewrites[-1]['source']!r}"
    assert rewrites[-1]["destination"] == "/index.html"
