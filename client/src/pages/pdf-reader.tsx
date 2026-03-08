import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RotateCcw,
  RotateCw,
  Pencil,
  Check,
  X,
  Cast,
  Monitor,
  Speaker,
  Headphones,
  Search,
  Replace,
  ChevronUp,
  ChevronDown,
  Mic,
  Maximize2,
  Minimize2
} from "lucide-react";
import type { FileRecord } from "@shared/schema";
import { getWeekNumber } from "@shared/schema";
import tmuBgPath from "@assets/TMU2_1772842397746.png";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SPEAKERS = [
  { id: "browser_tts", name: "Bluetooth" },
  { id: "media_player.byhome", name: "Apartment" },
  { id: "media_player.cat_wash", name: "Cat Wash" },
  { id: "media_player.cat_wr", name: "Cat Washroom Speakers" },
  { id: "media_player.echo_cat_left_am", name: "Cat Washroom Left" },
  { id: "media_player.echo_cat_right_am", name: "Cat Washroom Right" },
  { id: "media_player.echo_cat_washroom_middle", name: "Cat Washroom Middle" },
  { id: "media_player.echo_closet_am", name: "Closet" },
  { id: "media_player.echo_lr_couch_r_am", name: "Echo Corner" },
  { id: "media_player.echo_hallway_entrance_am", name: "Hallway Entrance" },
  { id: "media_player.echo_king_l_am", name: "King Left" },
  { id: "media_player.echo_king_r_am", name: "King Right" },
  { id: "media_player.echo_king_tv_am", name: "King TV" },
  { id: "media_player.echo_kitchen_cupboards_left_am", name: "Kitchen Cupboards Left" },
  { id: "media_player.echo_kitchen_cupboards_r_am", name: "Kitchen Cupboards Right" },
  { id: "media_player.echo_kitchen_fridge_am", name: "Kitchen Fridge" },
  { id: "media_player.echo_kitchen_hutch_am", name: "Kitchen Hutch" },
  { id: "media_player.echo_kitchen_island_corner_am", name: "Kitchen Island Corner" },
  { id: "media_player.echo_kitchen_studio_black_am", name: "Kitchen Studio Black" },
  { id: "media_player.echo_lr_couch_l_am", name: "Living Room Couch Left" },
  { id: "media_player.echo_lr_hub_am", name: "Living Room Hub" },
  { id: "media_player.echo_lr_studio_white_am", name: "Living Room Studio White" },
  { id: "media_player.echo_lr_tv_shelf_am", name: "Living Room TV Shelf" },
  { id: "media_player.echo_queen_balcony_am", name: "Queen Balcony" },
  { id: "media_player.echo_queen_bed_l_am", name: "Queen Bed Left" },
  { id: "media_player.echo_queen_bed_r_am", name: "Queen Bed Right" },
  { id: "media_player.echo_show_pug_am", name: "Echo Show Pug" },
  { id: "media_player.everywhere_2", name: "Everywhere" },
  { id: "media_player.hallway", name: "Hallway" },
  { id: "media_player.king_bedroom", name: "King Bedroom" },
  { id: "media_player.queen_bedroom", name: "Queen Bedroom" },
];

type Voice = "alloy" | "ash" | "echo" | "fable" | "onyx";

const VOICE_LABELS: Record<Voice, string> = {
  alloy: "Alloy - English (Neutral)",
  ash: "Ash - English (Male, Warm)",
  echo: "Echo - English (Male, Clear)",
  fable: "Fable - English (Male, British)",
  onyx: "Onyx - English (Male, Deep)",
};

export default function PDFReaderPage() {
  const [, params] = useRoute("/pdf-reader/:fileId");
  const [isOneDriveRoute] = useRoute("/pdf-reader/onedrive");
  const fileId = params?.fileId && params.fileId !== "onedrive" ? parseInt(params.fileId) : null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const oneDriveUrl = urlParams.get("url");
  const oneDriveName = urlParams.get("name");
  const filesParam = urlParams.get("files");
  const courseParam = urlParams.get("course");
  const autoplayParam = urlParams.get("autoplay") === "true";
  const speakerParam = urlParams.get("speaker");
  const resumeChunkParam = urlParams.get("resumeChunk") ? parseInt(urlParams.get("resumeChunk")!) : null;
  const catWashFollow = urlParams.get("catWashFollow") === "true";
  const followOnly = urlParams.get("followOnly") === "true";
  const [autoplayTriggered, setAutoplayTriggered] = useState(() => {
    if (!autoplayParam) return false;
    const key = `autoplay_consumed_${fileId}_${resumeChunkParam}`;
    return sessionStorage.getItem(key) === 'true';
  });

  useEffect(() => {
    const myId = Date.now().toString() + Math.random().toString(36).slice(2);
    try { localStorage.setItem('pdf-reader-instance', myId); } catch {}
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pdf-reader-instance' && e.newValue && e.newValue !== myId) {
        try { window.location.href = 'about:blank'; } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (fileId || isOneDriveRoute || oneDriveUrl) return;
    Promise.all([
      fetch("/api/files").then(r => r.json()),
      fetch("/api/semester", { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([files, semSettings]: [any[], any]) => {
      let weekNum = 1;
      if (semSettings?.semesterStartDate) {
        weekNum = getWeekNumber(new Date(), new Date(semSettings.semesterStartDate), semSettings.readingWeekStart);
      }
      const isPartial = (f: any) => {
        if (f.listened) return false;
        const hasChunks = (() => { if (!f.checkedChunks) return false; try { const a = JSON.parse(f.checkedChunks); return Array.isArray(a) && a.length > 0; } catch { return false; } })();
        const hasLast = f.lastChunkIndex != null && f.lastChunkIndex > 0;
        if (!hasChunks && !hasLast) return false;
        if (f.totalChunks && f.totalChunks > 0) {
          if (hasChunks) { try { if (JSON.parse(f.checkedChunks).length >= f.totalChunks) return false; } catch {} }
          if (hasLast && f.lastChunkIndex >= f.totalChunks) return false;
        }
        return true;
      };
      const partials = files.filter(isPartial);
      const weekFiles = files.filter((f: any) => {
        if (f.listened) return false;
        if (partials.some((p: any) => p.id === f.id)) return false;
        const m = f.folder?.match(/week-(\d+)/i);
        return m && parseInt(m[1], 10) === weekNum;
      });
      const best = [...partials, ...weekFiles][0];
      if (best) {
        window.location.replace(`/pdf-reader/${best.id}`);
      }
    }).catch(() => {});
  }, []);

  const [followState, setFollowState] = useState<{
    active: boolean;
    chunkIndex: number;
    totalChunks: number;
    chunkText: string;
    words: string[];
    estimatedWordIndex: number;
    progress: number;
    fileName: string;
  } | null>(null);
  
  // Parse files list for dropdown
  const [allFiles, setAllFiles] = useState<Array<{name: string; downloadUrl: string; path: string}>>([]);
  const [currentFileUrl, setCurrentFileUrl] = useState<string>(oneDriveUrl ? decodeURIComponent(oneDriveUrl) : '');
  const [currentFileName, setCurrentFileName] = useState<string>(oneDriveName ? decodeURIComponent(oneDriveName) : '');
  const [listenedFiles, setListenedFiles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('listenedOneDriveFiles');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  useEffect(() => {
    if (filesParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filesParam));
        setAllFiles(parsed);
      } catch (e) {
        console.error('Failed to parse files param:', e);
      }
    }
  }, [filesParam]);

  const [numPages, setNumPages] = useState<number>(0);
  const numPagesRef = useRef<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfContainerHeight, setPdfContainerHeight] = useState<number>(0);
  const [extractedText, setExtractedText] = useState<string>("");
  const extractedTextRef = useRef<string>("");
  useEffect(() => { extractedTextRef.current = extractedText; }, [extractedText]);
  const pdfUrlRef = useRef<string | undefined | null>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [voice, setVoice] = useState<Voice>(() => {
    const saved = localStorage.getItem('pdf-reader-voice');
    return (saved && ["alloy","ash","echo","fable","onyx"].includes(saved) ? saved : "echo") as Voice;
  });
  const [isFullPage, setIsFullPage] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [chunkWords, setChunkWords] = useState<string[]>([]);
  const [checkedChunks, setCheckedChunks] = useState<Set<number>>(new Set());
  const [chunksList, setChunksList] = useState<string[]>([]);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editableText, setEditableText] = useState("");
  const [editingChunkIndex, setEditingChunkIndex] = useState<number | null>(null);
  const [editableChunkText, setEditableChunkText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ttsPreloadCache = useRef<Record<number, string>>({});
  const voiceRef = useRef<string>(voice);
  const [showFlickMenu, setShowFlickMenu] = useState(false);
  const [flickDeviceGroups, setFlickDeviceGroups] = useState<Array<{room: string; icon: string; devices: Array<{id: string; name: string; entityId: string; type: string; canDisplay: boolean; room: string}>}>>([]);
  const [isFlicking, setIsFlicking] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState("browser_tts");
  const selectedSpeakerRef = useRef("browser_tts");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
  const pdfDocRef = useRef<any>(null);
  const isExtractingRef = useRef(false);
  const audioDurationRef = useRef<number>(0);
  const currentChunkRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const playingAttentionPromptRef = useRef<boolean>(false);
  const playbackSpeedRef = useRef<number>(1);
  const volumeRef = useRef<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const [waveBarHeights, setWaveBarHeights] = useState<number[]>(new Array(20).fill(0));
  const waveAnimRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const { toast } = useToast();

  const previewVoice = async () => {
    if (isPreviewing) {
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
      setIsPreviewing(false);
      return;
    }
    setIsPreviewing(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello, this is a preview of the selected voice.', voice }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volumeRef.current;
      audio.playbackRate = playbackSpeedRef.current;
      previewAudioRef.current = audio;
      audio.onended = () => { setIsPreviewing(false); previewAudioRef.current = null; };
      await audio.play();
    } catch {
      setIsPreviewing(false);
      toast({ title: 'Preview failed', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const initVisualizer = () => {
      if (audioContextRef.current) return;
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch (e) {
        console.warn('[Visualizer] Init failed:', e);
      }
    };

    const drawWaveform = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) {
        animFrameRef.current = requestAnimationFrame(drawWaveform);
        return;
      }

      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      canvasCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const bufLen = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, w, h);

      const barCount = 80;
      const gap = 3;
      const totalBarWidth = w - (barCount - 1) * gap;
      const barWidth = Math.max(2, totalBarWidth / barCount);
      const centerY = h / 2;

      for (let i = 0; i < barCount; i++) {
        const dataIdx = Math.floor((i / barCount) * bufLen);
        const val = dataArray[dataIdx] / 255;
        const barH = Math.max(2, val * centerY * 0.85);

        const x = i * (barWidth + gap);
        const alpha = 0.3 + val * 0.7;
        const lightness = 70 + val * 30;

        canvasCtx.fillStyle = `hsla(200, 90%, ${Math.round(lightness)}%, ${alpha.toFixed(2)})`;
        canvasCtx.shadowColor = `hsla(200, 100%, 80%, ${(val * 0.6).toFixed(2)})`;
        canvasCtx.shadowBlur = val * 15;

        canvasCtx.beginPath();
        canvasCtx.roundRect(Math.round(x), Math.round(centerY - barH), Math.round(barWidth), Math.round(barH), 2);
        canvasCtx.fill();
        canvasCtx.beginPath();
        canvasCtx.roundRect(Math.round(x), Math.round(centerY + 1), Math.round(barWidth), Math.round(barH), 2);
        canvasCtx.fill();

        canvasCtx.shadowBlur = 0;
      }

      animFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    const onPlay = () => {
      initVisualizer();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    const onPauseEnd = () => {
      setTimeout(() => {
        cancelAnimationFrame(animFrameRef.current);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }, 100);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPauseEnd);
    audio.addEventListener('ended', onPauseEnd);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPauseEnd);
      audio.removeEventListener('ended', onPauseEnd);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    fetch("/api/flick/rooms")
      .then(r => r.json())
      .then(setFlickDeviceGroups)
      .catch(() => {});
  }, []);

  const unlockAudioRef = useRef(false);
  const unlockAudio = async () => {
    if (unlockAudioRef.current) return;
    unlockAudioRef.current = true;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        if (ctx.state === 'suspended') await ctx.resume();
        console.log("[Autoplay] AudioContext unlocked:", ctx.state);
      }
      if (audioRef.current) {
        audioRef.current.muted = true;
        audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        await audioRef.current.play().catch(() => {});
        audioRef.current.pause();
        audioRef.current.muted = false;
        audioRef.current.src = "";
        console.log("[Autoplay] Audio element unlocked");
      }
    } catch (e) {
      console.log("[Autoplay] Audio unlock attempt:", e);
    }
  };

  useEffect(() => {
    if (!followOnly && !(catWashFollow && !autoplayParam)) return;
    console.log("[FollowOnly] Starting progress polling for display");
    const poll = async () => {
      try {
        const resp = await fetch("/api/cat-wash/progress");
        const data = await resp.json();
        if (data.active) {
          setFollowState({
            active: true,
            chunkIndex: data.chunkIndex || 0,
            totalChunks: data.totalChunks || 1,
            chunkText: data.chunkText || '',
            words: data.words || [],
            estimatedWordIndex: data.wordIndex || 0,
            progress: 0,
            fileName: data.fileName || '',
          });
        } else {
          setFollowState(null);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [followOnly]);

  const lastNavTimestamp = useRef(() => {
    try { return Number(localStorage.getItem('lastNavTimestamp') || '0'); } catch { return 0; }
  });
  useEffect(() => {
    const isFireDevice = /\bSilk\b/i.test(navigator.userAgent) || /\bKF[A-Z]{2,4}\b/.test(navigator.userAgent) || /\bFireTV\b/i.test(navigator.userAgent) || /\bAFT[A-Z]\b/.test(navigator.userAgent);
    if (!isFireDevice) return;
    const saved = lastNavTimestamp.current;
    lastNavTimestamp.current = typeof saved === 'function' ? saved() : saved;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/tablet-nav');
        const data = await resp.json();
        if (data.timestamp <= lastNavTimestamp.current) return;
        if (Date.now() - data.timestamp > 30000) return;
        if (data.action === 'navigate' && data.url) {
          lastNavTimestamp.current = data.timestamp;
          try { localStorage.setItem('lastNavTimestamp', String(data.timestamp)); } catch {}
          fetch('/api/tablet-nav/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: data.timestamp }) }).catch(() => {});
          window.location.href = data.url;
        } else if (data.action === 'go_home') {
          lastNavTimestamp.current = data.timestamp;
          try { localStorage.setItem('lastNavTimestamp', String(data.timestamp)); } catch {}
          fetch('/api/tablet-nav/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: data.timestamp }) }).catch(() => {});
          window.location.href = '/';
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleFlick = async (deviceId: string) => {
    if (!fileId) {
      toast({ title: "Can't flick", description: "Flick only works with stored files, not OneDrive links." });
      return;
    }
    setIsFlicking(true);
    try {
      if (isPlaying && currentChunkRef.current > 0) {
        await fetch(`/api/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastChunkIndex: currentChunkRef.current,
            totalChunks
          })
        });
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsPaused(false);
      isPausedRef.current = false;

      const resp = await fetch("/api/flick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          fileId,
          currentChunkIndex: currentChunkRef.current,
          totalChunks
        })
      });
      const data = await resp.json();
      if (data.success) {
        toast({
          title: `Flicked to ${data.device}`,
          description: data.canDisplay
            ? `Opening on ${data.device} in ${data.room}`
            : `Playing on ${data.device} in ${data.room}`
        });
      } else {
        toast({ title: "Flick failed", description: data.error || "Unknown error" });
      }
    } catch (e: any) {
      toast({ title: "Flick failed", description: e.message });
    } finally {
      setIsFlicking(false);
      setShowFlickMenu(false);
    }
  };

  const [moduleFiles, setModuleFiles] = useState<FileRecord[]>([]);
  const [readingFiles, setReadingFiles] = useState<FileRecord[]>([]);

  const { data: file, isLoading: fileLoading } = useQuery<FileRecord>({
    queryKey: ["/api/files", fileId],
    queryFn: async () => {
      const response = await fetch(`/api/files/${fileId}`);
      if (!response.ok) throw new Error("Failed to fetch file");
      return response.json();
    },
    enabled: !!fileId && !isOneDriveRoute,
  });

  useEffect(() => {
    if (!file?.folder) return;
    const parts = file.folder.split('-');
    if (parts.length < 3) return;
    const weekNum = parts[1];
    const courseCode = parts[2];
    fetch('/api/files')
      .then(r => r.json())
      .then((allDbFiles: FileRecord[]) => {
        const mods = allDbFiles.filter(f => f.folder?.includes(`week-${weekNum}-${courseCode}`) && f.folder?.includes('module'));
        const reads = allDbFiles.filter(f => f.folder?.includes(`week-${weekNum}-${courseCode}`) && f.folder?.includes('reading'));
        setModuleFiles(mods);
        setReadingFiles(reads);
      })
      .catch(() => {});
  }, [file?.folder]);
  
  const isOneDrive = isOneDriveRoute && oneDriveUrl;
  const pdfUrl = isOneDrive
    ? (currentFileUrl || decodeURIComponent(oneDriveUrl))
    : fileId
      ? `/api/files/${fileId}/download`
      : file?.objectPath;
  pdfUrlRef.current = pdfUrl;
  const rawFileName = isOneDrive ? (currentFileName || (oneDriveName ? decodeURIComponent(oneDriveName) : "OneDrive PDF")) : file?.displayName;
  const fileName = (() => {
    if (!rawFileName) return rawFileName;
    let clean = rawFileName
      .replace(/^CPPA\s*122[-_\s.]*/i, '')
      .replace(/^CFNF\s*400[-_\s.]*/i, '')
      .replace(/^CASL\s*101[-_\s.]*/i, '')
      .replace(/^CSOC\s*103[-_\s.]*/i, '')
      .replace(/^CPHL\s*110[-_\s.]*/i, '')
      .replace(/^CASL\s*201[-_\s.]*/i, '')
      .replace(/Reading\s*\d*[-_:\s.]*/gi, '')
      .replace(/\.pdf$/i, '')
      .trim();
    while (clean.match(/^[.\s\-_:•·]/)) {
      clean = clean.replace(/^[.\s\-_:•·]+/, '').trim();
    }
    return clean || rawFileName;
  })();
  
  // Mark current file as listened when playing
  const markCurrentFileListened = () => {
    if (currentFileUrl || oneDriveUrl) {
      const fileKey = currentFileUrl || (oneDriveUrl ? decodeURIComponent(oneDriveUrl) : '');
      const currentFile = allFiles.find(f => f.downloadUrl === fileKey);
      if (currentFile?.path) {
        const newListened = new Set(listenedFiles);
        newListened.add(currentFile.path);
        setListenedFiles(newListened);
        localStorage.setItem('listenedOneDriveFiles', JSON.stringify(Array.from(newListened)));
      }
    }
  };
  
  const getFileKey = () => {
    if (fileId) return `file_${fileId}`;
    const url = currentFileUrl || (oneDriveUrl ? decodeURIComponent(oneDriveUrl) : '');
    return `onedrive_${btoa(url).slice(0, 40)}`;
  };

  useEffect(() => {
    if (autoplayParam && !autoplayTriggered && pdfUrl && numPages > 0) {
      setAutoplayTriggered(true);
      const key = `autoplay_consumed_${fileId}_${resumeChunkParam}`;
      try { sessionStorage.setItem(key, 'true'); } catch {}
      const doAutoplay = async () => {
        await unlockAudio();
        console.log("[Autoplay] Starting playback - numPages=" + numPages);
        startReading();
      };
      const delay = setTimeout(doAutoplay, 500);
      return () => clearTimeout(delay);
    }
  }, [autoplayParam, autoplayTriggered, pdfUrl, numPages]);

  const loadCheckedChunks = (key: string): Set<number> => {
    const saved = localStorage.getItem(`checkedChunks_${key}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  };

  const saveCheckedChunks = (key: string, checked: Set<number>, total: number) => {
    localStorage.setItem(`checkedChunks_${key}`, JSON.stringify(Array.from(checked)));
    localStorage.setItem(`chunkProgress_${key}`, JSON.stringify({ checked: checked.size, total }));
    const allProgress = JSON.parse(localStorage.getItem('allChunkProgress') || '{}');
    allProgress[key] = { checked: checked.size, total };
    localStorage.setItem('allChunkProgress', JSON.stringify(allProgress));
  };

  const toggleChunkChecked = (idx: number) => {
    const key = getFileKey();
    const newChecked = new Set(checkedChunks);
    if (newChecked.has(idx)) {
      newChecked.delete(idx);
    } else {
      for (let i = 0; i <= idx; i++) {
        newChecked.add(i);
      }
    }
    setCheckedChunks(newChecked);
    saveCheckedChunks(key, newChecked, totalChunks);
    if (fileId) {
      fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkedChunks: JSON.stringify(Array.from(newChecked)),
          totalChunks,
          lastChunkIndex: Math.max(...Array.from(newChecked), 0),
        }),
      }).catch(() => {});
    }
  };

  const jumpToUnlistened = () => {
    const firstUnchecked = chunksList.findIndex((_, idx) => !checkedChunks.has(idx));
    if (firstUnchecked >= 0) {
      const el = document.querySelector(`[data-testid="chunk-row-${firstUnchecked}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const chunkProgress = totalChunks > 0 ? Math.round((checkedChunks.size / totalChunks) * 100) : 0;

  const searchMatchCount = (() => {
    if (searchQuery.trim().length < 2) return 0;
    const q = searchQuery.toLowerCase().trim();
    let count = 0;
    for (const chunk of chunksList) {
      let pos = 0;
      const lower = chunk.toLowerCase();
      while ((pos = lower.indexOf(q, pos)) !== -1) { count++; pos += 1; }
    }
    return count;
  })();

  // Switch to a different file
  const switchToFile = (file: {name: string; downloadUrl: string; path: string}) => {
    setCurrentFileUrl(file.downloadUrl);
    setCurrentFileName(file.name);
    setCurrentPage(1);
    setNumPages(0);
    numPagesRef.current = 0;
    setExtractedText('');
    setIsPlaying(false);
    setIsPaused(false);
    setIsPreloading(false);
    setTotalChunks(0);
    setCheckedChunks(new Set());
    setChunksList([]);
    chunksRef.current = [];
    pdfDocRef.current = null;
    isExtractingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  };

  const onDocumentLoadSuccess = async ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    numPagesRef.current = pages;
    setCurrentPage(1);
    
    const key = getFileKey();
    const TTS_CACHE_VERSION = "v2";
    const savedText = localStorage.getItem(`tts_edited_${TTS_CACHE_VERSION}_${key}`);
    if (savedText) {
      setExtractedText(savedText);
      console.log("Loaded saved TTS text for", key, savedText.length, "chars");
      return;
    }
    const oldSaved = localStorage.getItem(`tts_edited_${key}`);
    if (oldSaved) {
      localStorage.removeItem(`tts_edited_${key}`);
      console.log("Removed stale unfiltered TTS cache for", key);
    }
    
    if (pdfUrl && pages > 0 && !extractedText && !isExtractingRef.current) {
      isExtractingRef.current = true;
      extractTextInBackground(pdfUrl, pages);
    }
  };
  
  // Extract text in background without blocking UI
  const cleanTextViaServer = async (rawText: string): Promise<string> => {
    try {
      const response = await fetch("/api/tts/clean-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`[TTS] Server cleaned text: ${rawText.length} -> ${data.text.length} chars`);
        return data.text;
      }
    } catch (err) {
      console.error("[TTS] Server text cleaning failed, using raw:", err);
    }
    return rawText;
  };

  const extractPageTextWithParagraphs = async (pdf: any, pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    if (items.length === 0) return "";

    let result = "";
    let lastY: number | null = null;
    let lastHeight = 12;

    for (const item of items) {
      if (!item.str || item.str.trim() === "") continue;
      const y = item.transform ? item.transform[5] : null;
      const height = item.height || lastHeight;

      if (lastY !== null && y !== null) {
        const gap = Math.abs(lastY - y);
        if (gap > height * 1.3) {
          result += "\n\n";
        } else if (gap > height * 0.3) {
          result += " ";
        } else {
          result += " ";
        }
      }

      result += item.str;
      if (y !== null) lastY = y;
      if (height > 0) lastHeight = height;
    }
    return result;
  };

  const extractTextInBackground = async (url: string, pages: number) => {
    setIsPreloading(true);
    try {
      const loadingTask = pdfjs.getDocument(url);
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      
      let fullText = "";
      for (let i = 1; i <= pages; i++) {
        const pageText = await extractPageTextWithParagraphs(pdf, i);
        fullText += pageText + "\n\n";
      }
      
      const cleanedText = await cleanTextViaServer(fullText);
      setExtractedText(cleanedText);
      console.log("PDF text pre-extracted and cleaned:", cleanedText.length, "chars");
    } catch (error) {
      console.error("Background text extraction failed:", error);
    } finally {
      isExtractingRef.current = false;
      setIsPreloading(false);
    }
  };

  const extractAllText = async (): Promise<string> => {
    const currentNumPages = numPagesRef.current || numPages;
    if (!pdfUrl || currentNumPages === 0) return "";
    
    if (extractedTextRef.current) return extractedTextRef.current;
    if (extractedText) return extractedText;
    
    if (isExtractingRef.current) {
      setIsLoading(true);
      while (isExtractingRef.current) {
        await new Promise(r => setTimeout(r, 100));
        if (extractedTextRef.current) {
          setIsLoading(false);
          return extractedTextRef.current;
        }
      }
      setIsLoading(false);
      return extractedTextRef.current || extractedText || "";
    }
    
    setIsLoading(true);
    let fullText = "";
    
    try {
      let pdf = pdfDocRef.current;
      if (!pdf) {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
      }
      
      for (let i = 1; i <= currentNumPages; i++) {
        const pageText = await extractPageTextWithParagraphs(pdf, i);
        fullText += pageText + "\n\n";
      }
      
      const cleanedText = await cleanTextViaServer(fullText);
      setExtractedText(cleanedText);
      return cleanedText;
    } catch (error) {
      console.error("Error extracting text:", error);
      toast({
        title: "Error",
        description: "Failed to extract text from PDF",
        variant: "destructive",
      });
      return "";
    } finally {
      setIsLoading(false);
    }
  };

  const chunkText = (text: string, maxLength: number = 4000): string[] => {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

    if (paragraphs.length <= 1) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks: string[] = [];
      let currentChunk = "";
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxLength) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());
      return chunks;
    }

    const chunks: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
      if (para.length > maxLength) {
        if (currentChunk) { chunks.push(currentChunk.trim()); currentChunk = ""; }
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let subChunk = "";
        for (const sentence of sentences) {
          if ((subChunk + sentence).length > maxLength) {
            if (subChunk) chunks.push(subChunk.trim());
            subChunk = sentence;
          } else {
            subChunk += sentence;
          }
        }
        if (subChunk) chunks.push(subChunk.trim());
      } else if ((currentChunk + "\n\n" + para).length > maxLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  };

  const speakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playTTS = async (text: string, retryCount = 0): Promise<boolean> => {
    if (!isPlayingRef.current) {
      console.log('[TTS] playTTS aborted — not playing');
      return false;
    }
    try {
      const words = text.split(/\s+/).filter(w => w.length > 0);
      setChunkWords(words);
      setCurrentWordIndex(0);

      if (speakerParam) {
        console.log(`[TTS] Playing on external speaker: ${speakerParam}`);
        const response = await fetch("/api/tts/speaker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, entityId: speakerParam }),
        });
        if (!response.ok) throw new Error(`Speaker TTS failed: ${response.status}`);
        if (!isPlayingRef.current) return false;
        const estimatedDuration = Math.max(10, (words.length / 2.5));
        if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
        speakerTimerRef.current = setTimeout(() => {
          if (isPlayingRef.current && audioRef.current) {
            audioRef.current.dispatchEvent(new Event('ended'));
          }
        }, estimatedDuration * 1000);
        return true;
      }
      
      const chunkIdx = currentChunkRef.current;
      const cachedUrl = ttsPreloadCache.current[chunkIdx];
      let audioUrl: string;

      if (cachedUrl) {
        console.log(`[TTS] Using preloaded audio for chunk ${chunkIdx + 1}`);
        audioUrl = cachedUrl;
        delete ttsPreloadCache.current[chunkIdx];
      } else {
        console.log(`[TTS] Fetching audio for ${words.length} words, voice=${voice}`);
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
        });

        if (!isPlayingRef.current) {
          console.log('[TTS] Stopped during fetch — aborting playback');
          return false;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[TTS] Request failed: ${response.status} ${errText}`);
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        if (!isPlayingRef.current) {
          console.log('[TTS] Stopped during blob read — aborting playback');
          return false;
        }
        console.log(`[TTS] Audio blob received: ${audioBlob.size} bytes`);
        audioUrl = URL.createObjectURL(audioBlob);
      }
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.volume = volumeRef.current;
        audioRef.current.playbackRate = playbackSpeedRef.current;
        
        audioRef.current.onloadedmetadata = () => {
          if (audioRef.current) {
            audioDurationRef.current = audioRef.current.duration;
            audioRef.current.playbackRate = playbackSpeedRef.current;
            audioRef.current.volume = volumeRef.current;
            console.log(`[TTS] Metadata: dur=${audioRef.current.duration}s, speed=${playbackSpeedRef.current}x, vol=${volumeRef.current}`);
          }
        };
        
        audioRef.current.onerror = (e) => {
          console.error('[TTS] Audio element error:', e, audioRef.current?.error);
        };
        
        if (!isPlayingRef.current) {
          console.log('[TTS] Stopped before play — aborting');
          return false;
        }
        await audioRef.current.play();
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.volume = volumeRef.current;
        console.log(`[TTS] Playing: speed=${audioRef.current.playbackRate}, vol=${audioRef.current.volume}`);
      }
      return true;
    } catch (error) {
      if (!isPlayingRef.current) return false;
      console.error(`[TTS] Error (attempt ${retryCount + 1}):`, error);
      if (retryCount < 2 && isPlayingRef.current) {
        console.log(`[TTS] Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!isPlayingRef.current) return false;
        return playTTS(text, retryCount + 1);
      }
      return false;
    }
  };
  
  const lastReportedWordRef = useRef(-1);
  const handleTimeUpdate = () => {
    if (!audioRef.current || chunkWords.length === 0 || audioDurationRef.current === 0) return;
    
    var currentTime = audioRef.current.currentTime;
    var duration = audioDurationRef.current;
    var progress = currentTime / duration;
    
    var estimatedWordIndex = Math.floor(progress * chunkWords.length);
    var clampedIndex = Math.min(estimatedWordIndex, chunkWords.length - 1);
    
    if (clampedIndex !== currentWordIndex) {
      setCurrentWordIndex(clampedIndex);
      if (clampedIndex % 3 === 0 || clampedIndex === chunkWords.length - 1) {
        const activeWord = document.querySelector(`[data-word-index="${clampedIndex}"]`);
        if (activeWord) activeWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (catWashFollow && fileId && clampedIndex !== lastReportedWordRef.current) {
        lastReportedWordRef.current = clampedIndex;
        fetch("/api/cat-wash/update-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, wordIndex: clampedIndex }),
        }).catch(() => {});
      }
    }
  };

  const startReading = async () => {
    // Mark this file as listened when playback starts
    markCurrentFileListened();
    
    let textToRead = extractedTextRef.current || extractedText;
    
    if (!textToRead) {
      textToRead = await extractAllText();
    }
    
    if (!textToRead && fileId) {
      console.log("[TTS] Client-side extraction failed, trying server-side extraction for file", fileId);
      try {
        const resp = await fetch(`/api/files/${fileId}/text`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.text) {
            textToRead = data.text;
            setExtractedText(data.text);
            console.log(`[TTS] Server-side extraction succeeded: ${data.text.length} chars`);
          }
        }
      } catch (err) {
        console.error("[TTS] Server-side extraction also failed:", err);
      }
    }

    if (!textToRead) {
      toast({
        title: "No text found",
        description: "Could not extract text from this PDF. Make sure the PDF is loaded.",
        variant: "destructive",
      });
      return;
    }

    const newChunks = chunkText(textToRead);
    chunksRef.current = newChunks;
    setChunksList(newChunks);
    setTotalChunks(newChunks.length);
    const startChunk = (resumeChunkParam !== null && resumeChunkParam < newChunks.length) ? resumeChunkParam : 0;
    if (startChunk > 0) {
      console.log(`[TTS] Resuming from chunk ${startChunk} (via resumeChunk URL param)`);
    }
    setCurrentChunk(startChunk);
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    const key = getFileKey();
    setCheckedChunks(loadCheckedChunks(key));
    
    playNextChunk(startChunk);
  };

  const markChunkChecked = (idx: number) => {
    const key = getFileKey();
    setCheckedChunks(prev => {
      if (prev.has(idx)) return prev;
      const newChecked = new Set(prev);
      newChecked.add(idx);
      saveCheckedChunks(key, newChecked, totalChunks);
      if (fileId) {
        fetch(`/api/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkedChunks: JSON.stringify(Array.from(newChecked)),
            totalChunks,
            lastChunkIndex: Math.max(...Array.from(newChecked), 0),
          }),
        }).catch(() => {});
      }
      return newChecked;
    });
  };

  const playNextChunk = async (index: number) => {
    if (index > 0) {
      markChunkChecked(index - 1);
    }
    if (!isPlayingRef.current) {
      console.log(`[TTS] playNextChunk aborted — not playing`);
      return;
    }
    console.log(`[TTS] playNextChunk called: index=${index}, totalChunks=${chunksRef.current.length}`);
    if (index >= chunksRef.current.length) {
      console.log('[TTS] All chunks finished');
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentChunk(0);
      currentChunkRef.current = 0;

      if (catWashFollow && fileId) {
        try {
          const resp = await fetch("/api/cat-wash/update-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId, completed: true }),
          });
          const data = await resp.json();
          if (data.nextFile) {
            console.log(`[Cat Wash] Auto-continuing to: ${data.nextFile.name}`);
            toast({ title: "Next reading", description: `Loading: ${data.nextFile.name}` });
            window.location.href = data.nextFile.readerUrl;
            return;
          } else if (data.allComplete) {
            toast({ title: "All done!", description: "All readings for this week are complete." });
          }
        } catch (e) {
          console.error("[Cat Wash] Failed to report completion:", e);
        }
      } else {
        toast({ title: "Finished", description: "Finished reading the document" });
      }
      return;
    }

    if (catWashFollow && fileId) {
      const words = chunksRef.current[index]?.split(/\s+/).filter((w: string) => w.length > 0) || [];
      fetch("/api/cat-wash/update-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, chunkIndex: index, totalChunks: chunksRef.current.length, words, chunkText: chunksRef.current[index] }),
      }).catch(() => {});
    }

    setCurrentChunk(index);
    currentChunkRef.current = index;
    playingAttentionPromptRef.current = false;
    console.log(`[TTS] Playing chunk ${index + 1}/${chunksRef.current.length}`);

    setTimeout(() => {
      const chunkRow = document.querySelector(`[data-testid="chunk-row-${index}"]`);
      if (chunkRow) chunkRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    if (index + 1 < chunksRef.current.length && !ttsPreloadCache.current[index + 1]) {
      const nextText = chunksRef.current[index + 1];
      const nextVoice = voiceRef.current || voice;
      fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nextText, voice: nextVoice }),
      }).then(r => r.ok ? r.blob() : null).then(blob => {
        if (blob) {
          ttsPreloadCache.current[index + 1] = URL.createObjectURL(blob);
          console.log(`[TTS] Preloaded chunk ${index + 2}`);
        }
      }).catch(() => {});
    }

    const success = await playTTS(chunksRef.current[index]);
    if (!success && isPlayingRef.current) {
      console.log(`[TTS] Chunk ${index + 1} failed after retries, skipping to next chunk`);
      toast({ title: "Skipped chunk", description: `Chunk ${index + 1} failed, moving to next` });
      playNextChunk(index + 1);
      return;
    }
  };

  const handleAudioEnded = async () => {
    const playing = isPlayingRef.current;
    const paused = isPausedRef.current;
    const chunk = currentChunkRef.current;
    console.log(`[TTS] Audio ended: isPlaying=${playing}, isPaused=${paused}, currentChunk=${chunk}, attentionPrompt=${playingAttentionPromptRef.current}`);
    if (playing && !paused) {
      if (playingAttentionPromptRef.current) {
        playingAttentionPromptRef.current = false;
        playNextChunk(chunk + 1);
      } else if (chunk < chunksRef.current.length - 1) {
        playingAttentionPromptRef.current = true;
        console.log(`[TTS] Playing attention prompt after chunk ${chunk + 1}`);
        await playTTS("Bryn, are you paying attention?");
      } else {
        playNextChunk(chunk + 1);
      }
    }
  };

  const pauseReading = () => {
    console.log('[TTS] Pausing');
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPaused(true);
    isPausedRef.current = true;
  };

  const resumeReading = () => {
    console.log('[TTS] Resuming');
    if (audioRef.current) {
      audioRef.current.play();
    }
    setIsPaused(false);
    isPausedRef.current = false;
  };

  const stopReading = async () => {
    console.log('[TTS] Stopping');
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    if (speakerTimerRef.current) {
      clearTimeout(speakerTimerRef.current);
      speakerTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    
    // Save progress to database if this is a stored file (not OneDrive)
    if (fileId && currentChunk > 0) {
      try {
        await fetch(`/api/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            lastChunkIndex: currentChunk,
            totalChunks: totalChunks
          })
        });
      } catch (e) {
        console.error('Failed to save progress:', e);
      }
    }

    if (catWashFollow || speakerParam) {
      try {
        await fetch("/api/cat-wash/stop", { method: "POST" });
        console.log('[TTS] Server-side playback state cleared');
      } catch (e) {
        console.error('Failed to stop server-side playback:', e);
      }
    }
    
    setCurrentChunk(0);
    currentChunkRef.current = 0;
  };
  
  const resumeFromLast = async () => {
    if (!file?.lastChunkIndex || file.lastChunkIndex === 0) {
      startReading();
      return;
    }
    
    setIsLoading(true);
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    
    // Extract text if not already done - use startReading which handles extraction
    if (chunksRef.current.length === 0) {
      // Text not extracted yet, let startReading handle it then we'll skip to saved position
      await new Promise<void>((resolve) => {
        const checkChunks = setInterval(() => {
          if (chunksRef.current.length > 0) {
            clearInterval(checkChunks);
            resolve();
          }
        }, 100);
        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkChunks);
          resolve();
        }, 30000);
      });
    }
    
    // Start from saved position
    if (chunksRef.current.length > 0 && file.lastChunkIndex < chunksRef.current.length) {
      setCurrentChunk(file.lastChunkIndex);
      await playTTS(chunksRef.current[file.lastChunkIndex]);
    } else {
      startReading();
    }
    
    setIsLoading(false);
  };

  const skipBack = () => {
    if (currentChunkRef.current > 0) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const prevChunk = currentChunkRef.current - 1;
      console.log(`[TTS] Skip back to chunk ${prevChunk}`);
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      playNextChunk(prevChunk);
    }
  };

  const skipForward = () => {
    if (currentChunkRef.current < totalChunks - 1) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const nextChunk = currentChunkRef.current + 1;
      console.log(`[TTS] Skip forward to chunk ${nextChunk}`);
      playNextChunk(nextChunk);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    if (extractedText && chunksRef.current.length === 0) {
      const newChunks = chunkText(extractedText);
      chunksRef.current = newChunks;
      setChunksList(newChunks);
      setTotalChunks(newChunks.length);
      const key = getFileKey();
      setCheckedChunks(loadCheckedChunks(key));
    }
  }, [extractedText]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      console.log(`[TTS] Speed changed: ${playbackSpeed}x, actual=${audioRef.current.playbackRate}`);
    }
  }, [playbackSpeed]);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) {
      audioRef.current.volume = volume;
      console.log(`[TTS] Volume changed: ${volume}`);
    }
  }, [volume]);

  useEffect(() => {
    let lastHeights = new Array(20).fill(0);
    const updateWaveBars = () => {
      if (!isPlaying || isPaused) {
        setWaveBarHeights(new Array(20).fill(0));
        return;
      }
      const analyser = analyserRef.current;
      const bars = 20;
      const heights: number[] = [];

      if (analyser) {
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        const bufLen = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufLen);
        analyser.getByteFrequencyData(dataArray);
        let hasData = false;
        for (let i = 0; i < bars; i++) {
          const startIdx = Math.floor((i / bars) * bufLen * 0.6);
          const endIdx = Math.floor(((i + 1) / bars) * bufLen * 0.6);
          let sum = 0;
          for (let j = startIdx; j < endIdx; j++) {
            sum += dataArray[j];
            if (dataArray[j] > 0) hasData = true;
          }
          const avg = sum / (endIdx - startIdx) / 255;
          heights.push(avg);
        }
        if (hasData) {
          lastHeights = heights;
          setWaveBarHeights(heights);
          waveAnimRef.current = requestAnimationFrame(updateWaveBars);
          return;
        }
      }

      const t = Date.now() / 1000;
      for (let i = 0; i < bars; i++) {
        const base = 0.3 + Math.sin(t * 3 + i * 0.8) * 0.25;
        const wave2 = Math.sin(t * 5.3 + i * 1.2) * 0.15;
        const wave3 = Math.sin(t * 7.1 + i * 0.5) * 0.1;
        const smoothed = lastHeights[i] * 0.3 + (base + wave2 + wave3) * 0.7;
        heights.push(Math.max(0.05, Math.min(1, smoothed)));
      }
      lastHeights = heights;
      setWaveBarHeights(heights);
      waveAnimRef.current = requestAnimationFrame(updateWaveBars);
    };
    if (isPlaying && !isPaused) {
      waveAnimRef.current = requestAnimationFrame(updateWaveBars);
    } else {
      cancelAnimationFrame(waveAnimRef.current);
      setWaveBarHeights(new Array(20).fill(0));
    }
    return () => cancelAnimationFrame(waveAnimRef.current);
  }, [isPlaying, isPaused]);

  if (fileLoading && !isOneDrive) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3a8bbf, #164a72)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (!file && !isOneDrive) {
    return (
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg, #3a8bbf, #164a72)' }}>
        <div className="max-w-4xl mx-auto">
          <Link href="/files">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Files
            </Button>
          </Link>
          <div className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">File not found</h2>
            <p className="text-gray-500">The requested PDF could not be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  const folderParts = file?.folder?.split('-') || [];
  const courseCodeFromFolder = folderParts.length >= 3 ? folderParts[2]?.toUpperCase() : null;
  const cId = courseCodeFromFolder?.toLowerCase() || '';
  const playerHeaderGradient = (() => {
    if (cId === 'cppa122') return 'linear-gradient(0deg, rgb(71, 176, 69) 0%, rgb(15, 80, 4) 100%)';
    if (cId === 'cfnf400') return 'linear-gradient(180deg, rgb(222, 24, 100) 0%, rgb(250, 103, 179) 100%)';
    if (cId === 'casl101') return 'linear-gradient(180deg, rgb(80, 4, 66) 0%, rgb(176, 69, 162) 100%)';
    return 'linear-gradient(to br, rgba(31,41,55,0.95), rgba(0,0,0,0.9), rgba(17,24,39,0.95))';
  })();

  const controlsBarBg = (() => {
    if (cId === 'cppa122') return 'linear-gradient(0deg, #47B045 0%, #0F5004 100%)';
    if (cId === 'cfnf400') return 'linear-gradient(180deg, rgba(222, 24, 100, 0.88) 0%, rgba(250, 103, 179, 0.78) 100%)';
    if (cId === 'casl101') return 'linear-gradient(180deg, rgba(80, 4, 66, 0.88) 0%, rgba(176, 69, 162, 0.78) 100%)';
    return 'linear-gradient(180deg, rgba(10, 30, 60, 0.88) 0%, rgba(30, 60, 100, 0.78) 100%)';
  })();

  const waveColor = (() => {
    if (cId === 'cppa122') return '#47B045';
    if (cId === 'cfnf400') return '#FA67B3';
    if (cId === 'casl101') return '#B045A2';
    return 'rgba(255,255,255,0.8)';
  })();

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <img src={tmuBgPath} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,15,40,0.15) 0%, rgba(0,10,30,0.25) 100%)' }} />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
        data-testid="audio-visualizer-canvas"
      />
      <audio ref={audioRef} onEnded={handleAudioEnded} onTimeUpdate={handleTimeUpdate} crossOrigin="anonymous" />

      <div className="relative flex-shrink-0" style={{ zIndex: 10 }}>
        <div className="flex items-center gap-3 px-5 py-1.5 border-b border-white/10 backdrop-blur-sm" style={{ background: controlsBarBg }}>
          {(() => {
            const isDbFile = !!fileId && !isOneDrive;
            const isModule = file?.folder?.includes('module');
            const isReading = file?.folder?.includes('reading');
            const relatedFiles = isReading ? readingFiles : moduleFiles;
            const currentIndex = relatedFiles.findIndex(f => f.id === fileId);
            const canGoPrev = currentIndex > 0;
            const canGoNext = currentIndex < relatedFiles.length - 1;

            if (isDbFile && (moduleFiles.length > 0 || readingFiles.length > 0)) {
              return (
                <>
                  <div className="flex items-center gap-1.5 min-w-0 shrink" style={{ marginLeft: '-3px' }}>
                    <span className="text-[13px] text-white shrink-0">Module:</span>
                    <Select
                      value={isModule && fileId ? fileId.toString() : (moduleFiles[0]?.id?.toString() || 'none')}
                      onValueChange={(val) => {
                        if (val === 'none') return;
                        window.location.href = `/pdf-reader/${val}`;
                      }}
                    >
                      <SelectTrigger className="h-8 text-[11px] px-2.5 bg-white/10 border !border-white focus:ring-0 focus:ring-offset-0" style={{ color: 'white', maxWidth: 'fit-content', letterSpacing: '0.6px' }} data-testid="select-module-file">
                        <span className="truncate block" style={{ maxWidth: '300px', minWidth: '60px' }}>
                          {moduleFiles.length === 0 ? 'No modules' : (() => {
                            const f = isModule ? file : moduleFiles[0];
                            return f ? (f.displayName || f.originalName || '').replace(/\.pdf$/i, '') : 'No modules';
                          })()}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] min-w-[350px]">
                        {moduleFiles.length === 0 && <SelectItem value="none" disabled className="text-[10px] text-gray-500">No module files</SelectItem>}
                        {moduleFiles.map(f => (
                          <SelectItem key={f.id} value={f.id.toString()} className={`text-[10px] ${f.listened ? 'text-white/50 line-through' : ''}`}>
                            {(f.displayName || f.originalName || '').replace(/\.pdf$/i, '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0 shrink" style={{ marginLeft: '45px' }}>
                    <span className="text-[13px] text-white shrink-0">Reading:</span>
                    <Select
                      value={isReading && fileId ? fileId.toString() : (readingFiles[0]?.id?.toString() || 'none')}
                      onValueChange={(val) => {
                        if (val === 'none') return;
                        window.location.href = `/pdf-reader/${val}`;
                      }}
                    >
                      <SelectTrigger className="h-8 text-[11px] px-2.5 bg-white/10 border !border-white focus:ring-0 focus:ring-offset-0" style={{ color: 'white', maxWidth: 'fit-content', letterSpacing: '0.6px' }} data-testid="select-reading-file">
                        <span className="truncate block" style={{ maxWidth: '300px', minWidth: '60px' }}>
                          {readingFiles.length === 0 ? 'No readings' : (() => {
                            const f = isReading ? file : readingFiles[0];
                            return f ? (f.displayName || f.originalName || '').replace(/\.pdf$/i, '') : 'No readings';
                          })()}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] min-w-[350px]">
                        {readingFiles.length === 0 ? <SelectItem value="none" disabled className="text-[10px] text-gray-500">No reading files</SelectItem> : readingFiles.map(f => (
                          <SelectItem key={f.id} value={f.id.toString()} className={`text-[10px] ${f.listened ? 'text-white/50 line-through' : ''}`}>
                            {(f.displayName || f.originalName || '').replace(/\.pdf$/i, '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1" style={{ marginLeft: '40px' }}>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20 disabled:opacity-30" onClick={() => {
                      if (canGoPrev) window.location.href = `/pdf-reader/${relatedFiles[currentIndex - 1].id}`;
                    }} disabled={!canGoPrev} data-testid="button-prev-file">
                      <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                    </Button>
                    <span className="text-[11px] text-white min-w-[40px] text-center">
                      {currentIndex >= 0 ? `${currentIndex + 1}/${relatedFiles.length}` : '-'}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20 disabled:opacity-30" onClick={() => {
                      if (canGoNext) window.location.href = `/pdf-reader/${relatedFiles[currentIndex + 1].id}`;
                    }} disabled={!canGoNext} data-testid="button-next-file">
                      <ChevronRight className="h-4 w-4" strokeWidth={3} />
                    </Button>
                  </div>

                </>
              );
            }

            if (allFiles.length > 1) {
              return (
                <>
                  <div className="flex items-center gap-1.5 min-w-0 shrink">
                    <span className="text-[13px] text-white shrink-0">Module:</span>
                    <Select
                      value={currentFileUrl || (oneDriveUrl ? decodeURIComponent(oneDriveUrl) : '')}
                      onValueChange={(url) => {
                        const f = allFiles.find(af => af.downloadUrl === url);
                        if (f) switchToFile(f);
                      }}
                    >
                      <SelectTrigger className="h-8 text-[11px] px-2.5 bg-white/10 border !border-white focus:ring-0 focus:ring-offset-0" style={{ color: 'white', maxWidth: 'fit-content', letterSpacing: '0.6px' }} data-testid="select-onedrive-file">
                        <span className="truncate block" style={{ maxWidth: '300px', minWidth: '60px' }}>
                          {(() => {
                            const current = allFiles.find(af => af.downloadUrl === (currentFileUrl || (oneDriveUrl ? decodeURIComponent(oneDriveUrl) : '')));
                            return current ? current.name.replace(/\.pdf$/i, '') : 'Select...';
                          })()}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] min-w-[350px]">
                        {allFiles.map((af, idx) => (
                          <SelectItem key={af.path || idx} value={af.downloadUrl} className={`text-[10px] ${listenedFiles.has(af.path) ? 'text-white/50 line-through' : ''}`}>
                            {af.name.replace(/\.pdf$/i, '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1" style={{ marginLeft: '40px' }}>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20 disabled:opacity-30" onClick={() => {
                      const i = allFiles.findIndex(af => af.downloadUrl === currentFileUrl);
                      if (i > 0) switchToFile(allFiles[i - 1]);
                    }} disabled={allFiles.findIndex(af => af.downloadUrl === currentFileUrl) <= 0} data-testid="button-prev-onedrive">
                      <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                    </Button>
                    <span className="text-[9px] text-white min-w-[40px] text-center">
                      {(() => { const i = allFiles.findIndex(af => af.downloadUrl === currentFileUrl); return i >= 0 ? `${i + 1}/${allFiles.length}` : '-'; })()}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20 disabled:opacity-30" onClick={() => {
                      const i = allFiles.findIndex(af => af.downloadUrl === currentFileUrl);
                      if (i < allFiles.length - 1) switchToFile(allFiles[i + 1]);
                    }} disabled={allFiles.findIndex(af => af.downloadUrl === currentFileUrl) >= allFiles.length - 1} data-testid="button-next-onedrive">
                      <ChevronRight className="h-4 w-4" strokeWidth={3} />
                    </Button>
                  </div>
                </>
              );
            }

            return (
              <span className="text-[13px] font-bold text-white truncate">{file?.displayName || file?.originalName || currentFileName || 'PDF Reader'}</span>
            );
          })()}

          <div className="ml-auto flex items-center gap-2" style={{ marginRight: '-1px' }}>
            {isPreloading && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
            <span className="text-[13px] text-white">Speaker:</span>
            <Select value={selectedSpeaker} onValueChange={(val) => { setSelectedSpeaker(val); selectedSpeakerRef.current = val; }}>
              <SelectTrigger className="h-8 text-[11px] px-2.5 bg-white/10 border !border-white focus:ring-0 focus:ring-offset-0 text-white w-[190px]" data-testid="select-speaker">
                <SelectValue placeholder="Select Speaker" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {SPEAKERS.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-[10px]">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {flickDeviceGroups.length > 0 && (
              <div className="relative">
                <Button size="icon" variant="ghost" className={`text-white overflow-visible p-0 ${showFlickMenu ? 'ring-2 ring-blue-400 rounded-md' : ''}`} data-testid="button-flick-cast" onClick={() => setShowFlickMenu(!showFlickMenu)} disabled={isFlicking} title="Flick to another device" style={{ height: '30px', width: '30px', minHeight: '30px', minWidth: '30px', marginLeft: '5px' }}>
                  {isFlicking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cast style={{ height: '23px', width: '23px' }} />}
                </Button>
                {showFlickMenu && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50">
                    <div className="px-2.5 py-1.5 border-b border-gray-700 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-white">Flick to...</span>
                      <button onClick={() => setShowFlickMenu(false)} className="text-gray-400 hover:text-white" data-testid="button-close-flick-menu"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="max-h-[480px] overflow-y-auto">
                      {flickDeviceGroups.map((group) => (
                        <div key={group.room}>
                          <div className="px-2.5 py-1 bg-gray-800/60 flex items-center gap-1.5 sticky top-0">
                            <span className="text-[12px]">{group.icon}</span>
                            <span className="text-[12px] font-semibold text-gray-300 uppercase tracking-wider">{group.room}</span>
                          </div>
                          {group.devices.map((device) => (
                            <button key={device.id} data-testid={`button-flick-${device.id}`} className="w-full px-2.5 py-1.5 pl-6 flex items-center gap-2 hover:bg-gray-800 transition-colors text-left" onClick={() => handleFlick(device.id)} disabled={isFlicking}>
                              {device.type === "tablet" || device.type === "echo_show" ? <Monitor className="h-3 w-3 text-blue-400 flex-shrink-0" /> :
                               device.type === "tv" ? <Monitor className="h-3 w-3 text-purple-400 flex-shrink-0" /> :
                               device.type === "group" ? <Speaker className="h-3 w-3 text-amber-400 flex-shrink-0" /> :
                               <Speaker className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                              <span className={`text-[13px] truncate ${device.type === "group" ? "text-amber-300 font-medium" : "text-white"}`}>{device.name}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden min-h-0" style={{ zIndex: 2 }}>
        <div className={`${isFullPage ? 'w-full' : 'flex-1 lg:w-1/2'} overflow-auto pdf-reader-scrollbar`} style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="sticky top-0 z-20" style={{ background: 'rgba(0,10,30,0.8)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Filtered Text</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40">{checkedChunks.size}/{totalChunks} chunks</span>
              </div>
            </div>
            {searchOpen && (
              <div className="px-3 py-2 border-b border-white/10 space-y-1.5">
                <div className="flex items-center gap-2">
                  <button className="flex-shrink-0" onClick={() => setShowReplace(prev => !prev)} data-testid="button-toggle-replace">
                    {showReplace ? <ChevronDown className="h-3.5 w-3.5 text-white/40" /> : <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
                  </button>
                  <Search className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchMatchIndex(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.shiftKey) setSearchMatchIndex(prev => Math.max(0, prev - 1));
                        else setSearchMatchIndex(prev => prev < searchMatchCount - 1 ? prev + 1 : 0);
                      }
                      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(""); setSearchMatchIndex(0); setShowReplace(false); setReplaceText(""); }
                    }}
                    placeholder="Find..."
                    className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-white/30"
                    data-testid="input-search"
                  />
                  {searchQuery.trim().length >= 2 && (
                    <span className="text-[10px] text-white/40 whitespace-nowrap">
                      {searchMatchCount > 0 ? `${Math.min(searchMatchIndex + 1, searchMatchCount)}/${searchMatchCount}` : '0/0'}
                    </span>
                  )}
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-white/40" onClick={() => setSearchMatchIndex(prev => Math.max(0, prev - 1))} data-testid="button-search-prev">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-white/40" onClick={() => setSearchMatchIndex(prev => prev < searchMatchCount - 1 ? prev + 1 : 0)} data-testid="button-search-next">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-white/40" onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchMatchIndex(0); setShowReplace(false); setReplaceText(""); }} data-testid="button-search-close">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {showReplace && (
                  <div className="flex items-center gap-2 pl-[22px]">
                    <Replace className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                    <input
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setShowReplace(false); setReplaceText(""); } }}
                      placeholder="Replace with..."
                      className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-white/30"
                      data-testid="input-replace"
                    />
                    <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px] text-blue-400 hover:text-blue-300" data-testid="button-replace-one"
                      disabled={searchMatchCount === 0 || searchQuery.trim().length < 2}
                      onClick={() => {
                        if (searchQuery.trim().length < 2 || searchMatchCount === 0) return;
                        const q = searchQuery.trim();
                        const qLower = q.toLowerCase();
                        let globalIdx = 0;
                        const newChunks = chunksList.map(chunk => {
                          let result = '';
                          let lower = chunk.toLowerCase();
                          let lastPos = 0;
                          let pos = lower.indexOf(qLower, lastPos);
                          while (pos !== -1) {
                            if (globalIdx === searchMatchIndex) {
                              result += chunk.slice(lastPos, pos) + replaceText;
                              lastPos = pos + q.length;
                              const newText = result + chunk.slice(lastPos);
                              const remaining = chunksList.map((c, i) => i === chunksList.indexOf(chunk) ? newText : c);
                              const fullText = remaining.join('\n\n');
                              setExtractedText(fullText);
                              const rechunked = chunkText(fullText);
                              chunksRef.current = rechunked;
                              setChunksList(rechunked);
                              setTotalChunks(rechunked.length);
                              if (searchMatchIndex >= searchMatchCount - 1) setSearchMatchIndex(Math.max(0, searchMatchCount - 2));
                              return;
                            }
                            result += chunk.slice(lastPos, pos + q.length);
                            lastPos = pos + q.length;
                            globalIdx++;
                            pos = lower.indexOf(qLower, lastPos);
                          }
                          return undefined;
                        });
                      }}
                    >Replace</Button>
                    <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px] text-amber-400 hover:text-amber-300" data-testid="button-replace-all"
                      disabled={searchMatchCount === 0 || searchQuery.trim().length < 2}
                      onClick={() => {
                        if (searchQuery.trim().length < 2 || searchMatchCount === 0) return;
                        const q = searchQuery.trim();
                        const fullText = extractedText.split(q).join(replaceText);
                        setExtractedText(fullText);
                        const rechunked = chunkText(fullText);
                        chunksRef.current = rechunked;
                        setChunksList(rechunked);
                        setTotalChunks(rechunked.length);
                        setSearchMatchIndex(0);
                      }}
                    >Replace All</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditingText && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/80">Edit TTS Text</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" data-testid="button-save-text-edit" className="h-6 w-6"
                    onClick={() => {
                      setExtractedText(editableText);
                      const newChunks = chunkText(editableText);
                      chunksRef.current = newChunks;
                      setChunksList(newChunks);
                      setTotalChunks(newChunks.length);
                      setCurrentChunk(0);
                      currentChunkRef.current = 0;
                      setIsEditingText(false);
                      const key = getFileKey();
                      localStorage.setItem(`tts_edited_v2_${key}`, editableText);
                      toast({ title: "Text updated", description: "Your edits have been saved. Press play to read the updated text." });
                    }}>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-cancel-text-edit" className="h-6 w-6"
                    onClick={() => { setIsEditingText(false); setEditableText(extractedText); }}>
                    <X className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
              <textarea
                data-testid="textarea-edit-tts-text"
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full h-64 p-3 text-sm border border-white/20 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-white/30 bg-black/40 text-white"
                placeholder="Edit the extracted text here..."
              />
              <p className="text-xs text-white/40">{editableText.length} characters</p>
            </div>
          )}

          {followOnly && followState?.active && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0a1a' }}>
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
                <span className="text-sm font-medium text-blue-300">{followState.fileName}</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                  Chunk {followState.chunkIndex + 1} / {followState.totalChunks}
                </span>
              </div>
              <div className="bg-white/10 h-1 overflow-hidden">
                <div className="bg-blue-400 h-full transition-all duration-300" style={{ width: `${Math.round(((followState.chunkIndex) / followState.totalChunks) * 100)}%` }} />
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-6" data-testid="follow-text-display">
                {followState.words.length > 0 && (
                  <p className="text-2xl leading-relaxed">
                    {followState.words.map((word, idx) => (
                      <span key={idx} className={`${idx === followState.estimatedWordIndex ? "bg-yellow-400/80 text-black font-bold px-1 rounded" : idx < followState.estimatedWordIndex ? "text-white/25" : "text-white/90"} transition-colors duration-75`}>
                        {word}{" "}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          )}

          {followOnly && !followState?.active && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#0a0a1a' }}>
              <span className="text-lg text-white/40">Waiting for playback...</span>
            </div>
          )}

          {catWashFollow && !followOnly && followState?.active && (
            <div className="m-4 p-4 rounded-lg border border-blue-400/30" style={{ background: 'rgba(30,60,120,0.4)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-300">Following Cat Wash Playback</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                  Chunk {followState.chunkIndex + 1} of {followState.totalChunks} ({Math.round(((followState.chunkIndex + followState.progress) / followState.totalChunks) * 100)}%)
                </span>
              </div>
              <div className="bg-white/10 rounded-full h-2 overflow-hidden mb-3">
                <div className="bg-blue-400 h-full transition-all duration-300" style={{ width: `${Math.round(((followState.chunkIndex + followState.progress) / followState.totalChunks) * 100)}%` }} />
              </div>
              {followState.words.length > 0 && (
                <div className="max-h-60 overflow-y-auto p-3 rounded border border-white/10 text-base leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)' }} data-testid="follow-text-display-tablet">
                  {followState.words.map((word, idx) => (
                    <span key={idx} className={`${idx === followState.estimatedWordIndex ? "bg-yellow-400/80 text-black font-semibold px-0.5 rounded" : idx < followState.estimatedWordIndex ? "text-white/30" : "text-white/80"} transition-colors duration-100`}>
                      {word}{" "}
                    </span>
                  ))}
                </div>
              )}
              <button className="mt-3 text-xs text-red-400 hover:text-red-300 underline" onClick={() => fetch("/api/cat-wash/stop", { method: "POST" }).then(() => setFollowState(null))} data-testid="stop-catwash-playback">
                Stop Playback
              </button>
            </div>
          )}

          {catWashFollow && !followOnly && !autoplayParam && !followState?.active && (
            <div className="m-4 p-4 rounded-lg border border-white/10 text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <span className="text-sm text-white/50">Waiting for Cat Wash playback to start...</span>
            </div>
          )}

          {!isEditingText && (
            <div className="p-4 space-y-3">
              {chunksList.map((chunk, idx) => {
                const isActive = currentChunk === idx && isPlaying;
                const isChecked = checkedChunks.has(idx);
                return (
                  <div
                    key={idx}
                    className={`flex gap-0 rounded-xl transition-colors border ${isActive ? 'bg-white/10 border-white/20' : 'border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                    data-testid={`chunk-row-${idx}`}
                  >
                    <div
                      className="flex flex-col items-center shrink-0 pt-4 px-3"
                      style={{
                        background: isChecked
                          ? `linear-gradient(180deg, ${waveColor} 0%, ${waveColor}BB 100%)`
                          : `linear-gradient(180deg, ${waveColor} 0%, ${waveColor}99 100%)`,
                      }}
                    >
                      <div className="sticky flex flex-col items-center pt-2" style={{ top: '12px', zIndex: 3 }}>
                        <div
                          onClick={() => toggleChunkChecked(idx)}
                          className="cursor-pointer flex items-center justify-center"
                          style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', border: '1px solid white', backgroundColor: isChecked ? 'white' : 'transparent', borderRadius: '4px', marginTop: '9px' }}
                          data-testid={`checkbox-chunk-${idx}`}
                        >
                          {isChecked && <Check className="h-4 w-4 text-gray-900" strokeWidth={3} />}
                        </div>
                        <button
                          className="transition-colors mt-[23px] hover:bg-white/25 flex items-center justify-center"
                          style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', padding: 0 }}
                          onClick={() => {
                            const chunkEl = document.querySelector(`[data-testid="chunk-row-${idx}"]`);
                            if (chunkEl) chunkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setSearchOpen(true);
                            setTimeout(() => searchInputRef.current?.focus(), 100);
                          }}
                          data-testid={`button-chunk-search-${idx}`}
                          title="Search in text"
                        >
                          <Search className="text-white" style={{ width: '17px', height: '17px' }} />
                        </button>
                        <button
                          className={`rounded-full transition-colors mt-[23px] border border-white ${isActive ? 'bg-white/30 hover:bg-white/40' : 'bg-white/15 hover:bg-white/25'} flex items-center justify-center`}
                          style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', padding: 0 }}
                          onClick={() => {
                            if (isActive && !isPaused) {
                              pauseReading();
                            } else if (isActive && isPaused) {
                              resumeReading();
                            } else {
                              if (audioRef.current) audioRef.current.pause();
                              setIsPlaying(true);
                              isPlayingRef.current = true;
                              setIsPaused(false);
                              isPausedRef.current = false;
                              playNextChunk(idx);
                            }
                          }}
                          data-testid={`button-chunk-play-${idx}`}
                        >
                          {isActive && !isPaused ? (
                            <Pause className="h-3 w-3 text-white" />
                          ) : (
                            <Play className="h-3 w-3 text-white ml-px" />
                          )}
                        </button>
                        <button
                          className="transition-colors hover:bg-white/25 flex items-center justify-center"
                          style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', padding: 0, marginTop: '150px' }}
                          onClick={() => {
                            setEditingChunkIndex(idx);
                            setEditableChunkText(chunk);
                          }}
                          data-testid={`button-chunk-edit-${idx}`}
                          title="Edit chunk"
                        >
                          <Pencil className="h-4 w-4 text-white" strokeWidth={3} />
                        </button>
                      </div>
                      <div className="flex-1" />
                    </div>
                    <div className="flex-1 min-w-0 p-4 pl-3 relative">
                      {editingChunkIndex !== idx && (
                        <div className="absolute right-2" style={{ top: '-2px', zIndex: 2 }}>
                          <button
                            className="transition-colors hover:bg-white/25 flex items-center justify-center rounded"
                            style={{ width: '20px', height: '20px', padding: 0 }}
                            onClick={() => setIsFullPage(!isFullPage)}
                            data-testid={`button-chunk-fullpage-${idx}`}
                            title={isFullPage ? "Exit full page" : "Full page reader"}
                          >
                            {isFullPage ? <Minimize2 className="h-4 w-4 text-white/60 hover:text-white" strokeWidth={3} /> : <Maximize2 className="h-4 w-4 text-white/60 hover:text-white" strokeWidth={3} />}
                          </button>
                        </div>
                      )}
                      {editingChunkIndex === idx ? (
                        <div className="relative">
                          <textarea
                            value={editableChunkText}
                            onChange={(e) => setEditableChunkText(e.target.value)}
                            className="w-full bg-white/5 text-white/90 text-[22px] leading-[2.1] p-2 rounded-lg border border-white/20 focus:border-white/40 focus:outline-none resize-y min-h-[80px]"
                            style={{ minHeight: '80px' }}
                            autoFocus
                            data-testid={`textarea-chunk-edit-${idx}`}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              className="px-3 py-1 bg-white/20 text-white text-xs rounded hover:bg-white/30 transition-colors"
                              onClick={() => {
                                const newChunks = [...chunksList];
                                newChunks[idx] = editableChunkText;
                                setChunksList(newChunks);
                                setEditingChunkIndex(null);
                              }}
                              data-testid={`button-chunk-save-${idx}`}
                            >Save</button>
                            <button
                              className="px-3 py-1 bg-white/10 text-white/60 text-xs rounded hover:bg-white/15 transition-colors"
                              onClick={() => setEditingChunkIndex(null)}
                              data-testid={`button-chunk-cancel-${idx}`}
                            >Cancel</button>
                          </div>
                        </div>
                      ) : (
                      <p className={`text-[22px] leading-[2.1] cursor-pointer ${isChecked ? 'text-white/30 line-through' : 'text-white/90'}`} onClick={() => {
                        if (!isActive) {
                          setEditingChunkIndex(idx);
                          setEditableChunkText(chunk);
                        }
                      }}>
                        <span className="text-white/40 mr-1.5 font-medium">{idx + 1}.</span>
                        {isActive && chunkWords.length > 0 ? (
                          chunkWords.map((word, wIdx) => (
                            <span
                              key={wIdx}
                              data-word-index={wIdx}
                              className={`${
                                wIdx === currentWordIndex
                                  ? "bg-red-500 text-white font-semibold px-0.5 rounded"
                                  : wIdx < currentWordIndex
                                  ? "text-white/40"
                                  : ""
                              } transition-colors duration-100`}
                            >
                              {word}{" "}
                            </span>
                          ))
                        ) : searchQuery.trim().length >= 2 ? (
                          (() => {
                            const q = searchQuery.trim();
                            const qLower = q.toLowerCase();
                            const parts: Array<{text: string; isMatch: boolean}> = [];
                            let remaining = chunk;
                            while (remaining.length > 0) {
                              const idx = remaining.toLowerCase().indexOf(qLower);
                              if (idx === -1) { parts.push({text: remaining, isMatch: false}); break; }
                              if (idx > 0) parts.push({text: remaining.slice(0, idx), isMatch: false});
                              parts.push({text: remaining.slice(idx, idx + q.length), isMatch: true});
                              remaining = remaining.slice(idx + q.length);
                            }
                            return parts.map((p, pi) => p.isMatch
                              ? <mark key={pi} className="bg-yellow-400/80 text-black rounded px-0.5">{p.text}</mark>
                              : <span key={pi}>{p.text}</span>
                            );
                          })()
                        ) : (
                          chunk
                        )}
                      </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {chunksList.length === 0 && !isPreloading && extractedText && (
                <p className="text-center text-white/40 py-8 text-sm">Press play to extract and chunk the text</p>
              )}
              {chunksList.length === 0 && !extractedText && !isPreloading && (
                <p className="text-center text-white/40 py-8 text-sm">Loading PDF text...</p>
              )}
              {isPreloading && (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                  <span className="text-sm text-white/40">Preparing text...</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`${isFullPage ? 'hidden' : 'hidden lg:flex'} lg:w-[45%] flex-col border-l border-white/10`} style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-1.5 border-b border-white/10" style={{ background: 'rgba(0,10,30,0.6)' }}>
            <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Original PDF</span>
            <div className="flex items-center gap-1" style={{ marginRight: '4px' }}>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white/60 hover:text-white" onClick={goToPreviousPage} disabled={currentPage <= 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] text-white/60 min-w-[40px] text-center">{currentPage} / {numPages}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white/60 hover:text-white" onClick={goToNextPage} disabled={currentPage >= numPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex justify-center items-start p-2" ref={(el) => { if (el && !el.dataset.observed) { el.dataset.observed = '1'; const ro = new ResizeObserver(() => { const h = el.clientHeight; if (h > 0) setPdfContainerHeight(h); }); ro.observe(el); } }}>
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  height={pdfContainerHeight ? pdfContainerHeight - 16 : undefined}
                  width={!pdfContainerHeight ? (isMobile ? window.innerWidth - 32 : 480) : undefined}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            )}
          </div>
        </div>
      </div>

      {totalChunks > 0 && (
        <div className="relative flex-shrink-0" style={{ zIndex: 10 }}>
          <div className="w-full px-0" data-testid="progress-gradient-bar">
            <div className="relative w-full h-8 flex items-center" style={{ background: `linear-gradient(90deg, ${waveColor}33 0%, ${waveColor}88 ${chunkProgress}%, rgba(255,255,255,0.08) ${chunkProgress}%, rgba(255,255,255,0.08) 100%)` }}>
              <div className="flex items-center gap-3 px-4 w-full">
                <input
                  type="checkbox"
                  checked={chunkProgress === 100}
                  readOnly
                  className="h-4 w-4 rounded border-2 border-white/60 cursor-default appearance-none checked:bg-white checked:border-white relative shrink-0"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  data-testid="checkbox-progress-all"
                />
                <div className="flex-1 flex items-center justify-between" style={{ marginTop: '4px' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white font-medium">{checkedChunks.size} / {totalChunks} Chunks Completed ({chunkProgress}%)</span>
                    <div style={{ width: '130px', marginLeft: '10px' }}>
                      <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${chunkProgress}%`, background: waveColor }} />
                      </div>
                    </div>
                  </div>
                  {checkedChunks.size < totalChunks && (
                    <button
                      className="text-[12px] text-white/70 hover:text-white underline font-semibold shrink-0"
                      style={{ marginRight: '15px' }}
                      onClick={() => {
                        const firstUnlistened = Array.from({ length: totalChunks }, (_, i) => i).find(i => !checkedChunks.has(i));
                        if (firstUnlistened !== undefined) {
                          const el = document.querySelector(`[data-testid="chunk-row-${firstUnlistened}"]`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      data-testid="button-jump-unlistened"
                    >Jump to Unlistened</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!followOnly && <div className="relative flex-shrink-0 flex justify-center" style={{ zIndex: 10, padding: '5px 20px 14px 20px' }}>
        <div className="rounded-2xl mx-auto" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.22)', maxWidth: '1200px', width: '100%', overflow: 'visible' }}>
          <div className="relative px-8 pb-5" style={{ overflow: 'visible' }}>
            <div className="flex items-end justify-center" style={{ overflow: 'visible' }}>
              {!isPlaying ? (
                <div className="flex items-center" style={{ marginTop: '-30px', gap: '30px' }}>
                  {file && file.lastChunkIndex && file.lastChunkIndex > 0 && (
                    <button
                      className="rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
                      style={{ padding: '18px', outline: '2px solid rgba(255,255,255,0.35)', outlineOffset: '3px' }}
                      onClick={resumeFromLast}
                      disabled={isLoading || numPages === 0}
                      title={`Resume from chunk ${file.lastChunkIndex + 1}${file.totalChunks ? ` of ${file.totalChunks}` : ''}`}
                      data-testid="button-resume"
                    >
                      {isLoading ? <Loader2 className="h-10 w-10 text-white animate-spin" /> : <RotateCcw className="h-10 w-10 text-white" />}
                    </button>
                  )}
                  <button
                    className="rounded-full bg-white hover:bg-white/90 disabled:opacity-30"
                    style={{ padding: '18px', outline: '2px solid rgba(255,255,255,0.35)', outlineOffset: '3px' }}
                    onClick={startReading}
                    disabled={isLoading || numPages === 0}
                    data-testid="button-play"
                  >
                    {isLoading ? <Loader2 className="h-10 w-10 text-gray-900 animate-spin" /> : <Play className="h-10 w-10 text-gray-900 fill-gray-900 ml-0.5" />}
                  </button>
                </div>
              ) : isPaused ? (
                <button className="rounded-full bg-white hover:bg-white/90" style={{ marginTop: '-30px', padding: '18px', outline: '2px solid rgba(255,255,255,0.35)', outlineOffset: '3px' }} onClick={resumeReading} data-testid="button-resume-play">
                  <Play className="h-10 w-10 text-gray-900 fill-gray-900 ml-0.5" />
                </button>
              ) : (
                <button className="rounded-full bg-white hover:bg-white/90" style={{ marginTop: '-30px', padding: '18px', outline: '2px solid rgba(255,255,255,0.35)', outlineOffset: '3px' }} onClick={pauseReading} data-testid="button-pause">
                  <Pause className="h-10 w-10 text-gray-900" />
                </button>
              )}
            </div>

            <div className="absolute left-8 flex items-end gap-2" style={{ bottom: '10px' }}>
              <div className="flex items-center gap-2" style={{ alignSelf: 'flex-end' }}>
                <button className="p-3 rounded-full hover:bg-white/10 flex items-center gap-1" onClick={() => { if (audioRef.current && isPlaying) { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15); } }} disabled={!isPlaying} data-testid="button-rewind-15">
                  <RotateCcw className="h-5 w-5 text-white" />
                  <span className="text-xs text-white font-medium">15s</span>
                </button>
                <button className="p-3 rounded-full hover:bg-white/10 flex items-center gap-1" style={{ marginLeft: '25px' }} onClick={() => { if (audioRef.current && isPlaying) { audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 15); } }} disabled={!isPlaying} data-testid="button-forward-15">
                  <span className="text-xs text-white font-medium">15s</span>
                  <RotateCw className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="absolute flex items-end" style={{ bottom: '25px', left: '280px' }}>
              <div className="flex items-end gap-[3px] h-16" data-testid="sound-waves-left">
                {waveBarHeights.map((val, i) => {
                  const idleH = [8,14,22,30,18,26,12,20,28,16,24,10,18,26,14,22,30,12,20,8][i] || 10;
                  const activeH = Math.max(4, val * 56);
                  const h = isPlaying && !isPaused ? activeH : Math.max(4, idleH * 0.5);
                  return (
                    <div key={i} className="rounded-sm" style={{
                      width: '3px',
                      background: isPlaying && !isPaused
                        ? `linear-gradient(180deg, ${waveColor}, ${waveColor}44)`
                        : 'rgba(255,255,255,0.2)',
                      height: `${Math.round(h)}px`,
                      transition: isPlaying && !isPaused ? 'height 0.05s linear' : 'height 0.3s ease',
                    }} />
                  );
                })}
              </div>
            </div>

            <div className="absolute right-8 flex items-center" style={{ gap: '12px', bottom: '15px' }}>
              <button className="p-3 rounded-full hover:bg-white/10" style={{ marginRight: '125px' }} onClick={skipBack} disabled={!isPlaying || currentChunk === 0} data-testid="button-skip-back">
                <SkipBack className="h-5 w-5 text-white" />
              </button>
              <button className="p-3 rounded-full hover:bg-white/10" style={{ marginRight: '115px' }} onClick={skipForward} disabled={!isPlaying || currentChunk >= totalChunks - 1} data-testid="button-skip-forward-left">
                <SkipForward className="h-5 w-5 text-white" />
              </button>
              <button className="p-3 rounded-full hover:bg-white/10" onClick={stopReading} disabled={!isPlaying} data-testid="button-stop">
                <Square className="h-5 w-5 text-white fill-white" />
              </button>
            </div>

          </div>

          <div className="flex items-center justify-between px-8 pb-4">
            <div className="flex items-center gap-3" data-testid="voice-selector">
              <span className="text-[11px] text-white uppercase tracking-wide">Voice</span>
              <select
                value={voice}
                onChange={(e) => { const v = e.target.value as Voice; setVoice(v); voiceRef.current = v; localStorage.setItem('pdf-reader-voice', v); }}
                className="bg-white/10 text-white text-sm rounded-lg px-3 py-2 border border-white/30 focus:outline-none focus:border-white/50 cursor-pointer w-[280px]"
                data-testid="select-voice"
              >
                {(["alloy","ash","echo","fable","onyx"] as Voice[]).map(v => (
                  <option key={v} value={v} className="bg-gray-900 text-white">{VOICE_LABELS[v]}</option>
                ))}
              </select>
              <button
                className="p-1.5 rounded-full hover:bg-white/15 transition-colors border border-white/30"
                onClick={previewVoice}
                data-testid="button-preview-voice"
                title="Preview voice"
              >
                {isPreviewing ? <Square className="h-4 w-4 text-white fill-white" /> : <Volume2 className="h-4 w-4 text-white" />}
              </button>
            </div>

            <div className="flex items-center gap-3" data-testid="speed-control">
              <span className="text-[11px] text-white uppercase tracking-wide">Speed</span>
              <button
                className="w-6 h-6 flex items-center justify-center text-sm text-white font-bold rounded-full border border-white/30 hover:bg-white/15 transition-colors"
                onClick={() => setPlaybackSpeed(Math.max(0.5, +(playbackSpeed - 0.25).toFixed(2)))}
                data-testid="button-speed-down"
              >−</button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.25"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-24 h-[3px] cursor-pointer"
                style={{ accentColor: 'white' }}
                data-testid="slider-speed"
              />
              <button
                className="w-6 h-6 flex items-center justify-center text-sm text-white font-bold rounded-full border border-white/30 hover:bg-white/15 transition-colors"
                onClick={() => setPlaybackSpeed(Math.min(3, +(playbackSpeed + 0.25).toFixed(2)))}
                data-testid="button-speed-up"
              >+</button>
              <span className="text-sm text-white font-semibold min-w-[40px] text-center" style={{ marginLeft: '-2px' }} data-testid="text-speed">{playbackSpeed}x</span>
            </div>

            <div className="flex items-center gap-3" data-testid="volume-control">
              <span className="text-[11px] text-white uppercase tracking-wide">Volume</span>
              <button
                className="w-6 h-6 flex items-center justify-center text-sm text-white font-bold rounded-full border border-white/30 hover:bg-white/15 transition-colors"
                onClick={() => setVolume(Math.max(0, +(volume - 0.1).toFixed(2)))}
                data-testid="button-volume-down"
              >−</button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-[3px] cursor-pointer"
                style={{ accentColor: 'white' }}
                data-testid="slider-volume"
              />
              <button
                className="w-6 h-6 flex items-center justify-center text-sm text-white font-bold rounded-full border border-white/30 hover:bg-white/15 transition-colors"
                onClick={() => setVolume(Math.min(1, +(volume + 0.1).toFixed(2)))}
                data-testid="button-volume-up"
              >+</button>
              <Volume2 className="h-5 w-5 text-white" />
            </div>

            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              onClick={async () => {
                try {
                  const testBtn = document.querySelector('[data-testid="button-test-audio"]');
                  if (testBtn) testBtn.textContent = 'Playing...';
                  const res = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: 'Audio test successful. If you can hear this through the Echo speaker, Bluetooth is working correctly.', voice }),
                  });
                  if (!res.ok) throw new Error('TTS failed');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const testAudio = new Audio(url);
                  testAudio.volume = volumeRef.current;
                  testAudio.onended = () => {
                    URL.revokeObjectURL(url);
                    const btn = document.querySelector('[data-testid="button-test-audio"]');
                    if (btn) btn.textContent = '🔊 Test Audio';
                  };
                  await testAudio.play();
                } catch {
                  const btn = document.querySelector('[data-testid="button-test-audio"]');
                  if (btn) btn.textContent = 'Test Failed';
                  setTimeout(() => { if (btn) btn.textContent = '🔊 Test Audio'; }, 2000);
                }
              }}
              data-testid="button-test-audio"
            >🔊 Test Audio</button>
          </div>

          {allFiles.length > 1 && (() => {
            const allChunkProgress = JSON.parse(localStorage.getItem('allChunkProgress') || '{}');
            let totalFilesComplete = 0;
            let totalChunksAll = 0;
            let totalCheckedAll = 0;
            for (const f of allFiles) {
              const fileKey = `onedrive_${btoa(f.downloadUrl).slice(0, 40)}`;
              const progress = allChunkProgress[fileKey];
              if (progress && progress.total > 0) {
                totalChunksAll += progress.total;
                totalCheckedAll += progress.checked;
                if (progress.checked >= progress.total) totalFilesComplete++;
              } else if (listenedFiles.has(f.path)) {
                totalFilesComplete++;
              }
            }
            if (fileId === null && (currentFileUrl || oneDriveUrl)) {
              const currentKey = getFileKey();
              if (allChunkProgress[currentKey]) {
                const existing = allChunkProgress[currentKey];
                totalChunksAll = totalChunksAll - existing.total + totalChunks;
                totalCheckedAll = totalCheckedAll - existing.checked + checkedChunks.size;
              }
            }
            const folderPct = totalChunksAll > 0 ? Math.round((totalCheckedAll / totalChunksAll) * 100) : 
              (allFiles.length > 0 ? Math.round((totalFilesComplete / allFiles.length) * 100) : 0);
            return (
              <div className="px-6 pb-2" data-testid="progress-all-files">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] text-white/70">All Files ({allFiles.length})</span>
                  <span className="text-[9px] text-white/70">{totalFilesComplete}/{allFiles.length} ({folderPct}%)</span>
                </div>
                <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-400 h-full transition-all duration-300 rounded-full" style={{ width: `${folderPct}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>}
    </div>
  );
}
