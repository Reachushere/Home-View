import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Music2, Loader2,
  ChevronLeft, Shuffle, Repeat, Volume2, VolumeX, Speaker,
  Search, Radio, Menu, X, Home, Zap, Wifi,
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
    accent: "#3b82f6",
    glow: "rgba(59,130,246,0.3)",
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

function HoloCircuitLines({ accent }: { accent: string }) {
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

    const lines: { x1: number; y1: number; x2: number; y2: number; speed: number; offset: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const horizontal = Math.random() > 0.5;
      if (horizontal) {
        const y = Math.random() * H;
        lines.push({ x1: 0, y1: y, x2: W, y2: y, speed: 0.5 + Math.random() * 1.5, offset: Math.random() * Math.PI * 2 });
      } else {
        const x = Math.random() * W;
        lines.push({ x1: x, y1: 0, x2: x, y2: H, speed: 0.5 + Math.random() * 1.5, offset: Math.random() * Math.PI * 2 });
      }
    }

    const nodes: { x: number; y: number; pulseOffset: number }[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push({ x: Math.random() * W, y: Math.random() * H, pulseOffset: Math.random() * Math.PI * 2 });
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;

      for (const line of lines) {
        const alpha = 0.03 + Math.sin(t * line.speed + line.offset) * 0.02;
        ctx.strokeStyle = `${accent}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();

        const travelPos = ((t * line.speed * 30 + line.offset * 100) % (line.x2 === line.x1 ? H : W));
        const px = line.x2 === line.x1 ? line.x1 : travelPos;
        const py = line.y2 === line.y1 ? line.y1 : travelPos;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}40`;
        ctx.fill();
      }

      for (const node of nodes) {
        const pulse = Math.sin(t * 2 + node.pulseOffset) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.5 + pulse * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}${Math.round((0.05 + pulse * 0.1) * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [accent]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, opacity: 0.6 }} />;
}

function HoloScanLine() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.15), transparent)',
        animation: 'holoScan 4s linear infinite',
      }} />
    </div>
  );
}

function HoloVinyl({ albumArt, playing, accent, size = 220 }: { albumArt?: string; playing: boolean; accent: string; size?: number }) {
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

      const outerGlow = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.1);
      outerGlow.addColorStop(0, 'transparent');
      outerGlow.addColorStop(0.5, playing ? `${accent}15` : 'transparent');
      outerGlow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(0, 0, R * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow; ctx.fill();

      const vg = ctx.createRadialGradient(0, 0, R * 0.35, 0, 0, R);
      vg.addColorStop(0, "#0a0f1a"); vg.addColorStop(0.3, "#0d1420"); vg.addColorStop(0.6, "#080e18"); vg.addColorStop(1, "#050a12");
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = vg; ctx.fill();

      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.strokeStyle = playing ? `${accent}40` : 'rgba(0,180,255,0.15)';
      ctx.lineWidth = 1.5; ctx.stroke();

      for (let g = 0; g < 24; g++) {
        const r = R * 0.35 + g * (R * 0.028);
        if (r > R) break;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        const baseHue = playing ? 200 : 210;
        const hue = (baseHue + g * 8 + (playing ? t * 30 : 0)) % 360;
        const alpha = playing
          ? 0.08 + Math.sin(t * 3 + g * 0.5) * 0.05
          : 0.03 + Math.sin(t * 0.5 + g * 0.3) * 0.015;
        ctx.strokeStyle = `hsla(${hue},80%,60%,${alpha})`;
        ctx.lineWidth = 0.5; ctx.stroke();
      }

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i + t * 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * R * 0.36, Math.sin(angle) * R * 0.36);
        ctx.lineTo(Math.cos(angle) * R * 0.95, Math.sin(angle) * R * 0.95);
        ctx.strokeStyle = playing ? `${accent}10` : 'rgba(0,180,255,0.04)';
        ctx.lineWidth = 0.3; ctx.stroke();
      }

      const lr = R * 0.33;
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(imgEl, -lr, -lr, lr * 2, lr * 2);
        ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2);
        ctx.strokeStyle = playing ? `${accent}50` : 'rgba(0,180,255,0.2)';
        ctx.lineWidth = 1; ctx.stroke();
      } else {
        const labelGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, lr);
        labelGrad.addColorStop(0, playing ? accent : '#0a2040');
        labelGrad.addColorStop(1, playing ? `${accent}80` : '#061530');
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2);
        ctx.fillStyle = labelGrad; ctx.fill();
        ctx.strokeStyle = 'rgba(0,180,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      }

      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,200,255,0.4)"; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fill();

      ctx.restore();

      if (playing) {
        for (let i = 0; i < 3; i++) {
          const ringR = R + 6 + i * 10;
          const alpha = 0.12 + Math.sin(t * 2 + i * 1.2) * 0.08;
          ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `${accent}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 1; ctx.stroke();
        }

        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 / 8) * i + t * 0.5;
          const eqH = 4 + Math.sin(t * 4 + i * 0.8) * 8;
          const eqR = R + 20;
          const px = cx + Math.cos(angle) * eqR;
          const py = cy + Math.sin(angle) * eqR;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle + Math.PI / 2);
          ctx.fillStyle = `${accent}${Math.round((0.3 + Math.sin(t * 3 + i) * 0.2) * 255).toString(16).padStart(2, '0')}`;
          ctx.fillRect(-1, -eqH / 2, 2, eqH);
          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [albumArt, playing, accent, size]);

  return <canvas ref={canvasRef} style={{ width: size * 0.85, height: size * 0.85 }} data-testid="spinning-vinyl" />;
}

function HoloPanel({ children, className = "", accent, glow = false, style = {} }: {
  children: React.ReactNode; className?: string; accent: string; glow?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`} style={{
      background: 'rgba(5,10,25,0.65)',
      backdropFilter: 'blur(30px)',
      border: `1px solid ${glow ? accent + '30' : 'rgba(0,180,255,0.12)'}`,
      boxShadow: glow
        ? `0 0 30px ${accent}15, inset 0 1px 0 rgba(0,180,255,0.08), inset 0 0 60px rgba(0,10,40,0.3)`
        : 'inset 0 1px 0 rgba(0,180,255,0.06), inset 0 0 40px rgba(0,10,40,0.2)',
      ...style,
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(0,180,255,0.03) 0%, transparent 30%, transparent 70%, rgba(0,100,200,0.02) 100%)',
      }} />
      <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none" style={{
        background: `linear-gradient(90deg, transparent, ${glow ? accent + '40' : 'rgba(0,180,255,0.2)'}, transparent)`,
      }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const authParam = searchParams.get("auth");
  const authQuery = authParam ? `?auth=${authParam}` : "";
  const isEmbedded = searchParams.get("embed") === "true";
  const profile = PROFILES[activeProfile];
  const notifTimeout = useRef<any>(null);
  const searchTimeout = useRef<any>(null);

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

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&${authQuery.slice(1)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults([...(data.tracks || []).slice(0, 6), ...(data.artists || []).slice(0, 4)]);
      }
    } catch {} finally { setSearching(false); }
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
    if (!entityId) { showNotif(`No speakers in ${roomName}`); return; }
    try {
      await fetch(`/api/spotify/play-on-speaker${authQuery}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, spotifyUri: artistData.uri, artistName: artistData.name, deviceType }),
      });
      setActiveRooms(prev => new Set(prev).add(roomName));
      showNotif(`Playing ${artistData.name} in ${roomName}`);
    } catch { showNotif("Failed to play"); }
  };

  const playStation = async (station: StationShortcut) => {
    if (station.uri) {
      try {
        await fetch(`/api/spotify/play-context${authQuery}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEntityId: srcSpeaker.entityId, targetEntityId: tgtSpeaker.entityId }),
      });
      setActiveRooms(prev => { const n = new Set(prev); n.add(sourceRoom); n.add(targetRoom); return n; });
      showNotif(`Grouped ${sourceRoom} + ${targetRoom}`);
    } catch { showNotif("Failed to group"); }
  };

  const handleDragStart = (type: "artist" | "room", data: any) => (e: React.DragEvent) => {
    setDragItem({ type, data });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, data }));
  };

  const handleRoomDrop = (roomName: string) => (e: React.DragEvent) => {
    e.preventDefault(); setDropTarget(null);
    try {
      const raw = e.dataTransfer.getData("text/plain");
      const parsed = JSON.parse(raw);
      if (parsed.type === "artist") playOnRoom(roomName, parsed.data);
      else if (parsed.type === "room" && parsed.data.room !== roomName) groupRooms(parsed.data.room, roomName);
    } catch {}
    setDragItem(null);
  };

  const handleDragOver = (roomName: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(roomName);
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
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#030810' }} data-testid="spotify-player-page">
      <img
        src={isPlaying ? massBg : musicBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: isPlaying ? 0.35 : 0.2, filter: "brightness(0.4) saturate(0.7) hue-rotate(200deg)" }}
      />

      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(0,40,100,0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 30%, ${isSakura ? 'rgba(244,114,182,0.06)' : 'rgba(100,40,200,0.06)'} 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(0,20,60,0.3) 0%, transparent 60%),
          linear-gradient(180deg, rgba(0,5,15,0.4) 0%, rgba(0,10,30,0.6) 100%)
        `,
      }} />

      <HoloCircuitLines accent={profile.accent} />
      {isSakura && <CherryBlossoms />}
      <HoloScanLine />

      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-lg text-xs font-medium text-white/90"
          style={{
            background: 'rgba(5,15,35,0.85)',
            border: `1px solid ${profile.accent}40`,
            backdropFilter: "blur(20px)",
            boxShadow: `0 0 30px ${profile.glow}, 0 0 60px rgba(0,0,0,0.5)`,
            animation: "fadeInUp 0.3s ease",
          }}
          data-testid="notification">
          <Zap className="inline h-3 w-3 mr-1.5" style={{ color: profile.accent }} />
          {notification}
        </div>
      )}

      <div className="relative z-10 flex-1 flex overflow-hidden" style={{
        transform: profileSpinning ? "perspective(1200px) rotateY(-90deg)" : "perspective(1200px) rotateY(0deg)",
        opacity: profileSpinning ? 0 : 1,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
      }}>

        <div className="flex flex-col flex-shrink-0 relative" style={{ width: menuOpen ? 200 : 48, transition: "width 0.3s ease" }}>
          <div className="absolute inset-0" style={{
            background: 'rgba(3,8,20,0.7)',
            backdropFilter: "blur(30px)",
            borderRight: '1px solid rgba(0,180,255,0.08)',
          }} />
          <div className="absolute top-0 right-0 bottom-0 w-[1px]" style={{
            background: 'linear-gradient(180deg, rgba(0,180,255,0.2), rgba(0,180,255,0.05), rgba(0,180,255,0.15))',
          }} />

          <div className="relative z-10 flex flex-col h-full py-2">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center justify-center py-2.5 mb-1 transition-colors"
              style={{ color: 'rgba(0,180,255,0.4)' }}
              data-testid="menu-toggle">
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {!isEmbedded && (
              <button onClick={() => { const p = new URLSearchParams(window.location.search); window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : ""); }}
                className="w-full flex items-center gap-3 px-3 py-2 transition-colors" style={{ color: 'rgba(0,180,255,0.25)' }}
                data-testid="back-to-dashboard">
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                {menuOpen && <span className="text-[10px] whitespace-nowrap">Dashboard</span>}
              </button>
            )}

            <div className="flex-1 flex flex-col gap-0.5 mt-2 px-1">
              {([
                { mode: "floor" as ViewMode, icon: <Home className="h-3.5 w-3.5" />, label: "Floor Plan" },
                { mode: "stations" as ViewMode, icon: <Radio className="h-3.5 w-3.5" />, label: "Stations" },
                { mode: "rooms" as ViewMode, icon: <Speaker className="h-3.5 w-3.5" />, label: "Rooms" },
              ]).map(item => (
                <button key={item.mode}
                  onClick={() => setViewMode(item.mode)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all"
                  style={{
                    background: viewMode === item.mode ? `${profile.accent}12` : "transparent",
                    color: viewMode === item.mode ? profile.accent : "rgba(0,180,255,0.3)",
                    borderLeft: viewMode === item.mode ? `2px solid ${profile.accent}` : '2px solid transparent',
                  }}
                  data-testid={`nav-${item.mode}`}>
                  <div className="flex-shrink-0">{item.icon}</div>
                  {menuOpen && <span className="text-[10px] whitespace-nowrap font-medium">{item.label}</span>}
                </button>
              ))}

              <div className="my-2 mx-2 h-[1px]" style={{ background: 'rgba(0,180,255,0.08)' }} />

              <button onClick={() => setShowSearch(!showSearch)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all"
                style={{ color: showSearch ? profile.accent : 'rgba(0,180,255,0.3)' }}
                data-testid="nav-search">
                <Search className="h-3.5 w-3.5 flex-shrink-0" />
                {menuOpen && <span className="text-[10px] whitespace-nowrap font-medium">Search</span>}
              </button>
            </div>

            <div className="mt-auto flex flex-col gap-0.5 px-1 pb-1">
              <div className="mx-2 mb-1 h-[1px]" style={{ background: 'rgba(0,180,255,0.08)' }} />
              {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
                <button key={k} onClick={() => switchProfile(k)}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all"
                  style={{
                    background: activeProfile === k ? `${PROFILES[k].accent}15` : "transparent",
                    boxShadow: activeProfile === k ? `0 0 20px ${PROFILES[k].glow}, inset 0 0 15px ${PROFILES[k].glow}` : "none",
                  }}
                  data-testid={`profile-${k}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: activeProfile === k
                        ? `linear-gradient(135deg, ${PROFILES[k].accent}40, ${PROFILES[k].accent}20)`
                        : 'rgba(0,180,255,0.08)',
                      border: `1px solid ${activeProfile === k ? PROFILES[k].accent + '60' : 'rgba(0,180,255,0.15)'}`,
                      color: activeProfile === k ? PROFILES[k].accent : 'rgba(0,180,255,0.4)',
                      boxShadow: activeProfile === k ? `0 0 10px ${PROFILES[k].glow}` : 'none',
                    }}>
                    {PROFILES[k].label[0]}
                  </div>
                  {menuOpen && <span className="text-[10px] whitespace-nowrap font-medium"
                    style={{ color: activeProfile === k ? PROFILES[k].accent : 'rgba(0,180,255,0.3)' }}>
                    {PROFILES[k].label}
                  </span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-3 p-3 overflow-hidden">

          <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 260 }}>
            <HoloPanel accent={profile.accent} glow={isPlaying} className="p-3 flex flex-col items-center">
              <div className="relative flex items-center justify-center" style={{ minHeight: 170 }}>
                <HoloVinyl albumArt={nowPlaying?.albumArt} playing={isPlaying} accent={profile.accent} size={210} />
              </div>

              <div className="text-center mt-1 w-full px-2">
                <p className="text-sm font-bold truncate" data-testid="track-name"
                  style={{ color: 'rgba(200,230,255,0.95)', textShadow: isPlaying ? `0 0 20px ${profile.glow}` : 'none' }}>
                  {nowPlaying?.name || "Nothing Playing"}
                </p>
                <p className="text-xs truncate mt-0.5 font-medium" data-testid="track-artist"
                  style={{ color: isPlaying ? profile.accent : "rgba(0,180,255,0.35)" }}>
                  {nowPlaying?.artist || "Select an artist or station"}
                </p>
                {nowPlaying?.album && (
                  <p className="text-[9px] truncate mt-0.5" data-testid="track-album"
                    style={{ color: 'rgba(0,180,255,0.2)' }}>{nowPlaying.album}</p>
                )}
              </div>
            </HoloPanel>

            <HoloPanel accent={profile.accent} className="flex-1 overflow-hidden p-3">
              <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-2 px-1 flex items-center gap-1.5"
                style={{ color: `${profile.accent}80` }}>
                <Wifi className="h-2.5 w-2.5" />
                {isSakura ? "お気に入り • Favorites" : "Favorites"}
              </div>
              <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none", maxHeight: 'calc(100% - 24px)' }}>
                <div className="grid grid-cols-2 gap-1.5">
                  {profile.artists.map((artist, i) => (
                    <div key={artist.name} draggable
                      onDragStart={handleDragStart("artist", artist)}
                      onDragEnd={() => setDragItem(null)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all group"
                      style={{
                        background: "rgba(0,20,50,0.4)",
                        border: '1px solid rgba(0,180,255,0.08)',
                        animation: `fadeInUp 0.4s ease ${i * 60}ms both`,
                      }}
                      data-testid={`artist-card-${artist.name.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 transition-all"
                        style={{
                          border: `1.5px solid ${profile.accent}30`,
                          boxShadow: `0 0 12px ${profile.glow}`,
                          background: artistImages[artist.name]
                            ? `url(${artistImages[artist.name]}) center/cover`
                            : `linear-gradient(135deg, ${profile.accent}30, rgba(0,20,60,0.6))`,
                        }}>
                        {!artistImages[artist.name] && <div className="w-full h-full flex items-center justify-center"><Music2 className="h-3.5 w-3.5" style={{ color: `${profile.accent}40` }} /></div>}
                      </div>
                      <span className="text-[8px] truncate w-full text-center font-medium transition-colors"
                        style={{ color: 'rgba(0,180,255,0.4)' }}>{artist.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </HoloPanel>
          </div>

          <div className="flex-1 relative rounded-xl overflow-hidden" style={{
            border: `1px solid ${dragItem ? `${profile.accent}40` : 'rgba(0,180,255,0.1)'}`,
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
            boxShadow: dragItem
              ? `0 0 40px ${profile.glow}, inset 0 0 30px ${profile.glow}`
              : 'inset 0 1px 0 rgba(0,180,255,0.06)',
            background: "rgba(3,8,20,0.5)",
            backdropFilter: "blur(20px)",
          }}>
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
              background: `linear-gradient(90deg, transparent, rgba(0,180,255,0.15), transparent)`,
            }} />

            {showSearch && (
              <div className="absolute inset-0 z-20 p-4 overflow-y-auto" style={{ background: 'rgba(3,8,20,0.9)', backdropFilter: 'blur(20px)', scrollbarWidth: 'none' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                    background: 'rgba(0,20,50,0.5)', border: '1px solid rgba(0,180,255,0.15)',
                  }}>
                    <Search className="h-3.5 w-3.5" style={{ color: 'rgba(0,180,255,0.4)' }} />
                    <input
                      type="text" value={searchQuery} placeholder="Search songs, artists..."
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        if (searchTimeout.current) clearTimeout(searchTimeout.current);
                        searchTimeout.current = setTimeout(() => doSearch(e.target.value), 500);
                      }}
                      className="flex-1 bg-transparent text-xs outline-none placeholder:text-blue-400/20"
                      style={{ color: 'rgba(200,230,255,0.8)' }}
                      data-testid="search-input" autoFocus
                    />
                  </div>
                  <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
                    className="p-2 rounded-lg transition-colors" style={{ color: 'rgba(0,180,255,0.4)' }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {searching && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: profile.accent }} /></div>}
                <div className="grid grid-cols-2 gap-2">
                  {searchResults.map((r: any, i: number) => (
                    <button key={i} onClick={() => {
                      if (r.uri) {
                        doAction("play-context", "POST", { contextUri: r.uri });
                        showNotif(`Playing ${r.name}`);
                        setShowSearch(false);
                      }
                    }}
                      className="flex items-center gap-2 p-2.5 rounded-lg transition-all text-left group"
                      style={{ background: 'rgba(0,20,50,0.4)', border: '1px solid rgba(0,180,255,0.08)' }}
                      data-testid={`search-result-${i}`}>
                      {r.image ? (
                        <img src={r.image} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                          style={{ border: '1px solid rgba(0,180,255,0.15)' }} />
                      ) : (
                        <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: `${profile.accent}15`, border: '1px solid rgba(0,180,255,0.1)' }}>
                          <Music2 className="h-3.5 w-3.5" style={{ color: `${profile.accent}40` }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium truncate" style={{ color: 'rgba(200,230,255,0.8)' }}>{r.name}</p>
                        <p className="text-[9px] truncate" style={{ color: 'rgba(0,180,255,0.3)' }}>{r.artist || r.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewMode === "floor" && (
              <>
                <img src={floorplanImg} alt="Apartment floor plan" className="absolute inset-0 w-full h-full object-contain"
                  style={{ filter: "brightness(0.55) contrast(1.1) saturate(0.5) hue-rotate(190deg)", opacity: 0.75 }} />
                <div className="absolute inset-0" style={{
                  background: `radial-gradient(ellipse at center, transparent 30%, rgba(3,8,20,0.6) 100%)`,
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
                      className="absolute rounded-lg cursor-pointer transition-all"
                      style={{
                        left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%`,
                        background: isDrop
                          ? `${profile.accent}20`
                          : isActive
                            ? `rgba(0,180,255,0.08)`
                            : "rgba(3,8,20,0.25)",
                        border: `1px solid ${isDrop ? profile.accent : isActive ? `${profile.accent}50` : "rgba(0,180,255,0.08)"}`,
                        boxShadow: isActive
                          ? `0 0 25px ${profile.glow}, inset 0 0 20px ${profile.glow}`
                          : isDrop
                            ? `0 0 30px ${profile.glow}`
                            : "none",
                        backdropFilter: "blur(4px)",
                      }}
                      data-testid={`room-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                        <span className="text-base" style={{ filter: isActive ? `drop-shadow(0 0 6px ${profile.accent})` : 'none' }}>{spot.icon}</span>
                        <span className="text-[7px] font-bold uppercase tracking-wider text-center leading-tight px-1"
                          style={{ color: isActive ? profile.accent : 'rgba(0,180,255,0.4)', textShadow: isActive ? `0 0 8px ${profile.glow}` : 'none' }}>
                          {spot.room}
                        </span>
                        {isActive && (
                          <div className="flex gap-0.5 mt-0.5">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="w-0.5 rounded-full" style={{
                                height: 4 + Math.random() * 6,
                                background: profile.accent,
                                boxShadow: `0 0 4px ${profile.accent}`,
                                animation: `eqBounce ${0.3 + i * 0.15}s ease-in-out infinite alternate`,
                              }} />
                            ))}
                          </div>
                        )}
                      </div>
                      {isDrop && (
                        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
                          border: `1px dashed ${profile.accent}60`,
                          animation: 'holoPulse 1s ease-in-out infinite',
                        }} />
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {viewMode === "stations" && (
              <div className="absolute inset-0 p-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-3 flex items-center gap-1.5"
                  style={{ color: `${profile.accent}70` }}>
                  <Radio className="h-3 w-3" /> Stations & Shortcuts
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STATION_SHORTCUTS.map((station, i) => (
                    <button key={station.name}
                      onClick={() => playStation(station)}
                      className="flex items-center gap-2.5 p-3 rounded-lg transition-all group"
                      style={{
                        background: "rgba(0,15,40,0.5)",
                        border: "1px solid rgba(0,180,255,0.08)",
                        animation: `fadeInUp 0.3s ease ${i * 40}ms both`,
                      }}
                      data-testid={`station-${station.name.toLowerCase().replace(/\s/g, "-")}`}>
                      <span className="text-lg flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(0,180,255,0.3))' }}>{station.icon}</span>
                      <span className="text-[10px] font-medium text-left truncate"
                        style={{ color: 'rgba(0,180,255,0.5)' }}>{station.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewMode === "rooms" && (
              <div className="absolute inset-0 p-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-3 flex items-center gap-1.5"
                  style={{ color: `${profile.accent}70` }}>
                  <Speaker className="h-3 w-3" /> Speaker Rooms
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ROOM_HOTSPOTS.map((spot, i) => {
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
                        className="flex items-center gap-3 p-3 rounded-lg transition-all group"
                        style={{
                          background: isActive ? `${profile.accent}10` : "rgba(0,15,40,0.5)",
                          border: `1px solid ${isActive ? `${profile.accent}35` : "rgba(0,180,255,0.08)"}`,
                          boxShadow: isActive ? `0 0 20px ${profile.glow}, inset 0 0 15px ${profile.glow}` : "none",
                          animation: `fadeInUp 0.3s ease ${i * 40}ms both`,
                        }}
                        data-testid={`room-btn-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                        <span className="text-lg flex-shrink-0" style={{ filter: isActive ? `drop-shadow(0 0 6px ${profile.accent})` : 'drop-shadow(0 0 3px rgba(0,180,255,0.2))' }}>{spot.icon}</span>
                        <div className="flex-1 text-left">
                          <span className="text-[10px] font-medium block"
                            style={{ color: isActive ? profile.accent : 'rgba(0,180,255,0.5)' }}>{spot.room}</span>
                          <span className="text-[8px]" style={{ color: 'rgba(0,180,255,0.2)' }}>{spot.entityId.split(".")[1]}</span>
                        </div>
                        {isActive && (
                          <div className="flex gap-0.5">
                            {[...Array(4)].map((_, j) => (
                              <div key={j} className="w-0.5 rounded-full" style={{
                                height: 6 + Math.random() * 8,
                                background: profile.accent,
                                boxShadow: `0 0 4px ${profile.accent}`,
                                animation: `eqBounce ${0.3 + j * 0.12}s ease-in-out infinite alternate`,
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

      <div className="relative z-10" style={{
        background: 'rgba(3,8,20,0.75)',
        backdropFilter: 'blur(30px)',
        borderTop: '1px solid rgba(0,180,255,0.08)',
      }}>
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,180,255,0.15), transparent)',
        }} />

        <div className="px-6 pt-2 pb-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: 'rgba(0,180,255,0.3)' }}>{formatMs(localProgress)}</span>
            <div className="flex-1 h-[3px] rounded-full overflow-hidden cursor-pointer group relative"
              style={{ background: 'rgba(0,180,255,0.08)' }}
              onClick={e => {
                if (!nowPlaying?.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                doAction("seek", "POST", { positionMs: Math.round(pct * nowPlaying.duration) });
              }}
              data-testid="progress-bar">
              <div className="h-full rounded-full transition-all relative" style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, rgba(0,180,255,0.4), ${profile.accent})`,
                boxShadow: `0 0 10px ${profile.glow}, 0 0 20px ${profile.glow}`,
              }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: profile.accent, boxShadow: `0 0 8px ${profile.accent}, 0 0 16px ${profile.glow}` }} />
              </div>
            </div>
            <span className="text-[10px] tabular-nums w-8" style={{ color: 'rgba(0,180,255,0.3)' }}>{formatMs(nowPlaying?.duration || 0)}</span>
          </div>

          <div className="flex items-center justify-center gap-6 pb-1">
            <button onClick={() => doAction("shuffle", "POST")} className="transition-all hover:scale-110"
              style={{ color: shuffleOn ? profile.accent : "rgba(0,180,255,0.2)", filter: shuffleOn ? `drop-shadow(0 0 6px ${profile.glow})` : 'none' }}
              data-testid="btn-shuffle">
              <Shuffle className="h-4 w-4" />
            </button>
            <button onClick={() => doAction("previous")} className="hover:scale-110 transition-all"
              style={{ color: 'rgba(0,180,255,0.35)' }} data-testid="btn-prev">
              <SkipBack className="h-5 w-5" />
            </button>
            <button onClick={() => doAction(isPlaying ? "pause" : "play")}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${profile.accent}cc, ${profile.accent})`,
                boxShadow: `0 0 30px ${profile.glow}, 0 0 60px ${profile.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                border: `1px solid ${profile.accent}60`,
              }}
              data-testid="btn-play-pause">
              {actionPending ? <Loader2 className="h-5 w-5 text-white animate-spin" /> :
                isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
            </button>
            <button onClick={() => doAction("next")} className="hover:scale-110 transition-all"
              style={{ color: 'rgba(0,180,255,0.35)' }} data-testid="btn-next">
              <SkipForward className="h-5 w-5" />
            </button>
            <button onClick={() => doAction("repeat", "POST")} className="transition-all hover:scale-110 relative"
              style={{ color: repeatMode !== "off" ? profile.accent : "rgba(0,180,255,0.2)", filter: repeatMode !== "off" ? `drop-shadow(0 0 6px ${profile.glow})` : 'none' }}
              data-testid="btn-repeat">
              <Repeat className="h-4 w-4" />
              {repeatMode === "track" && <span className="absolute -top-1 -right-1 text-[6px] font-bold" style={{ color: profile.accent }}>1</span>}
            </button>

            <div className="ml-8 flex items-center gap-2">
              <button onClick={() => doAction("volume", "POST", { volume: volume > 0 ? 0 : 30 })}
                className="transition-colors" style={{ color: 'rgba(0,180,255,0.25)' }} data-testid="btn-mute">
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input type="range" min={0} max={100} value={volume}
                onChange={e => { setVolume(+e.target.value); doAction("volume", "POST", { volume: +e.target.value }); }}
                className="w-24 holo-range" style={{ height: 3 }}
                data-testid="volume-slider" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes eqBounce { from { height: 3px; } to { height: 12px; } }
        @keyframes holoScan {
          0% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes holoPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        .holo-range {
          -webkit-appearance: none;
          background: rgba(0,180,255,0.08);
          border-radius: 4px;
          outline: none;
        }
        .holo-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${profile.accent};
          cursor: pointer;
          box-shadow: 0 0 8px ${profile.glow}, 0 0 16px ${profile.glow};
        }
        .holo-range::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${profile.accent};
          cursor: pointer;
          box-shadow: 0 0 8px ${profile.glow}, 0 0 16px ${profile.glow};
          border: none;
        }
      `}</style>
    </div>
  );
}
