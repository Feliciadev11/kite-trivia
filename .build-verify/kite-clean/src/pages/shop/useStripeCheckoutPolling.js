import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API } from "../../App";

/**
 * Polls the backend for Stripe Checkout status when the user returns from
 * Stripe with `?session_id=...` (success) or `?canceled=1` in the URL.
 *
 * Uses refs for `refreshUser` and `loadCharacters` so re-renders of the
 * AuthContext (which doesn't memoize its callbacks) don't restart the poll.
 *
 * @param {{
 *   searchParams: URLSearchParams,
 *   setSearchParams: (next: object, options?: object) => void,
 *   refreshUser: () => Promise<void>,
 *   loadCharacters: () => Promise<void>,
 * }} params
 * @returns {{
 *   purchaseDialog: boolean,
 *   setPurchaseDialog: (open: boolean) => void,
 *   paymentStatus: 'polling' | 'paid' | 'failed' | null,
 *   setPaymentStatus: (s: 'polling' | 'paid' | 'failed' | null) => void,
 * }}
 */
export const useStripeCheckoutPolling = ({
  searchParams,
  setSearchParams,
  refreshUser,
  loadCharacters,
}) => {
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const refreshUserRef = useRef(refreshUser);
  const loadCharactersRef = useRef(loadCharacters);
  useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  useEffect(() => { loadCharactersRef.current = loadCharacters; }, [loadCharacters]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const canceled = searchParams.get("canceled");

    if (canceled) {
      toast.info("Payment canceled. Your sky stays as it was.");
      setSearchParams({}, { replace: true });
      return;
    }
    if (!sessionId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 8;
    const interval = 2000;

    setPurchaseDialog(true);
    setPaymentStatus("polling");

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data } = await axios.get(
          `${API}/payments/checkout/status/${sessionId}`,
          { withCredentials: true }
        );
        if (cancelled) return;

        if (data.payment_status === "paid" || data.granted) {
          setPaymentStatus("paid");
          toast.success("Item unlocked — welcome to your new sky!");
          await refreshUserRef.current();
          await loadCharactersRef.current();
          setTimeout(() => {
            if (cancelled) return;
            setPurchaseDialog(false);
            setPaymentStatus(null);
            setSearchParams({}, { replace: true });
          }, 1800);
          return;
        }
        if (data.status === "expired") {
          setPaymentStatus("failed");
          toast.error("Payment session expired. Please try again.");
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          setPaymentStatus("failed");
          toast.error("Payment is still processing. Check back in a moment.");
          return;
        }
        setTimeout(poll, interval);
      } catch (e) {
        if (cancelled) return;
        setPaymentStatus("failed");
        toast.error(e.response?.data?.detail || "Could not verify payment.");
      }
    };
    poll();

    return () => { cancelled = true; };
  }, [searchParams, setSearchParams]);

  return { purchaseDialog, setPurchaseDialog, paymentStatus, setPaymentStatus };
};
