# Kite — Mobile Paywall Setup (Capacitor + RevenueCat)

Capacitor app with RevenueCat handling Apple App Store + Google Play billing,
plus RevenueCat's native Paywall UI and Customer Center. Source code is
complete; this doc lists the exact IDs to configure once your Apple / Google
accounts exist.

---

## 1. Fixed identifiers (already wired in code)

| Item | Value | Where |
|---|---|---|
| RevenueCat entitlement | **`Kite Pro`** | Server + `src/lib/purchases.js` |
| Bundle / Package | **`com.kitetrivia.app`** | `capacitor.config.json` |
| Product ID — lifetime | **`lifetime`** | `src/lib/purchases.js` |
| Product ID — yearly | **`yearly`** | `src/lib/purchases.js` |
| Product ID — monthly | **`monthly`** | `src/lib/purchases.js` |
| Test API key (dev) | `test_zbkylBVKIMySdYkgspQwisDwjTN` | Fallback in `src/lib/purchases.js` |
| Free-tier rounds/day | **3** (server-enforced) | `backend/server.py` `FREE_ROUNDS_PER_DAY` |

---

## 2. RevenueCat setup (do this first — it drives the stores)

1. Sign in to https://app.revenuecat.com. Under **Projects → New Project**,
   create a project called **Kite**.
2. **API keys** (Project settings → API keys). Copy:
   - iOS SDK key → `REACT_APP_REVENUECAT_IOS_KEY` in `frontend/.env`
   - Android SDK key → `REACT_APP_REVENUECAT_ANDROID_KEY` in `frontend/.env`
   - The test key `test_zbkylBVKIMySdYkgspQwisDwjTN` is used as a fallback if
     these aren't set, so you can test in the RevenueCat sandbox immediately.
3. **Entitlement**: Entitlements → **New entitlement** → identifier
   **`Kite Pro`** (must match exactly — case-sensitive).
4. **Products**: Products → **New product** → create three, each attached to
   the `Kite Pro` entitlement:
   - `lifetime` — non-consumable
   - `yearly`   — auto-renewing subscription (annual)
   - `monthly`  — auto-renewing subscription (monthly)
5. **Offering**: Offerings → **Current** → create packages:
   - `$rc_lifetime` → `lifetime`
   - `$rc_annual`   → `yearly`
   - `$rc_monthly`  → `monthly`
6. **Paywall template**: Paywalls → **New paywall** → attach to the current
   offering. Design in the dashboard (colors, hero, benefits). The Capacitor
   UI SDK renders this template natively via
   `RevenueCatUI.presentPaywall({ requiredEntitlementIdentifier: "Kite Pro" })`.
7. **Customer Center**: Customer Center → enable → configure the reasons /
   help articles you want shown to subscribers who tap "Manage subscription".
8. **Webhook**: Integrations → Webhooks → set URL
   `https://<your-backend>/api/premium/webhook`. Copy the signing secret to
   `backend/.env` as `REVENUECAT_WEBHOOK_SECRET` when you're ready to enable
   verification.

---

## 3. Apple App Store Connect

1. Enroll in the Apple Developer Program.
2. Apps → **New App**:
   - Bundle ID: `com.kitetrivia.app`
   - Name: `Kite`
3. Features → **In-App Purchases → +** and create:
   - Product ID: **`lifetime`**  — non-consumable
   - Product ID: **`yearly`**    — auto-renewable subscription, 1 year
   - Product ID: **`monthly`**   — auto-renewable subscription, 1 month
   - Put the two subscriptions in a group called `Kite Pro`.
4. Fill in localized display names, descriptions, and prices for review.
5. App Store Connect → App Information → **App-Specific Shared Secret** →
   generate; paste into RevenueCat → App settings → iOS Apple.

---

## 4. Google Play Console

1. Enroll in the Google Play Console ($25 one-time).
2. Create the app with package name `com.kitetrivia.app`.
3. Monetize → **In-app products → Create**:
   - Product ID: **`lifetime`** (managed / non-consumable)
4. Monetize → **Subscriptions → Create**:
   - Product ID: **`yearly`** — auto-renewing yearly base plan
   - Product ID: **`monthly`** — auto-renewing monthly base plan
5. Setup → **API access** → link a Google Cloud service account with **Play
   Developer API** access. Download the JSON key and upload to RevenueCat →
   App settings → Google Play.

---

## 5. Environment variables

### `frontend/.env`
```
REACT_APP_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxx
```
(Both optional — the test key is embedded as a fallback for early sandbox testing.)

### `backend/.env`
```
REVENUECAT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxx   # add once webhook is configured
```

---

## 6. Native builds (from your Mac / PC — not the Emergent container)

```bash
cd frontend
yarn build

# One-time
npx cap add ios       # macOS + Xcode required
npx cap add android   # Android Studio required

# Every time you change web code
npx cap sync

# Open in native IDE for signing + submission
npx cap open ios       # Xcode
npx cap open android   # Android Studio
```

Signing:
- **iOS**: In Xcode, set the signing team; product IDs from step 3 must be
  approved before TestFlight can render the paywall.
- **Android**: Upload the signed release bundle to an internal test track.

---

## 7. Runtime behavior

| Platform | Paywall entry | Customer Center | Purchase flow |
|---|---|---|---|
| Web (browser) | Custom `<Dialog>` fallback with "unavailable on web" banner | Not available; managed via native app | Not available |
| iOS / Android (Capacitor) | `RevenueCatUI.presentPaywall({requiredEntitlementIdentifier:"Kite Pro"})` — RevenueCat native template with localized prices | `RevenueCatUI.presentCustomerCenter()` — opens on Sparkle-tap when user is already premium | Native App Store / Play sheet |

Entitlement changes flow through:
1. RevenueCat SDK returns the updated `customerInfo`.
2. Client posts to `POST /api/premium/sync` with the entitlement snapshot.
3. Server updates `users.is_premium` + owned items + returns fresh `/api/premium/status`.
4. Server enforces `/api/questions` free-tier gate independently — client trust is not required.

---

## 8. Testing steps

### Web sandbox (today, no store accounts needed)
1. Register a new user, play 3 rounds via `/play`.
2. 4th round → soft free-tier gate with "Unlock Kite Pro" CTA.
3. Simulate a purchase server-side:
   ```bash
   curl -X POST http://localhost:8001/api/premium/sync \
     -b /tmp/cookies.txt -H 'Content-Type: application/json' \
     -d '{"entitlement_active":true,"product_id":"yearly","source":"revenuecat_ios"}'
   ```
4. Reload — unlimited rounds, all items owned, Sparkle icon turns emerald.

### iOS sandbox (after Apple setup)
1. Add a Sandbox tester in App Store Connect → Users and Access → Sandbox.
2. `npx cap run ios` — install on the device with the tester's Apple ID signed
   in via **Settings → App Store → Sandbox Account**.
3. Play 3 rounds → gate → tap **Unlock Kite Pro** → RevenueCat's native
   paywall opens showing the products you configured (lifetime / yearly /
   monthly with localized prices).
4. Complete a sandbox purchase → paywall closes → `/api/premium/sync` fires →
   entitlement flips → Sparkle icon turns emerald.
5. Kill + reopen → still premium (loaded from RevenueCat + server DB).
6. Tap Sparkle icon → Customer Center opens (manage / cancel / restore).
7. Cancel in Customer Center → webhook fires → server flips off premium at
   next `/api/premium/sync`.

### Android sandbox (after Google setup)
1. Add the test account (email) in Play Console → Setup → License testing.
2. Upload the signed release bundle to Internal testing.
3. Install via the internal link, sign in with the tester account.
4. Same flow as iOS. RevenueCat native paywall + Customer Center both render.

---

## 9. Files touched this iteration

**Backend**
- `backend/server.py` — Entitlement ID → `"Kite Pro"` (constant `PREMIUM_ENTITLEMENT_ID`).
- `backend/tests/test_kite_trivia.py` — updated the expected entitlement_id assertion.

**Frontend**
- `frontend/package.json` — added `@revenuecat/purchases-capacitor-ui@13.2.1`.
- `frontend/src/lib/purchases.js` — new product IDs (`lifetime` / `yearly` / `monthly`), test API key fallback, `presentPaywall()`, `presentCustomerCenter()`, lifetime package in `getOfferings()`.
- `frontend/src/contexts/PremiumContext.jsx` — `presentNativePaywall`, `openCustomerCenter`, entitlement default → `"Kite Pro"`.
- `frontend/src/components/Paywall.jsx` — 3-plan picker (yearly / lifetime / monthly), copy → `Kite Pro`.
- `frontend/src/pages/Dashboard.jsx` — Sparkle tap opens Customer Center when premium, native paywall otherwise.
- `frontend/src/pages/Play.jsx` — free-tier CTA calls `presentNativePaywall()`, copy → `Kite Pro`.

Untouched: gameplay, XP curve, question DB, Stripe web shop, audio, sky themes, dashboard/leaderboard/profile core.
