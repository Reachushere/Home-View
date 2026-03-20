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
    setActiveCategory(cat);
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
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search className="h-5 w-5 text-white/30 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search songs, artists, albums..."
                className="flex-1 bg-transparent text-base text-white/90 placeholder:text-white/20 outline-none"
                autoFocus data-testid="search-input" />
              {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-white/20" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
            {searchResults && (
              <>
                {searchResults.tracks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs uppercase tracking-[0.15em] text-white/25 font-semibold mb-2 px-1">Tracks</h3>
                    {searchResults.tracks.slice(0, 6).map((t) => (
                      <button key={t.id} onClick={() => playTrack(t.uri)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                        data-testid={`search-track-${t.id}`}>
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                          style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-white/80 truncate font-medium">{t.name}</p>
                          <p className="text-xs text-white/30 truncate">{t.artist}</p>
                        </div>
                        <span className="text-xs text-white/15 font-mono">{formatMs(t.duration)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.albums.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs uppercase tracking-[0.15em] text-white/25 font-semibold mb-2 px-1">Albums</h3>
                    {searchResults.albums.slice(0, 4).map((a) => (
                      <button key={a.id} onClick={() => playItem(a.uri)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                        data-testid={`search-album-${a.id}`}>
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                          style={{ background: a.imageSmall ? `url(${a.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-white/80 truncate font-medium">{a.name}</p>
                          <p className="text-xs text-white/30 truncate">{a.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.artists.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs uppercase tracking-[0.15em] text-white/25 font-semibold mb-2 px-1">Artists</h3>
                    {searchResults.artists.slice(0, 4).map((a) => (
                      <button key={a.id} onClick={() => playItem(a.uri)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                        data-testid={`search-artist-${a.id}`}>
                        <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden"
                          style={{ background: a.imageSmall ? `url(${a.imageSmall}) center/cover` : "rgba(255,255,255,0.05)" }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-white/80 truncate font-medium">{a.name}</p>
                          <p className="text-xs text-white/30 truncate">{a.genres?.slice(0, 2).join(", ")}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {!searchResults && !searchQuery && (
              <div className="flex flex-col items-center justify-center h-full opacity-20">
                <Search className="h-12 w-12 mb-3" />
                <p className="text-sm">Search for music</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (browseLoading) {
      return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/15" /></div>;
    }

    if (activeCategory === "playlists") {
      return (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-3">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => playItem(p.uri)}
                className="flex flex-col rounded-xl overflow-hidden hover:bg-white/[0.06] transition-all text-left group"
                style={{ background: "rgba(255,255,255,0.02)" }}
                data-testid={`playlist-${p.id}`}>
                <div className="aspect-square w-full overflow-hidden rounded-t-xl"
                  style={{ background: p.image ? `url(${p.image}) center/cover` : "rgba(255,255,255,0.04)" }}>
                  {!p.image && <div className="w-full h-full flex items-center justify-center"><ListMusic className="h-8 w-8 text-white/8" /></div>}
                </div>
                <div className="p-2.5">
                  <p className="text-sm text-white/70 truncate font-medium group-hover:text-white/90 transition-colors">{p.name}</p>
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
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-3">
            {albums.map((a) => (
              <button key={a.id} onClick={() => playItem(a.uri)}
                className="flex flex-col rounded-xl overflow-hidden hover:bg-white/[0.06] transition-all text-left group"
                style={{ background: "rgba(255,255,255,0.02)" }}
                data-testid={`album-${a.id}`}>
                <div className="aspect-square w-full overflow-hidden rounded-t-xl"
                  style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.04)" }}>
                  {!a.image && <div className="w-full h-full flex items-center justify-center"><Library className="h-8 w-8 text-white/8" /></div>}
                </div>
                <div className="p-2.5">
                  <p className="text-sm text-white/70 truncate font-medium group-hover:text-white/90 transition-colors">{a.name}</p>
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
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-4">
            {artists.map((a) => (
              <button key={a.id} onClick={() => playItem(a.uri)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                data-testid={`artist-${a.id}`}>
                <div className="w-20 h-20 rounded-full overflow-hidden"
                  style={{ background: a.image ? `url(${a.image}) center/cover` : "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.06)" }}>
                  {!a.image && <div className="w-full h-full flex items-center justify-center"><Mic2 className="h-6 w-6 text-white/8" /></div>}
                </div>
                <p className="text-sm text-white/70 truncate w-full text-center font-medium group-hover:text-white/90 transition-colors">{a.name}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeCategory === "tracks") {
      return (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {tracks.map((t, i) => (
            <button key={t.id} onClick={() => playTrack(t.uri)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-colors"
              style={{ borderBottom: i < tracks.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              data-testid={`track-${t.id}`}>
              <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                style={{ background: t.imageSmall ? `url(${t.imageSmall}) center/cover` : "rgba(255,255,255,0.04)" }} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white/80 truncate font-medium">{t.name}</p>
                <p className="text-xs text-white/30 truncate">{t.artist}</p>
              </div>
              <span className="text-xs text-white/15 font-mono flex-shrink-0">{formatMs(t.duration)}</span>
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === "recent") {
      return (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20">
              <Clock className="h-12 w-12 mb-3" /><p className="text-sm">No recent tracks</p>
            </div>
          ) : recent.map((track, i) => (
            <a key={i} href={track.trackUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
              style={{ borderBottom: i < recent.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              data-testid={`recent-track-${i}`}>
              <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                style={{ background: track.albumArtSmall ? `url(${track.albumArtSmall}) center/cover` : "rgba(255,255,255,0.04)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70 truncate group-hover:text-white transition-colors font-medium">{track.name}</p>
                <p className="text-xs text-white/25 truncate">{track.artist}</p>
              </div>
              <span className="text-[10px] text-white/15 flex-shrink-0 font-mono">{timeAgo(track.playedAt)}</span>
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
      style={{ background: "#0d0d12", fontFamily: "'Inter', system-ui, sans-serif" }}
      data-testid="spotify-player-page"
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: nowPlaying?.albumArt ? `url(${nowPlaying.albumArt})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(60px) grayscale(50%) brightness(0.15) saturate(1.2)", transform: "scale(1.3)",
        transition: "background-image 1.5s ease",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.45)" }} />

      <div className="relative z-10 flex-1 flex overflow-hidden">

        <div className="flex flex-col py-8 px-2" style={{
          width: 200,
          flexShrink: 0,
          background: "rgba(0,0,0,0.25)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
        }} data-testid="side-menu">
          {menuItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => handleCategorySelect(key)}
              className="flex items-center gap-3 w-full px-5 py-4 transition-all text-left"
              style={{
                color: activeCategory === key ? "#ffffffd0" : "#ffffff60",
                background: activeCategory === key ? "rgba(255,255,255,0.06)" : "transparent",
                borderRadius: 12,
              }} data-testid={`menu-${key}`}>
              <Icon style={{ width: 22, height: 22, opacity: activeCategory === key ? 1 : 0.5 }} />
              <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{label}</span>
            </button>
          ))}

          <div className="flex-1" />

          {!isEmbedded && (
            <button onClick={() => {
              const p = new URLSearchParams(window.location.search);
              window.location.href = "/" + (p.get("auth") ? `?auth=${p.get("auth")}` : "");
            }}
              className="flex items-center gap-3 w-full px-5 py-4 transition-all text-left"
              style={{ color: "#ffffff40", borderRadius: 12 }}
              data-testid="back-to-dashboard">
              <ChevronLeft style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 18, fontWeight: 500 }}>Back</span>
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {renderBrowseContent()}
        </div>

        <div className="flex flex-col items-center justify-center px-6" style={{
          width: 340,
          flexShrink: 0,
          background: "rgba(0,0,0,0.2)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
        }}>
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: "rgba(255,255,255,0.15)" }} />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/15">Connecting</span>
            </div>
          ) : connectionError || notConnected ? (
            <div className="flex flex-col items-center gap-4 text-center px-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <Music2 className="h-10 w-10 text-white/10" />
              </div>
              <div>
                <p className="text-sm text-white/40 font-medium mb-1">
                  {notConnected ? "Spotify Not Connected" : "Connection Issue"}
                </p>
                <p className="text-xs text-white/20">
                  {notConnected ? "Connect your account" : "Unable to reach Spotify"}
                </p>
              </div>
              <div className="flex gap-2">
                {notConnected && (
                  <a href="/api/spotify/login"
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-black transition-all hover:scale-105"
                    style={{ background: "#1DB954" }}
                    data-testid="connect-spotify">
                    Connect
                  </a>
                )}
                <button onClick={fetchNowPlaying}
                  className="px-5 py-2.5 rounded-full text-xs font-medium text-white/50 hover:text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                  data-testid="retry-spotify">
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="rounded-2xl overflow-hidden" style={{
                width: "min(260px, 38vh)", height: "min(260px, 38vh)",
                boxShadow: isPlaying
                  ? "0 12px 60px rgba(0,0,0,0.7), 0 0 30px rgba(255,255,255,0.02)"
                  : "0 8px 40px rgba(0,0,0,0.5)",
                transition: "box-shadow 0.5s",
              }}>
                {nowPlaying?.albumArt ? (
                  <img src={nowPlaying.albumArt} alt={nowPlaying.album || ""}
                    className="w-full h-full object-cover" data-testid="album-art" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
                    <Music2 className="h-14 w-14 text-white/8" />
                  </div>
                )}
              </div>

              <div className="text-center w-full px-2">
                <h1 className="text-xl font-bold text-white/90 truncate" data-testid="track-name">
                  {nowPlaying?.name || "Nothing Playing"}
                </h1>
                <p className="text-base mt-1 truncate text-white/50 font-medium" data-testid="track-artist">
                  {nowPlaying?.artist || "Play something on Spotify"}
                </p>
                {nowPlaying?.album && (
                  <p className="text-xs mt-1 truncate text-white/20 italic" data-testid="track-album">{nowPlaying.album}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        background: "rgba(0,0,0,0.35)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
      }} className="relative z-10">
        {nowPlaying?.duration && (
          <div className="w-full px-6">
            <div className="relative rounded-full overflow-hidden cursor-pointer" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newMs = Math.round(pct * (nowPlaying.duration || 0));
                setLocalProgress(newMs);
              }}
              data-testid="progress-bar">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{
                width: `${progressPercent}%`, background: "#ffffffb0",
                transition: "width 0.5s linear",
              }} />
            </div>
            <div className="flex justify-between mt-1 mb-1">
              <span className="text-[10px] text-white/20 font-mono tabular-nums" data-testid="progress-current">{formatMs(localProgress)}</span>
              <span className="text-[10px] text-white/20 font-mono tabular-nums" data-testid="progress-total">{formatMs(nowPlaying.duration)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 py-3 px-6">
          <button onClick={handleToggleShuffle}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.06]"
            style={{ color: shuffleOn ? "#ffffffd0" : "rgba(255,255,255,0.2)" }}
            data-testid="button-shuffle">
            <Shuffle className="h-5 w-5" />
          </button>

          <button onClick={() => doAction("previous")} disabled={actionPending}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30 hover:bg-white/[0.06]"
            data-testid="button-previous">
            <SkipBack className="h-6 w-6 text-white/60 fill-white/60" />
          </button>

          <button onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")} disabled={actionPending}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
            }} data-testid="button-play-pause">
            {actionPending ? (
              <Loader2 className="h-7 w-7 text-white/80 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-7 w-7 text-white/90 fill-white/90" />
            ) : (
              <Play className="h-7 w-7 text-white/90 fill-white/90 ml-1" />
            )}
          </button>

          <button onClick={() => doAction("next")} disabled={actionPending}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-30 hover:bg-white/[0.06]"
            data-testid="button-next">
            <SkipForward className="h-6 w-6 text-white/60 fill-white/60" />
          </button>

          <button onClick={handleToggleRepeat}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all relative hover:bg-white/[0.06]"
            style={{ color: repeatMode !== "off" ? "#ffffffd0" : "rgba(255,255,255,0.2)" }}
            data-testid="button-repeat">
            <Repeat className="h-5 w-5" />
            {repeatMode === "track" && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full text-[7px] font-bold flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.8)", color: "#0d0d12" }}>1</span>
            )}
          </button>

          <div className="w-px h-8 mx-2" style={{ background: "rgba(255,255,255,0.06)" }} />

          <button onClick={() => setShowVolume(!showVolume)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.06]"
            style={{ color: showVolume ? "#ffffffa0" : "rgba(255,255,255,0.25)" }}
            data-testid="toggle-volume">
            <Volume2 className="h-5 w-5" />
          </button>

          {showVolume && (
            <div className="flex items-center gap-2" data-testid="volume-slider-container">
              <VolumeX className="h-3.5 w-3.5 text-white/20 cursor-pointer hover:text-white/50 transition-colors flex-shrink-0"
                onClick={() => handleVolumeChange(0)} />
              <div className="relative h-8 flex items-center cursor-pointer" style={{ width: 120 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                  handleVolumeChange(Math.round(pct));
                }}>
                <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${volume}%`, background: "rgba(255,255,255,0.5)",
                  }} />
                </div>
              </div>
              <span className="text-[10px] text-white/20 font-mono w-7 text-right">{volume}%</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
      `}</style>
    </div>
  );
}
