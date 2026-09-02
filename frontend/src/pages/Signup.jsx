import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../App";
import { toast } from "sonner";
import { extractErrorMessage } from "../lib/errors";
import { Mail, Lock, User, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register(email, password, name);
      toast.success("Account created! Let's play!");
      navigate('/dashboard');
    } catch (error) {
      toast.error(extractErrorMessage(error, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen sky-gradient flex" data-testid="signup-page">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <Link to="/" className="inline-block mb-4">
                <h1 className="text-3xl font-bold text-sky-600">Kite</h1>
              </Link>
              <h2 className="text-xl font-semibold text-sky-900">Join the Fun!</h2>
              <p className="text-sky-600 mt-1">Create your account and start playing</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-sky-700">Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                    required
                    data-testid="name-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-sky-700">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                    required
                    data-testid="email-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-sky-700">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                    required
                    minLength={6}
                    data-testid="password-input"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-1 py-6"
                data-testid="signup-submit-btn"
              >
                {loading ? "Creating account..." : "Create Account"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>

            <p className="text-center mt-6 text-sky-600">
              Already have an account?{" "}
              <Link to="/login" className="text-sky-700 font-semibold hover:underline" data-testid="login-link">
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12">
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <svg width="160" height="220" viewBox="0 0 200 280" className="kite-shadow">
            <polygon points="100,0 200,100 100,200 0,100" fill="#F59E0B" stroke="#D97706" strokeWidth="3"/>
            <line x1="100" y1="0" x2="100" y2="200" stroke="#D97706" strokeWidth="3"/>
            <line x1="0" y1="100" x2="200" y2="100" stroke="#D97706" strokeWidth="3"/>
            <circle cx="100" cy="100" r="20" fill="#0EA5E9"/>
            <path d="M100,200 Q120,220 100,240 Q80,260 100,280" stroke="#0EA5E9" strokeWidth="4" fill="none"/>
            <ellipse cx="110" cy="220" rx="15" ry="8" fill="#0EA5E9" opacity="0.8"/>
            <ellipse cx="90" cy="250" rx="12" ry="6" fill="#38BDF8" opacity="0.8"/>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

export { SignupPage };
