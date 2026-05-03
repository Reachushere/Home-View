import { useEffect, useState, useRef } from "react";

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
  | "build" | "perf" | "flags" | "system" | "layout";

const j = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init);
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
  const [build, setBuild] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [flags, setFlagsState] = useState<any>(null);
  const [tab, setTab] = useState<TabId>("trace");
  const [busy, setBusy] = useState(false);
  // Replay form state
  const [rDate, setRDate] = useState("");
  const [rWeek, setRWeek] = useState("");
  const [replayResult, setReplayResult] = useState<any>(null);
  // Validate form state
  const [vWeek, setVWeek] = useState("");
  const [vAction, setVAction] = useState<"" | "PROMPT" | "CHUM" | "INVALID_WEEK_ABORT" | "UNKNOWN">("");
  const [validateResult, setValidateResult] = useState<any>(null);
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

  // Lazy-load the per-tab data only when the tab is opened.
  useEffect(() => {
    if (!open) return;
    if (tab === "system" && !sysMap) j("/api/dev/system-map").then(setSysMap).catch(() => setSysMap({ error: "fetch failed" }));
    if (tab === "flow") {
      j("/api/dev/flow-snapshot").then(setFlow).catch(() => {});
      j("/api/dev/diagnose").then(setDiag).catch(() => {});
    }
    if (tab === "build") j("/api/dev/build-info").then(setBuild).catch(() => {});
    if (tab === "perf") j("/api/dev/performance").then(setPerf).catch(() => {});
    if (tab === "flags" && !flags) j("/api/dev/flags").then(setFlagsState).catch(() => {});
  }, [open, tab]); // eslint-disable-line

  if (!open) return null;

  const panel: React.CSSProperties = {
    position: "fixed", right: 8, bottom: 36, zIndex: 99999,
    width: 520, maxHeight: "80vh", overflow: "hidden",
    background: "rgba(15,15,20,0.96)", color: "#e8e8ec",
    border: "1px solid rgba(120,120,150,0.4)", borderRadius: 10,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11, boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
    display: "flex", flexDirection: "column",
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
        "## /api/dev/status", "```json", JSON.stringify(status, null, 2), "```", sep,
        "## /api/dev/build-info", "```json", JSON.stringify(binfo, null, 2), "```", sep,
        "## /api/dev/flow-snapshot (latest Cat Lights run)", "```json", JSON.stringify(snap, null, 2), "```", sep,
        "## /api/dev/diagnose", "```json", JSON.stringify(dx, null, 2), "```", sep,
        "## /api/dev/file-map", "```json", JSON.stringify(fmap, null, 2), "```", sep,
        "## /api/dev/performance", "```json", JSON.stringify(p, null, 2), "```", sep,
        "## /api/dev/recent-errors", "```json", JSON.stringify(errs, null, 2), "```", sep,
        "## /api/dev/trace?subsystem=cat_lights", "```json", JSON.stringify(ctrace, null, 2), "```",
      ].join("\n");
      await navigator.clipboard.writeText(text);
      alert(`Debug pack copied (${(text.length / 1024).toFixed(1)} KB) — paste into ChatGPT.`);
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={panel} data-testid="dev-panel">
      <div style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(120,120,150,0.3)" }}>
        <span style={{ flex: 1, fontWeight: 700, color: "#a78bfa" }}>UniCal Dev Panel</span>
        {build?.outOfDate && <span title={build.outOfDateWarning} style={{ marginRight: 8, color: "#fbbf24", fontSize: 10 }}>⚠ build stale</span>}
        <button onClick={() => setOpen(false)} data-testid="button-dev-close" style={{ background: "transparent", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14 }}>×</button>
      </div>

      {/* Tabs row */}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(120,120,150,0.3)" }}>
        <button onClick={() => setTab("trace")} data-testid="tab-dev-trace" style={tabBtn("trace", "Trace")}>Trace ({trace.length})</button>
        <button onClick={() => setTab("flow")} data-testid="tab-dev-flow" style={tabBtn("flow", "Flow")}>Flow</button>
        <button onClick={() => setTab("replay")} data-testid="tab-dev-replay" style={tabBtn("replay", "Replay")}>Replay</button>
        <button onClick={() => setTab("validate")} data-testid="tab-dev-validate" style={tabBtn("validate", "Validate")}>Validate</button>
        <button onClick={() => setTab("file")} data-testid="tab-dev-file" style={tabBtn("file", "File")}>File</button>
        <button onClick={() => setTab("build")} data-testid="tab-dev-build" style={tabBtn("build", "Build")}>Build</button>
        <button onClick={() => setTab("perf")} data-testid="tab-dev-perf" style={tabBtn("perf", "Perf")}>Perf</button>
        <button onClick={() => setTab("flags")} data-testid="tab-dev-flags" style={tabBtn("flags", "Flags")}>Flags</button>
        <button onClick={() => setTab("system")} data-testid="tab-dev-system" style={tabBtn("system", "Sys")}>Sys</button>
        <button onClick={() => setTab("layout")} data-testid="tab-dev-layout" style={tabBtn("layout", "Layout")}>Layout</button>
      </div>

      {/* Action button row */}
      <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid rgba(120,120,150,0.2)" }}>
        <button data-testid="button-dev-debug-pack" disabled={busy} style={actBtn("#fda4af", "rgba(244,63,94,0.18)")} onClick={copyDebugPack}>
          {busy ? "Collecting…" : "Copy Debug Pack"}
        </button>
        <button data-testid="button-dev-handoff" style={actBtn("#c4b5fd", "rgba(167,139,250,0.18)")} onClick={async () => {
          try {
            const r = await fetch("/api/dev/handoff?format=text");
            const text = await r.text();
            await navigator.clipboard.writeText(text);
            alert(`Handoff copied (${(text.length / 1024).toFixed(1)} KB).`);
          } catch (e: any) { alert("Failed: " + e.message); }
        }}>Copy Handoff</button>
        <button data-testid="button-dev-status" style={actBtn("#93c5fd", "rgba(96,165,250,0.18)")} onClick={async () => {
          try { const r = await j("/api/dev/status"); await navigator.clipboard.writeText(JSON.stringify(r, null, 2)); alert("Status copied."); }
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
          try { await navigator.clipboard.writeText(JSON.stringify(info, null, 2)); alert("Page inspector copied."); }
          catch (e: any) { alert("Failed: " + e.message); }
        }}>Copy Page</button>
      </div>

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
      </div>

      <div style={{ padding: "4px 8px", borderTop: "1px solid rgba(120,120,150,0.3)", color: "#777", fontSize: 9 }}>
        Ctrl+Shift+D to toggle • polling every 3s
      </div>
    </div>
  );
}
