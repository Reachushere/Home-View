import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { NewSemesterChecklistItem } from "@shared/schema";
import { Plus, X, Trash2, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface Props {
  semesterKey: string;
  semesterLabel: string;
  semesterStartDate?: string;
  colorSettings: {
    mainBackground: string;
    mainBackgroundGradientEnd: string;
    headerBar: string;
  };
  onDismiss: () => void;
  anchorRect?: DOMRect | null;
}

export default function NewSemesterChecklist({ semesterKey, semesterLabel, colorSettings, onDismiss, anchorRect, semesterStartDate }: Props) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [swipingId, setSwipingId] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [editingTitles, setEditingTitles] = useState<Record<number, string>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (semesterStartDate) {
      const d = new Date(semesterStartDate + 'T12:00:00');
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<NewSemesterChecklistItem[]>({
    queryKey: ['/api/new-semester-checklist', semesterKey],
    queryFn: async () => {
      const r = await fetch(`/api/new-semester-checklist?semesterKey=${semesterKey}`, { credentials: 'include' });
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; semesterKey: string; sortOrder: number; isGlobal?: boolean }) =>
      apiRequest('POST', '/api/new-semester-checklist', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/new-semester-checklist'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest('PATCH', `/api/new-semester-checklist/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/new-semester-checklist'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/new-semester-checklist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/new-semester-checklist'] }),
  });

  const activeItems = items.filter(i => !i.isCompleted && !i.isDeleted);
  const completedItems = items.filter(i => i.isCompleted && !i.isDeleted);
  const allItems = [...activeItems, ...completedItems];

  const emptySlots = Math.max(0, 10 - allItems.length);

  const handleAddItem = useCallback(() => {
    if (!newItemTitle.trim()) return;
    createMutation.mutate({
      title: newItemTitle.trim(),
      semesterKey,
      sortOrder: allItems.length + 1,
      isGlobal: false,
    });
    setNewItemTitle("");
  }, [newItemTitle, semesterKey, allItems.length]);

  const handleToggleComplete = useCallback((item: NewSemesterChecklistItem) => {
    updateMutation.mutate({
      id: item.id,
      isCompleted: !item.isCompleted,
      completedAt: !item.isCompleted ? new Date().toISOString() : null,
    });
  }, []);

  const handleToggleGlobal = useCallback((item: NewSemesterChecklistItem) => {
    updateMutation.mutate({
      id: item.id,
      isGlobal: !item.isGlobal,
    });
  }, []);

  const handleTitleChange = useCallback((id: number, value: string) => {
    setEditingTitles(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleTitleBlur = useCallback((item: NewSemesterChecklistItem) => {
    const newTitle = editingTitles[item.id];
    if (newTitle !== undefined && newTitle.trim() !== item.title) {
      updateMutation.mutate({ id: item.id, title: newTitle.trim() });
    }
    setEditingTitles(prev => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }, [editingTitles]);

  const handleSwipeStart = (id: number, clientX: number) => {
    setSwipingId(id);
    touchStartX.current = clientX;
    setSwipeX(0);
  };

  const handleSwipeMove = (clientX: number) => {
    if (swipingId === null) return;
    const diff = clientX - touchStartX.current;
    if (diff < 0) setSwipeX(diff);
  };

  const handleSwipeEnd = () => {
    if (swipingId !== null && swipeX < -80) {
      deleteMutation.mutate(swipingId);
    }
    setSwipingId(null);
    setSwipeX(0);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onDismiss]);

  const flyoutStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10005,
    minWidth: '620px',
    maxWidth: '720px',
    background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, ${colorSettings.mainBackgroundGradientEnd} 100%)`,
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    overflow: 'visible',
  };

  if (anchorRect) {
    flyoutStyle.top = `${anchorRect.top}px`;
    flyoutStyle.left = `${anchorRect.right + 8}px`;
    if (anchorRect.right + 740 > window.innerWidth) {
      flyoutStyle.left = `${anchorRect.left - 730}px`;
    }
    if (flyoutStyle.left && parseInt(String(flyoutStyle.left)) < 10) {
      flyoutStyle.left = '10px';
    }
    if (anchorRect.top + 700 > window.innerHeight) {
      flyoutStyle.top = `${Math.max(20, window.innerHeight - 750)}px`;
    }
  } else {
    flyoutStyle.top = '50%';
    flyoutStyle.left = '50%';
    flyoutStyle.transform = 'translate(-50%, -50%)';
  }

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`e-${i}`} className="w-7 h-7" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
      const isSelected = dateStr === selectedDate;
      const isSemStart = semesterStartDate && dateStr === semesterStartDate;
      cells.push(
        <div
          key={d}
          className="w-7 h-7 flex items-center justify-center text-[11px] rounded cursor-pointer hover:bg-white/20"
          style={{
            background: isSelected ? colorSettings.headerBar : isSemStart ? 'rgba(16,185,129,0.4)' : isToday ? 'rgba(59,130,246,0.3)' : 'transparent',
            color: '#ffffff',
            fontWeight: isToday || isSemStart ? 700 : 400,
            border: isSemStart ? '1px solid rgba(16,185,129,0.6)' : 'none',
          }}
          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
          data-testid={`cal-day-${dateStr}`}
        >
          {d}
        </div>
      );
    }

    return (
      <div className="px-5 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <button className="text-white/60 hover:text-white text-sm px-2" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} data-testid="cal-prev">&lt;</button>
          <span className="text-sm text-white font-semibold">{format(calendarMonth, 'MMMM yyyy')}</span>
          <button className="text-white/60 hover:text-white text-sm px-2" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} data-testid="cal-next">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-0 max-w-[220px] mx-auto">
          {dayLabels.map((l, i) => <div key={i} className="w-7 h-5 flex items-center justify-center text-[9px] text-white/40 font-bold">{l}</div>)}
          {cells}
        </div>
      </div>
    );
  };

  const renderChecklistRow = (item: NewSemesterChecklistItem, isCompleted: boolean) => {
    const displayTitle = editingTitles[item.id] !== undefined ? editingTitles[item.id] : item.title;

    return (
      <div
        key={item.id}
        className="flex items-center gap-3 py-1.5 group relative"
        style={{ transform: swipingId === item.id ? `translateX(${swipeX}px)` : 'none', transition: swipingId === item.id ? 'none' : 'transform 0.2s' }}
        onTouchStart={(e) => handleSwipeStart(item.id, e.touches[0].clientX)}
        onTouchMove={(e) => handleSwipeMove(e.touches[0].clientX)}
        onTouchEnd={handleSwipeEnd}
        data-testid={`checklist-item-${isCompleted ? 'done-' : ''}${item.id}`}
      >
        <button
          type="button"
          className="shrink-0 flex items-center justify-center rounded border-2 cursor-pointer"
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: isCompleted ? '#22c55e' : '#ffffff',
            borderColor: isCompleted ? '#22c55e' : '#ffffff',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            padding: 0,
            outline: 'none',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleToggleComplete(item);
          }}
          data-testid={`checklist-check-${item.id}`}
        >
          {isCompleted && (
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <input
          type="text"
          value={displayTitle}
          onChange={(e) => handleTitleChange(item.id, e.target.value)}
          onBlur={() => handleTitleBlur(item)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="flex-1 text-sm rounded px-3 py-2 outline-none min-w-0"
          style={{
            backgroundColor: '#ffffff',
            color: isCompleted ? '#999999' : '#1a1a1a',
            textDecoration: isCompleted ? 'line-through' : 'none',
            border: '1px solid rgba(255,255,255,0.3)',
            height: '36px',
          }}
          data-testid={`checklist-title-input-${item.id}`}
        />

        <button
          type="button"
          className="shrink-0 flex items-center cursor-pointer select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', background: 'none', border: 'none', padding: 0, outline: 'none' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleToggleGlobal(item);
          }}
          title={item.isGlobal ? 'Appears on all semesters (click to make semester-specific)' : 'Only this semester (click to add to all semesters)'}
          data-testid={`checklist-global-toggle-${item.id}`}
        >
          <div
            className="flex items-center rounded-full transition-colors"
            style={{
              width: '40px',
              height: '22px',
              backgroundColor: item.isGlobal ? '#22c55e' : 'rgba(255,255,255,0.25)',
              justifyContent: item.isGlobal ? 'flex-end' : 'flex-start',
              display: 'flex',
              padding: '2px',
            }}
          >
            <div
              className="rounded-full transition-all"
              style={{
                width: '18px',
                height: '18px',
                backgroundColor: '#ffffff',
              }}
            />
          </div>
        </button>

        <Trash2
          className="w-4 h-4 text-white/20 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => deleteMutation.mutate(item.id)}
          data-testid={`checklist-delete-${isCompleted ? 'done-' : ''}${item.id}`}
        />
      </div>
    );
  };

  return (
    <div ref={flyoutRef} style={flyoutStyle} data-testid={`sem-checklist-flyout-${semesterKey}`}>
      <div className="px-5 py-3 flex items-center justify-between border-b border-white/10" style={{ background: colorSettings.headerBar, borderRadius: '12px 12px 0 0' }}>
        <span className="text-base font-bold text-white tracking-wide">{semesterLabel} Checklist</span>
        <X className="w-5 h-5 text-white/60 hover:text-white cursor-pointer" onClick={onDismiss} data-testid="close-sem-checklist" />
      </div>

      {renderCalendar()}

      <div className="px-5 py-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {isLoading ? (
          <div className="text-white/40 text-sm text-center py-6">Loading...</div>
        ) : (
          <>
            {activeItems.map((item) => renderChecklistRow(item, false))}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 py-1.5">
                <div
                  className="shrink-0 rounded border-2"
                  style={{
                    width: '22px',
                    height: '22px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}
                />
                <div
                  className="flex-1 rounded px-3 py-2"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    height: '36px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span className="text-sm text-white/15">Empty</span>
                </div>
                <div style={{ width: '40px', height: '22px' }} />
                <div style={{ width: '16px', height: '16px' }} />
              </div>
            ))}

            {completedItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Completed</span>
                {completedItems.map((item) => renderChecklistRow(item, true))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-5 py-3 border-t border-white/10 flex items-center gap-3">
        <input
          type="text"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
          placeholder="Add new item..."
          className="flex-1 text-sm rounded px-3 py-2 text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-white/30"
          style={{ backgroundColor: '#ffffff', height: '36px', border: '1px solid rgba(255,255,255,0.3)' }}
          data-testid="checklist-new-input"
        />
        <button
          onClick={handleAddItem}
          disabled={!newItemTitle.trim()}
          className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded disabled:opacity-30 hover:brightness-110 transition-all"
          style={{ background: colorSettings.headerBar, height: '36px' }}
          data-testid="checklist-add-btn"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="px-5 py-2 text-[9px] text-white/25 text-center" style={{ borderRadius: '0 0 12px 12px' }}>
        Toggle = appear on all semester checklists
      </div>
    </div>
  );
}
