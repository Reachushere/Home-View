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
} from "lucide-react";

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

export default function MobileNotesPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<QuickNoteFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (isDirty && selectedFile) {
      saveMutation.mutate({ id: selectedFile.id, content: editorContent });
    }
    setSelectedFile(null);
    setIsDirty(false);
    setConfirmDelete(null);
  };

  const files = filesQuery.data || [];

  if (selectedFile) {
    return (
      <div
        data-testid="mobile-notes-editor"
        style={{
          minHeight: "100dvh",
          background: "#111",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "#1a1a1a",
          }}
        >
          <button
            data-testid="button-back"
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              padding: 8,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <input
            data-testid="input-note-title"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleBlur}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 18,
              fontWeight: 600,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" style={{ color: "#888" }} />
            ) : isDirty ? (
              <Pencil size={16} style={{ color: "#f59e0b" }} />
            ) : (
              <Check size={16} style={{ color: "#4ade80" }} />
            )}
            <button
              data-testid="button-delete-note"
              onClick={() => setConfirmDelete(selectedFile.id)}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                padding: 8,
                cursor: "pointer",
              }}
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(239,68,68,0.15)",
              borderBottom: "1px solid rgba(239,68,68,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 14, color: "#fca5a5" }}>Delete this note?</span>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                data-testid="button-cancel-delete"
                onClick={() => setConfirmDelete(null)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                data-testid="button-confirm-delete"
                onClick={() => deleteMutation.mutate(selectedFile.id)}
                style={{
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        )}

        {contentQuery.isLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Loader2 size={28} className="animate-spin" style={{ color: "#888" }} />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            data-testid="textarea-note-content"
            value={editorContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start typing..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#e0e0e0",
              fontSize: 16,
              lineHeight: 1.6,
              padding: "16px",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="mobile-notes-list"
      style={{
        minHeight: "100dvh",
        background: "#111",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "#1a1a1a",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>QuickNotes</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            data-testid="button-refresh-notes"
            onClick={() => filesQuery.refetch()}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "#fff",
              width: 40,
              height: 40,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={18} className={filesQuery.isFetching ? "animate-spin" : ""} />
          </button>
          <button
            data-testid="button-create-note"
            onClick={() => setIsCreating(true)}
            style={{
              background: "#3b82f6",
              border: "none",
              color: "#fff",
              width: 40,
              height: 40,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {isCreating && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(59,130,246,0.08)",
          }}
        >
          <input
            data-testid="input-new-note-name"
            autoFocus
            value={newNoteName}
            onChange={(e) => setNewNoteName(e.target.value)}
            placeholder="Note name..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && newNoteName.trim()) {
                createMutation.mutate({ name: newNoteName.trim(), content: "" });
              }
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewNoteName("");
              }
            }}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 16,
              padding: "10px 14px",
              outline: "none",
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              data-testid="button-cancel-create"
              onClick={() => {
                setIsCreating(false);
                setNewNoteName("");
              }}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#ccc",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              data-testid="button-save-new-note"
              onClick={() => {
                if (newNoteName.trim()) {
                  createMutation.mutate({ name: newNoteName.trim(), content: "" });
                }
              }}
              disabled={!newNoteName.trim() || createMutation.isPending}
              style={{
                background: "#3b82f6",
                border: "none",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
                opacity: !newNoteName.trim() ? 0.5 : 1,
              }}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {filesQuery.isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
            }}
          >
            <Loader2 size={28} className="animate-spin" style={{ color: "#888" }} />
          </div>
        ) : files.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 60,
              color: "#888",
              gap: 12,
            }}
          >
            <FileText size={40} />
            <p style={{ fontSize: 16 }}>No notes yet</p>
            <button
              data-testid="button-create-first-note"
              onClick={() => setIsCreating(true)}
              style={{
                background: "#3b82f6",
                border: "none",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: 10,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Create your first note
            </button>
          </div>
        ) : (
          files.map((file) => (
            <button
              key={file.id}
              data-testid={`note-item-${file.id}`}
              onClick={() => {
                setSelectedFile(file);
                setIsDirty(false);
              }}
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
              <FileText size={20} style={{ color: "#888", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
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
      </div>
    </div>
  );
}
