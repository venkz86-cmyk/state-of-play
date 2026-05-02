# The State of Play — Reimagined

## Vision
Transform TSOP from a "good publication website" into a **reference-class digital publication** — the kind of site that makes readers feel they're accessing something exclusive, authoritative, and worth paying for.

---

## Part 1: Next.js Migration

### Why Next.js?

| Problem Today | How Next.js Solves It |
|---------------|----------------------|
| OG tags need Cloudflare Worker hack | Server-side rendering generates OG tags natively |
| SEO is limited (client-rendered) | Full SSR = Google indexes everything properly |
| Slow initial page load | Static generation for articles = instant loads |
| Complex deployment (Vercel + Render) | Single Vercel deployment for frontend + API routes |

### Architecture: Before vs After

**Current:**
```
Ghost CMS → FastAPI (Render) → React CRA (Vercel) → Cloudflare Worker (OG tags)
                ↓
           MongoDB (auth, history)
           Razorpay (payments)
           Google Sheets (corporate)
```

**Proposed:**
```
Ghost CMS → Next.js App (Vercel)
              ├── /app (pages, SSR)
              ├── /api (API routes, replaces FastAPI)
              └── Edge functions (if needed)
                    ↓
              Supabase or PlanetScale (auth, history, corporate)
              Razorpay (payments)
```

### What Stays
- Ghost CMS — Content management, email delivery
- Razorpay — Payments (India requirement)
- Vercel — Hosting (now does more)
- Cloudflare — CDN, DNS, security (but Workers no longer needed for OG)

### What Changes
- React CRA → Next.js 14 (App Router)
- FastAPI on Render → Next.js API routes on Vercel
- MongoDB → Supabase (PostgreSQL) or PlanetScale (MySQL)
- Google Sheets → Proper database table for corporate subscriptions
- Custom auth hack → NextAuth.js with proper session management

### Migration Phases

**Phase 1: Foundation (Week 1-2)**
- Set up Next.js 14 project with App Router
- Implement Ghost content fetching with ISR (Incremental Static Regeneration)
- Basic pages: Home, Article, Archive
- Deploy to Vercel, verify it works

**Phase 2: Features (Week 3-4)**
- Auth system with NextAuth.js
- Razorpay integration (API routes)
- Member verification against Ghost
- Reading history, preferences

**Phase 3: Corporate & Polish (Week 5-6)**
- Corporate subscriptions (proper database)
- Team dashboard
- PWA support
- Performance optimization

**Phase 4: Cutover**
- DNS switch
- Redirects for old URLs
- Monitor, fix issues

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Downtime during migration | Run parallel, switch DNS only when ready |
| Broken URLs/SEO | 301 redirects for all existing URLs |
| Ghost integration issues | Ghost Content API is stable, well-documented |
| Learning curve | Next.js is well-documented, large community |

---

## Part 2: Design Reimagination

### Current State
- Clean but generic
- Safe typography choices
- Standard card layouts
- Functional but not memorable

### Design Principles for TSOP

1. **Editorial Confidence**
   - The design should say "we know what we're talking about"
   - Less startup, more Financial Times
   - Restraint over flashiness

2. **Premium Through Subtlety**
   - Not gold borders and gradients
   - Quality through typography, spacing, paper-like textures
   - Details that reward attention

3. **Content-First**
   - Typography that's a pleasure to read for 6+ minutes
   - No distractions from the writing
   - Images used sparingly but impactfully

4. **Distinctive but Not Weird**
   - Recognisable as TSOP instantly
   - Not a template
   - Personality without gimmicks

### Typography System

**Current:** Merriweather (headings) + Inter (body)
**Proposed:**

| Element | Font | Why |
|---------|------|-----|
| Masthead/Logo | Custom or distinctive serif | Brand recognition |
| Headlines | **Freight Display** or **Tiempos** | Editorial gravitas, high contrast |
| Article Body | **Freight Text** or **Lyon Text** | Designed for long-form reading |
| UI/Navigation | **Söhne** or **Graphik** | Clean, modern, doesn't compete |
| Data/Labels | **JetBrains Mono** or **Atlas Typewriter** | Technical credibility |

*Note: These are premium fonts. Google Fonts alternatives: Playfair Display, Source Serif Pro, IBM Plex Sans (what we tried before, but needs better implementation)*

### Colour Palette

**Current:** Blue (#234ba0), Orange (#FF6B35), Off-white background

**Proposed Evolution:**

```
Primary:     #1B3A5F  "Oxford Navy" — Deeper, more institutional
Accent:      #C45D2C  "Terracotta" — Warmer, less startup-orange  
Background:  #FAF9F7  "Newsprint" — Warm white, like quality paper
Text:        #1A1A1A  "Ink" — Rich black, not harsh
Muted:       #6B7280  "Pencil" — For secondary text
Success:     #2D6A4F  "Racing Green" — For positive states
```

### Layout Concepts

**Homepage — Magazine Grid**
```
┌─────────────────────────────────────────────┐
│  MASTHEAD                        [Nav]      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │                 │  │  Secondary       │  │
│  │  FEATURED       │  │  Story 1         │  │
│  │  STORY          │  ├──────────────────┤  │
│  │  (Large)        │  │  Secondary       │  │
│  │                 │  │  Story 2         │  │
│  └─────────────────┘  └──────────────────┘  │
│                                             │
│  ─────────── LATEST ───────────             │
│                                             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │     │  │     │  │     │  │     │        │
│  └─────┘  └─────┘  └─────┘  └─────┘        │
│                                             │
└─────────────────────────────────────────────┘
```

**Article Page — Reading-Optimised**
```
┌─────────────────────────────────────────────┐
│  Minimal header (logo + back)               │
├─────────────────────────────────────────────┤
│                                             │
│        ┌───────────────────────┐            │
│        │                       │            │
│        │  HEADLINE             │            │
│        │  Subtitle             │            │
│        │  Author • Date • 6m   │            │
│        │                       │            │
│        │  ─────────────────    │            │
│        │                       │            │
│        │  Article body in a    │            │
│        │  comfortable reading  │            │
│        │  column (~680px)      │            │
│        │                       │            │
│        │  [Pull quote]         │            │
│        │                       │            │
│        │  More text...         │            │
│        │                       │            │
│        └───────────────────────┘            │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  RELATED / NEXT UP                  │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### Micro-Interactions & Details

1. **Page Transitions**
   - Subtle fade between pages
   - Content slides up on scroll
   - No jarring jumps

2. **Hover States**
   - Article cards: slight lift + headline colour change
   - Links: underline draws in from left
   - Buttons: subtle background shift

3. **Reading Experience**
   - Progress bar (thin, top of page)
   - Smooth scroll anchoring
   - "Read next" appears at end

4. **Premium Touches**
   - Subtle paper grain texture on background
   - Drop caps on articles (optional, tasteful)
   - Elegant blockquote styling
   - Footnotes that expand inline

### Mobile Design

- Full-width reading (no wasted margins)
- Bottom navigation bar (thumb-friendly)
- Pull-to-refresh
- Swipe between articles
- Dark mode that's actually good (not just inverted colours)

---

## Part 3: Phased Implementation

### Approach
Don't boil the ocean. Improve incrementally while migrating.

**Option A: Big Bang**
- Build new Next.js site completely
- Switch over when ready
- Risk: Long time before value delivered

**Option B: Incremental (Recommended)**
- Phase 1: Design refresh on current CRA site
- Phase 2: Migrate to Next.js with new design
- Phase 3: Add new features (bookmarks, PWA, etc.)
- Benefit: Value delivered at each step

### Timeline Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Design refresh (current site) | Typography, colours, spacing | 1-2 weeks |
| Next.js foundation | Core pages, Ghost integration | 2-3 weeks |
| Auth + Payments | NextAuth, Razorpay | 1-2 weeks |
| Corporate subs | Database migration | 1 week |
| Polish + PWA | Performance, offline | 1 week |
| **Total** | | **6-10 weeks** |

---

## Part 4: What Success Looks Like

1. **Reader Perception**
   - "This feels like a serious publication"
   - "The reading experience is excellent"
   - "Worth paying for"

2. **Technical Metrics**
   - Lighthouse score: 95+
   - Time to first contentful paint: <1s
   - No more OG tag hacks

3. **Business Impact**
   - Higher conversion (free → paid)
   - Lower churn
   - More shares (better link previews)
   - Corporate sales easier ("look at our platform")

---

## Appendix: Inspiration

Publications worth studying:
- **The Athletic** — Clean, sports-focused, premium feel
- **Stratechery** — Simple but distinctive, content-first
- **The Ken** — Indian premium publication, understated design
- **Financial Times** — The gold standard for business editorial
- **Bloomberg** — Data-forward, authoritative
- **Defector** — Personality without gimmicks

---

## Next Steps

1. **Decide on approach**: Incremental (recommended) or big bang?
2. **Typography trial**: Test new fonts on a single page
3. **Colour refinement**: Adjust palette, see how it feels
4. **Next.js spike**: Build one page to validate the migration path

Ready when you are.
