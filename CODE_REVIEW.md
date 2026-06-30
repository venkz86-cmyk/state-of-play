# The State of Play — Full Codebase Review

_Generated 30 June 2026 — read-only audit. No code changed during this pass._

Severity legend:
- 🔴 **Critical**  – production risk / security / data integrity. Fix soon.
- 🟠 **Important** – will bite later (perf, maintainability, correctness edge cases).
- 🟡 **Nice-to-have** – polish, hygiene, dead-code, documentation.

---

## 1. Backend — `/app/backend/`

### 🔴 Critical

1. **JWT default secret fallback** — `server.py:31`
   ```python
   JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
   ```
   If `JWT_SECRET` is ever unset on Render, the server boots with a publicly-known string. Any attacker who guesses the fallback can mint valid JWTs.
   **Fix**: drop the default; let startup fail loudly when missing.

2. **Legacy `/auth/signup` and `/auth/login` are live with no rate-limit and no email verification** — `server.py:160–197`
   The project has moved entirely to Ghost magic-link auth (`/api/ghost/verify-member`). The old Mongo-backed bcrypt endpoints are still mounted, accept any email, and persist password hashes in `db.users`. This is a parallel, weaker auth surface. If left untouched, an attacker can create accounts that bypass the Ghost-driven paywall checks (the JWT issued here is accepted by `get_current_user`).
   **Fix**: delete `/auth/signup`, `/auth/login`, `/auth/me`, `UserCreate`/`UserLogin`/`User` models, and `get_current_user` — none of the live frontend uses them.

3. **`/api/articles` POST is auth-gated but `/articles` GET is open and queries a stale `db.articles` collection** — `server.py:202–241`
   Ghost is the source of truth now. These endpoints are dead surface area that confuses crawlers, leaks the collection schema, and lets `create_article` write to Mongo with any logged-in JWT (see point 2 above).
   **Fix**: delete the whole `/articles` block + the `Article`, `ArticleCreate` models.

4. **CORS wide-open by default** — `server.py:1888–1893`
   ```python
   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
   ```
   The fallback `*` combined with `allow_credentials=True` is rejected by browsers, but on Render the env is set so it works. Still: combining `allow_credentials=True` with `*` is forbidden by the CORS spec, and someone editing the env will silently break auth.
   **Fix**: drop the `*` fallback. Make `CORS_ORIGINS` required; fail-fast at boot.

5. **`/api/ghost/article-content` has no rate-limit and exposes the Ghost Admin API as a public proxy** — `server.py:634`
   The endpoint accepts an email in the POST body and, if Ghost reports that email is paid, returns the full premium article HTML. There is no nonce, no signature, no per-email throttle. Any single leaked subscriber email lets an attacker scrape the entire premium archive.
   **Fix**: require a server-issued short-lived token (the `/ghost/integrity-token` endpoint already exists at `server.py:713` — wire it in), or at minimum add IP-based rate-limiting (e.g. `slowapi`).

### 🟠 Important

6. **`/auth/me` uses `Depends(get_current_user)` but mongoDB user.id is a uuid string while `Article.user_id` and other downstream references are inconsistent.** Cleaning up per (2)/(3) makes this moot.

7. **`@app.on_event("shutdown")` is deprecated (FastAPI ≥ 0.93)** — `server.py:1895`
   Use the `lifespan` context manager. Not blocking, but it'll emit deprecation warnings indefinitely.

8. **Bare `except:` clause** — `server.py:777`
   Catches `KeyboardInterrupt`, `SystemExit`, everything. Replace with `except Exception:`.

9. **`logger` used in some places, `logging` directly in others** — 46 calls in `server.py`, 15 in `nominations.py`, with inconsistent style (`logger.error`, `logging.warning`, `logging.error`). Pick one. Lowest-friction: `logger = logging.getLogger(__name__)` at the top of each module and use only `logger.*`.

10. **`/api/og/{slug}` returns `301 RedirectResponse` to non-bots** — `server.py:1056–1069`
    This is correct behaviour, but the redirect target is hard-coded to `www.stateofplay.club`. On preview/staging this redirects out of the preview domain. Read from `PUBLIC_BASE_URL` (already defined in `nominations.py`) — promote it to a shared `config.py` so both modules use the same source of truth.

11. **OG image generation makes 2 outbound HTTPS calls (Ghost post fetch + feature image fetch + logo fetch) per request, no caching** — `server.py:812–1014`
    First-time render ~2–3s on Render. Add a simple in-memory LRU keyed by `slug` + `updated_at` (Pillow byte cache), or better, write the generated PNG to `/tmp/og-cache/{slug}.png` with a 24h TTL. Saves Ghost API rate-limit headroom and gives sub-200ms repeat serves.

12. **Ghost API key shipped in `frontend/.env`** — `REACT_APP_GHOST_CONTENT_API_KEY=a9be7f9fb8a0b1ef144d56ed8f`
    This is the **Content API** key, which is designed to be public (read-only, no writes), so this is technically allowed by Ghost. But it does mean anyone can hit the Ghost Content API from any origin pretending to be your site. Acceptable risk for an editorial site, but worth noting — if you ever start serving sensitive data through the Content API, rotate immediately.

13. **`/sitemap.xml` paginates Ghost with a hard ceiling of 10 pages (1000 posts)** — `server.py:1822`
    Won't hit it for years, but a silent ceiling is a latent bug. Either remove the cap or log a warning when reached.

14. **Variable shadow `lbl` collisions** — `server.py:669` (`E741` from ruff). Rename `l` and `lbl` consistently.

### 🟡 Nice-to-have

15. **Unused imports** — `Header` (line 1), `excerpt` local (842), `author` local (1093). One f-string with no placeholders (1049). All flagged by ruff. Trivial cleanup.

16. **`/health` exists twice** — once at `/api/health` (`server.py:1301`) and once at root `/health` (`server.py:1779`). Pick one. The root one is the convention for Render's health-check.

17. **`server.py` is 1898 lines.** Time to split:
    - `routes/auth.py` (legacy + ghost magic-link)
    - `routes/payments.py` (Razorpay)
    - `routes/invoice.py` (individual + team)
    - `routes/og.py` (og-image + og meta + sitemap + robots)
    - `routes/ghost.py` (member-details, article-content, integrity-token)
    - keep `server.py` as the FastAPI app bootstrap + middleware

18. **Hard-coded font/logo URLs inside OG generator**. Move to top-of-file constants alongside `LOGO_URL`. Already partially done — finish it.

---

## 2. Frontend — `/app/frontend/src/`

### 🟠 Important

19. **12 orphan page files post-cutover (~3,600 LOC dead code)** — see list:
    `Home.js`, `About.js`, `Login.js`, `Signup.js`, `Welcome.js`, `Outfield.js`, `Partnerships.js`, `Teams.js`, `MemberDashboard.js`, `ArticlePage.js`, `Membership.js`, `StateOfPlay.js`
    None are referenced from `App.js`. They build into the bundle anyway (CRA includes everything imported transitively, but these are not imported, so they're tree-shaken in prod — still: they confuse new contributors and the testing agent).
    **Fix**: delete them. The `Mockup` variants are the live ones.

20. **5 orphan components** — `BackToTop`, `DarkModeToggle`, `Footer`, `Header`, `SearchModal`.
    Same story — superseded by `MockupBackToTop`, `MockupHeader`, `MockupFooter`. Delete.

21. **`ArticleMockup.js` and `HomeMockup.js` import `axios`** but the project's standard is `ghostAPI` service wrapper. Either consolidate on one HTTP client or remove `axios` if every call has moved through service modules. Currently both coexist.

22. **`react-helmet-async` is now unused** — the new `SEO.js` manages `document.head` imperatively. `HelmetProvider` in `App.js:3,78` is dead wrapping. Either remove `react-helmet-async` from `package.json` (saves ~12KB gzipped) or document why it stays. Recommendation: remove.

23. **`data-testid` coverage** — 17 of 19 live pages have testids. The two missing (`FeedMockup` interior elements, some sub-children of `LeftFieldMockup`) are mostly covered but could be tighter. Acceptable.

24. **`MockupFontSizeToggle` state persisted in localStorage with key `tsop_article_size`** — good, but no migration if the key shape ever changes. Add a version prefix (`tsop_v1_article_size`) for future-proofing.

25. **`NominateReaderBlock`, `ColdLinkAdminButton`** depend on `user.email` being a Ghost-known paid email. If `user` is null they no-op silently — that's good. But they also assume the `/api/cold-link/generate` endpoint is reachable; on Vercel preview deploys it hits the prod Render backend (which it should). Just worth documenting.

### 🟡 Nice-to-have

26. **`App.js` route table mixes mockup → live aliasing inline** —
    ```js
    import { HomeMockup as Home } from "./pages/HomeMockup";
    ```
    Now that the cutover is finished, just rename the files (`HomeMockup.js` → `Home.js`) and drop the alias. Reduces cognitive overhead for anyone reading the file tree.

27. **CRA is on the way out** — no urgent issue, but at some point migrating to Vite would cut dev rebuild time from 5–8s to <1s. Not for this sprint.

28. **`useEffect` clean-up patterns** — most pages use the `active = true` pattern for fetch races (good). A few don't (`HomeMockup`, `LeftFieldMockup`). Tiny risk of setState-on-unmount warnings during fast navigation; fix at leisure.

29. **No frontend test files anywhere** — no Jest / Vitest / RTL setup. For a publication, end-to-end smoke tests on `/`, `/{slug}`, `/archive`, `/login` are enough. Defer.

---

## 3. Architecture

### 🟠 Important

30. **Two parallel HTML rendering paths for shared stories** — `/api/og/{slug}` (used by social bots on the public article URL) and `/api/shared/{token}` (cold-link SSR). They share ~70% of meta-tag logic. After fixing the OG image generator (now both point to the new dynamic card), promote a small helper `build_meta_tags(post, url, og_image)` in `nominations.py` and import it from `server.py`. DRY.

31. **`PUBLIC_BASE_URL` lives in `nominations.py` only** — but `server.py`'s OG endpoint hard-codes `https://www.stateofplay.club`. Single source.

32. **No central env loader / config module** — every file does its own `os.environ.get`. Even a 30-line `config.py` (`@dataclass(frozen=True) class Settings`) would make missing-env failures obvious at boot rather than at first request.

### 🟡 Nice-to-have

33. **`backend/assets/fonts/` checked into git (~1 MB)** — fine for now, but consider downloading on container build via a `postinstall` step so the repo stays light.

34. **`/app/corporate-subscriptions/apps-script-backend.js` is "reference only"** — make this explicit in the file header. Easy for a new contributor to mistake it for runnable backend code.

35. **Vercel rewrites now route 4 paths to Render** (`/content/*`, `/s/:token`, `/sitemap.xml`, `/robots.txt`). Render is on the free tier — keep an eye on cold-start latency for `/sitemap.xml` since Googlebot will hit it weekly.

---

## 4. Deployment readiness

### 🔴 Critical
None.

### 🟠 Important

36. **`backend/Procfile` uses `$PORT`** — correct for Render. Make sure `PORT` is set in Render dashboard (default is 10000). No reload flag — good for prod.

37. **`backend/runtime.txt` pins `python-3.11.0`** — fine, but 3.11.0 is the GA release with the highest count of bugfix back-ports. Bump to `python-3.11.10` or `python-3.12.7` at next deploy window.

38. **`requirements.txt`** — looks lean. No version pin on `Pillow` (`pillow==12.1.0` ✓), `httpx` is implicit via FastAPI. Add `httpx` explicitly so an upstream FastAPI bump doesn't change the version under you.

### 🟡 Nice-to-have

39. **`vercel.json`** is clean. Consider adding `headers` block to set long-cache headers on `/api/og-image/*` (the backend already sends `Cache-Control: public, max-age=86400` — Vercel's edge will respect it, so this is fine).

40. **No CI** — no GitHub Actions / Vercel preview env smoke test. A 30-line workflow that runs `ruff check` + `yarn build` on PR would catch the kinds of lint issues found in section 1.

---

## 5. Top-5 to fix immediately (suggested ordering)

If you can only do five things this week, do these:

1. ~~**(🔴 #1)** Remove the `JWT_SECRET` default fallback.~~ ✅ **DONE — Session 4.1**
2. ~~**(🔴 #2 + #3)** Delete the legacy `/auth/*` and `/articles` endpoints + the `db.users` collection bcrypt path. ~80 lines removed, attack surface gone.~~ ✅ **DONE — Session 4.1** (270 lines gone, including the parallel payment-order surface)
3. ~~**(🔴 #5)** Add rate-limiting (`slowapi`) to `/api/ghost/article-content`, OR require a short-lived token from `/ghost/integrity-token`.~~ ✅ **DONE — Session 4.1** (in-memory token bucket: 6-burst, 1 token / 10s per email+IP)
4. **(🟠 #19)** Delete the 12 orphan page files. Frees the testing agent from "which file is the real one?" confusion.
5. **(🟠 #11)** Add an in-memory cache for the OG image generator. Render's free dyno will thank you.

Everything else can wait.

---

## 6. Closing note

The codebase is in genuinely good shape for a one-person editorial product. The cutover from mockups to live designs is complete, the new feature additions (cold links, team dashboard, invoice generation, OG images, structured data) are well-isolated, and the integration with Ghost / Razorpay / Apps Script is sensible.

The biggest debt is **leftover auth scaffolding** from the pre-Ghost era. Removing it is a fast win and meaningfully reduces what an attacker can poke at. Everything else is hygiene and forward-looking polish.

— Review compiled by E1.
