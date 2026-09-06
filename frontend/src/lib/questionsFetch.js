/**
 * Classifies a failed GET /api/questions call into what the UI should show.
 * Pulled out of Play.jsx so the branching (free-tier gate vs. a real error
 * that deserves a retry button) is unit-testable without mounting React.
 */
export function classifyQuestionsError(error) {
  const status = error?.response?.status;

  if (status === 402) {
    const detail = error.response.data?.detail || {};
    return {
      type: "free_tier_gate",
      rounds_played_today: detail.rounds_played_today,
      free_rounds_per_day: detail.free_rounds_per_day,
      message: detail.message,
    };
  }

  if (!error?.response) {
    // No response at all: timeout, DNS failure, offline, ATS/CORS block.
    return {
      type: "network_error",
      message: "Couldn't reach Kite. Check your connection and try again.",
    };
  }

  if (status === 401) {
    return {
      type: "auth_error",
      message: "Your session needs a moment to refresh. Try again.",
    };
  }

  return {
    type: "server_error",
    message: "Something went wrong loading questions. Please try again.",
  };
}
