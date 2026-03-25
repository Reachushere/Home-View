import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  ArrowLeft,
  Trash2,
  Loader2,
  FileText,
  RefreshCw,
  Check,
  Pencil,
  BookOpen,
  StickyNote,
  ChevronRight,
} from "lucide-react";

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

type Tab = "quicknotes" | "notebooks";
type View = "list" | "editor" | "notebook-sections" | "notebook-pages" | "onenote-page";

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

export default function MobileNotesPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("quicknotes");
  const [view, setView] = useState<View>("list");
  const [selectedFile, setSelectedFile] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedNotebook, setSelectedNotebook] = useState<OneNoteNotebook | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ name: string; id: string } | null>(null);
  const [selectedOneNotePage, setSelectedOneNotePage] = useState<OneNotePage | null>(null);

  const filesQuery = useQuery<QuickNoteFile[]>({
    queryKey: ["/api/quicknotes/files"],
    staleTime: 15000,
  });

  const contentQuery = useQuery<{ content: string }>({
    queryKey: ["/api/quicknotes/file", selectedFile?.id, "content"],
    enabled: !!selectedFile,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const notebooksQuery = useQuery<OneNoteNotebook[]>({
    queryKey: ["/api/onenote/notebooks"],
    enabled: tab === "notebooks",
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
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json();
    },
  });

  useEffect(() => {
    if (contentQuery.data?.content !== undefined && !isDirty) {
      setEditorContent(contentQuery.data.content);
    }
  }, [contentQuery.data]);

  useEffect(() => {
    if (selectedFile) {
      setEditingTitle(selectedFile.name.replace(/\.txt$/i, ""));
    }
  }, [selectedFile]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("PUT", `/api/quicknotes/file/${id}/content`, { content });
      return res.json();
    },
    onSuccess: (_, variables) => {
      setIsDirty(false);
      queryClient.setQueryData(
        ["/api/quicknotes/file", variables.id, "content"],
        { content: variables.content }
      );
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/quicknotes/file/${id}/rename`, { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      if (selectedFile && data.file) {
        setSelectedFile(data.file);
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const res = await apiRequest("POST", "/api/quicknotes/files", { name, content });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setIsCreating(false);
      setNewNoteName("");
      if (data.file) {
        setSelectedFile(data.file);
        setEditorContent("");
        setIsDirty(false);
        setView("editor");
      }
      toast({ title: "Note created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/quicknotes/file/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quicknotes/files"] });
      setSelectedFile(null);
      setConfirmDelete(null);
      setView("list");
      toast({ title: "Note deleted" });
    },
  });

  const handleContentChange = (value: string) => {
    setEditorContent(value);
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (selectedFile) {
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate({ id: selectedFile.id, content: value });
      }, 1500);
    }
  };

  const handleTitleBlur = () => {
    if (!selectedFile) return;
    const currentName = selectedFile.name.replace(/\.txt$/i, "");
    if (editingTitle.trim() && editingTitle.trim() !== currentName) {
      renameMutation.mutate({ id: selectedFile.id, name: editingTitle.trim() });
    }
  };

  const handleBack = () => {
    if (view === "editor") {
      if (isDirty && selectedFile) {
        saveMutation.mutate({ id: selectedFile.id, content: editorContent });
      }
      setSelectedFile(null);
      setIsDirty(false);
      setConfirmDelete(null);
      setView("list");
    } else if (view === "onenote-page") {
      setSelectedOneNotePage(null);
      setView("notebook-pages");
    } else if (view === "notebook-pages") {
      setSelectedSection(null);
      setView("notebook-sections");
    } else if (view === "notebook-sections") {
      setSelectedNotebook(null);
      setView("list");
    }
  };

  const files = filesQuery.data || [];
  const notebooks = notebooksQuery.data || [];

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    background: "#1a1a1a",
  };

  const backBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "#fff",
    padding: 8,
    cursor: "pointer",
  };

  if (view === "onenote-page" && selectedOneNotePage) {
    return (
      <div data-testid="mobile-onenote-page-view" style={{ minHeight: "100dvh", background: "#111", color: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <button data-testid="button-back" onClick={handleBack} style={backBtnStyle}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedOneNotePage.title}</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {selectedNotebook?.name} &rsaquo; {selectedSection?.name}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, color: "#e0e0e0" }}>
          {selectedOneNotePage.content || "(empty page)"}
        </div>
      </div>
    );
  }

  if (view === "notebook-pages" && selectedSection) {
    return (
      <div data-testid="mobile-onenote-pages" style={{ minHeight: "100dvh", background: "#111", color: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <button data-testid="button-back" onClick={handleBack} style={backBtnStyle}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedSection.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{selectedNotebook?.name}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#9b8ec4", padding: "12px 16px 4px", fontWeight: 500 }}>Pages</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {pagesQuery.isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <Loader2 size={28} className="animate-spin" style={{ color: "#888" }} />
            </div>
          ) : (pagesQuery.data || []).length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#888" }}>No pages found</div>
          ) : (
            (pagesQuery.data || []).map((page, idx) => (
              <button
                key={idx}
                data-testid={`onenote-page-${idx}`}
                onClick={() => { setSelectedOneNotePage(page); setView("onenote-page"); }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  color: "#fff",
                  padding: "14px 16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 500 }}>{page.title}</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {page.content.substring(0, 80) || "(empty)"}
                </div>
              </button>
            ))
          )}
        </div>
        <BottomTabs tab={tab} setTab={(t) => { setTab(t); setView("list"); setSelectedNotebook(null); setSelectedSection(null); }} />
      </div>
    );
  }

  if (view === "notebook-sections" && selectedNotebook) {
    return (
      <div data-testid="mobile-onenote-sections" style={{ minHeight: "100dvh", background: "#111", color: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <button data-testid="button-back" onClick={handleBack} style={backBtnStyle}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{selectedNotebook.name}</div>
        </div>
        <div style={{ fontSize: 13, color: "#9b8ec4", padding: "12px 16px 4px", fontWeight: 500 }}>Sections</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {selectedNotebook.sections.map((section) => (
            <button
              key={section.id}
              data-testid={`onenote-section-${section.id}`}
              onClick={() => { setSelectedSection(section); setView("notebook-pages"); }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                color: "#fff",
                padding: "14px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ width: 4, height: 28, borderRadius: 2, background: "#5b5fc7", flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 16, fontWeight: 500 }}>{section.name}</div>
              <ChevronRight size={18} style={{ color: "#666" }} />
            </button>
          ))}
        </div>
        <BottomTabs tab={tab} setTab={(t) => { setTab(t); setView("list"); setSelectedNotebook(null); }} />
      </div>
    );
  }

  if (view === "editor" && selectedFile) {
    return (
      <div data-testid="mobile-notes-editor" style={{ minHeight: "100dvh", background: "#111", color: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <button data-testid="button-back" onClick={handleBack} style={backBtnStyle}>
            <ArrowLeft size={22} />
          </button>
          <input
            data-testid="input-note-title"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleBlur}
            style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 18, fontWeight: 600, outline: "none" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" style={{ color: "#888" }} />
            ) : isDirty ? (
              <Pencil size={16} style={{ color: "#f59e0b" }} />
            ) : (
              <Check size={16} style={{ color: "#4ade80" }} />
            )}
            <button data-testid="button-delete-note" onClick={() => setConfirmDelete(selectedFile.id)} style={{ background: "none", border: "none", color: "#ef4444", padding: 8, cursor: "pointer" }}>
              <Trash2 size={20} />
            </button>
          </div>
        </div>
        {confirmDelete && (
          <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.15)", borderBottom: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "#fca5a5" }}>Delete this note?</span>
            <div style={{ display: "flex", gap: 12 }}>
              <button data-testid="button-cancel-delete" onClick={() => setConfirmDelete(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button data-testid="button-confirm-delete" onClick={() => deleteMutation.mutate(selectedFile.id)} style={{ background: "#ef4444", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, fontSize: 14, cursor: "pointer" }}>
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        )}
        {contentQuery.isLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={28} className="animate-spin" style={{ color: "#888" }} />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            data-testid="textarea-note-content"
            value={editorContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start typing..."
            style={{ flex: 1, background: "transparent", border: "none", color: "#e0e0e0", fontSize: 16, lineHeight: 1.6, padding: "16px", outline: "none", resize: "none", fontFamily: "inherit" }}
          />
        )}
      </div>
    );
  }

  return (
    <div data-testid="mobile-notes-list" style={{ minHeight: "100dvh", background: "#111", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "#1a1a1a" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {tab === "quicknotes" ? "QuickNotes" : "Notebooks"}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {tab === "quicknotes" && (
            <>
              <button
                data-testid="button-refresh-notes"
                onClick={() => filesQuery.refetch()}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <RefreshCw size={18} className={filesQuery.isFetching ? "animate-spin" : ""} />
              </button>
              <button
                data-testid="button-create-note"
                onClick={() => setIsCreating(true)}
                style={{ background: "#7c5cbf", border: "none", color: "#fff", width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Plus size={20} />
              </button>
            </>
          )}
          {tab === "notebooks" && (
            <button
              data-testid="button-refresh-notebooks"
              onClick={() => notebooksQuery.refetch()}
              style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <RefreshCw size={18} className={notebooksQuery.isFetching ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {isCreating && tab === "quicknotes" && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(124,92,191,0.08)" }}>
          <input
            data-testid="input-new-note-name"
            autoFocus
            value={newNoteName}
            onChange={(e) => setNewNoteName(e.target.value)}
            placeholder="Note name..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && newNoteName.trim()) createMutation.mutate({ name: newNoteName.trim(), content: "" });
              if (e.key === "Escape") { setIsCreating(false); setNewNoteName(""); }
            }}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#fff", fontSize: 16, padding: "10px 14px", outline: "none", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button data-testid="button-cancel-create" onClick={() => { setIsCreating(false); setNewNoteName(""); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#ccc", padding: "8px 16px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button
              data-testid="button-save-new-note"
              onClick={() => { if (newNoteName.trim()) createMutation.mutate({ name: newNoteName.trim(), content: "" }); }}
              disabled={!newNoteName.trim() || createMutation.isPending}
              style={{ background: "#7c5cbf", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 14, cursor: "pointer", opacity: !newNoteName.trim() ? 0.5 : 1 }}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "quicknotes" && (
          <>
            {filesQuery.isLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <Loader2 size={28} className="animate-spin" style={{ color: "#888" }} />
              </div>
            ) : files.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, color: "#888", gap: 12 }}>
                <FileText size={40} />
                <p style={{ fontSize: 16 }}>No notes yet</p>
                <button data-testid="button-create-first-note" onClick={() => setIsCreating(true)} style={{ background: "#7c5cbf", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 15, cursor: "pointer" }}>
                  Create your first note
                </button>
              </div>
            ) : (
              files.map((file) => (
                <button
                  key={file.id}
                  data-testid={`note-item-${file.id}`}
                  onClick={() => { setSelectedFile(file); setIsDirty(false); setView("editor"); }}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#fff", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <FileText size={20} style={{ color: "#888", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {file.name.replace(/\.txt$/i, "")}
                    </div>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                      {file.lastModified ? timeAgo(file.lastModified) : ""}
                      {file.size !== undefined && ` · ${file.size} bytes`}
                    </div>
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {tab === "notebooks" && (
          <>
            {notebooksQuery.isLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <Loader2 size={28} className="animate-spin" style={{ color: "#888" }} />
              </div>
            ) : notebooks.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
                <BookOpen size={40} style={{ margin: "0 auto 12px" }} />
                <p>No notebooks found</p>
              </div>
            ) : (
              notebooks.map((nb) => (
                <button
                  key={nb.path}
                  data-testid={`notebook-${nb.name}`}
                  onClick={() => { setSelectedNotebook(nb); setView("notebook-sections"); }}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#fff", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: "#7c5cbf", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BookOpen size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{nb.name}</div>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                      {nb.sections.length} section{nb.sections.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: "#666" }} />
                </button>
              ))
            )}
          </>
        )}
      </div>

      <BottomTabs tab={tab} setTab={(t) => { setTab(t); setView("list"); }} />
    </div>
  );
}

function BottomTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div
      style={{
        display: "flex",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        background: "#1a1a1a",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <button
        data-testid="tab-quicknotes"
        onClick={() => setTab("quicknotes")}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          color: tab === "quicknotes" ? "#9b8ec4" : "#666",
          padding: "10px 0",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <StickyNote size={20} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>QuickNotes</span>
      </button>
      <button
        data-testid="tab-notebooks"
        onClick={() => setTab("notebooks")}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          color: tab === "notebooks" ? "#9b8ec4" : "#666",
          padding: "10px 0",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <BookOpen size={20} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>Notebooks</span>
      </button>
    </div>
  );
}
