import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";

/**
 * Pre-React safety net — if the JS bundle loads but React itself fails to
 * mount (bad import, syntax error at import-time, CSP block, etc.), Capacitor
 * shows a blank white screen with no clue why. This handler writes any error
 * from module init OR render directly into the DOM so it's visible on device.
 */
function paintErrorToDOM(prefix, err) {
  try {
    const root = document.getElementById("root") || document.body;
    const payload = {
      name: err?.name || "Error",
      message: err?.message || String(err),
      stack: (err?.stack || "").split("\n").slice(0, 15).join("\n"),
    };
    root.innerHTML = `
      <div style="min-height:100vh;padding:20px;background:#fee2e2;color:#7f1d1d;
                  font:14px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;
                  overflow:auto;word-break:break-word;">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${prefix}</div>
        <div style="font-weight:600;margin-bottom:8px;">${payload.name}: ${payload.message}</div>
        <pre style="font-size:11px;background:#fff;padding:8px;border-radius:6px;
                    white-space:pre-wrap;">${payload.stack}</pre>
      </div>
    `;
  } catch (_paintErr) {
    // last-resort: alert
    // eslint-disable-next-line no-alert
    try { alert(`${prefix}\n${err?.message || err}`); } catch (_) {}
  }
  // eslint-disable-next-line no-console
  console.error(prefix, JSON.stringify({
    name: err?.name || "Error",
    message: err?.message || String(err),
    stack: (err?.stack || "").split("\n").slice(0, 15).join("\n"),
  }, null, 2));
}

/**
 * Global runtime error handlers — Capacitor iOS WKWebView serializes error
 * events as `{}` unless we explicitly extract .message / .stack / .filename.
 */
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const payload = {
      type: "window.error",
      message: event?.message || String(event?.error) || "unknown",
      filename: event?.filename || "",
      lineno: event?.lineno,
      colno: event?.colno,
      errorName: event?.error?.name,
      errorMessage: event?.error?.message,
      stack: (event?.error?.stack || "").split("\n").slice(0, 12).join("\n"),
    };
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", JSON.stringify(payload, null, 2));
    // Paint to DOM only if React hasn't rendered anything visible yet
    const root = document.getElementById("root");
    if (root && root.children.length === 0) {
      paintErrorToDOM("[GlobalError]", event?.error || event);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const payload = {
      type: "unhandledrejection",
      name: reason?.name || typeof reason,
      message: reason?.message || String(reason),
      code: reason?.code,
      requestUrl: reason?.config?.url,
      requestMethod: reason?.config?.method,
      responseStatus: reason?.response?.status,
      responseData: reason?.response?.data,
      stack: (reason?.stack || "").split("\n").slice(0, 12).join("\n"),
    };
    // eslint-disable-next-line no-console
    console.error("[UnhandledRejection]", JSON.stringify(payload, null, 2));
  });
}

// Async load React tree — wrapped so any import-time throw is caught.
(async () => {
  try {
    const { default: App } = await import("@/App");
    const { ErrorBoundary } = await import("@/lib/errorBoundary");

    const rootEl = document.getElementById("root");
    if (!rootEl) {
      throw new Error("#root element missing in index.html");
    }

    // Boot marker — proves index.js executed and root was found even if
    // React later throws. Overwritten by React on first successful render.
    rootEl.innerHTML = `
      <div id="__boot_marker" style="position:fixed;top:0;left:0;right:0;
        background:#0EA5E9;color:white;padding:6px 10px;font:11px
        -apple-system,sans-serif;text-align:center;z-index:0;">
        Kite booting…
      </div>
    `;

    const root = ReactDOM.createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (bootErr) {
    paintErrorToDOM("[BootError]", bootErr);
  }
})();
