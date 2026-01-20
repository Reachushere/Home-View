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
  CalendarClock,
  Clock,
  Plus,
  Download,
  RefreshCw,
  Bell,
  BellOff,
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
  Trash2,
  Sun,
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
  "CFNF400": { bg: "bg-pink-500/30", border: "border-pink-500", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500", prepBg: "bg-pink-200/50", prepBorder: "border-pink-300", prepText: "text-pink-600 dark:text-pink-400" },
  "CASL101": { bg: "bg-purple-500/30", border: "border-purple-500", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500", prepBg: "bg-purple-200/50", prepBorder: "border-purple-300", prepText: "text-purple-600 dark:text-purple-400" },
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
  const [doTodayBounce, setDoTodayBounce] = useState(false);
  const todayTaskCountRef = useRef(0);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 288; // 288px = w-72
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('alarmMuteUntil');
    if (saved) {
      const muteTime = parseInt(saved, 10);
      return Date.now() < muteTime;
    }
    return false;
  });
  const [muteUntil, setMuteUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('alarmMuteUntil');
    if (saved) {
      const muteTime = parseInt(saved, 10);
      return Date.now() < muteTime ? muteTime : null;
    }
    return null;
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkedCourses, setCheckedCourses] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('checkedCourses');
    return saved ? JSON.parse(saved) : {};
  });

  const toggleCourse = (courseId: string) => {
    setCheckedCourses(prev => {
      const updated = { ...prev, [courseId]: !prev[courseId] };
      localStorage.setItem('checkedCourses', JSON.stringify(updated));
      return updated;
    });
  };

  const [courseGrades, setCourseGrades] = useState<Record<string, { grade: string; percent: string }>>(() => {
    const saved = localStorage.getItem('courseGrades');
    return saved ? JSON.parse(saved) : {};
  });

  const [openElectives, setOpenElectives] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('openElectives');
    return saved ? JSON.parse(saved) : {};
  });

  const [currentPagLevel, setCurrentPagLevel] = useState(1);

  const updateOpenElective = (id: string, value: string) => {
    setOpenElectives(prev => {
      const updated = { ...prev, [id]: value };
      localStorage.setItem('openElectives', JSON.stringify(updated));
      if (!value.trim() && checkedCourses[id]) {
        setCheckedCourses(prevChecked => {
          const updatedChecked = { ...prevChecked, [id]: false };
          localStorage.setItem('checkedCourses', JSON.stringify(updatedChecked));
          return updatedChecked;
        });
      }
      return updated;
    });
  };

  const updateGrade = (courseId: string, grade: string) => {
    setCourseGrades(prev => {
      const updated = { ...prev, [courseId]: { ...prev[courseId], grade } };
      localStorage.setItem('courseGrades', JSON.stringify(updated));
      return updated;
    });
  };

  const updatePercent = (courseId: string, percent: string) => {
    setCourseGrades(prev => {
      const updated = { ...prev, [courseId]: { ...prev[courseId], percent } };
      localStorage.setItem('courseGrades', JSON.stringify(updated));
      return updated;
    });
  };

  const gradeOptions = ['', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

  const allCoursesChecked = ['PPA101', 'PPA102', 'PPA125', 'ELECTIVE1', 'ELECTIVE2', 'LIBERAL', 'OPEN1', 'OPEN2']
    .every(id => checkedCourses[id]);

  // Create jiggle sound using Web Audio API
  const playJiggleSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      
      const now = audioContext.currentTime;
      
      // Westminster chime style - two notes
      const playChime = (freq: number, startTime: number, duration: number) => {
        const osc = audioContext.createOscillator();
        const oscGain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.connect(oscGain);
        oscGain.connect(gainNode);
        
        // Bell-like decay
        oscGain.gain.setValueAtTime(0.3, startTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      gainNode.gain.setValueAtTime(1, now);
      
      // Classic "ding-dong" two-note chime
      playChime(659, now, 0.4);        // E5 - ding
      playChime(523, now + 0.4, 0.5);  // C5 - dong
      
    } catch (e) {
      console.log('Audio not available');
    }
  }, []);

  // Speak "New Day" at midnight with a female voice
  const speakNewDay = useCallback(() => {
    try {
      const utterance = new SpeechSynthesisUtterance("New Day");
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      // Try to find a female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.name.toLowerCase().includes('female') || 
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('victoria') ||
        v.name.toLowerCase().includes('karen') ||
        v.name.toLowerCase().includes('moira') ||
        v.name.toLowerCase().includes('fiona') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.includes('Google UK English Female') ||
        v.name.includes('Google US English')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.log('Speech synthesis not available');
    }
  }, []);

  // Update clock every second and detect midnight
  const lastDateRef = useRef(new Date().getDate());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentDate = now.getDate();
      // Check if we crossed midnight (date changed)
      if (currentDate !== lastDateRef.current) {
        lastDateRef.current = currentDate;
        speakNewDay();
      }
      setCurrentTime(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [speakNewDay]);

  // Check if mute period has expired
  useEffect(() => {
    if (muteUntil && Date.now() >= muteUntil) {
      setIsMuted(false);
      setMuteUntil(null);
      localStorage.removeItem('alarmMuteUntil');
    }
    const checkInterval = setInterval(() => {
      if (muteUntil && Date.now() >= muteUntil) {
        setIsMuted(false);
        setMuteUntil(null);
        localStorage.removeItem('alarmMuteUntil');
      }
    }, 10000); // Check every 10 seconds
    return () => clearInterval(checkInterval);
  }, [muteUntil]);

  // Toggle mute for 30 minutes
  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setMuteUntil(null);
      localStorage.removeItem('alarmMuteUntil');
    } else {
      const muteTime = Date.now() + 30 * 60 * 1000; // 30 minutes
      setIsMuted(true);
      setMuteUntil(muteTime);
      localStorage.setItem('alarmMuteUntil', muteTime.toString());
    }
  }, [isMuted]);

  // Jiggle the Do Today box every 1 minute (only if there are tasks and not muted)
  useEffect(() => {
    const interval = setInterval(() => {
      if (todayTaskCountRef.current > 0 && !isMuted) {
        setDoTodayBounce(true);
        setTimeout(() => setDoTodayBounce(false), 1000);
      }
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [isMuted]);

  // Play jiggle sound every 30 minutes (only if there are tasks and not muted)
  useEffect(() => {
    const interval = setInterval(() => {
      if (todayTaskCountRef.current > 0 && !isMuted) {
        playJiggleSound();
      }
    }, 1800000); // 30 minutes
    return () => clearInterval(interval);
  }, [playJiggleSound, isMuted]);

  // Sidebar resize handlers
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar || !sidebarResizeRef.current) return;
      const delta = e.clientX - sidebarResizeRef.current.startX;
      const newWidth = Math.max(200, Math.min(600, sidebarResizeRef.current.startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingSidebar) {
        localStorage.setItem('sidebarWidth', sidebarWidth.toString());
      }
      setIsResizingSidebar(false);
      sidebarResizeRef.current = null;
    };

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, sidebarWidth]);

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

  // Sort tasks so ones with attachments come first (for media control alignment)
  const sortByAttachments = (tasks: Task[]) => {
    return [...tasks].sort((a, b) => {
      const aHasAttachments = a.attachments && a.attachments.length > 0;
      const bHasAttachments = b.attachments && b.attachments.length > 0;
      if (aHasAttachments && !bHasAttachments) return -1;
      if (!aHasAttachments && bHasAttachments) return 1;
      return 0;
    });
  };

  const missedTasks = sortByAttachments(displayTasks.filter(t => t.isMissed && !t.isCompleted));
  const today = new Date();
  // Do Today shows ALL tasks due today OR prep tasks starting today (from all tasks, not just selected week)
  const todayTasks = sortByAttachments(allTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    const isDueToday = t.dueDate && isSameDay(new Date(t.dueDate), today);
    const isPrepToday = t.startDate && isSameDay(new Date(t.startDate), today);
    return isDueToday || isPrepToday;
  }));
  
  // Update ref for jiggle effect
  todayTaskCountRef.current = todayTasks.length;
  // Upcoming shows tasks from selected week/date that are NOT due today
  const upcomingTasks = sortByAttachments(displayTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (!t.dueDate) return true;
    return !isSameDay(new Date(t.dueDate), today);
  }));
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
  
  // Auto-scroll to current hour on mount and every minute
  useEffect(() => {
    const scrollToCurrentTime = () => {
      if (calendarScrollRef.current) {
        const hourHeight = 40; // height of each time slot
        const currentHour = new Date().getHours();
        const scrollTo = currentHour * hourHeight;
        calendarScrollRef.current.scrollTop = scrollTo;
      }
    };
    
    scrollToCurrentTime();
    
    // Update scroll position every minute to keep current time at top
    const interval = setInterval(scrollToCurrentTime, 60000);
    return () => clearInterval(interval);
  }, [selectedWeek]);

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
      <aside className="bg-black text-white m-3 mr-0 rounded-xl shadow-lg p-4 pt-0 flex flex-col gap-4 overflow-auto relative" style={{ width: sidebarWidth }}>
        {/* Drag handle for resizing */}
        <div 
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-white/20 transition-colors rounded-r-xl"
          onMouseDown={handleSidebarResizeStart}
          data-testid="sidebar-resize-handle"
        />
        <div className="flex items-center gap-2 px-2 pt-3 pb-0">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-white" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            School Planner
          </h1>
        </div>

        {/* Mini Calendar */}
        <div className="px-2">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" className="h-3 w-3" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-bold bg-[#5979CC] text-white px-4 py-1.5 rounded-full" style={{ fontFamily: "'Open Sans', sans-serif" }}>{format(currentMonth, "MMMM")}</span>
            <Button variant="ghost" size="icon" className="h-3 w-3" onClick={handleNextMonth}>
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
          {weeks.map((week) => {
            const weekEndDate = parseISO(week.endDate);
            const isWeekFinished = weekEndDate < new Date();
            return (
              <Button
                key={week.weekNumber}
                variant={selectedWeek === week.weekNumber && !selectedDate ? "secondary" : "ghost"}
                className={`justify-between gap-1 h-auto py-1 px-2 ${isWeekFinished ? "opacity-60" : ""}`}
                size="sm"
                onClick={() => {
                  setSelectedWeek(week.weekNumber);
                  setSelectedDate(null);
                }}
                data-testid={`button-week-${week.weekNumber}`}
              >
                <div className={`flex items-center gap-1 ${isWeekFinished ? "line-through" : ""}`}>
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">Week {week.weekNumber}</span>
                  <span className="text-[9px] text-white font-bold">
                    ({format(parseISO(week.startDate), "MMM d")} - {format(parseISO(week.endDate), "MMM d")})
                  </span>
                </div>
                {week.taskCount > 0 && (
                  <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 min-w-5 text-center justify-center">
                    {week.taskCount}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>

        {/* PAG Level Carousel */}
        <div className="mt-auto">
          {/* Navigation with arrows and dots */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <button
              onClick={() => setCurrentPagLevel(prev => prev > 1 ? prev - 1 : 3)}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
              data-testid="button-pag-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {[1, 2, 3].map((level) => (
              <button
                key={level}
                onClick={() => setCurrentPagLevel(level)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${currentPagLevel === level ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
                data-testid={`button-pag-level-${level}`}
              />
            ))}
            <button
              onClick={() => setCurrentPagLevel(prev => prev < 3 ? prev + 1 : 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
              data-testid="button-pag-next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          
          {/* Level I */}
          <div className={`rounded-md p-2 text-[9px] ${allCoursesChecked ? 'bg-gray-300 text-gray-500' : 'bg-white text-black'} ${currentPagLevel === 1 ? '' : 'hidden'}`}>
          <div className="border-2 border-black">
            <div className="flex border-b border-black">
              <div className="font-bold px-1 py-0.5 border-r border-black w-16">LEVEL I</div>
              <div className="font-bold px-1 py-0.5 flex-1 text-center">PAG - CERTIFICATE</div>
            </div>
            <div className="flex border-b border-black">
              <div className="flex-1 px-1 py-0.5 font-bold">COURSES</div>
              <div className="w-12 px-1 py-0.5 border-l border-black font-bold text-center">Grade</div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['PPA101'] ? 'bg-gray-300 text-gray-500' : ''}`}>
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['PPA101'] || false} onChange={() => toggleCourse('PPA101')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 101</div>
              <div className="flex-1 px-1 py-0.5">Canadian Public Administration I: Institutions</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['PPA101']?.grade || ''} onChange={(e) => updateGrade('PPA101', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['PPA101']?.percent || ''} onChange={(e) => updatePercent('PPA101', e.target.value)} />
              </div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['PPA102'] ? 'bg-gray-300 text-gray-500' : ''}`}>
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['PPA102'] || false} onChange={() => toggleCourse('PPA102')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 102</div>
              <div className="flex-1 px-1 py-0.5">Canadian Public Administration II: Processes *</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['PPA102']?.grade || ''} onChange={(e) => updateGrade('PPA102', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['PPA102']?.percent || ''} onChange={(e) => updatePercent('PPA102', e.target.value)} />
              </div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['PPA125'] ? 'bg-gray-300 text-gray-500' : ''}`}>
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['PPA125'] || false} onChange={() => toggleCourse('PPA125')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 125</div>
              <div className="flex-1 px-1 py-0.5">(Formerly PPA521) Rights, Equity and the State</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['PPA125']?.grade || ''} onChange={(e) => updateGrade('PPA125', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['PPA125']?.percent || ''} onChange={(e) => updatePercent('PPA125', e.target.value)} />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black text-[8px] font-semibold">CORE ELECTIVES:</div>
              <div className="flex-1 px-1 py-0.5 text-[8px]">Select <span className="font-bold">TWO</span> from the following:</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['ELECTIVE1'] ? 'bg-gray-300 text-gray-500' : ''}`}>
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['ELECTIVE1'] || false} onChange={() => toggleCourse('ELECTIVE1')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 120</div>
              <div className="flex-1 px-1 py-0.5">Canadian Politics & Government **</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['ELECTIVE1']?.grade || ''} onChange={(e) => updateGrade('ELECTIVE1', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['ELECTIVE1']?.percent || ''} onChange={(e) => updatePercent('ELECTIVE1', e.target.value)} />
              </div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['ELECTIVE2'] ? 'bg-gray-300 text-gray-500' : ''}`}>
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['ELECTIVE2'] || false} onChange={() => toggleCourse('ELECTIVE2')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 121</div>
              <div className="flex-1 px-1 py-0.5">Ontario Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['ELECTIVE2']?.grade || ''} onChange={(e) => updateGrade('ELECTIVE2', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['ELECTIVE2']?.percent || ''} onChange={(e) => updatePercent('ELECTIVE2', e.target.value)} />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 122</div>
              <div className="flex-1 px-1 py-0.5">Local Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 124</div>
              <div className="flex-1 px-1 py-0.5">Indigenous Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="flex-1"></div>
                <div className={`flex items-center justify-center pb-1 ${checkedCourses['LIBERAL'] ? 'bg-gray-300' : ''}`}>
                  <input type="checkbox" className="checkbox-black" checked={checkedCourses['LIBERAL'] || false} disabled={!openElectives['LIBERAL']?.trim()} onChange={() => toggleCourse('LIBERAL')} />
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="px-1 pt-0.5 text-[8px]">
                  <span>LIBERAL STUDIES ELECTIVE TABLE A: <span className="font-bold">ONE</span> one-term course (LOWER LEVEL) required.</span>
                </div>
                <div className="px-1 pb-1 flex items-end">
                  <input 
                    type="text" 
                    className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['LIBERAL'] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`}
                    placeholder="Course..."
                    value={openElectives['LIBERAL'] || ''}
                    onChange={(e) => updateOpenElective('LIBERAL', e.target.value)}
                    data-testid="input-pag-liberal"
                  />
                </div>
              </div>
              <div className={`w-12 border-l border-black flex flex-col items-center justify-end gap-1.5 pb-1 ${checkedCourses['LIBERAL'] ? 'bg-gray-300' : ''}`}>
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['LIBERAL']?.grade || ''} onChange={(e) => updateGrade('LIBERAL', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['LIBERAL']?.percent || ''} onChange={(e) => updatePercent('LIBERAL', e.target.value)} />
              </div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="flex-1"></div>
                <div className={`h-[46px] flex items-start justify-center pt-2 ${checkedCourses['OPEN1'] ? 'bg-gray-300' : ''}`}>
                  <input type="checkbox" className="checkbox-black" checked={checkedCourses['OPEN1'] || false} disabled={!openElectives['OPEN1']?.trim()} onChange={() => toggleCourse('OPEN1')} />
                </div>
                <div className={`h-[26px] flex items-center justify-center ${checkedCourses['OPEN2'] ? 'bg-gray-300' : ''}`}>
                  <input type="checkbox" className="checkbox-black" checked={checkedCourses['OPEN2'] || false} disabled={!openElectives['OPEN2']?.trim()} onChange={() => toggleCourse('OPEN2')} />
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="px-1 pt-0.5 text-[8px]">
                  OPEN ELECTIVE: <span className="font-bold">TWO</span> one-term courses required - options are listed in <a href="https://www.torontomu.ca/calendar/2025-2026/open-electives/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-bold">PR Table I</a>.
                </div>
                <div className="px-1 pt-2 pb-5 flex items-end">
                  <input 
                    type="text" 
                    className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['OPEN1'] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`}
                    placeholder="Course 1..."
                    value={openElectives['OPEN1'] || ''}
                    onChange={(e) => updateOpenElective('OPEN1', e.target.value)}
                    data-testid="input-pag-open1"
                  />
                </div>
                <div className="px-1 pt-1 pb-1 flex items-end">
                  <input 
                    type="text" 
                    className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['OPEN2'] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`}
                    placeholder="Course 2..."
                    value={openElectives['OPEN2'] || ''}
                    onChange={(e) => updateOpenElective('OPEN2', e.target.value)}
                    data-testid="input-pag-open2"
                  />
                </div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="pt-5"></div>
                <div className={`flex flex-col items-center justify-center gap-0.5 py-1 ${checkedCourses['OPEN1'] ? 'bg-gray-300' : ''}`}>
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['OPEN1']?.grade || ''} onChange={(e) => updateGrade('OPEN1', e.target.value)}>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['OPEN1']?.percent || ''} onChange={(e) => updatePercent('OPEN1', e.target.value)} />
                </div>
                <div className="flex-1"></div>
                <div className={`flex flex-col items-center justify-center gap-0.5 py-1 ${checkedCourses['OPEN2'] ? 'bg-gray-300' : ''}`}>
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['OPEN2']?.grade || ''} onChange={(e) => updateGrade('OPEN2', e.target.value)}>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['OPEN2']?.percent || ''} onChange={(e) => updatePercent('OPEN2', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Level II */}
          <div className={`rounded-md p-2 text-[9px] ${allCoursesChecked ? 'bg-gray-300 text-gray-500' : 'bg-white text-black'} ${currentPagLevel === 2 ? '' : 'hidden'}`}>
          <div className="border-2 border-black">
            <div className="flex border-b border-black">
              <div className="font-bold px-1 py-0.5 border-r border-black w-16">LEVEL II</div>
              <div className="font-bold px-1 py-0.5 flex-1 text-center">PAG - DIPLOMA</div>
            </div>
            <div className="flex border-b border-black">
              <div className="flex-1 px-1 py-0.5 font-bold">COURSES</div>
              <div className="w-12 px-1 py-0.5 border-l border-black font-bold text-center">Grade</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 211</div>
              <div className="flex-1 px-1 py-0.5">Public Policy</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black text-[8px] font-semibold">CORE ELECTIVES:</div>
              <div className="flex-1 px-1 py-0.5 text-[8px]">Select <span className="font-bold">THREE</span> from the following:</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 120</div>
              <div className="flex-1 px-1 py-0.5">Canadian Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 121</div>
              <div className="flex-1 px-1 py-0.5">Ontario Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 122</div>
              <div className="flex-1 px-1 py-0.5">Local Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 124</div>
              <div className="flex-1 px-1 py-0.5">Indigenous Politics and Government</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 235</div>
              <div className="flex-1 px-1 py-0.5">Theories of the State</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 303</div>
              <div className="flex-1 px-1 py-0.5">Public Budget Policy/Politics</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 319</div>
              <div className="flex-1 px-1 py-0.5">Politics of Work and Labour</div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black"></div>
              <div className="w-14 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">LIBERAL STUDIES ELECTIVE TABLE A:</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex items-stretch">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 border-r border-black h-11 flex items-start justify-center text-[8px] text-center px-0.5">
                <span className="leading-none -mt-2"><span className="font-bold">ONE</span> one-term course (LOWER LEVEL) required.</span>
              </div>
              <div className="flex-1 h-11 px-1 flex items-center">
                <input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course..." />
              </div>
              <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="h-px bg-black"></div>
            <div className="flex items-stretch">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-7 border-b border-black"></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center border-b border-black"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-9 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-14 border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                <span className="leading-tight"><span className="font-bold">ONE</span> course required</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-7 px-1 text-[8px] leading-tight flex items-center border-b border-black"><span><b>CORE ELECTIVE: ONE</b> course required from the following:</span></div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 101 Principles of Microeconomics ** (Anti-req ECN104)</div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 104 Introductory Microeconomics ** (Anti-req ECN110)</div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 110 The Economy and Society ** (Anti-req ECN104)</div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 201 Principles of Macroeconomics ** (Anti-req ECN204)</div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 204 Introductory Macroeconomics ** (Anti-req ECN210)</div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 210 Understanding Economics ** (Anti-req ECN101,104, 201 and 204)</div>
                <div className="h-9 px-1 text-[8px] flex items-center border-b border-black">ECN 220 Evolution of the Global Economy</div>
                <div className="h-9 px-1 text-[8px] flex items-center">ECN 320 Introduction to Financial Economics</div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="h-7 border-b border-black"></div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-9 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
              </div>
            </div>
            <div className="h-px bg-black"></div>
            <div className="flex">
              <div className="w-5 border-r border-black"></div>
              <div className="w-14 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">OPEN ELECTIVE</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex items-stretch">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-14 border-r border-black h-[88px] flex items-center justify-center text-[8px] text-center px-0.5">
                <span className="leading-tight"><span className="font-bold">TWO</span> one-term courses required - options are listed in <a href="https://www.torontomu.ca/calendar/2025-2026/open-electives/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-bold">PR Table I</a>.</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 1..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 2..." /></div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Level III */}
          <div className={`rounded-md p-2 text-[9px] bg-white text-black ${currentPagLevel === 3 ? '' : 'hidden'}`}>
          <div className="border-2 border-black">
            <div className="flex border-b border-black">
              <div className="font-bold px-1 py-0.5 border-r border-black w-16">LEVEL III</div>
              <div className="font-bold px-1 py-0.5 flex-1 text-center">PAG - DEGREE</div>
            </div>
            <div className="flex border-b border-black">
              <div className="flex-1 px-1 py-0.5 font-bold">COURSES</div>
              <div className="w-12 px-1 py-0.5 border-l border-black font-bold text-center">Grade</div>
            </div>
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: '1.25rem' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '55px' }} />
                <col />
                <col style={{ width: '3rem' }} />
              </colgroup>
              <tbody>
                <tr className="border-b border-black">
                  <td className="px-0.5 py-0.5 border-r border-black text-center align-middle">
                    <input type="checkbox" className="checkbox-black" />
                  </td>
                  <td className="px-1 py-0.5 border-r border-black align-middle text-[8px]">Core Req</td>
                  <td className="px-1 py-0.5 border-r border-black align-middle text-[9px]">PPA 333</td>
                  <td className="px-1 py-0.5 align-middle text-[9px]">Research Methods in Public Administration</td>
                  <td className="border-l border-black align-middle">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                        {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                    </div>
                  </td>
                </tr>
                {[
                  { code: 'PPA 235', title: 'Theories of the State' },
                  { code: 'PPA 301', title: 'Administrative Law T' },
                  { code: 'PPA 303', title: 'Public Budget Policy/Politics' },
                  { code: 'PPA 319', title: 'Politics of Work and Labour' },
                  { code: 'PPA 335', title: 'Theories of Bureaucracy' },
                  { code: 'PPA 401', title: 'Collaborative Governance' },
                  { code: 'PPA 402', title: 'Program Planning and Evaluation' },
                  { code: 'PPA 403', title: 'e-Government' },
                  { code: 'PPA 404', title: 'Issues in Public Administration' },
                  { code: 'PPA 411', title: 'Advanced Public Policy' },
                  { code: 'PPA 414', title: 'Comparative Public Policy' },
                  { code: 'PPA 425', title: 'Intergovernmental Relations' },
                  { code: 'PPA 490', title: 'Public Admin Themes' },
                  { code: 'PPA 501', title: 'Public Sector Leadership' },
                ].map((course, idx, arr) => (
                  <tr key={course.code} className={idx < arr.length - 1 ? 'border-b border-black' : ''}>
                    {idx === 0 && (
                      <>
                        <td rowSpan={14} className="px-0.5 py-0.5 border-r border-black text-center align-middle">
                          <div className="flex flex-col gap-0">
                            {Array(14).fill(0).map((_, i) => (
                              <div key={i} className={`h-11 flex items-center justify-center ${i < 13 ? 'border-b border-black' : ''}`}>
                                <input type="checkbox" className="checkbox-black" />
                              </div>
                            ))}
                          </div>
                        </td>
                        <td rowSpan={14} className="px-1 py-0.5 border-r border-black text-[8px] align-middle">
                          <div className="font-semibold">CORE ELECTIVES:</div>
                          <div>Select <span className="font-bold">EIGHT</span> from the following:</div>
                        </td>
                      </>
                    )}
                    <td className={`h-11 px-1 py-0.5 border-r border-black align-middle text-[9px]`}>{course.code}</td>
                    <td className={`h-11 px-1 py-0.5 align-middle text-[9px]`}>{course.title}</td>
                    <td className="border-l border-black align-middle">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                          {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="h-px bg-black"></div>
            <div className="flex">
              <div className="w-5 border-r border-black"></div>
              <div className="w-[55px] border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">CORE REQUIRED:</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center">
                Select&nbsp;<span className="font-bold">ONE</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center text-[9px]">PPA 50A/B (Formerly PPA030) ***Practicum1</div>
                <div className="h-11 px-1 flex items-center text-[9px]">Course Base Option: Need 3 RG2 CORE ELECTIVE and 6 OE</div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
              </div>
            </div>
            <div className="h-px bg-black"></div>
            <div className="flex">
              <div className="w-5 border-r border-black"></div>
              <div className="w-[55px] border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">CORE ELECTIVE</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                <div className="leading-tight">Select <span className="font-bold">THREE</span><br/>courses not<br/>previously<br/>taken:</div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center text-[9px]">Any POG – 300 or 400 level courses</div>
                <div className="h-11 px-1 flex items-center text-[9px]">Any POG – 300 or 400 level courses</div>
                <div className="h-11 px-1 flex items-center text-[9px]">Any POG – 300 or 400 level courses</div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
              </div>
            </div>
            <div className="h-px bg-black"></div>
            <div className="flex">
              <div className="w-5 border-r border-black"></div>
              <div className="w-[55px] border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">LIBERAL STUDIES ELECTIVE TABLE A / B:</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                <div className="leading-tight"><span className="font-bold">FOUR</span> COURSES REQUIRED,<br/><br/><span className="font-bold">ONE</span> one-term LOWER LEVEL (TABLE A)<br/><br/>and <span className="font-bold">THREE</span> one-term UPPER LEVEL courses (TABLE B).</div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 1..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 2..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 3..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 4..." /></div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
              </div>
            </div>
            <div className="h-px bg-black"></div>
            <div className="flex">
              <div className="w-5 border-r border-black"></div>
              <div className="w-[55px] border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">OPEN ELECTIVE:</div>
              <div className="w-12 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                <div className="leading-tight"><span className="font-bold">SIX</span> one-term level courses required from <a href="https://www.torontomu.ca/calendar/2025-2026/open-electives/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OE Table</a>.</div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 1..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 2..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 3..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 4..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 5..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 6..." /></div>
              </div>
              <div className="w-12 border-l border-black flex flex-col">
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
                <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto flex flex-col">
        {/* Title Row - aligned with sidebar header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className={`!h-6 !w-6 !min-h-0 p-0 bg-[#5979CC] hover:bg-[#4a68b3] border-[1.75px] border-blue-800 text-white ${isMuted ? "!bg-red-500 hover:!bg-red-600 !border-red-500" : ""}`}
                data-testid="button-mute-toggle"
                title={isMuted ? `Muted for ${Math.ceil((muteUntil! - Date.now()) / 60000)} min` : "Mute for 30 min"}
              >
                {isMuted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              </Button>
              <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Open Sans', sans-serif" }}>Bryn's Schedule</h1>
            </div>
          </div>
          
          {/* Rainbow Digital Clock */}
          <div className="bg-black px-2 py-0.5 rounded-md" data-testid="digital-clock">
            <span 
              className="text-sm font-bold font-mono tracking-wider bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #6366f1, #a855f7)" }}
            >
              {format(currentTime, "hh:mm:ss")}
            </span>
            <span className="text-sm font-bold font-mono tracking-wider text-white ml-1">
              {format(currentTime, "a")}
            </span>
          </div>
          
          <img src={tmuLogo} alt="Toronto Metropolitan University" className="h-14 object-contain rounded" />
        </div>
        
        {/* Calendar Header */}
        <div className="flex items-center mb-2">
          {/* Week navigation */}
          <Button variant="ghost" size="icon" className="h-3 w-3" onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" strokeWidth={3} />
          </Button>
          <div className="flex items-center gap-1.5 mx-3" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            <div className="flex flex-col items-center">
              {selectedWeek === 2 ? (
                <span className="text-[8px] text-muted-foreground uppercase tracking-wide">(this)</span>
              ) : (
                <span 
                  className="text-[8px] text-blue-500 uppercase tracking-wide cursor-pointer hover:underline"
                  onClick={() => setSelectedWeek(2)}
                  data-testid="link-current-week"
                >
                  (this)
                </span>
              )}
              <span className="text-[15px] font-bold text-[#5979CC]">Week {selectedWeek}</span>
            </div>
            <span className="text-[15px] font-semibold text-foreground">{format(weekStartDate, "EEE, MMMM d")}</span>
            <span className="text-xs text-muted-foreground">to</span>
            <span className="text-[15px] font-semibold text-foreground">{format(weekEndDate, "EEE, MMMM d")}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-3 w-3" onClick={() => setSelectedWeek(Math.min(13, selectedWeek + 1))} data-testid="button-next-week">
            <ChevronRight className="h-4 w-4" strokeWidth={3} />
          </Button>
          {/* All buttons with equal spacing */}
          <div className="flex-1 flex items-center justify-between gap-2 ml-2">
            <Button size="sm" className="h-6 w-[98px] text-[10px] bg-white hover:bg-gray-50 border-[1.75px] border-blue-800 font-semibold text-blue-800" onClick={() => setSelectedWeek(2)} data-testid="button-today">
              TODAY
            </Button>
            <Button 
              size="sm" 
              className="h-6 w-[98px] text-[10px] bg-white hover:bg-gray-50 border-[1.75px] border-blue-800 font-semibold text-blue-800" 
              onClick={() => syncAllCalendarMutation.mutate()}
              disabled={syncAllCalendarMutation.isPending}
              data-testid="button-sync-calendar"
            >
              {syncAllCalendarMutation.isPending ? (
                <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
              ) : (
                <CalendarDays className="h-2.5 w-2.5 mr-0.5" />
              )}
              Sync
            </Button>
            <RouterLink href="/files">
              <Button 
                size="sm" 
                className="h-6 w-[98px] text-[10px] bg-white hover:bg-gray-50 border-[1.75px] border-blue-800 font-semibold text-blue-800" 
                data-testid="button-files-link"
              >
                <FolderOpen className="h-2.5 w-2.5 mr-0.5" />
                Files
              </Button>
            </RouterLink>
            <Button 
              size="sm"
              className="h-6 w-[98px] bg-[#5979CC] hover:bg-[#4a68b3] text-[#ffffff] text-[10px] border-[1.75px] border-blue-800" 
              data-testid="button-add-module"
              onClick={() => { setNewTaskType("module"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-2.5 w-2.5" />
              Module
            </Button>
            <Button 
              size="sm"
              className="h-6 w-[98px] bg-[#5979CC] hover:bg-[#4a68b3] text-[#ffffff] text-[10px] border-[1.75px] border-blue-800" 
              data-testid="button-add-reading"
              onClick={() => { setNewTaskType("reading"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-2.5 w-2.5" />
              Reading
            </Button>
            <Button 
              size="sm"
              className="h-6 w-[98px] bg-[#5979CC] hover:bg-[#4a68b3] text-[#ffffff] text-[10px] border-[1.75px] border-blue-800" 
              data-testid="button-add-discussion"
              onClick={() => { setNewTaskType("discussion"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-2.5 w-2.5" />
              Discuss
            </Button>
            <Button 
              size="sm"
              className="h-6 w-[98px] bg-[#5979CC] hover:bg-[#4a68b3] text-[#ffffff] text-[10px] border-[1.75px] border-blue-800" 
              data-testid="button-add-assignment"
              onClick={() => { setNewTaskType("essay"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-2.5 w-2.5" />
              Assign
            </Button>
            <Button 
              size="sm"
              className="h-6 w-[98px] bg-[#5979CC] hover:bg-[#4a68b3] text-[#ffffff] text-[10px] border-[1.75px] border-blue-800" 
              data-testid="button-add-exam"
              onClick={() => { setNewTaskType("exam"); setIsAddDialogOpen(true); }}
            >
              <Plus className="h-2.5 w-2.5" />
              Exam
            </Button>
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
        <div className="mb-3 relative" style={{ height: calendarHeight }}>
          <Card className="shadow-lg rounded-xl overflow-hidden h-full border-[1.75px] border-blue-800">
            <CardContent ref={calendarScrollRef} className="p-0 h-full overflow-auto">
            {/* Day Headers */}
            <div className="grid border-b border-border sticky top-0 bg-card z-10 h-[52px]" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
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
            
            {/* ALL DAY Row - consolidated single row for all planning tasks */}
            <div className="border-b border-border sticky top-[52px] bg-gray-200 dark:bg-gray-700 z-10">
              {/* Single row for all planning tasks */}
              {weekPlanningTasks.length > 0 && (
                <div className="grid" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
                  <div className="p-1 text-xs text-foreground font-bold tracking-wide flex items-center justify-center bg-white dark:bg-card min-h-[40px]">
                    ALL DAY
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const tasksForDay = weekPlanningTasks.filter(task => {
                      const isInPlanningPeriod = isPlanningDayForTask(task, day);
                      const isDueDay = isSameDay(new Date(task.dueDate), day);
                      return isInPlanningPeriod || isDueDay;
                    });
                    return (
                      <div 
                        key={dayIdx} 
                        className="p-0.5 border-l border-border min-h-[40px] flex flex-col gap-0.5"
                        data-testid={`all-day-slot-${format(day, "yyyy-MM-dd")}`}
                      >
                        {tasksForDay.map(task => {
                          const colors = getCourseColor(task.courseName);
                          const taskDueDate = new Date(task.dueDate);
                          const isInPlanningPeriod = isPlanningDayForTask(task, day);
                          const isDueDay = isSameDay(taskDueDate, day);
                          const dayBeforeDue = new Date(taskDueDate);
                          dayBeforeDue.setDate(dayBeforeDue.getDate() - 1);
                          const isDayBeforeDue = isSameDay(day, dayBeforeDue);
                          const borderStyle = isDayBeforeDue && isInPlanningPeriod ? "border border-red-500" : "";
                          
                          if (isInPlanningPeriod && !isDueDay) {
                            return (
                              <div
                                key={`prep-${task.id}`}
                                className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate ${borderStyle} ${
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
                            );
                          }
                          if (isDueDay) {
                            return (
                              <div
                                key={`due-${task.id}`}
                                className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate ${
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
                            );
                          }
                          return null;
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* All-day tasks row (non-planning) */}
              {weekDays.some(day => getAllDayTasks(day).length > 0 || getAllDayCalendarEvents(day).length > 0) && (
                <div className="grid" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
                  <div className="p-1 text-xs text-muted-foreground font-medium flex items-center justify-end pr-3 bg-white dark:bg-card min-h-[40px]">
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
                        className="p-0.5 border-l border-border min-h-[40px] flex flex-col gap-0.5"
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
                            className="flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate bg-gray-200 dark:bg-gray-700 text-black dark:text-white border border-gray-500 cursor-pointer hover:opacity-80"
                            data-testid={`all-day-gcal-${event.id}`}
                          >
                            <CalendarDays className="h-3 w-3 shrink-0 text-gray-600 dark:text-gray-300" />
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
                  <div className="p-1 text-xs text-muted-foreground font-medium flex items-center justify-end pr-3 bg-white dark:bg-card min-h-[40px]">
                    ALL DAY
                  </div>
                  {weekDays.map((day, idx) => (
                    <div key={idx} className="p-1 border-l border-border min-h-[40px]" />
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
                              className="absolute rounded pt-1 px-0.5 pb-2 hover:opacity-90 shadow-sm overflow-hidden bg-gray-200 dark:bg-gray-700 border border-gray-500 cursor-pointer"
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
                                <CalendarDays className="h-3 w-3 shrink-0 text-gray-600 dark:text-gray-300" />
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
            className={`absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center hover:bg-muted/50 transition-colors ${isResizing ? 'bg-primary/20' : ''}`}
            onMouseDown={handleResizeStart}
            data-testid="calendar-resize-handle"
          >
            <div className="w-16 h-1.5 rounded-full bg-muted-foreground/40" />
          </div>
        </div>
        {/* Do Today, Missed, and Upcoming Tasks Side by Side */}
        <div className="flex gap-4 mb-3 items-stretch h-[200px] flex-shrink-0">
          {/* Do Today Section */}
          <section className={`w-[240px] flex-shrink-0 bg-orange-300/60 dark:bg-orange-800/50 rounded-xl shadow-md pt-1.5 px-3 pb-3 border-[1.75px] border-blue-800 overflow-auto ${doTodayBounce && todayTasks.length > 0 ? 'animate-gentle-bounce' : ''}`} data-testid="section-due-today">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <Calendar className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-black dark:text-white">Do Today</span> <span className="text-yellow-500">(Urgent)</span> <span className="text-black dark:text-white">({todayTasks.length})</span>
            </h4>
            {isLoading ? (
              <div className="text-muted-foreground text-xs">Loading...</div>
            ) : todayTasks.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No tasks for today
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 pt-5">
                {todayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-orange-50 dark:bg-orange-900/20"
                    compact
                  />
                ))}
              </div>
            )}
          </section>

          {/* Missed Tasks Section */}
          <section className={`w-[240px] flex-shrink-0 bg-red-400/70 dark:bg-red-800/50 rounded-xl shadow-md pt-1.5 px-3 pb-3 border-[1.75px] border-blue-800 overflow-auto ${missedTasks.length === 0 ? "" : ""}`} data-testid="section-missed">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <Clock className="h-3.5 w-3.5 text-destructive" />
              <span className="text-black dark:text-white">Missed</span> <span className="text-destructive">(Overdue)</span> <span className="text-black dark:text-white">({missedTasks.length})</span>
            </h4>
            {missedTasks.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No missed tasks
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 pt-5">
                {missedTasks.map((task) => (
                  <div key={task.id} className="animate-urgent-blink">
                    <TaskCard
                      task={task}
                      onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                      onReschedule={() => setRescheduleTask(task)}
                      onEdit={() => setEditingTask(task)}
                      onDelete={() => deleteMutation.mutate(task.id)}
                      cardBgClass="bg-orange-50 dark:bg-orange-900/20"
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Tasks Section */}
          <section className="flex-1 bg-yellow-200/60 dark:bg-yellow-800/40 rounded-xl shadow-md pt-1.5 px-3 pb-3 border-[1.75px] border-blue-800 overflow-auto" data-testid="section-upcoming">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <Clock className="h-3.5 w-3.5" style={{ color: '#ffff00' }} />
              <span className="text-black dark:text-white">Upcoming</span> <span style={{ color: '#ffff00' }}>(Be Prepared)</span> <span className="text-black dark:text-white">({upcomingTasks.length})</span>
            </h4>
            {isLoading ? (
              <div className="text-muted-foreground text-xs">Loading...</div>
            ) : upcomingTasks.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No upcoming tasks {selectedDate ? "for this date" : "for this week"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-5">
                {upcomingTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-orange-50 dark:bg-orange-900/20"
                    compact
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* To Do Section - Random tasks */}
        <div className="mb-3 flex-shrink-0">
          <section className="bg-green-200/70 dark:bg-green-900/35 rounded-xl shadow-md p-3 border-[1.75px] border-blue-800 h-[210px]" data-testid="section-todo">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-green-600" />
              <span className="text-black dark:text-white">To Do</span>
            </h4>
            <div className="grid grid-cols-4 gap-4 h-[calc(100%-32px)]">
              <div className="flex flex-col gap-1.5 overflow-auto">
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
              </div>
              <div className="flex flex-col gap-1.5 overflow-auto">
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
              </div>
              <div className="flex flex-col gap-1.5 overflow-auto">
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
              </div>
              <div className="flex flex-col gap-1.5 overflow-auto">
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
                <div className="flex items-center gap-1.5"><input type="checkbox" className="checkbox-black" /><input type="text" className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" placeholder="Task..." /></div>
              </div>
            </div>
          </section>
        </div>

        {/* Completed Tasks by Course */}
        <div className="flex gap-4 items-stretch h-[180px] flex-shrink-0">
          {/* CPPA122 Completed */}
          <section className="flex-1 bg-blue-100 dark:bg-blue-900/30 rounded-xl shadow-md p-3 border-[1.75px] border-blue-800 overflow-auto" data-testid="section-completed-cppa122">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-blue-600">Completed - CPPA122</span> <span className="text-black dark:text-white">({completedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length})</span>
            </h4>
            {completedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No completed tasks
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 pt-5">
                {completedTasks.filter(t => t.courseName?.startsWith("CPPA122")).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-green-50 dark:bg-green-900/20"
                    compact
                  />
                ))}
              </div>
            )}
          </section>

          {/* CFNF400 Completed */}
          <section className="flex-1 bg-pink-100 dark:bg-pink-900/30 rounded-xl shadow-md p-3 border-[1.75px] border-blue-800 overflow-auto" data-testid="section-completed-cfnf400">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-pink-600" />
              <span className="text-pink-600">Completed - CFNF400</span> <span className="text-black dark:text-white">({completedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length})</span>
            </h4>
            {completedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No completed tasks
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 pt-5">
                {completedTasks.filter(t => t.courseName?.startsWith("CFNF400")).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-pink-50 dark:bg-pink-900/20"
                    compact
                  />
                ))}
              </div>
            )}
          </section>

          {/* CASL101 Completed */}
          <section className="flex-1 bg-purple-100 dark:bg-purple-900/30 rounded-xl shadow-md p-3 border-[1.75px] border-blue-800 overflow-auto" data-testid="section-completed-casl101">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-purple-600">Completed - CASL101</span> <span className="text-black dark:text-white">({completedTasks.filter(t => t.courseName?.startsWith("CASL101")).length})</span>
            </h4>
            {completedTasks.filter(t => t.courseName?.startsWith("CASL101")).length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No completed tasks
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 pt-5">
                {completedTasks.filter(t => t.courseName?.startsWith("CASL101")).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                    onReschedule={() => setRescheduleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    cardBgClass="bg-purple-50 dark:bg-purple-900/20"
                    compact
                  />
                ))}
              </div>
            )}
          </section>
        </div>

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
            <DialogHeader className="flex flex-row items-center justify-between gap-2">
              <DialogTitle>Edit Task</DialogTitle>
              {editingTask && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this task?")) {
                      deleteMutation.mutate(editingTask.id);
                      setEditingTask(null);
                    }
                  }}
                  data-testid="button-delete-task-dialog"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
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
  compact = false,
}: {
  task: Task;
  onComplete: (isCompleted: boolean) => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  cardBgClass?: string;
  compact?: boolean;
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
      className={`transition-all rounded-xl shadow-sm border ${
        compact ? "h-[60px] flex flex-col" : "flex-1"
      } ${cardBgClass ? cardBgClass : colors ? colors.bg : ""} ${
        colors ? colors.border : "border-gray-400"
      } ${isMissed && !cardBgClass ? "border-destructive bg-destructive/5" : ""} ${
        task.isCompleted ? "opacity-60" : ""
      }`}
      data-testid={`card-task-${task.id}`}
    >
      <CardHeader className={`flex flex-row items-start justify-between gap-1 space-y-0 ${compact ? "pb-0 pt-1.5 px-2 flex-shrink-0" : "pb-1 pt-3 px-3"}`}>
        <div className="flex items-start gap-1.5">
          <Checkbox
            checked={task.isCompleted || false}
            onCheckedChange={(checked) => onComplete(!!checked)}
            data-testid={`checkbox-task-${task.id}`}
            className={compact ? "h-3.5 w-3.5" : ""}
          />
          <div>
            <CardTitle className={`font-medium ${task.isCompleted ? "line-through" : ""} ${compact ? "text-[10px] leading-tight line-clamp-1" : "text-xs"}`}>
              {task.title}
            </CardTitle>
            {task.courseName && (
              <p className={`font-medium ${colors?.text || "text-muted-foreground"} ${compact ? "text-[8px]" : "text-[10px]"}`}>
                {task.courseName.split(" - ")[0]}
              </p>
            )}
          </div>
        </div>
        <Badge className={`${typeColors[task.type]} ${compact ? "text-[7px] px-1 py-0 flex-shrink-0" : ""}`}>
          <Icon className={compact ? "h-2 w-2 mr-0.5" : "h-3 w-3 mr-1"} />
          {task.type}
        </Badge>
      </CardHeader>
      <CardContent className={`space-y-1 ${compact ? "px-2 pb-1 pt-0 mt-auto" : "px-3 pb-3 pt-0"}`}>
        {!compact && task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        
        {compact ? (
          <div className="flex items-center gap-1 text-black dark:text-white text-[10px] justify-end">
            <Clock className="h-2.5 w-2.5" />
            <span className="font-bold">DUE</span> {format(new Date(task.dueDate), "MMM d")}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
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
                className={task.calendarEventId ? "bg-[#5979CC] hover:bg-[#4a68b3]" : ""}
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
          </>
        )}
      </CardContent>
    </Card>
  );

  // For compact mode with attachments, add media controls
  if (compact) {
    if (hasAttachments) {
      return (
        <div className="relative pt-1 h-full flex flex-col cursor-pointer" onClick={onEdit}>
          {/* Mini Media Controls for compact cards */}
          <div className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-around rounded-xl px-1 bg-[#5979CC] text-white border-[1.75px] border-blue-800">
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handlePlayTTS(); }}
              data-testid={`button-play-${task.id}`}
              title="Play"
            >
              {isSendingTTS ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3 fill-current" />
              )}
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleStop(); }}
              data-testid={`button-stop-${task.id}`}
              title="Stop"
            >
              <Square className="h-3 w-3 fill-current" />
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleResume(); }}
              data-testid={`button-resume-${task.id}`}
              title="Resume"
            >
              <RefreshCw className="h-3 w-3" />
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleVolume("down"); }}
              data-testid={`button-voldown-${task.id}`}
              title="Volume Down"
            >
              <MinusCircle className="h-3 w-3" />
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleVolume("up"); }}
              data-testid={`button-volup-${task.id}`}
              title="Volume Up"
            >
              <PlusCircle className="h-3 w-3" />
            </div>
          </div>
          {cardElement}
        </div>
      );
    }
    // Compact without attachments - add pt-1 to align with cards that have media controls
    return (
      <div className="pt-1 cursor-pointer" onClick={onEdit}>
        {cardElement}
      </div>
    );
  }

  if (hasAttachments) {
    return (
      <div className="relative pt-1 h-full flex flex-col">
        {/* Media Controls - positioned absolutely at top, half height */}
        <div className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-around rounded-xl px-1 bg-[#5979CC] text-white border-[1.75px] border-blue-800">
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={handlePlayTTS}
            data-testid={`button-play-${task.id}`}
            title="Play"
          >
            {isSendingTTS ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={handleStop}
            data-testid={`button-stop-${task.id}`}
            title="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={handleResume}
            data-testid={`button-resume-${task.id}`}
            title="Resume"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={() => handleVolume("down")}
            data-testid={`button-voldown-${task.id}`}
            title="Volume Down"
          >
            <MinusCircle className="h-3.5 w-3.5" />
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={() => handleVolume("up")}
            data-testid={`button-volup-${task.id}`}
            title="Volume Up"
          >
            <PlusCircle className="h-3.5 w-3.5" />
          </div>
        </div>
        {cardElement}
      </div>
    );
  }

  // For cards without attachments, add padding to align with cards that have media controls
  return (
    <div className="pt-5 h-full flex flex-col">
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
    if (initialDate) {
      // Set default time to 9 AM if the initialDate is at midnight
      const date = new Date(initialDate);
      if (date.getHours() === 0 && date.getMinutes() === 0) {
        date.setHours(9, 0, 0, 0);
      }
      return format(date, "yyyy-MM-dd'T'HH:mm");
    }
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
      } else {
        // Clear startDate if prepDays is 0
        payload.startDate = null;
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
