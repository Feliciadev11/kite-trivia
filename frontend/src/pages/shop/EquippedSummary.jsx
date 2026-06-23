import { motion } from "framer-motion";
import { Palette } from "lucide-react";
import { KiteCharacter, CompanionCharacter } from "../../components/KiteCharacter";

/**
 * Top "Currently Equipped" summary card on the Shop page.
 */
export const EquippedSummary = ({ user }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-6 mb-8 max-w-3xl mx-auto"
  >
    <p className="text-sky-500 text-sm mb-4 text-center">Currently Equipped</p>
    <div className="flex items-center justify-center gap-8">
      <div className="text-center">
        <KiteCharacter characterId={user?.current_character || "basic_kite"} size="medium" />
        <p className="text-sky-700 text-sm mt-2 capitalize">
          {user?.current_character?.replace(/_/g, " ")}
        </p>
      </div>
      {user?.current_companion && (
        <div className="text-center">
          <CompanionCharacter companionId={user.current_companion} size="medium" />
          <p className="text-sky-700 text-sm mt-2 capitalize">
            {user.current_companion.replace(/_/g, " ")}
          </p>
        </div>
      )}
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-200 to-sky-100 flex items-center justify-center">
          <Palette className="w-8 h-8 text-sky-500" />
        </div>
        <p className="text-sky-700 text-sm mt-2 capitalize">
          {user?.current_sky_theme?.replace(/_/g, " ") || "Dawn"}
        </p>
      </div>
    </div>
  </motion.div>
);
