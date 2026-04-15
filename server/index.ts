import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Pool as PgPool } from 'pg';

for (const envFile of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key] || envFile === '.env.local') {
        process.env[key] = value;
      }
    }
    console.log(`[ENV] Loaded ${envFile} from ${envPath} (keys: ${envContent.split('\n').filter(l => l.trim() && !l.startsWith('#') && l.includes('=')).map(l => l.split('=')[0]).join(', ')})`);
  }
}

try { require('dotenv/config'); } catch {}
process.env.TZ = 'America/Toronto';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startReminderScheduler } from "./reminderScheduler";
import { storage } from "./storage";
import crypto from "crypto";
import cookieParser from "cookie-parser";

async function checkAndSwitchSemester() {
  try {
    const active = await storage.getActiveSemesterSettings();
    if (!active || !active.semesterEndDate) return;

    const now = new Date();
    const endDate = new Date(active.semesterEndDate);

    if (now > endDate) {
      const allSemesters = await storage.getAllSemesterSettings();
      const nextSemester = allSemesters
        .filter(s => !s.isActive && new Date(s.semesterStartDate) > endDate)
        .sort((a, b) => new Date(a.semesterStartDate).getTime() - new Date(b.semesterStartDate).getTime())[0];

      if (nextSemester) {
        await storage.updateSemesterSettings(active.id, { isActive: false });
        await storage.updateSemesterSettings(nextSemester.id, { isActive: true });
        console.log(`[Semester Switch] Switched from "${active.semesterName}" to "${nextSemester.semesterName}"`);
      } else {
        console.log(`[Semester Switch] "${active.semesterName}" has ended but no next semester found`);
      }
    }
  } catch (err) {
    console.error("[Semester Switch] Error checking semester:", err);
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cookieParser());

app.use("/tts-audio", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use((req: any, res: any, next: any) => {
  if (req.path === '/api/uploads/direct') {
    return next();
  }
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (req.method !== 'GET' && req.method !== 'HEAD' && contentType.includes('application/json')) {
    let chunks: Buffer[] = [];
    const origOn = req.on.bind(req);
    let rawData = '';
    express.text({ limit: '50mb', type: 'application/json' })(req, res, (err: any) => {
      if (typeof req.body === 'string') {
        const raw = req.body;
        req.rawBody = Buffer.from(raw);
        try {
          req.body = JSON.parse(raw);
        } catch {
          try {
            const fixed = raw.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
            req.body = JSON.parse(fixed);
          } catch {
            req.body = {};
          }
        }
      }
      next();
    });
  } else {
    express.json({ limit: '50mb', verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; } })(req, res, next);
  }
});

app.use((req: any, res: any, next: any) => {
  if (req.path === '/api/uploads/direct') return next();
  express.urlencoded({ extended: false })(req, res, next);
});

const SITE_PASSWORD = process.env.SITE_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || "uni-cal-session-key";
const VALID_PASSWORDS = ['5747', '4201', '1010'];

const TOKEN_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function createSessionToken(level: string = '5747'): string {
  const timestamp = Date.now().toString(36);
  const sig = crypto.createHmac("sha256", SESSION_SECRET)
    .update(`uni-cal-auth:${level}:${timestamp}`)
    .digest("hex");
  return `${level}.${timestamp}.${sig}`;
}

function parseToken(token: string): { level: string; valid: boolean } {
  if (!SITE_PASSWORD) return { level: '5747', valid: true };
  if (!token || typeof token !== "string") return { level: '', valid: false };
  const parts = token.split(".");
  if (parts.length === 2) {
    const [timestamp, sig] = parts;
    if (!/^[a-z0-9]+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(sig)) return { level: '', valid: false };
    const created = parseInt(timestamp, 36);
    if (isNaN(created) || Date.now() - created > TOKEN_MAX_AGE_MS) return { level: '', valid: false };
    const expected = crypto.createHmac("sha256", SESSION_SECRET)
      .update(`uni-cal-auth:${SITE_PASSWORD}:${timestamp}`)
      .digest("hex");
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { level: '5747', valid: true };
    }
    return { level: '', valid: false };
  }
  if (parts.length === 3) {
    const [level, timestamp, sig] = parts;
    if (!VALID_PASSWORDS.includes(level)) return { level: '', valid: false };
    if (!/^[a-z0-9]+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(sig)) return { level: '', valid: false };
    const created = parseInt(timestamp, 36);
    if (isNaN(created) || Date.now() - created > TOKEN_MAX_AGE_MS) return { level: '', valid: false };
    const expected = crypto.createHmac("sha256", SESSION_SECRET)
      .update(`uni-cal-auth:${level}:${timestamp}`)
      .digest("hex");
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { level, valid: true };
    }
    return { level: '', valid: false };
  }
  return { level: '', valid: false };
}

function isValidToken(token: string): boolean {
  return parseToken(token).valid;
}

function getAuthToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.uni_cal_session;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const queryToken = req.query?.token as string | undefined;
  if (queryToken) return queryToken;
  return undefined;
}

function isAutoAuthRequest(req: Request): boolean {
  const autoAuth = req.query?.auth as string | undefined;
  return !!autoAuth && VALID_PASSWORDS.includes(autoAuth);
}

function getAutoAuthLevel(req: Request): string {
  const autoAuth = req.query?.auth as string | undefined;
  return (autoAuth && VALID_PASSWORDS.includes(autoAuth)) ? autoAuth : '5747';
}

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!SITE_PASSWORD) {
    return res.json({ success: true, token: '', level: '5747' });
  }
  if (VALID_PASSWORDS.includes(password)) {
    const token = createSessionToken(password);
    trackSession(token, password, req);
    res.cookie("uni_cal_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return res.json({ success: true, token, level: password });
  }
  return res.status(401).json({ success: false, message: "Incorrect password" });
});

app.get("/api/auth/check", (req: Request, res: Response) => {
  if (!SITE_PASSWORD) {
    return res.json({ authenticated: true });
  }
  if (isAutoAuthRequest(req)) {
    const level = getAutoAuthLevel(req);
    const token = createSessionToken(level);
    trackSession(token, level, req);
    res.cookie("uni_cal_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return res.json({ authenticated: true, token, level });
  }
  const token = getAuthToken(req);
  if (token) {
    try {
      const parsed = parseToken(token);
      if (parsed.valid) {
        trackSession(token, parsed.level, req);
        return res.json({ authenticated: true, level: parsed.level });
      }
    } catch (e) {}
  }
  return res.json({ authenticated: false });
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie("uni_cal_session");
  return res.json({ success: true });
});

const activeSessions: Map<string, { level: string; loginTime: number; lastActive: number; userAgent: string; ip: string }> = new Map();

function trackSession(token: string, level: string, req: Request) {
  const ua = req.headers['user-agent'] || 'Unknown';
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'Unknown';
  const existing = activeSessions.get(token);
  if (existing) {
    existing.lastActive = Date.now();
  } else {
    activeSessions.set(token, { level, loginTime: Date.now(), lastActive: Date.now(), userAgent: ua, ip: typeof ip === 'string' ? ip : ip });
  }
}

function getAdminAuth(req: Request): boolean {
  const token = getAuthToken(req);
  if (!token) return !SITE_PASSWORD;
  const parsed = parseToken(token);
  return parsed.valid && parsed.level === '5747';
}

app.get("/api/admin/status", (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const uptime = process.uptime();
  const sessions = Array.from(activeSessions.entries()).map(([tokenKey, s]) => ({
    id: tokenKey.substring(0, 8) + '...',
    level: s.level,
    levelName: s.level === '5747' ? 'Bryn (Admin)' : s.level === '4201' ? 'Partner' : s.level === '1010' ? 'Guest' : 'Unknown',
    loginTime: s.loginTime,
    lastActive: s.lastActive,
    userAgent: s.userAgent,
    ip: s.ip,
  }));
  const staleThreshold = Date.now() - (24 * 60 * 60 * 1000);
  for (const [key, s] of activeSessions) {
    if (s.lastActive < staleThreshold) activeSessions.delete(key);
  }
  res.json({
    uptime,
    sitePasswordSet: !!SITE_PASSWORD,
    guestAccessEnabled: !!process.env.SITE_PASSWORD_1010,
    partnerAccessEnabled: !!process.env.SITE_PASSWORD_4201,
    sessions: sessions.filter(s => s.lastActive > staleThreshold),
    passwords: {
      admin: SITE_PASSWORD || '(not set)',
      partner: process.env.SITE_PASSWORD_4201 || '(not set)',
      guest: process.env.SITE_PASSWORD_1010 || '(not set)',
    },
    tunnel: {
      configured: true,
      domain: 'uni-cal.app',
    },
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    pid: process.pid,
  });
});

app.post("/api/admin/update-passwords", (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const { adminPassword, partnerPassword, guestPassword } = req.body;
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  const updateEnvVar = (content: string, key: string, value: string | null): string => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (value === null || value === '') {
      return content.replace(regex, '').replace(/\n{2,}/g, '\n').trim() + '\n';
    }
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return content.trim() + `\n${key}=${value}\n`;
  };
  if (adminPassword !== undefined) envContent = updateEnvVar(envContent, 'SITE_PASSWORD', adminPassword);
  if (partnerPassword !== undefined) envContent = updateEnvVar(envContent, 'SITE_PASSWORD_4201', partnerPassword);
  if (guestPassword !== undefined) envContent = updateEnvVar(envContent, 'SITE_PASSWORD_1010', guestPassword);
  fs.writeFileSync(envPath, envContent);
  res.json({ success: true, message: 'Passwords updated in .env file. Restart the app for changes to take effect.' });
});

app.post("/api/admin/revoke-session", (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const { sessionId } = req.body;
  for (const [key] of activeSessions) {
    if (key.substring(0, 8) + '...' === sessionId) {
      activeSessions.delete(key);
      return res.json({ success: true });
    }
  }
  res.status(404).json({ error: "Session not found" });
});

app.post("/api/admin/restart", (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  res.json({ success: true, message: 'Restarting...' });
  setTimeout(() => process.exit(0), 1000);
});

const adminDb = new PgPool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    await adminDb.query(`CREATE TABLE IF NOT EXISTS profile_settings (
      id SERIAL PRIMARY KEY,
      profile_level TEXT NOT NULL UNIQUE,
      profile_name TEXT NOT NULL,
      show_outlook_calendar BOOLEAN DEFAULT true,
      show_google_calendar BOOLEAN DEFAULT true,
      show_second_google_calendar BOOLEAN DEFAULT true,
      show_tasks BOOLEAN DEFAULT true,
      show_weather BOOLEAN DEFAULT true,
      show_news_ticker BOOLEAN DEFAULT true,
      show_homework_panel BOOLEAN DEFAULT true,
      show_degree_tracking BOOLEAN DEFAULT false,
      show_bryn_assist BOOLEAN DEFAULT false,
      show_notepad BOOLEAN DEFAULT false,
      show_radio BOOLEAN DEFAULT true,
      can_edit_tasks BOOLEAN DEFAULT false,
      can_add_calendar_events BOOLEAN DEFAULT false,
      can_access_settings BOOLEAN DEFAULT false,
      can_view_library BOOLEAN DEFAULT false,
      custom_calendars TEXT DEFAULT '[]',
      enabled BOOLEAN DEFAULT true
    )`);
    const existing = await adminDb.query('SELECT COUNT(*) FROM profile_settings');
    if (parseInt(existing.rows[0].count) === 0) {
      await adminDb.query(`INSERT INTO profile_settings (profile_level, profile_name, show_degree_tracking, show_bryn_assist, show_notepad, can_edit_tasks, can_add_calendar_events, can_access_settings, can_view_library) VALUES
        ('5747', 'Admin', true, true, true, true, true, true, true),
        ('4201', 'Partner', false, false, false, false, true, false, false),
        ('1010', 'Guest', false, false, false, false, false, false, false)`);
    }
    console.log('[Admin] profile_settings table ready');
    await adminDb.query(`ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS documents_deadline TEXT`).catch(() => {});
    await adminDb.query(`ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS interview_date TEXT`).catch(() => {});
  } catch (e: any) { console.error('[Admin] profile_settings init error:', e.message); }
})();

app.get("/api/admin/users", async (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  try {
    const result = await adminDb.query('SELECT id, username, email, display_name, auth_level, profile_name, must_change_password, enabled, created_at, last_login FROM users ORDER BY id');
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/users", async (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const { username, email, displayName, authLevel, password } = req.body;
  if (!username || !displayName) return res.status(400).json({ error: "Username and display name required" });
  try {
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const result = await adminDb.query(
      'INSERT INTO users (username, email, display_name, password_hash, auth_level, must_change_password, enabled) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, username, email, display_name, auth_level, must_change_password, enabled, created_at',
      [username, email || null, displayName, hash, authLevel || '1010', true]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/admin/users/:id", async (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const { id } = req.params;
  const { displayName, authLevel, enabled, password, email } = req.body;
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (displayName !== undefined) { sets.push(`display_name = $${idx++}`); vals.push(displayName); }
    if (authLevel !== undefined) { sets.push(`auth_level = $${idx++}`); vals.push(authLevel); }
    if (enabled !== undefined) { sets.push(`enabled = $${idx++}`); vals.push(enabled); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); vals.push(email); }
    if (password) { sets.push(`password_hash = $${idx++}`); vals.push(await bcrypt.hash(password, 10)); sets.push(`must_change_password = false`); }
    if (sets.length === 0) return res.json({ success: true });
    vals.push(id);
    await adminDb.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const { id } = req.params;
  try {
    await adminDb.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/profiles", async (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  try {
    const result = await adminDb.query('SELECT * FROM profile_settings ORDER BY id');
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/admin/profiles/:id", async (req: Request, res: Response) => {
  if (!getAdminAuth(req)) return res.status(403).json({ error: "Admin access required" });
  const { id } = req.params;
  const updates = req.body;
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    const allowedFields = ['profile_name', 'show_outlook_calendar', 'show_google_calendar', 'show_second_google_calendar', 'show_tasks', 'show_weather', 'show_news_ticker', 'show_homework_panel', 'show_degree_tracking', 'show_bryn_assist', 'show_notepad', 'show_radio', 'can_edit_tasks', 'can_add_calendar_events', 'can_access_settings', 'can_view_library', 'custom_calendars', 'enabled'];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sets.push(`${key} = $${idx++}`);
        vals.push(value);
      }
    }
    if (sets.length === 0) return res.json({ success: true });
    vals.push(id);
    await adminDb.query(`UPDATE profile_settings SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login-user", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: "Username and password required" });
  try {
    const result = await adminDb.query('SELECT * FROM users WHERE username = $1 AND enabled = true', [username]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ success: false, message: "Password not set. Use your access code to log in, then set a password in Admin settings." });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const token = createSessionToken(user.auth_level);
    trackSession(token, user.auth_level, req);
    await adminDb.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    res.cookie("uni_cal_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return res.json({ success: true, token, level: user.auth_level, mustChangePassword: user.must_change_password, displayName: user.display_name });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

app.post("/api/auth/set-password", async (req: Request, res: Response) => {
  const token = getAuthToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  const parsed = parseToken(token);
  if (!parsed.valid) return res.status(401).json({ error: "Invalid token" });
  const { username, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await adminDb.query('UPDATE users SET password_hash = $1, must_change_password = false WHERE username = $2', [hash, username]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!SITE_PASSWORD) return next();
  if (process.env.NODE_ENV !== "production") return next();
  if (req.path.startsWith("/api/auth/")) return next();
  if (req.path.startsWith("/api/admin/")) return next();
  if (req.path.startsWith("/api/webhook/")) return next();
  if (req.path.startsWith("/api/shower/")) return next();
  if (req.path.startsWith("/api/cat-wash/")) return next();
  if (req.path.startsWith("/api/tablet-nav")) return next();
  if (req.path === "/api/debug-beacon") return next();
  if (req.path === "/tablet") return next();
  if (req.path.startsWith("/api/tts-audio/")) return next();
  if (req.path === "/api/ticker" || req.path.startsWith("/api/ticker-assets/")) return next();
  if (req.path === "/api/news" || req.path === "/api/weather" || req.path === "/api/pollen" || req.path === "/api/weather-alerts") return next();
  if (req.path.startsWith("/api/webhook/") || req.path === "/api/announcements/webhook") return next();
  if (req.path === "/api/client-error") return next();
  if (req.path === "/api/test-nest-speaker") return next();
  if (req.path === "/api/onedrive/auth" || req.path === "/api/onedrive/status") return next();
  if (req.path === "/api/export" || req.path === "/api/import" || req.path === "/api/cleanup-duplicates") return next();
  if (req.path === "/api/shift-schedule" && req.method === "POST") return next();
  if (req.path.startsWith("/api/files/") && req.method === "PATCH") return next();
  if (req.path === "/login") return next();
  if (req.path.startsWith("/assets/") || req.path.startsWith("/favicon")) return next();

  if (isAutoAuthRequest(req)) {
    const newToken = createSessionToken(getAutoAuthLevel(req));
    res.cookie("uni_cal_session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return next();
  }

  const token = getAuthToken(req);
  if (token) {
    try {
      if (isValidToken(token)) {
        return next();
      }
    } catch (e) {}
  }

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  return next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  if (process.env.NODE_ENV === "production") {
    try {
      const { execSync } = await import("child_process");
      console.log("[DB] Auto-syncing database schema...");
      execSync("npx drizzle-kit push --force", { stdio: "pipe", timeout: 30000 });
      console.log("[DB] Schema sync complete");
    } catch (e: any) {
      console.warn("[DB] Schema sync failed (non-fatal):", e.message?.split("\n")[0]);
    }
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);

  function gracefulShutdown(signal: string) {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      console.log(`[Server] HTTP server closed, port ${port} released`);
      process.exit(0);
    });
    setTimeout(() => {
      console.error(`[Server] Forced shutdown after timeout`);
      process.exit(1);
    }, 5000);
  }
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${port} in use, retrying in 3s...`);
      setTimeout(() => {
        httpServer.close();
        httpServer.listen({ port, host: '0.0.0.0', reusePort: true });
      }, 3000);
    } else {
      console.error(`[Server] Error:`, err);
      process.exit(1);
    }
  });

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startReminderScheduler();
      checkAndSwitchSemester();
      setInterval(checkAndSwitchSemester, 60 * 60 * 1000);

      async function runFileMonitor() {
        try {
          const resp = await fetch(`http://localhost:${port}/api/files/monitor-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const data = await resp.json();
          if (data.totalSynced > 0) {
            console.log(`[File Monitor] Synced ${data.totalSynced} new Spring/Summer files`);
          }
        } catch (e: any) {
          console.error("[File Monitor] Error:", e.message);
        }
      }
      setTimeout(runFileMonitor, 10000);
      setInterval(runFileMonitor, 30 * 1000);

      setTimeout(async () => {
        try {
          console.log('[Startup] Running one-time text re-extraction for files missing extractedText...');
          const resp = await fetch(`http://localhost:${port}/api/files/pre-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const data = await resp.json();
          console.log(`[Startup] Pre-extract result:`, data);
        } catch (e: any) {
          console.error('[Startup] Pre-extract error:', e.message);
        }
      }, 20000);

      async function ensureFutureSemesters() {
        try {
          const { storage } = await import("./storage");
          const all = await storage.getAllSemesterSettings();
          const existingNames = new Set(all.map((s: any) => s.semesterName));
          const requiredSemesters = [
            { semesterName: 'Spring/Summer 2026', semesterType: 'spring_summer', semesterStartDate: new Date('2026-05-04'), semesterEndDate: new Date('2026-08-07'), course1Code: 'CECN210', course1Name: 'Understanding Economics', course1DisplayName: 'Economics', course1SpringSummerTerm: 'full', course2Code: 'CPHL110', course2Name: 'Philosophy of Religion', course2DisplayName: 'Philosophy of Religion', course2SpringSummerTerm: 'first_half', course3Code: 'CHIS105', course3Name: 'Inventing Popular Culture', course3DisplayName: 'Popular Culture', course3SpringSummerTerm: 'second_half', course1StartDate: new Date('2026-05-04'), course1EndDate: new Date('2026-07-31'), course2StartDate: new Date('2026-05-04'), course2EndDate: new Date('2026-06-20'), course3StartDate: new Date('2026-06-23'), course3EndDate: new Date('2026-08-04') },
            { semesterName: 'Fall 2026', semesterType: 'fall', semesterStartDate: new Date('2026-09-07'), semesterEndDate: new Date('2026-12-11'), course1Code: 'CPPA235', course1Name: 'CPPA235 - TBD', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Winter 2027', semesterType: 'winter', semesterStartDate: new Date('2027-01-11'), semesterEndDate: new Date('2027-04-16'), course1Code: 'TBD1', course1Name: 'TBD1', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Spring/Summer 2027', semesterType: 'spring_summer', semesterStartDate: new Date('2027-05-03'), semesterEndDate: new Date('2027-08-06'), course1Code: 'TBD1', course1Name: 'TBD1', course1SpringSummerTerm: 'full', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Fall 2027', semesterType: 'fall', semesterStartDate: new Date('2027-09-13'), semesterEndDate: new Date('2027-12-17'), course1Code: 'TBD1', course1Name: 'TBD1', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Winter 2028', semesterType: 'winter', semesterStartDate: new Date('2028-01-10'), semesterEndDate: new Date('2028-04-14'), course1Code: 'TBD1', course1Name: 'TBD1', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Spring/Summer 2028', semesterType: 'spring_summer', semesterStartDate: new Date('2028-05-01'), semesterEndDate: new Date('2028-08-04'), course1Code: 'TBD1', course1Name: 'TBD1', course1SpringSummerTerm: 'full', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Fall 2028', semesterType: 'fall', semesterStartDate: new Date('2028-09-11'), semesterEndDate: new Date('2028-12-15'), course1Code: 'TBD1', course1Name: 'TBD1', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
            { semesterName: 'Winter 2029', semesterType: 'winter', semesterStartDate: new Date('2029-01-08'), semesterEndDate: new Date('2029-04-13'), course1Code: 'TBD1', course1Name: 'TBD1', course2Code: 'TBD2', course2Name: 'TBD2', course3Code: 'TBD3', course3Name: 'TBD3' },
          ];
          const created: string[] = [];
          for (const sem of requiredSemesters) {
            if (!existingNames.has(sem.semesterName)) {
              await storage.createSemesterSettingsInactive(sem as any);
              created.push(sem.semesterName);
            }
          }
          if (created.length > 0) {
            console.log(`[Semesters] Created missing semesters: ${created.join(', ')}`);
          }
          const removeSemesters = ['Spring/Summer 2029', 'Fall 2029'];
          for (const semName of removeSemesters) {
            const existing = all.find((s: any) => s.semesterName === semName);
            if (existing) {
              await storage.deleteSemesterSettings(existing.id);
              console.log(`[Semesters] Removed obsolete semester: ${semName}`);
            }
          }
          const ss2026 = all.find((s: any) => s.semesterName === 'Spring/Summer 2026');
          if (ss2026 && !ss2026.course1DisplayName) {
            const displayUpdates: Record<string, string> = {};
            if (ss2026.course1Code === 'CECN210') displayUpdates.course1DisplayName = 'Economics';
            if (ss2026.course2Code === 'CPHL110') displayUpdates.course2DisplayName = 'Philosophy of Religion';
            if (ss2026.course3Code === 'CHIS105') displayUpdates.course3DisplayName = 'Popular Culture';
            if (ss2026.course1Name?.includes('CECN210 - ')) displayUpdates.course1Name = ss2026.course1Name.replace('CECN210 - ', '');
            if (ss2026.course2Name?.includes('CPHL110 - ')) displayUpdates.course2Name = ss2026.course2Name.replace('CPHL110 - ', '');
            if (ss2026.course3Name?.includes('CHIS105 - ')) displayUpdates.course3Name = ss2026.course3Name.replace('CHIS105 - ', '');
            if (Object.keys(displayUpdates).length > 0) {
              await storage.updateSemesterSettings(ss2026.id, displayUpdates);
              console.log(`[Semesters] Set SS2026 display names: ${JSON.stringify(displayUpdates)}`);
            }
          }
        } catch (e: any) {
          console.error("[Semesters] Error ensuring future semesters:", e.message);
        }
      }
      setTimeout(ensureFutureSemesters, 5000);

      async function ensureOneDrivePlaceholders() {
        try {
          const resp = await fetch(`http://localhost:${port}/api/onedrive/ensure-placeholder-folders`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const data = await resp.json();
          const placeholders = data.placeholders || [];
          if (placeholders.length > 0) {
            console.log(`[OneDrive] Created ${placeholders.length} placeholder folders: ${placeholders.join(', ')}`);
          } else {
            console.log(`[OneDrive] All year/semester placeholder folders already exist`);
          }
        } catch (e: any) {
          console.error("[OneDrive] Error ensuring placeholder folders:", e.message);
        }
      }
      setTimeout(ensureOneDrivePlaceholders, 15000);
    },
  );
})();
