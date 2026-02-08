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
const activeSessions = new Set<string>();

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!SITE_PASSWORD) {
    return res.json({ success: true });
  }
  if (password === SITE_PASSWORD) {
    const token = generateSessionToken();
    activeSessions.add(token);
    res.cookie("uni_cal_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: "Incorrect password" });
});

app.get("/api/auth/check", (req: Request, res: Response) => {
  if (!SITE_PASSWORD) {
    return res.json({ authenticated: true });
  }
  const token = req.cookies?.uni_cal_session;
  if (token && activeSessions.has(token)) {
    return res.json({ authenticated: true });
  }
  return res.json({ authenticated: false });
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const token = req.cookies?.uni_cal_session;
  if (token) {
    activeSessions.delete(token);
  }
  res.clearCookie("uni_cal_session");
  return res.json({ success: true });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!SITE_PASSWORD) return next();
  if (req.path.startsWith("/api/auth/")) return next();
  if (req.path === "/login") return next();
  if (req.path.startsWith("/assets/") || req.path.startsWith("/favicon")) return next();

  const token = req.cookies?.uni_cal_session;
  if (token && activeSessions.has(token)) {
    return next();
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
