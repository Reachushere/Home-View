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
  const confirmRef = useRef<HTMLDivElement>(null);
  const [editingTitles, setEditingTitles] = useState<Record<number, string>>({});
  const [openDatePickerId, setOpenDatePickerId] = useState<number | null>(null);
  const [confirmTask, setConfirmTask] = useState<{ item: NewSemesterChecklistItem; date: string } | null>(null);
  const [confirmTaskTitle, setConfirmTaskTitle] = useState('');
  const [confirmTime, setConfirmTime] = useState('09:00');
  const [confirmAllDay, setConfirmAllDay] = useState(false);
  const [confirmReminder, setConfirmReminder] = useState(30);
  const [seeded, setSeeded] = useState(false);
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
    mutationFn: (data: { title: string; date: string; time?: string; reminder?: number }) =>
      apiRequest('POST', '/api/new-semester-checklist/save-to-calendar', data),
    onSuccess: () => {
      toast({ title: "Saved to Google Calendar", description: "Event added to bryn.hendricks@gmail.com" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message || "Could not create calendar event", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isLoading || seeded) return;
    const nonDeleted = items.filter(i => !i.isDeleted);
    if (nonDeleted.length < 10) {
      const toCreate = 10 - nonDeleted.length;
      for (let i = 0; i < toCreate; i++) {
        createMutation.mutate({
          title: '',
          semesterKey,
          sortOrder: nonDeleted.length + i + 1,
          isGlobal: false,
        });
      }
    }
    setSeeded(true);
  }, [isLoading, items, seeded]);

  const activeItems = items.filter(i => !i.isCompleted && !i.isDeleted);
  const completedItems = items.filter(i => i.isCompleted && !i.isDeleted);

  const lastToggleRef = useRef<number>(0);
  const handleToggleComplete = useCallback((item: NewSemesterChecklistItem) => {
    const now = Date.now();
    if (now - lastToggleRef.current < 400) return;
    lastToggleRef.current = now;
    updateMutation.mutate({
      id: item.id,
      isCompleted: !item.isCompleted,
      completedAt: !item.isCompleted ? new Date().toISOString() : null,
    });
  }, []);

  const handleToggleGlobal = useCallback((item: NewSemesterChecklistItem) => {
    updateMutation.mutate({ id: item.id, isGlobal: !item.isGlobal });
  }, []);

  const handleTitleChange = useCallback((id: number, value: string) => {
    setEditingTitles(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleTitleBlur = useCallback((item: NewSemesterChecklistItem) => {
    const newTitle = editingTitles[item.id];
    if (newTitle !== undefined && newTitle.trim() !== item.title) {
      updateMutation.mutate({ id: item.id, title: newTitle.trim() });
    }
    setEditingTitles(prev => { const n = { ...prev }; delete n[item.id]; return n; });
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
      date: confirmTask.date,
      time: confirmAllDay ? undefined : confirmTime,
      reminder: confirmReminder > 0 ? confirmReminder : undefined,
    });
    setConfirmTask(null);
    setConfirmTaskTitle('');
    setConfirmAllDay(false);
    setConfirmTime('09:00');
    setConfirmReminder(30);
  }, [confirmTask, confirmTaskTitle, confirmAllDay, confirmTime, confirmReminder]);

  

  const renderMiniCalendar = (itemId: number) => {
    const year = datePickerMonth.getFullYear();
    const month = datePickerMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const cells: React.ReactNode[] = [];
    const item = items.find(i => i.id === itemId);

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="w-6 h-6" />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
      const isItemDue = item?.dueDate && format(new Date(item.dueDate), 'yyyy-MM-dd') === dateStr;
      cells.push(
        <div
          key={d}
          className="w-6 h-6 flex items-center justify-center text-[10px] rounded cursor-pointer hover:bg-white/30"
          style={{ background: isItemDue ? '#22c55e' : isToday ? 'rgba(59,130,246,0.4)' : 'transparent', color: '#fff', fontWeight: isToday || isItemDue ? 700 : 400 }}
          onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); handleDateSelect(item!, dateStr); }}
          data-testid={`mini-cal-day-${dateStr}`}
        >{d}</div>
      );
    }

    return (
      <div
        className="p-3 rounded-lg shadow-lg"
        style={{ background: colorSettings.mainBackground, border: '1px solid rgba(255,255,255,0.25)', minWidth: '220px' }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <button className="text-white/60 hover:text-white text-xs px-1" onPointerUp={(e) => { e.stopPropagation(); setDatePickerMonth(new Date(year, month - 1, 1)); }}>&lt;</button>
          <span className="text-[10px] text-white font-semibold">{format(datePickerMonth, 'MMMM yyyy')}</span>
          <button className="text-white/60 hover:text-white text-xs px-1" onPointerUp={(e) => { e.stopPropagation(); setDatePickerMonth(new Date(year, month + 1, 1)); }}>&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {dayLabels.map((l, i) => <div key={i} className="w-6 h-4 flex items-center justify-center text-[8px] text-white/40 font-bold">{l}</div>)}
          {cells}
        </div>
        <div className="text-[8px] text-white/30 text-center mt-2">Pick a date to create a task</div>
      </div>
    );
  };

  const renderRow = (item: NewSemesterChecklistItem, isCompleted: boolean) => {
    const displayTitle = editingTitles[item.id] !== undefined ? editingTitles[item.id] : item.title;
    const hasDueDate = !!item.dueDate;

    return (
      <div key={item.id} className="flex items-center gap-3 py-1.5" data-testid={`checklist-item-${isCompleted ? 'done-' : ''}${item.id}`}>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleComplete(item); }}
          style={{
            width: '34px',
            height: '34px',
            minWidth: '34px',
            flexShrink: 0,
            borderRadius: '4px',
            border: isCompleted ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.5)',
            background: isCompleted ? '#22c55e' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            padding: 0,
          }}
          data-testid={`checklist-check-${item.id}`}
        >
          {isCompleted && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <input
          type="text"
          value={displayTitle}
          onChange={(e) => handleTitleChange(item.id, e.target.value)}
          onBlur={() => handleTitleBlur(item)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="flex-1 text-xs rounded px-2 py-1.5 outline-none min-w-0"
          style={{
            backgroundColor: '#ffffff',
            color: isCompleted ? '#999' : '#1a1a1a',
            textDecoration: isCompleted ? 'line-through' : 'none',
            height: '30px',
          }}
          placeholder=""
          data-testid={`checklist-title-input-${item.id}`}
        />

        <button
          type="button"
          style={{ touchAction: 'manipulation', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
          onPointerUp={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpenDatePickerId(openDatePickerId === item.id ? null : item.id);
          }}
          title={hasDueDate ? `Due: ${format(new Date(item.dueDate!), 'MMM d, yyyy')}` : 'Set reminder date'}
          data-testid={`checklist-date-${item.id}`}
        >
          <CalendarDays className="w-4 h-4" style={{ color: hasDueDate ? '#22c55e' : '#ffffff' }} />
        </button>

        <button
          type="button"
          style={{ touchAction: 'manipulation', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
          onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); handleToggleGlobal(item); }}
          title={item.isGlobal ? 'Appears on all semesters' : 'Only this semester'}
          data-testid={`checklist-global-toggle-${item.id}`}
        >
          <div className="flex items-center rounded-full" style={{ width: '30px', height: '16px', backgroundColor: item.isGlobal ? '#22c55e' : 'rgba(255,255,255,0.25)', justifyContent: item.isGlobal ? 'flex-end' : 'flex-start', display: 'flex', padding: '2px' }}>
            <div className="rounded-full" style={{ width: '12px', height: '12px', backgroundColor: '#fff' }} />
          </div>
        </button>

        <button
          type="button"
          style={{ touchAction: 'manipulation', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
          onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); deleteMutation.mutate(item.id); }}
          data-testid={`checklist-delete-${item.id}`}
        >
          <Trash2 className="w-[18px] h-[18px] text-white hover:text-red-400 transition-colors" />
        </button>
      </div>
    );
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 10004, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { if (!confirmTask) onDismiss(); }} />
      <div
        ref={flyoutRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10005,
          width: '620px',
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

        <div className="px-4 py-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {isLoading ? (
            <div className="text-white/40 text-xs text-center py-4">Loading...</div>
          ) : (
            <>
              {activeItems.map((item) => renderRow(item, false))}

              {completedItems.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold">Completed</span>
                  {completedItems.map((item) => renderRow(item, true))}
                </div>
              )}
            </>
          )}
        </div>

        {openDatePickerId !== null && (
          <div className="px-4 py-2 border-t border-white/10">
            {renderMiniCalendar(openDatePickerId)}
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-center">
          <button
            onClick={() => createMutation.mutate({ title: '', semesterKey, sortOrder: activeItems.length + completedItems.length + 1, isGlobal: false })}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded hover:brightness-110 transition-all"
            style={{ background: colorSettings.headerBar }}
            data-testid="checklist-add-btn"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        <div className="px-4 py-2 text-[10px] text-white/40 text-center flex items-center justify-center gap-6">
          <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Set reminder</span>
          <span className="flex items-center gap-1">Toggle = all semesters</span>
          <span className="flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</span>
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex gap-3" style={{ borderRadius: '0 0 12px 12px' }}>
          <button
            onClick={() => { setEditingTitles({}); onDismiss(); }}
            className="flex-1 text-xs font-semibold text-white/70 py-2 rounded border border-white/20 hover:bg-white/10 transition-all"
            data-testid="checklist-cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 text-xs font-bold text-white py-2 rounded hover:brightness-110 transition-all"
            style={{ background: '#22c55e' }}
            data-testid="checklist-save-btn"
          >
            Save & Close
          </button>
        </div>
      </div>

      {confirmTask && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10010, backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => { setConfirmTask(null); setConfirmTaskTitle(''); }} />
          <div
            ref={confirmRef}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10011,
              width: '380px', maxWidth: '90vw',
              background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, ${colorSettings.mainBackgroundGradientEnd} 100%)`,
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '20px',
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
                type="text" value={confirmTaskTitle} onChange={(e) => setConfirmTaskTitle(e.target.value)}
                placeholder="Enter task name..."
                className="w-full text-xs rounded px-3 py-2 outline-none text-black"
                style={{ backgroundColor: '#ffffff', height: '34px' }}
                autoFocus data-testid="confirm-task-title-input"
              />
            </div>
            <div className="mb-3">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-bold mb-1 block">Due Date</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={confirmTask.date}
                  onChange={(e) => {
                    if (e.target.value) {
                      setConfirmTask(prev => prev ? { ...prev, date: e.target.value } : null);
                      updateMutation.mutate({ id: confirmTask.item.id, dueDate: e.target.value });
                    }
                  }}
                  className="text-xs rounded px-3 py-2 outline-none text-black flex-1"
                  style={{ backgroundColor: '#ffffff', height: '34px' }}
                  data-testid="confirm-date-input"
                />
                <span className="text-xs text-white/60">
                  {format(new Date(confirmTask.date + 'T12:00:00'), 'EEEE')}
                </span>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-bold mb-1 block">Time</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setConfirmAllDay(!confirmAllDay)} style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', userSelect: 'none' }} data-testid="confirm-all-day">
                  <div style={{
                    width: '16px', height: '16px', minWidth: '16px', borderRadius: '3px',
                    border: confirmAllDay ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.5)',
                    background: confirmAllDay ? '#22c55e' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {confirmAllDay && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white/80">All day</span>
                </label>
                {!confirmAllDay && (() => {
                  const [hh, mm] = confirmTime.split(':').map(Number);
                  const isPM = hh >= 12;
                  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
                  return (
                    <div className="flex items-center gap-1">
                      <select
                        value={h12}
                        onChange={(e) => {
                          const newH12 = Number(e.target.value);
                          const newH24 = isPM ? (newH12 === 12 ? 12 : newH12 + 12) : (newH12 === 12 ? 0 : newH12);
                          setConfirmTime(`${String(newH24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
                        }}
                        className="text-xs rounded px-1 py-1.5 outline-none text-black"
                        style={{ backgroundColor: '#ffffff', height: '30px' }}
                        data-testid="confirm-time-hour"
                      >
                        {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-white font-bold">:</span>
                      <select
                        value={mm}
                        onChange={(e) => {
                          setConfirmTime(`${String(hh).padStart(2, '0')}:${String(Number(e.target.value)).padStart(2, '0')}`);
                        }}
                        className="text-xs rounded px-1 py-1.5 outline-none text-black"
                        style={{ backgroundColor: '#ffffff', height: '30px' }}
                        data-testid="confirm-time-minute"
                      >
                        {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                      </select>
                      <select
                        value={isPM ? 'PM' : 'AM'}
                        onChange={(e) => {
                          const toAM = e.target.value === 'AM';
                          let newH24 = toAM ? (hh >= 12 ? hh - 12 : hh) : (hh < 12 ? hh + 12 : hh);
                          setConfirmTime(`${String(newH24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
                        }}
                        className="text-xs rounded px-1 py-1.5 outline-none text-black"
                        style={{ backgroundColor: '#ffffff', height: '30px' }}
                        data-testid="confirm-time-ampm"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-bold mb-1 block">Reminder</label>
              <select
                value={confirmReminder}
                onChange={(e) => setConfirmReminder(Number(e.target.value))}
                className="text-xs rounded px-2 py-1.5 outline-none text-black w-full"
                style={{ backgroundColor: '#ffffff', height: '30px' }}
                data-testid="confirm-reminder-select"
              >
                <option value={0}>No reminder</option>
                <option value={5}>5 minutes before</option>
                <option value={10}>10 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={120}>2 hours before</option>
                <option value={1440}>1 day before</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmTask(null); setConfirmTaskTitle(''); setConfirmAllDay(false); setConfirmTime('09:00'); setConfirmReminder(30); }} className="flex-1 text-xs font-semibold text-white/70 py-2 rounded border border-white/20 hover:bg-white/10 transition-all" data-testid="confirm-task-cancel">Cancel</button>
              <button onClick={handleConfirmSaveTask} disabled={createTaskMutation.isPending} className="flex-1 text-xs font-bold text-white py-2 rounded hover:brightness-110 transition-all disabled:opacity-50" style={{ background: '#22c55e' }} data-testid="confirm-task-save">
                {createTaskMutation.isPending ? 'Saving...' : 'Save to Calendar'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
