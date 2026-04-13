import { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle2, XCircle, Loader2, FileText, Image, Film, Music, File, Smartphone } from "lucide-react";

interface UploadedFile {
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "svg", "bmp"].includes(ext))
    return <Image size={20} className="text-blue-400" />;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
    return <Film size={20} className="text-purple-400" />;
  if (["mp3", "wav", "aac", "m4a", "ogg", "flac"].includes(ext))
    return <Music size={20} className="text-pink-400" />;
  if (["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "ppt", "pptx", "csv"].includes(ext))
    return <FileText size={20} className="text-orange-400" />;
  return <File size={20} className="text-gray-400" />;
}

export default function MobileUploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: globalThis.File) => {
    const entry: UploadedFile = { name: file.name, size: file.size, status: "uploading", progress: 0 };
    setFiles(prev => [entry, ...prev]);

    try {
      const resp = await fetch("/api/uploads/direct", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name),
          "x-upload-folder": "quick-share",
        },
        body: file,
      });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      setFiles(prev =>
        prev.map(f => (f.name === file.name && f.status === "uploading" ? { ...f, status: "done", progress: 100 } : f))
      );
    } catch (err: any) {
      setFiles(prev =>
        prev.map(f =>
          f.name === file.name && f.status === "uploading"
            ? { ...f, status: "error", error: err.message }
            : f
        )
      );
    }
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      Array.from(fileList).forEach(f => uploadFile(f));
    },
    [uploadFile]
  );

  const doneCount = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "0",
        display: "flex",
        flexDirection: "column",
      }}
      data-testid="mobile-upload-page"
    >
      <div style={{ padding: "20px 20px 12px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <Smartphone size={22} className="text-blue-400" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Quick Share</h1>
        </div>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          Send files from your phone to UniCal instantly
        </p>
      </div>

      <div
        style={{
          margin: "0 16px 16px",
          border: isDragging ? "2px dashed #3b82f6" : "2px dashed #334155",
          borderRadius: 16,
          padding: "32px 20px",
          textAlign: "center",
          backgroundColor: isDragging ? "rgba(59,130,246,0.1)" : "rgba(30,41,59,0.6)",
          transition: "all 0.2s",
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        data-testid="upload-drop-zone"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
          data-testid="file-input"
        />
        <Upload size={40} style={{ color: "#3b82f6", marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
          Tap to select files
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Photos, documents, videos, anything
        </div>
      </div>

      {files.length > 0 && (
        <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, fontSize: 12, color: "#94a3b8" }}>
          {doneCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={14} className="text-green-400" /> {doneCount} sent
            </span>
          )}
          {uploadingCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Loader2 size={14} className="animate-spin text-blue-400" /> {uploadingCount} sending
            </span>
          )}
          {errorCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <XCircle size={14} className="text-red-400" /> {errorCount} failed
            </span>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 100px" }}>
        {files.map((f, i) => (
          <div
            key={`${f.name}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 8,
              backgroundColor: "rgba(30,41,59,0.8)",
              borderRadius: 12,
              border: f.status === "error" ? "1px solid #ef4444" : "1px solid #1e293b",
            }}
            data-testid={`upload-item-${i}`}
          >
            {getFileIcon(f.name)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {decodeURIComponent(f.name)}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {formatSize(f.size)}
                {f.status === "error" && (
                  <span style={{ color: "#ef4444", marginLeft: 8 }}>{f.error}</span>
                )}
              </div>
            </div>
            <div>
              {f.status === "uploading" && <Loader2 size={18} className="animate-spin text-blue-400" />}
              {f.status === "done" && <CheckCircle2 size={18} className="text-green-400" />}
              {f.status === "error" && <XCircle size={18} className="text-red-400" />}
            </div>
          </div>
        ))}

        {files.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569" }}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>No files sent yet</p>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.8 }}>
              <strong style={{ color: "#64748b" }}>iOS Shortcut tip:</strong><br />
              Create a Shortcut that POSTs to<br />
              <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
                http://172.24.1.204:5000/api/uploads/direct
              </code><br />
              to share files directly from the Share Sheet
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
