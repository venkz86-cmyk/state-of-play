# The State of Play — Repo Handover

_Last updated: 2026-08-26. Owner: Venkat Ananth. Editor of `stateofplay.club`._

Read this end-to-end before touching the code. It's the single source of truth for architecture, live vs dead files, environment variables, deploy topology, and quirks that will bite you if you skim.

---

## 1. What this is

Full-stack app for **stateofplay.club** — a weekly subscription publication on the business of Indian sport. Ghost is the headless CMS + auth source; the React frontend renders reading pages; the FastAPI backend proxies Ghost, generates GST invoices + OG images, runs the paywall and the reader-to-reader nomination/gift system.

## 2. Stack

```
Frontend  →  React 19 (CRA), Tailwind, shadcn/ui, react-router     →  Vercel
Backend   →  FastAPI + Uvicorn, MongoDB Atlas                       →  Render
CMS/Auth  →  Ghost (hosted at the-state-of-play.ghost.io)
Payments  →  Razorpay (India ₹ + international $)
Webhooks  →  Google Apps Script (nominee emails, Slack ops, Sheet log)
Analytics →  PostHog + GA4
```

## 3. Deployment topology (order-sensitive!)

```
User → Cloudflare (in front of stateofplay.club)
     → Vercel (frontend/vercel.json rewrites)
          ├─ /api/*                              → Render backend
          ├─ /s/:token                           → Render /api/shared/:token   (cold link SSR)
          ├─ /sitemap.xml, /robots.txt           → Render
          ├─ /:slug  + search-bot UA             → Render /api/story/:slug     (full HTML + JSON-LD)
          ├─ /:slug  + social-bot UA             → Render /api/og/:slug        (OG-tag stub)
          └─ everything else                     → /index.html                 (SPA)
```

Search-bot UA regex: `googlebot|bingbot|yandexbot|duckduckbot|applebot|baiduspider|ia_archiver|mj12bot|semrushbot|ahrefsbot`
Social-bot UA regex: `whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|skypeuripreview|embedly|instagram|redditbot|vkshare`

**Do not merge these into one rewrite.** Search bots MUST hit `/api/story/:slug` for full body content — the earlier merged rewrite sent Googlebot to the 3.9 KB stub, which killed indexing for months. Fix landed Aug 2026.

## 4. Frontend routes → live components

Every live page lives in `frontend/src/pages/*Mockup.js`. App.js imports each with an `as` alias so route names read cleanly:

```js
import { HomeMockup as Home }         from "./pages/HomeMockup";
import { AccountMockup as MemberDashboard } from "./pages/AccountMockup";
```

| Route | Component | File |
|-------|-----------|------|
| `/` | Home | pages/HomeMockup.js |
| `/state-of-play` | StateOfPlay | pages/FeedMockup.js |
| `/left-field` | LeftField | pages/LeftFieldMockup.js |
| `/archive` | Archive | pages/Archive.js |
| `/outfield` | Outfield | pages/OutfieldMockup.js |
| `/login` | Login | pages/LoginMockup.js |
| `/signup`, `/membership` | Signup | pages/SubscribeMockup.js |
| `/dashboard`, `/account`, `/welcome` | MemberDashboard | pages/AccountMockup.js |
| `/about` | About | pages/AboutMockup.js |
| `/contact` | Contact | pages/ContactMockup.js |
| `/terms` | Terms | pages/TermsMockup.js |
| `/privacy` | Privacy | pages/PrivacyMockup.js |
| `/teams` | Teams | pages/TeamsMockup.js |
| `/teams/manage` | TeamsManage | pages/TeamsManage.js |
| `/teams/login` | TeamsLogin | pages/TeamsLogin.js |
| `/partnerships` | Partnerships | pages/PartnershipsMockup.js |
| `/mockup`, `/mockup/*` | MockupIndex, InvoicePreviewMockup, TeamsEmailsMockup | design QA scratchpads — keep |
| `/:id` (catch-all) | ArticlePage | pages/ArticleMockup.js — **this is the article reader** |
| `*` | NotFound | pages/NotFoundMockup.js |

### Why files are called `*Mockup.js`
Cutover artifact from a redesign. The originals (Home.js, Login.js, etc.) got deleted in an Aug 2026 cleanup pass. The suffix on the live files is misleading but harmless — nothing about these is a mockup anymore. Renaming `*Mockup.*` → drop the suffix is a ~15-credit housekeeping commit that is worth doing when convenient.

## 5. Live components inventory (`frontend/src/components/`)

| File | Role |
|------|------|
| **MockupLayout, MockupHeader, MockupFooter, MockupBackToTop** | Global chrome — every page wraps in these |
| **SEO.js** | Imperative `document.head` manager (title, meta, canonical, JSON-LD). **Deliberately does NOT use react-helmet-async** — the project's `visual-edits` babel transform interferes with Helmet's context |
| **ArticleCard, RelatedArticles, ReadingHistory, ReadingProgress, ReadingTimeLeft** | Article page building blocks |
| **Paywall.js** | Subscriber gate — 180 px gradient fade + burgundy Lock badge + Razorpay CTA |
| **RazorpayButton.js** | Wraps Razorpay's native button; uses `hooks/useRazorpayPayment.js` + `hooks/useGeoPricing.js` |
| **NominateReaderBlock.js** | Reader-to-reader nomination form (subscriber-only) |
| **GiftArticleModal.js** | Same submit path as NominateReaderBlock, gift-focused copy, triggered from ShareRow Gift icon |
| **PrintInterceptBlock.js** | React portal that hijacks `@media print` — replaces printed article with nominate form + QR fallback |
| **ShareRow, ShareButtons, CopyQuote** | Social + share affordances. ShareRow has the Gift icon for subscribers |
| **MockupFontSizeToggle** + `useArticleSize` hook | S/M/L text-size toggle (17/18–19/22 px) |
| **ColdLinkAdminButton** | Manual cold-link generator, ADMIN_KEY gated |
| **InvoiceRequestModal, TeamInvoiceRequestModal** | Trigger GST invoice PDF generation |
| **NewsletterSignup, PartnersBlock, LegalLayout** | Marketing blocks |
| **contexts/AuthContext.js** | Ghost member auth state; localStorage key `tsop_member` |
| **contexts/ThemeContext.js** | Dark mode toggle |
| **services/ghostAPI.js, substackAPI.js** | Ghost Content API + Substack RSS fetchers |

## 6. Backend endpoints — `server.py` + `nominations.py`

### server.py
```
GET  /api/substack/feed              — proxy for TLF Substack RSS
GET  /api/geo/location               — geo-IP → country_code (Razorpay pricing)
POST /api/ghost/verify-member        — Ghost lookup + is_paid signal
POST /api/ghost/member-details       — account page data (subscription window)
POST /api/ghost/article-content      — SS Ghost fetch for gated posts
GET  /api/ghost/integrity-token      — Ghost bot-protection token pass-through
POST /api/ghost/send-magic-link      — Ghost's own magic-link endpoint
GET  /api/ghost/member               — session member lookup

GET  /api/og-image/{slug}            — Pillow PNG for social cards (1200×630)
GET  /api/og/{slug}                  — HTML stub with OG meta tags (social bots)
GET  /api/story/{slug}               — FULL SSR article (search bots + JSON-LD)  ← added Aug 2026

POST /api/razorpay/webhook           — payment success handler
POST /api/check-recent-payment       — post-payment login handoff

POST /api/invoice/generate           — GST invoice PDF (individual)
POST /api/invoice/generate-team      — GST invoice PDF (corporate teams)

GET  /api/sitemap.xml                — dynamic sitemap (Ghost posts + static routes)
GET  /api/robots.txt                 — static robots.txt with GSC-safe allowlist
GET  /api/health                     — healthcheck
```

### nominations.py
```
POST /api/nominations/submit         — creates story_token, emails nominee via Apps Script
GET  /api/nominations/quota          — remaining monthly nominations for a subscriber
POST /api/nominations/refund         — admin-only, ADMIN_KEY header, refunds one quota slot

GET  /api/story-token/validate/{t}   — cold-link resolver
POST /api/cold-link/generate         — admin creates a token
POST /api/cold-link/event            — analytics (open, signup, conversion)
POST /api/cold-link/expire-check     — nightly cron endpoint

GET  /s/{token}                      — SSR HTML for cold-linked article (bypasses paywall)
GET  /api/shared/{token}             — alias for /s/{token}, via Vercel rewrite
```

## 7. Environment variables

### backend/.env (Render prod uses same keys)
```
MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET
GHOST_URL, GHOST_ADMIN_API_KEY, GHOST_CONTENT_API_KEY
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
ADMIN_KEY                    ← for /cold-link/generate, /nominations/refund
APPS_SCRIPT_URL              ← Google Apps Script webhook (nominations → Sheet + Slack)
GSC_VERIFICATION_TOKEN       ← optional; injected into SSR HTML for Search Console
```

### frontend/.env (Vercel)
```
REACT_APP_BACKEND_URL        ← production Render URL
REACT_APP_GHOST_URL          ← used by services/ghostAPI.js
REACT_APP_GHOST_CONTENT_API_KEY
REACT_APP_GSC_TOKEN          ← rendered into public/index.html via %VAR% substitution
REACT_APP_GIFT_URL           ← optional, defaults to a mailto: link
WDS_SOCKET_PORT              ← preview env only
```

## 8. MongoDB collections

Only one meaningful collection. Everything else is fetched live from Ghost.

```js
story_tokens {
  token_id: str,             // UUID
  post_slug: str,
  token_type: 'cold-link' | 'nomination',
  subscriber_email: str,     // nominator
  subscriber_ghost_id: str,  // for quota attribution
  nominee_email: str,        // recipient
  nominee_name: str,
  nominee_context: str,      // optional personal note
  created_at: ISODate,
  expires_at: ISODate,       // 72h for nominations, 14d for cold links
  status: 'active' | 'expired',
  open_count: int,
  last_opened_at: ISODate
}
```

`recent_payments` also lives here as a short-term cache post-Razorpay checkout.

## 9. Design system (shipped, current)

- **Fonts:** Fraunces (display), Newsreader (reading serif), DM Sans (UI). Only 3 loaded via Google Fonts in `public/index.html`. Everything else is CSS fallback strings.
- **Colours:** CSS role tokens `--bg / --rule / --text / --text-muted / --text-label`. **Sole accent = burgundy `#A0291C`.** No blue, no orange (those only survive in the logo asset).
- **Grid:** 12-col asymmetric (8+4 lead/rail), hairline rules, no shadows, no rounded corners.
- **Article typography:** 19 px / 1.6 desktop · 18 px / 1.65 mobile · S/M/L toggle to 17/18-19/22 px.
- Full spec: `/app/design_guidelines.json` (rewritten Aug 2026 to match shipped code).

### Colour usage rule
Always prefer `text-[var(--text)]`, `text-[var(--text-muted)]`, `text-[var(--text-label)]`, `border-[var(--rule)]`, `bg-[var(--bg)]` over hardcoded hex — so dark/light mode swaps cleanly.

## 10. Third-party contracts — quirks that will bite you

- **Ghost Admin API**: uses JWT signing with a 5-min TTL. Members created via `/ghost/api/admin/members/`. A 422 response means "member exists" — code catches and looks up by email. Feature-image URLs use 301 redirects, so `httpx` calls MUST use `follow_redirects=True`.
- **Razorpay webhook**: signature verified via HMAC-SHA256, `RAZORPAY_WEBHOOK_SECRET`. Test key is in `.env`.
- **Apps Script webhook**: `httpx.post(APPS_SCRIPT_URL, json=payload)` — MUST use `json=payload`, NOT `httpx.json_dumps` (that attr doesn't exist on httpx ≥ 0.20; caused silent nomination-email failure for weeks in early 2026). Response is `text/html` (Google's 302 → 200 flow) — inspect `resp.status_code + resp.text[:200]` and log with `action=` prefix for grep-ability.
- **GSC**: verification meta tag rendered from `REACT_APP_GSC_TOKEN` via CRA `%VAR%` substitution in `public/index.html`.

## 11. Known bugs / open backlog

### Time-sensitive
- **Retire the ₹2,499 pre-Nov-1 Subscription Button by Oct 31, 11:59pm IST.**
  `frontend/src/components/RazorpayButton.js`'s `IN_BUTTON` currently
  points at `pl_TX1mf8ClQojsek` (Razorpay Subscription Button, ₹2,949
  incl. GST/year — a lock-in rate for anyone who subscribes before Nov 1,
  per Sept 2 2026 conversation). On/around Nov 1, create a new
  Subscription Button + Plan for the post-Nov-1 new-subscriber rate
  (₹3,499 + GST) in the Razorpay dashboard, then swap `IN_BUTTON.id` to
  the new button ID. Existing ₹2,499 subscribers keep renewing at that
  rate regardless (it's their Plan, unaffected by swapping the button on
  the site). Also still needed: a separate, not-publicly-embedded renewal
  Subscription Button for existing pre-Nov-1 subscribers at the
  grandfathered ₹2,999 + GST rate (₹3,539 incl. GST) — shared directly
  with them, not linked from the site.

### P1 — real gaps
- **Dark-mode logo**: `MockupHeader.js` uses CSS `invert` filter on the light logo. Muddy on the wordmark. Needs a proper white-on-transparent asset, then reintroduce a `LOGO_DARK` distinction.
- **`/apple-touch-icon.png`** missing.

### P1 — features requested, not built
- **Substack → `/left-field/[slug]` sync** — full spec approved (see chat history):
  - Poll `theleftfield.substack.com/feed` every 15 min
  - Strip Substack chrome: `<span>` wrappers, `data-attrs=` divs, `button-wrapper` subscribe CTAs, `captioned-image-container` classes
  - **Keep** the "That's it for this Wednesday edition" sign-off (voice)
  - Rehost images to Emergent Object Storage (approved)
  - **No** LLM auto-tagging (declined)
  - Store in `tlf_posts` Mongo collection (schema in earlier chat)
  - Render at `/left-field/[slug]` with existing TSOP typography, MockupHeader, MockupFooter
  - Zero conflict with existing scheduled jobs (there are none)
- **Device Lock** — max 2 devices per account
- **PWA** — manifest + service worker

### P2 — backlog
- Renewals dashboard (`/admin/dash`)
- Automated dunning emails (30/7 day expiry alerts)
- Bookmarks / Reading List
- Series navigation (tag-driven TOC)
- "Insider Drops" subscriber-only feed
- Consolidate `_create_story_token` helper across cold-link + nominations
- Standalone hex sweep (~30 remaining hardcoded colours without `dark:` pairs)
- CI/pre-commit hook flagging new hardcoded hex in JSX

### Non-code
- Post-SEO recovery: URL-Inspect the 24 previously-missing articles in Search Console → typically 3–7 day first re-index wave, 2–3 weeks full recovery.
- Editorial: consider headline discipline for slug-derived search matching (put valuations, brand names, deal parties in titles).

## 12. Dead-file discipline

Two rules to prevent the "12 unrouted pages sitting in the repo" problem from recurring:

1. **When redesigning a page, edit the file in place.** Do not create `*V2.js` or `*Redesigned.js` files.
2. **When cutting over aliases in App.js** (`import { NewComponent as OldName }`), delete the old file in the same commit. Never both.

Verified-safe delete pattern:
```bash
# STRICT — matches only real ES imports, not substring
grep -rEn "from ['\"]\.{1,2}/(pages|components)/FILENAME['\"]" \
     --include='*.js' --include='*.jsx' frontend/src/
```

If it returns zero hits AND the file isn't in App.js's route table, it's safe to delete. Substring grep alone is not enough (shadcn's internal `SheetHeader`, `CardFooter`, etc. false-positive on `Header`/`Footer`).

## 13. Test credentials

`/app/memory/test_credentials.md` — admin email `hello@venkatananth.me`, `ADMIN_KEY` in backend `.env`.

## 14. Local dev

```bash
# backend (supervisor-managed, runs on :8001)
sudo supervisorctl restart backend
tail -f /var/log/supervisor/backend.err.log

# frontend (hot reload, port 3000)
cd /app/frontend && yarn start

# tests
cd /app/backend && ADMIN_KEY=... python -m pytest tests/ -q
```

## 15. Deploy

**One-click via Emergent chat's "Save to GitHub" button.** That commits + pushes to main; Vercel auto-deploys frontend, Render auto-deploys backend. No manual steps.

## 16. Documentation map

```
/app/README.md                       →  high-level intro
/app/CODE_REVIEW.md                  →  security/codebase audit
/app/design_guidelines.json          →  current shipped design spec
/app/memory/PRD.md                   →  product requirements
/app/memory/REIMAGINATION.md         →  design/direction notes
/app/memory/HANDOVER.md              →  THIS FILE
/app/memory/test_credentials.md
/app/test_result.md                  →  running test log
/app/test_reports/                   →  JSON test reports from testing agent iterations
/app/corporate-subscriptions/apps-script-backend.js  →  Apps Script source (deploy target)
```

---

_Anything unclear or out of date — update this file in the same commit as the code change. The whole point of it is that the next person opening the repo cold shouldn't need to re-derive any of this from grep._
