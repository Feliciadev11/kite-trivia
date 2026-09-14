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
import ENTITLEMENTS from "./entitlements.generated.json";

// -------------------- Config (edit here) --------------------
// RevenueCat public SDK keys (safe to ship in the client). Grab them from
// RevenueCat → Project → API keys.
//
// Real iOS production key.
const REVENUECAT_IOS_DEFAULT_KEY = "appl_FDZleDDwzBzsjRGiwESYlMsMwvo";
export const REVENUECAT_API_KEY_IOS =
  process.env.REACT_APP_REVENUECAT_IOS_KEY || REVENUECAT_IOS_DEFAULT_KEY;
// No default for Android — an iOS (appl_) key can't authenticate an Android
// app in RevenueCat, so falling back to it would silently misconfigure the
// SDK instead of surfacing a fixable error. Set REACT_APP_REVENUECAT_ANDROID_KEY
// (a goog_ key) once the Android app is created in RevenueCat; until then
// initPurchases() reports reason: "missing_api_key" on Android.
export const REVENUECAT_API_KEY_ANDROID =
  process.env.REACT_APP_REVENUECAT_ANDROID_KEY || null;

// The RevenueCat "entitlement" identifier — must match the exact identifier
// configured in your RevenueCat dashboard. Case-sensitive, with a space.
// Sourced from backend/entitlements_config.json (see that file to change it).
export const KITE_PREMIUM_ENTITLEMENT_ID = ENTITLEMENTS.premium_entitlement_id;

// Store product identifiers. Create these in App Store Connect (iOS) and
// Google Play Console (Android). Sourced from backend/entitlements_config.json.
export const KITE_PREMIUM_PRODUCT_IDS = ENTITLEMENTS.premium_product_ids;

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
 *
 * `appUserId` should be our backend user_id so RevenueCat webhooks include
 * it, when one is already known. Pass nothing (or a falsy value) to
 * configure RevenueCat ANONYMOUSLY instead — it mints and persists its own
 * on-device anonymous ID. Used when there's no backend session yet (see
 * bootPremium in PremiumContext.jsx). Re-identifying an already-configured
 * SDK onto a real user_id later requires Purchases.logIn(), not a second
 * call here — that aliasing step is deliberately not implemented yet.
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
    const config = appUserId ? { apiKey, appUserID: appUserId } : { apiKey };
    await mod.Purchases.configure(config);
    _initialized = true;
    return { ok: true };
  } catch (e) {
    logError("RevenueCat configure failed", e);
    return { ok: false, reason: "configure_failed", error: String(e?.message || e) };
  }
}

// -------------------- Fetch offerings --------------------
/**
 * Returns the "current" offering's monthly package so the paywall UI can
 * show localized prices. Returns
 * { ok: true, packages: {monthly} } or { ok: false, reason }.
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
      if (p.packageType === "MONTHLY") packages.monthly = p;
    }
    return { ok: true, packages, offeringIdentifier: current.identifier, offering: current };
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

// -------------------- One-time (non-subscription) products --------------------
// Used for a la carte Shop purchases (kites/companions/skies), as opposed to
// the Premium subscription which goes through getOfferings/purchasePackage.
// Each purchasable item has its own store product, keyed by character.product_id.

/**
 * Fetches store product info (localized price, etc.) for the given product
 * identifiers. Returns { ok, products } where `products` is keyed by
 * product id.
 */
export async function getStoreProducts(productIds) {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  if (!productIds || productIds.length === 0) return { ok: true, products: {} };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  try {
    const result = await mod.Purchases.getProducts({
      productIdentifiers: productIds,
      type: "NON_SUBSCRIPTION",
    });
    const products = {};
    for (const p of result?.products || []) {
      products[p.identifier] = p;
    }
    return { ok: true, products };
  } catch (e) {
    logError("getStoreProducts failed", e);
    return { ok: false, reason: "fetch_failed", error: String(e?.message || e) };
  }
}

// Picks the transaction for `productId`, preferring an exact match. Shared
// by purchaseProduct() and the pending-purchase reconciliation below.
function pickNonSubTransaction(txns, productId) {
  return txns.find((t) => t.productIdentifier === productId) || txns[txns.length - 1] || null;
}

/**
 * Purchases a single non-subscription store product (as returned by
 * `getStoreProducts`). Returns
 * { ok, transactionId, productId, canceled?, error? }.
 *
 * StoreKit can finish the purchase a beat before RevenueCat's own
 * customerInfo cache reflects it (the promise resolves, but
 * nonSubscriptionTransactions is still the pre-purchase snapshot) — a real
 * race we hit in testing. If the transaction isn't in the immediate result,
 * force one fresh customerInfo fetch before giving up.
 */
export async function purchaseProduct(product) {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  const productId = product.identifier;
  try {
    const result = await mod.Purchases.purchaseStoreProduct({ product });
    let txns = result?.customerInfo?.nonSubscriptionTransactions || [];
    let txn = pickNonSubTransaction(txns, productId);
    let customerInfo = result?.customerInfo;

    if (!txn) {
      const fresh = await mod.Purchases.getCustomerInfo().catch(() => null);
      txns = fresh?.customerInfo?.nonSubscriptionTransactions || [];
      txn = pickNonSubTransaction(txns, productId);
      customerInfo = fresh?.customerInfo || customerInfo;
    }

    return {
      ok: true,
      transactionId: txn?.transactionIdentifier || null,
      productId,
      customerInfo,
    };
  } catch (e) {
    if (e?.userCancelled) {
      return { ok: false, canceled: true, reason: "canceled" };
    }
    logError("purchaseProduct failed", e);
    return { ok: false, reason: "purchase_failed", error: String(e?.message || e) };
  }
}

/**
 * Every non-subscription transaction RevenueCat currently has on file for
 * this customer, keyed by product id. Used to silently re-sync purchases
 * that completed at the store/RevenueCat level but never reached our
 * backend (network drop between purchase and /characters/purchase/sync,
 * app killed mid-purchase, etc.) — the client-side half of the "restore"
 * story for a la carte items, mirroring what restorePurchases() does for
 * the subscription.
 */
export async function listNonSubscriptionTransactions() {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const mod = await _lazyImport();
  if (!mod) return { ok: false, reason: "sdk_missing" };
  try {
    const result = await mod.Purchases.getCustomerInfo();
    const txns = result?.customerInfo?.nonSubscriptionTransactions || [];
    const byProductId = {};
    for (const t of txns) {
      // Keep the latest transaction per product.
      byProductId[t.productIdentifier] = pickNonSubTransaction(
        txns.filter((x) => x.productIdentifier === t.productIdentifier),
        t.productIdentifier
      );
    }
    return { ok: true, transactions: byProductId };
  } catch (e) {
    logError("listNonSubscriptionTransactions failed", e);
    return { ok: false, reason: "query_failed", error: String(e?.message || e) };
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

// -------------------- RevenueCat UI (native paywall + customer center) --------------------
// Uses @revenuecat/purchases-capacitor-ui which requires the core SDK to be
// configured first (initPurchases). Both APIs return a structured result and
// swallow the "SDK unavailable" case for the web build.

let _uiModule = null;
async function _lazyImportUI() {
  if (_uiModule) return _uiModule;
  try {
    _uiModule = await import("@revenuecat/purchases-capacitor-ui");
    return _uiModule;
  } catch (e) {
    logError("Failed to import @revenuecat/purchases-capacitor-ui", e);
    return null;
  }
}

/**
 * Presents the RevenueCat native Paywall UI (managed template configured in
 * the RevenueCat dashboard). Resolves after the user closes or purchases.
 *
 * @returns { ok, purchased, entitlementActive, canceled?, reason?, error? }
 */
export async function presentPaywall({ requiredEntitlementIdentifier } = {}) {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const ui = await _lazyImportUI();
  if (!ui) return { ok: false, reason: "sdk_missing" };
  try {
    // RevenueCatUI.presentPaywall returns one of:
    //   NOT_PRESENTED / ERROR / CANCELLED / PURCHASED / RESTORED
    const opts = requiredEntitlementIdentifier
      ? { requiredEntitlementIdentifier }
      : {};
    const result = await ui.RevenueCatUI.presentPaywall(opts);
    const outcome = result?.result || result;
    const info = await getCustomerInfo();
    return {
      ok: true,
      outcome, // "NOT_PRESENTED" | "ERROR" | "CANCELLED" | "PURCHASED" | "RESTORED"
      purchased: outcome === "PURCHASED" || outcome === "RESTORED",
      canceled: outcome === "CANCELLED",
      entitlementActive: !!info.entitlementActive,
      productId: info.productId || null,
      expiresAt: info.expiresAt || null,
    };
  } catch (e) {
    logError("presentPaywall failed", e);
    return { ok: false, reason: "paywall_failed", error: String(e?.message || e) };
  }
}

/**
 * Presents RevenueCat's Customer Center — the built-in "Manage your
 * subscription" screen that App Store reviewers expect. Handles restore,
 * refund requests, plan changes, and cancellation help without any custom UI.
 */
export async function presentCustomerCenter() {
  if (!IS_NATIVE) return { ok: false, reason: "unavailable" };
  const ui = await _lazyImportUI();
  if (!ui) return { ok: false, reason: "sdk_missing" };
  try {
    await ui.RevenueCatUI.presentCustomerCenter();
    // After dismiss, refresh entitlement state for the app.
    const info = await getCustomerInfo();
    return {
      ok: true,
      entitlementActive: !!info.entitlementActive,
      productId: info.productId || null,
      expiresAt: info.expiresAt || null,
    };
  } catch (e) {
    logError("presentCustomerCenter failed", e);
    return { ok: false, reason: "customer_center_failed", error: String(e?.message || e) };
  }
}

// -------------------- Pending-purchase reconciliation --------------------
/**
 * Pure diff: which shop characters have a RevenueCat transaction on file but
 * aren't in the user's owned lists yet. Covers a purchase that completed at
 * the store/RevenueCat level but never reached /characters/purchase/sync
 * (network drop, app killed mid-purchase) — the /premium/webhook backstop
 * may have already granted it server-side, or it's still waiting on us.
 *
 * @param {Array<{character_id: string, product_id?: string}>} characters
 * @param {Set<string>|string[]} ownedCharacterIds - union of the user's
 *   owned_characters/owned_companions/owned_sky_themes
 * @param {Record<string, {transactionIdentifier?: string}>} transactionsByProductId
 *   from listNonSubscriptionTransactions()
 * @returns {Array<{characterId: string, productId: string, transactionId: string}>}
 */
export function findUnsyncedPurchases(characters, ownedCharacterIds, transactionsByProductId) {
  const owned = ownedCharacterIds instanceof Set ? ownedCharacterIds : new Set(ownedCharacterIds || []);
  const unsynced = [];
  for (const c of characters || []) {
    if (!c.product_id || owned.has(c.character_id)) continue;
    const txn = transactionsByProductId?.[c.product_id];
    if (txn?.transactionIdentifier) {
      unsynced.push({
        characterId: c.character_id,
        productId: c.product_id,
        transactionId: txn.transactionIdentifier,
      });
    }
  }
  return unsynced;
}
