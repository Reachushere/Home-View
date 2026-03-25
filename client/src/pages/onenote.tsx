import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Plus,
  Save,
  Search,
  X,
  BookOpen,
  FolderOpen,
  Pencil,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface QuickNoteFile {
  id: string;
  name: string;
  type: string;
  size?: number;
  lastModified?: string;
  path: string;
}

type View = 'home' | 'notebooks' | 'editor' | 'search';

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
  const [view, setView] = useState<View>('home');
  const [selectedFile, setSelectedFile] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedFile?.id, "content"],
    enabled: !!selectedFile && view === 'editor',
    staleTime: 5000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest('PUT', `/api/quicknotes/file/${id}/content`, { content });
      return res.json();
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const res = await apiRequest('POST', '/api/quicknotes/files', { name, content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setIsCreating(false);
      setNewNoteName('');
      toast({ title: "Note created" });
    },
    onError: (err: any) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (contentQuery.data && !isDirty) {
      setEditorContent(contentQuery.data.content);
    }
  }, [contentQuery.data, isDirty]);

  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value);
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (selectedFile) {
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate({ id: selectedFile.id, content: value });
      }, 2000);
    }
  }, [selectedFile]);

  function saveNow() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (selectedFile && isDirty) {
      saveMutation.mutate({ id: selectedFile.id, content: editorContent });
    }
  }

  function openNote(file: QuickNoteFile) {
    if (isDirty && selectedFile) saveNow();
    setSelectedFile(file);
    setIsDirty(false);
    setView('editor');
  }

  function goHome() {
    if (isDirty && selectedFile) saveNow();
    setSelectedFile(null);
    setIsDirty(false);
    setView('home');
    setSearchQuery('');
  }

  const files = filesQuery.data || [];
  const recentFiles = [...files].sort((a, b) => {
    if (!a.lastModified || !b.lastModified) return 0;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  }).slice(0, 5);

  const filteredFiles = searchQuery.trim()
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white">
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view !== 'home' && (
              <Button variant="ghost" size="icon" onClick={goHome} className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <StickyNote className="h-5 w-5 text-purple-400" />
            <h1 className="text-base font-semibold" data-testid="text-page-title">Quick Notes</h1>
            {view === 'editor' && selectedFile && (
              <span className="text-white/40 text-sm ml-1">/ {selectedFile.name}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {view === 'editor' && isDirty && (
              <Button variant="ghost" size="sm" onClick={saveNow} disabled={saveMutation.isPending} className="text-white/60 hover:text-white hover:bg-white/10 h-8 gap-1 text-xs" data-testid="button-save">
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            )}
            {view === 'editor' && !isDirty && saveMutation.isSuccess && (
              <span className="text-green-400/60 text-xs flex items-center gap-1 mr-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Saved
              </span>
            )}
            <Button
              variant="ghost" size="icon"
              onClick={() => { setView(view === 'search' ? 'home' : 'search'); setSearchQuery(''); }}
              className={`h-8 w-8 ${view === 'search' ? 'text-purple-400 bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              data-testid="button-search"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8" data-testid="link-home">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {view === 'home' && <HomeView files={files} recentFiles={recentFiles} isLoading={filesQuery.isLoading} onOpenNote={openNote} onGoNotebooks={() => setView('notebooks')} onStartCreate={() => setIsCreating(true)} />}
        {view === 'notebooks' && <NotebooksView files={files} isLoading={filesQuery.isLoading} onOpenNote={openNote} onStartCreate={() => setIsCreating(true)} />}
        {view === 'editor' && <EditorView content={editorContent} onChange={handleEditorChange} isLoading={contentQuery.isLoading && !contentQuery.data} file={selectedFile} isDirty={isDirty} isSaving={saveMutation.isPending} />}
        {view === 'search' && <SearchView files={filteredFiles} searchQuery={searchQuery} onSearchChange={setSearchQuery} onOpenNote={openNote} isLoading={filesQuery.isLoading} />}
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsCreating(false)}>
          <div className="bg-slate-900 border border-white/15 rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">New Note</h3>
            <Input
              value={newNoteName}
              onChange={e => setNewNoteName(e.target.value)}
              placeholder="Note name (e.g. Meeting Notes.txt)"
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 mb-3"
              autoFocus
              data-testid="input-new-note-name"
              onKeyDown={e => {
                if (e.key === 'Enter' && newNoteName.trim()) {
                  const name = newNoteName.trim().endsWith('.txt') || newNoteName.trim().endsWith('.md') ? newNoteName.trim() : newNoteName.trim() + '.txt';
                  createMutation.mutate({ name, content: '' });
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setNewNoteName(''); }} className="text-white/60" data-testid="button-cancel-create">Cancel</Button>
              <Button size="sm" disabled={!newNoteName.trim() || createMutation.isPending}
                onClick={() => {
                  const name = newNoteName.trim().endsWith('.txt') || newNoteName.trim().endsWith('.md') ? newNoteName.trim() : newNoteName.trim() + '.txt';
                  createMutation.mutate({ name, content: '' });
                }}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-confirm-create"
              >
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeView({ files, recentFiles, isLoading, onOpenNote, onGoNotebooks, onStartCreate }: {
  files: QuickNoteFile[];
  recentFiles: QuickNoteFile[];
  isLoading: boolean;
  onOpenNote: (f: QuickNoteFile) => void;
  onGoNotebooks: () => void;
  onStartCreate: () => void;
}) {
  if (isLoading) return <LoadingState label="Loading notes..." />;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Card className="flex-1 bg-white/5 border-white/10 hover:bg-white/8 transition-colors cursor-pointer" onClick={onStartCreate} data-testid="card-new-note">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Plus className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">New Note</h3>
              <p className="text-[11px] text-white/40">Create a new note</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 bg-white/5 border-white/10 hover:bg-white/8 transition-colors cursor-pointer" onClick={onGoNotebooks} data-testid="card-all-notebooks">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">All Notes</h3>
              <p className="text-[11px] text-white/40">{files.length} note{files.length !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {recentFiles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock className="h-4 w-4 text-white/40" />
            <h2 className="text-sm font-medium text-white/60">Recent Notes</h2>
          </div>
          <div className="space-y-1.5">
            {recentFiles.map(f => (
              <NoteRow key={f.id} file={f} onOpen={onOpenNote} />
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notes yet</p>
          <p className="text-xs text-white/25 mt-1">Create your first note or add files to the QuickNotes folder in OneDrive</p>
        </div>
      )}
    </div>
  );
}

function NotebooksView({ files, isLoading, onOpenNote, onStartCreate }: {
  files: QuickNoteFile[];
  isLoading: boolean;
  onOpenNote: (f: QuickNoteFile) => void;
  onStartCreate: () => void;
}) {
  if (isLoading) return <LoadingState label="Loading notes..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-white/40" />
          <h2 className="text-sm font-medium text-white/60">QuickNotes</h2>
          <span className="text-xs text-white/30">({files.length})</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onStartCreate} className="text-white/60 hover:text-white hover:bg-white/10 h-7 gap-1 text-xs" data-testid="button-create-in-notebooks">
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>
      {files.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notes in this notebook</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map(f => (
            <NoteRow key={f.id} file={f} onOpen={onOpenNote} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditorView({ content, onChange, isLoading, file, isDirty, isSaving }: {
  content: string;
  onChange: (val: string) => void;
  isLoading: boolean;
  file: QuickNoteFile | null;
  isDirty: boolean;
  isSaving: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(400, textareaRef.current.scrollHeight) + 'px';
    }
  }, [content]);

  if (isLoading) return <LoadingState label="Loading note..." />;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-white/30">
        <Pencil className="h-3 w-3" />
        <span>Type here to edit — auto-saves to OneDrive after 2 seconds</span>
        {isSaving && <span className="text-yellow-400/60 ml-auto">Saving...</span>}
        {!isSaving && !isDirty && <span className="text-green-400/50 ml-auto">Synced</span>}
        {isDirty && !isSaving && <span className="text-orange-400/50 ml-auto">Unsaved changes</span>}
      </div>
      <Card className="bg-white/[0.03] border-white/10">
        <CardContent className="p-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-transparent text-white/90 text-[15px] leading-relaxed p-5 resize-none focus:outline-none font-mono min-h-[400px] placeholder:text-white/20"
            placeholder="Start typing your note..."
            spellCheck
            data-testid="textarea-editor"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SearchView({ files, searchQuery, onSearchChange, onOpenNote, isLoading }: {
  files: QuickNoteFile[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNote: (f: QuickNoteFile) => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search notes by name..."
          className="pl-9 pr-8 bg-white/5 border-white/15 text-white placeholder:text-white/30"
          autoFocus
          data-testid="input-search"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" data-testid="button-clear-search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isLoading ? (
        <LoadingState label="Searching..." />
      ) : !searchQuery.trim() ? (
        <div className="text-center py-12 text-white/30">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Type to search your notes</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <p className="text-sm">No notes matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map(f => (
            <NoteRow key={f.id} file={f} onOpen={onOpenNote} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({ file, onOpen }: { file: QuickNoteFile; onOpen: (f: QuickNoteFile) => void }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
      onClick={() => onOpen(file)}
      data-testid={`note-row-${file.id}`}
    >
      <div className="h-8 w-8 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0">
        <FileText className="h-4 w-4 text-purple-400/80" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white/90 truncate" data-testid={`text-note-name-${file.id}`}>{file.name}</h3>
        <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5">
          {file.lastModified && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(file.lastModified)}
            </span>
          )}
          {file.size != null && (
            <span>{file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}</span>
          )}
        </div>
      </div>
      <Pencil className="h-3.5 w-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/50">
      <Loader2 className="h-6 w-6 animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
