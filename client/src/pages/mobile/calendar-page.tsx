import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWeekDates, getSemesterTotalWeeks, FIRST_WEEK } from "@shared/schema";
import type { TaskItem, CoursesData, ShiftEntry, SemesterSettings } from "./types";
import { TaskDetailPopup } from "./task-detail";

interface DegreeTrackingData {
  coursesData?: CoursesData;
  [key: string]: unknown;
}

function findCourseColor(coursesData: CoursesData | undefined, courseName: string | undefined): string {
  if (!coursesData?.courses || !courseName) return '#3b82f6';
  const course = coursesData.courses.find(
    c => c.name?.split(' - ')[0]?.toUpperCase() === courseName.toUpperCase() || c.name === courseName
  );
  return course?.color || '#3b82f6';
}

function WeekView({ selectedWeek, semStart, readingWeek, allTasks, coursesData }: {
  selectedWeek: number; semStart?: Date; readingWeek: Date | null; allTasks: TaskItem[]; coursesData: CoursesData | undefined;
}) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const { start } = getWeekDates(selectedWeek, semStart, readingWeek);
  const weekDates: Date[] = [];
  for (let d = 0; d < 7; d++) { const dt = new Date(start); dt.setDate(dt.getDate() + d); weekDates.push(dt); }
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(7, 1fr)`, height: '100%', minHeight: '100%' }}>
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: 15 }, (_, i) => {
          const hour = i + 7;
          const label = hour <= 12 ? `${hour}${hour === 12 ? 'p' : 'a'}` : `${hour - 12}p`;
          return (<div key={hour} style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '1px', color: 'rgba(255,255,255,0.4)', fontSize: '8px', fontWeight: 500 }}>{label}</div>);
        })}
      </div>
      {weekDates.map((date, dayIdx) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
        const dayTasks = allTasks.filter((t) => {
          if (!t.dueDate) return false;
          const td = new Date(t.dueDate);
          return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}` === dateStr;
        });
        return (
          <div key={dayIdx} style={{ borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', position: 'relative', background: isToday ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
            <div style={{ textAlign: 'center', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, background: isToday ? 'rgba(59,130,246,0.2)' : 'transparent' }}>
              <div style={{ fontSize: '8px', color: isToday ? '#93c5fd' : 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase' }}>{dayName}</div>
              <div style={{ fontSize: '13px', color: isToday ? '#ffffff' : 'rgba(255,255,255,0.8)', fontWeight: isToday ? 700 : 500 }}>{date.getDate()}</div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {Array.from({ length: 15 }, (_, i) => (<div key={i} style={{ position: 'absolute', top: `${(i / 15) * 100}%`, left: 0, right: 0, height: `${100 / 15}%`, borderBottom: '1px solid rgba(255,255,255,0.04)' }} />))}
              {dayTasks.map((task, ti) => {
                const td = new Date(task.dueDate!);
                const hour = td.getHours(); const minute = td.getMinutes();
                const topPct = Math.max(0, Math.min(100, ((hour - 7 + minute / 60) / 15) * 100));
                const bg = findCourseColor(coursesData, task.courseName);
                return (
                  <div key={ti} onClick={() => setSelectedTask(task)} style={{
                    position: 'absolute', top: `${topPct}%`, left: '1px', right: '1px', minHeight: '14px',
                    backgroundColor: bg, borderRadius: '2px', padding: '1px 3px', overflow: 'hidden',
                    fontSize: '7px', color: '#fff', fontWeight: 600, lineHeight: '1.2',
                    opacity: task.isCompleted ? 0.4 : 1, textDecoration: task.isCompleted ? 'line-through' : 'none',
                    zIndex: 5, cursor: 'pointer',
                  }} data-testid={`mobile-app-task-${task.id}`}>
                    {(task.title || '').replace(/^\s*\[[^\]]*\]\s*/g, '')}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {selectedTask && <TaskDetailPopup task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

function MonthView({ selectedWeek, semStart, readingWeek, allTasks, coursesData }: {
  selectedWeek: number; semStart?: Date; readingWeek: Date | null; allTasks: TaskItem[]; coursesData: CoursesData | undefined;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const { start: weekStart } = getWeekDates(selectedWeek, semStart, readingWeek);
  const firstDate = weekStart || new Date();
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(firstDate);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ textAlign: 'center', color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{monthName}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const tasksForDay = allTasks.filter((t) => {
            if (!t.dueDate) return false;
            const td = new Date(t.dueDate);
            return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}` === dateStr;
          });
          return (
            <div key={i} onClick={() => tasksForDay.length > 0 ? setSelectedDay(selectedDay === dateStr ? null : dateStr) : null} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: '6px', cursor: tasksForDay.length > 0 ? 'pointer' : 'default', background: selectedDay === dateStr ? 'rgba(59,130,246,0.4)' : isToday ? 'rgba(59,130,246,0.3)' : tasksForDay.length > 0 ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
              <div style={{ fontSize: '13px', color: isToday ? '#93c5fd' : '#fff', fontWeight: isToday ? 700 : 400 }}>{day}</div>
              {tasksForDay.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
                  {tasksForDay.slice(0, 3).map((t, ti) => (
                    <div key={ti} style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: findCourseColor(coursesData, t.courseName) }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedDay && (() => {
        const dayTasks = allTasks.filter((t) => {
          if (!t.dueDate) return false;
          const td = new Date(t.dueDate);
          return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}` === selectedDay;
        });
        if (dayTasks.length === 0) return null;
        const d = new Date(selectedDay + 'T12:00:00');
        return (
          <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
              {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            {dayTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTask(t)}
                style={{
                  padding: '8px 10px', marginBottom: '4px', borderRadius: '6px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
                data-testid={`mobile-app-month-task-${t.id}`}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: findCourseColor(coursesData, t.courseName), flexShrink: 0 }} />
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 500, opacity: t.isCompleted ? 0.5 : 1, textDecoration: t.isCompleted ? 'line-through' : 'none', flex: 1 }}>
                  {t.title}
                </span>
                {t.dueDate && (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', flexShrink: 0 }}>
                    {new Date(t.dueDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })()}
      {selectedTask && <TaskDetailPopup task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

function ShiftCalendarView({ localShiftMap }: { localShiftMap: Record<string, string> }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(today);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} data-testid="mobile-app-shift-calendar">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.15)',
        background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.1) 100%)', flexShrink: 0,
      }}>
        <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
          Shift Schedule
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <div style={{ textAlign: 'center', color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{monthName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, padding: '4px 0' }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const shift = localShiftMap[dateStr];
            const isDay = shift === 'day';
            const isNight = shift === 'night';
            return (
              <div key={i} style={{
                textAlign: 'center', padding: '6px 2px', borderRadius: '6px',
                background: isToday ? 'rgba(59,130,246,0.3)' : isDay ? 'rgba(234,179,8,0.2)' : isNight ? 'rgba(99,102,241,0.2)' : 'transparent',
                border: isToday ? '1px solid rgba(59,130,246,0.5)' : 'none',
              }}>
                <div style={{ fontSize: '13px', color: isToday ? '#93c5fd' : '#fff', fontWeight: isToday ? 700 : 400 }}>{day}</div>
                {(isDay || isNight) && (
                  <div style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px', color: isDay ? '#fde047' : '#a5b4fc', fontFamily: "system-ui, -apple-system, sans-serif" }}>
                    {isDay ? '☀️' : '🌙'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarPage({ mobileAuth }: { mobileAuth: string }) {
  const { data: semesterSettings } = useQuery<SemesterSettings>({
    queryKey: ["/api/semester"],
    staleTime: 60000,
  });

  const { data: allTasks = [] } = useQuery<TaskItem[]>({
    queryKey: ["/api/tasks"],
    staleTime: 30000,
  });

  const { data: degreeData } = useQuery<DegreeTrackingData>({
    queryKey: ["/api/degree-tracking"],
    staleTime: 60000,
  });
  const coursesData = degreeData?.coursesData;

  const { data: shiftData } = useQuery<ShiftEntry[]>({
    queryKey: ["/api/shift-schedule"],
    staleTime: 60000,
  });

  const currentMaxWeek = useMemo(() => getSemesterTotalWeeks(semesterSettings?.semesterType), [semesterSettings?.semesterType]);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date();
    const diff = Math.floor((now.getTime() - semStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(FIRST_WEEK, Math.min(currentMaxWeek, diff + 1));
  });
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');

  const localShiftMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (shiftData) {
      shiftData.forEach((s) => { if (s.date && s.shiftType) map[s.date] = s.shiftType; });
    }
    return map;
  }, [shiftData]);

  if (mobileAuth === '4201') {
    return <ShiftCalendarView localShiftMap={localShiftMap} />;
  }

  const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : undefined;
  const readingWeek = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : null;

  return (
    <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} data-testid="mobile-app-calendar">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.15)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)', flexShrink: 0,
      }}>
        <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
          {(() => {
            const { start, end } = getWeekDates(selectedWeek, semStart, readingWeek);
            const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
            return `Week ${selectedWeek}: ${fmt.format(start)} – ${fmt.format(end)}`;
          })()}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setSelectedWeek(w => Math.max(FIRST_WEEK, w - 1))} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', width: '28px', height: '26px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-testid="mobile-app-prev-week">‹</button>
          <button onClick={() => setSelectedWeek(w => Math.min(currentMaxWeek, w + 1))} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', width: '28px', height: '26px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-testid="mobile-app-next-week">›</button>
          <button onClick={() => setCalendarView(v => v === 'week' ? 'month' : 'week')} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', height: '26px', padding: '0 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-testid="mobile-app-toggle-view">{calendarView === 'week' ? 'Month' : 'Week'}</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {calendarView === "week" ? (
          <WeekView selectedWeek={selectedWeek} semStart={semStart} readingWeek={readingWeek} allTasks={allTasks} coursesData={coursesData} />
        ) : (
          <MonthView selectedWeek={selectedWeek} semStart={semStart} readingWeek={readingWeek} allTasks={allTasks} coursesData={coursesData} />
        )}
      </div>
    </div>
  );
}
