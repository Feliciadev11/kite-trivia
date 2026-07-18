import { motion } from 'framer-motion';

// ============ Reusable atomic layers ============

export const FloatingClouds = ({ count = 5, color = 'rgba(255,255,255,0.55)', speed = 'slow' }) => {
  const speedMultiplier = speed === 'fast' ? 0.5 : speed === 'medium' ? 1 : 1.5;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={`cloud-${i}`}
          className="absolute"
          style={{ top: `${10 + (i * 15) % 60}%`, left: '-20%' }}
          animate={{ x: ['0vw', '140vw'] }}
          transition={{ duration: (60 + i * 20) * speedMultiplier, repeat: Infinity, ease: 'linear', delay: i * 8 }}
        >
          <div
            className="rounded-full blur-xl"
            style={{
              width: `${80 + i * 30}px`,
              height: `${40 + i * 15}px`,
              backgroundColor: color,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

export const FloatingParticles = ({ count = 20, color = 'white', glow = false }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => {
      const fill =
        color === 'golden' ? '#fbbf24' :
        color === 'blue' ? '#7dd3fc' :
        color === 'pink' ? '#f9a8d4' :
        color === 'violet' ? '#c4b5fd' :
        color === 'mint' ? '#6ee7b7' :
        'rgba(255,255,255,0.7)';
      return (
        <motion.div
          key={`particle-${i}`}
          className="absolute rounded-full"
          style={{
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            backgroundColor: fill,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            boxShadow: glow ? `0 0 ${6 + Math.random() * 8}px ${fill}` : 'none',
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() > 0.5 ? 10 : -10, 0],
            opacity: [0.3, 0.85, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 3 }}
        />
      );
    })}
  </div>
);

export const TwinklingStars = ({ count = 30, color = '#ffffff' }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={`star-${i}`}
        className="absolute rounded-full"
        style={{
          width: `${1 + Math.random() * 2}px`,
          height: `${1 + Math.random() * 2}px`,
          backgroundColor: color,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 70}%`,
          boxShadow: `0 0 6px ${color}`,
        }}
        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
        transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 }}
      />
    ))}
  </div>
);

export const WindLines = ({ count = 3, color = 'rgba(125,211,252,0.35)' }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={`wind-${i}`}
        className="absolute h-px"
        style={{
          width: `${100 + Math.random() * 200}px`,
          top: `${20 + i * 25}%`,
          left: '-200px',
          background: `linear-gradient(to right, transparent, ${color}, transparent)`,
        }}
        animate={{ x: ['0vw', '120vw'], opacity: [0, 0.6, 0] }}
        transition={{ duration: 8 + i * 3, repeat: Infinity, ease: 'linear', delay: i * 4 }}
      />
    ))}
  </div>
);

// ============ Signature theme elements ============

// A glowing sun/moon disc anchored top-right
const CelestialDisc = ({ color, glowColor, size = 180, top = '8%', right = '10%' }) => (
  <motion.div
    className="fixed pointer-events-none z-0 rounded-full"
    style={{
      width: size,
      height: size,
      top,
      right,
      background: `radial-gradient(circle, ${color} 0%, ${color}cc 40%, transparent 70%)`,
      boxShadow: `0 0 80px ${glowColor}`,
    }}
    animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
  />
);

// Aurora ribbons — slow flowing waves of color (for aurora theme)
const AuroraRibbons = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {['#34d399', '#22d3ee', '#a78bfa'].map((c, i) => (
      <motion.div
        key={c}
        className="absolute inset-x-0"
        style={{
          top: `${15 + i * 12}%`,
          height: '180px',
          background: `linear-gradient(180deg, transparent 0%, ${c}33 40%, ${c}55 50%, ${c}33 60%, transparent 100%)`,
          filter: 'blur(24px)',
        }}
        animate={{
          x: ['-10%', '10%', '-10%'],
          opacity: [0.5, 0.85, 0.5],
        }}
        transition={{ duration: 14 + i * 3, repeat: Infinity, ease: 'easeInOut', delay: i * 2 }}
      />
    ))}
  </div>
);

// Falling rain streaks (for gentle_rain theme)
const RainStreaks = ({ count = 40 }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={`rain-${i}`}
        className="absolute"
        style={{
          width: '1px',
          height: `${20 + Math.random() * 30}px`,
          left: `${Math.random() * 100}%`,
          top: '-40px',
          background: 'linear-gradient(180deg, transparent, rgba(186,230,253,0.7))',
        }}
        animate={{ y: ['0vh', '110vh'] }}
        transition={{ duration: 0.8 + Math.random() * 0.6, repeat: Infinity, ease: 'linear', delay: Math.random() * 2 }}
      />
    ))}
  </div>
);

// Falling petals (for cherry_blossom_sky)
const FallingPetals = ({ count = 18 }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={`petal-${i}`}
        className="absolute"
        style={{ left: `${Math.random() * 100}%`, top: '-30px' }}
        animate={{
          y: ['0vh', '110vh'],
          x: [0, 30, -20, 25, 0],
          rotate: [0, 180, 360, 540, 720],
        }}
        transition={{ duration: 12 + Math.random() * 8, repeat: Infinity, ease: 'linear', delay: Math.random() * 6 }}
      >
        <div
          style={{
            width: '12px',
            height: '8px',
            background: 'radial-gradient(ellipse at center, #fbcfe8 30%, #f9a8d4 70%)',
            borderRadius: '60% 20% 60% 20%',
            opacity: 0.85,
            filter: 'drop-shadow(0 0 4px rgba(244,114,182,0.4))',
          }}
        />
      </motion.div>
    ))}
  </div>
);

// Falling leaves (for autumn)
const FallingLeaves = ({ count = 18 }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => {
      const tone = ['#ea580c', '#d97706', '#b45309', '#dc2626', '#a16207'][i % 5];
      return (
        <motion.div
          key={`leaf-${i}`}
          className="absolute"
          style={{ left: `${Math.random() * 100}%`, top: '-30px' }}
          animate={{
            y: ['0vh', '110vh'],
            x: [0, 25, -20, 18, 0],
            rotate: [0, 220, 440, 660, 880],
          }}
          transition={{ duration: 10 + Math.random() * 8, repeat: Infinity, ease: 'linear', delay: Math.random() * 6 }}
        >
          <div
            style={{
              width: 11, height: 9,
              background: `radial-gradient(ellipse at 30% 30%, ${tone}, ${tone}aa)`,
              borderRadius: '50% 10% 50% 10%',
              opacity: 0.85,
              filter: `drop-shadow(0 0 3px ${tone}55)`,
            }}
          />
        </motion.div>
      );
    })}
  </div>
);

// Snowfall (for winter)
const Snowfall = ({ count = 45 }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={`snow-${i}`}
        className="absolute rounded-full bg-white"
        style={{
          width: 2 + Math.random() * 4,
          height: 2 + Math.random() * 4,
          left: `${Math.random() * 100}%`,
          top: '-10px',
          opacity: 0.85,
          boxShadow: '0 0 5px rgba(255,255,255,0.7)',
        }}
        animate={{
          y: ['0vh', '110vh'],
          x: [0, 18, -12, 14, 0],
        }}
        transition={{ duration: 8 + Math.random() * 6, repeat: Infinity, ease: 'linear', delay: Math.random() * 5 }}
      />
    ))}
  </div>
);

// A crescent moon for moonlit
const CrescentMoon = () => (
  <div className="fixed pointer-events-none z-0" style={{ top: '10%', right: '12%' }}>
    <motion.div
      className="relative"
      animate={{ rotate: [0, 6, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div
        className="rounded-full"
        style={{
          width: 140,
          height: 140,
          background: 'radial-gradient(circle, #f1f5f9 0%, #cbd5e1 70%, transparent 75%)',
          boxShadow: '0 0 60px rgba(241,245,249,0.45)',
        }}
      />
      <div
        className="absolute top-0 left-0 rounded-full"
        style={{
          width: 140,
          height: 140,
          background: 'radial-gradient(circle at 70% 50%, #1e293b 0%, #1e293b 50%, transparent 55%)',
        }}
      />
    </motion.div>
  </div>
);

// Cosmic nebula clouds (for celestial_night)
const NebulaClouds = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {[
      { color: 'rgba(168,85,247,0.35)', top: '20%', left: '60%', size: 380 },
      { color: 'rgba(236,72,153,0.25)', top: '50%', left: '15%', size: 320 },
      { color: 'rgba(14,165,233,0.3)', top: '15%', left: '20%', size: 260 },
    ].map((n, i) => (
      <motion.div
        key={`nebula-${i}`}
        className="absolute rounded-full"
        style={{
          width: n.size,
          height: n.size,
          top: n.top,
          left: n.left,
          background: `radial-gradient(circle, ${n.color} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// Shooting star streaks (subtle, occasional) for starry_night
const ShootingStars = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {[0, 1].map((i) => (
      <motion.div
        key={`shooting-${i}`}
        className="absolute"
        style={{ top: `${15 + i * 30}%`, left: '-10%', width: 140, height: 1 }}
        animate={{ x: ['0vw', '120vw'], opacity: [0, 1, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 5 + i * 9, repeatDelay: 12 }}
      >
        <div className="w-full h-full" style={{ background: 'linear-gradient(to right, transparent, #fff, transparent)', boxShadow: '0 0 8px #fff' }} />
      </motion.div>
    ))}
  </div>
);

// ============ Theme catalog ============

const themeMap = {
  dawn: {
    gradient: 'linear-gradient(180deg, #fecaca 0%, #fde68a 35%, #bae6fd 75%, #f0f9ff 100%)',
    cloudColor: 'rgba(255,255,255,0.65)',
    Extras: () => (
      <>
        <CelestialDisc color="#fbbf24" glowColor="rgba(251,191,36,0.5)" size={160} />
        <FloatingClouds count={4} color="rgba(255,255,255,0.65)" />
        <FloatingParticles count={15} color="golden" glow />
        <WindLines count={2} color="rgba(254,215,170,0.5)" />
      </>
    ),
  },
  clear_day: {
    gradient: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 40%, #bae6fd 70%, #f0f9ff 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef08a" glowColor="rgba(250,204,21,0.55)" size={180} />
        <FloatingClouds count={5} color="rgba(255,255,255,0.85)" speed="medium" />
        <FloatingParticles count={10} color="white" />
        <WindLines count={3} color="rgba(255,255,255,0.5)" />
      </>
    ),
  },
  sunset_glow: {
    gradient: 'linear-gradient(180deg, #fb7185 0%, #fb923c 35%, #fbbf24 60%, #fde68a 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef3c7" glowColor="rgba(251,146,60,0.7)" size={220} top="35%" right="8%" />
        <FloatingClouds count={4} color="rgba(244,114,182,0.5)" />
        <FloatingParticles count={22} color="golden" glow />
        <WindLines count={3} color="rgba(251,113,133,0.4)" />
      </>
    ),
  },
  twilight: {
    gradient: 'linear-gradient(180deg, #312e81 0%, #6d28d9 40%, #db2777 75%, #fb923c 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fde68a" glowColor="rgba(253,230,138,0.6)" size={120} top="14%" right="14%" />
        <TwinklingStars count={50} color="#fef3c7" />
        <FloatingParticles count={18} color="violet" glow />
      </>
    ),
  },
  starry_night: {
    gradient: 'linear-gradient(180deg, #020617 0%, #1e1b4b 50%, #312e81 100%)',
    Extras: () => (
      <>
        <TwinklingStars count={80} color="#ffffff" />
        <ShootingStars />
        <FloatingParticles count={8} color="blue" glow />
      </>
    ),
  },
  moonlit: {
    gradient: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    Extras: () => (
      <>
        <CrescentMoon />
        <TwinklingStars count={45} color="#f1f5f9" />
        <FloatingClouds count={3} color="rgba(148,163,184,0.35)" />
        <FloatingParticles count={10} color="white" glow />
      </>
    ),
  },
  aurora_borealis: {
    gradient: 'linear-gradient(180deg, #042f2e 0%, #064e3b 40%, #1e1b4b 100%)',
    Extras: () => (
      <>
        <AuroraRibbons />
        <TwinklingStars count={55} color="#a7f3d0" />
        <FloatingParticles count={20} color="mint" glow />
      </>
    ),
  },
  golden_hour: {
    gradient: 'linear-gradient(180deg, #fde68a 0%, #fbbf24 40%, #fdba74 75%, #fff7ed 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fbbf24" glowColor="rgba(245,158,11,0.7)" size={240} top="48%" right="10%" />
        <FloatingClouds count={4} color="rgba(254,215,170,0.7)" />
        <FloatingParticles count={28} color="golden" glow />
        <WindLines count={3} color="rgba(251,191,36,0.5)" />
      </>
    ),
  },
  gentle_rain: {
    gradient: 'linear-gradient(180deg, #475569 0%, #64748b 40%, #94a3b8 80%, #cbd5e1 100%)',
    Extras: () => (
      <>
        <FloatingClouds count={6} color="rgba(241,245,249,0.6)" speed="medium" />
        <RainStreaks count={50} />
      </>
    ),
  },
  cherry_blossom_sky: {
    gradient: 'linear-gradient(180deg, #fbcfe8 0%, #fda4af 30%, #fdf2f8 70%, #fff1f2 100%)',
    Extras: () => (
      <>
        <FloatingClouds count={3} color="rgba(255,255,255,0.7)" />
        <FallingPetals count={22} />
        <FloatingParticles count={10} color="pink" />
      </>
    ),
  },
  cloudy_dreams: {
    gradient: 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 40%, #f8fafc 100%)',
    Extras: () => (
      <>
        <FloatingClouds count={9} color="rgba(255,255,255,0.85)" speed="medium" />
        <FloatingParticles count={8} color="white" />
        <WindLines count={2} color="rgba(186,230,253,0.5)" />
      </>
    ),
  },
  celestial_night: {
    gradient: 'linear-gradient(180deg, #1e1b4b 0%, #4c1d95 50%, #5b21b6 100%)',
    Extras: () => (
      <>
        <NebulaClouds />
        <TwinklingStars count={70} color="#fce7f3" />
        <ShootingStars />
        <FloatingParticles count={18} color="violet" glow />
      </>
    ),
  },
  // ---- Buyable Seasonal ----
  spring_bloom: {
    gradient: 'linear-gradient(180deg, #d9f99d 0%, #fbcfe8 50%, #f0fdf4 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef9c3" glowColor="rgba(254,240,138,0.5)" size={140} top="12%" right="14%" />
        <FloatingClouds count={3} color="rgba(255,255,255,0.8)" />
        <FallingPetals count={26} />
        <FloatingParticles count={14} color="pink" glow />
      </>
    ),
  },
  summer_heatwave: {
    gradient: 'linear-gradient(180deg, #fb923c 0%, #fbbf24 40%, #fef3c7 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef3c7" glowColor="rgba(245,158,11,0.8)" size={260} top="42%" right="10%" />
        <FloatingClouds count={2} color="rgba(254,215,170,0.6)" speed="medium" />
        <FloatingParticles count={30} color="golden" glow />
        <WindLines count={4} color="rgba(251,146,60,0.5)" />
      </>
    ),
  },
  autumn_leaves: {
    gradient: 'linear-gradient(180deg, #b45309 0%, #ea580c 40%, #fdba74 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fed7aa" glowColor="rgba(234,88,12,0.6)" size={170} top="20%" right="12%" />
        <FloatingClouds count={3} color="rgba(254,215,170,0.5)" />
        <FallingLeaves count={22} />
        <WindLines count={3} color="rgba(234,88,12,0.4)" />
      </>
    ),
  },
  winter_frost: {
    gradient: 'linear-gradient(180deg, #bae6fd 0%, #e0f2fe 50%, #f8fafc 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#f1f5f9" glowColor="rgba(186,230,253,0.55)" size={160} top="15%" right="14%" />
        <FloatingClouds count={4} color="rgba(255,255,255,0.95)" speed="medium" />
        <Snowfall count={50} />
        <FloatingParticles count={14} color="blue" glow />
      </>
    ),
  },
  // ---- Free Monthly Seasonal ----
  seasonal_spring: {
    gradient: 'linear-gradient(180deg, #bef264 0%, #fdf2f8 50%, #f0fdf4 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef08a" glowColor="rgba(190,242,100,0.45)" size={150} top="16%" right="14%" />
        <FloatingClouds count={4} color="rgba(255,255,255,0.85)" />
        <FallingPetals count={20} />
        <FloatingParticles count={12} color="mint" glow />
      </>
    ),
  },
  seasonal_summer: {
    gradient: 'linear-gradient(180deg, #38bdf8 0%, #fef08a 50%, #fde68a 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef3c7" glowColor="rgba(250,204,21,0.7)" size={210} top="32%" right="10%" />
        <FloatingClouds count={4} color="rgba(255,255,255,0.9)" speed="medium" />
        <FloatingParticles count={24} color="golden" glow />
        <WindLines count={3} color="rgba(56,189,248,0.4)" />
      </>
    ),
  },
  seasonal_autumn: {
    gradient: 'linear-gradient(180deg, #c2410c 0%, #f59e0b 45%, #fde68a 100%)',
    Extras: () => (
      <>
        <CelestialDisc color="#fef3c7" glowColor="rgba(245,158,11,0.65)" size={180} top="22%" right="12%" />
        <FloatingClouds count={3} color="rgba(254,215,170,0.6)" />
        <FallingLeaves count={18} />
        <WindLines count={3} color="rgba(217,119,6,0.4)" />
      </>
    ),
  },
  seasonal_winter: {
    gradient: 'linear-gradient(180deg, #475569 0%, #94a3b8 45%, #e2e8f0 100%)',
    Extras: () => (
      <>
        <CrescentMoon />
        <FloatingClouds count={4} color="rgba(241,245,249,0.7)" />
        <Snowfall count={45} />
        <FloatingParticles count={10} color="white" glow />
      </>
    ),
  },
};

export const AtmosphericBackground = ({ theme = 'dawn' }) => {
  const t = themeMap[theme] || themeMap.dawn;
  const Extras = t.Extras;
  return (
    <>
      <div
        className="fixed inset-0 transition-[background] duration-1000"
        style={{ background: t.gradient, zIndex: 0 }}
      />
      <Extras />
    </>
  );
};

export default AtmosphericBackground;
