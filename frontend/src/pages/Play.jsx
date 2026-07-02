import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useAuth, API, LoadingKite } from "../App";
import { useAudio } from "../contexts/AudioContext";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Sparkles, Home } from "lucide-react";
import { SkyWandererCelebration } from "../components/SkyWandererCelebration";
import { logError } from "../lib/logger";
import { usePremium } from "../contexts/PremiumContext";

export default function PlayPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { playSoundEffect } = useAudio();
  const { presentNativePaywall, refreshServerStatus } = usePremium();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [milestones, setMilestones] = useState(null);
  const [freeGate, setFreeGate] = useState(null); // { rounds_played_today, free_rounds_per_day }

  const fetchQuestions = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/questions`, {
        params: { limit: 10 },
        withCredentials: true
      });
      setQuestions(response.data);
      setFreeGate(null);
    } catch (error) {
      // Free-tier daily cap: server returns 402 with a structured `detail`.
      if (error?.response?.status === 402) {
        const detail = error.response.data?.detail || {};
        setFreeGate({
          rounds_played_today: detail.rounds_played_today,
          free_rounds_per_day: detail.free_rounds_per_day,
          message: detail.message,
        });
        refreshServerStatus?.();
      } else {
        toast.error("Failed to load questions");
        logError("fetchQuestions failed", error);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshServerStatus]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const currentQuestion = questions[currentIndex];

  const handleAnswer = async (answerIndex) => {
    if (selectedAnswer !== null || submitting) return;
    
    setSelectedAnswer(answerIndex);
    setSubmitting(true);

    try {
      const response = await axios.post(`${API}/questions/answer`, {
        question_id: currentQuestion.question_id,
        selected_answer: answerIndex
      }, { withCredentials: true });

      setResult(response.data);
      setScore(prev => ({
        correct: prev.correct + (response.data.correct ? 1 : 0),
        total: prev.total + 1
      }));

      // Gentle audio feedback
      playSoundEffect(response.data.correct ? 'correct' : 'incorrect');

      if (response.data.level_up) {
        playSoundEffect('reward');
        toast.success(`Level Up! You're now level ${response.data.new_level}!`, {
          icon: <Sparkles className="text-yellow-500" />
        });
      }

      // Sky Wanderer milestone celebration (if user crossed any progressive gates)
      if (response.data.new_milestones && response.data.new_milestones.length > 0) {
        setMilestones(response.data.new_milestones);
      }
    } catch (error) {
      toast.error("Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setResult(null);
    } else {
      setGameOver(true);
      refreshUser();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center">
        <LoadingKite message="Loading questions..." />
      </div>
    );
  }

  if (freeGate) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center p-4" data-testid="free-tier-gate">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-card max-w-md w-full text-center p-8"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-pink-100 flex items-center justify-center mb-5">
            <Sparkles className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-semibold text-sky-900 mb-2">
            You've flown far today
          </h2>
          <p className="text-sky-600 mb-1">
            {freeGate.message || `You've played ${freeGate.rounds_played_today}/${freeGate.free_rounds_per_day} rounds today.`}
          </p>
          <p className="text-sky-500 text-sm mb-6">
            Rest your wings until tomorrow — or unlock Kite Pro for unlimited flights.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={presentNativePaywall}
              className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600"
              data-testid="free-gate-upgrade-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Unlock Kite Pro
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="rounded-full text-sky-600"
              data-testid="free-gate-back-btn"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameOver) {
    const percentage = Math.round((score.correct / score.total) * 100);
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center p-4" data-testid="game-over">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 max-w-md w-full text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mb-6"
          >
            {percentage >= 70 ? (
              <Sparkles className="w-16 h-16 text-yellow-500 mx-auto" />
            ) : (
              <CheckCircle className="w-16 h-16 text-sky-500 mx-auto" />
            )}
          </motion.div>
          
          <h2 className="text-3xl font-bold text-sky-900 mb-2">
            {percentage >= 70 ? "Great Job!" : "Good Try!"}
          </h2>
          
          <p className="text-sky-600 mb-6">You completed the round!</p>
          
          <div className="bg-sky-50 rounded-2xl p-6 mb-6">
            <p className="text-5xl font-bold text-sky-900 mb-2">
              {score.correct}/{score.total}
            </p>
            <p className="text-sky-600">Questions Correct</p>
            <p className="text-2xl font-semibold text-sky-700 mt-2">{percentage}%</p>
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 rounded-full border-sky-200"
              onClick={() => navigate('/dashboard')}
              data-testid="go-home-btn"
            >
              <Home className="w-5 h-5 mr-2" />
              Home
            </Button>
            <Button
              className="flex-1 rounded-full bg-sky-500 hover:bg-sky-600"
              onClick={() => {
                setGameOver(false);
                setCurrentIndex(0);
                setScore({ correct: 0, total: 0 });
                setSelectedAnswer(null);
                setResult(null);
                setLoading(true);
                fetchQuestions();
              }}
              data-testid="play-again-btn"
            >
              Play Again
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sky-gradient" data-testid="play-page">
      {milestones && (
        <SkyWandererCelebration
          milestones={milestones}
          onDismiss={() => setMilestones(null)}
        />
      )}
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
          <div className="text-center">
            <p className="text-sky-600 font-medium">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="text-sky-700 font-semibold">
            {score.correct}/{score.total}
          </div>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-1" />
      </header>

      {/* Question Card */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-8"
          >
            {/* Category Badge */}
            <div className="flex items-center justify-between mb-6">
              <span className="inline-block px-4 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium capitalize">
                {currentQuestion?.category?.replace('_', ' ')}
              </span>
              <span className="text-sky-500 text-sm">
                +{currentQuestion?.xp_reward || 10} XP
              </span>
            </div>

            {/* Question */}
            <h2 className="text-xl md:text-2xl font-semibold text-sky-900 mb-8" data-testid="question-text">
              {currentQuestion?.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion?.options.map((option, index) => {
                let optionClass = "border-sky-100 bg-white hover:border-sky-300 hover:bg-sky-50";
                
                if (selectedAnswer !== null) {
                  if (index === result?.correct_answer) {
                    optionClass = "border-emerald-300 bg-emerald-50/80 text-emerald-700 shadow-[0_0_24px_rgba(110,231,183,0.45)]";
                  } else if (index === selectedAnswer && !result?.correct) {
                    optionClass = "border-amber-300 bg-amber-50/80 text-amber-700";
                  } else {
                    optionClass = "border-slate-200 bg-white/40 text-slate-400 opacity-70";
                  }
                }

                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.5, ease: "easeOut" }}
                    whileHover={selectedAnswer === null ? { scale: 1.015, y: -2 } : {}}
                    whileTap={selectedAnswer === null ? { scale: 0.985 } : {}}
                    onClick={() => handleAnswer(index)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-4 text-left rounded-2xl border-2 transition-all duration-500 flex items-center gap-3 ${optionClass}`}
                    data-testid={`option-${index}`}
                  >
                    <motion.span 
                      className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-medium text-sm shrink-0"
                      animate={selectedAnswer === index && result?.correct ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                      {String.fromCharCode(65 + index)}
                    </motion.span>
                    <span className="flex-1">{option}</span>
                    {selectedAnswer !== null && index === result?.correct_answer && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      >
                        <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
                      </motion.div>
                    )}
                    {selectedAnswer !== null && index === selectedAnswer && !result?.correct && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      >
                        <XCircle className="w-6 h-6 text-amber-500 shrink-0" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Result & Next Button */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <div className={`p-4 rounded-2xl mb-4 ${result.correct ? 'bg-emerald-50/80 text-emerald-700 border border-emerald-100' : 'bg-amber-50/80 text-amber-700 border border-amber-100'}`}>
                  <p className="font-medium flex items-center gap-2">
                    {result.correct ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Lovely! +{result.xp_earned} XP
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        Almost — the answer was {String.fromCharCode(65 + result.correct_answer)}
                      </>
                    )}
                  </p>
                </div>
                
                <Button
                  onClick={nextQuestion}
                  className="w-full rounded-full bg-sky-500 hover:bg-sky-600 py-6"
                  data-testid="next-btn"
                >
                  {currentIndex < questions.length - 1 ? (
                    <>
                      Next Question
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  ) : (
                    <>
                      See Results
                      <Sparkles className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export { PlayPage };
