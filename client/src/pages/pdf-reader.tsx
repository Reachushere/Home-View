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
  Loader2
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
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [voice, setVoice] = useState<Voice>("nova");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<string[]>([]);
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
  
  // Switch to a different file
  const switchToFile = (file: {name: string; downloadUrl: string; path: string}) => {
    setCurrentFileUrl(file.downloadUrl);
    setCurrentFileName(file.name);
    setCurrentPage(1);
    setNumPages(0);
    setExtractedText('');
    setIsPlaying(false);
    setIsPaused(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setCurrentPage(1);
  };

  const extractAllText = async (): Promise<string> => {
    if (!pdfUrl || numPages === 0) return "";
    
    setIsLoading(true);
    let fullText = "";
    
    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      
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

  const stopReading = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentChunk(0);
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
      <audio ref={audioRef} onEnded={handleAudioEnded} />
      
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-amber-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/files">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="truncate">
              <h1 className="font-semibold text-gray-800 truncate">{fileName || "PDF Document"}</h1>
              <p className="text-xs text-gray-500">Page {currentPage} of {numPages}</p>
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
            <span className="text-sm font-medium min-w-[60px] text-center">{currentPage}/{numPages}</span>
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

      <div className="max-w-6xl mx-auto p-4">
        {/* File selector dropdown for multiple reading files */}
        {allFiles.length > 1 && (
          <div className="bg-white rounded-xl shadow-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">Reading Files ({allFiles.length})</span>
            </div>
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
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
                        ? 'bg-amber-100 border border-amber-300' 
                        : 'hover:bg-gray-100'
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
                    <FileText className={`h-4 w-4 shrink-0 ${isCurrentFile ? 'text-amber-600' : 'text-red-400'}`} />
                    <span className={`text-sm ${isListened ? 'text-gray-400 line-through' : 'text-gray-700'} ${isCurrentFile ? 'font-medium' : ''}`}>
                      {cleanName || file.name}
                    </span>
                    {isCurrentFile && (
                      <span className="ml-auto text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded">Current</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4">
          <div className="flex justify-center p-4 bg-gray-100 min-h-[400px] sm:min-h-[600px]">
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  width={isMobile ? window.innerWidth - 48 : 600}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-gray-800">Audio Reader</h2>
            {isPlaying && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {currentChunk + 1} / {totalChunks}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Voice</label>
              <Select value={voice} onValueChange={(v) => setVoice(v as Voice)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <label className="text-sm text-gray-600 mb-1 block">Speed: {playbackSpeed}x</label>
              <Slider
                value={[playbackSpeed]}
                onValueChange={([v]) => setPlaybackSpeed(v)}
                min={0.5}
                max={2}
                step={0.25}
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size={isMobile ? "lg" : "default"}
              onClick={skipBack}
              disabled={!isPlaying || currentChunk === 0}
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full"
            >
              <SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>

            {!isPlaying ? (
              <Button
                size={isMobile ? "lg" : "default"}
                onClick={startReading}
                disabled={isLoading || numPages === 0}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-amber-500 hover:bg-amber-600"
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
                ) : (
                  <Play className="h-6 w-6 sm:h-8 sm:w-8 ml-1" />
                )}
              </Button>
            ) : isPaused ? (
              <Button
                size={isMobile ? "lg" : "default"}
                onClick={resumeReading}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-amber-500 hover:bg-amber-600"
              >
                <Play className="h-6 w-6 sm:h-8 sm:w-8 ml-1" />
              </Button>
            ) : (
              <Button
                size={isMobile ? "lg" : "default"}
                onClick={pauseReading}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-amber-500 hover:bg-amber-600"
              >
                <Pause className="h-6 w-6 sm:h-8 sm:w-8" />
              </Button>
            )}

            <Button
              variant="outline"
              size={isMobile ? "lg" : "default"}
              onClick={stopReading}
              disabled={!isPlaying}
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full"
            >
              <Square className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>

            <Button
              variant="outline"
              size={isMobile ? "lg" : "default"}
              onClick={skipForward}
              disabled={!isPlaying || currentChunk >= totalChunks - 1}
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full"
            >
              <SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>

          {isPlaying && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${((currentChunk + 1) / totalChunks) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Reading section {currentChunk + 1} of {totalChunks}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
