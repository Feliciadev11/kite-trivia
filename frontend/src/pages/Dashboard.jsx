import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useAuth, API } from "../App";
import { Play, Trophy, ShoppingBag, User, LogOut, Zap, Target, Star, Gift, Flame, Settings } from "lucide-react";
import { KiteCharacter, CompanionCharacter } from "../components/KiteCharacter";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AtmosphericBackground } from "../components/Atmosphere";
import { AudioControl } from "../components/AudioControl";
import { NextUnlockTease } from "../components/NextUnlockTease";
import { SeasonalSkyBanner } from "../components/SeasonalSkyBanner";
import { logError } from "../lib/logger";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [dailyReward, setDailyReward] = useState(null);
  const [claimingReward, setClaimingReward] = useState(false);

  const xpForNextLevel = user?.level * 100 || 100;
  const xpProgress = ((user?.xp || 0) / xpForNextLevel) * 100;

  useEffect(() => {
    let alive = true;
    const fetchDailyReward = async () => {
      try {
        const response = await axios.get(`${API}/daily-reward`, { withCredentials: true });
        if (alive) setDailyReward(response.data);
      } catch (error) {
        logError("Failed to fetch daily reward status", error);
      }
    };
    fetchDailyReward();
    return () => { alive = false; };
  }, []);

  const handleClaimReward = async () => {
    setClaimingReward(true);
    try {
      const response = await axios.post(`${API}/daily-reward/claim`, {}, { withCredentials: true });
      toast.success(`+${response.data.xp_earned} XP earned!`, {
        description: response.data.milestone_reward || `${response.data.new_streak} day streak!`
      });
      if (response.data.level_up) {
        toast.success(`Level Up! You're now level ${response.data.new_level}!`);
      }
      setDailyReward(prev => ({ ...prev, can_claim: false, current_streak: response.data.new_streak }));
      refreshUser();
    } catch (error) {
      toast.error("Failed to claim reward");
    } finally {
      setClaimingReward(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen relative" data-testid="dashboard-page">
      <AtmosphericBackground theme={user?.current_sky_theme || 'dawn'} />
      
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/50 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-sky-600">Kite</h1>
          <nav className="flex items-center gap-2">
            <AudioControl minimal />
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-sky-50 text-sky-600"
              onClick={() => navigate('/leaderboard')}
              data-testid="nav-leaderboard"
            >
              <Trophy className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-sky-50 text-sky-600"
              onClick={() => navigate('/shop')}
              data-testid="nav-shop"
            >
              <ShoppingBag className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-sky-50 text-sky-600"
              onClick={() => navigate('/profile')}
              data-testid="nav-profile"
            >
              <User className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-sky-50 text-sky-600"
              onClick={() => navigate('/settings')}
              data-testid="nav-settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-red-50 text-red-500"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-sky-900 mb-2">
            Hey, {user?.name?.split(' ')[0] || 'Player'}!
          </h2>
          <p className="text-sky-600">Ready to soar higher today?</p>
        </motion.div>

        {/* Daily Reward Banner */}
        {dailyReward?.can_claim && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="max-w-2xl mx-auto mb-6"
          >
            <div className="glass-card p-4 bg-gradient-to-r from-amber-50/90 to-orange-50/90 border-amber-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Gift className="w-10 h-10 text-amber-500" />
                </motion.div>
                <div>
                  <p className="font-semibold text-amber-900">Daily Reward Ready!</p>
                  <p className="text-amber-700 text-sm">+{dailyReward.xp_reward} XP waiting for you</p>
                </div>
              </div>
              <Button
                onClick={handleClaimReward}
                disabled={claimingReward}
                className="rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
                data-testid="claim-reward-btn"
              >
                {claimingReward ? "Claiming..." : "Claim"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Streak Display */}
        {(dailyReward?.current_streak > 0 || user?.login_streak > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center mb-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100/80 backdrop-blur-sm rounded-full">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-orange-700 font-medium">
                {dailyReward?.current_streak || user?.login_streak || 0} day streak
              </span>
            </div>
          </motion.div>
        )}

        {/* Next Unlock Tease */}
        <div className="max-w-2xl mx-auto mb-4" data-testid="next-unlock-container">
          <NextUnlockTease />
        </div>

        {/* Seasonal Sky Banner */}
        <div className="max-w-2xl mx-auto mb-8" data-testid="seasonal-banner-container">
          <SeasonalSkyBanner />
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Character Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-8 flex flex-col items-center"
          >
            <div className="flex items-end gap-4">
              <KiteCharacter characterId={user?.current_character || 'basic_kite'} size="large" />
              {user?.current_companion && (
                <CompanionCharacter companionId={user.current_companion} size="medium" />
              )}
            </div>
            <p className="mt-4 text-sky-700 font-medium capitalize">
              {user?.current_character?.replace('_', ' ') || 'Basic Kite'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-full border-sky-200"
              onClick={() => navigate('/shop')}
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              View Characters
            </Button>
          </motion.div>

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-8"
          >
            {/* Level Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sky-700 font-medium flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Level {user?.level || 1}
                </span>
                <span className="text-sky-500 text-sm">
                  {user?.xp || 0} / {xpForNextLevel} XP
                </span>
              </div>
              <Progress value={xpProgress} className="h-3" data-testid="xp-progress" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 rounded-2xl p-4 text-center">
                <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-sky-900">{user?.total_correct || 0}</p>
                <p className="text-sky-600 text-sm">Correct</p>
              </div>
              <div className="bg-sky-50 rounded-2xl p-4 text-center">
                <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-sky-900">{user?.total_questions || 0}</p>
                <p className="text-sky-600 text-sm">Played</p>
              </div>
              <div className="bg-sky-50 rounded-2xl p-4 text-center col-span-2">
                <Trophy className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-sky-900">{user?.weekly_score || 0}</p>
                <p className="text-sky-600 text-sm">Weekly Score</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Play Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-10"
        >
          <Button
            size="lg"
            className="rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-1 text-xl px-12 py-8 animate-pulse-glow"
            onClick={() => navigate('/play')}
            data-testid="play-btn"
          >
            <Play className="w-7 h-7 mr-3" />
            Play Now
          </Button>
          <p className="text-sky-500 mt-3 text-sm">
            Questions based on your level ({user?.level || 1})
          </p>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-4 mt-8"
        >
          <Button
            variant="outline"
            className="rounded-full border-2 border-sky-200 hover:bg-sky-50"
            onClick={() => navigate('/leaderboard')}
          >
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            Leaderboard
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-2 border-sky-200 hover:bg-sky-50"
            onClick={() => navigate('/profile')}
          >
            <User className="w-5 h-5 mr-2 text-sky-500" />
            Profile
          </Button>
        </motion.div>
      </main>
    </div>
  );
}

export { DashboardPage };
