# The State of Play - Product Requirements Document

## Original Problem Statement
Build a premium content website for sports business intelligence with a focus on Indian sports market. The platform should serve investors, leagues, and agencies with deep-dive analysis, exclusive insights, and untold stories.

## Architecture
- **Frontend**: React (Create React App) hosted on Vercel
- **Backend**: Python FastAPI hosted on Render
- **CMS**: Ghost (Headless)
- **DNS/CDN**: Cloudflare (with Workers for dynamic OG tags)
- **Payments**: Razorpay
- **Corporate Subscriptions Backend**: Google Apps Script + Google Sheets

## What's Been Implemented

### Core Features (Complete)
- [x] Ghost CMS integration for content
- [x] Premium/Free article distinction
- [x] Reading history tracking
- [x] Newsletter signup
- [x] Razorpay payment integration
- [x] User authentication (JWT)
- [x] Dynamic OG link previews via Cloudflare Worker

### Subscribe Page (Complete - Mar 2026)
- [x] Hero + value proposition section
- [x] Improved pricing box with email notice
- [x] Social proof (Bloomberg, SportBusiness, ESPNCricinfo, The Athletic, SportsPro)
- [x] 8 benefit cards with icons
- [x] Recent Premium Analysis (real articles from Ghost)
- [x] Who Reads TSOP (3 reader personas)
- [x] Accordion FAQ
- [x] Final CTA with scroll-to-pricing

### Corporate Subscriptions (Complete - Mar 2026)
- [x] Google Apps Script backend with all endpoints
- [x] /teams sales page (Team-5, Team-10 pricing)
- [x] /teams/manage dashboard with token authentication
- [x] Header "For Teams" dropdown
- [ ] Razorpay payment links (user task)
- [ ] Zapier automation (user task)

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
- [x] Logo with white card treatment
- [x] Removed search button (⌘K still works)

### Content Updates (Complete)
- [x] Homepage hero tagline
- [x] About page: "About The State of Play" title in blue
- [x] About page investor value proposition
- [x] Removed RedBird Capital reference
- [x] Fixed SportBusiness spelling
- [x] Meta tags for SEO

## Pending Items

### P1 - User Tasks (Before Deploy)
- [ ] Create Razorpay payment links for Team-5 (₹10K) and Team-10 (₹20K)
- [ ] Set up Zapier: Razorpay → Apps Script create_account
- [ ] Test end-to-end corporate subscription flow

### P2 - Upcoming Features
- [ ] Bookmarks/Reading list for subscribers
- [ ] "Insider Drops" - Subscriber-only private intel feed

### P3 - Future/Backlog
- [ ] Reading progress bar
- [ ] Estimated read time
- [ ] Contact for Enterprise page

## Key Endpoints

### FastAPI Backend (Render)
- `GET /api/og/{slug}` - Dynamic OG meta tags for Cloudflare Worker
- `POST /api/razorpay/webhook` - Payment webhook handler
- `GET /api/health` - Health check

### Google Apps Script (Corporate Subscriptions)
- `GET /exec?token={token}` - Load dashboard data
- `POST /exec` action: "create_account" - Create corporate account (Zapier)
- `POST /exec` action: "add_member" - Add team member
- `POST /exec` action: "remove_member" - Remove team member

## Test Credentials
- Paid Member: `venkz86@gmail.com`
- Admin Member: `venkat@stateofplay.club`

## Files of Reference
- `/app/cloudflare-worker.js` - OG preview solution
- `/app/corporate-subscriptions/apps-script-backend.js` - Full Apps Script code
- `/app/frontend/src/pages/Signup.js` - New comprehensive subscribe page
- `/app/frontend/src/pages/Teams.js` - Corporate sales page
- `/app/frontend/src/pages/TeamsManage.js` - Corporate dashboard
- `/app/frontend/src/components/Header.js` - Updated with For Teams dropdown
- `/app/frontend/src/index.css` - Global styles & CSS variables

## Corporate Subscriptions Tech Stack
- **Database**: Google Sheets (accounts + members tabs)
- **Backend**: Google Apps Script (deployed as web app)
- **Auth**: Token-based (dashboard_token in URL)
- **Ghost Integration**: JWT auth, create/delete members with labels
- **Payment**: Razorpay payment links → Zapier → Apps Script
