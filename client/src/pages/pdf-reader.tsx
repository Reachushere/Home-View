import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  RefreshCw,
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
  Minimize2,
  Minus,
  GripHorizontal,
  ArrowDownToLine
} from "lucide-react";
import type { FileRecord } from "@shared/schema";
import { getWeekNumber } from "@shared/schema";
import tmuBgPath from "@assets/TMU2_1772842397746.png";
import dragTabPath from "@assets/drag-tab.svg";

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
  const urlParams = new URLSearchParams(window.location.search);
  const queryFileId = urlParams.get("fileId") ? parseInt(urlParams.get("fileId")!) : null;
  const fileId = params?.fileId && params.fileId !== "onedrive" ? parseInt(params.fileId) : (queryFileId || null);
  
  const oneDriveUrl = urlParams.get("oneDriveUrl") || urlParams.get("url");
  const oneDriveName = urlParams.get("name");
  const filesParam = urlParams.get("files");
  const courseParam = urlParams.get("course");
  const autoplayParam = urlParams.get("autoplay") === "true" || urlParams.get("autoplay") === "1";
  const speakerParam = urlParams.get("speaker");
  const resumeChunkParam = urlParams.get("resumeChunk") ? parseInt(urlParams.get("resumeChunk")!) : null;
  const catWashFollow = urlParams.get("catWashFollow") === "true";
  const followOnly = urlParams.get("followOnly") === "true";
  const voiceParam = urlParams.get("voice");
  const fullscreenParam = urlParams.get("fullscreen") === "true";
  const autoplayTriggeredRef = useRef(
    !autoplayParam ? false :
    catWashFollow ? false :
    sessionStorage.getItem(`autoplay_consumed_${fileId}_${resumeChunkParam}`) === 'true'
  );

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
    if (!fullscreenParam && !catWashFollow) return;
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        const el = document.documentElement as any;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (req) req.call(el).catch(() => {});
      }
    };
    enterFullscreen();
    setTimeout(() => enterFullscreen(), 500);
    setTimeout(() => enterFullscreen(), 1500);
    setTimeout(() => {
      document.body.click();
      enterFullscreen();
    }, 2000);
    const onInteraction = () => {
      enterFullscreen();
    };
    document.addEventListener('touchstart', onInteraction);
    document.addEventListener('click', onInteraction);
    const recheckInterval = setInterval(() => {
      if (!document.fullscreenElement) enterFullscreen();
    }, 2000);
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    const handleVisChange = () => {
      if (!document.hidden) {
        enterFullscreen();
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () => {
      clearInterval(recheckInterval);
      document.removeEventListener('touchstart', onInteraction);
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('visibilitychange', handleVisChange);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [fullscreenParam, catWashFollow]);

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
    if (voiceParam && ["alloy","ash","echo","fable","onyx"].includes(voiceParam)) return voiceParam as Voice;
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
  const [catWashPaused, setCatWashPaused] = useState(false);
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
  const [selectedSpeaker, setSelectedSpeaker] = useState(speakerParam || "browser_tts");
  const selectedSpeakerRef = useRef(selectedSpeaker);
  const [volumeOverlay, setVolumeOverlay] = useState<{ volume: number; direction: string } | null>(null);
  const volumeOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVolumeTimestampRef = useRef<number>(0);

  const [ctrlFloating, setCtrlFloating] = useState<{ detached: boolean; minimized: boolean; x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('pdfReaderCtrlFloating');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { detached: false, minimized: false, x: 100, y: 100 };
  });
  const ctrlDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('pdfReaderCtrlFloating', JSON.stringify(ctrlFloating));
  }, [ctrlFloating]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const d = ctrlDragRef.current;
      if (!d) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const newX = Math.max(0, Math.min(window.innerWidth - 200, d.origX + (clientX - d.startX)));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, d.origY + (clientY - d.startY)));
      setCtrlFloating(prev => ({ ...prev, x: newX, y: newY }));
    };
    const onUp = () => { ctrlDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const ctrlDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctrlDragRef.current = { startX: clientX, startY: clientY, origX: ctrlFloating.x, origY: ctrlFloating.y };
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
  const pdfDocRef = useRef<any>(null);
  const isExtractingRef = useRef(false);
  const audioDurationRef = useRef<number>(0);
  const currentChunkRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const playingAttentionPromptRef = useRef<boolean>(false);
  const attentionPromptBlobUrlRef = useRef<string | null>(null);
  const playbackSpeedRef = useRef<number>(1);
  const volumeRef = useRef<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const queryClient = useQueryClient();
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

    let canvasInited = false;
    let cW = 0;
    let cH = 0;
    const barCount = 24;
    const gap = 2;

    const drawWaveform = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) {
        animFrameRef.current = requestAnimationFrame(drawWaveform);
        return;
      }

      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      if (!canvasInited || canvas.offsetWidth !== cW || canvas.offsetHeight !== cH) {
        const dpr = window.devicePixelRatio || 1;
        cW = canvas.offsetWidth;
        cH = canvas.offsetHeight;
        canvas.width = cW * dpr;
        canvas.height = cH * dpr;
        canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvasInited = true;
      }

      const bufLen = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, cW, cH);

      const barWidth = Math.max(2, (cW - (barCount - 1) * gap) / barCount);
      const centerY = cH / 2;

      for (let i = 0; i < barCount; i++) {
        const dataIdx = Math.floor((i / barCount) * bufLen);
        const val = dataArray[dataIdx] / 255;
        const barH = Math.max(2, val * centerY * 0.85);
        const x = i * (barWidth + gap);
        const alpha = 0.3 + val * 0.7;
        const lightness = 70 + val * 30;

        canvasCtx.fillStyle = `hsla(200, 90%, ${Math.round(lightness)}%, ${alpha.toFixed(2)})`;
        canvasCtx.shadowColor = `hsla(200, 100%, 80%, ${(val * 0.6).toFixed(2)})`;
        canvasCtx.shadowBlur = val * 6;

        canvasCtx.fillRect(Math.round(x), Math.round(centerY - barH), Math.round(barWidth), Math.round(barH));
        canvasCtx.fillRect(Math.round(x), Math.round(centerY + 1), Math.round(barWidth), Math.round(barH));

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
  const audioUnlockedRef = useRef(false);
  const unlockAudio = async () => {
    if (audioUnlockedRef.current) return;
    const tryUnlock = async () => {
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
          console.log("[Autoplay] AudioContext state:", ctx.state);
        }
        if (audioRef.current) {
          audioRef.current.muted = true;
          audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.muted = false;
          audioRef.current.src = "";
          audioUnlockedRef.current = true;
          console.log("[Autoplay] Audio element unlocked");
        }
      } catch (e) {
        console.log("[Autoplay] Audio unlock attempt:", e);
      }
    };
    await tryUnlock();
    if (!audioUnlockedRef.current) {
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      await tryUnlock();
    }
  };

  useEffect(() => {
    if (!autoplayParam) return;
    const tapToUnlock = async () => {
      await unlockAudio();
      if (audioUnlockedRef.current) {
        document.removeEventListener('click', tapToUnlock);
        document.removeEventListener('touchend', tapToUnlock);
      }
    };
    document.addEventListener('click', tapToUnlock, { once: true });
    document.addEventListener('touchend', tapToUnlock, { once: true });

    const retryInterval = setInterval(async () => {
      if (audioUnlockedRef.current) { clearInterval(retryInterval); return; }
      await unlockAudio();
    }, 1000);
    setTimeout(() => clearInterval(retryInterval), 15000);
    return () => {
      clearInterval(retryInterval);
      document.removeEventListener('click', tapToUnlock);
      document.removeEventListener('touchend', tapToUnlock);
    };
  }, [autoplayParam]);

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
          if (data.volumeChange && data.volumeChange.timestamp > lastVolumeTimestampRef.current) {
            lastVolumeTimestampRef.current = data.volumeChange.timestamp;
            setVolumeOverlay({ volume: data.volumeChange.volume, direction: data.volumeChange.direction });
            if (volumeOverlayTimerRef.current) clearTimeout(volumeOverlayTimerRef.current);
            volumeOverlayTimerRef.current = setTimeout(() => setVolumeOverlay(null), 2500);
          }
        } else {
          setFollowState(null);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [followOnly]);

  useEffect(() => {
    if (!catWashFollow || !autoplayParam) return;
    const pollVolume = async () => {
      try {
        const resp = await fetch("/api/cat-wash/progress");
        const data = await resp.json();
        if (data.volumeChange && data.volumeChange.timestamp > lastVolumeTimestampRef.current) {
          lastVolumeTimestampRef.current = data.volumeChange.timestamp;
          setVolumeOverlay({ volume: data.volumeChange.volume, direction: data.volumeChange.direction });
          if (volumeOverlayTimerRef.current) clearTimeout(volumeOverlayTimerRef.current);
          volumeOverlayTimerRef.current = setTimeout(() => setVolumeOverlay(null), 2500);
        }
      } catch {}
    };
    const interval = setInterval(pollVolume, 800);
    return () => clearInterval(interval);
  }, [catWashFollow, autoplayParam]);

  const lastNavTimestamp = useRef(() => {
    try { return Number(localStorage.getItem('lastNavTimestamp') || '0'); } catch { return 0; }
  });
  useEffect(() => {
    const isFireDevice = /\bSilk\b/i.test(navigator.userAgent) || /\bKF[A-Z]{2,4}\b/.test(navigator.userAgent) || /\bFireTV\b/i.test(navigator.userAgent) || /\bAFT[A-Z]\b/.test(navigator.userAgent);
    if (!isFireDevice) return;
    const isFireTV = /\bFireTV\b/i.test(navigator.userAgent) || /\bAFT[A-Z]\b/.test(navigator.userAgent);
    const deviceRole = (() => { try { return localStorage.getItem('tabletDeviceRole'); } catch { return null; } })() || (isFireTV ? 'tv' : (followOnly ? 'follower' : 'master'));
    const saved = lastNavTimestamp.current;
    lastNavTimestamp.current = typeof saved === 'function' ? saved() : saved;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/tablet-nav?device=${deviceRole}`);
        const data = await resp.json();
        if (data.timestamp <= lastNavTimestamp.current) return;
        if (Date.now() - data.timestamp > 120000) return;
        if (data.action === 'navigate' && data.url) {
          lastNavTimestamp.current = data.timestamp;
          try { localStorage.setItem('lastNavTimestamp', String(data.timestamp)); } catch {}
          fetch('/api/tablet-nav/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: data.timestamp, device: deviceRole }) }).catch(() => {});
          window.location.href = data.url;
        } else if (data.action === 'stop_playback') {
          lastNavTimestamp.current = data.timestamp;
          try { localStorage.setItem('lastNavTimestamp', String(data.timestamp)); } catch {}
          fetch('/api/tablet-nav/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: data.timestamp, device: deviceRole }) }).catch(() => {});
          console.log('[TabletNav] Received stop_playback command');
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
          }
          isPlayingRef.current = false;
          setIsPlaying(false);
          if (data.goodbyeText) {
            try {
              const goodbyeAudio = new Audio();
              const ttsResp = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: data.goodbyeText, voice: 'echo' }) });
              if (ttsResp.ok) {
                const blob = await ttsResp.blob();
                const url = URL.createObjectURL(blob);
                goodbyeAudio.src = url;
                goodbyeAudio.volume = 1;
                goodbyeAudio.playbackRate = 1;
                console.log('[TabletNav] Playing goodbye TTS...');
                await goodbyeAudio.play();
                await new Promise<void>(resolve => {
                  goodbyeAudio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                  setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 15000);
                });
                console.log('[TabletNav] Goodbye TTS finished');
              }
            } catch (e) {
              console.log('[TabletNav] Goodbye TTS failed:', e);
            }
          }
          window.location.href = '/';
        } else if (data.action === 'go_home') {
          lastNavTimestamp.current = data.timestamp;
          try { localStorage.setItem('lastNavTimestamp', String(data.timestamp)); } catch {}
          fetch('/api/tablet-nav/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: data.timestamp, device: deviceRole }) }).catch(() => {});
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
    enabled: !!fileId,
  });

  useEffect(() => {
    if (file?.extractedText && !extractedText) {
      console.log(`[TTS] Loading pre-extracted text from DB: ${file.extractedText.length} chars`);
      setExtractedText(file.extractedText);
    }
  }, [file?.extractedText]);

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

  const beacon = (step: string, data?: any) => {
    if (!catWashFollow) return;
    fetch("/api/debug-beacon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, data }) }).catch(() => {});
  };

  useEffect(() => {
    if (autoplayParam && !autoplayTriggeredRef.current && pdfUrl && numPages > 0) {
      autoplayTriggeredRef.current = true;
      beacon("autoplay-triggered", { catWashFollow, numPages, pdfUrl: !!pdfUrl, fileId });
      const key = `autoplay_consumed_${fileId}_${resumeChunkParam}`;
      try { sessionStorage.setItem(key, 'true'); } catch {}
      const doAutoplay = async () => {
        beacon("autoplay-unlocking-audio");
        await unlockAudio();
        beacon("autoplay-calling-startReading");
        startReading();
      };
      doAutoplay();
    }
  }, [autoplayParam, pdfUrl, numPages]);

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
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
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
      if (chunksRef.current.length === 0) {
        const preChunks = chunkText(cleanedText);
        chunksRef.current = preChunks;
        setChunksList(preChunks);
        setTotalChunks(preChunks.length);
        const key = getFileKey();
        let finalChecked = new Set<number>();
        if (!skipCheckedReloadRef.current) {
          let serverChecked = new Set<number>();
          if (file?.checkedChunks) {
            try { const arr = JSON.parse(file.checkedChunks); if (Array.isArray(arr)) serverChecked = new Set(arr); } catch {}
          }
          finalChecked = serverChecked.size > 0 ? serverChecked : new Set<number>();
          setCheckedChunks(finalChecked);
          if (finalChecked.size > 0) saveCheckedChunks(key, finalChecked, preChunks.length);
        }
        console.log("Pre-populated chunks:", preChunks.length);

        const firstUnlistened = preChunks.findIndex((_, idx) => !finalChecked.has(idx));
        const preloadIdx = firstUnlistened >= 0 ? firstUnlistened : 0;
        if (preChunks[preloadIdx] && !ttsPreloadCache.current[preloadIdx]) {
          console.log(`[TTS] Pre-fetching audio for chunk ${preloadIdx + 1}...`);
          fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: preChunks[preloadIdx], voice: voiceRef.current || 'echo' }),
          }).then(r => r.ok ? r.blob() : null).then(blob => {
            if (blob) {
              ttsPreloadCache.current[preloadIdx] = URL.createObjectURL(blob);
              console.log(`[TTS] Pre-fetched chunk ${preloadIdx + 1} audio ready`);
            }
          }).catch(() => {});
        }
      }
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

  const chunkText = (text: string, maxLength: number = 1000): string[] => {
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
    beacon("playTTS-enter", { textLen: text?.length || 0, retry: retryCount, isPlaying: isPlayingRef.current });
    if (!isPlayingRef.current) {
      beacon("playTTS-aborted-not-playing");
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
        if (!isPlayingRef.current) return false;
        beacon("playTTS-blob-received", { size: audioBlob.size });
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
        
        if (!isPlayingRef.current) {
          console.log('[TTS] Stopped before play — aborting');
          return false;
        }
        beacon("playTTS-calling-play");
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('[TTS] Resumed visualizer AudioContext');
        }

        audioRef.current.onerror = (e) => {
          console.error('[TTS] Audio element error:', e, audioRef.current?.error);
        };

        await audioRef.current.play();
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.volume = volumeRef.current;
        beacon("playTTS-playing-success");
        console.log(`[TTS] Playing: speed=${audioRef.current.playbackRate}, vol=${audioRef.current.volume}`);

        await new Promise<void>((resolve) => {
          if (!audioRef.current) { resolve(); return; }
          const onEnd = () => {
            audioRef.current?.removeEventListener('ended', onEnd);
            resolve();
          };
          audioRef.current.addEventListener('ended', onEnd);
        });
      }
      return true;
    } catch (error: any) {
      beacon("playTTS-ERROR", { msg: error?.message || String(error), retry: retryCount });
      if (!isPlayingRef.current) return false;
      console.error(`[TTS] Error (attempt ${retryCount + 1}):`, error);
      if (retryCount < 5 && isPlayingRef.current) {
        const delay = retryCount < 2 ? 2000 : 3000;
        console.log(`[TTS] Retrying in ${delay/1000}s (attempt ${retryCount + 2}/6)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        if (!isPlayingRef.current) return false;
        audioUnlockedRef.current = false;
        await unlockAudio();
        return playTTS(text, retryCount + 1);
      }
      return false;
    }
  };
  
  const lastReportedWordRef = useRef(-1);
  const highlightRafRef = useRef<number | null>(null);
  const pollWordHighlight = () => {
    handleTimeUpdate();
    highlightRafRef.current = requestAnimationFrame(pollWordHighlight);
  };
  useEffect(() => {
    if (isPlaying && !isPaused) {
      highlightRafRef.current = requestAnimationFrame(pollWordHighlight);
    } else {
      if (highlightRafRef.current) { cancelAnimationFrame(highlightRafRef.current); highlightRafRef.current = null; }
    }
    return () => { if (highlightRafRef.current) { cancelAnimationFrame(highlightRafRef.current); highlightRafRef.current = null; } };
  }, [isPlaying, isPaused]);
  const wordWeightsRef = useRef<number[]>([]);
  const wordCumulativeRef = useRef<number[]>([]);

  useEffect(() => {
    if (chunkWords.length === 0) return;
    const weights = chunkWords.map((w: string) => {
      const base = Math.max(w.replace(/[^a-zA-Z]/g, '').length, 1);
      const hasPause = /[.!?;:]$/.test(w) ? 2.5 : /[,]$/.test(w) ? 1.3 : 0;
      return base + hasPause;
    });
    const total = weights.reduce((a: number, b: number) => a + b, 0);
    const cumulative: number[] = [];
    let sum = 0;
    for (const w of weights) {
      sum += w / total;
      cumulative.push(sum);
    }
    wordWeightsRef.current = weights;
    wordCumulativeRef.current = cumulative;
  }, [chunkWords]);

  const handleTimeUpdate = () => {
    if (!audioRef.current || chunkWords.length === 0 || audioDurationRef.current === 0) return;
    
    var currentTime = audioRef.current.currentTime;
    var duration = audioDurationRef.current;
    var progress = Math.max(0, (currentTime / duration) - (1 / 180));
    
    var estimatedWordIndex: number;
    const cumulative = wordCumulativeRef.current;
    if (cumulative.length === chunkWords.length) {
      estimatedWordIndex = cumulative.findIndex((c: number) => c >= progress);
      if (estimatedWordIndex === -1) estimatedWordIndex = chunkWords.length - 1;
    } else {
      estimatedWordIndex = Math.floor(progress * chunkWords.length);
    }
    var clampedIndex = Math.min(estimatedWordIndex, chunkWords.length - 1);
    
    if (clampedIndex !== currentWordIndex) {
      setCurrentWordIndex(clampedIndex);
      if (clampedIndex % 3 === 0 || clampedIndex === chunkWords.length - 1) {
        const activeWord = document.querySelector(`[data-word-index="${clampedIndex}"]`);
        if (activeWord) activeWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (catWashFollow && fileId && clampedIndex !== lastReportedWordRef.current) {
        lastReportedWordRef.current = clampedIndex;
        const currentChunkWords = chunksRef.current[currentChunkRef.current]?.split(/\s+/).filter((w: string) => w.length > 0) || [];
        fetch("/api/cat-wash/update-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, chunkIndex: currentChunkRef.current, totalChunks: chunksRef.current.length, words: currentChunkWords, wordIndex: clampedIndex, chunkText: chunksRef.current[currentChunkRef.current] }),
        }).catch(() => {});
      }
    }
  };

  const skipCheckedReloadRef = useRef(false);
  const resetStartRef = useRef(false);
  const startReading = async () => {
    beacon("startReading-begin", { fileId });
    await unlockAudio();
    markCurrentFileListened();
    
    let textToRead = extractedTextRef.current || extractedText;
    beacon("startReading-cached-text", { hasText: !!textToRead, len: textToRead?.length || 0 });
    
    if (!textToRead) {
      beacon("startReading-extracting");
      textToRead = await extractAllText();
      beacon("startReading-extracted", { len: textToRead?.length || 0 });
    }
    
    if (!textToRead && fileId) {
      beacon("startReading-server-fallback");
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
      beacon("startReading-NO-TEXT");
      toast({
        title: "No text found",
        description: "Could not extract text from this PDF. Make sure the PDF is loaded.",
        variant: "destructive",
      });
      return;
    }

    const newChunks = chunkText(textToRead);
    beacon("startReading-chunked", { numChunks: newChunks.length, resumeChunkParam });
    chunksRef.current = newChunks;
    setChunksList(newChunks);
    setTotalChunks(newChunks.length);
    const key = getFileKey();
    if (skipCheckedReloadRef.current) {
      skipCheckedReloadRef.current = false;
    } else {
      let serverChecked = new Set<number>();
      if (file?.checkedChunks) {
        try { const arr = JSON.parse(file.checkedChunks); if (Array.isArray(arr)) serverChecked = new Set(arr); } catch {}
      }
      const finalChecked = serverChecked.size > 0 ? serverChecked : new Set<number>();
      setCheckedChunks(finalChecked);
      if (finalChecked.size > 0) saveCheckedChunks(key, finalChecked, newChunks.length);
    }
    const mergedForStart = resetStartRef.current ? new Set<number>() : checkedChunks;
    resetStartRef.current = false;
    let startChunk = (resumeChunkParam !== null && resumeChunkParam < newChunks.length) ? resumeChunkParam : 0;
    if (mergedForStart.size > 0 && startChunk === 0) {
      const firstUnchecked = newChunks.findIndex((_, idx) => !mergedForStart.has(idx));
      if (firstUnchecked >= 0) {
        startChunk = firstUnchecked;
        console.log(`[TTS] Skipping ${mergedForStart.size} checked chunks, starting at chunk ${startChunk}`);
      }
    }
    if (startChunk > 0) {
      console.log(`[TTS] Resuming from chunk ${startChunk}`);
    }
    setCurrentChunk(startChunk);
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;

    if (!attentionPromptBlobUrlRef.current && !catWashFollow && !speakerParam) {
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Bryn, are you paying attention?", voice }),
      }).then(r => r.ok ? r.blob() : null).then(blob => {
        if (blob) {
          attentionPromptBlobUrlRef.current = URL.createObjectURL(blob);
          console.log(`[TTS] Pre-cached attention prompt (${blob.size} bytes)`);
        }
      }).catch(() => {});
    }
    
    beacon("startReading-calling-playNextChunk", { startChunk, isPlaying: isPlayingRef.current, checkedCount: mergedChecked.size });

    if (catWashFollow && file) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      const folder = file.folder || '';
      const weekMatch = folder.match(/week-(\d+)/i);
      const weekNum = weekMatch ? weekMatch[1] : null;
      const isModule = folder.toLowerCase().includes('module');
      const courseMatch = folder.match(/(?:cppa|cfnf|casl|csoc|cphl)\d*/i);
      const courseCode = courseMatch ? courseMatch[0].toUpperCase() : '';
      const raw = file.displayName || file.originalName || '';
      const cleanName = raw.replace(/\.pdf$/i, '').replace(/,\s*(Module|Reading)\s*\d+[-_,\s]*/i, ', ').replace(/[-_]\s*Introduction/i, '').replace(/\s+/g, ' ').trim();

      let introText: string;
      if (isModule && weekNum) {
        introText = `${greeting} Bryn. I will now read the ${courseCode} module for week ${weekNum}.`;
      } else if (weekNum) {
        introText = `${greeting} Bryn. I will now read the ${courseCode} reading file: ${cleanName}.`;
      } else {
        introText = `${greeting} Bryn. I will now read: ${cleanName}.`;
      }

      if (startChunk > 0) {
        introText += ` Resuming from chunk ${startChunk + 1}.`;
      }

      console.log(`[TTS] Playing intro: ${introText}`);
      await playTTS(introText);
      if (!isPlayingRef.current) return;
    }

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
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
        }).catch(() => {});
      }
      return newChecked;
    });
  };

  const playNextChunk = async (index: number) => {
    beacon("playNextChunk-enter", { index, chunksLen: chunksRef.current.length, isPlaying: isPlayingRef.current });
    if (index > 0) {
      markChunkChecked(index - 1);
    }
    if (!isPlayingRef.current) {
      beacon("playNextChunk-aborted-not-playing");
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
        if (fileId) {
          try {
            await fetch(`/api/files/${fileId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listened: true, lastChunkIndex: chunksRef.current.length, totalChunks: chunksRef.current.length }),
            });
            queryClient.invalidateQueries({ queryKey: ['/api/files'] });
          } catch (e) {
            console.error('Failed to mark file as listened:', e);
          }
        }
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

    const scrollToChunk = () => {
      const chunkRow = document.querySelector(`[data-testid="chunk-row-${index}"]`);
      if (chunkRow) chunkRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    setTimeout(scrollToChunk, 100);
    setTimeout(scrollToChunk, 400);
    setTimeout(scrollToChunk, 800);

    if (index + 1 < chunksRef.current.length && !ttsPreloadCache.current[index + 1]) {
      const nextText = chunksRef.current[index + 1];
      const nextVoice = voiceRef.current || voice;
      fetch("/api/tts", {
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
    if (!isPlayingRef.current) return;
    if (!success) {
      console.log(`[TTS] Chunk ${index + 1} failed after retries, skipping to next chunk`);
      toast({ title: "Skipped chunk", description: `Chunk ${index + 1} failed, moving to next` });
    }
    if (index >= 2 && index < chunksRef.current.length - 1 && (index + 1) % 3 === 0 && !playingAttentionPromptRef.current) {
      playingAttentionPromptRef.current = true;
      console.log(`[TTS] Playing attention prompt after chunk ${index + 1}`);
      if (catWashFollow || speakerParam) {
        try {
          await fetch("/api/media/attention-prompt", { method: "POST" });
          await new Promise(r => setTimeout(r, 4000));
        } catch (e) {
          console.log(`[TTS] Attention prompt server call failed:`, e);
        }
      } else {
        if (!attentionPromptBlobUrlRef.current) {
          try {
            console.log(`[TTS] Generating attention prompt audio (first time)`);
            const resp = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: "Bryn, are you paying attention?", voice }),
            });
            if (resp.ok) {
              const blob = await resp.blob();
              attentionPromptBlobUrlRef.current = URL.createObjectURL(blob);
              console.log(`[TTS] Attention prompt cached (${blob.size} bytes)`);
            }
          } catch (e) {
            console.log(`[TTS] Failed to pre-generate attention prompt:`, e);
          }
        }
        if (attentionPromptBlobUrlRef.current) {
          console.log(`[TTS] Playing cached attention prompt (separate audio)`);
          await new Promise<void>((resolve) => {
            const tempAudio = new Audio(attentionPromptBlobUrlRef.current!);
            tempAudio.volume = volumeRef.current;
            tempAudio.playbackRate = 1;
            tempAudio.onended = () => { tempAudio.remove(); resolve(); };
            tempAudio.onerror = () => { tempAudio.remove(); resolve(); };
            tempAudio.play().catch(() => { tempAudio.remove(); resolve(); });
          });
        } else {
          console.log(`[TTS] Playing attention prompt via separate audio fetch`);
          await new Promise<void>(async (resolve) => {
            try {
              const resp = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: "Bryn, are you paying attention?", voice }),
              });
              if (resp.ok) {
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                attentionPromptBlobUrlRef.current = url;
                const tempAudio = new Audio(url);
                tempAudio.volume = volumeRef.current;
                tempAudio.onended = () => { tempAudio.remove(); resolve(); };
                tempAudio.onerror = () => { tempAudio.remove(); resolve(); };
                tempAudio.play().catch(() => { tempAudio.remove(); resolve(); });
              } else { resolve(); }
            } catch { resolve(); }
          });
        }
      }
      playingAttentionPromptRef.current = false;
    }
    if (isPlayingRef.current) {
      playNextChunk(index + 1);
    }
  };

  const handleAudioEnded = async () => {
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

    try {
      const utterance = new SpeechSynthesisUtterance('Stop received');
      utterance.rate = 1.1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    } catch {}


    const savedChunk = currentChunkRef.current;

    if (fileId && savedChunk > 0) {
      fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastChunkIndex: savedChunk, totalChunks: totalChunks })
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      }).catch(e => console.error('Failed to save progress:', e));
    }

    if (catWashFollow || speakerParam) {
      fetch("/api/webhook/voice-command", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: "stop" }) })
        .then(() => { setFollowState(null); setCatWashPaused(false); })
        .catch(e => console.error('Failed to stop server-side playback:', e));
    }
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

  const restartFromBeginning = async () => {
    skipCheckedReloadRef.current = true;
    resetStartRef.current = true;
    const key = getFileKey();
    const emptySet = new Set<number>();
    setCheckedChunks(emptySet);
    setCurrentChunk(0);
    currentChunkRef.current = 0;
    localStorage.removeItem(`checkedChunks_${key}`);
    localStorage.removeItem(`chunkProgress_${key}`);
    const allProgress = JSON.parse(localStorage.getItem('allChunkProgress') || '{}');
    delete allProgress[key];
    localStorage.setItem('allChunkProgress', JSON.stringify(allProgress));
    if (fileId) {
      try {
        await fetch(`/api/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkedChunks: '[]', lastChunkIndex: 0, totalChunks, listened: false }),
        });
        console.log(`[Reset] Server progress cleared for file ${fileId}`);
        queryClient.setQueryData(['/api/files', fileId], (old: any) => old ? { ...old, checkedChunks: '[]', lastChunkIndex: 0, listened: false } : old);
        queryClient.setQueryData(['/api/files'], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map((f: any) => f.id === Number(fileId) ? { ...f, checkedChunks: '[]', lastChunkIndex: 0, listened: false } : f);
        });
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
        queryClient.invalidateQueries({ queryKey: ['/api/files', fileId] });
      } catch (e) {
        console.error(`[Reset] Failed to clear server progress:`, e);
      }
    }
    skipCheckedReloadRef.current = true;
    startReading();
  };

  const restartCurrentChunk = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const idx = currentChunkRef.current;
    console.log(`[TTS] Restart current chunk ${idx}`);
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    playNextChunk(idx);
  };

  const skipBack = () => {
    if (currentChunkRef.current > 0) {
      try {
        const utterance = new SpeechSynthesisUtterance('previous chunk');
        utterance.rate = 1.1;
        utterance.volume = 0.8;
        speechSynthesis.speak(utterance);
      } catch {}

      if (catWashFollow || speakerParam) {
        fetch("/api/media/skip-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction: "backward" }),
        }).catch(e => console.error('[TTS] Server skip back failed:', e));
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const prevChunk = currentChunkRef.current - 1;
      console.log(`[TTS] Skip back to chunk ${prevChunk}`);
      setCurrentChunk(prevChunk);
      currentChunkRef.current = prevChunk;
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      playNextChunk(prevChunk);
    }
  };

  const skipForward = () => {
    if (currentChunkRef.current < totalChunks - 1) {
      try {
        const utterance = new SpeechSynthesisUtterance('next chunk');
        utterance.rate = 1.1;
        utterance.volume = 0.8;
        speechSynthesis.speak(utterance);
      } catch {}

      if (catWashFollow || speakerParam) {
        fetch("/api/media/skip-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction: "forward" }),
        }).catch(e => console.error('[TTS] Server skip forward failed:', e));
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const nextChunk = currentChunkRef.current + 1;
      console.log(`[TTS] Skip forward to chunk ${nextChunk}`);
      setCurrentChunk(nextChunk);
      currentChunkRef.current = nextChunk;
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
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
      let loaded = new Set<number>();
      if (!skipCheckedReloadRef.current) {
        let serverChecked = new Set<number>();
        if (file?.checkedChunks) {
          try { const arr = JSON.parse(file.checkedChunks); if (Array.isArray(arr)) serverChecked = new Set(arr); } catch {}
        }
        loaded = serverChecked.size > 0 ? serverChecked : new Set<number>();
        setCheckedChunks(loaded);
      }

      const firstUnlistened = newChunks.findIndex((_, idx) => !loaded.has(idx));
      const preloadIdx = firstUnlistened >= 0 ? firstUnlistened : 0;
      if (newChunks[preloadIdx] && !ttsPreloadCache.current[preloadIdx]) {
        console.log(`[TTS] Auto-preloading chunk ${preloadIdx + 1} audio...`);
        fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newChunks[preloadIdx], voice: voiceRef.current || 'echo' }),
        }).then(r => r.ok ? r.blob() : null).then(blob => {
          if (blob) {
            ttsPreloadCache.current[preloadIdx] = URL.createObjectURL(blob);
            console.log(`[TTS] Chunk ${preloadIdx + 1} audio pre-cached and ready`);
          }
        }).catch(() => {});
      }
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

  const getTimeEstimate = () => {
    if (totalChunks === 0 || !chunksRef.current.length) return null;
    const uncheckedChunks = Array.from({ length: totalChunks }, (_, i) => i).filter(i => !checkedChunks.has(i));
    if (uncheckedChunks.length === 0) return { remaining: '0m', total: '0m', remainingChunks: 0 };
    let totalWords = 0;
    let remainingWords = 0;
    for (let i = 0; i < chunksRef.current.length; i++) {
      const wordCount = chunksRef.current[i].split(/\s+/).filter(w => w.length > 0).length;
      totalWords += wordCount;
      if (!checkedChunks.has(i)) remainingWords += wordCount;
    }
    const wordsPerMinute = 130 * playbackSpeed;
    const totalMinutes = Math.ceil(totalWords / wordsPerMinute);
    const remainingMinutes = Math.ceil(remainingWords / wordsPerMinute);
    const formatTime = (mins: number) => {
      if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      return `${mins}m`;
    };
    return { remaining: formatTime(remainingMinutes), total: formatTime(totalMinutes), remainingChunks: uncheckedChunks.length };
  };


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
  const waveColor = cId === 'cppa122' ? '#47B045' : cId === 'cfnf400' ? '#FA67B3' : cId === 'casl101' ? '#B045A2' : 'rgba(255,255,255,0.8)';
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

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <img src={tmuBgPath} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,15,40,0.15) 0%, rgba(0,10,30,0.25) 100%)' }} />
      <audio ref={audioRef} onEnded={handleAudioEnded} onTimeUpdate={handleTimeUpdate} crossOrigin="anonymous" />

      {volumeOverlay && (
        <div
          data-testid="volume-overlay"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            borderRadius: '16px',
            padding: '24px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.15s ease-out',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '36px', color: 'white' }}>
            {volumeOverlay.direction === 'up' ? '\u{1F50A}' : '\u{1F509}'}
          </div>
          <div style={{ width: '160px', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${volumeOverlay.volume}%`, height: '100%', background: 'white', borderRadius: '4px', transition: 'width 0.15s ease' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
            {volumeOverlay.volume}%
          </div>
        </div>
      )}

      {!followOnly && <div className="relative flex-shrink-0" style={{ zIndex: 10 }}>
        <div className="flex items-center gap-3 px-5 py-1.5 border-b border-white/10 backdrop-blur-sm" style={{ background: controlsBarBg }}>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wide transition-colors bg-white/10 border border-white/20 text-white hover:bg-white/20"
            onClick={() => { window.location.href = '/'; }}
            data-testid="button-exit-player"
            title="Exit to main screen"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exit
          </button>
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
            <Select value={selectedSpeaker} onValueChange={(val) => { setSelectedSpeaker(val); selectedSpeakerRef.current = val; localStorage.setItem('pdf-reader-speaker', val); }}>
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
      </div>}

      <div className="flex-1 flex relative overflow-hidden min-h-0" style={{ zIndex: 2 }}>
        <div className={`${isFullPage ? 'w-full' : 'flex-1 lg:w-1/2'} overflow-auto pdf-reader-scrollbar`} style={{ background: 'rgba(0,0,0,0.4)' }}>
          {!followOnly && <div className="sticky top-0 z-20" style={{ background: 'rgba(0,10,30,0.8)', backdropFilter: 'blur(10px)' }}>
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
          </div>}

          {isEditingText && !followOnly && (
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
              <div className="flex-1 overflow-y-auto px-8 py-6" data-testid="follow-text-display" id="follow-scroll-container">
                {followState.words.length > 0 ? (
                  <p className="text-2xl leading-relaxed">
                    {followState.words.map((word, idx) => (
                      <span key={idx} id={idx === followState.estimatedWordIndex ? "follow-active-word" : undefined} ref={idx === followState.estimatedWordIndex ? (el) => { if (el) { const container = document.getElementById('follow-scroll-container'); if (container) { const elRect = el.getBoundingClientRect(); const contRect = container.getBoundingClientRect(); const elCenter = elRect.top - contRect.top + container.scrollTop; container.scrollTo({ top: elCenter - contRect.height / 3, behavior: 'smooth' }); } } } : undefined} className={`${idx === followState.estimatedWordIndex ? "bg-yellow-400/80 text-black font-bold px-1 rounded" : idx < followState.estimatedWordIndex ? "text-white/25" : "text-white/60"} transition-colors duration-75`}>
                        {word}{" "}
                      </span>
                    ))}
                  </p>
                ) : followState.chunkText ? (
                  <p className="text-2xl leading-relaxed text-white/90">{followState.chunkText}</p>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-lg text-white/40 animate-pulse">Loading text...</span>
                  </div>
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
                <div className="overflow-y-auto p-4 rounded border border-white/10 text-xl leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)', maxHeight: 'calc(100vh - 340px)' }} data-testid="follow-text-display-tablet" id="follow-scroll-container-tablet">
                  {followState.words.map((word, idx) => (
                    <span key={idx} ref={idx === followState.estimatedWordIndex ? (el) => { if (el) { const container = document.getElementById('follow-scroll-container-tablet'); if (container) { const elRect = el.getBoundingClientRect(); const contRect = container.getBoundingClientRect(); const elCenter = elRect.top - contRect.top + container.scrollTop; container.scrollTo({ top: elCenter - contRect.height / 3, behavior: 'smooth' }); } } } : undefined} className={`${idx === followState.estimatedWordIndex ? "bg-yellow-400/80 text-black font-semibold px-0.5 rounded" : idx < followState.estimatedWordIndex ? "text-white/30" : "text-white/60"} transition-colors duration-100`}>
                      {word}{" "}
                    </span>
                  ))}
                </div>
              )}
              <button className="mt-3 text-xs text-red-400 hover:text-red-300 underline" onClick={() => fetch("/api/webhook/voice-command", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: "stop" }) }).then(() => { setFollowState(null); setCatWashPaused(false); })} data-testid="stop-catwash-playback">
                Stop Playback
              </button>
            </div>
          )}

          {catWashFollow && !followOnly && !autoplayParam && !followState?.active && (
            <div className="m-4 p-4 rounded-lg border border-white/10 text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <span className="text-sm text-white/50">{catWashPaused ? 'Paused. Tap play to resume.' : 'Waiting for playback to start...'}</span>
            </div>
          )}

          {!isEditingText && !followOnly && !(catWashFollow && followState?.active) && (
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
                          <Search className="text-white" style={{ width: '20px', height: '20px' }} />
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
                      </div>
                      <div style={{ marginTop: '380px' }}>
                        <button
                          className="transition-colors hover:bg-white/25 flex items-center justify-center"
                          style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', padding: 0 }}
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
            <div className="flex items-center gap-1" style={{ marginRight: '13px' }}>
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
                    <span className="text-[11px] text-white font-medium">{checkedChunks.size} / {totalChunks} Chunks Completed ({chunkProgress}%){(() => { try { const est = getTimeEstimate(); return est ? ` · ${est.remaining} remaining` : ''; } catch { return ''; } })()}</span>
                    <div style={{ width: '130px', marginLeft: '10px' }}>
                      <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${chunkProgress}%`, background: waveColor }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20" onClick={() => { if (currentChunk > 0) { setCurrentChunk(currentChunk - 1); const el = document.querySelector(`[data-testid="chunk-row-${currentChunk - 1}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }} disabled={currentChunk <= 0} data-testid="button-chunk-prev-header">
                      <ChevronLeft className="h-5 w-5" strokeWidth={3} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20" onClick={() => { if (currentChunk < totalChunks - 1) { setCurrentChunk(currentChunk + 1); const el = document.querySelector(`[data-testid="chunk-row-${currentChunk + 1}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }} disabled={currentChunk >= totalChunks - 1} data-testid="button-chunk-next-header">
                      <ChevronRight className="h-5 w-5" strokeWidth={3} />
                    </Button>
                  </div>
                  {checkedChunks.size < totalChunks && (
                    <button
                      className="text-[13px] text-white/70 hover:text-white underline font-semibold shrink-0"
                      style={{ marginRight: '27px' }}
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

      {!followOnly && <div className={ctrlFloating.detached ? "fixed flex flex-col" : "relative flex-shrink-0 flex justify-center"} style={ctrlFloating.detached ? { zIndex: 9999, left: `${ctrlFloating.x}px`, top: `${ctrlFloating.y}px`, width: ctrlFloating.minimized ? '220px' : 'min(95vw, 1200px)', overflow: 'visible', transition: ctrlDragRef.current ? 'none' : 'width 0.25s ease', touchAction: 'none' } : { zIndex: 10, padding: '5px 20px 14px 20px' }}>
        {ctrlFloating.detached && (
          <div
            className="flex items-center justify-between select-none cursor-grab active:cursor-grabbing"
            style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.12)', borderRadius: '10px 10px 0 0', borderBottom: '1px solid rgba(255,255,255,0.15)', touchAction: 'none' }}
            onMouseDown={ctrlDragStart}
            onTouchStart={ctrlDragStart}
            data-testid="ctrl-floating-titlebar"
          >
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="h-4 w-4 text-white/40" />
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">Media Controls</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setCtrlFloating(prev => ({ ...prev, minimized: !prev.minimized })); }}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setCtrlFloating(prev => ({ ...prev, minimized: !prev.minimized })); }}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
                data-testid="ctrl-floating-minimize"
                title={ctrlFloating.minimized ? 'Expand' : 'Minimize'}
              >
                {ctrlFloating.minimized ? <Maximize2 className="h-3 w-3 text-white/70" /> : <Minus className="h-3 w-3 text-white/70" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCtrlFloating(prev => ({ ...prev, detached: false, minimized: false })); }}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setCtrlFloating(prev => ({ ...prev, detached: false, minimized: false })); }}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
                data-testid="ctrl-floating-dock"
                title="Snap back to bottom"
              >
                <ArrowDownToLine className="h-3 w-3 text-white/70" />
              </button>
            </div>
          </div>
        )}
        {(!ctrlFloating.detached || !ctrlFloating.minimized) && <div className={ctrlFloating.detached ? "" : "rounded-2xl mx-auto"} style={ctrlFloating.detached ? { overflow: 'visible', background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(24px)', border: `1px solid ${waveColor}44`, borderTop: 'none', borderRadius: '0 0 16px 16px', maxWidth: '1200px', width: '100%', boxShadow: `0 0 30px ${waveColor}33, 0 0 60px ${waveColor}18, inset 0 1px 0 rgba(255,255,255,0.15)` } : { background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(24px)', border: `1px solid ${waveColor}44`, maxWidth: '1200px', width: '100%', overflow: 'visible', boxShadow: `0 0 30px ${waveColor}33, 0 0 60px ${waveColor}18, inset 0 1px 0 rgba(255,255,255,0.15)` }}>
          <div className="relative px-4 pb-3 pt-2" style={{ overflow: 'visible' }}>
            {!ctrlFloating.detached && (
              <button
                onClick={() => setCtrlFloating(prev => ({ ...prev, detached: true }))}
                onTouchEnd={(e) => { e.preventDefault(); setCtrlFloating(prev => ({ ...prev, detached: true })); }}
                className="absolute z-[70] w-7 h-7 rounded flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors"
                style={{ top: '6px', left: '6px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
                data-testid="ctrl-detach-button"
                title="Pop out controls as floating window"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
              </button>
            )}

            <div className="overflow-hidden rounded-lg mb-2" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${waveColor}33`, height: '28px', position: 'relative' }}>
              <div className="absolute inset-0 flex items-center" style={{ animation: 'ctrl-marquee 18s linear infinite', whiteSpace: 'nowrap', paddingLeft: '100%' }} data-testid="ctrl-scrolling-ticker">
                <span className="text-[12px] font-medium mx-6" style={{ color: waveColor, fontFamily: "'Courier New', monospace", textShadow: `0 0 8px ${waveColor}88` }}>
                  {courseCodeFromFolder ? `${courseCodeFromFolder}` : ''}{courseCodeFromFolder ? ' · ' : ''}{rawFileName?.replace(/\.pdf$/i, '') || 'No file loaded'}{totalChunks > 0 ? ` · Chunk ${currentChunk + 1}/${totalChunks}` : ''}{isPlaying ? ' · ▶ Playing' : isPaused ? ' · ⏸ Paused' : ' · ■ Stopped'}
                </span>
                <span className="text-[12px] font-medium mx-6" style={{ color: waveColor, fontFamily: "'Courier New', monospace", textShadow: `0 0 8px ${waveColor}88` }}>
                  {courseCodeFromFolder ? `${courseCodeFromFolder}` : ''}{courseCodeFromFolder ? ' · ' : ''}{rawFileName?.replace(/\.pdf$/i, '') || 'No file loaded'}{totalChunks > 0 ? ` · Chunk ${currentChunk + 1}/${totalChunks}` : ''}{isPlaying ? ' · ▶ Playing' : isPaused ? ' · ⏸ Paused' : ' · ■ Stopped'}
                </span>
              </div>
            </div>

            {totalChunks > 0 && (
              <div className="mb-2 rounded overflow-hidden" style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }} data-testid="ctrl-chunk-progress">
                <div className="h-full rounded transition-all duration-500" style={{ width: `${chunkProgress}%`, background: `linear-gradient(90deg, ${waveColor} 0%, ${waveColor}CC 100%)`, boxShadow: `0 0 8px ${waveColor}66` }} />
              </div>
            )}

            <div className="flex justify-center mb-1">
              <div style={{ width: '120px', height: '36px', flexShrink: 0 }}>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full pointer-events-none"
                  data-testid="audio-visualizer-canvas"
                />
              </div>
            </div>

            <div className="flex items-center justify-between" style={{ overflow: 'visible', padding: '0 8px' }}>
              <button className="w-10 h-10 flex flex-col items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={restartCurrentChunk} disabled={!isPlaying} title="Restart current chunk" data-testid="button-refresh-chunk-inline">
                <RefreshCw className="h-4 w-4 text-white" />
                <span className="text-[8px] text-white/70 leading-none mt-0.5">Restart</span>
              </button>

              <button className="w-10 h-10 flex flex-col items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={() => {
                setCheckedChunks(new Set());
                setCurrentChunk(0);
                const fileKey = getFileKey();
                const allProgress = JSON.parse(localStorage.getItem('allChunkProgress') || '{}');
                if (allProgress[fileKey]) { allProgress[fileKey] = { total: allProgress[fileKey].total, checked: 0 }; localStorage.setItem('allChunkProgress', JSON.stringify(allProgress)); }
                if (file) { fetch(`/api/files/${file.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastChunkIndex: 0, listened: false }) }); }
              }} disabled={checkedChunks.size === 0} title="Reset all progress" data-testid="button-reset-progress">
                <X className="h-4 w-4 text-white" />
                <span className="text-[8px] text-white/70 leading-none mt-0.5">Reset</span>
              </button>

              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={() => { if (audioRef.current && isPlaying) { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15); } }} disabled={!isPlaying} data-testid="button-rewind-15" title="Rewind 15s">
                <RotateCcw className="h-4 w-4 text-white" />
                <span className="text-[9px] text-white font-medium ml-0.5">15s</span>
              </button>

              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={skipBack} disabled={(!isPlaying && !(catWashFollow && followState?.active)) || currentChunk === 0} data-testid="button-skip-back" title="Previous chunk">
                <SkipBack className="h-5 w-5 text-white" />
              </button>

              {file && file.lastChunkIndex > 0 && !isPlaying && !isPaused ? (
                <button
                  className="w-16 h-16 flex flex-col items-center justify-center rounded-full shrink-0"
                  style={{ outline: `2px solid ${waveColor}66`, outlineOffset: '3px', background: `${waveColor}22` }}
                  onClick={resumeFromLast}
                  disabled={isLoading || numPages === 0}
                  title={`Resume from chunk ${file.lastChunkIndex + 1}${file.totalChunks ? ` of ${file.totalChunks}` : ''}`}
                  data-testid="button-resume"
                >
                  {isLoading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <RotateCcw className="h-6 w-6 text-white" />}
                  <span className="text-[8px] text-white/70 leading-none mt-0.5">Resume</span>
                </button>
              ) : catWashFollow && followState?.active ? (
                <button
                  className="w-16 h-16 flex items-center justify-center rounded-full bg-yellow-600 hover:bg-yellow-500 shrink-0"
                  style={{ outline: '2px solid rgba(255,200,50,0.5)', outlineOffset: '3px' }}
                  onClick={() => {
                    fetch("/api/webhook/voice-command", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: "pause" }) })
                      .then(() => setCatWashPaused(true))
                      .catch(e => console.error('Failed to pause:', e));
                  }}
                  data-testid="button-pause-catwash"
                >
                  <Pause className="h-7 w-7 text-white fill-white" />
                </button>
              ) : catWashFollow && catWashPaused ? (
                <button
                  className="w-16 h-16 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-500 shrink-0"
                  style={{ outline: '2px solid rgba(100,255,100,0.5)', outlineOffset: '3px' }}
                  onClick={() => {
                    fetch("/api/webhook/voice-command", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: "resume" }) })
                      .then(() => setCatWashPaused(false))
                      .catch(e => console.error('Failed to resume:', e));
                  }}
                  data-testid="button-resume-catwash"
                >
                  <Play className="h-7 w-7 text-white fill-white ml-0.5" />
                </button>
              ) : isPlaying && !isPaused ? (
                <button className="w-16 h-16 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 shrink-0" style={{ outline: '2px solid rgba(255,80,80,0.5)', outlineOffset: '3px', boxShadow: '0 0 20px rgba(255,50,50,0.4)' }} onClick={stopReading} data-testid="button-stop-center">
                  <Square className="h-7 w-7 text-white fill-white" />
                </button>
              ) : isPaused ? (
                <button className="w-16 h-16 flex items-center justify-center rounded-full shrink-0" style={{ outline: `2px solid ${waveColor}88`, outlineOffset: '3px', background: waveColor, boxShadow: `0 0 20px ${waveColor}66` }} onClick={resumeReading} data-testid="button-resume-play">
                  <Play className="h-7 w-7 text-white fill-white ml-0.5" />
                </button>
              ) : (
                <button
                  className="w-16 h-16 flex items-center justify-center rounded-full shrink-0"
                  style={{ outline: `2px solid ${waveColor}88`, outlineOffset: '3px', background: waveColor, boxShadow: `0 0 20px ${waveColor}66` }}
                  onClick={startReading}
                  disabled={isLoading || numPages === 0}
                  data-testid="button-play"
                >
                  {isLoading ? <Loader2 className="h-7 w-7 text-white animate-spin" /> : <Play className="h-7 w-7 text-white fill-white ml-0.5" />}
                </button>
              )}

              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={skipForward} disabled={(!isPlaying && !(catWashFollow && followState?.active)) || currentChunk >= totalChunks - 1} data-testid="button-skip-forward-left" title="Next chunk">
                <SkipForward className="h-5 w-5 text-white" />
              </button>

              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={() => { if (audioRef.current && isPlaying) { audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 15); } }} disabled={!isPlaying} data-testid="button-forward-15" title="Forward 15s">
                <span className="text-[9px] text-white font-medium mr-0.5">15s</span>
                <RotateCw className="h-4 w-4 text-white" />
              </button>

              <button className="w-10 h-10 flex flex-col items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 shrink-0" onClick={() => {
                if (catWashFollow && (followState?.active || catWashPaused)) {
                  fetch("/api/webhook/voice-command", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: "stop" }) })
                    .then(() => { setFollowState(null); setCatWashPaused(false); })
                    .catch(e => console.error('Failed to stop:', e));
                } else {
                  stopReading();
                }
              }} disabled={!isPlaying && !(catWashFollow && followState?.active) && !catWashPaused} data-testid="button-stop" title="Stop">
                <Square className="h-4 w-4 text-white fill-white" />
                <span className="text-[8px] text-white/70 leading-none mt-0.5">Stop</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', margin: '0 8px 8px', background: 'rgba(255,255,255,0.07)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center gap-1.5 flex-shrink-0" data-testid="voice-selector">
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Voice</span>
              <select
                value={voice}
                onChange={(e) => { const v = e.target.value as Voice; setVoice(v); voiceRef.current = v; localStorage.setItem('pdf-reader-voice', v); }}
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '11px', borderRadius: '4px', padding: '3px 6px', border: '1px solid rgba(255,255,255,0.2)', outline: 'none', cursor: 'pointer', width: '150px' }}
                data-testid="select-voice"
              >
                {(["alloy","ash","echo","fable","onyx"] as Voice[]).map(v => (
                  <option key={v} value={v} className="bg-gray-900 text-white">{VOICE_LABELS[v]}</option>
                ))}
              </select>
              <button
                style={{ padding: '3px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={previewVoice}
                data-testid="button-preview-voice"
                title="Preview voice"
              >
                {isPreviewing ? <Square className="h-3 w-3 text-white fill-white" /> : <Volume2 className="h-3 w-3 text-white" />}
              </button>
            </div>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

            <div className="flex items-center gap-1.5 flex-shrink-0" data-testid="speed-control">
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Speed</span>
              <button
                style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: 'bold', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer' }}
                onClick={() => setPlaybackSpeed(Math.max(0.5, +(playbackSpeed - 0.1).toFixed(2)))}
                data-testid="button-speed-down"
              >−</button>
              <input
                type="range" min="0.5" max="3" step="0.1" value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                style={{ width: '60px', height: '3px', cursor: 'pointer', accentColor: 'white' }}
                data-testid="slider-speed"
              />
              <button
                style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: 'bold', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer' }}
                onClick={() => setPlaybackSpeed(Math.min(3, +(playbackSpeed + 0.1).toFixed(2)))}
                data-testid="button-speed-up"
              >+</button>
              <span style={{ fontSize: '11px', color: 'white', fontWeight: 600, minWidth: '28px', textAlign: 'center' }} data-testid="text-speed">{playbackSpeed}x</span>
            </div>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

            <div className="flex items-center gap-1.5 flex-shrink-0" data-testid="volume-control">
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume</span>
              <button
                style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: 'bold', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer' }}
                onClick={() => setVolume(Math.max(0, +(volume - 0.1).toFixed(2)))}
                data-testid="button-volume-down"
              >−</button>
              <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ width: '60px', height: '3px', cursor: 'pointer', accentColor: 'white' }}
                data-testid="slider-volume"
              />
              <button
                style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: 'bold', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer' }}
                onClick={() => setVolume(Math.min(1, +(volume + 0.1).toFixed(2)))}
                data-testid="button-volume-up"
              >+</button>
              <Volume2 className="h-3.5 w-3.5 text-white" />
            </div>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

            <button
              style={{ padding: '3px 10px', borderRadius: '4px', background: '#059669', fontSize: '10px', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
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
                    if (btn) btn.textContent = 'Test';
                  };
                  await testAudio.play();
                } catch {
                  const btn = document.querySelector('[data-testid="button-test-audio"]');
                  if (btn) btn.textContent = 'Failed';
                  setTimeout(() => { if (btn) btn.textContent = 'Test'; }, 2000);
                }
              }}
              data-testid="button-test-audio"
            >Test</button>
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
        </div>}
      </div>}
    </div>
  );
}
