import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

// Soft ambient audio tracks (royalty-free, dreamy)
export const AMBIENT_TRACKS = {
  default: { url: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3', label: 'Serene Sky' },
  calm: { url: 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3', label: 'Sleepy Clouds' },
  dreamy: { url: 'https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3', label: 'Dream Drift' },
};

// localStorage keys
const LS_KEYS = {
  isPlaying: 'kite_audio_isPlaying',
  volume: 'kite_audio_volume',
  track: 'kite_audio_track',
  sfx: 'kite_audio_sfx',
};

const readBool = (key, def) => {
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
};
const readNum = (key, def) => {
  const v = localStorage.getItem(key);
  return v === null ? def : Math.max(0, Math.min(1, parseFloat(v)));
};
const readStr = (key, def) => {
  const v = localStorage.getItem(key);
  return v && AMBIENT_TRACKS[v] ? v : def;
};

export const AudioProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false); // start paused; browsers require user gesture
  const [volume, setVolume] = useState(() => readNum(LS_KEYS.volume, 0.15));
  const [currentTrack, setCurrentTrack] = useState(() => readStr(LS_KEYS.track, 'default'));
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => readBool(LS_KEYS.sfx, true));
  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const wantsAutoplayRef = useRef(readBool(LS_KEYS.isPlaying, false));

  // Initialize audio element once
  useEffect(() => {
    audioRef.current = new Audio(AMBIENT_TRACKS[currentTrack].url);
    audioRef.current.loop = true;
    audioRef.current.volume = 0;

    // Try gentle autoplay if user previously had it on. Browsers may block; that's fine.
    if (wantsAutoplayRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        fadeIn();
      }).catch(() => {
        // Autoplay blocked — wait for first user gesture
        const resume = () => {
          if (!audioRef.current) return;
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            fadeIn();
          }).catch(() => {});
          window.removeEventListener('click', resume);
          window.removeEventListener('keydown', resume);
        };
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist preferences
  useEffect(() => { localStorage.setItem(LS_KEYS.isPlaying, String(isPlaying)); }, [isPlaying]);
  useEffect(() => { localStorage.setItem(LS_KEYS.volume, String(volume)); }, [volume]);
  useEffect(() => { localStorage.setItem(LS_KEYS.track, currentTrack); }, [currentTrack]);
  useEffect(() => { localStorage.setItem(LS_KEYS.sfx, String(soundEffectsEnabled)); }, [soundEffectsEnabled]);

  // Handle track changes (gentle fade between tracks)
  useEffect(() => {
    if (!audioRef.current) return;
    const wasPlaying = !audioRef.current.paused;
    audioRef.current.src = AMBIENT_TRACKS[currentTrack].url;
    audioRef.current.load();
    if (wasPlaying || isPlaying) {
      audioRef.current.play().then(() => fadeIn()).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  const fadeIn = useCallback(() => {
    if (!audioRef.current) return;
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    let currentVol = 0;
    audioRef.current.volume = 0;
    fadeIntervalRef.current = setInterval(() => {
      currentVol += 0.01;
      if (!audioRef.current) return;
      if (currentVol >= volume) {
        audioRef.current.volume = volume;
        clearInterval(fadeIntervalRef.current);
      } else {
        audioRef.current.volume = currentVol;
      }
    }, 50);
  }, [volume]);

  const fadeOut = useCallback(() => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    let currentVol = audioRef.current?.volume || 0;
    fadeIntervalRef.current = setInterval(() => {
      currentVol -= 0.01;
      if (currentVol <= 0) {
        if (audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.pause();
        }
        clearInterval(fadeIntervalRef.current);
      } else if (audioRef.current) {
        audioRef.current.volume = currentVol;
      }
    }, 30);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      fadeOut();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        fadeIn();
      }).catch((err) => {
        console.log('Audio play failed:', err);
      });
    }
  }, [isPlaying, fadeIn, fadeOut]);

  const updateVolume = useCallback((newVolume) => {
    const v = Math.max(0, Math.min(1, newVolume));
    setVolume(v);
    if (audioRef.current && isPlaying) {
      audioRef.current.volume = v;
    }
  }, [isPlaying]);

  const changeTrack = useCallback((track) => {
    if (AMBIENT_TRACKS[track]) {
      setCurrentTrack(track);
    }
  }, []);

  // Gentle sound effect player using WebAudio (no external deps, no asset loads)
  const playSoundEffect = useCallback((type = 'correct') => {
    if (!soundEffectsEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;

      const playNote = (freq, start, dur, peak = 0.06) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      };

      if (type === 'correct') {
        // Gentle major triad arpeggio (C5, E5, G5)
        playNote(523.25, 0, 0.35);
        playNote(659.25, 0.08, 0.35);
        playNote(783.99, 0.16, 0.45);
      } else if (type === 'incorrect') {
        // Soft descending minor second (G4 -> F#4) — calm, not alarming
        playNote(392.00, 0, 0.4, 0.04);
        playNote(369.99, 0.12, 0.45, 0.04);
      } else if (type === 'reward') {
        // Magical chime (E5, A5, B5)
        playNote(659.25, 0, 0.5);
        playNote(880.00, 0.1, 0.5);
        playNote(987.77, 0.22, 0.6);
      } else if (type === 'click') {
        playNote(880, 0, 0.08, 0.03);
      }

      // Close context after sound completes
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1500);
    } catch (e) {
      // silently ignore
    }
  }, [soundEffectsEnabled]);

  const toggleSoundEffects = useCallback(() => {
    setSoundEffectsEnabled((prev) => !prev);
  }, []);

  return (
    <AudioContext.Provider value={{
      isPlaying,
      volume,
      currentTrack,
      tracks: AMBIENT_TRACKS,
      soundEffectsEnabled,
      togglePlay,
      updateVolume,
      changeTrack,
      toggleSoundEffects,
      playSoundEffect,
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioProvider;
