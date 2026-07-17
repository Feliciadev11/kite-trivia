import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { ErrorBoundary } from "@/lib/errorBoundary";

/**
 * Global error instrumentation — Capacitor iOS WKWebView logs errors as `{}`
 * unless we explicitly serialize the properties before logging. These two
 * handlers surface message/stack/url/line/col in Xcode's console.
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
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const payload = {
      type: "unhandledrejection",
      name: reason?.name || typeof reason,
      message: reason?.message || String(reason),
      code: reason?.code,
      // axios error fields
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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
