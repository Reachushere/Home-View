import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { NewSemesterChecklistItem } from "@shared/schema";
import { Plus, Minus, X, GripVertical, Calendar, Bell, Trash2, Settings, BellRing } from "lucide-react";
import { format } from "date-fns";

const REMINDER_PRESETS = [
  { value: 0, label: "None" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

interface Props {
  semesterKey: string;
  semesterLabel: string;
  colorSettings: {
    mainBackground: string;
    mainBackgroundGradientEnd: string;
    headerBar: string;
  };
  onDismiss: () => void;
  noBackdrop?: boolean;
  printerIconRight?: number;
}

export default function NewSemesterChecklist({ semesterKey, semesterLabel, colorSettings, onDismiss, noBackdrop, printerIconRight }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [jiggling, setJiggling] = useState(false);

  useEffect(() => {
    if (!minimized) return;
    const interval = setInterval(() => {
      setJiggling(true);
      setTimeout(() => setJiggling(false), 600);
    }, 8000);
    return () => clearInterval(interval);
  }, [minimized]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(() => {
    return localStorage.getItem(`newSemChecklist_dismissed_${semesterKey}`) === 'true';
  });
  const [newItemTitle, setNewItemTitle] = useState("");
  const [editingReminders, setEditingReminders] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [swipingId, setSwipingId] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartRef = useRef<{ x: number; id: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const qk = ["/api/new-semester-checklist", semesterKey];

  const { data: items = [] } = useQuery<NewSemesterChecklistItem[]>({
    queryKey: qk,
    queryFn: () => fetch(`/api/new-semester-checklist?semesterKey=${encodeURIComponent(semesterKey)}`, { credentials: 'include' }).then(r => r.json()),
  });

  const carryOverMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/new-semester-checklist/carry-over", { semesterKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const [carriedOver, setCarriedOver] = useState(false);
  useEffect(() => {
    if (!carriedOver && items.length === 0 && semesterKey) {
      const didCarry = localStorage.getItem(`newSemChecklist_carried_${semesterKey}`);
      if (!didCarry) {
        localStorage.setItem(`newSemChecklist_carried_${semesterKey}`, 'true');
        carryOverMutation.mutate();
        setCarriedOver(true);
      }
    }
  }, [items, semesterKey, carriedOver]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; sortOrder: number; semesterKey: string }) =>
      apiRequest("POST", "/api/new-semester-checklist", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PATCH", `/api/new-semester-checklist/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/new-semester-checklist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const activeItems = items.filter(i => !i.isDeleted);
  const sortedItems = [...activeItems].sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  const handleAddItem = useCallback(() => {
    const title = newItemTitle.trim();
    if (!title) return;
    const maxSort = activeItems.reduce((max, i) => Math.max(max, i.sortOrder ?? 0), 0);
    createMutation.mutate({ title, sortOrder: maxSort + 1, semesterKey });
    setNewItemTitle("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [newItemTitle, activeItems, semesterKey, createMutation]);

  const handleToggleComplete = useCallback((item: NewSemesterChecklistItem) => {
    updateMutation.mutate({
      id: item.id,
      isCompleted: !item.isCompleted,
      completedAt: !item.isCompleted ? new Date().toISOString() : null,
    });
  }, [updateMutation]);

  const handleDragStart = (id: number) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, id: number) => { e.preventDefault(); setDragOverId(id); };
  const handleDragEnd = () => {
    if (draggedId !== null && dragOverId !== null && draggedId !== dragOverId) {
      const uncompleted = sortedItems.filter(i => !i.isCompleted);
      const fromIdx = uncompleted.findIndex(i => i.id === draggedId);
      const toIdx = uncompleted.findIndex(i => i.id === dragOverId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const reordered = [...uncompleted];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        reordered.forEach((item, idx) => {
          if (item.sortOrder !== idx) {
            updateMutation.mutate({ id: item.id, sortOrder: idx });
          }
        });
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleTouchStart = (e: React.TouchEvent, id: number) => {
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, id };
    setSwipingId(id);
    setSwipeX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    setSwipeX(Math.min(0, dx));
  };

  const handleTouchEnd = () => {
    if (swipeStartRef.current && swipeX < -80) {
      deleteMutation.mutate(swipeStartRef.current.id);
    }
    swipeStartRef.current = null;
    setSwipingId(null);
    setSwipeX(0);
  };

  const handleDismissConfirm = () => {
    setShowDeleteConfirm(false);
    onDismiss();
  };

  const dialogBg = `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`;
  const headerBg = `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`;
  const headerBoxShadow = 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)';

  if (minimized) {
    if (noBackdrop) return null;
    return (
      <div
        className="fixed z-[10003] cursor-pointer"
        style={{
          bottom: '38px',
          right: printerIconRight != null ? `${printerIconRight + 22}px` : 'calc(50% + 55px)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        data-testid="semester-checklist-minimized"
      >
        <style>{`
          @keyframes checklist-jiggle {
            0% { transform: rotate(0deg); }
            15% { transform: rotate(-3deg); }
            30% { transform: rotate(3deg); }
            45% { transform: rotate(-2deg); }
            60% { transform: rotate(2deg); }
            75% { transform: rotate(-1deg); }
            100% { transform: rotate(0deg); }
          }
        `}</style>
        <div
          onClick={() => setMinimized(false)}
          style={{
            background: headerBg,
            borderRadius: '8px 8px 0 0',
            padding: '4px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid rgba(255,255,255,0.3)',
            borderBottom: 'none',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            boxShadow: headerBoxShadow,
            animation: jiggling ? 'checklist-jiggle 0.5s ease-in-out' : 'none',
            transformOrigin: 'center bottom',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
            New Semester Checklist
          </span>
          <span style={{
            fontSize: '8px',
            fontWeight: 700,
            color: '#fff',
            background: 'rgba(255,255,255,0.25)',
            borderRadius: '8px',
            padding: '1px 5px',
            minWidth: '16px',
            textAlign: 'center',
          }}>
            {activeItems.filter(i => !i.isCompleted).length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed z-[10004]"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          maxHeight: '80vh',
          background: dialogBg,
          borderRadius: '12px',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        data-testid="semester-checklist-popup"
      >
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: headerBg,
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          boxShadow: headerBoxShadow,
        }}>
          <Settings className="h-3 w-3 text-white" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: '12px',
              fontWeight: 400,
              color: '#fff',
              fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              letterSpacing: '0.3px',
              margin: 0,
            }}>
              NEW SEMESTER CHECKLIST
            </h2>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>
              {semesterLabel}
            </div>
          </div>
          {!noBackdrop && (
            <div
              onClick={() => setMinimized(true)}
              style={{
                width: '24px', height: '24px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
              data-testid="button-minimize-checklist"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5 text-white/70" />
            </div>
          )}
          <div
            onClick={() => noBackdrop ? onDismiss() : setShowDeleteConfirm(true)}
            style={{
              width: '24px', height: '24px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', background: noBackdrop ? 'rgba(255,255,255,0.1)' : 'rgba(255,80,80,0.15)',
              border: noBackdrop ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,80,80,0.3)',
            }}
            data-testid="button-dismiss-checklist"
            title={noBackdrop ? "Close" : "Dismiss"}
          >
            <X className={`w-3.5 h-3.5 ${noBackdrop ? 'text-white/70' : 'text-red-400'}`} />
          </div>
        </div>

        <div style={{
          padding: '10px 16px',
          display: 'flex',
          gap: '6px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
            placeholder="Add a checklist item..."
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', outline: 'none',
            }}
            data-testid="input-new-checklist-item"
          />
          <div
            onClick={handleAddItem}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: newItemTitle.trim() ? 'pointer' : 'default',
              background: newItemTitle.trim() ? 'rgba(60,130,200,0.5)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              opacity: newItemTitle.trim() ? 1 : 0.4,
            }}
            data-testid="button-add-checklist-item"
          >
            <Plus className="w-4 h-4 text-white" />
          </div>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          padding: '4px 0',
          maxHeight: 'calc(80vh - 140px)',
        }}>
          {sortedItems.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
              No items yet. Add something to prepare for the semester!
            </div>
          ) : (
            sortedItems.map((item) => (
              <div
                key={item.id}
                draggable={!item.isCompleted}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  padding: '6px 12px 6px 4px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '4px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: dragOverId === item.id ? 'rgba(60,130,200,0.15)' : 'transparent',
                  opacity: draggedId === item.id ? 0.4 : 1,
                  transform: swipingId === item.id ? `translateX(${swipeX}px)` : undefined,
                  transition: swipingId === item.id ? 'none' : 'transform 0.2s ease',
                  position: 'relative',
                }}
                data-testid={`checklist-item-${item.id}`}
              >
                {swipingId === item.id && swipeX < -40 && (
                  <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: `${Math.abs(swipeX)}px`,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.8) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    paddingRight: '12px',
                    borderRadius: '0 4px 4px 0',
                  }}>
                    <Trash2 className="w-4 h-4 text-white" />
                  </div>
                )}

                {!item.isCompleted && (
                  <div style={{
                    cursor: 'grab', display: 'flex', alignItems: 'center',
                    padding: '2px', marginTop: '2px', flexShrink: 0,
                  }}>
                    <GripVertical className="w-3 h-3 text-white/25" />
                  </div>
                )}
                {item.isCompleted && <div style={{ width: '16px', flexShrink: 0 }} />}

                <div
                  onClick={(e) => { e.stopPropagation(); handleToggleComplete(item); }}
                  style={{
                    width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, marginTop: '2px',
                    border: item.isCompleted ? '1.5px solid rgba(74,222,128,0.7)' : '1.5px solid rgba(255,255,255,0.4)',
                    background: item.isCompleted ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  data-testid={`checkbox-checklist-${item.id}`}
                >
                  {item.isCompleted && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 5 L4 7 L8 3" stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '11px', color: item.isCompleted ? 'rgba(255,255,255,0.35)' : '#fff',
                    textDecoration: item.isCompleted ? 'line-through' : 'none',
                    lineHeight: '1.4',
                  }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    {item.dueDate && (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(item.dueDate), 'MMM d')}
                      </span>
                    )}
                    {(item.reminder1 ?? 0) > 0 && (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Bell className="w-2.5 h-2.5" />
                        {REMINDER_PRESETS.find(r => r.value === item.reminder1)?.label || `${item.reminder1}m`}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginTop: '2px' }}>
                  <div
                    onClick={() => setEditingDate(editingDate === item.id ? null : item.id)}
                    style={{
                      width: '22px', height: '22px', borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', background: editingDate === item.id ? 'rgba(60,130,200,0.3)' : 'transparent',
                    }}
                    data-testid={`button-date-${item.id}`}
                    title="Set date"
                  >
                    <Calendar className="w-3 h-3 text-white/40" />
                  </div>
                  <div
                    onClick={() => setEditingReminders(editingReminders === item.id ? null : item.id)}
                    style={{
                      width: '22px', height: '22px', borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', background: editingReminders === item.id ? 'rgba(60,130,200,0.3)' : 'transparent',
                    }}
                    data-testid={`button-reminder-${item.id}`}
                    title="Set reminders"
                  >
                    <Bell className="w-3 h-3 text-white/40" />
                  </div>
                  <div
                    onClick={() => deleteMutation.mutate(item.id)}
                    style={{
                      width: '22px', height: '22px', borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    data-testid={`button-delete-checklist-${item.id}`}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-white/20 hover:text-red-400" />
                  </div>
                </div>

                {editingDate === item.id && (
                  <div style={{
                    position: 'absolute', top: '100%', right: '12px', zIndex: 10,
                    background: colorSettings.mainBackground, borderRadius: '8px', padding: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    <input
                      type="date"
                      value={item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateMutation.mutate({
                          id: item.id,
                          dueDate: val ? new Date(val + 'T12:00:00').toISOString() : null,
                        });
                        setEditingDate(null);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '11px',
                        colorScheme: 'dark',
                      }}
                      data-testid={`input-date-${item.id}`}
                    />
                    {item.dueDate && (
                      <div
                        onClick={() => {
                          updateMutation.mutate({ id: item.id, dueDate: null });
                          setEditingDate(null);
                        }}
                        style={{
                          fontSize: '9px', color: 'rgba(255,100,100,0.7)', cursor: 'pointer',
                          marginTop: '4px', textAlign: 'center',
                        }}
                      >
                        Clear date
                      </div>
                    )}
                  </div>
                )}

                {editingReminders === item.id && (
                  <div style={{
                    position: 'absolute', top: '100%', right: '12px', zIndex: 10,
                    background: colorSettings.mainBackground, borderRadius: '8px', padding: '10px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                    minWidth: '200px',
                  }}>
                    {[1, 2, 3, 4].map((n) => {
                      const key = `reminder${n}` as 'reminder1' | 'reminder2' | 'reminder3' | 'reminder4';
                      return (
                        <div key={n}>
                          <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '2px' }}>
                            Reminder {n}
                          </label>
                          <select
                            value={item[key] ?? 0}
                            onChange={(e) => {
                              updateMutation.mutate({ id: item.id, [key]: parseInt(e.target.value) });
                            }}
                            style={{
                              width: '100%', padding: '3px 4px', borderRadius: '4px', fontSize: '10px',
                              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                              color: '#fff', outline: 'none',
                            }}
                            data-testid={`select-reminder${n}-${item.id}`}
                          >
                            {REMINDER_PRESETS.map((r) => (
                              <option key={r.value} value={r.value} style={{ background: colorSettings.mainBackground }}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
            {activeItems.filter(i => i.isCompleted).length}/{activeItems.length} completed
          </span>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
            Swipe left to permanently delete
          </span>
        </div>

        {noBackdrop && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
            data-testid="toggle-checklist-popup"
          >
            <BellRing className="w-3 h-3" style={{ color: popupDismissed ? 'rgba(255,255,255,0.35)' : 'rgba(100,180,255,0.9)' }} />
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', flex: 1 }}>
              Auto-show popup
            </span>
            <div
              onClick={() => {
                const newVal = !popupDismissed;
                setPopupDismissed(newVal);
                if (newVal) {
                  localStorage.setItem(`newSemChecklist_dismissed_${semesterKey}`, 'true');
                  fetch('/api/new-semester-checklist/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ semesterKey }) }).catch(() => {});
                } else {
                  localStorage.removeItem(`newSemChecklist_dismissed_${semesterKey}`);
                  fetch('/api/new-semester-checklist/undismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ semesterKey }) }).catch(() => {});
                }
              }}
              style={{
                width: '32px', height: '16px', borderRadius: '8px',
                background: popupDismissed ? 'rgba(255,255,255,0.15)' : 'rgba(60,130,220,0.7)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                border: `1px solid ${popupDismissed ? 'rgba(255,255,255,0.2)' : 'rgba(60,130,220,0.9)'}`,
              }}
              data-testid="switch-checklist-popup"
            >
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#fff', position: 'absolute', top: '1px',
                left: popupDismissed ? '1px' : '17px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        )}
      </div>

      {!noBackdrop && (
        <div
          className="fixed inset-0 z-[10003]"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMinimized(true)}
        />
      )}

      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-[10005]" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div
            className="fixed z-[10006]"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '320px', background: dialogBg, borderRadius: '12px',
              border: '1.5px solid rgba(255,255,255,0.35)', padding: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
            data-testid="checklist-delete-confirm"
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Dismiss Checklist?
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
              This will dismiss the checklist for this semester. It will appear again for the next semester with your unchecked items.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <div
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '6px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                  color: '#fff', background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                data-testid="button-cancel-dismiss"
              >
                Cancel
              </div>
              <div
                onClick={handleDismissConfirm}
                style={{
                  padding: '6px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                  color: '#fff', background: 'rgba(239,68,68,0.6)', cursor: 'pointer',
                  border: '1px solid rgba(239,68,68,0.5)',
                }}
                data-testid="button-confirm-dismiss"
              >
                Dismiss
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
