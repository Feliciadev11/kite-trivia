import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "../contexts/AudioContext";

const SPLASH_KEY = "kite_sky_splash_seen";

export const SkySplash = () => {
  const { isPlaying, togglePlay } = useAudio();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(SPLASH_KEY) === "true";
    if (!seen) setShow(true);
  }, []);

  const begin = () => {
    try {
      localStorage.setItem(SPLASH_KEY, "true");
      // Also persist that the user opted in to ambient audio for future sessions
      localStorage.setItem("kite_audio_isPlaying", "true");
    } catch (e) {
      // localStorage may be unavailable (private mode) — ignore
    }
    if (!isPlaying) togglePlay();
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
        onClick={begin}
        data-testid="sky-splash"
        style={{
          background:
            "linear-gradient(180deg, #fecaca 0%, #fde68a 30%, #bae6fd 65%, #e0f2fe 100%)",
        }}
      >
        {/* Drifting clouds in background */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/70 blur-xl"
            style={{
              width: 120 + i * 40,
              height: 50 + i * 16,
              top: `${15 + i * 22}%`,
              left: "-15%",
            }}
            animate={{ x: ["0vw", "130vw"] }}
            transition={{ duration: 50 + i * 14, repeat: Infinity, ease: "linear", delay: i * 6 }}
          />
        ))}

        <motion.div
          className="relative z-10 text-center px-8"
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
        >
          {/* Floating kite */}
          <motion.div
            className="mx-auto mb-8"
            animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="120" height="160" viewBox="0 0 200 280" className="drop-shadow-lg">
              <polygon points="100,0 200,100 100,200 0,100" fill="#0EA5E9" stroke="#0284C7" strokeWidth="3" />
              <line x1="100" y1="0" x2="100" y2="200" stroke="#0284C7" strokeWidth="3" />
              <line x1="0" y1="100" x2="200" y2="100" stroke="#0284C7" strokeWidth="3" />
              <circle cx="100" cy="100" r="20" fill="#F59E0B" />
              <path d="M100,200 Q120,220 100,240 Q80,260 100,280" stroke="#F59E0B" strokeWidth="4" fill="none" />
            </svg>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl font-light text-sky-700 tracking-wide mb-3"
              style={{ textShadow: "0 2px 24px rgba(255,255,255,0.6)" }}>
            Kite
          </h1>
          <p className="text-sky-600/80 text-sm uppercase tracking-[0.35em] mb-10">
            A gentle trivia drift
          </p>

          <motion.button
            type="button"
            onClick={begin}
            data-testid="sky-splash-begin-btn"
            className="rounded-full bg-white/70 backdrop-blur-sm border border-white px-10 py-4 text-sky-700 font-medium shadow-lg hover:bg-white hover:shadow-sky-200 transition-all duration-500"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              boxShadow: [
                "0 8px 24px rgba(125,211,252,0.25)",
                "0 8px 36px rgba(125,211,252,0.45)",
                "0 8px 24px rgba(125,211,252,0.25)",
              ],
            }}
            transition={{
              boxShadow: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            Tap to begin your sky
          </motion.button>

          <p className="text-xs text-sky-500/70 mt-6">
            Soft ambient music will play softly in the background.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SkySplash;
