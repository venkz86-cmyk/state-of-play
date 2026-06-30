"""Tests for the /api/robots.txt fix (iteration_4).

Background: Twitter's Card Validator warned that the og:image URL was blocked
by robots.txt because the previous robots.txt had `Disallow: /api/`. That single
line blocked Twitter/LinkedIn/Facebook/WhatsApp from fetching the dynamic OG
image at /api/og-image/{slug}. The fix rewrote robots.txt with explicit per-bot
`Allow: /` blocks and removed `Disallow: /api/` from the wildcard block.
"""
import os
from io import BytesIO
from urllib.robotparser import RobotFileParser

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
REAL_SLUG = "pio-oci-aiff-sports-passport"

# Preview emergent edge proxy 403s the default Python urllib UA.
MOZILLA_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

ROBOTS_URL = f"{BASE_URL}/api/robots.txt"
OG_IMAGE_PATH = f"/api/og-image/{REAL_SLUG}"


@pytest.fixture(scope="module")
def robots_body():
    r = requests.get(ROBOTS_URL, headers={"User-Agent": MOZILLA_UA}, timeout=20)
    assert r.status_code == 200, f"robots.txt fetch failed: {r.status_code}"
    return r


@pytest.fixture(scope="module")
def robot_parser(robots_body):
    rp = RobotFileParser()
    rp.set_url(ROBOTS_URL)
    rp.parse(robots_body.text.splitlines())
    return rp


# ─── Basic shape ───────────────────────────────────────────────────────────
class TestRobotsTxtBasics:
    def test_status_200(self, robots_body):
        assert robots_body.status_code == 200

    def test_content_type_text_plain(self, robots_body):
        ctype = robots_body.headers.get("content-type", "")
        assert "text/plain" in ctype, f"expected text/plain, got {ctype}"

    def test_no_disallow_api_anywhere(self, robots_body):
        """CRITICAL: the bug fix. Must NOT contain `Disallow: /api/` anywhere."""
        body = robots_body.text
        # Normalize whitespace per-line to catch any subtle variants
        for line in body.splitlines():
            stripped = line.strip()
            assert stripped.lower() != "disallow: /api/", \
                f"REGRESSION: robots.txt still has '{stripped}' — this was the bug!"
            assert stripped.lower() != "disallow: /api", \
                f"REGRESSION: robots.txt still has '{stripped}'"

    def test_sitemap_pointer_preserved(self, robots_body):
        assert "Sitemap: https://www.stateofplay.club/sitemap.xml" in robots_body.text


# ─── Per-bot Allow blocks ──────────────────────────────────────────────────
REQUIRED_BOT_BLOCKS = [
    "Twitterbot",
    "facebookexternalhit",
    "LinkedInBot",
    "WhatsApp",
    "Slackbot",
    "TelegramBot",
    "Discordbot",
    "Pinterest",
]


class TestPerBotAllowBlocks:
    @pytest.mark.parametrize("bot", REQUIRED_BOT_BLOCKS)
    def test_bot_has_user_agent_line(self, robots_body, bot):
        assert f"User-agent: {bot}" in robots_body.text, \
            f"Missing 'User-agent: {bot}' block"

    @pytest.mark.parametrize("bot", REQUIRED_BOT_BLOCKS)
    def test_bot_block_followed_by_allow(self, robots_body, bot):
        """Each per-bot 'User-agent: <bot>' line must be followed by 'Allow: /'."""
        lines = robots_body.text.splitlines()
        found = False
        for i, line in enumerate(lines):
            if line.strip() == f"User-agent: {bot}":
                # The next non-blank line should be Allow: /
                for j in range(i + 1, min(i + 4, len(lines))):
                    nxt = lines[j].strip()
                    if nxt == "":
                        continue
                    assert nxt == "Allow: /", \
                        f"For bot {bot}: expected 'Allow: /' after User-agent line, got '{nxt}'"
                    found = True
                    break
                break
        assert found, f"Could not find Allow rule for {bot}"


# ─── Wildcard block ────────────────────────────────────────────────────────
class TestWildcardBlock:
    def test_wildcard_block_present(self, robots_body):
        assert "User-agent: *" in robots_body.text

    @pytest.mark.parametrize("path", [
        "Disallow: /account",
        "Disallow: /login",
        "Disallow: /teams/manage",
        "Disallow: /teams/login",
        "Disallow: /s/",
    ])
    def test_wildcard_disallow_rules_present(self, robots_body, path):
        assert path in robots_body.text, f"Missing wildcard rule: {path}"


# ─── robotparser semantic check (this is the real validation Twitter does) ─
SOCIAL_BOTS = {
    "Twitterbot": "Twitterbot/1.0",
    "LinkedInBot": "LinkedInBot/1.0",
    "facebookexternalhit": "facebookexternalhit/1.1",
    "WhatsApp": "WhatsApp/2.23.20.0 A",
    "Slackbot": "Slackbot-LinkExpanding 1.0",
}


class TestRobotParserCanFetchOgImage:
    @pytest.mark.parametrize("bot_name,ua", list(SOCIAL_BOTS.items()))
    def test_social_bot_can_fetch_og_image(self, robot_parser, bot_name, ua):
        """The single most important test: simulate what Twitter/LinkedIn actually do."""
        assert robot_parser.can_fetch(ua, OG_IMAGE_PATH) is True, \
            f"BUG: {bot_name} (UA={ua}) is BLOCKED from {OG_IMAGE_PATH} by robots.txt"

    @pytest.mark.parametrize("bot_name", list(SOCIAL_BOTS.keys()))
    def test_social_bot_short_name_can_fetch_og_image(self, robot_parser, bot_name):
        """Test bots by short identifier name too (matches per-bot block)."""
        assert robot_parser.can_fetch(bot_name, OG_IMAGE_PATH) is True, \
            f"BUG: {bot_name} short-name is BLOCKED from {OG_IMAGE_PATH}"

    def test_unknown_crawler_can_fetch_og_image(self, robot_parser):
        """Wildcard rule no longer blocks /api/, so unknown bots are allowed."""
        assert robot_parser.can_fetch("SomeRandomCrawler", OG_IMAGE_PATH) is True, \
            "Wildcard block is still blocking /api/ — Disallow: /api/ may have re-appeared"

    def test_wildcard_disallow_rules_present_in_body(self, robots_body):
        """The wildcard block still declares Disallow on human routes.

        NOTE: We don't use Python urllib.robotparser for can_fetch on /account
        because Python's robotparser implements *first-match-wins* (per RFC
        1996) and our 'Allow: /' line precedes the Disallow lines, so the
        parser returns True. Real-world crawlers (Google/Bing/Twitter) all
        use *longest-match-wins* per the modern REP draft (2022), under which
        `Disallow: /account` correctly wins over `Allow: /` for /account.
        So we just verify the rules are present in the body.
        """
        body = robots_body.text
        # Find the wildcard block
        assert "User-agent: *" in body
        # All human-route disallows present
        for rule in ["/account", "/login", "/teams/manage", "/teams/login", "/s/"]:
            assert f"Disallow: {rule}" in body, f"Missing wildcard Disallow: {rule}"


# ─── Confirm the underlying OG endpoints still work ───────────────────────
class TestOgEndpointsStillWork:
    def test_og_image_real_slug_returns_png(self):
        r = requests.get(
            f"{BASE_URL}{OG_IMAGE_PATH}",
            headers={"User-Agent": MOZILLA_UA},
            timeout=30,
            allow_redirects=True,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type") == "image/png"
        assert len(r.content) > 50000, f"PNG too small: {len(r.content)} bytes"
        assert r.content[:8] == b'\x89PNG\r\n\x1a\n'

    def test_og_meta_with_twitterbot_ua(self):
        r = requests.get(
            f"{BASE_URL}/api/og/{REAL_SLUG}",
            headers={"User-Agent": "Twitterbot/1.0"},
            timeout=20,
            allow_redirects=False,
        )
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert (
            f'<meta property="og:image" '
            f'content="https://www.stateofplay.club/api/og-image/{REAL_SLUG}">'
        ) in r.text

    def test_sitemap_still_works(self):
        r = requests.get(f"{BASE_URL}/api/sitemap.xml",
                         headers={"User-Agent": MOZILLA_UA}, timeout=20)
        assert r.status_code == 200
        assert "xml" in r.headers.get("content-type", "")
        assert "<url>" in r.text
