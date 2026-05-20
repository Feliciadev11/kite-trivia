import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, Music, Sparkles, Cloud, Moon, Wind } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { useAudio } from "../contexts/AudioContext";
import { AtmosphericBackground } from "../components/Atmosphere";
import { useAuth } from "../App";

const TRACK_META = {
  serene: { label: "Serene Sky", description: "Soft music-box drifting through the breeze", icon: Cloud },
  sleepy: { label: "Sleepy Clouds", description: "Slow chimes drifting through soft air", icon: Moon },
  dreamy: { label: "Dream Drift", description: "Twinkling glockenspiel, hopeful and bright", icon: Wind },
};

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    isPlaying,
    volume,
    currentTrack,
    soundEffectsEnabled,
    togglePlay,
    updateVolume,
    changeTrack,
    toggleSoundEffects,
    playSoundEffect,
  } = useAudio();

  return (
    <div className="min-h-screen relative" data-testid="settings-page">
      <AtmosphericBackground theme={user?.current_sky_theme || "dawn"} />

      <header className="bg-white/60 backdrop-blur-md border-b border-white/40 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full hover:bg-sky-50 text-sky-600"
            onClick={() => navigate(-1)}
            data-testid="settings-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-sky-700 tracking-wide">Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 relative z-10 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8"
        >
          <p className="text-sky-600/80 text-sm uppercase tracking-[0.2em] mb-2">Atmosphere</p>
          <h2 className="text-3xl font-light text-slate-700">Tune your sky</h2>
          <p className="text-slate-500 mt-2">
            Gentle controls for ambient music and soft sound feedback. Everything you change here stays with you.
          </p>
        </motion.div>

        {/* Ambient Music Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <Card className="p-6 mb-6 bg-white/70 backdrop-blur-md border-white/60 rounded-3xl shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center">
                  <Music className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <Label className="text-base font-medium text-slate-700">Ambient Music</Label>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {isPlaying ? "Currently floating gently" : "Resting in silence"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPlaying}
                onCheckedChange={togglePlay}
                data-testid="settings-music-toggle"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-slate-600 flex items-center gap-2">
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  Volume
                </Label>
                <span className="text-xs text-sky-500 tabular-nums" data-testid="settings-volume-value">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <Slider
                value={[volume * 100]}
                onValueChange={([val]) => updateVolume(val / 100)}
                max={100}
                step={1}
                className="w-full"
                data-testid="settings-volume-slider"
              />
              <p className="text-xs text-slate-400">Designed to drift softly in the background.</p>
            </div>
          </Card>
        </motion.div>

        {/* Track Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <Card className="p-6 mb-6 bg-white/70 backdrop-blur-md border-white/60 rounded-3xl shadow-sm">
            <div className="flex gap-3 items-start mb-5">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <Label className="text-base font-medium text-slate-700">Ambient Track</Label>
                <p className="text-sm text-slate-500 mt-0.5">Pick a mood for your sky</p>
              </div>
            </div>

            <div className="grid gap-3">
              {Object.entries(TRACK_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = currentTrack === key;
                return (
                  <button
                    key={key}
                    onClick={() => changeTrack(key)}
                    data-testid={`settings-track-${key === 'serene' ? 'default' : key}`}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-500 flex items-center gap-3 ${
                      active
                        ? "border-sky-300 bg-gradient-to-br from-sky-50 to-violet-50 shadow-[0_0_24px_rgba(125,200,247,0.25)]"
                        : "border-white/80 bg-white/40 hover:border-sky-200 hover:bg-white/60"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        active ? "bg-sky-200/70 text-sky-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${active ? "text-sky-700" : "text-slate-700"}`}>{meta.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                    </div>
                    {active && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs text-sky-600 font-medium tracking-wide"
                      >
                        Playing
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Sound Effects Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <Card className="p-6 mb-6 bg-white/70 backdrop-blur-md border-white/60 rounded-3xl shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <Label className="text-base font-medium text-slate-700">Sound Effects</Label>
                  <p className="text-sm text-slate-500 mt-0.5">Soft chimes when you answer or earn rewards</p>
                </div>
              </div>
              <Switch
                checked={soundEffectsEnabled}
                onCheckedChange={toggleSoundEffects}
                data-testid="settings-sfx-toggle"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => playSoundEffect("correct")}
                disabled={!soundEffectsEnabled}
                data-testid="settings-preview-correct"
                className="rounded-full text-xs border-sky-200 hover:bg-sky-50"
              >
                Preview ‘correct’
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => playSoundEffect("reward")}
                disabled={!soundEffectsEnabled}
                data-testid="settings-preview-reward"
                className="rounded-full text-xs border-violet-200 hover:bg-violet-50"
              >
                Preview ‘reward’
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="text-center text-xs text-slate-400 mt-10"
        >
          Your preferences are saved on this device.
        </motion.p>
      </main>
    </div>
  );
};

export default SettingsPage;
