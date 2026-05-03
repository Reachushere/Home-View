#!/usr/bin/env node
// Cron alerter — hits /api/dev/diagnose every run; alerts when primaryBlocker
// is anything other than "no_blocker_detected".
//
// Pi setup (every 15 min):
//   crontab -e
//   */15 * * * * /usr/bin/node /home/pi/Home-View/scripts/cron-alert.mjs >> /home/pi/Home-View/.local/cron-alert.log 2>&1
//
// Required env (set in /etc/environment or wrap with env vars in crontab):
//   DEV_KEY=...                        # x-dev-key header for /api/dev/*
//   ALERT_BASE_URL=https://uni-cal.app # default
//   ALERT_EMAIL_TO=bryn@example.com    # optional — falls back to log-only
//   ALERT_WEBHOOK_URL=https://...      # optional — POSTs JSON if set
//
// Safe by design: read-only HTTP GET, no DB access, no device triggers.

import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const BASE = process.env.ALERT_BASE_URL || "https://uni-cal.app";
const KEY = process.env.DEV_KEY || "";
const EMAIL = process.env.ALERT_EMAIL_TO || "";
const WEBHOOK = process.env.ALERT_WEBHOOK_URL || "";
const STATE_FILE = process.env.ALERT_STATE_FILE || "/tmp/unical-alert-state.json";

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request({
      method: "GET",
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: { "x-dev-key": KEY, "user-agent": "unical-cron-alert/1.0" },
      timeout: 10000,
    }, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, json: null, body }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.end();
  });
}

function postJSON(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const data = JSON.stringify(payload);
    const req = lib.request({
      method: "POST",
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) },
      timeout: 10000,
    }, res => { res.on("data", () => {}); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject);
    req.end(data);
  });
}

async function loadState() {
  try { const fs = await import("node:fs"); return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { lastBlocker: null, lastAlertAt: 0 }; }
}
async function saveState(s) {
  try { const fs = await import("node:fs"); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {}
}

(async () => {
  const ts = new Date().toISOString();
  try {
    const r = await get(`${BASE}/api/dev/diagnose`);
    if (r.status !== 200 || !r.json) {
      console.log(`[${ts}] DIAGNOSE_HTTP_FAIL status=${r.status}`);
      return;
    }
    const d = r.json;
    const blocker = d.primaryBlocker || "unknown";
    const state = await loadState();
    const isAlert = blocker !== "no_blocker_detected";
    // Re-alert at most once per 6 hours for the same blocker.
    const sixHrs = 6 * 60 * 60 * 1000;
    const shouldNotify = isAlert && (state.lastBlocker !== blocker || Date.now() - state.lastAlertAt > sixHrs);

    console.log(`[${ts}] blocker=${blocker} confidence=${d.confidence} fixActions=${(d.fixActions || []).length} notify=${shouldNotify}`);

    if (shouldNotify) {
      const subject = `[UniCal] ${blocker}`;
      const body = `${d.summary}\n\nNext step: ${d.recommendedNextStep}\n\nFix actions available: ${(d.fixActions || []).map(a => a.label).join(", ") || "(none)"}\n\nDev Panel: ${BASE} (Cmd-Shift-D)`;
      if (WEBHOOK) {
        try { const code = await postJSON(WEBHOOK, { subject, body, blocker, diagnose: d, ts }); console.log(`[${ts}] webhook=${code}`); }
        catch (e) { console.log(`[${ts}] webhook_fail ${e.message}`); }
      }
      if (EMAIL) {
        // Stub: email delivery is project-specific. Wire to /api/sendmail or sendmail(8) here.
        console.log(`[${ts}] email_to=${EMAIL} subject=${subject}`);
      }
      await saveState({ lastBlocker: blocker, lastAlertAt: Date.now() });
    } else if (!isAlert && state.lastBlocker) {
      // Recovered — log + reset.
      console.log(`[${ts}] RECOVERED from ${state.lastBlocker}`);
      await saveState({ lastBlocker: null, lastAlertAt: 0 });
    }
  } catch (e) {
    console.log(`[${ts}] ERROR ${e.message}`);
  }
})();
