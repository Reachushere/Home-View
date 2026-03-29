import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Loader2,
  Home,
  StickyNote,
  Plus,
  Save,
  X,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Trash2,
  NotebookPen,
  Link2,
  ExternalLink,
  FileText,
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

interface SharedNotebookLink {
  id: number;
  name: string;
  url: string;
  notebookId: string | null;
  createdAt: string;
}

interface NotebookSection {
  name: string;
  id: string;
}

interface NotebookInfo {
  name: string;
  path: string;
  sections: NotebookSection[];
}

interface PageInfo {
  title: string;
  content: string;
  contentHtml: string;
  webUrl: string;
  id: string;
}

type SidebarTab = "notebooks" | "quicknotes";
type MainView = "notebook-content" | "quicknote-editor" | "welcome";

function getOneNoteOnlineUrl(url: string): string {
  const residMatch = url.match(/[?&]resid=([^&]+)/i);
  if (residMatch) {
    const resid = decodeURIComponent(residMatch[1]);
    const authkeyMatch = url.match(/[?&]authkey=([^&]+)/i);
    const authkey = authkeyMatch ? `&authkey=${decodeURIComponent(authkeyMatch[1])}` : '';
    return `https://onedrive.live.com/edit?resid=${resid}${authkey}&ithint=onenote`;
  }
  return url;
}

export default function OneNotePage() {
  const { toast } = useToast();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("notebooks");
  const [mainView, setMainView] = useState<MainView>("welcome");
  const [selectedNotebook, setSelectedNotebook] = useState<NotebookInfo | null>(null);
  const [selectedSection, setSelectedSection] = useState<NotebookSection | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageInfo | null>(null);
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [selectedQuickNote, setSelectedQuickNote] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notebooksQuery = useQuery<NotebookInfo[]>({
    queryKey: ["/api/onenote/notebooks"],
    staleTime: 120000,
  });

  const sharedLinksQuery = useQuery<SharedNotebookLink[]>({
    queryKey: ["/api/shared-notebook-links"],
    staleTime: 60000,
  });

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const pagesQuery = useQuery<PageInfo[]>({
    queryKey: ["/api/onenote/sections", selectedSection?.id, "pages"],
    queryFn: () => fetch(`/api/onenote/sections/${selectedSection!.id}/pages`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!selectedSection,
    staleTime: 60000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedQuickNote?.id, "content"],
    enabled: !!selectedQuickNote && mainView === 'quicknote-editor',
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

  const createNoteMutation = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const res = await apiRequest('POST', '/api/quicknotes/files', { name, content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setIsCreatingNote(false);
      setNewNoteName('');
      toast({ title: "Note created" });
    },
    onError: (err: any) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/quicknotes/file/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setSelectedQuickNote(null);
      setMainView('welcome');
      toast({ title: "Note deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const addSharedLinkMutation = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const res = await apiRequest('POST', '/api/shared-notebook-links', { name, url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-notebook-links"] });
      setIsAddingLink(false);
      setNewLinkName('');
      setNewLinkUrl('');
      toast({ title: "Notebook link added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add link", description: err.message, variant: "destructive" });
    },
  });

  const deleteSharedLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/shared-notebook-links/${id}`);
      return res.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-notebook-links"] });
      toast({ title: "Notebook link removed" });
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

  function toggleNotebook(nb: NotebookInfo) {
    setExpandedNotebooks(prev => {
      const next = new Set(prev);
      if (next.has(nb.name)) {
        next.delete(nb.name);
      } else {
        next.add(nb.name);
      }
      return next;
    });
  }

  function selectSection(nb: NotebookInfo, section: NotebookSection) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedNotebook(nb);
    setSelectedSection(section);
    setSelectedPage(null);
    setSelectedQuickNote(null);
    setMainView('notebook-content');
  }

  function selectQuickNote(file: QuickNoteFile) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedQuickNote(file);
    setSelectedNotebook(null);
    setSelectedSection(null);
    setSelectedPage(null);
    setMainView('quicknote-editor');
  }

  const notebooks = notebooksQuery.data || [];
  const sharedLinks = sharedLinksQuery.data || [];
  const quickNoteFiles = filesQuery.data || [];
  const pages = pagesQuery.data || [];

  return (
    <div className="h-screen flex" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>
      <div className="w-[280px] shrink-0 flex flex-col h-full" style={{ background: '#252526', borderRight: '1px solid #3e3e42' }}>
        <div className="shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: '#7b2d8e' }}>
                <NotebookPen className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white" data-testid="text-page-title">OneNote</h1>
                <p className="text-[10px] text-white/35">Notebooks & Notes</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10" data-testid="link-home">
                <Home className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="flex gap-1">
            <button
              className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${sidebarTab === 'notebooks' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
              style={{ background: sidebarTab === 'notebooks' ? '#3e3e42' : 'transparent' }}
              onClick={() => setSidebarTab('notebooks')}
              data-testid="tab-notebooks"
            >
              Notebooks
            </button>
            <button
              className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${sidebarTab === 'quicknotes' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
              style={{ background: sidebarTab === 'quicknotes' ? '#3e3e42' : 'transparent' }}
              onClick={() => setSidebarTab('quicknotes')}
              data-testid="tab-quicknotes"
            >
              Quick Notes
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sidebarTab === 'notebooks' && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">My Notebooks</span>
              </div>

              {notebooksQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                </div>
              ) : notebooks.length === 0 ? (
                <div className="text-center py-4 px-2">
                  <BookOpen className="h-5 w-5 mx-auto mb-2 text-white/15" />
                  <p className="text-[11px] text-white/25">No notebooks found</p>
                </div>
              ) : (
                <div className="space-y-0.5 mb-3">
                  {notebooks.map(nb => (
                    <div key={nb.name}>
                      <button
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors hover:bg-white/5"
                        onClick={() => toggleNotebook(nb)}
                        data-testid={`notebook-${nb.name}`}
                      >
                        {expandedNotebooks.has(nb.name) ? (
                          <ChevronDown className="h-3 w-3 text-white/30 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
                        )}
                        <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ background: '#7b2d8e' }}>
                          <BookOpen className="h-3 w-3 text-white/80" />
                        </div>
                        <span className="text-xs font-medium text-white/70 truncate">{nb.name}</span>
                      </button>
                      {expandedNotebooks.has(nb.name) && nb.sections.length > 0 && (
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {nb.sections.map(sec => (
                            <button
                              key={sec.id}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                                selectedSection?.id === sec.id ? 'bg-white/10' : 'hover:bg-white/5'
                              }`}
                              onClick={() => selectSection(nb, sec)}
                              data-testid={`section-${sec.id}`}
                            >
                              <FolderOpen className="h-3 w-3 text-white/30 shrink-0" />
                              <span className="text-[11px] text-white/60 truncate">{sec.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mb-2 px-1 mt-4">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Shared Links</span>
                <button
                  className="h-5 w-5 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={() => setIsAddingLink(true)}
                  data-testid="button-add-shared-link"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {isAddingLink && (
                <div className="rounded-lg p-3 mb-2 space-y-2" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}>
                  <input
                    type="text"
                    value={newLinkName}
                    onChange={e => setNewLinkName(e.target.value)}
                    placeholder="Notebook name"
                    className="w-full h-7 px-2.5 text-xs rounded text-white placeholder:text-white/25 focus:outline-none"
                    style={{ background: '#1e1e1e', border: '1px solid #3e3e42' }}
                    autoFocus
                    data-testid="input-link-name"
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    placeholder="Paste OneDrive sharing link..."
                    className="w-full h-7 px-2.5 text-xs rounded text-white placeholder:text-white/25 focus:outline-none"
                    style={{ background: '#1e1e1e', border: '1px solid #3e3e42' }}
                    data-testid="input-link-url"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newLinkName.trim() && newLinkUrl.trim()) {
                        addSharedLinkMutation.mutate({ name: newLinkName.trim(), url: newLinkUrl.trim() });
                      }
                    }}
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      className="px-2.5 py-1 rounded text-[10px] text-white/40 hover:text-white transition-colors"
                      onClick={() => { setIsAddingLink(false); setNewLinkName(''); setNewLinkUrl(''); }}
                      data-testid="button-cancel-link"
                    >
                      Cancel
                    </button>
                    <button
                      className="px-2.5 py-1 rounded text-[10px] text-white font-medium transition-colors"
                      style={{ background: '#7b2d8e' }}
                      onClick={() => {
                        if (!newLinkName.trim() || !newLinkUrl.trim()) {
                          toast({ title: "Enter a name and URL" });
                          return;
                        }
                        addSharedLinkMutation.mutate({ name: newLinkName.trim(), url: newLinkUrl.trim() });
                      }}
                      disabled={addSharedLinkMutation.isPending}
                      data-testid="button-save-link"
                    >
                      {addSharedLinkMutation.isPending ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {sharedLinks.length > 0 && (
                <div className="space-y-0.5">
                  {sharedLinks.map(link => (
                    <div
                      key={link.id}
                      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-white/5"
                      data-testid={`shared-link-${link.id}`}
                    >
                      <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ background: '#3e3e42' }}>
                        <Link2 className="h-3 w-3 text-white/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-white/60 truncate">{link.name}</div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={getOneNoteOnlineUrl(link.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-5 w-5 flex items-center justify-center rounded text-white/25 hover:text-white hover:bg-white/10"
                          onClick={e => e.stopPropagation()}
                          data-testid={`link-open-external-${link.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          className="h-5 w-5 flex items-center justify-center rounded text-white/25 hover:text-red-400 hover:bg-white/10"
                          onClick={e => { e.stopPropagation(); if (confirm('Remove this notebook link?')) deleteSharedLinkMutation.mutate(link.id); }}
                          data-testid={`button-delete-link-${link.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sidebarTab === 'quicknotes' && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Quick Notes</span>
                <button
                  className="h-5 w-5 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={() => setIsCreatingNote(true)}
                  data-testid="button-new-quicknote"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {isCreatingNote && (
                <div className="rounded-lg p-3 mb-2 space-y-2" style={{ background: '#2d2d30', border: '1px solid #3e3e42' }}>
                  <input
                    type="text"
                    value={newNoteName}
                    onChange={e => setNewNoteName(e.target.value)}
                    placeholder="Note name (e.g. Meeting Notes)"
                    className="w-full h-7 px-2.5 text-xs rounded text-white placeholder:text-white/25 focus:outline-none"
                    style={{ background: '#1e1e1e', border: '1px solid #3e3e42' }}
                    autoFocus
                    data-testid="input-new-note-name"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newNoteName.trim()) {
                        const name = newNoteName.trim().endsWith('.txt') || newNoteName.trim().endsWith('.md') ? newNoteName.trim() : newNoteName.trim() + '.txt';
                        createNoteMutation.mutate({ name, content: '' });
                      }
                    }}
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      className="px-2.5 py-1 rounded text-[10px] text-white/40 hover:text-white transition-colors"
                      onClick={() => { setIsCreatingNote(false); setNewNoteName(''); }}
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </button>
                    <button
                      className="px-2.5 py-1 rounded text-[10px] text-white font-medium transition-colors"
                      style={{ background: '#7b2d8e' }}
                      onClick={() => {
                        if (!newNoteName.trim()) return;
                        const name = newNoteName.trim().endsWith('.txt') || newNoteName.trim().endsWith('.md') ? newNoteName.trim() : newNoteName.trim() + '.txt';
                        createNoteMutation.mutate({ name, content: '' });
                      }}
                      disabled={createNoteMutation.isPending}
                      data-testid="button-confirm-create"
                    >
                      {createNoteMutation.isPending ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}

              {filesQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                </div>
              ) : quickNoteFiles.length === 0 && !isCreatingNote ? (
                <div className="text-center py-6 px-2">
                  <StickyNote className="h-5 w-5 mx-auto mb-2 text-white/15" />
                  <p className="text-[11px] text-white/25">No quick notes yet</p>
                  <p className="text-[10px] text-white/15 mt-1">Click + to create one</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {quickNoteFiles.map(file => (
                    <button
                      key={file.id}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                        selectedQuickNote?.id === file.id && mainView === 'quicknote-editor'
                          ? 'bg-white/10'
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => selectQuickNote(file)}
                      data-testid={`quicknote-${file.id}`}
                    >
                      <StickyNote className="h-4 w-4 shrink-0" style={{ color: '#e8b230' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/70 truncate">{file.name}</div>
                        {file.lastModified && (
                          <div className="text-[9px] text-white/20 mt-0.5">
                            {new Date(file.lastModified).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-3 w-3 text-white/15 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0">
        {mainView === 'notebook-content' && selectedNotebook && selectedSection && (
          <>
            <div className="h-10 flex items-center px-4 gap-3 shrink-0" style={{ background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
              <BookOpen className="h-3.5 w-3.5" style={{ color: '#7b2d8e' }} />
              <span className="text-xs font-medium text-white/80 truncate">
                {selectedNotebook.name} &rsaquo; {selectedSection.name}
              </span>
              <div className="flex-1" />
              <button
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-purple-300/70 hover:text-purple-300 hover:bg-white/5 transition-colors"
                onClick={() => window.open('https://www.onenote.com/notebooks', '_blank')}
                data-testid="button-open-onenote"
              >
                <ExternalLink className="h-3 w-3" />
                Open in OneNote
              </button>
              <span className="text-[10px] text-white/25">
                {pages.length} page{pages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pagesQuery.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              ) : pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <FileText className="h-10 w-10 text-white/10" />
                  <p className="text-sm text-white/30">No pages available</p>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-purple-300/80 hover:text-purple-200 bg-white/5 hover:bg-white/10 transition-colors"
                    onClick={() => window.open('https://www.onenote.com/notebooks', '_blank')}
                    data-testid="button-open-onenote-empty"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View in OneNote Online
                  </button>
                </div>
              ) : selectedPage ? (
                <div className="flex flex-col h-full">
                  <div className="h-9 flex items-center px-4 gap-2 shrink-0" style={{ background: '#1e1e1e', borderBottom: '1px solid #3e3e42' }}>
                    <button
                      className="text-[10px] text-white/40 hover:text-white transition-colors"
                      onClick={() => setSelectedPage(null)}
                      data-testid="button-back-to-pages"
                    >
                      ← Pages
                    </button>
                    <span className="text-[10px] text-white/20">|</span>
                    <FileText className="h-3 w-3 text-purple-400/50 shrink-0" />
                    <span className="text-xs text-white/70 truncate">{selectedPage.title}</span>
                    <div className="flex-1" />
                    {selectedPage.webUrl && (
                      <a
                        href={selectedPage.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-purple-300/60 hover:text-purple-300 hover:bg-white/5 transition-colors"
                        data-testid="button-open-page-onenote"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Edit in OneNote
                      </a>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ background: '#ffffff' }}>
                    <div
                      className="onenote-content"
                      style={{ padding: '24px 32px', minHeight: '100%', fontSize: '14px', lineHeight: '1.6', color: '#1a1a1a' }}
                      dangerouslySetInnerHTML={{ __html: selectedPage.contentHtml || `<p style="color:#999;font-style:italic">Empty page</p>` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-8 py-6 space-y-1">
                      {pages.map((page, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg px-4 py-3 transition-colors cursor-pointer hover:bg-white/5"
                          style={{ background: '#252526', border: '1px solid #3e3e42' }}
                          onClick={() => setSelectedPage(page)}
                          data-testid={`page-card-${idx}`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-purple-400/60 shrink-0" />
                            <h3 className="text-sm font-medium text-white/80 flex-1 truncate">{page.title}</h3>
                            {page.webUrl && (
                              <a
                                href={page.webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-5 w-5 flex items-center justify-center rounded text-white/20 hover:text-purple-300 hover:bg-white/10 shrink-0"
                                onClick={e => e.stopPropagation()}
                                data-testid={`page-external-${idx}`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <ChevronRight className="h-3 w-3 text-white/15 shrink-0" />
                          </div>
                          <p className="text-[11px] text-white/30 truncate pl-5 mt-1">
                            {page.content ? page.content.substring(0, 150) + (page.content.length > 150 ? '...' : '') : 'Empty page'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {mainView === 'quicknote-editor' && selectedQuickNote && (
          <>
            <div className="h-10 flex items-center px-4 gap-3 shrink-0" style={{ background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
              <StickyNote className="h-3.5 w-3.5" style={{ color: '#e8b230' }} />
              <span className="text-xs font-medium text-white/80 truncate">
                {selectedQuickNote.name.replace(/\.(txt|md)$/i, '')}
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost" size="sm" onClick={saveNow}
                disabled={saveMutation.isPending || !isDirty}
                className={`h-6 gap-1 text-[10px] ${isDirty ? 'text-orange-400' : 'text-white/25'}`}
                data-testid="button-save"
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {saveMutation.isPending ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
              </Button>
              <button
                className="h-6 w-6 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-white/10 transition-colors"
                onClick={() => { if (confirm('Delete this note from OneDrive?')) deleteNoteMutation.mutate(selectedQuickNote.id); }}
                data-testid="button-delete-note"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QuickNoteEditor
                file={selectedQuickNote}
                content={editorContent}
                onChange={handleEditorChange}
                isLoading={contentQuery.isLoading && !contentQuery.data}
              />
            </div>
          </>
        )}

        {mainView === 'welcome' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: '#7b2d8e22' }}>
              <NotebookPen className="h-7 w-7" style={{ color: '#7b2d8e' }} />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-white/70 mb-1" data-testid="text-welcome-title">OneNote</h2>
              <p className="text-xs text-white/30 max-w-sm">
                Browse your OneNote notebooks and sections from the sidebar, or switch to Quick Notes to edit text files stored in OneDrive.
              </p>
            </div>
            {notebooks.length > 0 && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-white font-medium transition-colors hover:brightness-110"
                style={{ background: '#7b2d8e' }}
                onClick={() => {
                  const first = notebooks[0];
                  setExpandedNotebooks(new Set([first.name]));
                  if (first.sections.length > 0) {
                    selectSection(first, first.sections[0]);
                  }
                }}
                data-testid="button-open-first-notebook"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Open {notebooks[0]?.name}
              </button>
            )}
          </div>
        )}
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

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <div className="text-[10px] text-white/20 mb-4 flex items-center gap-2">
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
