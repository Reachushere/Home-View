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
  FolderOpen,
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

export default function OneNotePage() {
  const { toast } = useToast();
  const [selectedNotebook, setSelectedNotebook] = useState<OneNoteNotebook | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ name: string; id: string } | null>(null);
  const [selectedPage, setSelectedPage] = useState<OneNotePage | null>(null);
  const [selectedQuickNote, setSelectedQuickNote] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [showQuickNotes, setShowQuickNotes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notebooksQuery = useQuery<OneNoteNotebook[]>({
    queryKey: ["/api/onenote/notebooks"],
    staleTime: 60000,
  });

  const pagesQuery = useQuery<OneNotePage[]>({
    queryKey: ["/api/onenote/pages", selectedNotebook?.path, selectedSection?.name],
    enabled: !!selectedNotebook && !!selectedSection,
    staleTime: 30000,
    queryFn: async () => {
      const params = new URLSearchParams({
        notebook: selectedNotebook!.path,
        section: selectedSection!.name,
      });
      const res = await fetch(`/api/onenote/pages?${params}`);
      if (!res.ok) throw new Error('Failed to load pages');
      return res.json();
    },
  });

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedQuickNote?.id, "content"],
    enabled: !!selectedQuickNote,
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
    if (notebooksQuery.data && notebooksQuery.data.length > 0 && expandedNotebooks.size === 0) {
      setExpandedNotebooks(new Set([notebooksQuery.data[0].name]));
    }
  }, [notebooksQuery.data]);

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

  function selectSection(notebook: OneNoteNotebook, section: { name: string; id: string }) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedNotebook(notebook);
    setSelectedSection(section);
    setSelectedPage(null);
    setSelectedQuickNote(null);
    setIsDirty(false);
  }

  function selectQuickNote(file: QuickNoteFile) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedQuickNote(file);
    setSelectedPage(null);
    setSelectedSection(null);
    setSelectedNotebook(null);
    setIsDirty(false);
  }

  function toggleNotebook(name: string) {
    setExpandedNotebooks(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const notebooks = notebooksQuery.data || [];
  const pages = pagesQuery.data || [];
  const quickNoteFiles = filesQuery.data || [];

  const filteredPages = searchQuery.trim()
    ? pages.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : pages;

  const isViewingOneNotePage = !!selectedPage;
  const isViewingQuickNote = !!selectedQuickNote;
  const showPageList = !!selectedSection && !selectedQuickNote;

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1e1e1e', color: '#d4d4d4' }}>
      {/* Top bar */}
      <div className="h-10 flex items-center px-3 gap-2 shrink-0" style={{ background: '#7b2d8e', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <NotebookPen className="h-4 w-4 text-white/80" />
        <span className="text-sm font-semibold text-white" data-testid="text-page-title">OneNote</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
          onClick={() => notebooksQuery.refetch()}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${notebooksQuery.isFetching ? 'animate-spin' : ''}`} />
        </Button>
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10" data-testid="link-home">
            <Home className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Notebooks & Sections */}
        <div className="w-56 shrink-0 flex flex-col overflow-y-auto" style={{ background: '#252526', borderRight: '1px solid #3c3c3c' }}>
          <div className="px-3 pt-3 pb-2">
            <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Notebooks</span>
          </div>

          {notebooksQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-white/30" />
            </div>
          ) : (
            <div className="flex-1">
              {notebooks.map(nb => (
                <div key={nb.name}>
                  <button
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
                    onClick={() => toggleNotebook(nb.name)}
                    data-testid={`notebook-${nb.name}`}
                  >
                    {expandedNotebooks.has(nb.name) ? (
                      <ChevronDown className="h-3 w-3 text-white/40 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-white/40 shrink-0" />
                    )}
                    <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: '#7b2d8e' }} />
                    <span className="text-xs text-white/80 truncate">{nb.name}</span>
                  </button>

                  {expandedNotebooks.has(nb.name) && (
                    <div className="ml-3">
                      {nb.sections.map(sec => {
                        const isActive = selectedSection?.id === sec.id && selectedNotebook?.path === nb.path;
                        return (
                          <button
                            key={sec.id}
                            className={`w-full flex items-center gap-1.5 px-3 py-1 text-left transition-colors rounded-sm ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60'}`}
                            onClick={() => selectSection(nb, sec)}
                            data-testid={`section-${sec.name}`}
                          >
                            <FileText className="h-3 w-3 shrink-0" style={{ color: isActive ? '#c586c0' : undefined }} />
                            <span className="text-xs truncate">{sec.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* QuickNotes section */}
              <div className="mt-2 border-t border-white/5 pt-1">
                <button
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setShowQuickNotes(!showQuickNotes)}
                  data-testid="toggle-quicknotes"
                >
                  {showQuickNotes ? (
                    <ChevronDown className="h-3 w-3 text-white/40 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-white/40 shrink-0" />
                  )}
                  <StickyNote className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  <span className="text-xs text-white/80 truncate">QuickNotes</span>
                  <span className="text-[10px] text-white/30 ml-auto">{quickNoteFiles.length}</span>
                </button>

                {showQuickNotes && (
                  <div className="ml-3">
                    {quickNoteFiles.map(f => {
                      const isActive = selectedQuickNote?.id === f.id;
                      return (
                        <button
                          key={f.id}
                          className={`w-full flex items-center gap-1.5 px-3 py-1 text-left transition-colors rounded-sm ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60'}`}
                          onClick={() => selectQuickNote(f)}
                          data-testid={`quicknote-${f.id}`}
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="text-xs truncate">{f.name}</span>
                        </button>
                      );
                    })}
                    <button
                      className="w-full flex items-center gap-1.5 px-3 py-1 text-left hover:bg-white/5 text-white/40 transition-colors"
                      onClick={() => setIsCreating(true)}
                      data-testid="button-new-quicknote"
                    >
                      <Plus className="h-3 w-3 shrink-0" />
                      <span className="text-xs">New note</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Page list panel */}
        {showPageList && (
          <div className="w-56 shrink-0 flex flex-col overflow-y-auto" style={{ background: '#2d2d2d', borderRight: '1px solid #3c3c3c' }}>
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/60">{selectedSection?.name}</span>
            </div>

            {/* Search */}
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full h-6 pl-7 pr-6 text-[11px] rounded bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                  data-testid="input-search-pages"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-white/30" />
                  </button>
                )}
              </div>
            </div>

            {pagesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-white/30" />
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="text-center py-8 text-white/25 text-xs">
                {searchQuery ? 'No matching pages' : 'No pages found'}
              </div>
            ) : (
              <div className="flex-1">
                {filteredPages.map((page, i) => {
                  const isActive = selectedPage?.title === page.title && selectedPage?.position === page.position;
                  const preview = page.content.substring(0, 80).replace(/\n/g, ' ');
                  return (
                    <button
                      key={`${page.title}-${i}`}
                      className={`w-full text-left px-3 py-2 transition-colors border-b border-white/5 ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                      onClick={() => { setSelectedPage(page); setSelectedQuickNote(null); }}
                      data-testid={`page-${i}`}
                    >
                      <div className="text-xs font-medium text-white/90 truncate">{page.title}</div>
                      <div className="text-[10px] text-white/30 mt-0.5 line-clamp-2">{preview || '(empty)'}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#1e1e1e' }}>
          {isViewingOneNotePage && selectedPage ? (
            <OneNotePageContent page={selectedPage} />
          ) : isViewingQuickNote && selectedQuickNote ? (
            <QuickNoteEditor
              file={selectedQuickNote}
              content={editorContent}
              onChange={handleEditorChange}
              isLoading={contentQuery.isLoading && !contentQuery.data}
              isDirty={isDirty}
              isSaving={saveMutation.isPending}
              onSave={saveNow}
              onDelete={() => {
                if (confirm('Delete this note from OneDrive?')) {
                  deleteMutation.mutate(selectedQuickNote.id);
                }
              }}
            />
          ) : (
            <WelcomeView
              notebooksCount={notebooks.length}
              sectionsCount={notebooks.reduce((s, nb) => s + nb.sections.length, 0)}
              isLoading={notebooksQuery.isLoading}
            />
          )}
        </div>
      </div>

      {/* Create note modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsCreating(false)}>
          <div className="rounded-lg p-5 w-full max-w-sm" style={{ background: '#2d2d2d', border: '1px solid #3c3c3c' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3 text-white">New Quick Note</h3>
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
                className="text-xs"
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
    </div>
  );
}

function OneNotePageContent({ page }: { page: OneNotePage }) {
  const lines = page.content.split('\n');

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-onenote-page-title">{page.title}</h1>
      <div className="h-px mb-6" style={{ background: '#7b2d8e' }} />
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

function QuickNoteEditor({ file, content, onChange, isLoading, isDirty, isSaving, onSave, onDelete }: {
  file: QuickNoteFile;
  content: string;
  onChange: (val: string) => void;
  isLoading: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDelete: () => void;
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
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white" data-testid="text-quicknote-title">{displayName}</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm" onClick={onSave}
            disabled={isSaving || !isDirty}
            className={`h-7 gap-1 text-xs ${isDirty ? 'text-orange-400 hover:text-orange-300' : 'text-white/30'}`}
            data-testid="button-save"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {isSaving ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
          </Button>
          <Button
            variant="ghost" size="icon" onClick={onDelete}
            className="h-7 w-7 text-white/30 hover:text-red-400"
            data-testid="button-delete-note"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="text-[10px] text-white/25 mb-4 flex items-center gap-2">
        <StickyNote className="h-3 w-3" />
        <span>Auto-saves to OneDrive</span>
        {isSaving && <span className="text-yellow-400/60">Saving...</span>}
      </div>
      <div className="h-px mb-4" style={{ background: '#3c3c3c' }} />
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

function WelcomeView({ notebooksCount, sectionsCount, isLoading }: {
  notebooksCount: number;
  sectionsCount: number;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        {isLoading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/30">Loading notebooks...</p>
          </>
        ) : (
          <>
            <NotebookPen className="h-12 w-12 mx-auto mb-4" style={{ color: '#7b2d8e', opacity: 0.5 }} />
            <h2 className="text-lg font-semibold text-white/60 mb-1">OneNote</h2>
            <p className="text-xs text-white/30">
              {notebooksCount} notebook{notebooksCount !== 1 ? 's' : ''} &middot; {sectionsCount} section{sectionsCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-white/20 mt-2">Select a section to view pages</p>
          </>
        )}
      </div>
    </div>
  );
}
