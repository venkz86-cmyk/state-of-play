# The State of Play - Product Requirements Document

## Original Problem Statement
Build a premium content website for sports business intelligence with a focus on Indian sports market. The platform should serve investors, leagues, and agencies with deep-dive analysis, exclusive insights, and untold stories.

## Architecture
- **Frontend**: React (Create React App) hosted on Vercel
- **Backend**: Python FastAPI hosted on Render
- **CMS**: Ghost (Headless)
- **DNS/CDN**: Cloudflare (with Workers for dynamic OG tags)
- **Payments**: Razorpay

## What's Been Implemented

### Core Features (Complete)
- [x] Ghost CMS integration for content
- [x] Premium/Free article distinction
- [x] Reading history tracking
- [x] Newsletter signup
- [x] Razorpay payment integration
- [x] User authentication (JWT)
- [x] Dynamic OG link previews via Cloudflare Worker

### UI/UX (Complete)
- [x] Responsive design
- [x] Dark mode toggle
- [x] Font size toggle
- [x] Premium texture overlay
- [x] Header icons (Mail, Calendar)
- [x] Twitter → X logo update
- [x] Warmer off-white background
- [x] Increased article card spacing
- [x] Card lift-on-hover effect
- [x] "About The State of Play" page title in blue

### Subscribe Page (Complete - Feb 2026)
- [x] Hero + value proposition section
- [x] Improved pricing box with email notice
- [x] Social proof (Bloomberg, SportBusiness, ESPNCricinfo, The Athletic, SportsPro)
- [x] 8 benefit cards with icons
- [x] Recent Premium Analysis (real articles from Ghost)
- [x] Who Reads TSOP (3 reader personas)
- [x] Accordion FAQ
- [x] Final CTA with scroll-to-pricing

### Content Updates (Complete)
- [x] Homepage hero tagline
- [x] About page investor value proposition
- [x] Meta tags for SEO
- [x] Removed RedBird Capital reference
- [x] Fixed SportBusiness spelling

## Pending Items

### P1 - User Verification
- [ ] Razorpay post-payment redirect to `/welcome`
- [ ] End-to-end subscription test transaction

### P2 - Upcoming Features (March 2026)
- [ ] Corporate Subscriptions (spec saved: TSOP-Corporate-Subscriptions-Spec.docx)
  - Dashboard HTML at `/teams/manage`
  - Sales page at `/teams`
  - Google Sheets + Apps Script backend
  - Razorpay payment links for Team-5, Team-10

### P3 - Future/Backlog
- [ ] "Insider Drops" - Subscriber-only private intel feed
- [ ] Bookmarks/Reading list
- [ ] Reading progress bar
- [ ] Contact for Enterprise page

## Key Endpoints
- `GET /api/og/{slug}` - Dynamic OG meta tags for Cloudflare Worker
- Ghost Content API for articles

## Test Credentials
- Paid Member: `venkz86@gmail.com`
- Admin Member: `venkat@stateofplay.club`

## Files of Reference
- `/app/cloudflare-worker.js` - OG preview solution
- `/app/frontend/src/index.css` - Global styles & CSS variables
- `/app/frontend/src/pages/Signup.js` - New comprehensive subscribe page
- `/app/frontend/src/components/ArticleCard.js` - Article card component
- `/app/frontend/src/pages/Home.js` - Homepage layout
- `/app/frontend/src/pages/About.js` - About page content

## Corporate Subscriptions Spec (Saved for March)
- Location: TSOP-Corporate-Subscriptions-Spec.docx
- Tech: Google Sheets + Apps Script + Razorpay
- Tiers: Team-5 (₹10K), Team-10 (₹20K), Business, Enterprise
- Timeline: Soft launch March, hard launch April 2026
