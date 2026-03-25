import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Home,
  RefreshCw,
  Notebook,
  FileText,
  Clock,
  StickyNote,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface OneNoteNotebook {
  id: string;
  displayName: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  isShared: boolean;
}

interface OneNoteSection {
  id: string;
  displayName: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

interface OneNotePage {
  id: string;
  title: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

type View = "notebooks" | "sections" | "pages" | "content";

function timeAgo(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OneNotePage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("notebooks");
  const [selectedNotebook, setSelectedNotebook] = useState<OneNoteNotebook | null>(null);
  const [selectedSection, setSelectedSection] = useState<OneNoteSection | null>(null);
  const [selectedPage, setSelectedPage] = useState<OneNotePage | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notebooksQuery = useQuery<OneNoteNotebook[]>({
    queryKey: ["/api/onenote/notebooks"],
    staleTime: 30000,
  });

  const sectionsQuery = useQuery<OneNoteSection[]>({
    queryKey: ["/api/onenote/notebooks", selectedNotebook?.id, "sections"],
    enabled: !!selectedNotebook,
    staleTime: 30000,
  });

  const pagesQuery = useQuery<OneNotePage[]>({
    queryKey: ["/api/onenote/sections", selectedSection?.id, "pages"],
    enabled: !!selectedSection,
    staleTime: 10000,
  });

  const contentQuery = useQuery<{ html: string }>({
    queryKey: ["/api/onenote/pages", selectedPage?.id, "content"],
    enabled: !!selectedPage,
    staleTime: 5000,
  });

  useEffect(() => {
    if (autoRefresh && selectedPage && view === "content") {
      refreshTimerRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/onenote/pages", selectedPage.id, "content"] });
      }, 5000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, selectedPage, view]);

  function openNotebook(nb: OneNoteNotebook) {
    setSelectedNotebook(nb);
    setView("sections");
  }

  function openSection(s: OneNoteSection) {
    setSelectedSection(s);
    setView("pages");
  }

  function openPage(p: OneNotePage) {
    setSelectedPage(p);
    setView("content");
  }

  function goBack() {
    if (view === "content") {
      setSelectedPage(null);
      setView("pages");
    } else if (view === "pages") {
      setSelectedSection(null);
      setView("sections");
    } else if (view === "sections") {
      setSelectedNotebook(null);
      setView("notebooks");
    }
  }

  function refreshContent() {
    if (view === "content" && selectedPage) {
      queryClient.invalidateQueries({ queryKey: ["/api/onenote/pages", selectedPage.id, "content"] });
    } else if (view === "pages" && selectedSection) {
      queryClient.invalidateQueries({ queryKey: ["/api/onenote/sections", selectedSection.id, "pages"] });
    } else if (view === "sections" && selectedNotebook) {
      queryClient.invalidateQueries({ queryKey: ["/api/onenote/notebooks", selectedNotebook.id, "sections"] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/onenote/notebooks"] });
    }
    toast({ title: "Refreshed", description: "Content updated from OneNote" });
  }

  const breadcrumb = () => {
    const parts: { label: string; action?: () => void }[] = [
      { label: "Notebooks", action: () => { setSelectedNotebook(null); setSelectedSection(null); setSelectedPage(null); setView("notebooks"); } },
    ];
    if (selectedNotebook) {
      parts.push({ label: selectedNotebook.displayName, action: () => { setSelectedSection(null); setSelectedPage(null); setView("sections"); } });
    }
    if (selectedSection) {
      parts.push({ label: selectedSection.displayName, action: () => { setSelectedPage(null); setView("pages"); } });
    }
    if (selectedPage) {
      parts.push({ label: selectedPage.title || "Untitled" });
    }
    return parts;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {view !== "notebooks" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={goBack}
                className="text-white/70 hover:text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <StickyNote className="h-6 w-6 text-purple-400" />
              <h1 className="text-xl font-bold" data-testid="text-page-title">OneNote</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "content" && (
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

        <div className="flex items-center gap-1 mb-4 text-sm text-white/50 flex-wrap" data-testid="nav-breadcrumb">
          {breadcrumb().map((part, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {part.action ? (
                <button onClick={part.action} className="hover:text-white/80 transition-colors" data-testid={`breadcrumb-${i}`}>
                  {part.label}
                </button>
              ) : (
                <span className="text-white/80">{part.label}</span>
              )}
            </span>
          ))}
        </div>

        {view === "notebooks" && (
          <NotebookList
            notebooks={notebooksQuery.data || []}
            isLoading={notebooksQuery.isLoading}
            error={notebooksQuery.error}
            onSelect={openNotebook}
          />
        )}

        {view === "sections" && (
          <SectionList
            sections={sectionsQuery.data || []}
            isLoading={sectionsQuery.isLoading}
            error={sectionsQuery.error}
            onSelect={openSection}
          />
        )}

        {view === "pages" && (
          <PageList
            pages={pagesQuery.data || []}
            isLoading={pagesQuery.isLoading}
            error={pagesQuery.error}
            onSelect={openPage}
          />
        )}

        {view === "content" && (
          <PageContent
            html={contentQuery.data?.html || ""}
            isLoading={contentQuery.isLoading}
            error={contentQuery.error}
            page={selectedPage}
            autoRefresh={autoRefresh}
          />
        )}
      </div>
    </div>
  );
}

function NotebookList({ notebooks, isLoading, error, onSelect }: {
  notebooks: OneNoteNotebook[];
  isLoading: boolean;
  error: Error | null;
  onSelect: (nb: OneNoteNotebook) => void;
}) {
  if (isLoading) return <LoadingState label="Loading notebooks..." />;
  if (error) return <ErrorState message={error.message} />;
  if (notebooks.length === 0) return <EmptyState label="No notebooks found" />;

  return (
    <div className="grid gap-3">
      {notebooks.map((nb) => (
        <Card
          key={nb.id}
          className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => onSelect(nb)}
          data-testid={`card-notebook-${nb.id}`}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Notebook className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate" data-testid={`text-notebook-name-${nb.id}`}>{nb.displayName}</h3>
              <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {timeAgo(nb.lastModifiedDateTime)}
                {nb.isShared && <span className="ml-2 text-blue-400/60">Shared</span>}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionList({ sections, isLoading, error, onSelect }: {
  sections: OneNoteSection[];
  isLoading: boolean;
  error: Error | null;
  onSelect: (s: OneNoteSection) => void;
}) {
  if (isLoading) return <LoadingState label="Loading sections..." />;
  if (error) return <ErrorState message={error.message} />;
  if (sections.length === 0) return <EmptyState label="No sections found" />;

  return (
    <div className="grid gap-3">
      {sections.map((s) => (
        <Card
          key={s.id}
          className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => onSelect(s)}
          data-testid={`card-section-${s.id}`}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate" data-testid={`text-section-name-${s.id}`}>{s.displayName}</h3>
              <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {timeAgo(s.lastModifiedDateTime)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PageList({ pages, isLoading, error, onSelect }: {
  pages: OneNotePage[];
  isLoading: boolean;
  error: Error | null;
  onSelect: (p: OneNotePage) => void;
}) {
  if (isLoading) return <LoadingState label="Loading pages..." />;
  if (error) return <ErrorState message={error.message} />;
  if (pages.length === 0) return <EmptyState label="No pages found" />;

  return (
    <div className="grid gap-3">
      {pages.map((p) => (
        <Card
          key={p.id}
          className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => onSelect(p)}
          data-testid={`card-page-${p.id}`}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate" data-testid={`text-page-name-${p.id}`}>{p.title || "Untitled"}</h3>
              <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {timeAgo(p.lastModifiedDateTime)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PageContent({ html, isLoading, error, page, autoRefresh }: {
  html: string;
  isLoading: boolean;
  error: Error | null;
  page: OneNotePage | null;
  autoRefresh: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (isLoading && !html) return <LoadingState label="Loading page content..." />;
  if (error) return <ErrorState message={error.message} />;

  const cleanedHtml = html
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/style="[^"]*"/gi, (match) => {
      return match
        .replace(/font-family:[^;"]+;?/gi, "")
        .replace(/color:\s*rgb\(0,\s*0,\s*0\);?/gi, "color: rgba(255,255,255,0.9);")
        .replace(/color:\s*#000[^;"]*;?/gi, "color: rgba(255,255,255,0.9);")
        .replace(/color:\s*black;?/gi, "color: rgba(255,255,255,0.9);");
    });

  return (
    <div>
      {page && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white" data-testid="text-content-title">{page.title || "Untitled"}</h2>
          {autoRefresh && (
            <span className="text-xs text-green-400/60 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Live — updates every 5s
            </span>
          )}
        </div>
      )}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <div
            ref={contentRef}
            className="onenote-content prose prose-invert max-w-none text-white/90"
            data-testid="div-page-content"
            dangerouslySetInnerHTML={{ __html: cleanedHtml }}
          />
        </CardContent>
      </Card>
      <style>{`
        .onenote-content {
          font-size: 15px;
          line-height: 1.7;
        }
        .onenote-content p {
          margin-bottom: 0.5em;
        }
        .onenote-content h1, .onenote-content h2, .onenote-content h3 {
          color: white;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .onenote-content ul, .onenote-content ol {
          padding-left: 1.5em;
          margin-bottom: 0.5em;
        }
        .onenote-content li {
          margin-bottom: 0.25em;
        }
        .onenote-content table {
          border-collapse: collapse;
          margin: 0.5em 0;
          width: 100%;
        }
        .onenote-content td, .onenote-content th {
          border: 1px solid rgba(255,255,255,0.15);
          padding: 6px 10px;
        }
        .onenote-content img {
          max-width: 100%;
          border-radius: 8px;
          margin: 0.5em 0;
        }
        .onenote-content a {
          color: #a78bfa;
          text-decoration: underline;
        }
        .onenote-content br {
          display: block;
          content: "";
          margin-top: 0.3em;
        }
      `}</style>
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/40">
      <StickyNote className="h-10 w-10 mb-3 opacity-50" />
      <p>{label}</p>
    </div>
  );
}
