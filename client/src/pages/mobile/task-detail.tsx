import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Trash2, X, Pencil, Save } from "lucide-react";
import type { TaskItem, CoursesData } from "./types";

interface DegreeTrackingData {
  coursesData?: CoursesData;
  [key: string]: unknown;
}

export function TaskDetailPopup({ task, onClose }: { task: TaskItem; onClose: () => void }) {
  const { toast } = useToast();
  const [toggling, setToggling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editCourseName, setEditCourseName] = useState(task.courseName || '');
  const [editDueDate, setEditDueDate] = useState(() => {
    if (!task.dueDate) return '';
    const d = new Date(task.dueDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [editDueTime, setEditDueTime] = useState(() => {
    if (!task.dueDate) return '18:00';
    const d = new Date(task.dueDate);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [editType, setEditType] = useState(task.type || 'assignment');
  const [saving, setSaving] = useState(false);

  const { data: degreeData } = useQuery<DegreeTrackingData>({
    queryKey: ["/api/degree-tracking"],
    staleTime: 60000,
  });
  const courses = degreeData?.coursesData?.courses || [];

  const handleToggleComplete = async () => {
    setToggling(true);
    try {
      await apiRequest('PATCH', `/api/tasks/${task.id}`, { isCompleted: !task.isCompleted });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: task.isCompleted ? "Task reopened" : "Task completed" });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/tasks/${task.id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task deleted" });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        title: editTitle.trim(),
        courseName: editCourseName || undefined,
        type: editType,
      };
      if (editDueDate) {
        updates.dueDate = `${editDueDate}T${editDueTime}:00`;
      }
      await apiRequest('PATCH', `/api/tasks/${task.id}`, updates);
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task updated" });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', fontSize: '12px', fontFamily: "system-ui, -apple-system, sans-serif",
    outline: 'none',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="mobile-app-task-detail"
    >
      <div style={{
        width: '88vw', maxWidth: '360px',
        background: 'linear-gradient(180deg, #2a5a8a 0%, #164a72 100%)',
        border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)', overflow: 'hidden',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(5,23,41,0.8) 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", flex: 1, marginRight: '8px' }}>
            {isEditing ? 'Edit Task' : task.title}
          </span>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }} data-testid="mobile-app-task-edit-btn">
                <Pencil style={{ width: 14, height: 14 }} />
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }} data-testid="mobile-app-task-detail-close">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {isEditing ? (
          <>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Title</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} data-testid="mobile-app-task-edit-title" />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Course</label>
                <select value={editCourseName} onChange={(e) => setEditCourseName(e.target.value)} style={{ ...inputStyle, appearance: 'auto' as const }} data-testid="mobile-app-task-edit-course">
                  <option value="" style={{ background: '#1a3a5c' }}>No course</option>
                  {courses.map((c) => (
                    <option key={c.name} value={c.name} style={{ background: '#1a3a5c' }}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Date</label>
                  <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} style={inputStyle} data-testid="mobile-app-task-edit-date" />
                </div>
                <div style={{ width: '90px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Time</label>
                  <input type="time" value={editDueTime} onChange={(e) => setEditDueTime(e.target.value)} style={inputStyle} data-testid="mobile-app-task-edit-time" />
                </div>
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Type</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value)} style={{ ...inputStyle, appearance: 'auto' as const }} data-testid="mobile-app-task-edit-type">
                  {['assignment', 'quiz', 'exam', 'lab', 'project', 'reading', 'discussion', 'other'].map(t => (
                    <option key={t} value={t} style={{ background: '#1a3a5c' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                data-testid="mobile-app-task-edit-cancel"
              >Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editTitle.trim()}
                style={{
                  flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
                  background: 'rgba(59,130,246,0.4)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
                data-testid="mobile-app-task-edit-save"
              >
                <Save style={{ width: 14, height: 14 }} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {task.courseName && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                  <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Course:</strong> {task.courseName}
                </div>
              )}
              {dueDate && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                  <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Due:</strong> {dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              )}
              {task.type && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                  <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Type:</strong> {task.type}
                </div>
              )}
              <div style={{ color: task.isCompleted ? '#86efac' : '#fbbf24', fontSize: '12px', fontWeight: 600 }}>
                {task.isCompleted ? '✓ Completed' : '○ Pending'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={handleToggleComplete}
                disabled={toggling}
                style={{
                  flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)',
                  background: task.isCompleted ? 'rgba(251,191,36,0.2)' : 'rgba(134,239,172,0.2)',
                  color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
                data-testid="mobile-app-task-toggle-complete"
              >
                <Check style={{ width: 14, height: 14 }} />
                {task.isCompleted ? 'Reopen' : 'Complete'}
              </button>
              <button
                onClick={handleDelete}
                style={{
                  height: '36px', width: '36px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
                data-testid="mobile-app-task-delete"
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
