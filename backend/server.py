from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import asyncio
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt

from tiers import resolve_tier, is_genuinely_paid, ensure_member_labeled, PLAN_LABELS, find_ghost_member, AMOUNT_TO_PLAN
from payments import get_last_membership_payment_for_email, compute_synthetic_expiry, has_paid_beyond_trial, complimentary_grant_for

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB is optional - only initialize if URL is provided
mongo_url = os.environ.get('MONGO_URL', '')
client = None
db = None
if mongo_url and 'placeholder' not in mongo_url:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'stateofplay')]
    except Exception as e:
        logging.warning(f"MongoDB connection failed: {e}")

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

# In-memory store for recent payments (email -> timestamp)
# In production, you'd use Redis or MongoDB
recent_payments = {}
PAYMENT_VALID_MINUTES = 30  # Payment verification valid for 30 minutes

# Razorpay is optional
razorpay_client = None
try:
    import razorpay
    if os.environ.get('RAZORPAY_KEY_ID') and os.environ.get('RAZORPAY_KEY_SECRET'):
        razorpay_client = razorpay.Client(auth=(os.environ.get('RAZORPAY_KEY_ID'), os.environ.get('RAZORPAY_KEY_SECRET')))
except Exception as e:
    logging.warning(f"Razorpay initialization failed: {e}")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Set up logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Subscription model kept for the Razorpay webhook handler which writes to
# db.subscriptions. All legacy JWT/auth/article/payment-order routes were
# removed in Session 4 — the live site uses Ghost magic-link auth, Razorpay
# payment links, and the Ghost Content/Admin APIs for content.

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    status: str
    amount: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subscription_end_date: Optional[datetime] = None

@api_router.get("/substack/feed")
async def get_substack_feed():
    """The Left Field's latest editions, from the copy left_field_notes keeps."""
    from left_field_notes import website_feed
    try:
        return await website_feed()
    except Exception as e:
        logger.error(f"Substack feed error: {e}")
        return []

@api_router.get("/geo/location")
async def get_geo_location(request: Request):
    """Proxy endpoint to get user's geolocation based on IP"""
    import httpx
    
    # Get client IP from headers (may be forwarded through proxy)
    client_ip = request.headers.get('x-forwarded-for', request.client.host if request.client else None)
    if client_ip:
        client_ip = client_ip.split(',')[0].strip()
    
    try:
        async with httpx.AsyncClient() as http_client:
            # Use ip-api.com for geolocation (free, no API key required)
            if client_ip and client_ip not in ['127.0.0.1', 'localhost', '::1']:
                response = await http_client.get(f'http://ip-api.com/json/{client_ip}')
            else:
                response = await http_client.get('http://ip-api.com/json/')
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "country_code": data.get('countryCode', 'US'),
                    "country": data.get('country', 'Unknown'),
                    "city": data.get('city', ''),
                    "status": "success"
                }
            else:
                return {"country_code": "US", "status": "fallback"}
    except Exception as e:
        logger.error(f"Geo location error: {e}")
        return {"country_code": "US", "status": "error"}

# Ghost API proxy endpoints
GHOST_URL = os.environ.get('GHOST_URL', 'https://the-state-of-play.ghost.io')
GHOST_ADMIN_API_KEY = os.environ.get('GHOST_ADMIN_API_KEY', '')
GHOST_CONTENT_API_KEY = os.environ.get('GHOST_CONTENT_API_KEY', '')
SLACK_WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL', '')


async def _slack_post(text: str) -> None:
    """Fire-and-forget Slack webhook ping — same pattern nominations.py uses."""
    if not SLACK_WEBHOOK_URL:
        return
    import httpx
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(SLACK_WEBHOOK_URL, json={'text': text})
    except Exception as e:
        logger.warning(f'Slack ping failed: {e!r}')

def create_ghost_admin_token():
    """Create JWT token for Ghost Admin API authentication"""
    if not GHOST_ADMIN_API_KEY:
        return None
    
    # Ghost Admin API key format: {id}:{secret}
    try:
        key_id, secret = GHOST_ADMIN_API_KEY.split(':')
    except ValueError:
        logger.error("Invalid GHOST_ADMIN_API_KEY format. Expected 'id:secret'")
        return None
    
    # Create JWT token
    iat = int(datetime.now(timezone.utc).timestamp())
    header = {'alg': 'HS256', 'typ': 'JWT', 'kid': key_id}
    payload = {
        'iat': iat,
        'exp': iat + 5 * 60,  # 5 minutes
        'aud': '/admin/'
    }
    
    # Decode the secret from hex
    import binascii
    secret_bytes = binascii.unhexlify(secret)
    
    token = jwt.encode(payload, secret_bytes, algorithm='HS256', headers=header)
    return token

class MemberVerifyRequest(BaseModel):
    # Ignored: the email always comes from the signed-in session (see
    # _require_session_email). Kept optional so older clients still parse.
    email: Optional[str] = ''


def _require_session_email(http_request: Request) -> str:
    """The signed-in reader's email, proven by their session token.

    Endpoints that unlock paid content or return member details must take
    identity from here, never from an email in the request body: nothing
    proves the person sending a typed email owns it, so trusting one let
    anyone read the paid archive, or look up any member, by sending a
    subscriber's address."""
    from session_auth import _read_session
    session = _read_session(http_request)
    if not session or not session.get('email'):
        raise HTTPException(status_code=401, detail='Sign in to continue.')
    return session['email'].lower().strip()


class MemberDetailsResponse(BaseModel):
    is_member: bool
    is_paid: bool
    email: str
    name: Optional[str] = None
    status: str
    created_at: Optional[str] = None
    subscription_start: Optional[str] = None
    subscription_end: Optional[str] = None
    subscription_status: Optional[str] = None
    avatar_image: Optional[str] = None
    # Kept for response shape; always None. Ghost's member note is for
    # the admin, never sent to the member's own page.
    note: Optional[str] = None
    tier: str = 'free'
    # The member's most recent real payment, for the account page's
    # Billing line. Amount in the smallest unit (paise / cents).
    last_payment_amount: Optional[int] = None
    last_payment_currency: Optional[str] = None
    last_payment_date: Optional[str] = None
    # Whether this member can renew at the renewal rate right now, by the
    # same rule checkout uses (razorpay_orders.renewal_eligibility).
    can_renew: bool = False

@api_router.post("/ghost/member-details", response_model=MemberDetailsResponse)
async def get_member_details(request: MemberVerifyRequest, http_request: Request):
    """Get detailed member info including subscription dates.

    Paid status hierarchy (canonical):
      1. Ghost `paid-via-razorpay` label  → real Razorpay subscriber
      2. Other paid/premium labels       → comped or grandfathered
      3. Ghost native subscription       → Stripe-billed (rare)
      4. Ghost status == 'paid'|'comped' → manual admin grant
    """
    import httpx

    request.email = _require_session_email(http_request)

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")

    token = create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail="Failed to create admin token")

    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f'{GHOST_URL}/ghost/api/admin/members/',
                params={
                    'filter': f'email:{request.email}',
                    'include': 'subscriptions,labels',
                },
                headers={'Authorization': f'Ghost {token}'}
            )

            if response.status_code == 200:
                data = response.json()
                members = data.get('members', [])

                if members:
                    member = members[0]
                    status = member.get('status', 'free')

                    # 1. Label check — the canonical "real Razorpay subscriber" signal
                    labels = member.get('labels', []) or []
                    label_names = [(lbl.get('name') or '').lower() for lbl in labels]
                    has_razorpay_label = 'paid-via-razorpay' in label_names
                    # A Trial ("The Ten") member should never look like a
                    # real paid/comped subscriber here, even if the
                    # still-live "Razorpay Payment Capture" Zap has left a
                    # stray Ghost-native Subscription object (a $0/yearly
                    # "Complimentary" grant) on this member from their ₹590
                    # trial payment -- that object's mere existence is not
                    # this backend's decision and doesn't belong driving
                    # what a Trial reader's own account page shows.
                    is_trial_member = 'tier-trial' in label_names
                    native_subscriptions = member.get('subscriptions', []) or []

                    # Single source of truth (tiers.is_genuinely_paid) --
                    # excludes a Trial member's stray paid label/status/
                    # subscription unless a real, separate non-Trial
                    # payment is on file for them.
                    is_paid = await is_genuinely_paid(
                        label_names, status, member.get('email') or request.email,
                        has_native_subscription=len(native_subscriptions) > 0,
                    )

                    # 2. Ghost-native subscriptions — zeroed for a Trial
                    # member so the date/status branches below (display
                    # only) never read a stray comp subscription either.
                    subscriptions = [] if is_trial_member else native_subscriptions
                    # A Razorpay member Venkat has comped in Ghost (to keep
                    # Ghost's free/paid lists right) carries a $0
                    # "Complimentary" subscription too. Their real year
                    # comes from the Razorpay payment, so read the ledger
                    # for them, not the comp -- otherwise the account page
                    # says "Renews" with a next charge, and never offers
                    # the one-payment renewal.
                    member_email = member.get('email') or request.email
                    comped_razorpay_member = status == 'comped' and not is_trial_member and (
                        has_razorpay_label or await has_paid_beyond_trial(member_email)
                    )
                    if comped_razorpay_member:
                        subscriptions = []
                    # Those comps are set to run out a year after the
                    # first payment. Once one does, Ghost shows the member
                    # as free but still lists the old comp and its date,
                    # which hid a renewal: the first members' comps ended
                    # October 7, 2026, the day several renewed, and their
                    # account pages said "lapsed" (Saumil Majmudar, October
                    # 13). So for a Razorpay member a Ghost date only wins
                    # when it's later than their payment's, as on the
                    # admin dashboard (admin_dashboard._build_subscriber_rows).
                    elif subscriptions and not is_trial_member and (
                        has_razorpay_label or await has_paid_beyond_trial(member_email)
                    ):
                        from admin_dashboard import _ghost_subscription_end
                        ledger_payment = await get_last_membership_payment_for_email(member_email)
                        if ledger_payment and not ledger_payment.get('subscription_id'):
                            payment_end_iso = compute_synthetic_expiry(ledger_payment)
                            payment_end = (
                                datetime.fromisoformat(payment_end_iso.replace('Z', '+00:00'))
                                if payment_end_iso else None
                            )
                            if payment_end is not None and payment_end.tzinfo is None:
                                payment_end = payment_end.replace(tzinfo=timezone.utc)
                            ghost_end = _ghost_subscription_end(subscriptions)
                            if payment_end and (not ghost_end or payment_end >= ghost_end):
                                subscriptions = []
                    # A complimentary year (complimentary.py) shows as
                    # that, with its own end date, instead of Ghost's comp
                    # (which would read as "Renews" with a next charge).
                    grant = await complimentary_grant_for(member_email)
                    complimentary_now = bool(grant) and 'complimentary' in label_names and not has_razorpay_label
                    if complimentary_now:
                        subscriptions = []

                    # Resolve dates with the right source:
                    subscription_start = None
                    subscription_end = None
                    subscription_status = None
                    last_payment = None

                    if is_trial_member:
                        # Deliberately left None -- AccountMockup.js's own
                        # "Time left" stat already comes from
                        # /api/trial/status (TheTenPanel.jsx), the real
                        # source of truth for a Trial member's dates.
                        # Anything computed here (a stray Zap-created
                        # comp subscription, or has_razorpay_label's
                        # 365-day synthetic-expiry math, which has no
                        # notion of Trial's 30-day cycle at all) would
                        # only ever be wrong for this tier.
                        pass
                    elif complimentary_now:
                        # 'complimentary_short' (a month to six months)
                        # ends with the new-reader price, not the renewal.
                        subscription_status = 'complimentary' if (grant.get('months') or 12) == 12 else 'complimentary_short'
                        granted_at, ends_at = grant.get('granted_at'), grant.get('ends_at')
                        subscription_start = _utc_iso(granted_at)
                        subscription_end = _utc_iso(ends_at)
                    elif subscriptions:
                        sub = subscriptions[0]
                        subscription_start = sub.get('start_date') or sub.get('created_at')
                        subscription_end = sub.get('current_period_end')
                        subscription_status = sub.get('status', 'active')
                    elif has_razorpay_label or comped_razorpay_member:
                        # Razorpay subscriber: derive the cycle from their actual
                        # last real payment (not member.created_at -- the Ghost
                        # signup date can predate a real payment, e.g. a free
                        # reader who paid later), via the same
                        # compute_synthetic_expiry() admin_dashboard.py uses, so
                        # this account page and the admin dashboard can't disagree
                        # on a member's renewal date -- including the thirteen-
                        # months-for-twelve trial-upgrade bonus, which a plain
                        # created_at + 365 days had no way to know about.
                        last_payment = await get_last_membership_payment_for_email(member.get('email') or request.email)
                        # A real recurring Subscription payment (razorpay_
                        # subscriptions.py's verify_subscription) carries a
                        # subscription_id Razorpay itself attaches -- a plain
                        # one-time Order payment never does. That's the only
                        # reliable way to tell "already auto-renewing" from
                        # "paid once, needs to renew manually" apart; every
                        # Razorpay-labeled member used to get 'active' here
                        # unconditionally, which silently claimed everyone
                        # auto-renews even before any real Subscription flow
                        # existed.
                        subscription_status = 'active' if (last_payment and last_payment.get('subscription_id')) else 'one_time'
                        if last_payment:
                            subscription_start = last_payment.get('razorpay_created_at')
                            subscription_end = compute_synthetic_expiry(last_payment)
                        else:
                            # No payment record on file for a labeled member --
                            # shouldn't happen, but falls back to the signup-date
                            # estimate rather than showing a blank expiry.
                            created_at = member.get('created_at')
                            subscription_start = created_at
                            if created_at:
                                try:
                                    start_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                                    subscription_end = (start_dt + timedelta(days=365)).isoformat().replace('+00:00', 'Z')
                                except Exception as e:
                                    logger.warning(
                                        f"Razorpay subscription_end fallback parse failed: "
                                        f"email={request.email} created_at={created_at!r} err={e!r}"
                                    )
                                    subscription_end = None
                    elif 'nomination-access' in label_names:
                        # Real, time-boxed access from being nominated by a
                        # subscriber (nominations.py) -- neither a Ghost-native
                        # subscription nor a Razorpay label, so it hit none of
                        # the branches above and the account page showed a
                        # blank expiry. `db` is the same Mongo handle
                        # nominations_init(db) already wires up elsewhere in
                        # this file -- no import from nominations.py needed.
                        nomination_doc = None
                        if db is not None:
                            nomination_doc = await db.nomination_access.find_one(
                                {'nominee_email': (member.get('email') or request.email).lower().strip()}
                            )
                        subscription_status = 'nomination'
                        if nomination_doc:
                            started_at = nomination_doc.get('started_at')
                            expires_at = nomination_doc.get('expires_at')
                            subscription_start = started_at.isoformat() if started_at else member.get('created_at')
                            subscription_end = expires_at.isoformat() if expires_at else None
                        else:
                            subscription_start = member.get('created_at')
                    elif status == 'comped':
                        subscription_start = member.get('created_at')
                        subscription_status = 'comped'
                    elif not is_paid and await has_paid_beyond_trial(member.get('email') or request.email):
                        # A former annual member whose year (and grace
                        # week) has passed, so their paid labels are gone.
                        # 'lapsed' lets the account page offer the renewal
                        # rate (razorpay_orders' 'renewal' plan) instead
                        # of sending them to the new-signup price.
                        last_payment = await get_last_membership_payment_for_email(member.get('email') or request.email)
                        if last_payment and not last_payment.get('subscription_id'):
                            subscription_status = 'lapsed'
                            subscription_end = compute_synthetic_expiry(last_payment)
                    elif not is_paid and grant and grant.get('ends_at') and (grant.get('months') or 12) == 12:
                        # A complimentary year that has ended: the account
                        # page offers the renewal rate, as for a former
                        # paying member.
                        ends_at = grant['ends_at']
                        subscription_status = 'lapsed'
                        subscription_end = _utc_iso(ends_at)

                    # Surface the canonical paid status to the client
                    canonical_status = 'paid' if has_razorpay_label else status

                    tier = resolve_tier(label_names, is_paid)
                    try:
                        from razorpay_orders import renewal_eligibility
                        can_renew, _ = await renewal_eligibility(
                            {'email': member_email, 'tier': tier, 'label_names': label_names}
                        )
                    except Exception as e:
                        logger.warning(f'member-details: renewal check failed for {member_email}: {e!r}')
                        can_renew = False

                    return MemberDetailsResponse(
                        is_member=True,
                        is_paid=is_paid,
                        email=member.get('email', request.email),
                        name=member.get('name'),
                        status=canonical_status,
                        created_at=member.get('created_at'),
                        subscription_start=subscription_start,
                        subscription_end=subscription_end,
                        subscription_status=subscription_status,
                        avatar_image=member.get('avatar_image'),
                        tier=tier,
                        can_renew=can_renew,
                        last_payment_amount=(last_payment or {}).get('amount'),
                        last_payment_currency=(last_payment or {}).get('currency'),
                        last_payment_date=(last_payment or {}).get('razorpay_created_at'),
                    )
                else:
                    return MemberDetailsResponse(
                        is_member=False,
                        is_paid=False,
                        email=request.email,
                        status='not_found'
                    )
    except Exception as e:
        logger.error(f"Ghost member details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _utc_iso(value):
    """Mongo hands datetimes back without a timezone; they're UTC."""
    if not hasattr(value, 'isoformat'):
        return value
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


class ArticleContentRequest(BaseModel):
    slug: str
    # Ignored: identity comes from the signed-in session.
    email: Optional[str] = ''

class ArticleContentResponse(BaseModel):
    slug: str
    html: str
    title: str
    feature_image: Optional[str] = None

# In-memory rate limiter for the article-content endpoint.
# Keyed by lower-cased email + client IP. A burst of 12 requests is allowed,
# replenished at 1 token / 4s. A leaked subscriber email can therefore fetch
# at most ~900 articles/hour from a single IP, slow enough that bulk-scraping
# the archive is impractical. The old 6-burst, 1-per-10s limit could catch a
# real reader moving from story to story in the app (Up next), who then got
# a cut-off story with no explanation.
from collections import defaultdict
_ARTICLE_BUCKET: dict = defaultdict(lambda: {'tokens': 12.0, 'last': 0.0})
_ARTICLE_BUCKET_BURST = 12.0
_ARTICLE_BUCKET_REFILL_PER_SEC = 0.25  # 1 token / 4s

# Full stories fetched in the last minute, by slug, so a story opened again
# (or by many readers at once, when a notification goes out) doesn't wait on
# Ghost each time. Access is still checked on every request.
_ARTICLE_CACHE: dict = {}
_ARTICLE_CACHE_SECONDS = 60

def _check_article_rate_limit(key: str) -> bool:
    """Token-bucket. Returns True if the request is allowed."""
    import time as _t
    now = _t.monotonic()
    bucket = _ARTICLE_BUCKET[key]
    elapsed = now - bucket['last']
    bucket['tokens'] = min(
        _ARTICLE_BUCKET_BURST,
        bucket['tokens'] + elapsed * _ARTICLE_BUCKET_REFILL_PER_SEC,
    )
    bucket['last'] = now
    if bucket['tokens'] >= 1.0:
        bucket['tokens'] -= 1.0
        return True
    return False

@api_router.post("/ghost/article-content", response_model=ArticleContentResponse)
async def get_full_article_content(request: ArticleContentRequest, http_request: Request):
    """Get full article content for a verified member using Admin API --
    a paid member for 'paid'-visibility posts, or any signed-up member
    (free or paid) for 'members'-visibility posts, plus the existing
    Trial ("The Ten") carve-out for eligible trial readers.

    The email is the signed-in session's, never the request body's (see
    _require_session_email). Still rate-limited per (email, ip).
    """
    import httpx

    request.email = _require_session_email(http_request)

    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")

    # Rate-limit: 6-burst, 1 token / 10s sustained, per (email, ip).
    client_ip = (
        http_request.headers.get('x-forwarded-for', '').split(',')[0].strip()
        or (http_request.client.host if http_request.client else '0.0.0.0')
    )
    bucket_key = f"{(request.email or '').lower()}|{client_ip}"
    if not _check_article_rate_limit(bucket_key):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please slow down.",
        )

    token = create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail="Failed to create admin token")
    
    try:
        async with httpx.AsyncClient() as http_client:
            # The member lookup and the story fetch go to Ghost side by
            # side; the story is only returned after the access checks below.
            import time as _time
            cached = _ARTICLE_CACHE.get(request.slug)
            fresh = cached and _time.monotonic() - cached[0] < _ARTICLE_CACHE_SECONDS

            async def _fetch_article():
                if fresh:
                    return None
                return await http_client.get(
                    f'{GHOST_URL}/ghost/api/admin/posts/slug/{request.slug}/',
                    params={'formats': 'html'},
                    headers={'Authorization': f'Ghost {token}'}
                )

            member_response, article_response = await asyncio.gather(
                http_client.get(
                    f'{GHOST_URL}/ghost/api/admin/members/',
                    params={'filter': f'email:{request.email}'},
                    headers={'Authorization': f'Ghost {token}'}
                ),
                _fetch_article(),
            )
            
            if member_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to verify membership")
            
            members = member_response.json().get('members', [])
            if not members:
                raise HTTPException(status_code=401, detail="Not a member")
            
            member = members[0]
            # Member is paid if: Ghost status is paid/comped, OR has a Ghost subscription,
            # OR carries a recognised paid label. Was a second, hardcoded copy of
            # tiers.PAID_LABELS here (predating its consolidation into tiers.py) --
            # meant this endpoint silently missed every label added there since
            # (tier-student, community-ftwtsop, nomination-access): the frontend
            # would show an article as unlocked while this endpoint still 403'd
            # the actual full-text fetch behind the scenes. Now calls
            # tiers.is_genuinely_paid -- the actual single source of truth
            # every paid gate in this codebase shares, which ALSO excludes a
            # Trial member's stray paid label/status/native subscription
            # (the still-live "Razorpay Payment Capture" Zap comps every
            # successful charge regardless of plan) unless a real, separate
            # non-Trial payment is on file for them. Without this, a
            # mislabeled Trial member's `is_paid` reads True here and this
            # endpoint serves every paid-visibility article in full, not
            # just their own ten-story snapshot -- the actual bug, not just
            # a display one.
            labels = [(lbl.get('name') or '').lower() for lbl in member.get('labels', []) or []]
            is_paid = await is_genuinely_paid(
                labels, member.get('status', 'free'), request.email,
                has_native_subscription=len(member.get('subscriptions', []) or []) > 0,
            )

            # Fetch the article before deciding access -- a Trial ("The
            # Ten") member's eligibility depends on this specific story's
            # published_at (was it in their signup-day snapshot, or
            # published after they joined), so the article has to be in
            # hand before that check can run. Reordered from the old
            # is_paid-first version specifically to support this.
            if fresh:
                post = cached[1]
            else:
                if article_response.status_code != 200:
                    raise HTTPException(status_code=404, detail="Article not found")
                posts = article_response.json().get('posts', [])
                if not posts:
                    raise HTTPException(status_code=404, detail="Article not found")
                post = posts[0]
                _ARTICLE_CACHE[request.slug] = (_time.monotonic(), post)
                if len(_ARTICLE_CACHE) > 200:
                    _ARTICLE_CACHE.pop(next(iter(_ARTICLE_CACHE)))

            if not is_paid and post.get('visibility') != 'members':
                # 'members' visibility means any signed-up reader, free or
                # paid, may read it -- Ghost's own semantics for that tier,
                # not a new eligibility concept. A found Ghost member (the
                # lookup above already confirmed one exists) already
                # satisfies it, no further check needed. 'paid' visibility
                # still requires actual paid status, or the Trial carve-out
                # below.
                trial_allowed = False
                if 'tier-trial' in labels and is_trial_slug_accessible:
                    published_at_raw = post.get('published_at')
                    published_at = None
                    if published_at_raw:
                        try:
                            published_at = datetime.fromisoformat(published_at_raw.replace('Z', '+00:00'))
                        except ValueError:
                            published_at = None
                    trial_allowed = await is_trial_slug_accessible(request.email, request.slug, published_at)
                    if trial_allowed and record_trial_open:
                        await record_trial_open(request.email, request.slug)
                if not trial_allowed:
                    raise HTTPException(status_code=403, detail="Paid membership required")

            return ArticleContentResponse(
                slug=post.get('slug'),
                html=post.get('html', ''),
                title=post.get('title', ''),
                feature_image=post.get('feature_image')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching article content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ArticlePreviewRequest(BaseModel):
    slug: str

class ArticlePreviewResponse(BaseModel):
    slug: str
    html: str


def _preview_paragraphs(html: str) -> str:
    """Same floor-of-2/cap-of-6/~35%-of-length slice ArticleMockup.js's
    own previewParagraphs() computes client-side -- kept here too
    because this endpoint exists specifically for the case where the
    CLIENT never receives enough real HTML to slice from in the first
    place (see get_article_preview's docstring below)."""
    if not html:
        return ''
    paragraphs = re.findall(r'<p[\s\S]*?</p>', html, re.IGNORECASE)
    count = max(2, min(6, round(len(paragraphs) * 0.35)))
    return '\n'.join(paragraphs[:count])


@api_router.post("/ghost/article-preview", response_model=ArticlePreviewResponse)
async def get_article_preview(request: ArticlePreviewRequest, http_request: Request):
    """Public, unauthenticated preview slice for a 'members'-visibility
    story -- confirmed live (Venkat's own screenshot, Sept 16): unlike
    'paid' visibility, where Ghost's Content API hands an anonymous
    reader a generous truncated preview (what previewParagraphs() on
    the frontend already slices further), 'members' visibility can give
    back little-to-nothing to an anonymous request -- there's no
    purchase decision to entice, so Ghost doesn't bother with a teaser.
    Fetches the real post via the Admin API (always has full access,
    past whatever the Content API restricts for that visibility tier),
    computes the same kind of preview slice, and returns ONLY that
    slice -- never the full body -- so a 'members' story gets the same
    real-content teaser a 'paid' one already gets for free, without
    this becoming a way to read the whole thing without signing up.

    Rate-limited by IP only (no email -- this runs before anyone has
    identified themselves), same token-bucket shape as the full-content
    endpoint above.
    """
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")

    client_ip = (
        http_request.headers.get('x-forwarded-for', '').split(',')[0].strip()
        or (http_request.client.host if http_request.client else '0.0.0.0')
    )
    if not _check_article_rate_limit(f'preview|{client_ip}'):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    token = create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail="Failed to create admin token")

    import httpx
    try:
        async with httpx.AsyncClient() as http_client:
            r = await http_client.get(
                f'{GHOST_URL}/ghost/api/admin/posts/slug/{request.slug}/',
                params={'formats': 'html'},
                headers={'Authorization': f'Ghost {token}'},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="Article not found")
        posts = r.json().get('posts', [])
        if not posts:
            raise HTTPException(status_code=404, detail="Article not found")
        post = posts[0]

        # Only ever serves this admin-fetched preview boost for the
        # free-registration tier -- 'paid' content already gets its own
        # preview straight from Ghost's Content API; no reason (or
        # safety) to duplicate that here with admin-level access.
        if post.get('visibility') != 'members':
            raise HTTPException(status_code=403, detail="Preview not available for this content")

        return ArticlePreviewResponse(
            slug=post.get('slug'),
            html=_preview_paragraphs(post.get('html') or ''),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching article preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# Dynamic OG Image Generator for social sharing
@api_router.get("/og-image/{slug}")
async def generate_og_image(slug: str, format: str = 'link'):
    """Generate a branded OG image for social media sharing - mobile optimized with logo.
    format=story draws the same card at 1080x1920 for Instagram Stories
    (the app's share sheet hands it to the phone's share menu)."""
    story = format == "story"
    import httpx
    from fastapi.responses import Response, RedirectResponse
    from PIL import Image, ImageDraw, ImageFont, ImageEnhance
    from io import BytesIO
    
    try:
        # Fetch article from Ghost
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GHOST_URL}/ghost/api/content/posts/slug/{slug}/",
                params={'key': GHOST_CONTENT_API_KEY, 'include': 'tags,authors'}
            )
            
            if response.status_code != 200:
                raise Exception("Article not found")
            
            data = response.json()
            article = data.get('posts', [{}])[0] if data.get('posts') else None
            
            if not article:
                raise Exception("Article not found")
        
        # Extract metadata
        title = article.get('title', 'The State of Play')
        excerpt = article.get('custom_excerpt') or article.get('excerpt') or ''
        feature_image_url = article.get('feature_image')
        
        # Image dimensions (1200x630 - standard OG size; 1080x1920 for Stories)
        width, height = (1080, 1920) if story else (1200, 630)
        pad = 90 if story else 50
        
        # Fetch feature image
        bg_img = None
        if feature_image_url:
            try:
                # Ghost CDN redirects /content/images/... to storage.ghost.io —
                # must follow redirects or the feature image is silently dropped
                # and the OG card renders on the plain dark background.
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as img_client:
                    img_response = await img_client.get(feature_image_url)
                    if img_response.status_code == 200:
                        bg_img = Image.open(BytesIO(img_response.content))
                        bg_img = bg_img.convert('RGB')
                        
                        # Scale to cover
                        img_ratio = bg_img.width / bg_img.height
                        target_ratio = width / height
                        
                        if img_ratio > target_ratio:
                            new_height = height
                            new_width = int(height * img_ratio)
                        else:
                            new_width = width
                            new_height = int(width / img_ratio)
                        
                        bg_img = bg_img.resize((new_width, new_height), Image.LANCZOS)
                        
                        # Center crop
                        left = (new_width - width) // 2
                        top = (new_height - height) // 2
                        bg_img = bg_img.crop((left, top, left + width, top + height))
                        
                        # Darken for readability
                        enhancer = ImageEnhance.Brightness(bg_img)
                        bg_img = enhancer.enhance(0.4)
            except Exception as e:
                logger.error(f"Failed to fetch feature image: {e}")
        
        # Fallback to solid color
        if bg_img is None:
            bg_img = Image.new('RGB', (width, height), (20, 50, 100))
        
        img = bg_img.copy()
        
        # Add dark overlay
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 130))
        img = img.convert('RGBA')
        img = Image.alpha_composite(img, overlay)
        draw = ImageDraw.Draw(img)
        
        # Load editorial fonts (Gloock for title/masthead, Schibsted Grotesk
        # for UI). Gloock and Schibsted Grotesk are shipped in
        # /app/backend/assets/fonts; Gloock is a static font (one weight,
        # no named instances) so it needs no set_variation_by_name call.
        FONT_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")
        GLOOCK = os.path.join(FONT_DIR, "Gloock.ttf")
        SCHIBSTED = os.path.join(FONT_DIR, "SchibstedGrotesk.ttf")
        try:
            title_font = ImageFont.truetype(GLOOCK, 96 if story else 60)
            masthead_font = ImageFont.truetype(GLOOCK, 22)
        except Exception as font_err:
            logger.warning(f"Editorial fonts failed, falling back: {font_err}")
            title_font = ImageFont.load_default()
            masthead_font = ImageFont.load_default()
        
        # Colors
        white = (255, 255, 255)
        
        # --- LOGO at top left: white, so it reads on the darkened photo ---
        try:
            logo = Image.open(os.path.join(os.path.dirname(__file__), "assets", "tsop-logo-white.png")).convert('RGBA')
            logo_height = 96 if story else 56
            logo = logo.resize((int(logo_height * logo.width / logo.height), logo_height), Image.LANCZOS)
            img.paste(logo, (pad, 200 if story else 40), logo)
        except Exception as e:
            logger.error(f"OG card logo failed: {e}")

        # No tag or Premium badges: the headline and the photo carry the card.

        # --- TITLE (pixel-measured wrap so Literata lays out cleanly) ---
        max_text_width = width - 2 * pad
        words = title.split()
        title_lines = []
        current = ''
        for w in words:
            test = (current + ' ' + w).strip()
            tb = draw.textbbox((0, 0), test, font=title_font)
            if (tb[2] - tb[0]) <= max_text_width:
                current = test
            else:
                if current:
                    title_lines.append(current)
                current = w
        if current:
            title_lines.append(current)
        # Cap at 4 lines (7 on a Story), ellipsise the last if truncated
        max_lines = 7 if story else 4
        if len(title_lines) > max_lines:
            title_lines = title_lines[:max_lines]
            last = title_lines[-1].rstrip('.,;:')
            while last and (draw.textbbox((0, 0), last + '…', font=title_font)[2] > max_text_width):
                last = last[:-1].rstrip()
            title_lines[-1] = (last + '…') if last else '…'

        title_line_height = 108 if story else 70
        title_block_h = title_line_height * len(title_lines)
        # vertically center the title in the middle band of the canvas
        title_start_y = max(170, (height - title_block_h) // 2 - 20)

        for i, line in enumerate(title_lines):
            draw.text((pad, title_start_y + i * title_line_height), line, fill=white, font=title_font)

        # Convert to RGB
        img = img.convert('RGB')
        
        # Save
        img_byte_arr = BytesIO()
        img.save(img_byte_arr, format='PNG', optimize=True, quality=90)
        img_byte_arr.seek(0)
        
        return Response(
            content=img_byte_arr.getvalue(),
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": f"inline; filename={slug}-{'story' if story else 'og'}.png"
            }
        )
        
    except Exception as e:
        logger.error(f"OG image generation error for {slug}: {e}")
        # The site card, never a story's picture (this used to be an image
        # from the first version of the site).
        return RedirectResponse(url="https://www.stateofplay.club/og-default.png", status_code=302)

# OG Meta endpoint for social sharing
def _page_preview_html(meta: dict, noindex: bool = False) -> str:
    e = _escape_html
    t = meta['title'] if meta['title'] == 'The State of Play' else f"{meta['title']} | The State of Play"
    robots = '\n  <meta name="robots" content="noindex">' if noindex else ''
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(t)}</title>{robots}
  <meta name="description" content="{e(meta['description'])}">
  <link rel="canonical" href="{e(meta['url'])}">
  <meta property="og:type" content="{meta['type']}">
  <meta property="og:url" content="{e(meta['url'])}">
  <meta property="og:title" content="{e(t)}">
  <meta property="og:description" content="{e(meta['description'])}">
  <meta property="og:image" content="{e(meta['image'])}">
  <meta property="og:image:secure_url" content="{e(meta['image'])}">
  <meta property="og:site_name" content="The State of Play">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@stateofplayclub">
  <meta name="twitter:title" content="{e(t)}">
  <meta name="twitter:description" content="{e(meta['description'])}">
  <meta name="twitter:image" content="{e(meta['image'])}">
</head>
<body>
  <h1>{e(meta['title'])}</h1>
  <p>{e(meta['description'])}</p>
  <p><a href="{e(meta['url'])}">The State of Play</a></p>
</body>
</html>'''


@api_router.get("/og/{slug:path}")
async def get_og_meta(slug: str, request: Request):
    """Serve Open Graph meta tags for social-media crawlers.

    Vercel routes incoming `/{slug}` requests here when the User-Agent matches
    a known social-bot signature (see frontend/vercel.json). Humans never see
    this endpoint — they fall through to the React SPA. The endpoint therefore
    always returns OG-tag-rich HTML (never a redirect — that would loop).
    """
    import httpx
    from fastapi.responses import HTMLResponse

    def _escape(text):
        if not text:
            return ''
        return (text.replace('&', '&amp;').replace('<', '&lt;')
                    .replace('>', '&gt;').replace('"', '&quot;')
                    .replace("'", '&#039;'))

    # Pages that aren't stories (/about, /left-field/e/..., /topic/...) get
    # their own preview; Vercel's rule doesn't keep them away from here.
    import page_previews
    page = await page_previews.page_meta(slug, db)
    if page:
        return HTMLResponse(content=_page_preview_html(page), status_code=200, headers={
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
        })
    slug = slug.strip('/')

    article_url = f"https://www.stateofplay.club/{slug}"
    site_default_image = f"https://www.stateofplay.club/api/og-image/{slug}"

    # Defaults — used if the Ghost fetch fails or the slug is unknown.
    title = "The State of Play"
    description = "India's sports business publication. Reportage, analysis, and intelligence from sport's most consequential rooms."
    image = site_default_image
    published_time = ''

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{GHOST_URL}/ghost/api/content/posts/slug/{slug}/",
                params={'key': GHOST_CONTENT_API_KEY, 'include': 'authors'},
            )
            if response.status_code == 200:
                data = response.json()
                article = data.get('posts', [{}])[0] if data.get('posts') else None
                if article:
                    title = article.get('title') or title
                    description = (
                        article.get('custom_excerpt')
                        or article.get('excerpt')
                        or description
                    )
                    published_time = article.get('published_at') or ''
                    # image stays as the dynamic OG card endpoint
    except Exception as e:
        logger.error(f"OG meta fetch failed for {slug}: {e}")
        # Fall through with defaults — DO NOT redirect (would loop).

    html_body = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{_escape(title)} | The State of Play</title>
  <meta name="description" content="{_escape(description)}">
  <link rel="canonical" href="{article_url}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{article_url}">
  <meta property="og:title" content="{_escape(title)}">
  <meta property="og:description" content="{_escape(description)}">
  <meta property="og:image" content="{image}">
  <meta property="og:image:secure_url" content="{image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:site_name" content="The State of Play">
  <meta property="article:published_time" content="{published_time}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@stateofplayclub">
  <meta name="twitter:title" content="{_escape(title)}">
  <meta name="twitter:description" content="{_escape(description)}">
  <meta name="twitter:image" content="{image}">
</head>
<body>
  <h1>{_escape(title)}</h1>
  <p>{_escape(description)}</p>
  <p><a href="{article_url}">Read the full article at The State of Play</a></p>
</body>
</html>'''
    return HTMLResponse(content=html_body, status_code=200, headers={
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
    })

# Razorpay Webhook for payment success
class RazorpayWebhookPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

@api_router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """
    Handle Razorpay webhook for payment success.
    Stores the email in recent_payments for seamless login.
    """
    import hmac
    import hashlib
    import json
    
    logger.info("=== RAZORPAY WEBHOOK RECEIVED ===")
    
    try:
        # Get the webhook signature
        webhook_signature = request.headers.get('X-Razorpay-Signature', '')
        webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
        
        logger.info(f"Webhook signature present: {bool(webhook_signature)}")
        logger.info(f"Webhook secret configured: {bool(webhook_secret)}")
        
        # Get raw body for signature verification
        body = await request.body()
        body_str = body.decode('utf-8')
        
        logger.info(f"Webhook body length: {len(body_str)} bytes")
        
        # Only Razorpay can grant access through here. The URL is public, and
        # until October 2026 a request with a missing or wrong signature was
        # still processed, so a forged payment.captured could hand anyone a
        # paid membership. Every real webhook since October 1 had passed
        # this check before it was enforced.
        if not webhook_secret:
            # A config problem, not a forgery: 503 makes Razorpay retry for
            # 24 hours, so real payments arrive once the secret is back.
            logger.error("Razorpay webhook refused: RAZORPAY_WEBHOOK_SECRET is not set")
            return Response(status_code=503, content='Webhook secret not configured')
        expected_signature = hmac.new(
            webhook_secret.encode('utf-8'),
            body_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        if not webhook_signature or not hmac.compare_digest(expected_signature, webhook_signature):
            logger.warning(
                "Razorpay webhook refused: signature %s",
                'missing' if not webhook_signature else 'does not match',
            )
            return Response(status_code=401, content='Invalid signature')
        logger.info("Razorpay webhook signature verified successfully")
        
        # Parse the payload
        payload = json.loads(body_str)
        
        event = payload.get('event', '')
        logger.info(f"Razorpay webhook event type: {event}")
        
        # Handle payment success events
        if event in ['payment.captured', 'payment.authorized', 'subscription.activated', 'subscription.charged', 'payment_link.paid']:
            payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            subscription_entity = payload.get('payload', {}).get('subscription', {}).get('entity', {})
            payment_link_entity = payload.get('payload', {}).get('payment_link', {}).get('entity', {})
            
            # Try to get email from various places
            email = (
                payment_entity.get('email') or
                payment_entity.get('notes', {}).get('email') or
                subscription_entity.get('notes', {}).get('email') or
                payment_link_entity.get('notes', {}).get('email') or
                payload.get('payload', {}).get('payment', {}).get('entity', {}).get('customer', {}).get('email')
            )

            # Which plan this payment was for — read from the Payment Button's
            # configured notes (each button, e.g. standard/student/trial, can
            # carry its own static notes in the Razorpay dashboard). If no
            # note is set at all, fall back to recognizing the plan by its
            # amount — covers a Payment Link created directly in Razorpay
            # for something the site itself never offers (e.g. a community
            # discount link shared outside the website).
            plan = (
                payment_entity.get('notes', {}).get('plan') or
                subscription_entity.get('notes', {}).get('plan') or
                payment_link_entity.get('notes', {}).get('plan') or
                AMOUNT_TO_PLAN.get(payment_entity.get('amount'))
            )

            logger.info(f"Extracted email from webhook: {email} (plan: {plan or 'unspecified'})")

            if email:
                email = email.lower().strip()
                recent_payments[email] = datetime.now(timezone.utc)
                logger.info(f"Payment recorded successfully for: {email}")

                # Clean up old entries (older than 30 mins)
                cutoff = datetime.now(timezone.utc) - timedelta(minutes=PAYMENT_VALID_MINUTES)
                to_remove = [e for e, t in recent_payments.items() if t < cutoff]
                for e in to_remove:
                    del recent_payments[e]

                logger.info(f"Current recent_payments count: {len(recent_payments)}")

                # Find-or-create the Ghost member and apply the right labels.
                # This is the piece that used to live entirely in the
                # "Razorpay Payment Capture" Zap (a raw webhook -> Ghost
                # Find/Create/Update Member flow). A payment with no `plan`
                # note is one of the two original static Payment Buttons —
                # exactly what that Zap was built for — so it falls back to
                # the standard label set, matching the Zap's behavior.
                # razorpay_orders.py and razorpay_subscriptions.py's own
                # verify-payment/verify-subscription endpoints already do
                # this for payments that go through them; this covers the
                # remaining case where nothing else does.
                if GHOST_ADMIN_API_KEY:
                    try:
                        token = create_ghost_admin_token()
                        if token:
                            name = (
                                payment_entity.get('notes', {}).get('name')
                                or subscription_entity.get('notes', {}).get('name')
                                or payment_link_entity.get('notes', {}).get('name')
                                or ''
                            )
                            contact = payment_entity.get('contact') or ''
                            payment_id = payment_entity.get('id') or ''
                            amount = payment_entity.get('amount')

                            # Whether this is a brand-new member or an
                            # upgrade, checked before ensure_member_labeled
                            # touches anything — matches the Zap's own
                            # New Member / Existing User distinction, used
                            # below for both the Ghost note and the Slack
                            # message wording.
                            was_new = (await find_ghost_member(email, token)) is None

                            note = (
                                f"{'New member created' if was_new else 'Member upgraded'} from payment. "
                                f"Payment ID: {payment_id} | Contact: {contact} | Amount: {amount}"
                            )

                            # See razorpay_orders.py's verify_payment for why
                            # this checks real payment history rather than
                            # whether the Ghost member already existed.
                            strip_stray_paid_labels = plan == 'trial' and not await has_paid_beyond_trial(email)
                            wanted_labels = PLAN_LABELS.get(plan, PLAN_LABELS['standard'])
                            member = await ensure_member_labeled(
                                email, name, wanted_labels, token,
                                strip_unintended_paid_labels=strip_stray_paid_labels,
                                note=note,
                            )
                            if member:
                                logger.info(f"Ghost member ensured for {email}: labels={wanted_labels}")
                                if plan == 'trial' and start_trial:
                                    await start_trial(email, member.get('id', ''))

                                # payments.py's ledger -- the one place any
                                # of this becomes queryable later, instead
                                # of only living in this Ghost note (which
                                # gets overwritten by the next payment) and
                                # the Slack message below.
                                if record_payment:
                                    await record_payment(
                                        payment_id=payment_id,
                                        order_id=payment_entity.get('order_id') or '',
                                        subscription_id=subscription_entity.get('id') or '',
                                        email=email,
                                        name=name,
                                        amount=amount,
                                        currency=payment_entity.get('currency') or 'INR',
                                        plan=plan or 'standard',
                                        source='webhook',
                                        razorpay_created_at_unix=payment_entity.get('created_at'),
                                        raw_notes=payment_entity.get('notes') or {},
                                    )

                                badge = ':new: ' if was_new else ''
                                slack_text = (
                                    f"{badge}{'New' if was_new else 'Upgraded'} TSOP Subscriber\n"
                                    f"*Name*: {name or '—'}\n"
                                    f"*Contact*: {contact or '—'}\n"
                                    f"*Email*: {email}\n"
                                    f"*Amount*: {amount}\n"
                                    f"*Payment ID*: {payment_id}\n"
                                    f"*Time*: {payment_entity.get('created_at') or int(datetime.now(timezone.utc).timestamp())}"
                                )
                                await _slack_post(slack_text)

                                # A subscription that previously halted
                                # (a failed renewal charge) and is now
                                # charging again successfully -- cancel
                                # its pending grace-period downgrade so
                                # the daily sweep doesn't act on stale
                                # state. No-op for a plain one-time
                                # payment (no subscription_id) or a
                                # subscription that was never halted.
                                sub_id = subscription_entity.get('id')
                                if sub_id and clear_grace_period:
                                    await clear_grace_period(sub_id)
                            else:
                                logger.warning(f"Ghost member ensure/label failed for {email}")
                    except Exception as e:
                        # Non-fatal — the payment itself succeeded and is
                        # recorded above; a Ghost hiccup here shouldn't turn
                        # into a webhook failure Razorpay would retry.
                        logger.error(f"Ghost member ensure/label error for {email}: {e!r}")
            else:
                logger.warning("No email found in webhook payload")
                logger.debug(f"Payment entity: {payment_entity}")
        elif event in ('refund.created', 'refund.processed', 'refund.failed') and sync_refunds:
            # Only the payment ID is taken from the webhook; what was
            # refunded is read from Razorpay itself (refunds.py).
            refund_entity = payload.get('payload', {}).get('refund', {}).get('entity', {})
            await sync_refunds(refund_entity.get('payment_id') or '')
        elif event.startswith('subscription.') and handle_subscription_webhook_event:
            # subscription.activated and subscription.charged are already
            # covered above (Ghost labeling + Slack, same as payment.captured);
            # the remaining lifecycle (authenticated, halted, cancelled) is
            # handled in razorpay_subscriptions.py.
            await handle_subscription_webhook_event(event, payload)
        else:
            logger.info(f"Ignoring event type: {event}")
        
        logger.info("=== WEBHOOK PROCESSED SUCCESSFULLY ===")
        return {"status": "ok", "event": event}
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse webhook JSON: {e}")
        return {"status": "error", "message": "Invalid JSON"}
    except Exception as e:
        logger.error(f"Razorpay webhook error: {e}", exc_info=True)
        # Return 200 anyway to prevent Razorpay from retrying endlessly
        return {"status": "error", "message": str(e)}



# Health check endpoint - CRITICAL for Render to keep service warm
@api_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring and keeping service warm"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "stateofplay-backend"
    }


# ════════════════════════════════════════════════════════════════════════
# GST invoices live in member_invoices.py (members and teams). These two
# old routes only answer pages loaded before the change.
# ════════════════════════════════════════════════════════════════════════
@api_router.post("/invoice/generate")
async def generate_gst_invoice_retired():
    """Replaced by member_invoices (/api/invoice/payments and /download),
    which builds each invoice from the payment itself. This took its date
    from the Ghost account and charged everyone ₹2,499, so renewers got
    last year's invoice. Kept only to tell a page loaded before the change
    what to do."""
    raise HTTPException(status_code=410, detail="Reload this page to download your invoice.")


@api_router.post("/invoice/generate-team")
async def generate_team_gst_invoice_retired():
    """Replaced by member_invoices (/api/invoice/team/list and /download),
    which builds each team invoice from the team's own payment. This one
    priced every team at the founding rate and dated a renewal's invoice
    the day its new year starts. Kept only to tell a page loaded before
    the change what to do."""
    raise HTTPException(status_code=410, detail="Reload this page to download your invoice.")

# Root health check (without /api prefix)
@app.get("/health")
async def root_health_check():
    """Root health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "stateofplay-backend"
    }

# ─── SEARCH-ENGINE SSR: full article HTML for Googlebot/Bingbot/etc. ─────
#
# Routing contract (see frontend/vercel.json):
#   • Social-media bots      →  /api/og/{slug}    → 3.9 KB stub, meta tags only
#   • Search-engine crawlers →  /api/story/{slug} → THIS endpoint, full body
#
# The social stub is fine for Facebook / WhatsApp / LinkedIn / Twitter which
# only care about <meta og:*> tags. It's a disaster for Google, which needs
# the article body to build relevance signals. Before this endpoint existed,
# both audiences were routed to /api/og/{slug}, meaning Google indexed only
# ~64 words per article (title + Ghost excerpt) — the root cause behind the
# "only 17 pages indexed" symptom flagged by the audit.
#
# This endpoint returns a full server-rendered article page with:
#   • Canonical <title>, <meta description>, <link rel="canonical">, OG/Twitter tags
#   • NewsArticle JSON-LD schema (headline, dates, author, publisher, articleBody)
#   • <article> element with <h1>, byline, hero image, full Ghost HTML body, tags
#   • Minimal readable styling so a human landing here directly still gets a
#     usable page (though Vercel routes humans to the SPA, not here)


def _escape_html(text) -> str:
    if not text:
        return ''
    return (str(text)
            .replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;').replace("'", '&#039;'))


@api_router.get("/story/{slug:path}")
async def get_story_ssr(slug: str, request: Request):
    """Full article HTML for search-engine crawlers. See module docstring above."""
    import json as _json
    import httpx
    from fastapi.responses import HTMLResponse
    import page_previews

    # Search bots reach here for /about and the other pages too; a 404 would
    # tell Google those pages don't exist.
    page = await page_previews.page_meta(slug, db, strict=True)
    if page:
        private = slug.strip('/').split('/')[0] in page_previews.NOINDEX
        return HTMLResponse(content=_page_preview_html(page, noindex=private), status_code=200, headers={
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
        })
    slug = slug.strip('/')

    article_url = f"https://www.stateofplay.club/{slug}"
    site_default_image = f"https://www.stateofplay.club/api/og-image/{slug}"
    gsc_token = os.environ.get('GSC_VERIFICATION_TOKEN', '').strip()

    article = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{GHOST_URL}/ghost/api/content/posts/slug/{slug}/",
                params={
                    'key': GHOST_CONTENT_API_KEY,
                    'include': 'authors,tags',
                    # Explicitly request the html field — it's returned by
                    # default, but being explicit protects against Ghost API
                    # default changes.
                    'formats': 'html',
                },
            )
            if resp.status_code == 200:
                posts = resp.json().get('posts') or []
                if posts:
                    article = posts[0]
    except Exception as e:
        logger.error(f"SSR story fetch failed for {slug}: {e!r}")

    if not article:
        # Slug isn't a Ghost post — return a proper 404 so Google de-indexes
        # cleanly instead of banking a soft-404 penalty.
        return HTMLResponse(
            content=(
                '<!DOCTYPE html><html lang="en"><head>'
                '<meta charset="utf-8">'
                '<title>Not found | The State of Play</title>'
                '<meta name="robots" content="noindex,nofollow">'
                '</head><body><h1>Not found</h1>'
                '<p>This story could not be located. '
                '<a href="https://www.stateofplay.club/">Return to The State of Play</a></p>'
                '</body></html>'
            ),
            status_code=404,
        )

    # ── Extract fields with sensible fallbacks ─────────────────────────
    title           = article.get('title') or 'The State of Play'
    description     = (article.get('custom_excerpt')
                       or article.get('excerpt')
                       or "India's sports business publication.")
    body_html       = article.get('html') or ''
    hero_image      = article.get('feature_image') or ''
    hero_alt        = article.get('feature_image_alt') or title
    hero_caption    = article.get('feature_image_caption') or ''
    published       = article.get('published_at') or ''
    modified        = article.get('updated_at') or published
    reading_time    = article.get('reading_time') or 0
    authors_arr     = article.get('authors') or []
    author_names    = [a.get('name') for a in authors_arr if a.get('name')]
    author_primary  = author_names[0] if author_names else 'Venkat Ananth'
    tags_arr        = article.get('tags') or []
    tag_names       = [t.get('name') for t in tags_arr if t.get('name') and not (t.get('name') or '').startswith('#')]
    og_image        = hero_image or site_default_image

    # ── Human-readable date for the byline ─────────────────────────────
    display_date = ''
    if published:
        try:
            dt = datetime.fromisoformat(published.replace('Z', '+00:00'))
            display_date = dt.strftime('%B %-d, %Y')
        except Exception:
            display_date = published[:10]

    # ── JSON-LD NewsArticle schema (Google's rich-results eligibility) ─
    # articleBody is passed as plain text (Ghost's html field stripped of tags)
    # per schema.org guidance. Keep it truncated to avoid ballooning HTML size.
    plain_body = re.sub(r'<[^>]+>', ' ', body_html or '')
    plain_body = re.sub(r'\s+', ' ', plain_body).strip()

    ld = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "mainEntityOfPage": {"@type": "WebPage", "@id": article_url},
        "headline": title[:110],
        "description": description[:300],
        "image": [og_image] if og_image else [],
        "datePublished": published,
        "dateModified": modified,
        "author": [
            {"@type": "Person", "name": n} for n in author_names
        ] or [{"@type": "Person", "name": "Venkat Ananth"}],
        "publisher": {
            "@type": "Organization",
            "name": "The State of Play",
            "url": "https://www.stateofplay.club",
            "logo": {
                "@type": "ImageObject",
                "url": "https://www.stateofplay.club/tsop-logo.png",
                "width": 400,
                "height": 400,
            },
        },
        "articleBody": plain_body[:5000],
        "url": article_url,
    }
    if tag_names:
        ld["keywords"] = ", ".join(tag_names)
        ld["articleSection"] = tag_names[0]
    ld_json = _json.dumps(ld, ensure_ascii=False)

    # ── Tags rendered as a nav strip at the foot of the article ────────
    tags_html = ''
    if tag_names:
        tags_html = (
            '<nav class="tsop-tags" aria-label="Topics">'
            + ''.join(
                f'<span class="tsop-tag">{_escape_html(t)}</span>'
                for t in tag_names[:8]
            )
            + '</nav>'
        )

    # ── Byline: author · date · reading time ───────────────────────────
    byline_parts = []
    if author_primary:
        byline_parts.append(f'By {_escape_html(author_primary)}')
    if display_date:
        byline_parts.append(_escape_html(display_date))
    if reading_time:
        byline_parts.append(f'{int(reading_time)} min read')
    byline_html = ' &middot; '.join(byline_parts)

    # ── Hero image ─────────────────────────────────────────────────────
    hero_html = ''
    if hero_image:
        caption_html = (
            f'<figcaption class="tsop-hero-caption">{hero_caption}</figcaption>'
            if hero_caption else ''
        )
        hero_html = (
            f'<figure class="tsop-hero">'
            f'<img src="{_escape_html(hero_image)}" alt="{_escape_html(hero_alt)}" '
            f'loading="eager" width="1600" height="900">'
            f'{caption_html}'
            f'</figure>'
        )

    # ── article:author + article:tag meta ──────────────────────────────
    author_meta = ''.join(
        f'<meta property="article:author" content="{_escape_html(n)}">'
        for n in author_names
    )
    tag_meta = ''.join(
        f'<meta property="article:tag" content="{_escape_html(t)}">'
        for t in tag_names[:10]
    )

    gsc_meta = (
        f'<meta name="google-site-verification" content="{_escape_html(gsc_token)}">'
        if gsc_token else ''
    )

    html_doc = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {gsc_meta}
  <title>{_escape_html(title)} | The State of Play</title>
  <meta name="description" content="{_escape_html(description)}">
  <link rel="canonical" href="{article_url}">
  <meta name="robots" content="index,follow,max-image-preview:large">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="{article_url}">
  <meta property="og:title" content="{_escape_html(title)}">
  <meta property="og:description" content="{_escape_html(description)}">
  <meta property="og:image" content="{_escape_html(og_image)}">
  <meta property="og:image:secure_url" content="{_escape_html(og_image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="The State of Play">
  <meta property="article:published_time" content="{published}">
  <meta property="article:modified_time" content="{modified}">
  {author_meta}
  {tag_meta}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@stateofplayclub">
  <meta name="twitter:title" content="{_escape_html(title)}">
  <meta name="twitter:description" content="{_escape_html(description)}">
  <meta name="twitter:image" content="{_escape_html(og_image)}">

  <!-- NewsArticle JSON-LD -->
  <script type="application/ld+json">{ld_json}</script>

  <style>
    :root {{
      --bg:#F5F3EE; --text:#1A1A1A; --muted:#666; --rule:#DAD5CC; --accent:#A0291C;
    }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; background:var(--bg); color:var(--text); font-family: "Literata", Georgia, "Times New Roman", serif; line-height:1.65; -webkit-font-smoothing:antialiased; }}
    .tsop-mast {{ border-bottom:1px solid var(--rule); padding:18px 28px; font-family:-apple-system,"Segoe UI",Roboto,sans-serif; font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); }}
    .tsop-mast a {{ color:var(--text); text-decoration:none; font-weight:600; }}
    article.tsop {{ max-width:720px; margin:0 auto; padding:40px 22px 80px; }}
    article.tsop h1 {{ font-family:"Gloock",Georgia,serif; font-weight:600; font-size:clamp(28px,5vw,42px); line-height:1.1; letter-spacing:-0.01em; margin:0 0 16px; }}
    .tsop-byline {{ font-family:-apple-system,"Segoe UI",Roboto,sans-serif; font-size:13px; letter-spacing:0.02em; color:var(--muted); margin:0 0 32px; }}
    .tsop-hero {{ margin:0 0 32px; }}
    .tsop-hero img {{ width:100%; height:auto; display:block; }}
    .tsop-hero-caption {{ font-size:12px; color:var(--muted); padding:8px 4px 0; font-style:italic; }}
    article.tsop p, article.tsop li {{ font-size:19px; line-height:1.6; margin:0 0 22px; }}
    article.tsop h2 {{ font-family:"Gloock",Georgia,serif; font-weight:600; font-size:26px; line-height:1.25; margin:44px 0 12px; }}
    article.tsop h3 {{ font-family:"Gloock",Georgia,serif; font-weight:600; font-size:21px; line-height:1.3; margin:36px 0 10px; }}
    article.tsop a {{ color:var(--accent); text-underline-offset:4px; }}
    article.tsop blockquote {{ border-left:3px solid var(--accent); padding:2px 0 2px 18px; margin:24px 0; font-style:italic; color:#333; }}
    article.tsop img, article.tsop figure {{ max-width:100%; height:auto; margin:28px 0; }}
    article.tsop figcaption {{ font-size:13px; color:var(--muted); font-style:italic; padding-top:6px; }}
    .tsop-tags {{ margin:48px 0 0; padding-top:24px; border-top:1px solid var(--rule); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); }}
    .tsop-tag {{ display:inline-block; margin-right:14px; }}
    .tsop-foot {{ margin-top:56px; padding:28px 0 0; border-top:1px solid var(--rule); font-family:-apple-system,sans-serif; font-size:13px; color:var(--muted); }}
    .tsop-foot a {{ color:var(--accent); text-decoration:none; }}
  </style>
</head>
<body>
  <header class="tsop-mast">
    <a href="https://www.stateofplay.club/">The State of Play</a>
  </header>
  <main>
    <article class="tsop">
      <h1>{_escape_html(title)}</h1>
      <p class="tsop-byline">{byline_html}</p>
      {hero_html}
      <div class="tsop-body">
        {body_html}
      </div>
      {tags_html}
      <p class="tsop-foot">Read the latest at <a href="https://www.stateofplay.club/">stateofplay.club</a> &middot; A publication of Left Field Ventures</p>
    </article>
  </main>
</body>
</html>'''
    return HTMLResponse(
        content=html_doc,
        status_code=200,
        headers={'Cache-Control': 'public, max-age=300, s-maxage=3600'},
    )


# ─── SEO: sitemap.xml + robots.txt ────────────────────────────────
@api_router.get("/sitemap.xml")
async def sitemap_xml():
    """Dynamic XML sitemap. Lists static routes + every published Ghost post."""
    import httpx
    from fastapi.responses import Response as FastResponse

    SITE = "https://www.stateofplay.club"
    static_paths = [
        ("/",            "1.0", "daily"),
        ("/state-of-play","0.9", "daily"),
        ("/archive",     "0.8", "daily"),
        ("/season-one",  "0.7", "weekly"),
        ("/start-here",  "0.7", "weekly"),
        ("/left-field",  "0.8", "weekly"),
        ("/outfield",    "0.7", "weekly"),
        ("/about",       "0.6", "monthly"),
        ("/contact",     "0.5", "monthly"),
        ("/teams",       "0.6", "monthly"),
        ("/partnerships","0.6", "monthly"),
        ("/membership",  "0.7", "monthly"),
        ("/terms",       "0.3", "yearly"),
        ("/privacy",     "0.3", "yearly"),
    ]

    posts = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            page = 1
            while True:
                r = await client.get(
                    f"{GHOST_URL}/ghost/api/content/posts/",
                    params={
                        'key': GHOST_CONTENT_API_KEY,
                        'limit': 100,
                        'page': page,
                        'fields': 'slug,updated_at,published_at',
                        'filter': 'status:published+visibility:[public,paid,members]',
                    },
                )
                if r.status_code != 200:
                    break
                data = r.json()
                posts.extend(data.get('posts', []))
                meta = (data.get('meta') or {}).get('pagination') or {}
                if not meta.get('next'):
                    break
                page = meta['next']
                if page > 10:
                    break
    except Exception as e:
        logger.error(f"sitemap ghost fetch failed: {e}")

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, prio, freq in static_paths:
        lines.append(
            f'<url><loc>{SITE}{path}</loc><changefreq>{freq}</changefreq><priority>{prio}</priority></url>')
    # One /topic/ page per beat in use. Mirrors BEAT_TAGS in
    # frontend/src/pages/Archive.js; entity tags (people, companies) are
    # left out so the sitemap only lists the beat pages.
    beat_names = {
        'Cricket Markets', 'IPL', 'Franchise Valuations', 'Football', 'Media Rights',
        'Governance', 'Sponsorship', 'Infrastructure', 'Private Equity in Sport',
        'Sportswear & Apparel', 'Fitness & Wellness', 'Sports-Tech & Booking Platforms',
        'Fantasy Sports & Gaming', 'Sporting Goods & Equipment',
    }
    # Fetched separately from the posts so a failure here can only drop
    # the topic URLs, never the stories.
    topic_slugs = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{GHOST_URL}/ghost/api/content/tags/",
                params={'key': GHOST_CONTENT_API_KEY, 'limit': 'all', 'include': 'count.posts'},
            )
            if r.status_code == 200:
                topic_slugs = sorted(
                    t['slug'] for t in r.json().get('tags', [])
                    if t.get('name') in beat_names and t.get('slug')
                    and ((t.get('count') or {}).get('posts') or 0) > 0
                )
    except Exception as e:
        logger.error(f"sitemap ghost tags fetch failed: {e}")
    for topic in topic_slugs:
        lines.append(
            f'<url><loc>{SITE}/topic/{topic}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>')
    for p in posts:
        slug = p.get('slug')
        if not slug:
            continue
        lastmod = p.get('updated_at') or p.get('published_at') or ''
        lastmod_tag = f'<lastmod>{lastmod}</lastmod>' if lastmod else ''
        lines.append(
            f'<url><loc>{SITE}/{slug}</loc>{lastmod_tag}<changefreq>monthly</changefreq><priority>0.7</priority></url>')
    lines.append('</urlset>')
    return FastResponse(
        content='\n'.join(lines),
        media_type='application/xml',
        headers={'Cache-Control': 'public, max-age=3600'},
    )


@api_router.get("/robots.txt")
async def robots_txt():
    """Public robots.txt served from the backend.

    Strategy: explicit per-bot allow rules for the major social crawlers
    (Twitter / Facebook / LinkedIn / WhatsApp / Slack / Discord / Telegram),
    so they can fetch the dynamic OG image at /api/og-image/{slug} without
    being blocked by the more general `User-agent: *` rules.

    `Disallow: /api/` is deliberately NOT used — it was previously blocking
    Twitter and LinkedIn from rendering the OG card. API endpoints that need
    protection use auth / rate-limiting, not robots.txt.
    """
    from fastapi.responses import Response as FastResponse
    body = (
        # ─── Social-media crawlers: allow everything they need ───
        "User-agent: Twitterbot\n"
        "Allow: /\n"
        "\n"
        "User-agent: facebookexternalhit\n"
        "Allow: /\n"
        "\n"
        "User-agent: facebot\n"
        "Allow: /\n"
        "\n"
        "User-agent: LinkedInBot\n"
        "Allow: /\n"
        "\n"
        "User-agent: WhatsApp\n"
        "Allow: /\n"
        "\n"
        "User-agent: Slackbot\n"
        "Allow: /\n"
        "\n"
        "User-agent: Slackbot-LinkExpanding\n"
        "Allow: /\n"
        "\n"
        "User-agent: TelegramBot\n"
        "Allow: /\n"
        "\n"
        "User-agent: Discordbot\n"
        "Allow: /\n"
        "\n"
        "User-agent: Pinterest\n"
        "Allow: /\n"
        "\n"
        "User-agent: SkypeUriPreview\n"
        "Allow: /\n"
        "\n"
        # ─── Default rules for everyone else (search engines etc.) ───
        "User-agent: *\n"
        "Disallow: /account\n"
        "Disallow: /login\n"
        "Disallow: /teams/manage\n"
        "Disallow: /teams/login\n"
        "Disallow: /s/\n"
        "Disallow: /invite/\n"
        "Disallow: /g/\n"
        "Disallow: /mixed-zone\n"
        "Allow: /\n"
        "\n"
        "Sitemap: https://www.stateofplay.club/sitemap.xml\n"
    )
    return FastResponse(content=body, media_type='text/plain')

app.include_router(api_router)

# Mount the admin dashboard's own session (Sept 2026) -- separate from the
# reader session (session_auth.py), separate secret, separate JWT audience.
# Every other module's admin-key-gated endpoint imports
# require_admin_key_or_session from here, so this must be mounted (i.e.
# init(db) called) before any request needing it arrives -- import order
# among the try/except blocks below doesn't matter for that (Python
# resolves the `from admin_auth import ...` in each of those modules at
# import time regardless), only that init(db) runs during startup, which
# it does here.
try:
    from admin_auth import router as admin_auth_router, init as admin_auth_init
    admin_auth_init(db)
    app.include_router(admin_auth_router)
except Exception as _e:
    logging.warning(f"admin_auth module not mounted: {_e!r}")

# Mount Session 2 nominations / story-token / cold-link routes
try:
    from nominations import router as nominations_router, init as nominations_init
    nominations_init(db)
    app.include_router(nominations_router)
except Exception as _e:
    logging.warning(f"nominations module not mounted: {_e!r}")

# Mount self-hosted article comments (replaces Ghost's native Comments widget)
try:
    from comments import router as comments_router, init as comments_init
    comments_init(db)
    app.include_router(comments_router)
except Exception as _e:
    logging.warning(f"comments module not mounted: {_e!r}")

# Mount private invite links (first year at the old price)
try:
    from invite_links import router as invite_links_router, init as invite_links_init
    invite_links_init(db)
    app.include_router(invite_links_router)
except Exception as _e:
    logging.warning(f"invite_links module not mounted: {_e!r}")

# Mount group story links (one story shared with a WhatsApp group, with a
# first-year offer; group_links.py)
try:
    from group_links import router as group_links_router, init as group_links_init
    group_links_init(db)
    app.include_router(group_links_router)
except Exception as _e:
    logging.warning(f"group_links module not mounted: {_e!r}")

# Mount the Mixed Zone (annual members' notes feed, private replies)
try:
    from mixed_zone import router as mixed_zone_router, init as mixed_zone_init
    mixed_zone_init(db)
    app.include_router(mixed_zone_router)
except Exception as _e:
    logging.warning(f"mixed_zone module not mounted: {_e!r}")

# Mount plan/tier infrastructure (September roadmap, P0)
try:
    from tiers import router as tiers_router
    app.include_router(tiers_router)
except Exception as _e:
    logging.warning(f"tiers module not mounted: {_e!r}")

# Mount the Resend transactional email helper (Sept 2026 — replaces Apps
# Script/MailApp for anything new that needs reliable, visible delivery;
# corporate subs' Sheets/Slack/Gmail-draft machinery stays on Apps Script,
# untouched — this is scoped to email-sending only).
# Complimentary annual memberships Venkat gives by hand (Admin → Tools).
try:
    from complimentary import router as complimentary_router, init as complimentary_init
    complimentary_init(db)
    app.include_router(complimentary_router)
except Exception as _e:
    logging.warning(f"complimentary module not mounted: {_e!r}")

# Graphics readers can share from a story in the app (story_graphics.py).
async def _story_for_graphics(slug: str):
    """The story with its full HTML (graphics can sit below the paywall),
    from the one-minute story cache when it's there."""
    import httpx
    import time as _time
    cached = _ARTICLE_CACHE.get(slug)
    if cached and _time.monotonic() - cached[0] < _ARTICLE_CACHE_SECONDS:
        return cached[1]
    token = create_ghost_admin_token()
    if not token:
        return None
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f'{GHOST_URL}/ghost/api/admin/posts/slug/{slug}/',
                             params={'formats': 'html'}, headers={'Authorization': f'Ghost {token}'})
    posts = r.json().get('posts') if r.status_code == 200 else None
    if not posts or posts[0].get('status') != 'published':
        return None
    _ARTICLE_CACHE[slug] = (_time.monotonic(), posts[0])
    return posts[0]

try:
    from story_graphics import router as story_graphics_router, init as story_graphics_init
    story_graphics_init(_story_for_graphics)
    app.include_router(story_graphics_router)
except Exception as _e:
    logging.warning(f"story_graphics module not mounted: {_e!r}")

try:
    from resend_email import router as resend_email_router, init as resend_email_init
    resend_email_init(db)
    app.include_router(resend_email_router)
except Exception as _e:
    logging.warning(f"resend_email module not mounted: {_e!r}")

# Mount the real backend-owned session — second attempt (Sept 2026), this
# time on Resend (proven working) with a typed code instead of a magic
# link (see session_auth.py's docstring for why). Built and tested in
# isolation; not yet wired into AuthContext.js's localStorage flow.
try:
    from session_auth import router as session_auth_router, init as session_auth_init
    session_auth_init(db)
    app.include_router(session_auth_router)
except Exception as _e:
    logging.warning(f"session_auth module not mounted: {_e!r}")

# Mount the payments ledger (Sept 2026) -- must mount before
# razorpay_orders/razorpay_subscriptions below, which both call its
# fetch_and_record() from their own verify-* endpoints.
try:
    from payments import router as payments_router, init as payments_init, record_payment
    payments_init(db, razorpay_client)
    app.include_router(payments_router)
except Exception as _e:
    logging.warning(f"payments module not mounted: {_e!r}")
    record_payment = None

# Mount refunds (October 2026): dashboard refunds, automatic paid-twice
# and overpaid refunds (hooked into payments.record_payment), and the
# webhook's refund.* events.
try:
    from refunds import router as refunds_router, init as refunds_init, sync_from_razorpay as sync_refunds
    refunds_init(db, razorpay_client)
    app.include_router(refunds_router)
except Exception as _e:
    logging.warning(f"refunds module not mounted: {_e!r}")
    sync_refunds = None

# Mount dynamic Razorpay Orders checkout (replaces static Payment Buttons
# for plan/add-on combinations ahead of the Oct 6 launch)
try:
    from razorpay_orders import router as razorpay_orders_router, init as razorpay_orders_init
    razorpay_orders_init(razorpay_client, recent_payments)
    app.include_router(razorpay_orders_router)
except Exception as _e:
    logging.warning(f"razorpay_orders module not mounted: {_e!r}")

# Mount gift-a-subscription (Sept 2026) -- after razorpay_orders, whose
# create-order endpoint it reuses unchanged for the payment step itself.
try:
    from gift_subscriptions import router as gift_subscriptions_router, init as gift_subscriptions_init
    gift_subscriptions_init(razorpay_client, db)
    app.include_router(gift_subscriptions_router)
except Exception as _e:
    logging.warning(f"gift_subscriptions module not mounted: {_e!r}")

# Mount member GST invoices (October 2026): one invoice per payment, from
# the payments ledger, for the signed-in reader.
try:
    from member_invoices import router as member_invoices_router, init as member_invoices_init
    member_invoices_init(db)
    app.include_router(member_invoices_router)
except Exception as _e:
    logging.warning(f"member_invoices module not mounted: {_e!r}")

# Mount corporate.py (Phase 4) -- before admin_dashboard, which now imports
# fetch_accounts from it to resolve corp-* members' real renewal dates.
try:
    from corporate import router as corporate_router, init as corporate_init
    corporate_init()
    app.include_router(corporate_router)
except Exception as _e:
    logging.warning(f"corporate module not mounted: {_e!r}")

# Mount the admin dashboard's subscriber-aggregation endpoint (Phase 2) --
# after payments (above), which it imports from.
try:
    from admin_dashboard import router as admin_dashboard_router, init as admin_dashboard_init
    admin_dashboard_init(db, razorpay_client)
    app.include_router(admin_dashboard_router)
except Exception as _e:
    logging.warning(f"admin_dashboard module not mounted: {_e!r}")

# Mount the quarterly free-to-paid nudge label sync
try:
    from nudge import router as nudge_router
    app.include_router(nudge_router)
except Exception as _e:
    logging.warning(f"nudge module not mounted: {_e!r}")

# Mount real auto-renewing membership subscriptions (Nov 1 pricing transition).
# clear_grace_period and the grace-period router itself both moved to
# subscription_grace.py when the tier concept was cut from
# razorpay_subscriptions.py -- this mount block previously still imported
# clear_grace_period from razorpay_subscriptions (no longer exported there)
# and called the old 3-arg init(), so the whole try block silently failed
# and neither router ever got mounted at all. Fixed here, and
# subscription_grace's own router (its /expire-check cron endpoint) is now
# actually mounted for the first time.
try:
    from razorpay_subscriptions import (
        router as razorpay_subscriptions_router,
        init as razorpay_subscriptions_init,
        handle_subscription_webhook_event,
    )
    from subscription_grace import (
        router as subscription_grace_router,
        init as subscription_grace_init,
        clear_grace_period,
    )
    razorpay_subscriptions_init(razorpay_client, recent_payments)
    subscription_grace_init(db)
    app.include_router(razorpay_subscriptions_router)
    app.include_router(subscription_grace_router)
except Exception as _e:
    logging.warning(f"razorpay_subscriptions module not mounted: {_e!r}")
    handle_subscription_webhook_event = None
    clear_grace_period = None

# Mount the one-time-payment annual lifecycle sweep (Oct 2026) -- reminder,
# grace notice, then downgrade for a Standard/trial-upgrade member who never
# renews. Separate from razorpay_subscriptions' own grace handling just
# above, which only covers a real auto-renewing Subscription's failed
# charge -- a one-time Order never attempts to charge again, so there's no
# equivalent event to react to; this is the date-driven sweep that covers
# that gap instead.
try:
    from annual_renewal import router as annual_renewal_router, init as annual_renewal_init
    annual_renewal_init(db)
    app.include_router(annual_renewal_router)
except Exception as _e:
    logging.warning(f"annual_renewal module not mounted: {_e!r}")

# Mount the Student plan application review queue (Sept 2026) -- after
# admin_auth (for require_admin_key_or_session) and resend_email (for
# send_email), both already mounted above.
try:
    from student_applications import router as student_applications_router, init as student_applications_init
    student_applications_init(db)
    app.include_router(student_applications_router)
except Exception as _e:
    logging.warning(f"student_applications module not mounted: {_e!r}")

# Mount Trial ("The Ten") expiry tracking — 30-day window + story snapshot
try:
    from trial_tracking import (
        router as trial_router, init as trial_init, start_trial,
        is_trial_slug_accessible, record_trial_open,
    )
    trial_init(db)
    app.include_router(trial_router)
except Exception as _e:
    logging.warning(f"trial_tracking module not mounted: {_e!r}")
    start_trial = None
    is_trial_slug_accessible = None
    record_trial_open = None

# Only the site itself may call this API from a browser. Reader and admin
# sessions are bearer tokens, but sign-in also sets a SameSite=None cookie
# (kept for older sessions); with any origin allowed alongside credentials,
# any website a signed-in reader visited could have read their account and
# invoices with that cookie. CORS_ORIGINS (comma-separated) overrides the
# list; '*' is no longer honoured.
SITE_ORIGINS_REGEX = (
    r'^(?:https://(www\.)?stateofplay\.club'
    r'|https://the-state-of-play\.ghost\.io'
    r'|https://state-of-play-[a-z0-9-]+-venkats-projects-1cde548d\.vercel\.app'
    r'|http://(localhost|127\.0\.0\.1)(:\d+)?)$'
)
_cors_origins_env = os.environ.get('CORS_ORIGINS', '').strip()
if _cors_origins_env and _cors_origins_env != '*':
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=[o.strip() for o in _cors_origins_env.split(',') if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=SITE_ORIGINS_REGEX,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Auth responses must never be cached by anything sitting between the
# browser and this backend -- a browser, extension, or intermediate proxy
# serving a stale cached /api/auth/me (e.g. an earlier anonymous 401, from
# before a reader signed in) would make sign-in look broken on refresh even
# though the real, current request would have succeeded. Applies to every
# response under /api/auth/* (reader session) and /api/admin/* (admin
# session + every dashboard data endpoint -- subscriber/payment data is
# exactly the kind of response that must never be served stale), success
# or error alike, regardless of which router or exception handler produced
# it.
@app.middleware("http")
async def no_store_for_auth(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith('/api/auth/') or request.url.path.startswith('/api/admin/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
    return response


# Server errors for the dashboard's Today page (October 2026). Mounted
# here, and started once the server's event loop is running.
try:
    from error_log import router as error_log_router, install as error_log_install, ensure_indexes as error_log_indexes
    app.include_router(error_log_router)

    @app.on_event("startup")
    async def start_error_log():
        if db is not None:
            error_log_install(db)
            await error_log_indexes()
except Exception as _e:
    logging.warning(f"error_log module not mounted: {_e!r}")


# The Left Field as a running feed of notes, for the app (October 2026).
try:
    from left_field_notes import router as lf_notes_router, init as lf_notes_init
    lf_notes_init(db)
    app.include_router(lf_notes_router)
except Exception as _e:
    logging.warning(f"left_field_notes module not mounted: {_e!r}")

# Phone notifications for new stories (October 2026).
try:
    from push import router as push_router, init as push_init, watch_loop as push_watch_loop
    push_init(db)
    app.include_router(push_router)

    @app.on_event("startup")
    async def start_push_watch():
        if db is not None:
            import asyncio as _asyncio
            _asyncio.get_running_loop().create_task(push_watch_loop())
except Exception as _e:
    logging.warning(f"push module not mounted: {_e!r}")


@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
