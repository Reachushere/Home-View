import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import tmuLogo from "@assets/Chang-School_1768803262583.png";
import unicalLogo from "@assets/ChatGPT_Image_Jan_22,_2026,_02_34_52_PM_1769110943463.png";
import campusBg from "@assets/TMU_1769151150961.jpg";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
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
  Home,
  Repeat2,
  Settings,
  Timer,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Gauge,
  Menu,
  User,
  Palette,
  ExternalLink,
} from "lucide-react";
import { Link as RouterLink, useLocation } from "wouter";
import type { Task, SemesterSettings } from "@shared/schema";
import { TASK_TYPES, COURSES, getWeekNumber, REMINDER_OPTIONS, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2, REPEAT_TYPES, REPEAT_INTERVAL_UNITS, LAST_WEEK } from "@shared/schema";
import { format, addDays, subDays, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays, isBefore } from "date-fns";

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
  "CPPA122": { bg: "bg-green-100 dark:bg-green-900/40", border: "border-green-500", text: "text-green-700 dark:text-green-300", dot: "bg-green-500", prepBg: "bg-green-200/50", prepBorder: "border-green-300", prepText: "text-green-600 dark:text-green-400" },
  "CFNF400": { bg: "bg-pink-100 dark:bg-pink-900/40", border: "border-pink-500", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500", prepBg: "bg-pink-200/50", prepBorder: "border-pink-300", prepText: "text-pink-600 dark:text-pink-400" },
  "CASL101": { bg: "bg-indigo-100 dark:bg-indigo-900/40", border: "border-indigo-500", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", prepBg: "bg-indigo-200/50", prepBorder: "border-indigo-300", prepText: "text-indigo-600 dark:text-indigo-400" },
};

// Course folder configuration for sidebar hamburger menus
const SIDEBAR_COURSES = [
  { id: "cppa122", name: "CPPA122", color: "text-green-500", hoverBg: "hover:bg-green-500/20" },
  { id: "cfnf400", name: "CFNF400", color: "text-pink-500", hoverBg: "hover:bg-pink-500/20" },
  { id: "casl101", name: "CASL101", color: "text-indigo-500", hoverBg: "hover:bg-indigo-500/20" },
];

const FOLDER_TYPES = [
  { id: "module", name: "Module" },
  { id: "reading", name: "Reading" },
];

// Speakers list for media controls
const SPEAKERS = [
  { id: "browser_tts", name: "🔊 Browser (This Device)" },
  { id: "media_player.byhome", name: "Apartment" },
  { id: "media_player.cat_wr", name: "Cat Washroom Speakers" },
  { id: "media_player.echo_cat_left_am", name: "Cat Washroom Left" },
  { id: "media_player.echo_cat_right_am", name: "Cat Washroom Right" },
  { id: "media_player.echo_cat_washroom_middle", name: "Cat Washroom Middle" },
  { id: "media_player.echo_closet_am", name: "Closet" },
  { id: "media_player.echo_lr_couch_r_am", name: "Hallway Corner" },
  { id: "media_player.echo_hallway_entrance_am", name: "Hallway Entrance" },
  { id: "media_player.echo_king_l_am", name: "King Left" },
  { id: "media_player.echo_king_r_am", name: "King Right" },
  { id: "media_player.echo_king_tv_am", name: "King TV" },
  { id: "media_player.echo_kitchen_cupboards_left_am", name: "Kitchen Cupboards Left" },
  { id: "media_player.echo_kitchen_cupboards_r_am", name: "Kitchen Cupboards Right" },
  { id: "media_player.echo_kitchen_fridge_am", name: "Kitchen Fridge" },
  { id: "media_player.echo_kitchen_hutch_am", name: "Kitchen Hutch" },
  { id: "media_player.echo_kitchen_island_corner_am", name: "Kitchen Island Corner" },
  { id: "media_player.echo_kitchen_studio_black_am", name: "Kitchen Studio Black" },
  { id: "media_player.echo_lr_couch_l_am", name: "Living Room Couch Left" },
  { id: "media_player.echo_lr_hub_am", name: "Living Room Hub" },
  { id: "media_player.echo_lr_studio_white_am", name: "Living Room Studio White" },
  { id: "media_player.echo_lr_tv_shelf_am", name: "Living Room TV Shelf" },
  { id: "media_player.echo_queen_balcony_am", name: "Queen Balcony" },
  { id: "media_player.echo_queen_bed_l_am", name: "Queen Bed Left" },
  { id: "media_player.echo_queen_bed_r_am", name: "Queen Bed Right" },
  { id: "media_player.echo_show_pug_am", name: "Echo Show Pug" },
  { id: "media_player.everywhere_2", name: "Everywhere" },
  { id: "media_player.hallway", name: "Hallway" },
  { id: "media_player.king_bedroom", name: "King Bedroom" },
  { id: "media_player.queen_bedroom", name: "Queen Bedroom" },
];

interface WeekInfo {
  weekNumber: number;
  startDate: string;
  endDate: string;
  taskCount: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<number>(2);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 0, 17)); // January 2026
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTaskType, setNewTaskType] = useState<string>("module");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [isTodayExpanded, setIsTodayExpanded] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState(465);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [doTodayBounce, setDoTodayBounce] = useState(false);
  const todayTaskCountRef = useRef(0);

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
  const [isWeeklyFilesFlyoutOpen, setIsWeeklyFilesFlyoutOpen] = useState(true);
  
  // Calculate if it's nighttime in Toronto based on approximate sunrise/sunset
  const isNighttime = useMemo(() => {
    // Get current time in Toronto timezone
    const torontoTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    const hours = torontoTime.getHours();
    const minutes = torontoTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // Approximate sunrise/sunset times for Toronto (varies by season)
    // Winter: sunrise ~7:45am, sunset ~5:00pm
    // Summer: sunrise ~5:30am, sunset ~9:00pm
    // We'll interpolate based on day of year
    const dayOfYear = Math.floor((torontoTime.getTime() - new Date(torontoTime.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    
    // Sine wave approximation for seasonal variation
    // Peak daylight around day 172 (June 21), shortest around day 355 (Dec 21)
    const seasonalFactor = Math.sin((dayOfYear - 80) * 2 * Math.PI / 365);
    
    // Sunrise: ranges from 5:30am (330 min) in summer to 7:45am (465 min) in winter
    const sunriseMinutes = Math.round(397 - seasonalFactor * 67);
    
    // Sunset: ranges from 5:00pm (1020 min) in winter to 9:00pm (1260 min) in summer
    const sunsetMinutes = Math.round(1140 + seasonalFactor * 120);
    
    return currentMinutes < sunriseMinutes || currentMinutes > sunsetMinutes;
  }, [currentTime]);
  const [checkedCourses, setCheckedCourses] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('checkedCourses');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Profile state
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [customBackground, setCustomBackground] = useState<string | null>(() => {
    return localStorage.getItem('customBackground');
  });
  const [profileData, setProfileData] = useState<{ firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null }>(() => {
    const saved = localStorage.getItem('profileData');
    return saved ? JSON.parse(saved) : { firstName: 'Bryn', lastName: '', birthdate: '', timezone: 'America/Toronto', travelTimezone: null };
  });
  const [schoolData, setSchoolData] = useState<{ schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string }>(() => {
    const saved = localStorage.getItem('schoolData');
    return saved ? JSON.parse(saved) : { schoolLogo: null, numberOfWeeks: 13, week1StartDate: '2026-01-17', firstDayOfWeek: 'saturday' };
  });
  
  const [coursesData, setCoursesData] = useState<{ courses: Array<{ name: string; color: string; professor: string }> }>(() => {
    const saved = localStorage.getItem('coursesData');
    const defaultCourses = [
      { name: 'CPPA122 - Local Politics', color: '#22c55e', professor: 'Caryl Arundel' },
      { name: 'CFNF400 - Human Sexuality', color: '#ec4899', professor: 'Alex McKay' },
      { name: 'CASL101 - American Sign Language', color: '#6366f1', professor: 'Christina Moreau' },
      { name: '', color: '#6b7280', professor: '' },
      { name: '', color: '#6b7280', professor: '' },
      { name: '', color: '#6b7280', professor: '' },
      { name: '', color: '#6b7280', professor: '' },
      { name: '', color: '#6b7280', professor: '' },
      { name: '', color: '#6b7280', professor: '' },
      { name: '', color: '#6b7280', professor: '' },
    ];
    if (saved) {
      const parsed = JSON.parse(saved);
      // If saved data has no courses with names, use defaults instead
      const hasNamedCourses = parsed.courses?.some((c: { name: string }) => c.name.trim());
      if (hasNamedCourses) {
        // Ensure professor field exists for each course
        const coursesWithProfessor = parsed.courses.map((c: { name: string; color: string; professor?: string }, i: number) => ({
          ...c,
          professor: c.professor ?? defaultCourses[i]?.professor ?? ''
        }));
        return { courses: coursesWithProfessor };
      }
      return { courses: defaultCourses };
    }
    return { courses: defaultCourses };
  });
  const [isCoursesDialogOpen, setIsCoursesDialogOpen] = useState(false);
  
  // Get the display timezone (travel if set, otherwise home)
  const displayTimezone = profileData.travelTimezone || profileData.timezone;

  const toggleCourse = (courseId: string) => {
    setCheckedCourses(prev => {
      const updated = { ...prev, [courseId]: !prev[courseId] };
      localStorage.setItem('checkedCourses', JSON.stringify(updated));
      return updated;
    });
  };
  
  const saveProfile = (data: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null }) => {
    setProfileData(data);
    localStorage.setItem('profileData', JSON.stringify(data));
    setIsProfileDialogOpen(false);
    toast({ title: "Profile saved", description: "Your profile has been updated." });
  };
  
  const saveSchool = (data: { schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string }) => {
    setSchoolData(data);
    localStorage.setItem('schoolData', JSON.stringify(data));
    setIsSchoolDialogOpen(false);
    toast({ title: "School settings saved", description: "Your school settings have been updated." });
  };
  
  const saveCourses = (data: { courses: Array<{ name: string; color: string; professor: string }> }) => {
    setCoursesData(data);
    localStorage.setItem('coursesData', JSON.stringify(data));
    setIsCoursesDialogOpen(false);
    toast({ title: "Courses saved", description: "Your courses have been updated." });
  };
  
  // TTS settings for word highlighting synchronization
  const [ttsSettings, setTtsSettings] = useState<{
    startDelay: number; // seconds before TTS starts speaking
    wordsPerMinute: number; // speech rate in words per minute
    useSmartTiming: boolean; // adjust timing based on word length
  }>(() => {
    const saved = localStorage.getItem('ttsSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      startDelay: 27, // 27 seconds default delay
      wordsPerMinute: 120, // 120 WPM default (2 words per second)
      useSmartTiming: true, // enabled by default
    };
  });
  
  const saveTtsSettings = (settings: typeof ttsSettings) => {
    setTtsSettings(settings);
    localStorage.setItem('ttsSettings', JSON.stringify(settings));
    toast({ title: "TTS settings saved", description: "Your text-to-speech highlighting settings have been updated." });
  };
  
  const getCourseColor = (courseName: string): string => {
    const course = coursesData.courses.find(c => c.name && courseName.includes(c.name.split(' - ')[0]));
    return course?.color || '#6b7280';
  };
  
  // Common timezones
  const timezones = [
    // North America
    { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
    { value: 'America/New_York', label: 'Eastern Time (New York)' },
    { value: 'America/Chicago', label: 'Central Time (Chicago)' },
    { value: 'America/Denver', label: 'Mountain Time (Denver)' },
    { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
    { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
    { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
    // Central/South America
    { value: 'America/Mexico_City', label: 'Mexico City' },
    { value: 'America/Bogota', label: 'Bogota' },
    { value: 'America/Lima', label: 'Lima' },
    { value: 'America/Sao_Paulo', label: 'São Paulo' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
    // Europe
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Dublin', label: 'Dublin' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam' },
    { value: 'Europe/Rome', label: 'Rome' },
    { value: 'Europe/Madrid', label: 'Madrid' },
    { value: 'Europe/Zurich', label: 'Zurich' },
    { value: 'Europe/Stockholm', label: 'Stockholm' },
    { value: 'Europe/Vienna', label: 'Vienna' },
    { value: 'Europe/Prague', label: 'Prague' },
    { value: 'Europe/Warsaw', label: 'Warsaw' },
    { value: 'Europe/Athens', label: 'Athens' },
    { value: 'Europe/Istanbul', label: 'Istanbul' },
    { value: 'Europe/Moscow', label: 'Moscow' },
    // Middle East & Africa
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Jerusalem', label: 'Jerusalem' },
    { value: 'Africa/Cairo', label: 'Cairo' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg' },
    { value: 'Africa/Lagos', label: 'Lagos' },
    // Asia
    { value: 'Asia/Kolkata', label: 'India (Mumbai/Delhi)' },
    { value: 'Asia/Bangkok', label: 'Bangkok' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Taipei', label: 'Taipei' },
    { value: 'Asia/Seoul', label: 'Seoul' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    // Oceania
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
    { value: 'Pacific/Fiji', label: 'Fiji' },
  ];

  const [courseGrades, setCourseGrades] = useState<Record<string, { grade: string; percent: string }>>(() => {
    const saved = localStorage.getItem('courseGrades');
    return saved ? JSON.parse(saved) : {};
  });

  const [openElectives, setOpenElectives] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('openElectives');
    return saved ? JSON.parse(saved) : {};
  });

  const [currentPagLevel, setCurrentPagLevel] = useState(1);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  
  // Pomodoro Timer State
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 minutes in seconds
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<"work" | "shortBreak" | "longBreak">("work");
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const pomodoroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keyboard delete handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTaskId !== null) {
        // Don't delete if user is typing in an input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        deleteMutation.mutate(selectedTaskId);
        setSelectedTaskId(null);
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedTaskId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId]);

  // Pomodoro Timer Effect
  useEffect(() => {
    if (pomodoroRunning && pomodoroTime > 0) {
      pomodoroIntervalRef.current = setInterval(() => {
        setPomodoroTime(prev => prev - 1);
      }, 1000);
    } else if (pomodoroTime === 0 && pomodoroRunning) {
      setPomodoroRunning(false);
      // Play notification sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telehs');
      audio.play().catch(() => {});
      
      if (pomodoroMode === "work") {
        const newCount = pomodoroCount + 1;
        setPomodoroCount(newCount);
        toast({ title: "Pomodoro Complete!", description: newCount % 4 === 0 ? "Time for a long break!" : "Time for a short break!" });
        if (newCount % 4 === 0) {
          setPomodoroMode("longBreak");
          setPomodoroTime(15 * 60);
        } else {
          setPomodoroMode("shortBreak");
          setPomodoroTime(5 * 60);
        }
      } else {
        toast({ title: "Break Over!", description: "Time to focus!" });
        setPomodoroMode("work");
        setPomodoroTime(25 * 60);
      }
    }
    return () => {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
    };
  }, [pomodoroRunning, pomodoroTime, pomodoroMode, pomodoroCount, toast]);

  const formatPomodoroTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePomodoro = () => {
    setPomodoroRunning(!pomodoroRunning);
  };

  const resetPomodoro = () => {
    setPomodoroRunning(false);
    if (pomodoroMode === "work") setPomodoroTime(25 * 60);
    else if (pomodoroMode === "shortBreak") setPomodoroTime(5 * 60);
    else setPomodoroTime(15 * 60);
  };

  const skipPomodoro = () => {
    setPomodoroRunning(false);
    if (pomodoroMode === "work") {
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);
      if (newCount % 4 === 0) {
        setPomodoroMode("longBreak");
        setPomodoroTime(15 * 60);
      } else {
        setPomodoroMode("shortBreak");
        setPomodoroTime(5 * 60);
      }
    } else {
      setPomodoroMode("work");
      setPomodoroTime(25 * 60);
    }
  };

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

  // Automatically set selectedWeek based on today's date
  useEffect(() => {
    if (weeks.length > 0) {
      const today = new Date();
      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const currentWeek = weeks.find(w => {
        const start = parseISO(w.startDate);
        const end = parseISO(w.endDate);
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return todayDateOnly >= startDateOnly && todayDateOnly <= endDateOnly;
      });
      if (currentWeek) {
        setSelectedWeek(currentWeek.weekNumber);
      }
    }
  }, [weeks]);

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

  // Files for weekly files flyout
  interface WeeklyFile {
    id: number;
    originalName: string;
    displayName: string;
    objectPath: string;
    contentType: string;
    size: number;
    folder: string | null;
  }
  
  const { data: weeklyFiles = [] } = useQuery<WeeklyFile[]>({
    queryKey: ["/api/files"],
  });
  
  // Filter files for the current week
  const currentWeekFiles = weeklyFiles.filter(f => 
    f.folder?.startsWith(`week-${selectedWeek}`) || f.folder === `week-${selectedWeek}`
  );

  // Semester settings query
  const { data: semesterSettings } = useQuery<SemesterSettings | null>({
    queryKey: ["/api/semester"],
    queryFn: () => fetch("/api/semester").then(r => r.json()),
  });

  // Deleted folders query for hamburger menu filtering
  const { data: deletedFoldersData = [] } = useQuery<{ id: number; folderId: string }[]>({
    queryKey: ["/api/deleted-folders"],
  });
  const deletedFolderIds = new Set(deletedFoldersData.map(f => f.folderId));

  // Files query for hamburger menu
  interface FileItem {
    id: number;
    originalName: string;
    displayName: string;
    objectPath: string;
    folder: string | null;
  }
  const { data: allFiles = [] } = useQuery<FileItem[]>({
    queryKey: ["/api/files"],
  });

  // File preview dialog state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewSpeaker, setPreviewSpeaker] = useState<string>("media_player.echo_cat_left_am");
  const [previewText, setPreviewText] = useState<string>("");
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [syncHighlight, setSyncHighlight] = useState(true); // Sync text highlighting with TTS
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(""); // Voice name
  const [playStartTime, setPlayStartTime] = useState<number | null>(null);
  
  // Load available TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Filter to English voices and sort by name
        const englishVoices = voices.filter(v => v.lang.startsWith('en')).sort((a, b) => a.name.localeCompare(b.name));
        setAvailableVoices(englishVoices.length > 0 ? englishVoices : voices);
        // Set default voice
        if (!selectedVoice) {
          const defaultVoice = englishVoices.find(v => v.name.includes('Microsoft') && v.name.includes('Natural'))
            || englishVoices.find(v => v.name.includes('Female'))
            || englishVoices[0];
          if (defaultVoice) setSelectedVoice(defaultVoice.name);
        }
      }
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  const highlightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  
  // PDF viewer state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageWordBoundaries, setPageWordBoundaries] = useState<number[]>([]); // Word index where each page starts
  
  // Calculate which PDF page a word index belongs to
  const getPageForWordIndex = (wordIndex: number): number => {
    if (pageWordBoundaries.length === 0) return 1;
    for (let i = pageWordBoundaries.length - 1; i >= 0; i--) {
      if (wordIndex >= pageWordBoundaries[i]) {
        return i + 1;
      }
    }
    return 1;
  };
  
  // Calculate page boundaries when text is loaded
  useEffect(() => {
    if (previewText) {
      // Split by the special page marker inserted by server during PDF extraction
      const PAGE_MARKER = '---PAGE---';
      const pages = previewText.split(PAGE_MARKER);
      const boundaries: number[] = [];
      let wordCount = 0;
      
      for (const page of pages) {
        boundaries.push(wordCount);
        // Count words excluding the page marker
        const words = page.split(/\s+/).filter(w => w.length > 0 && w !== PAGE_MARKER);
        wordCount += words.length;
      }
      
      setPageWordBoundaries(boundaries);
      console.log("Page boundaries calculated:", boundaries);
    }
  }, [previewText]);
  
  // Sync PDF page with current word during playback
  useEffect(() => {
    if (isPlaying && syncHighlight && pageWordBoundaries.length > 0) {
      const newPage = getPageForWordIndex(currentWordIndex);
      if (newPage !== currentPdfPage && newPage >= 1 && newPage <= (numPages || 1)) {
        setCurrentPdfPage(newPage);
      }
    }
  }, [currentWordIndex, isPlaying, syncHighlight, pageWordBoundaries, numPages]);
  
  // Load PDF when file is selected
  useEffect(() => {
    if (previewFile && previewFile.objectPath) {
      // Create blob URL for PDF
      fetch(`/api/files/${previewFile.id}/download`)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        })
        .catch(err => console.error('Error loading PDF:', err));
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    };
  }, [previewFile?.id]);

  // Fetch text when file is selected for preview
  useEffect(() => {
    if (previewFile) {
      setIsLoadingText(true);
      setPreviewText("");
      setCurrentWordIndex(0);
      setIsPlaying(false);
      fetch(`/api/files/${previewFile.id}/text`)
        .then(res => res.json())
        .then(data => {
          if (data.text) {
            setPreviewText(data.text);
          }
        })
        .catch(err => console.error("Error fetching text:", err))
        .finally(() => setIsLoadingText(false));
    } else {
      setPreviewText("");
      setCurrentWordIndex(0);
      setIsPlaying(false);
      if (highlightIntervalRef.current) {
        clearInterval(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
    }
  }, [previewFile]);

  // Cleanup interval and timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightIntervalRef.current) {
        clearInterval(highlightIntervalRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Word highlighting animation with smart timing based on word length
  // Uses ttsSettings for configurable delay and speech rate
  
  // Calculate word duration based on length (longer words take longer to say)
  const getWordDuration = (word: string, baseMs: number): number => {
    if (!ttsSettings.useSmartTiming) return baseMs;
    
    // Count syllables approximately (vowel groups)
    const syllables = word.toLowerCase().replace(/[^aeiouy]/g, '').replace(/[aeiouy]+/g, 'x').length || 1;
    // Longer words with more syllables take longer
    // Average English word has ~1.5 syllables, so adjust based on that
    const syllableFactor = Math.max(0.6, Math.min(2.0, syllables / 1.5));
    
    // Also consider word length (numbers, punctuation affect timing)
    const lengthFactor = Math.max(0.7, Math.min(1.5, word.length / 5));
    
    // Combine factors with base timing
    return Math.round(baseMs * (syllableFactor * 0.7 + lengthFactor * 0.3));
  };

  const startHighlighting = () => {
    const words = previewText.split(/\s+/).filter(w => w.length > 0 && w !== '---PAGE---');
    if (words.length === 0) return;
    
    setPlayStartTime(Date.now());
    setIsPlaying(true);
    isPlayingRef.current = true;
    setCurrentWordIndex(-1); // Start at -1 to wait for delay
    
    if (highlightIntervalRef.current) {
      clearInterval(highlightIntervalRef.current);
    }
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    // Calculate base milliseconds per word from WPM setting
    const baseMs = 60000 / ttsSettings.wordsPerMinute;
    const startDelayMs = ttsSettings.startDelay * 1000;
    
    // Wait for TTS to actually start speaking before highlighting
    highlightTimeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) return; // Stopped during delay
      setCurrentWordIndex(0);
      
      // Use recursive setTimeout instead of setInterval for variable timing
      const scheduleNextWord = (currentIdx: number) => {
        if (!isPlayingRef.current) return;
        if (currentIdx >= words.length - 1) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
        
        const currentWord = words[currentIdx];
        const duration = getWordDuration(currentWord, baseMs);
        
        highlightTimeoutRef.current = setTimeout(() => {
          if (!isPlayingRef.current) return;
          const nextIdx = currentIdx + 1;
          setCurrentWordIndex(nextIdx);
          scheduleNextWord(nextIdx);
        }, duration);
      };
      
      scheduleNextWord(0);
    }, startDelayMs);
  };

  const stopHighlighting = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (highlightIntervalRef.current) {
      clearInterval(highlightIntervalRef.current);
      highlightIntervalRef.current = null;
    }
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  // Media control functions for file preview
  // Browser TTS ref
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [browserTtsRate, setBrowserTtsRate] = useState(0.9); // 90% speed
  
  const handlePlayFile = async (fileUrl: string, fileName: string) => {
    try {
      // Check if using browser TTS only
      if (previewSpeaker === "browser_tts") {
        if (!previewText) {
          toast({ title: "No text content available", variant: "destructive" });
          return;
        }
        
        // Cancel any existing speech
        window.speechSynthesis.cancel();
        
        // Remove page markers from text for TTS (they're only for page sync)
        const cleanTextForTts = previewText.replace(/---PAGE---/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanTextForTts);
        utterance.rate = browserTtsRate;
        utterance.pitch = 1;
        
        // Use selected voice or find a good default
        const voices = window.speechSynthesis.getVoices();
        const voice = selectedVoice 
          ? voices.find(v => v.name === selectedVoice)
          : voices.find(v => v.name.includes('Microsoft') && v.name.includes('Natural')) 
            || voices.find(v => v.lang.startsWith('en'))
            || voices[0];
        if (voice) utterance.voice = voice;
        
        // Track word position for highlighting
        let wordIndex = 0;
        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            setCurrentWordIndex(wordIndex);
            wordIndex++;
          }
        };
        
        utterance.onend = () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentWordIndex(0);
        };
        
        utterance.onerror = () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
        };
        
        speechUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        
        setIsPlaying(true);
        isPlayingRef.current = true;
        toast({ title: `Reading aloud: ${fileName}` });
        return;
      }
      
      // Use Home Assistant for Echo speaker audio (no word-level sync available)
      const response = await fetch("/api/media/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: fileUrl, entityId: previewSpeaker }),
      });
      if (response.ok) {
        const speakerName = SPEAKERS.find(s => s.id === previewSpeaker)?.name || previewSpeaker;
        toast({ title: `Playing on ${speakerName}: ${fileName}` });
        // Use estimated highlighting for Echo speakers
        startHighlighting();
      } else {
        toast({ title: "Failed to play file", variant: "destructive" });
      }
    } catch (error) {
      console.error("Play error:", error);
      toast({ title: "Failed to play file", variant: "destructive" });
    }
  };

  const handleStopMedia = async () => {
    try {
      // Stop browser TTS if active
      if (previewSpeaker === "browser_tts") {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        isPlayingRef.current = false;
        setCurrentWordIndex(0);
        return;
      }
      
      await fetch("/api/media/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: previewSpeaker }),
      });
      // Stop word highlighting when audio stops
      stopHighlighting();
    } catch (error) {
      console.error("Stop error:", error);
    }
  };

  // Skip forward/back functions for browser TTS
  const handleSkipForward = () => {
    if (!previewText || previewSpeaker !== "browser_tts") return;
    
    const words = previewText.split(/\s+/).filter(w => w.length > 0 && w !== '---PAGE---');
    const skipAmount = 20; // Skip 20 words forward
    const newIndex = Math.min(currentWordIndex + skipAmount, words.length - 1);
    
    // Cancel current speech and restart from new position
    window.speechSynthesis.cancel();
    setCurrentWordIndex(newIndex);
    
    // Sync PDF page to the new position
    const newPage = getPageForWordIndex(newIndex);
    if (newPage !== currentPdfPage && newPage <= (numPages || 1)) {
      setCurrentPdfPage(newPage);
    }
    
    if (isPlaying) {
      // Resume from new position
      const remainingText = words.slice(newIndex).join(' ');
      const utterance = new SpeechSynthesisUtterance(remainingText);
      utterance.rate = browserTtsRate;
      utterance.pitch = 1;
      
      // Use selected voice
      const voices = window.speechSynthesis.getVoices();
      const voice = selectedVoice ? voices.find(v => v.name === selectedVoice) : voices[0];
      if (voice) utterance.voice = voice;
      
      let localWordIdx = 0;
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          setCurrentWordIndex(newIndex + localWordIdx);
          localWordIdx++;
        }
      };
      
      utterance.onend = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      };
      
      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSkipBack = () => {
    if (!previewText || previewSpeaker !== "browser_tts") return;
    
    const words = previewText.split(/\s+/).filter(w => w.length > 0 && w !== '---PAGE---');
    const skipAmount = 20; // Skip 20 words back
    const newIndex = Math.max(currentWordIndex - skipAmount, 0);
    
    // Cancel current speech and restart from new position
    window.speechSynthesis.cancel();
    setCurrentWordIndex(newIndex);
    
    // Sync PDF page to the new position
    const newPage = getPageForWordIndex(newIndex);
    if (newPage !== currentPdfPage && newPage >= 1) {
      setCurrentPdfPage(newPage);
    }
    
    if (isPlaying) {
      // Resume from new position
      const remainingText = words.slice(newIndex).join(' ');
      const utterance = new SpeechSynthesisUtterance(remainingText);
      utterance.rate = browserTtsRate;
      utterance.pitch = 1;
      
      // Use selected voice
      const voices = window.speechSynthesis.getVoices();
      const voice = selectedVoice ? voices.find(v => v.name === selectedVoice) : voices[0];
      if (voice) utterance.voice = voice;
      
      let localWordIdx = 0;
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          setCurrentWordIndex(newIndex + localWordIdx);
          localWordIdx++;
        }
      };
      
      utterance.onend = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      };
      
      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVolumeChange = async (action: "up" | "down") => {
    try {
      // Adjust browser TTS rate if using browser
      if (previewSpeaker === "browser_tts") {
        setBrowserTtsRate(prev => {
          const newRate = action === "up" ? Math.min(prev + 0.1, 2) : Math.max(prev - 0.1, 0.5);
          toast({ title: `Speech rate: ${Math.round(newRate * 100)}%` });
          return newRate;
        });
        return;
      }
      
      await fetch("/api/media/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entityId: previewSpeaker }),
      });
    } catch (error) {
      console.error("Volume error:", error);
    }
  };

  // State for new semester dialog
  const [isNewSemesterDialogOpen, setIsNewSemesterDialogOpen] = useState(false);
  const [newSemesterForm, setNewSemesterForm] = useState({
    semesterName: "Spring/Summer 2026 Semester",
    semesterStartDate: "2026-05-02",
    course1Code: "",
    course1Name: "",
    course1Professor: "",
    course2Code: "",
    course2Name: "",
    course2Professor: "",
    course3Code: "",
    course3Name: "",
    course3Professor: "",
    secondaryCalendarId: "",
  });
  
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [selectedSecondaryCalendar, setSelectedSecondaryCalendar] = useState<string>("");
  
  // Fetch available Google calendars
  const { data: availableCalendars } = useQuery<{ id: string; summary: string; primary: boolean }[]>({
    queryKey: ['/api/calendar/list'],
  });

  // Get the current semester name from settings or use default
  const currentSemesterName = semesterSettings?.semesterName || "Winter 2026 Semester";
  
  // Initialize secondary calendar from semester settings
  useEffect(() => {
    if (semesterSettings?.secondaryCalendarId) {
      setSelectedSecondaryCalendar(semesterSettings.secondaryCalendarId);
    }
  }, [semesterSettings?.secondaryCalendarId]);
  
  // Mutation to update secondary calendar
  const updateSecondaryCalendarMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      return apiRequest("PATCH", "/api/semester-settings/calendar", { secondaryCalendarId: calendarId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-settings"] });
      toast({
        title: "Calendar Updated",
        description: "Secondary calendar has been configured.",
      });
    },
  });
  
  // Second Google Account status and mutation
  const { data: secondAccountStatus, refetch: refetchSecondAccount } = useQuery<{ connected: boolean; email?: string }>({
    queryKey: ['/api/google/second-account/status'],
  });
  
  // Listen for OAuth callback message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SECOND_ACCOUNT_CONNECTED') {
        refetchSecondAccount();
        queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
        toast({
          title: "Second Account Connected",
          description: `Connected to ${event.data.email}`,
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetchSecondAccount, queryClient, toast]);
  
  const disconnectSecondAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/google/second-account");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/second-account/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: "Account Disconnected",
        description: "Second Google account has been disconnected.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: "Failed to disconnect second account",
        variant: "destructive",
      });
    },
  });

  // Check if we're past Week 13 end date - show new semester prompt
  const week13EndDate = weeks.find(w => w.weekNumber === LAST_WEEK)?.endDate;
  const isPastSemester = week13EndDate ? new Date() > new Date(week13EndDate) : false;

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

  // Mutation for updating task time when dragged to new slot
  const updateTaskTimeMutation = useMutation({
    mutationFn: async ({ id, newDate, newHour }: { id: number; newDate: Date; newHour: number }) => {
      const updatedDueDate = new Date(newDate);
      updatedDueDate.setHours(newHour, 0, 0, 0);
      return apiRequest("PATCH", `/api/tasks/${id}`, { 
        dueDate: updatedDueDate.toISOString(),
        eventStartTime: `${newHour.toString().padStart(2, '0')}:00`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  // Mutation for creating new semester
  const createSemesterMutation = useMutation({
    mutationFn: async (data: typeof newSemesterForm) => {
      return apiRequest("POST", "/api/semester", {
        semesterStartDate: new Date(data.semesterStartDate).toISOString(),
        course1Code: data.course1Code,
        course1Name: data.course1Name,
        course1Professor: data.course1Professor || null,
        course2Code: data.course2Code,
        course2Name: data.course2Name,
        course2Professor: data.course2Professor || null,
        course3Code: data.course3Code,
        course3Name: data.course3Name,
        course3Professor: data.course3Professor || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      setIsNewSemesterDialogOpen(false);
    },
  });

  // File upload hook for drag and drop
  const { uploadFile: uploadDroppedFile } = useUpload({
    onSuccess: () => {},
  });

  // Mutation for creating task from dropped file
  const createTaskFromFileMutation = useMutation({
    mutationFn: async ({ day, hour, attachmentPath, fileName }: { day: Date; hour: number; attachmentPath: string; fileName: string }) => {
      const dueDate = new Date(day);
      dueDate.setHours(hour, 0, 0, 0);
      const weekNum = getWeekNumber(dueDate);
      return apiRequest("POST", "/api/tasks", {
        title: fileName,
        type: "reading",
        dueDate: dueDate.toISOString(),
        eventStartTime: `${hour.toString().padStart(2, '0')}:00`,
        weekNumber: Math.max(2, Math.min(13, weekNum)),
        attachments: [attachmentPath],
        priority: "medium",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  // Mark file as completed (listened) and move to completed folder
  const markFileCompletedMutation = useMutation({
    mutationFn: async ({ fileId }: { fileId: number }) => {
      return apiRequest("PATCH", `/api/files/${fileId}`, { 
        listened: true, 
        folder: "completed" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setPreviewFile(null);
      toast({ title: "File marked as completed and moved to Completed folder" });
    },
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id.toString());
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    // Allow both move (for tasks) and copy (for files)
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('Files') ? 'copy' : 'move';
    setDragOverSlot({ day, hour });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    
    // Check if files are being dropped from external app
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      try {
        // Upload the file
        const response = await uploadDroppedFile(file);
        if (response?.objectPath) {
          // Create a task with the file attached
          createTaskFromFileMutation.mutate({
            day,
            hour,
            attachmentPath: response.objectPath,
            fileName: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension for title
          });
        }
      } catch (error) {
        console.error('Failed to upload dropped file:', error);
      }
    } else if (draggedTask) {
      // Moving an existing task
      updateTaskTimeMutation.mutate({ id: draggedTask.id, newDate: day, newHour: hour });
    }
    
    setDraggedTask(null);
    setDragOverSlot(null);
  };

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

  const missedTasks = sortByAttachments(allTasks.filter(t => t.isMissed && !t.isCompleted));
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
  // Be Prepared shows only prep tasks for the selected week that are not yet due
  // Each task appears only once
  const upcomingTasks = sortByAttachments(displayTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    const dueDate = new Date(t.dueDate);
    // Must be a future task (not due today or in the past)
    if (dueDate <= today) return false;
    return true;
  }));
  const completedTasks = displayTasks.filter(t => t.isCompleted);
  
  // Calculate shared row heights for consistent sizing between Urgent and Overdue boxes
  const cppa122Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CPPA122")).length, missedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length) * 64;
  const cfnf400Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CFNF400")).length, missedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length) * 64;
  const casl101Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CASL101")).length, missedTasks.filter(t => t.courseName?.startsWith("CASL101")).length) * 64;

  // Weekly view - get the current selected week's days
  const selectedWeekInfo = weeks.find(w => w.weekNumber === selectedWeek);
  const weekStartDate = selectedWeekInfo ? parseISO(selectedWeekInfo.startDate) : new Date(2026, 0, 17);
  const weekEndDate = selectedWeekInfo ? parseISO(selectedWeekInfo.endDate) : new Date(2026, 0, 23);
  
  // Generate weekdays for the weekly view - reorder so Sunday is first and Saturday is last
  const rawWeekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });
  // Move Saturday (first day) to the end so order is Sun-Sat
  const weekDays = rawWeekDays.length === 7 ? [...rawWeekDays.slice(1), rawWeekDays[0]] : rawWeekDays;
  
  // Time slots for the day view (7am-11pm)
  const timeSlots = Array.from({ length: 17 }, (_, i) => i + 7); // 7am-11pm
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to show first task of today, or first upcoming task
  useEffect(() => {
    // Only scroll when we have tasks loaded
    if (allTasks.length === 0 || calendarView !== "week") return;
    
    const scrollToRelevantPosition = () => {
      if (!calendarScrollRef.current) return;
      
      const today = startOfDay(new Date());
      const now = new Date();
      const weekInfo = weeks.find(w => w.weekNumber === selectedWeek);
      if (!weekInfo) return;
      
      const weekStart = new Date(weekInfo.startDate);
      const weekEnd = new Date(weekInfo.endDate);
      
      // First priority: tasks due today
      const tasksDueToday = allTasks.filter(t => {
        if (t.isCompleted) return false;
        const dueDate = new Date(t.dueDate);
        return isSameDay(dueDate, today) && dueDate >= weekStart && dueDate <= weekEnd;
      });
      
      // Second priority: first upcoming task in the selected week (after now)
      const upcomingTasksInWeek = allTasks.filter(t => {
        if (t.isCompleted) return false;
        const dueDate = new Date(t.dueDate);
        return dueDate > now && dueDate >= weekStart && dueDate <= weekEnd;
      }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      
      const hourHeight = 44; // height of each time slot
      const startHour = 7; // calendar starts at 7am
      
      // Find which tasks to scroll to
      let targetTasks = tasksDueToday.length > 0 ? tasksDueToday : upcomingTasksInWeek;
      
      if (targetTasks.length > 0) {
        // Find the earliest hour among target tasks
        const earliestHour = Math.min(...targetTasks.map(t => {
          const dueDate = new Date(t.dueDate);
          // If it's midnight (ALL DAY), return start hour
          if (dueDate.getHours() === 0 && dueDate.getMinutes() === 0) return startHour;
          return dueDate.getHours();
        }));
        // Scroll to show that hour
        const scrollTo = Math.max(0, (earliestHour - startHour) * hourHeight);
        calendarScrollRef.current.scrollTop = scrollTo;
      } else {
        // No tasks in week, scroll to current hour (clamped to start at 7am)
        const currentHour = Math.max(startHour, new Date().getHours());
        const scrollTo = (currentHour - startHour) * hourHeight;
        calendarScrollRef.current.scrollTop = scrollTo;
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToRelevantPosition);
    });
    
    // Update scroll position every minute
    const interval = setInterval(scrollToRelevantPosition, 60000);
    return () => clearInterval(interval);
  }, [selectedWeek, allTasks, calendarView, weeks]);

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
      if (t.isCompleted) return false; // Completed tasks don't show on calendar
      if (t.startDate) return false; // Tasks with planning periods show in ALL DAY row
      const dueDate = new Date(t.dueDate);
      if (!isSameDay(dueDate, day)) return false;
      
      // Use eventStartTime if set, otherwise use dueDate hour
      if (t.eventStartTime) {
        const [startHour] = t.eventStartTime.split(':').map(Number);
        return startHour === hour;
      }
      return dueDate.getHours() === hour;
    });
  };
  
  // Check if a calendar event conflicts with any task
  const eventConflictsWithTask = (event: CalendarEvent) => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    
    return allTasks.some(task => {
      const taskDue = new Date(task.dueDate);
      
      // For all-day events, check if any task is due on that day
      if (event.isAllDay) {
        return isSameDay(eventStart, taskDue);
      }
      
      // For timed events, check time overlap
      // If task has eventStartTime and eventEndTime, use those
      if (task.eventStartTime && task.eventEndTime) {
        const taskStart = new Date(task.eventStartTime);
        const taskEnd = new Date(task.eventEndTime);
        // Check for overlap: event starts before task ends AND event ends after task starts
        return eventStart < taskEnd && eventEnd > taskStart;
      }
      
      // For tasks without specific times, check if event is on same day at same hour
      if (isSameDay(eventStart, taskDue)) {
        const taskHour = taskDue.getHours();
        const eventHour = eventStart.getHours();
        // Consider conflict if within same hour or adjacent hours
        return Math.abs(taskHour - eventHour) <= 1;
      }
      
      return false;
    });
  };

  // Get Google Calendar events for a specific hour on a day (only conflicting events)
  const getCalendarEventsForHour = (day: Date, hour: number) => {
    const now = new Date();
    return calendarEvents.filter(e => {
      if (e.isAllDay) return false;
      const eventDate = new Date(e.startDate);
      const eventEndDate = new Date(e.endDate);
      // Hide events that have already ended
      if (eventEndDate < now) return false;
      // Only show events that conflict with tasks
      if (!eventConflictsWithTask(e)) return false;
      return isSameDay(eventDate, day) && eventDate.getHours() === hour;
    });
  };
  
  // Get all-day Google Calendar events for a day (only conflicting events)
  const getAllDayCalendarEvents = (day: Date) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return calendarEvents.filter(e => {
      if (!e.isAllDay) return false;
      const eventDate = new Date(e.startDate);
      // Hide all-day events from days that have already passed
      const eventDayStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      if (eventDayStart < todayStart) return false;
      // Only show events that conflict with tasks
      if (!eventConflictsWithTask(e)) return false;
      return isSameDay(eventDate, day);
    });
  };
  
  // Get all-day tasks (tasks without specific time - only midnight) - exclude tasks with planning periods
  const getAllDayTasks = (day: Date) => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false; // Completed tasks don't show on calendar
      if (t.startDate) return false; // Tasks with planning periods have their own rows
      if (t.eventStartTime) return false; // Tasks with explicit start time show at that hour
      const dueDate = new Date(t.dueDate);
      // Only show in ALL DAY if it's exactly midnight (hour 0, minute 0)
      return isSameDay(dueDate, day) && dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
    });
  };

  // Get tasks with planning periods on a specific day (startDate <= day < dueDate)
  const getPlanningTasksForDay = (day: Date) => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false; // Completed tasks don't show on calendar
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
  // Includes tasks with explicit startDate AND upcoming tasks without startDate (auto-generated prep period)
  const getAllWeekPlanningTasks = () => {
    const today = startOfDay(new Date());
    
    // Tasks with explicit start dates
    const tasksWithExplicitPlanningPeriods = allTasks.filter(t => t.startDate && !t.isCompleted && !t.isMissed);
    
    // Upcoming tasks without startDate - auto-generate prep period (2 days before due)
    const upcomingTasksWithoutStartDate = allTasks.filter(t => {
      if (t.isCompleted || t.isMissed || t.startDate) return false;
      const dueDate = new Date(t.dueDate);
      // Only upcoming tasks (due after today, not due today)
      return dueDate > today && !isSameDay(dueDate, today);
    }).map(t => ({
      ...t,
      // Auto-generate startDate: 2 days before due (or today if due is closer)
      startDate: (() => {
        const dueDate = new Date(t.dueDate);
        const twoDaysBefore = subDays(dueDate, 2);
        // Use today if 2 days before is in the past
        return twoDaysBefore < today ? today.toISOString() : twoDaysBefore.toISOString();
      })()
    }));
    
    const allPlanningTasks = [...tasksWithExplicitPlanningPeriods, ...upcomingTasksWithoutStartDate];
    
    // Sort by start date to ensure consistent ordering
    return allPlanningTasks.sort((a, b) => {
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* New Semester Banner - Shows when past Week 13 */}
      {isPastSemester && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5" />
            <span className="font-medium">Semester Complete! Ready to set up your next semester?</span>
          </div>
          <Button 
            variant="outline" 
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={() => setIsNewSemesterDialogOpen(true)}
            data-testid="button-new-semester"
          >
            Set Up New Semester
          </Button>
        </div>
      )}

      {/* New Semester Setup Dialog */}
      <Dialog open={isNewSemesterDialogOpen} onOpenChange={setIsNewSemesterDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Set Up New Semester
            </DialogTitle>
          </DialogHeader>
          <form 
            className="space-y-4" 
            onSubmit={(e) => {
              e.preventDefault();
              createSemesterMutation.mutate(newSemesterForm);
            }}
          >
            <div>
              <Label htmlFor="semesterName">Semester Name</Label>
              <Input
                id="semesterName"
                placeholder="e.g., Spring/Summer 2026 Semester"
                value={newSemesterForm.semesterName}
                onChange={(e) => setNewSemesterForm(prev => ({ ...prev, semesterName: e.target.value }))}
                required
                data-testid="input-semester-name"
              />
            </div>

            <div>
              <Label htmlFor="semesterStartDate">Semester Start Date (Week 1 Saturday)</Label>
              <Input
                id="semesterStartDate"
                type="date"
                value={newSemesterForm.semesterStartDate}
                onChange={(e) => setNewSemesterForm(prev => ({ ...prev, semesterStartDate: e.target.value }))}
                required
                data-testid="input-semester-start"
              />
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <Label className="font-medium text-green-600">Course 1 (Green)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Course Code</Label>
                  <Input
                    placeholder="e.g., CPPA122"
                    value={newSemesterForm.course1Code}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course1Code: e.target.value }))}
                    required
                    data-testid="input-course1-code"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Course Name</Label>
                  <Input
                    placeholder="e.g., Local Politics"
                    value={newSemesterForm.course1Name}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course1Name: e.target.value }))}
                    required
                    data-testid="input-course1-name"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Professor Name (optional)</Label>
                <Input
                  placeholder="e.g., Dr. Smith"
                  value={newSemesterForm.course1Professor}
                  onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course1Professor: e.target.value }))}
                  data-testid="input-course1-professor"
                />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <Label className="font-medium text-pink-600">Course 2 (Pink)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Course Code</Label>
                  <Input
                    placeholder="e.g., CFNF400"
                    value={newSemesterForm.course2Code}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course2Code: e.target.value }))}
                    required
                    data-testid="input-course2-code"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Course Name</Label>
                  <Input
                    placeholder="e.g., Human Sexuality"
                    value={newSemesterForm.course2Name}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course2Name: e.target.value }))}
                    required
                    data-testid="input-course2-name"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Professor Name (optional)</Label>
                <Input
                  placeholder="e.g., Prof. Johnson"
                  value={newSemesterForm.course2Professor}
                  onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course2Professor: e.target.value }))}
                  data-testid="input-course2-professor"
                />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <Label className="font-medium text-indigo-600">Course 3 (Indigo)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Course Code</Label>
                  <Input
                    placeholder="e.g., CASL101"
                    value={newSemesterForm.course3Code}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course3Code: e.target.value }))}
                    required
                    data-testid="input-course3-code"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Course Name</Label>
                  <Input
                    placeholder="e.g., Sign Language"
                    value={newSemesterForm.course3Name}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course3Name: e.target.value }))}
                    required
                    data-testid="input-course3-name"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Professor Name (optional)</Label>
                <Input
                  placeholder="e.g., Dr. Williams"
                  value={newSemesterForm.course3Professor}
                  onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course3Professor: e.target.value }))}
                  data-testid="input-course3-professor"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={createSemesterMutation.isPending}
              data-testid="button-create-semester"
            >
              {createSemesterMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating New Semester...
                </>
              ) : (
                "Start New Semester"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog with Media Controls */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {(() => {
            // Extract course code from folder path (e.g., "week-1-cppa122-module" -> "CPPA122")
            const folderParts = previewFile?.folder?.split('-') || [];
            const courseCodeFromFolder = folderParts.length >= 3 ? folderParts[2]?.toUpperCase() : null;
            const colors = courseCodeFromFolder ? courseColors[courseCodeFromFolder] : null;
            
            return (
              <DialogHeader className={`px-6 py-4 ${colors ? `${colors.bg} ${colors.border} border-b` : 'border-b'}`}>
                <DialogTitle className={`flex items-center gap-2 text-sm ${colors ? colors.text : ''}`}>
                  <FileText className="h-4 w-4" />
                  {previewFile?.displayName || previewFile?.originalName}
                </DialogTitle>
              </DialogHeader>
            );
          })()}
          
          {/* Media Controls Bar */}
          <div className="flex items-center gap-3 p-3 mx-6 mt-4 bg-black rounded-lg">
            <Select value={previewSpeaker} onValueChange={setPreviewSpeaker}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-gray-800 border-gray-700 text-white" data-testid="select-preview-speaker">
                <SelectValue placeholder="Select Speaker" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {SPEAKERS.map(speaker => (
                  <SelectItem key={speaker.id} value={speaker.id} className="text-xs">
                    {speaker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Voice selector - shows for browser TTS */}
            {previewSpeaker === "browser_tts" && availableVoices.length > 0 && (
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="w-[200px] h-8 text-xs bg-gray-800 border-gray-700 text-white" data-testid="select-voice">
                  <SelectValue placeholder="Select Voice" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableVoices.map(voice => (
                    <SelectItem key={voice.name} value={voice.name} className="text-xs">
                      {voice.name.replace('Microsoft ', '').replace(' Online (Natural)', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Speed control - shows for browser TTS */}
            {previewSpeaker === "browser_tts" && (
              <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                <Gauge className="h-3 w-3 text-gray-400" />
                <span className="text-[9px] text-gray-400 mr-1">Speed</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-white hover:bg-gray-700"
                  onClick={() => setBrowserTtsRate(r => Math.max(0.5, r - 0.05))}
                  title="Slow down"
                  data-testid="button-speed-down"
                >
                  <MinusCircle className="h-3 w-3" />
                </Button>
                <span className="text-[10px] text-white font-medium w-8 text-center">{Math.round(browserTtsRate * 100)}%</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-white hover:bg-gray-700"
                  onClick={() => setBrowserTtsRate(r => Math.min(2, r + 0.05))}
                  title="Speed up"
                  data-testid="button-speed-up"
                >
                  <PlusCircle className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-gray-700"
                onClick={handleSkipBack}
                disabled={previewSpeaker !== "browser_tts"}
                data-testid="button-preview-rewind"
                title="Rewind 20 words"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-gray-700"
                onClick={() => previewFile && handlePlayFile(previewFile.objectPath, previewFile.displayName || previewFile.originalName)}
                data-testid="button-preview-play"
              >
                <Play className="h-4 w-4 fill-white" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-gray-700"
                onClick={handleStopMedia}
                data-testid="button-preview-stop"
              >
                <Square className="h-4 w-4 fill-white" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-gray-700"
                onClick={handleSkipForward}
                disabled={previewSpeaker !== "browser_tts"}
                data-testid="button-preview-forward"
                title="Skip forward 20 words"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-600 mx-1" />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-gray-700"
                onClick={() => handleVolumeChange("down")}
                data-testid="button-preview-speed-down"
                title="Decrease speed"
              >
                <MinusCircle className="h-4 w-4" />
              </Button>
              <span className="text-xs text-white/70 min-w-[3rem] text-center">
                {Math.round(browserTtsRate * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-gray-700"
                onClick={() => handleVolumeChange("up")}
                data-testid="button-preview-speed-up"
                title="Increase speed"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
              
              {/* Sync Highlight Toggle */}
              <div className="flex items-center gap-1.5 ml-2">
                <Checkbox
                  id="sync-highlight"
                  checked={syncHighlight}
                  onCheckedChange={(checked) => setSyncHighlight(!!checked)}
                  className="h-3.5 w-3.5 border-gray-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  data-testid="checkbox-sync-highlight"
                />
                <Label htmlFor="sync-highlight" className="text-white text-[10px] cursor-pointer whitespace-nowrap">
                  Sync
                </Label>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-700 text-xs ml-auto"
              data-testid="button-preview-download"
              onClick={async () => {
                if (!previewFile) return;
                try {
                  const response = await fetch(`/api/files/${previewFile.id}/download`);
                  if (!response.ok) throw new Error('Download failed');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = previewFile.displayName || previewFile.originalName || 'file.pdf';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Download error:', err);
                }
              }}
            >
              Download PDF
            </Button>
            
            {/* Mark as Completed Checkbox */}
            <div className="flex items-center gap-2 ml-2">
              <Checkbox
                id="mark-completed"
                checked={false}
                onCheckedChange={(checked) => {
                  if (checked && previewFile) {
                    markFileCompletedMutation.mutate({
                      fileId: previewFile.id,
                    });
                  }
                }}
                className="border-white data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                data-testid="checkbox-mark-completed"
              />
              <Label htmlFor="mark-completed" className="text-white text-xs cursor-pointer">
                Mark Completed
              </Label>
            </div>
          </div>
          
          {/* Split View: PDF on left, Highlighted Text on right */}
          <div className="flex-1 flex gap-4 min-h-[500px] max-h-[60vh] mx-6 mb-6 mt-4">
            {/* PDF Viewer */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-2 bg-gray-200 dark:bg-gray-700">
                <span className="text-xs text-muted-foreground">
                  Page {currentPdfPage} of {numPages || '?'}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => setCurrentPdfPage(p => Math.max(1, p - 1))}
                    disabled={currentPdfPage <= 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => setCurrentPdfPage(p => Math.min(numPages || 1, p + 1))}
                    disabled={currentPdfPage >= (numPages || 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto flex items-start justify-center p-2">
                {pdfUrl ? (
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    }
                    error={
                      <div className="text-center text-muted-foreground p-4">
                        Failed to load PDF
                      </div>
                    }
                  >
                    <Page 
                      pageNumber={currentPdfPage} 
                      width={350}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Highlighted Text for TTS */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-y-auto p-4">
              {isLoadingText ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Extracting text...</span>
                </div>
              ) : previewText ? (
                <div className="text-sm leading-relaxed">
                  {(() => {
                    // Remove the page markers and split by paragraphs
                    const cleanText = previewText.replace(/---PAGE---/g, '');
                    const paragraphs = cleanText.split(/\n\n+/);
                    
                    // Track global word index for highlighting
                    let globalWordIndex = 0;
                    
                    return paragraphs.map((paragraph, pIdx) => {
                      // Split paragraph into lines (for bullets, headers)
                      const lines = paragraph.split(/\n/);
                      
                      return (
                        <div key={pIdx} className="mb-3">
                          {lines.map((line, lIdx) => {
                            const words = line.split(/\s+/).filter(w => w.length > 0);
                            const lineStartIdx = globalWordIndex;
                            globalWordIndex += words.length;
                            
                            // Detect if line starts with bullet
                            const isBullet = /^[•\-\*►▶→]/.test(line.trim());
                            // Detect if line looks like a header (short, no ending punctuation)
                            const isHeader = words.length <= 8 && !/[.,:;]$/.test(line.trim()) && line.trim().length > 0;
                            
                            return (
                              <div 
                                key={`${pIdx}-${lIdx}`} 
                                className={`${isBullet ? 'pl-4' : ''} ${isHeader && !isBullet ? 'font-semibold text-base mt-2' : ''}`}
                              >
                                {words.map((word, wIdx) => {
                                  const wordGlobalIdx = lineStartIdx + wIdx;
                                  const isCurrentWord = syncHighlight && isPlaying && wordGlobalIdx === currentWordIndex;
                                  return (
                                    <span
                                      key={wordGlobalIdx}
                                      className={isCurrentWord ? "bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white px-0.5 rounded" : ""}
                                    >
                                      {word}{' '}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No text content available
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 overflow-hidden relative" style={{ backgroundImage: `url(${customBackground || campusBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        {/* Night overlay - dims background based on Toronto sunrise/sunset */}
        <div 
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isNighttime ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to bottom, rgba(10, 15, 30, 0.6) 0%, rgba(5, 10, 25, 0.7) 100%)' }}
        />
      {isTodayExpanded && (
        <div 
          className="today-backdrop"
          onClick={() => setIsTodayExpanded(false)}
        />
      )}
      {/* Left Column - Header Bar + Sidebar */}
      <div className="flex flex-col" style={{ width: 350, marginLeft: '11px', marginTop: '60px' }}>
        {/* Sidebar Container */}
        <div className="relative flex-1 flex flex-col mb-3 pt-1">
        
        {/* Digital Clock - Floating above sidebar */}
        <div className="absolute left-0 right-0 z-10 flex justify-center px-2" style={{ top: '13px' }}>
          <div className="flex items-center gap-2" data-testid="digital-clock">
            <span className="text-base text-white font-medium">
              {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(currentTime)}
            </span>
            <div className="w-[1px] h-6 bg-white/50" />
            <div className="flex items-baseline">
              <span className="text-xl font-semibold text-white tabular-nums">
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: displayTimezone }).format(currentTime).replace(/\s?(AM|PM)$/i, '')}
              </span>
              <span className="text-base text-white tabular-nums">
                :{new Intl.DateTimeFormat('en-US', { second: '2-digit', timeZone: displayTimezone }).format(currentTime)}
              </span>
              <span className="text-base font-bold text-white ml-0.5 uppercase">
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: displayTimezone }).format(currentTime).replace(/^\d+\s*/, '')}
              </span>
            </div>
            {profileData.travelTimezone && (
              <span className="text-xs text-orange-400 font-medium ml-1">Travel</span>
            )}
          </div>
        </div>
        {/* Pomodoro Timer - Floating above sidebar */}
        <div className="absolute left-0 right-0 z-10 flex justify-center px-2" style={{ top: '63px' }}>
          <div className="flex items-center justify-center gap-3 bg-white/20 rounded-lg px-4 py-2">
            <div className={`text-lg font-mono font-bold px-3 py-1.5 rounded ${
              pomodoroMode === "work" ? "bg-red-700 text-white" : 
              pomodoroMode === "shortBreak" ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"
            }`} data-testid="pomodoro-timer">
              {formatPomodoroTime(pomodoroTime)}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                onClick={togglePomodoro}
                data-testid="button-pomodoro-toggle"
              >
                {pomodoroRunning ? <Pause className="h-5 w-5 text-white" strokeWidth={2.5} /> : <Play className="h-5 w-5 text-white" strokeWidth={2.5} />}
              </button>
              <button
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                onClick={resetPomodoro}
                data-testid="button-pomodoro-reset"
              >
                <RotateCcw className="h-5 w-5 text-white" strokeWidth={2.5} />
              </button>
              <button
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                onClick={skipPomodoro}
                data-testid="button-pomodoro-skip"
              >
                <SkipForward className="h-5 w-5 text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Sidebar with blur/fade effect */}
        <aside className={`flex-1 text-white rounded-xl shadow-lg pb-4 pt-0 pr-0 flex flex-col overflow-hidden border border-white transition-all duration-300 ${isWeeklyFilesFlyoutOpen ? 'opacity-60 blur-[1px]' : 'opacity-100 blur-0'}`} style={{ width: 350, paddingLeft: '11px', background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}>
          {/* Spacer for clock and pomodoro timer */}
          <div className="flex-shrink-0" style={{ height: '85px' }} />

          {/* Scrollable sidebar content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 custom-scrollbar pr-1">
        {/* Course Legend */}
        <div className="pl-0.5 pr-1 space-y-3 mb-4" style={{ marginTop: '60px', marginLeft: '15px' }}>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Courses</h3>
          {coursesData.courses.filter(course => course.name.trim()).map((course, index) => {
            const courseCode = course.name.split(' - ')[0];
            const courseName = course.name.split(' - ').slice(1).join(' - ') || course.name;
            const tomorrow = addDays(startOfDay(new Date()), 1);
            const hasDueTomorrow = allTasks.some(task => 
              task.courseName?.includes(courseCode) && 
              !task.isCompleted &&
              isSameDay(new Date(task.dueDate), tomorrow)
            );
            return (
              <div key={index} className="flex items-center gap-1.5">
                <div 
                  className={`w-2 h-2 rounded-full ${hasDueTomorrow ? "animate-blink" : ""}`} 
                  style={{ backgroundColor: course.color }}
                />
                <span className="text-[10px]">
                  <span className="font-medium">{courseCode}</span>
                  {courseName !== courseCode && <span className="text-white"> - {courseName}</span>}
                  {course.professor && <span className="text-white/70"> ({course.professor})</span>}
                </span>
              </div>
            );
          })}
        </div>

        <nav className="flex flex-col gap-0.5 mt-4 pb-4" style={{ maxWidth: '280px', marginLeft: '15px' }}>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wide px-1 mb-0.5">Weeks</h3>
          {[...weeks].sort((a, b) => {
            const aFinished = parseISO(a.endDate) < new Date();
            const bFinished = parseISO(b.endDate) < new Date();
            if (aFinished && !bFinished) return 1;
            if (!aFinished && bFinished) return -1;
            return a.weekNumber - b.weekNumber;
          }).map((week) => {
            const weekEndDate = parseISO(week.endDate);
            const isWeekFinished = weekEndDate < new Date();
            const isSelected = selectedWeek === week.weekNumber && !selectedDate;
            return (
              <div key={week.weekNumber} className={`flex items-center gap-0.5 rounded-md ${isSelected ? 'bg-secondary' : ''}`}>
                <Button
                  variant="ghost"
                  className={`justify-start gap-1 h-auto py-1 px-1 ${isWeekFinished ? "opacity-60" : ""} ${isSelected ? "bg-transparent hover:bg-transparent flex-shrink-0" : "flex-1"}`}
                  size="sm"
                  onClick={() => {
                    setSelectedWeek(week.weekNumber);
                    setSelectedDate(null);
                  }}
                  data-testid={`button-week-${week.weekNumber}`}
                >
                  <div className={`flex items-center gap-1 ${isWeekFinished ? "line-through" : ""}`}>
                    <Calendar className={`h-3 w-3 ${isSelected ? 'text-black' : ''}`} />
                    <span className={`text-xs ${isSelected ? 'text-black' : ''}`}>Week {week.weekNumber}</span>
                    <span className={`text-[9px] font-bold ${isSelected ? 'text-black' : 'text-white/70'}`} style={{ fontFamily: "Segoe UI, sans-serif" }}>
                      ({format(parseISO(week.startDate), "MMM d")} - {format(parseISO(week.endDate), "MMM d")})
                    </span>
                  </div>
                  {!isSelected && week.taskCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 min-w-5 text-center justify-center ml-auto">
                      {week.taskCount}
                    </Badge>
                  )}
                </Button>
                {/* Task count for selected week - positioned at right edge */}
                {isSelected && week.taskCount > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 min-w-5 text-center justify-center ml-auto mr-1 text-black border-black">
                    {week.taskCount}
                  </Badge>
                )}
              </div>
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
              <div className="w-5 px-0.5 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black font-bold">Type</div>
              <div className="w-14 px-1 py-0.5 border-r border-black font-bold">Code</div>
              <div className="flex-1 px-1 py-0.5 font-bold">COURSES</div>
              <div className="w-14 px-1 py-0.5 border-l border-black font-bold text-center">Grade</div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['PPA101'] ? 'bg-gray-500 text-gray-500' : ''}`}>
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['PPA101'] || false} onChange={() => toggleCourse('PPA101')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 101</div>
              <div className="flex-1 px-1 py-0.5">Canadian Public Administration I: Institutions</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['PPA101']?.grade || ''} onChange={(e) => updateGrade('PPA101', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['PPA101']?.percent || ''} onChange={(e) => updatePercent('PPA101', e.target.value)} />
              </div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['PPA102'] ? 'bg-gray-500 text-gray-500' : ''}`}>
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['PPA102'] || false} onChange={() => toggleCourse('PPA102')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 102</div>
              <div className="flex-1 px-1 py-0.5">Canadian Public Administration II: Processes *</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['PPA102']?.grade || ''} onChange={(e) => updateGrade('PPA102', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['PPA102']?.percent || ''} onChange={(e) => updatePercent('PPA102', e.target.value)} />
              </div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['PPA125'] ? 'bg-gray-500 text-gray-500' : ''}`}>
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['PPA125'] || false} onChange={() => toggleCourse('PPA125')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 125</div>
              <div className="flex-1 px-1 py-0.5">(Formerly PPA521) Rights, Equity and the State</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['PPA125']?.grade || ''} onChange={(e) => updateGrade('PPA125', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['PPA125']?.percent || ''} onChange={(e) => updatePercent('PPA125', e.target.value)} />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black text-[8px] font-semibold">CORE ELECTIVES:</div>
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px]">Select <span className="font-bold">TWO</span> from the following:</div>
              <div className="w-14 border-l border-black"></div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['ELECTIVE1'] ? 'bg-gray-500 text-gray-500' : ''}`}>
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['ELECTIVE1'] || false} onChange={() => toggleCourse('ELECTIVE1')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 120</div>
              <div className="flex-1 px-1 py-0.5">Canadian Politics & Government **</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['ELECTIVE1']?.grade || ''} onChange={(e) => updateGrade('ELECTIVE1', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['ELECTIVE1']?.percent || ''} onChange={(e) => updatePercent('ELECTIVE1', e.target.value)} />
              </div>
            </div>
            <div className={`flex border-b border-black ${checkedCourses['ELECTIVE2'] ? 'bg-gray-500 text-gray-500' : ''}`}>
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" checked={checkedCourses['ELECTIVE2'] || false} onChange={() => toggleCourse('ELECTIVE2')} />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 121</div>
              <div className="flex-1 px-1 py-0.5">Ontario Politics and Government</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 122</div>
              <div className="flex-1 px-1 py-0.5">Local Politics and Government</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 124</div>
              <div className="flex-1 px-1 py-0.5">Indigenous Politics and Government</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="flex-1"></div>
                <div className={`flex items-center justify-center pb-1 ${checkedCourses['LIBERAL'] ? 'bg-gray-500' : ''}`}>
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
                    className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['LIBERAL'] ? 'bg-gray-500 text-gray-500' : 'bg-white'}`}
                    placeholder="Course..."
                    value={openElectives['LIBERAL'] || ''}
                    onChange={(e) => updateOpenElective('LIBERAL', e.target.value)}
                    data-testid="input-pag-liberal"
                  />
                </div>
              </div>
              <div className={`w-14 border-l border-black flex flex-col items-center justify-end gap-1.5 pb-1 ${checkedCourses['LIBERAL'] ? 'bg-gray-500' : ''}`}>
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['LIBERAL']?.grade || ''} onChange={(e) => updateGrade('LIBERAL', e.target.value)}>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['LIBERAL']?.percent || ''} onChange={(e) => updatePercent('LIBERAL', e.target.value)} />
              </div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="flex-1"></div>
                <div className={`h-[46px] flex items-start justify-center pt-2 ${checkedCourses['OPEN1'] ? 'bg-gray-500' : ''}`}>
                  <input type="checkbox" className="checkbox-black" checked={checkedCourses['OPEN1'] || false} disabled={!openElectives['OPEN1']?.trim()} onChange={() => toggleCourse('OPEN1')} />
                </div>
                <div className={`h-[26px] flex items-center justify-center ${checkedCourses['OPEN2'] ? 'bg-gray-500' : ''}`}>
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
                    className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['OPEN1'] ? 'bg-gray-500 text-gray-500' : 'bg-white'}`}
                    placeholder="Course 1..."
                    value={openElectives['OPEN1'] || ''}
                    onChange={(e) => updateOpenElective('OPEN1', e.target.value)}
                    data-testid="input-pag-open1"
                  />
                </div>
                <div className="px-1 pt-1 pb-1 flex items-end">
                  <input 
                    type="text" 
                    className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['OPEN2'] ? 'bg-gray-500 text-gray-500' : 'bg-white'}`}
                    placeholder="Course 2..."
                    value={openElectives['OPEN2'] || ''}
                    onChange={(e) => updateOpenElective('OPEN2', e.target.value)}
                    data-testid="input-pag-open2"
                  />
                </div>
              </div>
              <div className="w-14 border-l border-black flex flex-col">
                <div className="pt-5"></div>
                <div className={`flex flex-col items-center justify-center gap-0.5 py-1 ${checkedCourses['OPEN1'] ? 'bg-gray-500' : ''}`}>
                  <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['OPEN1']?.grade || ''} onChange={(e) => updateGrade('OPEN1', e.target.value)}>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['OPEN1']?.percent || ''} onChange={(e) => updatePercent('OPEN1', e.target.value)} />
                </div>
                <div className="flex-1"></div>
                <div className={`flex flex-col items-center justify-center gap-0.5 py-1 ${checkedCourses['OPEN2'] ? 'bg-gray-500' : ''}`}>
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
          <div className={`rounded-md p-2 text-[9px] ${allCoursesChecked ? 'bg-gray-500 text-gray-500' : 'bg-white text-black'} ${currentPagLevel === 2 ? '' : 'hidden'}`}>
          <div className="border-2 border-black">
            <div className="flex border-b border-black">
              <div className="font-bold px-1 py-0.5 border-r border-black w-16">LEVEL II</div>
              <div className="font-bold px-1 py-0.5 flex-1 text-center">PAG - DIPLOMA</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 px-0.5 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black font-bold">Type</div>
              <div className="w-14 px-1 py-0.5 border-r border-black font-bold">Code</div>
              <div className="flex-1 px-1 py-0.5 font-bold">COURSES</div>
              <div className="w-14 px-1 py-0.5 border-l border-black font-bold text-center">Grade</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 211</div>
              <div className="flex-1 px-1 py-0.5">Public Policy</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black">
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" />
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black text-[8px] font-semibold">CORE ELECTIVES:</div>
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px]">Select <span className="font-bold">THREE</span> from the following:</div>
              <div className="w-14 border-l border-black"></div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-5 border-r border-black flex items-center justify-center">
                <input type="checkbox" className="checkbox-black" />
              </div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 120</div>
              <div className="flex-1 px-1 py-0.5">Canadian Politics and Government</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 122</div>
              <div className="flex-1 px-1 py-0.5">Local Politics and Government</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 px-1 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black">PPA 124</div>
              <div className="flex-1 px-1 py-0.5">Indigenous Politics and Government</div>
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
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
              <div className="w-14 border-l border-black"></div>
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
              <div className="w-14 border-l border-black flex flex-col items-center justify-center gap-0.5">
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
              <div className="w-14 border-l border-black flex flex-col">
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
              <div className="w-14 border-l border-black"></div>
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
              <div className="w-14 border-l border-black flex flex-col">
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
              <div className="w-5 px-0.5 py-0.5 border-r border-black"></div>
              <div className="w-14 px-1 py-0.5 border-r border-black font-bold">Type</div>
              <div className="w-14 px-1 py-0.5 border-r border-black font-bold">Code</div>
              <div className="flex-1 px-1 py-0.5 font-bold">COURSES</div>
              <div className="w-14 px-1 py-0.5 border-l border-black font-bold text-center">Grade</div>
            </div>
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: '20px' }} />
                <col style={{ width: '56px' }} />
                <col style={{ width: '56px' }} />
                <col />
                <col style={{ width: '56px' }} />
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
              <div className="w-14 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">CORE REQUIRED:</div>
              <div className="w-14 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-14 border-r border-black flex items-center justify-center text-[8px] text-center">
                Select&nbsp;<span className="font-bold">ONE</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center text-[9px]">PPA 50A/B (Formerly PPA030) ***Practicum1</div>
                <div className="h-11 px-1 flex items-center text-[9px]">Course Base Option: Need 3 RG2 CORE ELECTIVE and 6 OE</div>
              </div>
              <div className="w-14 border-l border-black flex flex-col">
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
              <div className="w-14 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">CORE ELECTIVE</div>
              <div className="w-14 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-14 border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                <div className="leading-tight">Select <span className="font-bold">THREE</span><br/>courses not<br/>previously<br/>taken:</div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center text-[9px]">Any POG – 300 or 400 level courses</div>
                <div className="h-11 px-1 flex items-center text-[9px]">Any POG – 300 or 400 level courses</div>
                <div className="h-11 px-1 flex items-center text-[9px]">Any POG – 300 or 400 level courses</div>
              </div>
              <div className="w-14 border-l border-black flex flex-col">
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
              <div className="w-14 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">LIBERAL STUDIES ELECTIVE TABLE A / B:</div>
              <div className="w-14 border-l border-black"></div>
            </div>
            <div className="flex">
              <div className="w-5 border-r border-black flex flex-col">
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
                <div className="h-11 flex items-center justify-center"><input type="checkbox" className="checkbox-black" /></div>
              </div>
              <div className="w-14 border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                <div className="leading-tight"><span className="font-bold">FOUR</span> COURSES REQUIRED,<br/><br/><span className="font-bold">ONE</span> one-term LOWER LEVEL (TABLE A)<br/><br/>and <span className="font-bold">THREE</span> one-term UPPER LEVEL courses (TABLE B).</div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 1..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 2..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 3..." /></div>
                <div className="h-11 px-1 flex items-center"><input type="text" className="w-full text-[10px] px-1 py-0.5 border border-black rounded-sm bg-white" placeholder="Course 4..." /></div>
              </div>
              <div className="w-14 border-l border-black flex flex-col">
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
              <div className="w-14 border-r border-black"></div>
              <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">OPEN ELECTIVE:</div>
              <div className="w-14 border-l border-black"></div>
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
              <div className="w-14 border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
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
              <div className="w-14 border-l border-black flex flex-col">
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
        </div>
      </aside>
      </div>
      </div>

      {/* Quick Actions Header Bar - positioned absolutely to align with left panel */}
      <div className="absolute z-20 flex items-center rounded-2xl overflow-hidden" style={{ 
        width: '350px',
        left: '11px',
        top: '8px',
        background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
        border: '1px solid white'
      }}>
        <div className="flex items-center px-4 gap-2 w-full h-[44px]">
          <img src={unicalLogo} alt="Uni-Cal" className="rounded h-6 w-6" />
          <span className="text-sm text-white font-medium" style={{ fontFamily: "Segoe UI, sans-serif" }}>{profileData.firstName}'s Schedule ({currentSemesterName})</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-2 pb-6 flex flex-col overflow-hidden" style={{ paddingLeft: '127px', paddingRight: '24px', marginTop: '0px' }}>
        {/* Title Row - aligned with sidebar header */}
        <div className="flex items-start justify-between mb-0 flex-shrink-0">
          </div>
        
        {/* Menu Bar Container - clips scroll content */}
        <div className="flex-shrink-0 relative z-10 flex gap-2" style={{ marginTop: '0px', marginRight: '-7px', marginLeft: '-111px' }}>
        {/* Sleek Menu Bar */}
        <div className="flex items-center mb-0 rounded-2xl overflow-hidden flex-1" style={{ 
          background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
          border: '1px solid white'
        }}>
          {/* Navigation Section */}
          <div className="flex items-center px-4 gap-2 h-[44px]">
            {/* Hamburger Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-white/20 rounded-md -ml-1.5 -mr-1"
                  data-testid="button-hamburger-menu"
                >
                  <Menu className="!h-7 !w-7 text-white" strokeWidth={2.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem data-testid="menu-item-profile" onClick={() => setIsProfileDialogOpen(true)}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-school" onClick={() => setIsSchoolDialogOpen(true)}>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  School
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-courses" onClick={() => setIsCoursesDialogOpen(true)}>
                  <Palette className="h-4 w-4 mr-2" />
                  Courses
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-settings" onClick={() => setIsSettingsDialogOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Week navigation */}
            <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 backdrop-blur-sm">
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/20 rounded-md" onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))} data-testid="button-prev-week">
                <ChevronLeft className="h-4 w-4 text-white" strokeWidth={2.5} />
              </Button>
              <div className="flex items-center gap-1 mx-2 whitespace-nowrap">
                <span className="text-[11px] font-medium text-white">{format(weekStartDate, "MMM d")}</span>
                <span className="text-[11px] text-white/50">—</span>
                <span className="text-[11px] font-medium text-white">{format(weekEndDate, "MMM d")}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/20 rounded-md" onClick={() => setSelectedWeek(Math.min(13, selectedWeek + 1))} data-testid="button-next-week">
                <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.5} />
              </Button>
            </div>

            {/* Bell */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className={`h-7 w-7 hover:bg-white/20 rounded-lg border-[0.1px] border-white/50 ${isMuted ? "!bg-red-500 hover:!bg-red-600 !border-red-500" : ""}`}
              data-testid="button-mute-toggle"
              title={isMuted ? `Muted for ${Math.ceil((muteUntil! - Date.now()) / 60000)} min` : "Mute for 30 min"}
            >
              {isMuted ? <BellOff className="h-4 w-4 text-white" /> : <Bell className="h-4 w-4 text-white" />}
            </Button>

            {/* Sync */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 hover:bg-white/20 rounded-lg border-[0.1px] border-white/50"
              onClick={() => syncAllCalendarMutation.mutate()}
              disabled={syncAllCalendarMutation.isPending}
              data-testid="button-sync-calendar"
            >
              {syncAllCalendarMutation.isPending ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 text-white" />
              )}
            </Button>

            {/* View Buttons */}
            <div className="flex items-center gap-0.5 bg-white/10 rounded-md px-0.5 py-0.5">
              <Button 
                variant="ghost"
                className="!h-6 !min-h-0 px-2 text-[10px] hover:bg-white/20 rounded font-medium text-white border-0" 
                onClick={() => { setCalendarView("week"); setSelectedWeek(2); }} 
                data-testid="button-today"
              >
                <Sun className="h-3 w-3 mr-1 text-amber-300" />
                Today
              </Button>
              <Button 
                variant="ghost"
                className="!h-6 !min-h-0 px-2 text-[10px] hover:bg-white/20 rounded font-medium text-white border-0"
                onClick={() => setCalendarView(calendarView === "month" ? "week" : "month")}
                data-testid="button-month-view"
              >
                <CalendarDays className="h-3 w-3 mr-1 text-cyan-300" />
                {calendarView === "month" ? "Week" : "Month"}
              </Button>
            </div>

            </div>

          {/* Quick Add Section */}
          <div className="flex items-center pl-3 py-2 gap-1 flex-1 justify-end" style={{ paddingRight: '152px', transform: 'translateX(-20px)' }}>
            <Button 
              size="sm"
              className="!h-7 !min-h-0 px-4 bg-white/10 hover:bg-white/20 text-white text-[11px] border-0 font-medium rounded-md"
              data-testid="button-add-class"
              onClick={() => { setNewTaskType("class"); setIsAddDialogOpen(true); }}
            >
              + Class
            </Button>
            <Button 
              size="sm"
              className="!h-7 !min-h-0 px-2.5 bg-white/10 hover:bg-white/20 text-white text-[11px] border-0 font-medium rounded-md"
              data-testid="button-add-module"
              onClick={() => { setNewTaskType("module"); setIsAddDialogOpen(true); }}
            >
              + Module
            </Button>
            <Button 
              size="sm"
              className="!h-7 !min-h-0 px-2.5 bg-white/10 hover:bg-white/20 text-white text-[11px] border-0 font-medium rounded-md"
              data-testid="button-add-reading"
              onClick={() => { setNewTaskType("reading"); setIsAddDialogOpen(true); }}
            >
              + Reading
            </Button>
            <Button 
              size="sm"
              className="!h-7 !min-h-0 px-3 bg-white/10 hover:bg-white/20 text-white text-[11px] border-0 font-medium rounded-md"
              data-testid="button-add-discussion"
              onClick={() => { setNewTaskType("discussion"); setIsAddDialogOpen(true); }}
            >
              + Discussion
            </Button>
            <Button 
              size="sm"
              className="!h-7 !min-h-0 px-3 bg-white/10 hover:bg-white/20 text-white text-[11px] border-0 font-medium rounded-md"
              data-testid="button-add-assignment"
              onClick={() => { setNewTaskType("essay"); setIsAddDialogOpen(true); }}
            >
              + Assignment
            </Button>
            <Button 
              size="sm"
              className="!h-7 !min-h-0 px-2.5 bg-red-700 hover:bg-red-800 text-white text-[11px] border-0 font-medium rounded-md"
              data-testid="button-add-exam"
              onClick={() => { setNewTaskType("exam"); setIsAddDialogOpen(true); }}
            >
              + Exam
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
          
          {/* Profile Dialog */}
          <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Profile</DialogTitle>
              </DialogHeader>
              <ProfileForm 
                profileData={profileData} 
                timezones={timezones} 
                onSave={saveProfile} 
              />
            </DialogContent>
          </Dialog>
          
          {/* School Dialog */}
          <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>School Settings</DialogTitle>
              </DialogHeader>
              <SchoolForm 
                schoolData={schoolData}
                semesterSettings={semesterSettings}
                onSave={saveSchool} 
              />
            </DialogContent>
          </Dialog>
          
          {/* Courses Dialog */}
          <Dialog open={isCoursesDialogOpen} onOpenChange={setIsCoursesDialogOpen}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle>Courses</DialogTitle>
              </DialogHeader>
              <CoursesForm 
                coursesData={coursesData}
                onSave={saveCourses} 
              />
            </DialogContent>
          </Dialog>
          
          {/* Settings Dialog */}
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-sm font-medium">Background Image</Label>
                  <p className="text-xs text-muted-foreground">
                    Upload a custom background image to replace the default campus photo.
                  </p>
                  {customBackground && (
                    <div className="relative w-full h-24 rounded-md overflow-hidden border">
                      <img 
                        src={customBackground} 
                        alt="Current background" 
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1"
                        onClick={() => {
                          localStorage.removeItem('customBackground');
                          setCustomBackground(null);
                          toast({ title: "Background reset", description: "Default background has been restored." });
                        }}
                        data-testid="button-reset-background"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="background-upload"
                      data-testid="input-background-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          localStorage.setItem('customBackground', dataUrl);
                          setCustomBackground(dataUrl);
                          toast({ title: "Background updated", description: "Your custom background has been saved." });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('background-upload')?.click()}
                      data-testid="button-upload-background"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {customBackground ? "Change Background" : "Upload Background"}
                    </Button>
                  </div>
                </div>
                
                {/* TTS Highlighting Settings */}
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-sm font-medium">Text-to-Speech Highlighting</Label>
                  <p className="text-xs text-muted-foreground">
                    Fine-tune word highlighting to sync with your Home Assistant TTS voice.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Start Delay</Label>
                        <span className="text-xs text-muted-foreground">{ttsSettings.startDelay}s</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="60"
                        step="1"
                        value={ttsSettings.startDelay}
                        onChange={(e) => setTtsSettings(prev => ({ ...prev, startDelay: Number(e.target.value) }))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        data-testid="input-tts-start-delay"
                      />
                      <p className="text-xs text-muted-foreground">
                        Time before highlighting begins (network + TTS processing)
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Speech Rate</Label>
                        <span className="text-xs text-muted-foreground">{ttsSettings.wordsPerMinute} WPM</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="200"
                        step="5"
                        value={ttsSettings.wordsPerMinute}
                        onChange={(e) => setTtsSettings(prev => ({ ...prev, wordsPerMinute: Number(e.target.value) }))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        data-testid="input-tts-wpm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Words per minute - match your TTS voice speed
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Smart Timing</Label>
                        <p className="text-xs text-muted-foreground">
                          Adjust for word length (longer words = longer highlight)
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ttsSettings.useSmartTiming}
                        onChange={(e) => setTtsSettings(prev => ({ ...prev, useSmartTiming: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="input-tts-smart-timing"
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveTtsSettings(ttsSettings)}
                      data-testid="button-save-tts-settings"
                    >
                      Save TTS Settings
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Calendar Settings Dialog */}
          <Dialog open={isCalendarSettingsOpen} onOpenChange={setIsCalendarSettingsOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Calendar Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Second Google Account Connection */}
                <div className="border rounded-lg p-3 space-y-2">
                  <Label className="text-sm font-medium">Second Google Account</Label>
                  <p className="text-xs text-muted-foreground">
                    Connect a second Google account to sync tasks to both accounts. Events from both accounts that conflict with your tasks will show in the calendar.
                  </p>
                  {secondAccountStatus?.connected ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Connected: {secondAccountStatus.email}
                      </span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => disconnectSecondAccountMutation.mutate()}
                        disabled={disconnectSecondAccountMutation.isPending}
                        data-testid="button-disconnect-second-account"
                      >
                        {disconnectSecondAccountMutation.isPending ? "Disconnecting..." : "Disconnect"}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/google/second-account/auth");
                          const data = await res.json();
                          if (data.authUrl) {
                            window.open(data.authUrl, "_blank", "width=600,height=700");
                          } else {
                            toast({ title: "Error", description: data.error || "Failed to get auth URL", variant: "destructive" });
                          }
                        } catch (err) {
                          toast({ title: "Error", description: "Failed to start OAuth flow", variant: "destructive" });
                        }
                      }}
                      data-testid="button-connect-second-account"
                    >
                      Connect Second Google Account
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">Secondary Calendar (same account)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select a secondary calendar within your primary account to sync tasks to.
                  </p>
                  <Select
                    value={selectedSecondaryCalendar}
                    onValueChange={(value) => {
                      setSelectedSecondaryCalendar(value);
                      updateSecondaryCalendarMutation.mutate(value === "none" ? "" : value);
                    }}
                  >
                    <SelectTrigger data-testid="select-secondary-calendar">
                      <SelectValue placeholder="Select a calendar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No secondary calendar</SelectItem>
                      {availableCalendars?.filter(cal => !cal.primary).map(cal => (
                        <SelectItem key={cal.id} value={cal.id}>
                          {cal.summary}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p><strong>Primary Account:</strong> {availableCalendars?.find(c => c.primary)?.summary || "Not connected"}</p>
                  <p><strong>Secondary Calendar:</strong> {selectedSecondaryCalendar && selectedSecondaryCalendar !== "none" ? availableCalendars?.find(c => c.id === selectedSecondaryCalendar)?.summary || selectedSecondaryCalendar : "None"}</p>
                  <p><strong>Second Account:</strong> {secondAccountStatus?.connected ? secondAccountStatus.email : "Not connected"}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-visible main-scrollbar" style={{ marginRight: '-7px', marginLeft: '-111px', paddingRight: '0px', transform: 'translate(2px, 8px)' }}>
        {/* Calendar Views */}
        {calendarView === "week" ? (
        <div className="mb-3 mt-1 relative" style={{ height: calendarHeight }}>
          <Card className="shadow-lg rounded-xl overflow-hidden h-full border border-white bg-white/50 backdrop-blur-sm flex flex-col">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden" onClick={() => setSelectedTaskId(null)}>
            {/* Day Headers - Fixed, not scrollable */}
            <div className="grid border-b border-border z-40 h-[52px] w-full flex-shrink-0 pr-[17px]" style={{ gridTemplateColumns: '70px repeat(7, 1fr)', backgroundColor: 'rgba(255, 255, 255, 0.50)' }}>
              <div className="p-2 flex items-center justify-center" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <span className="text-sm text-black dark:text-white">Week {selectedWeek}</span>
              </div>
              {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                const isFriday = day.getDay() === 5;
                const dayName = format(day, "EEE").toUpperCase();
                const dayNum = format(day, "d");
                
                // Calculate next task due (excluding prep tasks, only actual due dates)
                const nextTaskDue = isToday ? allTasks
                  .filter(t => !t.isCompleted && !t.isMissed && new Date(t.dueDate) > new Date())
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] : null;
                const daysUntilNextTask = nextTaskDue 
                  ? differenceInDays(startOfDay(new Date(nextTaskDue.dueDate)), startOfDay(new Date()))
                  : null;
                
                return (
                  <div 
                    key={idx} 
                    className="p-1 border-l border-border flex flex-col items-center justify-center"
                    style={{ 
                      backgroundColor: isToday 
                        ? "#2d4a6f" 
                        : (isFriday && new Date().getDay() !== 5) 
                          ? "#f87171" 
                          : "transparent" 
                    }}
                    data-testid={`day-header-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`text-2xl font-bold ${
                        isToday ? "text-white" : (isFriday && new Date().getDay() !== 5) ? "text-white" : "text-foreground"
                      }`}>
                        {dayNum}
                      </div>
                      <div className={`text-xs font-medium tracking-wide ${
                        isToday ? "text-white/80" : (isFriday && new Date().getDay() !== 5) ? "text-white/80" : "text-muted-foreground"
                      }`}>{dayName}</div>
                    </div>
                    {isToday && daysUntilNextTask !== null && (
                      <div className="text-[9px] text-white text-center leading-tight -mt-1">
                        Next task due in <span className="font-bold text-white text-sm animate-blink">{daysUntilNextTask}</span> <span className="text-[9px]">{daysUntilNextTask === 1 ? 'day' : 'days'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* ALL DAY Row - Fixed, not scrollable - Only shows true all-day tasks (midnight due time) */}
            <div className="grid border-b border-border/50 z-30 w-full flex-shrink-0 pr-[17px]" style={{ gridTemplateColumns: '70px repeat(7, 1fr)', height: '44px', backgroundColor: 'rgba(229, 231, 235, 0.55)' }}>
                <div className="text-xs text-foreground font-bold tracking-wide flex items-center justify-center" style={{ backgroundColor: 'rgb(229, 231, 235)' }}>
                  ALL DAY
                </div>
                {weekDays.map((day, dayIdx) => {
                  // Only show true all-day tasks (midnight due) and all-day calendar events - NO prep tasks here
                  const allDayTasks = getAllDayTasks(day);
                  const allDayEvents = getAllDayCalendarEvents(day);
                  
                  return (
                    <div 
                      key={dayIdx} 
                      className="border-l border-border/50 relative p-0.5 flex flex-col gap-0.5 overflow-hidden"
                      data-testid={`all-day-slot-${format(day, "yyyy-MM-dd")}`}
                    >
                      {/* Regular all-day tasks only - prep tasks moved to course rows */}
                      {allDayTasks.map(task => {
                        const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                        const colors = courseColors[courseCode];
                        const today = startOfDay(new Date());
                        const tomorrow = addDays(today, 1);
                        const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                        const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate ${
                              isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""
                            } ${
                              task.isCompleted 
                                ? "bg-gray-200 text-gray-400 border border-gray-300" 
                                : colors 
                                  ? `${colors.bg} text-black border ${colors.border}` 
                                  : "bg-gray-200 text-black border border-gray-400"
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
                              className={`cursor-pointer hover:opacity-80 truncate flex-1 ${task.isCompleted ? "line-through" : ""}`}
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
              
              {/* Course Rows - CPPA122, CFNF400, CASL101 - Fixed, not scrollable - Now shows prep tasks */}
              {[
                { name: 'CPPA122', bg: 'rgba(134, 239, 172, 0.35)', label: 'rgba(74, 222, 128, 0.70)', colors: courseColors['CPPA122'] },
                { name: 'CFNF400', bg: 'rgba(249, 168, 212, 0.45)', label: 'rgba(244, 114, 182, 0.70)', colors: courseColors['CFNF400'] },
                { name: 'CASL101', bg: 'rgba(165, 180, 252, 0.45)', label: 'rgba(129, 140, 248, 0.70)', colors: courseColors['CASL101'] }
              ].map(course => (
                <div key={course.name} className="grid border-b border-border/50 w-full flex-shrink-0 pr-[17px]" style={{ gridTemplateColumns: '70px repeat(7, 1fr)', backgroundColor: course.bg, minHeight: '24px' }}>
                  <div className="px-1 py-0.5 text-[9px] font-bold tracking-wide flex items-center justify-center text-black" style={{ backgroundColor: course.label }}>
                    {course.name}
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    // Get prep tasks for this course and day
                    const coursePrepTasks = weekPlanningTasks.filter(task => {
                      if (!task.startDate || !task.courseName?.startsWith(course.name)) return false;
                      const startDate = new Date(task.startDate);
                      const dueDate = new Date(task.dueDate);
                      const dayStart = new Date(day);
                      dayStart.setHours(0, 0, 0, 0);
                      const dayEnd = new Date(day);
                      dayEnd.setHours(23, 59, 59, 999);
                      return startDate <= dayEnd && dayStart <= dueDate;
                    });
                    
                    return (
                      <div 
                        key={dayIdx} 
                        className="px-0.5 py-0.5 border-l border-border/50 flex flex-col gap-0.5 overflow-hidden"
                        data-testid={`course-row-${course.name}-${format(day, "yyyy-MM-dd")}`}
                      >
                        {coursePrepTasks.map(task => {
                          const taskDueDate = startOfDay(new Date(task.dueDate));
                          const dayStart = startOfDay(day);
                          const taskStartDate = task.startDate ? startOfDay(new Date(task.startDate)) : null;
                          const isFirstPrepDay = taskStartDate && isSameDay(taskStartDate, dayStart);
                          const isDueDay = isSameDay(taskDueDate, dayStart);
                          const dayBeforeDue = addDays(taskDueDate, -1);
                          const isLastPrepDay = taskStartDate && !isDueDay && isSameDay(dayStart, dayBeforeDue);
                          const today = startOfDay(new Date());
                          const tomorrow = addDays(today, 1);
                          
                          // Skip prep days that have already passed (but show due days)
                          if (!isDueDay && isBefore(dayStart, today)) {
                            return null;
                          }
                          
                          // Due day
                          if (isDueDay) {
                            const isDueToday = !task.isCompleted && isSameDay(taskDueDate, today);
                            const isDueTomorrow = !task.isCompleted && isSameDay(taskDueDate, tomorrow);
                            const hasPrepDays = taskStartDate && !isSameDay(taskStartDate, taskDueDate);
                            const hasVisiblePrepDays = hasPrepDays && !isBefore(dayBeforeDue, today);
                            const baseStyle = task.isCompleted 
                              ? "bg-gray-200 text-gray-400 border border-gray-300" 
                              : course.colors 
                                ? `${course.colors.bg} text-black border ${course.colors.border}` 
                                : "bg-gray-200 text-black border border-gray-400";
                            return (
                              <div key={`due-${task.id}`} className="flex items-center w-full">
                                {hasVisiblePrepDays && <div className="w-2 h-[2px] bg-black shrink-0" />}
                                <div
                                  className={`flex-1 flex items-center gap-1 text-[8px] px-1 py-0.5 truncate ${baseStyle} ${
                                    isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""
                                  }`}
                                  style={{ borderRadius: hasVisiblePrepDays ? '0 4px 4px 0' : '4px' }}
                                  data-testid={`course-due-task-${task.id}-${format(day, "yyyy-MM-dd")}`}
                                >
                                  <Checkbox
                                    checked={task.isCompleted || false}
                                    onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                    className="h-3 w-3 shrink-0"
                                    data-testid={`checkbox-course-due-${task.id}`}
                                  />
                                  <span 
                                    onClick={() => setEditingTask(task)}
                                    className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                  >
                                    <span className="font-bold">DUE:</span> {task.title}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          
                          // First prep day
                          if (isFirstPrepDay) {
                            const shimmerClass = isLastPrepDay && !task.isCompleted ? "animate-shimmer" : "";
                            const baseStyle = task.isCompleted 
                              ? "bg-gray-200 text-gray-400 border border-gray-300" 
                              : `bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 text-black border border-gray-400 ${shimmerClass}`;
                            return (
                              <div key={`prep-${task.id}`} className="flex items-center w-full">
                                <div
                                  className={`flex-1 flex items-center gap-1 text-[8px] px-1 py-0.5 truncate ${baseStyle}`}
                                  style={{ borderRadius: '4px 0 0 4px' }}
                                  data-testid={`course-prep-task-${task.id}-${format(day, "yyyy-MM-dd")}`}
                                >
                                  <Checkbox
                                    checked={task.isCompleted || false}
                                    onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                    className="h-3 w-3 shrink-0"
                                    data-testid={`checkbox-course-prep-${task.id}`}
                                  />
                                  <span 
                                    onClick={() => setEditingTask(task)}
                                    className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                  >
                                    <span className="font-bold">PREP:</span> {task.title}
                                  </span>
                                </div>
                                <div className="w-2 h-[2px] bg-black shrink-0" />
                              </div>
                            );
                          }
                          
                          // Intermediate prep days
                          const shimmerClass = isLastPrepDay && !task.isCompleted ? "animate-shimmer" : "";
                          const baseStyle = task.isCompleted 
                            ? "bg-gray-200 text-gray-400 border border-gray-300" 
                            : `bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 text-black border border-gray-400 ${shimmerClass}`;
                          const previousDay = addDays(dayStart, -1);
                          const hasPreviousVisibleDay = !isBefore(previousDay, today);
                          return (
                            <div key={`prep-mid-${task.id}-${format(day, "yyyy-MM-dd")}`} className="flex items-center w-full">
                              {hasPreviousVisibleDay && <div className="w-2 h-[2px] bg-black shrink-0" />}
                              <div
                                className={`flex-1 flex items-center gap-1 text-[8px] px-1 py-0.5 truncate ${baseStyle}`}
                                style={{ borderRadius: hasPreviousVisibleDay ? 0 : '4px 0 0 4px' }}
                                data-testid={`course-prep-mid-${task.id}-${format(day, "yyyy-MM-dd")}`}
                              >
                                <Checkbox
                                  checked={task.isCompleted || false}
                                  onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                  className="h-3 w-3 shrink-0"
                                  data-testid={`checkbox-course-prep-mid-${task.id}`}
                                />
                                <span 
                                  onClick={() => setEditingTask(task)}
                                  className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                >
                                  <span className="font-bold">PREP:</span> {task.title}
                                </span>
                              </div>
                              <div className="w-2 h-[2px] bg-black shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            
            {/* Time Slots - Scrollable area */}
            <div ref={calendarScrollRef} className="flex-1 overflow-y-scroll overflow-x-hidden">
                {timeSlots.map((hour, hourIdx) => {
                  const currentHour = new Date().getHours();
                  const isCurrentHour = hour === currentHour;
                  return (
                  <div 
                    key={hour} 
                    className="grid border-b border-border/50"
                    style={{ gridTemplateColumns: '70px repeat(7, 1fr)', height: '44px', backgroundColor: isCurrentHour ? 'rgba(93, 129, 204, 0.60)' : 'transparent' }}
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
                          className={`border-l border-border/50 relative p-0.5 transition-colors ${totalItems > 0 && !(isFriday && new Date().getDay() !== 5) && !isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} ${dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour ? "bg-primary/20 ring-2 ring-primary ring-inset" : ""}`}
                          style={isToday ? { backgroundColor: 'rgba(165,180,252,0.45)' } : (isFriday && new Date().getDay() !== 5) ? { backgroundColor: 'rgba(236,72,153,0.15)' } : undefined}
                          data-testid={`time-slot-${format(day, "yyyy-MM-dd")}-${hour}`}
                          onDragOver={(e) => handleDragOver(e, day, hour)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day, hour)}
                        >
                          {/* Half-hour dotted line */}
                          <div className="absolute left-0 right-0 top-1/2 border-t border-dotted border-gray-300/50 dark:border-gray-600/50" />
                          {hourTasks.map((task, taskIdx) => {
                            const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                            const colors = courseColors[courseCode];
                            const today = startOfDay(new Date());
                            const tomorrow = addDays(today, 1);
                            const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                            const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                            return (
                              <div
                                key={task.id}
                                draggable
                                tabIndex={0}
                                onDragStart={(e) => handleDragStart(e, task)}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Delete' || e.key === 'Backspace') {
                                    e.preventDefault();
                                    deleteMutation.mutate(task.id);
                                    setSelectedTaskId(null);
                                  }
                                }}
                                className={`absolute rounded pt-1 px-0.5 pb-2 hover:opacity-90 shadow-sm overflow-hidden cursor-grab active:cursor-grabbing ${
                                  draggedTask?.id === task.id ? "opacity-50" : ""
                                } ${
                                  selectedTaskId === task.id ? "ring-2 ring-red-500 ring-offset-1" : ""
                                } ${
                                  isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""
                                } ${
                                  task.isCompleted 
                                    ? "bg-gray-200 border border-gray-300" 
                                    : colors 
                                      ? `${colors.bg} border ${colors.border}` 
                                      : "bg-gray-200 border border-gray-400"
                                }`}
                                style={{
                                  top: '2px',
                                  left: `calc(${taskIdx * columnWidth}% + 2px)`,
                                  width: `calc(${columnWidth}% - 4px)`,
                                  height: '40px',
                                  maxHeight: '40px',
                                  zIndex: selectedTaskId === task.id ? 20 : (draggedTask?.id === task.id ? 10 : 1)
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
                                    className={`text-[8px] font-semibold truncate cursor-pointer flex-1 ${
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
        ) : (
        <div className="mb-3" style={{ height: calendarHeight }}>
          <Card className="shadow-lg rounded-xl overflow-hidden h-full border border-white bg-white/50 backdrop-blur-sm">
            <CardContent className="p-0 h-full overflow-auto">
              {/* Month Header */}
              <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-white/50 backdrop-blur-sm z-10">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-bold text-black dark:text-white" style={{ fontFamily: "Segoe UI, sans-serif" }}>{format(currentMonth, "MMMM yyyy")}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-border">
                {["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"].map((day) => (
                  <div key={day} className="p-2 text-center text-xs font-bold text-muted-foreground border-r border-border last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 flex-1">
                {(() => {
                  const monthStart = startOfMonth(currentMonth);
                  const monthEnd = endOfMonth(currentMonth);
                  const startDate = startOfWeek(monthStart, { weekStartsOn: 6 }); // Saturday
                  const endDate = endOfWeek(monthEnd, { weekStartsOn: 6 });
                  
                  const days: Date[] = [];
                  let day = startDate;
                  while (day <= endDate) {
                    days.push(day);
                    day = addDays(day, 1);
                  }
                  
                  return days.map((day, idx) => {
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isToday = isSameDay(day, new Date());
                    const dayTasks = allTasks.filter(t => isSameDay(new Date(t.dueDate), day));
                    
                    return (
                      <div
                        key={idx}
                        className={`min-h-[80px] p-1 border-r border-b border-border last:border-r-0 ${
                          isCurrentMonth ? "bg-card" : "bg-muted/30"
                        } ${isToday ? "bg-[#2d4a6f]" : ""}`}
                        onClick={() => {
                          // Find which week this day belongs to
                          const weekInfo = weeks.find(w => {
                            const wStart = new Date(w.startDate);
                            const wEnd = new Date(w.endDate);
                            return day >= wStart && day <= wEnd;
                          });
                          if (weekInfo) {
                            setSelectedWeek(weekInfo.weekNumber);
                            setCalendarView("week");
                          }
                        }}
                      >
                        <div className={`text-xs font-bold mb-1 ${
                          isToday ? "text-[#5979CC]" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 3).map((task) => {
                            const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                            const colors = courseColors[courseCode];
                            return (
                              <div
                                key={task.id}
                                className={`text-[7px] px-1 py-0.5 rounded truncate ${
                                  task.isCompleted 
                                    ? "bg-gray-200 text-gray-500 line-through" 
                                    : colors ? `${colors.bg} ${colors.text} border ${colors.border}` : "bg-gray-200"
                                }`}
                                title={task.title}
                              >
                                {task.title}
                              </div>
                            );
                          })}
                          {dayTasks.length > 3 && (
                            <div className="text-[7px] text-muted-foreground text-center">+{dayTasks.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
        )}
        {/* Be Prepared, Do Today, and Missed Tasks Side by Side */}
        {(() => {
          // Calculate dynamic height based on max tasks in any course column
          const cppa122Tasks = upcomingTasks.filter(t => t.courseName?.startsWith("CPPA122")).length;
          const cfnf400Tasks = upcomingTasks.filter(t => t.courseName?.startsWith("CFNF400")).length;
          const casl101Tasks = upcomingTasks.filter(t => t.courseName?.startsWith("CASL101")).length;
          const maxTasks = Math.max(cppa122Tasks, cfnf400Tasks, casl101Tasks, 2);
          // Base height 390px fits 3 course rows with 1 task with media controls each
          const dynamicHeight = maxTasks <= 2 ? 390 : 390 + (maxTasks - 2) * 95;
          // Calculate exact row height: container height minus header (~28px), divided by 3 rows
          // Each row needs ~110px to fit a task with media controls (h-5 controls + mb-1 + 60px card + pb-2 + margins)
          const rowHeight = Math.floor((dynamicHeight - 28) / 3);
          return (
        <div className="flex gap-4 mb-3 items-stretch flex-shrink-0" style={{ height: `${dynamicHeight}px` }}>
          {/* Upcoming Tasks Section (Be Prepared) - Now on Left */}
          <section className="flex-1 rounded-xl shadow-md border border-white overflow-hidden flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} data-testid="section-upcoming">
            <h4 className="text-xs font-semibold py-1.5 px-3 flex items-center gap-2 text-yellow-400" style={{ fontFamily: "Segoe UI, sans-serif", background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Clock className="h-3 w-3 text-yellow-400" />
              BE PREPARED: Upcoming Tasks ({upcomingTasks.length})
            </h4>
            <div className="flex-1 flex overflow-hidden">
              {isLoading ? (
                <div className="text-muted-foreground text-xs p-3">Loading...</div>
              ) : (
                <>
                  {/* CPPA122 Column - Green */}
                  <div className="flex-1 p-2 overflow-auto border-r border-white/30" style={{ backgroundColor: 'rgba(134,239,172,0.35)' }}>
                    <div className="text-[9px] font-bold text-white mb-1.5 text-center drop-shadow-md">CPPA122 - Local Politics</div>
                    <div className="space-y-1.5">
                      {upcomingTasks.filter(t => t.courseName?.startsWith("CPPA122")).map((task) => {
                        const daysUntilDue = differenceInDays(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
                        return (
                          <div key={task.id} className="relative">
                            <TaskCard
                              task={task}
                              onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                              onReschedule={() => setRescheduleTask(task)}
                              onEdit={() => setEditingTask(task)}
                              onDelete={() => deleteMutation.mutate(task.id)}
                              cardBgClass="bg-green-50 dark:bg-green-900/20"
                              compact
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-6 h-6 rounded-sm flex flex-col items-center justify-center z-10 border-[1.5px] border-white/20" style={{ background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}>
                              <span className="text-xs font-bold text-white leading-none">{daysUntilDue}</span>
                              <div className="working-dots mt-0.5">
                                <div className="working-dot"></div>
                                <div className="working-dot"></div>
                                <div className="working-dot"></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {upcomingTasks.filter(t => t.courseName?.startsWith("CPPA122")).length === 0 && (
                        <div className="text-center py-2 text-white/80 text-[10px]">No tasks</div>
                      )}
                    </div>
                  </div>
                  {/* CFNF400 Column - Pink */}
                  <div className="flex-1 p-2 overflow-auto border-r border-white/30" style={{ backgroundColor: 'rgba(249,168,212,0.45)' }}>
                    <div className="text-[9px] font-bold text-white mb-1.5 text-center drop-shadow-md">CFNF400 - Human Sexuality</div>
                    <div className="space-y-1.5">
                      {upcomingTasks.filter(t => t.courseName?.startsWith("CFNF400")).map((task) => {
                        const daysUntilDue = differenceInDays(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
                        return (
                          <div key={task.id} className="relative">
                            <TaskCard
                              task={task}
                              onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                              onReschedule={() => setRescheduleTask(task)}
                              onEdit={() => setEditingTask(task)}
                              onDelete={() => deleteMutation.mutate(task.id)}
                              cardBgClass="bg-pink-50 dark:bg-pink-900/20"
                              compact
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-6 h-6 rounded-sm flex flex-col items-center justify-center z-10 border-[1.5px] border-white/20" style={{ background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}>
                              <span className="text-xs font-bold text-white leading-none">{daysUntilDue}</span>
                              <div className="working-dots mt-0.5">
                                <div className="working-dot"></div>
                                <div className="working-dot"></div>
                                <div className="working-dot"></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {upcomingTasks.filter(t => t.courseName?.startsWith("CFNF400")).length === 0 && (
                        <div className="text-center py-2 text-white/80 text-[10px]">No tasks</div>
                      )}
                    </div>
                  </div>
                  {/* CASL101 Column - Purple */}
                  <div className="flex-1 p-2 overflow-auto" style={{ backgroundColor: 'rgba(165,180,252,0.45)' }}>
                    <div className="text-[9px] font-bold text-white mb-1.5 text-center drop-shadow-md">CASL101 - American Sign Language</div>
                    <div className="space-y-1.5">
                      {upcomingTasks.filter(t => t.courseName?.startsWith("CASL101")).map((task) => {
                        const daysUntilDue = differenceInDays(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
                        return (
                          <div key={task.id} className="relative">
                            <TaskCard
                              task={task}
                              onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                              onReschedule={() => setRescheduleTask(task)}
                              onEdit={() => setEditingTask(task)}
                              onDelete={() => deleteMutation.mutate(task.id)}
                              cardBgClass="bg-indigo-50 dark:bg-indigo-900/20"
                              compact
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-6 h-6 rounded-sm flex flex-col items-center justify-center z-10 border-[1.5px] border-white/20" style={{ background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}>
                              <span className="text-xs font-bold text-white leading-none">{daysUntilDue}</span>
                              <div className="working-dots mt-0.5">
                                <div className="working-dot"></div>
                                <div className="working-dot"></div>
                                <div className="working-dot"></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {upcomingTasks.filter(t => t.courseName?.startsWith("CASL101")).length === 0 && (
                        <div className="text-center py-2 text-white/80 text-[10px]">No tasks</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Do Today Section (Urgent) - Now in Middle */}
          <section className={`w-[240px] flex-shrink-0 rounded-xl shadow-md border border-white overflow-hidden flex flex-col ${doTodayBounce && todayTasks.length > 0 ? 'animate-gentle-bounce' : ''}`} data-testid="section-due-today">
            <h4 className="text-xs font-semibold py-1.5 px-3 flex items-center gap-2 text-orange-500" style={{ fontFamily: "Segoe UI, sans-serif", background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Calendar className="h-3 w-3 text-orange-500" />
              URGENT: Do Today ({todayTasks.length})
            </h4>
            <div className="flex-1 flex flex-col">
              {isLoading ? (
                <div className="text-muted-foreground text-xs p-2">Loading...</div>
              ) : (
                <>
                  {/* CPPA122 Row - Green */}
                  <div className="px-2 py-1 border-b border-white/30" style={{ backgroundColor: 'rgba(134,239,172,0.35)', minHeight: `${rowHeight}px` }}>
                    <div className="text-[9px] font-bold text-white drop-shadow-md mb-0.5">CPPA122 - Local Politics</div>
                    <div className="space-y-1">
                      {todayTasks.filter(t => t.courseName?.startsWith("CPPA122")).map((task) => (
                        <div key={task.id}>
                          <TaskCard task={task} onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })} onReschedule={() => setRescheduleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteMutation.mutate(task.id)} cardBgClass="bg-green-50 dark:bg-green-900/20" compact urgentBlink />
                        </div>
                      ))}
                      {todayTasks.filter(t => t.courseName?.startsWith("CPPA122")).length === 0 && (
                        <div className="text-[9px] text-green-600 dark:text-green-400 opacity-60">-</div>
                      )}
                    </div>
                  </div>
                  {/* CFNF400 Row - Pink */}
                  <div className="px-2 py-1 border-b border-white/30" style={{ backgroundColor: 'rgba(249,168,212,0.45)', minHeight: `${rowHeight}px` }}>
                    <div className="text-[9px] font-bold text-white drop-shadow-md mb-0.5">CFNF400 - Human Sexuality</div>
                    <div className="space-y-1">
                      {todayTasks.filter(t => t.courseName?.startsWith("CFNF400")).map((task) => (
                        <div key={task.id}>
                          <TaskCard task={task} onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })} onReschedule={() => setRescheduleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteMutation.mutate(task.id)} cardBgClass="bg-pink-50 dark:bg-pink-900/20" compact urgentBlink />
                        </div>
                      ))}
                      {todayTasks.filter(t => t.courseName?.startsWith("CFNF400")).length === 0 && (
                        <div className="text-[9px] text-pink-600 dark:text-pink-400 opacity-60">-</div>
                      )}
                    </div>
                  </div>
                  {/* CASL101 Row - Purple */}
                  <div className="px-2 py-1" style={{ backgroundColor: 'rgba(165,180,252,0.45)', minHeight: `${rowHeight}px` }}>
                    <div className="text-[9px] font-bold text-white drop-shadow-md mb-0.5">CASL101 - American Sign Language</div>
                    <div className="space-y-1">
                      {todayTasks.filter(t => t.courseName?.startsWith("CASL101")).map((task) => (
                        <div key={task.id}>
                          <TaskCard task={task} onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })} onReschedule={() => setRescheduleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteMutation.mutate(task.id)} cardBgClass="bg-indigo-50 dark:bg-indigo-900/20" compact urgentBlink />
                        </div>
                      ))}
                      {todayTasks.filter(t => t.courseName?.startsWith("CASL101")).length === 0 && (
                        <div className="text-[9px] text-purple-600 dark:text-purple-400 opacity-60">-</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Missed Tasks Section (Overdue) - Now on Right */}
          <section className="w-[240px] flex-shrink-0 rounded-xl shadow-md border border-white overflow-hidden flex flex-col" data-testid="section-missed">
            <h4 className="text-xs font-semibold py-1.5 px-3 flex items-center gap-2 text-red-500" style={{ fontFamily: "Segoe UI, sans-serif", background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Clock className="h-3 w-3 text-red-500" />
              OVERDUE: Missed Tasks ({missedTasks.length})
            </h4>
            <div className="flex-1 flex flex-col">
              {/* CPPA122 Row - Green */}
              <div className="px-2 py-1 border-b border-white/30" style={{ backgroundColor: 'rgba(134,239,172,0.35)', minHeight: `${rowHeight}px` }}>
                <div className="text-[9px] font-bold text-white drop-shadow-md mb-0.5">CPPA122 - Local Politics</div>
                <div className="space-y-1">
                  {missedTasks.filter(t => t.courseName?.startsWith("CPPA122")).map((task) => (
                    <div key={task.id}>
                      <TaskCard task={task} onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })} onReschedule={() => setRescheduleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteMutation.mutate(task.id)} cardBgClass="bg-green-50 dark:bg-green-900/20" compact overdueBlink />
                    </div>
                  ))}
                  {missedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length === 0 && (
                    <div className="text-[9px] text-green-600 dark:text-green-400 opacity-60">-</div>
                  )}
                </div>
              </div>
              {/* CFNF400 Row - Pink */}
              <div className="px-2 py-1 border-b border-white/30" style={{ backgroundColor: 'rgba(249,168,212,0.45)', minHeight: `${rowHeight}px` }}>
                <div className="text-[9px] font-bold text-white drop-shadow-md mb-0.5">CFNF400 - Human Sexuality</div>
                <div className="space-y-1">
                  {missedTasks.filter(t => t.courseName?.startsWith("CFNF400")).map((task) => (
                    <div key={task.id}>
                      <TaskCard task={task} onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })} onReschedule={() => setRescheduleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteMutation.mutate(task.id)} cardBgClass="bg-pink-50 dark:bg-pink-900/20" compact overdueBlink />
                    </div>
                  ))}
                  {missedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length === 0 && (
                    <div className="text-[9px] text-pink-600 dark:text-pink-400 opacity-60">-</div>
                  )}
                </div>
              </div>
              {/* CASL101 Row - Purple */}
              <div className="px-2 py-1" style={{ backgroundColor: 'rgba(165,180,252,0.45)', minHeight: `${rowHeight}px` }}>
                <div className="text-[9px] font-bold text-white drop-shadow-md mb-0.5">CASL101 - American Sign Language</div>
                <div className="space-y-1">
                  {missedTasks.filter(t => t.courseName?.startsWith("CASL101")).map((task) => (
                    <div key={task.id}>
                      <TaskCard task={task} onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })} onReschedule={() => setRescheduleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteMutation.mutate(task.id)} cardBgClass="bg-indigo-50 dark:bg-indigo-900/20" compact overdueBlink />
                    </div>
                  ))}
                  {missedTasks.filter(t => t.courseName?.startsWith("CASL101")).length === 0 && (
                    <div className="text-[9px] text-purple-600 dark:text-purple-400 opacity-60">-</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
          );
        })()}

        {/* To Do Section - Random tasks */}
        <div className="mb-3 flex-shrink-0">
          <section className="rounded-xl shadow-md p-3 border border-white h-[210px]" style={{ background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }} data-testid="section-todo">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 text-white" style={{ fontFamily: "Segoe UI, sans-serif" }}>
              <ClipboardCheck className="h-3 w-3 text-white" />
              To Do
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
        <div className="flex gap-4 items-stretch h-[240px] flex-shrink-0">
          {/* CPPA122 Completed */}
          <section className="flex-1 rounded-xl shadow-md p-3 border border-white overflow-auto" style={{ backgroundColor: 'rgba(134,239,172,0.35)' }} data-testid="section-completed-cppa122">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 rounded px-2 py-1" style={{ fontFamily: "Segoe UI, sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-white drop-shadow-md" />
              <span className="text-white drop-shadow-md">Completed - CPPA122</span> <span className="text-white drop-shadow-md">({completedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length})</span>
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
          <section className="flex-1 rounded-xl shadow-md p-3 border border-white overflow-auto" style={{ backgroundColor: 'rgba(249,168,212,0.45)' }} data-testid="section-completed-cfnf400">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 rounded px-2 py-1" style={{ fontFamily: "Segoe UI, sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-white drop-shadow-md" />
              <span className="text-white drop-shadow-md">Completed - CFNF400</span> <span className="text-white drop-shadow-md">({completedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length})</span>
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
          <section className="flex-1 rounded-xl shadow-md p-3 border border-white overflow-auto" style={{ backgroundColor: 'rgba(165,180,252,0.45)' }} data-testid="section-completed-casl101">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 rounded px-2 py-1" style={{ fontFamily: "Segoe UI, sans-serif" }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-white drop-shadow-md" />
              <span className="text-white drop-shadow-md">Completed - CASL101</span> <span className="text-white drop-shadow-md">({completedTasks.filter(t => t.courseName?.startsWith("CASL101")).length})</span>
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
                    cardBgClass="bg-indigo-50 dark:bg-indigo-900/20"
                    compact
                  />
                ))}
              </div>
            )}
          </section>
        </div>
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

        {/* Copyright Symbol */}
        <div className="fixed bottom-2 right-3 text-white text-xs font-medium" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
          © 2026
        </div>

        {/* Weekly Files Flyout Tab - Fixed position outside overflow containers */}
        {calendarView === "week" && (
          <div 
            className="fixed z-50 flex flex-row-reverse items-center transition-transform duration-300 ease-in-out"
            style={{ top: 'calc(50% - 44px)', transform: `translateY(-50%) translateX(${isWeeklyFilesFlyoutOpen ? '-320px' : '0'})`, left: '349px' }}
          >
            {/* Flyout Panel */}
            <div 
              className={`shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${isWeeklyFilesFlyoutOpen ? 'w-80 border border-r-0 border-white rounded-l-xl' : 'w-0 border-0'}`}
              style={{ maxHeight: '70vh', background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}
            >
              <div className="w-80 flex flex-col">
                <div className="p-3 border-b border-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RouterLink href="/files">
                      <Button 
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-white/20 rounded-lg border-[0.1px] border-white/50"
                        data-testid="button-files-link-flyout"
                      >
                        <FolderOpen className="h-4 w-4 text-amber-400" />
                      </Button>
                    </RouterLink>
                    <h3 className="text-white font-semibold text-sm">Week {selectedWeek} Files</h3>
                  </div>
                  <span className="text-xs text-gray-400">{currentWeekFiles.length} files</span>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
                  {/* Overdue Files Section */}
                  {(() => {
                    // Get files from overdue tasks - attachments may be JSON strings or objects
                    const overdueFilesFromTasks = missedTasks
                      .filter(t => t.attachments && t.attachments.length > 0)
                      .flatMap(t => t.attachments!.map(att => {
                        // Parse attachment - could be JSON string, object, or plain URL string
                        let parsed: { name?: string; url?: string } = {};
                        if (typeof att === 'string') {
                          try {
                            parsed = JSON.parse(att);
                          } catch {
                            // Plain URL string
                            parsed = { url: att, name: att.split('/').pop() || att };
                          }
                        } else {
                          parsed = att as any;
                        }
                        return {
                          url: parsed.url || '',
                          name: parsed.name || parsed.url?.split('/').pop() || 'File',
                          taskId: t.id,
                          taskTitle: t.title,
                          courseName: t.courseName
                        };
                      }));
                    
                    if (overdueFilesFromTasks.length === 0) return null;
                    
                    // Group by course
                    const groupedOverdue: Record<string, typeof overdueFilesFromTasks> = {};
                    overdueFilesFromTasks.forEach(file => {
                      const courseCode = file.courseName?.split(" ")[0]?.toUpperCase() || 'OTHER';
                      if (!groupedOverdue[courseCode]) {
                        groupedOverdue[courseCode] = [];
                      }
                      groupedOverdue[courseCode].push(file);
                    });
                    
                    const courseOrder = ['CPPA122', 'CFNF400', 'CASL101'];
                    const sortedOverdue = Object.entries(groupedOverdue).sort(([a], [b]) => {
                      const aIdx = courseOrder.indexOf(a);
                      const bIdx = courseOrder.indexOf(b);
                      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
                      if (aIdx === -1) return 1;
                      if (bIdx === -1) return -1;
                      return aIdx - bIdx;
                    });
                    
                    return (
                      <div className="mb-4">
                        <div className="text-[11px] font-bold text-red-400 border-b border-white/30 pb-1 mb-2">
                          OVERDUE
                        </div>
                        <div className="space-y-2">
                          {sortedOverdue.map(([courseCode, files]) => {
                            const colors = courseColors[courseCode];
                            // Use coursesData lookup for consistent naming
                            const courseInfo = coursesData.courses.find(c => c.name.toUpperCase().startsWith(courseCode));
                            const displayName = courseInfo?.name || courseCode;
                            return (
                              <div key={courseCode}>
                                <div className="text-[10px] font-bold mb-1 text-white">
                                  {displayName}
                                </div>
                                <div className="space-y-1">
                                  {files.map((file, idx) => {
                                    // Find matching file from allFiles by objectPath
                                    const matchingFile = allFiles.find(f => f.objectPath === file.url);
                                    return (
                                    <div
                                      key={`overdue-${file.taskId}-${idx}`}
                                      className="flex items-center gap-2 p-2 rounded text-xs group border border-red-400/50 bg-red-900/30 text-white"
                                      data-testid={`flyout-overdue-file-${file.taskId}-${idx}`}
                                    >
                                      <button
                                        onClick={() => {
                                          if (matchingFile) {
                                            // Use the actual file record from the files table
                                            setPreviewFile(matchingFile);
                                          } else {
                                            // Fallback: open URL directly if no matching file found
                                            window.open(file.url, '_blank');
                                          }
                                        }}
                                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                                      >
                                        <span className="truncate font-medium">{file.name || file.url}</span>
                                      </button>
                                    </div>
                                  );})}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Current Week Files */}
                  {currentWeekFiles.length === 0 && missedTasks.filter(t => t.attachments && t.attachments.length > 0).length === 0 ? (
                    <div className="text-gray-500 text-sm text-center py-8">
                      No files in Week {selectedWeek}
                    </div>
                  ) : currentWeekFiles.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold text-yellow-400 border-b border-white/30 pb-1 mb-2 mt-6">
                        DUE THIS WEEK
                      </div>
                      {(() => {
                        // Group files by course
                        const groupedFiles: Record<string, typeof currentWeekFiles> = {};
                        currentWeekFiles.forEach(file => {
                          const folderParts = file.folder?.split('-') || [];
                          const courseCode = folderParts.length >= 3 ? folderParts[2].toUpperCase() : 'OTHER';
                          if (!groupedFiles[courseCode]) {
                            groupedFiles[courseCode] = [];
                          }
                          groupedFiles[courseCode].push(file);
                        });
                        
                        // Sort courses in order: CPPA122 (green), CFNF400 (pink), CASL101 (indigo), then others
                        const courseOrder = ['CPPA122', 'CFNF400', 'CASL101'];
                        const sortedEntries = Object.entries(groupedFiles).sort(([a], [b]) => {
                          const aIdx = courseOrder.indexOf(a);
                          const bIdx = courseOrder.indexOf(b);
                          if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
                          if (aIdx === -1) return 1;
                          if (bIdx === -1) return -1;
                          return aIdx - bIdx;
                        });
                        
                        return sortedEntries.map(([courseCode, files]) => {
                          const colors = courseColors[courseCode];
                          const courseInfo = coursesData.courses.find(c => c.name.toUpperCase().startsWith(courseCode));
                          const courseName = courseInfo?.name || courseCode;
                          return (
                            <div key={courseCode}>
                              {/* Course header */}
                              <div className="text-[10px] font-bold mb-1 text-white">
                                {courseName}
                              </div>
                              {/* Files for this course */}
                              <div className="space-y-1">
                                {files.map(file => (
                                  <div
                                    key={file.id}
                                    className={`flex items-center gap-2 p-2 rounded text-xs group border ${
                                      colors 
                                        ? `${colors.prepBg} ${colors.prepBorder} text-black` 
                                        : 'bg-[#2d2d2d] border-[#3d3d3d] text-white'
                                    }`}
                                    data-testid={`flyout-file-${file.id}`}
                                  >
                                    <Checkbox
                                      className={`h-3 w-3 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 ${
                                        colors ? 'border-black' : 'border-white/50'
                                      }`}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          markFileCompletedMutation.mutate({ fileId: file.id });
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`flyout-file-checkbox-${file.id}`}
                                    />
                                    <button
                                      onClick={() => setPreviewFile(file)}
                                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                                    >
                                      <span className="truncate font-medium">{file.displayName}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {/* Tab Button */}
            <button
              onClick={() => setIsWeeklyFilesFlyoutOpen(!isWeeklyFilesFlyoutOpen)}
              className="border-t border-b border-l border-white rounded-l-lg px-1 py-3 hover:opacity-80 transition-colors shadow-lg"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}
              data-testid="weekly-files-flyout-tab"
            >
              <span className="text-white text-xs font-medium tracking-wide flex items-center gap-1">
                {isWeeklyFilesFlyoutOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                Weekly Files
                <FolderOpen className="h-3 w-3" style={{ transform: 'rotate(90deg)' }} />
              </span>
            </button>
          </div>
        )}
      </main>
      </div>
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
  overdueBlink = false,
  urgentBlink = false,
}: {
  task: Task;
  onComplete: (isCompleted: boolean) => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  cardBgClass?: string;
  compact?: boolean;
  overdueBlink?: boolean;
  urgentBlink?: boolean;
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
          body: JSON.stringify({ mediaUrl, entityId: 'media_player.echo_lr_studio_white_am' }),
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
      await fetch('/api/media/stop', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: 'media_player.echo_lr_studio_white_am' }),
      });
    } catch (error) {
      console.error('Stop error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const handleResume = async () => {
    setIsControlling(true);
    try {
      await fetch('/api/media/resume', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: 'media_player.echo_lr_studio_white_am' }),
      });
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
        body: JSON.stringify({ action, entityId: 'media_player.echo_lr_studio_white_am' }),
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
      } ${overdueBlink ? "animate-urgent-blink" : ""} ${urgentBlink ? "animate-shimmer" : ""}`}
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
            <CardTitle className={`${compact ? "font-semibold" : "font-medium"} ${task.isCompleted ? "line-through" : ""} ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>
              {task.title}
            </CardTitle>
            {task.courseName && (
              <p className={`font-medium ${colors?.text || "text-muted-foreground"} ${compact ? "text-[8px]" : "text-[10px]"}`}>
                {compact ? (task.courseName.split(" - ")[1] || task.courseName) : task.courseName.split(" - ")[0]}
              </p>
            )}
          </div>
        </div>
        {!compact && (
          <Badge className={`${colors ? `${colors.bg} ${colors.border} ${colors.text}` : typeColors[task.type]}`}>
            <Icon className="h-3 w-3 mr-1" />
            {task.type}
          </Badge>
        )}
      </CardHeader>
      <CardContent className={`space-y-1 ${compact ? "px-2 pb-1 pt-0 mt-auto" : "px-3 pb-3 pt-0"}`}>
        {!compact && task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        
        {compact ? (
          <div className="flex items-center">
            <Badge className={`${colors ? `${colors.bg} ${colors.border} ${colors.text}` : typeColors[task.type]} text-[8px] px-1.5 py-0.5`}>
              <Icon className="h-2.5 w-2.5 mr-0.5" />
              {task.type}
            </Badge>
            <div className="flex-1 flex items-center justify-end gap-1 text-black dark:text-white text-[10px]">
              <Clock className="h-2.5 w-2.5" />
              <span className="font-bold">DUE</span> {format(new Date(task.dueDate), "MMM d")}
            </div>
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
        <div className="relative pt-1 h-full flex flex-col cursor-pointer pb-2" onClick={onEdit}>
          {/* Mini Media Controls for compact cards */}
          <div className="h-5 flex items-center justify-around rounded-xl px-1 text-white border border-white/50 no-blink mb-1" style={{ background: 'linear-gradient(135deg, #0a1421 0%, #0f1f33 25%, #162a44 50%, #1e3a5f 75%, #2d4a6f 100%)' }}>
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
        <div className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-around rounded-xl px-1 bg-[#5979CC] text-white border border-white">
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

interface FileRecord {
  id: number;
  originalName: string;
  displayName: string;
  objectPath: string;
  contentType: string;
  size: number;
  folder: string | null;
}

function FileSelector({ 
  onSelect, 
  excludePaths 
}: { 
  onSelect: (objectPath: string) => void;
  excludePaths: string[];
}) {
  const { data: files = [] } = useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });

  const availableFiles = files.filter(f => !excludePaths.includes(f.objectPath));

  if (availableFiles.length === 0) {
    return (
      <Button type="button" variant="outline" disabled className="flex-1" data-testid="button-select-file-empty">
        <FolderOpen className="h-4 w-4 mr-2" />
        No Files
      </Button>
    );
  }

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="flex-1" data-testid="select-existing-file">
        <FolderOpen className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select File" />
      </SelectTrigger>
      <SelectContent>
        {availableFiles.map(file => (
          <SelectItem key={file.id} value={file.objectPath}>
            {file.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProfileForm({ 
  profileData, 
  timezones, 
  onSave 
}: { 
  profileData: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null };
  timezones: { value: string; label: string }[];
  onSave: (data: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null }) => void;
}) {
  const [firstName, setFirstName] = useState(profileData.firstName);
  const [lastName, setLastName] = useState(profileData.lastName);
  const [birthdate, setBirthdate] = useState(profileData.birthdate);
  const [timezone, setTimezone] = useState(profileData.timezone);
  const [travelTimezone, setTravelTimezone] = useState<string | null>(profileData.travelTimezone);
  const [isTraveling, setIsTraveling] = useState(!!profileData.travelTimezone);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ firstName, lastName, birthdate, timezone, travelTimezone: isTraveling ? travelTimezone : null });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input 
          id="firstName" 
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter your first name"
          data-testid="input-profile-firstname"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input 
          id="lastName" 
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter your last name"
          data-testid="input-profile-lastname"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="birthdate">Birthdate</Label>
        <Input 
          id="birthdate" 
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          data-testid="input-profile-birthdate"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Home Time Zone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger data-testid="select-profile-timezone">
            <SelectValue placeholder="Select time zone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map(tz => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="traveling" 
            checked={isTraveling}
            onCheckedChange={(checked) => setIsTraveling(!!checked)}
            data-testid="checkbox-traveling"
          />
          <Label htmlFor="traveling" className="text-sm font-medium cursor-pointer">I'm traveling</Label>
        </div>
        {isTraveling && (
          <div className="space-y-2">
            <Label htmlFor="travelTimezone" className="text-sm">Travel Time Zone</Label>
            <p className="text-xs text-muted-foreground">Clock shows travel time. Tasks stay aligned with your home timezone.</p>
            <Select value={travelTimezone || timezone} onValueChange={setTravelTimezone}>
              <SelectTrigger data-testid="select-travel-timezone">
                <SelectValue placeholder="Select travel time zone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Button type="submit" className="w-full bg-[#5979CC] hover:bg-[#4a68b3] text-white" data-testid="button-save-profile">
        Save Profile
      </Button>
    </form>
  );
}

function SchoolForm({ 
  schoolData, 
  semesterSettings,
  onSave 
}: { 
  schoolData: { schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string };
  semesterSettings: SemesterSettings | null | undefined;
  onSave: (data: { schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string }) => void;
}) {
  const [schoolLogo, setSchoolLogo] = useState<string | null>(schoolData.schoolLogo);
  const [numberOfWeeks, setNumberOfWeeks] = useState(schoolData.numberOfWeeks);
  const [week1StartDate, setWeek1StartDate] = useState(schoolData.week1StartDate);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(schoolData.firstDayOfWeek);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { upload } = useUpload();
  
  const daysOfWeek = [
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
  ];
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingLogo(true);
    try {
      const result = await upload(file, { prefix: 'logos' });
      if (result?.url) {
        setSchoolLogo(result.url);
      }
    } catch (error) {
      console.error('Logo upload failed:', error);
    } finally {
      setIsUploadingLogo(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ schoolLogo, numberOfWeeks, week1StartDate, firstDayOfWeek });
  };

  const semesterEnd = week1StartDate 
    ? format(addWeeks(new Date(week1StartDate), numberOfWeeks), 'MMMM d, yyyy')
    : 'Not set';
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>School Logo</Label>
        <div className="flex items-center gap-3">
          {schoolLogo ? (
            <img src={schoolLogo} alt="School logo" className="h-12 w-auto object-contain rounded border" />
          ) : (
            <div className="h-12 w-20 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo}
              data-testid="button-upload-logo"
            >
              {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-1">{schoolLogo ? 'Change' : 'Upload'}</span>
            </Button>
            {schoolLogo && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => setSchoolLogo(null)}
                data-testid="button-remove-logo"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
            data-testid="input-logo-file"
          />
        </div>
        <p className="text-xs text-muted-foreground">Upload your school logo to replace the default.</p>
      </div>
      
      <div className="border rounded-lg p-3 space-y-3">
        <Label className="text-sm font-medium">School Schedule</Label>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="numberOfWeeks" className="text-xs">Number of School Weeks</Label>
            <Select value={String(numberOfWeeks)} onValueChange={(v) => setNumberOfWeeks(Number(v))}>
              <SelectTrigger data-testid="select-number-of-weeks">
                <SelectValue placeholder="Select weeks" />
              </SelectTrigger>
              <SelectContent>
                {[10, 11, 12, 13, 14, 15, 16].map(w => (
                  <SelectItem key={w} value={String(w)}>{w} weeks</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="week1StartDate" className="text-xs">Week 1, Day 1 Date</Label>
            <Input 
              id="week1StartDate"
              type="date"
              value={week1StartDate}
              onChange={(e) => setWeek1StartDate(e.target.value)}
              data-testid="input-week1-start-date"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="firstDayOfWeek" className="text-xs">First Day of School Week</Label>
            <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
              <SelectTrigger data-testid="select-first-day-of-week">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {daysOfWeek.map(day => (
                  <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground pt-1">
            Semester ends: {semesterEnd}
          </div>
        </div>
      </div>
      
      {semesterSettings && (
        <div className="border rounded-lg p-3 space-y-3">
          <Label className="text-sm font-medium">Courses</Label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium">{semesterSettings.course1Code}</span>
              <span className="text-sm text-muted-foreground">- {semesterSettings.course1Name}</span>
              {semesterSettings.course1Professor && (
                <span className="text-xs text-muted-foreground ml-auto">Prof. {semesterSettings.course1Professor}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-sm font-medium">{semesterSettings.course2Code}</span>
              <span className="text-sm text-muted-foreground">- {semesterSettings.course2Name}</span>
              {semesterSettings.course2Professor && (
                <span className="text-xs text-muted-foreground ml-auto">Prof. {semesterSettings.course2Professor}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-sm font-medium">{semesterSettings.course3Code}</span>
              <span className="text-sm text-muted-foreground">- {semesterSettings.course3Name}</span>
              {semesterSettings.course3Professor && (
                <span className="text-xs text-muted-foreground ml-auto">Prof. {semesterSettings.course3Professor}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Course details are set when starting a new semester.</p>
        </div>
      )}
      
      <Button type="submit" className="w-full bg-[#5979CC] hover:bg-[#4a68b3] text-white" data-testid="button-save-school">
        Save School Settings
      </Button>
    </form>
  );
}

function CoursesForm({ 
  coursesData, 
  onSave 
}: { 
  coursesData: { courses: Array<{ name: string; color: string; professor: string }> };
  onSave: (data: { courses: Array<{ name: string; color: string; professor: string }> }) => void;
}) {
  const [courses, setCourses] = useState(coursesData.courses);
  
  const updateCourse = (index: number, field: 'name' | 'color' | 'professor', value: string) => {
    setCourses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ courses });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter your course names, professor names, and select a color for each. Colors will be used throughout the app for tasks associated with each course.
      </p>
      
      <div className="space-y-2">
        {courses.map((course, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-4">{index + 1}.</span>
            <input
              type="color"
              value={course.color}
              onChange={(e) => updateCourse(index, 'color', e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              data-testid={`input-course-color-${index}`}
            />
            <Input
              value={course.name}
              onChange={(e) => updateCourse(index, 'name', e.target.value)}
              placeholder={`Course name (e.g., MATH101 - Calculus)`}
              className="w-64 text-xs h-8"
              data-testid={`input-course-name-${index}`}
            />
            <Input
              value={course.professor}
              onChange={(e) => updateCourse(index, 'professor', e.target.value)}
              placeholder={`Professor`}
              className="w-40 text-xs h-8"
              data-testid={`input-course-professor-${index}`}
            />
          </div>
        ))}
      </div>
      
      <Button type="submit" className="w-full bg-[#5979CC] hover:bg-[#4a68b3] text-white text-xs h-8" data-testid="button-save-courses">
        Save Courses
      </Button>
    </form>
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
    eventStartTime: task?.eventStartTime || "",
    eventEndTime: task?.eventEndTime || "",
    reminder1: task?.reminder1 ?? DEFAULT_REMINDER_1,
    reminder2: task?.reminder2 ?? DEFAULT_REMINDER_2,
    reminder3: task?.reminder3 ?? 0,
    reminder4: task?.reminder4 ?? 0,
    priority: task?.priority || "medium",
    weekNumber: task?.weekNumber || weekNumber,
    referenceLink: task?.referenceLink || "",
    attachments: task?.attachments || [] as string[],
    repeatType: (task?.repeatType as typeof REPEAT_TYPES[number]) || "none",
    repeatInterval: task?.repeatInterval || 1,
    repeatIntervalUnit: (task?.repeatIntervalUnit as typeof REPEAT_INTERVAL_UNITS[number]) || "weeks",
    repeatEndDate: task?.repeatEndDate ? format(new Date(task.repeatEndDate), "yyyy-MM-dd") : "",
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
        eventStartTime: data.eventStartTime || null,
        eventEndTime: data.eventEndTime || null,
        reminder1: data.reminder1 || null,
        reminder2: data.reminder2 || null,
        reminder3: data.reminder3 || null,
        reminder4: data.reminder4 || null,
        priority: data.priority,
        weekNumber: data.weekNumber,
        referenceLink: data.referenceLink,
        attachments: data.attachments,
        repeatType: data.repeatType,
        repeatInterval: data.repeatType === "custom" ? data.repeatInterval : null,
        repeatIntervalUnit: data.repeatType === "custom" ? data.repeatIntervalUnit : null,
        repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate).toISOString() : null,
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
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          type="datetime-local"
          value={formData.dueDate}
          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
          required
          data-testid="input-duedate"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="eventStartTime">Start Time (optional)</Label>
          <Input
            id="eventStartTime"
            type="time"
            value={formData.eventStartTime}
            onChange={(e) => setFormData(prev => ({ ...prev, eventStartTime: e.target.value }))}
            data-testid="input-start-time"
          />
        </div>
        <div>
          <Label htmlFor="eventEndTime">End Time (optional)</Label>
          <Input
            id="eventEndTime"
            type="time"
            value={formData.eventEndTime}
            onChange={(e) => setFormData(prev => ({ ...prev, eventEndTime: e.target.value }))}
            data-testid="input-end-time"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Reminders</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Reminder 1</Label>
            <Select 
              value={String(formData.reminder1)} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, reminder1: parseInt(v) }))}
            >
              <SelectTrigger data-testid="select-reminder1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Reminder 2</Label>
            <Select 
              value={String(formData.reminder2)} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, reminder2: parseInt(v) }))}
            >
              <SelectTrigger data-testid="select-reminder2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Reminder 3 (optional)</Label>
            <Select 
              value={String(formData.reminder3)} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, reminder3: parseInt(v) }))}
            >
              <SelectTrigger data-testid="select-reminder3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Reminder 4 (optional)</Label>
            <Select 
              value={String(formData.reminder4)} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, reminder4: parseInt(v) }))}
            >
              <SelectTrigger data-testid="select-reminder4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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

      <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Repeat2 className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Repeat</Label>
        </div>
        
        <div>
          <Select 
            value={formData.repeatType} 
            onValueChange={(v) => setFormData(prev => ({ 
              ...prev, 
              repeatType: v as typeof REPEAT_TYPES[number]
            }))}
          >
            <SelectTrigger data-testid="select-repeat-type">
              <SelectValue placeholder="No repeat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No repeat</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom...</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.repeatType === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Every</Label>
              <Input
                type="number"
                min="1"
                max="52"
                value={formData.repeatInterval}
                onChange={(e) => setFormData(prev => ({ ...prev, repeatInterval: parseInt(e.target.value) || 1 }))}
                data-testid="input-repeat-interval"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Select 
                value={formData.repeatIntervalUnit} 
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  repeatIntervalUnit: v as typeof REPEAT_INTERVAL_UNITS[number]
                }))}
              >
                <SelectTrigger data-testid="select-repeat-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {formData.repeatType !== "none" && (
          <div>
            <Label className="text-xs text-muted-foreground">End Repeat (optional)</Label>
            <Input
              type="date"
              value={formData.repeatEndDate}
              onChange={(e) => setFormData(prev => ({ ...prev, repeatEndDate: e.target.value }))}
              data-testid="input-repeat-end-date"
            />
            {!formData.repeatEndDate && (
              <p className="text-xs text-muted-foreground mt-1">
                If no end date, repeats for 6 months
              </p>
            )}
          </div>
        )}
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
                  Upload New
                </>
              )}
            </Button>
            <FileSelector 
              onSelect={(objectPath) => {
                if (!formData.attachments.includes(objectPath)) {
                  setFormData(prev => ({
                    ...prev,
                    attachments: [...prev.attachments, objectPath]
                  }));
                }
              }}
              excludePaths={formData.attachments}
            />
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
        <Button type="submit" disabled={createMutation.isPending} className="bg-[#5979CC] hover:bg-[#4a68b3] text-white" data-testid="button-submit-task">
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
