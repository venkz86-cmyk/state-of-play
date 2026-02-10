# The State of Play - Product Requirements Document

## Original Problem Statement
Build a premium, sophisticated website for a sports business publication called "The State of Play" using Ghost CMS as a headless backend with a custom React frontend featuring geo-based pricing and Razorpay payment integration.

## Core Requirements

### Content & CMS
- **Ghost CMS**: Using existing instance at `the-state-of-play.ghost.io` as headless CMS
- **Content API Key**: `a9be7f9fb8a0b1ef144d56ed8f`
- **The State of Play**: Premium, paid articles from Ghost
- **The Left Field**: Free articles from Substack RSS (`theleftfield.substack.com/feed`)
- **The Outfield**: Coming Soon page for future events vertical

### Authentication
- Ghost Members API via magic links (passwordless)
- Flow: User subscribes → Zapier creates Ghost member → Ghost sends magic link → User clicks to authenticate

### Payments
- **Razorpay Payment Buttons** (user's existing setup)
- India Button ID: `pl_ROAFZZjAvjHhfQ` (₹2,499/year + GST)
- International Button ID: `pl_ROAIM0inFWbpC2` ($120/year)
- Flow: Razorpay payment → Zapier webhook → Creates Ghost member → Magic link sent

### Geo-Based Pricing
- Automatic country detection via `/api/geo/location` backend proxy
- Shows ₹2,499/year for India users
- Shows $120/year for international users

### Paywall
- Hard paywall synced with Ghost's `<!--more-->` tag
- Preview content shown before paywall
- Razorpay subscribe button in paywall

## Technical Architecture

```
Frontend (React)
├── Pages: Home, StateOfPlay, LeftField, Outfield, About, Contact, Login, Signup, Dashboard, ArticlePage
├── Components: RazorpayButton, Header, ArticleCard
├── Hooks: useGeoPricing (geo detection), useRazorpayPayment
├── Services: ghostAPI (content fetching)
└── Contexts: AuthContext

Backend (FastAPI)
├── /api/geo/location - Geo-location proxy
├── /api/substack/feed - Substack RSS proxy
├── /api/ghost/send-magic-link - Ghost auth proxy
└── /api/ghost/member - Member status proxy
```

## What's Been Implemented

### ✅ Completed (February 2026)
1. **Premium Frontend Design** - Unique, bold design for The State of Play
2. **Ghost CMS Integration** - Articles, authors, tags fetched from Content API
3. **Substack RSS Integration** - Backend proxy fetches Left Field content
4. **Geo-Based Pricing** - Backend proxy for IP detection, dynamic pricing display
5. **Razorpay Payment Buttons** - Embedded payment buttons (not react-razorpay library)
6. **Paywall System** - Hard paywall on premium articles with fade effect
7. **Login Flow** - Email entry with instructions for Ghost magic link access
8. **All Core Pages** - Home, State of Play, Left Field, Outfield, About, Contact, Membership, Signup, Login

### 🔄 Partially Implemented
1. **Ghost Members Authentication** - Login UI complete, direct API call blocked by Ghost CORS. Works via Ghost Portal redirect.

## Backlog / Future Tasks

### P1 - High Priority
1. **Deployment to Vercel** - Deploy with custom domain (stateofplay.club)
2. **Ghost CORS Configuration** - Configure Ghost to allow API calls from custom domain
3. **Session Handling** - After deploying, implement proper session handling for authenticated users

### P2 - Medium Priority
1. **Ghost Comments Integration** - Display native Ghost comments on articles
2. **Member Dashboard** - Show subscription status for authenticated members

### P3 - Low Priority
1. **Testimonial Section** - Add testimonials on homepage or membership page
2. **SEO Optimization** - Meta tags, structured data for articles

## Key Technical Notes

### Razorpay Integration
- Using embedded payment buttons, NOT react-razorpay library (was causing React 19 compatibility issues)
- Scripts load dynamically via `RazorpayButton` component
- Modal opens when user clicks the rendered Razorpay button

### Ghost API Limitations
- Ghost Members API (`/members/api/*`) requires proper CORS setup on Ghost side
- Magic link sending works natively from Ghost's domain
- For headless setup, users are directed to Ghost Portal for authentication

### Environment Variables
```
# Frontend (.env)
REACT_APP_BACKEND_URL=<deployment-url>
REACT_APP_GHOST_URL=https://the-state-of-play.ghost.io
REACT_APP_GHOST_CONTENT_API_KEY=a9be7f9fb8a0b1ef144d56ed8f

# Backend (.env)
GHOST_URL=https://the-state-of-play.ghost.io
```

## Deployment Checklist

1. **Vercel Deployment**
   - Connect GitHub repository
   - Set environment variables
   - Configure build settings for React app

2. **Custom Domain (stateofplay.club)**
   - Add domain in Vercel
   - Update DNS records
   - SSL will be automatic

3. **Ghost Configuration (After Deployment)**
   - Add custom domain to Ghost's allowed origins
   - Update portal settings for redirect URLs

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial testing, found Dashboard Razorpay error
- `/app/test_reports/iteration_2.json` - All tests passing (100% success rate)
