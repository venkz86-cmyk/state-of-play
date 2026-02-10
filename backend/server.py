from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import razorpay

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7

razorpay_client = razorpay.Client(auth=(os.environ.get('RAZORPAY_KEY_ID'), os.environ.get('RAZORPAY_KEY_SECRET')))

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

class MagicLinkRequest(BaseModel):
    email: EmailStr

@api_router.post("/ghost/send-magic-link")
async def send_ghost_magic_link(request: MagicLinkRequest):
    """Proxy endpoint to send Ghost magic link"""
    import httpx
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                f'{GHOST_URL}/members/api/send-magic-link/',
                json={
                    'email': request.email,
                    'emailType': 'signin'
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 201 or response.status_code == 200:
                return {"success": True, "message": "Magic link sent successfully"}
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                error_message = error_data.get('errors', [{}])[0].get('message', 'Failed to send magic link')
                raise HTTPException(status_code=response.status_code, detail=error_message)
    except httpx.RequestError as e:
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
