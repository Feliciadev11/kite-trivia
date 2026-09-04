/**
 * Unit tests for bootPremium's sequencing — the readiness guard described in
 * memory/anonymous-purchases-migration-plan.md's Phase 1. No React mounting,
 * no Capacitor/RevenueCat mocking needed: bootPremium takes its async calls
 * as injected functions specifically so this ordering is directly testable.
 */
import { bootPremium } from "./premiumBoot";

function makeDeps(order) {
  return {
    initPurchases: jest.fn(async (userId) => {
      order.push({ call: "initPurchases", userId });
      return { ok: true };
    }),
    getCustomerInfo: jest.fn(async () => {
      order.push({ call: "getCustomerInfo" });
      return { ok: true, entitlementActive: true, productId: "monthly", expiresAt: null };
    }),
    pushEntitlementToServer: jest.fn(async (info) => {
      order.push({ call: "pushEntitlementToServer", entitlementActive: info.entitlementActive });
    }),
    getOfferings: jest.fn(async () => {
      order.push({ call: "getOfferings" });
      return { ok: true, packages: { monthly: {} } };
    }),
    refreshServerStatus: jest.fn(async () => {
      order.push({ call: "refreshServerStatus" });
      return { is_premium: true, premium_source: "revenuecat" };
    }),
  };
}

test("readiness guard: nothing fires while auth state is still resolving", async () => {
  const order = [];
  const deps = makeDeps(order);

  const result = await bootPremium({
    authLoading: true,
    userId: undefined,
    isNative: true,
    ...deps,
  });

  expect(result.skipped).toBe(true);
  expect(deps.initPurchases).not.toHaveBeenCalled();
  expect(deps.getCustomerInfo).not.toHaveBeenCalled();
  expect(deps.pushEntitlementToServer).not.toHaveBeenCalled();
  expect(deps.getOfferings).not.toHaveBeenCalled();
  expect(deps.refreshServerStatus).not.toHaveBeenCalled();
  expect(order).toEqual([]);
});

test("logged-in premium user relaunching: is_premium true immediately, no blip", async () => {
  const order = [];
  const deps = makeDeps(order);

  const result = await bootPremium({
    authLoading: false, // AuthProvider's /auth/me check has already resolved
    userId: "real-premium-user-123", // ...and resolved to this real, known user
    isNative: true,
    ...deps,
  });

  // Identity was already known before ANY RevenueCat call - never anonymous
  // first and corrected later.
  expect(deps.initPurchases).toHaveBeenCalledWith("real-premium-user-123");

  // Strict ordering: identity resolves, THEN RevenueCat is read, THEN (and
  // only then) the server sync/status calls happen. /premium/sync can never
  // fire before initPurchases has configured the correct identity.
  expect(order.map((o) => o.call)).toEqual([
    "initPurchases",
    "getCustomerInfo",
    "pushEntitlementToServer",
    "getOfferings",
    "refreshServerStatus",
  ]);

  // The one and only server read reports premium true - no intermediate
  // anonymous-derived state was ever produced or returned.
  expect(result.skipped).toBe(false);
  expect(result.server.is_premium).toBe(true);
});

test("no existing session (definitively, not just unresolved): configures RevenueCat anonymously", async () => {
  const order = [];
  const deps = makeDeps(order);

  const result = await bootPremium({
    authLoading: false, // resolved...
    userId: undefined, // ...to "no session"
    isNative: true,
    ...deps,
  });

  // undefined, not a fabricated ID - RevenueCat mints its own anonymous ID.
  expect(deps.initPurchases).toHaveBeenCalledWith(undefined);
  expect(result.skipped).toBe(false);
});

test("web (non-native): skips RevenueCat entirely but still reads server status", async () => {
  const order = [];
  const deps = makeDeps(order);

  const result = await bootPremium({
    authLoading: false,
    userId: "some-user",
    isNative: false,
    ...deps,
  });

  expect(deps.initPurchases).not.toHaveBeenCalled();
  expect(deps.getCustomerInfo).not.toHaveBeenCalled();
  expect(deps.pushEntitlementToServer).not.toHaveBeenCalled();
  expect(deps.refreshServerStatus).toHaveBeenCalled();
  expect(result.server.is_premium).toBe(true);
});
