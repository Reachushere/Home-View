import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft,
  Loader2,
  Home,
  FileText,
  StickyNote,
  Plus,
  Save,
  Search,
  X,
  BookOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Trash2,
  NotebookPen,
  Camera,
  CheckSquare,
  Mic,
  Filter,
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

interface OneNoteNotebook {
  name: string;
  path: string;
  sections: { name: string; id: string }[];
}

interface OneNotePage {
  title: string;
  content: string;
  position: number;
}

interface PageCard {
  notebookName: string;
  sectionName: string;
  title: string;
  preview: string;
  content: string;
  position: number;
}

type TopTab = "recent" | "notebooks";
type BottomTab = "notebooks" | "stickynotes" | "search";
type View = "grid" | "page" | "quicknote-editor";

export default function OneNotePage() {
  const { toast } = useToast();
  const [topTab, setTopTab] = useState<TopTab>("recent");
  const [bottomTab, setBottomTab] = useState<BottomTab>("notebooks");
  const [view, setView] = useState<View>("grid");
  const [selectedPageCard, setSelectedPageCard] = useState<PageCard | null>(null);
  const [selectedQuickNote, setSelectedQuickNote] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [allPageCards, setAllPageCards] = useState<PageCard[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [filterNotebook, setFilterNotebook] = useState<string>('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isChecklistCreating, setIsChecklistCreating] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [checklistName, setChecklistName] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRecRef = useRef<any>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const notebooksQuery = useQuery<OneNoteNotebook[]>({
    queryKey: ["/api/onenote/notebooks"],
    staleTime: 60000,
  });

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedQuickNote?.id, "content"],
    enabled: !!selectedQuickNote && view === 'quicknote-editor',
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest('PUT', `/api/quicknotes/file/${id}/content`, { content });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setIsDirty(false);
      queryClient.setQueryData(["/api/quicknotes/file", variables.id, "content"], { content: variables.content });
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      toast({ title: "Saved to OneDrive" });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/quicknotes/file/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setSelectedQuickNote(null);
      setView('grid');
      toast({ title: "Note deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (contentQuery.data && !isDirty) {
      setEditorContent(contentQuery.data.content);
    }
  }, [contentQuery.data, isDirty]);

  useEffect(() => {
    if (notebooksQuery.data && notebooksQuery.data.length > 0) {
      loadAllPages(notebooksQuery.data);
    }
  }, [notebooksQuery.data]);

  useEffect(() => {
    return () => {
      if (speechRecRef.current) {
        speechRecRef.current.stop();
        speechRecRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showFilterMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  async function loadAllPages(notebooks: OneNoteNotebook[]) {
    setLoadingPages(true);
    const cards: PageCard[] = [];
    for (const nb of notebooks) {
      for (const sec of nb.sections) {
        try {
          const params = new URLSearchParams({ notebook: nb.path, section: sec.name });
          const res = await fetch(`/api/onenote/pages?${params}`);
          if (res.ok) {
            const pages: OneNotePage[] = await res.json();
            for (const page of pages) {
              const preview = page.content.substring(0, 100).replace(/\n/g, ' ').trim();
              cards.push({
                notebookName: nb.name,
                sectionName: sec.name,
                title: page.title,
                preview: preview || 'No additional text',
                content: page.content,
                position: page.position,
              });
            }
          }
        } catch (e) {
          console.error(`Failed to load pages for ${nb.name}/${sec.name}:`, e);
        }
      }
    }
    setAllPageCards(cards);
    setLoadingPages(false);
  }

  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value);
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (selectedQuickNote) {
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate({ id: selectedQuickNote.id, content: value });
      }, 2000);
    }
  }, [selectedQuickNote]);

  function saveNow() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (selectedQuickNote && isDirty) {
      saveMutation.mutate({ id: selectedQuickNote.id, content: editorContent });
    }
  }

  function openPageCard(card: PageCard) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedPageCard(card);
    setSelectedQuickNote(null);
    setView('page');
  }

  function openQuickNote(file: QuickNoteFile) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedQuickNote(file);
    setSelectedPageCard(null);
    setView('quicknote-editor');
  }

  function handleCameraCapture() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const name = `Photo Note ${timestamp}.txt`;
    const content = `📷 Photo captured: ${file.name}\nDate: ${timestamp}\nSize: ${(file.size / 1024).toFixed(1)} KB\n\n---\nNotes:\n`;
    createMutation.mutate({ name, content });
    e.target.value = '';
  }

  function handleStartRecording() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not supported", description: "Speech recognition not available in this browser", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    let transcript = '';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (transcript.trim()) {
        const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const name = `Voice Note ${timestamp}.txt`;
        createMutation.mutate({ name, content: transcript.trim() });
        toast({ title: "Voice note saved", description: `${transcript.trim().split(' ').length} words captured` });
      } else {
        toast({ title: "No speech detected", description: "Try again and speak clearly" });
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        toast({ title: "Microphone blocked", description: "Allow microphone access in your browser", variant: "destructive" });
      } else {
        toast({ title: "Recording error", description: event.error, variant: "destructive" });
      }
    };

    setIsRecording(true);
    recognition.start();
    toast({ title: "Listening...", description: "Speak now. Tap mic again to stop." });

    speechRecRef.current = recognition;
  }

  function handleStopRecording() {
    if (speechRecRef.current) {
      speechRecRef.current.stop();
      speechRecRef.current = null;
    }
    setIsRecording(false);
  }

  function handleCreateChecklist() {
    const items = checklistItems.filter(item => item.trim());
    if (items.length === 0) {
      toast({ title: "Add at least one item" });
      return;
    }
    const name = (checklistName.trim() || 'Checklist') + '.txt';
    const content = items.map(item => `☐ ${item}`).join('\n');
    createMutation.mutate({ name, content });
    setIsChecklistCreating(false);
    setChecklistItems(['']);
    setChecklistName('');
  }

  function goBack() {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedPageCard(null);
    setSelectedQuickNote(null);
    setView('grid');
  }

  const notebooks = notebooksQuery.data || [];
  const quickNoteFiles = filesQuery.data || [];

  const filteredByNotebook = filterNotebook
    ? allPageCards.filter(c => c.notebookName === filterNotebook)
    : allPageCards;

  const filteredCards = searchQuery.trim()
    ? filteredByNotebook.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.sectionName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByNotebook;

  const uniqueNotebookNames = [...new Set(allPageCards.map(c => c.notebookName))];

  const truncatePath = (nbName: string, secName: string) => {
    const full = `${nbName} » ${secName}`;
    return full.length > 24 ? full.substring(0, 22) + '...' : full;
  };

  if (view === 'page' && selectedPageCard) {
    return (
      <div className="h-screen flex flex-col" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>
        <div className="h-12 flex items-center px-4 gap-3 shrink-0" style={{ background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <button onClick={goBack} className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex-1" />
          <span className="text-xs text-white/30">{selectedPageCard.notebookName} » {selectedPageCard.sectionName}</span>
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10" data-testid="link-home">
              <Home className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <OneNotePageContent page={selectedPageCard} />
        </div>
      </div>
    );
  }

  if (view === 'quicknote-editor' && selectedQuickNote) {
    return (
      <div className="h-screen flex flex-col" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>
        <div className="h-12 flex items-center px-4 gap-3 shrink-0" style={{ background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
          <button onClick={goBack} className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex-1" />
          <Button
            variant="ghost" size="sm" onClick={saveNow}
            disabled={saveMutation.isPending || !isDirty}
            className={`h-7 gap-1 text-xs ${isDirty ? 'text-orange-400' : 'text-white/30'}`}
            data-testid="button-save"
          >
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saveMutation.isPending ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => { if (confirm('Delete this note from OneDrive?')) deleteMutation.mutate(selectedQuickNote.id); }}
            className="h-7 w-7 text-white/30 hover:text-red-400"
            data-testid="button-delete-note"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10" data-testid="link-home">
              <Home className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <QuickNoteEditor
            file={selectedQuickNote}
            content={editorContent}
            onChange={handleEditorChange}
            isLoading={contentQuery.isLoading && !contentQuery.data}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>
      {/* Top header */}
      <div className="shrink-0 pt-4 pb-3 px-5" style={{ background: '#1a1a1a' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: '#7b2d8e' }}>
              <NotebookPen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white" data-testid="text-page-title">Notebooks</h1>
              <p className="text-[11px] text-white/40">OneNote</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
              onClick={() => { notebooksQuery.refetch(); if (notebooksQuery.data) loadAllPages(notebooksQuery.data); }}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${notebooksQuery.isFetching || loadingPages ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10" data-testid="link-home">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Top tab pills */}
        {bottomTab === 'notebooks' && (
          <div className="flex gap-2">
            <button
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${topTab === 'recent' ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
              style={{ background: topTab === 'recent' ? '#4a2d6e' : 'rgba(255,255,255,0.08)', border: topTab === 'recent' ? '1px solid #7b4daa' : '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => setTopTab('recent')}
              data-testid="tab-recent-pages"
            >
              Recent pages
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${topTab === 'notebooks' ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
              style={{ background: topTab === 'notebooks' ? '#4a2d6e' : 'rgba(255,255,255,0.08)', border: topTab === 'notebooks' ? '1px solid #7b4daa' : '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => setTopTab('notebooks')}
              data-testid="tab-notebook-list"
            >
              Notebook list
            </button>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto px-5 pb-20">
        {bottomTab === 'notebooks' && topTab === 'recent' && (
          <RecentPagesGrid
            cards={filteredCards}
            isLoading={notebooksQuery.isLoading || loadingPages}
            onOpenCard={openPageCard}
            truncatePath={truncatePath}
          />
        )}
        {bottomTab === 'notebooks' && topTab === 'notebooks' && (
          <NotebookListView
            notebooks={notebooks}
            isLoading={notebooksQuery.isLoading}
            expandedNotebooks={expandedNotebooks}
            onToggleNotebook={(name) => {
              setExpandedNotebooks(prev => {
                const next = new Set(prev);
                if (next.has(name)) next.delete(name);
                else next.add(name);
                return next;
              });
            }}
            allCards={allPageCards}
            onOpenCard={openPageCard}
            truncatePath={truncatePath}
          />
        )}
        {bottomTab === 'stickynotes' && (
          <StickyNotesView
            files={quickNoteFiles}
            isLoading={filesQuery.isLoading}
            onOpenNote={openQuickNote}
            onStartCreate={() => setIsCreating(true)}
          />
        )}
        {bottomTab === 'search' && (
          <SearchView
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cards={filteredCards}
            quickNotes={quickNoteFiles}
            onOpenCard={openPageCard}
            onOpenNote={openQuickNote}
            truncatePath={truncatePath}
          />
        )}
      </div>

      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Filter indicator */}
      {filterNotebook && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-1.5 px-4" style={{ background: '#1a1a1a' }}>
          <span className="text-[11px] text-white/40">Filtered:</span>
          <span className="text-[11px] font-medium" style={{ color: '#c586c0' }}>{filterNotebook}</span>
          <button onClick={() => setFilterNotebook('')} className="text-white/30 hover:text-white/60">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Floating action bar */}
      <div className="shrink-0 flex items-center justify-center gap-1 py-2 px-4" style={{ background: '#1a1a1a' }}>
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-full relative" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}>
          <button
            className="h-9 w-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={handleCameraCapture}
            data-testid="action-camera"
            title="Photo note"
          >
            <Camera className="h-4.5 w-4.5" />
          </button>
          <button
            className="h-9 w-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => { setIsChecklistCreating(true); setChecklistItems(['']); setChecklistName(''); }}
            data-testid="action-checklist"
            title="New checklist"
          >
            <CheckSquare className="h-4.5 w-4.5" />
          </button>
          <button
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            data-testid="action-voice"
            title={isRecording ? "Stop recording" : "Voice note"}
          >
            <Mic className="h-4.5 w-4.5" />
          </button>
          <div className="relative" ref={filterMenuRef}>
            <button
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${filterNotebook ? 'text-purple-400 bg-purple-500/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              data-testid="action-filter"
              title="Filter by notebook"
            >
              <Filter className="h-4.5 w-4.5" />
            </button>
            {showFilterMenu && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 rounded-lg py-1 min-w-[180px] z-50 shadow-xl" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}>
                <button
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${!filterNotebook ? 'text-purple-400 font-medium' : 'text-white/60 hover:bg-white/5'}`}
                  onClick={() => { setFilterNotebook(''); setShowFilterMenu(false); }}
                >
                  All notebooks
                </button>
                {uniqueNotebookNames.map(name => (
                  <button
                    key={name}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${filterNotebook === name ? 'text-purple-400 font-medium' : 'text-white/60 hover:bg-white/5'}`}
                    onClick={() => { setFilterNotebook(name); setShowFilterMenu(false); }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          className="h-11 w-11 rounded-full flex items-center justify-center text-white ml-2 shadow-lg hover:brightness-110 transition-all"
          style={{ background: '#7b2d8e' }}
          onClick={() => setIsCreating(true)}
          data-testid="action-create"
          title="New page"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom navigation bar */}
      <div className="shrink-0 flex items-center justify-around py-2 px-4" style={{ background: '#2d2d30', borderTop: '1px solid #3e3e42' }}>
        <button
          className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded transition-colors ${bottomTab === 'notebooks' ? 'text-white' : 'text-white/40'}`}
          onClick={() => { setBottomTab('notebooks'); setView('grid'); }}
          data-testid="nav-notebooks"
        >
          <BookOpen className="h-5 w-5" />
          <span className="text-[10px]">Notebooks</span>
        </button>
        <button
          className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded transition-colors ${bottomTab === 'stickynotes' ? 'text-white' : 'text-white/40'}`}
          onClick={() => { setBottomTab('stickynotes'); setView('grid'); }}
          data-testid="nav-stickynotes"
        >
          <StickyNote className="h-5 w-5" />
          <span className="text-[10px]">Sticky Notes</span>
        </button>
        <button
          className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded transition-colors ${bottomTab === 'search' ? 'text-white' : 'text-white/40'}`}
          onClick={() => { setBottomTab('search'); setView('grid'); }}
          data-testid="nav-search"
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px]">Search</span>
        </button>
      </div>

      {/* Create note modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsCreating(false)}>
          <div className="rounded-xl p-5 w-full max-w-sm" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3 text-white">New Sticky Note</h3>
            <Input
              value={newNoteName}
              onChange={e => setNewNoteName(e.target.value)}
              placeholder="Note name (e.g. Meeting Notes.txt)"
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 mb-3 text-sm"
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
              <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setNewNoteName(''); }} className="text-white/60 text-xs" data-testid="button-cancel-create">Cancel</Button>
              <Button size="sm" disabled={!newNoteName.trim() || createMutation.isPending}
                onClick={() => {
                  const name = newNoteName.trim().endsWith('.txt') || newNoteName.trim().endsWith('.md') ? newNoteName.trim() : newNoteName.trim() + '.txt';
                  createMutation.mutate({ name, content: '' });
                }}
                className="text-xs text-white"
                style={{ background: '#7b2d8e' }}
                data-testid="button-confirm-create"
              >
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist creation modal */}
      {isChecklistCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsChecklistCreating(false)}>
          <div className="rounded-xl p-5 w-full max-w-sm" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3 text-white flex items-center gap-2">
              <CheckSquare className="h-4 w-4" style={{ color: '#c586c0' }} />
              New Checklist
            </h3>
            <Input
              value={checklistName}
              onChange={e => setChecklistName(e.target.value)}
              placeholder="Checklist title (optional)"
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 mb-3 text-sm"
              autoFocus
              data-testid="input-checklist-name"
            />
            <div className="space-y-1.5 mb-3 max-h-[200px] overflow-y-auto">
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/30 text-sm">☐</span>
                  <Input
                    value={item}
                    onChange={e => {
                      const updated = [...checklistItems];
                      updated[i] = e.target.value;
                      setChecklistItems(updated);
                    }}
                    placeholder={`Item ${i + 1}`}
                    className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-sm flex-1"
                    data-testid={`input-checklist-item-${i}`}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setChecklistItems([...checklistItems, '']);
                      }
                    }}
                  />
                  {checklistItems.length > 1 && (
                    <button onClick={() => setChecklistItems(checklistItems.filter((_, j) => j !== i))} className="text-white/20 hover:text-white/50">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setChecklistItems([...checklistItems, ''])}
              className="text-xs mb-3 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              style={{ color: '#c586c0' }}
              data-testid="button-add-checklist-item"
            >
              + Add item
            </button>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => setIsChecklistCreating(false)} data-testid="button-cancel-checklist">Cancel</Button>
              <Button size="sm" className="text-white" onClick={handleCreateChecklist} disabled={createMutation.isPending} style={{ background: '#7b2d8e' }} data-testid="button-confirm-checklist">
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckSquare className="h-3 w-3 mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentPagesGrid({ cards, isLoading, onOpenCard, truncatePath }: {
  cards: PageCard[];
  isLoading: boolean;
  onOpenCard: (c: PageCard) => void;
  truncatePath: (nb: string, sec: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        <span className="ml-3 text-sm text-white/30">Loading pages...</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-white/30">
        <NotebookPen className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No pages found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {cards.map((card, i) => (
        <PageCardComponent key={`${card.title}-${i}`} card={card} onClick={() => onOpenCard(card)} truncatePath={truncatePath} index={i} />
      ))}
    </div>
  );
}

function PageCardComponent({ card, onClick, truncatePath, index }: {
  card: PageCard;
  onClick: () => void;
  truncatePath: (nb: string, sec: string) => string;
  index: number;
}) {
  return (
    <button
      className="text-left rounded-lg p-3 transition-colors hover:brightness-110 flex flex-col justify-between"
      style={{ background: '#2d2d30', border: '1px solid #3e3e42', minHeight: '140px' }}
      onClick={onClick}
      data-testid={`page-card-${index}`}
    >
      <div>
        <div className="text-[10px] text-white/35 mb-1.5 truncate">
          {truncatePath(card.notebookName, card.sectionName)}
        </div>
        <div className="text-sm font-semibold text-white mb-1 line-clamp-2">
          {card.title || 'Untitled Page'}
        </div>
        <div className="text-xs text-white/40 line-clamp-2">
          {card.preview || 'No additional text'}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <FileText className="h-4 w-4" style={{ color: '#7b2d8e' }} />
        <span className="text-[10px] text-white/25">
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>
    </button>
  );
}

function NotebookListView({ notebooks, isLoading, expandedNotebooks, onToggleNotebook, allCards, onOpenCard, truncatePath }: {
  notebooks: OneNoteNotebook[];
  isLoading: boolean;
  expandedNotebooks: Set<string>;
  onToggleNotebook: (name: string) => void;
  allCards: PageCard[];
  onOpenCard: (c: PageCard) => void;
  truncatePath: (nb: string, sec: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notebooks.map(nb => (
        <div key={nb.name} className="rounded-lg overflow-hidden" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
            onClick={() => onToggleNotebook(nb.name)}
            data-testid={`notebook-${nb.name}`}
          >
            <div className="h-8 w-8 rounded flex items-center justify-center shrink-0" style={{ background: '#7b2d8e' }}>
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{nb.name}</div>
              <div className="text-[11px] text-white/35">{nb.sections.length} section{nb.sections.length !== 1 ? 's' : ''}</div>
            </div>
            {expandedNotebooks.has(nb.name) ? (
              <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            )}
          </button>

          {expandedNotebooks.has(nb.name) && (
            <div className="px-4 pb-3 space-y-1" style={{ borderTop: '1px solid #3e3e42' }}>
              {nb.sections.map(sec => {
                const sectionCards = allCards.filter(c => c.notebookName === nb.name && c.sectionName === sec.name);
                return (
                  <div key={sec.id} className="mt-2">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <FileText className="h-3.5 w-3.5" style={{ color: '#7b2d8e' }} />
                      <span className="text-xs font-medium text-white/60">{sec.name}</span>
                      <span className="text-[10px] text-white/25">({sectionCards.length} pages)</span>
                    </div>
                    {sectionCards.length > 0 && (
                      <div className="grid gap-2 ml-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                        {sectionCards.map((card, i) => (
                          <button
                            key={`${card.title}-${i}`}
                            className="text-left rounded-md p-2.5 hover:bg-white/5 transition-colors"
                            style={{ background: '#252527', border: '1px solid #3e3e42' }}
                            onClick={() => onOpenCard(card)}
                            data-testid={`section-page-${i}`}
                          >
                            <div className="text-xs font-medium text-white/80 truncate">{card.title || 'Untitled Page'}</div>
                            <div className="text-[10px] text-white/30 mt-0.5 truncate">{card.preview || 'No additional text'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StickyNotesView({ files, isLoading, onOpenNote, onStartCreate }: {
  files: QuickNoteFile[];
  isLoading: boolean;
  onOpenNote: (f: QuickNoteFile) => void;
  onStartCreate: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-white/60">Sticky Notes</h2>
        <button
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-white/60 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          onClick={onStartCreate}
          data-testid="button-new-quicknote"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>
      {files.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <StickyNote className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sticky notes yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map(f => (
            <button
              key={f.id}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-white/5"
              style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}
              onClick={() => onOpenNote(f)}
              data-testid={`quicknote-${f.id}`}
            >
              <StickyNote className="h-5 w-5 shrink-0" style={{ color: '#e8b230' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/80 truncate">{f.name}</div>
                {f.lastModified && (
                  <div className="text-[10px] text-white/30 mt-0.5">
                    {new Date(f.lastModified).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchView({ searchQuery, onSearchChange, cards, quickNotes, onOpenCard, onOpenNote, truncatePath }: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cards: PageCard[];
  quickNotes: QuickNoteFile[];
  onOpenCard: (c: PageCard) => void;
  onOpenNote: (f: QuickNoteFile) => void;
  truncatePath: (nb: string, sec: string) => string;
}) {
  const filteredNotes = searchQuery.trim()
    ? quickNotes.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search all notes..."
          className="w-full h-10 pl-10 pr-8 text-sm rounded-lg text-white placeholder:text-white/25 focus:outline-none"
          style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}
          autoFocus
          data-testid="input-search"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="button-clear-search">
            <X className="h-4 w-4 text-white/30" />
          </button>
        )}
      </div>

      {!searchQuery.trim() ? (
        <div className="text-center py-12 text-white/25">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Type to search your notes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-white/40 mb-2">Notebook Pages ({cards.length})</h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {cards.map((card, i) => (
                  <PageCardComponent key={`${card.title}-${i}`} card={card} onClick={() => onOpenCard(card)} truncatePath={truncatePath} index={i} />
                ))}
              </div>
            </div>
          )}
          {filteredNotes.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-white/40 mb-2">Sticky Notes ({filteredNotes.length})</h3>
              <div className="space-y-1">
                {filteredNotes.map(f => (
                  <button
                    key={f.id}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    onClick={() => onOpenNote(f)}
                  >
                    <StickyNote className="h-4 w-4 shrink-0" style={{ color: '#e8b230' }} />
                    <span className="text-sm text-white/70 truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {cards.length === 0 && filteredNotes.length === 0 && (
            <div className="text-center py-8 text-white/25 text-sm">
              No results for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OneNotePageContent({ page }: { page: PageCard }) {
  const lines = page.content.split('\n');

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-onenote-page-title">{page.title}</h1>
      <div className="text-[11px] text-white/30 mb-2">{page.notebookName} » {page.sectionName}</div>
      <div className="h-px mb-5" style={{ background: '#7b2d8e' }} />
      <div className="space-y-1.5">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-3" />;
          const isHeading = line.startsWith('# ') || line.startsWith('## ');
          const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ');
          const isNumbered = /^\d+\.\s/.test(line.trimStart());
          const isLink = line.includes('[http');

          if (isHeading) {
            const level = line.startsWith('## ') ? 2 : 1;
            const text = line.replace(/^#{1,2}\s/, '');
            return (
              <h2 key={i} className={`font-semibold text-white ${level === 1 ? 'text-lg mt-4' : 'text-base mt-3'}`}>
                {text}
              </h2>
            );
          }

          if (isBullet) {
            const indent = line.length - line.trimStart().length;
            const text = line.trimStart().replace(/^[-•]\s/, '');
            return (
              <div key={i} className="flex gap-2 text-sm text-white/80" style={{ paddingLeft: indent * 8 + 'px' }}>
                <span className="text-white/30 mt-0.5 shrink-0">•</span>
                <span>{text}</span>
              </div>
            );
          }

          if (isNumbered) {
            const match = line.trimStart().match(/^(\d+)\.\s(.*)/);
            if (match) {
              return (
                <div key={i} className="flex gap-2 text-sm text-white/80">
                  <span className="text-white/40 shrink-0 w-5 text-right">{match[1]}.</span>
                  <span>{match[2]}</span>
                </div>
              );
            }
          }

          if (isLink) {
            const parts = line.split(/\[([^\]]+)\]/g);
            return (
              <p key={i} className="text-sm text-white/80">
                {parts.map((part, pi) =>
                  part.startsWith('http') ? (
                    <a key={pi} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>
                  ) : (
                    <span key={pi}>{part}</span>
                  )
                )}
              </p>
            );
          }

          return <p key={i} className="text-sm text-white/80 leading-relaxed">{line}</p>;
        })}
      </div>
    </div>
  );
}

function QuickNoteEditor({ file, content, onChange, isLoading }: {
  file: QuickNoteFile;
  content: string;
  onChange: (val: string) => void;
  isLoading: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(400, textareaRef.current.scrollHeight) + 'px';
    }
  }, [content]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  const displayName = file.name.replace(/\.(txt|md)$/i, '');

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-quicknote-title">{displayName}</h1>
      <div className="text-[10px] text-white/25 mb-4 flex items-center gap-2">
        <StickyNote className="h-3 w-3" />
        <span>Auto-saves to OneDrive</span>
      </div>
      <div className="h-px mb-4" style={{ background: '#3e3e42' }} />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent text-white/85 text-sm leading-relaxed resize-none focus:outline-none min-h-[400px] placeholder:text-white/20"
        style={{ fontFamily: "'Segoe UI', sans-serif" }}
        placeholder="Start typing..."
        spellCheck
        data-testid="textarea-editor"
      />
    </div>
  );
}
