import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { NewSemesterChecklistItem } from "@shared/schema";
import { Plus, X, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

export default function NewSemesterChecklist({ semesterKey, semesterLabel, colorSettings, onDismiss, semesterStartDate }: Props) {
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [editingTitles, setEditingTitles] = useState<Record<number, string>>({});
  const [openDatePickerId, setOpenDatePickerId] = useState<number | null>(null);
  const [confirmTask, setConfirmTask] = useState<{ item: NewSemesterChecklistItem; date: string } | null>(null);
  const [confirmTaskTitle, setConfirmTaskTitle] = useState('');
  const [datePickerMonth, setDatePickerMonth] = useState<Date>(() => {
    if (semesterStartDate) {
      const d = new Date(semesterStartDate + 'T12:00:00');
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const { toast } = useToast();

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

  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string; dueDate: string; courseName?: string; taskType?: string }) =>
      apiRequest('POST', '/api/tasks', {
        title: data.title,
        dueDate: data.dueDate,
        courseName: data.courseName || 'General',
        taskType: data.taskType || 'homework',
        status: 'not_started',
        priority: 'medium',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task created", description: "Added to your task list and calendar." });
    },
  });

  const activeItems = items.filter(i => !i.isCompleted && !i.isDeleted);
  const completedItems = items.filter(i => i.isCompleted && !i.isDeleted);
  const allItems = [...activeItems, ...completedItems];

  const emptySlots = Math.max(0, 10 - allItems.length);

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

  const handleDateSelect = useCallback((item: NewSemesterChecklistItem, dateStr: string) => {
    updateMutation.mutate({ id: item.id, dueDate: dateStr });
    setOpenDatePickerId(null);
    setConfirmTaskTitle(item.title || '');
    setConfirmTask({ item, date: dateStr });
  }, []);

  const handleConfirmSaveTask = useCallback(() => {
    if (!confirmTask) return;
    createTaskMutation.mutate({
      title: confirmTaskTitle || confirmTask.item.title || 'Checklist task',
      dueDate: confirmTask.date,
    });
    setConfirmTask(null);
    setConfirmTaskTitle('');
  }, [confirmTask, confirmTaskTitle]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onDismiss]);

  const renderMiniCalendar = (itemId: number) => {
    const year = datePickerMonth.getFullYear();
    const month = datePickerMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const cells: React.ReactNode[] = [];
    const item = items.find(i => i.id === itemId);

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`e-${i}`} className="w-6 h-6" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
      const isItemDue = item?.dueDate && format(new Date(item.dueDate), 'yyyy-MM-dd') === dateStr;
      cells.push(
        <div
          key={d}
          className="w-6 h-6 flex items-center justify-center text-[10px] rounded cursor-pointer hover:bg-white/30"
          style={{
            background: isItemDue ? '#22c55e' : isToday ? 'rgba(59,130,246,0.4)' : 'transparent',
            color: '#ffffff',
            fontWeight: isToday || isItemDue ? 700 : 400,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleDateSelect(item!, dateStr);
          }}
          data-testid={`mini-cal-day-${dateStr}`}
        >
          {d}
        </div>
      );
    }

    return (
      <div
        className="absolute right-0 top-full mt-1 p-3 rounded-lg shadow-lg z-50"
        style={{
          background: colorSettings.mainBackground,
          border: '1px solid rgba(255,255,255,0.25)',
          minWidth: '220px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <button className="text-white/60 hover:text-white text-xs px-1" onClick={(e) => { e.stopPropagation(); setDatePickerMonth(new Date(year, month - 1, 1)); }}>&lt;</button>
          <span className="text-[10px] text-white font-semibold">{format(datePickerMonth, 'MMMM yyyy')}</span>
          <button className="text-white/60 hover:text-white text-xs px-1" onClick={(e) => { e.stopPropagation(); setDatePickerMonth(new Date(year, month + 1, 1)); }}>&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {dayLabels.map((l, i) => <div key={i} className="w-6 h-4 flex items-center justify-center text-[8px] text-white/40 font-bold">{l}</div>)}
          {cells}
        </div>
        <div className="text-[8px] text-white/30 text-center mt-2">Pick a date to create a task</div>
      </div>
    );
  };

  const renderChecklistRow = (item: NewSemesterChecklistItem, isCompleted: boolean) => {
    const displayTitle = editingTitles[item.id] !== undefined ? editingTitles[item.id] : item.title;
    const hasDueDate = !!item.dueDate;

    return (
      <div
        key={item.id}
        className="flex items-center gap-3 py-1.5 relative"
        data-testid={`checklist-item-${isCompleted ? 'done-' : ''}${item.id}`}
      >
        <div
          role="button"
          className="shrink-0 flex items-center justify-center rounded border-2"
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: isCompleted ? '#22c55e' : '#ffffff',
            borderColor: isCompleted ? '#22c55e' : '#ffffff',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            padding: 0,
            outline: 'none',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleToggleComplete(item);
          }}
          data-testid={`checklist-check-${item.id}`}
        >
          {isCompleted && (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <input
          type="text"
          value={displayTitle}
          onChange={(e) => handleTitleChange(item.id, e.target.value)}
          onBlur={() => handleTitleBlur(item)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="flex-1 text-xs rounded px-2 py-1.5 outline-none min-w-0"
          style={{
            backgroundColor: '#ffffff',
            color: isCompleted ? '#999999' : '#1a1a1a',
            textDecoration: isCompleted ? 'line-through' : 'none',
            border: '1px solid rgba(255,255,255,0.3)',
            height: '30px',
          }}
          data-testid={`checklist-title-input-${item.id}`}
        />

        <button
          type="button"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            background: 'none',
            border: 'none',
            padding: 0,
            outline: 'none',
            cursor: 'pointer',
          }}
          onPointerUp={(e) => { e.stopPropagation(); setOpenDatePickerId(openDatePickerId === item.id ? null : item.id); }}
          title={hasDueDate ? `Due: ${format(new Date(item.dueDate!), 'MMM d, yyyy')}` : 'Set reminder date'}
          data-testid={`checklist-date-${item.id}`}
        >
          <CalendarDays
            className="w-4 h-4 transition-colors"
            style={{ color: hasDueDate ? '#22c55e' : 'rgba(255,255,255,0.4)' }}
          />
        </button>

        {openDatePickerId === item.id && renderMiniCalendar(item.id)}

        <button
          type="button"
          className="shrink-0 flex items-center"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            background: 'none',
            border: 'none',
            padding: 0,
            outline: 'none',
            cursor: 'pointer',
          }}
          onPointerUp={(e) => { e.stopPropagation(); handleToggleGlobal(item); }}
          title={item.isGlobal ? 'Appears on all semesters' : 'Only this semester'}
          data-testid={`checklist-global-toggle-${item.id}`}
        >
          <div
            className="flex items-center rounded-full transition-colors"
            style={{
              width: '30px',
              height: '16px',
              backgroundColor: item.isGlobal ? '#22c55e' : 'rgba(255,255,255,0.25)',
              justifyContent: item.isGlobal ? 'flex-end' : 'flex-start',
              display: 'flex',
              padding: '2px',
            }}
          >
            <div
              className="rounded-full transition-all"
              style={{ width: '12px', height: '12px', backgroundColor: '#ffffff' }}
            />
          </div>
        </button>

        <button
          type="button"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            background: 'none',
            border: 'none',
            padding: 0,
            outline: 'none',
            cursor: 'pointer',
          }}
          onClick={() => deleteMutation.mutate(item.id)}
          data-testid={`checklist-delete-${isCompleted ? 'done-' : ''}${item.id}`}
        >
          <Trash2 className="w-[18px] h-[18px] text-white/30 hover:text-red-400 transition-colors" />
        </button>
      </div>
    );
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10004,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
        onClick={onDismiss}
      />
      <div
        ref={flyoutRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10005,
          width: '580px',
          maxWidth: '95vw',
          background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, ${colorSettings.mainBackgroundGradientEnd} 100%)`,
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        data-testid={`sem-checklist-flyout-${semesterKey}`}
      >
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10" style={{ background: colorSettings.headerBar, borderRadius: '12px 12px 0 0' }}>
          <span className="text-sm font-bold text-white tracking-wide">{semesterLabel} Checklist</span>
          <X className="w-4 h-4 text-white/60 hover:text-white cursor-pointer" onClick={onDismiss} data-testid="close-sem-checklist" />
        </div>

        <div className="px-4 py-3">
          {isLoading ? (
            <div className="text-white/40 text-xs text-center py-4">Loading...</div>
          ) : (
            <>
              {activeItems.map((item) => renderChecklistRow(item, false))}

              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-3 py-1.5">
                  <div
                    className="shrink-0 rounded border-2"
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: '#ffffff',
                      borderColor: '#ffffff',
                      opacity: 0.15,
                    }}
                  />
                  <div
                    className="flex-1 rounded"
                    style={{
                      backgroundColor: '#ffffff',
                      height: '30px',
                      opacity: 0.08,
                    }}
                  />
                  <div style={{ width: '16px' }} />
                  <div style={{ width: '30px' }} />
                  <div style={{ width: '18px' }} />
                </div>
              ))}

              {completedItems.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-[8px] text-white/30 uppercase tracking-wider font-bold">Completed</span>
                  {completedItems.map((item) => renderChecklistRow(item, true))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-center">
          <button
            onClick={() => {
              createMutation.mutate({
                title: '',
                semesterKey,
                sortOrder: allItems.length + 1,
                isGlobal: false,
              });
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded hover:brightness-110 transition-all"
            style={{ background: colorSettings.headerBar }}
            data-testid="checklist-add-btn"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        <div className="px-4 py-2 text-[10px] text-white/70 text-center flex items-center justify-center gap-6" style={{ borderRadius: '0 0 12px 12px' }}>
          <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Set reminder</span>
          <span className="flex items-center gap-1">Toggle = all semesters</span>
          <span className="flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</span>
        </div>
      </div>

      {confirmTask && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10010,
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
            onClick={() => { setConfirmTask(null); setConfirmTaskTitle(''); }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10011,
              width: '380px',
              maxWidth: '90vw',
              background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, ${colorSettings.mainBackgroundGradientEnd} 100%)`,
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              padding: '20px',
            }}
            data-testid="confirm-task-dialog"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white">Add Task to Calendar</span>
              <X className="w-4 h-4 text-white/60 hover:text-white cursor-pointer" onClick={() => { setConfirmTask(null); setConfirmTaskTitle(''); }} />
            </div>

            <div className="mb-3">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-bold mb-1 block">Task Name</label>
              <input
                type="text"
                value={confirmTaskTitle}
                onChange={(e) => setConfirmTaskTitle(e.target.value)}
                placeholder="Enter task name..."
                className="w-full text-xs rounded px-3 py-2 outline-none text-black"
                style={{ backgroundColor: '#ffffff', height: '34px' }}
                autoFocus
                data-testid="confirm-task-title-input"
              />
            </div>

            <div className="mb-4">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-bold mb-1 block">Due Date</label>
              <div
                className="text-sm text-white font-semibold px-3 py-2 rounded"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <CalendarDays className="w-4 h-4 inline mr-2 text-green-400" />
                {format(new Date(confirmTask.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmTask(null); setConfirmTaskTitle(''); }}
                className="flex-1 text-xs font-semibold text-white/70 py-2 rounded border border-white/20 hover:bg-white/10 transition-all"
                data-testid="confirm-task-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveTask}
                disabled={createTaskMutation.isPending}
                className="flex-1 text-xs font-bold text-white py-2 rounded hover:brightness-110 transition-all disabled:opacity-50"
                style={{ background: '#22c55e' }}
                data-testid="confirm-task-save"
              >
                {createTaskMutation.isPending ? 'Saving...' : 'Save to Calendar'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
