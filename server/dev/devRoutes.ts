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
  const stack: any[] = (app as any)?._router?.stack || [];
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

export function registerDevRoutes(app: Express): void {
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
    res.json({
      trigger: get("cat_lights:webhook_received")?.data?.body || null,
      stateParsed: get("cat_lights:state_parsed")?.data || null,
      semester: (week?.data as any)?.semesterKey || sel?.semester || null,
      weekNumber: (week?.data as any)?.weekNumber ?? null,
      initialFileLookup: initial?.data || null,
      decisionPath: slice.map(s => ({
        time: s.time,
        step: s.step,
        decision: s.decision || (s.data as any)?.action,
        reason: s.reason || (s.data as any)?.reason,
        inputs: s.inputs,
        outputs: s.outputs,
      })),
      fileSelection: sel,
      tts: tts ? { message: (tts.data as any)?.message, time: tts.time } : null,
      finalAction,
      runStartedAt: all[startIdx].time,
      runEndedAt: slice[slice.length - 1]?.time,
      durationMs: slice[slice.length - 1]?.ts - all[startIdx].ts,
    });
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
}
