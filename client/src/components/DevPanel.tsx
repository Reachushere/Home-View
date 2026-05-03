import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

// Hidden developer introspection panel.
// Toggle with Ctrl+Shift+D, or visit any page with `?dev=1`.
// Also POSTs a layout snapshot to /api/dev/layout-map every 3s while open.
//
// Tabs:
//   Trace · Flow · Replay · Validate · File · Build · Perf · Flags · System · Layout
// Buttons (top): Copy Debug Pack · Copy Handoff · Copy Status · Copy Page

type Trace = { time: string; step: string; data?: any; decision?: string; reason?: string };
type FileSel = any;
type TabId =
  | "trace" | "flow" | "replay" | "validate" | "file"
  | "build" | "perf" | "flags" | "system" | "layout" | "help" | "rollback" | "fixhist"
  | "upload" | "timeline" | "afterUpload";

// ───── DEV_API_KEY auto-attach ─────
// Stored in localStorage under `unical:devKey`. Sent as x-dev-key on every dev request.
// On first 401, prompts once and persists. Never logged or rendered.
const DEV_KEY_STORAGE = "unical:devKey";
function getDevKey(): string {
  try { return localStorage.getItem(DEV_KEY_STORAGE) || ""; } catch { return ""; }
}
function setDevKey(k: string) {
  try { if (k) localStorage.setItem(DEV_KEY_STORAGE, k); else localStorage.removeItem(DEV_KEY_STORAGE); } catch {}
}
function promptForDevKeyOnce(): string {
  if ((promptForDevKeyOnce as any)._inflight) return getDevKey();
  (promptForDevKeyOnce as any)._inflight = true;
  try {
    const entered = window.prompt("Enter DEV_API_KEY for /api/dev/* access:") || "";
    if (entered) setDevKey(entered);
    return entered;
  } finally {
    setTimeout(() => { (promptForDevKeyOnce as any)._inflight = false; }, 500);
  }
}
const j = async (url: string, init?: RequestInit) => {
  const isDev = url.startsWith("/api/dev");
  const headers: Record<string, string> = { ...(init?.headers as any || {}) };
  if (isDev) {
    const k = getDevKey();
    if (k) headers["x-dev-key"] = k;
  }
  let r = await fetch(url, { ...init, headers });
  if (r.status === 401 && isDev) {
    const entered = promptForDevKeyOnce();
    if (entered) {
      headers["x-dev-key"] = entered;
      r = await fetch(url, { ...init, headers });
    }
  }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : r.text();
};

export function DevPanel() {
  const [open, setOpen] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).get("dev") === "1"; } catch { return false; }
  });
  const [trace, setTrace] = useState<Trace[]>([]);
  const [fileSel, setFileSel] = useState<FileSel | null>(null);
  const [sysMap, setSysMap] = useState<any>(null);
  const [flow, setFlow] = useState<any>(null);
  const [diag, setDiag] = useState<any>(null);
  const [stagingMode, setStagingMode] = useState<boolean>(false);
  const [sandbox, setSandbox] = useState<{ enabled: boolean; source: string; counters: Record<string, number>; recent: any[] } | null>(null);
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [initChecklist, setInitChecklist] = useState<{ ready: boolean; checks: Array<{ id: string; label: string; status: 'pass'|'fail'; message: string; fix: string | null }>; generatedAt: string } | null>(null);
  const [initOverride, setInitOverride] = useState<boolean>(() => {
    try { return localStorage.getItem('unical_init_override') === '1'; } catch { return false; }
  });
  const [initBusy, setInitBusy] = useState(false);
  const refreshInitChecklist = async () => {
    setInitBusy(true);
    try {
      const r = await fetch('/api/dev/init-checklist');
      const j = await r.json();
      setInitChecklist(j);
    } catch {} finally { setInitBusy(false); }
  };
  const [fixHist, setFixHist] = useState<any>(null);
  const [upload, setUpload] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [afterUpload, setAfterUpload] = useState<any>(null);
  const [afterMin, setAfterMin] = useState<number>(60);
  const [diagBanner, setDiagBanner] = useState<string[]>([]);
  const pushDiag = (...lines: string[]) => setDiagBanner(b => [...lines, ...b].slice(0, 40));
  const [fixFilterAction, setFixFilterAction] = useState<string>("");
  const [fixFilterMode, setFixFilterMode] = useState<"all"|"dryRun"|"real">("all");
  const [build, setBuild] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [flags, setFlagsState] = useState<any>(null);
  const [tab, setTab] = useState<TabId>("trace");
  const [clickProofCount, setClickProofCount] = useState(0);
  const [busy, setBusy] = useState(false);
  // Console error capture (last 20)
  const [consoleErrors, setConsoleErrors] = useState<{ time: string; msg: string }[]>([]);
  // Guided Fix wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizIssue, setWizIssue] = useState("");
  const [wizArea, setWizArea] = useState<"" | "visual" | "data" | "automation" | "onedrive" | "tts" | "calendar" | "cat_lights" | "files" | "database" | "frontend" | "backend" | "unknown">("");
  const [wizSide, setWizSide] = useState<"" | "frontend" | "backend" | "unknown">("");
  const [wizSince, setWizSince] = useState<"" | "frontend_change" | "backend_change" | "unknown">("");
  const [wizPrompt, setWizPrompt] = useState("");
  const [commits, setCommits] = useState<any>(null);
  const [pickedSha, setPickedSha] = useState<string>("");

  // ───── secret/PII redaction (applied to every JSON payload before clipboard) ─────
  const SECRET_KEY_RE = /(token|secret|apikey|api_key|password|passwd|bearer|authorization|client_secret|refresh_token|access_token|cookie|session|private_key|x-dev-key|graphtoken|ha_token|home_assistant_token|github_personal_access_token)/i;
  const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const BEARER_RE = /\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g;
  const GH_PAT_RE = /\bghp_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g;
  const scrubValue = (v: any): any => {
    if (v == null) return v;
    if (typeof v === "string") {
      let s = v;
      s = s.replace(GH_PAT_RE, "<REDACTED:gh-pat>");
      s = s.replace(EMAIL_RE, "<REDACTED:email>");
      // Only scrub long opaque tokens — keep ordinary words/IDs readable
      if (s.length > 32) s = s.replace(BEARER_RE, m => m.length >= 32 ? "<REDACTED:token>" : m);
      return s;
    }
    if (Array.isArray(v)) return v.map(scrubValue);
    if (typeof v === "object") {
      const out: any = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = SECRET_KEY_RE.test(k) ? "<REDACTED>" : scrubValue(val);
      }
      return out;
    }
    return v;
  };
  const safe = (obj: any) => JSON.stringify(scrubValue(obj), null, 2);
  // Replay form state
  const [rDate, setRDate] = useState("");
  const [rWeek, setRWeek] = useState("");
  const [replayResult, setReplayResult] = useState<any>(null);
  // Validate form state
  const [vWeek, setVWeek] = useState("");
  const [vAction, setVAction] = useState<"" | "PROMPT" | "CHUM" | "INVALID_WEEK_ABORT" | "UNKNOWN">("");
  const [validateResult, setValidateResult] = useState<any>(null);
  const tickRef = useRef<number | null>(null);

  // Intercept console.error → keep last 20 (mounted always so we capture pre-open errors).
  useEffect(() => {
    const orig = console.error;
    console.error = (...args: any[]) => {
      try {
        const msg = args.map(a => {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(" ").slice(0, 800);
        setConsoleErrors(prev => [...prev.slice(-19), { time: new Date().toISOString(), msg }]);
      } catch {}
      orig.apply(console, args);
    };
    return () => { console.error = orig; };
  }, []);

  // Toggle hotkey + Shift+Alt+Arrows to nudge panel (drag fallback).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      if (e.shiftKey && e.altKey && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = 20;
        setGeom(g => {
          let { x, y } = g;
          if (e.key === "ArrowLeft") x = Math.max(0, x - step);
          else if (e.key === "ArrowRight") x = Math.min(window.innerWidth - 80, x + step);
          else if (e.key === "ArrowUp") y = Math.max(0, y - step);
          else if (e.key === "ArrowDown") y = Math.min(window.innerHeight - 30, y + step);
          console.log(`[DevPanel] keyboard nudge ${e.key} -> (${x},${y})`);
          return { ...g, x, y };
        });
        return;
      }
      // Shift+Alt+P -> run probe (works even when panel buttons are dead). Output goes to VISIBLE banner.
      if (e.shiftKey && e.altKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        const lines: string[] = [];
        const log = (s: string) => { lines.push(s); console.log(s); };
        try {
          const handle = document.querySelector('[data-testid="dev-panel-drag-handle"]') as HTMLElement | null;
          const tabBar = document.querySelector('[data-testid="tab-dev-trace"]') as HTMLElement | null;
          const probeBtn = document.querySelector('[data-testid="button-dev-probe"]') as HTMLElement | null;
          const copyBtn = document.querySelector('[data-testid="button-dev-copy-debug-pack"]') as HTMLElement | null;
          const probe = (label: string, el: HTMLElement | null) => {
            if (!el) { log(`${label}: NOT FOUND`); return; }
            const r = el.getBoundingClientRect();
            const cx = Math.round(r.left + r.width / 2);
            const cy = Math.round(r.top + r.height / 2);
            const stack = document.elementsFromPoint(cx, cy);
            log(`▼ ${label} @(${cx},${cy})`);
            stack.slice(0, 5).forEach((node, i) => {
              const n = node as HTMLElement;
              const cs = window.getComputedStyle(n);
              const tid = n.dataset?.testid ? `#${n.dataset.testid}` : '';
              const cls = (typeof n.className === 'string' ? n.className.split(' ')[0] : '').slice(0, 24);
              log(`  [${i}] <${n.tagName.toLowerCase()}>${tid} ${cls} pe=${cs.pointerEvents} z=${cs.zIndex}`);
            });
          };
          log('===== PROBE @ ' + new Date().toLocaleTimeString() + ' =====');
          probe('DRAG-HANDLE', handle);
          probe('TAB-TRACE', tabBar);
          probe('PROBE-BTN', probeBtn);
          probe('COPY-BTN(works)', copyBtn);
        } catch (err: any) { log(`error: ${err?.message || err}`); }
        pushDiag(...lines.reverse());
        return;
      }
      // Shift+Alt+C -> clear diag banner
      if (e.shiftKey && e.altKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        setDiagBanner([]);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    // Window-level pointerdown logger — captures EVERY click. Logs to visible banner if click is inside panel area.
    const onWinPD = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      const tid = t?.dataset?.testid || '';
      const tag = t?.tagName?.toLowerCase() || '?';
      const panelEl = document.querySelector('[data-testid="dev-panel"]') as HTMLElement | null;
      const inPanel = !!t?.closest?.('[data-testid="dev-panel"]');
      // Also fire diagnostics when the click coords fall inside the panel rect
      // but the actual event target is OUTSIDE the panel — that means another
      // overlay is intercepting our clicks.
      let coordsInPanel = false;
      if (panelEl) {
        const r = panelEl.getBoundingClientRect();
        coordsInPanel = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      }
      if (!inPanel && !coordsInPanel) return;
      const stack = document.elementsFromPoint(ev.clientX, ev.clientY);
      const top = stack[0] as HTMLElement | undefined;
      const topTid = top?.dataset?.testid || '';
      const topTag = top?.tagName?.toLowerCase() || '?';
      const match = (top === t) ? 'MATCH' : 'MISMATCH';
      const blocker = (!inPanel && coordsInPanel)
        ? ` BLOCKED-BY=<${topTag}>${topTid?'#'+topTid:''}`
        : '';
      const line = `PD(${ev.clientX},${ev.clientY}) tgt=<${tag}>${tid?'#'+tid:''} top=<${topTag}>${topTid?'#'+topTid:''} ${match}${blocker}`;
      console.log('[WinPD] ' + line);
      pushDiag(line);
    };
    window.addEventListener("pointerdown", onWinPD, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onWinPD, true);
    };
  }, []);

  // Polling + layout snapshot push (only what's universally cheap).
  useEffect(() => {
    if (!open) {
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    const tick = async () => {
      try {
        const [t, f] = await Promise.all([
          j("/api/dev/automation-trace").catch(() => null),
          j("/api/dev/file-map").catch(() => null),
        ]);
        if (t?.steps) setTrace(t.steps.slice(-60).reverse());
        if (f) setFileSel(f);
      } catch {}
      // Push layout snapshot.
      try {
        const cal = document.querySelector('[data-testid^="calendar"], .calendar-grid, [class*="Calendar"]') as HTMLElement | null;
        const countdown = document.querySelector('[data-countdown-bullet], [data-countdown-badge]') as HTMLElement | null;
        const calBox = cal?.getBoundingClientRect();
        const cdBox = countdown?.parentElement?.getBoundingClientRect();
        const cdStyle = countdown?.parentElement ? window.getComputedStyle(countdown.parentElement) : null;
        const view = (document.querySelector('[data-testid="view-week"], [data-testid="view-month"]') as HTMLElement | null)?.dataset?.testid?.replace("view-", "") || "unknown";
        const _devKey = getDevKey();
        await fetch("/api/dev/layout-map", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(_devKey ? { "x-dev-key": _devKey } : {}) },
          body: JSON.stringify({
            view,
            countdown: { isFixed: cdStyle?.position === "fixed", top: cdBox?.top, height: cdBox?.height },
            calendar: { top: calBox?.top || 0, height: calBox?.height || 0, width: calBox?.width },
          }),
        });
      } catch {}
    };
    tick();
    tickRef.current = window.setInterval(tick, 3000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [open]);

  // Lazy-load the per-tab data only when the tab is opened.
  useEffect(() => {
    if (!open) return;
    if (tab === "system" && !sysMap) j("/api/dev/system-map").then(setSysMap).catch(() => setSysMap({ error: "fetch failed" }));
    if (tab === "flow") {
      j("/api/dev/flow-snapshot").then(setFlow).catch(() => {});
      j("/api/dev/diagnose").then(setDiag).catch(() => {});
    }
    if (tab === "build" || !build) j("/api/dev/build-info").then(setBuild).catch(() => {});
    if (tab === "rollback") j("/api/dev/recent-commits").then(setCommits).catch(() => setCommits({ error: "fetch failed" }));
    if (tab === "fixhist") j("/api/dev/fix-history?limit=200").then(setFixHist).catch(() => setFixHist({ error: "fetch failed" }));
    if (tab === "upload") j("/api/dev/upload-readiness").then(setUpload).catch(() => setUpload({ error: "fetch failed" }));
    if (tab === "timeline") j("/api/dev/timeline-guard").then(setTimeline).catch(() => setTimeline({ error: "fetch failed" }));
    if (tab === "afterUpload") j(`/api/dev/after-upload-check?sinceMin=${afterMin}`).then(setAfterUpload).catch(() => setAfterUpload({ error: "fetch failed" }));
    j("/api/dev/status").then((s: any) => { setStagingMode(!!s?.stagingMode); if (s?.sandbox) setSandbox(s.sandbox); }).catch(() => {});
    if (!initChecklist) refreshInitChecklist();
    if (tab === "perf") j("/api/dev/performance").then(setPerf).catch(() => {});
    if (tab === "flags" && !flags) j("/api/dev/flags").then(setFlagsState).catch(() => {});
  }, [open, tab]); // eslint-disable-line

  // ── Draggable + resizable panel geometry (persisted) ──
  type Geom = { x: number; y: number; w: number; h: number };
  const computeDefaultGeom = (): Geom => {
    const w = 520, h = Math.min(640, Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 0.8));
    const W = typeof window !== "undefined" ? window.innerWidth : 1200;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
    return { x: Math.max(8, W - w - 8), y: Math.max(8, H - h - 36), w, h };
  };
  const [geom, setGeom] = useState<Geom>(() => {
    try { const raw = localStorage.getItem("unical_devpanel_geom"); if (raw) { const g = JSON.parse(raw); if (g && typeof g.x === "number") return g; } } catch {}
    return computeDefaultGeom();
  });
  useEffect(() => { try { localStorage.setItem("unical_devpanel_geom", JSON.stringify(geom)); } catch {} }, [geom]);
  const dragRef = useRef<{ kind: "move" | "resize"; sx: number; sy: number; g: Geom; pid: number; el: HTMLElement | null } | null>(null);
  const startDrag = (kind: "move" | "resize") => (e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    // Don't start a drag from buttons/inputs inside the header
    const tgt = e.target as HTMLElement;
    if (tgt && (tgt.closest("button") || tgt.closest("input") || tgt.closest("select") || tgt.closest("textarea") || tgt.closest("a"))) return;
    e.preventDefault();
    e.stopPropagation();
    const isPointer = "pointerId" in e;
    const pid = isPointer ? (e as React.PointerEvent).pointerId : -1;
    const el = e.currentTarget;
    if (isPointer) { try { el.setPointerCapture(pid); } catch {} }
    dragRef.current = { kind, sx: e.clientX, sy: e.clientY, g: { ...geom }, pid, el };
    document.body.style.userSelect = "none";
    try { console.log("[DevPanel] drag start", kind, "pid=", pid, "g=", geom); } catch {}

    const onMove = (ev: PointerEvent | MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      if ("pointerId" in ev && d.pid >= 0 && (ev as PointerEvent).pointerId !== d.pid) return;
      const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
      if (d.kind === "move") {
        setGeom({ ...d.g, x: Math.max(0, Math.min(window.innerWidth - 80, d.g.x + dx)), y: Math.max(0, Math.min(window.innerHeight - 30, d.g.y + dy)) });
      } else {
        setGeom({ ...d.g, w: Math.max(320, Math.min(window.innerWidth - d.g.x, d.g.w + dx)), h: Math.max(220, Math.min(window.innerHeight - d.g.y, d.g.h + dy)) });
      }
    };
    const onUp = (ev: PointerEvent | MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      if ("pointerId" in ev && d.pid >= 0 && (ev as PointerEvent).pointerId !== d.pid) return;
      try { if (d.pid >= 0) d.el && d.el.releasePointerCapture(d.pid); } catch {}
      dragRef.current = null;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("pointerup", onUp as any);
      window.removeEventListener("pointercancel", onUp as any);
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp as any);
    };
    // Listen on BOTH pointer and mouse events for maximum browser compatibility
    window.addEventListener("pointermove", onMove as any);
    window.addEventListener("pointerup", onUp as any);
    window.addEventListener("pointercancel", onUp as any);
    window.addEventListener("mousemove", onMove as any);
    window.addEventListener("mouseup", onUp as any);
  };
  const resetGeom = () => setGeom(computeDefaultGeom());

  // Earlier attempt used the popover API to elevate the panel to the browser's
  // top layer. That had the side-effect of trapping ALL clicks (panel + outside)
  // and prevented the user from closing it. Reverted to a plain max-z-index
  // portal — relies on access-gate's overlay being z=2147482900 (lower).
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  // Force every descendant of the panel to be interactive. Defends against any
  // ancestor (body, dashboard root, Radix-leaked locks) setting pointer-events:
  // none which would inherit and silently kill clicks on children that don't
  // explicitly opt back in.
  useEffect(() => {
    if (!open) return;
    const id = "devpanel-force-interactive";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
[data-testid="dev-panel"], [data-testid="dev-panel"] * {
  pointer-events: auto !important;
  visibility: visible !important;
}
[data-testid="dev-panel"] button { cursor: pointer !important; }
`;
    document.head.appendChild(s);
  }, [open]);

  if (!open) return null;

  const panel: React.CSSProperties = {
    position: "fixed", left: geom.x, top: geom.y, zIndex: 2147483647,
    width: geom.w, height: geom.h, overflow: "hidden",
    background: "rgba(15,15,20,0.96)", color: "#e8e8ec",
    border: "1px solid rgba(120,120,150,0.4)", borderRadius: 10,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11, boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
    pointerEvents: "auto",
    display: "flex", flexDirection: "column",
    // Strip popover UA defaults (margin:auto centres it; padding adds inner gap).
    // Do NOT add `inset: "auto"` here — it would reset top/left/right/bottom and
    // override the explicit left/top above, parking the panel at (0,0).
    margin: 0, padding: 0,
  };
  const tabBtn = (id: TabId, label: string): React.CSSProperties => ({
    padding: "5px 8px", cursor: "pointer", border: "none",
    background: tab === id ? "rgba(96,165,250,0.18)" : "transparent",
    color: tab === id ? "#93c5fd" : "#bbb",
    borderBottom: tab === id ? "1px solid #60a5fa" : "1px solid transparent",
    fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
  });
  const actBtn = (color: string, bg: string): React.CSSProperties => ({
    flex: 1, padding: "5px 6px", fontSize: 10,
    background: bg, border: `1px solid ${color}66`,
    color, borderRadius: 4, cursor: "pointer",
  });
  const inp: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(120,120,150,0.4)",
    color: "#e8e8ec", padding: "3px 6px", borderRadius: 4, fontSize: 11, fontFamily: "inherit",
  };
  const codeBlock: React.CSSProperties = { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10, color: "#cbd5e1" };

  // ───── action: copy debug pack ─────
  const copyDebugPack = async () => {
    setBusy(true);
    try {
      const [status, snap, fmap, binfo, errs, p, ctrace, dx] = await Promise.all([
        j("/api/dev/status").catch(() => null),
        j("/api/dev/flow-snapshot").catch(() => null),
        j("/api/dev/file-map").catch(() => null),
        j("/api/dev/build-info").catch(() => null),
        j("/api/dev/recent-errors").catch(() => null),
        j("/api/dev/performance").catch(() => null),
        j("/api/dev/trace?subsystem=cat_lights").catch(() => null),
        j("/api/dev/diagnose").catch(() => null),
      ]);
      const sep = "─".repeat(60);
      const text = [
        "=== CHATGPT DEBUG PACK ===",
        `Generated: ${new Date().toISOString()}`,
        `Page: ${window.location.pathname + window.location.search}`,
        sep,
        "## SUMMARY",
        `semester:        ${snap?.semester ?? "—"}`,
        `weekNumber:      ${snap?.weekNumber ?? "—"}`,
        `finalAction:     ${snap?.finalAction ?? "—"}`,
        `blocker:         ${snap?.blocker ?? "(none)"}`,
        `build outOfDate: ${binfo?.outOfDate ? "YES — needs `npm run build`" : "no"}`,
        `db connected:    ${status?.connections?.database ? "yes" : "NO"}`,
        `oneDrive:        ${status?.connections?.oneDrive ? "connected" : "disconnected"}`,
        ...(dx ? [
          "",
          "## DIAGNOSIS",
          `primaryBlocker:    ${dx.primaryBlocker}`,
          `recommendedNext:   ${dx.recommendedNextStep}`,
          `confidence:        ${dx.confidence}`,
          `summary:           ${dx.summary}`,
        ] : []),
        sep,
        "## /api/dev/status", "```json", safe(status), "```", sep,
        "## /api/dev/build-info", "```json", safe(binfo), "```", sep,
        "## /api/dev/flow-snapshot (latest Cat Lights run)", "```json", safe(snap), "```", sep,
        "## /api/dev/diagnose", "```json", safe(dx), "```", sep,
        "## /api/dev/file-map", "```json", safe(fmap), "```", sep,
        "## /api/dev/performance", "```json", safe(p), "```", sep,
        "## /api/dev/recent-errors", "```json", safe(errs), "```", sep,
        "## /api/dev/trace?subsystem=cat_lights", "```json", safe(ctrace), "```",
      ].join("\n");
      await navigator.clipboard.writeText(text);
      alert(`Debug pack copied (${(text.length / 1024).toFixed(1)} KB) — paste into ChatGPT.`);
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  // ───── helpers: page introspection ─────
  const guessPageFiles = (path: string): string[] => {
    // Heuristic mapping route → likely client/src files. Keep coarse but useful.
    const p = path.split("?")[0].replace(/^\/+/, "");
    const seg = p.split("/")[0] || "dashboard";
    const map: Record<string, string[]> = {
      "": ["client/src/pages/Dashboard.tsx", "client/src/App.tsx"],
      dashboard: ["client/src/pages/Dashboard.tsx", "client/src/components/DashboardGrid.tsx"],
      "pdf-reader": ["client/src/pages/PdfReader.tsx", "client/src/components/AudioPlayer.tsx"],
      shower: ["client/src/pages/ShowerMode.tsx"],
      settings: ["client/src/pages/Settings.tsx"],
      onedrive: ["client/src/pages/OneDriveBrowser.tsx", "server/onedrive.ts"],
      calendar: ["client/src/pages/Calendar.tsx", "server/google-calendar.ts"],
      tasks: ["client/src/pages/Tasks.tsx"],
    };
    const guesses = map[seg] || [`client/src/pages/${seg.charAt(0).toUpperCase() + seg.slice(1)}.tsx`];
    return [...guesses, "client/src/components/DevPanel.tsx"];
  };
  const sniffSubsystem = (path: string, area?: string): "frontend" | "backend" | "both" => {
    if (area === "automation" || area === "tts" || area === "onedrive" || area === "calendar" || area === "cat_lights" || area === "database" || area === "backend") return "backend";
    if (area === "visual" || area === "frontend") return "frontend";
    if (area === "files") return "both";
    if (path.startsWith("/api/")) return "backend";
    return "both";
  };
  const captureLayoutSnapshot = () => {
    const interactive = Array.from(document.querySelectorAll('[data-testid]'))
      .slice(0, 60)
      .map(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return {
          testid: (el as HTMLElement).dataset.testid,
          tag: el.tagName.toLowerCase(),
          visible: r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          text: (el.textContent || "").trim().slice(0, 60),
        };
      });
    return interactive;
  };
  const redactProfile = (): any => {
    const out: any = { hint: "no profile context detected" };
    try {
      const lsKeys = ["unical:user", "unical:profile", "user", "profile"];
      for (const k of lsKeys) {
        const v = localStorage.getItem(k);
        if (v) {
          const parsed = JSON.parse(v);
          out.profile = {
            id: parsed?.id ?? "(present)",
            name: parsed?.name ? "(redacted)" : undefined,
            email: parsed?.email ? "(redacted)" : undefined,
            role: parsed?.role,
            timezone: parsed?.timezone,
          };
          delete out.hint;
          break;
        }
      }
      out.devFlag = new URLSearchParams(location.search).get("dev");
    } catch {}
    return out;
  };

  // ───── action: copy PAGE PACK ─────
  const copyPagePack = async () => {
    setBusy(true);
    try {
      const route = window.location.pathname + window.location.search;
      const [binfo, errs] = await Promise.all([
        j("/api/dev/build-info").catch(() => null),
        j("/api/dev/recent-errors").catch(() => null),
      ]);
      const layout = captureLayoutSnapshot();
      const visibleRoot = document.querySelector('main, [data-testid^="page-"], #root > div') as HTMLElement | null;
      const visibleComponent = visibleRoot?.dataset?.testid || document.title || "(unknown)";
      const guesses = guessPageFiles(window.location.pathname);
      const subsystem = sniffSubsystem(window.location.pathname);
      const sep = "─".repeat(60);
      const text = [
        "=== CHATGPT DEBUG PACK — CURRENT PAGE ===",
        `Generated: ${new Date().toISOString()}`,
        `Route:           ${route}`,
        `Visible page:    ${visibleComponent}`,
        `Browser size:    ${window.innerWidth}×${window.innerHeight} (dpr ${window.devicePixelRatio})`,
        `User-Agent:      ${navigator.userAgent}`,
        sep,
        "## INSTRUCTIONS FOR CHATGPT",
        `This pack describes a ${subsystem.toUpperCase()} concern unless the user says otherwise.`,
        `- Frontend changes require: \`npm run build && pm2 restart all\` on the Pi.`,
        `- Backend changes require: \`pm2 restart all\` (no rebuild needed).`,
        `- DO NOT modify Cat Lights logic, OneDrive sync, or TTS pipeline without confirmation.`,
        `- If the issue is visual, focus on the file guesses below before scanning the whole repo.`,
        sep,
        "## SUMMARY",
        `build outOfDate: ${binfo?.outOfDate ? "YES — needs `npm run build`" : "no"}`,
        `bundleHash:      ${binfo?.bundleHash ?? "—"}`,
        `console errors:  ${consoleErrors.length}`,
        sep,
        "## LIKELY FRONTEND FILES",
        ...guesses.map(g => `- ${g}`),
        sep,
        "## LAYOUT MAP (visible interactive elements)",
        "```json", safe(layout), "```", sep,
        "## CONSOLE ERRORS (last 20)",
        consoleErrors.length === 0 ? "(none captured since panel mounted)" : "```json\n" + safe(consoleErrors) + "\n```",
        sep,
        "## /api/dev/build-info", "```json", safe(binfo), "```", sep,
        "## /api/dev/recent-errors", "```json", safe(errs), "```", sep,
        "## PROFILE / USER CONTEXT (redacted)",
        "```json", safe(redactProfile()), "```",
      ].join("\n");
      await navigator.clipboard.writeText(text);
      alert(`Page pack copied (${(text.length / 1024).toFixed(1)} KB).`);
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  // ───── action: copy MINIMAL ChatGPT prompt (short — no raw JSON) ─────
  const copyMinimalPrompt = async () => {
    setBusy(true);
    try {
      const [dx, snap, binfo, errs] = await Promise.all([
        j("/api/dev/diagnose").catch(() => null),
        j("/api/dev/flow-snapshot").catch(() => null),
        j("/api/dev/build-info").catch(() => null),
        j("/api/dev/recent-errors").catch(() => null),
      ]);
      const route = window.location.pathname + window.location.search;
      const summarize = (label: string, obj: any) => {
        if (!obj) return `- ${label}: (unavailable)`;
        if (obj.empty) return `- ${label}: empty (${obj.hint || "no data"})`;
        const keys = Object.keys(obj).slice(0, 5);
        return `- ${label}: ${keys.map(k => `${k}=${JSON.stringify(scrubValue(obj[k])).slice(0, 60)}`).join(", ")}`;
      };
      const recentErrCount = Array.isArray(errs?.errors) ? errs.errors.length : (Array.isArray(errs) ? errs.length : 0);
      const text = [
        "=== UNICAL MINIMAL DEBUG ===",
        `Route: ${route}`,
        `Time:  ${new Date().toISOString()}`,
        "",
        "## DIAGNOSIS",
        dx ? `${dx.primaryBlocker} (confidence: ${dx.confidence})\n${dx.summary}\n→ ${dx.recommendedNextStep}` : "(diagnose unavailable)",
        "",
        "## SUMMARY",
        `- finalAction: ${snap?.finalAction ?? "—"}`,
        `- weekNumber:  ${snap?.weekNumber ?? "—"}`,
        `- blocker:     ${snap?.blocker ?? "(none)"}`,
        `- build outOfDate: ${binfo?.outOfDate ? "YES" : "no"} · last build: ${binfo?.lastBuildAt ?? "?"}`,
        `- recent errors: ${recentErrCount}`,
        "",
        "## ENDPOINT SUMMARIES (no raw JSON — ask if you need it)",
        summarize("flow-snapshot", snap),
        summarize("diagnose", dx),
        summarize("build-info", binfo),
        "",
        "## NEXT STEP",
        "Tell me what's broken. If you need the full payloads, ask for: Page Pack, Backend Pack, TTS Pack, or OneDrive Pack.",
      ].join("\n");
      await navigator.clipboard.writeText(text);
      alert(`Minimal prompt copied (${(text.length / 1024).toFixed(1)} KB).`);
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  // ───── action: one-click preset pack (Backend / TTS / OneDrive) ─────
  const copyPresetPack = async (kind: "backend" | "tts" | "onedrive") => {
    setBusy(true);
    try {
      const presets: Record<string, { title: string; endpoints: string[]; subsystem: "frontend" | "backend" | "both"; note: string }> = {
        backend:  { title: "BACKEND", subsystem: "backend",
                    endpoints: ["/api/dev/status", "/api/dev/diagnose", "/api/dev/recent-errors", "/api/dev/performance", "/api/dev/build-info"],
                    note: "Backend issue. Restart with `pm2 restart all` after fix (no rebuild)." },
        tts:      { title: "TTS / AUDIO", subsystem: "backend",
                    endpoints: ["/api/dev/flow-snapshot", "/api/dev/diagnose", "/api/dev/tts-ready", "/api/dev/file-map", "/api/dev/trace?subsystem=cat_lights", "/api/dev/recent-errors"],
                    note: "TTS pipeline. PROTECTED — confirm before changing AudioPrep or speaker routing." },
        onedrive: { title: "ONEDRIVE", subsystem: "backend",
                    endpoints: ["/api/dev/status", "/api/dev/onedrive-audit", "/api/dev/file-map", "/api/dev/recent-errors"],
                    note: "OneDrive sync. PROTECTED — confirm before changing folder paths or sync logic." },
      };
      const cfg = presets[kind];
      const fetched: Record<string, any> = {};
      for (const ep of cfg.endpoints) {
        try { fetched[ep] = await j(ep); } catch (e: any) { fetched[ep] = { error: e.message }; }
      }
      const sep = "─".repeat(60);
      const restartRule = cfg.subsystem === "frontend"
        ? "Frontend → `cd ~/Home-View && git pull && npm run build && pm2 restart all`"
        : "Backend → `cd ~/Home-View && git pull && pm2 restart all`";
      const text = [
        `=== CHATGPT DEBUG PACK — ${cfg.title} ===`,
        `Generated: ${new Date().toISOString()}`,
        `Route: ${window.location.pathname + window.location.search}`,
        sep,
        "## INSTRUCTIONS FOR CHATGPT",
        cfg.note,
        restartRule,
        sep,
        ...Object.entries(fetched).flatMap(([ep, val]) => [
          `## ${ep}`, "```json", safe(val), "```", sep,
        ]),
        "## CONSOLE ERRORS (last 20)",
        consoleErrors.length === 0 ? "(none)" : "```json\n" + safe(consoleErrors) + "\n```",
      ].join("\n");
      await navigator.clipboard.writeText(text);
      alert(`${cfg.title} pack copied (${(text.length / 1024).toFixed(1)} KB).`);
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  // ───── action: build Guided Fix prompt ─────
  const buildGuidedPrompt = async () => {
    if (!wizIssue.trim()) { alert("Describe what is broken first."); return; }
    setBusy(true);
    try {
      const route = window.location.pathname + window.location.search;
      const subsystem = sniffSubsystem(route, wizArea);
      const guesses = guessPageFiles(window.location.pathname);
      const sep = "─".repeat(60);

      // Section selection rules per area.
      const includes: Record<string, string[]> = {
        visual:     ["page-pack", "/api/dev/build-info"],
        frontend:   ["page-pack", "/api/dev/build-info", "/api/dev/recent-errors"],
        data:       ["/api/dev/status", "/api/dev/system-map", "/api/dev/recent-errors"],
        database:   ["/api/dev/status", "/api/dev/system-map", "/api/dev/recent-errors"],
        backend:    ["/api/dev/status", "/api/dev/diagnose", "/api/dev/recent-errors", "/api/dev/performance"],
        automation: ["/api/dev/flow-snapshot", "/api/dev/diagnose", "/api/dev/trace?subsystem=cat_lights", "/api/dev/recent-errors"],
        cat_lights: ["/api/dev/flow-snapshot", "/api/dev/diagnose", "/api/dev/file-map", "/api/dev/trace?subsystem=cat_lights", "/api/dev/recent-errors"],
        onedrive:   ["/api/dev/status", "/api/dev/onedrive-audit", "/api/dev/file-map", "/api/dev/recent-errors"],
        tts:        ["/api/dev/flow-snapshot", "/api/dev/trace?subsystem=cat_lights", "/api/dev/tts-ready", "/api/dev/file-map", "/api/dev/recent-errors"],
        files:      ["/api/dev/file-map", "/api/dev/onedrive-audit", "/api/dev/recent-errors"],
        calendar:   ["/api/dev/status", "/api/dev/recent-errors"],
        unknown:    ["/api/dev/status", "/api/dev/diagnose", "/api/dev/recent-errors", "/api/dev/build-info"],
      };
      const sections = includes[wizArea] || ["/api/dev/status", "/api/dev/diagnose", "/api/dev/recent-errors", "/api/dev/build-info"];

      // Live-fetch the relevant endpoints so the prompt is self-contained.
      const fetched: Record<string, any> = {};
      for (const ep of sections) {
        if (ep === "page-pack") continue;
        try { fetched[ep] = await j(ep); } catch (e: any) { fetched[ep] = { error: e.message }; }
      }

      // Build the prompt.
      const restartRule = subsystem === "frontend"
        ? "Frontend change → on the Pi run: `cd ~/Home-View && git pull && npm run build && pm2 restart all`"
        : "Backend change → on the Pi run: `cd ~/Home-View && git pull && pm2 restart all` (no build needed)";
      const protectedSystems = [
        "PROTECTED — do not modify without explicit confirmation:",
        "- Cat Lights handler (server/routes.ts /api/webhook/cat-lights)",
        "- OneDrive sync logic (server/onedrive.ts)",
        "- TTS preparation pipeline (server/tts*.ts, AudioPrep)",
        "- DevPanel & devTrace instrumentation (do not refactor for style)",
      ].join("\n");
      const prompt = [
        "=== GUIDED FIX REQUEST ===",
        `Generated: ${new Date().toISOString()}`,
        `Route:        ${route}`,
        `Subsystem:    ${subsystem}`,
        `Area:         ${wizArea || "(unspecified)"}`,
        `Started after: ${wizSince || "(unspecified)"}`,
        sep,
        "## ISSUE",
        wizIssue.trim(),
        sep,
        "## CONTEXT (likely files)",
        ...guesses.map(g => `- ${g}`),
        sep,
        "## RESTART / BUILD RULE",
        restartRule,
        sep,
        "## " + protectedSystems,
        sep,
        "## ENDPOINT SNAPSHOTS",
        ...Object.entries(fetched).flatMap(([ep, val]) => [
          `### ${ep}`, "```json", safe(val), "```", "",
        ]),
        ...(sections.includes("page-pack") ? [
          "### page layout (visible interactive elements)",
          "```json", safe(captureLayoutSnapshot()), "```",
        ] : []),
        sep,
        "## CONSOLE ERRORS (last 20)",
        consoleErrors.length === 0 ? "(none)" : "```json\n" + safe(consoleErrors) + "\n```",
        sep,
        "## PROFILE (redacted)",
        "```json", safe(redactProfile()), "```",
        sep,
        "## INSTRUCTIONS FOR CHATGPT",
        "1. Diagnose the issue using ONLY the snapshots above.",
        "2. Propose the SMALLEST possible fix touching the listed files first.",
        "3. State exactly which Pi command to run after the fix.",
        "4. If you need data not present here, name the exact /api/dev/* endpoint to call.",
        "5. Respect the PROTECTED list — propose, do not assume.",
      ].join("\n");
      setWizPrompt(prompt);
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  const initBlock = !!initChecklist && !initChecklist.ready && !initOverride;

  // Portal to document.body so the panel escapes any ancestor stacking context
  // (transforms, filters, position:fixed/relative ancestors all create traps
  // that confine z-index and can let other dashboard overlays cover the panel
  // and steal its clicks).
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
    {initBlock && (
      <div data-testid="init-checklist-modal" style={{ position: "fixed", inset: 0, zIndex: 2147482000, background: "rgba(5,5,10,0.92)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 640, background: "#0f0f17", border: "2px solid #ef4444", borderRadius: 12, padding: 22, color: "#e8e8ec", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ background: "#ef4444", color: "#000", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>BLOCKED</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>System Initialization Checklist</span>
            <span style={{ flex: 1 }} />
            <button data-testid="button-init-recheck" disabled={initBusy} onClick={refreshInitChecklist} style={{ background: "rgba(96,165,250,0.2)", border: "1px solid rgba(96,165,250,0.5)", color: "#bfdbfe", padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>{initBusy ? "…" : "Re-check"}</button>
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 14 }}>
            Usage is blocked until every required item passes. Fix the failed item(s) below, click <b>Re-check</b>, or override at the bottom (not recommended).
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {initChecklist!.checks.map((c) => {
              const pass = c.status === "pass";
              return (
                <div key={c.id} data-testid={`init-check-${c.id}`} style={{ border: `1px solid ${pass ? "rgba(74,222,128,0.4)" : "rgba(239,68,68,0.5)"}`, borderRadius: 8, padding: "10px 12px", background: pass ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ background: pass ? "#4ade80" : "#ef4444", color: "#000", padding: "1px 7px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>{pass ? "PASS" : "FAIL"}</span>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#cdcdd2", paddingLeft: 2 }}>{c.message}</div>
                  {!pass && c.fix && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#fde68a", paddingLeft: 2 }}>
                      <b>Action:</b> {c.fix}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <button
              data-testid="button-init-override"
              onClick={() => {
                if (!confirm("Override the initialization checklist?\n\nThis lets you keep using the app even though required checks are failing. You may create bad data, miss uploads, or break automation. Continue?")) return;
                try { localStorage.setItem('unical_init_override', '1'); } catch {}
                setInitOverride(true);
              }}
              style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.6)", color: "#fca5a5", padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
            >Override (I understand)</button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "#666" }}>Generated {new Date(initChecklist!.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    )}
    <div
      ref={panelRootRef}
      style={{ ...panel, isolation: "isolate" }}
      data-testid="dev-panel"
      onClickCapture={(e) => {
        const t = e.target as HTMLElement;
        const tid = t?.dataset?.testid || t?.tagName;
        console.log("[DevPanel] click reached panel:", tid, t);
      }}
      onPointerDownCapture={(e) => {
        const t = e.target as HTMLElement;
        const tid = t?.dataset?.testid || t?.tagName;
        console.log("[DevPanel] pointerdown reached panel:", tid, "buttons=", e.buttons, "type=", e.pointerType);
      }}
    >
      <div
        data-testid="dev-panel-drag-handle"
        onPointerDown={startDrag("move")}
        onMouseDown={startDrag("move")}
        onDoubleClick={resetGeom}
        title="Drag to move · Double-click to reset position/size"
        style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(120,120,150,0.3)", cursor: "move", userSelect: "none", touchAction: "none", pointerEvents: "auto" }}
      >
        <span style={{ marginRight: 6, color: "#666", fontSize: 12, lineHeight: 1 }}>⋮⋮</span>
        <span style={{ flex: 1, fontWeight: 700, color: "#a78bfa" }}>UniCal Dev Panel</span>
        <button
          data-testid="button-dev-probe"
          onClick={(e) => {
            e.stopPropagation();
            try {
              const handle = document.querySelector('[data-testid="dev-panel-drag-handle"]') as HTMLElement | null;
              const tabBar = document.querySelector('[data-testid="tab-dev-trace"]') as HTMLElement | null;
              const copyBtn = document.querySelector('[data-testid="button-dev-copy-debug-pack"]') as HTMLElement | null;
              const probe = (label: string, el: HTMLElement | null) => {
                if (!el) { console.log(`[Probe] ${label}: NOT FOUND`); return; }
                const r = el.getBoundingClientRect();
                const cx = Math.round(r.left + r.width / 2);
                const cy = Math.round(r.top + r.height / 2);
                const stack = document.elementsFromPoint(cx, cy);
                console.log(`[Probe] ${label} @ (${cx},${cy}) — rect=${JSON.stringify({l:r.left,t:r.top,w:r.width,h:r.height})}`);
                stack.slice(0, 8).forEach((node, i) => {
                  const n = node as HTMLElement;
                  const cs = window.getComputedStyle(n);
                  console.log(`[Probe]   [${i}] <${n.tagName.toLowerCase()}> testid="${n.dataset?.testid||''}" class="${(n.className||'').toString().slice(0,60)}" pe=${cs.pointerEvents} z=${cs.zIndex} pos=${cs.position}`);
                });
              };
              probe('drag-handle', handle);
              probe('first-tab (Trace)', tabBar);
              probe('copy-debug-pack (works)', copyBtn);
            } catch (err: any) { console.error('[Probe] error', err); }
          }}
          title="Log what's blocking drag/tabs (check console)"
          style={{ marginRight: 6, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.6)", color: "#fde68a", cursor: "pointer", fontSize: 9, padding: "1px 5px", borderRadius: 3 }}
        >probe</button>
        <button
          data-testid="button-dev-reset-geom"
          onClick={(e) => { e.stopPropagation(); resetGeom(); }}
          title="Reset panel position & size · Shift+Alt+Arrows to nudge 20px"
          style={{ marginRight: 6, background: "transparent", border: "1px solid rgba(120,120,150,0.4)", color: "#aaa", cursor: "pointer", fontSize: 9, padding: "1px 5px", borderRadius: 3 }}
        >reset</button>
        {initChecklist && !initChecklist.ready && (
          <button
            data-testid="button-init-reopen"
            title="Initialization checklist has failures"
            onClick={() => { try { localStorage.removeItem('unical_init_override'); } catch {} ; setInitOverride(false); refreshInitChecklist(); }}
            style={{ marginRight: 8, background: "rgba(239,68,68,0.25)", border: "1px solid #ef4444", color: "#fca5a5", padding: "1px 7px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
          >⚠ INIT {initChecklist.checks.filter(c => c.status === 'fail').length} FAIL</button>
        )}
        {build?.outOfDate && <span title={build.outOfDateWarning} style={{ marginRight: 8, color: "#fbbf24", fontSize: 10 }}>⚠ build stale</span>}
        <button onClick={() => setOpen(false)} data-testid="button-dev-close" style={{ background: "transparent", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14 }}>×</button>
      </div>
      <div data-testid="banner-diag" style={{ padding: "6px 10px", background: "rgba(20,80,120,0.95)", borderBottom: "2px solid #38bdf8", color: "#e0f2fe", fontSize: 10, fontFamily: "ui-monospace, monospace", maxHeight: 220, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontWeight: 700, flexWrap: "wrap" }}>
          <span style={{ background: "#38bdf8", color: "#000", padding: "1px 6px", borderRadius: 3 }}>DIAG</span>
          <span style={{ flex: 1, minWidth: 200 }}>r#{renderCountRef.current} · clicks={clickProofCount} · entries={diagBanner.length} · initBlock={String(initBlock)} · geom={geom.x},{geom.y} {geom.w}×{geom.h} · bodyPE={typeof document!=='undefined' ? (document.body.style.pointerEvents||'(unset)') : '?'}</span>
          <button
            data-testid="button-dev-test-click"
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); pushDiag(`TEST pointerdown @ ${Date.now()%100000}`); setClickProofCount(c => c + 1); }}
            onClick={(e) => { e.stopPropagation(); pushDiag(`TEST click @ ${Date.now()%100000}`); setClickProofCount(c => c + 1); }}
            style={{ background: "#facc15", color: "#000", border: "2px solid #fde68a", padding: "4px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 800 }}
          >TEST CLICK</button>
        </div>
        {diagBanner.length === 0 ? (
          <div style={{ opacity: 0.6, fontStyle: "italic" }}>(no events yet — click TEST CLICK above; if that does NOT increment clicks=, React event handlers are dead)</div>
        ) : (
          diagBanner.map((line, i) => (
            <div key={i} style={{ whiteSpace: "pre-wrap", lineHeight: 1.35, opacity: i === 0 ? 1 : 0.7 }}>{line}</div>
          ))
        )}
      </div>
      {stagingMode && (
        <div data-testid="banner-staging-mode" style={{ padding: "6px 10px", background: "linear-gradient(90deg, rgba(251,191,36,0.25), rgba(251,191,36,0.10))", borderBottom: "2px solid #fbbf24", color: "#fde68a", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#fbbf24", color: "#000", padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>STAGING</span>
          <span>STAGING_MODE=1 — HA / TTS / OneDrive writes are skipped on this server. Read-only DB role assumed.</span>
        </div>
      )}
      {sandbox && (
        <div data-testid="banner-sandbox" style={{ padding: "6px 10px", background: sandbox.enabled ? "linear-gradient(90deg, rgba(96,165,250,0.22), rgba(96,165,250,0.08))" : "rgba(60,60,80,0.4)", borderBottom: "1px solid rgba(96,165,250,0.4)", color: sandbox.enabled ? "#bfdbfe" : "#aaa", fontSize: 11, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: sandbox.enabled ? "#60a5fa" : "#555", color: "#000", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>SANDBOX {sandbox.enabled ? "ON" : "OFF"}</span>
          <span style={{ flex: 1 }}>
            {sandbox.enabled
              ? `Side-effects suppressed (${sandbox.source}). Suppressed: ${Object.entries(sandbox.counters).map(([k,v]) => `${k}:${v}`).join(", ") || "none"}`
              : `Live mode (${sandbox.source}).`}
          </span>
          <button
            data-testid="button-sandbox-toggle"
            disabled={sandboxBusy}
            onClick={async () => {
              setSandboxBusy(true);
              try {
                const r = await fetch("/api/dev/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !sandbox.enabled }) });
                const j2 = await r.json();
                if (j2?.status) setSandbox(j2.status);
              } catch {} finally { setSandboxBusy(false); }
            }}
            style={{ background: sandbox.enabled ? "rgba(248,113,113,0.25)" : "rgba(96,165,250,0.25)", border: "1px solid rgba(120,120,150,0.5)", color: "#e8e8ec", padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 10 }}
          >{sandboxBusy ? "…" : sandbox.enabled ? "Disable" : "Enable"}</button>
          <button
            data-testid="button-sandbox-revert-env"
            disabled={sandboxBusy}
            title="Revert runtime override; use STAGING_MODE env value"
            onClick={async () => {
              setSandboxBusy(true);
              try {
                const r = await fetch("/api/dev/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: null }) });
                const j2 = await r.json();
                if (j2?.status) setSandbox(j2.status);
              } catch {} finally { setSandboxBusy(false); }
            }}
            style={{ background: "transparent", border: "1px solid rgba(120,120,150,0.5)", color: "#aaa", padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 10 }}
          >env</button>
          {Object.keys(sandbox.counters).length > 0 && (
            <button
              data-testid="button-sandbox-clear-stats"
              disabled={sandboxBusy}
              onClick={async () => {
                setSandboxBusy(true);
                try {
                  const r = await fetch("/api/dev/sandbox/stats", { method: "DELETE" });
                  const j2 = await r.json();
                  if (j2?.status) setSandbox(j2.status);
                } catch {} finally { setSandboxBusy(false); }
              }}
              style={{ background: "transparent", border: "1px solid rgba(120,120,150,0.5)", color: "#aaa", padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 10 }}
            >clear</button>
          )}
        </div>
      )}

      {/* Tabs row */}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(120,120,150,0.3)" }}>
        <button type="button" onClick={() => { console.log("[DevPanel] tab click trace"); setTab("trace"); }} data-testid="tab-dev-trace" style={tabBtn("trace", "Trace")}>Trace ({trace.length})</button>
        <button type="button" onClick={() => { console.log("[DevPanel] tab click flow"); setTab("flow"); }} data-testid="tab-dev-flow" style={tabBtn("flow", "Flow")}>Flow</button>
        <button onClick={() => setTab("replay")} data-testid="tab-dev-replay" style={tabBtn("replay", "Replay")}>Replay</button>
        <button onClick={() => setTab("validate")} data-testid="tab-dev-validate" style={tabBtn("validate", "Validate")}>Validate</button>
        <button onClick={() => setTab("file")} data-testid="tab-dev-file" style={tabBtn("file", "File")}>File</button>
        <button onClick={() => setTab("build")} data-testid="tab-dev-build" style={tabBtn("build", "Build")}>Build</button>
        <button onClick={() => setTab("perf")} data-testid="tab-dev-perf" style={tabBtn("perf", "Perf")}>Perf</button>
        <button onClick={() => setTab("flags")} data-testid="tab-dev-flags" style={tabBtn("flags", "Flags")}>Flags</button>
        <button onClick={() => setTab("system")} data-testid="tab-dev-system" style={tabBtn("system", "Sys")}>Sys</button>
        <button onClick={() => setTab("layout")} data-testid="tab-dev-layout" style={tabBtn("layout", "Layout")}>Layout</button>
        <button onClick={() => setTab("help")} data-testid="tab-dev-help" style={tabBtn("help", "Help")}>?</button>
        <button onClick={() => setTab("rollback")} data-testid="tab-dev-rollback" style={tabBtn("rollback", "Rollback")}>↶</button>
        <button onClick={() => setTab("fixhist")} data-testid="tab-dev-fixhist" style={tabBtn("fixhist", "FixHist")}>FixHist</button>
        <button onClick={() => setTab("upload")} data-testid="tab-dev-upload" style={tabBtn("upload", "Upload")}>Upload</button>
        <button onClick={() => setTab("timeline")} data-testid="tab-dev-timeline" style={tabBtn("timeline", "Timeline")}>Timeline</button>
        <button onClick={() => setTab("afterUpload")} data-testid="tab-dev-after-upload" style={tabBtn("afterUpload", "After")}>After</button>
      </div>

      {/* Action button row */}
      <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid rgba(120,120,150,0.2)" }}>
        <button data-testid="button-dev-debug-pack" disabled={busy} style={actBtn("#fda4af", "rgba(244,63,94,0.18)")} onClick={copyDebugPack}>
          {busy ? "Collecting…" : "Copy Debug Pack"}
        </button>
        <button data-testid="button-dev-probe-action" style={actBtn("#fde68a", "rgba(251,191,36,0.20)")} onClick={async () => {
          const lines: string[] = [];
          const log = (s: string) => lines.push(s);
          try {
            const handle = document.querySelector('[data-testid="dev-panel-drag-handle"]') as HTMLElement | null;
            const tabBar = document.querySelector('[data-testid="tab-dev-trace"]') as HTMLElement | null;
            const probeBtn = document.querySelector('[data-testid="button-dev-probe"]') as HTMLElement | null;
            const copyBtn = document.querySelector('[data-testid="button-dev-debug-pack"]') as HTMLElement | null;
            const fixHistBtn = document.querySelector('[data-testid="tab-dev-fixhist"]') as HTMLElement | null;
            const probe = (label: string, el: HTMLElement | null) => {
              if (!el) { log(`${label}: NOT FOUND`); return; }
              const r = el.getBoundingClientRect();
              const cx = Math.round(r.left + r.width / 2);
              const cy = Math.round(r.top + r.height / 2);
              const stack = document.elementsFromPoint(cx, cy);
              log(`▼ ${label} @(${cx},${cy}) rect=l${Math.round(r.left)},t${Math.round(r.top)},w${Math.round(r.width)},h${Math.round(r.height)}`);
              stack.slice(0, 6).forEach((node, i) => {
                const n = node as HTMLElement;
                const cs = window.getComputedStyle(n);
                const tid = n.dataset?.testid ? `#${n.dataset.testid}` : '';
                const id = n.id ? `@${n.id}` : '';
                const cls = (typeof n.className === 'string' ? n.className.split(' ').slice(0,2).join(' ') : '').slice(0, 40);
                log(`  [${i}] <${n.tagName.toLowerCase()}>${tid}${id} cls="${cls}" pe=${cs.pointerEvents} z=${cs.zIndex} pos=${cs.position}`);
              });
            };
            log(`===== PROBE @ ${new Date().toLocaleTimeString()} =====`);
            log(`viewport: ${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`);
            probe('DRAG-HANDLE (dead?)', handle);
            probe('TAB-TRACE (dead?)', tabBar);
            probe('PROBE-BTN-HEADER (dead?)', probeBtn);
            probe('TAB-FIXHIST (dead?)', fixHistBtn);
            probe('COPY-DEBUG-PACK (works)', copyBtn);
            log(`===== END =====`);
            const text = lines.join("\n");
            setDiagBanner(lines.slice().reverse());
            try { await navigator.clipboard.writeText(text); alert(`Probe done — ${lines.length} lines copied to clipboard. Also shown in blue DIAG banner above.`); }
            catch { alert(`Probe done — ${lines.length} lines shown in blue DIAG banner above (clipboard failed).`); }
          } catch (e: any) { alert("Probe failed: " + e.message); }
        }}>Probe</button>
        <button data-testid="button-dev-handoff" style={actBtn("#c4b5fd", "rgba(167,139,250,0.18)")} onClick={async () => {
          try {
            const _devKey = getDevKey();
            const r = await fetch("/api/dev/handoff?format=text", { headers: _devKey ? { "x-dev-key": _devKey } : {} });
            const text = await r.text();
            await navigator.clipboard.writeText(text);
            alert(`Handoff copied (${(text.length / 1024).toFixed(1)} KB).`);
          } catch (e: any) { alert("Failed: " + e.message); }
        }}>Copy Handoff</button>
        <button data-testid="button-dev-status" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={async () => {
          try { const r = await j("/api/dev/status"); await navigator.clipboard.writeText(safe(r)); alert("Status copied."); }
          catch (e: any) { alert("Failed: " + e.message); }
        }}>Copy Status</button>
        <button data-testid="button-dev-page-info" style={actBtn("#86efac", "rgba(34,197,94,0.18)")} onClick={async () => {
          const containers = Array.from(document.querySelectorAll('[data-testid]')).slice(0, 80).map(el => ({
            tag: el.tagName.toLowerCase(),
            testid: (el as HTMLElement).dataset.testid,
            text: (el.textContent || "").trim().slice(0, 60),
          }));
          const info = {
            path: window.location.pathname + window.location.search,
            title: document.title,
            browserSize: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
            testIds: containers,
          };
          try { await navigator.clipboard.writeText(safe(info)); alert("Page inspector copied."); }
          catch (e: any) { alert("Failed: " + e.message); }
        }}>Copy Page</button>
        <button data-testid="button-dev-page-pack" disabled={busy} style={actBtn("#fde68a", "rgba(251,191,36,0.18)")} onClick={copyPagePack}>
          {busy ? "Collecting…" : "Page Pack"}
        </button>
        <button data-testid="button-dev-guided-fix" style={actBtn("#f0abfc", "rgba(217,70,239,0.18)")} onClick={() => { setWizardOpen(true); setWizPrompt(""); }}>
          Guided Fix
        </button>
        <button data-testid="button-dev-pack-backend" disabled={busy} style={actBtn("#a5b4fc", "rgba(129,140,248,0.18)")} onClick={() => copyPresetPack("backend")}>Backend Pack</button>
        <button data-testid="button-dev-pack-tts" disabled={busy} style={actBtn("#fcd34d", "rgba(251,191,36,0.18)")} onClick={() => copyPresetPack("tts")}>TTS Pack</button>
        <button data-testid="button-dev-pack-onedrive" disabled={busy} style={actBtn("#67e8f9", "rgba(34,211,238,0.18)")} onClick={() => copyPresetPack("onedrive")}>OneDrive Pack</button>
        <button data-testid="button-dev-minimal-prompt" disabled={busy} style={actBtn("#d8b4fe", "rgba(192,132,252,0.18)")} onClick={copyMinimalPrompt}>Minimal Prompt</button>
        <button data-testid="button-dev-run-smoke" style={actBtn("#fca5a5", "rgba(239,68,68,0.18)")} onClick={async () => {
          const cmd = [
            "# Smoke tests — read-only. /api/dev/* accepts either DEV_API_KEY or session cookie.",
            "",
            "# RECOMMENDED (terminal-friendly): use DEV_API_KEY.",
            "# On the Pi the secret is already in the env; just run:",
            "DEV_API_KEY=\"$DEV_API_KEY\" node scripts/smoke.mjs https://uni-cal.app",
            "",
            "# Quick sanity probe:",
            "curl -H \"x-dev-key: $DEV_API_KEY\" http://localhost:5000/api/dev/status",
            "",
            "# Alternative (browser cookie): DevTools → Application → Cookies → copy `uni_cal_session`.",
            "#   UNICAL_SESSION_TOKEN='paste-value' node scripts/smoke.mjs https://uni-cal.app",
            "",
            "# No auth? Public checks still run; authenticated checks SKIP (won't fail the run).",
            "# Full docs: docs/SMOKE_TESTS.md",
          ].join("\n");
          try { await navigator.clipboard.writeText(cmd); alert("Smoke command template copied.\n\nPaste your `uni_cal_session` cookie value into the script before running.\nNothing about the token is printed by smoke.\n\nSee docs/SMOKE_TESTS.md for details."); } catch { alert("Copy failed."); }
        }}>Run Smoke</button>
      </div>

      {/* Last build / restart strip */}
      {build && (
        <div data-testid="strip-build-info" style={{ display: "flex", gap: 8, padding: "3px 8px", borderBottom: "1px solid rgba(120,120,150,0.2)", fontSize: 10, color: build.outOfDate ? "#fbbf24" : "#86efac" }}>
          <span>last build: <b>{build.lastBuildAt ? new Date(build.lastBuildAt).toLocaleString() : "(unknown)"}</b></span>
          {build.lastBuildAgeSec != null && <span>({Math.round(build.lastBuildAgeSec / 60)} min ago)</span>}
          <span>· bundle: {build.bundleHash?.slice(0, 8) ?? "—"}</span>
          {build.outOfDate && <span style={{ marginLeft: "auto" }}>⚠ rebuild required</span>}
        </div>
      )}

      <div style={{ overflow: "auto", padding: 8, flex: 1 }}>
        {tab === "trace" && (
          trace.length === 0
            ? <div style={{ color: "#888" }}>No trace steps yet. Trigger Cat Lights to populate.</div>
            : trace.map((s, i) => (
                <div key={i} style={{ padding: "4px 6px", marginBottom: 4, background: "rgba(255,255,255,0.03)", borderRadius: 4, borderLeft: `2px solid ${s.decision ? "#a78bfa" : "#60a5fa"}` }}>
                  <div style={{ color: "#93c5fd" }}>{s.step}{s.decision && <span style={{ color: "#c4b5fd", marginLeft: 6 }}>→ {s.decision}</span>}</div>
                  <div style={{ color: "#888", fontSize: 9 }}>{new Date(s.time).toLocaleTimeString()}</div>
                  {s.reason && <div style={{ color: "#fbbf24", fontSize: 10 }}>reason: {s.reason}</div>}
                  {s.data && <pre style={{ margin: "2px 0 0", color: "#cbd5e1", fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(s.data, null, 0).slice(0, 240)}</pre>}
                </div>
              ))
        )}

        {tab === "flow" && (
          <div>
            <button style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => { j("/api/dev/flow-snapshot").then(setFlow); j("/api/dev/diagnose").then(setDiag); }}>Refresh</button>
            {/* Diagnosis card — always at top */}
            {diag && (
              <div data-testid="card-diagnosis" style={{ marginTop: 8, padding: 8, borderRadius: 6, background: diag.primaryBlocker === "no_blocker_detected" ? "rgba(34,197,94,0.10)" : "rgba(251,191,36,0.10)", border: `1px solid ${diag.primaryBlocker === "no_blocker_detected" ? "#22c55e" : "#fbbf24"}` }}>
                <div style={{ color: diag.primaryBlocker === "no_blocker_detected" ? "#86efac" : "#fbbf24", fontWeight: 700 }}>
                  {diag.primaryBlocker === "no_blocker_detected" ? "✓ Healthy" : `⚠ ${diag.primaryBlocker}`}
                  <span style={{ float: "right", fontSize: 9, opacity: 0.7 }}>confidence: {diag.confidence}</span>
                </div>
                <div style={{ color: "#cbd5e1", marginTop: 4 }}>{diag.summary}</div>
                <div style={{ color: "#93c5fd", marginTop: 4, fontSize: 10 }}>→ {diag.recommendedNextStep}</div>
                {Array.isArray(diag.fixActions) && diag.fixActions.length > 0 && (
                  <div data-testid="card-fix-actions" style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed #fbbf24" }}>
                    <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 600, marginBottom: 4 }}>FIX IT — safe repair actions</div>
                    {diag.fixActions.map((fa: any) => (
                      <div key={fa.id} data-testid={`row-fix-${fa.id}`} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4, padding: 4, background: "rgba(251,191,36,0.06)", borderRadius: 4 }}>
                        <div style={{ flex: 1, color: "#fde68a", fontSize: 11 }}>{fa.label} <span style={{ fontSize: 9, opacity: 0.7 }}>(risk: {fa.risk})</span></div>
                        <button data-testid={`button-fix-preview-${fa.id}`} style={actBtn("#86efac", "rgba(34,197,94,0.18)")} onClick={async () => {
                          const r = await j(fa.endpoint + "?dryRun=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                          alert(`PREVIEW (dry-run) — ${fa.id}\n\n${JSON.stringify(r, null, 2)}`);
                        }}>Preview</button>
                        <button data-testid={`button-fix-apply-${fa.id}`} style={actBtn("#fda4af", "rgba(244,63,94,0.18)")} onClick={async () => {
                          if (!confirm(`Apply REAL fix: ${fa.label}\n\nA snapshot will be saved to .local/fix-snapshots/ and the action logged to dev-change-log.md.\n\nContinue?`)) return;
                          const r = await j(fa.endpoint + "?dryRun=0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
                          alert(`APPLIED — ${fa.id}\n\n${JSON.stringify(r, null, 2)}`);
                          j("/api/dev/diagnose").then(setDiag).catch(() => {});
                        }}>Apply</button>
                      </div>
                    ))}
                    <div style={{ marginTop: 4 }}>
                      <button data-testid="button-fix-history" style={{ ...actBtn("#c4b5fd", "rgba(167,139,250,0.18)"), fontSize: 9 }} onClick={async () => {
                        const r = await j("/api/dev/fix-history?limit=20");
                        const lines = (r.entries || []).map((e: any) => `${e.timestamp} · ${e.action} · dryRun=${e.dryRun} · ${e.result}`).join("\n");
                        alert(`Fix History (last ${r.entries?.length || 0} of ${r.count || 0})\n\n${lines || "(empty)"}`);
                      }}>View Fix History</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Pre/post-semester warning */}
            {flow && flow.weekNumber != null && flow.weekNumber < 1 && flow.finalAction === "CHUM" && (
              <div data-testid="banner-pre-semester" style={{ marginTop: 8, padding: 8, borderRadius: 6, background: "rgba(244,63,94,0.12)", border: "1px solid #f43f5e", color: "#fda4af" }}>
                ⚠ <b>Pre/post-semester:</b> weekNumber={flow.weekNumber} → CHUM fallback. Verify semesterStartDate or use Replay tab to test in-semester behavior.
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              {!flow ? <div style={{ color: "#888" }}>loading…</div>
                : flow.empty ? <div style={{ color: "#888" }}>{flow.hint}</div>
                : <>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: "#93c5fd" }}>{flow.semester || "?"}</span> · week <b>{String(flow.weekNumber)}</b> · final <span style={{ color: flow.finalAction === "PROMPT" ? "#86efac" : "#fbbf24" }}>{flow.finalAction}</span> · {flow.durationMs}ms
                    </div>
                    {flow.blocker && <div style={{ marginBottom: 6, color: "#fbbf24", fontSize: 10 }}>blocker: {flow.blocker}</div>}
                    {flow.decisionPath?.map((d: any, i: number) => (
                      <div key={i} style={{ padding: "3px 6px", marginBottom: 3, background: "rgba(255,255,255,0.03)", borderLeft: "2px solid #a78bfa", borderRadius: 4 }}>
                        <div style={{ color: "#c4b5fd" }}>{d.step}{d.decision && <span style={{ color: "#86efac" }}> → {d.decision}</span>}</div>
                        {d.reason && <div style={{ color: "#fbbf24", fontSize: 10 }}>{d.reason}</div>}
                      </div>
                    ))}
                    <details style={{ marginTop: 6 }}><summary style={{ cursor: "pointer", color: "#888" }}>Raw JSON</summary><pre style={codeBlock}>{JSON.stringify(flow, null, 2)}</pre></details>
                  </>
              }
            </div>
          </div>
        )}

        {tab === "replay" && (
          <div>
            <div style={{ color: "#bbb", marginBottom: 6 }}>Dry-run Cat Lights week + file lookup. <b style={{ color: "#86efac" }}>No side effects.</b></div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input data-testid="input-replay-date" placeholder="YYYY-MM-DD" value={rDate} onChange={e => setRDate(e.target.value)} style={{ ...inp, flex: 1 }} />
              <input data-testid="input-replay-week" placeholder="forceWeek" value={rWeek} onChange={e => setRWeek(e.target.value)} style={{ ...inp, width: 80 }} />
              <button data-testid="button-replay-run" style={actBtn("#86efac", "rgba(34,197,94,0.18)")} onClick={async () => {
                const body: any = {};
                if (rDate) body.dateOverride = rDate;
                if (rWeek) body.forceWeek = Number(rWeek);
                const r = await j("/api/dev/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                setReplayResult(r);
              }}>Replay</button>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <button style={actBtn("#fda4af", "rgba(244,63,94,0.14)")} onClick={async () => {
                if (!confirm("This fires REAL Cat Lights ON — TTS + HA. Continue?")) return;
                const r = await j("/api/dev/test/cat-lights-on", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
                setReplayResult(r);
              }}>Trigger ON (real)</button>
              <button style={actBtn("#fda4af", "rgba(244,63,94,0.14)")} onClick={async () => {
                if (!confirm("This fires REAL Cat Lights OFF. Continue?")) return;
                const r = await j("/api/dev/test/cat-lights-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
                setReplayResult(r);
              }}>Trigger OFF (real)</button>
            </div>
            <pre style={codeBlock} data-testid="text-replay-result">{replayResult ? JSON.stringify(replayResult, null, 2) : "no result yet"}</pre>
          </div>
        )}

        {tab === "validate" && (
          <div>
            <div style={{ color: "#bbb", marginBottom: 6 }}>Compares latest <b>flow-snapshot</b> against your expectations.</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input data-testid="input-validate-week" placeholder="expected week" value={vWeek} onChange={e => setVWeek(e.target.value)} style={{ ...inp, width: 110 }} />
              <select data-testid="select-validate-action" value={vAction} onChange={e => setVAction(e.target.value as any)} style={{ ...inp, flex: 1 }}>
                <option value="">(any finalAction)</option>
                <option value="PROMPT">PROMPT</option>
                <option value="CHUM">CHUM</option>
                <option value="INVALID_WEEK_ABORT">INVALID_WEEK_ABORT</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
              <button data-testid="button-validate-run" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={async () => {
                const expected: any = {};
                if (vWeek) expected.weekNumber = Number(vWeek);
                if (vAction) expected.finalAction = vAction;
                const r = await j("/api/dev/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected }) });
                setValidateResult(r);
              }}>Validate</button>
            </div>
            {validateResult && (
              <div style={{ padding: 8, borderRadius: 6, background: validateResult.pass ? "rgba(34,197,94,0.12)" : "rgba(244,63,94,0.12)", border: `1px solid ${validateResult.pass ? "#22c55e" : "#f43f5e"}` }}>
                <div style={{ color: validateResult.pass ? "#86efac" : "#fda4af", fontWeight: 700 }}>{validateResult.pass ? "✓ PASS" : "✗ FAIL"}</div>
                <div style={{ color: "#bbb", fontSize: 10, marginTop: 4 }}>{validateResult.explanation}</div>
                <pre style={{ ...codeBlock, marginTop: 6 }}>{JSON.stringify(validateResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {tab === "file" && (
          <div>
            <div style={{ marginBottom: 6, color: "#bbb" }}>
              Current week: <b style={{ color: "#93c5fd" }}>{fileSel?.currentWeek ?? "?"}</b>
              {fileSel?.candidates && <span> · {fileSel.candidates.filter((c: any) => c.accepted).length} accepted / {fileSel.candidates.length} total</span>}
            </div>
            {fileSel?.candidates?.slice(0, 25).map((c: any, i: number) => (
              <div key={i} style={{ padding: "3px 6px", marginBottom: 3, borderLeft: `2px solid ${c.accepted ? "#22c55e" : "#888"}`, background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>
                <div style={{ color: c.accepted ? "#86efac" : "#bbb" }}>{c.name || c.error}</div>
                <div style={{ fontSize: 9, color: "#888" }}>w{c.week} · {c.folder} · {c.reason}</div>
              </div>
            ))}
            <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", color: "#888" }}>Raw file-map</summary><pre style={codeBlock} data-testid="text-dev-file">{JSON.stringify(fileSel, null, 2)}</pre></details>
          </div>
        )}

        {tab === "build" && (
          <div>
            <button style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => j("/api/dev/build-info").then(setBuild)}>Refresh</button>
            {build?.outOfDate && (
              <div style={{ marginTop: 8, padding: 8, background: "rgba(251,191,36,0.12)", border: "1px solid #fbbf24", borderRadius: 6 }}>
                <div style={{ color: "#fbbf24", fontWeight: 700 }}>⚠ Bundle is stale</div>
                <div style={{ color: "#bbb", fontSize: 10, marginTop: 4 }}>{build.outOfDateWarning}</div>
              </div>
            )}
            <pre style={{ ...codeBlock, marginTop: 8 }}>{JSON.stringify(build, null, 2)}</pre>
          </div>
        )}

        {tab === "perf" && (
          <div>
            <button style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => j("/api/dev/performance").then(setPerf)}>Refresh</button>
            {perf?.ttsChunks && (
              <div style={{ marginTop: 8 }}>
                <div>TTS chunks sampled: <b>{perf.ttsChunks.samples}</b></div>
                <div>avg: <b>{perf.ttsChunks.avgMs ?? "—"}</b> ms · p95: <b>{perf.ttsChunks.p95Ms ?? "—"}</b> ms · slowest: <b>{perf.ttsChunks.slowestMs ?? "—"}</b> ms</div>
                <div style={{ marginTop: 4 }}>timeouts: <b>{perf.timeouts}</b> · retries: <b>{perf.retries}</b></div>
              </div>
            )}
            <pre style={{ ...codeBlock, marginTop: 8 }}>{JSON.stringify(perf, null, 2)}</pre>
          </div>
        )}

        {tab === "flags" && (
          <div>
            {!flags ? <div style={{ color: "#888" }}>loading…</div> : (
              <div>
                {Object.keys(flags).map(k => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <input type="checkbox" data-testid={`flag-${k}`} checked={!!flags[k]} onChange={async e => {
                      const updated = await j("/api/dev/flags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [k]: e.target.checked }) });
                      setFlagsState(updated);
                    }} />
                    <span style={{ color: flags[k] ? "#fbbf24" : "#bbb" }}>{k}</span>
                  </label>
                ))}
                <div style={{ marginTop: 8, color: "#888", fontSize: 10 }}>Flags persist in memory only (reset on restart).</div>
              </div>
            )}
          </div>
        )}

        {tab === "system" && <pre style={codeBlock} data-testid="text-dev-system">{sysMap ? JSON.stringify({ environment: sysMap.environment, semesters: sysMap.semesters, routes: sysMap.routes ? { total: sysMap.routes.total, catFlow: sysMap.routes.catFlow } : null, database: sysMap.database ? { type: sysMap.database.type, tableCount: sysMap.database.tableCount } : null }, null, 2) : "loading…"}</pre>}

        {tab === "layout" && <div style={{ color: "#bbb" }}>Layout snapshot is pushed to <code style={{ color: "#93c5fd" }}>/api/dev/layout-map</code> every 3s.</div>}

        {tab === "rollback" && (
          <div data-testid="text-dev-rollback" style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5 }}>
            <div style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.4)", padding: 8, borderRadius: 4, marginBottom: 8 }}>
              <b style={{ color: "#fda4af" }}>READ-ONLY</b> — this tool only generates terminal commands. It NEVER runs git, never reverts, never restarts. Copy the recipe and run it on the Pi yourself.
            </div>
            {!commits && <div>loading recent commits…</div>}
            {commits?.error && <div style={{ color: "#fda4af" }}>Failed to load commits: {commits.error}</div>}
            {commits?.commits && (
              <>
                <div style={{ color: "#94a3b8", marginBottom: 4 }}>HEAD: <code style={{ color: "#86efac" }}>{commits.head?.slice(0, 9)}</code></div>
                <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid rgba(120,120,150,0.2)", borderRadius: 4 }}>
                  {commits.commits.map((c: any, i: number) => (
                    <div
                      key={c.sha}
                      data-testid={`row-commit-${c.short}`}
                      onClick={() => setPickedSha(c.sha)}
                      style={{ padding: "4px 8px", borderBottom: "1px solid rgba(120,120,150,0.12)", cursor: "pointer", background: pickedSha === c.sha ? "rgba(96,165,250,0.18)" : (i === 0 ? "rgba(34,197,94,0.08)" : "transparent") }}
                    >
                      <div style={{ display: "flex", gap: 8, fontSize: 10 }}>
                        <code style={{ color: i === 0 ? "#86efac" : "#93c5fd" }}>{c.short}</code>
                        <span style={{ color: "#94a3b8" }}>{new Date(c.date).toLocaleString()}</span>
                        <span style={{ color: "#cbd5e1", marginLeft: "auto", fontSize: 9 }}>{c.author}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#e2e8f0", marginTop: 2 }}>{i === 0 && <span style={{ color: "#86efac" }}>HEAD ← </span>}{c.message}</div>
                    </div>
                  ))}
                </div>
                {pickedSha && (() => {
                  const r = (commits.recipes || []).find((x: any) => x.target.sha === pickedSha);
                  if (!r) return <div style={{ color: "#fbbf24", marginTop: 8 }}>Pick one of the top 10 commits to see a recipe.</div>;
                  return (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ color: "#fbbf24", marginBottom: 6 }}>⚠ {r.warning}</div>
                      <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 2 }}>Option A — Safe revert (recommended)</div>
                      <pre data-testid="text-rollback-revert" style={codeBlock}>{r.revertOnly}</pre>
                      <button data-testid="button-copy-revert" style={actBtn("#86efac", "rgba(34,197,94,0.18)")} onClick={async () => { await navigator.clipboard.writeText(r.revertOnly); alert("Safe revert commands copied."); }}>Copy safe revert</button>
                      <div style={{ color: "#fda4af", fontWeight: 700, marginTop: 12, marginBottom: 2 }}>Option B — Destructive reset (last resort)</div>
                      <pre data-testid="text-rollback-reset" style={codeBlock}>{r.rollbackToHere}</pre>
                      <button data-testid="button-copy-reset" style={actBtn("#fda4af", "rgba(239,68,68,0.18)")} onClick={async () => { if (!confirm("This recipe REWRITES history. Copy anyway?")) return; await navigator.clipboard.writeText(r.rollbackToHere); alert("Destructive reset commands copied. Confirm with the user before running."); }}>Copy destructive reset</button>
                    </div>
                  );
                })()}
                <div style={{ marginTop: 10, padding: 6, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 4, color: "#fde68a" }}>
                  <b>Reminder:</b> {commits.reminder}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "fixhist" && (
          <div data-testid="text-fix-history">
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button data-testid="button-fixhist-refresh" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => j("/api/dev/fix-history?limit=200").then(setFixHist).catch(() => setFixHist({ error: "fetch failed" }))}>Refresh</button>
              <select data-testid="select-fixhist-action" value={fixFilterAction} onChange={e => setFixFilterAction(e.target.value)} style={inp}>
                <option value="">all actions</option>
                <option value="regen-tts">regen-tts</option>
                <option value="reset-queue">reset-queue</option>
                <option value="resync-onedrive">resync-onedrive</option>
                <option value="rebuild-file-map">rebuild-file-map</option>
              </select>
              <select data-testid="select-fixhist-mode" value={fixFilterMode} onChange={e => setFixFilterMode(e.target.value as any)} style={inp}>
                <option value="all">all modes</option>
                <option value="dryRun">dry-run only</option>
                <option value="real">real runs only</option>
              </select>
              <span style={{ color: "#888", fontSize: 10 }}>
                {fixHist?.entries ? `${fixHist.entries.length} entries (of ${fixHist.count})` : ""}
              </span>
            </div>
            {!fixHist ? <div style={{ color: "#888" }}>loading…</div>
              : fixHist.error ? <div style={{ color: "#fda4af" }}>{fixHist.error}</div>
              : !fixHist.entries?.length ? <div style={{ color: "#888" }}>No fix actions recorded yet. Trigger one from the Flow tab.</div>
              : (
                <div>
                  {fixHist.entries
                    .filter((e: any) => !fixFilterAction || e.action === fixFilterAction)
                    .filter((e: any) => fixFilterMode === "all" ? true : fixFilterMode === "dryRun" ? !!e.dryRun : !e.dryRun)
                    .map((e: any, i: number) => (
                      <div key={i} data-testid={`row-fixhist-${i}`} style={{ padding: 6, marginBottom: 4, borderRadius: 4, background: e.dryRun ? "rgba(96,165,250,0.08)" : "rgba(244,63,94,0.10)", borderLeft: `3px solid ${e.dryRun ? "#60a5fa" : "#f43f5e"}` }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ color: e.dryRun ? "#93c5fd" : "#fda4af", fontWeight: 700, fontSize: 11 }}>{e.action}</span>
                          <span style={{ background: e.dryRun ? "#1e3a8a" : "#7f1d1d", color: e.dryRun ? "#bfdbfe" : "#fecaca", padding: "1px 5px", borderRadius: 3, fontSize: 9 }}>{e.dryRun ? "DRY-RUN" : "REAL"}</span>
                          <span style={{ flex: 1, color: "#888", fontSize: 10 }}>{e.timestamp}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", fontSize: 10, marginTop: 3 }}>{e.result}</div>
                        {e.snapshot && <div style={{ color: "#86efac", fontSize: 9, marginTop: 2 }}>snapshot: <code>{e.snapshot}</code></div>}
                        {e.rollbackHint && !e.dryRun && <div style={{ color: "#fde68a", fontSize: 9, marginTop: 2 }}>↶ {e.rollbackHint}</div>}
                        <details style={{ marginTop: 3 }}><summary style={{ cursor: "pointer", color: "#888", fontSize: 9 }}>details</summary><pre style={{ ...codeBlock, fontSize: 9, marginTop: 3 }}>{JSON.stringify(e, null, 2)}</pre></details>
                      </div>
                    ))}
                </div>
              )}
          </div>
        )}

        {tab === "upload" && (
          <div data-testid="text-upload-readiness">
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <button data-testid="button-upload-refresh" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => { setUpload(null); j("/api/dev/upload-readiness").then(setUpload).catch(() => setUpload({ error: "fetch failed" })); }}>Refresh</button>
              {upload?.verdict && (
                <div data-testid="banner-upload-verdict" style={{ flex: 1, padding: "6px 10px", borderRadius: 6, fontWeight: 800, fontSize: 12, textAlign: "center", background: upload.ready ? "rgba(34,197,94,0.18)" : "rgba(244,63,94,0.18)", border: `2px solid ${upload.ready ? "#22c55e" : "#f43f5e"}`, color: upload.ready ? "#86efac" : "#fda4af" }}>
                  {upload.verdict}
                </div>
              )}
            </div>
            {!upload ? <div style={{ color: "#888" }}>loading…</div>
              : upload.error ? <div style={{ color: "#fda4af" }}>{upload.error}</div>
              : (
                <>
                  <div style={{ color: "#cbd5e1", fontSize: 11, marginBottom: 6 }}>{upload.summary}</div>
                  {upload.checks?.map((c: any, i: number) => {
                    const colors: any = { pass: ["#86efac", "#22c55e", "rgba(34,197,94,0.10)"], warn: ["#fde68a", "#f59e0b", "rgba(245,158,11,0.10)"], fail: ["#fda4af", "#f43f5e", "rgba(244,63,94,0.10)"] };
                    const [tc, bc, bg] = colors[c.status] || colors.warn;
                    return (
                      <div key={i} data-testid={`row-upload-check-${c.id}`} style={{ padding: 6, marginBottom: 4, borderRadius: 4, background: bg, borderLeft: `3px solid ${bc}` }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: tc, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{c.status}</span>
                          <span style={{ color: "#e8e8ec", fontSize: 11 }}>{c.id}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", fontSize: 10, marginTop: 2 }}>{c.message}</div>
                        {c.fixAction && (
                          <button data-testid={`button-upload-fix-${c.id}`} style={{ ...actBtn("#fde68a", "rgba(251,191,36,0.18)"), marginTop: 4, fontSize: 10 }} onClick={async () => {
                            const fa = c.fixAction;
                            if (fa.infoOnly) { alert(`${fa.id}\n\n${fa.hint || "Manual step — see hint."}`); return; }
                            const url = fa.endpoint + (fa.dryRunSupported ? "?dryRun=1" : "");
                            try {
                              const r = await j(url, { method: fa.method || "POST", headers: { "content-type": "application/json" }, body: fa.method === "GET" ? undefined : "{}" });
                              alert(`Preview ${fa.id}:\n\n${typeof r === "string" ? r : JSON.stringify(r, null, 2).slice(0, 800)}`);
                            } catch (e: any) { alert("Fix preview failed: " + e.message); }
                          }}>Fix It (preview)</button>
                        )}
                        {c.details && <details style={{ marginTop: 3 }}><summary style={{ cursor: "pointer", color: "#888", fontSize: 9 }}>details</summary><pre style={{ ...codeBlock, fontSize: 9, marginTop: 3 }}>{JSON.stringify(c.details, null, 2)}</pre></details>}
                      </div>
                    );
                  })}
                </>
              )}
          </div>
        )}

        {tab === "timeline" && (
          <div data-testid="text-timeline-guard">
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button data-testid="button-timeline-refresh" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => { setTimeline(null); j("/api/dev/timeline-guard").then(setTimeline).catch(() => setTimeline({ error: "fetch failed" })); }}>Refresh</button>
              {timeline?.verdict && (
                <div data-testid="banner-timeline-verdict" style={{ flex: 1, padding: "6px 10px", borderRadius: 6, fontWeight: 800, fontSize: 12, textAlign: "center", background: !timeline.issues?.length ? "rgba(34,197,94,0.18)" : "rgba(244,63,94,0.18)", border: `2px solid ${!timeline.issues?.length ? "#22c55e" : "#f43f5e"}`, color: !timeline.issues?.length ? "#86efac" : "#fda4af" }}>
                  {timeline.verdict}
                </div>
              )}
            </div>
            {!timeline ? <div style={{ color: "#888" }}>loading…</div>
              : timeline.error ? <div style={{ color: "#fda4af" }}>{timeline.error}</div>
              : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", color: "#cbd5e1", fontSize: 11, marginBottom: 8 }}>
                    <b style={{ color: "#a78bfa" }}>today</b><span data-testid="text-timeline-today">{timeline.today}</span>
                    <b style={{ color: "#a78bfa" }}>semester</b><span data-testid="text-timeline-semester">{timeline.semester || "(none)"}</span>
                    <b style={{ color: "#a78bfa" }}>start / end</b><span>{timeline.semesterStart || "?"} → {timeline.semesterEnd || "?"}</span>
                    <b style={{ color: "#a78bfa" }}>weekNumber</b><span data-testid="text-timeline-week">{timeline.weekNumber ?? "—"}</span>
                    <b style={{ color: "#a78bfa" }}>status</b><span data-testid="text-timeline-status">{timeline.status}</span>
                  </div>
                  {timeline.courses?.length > 0 && (
                    <details style={{ marginBottom: 8 }}>
                      <summary style={{ cursor: "pointer", color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>Courses ({timeline.courses.length})</summary>
                      <div style={{ marginTop: 4 }}>
                        {timeline.courses.map((c: any, i: number) => (
                          <div key={i} data-testid={`row-timeline-course-${c.code}`} style={{ padding: 4, marginBottom: 2, fontSize: 10, color: c.active ? "#86efac" : "#888" }}>
                            <b>{c.code}</b> {c.name} — {c.term || "full"} — {c.start} → {c.end} {c.active ? "✓ active" : "(inactive)"}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {!timeline.issues?.length ? <div style={{ color: "#86efac", fontSize: 11 }}>No timeline issues.</div>
                    : timeline.issues.map((iss: any, i: number) => (
                      <div key={i} data-testid={`row-timeline-issue-${i}`} style={{ padding: 6, marginBottom: 4, borderRadius: 4, background: "rgba(244,63,94,0.10)", borderLeft: "3px solid #f43f5e" }}>
                        <div style={{ color: "#fda4af", fontWeight: 700, fontSize: 11 }}>{iss.type}</div>
                        <div style={{ color: "#cbd5e1", fontSize: 10, marginTop: 2 }}>{iss.message}</div>
                        {iss.impact && <div style={{ color: "#fde68a", fontSize: 9, marginTop: 2 }}>impact: {iss.impact}</div>}
                      </div>
                    ))}
                </>
              )}
          </div>
        )}

        {tab === "afterUpload" && (
          <div data-testid="text-after-upload">
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ color: "#888", fontSize: 10 }}>since (min)</label>
              <input data-testid="input-after-min" type="number" min={5} max={1440} value={afterMin} onChange={e => setAfterMin(Number(e.target.value) || 60)} style={{ ...inp, width: 70 }} />
              <button data-testid="button-after-refresh" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={() => { setAfterUpload(null); j(`/api/dev/after-upload-check?sinceMin=${afterMin}`).then(setAfterUpload).catch(() => setAfterUpload({ error: "fetch failed" })); }}>Refresh</button>
            </div>
            {!afterUpload ? <div style={{ color: "#888" }}>loading…</div>
              : afterUpload.error ? <div style={{ color: "#fda4af" }}>{afterUpload.error}</div>
              : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8, fontSize: 11 }}>
                    <div data-testid="stat-new-files" style={{ padding: 6, background: "rgba(34,197,94,0.10)", borderRadius: 4 }}><b style={{ color: "#86efac" }}>{afterUpload.newFilesDetected?.length || 0}</b> new files</div>
                    <div data-testid="stat-queue-depth" style={{ padding: 6, background: "rgba(96,165,250,0.10)", borderRadius: 4 }}><b style={{ color: "#93c5fd" }}>{afterUpload.queueDepth || 0}</b> queued total</div>
                    <div data-testid="stat-no-text" style={{ padding: 6, background: afterUpload.filesWithoutText?.length ? "rgba(245,158,11,0.10)" : "rgba(34,197,94,0.10)", borderRadius: 4 }}><b style={{ color: afterUpload.filesWithoutText?.length ? "#fde68a" : "#86efac" }}>{afterUpload.filesWithoutText?.length || 0}</b> without text</div>
                    <div data-testid="stat-not-queued" style={{ padding: 6, background: afterUpload.filesNotQueued?.length ? "rgba(244,63,94,0.10)" : "rgba(34,197,94,0.10)", borderRadius: 4 }}><b style={{ color: afterUpload.filesNotQueued?.length ? "#fda4af" : "#86efac" }}>{afterUpload.filesNotQueued?.length || 0}</b> not queued</div>
                  </div>
                  {afterUpload.warnings?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      {afterUpload.warnings.map((w: any, i: number) => (
                        <div key={i} data-testid={`row-after-warning-${i}`} style={{ padding: 4, marginBottom: 3, borderRadius: 4, background: "rgba(245,158,11,0.10)", borderLeft: "3px solid #f59e0b", fontSize: 10, color: "#fde68a" }}>
                          <b>{w.type}</b> {w.message || JSON.stringify(w)}
                        </div>
                      ))}
                    </div>
                  )}
                  <details>
                    <summary style={{ cursor: "pointer", color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>New files ({afterUpload.newFilesDetected?.length || 0})</summary>
                    <pre style={{ ...codeBlock, fontSize: 9, marginTop: 4 }}>{JSON.stringify(afterUpload.newFilesDetected, null, 2)}</pre>
                  </details>
                </>
              )}
          </div>
        )}

        {tab === "help" && (
          <div data-testid="text-dev-help" style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5 }}>
            <div style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 6 }}>Which button do I click?</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px" }}>
              <b style={{ color: "#fde68a" }}>Page Pack</b><span>Something on the <i>current page</i> looks wrong (visual, missing data, button broken). Captures route, layout, console errors.</span>
              <b style={{ color: "#f0abfc" }}>Guided Fix</b><span>You don't know what to copy. Answer 4 questions; we pick the right endpoints and write the ChatGPT prompt for you.</span>
              <b style={{ color: "#a5b4fc" }}>Backend Pack</b><span>API or server-side issue (timeouts, 500s, wrong API response). No UI involved.</span>
              <b style={{ color: "#fcd34d" }}>TTS Pack</b><span>Audio not playing, wrong file announced, prompt sounds wrong. Includes file-map + tts-ready + cat_lights trace.</span>
              <b style={{ color: "#67e8f9" }}>OneDrive Pack</b><span>Files missing, sync stuck, course folder not detected. Includes onedrive-audit + file-map.</span>
              <b style={{ color: "#d8b4fe" }}>Minimal Prompt</b><span>Quick chat — short summary only, no giant JSON. Use this first; ChatGPT will ask for a full pack if needed.</span>
              <b style={{ color: "#fda4af" }}>Copy Debug Pack</b><span>Generic kitchen-sink — use only when you don't know what's wrong at all.</span>
              <b style={{ color: "#fca5a5" }}>Run Smoke</b><span>Copies the read-only smoke-test command. Run in a terminal to verify all dev endpoints are alive. No devices triggered.</span>
              <b style={{ color: "#fda4af" }}>Rollback (↶)</b><span>Lists recent commits and generates exact terminal commands for safe revert (recommended) or destructive reset (last resort). Never runs git itself — copy/paste only.</span>
            </div>
            <div style={{ color: "#a78bfa", fontWeight: 700, marginTop: 12, marginBottom: 6 }}>What to paste into ChatGPT</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Always paste <b>just one</b> pack — never combine.</li>
              <li>Add a one-line description: <i>"the next-reading card on the dashboard shows the wrong title"</i>.</li>
              <li>If ChatGPT asks for more data, it'll name a specific <code>/api/dev/*</code> endpoint — open it in a new tab and paste the JSON.</li>
              <li>All packs auto-redact tokens, emails, OAuth secrets, and bearer tokens before they reach your clipboard.</li>
            </ul>
            <div style={{ color: "#a78bfa", fontWeight: 700, marginTop: 12, marginBottom: 6 }}>Build & restart rules</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Frontend changes:</b> <code>cd ~/Home-View && git pull && npm run build && pm2 restart dashboard</code></li>
              <li><b>Backend changes:</b> <code>cd ~/Home-View && git pull && pm2 restart dashboard</code> (no build)</li>
              <li>The amber strip above shows when the bundle is older than your latest <code>client/src</code> edit.</li>
            </ul>
            <div style={{ color: "#a78bfa", fontWeight: 700, marginTop: 12, marginBottom: 6 }}>Protected systems</div>
            <div style={{ color: "#fbbf24" }}>Cat Lights handler · OneDrive sync · TTS / AudioPrep · devTrace instrumentation. See <code>docs/MAINTENANCE_PLAYBOOK.md</code>.</div>
          </div>
        )}
      </div>

      <div style={{ padding: "4px 8px", borderTop: "1px solid rgba(120,120,150,0.3)", color: "#777", fontSize: 9 }}>
        Ctrl+Shift+D to toggle • polling every 3s
      </div>

      {wizardOpen && (
        <div data-testid="modal-guided-fix" style={{
          position: "absolute", inset: 0, background: "rgba(10,10,15,0.96)", padding: 12,
          overflow: "auto", display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ flex: 1, fontWeight: 700, color: "#f0abfc" }}>Guided Fix Mode</span>
            <button data-testid="button-wizard-close" onClick={() => setWizardOpen(false)} style={{ background: "transparent", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
          <div style={{ color: "#888", fontSize: 10 }}>Answer 4 questions — get a ready-to-paste ChatGPT prompt.</div>

          <label style={{ color: "#cbd5e1" }}>1. What is broken?
            <textarea data-testid="input-wizard-issue" value={wizIssue} onChange={e => setWizIssue(e.target.value)}
              placeholder="e.g. The 'Next reading' card on the dashboard shows the wrong title"
              style={{ width: "100%", minHeight: 50, marginTop: 4, background: "rgba(255,255,255,0.06)", color: "#e8e8ec", border: "1px solid rgba(120,120,150,0.4)", borderRadius: 4, padding: 4, fontFamily: "inherit", fontSize: 11 }} />
          </label>

          <label style={{ color: "#cbd5e1" }}>2. Which page/system? (auto-detected: <code style={{ color: "#93c5fd" }}>{window.location.pathname}</code>)
            <select data-testid="select-wizard-side" value={wizSide} onChange={e => setWizSide(e.target.value as any)}
              style={{ width: "100%", marginTop: 4, background: "rgba(255,255,255,0.06)", color: "#e8e8ec", border: "1px solid rgba(120,120,150,0.4)", borderRadius: 4, padding: 4, fontSize: 11 }}>
              <option value="">— use auto-detected —</option>
              <option value="frontend">Frontend (UI on this page)</option>
              <option value="backend">Backend (API/data/automation)</option>
              <option value="unknown">Not sure</option>
            </select>
          </label>

          <label style={{ color: "#cbd5e1" }}>3. Category
            <select data-testid="select-wizard-area" value={wizArea} onChange={e => setWizArea(e.target.value as any)}
              style={{ width: "100%", marginTop: 4, background: "rgba(255,255,255,0.06)", color: "#e8e8ec", border: "1px solid rgba(120,120,150,0.4)", borderRadius: 4, padding: 4, fontSize: 11 }}>
              <option value="">— pick one —</option>
              <option value="visual">Visual / layout</option>
              <option value="frontend">Frontend (other UI)</option>
              <option value="data">Data / display values</option>
              <option value="cat_lights">Cat Lights (HA webhook)</option>
              <option value="automation">Automation / scheduler</option>
              <option value="onedrive">OneDrive sync</option>
              <option value="tts">TTS / audio playback</option>
              <option value="files">Files / file selection</option>
              <option value="calendar">Calendar / Google integration</option>
              <option value="database">Database / persistence</option>
              <option value="backend">Backend (other API)</option>
              <option value="unknown">Don't know</option>
            </select>
          </label>

          <label style={{ color: "#cbd5e1" }}>4. Did this start after a recent change?
            <select data-testid="select-wizard-since" value={wizSince} onChange={e => setWizSince(e.target.value as any)}
              style={{ width: "100%", marginTop: 4, background: "rgba(255,255,255,0.06)", color: "#e8e8ec", border: "1px solid rgba(120,120,150,0.4)", borderRadius: 4, padding: 4, fontSize: 11 }}>
              <option value="">— pick one —</option>
              <option value="frontend_change">After a frontend change (UI/build)</option>
              <option value="backend_change">After a backend change (API/server)</option>
              <option value="unknown">Don't know / has been broken</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            <button data-testid="button-wizard-generate" disabled={busy} onClick={buildGuidedPrompt}
              style={actBtn("#f0abfc", "rgba(217,70,239,0.18)")}>
              {busy ? "Building…" : "Generate ChatGPT Prompt"}
            </button>
            {wizPrompt && (
              <button data-testid="button-wizard-copy" onClick={async () => { await navigator.clipboard.writeText(wizPrompt); alert(`Copied (${(wizPrompt.length / 1024).toFixed(1)} KB).`); }}
                style={actBtn("#86efac", "rgba(34,197,94,0.18)")}>Copy to Clipboard</button>
            )}
          </div>

          {wizPrompt && (
            <textarea data-testid="text-wizard-prompt" readOnly value={wizPrompt}
              style={{ flex: 1, minHeight: 200, background: "rgba(255,255,255,0.04)", color: "#cbd5e1", border: "1px solid rgba(120,120,150,0.4)", borderRadius: 4, padding: 6, fontFamily: "monospace", fontSize: 10, whiteSpace: "pre-wrap" }} />
          )}
        </div>
      )}
      <div
        data-testid="dev-panel-resize-handle"
        onPointerDown={startDrag("resize")}
        onMouseDown={startDrag("resize")}
        title="Drag to resize"
        style={{ position: "absolute", right: 0, bottom: 0, width: 22, height: 22, cursor: "nwse-resize", background: "linear-gradient(135deg, transparent 45%, rgba(167,139,250,0.85) 45%)", borderBottomRightRadius: 10, touchAction: "none", zIndex: 10, pointerEvents: "auto" }}
      />
    </div>
    </>,
    document.body,
  );
}
