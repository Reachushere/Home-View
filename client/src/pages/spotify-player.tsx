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

function VinylDisc({ albumArt, isPlaying }: { albumArt?: string; isPlaying: boolean }) {
  return (
    <div className="vinyl-container" data-testid="vinyl-disc">
      <div className="vinyl-glow" style={{
        position: "absolute", inset: -20,
        borderRadius: "50%",
        background: isPlaying
          ? "radial-gradient(circle, rgba(29,185,84,0.15) 0%, rgba(29,185,84,0.05) 40%, transparent 70%)"
          : "none",
        filter: "blur(15px)",
        transition: "all 1s ease",
        animation: isPlaying ? "glowPulse 3s ease-in-out infinite" : "none",
      }} />
      <div className="vinyl-outer" style={{
        width: "100%", height: "100%",
        borderRadius: "50%",
        background: "conic-gradient(from 0deg, #1a1a1a 0%, #2a2a2a 10%, #1a1a1a 20%, #2a2a2a 30%, #1a1a1a 40%, #2a2a2a 50%, #1a1a1a 60%, #2a2a2a 70%, #1a1a1a 80%, #2a2a2a 90%, #1a1a1a 100%)",
        animation: isPlaying ? "vinylSpin 3s linear infinite" : "none",
        transition: "all 0.5s ease",
        position: "relative",
        boxShadow: isPlaying
          ? "0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(29,185,84,0.08), inset 0 0 30px rgba(0,0,0,0.5)"
          : "0 0 30px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          position: "absolute", inset: 3,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.05)",
        }} />
        <div style={{
          position: "absolute", inset: "15%",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.03)",
        }} />
        <div style={{
          position: "absolute", inset: "20%",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.02)",
        }} />
        <div style={{
          position: "absolute", inset: "25%",
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "0 0 20px rgba(0,0,0,0.8)",
        }}>
          {albumArt ? (
            <img src={albumArt} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1DB954, #0d7a35)" }}>
              <Music2 className="h-8 w-8 text-white/40" />
            </div>
          )}
        </div>
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 12, height: 12,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, #333 0%, #1a1a1a 100%)",
          border: "2px solid rgba(255,255,255,0.1)",
          boxShadow: "0 0 8px rgba(0,0,0,0.8)",
          zIndex: 10,
        }} />
      </div>
    </div>
  );
}

function SpectrumBars({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(Array.from({ length: 64 }, () => 0));
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = 600 * dpr;
    canvas.height = 50 * dpr;
    ctx.scale(dpr, dpr);
    const w = 600, h = 50;
    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const barCount = 64, gap = 1;
      const barW = (w - (barCount - 1) * gap) / barCount;
      for (let i = 0; i < barCount; i++) {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const t = Date.now() / 1000;
        const target = playing
          ? (0.15 + Math.sin(t * 2.5 + i * 0.3) * 0.2 + Math.cos(t * 3.7 + i * 0.5) * 0.15 + Math.sin(t * 5 + i * 0.8) * 0.1 + Math.random() * 0.05) * (1 - centerDist * 0.4)
          : 0.02 + Math.sin(t * 0.5 + i * 0.15) * 0.015;
        barsRef.current[i] += (target - barsRef.current[i]) * (playing ? 0.18 : 0.04);
        const barH = Math.max(1, barsRef.current[i] * h);
        const x = i * (barW + gap);
        const gradient = ctx.createLinearGradient(0, h, 0, h - barH);
        if (playing) {
          const intensity = barsRef.current[i];
          if (intensity > 0.35) {
            gradient.addColorStop(0, "rgba(29, 185, 84, 0.95)");
            gradient.addColorStop(0.4, "rgba(29, 220, 100, 0.7)");
            gradient.addColorStop(1, "rgba(29, 255, 120, 0.4)");
          } else {
            gradient.addColorStop(0, "rgba(29, 185, 84, 0.7)");
            gradient.addColorStop(0.5, "rgba(29, 185, 84, 0.4)");
            gradient.addColorStop(1, "rgba(29, 185, 84, 0.15)");
          }
        } else {
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.06)");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.02)");
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, h - barH, barW, barH, 1);
        ctx.fill();
        if (playing && barsRef.current[i] > 0.3) {
          ctx.fillStyle = `rgba(29, 185, 84, ${barsRef.current[i] * 0.3})`;
          ctx.beginPath();
          ctx.roundRect(x, h - barH - 2, barW, 1, 1);
          ctx.fill();
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "40px", opacity: 0.8 }} data-testid="spectrum-bars" />;
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

  const [activeCategory, setActiveCategory] = useState<MenuCategory>("playlists");
  const [contentVisible, setContentVisible] = useState(true);
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
    setContentVisible(false);
    setTimeout(() => {
      setActiveCategory(cat);
      if (cat !== "search") fetchBrowseData(cat);
      setTimeout(() => setContentVisible(true), 50);
    }, 250);
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

  const playItem = (uri: string) => doAction("play-context", "PUT", { uri });
  const playTrack = (uri: string) => doAction("play-tracks", "PUT", { uris: [uri] });

  const progressPercent = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;
  const isPlaying = !!nowPlaying?.playing;

  const menuItems: { key: MenuCategory; label: string; icon: any }[] = [
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
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" }}>
              <Search className="h-5 w-5 text-white/25 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                placeholder="What do you want to listen to?"
                className="flex-1 bg-transparent text-base text-white/90 placeholder:text-white/15 outline-none"
                autoFocus data-testid="search-input" />
              {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-green-500/50" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ scrollbarWidth: "none" }}>
            {searchResults && (
              <>
                {searchResults.tracks.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-green-400/40 font-bold mb-2 px-1">Tracks</h3>
                    {searchResults.tracks.slice(0, 6).map((t) => (
                      <button key={t.id} onClick={() => playTrack(t.uri)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all group"
                        data-testid={`search-track-${t.id}`}>
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden shadow-lg"
                          style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.04)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-white/75 truncate font-medium group-hover:text-white transition-colors">{t.name}</p>
                          <p className="text-xs text-white/25 truncate">{t.artist}</p>
                        </div>
                        <Play className="h-4 w-4 text-white/0 group-hover:text-green-400/60 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.albums.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-green-400/40 font-bold mb-2 px-1">Albums</h3>
                    {searchResults.albums.slice(0, 4).map((a) => (
                      <button key={a.id} onClick={() => playItem(a.uri)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all group"
                        data-testid={`search-album-${a.id}`}>
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden shadow-lg"
                          style={{ background: a.imageSmall ? `url(${a.imageSmall}) center/cover` : "rgba(255,255,255,0.04)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-white/75 truncate font-medium group-hover:text-white transition-colors">{a.name}</p>
                          <p className="text-xs text-white/25 truncate">{a.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {!searchResults && !searchQuery && (
              <div className="flex flex-col items-center justify-center h-full opacity-15">
                <Search className="h-14 w-14 mb-3" />
                <p className="text-sm font-medium">Search for music</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (browseLoading) {
      return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-green-500/30" /></div>;
    }

    if (activeCategory === "playlists") {
      return (
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-3">
            {playlists.map((p, i) => (
              <button key={p.id} onClick={() => playItem(p.uri)}
                className="flex flex-col rounded-2xl overflow-hidden transition-all text-left group hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  animationDelay: `${i * 40}ms`,
                }}
                data-testid={`playlist-${p.id}`}>
                <div className="aspect-square w-full overflow-hidden relative">
                  <div style={{ background: p.image ? `url(${p.image}) center/cover` : "rgba(255,255,255,0.03)" }}
                    className="w-full h-full group-hover:scale-110 transition-transform duration-500" />
                  {!p.image && <div className="absolute inset-0 flex items-center justify-center"><ListMusic className="h-8 w-8 text-white/6" /></div>}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-xl">
                      <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm text-white/70 truncate font-semibold group-hover:text-white transition-colors">{p.name}</p>
                  <p className="text-[10px] text-white/20 truncate mt-0.5">{p.trackCount} tracks</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "albums") {
      return (
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-3">
            {albums.map((a, i) => (
              <button key={a.id} onClick={() => playItem(a.uri)}
                className="flex flex-col rounded-2xl overflow-hidden transition-all text-left group hover:scale-[1.02] hover:shadow-2xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`album-${a.id}`}>
                <div className="aspect-square w-full overflow-hidden relative">
                  <div style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.03)" }}
                    className="w-full h-full group-hover:scale-110 transition-transform duration-500" />
                  {!a.image && <div className="absolute inset-0 flex items-center justify-center"><Library className="h-8 w-8 text-white/6" /></div>}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-xl">
                      <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm text-white/70 truncate font-semibold group-hover:text-white transition-colors">{a.name}</p>
                  <p className="text-[10px] text-white/20 truncate mt-0.5">{a.artist} {a.year && `· ${a.year}`}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "artists") {
      return (
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-4">
            {artists.map((a) => (
              <button key={a.id} onClick={() => playItem(a.uri)}
                className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-white/[0.04] transition-all group hover:scale-105"
                data-testid={`artist-${a.id}`}>
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/5 group-hover:ring-green-500/20 transition-all shadow-xl"
                  style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.04)" }}>
                  {!a.image && <div className="w-full h-full flex items-center justify-center"><Mic2 className="h-6 w-6 text-white/8" /></div>}
                </div>
                <p className="text-sm text-white/70 truncate w-full text-center font-semibold group-hover:text-white transition-colors">{a.name}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "tracks") {
      return (
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
          {tracks.map((t, i) => (
            <button key={t.id} onClick={() => playTrack(t.uri)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-all group"
              style={{ borderBottom: i < tracks.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
              data-testid={`track-${t.id}`}>
              <span className="text-xs text-white/10 w-5 text-right font-mono">{i + 1}</span>
              <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden shadow-md"
                style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.04)" }} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white/80 truncate font-medium group-hover:text-white transition-colors">{t.name}</p>
                <p className="text-xs text-white/25 truncate">{t.artist}</p>
              </div>
              <span className="text-xs text-white/12 font-mono flex-shrink-0">{formatMs(t.duration)}</span>
              <Play className="h-3.5 w-3.5 text-white/0 group-hover:text-green-400/50 transition-all flex-shrink-0" />
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "recent") {
      return (
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-15">
              <Clock className="h-14 w-14 mb-3" /><p className="text-sm font-medium">No recent tracks</p>
            </div>
          ) : recent.map((track, i) => (
            <a key={i} href={track.trackUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-all group"
              style={{ borderBottom: i < recent.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
              data-testid={`recent-track-${i}`}>
              <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden shadow-md"
                style={{ background: track.albumArtSmall ? `url(${track.albumArtSmall}) center/cover` : "rgba(255,255,255,0.04)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70 truncate group-hover:text-white transition-colors font-medium">{track.name}</p>
                <p className="text-xs text-white/20 truncate">{track.artist}</p>
              </div>
              <span className="text-[10px] text-white/12 flex-shrink-0 font-mono">{timeAgo(track.playedAt)}</span>
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
      style={{ background: "#050508", fontFamily: "'Inter', system-ui, sans-serif" }}
      data-testid="spotify-player-page"
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: nowPlaying?.albumArt ? `url(${nowPlaying.albumArt})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(80px) grayscale(40%) brightness(0.12) saturate(1.4)", transform: "scale(1.4)",
        transition: "background-image 2s ease",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 30% 50%, rgba(29,185,84,0.03) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(29,185,84,0.02) 0%, transparent 50%)",
      }} />

      <div className="relative z-10 flex-1 flex overflow-hidden">

        <div className="flex flex-col py-6" style={{
          width: 190,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.03)",
        }} data-testid="side-menu">
          <div className="px-5 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #1DB954, #1ed760)", boxShadow: "0 0 20px rgba(29,185,84,0.2)" }}>
                <Music2 className="h-4 w-4 text-black" />
              </div>
              <span className="text-sm font-bold text-white/80 tracking-tight">Music</span>
            </div>
          </div>

          <div className="flex-1 px-2">
            {menuItems.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => handleCategorySelect(key)}
                className="flex items-center gap-3 w-full px-4 py-3.5 transition-all text-left rounded-xl mb-0.5"
                style={{
                  color: activeCategory === key ? "#ffffff" : "#ffffff50",
                  background: activeCategory === key ? "rgba(29,185,84,0.08)" : "transparent",
                  borderLeft: activeCategory === key ? "2px solid #1DB954" : "2px solid transparent",
                  boxShadow: activeCategory === key ? "inset 0 0 20px rgba(29,185,84,0.03)" : "none",
                }} data-testid={`menu-${key}`}>
                <Icon style={{
                  width: 18, height: 18,
                  color: activeCategory === key ? "#1DB954" : undefined,
                  filter: activeCategory === key ? "drop-shadow(0 0 4px rgba(29,185,84,0.4))" : "none",
                }} />
                <span style={{ fontSize: 15, fontWeight: activeCategory === key ? 600 : 400 }}>{label}</span>
              </button>
            ))}
          </div>

          {!isEmbedded && (
            <div className="px-2 mt-auto">
              <button onClick={() => {
                const p = new URLSearchParams(window.location.search);
                window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : "");
              }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all text-left"
                style={{ color: "#ffffff30" }}
                data-testid="back-to-dashboard">
                <ChevronLeft style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 14, fontWeight: 400 }}>Back</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden" style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {renderBrowseContent()}
        </div>

        <div className="flex flex-col items-center justify-center" style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.03)",
          background: "rgba(0,0,0,0.15)",
        }}>
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full border-2 border-green-500/20 border-t-green-500/60"
                style={{ animation: "vinylSpin 1s linear infinite" }} />
              <span className="text-[9px] uppercase tracking-[0.3em] text-white/15 font-medium">Connecting</span>
            </div>
          ) : connectionError || notConnected ? (
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <Music2 className="h-10 w-10 text-white/8" />
              </div>
              <div>
                <p className="text-sm text-white/40 font-semibold mb-1">
                  {notConnected ? "Spotify Not Connected" : "Connection Issue"}
                </p>
                <p className="text-xs text-white/15">
                  {notConnected ? "Connect your account" : "Unable to reach Spotify"}
                </p>
              </div>
              {notConnected && (
                <a href="/api/spotify/login"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-black transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #1DB954, #1ed760)", boxShadow: "0 0 25px rgba(29,185,84,0.3)" }}
                  data-testid="connect-spotify">
                  Connect Spotify
                </a>
              )}
              <button onClick={fetchNowPlaying}
                className="px-5 py-2 rounded-full text-xs font-medium text-white/40 hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                data-testid="retry-spotify">
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 w-full px-6">
              <div style={{
                width: "min(240px, 34vh)", height: "min(240px, 34vh)",
                position: "relative",
              }}>
                <VinylDisc albumArt={nowPlaying?.albumArt} isPlaying={isPlaying} />
              </div>

              <div className="text-center w-full">
                <h1 className="text-lg font-bold text-white/90 truncate tracking-tight" data-testid="track-name"
                  style={{ textShadow: isPlaying ? "0 0 30px rgba(255,255,255,0.1)" : "none" }}>
                  {nowPlaying?.name || "Nothing Playing"}
                </h1>
                <p className="text-sm mt-1 truncate font-medium" data-testid="track-artist"
                  style={{ color: isPlaying ? "#1DB954" : "rgba(255,255,255,0.3)" }}>
                  {nowPlaying?.artist || "Play something on Spotify"}
                </p>
                {nowPlaying?.album && (
                  <p className="text-[11px] mt-1 truncate text-white/15 italic" data-testid="track-album">{nowPlaying.album}</p>
                )}
              </div>

              <div className="w-full" style={{ opacity: 0.9 }}>
                <SpectrumBars playing={isPlaying} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        background: "rgba(0,0,0,0.4)",
        borderTop: "1px solid rgba(255,255,255,0.03)",
        backdropFilter: "blur(30px)",
      }} className="relative z-10">
        {nowPlaying?.duration && (
          <div className="w-full px-6 pt-2">
            <div className="relative rounded-full overflow-hidden cursor-pointer group" style={{ height: 3, background: "rgba(255,255,255,0.04)" }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newMs = Math.round(pct * (nowPlaying.duration || 0));
                setLocalProgress(newMs);
              }}
              data-testid="progress-bar">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #1DB954, #1ed760)",
                boxShadow: "0 0 8px rgba(29,185,84,0.4)",
                transition: "width 0.5s linear",
              }} />
              <div className="absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{
                left: `calc(${progressPercent}% - 5px)`, top: -3,
                width: 10, height: 10,
                background: "#1ed760",
                boxShadow: "0 0 10px rgba(29,185,84,0.6)",
              }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/15 font-mono tabular-nums" data-testid="progress-current">{formatMs(localProgress)}</span>
              <span className="text-[9px] text-white/15 font-mono tabular-nums" data-testid="progress-total">{formatMs(nowPlaying.duration)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 py-2.5 px-6">
          <button onClick={handleToggleShuffle}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.04]"
            style={{
              color: shuffleOn ? "#1DB954" : "rgba(255,255,255,0.15)",
              filter: shuffleOn ? "drop-shadow(0 0 4px rgba(29,185,84,0.4))" : "none",
            }}
            data-testid="button-shuffle">
            <Shuffle className="h-4.5 w-4.5" />
          </button>

          <button onClick={() => doAction("previous")} disabled={actionPending}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30 hover:bg-white/[0.04]"
            data-testid="button-previous">
            <SkipBack className="h-5 w-5 text-white/50 fill-white/50" />
          </button>

          <button onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")} disabled={actionPending}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #1DB954, #1ed760)",
              boxShadow: isPlaying
                ? "0 0 30px rgba(29,185,84,0.35), 0 4px 15px rgba(0,0,0,0.4)"
                : "0 0 15px rgba(29,185,84,0.15), 0 4px 10px rgba(0,0,0,0.3)",
            }} data-testid="button-play-pause">
            {actionPending ? (
              <Loader2 className="h-6 w-6 text-black animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6 text-black fill-black" />
            ) : (
              <Play className="h-6 w-6 text-black fill-black ml-0.5" />
            )}
          </button>

          <button onClick={() => doAction("next")} disabled={actionPending}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30 hover:bg-white/[0.04]"
            data-testid="button-next">
            <SkipForward className="h-5 w-5 text-white/50 fill-white/50" />
          </button>

          <button onClick={handleToggleRepeat}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all relative hover:bg-white/[0.04]"
            style={{
              color: repeatMode !== "off" ? "#1DB954" : "rgba(255,255,255,0.15)",
              filter: repeatMode !== "off" ? "drop-shadow(0 0 4px rgba(29,185,84,0.4))" : "none",
            }}
            data-testid="button-repeat">
            <Repeat className="h-4.5 w-4.5" />
            {repeatMode === "track" && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[7px] font-black flex items-center justify-center"
                style={{ background: "#1DB954", color: "black", boxShadow: "0 0 6px rgba(29,185,84,0.5)" }}>1</span>
            )}
          </button>

          <div className="w-px h-6 mx-2" style={{ background: "rgba(255,255,255,0.04)" }} />

          <button onClick={() => setShowVolume(!showVolume)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.04]"
            style={{
              color: showVolume ? "#1DB954" : "rgba(255,255,255,0.15)",
              filter: showVolume ? "drop-shadow(0 0 4px rgba(29,185,84,0.3))" : "none",
            }}
            data-testid="toggle-volume">
            <Volume2 className="h-4.5 w-4.5" />
          </button>

          {showVolume && (
            <div className="flex items-center gap-2" data-testid="volume-slider-container">
              <VolumeX className="h-3.5 w-3.5 text-white/15 cursor-pointer hover:text-white/40 transition-colors flex-shrink-0"
                onClick={() => handleVolumeChange(0)} />
              <div className="relative h-8 flex items-center cursor-pointer" style={{ width: 100 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                  handleVolumeChange(Math.round(pct));
                }}>
                <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${volume}%`,
                    background: "linear-gradient(90deg, #1DB954, #1ed760)",
                    boxShadow: "0 0 6px rgba(29,185,84,0.3)",
                  }} />
                </div>
              </div>
              <span className="text-[9px] text-white/15 font-mono w-7 text-right tabular-nums">{volume}%</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes vinylSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .vinyl-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .vinyl-container:hover .vinyl-outer {
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
}
