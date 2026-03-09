import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startReminderScheduler } from "./reminderScheduler";
import crypto from "crypto";
import cookieParser from "cookie-parser";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cookieParser());

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const SITE_PASSWORD = process.env.SITE_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || "uni-cal-session-key";

const TOKEN_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function createSessionToken(): string {
  const timestamp = Date.now().toString(36);
  const sig = crypto.createHmac("sha256", SESSION_SECRET)
    .update(`uni-cal-auth:${SITE_PASSWORD}:${timestamp}`)
    .digest("hex");
  return `${timestamp}.${sig}`;
}

function isValidToken(token: string): boolean {
  if (!SITE_PASSWORD) return true;
  if (!token || typeof token !== "string") return false;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;
  const timestamp = token.substring(0, dotIndex);
  const sig = token.substring(dotIndex + 1);
  if (!/^[a-z0-9]+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  const created = parseInt(timestamp, 36);
  if (isNaN(created) || Date.now() - created > TOKEN_MAX_AGE_MS) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET)
    .update(`uni-cal-auth:${SITE_PASSWORD}:${timestamp}`)
    .digest("hex");
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
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
  return autoAuth === SITE_PASSWORD;
}

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!SITE_PASSWORD) {
    return res.json({ success: true, token: '' });
  }
  if (password === SITE_PASSWORD) {
    const token = createSessionToken();
    res.cookie("uni_cal_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: "Incorrect password" });
});

app.get("/api/auth/check", (req: Request, res: Response) => {
  if (!SITE_PASSWORD) {
    return res.json({ authenticated: true });
  }
  if (isAutoAuthRequest(req)) {
    const token = createSessionToken();
    res.cookie("uni_cal_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return res.json({ authenticated: true, token });
  }
  const token = getAuthToken(req);
  if (token) {
    try {
      if (isValidToken(token)) {
        return res.json({ authenticated: true });
      }
    } catch (e) {}
  }
  return res.json({ authenticated: false });
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie("uni_cal_session");
  return res.json({ success: true });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!SITE_PASSWORD) return next();
  if (process.env.NODE_ENV !== "production") return next();
  if (req.path.startsWith("/api/auth/")) return next();
  if (req.path.startsWith("/api/webhook/")) return next();
  if (req.path.startsWith("/api/shower/")) return next();
  if (req.path.startsWith("/api/cat-wash/")) return next();
  if (req.path === "/api/client-error") return next();
  if (req.path === "/api/export" || req.path === "/api/import" || req.path === "/api/cleanup-duplicates") return next();
  if (req.path.startsWith("/api/files/") && req.method === "PATCH") return next();
  if (req.path === "/login") return next();
  if (req.path.startsWith("/assets/") || req.path.startsWith("/favicon")) return next();

  if (isAutoAuthRequest(req)) {
    const newToken = createSessionToken();
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
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startReminderScheduler();
    },
  );
})();
