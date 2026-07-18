import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { useState } from 'react';

export const AudioControl = ({ minimal = false }) => {
  const { isPlaying, volume, togglePlay, updateVolume } = useAudio();
  const [showVolume, setShowVolume] = useState(false);

  if (minimal) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
        onMouseEnter={() => setShowVolume(true)}
        onMouseLeave={() => setShowVolume(false)}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          className="rounded-full hover:bg-white/20 text-sky-600"
          data-testid="audio-toggle"
        >
          {isPlaying ? (
            <Volume2 className="w-5 h-5" />
          ) : (
            <VolumeX className="w-5 h-5" />
          )}
        </Button>
        
        {showVolume && isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 right-0 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg"
          >
            <Slider
              value={[volume * 100]}
              onValueChange={([val]) => updateVolume(val / 100)}
              max={30}
              step={1}
              className="w-24"
            />
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        className="rounded-full p-2 hover:bg-sky-100"
        data-testid="audio-toggle"
      >
        {isPlaying ? (
          <Volume2 className="w-5 h-5 text-sky-600" />
        ) : (
          <VolumeX className="w-5 h-5 text-sky-400" />
        )}
      </Button>
      
      <Slider
        value={[volume * 100]}
        onValueChange={([val]) => updateVolume(val / 100)}
        max={30}
        step={1}
        className="w-20"
      />
      
      <span className="text-xs text-sky-500 w-8">
        {isPlaying ? 'On' : 'Off'}
      </span>
    </motion.div>
  );
};

export default AudioControl;
