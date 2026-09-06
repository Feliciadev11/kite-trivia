# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kite is a trivia app: React 19 (Capacitor mobile shell for iOS/Android) frontend +
FastAPI/MongoDB backend. Built and iterated on the Emergent platform (emergentagent.com) —
`.emergent/`, `.build-verify/`, `@emergentbase/visual-edits`, and the Emergent OAuth flow
are all artifacts of that platform, not something to remove.

- **Frontend**: React 19 + Tailwind + Shadcn/Radix UI + Framer Motion, bootstrapped with CRA/craco.
- **Backend**: FastAPI (Python, async) over MongoDB via Motor. Single `backend/server.py` module
  (~1550 lines) holding all models and routes — see `memory/PRD.md` backlog for the plan to split
  it into routers.
- **Mobile**: Capacitor 7 wraps the built web app for iOS/Android.
- **Payments**: RevenueCat only. It handles both the "Kite Premium" subscription paywall *and*
  (as of the most recent commit) cosmetic shop purchases (kites/companions/sky themes) — Stripe
  and CashApp have been fully removed from backend and frontend; their old endpoints are kept only
  as explicit "removed" regression tests (`test_old_stripe_purchase_endpoint_removed`, etc.) so
  they never quietly come back.
- **Auth**: JWT-ish cookie sessions (`session_token`, `httponly`, `secure`, `samesite=none` — set
  this way specifically so the cookie attaches from the Capacitor WebView, which is cross-site
  relative to the API) plus Emergent-hosted Google OAuth (`/api/auth/session` exchanges an
  Emergent `session_id` for an app session — see the `session_id=` hash handling in
  `frontend/src/App.js`, which is order-sensitive: **do not hardcode URLs or add fallback
  redirects there, it breaks auth**, per the inline `REMINDER` comment).

`memory/PRD.md` is the living product/architecture doc — check it first for current feature
status, entitlement naming, and the prioritized backlog before assuming something from an older
doc (e.g. `README-mobile.md`) is still accurate; the mobile IAP model has changed more than once
(entitlement `Kite Pro` → `Kite Premium`, product lineup lifetime/yearly/monthly → monthly-only,
then Stripe cosmetic shop → RevenueCat cosmetic shop).

## Commands

### Frontend (`frontend/`)
```bash
yarn install       # engines-pinned: node >=20 <21, yarn >=1.22 <2
yarn start          # craco dev server
yarn build           # production build (outputs to build/, used as Capacitor webDir)
yarn test              # craco test (Jest/RTL)
npx eslint src            # lint (flat config, ignores components/ui/** — those are shadcn-generated)
```
No dedicated `lint` script exists in `package.json`; invoke eslint directly as above.

Capacitor native builds are done outside the Emergent container, on macOS/Windows with
Xcode/Android Studio — see `README-mobile.md` §6 for the full `npx cap add/sync/open` sequence.

### Backend (`backend/`)
```bash
pip install -r requirements.txt
uvicorn server:app --reload --port 8001    # from backend/; requires MONGO_URL, DB_NAME env vars
```
Backend tests are HTTP integration tests, not unit tests against an in-process app — they hit a
running server over the network:
```bash
cd backend
pytest tests/test_kite_trivia.py -v                  # 43 tests: auth, questions, leaderboard, shop, daily reward
pytest tests/test_iter17_regression.py -v             # free-tier gate regression (3 rounds/day)
pytest tests/test_kite_trivia.py::test_login_existing -v   # single test
```
They default to `REACT_APP_BACKEND_URL=https://kite-trivia-quest.preview.emergentagent.com`;
override that env var to point at a local server instead. The `client` fixture registers a fresh
user and seeds `is_premium: true` directly in MongoDB, so gameplay tests aren't blocked by the
free-tier gate — mirror that pattern in any new test that plays rounds. It seeds via MongoDB
rather than `POST /api/premium/sync` because that endpoint independently verifies the entitlement
against RevenueCat's REST API and ignores whatever the client claims (see `sync_premium` in
`server.py`), so it can never be used to fake premium for a test account that made no real
purchase — `test_premium_sync_rejects_spoofed_payload` in `test_kite_trivia.py` covers exactly
that property. Some tests (password reset, purchase sync) connect to MongoDB directly via
`MONGO_URL` to read/seed state the API doesn't expose.

There are duplicate-looking test scripts at the repo root (`backend_test.py`) and in
`backend/backend_test.py` — they are different (different base URL construction); the real,
maintained suite is `backend/tests/`.

## Architecture notes

### Backend structure (`backend/server.py`)
Everything lives in one FastAPI app: Pydantic models → `api_router` (prefixed `/api`) → routes
grouped by comment banners (`# ==================== ... ====================`). Route groups, in
file order: auth, questions/answer, premium (RevenueCat sync/webhook/status), characters (shop:
gates, next-unlock, equip, claim, purchase/sync), sky themes, leaderboard, profile, daily reward.

- **Premium/entitlement flow**: RevenueCat SDK on-device → client posts the entitlement snapshot
  to `POST /api/premium/sync` → server stores it on the user document → `/api/premium/status` is
  the client-safe read. `PREMIUM_ENTITLEMENT_ID = "Kite Premium"` (must exactly match the
  RevenueCat dashboard identifier, case- and space-sensitive) must stay in sync with
  `KITE_PREMIUM_ENTITLEMENT_ID` in `frontend/src/lib/purchases.js`. The server enforces the
  free-tier round gate independently server-side — client-reported premium state is never trusted
  for gating, only for UI.
- **Cosmetic purchase flow**: client payload from a completed RevenueCat one-time purchase is a
  *pointer, not proof* — `POST /api/characters/purchase/sync` independently re-verifies the
  transaction against RevenueCat's REST API (`REVENUECAT_SECRET_API_KEY`) before granting
  anything. `POST /api/premium/webhook` (RevenueCat webhook, `NON_RENEWING_PURCHASE` event) is the
  authoritative backstop for purchases that complete but never reach `purchase/sync` (app killed
  mid-purchase, etc.) — when touching purchase granting logic, both paths need to stay consistent.
- **CORS**: never combine `allow_origins=["*"]` with credentials (CWE-942). Configured via
  `CORS_ORIGINS` (explicit allowlist) plus `CORS_ORIGIN_REGEX`, which defaults to matching
  Emergent preview/prod domains and the Capacitor/Ionic localhost schemes.
- **Rarity/unlock gates**: character/companion/sky-theme unlock levels live server-side as
  `PROGRESSIVE_GATES` and are mirrored in the frontend (`frontend/src/pages/shop/shopConstants.js`
  `RARITY_GATES`) purely for UI badges — the backend is the sole source of truth for
  purchase/equip enforcement, so if you change one you must change both or the UI will lie.

### Frontend structure (`frontend/src`)
- `App.js` owns routing (`react-router-dom`), the `AuthContext`/`AuthProvider` (cookie-session
  auth via axios `withCredentials`, plus `Preferences` from `@capacitor/preferences` for native
  token storage), and the OAuth-callback hash handling described above.
- `contexts/PremiumContext.jsx` is the client-side entitlement source of truth (native paywall
  presentation, customer-center trigger, entitlement state).
- `lib/purchases.js` is a thin wrapper around `@revenuecat/purchases-capacitor` — all RevenueCat
  calls funnel through it. On web (non-native `Capacitor.isNativePlatform()`), every action
  degrades to `{ ok: false, reason: "unavailable" }` since the RevenueCat SDK only initializes on
  native platforms; UI shows "Available on iOS and Android" copy for browser users instead of
  hard-failing.
  - Both `REVENUECAT_API_KEY_IOS`/`ANDROID` and the entitlement/product ID constants live in one
    "Config" block at the top of this file — that's the intended place to change them, not
    scattered inline literals.
- `pages/shop/` is deliberately decomposed (`ItemCard`, `RaritySection`, `ShopTabContent`,
  `EquippedSummary`, `PurchaseDialog`, `shopConstants.js`) with tab config
  (`TAB_CONFIG`: kites / companions / skies) driving each tab from shared ownership/equip-key
  metadata rather than three near-duplicate render branches — follow that pattern for new shop tab
  types rather than hand-rolling another branch.
- `components/ui/` is shadcn-generated (new-york style, see `components.json`) — excluded from
  eslint and not meant to be hand-edited beyond what `npx shadcn add` produces.
- `backend/questions_db.py` holds ~2200 deduped trivia questions as a Python data module (not DB
  seed data loaded at runtime from Mongo) — `backend/scripts/generate_questions.py` is the
  generator used to produce/expand it.

## Working conventions specific to this repo

- `memory/PRD.md` — check for current feature status and the prioritized backlog before starting
  work; update it when you land something the backlog tracked.
- `test_result.md` — a structured YAML-in-Markdown log used to hand off testing context between
  the main coding agent and a separate testing agent on the Emergent platform. The protocol block
  at the top ("DO NOT EDIT OR REMOVE THIS SECTION") is platform tooling, not project
  documentation — leave it intact, append testing data below it if you're following that protocol.
- Entitlement/product identifiers and the progression unlock gates (RevenueCat entitlement name,
  product IDs, `PROGRESSIVE_GATES`/`RARITY_GATES`) now have ONE source of truth:
  `backend/entitlements_config.json`. `backend/server.py` loads it directly.
  `frontend/src/lib/entitlements.generated.json` is a generated copy — `yarn sync-entitlements`
  (or just `yarn start` / `yarn build` / `yarn build:release`, which run it automatically via
  `pre*` hooks) regenerates it from the backend file. `purchases.js`
  (`KITE_PREMIUM_ENTITLEMENT_ID`, `KITE_PREMIUM_PRODUCT_IDS`), `shopConstants.js`
  (`RARITY_GATES`), and `PremiumContext.jsx`'s `initialStatus` all import from the generated file
  instead of hardcoding literals. To add a new product, rename the entitlement, or add a new
  rarity/progression tier: edit `backend/entitlements_config.json` only. (This replaced literals
  duplicated across 4+ files by hand, which had been the source of most premium/IAP regressions
  historically — see `backend/tests/test_kite_trivia.py`'s `entitlement_id` assertion for the
  regression test that would have caught the old drift.)
- Release builds for iOS/Android/TestFlight must go through `cd frontend && yarn build:release`
  (never plain `yarn build`) — it strips any ambient `REACT_APP_BACKEND_URL` from the shell, builds
  against the committed `frontend/.env.production`, and fails the build if the resulting bundle
  doesn't embed a production HTTPS URL or contains a Google-Sign-In marker. See
  `frontend/scripts/build-release.js`; this exists because a plain `yarn build` shipped a
  developer's LAN dev URL (`http://192.168.0.24:8001`) to a physical-device build on 2026-09-05,
  which iOS silently refused to reach at all (ATS blocks cleartext HTTP by default).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
