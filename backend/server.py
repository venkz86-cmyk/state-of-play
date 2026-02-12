from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt

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

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7

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
security = HTTPBearer()

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_subscriber: bool = False
    subscription_end_date: Optional[datetime] = None
    razorpay_customer_id: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user: User

class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: Optional[str] = None
    content: str
    preview_content: str
    author: str
    publication: str
    is_premium: bool
    theme: Optional[str] = None
    image_url: Optional[str] = None
    read_time: int = 5
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArticleCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    content: str
    preview_content: str
    author: str
    publication: str
    is_premium: bool
    theme: Optional[str] = None
    image_url: Optional[str] = None
    read_time: int = 5

class PaymentOrder(BaseModel):
    amount: int
    currency: str = "INR"

class PaymentVerification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

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

def create_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    user = await db.users.find_one({"email": payload['email']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    if user.get('subscription_end_date') and isinstance(user['subscription_end_date'], str):
        user['subscription_end_date'] = datetime.fromisoformat(user['subscription_end_date'])
    return User(**user)

@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    user = User(email=user_data.email, name=user_data.name)
    user_dict = user.model_dump()
    user_dict['password'] = hashed_password.decode('utf-8')
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    token = create_token(user.id, user.email)
    
    return AuthResponse(token=token, user=user)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(login_data.password.encode('utf-8'), user_doc['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_doc.pop('password')
    user_doc.pop('_id', None)
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    if user_doc.get('subscription_end_date') and isinstance(user_doc['subscription_end_date'], str):
        user_doc['subscription_end_date'] = datetime.fromisoformat(user_doc['subscription_end_date'])
    
    user = User(**user_doc)
    token = create_token(user.id, user.email)
    
    return AuthResponse(token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/articles", response_model=List[Article])
async def get_articles(publication: Optional[str] = None, theme: Optional[str] = None, limit: int = 50):
    query = {}
    if publication:
        query['publication'] = publication
    if theme:
        query['theme'] = theme
    
    articles = await db.articles.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for article in articles:
        if isinstance(article.get('created_at'), str):
            article['created_at'] = datetime.fromisoformat(article['created_at'])
        if isinstance(article.get('updated_at'), str):
            article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    return articles

@api_router.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: str, current_user: Optional[User] = None):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if isinstance(article.get('created_at'), str):
        article['created_at'] = datetime.fromisoformat(article['created_at'])
    if isinstance(article.get('updated_at'), str):
        article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    return Article(**article)

@api_router.post("/articles", response_model=Article)
async def create_article(article_data: ArticleCreate, current_user: User = Depends(get_current_user)):
    article = Article(**article_data.model_dump())
    article_dict = article.model_dump()
    article_dict['created_at'] = article_dict['created_at'].isoformat()
    article_dict['updated_at'] = article_dict['updated_at'].isoformat()
    
    await db.articles.insert_one(article_dict)
    return article

@api_router.post("/payment/create-order")
async def create_payment_order(order: PaymentOrder, current_user: User = Depends(get_current_user)):
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": order.amount,
            "currency": order.currency,
            "payment_capture": 1
        })
        
        subscription = Subscription(
            user_id=current_user.id,
            razorpay_order_id=razorpay_order["id"],
            status="created",
            amount=order.amount
        )
        
        sub_dict = subscription.model_dump()
        sub_dict['created_at'] = sub_dict['created_at'].isoformat()
        await db.subscriptions.insert_one(sub_dict)
        
        return {
            "order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "key_id": os.environ.get('RAZORPAY_KEY_ID')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/payment/verify")
async def verify_payment(verification: PaymentVerification, current_user: User = Depends(get_current_user)):
    try:
        params_dict = {
            'razorpay_order_id': verification.razorpay_order_id,
            'razorpay_payment_id': verification.razorpay_payment_id,
            'razorpay_signature': verification.razorpay_signature
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        subscription_end = datetime.now(timezone.utc) + timedelta(days=365)
        
        await db.subscriptions.update_one(
            {"razorpay_order_id": verification.razorpay_order_id},
            {
                "$set": {
                    "razorpay_payment_id": verification.razorpay_payment_id,
                    "status": "completed",
                    "subscription_end_date": subscription_end.isoformat()
                }
            }
        )
        
        await db.users.update_one(
            {"id": current_user.id},
            {
                "$set": {
                    "is_subscriber": True,
                    "subscription_end_date": subscription_end.isoformat()
                }
            }
        )
        
        return {"status": "success", "message": "Payment verified and subscription activated"}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/user/subscription")
async def get_subscription_status(current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    
    is_active = False
    if user.get('is_subscriber') and user.get('subscription_end_date'):
        end_date = user['subscription_end_date']
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)
        is_active = end_date > datetime.now(timezone.utc)
    
    return {
        "is_subscriber": user.get('is_subscriber', False),
        "subscription_end_date": user.get('subscription_end_date'),
        "is_active": is_active
    }

@api_router.get("/substack/feed")
async def get_substack_feed():
    try:
        import feedparser
        feed = feedparser.parse('https://theleftfield.substack.com/feed')
        
        articles = []
        for entry in feed.entries[:15]:
            articles.append({
                "id": entry.get('id', entry.link),
                "title": entry.get('title', ''),
                "subtitle": entry.get('summary', '')[:200],
                "author": entry.get('author', 'The Left Field'),
                "external_url": entry.get('link', ''),
                "created_at": entry.get('published', ''),
                "image_url": None
            })
        
        return articles
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
    email: EmailStr

class MemberVerifyResponse(BaseModel):
    is_member: bool
    is_paid: bool
    email: str
    name: Optional[str] = None
    status: Optional[str] = None

@api_router.post("/ghost/verify-member", response_model=MemberVerifyResponse)
async def verify_ghost_member(request: MemberVerifyRequest):
    """Verify if an email is a Ghost member and their subscription status"""
    import httpx
    
    # Try Admin API first (most reliable)
    if GHOST_ADMIN_API_KEY:
        token = create_ghost_admin_token()
        if token:
            try:
                async with httpx.AsyncClient() as http_client:
                    response = await http_client.get(
                        f'{GHOST_URL}/ghost/api/admin/members/',
                        params={'filter': f'email:{request.email}'},
                        headers={'Authorization': f'Ghost {token}'}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        members = data.get('members', [])
                        
                        if members:
                            member = members[0]
                            # Check subscription status - comped members are also paid
                            status = member.get('status', 'free')
                            is_paid = status in ['paid', 'comped'] or len(member.get('subscriptions', [])) > 0
                            
                            return MemberVerifyResponse(
                                is_member=True,
                                is_paid=is_paid,
                                email=member.get('email', request.email),
                                name=member.get('name'),
                                status=status
                            )
                        else:
                            return MemberVerifyResponse(
                                is_member=False,
                                is_paid=False,
                                email=request.email,
                                status='not_found'
                            )
            except Exception as e:
                logger.error(f"Ghost Admin API error: {e}")
    
    # Fallback: Member is not found or Admin API not configured
    return MemberVerifyResponse(
        is_member=False,
        is_paid=False,
        email=request.email,
        status='not_configured' if not GHOST_ADMIN_API_KEY else 'error'
    )

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
    note: Optional[str] = None

@api_router.post("/ghost/member-details", response_model=MemberDetailsResponse)
async def get_member_details(request: MemberVerifyRequest):
    """Get detailed member info including subscription dates"""
    import httpx
    
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    
    token = create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail="Failed to create admin token")
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f'{GHOST_URL}/ghost/api/admin/members/',
                params={'filter': f'email:{request.email}', 'include': 'subscriptions'},
                headers={'Authorization': f'Ghost {token}'}
            )
            
            if response.status_code == 200:
                data = response.json()
                members = data.get('members', [])
                
                if members:
                    member = members[0]
                    status = member.get('status', 'free')
                    is_paid = status in ['paid', 'comped'] or len(member.get('subscriptions', [])) > 0
                    
                    # Get subscription details
                    subscriptions = member.get('subscriptions', [])
                    subscription_start = None
                    subscription_end = None
                    subscription_status = None
                    
                    if subscriptions:
                        # Get the most recent/active subscription
                        sub = subscriptions[0]
                        subscription_start = sub.get('start_date') or sub.get('created_at')
                        subscription_end = sub.get('current_period_end')
                        subscription_status = sub.get('status', 'active')
                    elif status == 'comped':
                        # For comped members, use created_at as start and set end to 1 year from now
                        subscription_start = member.get('created_at')
                        # Comped memberships typically don't have an end date
                        subscription_status = 'comped'
                    
                    return MemberDetailsResponse(
                        is_member=True,
                        is_paid=is_paid,
                        email=member.get('email', request.email),
                        name=member.get('name'),
                        status=status,
                        created_at=member.get('created_at'),
                        subscription_start=subscription_start,
                        subscription_end=subscription_end,
                        subscription_status=subscription_status,
                        avatar_image=member.get('avatar_image'),
                        note=member.get('note')
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

class ArticleContentRequest(BaseModel):
    slug: str
    email: str

class ArticleContentResponse(BaseModel):
    slug: str
    html: str
    title: str
    feature_image: Optional[str] = None

@api_router.post("/ghost/article-content", response_model=ArticleContentResponse)
async def get_full_article_content(request: ArticleContentRequest):
    """Get full article content for verified paid members using Admin API"""
    import httpx
    
    if not GHOST_ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    
    token = create_ghost_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail="Failed to create admin token")
    
    try:
        async with httpx.AsyncClient() as http_client:
            # First verify the user is a paid member
            member_response = await http_client.get(
                f'{GHOST_URL}/ghost/api/admin/members/',
                params={'filter': f'email:{request.email}'},
                headers={'Authorization': f'Ghost {token}'}
            )
            
            if member_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to verify membership")
            
            members = member_response.json().get('members', [])
            if not members:
                raise HTTPException(status_code=401, detail="Not a member")
            
            member = members[0]
            is_paid = member.get('status') == 'paid' or member.get('status') == 'comped' or len(member.get('subscriptions', [])) > 0
            
            if not is_paid:
                raise HTTPException(status_code=403, detail="Paid membership required")
            
            # Now fetch the full article using Admin API
            article_response = await http_client.get(
                f'{GHOST_URL}/ghost/api/admin/posts/slug/{request.slug}/',
                params={'formats': 'html'},
                headers={'Authorization': f'Ghost {token}'}
            )
            
            if article_response.status_code != 200:
                raise HTTPException(status_code=404, detail="Article not found")
            
            posts = article_response.json().get('posts', [])
            if not posts:
                raise HTTPException(status_code=404, detail="Article not found")
            
            post = posts[0]
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

class MagicLinkRequest(BaseModel):
    email: EmailStr

@api_router.get("/ghost/integrity-token")
async def get_ghost_integrity_token():
    """Proxy endpoint to get Ghost integrity token"""
    import httpx
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f'{GHOST_URL}/members/api/integrity-token/',
                headers={
                    'app-pragma': 'no-cache',
                    'x-ghost-version': '5.98'
                }
            )
            
            if response.status_code == 200:
                return {"token": response.text}
            else:
                logger.error(f"Failed to get integrity token: {response.status_code}")
                return {"token": None, "error": "Failed to get integrity token"}
    except Exception as e:
        logger.error(f"Integrity token error: {e}")
        return {"token": None, "error": str(e)}

@api_router.post("/ghost/send-magic-link")
async def send_ghost_magic_link(request: MagicLinkRequest):
    """Proxy endpoint to send Ghost magic link"""
    import httpx
    
    try:
        async with httpx.AsyncClient() as http_client:
            # First, get the integrity token
            token_response = await http_client.get(
                f'{GHOST_URL}/members/api/integrity-token/',
                headers={
                    'app-pragma': 'no-cache',
                    'x-ghost-version': '5.98'
                }
            )
            
            integrity_token = token_response.text if token_response.status_code == 200 else None
            
            # Now send the magic link request
            payload = {
                'email': request.email,
                'emailType': 'signin'
            }
            
            if integrity_token:
                payload['integrityToken'] = integrity_token
            
            response = await http_client.post(
                f'{GHOST_URL}/members/api/send-magic-link/',
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 201 or response.status_code == 200:
                return {"success": True, "message": "Magic link sent successfully"}
            else:
                # Try to parse error response
                try:
                    error_data = response.json()
                    error_message = error_data.get('errors', [{}])[0].get('message', 'Failed to send magic link')
                except:
                    error_message = f"Ghost returned status {response.status_code}"
                
                logger.error(f"Ghost magic link error: {error_message}")
                raise HTTPException(status_code=response.status_code, detail=error_message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ghost magic link error: {e}")
        raise HTTPException(status_code=500, detail="Failed to communicate with Ghost")

@api_router.get("/ghost/member")
async def get_ghost_member(request: Request):
    """Proxy endpoint to get Ghost member details from session"""
    import httpx
    
    # Forward the cookies from the original request
    cookies = request.cookies
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f'{GHOST_URL}/members/api/member/',
                cookies=cookies
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
    except Exception as e:
        logger.error(f"Ghost member fetch error: {e}")
        return None

# Dynamic OG Image Generator for social sharing
@api_router.get("/og-image/{slug}")
async def generate_og_image(slug: str):
    """Generate a branded OG image for social media sharing - mobile optimized with logo"""
    import httpx
    from fastapi.responses import Response, RedirectResponse
    from PIL import Image, ImageDraw, ImageFont, ImageEnhance
    from io import BytesIO
    import textwrap
    
    LOGO_URL = "https://the-state-of-play.ghost.io/content/images/2025/09/TSOP-Logo-Final-Colour-4.png"
    
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
        
        # Get category/tag
        tags = article.get('tags', [])
        category = None
        if tags:
            category = tags[0].get('name', '').upper()
        
        # Determine if premium
        is_premium = article.get('visibility') in ['paid', 'members']
        
        # Image dimensions (1200x630 - standard OG size)
        width, height = 1200, 630
        
        # Fetch feature image
        bg_img = None
        if feature_image_url:
            try:
                async with httpx.AsyncClient(timeout=10.0) as img_client:
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
        
        # Load fonts
        try:
            title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 54)
            badge_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
        except:
            title_font = ImageFont.load_default()
            badge_font = ImageFont.load_default()
        
        # Colors
        white = (255, 255, 255)
        coral = (255, 100, 100)
        blue = (35, 75, 160)
        
        # --- LOGO at top left ---
        try:
            async with httpx.AsyncClient(timeout=10.0) as logo_client:
                logo_response = await logo_client.get(LOGO_URL)
                if logo_response.status_code == 200:
                    logo = Image.open(BytesIO(logo_response.content))
                    logo = logo.convert('RGBA')
                    
                    # Scale logo
                    logo_height = 50
                    logo_ratio = logo.width / logo.height
                    logo_width = int(logo_height * logo_ratio)
                    logo = logo.resize((logo_width, logo_height), Image.LANCZOS)
                    
                    img.paste(logo, (50, 40), logo)
        except Exception as e:
            logger.error(f"Failed to fetch logo: {e}")
        
        # --- BADGES at top right ---
        badge_y = 45
        badge_x = width - 50
        
        if category:
            c_bbox = draw.textbbox((0, 0), category, font=badge_font)
            c_w, c_h = c_bbox[2] - c_bbox[0], c_bbox[3] - c_bbox[1]
            pad = 10
            badge_x = badge_x - c_w - pad*2
            
            draw.rounded_rectangle(
                [badge_x, badge_y, badge_x + c_w + pad*2, badge_y + c_h + pad*2],
                radius=5,
                fill=white
            )
            draw.text((badge_x + pad, badge_y + pad), category, fill=blue, font=badge_font)
            badge_x -= 12
        
        if is_premium:
            premium_text = "PREMIUM"
            p_bbox = draw.textbbox((0, 0), premium_text, font=badge_font)
            p_w, p_h = p_bbox[2] - p_bbox[0], p_bbox[3] - p_bbox[1]
            pad = 10
            badge_x = badge_x - p_w - pad*2
            
            draw.rounded_rectangle(
                [badge_x, badge_y, badge_x + p_w + pad*2, badge_y + p_h + pad*2],
                radius=5,
                fill=coral
            )
            draw.text((badge_x + pad, badge_y + pad), premium_text, fill=white, font=badge_font)
        
        # --- TITLE (larger for mobile readability) ---
        wrapped_title = textwrap.fill(title, width=32)
        title_lines = wrapped_title.split('\n')[:3]  # Max 3 lines
        
        title_line_height = 62
        title_start_y = 150
        
        for i, line in enumerate(title_lines):
            draw.text((50, title_start_y + i * title_line_height), line, fill=white, font=title_font)
        
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
                "Content-Disposition": f"inline; filename={slug}-og.png"
            }
        )
        
    except Exception as e:
        logger.error(f"OG image generation error for {slug}: {e}")
        return RedirectResponse(
            url=f"https://the-state-of-play.ghost.io/content/images/2026/02/rcb-rr-bid-story.png",
            status_code=302
        )

# OG Meta endpoint for social sharing
@api_router.get("/og/{slug}")
async def get_og_meta(slug: str, request: Request):
    """Serve Open Graph meta tags for social media crawlers"""
    import httpx
    from fastapi.responses import HTMLResponse, RedirectResponse
    
    user_agent = request.headers.get('user-agent', '').lower()
    bot_patterns = ['whatsapp', 'facebookexternalhit', 'facebot', 'twitterbot', 
                    'linkedinbot', 'slackbot', 'telegrambot', 'discordbot', 'pinterest']
    
    is_bot = any(bot in user_agent for bot in bot_patterns)
    
    # For non-bots, redirect to the actual page
    if not is_bot:
        return RedirectResponse(url=f"https://www.stateofplay.club/{slug}", status_code=301)
    
    try:
        # Fetch article from Ghost
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GHOST_URL}/ghost/api/content/posts/slug/{slug}/",
                params={'key': GHOST_CONTENT_API_KEY, 'include': 'authors'}
            )
            
            if response.status_code != 200:
                return RedirectResponse(url=f"https://www.stateofplay.club/{slug}", status_code=301)
            
            data = response.json()
            article = data.get('posts', [{}])[0] if data.get('posts') else None
            
            if not article:
                return RedirectResponse(url=f"https://www.stateofplay.club/{slug}", status_code=301)
        
        # Extract metadata
        title = article.get('title', 'The State of Play')
        description = article.get('custom_excerpt') or article.get('excerpt') or "India's premium sports business publication"
        # Use original feature image from Ghost
        image = article.get('feature_image') or 'https://the-state-of-play.ghost.io/content/images/2026/02/rcb-rr-bid-story.png'
        article_url = f"https://www.stateofplay.club/{slug}"
        author = article.get('primary_author', {}).get('name', 'The State of Play') if article.get('primary_author') else 'The State of Play'
        published_time = article.get('published_at', '')
        
        # Escape HTML
        def escape_html(text):
            if not text:
                return ''
            return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#039;')
        
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape_html(title)} | The State of Play</title>
  <meta name="description" content="{escape_html(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{article_url}">
  <meta property="og:title" content="{escape_html(title)}">
  <meta property="og:description" content="{escape_html(description)}">
  <meta property="og:image" content="{image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="The State of Play">
  <meta property="article:published_time" content="{published_time}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape_html(title)}">
  <meta name="twitter:description" content="{escape_html(description)}">
  <meta name="twitter:image" content="{image}">
</head>
<body>
  <h1>{escape_html(title)}</h1>
  <p>{escape_html(description)}</p>
  <p><a href="{article_url}">Read the full article</a></p>
</body>
</html>'''
        
        return HTMLResponse(content=html, status_code=200)
        
    except Exception as e:
        logging.error(f"OG meta error for {slug}: {e}")
        return RedirectResponse(url=f"https://www.stateofplay.club/{slug}", status_code=301)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
