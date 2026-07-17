import React from "react";

/**
 * Global error boundary — instead of a blank white screen on runtime errors,
 * we render the actual error message + component stack. Also logs the full
 * error to console.error in a WKWebView-friendly (string-serialized) shape
 * so Xcode's console shows the real message instead of `{}`.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Serialize verbosely so WKWebView console shows the message, not {}.
    const payload = {
      name: error?.name || "Error",
      message: error?.message || String(error),
      stack: (error?.stack || "").split("\n").slice(0, 12).join("\n"),
      componentStack: (info?.componentStack || "").split("\n").slice(0, 12).join("\n"),
    };
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", JSON.stringify(payload, null, 2));
  }

  handleReload = () => {
    // Full reload — safer than trying to reset internal state.
    window.location.href = "/";
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { error, info } = this.state;
    return (
      <div
        data-testid="error-boundary"
        style={{
          minHeight: "100vh",
          padding: "24px",
          background: "linear-gradient(180deg,#fee2e2,#fef3c7)",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          color: "#7c2d12",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Something went wrong
        </h1>
        <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
          {error?.name || "Error"}: {error?.message || String(error)}
        </div>
        <pre
          style={{
            fontSize: 11,
            background: "rgba(255,255,255,0.7)",
            padding: 10,
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 200,
            whiteSpace: "pre-wrap",
          }}
        >
          {(error?.stack || "").split("\n").slice(0, 10).join("\n")}
        </pre>
        {info?.componentStack && (
          <>
            <div style={{ fontSize: 12, marginTop: 12, marginBottom: 6, fontWeight: 600 }}>
              Component stack
            </div>
            <pre
              style={{
                fontSize: 11,
                background: "rgba(255,255,255,0.7)",
                padding: 10,
                borderRadius: 8,
                overflow: "auto",
                maxHeight: 200,
                whiteSpace: "pre-wrap",
              }}
            >
              {info.componentStack.split("\n").slice(0, 10).join("\n")}
            </pre>
          </>
        )}
        <button
          onClick={this.handleReload}
          data-testid="error-boundary-reload"
          style={{
            marginTop: 16,
            padding: "10px 20px",
            background: "#0ea5e9",
            color: "white",
            border: "none",
            borderRadius: 24,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
