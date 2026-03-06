import { useState, useEffect, useCallback, useRef } from "react";
import { X, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

interface PostItTask {
  id: string;
  text: string;
  checked: boolean;
  status: "active" | "answer-later" | "retry";
  retrySentAt?: number;
}

interface ConfirmDialog {
  taskId: string;
  taskText: string;
}

const STORAGE_KEY = "dev-post-it-tasks";
const POS_KEY = "dev-post-it-pos";
const COLLAPSED_KEY = "dev-post-it-collapsed";
const DISMISSED_KEY = "dev-post-it-dismissed";

export function DevPostIt() {
  const [tasks, setTasks] = useState<PostItTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
      return [
        { id: "1", text: "Top pill buttons overflow right edge", checked: false, status: "active" as const },
        { id: "2", text: "Files home button from bottom tab", checked: false, status: "active" as const },
        { id: "3", text: "CPPA122 tasks still in DB (countdown shows Local Politics)", checked: false, status: "active" as const },
        { id: "4", text: "PDF icon shows for pasted links", checked: false, status: "active" as const },
      ];
    } catch { return []; }
  });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(POS_KEY);
      return saved ? JSON.parse(saved) : { x: 20, y: 120 };
    } catch { return { x: 20, y: 120 }; }
  });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setDragging(true);
    setDragOffset({ x: clientX - pos.x, y: clientY - pos.y });
  }, [pos]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleDragStart]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        setPos({ x: e.touches[0].clientX - dragOffset.x, y: e.touches[0].clientY - dragOffset.y });
      }
    };
    const handleEnd = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [dragging, dragOffset]);

  const addTask = useCallback((text: string) => {
    setTasks(prev => [...prev, { id: Date.now().toString(), text, checked: false, status: "active" }]);
  }, []);

  const getDismissed = (): string[] => {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
  };
  const addDismissed = (text: string) => {
    const list = getDismissed();
    if (!list.includes(text)) {
      list.push(text);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(list));
    }
  };

  const dialogShownRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    const poll = async () => {
      try {
        const res = await fetch(`/dev-tasks.json?t=${Date.now()}`);
        if (!res.ok) return;
        const incoming: { id: string; text: string; complete?: boolean }[] = await res.json();
        const dismissed = getDismissed();
        setTasks(prev => {
          const existingTexts = new Set(prev.map(t => t.text));
          const newOnes = incoming
            .filter(t => !t.complete && !existingTexts.has(t.text))
            .map(t => ({ id: t.id || Date.now().toString(), text: t.text, checked: false, status: "active" as const }));

          const completedTexts = incoming.filter(t => t.complete).map(t => t.text);
          const toPrompt = prev.filter(t => completedTexts.includes(t.text) && !dismissed.includes(t.text));
          if (toPrompt.length > 0 && !dialogShownRef.current) {
            dialogShownRef.current = true;
            setConfirmDialog({ taskId: toPrompt[0].id, taskText: toPrompt[0].text });
          }

          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes];
        });
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckChange = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.checked) {
      setConfirmDialog({ taskId, taskText: task.text });
    }
  }, [tasks]);

  const handleConfirmResponse = useCallback((response: "yes" | "no" | "answer-later") => {
    if (!confirmDialog) return;
    const taskId = confirmDialog.taskId;
    const taskText = confirmDialog.taskText;
    addDismissed(taskText);
    if (response === "yes") {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } else if (response === "no") {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, checked: false, status: "retry", retrySentAt: Date.now() } : t));
      fetch("/api/dev-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, text: taskText, reason: "not-completed" }),
      }).catch(() => {});
      setTimeout(() => {
        setTasks(prev => prev.map(t => t.id === taskId && t.status === "retry" ? { ...t, retrySentAt: undefined } : t));
      }, 2000);
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "answer-later" } : t));
    }
    setConfirmDialog(null);
    dialogShownRef.current = false;
  }, [confirmDialog]);

  const handleRetry = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "retry", retrySentAt: Date.now() } : t));
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      fetch("/api/dev-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, text: task.text }),
      }).catch(() => {});
    }
    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === taskId && t.status === "retry" ? { ...t, retrySentAt: undefined } : t));
    }, 2000);
  }, [tasks]);

  useEffect(() => {
    (window as any).__devPostItAddTask = addTask;
    return () => { delete (window as any).__devPostItAddTask; };
  }, [addTask]);

  if (import.meta.env.PROD) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          zIndex: 99999,
          width: collapsed ? "180px" : "260px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          userSelect: "none",
        }}
        data-testid="dev-post-it"
      >
        <div
          style={{
            background: "#fef08a",
            borderRadius: "2px",
            boxShadow: "2px 3px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10)",
            padding: collapsed ? "8px 12px" : "10px 14px 14px",
            transform: "rotate(-1.2deg)",
            border: "1px solid #fde047",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "grab", marginBottom: collapsed ? 0 : "6px", touchAction: "none" }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <GripVertical className="h-3 w-3 text-yellow-700/40" />
            <span style={{ fontWeight: 600, fontSize: "12px", color: "#92400e", flex: 1 }}>Dev Tasks</span>
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}
              data-testid="button-toggle-postit"
            >
              {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-yellow-700/60" /> : <ChevronUp className="h-3.5 w-3.5 text-yellow-700/60" />}
            </button>
          </div>
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {tasks.length === 0 && (
                <div style={{ fontSize: "11px", color: "#a16207", fontStyle: "italic", padding: "4px 0" }}>No tasks yet</div>
              )}
              {tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "5px",
                    padding: "3px 0",
                    borderBottom: "1px dashed rgba(146,64,14,0.15)",
                    opacity: task.status === "answer-later" ? 0.55 : 1,
                    background: task.status === "retry" ? "rgba(239,68,68,0.08)" : "transparent",
                  }}
                  data-testid={`postit-task-${task.id}`}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => handleCheckChange(task.id)}
                    style={{ marginTop: "3px", accentColor: "#92400e", cursor: "pointer", flexShrink: 0 }}
                    data-testid={`postit-checkbox-${task.id}`}
                  />
                  <span style={{
                    fontSize: "11px",
                    color: task.status === "retry" ? "#dc2626" : "#78350f",
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                    flex: 1,
                    fontWeight: task.status === "retry" ? 600 : 400,
                  }}>
                    {task.text}
                    {task.status === "answer-later" && (
                      <span style={{ fontSize: "10px", color: "#b45309", marginLeft: "4px" }}>(later)</span>
                    )}
                    {task.status === "retry" && (
                      <span style={{ fontSize: "10px", color: "#dc2626", marginLeft: "4px" }}>(retrying...)</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRetry(task.id)}
                    style={{
                      background: task.retrySentAt
                        ? "linear-gradient(180deg, #22c55e 0%, #15803d 100%)"
                        : "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
                      border: task.retrySentAt ? "1px solid #166534" : "1px solid #991b1b",
                      borderRadius: "10px",
                      color: "white",
                      fontSize: "8px",
                      fontWeight: 700,
                      fontFamily: "system-ui, sans-serif",
                      padding: "2px 6px",
                      cursor: task.retrySentAt ? "default" : "pointer",
                      flexShrink: 0,
                      marginTop: "1px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
                      letterSpacing: "0.3px",
                      lineHeight: "1.4",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s ease",
                    }}
                    disabled={!!task.retrySentAt}
                    data-testid={`postit-retry-${task.id}`}
                    title="Ask agent to try again"
                  >
                    {task.retrySentAt ? "✓ Sent!" : "Try Again"}
                  </button>
                  <button
                    onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px", flexShrink: 0, marginTop: "1px" }}
                    data-testid={`postit-delete-${task.id}`}
                  >
                    <X className="h-3 w-3 text-yellow-700/40 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}
          data-testid="postit-confirm-dialog"
        >
          <div style={{
            background: "#fef9c3",
            borderRadius: "8px",
            padding: "20px 24px",
            maxWidth: "340px",
            width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            border: "2px solid #fde047",
          }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#92400e", marginBottom: "8px" }}>Task Complete?</div>
            <div style={{ fontSize: "14px", color: "#78350f", marginBottom: "16px", lineHeight: 1.4 }}>
              "{confirmDialog.taskText}"
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => handleConfirmResponse("yes")}
                style={{ padding: "6px 16px", borderRadius: "6px", border: "none", background: "#16a34a", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                data-testid="postit-confirm-yes"
              >
                Yes
              </button>
              <button
                onClick={() => handleConfirmResponse("no")}
                style={{ padding: "6px 16px", borderRadius: "6px", border: "1px solid #d97706", background: "white", color: "#92400e", fontWeight: 700, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                data-testid="postit-confirm-no"
              >
                No
              </button>
              <button
                onClick={() => handleConfirmResponse("answer-later")}
                style={{ padding: "6px 16px", borderRadius: "6px", border: "1px solid #d97706", background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                data-testid="postit-confirm-later"
              >
                Answer Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
