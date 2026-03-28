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
  X,
  BookOpen,
  ChevronRight,
  Trash2,
  NotebookPen,
  Link2,
  ExternalLink,
  Globe,
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

type SidebarTab = "notebooks" | "quicknotes";
type MainView = "embed" | "quicknote-editor" | "welcome";

function convertToEmbedUrl(url: string): string {
  if (url.includes('onedrive.live.com/embed')) return url;
  if (url.includes('iframe') && url.includes('src=')) {
    const match = url.match(/src="([^"]+)"/);
    if (match) return match[1];
  }

  if (url.includes('1drv.ms') || url.includes('onedrive.live.com') || url.includes('sharepoint.com')) {
    const encoded = btoa(url)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/embed`;
  }

  return url;
}

export default function OneNotePage() {
  const { toast } = useToast();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("notebooks");
  const [mainView, setMainView] = useState<MainView>("welcome");
  const [selectedLink, setSelectedLink] = useState<SharedNotebookLink | null>(null);
  const [selectedQuickNote, setSelectedQuickNote] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [embedError, setEmbedError] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sharedLinksQuery = useQuery<SharedNotebookLink[]>({
    queryKey: ["/api/shared-notebook-links"],
    staleTime: 60000,
  });

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-notebook-links"] });
      setIsAddingLink(false);
      setNewLinkName('');
      setNewLinkUrl('');
      toast({ title: "Notebook link added" });
      if (data?.id) {
        setSelectedLink(data);
        setMainView('embed');
        setEmbedError(false);
      }
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
      if (selectedLink?.id === deletedId) {
        setSelectedLink(null);
        setMainView('welcome');
      }
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

  useEffect(() => {
    if (sharedLinksQuery.data && sharedLinksQuery.data.length > 0 && mainView === 'welcome' && !selectedLink) {
      setSelectedLink(sharedLinksQuery.data[0]);
      setMainView('embed');
    }
  }, [sharedLinksQuery.data]);

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

  function selectNotebook(link: SharedNotebookLink) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedLink(link);
    setSelectedQuickNote(null);
    setMainView('embed');
    setEmbedError(false);
  }

  function selectQuickNote(file: QuickNoteFile) {
    if (isDirty && selectedQuickNote) saveNow();
    setSelectedQuickNote(file);
    setSelectedLink(null);
    setMainView('quicknote-editor');
  }

  const sharedLinks = sharedLinksQuery.data || [];
  const quickNoteFiles = filesQuery.data || [];

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
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Shared Notebooks</span>
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

              {sharedLinksQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                </div>
              ) : sharedLinks.length === 0 && !isAddingLink ? (
                <div className="text-center py-6 px-2">
                  <Link2 className="h-5 w-5 mx-auto mb-2 text-white/15" />
                  <p className="text-[11px] text-white/25">No notebooks yet</p>
                  <p className="text-[10px] text-white/15 mt-1">Click + to add a OneDrive sharing link</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sharedLinks.map(link => (
                    <div
                      key={link.id}
                      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                        selectedLink?.id === link.id && mainView === 'embed'
                          ? 'bg-white/10'
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => selectNotebook(link)}
                      data-testid={`notebook-link-${link.id}`}
                    >
                      <div className="h-7 w-7 rounded flex items-center justify-center shrink-0" style={{ background: selectedLink?.id === link.id ? '#7b2d8e' : '#3e3e42' }}>
                        <BookOpen className="h-3.5 w-3.5 text-white/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/80 truncate">{link.name}</div>
                        <div className="text-[10px] text-white/25 truncate">{link.url.substring(0, 40)}...</div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={link.url}
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
        {mainView === 'embed' && selectedLink && (
          <>
            <div className="h-10 flex items-center px-4 gap-3 shrink-0" style={{ background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
              <BookOpen className="h-3.5 w-3.5" style={{ color: '#7b2d8e' }} />
              <span className="text-xs font-medium text-white/80 truncate">{selectedLink.name}</span>
              <div className="flex-1" />
              <a
                href={selectedLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                data-testid="button-open-in-browser"
              >
                <ExternalLink className="h-3 w-3" />
                Open in browser
              </a>
            </div>
            <div className="flex-1 relative">
              {!embedError ? (
                <iframe
                  key={selectedLink.id}
                  src={convertToEmbedUrl(selectedLink.url)}
                  className="w-full h-full border-0"
                  style={{ background: '#fff' }}
                  allow="fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  onError={() => setEmbedError(true)}
                  data-testid="iframe-notebook"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
                  <Globe className="h-12 w-12 text-white/15" />
                  <div className="text-center">
                    <p className="text-sm text-white/50 mb-1">This notebook can't be embedded directly</p>
                    <p className="text-xs text-white/25 max-w-md">
                      Some OneDrive links don't allow iframe embedding. You can open it directly in your browser instead.
                    </p>
                  </div>
                  <a
                    href={selectedLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors hover:brightness-110"
                    style={{ background: '#7b2d8e' }}
                    data-testid="button-open-fallback"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Browser
                  </a>
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
                Add a notebook by clicking the + button in the sidebar. Paste a OneDrive sharing link to embed your OneNote notebook right here.
              </p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-white font-medium transition-colors hover:brightness-110"
              style={{ background: '#7b2d8e' }}
              onClick={() => { setSidebarTab('notebooks'); setIsAddingLink(true); }}
              data-testid="button-add-first-notebook"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Notebook Link
            </button>
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
