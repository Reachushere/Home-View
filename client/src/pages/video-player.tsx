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
  // Captions: poll /captions/status until ready, then mount <track>.
  const [captionsStatus, setCaptionsStatus] = useState<string>("none");
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [captionsQueuePos, setCaptionsQueuePos] = useState<number | null>(null);

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
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        setCaptionsStatus(d.status || "none");
        setCaptionsQueuePos(typeof d.queuePosition === "number" ? d.queuePosition : null);
        if (d.ready && d.vttUrl) {
          setCaptionsUrl(d.vttUrl + a);
          return true;
        }
      } catch {}
      return false;
    };
    let id: any = null;
    (async () => {
      const done = await tick();
      if (done || cancelled) return;
      id = setInterval(async () => {
        const done2 = await tick();
        if (done2 && id) { clearInterval(id); id = null; }
      }, 8000);
    })();
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [fileId, auth]);

  // Auto-enable captions on the <track> the moment it loads (browsers default to
  // 'disabled' for muted videos).
  useEffect(() => {
    if (!captionsUrl) return;
    const v = videoRef.current;
    if (!v) return;
    const enable = () => {
      for (let i = 0; i < v.textTracks.length; i++) {
        const t = v.textTracks[i];
        if (t.kind === "subtitles" || t.kind === "captions") t.mode = "showing";
      }
    };
    enable();
    const t = setTimeout(enable, 250);
    return () => clearTimeout(t);
  }, [captionsUrl]);

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
        crossOrigin="anonymous"
        data-testid="video-element"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#000",
        }}
      >
        {captionsUrl && (
          <track
            key={captionsUrl}
            src={captionsUrl}
            kind="subtitles"
            srcLang="en"
            label="English"
            default
            data-testid="track-captions"
          />
        )}
      </video>

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
