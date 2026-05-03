#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────
// UniCal smoke tests — fast, read-only invariant checks.
//
// Usage:
//   node scripts/smoke.mjs                                 (defaults to http://localhost:5000)
//   node scripts/smoke.mjs https://uni-cal.app
//
// Auth (required for /api/dev/* against a production / Cloudflare Tunnel host):
//
//   1) Session cookie (recommended — same auth the Dev Panel uses)
//      UNICAL_SESSION_TOKEN=…   node scripts/smoke.mjs https://uni-cal.app
//      UNICAL_COOKIE='uni_cal_session=…; other=…' node scripts/smoke.mjs https://uni-cal.app
//
//   2) Dev key header (legacy — only works if the server has DEV_API_KEY env var set)
//      DEV_API_KEY=…  node scripts/smoke.mjs https://uni-cal.app
//
// To get a session token: open the Dev Panel in your browser, then in DevTools
// → Application → Cookies → copy the value of `uni_cal_session`. The token is
// long-lived (10 years).
//
// If no auth is provided, authenticated checks are SKIPPED (not failed) and a
// clear notice is printed. Public checks still run.
//
// Exits non-zero only on real failures (skipped checks do NOT fail the run).
// ────────────────────────────────────────────────────────────────────────

const base = (process.argv[2] || process.env.SMOKE_BASE || "http://localhost:5000").replace(/\/$/, "");

// Build auth headers without ever logging or echoing the token value.
const sessionToken = (process.env.UNICAL_SESSION_TOKEN || "").trim();
const cookieRaw    = (process.env.UNICAL_COOKIE || "").trim();
const devKey       = (process.env.DEV_API_KEY || "").trim();

const authHeaders = {};
let authMode = "none";
if (cookieRaw) { authHeaders["Cookie"] = cookieRaw; authMode = "cookie (UNICAL_COOKIE)"; }
else if (sessionToken) { authHeaders["Cookie"] = `uni_cal_session=${sessionToken}`; authMode = "cookie (UNICAL_SESSION_TOKEN)"; }
if (devKey) { authHeaders["x-dev-key"] = devKey; authMode = authMode === "none" ? "x-dev-key" : authMode + " + x-dev-key"; }
const hasAuth = authMode !== "none";

let pass = 0, fail = 0, warn = 0, skip = 0;
const log = (status, name, msg = "") => {
  const icon  = status === "PASS" ? "✓" : status === "WARN" ? "⚠" : status === "SKIP" ? "•" : "✗";
  const color = status === "PASS" ? "\x1b[32m" : status === "WARN" ? "\x1b[33m" : status === "SKIP" ? "\x1b[36m" : "\x1b[31m";
  console.log(`${color}${icon} ${status}\x1b[0m  ${name}${msg ? "  — " + msg : ""}`);
  if (status === "PASS") pass++;
  else if (status === "WARN") warn++;
  else if (status === "SKIP") skip++;
  else fail++;
};

async function get(path, withAuth = true) {
  const headers = withAuth ? authHeaders : {};
  const r = await fetch(base + path, { headers });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json().catch(() => ({})) : await r.text();
  return { ok: r.ok, status: r.status, body };
}

async function post(path, json, withAuth = true) {
  const headers = { "Content-Type": "application/json", ...(withAuth ? authHeaders : {}) };
  const r = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(json) });
  return { ok: r.ok, status: r.status };
}

async function check(name, fn) {
  try {
    const result = await fn();
    if (result === true) log("PASS", name);
    else if (result?.skip) log("SKIP", name, result.skip);
    else if (result?.warn) log("WARN", name, result.warn);
    else log("FAIL", name, typeof result === "string" ? result : JSON.stringify(result).slice(0, 160));
  } catch (e) { log("FAIL", name, e.message); }
}

// Auth-aware wrapper for /api/dev/* checks. If a 401 comes back AND no auth
// was provided, mark SKIP (not FAIL). If auth WAS provided and we still got
// 401, mark FAIL because the credentials are wrong.
async function authedCheck(name, runner) {
  await check(name, async () => {
    const r = await runner();
    if (r && typeof r === "object" && "status" in r && r.status === 401) {
      if (!hasAuth) return { skip: "no auth provided (set UNICAL_SESSION_TOKEN or DEV_API_KEY)" };
      return "HTTP 401 — auth provided but rejected (token expired or invalid)";
    }
    return r;
  });
}

console.log(`\n▶ UniCal smoke tests against ${base}`);
console.log(`  Auth: ${authMode}\n`);

if (!hasAuth) {
  console.log("\x1b[33m  Dev endpoints require authentication. Provide UNICAL_SESSION_TOKEN, UNICAL_COOKIE,\x1b[0m");
  console.log("\x1b[33m  or DEV_API_KEY to run authenticated checks. Public checks will still execute.\x1b[0m\n");
}

// ──────────────────────────── PUBLIC CHECKS (no auth required) ────────────────────────────

await check("[public] server reachable (GET /login returns HTML)", async () => {
  const r = await get("/login", false);
  if (!r.ok) return `HTTP ${r.status}`;
  return true;
});

await check("[public] /api/onedrive/status responds (allowlisted, no auth)", async () => {
  const r = await get("/api/onedrive/status", false);
  if (r.status === 404) return { warn: "endpoint not present on this build" };
  if (!r.ok) return `HTTP ${r.status}`;
  return true;
});

// ──────────────────────── AUTHENTICATED CHECKS (skip if no auth) ──────────────────────────

await authedCheck("dev/system-map responds with routes + tables", async () => {
  const r = await get("/api/dev/system-map");
  if (r.status === 401) return r;
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.routes?.total) return "no routes returned";
  if (!Array.isArray(r.body?.database?.tables)) return "no tables";
  return true;
});

await authedCheck("dev/status reports DB connected", async () => {
  const r = await get("/api/dev/status");
  if (r.status === 401) return r;
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.connections?.database) return "DB connection false";
  return true;
});

await authedCheck("dev/status reports an active semester", async () => {
  const r = await get("/api/dev/status");
  if (r.status === 401) return r;
  if (!r.body?.activeSemester) return { warn: "no active semester (ok if pre-semester)" };
  return true;
});

await authedCheck("dev/status currentWeekNumber is in [1, 20]", async () => {
  const r = await get("/api/dev/status");
  if (r.status === 401) return r;
  const w = r.body?.currentWeekNumber;
  if (w == null) return { warn: "no week (no semester start yet)" };
  if (w < 1 || w > 20) return `invalid week ${w} — Cat Lights would refuse to play`;
  return true;
});

await authedCheck("dev/build-info shows recommended restart cmd", async () => {
  const r = await get("/api/dev/build-info");
  if (r.status === 401) return r;
  if (!r.body?.recommendedRestart?.includes("pm2")) return "missing pm2 restart hint";
  return true;
});

await authedCheck("dev/trace returns array (may be empty)", async () => {
  const r = await get("/api/dev/trace");
  if (r.status === 401) return r;
  if (!Array.isArray(r.body?.steps)) return "no steps array";
  return true;
});

await authedCheck("dev/file-map returns summary (no crash)", async () => {
  const r = await get("/api/dev/file-map");
  if (r.status === 401) return r;
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.summary) return "no summary";
  return true;
});

await authedCheck("dev/onedrive-audit returns passed/failed lists", async () => {
  const r = await get("/api/dev/onedrive-audit");
  if (r.status === 401) return r;
  if (!r.ok) return `HTTP ${r.status}`;
  if (!Array.isArray(r.body?.passed) || !Array.isArray(r.body?.failed)) return "missing lists";
  if (r.body.failed.length > 0) return { warn: `${r.body.failed.length} courses failing audit — inspect /api/dev/onedrive-audit` };
  return true;
});

await authedCheck("dev/tts-ready does not have stuck files (warn only)", async () => {
  const r = await get("/api/dev/tts-ready");
  if (r.status === 401) return r;
  if (!r.ok) return `HTTP ${r.status}`;
  const stuck = (r.body?.rows || []).filter(f => f.extractedText && f.totalChunks > 0 && !f.preparedAt && !f.listened).length;
  if (stuck > 0) return { warn: `${stuck} files have extracted text + chunks but no preparedAt — AudioPrep may be stuck` };
  return true;
});

await authedCheck("dev/protected-systems lists Cat Lights", async () => {
  const r = await get("/api/dev/protected-systems");
  if (r.status === 401) return r;
  const names = (r.body?.systems || []).map(s => s.name).join(" | ");
  if (!/Cat Lights/i.test(names)) return "Cat Lights missing from protected list";
  return true;
});

await authedCheck("dev/handoff returns bundle with git + routes + tables", async () => {
  const r = await get("/api/dev/handoff");
  if (r.status === 401) return r;
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.version || !r.body?.routes || !r.body?.database) return "incomplete bundle";
  return true;
});

await authedCheck("dev/patch rejects unknown find string", async () => {
  const r = await post("/api/dev/patch", { file: "docs/CODE_MAP.md", find: "__nonexistent_marker_zzz__", replace: "x" });
  if (r.status === 401) return r;
  if (r.status !== 404) return `expected 404, got ${r.status}`;
  return true;
});

await authedCheck("dev/patch rejects path escapes", async () => {
  const r = await post("/api/dev/patch", { file: "../../etc/passwd", find: "x", replace: "y" });
  if (r.status === 401) return r;
  if (r.status !== 400) return `expected 400, got ${r.status}`;
  return true;
});

console.log(`\n${pass} passed · ${warn} warnings · ${skip} skipped · ${fail} failed\n`);
if (!hasAuth && skip > 0) {
  console.log("\x1b[36mNote:\x1b[0m authenticated checks were skipped. Re-run with UNICAL_SESSION_TOKEN to verify the full suite.\n");
}
process.exit(fail > 0 ? 1 : 0);
