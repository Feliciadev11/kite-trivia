// Tiny dev-only logger. No-ops in production so we never leak diagnostic
// output to end users while still keeping useful traces during development.
const isDev = process.env.NODE_ENV !== "production";

export const logError = (...args) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export const logWarn = (...args) => {
  if (isDev) {
    console.warn(...args);
  }
};
