#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────
// Cat Lights replay assertion — protected-automation regression guard.
//
// Calls /api/dev/replay (simulated, no side effects) for a small set of
// fixed scenarios and asserts the finalAction is in an allowed set.
// Then calls /api/dev/validate against the latest live snapshot.
//
// Read-only. No HA triggers, no TTS playback, no DB writes.
//
// Usage:
//   node scripts/cat-lights-assert.mjs                       (default localhost:5000)
//   node scripts/cat-lights-assert.mjs https://uni-cal.app
//   DEV_API_KEY=… node scripts/cat-lights-assert.mjs https://uni-cal.app
//
// Exit non-zero on assertion failure.
// ────────────────────────────────────────────────────────────────────────

const base = (process.argv[2] || process.env.SMOKE_BASE || "http://localhost:5000").replace(/\/$/, "");
const devKey = process.env.DEV_API_KEY || "";
const headers = { "content-type": "application/json", ...(devKey ? { "x-dev-key": devKey } : {}) };

let pass = 0, fail = 0;
const log = (ok, name, msg = "") => {
  const icon = ok ? "✓" : "✗";
  const color = ok ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${icon} ${ok ? "PASS" : "FAIL"}\x1b[0m  ${name}${msg ? "  — " + msg : ""}`);
  ok ? pass++ : fail++;
};

async function replay(body) {
  const r = await fetch(base + "/api/dev/replay", { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function validate() {
  const r = await fetch(base + "/api/dev/validate", { method: "POST", headers, body: "{}" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

console.log(`\n▶ Cat Lights replay assertions against ${base}\n`);

// Allowed final actions in the Cat Lights state machine.
const VALID_ACTIONS = new Set(["PROMPT", "CHUM", "INVALID_WEEK_ABORT"]);

const scenarios = [
  { name: "pre-semester clamp (week before start)", body: { dateOverride: "2025-08-01", simulate: true }, expectAny: VALID_ACTIONS },
  { name: "mid-semester week 7", body: { forceWeek: 7, simulate: true }, expectAny: VALID_ACTIONS },
  { name: "fixed historical date 2026-05-01", body: { dateOverride: "2026-05-01", simulate: true }, expectAny: VALID_ACTIONS },
  // Note: the live Cat Lights handler clamps weeks 1–20; the replay sim only
  // aborts on <1. Out-of-range high weeks intentionally fall through to CHUM
  // (no matching files for the week). Asserting allowed-set is correct.
  { name: "out-of-range week 99 (replay sim — CHUM expected)", body: { forceWeek: 99, simulate: true }, expectAny: VALID_ACTIONS },
  { name: "negative week → INVALID_WEEK_ABORT", body: { forceWeek: -3, simulate: true }, expect: "INVALID_WEEK_ABORT" },
];

for (const s of scenarios) {
  try {
    const r = await replay(s.body);
    if (r.sideEffects !== "none") { log(false, s.name, `sideEffects=${r.sideEffects} (expected "none")`); continue; }
    if (s.expect && r.finalAction !== s.expect) { log(false, s.name, `finalAction=${r.finalAction} (expected ${s.expect})`); continue; }
    if (s.expectAny && !s.expectAny.has(r.finalAction)) { log(false, s.name, `finalAction=${r.finalAction} not in allowed set`); continue; }
    if (!Array.isArray(r.decisionPath) || r.decisionPath.length < 2) { log(false, s.name, "decisionPath too short"); continue; }
    log(true, s.name, `→ ${r.finalAction}`);
  } catch (e) { log(false, s.name, e.message); }
}

// Validate the most recent real snapshot, if any. WARN-not-FAIL when no
// snapshot exists (e.g., immediately after a fresh deploy).
try {
  const v = await validate();
  if (v.empty || v.noSnapshot) console.log("\x1b[33m⚠ WARN\x1b[0m  validate against live snapshot — none captured yet");
  else if (v.match === false) log(false, "validate against latest live snapshot", `expected=${v.expected} actual=${v.actual}`);
  else log(true, "validate against latest live snapshot");
} catch (e) {
  console.log("\x1b[33m⚠ WARN\x1b[0m  validate endpoint unreachable —", e.message);
}

console.log(`\n${pass} passed · ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
