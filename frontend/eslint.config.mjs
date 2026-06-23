import reactHooks from "eslint-plugin-react-hooks";

export default [{
  files: ["**/*.{js,jsx}"],
  ignores: ["**/node_modules/**", "**/components/ui/**", "**/build/**", "src/serviceWorker.js", "src/setupTests.js", "src/reportWebVitals.js"],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: {
      window: "readonly", document: "readonly", localStorage: "readonly",
      sessionStorage: "readonly", console: "readonly", process: "readonly",
      setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly",
      clearInterval: "readonly", fetch: "readonly", URL: "readonly",
      requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
      AudioContext: "readonly", webkitAudioContext: "readonly",
      Audio: "readonly", Image: "readonly", FormData: "readonly",
      navigator: "readonly", location: "readonly", history: "readonly",
      crypto: "readonly", Infinity: "readonly", AbortController: "readonly",
      Event: "readonly", CustomEvent: "readonly", URLSearchParams: "readonly",
      btoa: "readonly", atob: "readonly", structuredClone: "readonly",
      module: "readonly", require: "readonly", global: "readonly",
      Buffer: "readonly", __dirname: "readonly"
    }
  },
  plugins: { "react-hooks": reactHooks },
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
    "no-console": ["warn", { "allow": ["warn"] }]
  }
}];
