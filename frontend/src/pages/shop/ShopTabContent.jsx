import { motion } from "framer-motion";
import { ItemCard } from "./ItemCard";
import { RaritySection } from "./RaritySection";
import { RARITY_GATES, RARITY_ORDER, sortByRarity, TAB_CONFIG } from "./shopConstants";

/**
 * One full Shop tab — renders all 4 rarity sections for a given category
 * (kites / companions / skies). Locked rarities show a level-gate header
 * only; unlocked rarities also render their item grid.
 *
 * @param {{
 *   tabKey: 'kites' | 'companions' | 'skies',
 *   items: Array<object>,
 *   user: object,
 *   onEquip: (characterId: string, type: string) => void,
 *   onPurchase: (item: object) => void,
 *   isPremium: boolean,
 * }} props
 */
export const ShopTabContent = ({ tabKey, items, user, onEquip, onPurchase, isPremium }) => {
  const cfg = TAB_CONFIG[tabKey];
  const userLevel = user?.level || 1;
  const ownedList = user?.[cfg.ownedKey] || [];
  const equippedId = user?.[cfg.equippedKey];

  const sorted = sortByRarity(items);

  return (
    <motion.div
      key={`${tabKey}-content`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {RARITY_ORDER.map(rarity => {
        const rarityItems = sorted.filter(i => i.rarity === rarity);
        if (rarityItems.length === 0) return null;
        const gate = RARITY_GATES[cfg.category][rarity] || 0;
        const locked = userLevel < gate;

        return (
          <div key={rarity}>
            <RaritySection
              rarity={rarity}
              items={rarityItems}
              gateLevel={gate}
              userLevel={userLevel}
            >
              {cfg.label}
            </RaritySection>
            {!locked && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {rarityItems.map((item, index) => (
                  <ItemCard
                    key={item.character_id}
                    item={item}
                    owned={ownedList.includes(item.character_id)}
                    equipped={equippedId === item.character_id}
                    userLevel={userLevel}
                    onEquip={() => onEquip(item.character_id, cfg.category)}
                    onPurchase={() => onPurchase(item)}
                    index={index}
                    type={cfg.category}
                    isPremium={isPremium}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
};
