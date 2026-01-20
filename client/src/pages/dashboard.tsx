import { useState, useRef, useCallback, useEffect } from "react";
import tmuLogo from "@assets/Chang-School_1768803262583.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpload } from "@/hooks/use-upload";
import {
  BookOpen,
  Layers,
  FileText,
  FolderKanban,
  MessageSquare,
  Vote,
  GraduationCap,
  ClipboardCheck,
  Calendar,
  Clock,
  Plus,
  Download,
  RefreshCw,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  Link,
  Paperclip,
  Upload,
  Loader2,
  Play,
  Square,
  MinusCircle,
  PlusCircle,
  FolderOpen,
} from "lucide-react";
import { Link as RouterLink } from "wouter";
import type { Task } from "@shared/schema";
import { TASK_TYPES, COURSES, getWeekNumber } from "@shared/schema";
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  reading: BookOpen,
  module: Layers,
  essay: FileText,
  project: FolderKanban,
  discussion: MessageSquare,
  poll: Vote,
  exam: GraduationCap,
  quiz: ClipboardCheck,
};

const typeColors: Record<string, string> = {
  reading: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  module: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  essay: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  project: "bg-green-500/20 text-green-600 dark:text-green-400",
  discussion: "bg-pink-500/20 text-pink-600 dark:text-pink-400",
  poll: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
  exam: "bg-red-500/20 text-red-600 dark:text-red-400",
  quiz: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
};

const courseColors: Record<string, { bg: string; border: string; text: string; dot: string; prepBg: string; prepBorder: string; prepText: string }> = {
  "CPPA122": { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", prepBg: "bg-blue-200/50", prepBorder: "border-blue-300", prepText: "text-blue-600 dark:text-blue-400" },
  "CFNF400": { bg: "bg-green-500/30", border: "border-green-500", text: "text-green-700 dark:text-green-300", dot: "bg-green-500", prepBg: "bg-green-200/50", prepBorder: "border-green-300", prepText: "text-green-600 dark:text-green-400" },
  "CASL101": { bg: "bg-amber-700/30", border: "border-amber-700", text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-700", prepBg: "bg-amber-300/50", prepBorder: "border-amber-400", prepText: "text-amber-700 dark:text-amber-400" },
};

interface WeekInfo {
  weekNumber: number;
  startDate: string;
  endDate: string;
  taskCount: number;
}

export default function Dashboard() {
  const [selectedWeek, setSelectedWeek] = useState<number>(2);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 0, 17)); // January 2026
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTaskType, setNewTaskType] = useState<string>("module");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [isTodayExpanded, setIsTodayExpanded] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Calendar resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startY: e.clientY, startHeight: calendarHeight };
  }, [calendarHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const delta = e.clientY - resizeRef.current.startY;
      const newHeight = Math.max(200, Math.min(800, resizeRef.current.startHeight + delta));
      setCalendarHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const { data: weeks = [] } = useQuery<WeekInfo[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => fetch("/api/tasks").then(r => r.json()),
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { weekNumber: selectedWeek }],
    queryFn: () => fetch(`/api/tasks?weekNumber=${selectedWeek}`).then(r => r.json()),
  });

  // Google Calendar events query
  interface CalendarEvent {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    isAllDay: boolean;
    htmlLink: string;
    source: string;
  }
  
  const { data: calendarEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", { weekNumber: selectedWeek }],
    queryFn: () => fetch(`/api/calendar/events?weekNumber=${selectedWeek}`).then(r => r.json()).catch(() => []),
    refetchInterval: 60000, // Refresh every minute
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/tasks/${id}/complete`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  const syncAllCalendarMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tasks/sync-all-calendar", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  // Filter tasks by selected date if a date is clicked
  const displayTasks = selectedDate 
    ? allTasks.filter(t => isSameDay(new Date(t.dueDate), selectedDate))
    : tasks;

  const missedTasks = displayTasks.filter(t => t.isMissed && !t.isCompleted);
  const today = new Date();
  // Due Today shows ALL tasks due today (from all tasks, not just selected week)
  const todayTasks = allTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (!t.dueDate) return false;
    return isSameDay(new Date(t.dueDate), today);
  });
  // Upcoming shows tasks from selected week/date that are NOT due today
  const upcomingTasks = displayTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (!t.dueDate) return true;
    return !isSameDay(new Date(t.dueDate), today);
  });
  const completedTasks = displayTasks.filter(t => t.isCompleted);

  // Weekly view - get the current selected week's days
  const selectedWeekInfo = weeks.find(w => w.weekNumber === selectedWeek);
  const weekStartDate = selectedWeekInfo ? parseISO(selectedWeekInfo.startDate) : new Date(2026, 0, 17);
  const weekEndDate = selectedWeekInfo ? parseISO(selectedWeekInfo.endDate) : new Date(2026, 0, 23);
  
  // Generate weekdays for the weekly view - reorder so Sunday is first and Saturday is last
  const rawWeekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });
  // Move Saturday (first day) to the end so order is Sun-Sat
  const weekDays = rawWeekDays.length === 7 ? [...rawWeekDays.slice(1), rawWeekDays[0]] : rawWeekDays;
  
  // Time slots for the day view (8 AM to 6 PM)
  const timeSlots = Array.from({ length: 24 }, (_, i) => i); // 0-23 (full 24 hours)
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to 8 AM on mount
  useEffect(() => {
    if (calendarScrollRef.current) {
      const hourHeight = 40; // height of each time slot
      const headerHeight = 52; // approximate header height
      const scrollTo = (8 * hourHeight); // scroll to 8 AM
      calendarScrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Current week dates (Week 2 = Jan 17-23, 2026)
  const currentWeekInfo = weeks.find(w => w.weekNumber === 2); // Current week is Week 2
  const currentWeekStart = currentWeekInfo ? new Date(currentWeekInfo.startDate) : null;
  const currentWeekEnd = currentWeekInfo ? new Date(currentWeekInfo.endDate) : null;

  const isInCurrentWeek = (day: Date) => {
    if (!currentWeekStart || !currentWeekEnd) return false;
    const dayStart = startOfDay(day);
    const weekStart = startOfDay(currentWeekStart);
    const weekEnd = endOfDay(currentWeekEnd);
    return isWithinInterval(dayStart, { start: weekStart, end: weekEnd });
  };
  
  // Get tasks for a specific hour on a day (exclude tasks with planning periods - they show in ALL DAY)
  const getTasksForHour = (day: Date, hour: number) => {
    return allTasks.filter(t => {
      if (t.startDate) return false; // Tasks with planning periods show in ALL DAY row
      const dueDate = new Date(t.dueDate);
      return isSameDay(dueDate, day) && dueDate.getHours() === hour;
    });
  };
  
  // Get Google Calendar events for a specific hour on a day
  const getCalendarEventsForHour = (day: Date, hour: number) => {
    return calendarEvents.filter(e => {
      if (e.isAllDay) return false;
      const eventDate = new Date(e.startDate);
      return isSameDay(eventDate, day) && eventDate.getHours() === hour;
    });
  };
  
  // Get all-day Google Calendar events for a day
  const getAllDayCalendarEvents = (day: Date) => {
    return calendarEvents.filter(e => {
      if (!e.isAllDay) return false;
      const eventDate = new Date(e.startDate);
      return isSameDay(eventDate, day);
    });
  };
  
  // Get all-day tasks (tasks without specific time, or 12 AM) - exclude tasks with planning periods
  const getAllDayTasks = (day: Date) => {
    return allTasks.filter(t => {
      if (t.startDate) return false; // Tasks with planning periods have their own rows
      const dueDate = new Date(t.dueDate);
      return isSameDay(dueDate, day) && (dueDate.getHours() === 0 || dueDate.getHours() === 23);
    });
  };

  // Get tasks with planning periods on a specific day (startDate <= day < dueDate)
  const getPlanningTasksForDay = (day: Date) => {
    return allTasks.filter(t => {
      if (!t.startDate) return false;
      const startDate = new Date(t.startDate);
      const dueDate = new Date(t.dueDate);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Day is in the planning period: startDate <= day < dueDate (not including due date itself)
      return startDate <= dayEnd && dayStart < dueDate && !isSameDay(day, dueDate);
    });
  };

  // Get all planning tasks for the week and assign row slots
  const getAllWeekPlanningTasks = () => {
    const tasksWithPlanningPeriods = allTasks.filter(t => t.startDate);
    // Sort by start date to ensure consistent ordering
    return tasksWithPlanningPeriods.sort((a, b) => {
      const aStart = new Date(a.startDate!).getTime();
      const bStart = new Date(b.startDate!).getTime();
      return aStart - bStart;
    });
  };

  // Check if a task's planning period includes a specific day
  const isPlanningDayForTask = (task: Task, day: Date) => {
    if (!task.startDate) return false;
    const startDate = new Date(task.startDate);
    const dueDate = new Date(task.dueDate);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return startDate <= dayEnd && dayStart < dueDate && !isSameDay(day, dueDate);
  };

  const weekPlanningTasks = getAllWeekPlanningTasks();

  const getTasksForDay = (day: Date) => {
    return allTasks.filter(t => isSameDay(new Date(t.dueDate), day));
  };

  // Get reminders for a day (tasks due 2 days after this day, and 24-hour urgent reminders)
  const getRemindersForDay = (day: Date) => {
    const twoDayReminders = allTasks.filter(t => {
      const dueDate = new Date(t.dueDate);
      const reminderDate = subDays(dueDate, 2);
      return isSameDay(reminderDate, day) && !t.isCompleted;
    }).map(t => ({ ...t, reminderType: '2day' as const }));

    const oneDayReminders = allTasks.filter(t => {
      const dueDate = new Date(t.dueDate);
      const reminderDate = subDays(dueDate, 1);
      return isSameDay(reminderDate, day) && !t.isCompleted;
    }).map(t => ({ ...t, reminderType: '24hr' as const }));

    return [...oneDayReminders, ...twoDayReminders];
  };

  // Check if a task is urgent (within 24 hours of due date and not completed)
  const isUrgentTask = (task: Task) => {
    if (task.isCompleted) return false;
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDue <= 24 && hoursUntilDue > 0;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDayClick = (day: Date) => {
    if (selectedDate && isSameDay(selectedDate, day)) {
      setSelectedDate(null); // Deselect if clicking same day
    } else {
      setSelectedDate(day);
      // Find and switch to the week containing this day
      const weekForDay = weeks.find(w => {
        const start = parseISO(w.startDate);
        const end = parseISO(w.endDate);
        return isWithinInterval(day, { start: startOfDay(start), end: endOfDay(end) });
      });
      if (weekForDay) {
        setSelectedWeek(weekForDay.weekNumber);
      }
    }
  };

  const getCourseColor = (courseName: string | null) => {
    if (!courseName) return null;
    const courseCode = courseName.split(" ")[0];
    return courseColors[courseCode] || null;
  };

  return (
    <div className="flex h-screen">
      {isTodayExpanded && (
        <div 
          className="today-backdrop"
          onClick={() => setIsTodayExpanded(false)}
        />
      )}
      {/* Sidebar */}
      <aside className="w-72 bg-black text-white m-3 mr-0 rounded-xl shadow-lg p-4 pt-0 flex flex-col gap-4 overflow-auto">
        <div className="flex items-center gap-2 px-2 pt-3 pb-0">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-white" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            School Planner
          </h1>
        </div>

        {/* Mini Calendar */}
        <div className="px-2">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-bold bg-[#5979CC] text-white px-4 py-1.5 rounded-full" style={{ fontFamily: "'Open Sans', sans-serif" }}>{format(currentMonth, "MMMM")}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-[10px] text-white font-medium py-1">{d}</div>
            ))}
            {(() => {
              const monthStart = startOfMonth(currentMonth);
              const monthEnd = endOfMonth(currentMonth);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              return days.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                const isCurrentMonthDay = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day)}
                    className={`text-[10px] py-1 rounded-full transition-colors ${
                      isToday 
                        ? "bg-[#5979CC] text-white font-bold" 
                        : isSelected
                          ? "bg-primary/20 text-primary font-medium"
                          : isCurrentMonthDay 
                            ? "text-white hover:bg-white/20" 
                            : "text-white/30"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* Course Legend */}
        <div className="px-2 space-y-2">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Courses</h3>
          {COURSES.map((course) => {
            const colors = courseColors[course.code];
            return (
              <div key={course.code} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${colors?.dot}`} />
                <span className="text-[11px]">
                  <span className="font-medium">{course.code}</span>
                  <span className="text-white"> - {course.name}</span>
                </span>
              </div>
            );
          })}
        </div>

        <nav className="flex flex-col gap-0.5 mt-2">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wide px-2 mb-0.5">Weeks</h3>
          {weeks.map((week) => (
            <Button
              key={week.weekNumber}
              variant={selectedWeek === week.weekNumber && !selectedDate ? "secondary" : "ghost"}
              className="justify-between gap-1 h-auto py-1 px-2"
              size="sm"
              onClick={() => {
                setSelectedWeek(week.weekNumber);
                setSelectedDate(null);
              }}
              data-testid={`button-week-${week.weekNumber}`}
            >
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">Week {week.weekNumber}</span>
                <span className="text-[9px] text-white font-bold">
                  ({format(parseISO(week.startDate), "MMM d")} - {format(parseISO(week.endDate), "MMM d")})
                </span>
              </div>
              {week.taskCount > 0 && (
                <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
                  {week.taskCount}
                </Badge>
              )}
            </Button>
          ))}
        </nav>

        <div className="mt-auto p-4 rounded-md bg-card border border-card-border">
          <div className="text-sm text-muted-foreground">This Week</div>
          <div className="text-lg font-semibold text-foreground">
            {tasks.filter(t => !t.isCompleted).length} tasks remaining
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {completedTasks.length} completed
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto flex flex-col">
        {/* Title Row */}
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Open Sans', sans-serif" }}>Bryn's Schedule</h1>
          <img src={tmuLogo} alt="Toronto Metropolitan University" className="h-14 object-contain rounded" />
        </div>
        
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))} data-testid="button-prev-week">
              <ChevronLeft className="h-5 w-5" strokeWidth={3} />
            </Button>
            <div className="flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <span className="text-xs font-bold text-[#5979CC]">Week {selectedWeek}</span>
              <span className="text-[13px] font-semibold text-foreground">{format(weekStartDate, "EEE, MMMM d")}</span>
              <span className="text-[10px] text-muted-foreground">to</span>
              <span className="text-[13px] font-semibold text-foreground">{format(weekEndDate, "EEE, MMMM d")}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedWeek(Math.min(13, selectedWeek + 1))} data-testid="button-next-week">
              <ChevronRight className="h-5 w-5" strokeWidth={3} />
            </Button>
            <Button variant="outline" size="sm" className="border border-foreground/60 font-semibold" onClick={() => setSelectedWeek(2)} data-testid="button-today">
              TODAY
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="border border-purple-500 text-purple-600 font-semibold" 
              onClick={() => syncAllCalendarMutation.mutate()}
              disabled={syncAllCalendarMutation.isPending}
              data-testid="button-sync-calendar"
            >
              {syncAllCalendarMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CalendarDays className="h-3 w-3 mr-1" />
              )}
              Sync to Google
            </Button>
            <RouterLink href="/files">
              <Button 
                variant="outline" 
                size="sm" 
                className="border border-blue-500 text-blue-600 font-semibold" 
                data-testid="button-files-link"
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Manage Files
              </Button>
            </RouterLink>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1.5">
            <Button 
              size="sm"
              className="bg-[#5979CC] hover:bg-[#4a68b3] text-white text-xs px-2 border-2 border-blue-800" 
              data-testid="button-add-module"
              onClick={() => { setNewTaskType("module"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Module
            </Button>
            <Button 
              size="sm"
              className="bg-[#5979CC] hover:bg-[#4a68b3] text-white text-xs px-2 border-2 border-blue-800" 
              data-testid="button-add-reading"
              onClick={() => { setNewTaskType("reading"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Reading
            </Button>
            <Button 
              size="sm"
              className="bg-[#5979CC] hover:bg-[#4a68b3] text-white text-xs px-2 border-2 border-blue-800" 
              data-testid="button-add-discussion"
              onClick={() => { setNewTaskType("discussion"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Discussion
            </Button>
            <Button 
              size="sm"
              className="bg-[#5979CC] hover:bg-[#4a68b3] text-white text-xs px-2 border-2 border-blue-800" 
              data-testid="button-add-assignment"
              onClick={() => { setNewTaskType("essay"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Assignment
            </Button>
            <Button 
              size="sm"
              className="bg-[#5979CC] hover:bg-[#4a68b3] text-white text-xs px-2 border-2 border-blue-800" 
              data-testid="button-add-exam"
              onClick={() => { setNewTaskType("exam"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Exam/Test
            </Button>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
              </DialogHeader>
              <TaskForm 
                weekNumber={selectedWeek}
                initialDate={selectedDate}
                initialType={newTaskType}
                onSuccess={() => setIsAddDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Weekly Time-Slot Calendar */}
        <div className="mb-6 relative" style={{ height: calendarHeight }}>
          <Card className="shadow-lg rounded-xl overflow-hidden h-full border border-black">
            <CardContent ref={calendarScrollRef} className="p-0 h-full overflow-auto">
            {/* Day Headers */}
            <div className="grid border-b border-border sticky top-0 bg-card z-10" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
              <div className="p-2"></div>
              {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                const dayName = format(day, "EEE").toUpperCase();
                const dayNum = format(day, "d");
                return (
                  <div 
                    key={idx} 
                    className={`p-2 border-l border-border flex items-center justify-center gap-1.5 ${
                      isToday ? "bg-[#5979CC]" : ""
                    }`}
                    data-testid={`day-header-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className={`text-2xl font-bold ${
                      isToday ? "text-white" : "text-foreground"
                    }`}>
                      {dayNum}
                    </div>
                    <div className={`text-xs font-medium tracking-wide ${
                      isToday ? "text-white/80" : "text-muted-foreground"
                    }`}>{dayName}</div>
                  </div>
                );
              })}
            </div>
            
            {/* ALL DAY Row - with consistent row slots for multi-day tasks */}
            <div className="border-b border-border sticky top-[52px] bg-card z-10">
              {/* Render each planning task as its own row */}
              {weekPlanningTasks.length > 0 && weekPlanningTasks.map((task, rowIdx) => {
                const colors = getCourseColor(task.courseName);
                const taskDueDate = new Date(task.dueDate);
                return (
                  <div 
                    key={`prep-row-${task.id}`}
                    className="grid" 
                    style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}
                  >
                    <div className="p-1 text-xs text-foreground font-bold tracking-wide flex items-center justify-center">
                      {rowIdx === 0 ? "ALL DAY" : ""}
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const isInPlanningPeriod = isPlanningDayForTask(task, day);
                      const isDueDay = isSameDay(day, taskDueDate);
                      const isFriday = day.getDay() === 5;
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div 
                          key={dayIdx} 
                          className={`p-0.5 border-l border-border min-h-[24px] flex items-center ${isFriday ? "bg-destructive/20" : ""} ${isToday ? "bg-blue-500/10" : ""}`}
                          data-testid={`all-day-slot-${format(day, "yyyy-MM-dd")}-${rowIdx}`}
                        >
                          {isInPlanningPeriod && (() => {
                            const dayBeforeDue = new Date(taskDueDate);
                            dayBeforeDue.setDate(dayBeforeDue.getDate() - 1);
                            const isDayBeforeDue = isSameDay(day, dayBeforeDue);
                            const borderStyle = isDayBeforeDue ? "border border-red-500" : "";
                            const startDate = new Date(task.startDate!);
                            const isFirstPrepDay = isSameDay(day, startDate);
                            return (
                              <div className="flex items-center w-full">
                                <div className={`w-1.5 h-[2px] ${!isFirstPrepDay ? (colors ? colors.dot : "bg-gray-400") : "bg-transparent"}`} />
                                <div
                                  className={`flex-1 flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate ${borderStyle} ${
                                    task.isCompleted 
                                      ? "bg-gray-200 text-gray-400 border border-gray-300" 
                                      : colors ? `${colors.prepBg} text-black border ${colors.border}` : "bg-gray-100 text-black border border-gray-400"
                                  }`}
                                  data-testid={`prep-task-${task.id}-${format(day, "yyyy-MM-dd")}`}
                                >
                                  <Checkbox
                                    checked={task.isCompleted || false}
                                    onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                    className="h-3 w-3 shrink-0"
                                    data-testid={`checkbox-prep-${task.id}`}
                                  />
                                  <span 
                                    onClick={() => setEditingTask(task)}
                                    className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                  >
                                    <span className="font-bold">PREP:</span> {task.title}
                                  </span>
                                </div>
                                <div className={`w-1.5 h-[2px] ${colors ? colors.dot : "bg-gray-400"}`} />
                              </div>
                            );
                          })()}
                          {isDueDay && (
                            <div className="flex items-center w-full">
                              <div className={`w-1.5 h-[2px] ${colors ? colors.dot : "bg-gray-400"}`} />
                              <div
                                className={`flex-1 flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate ${
                                  task.isCompleted 
                                    ? "bg-gray-200 text-gray-400 border border-gray-300" 
                                    : colors ? `${colors.bg} text-black border ${colors.border}` : "bg-gray-200 text-black border border-gray-400"
                                }`}
                                data-testid={`due-task-${task.id}-${format(day, "yyyy-MM-dd")}`}
                              >
                                <Checkbox
                                  checked={task.isCompleted || false}
                                  onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                  className="h-3 w-3 shrink-0"
                                  data-testid={`checkbox-due-${task.id}`}
                                />
                                <span 
                                  onClick={() => setEditingTask(task)}
                                  className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                >
                                  <span className="font-bold">DUE:</span> {task.title}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {/* All-day tasks row (non-planning) */}
              {weekDays.some(day => getAllDayTasks(day).length > 0 || getAllDayCalendarEvents(day).length > 0) && (
                <div className="grid" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
                  <div className="p-1 text-xs text-muted-foreground font-medium flex items-center justify-end pr-3">
                    {weekPlanningTasks.length === 0 ? "ALL DAY" : ""}
                  </div>
                  {weekDays.map((day, idx) => {
                    const allDayTasks = getAllDayTasks(day);
                    const allDayEvents = getAllDayCalendarEvents(day);
                    const isFriday = day.getDay() === 5;
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div 
                        key={idx} 
                        className={`p-0.5 border-l border-border min-h-[24px] flex flex-col gap-0.5 ${isFriday ? "bg-destructive/20" : ""} ${isToday ? "bg-blue-500/10" : ""}`}
                        data-testid={`all-day-${format(day, "yyyy-MM-dd")}`}
                      >
                        {allDayTasks.map(task => {
                          const colors = getCourseColor(task.courseName);
                          return (
                            <div
                              key={task.id}
                              className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate ${
                                task.isCompleted 
                                  ? "bg-gray-200 text-gray-400 border border-gray-300" 
                                  : colors ? `${colors.bg} text-black border ${colors.border}` : "bg-gray-200 text-black border border-gray-400"
                              }`}
                              data-testid={`all-day-task-${task.id}`}
                            >
                              <Checkbox
                                checked={task.isCompleted || false}
                                onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                className="h-3 w-3 shrink-0"
                                data-testid={`checkbox-allday-${task.id}`}
                              />
                              <span 
                                onClick={() => setEditingTask(task)}
                                className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                              >
                                {task.title}
                              </span>
                            </div>
                          );
                        })}
                        {/* All-day Google Calendar events */}
                        {allDayEvents.map(event => (
                          <a
                            key={event.id}
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate bg-purple-500/20 text-black border border-purple-500 cursor-pointer hover:opacity-80"
                            data-testid={`all-day-gcal-${event.id}`}
                          >
                            <CalendarDays className="h-3 w-3 shrink-0 text-purple-600" />
                            <span className="truncate">{event.title}</span>
                          </a>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Empty row if no tasks */}
              {weekPlanningTasks.length === 0 && !weekDays.some(day => getAllDayTasks(day).length > 0) && (
                <div className="grid" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
                  <div className="p-1 text-xs text-muted-foreground font-medium flex items-center justify-end pr-3">
                    ALL DAY
                  </div>
                  {weekDays.map((day, idx) => (
                    <div key={idx} className={`p-1 border-l border-border min-h-[24px] ${day.getDay() === 5 ? "bg-destructive/5" : ""} ${isSameDay(day, new Date()) ? "bg-blue-500/10" : ""}`} />
                  ))}
                </div>
              )}
            </div>
            
            {/* Time Slots */}
            <div>
                {timeSlots.map((hour, hourIdx) => {
                  const currentHour = new Date().getHours();
                  const isCurrentHour = hour === currentHour;
                  return (
                  <div 
                    key={hour} 
                    className={`grid border-b border-border/50 ${isCurrentHour ? "bg-blue-500/10" : ""}`}
                    style={{ gridTemplateColumns: '70px repeat(7, 1fr)', height: '44px' }}
                  >
                    <div className={`text-xs font-bold tracking-wide flex items-center justify-center ${isCurrentHour ? "bg-[#5979CC] text-white" : "text-foreground"}`}>
                      {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const hourTasks = getTasksForHour(day, hour);
                      const hourCalendarEvents = getCalendarEventsForHour(day, hour);
                      const isFriday = day.getDay() === 5;
                      const isToday = isSameDay(day, new Date());
                      const totalItems = hourTasks.length + hourCalendarEvents.length;
                      const columnWidth = totalItems > 0 ? 100 / totalItems : 100;
                      return (
                        <div 
                          key={dayIdx} 
                          className={`border-l border-border/50 relative p-0.5 ${isFriday ? "bg-destructive/20" : ""} ${isToday ? "bg-blue-500/10" : ""}`}
                          data-testid={`time-slot-${format(day, "yyyy-MM-dd")}-${hour}`}
                        >
                          {hourTasks.map((task, taskIdx) => {
                            const colors = getCourseColor(task.courseName);
                            return (
                              <div
                                key={task.id}
                                className={`absolute rounded pt-1 px-0.5 pb-2 hover:opacity-90 shadow-sm overflow-hidden ${
                                  task.isCompleted 
                                    ? "bg-gray-200 border border-gray-300" 
                                    : colors ? `${colors.bg} border ${colors.border}` : "bg-gray-200 border border-gray-400"
                                }`}
                                style={{
                                  top: '2px',
                                  left: `calc(${taskIdx * columnWidth}% + 2px)`,
                                  width: `calc(${columnWidth}% - 4px)`,
                                  height: '40px',
                                  maxHeight: '40px',
                                  zIndex: 1
                                }}
                                data-testid={`time-task-${task.id}`}
                              >
                                <div className="flex items-center gap-0.5">
                                  <Checkbox
                                    checked={task.isCompleted || false}
                                    onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                    className="h-3 w-3 shrink-0"
                                    data-testid={`checkbox-time-${task.id}`}
                                  />
                                  <div 
                                    onClick={() => setEditingTask(task)}
                                    className={`text-[8px] font-semibold truncate cursor-pointer ${
                                      task.isCompleted ? "text-gray-400 line-through" : "text-black"
                                    }`}
                                  >
                                    {task.title}
                                  </div>
                                </div>
                                <div className={`text-[8px] mt-0.5 mb-3 ml-4 ${task.isCompleted ? "text-gray-400" : "text-muted-foreground"}`}>
                                  {format(new Date(task.dueDate), "h:mm a")}
                                </div>
                              </div>
                            );
                          })}
                          {/* Google Calendar Events */}
                          {hourCalendarEvents.map((event, eventIdx) => (
                            <a
                              key={event.id}
                              href={event.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute rounded pt-1 px-0.5 pb-2 hover:opacity-90 shadow-sm overflow-hidden bg-purple-500/20 border border-purple-500 cursor-pointer"
                              style={{
                                top: '2px',
                                left: `calc(${(hourTasks.length + eventIdx) * columnWidth}% + 2px)`,
                                width: `calc(${columnWidth}% - 4px)`,
                                height: '40px',
                                maxHeight: '40px',
                                zIndex: 1
                              }}
                              data-testid={`gcal-event-${event.id}`}
                            >
                              <div className="flex items-center gap-0.5">
                                <CalendarDays className="h-3 w-3 shrink-0 text-purple-600" />
                                <div className="text-[8px] font-semibold truncate text-black">
                                  {event.title}
                                </div>
                              </div>
                              <div className="text-[8px] mt-0.5 mb-3 ml-4 text-muted-foreground">
                                {format(new Date(event.startDate), "h:mm a")}
                              </div>
                            </a>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
            </div>
          </CardContent>
          </Card>
          {/* Resize Handle */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center hover:bg-muted/50 transition-colors rounded-b-xl ${isResizing ? 'bg-primary/20' : ''}`}
            onMouseDown={handleResizeStart}
            data-testid="calendar-resize-handle"
          >
            <div className="w-16 h-1.5 rounded-full bg-muted-foreground/40" />
          </div>
        </div>

        {/* Selected Date / Week Header */}
        <div className="flex items-center justify-between mb-0">
          <div>
            <h3 className="text-lg font-semibold text-[#5979CC]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              {selectedDate 
                ? format(selectedDate, "EEEE, MMMM d, yyyy")
                : `Week ${selectedWeek} Tasks`}
            </h3>
            {selectedDate && (
              <Button variant="ghost" className="p-0 h-auto text-primary" onClick={() => setSelectedDate(null)}>
                Clear date filter
              </Button>
            )}
          </div>
        </div>

        {/* Due Today, Upcoming, and Missed Tasks Side by Side */}
        <div className="flex gap-4 mb-6 items-start">
          {/* Due Today Section */}
          <section className="w-[280px] flex-shrink-0 bg-card rounded-xl shadow-md p-4 border border-black" data-testid="section-due-today">
            <h4 className="text-md font-semibold text-orange-600 mb-0 h-8 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <Calendar className="h-4 w-4" />
              Due Today ({todayTasks.length})
            </h4>
            {isLoading ? (
              <div className="text-muted-foreground">Loading tasks...</div>
            ) : todayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tasks due today
              </div>
            ) : (
              <div className="space-y-3 -mt-8">
                {todayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-orange-100 dark:bg-orange-900/30"
                  />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Tasks Section */}
          <section className="w-[400px] flex-shrink-0 bg-card rounded-xl shadow-md p-4 border border-black" data-testid="section-upcoming">
            <h4 className="text-md font-semibold text-foreground mb-0 h-8 flex items-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Upcoming ({upcomingTasks.length})
            </h4>
            {isLoading ? (
              <div className="text-muted-foreground">Loading tasks...</div>
            ) : upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming tasks {selectedDate ? "for this date" : "for this week"}
              </div>
            ) : (
              <div className="space-y-3 -mt-8">
                {upcomingTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-yellow-50 dark:bg-yellow-900/20"
                  />
                ))}
              </div>
            )}
          </section>

          {/* Missed Tasks Section */}
          {missedTasks.length > 0 && (
            <section className="w-[280px] flex-shrink-0 bg-card rounded-xl shadow-md p-4 border border-black" data-testid="section-missed">
              <h4 className="text-md font-semibold text-destructive mb-0 h-8 flex items-center gap-2 animate-urgent-blink" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                <Clock className="h-4 w-4" />
                Missed ({missedTasks.length})
              </h4>
              <div className="space-y-3 -mt-8">
                {missedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <section>
            <h4 className="text-md font-semibold text-muted-foreground mb-3">
              Completed ({completedTasks.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                  onReschedule={() => setRescheduleTask(task)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => deleteMutation.mutate(task.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Reschedule Dialog */}
        <Dialog open={!!rescheduleTask} onOpenChange={(open) => !open && setRescheduleTask(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reschedule Task</DialogTitle>
            </DialogHeader>
            {rescheduleTask && (
              <RescheduleForm 
                task={rescheduleTask}
                onSuccess={() => setRescheduleTask(null)} 
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <TaskForm 
                task={editingTask}
                weekNumber={editingTask.weekNumber}
                onSuccess={() => setEditingTask(null)} 
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function TaskCard({
  task,
  onComplete,
  onReschedule,
  onEdit,
  onDelete,
  cardBgClass,
}: {
  task: Task;
  onComplete: (isCompleted: boolean) => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  cardBgClass?: string;
}) {
  const Icon = iconMap[task.type] || ClipboardCheck;
  const isMissed = task.isMissed && !task.isCompleted;
  
  // Get course color
  const courseCode = task.courseName?.split(" ")[0] || "";
  const colors = courseColors[courseCode];
  
  const handleExportCalendar = () => {
    window.open(`/api/tasks/${task.id}/ics`, '_blank');
  };

  const [isSendingTTS, setIsSendingTTS] = useState(false);
  const [isControlling, setIsControlling] = useState(false);
  
  const handlePlayTTS = async () => {
    setIsSendingTTS(true);
    try {
      const attachments = task.attachments || [];
      
      if (attachments.length > 0) {
        // Read PDF/file content aloud
        const mediaUrl = attachments[0];
        const response = await fetch('/api/media/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaUrl }),
        });
        
        if (!response.ok) {
          console.error('PDF TTS failed');
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsSendingTTS(false);
    }
  };

  const handleStop = async () => {
    setIsControlling(true);
    try {
      await fetch('/api/media/stop', { method: 'POST' });
    } catch (error) {
      console.error('Stop error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const handleResume = async () => {
    setIsControlling(true);
    try {
      await fetch('/api/media/resume', { method: 'POST' });
    } catch (error) {
      console.error('Resume error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const handleVolume = async (action: "up" | "down") => {
    setIsControlling(true);
    try {
      await fetch('/api/media/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch (error) {
      console.error('Volume error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  
  const handleGoogleCalendarSync = async () => {
    setIsSyncingCalendar(true);
    try {
      if (task.calendarEventId) {
        // Remove from calendar
        await fetch(`/api/tasks/${task.id}/calendar`, { method: 'DELETE' });
      } else {
        // Add to calendar
        await fetch(`/api/tasks/${task.id}/calendar`, { method: 'POST' });
      }
      // Refresh tasks to get updated calendar status
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    } catch (error) {
      console.error('Google Calendar sync error:', error);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const hasAttachments = task.attachments && task.attachments.length > 0;

  const cardElement = (
    <Card
      className={`transition-all rounded-xl shadow-md border flex-1 ${
        cardBgClass ? cardBgClass : colors ? colors.bg : ""
      } ${colors ? colors.border : "border-gray-400"} ${
        isMissed ? "border-destructive bg-destructive/5" : ""
      } ${task.isCompleted ? "opacity-60" : ""}`}
      data-testid={`card-task-${task.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-1 pt-3 px-3">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={task.isCompleted || false}
            onCheckedChange={(checked) => onComplete(!!checked)}
            data-testid={`checkbox-task-${task.id}`}
          />
          <div>
            <CardTitle className={`text-xs font-medium ${task.isCompleted ? "line-through" : ""}`}>
              {task.title}
            </CardTitle>
            {task.courseName && (
              <p className={`text-[10px] font-medium ${colors?.text || "text-muted-foreground"}`}>
                {task.courseName}
              </p>
            )}
          </div>
        </div>
        <Badge className={typeColors[task.type]}>
          <Icon className="h-3 w-3 mr-1" />
          {task.type}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3 pt-0">
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {format(new Date(task.dueDate), "MMM d, h:mm a")}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Bell className="h-3 w-3" />
          <span>Reminders: 12h, 6h, 2h, 30min before</span>
        </div>

        {task.referenceLink && (
          <div className="flex items-center gap-1 text-[10px]">
            <Link className="h-3 w-3 text-primary" />
            <a 
              href={task.referenceLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline truncate"
              data-testid={`link-reference-${task.id}`}
            >
              {task.referenceLink}
            </a>
          </div>
        )}

        {task.attachments && task.attachments.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{task.attachments.length} attachment{task.attachments.length > 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {task.attachments.map((attachment, idx) => {
                const attachmentName = attachment.split('/').pop() || attachment;
                return (
                  <div key={idx} className="flex items-center gap-1">
                    <a
                      href={attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline truncate max-w-[150px]"
                      data-testid={`link-attachment-${task.id}-${idx}`}
                    >
                      {attachmentName}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {isMissed && (
            <Button size="sm" variant="destructive" onClick={onReschedule} data-testid={`button-reschedule-${task.id}`}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Reschedule
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExportCalendar} data-testid={`button-export-${task.id}`}>
            <Download className="h-3 w-3 mr-1" />
            .ics
          </Button>
          <Button 
            size="sm" 
            variant={task.calendarEventId ? "default" : "outline"}
            onClick={handleGoogleCalendarSync}
            disabled={isSyncingCalendar}
            data-testid={`button-gcal-${task.id}`}
          >
            {isSyncingCalendar ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <CalendarDays className="h-3 w-3 mr-1" />
            )}
            {task.calendarEventId ? "On Calendar" : "Google Cal"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`button-edit-${task.id}`}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (hasAttachments) {
    return (
      <div className="relative pt-9 h-full flex flex-col">
        {/* Media Controls - positioned absolutely at top, same height as header */}
        <div className={`absolute top-0 left-0 right-0 h-8 flex items-center justify-around rounded-lg px-2 border ${colors ? `${colors.bg} ${colors.border}` : "bg-muted/50 border-muted"}`}>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handlePlayTTS}
            disabled={isSendingTTS}
            data-testid={`button-play-${task.id}`}
            title="Play"
          >
            {isSendingTTS ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleStop}
            disabled={isControlling}
            data-testid={`button-stop-${task.id}`}
            title="Stop"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleResume}
            disabled={isControlling}
            data-testid={`button-resume-${task.id}`}
            title="Resume"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleVolume("down")}
            disabled={isControlling}
            data-testid={`button-voldown-${task.id}`}
            title="Volume Down"
          >
            <MinusCircle className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleVolume("up")}
            disabled={isControlling}
            data-testid={`button-volup-${task.id}`}
            title="Volume Up"
          >
            <PlusCircle className="h-3 w-3" />
          </Button>
        </div>
        {cardElement}
      </div>
    );
  }

  // For cards without attachments, add padding to align with cards that have media controls
  return (
    <div className="pt-9 h-full flex flex-col">
      {cardElement}
    </div>
  );
}

function TaskForm({ 
  task, 
  weekNumber,
  initialDate,
  initialType,
  onSuccess 
}: { 
  task?: Task; 
  weekNumber: number;
  initialDate?: Date | null;
  initialType?: string;
  onSuccess: () => void;
}) {
  const getDefaultDate = () => {
    if (task?.dueDate) return format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm");
    if (initialDate) return format(initialDate, "yyyy-MM-dd'T'HH:mm");
    return "";
  };

  const getDefaultPrepDays = () => {
    if (task?.startDate && task?.dueDate) {
      const start = new Date(task.startDate);
      const due = new Date(task.dueDate);
      const diffTime = due.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    return 0;
  };

  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    type: task?.type || initialType || "reading",
    courseName: task?.courseName || "",
    prepDays: getDefaultPrepDays(),
    dueDate: getDefaultDate(),
    priority: task?.priority || "medium",
    weekNumber: task?.weekNumber || weekNumber,
    referenceLink: task?.referenceLink || "",
    attachments: task?.attachments || [] as string[],
  });
  const [newAttachment, setNewAttachment] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      // Add the object path to attachments
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, response.objectPath]
      }));
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Build payload explicitly
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        type: data.type,
        courseName: data.courseName,
        dueDate: new Date(data.dueDate).toISOString(),
        priority: data.priority,
        weekNumber: data.weekNumber,
        referenceLink: data.referenceLink,
        attachments: data.attachments,
      };
      // Calculate startDate from prepDays if set
      if (data.prepDays > 0) {
        const dueDate = new Date(data.dueDate);
        const startDate = new Date(dueDate);
        startDate.setDate(startDate.getDate() - data.prepDays);
        payload.startDate = startDate.toISOString();
      }
      if (task) {
        return apiRequest("PATCH", `/api/tasks/${task.id}`, payload);
      }
      return apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Assignment title"
          required
          data-testid="input-title"
        />
      </div>

      <div>
        <Label htmlFor="courseName">Course</Label>
        <Select value={formData.courseName} onValueChange={(v) => setFormData(prev => ({ ...prev, courseName: v }))}>
          <SelectTrigger data-testid="select-course">
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {COURSES.map(course => {
              const colors = courseColors[course.code];
              return (
                <SelectItem key={course.code} value={`${course.code} - ${course.name}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors?.dot}`} />
                    {course.code} - {course.name}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="type">Type</Label>
        <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
          <SelectTrigger data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPES.map(type => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="dueDate">Due Date & Time</Label>
        <Input
          id="dueDate"
          type="datetime-local"
          value={formData.dueDate}
          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
          required
          data-testid="input-duedate"
        />
      </div>

      <div>
        <Label htmlFor="prepDays">Prep Days (optional - days before due date to start)</Label>
        <Input
          id="prepDays"
          type="number"
          min="0"
          max="30"
          value={formData.prepDays}
          onChange={(e) => setFormData(prev => ({ ...prev, prepDays: parseInt(e.target.value) || 0 }))}
          placeholder="0"
          data-testid="input-prepdays"
        />
        {formData.prepDays > 0 && formData.dueDate && (
          <p className="text-xs text-muted-foreground mt-1">
            Prep starts: {format(new Date(new Date(formData.dueDate).getTime() - formData.prepDays * 24 * 60 * 60 * 1000), "MMM d, yyyy")}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
          <SelectTrigger data-testid="select-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Add notes or details..."
          data-testid="input-description"
        />
      </div>

      <div>
        <Label htmlFor="referenceLink">Reference Link (optional)</Label>
        <Input
          id="referenceLink"
          type="url"
          value={formData.referenceLink}
          onChange={(e) => setFormData(prev => ({ ...prev, referenceLink: e.target.value }))}
          placeholder="https://example.com/resource"
          data-testid="input-reference-link"
        />
      </div>

      <div>
        <Label>Attachments (optional)</Label>
        <div className="space-y-2">
          {formData.attachments.map((attachment, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <Paperclip className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <a href={attachment.startsWith('/objects/') ? attachment : attachment} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">
                {attachment.startsWith('/objects/') ? attachment.split('/').pop() : attachment}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  attachments: prev.attachments.filter((_, i) => i !== idx)
                }))}
                data-testid={`button-remove-attachment-${idx}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-file-upload"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1"
              data-testid="button-upload-file"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              value={newAttachment}
              onChange={(e) => setNewAttachment(e.target.value)}
              placeholder="Or paste URL..."
              data-testid="input-new-attachment"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (newAttachment.trim()) {
                  setFormData(prev => ({
                    ...prev,
                    attachments: [...prev.attachments, newAttachment.trim()]
                  }));
                  setNewAttachment("");
                }
              }}
              data-testid="button-add-attachment"
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-task">
          {createMutation.isPending ? "Saving..." : task ? "Update Task" : "Add Task"}
        </Button>
      </div>
    </form>
  );
}

function RescheduleForm({ 
  task, 
  onSuccess 
}: { 
  task: Task; 
  onSuccess: () => void;
}) {
  const [newDate, setNewDate] = useState("");
  const [newWeek, setNewWeek] = useState(task.weekNumber);

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/tasks/${task.id}/reschedule`, {
        dueDate: newDate,
        weekNumber: newWeek,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      onSuccess();
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reschedule "{task.title}" to a new date and week.
      </p>

      <div>
        <Label htmlFor="newDate">New Due Date & Time</Label>
        <Input
          id="newDate"
          type="datetime-local"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          required
          data-testid="input-reschedule-date"
        />
      </div>

      <div>
        <Label htmlFor="newWeek">Week Number</Label>
        <Select value={String(newWeek)} onValueChange={(v) => setNewWeek(Number(v))}>
          <SelectTrigger data-testid="select-reschedule-week">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 2).map(w => (
              <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={() => rescheduleMutation.mutate()} 
        disabled={!newDate || rescheduleMutation.isPending}
        data-testid="button-confirm-reschedule"
      >
        {rescheduleMutation.isPending ? "Saving..." : "Reschedule"}
      </Button>
    </div>
  );
}
