import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { getAnalyticsConsent, setAnalyticsConsent } from "../lib/analytics";

/**
 * Top banner, web only. Shown once until the visitor accepts or declines;
 * Plausible only loads after "Accept" (see lib/analytics.js).
 */
export const AnalyticsConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getAnalyticsConsent() === null);
  }, []);

  const choose = (accepted) => {
    setAnalyticsConsent(accepted);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="Analytics consent"
          className="fixed top-0 inset-x-0 z-[100] bg-sky-900/95 text-white backdrop-blur-sm"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          data-testid="analytics-consent-banner"
        >
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3 text-sm">
            <p className="flex-1 text-center sm:text-left text-sky-50">
              We use privacy-friendly analytics (
              <a
                href="https://plausible.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                Plausible
              </a>
              ) to see what's popular — no cookies, no personal data, nothing sold. See our{" "}
              <a href="/privacy" className="underline hover:text-white">
                Privacy Policy
              </a>
              .
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => choose(false)}
                className="text-white hover:bg-white/10 hover:text-white rounded-full"
                data-testid="analytics-consent-decline"
              >
                Decline
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => choose(true)}
                className="bg-white text-sky-900 hover:bg-sky-50 rounded-full"
                data-testid="analytics-consent-accept"
              >
                Accept
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalyticsConsent;
