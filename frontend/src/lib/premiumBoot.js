import { logError } from "./logger";

/**
 * The PremiumContext boot sequence, extracted into its own dependency-light
 * module (no App.js/axios/Capacitor imports) specifically so its ordering
 * can be unit-tested directly, without mounting React or the native
 * RevenueCat SDK. See PremiumContext.jsx for where this is actually used.
 *
 * READINESS GUARD: `authLoading` reflects AuthProvider's own /api/auth/me
 * check (the ONE authoritative signal for "do we already know whether this
 * device has an existing session"). Bailing out here whenever that's still
 * true is what prevents the race that could flip a logged-in premium user's
 * entitlement to false: nothing below this line ever touches RevenueCat or
 * /api/premium/sync until we DEFINITIVELY know whether userId is a real,
 * already-resolved backend user_id or genuinely absent — never a "haven't
 * checked yet" ambiguous state. Once authLoading is false, userId is either
 * case, permanently, for the rest of this boot — there is no third case
 * where a call fires against an identity that might still change out from
 * under it.
 *
 * userId present  -> initPurchases(userId): identified, exactly today's
 *                    behavior, unchanged.
 * userId absent   -> initPurchases(undefined): RevenueCat mints and persists
 *                    its own anonymous ID on-device (new in this phase).
 *
 * Logging in later to an existing account, or registering from an anonymous
 * session, does NOT re-identify an already-configured RevenueCat SDK -
 * that's Purchases.logIn() aliasing, deliberately not handled here yet.
 */
export async function bootPremium({
  authLoading,
  userId,
  isNative,
  initPurchases,
  getCustomerInfo,
  pushEntitlementToServer,
  getOfferings,
  refreshServerStatus,
}) {
  if (authLoading) {
    return { skipped: true, reason: "auth_loading", offerings: null, server: null };
  }

  let offerings = null;
  if (isNative) {
    const initResult = await initPurchases(userId || undefined);
    if (!initResult.ok) {
      logError("initPurchases", initResult.reason);
    } else {
      const info = await getCustomerInfo();
      if (info.ok) await pushEntitlementToServer(info);
      offerings = await getOfferings();
    }
  }
  const server = await refreshServerStatus();
  return { skipped: false, offerings, server };
}
