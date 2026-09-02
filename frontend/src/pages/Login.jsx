import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../App";
import { toast } from "sonner";
import { extractErrorMessage } from "../lib/errors";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate('/dashboard');
    } catch (error) {
      toast.error(extractErrorMessage(error, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen sky-gradient flex" data-testid="login-page">
      {/* Left Side - Illustration */}
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
            <polygon points="100,0 200,100 100,200 0,100" fill="#0EA5E9" stroke="#0284C7" strokeWidth="3"/>
            <line x1="100" y1="0" x2="100" y2="200" stroke="#0284C7" strokeWidth="3"/>
            <line x1="0" y1="100" x2="200" y2="100" stroke="#0284C7" strokeWidth="3"/>
            <circle cx="100" cy="100" r="20" fill="#F59E0B"/>
            <path d="M100,200 Q120,220 100,240 Q80,260 100,280" stroke="#F59E0B" strokeWidth="4" fill="none"/>
            <ellipse cx="110" cy="220" rx="15" ry="8" fill="#F59E0B" opacity="0.8"/>
            <ellipse cx="90" cy="250" rx="12" ry="6" fill="#FB923C" opacity="0.8"/>
          </svg>
        </motion.div>
      </div>

      {/* Right Side - Form */}
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
              <h2 className="text-xl font-semibold text-sky-900">Welcome Back!</h2>
              <p className="text-sky-600 mt-1">Sign in to continue your journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    placeholder="Enter your password"
                    className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                    required
                    data-testid="password-input"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-1 py-6"
                data-testid="login-submit-btn"
              >
                {loading ? "Signing in..." : "Sign In"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>

            <p className="text-center mt-4 text-sm">
              <Link
                to="/forgot-password"
                className="text-sky-600 hover:text-sky-700 hover:underline"
                data-testid="forgot-password-link"
              >
                Forgot your password?
              </Link>
            </p>

            <p className="text-center mt-3 text-sky-600">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="text-sky-700 font-semibold hover:underline" data-testid="signup-link">
                Sign Up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export { LoginPage };
