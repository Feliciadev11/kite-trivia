import { motion } from "framer-motion";

// Kite character SVG components based on character_id
export const KiteCharacter = ({ characterId, size = "medium" }) => {
  const sizeMap = {
    tiny: { width: 40, height: 50 },
    small: { width: 60, height: 75 },
    medium: { width: 80, height: 100 },
    large: { width: 120, height: 150 }
  };

  const dimensions = sizeMap[size] || sizeMap.medium;

  const getKiteColors = () => {
    switch (characterId) {
      case 'basic_kite':
        return { primary: '#0EA5E9', secondary: '#0284C7', accent: '#F59E0B' };
      case 'rainbow_kite':
        return { primary: '#EC4899', secondary: '#8B5CF6', accent: '#10B981' };
      case 'star_kite':
        return { primary: '#FBBF24', secondary: '#F59E0B', accent: '#0EA5E9' };
      case 'heart_kite':
        return { primary: '#F43F5E', secondary: '#E11D48', accent: '#FBBF24' };
      case 'cloud_kite':
        return { primary: '#E0F2FE', secondary: '#BAE6FD', accent: '#0EA5E9' };
      case 'butterfly_kite':
        return { primary: '#C084FC', secondary: '#A855F7', accent: '#F472B6' };
      case 'dragon_kite':
        return { primary: '#EF4444', secondary: '#DC2626', accent: '#FBBF24' };
      case 'owl_kite':
        return { primary: '#78716C', secondary: '#57534E', accent: '#FBBF24' };
      case 'fish_kite':
        return { primary: '#06B6D4', secondary: '#0891B2', accent: '#F97316' };
      case 'eagle_kite':
        return { primary: '#92400E', secondary: '#78350F', accent: '#FBBF24' };
      default:
        return { primary: '#0EA5E9', secondary: '#0284C7', accent: '#F59E0B' };
    }
  };

  const colors = getKiteColors();
  const isAnimal = ['butterfly_kite', 'dragon_kite', 'owl_kite', 'fish_kite', 'eagle_kite'].includes(characterId);

  return (
    <motion.div
      animate={{
        y: [0, -5, 0],
        rotate: [-1, 1, -1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      data-testid={`kite-character-${characterId}`}
    >
      <svg 
        width={dimensions.width} 
        height={dimensions.height} 
        viewBox="0 0 80 100"
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
      >
        {isAnimal ? (
          // Animal-style kite with more organic shape
          <>
            {/* Body */}
            <ellipse cx="40" cy="35" rx="35" ry="30" fill={colors.primary} stroke={colors.secondary} strokeWidth="2"/>
            
            {/* Wings */}
            <ellipse cx="15" cy="40" rx="15" ry="20" fill={colors.secondary} opacity="0.8"/>
            <ellipse cx="65" cy="40" rx="15" ry="20" fill={colors.secondary} opacity="0.8"/>
            
            {/* Eyes */}
            <circle cx="30" cy="30" r="8" fill="white"/>
            <circle cx="50" cy="30" r="8" fill="white"/>
            <circle cx="30" cy="30" r="4" fill="#1E293B"/>
            <circle cx="50" cy="30" r="4" fill="#1E293B"/>
            <circle cx="31" cy="29" r="1.5" fill="white"/>
            <circle cx="51" cy="29" r="1.5" fill="white"/>
            
            {/* Cute mouth/beak */}
            <ellipse cx="40" cy="45" rx="6" ry="4" fill={colors.accent}/>
            
            {/* Tail */}
            <path d="M40,65 Q50,75 40,85 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
            <circle cx="45" cy="75" r="4" fill={colors.accent} opacity="0.8"/>
            <circle cx="35" cy="90" r="3" fill={colors.primary} opacity="0.8"/>
          </>
        ) : (
          // Classic diamond kite
          <>
            {/* Main kite body */}
            <polygon 
              points="40,5 75,40 40,75 5,40" 
              fill={colors.primary} 
              stroke={colors.secondary} 
              strokeWidth="2"
            />
            
            {/* Cross supports */}
            <line x1="40" y1="5" x2="40" y2="75" stroke={colors.secondary} strokeWidth="2"/>
            <line x1="5" y1="40" x2="75" y2="40" stroke={colors.secondary} strokeWidth="2"/>
            
            {/* Center decoration */}
            <circle cx="40" cy="40" r="10" fill={colors.accent}/>
            <circle cx="40" cy="40" r="6" fill={colors.primary} opacity="0.5"/>
            
            {/* Corner decorations */}
            <circle cx="40" cy="10" r="4" fill={colors.accent} opacity="0.7"/>
            <circle cx="70" cy="40" r="4" fill={colors.accent} opacity="0.7"/>
            <circle cx="10" cy="40" r="4" fill={colors.accent} opacity="0.7"/>
            
            {/* Tail */}
            <path d="M40,75 Q50,85 40,90 Q30,95 40,100" stroke={colors.accent} strokeWidth="3" fill="none"/>
            
            {/* Tail bows */}
            <ellipse cx="48" cy="82" rx="8" ry="4" fill={colors.accent} opacity="0.8"/>
            <ellipse cx="32" cy="92" rx="6" ry="3" fill={colors.secondary} opacity="0.8"/>
          </>
        )}
      </svg>
    </motion.div>
  );
};

export default KiteCharacter;
