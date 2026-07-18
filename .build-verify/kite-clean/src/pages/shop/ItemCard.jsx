import { motion } from "framer-motion";
import { Lock, Check, DollarSign } from "lucide-react";
import { Button } from "../../components/ui/button";
import { KiteCharacter, CompanionCharacter } from "../../components/KiteCharacter";
import { SkyThemeSwatch } from "../../components/SkyThemeSwatch";
import { RARITY_COLORS } from "./shopConstants";

/**
 * Visually previews an inventory item using the appropriate renderer.
 */
const ItemPreview = ({ type, item }) => {
  if (type === "companion") return <CompanionCharacter companionId={item.character_id} size="medium" />;
  if (type === "sky_theme") return <SkyThemeSwatch themeId={item.character_id} size={80} />;
  return <KiteCharacter characterId={item.character_id} size="small" rarity={item.rarity} />;
};

/**
 * Status badge shown at the top-right of an ItemCard.
 */
const StatusBadge = ({ equipped, owned, locked, unlockLevel }) => {
  if (equipped) {
    return (
      <span className="absolute top-2 right-2 bg-sky-500 text-white text-xs px-2 py-0.5 rounded-full">
        Active
      </span>
    );
  }
  if (owned) {
    return (
      <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
        Owned
      </span>
    );
  }
  if (locked) {
    return (
      <span className="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
        <Lock className="w-3 h-3" />
        Lvl {unlockLevel}
      </span>
    );
  }
  return null;
};

/**
 * Action button for an ItemCard — Active / Use / Locked / Buy depending on
 * ownership, level gate and rarity-driven button colour.
 */
const ItemAction = ({ equipped, owned, locked, isFree, rarity, onEquip, onPurchase }) => {
  if (equipped) {
    return (
      <Button disabled className="w-full rounded-full text-xs py-2" size="sm">
        <Check className="w-4 h-4 mr-1" />
        Active
      </Button>
    );
  }
  if (owned) {
    return (
      <Button
        onClick={onEquip}
        className="w-full rounded-full bg-sky-500 hover:bg-sky-600 text-xs py-2"
        size="sm"
      >
        Use
      </Button>
    );
  }
  if (locked) {
    return (
      <Button disabled className="w-full rounded-full text-xs py-2" size="sm">
        <Lock className="w-4 h-4 mr-1" />
        Locked
      </Button>
    );
  }
  const rarityClass =
    rarity === "legendary" ? "bg-amber-500 hover:bg-amber-600"
    : rarity === "epic" ? "bg-purple-500 hover:bg-purple-600"
    : "bg-green-500 hover:bg-green-600";
  return (
    <Button
      onClick={onPurchase}
      className={`w-full rounded-full text-xs py-2 ${rarityClass}`}
      size="sm"
    >
      <DollarSign className="w-4 h-4 mr-1" />
      {isFree ? "Get" : "Buy"}
    </Button>
  );
};

/**
 * One Shop item card. Composes preview + status + price + action button.
 *
 * @param {{
 *   item: { character_id: string, name: string, description: string, rarity: string, unlock_level: number, price: number },
 *   owned: boolean,
 *   equipped: boolean,
 *   userLevel: number,
 *   onEquip: () => void,
 *   onPurchase: () => void,
 *   index: number,
 *   type: 'kite' | 'companion' | 'sky_theme',
 * }} props
 */
export const ItemCard = ({ item, owned, equipped, userLevel, onEquip, onPurchase, index, type }) => {
  const locked = item.unlock_level > userLevel;
  const isFree = item.price === 0;
  const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`glass-card p-4 relative ${rarity.bg} ${rarity.border} border ${owned ? "ring-2 ring-green-400" : ""} ${locked ? "opacity-60" : ""}`}
      data-testid={`item-card-${item.character_id}`}
    >
      <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${rarity.badge} capitalize`}>
        {item.rarity}
      </span>

      <StatusBadge equipped={equipped} owned={owned} locked={locked} unlockLevel={item.unlock_level} />

      <div className="flex justify-center py-6 mt-4">
        <ItemPreview type={type} item={item} />
      </div>

      <div className="text-center">
        <h3 className="font-semibold text-sky-900 text-sm">{item.name}</h3>
        <p className="text-sky-600 text-xs mt-1 line-clamp-2 h-8">{item.description}</p>
        {!owned && (
          <p className={`mt-2 font-bold ${rarity.text}`}>
            {isFree ? "Free" : `$${item.price.toFixed(2)}`}
          </p>
        )}
      </div>

      <div className="mt-3">
        <ItemAction
          equipped={equipped}
          owned={owned}
          locked={locked}
          isFree={isFree}
          rarity={item.rarity}
          onEquip={onEquip}
          onPurchase={onPurchase}
        />
      </div>
    </motion.div>
  );
};
