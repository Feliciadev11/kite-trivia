# Kite Trivia App - Product Requirements Document

## Original Problem Statement
Build a trivia app called Kite with:
- Floating kite animation on loading
- In-app purchases for characters (mobile IAP via RevenueCat)
- Weekly leaderboard
- 5th grade level questions to start
- Both JWT auth and Google OAuth login
- Light/clean, dreamy sky theme — never arcade-like

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI (Python) with async MongoDB (Motor)
- **Mobile shell**: Capacitor 7 (iOS + Android)
- **Payments**: Stripe (web character purchases) + RevenueCat (mobile subscription paywall)
- **Auth**: JWT sessions (cookie-based) + Emergent Google OAuth

## Environments
- Preview (dev): https://kite-trivia-quest.preview.emergentagent.com (returns 404 on `/api/questions`
  as of 2026-09-05 — appears stale/redirected, do not assume it reflects current backend code)
- Production: https://kite-trivia-quest.emergent.host — **is running an older deployment that
  predates this branch (`anon-purchases-plan`, 11 commits ahead of `origin/main`)**. Confirmed
  2026-09-05: `POST /api/auth/anonymous` 404s on production (route doesn't exist there yet), while
  registered-user login/register/questions all work fine (backend itself is healthy, just stale).
  **A production redeploy from this branch is required before anonymous play — and therefore the
  physical-device build, which boots anonymously — will work.** This must be triggered from the
  Emergent platform dashboard; no CLI/API for it was found in this environment.

## Feature Status

| Feature | Status |
|---------|--------|
| JWT + Google Auth | Working (Google Sign-In UI removed from web + iOS per product decision; OAuth exchange endpoint (`/api/auth/session`) is unreferenced dead code, kept isolated, no UI links to it) |
| Anonymous play + anonymous purchases | Working locally; **blocked on production redeploy** (see Environments) |
| Trivia gameplay + XP curve | Working |
| Leaderboard + my-rank | Working |
| Shop | RevenueCat only — Stripe/CashApp fully removed (old endpoints kept only as "removed" regression tests) |
| Free-tier daily gate (3 rounds/day) | Working |
| RevenueCat mobile paywall | Wired — iOS SDK key installed, entitlement `Kite Premium`, monthly-only |
| Legal pages (/privacy, /terms) | Working; Google references are Play-Store legal copy only, not a sign-in UI |
| Play-page failure UX | Fixed 2026-09-05 — was rendering a blank "Question 1 of 0" screen on any non-402 fetch failure with no retry; now shows a proper retryable error state (see `lib/questionsFetch.js`) |

## What's Been Implemented

- 2026-09-05 — **Physical-iPhone "questions don't load" root-caused, fixed, and hardened against recurrence**:
  - Root cause #1: the shipped iOS bundle had `REACT_APP_BACKEND_URL` baked in as
    `http://192.168.0.24:8001` — a developer's LAN IP over plaintext HTTP. iOS ATS blocks cleartext
    HTTP by default (no exception in `Info.plist`), so every API call failed outright on-device
    regardless of network. `yarn build` had picked up whatever the shell happened to export, since
    dotenv never overrides an already-set `process.env` var.
  - Root cause #2 (independent, found while verifying the fix): production backend
    (`kite-trivia-quest.emergent.host`) 404s on `POST /api/auth/anonymous` — it's running an older
    deploy that predates this branch's anonymous-session work. See Environments above. **This is an
    external blocker — requires an Emergent platform redeploy, which this environment cannot
    trigger.**
  - Fix: `frontend/.env.production` (committed — public API URL, no secret) is now the single
    source of truth for the production backend URL. `yarn build:release`
    (`frontend/scripts/build-release.js`) is the only supported release-build command: strips any
    ambient `REACT_APP_BACKEND_URL` from the shell, validates the URL is https + non-private-host
    before building, then re-scans the compiled output bundle to confirm the right URL landed and
    that no Google-Sign-In UI marker is present. Verified working by reproducing the exact failure
    (exporting the bad LAN URL in the shell) and confirming the release build ignored it.
  - Also fixed while auditing the failure path: `Play.jsx` had no error/retry UI for a non-402
    question-load failure (blank game screen) and no request timeout anywhere in the app (a
    dropped connection hung forever). Added `axios.defaults.timeout = 20000` and a proper
    retryable error screen (`lib/questionsFetch.js` + its test).
  - Google Sign-In: confirmed already fully removed from all source (web + iOS) — no button, no
    entry point; remaining "google" hits in source are Play Store legal copy. `build-release.js`
    now fails the build if a Google-Sign-In marker reappears, so this can't silently regress.
  - Entitlement/product-ID/progression-gate duplication (named as "the source of most premium/IAP
    regressions historically" below) collapsed to one file: `backend/entitlements_config.json`.
    `backend/server.py` reads it directly; `frontend/src/lib/entitlements.generated.json` is a
    generated copy (`yarn sync-entitlements`, wired into `prestart`/`prebuild`/`build:release`).
    `purchases.js`, `shopConstants.js`, and `PremiumContext.jsx` all now import from it instead of
    hardcoding literals.
  - Added `backend/tests/test_questions_db_integrity.py` — schema/dedupe/pool-size validation for
    `questions_db.py` (unique IDs, valid option/answer shape, valid difficulty, no in-category dupes,
    every difficulty tier has enough questions to fill a round). Runs against the data module
    directly, no server/DB needed — the safety net for "add a question/category by hand."
  - `backend/requirements.txt` was missing `httpx`, which `server.py` imports directly — a clean
    `pip install -r requirements.txt` couldn't actually boot the server. Fixed.
  - Full local verification: 57/57 backend pytest pass (53 pre-existing + 4 new), frontend
    `yarn test` 8/8 pass, `eslint` clean, `yarn build:release` + `npx cap sync ios` both clean, and
    the resulting iOS bundle was grepped directly to confirm the correct URL landed.

- 2026-02-19 — **RevenueCat rewired for real production account (Iteration 18)**:
  - iOS SDK key `appl_FDZleDDwzBzsjRGiwESYlMsMwvo` set as default in `src/lib/purchases.js` (still env-overridable via `REACT_APP_REVENUECAT_IOS_KEY`).
  - Entitlement identifier renamed `Kite Pro` → **`Kite Premium`** across backend (`server.py` PREMIUM_ENTITLEMENT_ID), `purchases.js` (KITE_PREMIUM_ENTITLEMENT_ID), `PremiumContext.jsx` (initialStatus), and pytest suite.
  - Product model simplified to **monthly only** (dropped `yearly` and `lifetime`). `KITE_PREMIUM_PRODUCT_IDS = { monthly: "monthly" }`; `getOfferings()` only maps MONTHLY packageType; `Paywall.jsx` renders a single plan card.
  - Tests updated (3 assertions) — 45/45 pytest PASS.
  - Bundle ID (`com.feliciakay.kitetrivia`) — confirmed 2026-02-19 against user's Apple Dev / App Store Connect / RevenueCat account.

- 2026-02-17 — Full-experience customer-facing rename (iter 13)
- 2026-02-17 — RevenueCat integration wired (iter 12)
- 2026-02-17 — Mobile paywall + free tier (iter 11)
- 2026-02-17 — Legal pages Privacy / Terms (iter 14)
- 2026-02-17 — StrictMode double-mount bug fix on Play (iter 15)
- 2026-02-17 — Security-only fixes: SameSite=Lax, Open Redirect, Bandit findings (iter 10/16)
- 2026-02-17 — Content expansion → 2193 deduped questions
- Prior — XP curve, Settings, ambient audio, Stripe, splash

## Prioritized Backlog

### P0 (Critical — Before Beta) — blocking App Store submission
- [x] Bundle ID confirmed: `com.feliciakay.kitetrivia`
- [x] Root-cause + fix the physical-device "questions don't load" failure (2026-09-05, see above)
- [x] Single source of truth for entitlement/product IDs + progression gates
- [x] Retryable error UX on question-load failure; global request timeout
- [ ] **Deploy this branch's backend to production** (`kite-trivia-quest.emergent.host` is stale —
      missing `/api/auth/anonymous` and everything else in this branch) — external/Emergent-platform
      action, cannot be done from this environment
- [ ] Merge `anon-purchases-plan` → `main` (currently 11 commits ahead, unpushed to `origin`)
- [ ] Xcode archive + physical-device smoke test with the rebuilt bundle (requires a Mac with
      Xcode + the physical iPhone — see release pipeline below)
- [ ] Bump `CURRENT_PROJECT_VERSION` again after the device smoke test passes, before submitting

### P1
- [ ] Push notifications for daily rewards
- [ ] Multiplayer / friends list
- [ ] Real device sandbox test of full RevenueCat monthly purchase flow (anonymous purchaser)

### P2
- [ ] Richer achievement badges (visual)
- [ ] Seasonal sky themes (autumn, winter)
- [ ] Split server.py (1600+ lines) into routers
- [ ] Preview environment (`*.preview.emergentagent.com`) 404s on `/api/questions` — investigate or
      remove references to it if it's no longer a real environment

## Release Pipeline

The only supported path from source to a device-installable iOS build:

1. `git status` clean / intentional; note the commit SHA being built.
2. Backend: redeploy to production from that SHA (Emergent platform dashboard — external to this
   repo). Sanity-check with `curl https://kite-trivia-quest.emergent.host/api/auth/anonymous -X POST`
   (should return a user object with `session_token`, not 404).
3. Backend tests: `cd backend && pytest tests/ -v` against a local server pointed at the same
   MongoDB shape as production (all 57 must pass; skips are RevenueCat-API-key-gated, expected).
4. `cd frontend && yarn build:release` — NOT plain `yarn build`. Fails loudly if the backend URL
   isn't production HTTPS or a Google-Sign-In marker is present.
5. `npx cap sync ios` — copies the verified web bundle into `ios/App/App/public`.
6. Bump `CURRENT_PROJECT_VERSION` in Xcode (or `project.pbxproj` directly) — one bump per candidate
   that reaches a device, so a build number always maps to one exact commit + bundle.
7. Xcode → Archive → install on a physical device (TestFlight or direct). Run the tester script
   (below) before ever calling a build "ready."
8. Record against the build number: commit SHA, backend deploy timestamp, frontend bundle hash
   (`build/asset-manifest.json`), RevenueCat environment (sandbox/production), device-test result.

### Physical-device tester script (~5 min)
1. Fresh install, launch — no login screen, no Google Sign-In screen.
2. Play several rounds — questions load, answering works, XP/level updates.
3. Play past the free-tier daily cap — gate screen appears with a working upgrade CTA, not a crash.
4. Purchase Premium as a guest (no account) — paywall completes, unlocks immediately.
5. Kill and relaunch the app — still Premium (no account, no login).
6. Tap Restore Purchases on a fresh install signed into the same sandbox tester — Premium returns.
7. Turn on Airplane Mode, open Play — see the retryable error screen (not a blank/frozen screen);
   turn Wi-Fi back on, tap Try Again — questions load.
8. Optional: register/log in with email — works, and does not disrupt existing progress.
9. Delete account from Settings — succeeds, returns to logged-out/anonymous state.

## Content & Config Authoring Workflows (low-risk, no app-logic changes needed)
- **New trivia question**: append a dict to `QUESTIONS` in `backend/questions_db.py` (unique
  `question_id`, 4 `options`, `correct_answer` index, `category`, `difficulty` 1-5, `xp_reward`).
  `backend/tests/test_questions_db_integrity.py` catches malformed/duplicate entries — run it.
- **New trivia domain/category**: just start using a new `category` string on a question — nothing
  else references a fixed category enum. Add a few questions across difficulties 1-5 so the pool
  doesn't starve at any level (the integrity test checks this).
- **New RevenueCat entitlement/product, or new rarity/progression tier**: edit
  `backend/entitlements_config.json` only, then `cd frontend && yarn sync-entitlements` (or just
  `yarn start`/`yarn build`, which do it automatically).
- **New purchasable item (kite/companion/sky theme)**: add a `Character` doc via the existing
  admin/seed path in `server.py`; its `rarity`/`category` automatically pick up the right unlock
  level from `entitlements_config.json` — no new gating code needed unless it's a genuinely new tier.

## Key Files
- `backend/server.py` — FastAPI, all routes, premium gate
- `backend/entitlements_config.json` — single source of truth: entitlement ID, product IDs, progression gates
- `backend/questions_db.py` — 2193 questions
- `backend/tests/test_kite_trivia.py` — main test suite
- `backend/tests/test_questions_db_integrity.py` — content validation
- `frontend/scripts/build-release.js` — the only supported release build command (`yarn build:release`)
- `frontend/src/lib/purchases.js` — RevenueCat wrapper (Capacitor)
- `frontend/src/lib/questionsFetch.js` — question-load failure classification (retry vs. free-tier gate)
- `frontend/src/contexts/PremiumContext.jsx` — entitlement truth
- `frontend/src/components/Paywall.jsx` — monthly plan picker + restore

## Testing
- Backend: 57/57 pytest pass locally (6 skipped, RevenueCat-API-key-gated) as of 2026-09-05
- Frontend: `yarn test` 8/8 pass; `eslint` clean
- Not yet exercised: physical-device install (blocked on production backend redeploy + Xcode/device access)
