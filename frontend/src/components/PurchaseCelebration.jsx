import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAudio } from "../contexts/AudioContext";
import { PetalConfetti } from "./SkyWandererCelebration";

/**
 * Full-screen completion moment for a successful premium purchase — the
 * biggest "did it work?" moment in the app deserves more than a toast that
 * can be missed. Mirrors the LevelUpCelebration/SkyWandererCelebration
 * pattern already used for other big wins, so it reads as the same app
 * language rather than a bolted-on modal.
 */
export const PurchaseCelebration = ({ active, onDismiss }) => {
  const { playSoundEffect } = useAudio();

  useEffect(() => {
    if (active) playSoundEffect("reward");
  }, [active, playSoundEffect]);

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[90] flex items-center justify-center px-6 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        data-testid="purchase-celebration"
      >
        <motion.div
          className="absolute inset-0 bg-sky-900/20 backdrop-blur-[2px] pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
        />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <PetalConfetti count={24} />
        </div>

        <motion.div
          initial={{ y: 30, scale: 0.92, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: -10, scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.1 }}
          className="relative pointer-events-auto rounded-3xl px-8 py-7 max-w-md w-full text-center bg-gradient-to-br from-sky-50 to-indigo-50 ring-1 ring-sky-200 shadow-2xl backdrop-blur-sm"
          data-testid="purchase-celebration-card"
        >
          <motion.div
            className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-5 h-5 text-sky-500" />
          </motion.div>

          <p className="text-xs uppercase tracking-[0.3em] text-sky-600 mt-3 mb-2">
            Kite Premium
          </p>
          <h2 className="text-3xl font-semibold text-slate-800 leading-tight">
            The full sky is open!
          </h2>

          <p className="text-sm text-slate-500 mt-5">
            Thank you for supporting Kite. Unlimited trivia, every kite and
            sky theme, and every future update are yours.
          </p>

          <button
            type="button"
            onClick={onDismiss}
            className="mt-6 rounded-full px-7 py-2.5 bg-white/80 hover:bg-white text-sky-600 text-sm font-medium transition-all duration-300 hover:shadow-md"
            data-testid="purchase-celebration-dismiss"
          >
            Let&apos;s fly
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PurchaseCelebration;
