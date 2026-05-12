import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

// Soft ambient audio URLs (royalty-free ambient tracks)
const AMBIENT_TRACKS = {
  default: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
  calm: 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3',
  dreamy: 'https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3',
};

export const AudioProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.15); // Very soft by default
  const [currentTrack, setCurrentTrack] = useState('default');
  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(AMBIENT_TRACKS[currentTrack]);
    audioRef.current.loop = true;
    audioRef.current.volume = 0;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle track changes
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      const wasPlaying = !audioRef.current.paused;
      audioRef.current.src = AMBIENT_TRACKS[currentTrack];
      audioRef.current.load();
      if (wasPlaying) {
        audioRef.current.play().catch(() => {});
        fadeIn();
      }
    }
  }, [currentTrack]);

  const fadeIn = useCallback(() => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    
    let currentVol = 0;
    audioRef.current.volume = 0;
    
    fadeIntervalRef.current = setInterval(() => {
      currentVol += 0.01;
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
    setVolume(newVolume);
    if (audioRef.current && isPlaying) {
      audioRef.current.volume = newVolume;
    }
  }, [isPlaying]);

  const changeTrack = useCallback((track) => {
    if (AMBIENT_TRACKS[track]) {
      setCurrentTrack(track);
    }
  }, []);

  return (
    <AudioContext.Provider value={{
      isPlaying,
      volume,
      currentTrack,
      togglePlay,
      updateVolume,
      changeTrack,
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioProvider;
