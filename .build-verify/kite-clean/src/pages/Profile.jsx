import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useAuth, API, LoadingKite } from "../App";
import { toast } from "sonner";
import { ArrowLeft, Star, Target, Zap, Trophy, Calendar, TrendingUp, Sparkles } from "lucide-react";
import { KiteCharacter } from "../components/KiteCharacter";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${API}/profile`, { withCredentials: true });
        if (alive) setProfile(response.data);
      } catch (error) {
        if (alive) toast.error("Failed to load profile");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchProfile();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center">
        <LoadingKite message="Loading profile..." />
      </div>
    );
  }

  const data = profile || user;

  return (
    <div className="min-h-screen sky-gradient" data-testid="profile-page">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => navigate('/dashboard')}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-sky-600">My Profile</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center mb-6"
        >
          <div className="relative inline-block mb-4">
            {data?.picture ? (
              <img
                src={data.picture}
                alt={data.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-sky-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-sky-100 flex items-center justify-center border-4 border-sky-200">
                <KiteCharacter characterId={data?.current_character || 'basic_kite'} size="medium" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white rounded-full px-3 py-1 text-sm font-bold">
              Lvl {data?.level || 1}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-sky-900">{data?.name}</h2>
          <p className="text-sky-600">{data?.email}</p>
          
          {/* Level Progress */}
          <div className="mt-6 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-sky-700 flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                Level {data?.level || 1}
              </span>
              <span className="text-sky-500">
                {data?.xp || 0} / {profile?.xp_for_next_level || 100} XP
              </span>
            </div>
            <Progress value={profile?.xp_progress || 0} className="h-3" />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <StatCard
            icon={<Target className="w-6 h-6 text-green-500" />}
            label="Questions Played"
            value={data?.total_questions || 0}
          />
          <StatCard
            icon={<Zap className="w-6 h-6 text-yellow-500" />}
            label="Correct Answers"
            value={data?.total_correct || 0}
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-blue-500" />}
            label="Accuracy"
            value={`${profile?.accuracy || 0}%`}
          />
          <StatCard
            icon={<Trophy className="w-6 h-6 text-orange-500" />}
            label="Weekly Score"
            value={data?.weekly_score || 0}
          />
        </motion.div>

        {/* Characters Owned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h3 className="font-semibold text-sky-900 mb-4 flex items-center gap-2">
            <span className="text-xl">🪁</span>
            Characters Owned ({data?.owned_characters?.length || 1})
          </h3>
          <div className="flex flex-wrap gap-3">
            {data?.owned_characters?.map((charId) => (
              <div
                key={charId}
                className={`p-3 rounded-2xl ${charId === data?.current_character ? 'bg-sky-100 ring-2 ring-sky-400' : 'bg-sky-50'}`}
              >
                <KiteCharacter characterId={charId} size="tiny" />
                {charId === data?.current_character && (
                  <p className="text-xs text-sky-600 text-center mt-1">Active</p>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-4 rounded-full border-sky-200"
            onClick={() => navigate('/shop')}
          >
            Get More Characters
          </Button>
        </motion.div>

        {/* Sky Wanderer Milestones */}
        {data?.unlocked_milestones && data.unlocked_milestones.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card p-6 mb-6"
            data-testid="profile-milestones"
          >
            <h3 className="font-semibold text-sky-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Sky Wanderer ({data.unlocked_milestones.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.unlocked_milestones.map((m) => {
                const parts = m.split("_");
                const lvl = parts[parts.length - 1];
                const rarity = parts.length === 3 ? parts[1] : parts[2];
                const cat = parts.length === 3 ? parts[0] : `${parts[0]}_${parts[1]}`;
                const labels = { kite: "Kites", companion: "Companions", sky_theme: "Skies" };
                const tints = {
                  common: "bg-sky-50 text-sky-700 ring-sky-200",
                  rare: "bg-blue-50 text-blue-700 ring-blue-200",
                  epic: "bg-violet-50 text-violet-700 ring-violet-200",
                  legendary: "bg-amber-50 text-amber-700 ring-amber-200",
                };
                return (
                  <span
                    key={m}
                    className={`text-xs px-3 py-1.5 rounded-full ring-1 capitalize ${tints[rarity] || tints.common}`}
                  >
                    {rarity} {labels[cat] || cat} · L{lvl}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Join Date */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-sky-500 text-sm flex items-center justify-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Playing since {new Date(data?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </motion.div>
      </main>
    </div>
  );
}

const StatCard = ({ icon, label, value }) => (
  <div className="glass-card p-4 text-center">
    <div className="flex justify-center mb-2">{icon}</div>
    <p className="text-2xl font-bold text-sky-900">{value}</p>
    <p className="text-sky-600 text-sm">{label}</p>
  </div>
);

export { ProfilePage };
