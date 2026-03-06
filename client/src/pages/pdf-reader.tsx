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
  Pencil,
  Check,
  X,
  Cast,
  Monitor,
  Speaker
} from "lucide-react";
import type { FileRecord } from "@shared/schema";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

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
  const [autoplayTriggered, setAutoplayTriggered] = useState(false);
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [voice, setVoice] = useState<Voice>("nova");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [chunkWords, setChunkWords] = useState<string[]>([]);
  const [checkedChunks, setCheckedChunks] = useState<Set<number>>(new Set());
  const [chunksList, setChunksList] = useState<string[]>([]);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editableText, setEditableText] = useState("");
  const [showFlickMenu, setShowFlickMenu] = useState(false);
  const [flickDeviceGroups, setFlickDeviceGroups] = useState<Array<{room: string; icon: string; devices: Array<{id: string; name: string; entityId: string; type: string; canDisplay: boolean; room: string}>}>>([]);
  const [isFlicking, setIsFlicking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
  const pdfDocRef = useRef<any>(null);
  const isExtractingRef = useRef(false);
  const audioDurationRef = useRef<number>(0);
  const currentChunkRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const playbackSpeedRef = useRef<number>(1);
  const volumeRef = useRef<number>(1);
  const { toast } = useToast();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetch("/api/flick/rooms")
      .then(r => r.json())
      .then(setFlickDeviceGroups)
      .catch(() => {});
  }, []);

  const catWashAutoStarted = useRef(false);

  useEffect(() => {
    if (!catWashFollow || !autoplayParam) return;
    if (catWashAutoStarted.current) return;
    if (!extractedText || extractedText.length < 10) return;
    if (isPlayingRef.current) return;

    catWashAutoStarted.current = true;
    console.log("[Cat Wash] Auto-starting TTS playback (tablet → Bluetooth → Echo)");
    
    const startCatWashPlayback = async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const playBtn = document.querySelector('[data-testid="button-play-tts"]') as HTMLButtonElement;
      if (playBtn && !isPlayingRef.current) {
        playBtn.click();
      }
    };
    startCatWashPlayback();
  }, [catWashFollow, autoplayParam, extractedText]);

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

  const { data: file, isLoading: fileLoading } = useQuery<FileRecord>({
    queryKey: ["/api/files", fileId],
    queryFn: async () => {
      const response = await fetch(`/api/files/${fileId}`);
      if (!response.ok) throw new Error("Failed to fetch file");
      return response.json();
    },
    enabled: !!fileId && !isOneDriveRoute,
  });
  
  const isOneDrive = isOneDriveRoute && oneDriveUrl;
  const pdfUrl = isOneDrive ? (currentFileUrl || decodeURIComponent(oneDriveUrl)) : file?.objectPath;
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
      const delay = setTimeout(() => {
        if (file?.lastChunkIndex && file.lastChunkIndex > 0) {
          resumeFromLast();
        } else {
          startReading();
        }
      }, 2000);
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
  };

  const chunkProgress = totalChunks > 0 ? Math.round((checkedChunks.size / totalChunks) * 100) : 0;

  // Switch to a different file
  const switchToFile = (file: {name: string; downloadUrl: string; path: string}) => {
    setCurrentFileUrl(file.downloadUrl);
    setCurrentFileName(file.name);
    setCurrentPage(1);
    setNumPages(0);
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

  const extractTextInBackground = async (url: string, pages: number) => {
    setIsPreloading(true);
    try {
      const loadingTask = pdfjs.getDocument(url);
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      
      let fullText = "";
      for (let i = 1; i <= pages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += `Page ${i}. ${pageText} `;
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
    if (!pdfUrl || numPages === 0) return "";
    
    // If already extracted, return cached text
    if (extractedText) return extractedText;
    
    // Wait for background extraction if in progress
    if (isExtractingRef.current) {
      setIsLoading(true);
      // Poll until extraction completes
      while (isExtractingRef.current) {
        await new Promise(r => setTimeout(r, 100));
        if (extractedText) {
          setIsLoading(false);
          return extractedText;
        }
      }
      setIsLoading(false);
      return extractedText || "";
    }
    
    setIsLoading(true);
    let fullText = "";
    
    try {
      // Use cached PDF document if available
      let pdf = pdfDocRef.current;
      if (!pdf) {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
      }
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += `Page ${i}. ${pageText} `;
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

  const chunkText = (text: string, maxLength: number = 3500): string[] => {
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
  };

  const playTTS = async (text: string, retryCount = 0): Promise<boolean> => {
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
        const estimatedDuration = Math.max(10, (words.length / 2.5));
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.dispatchEvent(new Event('ended'));
          }
        }, estimatedDuration * 1000);
        return true;
      }
      
      console.log(`[TTS] Fetching audio for ${words.length} words, voice=${voice}`);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[TTS] Request failed: ${response.status} ${errText}`);
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      console.log(`[TTS] Audio blob received: ${audioBlob.size} bytes`);
      const audioUrl = URL.createObjectURL(audioBlob);
      
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
        
        await audioRef.current.play();
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.volume = volumeRef.current;
        console.log(`[TTS] Playing: speed=${audioRef.current.playbackRate}, vol=${audioRef.current.volume}`);
      }
      return true;
    } catch (error) {
      console.error(`[TTS] Error (attempt ${retryCount + 1}):`, error);
      if (retryCount < 2) {
        console.log(`[TTS] Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return playTTS(text, retryCount + 1);
      }
      return false;
    }
  };
  
  // Track word highlighting based on audio progress
  const handleTimeUpdate = () => {
    if (!audioRef.current || chunkWords.length === 0 || audioDurationRef.current === 0) return;
    
    const currentTime = audioRef.current.currentTime;
    const duration = audioDurationRef.current;
    const progress = currentTime / duration;
    
    // Estimate current word based on progress through the chunk
    const estimatedWordIndex = Math.floor(progress * chunkWords.length);
    const clampedIndex = Math.min(estimatedWordIndex, chunkWords.length - 1);
    
    if (clampedIndex !== currentWordIndex) {
      setCurrentWordIndex(clampedIndex);
    }
  };

  const startReading = async () => {
    // Mark this file as listened when playback starts
    markCurrentFileListened();
    
    let textToRead = extractedText;
    
    if (!textToRead) {
      textToRead = await extractAllText();
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

  const playNextChunk = async (index: number) => {
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
        body: JSON.stringify({ fileId, chunkIndex: index, totalChunks: chunksRef.current.length, words }),
      }).catch(() => {});
    }

    setCurrentChunk(index);
    currentChunkRef.current = index;
    console.log(`[TTS] Playing chunk ${index + 1}/${chunksRef.current.length}`);
    const success = await playTTS(chunksRef.current[index]);
    if (!success && isPlayingRef.current) {
      console.log(`[TTS] Chunk ${index + 1} failed after retries, skipping to next chunk`);
      toast({ title: "Skipped chunk", description: `Chunk ${index + 1} failed, moving to next` });
      playNextChunk(index + 1);
    }
  };

  const handleAudioEnded = () => {
    const playing = isPlayingRef.current;
    const paused = isPausedRef.current;
    const chunk = currentChunkRef.current;
    console.log(`[TTS] Audio ended: isPlaying=${playing}, isPaused=${paused}, currentChunk=${chunk}`);
    if (playing && !paused) {
      playNextChunk(chunk + 1);
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
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
    
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
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

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #3a8bbf 0%, #164a72 100%)' }}>
      <audio ref={audioRef} onEnded={handleAudioEnded} onTimeUpdate={handleTimeUpdate} />
      
      <div className="sticky top-0 z-50 px-4 py-4 border-b border-white/20 backdrop-blur-md" style={{ background: playerHeaderGradient }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/files">
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="truncate">
              <h1 className="font-semibold text-white truncate" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}>{fileName || "PDF Document"}</h1>
              <p className="text-xs text-white/60">Page {currentPage} of {numPages}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center text-white">{currentPage}/{numPages}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-[calc(100vh-73px)]">
          <div className="flex-1 lg:w-1/2 overflow-auto p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {/* File selector for multiple reading files */}
            {allFiles.length > 1 && (
              <div className="bg-gray-800 rounded-lg shadow p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-white/70" />
                  <span className="text-sm font-medium text-white">Reading Files ({allFiles.length})</span>
                </div>
                <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
                  {allFiles.map((file, idx) => {
                    const isListened = listenedFiles.has(file.path);
                    const isCurrentFile = (currentFileUrl || (oneDriveUrl ? decodeURIComponent(oneDriveUrl) : '')) === file.downloadUrl;
                    let cleanName = file.name
                      .replace(/^CPPA\s*122[-_\s.]*/i, '')
                      .replace(/^CFNF\s*400[-_\s.]*/i, '')
                      .replace(/^CASL\s*101[-_\s.]*/i, '')
                      .replace(/Reading\s*\d*[-_:\s.]*/gi, '')
                      .replace(/\.pdf$/i, '')
                      .trim();
                    while (cleanName.match(/^[.\s\-_:•·]/)) {
                      cleanName = cleanName.replace(/^[.\s\-_:•·]+/, '').trim();
                    }
                    return (
                      <div
                        key={file.path || idx}
                        onClick={() => switchToFile(file)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          isCurrentFile 
                            ? 'bg-white/20 border border-white/30' 
                            : 'hover:bg-white/10'
                        }`}
                        data-testid={`reading-file-${idx}`}
                      >
                        <input
                          type="checkbox"
                          checked={isListened}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newListened = new Set(listenedFiles);
                            if (e.target.checked) {
                              newListened.add(file.path);
                            } else {
                              newListened.delete(file.path);
                            }
                            setListenedFiles(newListened);
                            localStorage.setItem('listenedOneDriveFiles', JSON.stringify(Array.from(newListened)));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                        />
                        <FileText className={`h-4 w-4 shrink-0 ${isCurrentFile ? 'text-white' : 'text-white/60'}`} />
                        <span className={`text-sm ${isListened ? 'text-gray-400 line-through' : 'text-white'} ${isCurrentFile ? 'font-medium' : ''}`}>
                          {cleanName || file.name}
                        </span>
                        {isCurrentFile && (
                          <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded">Current</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="flex justify-center">
              {pdfUrl && (
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center h-[400px]">
                      <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={isMobile ? window.innerWidth - 32 : 500}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              )}
            </div>
          </div>
          
          <div className="lg:w-1/2 border-l border-white/10 p-6 overflow-auto" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)' }}>
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="h-6 w-6 text-white/80" />
                <h2 className="text-xl font-semibold text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}>Text-to-Speech</h2>
              </div>

              {isEditingText && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">Edit TTS Text</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="button-save-text-edit"
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
                        }}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="button-cancel-text-edit"
                        onClick={() => {
                          setIsEditingText(false);
                          setEditableText(extractedText);
                        }}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <textarea
                    data-testid="textarea-edit-tts-text"
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    className="w-full h-64 p-3 text-sm border border-white/20 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 bg-black/30 text-white"
                    placeholder="Edit the extracted text here..."
                  />
                  <p className="text-xs text-gray-500">{editableText.length} characters</p>
                </div>
              )}

              {catWashFollow && followState?.active && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">Following Cat Wash Playback</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      Chunk {followState.chunkIndex + 1} of {followState.totalChunks} ({Math.round(((followState.chunkIndex + followState.progress) / followState.totalChunks) * 100)}%)
                    </span>
                  </div>
                  <div className="bg-blue-200 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${Math.round(((followState.chunkIndex + followState.progress) / followState.totalChunks) * 100)}%` }}
                    />
                  </div>
                  {followState.words.length > 0 && (
                    <div className="max-h-60 overflow-y-auto p-3 bg-white rounded border border-blue-100 text-sm leading-relaxed" data-testid="follow-text-display">
                      {followState.words.map((word, idx) => (
                        <span
                          key={idx}
                          className={`${
                            idx === followState.estimatedWordIndex
                              ? "bg-yellow-300 text-black font-semibold px-0.5 rounded"
                              : idx < followState.estimatedWordIndex
                              ? "text-gray-400"
                              : "text-gray-700"
                          } transition-colors duration-100`}
                        >
                          {word}{" "}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
                    onClick={() => fetch("/api/cat-wash/stop", { method: "POST" }).then(() => setFollowState(null))}
                    data-testid="stop-catwash-playback"
                  >
                    Stop Playback
                  </button>
                </div>
              )}

              {catWashFollow && !followState?.active && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <span className="text-sm text-gray-500">Waiting for Cat Wash playback to start...</span>
                </div>
              )}

              {isPlaying && !isEditingText && (
                <div className="mb-6 p-4 rounded-lg border border-white/20" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Now Playing</span>
                    <span className="text-xs bg-white/15 text-white/80 px-2 py-1 rounded-full">
                      Chunk {currentChunk + 1} of {totalChunks} ({chunkProgress}% done)
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-green-400 h-full transition-all duration-300"
                      style={{ width: `${chunkProgress}%` }}
                    />
                  </div>
                  {chunkWords.length > 0 && (
                    <div className="max-h-40 overflow-y-auto p-3 rounded border border-white/10 text-sm leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      {chunkWords.map((word, idx) => (
                        <span
                          key={idx}
                          className={`${
                            idx === currentWordIndex
                              ? "bg-yellow-400/80 text-black font-semibold px-0.5 rounded"
                              : idx < currentWordIndex
                              ? "text-white/30"
                              : "text-white/80"
                          } transition-colors duration-100`}
                        >
                          {word}{" "}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-white/70 mb-2 block">Voice</label>
                  <Select value={voice} onValueChange={(v) => setVoice(v as Voice)}>
                    <SelectTrigger className="w-full bg-gray-800 text-white border-gray-600" style={{ fontFamily: "'Raleway', sans-serif" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[300px] overflow-y-auto bg-gray-800 text-white border-gray-600" style={{ fontFamily: "'Raleway', sans-serif" }}>
                      <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                      <SelectItem value="echo">Echo (Male)</SelectItem>
                      <SelectItem value="fable">Fable (British)</SelectItem>
                      <SelectItem value="onyx">Onyx (Deep)</SelectItem>
                      <SelectItem value="nova">Nova (Female)</SelectItem>
                      <SelectItem value="shimmer">Shimmer (Soft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-white/70 mb-2 block">Speed</label>
                  <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-2.5">
                    <button
                      type="button"
                      data-testid="button-speed-down"
                      className="text-blue-400 hover:text-blue-300 font-bold text-2xl leading-none px-2 py-1 cursor-pointer"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setPlaybackSpeed(s => {
                          const newVal = Math.max(0.5, Math.round((s - 0.25) * 100) / 100);
                          console.log(`[TTS] Speed down: ${s} -> ${newVal}`);
                          return newVal;
                        });
                      }}
                    >
                      &ndash;
                    </button>
                    <div className="flex-1 touch-auto">
                      <Slider
                        data-testid="slider-speed"
                        value={[playbackSpeed]}
                        onValueChange={([v]) => {
                          console.log(`[TTS] Speed slider: ${v}`);
                          setPlaybackSpeed(v);
                        }}
                        min={0.5}
                        max={2}
                        step={0.25}
                        className="touch-auto [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
                      />
                    </div>
                    <button
                      type="button"
                      data-testid="button-speed-up"
                      className="text-blue-400 hover:text-blue-300 font-bold text-2xl leading-none px-2 py-1 cursor-pointer"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setPlaybackSpeed(s => {
                          const newVal = Math.min(2, Math.round((s + 0.25) * 100) / 100);
                          console.log(`[TTS] Speed up: ${s} -> ${newVal}`);
                          return newVal;
                        });
                      }}
                    >
                      +
                    </button>
                    <span className="text-white text-sm font-medium min-w-[4ch] text-right tabular-nums">
                      {playbackSpeed}x
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-white/70 mb-2 block">Volume</label>
                  <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-2.5">
                    <button
                      type="button"
                      data-testid="button-volume-down"
                      className="text-blue-400 hover:text-blue-300 font-bold text-2xl leading-none px-2 py-1 cursor-pointer"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setVolume(v => {
                          const newVal = Math.max(0, Math.round((v - 0.05) * 100) / 100);
                          console.log(`[TTS] Volume down: ${v} -> ${newVal}`);
                          return newVal;
                        });
                      }}
                    >
                      &ndash;
                    </button>
                    <div className="flex-1 touch-auto">
                      <Slider
                        data-testid="slider-volume"
                        value={[volume]}
                        onValueChange={([v]) => {
                          console.log(`[TTS] Volume slider: ${v}`);
                          setVolume(v);
                        }}
                        min={0}
                        max={1}
                        step={0.01}
                        className="touch-auto [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
                      />
                    </div>
                    <button
                      type="button"
                      data-testid="button-volume-up"
                      className="text-blue-400 hover:text-blue-300 font-bold text-2xl leading-none px-2 py-1 cursor-pointer"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setVolume(v => {
                          const newVal = Math.min(1, Math.round((v + 0.05) * 100) / 100);
                          console.log(`[TTS] Volume up: ${v} -> ${newVal}`);
                          return newVal;
                        });
                      }}
                    >
                      +
                    </button>
                    <span className="text-white text-sm font-medium min-w-[3ch] text-right tabular-nums">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  className="media-btn media-btn-lg"
                  onClick={skipBack}
                  disabled={!isPlaying || currentChunk === 0}
                >
                  <SkipBack className="h-5 w-5 text-white" />
                </button>

                {!isPlaying ? (
                  <div className="flex items-center gap-3">
                    {file && file.lastChunkIndex && file.lastChunkIndex > 0 && (
                      <button
                        className="media-btn media-btn-lg media-btn-resume"
                        onClick={resumeFromLast}
                        disabled={isLoading || numPages === 0}
                        title={`Resume from chunk ${file.lastChunkIndex + 1}${file.totalChunks ? ` of ${file.totalChunks}` : ''}`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : (
                          <RotateCcw className="h-5 w-5 text-white" />
                        )}
                      </button>
                    )}
                    <button
                      className="media-btn media-btn-play"
                      onClick={startReading}
                      disabled={isLoading || numPages === 0}
                    >
                      {isLoading ? (
                        <Loader2 className="h-7 w-7 text-white animate-spin" />
                      ) : (
                        <Play className="h-7 w-7 text-white fill-white ml-0.5" />
                      )}
                    </button>
                  </div>
                ) : isPaused ? (
                  <button
                    className="media-btn media-btn-play"
                    onClick={resumeReading}
                  >
                    <Play className="h-7 w-7 text-white fill-white ml-0.5" />
                  </button>
                ) : (
                  <button
                    className="media-btn media-btn-play media-btn-active"
                    onClick={pauseReading}
                  >
                    <Pause className="h-7 w-7 text-white" />
                  </button>
                )}

                <button
                  className="media-btn media-btn-lg media-btn-stop"
                  onClick={stopReading}
                  disabled={!isPlaying}
                >
                  <Square className="h-5 w-5 text-white fill-white" />
                </button>

                <button
                  className="media-btn media-btn-lg"
                  onClick={skipForward}
                  disabled={!isPlaying || currentChunk >= totalChunks - 1}
                >
                  <SkipForward className="h-5 w-5 text-white" />
                </button>

                {fileId && flickDeviceGroups.length > 0 && (
                  <div className="relative">
                    <button
                      className={`media-btn media-btn-lg ${showFlickMenu ? 'ring-2 ring-blue-400' : ''}`}
                      data-testid="button-flick-cast"
                      onClick={() => setShowFlickMenu(!showFlickMenu)}
                      disabled={isFlicking}
                      title="Flick to another device"
                    >
                      {isFlicking ? (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      ) : (
                        <Cast className="h-5 w-5 text-white" />
                      )}
                    </button>
                    {showFlickMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                        <div className="px-3 py-1.5 border-b border-gray-700 flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">Flick to...</span>
                          <button
                            onClick={() => setShowFlickMenu(false)}
                            className="text-gray-400 hover:text-white"
                            data-testid="button-close-flick-menu"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="max-h-[350px] overflow-y-auto">
                          {flickDeviceGroups.map((group) => (
                            <div key={group.room}>
                              <div className="px-2 py-1 bg-gray-800/60 flex items-center gap-1.5 sticky top-0">
                                <span className="text-xs">{group.icon}</span>
                                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">{group.room}</span>
                              </div>
                              {group.devices.map((device) => (
                                <button
                                  key={device.id}
                                  data-testid={`button-flick-${device.id}`}
                                  className="w-full px-2 py-1.5 pl-6 flex items-center gap-2 hover:bg-gray-800 transition-colors text-left"
                                  onClick={() => handleFlick(device.id)}
                                  disabled={isFlicking}
                                >
                                  {device.type === "tablet" || device.type === "echo_show" ? <Monitor className="h-3 w-3 text-blue-400 flex-shrink-0" /> :
                                   device.type === "tv" ? <Monitor className="h-3 w-3 text-purple-400 flex-shrink-0" /> :
                                   device.type === "group" ? <Speaker className="h-3 w-3 text-yellow-400 flex-shrink-0" /> :
                                   <Speaker className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                                  <span className={`text-xs truncate ${device.type === "group" ? "text-yellow-300 font-medium" : "text-white"}`}>{device.name}</span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  className={`p-2 rounded-md hover:bg-white/20 transition-colors ${isEditingText ? 'ring-2 ring-white/40' : ''}`}
                  data-testid="button-edit-tts-text"
                  onClick={() => {
                    if (isEditingText) {
                      setIsEditingText(false);
                      setEditableText(extractedText);
                    } else {
                      if (isPlaying) {
                        stopReading();
                      }
                      if (extractedText) {
                        setEditableText(extractedText);
                        setIsEditingText(true);
                      } else {
                        toast({ title: "No text yet", description: "Wait for the PDF text to finish loading, then try again." });
                      }
                    }
                  }}
                  disabled={isPreloading}
                >
                  <Pencil className="h-5 w-5 text-white" />
                </button>
              </div>

              {chunksList.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/80">Chunks ({checkedChunks.size}/{totalChunks})</span>
                    <span className="text-xs text-white/50">{chunkProgress}% complete</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-green-400 h-full transition-all duration-300"
                      style={{ width: `${chunkProgress}%` }}
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 border border-white/10 rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {chunksList.map((chunk, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                          currentChunk === idx && isPlaying ? 'bg-white/15 border border-white/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedChunks.has(idx)}
                          onChange={() => toggleChunkChecked(idx)}
                          className="h-4 w-4 rounded border-white/30 text-green-500 focus:ring-green-500 shrink-0"
                          data-testid={`checkbox-chunk-${idx}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.pause();
                            }
                            setIsPlaying(true);
                            setIsPaused(false);
                            playNextChunk(idx);
                          }}
                          data-testid={`button-play-chunk-${idx}`}
                        >
                          {currentChunk === idx && isPlaying && !isPaused ? (
                            <Pause className="h-3.5 w-3.5 text-white/80" />
                          ) : (
                            <Play className="h-3.5 w-3.5 text-white/80 ml-0.5" />
                          )}
                        </Button>
                        <span className={`text-xs truncate ${checkedChunks.has(idx) ? 'text-white/30 line-through' : 'text-white/70'}`}>
                          {idx + 1}. {chunk.slice(0, 60)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress Indicators */}
              <div className="space-y-3 mb-4 mt-6 border-t border-white/10 pt-4">
                {/* Current File Progress */}
                <div data-testid="progress-current-file">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white/70">This File</span>
                    <span className="text-xs text-white/50">{checkedChunks.size}/{totalChunks} chunks ({chunkProgress}%)</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-green-400 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${chunkProgress}%` }}
                    />
                  </div>
                </div>

                {/* All Files in Folder Progress */}
                {allFiles.length > 1 && (() => {
                  const allChunkProgress = JSON.parse(localStorage.getItem('allChunkProgress') || '{}');
                  let totalFilesComplete = 0;
                  let totalChunksAll = 0;
                  let totalCheckedAll = 0;
                  for (const file of allFiles) {
                    const fileKey = `onedrive_${btoa(file.downloadUrl).slice(0, 40)}`;
                    const progress = allChunkProgress[fileKey];
                    if (progress && progress.total > 0) {
                      totalChunksAll += progress.total;
                      totalCheckedAll += progress.checked;
                      if (progress.checked >= progress.total) totalFilesComplete++;
                    } else if (listenedFiles.has(file.path)) {
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
                    <div data-testid="progress-all-files">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white/70">All Files ({allFiles.length})</span>
                        <span className="text-xs text-white/50">{totalFilesComplete}/{allFiles.length} complete ({folderPct}%)</span>
                      </div>
                      <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${folderPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>Powered by OpenAI TTS</p>
                {isPreloading ? (
                  <p className="text-xs mt-1 flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Preparing text...
                  </p>
                ) : extractedText ? (
                  <p className="text-xs mt-1 text-green-600">Ready for instant playback</p>
                ) : (
                  <p className="text-xs mt-1">Text is chunked for efficient streaming playback</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
