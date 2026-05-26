import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API } from "../App";
import { Sparkles, Lock, ChevronRight } from "lucide-react";
import { KiteCharacter, CompanionCharacter } from "./KiteCharacter";
import { SkyThemeSwatch } from "./SkyThemeSwatch";

const CATEGORY_LABEL = {
  kite: "Kite",
  companion: "Companion",
  sky_theme: "Sky",
};

const RARITY_ACCENT = {
  common: { ring: "ring-slate-200", text: "text-slate-600", glow: "rgba(148,163,184,0.25)" },
  rare: { ring: "ring-blue-200", text: "text-blue-700", glow: "rgba(59,130,246,0.35)" },
  epic: { ring: "ring-violet-200", text: "text-violet-700", glow: "rgba(139,92,246,0.4)" },
  legendary: { ring: "ring-amber-200", text: "text-amber-700", glow: "rgba(245,158,11,0.5)" },
};

export const NextUnlockTease = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/characters/next-unlock`, { withCredentials: true });
        if (alive) setData(data);
      } catch (e) {
        // silently degrade
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading || !data?.next_unlock) return null;

  const { next_unlock } = data;
  const { sample_item, rarity, unlock_level, levels_remaining, category } = next_unlock;
  const accent = RARITY_ACCENT[rarity] || RARITY_ACCENT.common;

  // Build a silhouette/preview for the upcoming item
  const Preview = () => {
    if (category === "companion") {
      return (
        <div className="grayscale opacity-60">
          <CompanionCharacter companionId={sample_item.character_id} size="medium" />
        </div>
      );
    }
    if (category === "sky_theme") {
      return (
        <div className="opacity-70">
          <SkyThemeSwatch themeId={sample_item.character_id} size={72} />
        </div>
      );
    }
    return (
      <div className="grayscale opacity-60">
        <KiteCharacter characterId={sample_item.character_id} size="small" rarity={rarity} />
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        onClick={() => navigate("/shop")}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
        whileHover={{ y: -3 }}
        className={`w-full text-left rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 p-5 shadow-sm hover:shadow-md transition-all duration-500 group ${accent.ring} ring-1`}
        data-testid="next-unlock-tease"
        style={{ boxShadow: `0 4px 20px ${accent.glow}` }}
      >
        <div className="flex items-center gap-4">
          {/* Silhouette preview */}
          <div className="relative shrink-0">
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Preview />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                <Lock className="w-4 h-4 text-sky-600" />
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className={`w-3.5 h-3.5 ${accent.text}`} />
              <p className={`text-xs uppercase tracking-[0.2em] ${accent.text}`}>
                Next unlock — {rarity}
              </p>
            </div>
            <p className="text-base font-semibold text-slate-700 truncate" data-testid="next-unlock-item-name">
              ??? {CATEGORY_LABEL[category] || category}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              Reach <span className={`font-medium ${accent.text}`} data-testid="next-unlock-level">Level {unlock_level}</span> to discover
              {levels_remaining === 1 ? " — only 1 level to go" : ` — ${levels_remaining} levels to go`}
            </p>
          </div>

          {/* Chevron */}
          <ChevronRight className="w-5 h-5 text-sky-400 shrink-0 group-hover:translate-x-1 transition-transform duration-300" />
        </div>
      </motion.button>
    </AnimatePresence>
  );
};

export default NextUnlockTease;
