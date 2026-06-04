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

### Mockup Redesign (`/mockup/*`) — Editorial Aesthetic
- [x] All 10 mockup surfaces rebuilt in dense WSJ/FT/Information style (Feb 2026)
- [x] Font system locked: **Fraunces** (headlines) × **Newsreader** (article body + deks) × **Geist** (UI)
- [x] Headline colour-lock CSS rule (`.headline-lock`) prevents visited/hover link colour leaking into list/archive/sidebar/grid headlines
- [x] LeftField page: secondary brief added beneath lead to balance left column, envelope icon removed, redundant global footer CTA suppressed via `hideFooterHeroCta` prop
- [x] MockupFooter: copy locked ("…Money, media, ownership, and power, from Bengaluru.") in Geist, location simplified to "Bengaluru", italic tagline at `#AAAAAA` contrast
- [x] **Round 3 — full design-system pass (Feb 2026)**
  - [x] Light + dark colour tokens (CSS vars): `--bg`, `--surface`, `--rule`, `--text`, `--text-muted`, `--text-label`, `--accent-blue`, `--accent-burgundy`, `--nav-bg`, `--footer-bg`
  - [x] Dark mode toggle in `MockupHeader` (Sun/Moon), system preference default, 200ms transitions
  - [x] Subscribe button: burgundy `#A0291C`, white text, sharp 0 radius, 48px height
  - [x] Homepage dateline: Geist 14px `#444444`, "No. X · Year Two" with X wired to live Ghost post count
  - [x] Briefing rail: "THE LEFT FIELD" / "FREE" header (no italic), data pulled from `/api/substack/feed`
  - [x] Article page: max-width 680px, Newsreader 17/1.75 light · 1.8 dark, S/M/L font-size toggle with `localStorage`, share row (X · LinkedIn · WhatsApp · Copy link), reading progress bar (burgundy, 3px), "MORE ON THIS TOPIC" related strip
  - [x] Paywall block: gradient fade + Fraunces "This edition is for members." + 1,850-readers ₹2,499 line + burgundy Subscribe + blue Sign-in link
  - [x] BackToTop restyled to "↑ TOP" text on mockup routes only (live unchanged)
  - [x] Homepage: "WHAT READERS SAY" testimonial block (2 placeholder quotes, prev/next), "PARTNERS" block with Sportz Interactive as Associate Partner
  - [x] Teams pricing fixed: Team-5 ₹11,800 / Team-10 ₹23,600, "GST inclusive", "Best value" badge, Razorpay links, "Members-only events" replaces "Breaking news alerts", FAQ updated
  - [x] Member dashboard: solid `#E5E2DC` stats dividers, Notifications row → "New editions"
  - [x] About editor's note copy updated, Outfield description copy updated
- [x] **Round 4 — DM Sans + new paywall + new surfaces (Feb 2026)**
  - [x] **DM Sans** swapped in as the UI font (replacing Geist); Fraunces × Newsreader × DM Sans now locked
  - [x] **Paywall rebuilt** as typographic continuation (no card/shadow, 2px top rule, 100px fade, geo-IP via `/api/geo/location` switching India ₹2,499+GST / International $120). "Already a member? Sign in →" secondary CTA. "Payments secured by Razorpay" on India only.
  - [x] **Left Field sidebar (Fix 12) final**: "The Briefing" italic left + "THE LEFT FIELD · FREE" (FREE burgundy) right; date-only labels; Fraunces 18px headlines
  - [x] **Teams pricing display** (Fix 20): "₹10,000 + 18% GST / year" with "₹11,800 / year total" below; "Save ₹X vs individual (before GST)"
  - [x] **Account dashboard** (Fix 24): Last invoice ₹2,949 · Razorpay; Next charge ₹2,949
  - [x] **New surfaces** mocked: Partnerships, Contact, Terms, Privacy, custom 404 — all sharing the design system
- [x] **Round 6 — LIVE CUT-OVER (Feb 2026)**
  - [x] Mockup components renamed/aliased into live page exports in `App.js`
  - [x] All URLs preserved exactly — `/signup` (QR card), `/teams`, `/about`, `/outfield`, `/left-field`, `/state-of-play`, `/login`, `/account`, `/partnerships`, `/contact`, `/terms`, `/privacy`, `/:slug` for articles
  - [x] Legacy `/membership` → /signup, `/archive` → state-of-play feed, `/welcome` & `/dashboard` → /account (avoids two design systems)
  - [x] `LoginMockup` wired to real `AuthContext.verifyMember()`, redirects to `/account` on success
  - [x] `AccountMockup` reads real `user`, `canAccessPremium`, `logout` — gated route (redirects to `/login` if not signed in)
  - [x] All internal nav swapped from `/mockup/*` → live URLs
  - [x] Article fallback uses `NotFoundMockup`
  - [x] Razorpay reverted to native button (clicks work)
  - [x] `/mockup` index retained for future design previews
- [ ] Final user sign-off → rollout to live routes
- [ ] **Deferred**: Ghost native comments integration (user choice — future ship). Current state: non-members see "Comments are for members. Subscribe to join the conversation." CTA on article page.

### Round 7 — Self-serve GST tax invoice (Feb 2026)
- [x] Backend: `POST /api/invoice/generate` returns a GST-compliant PDF (reportlab + num2words). Verifies paid member against Ghost Admin API (label `paid-via-razorpay`, status `paid|comped`, or active subscription). Atomic per-FY invoice counter persisted in `db.invoice_counters`; issued invoices recorded in `db.invoices` and reused on subsequent requests for the same buyer/payment ref. Currency rendered as `Rs.` (Helvetica lacks ₹ glyph). Karnataka → 9% CGST + 9% SGST; other Indian states → 18% IGST; international → 0% (export of services).
- [x] Frontend: `InvoiceRequestModal` (business/individual toggle, GSTIN validation against state prefix, 37 Indian states, international export option, blob → file download) wired into the Account page **Billing** row for paid members (replaces the old mailto fallback).
- [x] E2E verified: login → /account → "Need GST invoice? Download →" → modal → submit → `application/pdf` 200 served by backend.

## Pending / Next
- [ ] Device Lock — limit logins to 2 devices per account
- [ ] PWA (manifest + service worker)
- [ ] "Insider Drops" subscriber-only feed
- [ ] Reading list / bookmarks
- [ ] Next.js App Router migration
- [ ] Cleanup: delete orphaned legacy pages (Home.js, ArticlePage.js, Signup.js, etc. — superseded by `*Mockup.js` after the live cut-over)

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
