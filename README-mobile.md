# Kite — Mobile Paywall Setup (Capacitor + RevenueCat)

This document tells you the exact steps and identifiers to configure once you
have your Apple Developer and Google Play Console accounts. All source code
is already in place — nothing to write, only IDs to plug in.

---

## 1. Product identifiers you need to create

### RevenueCat (create first — RevenueCat drives the other two stores)

1. Sign up at https://app.revenuecat.com and create a Project called **Kite**.
2. Under **Project settings → API keys**, copy:
   - **iOS SDK key** → set in `frontend/.env` as `REACT_APP_REVENUECAT_IOS_KEY`
   - **Android SDK key** → set in `frontend/.env` as `REACT_APP_REVENUECAT_ANDROID_KEY`
3. Under **Products → New product**, create these two products (identifiers **must** match exactly):
   - `kite_premium_monthly` — auto-renewing subscription, monthly
   - `kite_premium_yearly`  — auto-renewing subscription, yearly
4. Under **Entitlements → New entitlement**, create:
   - Identifier: `kite_premium`  ← **must match** `KITE_PREMIUM_ENTITLEMENT_ID` in `src/lib/purchases.js`
   - Attach both products (`kite_premium_monthly` and `kite_premium_yearly`) to this entitlement.
5. Under **Offerings → Current**, create an offering with two packages:
   - `$rc_monthly` package → attach `kite_premium_monthly`
   - `$rc_annual`  package → attach `kite_premium_yearly`
6. Under **Integrations → Webhooks**, set the URL:
   - `https://<your-backend-domain>/api/premium/webhook`
   - Copy the **webhook secret** for later — add it to `backend/.env` as `REVENUECAT_WEBHOOK_SECRET`.

### Apple App Store Connect

1. Enroll in the Apple Developer Program ($99/yr).
2. In App Store Connect → **Apps → New App**:
   - Bundle ID: `com.kitetrivia.app` (matches `capacitor.config.json` `appId`)
   - Name: `Kite`
3. Under **Features → In-App Purchases → +**, create:
   - Product ID: `kite_premium_monthly`  — Auto-renewable subscription
   - Product ID: `kite_premium_yearly`   — Auto-renewable subscription
   - Both go in a subscription group called `Kite Premium`.
4. Fill in the required review metadata (localized display name, description, price).
5. Under **App Information → App-Specific Shared Secret**, generate the secret and paste it into RevenueCat → App settings → iOS Apple.

### Google Play Console

1. Enroll in the Google Play Console ($25 one-time).
2. Create the app with package name `com.kitetrivia.app`.
3. Under **Monetize → Subscriptions → Create subscription**, add:
   - Product ID: `kite_premium_monthly` — auto-renewing monthly
   - Product ID: `kite_premium_yearly`  — auto-renewing yearly
4. Under **Setup → API access**, create/link a Google Cloud service account with the **Play Developer API** and grant it access. Download the JSON key and upload it into RevenueCat → App settings → Google Play.

---

## 2. Environment variables

### `frontend/.env`
```
REACT_APP_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `backend/.env`
```
REVENUECAT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxx   # optional today; wire the verifier once you set it
```

The current backend accepts the RevenueCat webhook without signature checking
so testing can happen day-1. Once you paste the secret, add HMAC verification
to `POST /api/premium/webhook` in `backend/server.py` (~L750).

---

## 3. Building the native apps

The container already contains:
- `frontend/capacitor.config.json`
- `frontend/src/lib/purchases.js` — RevenueCat wrapper
- `frontend/src/contexts/PremiumContext.jsx` — entitlement state
- `frontend/src/components/Paywall.jsx` — paywall UI

On your local Mac (iOS) or PC (Android), from `/app/frontend`:

```bash
# Build the web bundle Capacitor will wrap
yarn build

# Add the native platform folders (one-time)
npx cap add ios      # macOS + Xcode required
npx cap add android  # Android Studio required

# Sync the web build into the native projects (run this after every yarn build)
npx cap sync

# Open in the native IDE
npx cap open ios       # Xcode
npx cap open android   # Android Studio
```

Then in Xcode, set the signing team and provisioning profile. In Android
Studio, sign the Play release bundle with your upload key. Both stores
require submission through their respective consoles.

---

## 4. What the code does out of the box

- **On web:** `isPurchasesAvailable()` returns `false`. The Paywall shows an
  amber "Kite Premium is purchased through the App Store or Google Play"
  banner. Users on web are never blocked from playing (they hit the same
  free-round cap and can either wait or open the mobile app to subscribe).
- **On iOS/Android:** The Paywall shows localized pricing pulled from
  RevenueCat's `Offerings`. Purchase, cancel, and restore paths all bubble
  through `PremiumContext` → `/api/premium/sync` → server DB.
- **Server entitlement:** `/api/questions` returns HTTP 402 with a structured
  `detail` object once a free user has played `FREE_ROUNDS_PER_DAY` (3)
  rounds today. Premium users bypass this entirely. The client shows a soft
  wall UI, never a hard error toast.
- **Restore purchases:** always available on native, disabled with tooltip on
  web. Required for App Store approval per §3.1.1.
- **Loading states:** `usePremium().purchasing` / `.restoring` drive spinners
  on the Paywall buttons. `usePremium().loading` is true while the initial
  entitlement bootstrap runs on app open.

---

## 5. Testing steps

### Testing on the web preview (works today, no store accounts needed)

1. Play 3 rounds as a fresh user.
2. On the 4th `/api/questions` call, backend returns 402. UI shows the
   free-tier gate with "Unlock Kite Premium" CTA.
3. Click "Unlock Kite Premium" → Paywall opens with the "web notice" banner.
4. From backend, simulate the successful purchase:
   ```bash
   curl -X POST http://localhost:8001/api/premium/sync \
     -b /tmp/cookies.txt -H 'Content-Type: application/json' \
     -d '{"entitlement_active":true,"product_id":"kite_premium_monthly","source":"revenuecat_ios"}'
   ```
5. Reload the app — user should be premium, gate cleared, unlimited rounds,
   all items unlocked in Shop.

### Testing on iOS (sandbox)

1. Add a Sandbox tester in App Store Connect → Users and Access → Sandbox.
2. On the test iPhone: Settings → App Store → sign out of the production
   Apple ID (Sandbox testers sign in *from the app itself* the first time a
   purchase is attempted).
3. `npx cap run ios` from a Mac, or install a TestFlight build.
4. Play 3 free rounds → free-tier gate appears.
5. Tap "Unlock Kite Premium" → App Store sandbox sheet appears with monthly
   and yearly prices.
6. Complete the purchase (sandbox is free) → premium unlocks immediately,
   gate clears.
7. Kill the app, reopen → premium persists (entitlement pulled from
   RevenueCat on init).
8. On a fresh install/device, log into the same Kite account → tap
   "Restore purchases" → premium restores.
9. Cancel the sandbox subscription in Settings → Apple ID → Subscriptions →
   after the accelerated sandbox period, `/api/premium/webhook` receives the
   expiry event and the server flips the user off premium at next sync.

### Testing on Android (Play Billing sandbox)

1. Add the test account (email) in Play Console → Setup → License testing.
2. Upload the signed release bundle to an internal test track.
3. Install via the internal-testing URL on the test device.
4. Same flow as iOS: play 3 rounds → paywall → purchase (Play sandbox is
   free for license testers) → premium unlocks → verify persistence and
   restore across reinstalls.

### Verifying entitlement server-side

Any authenticated request:
```bash
curl -b /tmp/cookies.txt https://<backend>/api/premium/status
```
Expected: `{ is_premium: true, rounds_remaining_today: null, ... }`

---

## 6. Files added / changed in this iteration

**Backend**
- `backend/server.py` — added `User.is_premium` fields, free-tier gate at `/api/questions`, `GET /api/premium/status`, `POST /api/premium/sync`, `POST /api/premium/webhook` (stub).

**Frontend**
- `frontend/capacitor.config.json` — new
- `frontend/package.json` — added `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@revenuecat/purchases-capacitor`
- `frontend/src/lib/purchases.js` — new. RevenueCat SDK wrapper with web-safe fallback.
- `frontend/src/contexts/PremiumContext.jsx` — new. App-wide entitlement state.
- `frontend/src/components/Paywall.jsx` — new. Paywall dialog.
- `frontend/src/App.js` — mounted `<PremiumProvider>` and `<PaywallHost />`.
- `frontend/src/pages/Play.jsx` — handles 402 free-tier response with soft wall.
- `frontend/src/pages/Dashboard.jsx` — Premium sparkle icon in top nav (shows remaining free rounds on hover, opens Paywall on tap).

Nothing else was changed. Existing gameplay, Stripe web shop, question DB,
XP curve, sky themes, and audio are all untouched.
