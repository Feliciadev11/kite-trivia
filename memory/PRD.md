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
- Preview (dev): https://kite-trivia-quest.preview.emergentagent.com
- Production: https://kite-trivia-quest.emergent.host

## Feature Status

| Feature | Status |
|---------|--------|
| JWT + Google Auth | Working |
| Trivia gameplay + XP curve | Working |
| Leaderboard + my-rank | Working |
| Shop / Stripe Checkout | Working (Apple Pay / Google Pay / Visa / MC) |
| Free-tier daily gate (3 rounds/day) | Working |
| RevenueCat mobile paywall | Wired — iOS SDK key installed |
| Legal pages (/privacy, /terms) | Working in preview; production requires redeploy |

## What's Been Implemented

- 2026-02-19 — **RevenueCat rewired for real production account (Iteration 18)**:
  - iOS SDK key `appl_FDZleDDwzBzsjRGiwESYlMsMwvo` set as default in `src/lib/purchases.js` (still env-overridable via `REACT_APP_REVENUECAT_IOS_KEY`).
  - Entitlement identifier renamed `Kite Pro` → **`Kite Premium`** across backend (`server.py` PREMIUM_ENTITLEMENT_ID), `purchases.js` (KITE_PREMIUM_ENTITLEMENT_ID), `PremiumContext.jsx` (initialStatus), and pytest suite.
  - Product model simplified to **monthly only** (dropped `yearly` and `lifetime`). `KITE_PREMIUM_PRODUCT_IDS = { monthly: "monthly" }`; `getOfferings()` only maps MONTHLY packageType; `Paywall.jsx` renders a single plan card.
  - Tests updated (3 assertions) — 45/45 pytest PASS.
  - Bundle ID (`com.kitetrivia.app`) NOT yet confirmed against Apple Dev Portal / App Store Connect / RevenueCat / Xcode — user will confirm before native build.

- 2026-02-17 — Full-experience customer-facing rename (iter 13)
- 2026-02-17 — RevenueCat integration wired (iter 12)
- 2026-02-17 — Mobile paywall + free tier (iter 11)
- 2026-02-17 — Legal pages Privacy / Terms (iter 14)
- 2026-02-17 — StrictMode double-mount bug fix on Play (iter 15)
- 2026-02-17 — Security-only fixes: SameSite=Lax, Open Redirect, Bandit findings (iter 10/16)
- 2026-02-17 — Content expansion → 2193 deduped questions
- Prior — XP curve, Settings, ambient audio, Stripe, splash

## Prioritized Backlog

### P0 (Critical — Before Beta)
- [ ] Confirm bundle ID `com.kitetrivia.app` matches Apple Dev + App Store Connect + RevenueCat + Xcode
- [ ] Verify RevenueCat production redeploy in production bundle (bundle hash refresh)
- [ ] Admin panel for Stripe purchase verification

### P1
- [ ] Push notifications for daily rewards
- [ ] Multiplayer / friends list
- [ ] Real device sandbox test of full RevenueCat monthly purchase flow

### P2
- [ ] Richer achievement badges (visual)
- [ ] Seasonal sky themes (autumn, winter)
- [ ] Split server.py (1600+ lines) into routers

## Key Files
- `backend/server.py` — FastAPI, all routes, premium gate
- `backend/questions_db.py` — 2193 questions
- `backend/tests/test_kite_trivia.py` — 45 tests
- `frontend/src/lib/purchases.js` — RevenueCat wrapper (Capacitor)
- `frontend/src/contexts/PremiumContext.jsx` — entitlement truth
- `frontend/src/components/Paywall.jsx` — monthly plan picker + restore

## Testing
- Backend: 45/45 pytest pass
- Frontend: lint clean; live signup → /premium/status returns `Kite Premium` entitlement id
