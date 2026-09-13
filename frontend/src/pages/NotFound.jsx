import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen sky-gradient overflow-hidden relative flex items-center justify-center px-6" data-testid="not-found-page">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 -left-20 w-40 h-20 bg-white/60 rounded-full blur-sm"
          animate={{ x: ["0%", "200vw"] }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <motion.div
        className="relative z-10 glass-card p-10 text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-4 w-fit"
        >
          <svg width="80" height="110" viewBox="0 0 200 280" className="kite-shadow">
            <polygon points="100,0 200,100 100,200 0,100" fill="#0EA5E9" stroke="#0284C7" strokeWidth="3"/>
            <line x1="100" y1="0" x2="100" y2="200" stroke="#0284C7" strokeWidth="3"/>
            <line x1="0" y1="100" x2="200" y2="100" stroke="#0284C7" strokeWidth="3"/>
            <circle cx="100" cy="100" r="20" fill="#F59E0B"/>
          </svg>
        </motion.div>

        <h1 className="text-6xl font-bold text-sky-900 mb-2">404</h1>
        <p className="text-xl font-semibold text-sky-800 mb-2">Page not found</p>
        <p className="text-sky-600/80 mb-8">
          This kite drifted off the map. The page you're looking for doesn't exist.
        </p>

        <Button
          asChild
          size="lg"
          className="rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-1"
          data-testid="not-found-home-btn"
        >
          <Link to="/">
            <Home className="w-5 h-5 mr-2" />
            Back to Kite
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}

export { NotFoundPage };
