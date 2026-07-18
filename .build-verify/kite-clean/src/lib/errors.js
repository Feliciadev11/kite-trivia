// Friendly error message extractor for FastAPI/Pydantic responses.
// FastAPI returns `detail` as either a plain string (HTTPException) OR
// an array of validation error objects (Pydantic 422). Treating the array
// as a string produces `[object Object]` toasts — this helper normalizes both.

export function extractErrorMessage(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail;

  // Plain string detail — easy case (HTTPException)
  if (typeof detail === "string" && detail.trim()) return detail;

  // Pydantic 422: array of { loc, msg, type, ... }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first?.msg) {
      // Strip the leading "Value error, " or "value is not a valid email..." noise
      const msg = String(first.msg).replace(/^value is not a valid email address:?\s*/i, "");
      // Friendly translations for common cases
      if (/email/i.test(JSON.stringify(first.loc || []))) {
        return "Please enter a valid email address";
      }
      return msg.charAt(0).toUpperCase() + msg.slice(1);
    }
  }

  // Plain object with message
  if (detail && typeof detail === "object" && detail.msg) return detail.msg;

  // Network errors
  if (err?.message && !err.response) return "Network error — please try again";

  return fallback;
}
