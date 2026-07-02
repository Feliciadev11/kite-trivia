import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Sparkles, Infinity as InfinityIcon, Palette, Heart } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { usePremium } from "../contexts/PremiumContext";
import { toast } from "sonner";

const BENEFITS = [
  { Icon: InfinityIcon, label: "Unlimited trivia — every round, every day" },
  { Icon: Palette,      label: "Exclusive skies + seasonal releases" },
  { Icon: Heart,        label: "Every kite & companion in your collection" },
  { Icon: Sparkles,     label: "Every future update, included" },
];

/**
 * Paywall dialog — used across mobile IAP and the (future) web sub flow.
 * Read-only usage: `usePremium().openPaywall()` from anywhere.
 */
export const Paywall = () => {
  const {
    paywallOpen, closePaywall,
    purchasing, restoring, servicesAvailable,
    offerings, purchase, restore,
    is_premium,
  } = usePremium();

  const [selected, setSelected] = useState("yearly");

  const monthly = offerings?.packages?.monthly;
  const yearly = offerings?.packages?.yearly;
  const lifetime = offerings?.packages?.lifetime;

  const priceLabel = (pkg, fallback) => {
    if (!pkg) return fallback;
    // RevenueCat exposes localized price via product.priceString / product.price
    return pkg.product?.priceString || fallback;
  };

  const handlePurchase = async () => {
    const result = await purchase(selected);
    if (result.ok) {
      toast.success("The full sky is open. Thank you for supporting Kite ✨");
      closePaywall();
      return;
    }
    if (result.canceled) {
      toast.info(result.message || "No worries.");
      return;
    }
    toast.error(result.message || "Purchase couldn't complete.");
  };

  const handleRestore = async () => {
    const result = await restore();
    if (result.ok && result.entitlementActive) {
      toast.success("Purchases restored — you're all set.");
      closePaywall();
      return;
    }
    if (result.ok) {
      toast.info("No previous purchases found on this account.");
      return;
    }
    toast.error(result.message || "We couldn't restore your purchases.");
  };

  return (
    <Dialog open={paywallOpen} onOpenChange={(o) => !o && !purchasing && closePaywall()}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden bg-gradient-to-b from-sky-50 via-white to-sky-100 border-sky-200"
        data-testid="paywall-dialog"
      >
        {/* Dreamy header — shadcn Dialog provides its own top-right close X */}
        <div className="relative px-6 pt-8 pb-6 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 to-pink-200 flex items-center justify-center mb-4"
          >
            <Sparkles className="w-7 h-7 text-amber-600" />
          </motion.div>

          <DialogTitle className="text-2xl font-semibold text-sky-900">
            Unlock the Full Experience
          </DialogTitle>
          <DialogDescription className="text-sky-600 mt-1">
            Unlimited trivia, exclusive skies, premium themes, and every future update.
          </DialogDescription>
        </div>

        {/* Already-premium state */}
        {is_premium && (
          <div className="px-6 pb-6 text-center" data-testid="paywall-already-premium">
            <p className="text-emerald-600 font-medium mb-4">
              The full experience is yours. Thank you for supporting Kite 🪁
            </p>
            <Button onClick={closePaywall} className="rounded-full">Close</Button>
          </div>
        )}

        {!is_premium && (
          <>
            {/* Benefits */}
            <div className="px-6 space-y-2">
              {BENEFITS.map(({ Icon, label }) => (
                <div key={label} className="flex items-start gap-3 text-sm text-sky-800">
                  <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-sky-600" />
                  </div>
                  <span className="pt-0.5">{label}</span>
                </div>
              ))}
            </div>

            {/* Services unavailable banner (web) */}
            {!servicesAvailable && (
              <div
                className="mx-6 mt-5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center"
                data-testid="paywall-web-notice"
              >
                The full experience is unlocked through the App Store or Google Play.
                Open Kite on your iOS or Android device to continue.
              </div>
            )}

            {/* Plan picker */}
            {servicesAvailable && (
              <div className="px-6 pt-5 grid grid-cols-3 gap-2">
                <PlanCard
                  active={selected === "yearly"}
                  title="Yearly"
                  price={priceLabel(yearly, "—")}
                  badge="Best value"
                  sub="Save vs monthly"
                  disabled={!yearly}
                  onSelect={() => setSelected("yearly")}
                  testId="plan-yearly"
                />
                <PlanCard
                  active={selected === "lifetime"}
                  title="Lifetime"
                  price={priceLabel(lifetime, "—")}
                  sub="One-time"
                  disabled={!lifetime}
                  onSelect={() => setSelected("lifetime")}
                  testId="plan-lifetime"
                />
                <PlanCard
                  active={selected === "monthly"}
                  title="Monthly"
                  price={priceLabel(monthly, "—")}
                  sub="Cancel anytime"
                  disabled={!monthly}
                  onSelect={() => setSelected("monthly")}
                  testId="plan-monthly"
                />
              </div>
            )}

            {/* Actions */}
            <div className="px-6 pt-5 pb-6 space-y-3">
              {servicesAvailable && (
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing || !offerings?.ok}
                  className="w-full rounded-full h-11 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600"
                  data-testid="paywall-purchase-btn"
                >
                  {purchasing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                  ) : (
                    <>Continue</>
                  )}
                </Button>
              )}

              <Button
                onClick={handleRestore}
                disabled={restoring || !servicesAvailable}
                variant="ghost"
                className="w-full rounded-full text-sky-600 hover:bg-sky-100"
                data-testid="paywall-restore-btn"
              >
                {restoring ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restoring…</>
                ) : (
                  "Restore purchases"
                )}
              </Button>

              <p className="text-[11px] text-sky-500/80 text-center leading-relaxed">
                Payments are processed by the App Store or Google Play. Subscriptions
                renew automatically until canceled in your store account.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const PlanCard = ({ active, title, price, badge, sub, disabled, onSelect, testId }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    className={[
      "relative text-left rounded-2xl border p-4 transition",
      active ? "border-sky-500 bg-white shadow-md ring-2 ring-sky-200" : "border-sky-100 bg-white/60",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:border-sky-300",
    ].join(" ")}
    data-testid={testId}
  >
    {badge && (
      <span className="absolute -top-2 right-2 text-[10px] bg-amber-400 text-amber-900 rounded-full px-2 py-0.5 font-medium">
        {badge}
      </span>
    )}
    <div className="flex items-center justify-between">
      <p className="font-semibold text-sky-900">{title}</p>
      {active && <Check className="w-4 h-4 text-sky-500" />}
    </div>
    <p className="text-lg font-bold text-sky-800 mt-1">{price}</p>
    {sub && <p className="text-[11px] text-sky-500 mt-0.5">{sub}</p>}
  </button>
);

/**
 * Convenience wrapper: consumers only need <Paywall /> mounted once.
 * A separate wrapper avoids AnimatePresence importing from context module.
 */
export const PaywallHost = () => (
  <AnimatePresence>
    <Paywall key="kite-paywall" />
  </AnimatePresence>
);
