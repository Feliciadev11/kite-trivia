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

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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

            {/* Google Login */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-6 rounded-2xl border-2 border-sky-100 hover:border-sky-200 hover:bg-sky-50 py-6"
              onClick={handleGoogleLogin}
              data-testid="google-login-btn"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sky-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-sky-500">or</span>
              </div>
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
