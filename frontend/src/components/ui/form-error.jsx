import { AlertCircle } from "lucide-react";

/**
 * Persistent, accessible form-level error. Pair with `aria-invalid` +
 * `aria-describedby={id}` on the related input(s) — a toast alone isn't a
 * reliable accessible error surface (it auto-dismisses and isn't always
 * announced), so this is the real error UI; the toast on top of it is just
 * a familiar visual echo.
 */
export function FormError({ id, message }) {
  if (!message) return null;
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
      data-testid="form-error"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export default FormError;
