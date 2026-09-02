"""
resend_email.py — a small, reusable transactional-email sender via Resend.

Replaces Apps Script/MailApp for anything new that needs reliable, visible
delivery (the gift subscription flow's one-time code and receipts; a
candidate to move nominations' emails onto later, not done here). Apps
Script stays exactly as it is for corporate subscriptions' Sheets/Slack/
Gmail-draft machinery — that's real application logic, not just email
sending, and out of scope for this module.

Resend's own API is a single POST, no SDK needed — one httpx call.

Provides:
  * send_email(to, subject, html, text=None, from_address=None) -> bool

Dependencies: RESEND_API_KEY. FROM_EMAIL (optional, defaults to a sane
address on the verified stateofplay.club domain).
"""
from __future__ import annotations

import os
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
DEFAULT_FROM_EMAIL = os.environ.get('RESEND_FROM_EMAIL', 'The State of Play <hello@stateofplay.club>')
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

RESEND_API_URL = 'https://api.resend.com/emails'

router = APIRouter()


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    from_address: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """Fire-and-forget-friendly: returns True/False, never raises, so a
    caller can log and move on rather than fail the whole request over a
    delivery hiccup. Logs the actual Resend response on failure — unlike
    Apps Script's MailApp, this gives a real reason when something's wrong."""
    if not RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not set, cannot send email')
        return False

    payload = {
        'from': from_address or DEFAULT_FROM_EMAIL,
        'to': [to],
        'subject': subject,
        'html': html,
    }
    if text:
        payload['text'] = text
    if reply_to:
        payload['reply_to'] = reply_to

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={'Authorization': f'Bearer {RESEND_API_KEY}'},
                json=payload,
            )
        if resp.status_code >= 400:
            logger.warning(f'Resend send failed: {resp.status_code} {resp.text[:400]!r}')
            return False
        data = resp.json()
        logger.info(f'Resend email sent to {to}: id={data.get("id")}')
        return True
    except Exception as e:
        logger.warning(f'Resend send error: {e!r}')
        return False


class TestSendRequest(BaseModel):
    to: EmailStr


@router.post('/api/admin/test-email')
async def test_email(
    req: TestSendRequest,
    x_admin_key: Optional[str] = Header(None, alias='X-Admin-Key'),
):
    """Temporary, admin-gated: fires one real send through Resend so
    delivery can be confirmed against the real deployed backend (checking
    both the inbox and Resend's own dashboard logs) before anything real
    is built on top of this module. Remove once the gift flow's own
    emails are live and have been verified once."""
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail='Admin key not configured on server')
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail='Invalid admin key')

    ok = await send_email(
        to=req.to,
        subject='Resend test — backend integration',
        html='<p>This is a live test send from the backend, confirming Resend delivery works end to end before anything real depends on it.</p>',
    )
    if not ok:
        raise HTTPException(status_code=502, detail='Send failed — check Render logs for the Resend response')
    return {'sent': True}
