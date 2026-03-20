import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music2,
  Loader2,
  ChevronLeft,
  Shuffle,
  Repeat,
  ListMusic,
  Clock,
  Search,
  Library,
  Mic2,
  Volume2,
  VolumeX,
  Heart,
  Power,
  X,
  Menu,
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

interface PlaylistItem {
  id: string;
  name: string;
  image: string;
  imageSmall: string;
  trackCount: number;
  uri: string;
  owner: string;
}

interface AlbumItem {
  id: string;
  name: string;
  artist: string;
  image: string;
  imageSmall: string;
  trackCount: number;
  uri: string;
  year: string;
}

interface ArtistItem {
  id: string;
  name: string;
  image: string;
  imageSmall: string;
  genres: string[];
  uri: string;
}

interface TrackItem {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  imageSmall: string;
  duration: number;
  uri: string;
}

interface SearchResults {
  tracks: TrackItem[];
  artists: ArtistItem[];
  albums: AlbumItem[];
  playlists: PlaylistItem[];
}

type MenuCategory = "search" | "playlists" | "albums" | "artists" | "tracks" | "recent";

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

function NeonIdleScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = 400 * dpr;
    canvas.height = 400 * dpr;
    ctx.scale(dpr, dpr);
    const w = 400, h = 400;
    const cx = w / 2, cy = h / 2;

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const t = Date.now() / 1000;

      for (let ring = 0; ring < 8; ring++) {
        const r = 60 + ring * 18 + Math.sin(t * 0.8 + ring * 0.5) * 5;
        const dots = 40 + ring * 8;
        for (let i = 0; i < dots; i++) {
          const angle = (i / dots) * Math.PI * 2 + t * (0.3 + ring * 0.05);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          const pulse = 0.3 + Math.sin(t * 2 + i * 0.3 + ring) * 0.3 + Math.sin(t * 3.7 + i * 0.7) * 0.2;
          const dotSize = 1.5 + pulse * 1.5;
          const alpha = 0.15 + pulse * 0.5;

          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          const hue = 280 + ring * 10 + Math.sin(t + i * 0.1) * 20;
          ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
          ctx.fill();

          if (pulse > 0.5) {
            ctx.beginPath();
            ctx.arc(x, y, dotSize * 3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${alpha * 0.15})`;
            ctx.fill();
          }
        }
      }

      const glowR = 45 + Math.sin(t * 1.5) * 3;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR * 2);
      gradient.addColorStop(0, "rgba(200, 100, 255, 0.15)");
      gradient.addColorStop(0.5, "rgba(200, 100, 255, 0.05)");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      const btnGrad = ctx.createRadialGradient(cx, cy - 10, 0, cx, cy, glowR);
      btnGrad.addColorStop(0, "rgba(230, 180, 255, 0.95)");
      btnGrad.addColorStop(0.7, "rgba(180, 100, 220, 0.8)");
      btnGrad.addColorStop(1, "rgba(150, 80, 200, 0.6)");
      ctx.fillStyle = btnGrad;
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.arc(cx, cy + 2, 16, -Math.PI * 0.75, Math.PI * 0.75, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx, cy - 6);
      ctx.stroke();

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return <canvas ref={canvasRef} style={{ width: 300, height: 300 }} data-testid="neon-idle" />;
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MenuCategory>("playlists");
  const [panelSpinning, setPanelSpinning] = useState(false);
  const [spinDirection, setSpinDirection] = useState<"left" | "right">("right");
  const [volume, setVolume] = useState(50);
  const [showVolume, setShowVolume] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");

  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const authParam = searchParams.get("auth");
  const authQuery = authParam ? `?auth=${authParam}` : "";
  const isEmbedded = searchParams.get("embed") === "true";
  const searchTimeout = useRef<any>(null);
  const categoryKeys: MenuCategory[] = ["search", "playlists", "albums", "artists", "tracks", "recent"];

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

  const fetchPlaybackState = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/playback-state${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (data.active) {
          setVolume(data.volume);
          setShuffleOn(data.shuffle);
          setRepeatMode(data.repeat);
        }
      }
    } catch {}
  }, [authQuery]);

  useEffect(() => {
    fetchNowPlaying();
    fetchRecent();
    fetchPlaybackState();
    fetchBrowseData("playlists");
    const interval = setInterval(fetchNowPlaying, 4000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying, fetchRecent, fetchPlaybackState]);

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

  const doAction = async (action: string, method = "POST", body?: any) => {
    setActionPending(true);
    try {
      await fetch(`/api/spotify/${action}${authQuery}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setTimeout(fetchNowPlaying, 500);
    } catch {} finally {
      setActionPending(false);
    }
  };

  const fetchBrowseData = async (category: MenuCategory) => {
    if (category === "search") return;
    setBrowseLoading(true);
    try {
      const endpoint = category === "recent" ? "recent" : category;
      const res = await fetch(`/api/spotify/${endpoint}${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (category === "playlists") setPlaylists(data);
        else if (category === "albums") setAlbums(data);
        else if (category === "artists") setArtists(data);
        else if (category === "tracks") setTracks(data);
        else if (category === "recent") setRecent(data);
      }
    } catch {} finally {
      setBrowseLoading(false);
    }
  };

  const handleCategorySelect = (cat: MenuCategory) => {
    if (cat === activeCategory) return;
    const oldIdx = categoryKeys.indexOf(activeCategory);
    const newIdx = categoryKeys.indexOf(cat);
    setSpinDirection(newIdx > oldIdx ? "right" : "left");
    setPanelSpinning(true);
    setTimeout(() => {
      setActiveCategory(cat);
      if (cat !== "search") fetchBrowseData(cat);
      setTimeout(() => setPanelSpinning(false), 50);
    }, 300);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}${authQuery ? "&" + authQuery.slice(1) : ""}`);
        if (res.ok) setSearchResults(await res.json());
      } catch {} finally {
        setSearchLoading(false);
      }
    }, 400);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    doAction("volume", "PUT", { volume: newVol });
  };

  const playItem = (uri: string) => doAction("play-context", "PUT", { uri });
  const playTrack = (uri: string) => doAction("play-tracks", "PUT", { uris: [uri] });

  const progressPercent = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;
  const isPlaying = !!nowPlaying?.playing;
  const hasTrack = nowPlaying && (nowPlaying.name || nowPlaying.playing);

  const menuItems: { key: MenuCategory; label: string; icon: any }[] = [
    { key: "search", label: "Search", icon: Search },
    { key: "playlists", label: "Playlists", icon: ListMusic },
    { key: "albums", label: "Albums", icon: Library },
    { key: "artists", label: "Artists", icon: Mic2 },
    { key: "tracks", label: "Tracks", icon: Heart },
    { key: "recent", label: "Recent", icon: Clock },
  ];

  const renderBrowsePanel = () => {
    if (browseLoading) {
      return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/15" /></div>;
    }

    if (activeCategory === "search") {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2">
            <div className="text-xs text-white/40 font-medium mb-2 px-1">Search</div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type to search..."
                className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/20 outline-none"
                autoFocus data-testid="search-input" />
              {searchLoading && <Loader2 className="h-3 w-3 animate-spin text-white/20" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2" style={{ scrollbarWidth: "none" }}>
            {searchResults && (
              <>
                {searchResults.tracks.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[9px] uppercase tracking-wider text-white/20 font-bold mb-1 px-1">Top result</div>
                    {searchResults.tracks.slice(0, 4).map((t) => (
                      <button key={t.id} onClick={() => playTrack(t.uri)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                        data-testid={`search-track-${t.id}`}>
                        <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                          style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[11px] text-white/70 truncate">{t.name}</p>
                          <p className="text-[9px] text-white/30 truncate">{t.artist}</p>
                        </div>
                        <span className="text-[9px] text-white/15 font-mono">{formatMs(t.duration)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.albums.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[9px] uppercase tracking-wider text-white/20 font-bold mb-1 px-1">Albums</div>
                    {searchResults.albums.slice(0, 3).map((a) => (
                      <button key={a.id} onClick={() => playItem(a.uri)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                        data-testid={`search-album-${a.id}`}>
                        <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                          style={{ background: a.imageSmall ? `url(${a.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[11px] text-white/70 truncate">{a.name}</p>
                          <p className="text-[9px] text-white/30 truncate">{a.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {!searchResults && !searchQuery && (
              <div className="flex flex-col items-center justify-center h-32 opacity-15">
                <Search className="h-8 w-8 mb-2" /><p className="text-[10px]">Type to search</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeCategory === "playlists") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          {playlists.map((p) => (
            <button key={p.id} onClick={() => playItem(p.uri)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-colors"
              data-testid={`playlist-${p.id}`}>
              <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden"
                style={{ background: p.image ? `url(${p.image}) center/cover` : "rgba(255,255,255,0.05)" }}>
                {!p.image && <div className="w-full h-full flex items-center justify-center"><ListMusic className="h-4 w-4 text-white/10" /></div>}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] text-white/70 truncate font-medium">{p.name}</p>
                <p className="text-[9px] text-white/25 truncate">{p.trackCount} tracks · {p.owner}</p>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "albums") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          {albums.map((a) => (
            <button key={a.id} onClick={() => playItem(a.uri)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-colors"
              data-testid={`album-${a.id}`}>
              <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden"
                style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.05)" }}>
                {!a.image && <div className="w-full h-full flex items-center justify-center"><Library className="h-4 w-4 text-white/10" /></div>}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] text-white/70 truncate font-medium">{a.name}</p>
                <p className="text-[9px] text-white/25 truncate">{a.artist} · {a.year}</p>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "artists") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          {artists.map((a) => (
            <button key={a.id} onClick={() => playItem(a.uri)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-colors"
              data-testid={`artist-${a.id}`}>
              <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden"
                style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.05)" }}>
                {!a.image && <div className="w-full h-full flex items-center justify-center"><Mic2 className="h-4 w-4 text-white/10" /></div>}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] text-white/70 truncate font-medium">{a.name}</p>
                <p className="text-[9px] text-white/25 truncate">{a.genres?.slice(0, 2).join(", ")}</p>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "tracks") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          <div className="text-xs text-white/40 font-medium mb-2 px-1">Tracks</div>
          {tracks.map((t) => (
            <button key={t.id} onClick={() => playTrack(t.uri)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              data-testid={`track-${t.id}`}>
              <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] text-white/70 truncate">{t.name}</p>
                <p className="text-[9px] text-white/25 truncate">{t.artist}</p>
              </div>
              <span className="text-[9px] text-white/15 font-mono">{formatMs(t.duration)}</span>
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "recent") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 opacity-15">
              <Clock className="h-8 w-8 mb-2" /><p className="text-[10px]">No recent tracks</p>
            </div>
          ) : recent.map((track, i) => (
            <a key={i} href={track.trackUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              data-testid={`recent-track-${i}`}>
              <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                style={{ background: track.albumArtSmall ? `url(${track.albumArtSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/70 truncate">{track.name}</p>
                <p className="text-[9px] text-white/25 truncate">{track.artist}</p>
              </div>
              <span className="text-[8px] text-white/15 font-mono">{timeAgo(track.playedAt)}</span>
            </a>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#000", fontFamily: "'Inter', system-ui, sans-serif" }}
      data-testid="spotify-player-page"
    >
      {hasTrack && nowPlaying?.albumArt && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `url(${nowPlaying.albumArt})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(40px) brightness(0.25) saturate(1.3)", transform: "scale(1.3)",
            transition: "background-image 1.5s ease",
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.3)" }} />
        </>
      )}

      <div className="relative z-10 flex-1 flex items-center">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-white/15" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/15">Connecting to Spotify</span>
          </div>
        ) : !hasTrack && !connectionError && !notConnected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-16">
              <NeonIdleScreen />
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-2 text-white/20">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #ff6b6b, #ee5a24)" }} />
                    <div className="w-1 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #ffd93d, #f6b93b)" }} />
                    <div className="w-1 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #6bcb77, #1DB954)" }} />
                  </div>
                  <span className="text-lg font-light tracking-wide" style={{ fontFamily: "system-ui" }}>/\</span>
                </div>
                <p className="text-xs text-white/10 tracking-wider uppercase">Music Assistant</p>
              </div>
            </div>
          </div>
        ) : connectionError || notConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <Music2 className="h-10 w-10 text-white/8" />
            </div>
            <p className="text-sm text-white/30">{notConnected ? "Spotify Not Connected" : "Connection Issue"}</p>
            {notConnected && (
              <a href="/api/spotify/login" className="px-5 py-2 rounded-full text-xs font-semibold text-black" style={{ background: "#1DB954" }} data-testid="connect-spotify">Connect</a>
            )}
            <button onClick={fetchNowPlaying} className="px-4 py-2 rounded-full text-[10px] text-white/30 hover:text-white/50" style={{ background: "rgba(255,255,255,0.04)" }} data-testid="retry-spotify">Retry</button>
          </div>
        ) : (
          <>
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="absolute top-4 left-4 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
              data-testid="hamburger-menu">
              <Menu className="h-4 w-4 text-white/50" />
            </button>

            {!isEmbedded && (
              <button onClick={() => {
                const p = new URLSearchParams(window.location.search);
                window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : "");
              }}
                className="absolute top-4 right-4 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                data-testid="back-to-dashboard">
                <ChevronLeft className="h-4 w-4 text-white/30" />
              </button>
            )}

            {menuOpen && (
              <div className="absolute top-0 left-0 bottom-0 z-20 flex" style={{ perspective: "1200px" }}>
                <div className="flex flex-col py-10 pl-3 pr-1 justify-center gap-0.5" style={{
                  background: "rgba(0,0,0,0.4)",
                  backdropFilter: "blur(20px)",
                }}>
                  {menuItems.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => handleCategorySelect(key)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left whitespace-nowrap"
                      style={{
                        color: activeCategory === key ? "#6b9fff" : "#ffffff60",
                        background: activeCategory === key ? "rgba(107,159,255,0.08)" : "transparent",
                      }} data-testid={`menu-${key}`}>
                      <Icon style={{ width: 14, height: 14 }} />
                      <span style={{ fontSize: 13, fontWeight: activeCategory === key ? 600 : 400 }}>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col" style={{
                  width: 320,
                  background: "rgba(30,30,35,0.92)",
                  backdropFilter: "blur(30px)",
                  borderRight: "1px solid rgba(255,255,255,0.05)",
                  transformOrigin: "left center",
                  animation: panelSpinning
                    ? spinDirection === "right" ? "panelSpinOut 0.3s ease-in forwards" : "panelSpinOutLeft 0.3s ease-in forwards"
                    : spinDirection === "right" ? "panelSpinIn 0.35s ease-out forwards" : "panelSpinInLeft 0.35s ease-out forwards",
                }}>
                  {renderBrowsePanel()}

                  {nowPlaying?.name && (
                    <div className="flex items-center gap-2 px-3 py-2 mx-2 mb-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                        style={{ background: nowPlaying.albumArtSmall ? `url(${nowPlaying.albumArtSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/60 truncate font-medium">{nowPlaying.name}</p>
                        <p className="text-[8px] text-white/25 truncate">{nowPlaying.artist}</p>
                      </div>
                      {isPlaying && <div className="flex gap-0.5 items-end h-4">
                        {[0,1,2].map(i => <div key={i} className="w-0.5 rounded-full bg-blue-400/60" style={{
                          animation: `eqBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                        }} />)}
                      </div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 flex items-center justify-center px-8 gap-8" style={{ marginLeft: menuOpen ? 440 : 0, transition: "margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}>
              <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{
                width: "min(380px, 50vh)", height: "min(380px, 50vh)",
                boxShadow: "0 20px 80px rgba(0,0,0,0.7)",
              }}>
                {nowPlaying?.albumArt ? (
                  <img src={nowPlaying.albumArt} alt={nowPlaying.album || ""} className="w-full h-full object-cover" data-testid="album-art" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
                    <Music2 className="h-16 w-16 text-white/8" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 max-w-md">
                <h1 className="text-2xl font-bold text-white truncate mb-1" data-testid="track-name">
                  {nowPlaying?.name || "Nothing Playing"}
                </h1>
                <p className="text-base text-white/60 truncate font-medium" data-testid="track-artist">
                  {nowPlaying?.artist || ""}
                </p>
                {nowPlaying?.album && (
                  <p className="text-sm text-white/30 truncate mt-0.5" data-testid="track-album">{nowPlaying.album}</p>
                )}

                {nowPlaying?.duration && (
                  <div className="mt-6">
                    <div className="relative rounded-full overflow-hidden cursor-pointer" style={{ height: 3, background: "rgba(255,255,255,0.08)" }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        setLocalProgress(Math.round(pct * (nowPlaying.duration || 0)));
                      }}
                      data-testid="progress-bar">
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{
                        width: `${progressPercent}%`,
                        background: "#5b86e5",
                        transition: "width 0.5s linear",
                      }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-white/25 font-mono tabular-nums" data-testid="progress-current">{formatMs(localProgress)}</span>
                      <span className="text-[10px] text-white/25 font-mono tabular-nums" data-testid="progress-total">-{formatMs(nowPlaying.duration - localProgress)} | {formatMs(nowPlaying.duration)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {hasTrack && (
        <div className="relative z-10 flex items-center justify-center gap-5 py-3 px-6" style={{
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(20px)",
        }}>
          <button onClick={() => {
            const next = repeatMode === "off" ? "context" : repeatMode === "context" ? "track" : "off";
            setRepeatMode(next);
            doAction("repeat", "PUT", { state: next });
          }}
            className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110"
            style={{ color: repeatMode !== "off" ? "#5b86e5" : "rgba(255,255,255,0.25)" }}
            data-testid="button-repeat">
            <Repeat className="h-5 w-5" />
            {repeatMode === "track" && <span className="absolute text-[6px] font-bold" style={{ color: "#5b86e5", marginTop: 12 }}>1</span>}
          </button>

          <button onClick={() => {
            const newState = !shuffleOn;
            setShuffleOn(newState);
            doAction("shuffle", "PUT", { state: newState });
          }}
            className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110"
            style={{ color: shuffleOn ? "#5b86e5" : "rgba(255,255,255,0.25)" }}
            data-testid="button-shuffle">
            <Shuffle className="h-5 w-5" />
          </button>

          <button onClick={() => doAction("previous")} disabled={actionPending}
            className="w-12 h-12 flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
            data-testid="button-previous">
            <SkipBack className="h-6 w-6 text-white/60 fill-white/60" />
          </button>

          <button onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")} disabled={actionPending}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: isPlaying ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
            }} data-testid="button-play-pause">
            {actionPending ? (
              <Loader2 className="h-7 w-7 text-white animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-7 w-7 text-white fill-white" />
            ) : (
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            )}
          </button>

          <button onClick={() => doAction("next")} disabled={actionPending}
            className="w-12 h-12 flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
            data-testid="button-next">
            <SkipForward className="h-6 w-6 text-white/60 fill-white/60" />
          </button>

          <button onClick={() => setMenuOpen(false)}
            className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            <X className="h-5 w-5" />
          </button>

          <button onClick={() => setShowVolume(!showVolume)}
            className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110"
            style={{ color: showVolume ? "#5b86e5" : "rgba(255,255,255,0.25)" }}
            data-testid="toggle-volume">
            <Volume2 className="h-5 w-5" />
          </button>

          {showVolume && (
            <div className="absolute right-4 bottom-full mb-2 flex flex-col items-center p-3 rounded-xl"
              style={{ background: "rgba(30,30,35,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)" }}
              data-testid="volume-slider-container">
              <div className="relative w-1.5 rounded-full cursor-pointer" style={{ height: 100, background: "rgba(255,255,255,0.06)" }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(100, ((rect.bottom - e.clientY) / rect.height) * 100));
                  handleVolumeChange(Math.round(pct));
                }}>
                <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all" style={{
                  height: `${volume}%`,
                  background: "linear-gradient(180deg, #5b86e5, #36d1dc)",
                  boxShadow: "0 0 8px rgba(91,134,229,0.3)",
                }} />
              </div>
              <span className="text-[9px] text-white/20 font-mono mt-2">{volume}%</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes panelSpinOut {
          0% { transform: perspective(1200px) rotateY(0deg); opacity: 1; }
          100% { transform: perspective(1200px) rotateY(-90deg); opacity: 0; }
        }
        @keyframes panelSpinIn {
          0% { transform: perspective(1200px) rotateY(90deg); opacity: 0; }
          100% { transform: perspective(1200px) rotateY(0deg); opacity: 1; }
        }
        @keyframes panelSpinOutLeft {
          0% { transform: perspective(1200px) rotateY(0deg); opacity: 1; }
          100% { transform: perspective(1200px) rotateY(90deg); opacity: 0; }
        }
        @keyframes panelSpinInLeft {
          0% { transform: perspective(1200px) rotateY(-90deg); opacity: 0; }
          100% { transform: perspective(1200px) rotateY(0deg); opacity: 1; }
        }
        @keyframes eqBar {
          0% { height: 3px; }
          100% { height: 14px; }
        }
      `}</style>
    </div>
  );
}
