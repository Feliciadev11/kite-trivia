import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API, useAuth } from "../App";
import { toast } from "sonner";
import { Gift, Check, Sparkles } from "lucide-react";
import { SkyThemeSwatch } from "./SkyThemeSwatch";

const SEASON_ACCENT = {
  spring: { from: "from-emerald-50", to: "to-pink-50", ring: "ring-emerald-200", text: "text-emerald-700" },
  summer: { from: "from-amber-50", to: "to-sky-50", ring: "ring-amber-200", text: "text-amber-700" },
  autumn: { from: "from-orange-50", to: "to-amber-50", ring: "ring-orange-200", text: "text-orange-700" },
  winter: { from: "from-sky-50", to: "to-slate-50", ring: "ring-sky-200", text: "text-sky-700" },
};

export const SeasonalSkyBanner = () => {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/sky/seasonal`, { withCredentials: true });
      setData(data);
    } catch (e) {
      // silently degrade
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClaim = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/sky/seasonal/claim`, {}, { withCredentials: true });
      toast.success(`${data.theme.name} added to your collection!`);
      await refreshUser();
      await load();
    } catch (e) {
      toast.error("Couldn't claim seasonal sky");
    } finally {
      setBusy(false);
    }
  };

  const handleEquip = async () => {
    setBusy(true);
    try {
      await axios.post(
        `${API}/characters/equip`,
        { character_id: data.theme.character_id, type: "sky_theme" },
        { withCredentials: true }
      );
      toast.success(`${data.theme.name} is now your sky`);
      await refreshUser();
      await load();
    } catch (e) {
      toast.error("Couldn't equip seasonal sky");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data?.theme) return null;
  const accent = SEASON_ACCENT[data.season] || SEASON_ACCENT.winter;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className={`w-full rounded-3xl bg-gradient-to-br ${accent.from} ${accent.to} ring-1 ${accent.ring} p-5 shadow-sm`}
        data-testid="seasonal-sky-banner"
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0"
          >
            <SkyThemeSwatch themeId={data.theme.character_id} size={72} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Gift className={`w-3.5 h-3.5 ${accent.text}`} />
              <p className={`text-xs uppercase tracking-[0.2em] ${accent.text}`}>
                {data.label} · Free this season
              </p>
            </div>
            <p className="text-base font-semibold text-slate-700 truncate" data-testid="seasonal-theme-name">
              {data.theme.name}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{data.theme.description}</p>
          </div>

          <div className="shrink-0">
            {data.equipped ? (
              <span className={`text-xs px-3 py-1.5 rounded-full bg-white/70 ${accent.text} flex items-center gap-1`}>
                <Check className="w-3 h-3" /> Equipped
              </span>
            ) : data.owned ? (
              <button
                type="button"
                onClick={handleEquip}
                disabled={busy}
                className={`rounded-full px-4 py-2 bg-white/80 hover:bg-white ${accent.text} text-sm font-medium transition-all duration-300 hover:shadow-md disabled:opacity-50`}
                data-testid="seasonal-equip-btn"
              >
                Equip
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClaim}
                disabled={busy}
                className={`rounded-full px-4 py-2 bg-white/80 hover:bg-white ${accent.text} text-sm font-medium transition-all duration-300 hover:shadow-md disabled:opacity-50 flex items-center gap-1.5`}
                data-testid="seasonal-claim-btn"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Claim free
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SeasonalSkyBanner;
