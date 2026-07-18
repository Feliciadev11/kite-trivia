import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

/**
 * Shared frame for Kite's public legal pages (Privacy Policy, Terms of Service).
 * Matches Kite's calm, dreamy aesthetic — soft sky gradient background, glass
 * card container, gentle entry animation. Public and unauthenticated.
 */
export const LegalLayout = ({ title, subtitle, lastUpdated, children }) => (
  <div className="min-h-screen sky-gradient" data-testid={`legal-page-${title.toLowerCase().replace(/\s+/g, "-")}`}>
    <header className="bg-white/60 backdrop-blur-md border-b border-white/50 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-800 transition text-sm rounded-full px-3 py-1.5 hover:bg-white/60"
          data-testid="legal-home-link"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Kite
        </Link>
        <span className="text-sky-500 text-sm">Kite</span>
      </div>
    </header>

    <motion.main
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="container mx-auto px-4 py-10 max-w-3xl"
    >
      <div className="glass-card p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-semibold text-sky-900 mb-2">{title}</h1>
        {subtitle && <p className="text-sky-600 text-lg mb-1">{subtitle}</p>}
        {lastUpdated && (
          <p className="text-sky-400 text-sm mb-8">Last updated: {lastUpdated}</p>
        )}
        <div className="prose prose-sky max-w-none text-sky-800 leading-relaxed [&_h2]:text-sky-900 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-sky-800 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_li]:mb-1.5 [&_a]:text-sky-600 [&_a]:underline hover:[&_a]:text-sky-800">
          {children}
        </div>
      </div>

      <footer className="text-center mt-8 text-sky-500 text-sm">
        <Link to="/privacy" className="hover:text-sky-700 mx-2">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-sky-700 mx-2">Terms of Service</Link>
      </footer>
    </motion.main>
  </div>
);
