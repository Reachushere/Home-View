import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft,
  Loader2,
  Home,
  RefreshCw,
  FileText,
  Clock,
  StickyNote,
  Smartphone,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface QuickNoteFile {
  id: string;
  name: string;
  type: string;
  size?: number;
  lastModified?: string;
  path: string;
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OneNotePage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<QuickNoteFile | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedFile?.id, "content"],
    enabled: !!selectedFile,
    staleTime: 3000,
  });

  const metaQuery = useQuery<{ lastModified?: string }>({
    queryKey: ["/api/quicknotes/file", selectedFile?.id, "meta"],
    enabled: !!selectedFile,
    staleTime: 3000,
  });

  useEffect(() => {
    if (autoRefresh && selectedFile) {
      refreshTimerRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/file", selectedFile.id, "content"] });
        queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/file", selectedFile.id, "meta"] });
      }, 5000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, selectedFile]);

  useEffect(() => {
    if (!selectedFile && filesQuery.data && filesQuery.data.length > 0) {
      setSelectedFile(filesQuery.data[0]);
    }
  }, [filesQuery.data, selectedFile]);

  function refreshContent() {
    if (selectedFile) {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/file", selectedFile.id, "content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/file", selectedFile.id, "meta"] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
    toast({ title: "Refreshed", description: "Content synced from OneDrive" });
  }

  const lastMod = metaQuery.data?.lastModified;
  const showFileList = !selectedFile;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {selectedFile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
                className="text-white/70 hover:text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <StickyNote className="h-6 w-6 text-purple-400" />
              <h1 className="text-xl font-bold" data-testid="text-page-title">Quick Notes</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedFile && (
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "bg-green-600 hover:bg-green-700 text-white" : "border-white/20 text-white/70 hover:text-white"}
                data-testid="button-auto-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`} style={autoRefresh ? { animationDuration: "3s" } : {}} />
                {autoRefresh ? "Live" : "Auto"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshContent}
              className="text-white/70 hover:text-white hover:bg-white/10"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" data-testid="link-home">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {showFileList ? (
          <FileList
            files={filesQuery.data || []}
            isLoading={filesQuery.isLoading}
            error={filesQuery.error}
            onSelect={setSelectedFile}
          />
        ) : (
          <NoteContent
            content={contentQuery.data?.content || ""}
            isLoading={contentQuery.isLoading && !contentQuery.data}
            error={contentQuery.error}
            file={selectedFile}
            lastModified={lastMod}
            autoRefresh={autoRefresh}
          />
        )}
      </div>
    </div>
  );
}

function FileList({ files, isLoading, error, onSelect }: {
  files: QuickNoteFile[];
  isLoading: boolean;
  error: Error | null;
  onSelect: (f: QuickNoteFile) => void;
}) {
  if (isLoading) return <LoadingState label="Looking for notes in OneDrive..." />;
  if (error) return <ErrorState message={error.message} />;

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/50">
        <Smartphone className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium mb-2">No notes yet</p>
        <p className="text-sm text-white/30 text-center max-w-md">
          Open the OneDrive app on your phone, go to the <strong className="text-white/50">QuickNotes</strong> folder,
          and create a text file. It will appear here instantly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1 text-sm text-white/40">
        <Smartphone className="h-4 w-4" />
        <span>Edit these files on your phone using the OneDrive app — changes sync live</span>
      </div>
      <div className="grid gap-3">
        {files.map((f) => (
          <Card
            key={f.id}
            className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => onSelect(f)}
            data-testid={`card-note-${f.id}`}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate" data-testid={`text-note-name-${f.id}`}>{f.name}</h3>
                <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                  {f.lastModified && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(f.lastModified)}
                    </span>
                  )}
                  {f.size != null && (
                    <span>{f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NoteContent({ content, isLoading, error, file, lastModified, autoRefresh }: {
  content: string;
  isLoading: boolean;
  error: Error | null;
  file: QuickNoteFile | null;
  lastModified?: string;
  autoRefresh: boolean;
}) {
  if (isLoading) return <LoadingState label="Loading note..." />;
  if (error) return <ErrorState message={error.message} />;

  const isMarkdown = file?.name?.toLowerCase().endsWith('.md');
  const isHtml = file?.name?.toLowerCase().endsWith('.html');

  const renderContent = () => {
    if (isHtml) {
      return (
        <div
          className="quicknote-content prose prose-invert max-w-none text-white/90"
          data-testid="div-note-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    const lines = content.split('\n');
    return (
      <div className="quicknote-content font-mono text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap" data-testid="div-note-content">
        {lines.map((line, i) => {
          if (isMarkdown) {
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2 font-sans">{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold text-white mt-3 mb-1.5 font-sans">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-medium text-white mt-2 mb-1 font-sans">{line.slice(4)}</h3>;
            if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} className="pl-4 flex gap-2"><span className="text-purple-400">•</span><span>{line.slice(2)}</span></div>;
            if (/^\d+\.\s/.test(line)) {
              const match = line.match(/^(\d+)\.\s(.*)/);
              if (match) return <div key={i} className="pl-4 flex gap-2"><span className="text-purple-400">{match[1]}.</span><span>{match[2]}</span></div>;
            }
          }
          if (line.trim() === '') return <div key={i} className="h-3" />;
          return <div key={i}>{line}</div>;
        })}
      </div>
    );
  };

  return (
    <div>
      {file && (
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white" data-testid="text-note-title">{file.name}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            {lastModified && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last edited {timeAgo(lastModified)}
              </span>
            )}
            {autoRefresh && (
              <span className="text-green-400/60 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live sync
              </span>
            )}
          </div>
        </div>
      )}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          {content ? renderContent() : (
            <div className="text-center py-12 text-white/30">
              <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>This note is empty</p>
              <p className="text-xs mt-1">Open it in the OneDrive app on your phone to start typing</p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-3 px-1 text-xs text-white/25 flex items-center gap-1.5">
        <Smartphone className="h-3 w-3" />
        Edit this file on your phone using the OneDrive app — changes appear here automatically
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/50">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      <p>{label}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-red-400/70">
      <p className="text-sm">Error: {message}</p>
    </div>
  );
}
