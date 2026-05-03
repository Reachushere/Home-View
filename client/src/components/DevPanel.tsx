import { useEffect, useState, useRef } from "react";

// Hidden developer introspection panel.
// Toggle with Ctrl+Shift+D, or visit any page with `?dev=1`.
// Also POSTs a layout snapshot to /api/dev/layout-map every 3s while open.

type Trace = { time: string; step: string; data?: any };
type FileSel = { time?: string; source?: string; semester?: string; weekNumber?: number; selectedFileName?: string; folder?: string; reason?: string; empty?: boolean; hint?: string };

export function DevPanel() {
  const [open, setOpen] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).get("dev") === "1"; } catch { return false; }
  });
  const [trace, setTrace] = useState<Trace[]>([]);
  const [fileSel, setFileSel] = useState<FileSel | null>(null);
  const [sysMap, setSysMap] = useState<any>(null);
  const [tab, setTab] = useState<"trace" | "file" | "system" | "layout">("trace");
  const tickRef = useRef<number | null>(null);

  // Toggle hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Polling + layout snapshot push.
  useEffect(() => {
    if (!open) {
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    const tick = async () => {
      try {
        const [t, f] = await Promise.all([
          fetch("/api/dev/automation-trace").then(r => r.json()).catch(() => null),
          fetch("/api/dev/file-map").then(r => r.json()).catch(() => null),
        ]);
        if (t?.steps) setTrace(t.steps.slice(-40).reverse());
        if (f) setFileSel(f);
      } catch {}
      // Layout snapshot.
      try {
        const cal = document.querySelector('[data-testid^="calendar"], .calendar-grid, [class*="Calendar"]') as HTMLElement | null;
        const countdown = document.querySelector('[data-countdown-bullet], [data-countdown-badge]') as HTMLElement | null;
        const calBox = cal?.getBoundingClientRect();
        const cdBox = countdown?.parentElement?.getBoundingClientRect();
        const cdStyle = countdown?.parentElement ? window.getComputedStyle(countdown.parentElement) : null;
        const view = (document.querySelector('[data-testid="view-week"], [data-testid="view-month"]') as HTMLElement | null)?.dataset?.testid?.replace("view-", "") || "unknown";
        await fetch("/api/dev/layout-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  useEffect(() => {
    if (!open || tab !== "system") return;
    fetch("/api/dev/system-map").then(r => r.json()).then(setSysMap).catch(() => setSysMap({ error: "fetch failed" }));
  }, [open, tab]);

  if (!open) return null;

  const panel: React.CSSProperties = {
    position: "fixed", right: 8, bottom: 36, zIndex: 99999,
    width: 460, maxHeight: "70vh", overflow: "hidden",
    background: "rgba(15,15,20,0.94)", color: "#e8e8ec",
    border: "1px solid rgba(120,120,150,0.4)", borderRadius: 10,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11, boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
    display: "flex", flexDirection: "column",
  };
  const tabBtn = (id: typeof tab, label: string): React.CSSProperties => ({
    flex: 1, padding: "6px 4px", cursor: "pointer", border: "none",
    background: tab === id ? "rgba(96,165,250,0.18)" : "transparent",
    color: tab === id ? "#93c5fd" : "#bbb",
    borderBottom: tab === id ? "1px solid #60a5fa" : "1px solid transparent",
    fontSize: 11, fontWeight: 600,
  });

  return (
    <div style={panel} data-testid="dev-panel">
      <div style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(120,120,150,0.3)" }}>
        <span style={{ flex: 1, fontWeight: 700, color: "#a78bfa" }}>UniCal Dev Panel</span>
        <button onClick={() => setOpen(false)} data-testid="button-dev-close" style={{ background: "transparent", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14 }}>×</button>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(120,120,150,0.3)" }}>
        <button onClick={() => setTab("trace")} data-testid="tab-dev-trace" style={tabBtn("trace", "Trace")}>Trace ({trace.length})</button>
        <button onClick={() => setTab("file")} data-testid="tab-dev-file" style={tabBtn("file", "File")}>File</button>
        <button onClick={() => setTab("system")} data-testid="tab-dev-system" style={tabBtn("system", "System")}>System</button>
        <button onClick={() => setTab("layout")} data-testid="tab-dev-layout" style={tabBtn("layout", "Layout")}>Layout</button>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid rgba(120,120,150,0.2)" }}>
        <button
          data-testid="button-dev-handoff"
          style={{ flex: 1, padding: "5px 6px", fontSize: 10, background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.4)", color: "#c4b5fd", borderRadius: 4, cursor: "pointer" }}
          onClick={async () => {
            try {
              const r = await fetch("/api/dev/handoff?format=text");
              const text = await r.text();
              await navigator.clipboard.writeText(text);
              alert(`Handoff copied (${(text.length / 1024).toFixed(1)} KB) — paste into ChatGPT.`);
            } catch (e: any) { alert("Failed: " + e.message); }
          }}
        >Copy Handoff</button>
        <button
          data-testid="button-dev-status"
          style={{ flex: 1, padding: "5px 6px", fontSize: 10, background: "rgba(96,165,250,0.18)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd", borderRadius: 4, cursor: "pointer" }}
          onClick={async () => {
            try {
              const r = await fetch("/api/dev/status");
              const json = await r.json();
              await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
              alert("Status JSON copied to clipboard.");
            } catch (e: any) { alert("Failed: " + e.message); }
          }}
        >Copy Status</button>
        <button
          data-testid="button-dev-page-info"
          style={{ flex: 1, padding: "5px 6px", fontSize: 10, background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.4)", color: "#86efac", borderRadius: 4, cursor: "pointer" }}
          onClick={async () => {
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
            try { await navigator.clipboard.writeText(JSON.stringify(info, null, 2)); alert("Page inspector JSON copied."); }
            catch (e: any) { alert("Failed: " + e.message); }
          }}
        >Copy Page</button>
      </div>
      <div style={{ overflow: "auto", padding: 8, flex: 1 }}>
        {tab === "trace" && (
          trace.length === 0
            ? <div style={{ color: "#888" }}>No trace steps yet. Trigger Cat Lights to populate.</div>
            : trace.map((s, i) => (
                <div key={i} style={{ padding: "4px 6px", marginBottom: 4, background: "rgba(255,255,255,0.03)", borderRadius: 4, borderLeft: "2px solid #60a5fa" }}>
                  <div style={{ color: "#93c5fd" }}>{s.step}</div>
                  <div style={{ color: "#888", fontSize: 9 }}>{new Date(s.time).toLocaleTimeString()}</div>
                  {s.data && <pre style={{ margin: "2px 0 0", color: "#cbd5e1", fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(s.data, null, 0).slice(0, 240)}</pre>}
                </div>
              ))
        )}
        {tab === "file" && <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }} data-testid="text-dev-file">{JSON.stringify(fileSel, null, 2)}</pre>}
        {tab === "system" && <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10 }} data-testid="text-dev-system">{sysMap ? JSON.stringify({ environment: sysMap.environment, semesters: sysMap.semesters, routes: sysMap.routes ? { total: sysMap.routes.total, catFlow: sysMap.routes.catFlow } : null, database: sysMap.database ? { type: sysMap.database.type, tableCount: sysMap.database.tableCount } : null }, null, 2) : "loading…"}</pre>}
        {tab === "layout" && <div style={{ color: "#bbb" }}>Layout snapshot is pushed to <code style={{ color: "#93c5fd" }}>/api/dev/layout-map</code> every 3s. View with that endpoint or curl it.</div>}
      </div>
      <div style={{ padding: "4px 8px", borderTop: "1px solid rgba(120,120,150,0.3)", color: "#777", fontSize: 9 }}>
        Ctrl+Shift+D to toggle • polling every 3s
      </div>
    </div>
  );
}
