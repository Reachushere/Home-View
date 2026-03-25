import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Loader2,
  Home,
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
  RefreshCw,
  Palette,
  Bell,
  Paperclip,
  Link2,
  Mail,
  Smartphone,
  Volume2,
  List,
  Trash2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface QuickNoteFile {
  id: string;
  name: string;
  type: string;
  size?: number;
  lastModified?: string;
  path: string;
}

interface NoteMeta {
  color?: string;
  reminderTime?: string | null;
  reminderAlarm?: boolean;
  reminderEmail?: boolean;
  reminderPush?: boolean;
  linkedTaskId?: number | null;
  linkedProjectId?: number | null;
}

type View = 'home' | 'notebooks' | 'editor' | 'search';

const NOTE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  default: { bg: 'transparent', border: 'rgba(255,255,255,0.1)', label: 'Default' },
  yellow: { bg: 'rgba(255,250,205,0.08)', border: 'rgba(230,210,0,0.3)', label: 'Yellow' },
  pink: { bg: 'rgba(255,182,193,0.08)', border: 'rgba(255,105,180,0.3)', label: 'Pink' },
  blue: { bg: 'rgba(135,206,235,0.08)', border: 'rgba(77,166,255,0.3)', label: 'Blue' },
  green: { bg: 'rgba(152,251,152,0.08)', border: 'rgba(50,205,50,0.3)', label: 'Green' },
  orange: { bg: 'rgba(255,204,153,0.08)', border: 'rgba(255,140,0,0.3)', label: 'Orange' },
  purple: { bg: 'rgba(221,160,221,0.08)', border: 'rgba(147,112,219,0.3)', label: 'Purple' },
};

const COURSE_COLORS = [
  { color: '#4ade80', label: 'CPPA122' },
  { color: '#f472b6', label: 'CFNF400' },
  { color: '#818cf8', label: 'CASL101' },
];

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

function getNoteMeta(fileId: string): NoteMeta {
  try {
    const stored = localStorage.getItem(`quicknote-meta-${fileId}`);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function setNoteMeta(fileId: string, meta: NoteMeta) {
  localStorage.setItem(`quicknote-meta-${fileId}`, JSON.stringify(meta));
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
  const [noteMeta, setNoteMetaState] = useState<NoteMeta>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedFile?.id, "content"],
    enabled: !!selectedFile && view === 'editor',
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const tasksQuery = useQuery<Array<{ id: number; title: string; courseName?: string }>>({
    queryKey: ["/api/tasks"],
    staleTime: 30000,
  });

  const projectsQuery = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/projects"],
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      console.log('[QuickNotes] Saving to OneDrive...', content.length, 'chars');
      const res = await apiRequest('PUT', `/api/quicknotes/file/${id}/content`, { content });
      return res.json();
    },
    onSuccess: (data, variables) => {
      console.log('[QuickNotes] Save SUCCESS:', data);
      setIsDirty(false);
      queryClient.setQueryData(["/api/quicknotes/file", variables.id, "content"], { content: variables.content });
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      toast({ title: "Saved to OneDrive", description: `Last saved: ${new Date().toLocaleTimeString()}` });
    },
    onError: (err: any) => {
      console.error('[QuickNotes] Save FAILED:', err);
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

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest('PATCH', `/api/quicknotes/file/${id}/rename`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
    },
    onError: (err: any) => {
      toast({ title: "Rename failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRename = useCallback((newName: string) => {
    if (selectedFile) {
      renameMutation.mutate({ id: selectedFile.id, name: newName });
    }
  }, [selectedFile]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/quicknotes/file/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setSelectedFile(null);
      setView('home');
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
    if (selectedFile) {
      setNoteMetaState(getNoteMeta(selectedFile.id));
    }
  }, [selectedFile?.id]);

  const updateMeta = useCallback((updates: Partial<NoteMeta>) => {
    if (!selectedFile) return;
    const newMeta = { ...noteMeta, ...updates };
    setNoteMetaState(newMeta);
    setNoteMeta(selectedFile.id, newMeta);
  }, [selectedFile, noteMeta]);

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

  const toggleBullets = useCallback(() => {
    const lines = editorContent.split('\n');
    const hasBullets = lines.some(line => line.trimStart().startsWith('\u25CF ') || line.trimStart().startsWith('\u2022 '));
    let newContent: string;
    if (hasBullets) {
      newContent = lines.map(line => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('\u25CF ')) return line.replace(/\u25CF /, '');
        if (trimmed.startsWith('\u2022 ')) return line.replace(/\u2022 /, '');
        return line;
      }).join('\n');
    } else {
      newContent = lines.map(line => {
        if (line.trim() === '') return line;
        return '\u25CF ' + line;
      }).join('\n');
    }
    handleEditorChange(newContent);
  }, [editorContent, handleEditorChange]);

  const files = filesQuery.data || [];
  const recentFiles = [...files].sort((a, b) => {
    if (!a.lastModified || !b.lastModified) return 0;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  }).slice(0, 5);

  const filteredFiles = searchQuery.trim()
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  const tasks = tasksQuery.data || [];
  const projects = projectsQuery.data || [];

  const editorBg = noteMeta.color && noteMeta.color !== 'default' && NOTE_COLORS[noteMeta.color]
    ? NOTE_COLORS[noteMeta.color].bg
    : 'rgba(255,255,255,0.03)';
  const editorBorder = noteMeta.color && noteMeta.color !== 'default' && NOTE_COLORS[noteMeta.color]
    ? NOTE_COLORS[noteMeta.color].border
    : 'rgba(255,255,255,0.1)';

  const linkedTask = noteMeta.linkedTaskId ? tasks.find(t => t.id === noteMeta.linkedTaskId) : null;
  const linkedProject = noteMeta.linkedProjectId ? projects.find(p => p.id === noteMeta.linkedProjectId) : null;

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #4B2D7F 0%, #5C3D8F 25%, #6B4D9A 50%, #7B5EA7 75%, #8E72B5 100%)' }}>
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
            {view === 'editor' && (
              <>
                {/* Color Palette */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" title="Note color" data-testid="button-color-palette">
                      <Palette className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="p-2 bg-slate-900 border-white/15">
                    <DropdownMenuLabel className="text-[10px] text-white/50 py-1">Note Theme</DropdownMenuLabel>
                    <div className="flex gap-2 mb-2">
                      {Object.entries(NOTE_COLORS).map(([key, val]) => (
                        <button
                          key={key}
                          className={`h-5 w-5 rounded-full border hover:scale-110 transition-transform ${noteMeta.color === key ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                          style={{ backgroundColor: key === 'default' ? '#666' : val.border, borderColor: 'rgba(255,255,255,0.3)' }}
                          title={val.label}
                          onClick={() => updateMeta({ color: key })}
                        />
                      ))}
                    </div>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuLabel className="text-[10px] text-white/50 py-1">Course Colors</DropdownMenuLabel>
                    <div className="flex gap-2">
                      {COURSE_COLORS.map(cc => (
                        <button
                          key={cc.color}
                          className="h-5 w-5 rounded-full border border-white/30 hover:scale-110 transition-transform"
                          style={{ backgroundColor: cc.color }}
                          title={cc.label}
                          onClick={() => updateMeta({ color: cc.color })}
                        />
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Reminder Bell */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`h-8 w-8 ${noteMeta.reminderTime ? 'text-amber-400' : 'text-white/60'} hover:text-white hover:bg-white/10`} title="Reminder" data-testid="button-reminder">
                      <Bell className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 p-2 bg-slate-900 border-white/15">
                    <DropdownMenuLabel className="text-[10px] text-white/50 py-1">Reminder Settings</DropdownMenuLabel>
                    <div className="space-y-2 p-1">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-white/70">Reminder Time</Label>
                        <Input
                          type="datetime-local"
                          className="h-7 text-[10px] px-2 bg-white/5 border-white/15 text-white"
                          value={noteMeta.reminderTime ? format(new Date(noteMeta.reminderTime), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => updateMeta({ reminderTime: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        />
                      </div>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="h-3.5 w-3.5 text-white/60" />
                          <span className="text-[11px] text-white/70">Alarm</span>
                        </div>
                        <Checkbox
                          checked={noteMeta.reminderAlarm || false}
                          onCheckedChange={(checked) => updateMeta({ reminderAlarm: !!checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-white/60" />
                          <span className="text-[11px] text-white/70">Email</span>
                        </div>
                        <Checkbox
                          checked={noteMeta.reminderEmail || false}
                          onCheckedChange={(checked) => updateMeta({ reminderEmail: !!checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-white/60" />
                          <span className="text-[11px] text-white/70">Push</span>
                        </div>
                        <Checkbox
                          checked={noteMeta.reminderPush || false}
                          onCheckedChange={(checked) => updateMeta({ reminderPush: !!checked })}
                        />
                      </div>
                      {noteMeta.reminderTime && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => updateMeta({ reminderTime: null, reminderAlarm: false, reminderEmail: false, reminderPush: false })}
                        >
                          Clear Reminder
                        </Button>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Attach to Task/Project */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`h-8 w-8 ${(linkedTask || linkedProject) ? 'text-blue-400' : 'text-white/60'} hover:text-white hover:bg-white/10`} title="Attach to task or project" data-testid="button-attach">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto w-52 bg-slate-900 border-white/15">
                    {(linkedTask || linkedProject) && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] text-blue-400 flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          Linked to: {linkedTask?.title || linkedProject?.name}
                        </div>
                        <DropdownMenuSeparator className="bg-white/10" />
                      </>
                    )}
                    <DropdownMenuLabel className="text-[10px] text-white/50 py-1">Attach to Task</DropdownMenuLabel>
                    <DropdownMenuItem className="text-[10px] py-1 text-white/50" onClick={() => updateMeta({ linkedTaskId: null })}>
                      None
                    </DropdownMenuItem>
                    {tasks.slice(0, 20).map((task) => (
                      <DropdownMenuItem
                        key={task.id}
                        className={`text-[10px] py-1 truncate ${noteMeta.linkedTaskId === task.id ? 'text-blue-400 font-semibold' : 'text-white/80'}`}
                        onClick={() => updateMeta({ linkedTaskId: task.id, linkedProjectId: null })}
                      >
                        {task.title}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuLabel className="text-[10px] text-white/50 py-1">Attach to Project</DropdownMenuLabel>
                    <DropdownMenuItem className="text-[10px] py-1 text-white/50" onClick={() => updateMeta({ linkedProjectId: null })}>
                      None
                    </DropdownMenuItem>
                    {projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        className={`text-[10px] py-1 truncate ${noteMeta.linkedProjectId === project.id ? 'text-blue-400 font-semibold' : 'text-white/80'}`}
                        onClick={() => updateMeta({ linkedProjectId: project.id, linkedTaskId: null })}
                      >
                        {project.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Bullet Toggle */}
                <Button variant="ghost" size="icon" onClick={toggleBullets} className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" title="Toggle bullets" data-testid="button-bullets">
                  <List className="h-4 w-4" />
                </Button>

                {/* Save */}
                <Button variant="ghost" size="sm" onClick={saveNow} disabled={saveMutation.isPending || !isDirty} className={`h-8 gap-1 text-xs ${isDirty ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10' : 'text-white/40 hover:text-white/60 hover:bg-white/10'}`} data-testid="button-save">
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {saveMutation.isPending ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
                </Button>

                {/* Delete */}
                <Button variant="ghost" size="icon" onClick={() => { if (selectedFile && confirm('Delete this note from OneDrive?')) deleteMutation.mutate(selectedFile.id); }} className="h-8 w-8 text-white/60 hover:text-red-400 hover:bg-red-500/10" title="Delete note" data-testid="button-delete-note">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
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
        {view === 'editor' && (
          <EditorView
            content={editorContent}
            onChange={handleEditorChange}
            isLoading={contentQuery.isLoading && !contentQuery.data}
            file={selectedFile}
            isDirty={isDirty}
            isSaving={saveMutation.isPending}
            bgColor={editorBg}
            borderColor={editorBorder}
            linkedTask={linkedTask}
            linkedProject={linkedProject}
            onRename={handleRename}
          />
        )}
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
            <h2 className="text-sm font-medium text-white">Recent Notes</h2>
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

function EditorView({ content, onChange, isLoading, file, isDirty, isSaving, bgColor, borderColor, linkedTask, linkedProject, onRename }: {
  content: string;
  onChange: (val: string) => void;
  isLoading: boolean;
  file: QuickNoteFile | null;
  isDirty: boolean;
  isSaving: boolean;
  bgColor: string;
  borderColor: string;
  linkedTask?: { id: number; title: string } | null;
  linkedProject?: { id: number; name: string } | null;
  onRename: (name: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (file) {
      const name = file.name || '';
      const dotIdx = name.lastIndexOf('.');
      setTitle(dotIdx > 0 ? name.substring(0, dotIdx) : name);
    }
  }, [file?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(400, textareaRef.current.scrollHeight) + 'px';
    }
  }, [content]);

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val);
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      if (file && val.trim()) {
        const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.txt';
        onRename(val.trim() + ext);
      }
    }, 1500);
  }, [file, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const { selectionStart } = textarea;
      const text = textarea.value;
      const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = text.substring(lineStart, selectionStart);

      if (currentLine.trimStart().startsWith('\u25CF ') || currentLine.trimStart().startsWith('\u2022 ')) {
        const bulletChar = currentLine.trimStart().startsWith('\u25CF ') ? '\u25CF' : '\u2022';
        if (currentLine.trim() === bulletChar) {
          e.preventDefault();
          const before = text.substring(0, lineStart);
          const after = text.substring(selectionStart);
          onChange(before + after);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = lineStart; }, 0);
        } else {
          e.preventDefault();
          const before = text.substring(0, selectionStart);
          const after = text.substring(selectionStart);
          const newContent = before + '\n' + bulletChar + ' ' + after;
          onChange(newContent);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = selectionStart + 3; }, 0);
        }
      }
    }
  }, [onChange]);

  if (isLoading) return <LoadingState label="Loading note..." />;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-white/30">
        <Pencil className="h-3 w-3" />
        <span>Auto-saves to OneDrive</span>
        {(linkedTask || linkedProject) && (
          <span className="text-blue-400/60 flex items-center gap-1 ml-2">
            <Link2 className="h-3 w-3" />
            {linkedTask?.title || linkedProject?.name}
          </span>
        )}
        {isSaving && <span className="text-yellow-400/60 ml-auto flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving...</span>}
        {!isSaving && !isDirty && <span className="text-white ml-auto flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" />Synced</span>}
        {isDirty && !isSaving && <span className="text-orange-400/50 ml-auto">Unsaved changes</span>}
      </div>
      <Card className="border" style={{ backgroundColor: bgColor, borderColor: borderColor }}>
        <CardContent className="p-0">
          <input
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            className="w-full bg-transparent text-white text-xl font-semibold px-5 pt-5 pb-2 border-b border-white/10 focus:outline-none placeholder:text-white/20"
            placeholder="Note title..."
            spellCheck
            data-testid="input-note-title"
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
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
  const meta = getNoteMeta(file.id);
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
          {meta.reminderTime && <Bell className="h-2.5 w-2.5 text-amber-400/60" />}
          {(meta.linkedTaskId || meta.linkedProjectId) && <Link2 className="h-2.5 w-2.5 text-blue-400/60" />}
        </div>
      </div>
      <Pencil className="h-3.5 w-3.5 text-white group-hover:text-white/80 transition-colors" />
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
