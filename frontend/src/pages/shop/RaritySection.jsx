import { motion } from "framer-motion";
import { Sparkles, Star, Lock } from "lucide-react";

/**
 * Section header for one rarity tier (common/rare/epic/legendary). Renders
 * the tier title, a level-gate badge if the player can't yet purchase, or a
 * "Newly available" marker the moment they cross the gate.
 *
 * @param {{
 *   rarity: 'common' | 'rare' | 'epic' | 'legendary',
 *   items: Array<object>,
 *   gateLevel: number,
 *   userLevel: number,
 *   children?: React.ReactNode,
 *   accent?: string,
 * }} props
 */
export const RaritySection = ({ rarity, items, gateLevel, userLevel, children, accent }) => {
  if (!items || items.length === 0) return null;
  const locked = userLevel < gateLevel;
  const justUnlocked = userLevel === gateLevel;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`mb-10 ${locked ? "opacity-70" : ""}`}
      data-testid={`rarity-section-${rarity}`}
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/40">
        <h3 className="text-lg font-semibold text-sky-800 flex items-center gap-2 capitalize">
          {rarity === "legendary" && <Sparkles className="w-5 h-5 text-amber-500" />}
          {rarity === "epic" && <Star className="w-5 h-5 text-violet-500" />}
          {rarity} {children}
        </h3>
        {locked ? (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-sky-500 bg-white/70 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm"
            data-testid={`rarity-gate-${rarity}`}
          >
            <Lock className="w-3 h-3" />
            Unlocks at Level {gateLevel}
          </motion.span>
        ) : justUnlocked ? (
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5"
            data-testid={`rarity-newly-unlocked-${rarity}`}
          >
            <Sparkles className="w-3 h-3" />
            Newly available
          </motion.span>
        ) : (
          <span className={`text-xs px-3 py-1 rounded-full ${accent || "bg-white/40 text-sky-600"}`}>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {locked && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-sky-600/70 mb-4 italic"
        >
          {items.length} item{items.length === 1 ? "" : "s"} waiting in the clouds — keep playing to discover them.
        </motion.p>
      )}
    </motion.div>
  );
};
