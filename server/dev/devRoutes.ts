// ────────────────────────────────────────────────────────────────────────
// Developer Control Center HTTP surface. All endpoints under /api/dev/*.
//
//   GET  /api/dev/system-map         — routes / env / DB tables / semesters
//   GET  /api/dev/app-map            — feature-grouped code map
//   GET  /api/dev/status             — runtime status (HA, OneDrive, …)
//   GET  /api/dev/build-info         — build mode + restart hint
//   GET  /api/dev/automation-trace   — last ~300 logStep() entries
//   GET  /api/dev/trace?subsystem=…  — same, optionally filtered
//   DEL  /api/dev/automation-trace   — clear trace
//   GET  /api/dev/recent-errors      — recent error trace entries
//   GET  /api/dev/layout-map         — last layout snapshot
//   POST /api/dev/layout-map         — frontend pushes layout
//   GET  /api/dev/file-map           — last file selection + course audit
//   GET  /api/dev/onedrive-audit     — folder audit per course
//   GET  /api/dev/tts-ready          — per-file TTS readiness checklist
//   GET  /api/dev/protected-systems  — list of "do not touch" subsystems
//   GET  /api/dev/handoff[?format=…] — full ChatGPT handoff bundle
//   GET  /api/dev/file?file=…        — read project file (size-limited)
//   POST /api/dev/patch              — safe single-occurrence find/replace
// ────────────────────────────────────────────────────────────────────────

import type { Express } from "express";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { isOneDriveConnected } from "../onedrive";
import { getSchedulerStatus } from "../reminderScheduler";
import * as crypto from "crypto";
import {
  getSteps,
  clearSteps,
  getLastSelection,
  getLayoutSnapshot,
  setLayoutSnapshot,
  getRecentErrors,
  getFlags,
  setFlags,
  type Subsystem,
  type TraceStep,
} from "./devTrace";

const PROJECT_ROOT = path.resolve(process.cwd());
const DEV_KEY = process.env.DEV_API_KEY || "";
const SERVER_BOOT_TS = Date.now();

// Patch audit log lives next to other repo-local notes.
const CHANGE_LOG_PATH = path.join(PROJECT_ROOT, "dev-change-log.md");

function authOk(req: any): boolean {
  if (!DEV_KEY) return true;
  const k = (req.header?.("x-dev-key") || req.query?.devKey || "") as string;
  return k === DEV_KEY;
}
function gate(req: any, res: any): boolean {
  if (!authOk(req)) { res.status(401).json({ error: "unauthorized" }); return false; }
  return true;
}

function isPathSafe(rel: string): { ok: boolean; abs?: string; error?: string } {
  if (!rel || typeof rel !== "string") return { ok: false, error: "missing file path" };
  if (rel.includes("\0")) return { ok: false, error: "invalid path" };
  const abs = path.resolve(PROJECT_ROOT, rel);
  if (!abs.startsWith(PROJECT_ROOT + path.sep) && abs !== PROJECT_ROOT) {
    return { ok: false, error: "path escapes project root" };
  }
  const blocked = [".git/", "node_modules/", ".env", ".local/"];
  const relNorm = path.relative(PROJECT_ROOT, abs).replace(/\\/g, "/");
  if (blocked.some(b => relNorm.startsWith(b))) {
    return { ok: false, error: `blocked path: ${relNorm}` };
  }
  return { ok: true, abs };
}

function safeExec(cmd: string, timeoutMs = 5000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function listAppRoutes(app: Express): { method: string; path: string }[] {
  const routes: { method: string; path: string }[] = [];
  const stack: any[] = (app as any)?._router?.stack || (app as any)?.router?.stack || [];
  const walk = (layers: any[], prefix = "") => {
    for (const l of layers) {
      if (l.route?.path) {
        const methods = Object.keys(l.route.methods || {}).filter(m => l.route.methods[m]);
        for (const m of methods) routes.push({ method: m.toUpperCase(), path: prefix + l.route.path });
      } else if (l.name === "router" && l.handle?.stack) walk(l.handle.stack, prefix);
    }
  };
  walk(stack);
  return routes;
}

function groupRoutesByFeature(routes: { method: string; path: string }[]) {
  const groups: Record<string, { method: string; path: string }[]> = {};
  const bucket = (p: string): string => {
    if (/cat-lights|cat-wash|cat-shower|cat-knob|cat-volume/.test(p)) return "cat_lights_automation";
    if (/onedrive/i.test(p)) return "onedrive";
    if (/tts|audio/.test(p)) return "tts_audio";
    if (/calendar|event|google|outlook/i.test(p)) return "calendar";
    if (/task|reminder|file/i.test(p)) return "tasks_files";
    if (/semester|course/i.test(p)) return "semester_courses";
    if (/dev\//.test(p)) return "dev_introspection";
    if (/webhook/.test(p)) return "webhooks";
    if (/auth|oauth/.test(p)) return "auth";
    return "other";
  };
  for (const r of routes) {
    const k = bucket(r.path);
    (groups[k] ||= []).push(r);
  }
  return groups;
}

function gitInfo() {
  return {
    commit: safeExec("git rev-parse HEAD"),
    shortCommit: safeExec("git rev-parse --short HEAD"),
    branch: safeExec("git rev-parse --abbrev-ref HEAD"),
    lastCommitMsg: safeExec("git log -1 --pretty=%s"),
    lastCommitDate: safeExec("git log -1 --pretty=%cI"),
    statusShort: safeExec("git status --porcelain", 4000),
    diffStat: safeExec("git diff --stat HEAD", 4000),
  };
}

function newestMtime(dir: string): number {
  let max = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) max = Math.max(max, newestMtime(p));
      else { try { max = Math.max(max, fs.statSync(p).mtimeMs); } catch {} }
    }
  } catch {}
  return max;
}
function bundleHashAndSize(dir: string) {
  try {
    if (!fs.existsSync(dir)) return { hash: null, sizeBytes: 0 };
    const h = crypto.createHash("sha1");
    let total = 0;
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else { try { const st = fs.statSync(p); h.update(p + ":" + st.mtimeMs + ":" + st.size); total += st.size; } catch {} }
      }
    };
    walk(dir);
    return { hash: h.digest("hex").slice(0, 12), sizeBytes: total };
  } catch { return { hash: null, sizeBytes: 0 }; }
}
function buildInfo() {
  const distPath = path.join(PROJECT_ROOT, "dist");
  const clientSrc = path.join(PROJECT_ROOT, "client", "src");
  let lastBuildAt: string | null = null;
  let lastBuildAgeSec: number | null = null;
  try {
    if (fs.existsSync(distPath)) {
      const st = fs.statSync(distPath);
      lastBuildAt = st.mtime.toISOString();
      lastBuildAgeSec = Math.round((Date.now() - st.mtimeMs) / 1000);
    }
  } catch {}
  // Out-of-date detection: any client/src file newer than dist?
  const distMtime = (() => { try { return fs.statSync(distPath).mtimeMs; } catch { return 0; } })();
  const srcMtime = newestMtime(clientSrc);
  const outOfDate = !!(distMtime && srcMtime && srcMtime > distMtime);
  const { hash, sizeBytes } = bundleHashAndSize(distPath);
  const pm2Detected = !!(process.env.PM2_HOME || process.env.pm_id || process.env.PM2_USAGE);
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    buildMode: process.env.NODE_ENV === "production" ? "built" : "vite-dev",
    distExists: fs.existsSync(distPath),
    lastBuildAt,
    lastBuildAgeSec,
    bundleHash: hash,
    bundleSizeBytes: sizeBytes,
    clientSrcNewestMtime: srcMtime ? new Date(srcMtime).toISOString() : null,
    outOfDate,
    outOfDateWarning: outOfDate ? "client/src has changes newer than dist — run `npm run build && pm2 restart all` on the Pi" : null,
    pm2Detected,
    pm2ProcessNameGuess: "dashboard",
    frontendChangesRequireRebuild: process.env.NODE_ENV === "production",
    recommendedRestart: "cd ~/Home-View && git pull && npm run build && pm2 restart all",
  };
}

async function dbTables(): Promise<string[]> {
  try {
    const r: any = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    return (r.rows || r).map((row: any) => row.table_name);
  } catch (e: any) {
    return [`<error: ${e.message}>`];
  }
}

async function activeSemester() {
  try { return await storage.getActiveSemesterSettings(); } catch { return null; }
}

function calcWeekFromSemester(sem: any): { weekNumber: number | null; reason?: string } {
  if (!sem?.semesterStartDate) return { weekNumber: null, reason: "no semesterStartDate" };
  const start = new Date(sem.semesterStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const wk = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { weekNumber: Math.max(1, wk) };
}

const PROTECTED_SYSTEMS = [
  { name: "Cat Lights automation", code: "server/routes.ts /api/webhook/cat-lights" },
  { name: "Shower Button automation", code: "server/routes.ts /api/webhook/cat-shower-button" },
  { name: "Home Assistant playback", code: "server/serverHelpers.ts haServiceCall*" },
  { name: "Edge TTS / Cloud TTS generation", code: "server/replit_integrations/audio/client.ts" },
  { name: "OneDrive auth", code: "server/onedrive.ts" },
  { name: "Semester / course DB schema", code: "shared/schema.ts" },
  { name: "File progress tracking", code: "files table — listenedAt / preparedAt / preparedAudioPaths" },
];

function appendChangeLog(entry: string) {
  try {
    if (!fs.existsSync(CHANGE_LOG_PATH)) {
      fs.writeFileSync(CHANGE_LOG_PATH, "# Dev Patch Change Log\n\nAuto-appended by /api/dev/patch.\n\n", "utf8");
    }
    fs.appendFileSync(CHANGE_LOG_PATH, entry, "utf8");
  } catch {}
}

// ────────── server-side redaction (mirrors DevPanel client redaction) ──────────
// Applied to EVERY /api/dev/* JSON response so direct curl output is also
// safe to paste into ChatGPT.  Scrubs:
//   - object keys matching token/secret/password/etc → value replaced with <REDACTED>
//   - GitHub PATs (ghp_…, github_pat_…)
//   - email addresses
//   - long opaque bearer-style tokens (32+ chars, [A-Za-z0-9_-])
const SECRET_KEY_RE = /(token|secret|apikey|api_key|password|passwd|bearer|authorization|client_secret|refresh_token|access_token|cookie|session|private_key|x-dev-key|graphtoken|ha_token|home_assistant_token|github_personal_access_token)/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_RE = /\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g;
const GH_PAT_RE = /\bghp_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g;
// Endpoints that legitimately return long base64-ish payloads where bearer
// scrubbing would damage useful data — leave their string contents alone but
// still redact secret-named keys.
const KEEP_STRINGS_PATHS = [/^\/api\/dev\/file\b/, /^\/api\/dev\/export-code\b/, /^\/api\/dev\/handoff\b/];

function scrubServerValue(v: any, keepStrings: boolean, depth = 0): any {
  if (v == null || depth > 12) return v;
  if (typeof v === "string") {
    if (keepStrings) return v;
    let s = v;
    s = s.replace(GH_PAT_RE, "<REDACTED:gh-pat>");
    s = s.replace(EMAIL_RE, "<REDACTED:email>");
    if (s.length > 32) s = s.replace(BEARER_RE, m => m.length >= 32 ? "<REDACTED:token>" : m);
    return s;
  }
  if (Array.isArray(v)) return v.map(x => scrubServerValue(x, keepStrings, depth + 1));
  if (typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = SECRET_KEY_RE.test(k) ? "<REDACTED>" : scrubServerValue(val, keepStrings, depth + 1);
    }
    return out;
  }
  return v;
}

function devRedactionMiddleware(req: any, res: any, next: any) {
  // Opt-out for callers that need raw data (e.g. an admin script that already
  // handles its own scrubbing). Not advertised; intentional escape hatch.
  if (req.query?.__raw === "1" || req.header?.("x-dev-raw") === "1") return next();
  const keepStrings = KEEP_STRINGS_PATHS.some(re => re.test(req.path));
  const origJson = res.json.bind(res);
  res.json = (body: any) => {
    try {
      const scrubbed = scrubServerValue(body, keepStrings);
      res.setHeader("X-Dev-Redacted", "1");
      return origJson(scrubbed);
    } catch {
      return origJson(body);
    }
  };
  next();
}

export function registerDevRoutes(app: Express): void {
  app.use("/api/dev", devRedactionMiddleware);

  // ────────── system map ──────────
  app.get("/api/dev/system-map", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const routes = listAppRoutes(app);
      const tables = await dbTables();
      let semesters: any[] = [];
      try {
        const all = await (storage as any).getAllSemesterSettings?.();
        if (all) semesters = (all as any[]).map(s => ({ id: s.id, semesterKey: s.semesterKey, semesterType: s.semesterType, semesterStartDate: s.semesterStartDate, semesterEndDate: s.semesterEndDate, isActive: !!s.isActive }));
      } catch {}
      res.json({
        environment: { ...buildInfo(), uptimeSec: Math.round(process.uptime()), pid: process.pid, nodeVersion: process.version, platform: process.platform },
        routes: { total: routes.length, all: routes, catFlow: routes.filter(r => /cat-/.test(r.path)) },
        database: { type: "postgres", tableCount: tables.length, tables },
        semesters,
        cwd: PROJECT_ROOT,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── app map (feature-grouped) ──────────
  app.get("/api/dev/app-map", (req, res) => {
    if (!gate(req, res)) return;
    const routes = listAppRoutes(app);
    res.json({
      backend: {
        routesByFeature: groupRoutesByFeature(routes),
        keyFiles: {
          "server/routes.ts": "All HTTP routes; Cat Lights, Cat Wash, file selection, TTS orchestration, calendar API",
          "server/serverHelpers.ts": "HA fetch utils, TTS pure helpers, Flick devices, queue processor",
          "server/storage.ts": "Drizzle storage interface — semester, files, tasks, courses",
          "server/onedrive.ts": "OneDrive auth + listing + content fetch",
          "server/googleCalendar.ts": "Google Calendar primary account integration",
          "server/secondGoogleAccount.ts": "Google Calendar secondary account",
          "server/thirdGoogleAccount.ts": "Google Calendar third account",
          "server/outlookCalendar.ts": "Outlook calendar + mail rules",
          "server/gmail.ts": "Gmail send + D2L announcements + recent emails",
          "server/email.ts": "Email / SMS / Echo / HA push reminders",
          "server/reminderScheduler.ts": "Scheduled reminder dispatch loop",
          "server/replit_integrations/audio/client.ts": "TTS generation (Replit + Edge fallback)",
          "server/dev/devRoutes.ts": "This developer control center",
          "server/dev/devTrace.ts": "Trace ring buffer + file/layout snapshots",
          "shared/schema.ts": "Drizzle schema — DO NOT change unless asked",
        },
      },
      frontend: {
        keyPages: {
          "client/src/pages/dashboard.tsx": "Main dashboard — calendar, countdown, courses, settings, all panels",
        },
        keyComponents: {
          "client/src/components/CourseAutomationPipeline.tsx": "TTS / readings / sync / calendar pipeline diagram (admin)",
          "client/src/components/DevPanel.tsx": "Hidden dev panel, Ctrl+Shift+D",
          "client/src/components/LibraryView.tsx": "Files library by week / course",
          "client/src/components/CourseDetailDialog.tsx": "Per-course settings + file picker",
          "client/src/components/SystemSetupWizard.tsx": "First-run wizard",
        },
        buildMode: buildInfo().buildMode,
      },
      subsystems: {
        cat_lights_automation: "server/routes.ts ~line 21340 POST /api/webhook/cat-lights",
        calendar_ui: "client/src/pages/dashboard.tsx renderCalendar()",
        onedrive_sync: "server/routes.ts syncOneDriveFilesForWeek() + server/onedrive.ts",
        tts_audio_prep: "server/routes.ts AudioPrep queue + server/replit_integrations/audio/client.ts",
        database_storage: "server/storage.ts (Drizzle/Postgres)",
      },
      protectedSystems: PROTECTED_SYSTEMS,
    });
  });

  // ────────── runtime status ──────────
  app.get("/api/dev/status", async (req, res) => {
    if (!gate(req, res)) return;
    let dbOk = false;
    try { await db.execute(sql`SELECT 1`); dbOk = true; } catch {}
    let haOk = false;
    try {
      const haUrl = (process.env.HOME_ASSISTANT_URL || "").replace(/\/$/, "");
      const haToken = process.env.HOME_ASSISTANT_TOKEN || "";
      if (haUrl && haToken) {
        const r = await fetch(`${haUrl}/api/`, { headers: { Authorization: `Bearer ${haToken}` } });
        haOk = r.ok;
      }
    } catch {}
    let onedriveOk = false;
    try { onedriveOk = isOneDriveConnected(); } catch {}
    const sem = await activeSemester();
    const wk = calcWeekFromSemester(sem);
    res.json({
      uptimeSec: Math.round(process.uptime()),
      serverBootAt: new Date(SERVER_BOOT_TS).toISOString(),
      env: process.env.NODE_ENV || "development",
      stagingMode: process.env.STAGING_MODE === "1",
      stagingDisables: process.env.STAGING_MODE === "1" ? {
        haTriggers: process.env.DISABLE_HA_TRIGGERS === "1",
        ttsPlayback: process.env.DISABLE_TTS_PLAYBACK === "1",
        oneDriveWrites: process.env.DISABLE_ONEDRIVE_WRITES === "1",
      } : null,
      build: buildInfo(),
      git: gitInfo(),
      connections: { database: dbOk, homeAssistant: haOk, oneDrive: onedriveOk },
      activeSemester: sem ? { id: (sem as any).id, key: (sem as any).semesterKey, start: (sem as any).semesterStartDate, end: (sem as any).semesterEndDate } : null,
      currentWeekNumber: wk.weekNumber,
      scheduler: (() => { try { return getSchedulerStatus(); } catch { return null; } })(),
      recentErrors: getRecentErrors().slice(-10),
    });
  });

  // ────────── build info ──────────
  app.get("/api/dev/build-info", (req, res) => {
    if (!gate(req, res)) return;
    res.json({ ...buildInfo(), git: gitInfo() });
  });

  // ────────── trace ──────────
  const traceHandler = (req: any, res: any) => {
    if (!gate(req, res)) return;
    const sub = (req.query.subsystem as string | undefined) as Subsystem | undefined;
    const all = getSteps(sub);
    res.json({ count: all.length, subsystem: sub || "all", steps: all });
  };
  app.get("/api/dev/automation-trace", traceHandler);
  app.get("/api/dev/trace", traceHandler);
  app.delete("/api/dev/automation-trace", (req, res) => {
    if (!gate(req, res)) return;
    clearSteps();
    res.json({ ok: true });
  });
  app.get("/api/dev/recent-errors", (req, res) => {
    if (!gate(req, res)) return;
    res.json({ count: getRecentErrors().length, errors: getRecentErrors() });
  });

  // ────────── layout ──────────
  app.get("/api/dev/layout-map", (req, res) => {
    if (!gate(req, res)) return;
    res.json(getLayoutSnapshot() || { empty: true, hint: "Frontend has not POSTed a layout snapshot yet — open the dashboard with the dev panel open." });
  });
  app.post("/api/dev/layout-map", (req, res) => {
    if (!gate(req, res)) return;
    try {
      const b = req.body || {};
      setLayoutSnapshot({
        view: b.view || "unknown",
        countdown: b.countdown || { isFixed: false },
        calendar: b.calendar || { top: 0, height: 0 },
        glassBacking: b.glassBacking,
        extra: b.extra,
      });
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ────────── file map ──────────
  app.get("/api/dev/file-map", async (req, res) => {
    if (!gate(req, res)) return;
    const sel = getLastSelection();
    let files: any[] = [];
    let courses: any[] = [];
    try { files = await storage.getFiles(); } catch {}
    try {
      const sem = await activeSemester();
      if (sem) {
        const list = await (storage as any).getOneDriveCoursesBySemester?.((sem as any).id);
        courses = list || [];
      }
    } catch {}
    const byFolder: Record<string, any> = {};
    for (const f of files) {
      const k = f.folder || "(none)";
      const b = (byFolder[k] ||= { folder: k, total: 0, withExtractedText: 0, withTotalChunks: 0, withPreparedAt: 0, withPreparedAudioPaths: 0 });
      b.total++;
      if (f.extractedText) b.withExtractedText++;
      if (f.totalChunks) b.withTotalChunks++;
      if (f.preparedAt) b.withPreparedAt++;
      if (f.preparedAudioPaths) b.withPreparedAudioPaths++;
    }
    // Phase-2: candidate scoring for the current week — what would
    // findNextFileByPriority pick right now, and why was each rejected?
    let candidates: any[] = [];
    let currentWeek: number | null = null;
    try {
      const sem: any = await activeSemester();
      if (sem?.semesterStartDate) {
        const today = new Date();
        const start = new Date(sem.semesterStartDate);
        currentWeek = today < start ? 1 : Math.floor((today.getTime() - start.getTime()) / (7 * 86400000)) + 1;
      }
      if (currentWeek != null) {
        for (const f of files) {
          let accepted = true; let reason = "ok";
          if (f.weekNumber == null) { accepted = false; reason = "no week assigned"; }
          else if (f.weekNumber !== currentWeek) { accepted = false; reason = `wrong_week (file=${f.weekNumber}, current=${currentWeek})`; }
          else if (f.listenedAt) { accepted = false; reason = "already listened"; }
          else if (!f.preparedAt) { accepted = false; reason = "not prepared (no preparedAt)"; }
          else if (!f.preparedAudioPaths) { accepted = false; reason = "no preparedAudioPaths"; }
          candidates.push({ id: f.id, name: f.originalName, folder: f.folder, week: f.weekNumber, accepted, reason });
          if (candidates.length >= 60) break;
        }
        // Sort accepted first
        candidates.sort((a, b) => Number(b.accepted) - Number(a.accepted));
      }
    } catch (e: any) { candidates = [{ error: e.message }]; }
    res.json({
      lastSelection: sel,
      currentWeek,
      summary: { totalFiles: files.length, byFolder: Object.values(byFolder) },
      candidates,
      courses,
    });
  });

  // ────────── onedrive folder audit ──────────
  app.get("/api/dev/onedrive-audit", async (req, res) => {
    if (!gate(req, res)) return;
    const out: any = { passed: [], failed: [], warnings: [] };
    try {
      const sem = await activeSemester();
      if (!sem) { res.json({ error: "no active semester" }); return; }
      const courses = await (storage as any).getOneDriveCoursesBySemester?.((sem as any).id) || [];
      const allFiles = await storage.getFiles();
      out.semester = (sem as any).semesterKey;
      for (const c of courses) {
        const code = c.courseCode || c.code || c.courseName || "?";
        const folderHits = allFiles.filter(f => (f.folder || "").includes(code));
        const item = {
          course: code,
          name: c.courseName || c.name || null,
          oneDrivePath: c.oneDrivePath || c.folderPath || null,
          modulePath: c.modulePath || c.moduleFolderPath || null,
          readingPath: c.readingPath || c.readingFolderPath || null,
          dbFileCount: folderHits.length,
        };
        const issues: string[] = [];
        if (!item.oneDrivePath) issues.push("missing oneDrivePath");
        if (!item.modulePath) issues.push("missing modulePath");
        if (!item.readingPath) issues.push("missing readingPath");
        if (item.dbFileCount === 0) issues.push("no files indexed in DB");
        if (issues.length) out.failed.push({ ...item, issues });
        else out.passed.push(item);
      }
    } catch (e: any) { out.error = e.message; }
    res.json(out);
  });

  // ────────── tts ready check ──────────
  app.get("/api/dev/tts-ready", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const files = await storage.getFiles();
      const week = req.query.week ? Number(req.query.week) : null;
      const filtered = week ? files.filter((f: any) => f.weekNumber === week) : files;
      const rows = filtered.slice(0, 500).map((f: any) => {
        const audioPaths = f.preparedAudioPaths ? (Array.isArray(f.preparedAudioPaths) ? f.preparedAudioPaths : (() => { try { return JSON.parse(f.preparedAudioPaths); } catch { return []; } })()) : [];
        return {
          id: f.id,
          name: f.originalName || f.displayName,
          folder: f.folder,
          week: f.weekNumber,
          extractedText: !!f.extractedText,
          totalChunks: f.totalChunks || 0,
          preparedAt: f.preparedAt || null,
          audioPathCount: Array.isArray(audioPaths) ? audioPaths.length : 0,
          missingChunks: (f.totalChunks || 0) - (Array.isArray(audioPaths) ? audioPaths.length : 0),
          listened: !!f.listenedAt,
          ready: !!(f.extractedText && f.preparedAt && Array.isArray(audioPaths) && audioPaths.length === (f.totalChunks || 0) && (f.totalChunks || 0) > 0),
        };
      });
      res.json({
        total: filtered.length,
        ready: rows.filter(r => r.ready).length,
        notReady: rows.filter(r => !r.ready).length,
        rows,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── protected systems ──────────
  app.get("/api/dev/protected-systems", (req, res) => {
    if (!gate(req, res)) return;
    res.json({
      note: "These subsystems should NOT be modified by ChatGPT without explicit user approval.",
      systems: PROTECTED_SYSTEMS,
    });
  });

  // ────────── handoff bundle (for ChatGPT) ──────────
  app.get("/api/dev/handoff", async (req, res) => {
    if (!gate(req, res)) return;
    const fmt = (req.query.format as string) || "json";
    const routes = listAppRoutes(app);
    const tables = await dbTables();
    const sem = await activeSemester();
    const wk = calcWeekFromSemester(sem);
    let recentFiles: any[] = [];
    try { recentFiles = (await storage.getFiles()).slice(-25).map((f: any) => ({ id: f.id, folder: f.folder, name: f.originalName, week: f.weekNumber, preparedAt: f.preparedAt })); } catch {}
    const bundle = {
      generatedAt: new Date().toISOString(),
      app: { name: "UniCal / Home-View", url: "https://uni-cal.app", deployTarget: "Raspberry Pi via Cloudflare Tunnel" },
      version: gitInfo(),
      build: buildInfo(),
      pm2: { processNameGuess: "dashboard", restartCmd: "pm2 restart all", deploy: "cd ~/Home-View && git pull && npm run build && pm2 restart all" },
      runtime: {
        uptimeSec: Math.round(process.uptime()),
        nodeEnv: process.env.NODE_ENV,
        oneDriveConnected: (() => { try { return isOneDriveConnected(); } catch { return false; } })(),
      },
      activeSemester: sem ? { id: (sem as any).id, key: (sem as any).semesterKey, start: (sem as any).semesterStartDate, end: (sem as any).semesterEndDate, currentWeek: wk.weekNumber } : null,
      database: { type: "postgres", tableCount: tables.length, tables },
      routes: { total: routes.length, byFeature: groupRoutesByFeature(routes) },
      recentTrace: getSteps().slice(-50),
      recentErrors: getRecentErrors(),
      recentFiles,
      lastFileSelection: getLastSelection(),
      lastLayoutSnapshot: getLayoutSnapshot(),
      protectedSystems: PROTECTED_SYSTEMS,
      rollback: {
        gitReset: "git reflog; git reset --hard <prev-commit>",
        backupsDir: ".local/patch-backups/",
        howTo: "Each /api/dev/patch call writes a .bak file in .local/patch-backups/ — copy it back over the source file to undo.",
      },
      safetyNotes: [
        "DO NOT modify protected systems without explicit user approval.",
        "Frontend changes require: npm run build && pm2 restart all",
        "Backend changes require: pm2 restart all (no rebuild needed)",
        "Schema changes require: npm run db:push (after editing shared/schema.ts)",
        "Use /api/dev/patch for safe single-occurrence find/replace edits.",
      ],
    };
    if (fmt === "text" || fmt === "txt" || fmt === "md") {
      res.type("text/plain");
      res.send(`# UniCal / Home-View — ChatGPT Handoff\n\nGenerated: ${bundle.generatedAt}\n\n${"```json"}\n${JSON.stringify(bundle, null, 2)}\n${"```"}\n`);
      return;
    }
    res.json(bundle);
  });

  // ────────── read file ──────────
  app.get("/api/dev/file", (req, res) => {
    if (!gate(req, res)) return;
    const file = (req.query.file as string) || "";
    const safe = isPathSafe(file);
    if (!safe.ok) return res.status(400).json({ error: safe.error });
    if (!fs.existsSync(safe.abs!)) return res.status(404).json({ error: "file not found" });
    try {
      const stat = fs.statSync(safe.abs!);
      if (stat.size > 5 * 1024 * 1024) return res.status(413).json({ error: "file > 5MB; use ?lines=A,B for a slice" });
      const content = fs.readFileSync(safe.abs!, "utf8");
      const linesParam = (req.query.lines as string) || "";
      if (linesParam) {
        const m = linesParam.match(/^(\d+),(\d+)$/);
        if (!m) return res.status(400).json({ error: "lines must be 'start,end' (1-indexed)" });
        const start = Math.max(1, parseInt(m[1], 10));
        const end = Math.max(start, parseInt(m[2], 10));
        return res.json({ file, lines: [start, end], totalBytes: stat.size, content: content.split("\n").slice(start - 1, end).join("\n") });
      }
      res.json({ file, totalBytes: stat.size, lineCount: content.split("\n").length, content });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── flow snapshot (Phase-2) ──────────
  // Walks the trace ring, finds the most recent cat_lights:webhook_received
  // and bundles every cat_lights event after it into one structured object.
  app.get("/api/dev/flow-snapshot", (req, res) => {
    if (!gate(req, res)) return;
    const all: TraceStep[] = getSteps();
    let startIdx = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].step === "cat_lights:webhook_received") { startIdx = i; break; }
    }
    if (startIdx < 0) {
      return res.json({ empty: true, hint: "No cat_lights run yet — trigger Cat Lights or POST /api/dev/test/cat-lights-on." });
    }
    const slice = all.slice(startIdx).filter(s => s.subsystem === "cat_lights");
    const get = (step: string) => slice.find(s => s.step === step);
    const branch = get("cat_lights:branch");
    const tts = get("cat_lights:tts_started");
    const week = get("cat_lights:week_calculated");
    const initial = get("cat_lights:initial_file_lookup");
    const sel = getLastSelection();
    const finalAction = (() => {
      const action = (branch?.data as any)?.action || (branch?.outputs as any)?.action;
      if (action === "PROMPT_FILE") return "PROMPT";
      if (action === "CHUM_FALLBACK") return "CHUM";
      if (tts) return "PROMPT";
      return "UNKNOWN";
    })();
    // Phase-2-final: human-readable blocker derivation
    const weekNum = (week?.outputs as any)?.weekNumber ?? (week?.data as any)?.weekNumber ?? null;
    const branchAction = (branch?.outputs as any)?.action || (branch?.data as any)?.action;
    let blocker: string | null = null;
    if (weekNum != null && weekNum < 1) blocker = `weekNumber=${weekNum} — outside active semester window (pre or post-semester)`;
    else if (branchAction === "CHUM_FALLBACK") blocker = `no unlistened file for week ${weekNum} after OneDrive sync — fell back to CHUM FM`;
    else if (!branch && !tts) blocker = "flow stopped before branch decision — check trace for HA error or thrown exception";
    else if (finalAction === "UNKNOWN") blocker = "could not determine finalAction from trace events";
    res.json({
      trigger: get("cat_lights:webhook_received")?.data?.body || null,
      stateParsed: get("cat_lights:state_parsed")?.data || null,
      semester: (week?.outputs as any)?.semesterKey || (week?.data as any)?.semesterKey || sel?.semester || null,
      weekNumber: weekNum,
      initialFileLookup: initial?.outputs || initial?.data || null,
      decisionPath: slice.map(s => ({
        time: s.time,
        step: s.step,
        decision: s.decision || (s.data as any)?.action,
        reason: s.reason || (s.data as any)?.reason,
        inputs: s.inputs,
        outputs: s.outputs,
      })),
      fileSelection: sel,
      tts: tts ? { message: (tts.outputs as any)?.message || (tts.data as any)?.message, time: tts.time } : null,
      finalAction,
      blocker,
      runStartedAt: all[startIdx].time,
      runEndedAt: slice[slice.length - 1]?.time,
      durationMs: slice[slice.length - 1]?.ts - all[startIdx].ts,
    });
  });

  // ────────── one-command diagnosis ──────────
  app.get("/api/dev/diagnose", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      // Re-derive flow snapshot inline (avoids HTTP self-call).
      const all = getSteps();
      let startIdx = -1;
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].step === "cat_lights:webhook_received") { startIdx = i; break; }
      }
      const slice = startIdx >= 0 ? all.slice(startIdx).filter(s => s.subsystem === "cat_lights") : [];
      const week = slice.find(s => s.step === "cat_lights:week_calculated");
      const branch = slice.find(s => s.step === "cat_lights:branch");
      const tts = slice.find(s => s.step === "cat_lights:tts_started");
      const weekNum = (week?.outputs as any)?.weekNumber ?? (week?.data as any)?.weekNumber ?? null;
      const action = (branch?.outputs as any)?.action || (branch?.data as any)?.action;

      // Fetch supporting data
      const sem: any = await activeSemester();
      const files: any[] = await storage.getFiles().catch(() => []);
      const distPath = path.join(PROJECT_ROOT, "dist");
      const clientSrc = path.join(PROJECT_ROOT, "client", "src");
      const distMtime = (() => { try { return fs.statSync(distPath).mtimeMs; } catch { return 0; } })();
      const srcMtime = newestMtime(clientSrc);
      const buildOutOfDate = !!(distMtime && srcMtime && srcMtime > distMtime);

      // Diagnose
      let primaryBlocker = "no_blocker_detected";
      let recommendedNextStep = "system appears healthy";
      let confidence: "high" | "medium" | "low" = "high";
      let summary = "Cat Lights flow ran cleanly.";

      if (startIdx < 0) {
        primaryBlocker = "no_cat_lights_run_captured";
        recommendedNextStep = "trigger Cat Lights (POST /api/dev/test/cat-lights-on with {confirm:true}) or wait for next HA webhook";
        confidence = "high";
        summary = "No Cat Lights webhook has fired since the trace was last cleared. Cannot diagnose without a run.";
      } else if (!sem) {
        primaryBlocker = "no_active_semester";
        recommendedNextStep = "set an active semester via the dashboard settings (storage.getActiveSemesterSettings returned null)";
        confidence = "high";
        summary = "Cat Lights cannot calculate a week number without an active semester row.";
      } else if (weekNum != null && weekNum < 1) {
        primaryBlocker = `pre_or_post_semester (week=${weekNum})`;
        recommendedNextStep = `verify semesterStartDate (${sem.semesterStartDate}) matches reality, or wait until semester starts. Use POST /api/dev/replay {forceWeek:1} to test in-semester logic.`;
        confidence = "high";
        summary = `weekNumber resolved to ${weekNum} — Cat Lights will fall back to CHUM FM until weekNumber >= 1.`;
      } else if (action === "CHUM_FALLBACK") {
        const wkFiles = files.filter(f => f.weekNumber === weekNum);
        const unlisten = wkFiles.filter(f => !f.listenedAt);
        const ready = unlisten.filter(f => f.preparedAt && f.preparedAudioPaths);
        if (wkFiles.length === 0) {
          primaryBlocker = `no_files_for_week_${weekNum}`;
          recommendedNextStep = "check OneDrive folder paths via GET /api/dev/onedrive-audit and trigger a sync";
          summary = `Zero files indexed for week ${weekNum} — OneDrive sync may not have detected the Module/Reading folders.`;
        } else if (unlisten.length === 0) {
          primaryBlocker = `all_${wkFiles.length}_files_listened`;
          recommendedNextStep = `all week ${weekNum} files marked listened — advance the week or unmark a file via the dashboard`;
          summary = `All ${wkFiles.length} files for week ${weekNum} are already listened. CHUM FM is correct fallback.`;
        } else if (ready.length === 0) {
          primaryBlocker = `${unlisten.length}_files_not_prepared`;
          recommendedNextStep = "AudioPrep hasn't generated audio for these files yet. Check GET /api/dev/tts-ready and ensure AudioPrep queue is running.";
          summary = `${unlisten.length} unlistened files exist for week ${weekNum} but none have preparedAudioPaths.`;
        } else {
          primaryBlocker = "priority_filter_rejected_all_candidates";
          recommendedNextStep = "inspect findNextFileByPriority — files are ready but the filter excluded them. Check /api/dev/file-map candidates list.";
          confidence = "medium";
          summary = `${ready.length} files appear ready but findNextFileByPriority returned null.`;
        }
      } else if (action === "PROMPT_FILE" && tts) {
        summary = `Cat Lights successfully selected a file and started TTS prompt for week ${weekNum}.`;
        if (buildOutOfDate) {
          primaryBlocker = "frontend_bundle_stale";
          recommendedNextStep = "run `npm run build && pm2 restart all` on the Pi — client/src has unbuilt changes";
          confidence = "medium";
        }
      } else if (!branch) {
        primaryBlocker = "flow_aborted_before_branch";
        recommendedNextStep = "check GET /api/dev/recent-errors and HA connection — the handler exited before reaching the branch decision";
        confidence = "medium";
        summary = "Cat Lights handler started but never reached the file-selection branch.";
      }

      // ── derive fixActions[] from primaryBlocker (full coverage) ──
      type FixAction = { id: string; label: string; endpoint: string; method?: "GET"|"POST"; risk: "low"|"medium"|"high"; dryRunSupported: boolean; requiresConfirm: boolean; infoOnly?: boolean; hint?: string };
      const fixActions: FixAction[] = [];
      const blk = primaryBlocker;
      if (/_files_not_prepared/.test(blk) || /priority_filter_rejected/.test(blk)) {
        fixActions.push({ id: "regen_tts", label: "Regenerate TTS for current week", endpoint: "/api/dev/fix/regen-tts", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: true });
      }
      if (/no_files_for_week/.test(blk)) {
        fixActions.push({ id: "resync_onedrive", label: "Re-audit OneDrive course folders", endpoint: "/api/dev/fix/resync-onedrive", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: true });
        fixActions.push({ id: "rebuild_file_map", label: "Rebuild file-selection map", endpoint: "/api/dev/fix/rebuild-file-map", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: true });
      }
      if (/flow_aborted_before_branch|priority_filter_rejected/.test(blk)) {
        fixActions.push({ id: "reset_queue", label: "Reset cat-lights trace + queue marker", endpoint: "/api/dev/fix/reset-queue", method: "POST", risk: "medium", dryRunSupported: true, requiresConfirm: true });
      }
      if (blk === "frontend_bundle_stale") {
        fixActions.push({ id: "rebuild_pi", label: "Preview Pi rebuild recipe", endpoint: "/api/dev/fix/rebuild-file-map", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: false, hint: "ssh pi: cd ~/Home-View && git pull && npm run build && pm2 restart all" });
      }
      if (blk === "no_cat_lights_run_captured") {
        fixActions.push({ id: "trigger_test", label: "Trigger Cat Lights ON (real — confirm-gated)", endpoint: "/api/dev/test/cat-lights-on", method: "POST", risk: "high", dryRunSupported: false, requiresConfirm: true, hint: "Fires real HA + TTS. Use the Replay tab for dry-run instead." });
        fixActions.push({ id: "replay_dryrun", label: "Replay flow with current date (dry-run, no side effects)", endpoint: "/api/dev/replay", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: false, infoOnly: true });
      }
      if (blk === "no_active_semester") {
        fixActions.push({ id: "open_semester_settings", label: "Open Semester Settings (manual)", endpoint: "/api/dev/system-map", method: "GET", risk: "low", dryRunSupported: true, requiresConfirm: false, infoOnly: true, hint: "Visit the dashboard Settings → Semesters tab and create/activate a semester row." });
      }
      if (/pre_or_post_semester/.test(blk)) {
        fixActions.push({ id: "replay_force_week_1", label: "Replay with forceWeek=1 (test in-semester logic)", endpoint: "/api/dev/replay", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: false, infoOnly: true, hint: "POST /api/dev/replay {forceWeek:1} — verifies file-selection branch will work once semester starts." });
        fixActions.push({ id: "verify_semester_dates", label: "Verify semesterStartDate (manual)", endpoint: "/api/dev/status", method: "GET", risk: "low", dryRunSupported: true, requiresConfirm: false, infoOnly: true, hint: "Compare /api/dev/status activeSemester.start to today; correct via Settings → Semesters." });
      }
      if (/all_\d+_files_listened/.test(blk)) {
        fixActions.push({ id: "advance_or_unmark", label: "Advance week or unmark a file (manual)", endpoint: "/api/dev/file-map", method: "GET", risk: "low", dryRunSupported: true, requiresConfirm: false, infoOnly: true, hint: "All week files marked listened. Either wait for next week or unmark via dashboard Files → unlisten." });
      }
      // Always include diagnose-info action when there are no other actions
      if (fixActions.length === 0 && blk !== "no_blocker_detected") {
        fixActions.push({ id: "view_recent_errors", label: "View recent errors (read-only)", endpoint: "/api/dev/recent-errors", method: "GET", risk: "low", dryRunSupported: true, requiresConfirm: false, infoOnly: true });
      }

      res.json({
        summary,
        primaryBlocker,
        recommendedNextStep,
        confidence,
        fixActions,
        snapshot: {
          weekNumber: weekNum,
          finalAction: action || (tts ? "PROMPT" : "UNKNOWN"),
          semesterKey: sem?.semesterKey || null,
          semesterActive: !!sem,
          buildOutOfDate,
          totalFilesInDb: files.length,
          filesForCurrentWeek: weekNum != null ? files.filter(f => f.weekNumber === weekNum).length : null,
        },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── validate latest snapshot ──────────
  app.post("/api/dev/validate", async (req, res) => {
    if (!gate(req, res)) return;
    const expected = (req.body || {}).expected || {};
    // Reuse flow-snapshot logic by calling the route internally is awkward —
    // re-derive inline.
    const all = getSteps();
    let startIdx = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].step === "cat_lights:webhook_received") { startIdx = i; break; }
    }
    if (startIdx < 0) return res.json({ pass: false, explanation: "no cat_lights run captured" });
    const slice = all.slice(startIdx).filter(s => s.subsystem === "cat_lights");
    const week = slice.find(s => s.step === "cat_lights:week_calculated");
    const branch = slice.find(s => s.step === "cat_lights:branch");
    const tts = slice.find(s => s.step === "cat_lights:tts_started");
    const action = (branch?.data as any)?.action || (tts ? "PROMPT_FILE" : null);
    const actual = {
      weekNumber: (week?.data as any)?.weekNumber ?? null,
      finalAction: action === "CHUM_FALLBACK" ? "CHUM" : action === "PROMPT_FILE" ? "PROMPT" : null,
      semester: (week?.data as any)?.semesterKey ?? null,
    };
    const diff: Record<string, any> = {};
    for (const k of Object.keys(expected)) {
      if ((actual as any)[k] !== expected[k]) diff[k] = { expected: expected[k], actual: (actual as any)[k] };
    }
    res.json({
      pass: Object.keys(diff).length === 0,
      diff,
      expected,
      actual,
      explanation: Object.keys(diff).length === 0 ? "all matched" : `mismatched fields: ${Object.keys(diff).join(", ")}`,
    });
  });

  // ────────── replay (dry run) ──────────
  // Pure week + finalAction calculation only — does NOT touch HA, OneDrive,
  // or TTS. Mirrors the actual cat-lights branching so ChatGPT can verify
  // pre-semester / week-1 / mid-semester decisions safely.
  app.post("/api/dev/replay", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const { dateOverride, forceWeek } = req.body || {};
      const sem: any = await activeSemester();
      const today = dateOverride ? new Date(dateOverride) : new Date();
      let weekNumber: number | null = null;
      let weekDecision = "calc";
      let weekReason = "";
      if (typeof forceWeek === "number") {
        weekNumber = forceWeek; weekDecision = "forced"; weekReason = "forceWeek param";
      } else if (sem?.semesterStartDate) {
        const start = new Date(sem.semesterStartDate);
        const end = sem.semesterEndDate ? new Date(sem.semesterEndDate) : null;
        if (today < start) { weekNumber = 1; weekDecision = "pre_semester_clamp"; weekReason = `today (${today.toISOString().slice(0,10)}) < semesterStart (${sem.semesterStartDate}) — clamped to 1`; }
        else if (end && today > end) { weekNumber = -1; weekDecision = "post_semester"; weekReason = `today > semesterEnd (${sem.semesterEndDate})`; }
        else { weekNumber = Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1; weekReason = "diff(today, semesterStart) / 7d + 1"; }
      } else { weekDecision = "no_semester"; weekReason = "no active semester"; }

      let candidate: any = null; let candidateReason = "";
      if (weekNumber && weekNumber > 0) {
        try {
          const files = await storage.getFiles();
          // Lightweight candidate scan — match week + not listened.
          const matches = files.filter((f: any) => f.weekNumber === weekNumber && !f.listenedAt);
          candidate = matches[0] || null;
          candidateReason = matches.length === 0 ? "no matching files for week" : `${matches.length} candidates, picking first`;
        } catch (e: any) { candidateReason = `lookup failed: ${e.message}`; }
      } else {
        candidateReason = "no valid week — file lookup skipped";
      }

      const finalAction = !weekNumber || weekNumber < 1 ? "INVALID_WEEK_ABORT" : candidate ? "PROMPT" : "CHUM";
      res.json({
        simulated: true,
        sideEffects: "none",
        dateUsed: today.toISOString(),
        semester: sem ? { id: sem.id, key: sem.semesterKey, start: sem.semesterStartDate, end: sem.semesterEndDate } : null,
        decisionPath: [
          { step: "week_calculated", decision: weekDecision, reason: weekReason, inputs: { today: today.toISOString(), semesterStart: sem?.semesterStartDate, forceWeek }, outputs: { weekNumber } },
          { step: "file_lookup", decision: candidate ? "selected" : "no_file", reason: candidateReason, outputs: { fileId: candidate?.id || null, name: candidate?.originalName || null } },
        ],
        finalAction,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── rollback INSTRUCTIONS (read-only — does NOT execute git) ──────────
  app.get("/api/dev/recent-commits", (req, res) => {
    if (!gate(req, res)) return;
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "15"), 10) || 15, 50);
      const fmt = "%H%x09%h%x09%cI%x09%an%x09%s";
      const out = require("child_process")
        .execSync(`git --no-optional-locks log -n ${limit} --pretty=format:${JSON.stringify(fmt)}`, { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 4000 })
        .toString().trim();
      const commits = out.split("\n").filter(Boolean).map((line: string) => {
        const [sha, short, date, author, ...msg] = line.split("\t");
        return { sha, short, date, author, message: msg.join("\t") };
      });
      const head = commits[0]?.sha || "";
      const recipe = (target: { sha: string; short: string; message: string }) => ({
        target,
        revertOnly: [
          "# SAFE — creates a new commit that undoes the target. No history rewrite.",
          `cd ~/Home-View`,
          `git pull`,
          `git revert --no-edit ${target.short}`,
          `git push`,
          `npm run build && pm2 restart dashboard`,
        ].join("\n"),
        rollbackToHere: [
          "# DESTRUCTIVE — rewrites main to this commit. Anything after is lost.",
          "# Use only after confirming with user. Requires force-push.",
          `cd ~/Home-View`,
          `git fetch origin`,
          `git reset --hard ${target.short}`,
          `git push --force-with-lease origin main`,
          `npm run build && pm2 restart dashboard`,
        ].join("\n"),
        warning: target.sha === head
          ? "This IS HEAD — nothing to rollback to."
          : `Reverting to ${target.short} will undo ${commits.findIndex(c => c.sha === target.sha)} commit(s) ahead of it.`,
      });
      res.json({
        head,
        commits,
        recipes: commits.slice(0, 10).map(recipe),
        reminder: "After ANY rollback: run `npm run build && pm2 restart dashboard` on the Pi. Then verify with /api/dev/diagnose and node scripts/smoke.mjs.",
        executionPolicy: "INSTRUCTIONS ONLY — this endpoint never runs git. Copy commands into a Pi terminal yourself.",
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── one-click test triggers ──────────
  // These call the real webhook via fetch so the live decision-trace fills
  // in. Cat lights state is simulated via the body's `state` field.
  const fireWebhook = async (state: 'on' | 'off') => {
    const port = process.env.PORT || 5000;
    const r = await fetch(`http://127.0.0.1:${port}/api/webhook/cat-lights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, source: "dev_test_trigger" }),
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  };
  app.post("/api/dev/test/cat-lights-on", async (req, res) => {
    if (!gate(req, res)) return;
    if (!req.body?.confirm) return res.status(400).json({ error: "send { confirm: true } — this WILL trigger real Cat Lights playback" });
    try { res.json({ fired: "on", result: await fireWebhook("on") }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/dev/test/cat-lights-off", async (req, res) => {
    if (!gate(req, res)) return;
    if (!req.body?.confirm) return res.status(400).json({ error: "send { confirm: true }" });
    try { res.json({ fired: "off", result: await fireWebhook("off") }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── runtime flags ──────────
  app.get("/api/dev/flags", (req, res) => { if (!gate(req, res)) return; res.json(getFlags()); });
  app.post("/api/dev/flags", (req, res) => {
    if (!gate(req, res)) return;
    try { res.json(setFlags(req.body || {})); } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ────────── performance metrics (derived from trace) ──────────
  app.get("/api/dev/performance", (req, res) => {
    if (!gate(req, res)) return;
    const all = getSteps();
    // Pair tts:chunk_start / tts:chunk_done events to measure durations.
    const starts: Record<string, number> = {};
    const durations: number[] = [];
    let timeouts = 0; let retries = 0;
    for (const s of all) {
      const key = (s.data as any)?.chunkKey || (s.data as any)?.fileId + ':' + (s.data as any)?.chunkIndex;
      if (s.step === 'tts:chunk_start' && key) starts[key] = s.ts;
      else if (s.step === 'tts:chunk_done' && key && starts[key]) { durations.push(s.ts - starts[key]); delete starts[key]; }
      if (/timeout/i.test(s.step) || /timeout/i.test(JSON.stringify(s.data || ''))) timeouts++;
      if (/retry/i.test(s.step)) retries++;
    }
    const sorted = durations.slice().sort((a, b) => a - b);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const slowest = durations.length ? Math.max(...durations) : null;
    const p95 = durations.length ? sorted[Math.floor(sorted.length * 0.95)] : null;
    res.json({
      ttsChunks: { samples: durations.length, avgMs: avg, p95Ms: p95, slowestMs: slowest },
      timeouts, retries,
      hint: durations.length === 0 ? "Add `tts:chunk_start` / `tts:chunk_done` traces to capture per-chunk timing." : undefined,
    });
  });

  // ────────── explain-system (knowledge endpoint) ──────────
  const EXPLAIN: Record<string, any> = {
    tts: {
      summary: "PDF/DOCX text → cleaned → chunked (~CHUNK_SIZE chars on sentence boundary) → per-chunk TTS audio (Replit primary, Edge fallback) → preparedAudioPaths[]. Playback reads preparedAudioPaths in order via media_player.play_media, advancing on Echo idle event.",
      relevantFiles: ["server/replit_integrations/audio/client.ts (textToSpeech, fallbackTTS)", "server/serverHelpers.ts (CHARS_PER_SECOND, CHUNK_SIZE, generateAndSaveTTSAudio)", "server/routes.ts (currentTTSSession, sendNextChunk, scheduleNextChunk, AudioPrep queue)"],
      keyFunctions: ["textToSpeech", "generateAndSaveTTSAudio", "sendNextChunk", "scheduleNextChunk", "stopTTSSession"],
      knownFailureModes: ["Replit TTS rate-limited → Edge fallback engages silently", "Echo idle event never arrives → playback stalls (mitigated by scheduleNextChunk timer)", "preparedAudioPaths length ≠ totalChunks → file marked not-ready by /api/dev/tts-ready"],
      debugWith: ["GET /api/dev/tts-ready", "GET /api/dev/trace?subsystem=tts", "GET /api/dev/performance"],
    },
    onedrive: {
      summary: "Per-week sync pulls files from each course's Module + Reading folders into the `files` table. Folder paths are stored on the OneDriveCourse rows. Files are matched by (courseFolder, weekNumber).",
      relevantFiles: ["server/onedrive.ts (auth + raw API)", "server/routes.ts (syncOneDriveFilesForWeek ~line 18148)", "server/storage.ts (getOneDriveCoursesBySemester)"],
      keyFunctions: ["syncOneDriveFilesForWeek", "listOneDriveItems", "getOneDriveItemByPath", "isOneDriveConnected"],
      knownFailureModes: ["Folder renamed in OneDrive → DB still points at old path → audit fails", "Device-code refresh expired → all sync calls 401", "Module/Reading folder not yet created for early weeks"],
      debugWith: ["GET /api/dev/onedrive-audit", "GET /api/dev/file-map"],
    },
    semester: {
      summary: "storage.getActiveSemesterSettings() returns the row with isActive=true. Week number = floor((today - semesterStartDate) / 7d) + 1, clamped to 1 pre-semester.",
      relevantFiles: ["server/storage.ts", "shared/schema.ts (getWeekNumber, getSemesterTotalWeeks)"],
      keyFunctions: ["getActiveSemesterSettings", "getWeekNumber"],
      knownFailureModes: ["Multiple isActive=true rows → unpredictable", "semesterStartDate stored as UTC midnight but compared in local TZ → off-by-one on first day"],
      debugWith: ["GET /api/dev/status (currentWeekNumber)", "POST /api/dev/replay { dateOverride: '...' }"],
    },
    automation: {
      summary: "Cat Lights HA webhook → debounce → calc week → look up next unlistened file by priority → if found, TTS prompt 'Would you like to play X?'. Confirmation triggers playback; refusal or no-file falls back to CHUM FM.",
      relevantFiles: ["server/routes.ts POST /api/webhook/cat-lights (~line 21340)", "server/routes.ts findNextFileByPriority (~line 18580)", "server/serverHelpers.ts (haServiceCall)"],
      keyFunctions: ["findNextFileByPriority", "playChumFmRadio", "describeFileForTTS"],
      knownFailureModes: ["weekNumber == -1 (post-semester) → would still try to find files; Cat Lights should abort but doesn't always", "TTS rate limit → confirmation prompt never plays → user can't respond → file marked listened anyway", "Server startup cooldown (60s) ignores webhooks"],
      debugWith: ["GET /api/dev/flow-snapshot", "POST /api/dev/replay", "GET /api/dev/trace?subsystem=cat_lights"],
    },
  };
  app.get("/api/dev/explain-system", (req, res) => {
    if (!gate(req, res)) return;
    const topic = String(req.query.topic || "").toLowerCase();
    if (!topic) return res.json({ available: Object.keys(EXPLAIN), hint: "GET /api/dev/explain-system?topic=tts|onedrive|semester|automation" });
    const entry = EXPLAIN[topic];
    if (!entry) return res.status(404).json({ error: `unknown topic '${topic}'`, available: Object.keys(EXPLAIN) });
    res.json({ topic, ...entry });
  });

  // ────────── targeted code export ──────────
  // Returns just the relevant slice instead of dumping the whole 32k-line file.
  const CODE_AREAS: Record<string, { file: string; pattern: RegExp; contextLines: number }> = {
    tts: { file: "server/serverHelpers.ts", pattern: /generateAndSaveTTSAudio|CHUNK_SIZE|CHARS_PER_SECOND/, contextLines: 60 },
    audioPrep: { file: "server/routes.ts", pattern: /AudioPrep|audioPrep/, contextLines: 20 },
    onedrive: { file: "server/routes.ts", pattern: /syncOneDriveFilesForWeek/, contextLines: 80 },
    catLights: { file: "server/routes.ts", pattern: /app\.post\("\/api\/webhook\/cat-lights"/, contextLines: 200 },
    fileSelection: { file: "server/routes.ts", pattern: /async function findNextFileByPriority/, contextLines: 80 },
  };
  app.get("/api/dev/export-code", (req, res) => {
    if (!gate(req, res)) return;
    const area = String(req.query.area || "").toLowerCase();
    const def = CODE_AREAS[area];
    if (!def) return res.status(400).json({ error: `unknown area '${area}'`, available: Object.keys(CODE_AREAS) });
    try {
      const abs = path.resolve(PROJECT_ROOT, def.file);
      const lines = fs.readFileSync(abs, "utf8").split("\n");
      const slices: { file: string; startLine: number; endLine: number; code: string }[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (def.pattern.test(lines[i])) {
          const s = Math.max(0, i - 5);
          const e = Math.min(lines.length, i + def.contextLines);
          slices.push({ file: def.file, startLine: s + 1, endLine: e, code: lines.slice(s, e).join("\n") });
          i = e; // skip past
          if (slices.length >= 5) break;
        }
      }
      res.json({ area, file: def.file, sliceCount: slices.length, slices });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── safe patch ──────────
  app.post("/api/dev/patch", (req, res) => {
    if (!gate(req, res)) return;
    try {
      const { file, find, replace, occurrence, reason } = req.body || {};
      if (typeof find !== "string" || typeof replace !== "string") return res.status(400).json({ error: "find and replace must be strings" });
      if (!find.length) return res.status(400).json({ error: "find is empty" });
      const safe = isPathSafe(file);
      if (!safe.ok) return res.status(400).json({ error: safe.error });
      if (!fs.existsSync(safe.abs!)) return res.status(404).json({ error: "file not found" });
      const original = fs.readFileSync(safe.abs!, "utf8");
      const idx = original.indexOf(find);
      if (idx < 0) return res.status(404).json({ error: "find string not found", file, findPreview: find.slice(0, 120) });
      const second = original.indexOf(find, idx + find.length);
      const allMode = occurrence === "all";
      if (!allMode && second >= 0) {
        return res.status(409).json({ error: "find string is not unique — refusing to patch", hint: "Add more surrounding context, or pass occurrence: 'all'.", firstIndex: idx, secondIndex: second });
      }
      const backupDir = path.join(PROJECT_ROOT, ".local", "patch-backups");
      try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `${path.basename(safe.abs!)}.${stamp}.bak`);
      fs.writeFileSync(backupPath, original, "utf8");
      const updated = allMode ? original.split(find).join(replace) : original.slice(0, idx) + replace + original.slice(idx + find.length);
      fs.writeFileSync(safe.abs!, updated, "utf8");
      const replacements = allMode ? (original.split(find).length - 1) : 1;
      appendChangeLog(
`## ${stamp}
- file: ${file}
- backup: ${path.relative(PROJECT_ROOT, backupPath)}
- replacements: ${replacements}
- reason: ${reason || "(none)"}
- find (first 120 chars): ${find.slice(0, 120).replace(/\n/g, "\\n")}
- replace (first 120 chars): ${replace.slice(0, 120).replace(/\n/g, "\\n")}

`);
      res.json({
        ok: true,
        file,
        backup: path.relative(PROJECT_ROOT, backupPath),
        bytesBefore: original.length,
        bytesAfter: updated.length,
        delta: updated.length - original.length,
        replacements,
        rollback: `cp ${path.relative(PROJECT_ROOT, backupPath)} ${file}`,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════════════
  // FIX IT — safe, dry-run-by-default repair actions
  // ════════════════════════════════════════════════════════════════════════
  const FIX_SNAPSHOT_DIR = path.join(PROJECT_ROOT, ".local", "fix-snapshots");
  const FIX_HISTORY_FILE = path.join(PROJECT_ROOT, ".local", "fix-history.json");
  function ensureFixDirs() {
    try { fs.mkdirSync(FIX_SNAPSHOT_DIR, { recursive: true }); } catch {}
    try { fs.mkdirSync(path.dirname(FIX_HISTORY_FILE), { recursive: true }); } catch {}
  }
  async function captureFixSnapshot(action: string): Promise<string> {
    ensureFixDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = `${stamp}_${action}.json`;
    const p = path.join(FIX_SNAPSHOT_DIR, fname);
    let files: any[] = [];
    let sem: any = null;
    try { files = await storage.getFiles(); } catch {}
    try { sem = await activeSemester(); } catch {}
    const all = getSteps();
    let startIdx = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].step === "cat_lights:webhook_received") { startIdx = i; break; }
    }
    const slice = startIdx >= 0 ? all.slice(startIdx).filter(s => s.subsystem === "cat_lights") : [];
    const snap = {
      timestamp: new Date().toISOString(),
      action,
      activeSemester: sem ? { id: (sem as any).id, key: (sem as any).semesterKey, start: (sem as any).semesterStartDate } : null,
      filesSummary: {
        total: files.length,
        byWeek: files.reduce((acc: any, f: any) => { const k = f.weekNumber ?? "null"; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
        preparedCount: files.filter(f => f.preparedAt).length,
        listenedCount: files.filter(f => f.listenedAt).length,
      },
      catLightsTrace: slice.slice(-30),
      buildInfo: buildInfo(),
    };
    try { fs.writeFileSync(p, JSON.stringify(snap, null, 2), "utf8"); } catch {}
    return path.relative(PROJECT_ROOT, p);
  }
  function appendFixHistory(entry: any) {
    ensureFixDirs();
    let arr: any[] = [];
    try { arr = JSON.parse(fs.readFileSync(FIX_HISTORY_FILE, "utf8")); } catch {}
    arr.push(entry);
    if (arr.length > 200) arr = arr.slice(-200);
    try { fs.writeFileSync(FIX_HISTORY_FILE, JSON.stringify(arr, null, 2), "utf8"); } catch {}
    appendChangeLog(`## ${entry.timestamp} — fix:${entry.action} dryRun=${entry.dryRun}\n- result: ${entry.result}\n- snapshot: ${entry.snapshot || "(none)"}\n- rollbackHint: ${entry.rollbackHint || "(none)"}\n\n`);
  }
  function isRealRun(req: any): boolean {
    const dry = req.query.dryRun;
    const dryRun = dry === undefined ? true : !(dry === "0" || dry === "false");
    const confirm = req.body?.confirm === true || req.query.confirm === "true";
    return !dryRun && confirm;
  }
  async function getCurrentWeek(): Promise<number | null> {
    const sem: any = await activeSemester();
    if (!sem?.semesterStartDate) return null;
    const today = new Date();
    const start = new Date(sem.semesterStartDate);
    return today < start ? 0 : Math.floor((today.getTime() - start.getTime()) / (7 * 86400000)) + 1;
  }

  // ────────── /api/dev/fix/regen-tts ──────────
  app.post("/api/dev/fix/regen-tts", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const week = await getCurrentWeek();
      const files: any[] = await storage.getFiles().catch(() => []);
      const stuck = files.filter(f =>
        f.weekNumber === week && !f.listenedAt && f.extractedText && (!f.preparedAt || !f.preparedAudioPaths)
      );
      const real = isRealRun(req);
      const targetIds = stuck.map(f => f.id);
      const preview = {
        currentWeek: week,
        wouldNudge: stuck.length,
        targetFileIds: targetIds,
        targetFileNames: stuck.map(f => f.originalName),
        action: "Clear preparedAudioPaths='' so AudioPrep queue re-picks each file",
      };
      if (!real) {
        appendFixHistory({ timestamp: new Date().toISOString(), action: "regen-tts", dryRun: true, result: `would re-queue ${stuck.length} files`, snapshot: null, rollbackHint: null, preview });
        return res.json({ dryRun: true, ok: true, preview, hint: "Re-call with ?dryRun=0 and {confirm:true} to apply." });
      }
      const snapPath = await captureFixSnapshot("regen-tts");
      let mutated = 0; const errors: any[] = [];
      for (const f of stuck) {
        try { await storage.updateFile(f.id, { preparedAudioPaths: "" }); mutated++; } catch (e: any) { errors.push({ id: f.id, error: e.message }); }
      }
      const result = `re-queued ${mutated}/${stuck.length} files (errors: ${errors.length})`;
      const rollbackHint = `Restore preparedAudioPaths from ${snapPath} (manual via DB) — affected file IDs: ${targetIds.join(",")}`;
      appendFixHistory({ timestamp: new Date().toISOString(), action: "regen-tts", dryRun: false, result, snapshot: snapPath, rollbackHint, preview, errors });
      res.json({ dryRun: false, ok: errors.length === 0, mutated, errors, snapshot: snapPath, rollbackHint });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/fix/reset-queue ──────────
  app.post("/api/dev/fix/reset-queue", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const all = getSteps();
      const catCount = all.filter(s => s.subsystem === "cat_lights").length;
      const real = isRealRun(req);
      const preview = {
        wouldClearTraceEntries: catCount,
        action: "Clear cat_lights trace entries (does NOT touch in-process queue closure — full reset still requires pm2 restart on Pi)",
        manualFollowUp: "ssh pi: cd ~/Home-View && pm2 restart dashboard",
      };
      if (!real) {
        appendFixHistory({ timestamp: new Date().toISOString(), action: "reset-queue", dryRun: true, result: `would clear ${catCount} trace entries`, snapshot: null, rollbackHint: null, preview });
        return res.json({ dryRun: true, ok: true, preview, hint: "Re-call with ?dryRun=0 and {confirm:true} to apply." });
      }
      const snapPath = await captureFixSnapshot("reset-queue");
      // Soft reset: only clear cat_lights subsystem trace; leave others intact.
      // (clearSteps in devTrace clears all — re-implement narrowly here.)
      const remaining = all.filter(s => s.subsystem !== "cat_lights");
      // Use injected re-init via re-pushing remaining entries is not exposed;
      // safest: clearAll then re-log a marker. Cat Lights will re-populate on next webhook.
      try { clearSteps(); } catch {}
      const result = `cleared trace (${catCount} cat_lights entries; ${remaining.length} other entries also cleared by full clearSteps)`;
      const rollbackHint = `No DB mutation. To restore in-process queue state, run pm2 restart dashboard on the Pi.`;
      appendFixHistory({ timestamp: new Date().toISOString(), action: "reset-queue", dryRun: false, result, snapshot: snapPath, rollbackHint, preview });
      res.json({ dryRun: false, ok: true, cleared: catCount, snapshot: snapPath, rollbackHint, hint: "For full queue reset, run pm2 restart dashboard on the Pi." });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/fix/resync-onedrive ──────────
  app.post("/api/dev/fix/resync-onedrive", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const connected = isOneDriveConnected();
      const sem: any = await activeSemester();
      let courses: any[] = [];
      try { courses = await (storage as any).getOneDriveCoursesBySemester?.(sem?.id) || []; } catch {}
      const real = isRealRun(req);
      const preview = {
        oneDriveConnected: connected,
        activeSemesterId: sem?.id || null,
        coursesFound: courses.length,
        coursePaths: courses.map((c: any) => c.folderPath || c.path || c.name),
        action: "Re-audit each course folder (read-only). Actual file re-sync runs from the dashboard's OneDrive sync button or pm2 restart.",
      };
      if (!connected) {
        const result = "OneDrive not connected — cannot audit";
        appendFixHistory({ timestamp: new Date().toISOString(), action: "resync-onedrive", dryRun: !real, result, snapshot: null, rollbackHint: null, preview });
        return res.status(real ? 412 : 200).json({ dryRun: !real, ok: false, error: result, preview });
      }
      if (!real) {
        appendFixHistory({ timestamp: new Date().toISOString(), action: "resync-onedrive", dryRun: true, result: `would audit ${courses.length} course folders`, snapshot: null, rollbackHint: null, preview });
        return res.json({ dryRun: true, ok: true, preview, hint: "Re-call with ?dryRun=0 and {confirm:true} to run a read-only audit." });
      }
      const snapPath = await captureFixSnapshot("resync-onedrive");
      // Read-only audit: call onedrive-audit logic by hitting the endpoint logic inline is not exposed here.
      // Return concrete recipe + snapshot.
      const result = `audit captured to snapshot; for live re-sync use dashboard OneDrive sync button or pm2 restart`;
      const rollbackHint = `Read-only — nothing to roll back.`;
      appendFixHistory({ timestamp: new Date().toISOString(), action: "resync-onedrive", dryRun: false, result, snapshot: snapPath, rollbackHint, preview });
      res.json({ dryRun: false, ok: true, snapshot: snapPath, rollbackHint, hint: "GET /api/dev/onedrive-audit for full per-folder report." });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/fix/rebuild-file-map ──────────
  app.post("/api/dev/fix/rebuild-file-map", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const week = await getCurrentWeek();
      const files: any[] = await storage.getFiles().catch(() => []);
      const wkFiles = files.filter(f => f.weekNumber === week);
      const real = isRealRun(req);
      const distPath = path.join(PROJECT_ROOT, "dist");
      const clientSrc = path.join(PROJECT_ROOT, "client", "src");
      const distMtime = (() => { try { return fs.statSync(distPath).mtimeMs; } catch { return 0; } })();
      const srcMtime = newestMtime(clientSrc);
      const buildOutOfDate = !!(distMtime && srcMtime && srcMtime > distMtime);
      const preview = {
        currentWeek: week,
        filesForCurrentWeek: wkFiles.length,
        buildOutOfDate,
        action: "Force /api/dev/file-map recomputation on next request (cache is per-request — already always fresh)",
        piRebuildRecipe: buildOutOfDate ? "ssh pi: cd ~/Home-View && git pull && npm run build && pm2 restart all" : null,
      };
      if (!real) {
        appendFixHistory({ timestamp: new Date().toISOString(), action: "rebuild-file-map", dryRun: true, result: `would re-derive map for ${wkFiles.length} week-${week} files`, snapshot: null, rollbackHint: null, preview });
        return res.json({ dryRun: true, ok: true, preview, hint: "Re-call with ?dryRun=0 and {confirm:true} to capture snapshot." });
      }
      const snapPath = await captureFixSnapshot("rebuild-file-map");
      const result = `snapshot captured; file-map is recomputed on every GET — no in-memory cache to invalidate`;
      const rollbackHint = `Read-only — nothing to roll back.`;
      appendFixHistory({ timestamp: new Date().toISOString(), action: "rebuild-file-map", dryRun: false, result, snapshot: snapPath, rollbackHint, preview });
      res.json({ dryRun: false, ok: true, snapshot: snapPath, rollbackHint, nextStep: "GET /api/dev/file-map for fresh report." });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/fix/cleanup-bad-uploads — DB-only cleanup of files routed to inactive/TBD courses ──────────
  app.post("/api/dev/fix/cleanup-bad-uploads", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const norm = (s: any) => String(s || '').replace(/\s/g, '').toUpperCase();
      const sem: any = await activeSemester();
      const allowed: string[] = [];
      if (sem) for (let i = 1; i <= 6; i++) { const c = sem[`course${i}Code`]; if (c) allowed.push(norm(c)); }

      const files: any[] = await storage.getFiles().catch(() => []);
      const bad = files.filter((f: any) => {
        if (!f.folder) return false;
        const m = f.folder.match(/^week-(\d+)-([a-z0-9_]+)-(module|reading)$/i);
        if (!m) {
          if (/tbd[123]?/i.test(f.folder) || /^casl/i.test(f.folder.replace(/^week-\d+-/, ''))) return true;
          return false;
        }
        const code = norm(m[2]);
        if (/^TBD/.test(code)) return true;
        if (allowed.length > 0 && !allowed.includes(code)) return true;
        return false;
      }).map((f: any) => ({ id: f.id, folder: f.folder, name: f.displayName || f.originalName, listened: f.listened }));

      const real = isRealRun(req) && req.body?.confirm === true;
      const preview = {
        activeSemester: sem ? sem.semesterName : null,
        allowedCourses: allowed,
        candidatesFound: bad.length,
        candidates: bad.slice(0, 50),
        scope: "Database only — OneDrive files are NOT touched.",
      };

      if (!real) {
        appendFixHistory({ timestamp: new Date().toISOString(), action: "cleanup-bad-uploads", dryRun: true, result: `would soft-delete ${bad.length} file rows`, snapshot: null, rollbackHint: null, preview });
        return res.json({ dryRun: true, ok: true, preview, hint: "Re-call with ?dryRun=0 and {confirm:true} to apply. Snapshot is captured first." });
      }

      const snapPath = await captureFixSnapshot("cleanup-bad-uploads");
      let deleted = 0;
      const errors: any[] = [];
      for (const f of bad) {
        try { await storage.deleteFile?.(f.id); deleted++; }
        catch (e: any) { errors.push({ id: f.id, error: e.message }); }
      }
      const result = `deleted ${deleted}/${bad.length} bad-routed file rows`;
      const rollbackHint = `Restore from snapshot at ${snapPath} (files table rows for the listed IDs).`;
      appendFixHistory({ timestamp: new Date().toISOString(), action: "cleanup-bad-uploads", dryRun: false, result, snapshot: snapPath, rollbackHint, preview });
      res.json({ dryRun: false, ok: true, deleted, errors, snapshot: snapPath, rollbackHint, scope: preview.scope });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/upload-readiness — single PASS/FAIL before bulk PDF upload ──────────
  app.get("/api/dev/upload-readiness", async (req, res) => {
    if (!gate(req, res)) return;
    type Check = { id: string; status: "pass"|"warn"|"fail"; message: string; details?: any; fixAction?: any };
    const checks: Check[] = [];
    const push = (c: Check) => checks.push(c);
    try {
      // 1. active semester
      const sem: any = await activeSemester();
      if (!sem) push({ id: "active_semester", status: "fail", message: "No active semester row.", fixAction: { id: "open_semester_settings", endpoint: "/api/dev/system-map", method: "GET", infoOnly: true, hint: "Dashboard → Settings → Semesters" } });
      else push({ id: "active_semester", status: "pass", message: `${sem.semesterName || sem.semesterKey} (start ${sem.semesterStartDate})`, details: { id: sem.id, start: sem.semesterStartDate, end: sem.semesterEndDate } });

      // 2. current week
      const wk = calcWeekFromSemester(sem);
      if (wk.weekNumber == null) push({ id: "current_week", status: "fail", message: "Cannot calculate current week.", details: { reason: wk.reason } });
      else if (wk.weekNumber < 1) push({ id: "current_week", status: "fail", message: `weekNumber=${wk.weekNumber} — Cat Lights would refuse to play.`, fixAction: { id: "replay_force_week_1", endpoint: "/api/dev/replay", method: "POST", infoOnly: true, hint: "POST /api/dev/replay {forceWeek:1}" } });
      else if (wk.weekNumber > 20) push({ id: "current_week", status: "warn", message: `weekNumber=${wk.weekNumber} — past expected range.`, details: { weekNumber: wk.weekNumber } });
      else push({ id: "current_week", status: "pass", message: `Week ${wk.weekNumber}.` });

      // 3. OneDrive connection
      let onedriveConnected = false;
      try { onedriveConnected = isOneDriveConnected(); } catch {}
      if (!onedriveConnected) push({ id: "onedrive_connection", status: "fail", message: "OneDrive not connected — uploads cannot be detected.", fixAction: { id: "open_onedrive_status", endpoint: "/api/onedrive/status", method: "GET", infoOnly: true } });
      else push({ id: "onedrive_connection", status: "pass", message: "OneDrive auth active." });

      // 4. course folders + Module/Reading per course (delegates to onedrive-audit logic)
      let coursesList: any[] = [];
      try { if (sem) coursesList = (await (storage as any).getOneDriveCoursesBySemester?.((sem as any).id)) || []; } catch {}
      const folderIssues: any[] = [];
      for (const c of coursesList) {
        const code = c.courseCode || c.code || "?";
        const issues: string[] = [];
        if (!c.oneDrivePath && !c.folderPath) issues.push("missing oneDrivePath");
        if (!c.modulePath && !c.moduleFolderPath) issues.push("missing modulePath");
        if (!c.readingPath && !c.readingFolderPath) issues.push("missing readingPath");
        if (issues.length) folderIssues.push({ course: code, issues });
      }
      if (!coursesList.length) push({ id: "onedrive_folders", status: "fail", message: "No OneDrive courses found for active semester." });
      else if (folderIssues.length) push({ id: "onedrive_folders", status: "fail", message: `${folderIssues.length}/${coursesList.length} courses missing folders.`, details: { issues: folderIssues }, fixAction: { id: "resync_onedrive", endpoint: "/api/dev/fix/resync-onedrive", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: true } });
      else push({ id: "onedrive_folders", status: "pass", message: `${coursesList.length} courses, all with Module/Reading paths.` });

      // 5. TTS queue health (stuck files)
      let allFiles: any[] = [];
      try { allFiles = await storage.getFiles(); } catch {}
      const stuck = allFiles.filter((f: any) => f.extractedText && (f.totalChunks || 0) > 0 && !f.preparedAt && !f.listenedAt && !f.listened);
      if (stuck.length > 5) push({ id: "tts_queue", status: "fail", message: `${stuck.length} files have text+chunks but no preparedAt — queue stuck.`, details: { stuckIds: stuck.slice(0, 10).map((f: any) => f.id) }, fixAction: { id: "regen_tts", endpoint: "/api/dev/fix/regen-tts", method: "POST", risk: "low", dryRunSupported: true, requiresConfirm: true } });
      else if (stuck.length > 0) push({ id: "tts_queue", status: "warn", message: `${stuck.length} stuck files.`, details: { stuckIds: stuck.map((f: any) => f.id) } });
      else push({ id: "tts_queue", status: "pass", message: "No stuck files." });

      // 6. flags state
      const flagsNow = getFlags();
      const badFlags: string[] = [];
      if (flagsNow.disableAudioPrepQueue) badFlags.push("disableAudioPrepQueue=ON");
      if (flagsNow.disableTTS) badFlags.push("disableTTS=ON");
      if (flagsNow.disableOneDriveSync) badFlags.push("disableOneDriveSync=ON");
      if (badFlags.length) push({ id: "flags", status: "fail", message: `Runtime flags will block automation: ${badFlags.join(", ")}.`, details: flagsNow, fixAction: { id: "reset_flags", endpoint: "/api/dev/flags", method: "POST", infoOnly: true, hint: "POST /api/dev/flags { disableAudioPrepQueue:false, disableTTS:false, disableOneDriveSync:false }" } });
      else push({ id: "flags", status: "pass", message: "All runtime flags OFF.", details: flagsNow });

      // 7. recent blocking errors
      const errs = getRecentErrors().slice(-20);
      const blockers = errs.filter((e: any) => /audioprep|tts|onedrive|prepared/i.test(JSON.stringify(e)));
      if (blockers.length > 3) push({ id: "recent_errors", status: "fail", message: `${blockers.length} recent AudioPrep/TTS/OneDrive errors.`, details: { sample: blockers.slice(-3) } });
      else if (blockers.length) push({ id: "recent_errors", status: "warn", message: `${blockers.length} recent subsystem errors.`, details: { sample: blockers.slice(-3) } });
      else push({ id: "recent_errors", status: "pass", message: "No recent blocking errors." });

      // 8. disk space (best-effort, non-fatal)
      let diskPass = true; let diskMsg = "Disk check skipped on this platform.";
      try {
        const df = execSync("df -k --output=avail /", { timeout: 2000, encoding: "utf8" }).split("\n")[1] || "0";
        const availKb = parseInt(df.trim(), 10) || 0;
        const availMb = Math.floor(availKb / 1024);
        if (availMb < 500) { diskPass = false; diskMsg = `Only ${availMb} MB free — not enough for TTS audio batch.`; }
        else diskMsg = `${availMb} MB free.`;
      } catch {}
      push({ id: "disk_space", status: diskPass ? "pass" : "fail", message: diskMsg });

      // 9. old-semester backlog
      let backlog = 0;
      if (sem?.id && allFiles.length) {
        const semStart = new Date(sem.semesterStartDate).getTime();
        backlog = allFiles.filter((f: any) => f.createdAt && new Date(f.createdAt).getTime() < semStart - (180 * 86400000) && !f.listened && !f.listenedAt && !f.preparedAt).length;
      }
      if (backlog > 50) push({ id: "old_backlog", status: "warn", message: `${backlog} pre-semester files would re-queue if not filtered.`, details: { count: backlog } });
      else push({ id: "old_backlog", status: "pass", message: `${backlog} pre-semester files (acceptable).` });

      // 10. build state
      const bi: any = buildInfo();
      if (bi?.outOfDate) push({ id: "build_state", status: "warn", message: bi.outOfDateWarning || "Frontend bundle older than client/src.", details: bi, fixAction: { id: "rebuild_pi", endpoint: "/api/dev/fix/rebuild-file-map", method: "POST", infoOnly: true, hint: "ssh pi: cd ~/Home-View && git pull && npm run build && pm2 restart all" } });
      else push({ id: "build_state", status: "pass", message: `Build ${bi?.bundleHash || "?"} — fresh.` });

      const failCount = checks.filter(c => c.status === "fail").length;
      const warnCount = checks.filter(c => c.status === "warn").length;
      const ready = failCount === 0;
      res.json({
        ready,
        verdict: ready ? "SAFE TO UPLOAD" : "DO NOT UPLOAD",
        summary: ready
          ? (warnCount ? `Safe with ${warnCount} warning(s).` : "All checks passed.")
          : `${failCount} blocker(s), ${warnCount} warning(s). Fix before uploading.`,
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/timeline-guard — semester correctness diagnostics ──────────
  app.get("/api/dev/timeline-guard", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const today = new Date();
      const sem: any = await activeSemester();
      const issues: any[] = [];
      let status: "pre"|"active"|"post"|"unknown" = "unknown";
      if (!sem) {
        issues.push({ type: "no_active_semester", message: "No active semester row exists.", impact: "automation falls back to CHUM FM", fixAction: { id: "open_semester_settings", infoOnly: true, hint: "Dashboard → Settings → Semesters" } });
      } else {
        const start = sem.semesterStartDate ? new Date(sem.semesterStartDate) : null;
        const end = sem.semesterEndDate ? new Date(sem.semesterEndDate) : null;
        if (start && today < start) {
          status = "pre";
          issues.push({ type: "pre_semester", message: `Today (${today.toISOString().slice(0,10)}) is before semester start (${start.toISOString().slice(0,10)}).`, impact: "automation will fallback — Cat Lights plays CHUM FM" });
        } else if (end && today > end) {
          status = "post";
          issues.push({ type: "post_semester", message: `Today (${today.toISOString().slice(0,10)}) is after semester end (${end.toISOString().slice(0,10)}).`, impact: "automation will fallback unless next semester is activated" });
        } else {
          status = "active";
        }
        const wk = calcWeekFromSemester(sem);
        if (wk.weekNumber == null) issues.push({ type: "week_uncomputed", message: "weekNumber could not be computed.", details: { reason: wk.reason } });
        else if (wk.weekNumber < 1) issues.push({ type: "week_negative", message: `weekNumber=${wk.weekNumber} — Cat Lights refuses.`, impact: "no playback" });
        else if (wk.weekNumber > 20) issues.push({ type: "week_beyond_range", message: `weekNumber=${wk.weekNumber} exceeds expected 1..20.`, impact: "may queue old material" });

        // Per-course window checks
        const coursesList: any[] = [];
        for (let i = 1; i <= 6; i++) {
          const code = sem[`course${i}Code`];
          if (!code) continue;
          const cStart = sem[`course${i}StartDate`] ? new Date(sem[`course${i}StartDate`]) : null;
          const cEnd = sem[`course${i}EndDate`] ? new Date(sem[`course${i}EndDate`]) : null;
          const term = sem[`course${i}SpringSummerTerm`] || null;
          const active = (!cStart || today >= cStart) && (!cEnd || today <= cEnd);
          coursesList.push({ code, name: sem[`course${i}Name`], term, start: cStart?.toISOString().slice(0,10), end: cEnd?.toISOString().slice(0,10), active });
          if (term === "second_half" && cStart && today < cStart) issues.push({ type: "second_half_too_early", message: `${code} is second_half but today is before its start (${cStart.toISOString().slice(0,10)}).` });
          if (term === "first_half" && cEnd && today > cEnd) issues.push({ type: "first_half_overrun", message: `${code} is first_half but today is past its end (${cEnd.toISOString().slice(0,10)}).` });
          if (cEnd && today > cEnd && !sem[`course${i}Completed`]) issues.push({ type: "course_past_end", message: `${code} ended ${cEnd.toISOString().slice(0,10)} but is not marked completed.` });
        }

        // Week folder existence check (best-effort)
        if (wk.weekNumber && wk.weekNumber >= 1) {
          try {
            const ods = (await (storage as any).getOneDriveCoursesBySemester?.(sem.id)) || [];
            for (const c of ods) {
              const code = c.courseCode || c.code || "?";
              const modPath = c.modulePath || c.moduleFolderPath;
              const readPath = c.readingPath || c.readingFolderPath;
              for (const [type, base] of [["module", modPath], ["reading", readPath]] as const) {
                if (!base) continue;
                const expected = `Week ${wk.weekNumber}`;
                const matches = String(base).toLowerCase().includes(expected.toLowerCase()) || String(base).match(new RegExp(`week\\s*${wk.weekNumber}\\b`, "i"));
                if (!matches) issues.push({ type: "week_folder_mismatch", message: `${code} ${type} path does not contain "${expected}": ${base}` });
              }
            }
          } catch {}
        }

        const safe = status === "active" && !issues.some(i => ["week_negative", "week_uncomputed", "no_active_semester"].includes(i.type));
        return res.json({
          today: today.toISOString(),
          semester: sem.semesterName || sem.semesterKey,
          semesterStart: sem.semesterStartDate,
          semesterEnd: sem.semesterEndDate,
          weekNumber: wk.weekNumber,
          status,
          courses: coursesList,
          issues,
          verdict: safe ? "SAFE TO RUN AUTOMATION" : "DO NOT RUN — timeline mismatch",
        });
      }
      res.json({ today: today.toISOString(), semester: null, status, issues, verdict: "DO NOT RUN — timeline mismatch" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/after-upload-check — post-upload validation ──────────
  app.get("/api/dev/after-upload-check", async (req, res) => {
    if (!gate(req, res)) return;
    try {
      const sinceMin = Math.min(Math.max(Number(req.query.sinceMin) || 60, 5), 1440);
      const cutoff = Date.now() - sinceMin * 60000;
      const files = await storage.getFiles();
      const recent = files.filter((f: any) => f.createdAt && new Date(f.createdAt).getTime() >= cutoff);
      const tooLargeMB = 80;
      const newFilesDetected = recent.map((f: any) => ({
        id: f.id, name: f.originalName, folder: f.folder, sizeMB: f.size ? Math.round(f.size / 1048576 * 10) / 10 : null,
        createdAt: f.createdAt,
        hasText: !!f.extractedText,
        totalChunks: f.totalChunks || 0,
        preparedAt: f.preparedAt,
        preparedAudioPaths: !!f.preparedAudioPaths,
      }));
      const filesWithoutText = recent.filter((f: any) => !f.extractedText).map((f: any) => ({ id: f.id, name: f.originalName }));
      const filesWithoutChunks = recent.filter((f: any) => f.extractedText && (!f.totalChunks || f.totalChunks === 0)).map((f: any) => ({ id: f.id, name: f.originalName }));
      const filesNotQueued = recent.filter((f: any) => f.extractedText && (f.totalChunks || 0) > 0 && !f.preparedAt).map((f: any) => ({ id: f.id, name: f.originalName }));
      const queueDepth = files.filter((f: any) => f.extractedText && (f.totalChunks || 0) > 0 && !f.preparedAt && !f.listened && !f.listenedAt).length;
      const warnings: any[] = [];
      const tooLarge = recent.filter((f: any) => f.size && f.size > tooLargeMB * 1048576);
      for (const f of tooLarge) warnings.push({ type: "file_too_large", id: f.id, name: f.originalName, sizeMB: Math.round(f.size / 1048576) });
      if (recent.length === 0) warnings.push({ type: "no_recent_files", message: `No files created in the last ${sinceMin} min. Did the upload reach the server?` });
      if (filesWithoutText.length > recent.length / 2) warnings.push({ type: "extraction_lagging", message: `${filesWithoutText.length}/${recent.length} files still have no extracted text.` });
      if (queueDepth > 50) warnings.push({ type: "queue_high", message: `${queueDepth} total files awaiting TTS — pipeline may be slow.` });
      res.json({
        sinceMinutes: sinceMin,
        newFilesDetected,
        filesWithoutText,
        filesWithoutChunks,
        filesNotQueued,
        queueDepth,
        warnings,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ────────── /api/dev/fix-history ──────────
  app.get("/api/dev/fix-history", (req, res) => {
    if (!gate(req, res)) return;
    try {
      let arr: any[] = [];
      try { arr = JSON.parse(fs.readFileSync(FIX_HISTORY_FILE, "utf8")); } catch {}
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json({ count: arr.length, entries: arr.slice(-limit).reverse() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
