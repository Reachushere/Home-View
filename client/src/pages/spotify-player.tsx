import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  ChevronLeft,
  Music2,
  Disc3,
  Radio,
  Waves,
  Loader2,
} from "lucide-react";

interface NowPlaying {
  playing: boolean;
  name?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  albumArtSmall?: string;
  progress?: number;
  duration?: number;
  trackUrl?: string;
}

interface RecentTrack {
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  albumArtSmall: string;
  playedAt: string;
  trackUrl: string;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SpotifyPlayerPage() {
  const [, navigate] = useLocation();
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [recent, setRecent] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const barsRef = useRef<number[]>(Array.from({ length: 64 }, () => Math.random() * 0.3));

  const authParam = new URLSearchParams(window.location.search).get('auth');
  const authQuery = authParam ? `?auth=${authParam}` : '';

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/now-playing${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        setNowPlaying(data);
        setConnectionError(false);
        if (data.progress) setLocalProgress(data.progress);
      } else {
        setConnectionError(true);
      }
    } catch (e) {
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, [authQuery]);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/recent${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        setRecent(data);
      }
    } catch (e) {
      console.error("Failed to fetch recent:", e);
    }
  }, [authQuery]);

  useEffect(() => {
    fetchNowPlaying();
    fetchRecent();
    const interval = setInterval(fetchNowPlaying, 5000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying, fetchRecent]);

  useEffect(() => {
    if (nowPlaying?.playing) {
      const tick = setInterval(() => {
        setLocalProgress((p) => {
          const next = p + 1000;
          return nowPlaying.duration && next > nowPlaying.duration ? nowPlaying.duration : next;
        });
      }, 1000);
      return () => clearInterval(tick);
    }
  }, [nowPlaying?.playing, nowPlaying?.duration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const barCount = 64;
    const barW = w / barCount - 1;

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < barCount; i++) {
        const isPlaying = nowPlaying?.playing;
        const target = isPlaying
          ? 0.15 + Math.sin(Date.now() / 300 + i * 0.5) * 0.3 + Math.random() * 0.25
          : 0.05 + Math.sin(Date.now() / 2000 + i * 0.3) * 0.03;
        barsRef.current[i] += (target - barsRef.current[i]) * 0.12;
        const barH = barsRef.current[i] * h;

        const gradient = ctx.createLinearGradient(0, h - barH, 0, h);
        gradient.addColorStop(0, "rgba(0, 255, 170, 0.9)");
        gradient.addColorStop(0.5, "rgba(0, 200, 255, 0.7)");
        gradient.addColorStop(1, "rgba(120, 0, 255, 0.4)");
        ctx.fillStyle = gradient;

        const x = i * (barW + 1);
        ctx.beginPath();
        ctx.roundRect(x, h - barH, barW, barH, 1);
        ctx.fill();

        ctx.fillStyle = "rgba(0, 255, 200, 0.5)";
        ctx.beginPath();
        ctx.arc(x + barW / 2, h - barH - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [nowPlaying?.playing]);

  const doAction = async (action: string, method = "POST") => {
    setActionPending(true);
    try {
      await fetch(`/api/spotify/${action}${authQuery}`, { method });
      setTimeout(fetchNowPlaying, 500);
    } catch (e) {
      console.error(`Spotify ${action} failed:`, e);
    } finally {
      setActionPending(false);
    }
  };

  const progressPercent = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 30% 20%, #0a1628 0%, #050d18 40%, #020408 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      data-testid="spotify-player-page"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.4 }}>
        <div
          className="absolute rounded-full"
          style={{
            width: "600px",
            height: "600px",
            top: "-200px",
            right: "-100px",
            background: "radial-gradient(circle, rgba(0,255,170,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "pulse 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "500px",
            height: "500px",
            bottom: "-150px",
            left: "-100px",
            background: "radial-gradient(circle, rgba(120,0,255,0.06) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "pulse 12s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "300px",
            height: "300px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${nowPlaying?.playing ? "rgba(0,200,255,0.05)" : "rgba(255,255,255,0.02)"} 0%, transparent 70%)`,
            filter: "blur(60px)",
            animation: "pulse 6s ease-in-out infinite",
          }}
        />
      </div>

      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.03, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)", backgroundSize: "100% 4px" }} />

      <div className="relative z-10 flex items-center px-6 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            const authParam = params.get('auth');
            window.location.href = '/' + (authParam ? `?auth=${authParam}` : '');
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          data-testid="back-to-dashboard"
        >
          <ChevronLeft className="h-4 w-4 text-white/50" />
          <span className="text-xs text-white/50 uppercase tracking-widest">Back</span>
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <Disc3
            className="h-4 w-4"
            style={{
              color: nowPlaying?.playing ? "#00ffaa" : "rgba(255,255,255,0.3)",
              animation: nowPlaying?.playing ? "spin 3s linear infinite" : "none",
            }}
          />
          <span className="text-xs font-medium uppercase tracking-[0.3em]" style={{ color: nowPlaying?.playing ? "#00ffaa" : "rgba(255,255,255,0.3)" }}>
            {nowPlaying?.playing ? "Now Playing" : "Spotify"}
          </span>
        </div>
        <div style={{ width: "72px" }} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-4" style={{ gap: "20px" }}>
        {loading ? (
          <Loader2 className="h-12 w-12 text-white/20 animate-spin" />
        ) : connectionError ? (
          <div className="flex flex-col items-center gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Music2 className="h-10 w-10 text-white/30" />
            </div>
            <p className="text-sm text-white/50 max-w-xs">Spotify is connected but the API requires additional setup. Open the Spotify Developer Dashboard to register the app user.</p>
            <div className="flex gap-3 mt-2">
              <button onClick={fetchNowPlaying} className="px-4 py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} data-testid="retry-spotify">Retry</button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative" style={{ width: "280px", height: "280px" }}>
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: nowPlaying?.albumArt
                    ? `url(${nowPlaying.albumArt})`
                    : "linear-gradient(135deg, #1a1a2e, #16213e)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow: nowPlaying?.playing
                    ? "0 0 80px rgba(0,255,170,0.15), 0 20px 60px rgba(0,0,0,0.6)"
                    : "0 20px 60px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  transition: "box-shadow 0.5s ease",
                }}
              />
              {!nowPlaying?.albumArt && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Music2 className="h-20 w-20 text-white/10" />
                </div>
              )}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)",
                  pointerEvents: "none",
                }}
              />
              {nowPlaying?.playing && (
                <div
                  className="absolute rounded-2xl"
                  style={{
                    inset: "-2px",
                    border: "1px solid rgba(0,255,170,0.2)",
                    borderRadius: "18px",
                    animation: "pulse 2s ease-in-out infinite",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>

            <div className="text-center" style={{ maxWidth: "400px" }}>
              <h1
                className="text-2xl font-bold text-white truncate"
                style={{
                  textShadow: nowPlaying?.playing ? "0 0 20px rgba(0,255,170,0.3)" : "none",
                  letterSpacing: "-0.02em",
                }}
                data-testid="track-name"
              >
                {nowPlaying?.name || "Nothing Playing"}
              </h1>
              <p className="text-sm mt-1 truncate" style={{ color: "rgba(0,255,200,0.6)" }} data-testid="track-artist">
                {nowPlaying?.artist || "Open Spotify on a device to start listening"}
              </p>
              {nowPlaying?.album && (
                <p className="text-xs mt-0.5 truncate text-white/30" data-testid="track-album">
                  {nowPlaying.album}
                </p>
              )}
            </div>

            {nowPlaying?.duration && (
              <div className="w-full" style={{ maxWidth: "420px" }}>
                <div
                  className="relative rounded-full overflow-hidden"
                  style={{ height: "4px", background: "rgba(255,255,255,0.08)" }}
                  data-testid="progress-bar"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${progressPercent}%`,
                      background: "linear-gradient(90deg, #00ffaa, #00c8ff)",
                      boxShadow: "0 0 10px rgba(0,255,170,0.4)",
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${progressPercent}%`,
                      width: "10px",
                      height: "10px",
                      marginLeft: "-5px",
                      background: "#00ffaa",
                      boxShadow: "0 0 8px rgba(0,255,170,0.6)",
                      transition: "left 1s linear",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-white/30 font-mono" data-testid="progress-current">{formatMs(localProgress)}</span>
                  <span className="text-[10px] text-white/30 font-mono" data-testid="progress-total">{formatMs(nowPlaying.duration)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-6" style={{ marginTop: "4px" }}>
              <button
                onClick={() => doAction("previous")}
                disabled={actionPending}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                data-testid="button-previous"
                title="Previous track"
              >
                <SkipBack className="h-5 w-5 text-white/70 fill-white/70" />
              </button>

              <button
                onClick={() => doAction(nowPlaying?.playing ? "pause" : "play", "PUT")}
                disabled={actionPending}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{
                  background: nowPlaying?.playing
                    ? "linear-gradient(135deg, #00ffaa, #00c8ff)"
                    : "linear-gradient(135deg, #00ffaa, #00c8ff)",
                  boxShadow: "0 0 30px rgba(0,255,170,0.3), 0 4px 20px rgba(0,0,0,0.4)",
                }}
                data-testid="button-play-pause"
                title={nowPlaying?.playing ? "Pause" : "Play"}
              >
                {actionPending ? (
                  <Loader2 className="h-7 w-7 text-black animate-spin" />
                ) : nowPlaying?.playing ? (
                  <Pause className="h-7 w-7 text-black fill-black" />
                ) : (
                  <Play className="h-7 w-7 text-black fill-black ml-0.5" />
                )}
              </button>

              <button
                onClick={() => doAction("next")}
                disabled={actionPending}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                data-testid="button-next"
                title="Next track"
              >
                <SkipForward className="h-5 w-5 text-white/70 fill-white/70" />
              </button>
            </div>

            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ maxWidth: "500px", height: "60px", opacity: 0.8 }}
              data-testid="audio-visualizer"
            />

            {recent.length > 0 && (
              <div className="w-full" style={{ maxWidth: "500px" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="h-3 w-3" style={{ color: "rgba(0,255,170,0.4)" }} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/25 font-medium">Recently Played</span>
                </div>
                <div className="flex flex-col gap-1">
                  {recent.map((track, i) => (
                    <a
                      key={i}
                      href={track.trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                      style={{ border: "1px solid transparent" }}
                      data-testid={`recent-track-${i}`}
                    >
                      <div
                        className="w-9 h-9 rounded-md flex-shrink-0"
                        style={{
                          background: track.albumArtSmall ? `url(${track.albumArtSmall})` : "rgba(255,255,255,0.05)",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80 truncate group-hover:text-white transition-colors">{track.name}</p>
                        <p className="text-[10px] text-white/30 truncate">{track.artist}</p>
                      </div>
                      <span className="text-[9px] text-white/20 flex-shrink-0 font-mono">{timeAgo(track.playedAt)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
