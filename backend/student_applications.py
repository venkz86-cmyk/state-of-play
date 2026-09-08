"""
student_applications.py — Student plan review queue (Sept 2026).

The Student plan (/students) needs Venkat to eyeball a photo of each
applicant's student ID before they can pay -- deliberately manual, the
whole point of the plan (see StudentsMockup.js's own copy: "checked by
hand, not by email domain"). What wasn't automated before this module:
noticing a new application arrived at all (Venkat would have to
remember to check Tally), and sending the right payment link afterward
(a hand-typed email). Neither of those needs a human -- only the actual
ID judgment does.

Flow:
  1. POST /api/students/apply-webhook -- Tally's own webhook, fired on
     every new form submission (configure this URL directly in the
     form's Integrations -> Webhooks settings, no Zapier needed).
     Parses the applicant's name/email/college/ID-photo out of Tally's
     field array by matching each field's LABEL text, not a hardcoded
     key/order, since the exact question wording/order in Venkat's
     live form isn't something this code can see ahead of time. Stores
     the application as 'pending'. No Slack ping from this module --
     Venkat's Tally form already posts to Slack via Tally's own native
     Slack integration, so a second ping here would just duplicate
     that notification for the same event.
  2. GET /api/admin/student-applications -- admin-only, the review
     queue AdminDashboard.js's Students panel lists.
  3. POST /api/admin/student-applications/{id}/approve -- admin-only,
     {country: 'IN'|'INTL'}. Mints a one-time payment_token, emails the
     applicant a link to /students/pay?token=... on our own site (not
     a raw rzp.io Payment Link), marks the application approved.
  4. GET /api/students/pay-info/{token} -- public, no admin gate. The
     new /students/pay page calls this on load to check the token is
     real and still approved, and to get back the email/country/plan
     it needs to render RazorpayCheckoutButton already locked to the
     right person and price -- the applicant never picks anything,
     Venkat already decided both when he approved.
  5. POST /api/students/pay-info/{token}/mark-paid -- public. Called
     from RazorpayCheckoutButton's onSuccess, purely so the admin
     queue can stop showing a converted applicant under "approved"
     forever. Cosmetic bookkeeping only -- the actual access grant
     happens inside razorpay_orders.py's verify-payment (the same
     Ghost-labeling path every other on-site checkout already uses),
     completely independent of this call.
  6. POST /api/admin/student-applications/{id}/reject -- admin-only.
     No automatic email -- a rejection is worth Venkat's own words,
     not a form letter; he follows up by hand if he wants to.

What this does NOT do: verify the ID itself. That's still entirely
Venkat looking at the photo before clicking Approve.

Dependencies: RESEND_API_KEY (via resend_email.py, existing).
TALLY_SIGNING_SECRET (optional, new)
verifies Tally's webhook signature if set; left unset just skips
verification and still processes the payload -- same fail-open shape
as server.py's own Razorpay webhook signature check, and the stakes
here are lower: a spoofed call only creates a review-queue row, never
grants access or charges anyone by itself.
"""
from __future__ import annotations

import os
import re
import uuid
import html
import hmac
import hashlib
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from admin_auth import require_admin_key_or_session
from resend_email import send_email

logger = logging.getLogger(__name__)

router = APIRouter()

_db = None

TALLY_SIGNING_SECRET = os.environ.get('TALLY_SIGNING_SECRET', '')

# Matches nominations.py's own constant -- the frontend's own public URL,
# for a link that has to work from inside an email, not a relative path.
PUBLIC_BASE_URL = 'https://www.stateofplay.club'


def init(db_handle):
    global _db
    _db = db_handle


async def _ensure_indexes():
    if _db is None:
        return
    try:
        await _db.student_applications.create_index('tally_response_id', unique=True)
        await _db.student_applications.create_index('application_id', unique=True)
        await _db.student_applications.create_index('payment_token', unique=True, sparse=True)
        await _db.student_applications.create_index('status')
        await _db.student_applications.create_index('created_at')
    except Exception as e:
        logger.warning(f'student_applications index ensure failed (non-fatal): {e!r}')


def _field_value(field: dict):
    return field.get('value')


def _extract_application_fields(fields: list) -> dict:
    """Tally sends a flat list of {key, label, type, value} -- matches by
    label text rather than a hardcoded key, so this keeps working if
    Venkat reorders or rewords a question later. Leaves anything it
    can't confidently match as '' rather than guessing wrong; the full
    raw_fields list (stored alongside) is the fallback an admin can
    read directly if this misses something."""
    name = email = college = id_photo_url = id_photo_name = ''
    for f in fields or []:
        label = (f.get('label') or '').strip().lower()
        ftype = (f.get('type') or '').strip().upper()
        value = _field_value(f)

        if ftype in ('FILE_UPLOAD', 'IMAGE_UPLOAD'):
            if isinstance(value, list) and value and isinstance(value[0], dict):
                id_photo_url = value[0].get('url') or ''
                id_photo_name = value[0].get('name') or ''
            continue
        if not isinstance(value, str):
            continue
        if not email and (ftype == 'INPUT_EMAIL' or 'email' in label):
            email = value.strip().lower()
        elif not college and re.search(r'college|institution|university|school', label):
            college = value.strip()
        elif not name and re.search(r'name', label):
            name = value.strip()
    return {
        'name': name, 'email': email, 'college': college,
        'id_photo_url': id_photo_url, 'id_photo_name': id_photo_name,
    }


def _verify_tally_signature(raw_body: bytes, signature_header: str) -> bool:
    if not TALLY_SIGNING_SECRET:
        return True
    if not signature_header:
        return False
    expected = base64.b64encode(
        hmac.new(TALLY_SIGNING_SECRET.encode('utf-8'), raw_body, hashlib.sha256).digest()
    ).decode('utf-8')
    return hmac.compare_digest(expected, signature_header)


def _serialize(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k != '_id'}
    for key in ('created_at', 'decided_at'):
        dt = out.get(key)
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            out[key] = dt.isoformat()
    return out


@router.post('/api/students/apply-webhook')
async def student_apply_webhook(request: Request):
    raw_body = await request.body()
    if not _verify_tally_signature(raw_body, request.headers.get('Tally-Signature', '')):
        logger.warning('student_apply_webhook: signature verification failed')
        raise HTTPException(status_code=401, detail='Invalid signature')

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid JSON')

    data = payload.get('data') or {}
    response_id = data.get('responseId') or data.get('submissionId') or payload.get('eventId')
    if not response_id:
        logger.warning('student_apply_webhook: no response id in payload, dropping')
        return {'received': True}

    extracted = _extract_application_fields(data.get('fields') or [])

    if _db is None:
        return {'received': True}
    await _ensure_indexes()

    doc = {
        'application_id': str(uuid.uuid4()),
        'tally_response_id': response_id,
        'form_name': data.get('formName') or '',
        **extracted,
        'raw_fields': [
            {'label': f.get('label'), 'value': _field_value(f)}
            for f in (data.get('fields') or [])
        ],
        'status': 'pending',
        'created_at': datetime.now(timezone.utc),
    }
    await _db.student_applications.update_one(
        {'tally_response_id': response_id},
        {'$setOnInsert': doc},
        upsert=True,
    )
    return {'received': True}


@router.get('/api/admin/student-applications')
async def list_student_applications(
    status_filter: str = 'pending',
    _admin: None = Depends(require_admin_key_or_session),
):
    if _db is None:
        return {'applications': []}
    query = {} if status_filter == 'all' else {'status': status_filter}
    cursor = _db.student_applications.find(query).sort('created_at', -1)
    docs = await cursor.to_list(length=500)
    return {'applications': [_serialize(d) for d in docs]}


class DecisionRequest(BaseModel):
    country: Optional[str] = None  # 'IN' | 'INTL' -- required for approve


def _payment_link_email_html(name: str, pay_url: str) -> str:
    first_name = (name or '').split(' ')[0] or 'there'
    return (
        '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">'
        '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">'
        '— The State of Play —'
        '</p>'
        '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 26px; line-height: 1.25; margin: 0 0 24px;">'
        f'{html.escape(first_name)}, you’re <em style="font-style: italic;">approved.</em>'
        '</h1>'
        '<p>Your student ID checked out. Complete your membership below to start reading.</p>'
        f'<p style="margin: 32px 0;"><a href="{pay_url}" style="display: inline-block; background: #A0291C; color: #fff; text-decoration: none; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; padding: 14px 28px;">Complete your membership &rarr;</a></p>'
        '<p style="color: #555555;">Once you’ve paid, you’re in immediately — every weekly story, the Left Field briefing, and the full archive.</p>'
        '<p style="margin-top: 32px;">Venkat<br>'
        '<span style="font-size: 13px; color: #666666;">Editor, The State of Play</span>'
        '</p>'
        '</div>'
    )


@router.post('/api/admin/student-applications/{application_id}/approve')
async def approve_student_application(
    application_id: str,
    req: DecisionRequest,
    _admin: None = Depends(require_admin_key_or_session),
):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    if req.country not in ('IN', 'INTL'):
        raise HTTPException(status_code=400, detail="country must be 'IN' or 'INTL'")

    application = await _db.student_applications.find_one({'application_id': application_id})
    if not application:
        raise HTTPException(status_code=404, detail='Application not found')
    if not application.get('email'):
        raise HTTPException(
            status_code=422,
            detail='This application has no email on file -- check raw_fields and reach out manually.',
        )

    payment_token = str(uuid.uuid4())
    pay_url = f'{PUBLIC_BASE_URL}/students/pay?token={payment_token}'
    sent = await send_email(
        to=application['email'],
        subject='You’re approved — complete your Student membership',
        html=_payment_link_email_html(application.get('name', ''), pay_url),
    )
    if not sent:
        raise HTTPException(
            status_code=502,
            detail='Approved, but the email failed to send -- check Render logs / Resend, then send the link by hand.',
        )

    now = datetime.now(timezone.utc)
    await _db.student_applications.update_one(
        {'application_id': application_id},
        {'$set': {
            'status': 'approved', 'decided_at': now,
            'decided_country': req.country, 'payment_token': payment_token,
        }},
    )
    updated = await _db.student_applications.find_one({'application_id': application_id})
    return _serialize(updated)


@router.get('/api/students/pay-info/{token}')
async def student_pay_info(token: str):
    """Public, unauthenticated -- the /students/pay page's own load call.
    Deliberately returns only what that page needs to render a locked
    checkout (name/email/country), never the full application record
    (college, ID photo, raw form answers stay admin-only)."""
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')
    application = await _db.student_applications.find_one({'payment_token': token})
    if not application or application.get('status') not in ('approved', 'paid'):
        raise HTTPException(status_code=404, detail='This link is invalid or has expired.')
    return {
        'name': application.get('name') or '',
        'email': application.get('email') or '',
        'country': application.get('decided_country') or 'IN',
        'already_paid': application.get('status') == 'paid',
    }


@router.post('/api/students/pay-info/{token}/mark-paid')
async def student_mark_paid(token: str):
    """Public, unauthenticated -- called from RazorpayCheckoutButton's
    onSuccess. Purely queue hygiene (moves a converted applicant out of
    the admin panel's "approved" filter); grants nothing itself. The
    real access grant already happened inside razorpay_orders.py's
    verify-payment, via the same Ghost-labeling every other on-site
    checkout uses -- this call succeeding or failing changes nothing
    about whether that member actually has access."""
    if _db is None:
        return {'ok': False}
    await _db.student_applications.update_one(
        {'payment_token': token, 'status': 'approved'},
        {'$set': {'status': 'paid', 'paid_at': datetime.now(timezone.utc)}},
    )
    return {'ok': True}


@router.post('/api/admin/student-applications/{application_id}/reject')
async def reject_student_application(
    application_id: str,
    _admin: None = Depends(require_admin_key_or_session),
):
    if _db is None:
        raise HTTPException(status_code=503, detail='Not configured')

    result = await _db.student_applications.update_one(
        {'application_id': application_id},
        {'$set': {'status': 'rejected', 'decided_at': datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Application not found')
    updated = await _db.student_applications.find_one({'application_id': application_id})
    return _serialize(updated)
