#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────
// UniCal smoke tests — fast, read-only invariant checks.
// Usage:
//   node scripts/smoke.mjs                 (defaults to http://localhost:5000)
//   node scripts/smoke.mjs https://uni-cal.app
//   DEV_API_KEY=… node scripts/smoke.mjs https://uni-cal.app
// Exits non-zero on any failed check.
// ────────────────────────────────────────────────────────────────────────

const base = (process.argv[2] || process.env.SMOKE_BASE || "http://localhost:5000").replace(/\/$/, "");
const devKey = process.env.DEV_API_KEY || "";
const headers = devKey ? { "x-dev-key": devKey } : {};

let pass = 0, fail = 0, warn = 0;
const log = (status, name, msg = "") => {
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "⚠" : "✗";
  const color = status === "PASS" ? "\x1b[32m" : status === "WARN" ? "\x1b[33m" : "\x1b[31m";
  console.log(`${color}${icon} ${status}\x1b[0m  ${name}${msg ? "  — " + msg : ""}`);
  if (status === "PASS") pass++; else if (status === "WARN") warn++; else fail++;
};

async function get(path) {
  const r = await fetch(base + path, { headers });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.text();
  return { ok: r.ok, status: r.status, body };
}

async function check(name, fn) {
  try {
    const result = await fn();
    if (result === true) log("PASS", name);
    else if (result?.warn) log("WARN", name, result.warn);
    else log("FAIL", name, typeof result === "string" ? result : JSON.stringify(result).slice(0, 160));
  } catch (e) {
    log("FAIL", name, e.message);
  }
}

console.log(`\n▶ UniCal smoke tests against ${base}\n`);

await check("dev/system-map responds with routes + tables", async () => {
  const r = await get("/api/dev/system-map");
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.routes?.total) return "no routes returned";
  if (!Array.isArray(r.body?.database?.tables)) return "no tables";
  return true;
});

await check("dev/status reports DB connected", async () => {
  const r = await get("/api/dev/status");
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.connections?.database) return "DB connection false";
  return true;
});

await check("dev/status reports an active semester", async () => {
  const r = await get("/api/dev/status");
  if (!r.body?.activeSemester) return { warn: "no active semester (ok if pre-semester)" };
  return true;
});

await check("dev/status currentWeekNumber is in [1, 20]", async () => {
  const r = await get("/api/dev/status");
  const w = r.body?.currentWeekNumber;
  if (w == null) return { warn: "no week (no semester start yet)" };
  if (w < 1 || w > 20) return `invalid week ${w} — Cat Lights would refuse to play`;
  return true;
});

await check("dev/build-info shows recommended restart cmd", async () => {
  const r = await get("/api/dev/build-info");
  if (!r.body?.recommendedRestart?.includes("pm2")) return "missing pm2 restart hint";
  return true;
});

await check("dev/trace returns array (may be empty)", async () => {
  const r = await get("/api/dev/trace");
  if (!Array.isArray(r.body?.steps)) return "no steps array";
  return true;
});

await check("dev/file-map returns summary (no crash)", async () => {
  const r = await get("/api/dev/file-map");
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.summary) return "no summary";
  return true;
});

await check("dev/onedrive-audit returns passed/failed lists", async () => {
  const r = await get("/api/dev/onedrive-audit");
  if (!r.ok) return `HTTP ${r.status}`;
  if (!Array.isArray(r.body?.passed) || !Array.isArray(r.body?.failed)) return "missing lists";
  if (r.body.failed.length > 0) return { warn: `${r.body.failed.length} courses failing audit — inspect /api/dev/onedrive-audit` };
  return true;
});

await check("dev/tts-ready does not have stuck files (warn only)", async () => {
  const r = await get("/api/dev/tts-ready");
  if (!r.ok) return `HTTP ${r.status}`;
  const stuck = (r.body?.rows || []).filter(f => f.extractedText && f.totalChunks > 0 && !f.preparedAt && !f.listened).length;
  if (stuck > 0) return { warn: `${stuck} files have extracted text + chunks but no preparedAt — AudioPrep may be stuck` };
  return true;
});

await check("dev/protected-systems lists Cat Lights", async () => {
  const r = await get("/api/dev/protected-systems");
  const names = (r.body?.systems || []).map(s => s.name).join(" | ");
  if (!/Cat Lights/i.test(names)) return "Cat Lights missing from protected list";
  return true;
});

await check("dev/handoff returns bundle with git + routes + tables", async () => {
  const r = await get("/api/dev/handoff");
  if (!r.ok) return `HTTP ${r.status}`;
  if (!r.body?.version || !r.body?.routes || !r.body?.database) return "incomplete bundle";
  return true;
});

await check("dev/patch rejects unknown find string", async () => {
  const r = await fetch(base + "/api/dev/patch", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ file: "docs/CODE_MAP.md", find: "__nonexistent_marker_zzz__", replace: "x" }),
  });
  if (r.status !== 404) return `expected 404, got ${r.status}`;
  return true;
});

await check("dev/patch rejects path escapes", async () => {
  const r = await fetch(base + "/api/dev/patch", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ file: "../../etc/passwd", find: "x", replace: "y" }),
  });
  if (r.status !== 400) return `expected 400, got ${r.status}`;
  return true;
});

console.log(`\n${pass} passed · ${warn} warnings · ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
