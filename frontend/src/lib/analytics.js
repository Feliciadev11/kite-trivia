/**
 * Plausible Analytics — cookieless, no personal data. Web only; never loaded
 * inside the native iOS/Android app. Gated behind explicit visitor consent
 * (see components/AnalyticsConsent.jsx) even though Plausible's own privacy
 * model doesn't require it, so the on-screen banner and Privacy Policy stay
 * truthful about what actually runs.
 */
const CONSENT_KEY = "kite_analytics_consent";
const PLAUSIBLE_DOMAIN = "kite-trivia-quest.emergent.host";
const SCRIPT_ID = "plausible-script";

export function getAnalyticsConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY); // "accepted" | "declined" | null
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(accepted) {
  try {
    localStorage.setItem(CONSENT_KEY, accepted ? "accepted" : "declined");
  } catch {
    // localStorage unavailable (private mode, etc.) — consent just won't persist.
  }
  if (accepted) loadPlausible();
}

export function loadPlausible() {
  if (document.getElementById(SCRIPT_ID)) return; // already loaded
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.defer = true;
  script.setAttribute("data-domain", PLAUSIBLE_DOMAIN);
  script.src = "https://plausible.io/js/script.js";
  document.head.appendChild(script);
}
