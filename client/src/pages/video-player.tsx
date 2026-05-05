import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";

export default function VideoPlayerPage() {
  const params = useParams<{ fileId: string }>();
  const fileId = Number(params?.fileId);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const sp = new URLSearchParams(search);
  const auth = sp.get("auth") || "";
  const startSec = Math.max(0, Number(sp.get("t") || 0));
  const muted = sp.get("muted") !== "false";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  // Captions: poll /captions/status until ready, fetch the VTT text, parse it,
  // and render our own overlay (Silk on the Fire Stick doesn't reliably draw
  // the native <track> UI, so we paint the active cue ourselves at the top).
  const [captionsStatus, setCaptionsStatus] = useState<string>("none");
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [captionsQueuePos, setCaptionsQueuePos] = useState<number | null>(null);
  const cuesRef = useRef<{ start: number; end: number; text: string }[]>([]);
  const [activeCue, setActiveCue] = useState<string>("");

  const videoUrl = `/api/files/${fileId}/download${auth ? `?auth=${encodeURIComponent(auth)}` : ""}`;

  useEffect(() => {
    fetch(`/api/files/${fileId}${auth ? `?auth=${encodeURIComponent(auth)}` : ""}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setFileName(d.displayName || d.originalName || ""); })
      .catch(() => {});
  }, [fileId, auth]);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      await v.play();
      setPlaying(true);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Autoplay failed — tap the screen to start");
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      setDuration(v.duration || 0);
      setReady(true);
      if (startSec > 0 && Number.isFinite(v.duration) && startSec < v.duration) v.currentTime = startSec;
      tryPlay();
    };
    const onTime = () => setPosition(v.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => setError("Video failed to load");
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("error", onErr);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("error", onErr);
    };
  }, [startSec, tryPlay]);

  // Captions: kick off generation on first load, poll status until ready.
  useEffect(() => {
    if (!Number.isFinite(fileId) || fileId <= 0) return;
    let cancelled = false;
    const a = auth ? `?auth=${encodeURIComponent(auth)}` : "";
    // Fire-and-forget enqueue — backend skips if already ready/processing.
    fetch(`/api/files/${fileId}/captions/enqueue${a}`, { method: "POST", credentials: "include" }).catch(() => {});
    const tick = async () => {
      try {
        const r = await fetch(`/api/files/${fileId}/captions/status${a}`, { credentials: "include" });
        if (!r.ok) return false;
        const d = await r.json();
        if (cancelled) return false;
        setCaptionsStatus(d.status || "none");
        setCaptionsQueuePos(typeof d.queuePosition === "number" ? d.queuePosition : null);
        // Set the URL as soon as ANY VTT exists (even a partial flush mid-
        // transcription) so captions stream in while Whisper is still running.
        if (d.vttUrl) setCaptionsUrl(d.vttUrl + a + (a ? "&" : "?") + "v=" + Date.now());
        // Stop polling only once status is fully 'ready'.
        return d.status === "ready";
      } catch { return false; }
    };
    let id: any = null;
    (async () => {
      const done = await tick();
      if (done || cancelled) return;
      id = setInterval(async () => {
        const done2 = await tick();
        if (done2 && id) { clearInterval(id); id = null; }
      }, 10000);
    })();
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [fileId, auth]);

  // Fetch + parse the VTT once it's ready, then drive the overlay from
  // currentTime via rAF (rock-solid on Silk; avoids the native track UI).
  useEffect(() => {
    if (!captionsUrl) return;
    let cancelled = false;
    fetch(captionsUrl, { credentials: "include" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        if (cancelled || !txt) return;
        const parseTs = (s: string) => {
          const p = s.trim().split(":");
          let h = 0, m = 0, sec = 0;
          if (p.length === 3) { h = +p[0]; m = +p[1]; sec = parseFloat(p[2]); }
          else if (p.length === 2) { m = +p[0]; sec = parseFloat(p[1]); }
          else { sec = parseFloat(p[0]); }
          return h * 3600 + m * 60 + (Number.isFinite(sec) ? sec : 0);
        };
        const lines = txt.replace(/\r/g, "").split("\n");
        const cues: { start: number; end: number; text: string }[] = [];
        let i = 0;
        while (i < lines.length) {
          const ln = lines[i];
          if (ln.includes("-->")) {
            const [a, b] = ln.split("-->").map((s) => s.trim().split(" ")[0]);
            const start = parseTs(a);
            const end = parseTs(b);
            i++;
            const buf: string[] = [];
            while (i < lines.length && lines[i].trim() !== "") { buf.push(lines[i]); i++; }
            if (buf.length) cues.push({ start, end, text: buf.join("\n") });
          }
          i++;
        }
        cuesRef.current = cues;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [captionsUrl]);

  // Drive the active-cue selector at ~10Hz from the video clock.
  useEffect(() => {
    let raf = 0;
    let lastIdx = -1;
    let lastTick = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - lastTick < 100) return;
      lastTick = t;
      const v = videoRef.current;
      const cues = cuesRef.current;
      if (!v || cues.length === 0) return;
      const now = v.currentTime;
      // Cues are sorted by start; quick scan from lastIdx forward, fall back to full.
      let idx = -1;
      const scan = (from: number) => {
        for (let j = from; j < cues.length; j++) {
          if (now >= cues[j].start && now <= cues[j].end) return j;
          if (cues[j].start > now) return -1;
        }
        return -1;
      };
      idx = scan(Math.max(0, lastIdx));
      if (idx === -1 && lastIdx > 0) idx = scan(0);
      if (idx !== lastIdx) {
        lastIdx = idx;
        setActiveCue(idx === -1 ? "" : cues[idx].text);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      fetch(`/api/cat-wash/video-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileId,
          positionSec: Math.round(v.currentTime || 0),
          durationSec: Math.round(v.duration || 0),
          playing: !v.paused,
          auth,
        }),
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [ready, fileId, auth]);

  useEffect(() => {
    if (showOverlay) {
      const id = setTimeout(() => setShowOverlay(false), 4000);
      return () => clearTimeout(id);
    }
  }, [showOverlay, playing]);

  const fmt = (s: number): string => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try { v.muted = true; await v.play(); } catch {}
    } else {
      v.pause();
    }
    setShowOverlay(true);
  }, []);

  const seekTo = useCallback((pct: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.duration * pct));
    setShowOverlay(true);
  }, []);

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div
      data-testid="video-player-page"
      onClick={() => setShowOverlay(true)}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        muted={muted}
        playsInline
        controls={false}
        data-testid="video-element"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#000",
        }}
      />

      {/* Custom captions overlay — pinned to TOP of the screen as requested.
           Big, high-contrast, drawn above all other overlays. */}
      {activeCue && (
        <div
          data-testid="overlay-captions"
          style={{
            position: "absolute",
            top: "5%",
            left: "5%",
            right: "5%",
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.78)",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 8,
              fontSize: "min(4vw, 38px)",
              fontWeight: 600,
              lineHeight: 1.25,
              textAlign: "center",
              maxWidth: "100%",
              whiteSpace: "pre-wrap",
              textShadow: "0 2px 4px rgba(0,0,0,0.9)",
              letterSpacing: "0.2px",
            }}
          >
            {activeCue}
          </div>
        </div>
      )}

      {/* Captions status badge — top-right, hides once captions are showing. */}
      {captionsStatus !== "ready" && captionsStatus !== "none" && (
        <div
          data-testid="badge-captions-status"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            padding: "6px 10px",
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 6,
            fontSize: 12,
            color: "#fff",
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          {captionsStatus === "processing"
            ? "Captions: generating…"
            : captionsStatus === "pending"
              ? `Captions: queued${captionsQueuePos !== null ? ` (#${captionsQueuePos + 1})` : ""}`
              : captionsStatus === "failed"
                ? "Captions: failed"
                : `Captions: ${captionsStatus}`}
        </div>
      )}

      {!playing && ready && (
        <div
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          data-testid="button-tap-to-play"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            cursor: "pointer",
            fontSize: 24,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>▶</div>
            <div>Tap to play</div>
            {error && <div style={{ fontSize: 14, marginTop: 8, opacity: 0.7 }}>{error}</div>}
          </div>
        </div>
      )}

      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            opacity: 0.7,
          }}
        >
          Loading video…
        </div>
      )}

      <div
        data-testid="video-progress-bar"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 20px 14px",
          background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)",
          opacity: showOverlay || !playing ? 1 : 0.85,
          transition: "opacity 0.3s",
          zIndex: 5,
        }}
      >
        {fileName && (
          <div
            data-testid="text-video-filename"
            style={{ fontSize: 13, marginBottom: 8, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {fileName}
          </div>
        )}
        <div
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - r.left) / r.width);
          }}
          style={{
            position: "relative",
            height: 8,
            background: "rgba(255,255,255,0.18)",
            borderRadius: 4,
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          <div
            data-testid="bar-video-progress-fill"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              background: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
              boxShadow: "0 0 8px rgba(96,165,250,0.6)",
              transition: "width 0.3s linear",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            marginTop: 6,
            opacity: 0.8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span data-testid="text-video-position">{fmt(position)}</span>
          <span style={{ opacity: 0.6 }}>
            {playing ? "▶ Playing" : "❚❚ Paused"} · TV (muted) · audio on Nest
          </span>
          <span data-testid="text-video-duration">{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}
