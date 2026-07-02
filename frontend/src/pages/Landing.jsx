import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { useAuth } from "../App";
import { Play, Trophy, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect } from "react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen sky-gradient overflow-hidden relative" data-testid="landing-page">
      {/* Animated Clouds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 -left-20 w-40 h-20 bg-white/60 rounded-full blur-sm"
          animate={{ x: ["0%", "200vw"] }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-40 -left-40 w-60 h-24 bg-white/40 rounded-full blur-md"
          animate={{ x: ["0%", "200vw"] }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear", delay: 10 }}
        />
        <motion.div
          className="absolute top-60 -left-30 w-32 h-16 bg-white/50 rounded-full blur-sm"
          animate={{ x: ["0%", "200vw"] }}
          transition={{ duration: 70, repeat: Infinity, ease: "linear", delay: 5 }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center justify-between min-h-[80vh] gap-12">
          {/* Left Content */}
          <motion.div
            className="flex-1 text-center lg:text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold text-sky-900 mb-4">
                Kite
              </h1>
              <p className="text-xl md:text-2xl text-sky-700 mb-2">
                Trivia That Makes You Soar!
              </p>
              <p className="text-base md:text-lg text-sky-600/80 mb-8 max-w-md mx-auto lg:mx-0">
                Answer questions, collect adorable kite characters, and climb the weekly leaderboard!
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                size="lg"
                className="rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-1 text-lg px-8 py-6"
                onClick={() => navigate('/signup')}
                data-testid="get-started-btn"
              >
                <Play className="w-5 h-5 mr-2" />
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-2 border-sky-200 hover:border-sky-300 hover:bg-sky-50 text-sky-700 text-lg px-8 py-6"
                onClick={() => navigate('/login')}
                data-testid="login-btn"
              >
                Sign In
              </Button>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
              className="flex flex-wrap gap-3 mt-10 justify-center lg:justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {[
                { icon: Play, text: "Fun Trivia" },
                { icon: Sparkles, text: "Cute Characters" },
                { icon: Trophy, text: "Weekly Leaderboard" },
                { icon: ShoppingBag, text: "Character Shop" },
              ].map((item) => (
                <span
                  key={item.text}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm rounded-full text-sky-700 text-sm font-medium shadow-sm"
                >
                  <item.icon className="w-4 h-4" />
                  {item.text}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right - Animated Kite */}
          <motion.div
            className="flex-1 flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.div
              animate={{
                y: [0, -30, 0],
                rotate: [-3, 3, -3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              {/* Main Kite SVG */}
              <svg width="200" height="280" viewBox="0 0 200 280" className="kite-shadow">
                {/* Kite Body */}
                <polygon
                  points="100,0 200,100 100,200 0,100"
                  fill="#0EA5E9"
                  stroke="#0284C7"
                  strokeWidth="3"
                />
                {/* Cross Lines */}
                <line x1="100" y1="0" x2="100" y2="200" stroke="#0284C7" strokeWidth="3" />
                <line x1="0" y1="100" x2="200" y2="100" stroke="#0284C7" strokeWidth="3" />
                {/* Center Circle */}
                <circle cx="100" cy="100" r="20" fill="#F59E0B" />
                <circle cx="100" cy="100" r="12" fill="#FBBF24" />
                {/* Tail */}
                <path
                  d="M100,200 Q120,220 100,240 Q80,260 100,280"
                  stroke="#F59E0B"
                  strokeWidth="4"
                  fill="none"
                />
                {/* Tail Bows */}
                <ellipse cx="110" cy="220" rx="15" ry="8" fill="#F59E0B" opacity="0.8" />
                <ellipse cx="90" cy="250" rx="12" ry="6" fill="#FB923C" opacity="0.8" />
                <ellipse cx="105" cy="275" rx="10" ry="5" fill="#FBBF24" opacity="0.8" />
              </svg>
              
              {/* Sparkles around kite */}
              <motion.div
                className="absolute -top-4 -right-4 text-yellow-400"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-8 h-8" />
              </motion.div>
              <motion.div
                className="absolute top-20 -left-8 text-yellow-400"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              >
                <Sparkles className="w-6 h-6" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-sky-500 text-sm">
        <div>Start with easy 5th grade questions and level up!</div>
        <div className="mt-1 text-xs text-sky-400">
          <a href="/privacy" className="hover:text-sky-700 mx-2" data-testid="footer-privacy-link">Privacy</a>
          <span>·</span>
          <a href="/terms" className="hover:text-sky-700 mx-2" data-testid="footer-terms-link">Terms</a>
        </div>
      </div>
    </div>
  );
}

export { LandingPage };
