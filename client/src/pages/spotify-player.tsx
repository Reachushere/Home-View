import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Music2, Loader2,
  ChevronLeft, Shuffle, Repeat, Volume2, VolumeX, Speaker, Disc3,
  Search, ListMusic, Disc, Users, Radio, Menu, X, Home,
} from "lucide-react";
import floorplanImg from "@assets/Floorplan11_1774005505273.png";
import massBg from "@assets/mass-background2_1774005959332.png";
import musicBg from "@assets/Music_BG20_1774006032495.png";

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

interface StationShortcut {
  name: string; command: string; uri?: string; icon?: string;
}

const STATION_SHORTCUTS: StationShortcut[] = [
  { name: "Gay FM", command: "play Gay FM Radio on tunein on the everywhere group", icon: "📻" },
  { name: "Vibe of Vegas", command: "play the Vibe of Vegas Radio on tunein on the everywhere group", icon: "🎰" },
  { name: "Dinner Jazz", command: "play Dinner Jazz music on Spotify on the everywhere group", icon: "🎷" },
  { name: "Chill Electronic", command: "play Chill Electronic station on Spotify on the everywhere group", icon: "🎧" },
  { name: "CHUM FM", command: "play 104.5 Chum FM", icon: "📡" },
  { name: "Spring Cleaning", command: "play spring cleaning music on Spotify on the everywhere group", icon: "🌸" },
  { name: "Pink", command: "", uri: "spotify:playlist:37i9dQZF1DZ06evO0YT088", icon: "💖" },
  { name: "Easy Listening", command: "play easy listening on Spotify in the everywhere group", icon: "🎵" },
  { name: "Katy Perry", command: "", uri: "spotify:playlist:37i9dQZF1DZ06evO3Jefw4", icon: "🎤" },
  { name: "Disney", command: "play Disney songs on Spotify on the everywhere group", icon: "🏰" },
  { name: "Club Riva", command: "play Club Riva Lounge Radio on tunein on the everywhere group", icon: "🍸" },
  { name: "Samui Island", command: "play Samui Island Radio on tunein", icon: "🌴" },
  { name: "Calm My Cat", command: "Enable Calm My Cat everywhere", icon: "🐱" },
];

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

const ROOM_HOTSPOTS: { room: string; x: number; y: number; w: number; h: number; entityId: string; groupEntityId: string; deviceType: string; icon: string }[] = [
  { room: "Balcony", x: 2, y: 72, w: 18, h: 25, entityId: "media_player.queen_bedroom", groupEntityId: "media_player.queen_bedroom_media_group", deviceType: "echo", icon: "🌆" },
  { room: "Queen Bedroom", x: 2, y: 38, w: 18, h: 33, entityId: "media_player.queen_bedroom", groupEntityId: "media_player.queen_bedroom_media_group", deviceType: "echo", icon: "🛏️" },
  { room: "Pug Washroom", x: 2, y: 5, w: 16, h: 32, entityId: "media_player.echo_show_pug_am", groupEntityId: "media_player.pug_media_group", deviceType: "echo_show", icon: "🐶" },
  { room: "Hallway", x: 19, y: 5, w: 16, h: 32, entityId: "media_player.hallway_2", groupEntityId: "media_player.hallway_media_group", deviceType: "echo", icon: "🚪" },
  { room: "Kitchen", x: 36, y: 5, w: 28, h: 45, entityId: "media_player.kitchen_lr", groupEntityId: "media_player.kitchen_media_group", deviceType: "echo", icon: "🍳" },
  { room: "Living Room", x: 36, y: 52, w: 28, h: 45, entityId: "media_player.kitchen_lr", groupEntityId: "media_player.living_room_media_group", deviceType: "echo", icon: "🛋️" },
  { room: "King Bedroom", x: 65, y: 30, w: 33, h: 50, entityId: "media_player.king_bedroom", groupEntityId: "media_player.king_bedroom_media_group", deviceType: "echo", icon: "👑" },
  { room: "Cat Washroom", x: 65, y: 3, w: 18, h: 26, entityId: "media_player.cat_speakers", groupEntityId: "media_player.cat_washroom_media_group", deviceType: "echo", icon: "🐱" },
  { room: "Closet", x: 84, y: 3, w: 14, h: 26, entityId: "media_player.echo_closet_am", groupEntityId: "media_player.closet_media_group", deviceType: "echo", icon: "👔" },
  { room: "Everywhere", x: 84, y: 78, w: 14, h: 18, entityId: "media_player.everywhere_5", groupEntityId: "media_player.everywhere_2", deviceType: "group", icon: "🏠" },
];

type ViewMode = "floor" | "stations" | "rooms";

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

function SpinningVinyl({ albumArt, playing, accent, size = 200 }: { albumArt?: string; playing: boolean; accent: string; size?: number }) {
  const rotRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
      const R = size * 0.42;
      const vg = ctx.createRadialGradient(0, 0, R * 0.35, 0, 0, R);
      vg.addColorStop(0, "#1a1a20"); vg.addColorStop(0.4, "#111116"); vg.addColorStop(1, "#0a0a0f");
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = vg; ctx.fill();
      for (let g = 0; g < 20; g++) {
        const r = R * 0.35 + g * (R * 0.033);
        if (r > R) break;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        const hue = playing ? (280 + g * 12 + t * 40) % 360 : 0;
        ctx.strokeStyle = playing ? `hsla(${hue},100%,60%,${0.1 + Math.sin(t * 3 + g * 0.5) * 0.06})` : `rgba(255,255,255,0.03)`;
        ctx.lineWidth = 0.6; ctx.stroke();
      }
      const lr = R * 0.33;
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
  }, [albumArt, playing, accent, size]);

  return <canvas ref={canvasRef} style={{ width: size * 0.8, height: size * 0.8 }} data-testid="spinning-vinyl" />;
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
  const [viewMode, setViewMode] = useState<ViewMode>("floor");
  const [menuOpen, setMenuOpen] = useState(false);

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
    const hotspot = ROOM_HOTSPOTS.find(h => h.room === roomName);
    const roomGroup = rooms.find(r => r.room === roomName);
    const groupSpeaker = roomGroup?.speakers.find(s => s.type === "group") || roomGroup?.speakers[0];
    const entityId = groupSpeaker?.entityId || hotspot?.groupEntityId || hotspot?.entityId;
    const deviceType = hotspot?.deviceType || "echo";
    if (!entityId) {
      showNotif(`No speakers in ${roomName}`);
      return;
    }
    try {
      await fetch(`/api/spotify/play-on-speaker${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, spotifyUri: artistData.uri, artistName: artistData.name, deviceType }),
      });
      setActiveRooms(prev => new Set(prev).add(roomName));
      showNotif(`Playing ${artistData.name} in ${roomName}`);
    } catch {
      showNotif("Failed to play");
    }
  };

  const playStation = async (station: StationShortcut) => {
    if (station.uri) {
      try {
        await fetch(`/api/spotify/play-context${authQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contextUri: station.uri, shuffle: true }),
        });
        showNotif(`Playing ${station.name}`);
        setTimeout(fetchNowPlaying, 1000);
      } catch { showNotif("Failed to play station"); }
    } else if (station.command) {
      showNotif(`${station.name} (voice command)`);
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
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }} data-testid="spotify-player-page">
      <img
        src={isPlaying ? massBg : musicBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: isPlaying ? 0.6 : 0.4, filter: "brightness(0.5)" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.7) 100%)" }} />

      {isSakura && <CherryBlossoms />}

      <div className="absolute inset-0 pointer-events-none" style={{
        background: isSakura
          ? "radial-gradient(ellipse at 50% 30%, rgba(244,114,182,0.06) 0%, transparent 60%)"
          : "radial-gradient(ellipse at 30% 40%, rgba(168,85,247,0.06) 0%, transparent 50%)",
      }} />

      {notification && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-xl text-xs font-medium text-white"
          style={{ background: `${profile.accent}40`, border: `1px solid ${profile.accent}50`, backdropFilter: "blur(20px)", boxShadow: `0 0 30px ${profile.glow}`, animation: "fadeInUp 0.3s ease" }}
          data-testid="notification">
          {notification}
        </div>
      )}

      <div className="relative z-10 flex-1 flex overflow-hidden" style={{
        transform: profileSpinning ? "perspective(1200px) rotateY(-90deg)" : "perspective(1200px) rotateY(0deg)",
        opacity: profileSpinning ? 0 : 1,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
      }}>

        <div className="flex flex-col flex-shrink-0 relative" style={{ width: menuOpen ? 220 : 50, transition: "width 0.3s ease" }}>
          <div className="absolute inset-0 rounded-r-2xl" style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(30px)",
            borderRight: `1px solid rgba(255,255,255,0.06)`,
          }} />

          <div className="relative z-10 flex flex-col h-full py-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center justify-center py-2 mb-2 hover:bg-white/5 transition-colors"
              data-testid="menu-toggle"
            >
              {menuOpen ? <X className="h-5 w-5 text-white/50" /> : <Menu className="h-5 w-5 text-white/50" />}
            </button>

            {!isEmbedded && (
              <button onClick={() => { const p = new URLSearchParams(window.location.search); window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : ""); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors" data-testid="back-to-dashboard">
                <ChevronLeft className="h-4 w-4 text-white/30 flex-shrink-0" />
                {menuOpen && <span className="text-xs text-white/30 whitespace-nowrap">Dashboard</span>}
              </button>
            )}

            <div className="flex-1 flex flex-col gap-1 mt-2">
              {([
                { mode: "floor" as ViewMode, icon: <Home className="h-4 w-4" />, label: "Floor Plan" },
                { mode: "stations" as ViewMode, icon: <Radio className="h-4 w-4" />, label: "Stations" },
                { mode: "rooms" as ViewMode, icon: <Speaker className="h-4 w-4" />, label: "Rooms" },
              ]).map(item => (
                <button key={item.mode}
                  onClick={() => setViewMode(item.mode)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: viewMode === item.mode ? `${profile.accent}15` : "transparent",
                    color: viewMode === item.mode ? profile.accent : "rgba(255,255,255,0.35)",
                  }}
                  data-testid={`nav-${item.mode}`}
                >
                  <div className="flex-shrink-0">{item.icon}</div>
                  {menuOpen && <span className="text-xs whitespace-nowrap">{item.label}</span>}
                </button>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-1 px-1">
              {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
                <button key={k} onClick={() => switchProfile(k)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all"
                  style={{
                    background: activeProfile === k ? `${PROFILES[k].accent}20` : "transparent",
                    color: activeProfile === k ? PROFILES[k].accent : "rgba(255,255,255,0.3)",
                    boxShadow: activeProfile === k ? `0 0 15px ${PROFILES[k].glow}` : "none",
                  }}
                  data-testid={`profile-${k}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                    style={{ background: `${PROFILES[k].accent}30`, border: `1px solid ${PROFILES[k].accent}50` }}>
                    {PROFILES[k].label[0]}
                  </div>
                  {menuOpen && <span className="text-xs whitespace-nowrap">{PROFILES[k].label}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-3 p-3 overflow-hidden">

          <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 280 }}>
            <div className="rounded-2xl p-3 flex flex-col items-center" style={{
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(30px)",
            }}>
              <div className="relative p-2 rounded-2xl" style={{
                background: "linear-gradient(135deg, rgba(20,20,25,0.9), rgba(15,15,20,0.95))",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: isPlaying ? `0 0 40px ${profile.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}>
                <SpinningVinyl albumArt={nowPlaying?.albumArt} playing={isPlaying} accent={profile.accent} size={200} />
              </div>

              <div className="text-center mt-3 w-full px-2">
                <p className="text-sm font-bold text-white/90 truncate" data-testid="track-name" style={{ fontSize: 15 }}>
                  {nowPlaying?.name || "Nothing Playing"}
                </p>
                <p className="text-xs truncate mt-0.5" style={{ color: isPlaying ? profile.accent : "rgba(255,255,255,0.25)" }} data-testid="track-artist">
                  {nowPlaying?.artist || "Select an artist or station"}
                </p>
                {nowPlaying?.album && (
                  <p className="text-[10px] text-white/20 truncate mt-0.5" data-testid="track-album">{nowPlaying.album}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-2xl p-3" style={{
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(30px)", scrollbarWidth: "none",
            }}>
              <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-2 px-1" style={{ color: `${profile.accent}80` }}>
                {isSakura ? "お気に入り • Favorites" : "Favorites"}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {profile.artists.map((artist, i) => (
                  <div key={artist.name} draggable
                    onDragStart={handleDragStart("artist", artist)}
                    onDragEnd={() => setDragItem(null)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:scale-105 active:scale-95 group"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid rgba(255,255,255,0.05)`,
                      animation: `fadeInUp 0.4s ease ${i * 60}ms both`,
                    }}
                    data-testid={`artist-card-${artist.name.toLowerCase().replace(/\s/g, "-")}`}>
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-1 transition-all"
                      style={{
                        ringColor: `${profile.accent}20`,
                        boxShadow: `0 0 12px ${profile.glow}`,
                        background: artistImages[artist.name] ? `url(${artistImages[artist.name]}) center/cover` : `linear-gradient(135deg, ${profile.accent}40, ${profile.accent}20)`,
                      }}>
                      {!artistImages[artist.name] && <div className="w-full h-full flex items-center justify-center"><Music2 className="h-4 w-4 text-white/15" /></div>}
                    </div>
                    <span className="text-[9px] text-white/50 truncate w-full text-center font-medium group-hover:text-white/80 transition-colors">{artist.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 relative rounded-2xl overflow-hidden" style={{
            border: `1px solid ${dragItem ? `${profile.accent}30` : "rgba(255,255,255,0.06)"}`,
            transition: "border-color 0.3s ease",
            boxShadow: dragItem ? `0 0 30px ${profile.glow}` : "none",
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(20px)",
          }}>
            {viewMode === "floor" && (
              <>
                <img src={floorplanImg} alt="Apartment floor plan" className="absolute inset-0 w-full h-full object-contain" style={{ filter: "brightness(0.7) contrast(1.1)", opacity: 0.85 }} />
                <div className="absolute inset-0" style={{
                  background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)`,
                }} />
                {ROOM_HOTSPOTS.map(spot => {
                  const isActive = activeRooms.has(spot.room);
                  const isDrop = dropTarget === spot.room;
                  return (
                    <div key={spot.room}
                      draggable onDragStart={handleDragStart("room", spot)}
                      onDrop={handleRoomDrop(spot.room)}
                      onDragOver={handleDragOver(spot.room)}
                      onDragLeave={() => setDropTarget(null)}
                      className="absolute rounded-xl cursor-pointer transition-all"
                      style={{
                        left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%`,
                        background: isDrop ? `${profile.accent}25` : isActive ? `${profile.accent}12` : "rgba(0,0,0,0.15)",
                        border: `1.5px solid ${isDrop ? profile.accent : isActive ? `${profile.accent}60` : "rgba(255,255,255,0.08)"}`,
                        boxShadow: isActive ? `0 0 20px ${profile.glow}, inset 0 0 15px ${profile.glow}` : isDrop ? `0 0 25px ${profile.glow}` : "none",
                        backdropFilter: "blur(4px)",
                      }}
                      data-testid={`room-${spot.room.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                        <span className="text-base">{spot.icon}</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-white/60 text-center leading-tight px-1">
                          {spot.room}
                        </span>
                        {isActive && (
                          <div className="flex gap-0.5 mt-0.5">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="w-0.5 rounded-full" style={{
                                height: 4 + Math.random() * 6,
                                background: profile.accent,
                                animation: `eqBounce ${0.3 + i * 0.15}s ease-in-out infinite alternate`,
                              }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {viewMode === "stations" && (
              <div className="absolute inset-0 p-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-3" style={{ color: `${profile.accent}80` }}>
                  Stations & Shortcuts
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STATION_SHORTCUTS.map((station) => (
                    <button key={station.name}
                      onClick={() => playStation(station)}
                      className="flex items-center gap-2 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        backdropFilter: "blur(10px)",
                      }}
                      data-testid={`station-${station.name.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <span className="text-lg flex-shrink-0">{station.icon}</span>
                      <span className="text-xs text-white/70 font-medium text-left truncate">{station.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewMode === "rooms" && (
              <div className="absolute inset-0 p-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-3" style={{ color: `${profile.accent}80` }}>
                  Speaker Rooms
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ROOM_HOTSPOTS.map(spot => {
                    const isActive = activeRooms.has(spot.room);
                    return (
                      <button key={spot.room}
                        onClick={() => {
                          if (isPlaying && nowPlaying) {
                            playOnRoom(spot.room, { name: nowPlaying.artist || "", uri: "", searchQuery: nowPlaying.artist || "" });
                          } else {
                            showNotif("Start playing something first");
                          }
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                        style={{
                          background: isActive ? `${profile.accent}15` : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isActive ? `${profile.accent}40` : "rgba(255,255,255,0.06)"}`,
                          boxShadow: isActive ? `0 0 15px ${profile.glow}` : "none",
                        }}
                        data-testid={`room-btn-${spot.room.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <span className="text-lg flex-shrink-0">{spot.icon}</span>
                        <div className="flex-1 text-left">
                          <span className="text-xs text-white/70 font-medium block">{spot.room}</span>
                          <span className="text-[9px] text-white/30">{spot.entityId.split(".")[1]}</span>
                        </div>
                        {isActive && (
                          <div className="flex gap-0.5">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="w-0.5 rounded-full" style={{
                                height: 6 + Math.random() * 8,
                                background: profile.accent,
                                animation: `eqBounce ${0.3 + i * 0.12}s ease-in-out infinite alternate`,
                              }} />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 pb-3 pt-1" style={{
        background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
      }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-white/30 tabular-nums w-8 text-right">{formatMs(localProgress)}</span>
          <div className="flex-1 h-1 rounded-full overflow-hidden cursor-pointer group" style={{ background: "rgba(255,255,255,0.08)" }}
            onClick={e => {
              if (!nowPlaying?.duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              doAction("seek", "POST", { positionMs: Math.round(pct * nowPlaying.duration) });
            }}
            data-testid="progress-bar">
            <div className="h-full rounded-full transition-all relative" style={{
              width: `${progressPct}%`, background: `linear-gradient(90deg, ${profile.accent}, ${profile.accent}cc)`,
              boxShadow: `0 0 8px ${profile.glow}`,
            }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: profile.accent, boxShadow: `0 0 6px ${profile.accent}` }} />
            </div>
          </div>
          <span className="text-[10px] text-white/30 tabular-nums w-8">{formatMs(nowPlaying?.duration || 0)}</span>
        </div>

        <div className="flex items-center justify-center gap-5">
          <button onClick={() => doAction("shuffle", "POST")} className="transition-all hover:scale-110"
            style={{ color: shuffleOn ? profile.accent : "rgba(255,255,255,0.25)" }} data-testid="btn-shuffle">
            <Shuffle className="h-4 w-4" />
          </button>
          <button onClick={() => doAction("previous")} className="text-white/50 hover:text-white hover:scale-110 transition-all" data-testid="btn-prev">
            <SkipBack className="h-5 w-5" />
          </button>
          <button onClick={() => doAction(isPlaying ? "pause" : "play")}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${profile.accent}, ${profile.accent}cc)`,
              boxShadow: `0 0 25px ${profile.glow}, 0 4px 15px rgba(0,0,0,0.3)`,
            }}
            data-testid="btn-play-pause">
            {actionPending ? <Loader2 className="h-5 w-5 text-white animate-spin" /> :
              isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
          </button>
          <button onClick={() => doAction("next")} className="text-white/50 hover:text-white hover:scale-110 transition-all" data-testid="btn-next">
            <SkipForward className="h-5 w-5" />
          </button>
          <button onClick={() => doAction("repeat", "POST")} className="transition-all hover:scale-110"
            style={{ color: repeatMode !== "off" ? profile.accent : "rgba(255,255,255,0.25)" }} data-testid="btn-repeat">
            <Repeat className="h-4 w-4" />
            {repeatMode === "track" && <span className="text-[6px] absolute mt-[-2px]">1</span>}
          </button>

          <div className="ml-6 flex items-center gap-2">
            <button onClick={() => doAction("volume", "POST", { volume: volume > 0 ? 0 : 30 })}
              className="text-white/30 hover:text-white/60 transition-colors" data-testid="btn-mute">
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input type="range" min={0} max={100} value={volume}
              onChange={e => { setVolume(+e.target.value); doAction("volume", "POST", { volume: +e.target.value }); }}
              className="w-24 accent-current" style={{ color: profile.accent, height: 3 }}
              data-testid="volume-slider" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes eqBounce { from { height: 3px; } to { height: 12px; } }
        input[type="range"] { -webkit-appearance: none; background: rgba(255,255,255,0.08); border-radius: 4px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: currentColor; cursor: pointer; }
      `}</style>
    </div>
  );
}