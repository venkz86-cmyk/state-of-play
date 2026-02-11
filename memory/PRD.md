# The State of Play - Premium Content Platform

## Latest Updates (Feb 11, 2026)
- **Dynamic OG Share Cards**: Auto-generated branded cards for social sharing with PREMIUM badge + category
- **Member Dashboard**: New `/account` page showing subscription dates, status, benefits
- **Newsletter & CTA visibility fix**: Hidden for logged-in paid members
- **Login Button visibility**: Made visible on mobile header

## Original Problem Statement
Premium sports content platform with Ghost CMS integration, member verification, and secure paywall.

## Architecture
- **Frontend**: React app hosted on Vercel (stateofplay.club)
- **Backend**: FastAPI on Render (handles Ghost Admin API calls)
- **CMS**: Ghost (headless, Content API + Admin API)

## Key Files
- `frontend/src/pages/MemberDashboard.js` - Member account/subscription dashboard
- `frontend/src/components/Header.js` - Navigation, auth state display
- `frontend/src/components/NewsletterSignup.js` - Newsletter CTA (hidden for logged-in users)
- `frontend/src/contexts/AuthContext.js` - Auth state management
- `backend/server.py` - Member verification, content fetching, OG image generation

## API Endpoints
- `POST /api/ghost/verify-member` - Verify member status
- `POST /api/ghost/member-details` - Get full member details including subscription dates
- `POST /api/ghost/article-content` - Get full paid article content
- `GET /api/og-image/{slug}` - Generate dynamic branded OG image for social sharing
- `GET /api/og/{slug}` - OG meta tags HTML for social crawlers

## Completed Features
- [x] Dark mode across all pages
- [x] Member verification via Ghost Admin API
- [x] Secure paywall for paid content
- [x] SEO-friendly URLs (/:slug)
- [x] Dynamic branded OG cards for social sharing
- [x] Welcome back toast notification
- [x] Mobile Login button visibility
- [x] Hide CTAs for paid members
- [x] Member Dashboard with subscription info

## Backlog
- [ ] Hero section personalization for logged-in users
- [ ] Reading tracking system
- [ ] Table of Contents for long articles (P1)
- [ ] Bookmarks/reading list (P1)
- [ ] Print-friendly view (P1)
- [ ] Audio version - TTS (P2)
- [ ] Highlight & share quotes (P2)
