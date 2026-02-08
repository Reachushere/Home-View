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
  Volume2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RotateCcw
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
  const [isMobile, setIsMobile] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [chunkWords, setChunkWords] = useState<string[]>([]);
  const [checkedChunks, setCheckedChunks] = useState<Set<number>>(new Set());
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
  const pdfDocRef = useRef<any>(null);
  const isExtractingRef = useRef(false);
  const audioDurationRef = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
  const fileName = isOneDrive ? (currentFileName || (oneDriveName ? decodeURIComponent(oneDriveName) : "OneDrive PDF")) : file?.displayName;
  
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
      newChecked.add(idx);
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
    chunksRef.current = [];
    pdfDocRef.current = null;
    isExtractingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const onDocumentLoadSuccess = async ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setCurrentPage(1);
    
    // Pre-extract text in background for faster playback start
    if (pdfUrl && pages > 0 && !extractedText && !isExtractingRef.current) {
      isExtractingRef.current = true;
      extractTextInBackground(pdfUrl, pages);
    }
  };
  
  // Extract text in background without blocking UI
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
      
      setExtractedText(fullText);
      console.log("PDF text pre-extracted:", fullText.length, "chars");
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
      
      setExtractedText(fullText);
      return fullText;
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

  const playTTS = async (text: string) => {
    try {
      // Split text into words for highlighting
      const words = text.split(/\s+/).filter(w => w.length > 0);
      setChunkWords(words);
      setCurrentWordIndex(0);
      
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = playbackSpeed;
        
        // Wait for metadata to get duration
        audioRef.current.onloadedmetadata = () => {
          if (audioRef.current) {
            audioDurationRef.current = audioRef.current.duration;
          }
        };
        
        await audioRef.current.play();
      }
    } catch (error) {
      console.error("TTS error:", error);
      toast({
        title: "Error",
        description: "Failed to generate speech",
        variant: "destructive",
      });
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

    chunksRef.current = chunkText(textToRead);
    setTotalChunks(chunksRef.current.length);
    setCurrentChunk(0);
    setIsPlaying(true);
    setIsPaused(false);
    const key = getFileKey();
    setCheckedChunks(loadCheckedChunks(key));
    
    playNextChunk(0);
  };

  const playNextChunk = async (index: number) => {
    if (index >= chunksRef.current.length) {
      setIsPlaying(false);
      setCurrentChunk(0);
      toast({
        title: "Finished",
        description: "Finished reading the document",
      });
      return;
    }

    setCurrentChunk(index);
    await playTTS(chunksRef.current[index]);
  };

  const handleAudioEnded = () => {
    if (isPlaying && !isPaused) {
      playNextChunk(currentChunk + 1);
    }
  };

  const pauseReading = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPaused(true);
  };

  const resumeReading = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
    setIsPaused(false);
  };

  const stopReading = async () => {
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
    
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentChunk(0);
  };
  
  const resumeFromLast = async () => {
    if (!file?.lastChunkIndex || file.lastChunkIndex === 0) {
      startReading();
      return;
    }
    
    setIsLoading(true);
    setIsPlaying(true);
    setIsPaused(false);
    
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
    if (currentChunk > 0) {
      stopReading();
      setIsPlaying(true);
      playNextChunk(currentChunk - 1);
    }
  };

  const skipForward = () => {
    if (currentChunk < totalChunks - 1) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      playNextChunk(currentChunk + 1);
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
      chunksRef.current = chunkText(extractedText);
      setTotalChunks(chunksRef.current.length);
      const key = getFileKey();
      setCheckedChunks(loadCheckedChunks(key));
    }
  }, [extractedText]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  if (fileLoading && !isOneDrive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!file && !isOneDrive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 p-4">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100">
      <audio ref={audioRef} onEnded={handleAudioEnded} onTimeUpdate={handleTimeUpdate} />
      
      <div className="sticky top-0 z-50 bg-amber-800 backdrop-blur-md border-b border-amber-900 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/files">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="truncate">
              <h1 className="font-semibold text-white truncate">{fileName || "PDF Document"}</h1>
              <p className="text-xs text-amber-200">Page {currentPage} of {numPages}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center text-white">{currentPage}/{numPages}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Side-by-side layout: PDF on left, TTS controls on right */}
        <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)]">
          {/* Left side: PDF Viewer */}
          <div className="flex-1 lg:w-1/2 overflow-auto bg-gray-100 p-4">
            {/* File selector for multiple reading files */}
            {allFiles.length > 1 && (
              <div className="bg-gray-800 rounded-lg shadow p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-amber-300" />
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
                            ? 'bg-amber-700 border border-amber-500' 
                            : 'hover:bg-gray-700'
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
                        <FileText className={`h-4 w-4 shrink-0 ${isCurrentFile ? 'text-amber-300' : 'text-red-400'}`} />
                        <span className={`text-sm ${isListened ? 'text-gray-400 line-through' : 'text-white'} ${isCurrentFile ? 'font-medium' : ''}`}>
                          {cleanName || file.name}
                        </span>
                        {isCurrentFile && (
                          <span className="ml-auto text-xs bg-amber-600 text-white px-2 py-0.5 rounded">Current</span>
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
                      <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
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
          
          {/* Right side: TTS Controls */}
          <div className="lg:w-1/2 bg-white border-l border-gray-200 p-6 overflow-auto">
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <Volume2 className="h-6 w-6 text-amber-600" />
                <h2 className="text-xl font-semibold text-gray-800">OpenAI Text-to-Speech</h2>
              </div>
              
              {isPlaying && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700">Now Playing</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      Chunk {currentChunk + 1} of {totalChunks} ({chunkProgress}% done)
                    </span>
                  </div>
                  <div className="bg-green-200 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-green-500 h-full transition-all duration-300"
                      style={{ width: `${chunkProgress}%` }}
                    />
                  </div>
                  {/* Word-by-word highlighting display */}
                  {chunkWords.length > 0 && (
                    <div className="max-h-40 overflow-y-auto p-3 bg-white rounded border border-green-100 text-sm leading-relaxed">
                      {chunkWords.map((word, idx) => (
                        <span
                          key={idx}
                          className={`${
                            idx === currentWordIndex
                              ? "bg-yellow-300 text-black font-semibold px-0.5 rounded"
                              : idx < currentWordIndex
                              ? "text-gray-400"
                              : "text-gray-700"
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
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Voice</label>
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
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Speed: {playbackSpeed}x</label>
                  <Slider
                    value={[playbackSpeed]}
                    onValueChange={([v]) => setPlaybackSpeed(v)}
                    min={0.5}
                    max={2}
                    step={0.25}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={skipBack}
                  disabled={!isPlaying || currentChunk === 0}
                  className="h-12 w-12 rounded-full"
                >
                  <SkipBack className="h-5 w-5" />
                </Button>

                {!isPlaying ? (
                  <div className="flex items-center gap-2">
                    {/* Resume from Last button - only show for stored files with saved progress */}
                    {file && file.lastChunkIndex && file.lastChunkIndex > 0 && (
                      <Button
                        size="icon"
                        onClick={resumeFromLast}
                        disabled={isLoading || numPages === 0}
                        className="h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600"
                        title={`Resume from chunk ${file.lastChunkIndex + 1}${file.totalChunks ? ` of ${file.totalChunks}` : ''}`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <RotateCcw className="h-6 w-6" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      onClick={startReading}
                      disabled={isLoading || numPages === 0}
                      className="h-16 w-16 rounded-full bg-amber-500 hover:bg-amber-600"
                    >
                      {isLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <Play className="h-8 w-8 ml-1" />
                      )}
                    </Button>
                  </div>
                ) : isPaused ? (
                  <Button
                    size="icon"
                    onClick={resumeReading}
                    className="h-16 w-16 rounded-full bg-amber-500 hover:bg-amber-600"
                  >
                    <Play className="h-8 w-8 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={pauseReading}
                    className="h-16 w-16 rounded-full bg-amber-500 hover:bg-amber-600"
                  >
                    <Pause className="h-8 w-8" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={stopReading}
                  disabled={!isPlaying}
                  className="h-12 w-12 rounded-full"
                >
                  <Square className="h-5 w-5 text-red-500" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={skipForward}
                  disabled={!isPlaying || currentChunk >= totalChunks - 1}
                  className="h-12 w-12 rounded-full"
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>

              {totalChunks > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Chunks ({checkedChunks.size}/{totalChunks})</span>
                    <span className="text-xs text-gray-500">{chunkProgress}% complete</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${chunkProgress}%` }}
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                    {chunksRef.current.map((chunk, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                          currentChunk === idx && isPlaying ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedChunks.has(idx)}
                          onChange={() => toggleChunkChecked(idx)}
                          className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 shrink-0"
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
                            <Pause className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <Play className="h-3.5 w-3.5 text-amber-600 ml-0.5" />
                          )}
                        </Button>
                        <span className={`text-xs truncate ${checkedChunks.has(idx) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {idx + 1}. {chunk.slice(0, 60)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
