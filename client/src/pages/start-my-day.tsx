import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, X, Clock, AlertTriangle, ChevronRight, Wrench } from "lucide-react";

type NextFile = {
  status: "OK" | "BLOCKED";
  activeSemester?: string;
  currentWeek?: number;
  allowedCourses?: string[];
  totalUnlistened?: number;
  inCurrentWeek?: number;
  file?: {
    id: number; name: string; folder: string; courseCode: string;
    weekNumber: number; type: string; totalChunks: number;
    lastChunkIndex: number; hasPreparedAudio: boolean; sizeMB: number;
  };
  nextFile?: any | null;
  flags?: { stagingMode?: boolean; disableTtsPlayback?: boolean; disableHaTriggers?: boolean };
  warning?: string;
  blocker?: string;
  message?: string;
  fixAction?: { id: string; label: string; endpoint: string; method: string; dryRunSupported?: boolean; requiresConfirm?: boolean; infoOnly?: boolean; risk?: string };
};

const RESUME_KEY = "startMyDay:resume";
const TIMER_KEY = "startMyDay:timerUntil";

export default function StartMyDayPage() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<NextFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ chunk: number; total: number; isPlaying: boolean }>({ chunk: 0, total: 0, isPlaying: false });
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<number | null>(null);

  const fetchNext = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/start-my-day/next-file");
      const j = await r.json();
      setData(j);
      if (j.status === "OK" && j.file) {
        setProgress(p => ({ ...p, chunk: j.file.lastChunkIndex || 0, total: j.file.totalChunks || 0 }));
        try { localStorage.setItem(RESUME_KEY, JSON.stringify({ fileId: j.file.id, chunkIndex: j.file.lastChunkIndex || 0, ts: Date.now() })); } catch {}
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  // listen for postMessage from the reader iframe (it already posts tts-state-update)
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "tts-state-update") {
        setProgress(p => ({ ...p, isPlaying: !!ev.data.isPlaying }));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // poll the active file every 6s for chunk progress + persist resume
  useEffect(() => {
    if (!data?.file?.id) return;
    const id = data.file.id;
    const tick = async () => {
      try {
        const r = await fetch(`/api/files`);
        const list = await r.json();
        const f = Array.isArray(list) ? list.find((x: any) => x.id === id) : null;
        if (f) {
          setProgress(p => ({ ...p, chunk: f.lastChunkIndex || 0, total: f.totalChunks || p.total }));
          try { localStorage.setItem(RESUME_KEY, JSON.stringify({ fileId: id, chunkIndex: f.lastChunkIndex || 0, ts: Date.now() })); } catch {}
          if (f.listened) { fetchNext(); }
        }
      } catch {}
    };
    pollRef.current = window.setInterval(tick, 6000) as unknown as number;
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [data?.file?.id, fetchNext]);

  // 10-min timer
  useEffect(() => {
    let raf = 0;
    const update = () => {
      try {
        const until = parseInt(localStorage.getItem(TIMER_KEY) || "0", 10);
        if (until && until > Date.now()) {
          setTimerLeft(Math.max(0, Math.round((until - Date.now()) / 1000)));
        } else if (timerLeft !== null) {
          setTimerLeft(null);
        }
      } catch {}
      raf = window.setTimeout(update, 1000) as unknown as number;
    };
    update();
    return () => { if (raf) window.clearTimeout(raf); };
  }, [timerLeft]);

  const startTimer = () => {
    const until = Date.now() + 10 * 60 * 1000;
    try { localStorage.setItem(TIMER_KEY, String(until)); } catch {}
    setTimerLeft(600);
  };

  const exitFocus = () => {
    try { document.exitFullscreen?.(); } catch {}
    navigate("/");
  };

  const runFix = async (dryRun: boolean) => {
    if (!data?.fixAction) return;
    if (!dryRun && data.fixAction.requiresConfirm) {
      if (!confirm(`Apply REAL fix: ${data.fixAction.label}\n\nA snapshot will be saved and the action logged.\n\nContinue?`)) return;
    }
    setFixBusy(true); setFixResult(null);
    try {
      const url = data.fixAction.endpoint + (data.fixAction.dryRunSupported ? `?dryRun=${dryRun ? 1 : 0}` : "");
      const r = await fetch(url, { method: data.fixAction.method, headers: { "Content-Type": "application/json" }, body: data.fixAction.method === "POST" ? JSON.stringify({ confirm: !dryRun }) : undefined });
      const j = await r.json().catch(() => ({}));
      setFixResult({ dryRun, ...j });
      if (!dryRun) setTimeout(() => fetchNext(), 800);
    } catch (e: any) {
      setFixResult({ error: e.message });
    } finally {
      setFixBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={fullScreen} data-testid="page-start-my-day-loading">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div style={{ marginTop: 12, color: "#9ca3af" }}>Picking your next file…</div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div style={fullScreen} data-testid="page-start-my-day-error">
        <AlertTriangle className="h-8 w-8" style={{ color: "#f59e0b" }} />
        <div style={{ marginTop: 12, color: "#fca5a5" }}>{err || "Unknown error"}</div>
        <button onClick={fetchNext} style={primaryBtn}>Retry</button>
        <button onClick={exitFocus} style={ghostBtn}>Back</button>
      </div>
    );
  }

  if (data.status === "BLOCKED") {
    return (
      <div style={{ ...fullScreen, padding: 32 }} data-testid="page-start-my-day-blocked">
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle className="h-7 w-7" style={{ color: "#fbbf24" }} />
            <h1 style={{ margin: 0, fontSize: 22, color: "#fff" }}>Cannot start yet</h1>
          </div>
          <div style={{ background: "#1f2937", padding: 16, borderRadius: 8, border: "1px solid #374151" }}>
            <div style={{ color: "#fcd34d", fontWeight: 600, fontSize: 13, marginBottom: 6 }} data-testid="text-blocker">{data.blocker}</div>
            <div style={{ color: "#e5e7eb", fontSize: 14, lineHeight: 1.5 }} data-testid="text-blocker-message">{data.message}</div>
            {data.allowedCourses && data.allowedCourses.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>Active courses: {data.allowedCourses.join(", ")} · Week {data.currentWeek ?? "?"}</div>
            )}
          </div>
          {data.fixAction && (
            <div style={{ marginTop: 16, background: "#0f172a", padding: 14, borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Wrench className="h-4 w-4" style={{ color: "#a5b4fc" }} />
                <div style={{ color: "#c7d2fe", fontWeight: 600, fontSize: 13 }}>Suggested fix</div>
              </div>
              <div style={{ color: "#e5e7eb", fontSize: 13, marginBottom: 10 }} data-testid="text-fix-label">{data.fixAction.label}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {data.fixAction.dryRunSupported && (
                  <button onClick={() => runFix(true)} disabled={fixBusy} style={ghostBtn} data-testid="button-fix-preview">
                    {fixBusy ? "…" : "Preview"}
                  </button>
                )}
                {!data.fixAction.infoOnly && (
                  <button onClick={() => runFix(false)} disabled={fixBusy} style={dangerBtn} data-testid="button-fix-apply">
                    {fixBusy ? "Applying…" : `Apply${data.fixAction.requiresConfirm ? " (confirm)" : ""}`}
                  </button>
                )}
              </div>
              {fixResult && (
                <pre style={{ marginTop: 10, background: "#000", color: "#86efac", padding: 8, borderRadius: 4, fontSize: 11, maxHeight: 160, overflow: "auto" }} data-testid="text-fix-result">{JSON.stringify(fixResult, null, 2)}</pre>
              )}
            </div>
          )}
          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            <button onClick={fetchNext} style={primaryBtn} data-testid="button-recheck">Re-check</button>
            <button onClick={exitFocus} style={ghostBtn} data-testid="button-exit-blocked">Back to home</button>
          </div>
        </div>
      </div>
    );
  }

  const f = data.file!;
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.chunk / progress.total) * 100)) : 0;
  const readerSrc = `/pdf-reader/${f.id}?autoplay=1&fullscreen=1&startMyDay=1${f.lastChunkIndex ? `&resumeChunk=${f.lastChunkIndex}` : ""}`;

  return (
    <div style={focusContainer} data-testid="page-start-my-day-focus">
      {/* Reader iframe (does the actual playback) */}
      <iframe
        ref={iframeRef}
        src={readerSrc}
        name="book-reader-iframe"
        title="Reader"
        style={{ width: "100%", height: "100%", border: 0, background: "#000" }}
        allow="fullscreen; autoplay"
      />

      {/* Focus overlay (top bar) */}
      <div style={topBar}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: 0.5, fontWeight: 600 }} data-testid="text-course-info">
            {f.courseCode} · WEEK {f.weekNumber} · {f.type.toUpperCase()}
          </div>
          <div style={{ fontSize: 14, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }} data-testid="text-file-name">
            {f.name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {timerLeft !== null ? (
            <div style={timerBadge} data-testid="text-timer-left">
              <Clock className="h-3 w-3" /> {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, "0")}
            </div>
          ) : (
            <button onClick={startTimer} style={timerBtn} data-testid="button-start-timer">
              <Clock className="h-3 w-3" /> Just 10 minutes
            </button>
          )}
          <button onClick={exitFocus} style={exitBtn} data-testid="button-exit-focus" aria-label="Exit focus mode">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom progress + next-up */}
      <div style={bottomBar}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
            <span data-testid="text-progress">{progress.chunk} / {progress.total || "?"} chunks · {pct}%</span>
            <span data-testid="text-status">{progress.isPlaying ? "▶ playing" : "⏸ paused"}</span>
          </div>
          <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", transition: "width 400ms" }} data-testid="bar-progress" />
          </div>
        </div>
        {data.nextFile && (
          <div style={nextCard} data-testid="card-next-file">
            <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 0.5 }}>NEXT</div>
            <div style={{ fontSize: 11, color: "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
              {data.nextFile.courseCode} · {data.nextFile.name}
            </div>
            <ChevronRight className="h-4 w-4" style={{ color: "#6b7280" }} />
          </div>
        )}
      </div>

      {data.warning && (
        <div style={warningBanner} data-testid="text-warning">
          <AlertTriangle className="h-3 w-3" /> {data.warning}
        </div>
      )}
    </div>
  );
}

const fullScreen: React.CSSProperties = { position: "fixed", inset: 0, background: "#0a0a0a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, fontFamily: "system-ui, -apple-system, sans-serif" };
const focusContainer: React.CSSProperties = { position: "fixed", inset: 0, background: "#000", zIndex: 9999, fontFamily: "system-ui, -apple-system, sans-serif" };
const topBar: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, padding: "10px 14px", background: "linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0))", display: "flex", alignItems: "center", gap: 12, zIndex: 10 };
const bottomBar: React.CSSProperties = { position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px 16px", background: "linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0))", display: "flex", alignItems: "flex-end", gap: 16, zIndex: 10 };
const primaryBtn: React.CSSProperties = { marginTop: 16, background: "#2563eb", color: "#fff", border: 0, padding: "10px 18px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 };
const dangerBtn: React.CSSProperties = { background: "#dc2626", color: "#fff", border: 0, padding: "8px 14px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 };
const ghostBtn: React.CSSProperties = { marginTop: 8, background: "transparent", color: "#e5e7eb", border: "1px solid #374151", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const exitBtn: React.CSSProperties = { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", padding: 6, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center" };
const timerBtn: React.CSSProperties = { background: "rgba(34,197,94,0.18)", color: "#86efac", border: "1px solid rgba(34,197,94,0.35)", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 };
const timerBadge: React.CSSProperties = { background: "rgba(34,197,94,0.18)", color: "#86efac", border: "1px solid rgba(34,197,94,0.35)", padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, fontVariantNumeric: "tabular-nums" };
const nextCard: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 10px", borderRadius: 6 };
const warningBanner: React.CSSProperties = { position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", background: "rgba(245,158,11,0.18)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.35)", padding: "5px 10px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 6, zIndex: 11 };
