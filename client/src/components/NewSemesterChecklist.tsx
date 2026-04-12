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
    queryFn: () => fetch(`/api/new-semester-checklist?semesterKey=${semesterKey}`, { credentials: 'include' }).then(r => r.json()),
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
    minWidth: '340px',
    maxWidth: '420px',
    background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, ${colorSettings.mainBackgroundGradientEnd} 100%)`,
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    overflow: 'visible',
  };

  if (anchorRect) {
    flyoutStyle.top = `${anchorRect.top}px`;
    flyoutStyle.left = `${anchorRect.right + 8}px`;
    if (anchorRect.right + 430 > window.innerWidth) {
      flyoutStyle.left = `${anchorRect.left - 350}px`;
    }
    if (anchorRect.top + 500 > window.innerHeight) {
      flyoutStyle.top = `${Math.max(20, window.innerHeight - 600)}px`;
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
      cells.push(<div key={`e-${i}`} className="w-5 h-5" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
      const isSelected = dateStr === selectedDate;
      const isSemStart = semesterStartDate && dateStr === semesterStartDate;
      cells.push(
        <div
          key={d}
          className="w-5 h-5 flex items-center justify-center text-[8px] rounded cursor-pointer hover:bg-white/20"
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
      <div className="px-3 py-2 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <button className="text-white/60 hover:text-white text-[10px] px-1" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} data-testid="cal-prev">&lt;</button>
          <span className="text-[9px] text-white font-semibold">{format(calendarMonth, 'MMMM yyyy')}</span>
          <button className="text-white/60 hover:text-white text-[10px] px-1" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} data-testid="cal-next">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {dayLabels.map((l, i) => <div key={i} className="w-5 h-4 flex items-center justify-center text-[7px] text-white/40 font-bold">{l}</div>)}
          {cells}
        </div>
      </div>
    );
  };

  return (
    <div ref={flyoutRef} style={flyoutStyle} data-testid={`sem-checklist-flyout-${semesterKey}`}>
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/10" style={{ background: colorSettings.headerBar, borderRadius: '10px 10px 0 0' }}>
        <span className="text-[11px] font-bold text-white tracking-wide">{semesterLabel} Checklist</span>
        <X className="w-3.5 h-3.5 text-white/60 hover:text-white cursor-pointer" onClick={onDismiss} data-testid="close-sem-checklist" />
      </div>

      {renderCalendar()}

      <div className="px-3 py-2">
        {isLoading ? (
          <div className="text-white/40 text-[10px] text-center py-4">Loading...</div>
        ) : (
          <>
            {activeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1 group relative"
                style={{ transform: swipingId === item.id ? `translateX(${swipeX}px)` : 'none', transition: swipingId === item.id ? 'none' : 'transform 0.2s' }}
                onTouchStart={(e) => handleSwipeStart(item.id, e.touches[0].clientX)}
                onTouchMove={(e) => handleSwipeMove(e.touches[0].clientX)}
                onTouchEnd={handleSwipeEnd}
                data-testid={`checklist-item-${item.id}`}
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleToggleComplete(item)}
                  className="w-3.5 h-3.5 rounded border-white/30 accent-emerald-500 cursor-pointer flex-shrink-0"
                  data-testid={`checklist-check-${item.id}`}
                />
                <span className="text-[10px] text-white flex-1 min-w-0 truncate">{item.title}</span>
                <button
                  className={`w-7 h-4 rounded-full flex items-center transition-colors flex-shrink-0 ${item.isGlobal ? 'bg-emerald-500 justify-end' : 'bg-white/20 justify-start'}`}
                  onClick={() => handleToggleGlobal(item)}
                  title={item.isGlobal ? 'Appears on all semesters (click to make semester-specific)' : 'Only this semester (click to add to all semesters)'}
                  data-testid={`checklist-global-toggle-${item.id}`}
                >
                  <div className={`w-3 h-3 rounded-full mx-0.5 ${item.isGlobal ? 'bg-white' : 'bg-white/60'}`} />
                </button>
                <Trash2
                  className="w-3 h-3 text-white/20 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate(item.id)}
                  data-testid={`checklist-delete-${item.id}`}
                />
              </div>
            ))}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 py-1">
                <input type="checkbox" disabled className="w-3.5 h-3.5 rounded border-white/10 opacity-20 flex-shrink-0" />
                <span className="text-[10px] text-white/15 flex-1">Empty</span>
              </div>
            ))}

            {completedItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <span className="text-[8px] text-white/30 uppercase tracking-wider font-bold">Completed</span>
                {completedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 py-1 group relative"
                    style={{ transform: swipingId === item.id ? `translateX(${swipeX}px)` : 'none', transition: swipingId === item.id ? 'none' : 'transform 0.2s' }}
                    onTouchStart={(e) => handleSwipeStart(item.id, e.touches[0].clientX)}
                    onTouchMove={(e) => handleSwipeMove(e.touches[0].clientX)}
                    onTouchEnd={handleSwipeEnd}
                    data-testid={`checklist-item-done-${item.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => handleToggleComplete(item)}
                      className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer flex-shrink-0"
                      data-testid={`checklist-uncheck-${item.id}`}
                    />
                    <span className="text-[10px] text-white/30 flex-1 min-w-0 truncate line-through">{item.title}</span>
                    <Trash2
                      className="w-3 h-3 text-white/20 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteMutation.mutate(item.id)}
                      data-testid={`checklist-delete-done-${item.id}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
          placeholder="Add new item..."
          className="flex-1 text-[10px] bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white placeholder-white/30 outline-none focus:border-white/40"
          data-testid="checklist-new-input"
        />
        <button
          onClick={handleAddItem}
          disabled={!newItemTitle.trim()}
          className="flex items-center gap-1 text-[9px] font-semibold text-white px-2 py-1.5 rounded disabled:opacity-30 hover:brightness-110 transition-all"
          style={{ background: colorSettings.headerBar }}
          data-testid="checklist-add-btn"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      <div className="px-3 py-1.5 text-[7px] text-white/25 text-center" style={{ borderRadius: '0 0 10px 10px' }}>
        Toggle = appear on all semester checklists
      </div>
    </div>
  );
}
