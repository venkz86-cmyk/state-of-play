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

_LOGO_HTML = (
    f'<img src="{LOGO_URL}" alt="The State of Play" height="24" '
    'style="height: 24px; width: auto; margin: 0 0 28px; display: block;">'
)

_SIGNOFF_HTML = (
    '<p style="margin-top: 32px;">Venkat<br>'
    '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
    '</p>'
)

# CAN-SPAM-style postal disclosure -- opt-in (compliance_footer=True)
# rather than universal, since only the higher-volume subscriber-facing
# emails (sign-in codes, nominations, Trial) have carried it so far, not
# the admin-only or one-off transactional ones.
_COMPLIANCE_FOOTER_HTML = (
    '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">'
    '<p style="font-size: 12px; color: #999999; line-height: 1.7;">'
    'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001'
    '</p>'
)


def email_cta_button(label: str, url: str) -> str:
    """The one button style every email's call-to-action already used,
    identically, before this existed."""
    return (
        f'<p style="margin: 32px 0;"><a href="{url}" style="display: inline-block; background: #A0291C; color: #fff; '
        'text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; '
        f'padding: 14px 28px;">{label}</a></p>'
    )


def email_shell(
    headline_html: str,
    body_html: str,
    *,
    signoff: bool = True,
    compliance_footer: bool = False,
) -> str:
    """headline_html is whatever goes inside the <h1> (an <em>-wrapped
    word or two is the established house style, e.g. "has <em>lapsed</em>.").
    body_html is everything from the greeting (if any) through the last
    paragraph before the sign-off -- callers own their own <p> tags and
    their own CTA button via email_cta_button() above."""
    return (
        f'<div style="font-family: {_FONT_BODY}; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        f'{_LOGO_HTML}'
        f'<h1 style="font-family: {_FONT_HEADLINE}; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">{headline_html}</h1>'
        f'{body_html}'
        f'{_SIGNOFF_HTML if signoff else ""}'
        f'{_COMPLIANCE_FOOTER_HTML if compliance_footer else ""}'
        '</div>'
    )
