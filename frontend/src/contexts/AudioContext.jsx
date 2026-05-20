import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};

// =============================================================================
// Ambient is generated entirely with the Web Audio API as PLUCKED bell/music-box
// tones at high register — sparse, randomized, light and airy. Never a sustained
// organ drone. Each "track" is a pentatonic scale + scheduling parameters.
// =============================================================================

export const AMBIENT_TRACKS = {
  serene: {
    label: 'Serene Sky',
    description: 'Soft music-box drifting through the breeze',
    // C major pentatonic — mid/high register
    notes: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66],
    filterFreq: 2800,
    intervalRange: [1.4, 2.6],     // seconds between events
    arpChance: 0.35,                // probability of a 2-3 note arpeggio
    decay: 2.2,                     // seconds — note tail
    waveform: 'triangle',           // brighter than sine
  },
  sleepy: {
    label: 'Sleepy Clouds',
    description: 'Slow chimes drifting through soft air',
    // A minor pentatonic — slightly warmer
    notes: [440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50],
    filterFreq: 2400,
    intervalRange: [2.2, 4.0],
    arpChance: 0.25,
    decay: 2.8,
    waveform: 'sine',
  },
  dreamy: {
    label: 'Dream Drift',
    description: 'Twinkling glockenspiel, hopeful and bright',
    // F major pentatonic — high, sparkling
    notes: [698.46, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1396.91],
    filterFreq: 3400,
    intervalRange: [1.0, 2.0],
    arpChance: 0.5,
    decay: 1.8,
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
  const [isPlaying, setIsPlaying] = useState(() => readBool(LS_KEYS.isPlaying, false));
  const [volume, setVolume] = useState(() => readNum(LS_KEYS.volume, 0.35));
  const [currentTrack, setCurrentTrack] = useState(() => readStr(LS_KEYS.track, 'serene'));
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => readBool(LS_KEYS.sfx, true));

  // Web Audio refs
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const filterRef = useRef(null);
  const schedulerTimeoutRef = useRef(null);

  // Stable refs for scheduler closure (avoid stale captures)
  const isPlayingRef = useRef(isPlaying);
  const currentTrackRef = useRef(currentTrack);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // ---------- Audio Context ----------
  const ensureContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2800;
    filter.Q.value = 0.7;
    filterRef.current = filter;

    const master = ctx.createGain();
    master.gain.value = 0;
    masterGainRef.current = master;

    filter.connect(master).connect(ctx.destination);
    return ctx;
  }, []);

  const fadeMaster = useCallback((target, durationMs = 800) => {
    const ctx = ctxRef.current;
    if (!ctx || !masterGainRef.current) return;
    const now = ctx.currentTime;
    const g = masterGainRef.current.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0.0001, target), now + durationMs / 1000);
  }, []);

  // ---------- Pluck synthesis (bell / music-box tone) ----------
  const playPluck = useCallback((freq, startOffsetSec, decay, waveform, panAmt = 0) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const start = ctx.currentTime + startOffsetSec;

    // Main tone
    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = freq;

    // Subtle harmonic an octave up for sparkle (bell character)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;

    const g = ctx.createGain();
    const g2 = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.008);   // sharp pluck attack
    g.gain.exponentialRampToValueAtTime(0.0001, start + decay); // bell decay
    g2.gain.setValueAtTime(0.0001, start);
    g2.gain.exponentialRampToValueAtTime(0.06, start + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, start + decay * 0.7);

    // Gentle stereo panning for airiness (skip if StereoPanner unavailable)
    const target = filterRef.current;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panAmt));
      osc.connect(g).connect(panner);
      osc2.connect(g2).connect(panner);
      panner.connect(target);
    } else {
      osc.connect(g).connect(target);
      osc2.connect(g2).connect(target);
    }

    osc.start(start);
    osc2.start(start);
    osc.stop(start + decay + 0.1);
    osc2.stop(start + decay + 0.1);
  }, []);

  // ---------- Scheduler loop ----------
  const scheduleNext = useCallback(() => {
    const track = AMBIENT_TRACKS[currentTrackRef.current] || AMBIENT_TRACKS.serene;
    const [lo, hi] = track.intervalRange;
    const wait = (lo + Math.random() * (hi - lo)) * 1000;

    schedulerTimeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) return;
      // Choose 1-3 notes
      let noteCount = 1;
      if (Math.random() < track.arpChance) {
        noteCount = Math.random() < 0.5 ? 2 : 3;
      }
      // Pick a starting index and walk up the scale for arpeggios (more musical)
      const startIdx = Math.floor(Math.random() * (track.notes.length - noteCount + 1));
      for (let i = 0; i < noteCount; i++) {
        const freq = track.notes[startIdx + i];
        // Octave drop occasionally for variety
        const actualFreq = Math.random() < 0.12 ? freq * 0.5 : freq;
        const pan = (Math.random() - 0.5) * 0.6; // -0.3 to +0.3
        playPluck(actualFreq, i * 0.14, track.decay, track.waveform, pan);
      }
      scheduleNext();
    }, wait);
  }, [playPluck]);

  const stopScheduler = useCallback(() => {
    if (schedulerTimeoutRef.current) {
      clearTimeout(schedulerTimeoutRef.current);
      schedulerTimeoutRef.current = null;
    }
  }, []);

  // ---------- Public API ----------
  const togglePlay = useCallback(async () => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) {}
    }

    if (isPlaying) {
      fadeMaster(0, 600);
      stopScheduler();
      setIsPlaying(false);
    } else {
      // Apply track filter cutoff
      const track = AMBIENT_TRACKS[currentTrack] || AMBIENT_TRACKS.serene;
      filterRef.current.frequency.setTargetAtTime(track.filterFreq, ctx.currentTime, 0.3);
      fadeMaster(volume, 900);
      setIsPlaying(true);
      // Kick off scheduler — first note within ~600ms so user hears it right away
      schedulerTimeoutRef.current = setTimeout(() => {
        if (!isPlayingRef.current) return;
        const t = AMBIENT_TRACKS[currentTrackRef.current] || AMBIENT_TRACKS.serene;
        playPluck(t.notes[2], 0, t.decay, t.waveform, 0);
        scheduleNext();
      }, 400);
    }
  }, [isPlaying, currentTrack, volume, ensureContext, fadeMaster, scheduleNext, stopScheduler, playPluck]);

  const updateVolume = useCallback((newVolume) => {
    const v = Math.max(0, Math.min(1, newVolume));
    setVolume(v);
    if (isPlaying) fadeMaster(v, 200);
  }, [isPlaying, fadeMaster]);

  const changeTrack = useCallback((track) => {
    if (!AMBIENT_TRACKS[track]) return;
    setCurrentTrack(track);
    if (isPlaying && ctxRef.current && filterRef.current) {
      const t = AMBIENT_TRACKS[track];
      filterRef.current.frequency.setTargetAtTime(t.filterFreq, ctxRef.current.currentTime, 0.4);
      // Restart scheduler with new track timing
      stopScheduler();
      schedulerTimeoutRef.current = setTimeout(() => {
        if (!isPlayingRef.current) return;
        playPluck(t.notes[2], 0, t.decay, t.waveform, 0);
        scheduleNext();
      }, 300);
    }
  }, [isPlaying, scheduleNext, stopScheduler, playPluck]);

  const toggleSoundEffects = useCallback(() => {
    setSoundEffectsEnabled((p) => !p);
  }, []);

  const playSoundEffect = useCallback((type = 'correct') => {
    if (!soundEffectsEnabled) return;
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const playNote = (freq, start, dur, peak = 0.18) => {
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
      playNote(523.25, 0, 0.45, 0.20);
      playNote(659.25, 0.08, 0.45, 0.20);
      playNote(783.99, 0.16, 0.55, 0.22);
    } else if (type === 'incorrect') {
      playNote(392.00, 0, 0.4, 0.06);
      playNote(369.99, 0.12, 0.45, 0.06);
    } else if (type === 'reward') {
      playNote(659.25, 0, 0.55, 0.22);
      playNote(880.00, 0.1, 0.55, 0.22);
      playNote(987.77, 0.22, 0.65, 0.24);
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
      stopScheduler();
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch (e) {}
      }
    };
  }, [stopScheduler]);

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
