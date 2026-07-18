import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAudio } from "../contexts/AudioContext";

const RARITY_LABEL = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const CATEGORY_LABEL = {
  kite: "Kites",
  companion: "Companions",
  sky_theme: "Sky Themes",
};

const RARITY_TINT = {
  common: { from: "from-sky-50", to: "to-white", ring: "ring-sky-200", text: "text-sky-700" },
  rare: { from: "from-blue-50", to: "to-violet-50", ring: "ring-blue-200", text: "text-blue-700" },
  epic: { from: "from-violet-50", to: "to-fuchsia-50", ring: "ring-violet-200", text: "text-violet-700" },
  legendary: { from: "from-amber-50", to: "to-orange-50", ring: "ring-amber-200", text: "text-amber-700" },
};

// Falling petal confetti — soft, slow, gentle
const PetalConfetti = ({ count = 18 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.4;
      const duration = 3 + Math.random() * 2;
      const rotateEnd = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540);
      const color = ["#fbcfe8", "#bfdbfe", "#fde68a", "#ddd6fe", "#fed7aa"][i % 5];
      return (
        <motion.div
          key={`confetti-petal-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: `${left}%`,
            top: "-20px",
            width: 8,
            height: 5,
            background: color,
            borderRadius: "60% 20% 60% 20%",
            opacity: 0.85,
            filter: `drop-shadow(0 0 3px ${color}99)`,
          }}
          initial={{ y: 0, rotate: 0, opacity: 0.95 }}
          animate={{
            y: "120vh",
            x: [0, 30, -25, 20, 0],
            rotate: rotateEnd,
            opacity: [0.95, 0.85, 0],
          }}
          transition={{ duration, delay, ease: "linear" }}
        />
      );
    })}
  </>
);

export const SkyWandererCelebration = ({ milestones, onDismiss }) => {
  const { playSoundEffect } = useAudio();

  useEffect(() => {
    if (milestones && milestones.length > 0) {
      // Play reward chime once on first appearance
      playSoundEffect("reward");
    }
  }, [milestones, playSoundEffect]);

  if (!milestones || milestones.length === 0) return null;

  // If multiple milestones cross at once, show the highest-rarity one
  const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const headline = [...milestones].sort(
    (a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0)
  )[0];
  const tint = RARITY_TINT[headline.rarity] || RARITY_TINT.common;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center px-6 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        data-testid="sky-wanderer-celebration"
      >
        {/* Dim backdrop — only clickable area */}
        <motion.div
          className="absolute inset-0 bg-sky-900/20 backdrop-blur-[2px] pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
        />

        {/* Petal confetti — fixed to overlay, drifts down */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <PetalConfetti count={20} />
        </div>

        {/* Badge card */}
        <motion.div
          initial={{ y: 30, scale: 0.92, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: -10, scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.1 }}
          className={`relative pointer-events-auto rounded-3xl px-8 py-7 max-w-md w-full text-center bg-gradient-to-br ${tint.from} ${tint.to} ring-1 ${tint.ring} shadow-2xl backdrop-blur-sm`}
          data-testid="sky-wanderer-badge"
        >
          {/* Floating sparkle */}
          <motion.div
            className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className={`w-5 h-5 ${tint.text}`} />
          </motion.div>

          <p className={`text-xs uppercase tracking-[0.3em] ${tint.text} mt-3 mb-2`}>
            Sky Wanderer
          </p>
          <h2 className="text-2xl font-semibold text-slate-800 leading-tight">
            {milestones.length === 1 ? (
              <>You&apos;ve unlocked {RARITY_LABEL[headline.rarity]}{" "}
                {CATEGORY_LABEL[headline.category]}!</>
            ) : (
              <>You&apos;ve unlocked {milestones.length} new collections!</>
            )}
          </h2>

          {milestones.length > 1 && (
            <ul className="mt-4 space-y-1.5">
              {milestones.map((m) => (
                <li key={m.key} className="text-sm text-slate-600">
                  ✨ {RARITY_LABEL[m.rarity]} {CATEGORY_LABEL[m.category]}{" "}
                  <span className={`${tint.text} font-medium`}>(Level {m.level})</span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-sm text-slate-500 mt-5">
            Drift over to the Shop to see what&apos;s waiting.
          </p>

          <button
            type="button"
            onClick={onDismiss}
            className={`mt-6 rounded-full px-7 py-2.5 bg-white/80 hover:bg-white ${tint.text} text-sm font-medium transition-all duration-300 hover:shadow-md`}
            data-testid="sky-wanderer-dismiss"
          >
            Keep flying
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SkyWandererCelebration;
