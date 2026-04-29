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

### Corporate Subscriptions (Complete - Apr 2026)
- [x] Google Apps Script backend with all endpoints
- [x] /teams sales page (Team-5 ₹10K, Team-10 ₹20K)
- [x] /teams/manage dashboard with token authentication
- [x] Header "For Teams" dropdown
- [x] Razorpay payment links integrated
- [x] Zapier automation configured

### The Outfield - Events (Complete - Apr 2026)
- [x] /outfield page with intro, event cards, schedules
- [x] Roundtables: May Mumbai confirmed + Register link (Luma)
- [x] Speakeasy: June Bengaluru, November New Delhi (tentative)
- [x] /partnerships page for sponsors (footer link only)
- [x] Contact form to venkat@ and prerna@

### UI/UX (Complete)
- [x] Responsive design
- [x] Dark mode toggle
- [x] Font size toggle
- [x] Warmer off-white background
- [x] Card hover effects
- [x] Logo with white card treatment
- [x] Footer with Outfield + Partnerships links

## Pending Items

### Reminder: Later This Week
- [ ] Create dedicated event page `/outfield/mumbai-may-2026`
  - Sportz Interactive partner branding
  - Luma embed
  - Full event details

### Future/Backlog
- [ ] Bookmarks/Reading list for subscribers
- [ ] "Insider Drops" - Subscriber-only private intel feed
- [ ] Premium design overhaul (when ready)

## Key URLs
- Teams Sales: `/teams`
- Team Dashboard: `/teams/manage?token={token}`
- Outfield Events: `/outfield`
- Partnerships: `/partnerships`
- Luma Event: `https://lu.ma/8xh1try1`

## Key Endpoints

### Google Apps Script (Corporate Subscriptions)
- `GET /exec?token={token}` - Load dashboard data
- `POST /exec` action: "create_account" - Create corporate account (Zapier)
- `POST /exec` action: "add_member" - Add team member
- `POST /exec` action: "remove_member" - Remove team member

## Test Credentials
- Paid Member: `venkz86@gmail.com`
- Admin Member: `venkat@stateofplay.club`

## Files of Reference
- `/app/corporate-subscriptions/apps-script-backend.js` - Full Apps Script code
- `/app/frontend/src/pages/Teams.js` - Corporate sales page
- `/app/frontend/src/pages/TeamsManage.js` - Corporate dashboard
- `/app/frontend/src/pages/Outfield.js` - Events page
- `/app/frontend/src/pages/Partnerships.js` - Sponsor page
- `/app/frontend/src/pages/Signup.js` - Subscribe page
- `/app/frontend/src/components/Header.js` - With For Teams dropdown
- `/app/frontend/src/components/Footer.js` - With Partnerships link
