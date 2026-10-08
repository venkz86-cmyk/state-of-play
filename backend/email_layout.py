"""
email_layout.py — shared HTML chrome for every outbound email in this
codebase, so the look can't drift between modules the way nine
independently copy-pasted wrappers already had started to. Promoted from
trial_tracking.py's own _trial_email_shell (the only module that had
already noticed this and built a local fix -- every other module still
hand-rolled its own copy of the same wrapper, byte-for-byte identical
except for drift risk).

Callers own their own headline text and body paragraphs (greeting
included, since that varies deliberately by email -- "Dear reader," for
an editorial-voice email, "Hello," for a gift notice, nothing at all for
a quick code or receipt). This module owns only what should never vary
between emails: the logo, the base font/color/width, the CTA button, the
sign-off, and the compliance footer.

LOGO_URL has to be the full, absolute, publicly-hosted URL -- a relative
path like the frontend's own `/tsop-logo.png` doesn't resolve inside an
email client, which renders with no notion of the site's own origin.
"""
from __future__ import annotations

LOGO_URL = 'https://www.stateofplay.club/tsop-logo.png'

_FONT_BODY = "'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
_FONT_HEADLINE = "Gloock, 'Playfair Display', Georgia, serif"

# Exact tokens from frontend/src/index.css's light-mode palette -- an
# email is a different canvas than the site, but it should still look
# unmistakably like the same publication, not just "a company that also
# has a website with these colors."
_BG = '#FAF9F7'
_TEXT = '#1A1A1A'
_RULE = '#E5E2DC'
_ACCENT = '#A0291C'
_LABEL = '#666666'

# A masthead, not just a logo: the 3px top rule + the hairline under the
# logo mirror the site's own header (a bordered bar above the page, a
# border-bottom under the nav) -- the thing the first version was
# missing, having dropped the old text eyebrow's structural job along
# with its wording.
_MASTHEAD_HTML = (
    f'<div style="border-top: 3px solid {_ACCENT}; padding-top: 28px; margin-bottom: 32px;">'
    f'<img src="{LOGO_URL}" alt="The State of Play" height="22" '
    'style="height: 22px; width: auto; display: block; margin-bottom: 20px;">'
    f'<div style="border-bottom: 1px solid {_RULE};"></div>'
    '</div>'
)

_DEFAULT_SIGNOFF_TITLE = 'Editor, The State of Play'


def _signoff_html(title: str = _DEFAULT_SIGNOFF_TITLE) -> str:
    return (
        f'<div style="border-top: 1px solid {_RULE}; margin-top: 40px; padding-top: 24px;">'
        '<p style="margin: 0;">Venkat<br>'
        f'<span style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: {_LABEL};">{title}</span>'
        '</p>'
        '</div>'
    )

# CAN-SPAM-style postal disclosure -- opt-in (compliance_footer=True)
# rather than universal, since only the higher-volume subscriber-facing
# emails (sign-in codes, nominations, Trial) have carried it so far, not
# the admin-only or one-off transactional ones.
# The registered address, on every email Resend sends. resend_email.
# send_email adds it (address_footer below), so no template can leave it
# out; compliance_footer on email_shell is kept only so existing callers
# don't break, and adds nothing.
COMPANY_ADDRESS_LINES = (
    'Left Field Ventures',
    'Ground Floor, 36, Infantry Road, Tasker Town, Shivaji Nagar,',
    'Bengaluru, Karnataka 560001',
)
COMPANY_ADDRESS_HTML = (
    '<p data-company-address style="font-size: 12px; color: #999999; line-height: 1.7; margin-top: 32px;">'
    + '<br>'.join(COMPANY_ADDRESS_LINES)
    + '</p>'
)
COMPANY_ADDRESS_TEXT = '\n'.join(COMPANY_ADDRESS_LINES)


def add_company_address(html: str) -> str:
    """Puts the address at the bottom of an email: inside the house
    layout's container when the email uses email_shell, at the end
    otherwise. Never twice."""
    if not html or 'data-company-address' in html:
        return html
    if html.rstrip().endswith('</div>') and 'max-width: 560px' in html:
        body = html.rstrip()
        return body[:-len('</div>')] + COMPANY_ADDRESS_HTML + '</div>'
    return html + COMPANY_ADDRESS_HTML


def email_cta_button(label: str, url: str) -> str:
    """The one button style every email's call-to-action already used,
    identically, before this existed."""
    return (
        f'<p style="margin: 32px 0;"><a href="{url}" style="display: inline-block; background: {_ACCENT}; color: #fff; '
        'text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; '
        f'padding: 14px 28px;">{label}</a></p>'
    )


def email_shell(
    headline_html: str,
    body_html: str,
    *,
    signoff: bool = True,
    signoff_title: str = _DEFAULT_SIGNOFF_TITLE,
    compliance_footer: bool = False,
) -> str:
    """headline_html is whatever goes inside the <h1> (an <em>-wrapped
    word or two is the established house style, e.g. "has <em>lapsed</em>.").
    body_html is everything from the greeting (if any) through the last
    paragraph before the sign-off -- callers own their own <p> tags and
    their own CTA button via email_cta_button() above. signoff_title lets
    a specific email use a different line under "Venkat" (e.g. "Founder
    and editor" for the more personal annual-renewal note) without
    changing the other 14 templates that don't pass it."""
    return (
        f'<div style="font-family: {_FONT_BODY}; max-width: 560px; margin: 0 auto; background: {_BG}; padding: 40px 36px; color: {_TEXT}; line-height: 1.7; font-size: 16px;">'
        f'{_MASTHEAD_HTML}'
        f'<h1 style="font-family: {_FONT_HEADLINE}; font-weight: 400; font-size: 28px; line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 24px;">{headline_html}</h1>'
        f'{body_html}'
        f'{_signoff_html(signoff_title) if signoff else ""}'
        '</div>'
    )
