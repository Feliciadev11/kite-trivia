import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { API } from "../App";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft, Key, Copy, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter code + new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generatedCode, setGeneratedCode] = useState(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/forgot-password`, { email });
      setGeneratedCode(data.code || null);
      setExpiresIn(data.expires_in_seconds || 900);
      setStep(2);
      if (data.code) {
        toast.success("Reset code generated — see below");
      } else {
        toast.info("If that email is registered, a code has been generated.");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not generate code");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        email,
        code: code.trim(),
        new_password: newPassword,
      });
      toast.success("Password reset! Please sign in.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };

  return (
    <div className="min-h-screen sky-gradient flex items-center justify-center p-6" data-testid="forgot-password-page">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="glass-card p-8 rounded-3xl bg-white/75 backdrop-blur-md border-white/60 shadow-sm">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sky-600 text-sm mb-6 hover:underline"
            data-testid="forgot-back-to-login"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>

          <div className="text-center mb-7">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center mb-3">
              <Key className="w-7 h-7 text-sky-600" />
            </div>
            <h1 className="text-2xl font-semibold text-sky-800">
              {step === 1 ? "Forgot your password?" : "Enter your reset code"}
            </h1>
            <p className="text-sky-600/80 mt-1.5 text-sm">
              {step === 1
                ? "Drift back into your sky in two gentle steps."
                : "Use the code below to set a new password."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                onSubmit={handleRequestCode}
                className="space-y-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
              >
                <div>
                  <Label htmlFor="forgot-email" className="text-sky-700">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                      required
                      data-testid="forgot-email-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg hover:shadow-sky-500/25 transition-all duration-500 py-6"
                  data-testid="forgot-request-code-btn"
                >
                  {loading ? "Drifting..." : "Get reset code"}
                </Button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                onSubmit={handleReset}
                className="space-y-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
              >
                {/* Display the generated code in a calm card */}
                {generatedCode ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="rounded-2xl p-5 bg-gradient-to-br from-sky-50 via-white to-violet-50 border border-sky-100"
                    data-testid="forgot-code-display"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-500 mb-2">Your reset code</p>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="text-3xl font-light tracking-[0.4em] text-sky-700 tabular-nums select-all"
                        data-testid="forgot-code-value"
                      >
                        {generatedCode}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyCode}
                        className="rounded-full text-sky-600 hover:bg-sky-100"
                        data-testid="forgot-code-copy"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      Expires in {Math.round(expiresIn / 60)} minutes. Single-use only.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl p-4 bg-amber-50/70 border border-amber-100 text-amber-700 text-sm"
                    data-testid="forgot-code-not-found"
                  >
                    If that email is registered, a reset code is now ready. Otherwise, try a different email.
                  </motion.div>
                )}

                <div>
                  <Label htmlFor="forgot-code" className="text-sky-700">Reset code</Label>
                  <div className="relative mt-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                    <Input
                      id="forgot-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit code"
                      className="pl-10 rounded-2xl border-sky-100 bg-white/50 tracking-[0.3em] focus:bg-white focus:ring-2 focus:ring-sky-400"
                      required
                      data-testid="forgot-code-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="new-password" className="text-sky-700">New password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                      required
                      minLength={6}
                      data-testid="forgot-new-password-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="text-sky-700">Confirm new password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat the password"
                      className="pl-10 rounded-2xl border-sky-100 bg-white/50 focus:bg-white focus:ring-2 focus:ring-sky-400"
                      required
                      minLength={6}
                      data-testid="forgot-confirm-password-input"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      setGeneratedCode(null);
                      setCode("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="flex-1 rounded-full border-sky-100 text-sky-600 hover:bg-sky-50 py-6"
                    data-testid="forgot-start-over-btn"
                  >
                    Start over
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg py-6"
                    data-testid="forgot-reset-btn"
                  >
                    {loading ? "Resetting..." : "Reset password"}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center mt-6 text-xs text-slate-400">
            Codes are single-use and expire after 15 minutes.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

export { ForgotPasswordPage };
