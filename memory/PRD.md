# The State of Play - Product Requirements Document

## Overview
Premium sports business publication website with React frontend (Vercel), FastAPI backend (Render), and Ghost CMS.

## Core Features Implemented

### Authentication & Access
- Custom auth flow verifying paid status against Ghost
- Member login with JWT tokens
- Member Dashboard (`/account`) showing subscription details
- Streamlined new subscriber onboarding via Razorpay webhook (pending user config)

### Content Delivery
- Ghost CMS integration for articles
- Paywall for premium content
- Reading history tracking
- Article search functionality

### UI/UX
- Responsive header with navigation icons:
  - The State of Play → ★ (premium)
  - The Left Field → ✉️ (newsletter)
  - The Outfield → 📅 (events) + "Soon" badge
- Personalized homepage for logged-in subscribers
- Dark/light mode toggle
- Mobile-responsive design

### SEO & Social Sharing
- **Dynamic OG tags via Cloudflare Worker** (NEW - Feb 2026)
  - Article shares show correct title, description, and image
  - Works on LinkedIn, Twitter, WhatsApp, Facebook
  - Requires domain DNS through Cloudflare (configured)
- Updated meta descriptions for homepage
- Dual hero taglines on homepage

### About Page
- "Why Global Sports Investors Read The State of Play" section
- Problem/solution framing for investor audience
- Reader list (Premier League groups, PE/VC, sports funds, etc.)
- "Cited by" credibility markers (ESPNCricinfo, The Athletic, SportsPro)

## Technical Architecture

```
/app
├── backend/
│   ├── server.py         # FastAPI with Ghost integration, OG endpoints, webhooks
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # Header.js with nav icons
│   │   ├── pages/        # Home, About, ArticlePage, MemberDashboard, WelcomePage
│   │   └── contexts/     # AuthContext, ThemeContext
│   ├── public/index.html # Static OG tags for homepage
│   └── vercel.json
└── cloudflare-worker.js  # Dynamic OG tag worker script
```

## External Services
- **Ghost**: Headless CMS (Content API & Admin API)
- **Razorpay**: Payment processing with webhooks
- **Vercel**: Frontend hosting
- **Render**: Backend hosting ($7/mo plan)
- **Cloudflare**: DNS proxy + Workers for OG tags (Free tier)
- **Google Analytics**: Site analytics

## Pending User Actions
1. Add `RAZORPAY_WEBHOOK_SECRET` to Render backend
2. Set Razorpay post-payment redirect URL to `https://stateofplay.club/welcome`
3. Deploy changes via "Save to GitHub"

## Backlog / Future Tasks

### P1 - High Priority
- [ ] "Insider Drops" / Private Notes feature for subscribers
- [ ] Custom branded OG image for homepage (designer needed)
- [ ] Contact for Enterprise page

### P2 - Medium Priority
- Reading experience enhancements:
  - Reading progress bar
  - Estimated read time
  - Table of contents for long articles
  - Bookmarks/reading list
- "Copy Quote" sharing feature
- Members-only comments section

### P3 - Low Priority
- Corporate subscriptions (full implementation)
- Reading history improvements

## Credentials (for testing)
- Paid Member: `venkz86@gmail.com`
- Admin Member: `venkat@stateofplay.club`

## Changelog
- **Feb 15, 2026**: Cloudflare Worker setup for dynamic OG tags, header icons added, About page investor section, hero taglines updated
- **Feb 14, 2026**: Member dashboard, welcome page, Razorpay webhook integration
- **Earlier**: Core site build, Ghost integration, paywall, auth system
