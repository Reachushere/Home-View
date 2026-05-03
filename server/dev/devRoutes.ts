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
import {
  getSteps,
  clearSteps,
  getLastSelection,
  getLayoutSnapshot,
  setLayoutSnapshot,
  getRecentErrors,
  type Subsystem,
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

function buildInfo() {
  const distPath = path.join(PROJECT_ROOT, "dist");
  let lastBuildAt: string | null = null;
  let lastBuildAgeSec: number | null = null;
  try {
    if (fs.existsSync(distPath)) {
      const st = fs.statSync(distPath);
      lastBuildAt = st.mtime.toISOString();
      lastBuildAgeSec = Math.round((Date.now() - st.mtimeMs) / 1000);
    }
  } catch {}
  const pm2Detected = !!(process.env.PM2_HOME || process.env.pm_id || process.env.PM2_USAGE);
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    buildMode: process.env.NODE_ENV === "production" ? "built" : "vite-dev",
    distExists: fs.existsSync(distPath),
    lastBuildAt,
    lastBuildAgeSec,
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
    res.json({
      lastSelection: sel,
      summary: { totalFiles: files.length, byFolder: Object.values(byFolder) },
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
