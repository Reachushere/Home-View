import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Music2, Loader2,
  ChevronLeft, Shuffle, Repeat, Volume2, VolumeX, Speaker, Disc3,
} from "lucide-react";
import floorplanImg from "@assets/Floorplan11_1774005505273.png";

interface NowPlaying {
  playing: boolean; name?: string; artist?: string; album?: string;
  albumArt?: string; albumArtSmall?: string; progress?: number; duration?: number;
}
interface RoomGroup {
  room: string; icon: string;
  speakers: { id: string; name: string; entityId: string; type: string; room: string }[];
}

interface ProfileArtist {
  name: string; uri: string; image?: string; searchQuery: string;
}

type ProfileKey = "bryn" | "yasu";

const PROFILES: Record<ProfileKey, {
  label: string; artists: ProfileArtist[]; theme: string; accent: string; glow: string;
}> = {
  bryn: {
    label: "Bryn",
    theme: "neon",
    accent: "#a855f7",
    glow: "rgba(168,85,247,0.3)",
    artists: [
      { name: "Katy Perry", uri: "spotify:artist:6jJ0s89eD6GaHleKKya26X", searchQuery: "Katy Perry" },
      { name: "Pink", uri: "spotify:artist:1KCSPY1glIKqW2TotWuXOR", searchQuery: "Pink singer" },
      { name: "Phoenix", uri: "spotify:artist:1lJhME1ZpPN1FO6I8oi4so", searchQuery: "Phoenix band" },
      { name: "M83", uri: "spotify:artist:63MQldklfxkjYDoUE4Tppz", searchQuery: "M83" },
      { name: "Cold War Kids", uri: "spotify:artist:0YrtvGIINMpnCsFuiyfvMZ", searchQuery: "Cold War Kids" },
      { name: "Disney", uri: "spotify:playlist:37i9dQZF1DX8C585qnMYHP", searchQuery: "Disney hits" },
      { name: "Chill Electro", uri: "spotify:playlist:37i9dQZF1DX4E3UdUs7fUx", searchQuery: "Chill electronic" },
      { name: "Dinner Jazz", uri: "spotify:playlist:37i9dQZF1DX4wta20PHgwo", searchQuery: "Dinner jazz" },
    ],
  },
  yasu: {
    label: "Yasu",
    theme: "sakura",
    accent: "#f472b6",
    glow: "rgba(244,114,182,0.3)",
    artists: [
      { name: "YOASOBI", uri: "spotify:artist:64tJ2EAv1R6UaZqc4iOCyj", searchQuery: "YOASOBI" },
      { name: "Kenshi Yonezu", uri: "spotify:artist:1snhtMLeb2DYoMOcVkiKnR", searchQuery: "Kenshi Yonezu" },
      { name: "Aimyon", uri: "spotify:artist:5Lak6GhYbSqhRimRYhE0dP", searchQuery: "Aimyon" },
      { name: "ONE OK ROCK", uri: "spotify:artist:7q4KJIqziJOKnsTaFKpMII", searchQuery: "ONE OK ROCK" },
      { name: "Official HIGE DANdism", uri: "spotify:artist:3YMVszTadghiHjPOYaG3PM", searchQuery: "Official HIGE DANdism" },
      { name: "Vaundy", uri: "spotify:artist:6k4bHMbRIf97CqMqmU7Xk4", searchQuery: "Vaundy" },
      { name: "King Gnu", uri: "spotify:artist:6n70eCqbtJhbMgsMet1WVb", searchQuery: "King Gnu" },
      { name: "Aimer", uri: "spotify:artist:0bAsR2unSRpn6BOpSbGhAu", searchQuery: "Aimer japanese" },
    ],
  },
};

const ROOM_HOTSPOTS: { room: string; x: number; y: number; w: number; h: number }[] = [
  { room: "Queen Bedroom", x: 5, y: 8, w: 22, h: 35 },
  { room: "Closet", x: 5, y: 55, w: 14, h: 20 },
  { room: "Cat Washroom", x: 2, y: 75, w: 18, h: 22 },
  { room: "Pug Washroom", x: 20, y: 75, w: 12, h: 22 },
  { room: "Hallway", x: 28, y: 5, w: 18, h: 40 },
  { room: "Kitchen", x: 30, y: 25, w: 30, h: 40 },
  { room: "Living Room", x: 30, y: 55, w: 32, h: 42 },
  { room: "King Bedroom", x: 65, y: 15, w: 30, h: 48 },
  { room: "Everywhere", x: 85, y: 75, w: 12, h: 18 },
];

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function CherryBlossoms() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * 2; canvas.height = H * 2;
    ctx.scale(2, 2);

    const petals: { x: number; y: number; r: number; rot: number; vx: number; vy: number; vr: number; alpha: number; size: number }[] = [];
    for (let i = 0; i < 25; i++) {
      petals.push({
        x: Math.random() * W, y: Math.random() * H - H,
        r: Math.random() * Math.PI * 2, rot: 0,
        vx: (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.8,
        vr: (Math.random() - 0.5) * 0.03, alpha: 0.3 + Math.random() * 0.5,
        size: 4 + Math.random() * 6,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.x += p.vx + Math.sin(Date.now() / 2000 + p.y * 0.01) * 0.3;
        p.y += p.vy;
        p.r += p.vr;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        if (p.x > W + 20) p.x = -20;
        if (p.x < -20) p.x = W + 20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${150 + Math.random() * 50},${180 + Math.random() * 40},1)`;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(p.size * 0.3, -p.size * 0.2, p.size * 0.7, p.size * 0.4, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${170 + Math.random() * 40},${190 + Math.random() * 30},0.8)`;
        ctx.fill();
        ctx.restore();
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} />;
}

function SpinningVinyl({ albumArt, playing, accent }: { albumArt?: string; playing: boolean; accent: string }) {
  const rotRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 200;
    canvas.width = size * 2; canvas.height = size * 2;
    ctx.scale(2, 2);
    const cx = size / 2, cy = size / 2;

    let imgEl: HTMLImageElement | null = null;
    if (albumArt) { imgEl = new Image(); imgEl.crossOrigin = "anonymous"; imgEl.src = albumArt; }

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      if (playing) rotRef.current += 0.012;
      const t = Date.now() / 1000;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotRef.current);
      const R = 85;
      const vg = ctx.createRadialGradient(0, 0, 30, 0, 0, R);
      vg.addColorStop(0, "#1a1a20"); vg.addColorStop(0.4, "#111116"); vg.addColorStop(1, "#0a0a0f");
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = vg; ctx.fill();
      for (let g = 0; g < 20; g++) {
        const r = 30 + g * 2.8;
        if (r > R) break;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        const hue = playing ? (280 + g * 12 + t * 40) % 360 : 0;
        ctx.strokeStyle = playing ? `hsla(${hue},100%,60%,${0.1 + Math.sin(t * 3 + g * 0.5) * 0.06})` : `rgba(255,255,255,0.03)`;
        ctx.lineWidth = 0.6; ctx.stroke();
      }
      const lr = 28;
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(imgEl, -lr, -lr, lr * 2, lr * 2); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2);
        ctx.fillStyle = playing ? accent : "#222"; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fill();
      ctx.restore();
      if (playing) {
        for (let i = 0; i < 2; i++) {
          ctx.beginPath(); ctx.arc(cx, cy, R + 4 + i * 8, 0, Math.PI * 2);
          ctx.strokeStyle = `${accent}${Math.round((0.15 + Math.sin(t * 2 + i) * 0.1) * 255).toString(16).padStart(2, "0")}`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [albumArt, playing, accent]);

  return <canvas ref={canvasRef} style={{ width: 160, height: 160 }} data-testid="spinning-vinyl" />;
}

export default function SpotifyPlayerPage() {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [volume, setVolume] = useState(50);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [rooms, setRooms] = useState<RoomGroup[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileKey>("bryn");
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const [dragItem, setDragItem] = useState<{ type: "artist" | "room"; data: any } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [profileSpinning, setProfileSpinning] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Set<string>>(new Set());

  const searchParams = new URLSearchParams(window.location.search);
  const authParam = searchParams.get("auth");
  const authQuery = authParam ? `?auth=${authParam}` : "";
  const isEmbedded = searchParams.get("embed") === "true";
  const profile = PROFILES[activeProfile];
  const notifTimeout = useRef<any>(null);

  const showNotif = (msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3000);
  };

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/now-playing${authQuery}`);
      if (res.ok) { const d = await res.json(); setNowPlaying(d); if (d.progress) setLocalProgress(d.progress); }
    } catch {} finally { setLoading(false); }
  }, [authQuery]);

  const fetchRooms = useCallback(async () => {
    try { const res = await fetch(`/api/spotify/rooms${authQuery}`); if (res.ok) setRooms(await res.json()); } catch {}
  }, [authQuery]);

  const fetchPlaybackState = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/playback-state${authQuery}`);
      if (res.ok) { const d = await res.json(); if (d.active) { setVolume(d.volume); setShuffleOn(d.shuffle); setRepeatMode(d.repeat); } }
    } catch {}
  }, [authQuery]);

  const fetchArtistImages = useCallback(async () => {
    const all = [...PROFILES.bryn.artists, ...PROFILES.yasu.artists];
    const imgs: Record<string, string> = {};
    for (const a of all) {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(a.searchQuery)}&${authQuery.slice(1)}`);
        if (res.ok) {
          const data = await res.json();
          const img = data.artists?.[0]?.image || data.tracks?.[0]?.image || "";
          if (img) imgs[a.name] = img;
        }
      } catch {}
    }
    setArtistImages(imgs);
  }, [authQuery]);

  useEffect(() => {
    fetchNowPlaying(); fetchRooms(); fetchPlaybackState(); fetchArtistImages();
    const interval = setInterval(fetchNowPlaying, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (nowPlaying?.playing) {
      const tick = setInterval(() => {
        setLocalProgress(p => { const n = p + 500; return nowPlaying.duration && n > nowPlaying.duration ? nowPlaying.duration : n; });
      }, 500);
      return () => clearInterval(tick);
    }
  }, [nowPlaying?.playing, nowPlaying?.duration]);

  const doAction = async (action: string, method = "POST", body?: any) => {
    setActionPending(true);
    try {
      await fetch(`/api/spotify/${action}${authQuery}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      setTimeout(fetchNowPlaying, 600);
    } catch {} finally { setActionPending(false); }
  };

  const playOnRoom = async (roomName: string, artistData: ProfileArtist) => {
    const roomGroup = rooms.find(r => r.room === roomName);
    if (!roomGroup || roomGroup.speakers.length === 0) {
      showNotif(`No speakers in ${roomName}`);
      return;
    }
    const groupSpeaker = roomGroup.speakers.find(s => s.type === "group") || roomGroup.speakers[0];
    try {
      await fetch(`/api/spotify/play-on-speaker${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: groupSpeaker.entityId, spotifyUri: artistData.uri, artistName: artistData.name }),
      });
      setActiveRooms(prev => new Set(prev).add(roomName));
      showNotif(`Playing ${artistData.name} in ${roomName}`);
    } catch {
      showNotif("Failed to play");
    }
  };

  const groupRooms = async (sourceRoom: string, targetRoom: string) => {
    const src = rooms.find(r => r.room === sourceRoom);
    const tgt = rooms.find(r => r.room === targetRoom);
    if (!src || !tgt) return;
    const srcSpeaker = src.speakers.find(s => s.type === "group") || src.speakers[0];
    const tgtSpeaker = tgt.speakers.find(s => s.type === "group") || tgt.speakers[0];
    try {
      await fetch(`/api/spotify/group-speakers${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEntityId: srcSpeaker.entityId, targetEntityId: tgtSpeaker.entityId }),
      });
      setActiveRooms(prev => { const n = new Set(prev); n.add(sourceRoom); n.add(targetRoom); return n; });
      showNotif(`Grouped ${sourceRoom} + ${targetRoom}`);
    } catch {
      showNotif("Failed to group");
    }
  };

  const handleDragStart = (type: "artist" | "room", data: any) => (e: React.DragEvent) => {
    setDragItem({ type, data });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, data }));
  };

  const handleRoomDrop = (roomName: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    try {
      const raw = e.dataTransfer.getData("text/plain");
      const parsed = JSON.parse(raw);
      if (parsed.type === "artist") {
        playOnRoom(roomName, parsed.data);
      } else if (parsed.type === "room" && parsed.data.room !== roomName) {
        groupRooms(parsed.data.room, roomName);
      }
    } catch {}
    setDragItem(null);
  };

  const handleDragOver = (roomName: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(roomName);
  };

  const switchProfile = (p: ProfileKey) => {
    if (p === activeProfile) return;
    setProfileSpinning(true);
    setTimeout(() => { setActiveProfile(p); setTimeout(() => setProfileSpinning(false), 50); }, 350);
  };

  const isPlaying = !!nowPlaying?.playing;
  const progressPct = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;
  const isSakura = activeProfile === "yasu";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ background: "#050508", fontFamily: "'Inter', system-ui, sans-serif" }} data-testid="spotify-player-page">
      {isSakura && <CherryBlossoms />}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: isSakura
          ? "radial-gradient(ellipse at 50% 30%, rgba(244,114,182,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(251,113,133,0.03) 0%, transparent 50%)"
          : "radial-gradient(ellipse at 30% 40%, rgba(168,85,247,0.04) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(99,102,241,0.03) 0%, transparent 50%)",
      }} />

      <div className="relative z-10 flex items-center gap-3 px-4 pt-2 pb-1">
        {!isEmbedded && (
          <button onClick={() => { const p = new URLSearchParams(window.location.search); window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : ""); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5" data-testid="back-to-dashboard">
            <ChevronLeft className="h-4 w-4 text-white/20" />
          </button>
        )}
        <Disc3 className="h-5 w-5" style={{ color: profile.accent }} />
        <span className="text-sm font-bold text-white/60 tracking-tight">HoloMusic</span>
        <div className="flex-1" />
        <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
            <button key={k} onClick={() => switchProfile(k)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeProfile === k ? `${PROFILES[k].accent}20` : "transparent",
                color: activeProfile === k ? PROFILES[k].accent : "rgba(255,255,255,0.3)",
                border: activeProfile === k ? `1px solid ${PROFILES[k].accent}30` : "1px solid transparent",
                boxShadow: activeProfile === k ? `0 0 15px ${PROFILES[k].glow}` : "none",
              }}
              data-testid={`profile-${k}`}>
              {PROFILES[k].label}
            </button>
          ))}
        </div>
        {isSakura && <span className="text-sm opacity-40">🌸</span>}
      </div>

      {notification && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-xl text-xs font-medium text-white"
          style={{ background: `${profile.accent}30`, border: `1px solid ${profile.accent}40`, backdropFilter: "blur(20px)", boxShadow: `0 0 20px ${profile.glow}`, animation: "fadeInUp 0.3s ease" }}
          data-testid="notification">
          {notification}
        </div>
      )}

      <div className="relative z-10 flex-1 flex overflow-hidden px-3 pb-1 gap-3" style={{
        transform: profileSpinning ? "perspective(1200px) rotateY(-90deg)" : "perspective(1200px) rotateY(0deg)",
        opacity: profileSpinning ? 0 : 1,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
      }}>
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: 320 }}>
          <div className="flex-1 overflow-y-auto rounded-2xl p-3" style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)", scrollbarWidth: "none",
          }}>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-2 px-1" style={{ color: `${profile.accent}60` }}>
              {isSakura ? "お気に入り • Favorites" : "Favorites"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {profile.artists.map((artist, i) => (
                <div key={artist.name} draggable
                  onDragStart={handleDragStart("artist", artist)}
                  onDragEnd={() => setDragItem(null)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:scale-105 active:scale-95 group"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid rgba(255,255,255,0.04)`,
                    animation: `fadeInUp 0.4s ease ${i * 60}ms both`,
                  }}
                  data-testid={`artist-card-${artist.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 transition-all"
                    style={{
                      ringColor: `${profile.accent}15`,
                      boxShadow: `0 0 15px ${profile.glow}`,
                      background: artistImages[artist.name] ? `url(${artistImages[artist.name]}) center/cover` : `linear-gradient(135deg, ${profile.accent}40, ${profile.accent}20)`,
                    }}>
                    {!artistImages[artist.name] && <div className="w-full h-full flex items-center justify-center"><Music2 className="h-5 w-5 text-white/15" /></div>}
                  </div>
                  <span className="text-[10px] text-white/50 truncate w-full text-center font-medium group-hover:text-white/80 transition-colors">{artist.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-3 flex flex-col items-center" style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
          }}>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-2 w-full px-1" style={{ color: `${profile.accent}60` }}>
              {isSakura ? "ターンテーブル • Turntable" : "Turntable"}
            </div>
            <div className="relative p-2 rounded-2xl" style={{
              background: "linear-gradient(135deg, rgba(20,20,25,0.9), rgba(15,15,20,0.95))",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: isPlaying ? `0 0 40px ${profile.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
                <SpinningVinyl albumArt={nowPlaying?.albumArt} playing={isPlaying} accent={profile.accent} />
                {isPlaying && <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-16 rounded-full" style={{
                  background: `linear-gradient(180deg, transparent, ${profile.accent}60, transparent)`,
                  boxShadow: `0 0 8px ${profile.glow}`,
                  transform: "rotate(-25deg) translateY(-50%)", transformOrigin: "bottom center",
                }} />}
              </div>
            </div>
            <div className="text-center mt-2 w-full">
              <p className="text-xs font-bold text-white/80 truncate" data-testid="track-name">{nowPlaying?.name || "Drag an artist here"}</p>
              <p className="text-[10px] truncate mt-0.5" style={{ color: isPlaying ? profile.accent : "rgba(255,255,255,0.25)" }} data-testid="track-artist">{nowPlaying?.artist || "then drag to a room"}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 relative rounded-2xl overflow-hidden" style={{
          border: `1px solid ${dragItem ? `${profile.accent}30` : "rgba(255,255,255,0.04)"}`,
          transition: "border-color 0.3s ease",
          boxShadow: dragItem ? `0 0 30px ${profile.glow}` : "none",
        }}>
          <img src={floorplanImg} alt="Apartment floor plan" className="absolute inset-0 w-full h-full object-contain" style={{ filter: "brightness(0.7) contrast(1.1)", opacity: 0.85 }} />
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(5,5,8,0.7) 100%)",
          }} />

          {ROOM_HOTSPOTS.map(spot => {
            const isActive = activeRooms.has(spot.room);
            const isDrop = dropTarget === spot.room;
            const isEvery = spot.room === "Everywhere";
            const roomData = rooms.find(r => r.room === spot.room);

            return (
              <div key={spot.room}
                draggable={isActive}
                onDragStart={handleDragStart("room", { room: spot.room, speakers: roomData?.speakers })}
                onDragEnd={() => setDragItem(null)}
                onDragOver={handleDragOver(spot.room)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={handleRoomDrop(spot.room)}
                className="absolute flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer"
                style={{
                  left: `${spot.x}%`, top: `${spot.y}%`,
                  width: `${spot.w}%`, height: `${spot.h}%`,
                  background: isDrop
                    ? `${profile.accent}20`
                    : isActive
                      ? `${profile.accent}10`
                      : "rgba(0,0,0,0.15)",
                  border: isDrop
                    ? `2px solid ${profile.accent}80`
                    : isActive
                      ? `1px solid ${profile.accent}40`
                      : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isDrop
                    ? `0 0 30px ${profile.glow}, inset 0 0 20px ${profile.glow}`
                    : isActive
                      ? `0 0 20px ${profile.glow}`
                      : "none",
                  backdropFilter: "blur(8px)",
                  transform: isDrop ? "scale(1.03)" : "scale(1)",
                  zIndex: isDrop ? 20 : 10,
                }}
                data-testid={`room-hotspot-${spot.room.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Speaker className="mb-0.5" style={{
                  width: isEvery ? 14 : 16, height: isEvery ? 14 : 16,
                  color: isActive ? profile.accent : isDrop ? profile.accent : "rgba(255,255,255,0.2)",
                  filter: isActive ? `drop-shadow(0 0 6px ${profile.glow})` : "none",
                  animation: isActive ? "pulse 2s ease-in-out infinite" : "none",
                }} />
                <span className="text-white font-semibold text-center leading-tight" style={{
                  fontSize: isEvery ? 8 : 9,
                  textShadow: isActive ? `0 0 10px ${profile.glow}` : "0 1px 3px rgba(0,0,0,0.8)",
                  opacity: isDrop ? 1 : 0.7,
                }}>{spot.room}</span>
                {isActive && (
                  <div className="flex gap-0.5 items-end mt-0.5" style={{ height: 8 }}>
                    {[0,1,2].map(i => <div key={i} className="w-0.5 rounded-full" style={{ background: profile.accent, animation: `eqBar 0.6s ease-in-out ${i * 0.12}s infinite alternate` }} />)}
                  </div>
                )}
              </div>
            );
          })}

          {dragItem && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-[10px] font-medium text-white/60"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${profile.accent}30` }}>
              {dragItem.type === "artist" ? `Drop "${dragItem.data.name}" on a room` : `Drop on another room to group`}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10" style={{ background: "rgba(0,0,0,0.4)", borderTop: `1px solid rgba(255,255,255,0.04)`, backdropFilter: "blur(30px)" }}>
        {nowPlaying?.duration ? (
          <div className="px-6 pt-1.5">
            <div className="relative rounded-full overflow-hidden cursor-pointer group" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setLocalProgress(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (nowPlaying.duration || 0))); }}
              data-testid="progress-bar">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{
                width: `${progressPct}%`, background: `linear-gradient(90deg, ${profile.accent}, ${isSakura ? "#fb7185" : "#c084fc"})`,
                boxShadow: `0 0 10px ${profile.glow}`, transition: "width 0.5s linear",
              }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] text-white/15 font-mono tabular-nums">{formatMs(localProgress)}</span>
              <span className="text-[8px] text-white/15 font-mono tabular-nums">{formatMs(nowPlaying.duration)}</span>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-3 py-2 px-6">
          <button onClick={() => { setRepeatMode(r => { const n = r === "off" ? "context" : r === "context" ? "track" : "off"; doAction("repeat", "PUT", { state: n }); return n; }); }}
            className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110 relative"
            style={{ color: repeatMode !== "off" ? profile.accent : "rgba(255,255,255,0.15)" }} data-testid="button-repeat">
            <Repeat className="h-3.5 w-3.5" />
            {repeatMode === "track" && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full text-[5px] font-black flex items-center justify-center" style={{ background: profile.accent, color: "black" }}>1</span>}
          </button>
          <button onClick={() => { setShuffleOn(s => { const n = !s; doAction("shuffle", "PUT", { state: n }); return n; }); }}
            className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110"
            style={{ color: shuffleOn ? profile.accent : "rgba(255,255,255,0.15)" }} data-testid="button-shuffle">
            <Shuffle className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => doAction("previous")} disabled={actionPending} className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110" data-testid="button-previous">
            <SkipBack className="h-5 w-5 text-white/40 fill-white/40" />
          </button>
          <button onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")} disabled={actionPending}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${profile.accent}, ${isSakura ? "#fb7185" : "#7c3aed"})`, boxShadow: `0 0 25px ${profile.glow}` }}
            data-testid="button-play-pause">
            {actionPending ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : isPlaying ? <Pause className="h-5 w-5 text-white fill-white" /> : <Play className="h-5 w-5 text-white fill-white ml-0.5" />}
          </button>
          <button onClick={() => doAction("next")} disabled={actionPending} className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110" data-testid="button-next">
            <SkipForward className="h-5 w-5 text-white/40 fill-white/40" />
          </button>
          <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.04)" }} />
          <VolumeX className="h-3 w-3 text-white/10 cursor-pointer" onClick={() => { setVolume(0); doAction("volume", "PUT", { volume: 0 }); }} />
          <div className="relative h-7 flex items-center cursor-pointer" style={{ width: 80 }}
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const v = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))); setVolume(v); doAction("volume", "PUT", { volume: v }); }}>
            <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full" style={{ width: `${volume}%`, background: `linear-gradient(90deg, ${profile.accent}, ${isSakura ? "#fb7185" : "#c084fc"})`, boxShadow: `0 0 6px ${profile.glow}` }} />
            </div>
          </div>
          <Volume2 className="h-3 w-3 text-white/10" />
          <span className="text-[8px] text-white/10 font-mono w-5 text-right tabular-nums">{volume}%</span>
        </div>
      </div>

      <style>{`
        @keyframes eqBar { 0% { height: 2px; } 100% { height: 8px; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
