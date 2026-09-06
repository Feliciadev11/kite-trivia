#!/usr/bin/env node
/**
 * Copies backend/entitlements_config.json (the single source of truth for
 * RevenueCat entitlement/product IDs and progression gates) into
 * frontend/src/lib/ so it can be imported like any other module. Runs
 * automatically before `yarn start` / `yarn build` / `yarn build:release` —
 * never edit the generated file directly, edit backend/entitlements_config.json.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "..", "backend", "entitlements_config.json");
const DEST = path.resolve(__dirname, "..", "src", "lib", "entitlements.generated.json");

// Must stay valid JSON (webpack's json-loader parses it with JSON.parse) —
// the "do not edit" notice lives in the source file's _comment field instead.
const config = JSON.parse(fs.readFileSync(SRC, "utf8"));
fs.writeFileSync(DEST, JSON.stringify(config, null, 2) + "\n");
console.log(`[sync-entitlements] wrote ${path.relative(process.cwd(), DEST)}`);
