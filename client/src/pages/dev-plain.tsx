import { useEffect, useRef, useState } from "react";

type Section = {
  id: string;
  label: string;
  color: string;
  bg: string;
  endpoints: string[];
};

const SECTIONS: Section[] = [
  { id: "status",   label: "Status",        color: "#93c5fd", bg: "rgba(96,165,250,0.18)", endpoints: ["/api/dev/status"] },
  { id: "diag",     label: "Diagnose",      color: "#fda4af", bg: "rgba(244,63,94,0.18)",  endpoints: ["/api/dev/diagnose"] },
  { id: "build",    label: "Build Info",    color: "#fde68a", bg: "rgba(251,191,36,0.20)", endpoints: ["/api/dev/build-info"] },
  { id: "errors",   label: "Recent Errors", color: "#fca5a5", bg: "rgba(239,68,68,0.18)",  endpoints: ["/api/dev/recent-errors"] },
  { id: "perf",     label: "Performance",   color: "#86efac", bg: "rgba(34,197,94,0.18)",  endpoints: ["/api/dev/performance"] },
  { id: "files",    label: "File Map",      color: "#67e8f9", bg: "rgba(34,211,238,0.18)", endpoints: ["/api/dev/file-map"] },
  { id: "flow",     label: "Flow Snapshot", color: "#c4b5fd", bg: "rgba(167,139,250,0.18)", endpoints: ["/api/dev/flow-snapshot"] },
  { id: "init",     label: "Init Checklist", color: "#fbbf24", bg: "rgba(251,191,36,0.18)", endpoints: ["/api/dev/init-checklist"] },
  { id: "commits",  label: "Recent Commits", color: "#a5b4fc", bg: "rgba(129,140,248,0.18)", endpoints: ["/api/dev/recent-commits"] },
  { id: "fixhist",  label: "Fix History",   color: "#d8b4fe", bg: "rgba(192,132,252,0.18)", endpoints: ["/api/dev/fix-history?limit=200"] },
  { id: "upload",   label: "Upload Ready",  color: "#fcd34d", bg: "rgba(251,191,36,0.18)", endpoints: ["/api/dev/upload-readiness"] },
];

const COMBO_PACKS: Section[] = [
  { id: "debug",    label: "Debug Pack (everything)", color: "#fda4af", bg: "rgba(244,63,94,0.25)",
    endpoints: ["/api/dev/status","/api/dev/diagnose","/api/dev/build-info","/api/dev/recent-errors","/api/dev/performance","/api/dev/flow-snapshot","/api/dev/file-map","/api/dev/trace?subsystem=cat_lights"] },
  { id: "backend",  label: "Backend Pack", color: "#a5b4fc", bg: "rgba(129,140,248,0.25)",
    endpoints: ["/api/dev/status","/api/dev/diagnose","/api/dev/recent-errors","/api/dev/performance","/api/dev/build-info"] },
  { id: "tts",      label: "TTS Pack", color: "#fcd34d", bg: "rgba(251,191,36,0.25)",
    endpoints: ["/api/dev/flow-snapshot","/api/dev/diagnose","/api/dev/tts-ready","/api/dev/file-map","/api/dev/trace?subsystem=cat_lights","/api/dev/recent-errors"] },
  { id: "onedrive", label: "OneDrive Pack", color: "#67e8f9", bg: "rgba(34,211,238,0.25)",
    endpoints: ["/api/dev/status","/api/dev/onedrive-audit","/api/dev/file-map","/api/dev/recent-errors"] },
];

export default function DevPlainPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const authParam = params.get("auth");
        const url = authParam ? `/api/auth/check?auth=${encodeURIComponent(authParam)}` : "/api/auth/check";
        const r = await fetch(url, { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        const level = j?.level || j?.authLevel || "";
        if (!cancelled) setAllowed(level === "5747");
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const DEV_KEY_STORAGE = "unical:devKey";
  const getDevKey = () => { try { return localStorage.getItem(DEV_KEY_STORAGE) || ""; } catch { return ""; } };
  const setDevKey = (k: string) => { try { if (k) localStorage.setItem(DEV_KEY_STORAGE, k); else localStorage.removeItem(DEV_KEY_STORAGE); } catch {} };
  const fetchDev = async (url: string) => {
    const isDev = url.startsWith("/api/dev");
    const headers: Record<string, string> = {};
    if (isDev) { const k = getDevKey(); if (k) headers["x-dev-key"] = k; }
    let r = await fetch(url, { credentials: "include", headers });
    if (r.status === 401 && isDev) {
      const entered = window.prompt("Enter DEV_API_KEY for /api/dev/* access:") || "";
      if (entered) {
        setDevKey(entered);
        headers["x-dev-key"] = entered;
        r = await fetch(url, { credentials: "include", headers });
      }
    }
    return r;
  };

  const runSection = async (s: Section, alsoCopy: boolean) => {
    setBusy(s.id);
    setStatus(`fetching ${s.endpoints.length} endpoint(s)…`);
    const sep = "\n────────────────────────────────────────\n";
    const parts: string[] = [`=== ${s.label.toUpperCase()} ===`, `Generated: ${new Date().toISOString()}`, ""];
    for (const ep of s.endpoints) {
      parts.push(`## ${ep}`);
      try {
        const r = await fetchDev(ep);
        const ct = r.headers.get("content-type") || "";
        const body = ct.includes("json") ? JSON.stringify(await r.json(), null, 2) : await r.text();
        parts.push("```", body, "```");
      } catch (e: any) {
        parts.push(`ERROR: ${e?.message || e}`);
      }
      parts.push(sep);
    }
    const text = parts.join("\n");
    setOutput(text);
    setStatus(`done · ${(text.length / 1024).toFixed(1)} KB`);
    if (alsoCopy) {
      try {
        await navigator.clipboard.writeText(text);
        setStatus(`copied to clipboard · ${(text.length / 1024).toFixed(1)} KB`);
      } catch {
        if (taRef.current) {
          taRef.current.focus();
          taRef.current.select();
          try { document.execCommand("copy"); setStatus(`copied via fallback · ${(text.length / 1024).toFixed(1)} KB`); }
          catch { setStatus(`copy failed — select textarea manually`); }
        }
      }
    }
    setBusy("");
  };

  const copyOutput = async () => {
    if (!output) { setStatus("no output yet"); return; }
    try { await navigator.clipboard.writeText(output); setStatus(`copied · ${(output.length / 1024).toFixed(1)} KB`); }
    catch {
      if (taRef.current) { taRef.current.focus(); taRef.current.select(); document.execCommand("copy"); setStatus("copied via fallback"); }
    }
  };

  if (allowed === null) {
    return <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>checking access…</div>;
  }
  if (!allowed) {
    return (
      <div data-testid="dev-plain-blocked" style={{ minHeight: "100vh", background: "#0f0f14", color: "#e8e8ec", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "ui-monospace, monospace", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>404 — Not Found</div>
          <div style={{ fontSize: 12, color: "#888" }}>This page is admin-only (level 5747).</div>
        </div>
      </div>
    );
  }

  const btn = (color: string, bg: string, big = false): React.CSSProperties => ({
    background: bg, color, border: `1px solid ${color}`, borderRadius: 6,
    padding: big ? "14px 18px" : "12px 14px", fontSize: big ? 15 : 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "ui-monospace, monospace",
    minHeight: 48, textAlign: "left",
  });

  return (
    <div data-testid="dev-plain-page" style={{
      minHeight: "100vh", background: "#0f0f14", color: "#e8e8ec",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, color: "#a78bfa" }} data-testid="text-dev-title">UniCal Dev — Plain Mode</h1>
        <span style={{ fontSize: 11, color: "#888" }}>admin (5747) · /dev</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          data-testid="button-set-dev-key"
          onClick={() => {
            const cur = getDevKey();
            const entered = window.prompt(`Enter DEV_API_KEY (current: ${cur ? "set ✓" : "not set"})`, cur) ?? "";
            if (entered === cur) return;
            setDevKey(entered);
            setStatus(entered ? "DEV_API_KEY saved" : "DEV_API_KEY cleared");
          }}
          style={{ background: "rgba(251,191,36,0.18)", color: "#fde68a", border: "1px solid rgba(251,191,36,0.6)", borderRadius: 4, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, monospace" }}
        >Set Dev Key</button>
        <a href="/" style={{ color: "#93c5fd", textDecoration: "none", fontSize: 12, padding: "6px 10px", border: "1px solid rgba(96,165,250,0.4)", borderRadius: 4 }} data-testid="link-home">← back to dashboard</a>
      </div>

      <div style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.4)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#bae6fd" }}>
        Each button fetches the endpoint(s) and shows the result in the textarea below. Click <b>Copy</b> on a button to also copy to clipboard. Click the textarea to select all.
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 700 }}>COMBO PACKS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
          {COMBO_PACKS.map(s => (
            <div key={s.id} style={{ display: "flex", gap: 4 }}>
              <button type="button" disabled={!!busy} data-testid={`button-show-${s.id}`} onClick={() => runSection(s, false)} style={{ ...btn(s.color, s.bg, true), flex: 1 }}>{busy === s.id ? "…" : s.label}</button>
              <button type="button" disabled={!!busy} data-testid={`button-copy-${s.id}`} onClick={() => runSection(s, true)} title="Show + copy" style={{ ...btn(s.color, s.bg, true), flex: 0, padding: "14px 12px" }}>📋</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 700 }}>SINGLE ENDPOINTS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
          {SECTIONS.map(s => (
            <div key={s.id} style={{ display: "flex", gap: 4 }}>
              <button type="button" disabled={!!busy} data-testid={`button-show-${s.id}`} onClick={() => runSection(s, false)} style={{ ...btn(s.color, s.bg), flex: 1 }}>{busy === s.id ? "…" : s.label}</button>
              <button type="button" disabled={!!busy} data-testid={`button-copy-${s.id}`} onClick={() => runSection(s, true)} title="Show + copy" style={{ ...btn(s.color, s.bg), flex: 0, padding: "12px 10px" }}>📋</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <button type="button" data-testid="button-copy-output" onClick={copyOutput} disabled={!output} style={btn("#86efac", "rgba(34,197,94,0.20)")}>Copy Output</button>
        <button type="button" data-testid="button-clear-output" onClick={() => { setOutput(""); setStatus("cleared"); }} disabled={!output} style={btn("#aaa", "rgba(120,120,150,0.18)")}>Clear</button>
        <span style={{ fontSize: 12, color: "#bae6fd", marginLeft: 8 }} data-testid="text-status">{status || "ready"}</span>
      </div>

      <textarea
        ref={taRef}
        data-testid="text-output"
        readOnly
        value={output}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        placeholder="output appears here…"
        style={{
          flex: 1, minHeight: 360, background: "#000", color: "#cbd5e1",
          border: "1px solid rgba(120,120,150,0.4)", borderRadius: 6, padding: 10,
          fontFamily: "ui-monospace, monospace", fontSize: 11, whiteSpace: "pre",
          resize: "vertical",
        }}
      />
    </div>
  );
}
