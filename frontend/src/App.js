import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Toaster, toast } from "sonner";
import { logError } from "./lib/logger";

const SESSION_TOKEN_KEY = "session_token";
const IS_NATIVE = Capacitor.isNativePlatform();

// Without this, a dropped/blocked connection (bad Wi-Fi, ATS block, backend
// down) hangs every request indefinitely — the caller's loading state never
// resolves and the UI is stuck rather than showing a retryable error.
axios.defaults.timeout = 20000;

// Native-only: the SameSite=None session cookie doesn't always persist/reattach
// reliably from a Capacitor WKWebView (cross-site relative to the API - see the
// cookie comment in server.py). As a fallback, native builds also store the
// session token in the iOS Keychain / Android Keystore (never UserDefaults/
// SharedPreferences) and attach it as Authorization: Bearer on every request.
// Web is untouched - it continues to rely solely on the cookie.
if (IS_NATIVE) {
  axios.interceptors.request.use(async (config) => {
    try {
      const token = await SecureStorage.getItem(SESSION_TOKEN_KEY);
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      logError("Failed to read session token from secure storage", e);
    }
    return config;
  });
}

// Pages
import { LandingPage } from "./pages/Landing";
import { LoginPage } from "./pages/Login";
import { SignupPage } from "./pages/Signup";
import { ForgotPasswordPage } from "./pages/ForgotPassword";
import { PrivacyPage } from "./pages/Privacy";
import { TermsPage } from "./pages/Terms";
import { DashboardPage } from "./pages/Dashboard";
import { PlayPage } from "./pages/Play";
import { ShopPage } from "./pages/Shop";
import { LeaderboardPage } from "./pages/Leaderboard";
import { ProfilePage } from "./pages/Profile";
import { SettingsPage } from "./pages/Settings";

// Contexts
import { AudioProvider } from "./contexts/AudioContext";
import { PremiumProvider } from "./contexts/PremiumContext";
import { PaywallHost } from "./components/Paywall";
import SkySplash from "./components/SkySplash";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Auth Provider
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      if (error?.response?.status === 401) {
        // No existing session (not a network/server error) - create an
        // anonymous one so gameplay/purchases work without requiring
        // registration (Apple Guideline 5.1.1(v)). See
        // memory/anonymous-purchases-migration-plan.md.
        try {
          const anon = await axios.post(`${API}/auth/anonymous`, {}, {
            withCredentials: true
          });
          if (IS_NATIVE && anon.data?.session_token) {
            await SecureStorage.setItem(SESSION_TOKEN_KEY, anon.data.session_token);
          }
          setUser(anon.data);
        } catch (anonError) {
          logError("Failed to create anonymous session", anonError);
          setUser(null);
        }
      } else {
        // Network error, 5xx, etc. - don't spin up a new anonymous account
        // for what might be a transient failure on an otherwise-valid
        // session.
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password }, {
      withCredentials: true
    });
    if (IS_NATIVE && response.data?.session_token) {
      await SecureStorage.setItem(SESSION_TOKEN_KEY, response.data.session_token);
    }
    setUser(response.data);
    return response.data;
  };

  const register = async (email, password, name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name }, {
      withCredentials: true
    });
    if (IS_NATIVE && response.data?.session_token) {
      await SecureStorage.setItem(SESSION_TOKEN_KEY, response.data.session_token);
    }
    setUser(response.data);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      logError("Logout error:", e);
    }
    if (IS_NATIVE) {
      try {
        await SecureStorage.removeItem(SESSION_TOKEN_KEY);
      } catch (e) {
        logError("Logout: failed to clear stored session token:", e);
      }
    }
    setUser(null);
  };

  const deleteAccount = async (password) => {
    const response = await axios.post(
      `${API}/auth/account/delete`,
      { password },
      { withCredentials: true }
    );
    if (IS_NATIVE) {
      try {
        await SecureStorage.removeItem(SESSION_TOKEN_KEY);
      } catch (e) {
        logError("Delete account: failed to clear stored session token:", e);
      }
    }
    setUser(null);
    return response.data;
  };

  const refreshUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (e) {
      logError("Refresh error:", e);
    }
  };

  // Exchanges an Emergent OAuth session_id for an app session. Used by the
  // web hash-fragment flow (AuthCallback, below).
  const exchangeSessionId = useCallback(async (sessionId) => {
    const response = await axios.post(`${API}/auth/session`,
      { session_id: sessionId },
      { withCredentials: true }
    );
    if (IS_NATIVE && response.data?.session_token) {
      await SecureStorage.setItem(SESSION_TOKEN_KEY, response.data.session_token);
    }
    setUser(response.data);
    return response.data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, deleteAccount, refreshUser, exchangeSessionId }}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth Callback Component
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { exchangeSessionId } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);

      if (sessionIdMatch) {
        try {
          const userData = await exchangeSessionId(sessionIdMatch[1]);
          toast.success(`Welcome, ${userData.name}!`);
          navigate('/dashboard', { replace: true, state: { user: userData } });
        } catch (error) {
          logError("Auth error:", error);
          toast.error("Authentication failed");
          navigate('/login', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [location, navigate, exchangeSessionId]);

  return (
    <div className="min-h-screen sky-gradient flex items-center justify-center">
      <LoadingKite message="Authenticating..." />
    </div>
  );
};

// Loading Kite Component
export const LoadingKite = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6" data-testid="loading-kite">
      <div className="animate-float">
        <svg width="80" height="100" viewBox="0 0 80 100" className="kite-shadow">
          <polygon points="40,0 80,40 40,80 0,40" fill="#0EA5E9" stroke="#0284C7" strokeWidth="2"/>
          <line x1="40" y1="0" x2="40" y2="80" stroke="#0284C7" strokeWidth="2"/>
          <line x1="0" y1="40" x2="80" y2="40" stroke="#0284C7" strokeWidth="2"/>
          <circle cx="40" cy="40" r="8" fill="#F59E0B"/>
          <path d="M40,80 Q50,95 40,100 Q30,95 40,80" fill="#F59E0B" opacity="0.8"/>
          <path d="M40,100 C45,110 35,120 40,130 C45,140 35,150 40,160" stroke="#F59E0B" strokeWidth="2" fill="none"/>
        </svg>
      </div>
      <p className="text-sky-600 font-medium text-lg">{message}</p>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center">
        <LoadingKite />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// App Router Component
const AppRouter = () => {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check URL fragment for session_id synchronously during render
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/play" element={
        <ProtectedRoute>
          <PlayPage />
        </ProtectedRoute>
      } />
      <Route path="/shop" element={
        <ProtectedRoute>
          <ShopPage />
        </ProtectedRoute>
      } />
      <Route path="/leaderboard" element={
        <ProtectedRoute>
          <LeaderboardPage />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <AudioProvider>
          <SkySplash />
          <AuthProvider>
            <PremiumProvider>
              <AppRouter />
              <PaywallHost />
            </PremiumProvider>
          </AuthProvider>
        </AudioProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
