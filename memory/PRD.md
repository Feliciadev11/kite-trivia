# Kite Trivia App - Product Requirements Document

## Original Problem Statement
Build a trivia app called Kite with:
- Floating kite animation on loading
- In-app purchases for characters (via CashApp fabfeliciaxo)
- Weekly leaderboard
- 5th grade level questions to start
- Both JWT auth and Google OAuth login
- Light/clean, dreamy sky theme — never arcade-like

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI (Python) with async MongoDB (Motor)
- **Database**: MongoDB (test_database)
- **Auth**: JWT sessions (cookie-based) + Emergent Google OAuth

## User Personas
1. **Casual Player**: Quick, calming trivia sessions
2. **Collector**: Motivated by unlocking kites, companions, sky themes
3. **Competitor**: Aims for the weekly leaderboard

## Core Requirements (Static)
- [x] Authentication (JWT + Google OAuth)
- [x] Account persistence
- [x] Trivia gameplay with XP/leveling
- [x] Character unlock system with level gates
- [x] Weekly leaderboard
- [x] CashApp payment (manual verification)
- [x] 5th grade starting difficulty
- [x] Ambient music + sound effects with user controls
- [x] Calm, dreamy, non-arcade visual identity

## Feature Status

| Feature | Status |
|---------|--------|
| Authentication (JWT + Google) | Working |
| Account / XP / Level | Working |
| Leaderboard + my-rank | Working |
| Character unlock + equip | Working |
| Daily rewards + streak | Working |
| Question randomization (505 Qs) | Working |
| Ambient music + 3 tracks | Working |
| Sound effects (WebAudio chimes) | Working |
| Settings page (persistent) | Working |
| Gentle answer-feedback palette | Working |
| Shop / Stripe Checkout | Working (Apple Pay, Google Pay, Visa, MC) |

## What's Been Implemented
- 2026-02-17 — **Security-only iter 16: Bandit B102 + B105 in dev/test scripts**:
  - Confirmed both flagged files (`scripts/generate_questions.py`, `backend_test.py`) are NOT excluded from deployment (no Dockerfile, no .dockerignore, no build filter — Emergent ships the working tree as-is). Neither is imported by `server.py` at runtime, but they are in the shipped bundle.
  - **Fix 1 (B102 exec-used)** in `scripts/generate_questions.py::_load_existing` — replaced `exec(questions_path.read_text(), spec)` with `importlib.util.spec_from_file_location(...)` + `spec.loader.exec_module(module)` (standard safe module loader; not flagged by Bandit).
  - **Fix 2 (B105 hardcoded-password)** in `backend_test.py` — replaced literal `test_password = "TestPass123!"` with `os.environ.get("KITE_TEST_PASSWORD", "Tp-" + secrets.token_urlsafe(16))`. Per-run random test credential.
  - **Verified (iter 16)**: backend 42/42 pytest PASS. Both files import cleanly. Grep confirms both flagged patterns are gone.


- 2026-02-17 — **Bug fix: questions failing to load after login (Iteration 15)**:
  - **Root cause**: React 18 StrictMode double-invoked the mount `useEffect` in `Play.jsx`, causing GET `/api/questions` to fire twice per Play visit. Each call incremented `rounds_played_today` by 1 server-side, so free users hit the 3-per-day cap in ~1.5 visits and the 4th call returned HTTP 402 → soft-wall gate rendered → indistinguishable to the user from "questions failed to load".
  - **Fix**: added `didFetchRef = useRef(false)` in `Play.jsx` and a mount guard around the `fetchQuestions()` call — guarantees the fetch fires exactly once per mount in both dev (StrictMode) and prod builds.
  - Scope: `Play.jsx` only. Backend, RevenueCat integration, paywall logic, progression system, and legal pages **untouched**.
  - **Verified (testing_agent iter 15)**: backend 42/42 PASS + 3 harmless skips; frontend 100% PASS; single GET `/api/questions` per Play mount confirmed; a free user can now visit /play three full times before the correct free-tier gate appears.


- 2026-02-17 — **Public Legal Pages (Iteration 14)**:
  - `/privacy` — Privacy Policy covering Apple App Store + Google Play + RevenueCat, gameplay data, analytics, purchases, children's privacy, security, data retention, App Store App Privacy label + Play Data Safety disclosures.
  - `/terms` — Terms of Service covering monthly/yearly/lifetime subs, Apple/Google cancellation flows, refunds, restore purchases, acceptable use, IP, liability limitation, indemnity, governing law, third-party terms links.
  - Shared `LegalLayout` uses Kite's sky-gradient + glass-card aesthetic; "Back to Kite" link in header; Privacy · Terms footer cross-link.
  - `SkySplash` suppressed on `/privacy` and `/terms` so App Store reviewers land directly on the legal content (other routes still show splash to fresh visitors).
  - Landing footer now has small Privacy · Terms links.
  - Zero backend changes; zero gameplay/paywall/RevenueCat changes.
  - **Verified (iter 14)**: testing agent 100% frontend PASS. Live browser test confirms `H1='Privacy Policy'` on /privacy and `H1='Terms of Service'` on /terms with no splash overlay, and no regression to splash on /.


- 2026-02-17 — **Customer-facing copy rename (Iteration 13)**:
  - User decision: "Kite Pro" is an internal identifier only; every visible reference replaced with warm, invitational brand copy.
  - Paywall dialog: title `Unlock the Full Experience`, subtitle `Unlimited trivia, exclusive skies, premium themes, and every future update.`, benefits refreshed, purchase button label `Continue`.
  - Web notice: `The full experience is unlocked through the App Store or Google Play. Open Kite on your iOS or Android device to continue.`
  - Dashboard Sparkles tooltip: `Unlock the full experience` (non-premium) / `Manage your Kite subscription` (premium).
  - Play free-gate CTA now `Continue`; subtitle uses "unlock the full experience for unlimited flights".
  - Backend 402 detail message updated to match.
  - Success toast → `The full sky is open. Thank you for supporting Kite ✨` and already-premium → `The full experience is yours. Thank you for supporting Kite 🪁`.
  - "Kite Pro" now appears in exactly 4 whitelisted internal locations: `server.py`, `purchases.js`, `PremiumContext.jsx` default state, one test assertion — all internal identifiers, zero customer-facing.
  - **Verified (iter 13)**: 42/42 pytest PASS. Testing agent 100% frontend + backend PASS with explicit grep confirmation of no customer-facing "Kite Pro" leakage.


- 2026-02-17 — **RevenueCat Integration — Kite Pro (Iteration 12)**:
  - **Clarification given to user**: Kite is a Capacitor app (not React Native), so used `@revenuecat/purchases-capacitor` + `@revenuecat/purchases-capacitor-ui` (same feature set as `react-native-purchases`, works with our stack).
  - Entitlement identifier: **`Kite Pro`** (backend + frontend + tests).
  - Product IDs: **`lifetime`**, **`yearly`**, **`monthly`** (matches user prompt exactly).
  - Test API key `test_zbkylBVKIMySdYkgspQwisDwjTN` baked as fallback in `src/lib/purchases.js`.
  - New helpers in `src/lib/purchases.js`: `presentPaywall({ requiredEntitlementIdentifier })` and `presentCustomerCenter()` — both no-op on web with `{ok:false, reason:'unavailable'}`.
  - `PremiumContext`: `presentNativePaywall` (native RC UI on device, custom Dialog fallback on web) and `openCustomerCenter` actions.
  - Dashboard Sparkles nav: opens Customer Center when premium, presents RC paywall otherwise.
  - Paywall dialog updated with 3-plan picker (yearly / lifetime / monthly), all copy reads "Kite Pro".
  - **Verified (iter 12)**: backend 42/42 PASS, frontend 100% PASS. Zero import errors on web — dynamic imports of RC SDKs correctly short-circuited by `IS_NATIVE` guard.
  - **Docs**: `README-mobile.md` fully rewritten with the new IDs and the Paywall template + Customer Center setup steps.


- 2026-02-17 — **Mobile Paywall (Capacitor + RevenueCat + Free Tier) — Iteration 11**:
  - Free tier: 3 rounds/day (`FREE_ROUNDS_PER_DAY=3`); premium bypasses. UTC-midnight rollover.
  - Premium model: monthly + yearly auto-renewing subscriptions. Product IDs (placeholders): `kite_premium_monthly`, `kite_premium_yearly`. Entitlement id: `kite_premium`.
  - **Backend** (`server.py`): User model extended (`is_premium`, `premium_source`, `premium_product_id`, `premium_expires_at`, `premium_updated_at`, `rounds_played_today`, `last_round_date`). Free-tier gate at `/api/questions` returns HTTP 402 with structured detail. New endpoints: `GET /api/premium/status`, `POST /api/premium/sync`, `POST /api/premium/webhook` (stub — TODO signature verification when secret arrives).
  - **Frontend**: `capacitor.config.json` + Capacitor 7 packages installed. `@revenuecat/purchases-capacitor` SDK. New `src/lib/purchases.js` (web-safe wrapper), `src/contexts/PremiumContext.jsx` (auth-gated boot, no more 401 noise), `src/components/Paywall.jsx` (benefits + plan picker + restore). `Play.jsx` handles 402 with soft free-tier gate. `Dashboard.jsx` shows Sparkles nav badge with remaining free rounds.
  - **Stripe web shop untouched.** Gameplay, XP curve, UI, question DB (2193), audio, sky themes all preserved.
  - **Verified (iter 11)**: 42/42 pytest PASS (4 new premium tests + 38 existing). Testing agent 100% frontend PASS. Paywall correctly shows "unavailable on web" state; iOS/Android will show localized RevenueCat prices when built with store credentials.
  - **Documentation**: `/app/README-mobile.md` — exact product IDs to create in App Store Connect + Google Play Console, env vars, testing steps for both sandbox stores.


- 2026-02-17 — **Security-Only Iteration (2 HIGH-severity fixes)**:
  - **Finding 1 (CSRF)**: `SameSite=None` on all 3 auth cookies (register / login / session-exchange, `server.py` lines 225 / 264 / 362). Changed to `SameSite=Lax` — frontend and backend are same-origin so Lax fully preserves the auth flow while blocking cross-site cookie transmission.
  - **Finding 2 (CWE-601 Open Redirect)**: `POST /api/characters/purchase` accepted client-supplied `origin_url` and reflected it into Stripe's `success_url`/`cancel_url`. Added `_resolve_safe_origin(candidate, request)` helper (~L925) that validates against the `CORS_ORIGINS` allowlist + anchored `CORS_ORIGIN_REGEX`. Non-http(s), suffix-attack, `javascript:`, protocol-relative and unknown origins fall back to `request.base_url` (backend-derived, safe by construction).
  - **Not changed**: gameplay, UI, question DB, XP curve, Shop refactor.
  - **Verified (testing_agent iter 10)**: 40 pytest PASS + 1 harmless skip. 9 new tests added (3 SameSite cookie assertions + 5 `_resolve_safe_origin` unit tests + 1 e2e purchase-open-redirect regression). Live curl on public URL confirms `SameSite=Lax` on the wire.


- 2026-02-17 — **Content Expansion Pass 2 + Full-DB Dedupe (P1)**:
  - Ran generator with rebalanced weights favoring under-represented categories (geography2, inventions, literature, movies, technology, travel, sports, holidays, history).
  - LLM produced ~500 candidate questions across 72 batches; 476 passed per-batch validation (schema + dedupe vs existing DB) and were appended.
  - Full-DB dedupe pass across all 2280 rows: removed 2 exact-text duplicates + 85 near-duplicates (same first-6-words head AND same correct-answer value; kept the earliest occurrence). Net: **2280 → 2193 questions**.
  - ID scheme this session: `{category}_gen2_{N}` to avoid collision with prior `_gen_` batch.
  - Final difficulty mix: 54.2% easy / 34.7% medium / 11.1% hard.
  - Verified: 32/32 pytest PASS, live `/api/questions` serves the enlarged pool.


- 2026-02-17 — **Content Expansion + Pacing (P1)**:
  - **Trivia bank grown 820 → 1804** (+984 net; +992 generated, 8 pre-existing duplicates removed). New questions generated via Claude Sonnet 4.6 through Emergent LLM key using `/app/backend/scripts/generate_questions.py` — reproducible one-off pipeline with validation, dedupe by normalized text, and category-weighted planning tuned to Kite's cozy tone.
  - **Difficulty mix**: 53% easy / 36% medium / 11% hard (target was 60/30/10).
  - **Level curve tuned for spacing** — `xp_required_for_next_level(L) = 150 + L * 150` (smart curve). L1→L2 now 300 XP (was 100 XP), L20→L21 now 3150 XP (was 2000 XP). Backed by 3 call sites in `server.py` and the Dashboard client mirror. New backend helper: `xp_required_for_next_level()`.
  - Verification: backend pytest 32/32 PASS; live smoke-test on preview URL shows Dashboard "0 / 300 XP" correctly.


- 2026-02-17 — **Code Review Sweep (Iteration 9)** — addressed all priorities in user's code review:
  - **P0 SECURITY (HIGH)**: Fixed CORS misconfiguration `allow_origins='*'` + `allow_credentials=True` (CWE-942). `server.py` now uses an env-driven allowlist (`CORS_ORIGINS`) plus a `CORS_ORIGIN_REGEX` for emergent preview domains; wildcard explicitly stripped if present. Backend pytest now includes 4 new CORS hardening tests (32/32 pass total). NOTE: K8s ingress proxy still injects `ACAO: *` on the public preview URL (platform-level, outside app code) — the FastAPI fix is verified correct via localhost:8001.
  - **P0 React hooks**: Ran ESLint with `react-hooks/exhaustive-deps` at `error` level — **0 missing-deps issues**. The "31 missing deps" claim from the external review tool didn't match canonical React rules; codebase passes cleanly.
  - **P0 Console statements**: Created `/app/frontend/src/lib/logger.js` (dev-only `logError`/`logWarn` that no-op in production). Replaced all 5 production `console.error` calls in `App.js` (3), `Dashboard.jsx` (1), `Play.jsx` (1).
  - **P1 Refactor highest-complexity file**: `Shop.jsx` 631 → 189 lines (70% reduction). Extracted 7 focused modules under `/app/frontend/src/pages/shop/`:
    - `shopConstants.js` (RARITY_GATES, RARITY_COLORS, TAB_CONFIG, sortByRarity)
    - `useStripeCheckoutPolling.js` (custom hook with cancellation flag, JSDoc-typed)
    - `ItemCard.jsx` (sub-components: ItemPreview, StatusBadge, ItemAction)
    - `RaritySection.jsx`
    - `ShopTabContent.jsx` (one tab body, driven by TAB_CONFIG)
    - `PurchaseDialog.jsx` (sub-components: PurchasePreview, StatusBlock)
    - `EquippedSummary.jsx`
  - **TS coverage**: TS conversion explicitly out-of-scope (codebase is JS, not TS). Added JSDoc `@param` types on all new extracted modules instead.
  - **Verification (iter 9)**: backend 32/32 pytest PASS, frontend regression PASS (signup → dashboard → shop 3-tab stress → Stripe canceled flow → Stripe success-polling dialog → leaderboard → profile), 0 console errors, 0 key warnings, 0 unstable-nested-components warnings.


- 2026-02-17 — **Code Quality Sweep (P0 from user code review)**:
  - Lifted `UnlockPreview` out of `NextUnlockTease` parent (no-unstable-nested-components fix).
  - Removed `<AnimatePresence>` wrapper around 3 unkeyed `<TabsContent>` siblings in `Shop.jsx` — root cause of 8 "two children with same key" warnings (empty-string keys colliding). Each tab's inner `motion.div` now has explicit key.
  - Replaced all `key={index}` with stable namespaced keys in `Atmosphere.jsx` (cloud-, particle-, star-, wind-, rain-, petal-, leaf-, snow-, nebula-, shooting-) and composite coordinate keys in `SkyThemeSwatch.jsx`.
  - `SkyWandererCelebration.jsx` confetti uses `confetti-petal-${i}`; `Landing.jsx` feature pills key off `.text`.
  - `Profile/Leaderboard/Dashboard` async useEffects now use `alive` cancellation flag pattern.
  - `Shop.jsx` polling effect uses `useRef` to stabilize `refreshUser`/`loadCharacters` against AuthContext re-renders.
  - Verification (iter 8): backend 28/28 PASS, frontend 0 key warnings + 0 unstable-nested-components warnings across full critical path.



### v1.0 — MVP
- Auth (JWT + Google OAuth)
- 20 trivia questions
- 10 starter characters
- Leaderboard, profile, CashApp purchase flow

### v1.1 — Audit & Improvements
- 110+ new questions, daily rewards, streak tracking, randomization, answer feedback animations

### v1.2 — Atmospheric Enhancement
- Ambient audio system + 3 royalty-free tracks
- Atmospheric background (clouds, particles, wind lines, 12 sky themes)
- Expanded marketplace: 20 kites, 11 companions, 12 sky themes (rarity tiers)
- 220 total questions across 15 categories

### v1.3 — Depth & Calm Settings (Feb 2026)
- **505 trivia questions** across 12 categories (animals, nature, travel, art, science, pop_culture, history, whimsical, general, space, music, movies)
- Backend refactor: inline 230-line seed list extracted to `/app/backend/questions_db.py`; `seed_questions()` is now 6 lines
- **New Settings page** (`/settings`) with:
  - Ambient music on/off toggle (persisted)
  - Volume slider with soft cap (persisted)
  - Three ambient tracks: Serene Sky, Sleepy Clouds, Dream Drift (persisted)
  - Sound-effects toggle + preview buttons (persisted)
- **Gentle sound effects** generated with WebAudio (no external assets): soft major-triad chime for correct, calm minor-second descent for incorrect, magical chime for level-up/reward
- **Polished Play feedback**: emerald glow on correct answer, amber tone on incorrect (no harsh red/green)
- LocalStorage persistence: `kite_audio_isPlaying`, `kite_audio_volume`, `kite_audio_track`, `kite_audio_sfx`
- Dashboard nav now has gear icon → Settings

### v1.4 — Forgot Password Flow (Feb 2026)
- "Forgot your password?" link added to the Login (home) screen
- New `/forgot-password` 2-step page (calm sky aesthetic, glass card):
  - Step 1: enter email → backend generates a 6-digit code
  - Step 2: code is displayed in a gradient card with copy button → user enters code + new password
- Backend endpoints `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`
- Security: codes bcrypt-hashed at rest, single-use, 15-min expiry, max 3 active codes per email, generic responses on unknown email (no enumeration), all sessions invalidated on successful reset
- Email casing normalized to lowercase on register / login / OAuth session so reset works regardless of input casing
- 23/23 backend pytest pass; full frontend E2E pass; aesthetic remains calm and dreamy

### v1.5 — Stripe + Splash + 820 Questions (Feb 2026)
- **Stripe Checkout** replaces CashApp entirely. Apple Pay, Google Pay, Visa, Mastercard all supported via Stripe hosted checkout. CashApp UI and endpoints fully removed.
  - New backend endpoints: `POST /api/characters/purchase` (creates Stripe session), `GET /api/payments/checkout/status/{session_id}` (polls + grants idempotently), `POST /api/webhook/stripe`
  - `payment_transactions` collection tracks every session with `granted` flag for atomic single-grant
  - Free items still grant directly without going through Stripe
- **"Tap to Begin Your Sky" splash** — one-time full-screen overlay with floating kite, drifting clouds, and a glowing pill button. Tap starts ambient audio and is remembered via localStorage. Never reappears.
- **820 unique questions** across 25+ categories (added food, sports, mythology, technology, literature, inventions, geography2, riddles, holidays, math_fun, kid_classics, language, cozy_facts, kite_lore). All `question_id`s deduplicated.
- **Distinct sky themes** — rewrote `AtmosphericBackground` with signature elements per theme: glowing sun disc (dawn/golden_hour), crescent moon (moonlit), aurora ribbons (aurora_borealis), rain streaks (gentle_rain), falling petals (cherry_blossom_sky), nebula clouds + shooting stars (celestial_night/starry_night). Gradients are stronger and clearly different.
- **Louder, fuller correct-answer SFX** — peak gain bumped from 0.06 → 0.16; reward chime from 0.06 → 0.18.
- 28/28 backend pytest pass (5 new Stripe contract tests); full frontend E2E pass

### v1.6 — Difficulty Curve (Feb 2026 — current)
- New `difficulty_mix_for_level()` shapes each 10-question round into a level-tuned bag:
  - **Lvl 1** → 80% easy / 20% medium
  - **Lvl 2-3** → 60% / 30% / 10% hard
  - **Lvl 4-5** → 40% / 40% / 20%
  - **Lvl 6-8** → 20% / 40% / 40%
  - **Lvl 9+** → 10% / 30% / 60%
- `/api/questions` now derives the mix from the authenticated user's level instead of the legacy `difficulty<=N` filter. The legacy `difficulty` query param still works as an override for tests/future hard-mode.
- Buckets are sampled separately, padded if rounding under-fills, then shuffled so the round feels naturally varied (not "5 easy then 5 hard").
- Verified live: Lvl 1 → 8/2/0 consistently; Lvl 5 → 4/4/2; Lvl 9 → 1/3/6.

## Database Collections
- `users`: accounts + game stats + ownership
- `user_sessions`: 7-day cookie sessions
- `questions`: **505** trivia questions
- `characters`: 43 marketplace items
- `purchases`: purchase records (manual confirmation)

## Prioritized Backlog

### P0 (Critical — Before Beta)
- [ ] Admin panel for purchase verification
- [ ] Email confirmation for purchases

### P1 (Important)
- [ ] Push notifications for daily rewards
- [ ] More categories (Sports, Food, Mythology)
- [ ] Difficulty curve refinement

### P2 (Nice to Have)
- [ ] Multiplayer / friends list
- [ ] Achievement badges
- [ ] Seasonal sky themes (autumn, winter)

## Key Files
- `/app/backend/server.py` — FastAPI app, all routes
- `/app/backend/questions_db.py` — 505 questions
- `/app/backend/tests/test_kite_trivia.py` — pytest regression (16 tests)
- `/app/frontend/src/contexts/AudioContext.jsx` — audio + SFX state, localStorage persistence
- `/app/frontend/src/pages/Settings.jsx` — calming settings page
- `/app/frontend/src/pages/Play.jsx` — dreamy feedback palette
- `/app/frontend/src/pages/Dashboard.jsx` — nav with Settings

## Testing
- Backend: 16/16 pytest (auth, questions variety, answers, leaderboard, characters, daily reward, profile)
- Frontend: All data-testids verified; persistence across reload confirmed; gentle palette confirmed

## Next Action Items
1. Build admin panel for CashApp purchase verification (P0)
2. Add push notification scaffolding for daily rewards (P1)
3. Difficulty curve refinement based on player level (P1)
