import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};

// =============================================================================
// Ambient tracks are generated entirely with the Web Audio API — no external
// audio files, no hotlink-protected CDNs, no autoplay-policy edge cases.
// Each "track" is a slow drone of sustained chord notes with gentle detuning
// and a soft low-pass filter to evoke a dreamy sky atmosphere.
// =============================================================================

export const AMBIENT_TRACKS = {
  serene: {
    label: 'Serene Sky',
    description: 'Gentle pads drifting through clear blue',
    // C major 9 (C, E, G, B, D) — open, floating
    notes: [130.81, 164.81, 196.00, 246.94, 293.66],
    filterFreq: 800,
    waveform: 'sine',
  },
  sleepy: {
    label: 'Sleepy Clouds',
    description: 'Soft chimes blooming slowly',
    // A minor 7 (A, C, E, G) — warm, calm
    notes: [110.00, 130.81, 164.81, 196.00],
    filterFreq: 700,
    waveform: 'triangle',
  },
  dreamy: {
    label: 'Dream Drift',
    description: 'Floating, hopeful, weightless',
    // F major 7 with high D (F, A, C, E, D) — bright, hopeful
    notes: [87.31, 110.00, 130.81, 164.81, 293.66],
    filterFreq: 900,
    waveform: 'sine',
  },
};

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => readNum(LS_KEYS.volume, 0.18));
  const [currentTrack, setCurrentTrack] = useState(() => readStr(LS_KEYS.track, 'serene'));
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => readBool(LS_KEYS.sfx, true));
  const [audioReady, setAudioReady] = useState(false);

  // Web Audio refs
  const ctxRef = useRef(null);            // AudioContext
  const masterGainRef = useRef(null);     // Master volume gain
  const lfoRef = useRef(null);            // Slow modulation
  const filterRef = useRef(null);         // Low-pass for softness
  const voicesRef = useRef([]);           // Active oscillators
  const fadeIntervalRef = useRef(null);

  // ---------- Helpers ----------
  const ensureContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    // Master chain: voices → filter → masterGain → destination
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.6;
    filterRef.current = filter;

    const master = ctx.createGain();
    master.gain.value = 0; // start silent, fade in
    masterGainRef.current = master;

    filter.connect(master).connect(ctx.destination);
    return ctx;
  }, []);

  const stopVoices = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    voicesRef.current.forEach((v) => {
      try {
        v.osc.stop(ctx.currentTime + 0.05);
        v.osc.disconnect();
        v.gain.disconnect();
      } catch (e) {}
    });
    voicesRef.current = [];
    if (lfoRef.current) {
      try { lfoRef.current.stop(); lfoRef.current.disconnect(); } catch (e) {}
      lfoRef.current = null;
    }
  }, []);

  const startVoices = useCallback((trackKey) => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    stopVoices();
    const track = AMBIENT_TRACKS[trackKey] || AMBIENT_TRACKS.serene;
    filterRef.current.frequency.setTargetAtTime(track.filterFreq, ctx.currentTime, 0.5);

    // Slow LFO that adds barely-perceptible breathing motion to each voice's gain
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08; // ~12s breathing cycle
    lfoRef.current = lfo;

    track.notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = track.waveform;
      osc.frequency.value = freq;
      // Slight detune per voice for richness
      osc.detune.value = (i % 2 === 0 ? -3 : 3) * (i + 1);

      const g = ctx.createGain();
      // Per-voice base gain — quieter for higher notes
      const baseGain = 0.05 + (0.05 / (i + 1));
      g.gain.value = baseGain;

      // LFO -> per-voice gain modulation (very subtle)
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = baseGain * 0.35;
      lfo.connect(lfoGain).connect(g.gain);

      osc.connect(g).connect(filterRef.current);
      osc.start();
      voicesRef.current.push({ osc, gain: g });
    });

    lfo.start();
  }, [ensureContext, stopVoices]);

  const fadeMaster = useCallback((target, durationMs = 1200) => {
    const ctx = ctxRef.current;
    if (!ctx || !masterGainRef.current) return;
    const now = ctx.currentTime;
    const g = masterGainRef.current.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0.0001, target), now + durationMs / 1000);
  }, []);

  // ---------- Public API ----------
  const togglePlay = useCallback(async () => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) {}
    }

    if (isPlaying) {
      fadeMaster(0, 800);
      // Stop voices after fade
      if (fadeIntervalRef.current) clearTimeout(fadeIntervalRef.current);
      fadeIntervalRef.current = setTimeout(() => stopVoices(), 900);
      setIsPlaying(false);
    } else {
      startVoices(currentTrack);
      fadeMaster(volume, 1500);
      setIsPlaying(true);
    }
    setAudioReady(true);
  }, [isPlaying, currentTrack, volume, ensureContext, fadeMaster, startVoices, stopVoices]);

  const updateVolume = useCallback((newVolume) => {
    const v = Math.max(0, Math.min(1, newVolume));
    setVolume(v);
    if (isPlaying) fadeMaster(v, 300);
  }, [isPlaying, fadeMaster]);

  const changeTrack = useCallback((track) => {
    if (!AMBIENT_TRACKS[track]) return;
    setCurrentTrack(track);
    if (isPlaying) {
      // Crossfade: drop master to zero, swap voices, fade back
      fadeMaster(0.0001, 400);
      setTimeout(() => {
        startVoices(track);
        fadeMaster(volume, 1000);
      }, 450);
    }
  }, [isPlaying, volume, fadeMaster, startVoices]);

  const toggleSoundEffects = useCallback(() => {
    setSoundEffectsEnabled((p) => !p);
  }, []);

  const playSoundEffect = useCallback((type = 'correct') => {
    if (!soundEffectsEnabled) return;
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const playNote = (freq, start, dur, peak = 0.16) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(peak, now + start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };

    if (type === 'correct') {
      playNote(523.25, 0, 0.45, 0.18);
      playNote(659.25, 0.08, 0.45, 0.18);
      playNote(783.99, 0.16, 0.55, 0.20);
    } else if (type === 'incorrect') {
      playNote(392.00, 0, 0.4, 0.06);
      playNote(369.99, 0.12, 0.45, 0.06);
    } else if (type === 'reward') {
      playNote(659.25, 0, 0.55, 0.20);
      playNote(880.00, 0.1, 0.55, 0.20);
      playNote(987.77, 0.22, 0.65, 0.22);
    } else if (type === 'click') {
      playNote(880, 0, 0.08, 0.05);
    }
  }, [soundEffectsEnabled, ensureContext]);

  // ---------- Persistence ----------
  useEffect(() => { localStorage.setItem(LS_KEYS.isPlaying, String(isPlaying)); }, [isPlaying]);
  useEffect(() => { localStorage.setItem(LS_KEYS.volume, String(volume)); }, [volume]);
  useEffect(() => { localStorage.setItem(LS_KEYS.track, currentTrack); }, [currentTrack]);
  useEffect(() => { localStorage.setItem(LS_KEYS.sfx, String(soundEffectsEnabled)); }, [soundEffectsEnabled]);

  // ---------- Cleanup ----------
  useEffect(() => {
    return () => {
      stopVoices();
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch (e) {}
      }
    };
  }, [stopVoices]);

  return (
    <AudioContext.Provider value={{
      isPlaying,
      volume,
      currentTrack,
      tracks: AMBIENT_TRACKS,
      soundEffectsEnabled,
      audioReady,
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
