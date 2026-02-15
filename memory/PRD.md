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

### Content Updates (Complete)
- [x] Homepage hero tagline
- [x] About page investor value proposition
- [x] Meta tags for SEO

## Pending Items

### P1 - User Verification
- [ ] Razorpay post-payment redirect to `/welcome`
- [ ] End-to-end subscription test transaction

### P2 - Upcoming Features
- [ ] "Insider Drops" - Subscriber-only private intel feed
- [ ] Contact for Enterprise page

### P3 - Future/Backlog
- [ ] Bookmarks/Reading list
- [ ] Reading progress bar
- [ ] Estimated read time
- [ ] Copy Quote button
- [ ] Members-only comments

## Key Endpoints
- `GET /api/og/{slug}` - Dynamic OG meta tags for Cloudflare Worker
- Ghost Content API for articles

## Test Credentials
- Paid Member: `venkz86@gmail.com`
- Admin Member: `venkat@stateofplay.club`

## Files of Reference
- `/app/cloudflare-worker.js` - OG preview solution
- `/app/frontend/src/index.css` - Global styles & CSS variables
- `/app/frontend/src/components/ArticleCard.js` - Article card component
- `/app/frontend/src/pages/Home.js` - Homepage layout
- `/app/frontend/src/pages/About.js` - About page content
