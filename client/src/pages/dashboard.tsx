import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import tmuLogo from "@assets/Chang-School_1768803262583.png";
import unicalLogo from "@assets/ChatGPT_Image_Jan_22,_2026,_02_34_52_PM_1769110943463.png";
import campusBg from "@assets/TMU_1769151150961.jpg";
import dashboardBg from "@assets/BG_1769691992519.jpg";
import celebrationAnimoji from "@assets/Animoji_1769350617739.webp";
import victoryFanfare from "@assets/victory-fanfare.mp3";
import crowdCheer from "@assets/crowd-cheer.mp3";
import honey1 from "@assets/Honey1_1769645399917.png";
import honey2 from "@assets/Honey2_1769645399918.png";
import honey3 from "@assets/Honey3_1769645399918.png";
import ovalBanner from "@assets/Oval_1769694161559.png";
import buttonBg from "@assets/Button_1769694441816.png";
import orangeButtonBg from "@assets/Orange_Button_1769695828702.png";
import taskButtonBg from "@assets/Task_1769694788992.png";
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
import { Slider } from "@/components/ui/slider";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  BookOpenCheck,
  School,
  Library,
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
  ChevronDown,
  ChevronUp,
  X,
  Link,
  Paperclip,
  Upload,
  Loader2,
  Play,
  Square,
  MinusCircle,
  PlusCircle,
  Folder,
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
  Volume2,
  VolumeX,
  CheckSquare,
  Undo2,
  Radio,
  Minus,
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
  "CPPA122": { bg: "bg-green-100 dark:bg-green-900/40", border: "border-green-500", text: "text-green-700 dark:text-green-300", dot: "bg-green-500", prepBg: "bg-green-100 dark:bg-green-900/40", prepBorder: "border-green-300", prepText: "text-green-600 dark:text-green-400" },
  "CFNF400": { bg: "bg-pink-100 dark:bg-pink-900/40", border: "border-pink-500", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500", prepBg: "bg-pink-100 dark:bg-pink-900/40", prepBorder: "border-pink-300", prepText: "text-pink-600 dark:text-pink-400" },
  "CASL101": { bg: "bg-indigo-100 dark:bg-indigo-900/40", border: "border-indigo-500", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", prepBg: "bg-indigo-100 dark:bg-indigo-900/40", prepBorder: "border-indigo-300", prepText: "text-indigo-600 dark:text-indigo-400" },
};

// Display name mapping for course row labels
const courseDisplayNames: Record<string, string> = {
  "CPPA122": "CPPA122-LP",
  "CFNF400": "CFNF400-HS",
  "CASL101": "CASL101-SL",
};

// Helper function to get display name for course row labels
const getCourseRowDisplayName = (courseName: string): string => {
  const courseCode = courseName.split(' - ')[0];
  const displayCode = courseDisplayNames[courseCode] || courseCode;
  const courseSuffix = courseName.split(' - ').slice(1).join(' - ');
  return courseSuffix ? `${displayCode} - ${courseSuffix}` : displayCode;
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

// Helper function to convert 24-hour time to 12-hour format
const formatTimeTo12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Speakers list for media controls
const SPEAKERS = [
  { id: "browser_tts", name: "Bluetooth" },
  { id: "media_player.byhome", name: "Apartment" },
  { id: "media_player.cat_wash", name: "Cat Wash" },
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
  const [initialStartTime, setInitialStartTime] = useState<string>("");
  const [initialEndTime, setInitialEndTime] = useState<string>("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [isTodayExpanded, setIsTodayExpanded] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState(674);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [doTodayBounce, setDoTodayBounce] = useState(false);
  const todayTaskCountRef = useRef(0);
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('completedFiles');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

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
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isCompletedTasksOpen, setIsCompletedTasksOpen] = useState(false);
  const [isRadioDialogOpen, setIsRadioDialogOpen] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState("media_player.echo_lr_studio_white_am");
  const [radioVolume, setRadioVolume] = useState(50);
  const [isFilesFlyoutOpen, setIsFilesFlyoutOpen] = useState(true);
  const [isFiles2FlyoutOpen, setIsFiles2FlyoutOpen] = useState(true);
  const [lastOpenedFlyout, setLastOpenedFlyout] = useState<'files1' | 'files2'>('files1'); // Track which flyout was opened last
  const [readingsPopupCourse, setReadingsPopupCourse] = useState<string | null>(null);
  const [isWeeksFlyoutOpen, setIsWeeksFlyoutOpen] = useState(false);
  // Honeycomb navigation state
  const [modulesHoneycombOpen, setModulesHoneycombOpen] = useState<string | null>(null);
  const [decorativeHoneycombHover, setDecorativeHoneycombHover] = useState<'left' | 'middle' | 'right' | null>(null);
  const [readingsHoneycombOpen, setReadingsHoneycombOpen] = useState(false);
  const [moduleMediaControlCourse, setModuleMediaControlCourse] = useState<string | null>(null);
  const [flyoutWidth, setFlyoutWidth] = useState(183); // Default flyout width for files (half width)
  const [flyout2Width, setFlyout2Width] = useState(183); // Default flyout width for files2 (half width)
  const [weeksFlyoutWidth, setWeeksFlyoutWidth] = useState(220); // Default flyout width for week folders
  const [isResizingFlyout, setIsResizingFlyout] = useState(false);
  const [isResizingFlyout2, setIsResizingFlyout2] = useState(false);
  const [isResizingWeeksFlyout, setIsResizingWeeksFlyout] = useState(false);
  const [isTodoFlyoutOpen, setIsTodoFlyoutOpen] = useState(false);
  const [flyoutExpandedFolders, setFlyoutExpandedFolders] = useState<Set<string>>(new Set());
  
  const toggleFlyoutFolder = (folderId: string) => {
    setFlyoutExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };
  
  // Week folders for files flyout
  const FLYOUT_WEEKS = [
    { id: "week-1", name: "Week 1" },
    { id: "week-2", name: "Week 2" },
    { id: "week-3", name: "Week 3" },
    { id: "week-4", name: "Week 4" },
    { id: "week-5", name: "Week 5" },
    { id: "week-6", name: "Week 6" },
    { id: "week-7", name: "Week 7" },
    { id: "week-8", name: "Week 8" },
    { id: "week-9", name: "Week 9" },
    { id: "week-10", name: "Week 10" },
    { id: "week-11", name: "Week 11" },
    { id: "week-12", name: "Week 12" },
    { id: "week-13", name: "Week 13" },
  ];
  
  const FLYOUT_COURSES = [
    { id: "cppa122", name: "CPPA122", color: "text-green-500" },
    { id: "cfnf400", name: "CFNF400", color: "text-pink-500" },
    { id: "casl101", name: "CASL101", color: "text-purple-500" },
  ];
  
  const FLYOUT_CONTENT = [
    { id: "module", name: "Module" },
    { id: "reading", name: "Reading" },
  ];
  
  // Get files for a specific folder path
  const getFilesInFlyoutFolder = (folderId: string) => {
    return weeklyFiles.filter(f => f.folder === folderId);
  };
  
  const getFilesInFlyoutWeek = (weekId: string) => {
    return weeklyFiles.filter(f => f.folder?.startsWith(weekId + "-"));
  };
  
  const getFilesInFlyoutCourse = (weekId: string, courseId: string) => {
    return weeklyFiles.filter(f => f.folder?.startsWith(`${weekId}-${courseId}-`));
  };
  const [draggedFile, setDraggedFile] = useState<{ url: string; name: string } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCompletedTaskId, setLastCompletedTaskId] = useState<number | null>(() => {
    const saved = localStorage.getItem('lastCompletedTaskId');
    return saved ? parseInt(saved) : null;
  });
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Arrow connections from task boxes to calendar
  const [arrowConnections, setArrowConnections] = useState<Array<{
    taskId: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    color: string;
    isToday: boolean;
    isTomorrow: boolean;
  }>>([]);
  
  // NEW: Prep arrows from Today box to prep extensions
  const [prepArrowConnections, setPrepArrowConnections] = useState<Array<{
    taskId: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    color: string;
    boxType: 'today' | 'tomorrow';
  }>>([]);
  const mainContentRef = useRef<HTMLElement | null>(null);
  
    
  // Celebration popup auto-dismiss and audio
  useEffect(() => {
    if (showCelebration) {
      // Play victory fanfare sound
      if (!celebrationAudioRef.current) {
        celebrationAudioRef.current = new Audio(victoryFanfare);
      }
      celebrationAudioRef.current.currentTime = 0;
      celebrationAudioRef.current.volume = 0.7;
      celebrationAudioRef.current.play().catch(() => {});
      
      // Send "Hooray!" to Home Assistant TTS (Echo speaker)
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hooray! Great job!" })
      }).catch(() => {});
      
      // Play clapping sound pattern using Web Audio API
      const playClapping = () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const now = audioContext.currentTime;
          
          // Create a rhythmic clapping pattern (8 claps over 2 seconds)
          const clapTimes = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];
          
          clapTimes.forEach((time) => {
            // Create noise buffer for clap sound
            const bufferSize = audioContext.sampleRate * 0.08; // 80ms clap
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate noise with envelope for clap-like sound
            for (let i = 0; i < bufferSize; i++) {
              const envelope = Math.exp(-i / (bufferSize * 0.15)); // Quick decay
              data[i] = (Math.random() * 2 - 1) * envelope;
            }
            
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            
            // Add high-pass filter for sharper clap sound
            const highpass = audioContext.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 1500;
            
            // Add bandpass for clap character
            const bandpass = audioContext.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.value = 2500;
            bandpass.Q.value = 0.5;
            
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.3;
            
            source.connect(highpass);
            highpass.connect(bandpass);
            bandpass.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            source.start(now + time);
          });
        } catch (e) {
          // Silently fail if Web Audio API not available
        }
      };
      
      playClapping();
      
      // Play crowd cheer audio
      const playCrowdCheer = () => {
        const audio = new Audio(crowdCheer);
        audio.volume = 0.7;
        audio.play().catch(err => console.log("Crowd cheer playback error:", err));
      };
      
      setTimeout(() => {
        playCrowdCheer();
      }, 500);
      
      const timer = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showCelebration]);
  
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
  
  // Calculate synchronized animation delay so all overdue blinks are in sync
  // Animation is 1s, so we use negative delay based on current second fraction
  const blinkSyncDelay = useMemo(() => {
    const ms = currentTime.getTime() % 1000;
    return `-${ms / 1000}s`;
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
  
  // Discussion post checkbox states (persisted per week in localStorage)
  const [startDiscussionComplete, setStartDiscussionComplete] = useState<boolean>(() => {
    const saved = localStorage.getItem(`discussionStart_week${selectedWeek}`);
    return saved === 'true';
  });
  const [discussionDueComplete, setDiscussionDueComplete] = useState<boolean>(() => {
    const saved = localStorage.getItem(`discussionDue_week${selectedWeek}`);
    return saved === 'true';
  });
  
  // Check if today is Friday (day 5) for blinking the Discussion Due column
  const isFriday = new Date().getDay() === 5;
  
  // Blinking and spacing settings
  const [blinkSettings, setBlinkSettings] = useState<{
    todayColumnBlink: boolean;
    allDayFilesBlink: boolean;
    taskBoxFilesBlink: boolean;
    todayColumnBlinkSpeed: number;
    allDayFilesBlinkSpeed: number;
    taskBoxFilesBlinkSpeed: number;
    buttonSpacing: number;
    mediaControlSpacing: number;
    showArrows: boolean;
  }>(() => {
    const saved = localStorage.getItem('blinkSettings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      todayColumnBlink: parsed.todayColumnBlink ?? true,
      allDayFilesBlink: parsed.allDayFilesBlink ?? true,
      taskBoxFilesBlink: parsed.taskBoxFilesBlink ?? true,
      todayColumnBlinkSpeed: parsed.todayColumnBlinkSpeed ?? parsed.blinkSpeed ?? 0.6,
      allDayFilesBlinkSpeed: parsed.allDayFilesBlinkSpeed ?? parsed.blinkSpeed ?? 0.6,
      taskBoxFilesBlinkSpeed: parsed.taskBoxFilesBlinkSpeed ?? parsed.blinkSpeed ?? 0.6,
      buttonSpacing: parsed.buttonSpacing ?? 0,
      mediaControlSpacing: parsed.mediaControlSpacing ?? 16,
      showArrows: parsed.showArrows ?? true
    };
  });
  
  // Save blink settings to localStorage
  useEffect(() => {
    localStorage.setItem('blinkSettings', JSON.stringify(blinkSettings));
  }, [blinkSettings]);
  
  // Save and reload discussion post checkboxes when week changes
  useEffect(() => {
    localStorage.setItem(`discussionStart_week${selectedWeek}`, String(startDiscussionComplete));
  }, [startDiscussionComplete, selectedWeek]);
  
  useEffect(() => {
    localStorage.setItem(`discussionDue_week${selectedWeek}`, String(discussionDueComplete));
  }, [discussionDueComplete, selectedWeek]);
  
  // Reset discussion checkboxes when week changes
  useEffect(() => {
    const savedStart = localStorage.getItem(`discussionStart_week${selectedWeek}`);
    const savedDue = localStorage.getItem(`discussionDue_week${selectedWeek}`);
    setStartDiscussionComplete(savedStart === 'true');
    setDiscussionDueComplete(savedDue === 'true');
  }, [selectedWeek]);
  
  // Box order based on current day of week
  // Sunday/Monday: Today=LEFT, Tomorrow=MIDDLE, This Week=RIGHT
  // Tuesday/Wednesday: Today=MIDDLE, Tomorrow=RIGHT, This Week=LEFT
  // Thursday/Friday/Saturday: Today=RIGHT, Tomorrow=LEFT, This Week=MIDDLE
  const getDefaultBoxOrder = (): string[] => {
    const dayOfWeek = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    
    if (dayOfWeek === 0 || dayOfWeek === 1) {
      // Sunday & Monday: Today LEFT, Tomorrow MIDDLE, This Week RIGHT
      return ['today', 'tomorrow', 'this-week'];
    } else if (dayOfWeek === 2 || dayOfWeek === 3) {
      // Tuesday & Wednesday: This Week LEFT, Today MIDDLE, Tomorrow RIGHT
      return ['this-week', 'today', 'tomorrow'];
    } else {
      // Thursday, Friday, Saturday: Tomorrow LEFT, This Week MIDDLE, Today RIGHT
      return ['tomorrow', 'this-week', 'today'];
    }
  };
  
  // Box order state - initialized from day-based default, but can be dragged
  const [boxOrder, setBoxOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('boxOrder');
    const savedDate = localStorage.getItem('boxOrderDate');
    const today = new Date().toDateString();
    
    // Reset to day-based default if it's a new day (midnight reset)
    if (savedDate !== today) {
      return getDefaultBoxOrder();
    }
    
    return saved ? JSON.parse(saved) : getDefaultBoxOrder();
  });
  
  // Reset box order at midnight (when date changes)
  useEffect(() => {
    const checkMidnight = () => {
      const savedDate = localStorage.getItem('boxOrderDate');
      const today = new Date().toDateString();
      
      if (savedDate !== today) {
        const newOrder = getDefaultBoxOrder();
        setBoxOrder(newOrder);
        localStorage.setItem('boxOrder', JSON.stringify(newOrder));
        localStorage.setItem('boxOrderDate', today);
      }
    };
    
    // Check every minute for midnight
    const interval = setInterval(checkMidnight, 60000);
    
    // Also save current date on mount
    localStorage.setItem('boxOrderDate', new Date().toDateString());
    
    return () => clearInterval(interval);
  }, []);
  
  // Color settings
  const [colorSettings, setColorSettings] = useState<{
    boxBackground: string;
    headerBar: string;
    mainBackground: string;
  }>(() => {
    const saved = localStorage.getItem('colorSettings');
    return saved ? JSON.parse(saved) : {
      boxBackground: '#01a0af',
      headerBar: '#000000',
      mainBackground: '#1a1a2e'
    };
  });
  
  // Store original settings when dialog opens (for cancel functionality)
  const [originalColorSettings, setOriginalColorSettings] = useState(colorSettings);
  const [originalBlinkSettings, setOriginalBlinkSettings] = useState(blinkSettings);
  
  // Grid size settings for resizable calendar columns and rows
  const [gridSizes, setGridSizes] = useState<{
    timeColumnWidth: number;
    moduleColumnWidth: number;
    dayColumnWidths: number[];
    allDayRowHeight: number;
    courseRowHeight: number;
    timeSlotHeight: number;
    timeSlotHeights: number[]; // Individual heights for each hour (0-23)
  }>(() => {
    const saved = localStorage.getItem('gridSizes');
    const defaultHeights = Array(24).fill(36); // Default 36px for each hour
    if (saved) {
      const parsed = JSON.parse(saved);
      // Always reset timeSlotHeights to default uniform heights
      parsed.timeSlotHeights = defaultHeights;
      parsed.timeSlotHeight = 36;
      parsed.courseRowHeight = 48;
      // Set moduleColumnWidth to 0 (column removed)
      parsed.moduleColumnWidth = 0;
      // Force timeColumnWidth to 59
      parsed.timeColumnWidth = 59;
      return parsed;
    }
    return {
      timeColumnWidth: 59,
      moduleColumnWidth: 0,
      dayColumnWidths: [1, 1, 1, 1, 1, 1, 1], // flex proportions
      allDayRowHeight: 36,
      courseRowHeight: 48,
      timeSlotHeight: 36,
      timeSlotHeights: defaultHeights
    };
  });
  
  // Save grid sizes to localStorage
  useEffect(() => {
    localStorage.setItem('gridSizes', JSON.stringify(gridSizes));
  }, [gridSizes]);
  
  // Column resize state
  const [columnResizing, setColumnResizing] = useState<{
    isResizing: boolean;
    columnIndex: number; // -1 for time column, 0-6 for day columns
    startX: number;
    startWidth: number;
  } | null>(null);
  
  // Row resize state
  const [rowResizing, setRowResizing] = useState<{
    isResizing: boolean;
    rowType: 'allDay' | 'course' | 'timeSlot';
    hourIndex?: number; // For individual time slot row resizing
    startY: number;
    startHeight: number;
  } | null>(null);
  
  // Handle column resize
  const handleColumnResizeStart = (e: React.MouseEvent, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnIndex === -1 
      ? gridSizes.timeColumnWidth 
      : columnIndex === -2
        ? gridSizes.moduleColumnWidth
        : gridSizes.dayColumnWidths[columnIndex];
    setColumnResizing({
      isResizing: true,
      columnIndex,
      startX: e.clientX,
      startWidth
    });
  };
  
  // Handle row resize
  const handleRowResizeStart = (e: React.MouseEvent, rowType: 'allDay' | 'course' | 'timeSlot', hourIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    let startHeight: number;
    if (rowType === 'allDay') {
      startHeight = gridSizes.allDayRowHeight;
    } else if (rowType === 'course') {
      startHeight = gridSizes.courseRowHeight;
    } else if (hourIndex !== undefined) {
      startHeight = gridSizes.timeSlotHeights[hourIndex];
    } else {
      startHeight = gridSizes.timeSlotHeight;
    }
    setRowResizing({
      isResizing: true,
      rowType,
      hourIndex,
      startY: e.clientY,
      startHeight
    });
  };
  
  // Global mouse move/up handlers for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (columnResizing?.isResizing) {
        const delta = e.clientX - columnResizing.startX;
        if (columnResizing.columnIndex === -1) {
          // Resizing time column
          const newWidth = Math.max(115, Math.min(200, columnResizing.startWidth + delta));
          setGridSizes(prev => ({ ...prev, timeColumnWidth: newWidth }));
        } else if (columnResizing.columnIndex === -2) {
          // Resizing module column
          const newWidth = Math.max(50, Math.min(150, columnResizing.startWidth + delta));
          setGridSizes(prev => ({ ...prev, moduleColumnWidth: newWidth }));
        } else {
          // Resizing day column - adjust flex proportion
          const newWidths = [...gridSizes.dayColumnWidths];
          const newProportion = Math.max(0.5, columnResizing.startWidth + delta / 100);
          newWidths[columnResizing.columnIndex] = newProportion;
          setGridSizes(prev => ({ ...prev, dayColumnWidths: newWidths }));
        }
      }
      if (rowResizing?.isResizing) {
        const delta = e.clientY - rowResizing.startY;
        const newHeight = Math.max(20, rowResizing.startHeight + delta);
        if (rowResizing.rowType === 'allDay') {
          setGridSizes(prev => ({ ...prev, allDayRowHeight: Math.min(100, newHeight) }));
        } else if (rowResizing.rowType === 'course') {
          setGridSizes(prev => ({ ...prev, courseRowHeight: Math.min(60, newHeight) }));
        } else if (rowResizing.rowType === 'timeSlot' && rowResizing.hourIndex !== undefined) {
          // Individual time slot row resizing - minimum 24px to keep time text visible
          setGridSizes(prev => {
            const newHeights = [...prev.timeSlotHeights];
            newHeights[rowResizing.hourIndex!] = Math.max(24, Math.min(150, newHeight));
            return { ...prev, timeSlotHeights: newHeights };
          });
        } else if (rowResizing.rowType === 'timeSlot') {
          // Global time slot resizing (fallback)
          setGridSizes(prev => ({ ...prev, timeSlotHeight: Math.min(100, newHeight) }));
        }
      }
    };
    
    const handleMouseUp = () => {
      setColumnResizing(null);
      setRowResizing(null);
    };
    
    if (columnResizing?.isResizing || rowResizing?.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = columnResizing?.isResizing ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [columnResizing, rowResizing, gridSizes.dayColumnWidths]);
  
  // Generate grid template columns based on sizes
  const getGridTemplateColumns = () => {
    const dayColumns = gridSizes.dayColumnWidths.map(w => `${w}fr`).join(' ');
    // Only include module column if width > 0
    if (gridSizes.moduleColumnWidth > 0) {
      return `${gridSizes.timeColumnWidth}px ${gridSizes.moduleColumnWidth}px ${dayColumns}`;
    }
    return `${gridSizes.timeColumnWidth}px ${dayColumns}`;
  };
  
  const [draggedBox, setDraggedBox] = useState<string | null>(null);
  
  // Save box order to localStorage
  useEffect(() => {
    localStorage.setItem('boxOrder', JSON.stringify(boxOrder));
  }, [boxOrder]);
  
  const handleBoxDragStart = (boxId: string) => {
    setDraggedBox(boxId);
  };
  
  const handleBoxDragOver = (e: React.DragEvent, targetBoxId: string) => {
    e.preventDefault();
    if (draggedBox && draggedBox !== targetBoxId) {
      const newOrder = [...boxOrder];
      const draggedIdx = newOrder.indexOf(draggedBox);
      const targetIdx = newOrder.indexOf(targetBoxId);
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedBox);
      setBoxOrder(newOrder);
    }
  };
  
  const handleBoxDragEnd = () => {
    setDraggedBox(null);
  };
  const [profileData, setProfileData] = useState<{ firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null }>(() => {
    const saved = localStorage.getItem('profileData');
    return saved ? JSON.parse(saved) : { firstName: 'Bryn', lastName: '', birthdate: '', timezone: 'America/Toronto', travelTimezone: null };
  });
  const [schoolData, setSchoolData] = useState<{ schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string }>(() => {
    const saved = localStorage.getItem('schoolData');
    return saved ? JSON.parse(saved) : { schoolLogo: null, numberOfWeeks: 13, week1StartDate: '2026-01-17', firstDayOfWeek: 'saturday' };
  });
  
  const [coursesData, setCoursesData] = useState<{ courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> }>(() => {
    const defaultCourses = [
      { name: 'CPPA122 - Local Politics', color: '#22c55e', professor: 'Caryl Arundel', professorEmail: 'carundel@torontomu.ca' },
      { name: 'CFNF400 - Human Sexuality', color: '#ec4899', professor: 'Alex McKay', professorEmail: 'a4mckay@torontomu.ca' },
      { name: 'CASL101 - American Sign Language', color: '#6366f1', professor: 'Christina Moreau', professorEmail: 'christina.moreau@torontomu.ca' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
      { name: '', color: '#6b7280', professor: '', professorEmail: '' },
    ];
    // Always use defaults for professor emails to ensure they stay current
    const saved = localStorage.getItem('coursesData');
    if (saved) {
      const parsed = JSON.parse(saved);
      const hasNamedCourses = parsed.courses?.some((c: { name: string }) => c.name.trim());
      if (hasNamedCourses) {
        // Keep course names/colors from saved, but always use default professor emails
        const coursesWithProfessor = parsed.courses.map((c: { name: string; color: string; professor?: string; professorEmail?: string }, i: number) => ({
          ...c,
          professor: c.professor ?? defaultCourses[i]?.professor ?? '',
          professorEmail: defaultCourses[i]?.professorEmail ?? ''
        }));
        localStorage.setItem('coursesData', JSON.stringify({ courses: coursesWithProfessor }));
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
  const [todoItems, setTodoItems] = useState<string[]>(Array(20).fill(""));
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

  const toggleFileComplete = (fileKey: string) => {
    setCompletedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileKey)) {
        newSet.delete(fileKey);
      } else {
        newSet.add(fileKey);
      }
      localStorage.setItem('completedFiles', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
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
    if (!window.speechSynthesis) return; // Not available on Fire tablets
    try {
      const utterance = new SpeechSynthesisUtterance("New Day");
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      // Try to find a female voice
      const voices = window.speechSynthesis.getVoices() || [];
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

  // Files for weekly files flyout (moved up for allTaskFiles dependency)
  interface WeeklyFile {
    id: number;
    originalName: string;
    displayName: string;
    objectPath: string;
    contentType: string;
    size: number;
    folder: string | null;
    listened?: boolean;
  }
  
  const { data: weeklyFiles = [] } = useQuery<WeeklyFile[]>({
    queryKey: ["/api/files"],
  });

  // Extract all unique files from tasks for the FILES row
  const allTaskFiles = useMemo(() => {
    const filesMap = new Map<string, { name: string; url: string; taskId: number; courseName: string }>();
    tasks?.forEach(task => {
      if (task.attachments && Array.isArray(task.attachments)) {
        task.attachments.forEach((att: any) => {
          let fileData: { name: string; url: string };
          if (typeof att === 'string') {
            try {
              const parsed = JSON.parse(att);
              fileData = { name: parsed.name || parsed.url?.split('/').pop() || 'File', url: parsed.url || att };
            } catch {
              fileData = { name: att.split('/').pop() || 'File', url: att };
            }
          } else {
            fileData = { name: att.name || att.url?.split('/').pop() || 'File', url: att.url || '' };
          }
          // Try to find matching file in weeklyFiles for displayName
          const matchingWeeklyFile = weeklyFiles.find(wf => wf.objectPath === fileData.url || fileData.url.includes(wf.objectPath));
          if (matchingWeeklyFile) {
            fileData.name = matchingWeeklyFile.displayName || matchingWeeklyFile.originalName || fileData.name;
          }
          const key = fileData.url;
          if (!filesMap.has(key)) {
            filesMap.set(key, { ...fileData, taskId: task.id, courseName: task.courseName || '' });
          }
        });
      }
    });
    return Array.from(filesMap.values());
  }, [tasks, weeklyFiles]);

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

  // Filter files for the current week (exclude completed/listened files)
  const currentWeekFiles = weeklyFiles.filter(f => 
    (f.folder?.startsWith(`week-${selectedWeek}`) || f.folder === `week-${selectedWeek}`) && !f.listened
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
    listened?: boolean;
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
  
  // Chunked TTS state for reliable playback
  const [ttsChunks, setTtsChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const ttsChunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const shouldContinueRef = useRef(false);
  
  // Save/load TTS progress for each file
  const getTtsProgress = (fileId: number): { chunkIndex: number; wordIndex: number } | null => {
    try {
      const saved = localStorage.getItem(`tts-progress-${fileId}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };
  
  const saveTtsProgress = (fileId: number, chunkIndex: number, wordIndex: number) => {
    try {
      localStorage.setItem(`tts-progress-${fileId}`, JSON.stringify({ chunkIndex, wordIndex }));
    } catch {}
  };
  
  const clearTtsProgress = (fileId: number) => {
    try {
      localStorage.removeItem(`tts-progress-${fileId}`);
    } catch {}
  };
  
  // Load available TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Filter to English voices and sort by name
        const englishVoices = voices.filter(v => v.lang.startsWith('en')).sort((a, b) => a.name.localeCompare(b.name));
        setAvailableVoices(englishVoices.length > 0 ? englishVoices : voices);
        // Set default voice - prefer Guy
        if (!selectedVoice) {
          const defaultVoice = englishVoices.find(v => v.name.includes('Guy'))
            || englishVoices.find(v => v.name.includes('Microsoft') && v.name.includes('Natural'))
            || englishVoices[0];
          if (defaultVoice) setSelectedVoice(defaultVoice.name);
        }
      }
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
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
  
  // Helper to wait for voices to be loaded (Chrome/Android fix)
  const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve([]);
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        resolve(voices);
        return;
      }
      // Chrome loads voices asynchronously
      const handleVoicesChanged = () => {
        const loadedVoices = window.speechSynthesis.getVoices();
        resolve(loadedVoices || []);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true });
      // Timeout after 3 seconds
      setTimeout(() => {
        const fallbackVoices = window.speechSynthesis.getVoices() || [];
        resolve(fallbackVoices);
      }, 3000);
    });
  };
  
  // Split text into chunks at sentence boundaries for reliable TTS
  const splitTextIntoChunks = (text: string, maxChunkSize: number = 2000): string[] => {
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxChunkSize) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good break point (end of sentence)
      let breakPoint = remaining.lastIndexOf('. ', maxChunkSize);
      if (breakPoint === -1 || breakPoint < maxChunkSize / 2) {
        breakPoint = remaining.lastIndexOf('? ', maxChunkSize);
      }
      if (breakPoint === -1 || breakPoint < maxChunkSize / 2) {
        breakPoint = remaining.lastIndexOf('! ', maxChunkSize);
      }
      if (breakPoint === -1 || breakPoint < maxChunkSize / 2) {
        breakPoint = remaining.lastIndexOf('\n', maxChunkSize);
      }
      if (breakPoint === -1 || breakPoint < maxChunkSize / 2) {
        breakPoint = remaining.lastIndexOf(' ', maxChunkSize);
      }
      if (breakPoint === -1) {
        breakPoint = maxChunkSize;
      }
      
      chunks.push(remaining.substring(0, breakPoint + 1).trim());
      remaining = remaining.substring(breakPoint + 1).trim();
    }
    
    return chunks.filter(c => c.length > 0);
  };

  // Speak a single chunk and continue to next
  const speakChunk = async (chunkIndex: number, chunks: string[], voices: SpeechSynthesisVoice[], wordOffset: number = 0) => {
    if (chunkIndex >= chunks.length || !shouldContinueRef.current) {
      // Finished all chunks
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (previewFile) {
        clearTtsProgress(previewFile.id);
        toast({ title: "Finished reading file" });
      }
      return;
    }
    
    const chunk = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = browserTtsRate;
    utterance.pitch = 1;
    
    // Use selected voice
    const voice = selectedVoice 
      ? voices.find(v => v.name === selectedVoice)
      : voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) 
        || voices.find(v => v.name.includes('Microsoft') && v.name.includes('Natural'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
    if (voice) {
      utterance.voice = voice;
    }
    
    // Track word position for highlighting
    let localWordIndex = 0;
    const chunkWordCount = chunk.split(/\s+/).length;
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentWordIndex(wordOffset + localWordIndex);
        localWordIndex++;
        // Save progress periodically
        if (previewFile && localWordIndex % 10 === 0) {
          saveTtsProgress(previewFile.id, chunkIndex, localWordIndex);
        }
      }
    };
    
    utterance.onstart = () => {
      console.log(`Chunk ${chunkIndex + 1}/${chunks.length} started`);
      setCurrentChunkIndex(chunkIndex);
      currentChunkIndexRef.current = chunkIndex;
    };
    
    utterance.onend = () => {
      console.log(`Chunk ${chunkIndex + 1}/${chunks.length} ended`);
      if (shouldContinueRef.current) {
        // Small delay before next chunk to prevent Chrome issues
        setTimeout(() => {
          speakChunk(chunkIndex + 1, chunks, voices, wordOffset + chunkWordCount);
        }, 100);
      }
    };
    
    utterance.onerror = (event) => {
      console.error("Speech error:", event.error);
      // On interrupted, don't show error - user stopped it
      if (event.error !== 'interrupted') {
        toast({ title: `Speech paused at chunk ${chunkIndex + 1}. Tap play to resume.`, variant: "default" });
        if (previewFile) {
          saveTtsProgress(previewFile.id, chunkIndex, localWordIndex);
        }
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Play from a specific chunk index
  const playFromChunk = async (chunkIndex: number) => {
    if (!window.speechSynthesis) {
      toast({ title: "Browser TTS not available on this device", variant: "destructive" });
      return;
    }
    
    // Auto-switch to browser TTS for chunk playback
    if (previewSpeaker !== "browser_tts") {
      setPreviewSpeaker("browser_tts");
    }
    
    // Make sure we have chunks
    if (ttsChunksRef.current.length === 0) {
      // Need to split the text first
      if (!previewText) {
        toast({ title: "No text content available", variant: "destructive" });
        return;
      }
      const cleanTextForTts = previewText.replace(/---PAGE---/g, '');
      const chunks = splitTextIntoChunks(cleanTextForTts, 2000);
      ttsChunksRef.current = chunks;
      setTtsChunks(chunks);
      setTotalChunks(chunks.length);
    }
    
    const chunks = ttsChunksRef.current;
    if (chunkIndex >= chunks.length) {
      toast({ title: "Invalid chunk index", variant: "destructive" });
      return;
    }
    
    // Cancel any current speech
    window.speechSynthesis.cancel();
    shouldContinueRef.current = false;
    await new Promise(r => setTimeout(r, 100));
    
    // Wait for voices
    const voices = await waitForVoices();
    if (voices.length === 0) {
      toast({ title: "No TTS voices found", variant: "destructive" });
      return;
    }
    
    // Calculate word offset for highlighting
    let wordOffset = 0;
    for (let i = 0; i < chunkIndex; i++) {
      wordOffset += chunks[i].split(/\s+/).length;
    }
    
    // Start playing from this chunk
    setCurrentChunkIndex(chunkIndex);
    currentChunkIndexRef.current = chunkIndex;
    shouldContinueRef.current = true;
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    toast({ title: `Playing from section ${chunkIndex + 1} of ${chunks.length}` });
    speakChunk(chunkIndex, chunks, voices, wordOffset);
  };

  const handlePlayFile = async (fileUrl: string, fileName: string, resumeFromProgress: boolean = false) => {
    try {
      // Check if using browser TTS only
      if (previewSpeaker === "browser_tts") {
        if (!window.speechSynthesis) {
          toast({ title: "Browser TTS not available on this device", variant: "destructive" });
          return;
        }
        if (!previewText) {
          toast({ title: "No text content available", variant: "destructive" });
          return;
        }
        
        // Cancel any existing speech
        window.speechSynthesis.cancel();
        shouldContinueRef.current = false;
        await new Promise(r => setTimeout(r, 100));
        
        // Wait for voices to load
        const voices = await waitForVoices();
        console.log("Available voices:", voices.length);
        
        if (voices.length === 0) {
          toast({ title: "No TTS voices found. Make sure Chrome has TTS enabled.", variant: "destructive" });
          return;
        }
        
        // Remove page markers and split into chunks
        const cleanTextForTts = previewText.replace(/---PAGE---/g, '');
        const chunks = splitTextIntoChunks(cleanTextForTts, 2000);
        
        ttsChunksRef.current = chunks;
        setTtsChunks(chunks);
        setTotalChunks(chunks.length);
        
        // Check for saved progress
        let startChunk = 0;
        let startWordOffset = 0;
        if (resumeFromProgress && previewFile) {
          const progress = getTtsProgress(previewFile.id);
          if (progress) {
            startChunk = progress.chunkIndex;
            // Calculate word offset from previous chunks
            for (let i = 0; i < startChunk; i++) {
              startWordOffset += chunks[i].split(/\s+/).length;
            }
            toast({ title: `Resuming from chunk ${startChunk + 1} of ${chunks.length}` });
          }
        }
        
        setCurrentChunkIndex(startChunk);
        currentChunkIndexRef.current = startChunk;
        shouldContinueRef.current = true;
        setIsPlaying(true);
        isPlayingRef.current = true;
        
        toast({ title: `Reading: ${fileName} (${chunks.length} sections)` });
        
        // Start speaking from the appropriate chunk
        speakChunk(startChunk, chunks, voices, startWordOffset);
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
      if (previewSpeaker === "browser_tts" && window.speechSynthesis) {
        shouldContinueRef.current = false; // Stop chunk chain
        window.speechSynthesis.cancel();
        
        // Save progress so user can resume later
        if (previewFile && currentChunkIndexRef.current > 0) {
          saveTtsProgress(previewFile.id, currentChunkIndexRef.current, currentWordIndex);
          toast({ title: `Paused at section ${currentChunkIndexRef.current + 1} of ${totalChunks}. Progress saved.` });
        }
        
        setIsPlaying(false);
        isPlayingRef.current = false;
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

  // Skip forward/back functions for browser TTS and Echo
  const handleSkipForward = async () => {
    if (previewSpeaker !== "browser_tts") {
      // For Echo speakers - call seek API
      try {
        await fetch('/api/media/seek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'forward', entityId: 'media_player.echo_lr_studio_white_am' }),
        });
      } catch (error) {
        console.error('Seek forward error:', error);
      }
      return;
    }
    if (!previewText || !window.speechSynthesis) return;
    
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
      const voices = window.speechSynthesis.getVoices() || [];
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

  // Restart from very beginning (first chunk)
  const handleRestartFromBeginning = async () => {
    if (previewSpeaker !== "browser_tts") {
      // For Echo speakers - restart from beginning
      if (previewFile) {
        handlePlayFile(previewFile.objectPath, previewFile.displayName || previewFile.originalName);
      }
      return;
    }
    if (!previewText || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    setCurrentWordIndex(0);
    setCurrentPdfPage(1);
    
    // Start playing from beginning
    const words = previewText.split(/\s+/).filter(w => w.length > 0 && w !== '---PAGE---');
    const utterance = new SpeechSynthesisUtterance(words.join(' '));
    utterance.rate = browserTtsRate;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices() || [];
    const voice = selectedVoice ? voices.find(v => v.name === selectedVoice) : voices[0];
    if (voice) utterance.voice = voice;
    
    let localWordIdx = 0;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentWordIndex(localWordIdx);
        localWordIdx++;
      }
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    
    setIsPlaying(true);
    isPlayingRef.current = true;
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    toast({ title: "Restarted from beginning" });
  };
  
  // Restart current chunk (replay from current position)
  const handleRestartCurrentChunk = async () => {
    if (previewSpeaker !== "browser_tts") {
      // For Echo speakers - just replay
      toast({ title: "Replaying current section" });
      return;
    }
    if (!previewText || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    // Start playing from current word index
    const words = previewText.split(/\s+/).filter(w => w.length > 0 && w !== '---PAGE---');
    const remainingText = words.slice(currentWordIndex).join(' ');
    const utterance = new SpeechSynthesisUtterance(remainingText);
    utterance.rate = browserTtsRate;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices() || [];
    const voice = selectedVoice ? voices.find(v => v.name === selectedVoice) : voices[0];
    if (voice) utterance.voice = voice;
    
    let localWordIdx = 0;
    const startIndex = currentWordIndex;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentWordIndex(startIndex + localWordIdx);
        localWordIdx++;
      }
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    
    setIsPlaying(true);
    isPlayingRef.current = true;
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    toast({ title: "Restarted current section" });
  };

  const handleSkipBack = async () => {
    if (previewSpeaker !== "browser_tts") {
      // For Echo speakers - call seek API
      try {
        await fetch('/api/media/seek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'backward', entityId: 'media_player.echo_lr_studio_white_am' }),
        });
      } catch (error) {
        console.error('Seek backward error:', error);
      }
      return;
    }
    if (!previewText || !window.speechSynthesis) return;
    
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
      const voices = window.speechSynthesis.getVoices() || [];
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
    course1ProfessorEmail: "",
    course2Code: "",
    course2Name: "",
    course2Professor: "",
    course2ProfessorEmail: "",
    course3Code: "",
    course3Name: "",
    course3Professor: "",
    course3ProfessorEmail: "",
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      if (variables.isCompleted) {
        setLastCompletedTaskId(variables.id);
        localStorage.setItem('lastCompletedTaskId', variables.id.toString());
        setShowCelebration(true);
      }
    },
  });

  const handleUndoComplete = () => {
    if (lastCompletedTaskId) {
      completeMutation.mutate({ id: lastCompletedTaskId, isCompleted: false });
      setLastCompletedTaskId(null);
      localStorage.removeItem('lastCompletedTaskId');
    }
  };

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
    mutationFn: async ({ id, newDate, newHour, newMinutes = 0 }: { id: number; newDate: Date; newHour: number; newMinutes?: number }) => {
      const updatedDueDate = new Date(newDate);
      updatedDueDate.setHours(newHour, newMinutes, 0, 0);
      return apiRequest("PATCH", `/api/tasks/${id}`, { 
        dueDate: updatedDueDate.toISOString(),
        eventStartTime: `${newHour.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  // General task update mutation (for courseName, startDate, etc.)
  const updateTaskFieldsMutation = useMutation({
    mutationFn: async ({ id, ...fields }: { id: number; [key: string]: any }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, fields);
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
        course1ProfessorEmail: data.course1ProfessorEmail || null,
        course2Code: data.course2Code,
        course2Name: data.course2Name,
        course2Professor: data.course2Professor || null,
        course2ProfessorEmail: data.course2ProfessorEmail || null,
        course3Code: data.course3Code,
        course3Name: data.course3Name,
        course3Professor: data.course3Professor || null,
        course3ProfessorEmail: data.course3ProfessorEmail || null,
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
      setShowCelebration(true);
    },
  });

  // Mutation to attach a file to an existing task
  const attachFileToTaskMutation = useMutation({
    mutationFn: async ({ taskId, filePath, fileName }: { taskId: number; filePath: string; fileName: string }) => {
      // Get the current task first
      const currentTask = tasks?.find(t => t.id === taskId);
      const currentAttachments = currentTask?.attachments || [];
      const newAttachment = JSON.stringify({ url: filePath, name: fileName });
      const updatedAttachments = [...currentAttachments, newAttachment];
      return apiRequest("PATCH", `/api/tasks/${taskId}`, {
        attachments: updatedAttachments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "File attached to task" });
    },
  });

  // Handle file drop on a task
  const handleFileDropOnTask = (e: React.DragEvent, taskId: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const fileData = JSON.parse(data);
        attachFileToTaskMutation.mutate({ 
          taskId, 
          filePath: fileData.url, 
          fileName: fileData.name 
        });
      }
    } catch (err) {
      console.error('Error handling file drop:', err);
    }
    setDraggedFile(null);
  };

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
    
    // Detect if drop was in top or bottom half of cell for half-hour precision
    const rect = e.currentTarget.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    const isBottomHalf = dropY > rect.height / 2;
    const minutes = isBottomHalf ? 30 : 0;
    
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
      // Moving an existing task - include minutes for half-hour precision
      updateTaskTimeMutation.mutate({ id: draggedTask.id, newDate: day, newHour: hour, newMinutes: minutes });
    }
    
    setDraggedTask(null);
    setDragOverSlot(null);
  };

  // Handle dropping a task onto a course row
  const handleCourseRowDrop = async (e: React.DragEvent, courseName: string, day: Date) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedTask) {
      // Find the full course info from coursesData
      // The course.name already contains the full name like "CPPA122 - Local Politics"
      const courseInfo = coursesData.courses.find((c) => c.name === courseName);
      const fullCourseName = courseInfo?.name || courseName;
      
      // weekDays structure is always: [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
      // Sunday is index 0, Friday is index 5
      const weekStartDay = new Date(weekDays[0]); // Sunday
      weekStartDay.setHours(0, 0, 0, 0);
      
      const weekEndDay = new Date(weekDays[5]); // Friday is always index 5
      weekEndDay.setHours(23, 59, 59, 0);
      
      // Update the task's courseName, startDate to beginning and dueDate to Friday
      updateTaskFieldsMutation.mutate({
        id: draggedTask.id,
        courseName: fullCourseName,
        startDate: weekStartDay.toISOString(),
        dueDate: weekEndDay.toISOString(),
      });
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
  
  // New task filters for Due Today, Due Tomorrow, Due This Week boxes
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Due Today: all tasks due today (not prep tasks, actual due dates)
  // Also include full-week MODULE tasks that span today (startDate <= today <= dueDate)
  const dueTodayTasks = allTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (!t.dueDate) return false;
    
    // Check if task is due today
    if (isSameDay(new Date(t.dueDate), today)) return true;
    
    // Check if this is a full-week MODULE task that spans today
    // Full-week tasks have startDate and dueDate on different days (Sunday to Friday)
    if (t.startDate) {
      const taskStartDate = startOfDay(new Date(t.startDate));
      const taskDueDate = startOfDay(new Date(t.dueDate));
      const todayStart = startOfDay(today);
      
      // If today falls within the task's planning period, include it
      if (taskStartDate <= todayStart && todayStart <= taskDueDate) {
        return true;
      }
    }
    
    return false;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  // Due Tomorrow: all tasks due tomorrow
  // Also include tasks where tomorrow falls within the prep period (startDate <= tomorrow <= dueDate)
  const dueTomorrowTasks = allTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (!t.dueDate) return false;
    
    // Check if task is due tomorrow
    if (isSameDay(new Date(t.dueDate), tomorrow)) return true;
    
    // Check if tomorrow falls within the task's planning/prep period
    if (t.startDate) {
      const taskStartDate = startOfDay(new Date(t.startDate));
      const taskDueDate = startOfDay(new Date(t.dueDate));
      const tomorrowStart = startOfDay(tomorrow);
      
      // If tomorrow falls within the task's planning period, include it as prep task
      if (taskStartDate <= tomorrowStart && tomorrowStart < taskDueDate) {
        return true;
      }
    }
    
    return false;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  // Due This Week: tasks due on remaining school week days (not today, not tomorrow)
  // School week is Mon-Fri, so we need to find remaining days until Friday
  const dueThisWeekTasks = allTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const dueDateStart = startOfDay(dueDate);
    const todayStart = startOfDay(today);
    const tomorrowStart = startOfDay(tomorrow);
    // Not today or tomorrow
    if (isSameDay(dueDateStart, todayStart) || isSameDay(dueDateStart, tomorrowStart)) return false;
    // Must be after tomorrow
    if (dueDateStart <= tomorrowStart) return false;
    // Must be within the current school week (Mon-Fri)
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    // Find end of school week (Friday)
    const daysUntilFriday = dayOfWeek === 0 ? 5 : dayOfWeek === 6 ? 6 : 5 - dayOfWeek;
    const endOfSchoolWeek = new Date(today);
    endOfSchoolWeek.setDate(today.getDate() + daysUntilFriday);
    endOfSchoolWeek.setHours(23, 59, 59, 999);
    return dueDateStart <= endOfSchoolWeek;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  // Calculate shared row heights for consistent sizing between Urgent and Overdue boxes
  const cppa122Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CPPA122")).length, missedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length) * 64;
  const cfnf400Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CFNF400")).length, missedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length) * 64;
  const casl101Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CASL101")).length, missedTasks.filter(t => t.courseName?.startsWith("CASL101")).length) * 64;

  // Weekly view - get the current selected week's days
  const selectedWeekInfo = weeks.find(w => w.weekNumber === selectedWeek);
  const weekStartDate = selectedWeekInfo ? parseISO(selectedWeekInfo.startDate) : new Date(2026, 0, 17);
  const weekEndDate = selectedWeekInfo ? parseISO(selectedWeekInfo.endDate) : new Date(2026, 0, 23);
  
  // Generate weekdays for the weekly view
  // School week runs Saturday to Friday, but we display Sunday-Saturday visually
  // Logic:
  // - On Sunday through Friday: Saturday column shows the upcoming Saturday (end of this school week)
  // - On Saturday: Sunday-Friday columns show NEXT week's dates
  const currentDate = new Date();
  const currentDayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
  const isTodaySaturday = currentDayOfWeek === 6;
  
  // Get the raw days from the school week (Saturday to Friday)
  const rawWeekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });
  
  let weekDays: Date[];
  if (rawWeekDays.length === 7) {
    // rawWeekDays[0] = Saturday (start of school week), rawWeekDays[1-6] = Sun-Fri
    if (isTodaySaturday) {
      // On Saturday: Sun-Fri should be NEXT week, Saturday stays the same
      // So we add 7 days to Sun-Fri but keep Saturday as is
      const saturdayDate = rawWeekDays[0]; // Current Saturday
      const nextWeekSunToFri = rawWeekDays.slice(1).map(d => addDays(d, 7));
      weekDays = [...nextWeekSunToFri, saturdayDate];
    } else {
      // On Sunday-Friday: Show current week with Saturday at end
      // Saturday should be the UPCOMING Saturday (end of school week = Friday + 1 day)
      const upcomingSaturday = addDays(rawWeekDays[6], 1); // Friday + 1 = Saturday
      weekDays = [...rawWeekDays.slice(1), upcomingSaturday];
    }
  } else {
    weekDays = rawWeekDays;
  }
  
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

  // Calculate arrow connections from task boxes to calendar
  useEffect(() => {
    if (calendarView !== "week") {
      setArrowConnections([]);
      return;
    }
    
    const calculateArrows = () => {
      const connections: typeof arrowConnections = [];
      const todayTaskIds = new Set(dueTodayTasks.map(t => t.id));
      const tomorrowTaskIds = new Set(dueTomorrowTasks.map(t => t.id));
      
      // Create task entries with their source box type
      const tasksWithBox: Array<{task: typeof dueTodayTasks[0], boxType: 'today' | 'tomorrow' | 'thisweek'}> = [
        ...dueTodayTasks.map(t => ({ task: t, boxType: 'today' as const })),
        ...dueTomorrowTasks.map(t => ({ task: t, boxType: 'tomorrow' as const })),
        ...dueThisWeekTasks.map(t => ({ task: t, boxType: 'thisweek' as const }))
      ];
      
      // Deduplicate by task ID + boxType combination to allow one arrow per box
      const seenKeys = new Set<string>();
      const uniqueTasksWithBox = tasksWithBox.filter(({ task, boxType }) => {
        const key = `${task.id}-${boxType}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
      
      uniqueTasksWithBox.forEach(({ task, boxType }) => {
        // Find the task card in the specific box using the checkbox attribute
        let checkboxEl: Element | null = null;
        let boxTaskEl: Element | null = null;
        
        if (boxType === 'today') {
          checkboxEl = document.querySelector(`input[data-today-checkbox="${task.id}"]`);
          boxTaskEl = checkboxEl?.closest(`[data-box-task-id="${task.id}"]`) || null;
        } else if (boxType === 'tomorrow') {
          checkboxEl = document.querySelector(`input[data-tomorrow-checkbox="${task.id}"]`);
          boxTaskEl = checkboxEl?.closest(`[data-box-task-id="${task.id}"]`) || null;
        } else {
          // For this week, use the generic selector
          boxTaskEl = document.querySelector(`[data-box-task-id="${task.id}"]`);
          checkboxEl = boxTaskEl?.querySelector('[role="checkbox"], input[type="checkbox"], button[data-state]') || null;
        }
        
        // Determine which date to target based on boxType
        let targetDateStr: string;
        if (boxType === 'today') {
          targetDateStr = format(today, 'yyyy-MM-dd');
        } else if (boxType === 'tomorrow') {
          targetDateStr = format(tomorrow, 'yyyy-MM-dd');
        } else {
          // For this week, use the task's due date
          targetDateStr = format(new Date(task.dueDate), 'yyyy-MM-dd');
        }
        
        // Find the corresponding task on the calendar that matches the target date
        const calTaskEls = Array.from(document.querySelectorAll(`[data-cal-task-id="${task.id}"]`));
        let calTaskEl: Element | null = null;
        
        // Find the calendar task element that matches the target date
        for (const el of calTaskEls) {
          const calDate = el.getAttribute('data-cal-date');
          if (calDate === targetDateStr) {
            calTaskEl = el;
            break;
          }
        }
        
        // Skip if no matching calendar task found for this date
        if (!calTaskEl) {
          return;
        }
        
        // Always target the calendar task checkbox
        if (boxTaskEl && calTaskEl) {
          const calRect = calTaskEl.getBoundingClientRect();
          
          // Skip if calendar task has invalid dimensions (not rendered properly)
          if (calRect.width === 0 || calRect.height === 0) {
            return;
          }
          
          // Skip if calendar task is scrolled behind course rows (above the visible scroll area)
          // Find the course rows container to get its bottom position
          const courseRowsContainer = document.querySelector('[data-testid="course-rows-container"]');
          if (courseRowsContainer) {
            const courseRowsRect = courseRowsContainer.getBoundingClientRect();
            // If the bottom of the calendar task is above the bottom of course rows, it's hidden
            if (calRect.bottom < courseRowsRect.bottom) {
              return;
            }
          }
          
          // Get course color - black for tasks without a course
          const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
          let color = "#000000";
          if (courseCode === "CPPA122") color = "#22c55e";
          else if (courseCode === "CFNF400") color = "#ec4899";
          else if (courseCode === "CASL101") color = "#6366f1";
          
          // Start arrow from left side of checkbox, or fall back to left of task box
          let fromX: number;
          let fromY: number;
          if (checkboxEl) {
            const checkboxRect = checkboxEl.getBoundingClientRect();
            fromX = checkboxRect.left;
            fromY = checkboxRect.top + checkboxRect.height / 2;
          } else {
            const boxRect = boxTaskEl.getBoundingClientRect();
            fromX = boxRect.left;
            fromY = boxRect.top + boxRect.height / 2;
          }
          
          // Always point to the calendar task checkbox (arrow pointing right, 2px away)
          let toX: number;
          let toY: number;
          const calCheckboxEl = calTaskEl.querySelector('[role="checkbox"], input[type="checkbox"], button[data-state]');
          
          if (calCheckboxEl) {
            const calCheckboxRect = calCheckboxEl.getBoundingClientRect();
            toX = calCheckboxRect.left - 2;
            toY = calCheckboxRect.top + calCheckboxRect.height / 2;
          } else {
            toX = calRect.left - 2;
            toY = calRect.top + calRect.height / 2;
          }
          
          // For green arrows (Tomorrow box), keep them visible even when calendar task is above viewport
          // For pink/blue arrows (This Week box), skip if target is completely off-screen
          const isGreenArrow = color === "#22c55e";
          if (!isGreenArrow) {
            // Skip pink/blue arrows when target is off-screen
            if (toX < 0 || toX > window.innerWidth || toY < 0 || toY > window.innerHeight) {
              return;
            }
          }
          
          connections.push({
            taskId: task.id,
            fromX,
            fromY,
            toX,
            toY,
            color,
            isToday: boxType === 'today',
            isTomorrow: boxType === 'tomorrow'
          });
        }
      });
      
      setArrowConnections(connections);
    };
    
    // Calculate after DOM updates (give time for prep-today elements to render)
    const timer = setTimeout(calculateArrows, 200);
    
    // Recalculate on scroll and resize
    const handleUpdate = () => setTimeout(calculateArrows, 50);
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [calendarView, dueTodayTasks, dueTomorrowTasks, dueThisWeekTasks]);

  // NEW: Calculate prep arrows from Today box to prep extensions
  useEffect(() => {
    if (calendarView !== "week") {
      setPrepArrowConnections([]);
      return;
    }
    
    const calculatePrepArrows = () => {
      const connections: typeof prepArrowConnections = [];
      
      // Helper function to add prep arrow connection pointing to specific day column
      const addPrepConnection = (task: typeof dueTodayTasks[0], checkboxSelector: string, targetDate: Date) => {
        // Check if this task has a prep extension (has startDate before dueDate)
        if (!task.startDate || !task.dueDate) return;
        
        const taskStartDate = startOfDay(new Date(task.startDate));
        const taskDueDate = startOfDay(new Date(task.dueDate));
        if (taskStartDate >= taskDueDate) return;
        
        // Only draw arrow if targetDate is a prep day (not the due date)
        const targetDateStart = startOfDay(targetDate);
        if (isSameDay(targetDateStart, taskDueDate)) return;
        
        // Find the checkbox using the specific attribute
        const checkboxEl = document.querySelector(checkboxSelector) as HTMLElement | null;
        
        // Find the prep extension element
        const prepExtensionEl = document.querySelector(`[data-testid="prep-extension-${task.id}"]`) as HTMLElement | null;
        
        if (checkboxEl && prepExtensionEl) {
          // Get course color - black for tasks without a course
          const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
          let color = "#000000"; // Default to black when no course
          if (courseCode === "CPPA122") color = "#22c55e";
          else if (courseCode === "CFNF400") color = "#ec4899";
          else if (courseCode === "CASL101") color = "#6366f1";
          
          // Calculate which day column within the prep extension corresponds to targetDate
          const daysDiff = Math.floor((targetDateStart.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24));
          const prepDaysCount = Math.floor((taskDueDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Get the prep extension position and size
          const prepRect = prepExtensionEl.getBoundingClientRect();
          const dayColumnWidth = prepRect.width / prepDaysCount;
          
          // Calculate the center of the target day's column within the prep extension
          const toX = prepRect.left + (daysDiff * dayColumnWidth) + (dayColumnWidth / 2);
          const toY = prepRect.top + prepRect.height / 2;
          
          // Start arrow from left side of checkbox
          const checkboxRect = checkboxEl.getBoundingClientRect();
          const fromX = checkboxRect.left;
          const fromY = checkboxRect.top + checkboxRect.height / 2;
          
          // Skip if target is off-screen
          if (toY < 0 || toY > window.innerHeight) return;
          
          // Skip if prep extension is scrolled behind course rows
          const courseRowsContainer = document.querySelector('[data-testid="course-rows-container"]');
          if (courseRowsContainer) {
            const courseRowsRect = courseRowsContainer.getBoundingClientRect();
            if (prepRect.bottom < courseRowsRect.bottom) {
              return;
            }
          }
          
          connections.push({
            taskId: task.id,
            fromX,
            fromY,
            toX,
            toY,
            color,
            boxType: checkboxSelector.includes('today') ? 'today' : 'tomorrow'
          });
        }
      };
      
      // Find tasks in Today box that have prep extensions - point to today's column
      dueTodayTasks.forEach(task => {
        addPrepConnection(task, `input[data-today-checkbox="${task.id}"]`, today);
      });
      
      // Find tasks in Tomorrow box that have prep extensions - point to tomorrow's column
      dueTomorrowTasks.forEach(task => {
        addPrepConnection(task, `input[data-tomorrow-checkbox="${task.id}"]`, tomorrow);
      });
      
      setPrepArrowConnections(connections);
    };
    
    // Calculate after DOM updates
    const timer = setTimeout(calculatePrepArrows, 250);
    
    // Recalculate on scroll and resize
    const handleUpdate = () => setTimeout(calculatePrepArrows, 50);
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [calendarView, dueTodayTasks]);

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
  
  // Get tasks for a specific hour on a day
  const getTasksForHour = (day: Date, hour: number) => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false; // Completed tasks don't show on calendar
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
  
  // Get tasks that started in a previous hour but are still ongoing at this hour
  const getContinuingTasksForHour = (day: Date, hour: number) => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false;
      const dueDate = new Date(t.dueDate);
      if (!isSameDay(dueDate, day)) return false;
      
      // Only consider tasks with explicit start and end times
      if (!t.eventStartTime || !t.eventEndTime) return false;
      
      const [startHour, startMin] = t.eventStartTime.split(':').map(Number);
      const [endHour, endMin] = t.eventEndTime.split(':').map(Number);
      
      // Task started before this hour and ends at or after this hour
      const startsBeforeThisHour = startHour < hour;
      const endsAtOrAfterThisHour = endHour > hour || (endHour === hour && endMin > 0);
      
      return startsBeforeThisHour && endsAtOrAfterThisHour;
    });
  };
  
  // Get all multi-hour tasks for the week to render as absolute positioned elements
  const getMultiHourTasksForWeek = () => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false;
      if (!t.eventStartTime || !t.eventEndTime) return false;
      
      const dueDate = new Date(t.dueDate);
      // Check if task is in current week view
      const isInWeek = weekDays.some(day => isSameDay(day, dueDate));
      if (!isInWeek) return false;
      
      const [startHour] = t.eventStartTime.split(':').map(Number);
      const [endHour] = t.eventEndTime.split(':').map(Number);
      
      // Only return tasks that span multiple hours
      return endHour > startHour;
    }).map(t => {
      const dueDate = new Date(t.dueDate);
      const dayIdx = weekDays.findIndex(day => isSameDay(day, dueDate));
      const [startHour, startMin] = t.eventStartTime!.split(':').map(Number);
      const [endHour, endMin] = t.eventEndTime!.split(':').map(Number);
      
      // Calculate position using dynamic grid sizes with individual row heights
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      // Calculate cumulative top position from hours 7 to startHour
      let topPx = 0;
      for (let h = 7; h < startHour; h++) {
        topPx += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
      }
      // Add minute offset within the starting hour
      const startHourHeight = gridSizes.timeSlotHeights[startHour] || gridSizes.timeSlotHeight;
      topPx += (startMin / 60) * startHourHeight;
      
      // Calculate height by summing heights of all hours the task spans
      let heightPx = 0;
      // Remaining minutes in starting hour
      heightPx += ((60 - startMin) / 60) * startHourHeight;
      // Full hours in between
      for (let h = startHour + 1; h < endHour; h++) {
        heightPx += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
      }
      // Minutes in ending hour (if different from start hour)
      if (endHour > startHour) {
        const endHourHeight = gridSizes.timeSlotHeights[endHour] || gridSizes.timeSlotHeight;
        heightPx += (endMin / 60) * endHourHeight;
      }
      
      return { task: t, dayIdx, topPx, heightPx };
    });
  };
  
  // Get prep extension overlays for tasks with prep days
  const getPrepExtensionsForWeek = () => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false;
      if (!t.startDate) return false;
      if (!t.eventStartTime) return false; // Only for time slot tasks
      
      const dueDate = new Date(t.dueDate);
      const startDate = new Date(t.startDate);
      const prepDays = differenceInDays(dueDate, startDate);
      if (prepDays <= 0 || prepDays > 2) return false;
      
      // Check if task's due date is in current week view
      const isInWeek = weekDays.some(day => isSameDay(day, dueDate));
      return isInWeek;
    }).map(t => {
      const dueDate = new Date(t.dueDate);
      const startDate = new Date(t.startDate!);
      const dueDayIdx = weekDays.findIndex(day => isSameDay(day, dueDate));
      const prepDaysCount = Math.min(2, differenceInDays(dueDate, startDate));
      const [startHour, startMin] = t.eventStartTime!.split(':').map(Number);
      const [endHour, endMin] = t.eventEndTime ? t.eventEndTime.split(':').map(Number) : [startHour + 1, 0];
      
      // Calculate top position (where the prep bar should be) - must match task topOffset exactly
      let topPx = 0;
      for (let h = 7; h < startHour; h++) {
        topPx += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
      }
      // Match the task's topOffset calculation exactly: (startMin / 60) * 44 + 2
      topPx += (startMin / 60) * (gridSizes.timeSlotHeights[startHour] || gridSizes.timeSlotHeight) + 2;
      
      // Calculate height to match the task height - same logic as getMultiHourTasksForWeek
      let heightPx = 0;
      const startHourHeight = gridSizes.timeSlotHeights[startHour] || gridSizes.timeSlotHeight;
      if (endHour > startHour) {
        // Multi-hour task height calculation
        heightPx += ((60 - startMin) / 60) * startHourHeight;
        for (let h = startHour + 1; h < endHour; h++) {
          heightPx += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
        }
        const endHourHeight = gridSizes.timeSlotHeights[endHour] || gridSizes.timeSlotHeight;
        heightPx += (endMin / 60) * endHourHeight;
      } else {
        // Single hour task - use standard height
        heightPx = 40;
      }
      
      // Calculate the starting day index for the prep extension
      const prepStartDayIdx = Math.max(0, dueDayIdx - prepDaysCount);
      
      return { task: t, dueDayIdx, prepStartDayIdx, prepDaysCount, topPx, heightPx, hour: startHour };
    });
  };
  
  // Check if a task is covered by a prep extension from another task
  const isTaskCoveredByPrepExtension = (day: Date, hour: number, taskId: number) => {
    const prepExtensions = getPrepExtensionsForWeek();
    const dayIdx = weekDays.findIndex(d => isSameDay(d, day));
    
    for (const ext of prepExtensions) {
      // Don't check against itself
      if (ext.task.id === taskId) continue;
      
      // Check if this day is within the prep extension range (not including due date)
      if (dayIdx >= ext.prepStartDayIdx && dayIdx < ext.dueDayIdx) {
        // Check if the hour matches
        if (hour === ext.hour) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check if a time slot hour has any prep conflicts that require extra height
  const getTimeSlotPrepConflictHeight = (hour: number) => {
    const prepExtensions = getPrepExtensionsForWeek();
    const multiHourTasks = getMultiHourTasksForWeek();
    
    for (const ext of prepExtensions) {
      if (ext.hour !== hour) continue;
      
      // Check if any task exists in the prep extension's covered days at this hour
      for (let dayIdx = ext.prepStartDayIdx; dayIdx < ext.dueDayIdx; dayIdx++) {
        const day = weekDays[dayIdx];
        
        // Check regular tasks
        const tasksInSlot = getTasksForHour(day, hour);
        const hasRegularConflict = tasksInSlot.some(t => t.id !== ext.task.id);
        if (hasRegularConflict) {
          return 24; // Extra height to accommodate pushed-down task
        }
        
        // Check multi-hour tasks
        const hasMultiHourConflict = multiHourTasks.some(({ task: t, dayIdx: tDayIdx }) => {
          if (t.id === ext.task.id) return false;
          if (tDayIdx !== dayIdx) return false;
          const tHour = t.eventStartTime ? parseInt(t.eventStartTime.split(':')[0]) : 0;
          return tHour === hour;
        });
        if (hasMultiHourConflict) {
          return 24; // Extra height to accommodate pushed-down task
        }
      }
    }
    return 0;
  };
  
  // Check if a task with prep days has conflicts that require extending its height
  // Returns the extra height needed to match the bottom of pushed-down tasks
  const getPrepTaskHeightExtension = (taskId: number, hour: number, prepStartDayIdx: number, dueDayIdx: number) => {
    // Check if any task exists in the prep extension's covered days at this hour
    for (let dayIdx = prepStartDayIdx; dayIdx < dueDayIdx; dayIdx++) {
      const day = weekDays[dayIdx];
      
      // Check multi-hour tasks in this day/hour
      const multiHourTasks = getMultiHourTasksForWeek().filter(({ task: t, dayIdx: tDayIdx }) => {
        if (t.id === taskId) return false;
        if (tDayIdx !== dayIdx) return false;
        const tHour = t.eventStartTime ? parseInt(t.eventStartTime.split(':')[0]) : 0;
        return tHour === hour;
      });
      
      if (multiHourTasks.length > 0) {
        return 24; // Match the offset applied to pushed-down tasks
      }
    }
    return 0;
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
  
  // Get all-day tasks (tasks without specific time - only midnight)
  const getAllDayTasks = (day: Date) => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false; // Completed tasks don't show on calendar
      if (t.eventStartTime) return false; // Tasks with explicit start time show at that hour
      const dueDate = new Date(t.dueDate);
      const isMidnight = dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
      return isSameDay(dueDate, day) && isMidnight;
    });
  };
  
  // Get paler version of a color for prep days extension
  const getPalerColor = (colorClass: string) => {
    // Convert bg-green-200 style classes to paler versions
    if (colorClass.includes('green')) return 'bg-green-100';
    if (colorClass.includes('pink')) return 'bg-pink-100';
    if (colorClass.includes('indigo')) return 'bg-indigo-100';
    if (colorClass.includes('gray')) return 'bg-gray-100';
    return 'bg-gray-100';
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
  // Only includes tasks with explicit startDate (user-set prep days)
  const getAllWeekPlanningTasks = () => {
    // Only show tasks with explicit start dates (no auto-generation)
    const tasksWithExplicitPlanningPeriods = allTasks.filter(t => t.startDate && !t.isCompleted && !t.isMissed);
    
    const allPlanningTasks = [...tasksWithExplicitPlanningPeriods];
    
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
    <div 
      className="flex h-screen flex-col overflow-hidden"
      style={{ 
        backgroundImage: customBackground ? `url(${customBackground})` : `url(${dashboardBg})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dynamic CSS for blink speed */}
      <style>{`
        .animate-file-box-blink-fast {
          animation: file-box-blink ${blinkSettings.taskBoxFilesBlinkSpeed}s ease-in-out infinite !important;
        }
        .animate-file-blink {
          animation: file-blink ${blinkSettings.allDayFilesBlinkSpeed}s ease-in-out infinite !important;
        }
        .animate-today-date {
          animation: today-date-pulse ${blinkSettings.todayColumnBlinkSpeed}s ease-in-out infinite !important;
        }
      `}</style>
      {/* New Semester Banner - Shows when past Week 13 */}
      {isPastSemester && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5" />
            <span className="font-medium">Semester Complete! Ready to set up your next semester?</span>
          </div>
          <Button 
            variant="outline" 
            className="bg-white/20 border-white text-white hover:bg-white/30"
            onClick={() => setIsNewSemesterDialogOpen(true)}
            data-testid="button-new-semester"
          >
            Set Up New Semester
          </Button>
        </div>
      )}

      {/* Readings Popup Dialog */}
      <Dialog open={!!readingsPopupCourse} onOpenChange={(open) => !open && setReadingsPopupCourse(null)}>
        <DialogContent className="max-w-[420px] p-4 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-white">
              <FolderOpen 
                className={`h-4 w-4 ${readingsPopupCourse === 'cppa122' ? 'text-green-400 fill-green-200/50' : readingsPopupCourse === 'cfnf400' ? 'text-pink-400 fill-pink-200/50' : 'text-indigo-400 fill-indigo-200/50'}`} 
                strokeWidth={1.5}
              />
              {readingsPopupCourse === 'cppa122' ? 'CPPA122 Local Politics' : readingsPopupCourse === 'cfnf400' ? 'CFNF400 Human Sexuality' : 'CASL101 Sign Language'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-white/60 mb-2">Week {selectedWeek} Readings</div>
          <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto">
            {allFiles
              .filter(f => f.folder?.includes(`week-${selectedWeek}-${readingsPopupCourse}`) && f.folder?.includes('reading'))
              .map(file => {
                const fullName = file.displayName || file.originalName;
                let cleanName = fullName
                  .replace(/^CPPA\s*122[-_\s.]*/i, '')
                  .replace(/^CFNF\s*400[-_\s.]*/i, '')
                  .replace(/^CASL\s*101[-_\s.]*/i, '')
                  .replace(/Reading\s*\d*[-_:\s.]*/gi, '')
                  .replace(/Local\s*Politics[-_:\s.]*/gi, '')
                  .replace(/Human\s*Sexuality[-_:\s.]*/gi, '')
                  .replace(/Sign\s*Language[-_:\s.]*/gi, '')
                  .replace(/\.pdf$/i, '')
                  .trim();
                while (cleanName.match(/^[.\s\-_:•·]/)) {
                  cleanName = cleanName.replace(/^[.\s\-_:•·]+/, '').trim();
                }
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10"
                    data-testid={`reading-file-${file.id}`}
                  >
                    <Checkbox
                      checked={file.listened || false}
                      onCheckedChange={async (checked) => {
                        try {
                          await apiRequest("PATCH", `/api/files/${file.id}`, { listened: checked });
                          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
                        } catch (error) {
                          console.error("Failed to update file listened status:", error);
                        }
                      }}
                      className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      data-testid={`checkbox-reading-${file.id}`}
                    />
                    <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span 
                      className={`text-[11px] cursor-pointer hover:underline ${file.listened ? 'text-white/40' : 'text-white'}`}
                      onClick={() => {
                        setPreviewFile(file);
                        setReadingsPopupCourse(null);
                      }}
                    >
                      {cleanName || fullName}
                    </span>
                  </div>
                );
              })}
            {allFiles.filter(f => f.folder?.includes(`week-${selectedWeek}-${readingsPopupCourse}`) && f.folder?.includes('reading')).length === 0 && (
              <div className="text-xs text-white/40 text-center py-4">No reading files for this week</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Semester Setup Dialog */}
      <Dialog open={isNewSemesterDialogOpen} onOpenChange={setIsNewSemesterDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white [&_textarea]:text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Professor Name (optional)</Label>
                  <Input
                    placeholder="e.g., Dr. Smith"
                    value={newSemesterForm.course1Professor}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course1Professor: e.target.value }))}
                    data-testid="input-course1-professor"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Professor Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="e.g., prof@university.edu"
                    value={newSemesterForm.course1ProfessorEmail}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course1ProfessorEmail: e.target.value }))}
                    data-testid="input-course1-professor-email"
                  />
                </div>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Professor Name (optional)</Label>
                  <Input
                    placeholder="e.g., Prof. Johnson"
                    value={newSemesterForm.course2Professor}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course2Professor: e.target.value }))}
                    data-testid="input-course2-professor"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Professor Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="e.g., prof@university.edu"
                    value={newSemesterForm.course2ProfessorEmail}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course2ProfessorEmail: e.target.value }))}
                    data-testid="input-course2-professor-email"
                  />
                </div>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Professor Name (optional)</Label>
                  <Input
                    placeholder="e.g., Dr. Williams"
                    value={newSemesterForm.course3Professor}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course3Professor: e.target.value }))}
                    data-testid="input-course3-professor"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Professor Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="e.g., prof@university.edu"
                    value={newSemesterForm.course3ProfessorEmail}
                    onChange={(e) => setNewSemesterForm(prev => ({ ...prev, course3ProfessorEmail: e.target.value }))}
                    data-testid="input-course3-professor-email"
                  />
                </div>
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
        <DialogContent className="max-w-6xl max-h-[98vh] h-[95vh] flex flex-col p-0 overflow-hidden border border-white/20 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
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
          <div className="flex items-center p-1.5 px-4 mx-6 mt-4 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" style={{ gap: `${blinkSettings.mediaControlSpacing}px` }}>
            <Select value={previewSpeaker} onValueChange={setPreviewSpeaker}>
              <SelectTrigger className="w-[100px] h-5 text-[9px] bg-gray-800 border-gray-700 text-white" data-testid="select-preview-speaker">
                <SelectValue placeholder="Select Speaker" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {SPEAKERS.map(speaker => (
                  <SelectItem key={speaker.id} value={speaker.id} className="text-[9px]">
                    {speaker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Voice selector - shows for browser TTS */}
            {previewSpeaker === "browser_tts" && availableVoices.length > 0 && (
              <>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="w-[110px] h-5 text-[9px] bg-gray-800 border-gray-700 text-white" data-testid="select-voice">
                    <SelectValue placeholder="Select Voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableVoices.map(voice => (
                      <SelectItem key={voice.name} value={voice.name} className="text-[9px]">
                        {voice.name.replace('Microsoft ', '').replace(' Online (Natural)', '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-white hover:bg-gray-700"
                  onClick={() => {
                    if (!window.speechSynthesis) return;
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance("Hello, this is a sample of my voice.");
                    utterance.rate = browserTtsRate;
                    const voice = availableVoices.find(v => v.name === selectedVoice);
                    if (voice) utterance.voice = voice;
                    window.speechSynthesis.speak(utterance);
                  }}
                  data-testid="button-preview-voice"
                  title="Preview voice"
                >
                  <Volume2 className="h-2.5 w-2.5" />
                </Button>
              </>
            )}
            
            {/* Speed control - shows for browser TTS */}
            {previewSpeaker === "browser_tts" && (
              <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-0.5">
                <Gauge className="h-2.5 w-2.5 text-gray-400" />
                <span className="text-[8px] text-gray-400 mr-0.5">Speed</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 text-white hover:bg-gray-700"
                  onClick={() => setBrowserTtsRate(r => Math.max(0.5, r - 0.05))}
                  title="Slow down"
                  data-testid="button-speed-down"
                >
                  <MinusCircle className="h-2.5 w-2.5" />
                </Button>
                <span className="text-[8px] text-white font-medium w-6 text-center">{Math.round(browserTtsRate * 100)}%</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 text-white hover:bg-gray-700"
                  onClick={() => setBrowserTtsRate(r => Math.min(2, r + 0.05))}
                  title="Speed up"
                  data-testid="button-speed-up"
                >
                  <PlusCircle className="h-2.5 w-2.5" />
                </Button>
              </div>
            )}
            
            <div className="flex items-center" style={{ gap: `${blinkSettings.mediaControlSpacing}px` }}>
              {/* Playback Controls */}
              <div className="flex items-center" style={{ gap: `${blinkSettings.mediaControlSpacing}px` }}>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={handleSkipBack}
                  data-testid="button-preview-rewind"
                  title="Rewind 20 words"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={() => previewFile && handlePlayFile(previewFile.objectPath, previewFile.displayName || previewFile.originalName, false)}
                  data-testid="button-preview-play"
                  title="Play from start"
                >
                  <Play className="h-4 w-4 fill-blue-400" />
                </Button>
                {/* Resume button - shows when there's saved progress */}
                {previewFile && getTtsProgress(previewFile.id) && !isPlaying && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-green-500 text-green-400 hover:text-green-300 hover:border-green-400 hover:bg-transparent shadow-[0_0_8px_rgba(34,197,94,0.4)] hover:shadow-[0_0_12px_rgba(34,197,94,0.6)] transition-all duration-200"
                    onClick={() => previewFile && handlePlayFile(previewFile.objectPath, previewFile.displayName || previewFile.originalName, true)}
                    data-testid="button-preview-resume"
                    title={`Resume from section ${(getTtsProgress(previewFile.id)?.chunkIndex || 0) + 1}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 bg-[rgb(255,0,0)] hover:bg-[rgb(220,0,0)] border-[rgb(255,0,0)]"
                  onClick={handleStopMedia}
                  data-testid="button-preview-stop"
                >
                  <Square className="h-4 w-4 fill-white" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={handleSkipForward}
                  data-testid="button-preview-forward"
                  title="Skip forward 20 words"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="w-px h-6 bg-white/30" />
              
              {/* Restart Controls */}
              <div className="flex items-center" style={{ gap: `${blinkSettings.mediaControlSpacing}px` }}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-3 text-[11px] border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={handleRestartFromBeginning}
                  data-testid="button-preview-restart-beginning"
                  title="Restart from beginning"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  <div className="flex flex-col leading-tight">
                    <span>Restart</span>
                    <span>Beginning</span>
                  </div>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-3 text-[11px] border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={handleRestartCurrentChunk}
                  data-testid="button-preview-restart-current"
                  title="Restart current section"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  <div className="flex flex-col leading-tight">
                    <span>Restart</span>
                    <span>Current</span>
                  </div>
                </Button>
              </div>
              
              <div className="w-px h-6 bg-white/30" />
              
              {/* Speed Controls (for Browser TTS) */}
              <div className="flex items-center" style={{ gap: `${blinkSettings.mediaControlSpacing}px` }}>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVolumeChange("down"); }}
                  data-testid="button-preview-vol-down"
                  title="Slower"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Volume2 className="h-4 w-4 text-blue-400" />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVolumeChange("up"); }}
                  data-testid="button-preview-vol-up"
                  title="Faster"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="w-px h-6 bg-white/30" />
              
              {/* Sync Checkbox */}
              <div className="flex items-center gap-1">
                <Checkbox
                  id="sync-highlight"
                  checked={syncHighlight}
                  onCheckedChange={(checked) => setSyncHighlight(!!checked)}
                  className="h-4 w-4 border-blue-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  data-testid="checkbox-sync-highlight"
                />
                <Label htmlFor="sync-highlight" className="text-white text-[11px] cursor-pointer">
                  Sync
                </Label>
              </div>
              
              {/* Chunk progress indicator */}
              {isPlaying && totalChunks > 1 && (
                <div className="flex items-center gap-1 text-[11px] text-green-400">
                  <span>Section {currentChunkIndex + 1}/{totalChunks}</span>
                </div>
              )}
            </div>
            
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-gray-700 ml-auto"
              data-testid="button-preview-download"
              title="Download PDF"
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
              <Download className="h-3 w-3" />
            </Button>
            
            {/* Mark as Completed Checkbox */}
            <div className="flex items-center gap-1 ml-1">
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
                className="h-3 w-3 border-white data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                data-testid="checkbox-mark-completed"
              />
              <Label htmlFor="mark-completed" className="text-white text-[9px] cursor-pointer whitespace-nowrap">
                Done
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
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-y-auto overflow-x-hidden p-4">
              {isLoadingText ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Extracting text...</span>
                </div>
              ) : previewText ? (
                <div className="text-sm leading-relaxed">
                  {(() => {
                    // Split text into chunks for display with colored backgrounds
                    const cleanText = previewText.replace(/---PAGE---/g, '');
                    const chunks = splitTextIntoChunks(cleanText, 2000);
                    
                    // Chunk background colors (alternating)
                    const chunkColors = [
                      'bg-blue-50 dark:bg-blue-950/40',
                      'bg-green-50 dark:bg-green-950/40',
                      'bg-purple-50 dark:bg-purple-950/40',
                      'bg-orange-50 dark:bg-orange-950/40',
                      'bg-pink-50 dark:bg-pink-950/40',
                      'bg-cyan-50 dark:bg-cyan-950/40',
                    ];
                    
                    // Track global word index for highlighting
                    let globalWordIndex = 0;
                    
                    return chunks.map((chunk, chunkIdx) => {
                      const chunkColor = chunkColors[chunkIdx % chunkColors.length];
                      const isCurrentChunk = isPlaying && chunkIdx === currentChunkIndex;
                      const chunkStartWordIdx = globalWordIndex;
                      
                      // Split chunk into paragraphs
                      const paragraphs = chunk.split(/\n\n+/);
                      
                      return (
                        <div 
                          key={chunkIdx}
                          className={`${chunkColor} ${isCurrentChunk ? 'ring-2 ring-yellow-400' : ''} rounded-lg p-3 mb-2 cursor-pointer hover:opacity-80 transition-opacity relative`}
                          onClick={() => playFromChunk(chunkIdx)}
                          title={`Click to play from Section ${chunkIdx + 1}`}
                        >
                          {/* Chunk header */}
                          <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-300 dark:border-gray-600">
                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                              Section {chunkIdx + 1} of {chunks.length}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-2 text-[9px] text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                              onClick={(e) => { e.stopPropagation(); playFromChunk(chunkIdx); }}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                          </div>
                          
                          {paragraphs.map((paragraph, pIdx) => {
                            const lines = paragraph.split(/\n/);
                            
                            return (
                              <div key={pIdx} className="mb-2">
                                {lines.map((line, lIdx) => {
                                  const words = line.split(/\s+/).filter(w => w.length > 0);
                                  const lineStartIdx = globalWordIndex;
                                  globalWordIndex += words.length;
                                  
                                  const isBullet = /^[•\-\*►▶→]/.test(line.trim());
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

      <div className="flex flex-1 overflow-hidden relative z-10" style={{ backgroundColor: customBackground ? 'transparent' : colorSettings.mainBackground }}>
        {/* Constant fade overlay - disabled for solid black background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'transparent', zIndex: 0 }}
        />
        {/* Night overlay - dims background based on Toronto sunrise/sunset */}
        <div 
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isNighttime ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to bottom, rgba(10, 15, 30, 0.6) 0%, rgba(5, 10, 25, 0.7) 100%)', zIndex: 0 }}
        />
      {isTodayExpanded && (
        <div 
          className="today-backdrop"
          onClick={() => setIsTodayExpanded(false)}
        />
      )}

      {/* Top Controls - Positioned directly on background */}
      <div className="absolute z-20 left-0 right-0 top-0 flex items-center mx-3 mt-2" style={{ 
        height: '48px'
      }}>
        {/* Logo, Date Range, and Week Navigation - Fixed Left */}
        <div className="flex items-center pl-3 gap-2 h-full flex-shrink-0">
          <img src={unicalLogo} alt="Uni-Cal" className="rounded h-[46px] w-[46px] ml-[-13px]" />
          {/* Week navigation with arrows around date, Today/Month stacked above */}
          <div className="flex items-center gap-1">
            {/* Left arrow */}
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/20 rounded-md" onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4 text-white" strokeWidth={2.5} />
            </Button>
            {/* Stacked: Today/Month above date */}
            <div className="flex flex-col items-center gap-0.5">
              {/* Today/Month buttons */}
              <div className="flex items-center gap-0.5" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                <Button 
                  variant="ghost"
                  className="!h-4 !min-h-0 px-1 text-[8px] hover:bg-white/20 rounded font-medium text-white border-0" 
                  onClick={() => { setCalendarView("week"); setSelectedWeek(2); }} 
                  data-testid="button-today"
                >
                  Today
                </Button>
                <div className="w-[1px] h-3 bg-white/50" />
                <Button 
                  variant="ghost"
                  className="!h-4 !min-h-0 px-1 text-[8px] hover:bg-white/20 rounded font-medium text-white border-0"
                  onClick={() => setCalendarView(calendarView === "month" ? "week" : "month")}
                  data-testid="button-month-view"
                >
                  {calendarView === "month" ? "Week" : "Month"}
                </Button>
              </div>
              {/* Date display */}
              <div className="flex items-center justify-center gap-1 bg-white/10 rounded-md px-2 py-0.5 backdrop-blur-sm whitespace-nowrap" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", minWidth: '110px' }}>
                <span className="text-[11px] font-medium text-white relative top-[1px]">{format(weekStartDate, "MMM d")}</span>
                <span className="text-[11px] text-white/50 relative top-[1px]">—</span>
                <span className="text-[11px] font-medium text-white relative top-[1px]">{format(weekEndDate, "MMM d")}</span>
              </div>
            </div>
            {/* Right arrow */}
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/20 rounded-md" onClick={() => setSelectedWeek(Math.min(13, selectedWeek + 1))} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.5} />
            </Button>
          </div>
        </div>

        {/* All items with equal gaps - spread between arrow and exam */}
        <div className="flex items-center justify-center flex-1 h-full min-w-0 overflow-hidden pl-[6px] pr-4">
          {/* Icon buttons and task buttons with adjustable spacing */}
          <div className="flex items-center flex-wrap justify-center" style={{ gap: `${blinkSettings.buttonSpacing + 4}px` }}>
          {/* Hamburger Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 overflow-hidden" style={{ backgroundImage: `url(${buttonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }} data-testid="button-hamburger-menu">
                <Menu className="h-[38px] w-[38px] text-white" strokeWidth={2.5} />
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
              <DropdownMenuItem data-testid="menu-item-settings" onClick={() => {
                  setOriginalColorSettings({...colorSettings});
                  setOriginalBlinkSettings({...blinkSettings});
                  setIsSettingsDialogOpen(true);
                }}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Graduation Hat - Opens Settings Panel */}
          <Button 
            size="icon"
            variant="ghost"
            className="!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 overflow-hidden"
            style={{ backgroundImage: `url(${buttonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }}
            data-testid="button-settings-panel"
            onClick={() => setIsSettingsPanelOpen(true)}
          >
            <GraduationCap className="h-[38px] w-[38px] text-white" />
          </Button>

          {/* Bell */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={`!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 overflow-hidden ${isMuted ? "!bg-red-500 hover:!bg-red-600" : ""}`}
            style={isMuted ? { marginTop: '9px' } : { backgroundImage: `url(${buttonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }}
            data-testid="button-mute-toggle"
            title={isMuted ? `Muted for ${Math.ceil((muteUntil! - Date.now()) / 60000)} min` : "Mute for 30 min"}
          >
            {isMuted ? <BellOff className="h-[38px] w-[38px] text-white" /> : <Bell className="h-[38px] w-[38px] text-white" />}
          </Button>

          {/* Radio Dialog */}
          <Dialog open={isRadioDialogOpen} onOpenChange={setIsRadioDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 overflow-hidden"
                style={{ backgroundImage: `url(${buttonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }}
                data-testid="button-radio-dialog"
                title="Radio Controls"
              >
                <Radio className="h-[38px] w-[38px] text-white" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[260px] text-[10px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white" style={{ top: '55%' }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white text-xs">
                  <Radio className="h-4 w-4" />
                  Radio Controls
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-2">
                {/* Speaker Selection */}
                <div className="flex flex-col gap-1">
                  <Label className="text-white text-[10px]">Speaker</Label>
                  <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                    <SelectTrigger data-testid="select-speaker" className="h-8 text-[10px] bg-black/50 border-white/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/20 max-h-[300px]">
                      <SelectItem value="media_player.byhome">Apartment</SelectItem>
                      <SelectItem value="media_player.cat_wash">Cat Wash</SelectItem>
                      <SelectItem value="media_player.cat_wr">Cat Washroom Speakers</SelectItem>
                      <SelectItem value="media_player.echo_cat_left_am">Cat Washroom Left</SelectItem>
                      <SelectItem value="media_player.echo_cat_right_am">Cat Washroom Right</SelectItem>
                      <SelectItem value="media_player.echo_cat_washroom_middle">Cat Washroom Middle</SelectItem>
                      <SelectItem value="media_player.echo_closet_am">Closet</SelectItem>
                      <SelectItem value="media_player.echo_lr_couch_r_am">Hallway Corner</SelectItem>
                      <SelectItem value="media_player.echo_hallway_entrance_am">Hallway Entrance</SelectItem>
                      <SelectItem value="media_player.echo_king_l_am">King Left</SelectItem>
                      <SelectItem value="media_player.echo_king_r_am">King Right</SelectItem>
                      <SelectItem value="media_player.echo_king_tv_am">King TV</SelectItem>
                      <SelectItem value="media_player.echo_kitchen_cupboards_left_am">Kitchen Cupboards Left</SelectItem>
                      <SelectItem value="media_player.echo_kitchen_cupboards_r_am">Kitchen Cupboards Right</SelectItem>
                      <SelectItem value="media_player.echo_kitchen_fridge_am">Kitchen Fridge</SelectItem>
                      <SelectItem value="media_player.echo_kitchen_hutch_am">Kitchen Hutch</SelectItem>
                      <SelectItem value="media_player.echo_kitchen_island_corner_am">Kitchen Island Corner</SelectItem>
                      <SelectItem value="media_player.echo_kitchen_studio_black_am">Kitchen Studio Black</SelectItem>
                      <SelectItem value="media_player.echo_lr_couch_l_am">Living Room Couch Left</SelectItem>
                      <SelectItem value="media_player.echo_lr_hub_am">Living Room Hub</SelectItem>
                      <SelectItem value="media_player.echo_lr_studio_white_am">Living Room Studio White</SelectItem>
                      <SelectItem value="media_player.echo_lr_tv_shelf_am">Living Room TV Shelf</SelectItem>
                      <SelectItem value="media_player.echo_queen_balcony_am">Queen Balcony</SelectItem>
                      <SelectItem value="media_player.echo_queen_bed_l_am">Queen Bed Left</SelectItem>
                      <SelectItem value="media_player.echo_queen_bed_r_am">Queen Bed Right</SelectItem>
                      <SelectItem value="media_player.echo_show_pug_am">Echo Show Pug</SelectItem>
                      <SelectItem value="media_player.everywhere_2">Everywhere</SelectItem>
                      <SelectItem value="media_player.hallway">Hallway</SelectItem>
                      <SelectItem value="media_player.king_bedroom">King Bedroom</SelectItem>
                      <SelectItem value="media_player.queen_bedroom">Queen Bedroom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Play/Stop Buttons */}
                <div className="flex flex-col gap-1.5 items-center mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-[155px] text-[9px] border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/media/play-radio', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            stationId: 'CHUM FM',
                            entityId: selectedSpeaker
                          })
                        });
                        if (response.ok) {
                          const speakerName = selectedSpeaker.replace('media_player.', '').replace(/_/g, ' ');
                          toast({ title: "Playing CHUM FM", description: `on ${speakerName}` });
                        } else {
                          toast({ title: "Failed to play radio", variant: "destructive" });
                        }
                      } catch (error) {
                        toast({ title: "Error playing radio", variant: "destructive" });
                      }
                    }}
                    data-testid="button-play-chumfm"
                  >
                    <Play style={{ width: 12, height: 12 }} className="mr-1" />
                    Play CHUM FM (select)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-[155px] text-[9px] border-blue-500 text-blue-400 hover:text-blue-300 hover:border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/media/play-radio-all', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ stationId: 'CHUM FM' })
                        });
                        if (response.ok) {
                          toast({ title: "Playing CHUM FM", description: "on all devices" });
                        } else {
                          toast({ title: "Failed to play radio", variant: "destructive" });
                        }
                      } catch (error) {
                        toast({ title: "Error playing radio", variant: "destructive" });
                      }
                    }}
                    data-testid="button-play-chumfm-all"
                  >
                    <Play style={{ width: 12, height: 12 }} className="mr-1" />
                    Play CHUM FM (on all)
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 w-[155px] text-[9px] bg-[rgb(255,0,0)] hover:bg-[rgb(220,0,0)] border-[rgb(255,0,0)]"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/media/stop-radio', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                        });
                        if (response.ok) {
                          toast({ title: "Radio stopped" });
                        }
                      } catch (error) {
                        toast({ title: "Error stopping radio", variant: "destructive" });
                      }
                    }}
                    data-testid="button-stop-radio"
                  >
                    <Square style={{ width: 10, height: 10 }} className="mr-1 fill-current" />
                    Stop
                  </Button>
                </div>
                
                {/* Volume Controls - All Speakers */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <Label className="text-white text-[10px]">Volume (All Speakers):</Label>
                  <div className="flex items-center gap-1">
                    <button
                      className="text-white hover:text-white/70 text-base px-1"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/media/volume-all', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ direction: 'down' })
                          });
                          const data = await res.json();
                          if (data.newVolume !== undefined) {
                            setRadioVolume(data.newVolume);
                            toast({ title: `Volume set to ${data.newVolume}% on all speakers` });
                          }
                        } catch (error) {
                          toast({ title: "Error adjusting volume", variant: "destructive" });
                        }
                      }}
                      data-testid="button-volume-down-all"
                    >
                      −
                    </button>
                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-200" 
                        style={{ width: `${radioVolume}%` }}
                      />
                    </div>
                    <button
                      className="text-white hover:text-white/70 text-base px-1"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/media/volume-all', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ direction: 'up' })
                          });
                          const data = await res.json();
                          if (data.newVolume !== undefined) {
                            setRadioVolume(data.newVolume);
                            toast({ title: `Volume set to ${data.newVolume}% on all speakers` });
                          }
                        } catch (error) {
                          toast({ title: "Error adjusting volume", variant: "destructive" });
                        }
                      }}
                      data-testid="button-volume-up-all"
                    >
                      +
                    </button>
                    <button
                      className="text-white/70 hover:text-white text-[9px] px-1"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/media/volume-all', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ level: 0 })
                          });
                          const data = await res.json();
                          if (data.newVolume !== undefined) {
                            setRadioVolume(data.newVolume);
                            toast({ title: "All speakers muted" });
                          }
                        } catch (error) {
                          toast({ title: "Error muting", variant: "destructive" });
                        }
                      }}
                      data-testid="button-mute-all"
                    >
                      mute
                    </button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Sync */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 overflow-hidden"
            style={{ backgroundImage: `url(${buttonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }}
            onClick={() => syncAllCalendarMutation.mutate()}
            disabled={syncAllCalendarMutation.isPending}
            data-testid="button-sync-calendar"
          >
            {syncAllCalendarMutation.isPending ? (
              <Loader2 className="h-[38px] w-[38px] text-white animate-spin" />
            ) : (
              <RefreshCw className="h-[38px] w-[38px] text-white" />
            )}
          </Button>

          {/* Undo Complete */}
          <Button 
            variant="ghost" 
            size="icon" 
            className={`!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square rounded-full border-0 overflow-hidden hover:opacity-80 ${lastCompletedTaskId ? "" : "opacity-50"}`}
            style={{ backgroundImage: `url(${orangeButtonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }}
            onClick={handleUndoComplete}
            disabled={!lastCompletedTaskId}
            data-testid="button-undo-complete"
            title={lastCompletedTaskId ? "Undo last completion" : "No task to undo"}
          >
            <Undo2 className="h-[38px] w-[38px] text-white" />
          </Button>

          {/* Completed Tasks Checkbox */}
          <Button 
            size="icon"
            variant="ghost"
            className="!h-[52px] !w-[52px] !min-h-[52px] !min-w-[52px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 overflow-hidden"
            style={{ backgroundImage: `url(${buttonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginTop: '9px' }}
            data-testid="button-completed-tasks"
            onClick={() => setIsCompletedTasksOpen(true)}
          >
            <CheckSquare className="h-[38px] w-[38px] text-white" />
          </Button>

          {/* Quick Add Button */}
          <Button variant="ghost" size="sm" className="!h-[38px] !min-h-[38px] px-[16px] hover:opacity-80 text-white text-[12px] border-0 font-medium rounded-full overflow-hidden !bg-transparent" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", backgroundImage: `url(${taskButtonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginLeft: '10px', marginTop: '6px' }} data-testid="button-add-task" onClick={() => { setNewTaskType("other"); setIsAddDialogOpen(true); }}>+ Add Task</Button>
          </div>
        </div>

        {/* Timer and Clock - Fixed Right */}
        <div className="flex items-center gap-[5px] h-full flex-shrink-0" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", marginRight: '11px', marginLeft: '-2px' }}>
          {/* Pomodoro Timer */}
          <div className="flex items-center gap-2 bg-white/20 rounded-md px-2 h-[30px]" style={{ position: 'relative', left: '-4px' }}>
            <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              pomodoroMode === "work" ? "text-white" : 
              pomodoroMode === "shortBreak" ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"
            }`} style={pomodoroMode === "work" ? { backgroundColor: '#7f1d1d' } : undefined} data-testid="pomodoro-timer">
              {formatPomodoroTime(pomodoroTime)}
            </div>
            <div className="flex items-center gap-1">
              <button className="p-0.5 hover:bg-white/20 rounded transition-colors" onClick={togglePomodoro} data-testid="button-pomodoro-toggle">
                {pomodoroRunning ? <Pause className="h-3 w-3 text-white" strokeWidth={2.5} /> : <Play className="h-3 w-3 text-white" strokeWidth={2.5} />}
              </button>
              <button className="p-0.5 hover:bg-white/20 rounded transition-colors" onClick={resetPomodoro} data-testid="button-pomodoro-reset">
                <RotateCcw className="h-3 w-3 text-white" strokeWidth={2.5} />
              </button>
              <button className="p-0.5 hover:bg-white/20 rounded transition-colors" onClick={skipPomodoro} data-testid="button-pomodoro-skip">
                <SkipForward className="h-3 w-3 text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          
          {/* Clock */}
          <div className="flex items-center gap-1.5 bg-white/20 rounded-md px-2 h-[30px]" data-testid="digital-clock">
            <span className="text-xs text-white font-medium">
              {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(currentTime)}
            </span>
            <div className="w-[1px] h-4 bg-white/50" />
            <div className="flex items-baseline">
              <span className="text-xs font-medium text-white tabular-nums">
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: displayTimezone }).format(currentTime).replace(/\s?(AM|PM)$/i, '')}
              </span>
              <span className="text-[10px] font-medium text-white tabular-nums">
                :{String(currentTime.getSeconds()).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-medium text-white ml-0.5 uppercase">
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: displayTimezone }).format(currentTime).replace(/^\d+\s*/, '')}
              </span>
            </div>
            {profileData.travelTimezone && (
              <span className="text-[10px] text-orange-400 font-medium ml-1">Travel</span>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel Popup - Contains sidebar content */}
      <Dialog open={isSettingsPanelOpen} onOpenChange={setIsSettingsPanelOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" style={{ top: '55%' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Courses & Weeks</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Course Legend */}
            <div className="space-y-2">
              {coursesData.courses.filter(course => course.name.trim()).map((course, index) => {
                const courseCode = course.name.split(' - ')[0];
                const courseName = course.name.split(' - ').slice(1).join(' - ') || course.name;
                const tomorrow = addDays(startOfDay(new Date()), 1);
                const hasDueTomorrow = allTasks.some(task => 
                  task.courseName?.includes(courseCode) && 
                  !task.isCompleted &&
                  isSameDay(new Date(task.dueDate), tomorrow)
                );
                // Get professor email from coursesData
                const professorEmail = course.professorEmail;
                return (
                  <div key={index} className="flex items-center gap-1.5">
                    <div 
                      className={`w-2 h-2 rounded-full ${hasDueTomorrow ? "animate-blink" : ""}`} 
                      style={{ backgroundColor: course.color }}
                    />
                    <span className="text-[12px] text-white">
                      <span className="font-medium">{courseCode}</span>
                      {courseName !== courseCode && <span> - {courseName}</span>}
                      {course.professor && (
                        professorEmail ? (
                          <a
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(professorEmail)}&su=${encodeURIComponent(`${courseCode} - `)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/70 hover:text-white hover:underline cursor-pointer"
                            data-testid={`link-settings-email-professor-${index + 1}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(professorEmail)}&su=${encodeURIComponent(`${courseCode} - `)}`, '_blank');
                            }}
                          >
                            {" "}({course.professor})
                          </a>
                        ) : (
                          <span className="text-white/70"> ({course.professor})</span>
                        )
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            

            {/* Weeks */}
            <div className="space-y-1">
              {[...weeks].sort((a, b) => {
                const aFinished = parseISO(a.endDate) < new Date();
                const bFinished = parseISO(b.endDate) < new Date();
                if (aFinished && !bFinished) return 1;
                if (!aFinished && bFinished) return -1;
                return a.weekNumber - b.weekNumber;
              }).map((week) => {
                const weekEnd = parseISO(week.endDate);
                const isWeekFinished = weekEnd < new Date();
                const isSelected = selectedWeek === week.weekNumber && !selectedDate;
                return (
                  <div key={week.weekNumber} className={`flex items-center gap-0.5 rounded-md ${isSelected ? 'bg-secondary' : ''}`}>
                    <Button
                      variant="ghost"
                      className={`justify-start gap-1 h-auto py-1 px-1 w-full ${isWeekFinished ? "opacity-60" : ""} ${isSelected ? "bg-transparent hover:bg-transparent" : ""}`}
                      size="sm"
                      onClick={() => {
                        setSelectedWeek(week.weekNumber);
                        setSelectedDate(null);
                        setIsSettingsPanelOpen(false);
                      }}
                      data-testid={`button-week-panel-${week.weekNumber}`}
                    >
                      <div className={`flex items-center gap-1 ${isWeekFinished ? "line-through" : ""}`}>
                        <Calendar className={`h-3 w-3 ${isSelected ? 'text-black' : 'text-white'}`} />
                        <span className={`text-xs ${isSelected ? 'text-black' : 'text-white'}`}>Week {week.weekNumber}</span>
                        <span className={`text-[9px] font-bold ${isSelected ? 'text-black' : 'text-white/70'}`}>
                          ({format(parseISO(week.startDate), "MMM d")} - {format(parseISO(week.endDate), "MMM d")})
                        </span>
                      </div>
                      {week.taskCount > 0 && (
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 min-w-5 text-center justify-center ml-auto ${isSelected ? 'text-black border-black' : 'text-white border-white'}`}>
                          {week.taskCount}
                        </Badge>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* PAG Level Carousel */}
            <div className="mt-4 pt-4 border-t border-white/30">
              {/* Navigation with arrows and dots */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <button
                  onClick={() => currentPagLevel > 1 && setCurrentPagLevel(currentPagLevel - 1)}
                  className={`text-white text-lg font-bold px-2 py-0.5 rounded ${currentPagLevel > 1 ? 'hover:bg-white/20' : 'opacity-30 cursor-not-allowed'}`}
                  disabled={currentPagLevel <= 1}
                  data-testid="button-pag-prev"
                >
                  ←
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
                  onClick={() => currentPagLevel < 3 && setCurrentPagLevel(currentPagLevel + 1)}
                  className={`text-white text-lg font-bold px-2 py-0.5 rounded ${currentPagLevel < 3 ? 'hover:bg-white/20' : 'opacity-30 cursor-not-allowed'}`}
                  disabled={currentPagLevel >= 3}
                  data-testid="button-pag-next"
                >
                  →
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
                      OPEN ELECTIVE: <span className="font-bold">TWO</span> one-term courses required - options are listed in PR Table I.
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
                    <span className="leading-tight"><span className="font-bold">TWO</span> one-term courses required - options are listed in PR Table I.</span>
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
          </div>
          <div className="flex gap-2 pt-4 border-t border-white/20 mt-4">
            <Button type="button" variant="outline" className="flex-1 text-white border-white/50 hover:bg-white/10" onClick={() => setIsSettingsPanelOpen(false)} data-testid="button-cancel-settings-panel">
              Cancel
            </Button>
            <Button 
              type="button" 
              className="flex-1 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40" 
              onClick={() => {
                // Save the checked courses and grades to localStorage
                localStorage.setItem('checkedCourses', JSON.stringify(checkedCourses));
                localStorage.setItem('courseGrades', JSON.stringify(courseGrades));
                toast({ title: "Settings saved", description: "Your progress has been saved." });
                setIsSettingsPanelOpen(false);
              }}
              data-testid="button-save-settings-panel"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wide Pill Banner - Top middle */}
      <div className="absolute left-0 right-0 flex justify-center z-5 pointer-events-none" style={{ top: '10px' }}>
        <img src={ovalBanner} alt="" className="h-[51px]" style={{ opacity: 0.95, width: '660px', objectFit: 'fill' }} />
      </div>

      {/* Main Content - Full width, positioned below unified header */}
      <main className="flex-1 pt-2 pb-2 flex flex-col overflow-hidden relative z-10 min-h-0" style={{ paddingLeft: '24px', paddingRight: '24px', marginTop: '60px' }}>
        
        {/* Completed Tasks Popup */}
          <Dialog open={isCompletedTasksOpen} onOpenChange={setIsCompletedTasksOpen}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" style={{ top: '55%' }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white text-sm">
                  <CheckSquare className="h-5 w-5" />
                  Completed Tasks
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {(() => {
                  const completedTasks = tasks
                    .filter(t => t.isCompleted)
                    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
                  
                  if (completedTasks.length === 0) {
                    return <div className="text-muted-foreground text-sm py-4 text-center">No completed tasks yet</div>;
                  }
                  
                  const getCourseColor = (courseName: string | null | undefined) => {
                    if (!courseName) return '#888888';
                    if (courseName.startsWith('CPPA122')) return '#22c55e';
                    if (courseName.startsWith('CFNF400')) return '#ec4899';
                    if (courseName.startsWith('CASL101')) return '#6366f1';
                    return '#888888';
                  };
                  
                  return completedTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-md border border-white/10">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={(e) => completeMutation.mutate({ id: task.id, isCompleted: e.target.checked })}
                        className="h-4 w-4 rounded-sm cursor-pointer flex-shrink-0"
                        style={{ accentColor: getCourseColor(task.courseName) }}
                        data-testid={`completed-checkbox-${task.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{task.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span style={{ color: getCourseColor(task.courseName) }}>{task.courseName?.split(' - ')[0]}</span>
                          <span>•</span>
                          <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setInitialStartTime("");
              setInitialEndTime("");
              setNewTaskType("module"); // Reset to default
            }
          }}>
            <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white [&_textarea]:text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Add New {newTaskType.charAt(0).toUpperCase() + newTaskType.slice(1)}</DialogTitle>
              </DialogHeader>
              <TaskForm 
                key={`add-task-form-${selectedDate?.getTime() || 0}-${initialStartTime}-${initialEndTime}-${newTaskType}`}
                weekNumber={selectedWeek}
                initialDate={selectedDate}
                initialType={newTaskType}
                initialStartTime={initialStartTime}
                initialEndTime={initialEndTime}
                onSuccess={() => {
                  setIsAddDialogOpen(false);
                  setInitialStartTime("");
                  setInitialEndTime("");
                }} 
              />
            </DialogContent>
          </Dialog>
          
          {/* Profile Dialog */}
          <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
            <DialogContent className="max-w-md text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white" style={{ top: '55%' }}>
              <DialogHeader>
                <DialogTitle className="text-white text-sm">Profile</DialogTitle>
              </DialogHeader>
              <ProfileForm 
                profileData={profileData} 
                timezones={timezones} 
                onSave={saveProfile}
                onCancel={() => setIsProfileDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
          
          {/* School Dialog */}
          <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
            <DialogContent className="max-w-md text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white" style={{ top: '55%' }}>
              <DialogHeader>
                <DialogTitle className="text-white text-sm">School Settings</DialogTitle>
              </DialogHeader>
              <SchoolForm 
                schoolData={schoolData}
                semesterSettings={semesterSettings}
                onSave={saveSchool}
                onCancel={() => setIsSchoolDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
          
          {/* Courses Dialog */}
          <Dialog open={isCoursesDialogOpen} onOpenChange={setIsCoursesDialogOpen}>
            <DialogContent className="max-w-xl text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white" style={{ top: '55%' }}>
              <DialogHeader>
                <DialogTitle className="text-white text-sm">Courses</DialogTitle>
              </DialogHeader>
              <CoursesForm 
                coursesData={coursesData}
                onSave={saveCourses}
                onCancel={() => setIsCoursesDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
          
          {/* Settings Dialog */}
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogContent className="max-w-4xl text-[9px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white [&_.text-sm]:text-xs [&_.text-xs]:text-[9px] [&_.text-muted-foreground]:text-[8px]" style={{ top: '55%' }}>
              <DialogHeader>
                <DialogTitle className="text-white text-base font-semibold">Settings</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-sm font-medium">Background Image and Colours</Label>
                  <p className="text-xs text-muted-foreground">
                    Upload a custom background image or customise colours.
                  </p>
                  
                  {customBackground && (
                    <div className="relative w-full h-20 rounded-md overflow-hidden border">
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
                  
                  <div className="space-y-2 pt-2 border-t">
                    {/* Main Background Colour */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Main Background Colour</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-16">{colorSettings.mainBackground}</span>
                        <input
                          type="color"
                          value={colorSettings.mainBackground}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, mainBackground: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                          data-testid="color-main-background"
                        />
                      </div>
                    </div>
                    
                    {/* Box Background Colour */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Task Boxes Background</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-16">{colorSettings.boxBackground}</span>
                        <input
                          type="color"
                          value={colorSettings.boxBackground}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, boxBackground: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                          data-testid="color-box-background"
                        />
                      </div>
                    </div>
                    
                    {/* Header Bar Colour */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Header & Menu Bar</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-16">{colorSettings.headerBar}</span>
                        <input
                          type="color"
                          value={colorSettings.headerBar}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, headerBar: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                          data-testid="color-header-bar"
                        />
                      </div>
                    </div>
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
                
                {/* Right Column */}
                <div className="space-y-4">
                {/* Blinking & Spacing Settings */}
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-sm font-medium">Blinking & Spacing</Label>
                  <p className="text-xs text-muted-foreground">
                    Control blinking animations and button spacing.
                  </p>
                  
                  <div className="space-y-3">
                    {/* Today Column Blink */}
                    <div className="border rounded p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Today Column Blink</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.todayColumnBlink}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, todayColumnBlink: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid="toggle-today-column-blink"
                        />
                      </div>
                      {blinkSettings.todayColumnBlink && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Speed</Label>
                            <span className="text-[10px] text-muted-foreground">{blinkSettings.todayColumnBlinkSpeed}s</span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="2"
                            step="0.1"
                            value={blinkSettings.todayColumnBlinkSpeed}
                            onChange={(e) => setBlinkSettings(prev => ({ ...prev, todayColumnBlinkSpeed: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                            data-testid="slider-today-column-speed"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* All Day Files Blink */}
                    <div className="border rounded p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">All Day Files Blink</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.allDayFilesBlink}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, allDayFilesBlink: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid="toggle-allday-files-blink"
                        />
                      </div>
                      {blinkSettings.allDayFilesBlink && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Speed</Label>
                            <span className="text-[10px] text-muted-foreground">{blinkSettings.allDayFilesBlinkSpeed}s</span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="2"
                            step="0.1"
                            value={blinkSettings.allDayFilesBlinkSpeed}
                            onChange={(e) => setBlinkSettings(prev => ({ ...prev, allDayFilesBlinkSpeed: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                            data-testid="slider-allday-files-speed"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Task Box Files Blink */}
                    <div className="border rounded p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Task Box Files Blink</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.taskBoxFilesBlink}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, taskBoxFilesBlink: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid="toggle-taskbox-files-blink"
                        />
                      </div>
                      {blinkSettings.taskBoxFilesBlink && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Speed</Label>
                            <span className="text-[10px] text-muted-foreground">{blinkSettings.taskBoxFilesBlinkSpeed}s</span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="2"
                            step="0.1"
                            value={blinkSettings.taskBoxFilesBlinkSpeed}
                            onChange={(e) => setBlinkSettings(prev => ({ ...prev, taskBoxFilesBlinkSpeed: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                            data-testid="slider-taskbox-files-speed"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Show Arrows Toggle */}
                    <div className="border rounded p-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Show Connection Arrows</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.showArrows}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, showArrows: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid="toggle-show-arrows"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Lines connecting task boxes to calendar entries
                      </p>
                    </div>
                    
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Header Button Spacing</Label>
                        <span className="text-xs text-muted-foreground">{blinkSettings.buttonSpacing}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        step="2"
                        value={blinkSettings.buttonSpacing}
                        onChange={(e) => setBlinkSettings(prev => ({ ...prev, buttonSpacing: Number(e.target.value) }))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        data-testid="slider-button-spacing"
                      />
                      <p className="text-xs text-muted-foreground">
                        Space between hamburger and exam buttons
                      </p>
                    </div>
                    
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Media Controls Spacing</Label>
                        <span className="text-xs text-muted-foreground">{blinkSettings.mediaControlSpacing}px</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="40"
                        step="2"
                        value={blinkSettings.mediaControlSpacing}
                        onChange={(e) => setBlinkSettings(prev => ({ ...prev, mediaControlSpacing: Number(e.target.value) }))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        data-testid="slider-media-control-spacing"
                      />
                      <p className="text-xs text-muted-foreground">
                        Space between PDF media control buttons
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Data Sync Section */}
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-sm font-medium">Data Sync</Label>
                  <p className="text-xs text-muted-foreground">
                    Push to or pull from the published app.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40"
                      size="sm"
                      onClick={async () => {
                        try {
                          toast({ title: "Pushing...", description: "Sending data to production." });
                          
                          const exportRes = await fetch("/api/export");
                          const exportData = await exportRes.json();
                          
                          const importRes = await fetch("https://home-view--bkh416.replit.app/api/import", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(exportData),
                          });
                          const result = await importRes.json();
                          
                          if (result.success) {
                            // Clean up duplicates and sync file names
                            try {
                              await fetch("https://home-view--bkh416.replit.app/api/cleanup-duplicates", { method: "POST" });
                            } catch (e) {
                              // Cleanup is optional
                            }
                            
                            toast({ 
                              title: "Push complete!", 
                              description: `Pushed ${result.imported.tasks} tasks, ${result.imported.files} files.` 
                            });
                          } else {
                            toast({ title: "Push failed", description: result.error, variant: "destructive" });
                          }
                        } catch (err: any) {
                          console.error("Push error:", err);
                          toast({ title: "Push failed", description: err?.message || "Could not connect to production.", variant: "destructive" });
                        }
                      }}
                      data-testid="button-push-production"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Push
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          toast({ title: "Pulling...", description: "Getting data from production." });
                          
                          const exportRes = await fetch("https://home-view--bkh416.replit.app/api/export");
                          if (!exportRes.ok) {
                            toast({ title: "Pull failed", description: `Export failed: ${exportRes.status}`, variant: "destructive" });
                            return;
                          }
                          const exportData = await exportRes.json();
                          console.log("Export data:", exportData);
                          
                          const importRes = await fetch("/api/import", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(exportData),
                          });
                          if (!importRes.ok) {
                            toast({ title: "Pull failed", description: `Import failed: ${importRes.status}`, variant: "destructive" });
                            return;
                          }
                          const result = await importRes.json();
                          console.log("Import result:", result);
                          
                          if (result.success) {
                            toast({ 
                              title: "Pull complete!", 
                              description: `Pulled ${result.imported.tasks} tasks, ${result.imported.files} files.` 
                            });
                            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/files"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/semester"] });
                          } else {
                            toast({ title: "Pull failed", description: result.error || "Unknown error", variant: "destructive" });
                          }
                        } catch (err: any) {
                          console.error("Pull error:", err);
                          toast({ title: "Pull failed", description: err?.message || "Could not connect to production.", variant: "destructive" });
                        }
                      }}
                      data-testid="button-pull-production"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Pull
                    </Button>
                  </div>
                </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setColorSettings(originalColorSettings);
                    setBlinkSettings(originalBlinkSettings);
                    setIsSettingsDialogOpen(false);
                  }}
                  data-testid="button-cancel-settings"
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40"
                  onClick={() => {
                    localStorage.setItem('colorSettings', JSON.stringify(colorSettings));
                    localStorage.setItem('blinkSettings', JSON.stringify(blinkSettings));
                    toast({ title: "Settings saved", description: "Your settings have been applied." });
                    setIsSettingsDialogOpen(false);
                  }}
                  data-testid="button-save-settings"
                >
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Calendar Settings Dialog */}
          <Dialog open={isCalendarSettingsOpen} onOpenChange={setIsCalendarSettingsOpen}>
            <DialogContent className="max-w-md bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white [&_textarea]:text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Calendar Settings</DialogTitle>
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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ marginTop: '0px', marginLeft: '0px', marginRight: '6px', paddingRight: '4px' }}>
        {/* Calendar Views */}
        {calendarView === "week" ? (
        <div className="mb-[12px] mt-[5px] relative flex gap-4 transition-all duration-300" style={{ height: isTodoFlyoutOpen ? calendarHeight - 164 : calendarHeight, order: 2 }}>
          
          
          {/* Blank honeycombs above the date - Interactive with spring animation */}
          <div className="absolute z-[100] flex items-center justify-end gap-1" style={{ top: '-36px', right: '-1px', height: `${41 + gridSizes.allDayRowHeight}px` }}>
            {/* Left decorative honeycomb - Readings with extended hover zone */}
            <div 
              className="relative"
              style={{ width: gridSizes.courseRowHeight * 1.05, height: gridSizes.courseRowHeight * 1.05, transform: 'translateX(8px) translateY(8px)' }}
              onMouseEnter={() => setDecorativeHoneycombHover('left')}
              onMouseLeave={() => setDecorativeHoneycombHover(null)}
            >
              {/* Main honeycomb */}
              <div className="relative cursor-pointer w-full h-full">
                <img src={honey1} alt="" className="w-full h-full object-contain transition-transform duration-200 hover:scale-110" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                <BookOpenCheck className="absolute inset-0 m-auto h-5 w-5" style={{ color: '#3a5a70', strokeWidth: 2 }} />
              </div>
              {/* Invisible bridge to spring-out honeycombs */}
              <div 
                className={`absolute ${decorativeHoneycombHover === 'left' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ 
                  top: '100%',
                  left: '-20px',
                  right: '-60px',
                  height: `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight * 3}px`
                }}
              />
              {/* Spring out honeycombs - grow to course row size */}
              {/* Top honeycomb - Readings */}
              <div 
                className={`absolute transition-all duration-500 ease-out ${decorativeHoneycombHover === 'left' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                  width: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  height: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  top: decorativeHoneycombHover === 'left' ? `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight * 0.05}px` : '50%',
                  right: decorativeHoneycombHover === 'left' ? '-45px' : '50%',
                  transformOrigin: 'center center'
                }}
              >
                <div 
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => setReadingsPopupCourse('cppa122')}
                >
                  <img src={honey1} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                  <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: '#3a5a70', strokeWidth: 3 }} />
                </div>
              </div>
              {/* Middle honeycomb - Readings CFNF400 */}
              <div 
                className={`absolute transition-all duration-500 ease-out ${decorativeHoneycombHover === 'left' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                  width: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  height: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  top: decorativeHoneycombHover === 'left' ? `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight + gridSizes.courseRowHeight * 0.05}px` : '50%',
                  right: decorativeHoneycombHover === 'left' ? '-45px' : '50%',
                  transformOrigin: 'center center',
                  transitionDelay: '50ms'
                }}
              >
                <div 
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => setReadingsPopupCourse('cfnf400')}
                >
                  <img src={honey1} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                  <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: '#3a5a70', strokeWidth: 3 }} />
                </div>
              </div>
              {/* Bottom honeycomb - Readings CASL101 */}
              <div 
                className={`absolute transition-all duration-500 ease-out ${decorativeHoneycombHover === 'left' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                  width: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  height: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  top: decorativeHoneycombHover === 'left' ? `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight * 2 + gridSizes.courseRowHeight * 0.05}px` : '50%',
                  right: decorativeHoneycombHover === 'left' ? '-45px' : '50%',
                  transformOrigin: 'center center',
                  transitionDelay: '100ms'
                }}
              >
                <div 
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => setReadingsPopupCourse('casl101')}
                >
                  <img src={honey1} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                  <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: '#3a5a70', strokeWidth: 3 }} />
                </div>
              </div>
            </div>
            {/* Right decorative honeycomb - Modules */}
            <div 
              className="relative cursor-pointer"
              style={{ width: gridSizes.courseRowHeight * 1.05, height: gridSizes.courseRowHeight * 1.05, transform: 'translateY(8px)' }}
              onMouseEnter={() => setDecorativeHoneycombHover('right')}
              onMouseLeave={() => setDecorativeHoneycombHover(null)}
            >
              <img src={honey1} alt="" className="w-full h-full object-contain transition-transform duration-200 hover:scale-110" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
              <Library className="absolute inset-0 m-auto h-5 w-5" style={{ color: '#3a5a70', strokeWidth: 2 }} />
              {/* Spring out honeycombs - grow to course row size */}
              {/* Top honeycomb - Readings */}
              <div 
                className={`absolute transition-all duration-500 ease-out ${decorativeHoneycombHover === 'right' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                  width: decorativeHoneycombHover === 'right' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  height: decorativeHoneycombHover === 'right' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  top: decorativeHoneycombHover === 'right' ? `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight * 0.05}px` : '50%',
                  right: decorativeHoneycombHover === 'right' ? '1px' : '50%',
                  transformOrigin: 'center center'
                }}
              >
                <div className="relative w-full h-full">
                  <img src={honey1} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                </div>
              </div>
              {/* Middle honeycomb - Files */}
              <div 
                className={`absolute transition-all duration-500 ease-out ${decorativeHoneycombHover === 'right' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                  width: decorativeHoneycombHover === 'right' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  height: decorativeHoneycombHover === 'right' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  top: decorativeHoneycombHover === 'right' ? `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight + gridSizes.courseRowHeight * 0.05}px` : '50%',
                  right: decorativeHoneycombHover === 'right' ? '1px' : '50%',
                  transformOrigin: 'center center',
                  transitionDelay: '50ms'
                }}
              >
                <div className="relative w-full h-full">
                  <img src={honey2} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                </div>
              </div>
              {/* Bottom honeycomb - Modules */}
              <div 
                className={`absolute transition-all duration-500 ease-out ${decorativeHoneycombHover === 'right' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                  width: decorativeHoneycombHover === 'right' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  height: decorativeHoneycombHover === 'right' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
                  top: decorativeHoneycombHover === 'right' ? `${57 + gridSizes.allDayRowHeight + gridSizes.courseRowHeight * 2 + gridSizes.courseRowHeight * 0.05}px` : '50%',
                  right: decorativeHoneycombHover === 'right' ? '1px' : '50%',
                  transformOrigin: 'center center',
                  transitionDelay: '100ms'
                }}
              >
                <div className="relative w-full h-full">
                  <img src={honey1} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                </div>
              </div>
            </div>
          </div>
          
          {/* Honeycomb Navigation System - Right edge aligned with course rows */}
          <div className="absolute z-[100]" style={{ top: `${41 + gridSizes.allDayRowHeight}px`, right: '80px' }}>
                        
            {/* CPPA122 - Green Row - Modules Honeycomb */}
            <div 
              className="flex items-center justify-end gap-1"
              style={{ height: `${gridSizes.courseRowHeight}px` }}
            >
              {/* Expanded honeycombs - Readings */}
              <div className={`transition-all duration-300 ${modulesHoneycombOpen === 'cppa122' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={() => setReadingsPopupCourse('cppa122')}
                  data-testid="honeycomb-readings-cppa122"
                >
                  <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.75, height: gridSizes.courseRowHeight * 0.75 }}>
                    <img src={honey1} alt="Readings" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                    <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: '#3a5a70', strokeWidth: 3 }} />
                  </div>
                </div>
              </div>
              {/* Expanded honeycombs - Modules */}
              <div className={`transition-all duration-300 ${modulesHoneycombOpen === 'cppa122' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={() => setModuleMediaControlCourse('cppa122')}
                  data-testid="honeycomb-modules-cppa122"
                >
                  <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.75, height: gridSizes.courseRowHeight * 0.75 }}>
                    <img src={honey1} alt="Modules" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                    <Paperclip className="absolute inset-0 m-auto h-3 w-3 text-green-400 -rotate-45" />
                  </div>
                </div>
              </div>
              {/* Main honeycomb */}
              <div 
                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${modulesHoneycombOpen === 'cppa122' ? 'scale-95' : ''}`}
                onClick={() => setModulesHoneycombOpen(modulesHoneycombOpen === 'cppa122' ? null : 'cppa122')}
                data-testid="honeycomb-cppa122"
              >
                <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.9, height: gridSizes.courseRowHeight * 0.9 }}>
                  <img src={honey1} alt="CPPA" className="w-full h-full object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium" style={{ color: '#3a5a70', WebkitFontSmoothing: 'antialiased' }}>CPPA</span>
                </div>
              </div>
            </div>
            
            {/* CFNF400 - Pink Row - Modules Honeycomb */}
            <div 
              className="relative flex items-center justify-end gap-1"
              style={{ height: `${gridSizes.courseRowHeight}px` }}
            >
              {/* Middle decorative honeycomb with spring animation - Files */}
              <div 
                className="absolute cursor-pointer"
                style={{ width: gridSizes.courseRowHeight * 1.05, height: gridSizes.courseRowHeight * 1.05, top: '-105px', right: '-58px' }}
                onMouseEnter={() => setDecorativeHoneycombHover('middle')}
                onMouseLeave={() => setDecorativeHoneycombHover(null)}
                onClick={() => setIsWeeksFlyoutOpen(!isWeeksFlyoutOpen)}
                data-testid="honeycomb-files"
              >
                <img src={honey1} alt="" className="w-full h-full object-contain transition-transform duration-200 hover:scale-110" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                <Folder className="absolute inset-0 m-auto h-5 w-5" style={{ color: '#3a5a70', strokeWidth: 2 }} />
              </div>
              {/* Expanded honeycombs - Readings */}
              <div className={`transition-all duration-300 ${modulesHoneycombOpen === 'cfnf400' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={() => setReadingsPopupCourse('cfnf400')}
                  data-testid="honeycomb-readings-cfnf400"
                >
                  <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.75, height: gridSizes.courseRowHeight * 0.75 }}>
                    <img src={honey2} alt="Readings" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                    <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: '#3a5a70', strokeWidth: 3 }} />
                  </div>
                </div>
              </div>
              {/* Expanded honeycombs - Modules */}
              <div className={`transition-all duration-300 ${modulesHoneycombOpen === 'cfnf400' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={() => setModuleMediaControlCourse('cfnf400')}
                  data-testid="honeycomb-modules-cfnf400"
                >
                  <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.75, height: gridSizes.courseRowHeight * 0.75 }}>
                    <img src={honey2} alt="Modules" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                    <Paperclip className="absolute inset-0 m-auto h-3 w-3 text-pink-400 -rotate-45" />
                  </div>
                </div>
              </div>
              {/* Main honeycomb */}
              <div 
                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${modulesHoneycombOpen === 'cfnf400' ? 'scale-95' : ''}`}
                onClick={() => setModulesHoneycombOpen(modulesHoneycombOpen === 'cfnf400' ? null : 'cfnf400')}
                data-testid="honeycomb-cfnf400"
              >
                <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.9, height: gridSizes.courseRowHeight * 0.9 }}>
                  <img src={honey2} alt="CFNF" className="w-full h-full object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium" style={{ color: '#3a5a70', WebkitFontSmoothing: 'antialiased' }}>CFNF</span>
                </div>
              </div>
            </div>
            
            {/* CASL101 - Indigo/Blue Row - Modules Honeycomb */}
            <div 
              className="flex items-center justify-end gap-1"
              style={{ height: `${gridSizes.courseRowHeight}px` }}
            >
              {/* Expanded honeycombs - Readings */}
              <div className={`transition-all duration-300 ${modulesHoneycombOpen === 'casl101' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={() => setReadingsPopupCourse('casl101')}
                  data-testid="honeycomb-readings-casl101"
                >
                  <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.75, height: gridSizes.courseRowHeight * 0.75 }}>
                    <img src={honey1} alt="Readings" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                    <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: '#3a5a70', strokeWidth: 3 }} />
                  </div>
                </div>
              </div>
              {/* Expanded honeycombs - Modules */}
              <div className={`transition-all duration-300 ${modulesHoneycombOpen === 'casl101' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={() => setModuleMediaControlCourse('casl101')}
                  data-testid="honeycomb-modules-casl101"
                >
                  <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.75, height: gridSizes.courseRowHeight * 0.75 }}>
                    <img src={honey1} alt="Modules" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                    <Paperclip className="absolute inset-0 m-auto h-3 w-3 text-indigo-400 -rotate-45" />
                  </div>
                </div>
              </div>
              {/* Main honeycomb */}
              <div 
                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${modulesHoneycombOpen === 'casl101' ? 'scale-95' : ''}`}
                onClick={() => setModulesHoneycombOpen(modulesHoneycombOpen === 'casl101' ? null : 'casl101')}
                data-testid="honeycomb-casl101"
              >
                <div className="relative" style={{ width: gridSizes.courseRowHeight * 0.9, height: gridSizes.courseRowHeight * 0.9 }}>
                  <img src={honey1} alt="CASL" className="w-full h-full object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium" style={{ color: '#3a5a70', WebkitFontSmoothing: 'antialiased' }}>CASL</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Module Media Controls Dialog */}
          <Dialog open={moduleMediaControlCourse !== null} onOpenChange={(open) => !open && setModuleMediaControlCourse(null)}>
            <DialogContent className="max-w-[320px] p-4 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white">
              <DialogHeader>
                <DialogTitle className="text-sm font-medium">
                  {moduleMediaControlCourse === 'cppa122' ? 'CPPA122' : moduleMediaControlCourse === 'cfnf400' ? 'CFNF400' : 'CASL101'} Module Media
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <span className="text-xs">Week {selectedWeek} Module</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20">
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20">
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-white/70" />
                  <Slider defaultValue={[50]} max={100} step={1} className="flex-1" />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Calendar wrapper - leaves space for honeycombs on right */}
          <div style={{ width: 'calc(100% - 65px)' }}>
          <Card className="shadow-lg h-full border-[0.1px] border-white flex flex-col relative" style={{ background: 'white', overflow: 'hidden', borderRadius: '16px' }}>
            {/* Friday/Saturday divider line */}
            <div className="absolute top-0 bottom-0 w-[3px] bg-black z-50 pointer-events-none" style={{ left: `calc(${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px + (6 / 7) * (100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px))` }} />
            
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden relative z-20" style={{ borderRadius: '16px' }} onClick={() => setSelectedTaskId(null)}>
            {/* Day Headers - Fixed, not scrollable */}
            <div data-calendar-grid="true" className="grid border-b border-border z-[44] h-[41px] w-full flex-shrink-0" style={{ gridTemplateColumns: getGridTemplateColumns() }}>
              <div className="flex items-center justify-center relative" style={{ backgroundColor: colorSettings.headerBar }}>
                <span className="text-xs font-medium tracking-wide text-white">Week {selectedWeek}</span>
                {/* Time column resize handle - right edge */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize bg-white/50 hover:bg-white"
                  style={{ zIndex: 9999 }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleColumnResizeStart(e, -1);
                  }}
                  data-testid="time-column-resize-handle"
                />
              </div>
                            {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                const isFriday = day.getDay() === 5;
                const dayName = format(day, "EEE").toUpperCase();
                const dayNum = format(day, "d");
                
                // Check if there are tasks for this day
                const hasTodayTasks = isToday && allTasks.some(t => 
                  !t.isCompleted && isSameDay(new Date(t.dueDate), day)
                );
                
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
                    className={`border-l border-border flex items-center justify-center h-full relative ${isToday && hasTodayTasks && blinkSettings.todayColumnBlink ? "animate-today-date" : ""}`}
                    style={{ 
                      backgroundColor: isToday ? (hasTodayTasks && blinkSettings.todayColumnBlink ? undefined : '#3B302C') : "black"
                    }}
                    data-testid={`day-header-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="text-2xl font-bold text-white">
                        {dayNum}
                      </div>
                      <div className="text-[10px] font-medium tracking-wide text-white/80">{dayName}</div>
                    </div>
                    {/* Day column resize handle - right edge */}
                    {idx < weekDays.length - 1 && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize bg-white/50 hover:bg-white"
                        style={{ zIndex: 9999 }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleColumnResizeStart(e, idx);
                        }}
                        data-testid={`day-column-resize-handle-${idx}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* ALL DAY Row - Fixed, not scrollable - Only shows true all-day tasks (midnight due time) */}
            <div className="grid border-b border-border/50 z-[44] w-full flex-shrink-0 relative group/alldayrow" style={{ gridTemplateColumns: getGridTemplateColumns(), minHeight: `${gridSizes.allDayRowHeight}px` }}>
              <div className="text-[10px] font-medium tracking-wide flex items-center justify-center text-white relative" style={{ backgroundColor: colorSettings.headerBar }}>
                ALL DAY
              </div>
              {/* Day cells */}
              {weekDays.map((day, dayIdx) => {
                // Only show true all-day tasks (midnight due) and all-day calendar events
                const allDayTasks = getAllDayTasks(day);
                const allDayEvents = getAllDayCalendarEvents(day);
                
                return (
                  <div 
                    key={dayIdx} 
                    className="border-l border-border/50 relative p-0.5 flex flex-col gap-0.5 overflow-hidden min-w-0"
                    style={{ 
                      backgroundColor: isSameDay(day, new Date()) ? '#EAE4DE' : 'white'
                    }}
                    data-testid={`all-day-slot-${format(day, "yyyy-MM-dd")}`}
                  >
                    {/* All-day tasks - simple rendering, no prep days here */}
                    {allDayTasks.map(task => {
                      const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                      const colors = courseColors[courseCode];
                      const today = startOfDay(new Date());
                      const tomorrow = addDays(today, 1);
                      const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                      const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                      const borderClass = task.isCompleted ? "border-gray-300" : colors ? colors.border : "border-gray-400";
                      
                      return (
                        <div
                          key={task.id}
                          className="relative w-full min-w-0"
                          data-testid={`all-day-task-${task.id}`}
                        >
                          <div
                            className={`flex items-center gap-1 text-[8px] px-1 py-0.5 truncate rounded border w-full min-w-0 ${
                              isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""
                            } ${
                              task.isCompleted 
                                ? "bg-gray-200 text-gray-400 border-gray-300" 
                                : colors 
                                  ? `${colors.bg} text-black ${borderClass}` 
                                  : "bg-gray-200 text-black border-gray-400"
                            }`}
                          >
                            <Checkbox
                              checked={task.isCompleted || false}
                              onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                              className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                              data-testid={`checkbox-allday-${task.id}`}
                            />
                            <span 
                              onClick={() => setEditingTask(task)}
                              className={`cursor-pointer hover:opacity-80 truncate flex-1 font-bold ${task.isCompleted ? "line-through" : ""}`}
                            >
                              {task.title}
                            </span>
                          </div>
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
                        className="flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate bg-gray-200 dark:bg-gray-700 text-black dark:text-white border border-gray-500 cursor-pointer hover:opacity-80 w-full min-w-0"
                        data-testid={`all-day-gcal-${event.id}`}
                      >
                        <CalendarDays className="h-3 w-3 shrink-0 text-gray-600 dark:text-gray-300" />
                        <span className="truncate font-bold flex-1 min-w-0">{event.title}</span>
                      </a>
                    ))}
                  </div>
                );
              })}
              {/* ALL DAY row resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px] cursor-row-resize z-[50] opacity-0 group-hover/alldayrow:opacity-100 hover:bg-blue-400/50 transition-opacity"
                onMouseDown={(e) => handleRowResizeStart(e, 'allDay')}
                data-testid="allday-row-resize-handle"
              />
              </div>
            
                          
              {/* Course Rows - CPPA122, CFNF400, CASL101 - Fixed, not scrollable - Now shows prep tasks */}
              <div data-testid="course-rows-container">
              {[
                { name: 'CPPA122', bg: 'rgba(134, 239, 172, 0.35)', label: 'rgba(74, 222, 128, 0.70)', colors: courseColors['CPPA122'] },
                { name: 'CFNF400', bg: 'rgba(249, 168, 212, 0.45)', label: 'rgba(244, 114, 182, 0.70)', colors: courseColors['CFNF400'] },
                { name: 'CASL101', bg: 'rgba(165, 180, 252, 0.45)', label: 'rgba(129, 140, 248, 0.70)', colors: courseColors['CASL101'] }
              ].map((course, courseIdx) => {
                // Get full-week tasks for this course (tasks that span from visible start to Friday)
                // Exclude completed tasks so they are removed from view
                const fullWeekTasks = weekPlanningTasks.filter(task => {
                  if (!task.startDate || !task.courseName?.startsWith(course.name)) return false;
                  if (task.isCompleted) return false; // Remove completed module tasks from view
                  
                  // Use format to compare dates consistently (avoiding timezone issues)
                  const taskStartDateStr = format(new Date(task.startDate), 'yyyy-MM-dd');
                  const taskDueDateStr = format(new Date(task.dueDate), 'yyyy-MM-dd');
                  
                  // weekDays structure is always: [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
                  // Sunday is index 0, Friday is index 5
                  const weekStartStr = format(weekDays[0], 'yyyy-MM-dd');
                  const weekFridayStr = format(weekDays[5], 'yyyy-MM-dd');
                  
                  // Check if task spans the full visible week (from Sunday to Friday)
                  const startsOnSunday = taskStartDateStr === weekStartStr;
                  const endsOnFriday = taskDueDateStr === weekFridayStr;
                  
                  return startsOnSunday && endsOnFriday;
                });
                
                // Calculate position for full-week tasks
                const todayDate = new Date();
                const isSaturdayToday = todayDate.getDay() === 6;
                // Get Saturday column width (Saturday is at index 6 when not Saturday, index 6 when Saturday)
                // When not Saturday: weekDays = [Sun, Mon, Tue, Wed, Thu, Fri, Sat] - Sat at end
                // When Saturday: weekDays = [Sun, Mon, Tue, Wed, Thu, Fri, Sat] - same order
                const saturdayColumnWidth = gridSizes.dayColumnWidths[6] || 100;
                
// Check if this course has any full-week tasks
                const hasFullWeekTasks = fullWeekTasks.length > 0;
                
                // If there are full-week tasks, render them using grid column spanning
                if (hasFullWeekTasks) {
                  return (
                    <div key={course.name} className="border-b border-border/50 w-full flex-shrink-0">
                      {fullWeekTasks.map((task, taskIdx) => {
                        const today = startOfDay(new Date());
                        const tomorrow = addDays(today, 1);
                        const taskDueDate = startOfDay(new Date(task.dueDate));
                        const isDueToday = !task.isCompleted && isSameDay(taskDueDate, today);
                        const isDueTomorrow = !task.isCompleted && isSameDay(taskDueDate, tomorrow);
                        
                        // Get current day of week (0 = Sunday, 6 = Saturday)
                        const currentDayOfWeek = today.getDay();
                        // Wednesday is day 3 - start blinking from Wednesday onwards
                        const isWednesdayOrLater = currentDayOfWeek >= 3 && currentDayOfWeek <= 5;
                        const shouldBlink = !task.isCompleted && isWednesdayOrLater;
                        
                        const moduleBg = task.isCompleted ? "bg-gray-200 text-gray-400" : course.colors ? `${course.colors.bg} text-black` : "bg-gray-200 text-black";
                        const moduleBorder = task.isCompleted ? "border-gray-300" : course.colors ? course.colors.border : "border-gray-400";
                        
                        // Render ONE row with BOTH static MODULE task AND dynamic task on same line
                        return (
                          <div 
                            key={`fullweek-row-${task.id}`}
                            className="grid w-full"
                            style={{ 
                              gridTemplateColumns: getGridTemplateColumns(),
                              minHeight: `${gridSizes.courseRowHeight}px`
                            }}
                          >
                            {/* Course name column */}
                            <div className="px-1 py-0.5 text-[10px] font-medium tracking-wide flex items-center justify-center text-white" style={{ backgroundColor: colorSettings.headerBar }}>
                              {taskIdx === 0 ? course.name : ''}
                            </div>
                            
                            {/* Static MODULE column task - always visible */}
                            <div style={{ backgroundColor: course.bg }}>
                              <div 
                                className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded m-0.5 ${moduleBg} border ${moduleBorder}`}
                                data-testid={`course-module-task-static-${task.id}`}
                              >
                                <Checkbox
                                  checked={task.isCompleted || false}
                                  onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                  className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                                  data-testid={`checkbox-module-static-${task.id}`}
                                />
                                <span 
                                  onClick={() => setEditingTask(task)}
                                  className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                >
                                  <span className="font-bold">{task.title}</span>
                                </span>
                              </div>
                            </div>
                            
                            {/* Sun-Fri columns (6 columns: index 0-5) - dynamic task starts from today */}
                            {weekDays.slice(0, 6).map((day, dayIdx) => {
                              const dayOfWeek = day.getDay(); // 0 = Sunday, 5 = Friday
                              const isBeforeToday = dayOfWeek < currentDayOfWeek;
                              const isTodayColumn = dayOfWeek === currentDayOfWeek;
                              const isFriday = dayOfWeek === 5;
                              
                              // If this day is before today, show empty cell
                              if (isBeforeToday) {
                                return (
                                  <div 
                                    key={dayIdx}
                                    style={{ backgroundColor: course.bg }}
                                  />
                                );
                              }
                              
                              // On Sunday (currentDayOfWeek === 0), the static MODULE task covers everything
                              // so we don't show a duplicate dynamic task
                              if (currentDayOfWeek === 0) {
                                return (
                                  <div 
                                    key={dayIdx}
                                    style={{ backgroundColor: course.bg }}
                                  />
                                );
                              }
                              
                              const bgOnly = task.isCompleted 
                                ? "bg-gray-200" 
                                : course.colors 
                                  ? course.colors.bg 
                                  : "bg-gray-200";
                              const borderColor = task.isCompleted ? "border-gray-300" : course.colors ? course.colors.border : "border-gray-400";
                              
                              // Today's column gets left border, Friday gets right border
                              const borderClass = isTodayColumn && isFriday
                                ? `border ${borderColor} rounded`
                                : isTodayColumn
                                  ? `border-l border-t border-b ${borderColor} rounded-l`
                                  : isFriday
                                    ? `border-t border-b border-r ${borderColor} rounded-r`
                                    : `border-t border-b ${borderColor}`;
                              
                              // If today is the start, show the task content
                              if (isTodayColumn) {
                                // Today is Friday means full border with rounding on both sides
                                const todayBorderClass = isFriday
                                  ? `border ${borderColor} rounded`
                                  : `border-l border-t border-b ${borderColor} rounded-l`;
                                return (
                                  <div key={dayIdx} className="flex items-center" style={{ backgroundColor: course.bg }}>
                                    <div 
                                      className={`flex-1 flex items-center gap-1 text-[8px] px-1 ml-0.5 ${isFriday ? 'mr-0.5' : ''} ${moduleBg} ${todayBorderClass} ${
                                        shouldBlink ? "animate-blink" : ""
                                      }`}
                                      style={{ height: 'calc(100% - 4px)', marginTop: '2px', marginBottom: '2px' }}
                                      data-testid={`course-fullweek-task-today-${task.id}`}
                                    >
                                      <Checkbox
                                        checked={task.isCompleted || false}
                                        onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                        className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                                        data-testid={`checkbox-fullweek-${task.id}`}
                                      />
                                      <span 
                                        onClick={() => setEditingTask(task)}
                                        className={`cursor-pointer hover:opacity-80 truncate ${task.isCompleted ? "line-through" : ""}`}
                                      >
                                        <span className="font-bold">{task.title}</span>
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Continuation bar for days after today - no left margin to connect with previous
                              const contBorderClass = isFriday
                                ? `border-t border-b border-r ${borderColor} rounded-r`
                                : `border-t border-b ${borderColor}`;
                              return (
                                <div key={dayIdx} className="flex items-center" style={{ backgroundColor: course.bg }}>
                                  <div 
                                    className={`w-full ${bgOnly} ${contBorderClass} ${
                                      shouldBlink ? "animate-blink" : ""
                                    } ${isFriday ? 'mr-0.5' : ''}`}
                                    style={{ height: 'calc(100% - 4px)', marginTop: '2px', marginBottom: '2px' }}
                                  />
                                </div>
                              );
                            })}
                            
                            {/* Saturday column - empty with course background */}
                            <div style={{ backgroundColor: course.bg }} />
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                
                return (
                <div key={course.name} className="grid border-b border-border/50 w-full flex-shrink-0 relative z-[43] group/courserow" style={{ gridTemplateColumns: getGridTemplateColumns(), minHeight: `${gridSizes.courseRowHeight}px` }}>
                  <div className="px-1 py-0.5 text-[10px] font-medium tracking-wide flex flex-col items-center justify-center text-white relative leading-tight" style={{ backgroundColor: colorSettings.headerBar }}>
                    {(() => {
                      const code = course.name.split(' - ')[0];
                      const fullName = course.name.split(' - ').slice(1).join(' - ');
                      // CPPA122: show all on one line, centered
                      if (code === 'CPPA122') {
                        return <span className="text-center">CPPA122 Local Politics</span>;
                      }
                      // CFNF400: show CFNF400, then Human, then Sexuality on separate lines
                      if (code === 'CFNF400') {
                        return (
                          <>
                            <span>CFNF400</span>
                            <span>Human</span>
                            <span>Sexuality</span>
                          </>
                        );
                      }
                      // CASL101: show just the code
                      if (code === 'CASL101') {
                        return <span>CASL101</span>;
                      }
                      // Default: code on first line, then each word
                      const words = fullName.split(' ');
                      return (
                        <>
                          <span>{code}</span>
                          {words.map((word, i) => <span key={i}>{word}</span>)}
                        </>
                      );
                    })()}
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    // Course row day cells - prep tasks now appear in All Day row with extensions
                    return (
                      <div 
                        key={dayIdx} 
                        className="px-0.5 py-0.5 border-l border-border/50 flex flex-col gap-0.5 overflow-visible"
                        style={{ 
                          backgroundColor: course.bg
                        }}
                        data-testid={`course-row-${course.name}-${format(day, "yyyy-MM-dd")}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.backgroundColor = '#8B8070';
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.backgroundColor = course.bg;
                        }}
                        onDrop={(e) => {
                          e.currentTarget.style.backgroundColor = course.bg;
                          handleCourseRowDrop(e, course.name, day);
                        }}
                      />
                    );
                  })}
                  {/* Course row resize handle */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] cursor-row-resize z-[50] opacity-0 group-hover/courserow:opacity-100 hover:bg-blue-400/50 transition-opacity"
                    onMouseDown={(e) => handleRowResizeStart(e, 'course')}
                    data-testid={`course-row-resize-handle-${course.name}`}
                  />
                  </div>
                );
              })}
              </div>
              
                          {/* Time Slots - Scrollable area */}
            <div ref={calendarScrollRef} className="flex-1 overflow-y-scroll overflow-x-hidden scrollbar-hidden relative" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                {timeSlots.map((hour, hourIdx) => {
                  const currentHour = new Date().getHours();
                  const isCurrentHour = hour === currentHour;
                  const prepConflictHeight = getTimeSlotPrepConflictHeight(hour);
                  const rowHeight = (gridSizes.timeSlotHeights[hour] || gridSizes.timeSlotHeight) + prepConflictHeight;
                  return (
                  <div 
                    key={hour} 
                    className="grid border-b border-border/50 relative group/row"
                    style={{ gridTemplateColumns: getGridTemplateColumns(), height: `${rowHeight}px`, overflow: 'hidden', borderBottomLeftRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined, borderBottomRightRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined }}
                  >
                    <div className="text-[10px] font-medium tracking-wide flex items-center justify-center text-white relative" style={{ backgroundColor: isCurrentHour ? '#2d4a6f' : colorSettings.headerBar, borderBottomLeftRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined }}>
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
                          className={`border-l border-border/50 relative p-0.5 overflow-visible ${totalItems > 0 && !isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} ${dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour ? "bg-primary/20 ring-2 ring-primary ring-inset" : ""}`}
                          style={{
                            backgroundColor: isToday ? '#EAE4DE' : isCurrentHour ? 'rgba(93, 129, 204, 0.2)' : undefined,
                            borderBottomRightRadius: hourIdx === timeSlots.length - 1 && dayIdx === 6 ? '16px' : undefined
                          }}
                          data-testid={`time-slot-${format(day, "yyyy-MM-dd")}-${hour}`}
                          onDragOver={(e) => handleDragOver(e, day, hour)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day, hour)}
                          onDoubleClick={(e) => {
                            // Detect if click was in top or bottom half of cell
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickY = e.clientY - rect.top;
                            const isBottomHalf = clickY > rect.height / 2;
                            const minutes = isBottomHalf ? 30 : 0;
                            
                            // Create new task with pre-filled date and time
                            const dueDate = new Date(day);
                            dueDate.setHours(hour, minutes, 0, 0);
                            
                            // Set the pre-filled data and open Add dialog
                            setSelectedDate(dueDate);
                            setNewTaskType("other");
                            setInitialStartTime(`${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                            setInitialEndTime(`${(hour + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                            setIsAddDialogOpen(true);
                          }}
                        >
                          {/* Half-hour dotted line - positioned in middle of task area (after any conflict offset) */}
                          <div 
                            className="absolute left-0 right-0 border-t border-dotted border-gray-300/50 dark:border-gray-600/50 z-0" 
                            style={{
                              // When there's a prep conflict, tasks are pushed down 24px, so the half-hour line should be at: conflictOffset + (normalHeight / 2)
                              // This keeps it centered within the task area
                              top: prepConflictHeight > 0 
                                ? `${prepConflictHeight + ((gridSizes.timeSlotHeights[hour] || gridSizes.timeSlotHeight) / 2)}px`
                                : '50%'
                            }}
                          />
                          {/* Multi-hour tasks are now rendered at scroll container level as single elements */}
                          {hourTasks.filter(task => {
                            // Skip multi-hour tasks - they're rendered at scroll container level
                            if (task.eventStartTime && task.eventEndTime) {
                              const [startHour] = task.eventStartTime.split(':').map(Number);
                              const [endHour] = task.eventEndTime.split(':').map(Number);
                              if (endHour > startHour) return false;
                            }
                            return true;
                          }).map((task, taskIdx) => {
                            const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                            const colors = courseColors[courseCode];
                            const today = startOfDay(new Date());
                            const tomorrow = addDays(today, 1);
                            const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                            const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                            
                            // Check for prep days
                            const hasPrepDays = !!task.startDate && !task.isCompleted;
                            const prepDaysCount = hasPrepDays && task.startDate
                              ? Math.max(0, Math.min(2, differenceInDays(new Date(task.dueDate), new Date(task.startDate))))
                              : 0;
                            
                            // Check if this task is covered by a prep extension from another task
                            const isCoveredByPrep = isTaskCoveredByPrepExtension(day, hour, task.id);
                            
                            // Calculate height based on duration for events with start/end times
                            let taskHeight = hasPrepDays && prepDaysCount > 0 ? 36 : 40; // Slightly smaller for prep tasks
                            let topOffset = 2; // Default top offset
                            
                            // If covered by prep extension, push task down below it
                            if (isCoveredByPrep) {
                              topOffset += 20; // Push down by prep extension height
                            }
                            
                            if (task.eventStartTime && task.eventEndTime) {
                              const [startHour, startMin] = task.eventStartTime.split(':').map(Number);
                              const [endHour, endMin] = task.eventEndTime.split(':').map(Number);
                              const startMinutes = startHour * 60 + startMin;
                              const endMinutes = endHour * 60 + endMin;
                              const durationMinutes = endMinutes - startMinutes;
                              // Single hour tasks only now
                              taskHeight = hasPrepDays && prepDaysCount > 0 
                                ? Math.max(36, (durationMinutes / 60) * 44 - 8)
                                : Math.max(40, (durationMinutes / 60) * 44 - 4);
                              // Offset for minutes past the hour, plus prep offset if covered
                              topOffset = (startMin / 60) * 44 + (isCoveredByPrep ? 20 : 0);
                            }
                            
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
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTask(task);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Delete' || e.key === 'Backspace') {
                                    e.preventDefault();
                                    deleteMutation.mutate(task.id);
                                    setSelectedTaskId(null);
                                  }
                                }}
                                className={`absolute hover:opacity-90 shadow-sm cursor-grab active:cursor-grabbing ${
                                  draggedTask?.id === task.id ? "opacity-50" : ""
                                } ${
                                  selectedTaskId === task.id ? "ring-2 ring-red-500 ring-offset-1" : ""
                                } ${
                                  isDueToday ? "task-blink-border" : ""
                                } ${
                                  hasPrepDays && prepDaysCount > 0
                                    ? "rounded-r rounded-bl overflow-visible" 
                                    : "rounded overflow-hidden"
                                } ${
                                  task.isCompleted 
                                    ? "bg-gray-200 border border-gray-300" 
                                    : colors 
                                      ? `${colors.bg} border ${colors.border}` 
                                      : "bg-gray-200 border border-gray-400"
                                }`}
                                style={{
                                  top: `${topOffset}px`,
                                  left: `calc(${taskIdx * columnWidth}% + 2px)`,
                                  width: `calc(${columnWidth}% - 4px)`,
                                  height: `${taskHeight}px`,
                                  zIndex: selectedTaskId === task.id ? 50 : (draggedTask?.id === task.id ? 45 : 43),
                                  borderTopLeftRadius: hasPrepDays && prepDaysCount > 0 ? '0' : undefined
                                }}
                                data-testid={`time-task-${task.id}`}
                                data-cal-task-id={task.id}
                                data-cal-date={format(day, 'yyyy-MM-dd')}
                              >
                                {/* Silver shimmer header with checkbox and title for due today tasks */}
                                <div className={`flex items-center gap-0.5 px-0.5 py-1 ${isDueToday ? "silver-shimmer-header" : ""}`}>
                                  <Checkbox
                                    checked={task.isCompleted || false}
                                    onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                    className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                                    data-testid={`checkbox-time-${task.id}`}
                                  />
                                  <div 
                                    onClick={() => setEditingTask(task)}
                                    className={`text-[8px] font-bold truncate cursor-pointer flex-1 ${
                                      task.isCompleted ? "text-gray-400 line-through" : "text-black"
                                    }`}
                                  >
                                    {task.title}
                                  </div>
                                </div>
                                <div 
                                  className={`text-[9px] font-semibold mt-0.5 mb-3 ml-4 px-0.5 ${task.isCompleted ? "text-gray-400" : "text-muted-foreground"}`}
                                  style={{ animation: 'none' }}
                                >
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
                                <div className="text-[8px] font-bold truncate text-black">
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
                    {/* Individual time slot row resize handle */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-[3px] cursor-row-resize z-[50] opacity-0 group-hover/row:opacity-100 hover:bg-blue-400/50 transition-opacity"
                      onMouseDown={(e) => handleRowResizeStart(e, 'timeSlot', hour)}
                      data-testid={`resize-timeslot-row-${hour}`}
                    />
                                      </div>
                  );
                })}
                
                {/* Multi-hour tasks overlay - rendered as single absolute positioned elements */}
                {getMultiHourTasksForWeek().map(({ task, dayIdx, topPx, heightPx }) => {
                  const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                  const colors = courseColors[courseCode];
                  const today = startOfDay(new Date());
                  const tomorrow = addDays(today, 1);
                  const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                  const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                  
                  // Check for prep days
                  const hasPrepDays = !!task.startDate && !task.isCompleted;
                  const prepDaysCount = hasPrepDays && task.startDate
                    ? Math.max(0, Math.min(2, differenceInDays(new Date(task.dueDate), new Date(task.startDate))))
                    : 0;
                  
                  // Check if this task is covered by a prep extension from another task
                  const taskDay = weekDays[dayIdx];
                  const taskHour = task.eventStartTime ? parseInt(task.eventStartTime.split(':')[0]) : 0;
                  const isCoveredByPrep = isTaskCoveredByPrepExtension(taskDay, taskHour, task.id);
                  
                  // Adjust topPx if covered by prep extension - push down by 24px (height of prep bar)
                  const adjustedTopPx = isCoveredByPrep ? topPx + 24 : topPx;
                  
                  // For tasks with prep days, check if they need extra height to match pushed-down tasks
                  const prepStartDayIdx = hasPrepDays && prepDaysCount > 0 ? Math.max(0, dayIdx - prepDaysCount) : dayIdx;
                  const heightExtension = hasPrepDays && prepDaysCount > 0 
                    ? getPrepTaskHeightExtension(task.id, taskHour, prepStartDayIdx, dayIdx) 
                    : 0;
                  const adjustedHeightPx = heightPx + heightExtension;
                  
                  // Prep colors from course colors
                  const prepBgClass = colors ? colors.prepBg : 'bg-gray-100';
                  const prepBorderClass = colors ? colors.prepBorder : 'border-gray-300';
                  
                  // Calculate day column width for prep extension
                  const dayColWidth = `calc((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7)`;
                  
                  return (
                    <div
                      key={`multi-${task.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(task.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingTask(task);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (confirm('Delete this task?')) {
                          deleteMutation.mutate(task.id);
                          setSelectedTaskId(null);
                        }
                      }}
                      className={`absolute hover:opacity-90 shadow-sm cursor-grab active:cursor-grabbing ${
                        draggedTask?.id === task.id ? "opacity-50" : ""
                      } ${
                        selectedTaskId === task.id ? "ring-2 ring-red-500 ring-offset-1" : ""
                      } ${
                        isDueToday ? "task-blink-border" : ""
                      } ${
                        hasPrepDays && prepDaysCount > 0
                          ? "rounded-r rounded-bl overflow-visible" 
                          : "rounded overflow-hidden"
                      } ${
                        task.isCompleted 
                          ? "bg-gray-200 border border-gray-300" 
                          : colors 
                            ? hasPrepDays && prepDaysCount > 0
                              ? `${colors.bg} border-t border-r border-b ${colors.border}` 
                              : `${colors.bg} border ${colors.border}`
                            : "bg-gray-200 border border-gray-400"
                      }`}
                      style={{
                        top: `${adjustedTopPx}px`,
                        // For tasks with prep days, start at exact column edge (no left padding) for seamless connection
                        left: hasPrepDays && prepDaysCount > 0
                          ? `calc(${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px + (${dayIdx} * ((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7)))`
                          : `calc(${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px + (${dayIdx} * ((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7)) + 2px)`,
                        width: hasPrepDays && prepDaysCount > 0
                          ? `calc(((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7) - 2px)`
                          : `calc(((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7) - 4px)`,
                        height: `${adjustedHeightPx}px`,
                        zIndex: selectedTaskId === task.id ? 50 : (draggedTask?.id === task.id ? 45 : 43),
                        borderTopLeftRadius: hasPrepDays && prepDaysCount > 0 ? '0' : undefined
                      }}
                      data-testid={`multi-hour-task-${task.id}`}
                      data-cal-task-id={task.id}
                      data-cal-date={format(taskDay, 'yyyy-MM-dd')}
                    >
                      {/* Silver shimmer header with checkbox and title for due today tasks */}
                      <div className={`flex items-center gap-0.5 px-0.5 py-1 ${isDueToday ? "silver-shimmer-header" : ""}`}>
                        <Checkbox
                          checked={task.isCompleted || false}
                          onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                          className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span 
                          onClick={() => setEditingTask(task)}
                          className={`text-[9px] leading-tight font-bold line-clamp-2 cursor-pointer ${task.isCompleted ? "line-through text-muted-foreground" : "text-black"}`}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.eventStartTime && task.eventEndTime && (
                        <div 
                          className="text-[8px] font-semibold text-muted-foreground ml-3 px-0.5"
                          style={{ animation: 'none' }}
                        >
                          {formatTimeTo12Hour(task.eventStartTime)} - {formatTimeTo12Hour(task.eventEndTime)}
                        </div>
                      )}
                      {/* Left border segment for tasks with prep days - from below prep bar to bottom */}
                      {hasPrepDays && prepDaysCount > 0 && (
                        <div 
                          className={`absolute left-0 bottom-0 w-px ${colors ? colors.border.replace('border-', 'bg-') : 'bg-gray-400'}`}
                          style={{
                            height: `calc(100% - 20px)`
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                
                {/* Prep Extensions Overlay - rendered as separate elements spanning day columns */}
                {getPrepExtensionsForWeek().map(({ task, dueDayIdx, prepStartDayIdx, prepDaysCount, topPx, heightPx }) => {
                  const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                  const colors = courseColors[courseCode];
                  const prepBgClass = colors ? colors.prepBg : 'bg-gray-100';
                  
                  // Get the darker border color from the main task colors for the prep extension border
                  const mainBorderClass = colors ? colors.border : 'border-gray-400';
                  
                  // Prep extension is a short bar at the top (about 20px), not full height
                  const prepBarHeight = 20;
                  
                  // Find today's index in the weekDays array (not day-of-week)
                  const today = new Date();
                  const todayGridIdx = weekDays.findIndex(day => isSameDay(day, today));
                  
                  // Check if today falls within the prep days range (prepStartDayIdx to dueDayIdx-1)
                  const isTodayInPrepRange = todayGridIdx >= 0 && todayGridIdx >= prepStartDayIdx && todayGridIdx < dueDayIdx;
                  
                  // Calculate the position of today within the prep range (0-indexed from prep start)
                  const todayOffsetInPrep = isTodayInPrepRange ? todayGridIdx - prepStartDayIdx : -1;
                  
                  return (
                    <div
                      key={`prep-ext-${task.id}`}
                      className={`absolute ${prepBgClass} border-l border-t border-b ${mainBorderClass} rounded-tl rounded-bl pointer-events-none`}
                      style={{
                        // Align exactly with task top (remove the +2 offset that was added in topPx calculation)
                        top: `${topPx - 2}px`,
                        // Start with 2px padding from column edge
                        left: `calc(${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px + (${prepStartDayIdx} * ((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7)) + 2px)`,
                        // Width spans prep days, overlapping 1px into task to ensure seamless connection
                        width: `calc(${prepDaysCount} * ((100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) / 7) - 1px)`,
                        height: `${prepBarHeight}px`,
                        zIndex: 35
                      }}
                      data-testid={`prep-extension-${task.id}`}
                    >
                      {/* Blinking overlay for today column portion - uses task background color */}
                      {isTodayInPrepRange && (
                        <div
                          className={`absolute inset-y-0 animate-pulse-task ${colors ? colors.bg.split(' ')[0] : 'bg-gray-100'}`}
                          style={{
                            left: `calc(${todayOffsetInPrep} * (100% / ${prepDaysCount}))`,
                            width: `calc(100% / ${prepDaysCount})`,
                            borderRadius: todayOffsetInPrep === 0 ? '4px 0 0 4px' : '0'
                          }}
                          data-prep-today-task-id={task.id}
                        />
                      )}
                      {/* Prep Days text - centered on today column if in range, otherwise centered overall */}
                      <span 
                        className="absolute text-[9px] text-gray-500 font-medium whitespace-nowrap"
                        style={{
                          left: isTodayInPrepRange 
                            ? `calc(${todayOffsetInPrep} * (100% / ${prepDaysCount}) + (100% / ${prepDaysCount}) / 2)`
                            : '50%',
                          transform: 'translateX(-50%)',
                          top: '50%',
                          marginTop: '-6px'
                        }}
                        data-prep-text-task-id={task.id}
                      >
                        Prep days
                      </span>
                    </div>
                  );
                })}
            </div>
                      </CardContent>
          </Card>
          </div>
          
          {/* Weeks Flyout - separate panel for week folders, starts below the two flyouts above */}
          <div className={`absolute right-0 z-50 ${isResizingWeeksFlyout ? '' : 'transition-all duration-300 ease-in-out'} overflow-hidden ${isWeeksFlyoutOpen ? 'opacity-100' : 'w-0 opacity-0'}`} style={{ width: isWeeksFlyoutOpen ? `${Math.max(flyoutWidth, flyout2Width) + 30}px` : '0', top: `${41 + gridSizes.allDayRowHeight + 3 * gridSizes.courseRowHeight + 15}px`, bottom: '55px' }}>
            {/* Resize Handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-50 hover:bg-white/20 active:bg-white/30"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingWeeksFlyout(true);
                const startX = e.clientX;
                const startWidth = Math.max(flyoutWidth, flyout2Width);
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const delta = startX - moveEvent.clientX;
                  const newWidth = Math.max(150, Math.min(400, startWidth + delta));
                  // Sync all flyout widths together
                  setFlyoutWidth(newWidth);
                  setFlyout2Width(newWidth);
                  setWeeksFlyoutWidth(newWidth);
                };
                
                const handleMouseUp = () => {
                  setIsResizingWeeksFlyout(false);
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
              data-testid="weeks-flyout-resize-handle"
            />
            <div className="h-full bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border-l border-white/20 flex flex-col text-white relative rounded-l-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              {/* Header with arrows and date */}
              <div className="flex items-center justify-center px-2 bg-black/30 relative z-10" style={{ height: '41px' }}>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 hover:bg-white/20 rounded-md" 
                    onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                    data-testid="button-weeks-flyout-prev-week"
                  >
                    <ChevronLeft className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </Button>
                  <div className="flex items-center gap-1 bg-white/10 rounded-md px-1.5 py-0.5 backdrop-blur-sm whitespace-nowrap">
                    <span className="text-[10px] font-medium text-white">{format(weekStartDate, "MMM d")}</span>
                    <span className="text-[10px] text-white/50">—</span>
                    <span className="text-[10px] font-medium text-white">{format(weekEndDate, "MMM d")}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 hover:bg-white/20 rounded-md" 
                    onClick={() => setSelectedWeek(Math.min(13, selectedWeek + 1))}
                    data-testid="button-weeks-flyout-next-week"
                  >
                    <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </Button>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setIsWeeksFlyoutOpen(false)}
                  className="h-5 w-5 text-white/70 hover:text-white hover:bg-white/20 absolute right-1"
                  data-testid="button-close-weeks-flyout"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* All Files Header */}
              <div className="flex items-center gap-1.5 pl-2 pr-2 py-1 bg-black/30 border-b border-white/20">
                <Folder className="h-3 w-3 text-blue-400 fill-blue-300" />
                <span className="text-xs font-medium">All Files</span>
              </div>
              
              {/* Week Folders */}
              <div className="flex-1 overflow-y-auto py-2 px-2" style={{ scrollbarWidth: 'none' }}>
                {(() => {
                  // Get current week number based on today's date
                  const today = new Date();
                  const currentWeekData = weeks.find(w => {
                    const start = new Date(w.startDate);
                    const end = new Date(w.endDate);
                    return today >= start && today <= end;
                  });
                  const currentWeekNum = currentWeekData?.weekNumber || selectedWeek;
                  
                  // Sort weeks: 3-9 first, then 10-13, 1, 2 at the bottom
                  const sortedWeeks = [...FLYOUT_WEEKS].sort((a, b) => {
                    const aNum = parseInt(a.id.replace('week-', ''));
                    const bNum = parseInt(b.id.replace('week-', ''));
                    
                    const getOrder = (num: number) => {
                      if (num >= 3 && num <= 9) return num;
                      if (num >= 10 && num <= 13) return num;
                      return num + 13;
                    };
                    
                    return getOrder(aNum) - getOrder(bNum);
                  });
                  
                  const renderWeekFolder = (week: typeof sortedWeeks[0]) => {
                    const weekNum = parseInt(week.id.replace('week-', ''));
                    const isPastWeek = weekNum < currentWeekNum;
                    const weekFiles = getFilesInFlyoutWeek(week.id);
                    const isWeekExpanded = flyoutExpandedFolders.has(week.id);
                    const hasFiles = weekFiles.length > 0;
                    const allFilesCompleted = hasFiles && weekFiles.every(f => f.listened);
                    const shouldBlink = isPastWeek && hasFiles && !allFilesCompleted;
                    const shouldStrikethrough = isPastWeek && allFilesCompleted;
                    
                    if (!hasFiles) return null;
                    
                    return (
                      <div key={week.id}>
                        {/* Week folder row */}
                        <div 
                          className={`flex items-center gap-1 pr-2 py-0.5 hover:bg-white/10 cursor-pointer rounded border-0 ${shouldBlink ? 'animate-week-blink' : ''}`}
                          onClick={() => toggleFlyoutFolder(week.id)}
                        >
                          {isWeekExpanded ? <ChevronDown className="h-3 w-3 text-white/60" /> : <ChevronRight className="h-3 w-3 text-white/60" />}
                          {isWeekExpanded ? <FolderOpen className="h-3 w-3 text-yellow-500 fill-yellow-400" /> : <Folder className="h-3 w-3 text-yellow-500 fill-yellow-400" />}
                          <span className={`text-[11px] truncate ${shouldStrikethrough ? 'text-white/50' : 'text-white/90'}`}>{week.name}</span>
                          <span className="text-[10px] text-white/40 ml-auto">{weekFiles.length}</span>
                        </div>
                        
                        {/* Course folders inside week */}
                        {isWeekExpanded && (
                          <div className="ml-3">
                            {FLYOUT_COURSES.map((course) => {
                              const courseFiles = getFilesInFlyoutCourse(week.id, course.id);
                              const courseFolderId = `${week.id}-${course.id}`;
                              const isCourseExpanded = flyoutExpandedFolders.has(courseFolderId);
                              
                              if (courseFiles.length === 0) return null;
                              
                              return (
                                <div key={courseFolderId}>
                                  <div
                                    className="flex items-center gap-1 pr-2 py-0.5 hover:bg-white/10 cursor-pointer rounded"
                                    onClick={() => toggleFlyoutFolder(courseFolderId)}
                                  >
                                    {isCourseExpanded ? <ChevronDown className="h-3 w-3 text-white/60" /> : <ChevronRight className="h-3 w-3 text-white/60" />}
                                    {isCourseExpanded ? <FolderOpen className="h-3 w-3 text-yellow-500 fill-yellow-400" /> : <Folder className="h-3 w-3 text-yellow-500 fill-yellow-400" />}
                                    <span className={`text-[11px] truncate flex-1 ${course.color}`}>{course.name}</span>
                                    <span className="text-[10px] text-white/40">{courseFiles.length}</span>
                                  </div>
                                  
                                  {/* Content folders inside course */}
                                  {isCourseExpanded && (
                                    <div className="ml-3">
                                      {FLYOUT_CONTENT.map((content) => {
                                        const contentFolderId = `${week.id}-${course.id}-${content.id}`;
                                        const contentFiles = getFilesInFlyoutFolder(contentFolderId);
                                        const isContentExpanded = flyoutExpandedFolders.has(contentFolderId);
                                        
                                        if (contentFiles.length === 0) return null;
                                        
                                        return (
                                          <div key={contentFolderId}>
                                            <div
                                              className="flex items-center gap-1 pr-2 py-0.5 hover:bg-white/10 cursor-pointer rounded"
                                              onClick={() => toggleFlyoutFolder(contentFolderId)}
                                            >
                                              {isContentExpanded ? <ChevronDown className="h-3 w-3 text-white/60" /> : <ChevronRight className="h-3 w-3 text-white/60" />}
                                              {isContentExpanded ? <FolderOpen className="h-3 w-3 text-yellow-500 fill-yellow-400" /> : <Folder className="h-3 w-3 text-yellow-500 fill-yellow-400" />}
                                              <span className="text-[11px] text-white/90 truncate flex-1">{content.name}</span>
                                              <span className="text-[10px] text-white/40">{contentFiles.length}</span>
                                            </div>
                                            
                                            {/* Files inside content folder */}
                                            {isContentExpanded && (
                                              <div className="ml-3 space-y-0">
                                                {contentFiles.map((file) => (
                                                  <div
                                                    key={file.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                      e.dataTransfer.setData('application/json', JSON.stringify({ 
                                                        url: file.objectPath, 
                                                        name: file.displayName || file.originalName 
                                                      }));
                                                      setDraggedFile({ url: file.objectPath, name: file.displayName || file.originalName });
                                                    }}
                                                    onDragEnd={() => setDraggedFile(null)}
                                                    className="flex items-center gap-1 pr-2 py-0.5 hover:bg-white/10 cursor-pointer rounded"
                                                    onClick={() => setPreviewFile(file)}
                                                  >
                                                    <Checkbox
                                                      checked={file.listened || false}
                                                      onCheckedChange={async (checked) => {
                                                        try {
                                                          await fetch(`/api/files/${file.id}`, {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ listened: checked === true })
                                                          });
                                                          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                                                        } catch (err) {
                                                          console.error('Failed to update listened status:', err);
                                                        }
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="h-3 w-3 border border-white/40 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                    />
                                                    <FileText className="h-3 w-3 text-white/50 shrink-0" />
                                                    <span className={`text-[10px] truncate flex-1 hover:underline ${file.listened ? 'text-white/40' : 'text-white/80'}`}>
                                                      {file.displayName || file.originalName}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  };
                  
                  return sortedWeeks.map(week => renderWeekFolder(week));
                })()}
              </div>
              
              {/* Copyright */}
              <div className="absolute bottom-[1px] right-2 text-white/60 text-[10px] font-medium z-50">
                © 2026
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div className="mb-[12px] transition-all duration-300" style={{ height: isTodoFlyoutOpen ? calendarHeight - 164 : calendarHeight, order: 2 }}>
          <Card className="shadow-lg overflow-hidden h-full border-[0.1px] border-white bg-white/50 backdrop-blur-sm" style={{ borderRadius: '16px' }}>
            <CardContent className="p-0 h-full overflow-auto">
              {/* Month Header */}
              <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-white/50 backdrop-blur-sm z-10">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-bold text-black dark:text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}>{format(currentMonth, "MMMM yyyy")}</span>
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
                        } ${isToday ? "bg-[#EAE4DE]" : ""}`}
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
        {/* Due Today, Due Tomorrow, Due This Week - Grouped by Course */}
        {(() => {
          // Helper function to get course color
          const getCourseColor = (courseName: string | null | undefined) => {
            if (!courseName) return '#888888';
            if (courseName.startsWith('CPPA122')) return '#22c55e'; // green
            if (courseName.startsWith('CFNF400')) return '#ec4899'; // pink
            if (courseName.startsWith('CASL101')) return '#6366f1'; // indigo
            return '#888888';
          };
          
          // Helper function to parse task attachments
          const parseAttachments = (attachments: any[] | null | undefined) => {
            if (!attachments || attachments.length === 0) return [];
            return attachments.map(att => {
              if (typeof att === 'string') {
                try {
                  const parsed = JSON.parse(att);
                  return { name: parsed.name || parsed.url?.split('/').pop() || 'File', url: parsed.url || att };
                } catch {
                  return { name: att.split('/').pop() || 'File', url: att };
                }
              }
              return { name: att.name || att.url?.split('/').pop() || 'File', url: att.url || '' };
            });
          };
          
          // Helper to find matching file from allFiles
          const findFileByUrl = (url: string) => {
            return allFiles.find(f => f.objectPath === url || f.objectPath.includes(url) || url.includes(f.objectPath));
          };
          
          // Group tasks by course
          const groupByCourse = (tasks: typeof dueTodayTasks) => {
            const grouped: Record<string, typeof tasks> = {};
            const courseOrder = ['CPPA122', 'CFNF400', 'CASL101'];
            tasks.forEach(task => {
              const courseCode = task.courseName?.split(' - ')[0] || task.courseName?.split(' ')[0] || 'OTHER';
              if (!grouped[courseCode]) grouped[courseCode] = [];
              grouped[courseCode].push(task);
            });
            return Object.entries(grouped).sort(([a], [b]) => {
              const aIdx = courseOrder.indexOf(a);
              const bIdx = courseOrder.indexOf(b);
              if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
              if (aIdx === -1) return 1;
              if (bIdx === -1) return -1;
              return aIdx - bIdx;
            });
          };
          
          // Render a single task row
          const renderTask = (task: typeof dueTodayTasks[0], showDaysUntil = false, boxType: 'today' | 'tomorrow' | 'thisweek' = 'today') => {
            const attachments = parseAttachments(task.attachments);
            const daysUntil = differenceInDays(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
            
            // Check if this is a module task (has startDate spanning multiple days)
            // and if it's Wednesday or later (should blink)
            const today = new Date();
            const currentDayOfWeek = today.getDay();
            const isWednesdayOrLater = currentDayOfWeek >= 3 && currentDayOfWeek <= 5;
            const isModuleTask = task.startDate && task.startDate !== task.dueDate;
            const shouldBlinkInTodayBox = isModuleTask && isWednesdayOrLater && !task.isCompleted;
            
            return (
              <div 
                key={task.id} 
                className={`mb-1.5 rounded transition-colors ${draggedFile ? 'hover:bg-white/20 hover:ring-2 hover:ring-white/50' : ''} ${shouldBlinkInTodayBox ? 'animate-blink' : ''}`} 
                data-box-task-id={task.id} 
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onDragOver={(e) => { if (draggedFile) { e.preventDefault(); e.stopPropagation(); } }}
                onDrop={(e) => handleFileDropOnTask(e, task.id)}
                data-testid={`droppable-task-${task.id}`}
              >
                <div className="flex items-center gap-2">
                  {shouldBlinkInTodayBox && (
                    <Bell className="h-3.5 w-3.5 text-red-500 animate-blink flex-shrink-0" />
                  )}
                  <input
                    type="checkbox"
                    checked={task.isCompleted ?? false}
                    onChange={(e) => completeMutation.mutate({ id: task.id, isCompleted: e.target.checked })}
                    className="h-3.5 w-3.5 rounded-sm border-0 cursor-pointer flex-shrink-0"
                    style={{ accentColor: getCourseColor(task.courseName) }}
                    data-testid={`checkbox-task-${task.id}`}
                    {...(boxType === 'today' ? { 'data-today-checkbox': task.id } : {})}
                    {...(boxType === 'tomorrow' ? { 'data-tomorrow-checkbox': task.id } : {})}
                  />
                  <button 
                    className="text-[11px] text-white font-normal truncate flex-1 text-left hover:underline cursor-pointer"
                    onClick={() => setEditingTask(task)}
                    data-testid={`task-link-${task.id}`}
                  >
                    {task.title}
                  </button>
                  {attachments.length > 0 && (
                    <div className="flex-shrink-0" style={{ marginRight: '55px' }}>
                      <Paperclip className="h-3 w-3 text-white" strokeWidth={2.5} />
                    </div>
                  )}
                  {showDaysUntil && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-white font-normal">
                        {format(new Date(task.dueDate), 'EEEE')} {format(new Date(task.dueDate), 'MMM d')}
                      </span>
                      <div 
                        className="working-indicator" 
                        title={`${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`}
                      >
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <div className="circle"></div>
                        <span className="days-overlay">{daysUntil}</span>
                      </div>
                    </div>
                  )}
                </div>
                {attachments.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {attachments.map((file, idx) => {
                      const matchingFile = findFileByUrl(file.url);
                      const displayName = matchingFile?.displayName || file.name || file.url.split('/').pop() || 'File';
                      return (
                        <button
                          key={idx}
                          className={`flex items-center gap-1.5 text-[10px] text-black cursor-pointer w-full pl-6 ${blinkSettings.taskBoxFilesBlink ? 'animate-file-box-blink-fast' : 'bg-[rgba(127,219,225,0.8)]'}`}
                          onClick={() => {
                            if (matchingFile) {
                              setPreviewFile(matchingFile);
                            } else {
                              window.open(file.url, '_blank');
                            }
                          }}
                          data-testid={`file-link-${task.id}-${idx}`}
                        >
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };
          
          // Render grouped tasks with course headers
          const renderGroupedTasks = (tasks: typeof dueTodayTasks, showDaysUntil = false) => {
            const grouped = groupByCourse(tasks);
            return grouped.map(([courseCode, courseTasks]) => {
              const courseName = courseTasks[0]?.courseName || courseCode;
              return (
                <div key={courseCode} className="mb-3 last:mb-0">
                  <div 
                    className="text-[10px] text-black font-normal mb-1 pb-0.5 border-b border-white/30"
                  >
                    {courseName}
                  </div>
                  <div className="space-y-0.5">
                    {courseTasks.map(task => renderTask(task, showDaysUntil, 'thisweek'))}
                  </div>
                </div>
              );
            });
          };
          
          return (
        <div className="flex gap-4 mb-3 mt-[6px] items-stretch flex-shrink-0 relative" style={{ order: 1, zIndex: 35 }} data-task-boxes-container="true">
          {/* Due This Week */}
          <section 
            className={`flex-1 rounded-md shadow-md border-[0.1px] border-white overflow-hidden flex flex-col min-h-[120px] ${draggedBox === 'this-week' ? 'opacity-50' : ''}`} 
            style={{ background: 'linear-gradient(315deg, #C4DEF3, #8695B2)', order: boxOrder.indexOf('this-week') + 1 }} 
            data-testid="section-due-this-week"
            onDragOver={(e) => handleBoxDragOver(e, 'this-week')}
          >
            <h4 
              className="text-xs font-normal py-1.5 px-3 flex items-center gap-2 text-white cursor-grab" 
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", background: colorSettings.headerBar }}
              draggable
              onDragStart={() => handleBoxDragStart('this-week')}
              onDragEnd={handleBoxDragEnd}
            >
              <Calendar className="h-3 w-3 text-white" />
              THIS WEEK ({dueThisWeekTasks.length})
            </h4>
            <div className="flex-1 p-3">
              {isLoading ? (
                <div className="text-white/60 text-xs">Loading...</div>
              ) : dueThisWeekTasks.length === 0 ? (
                <div className="text-white/60 text-xs">No other tasks this week</div>
              ) : (
                <div className="space-y-0.5">
                  {dueThisWeekTasks.map((task, idx) => {
                    const prevTask = idx > 0 ? dueThisWeekTasks[idx - 1] : null;
                    const showCourseHeader = !prevTask || prevTask.courseName !== task.courseName;
                    return (
                      <div key={task.id}>
                        {showCourseHeader && (
                          <div className="text-[10px] text-black font-normal mb-1 mt-2 first:mt-0 pb-0.5 border-b border-white/30">
                            {task.courseName}
                          </div>
                        )}
                        {renderTask(task, true, 'thisweek')}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Due Today */}
          <section 
            className={`flex-1 rounded-md shadow-md border-[0.1px] border-white overflow-hidden flex flex-col min-h-[120px] ${draggedBox === 'today' ? 'opacity-50' : ''}`} 
            style={{ background: 'linear-gradient(315deg, #C4DEF3, #8695B2)', order: boxOrder.indexOf('today') + 1 }} 
            data-testid="section-due-today"
            onDragOver={(e) => handleBoxDragOver(e, 'today')}
          >
            <h4 
              className="text-xs font-normal py-1.5 px-3 flex items-center gap-2 text-white cursor-grab" 
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", background: colorSettings.headerBar }}
              draggable
              onDragStart={() => handleBoxDragStart('today')}
              onDragEnd={handleBoxDragEnd}
            >
              <Calendar className="h-3 w-3 text-white" />
              TODAY ({dueTodayTasks.length})
            </h4>
            <div className="flex-1 p-3 flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-white/60 text-xs">Loading...</div>
              ) : dueTodayTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/60 text-xs">No tasks today</div>
              ) : (
                <div className="space-y-0.5">
                  {dueTodayTasks.map((task, idx) => {
                    const prevTask = idx > 0 ? dueTodayTasks[idx - 1] : null;
                    const showCourseHeader = !prevTask || prevTask.courseName !== task.courseName;
                    return (
                      <div key={task.id}>
                        {showCourseHeader && (
                          <div className="text-[10px] text-black font-normal mb-1 mt-2 first:mt-0 pb-0.5 border-b border-white/30">
                            {task.courseName}
                          </div>
                        )}
                        {renderTask(task, false, 'today')}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Due Tomorrow */}
          <section 
            className={`flex-1 rounded-md shadow-md border-[0.1px] border-white overflow-hidden flex flex-col min-h-[120px] ${draggedBox === 'tomorrow' ? 'opacity-50' : ''}`} 
            style={{ background: 'linear-gradient(315deg, #C4DEF3, #8695B2)', order: boxOrder.indexOf('tomorrow') + 1 }} 
            data-testid="section-due-tomorrow"
            onDragOver={(e) => handleBoxDragOver(e, 'tomorrow')}
          >
            <h4 
              className="text-xs font-normal py-1.5 px-3 flex items-center gap-2 text-white cursor-grab" 
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", background: colorSettings.headerBar }}
              draggable
              onDragStart={() => handleBoxDragStart('tomorrow')}
              onDragEnd={handleBoxDragEnd}
            >
              <Calendar className="h-3 w-3 text-white" />
              TOMORROW ({dueTomorrowTasks.length})
            </h4>
            <div className="flex-1 p-3 flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-white/60 text-xs">Loading...</div>
              ) : dueTomorrowTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/60 text-xs">No tasks tomorrow</div>
              ) : (
                <div className="space-y-0.5">
                  {dueTomorrowTasks.map((task, idx) => {
                    const prevTask = idx > 0 ? dueTomorrowTasks[idx - 1] : null;
                    const showCourseHeader = !prevTask || prevTask.courseName !== task.courseName;
                    return (
                      <div key={task.id}>
                        {showCourseHeader && (
                          <div className="text-[10px] text-black font-normal mb-1 mt-2 first:mt-0 pb-0.5 border-b border-white/30">
                            {task.courseName}
                          </div>
                        )}
                        {renderTask(task, false, 'tomorrow')}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
          );
        })()}

        {/* To Do Bottom Flyout */}
        <div 
          className="fixed left-[12px] right-[12px] z-[100] transition-all duration-300 ease-in-out"
          style={{ bottom: isTodoFlyoutOpen ? '0' : '-158px' }}
        >
          {/* Tab at top of flyout - always visible */}
          <div 
            className="flex justify-center cursor-pointer"
            onClick={() => setIsTodoFlyoutOpen(!isTodoFlyoutOpen)}
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-t-md bg-black/60 backdrop-blur-md border border-b-0 border-white/20 hover:bg-black/70 transition-colors">
              <ClipboardCheck className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" />
              <span className="text-xs text-white/90 font-medium">To Do ({todoItems.filter(item => item.trim() !== "").length})</span>
              {isTodoFlyoutOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-yellow-500" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-yellow-500" />
              )}
            </div>
          </div>
          
          {/* Flyout content */}
          <section 
            className="shadow-lg border-t border-white/30 h-[158px] overflow-hidden flex flex-col rounded-t-md" 
            style={{ background: colorSettings.boxBackground }} 
            data-testid="section-todo"
          >
            <div className="grid grid-cols-4 gap-4 flex-1 p-3">
              {[0, 1, 2, 3].map(col => (
                <div key={col} className="flex flex-col gap-1.5 overflow-hidden">
                  {[0, 1, 2, 3, 4].map(row => {
                    const idx = col * 5 + row;
                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input type="checkbox" className="checkbox-black" />
                        <input 
                          type="text" 
                          className="flex-1 text-xs px-1.5 py-0.5 border border-gray-400 rounded bg-white text-black" 
                          placeholder="Task..." 
                          value={todoItems[idx]} 
                          onChange={(e) => {
                            const newItems = [...todoItems];
                            newItems[idx] = e.target.value;
                            setTodoItems(newItems);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        </div>

        {/* Reschedule Dialog */}
        <Dialog open={!!rescheduleTask} onOpenChange={(open) => !open && setRescheduleTask(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white [&_textarea]:text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Reschedule Task</DialogTitle>
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
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_label]:text-white">
            <DialogHeader className="flex flex-row items-center justify-between gap-4">
              <DialogTitle className="text-white">Edit Task</DialogTitle>
              {editingTask && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20 mr-6"
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
                key={`edit-task-${editingTask.id}`}
                task={editingTask}
                weekNumber={editingTask.weekNumber}
                onSuccess={() => setEditingTask(null)} 
              />
            )}
          </DialogContent>
        </Dialog>


        {/* Arrow Connections - Split into two SVG layers for proper z-indexing */}
        {/* Layer 1: Transparent curves ABOVE prep boxes (z-index: 46, above green columns at z-42) */}
        {blinkSettings.showArrows && arrowConnections.length > 0 && (
          <svg 
            className="fixed inset-0 pointer-events-none" 
            style={{ width: '100vw', height: '100vh', zIndex: 46 }}
          >
            <defs>
              <marker
                id="arrowhead-green"
                markerWidth="12"
                markerHeight="10"
                refX="10"
                refY="5"
                orient="auto-start-reverse"
              >
                <polygon points="0 0, 12 5, 0 10" fill="#22c55e" fillOpacity="1" />
              </marker>
              <marker
                id="arrowhead-pink"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#ec4899" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-indigo"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-black"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#000000" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-black-down"
                markerWidth="10"
                markerHeight="7"
                refX="3.5"
                refY="10"
                orient="auto"
              >
                <polygon points="0 0, 3.5 10, 7 0" fill="#000000" fillOpacity="0.75" />
              </marker>
            </defs>
            {arrowConnections.map((conn) => {
              const markerId = conn.color === "#22c55e" ? "arrowhead-green" 
                : conn.color === "#ec4899" ? "arrowhead-pink" 
                : conn.color === "#6366f1" ? "arrowhead-indigo"
                : "arrowhead-black";
              const exitX = conn.fromX - 21;
              const taskBoxesContainer = document.querySelector('[data-task-boxes-container="true"]');
              const containerBottom = taskBoxesContainer ? taskBoxesContainer.getBoundingClientRect().bottom + 5 : conn.fromY + 50;
              
              // Transparent path: FULL path from task box checkbox down to calendar task checkbox
              const isGreen = conn.color === "#22c55e";
              const midY = (containerBottom + conn.toY) / 2;
              
              // For green arrows: calculate where opaque line ends (at moduleColumnStart, splitY)
              const calendarContainer = document.querySelector('[data-calendar-grid="true"]');
              const calendarLeft = calendarContainer ? calendarContainer.getBoundingClientRect().left : 24;
              const moduleColumnStart = calendarLeft + gridSizes.timeColumnWidth;
              const opaqueExitX = conn.fromX - 21;
              const opaqueMidY = (containerBottom + conn.toY) / 2;
              const tCubed = (moduleColumnStart - opaqueExitX) / (conn.toX - opaqueExitX);
              let greenEndX = moduleColumnStart;
              let greenEndY = conn.toY;
              if (tCubed > 0 && tCubed <= 1 && !isNaN(tCubed)) {
                const t = Math.cbrt(tCubed);
                const oneMinusT = 1 - t;
                greenEndY = oneMinusT*oneMinusT*oneMinusT*containerBottom + 
                           3*oneMinusT*oneMinusT*t*opaqueMidY + 
                           3*oneMinusT*t*t*conn.toY + 
                           t*t*t*conn.toY;
              }
              
              // conn.fromX = Tomorrow box checkbox, conn.toX = Calendar task checkbox
              // Green arrow: arrowhead MUST ALWAYS be at CALENDAR (conn.toX) - NEVER EVER at Tomorrow box (conn.fromX)
              // Control points for curve - CP2 at same Y as Tomorrow checkbox for horizontal entry
              const greenExitPoint = { x: conn.fromX - 21, y: conn.fromY }; // 21px left of Tomorrow checkbox (same as This Week)
              const defaultGreenCP1 = { x: conn.toX - 40, y: containerBottom }; // control point 1 near calendar
              const defaultGreenCP2 = { x: greenExitPoint.x, y: containerBottom }; // control point 2 directly above exit point
              const defaultGreenEnd = { x: conn.fromX, y: conn.fromY }; // Tomorrow box checkbox (line ends here)
              
              // ABSOLUTE RULE: greenStart (arrowhead) is ALWAYS at CALENDAR task checkbox (conn.toX, conn.toY)
              // NEVER EVER at Tomorrow box - this is hardcoded and cannot be changed
              const greenStart = { x: conn.toX - 16, y: conn.toY }; // ALWAYS at CALENDAR task checkbox, 16px left
              
              // Only control points and end can use drag state - arrowhead position is locked
              const dragState = (window as any).__greenArrowDragState || {};
              const greenCP1 = dragState.cp1 || defaultGreenCP1;
              const greenCP2 = dragState.cp2 || defaultGreenCP2;
              const greenEnd = dragState.end || defaultGreenEnd;
              const arrowRotation = dragState.rotation || 0; // degrees
              // Green path: starts 10px left of arrowhead tip (left side of arrow), goes 7px left, then curves
              const arrowLeftSide = { x: greenStart.x - 10, y: greenStart.y };
              const horizontalEnd = { x: greenStart.x - 17, y: greenStart.y }; // 7px left of arrow left side
              // Green path: from arrowhead, curves down, then horizontal 21px into Tomorrow checkbox (like This Week box)
              // Tomorrow arrows: approach from above with downward arrowhead (mirror of Today arrows)
              let transparentPath: string;
              if (isGreen) {
                transparentPath = `M ${arrowLeftSide.x} ${arrowLeftSide.y} L ${horizontalEnd.x} ${horizontalEnd.y} C ${greenCP1.x} ${greenCP1.y}, ${greenCP2.x} ${greenCP2.y}, ${greenExitPoint.x} ${greenExitPoint.y} L ${greenEnd.x} ${greenEnd.y}`;
              } else if (conn.isTomorrow) {
                // Tomorrow arrows: come from above and point DOWN to checkbox (mirror of Today arrow)
                // Path: left from Tomorrow box -> down -> curve to directly above target -> straight down
                // Offset: 2px right, 2px up from original position
                const aboveTargetY = conn.toY - 40; // Position above the task
                const lineEndY = conn.toY - 13; // Stop at arrowhead tip, 6px higher total
                const targetX = conn.toX + 6; // Move 6px to the right
                transparentPath = `M ${conn.fromX} ${conn.fromY} L ${exitX} ${conn.fromY} L ${exitX} ${containerBottom} C ${exitX} ${(containerBottom + aboveTargetY) / 2}, ${targetX} ${aboveTargetY - 30}, ${targetX} ${aboveTargetY} L ${targetX} ${lineEndY}`;
              } else {
                // Today/This Week arrows: normal curved path from left side
                transparentPath = `M ${conn.fromX} ${conn.fromY} L ${exitX} ${conn.fromY} L ${exitX} ${containerBottom} C ${exitX} ${midY}, ${exitX} ${conn.toY}, ${conn.toX} ${conn.toY}`;
              }
              
              // For green: calculate opaque portion at END of curve (near Tomorrow box checkbox)
              // t=0.46 is where the opaque portion starts (last 54% of curve is opaque)
              const opaqueStartT = 0.46;
              const opaqueOneMinusT = 1 - opaqueStartT;
              // Bezier point at t: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
              const opaqueStartX = opaqueOneMinusT*opaqueOneMinusT*opaqueOneMinusT*horizontalEnd.x + 
                                3*opaqueOneMinusT*opaqueOneMinusT*opaqueStartT*greenCP1.x + 
                                3*opaqueOneMinusT*opaqueStartT*opaqueStartT*greenCP2.x + 
                                opaqueStartT*opaqueStartT*opaqueStartT*greenExitPoint.x;
              const opaqueStartY = opaqueOneMinusT*opaqueOneMinusT*opaqueOneMinusT*horizontalEnd.y + 
                                3*opaqueOneMinusT*opaqueOneMinusT*opaqueStartT*greenCP1.y + 
                                3*opaqueOneMinusT*opaqueStartT*opaqueStartT*greenCP2.y + 
                                opaqueStartT*opaqueStartT*opaqueStartT*greenExitPoint.y;
              // Split bezier control points using de Casteljau for second segment [t, 1]
              const Q0 = { x: horizontalEnd.x + opaqueStartT*(greenCP1.x - horizontalEnd.x), y: horizontalEnd.y + opaqueStartT*(greenCP1.y - horizontalEnd.y) };
              const Q1 = { x: greenCP1.x + opaqueStartT*(greenCP2.x - greenCP1.x), y: greenCP1.y + opaqueStartT*(greenCP2.y - greenCP1.y) };
              const Q2 = { x: greenCP2.x + opaqueStartT*(greenExitPoint.x - greenCP2.x), y: greenCP2.y + opaqueStartT*(greenExitPoint.y - greenCP2.y) };
              const R0 = { x: Q0.x + opaqueStartT*(Q1.x - Q0.x), y: Q0.y + opaqueStartT*(Q1.y - Q0.y) };
              const R1 = { x: Q1.x + opaqueStartT*(Q2.x - Q1.x), y: Q1.y + opaqueStartT*(Q2.y - Q1.y) };
              // New control points for second segment [t, 1]: split point, R1, Q2, greenExitPoint, then horizontal to checkbox
              const greenOpaquePath = `M ${opaqueStartX} ${opaqueStartY} C ${R1.x} ${R1.y}, ${Q2.x} ${Q2.y}, ${greenExitPoint.x} ${greenExitPoint.y} L ${greenEnd.x} ${greenEnd.y}`;
              
              // Arrow marker
              
              return (
                <g key={`transparent-${conn.taskId}`}>
                  <path
                    d={transparentPath}
                    stroke={conn.color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,3"
                    strokeOpacity="0.25"
                    markerEnd={isGreen ? undefined : `url(#${markerId})`}
                    markerStart={undefined}
                  />
                  {/* Green opaque overlay - first ~30 dashes following the curve */}
                  {isGreen && (
                    <path
                      d={greenOpaquePath}
                      stroke={conn.color}
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5,3"
                      strokeOpacity="1"
                    />
                  )}
                  {/* Green arrowhead */}
                  {isGreen && (
                    <g transform={`translate(${greenStart.x}, ${greenStart.y}) rotate(${arrowRotation})`}>
                      <polygon 
                        points="-6,-7 14,0 -6,7" 
                        fill="#22c55e" 
                        fillOpacity="0.75"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        
        {/* Layer 2: Opaque lines ON TOP of calendar (z-index: 55) */}
        {blinkSettings.showArrows && arrowConnections.length > 0 && (
          <svg 
            className="fixed inset-0 pointer-events-none" 
            style={{ width: '100vw', height: '100vh', zIndex: 55 }}
          >
            {arrowConnections.map((conn) => {
              // Skip green arrows - they're fully rendered in Layer 1
              const isGreen = conn.color === '#22c55e';
              if (isGreen) return null;
              
              const exitX = conn.fromX - 21;
              const taskBoxesContainer = document.querySelector('[data-task-boxes-container="true"]');
              const containerBottom = taskBoxesContainer ? taskBoxesContainer.getBoundingClientRect().bottom + 5 : conn.fromY + 50;
              
              // Module column boundary - where opaque ends and transparent begins
              const calendarContainer = document.querySelector('[data-calendar-grid="true"]');
              const calendarLeft = calendarContainer ? calendarContainer.getBoundingClientRect().left : 24;
              const moduleColumnStart = calendarLeft + gridSizes.timeColumnWidth;
              
              // Validate that calculation will produce valid results
              const denominator = conn.toX - exitX;
              if (denominator <= 0 || moduleColumnStart <= exitX) {
                // Invalid geometry - just draw a simple line from checkbox to task
                const simplePath = `M ${conn.fromX} ${conn.fromY} L ${exitX} ${conn.fromY} L ${exitX} ${containerBottom}`;
                return (
                  <g key={`opaque-${conn.taskId}`}>
                    <path
                      d={simplePath}
                      stroke={conn.color}
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5,3"
                      strokeOpacity="1"
                    />
                  </g>
                );
              }
              
              // Calculate where the cubic bezier crosses the module column boundary
              // For cubic bezier C(exitX, midY, exitX, toY, toX, toY):
              // x(t) = exitX + t³*(toX - exitX), so t³ = (moduleColumnStart - exitX) / (toX - exitX)
              const midY = (containerBottom + conn.toY) / 2;
              const tCubed = (moduleColumnStart - exitX) / (conn.toX - exitX);
              
              let opaquePath: string;
              if (tCubed <= 0 || tCubed > 1 || isNaN(tCubed)) {
                // The curve doesn't cross module column in valid range - just draw line to containerBottom
                opaquePath = `M ${conn.fromX} ${conn.fromY} L ${exitX} ${conn.fromY} L ${exitX} ${containerBottom}`;
              } else {
                const t = Math.cbrt(tCubed);
                // Calculate y position at t using cubic bezier formula
                // y(t) = (1-t)³*containerBottom + 3(1-t)²t*midY + 3(1-t)t²*toY + t³*toY
                const oneMinusT = 1 - t;
                const splitY = oneMinusT*oneMinusT*oneMinusT*containerBottom + 
                               3*oneMinusT*oneMinusT*t*midY + 
                               3*oneMinusT*t*t*conn.toY + 
                               t*t*t*conn.toY;
                
                // Calculate control points for the split cubic bezier (de Casteljau's algorithm)
                // Original: P0=(exitX,containerBottom), P1=(exitX,midY), P2=(exitX,toY), P3=(toX,toY)
                // For first segment [0,t], new control points are:
                const P0 = { x: exitX, y: containerBottom };
                const P1 = { x: exitX, y: midY };
                const P2 = { x: exitX, y: conn.toY };
                const P3 = { x: conn.toX, y: conn.toY };
                
                // First level interpolation
                const Q0 = { x: P0.x + t*(P1.x - P0.x), y: P0.y + t*(P1.y - P0.y) };
                const Q1 = { x: P1.x + t*(P2.x - P1.x), y: P1.y + t*(P2.y - P1.y) };
                const Q2 = { x: P2.x + t*(P3.x - P2.x), y: P2.y + t*(P3.y - P2.y) };
                
                // Second level interpolation
                const R0 = { x: Q0.x + t*(Q1.x - Q0.x), y: Q0.y + t*(Q1.y - Q0.y) };
                const R1 = { x: Q1.x + t*(Q2.x - Q1.x), y: Q1.y + t*(Q2.y - Q1.y) };
                
                // Split point (already calculated as moduleColumnStart, splitY)
                // New control points for first segment: P0, Q0, R0, split point
                opaquePath = `M ${conn.fromX} ${conn.fromY} L ${exitX} ${conn.fromY} L ${exitX} ${containerBottom} C ${Q0.x} ${Q0.y}, ${R0.x} ${R0.y}, ${moduleColumnStart} ${splitY}`;
              }
              
              return (
                <g key={`opaque-${conn.taskId}`}>
                  <path
                    d={opaquePath}
                    stroke={conn.color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,3"
                    strokeOpacity="1"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Layer 3: Prep arrows from Today box to prep extensions (z-index: 47, above green columns at z-42) */}
        {blinkSettings.showArrows && prepArrowConnections.length > 0 && (
          <svg 
            className="fixed inset-0 pointer-events-none" 
            style={{ width: '100vw', height: '100vh', zIndex: 47 }}
          >
            <defs>
              <marker
                id="arrowhead-prep-pink"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#ec4899" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-prep-green"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-prep-indigo"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-prep-black"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#000000" fillOpacity="0.75" />
              </marker>
            </defs>
            {prepArrowConnections.map((conn) => {
              // Exit 21px to the left from checkbox
              const exitX = conn.fromX - 21;
              
              // Get marker ID based on color
              let markerId = "arrowhead-prep-black"; // Default to black
              if (conn.color === "#22c55e") markerId = "arrowhead-prep-green";
              else if (conn.color === "#ec4899") markerId = "arrowhead-prep-pink";
              else if (conn.color === "#6366f1") markerId = "arrowhead-prep-indigo";
              
              // Path: curved from checkbox to prep text, ending vertically pointing DOWN
              const endY = conn.toY - 14; // Arrowhead ends 14px above the text center
              const midY = endY - 30; // Control point for final vertical descent
              
              // Use quadratic bezier curves for smooth path
              // Start at checkbox, go 21px straight left, then curve down and towards target
              const path = `M ${conn.fromX} ${conn.fromY} ` +
                `L ${exitX} ${conn.fromY} ` + // Go 21px straight left
                `Q ${exitX} ${midY}, ${conn.toX} ${midY} ` + // Curve down and towards target
                `L ${conn.toX} ${endY}`; // Straight down to target
              
              // Find the date cell header row bottom to determine where opaque ends
              const dateCellRow = document.querySelector('[data-calendar-grid="true"]');
              let dateCellBottom = conn.fromY + 150; // Default fallback
              if (dateCellRow) {
                const gridRect = dateCellRow.getBoundingClientRect();
                // Date cells are at the top of the calendar grid, estimate bottom at ~60px from grid top
                dateCellBottom = gridRect.top + 60;
              }
              
              // Calculate approximate path length to date cell bottom
              // Path: 21px left + curve down to midY + straight to endY
              // The opaque portion should end at dateCellBottom
              const straightLeftLength = 21;
              const verticalToCellBottom = Math.max(0, dateCellBottom - conn.fromY);
              const opaquePathLength = straightLeftLength + verticalToCellBottom;
              
              // Each dash cycle is 8px (5px dash + 3px gap), calculate number of dashes
              const numOpaqueDashes = Math.floor(opaquePathLength / 8);
              
              // Build dynamic dasharray for opaque portion
              let opaqueDasharray = "";
              for (let i = 0; i < numOpaqueDashes; i++) {
                opaqueDasharray += "5,3,";
              }
              opaqueDasharray += "5,0,0,99999"; // End with final dash then huge gap
              
              return (
                <g key={`prep-arrow-${conn.taskId}`}>
                  {/* Transparent base - full path */}
                  <path
                    d={path}
                    stroke={conn.color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,3"
                    strokeOpacity="0.25"
                    markerEnd={`url(#${markerId})`}
                  />
                  {/* Opaque overlay - ends at date cell bottom */}
                  <path
                    d={path}
                    stroke={conn.color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={opaqueDasharray}
                    strokeOpacity="1"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Celebration Popup */}
        {showCelebration && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
            onClick={() => setShowCelebration(false)}
          >
            <div className="celebration-container flex flex-col items-center pointer-events-auto">
              {/* Hooray text in arch shape */}
              <div className="relative mb-2">
                <svg viewBox="0 0 200 60" className="w-72 h-24">
                  <defs>
                    <path id="arch" d="M 10,55 Q 100,-5 190,55" fill="transparent" />
                    <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffd700">
                        <animate attributeName="stop-color" values="#ffd700;#ff6b6b;#ffd700" dur="1s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="50%" stopColor="#ff6b6b">
                        <animate attributeName="stop-color" values="#ff6b6b;#ffd700;#ff6b6b" dur="1s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="100%" stopColor="#ffd700">
                        <animate attributeName="stop-color" values="#ffd700;#ff6b6b;#ffd700" dur="1s" repeatCount="indefinite" />
                      </stop>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <text 
                    fill="url(#shimmerGradient)" 
                    filter="url(#glow)"
                    style={{ 
                      fontFamily: "Avenir, 'Avenir Next', sans-serif", 
                      fontWeight: 800, 
                      fontSize: '28px',
                      letterSpacing: '0.1em'
                    }}
                  >
                    <textPath href="#arch" startOffset="50%" textAnchor="middle">
                      HOORAY!
                    </textPath>
                  </text>
                </svg>
              </div>
              {/* Animoji with clapping hands */}
              <div className="relative">
                <img 
                  src={celebrationAnimoji} 
                  alt="Celebration" 
                  className="w-52 h-52 object-contain drop-shadow-2xl"
                />
                {/* Clapping hands */}
                <div className="absolute -left-8 bottom-12 text-4xl animate-clap-left">👏</div>
                <div className="absolute -right-8 bottom-12 text-4xl animate-clap-right">👏</div>
              </div>
            </div>
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
  onFileClick,
  cardBgClass,
  compact = false,
  overdueBlink = false,
  urgentBlink = false,
  blinkSyncDelay,
  colorSettings,
}: {
  task: Task;
  onComplete: (isCompleted: boolean) => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFileClick?: (attachment: string) => void;
  cardBgClass?: string;
  compact?: boolean;
  overdueBlink?: boolean;
  blinkSyncDelay?: string;
  urgentBlink?: boolean;
  colorSettings?: { headerBar: string; pomodoroButton: string; icons: string };
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
      className={`transition-all rounded-md shadow-sm border ${
        compact ? "h-[60px] flex flex-col" : "flex-1"
      } ${cardBgClass ? cardBgClass : colors ? colors.bg : ""} ${
        colors ? colors.border : "border-gray-400"
      } ${isMissed && !cardBgClass ? "border-destructive bg-destructive/5" : ""} ${
        task.isCompleted ? "opacity-60" : ""
      } ${overdueBlink ? "animate-urgent-blink" : ""} ${urgentBlink ? "animate-shimmer" : ""}`}
      style={overdueBlink && blinkSyncDelay ? { animationDelay: blinkSyncDelay } : undefined}
      data-testid={`card-task-${task.id}`}
    >
      <CardHeader className={`flex flex-row items-start justify-between gap-1 space-y-0 ${compact ? "pb-0 pt-1.5 px-2 flex-shrink-0" : "pb-1 pt-3 px-3"}`}>
        <div className="flex items-start gap-1.5">
          <Checkbox
            checked={task.isCompleted || false}
            onCheckedChange={(checked) => onComplete(!!checked)}
            data-testid={`checkbox-task-${task.id}`}
            className={`${compact ? "h-3.5 w-3.5" : ""} border-black data-[state=checked]:bg-black data-[state=checked]:border-black`}
          />
          <div>
            <CardTitle className={`font-normal ${task.isCompleted ? "line-through" : ""} ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>
              {task.title}
            </CardTitle>
            {task.courseName && (
              <p className={`font-normal ${colors?.text || "text-muted-foreground"} ${compact ? "text-[8px]" : "text-[10px]"}`}>
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
            {hasAttachments && (
              <Paperclip className="h-3 w-3 ml-1.5 text-muted-foreground" data-testid={`icon-attachment-${task.id}`} />
            )}
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
                        <button
                          onClick={() => onFileClick?.(attachment)}
                          className="text-[10px] text-primary hover:underline truncate max-w-[150px] cursor-pointer"
                          data-testid={`link-attachment-${task.id}-${idx}`}
                        >
                          {attachmentName}
                        </button>
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
          <div className="h-5 flex items-center justify-around rounded-md px-1 text-white border-[0.1px] border-white no-blink mb-1" style={{ background: colorSettings?.headerBar || '#607d9d' }}>
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
        <div className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-around rounded-md px-1 bg-[#5979CC] text-white border-[0.1px] border-white">
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

  const availableFiles = files
    .filter(f => !excludePaths.includes(f.objectPath))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' }));

  if (availableFiles.length === 0) {
    return (
      <Button type="button" variant="outline" disabled className="flex-1 !text-black bg-white h-8" style={{ fontSize: '12px' }} data-testid="button-select-file-empty">
        <FolderOpen className="h-3 w-3 mr-1" />
        No Files
      </Button>
    );
  }

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="flex-1 !text-black [&_*]:!text-black bg-white h-8" style={{ color: 'black', fontSize: '12px' }} data-testid="select-existing-file">
        <FolderOpen className="h-3 w-3 mr-1" />
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
  onSave,
  onCancel 
}: { 
  profileData: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null };
  timezones: { value: string; label: string }[];
  onSave: (data: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null }) => void;
  onCancel: () => void;
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
          className="!text-black"
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
          className="!text-black"
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
          className="!text-black"
          data-testid="input-profile-birthdate"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Home Time Zone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger className="!text-black [&_*]:!text-black bg-white" style={{ color: 'black' }} data-testid="select-profile-timezone">
            <SelectValue placeholder="Select time zone" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {timezones.map(tz => (
              <SelectItem key={tz.value} value={tz.value} className="text-black">{tz.label}</SelectItem>
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
              <SelectTrigger className="!text-black [&_*]:!text-black bg-white" style={{ color: 'black' }} data-testid="select-travel-timezone">
                <SelectValue placeholder="Select travel time zone" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {timezones.map(tz => (
                  <SelectItem key={tz.value} value={tz.value} className="text-black">{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} data-testid="button-cancel-profile">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40" data-testid="button-save-profile">
          Save Profile
        </Button>
      </div>
    </form>
  );
}

function SchoolForm({ 
  schoolData, 
  semesterSettings,
  onSave,
  onCancel 
}: { 
  schoolData: { schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string };
  semesterSettings: SemesterSettings | null | undefined;
  onSave: (data: { schoolLogo: string | null; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string }) => void;
  onCancel: () => void;
}) {
  const [schoolLogo, setSchoolLogo] = useState<string | null>(schoolData.schoolLogo);
  const [numberOfWeeks, setNumberOfWeeks] = useState(schoolData.numberOfWeeks);
  const [week1StartDate, setWeek1StartDate] = useState(schoolData.week1StartDate);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(schoolData.firstDayOfWeek);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useUpload();
  
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
      const result = await uploadFile(file);
      if (result?.objectPath) {
        setSchoolLogo(result.objectPath);
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
            <div className="h-12 w-20 bg-muted rounded border flex items-center justify-center text-xs !text-black">
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
              <SelectTrigger className="!text-black [&_*]:!text-black bg-white" style={{ color: 'black' }} data-testid="select-number-of-weeks">
                <SelectValue placeholder="Select weeks" />
              </SelectTrigger>
              <SelectContent className="bg-white [&_*]:!text-black">
                {[10, 11, 12, 13, 14, 15, 16].map(w => (
                  <SelectItem key={w} value={String(w)} className="!text-black">{w} weeks</SelectItem>
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
              className="!text-black"
              data-testid="input-week1-start-date"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="firstDayOfWeek" className="text-xs">First Day of School Week</Label>
            <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
              <SelectTrigger className="!text-black [&_*]:!text-black bg-white" style={{ color: 'black' }} data-testid="select-first-day-of-week">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent className="bg-white [&_*]:!text-black">
                {daysOfWeek.map(day => (
                  <SelectItem key={day.value} value={day.value} className="!text-black">{day.label}</SelectItem>
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
                semesterSettings.course1ProfessorEmail ? (
                  <a 
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(semesterSettings.course1ProfessorEmail)}&su=${encodeURIComponent(`${semesterSettings.course1Code} - `)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-auto cursor-pointer"
                    data-testid="link-email-professor-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(semesterSettings.course1ProfessorEmail!)}&su=${encodeURIComponent(`${semesterSettings.course1Code} - `)}`, '_blank');
                    }}
                  >
                    Prof. {semesterSettings.course1Professor}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto">Prof. {semesterSettings.course1Professor}</span>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-sm font-medium">{semesterSettings.course2Code}</span>
              <span className="text-sm text-muted-foreground">- {semesterSettings.course2Name}</span>
              {semesterSettings.course2Professor && (
                semesterSettings.course2ProfessorEmail ? (
                  <a 
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(semesterSettings.course2ProfessorEmail)}&su=${encodeURIComponent(`${semesterSettings.course2Code} - `)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-auto cursor-pointer"
                    data-testid="link-email-professor-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(semesterSettings.course2ProfessorEmail!)}&su=${encodeURIComponent(`${semesterSettings.course2Code} - `)}`, '_blank');
                    }}
                  >
                    Prof. {semesterSettings.course2Professor}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto">Prof. {semesterSettings.course2Professor}</span>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-sm font-medium">{semesterSettings.course3Code}</span>
              <span className="text-sm text-muted-foreground">- {semesterSettings.course3Name}</span>
              {semesterSettings.course3Professor && (
                semesterSettings.course3ProfessorEmail ? (
                  <a 
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(semesterSettings.course3ProfessorEmail)}&su=${encodeURIComponent(`${semesterSettings.course3Code} - `)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-auto cursor-pointer"
                    data-testid="link-email-professor-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(semesterSettings.course3ProfessorEmail!)}&su=${encodeURIComponent(`${semesterSettings.course3Code} - `)}`, '_blank');
                    }}
                  >
                    Prof. {semesterSettings.course3Professor}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto">Prof. {semesterSettings.course3Professor}</span>
                )
              )}
            </div>
          </div>
          
          {/* Professor Email Inputs */}
          <div className="mt-3 pt-3 border-t space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Professor Emails (click name to send email)</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                <Input
                  type="email"
                  placeholder="Course 1 professor email"
                  defaultValue={semesterSettings.course1ProfessorEmail || ""}
                  onChange={(e) => {
                    const email = e.target.value;
                    apiRequest("PATCH", "/api/semester-settings/professor-emails", { 
                      course1ProfessorEmail: email || null,
                      course2ProfessorEmail: semesterSettings.course2ProfessorEmail,
                      course3ProfessorEmail: semesterSettings.course3ProfessorEmail
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/semester"] }));
                  }}
                  className="h-7 text-xs"
                  data-testid="input-course1-email-edit"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500 shrink-0" />
                <Input
                  type="email"
                  placeholder="Course 2 professor email"
                  defaultValue={semesterSettings.course2ProfessorEmail || ""}
                  onChange={(e) => {
                    const email = e.target.value;
                    apiRequest("PATCH", "/api/semester-settings/professor-emails", { 
                      course1ProfessorEmail: semesterSettings.course1ProfessorEmail,
                      course2ProfessorEmail: email || null,
                      course3ProfessorEmail: semesterSettings.course3ProfessorEmail
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/semester"] }));
                  }}
                  className="h-7 text-xs"
                  data-testid="input-course2-email-edit"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                <Input
                  type="email"
                  placeholder="Course 3 professor email"
                  defaultValue={semesterSettings.course3ProfessorEmail || ""}
                  onChange={(e) => {
                    const email = e.target.value;
                    apiRequest("PATCH", "/api/semester-settings/professor-emails", { 
                      course1ProfessorEmail: semesterSettings.course1ProfessorEmail,
                      course2ProfessorEmail: semesterSettings.course2ProfessorEmail,
                      course3ProfessorEmail: email || null
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/semester"] }));
                  }}
                  className="h-7 text-xs"
                  data-testid="input-course3-email-edit"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Course details are set when starting a new semester.</p>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} data-testid="button-cancel-school">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40" data-testid="button-save-school">
          Save School Settings
        </Button>
      </div>
    </form>
  );
}

function CoursesForm({ 
  coursesData, 
  onSave,
  onCancel 
}: { 
  coursesData: { courses: Array<{ name: string; color: string; professor: string }> };
  onSave: (data: { courses: Array<{ name: string; color: string; professor: string }> }) => void;
  onCancel: () => void;
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
          <div key={index} className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-3">{index + 1}.</span>
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
              className="w-64 text-xs h-8 !text-black"
              data-testid={`input-course-name-${index}`}
            />
            <Input
              value={course.professor}
              onChange={(e) => updateCourse(index, 'professor', e.target.value)}
              placeholder={`Professor`}
              className="flex-1 text-xs h-8 !text-black"
              data-testid={`input-course-professor-${index}`}
            />
          </div>
        ))}
      </div>
      
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 text-xs h-8" onClick={onCancel} data-testid="button-cancel-courses">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40 text-xs h-8" data-testid="button-save-courses">
          Save Courses
        </Button>
      </div>
    </form>
  );
}

function TaskForm({ 
  task, 
  weekNumber,
  initialDate,
  initialType,
  initialStartTime,
  initialEndTime,
  onSuccess 
}: { 
  task?: Task; 
  weekNumber: number;
  initialDate?: Date | null;
  initialType?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  onSuccess: () => void;
}) {
  const getDefaultDate = () => {
    if (task?.dueDate) return format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm");
    if (initialDate) {
      // Always set default time to 6 PM for new tasks
      const date = new Date(initialDate);
      date.setHours(18, 0, 0, 0);
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
    eventStartTime: task?.eventStartTime || initialStartTime || "",
    eventEndTime: task?.eventEndTime || initialEndTime || "",
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
  
  // Query files to look up display names for attachments
  const { data: allFiles = [] } = useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });
  
  // Helper to get display name for an attachment
  const getAttachmentDisplayName = (attachment: string) => {
    const file = allFiles.find(f => f.objectPath === attachment);
    return file?.displayName || attachment.split('/').pop() || 'File';
  };
  
  // Date picker popover state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(() => {
    if (formData.dueDate) {
      return new Date(formData.dueDate);
    }
    return undefined;
  });
  const [tempHour, setTempHour] = useState(() => {
    if (formData.dueDate) {
      return new Date(formData.dueDate).getHours().toString().padStart(2, '0');
    }
    return "18";
  });
  const [tempMinute, setTempMinute] = useState(() => {
    if (formData.dueDate) {
      return new Date(formData.dueDate).getMinutes().toString().padStart(2, '0');
    }
    return "00";
  });

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
      // For MODULE tasks, automatically set startDate to Sunday and dueDate to Friday of current week
      let finalDueDate = new Date(data.dueDate);
      let finalStartDate: Date | null = null;
      
      if (data.type === "module" && !task) {
        // Get current date
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Calculate Sunday of the current week
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);
        
        // Calculate Friday of the current week
        const friday = new Date(sunday);
        friday.setDate(sunday.getDate() + 5);
        friday.setHours(18, 0, 0, 0); // 6 PM on Friday
        
        finalStartDate = sunday;
        finalDueDate = friday;
      } else if (data.prepDays > 0) {
        // Calculate startDate from prepDays if set
        const dueDate = new Date(data.dueDate);
        finalStartDate = new Date(dueDate);
        finalStartDate.setDate(finalStartDate.getDate() - data.prepDays);
      }
      
      // Build payload explicitly
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        type: data.type,
        courseName: data.courseName,
        dueDate: finalDueDate.toISOString(),
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
        startDate: finalStartDate ? finalStartDate.toISOString() : null,
      };
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
      {/* Two column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-[11px] text-white">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Assignment title"
              required
              data-testid="input-title"
              className="bg-white h-8"
              style={{ color: 'black', fontSize: '11px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="courseName" className="text-[11px] text-white">Course</Label>
              <select
                value={formData.courseName}
                onChange={(e) => setFormData(prev => ({ ...prev, courseName: e.target.value }))}
                data-testid="select-course"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                <option value="">Select course</option>
                {COURSES.map(course => (
                  <option key={course.code} value={`${course.code} - ${course.name}`}>
                    {course.code} - {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="type" className="text-[11px] text-white">Type</Label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                data-testid="select-type"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                {TASK_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate" className="text-[11px] text-white">Due Date</Label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-8 bg-white"
                  style={{ color: 'black', fontSize: '11px' }}
                  data-testid="input-duedate"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {formData.dueDate ? format(new Date(formData.dueDate), "MMM d, yyyy 'at' h:mm a") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3">
                  <CalendarPicker
                    mode="single"
                    selected={tempDate}
                    onSelect={(date) => {
                      if (date) {
                        setTempDate(date);
                      }
                    }}
                    initialFocus
                  />
                  <div className="border-t pt-3 mt-3">
                    <Label className="text-sm font-medium">Time</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={tempHour}
                        onChange={(e) => setTempHour(e.target.value)}
                        className="w-16 h-8 rounded-md border border-input bg-white px-2"
                        style={{ color: 'black', fontSize: '11px' }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i.toString().padStart(2, '0')}>
                            {i.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                      <span>:</span>
                      <select
                        value={tempMinute}
                        onChange={(e) => setTempMinute(e.target.value)}
                        className="w-16 h-8 rounded-md border border-input bg-white px-2"
                        style={{ color: 'black', fontSize: '11px' }}
                      >
                        {['00', '15', '30', '45'].map((min) => (
                          <option key={min} value={min}>{min}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsDatePickerOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => {
                        if (tempDate) {
                          const newDate = new Date(tempDate);
                          newDate.setHours(parseInt(tempHour), parseInt(tempMinute), 0, 0);
                          setFormData(prev => ({ ...prev, dueDate: format(newDate, "yyyy-MM-dd'T'HH:mm") }));
                        }
                        setIsDatePickerOpen(false);
                      }}
                      data-testid="button-apply-date"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="eventStartTime" className="text-[11px] text-white">Start</Label>
              <div className="flex gap-1">
                <Input
                  id="eventStartTime"
                  type="text"
                  placeholder="HH:MM"
                  value={formData.eventStartTime ? (() => {
                    const [h, m] = formData.eventStartTime.split(':');
                    const hour = parseInt(h);
                    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return `${hour12}:${m}`;
                  })() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9:]*$/.test(val) && val.length <= 5) {
                      const isPM = formData.eventStartTime ? parseInt(formData.eventStartTime.split(':')[0]) >= 12 : false;
                      const [h, m] = val.split(':');
                      if (h && m) {
                        let hour24 = parseInt(h);
                        if (isPM && hour24 < 12) hour24 += 12;
                        if (!isPM && hour24 === 12) hour24 = 0;
                        setFormData(prev => ({ ...prev, eventStartTime: `${hour24.toString().padStart(2, '0')}:${m}` }));
                      } else {
                        setFormData(prev => ({ ...prev, eventStartTime: val }));
                      }
                    }
                  }}
                  data-testid="input-start-time"
                  className="bg-white h-8 flex-1"
                  style={{ color: 'black', fontSize: '11px' }}
                />
                <select
                  value={formData.eventStartTime ? (parseInt(formData.eventStartTime.split(':')[0]) >= 12 ? 'PM' : 'AM') : 'AM'}
                  onChange={(e) => {
                    if (!formData.eventStartTime) return;
                    const [h, m] = formData.eventStartTime.split(':');
                    let hour = parseInt(h);
                    if (e.target.value === 'PM' && hour < 12) hour += 12;
                    if (e.target.value === 'AM' && hour >= 12) hour -= 12;
                    setFormData(prev => ({ ...prev, eventStartTime: `${hour.toString().padStart(2, '0')}:${m}` }));
                  }}
                  className="h-8 rounded-md border border-input bg-white px-1"
                  style={{ color: 'black', fontSize: '11px' }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="eventEndTime" className="text-[11px] text-white">End</Label>
              <div className="flex gap-1">
                <Input
                  id="eventEndTime"
                  type="text"
                  placeholder="HH:MM"
                  value={formData.eventEndTime ? (() => {
                    const [h, m] = formData.eventEndTime.split(':');
                    const hour = parseInt(h);
                    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return `${hour12}:${m}`;
                  })() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9:]*$/.test(val) && val.length <= 5) {
                      const isPM = formData.eventEndTime ? parseInt(formData.eventEndTime.split(':')[0]) >= 12 : false;
                      const [h, m] = val.split(':');
                      if (h && m) {
                        let hour24 = parseInt(h);
                        if (isPM && hour24 < 12) hour24 += 12;
                        if (!isPM && hour24 === 12) hour24 = 0;
                        setFormData(prev => ({ ...prev, eventEndTime: `${hour24.toString().padStart(2, '0')}:${m}` }));
                      } else {
                        setFormData(prev => ({ ...prev, eventEndTime: val }));
                      }
                    }
                  }}
                  data-testid="input-end-time"
                  className="bg-white h-8 flex-1"
                  style={{ color: 'black', fontSize: '11px' }}
                />
                <select
                  value={formData.eventEndTime ? (parseInt(formData.eventEndTime.split(':')[0]) >= 12 ? 'PM' : 'AM') : 'AM'}
                  onChange={(e) => {
                    if (!formData.eventEndTime) return;
                    const [h, m] = formData.eventEndTime.split(':');
                    let hour = parseInt(h);
                    if (e.target.value === 'PM' && hour < 12) hour += 12;
                    if (e.target.value === 'AM' && hour >= 12) hour -= 12;
                    setFormData(prev => ({ ...prev, eventEndTime: `${hour.toString().padStart(2, '0')}:${m}` }));
                  }}
                  className="h-8 rounded-md border border-input bg-white px-1"
                  style={{ color: 'black', fontSize: '11px' }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="prepDays" className="text-[11px] text-white">Prep Days</Label>
              <Input
                id="prepDays"
                type="number"
                min={0}
                max={30}
                value={formData.prepDays}
                onChange={(e) => setFormData(prev => ({ ...prev, prepDays: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                data-testid="input-prepdays"
                className="bg-white h-8"
                style={{ color: 'black', fontSize: '11px' }}
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-white">Reminders</Label>
            <div className="grid grid-cols-4 gap-2">
              <select
                value={String(formData.reminder1)}
                onChange={(e) => setFormData(prev => ({ ...prev, reminder1: parseInt(e.target.value) }))}
                data-testid="select-reminder1"
                className="flex h-8 w-full rounded-md border border-input bg-white px-1 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
              <select
                value={String(formData.reminder2)}
                onChange={(e) => setFormData(prev => ({ ...prev, reminder2: parseInt(e.target.value) }))}
                data-testid="select-reminder2"
                className="flex h-8 w-full rounded-md border border-input bg-white px-1 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
              <select
                value={String(formData.reminder3)}
                onChange={(e) => setFormData(prev => ({ ...prev, reminder3: parseInt(e.target.value) }))}
                data-testid="select-reminder3"
                className="flex h-8 w-full rounded-md border border-input bg-white px-1 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
              <select
                value={String(formData.reminder4)}
                onChange={(e) => setFormData(prev => ({ ...prev, reminder4: parseInt(e.target.value) }))}
                data-testid="select-reminder4"
                className="flex h-8 w-full rounded-md border border-input bg-white px-1 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority" className="text-[11px] text-white">Priority</Label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                data-testid="select-priority"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-white">Repeat</Label>
              <select
                value={formData.repeatType}
                onChange={(e) => setFormData(prev => ({ ...prev, repeatType: e.target.value as typeof REPEAT_TYPES[number] }))}
                data-testid="select-repeat-type"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
          </div>

          {formData.repeatType === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-white">Every</Label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={formData.repeatInterval}
                  onChange={(e) => setFormData(prev => ({ ...prev, repeatInterval: parseInt(e.target.value) || 1 }))}
                  data-testid="input-repeat-interval"
                  className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ color: 'black', fontSize: '11px' }}
                />
              </div>
              <div>
                <Label className="text-[11px] text-white">Unit</Label>
                <select
                  value={formData.repeatIntervalUnit}
                  onChange={(e) => setFormData(prev => ({ ...prev, repeatIntervalUnit: e.target.value as typeof REPEAT_INTERVAL_UNITS[number] }))}
                  data-testid="select-repeat-unit"
                  className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ color: 'black', fontSize: '11px' }}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </div>
            </div>
          )}

          {formData.repeatType !== "none" && (
            <div>
              <Label className="text-[11px] text-white">End Repeat (optional)</Label>
              <input
                type="date"
                value={formData.repeatEndDate}
                onChange={(e) => setFormData(prev => ({ ...prev, repeatEndDate: e.target.value }))}
                data-testid="input-repeat-end-date"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              />
            </div>
          )}

          <div>
            <Label htmlFor="description" className="text-[11px] text-white">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add notes or details..."
              rows={3}
              data-testid="input-description"
              className="flex w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              style={{ color: 'black', fontSize: '11px' }}
            />
          </div>

          <div>
            <Label htmlFor="referenceLink" className="text-[11px] text-white">Reference Link</Label>
            <input
              id="referenceLink"
              type="url"
              value={formData.referenceLink}
              onChange={(e) => setFormData(prev => ({ ...prev, referenceLink: e.target.value }))}
              placeholder="https://example.com"
              data-testid="input-reference-link"
              className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{ color: 'black', fontSize: '11px' }}
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-white">Attachments (optional)</Label>
        <div className="space-y-2">
          {formData.attachments.map((attachment, idx) => (
            <div key={idx} className="flex items-center gap-2" style={{ fontSize: '11px' }}>
              <Paperclip className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <a href={attachment.startsWith('/objects/') ? attachment : attachment} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">
                {getAttachmentDisplayName(attachment)}
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40 h-8"
              style={{ fontSize: '11px' }}
              data-testid="button-upload-file"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3 mr-1" />
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
          
          <div className="flex gap-2 mt-4">
            <input
              value={newAttachment}
              onChange={(e) => setNewAttachment(e.target.value)}
              placeholder="Or paste URL..."
              data-testid="input-new-attachment"
              className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{ color: 'black', fontSize: '11px' }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-8"
              style={{ fontSize: '11px' }}
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
        <Button type="submit" disabled={createMutation.isPending} className="bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40 h-8" style={{ fontSize: '11px' }} data-testid="button-submit-task">
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
