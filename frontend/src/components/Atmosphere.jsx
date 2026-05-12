import { motion } from 'framer-motion';

// Floating clouds that drift across the sky
export const FloatingClouds = ({ count = 5, speed = 'slow' }) => {
  const speedMultiplier = speed === 'fast' ? 0.5 : speed === 'medium' ? 1 : 1.5;
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: `${10 + (i * 15) % 60}%`,
            left: '-20%',
          }}
          animate={{
            x: ['0vw', '140vw'],
          }}
          transition={{
            duration: (60 + i * 20) * speedMultiplier,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 8,
          }}
        >
          <div 
            className="bg-white/30 rounded-full blur-xl"
            style={{
              width: `${80 + i * 30}px`,
              height: `${40 + i * 15}px`,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

// Gentle floating particles (like dust in sunlight or fireflies)
export const FloatingParticles = ({ count = 20, color = 'white', glow = false }) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${glow ? 'shadow-lg' : ''}`}
          style={{
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            backgroundColor: color === 'golden' ? '#fbbf24' : color === 'blue' ? '#7dd3fc' : 'rgba(255,255,255,0.6)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            boxShadow: glow ? `0 0 ${6 + Math.random() * 6}px ${color === 'golden' ? '#fbbf24' : '#7dd3fc'}` : 'none',
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() > 0.5 ? 10 : -10, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
};

// Stars for night themes
export const TwinklingStars = ({ count = 30 }) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 70}%`,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
};

// Gentle wind lines
export const WindLines = ({ count = 3 }) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-px bg-gradient-to-r from-transparent via-sky-200/30 to-transparent"
          style={{
            width: `${100 + Math.random() * 200}px`,
            top: `${20 + i * 25}%`,
            left: '-200px',
          }}
          animate={{
            x: ['0vw', '120vw'],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 8 + i * 3,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 4,
          }}
        />
      ))}
    </div>
  );
};

// Combined atmospheric background based on theme
export const AtmosphericBackground = ({ theme = 'dawn' }) => {
  const themes = {
    dawn: {
      gradient: 'bg-gradient-to-b from-rose-100 via-sky-100 to-amber-50',
      particles: { color: 'golden', glow: true, count: 15 },
      clouds: true,
      stars: false,
    },
    clear_day: {
      gradient: 'bg-gradient-to-b from-sky-200 via-sky-100 to-white',
      particles: { color: 'white', glow: false, count: 10 },
      clouds: true,
      stars: false,
    },
    sunset_glow: {
      gradient: 'bg-gradient-to-b from-orange-200 via-rose-100 to-purple-100',
      particles: { color: 'golden', glow: true, count: 20 },
      clouds: true,
      stars: false,
    },
    twilight: {
      gradient: 'bg-gradient-to-b from-indigo-300 via-purple-200 to-rose-100',
      particles: { color: 'blue', glow: true, count: 15 },
      clouds: false,
      stars: true,
    },
    starry_night: {
      gradient: 'bg-gradient-to-b from-slate-900 via-indigo-900 to-slate-800',
      particles: { color: 'blue', glow: true, count: 10 },
      clouds: false,
      stars: true,
    },
    moonlit: {
      gradient: 'bg-gradient-to-b from-slate-800 via-indigo-900 to-slate-900',
      particles: { color: 'white', glow: true, count: 12 },
      clouds: false,
      stars: true,
    },
    aurora_borealis: {
      gradient: 'bg-gradient-to-b from-emerald-900 via-teal-800 to-indigo-900',
      particles: { color: 'blue', glow: true, count: 25 },
      clouds: false,
      stars: true,
    },
    golden_hour: {
      gradient: 'bg-gradient-to-b from-amber-200 via-orange-100 to-yellow-50',
      particles: { color: 'golden', glow: true, count: 20 },
      clouds: true,
      stars: false,
    },
    gentle_rain: {
      gradient: 'bg-gradient-to-b from-slate-300 via-slate-200 to-slate-100',
      particles: { color: 'blue', glow: false, count: 30 },
      clouds: true,
      stars: false,
    },
    cherry_blossom_sky: {
      gradient: 'bg-gradient-to-b from-pink-200 via-rose-100 to-pink-50',
      particles: { color: 'white', glow: false, count: 25 },
      clouds: true,
      stars: false,
    },
  };

  const currentTheme = themes[theme] || themes.dawn;

  return (
    <div className={`fixed inset-0 ${currentTheme.gradient} transition-colors duration-1000`}>
      {currentTheme.clouds && <FloatingClouds count={4} />}
      {currentTheme.stars && <TwinklingStars count={40} />}
      <FloatingParticles {...currentTheme.particles} />
      <WindLines count={2} />
    </div>
  );
};

export default AtmosphericBackground;
