/**
 * Thin wrapper around @revenuecat/purchases-capacitor. The rest of the app
 * only talks to this module — makes it trivial to swap providers or add a
 * mock for tests.
 *
 * Web behaviour:
 *   RevenueCat's Capacitor SDK only initializes on native platforms.
 *   In a browser, `isPurchasesAvailable()` returns false and every action
 *   returns a graceful `{ ok: false, reason: "unavailable" }` shape. The UI
 *   uses that to show "Available on iOS and Android" copy.
 *
 * Product / entitlement IDs are placeholders — replace with the values you
 * create in App Store Connect and Google Play Console. See README-mobile.md
 * for the exact steps.
 */
import { Capacitor } from "@capacitor/core";
import { logError } from "./logger";

// -------------------- Config (edit here) --------------------
// RevenueCat public SDK keys (safe to ship in the client). Grab them from
// RevenueCat → Project → API keys.
export const REVENUECAT_API_KEY_IOS = process.env.REACT_APP_REVENUECAT_IOS_KEY || "";
export const REVENUECAT_API_KEY_ANDROID = process.env.REACT_APP_REVENUECAT_ANDROID_KEY || "";

// The RevenueCat "entitlement" identifier. Create it in RevenueCat with this
// exact name and attach both product IDs below to it.
export const KITE_PREMIUM_ENTITLEMENT_ID = "kite_premium";

// Store product identifiers. Create these in App Store Connect (iOS) and
// Google Play Console (Android). Both stores can share the same ID string;
// RevenueCat maps them into a single entitlement.
export const KITE_PREMIUM_PRODUCT_IDS = {
  monthly: "kite_premium_monthly",
  yearly: "kite_premium_yearly",
};

// -------------------- Runtime detection --------------------
const IS_NATIVE = Capacitor.isNativePlatform();
const PLATFORM = Capacitor.getPlatform(); // "ios" | "android" | "web"

let _purchasesModule = null;
let _initialized = false;

async function _lazyImport() {
  if (_purchasesModule) return _purchasesModule;
  try {
    // Dynamic import so the web build doesn't pull the native code path.
    _purchasesModule = await import("@revenuecat/purchases-capacitor");
    return _purchasesModule;
  } catch (e) {
    logError("Failed to import @revenuecat/purchases-capacitor", e);
    return null;
  }
}

export const isPurchasesAvailable = () => IS_NATIVE;
export const getPlatform = () => PLATFORM;

// -------------------- Init --------------------
/**
 * Configure the SDK. Idempotent — safe to call multiple times.
 * `appUserId` should be our backend user_id so RevenueCat webhooks include it.
 */
export async function initPurchases(appUserId) {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  if (_initialized) return { ok: true };

  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };

  const apiKey = PLATFORM === "ios" ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  try {
    await mod.Purchases.configure({ apiKey, appUserID: appUserId });
    _initialized = true;
    return { ok: true };
  } catch (e) {
    logError("RevenueCat configure failed", e);
    return { ok: false, reason: "configure_failed", error: String(e?.message || e) };
  }
}

// -------------------- Fetch offerings --------------------
/**
 * Returns the "current" offering's monthly + yearly packages so the paywall UI
 * can show localized prices. Returns { ok: true, packages: {monthly, yearly} }
 * or { ok: false, reason }.
 */
export async function getOfferings() {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  try {
    const result = await mod.Purchases.getOfferings();
    const current = result.current;
    if (!current) return { ok: false, reason: "no_current_offering" };
    const packages = {};
    for (const p of current.availablePackages || []) {
      // RevenueCat auto-classifies MONTHLY / ANNUAL packages via packageType.
      if (p.packageType === "MONTHLY") packages.monthly = p;
      else if (p.packageType === "ANNUAL") packages.yearly = p;
    }
    return { ok: true, packages, offeringIdentifier: current.identifier };
  } catch (e) {
    logError("getOfferings failed", e);
    return { ok: false, reason: "fetch_failed", error: String(e?.message || e) };
  }
}

// -------------------- Purchase --------------------
/**
 * Kicks off the native purchase flow.
 * Returns { ok, entitlementActive, productId, expiresAt, canceled?, error? }.
 */
export async function purchasePackage(pkg) {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  try {
    const result = await mod.Purchases.purchasePackage({ aPackage: pkg });
    const ent = result?.customerInfo?.entitlements?.active?.[KITE_PREMIUM_ENTITLEMENT_ID];
    return {
      ok: true,
      entitlementActive: !!ent,
      productId: ent?.productIdentifier ?? pkg.product?.identifier,
      expiresAt: ent?.expirationDate || null,
      customerInfo: result?.customerInfo,
    };
  } catch (e) {
    // RevenueCat surfaces user cancellation via `userCancelled: true`.
    if (e?.userCancelled) {
      return { ok: false, canceled: true, reason: "canceled" };
    }
    logError("purchasePackage failed", e);
    return { ok: false, reason: "purchase_failed", error: String(e?.message || e) };
  }
}

// -------------------- Restore --------------------
/**
 * Restore prior purchases (required by both Apple and Google reviewers).
 */
export async function restorePurchases() {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  try {
    const result = await mod.Purchases.restorePurchases();
    const ent = result?.entitlements?.active?.[KITE_PREMIUM_ENTITLEMENT_ID];
    return {
      ok: true,
      entitlementActive: !!ent,
      productId: ent?.productIdentifier || null,
      expiresAt: ent?.expirationDate || null,
      customerInfo: result,
    };
  } catch (e) {
    logError("restorePurchases failed", e);
    return { ok: false, reason: "restore_failed", error: String(e?.message || e) };
  }
}

// -------------------- Query current entitlement --------------------
export async function getCustomerInfo() {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  try {
    const result = await mod.Purchases.getCustomerInfo();
    const info = result?.customerInfo || result;
    const ent = info?.entitlements?.active?.[KITE_PREMIUM_ENTITLEMENT_ID];
    return {
      ok: true,
      entitlementActive: !!ent,
      productId: ent?.productIdentifier || null,
      expiresAt: ent?.expirationDate || null,
      customerInfo: info,
    };
  } catch (e) {
    logError("getCustomerInfo failed", e);
    return { ok: false, reason: "query_failed", error: String(e?.message || e) };
  }
}
