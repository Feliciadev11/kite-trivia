import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { API, useAuth } from "../App";
import { logError } from "../lib/logger";
import {
  initPurchases,
  getCustomerInfo,
  purchasePackage as rcPurchase,
  restorePurchases as rcRestore,
  getOfferings,
  isPurchasesAvailable,
} from "../lib/purchases";

/**
 * PremiumContext — one context, one truth.
 *
 * Server is authoritative: every gameplay gate is enforced by /api/premium/status.
 * On native platforms we ALSO sync RevenueCat's local entitlement to the server
 * via /api/premium/sync so the DB and the store stay in lockstep.
 */
const PremiumContext = createContext(null);

export const usePremium = () => {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used inside <PremiumProvider>");
  return ctx;
};

const initialStatus = {
  is_premium: false,
  premium_expires_at: null,
  premium_source: null,
  premium_product_id: null,
  free_rounds_per_day: 3,
  rounds_played_today: 0,
  rounds_remaining_today: 3,
  entitlement_id: "kite_premium",
};

export function PremiumProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offerings, setOfferings] = useState({ ok: false, packages: {} });
  const [servicesAvailable, setServicesAvailable] = useState(isPurchasesAvailable());
  const [paywallOpen, setPaywallOpen] = useState(false);

  // -------- Sync helper --------
  const _pushEntitlementToServer = useCallback(async (rcResult) => {
    if (!rcResult?.ok) return;
    try {
      const { data } = await axios.post(
        `${API}/premium/sync`,
        {
          entitlement_active: !!rcResult.entitlementActive,
          product_id: rcResult.productId || null,
          expires_at_iso: rcResult.expiresAt || null,
          source: "revenuecat",
        },
        { withCredentials: true }
      );
      setStatus(data);
    } catch (e) {
      logError("premium/sync failed", e);
    }
  }, []);

  // -------- Fetch server status --------
  const refreshServerStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/premium/status`, { withCredentials: true });
      setStatus(data);
      return data;
    } catch (e) {
      logError("premium/status failed", e);
      return null;
    }
  }, []);

  // -------- Boot: init SDK, load current entitlement, load offerings --------
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const native = isPurchasesAvailable();
      setServicesAvailable(native);

      if (native && user?.user_id) {
        const initResult = await initPurchases(user.user_id);
        if (!initResult.ok) {
          logError("initPurchases", initResult.reason);
        } else {
          const info = await getCustomerInfo();
          if (info.ok) await _pushEntitlementToServer(info);
          const off = await getOfferings();
          if (alive) setOfferings(off);
        }
      }
      const server = await refreshServerStatus();
      if (alive && server) setStatus(server);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.user_id, _pushEntitlementToServer, refreshServerStatus]);

  // -------- Purchase --------
  const purchase = useCallback(async (which /* "monthly" | "yearly" */) => {
    if (!servicesAvailable) {
      return { ok: false, reason: "unavailable", message: "Kite Premium is available on iOS and Android." };
    }
    const pkg = offerings?.packages?.[which];
    if (!pkg) {
      return { ok: false, reason: "no_package", message: "Product isn't available right now. Please try again in a moment." };
    }
    setPurchasing(true);
    try {
      const result = await rcPurchase(pkg);
      if (result.ok && result.entitlementActive) {
        await _pushEntitlementToServer(result);
        return { ok: true };
      }
      if (result.canceled) {
        return { ok: false, canceled: true, message: "No worries — you can unlock any time." };
      }
      return { ok: false, message: "Purchase couldn't complete. Please try again." };
    } finally {
      setPurchasing(false);
    }
  }, [servicesAvailable, offerings, _pushEntitlementToServer]);

  // -------- Restore --------
  const restore = useCallback(async () => {
    if (!servicesAvailable) {
      return { ok: false, reason: "unavailable", message: "Restoring purchases is only available on iOS and Android." };
    }
    setRestoring(true);
    try {
      const result = await rcRestore();
      if (result.ok) {
        await _pushEntitlementToServer(result);
        return { ok: true, entitlementActive: result.entitlementActive };
      }
      return { ok: false, message: "We couldn't restore your purchases. Please try again." };
    } finally {
      setRestoring(false);
    }
  }, [servicesAvailable, _pushEntitlementToServer]);

  const openPaywall = useCallback(() => setPaywallOpen(true), []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);

  const value = {
    // State
    ...status,
    loading,
    purchasing,
    restoring,
    servicesAvailable,
    offerings, // { ok, packages: {monthly, yearly}, offeringIdentifier }
    paywallOpen,
    // Actions
    refreshServerStatus,
    purchase,
    restore,
    openPaywall,
    closePaywall,
  };

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}
