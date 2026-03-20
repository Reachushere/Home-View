import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music2,
  Disc3,
  Radio,
  Loader2,
  ExternalLink,
  ChevronLeft,
  Shuffle,
  Repeat,
  ListMusic,
  Clock,
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

function ParticleField({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number; hue: number }[]>([]);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth * 2;
      canvas.height = window.innerHeight * 2;
      ctx.scale(2, 2);
    };
    resize();

    if (particles.current.length === 0) {
      for (let i = 0; i < 80; i++) {
        particles.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.3 + 0.1,
          hue: Math.random() * 60 + 140,
        });
      }
    }

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles.current) {
        const speed = playing ? 2.5 : 0.8;
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const targetOpacity = playing ? 0.4 + Math.sin(Date.now() / 1000 + p.hue) * 0.2 : 0.12;
        p.opacity += (targetOpacity - p.opacity) * 0.02;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.opacity})`;
        ctx.fill();

        if (playing) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.opacity * 0.15})`;
          ctx.fill();
        }
      }

      if (playing) {
        for (let i = 0; i < particles.current.length; i++) {
          for (let j = i + 1; j < particles.current.length; j++) {
            const dx = particles.current[i].x - particles.current[j].x;
            const dy = particles.current[i].y - particles.current[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 100) {
              ctx.beginPath();
              ctx.moveTo(particles.current[i].x, particles.current[i].y);
              ctx.lineTo(particles.current[j].x, particles.current[j].y);
              ctx.strokeStyle = `hsla(170, 80%, 60%, ${(1 - dist / 100) * 0.08})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }} />;
}

function Visualizer({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(Array.from({ length: 48 }, () => 0));
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = 2;
    canvas.width = 600 * dpr;
    canvas.height = 80 * dpr;
    ctx.scale(dpr, dpr);

    const w = 600;
    const h = 80;

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const barCount = 48;
      const gap = 2;
      const barW = (w - (barCount - 1) * gap) / barCount;

      for (let i = 0; i < barCount; i++) {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const target = playing
          ? (0.2 + Math.sin(Date.now() / 200 + i * 0.4) * 0.25 + Math.cos(Date.now() / 350 + i * 0.7) * 0.15 + Math.random() * 0.1) * (1 - centerDist * 0.3)
          : 0.03 + Math.sin(Date.now() / 3000 + i * 0.2) * 0.02;

        barsRef.current[i] += (target - barsRef.current[i]) * (playing ? 0.15 : 0.05);
        const barH = Math.max(2, barsRef.current[i] * h);

        const gradient = ctx.createLinearGradient(0, h, 0, h - barH);
        if (playing) {
          gradient.addColorStop(0, "rgba(0, 255, 170, 0.9)");
          gradient.addColorStop(0.4, "rgba(0, 210, 255, 0.8)");
          gradient.addColorStop(0.7, "rgba(100, 100, 255, 0.6)");
          gradient.addColorStop(1, "rgba(180, 0, 255, 0.4)");
        } else {
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
        }

        const x = i * (barW + gap);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, h - barH, barW, barH, barW / 2);
        ctx.fill();

        if (playing && barH > 10) {
          ctx.fillStyle = `rgba(0, 255, 200, ${0.6 * barsRef.current[i]})`;
          ctx.beginPath();
          ctx.arc(x + barW / 2, h - barH, barW / 2, 0, Math.PI * 2);
          ctx.fill();

          const reflectH = barH * 0.3;
          const reflGradient = ctx.createLinearGradient(0, h, 0, h + reflectH);
          reflGradient.addColorStop(0, "rgba(0, 255, 170, 0.12)");
          reflGradient.addColorStop(1, "rgba(0, 255, 170, 0)");
          ctx.fillStyle = reflGradient;
          ctx.beginPath();
          ctx.roundRect(x, h, barW, reflectH, barW / 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing]);

  return <canvas ref={canvasRef} style={{ width: "100%", maxWidth: "600px", height: "80px" }} data-testid="audio-visualizer" />;
}

function VinylDisc({ albumArt, playing }: { albumArt?: string; playing: boolean }) {
  return (
    <div className="relative" style={{ width: 300, height: 300 }}>
      <div
        className="absolute rounded-full"
        style={{
          inset: -8,
          background: `conic-gradient(from ${playing ? 'var(--vinyl-angle, 0deg)' : '0deg'}, rgba(0,255,170,0.15), rgba(0,200,255,0.1), rgba(120,0,255,0.1), rgba(0,255,170,0.15))`,
          filter: "blur(20px)",
          opacity: playing ? 0.8 : 0.2,
          transition: "opacity 0.5s",
          animation: playing ? "vinylGlow 4s linear infinite" : "none",
        }}
      />
      <div
        className="relative w-full h-full rounded-full overflow-hidden"
        style={{
          background: "#0a0a0a",
          boxShadow: playing
            ? "0 0 60px rgba(0,255,170,0.2), 0 0 120px rgba(0,200,255,0.1), 0 20px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.5)"
            : "0 20px 60px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,0,0,0.5)",
          animation: playing ? "spin 8s linear infinite" : "none",
          transition: "box-shadow 0.5s",
        }}
      >
        <div className="absolute inset-0" style={{
          background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px)`,
        }} />

        <div className="absolute rounded-full overflow-hidden" style={{ top: "25%", left: "25%", width: "50%", height: "50%", boxShadow: "0 0 20px rgba(0,0,0,0.8)" }}>
          {albumArt ? (
            <img src={albumArt} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
              <Music2 className="h-12 w-12 text-white/10" />
            </div>
          )}
        </div>

        <div className="absolute rounded-full" style={{
          top: "calc(50% - 6px)", left: "calc(50% - 6px)", width: 12, height: 12,
          background: "radial-gradient(circle, #222 0%, #111 50%, #333 100%)",
          boxShadow: "0 0 4px rgba(0,0,0,0.8)",
        }} />

        <div className="absolute inset-0 rounded-full" style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
        }} />
      </div>
    </div>
  );
}

export default function SpotifyPlayerPage() {
  const [, navigate] = useLocation();
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [recent, setRecent] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [showRecent, setShowRecent] = useState(false);

  const authParam = new URLSearchParams(window.location.search).get("auth");
  const authQuery = authParam ? `?auth=${authParam}` : "";

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/now-playing${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        setNowPlaying(data);
        setConnectionError(false);
        setNotConnected(false);
        if (data.progress) setLocalProgress(data.progress);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.error?.includes?.("not connected") || errData?.error?.includes?.("connect")) {
          setNotConnected(true);
        } else {
          setConnectionError(true);
        }
      }
    } catch {
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, [authQuery]);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/recent${authQuery}`);
      if (res.ok) setRecent(await res.json());
    } catch {}
  }, [authQuery]);

  useEffect(() => {
    fetchNowPlaying();
    fetchRecent();
    const interval = setInterval(fetchNowPlaying, 4000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying, fetchRecent]);

  useEffect(() => {
    if (nowPlaying?.playing) {
      const tick = setInterval(() => {
        setLocalProgress((p) => {
          const next = p + 500;
          return nowPlaying.duration && next > nowPlaying.duration ? nowPlaying.duration : next;
        });
      }, 500);
      return () => clearInterval(tick);
    }
  }, [nowPlaying?.playing, nowPlaying?.duration]);

  const doAction = async (action: string, method = "POST") => {
    setActionPending(true);
    try {
      await fetch(`/api/spotify/${action}${authQuery}`, { method });
      setTimeout(fetchNowPlaying, 500);
    } catch {} finally {
      setActionPending(false);
    }
  };

  const progressPercent = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;
  const isPlaying = !!nowPlaying?.playing;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{
        background: "radial-gradient(ellipse at 20% 0%, #0c1a2e 0%, #060e1a 30%, #020509 70%, #000 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      data-testid="spotify-player-page"
    >
      <ParticleField playing={isPlaying} />

      <div className="absolute inset-0 pointer-events-none" style={{
        background: isPlaying && nowPlaying?.albumArt
          ? `radial-gradient(ellipse at 50% 40%, rgba(0,255,170,0.04) 0%, transparent 60%)`
          : "none",
        transition: "background 2s ease",
      }} />

      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.015,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.5) 1px, rgba(255,255,255,0.5) 2px)",
        backgroundSize: "100% 3px",
      }} />

      <div className="relative z-10 flex items-center px-5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <button
          onClick={() => {
            const p = new URLSearchParams(window.location.search);
            window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : "");
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          data-testid="back-to-dashboard"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-white/40" />
          <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-medium">Back</span>
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <div className="relative">
            <Disc3
              className="h-4 w-4"
              style={{
                color: isPlaying ? "#00ffaa" : "rgba(255,255,255,0.2)",
                animation: isPlaying ? "spin 3s linear infinite" : "none",
                filter: isPlaying ? "drop-shadow(0 0 4px rgba(0,255,170,0.5))" : "none",
              }}
            />
            {isPlaying && (
              <div className="absolute inset-0 rounded-full" style={{
                background: "rgba(0,255,170,0.3)",
                filter: "blur(6px)",
                animation: "pulse 2s ease-in-out infinite",
              }} />
            )}
          </div>
          <span
            className="text-[10px] font-semibold uppercase"
            style={{
              letterSpacing: "0.35em",
              color: isPlaying ? "#00ffaa" : "rgba(255,255,255,0.2)",
              textShadow: isPlaying ? "0 0 10px rgba(0,255,170,0.4)" : "none",
            }}
          >
            {isPlaying ? "Now Playing" : "Spotify"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            data-testid="toggle-recent"
          >
            <ListMusic className="h-3.5 w-3.5 text-white/30" />
          </button>
          {nowPlaying?.trackUrl && (
            <a
              href={nowPlaying.trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              data-testid="open-in-spotify"
            >
              <ExternalLink className="h-3.5 w-3.5 text-white/30" />
            </a>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col items-center justify-center px-4 transition-all duration-500 ${showRecent ? "mr-0" : ""}`} style={{ gap: "24px" }}>
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 animate-spin" style={{ color: "rgba(0,255,170,0.3)" }} />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/20">Connecting</span>
            </div>
          ) : connectionError || notConnected ? (
            <div className="flex flex-col items-center gap-6 text-center px-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 0 40px rgba(0,0,0,0.3)",
                }}>
                  <Music2 className="h-12 w-12 text-white/15" />
                </div>
              </div>
              <div>
                <p className="text-sm text-white/50 font-medium mb-1">
                  {notConnected ? "Spotify Not Connected" : "Connection Issue"}
                </p>
                <p className="text-xs text-white/25 max-w-xs">
                  {notConnected
                    ? "Click below to connect your Spotify account"
                    : "Unable to reach Spotify. Check your connection."}
                </p>
              </div>
              <div className="flex gap-3">
                {notConnected && (
                  <a
                    href={`/api/spotify/login`}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-black transition-all hover:scale-105"
                    style={{ background: "linear-gradient(135deg, #00ffaa, #00c8ff)", boxShadow: "0 0 20px rgba(0,255,170,0.3)" }}
                    data-testid="connect-spotify"
                  >
                    Connect Spotify
                  </a>
                )}
                <button
                  onClick={fetchNowPlaying}
                  className="px-5 py-2.5 rounded-full text-xs font-medium text-white/60 hover:text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  data-testid="retry-spotify"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              <VinylDisc albumArt={nowPlaying?.albumArt} playing={isPlaying} />

              <div className="text-center" style={{ maxWidth: 440 }}>
                <h1
                  className="text-2xl font-bold text-white truncate"
                  style={{
                    textShadow: isPlaying ? "0 0 30px rgba(0,255,170,0.2)" : "none",
                    letterSpacing: "-0.02em",
                  }}
                  data-testid="track-name"
                >
                  {nowPlaying?.name || "Nothing Playing"}
                </h1>
                <p
                  className="text-sm mt-1.5 truncate font-medium"
                  style={{ color: isPlaying ? "rgba(0,255,200,0.7)" : "rgba(255,255,255,0.3)" }}
                  data-testid="track-artist"
                >
                  {nowPlaying?.artist || "Play something on Spotify to get started"}
                </p>
                {nowPlaying?.album && (
                  <p className="text-[11px] mt-1 truncate text-white/25 italic" data-testid="track-album">
                    {nowPlaying.album}
                  </p>
                )}
              </div>

              {nowPlaying?.duration && (
                <div className="w-full px-2" style={{ maxWidth: 480 }}>
                  <div
                    className="relative rounded-full overflow-hidden cursor-pointer group"
                    style={{ height: 5, background: "rgba(255,255,255,0.06)" }}
                    data-testid="progress-bar"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${progressPercent}%`,
                        background: "linear-gradient(90deg, #00ffaa, #00c8ff, #7b4fff)",
                        boxShadow: "0 0 12px rgba(0,255,170,0.4)",
                        transition: "width 0.5s linear",
                      }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        left: `${progressPercent}%`,
                        width: 14,
                        height: 14,
                        marginLeft: -7,
                        background: "white",
                        boxShadow: "0 0 10px rgba(0,255,170,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-white/25 font-mono tabular-nums" data-testid="progress-current">{formatMs(localProgress)}</span>
                    <span className="text-[10px] text-white/25 font-mono tabular-nums" data-testid="progress-total">{formatMs(nowPlaying.duration)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/25 hover:text-white/50 transition-all"
                  data-testid="button-shuffle"
                >
                  <Shuffle className="h-4 w-4" />
                </button>

                <button
                  onClick={() => doAction("previous")}
                  disabled={actionPending}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}
                  data-testid="button-previous"
                >
                  <SkipBack className="h-5 w-5 text-white/70 fill-white/70" />
                </button>

                <button
                  onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")}
                  disabled={actionPending}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #00ffaa, #00c8ff)",
                    boxShadow: isPlaying
                      ? "0 0 40px rgba(0,255,170,0.4), 0 0 80px rgba(0,200,255,0.15), 0 4px 20px rgba(0,0,0,0.4)"
                      : "0 0 20px rgba(0,255,170,0.2), 0 4px 20px rgba(0,0,0,0.4)",
                  }}
                  data-testid="button-play-pause"
                >
                  {actionPending ? (
                    <Loader2 className="h-7 w-7 text-black animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-7 w-7 text-black fill-black" />
                  ) : (
                    <Play className="h-7 w-7 text-black fill-black ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => doAction("next")}
                  disabled={actionPending}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}
                  data-testid="button-next"
                >
                  <SkipForward className="h-5 w-5 text-white/70 fill-white/70" />
                </button>

                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/25 hover:text-white/50 transition-all"
                  data-testid="button-repeat"
                >
                  <Repeat className="h-4 w-4" />
                </button>
              </div>

              <Visualizer playing={isPlaying} />
            </>
          )}
        </div>

        {showRecent && recent.length > 0 && (
          <div
            className="flex flex-col h-full overflow-hidden"
            style={{
              width: 320,
              borderLeft: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(20px)",
              animation: "slideIn 0.3s ease-out",
            }}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <Clock className="h-3.5 w-3.5" style={{ color: "rgba(0,255,170,0.4)" }} />
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-semibold">Recently Played</span>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {recent.map((track, i) => (
                <a
                  key={i}
                  href={track.trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors group"
                  data-testid={`recent-track-${i}`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                    style={{
                      background: track.albumArtSmall ? `url(${track.albumArtSmall}) center/cover` : "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate group-hover:text-white transition-colors font-medium">{track.name}</p>
                    <p className="text-[10px] text-white/25 truncate mt-0.5">{track.artist}</p>
                  </div>
                  <span className="text-[9px] text-white/15 flex-shrink-0 font-mono">{timeAgo(track.playedAt)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vinylGlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
