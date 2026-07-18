// Mirrors the backend PROGRESSIVE_GATES — used by the UI to render
// "Unlocks at Level N" badges. Backend remains the source of truth for
// purchase/equip enforcement.
export const RARITY_GATES = {
  kite:       { common: 3,  rare: 8,  epic: 14, legendary: 20 },
  companion:  { common: 5,  rare: 10, epic: 16, legendary: 22 },
  sky_theme:  { common: 4,  rare: 9,  epic: 15, legendary: 20 },
};

export const RARITY_COLORS = {
  common:    { bg: "bg-slate-50",  border: "border-slate-200",  text: "text-slate-600",  badge: "bg-slate-200 text-slate-700" },
  rare:      { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-600",   badge: "bg-blue-200 text-blue-700" },
  epic:      { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600", badge: "bg-purple-200 text-purple-700" },
  legendary: { bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-600",  badge: "bg-amber-200 text-amber-700" },
};

export const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };

export const sortByRarity = (items) =>
  [...items].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]);

// Configuration that powers the three Shop tabs. Keeping this in one place
// means each tab pulls its own collection/ownership/equip rules without the
// page component having three near-identical render branches.
export const TAB_CONFIG = {
  kites: {
    category: "kite",
    label: "Kites",
    ownedKey: "owned_characters",
    equippedKey: "current_character",
  },
  companions: {
    category: "companion",
    label: "Companions",
    ownedKey: "owned_companions",
    equippedKey: "current_companion",
  },
  skies: {
    category: "sky_theme",
    label: "Sky Themes",
    ownedKey: "owned_sky_themes",
    equippedKey: "current_sky_theme",
  },
};
