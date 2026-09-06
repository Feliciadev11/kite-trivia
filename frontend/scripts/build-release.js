#!/usr/bin/env node
/**
 * Production/mobile release build. Root-caused bug this exists to prevent:
 * on 2026-09-05 a physical-iPhone build shipped with REACT_APP_BACKEND_URL
 * baked in as "http://192.168.0.24:8001" (a developer's LAN IP, plaintext
 * HTTP) because a plain `yarn build` picks up whatever REACT_APP_BACKEND_URL
 * happens to be exported in the *shell* first (CRA/dotenv never overrides an
 * already-set process.env var) — so trivia questions silently never loaded
 * on-device (iOS ATS blocks cleartext HTTP outright, and the IP isn't
 * reachable off that one Wi-Fi network anyway).
 *
 * This script is the only supported way to build for a store/device release:
 *   1. Strips any ambient REACT_APP_BACKEND_URL from the shell so the build
 *      can only use the committed frontend/.env.production.
 *   2. Validates that URL is https and not a private/loopback/.local host.
 *   3. Runs the real build (craco build).
 *   4. Re-scans the OUTPUT bundle (defense in depth) to confirm the URL that
 *      actually landed matches, and that no Google-Sign-In UI markers made
 *      it into the shipped iOS/Android bundle.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const ROOT = path.resolve(__dirname, "..");
const fail = (msg) => {
  console.error(`\n[build-release] FAIL: ${msg}\n`);
  process.exit(1);
};

// ---- 1. Never trust ambient shell state for a release build ----
delete process.env.REACT_APP_BACKEND_URL;
const envFile = path.join(ROOT, ".env.production");
if (!fs.existsSync(envFile)) fail(`missing ${envFile}`);
dotenv.config({ path: envFile });

// ---- 2. Validate the URL before we even attempt to build ----
const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|.*\.local)$/i;

function assertSafeProductionUrl(url, label) {
  if (!url) fail(`${label} is empty/undefined`);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`${label}="${url}" is not a valid URL`);
  }
  if (parsed.protocol !== "https:") {
    fail(`${label}="${url}" must be https:// (iOS ATS blocks plaintext http by default)`);
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    fail(`${label}="${url}" points at a private/local host — not reachable off one Wi-Fi network, must never ship`);
  }
  return url;
}

const expectedUrl = assertSafeProductionUrl(
  process.env.REACT_APP_BACKEND_URL,
  "REACT_APP_BACKEND_URL"
);
console.log(`[build-release] Building against REACT_APP_BACKEND_URL=${expectedUrl}`);

// ---- 3. Regenerate entitlements.generated.json, then run the real build ----
execFileSync("node", ["scripts/sync-entitlements.js"], { cwd: ROOT, stdio: "inherit" });
execFileSync("npx", ["craco", "build"], { cwd: ROOT, stdio: "inherit", env: process.env });

// ---- 4. Re-scan the compiled output (defense in depth) ----
const buildJsDir = path.join(ROOT, "build", "static", "js");
const jsFiles = fs
  .readdirSync(buildJsDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => path.join(buildJsDir, f));

let sawExpectedUrl = false;
const FORBIDDEN_URL_RE = /REACT_APP_BACKEND_URL:"([^"]*)"/g;
const GOOGLE_SIGNIN_MARKERS = [
  /sign[- ]?in with google/i,
  /continue with google/i,
  /accounts\.google\.com/i,
  /google_oauth/i,
  /GoogleSignIn/,
  /gsi\/client/i,
];

for (const file of jsFiles) {
  const src = fs.readFileSync(file, "utf8");

  let m;
  while ((m = FORBIDDEN_URL_RE.exec(src))) {
    if (m[1] === expectedUrl) {
      sawExpectedUrl = true;
    } else {
      fail(`bundle ${path.basename(file)} embeds REACT_APP_BACKEND_URL="${m[1]}" (expected "${expectedUrl}")`);
    }
  }

  for (const marker of GOOGLE_SIGNIN_MARKERS) {
    if (marker.test(src)) {
      fail(`bundle ${path.basename(file)} contains a Google-Sign-In marker (${marker}) — not permitted in the iOS release`);
    }
  }
}

if (!sawExpectedUrl) {
  fail("could not find REACT_APP_BACKEND_URL baked into the output bundle — build may not have picked up .env.production");
}

console.log("[build-release] PASS: backend URL is production HTTPS, no Google-Sign-In markers found.");
