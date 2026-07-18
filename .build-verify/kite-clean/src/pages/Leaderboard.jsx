import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { useAuth, API, LoadingKite } from "../App";
import { toast } from "sonner";
import { ArrowLeft, Trophy, Medal, Crown, Star } from "lucide-react";
import { KiteCharacter } from "../components/KiteCharacter";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        const [leaderboardRes, rankRes] = await Promise.all([
          axios.get(`${API}/leaderboard`, { withCredentials: true }),
          axios.get(`${API}/leaderboard/my-rank`, { withCredentials: true })
        ]);
        if (alive) {
          setLeaderboard(leaderboardRes.data);
          setMyRank(rankRes.data);
        }
      } catch (error) {
        if (alive) toast.error("Failed to load leaderboard");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchData();
    return () => { alive = false; };
  }, []);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-400" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sky-600 font-bold">{rank}</span>;
    }
  };

  const getRankClass = (rank) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-200";
      case 2:
        return "bg-gradient-to-r from-gray-100 to-gray-50 border-gray-200";
      case 3:
        return "bg-gradient-to-r from-orange-100 to-orange-50 border-orange-200";
      default:
        return "bg-white hover:bg-sky-50";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center">
        <LoadingKite message="Loading leaderboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen sky-gradient" data-testid="leaderboard-page">
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
          <h1 className="text-xl font-bold text-sky-600 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Weekly Leaderboard
          </h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* My Rank Card */}
        {myRank && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-sky-500" />
              </div>
              <div>
                <p className="text-sky-500 text-sm">Your Rank</p>
                <p className="text-2xl font-bold text-sky-900">#{myRank.rank}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sky-500 text-sm">Weekly Score</p>
              <p className="text-2xl font-bold text-sky-900">{myRank.weekly_score}</p>
            </div>
          </motion.div>
        )}

        {/* Leaderboard List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card overflow-hidden"
        >
          <div className="p-4 bg-sky-50 border-b border-sky-100">
            <h2 className="font-semibold text-sky-900">Top Players This Week</h2>
          </div>
          
          <div className="divide-y divide-sky-100">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-sky-600">
                No players yet. Be the first to play!
              </div>
            ) : (
              leaderboard.map((player, index) => {
                const rank = index + 1;
                const isCurrentUser = player.user_id === user?.user_id;
                
                return (
                  <motion.div
                    key={player.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 ${getRankClass(rank)} ${isCurrentUser ? 'ring-2 ring-sky-400 ring-inset' : ''}`}
                    data-testid={`leaderboard-row-${rank}`}
                  >
                    {/* Rank */}
                    <div className="w-10 flex justify-center">
                      {getRankIcon(rank)}
                    </div>
                    
                    {/* Character */}
                    <div className="w-12 h-12 flex items-center justify-center">
                      <KiteCharacter characterId={player.current_character} size="tiny" />
                    </div>
                    
                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${isCurrentUser ? 'text-sky-600' : 'text-sky-900'}`}>
                        {player.name}
                        {isCurrentUser && <span className="text-sky-400 ml-2">(You)</span>}
                      </p>
                      <p className="text-sky-500 text-sm">Level {player.level}</p>
                    </div>
                    
                    {/* Score */}
                    <div className="text-right">
                      <p className="text-xl font-bold text-sky-900">{player.weekly_score}</p>
                      <p className="text-sky-500 text-xs">points</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Info */}
        <p className="text-center text-sky-500 text-sm mt-6">
          Leaderboard resets every Monday. Keep playing to climb the ranks!
        </p>
      </main>
    </div>
  );
}

export { LeaderboardPage };
