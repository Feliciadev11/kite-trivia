import { motion } from "framer-motion";

// Extended color palette for all kites and companions
const ITEM_COLORS = {
  // Kites
  basic_kite: { primary: '#0EA5E9', secondary: '#0284C7', accent: '#F59E0B' },
  rainbow_kite: { primary: '#EC4899', secondary: '#8B5CF6', accent: '#10B981' },
  retro_rainbow: { primary: '#F97316', secondary: '#EAB308', accent: '#22C55E' },
  star_kite: { primary: '#FBBF24', secondary: '#F59E0B', accent: '#0EA5E9' },
  heart_kite: { primary: '#F43F5E', secondary: '#E11D48', accent: '#FBBF24' },
  cloud_kite: { primary: '#E0F2FE', secondary: '#BAE6FD', accent: '#0EA5E9' },
  butterfly_kite: { primary: '#C084FC', secondary: '#A855F7', accent: '#F472B6' },
  dragon_kite: { primary: '#EF4444', secondary: '#DC2626', accent: '#FBBF24' },
  owl_kite: { primary: '#78716C', secondary: '#57534E', accent: '#FBBF24' },
  fish_kite: { primary: '#06B6D4', secondary: '#0891B2', accent: '#F97316' },
  eagle_kite: { primary: '#92400E', secondary: '#78350F', accent: '#FBBF24' },
  celestial_kite: { primary: '#818CF8', secondary: '#6366F1', accent: '#F9A8D4' },
  moon_stars_kite: { primary: '#1E3A8A', secondary: '#3730A3', accent: '#FBBF24' },
  sakura_kite: { primary: '#FDA4AF', secondary: '#FB7185', accent: '#FDF2F8' },
  jellyfish_kite: { primary: '#A78BFA', secondary: '#7C3AED', accent: '#C4B5FD' },
  storm_kite: { primary: '#475569', secondary: '#334155', accent: '#38BDF8' },
  phoenix_kite: { primary: '#F97316', secondary: '#EA580C', accent: '#FBBF24' },
  black_gold_kite: { primary: '#1F2937', secondary: '#111827', accent: '#D4AF37' },
  neon_cyber_kite: { primary: '#06B6D4', secondary: '#0891B2', accent: '#F0ABFC' },
  aurora_kite: { primary: '#10B981', secondary: '#059669', accent: '#A78BFA' },
  
  // Companions
  fox_companion: { primary: '#F97316', secondary: '#EA580C', accent: '#FEF3C7' },
  owl_companion: { primary: '#78716C', secondary: '#57534E', accent: '#FBBF24' },
  black_cat: { primary: '#1F2937', secondary: '#111827', accent: '#10B981' },
  corgi_aviator: { primary: '#FCD34D', secondary: '#F59E0B', accent: '#92400E' },
  red_panda: { primary: '#DC2626', secondary: '#B91C1C', accent: '#FEF3C7' },
  snow_fox: { primary: '#F1F5F9', secondary: '#E2E8F0', accent: '#0EA5E9' },
  raven_companion: { primary: '#1E293B', secondary: '#0F172A', accent: '#818CF8' },
  firefly_swarm: { primary: '#FDE047', secondary: '#FACC15', accent: '#84CC16' },
  jellyfish_creature: { primary: '#C4B5FD', secondary: '#A78BFA', accent: '#F0ABFC' },
  tiny_dragon: { primary: '#EF4444', secondary: '#DC2626', accent: '#FBBF24' },
  spirit_deer: { primary: '#E0F2FE', secondary: '#BAE6FD', accent: '#FBBF24' },
};

// Rarity glow colors
const RARITY_GLOW = {
  common: 'rgba(148, 163, 184, 0.3)',
  rare: 'rgba(59, 130, 246, 0.4)',
  epic: 'rgba(168, 85, 247, 0.5)',
  legendary: 'rgba(251, 191, 36, 0.6)',
};

// Kite character SVG components
export const KiteCharacter = ({ characterId, size = "medium", rarity = "common" }) => {
  const sizeMap = {
    tiny: { width: 40, height: 50 },
    small: { width: 60, height: 75 },
    medium: { width: 80, height: 100 },
    large: { width: 120, height: 150 }
  };

  const dimensions = sizeMap[size] || sizeMap.medium;
  const colors = ITEM_COLORS[characterId] || ITEM_COLORS.basic_kite;
  
  const isAnimal = ['butterfly_kite', 'dragon_kite', 'owl_kite', 'fish_kite', 'eagle_kite', 'jellyfish_kite'].includes(characterId);
  const isCelestial = ['celestial_kite', 'moon_stars_kite', 'phoenix_kite', 'aurora_kite', 'neon_cyber_kite'].includes(characterId);
  const isLuxury = characterId === 'black_gold_kite';
  const isStorm = characterId === 'storm_kite';
  const isSakura = characterId === 'sakura_kite';

  return (
    <motion.div
      animate={{
        y: [0, -8, 0],
        rotate: [-2, 2, -2],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      data-testid={`kite-character-${characterId}`}
      style={{
        filter: rarity !== 'common' ? `drop-shadow(0 0 ${rarity === 'legendary' ? '12px' : rarity === 'epic' ? '8px' : '5px'} ${RARITY_GLOW[rarity]})` : 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
      }}
    >
      <svg 
        width={dimensions.width} 
        height={dimensions.height} 
        viewBox="0 0 80 100"
      >
        {/* Special effects for legendary items */}
        {rarity === 'legendary' && (
          <defs>
            <linearGradient id={`shimmer-${characterId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary}>
                <animate attributeName="stop-color" values={`${colors.primary};${colors.accent};${colors.primary}`} dur="3s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" stopColor={colors.accent}>
                <animate attributeName="stop-color" values={`${colors.accent};${colors.primary};${colors.accent}`} dur="3s" repeatCount="indefinite"/>
              </stop>
            </linearGradient>
          </defs>
        )}

        {isAnimal ? (
          // Animal-style kite
          <>
            <ellipse cx="40" cy="35" rx="35" ry="30" fill={rarity === 'legendary' ? `url(#shimmer-${characterId})` : colors.primary} stroke={colors.secondary} strokeWidth="2"/>
            <ellipse cx="15" cy="40" rx="15" ry="20" fill={colors.secondary} opacity="0.8"/>
            <ellipse cx="65" cy="40" rx="15" ry="20" fill={colors.secondary} opacity="0.8"/>
            <circle cx="30" cy="30" r="8" fill="white"/>
            <circle cx="50" cy="30" r="8" fill="white"/>
            <circle cx="30" cy="30" r="4" fill="#1E293B"/>
            <circle cx="50" cy="30" r="4" fill="#1E293B"/>
            <circle cx="31" cy="29" r="1.5" fill="white"/>
            <circle cx="51" cy="29" r="1.5" fill="white"/>
            <ellipse cx="40" cy="45" rx="6" ry="4" fill={colors.accent}/>
            <path d="M40,65 Q50,75 40,85 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
            <circle cx="45" cy="75" r="4" fill={colors.accent} opacity="0.8"/>
            <circle cx="35" cy="90" r="3" fill={colors.primary} opacity="0.8"/>
          </>
        ) : isCelestial ? (
          // Celestial/magical kite with stars
          <>
            <polygon 
              points="40,5 75,40 40,75 5,40" 
              fill={rarity === 'legendary' ? `url(#shimmer-${characterId})` : colors.primary}
              stroke={colors.secondary} 
              strokeWidth="2"
            />
            <line x1="40" y1="5" x2="40" y2="75" stroke={colors.secondary} strokeWidth="2" opacity="0.5"/>
            <line x1="5" y1="40" x2="75" y2="40" stroke={colors.secondary} strokeWidth="2" opacity="0.5"/>
            {/* Stars decoration */}
            <polygon points="40,15 42,22 50,22 44,27 46,35 40,30 34,35 36,27 30,22 38,22" fill={colors.accent}/>
            <circle cx="25" cy="35" r="3" fill={colors.accent} opacity="0.8"/>
            <circle cx="55" cy="35" r="3" fill={colors.accent} opacity="0.8"/>
            <circle cx="40" cy="55" r="4" fill={colors.accent}/>
            <path d="M40,75 Q50,85 40,90 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
            <circle cx="48" cy="82" r="3" fill={colors.accent} opacity="0.7"/>
            <circle cx="32" cy="92" r="2" fill={colors.accent} opacity="0.7"/>
          </>
        ) : isLuxury ? (
          // Elegant black and gold kite
          <>
            <polygon 
              points="40,5 75,40 40,75 5,40" 
              fill={colors.primary}
              stroke={colors.accent} 
              strokeWidth="3"
            />
            <line x1="40" y1="5" x2="40" y2="75" stroke={colors.accent} strokeWidth="1"/>
            <line x1="5" y1="40" x2="75" y2="40" stroke={colors.accent} strokeWidth="1"/>
            <circle cx="40" cy="40" r="12" fill="none" stroke={colors.accent} strokeWidth="2"/>
            <circle cx="40" cy="40" r="6" fill={colors.accent}/>
            <path d="M40,75 Q50,85 40,90 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
            <ellipse cx="48" cy="82" rx="8" ry="4" fill={colors.accent} opacity="0.8"/>
          </>
        ) : isStorm ? (
          // Storm kite with lightning
          <>
            <polygon 
              points="40,5 75,40 40,75 5,40" 
              fill={colors.primary}
              stroke={colors.secondary} 
              strokeWidth="2"
            />
            <path d="M35,20 L45,35 L40,35 L50,55 L38,40 L42,40 L35,20" fill={colors.accent}/>
            <path d="M40,75 Q50,85 40,90 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
          </>
        ) : isSakura ? (
          // Sakura blossom kite
          <>
            <polygon 
              points="40,5 75,40 40,75 5,40" 
              fill={colors.primary}
              stroke={colors.secondary} 
              strokeWidth="2"
            />
            {/* Cherry blossoms */}
            <circle cx="30" cy="30" r="6" fill={colors.secondary} opacity="0.8"/>
            <circle cx="50" cy="30" r="5" fill={colors.secondary} opacity="0.7"/>
            <circle cx="40" cy="50" r="7" fill={colors.secondary} opacity="0.9"/>
            <circle cx="25" cy="45" r="4" fill={colors.accent} opacity="0.6"/>
            <circle cx="55" cy="45" r="4" fill={colors.accent} opacity="0.6"/>
            <path d="M40,75 Q50,85 40,90 Q30,95 40,100" stroke={colors.secondary} strokeWidth="3" fill="none"/>
          </>
        ) : (
          // Classic diamond kite
          <>
            <polygon 
              points="40,5 75,40 40,75 5,40" 
              fill={rarity === 'legendary' ? `url(#shimmer-${characterId})` : colors.primary}
              stroke={colors.secondary} 
              strokeWidth="2"
            />
            <line x1="40" y1="5" x2="40" y2="75" stroke={colors.secondary} strokeWidth="2"/>
            <line x1="5" y1="40" x2="75" y2="40" stroke={colors.secondary} strokeWidth="2"/>
            <circle cx="40" cy="40" r="10" fill={colors.accent}/>
            <circle cx="40" cy="40" r="6" fill={colors.primary} opacity="0.5"/>
            <circle cx="40" cy="10" r="4" fill={colors.accent} opacity="0.7"/>
            <circle cx="70" cy="40" r="4" fill={colors.accent} opacity="0.7"/>
            <circle cx="10" cy="40" r="4" fill={colors.accent} opacity="0.7"/>
            <path d="M40,75 Q50,85 40,90 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
            <ellipse cx="48" cy="82" rx="8" ry="4" fill={colors.accent} opacity="0.8"/>
            <ellipse cx="32" cy="92" rx="6" ry="3" fill={colors.secondary} opacity="0.8"/>
          </>
        )}
      </svg>
    </motion.div>
  );
};

// Companion character component
export const CompanionCharacter = ({ companionId, size = "small" }) => {
  const sizeMap = {
    tiny: { width: 30, height: 30 },
    small: { width: 40, height: 40 },
    medium: { width: 60, height: 60 },
  };

  const dimensions = sizeMap[size] || sizeMap.small;
  const colors = ITEM_COLORS[companionId] || { primary: '#F97316', secondary: '#EA580C', accent: '#FEF3C7' };

  const isBird = ['owl_companion', 'raven_companion'].includes(companionId);
  const isCat = companionId === 'black_cat';
  const isMagical = ['firefly_swarm', 'jellyfish_creature', 'spirit_deer'].includes(companionId);

  return (
    <motion.div
      animate={{
        y: [0, -4, 0],
        x: [0, 2, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      data-testid={`companion-${companionId}`}
    >
      <svg 
        width={dimensions.width} 
        height={dimensions.height} 
        viewBox="0 0 40 40"
        style={{ filter: isMagical ? 'drop-shadow(0 0 6px rgba(168, 139, 250, 0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
      >
        {isBird ? (
          // Bird companion
          <>
            <ellipse cx="20" cy="22" rx="12" ry="10" fill={colors.primary}/>
            <circle cx="20" cy="15" r="8" fill={colors.primary}/>
            <circle cx="16" cy="14" r="3" fill="white"/>
            <circle cx="24" cy="14" r="3" fill="white"/>
            <circle cx="16" cy="14" r="1.5" fill="#1E293B"/>
            <circle cx="24" cy="14" r="1.5" fill="#1E293B"/>
            <polygon points="20,17 18,20 22,20" fill={colors.accent}/>
            <ellipse cx="10" cy="22" rx="4" ry="6" fill={colors.secondary}/>
            <ellipse cx="30" cy="22" rx="4" ry="6" fill={colors.secondary}/>
          </>
        ) : isCat ? (
          // Cat companion
          <>
            <ellipse cx="20" cy="25" rx="10" ry="8" fill={colors.primary}/>
            <circle cx="20" cy="15" r="9" fill={colors.primary}/>
            <polygon points="12,8 14,16 8,14" fill={colors.primary}/>
            <polygon points="28,8 26,16 32,14" fill={colors.primary}/>
            <ellipse cx="16" cy="14" rx="2" ry="3" fill={colors.accent}/>
            <ellipse cx="24" cy="14" rx="2" ry="3" fill={colors.accent}/>
            <circle cx="16" cy="14" r="1" fill="#1E293B"/>
            <circle cx="24" cy="14" r="1" fill="#1E293B"/>
            <ellipse cx="20" cy="18" rx="2" ry="1" fill="#FDA4AF"/>
          </>
        ) : isMagical ? (
          // Magical creature (glowing orb style)
          <>
            <circle cx="20" cy="20" r="12" fill={colors.primary} opacity="0.8"/>
            <circle cx="20" cy="20" r="8" fill={colors.secondary} opacity="0.9"/>
            <circle cx="20" cy="20" r="4" fill={colors.accent}/>
            <circle cx="17" cy="17" r="2" fill="white" opacity="0.6"/>
          </>
        ) : (
          // Generic cute animal (fox/panda/corgi style)
          <>
            <ellipse cx="20" cy="25" rx="12" ry="10" fill={colors.primary}/>
            <circle cx="20" cy="16" r="10" fill={colors.primary}/>
            <polygon points="10,8 14,16 6,14" fill={colors.primary}/>
            <polygon points="30,8 26,16 34,14" fill={colors.primary}/>
            <circle cx="15" cy="15" r="3" fill="white"/>
            <circle cx="25" cy="15" r="3" fill="white"/>
            <circle cx="15" cy="15" r="1.5" fill="#1E293B"/>
            <circle cx="25" cy="15" r="1.5" fill="#1E293B"/>
            <ellipse cx="20" cy="20" rx="3" ry="2" fill={colors.accent}/>
          </>
        )}
      </svg>
    </motion.div>
  );
};

export default KiteCharacter;
