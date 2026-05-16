import { motion } from "framer-motion";

// Tiny atmospheric preview swatch for each sky theme — distinct gradient +
// signature element that matches the full-screen AtmosphericBackground.
// Used in the Shop cards so each purchasable sky looks visually unique.

const PRESETS = {
  dawn: {
    gradient: "linear-gradient(180deg,#fecaca 0%,#fde68a 40%,#bae6fd 100%)",
    signature: (
      <>
        <div className="absolute w-6 h-6 rounded-full"
          style={{ top: "18%", right: "20%", background: "radial-gradient(circle,#fbbf24,#fbbf2466 70%,transparent)" }} />
        <div className="absolute w-10 h-2 rounded-full bg-white/70" style={{ top: "55%", left: "10%" }} />
        <div className="absolute w-8 h-1.5 rounded-full bg-white/60" style={{ top: "70%", left: "40%" }} />
      </>
    ),
  },
  clear_day: {
    gradient: "linear-gradient(180deg,#38bdf8 0%,#7dd3fc 50%,#bae6fd 100%)",
    signature: (
      <>
        <div className="absolute w-7 h-7 rounded-full"
          style={{ top: "20%", right: "18%", background: "radial-gradient(circle,#fef08a,#fde68a 60%,transparent)" }} />
        <div className="absolute w-12 h-2.5 rounded-full bg-white/80" style={{ top: "55%", left: "10%" }} />
        <div className="absolute w-9 h-1.5 rounded-full bg-white/70" style={{ top: "72%", left: "45%" }} />
      </>
    ),
  },
  sunset_glow: {
    gradient: "linear-gradient(180deg,#fb7185 0%,#fb923c 50%,#fde68a 100%)",
    signature: (
      <>
        <div className="absolute w-9 h-9 rounded-full"
          style={{ top: "45%", right: "16%", background: "radial-gradient(circle,#fef3c7,#fbbf24 50%,transparent)" }} />
        <div className="absolute w-10 h-1.5 rounded-full bg-pink-300/60" style={{ top: "30%", left: "12%" }} />
      </>
    ),
  },
  twilight: {
    gradient: "linear-gradient(180deg,#312e81 0%,#6d28d9 50%,#fb923c 100%)",
    signature: (
      <>
        <div className="absolute w-1 h-1 rounded-full bg-amber-200" style={{ top: "18%", left: "30%", boxShadow: "0 0 4px #fde68a" }} />
        <div className="absolute w-1 h-1 rounded-full bg-amber-200" style={{ top: "12%", left: "55%", boxShadow: "0 0 4px #fde68a" }} />
        <div className="absolute w-1 h-1 rounded-full bg-amber-200" style={{ top: "25%", left: "80%", boxShadow: "0 0 4px #fde68a" }} />
      </>
    ),
  },
  cloudy_dreams: {
    gradient: "linear-gradient(180deg,#e0f2fe 0%,#f0f9ff 50%,#f8fafc 100%)",
    signature: (
      <>
        <div className="absolute w-14 h-3 rounded-full bg-white/95" style={{ top: "30%", left: "8%" }} />
        <div className="absolute w-10 h-2 rounded-full bg-white/85" style={{ top: "55%", left: "40%" }} />
        <div className="absolute w-12 h-2.5 rounded-full bg-white/90" style={{ top: "75%", left: "15%" }} />
      </>
    ),
  },
  golden_hour: {
    gradient: "linear-gradient(180deg,#fde68a 0%,#fbbf24 50%,#fdba74 100%)",
    signature: (
      <>
        <div className="absolute w-10 h-10 rounded-full"
          style={{ top: "50%", right: "12%", background: "radial-gradient(circle,#fef3c7,#fbbf24 50%,#f59e0b 100%)", boxShadow: "0 0 18px #f59e0b88" }} />
      </>
    ),
  },
  starry_night: {
    gradient: "linear-gradient(180deg,#020617 0%,#1e1b4b 60%,#312e81 100%)",
    signature: (
      <>
        {[
          { t: 15, l: 20 }, { t: 25, l: 50 }, { t: 35, l: 75 },
          { t: 18, l: 85 }, { t: 50, l: 30 }, { t: 60, l: 60 },
          { t: 45, l: 12 }, { t: 70, l: 80 },
        ].map((s, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white"
            style={{ top: `${s.t}%`, left: `${s.l}%`, boxShadow: "0 0 3px #fff" }} />
        ))}
      </>
    ),
  },
  moonlit: {
    gradient: "linear-gradient(180deg,#0f172a 0%,#1e293b 50%,#334155 100%)",
    signature: (
      <>
        <div className="absolute w-7 h-7 rounded-full bg-slate-100"
          style={{ top: "20%", right: "20%", boxShadow: "0 0 12px rgba(241,245,249,0.4)" }} />
        <div className="absolute w-7 h-7 rounded-full"
          style={{ top: "20%", right: "13%", background: "#1e293b" }} />
        {[{ t: 35, l: 15 }, { t: 50, l: 65 }, { t: 65, l: 30 }].map((s, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-slate-200"
            style={{ top: `${s.t}%`, left: `${s.l}%` }} />
        ))}
      </>
    ),
  },
  gentle_rain: {
    gradient: "linear-gradient(180deg,#475569 0%,#64748b 50%,#94a3b8 100%)",
    signature: (
      <>
        <div className="absolute w-12 h-2.5 rounded-full bg-slate-100/60" style={{ top: "20%", left: "10%" }} />
        <div className="absolute w-10 h-2 rounded-full bg-slate-100/60" style={{ top: "30%", left: "55%" }} />
        {[
          { l: 20, d: 0 }, { l: 35, d: 0.2 }, { l: 55, d: 0.1 },
          { l: 70, d: 0.3 }, { l: 85, d: 0 },
        ].map((r, i) => (
          <motion.div
            key={i}
            className="absolute w-px bg-sky-100"
            style={{ height: 10, left: `${r.l}%`, top: "30%" }}
            animate={{ y: [0, 40], opacity: [0.9, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear", delay: r.d }}
          />
        ))}
      </>
    ),
  },
  aurora_borealis: {
    gradient: "linear-gradient(180deg,#042f2e 0%,#064e3b 50%,#1e1b4b 100%)",
    signature: (
      <>
        <motion.div
          className="absolute inset-x-0"
          style={{
            top: "30%", height: 18,
            background: "linear-gradient(180deg,transparent,#34d39988,#34d399cc,#34d39988,transparent)",
            filter: "blur(6px)",
          }}
          animate={{ x: ["-10%", "10%", "-10%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-x-0"
          style={{
            top: "48%", height: 14,
            background: "linear-gradient(180deg,transparent,#a78bfa88,#a78bfacc,#a78bfa88,transparent)",
            filter: "blur(6px)",
          }}
          animate={{ x: ["8%", "-8%", "8%"] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute w-0.5 h-0.5 rounded-full bg-emerald-100" style={{ top: "18%", left: "30%" }} />
        <div className="absolute w-0.5 h-0.5 rounded-full bg-emerald-100" style={{ top: "22%", left: "60%" }} />
      </>
    ),
  },
  celestial_night: {
    gradient: "linear-gradient(180deg,#1e1b4b 0%,#4c1d95 50%,#5b21b6 100%)",
    signature: (
      <>
        <div className="absolute rounded-full"
          style={{ width: 40, height: 40, top: "25%", left: "55%", background: "radial-gradient(circle,#a855f7aa,transparent 70%)", filter: "blur(6px)" }} />
        <div className="absolute rounded-full"
          style={{ width: 28, height: 28, top: "55%", left: "20%", background: "radial-gradient(circle,#ec489988,transparent 70%)", filter: "blur(4px)" }} />
        {[{ t: 18, l: 20 }, { t: 35, l: 80 }, { t: 70, l: 50 }].map((s, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-pink-100"
            style={{ top: `${s.t}%`, left: `${s.l}%`, boxShadow: "0 0 3px #fce7f3" }} />
        ))}
      </>
    ),
  },
  cherry_blossom_sky: {
    gradient: "linear-gradient(180deg,#fbcfe8 0%,#fda4af 50%,#fdf2f8 100%)",
    signature: (
      <>
        <div className="absolute w-12 h-2 rounded-full bg-white/85" style={{ top: "25%", left: "10%" }} />
        <div className="absolute w-9 h-2 rounded-full bg-white/75" style={{ top: "45%", left: "55%" }} />
        {[
          { l: 25, t: 15, d: 0 }, { l: 60, t: 10, d: 1.5 },
          { l: 40, t: 60, d: 0.8 }, { l: 80, t: 35, d: 2.2 },
        ].map((p, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${p.l}%`, top: `${p.t}%`,
              width: 6, height: 4,
              background: "radial-gradient(ellipse,#f9a8d4,#fbcfe8)",
              borderRadius: "60% 20% 60% 20%",
              filter: "drop-shadow(0 0 2px #f9a8d488)",
            }}
            animate={{ y: [0, 30, 60], rotate: [0, 120, 240], opacity: [0.9, 0.7, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear", delay: p.d }}
          />
        ))}
      </>
    ),
  },
};

export const SkyThemeSwatch = ({ themeId, size = 80 }) => {
  const preset = PRESETS[themeId] || PRESETS.dawn;
  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-inner ring-1 ring-white/40"
      style={{ width: size, height: size, background: preset.gradient }}
      data-testid={`sky-swatch-${themeId}`}
    >
      {preset.signature}
    </div>
  );
};

export default SkyThemeSwatch;
