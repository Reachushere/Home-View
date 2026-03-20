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
  Disc3,
  Library,
  Mic2,
  Volume2,
  VolumeX,
  Menu,
  X,
  Heart,
  Radio,
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

function Visualizer({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(Array.from({ length: 32 }, () => 0));
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = 400 * dpr;
    canvas.height = 30 * dpr;
    ctx.scale(dpr, dpr);
    const w = 400, h = 30;
    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const barCount = 32, gap = 2;
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
          gradient.addColorStop(0, "rgba(29, 185, 84, 0.9)");
          gradient.addColorStop(0.5, "rgba(29, 185, 84, 0.6)");
          gradient.addColorStop(1, "rgba(29, 185, 84, 0.3)");
        } else {
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.12)");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.04)");
        }
        const x = i * (barW + gap);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, h - barH, barW, barH, barW / 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "30px" }} data-testid="audio-visualizer" />;
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
  const [showVolume, setShowVolume] = useState(false);
  const [volume, setVolume] = useState(50);
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
    setActiveCategory(cat);
    setMenuOpen(false);
    if (cat !== "search") fetchBrowseData(cat);
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

  const handleToggleShuffle = () => {
    const newState = !shuffleOn;
    setShuffleOn(newState);
    doAction("shuffle", "PUT", { state: newState });
  };

  const handleToggleRepeat = () => {
    const next = repeatMode === "off" ? "context" : repeatMode === "context" ? "track" : "off";
    setRepeatMode(next);
    doAction("repeat", "PUT", { state: next });
  };

  const playItem = (uri: string) => {
    doAction("play-context", "PUT", { uri });
  };

  const playTrack = (uri: string) => {
    doAction("play-tracks", "PUT", { uris: [uri] });
  };

  const progressPercent = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;
  const isPlaying = !!nowPlaying?.playing;

  const menuCategories: { key: MenuCategory; label: string; icon: any }[] = [
    { key: "search", label: "Search", icon: Search },
    { key: "playlists", label: "Playlists", icon: ListMusic },
    { key: "albums", label: "Albums", icon: Library },
    { key: "artists", label: "Artists", icon: Mic2 },
    { key: "tracks", label: "Tracks", icon: Heart },
    { key: "recent", label: "Recent", icon: Clock },
  ];

  const renderBrowseContent = () => {
    if (activeCategory === "search") {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search className="h-4 w-4 text-white/30 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search songs, artists, albums..."
                className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none"
                autoFocus data-testid="search-input" />
              {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/20" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
            {searchResults && (
              <>
                {searchResults.tracks.length > 0 && (
                  <div className="mb-3">
                    <h3 className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-1.5 px-1">Tracks</h3>
                    {searchResults.tracks.slice(0, 5).map((t) => (
                      <button key={t.id} onClick={() => playTrack(t.uri)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                        data-testid={`search-track-${t.id}`}>
                        <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                          style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[11px] text-white/80 truncate font-medium">{t.name}</p>
                          <p className="text-[9px] text-white/30 truncate">{t.artist}</p>
                        </div>
                        <span className="text-[9px] text-white/15 font-mono">{formatMs(t.duration)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.albums.length > 0 && (
                  <div className="mb-3">
                    <h3 className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-1.5 px-1">Albums</h3>
                    {searchResults.albums.slice(0, 4).map((a) => (
                      <button key={a.id} onClick={() => playItem(a.uri)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                        data-testid={`search-album-${a.id}`}>
                        <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                          style={{ background: a.imageSmall ? `url(${a.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[11px] text-white/80 truncate font-medium">{a.name}</p>
                          <p className="text-[9px] text-white/30 truncate">{a.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {!searchResults && !searchQuery && (
              <div className="flex flex-col items-center justify-center h-full opacity-30">
                <Search className="h-10 w-10 mb-2" />
                <p className="text-[10px]">Search for music</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (browseLoading) {
      return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>;
    }

    if (activeCategory === "playlists") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-2 gap-2">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => playItem(p.uri)}
                className="flex flex-col rounded-lg overflow-hidden hover:bg-white/[0.04] transition-colors text-left"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`playlist-${p.id}`}>
                <div className="aspect-square w-full overflow-hidden"
                  style={{ background: p.image ? `url(${p.image}) center/cover` : "rgba(255,255,255,0.05)" }}>
                  {!p.image && <div className="w-full h-full flex items-center justify-center"><ListMusic className="h-6 w-6 text-white/10" /></div>}
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-white/80 truncate font-medium">{p.name}</p>
                  <p className="text-[8px] text-white/25 truncate mt-0.5">{p.trackCount} tracks</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "albums") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-2 gap-2">
            {albums.map((a) => (
              <button key={a.id} onClick={() => playItem(a.uri)}
                className="flex flex-col rounded-lg overflow-hidden hover:bg-white/[0.04] transition-colors text-left"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`album-${a.id}`}>
                <div className="aspect-square w-full overflow-hidden"
                  style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.05)" }}>
                  {!a.image && <div className="w-full h-full flex items-center justify-center"><Library className="h-6 w-6 text-white/10" /></div>}
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-white/80 truncate font-medium">{a.name}</p>
                  <p className="text-[8px] text-white/25 truncate mt-0.5">{a.artist} {a.year && `· ${a.year}`}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "artists") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-2 gap-3">
            {artists.map((a) => (
              <button key={a.id} onClick={() => playItem(a.uri)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                data-testid={`artist-${a.id}`}>
                <div className="w-16 h-16 rounded-full overflow-hidden"
                  style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.06)" }}>
                  {!a.image && <div className="w-full h-full flex items-center justify-center"><Mic2 className="h-5 w-5 text-white/10" /></div>}
                </div>
                <p className="text-[10px] text-white/80 truncate w-full text-center font-medium">{a.name}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "tracks") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          {tracks.map((t, i) => (
            <button key={t.id} onClick={() => playTrack(t.uri)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              style={{ borderBottom: i < tracks.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              data-testid={`track-${t.id}`}>
              <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] text-white/80 truncate font-medium">{t.name}</p>
                <p className="text-[9px] text-white/30 truncate">{t.artist}</p>
              </div>
              <span className="text-[9px] text-white/15 font-mono flex-shrink-0">{formatMs(t.duration)}</span>
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "recent") {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-30">
              <Clock className="h-10 w-10 mb-2" /><p className="text-[10px]">No recent tracks</p>
            </div>
          ) : recent.map((track, i) => (
            <a key={i} href={track.trackUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
              style={{ borderBottom: i < recent.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              data-testid={`recent-track-${i}`}>
              <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
                style={{ background: track.albumArtSmall ? `url(${track.albumArtSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/70 truncate group-hover:text-white transition-colors font-medium">{track.name}</p>
                <p className="text-[9px] text-white/25 truncate">{track.artist}</p>
              </div>
              <span className="text-[8px] text-white/15 flex-shrink-0 font-mono">{timeAgo(track.playedAt)}</span>
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
      style={{ background: "#0a0a0f", fontFamily: "'Inter', system-ui, sans-serif" }}
      data-testid="spotify-player-page"
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: nowPlaying?.albumArt ? `url(${nowPlaying.albumArt})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(80px) brightness(0.15) saturate(1.5)", transform: "scale(1.2)",
        transition: "background-image 1s ease",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.5)" }} />

      {menuOpen && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setMenuOpen(false)} data-testid="menu-overlay" />
      )}

      <div className="fixed top-0 left-0 bottom-0 z-50 flex flex-col" style={{
        width: 220,
        background: "linear-gradient(180deg, rgba(18,18,24,0.98) 0%, rgba(10,10,15,0.98) 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        backdropFilter: "blur(20px)",
        boxShadow: menuOpen ? "4px 0 30px rgba(0,0,0,0.5)" : "none",
      }} data-testid="side-menu">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1DB954, #1ed760)" }}>
              <Music2 className="h-3.5 w-3.5 text-black" />
            </div>
            <span className="text-xs font-semibold text-white/90">Music</span>
          </div>
          <button onClick={() => setMenuOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors" data-testid="close-menu">
            <X className="h-3.5 w-3.5 text-white/50" />
          </button>
        </div>
        <div className="flex-1 py-2 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {menuCategories.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => handleCategorySelect(key)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-all"
              style={{
                background: activeCategory === key ? "rgba(29,185,84,0.12)" : "transparent",
                borderLeft: activeCategory === key ? "3px solid #1DB954" : "3px solid transparent",
              }} data-testid={`menu-${key}`}>
              <Icon style={{ color: activeCategory === key ? "#1DB954" : "rgba(255,255,255,0.4)", width: 16, height: 16 }} />
              <span className="text-xs font-medium" style={{ color: activeCategory === key ? "#1DB954" : "rgba(255,255,255,0.6)" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">

          <div className="flex flex-col items-center justify-center px-4" style={{
            width: "45%", minWidth: 280,
            borderRight: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(0,0,0,0.15)",
          }}>
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: "rgba(29,185,84,0.4)" }} />
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/20">Connecting</span>
              </div>
            ) : connectionError || notConnected ? (
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <Music2 className="h-10 w-10 text-white/15" />
                </div>
                <div>
                  <p className="text-xs text-white/50 font-medium mb-1">
                    {notConnected ? "Spotify Not Connected" : "Connection Issue"}
                  </p>
                  <p className="text-[10px] text-white/25 max-w-xs">
                    {notConnected ? "Connect your account to get started" : "Unable to reach Spotify"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {notConnected && (
                    <a href="/api/spotify/login"
                      className="px-4 py-2 rounded-full text-[10px] font-semibold text-black transition-all hover:scale-105"
                      style={{ background: "#1DB954", boxShadow: "0 0 15px rgba(29,185,84,0.3)" }}
                      data-testid="connect-spotify">
                      Connect Spotify
                    </a>
                  )}
                  <button onClick={fetchNowPlaying}
                    className="px-4 py-2 rounded-full text-[10px] font-medium text-white/60 hover:text-white transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    data-testid="retry-spotify">
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: 320 }}>
                <div className="relative rounded-2xl overflow-hidden" style={{
                  width: "min(220px, 35vh)", height: "min(220px, 35vh)",
                  boxShadow: isPlaying
                    ? "0 8px 50px rgba(0,0,0,0.6), 0 0 30px rgba(29,185,84,0.1)"
                    : "0 8px 30px rgba(0,0,0,0.5)",
                  transition: "box-shadow 0.5s",
                }}>
                  {nowPlaying?.albumArt ? (
                    <img src={nowPlaying.albumArt} alt={nowPlaying.album || ""}
                      className="w-full h-full object-cover"
                      style={{ animation: isPlaying ? "subtlePulse 4s ease-in-out infinite" : "none" }}
                      data-testid="album-art" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
                      <Music2 className="h-12 w-12 text-white/10" />
                    </div>
                  )}
                </div>

                <div className="text-center w-full">
                  <h1 className="text-base font-bold text-white truncate" data-testid="track-name">
                    {nowPlaying?.name || "Nothing Playing"}
                  </h1>
                  <p className="text-xs mt-0.5 truncate font-medium"
                    style={{ color: isPlaying ? "#1DB954" : "rgba(255,255,255,0.35)" }}
                    data-testid="track-artist">
                    {nowPlaying?.artist || "Play something on Spotify"}
                  </p>
                  {nowPlaying?.album && (
                    <p className="text-[10px] mt-0.5 truncate text-white/20 italic" data-testid="track-album">{nowPlaying.album}</p>
                  )}
                </div>

                <Visualizer playing={isPlaying} />

                {nowPlaying?.duration && (
                  <div className="w-full px-1">
                    <div className="relative rounded-full overflow-hidden cursor-pointer group"
                      style={{ height: 3, background: "rgba(255,255,255,0.08)" }} data-testid="progress-bar">
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{
                        width: `${progressPercent}%`, background: "#1DB954",
                        boxShadow: "0 0 6px rgba(29,185,84,0.3)", transition: "width 0.5s linear",
                      }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-white/25 font-mono tabular-nums" data-testid="progress-current">{formatMs(localProgress)}</span>
                      <span className="text-[9px] text-white/25 font-mono tabular-nums" data-testid="progress-total">{formatMs(nowPlaying.duration)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button onClick={handleToggleShuffle}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{ color: shuffleOn ? "#1DB954" : "rgba(255,255,255,0.25)" }}
                    data-testid="button-shuffle">
                    <Shuffle className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => doAction("previous")} disabled={actionPending}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    data-testid="button-previous">
                    <SkipBack className="h-4 w-4 text-white/70 fill-white/70" />
                  </button>
                  <button onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")} disabled={actionPending}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{
                      background: "#1DB954",
                      boxShadow: isPlaying ? "0 0 25px rgba(29,185,84,0.4), 0 4px 12px rgba(0,0,0,0.4)" : "0 0 12px rgba(29,185,84,0.2), 0 4px 12px rgba(0,0,0,0.4)",
                    }} data-testid="button-play-pause">
                    {actionPending ? (
                      <Loader2 className="h-5 w-5 text-black animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-5 w-5 text-black fill-black" />
                    ) : (
                      <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                    )}
                  </button>
                  <button onClick={() => doAction("next")} disabled={actionPending}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    data-testid="button-next">
                    <SkipForward className="h-4 w-4 text-white/70 fill-white/70" />
                  </button>
                  <button onClick={handleToggleRepeat}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all relative"
                    style={{ color: repeatMode !== "off" ? "#1DB954" : "rgba(255,255,255,0.25)" }}
                    data-testid="button-repeat">
                    <Repeat className="h-3.5 w-3.5" />
                    {repeatMode === "track" && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full text-[6px] font-bold flex items-center justify-center"
                        style={{ background: "#1DB954", color: "black" }}>1</span>
                    )}
                  </button>
                </div>

                {showVolume && (
                  <div className="w-full flex items-center gap-2 px-1" data-testid="volume-slider-container">
                    <VolumeX className="h-3 w-3 text-white/30 cursor-pointer hover:text-white/60 transition-colors flex-shrink-0"
                      onClick={() => handleVolumeChange(0)} />
                    <div className="flex-1 relative h-6 flex items-center group cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        handleVolumeChange(Math.round(pct));
                      }}>
                      <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${volume}%`, background: "linear-gradient(90deg, #1DB954, #1ed760)",
                          boxShadow: "0 0 6px rgba(29,185,84,0.3)",
                        }} />
                      </div>
                    </div>
                    <Volume2 className="h-3 w-3 text-white/30 cursor-pointer hover:text-white/60 transition-colors flex-shrink-0"
                      onClick={() => handleVolumeChange(100)} />
                    <span className="text-[9px] text-white/30 font-mono w-6 text-right">{volume}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
            <div className="flex items-center px-3 py-2 gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={() => setMenuOpen(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                data-testid="hamburger-menu">
                <Menu className="h-3.5 w-3.5 text-white/60" />
              </button>

              <div className="flex-1 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {menuCategories.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => handleCategorySelect(key)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0"
                    style={{
                      background: activeCategory === key ? "rgba(29,185,84,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${activeCategory === key ? "rgba(29,185,84,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                    data-testid={`tab-${key}`}>
                    <Icon style={{ width: 12, height: 12, color: activeCategory === key ? "#1DB954" : "rgba(255,255,255,0.4)" }} />
                    <span className="text-[10px] font-medium" style={{ color: activeCategory === key ? "#1DB954" : "rgba(255,255,255,0.5)" }}>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setShowVolume(!showVolume)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors"
                  style={{
                    background: showVolume ? "rgba(29,185,84,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${showVolume ? "rgba(29,185,84,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }} data-testid="toggle-volume">
                  <Volume2 className="h-3.5 w-3.5" style={{ color: showVolume ? "#1DB954" : "rgba(255,255,255,0.4)" }} />
                </button>
                {!isEmbedded && (
                  <button onClick={() => {
                    const p = new URLSearchParams(window.location.search);
                    window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : "");
                  }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    data-testid="back-to-dashboard">
                    <ChevronLeft className="h-3.5 w-3.5 text-white/40" />
                  </button>
                )}
              </div>
            </div>

            {renderBrowseContent()}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
      `}</style>
    </div>
  );
}
