import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import tmuLogo from "@assets/Chang-School_1768803262583.png";
import unicalLogo from "@assets/ChatGPT_Image_Jan_22,_2026,_02_34_52_PM_1769110943463.png";
import changSchoolLogo from "@assets/Chang-School2_1770607146365.png";
import campusBg from "@assets/TMU_1769151150961.jpg";
import dashboardBg from "@assets/BG2_1769977873184.jpg";
import celebrationAnimoji from "@assets/Animoji_1769350617739.webp";
import victoryFanfare from "@assets/victory-fanfare.mp3";
import crowdCheer from "@assets/crowd-cheer.mp3";
import hexIcon from "@assets/Button_1769701329320.png";
import buttonBg from "@assets/Button_1769694441816.png";
import orangeButtonBg from "@assets/Orange_Button_1769695828702.png";
import clockBg from "@assets/Clock_BG_1769697834310.png";
import hamburgerBg from "@assets/Hamburger_Button_1769709360404.png";
import taskButtonBg from "@assets/Task_1769694788992.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
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
  FolderPlus,
  Trash2,
  Sun,
  Home,
  Cloud,
  ArrowLeft,
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
  ListChecks,
  ZoomIn,
  ZoomOut,
  MoveUpRight,
  TrendingUp,
  TrendingDown,
  Pencil,
  StickyNote,
  Grip,
  GripVertical,
  GripHorizontal,
  CheckCircle2,
  Check,
  ListTodo,
  Link2,
  Mail,
  Smartphone,
  Share2,
  Copy,
  Eye,
  Lock,
  AlertCircle,
  Plane,
  List,
} from "lucide-react";
import { Link as RouterLink, useLocation } from "wouter";
import { useAccessMode } from "@/components/access-gate";
import type { Task, SemesterSettings, Subtask, Project, StickyNote as StickyNoteType } from "@shared/schema";
import { TASK_TYPES, COURSES, getWeekNumber, REMINDER_OPTIONS, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2, REPEAT_TYPES, REPEAT_INTERVAL_UNITS, LAST_WEEK } from "@shared/schema";
import { format, addDays, subDays, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays, differenceInCalendarDays, isBefore } from "date-fns";

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
  "CPPA122": { bg: "bg-green-50 dark:bg-green-900/30", border: "border-green-400", text: "text-green-600 dark:text-green-300", dot: "bg-green-400", prepBg: "bg-green-50 dark:bg-green-900/30", prepBorder: "border-green-200", prepText: "text-green-500 dark:text-green-400" },
  "CFNF400": { bg: "bg-pink-50 dark:bg-pink-900/30", border: "border-pink-400", text: "text-pink-600 dark:text-pink-300", dot: "bg-pink-400", prepBg: "bg-pink-50 dark:bg-pink-900/30", prepBorder: "border-pink-200", prepText: "text-pink-500 dark:text-pink-400" },
  "CASL101": { bg: "bg-indigo-50 dark:bg-indigo-900/30", border: "border-indigo-400", text: "text-indigo-600 dark:text-indigo-300", dot: "bg-indigo-400", prepBg: "bg-indigo-50 dark:bg-indigo-900/30", prepBorder: "border-indigo-200", prepText: "text-indigo-500 dark:text-indigo-400" },
};

// Display name mapping for course row labels (defaults, overridden by localStorage)
const defaultCourseDisplayNames: Record<string, string> = {
  "CPPA122": "CPPA122-LP",
  "CFNF400": "CFNF400-HS",
  "CASL101": "CASL101 American Sign Language",
};

// Helper function to get display name for course row labels (uses dynamic state)
let _courseDisplayNames: Record<string, string> = { ...defaultCourseDisplayNames };
const getCourseRowDisplayName = (courseName: string): string => {
  const courseCode = courseName.split(' - ')[0];
  if (_courseDisplayNames[courseCode]) {
    return _courseDisplayNames[courseCode];
  }
  return courseName;
};

// Course folder configuration for sidebar hamburger menus
const SIDEBAR_COURSES = [
  { id: "cppa122", name: "CPPA122", color: "text-green-400", hoverBg: "hover:bg-green-400/20" },
  { id: "cfnf400", name: "CFNF400", color: "text-pink-400", hoverBg: "hover:bg-pink-400/20" },
  { id: "casl101", name: "CASL101", color: "text-indigo-400", hoverBg: "hover:bg-indigo-400/20" },
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

function getPointerXY(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { clientX: number; clientY: number } {
  if ('touches' in e) {
    const t = e.touches[0] || (e as TouchEvent).changedTouches?.[0];
    return t ? { clientX: t.clientX, clientY: t.clientY } : { clientX: 0, clientY: 0 };
  }
  return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY };
}

export default function Dashboard() {
  const { toast } = useToast();
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [selectedWeek, setSelectedWeek] = useState<number>(2);
  const [openCourseDropdown, setOpenCourseDropdown] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTaskType, setNewTaskType] = useState<string>("module");
  const [initialStartTime, setInitialStartTime] = useState<string>("");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [showQuickAddCloseConfirm, setShowQuickAddCloseConfirm] = useState(false);
  const [quickAddStep, setQuickAddStep] = useState(0);
  const [quickAddData, setQuickAddData] = useState({
    type: "",
    title: "",
    courseName: "",
    dueDate: "",
    dueDateHour: "18",
    dueDateMinute: "00",
    prepDays: 0,
    priority: "medium",
    description: "",
    eventStartTime: "",
    eventEndTime: "",
    reminder1: DEFAULT_REMINDER_1,
    reminder2: DEFAULT_REMINDER_2,
    reminder3: null as number | null,
    reminder4: null as number | null,
    attachments: [] as string[],
    pasteUrl: "",
    notes: "",
    referenceLink: "",
    subtasks: [] as { title: string; completed: boolean }[],
    subtaskInput: "",
    projectId: null as number | null,
    repeatType: "none" as string,
    repeatInterval: null as number | null,
    repeatIntervalUnit: null as string | null,
    repeatEndDate: "",
  });
  const quickAddHasData = quickAddData.type !== "" || quickAddData.title.trim() !== "" || quickAddData.courseName !== "" || quickAddData.dueDate !== "" || quickAddData.notes.trim() !== "" || quickAddData.attachments.length > 0 || quickAddData.subtasks.length > 0;
  const handleQuickAddClose = () => {
    if (quickAddHasData) {
      setShowQuickAddCloseConfirm(true);
    } else {
      setIsQuickAddOpen(false);
    }
  };
  const [initialEndTime, setInitialEndTime] = useState<string>("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [isTodayExpanded, setIsTodayExpanded] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState(() => {
    const defaultHeight = 502;
    const maxHeight = window.innerHeight - 200;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    const deviceId = `device_${screenWidth}x${screenHeight}@${pixelRatio}`;
    const resetKey = 'calendarHeight_reset_v7';
    if (!localStorage.getItem(resetKey)) {
      localStorage.removeItem('calendarHeight');
      localStorage.removeItem(`calendarHeight_${deviceId}`);
      localStorage.setItem(resetKey, '1');
    }
    const deviceSaved = localStorage.getItem(`calendarHeight_${deviceId}`);
    if (deviceSaved) {
      const val = parseInt(deviceSaved, 10);
      if (!isNaN(val) && val > 0) return Math.min(val, maxHeight);
    }
    const saved = localStorage.getItem('calendarHeight');
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val > 0) return Math.min(val, maxHeight);
    }
    return defaultHeight;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [doTodayBounce, setDoTodayBounce] = useState(false);
  const todayTaskCountRef = useRef(0);
  const calendarWrapperRef = useRef<HTMLDivElement>(null);
  const clockContainerRef = useRef<HTMLDivElement>(null);
  const [clockWidth, setClockWidth] = useState(0);
  const courseRowsRef = useRef<HTMLDivElement>(null);
  const allDayRowRef = useRef<HTMLDivElement>(null);
  const [calendarTop, setCalendarTop] = useState(247); // Default offset
  const [calendarRight, setCalendarRight] = useState(0); // Right edge of calendar wrapper relative to viewport
  const [calendarLeft, setCalendarLeft] = useState(27); // Left edge of calendar wrapper
  const [courseRowsTop, setCourseRowsTop] = useState(0); // Position of course rows container
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
  
  // Share link state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const { isReadOnly, isAdmin } = useAccessMode();
  const [isCompletedTasksOpen, setIsCompletedTasksOpen] = useState(false);
  const [isRadioDialogOpen, setIsRadioDialogOpen] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState("media_player.echo_lr_studio_white_am");
  const [radioVolume, setRadioVolume] = useState(50);
  const [isFilesFlyoutOpen, setIsFilesFlyoutOpen] = useState(true);
  const [isFiles2FlyoutOpen, setIsFiles2FlyoutOpen] = useState(true);
  const [lastOpenedFlyout, setLastOpenedFlyout] = useState<'files1' | 'files2'>('files1'); // Track which flyout was opened last
  const [readingsPopupCourse, setReadingsPopupCourse] = useState<string | null>(null);
  const [oneDriveReadingFiles, setOneDriveReadingFiles] = useState<any[]>([]);
  const [listenedOneDriveFiles, setListenedOneDriveFiles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('listenedOneDriveFiles');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  useEffect(() => {
    if (!readingsPopupCourse) { setOneDriveReadingFiles([]); return; }
    const courseCode = readingsPopupCourse.toUpperCase();
    const basePath = `/School/1. TMU/Courses/2026/Winter`;
    (async () => {
      try {
        const baseRes = await fetch(`/api/onedrive/files?path=${encodeURIComponent(basePath)}`);
        const baseFolders = await baseRes.json();
        if (!Array.isArray(baseFolders)) return;
        const matched = baseFolders.find((f: any) => f.type === 'folder' && f.name.toUpperCase().startsWith(courseCode));
        if (!matched) return;
        const courseRes = await fetch(`/api/onedrive/files?path=${encodeURIComponent(matched.path)}`);
        const courseFolders = await courseRes.json();
        if (!Array.isArray(courseFolders)) return;
        const weekFolder = courseFolders.find((f: any) => f.type === 'folder' && f.name.toLowerCase().startsWith(`week ${selectedWeek}`));
        if (!weekFolder) return;
        const weekRes = await fetch(`/api/onedrive/files?path=${encodeURIComponent(weekFolder.path)}`);
        const weekContents = await weekRes.json();
        if (!Array.isArray(weekContents)) return;
        const readingFolder = weekContents.find((f: any) => f.type === 'folder' && f.name.toLowerCase().includes('reading'));
        if (!readingFolder) return;
        const readingRes = await fetch(`/api/onedrive/files?path=${encodeURIComponent(readingFolder.path)}`);
        const readingFiles = await readingRes.json();
        if (Array.isArray(readingFiles)) {
          setOneDriveReadingFiles(readingFiles.filter((f: any) => f.type === 'file'));
        }
      } catch (err) {
        console.error('Error loading reading files:', err);
      }
    })();
  }, [readingsPopupCourse, selectedWeek]);
  const [isWeekReadingsOpen, setIsWeekReadingsOpen] = useState(false);
  const [weekReadingSelectedFile, setWeekReadingSelectedFile] = useState<any | null>(null);
  const [isWeeksFlyoutOpen, setIsWeeksFlyoutOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string>('week-3-cppa122-reading');
  const [renameFileId, setRenameFileId] = useState<number | null>(null);
  const [renameFileName, setRenameFileName] = useState<string>('');
  
  // Partner away popup state - show when partner is at work
  const [showPartnerAwayPopup, setShowPartnerAwayPopup] = useState(false);
  const [isPartnerAway, setIsPartnerAway] = useState(false);
  const [partnerAwayDismissedUntil, setPartnerAwayDismissedUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('partnerAwayDismissedUntil');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Initialize from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('partnerAwayDismissedUntil');
    if (saved) {
      setPartnerAwayDismissedUntil(parseInt(saved, 10));
    }
    setIsInitialized(true);
  }, []);
  const [isKitchenReadingLoading, setIsKitchenReadingLoading] = useState(false);
  const [isKitchenPlaying, setIsKitchenPlaying] = useState(false);
  const [isPillMenuOpen, setIsPillMenuOpen] = useState(false);
  const [sidePillIdle, setSidePillIdle] = useState(false);
  const pillMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidePillRef = useRef<HTMLDivElement>(null);
  const [sidePillMounted, setSidePillMounted] = useState(false);
  const sidePillSlideOffset = useRef(60);
  const openSidePill = useCallback(() => {
    const el = sidePillRef.current;
    if (el && sidePillIdle) {
      const computed = getComputedStyle(el);
      const matrix = new DOMMatrixReadOnly(computed.transform);
      const currentX = matrix.m41;
      el.style.transition = 'none';
      el.style.transform = `translateX(${currentX}px)`;
      setSidePillIdle(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.3s ease-in-out';
          el.style.transform = 'translateX(0px)';
          setIsPillMenuOpen(true);
        });
      });
    } else {
      setSidePillIdle(false);
      setIsPillMenuOpen(true);
    }
  }, [sidePillIdle]);
  const closeSidePill = useCallback(() => {
    setIsPillMenuOpen(false);
  }, []);
  useEffect(() => {
    if (!isPillMenuOpen && sidePillMounted) {
      const el = sidePillRef.current;
      if (el) {
        const onEnd = () => {
          setSidePillIdle(true);
          el.removeEventListener('transitionend', onEnd);
        };
        el.addEventListener('transitionend', onEnd);
        return () => el.removeEventListener('transitionend', onEnd);
      }
    }
  }, [isPillMenuOpen, sidePillMounted]);
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSidePillMounted(true);
        setIsPillMenuOpen(true);
      });
    });
    const sideTimeout = setTimeout(() => {
      closeSidePill();
    }, 2200);
    return () => clearTimeout(sideTimeout);
  }, []);
  const [isTopPillOpen, setIsTopPillOpen] = useState(false);
  const [topPillMounted, setTopPillMounted] = useState(false);
  const topPillRef = useRef<HTMLDivElement>(null);
  const topPillTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTopPill = useCallback(() => {
    const el = topPillRef.current;
    if (el && !isTopPillOpen) {
      const current = getComputedStyle(el).transform;
      el.style.animation = 'none';
      el.style.transform = current;
      void el.offsetHeight;
      el.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.transform = 'translateX(-50%) translateY(0px)';
    }
    setIsTopPillOpen(true);
  }, [isTopPillOpen]);
  const closeTopPill = useCallback(() => {
    const el = topPillRef.current;
    if (el) {
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.transform = 'translateX(-50%) translateY(-56px)';
      setTimeout(() => {
        if (el) {
          el.style.animation = '';
          el.style.transform = '';
          el.style.transition = '';
        }
        setIsTopPillOpen(false);
      }, 450);
    } else {
      setIsTopPillOpen(false);
    }
  }, []);
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTopPillMounted(true);
        setIsTopPillOpen(true);
      });
    });
    topPillTimeoutRef.current = setTimeout(() => {
      closeTopPill();
    }, 2200);
    return () => { if (topPillTimeoutRef.current) clearTimeout(topPillTimeoutRef.current); };
  }, []);
  const [draggedFileForMove, setDraggedFileForMove] = useState<{id: number; folder: string} | null>(null);
  const [moveFileId, setMoveFileId] = useState<number | null>(null);
  const [moveFileCurrentFolder, setMoveFileCurrentFolder] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  // Honeycomb navigation state
  const [modulesHoneycombOpen, setModulesHoneycombOpen] = useState<string | null>('modules');
  const [decorativeHoneycombHover, setDecorativeHoneycombHover] = useState<'left' | 'middle' | 'right' | null>(null);
  const [readingsHoneycombOpen, setReadingsHoneycombOpen] = useState(false);
  const [moduleMediaControlCourse, setModuleMediaControlCourse] = useState<string | null>(null);
  const [flyoutWidth, setFlyoutWidth] = useState(183); // Default flyout width for files (half width)
  const [flyout2Width, setFlyout2Width] = useState(183); // Default flyout width for files2 (half width)
  const [weeksFlyoutWidth, setWeeksFlyoutWidth] = useState(295); // Default flyout width for week folders
  const [isResizingFlyout, setIsResizingFlyout] = useState(false);
  const [isResizingFlyout2, setIsResizingFlyout2] = useState(false);
  const [isResizingWeeksFlyout, setIsResizingWeeksFlyout] = useState(false);
  const [isTodoFlyoutOpen, setIsTodoFlyoutOpen] = useState(false);
  const [isProjectsFlyoutOpen, setIsProjectsFlyoutOpen] = useState(false);
  const [flyoutZOrder, setFlyoutZOrder] = useState<string[]>(['files', 'projects', 'todo', 'addTask']);
  
  const bringFlyoutToFront = (flyoutId: string) => {
    setFlyoutZOrder(prev => {
      const filtered = prev.filter(id => id !== flyoutId);
      return [...filtered, flyoutId];
    });
  };
  
  const getFlyoutZIndex = (flyoutId: string) => {
    const index = flyoutZOrder.indexOf(flyoutId);
    return 200 + (index >= 0 ? index : 0);
  };
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [flyoutExpandedFolders, setFlyoutExpandedFolders] = useState<Set<string>>(new Set());
  
  // Folder context menu state
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    parentFolder: string;
  } | null>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState('');
  const [customFolders, setCustomFolders] = useState<{ id: string; name: string; parent: string }[]>(() => {
    const saved = localStorage.getItem('customFolders');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Save custom folders to localStorage
  useEffect(() => {
    localStorage.setItem('customFolders', JSON.stringify(customFolders));
  }, [customFolders]);
  
  // Load custom folders from database on mount
  useEffect(() => {
    const loadFoldersFromDB = async () => {
      try {
        const response = await fetch('/api/custom-folders');
        if (response.ok) {
          const dbFolders = await response.json();
          if (dbFolders.length > 0) {
            // Merge database folders with local folders (database takes precedence)
            const dbFolderMap = new Map(dbFolders.map((f: any) => [f.name + '-' + f.parentFolderId, f]));
            setCustomFolders(prev => {
              const merged = [...prev];
              dbFolders.forEach((dbFolder: any) => {
                const folderId = `${dbFolder.parentFolderId}-subfolder-${dbFolder.name.toLowerCase()}-${dbFolder.id}`;
                const exists = merged.some(f => 
                  f.parent === dbFolder.parentFolderId && f.name === dbFolder.name
                );
                if (!exists) {
                  merged.push({
                    id: folderId,
                    name: dbFolder.name,
                    parent: dbFolder.parentFolderId
                  });
                }
              });
              return merged;
            });
          }
        }
      } catch (err) {
        console.error('Failed to load folders from database:', err);
      }
    };
    loadFoldersFromDB();
  }, []);
  
  // Check partner status every 60 seconds to show kitchen reading popup
  // Use ref to track if popup is already showing (prevents re-triggering during same session)
  const partnerPopupShownRef = useRef(false);
  
  useEffect(() => {
    const checkPartnerStatus = async () => {
      try {
        const response = await fetch('/api/partner-status');
        if (response.ok) {
          const data = await response.json();
          setIsPartnerAway(data.isAway);
          
          // Show popup if partner is away and we haven't dismissed it recently
          // Also check ref to prevent showing if already shown this session
          if (false && data.isAway && !partnerPopupShownRef.current) {
            const now = Date.now();
            const savedDismiss = localStorage.getItem('partnerAwayDismissedUntil');
            const dismissedUntil = savedDismiss ? parseInt(savedDismiss, 10) : 0;
            if (!dismissedUntil || now > dismissedUntil) {
              setShowPartnerAwayPopup(true);
              partnerPopupShownRef.current = true; // Mark as shown
            }
          } else if (!data.isAway) {
            // Reset ref when partner comes home so popup can show again when they leave
            partnerPopupShownRef.current = false;
          }
        }
      } catch (err) {
        // Silently fail - Home Assistant might not be configured
      }
    };
    
    // Only start checking after initialization completes
    if (!isInitialized) return;
    
    // Check immediately, then every 60 seconds
    checkPartnerStatus();
    const interval = setInterval(checkPartnerStatus, 60000);
    return () => clearInterval(interval);
  }, [isInitialized]);
  
  // Poll kitchen playback status
  useEffect(() => {
    const checkKitchenStatus = async () => {
      try {
        const response = await fetch('/api/kitchen/status');
        if (response.ok) {
          const data = await response.json();
          setIsKitchenPlaying(data.isPlaying);
        }
      } catch (err) {
        // Ignore errors
      }
    };
    
    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);
  
  // Handle kitchen reading trigger
  const handleKitchenReadingTrigger = async () => {
    setIsKitchenReadingLoading(true);
    try {
      const response = await fetch('/api/kitchen/trigger', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setIsKitchenPlaying(true); // Start showing as playing immediately
        toast({
          title: data.action === 'radio' ? 'Playing Radio' : 'Playing Reading',
          description: data.action === 'radio' 
            ? data.message 
            : `Now playing: ${data.file?.name || 'Unknown file'}`
        });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to trigger reading', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to trigger kitchen reading', variant: 'destructive' });
    } finally {
      setIsKitchenReadingLoading(false);
      // Dismiss for 4 hours when playing readings too (same as clicking "No, not now")
      handleDismissPartnerPopup();
    }
  };
  
  // Handle stopping kitchen playback
  const handleKitchenStop = async () => {
    try {
      const response = await fetch('/api/kitchen/stop', { method: 'POST' });
      if (response.ok) {
        setIsKitchenPlaying(false);
        toast({ title: 'Playback Stopped', description: 'Kitchen reading stopped' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to stop playback', variant: 'destructive' });
    }
  };
  
  // Dismiss partner popup for 4 hours
  const handleDismissPartnerPopup = () => {
    const dismissUntil = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
    setPartnerAwayDismissedUntil(dismissUntil);
    localStorage.setItem('partnerAwayDismissedUntil', dismissUntil.toString());
    setShowPartnerAwayPopup(false);
  };
  
  // Handle folder right-click context menu
  const handleFolderContextMenu = (e: React.MouseEvent, parentFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({
      x: e.clientX,
      y: e.clientY,
      parentFolder
    });
  };
  
  // Create new folder - saves to database first, then updates local state
  const handleCreateFolder = async () => {
    if (newFolderName.trim() && newFolderParent) {
      try {
        // Save to database first
        const response = await fetch('/api/custom-folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newFolderName.trim(), parentFolderId: newFolderParent })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to save folder to database:', response.status, errorText);
          toast({ title: "Error", description: "Failed to save folder", variant: "destructive" });
          return;
        }
        
        const savedFolder = await response.json();
        console.log('Folder saved to database:', savedFolder);
        
        // Update local state with the database ID
        const folderId = `${newFolderParent}-subfolder-${newFolderName.toLowerCase()}-${savedFolder.id}`;
        setCustomFolders(prev => [...prev, {
          id: folderId,
          name: newFolderName.trim(),
          parent: newFolderParent
        }]);
        
        setNewFolderName('');
        setNewFolderDialogOpen(false);
        toast({ title: `Folder "${newFolderName}" created` });
      } catch (err) {
        console.error('Failed to save folder to database:', err);
        toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
      }
    }
  };
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setFolderContextMenu(null);
    if (folderContextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [folderContextMenu]);
  
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
    { id: "cppa122", name: "CPPA122", color: "text-green-400" },
    { id: "cfnf400", name: "CFNF400", color: "text-pink-400" },
    { id: "casl101", name: "CASL101", color: "text-indigo-400" },
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
  const [completedTaskHistory, setCompletedTaskHistory] = useState<number[]>(() => {
    const saved = localStorage.getItem('completedTaskHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);
  // Shared AudioContext ref - only created by user interaction, reused for alarms
  const sharedAudioContextRef = useRef<AudioContext | null>(null);
  
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
          // Initialize or reuse shared AudioContext for future alarm sounds
          if (!sharedAudioContextRef.current) {
            sharedAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const audioContext = sharedAudioContextRef.current;
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
  const [schoolEditCourseIdx, setSchoolEditCourseIdx] = useState<number | null>(null);
  const [schoolEditCourseData, setSchoolEditCourseData] = useState({ code: '', name: '', professor: '', email: '', calendarLabel: '' });
  const [courseDisplayNames, setCourseDisplayNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('courseDisplayNames');
    if (saved) {
      const parsed = JSON.parse(saved);
      _courseDisplayNames = { ...defaultCourseDisplayNames, ...parsed };
      return _courseDisplayNames;
    }
    return { ...defaultCourseDisplayNames };
  });
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
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
    tallPillButtonSpacing: number;
    tallPillHeight: number;
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
      showArrows: parsed.showArrows ?? true,
      tallPillButtonSpacing: parsed.tallPillButtonSpacing ?? 0,
      tallPillHeight: parsed.tallPillHeight ?? 0
    };
  });
  
  // Save blink settings to localStorage
  useEffect(() => {
    localStorage.setItem('blinkSettings', JSON.stringify(blinkSettings));
  }, [blinkSettings]);
  
  // TEST: Isolated progress bar position (completely separate from task columns)
  // Load from localStorage on init
  const testProgressBarLeft = 0;
  const testTextLeft = 8;
  const testCourseLeft = 12;
  const testCourseNameLeft = 8;
  const testDueDateLeft = 8;

  // Task column widths - resizable
  const [taskColumnWidths, setTaskColumnWidths] = useState<{
    taskGap: number;
    taskName: number;
    courseCode: number;
    courseName: number;
    dueDate: number;
  }>(() => {
    const saved = localStorage.getItem('taskColumnWidths');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      taskGap: parsed.taskGap ?? 0,
      taskName: parsed.taskName ?? 48,
      courseCode: parsed.courseCode ?? 100,
      courseName: parsed.courseName ?? 145,
      dueDate: parsed.dueDate ?? 55
    };
  });
  
  // Save column widths to localStorage
  useEffect(() => {
    localStorage.setItem('taskColumnWidths', JSON.stringify(taskColumnWidths));
  }, [taskColumnWidths]);
  
  // Column resize state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  
  // Handle task column resize (inverted = true for left-side handles)
  const resizeInvertedRef = useRef(false);
  const handleTaskColumnResizeStart = (e: React.MouseEvent | React.TouchEvent, column: string, inverted = false) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientX } = getPointerXY(e);
    setResizingColumn(column);
    resizeStartX.current = clientX;
    resizeStartWidth.current = taskColumnWidths[column as keyof typeof taskColumnWidths];
    resizeInvertedRef.current = inverted;
  };
  
  useEffect(() => {
    if (!resizingColumn) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const { clientX } = getPointerXY(e);
      const diff = clientX - resizeStartX.current;
      const adjustedDiff = resizeInvertedRef.current ? -diff : diff;
      const newWidth = Math.max(30, Math.min(300, resizeStartWidth.current + adjustedDiff));
      setTaskColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth
      }));
    };
    
    const handleEnd = () => {
      setResizingColumn(null);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [resizingColumn]);
  
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
  
  const refreshFileCounts = useCallback(async (retryCount = 0) => {
    try {
      const response = await fetch('/api/files/counts');
      if (response.ok) {
        const counts = await response.json();
        
        try {
          const odResponse = await fetch(`/api/onedrive/week-counts/${selectedWeek}`);
          if (odResponse.ok) {
            const odCounts = await odResponse.json();
            for (const [key, value] of Object.entries(odCounts)) {
              const existing = counts[key] as any;
              const odVal = value as any;
              if (!existing || existing.total === 0) {
                counts[key] = value;
              } else if (odVal && odVal.total > existing.total) {
                counts[key] = { ...existing, total: odVal.total, unlistened: odVal.total - existing.listened };
              }
            }
          }
        } catch (odError) {
          console.error('Error fetching OneDrive week counts:', odError);
        }
        
        setFileCounts(counts);
        const legacyCounts: Record<string, number> = {};
        for (const [key, value] of Object.entries(counts)) {
          legacyCounts[key] = (value as { total: number }).total;
        }
        setOneDriveFileCounts(legacyCounts);
      } else if (retryCount < 2) {
        setTimeout(() => refreshFileCounts(retryCount + 1), 1500);
      }
    } catch (error) {
      console.error('Error fetching file counts:', error);
      if (retryCount < 2) {
        setTimeout(() => refreshFileCounts(retryCount + 1), 1500);
      }
    }
  }, [selectedWeek]);

  useEffect(() => {
    refreshFileCounts();
  }, [refreshFileCounts]);
  
  // Close modules/readings honeycomb when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking date navigation arrows
      const isDateNav = target.closest('[data-date-nav]');
      if (isDateNav) return;
      
      // Don't close if clicking resize handle
      const isResizeHandle = target.closest('[data-resize-handle]');
      if (isResizeHandle) return;
      
      // Check if click is on modules button or course buttons
      if (modulesHoneycombOpen === 'modules') {
        const isModulesButton = target.closest('[data-modules-button]');
        const isCourseButton = target.closest('[data-course-button]');
        if (!isModulesButton && !isCourseButton) {
          setModulesHoneycombOpen(null);
        }
      }
      // Check if click is on readings button or readings course buttons
      if (modulesHoneycombOpen === 'readings') {
        const isReadingsButton = target.closest('[data-readings-button]');
        const isReadingsCourseButton = target.closest('[data-readings-course-button]');
        if (!isReadingsButton && !isReadingsCourseButton) {
          setModulesHoneycombOpen(null);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [modulesHoneycombOpen]);
  
  // Default box order: Today, Tomorrow, This Week (left to right)
  const getDefaultBoxOrder = (): string[] => {
    return ['today', 'tomorrow', 'this-week'];
  };
  
  // Box order state - initialized from default, but can be dragged
  const [boxOrder, setBoxOrder] = useState<string[]>(() => {
    // Always use the fixed default order: Today, Tomorrow, This Week
    return getDefaultBoxOrder();
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
    boxGlassEffect: boolean;
    boxTransparency: number;
    mainBackgroundOverlay: boolean;
    todayCellBackground: string;
    currentHourRowBackground: string;
    todayCurrentHourCellBackground: string;
  }>(() => {
    const saved = localStorage.getItem('colorSettings');
    const defaults = {
      boxBackground: '#ffffff',
      headerBar: '#160502',
      mainBackground: '#1a1a2e',
      boxGlassEffect: true,
      boxTransparency: 35,
      mainBackgroundOverlay: false,
      todayCellBackground: '#d4d4d4',
      currentHourRowBackground: '#d4d4d4',
      todayCurrentHourCellBackground: '#160502'
    };
    // Check if migration has been done
    const migrationDone = localStorage.getItem('colorSettingsMigrationV7');
    if (!migrationDone) {
      const existing = saved ? JSON.parse(saved) : {};
      const migrated = { ...defaults, ...existing, todayCellBackground: '#d4d4d4', currentHourRowBackground: '#d4d4d4' };
      localStorage.setItem('colorSettings', JSON.stringify(migrated));
      localStorage.setItem('colorSettingsMigrationV7', 'done');
      return migrated;
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
    return defaults;
  });
  
  // Store original settings when dialog opens (for cancel functionality)
  const [originalColorSettings, setOriginalColorSettings] = useState(colorSettings);
  const [originalBlinkSettings, setOriginalBlinkSettings] = useState(blinkSettings);
  
  // Generate a device-specific identifier based on screen dimensions
  const getDeviceId = useCallback(() => {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    return `device_${screenWidth}x${screenHeight}@${pixelRatio}`;
  }, []);
  
  // Grid size settings for resizable calendar columns and rows
  const [gridSizes, setGridSizes] = useState<{
    timeColumnWidth: number;
    moduleColumnWidth: number;
    dayColumnWidths: number[];
    progressColumnWidth: number;
    allDayRowHeight: number;
    courseRowHeight: number;
    timeSlotHeight: number;
    timeSlotHeights: number[]; // Individual heights for each hour (0-23)
  }>(() => {
    const defaultHeights = Array(24).fill(36); // Default 36px for each hour
    const defaultSizes = {
      timeColumnWidth: 59,
      moduleColumnWidth: 0,
      dayColumnWidths: [1, 1, 1, 1, 1, 1, 1], // flex proportions for 7 days (Sun-Sat)
      progressColumnWidth: 0.75, // separate from day columns
      allDayRowHeight: 36,
      courseRowHeight: 36,
      timeSlotHeight: 36,
      timeSlotHeights: defaultHeights
    };
    
    const migrateOldWidths = (parsed: any) => {
      if (parsed.dayColumnWidths && parsed.dayColumnWidths.length === 8) {
        const oldWidths = parsed.dayColumnWidths;
        parsed.progressColumnWidth = oldWidths[6];
        parsed.dayColumnWidths = [...oldWidths.slice(0, 6), oldWidths[7]];
      }
      if (!parsed.dayColumnWidths || parsed.dayColumnWidths.length < 7) {
        parsed.dayColumnWidths = [1, 1, 1, 1, 1, 1, 1];
      }
      if (parsed.progressColumnWidth === undefined || parsed.progressColumnWidth <= 0.5) {
        parsed.progressColumnWidth = 0.75;
      }
    };
    
    // Check for device-specific saved settings first
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    const deviceId = `device_${screenWidth}x${screenHeight}@${pixelRatio}`;
    const deviceSaved = localStorage.getItem(`gridSizes_${deviceId}`);
    
    if (deviceSaved) {
      const parsed = JSON.parse(deviceSaved);
      if (!parsed.timeSlotHeights || parsed.timeSlotHeights.length !== 24) {
        parsed.timeSlotHeights = defaultHeights;
      }
      if (!parsed.timeSlotHeight) parsed.timeSlotHeight = 36;
      if (!parsed.courseRowHeight) parsed.courseRowHeight = 48;
      if (parsed.moduleColumnWidth === undefined) parsed.moduleColumnWidth = 0;
      if (!parsed.timeColumnWidth) parsed.timeColumnWidth = 59;
      migrateOldWidths(parsed);
      return parsed;
    }
    
    // Fall back to general saved settings
    const saved = localStorage.getItem('gridSizes');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.timeSlotHeights || parsed.timeSlotHeights.length !== 24) {
        parsed.timeSlotHeights = defaultHeights;
      }
      if (!parsed.timeSlotHeight) parsed.timeSlotHeight = 36;
      if (!parsed.courseRowHeight) parsed.courseRowHeight = 48;
      if (parsed.moduleColumnWidth === undefined) parsed.moduleColumnWidth = 0;
      if (!parsed.timeColumnWidth) parsed.timeColumnWidth = 59;
      migrateOldWidths(parsed);
      return parsed;
    }
    return defaultSizes;
  });
  
  // State to show "Saved!" confirmation
  const [showDeviceSaved, setShowDeviceSaved] = useState(false);
  
  // Save grid sizes as default for this device
  const saveAsDeviceDefault = useCallback(() => {
    const deviceId = getDeviceId();
    localStorage.setItem(`gridSizes_${deviceId}`, JSON.stringify(gridSizes));
    localStorage.setItem(`calendarHeight_${deviceId}`, calendarHeight.toString());
    setShowDeviceSaved(true);
    setTimeout(() => setShowDeviceSaved(false), 2000);
    toast({ title: `Layout saved for this device (${deviceId})` });
  }, [gridSizes, calendarHeight, getDeviceId, toast]);
  
  // Save grid sizes to localStorage
  useEffect(() => {
    localStorage.setItem('gridSizes', JSON.stringify(gridSizes));
  }, [gridSizes]);
  
  // Save calendar height to localStorage
  useEffect(() => {
    localStorage.setItem('calendarHeight', calendarHeight.toString());
  }, [calendarHeight]);
  
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
  
  // Context menu state for right-click delete
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    taskId: number;
    taskTitle: string;
  } | null>(null);
  
  // Long-press timer for touch devices
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTouchRef = useRef<{ x: number; y: number; taskId: number; taskTitle: string } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent, taskId: number, taskTitle: string) => {
    const touch = e.touches[0];
    longPressTouchRef.current = { x: touch.clientX, y: touch.clientY, taskId, taskTitle };
    longPressTimerRef.current = setTimeout(() => {
      if (longPressTouchRef.current) {
        setContextMenu({
          x: longPressTouchRef.current.x,
          y: longPressTouchRef.current.y,
          taskId: longPressTouchRef.current.taskId,
          taskTitle: longPressTouchRef.current.taskTitle
        });
        longPressTouchRef.current = null;
      }
    }, 500); // 500ms long press
  };
  
  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTouchRef.current = null;
  };
  
  const handleTouchMove = () => {
    // Cancel long press if user moves finger
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTouchRef.current = null;
  };
  
  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('contextmenu', handleClickOutside);
      };
    }
  }, [contextMenu]);
  
  // Handle column resize
  const handleColumnResizeStart = (e: React.MouseEvent | React.TouchEvent, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientX } = getPointerXY(e);
    const startWidth = columnIndex === -1 
      ? gridSizes.timeColumnWidth 
      : columnIndex === -2
        ? gridSizes.moduleColumnWidth
        : gridSizes.dayColumnWidths[columnIndex];
    setColumnResizing({
      isResizing: true,
      columnIndex,
      startX: clientX,
      startWidth
    });
  };
  
  // Handle row resize
  const handleRowResizeStart = (e: React.MouseEvent | React.TouchEvent, rowType: 'allDay' | 'course' | 'timeSlot', hourIndex?: number) => {
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
    const { clientY } = getPointerXY(e);
    setRowResizing({
      isResizing: true,
      rowType,
      hourIndex,
      startY: clientY,
      startHeight
    });
  };
  
  // Global move/end handlers for resizing (mouse + touch)
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const { clientX, clientY } = getPointerXY(e);
      if (columnResizing?.isResizing) {
        const delta = clientX - columnResizing.startX;
        if (columnResizing.columnIndex === -1) {
          const newWidth = Math.max(115, Math.min(200, columnResizing.startWidth + delta));
          setGridSizes(prev => ({ ...prev, timeColumnWidth: newWidth }));
        } else if (columnResizing.columnIndex === -2) {
          const newWidth = Math.max(50, Math.min(150, columnResizing.startWidth + delta));
          setGridSizes(prev => ({ ...prev, moduleColumnWidth: newWidth }));
        } else {
          const newWidths = [...gridSizes.dayColumnWidths];
          const newProportion = Math.max(0.5, columnResizing.startWidth + delta / 100);
          newWidths[columnResizing.columnIndex] = newProportion;
          setGridSizes(prev => ({ ...prev, dayColumnWidths: newWidths }));
        }
      }
      if (rowResizing?.isResizing) {
        const delta = clientY - rowResizing.startY;
        const newHeight = Math.max(20, rowResizing.startHeight + delta);
        if (rowResizing.rowType === 'allDay') {
          setGridSizes(prev => ({ ...prev, allDayRowHeight: Math.min(100, newHeight) }));
        } else if (rowResizing.rowType === 'course') {
          setGridSizes(prev => ({ ...prev, courseRowHeight: Math.min(60, newHeight) }));
        } else if (rowResizing.rowType === 'timeSlot' && rowResizing.hourIndex !== undefined) {
          setGridSizes(prev => {
            const newHeights = [...prev.timeSlotHeights];
            newHeights[rowResizing.hourIndex!] = Math.max(24, Math.min(150, newHeight));
            return { ...prev, timeSlotHeights: newHeights };
          });
        } else if (rowResizing.rowType === 'timeSlot') {
          setGridSizes(prev => ({ ...prev, timeSlotHeight: Math.min(100, newHeight) }));
        }
      }
    };
    
    const handleEnd = () => {
      setColumnResizing(null);
      setRowResizing(null);
    };
    
    if (columnResizing?.isResizing || rowResizing?.isResizing) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.body.style.cursor = columnResizing?.isResizing ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [columnResizing, rowResizing, gridSizes.dayColumnWidths]);
  
  // Generate grid template columns based on sizes
  // dayColumnWidths has 7 entries (Sun-Sat), progress column inserted between Fri (5) and Sat (6)
  const getGridTemplateColumns = () => {
    const sunToFri = gridSizes.dayColumnWidths.slice(0, 6).map(w => `${w}fr`).join(' ');
    const sat = `${gridSizes.dayColumnWidths[6]}fr`;
    const progress = `${gridSizes.progressColumnWidth}fr`;
    if (gridSizes.moduleColumnWidth > 0) {
      return `${gridSizes.timeColumnWidth}px ${gridSizes.moduleColumnWidth}px ${sunToFri} ${progress} ${sat}`;
    }
    return `${gridSizes.timeColumnWidth}px ${sunToFri} ${progress} ${sat}`;
  };
  
  const [draggedBox, setDraggedBox] = useState<string | null>(null);
  const [thisWeekBoxHeight, setThisWeekBoxHeight] = useState<number | null>(null);
  const [isResizingThisWeek, setIsResizingThisWeek] = useState(false);
  const thisWeekResizeStartY = useRef<number>(0);
  const thisWeekResizeStartHeight = useRef<number>(0);
  
  // Refs to measure first row column positions for alignment
  const row1TaskRef = useRef<HTMLDivElement>(null);
  const row1CodeRef = useRef<HTMLDivElement>(null);
  const row1CourseRef = useRef<HTMLDivElement>(null);
  const row1DueRef = useRef<HTMLDivElement>(null);
  const row1DaysRef = useRef<HTMLDivElement>(null);
  const row1ProgressBarRef = useRef<HTMLDivElement>(null);
  const row1ContainerRef = useRef<HTMLDivElement>(null);
  // HARDCODED header positions - NEVER change without explicit user permission
  // remaining=25, task=75, code=177, course=214, due=365, days=right-aligned to right edge
  const HEADER_POS = { remaining: 25, task: 77, code: 191, course: 236, due: 376 };
  const [row1Positions, setRow1Positions] = useState({ task: 70, code: 170, course: 240, due: 340, days: 400, progressBar: 18, progressBarTop: 0 });
  
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

  // This Week box resize handlers
  const handleThisWeekResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { clientY } = getPointerXY(e);
    setIsResizingThisWeek(true);
    thisWeekResizeStartY.current = clientY;
    const section = (e.target as HTMLElement).closest('section');
    thisWeekResizeStartHeight.current = section?.offsetHeight || 125;
  };

  useEffect(() => {
    if (!isResizingThisWeek) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const { clientY } = getPointerXY(e);
      const deltaY = clientY - thisWeekResizeStartY.current;
      const newHeight = Math.max(85, thisWeekResizeStartHeight.current + deltaY);
      setThisWeekBoxHeight(newHeight);
    };
    
    const handleEnd = () => {
      setIsResizingThisWeek(false);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizingThisWeek]);

  const [profileData, setProfileData] = useState<{ firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null; postalCode: string }>(() => {
    const saved = localStorage.getItem('profileData');
    return saved ? { postalCode: '', ...JSON.parse(saved) } : { firstName: 'Bryn', lastName: 'Kai-Hendricks', birthdate: '', timezone: 'America/Toronto', travelTimezone: null, postalCode: '' };
  });
  const [schoolData, setSchoolData] = useState<{ schoolLogo: string | null; schoolName: string; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string; timezone: string; isTravelling?: boolean; travelTimezone?: string }>(() => {
    const saved = localStorage.getItem('schoolData');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { schoolName: 'Toronto Metropolitan University', ...parsed };
    }
    return { schoolLogo: null, schoolName: 'Toronto Metropolitan University', numberOfWeeks: 13, week1StartDate: '2026-01-12', firstDayOfWeek: 'saturday', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto' };
  });
  
  const [coursesData, setCoursesData] = useState<{ courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> }>(() => {
    const defaultCourses = [
      { name: 'CPPA122 - Local Politics and Government', color: '#47B045', professor: 'Caryl Arundel', professorEmail: 'carundel@torontomu.ca' },
      { name: 'CFNF400 - Human Sexuality', color: '#FA67B3', professor: 'Alex McKay', professorEmail: 'a4mckay@torontomu.ca' },
      { name: 'CASL101 - American Sign Language', color: '#818cf8', professor: 'Christina Moreau', professorEmail: 'christina.moreau@torontomu.ca' },
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
        const coursesWithProfessor = parsed.courses.map((c: { name: string; color: string; professor?: string; professorEmail?: string }, i: number) => ({
          ...c,
          name: c.name?.trim() ? c.name : defaultCourses[i]?.name ?? '',
          color: c.color || defaultCourses[i]?.color || '#6b7280',
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
  const [isNewCourseDialogOpen, setIsNewCourseDialogOpen] = useState(false);
  const newCourseDialogClosingRef = useRef(false);

  const [aasSentStatus, setAasSentStatus] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('aasSentStatus');
    return saved ? JSON.parse(saved) : {};
  });
  const [showAasReminder, setShowAasReminder] = useState(false);

  const toggleAasSent = (courseCode: string) => {
    const updated = { ...aasSentStatus, [courseCode]: !aasSentStatus[courseCode] };
    setAasSentStatus(updated);
    localStorage.setItem('aasSentStatus', JSON.stringify(updated));
  };
  
  // Get the display timezone (travel if set, otherwise home)
  const displayTimezone = profileData.travelTimezone || profileData.timezone;

  const toggleCourse = (courseId: string) => {
    setCheckedCourses(prev => {
      const updated = { ...prev, [courseId]: !prev[courseId] };
      localStorage.setItem('checkedCourses', JSON.stringify(updated));
      return updated;
    });
  };
  
  const saveProfile = (data: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null; postalCode: string }) => {
    setProfileData(data);
    localStorage.setItem('profileData', JSON.stringify(data));
    setIsProfileDialogOpen(false);
    toast({ title: "Profile saved", description: "Your profile has been updated." });
  };
  
  const saveSchool = (data: { schoolLogo: string | null; schoolName: string; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string; timezone: string; isTravelling?: boolean; travelTimezone?: string; semesterType?: string }) => {
    const { semesterType: semType, ...schoolOnly } = data;
    setSchoolData(schoolOnly);
    localStorage.setItem('schoolData', JSON.stringify(schoolOnly));
    if (semType && semesterSettings) {
      saveSemesterScheduleMutation.mutate({ semesterType: semType });
    }
    setIsSchoolDialogOpen(false);
    toast({ title: "School settings saved", description: "Your school settings have been updated." });
  };
  
  const saveCourses = (data: { courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> }) => {
    setCoursesData(data);
    localStorage.setItem('coursesData', JSON.stringify(data));
    setIsCoursesDialogOpen(false);
    toast({ title: "Courses saved", description: "Your courses have been updated." });
  };

  const saveSemesterScheduleMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("PATCH", "/api/semester", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester"] });
      setIsCoursesDialogOpen(false);
      toast({ title: "Schedule saved", description: "Course schedule has been updated." });
    },
  });

  const generateClassTasksMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/semester/generate-class-tasks", {});
    },
    onSuccess: async (response: any) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Class Tasks Created", description: data.message || "Class tasks have been generated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate class tasks.", variant: "destructive" });
    },
  });
  
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
  
  const generateShareLink = async () => {
    setIsGeneratingLink(true);
    try {
      const response = await fetch('/api/access-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Share link ${new Date().toLocaleDateString()}` }),
      });
      const token = await response.json();
      const link = `${window.location.origin}?access=${token.token}`;
      setShareLink(link);
      setIsShareDialogOpen(true);
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" });
    } finally {
      setIsGeneratingLink(false);
    }
  };
  
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: "Copied!", description: "Share link copied to clipboard" });
  };
  
  const getCourseColor = (courseName: string): string => {
    const course = coursesData.courses.find(c => c.name && courseName.includes(c.name.split(' - ')[0]));
    return course?.color || '#6b7280';
  };
  
  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 107, g: 114, b: 128 }; // gray fallback
  };
  
  // Helper to generate button gradient from course hex color
  const getButtonGradient = (hex: string): string => {
    const rgb = hexToRgb(hex);
    // Create a darker version for gradient start (top)
    const darkerR = Math.max(0, rgb.r - 40);
    const darkerG = Math.max(0, rgb.g - 40);
    const darkerB = Math.max(0, rgb.b - 40);
    // Create a much lighter version for the gradient end (bottom)
    const lighterR = Math.min(255, rgb.r + 100);
    const lighterG = Math.min(255, rgb.g + 100);
    const lighterB = Math.min(255, rgb.b + 100);
    return `linear-gradient(180deg, rgb(${darkerR}, ${darkerG}, ${darkerB}) 0%, rgb(${lighterR}, ${lighterG}, ${lighterB}) 100%)`;
  };
  
  // Helper to generate reversed border gradient (for wrapper) from course hex color
  const getBorderGradient = (hex: string): string => {
    const rgb = hexToRgb(hex);
    const darkerR = Math.max(0, rgb.r - 40);
    const darkerG = Math.max(0, rgb.g - 40);
    const darkerB = Math.max(0, rgb.b - 40);
    const lighterR = Math.min(255, rgb.r + 100);
    const lighterG = Math.min(255, rgb.g + 100);
    const lighterB = Math.min(255, rgb.b + 100);
    return `linear-gradient(0deg, rgb(${darkerR}, ${darkerG}, ${darkerB}) 0%, rgb(${lighterR}, ${lighterG}, ${lighterB}) 100%)`;
  };
  
  // Dynamic course colors based on coursesData
  const dynamicCourseColors = useMemo(() => {
    const colors: Record<string, { bg: string; border: string; text: string; dot: string; prepBg: string; prepBorder: string; prepText: string; hex: string }> = {};
    
    coursesData.courses.forEach(course => {
      if (!course.name) return;
      const courseCode = course.name.split(' - ')[0].toUpperCase();
      const hex = course.color;
      const rgb = hexToRgb(hex);
      
      // Calculate a light tint by mixing with white (for opaque task backgrounds)
      const tintR = Math.round(rgb.r + (255 - rgb.r) * 0.85);
      const tintG = Math.round(rgb.g + (255 - rgb.g) * 0.85);
      const tintB = Math.round(rgb.b + (255 - rgb.b) * 0.85);
      
      colors[courseCode] = {
        hex,
        bg: `rgb(${tintR}, ${tintG}, ${tintB})`, // Opaque light tint of course color
        border: hex,
        text: hex,
        dot: hex,
        prepBg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
        prepBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
        prepText: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`
      };
    });
    
    return colors;
  }, [coursesData]);
  
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
  const [todoItems, setTodoItems] = useState<string[]>([]);
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
        if (confirm('Delete this task?')) {
          deleteMutation.mutate(selectedTaskId);
          setSelectedTaskId(null);
        }
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

  // Create jiggle sound using Web Audio API - only if Bluetooth/audio already connected
  const playJiggleSound = useCallback(() => {
    try {
      // Don't create new AudioContext - only play if one already exists and is running
      // This prevents initiating Bluetooth connections for today task alarms
      if (!sharedAudioContextRef.current || sharedAudioContextRef.current.state !== 'running') {
        console.log('Audio context not running - skipping alarm sound to avoid Bluetooth initiation');
        return;
      }
      
      const audioContext = sharedAudioContextRef.current;
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

  // Speak "New Week" when the week changes (Sunday midnight) with a female voice
  const speakNewWeek = useCallback(() => {
    if (!window.speechSynthesis) return;
    try {
      const utterance = new SpeechSynthesisUtterance("New Week");
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
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

  // Update clock every second and detect week change (Sunday midnight)
  const lastWeekRef = useRef((() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
  })());
  const lastDateRef = useRef(new Date().getDate());
  useEffect(() => {
    const getWeekNumber = (date: Date) => {
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      return Math.floor((date.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    };
    const currentWeekNum = getWeekNumber(new Date());
    lastWeekRef.current = currentWeekNum;
    
    const timer = setInterval(() => {
      const now = new Date();
      const currentDate = now.getDate();
      lastDateRef.current = currentDate;
      
      const weekNum = getWeekNumber(now);
      if (weekNum !== lastWeekRef.current) {
        lastWeekRef.current = weekNum;
        speakNewWeek();
      }
      setCurrentTime(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [speakNewWeek]);

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
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { clientY } = getPointerXY(e);
    setIsResizing(true);
    resizeRef.current = { startY: clientY, startHeight: calendarHeight };
  }, [calendarHeight]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const { clientY } = getPointerXY(e);
      const delta = clientY - resizeRef.current.startY;
      const newHeight = Math.max(200, Math.min(window.innerHeight - 60, resizeRef.current.startHeight + delta));
      setCalendarHeight(newHeight);
    };

    const handleEnd = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing]);

  const { data: weeks = [] } = useQuery<WeekInfo[]>({
    queryKey: ["/api/weeks"],
  });

  // Automatically set selectedWeek based on today's date (re-checks when date changes)
  const lastAutoWeekDateRef = useRef(new Date().getDate());
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
      lastAutoWeekDateRef.current = today.getDate();
    }
  }, [weeks]);

  useEffect(() => {
    if (weeks.length === 0) return;
    const currentDate = currentTime.getDate();
    if (currentDate !== lastAutoWeekDateRef.current) {
      lastAutoWeekDateRef.current = currentDate;
      const todayDateOnly = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
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
  }, [currentTime, weeks]);

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => fetch("/api/tasks", { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    retry: 2,
    retryDelay: 1000,
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { weekNumber: selectedWeek }],
    queryFn: () => fetch(`/api/tasks?weekNumber=${selectedWeek}`, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch all projects for calendar display
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => fetch("/api/projects", { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch sticky notes
  const { data: stickyNotes = [] } = useQuery<StickyNoteType[]>({
    queryKey: ["/api/sticky-notes"],
    queryFn: () => fetch("/api/sticky-notes", { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    retry: 2,
    retryDelay: 1000,
  });

  // Sticky note state for dragging
  const [draggingStickyNote, setDraggingStickyNote] = useState<number | null>(null);
  const [stickyNoteOffset, setStickyNoteOffset] = useState({ x: 0, y: 0 });
  const stickyNoteOffsetRef = useRef({ x: 0, y: 0 });
  const draggingStickyNoteRef = useRef<number | null>(null);
  const [maxStickyZIndex, setMaxStickyZIndex] = useState(100);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  
  // Sticky note state for resizing
  const [resizingStickyNote, setResizingStickyNote] = useState<number | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  
  // Local state for sticky note content to prevent cursor jumping
  const [localStickyNoteContent, setLocalStickyNoteContent] = useState<Record<number, string>>({});
  const [localStickyNoteTitle, setLocalStickyNoteTitle] = useState<Record<number, string>>({});
  const stickyNoteContentTimeouts = useRef<Record<number, NodeJS.Timeout>>({});
  const stickyNoteTitleTimeouts = useRef<Record<number, NodeJS.Timeout>>({});

  // Sticky note mutations
  const createStickyNoteMutation = useMutation({
    mutationFn: (note: Partial<StickyNoteType>) => apiRequest("POST", "/api/sticky-notes", note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sticky-notes"] }),
  });

  const updateStickyNoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<StickyNoteType> }) => 
      apiRequest("PATCH", `/api/sticky-notes/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sticky-notes"] }),
  });

  const deleteStickyNoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sticky-notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sticky-notes"] }),
  });

  // Handle adding a new sticky note
  // Calculate sticky note home position (all-day box on day before today column)
  const getStickyNoteHomePosition = () => {
    // The calendar starts at around x=400, each day column is ~150px wide
    // Yesterday is 1 column before today, today column is typically around index 3-4
    // All-day box is at the top of the calendar, around y=160
    const calendarStartX = 430; // Approximate start of calendar
    const dayColumnWidth = 150; // Width of each day column
    const yesterdayColumnIndex = 2; // Yesterday is typically 2nd column (0-indexed)
    const allDayBoxY = 170; // Top of all-day area
    
    return {
      x: Math.floor(calendarStartX + (yesterdayColumnIndex * dayColumnWidth) + 10),
      y: allDayBoxY
    };
  };

  const handleAddStickyNote = () => {
    const newZIndex = maxStickyZIndex + 1;
    setMaxStickyZIndex(newZIndex);
    const homePos = getStickyNoteHomePosition();
    // Offset each new note slightly to avoid stacking exactly
    const existingCount = stickyNotes?.length || 0;
    const offsetX = (existingCount % 3) * 15;
    const offsetY = Math.floor(existingCount / 3) * 15;
    
    createStickyNoteMutation.mutate({
      content: "",
      color: "yellow",
      positionX: homePos.x + offsetX,
      positionY: homePos.y + offsetY,
      width: 271,
      height: 250,
      zIndex: newZIndex,
      isMinimized: false,
      homePositionX: homePos.x,
      homePositionY: homePos.y,
    });
  };

  // Handle sticky note drag
  const handleStickyNotePointerDown = (e: React.MouseEvent | React.TouchEvent, noteId: number, note: StickyNoteType) => {
    e.preventDefault();
    const { clientX, clientY } = getPointerXY(e);
    setDraggingStickyNote(noteId);
    draggingStickyNoteRef.current = noteId;
    
    const rect = (e.target as HTMLElement).closest('[data-sticky-note]')?.getBoundingClientRect();
    if (rect) {
      const offset = { x: clientX - rect.left, y: clientY - rect.top };
      setStickyNoteOffset(offset);
      stickyNoteOffsetRef.current = offset;
      
      const initialPos = { x: note.positionX, y: note.positionY };
      setDragPosition(initialPos);
      dragPositionRef.current = initialPos;
    }
    // Bring to front and restore size if it was snapped (small)
    const newZIndex = maxStickyZIndex + 1;
    setMaxStickyZIndex(newZIndex);
    const wasSnapped = note.width < 200 || note.height < 200;
    updateStickyNoteMutation.mutate({ 
      id: noteId, 
      updates: { 
        zIndex: newZIndex,
        ...(wasSnapped ? { width: 271, height: 250 } : {})
      } 
    });
  };

  const handleStickyNotePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (draggingStickyNoteRef.current !== null) {
      if ('touches' in e) e.preventDefault();
      const { clientX, clientY } = getPointerXY(e);
      const offset = stickyNoteOffsetRef.current;
      const newX = Math.max(0, clientX - offset.x);
      const newY = Math.max(0, clientY - offset.y);
      const newPos = { x: newX, y: newY };
      dragPositionRef.current = newPos;
      const el = document.querySelector(`[data-sticky-note-id="${draggingStickyNoteRef.current}"]`) as HTMLElement;
      if (el) {
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      }
    }
  }, []);

  const handleStickyNotePointerUp = useCallback((e: MouseEvent | TouchEvent) => {
    const currentDragPosition = dragPositionRef.current;
    const currentNoteId = draggingStickyNoteRef.current;
    
    // Mark the note as moved with current timestamp
    if (currentNoteId !== null && currentDragPosition !== null) {
      // Check if dropped in all-day row area - snap to cell left of today
      if (allDayRowRef.current) {
        const allDayRect = allDayRowRef.current.getBoundingClientRect();
        const { clientX: mouseX, clientY: mouseY } = getPointerXY(e);
        
        // Check if mouse is within the all-day row area (with some tolerance)
        if (mouseY >= allDayRect.top - 20 && mouseY <= allDayRect.bottom + 20 && 
            mouseX >= allDayRect.left && mouseX <= allDayRect.right) {
          
          // Find today's column index (0-6)
          const today = startOfDay(new Date());
          const weekStart = startOfWeek(today, { weekStartsOn: 6 }); // Saturday start
          const todayIdx = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
          
          // Target is day before today (or today if it's Saturday)
          const targetIdx = Math.max(0, todayIdx - 1);
          
          // Find the target cell by looking for the all-day slot element
          const targetDate = new Date(weekStart);
          targetDate.setDate(targetDate.getDate() + targetIdx);
          const dateStr = format(targetDate, "yyyy-MM-dd");
          const targetCell = document.querySelector(`[data-testid="all-day-slot-${dateStr}"]`);
          
          if (targetCell) {
            const cellRect = targetCell.getBoundingClientRect();
            const snapX = cellRect.left + 2;
            const snapY = cellRect.top + 2;
            const snapWidth = cellRect.width - 4;
            const snapHeight = cellRect.height - 4;
            
            updateStickyNoteMutation.mutate({ 
              id: currentNoteId, 
              updates: { 
                positionX: Math.round(snapX),
                positionY: Math.round(snapY),
                width: Math.round(snapWidth),
                height: Math.round(snapHeight),
                lastMovedAt: new Date(),
                homePositionX: Math.round(snapX),
                homePositionY: Math.round(snapY)
              } 
            });
            setDraggingStickyNote(null);
            draggingStickyNoteRef.current = null;
            setDragPosition(null);
            dragPositionRef.current = null;
            return;
          }
        }
      }
      
      // Check if note was previously snapped (small size) and reset to default size
      const currentNote = stickyNotes?.find(n => n.id === currentNoteId);
      const wasSnapped = currentNote && (currentNote.width < 200 || currentNote.height < 200);
      
      // Save final position to database, resizing to default if it was snapped
      updateStickyNoteMutation.mutate({ 
        id: currentNoteId, 
        updates: { 
          positionX: currentDragPosition.x,
          positionY: currentDragPosition.y,
          ...(wasSnapped ? { width: 271, height: 250 } : {}),
          lastMovedAt: new Date() 
        } 
      });
    }
    setDraggingStickyNote(null);
    draggingStickyNoteRef.current = null;
    setDragPosition(null);
    dragPositionRef.current = null;
  }, [updateStickyNoteMutation, stickyNotes]);

  useEffect(() => {
    if (draggingStickyNote !== null) {
      window.addEventListener('mousemove', handleStickyNotePointerMove);
      window.addEventListener('mouseup', handleStickyNotePointerUp);
      window.addEventListener('touchmove', handleStickyNotePointerMove, { passive: false });
      window.addEventListener('touchend', handleStickyNotePointerUp);
      return () => {
        window.removeEventListener('mousemove', handleStickyNotePointerMove);
        window.removeEventListener('mouseup', handleStickyNotePointerUp);
        window.removeEventListener('touchmove', handleStickyNotePointerMove);
        window.removeEventListener('touchend', handleStickyNotePointerUp);
      };
    }
  }, [draggingStickyNote, handleStickyNotePointerMove, handleStickyNotePointerUp]);

  // Auto-return sticky notes to home position after 2 hours
  useEffect(() => {
    const checkAndReturnNotes = () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      stickyNotes?.forEach((note) => {
        if (note.lastMovedAt && note.homePositionX !== null && note.homePositionY !== null) {
          const movedAt = new Date(note.lastMovedAt);
          if (movedAt < twoHoursAgo) {
            // Check if note is not at home position
            if (note.positionX !== note.homePositionX || note.positionY !== note.homePositionY) {
              updateStickyNoteMutation.mutate({
                id: note.id,
                updates: { 
                  positionX: note.homePositionX, 
                  positionY: note.homePositionY,
                  lastMovedAt: null
                }
              });
            }
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkAndReturnNotes, 60000);
    // Also check on mount
    checkAndReturnNotes();
    
    return () => clearInterval(interval);
  }, [stickyNotes]);

  // Handle sticky note resize
  const handleStickyNoteResizeStart = (e: React.MouseEvent | React.TouchEvent, noteId: number, note: StickyNoteType) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientX, clientY } = getPointerXY(e);
    setResizingStickyNote(noteId);
    setResizeStartPos({ x: clientX, y: clientY });
    setResizeStartSize({ width: note.width, height: note.height });
    // Bring to front
    const newZIndex = maxStickyZIndex + 1;
    setMaxStickyZIndex(newZIndex);
    updateStickyNoteMutation.mutate({ id: noteId, updates: { zIndex: newZIndex } });
  };

  const handleStickyNoteResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (resizingStickyNote !== null) {
      const { clientX, clientY } = getPointerXY(e);
      const deltaX = clientX - resizeStartPos.x;
      const deltaY = clientY - resizeStartPos.y;
      const newWidth = Math.max(120, Math.floor(resizeStartSize.width + deltaX));
      const newHeight = Math.max(80, Math.floor(resizeStartSize.height + deltaY));
      updateStickyNoteMutation.mutate({ 
        id: resizingStickyNote, 
        updates: { width: newWidth, height: newHeight } 
      });
    }
  }, [resizingStickyNote, resizeStartPos, resizeStartSize]);

  const handleStickyNoteResizeEnd = useCallback(() => {
    setResizingStickyNote(null);
  }, []);

  useEffect(() => {
    if (resizingStickyNote !== null) {
      window.addEventListener('mousemove', handleStickyNoteResizeMove);
      window.addEventListener('mouseup', handleStickyNoteResizeEnd);
      window.addEventListener('touchmove', handleStickyNoteResizeMove, { passive: false });
      window.addEventListener('touchend', handleStickyNoteResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleStickyNoteResizeMove);
        window.removeEventListener('mouseup', handleStickyNoteResizeEnd);
        window.removeEventListener('touchmove', handleStickyNoteResizeMove);
        window.removeEventListener('touchend', handleStickyNoteResizeEnd);
      };
    }
  }, [resizingStickyNote, handleStickyNoteResizeMove, handleStickyNoteResizeEnd]);

  // Handle sticky note content change with debounce to prevent cursor jumping
  const handleStickyNoteContentChange = useCallback((noteId: number, newContent: string) => {
    // Update local state immediately for responsive typing
    setLocalStickyNoteContent(prev => ({ ...prev, [noteId]: newContent }));
    
    // Clear any existing timeout for this note
    if (stickyNoteContentTimeouts.current[noteId]) {
      clearTimeout(stickyNoteContentTimeouts.current[noteId]);
    }
    
    // Debounce the save to server (500ms after user stops typing)
    stickyNoteContentTimeouts.current[noteId] = setTimeout(() => {
      updateStickyNoteMutation.mutate({ id: noteId, updates: { content: newContent } });
    }, 500);
  }, [updateStickyNoteMutation]);

  // Get the content to display for a sticky note (local state takes precedence)
  const getStickyNoteContent = useCallback((note: StickyNoteType) => {
    return localStickyNoteContent[note.id] !== undefined 
      ? localStickyNoteContent[note.id] 
      : note.content;
  }, [localStickyNoteContent]);

  const toggleStickyNoteBullets = useCallback((noteId: number, textareaEl: HTMLTextAreaElement | null) => {
    const note = stickyNotes?.find(n => n.id === noteId);
    const currentContent = localStickyNoteContent[noteId] !== undefined ? localStickyNoteContent[noteId] : (note?.content ?? '');
    const lines = currentContent.split('\n');
    const hasBullets = lines.some(line => line.trimStart().startsWith('\u25CF ') || line.trimStart().startsWith('\u2022 '));
    
    let newContent: string;
    if (hasBullets) {
      newContent = lines.map(line => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('\u25CF ')) {
          return line.replace(/\u25CF /, '');
        }
        if (trimmed.startsWith('\u2022 ')) {
          return line.replace(/\u2022 /, '');
        }
        return line;
      }).join('\n');
    } else {
      newContent = lines.map(line => {
        if (line.trim() === '') return line;
        return '\u25CF ' + line;
      }).join('\n');
    }
    
    handleStickyNoteContentChange(noteId, newContent);
    if (textareaEl) {
      setTimeout(() => textareaEl.focus(), 0);
    }
  }, [stickyNotes, localStickyNoteContent, handleStickyNoteContentChange]);

  const handleStickyNoteKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, noteId: number) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const { selectionStart } = textarea;
      const content = textarea.value;
      const lineStart = content.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = content.substring(lineStart, selectionStart);
      
      if (currentLine.trimStart().startsWith('\u25CF ') || currentLine.trimStart().startsWith('\u2022 ')) {
        const bulletChar = currentLine.trimStart().startsWith('\u25CF ') ? '\u25CF' : '\u2022';
        if (currentLine.trim() === bulletChar) {
          e.preventDefault();
          const before = content.substring(0, lineStart);
          const after = content.substring(selectionStart);
          const newContent = before + after;
          handleStickyNoteContentChange(noteId, newContent);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
        } else {
          e.preventDefault();
          const before = content.substring(0, selectionStart);
          const after = content.substring(selectionStart);
          const newContent = before + '\n' + bulletChar + ' ' + after;
          handleStickyNoteContentChange(noteId, newContent);
          setTimeout(() => {
            const newPos = selectionStart + 3;
            textarea.selectionStart = textarea.selectionEnd = newPos;
          }, 0);
        }
      }
    }
  }, [handleStickyNoteContentChange]);

  // Handle sticky note title change with debounce to prevent cursor jumping
  const handleStickyNoteTitleChange = useCallback((noteId: number, newTitle: string) => {
    // Update local state immediately for responsive typing
    setLocalStickyNoteTitle(prev => ({ ...prev, [noteId]: newTitle }));
    
    // Clear any existing timeout for this note
    if (stickyNoteTitleTimeouts.current[noteId]) {
      clearTimeout(stickyNoteTitleTimeouts.current[noteId]);
    }
    
    // Debounce the save to server (500ms after user stops typing)
    stickyNoteTitleTimeouts.current[noteId] = setTimeout(() => {
      updateStickyNoteMutation.mutate({ id: noteId, updates: { title: newTitle } });
    }, 500);
  }, [updateStickyNoteMutation]);

  // Get the title to display for a sticky note (local state takes precedence)
  const getStickyNoteTitle = useCallback((note: StickyNoteType) => {
    return localStickyNoteTitle[note.id] !== undefined 
      ? localStickyNoteTitle[note.id] 
      : (note.title || "Note Name");
  }, [localStickyNoteTitle]);

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
    lastChunkIndex?: number;
    totalChunks?: number;
    checkedChunks?: string;
  }
  
  const { data: weeklyFiles = [] } = useQuery<WeeklyFile[]>({
    queryKey: ["/api/files"],
    retry: 2,
    retryDelay: 1000,
  });

  // OneDrive files for files flyout
  interface OneDriveItem {
    id: string;
    name: string;
    type: "folder" | "file";
    mimeType?: string;
    size?: number;
    lastModified?: string;
    downloadUrl?: string;
    path: string;
  }
  
  const [oneDrivePath, setOneDrivePath] = useState("/School/1. TMU/Courses/2026/Winter");
  const [oneDrivePathHistory, setOneDrivePathHistory] = useState<string[]>([]);
  
  const { data: oneDriveItems = [], isLoading: oneDriveLoading } = useQuery<OneDriveItem[]>({
    queryKey: ["/api/onedrive/files", oneDrivePath],
    queryFn: async () => {
      const response = await fetch(`/api/onedrive/files?path=${encodeURIComponent(oneDrivePath)}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to load files");
      }
      return response.json();
    },
  });
  
  const oneDriveFolders = oneDriveItems
    .filter(item => item.type === "folder")
    .sort((a, b) => {
      // Course order to match calendar
      const courseOrder = ['CPPA122', 'CFNF400', 'CASL101'];
      
      // Check if folders are course folders
      const getCourseIndex = (name: string) => {
        for (let i = 0; i < courseOrder.length; i++) {
          if (name.includes(courseOrder[i])) return i;
        }
        return -1;
      };
      
      const courseIdxA = getCourseIndex(a.name);
      const courseIdxB = getCourseIndex(b.name);
      
      // If both are course folders, sort by course order
      if (courseIdxA !== -1 && courseIdxB !== -1) {
        return courseIdxA - courseIdxB;
      }
      // Course folders come first
      if (courseIdxA !== -1) return -1;
      if (courseIdxB !== -1) return 1;
      
      // Extract week numbers for chronological sorting
      const weekMatch = (name: string) => {
        const match = name.match(/week\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      };
      const weekA = weekMatch(a.name);
      const weekB = weekMatch(b.name);
      
      // Current week (week 4 based on semester schedule)
      const currentWeek = 4;
      
      // If both have week numbers, sort with past weeks at bottom
      if (weekA !== null && weekB !== null) {
        const isPastA = weekA < currentWeek;
        const isPastB = weekB < currentWeek;
        
        // If one is past and one is current/future, past goes last
        if (isPastA && !isPastB) return 1;
        if (!isPastA && isPastB) return -1;
        
        // If both are past or both are current/future, sort numerically
        return weekA - weekB;
      }
      // If only one has a week number, put it first
      if (weekA !== null) return -1;
      if (weekB !== null) return 1;
      // Otherwise sort alphabetically
      return a.name.localeCompare(b.name);
    });
  const oneDriveFiles = oneDriveItems.filter(item => item.type === "file");
  const oneDrivePdfFiles = oneDriveFiles.filter(item => item.mimeType?.includes("pdf"));

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
    queryFn: () => fetch(`/api/calendar/events?weekNumber=${selectedWeek}`, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }).catch(() => []),
    refetchInterval: 60000,
    retry: 2,
    retryDelay: 1000,
  });

  // Filter files for the current week (exclude completed/listened files)
  const currentWeekFiles = weeklyFiles.filter(f => 
    (f.folder?.startsWith(`week-${selectedWeek}`) || f.folder === `week-${selectedWeek}`) && !f.listened
  );

  // Semester settings query
  const { data: semesterSettings } = useQuery<SemesterSettings | null>({
    queryKey: ["/api/semester"],
    queryFn: () => fetch("/api/semester", { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    retry: 2,
    retryDelay: 1000,
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
    lastChunkIndex?: number;
    totalChunks?: number;
    checkedChunks?: string;
  }
  const { data: allFiles = [] } = useQuery<FileItem[]>({
    queryKey: ["/api/files"],
  });

  // File preview dialog state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const previewFileRef = useRef<FileItem | null>(null);
  const [oneDrivePreviewFiles, setOneDrivePreviewFiles] = useState<FileItem[]>([]);
  const [isLoadingOneDriveFiles, setIsLoadingOneDriveFiles] = useState(false);
  // Cache for file counts by folder with listened breakdown (e.g., "week-4-cppa122-module": { total: 3, listened: 1, unlistened: 2 })
  const [fileCounts, setFileCounts] = useState<Record<string, { total: number; listened: number; unlistened: number; partialProgress?: number }>>({});
  // Legacy: for backward compatibility with OneDrive-only counts
  const [oneDriveFileCounts, setOneDriveFileCounts] = useState<Record<string, number>>({});
  const [fileSelectorGlow, setFileSelectorGlow] = useState(false);
  const fileSelectorGlowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const clickedButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const triggerButtonGlow = (buttonId: string) => {
    if (clickedButtonTimeoutRef.current) {
      clearTimeout(clickedButtonTimeoutRef.current);
    }
    setClickedButton(buttonId);
    clickedButtonTimeoutRef.current = setTimeout(() => {
      setClickedButton(null);
    }, 1000);
  };
  const [previewSpeaker, setPreviewSpeaker] = useState<string>("browser_tts");
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
  const [checkedChunks, setCheckedChunks] = useState<Set<number>>(new Set());
  const checkedChunksRef = useRef<Set<number>>(new Set());
  const ttsChunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const shouldContinueRef = useRef(false);
  const ttsKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // OpenAI TTS for Fire tablets (no browser speechSynthesis)
  const openaiAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const openaiNextChunkRef = useRef<{ blob: Blob; index: number } | null>(null);
  const [isOpenAiTtsAvailable] = useState(() => !window.speechSynthesis);
  const [openaiVoice, setOpenaiVoice] = useState<"alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer">("nova");
  
  // Pre-fetch the next chunk for seamless playback
  const prefetchNextChunk = async (nextIndex: number, voice: typeof openaiVoice) => {
    if (nextIndex >= ttsChunksRef.current.length) return;
    const nextChunk = ttsChunksRef.current[nextIndex];
    if (!nextChunk) return;
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nextChunk, voice }),
      });
      if (response.ok) {
        const blob = await response.blob();
        openaiNextChunkRef.current = { blob, index: nextIndex };
      }
    } catch (err) {
      console.log('Prefetch failed, will fetch on demand');
    }
  };
  
  // Play text using OpenAI TTS (for Fire tablets and other devices without browser TTS)
  const playWithOpenAiTts = async (text: string, voice: typeof openaiVoice = openaiVoice, chunkIndex?: number) => {
    try {
      if (openaiAudioRef.current) {
        openaiAudioRef.current.onended = null;
        openaiAudioRef.current.onerror = null;
        openaiAudioRef.current.ontimeupdate = null;
        openaiAudioRef.current.pause();
        openaiAudioRef.current = null;
      }
      
      let audioBlob: Blob;
      const currentIdx = chunkIndex ?? currentChunkIndexRef.current;
      
      // Check if we have this chunk pre-fetched
      if (openaiNextChunkRef.current && openaiNextChunkRef.current.index === currentIdx) {
        audioBlob = openaiNextChunkRef.current.blob;
        openaiNextChunkRef.current = null;
      } else {
        toast({ title: "Generating speech..." });
        
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
        });
        
        if (!response.ok) {
          throw new Error('TTS generation failed');
        }
        
        audioBlob = await response.blob();
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      openaiAudioRef.current = audio;
      
      // Start pre-fetching the next chunk immediately
      if (currentIdx + 1 < ttsChunksRef.current.length) {
        prefetchNextChunk(currentIdx + 1, voice);
      }
      
      // Calculate word offset for highlighting: count words in all previous chunks
      let wordOffset = 0;
      for (let i = 0; i < currentIdx; i++) {
        wordOffset += ttsChunksRef.current[i].split(/\s+/).filter((w: string) => w.length > 0).length;
      }
      const chunkWords = text.split(/\s+/).filter(w => w.length > 0);
      const chunkWordCount = chunkWords.length;
      
      let lastSaveTime = 0;
      audio.ontimeupdate = () => {
        const now = Date.now();
        if (now - lastSaveTime > 5000) {
          lastSaveTime = now;
          const currentFile = previewFileRef.current;
          if (currentFile) {
            saveTtsProgress(currentFile.id, currentChunkIndexRef.current, 0);
          }
        }
        
        if (audio.duration && audio.duration > 0 && chunkWordCount > 0) {
          const progress = audio.currentTime / audio.duration;
          const estimatedWordIdx = Math.min(
            Math.floor(progress * chunkWordCount),
            chunkWordCount - 1
          );
          setCurrentWordIndex(wordOffset + estimatedWordIdx);
        }
      };
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentWordIndex(wordOffset + chunkWordCount - 1);
        const currentFile = previewFileRef.current;
        const chunksLen = ttsChunksRef.current.length;
        const curIdx = currentChunkIndexRef.current;
        console.log(`[TTS onended] Chunk ${curIdx + 1}/${chunksLen} ended. shouldContinue=${shouldContinueRef.current}, hasFile=${!!currentFile}`);
        autoCheckChunk(curIdx);
        if (shouldContinueRef.current && curIdx < chunksLen - 1) {
          currentChunkIndexRef.current = curIdx + 1;
          setCurrentChunkIndex(curIdx + 1);
          if (currentFile) {
            saveTtsProgress(currentFile.id, curIdx + 1, 0);
          }
          const nextChunk = ttsChunksRef.current[curIdx + 1];
          if (nextChunk) {
            console.log(`[TTS onended] Starting chunk ${curIdx + 2}/${chunksLen}`);
            playWithOpenAiTts(nextChunk, voice, curIdx + 1);
          } else {
            console.warn(`[TTS onended] Next chunk ${curIdx + 2} is empty/undefined`);
            setIsPlaying(false);
            isPlayingRef.current = false;
          }
        } else {
          console.log(`[TTS onended] Stopping. shouldContinue=${shouldContinueRef.current}, atEnd=${curIdx >= chunksLen - 1}`);
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (currentFile) {
            saveTtsProgress(currentFile.id, curIdx, 0);
          }
        }
      };
      
      audio.onerror = (e) => {
        console.error('[TTS audio.onerror]', e);
        URL.revokeObjectURL(audioUrl);
        setIsPlaying(false);
        isPlayingRef.current = false;
        toast({ title: "Audio playback failed", variant: "destructive" });
      };
      
      isPlayingRef.current = true;
      setIsPlaying(true);
      setCurrentWordIndex(wordOffset);
      try {
        await audio.play();
      } catch (playError) {
        console.warn('[TTS] audio.play() rejected, retrying with user gesture context...', playError);
        await new Promise(r => setTimeout(r, 200));
        try {
          await audio.play();
        } catch (retryError) {
          console.error('[TTS] audio.play() retry also failed', retryError);
          toast({ title: "Autoplay blocked. Tap play to continue.", variant: "destructive" });
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
      }
      
    } catch (error) {
      console.error('OpenAI TTS error:', error);
      toast({ title: "Failed to generate speech", variant: "destructive" });
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };
  
  // Stop OpenAI TTS playback
  const stopOpenAiTts = () => {
    if (openaiAudioRef.current) {
      openaiAudioRef.current.onended = null;
      openaiAudioRef.current.onerror = null;
      openaiAudioRef.current.ontimeupdate = null;
      openaiAudioRef.current.pause();
      openaiAudioRef.current = null;
    }
    shouldContinueRef.current = false;
    setIsPlaying(false);
    isPlayingRef.current = false;
  };
  
  // Save/load TTS progress for each file
  const getTtsProgress = (fileId: number): { chunkIndex: number; wordIndex: number; charPosition?: number } | null => {
    try {
      const saved = localStorage.getItem(`tts-progress-${fileId}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };
  
  const saveTtsProgress = (fileId: number, chunkIndex: number, wordIndex: number, charPosition?: number, overrideTotalChunks?: number) => {
    try {
      localStorage.setItem(`tts-progress-${fileId}`, JSON.stringify({ chunkIndex, wordIndex, charPosition: charPosition || 0 }));
      const totalChunksVal = overrideTotalChunks || ttsChunksRef.current.length;
      console.log(`[saveTtsProgress] fileId=${fileId}, chunkIndex=${chunkIndex}, totalChunks=${totalChunksVal}`);
      if (totalChunksVal > 0) {
        const isFinished = chunkIndex + 1 >= totalChunksVal;
        apiRequest("PATCH", `/api/files/${fileId}`, {
          lastChunkIndex: chunkIndex + 1,
          totalChunks: totalChunksVal,
          ...(isFinished ? { listened: true } : {}),
        }).then(() => {
          console.log(`[saveTtsProgress] PATCH success for fileId=${fileId}: lastChunkIndex=${chunkIndex + 1}, totalChunks=${totalChunksVal}`);
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          refreshFileCounts();
        }).catch((err) => {
          console.error(`[saveTtsProgress] PATCH failed for fileId=${fileId}:`, err);
        });
      } else {
        console.warn(`[saveTtsProgress] Skipped PATCH - totalChunks is 0 for fileId=${fileId}`);
      }
    } catch (e) {
      console.error('[saveTtsProgress] Error:', e);
    }
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
        // Filter to English voices only, exclude French and other languages
        const englishVoices = voices.filter(v => 
          v.lang.startsWith('en') && 
          !v.name.toLowerCase().includes('french') && 
          !v.name.toLowerCase().includes('français') &&
          !v.lang.startsWith('fr')
        ).sort((a, b) => a.name.localeCompare(b.name));
        setAvailableVoices(englishVoices);
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
  const [pdfZoom, setPdfZoom] = useState(1.10); // Default 110% zoom
  
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
  
  // Keep previewFileRef in sync with state (avoids stale closures in TTS callbacks)
  // IMPORTANT: Only update when file is set (not null) — the cleanup effect needs the old ref
  useEffect(() => {
    if (previewFile) {
      previewFileRef.current = previewFile;
    }
  }, [previewFile]);

  // Load PDF when file is selected
  useEffect(() => {
    if (previewFile && previewFile.id) {
      setPdfUrl(null);
      
      // If the objectPath is a direct HTTP URL (OneDrive download URL), proxy it
      const objectPath = previewFile.objectPath || '';
      let fetchUrl: string;
      if (objectPath.startsWith('http')) {
        fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(objectPath)}`;
      } else {
        fetchUrl = `/api/files/${previewFile.id}/download`;
      }
      
      fetch(fetchUrl, { credentials: 'include' })
        .then(res => {
          if (!res.ok) throw new Error(`Download failed: ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
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

  // Function to filter out French text, links, and box content from content
  const removeFrenchText = (text: string): string => {
    // First, remove URLs and links
    let cleanedText = text
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/www\.[^\s]+/g, '')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // Remove email addresses
      // Remove video references and box content
      .replace(/^Video\s+.+$/gm, '') // Lines starting with "Video"
      .replace(/^Audio\s+.+$/gm, '') // Lines starting with "Audio"
      .replace(/^Link\s+.+$/gm, '') // Lines starting with "Link"
      .replace(/^Watch\s+.+$/gm, '') // Lines starting with "Watch"
      .replace(/^Listen\s+.+$/gm, '') // Lines starting with "Listen"
      .replace(/^Click\s+.+$/gm, '') // Lines starting with "Click"
      .replace(/^See\s+.+$/gm, '') // Lines starting with "See"
      .replace(/^View\s+.+$/gm, '') // Lines starting with "View"
      .replace(/^Author[s]?:?\s+.+$/gim, '') // Lines starting with "Author" or "Authors"
      .replace(/\[.*?\]/g, '') // Remove bracketed content like [Video], [Link], etc.
      .replace(/\(.*?video.*?\)/gi, '') // Remove parenthetical video references
      .replace(/\(.*?link.*?\)/gi, '') // Remove parenthetical link references
      .replace(/\d+:\d+:\d+/g, '') // Remove timestamps like 1:23:45
      .replace(/\d+:\d+/g, '') // Remove timestamps like 1:23
      .replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up extra blank lines
    
    // Remove entire paragraphs containing JSTOR references
    const paragraphs = cleanedText.split(/\n\n+/);
    const filteredParagraphs = paragraphs.filter(para => {
      const lowerPara = para.toLowerCase();
      // Skip paragraphs with JSTOR, author info, or publication metadata
      if (lowerPara.includes('jstor') || 
          lowerPara.includes('stable url') ||
          lowerPara.includes('accessed:') ||
          lowerPara.includes('published by:') ||
          lowerPara.includes('all rights reserved') ||
          /^author[s]?:/i.test(para.trim())) {
        return false;
      }
      return true;
    });
    cleanedText = filteredParagraphs.join('\n\n');
    
    // Common French words/patterns to detect French sentences
    const frenchPatterns = [
      /\b(le|la|les|un|une|des|du|de la|au|aux)\b/gi,
      /\b(et|ou|mais|donc|car|ni|que|qui|dont|où)\b/gi,
      /\b(je|tu|il|elle|nous|vous|ils|elles|on)\b/gi,
      /\b(mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)\b/gi,
      /\b(ce|cet|cette|ces|ceci|cela|ça)\b/gi,
      /\b(être|avoir|faire|aller|pouvoir|vouloir|devoir|savoir)\b/gi,
      /\b(est|sont|était|étaient|sera|seront|été|suis|sommes|êtes)\b/gi,
      /\b(a|ai|as|avons|avez|ont|avait|avaient|aura|auront|eu)\b/gi,
      /\b(fait|fais|font|faisait|fera|feront)\b/gi,
      /\b(dans|sur|sous|avec|pour|par|sans|chez|entre|vers)\b/gi,
      /\b(très|plus|moins|aussi|bien|mal|peu|beaucoup|trop)\b/gi,
      /\b(français|française|france|paris)\b/gi,
      /[àâäéèêëïîôùûüÿç]/gi,
    ];
    
    // Split into sentences
    const sentences = cleanedText.split(/(?<=[.!?])\s+/);
    
    // Filter out sentences that appear to be French (contain multiple French patterns)
    const englishSentences = sentences.filter(sentence => {
      const words = sentence.split(/\s+/).length;
      if (words < 3) return true; // Keep very short sentences
      
      let frenchScore = 0;
      for (const pattern of frenchPatterns) {
        const matches = sentence.match(pattern);
        if (matches) frenchScore += matches.length;
      }
      
      // If more than 15% of words match French patterns, consider it French
      const frenchRatio = frenchScore / words;
      return frenchRatio < 0.15;
    });
    
    return englishSentences.join(' ');
  };

  // Fetch text when file is selected for preview
  useEffect(() => {
    if (previewFile) {
      setIsLoadingText(true);
      setPreviewText("");
      setCurrentWordIndex(0);
      setIsPlaying(false);
      isPlayingRef.current = false;
      // Reset speaker to Bluetooth (browser_tts) when opening a new file
      setPreviewSpeaker("browser_tts");
      // CRITICAL: Stop any existing audio to prevent double voices
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (openaiAudioRef.current) {
        openaiAudioRef.current.pause();
        openaiAudioRef.current = null;
      }
      // CRITICAL: Clear TTS chunks when file changes to prevent "Invalid chunk" errors
      // and wrong file content being played
      ttsChunksRef.current = [];
      setTtsChunks([]);
      setTotalChunks(0);
      setCurrentChunkIndex(0);
      currentChunkIndexRef.current = 0;
      shouldContinueRef.current = false;
      
      // Check if objectPath is a direct URL (OneDrive) or needs API fetch
      const isDirectUrl = previewFile.objectPath?.startsWith('http');
      
      if (isDirectUrl) {
        // Use the URL-based text extraction endpoint for OneDrive files
        fetch('/api/extract-text-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: previewFile.objectPath })
        })
          .then(res => res.json())
          .then(data => {
            if (data.text) {
              const filteredText = removeFrenchText(data.text);
              setPreviewText(filteredText);
            }
          })
          .catch(err => console.error("Error fetching text from URL:", err))
          .finally(() => setIsLoadingText(false));
      } else {
        // Use the standard file ID endpoint for local files
        fetch(`/api/files/${previewFile.id}/text`)
          .then(res => res.json())
          .then(data => {
            if (data.text) {
              const filteredText = removeFrenchText(data.text);
              setPreviewText(filteredText);
            }
          })
          .catch(err => console.error("Error fetching text:", err))
          .finally(() => setIsLoadingText(false));
      }
    } else {
      // Save progress BEFORE clearing anything — capture current state
      const closingFile = previewFileRef.current;
      const closingChunkIndex = currentChunkIndexRef.current;
      const closingTotalChunks = ttsChunksRef.current.length;
      
      // Stop any playing TTS immediately
      shouldContinueRef.current = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (openaiAudioRef.current) {
        openaiAudioRef.current.pause();
        openaiAudioRef.current = null;
      }
      
      // Save progress to DB for the file that was playing
      // Pass closingTotalChunks directly since ttsChunksRef may get cleared
      if (closingFile && closingTotalChunks > 0 && closingChunkIndex > 0) {
        let charPosition = 0;
        const closingChunks = ttsChunksRef.current;
        for (let i = 0; i < closingChunkIndex; i++) {
          charPosition += closingChunks[i]?.length || 0;
        }
        saveTtsProgress(closingFile.id, closingChunkIndex, currentWordIndex, charPosition, closingTotalChunks);
      }
      
      // Now clear everything AFTER saving
      previewFileRef.current = null;
      setPreviewText("");
      setCurrentWordIndex(0);
      setIsPlaying(false);
      isPlayingRef.current = false;
      ttsChunksRef.current = [];
      setTtsChunks([]);
      setTotalChunks(0);
      setCurrentChunkIndex(0);
      currentChunkIndexRef.current = 0;
      if (highlightIntervalRef.current) {
        clearInterval(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
    }
  }, [previewFile]);

  // Initialize TTS chunks when previewText changes - ensures display and playback use same chunks
  useEffect(() => {
    if (!previewText) {
      ttsChunksRef.current = [];
      setTtsChunks([]);
      setTotalChunks(0);
      return;
    }
    
    // Apply the same processing as TTS playback to ensure consistency
    let textForTts = previewText;
    const titlePageKeywords = /jstor|published|publisher|author[s]?:|doi:|copyright|©|issn|isbn|volume\s+\d|issue\s+\d|journal|university press|all rights reserved|accessed|stable url|abstract|keywords:|introduction\s*\n|pp\.\s*\d+|pages?\s+\d+/i;
    
    // Skip title pages
    const firstPageEnd = textForTts.indexOf('---PAGE---');
    if (firstPageEnd !== -1) {
      const firstPageContent = textForTts.substring(0, firstPageEnd).toLowerCase();
      const wordCount = firstPageContent.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 300 && titlePageKeywords.test(firstPageContent)) {
        textForTts = textForTts.substring(firstPageEnd + 10);
      }
    } else {
      const first500Words = textForTts.split(/\s+/).slice(0, 500).join(' ').toLowerCase();
      if (titlePageKeywords.test(first500Words)) {
        const skipTo = textForTts.search(/\n\n[A-Z]/);
        if (skipTo > 100 && skipTo < 2000) {
          textForTts = textForTts.substring(skipTo + 2);
        }
      }
    }
    
    // Remove page separators and apply filters
    let cleanTextForTts = textForTts.replace(/---PAGE---/g, '');
    cleanTextForTts = removeFrenchText(cleanTextForTts);
    cleanTextForTts = cleanTextForTts.replace(/[ \t]+/g, ' ');
    cleanTextForTts = cleanTextForTts.replace(/([a-z,;:])\s*\n\s*([a-z])/gi, '$1 $2');
    cleanTextForTts = cleanTextForTts.replace(/\n{3,}/g, '\n\n');
    cleanTextForTts = cleanTextForTts.replace(/^[•\-\*►▶→·]\s*/gm, '');
    cleanTextForTts = cleanTextForTts.replace(/\([^)]*?(?:\d{4}[a-z]?|pp?\.\s*\d|[A-Z][a-z]+,?\s+\d{4}|§\s*\d|[ivxlcdm]+(?:,\s*[ivxlcdm]+)*)[^)]*?\)/g, '');
    cleanTextForTts = cleanTextForTts.replace(/\(([0-9a-zA-Z.,;\s]+)\)/g, (match, inner) => {
      if (/^[\d.,;\s]+$/.test(inner.trim())) return '';
      if (/^[a-zA-Z]([.,;\s]+[a-zA-Z])*[.,;\s]*$/.test(inner.trim())) return '';
      if (/^[\d.,;\sa-zA-Z]+$/.test(inner.trim()) && inner.trim().length < 20) return '';
      return match;
    });
    cleanTextForTts = cleanTextForTts.replace(/\s{2,}/g, ' ');
    cleanTextForTts = cleanTextForTts.replace(/([^.!?\n])$/gm, '$1.');
    cleanTextForTts = cleanTextForTts.replace(/\n\n+/g, '.\n\n');
    cleanTextForTts = cleanTextForTts.replace(/\.{2,}/g, '.');
    
    // Use 2000 char chunks for display consistency
    const chunks = splitTextIntoChunks(cleanTextForTts, 2000);
    ttsChunksRef.current = chunks;
    setTtsChunks(chunks);
    setTotalChunks(chunks.length);

    // Pre-fetch the first chunk's audio for OpenAI TTS so playback starts instantly
    if (chunks.length > 0 && (previewSpeaker === "openai_tts" || !window.speechSynthesis)) {
      // Determine which chunk we'll actually start from (first unchecked)
      let startIdx = 0;
      if (previewFile?.checkedChunks) {
        try {
          const checkedSet = new Set<number>(JSON.parse(previewFile.checkedChunks));
          for (let i = 0; i < chunks.length; i++) {
            if (!checkedSet.has(i)) { startIdx = i; break; }
            if (i === chunks.length - 1) startIdx = 0;
          }
        } catch { /* ignore */ }
      }
      prefetchNextChunk(startIdx, openaiVoice);
    }

    // Pre-warm browser voices cache
    if (window.speechSynthesis && !cachedVoicesRef.current) {
      waitForVoices();
    }
  }, [previewText]);

  const getDashFileKey = () => {
    if (!previewFile) return '';
    return `file_${previewFile.id}`;
  };

  const loadDashCheckedChunks = (): Set<number> => {
    if (previewFile?.checkedChunks) {
      try {
        return new Set<number>(JSON.parse(previewFile.checkedChunks));
      } catch { /* fall through */ }
    }
    return new Set();
  };

  const saveDashCheckedChunks = (checked: Set<number>, total: number) => {
    if (!previewFile) return;
    const checkedArr = Array.from(checked);
    const checkedJson = JSON.stringify(checkedArr);
    previewFile.checkedChunks = checkedJson;
    previewFile.totalChunks = total;
    fetch(`/api/files/${previewFile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ checkedChunks: checkedJson, totalChunks: total }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    }).catch(err => console.error('Failed to save checked chunks:', err));
  };

  const toggleDashChunkChecked = (idx: number) => {
    if (!previewFile) return;
    const newChecked = new Set(checkedChunks);
    if (newChecked.has(idx)) {
      newChecked.delete(idx);
    } else {
      for (let i = 0; i <= idx; i++) {
        newChecked.add(i);
      }
    }
    setCheckedChunks(newChecked);
    checkedChunksRef.current = newChecked;
    saveDashCheckedChunks(newChecked, totalChunks);
  };

  const autoCheckChunk = (chunkIdx: number) => {
    const file = previewFileRef.current;
    if (!file) return;
    const current = new Set(checkedChunksRef.current);
    if (current.has(chunkIdx)) return;
    for (let i = 0; i <= chunkIdx; i++) {
      current.add(i);
    }
    const total = ttsChunksRef.current.length || totalChunks;
    setCheckedChunks(new Set(current));
    checkedChunksRef.current = current;
    const checkedJson = JSON.stringify(Array.from(current));
    file.checkedChunks = checkedJson;
    fetch(`/api/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ checkedChunks: checkedJson, totalChunks: total }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    }).catch(err => console.error('Failed to save auto-checked chunks:', err));
  };

  useEffect(() => {
    if (previewFile && totalChunks > 0) {
      fetch(`/api/files/${previewFile.id}`, { credentials: 'include' })
        .then(res => res.json())
        .then((freshFile: any) => {
          if (freshFile && freshFile.checkedChunks) {
            try {
              const loaded = new Set<number>(JSON.parse(freshFile.checkedChunks));
              setCheckedChunks(loaded);
              checkedChunksRef.current = loaded;
              previewFile.checkedChunks = freshFile.checkedChunks;
              previewFile.totalChunks = freshFile.totalChunks;
              return;
            } catch { /* fall through */ }
          }
          const loaded = loadDashCheckedChunks();
          setCheckedChunks(loaded);
          checkedChunksRef.current = loaded;
        })
        .catch(() => {
          const loaded = loadDashCheckedChunks();
          setCheckedChunks(loaded);
          checkedChunksRef.current = loaded;
        });
    } else {
      setCheckedChunks(new Set());
      checkedChunksRef.current = new Set();
    }
  }, [previewFile?.id, totalChunks]);

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
  const cachedVoicesRef = useRef<SpeechSynthesisVoice[] | null>(null);
  const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve([]);
        return;
      }
      if (cachedVoicesRef.current && cachedVoicesRef.current.length > 0) {
        resolve(cachedVoicesRef.current);
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        cachedVoicesRef.current = voices;
        resolve(voices);
        return;
      }
      const handleVoicesChanged = () => {
        const loadedVoices = window.speechSynthesis.getVoices();
        cachedVoicesRef.current = loadedVoices;
        resolve(loadedVoices || []);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true });
      let attempts = 0;
      const tryGetVoices = () => {
        attempts++;
        const fallbackVoices = window.speechSynthesis.getVoices() || [];
        if (fallbackVoices.length > 0 || attempts >= 5) {
          cachedVoicesRef.current = fallbackVoices;
          resolve(fallbackVoices);
        } else {
          setTimeout(tryGetVoices, 300);
        }
      };
      setTimeout(tryGetVoices, 300);
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
    const currentFile = previewFileRef.current;
    if (chunkIndex >= chunks.length || !shouldContinueRef.current) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (currentFile) {
        clearTtsProgress(currentFile.id);
        toast({ title: "Finished reading file" });
      }
      return;
    }
    
    const chunk = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = browserTtsRate;
    utterance.pitch = 1;
    
    const voice = selectedVoice 
      ? voices.find(v => v.name === selectedVoice)
      : voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) 
        || voices.find(v => v.name.includes('Microsoft') && v.name.includes('Natural'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
    if (voice) {
      utterance.voice = voice;
    }
    
    let localWordIndex = 0;
    const chunkWordCount = chunk.split(/\s+/).length;
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentWordIndex(wordOffset + localWordIndex);
        localWordIndex++;
        const fileForSave = previewFileRef.current;
        if (fileForSave && localWordIndex % 10 === 0) {
          let charPosition = 0;
          for (let i = 0; i < chunkIndex; i++) {
            charPosition += chunks[i].length;
          }
          saveTtsProgress(fileForSave.id, chunkIndex, localWordIndex, charPosition);
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
      autoCheckChunk(chunkIndex);
      if (shouldContinueRef.current) {
        setTimeout(() => {
          speakChunk(chunkIndex + 1, chunks, voices, wordOffset + chunkWordCount);
        }, 100);
      }
    };
    
    utterance.onerror = (event) => {
      console.error("Speech error:", event.error);
      if (event.error !== 'interrupted') {
        toast({ title: `Speech paused at chunk ${chunkIndex + 1}. Tap play to resume.`, variant: "default" });
        const fileForSave = previewFileRef.current;
        if (fileForSave) {
          let charPosition = 0;
          for (let i = 0; i < chunkIndex; i++) {
            charPosition += chunks[i].length;
          }
          saveTtsProgress(fileForSave.id, chunkIndex, localWordIndex, charPosition);
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
    const useBrowserTts = !!window.speechSynthesis;
    
    // Auto-switch to appropriate TTS mode
    if (useBrowserTts && previewSpeaker !== "browser_tts") {
      setPreviewSpeaker("browser_tts");
    }
    
    // Make sure we have chunks
    if (ttsChunksRef.current.length === 0) {
      // Need to split the text first
      if (!previewText) {
        toast({ title: "No text content available", variant: "destructive" });
        return;
      }
      // Detect and skip title pages (short pages with publication info like JSTOR, author, published, etc.)
      let textForTts = previewText;
      const titlePageKeywords = /jstor|published|publisher|author[s]?:|doi:|copyright|©|issn|isbn|volume\s+\d|issue\s+\d|journal|university press|all rights reserved|accessed|stable url|abstract|keywords:|introduction\s*\n|pp\.\s*\d+|pages?\s+\d+/i;
      
      const firstPageEnd = textForTts.indexOf('---PAGE---');
      if (firstPageEnd !== -1) {
        const firstPageContent = textForTts.substring(0, firstPageEnd).toLowerCase();
        const wordCount = firstPageContent.split(/\s+/).filter(w => w.length > 0).length;
        // Check if first page looks like a title page (short + contains publication keywords)
        if (wordCount < 300 && titlePageKeywords.test(firstPageContent)) {
          textForTts = textForTts.substring(firstPageEnd + 10); // Skip past first ---PAGE---
          console.log("Skipped title page (via PAGE marker)");
        }
      } else {
        // No page markers - check beginning of text for title page patterns
        const first500Words = textForTts.split(/\s+/).slice(0, 500).join(' ').toLowerCase();
        if (titlePageKeywords.test(first500Words)) {
          // Find first paragraph break after initial content
          const skipTo = textForTts.search(/\n\n[A-Z]/);
          if (skipTo > 100 && skipTo < 2000) {
            textForTts = textForTts.substring(skipTo + 2);
            console.log("Skipped title content (no page markers)");
          }
        }
      }
      // First remove page separators
      let cleanTextForTts = textForTts.replace(/---PAGE---/g, '');
      // Apply the same filters used for display - removes French, URLs, timestamps, video/audio refs
      cleanTextForTts = removeFrenchText(cleanTextForTts);
      // Normalize whitespace and line breaks
      cleanTextForTts = cleanTextForTts.replace(/[ \t]+/g, ' ');
      cleanTextForTts = cleanTextForTts.replace(/([a-z,;:])\s*\n\s*([a-z])/gi, '$1 $2');
      cleanTextForTts = cleanTextForTts.replace(/\n{3,}/g, '\n\n');
      // Remove bullet point characters so TTS doesn't say "bullet"
      cleanTextForTts = cleanTextForTts.replace(/^[•\-\*►▶→·]\s*/gm, '');
      // Add slight pauses after lines that were bullet points (add period if line doesn't end with punctuation)
      cleanTextForTts = cleanTextForTts.replace(/([^.!?\n])$/gm, '$1.');
      // Add longer pause after paragraph breaks (double newline becomes period + pause)
      cleanTextForTts = cleanTextForTts.replace(/\n\n+/g, '.\n\n');
      // Clean up duplicate periods
      cleanTextForTts = cleanTextForTts.replace(/\.{2,}/g, '.');
      // Use larger chunks for OpenAI TTS (4000 chars) vs browser TTS (2000 chars)
      const chunkSize = useBrowserTts ? 2000 : 4000;
      const chunks = splitTextIntoChunks(cleanTextForTts, chunkSize);
      ttsChunksRef.current = chunks;
      setTtsChunks(chunks);
      setTotalChunks(chunks.length);
    }
    
    const chunks = ttsChunksRef.current;
    if (chunks.length === 0) {
      toast({ title: "No chunks available", variant: "destructive" });
      return;
    }
    // Clamp chunk index to valid range instead of erroring
    let validChunkIndex = chunkIndex;
    if (chunkIndex >= chunks.length) {
      validChunkIndex = Math.max(0, chunks.length - 1);
      toast({ title: `Adjusted to section ${validChunkIndex + 1} of ${chunks.length}` });
    }
    
    // CRITICAL: Cancel ALL current speech to prevent double voices
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    stopOpenAiTts();
    shouldContinueRef.current = false;
    setIsPlaying(false);
    isPlayingRef.current = false;
    await new Promise(r => setTimeout(r, 150)); // Slightly longer wait to ensure complete stop
    
    // Start playing from this chunk
    setCurrentChunkIndex(validChunkIndex);
    currentChunkIndexRef.current = validChunkIndex;
    shouldContinueRef.current = true;
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    toast({ title: `Playing from section ${validChunkIndex + 1} of ${chunks.length}` });
    
    if (useBrowserTts) {
      // Wait for voices
      const voices = await waitForVoices();
      if (voices.length === 0) {
        toast({ title: "No TTS voices found", variant: "destructive" });
        return;
      }
      
      // Calculate word offset for highlighting
      let wordOffset = 0;
      for (let i = 0; i < validChunkIndex; i++) {
        wordOffset += chunks[i].split(/\s+/).length;
      }
      
      speakChunk(validChunkIndex, chunks, voices, wordOffset);
    } else {
      // Use OpenAI TTS for Fire tablets and devices without browser TTS
      const chunk = chunks[validChunkIndex];
      await playWithOpenAiTts(chunk, openaiVoice);
    }
  };

  const handlePlayFile = async (fileUrl: string, fileName: string, resumeFromProgress: boolean = false) => {
    try {
      // Check TTS availability
      const useBrowserTts = !!window.speechSynthesis;
      
      // Check if using browser TTS only
      if (previewSpeaker === "browser_tts" || previewSpeaker === "openai_tts") {
        if (!previewText) {
          toast({ title: "No text content available", variant: "destructive" });
          return;
        }
        
        // CRITICAL: Cancel ALL existing speech to prevent double voices
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        stopOpenAiTts();
        shouldContinueRef.current = false;
        setIsPlaying(false);
        isPlayingRef.current = false;
        await new Promise(r => setTimeout(r, 50));
        
        // Use pre-initialized chunks if available (from useEffect), otherwise create them
        let chunks = ttsChunksRef.current;
        if (chunks.length === 0) {
          // Fallback: create chunks if not yet initialized
          let textForTts = previewText;
          const titlePageKeywords = /jstor|published|publisher|author[s]?:|doi:|copyright|©|issn|isbn|volume\s+\d|issue\s+\d|journal|university press|all rights reserved|accessed|stable url|abstract|keywords:|introduction\s*\n|pp\.\s*\d+|pages?\s+\d+|supplementary|appendix|supporting information|online resource|electronic supplementary|table of contents|references\s*\n|bibliography|citation/i;
          
          const firstPageEnd = textForTts.indexOf('---PAGE---');
          if (firstPageEnd !== -1) {
            const firstPageContent = textForTts.substring(0, firstPageEnd).toLowerCase();
            const wordCount = firstPageContent.split(/\s+/).filter(w => w.length > 0).length;
            if (wordCount < 500 && titlePageKeywords.test(firstPageContent)) {
              textForTts = textForTts.substring(firstPageEnd + 10);
            }
          } else {
            const first500Words = textForTts.split(/\s+/).slice(0, 500).join(' ').toLowerCase();
            if (titlePageKeywords.test(first500Words)) {
              const skipTo = textForTts.search(/\n\n[A-Z]/);
              if (skipTo > 100 && skipTo < 3000) {
                textForTts = textForTts.substring(skipTo + 2);
              }
            }
          }
          let cleanTextForTts = textForTts.replace(/---PAGE---/g, '');
          cleanTextForTts = removeFrenchText(cleanTextForTts);
          cleanTextForTts = cleanTextForTts.replace(/[ \t]+/g, ' ');
          cleanTextForTts = cleanTextForTts.replace(/([a-z,;:])\s*\n\s*([a-z])/gi, '$1 $2');
          cleanTextForTts = cleanTextForTts.replace(/\n{3,}/g, '\n\n');
          cleanTextForTts = cleanTextForTts.replace(/^[•\-\*►▶→·]\s*/gm, '');
          cleanTextForTts = cleanTextForTts.replace(/([^.!?\n])$/gm, '$1.');
          cleanTextForTts = cleanTextForTts.replace(/\n\n+/g, '.\n\n');
          cleanTextForTts = cleanTextForTts.replace(/\.{2,}/g, '.');
          const chunkSize = useBrowserTts ? 2000 : 4000;
          chunks = splitTextIntoChunks(cleanTextForTts, chunkSize);
          
          ttsChunksRef.current = chunks;
          setTtsChunks(chunks);
          setTotalChunks(chunks.length);
        }
        
        // Check for saved progress (localStorage first, then DB fallback)
        let startChunk = 0;
        let startWordOffset = 0;
        
        if (!resumeFromProgress && previewFile) {
          const checkedSet = checkedChunksRef.current;
          if (checkedSet.size > 0) {
            for (let i = 0; i < chunks.length; i++) {
              if (!checkedSet.has(i)) {
                startChunk = i;
                break;
              }
              if (i === chunks.length - 1) {
                startChunk = 0;
              }
            }
            if (startChunk > 0) {
              for (let i = 0; i < startChunk; i++) {
                startWordOffset += chunks[i].split(/\s+/).length;
              }
              toast({ title: `Starting from section ${startChunk + 1} of ${chunks.length}` });
            }
          }
        }
        
        if (resumeFromProgress && previewFile) {
          const progress = getTtsProgress(previewFile.id);
          if (progress) {
            if (progress.charPosition && progress.charPosition > 0) {
              let charCount = 0;
              for (let i = 0; i < chunks.length; i++) {
                charCount += chunks[i].length;
                if (charCount >= progress.charPosition) {
                  startChunk = i;
                  break;
                }
              }
              startChunk = Math.min(startChunk, chunks.length - 1);
            } else {
              startChunk = Math.min(progress.chunkIndex, chunks.length - 1);
            }
            for (let i = 0; i < startChunk; i++) {
              startWordOffset += chunks[i].split(/\s+/).length;
            }
            toast({ title: `Resuming from chunk ${startChunk + 1} of ${chunks.length}` });
          } else if (previewFile.lastChunkIndex && previewFile.lastChunkIndex > 0 && previewFile.totalChunks && previewFile.totalChunks > 0) {
            // Fallback: use DB-stored progress (lastChunkIndex is 1-indexed, convert to 0-indexed)
            startChunk = Math.min(previewFile.lastChunkIndex, chunks.length - 1);
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
        if (useBrowserTts) {
          // Wait for voices to load
          const voices = await waitForVoices();
          console.log("Available voices:", voices.length);
          
          if (voices.length === 0) {
            toast({ title: "No TTS voices found. Make sure Chrome has TTS enabled.", variant: "destructive" });
            setIsPlaying(false);
            return;
          }
          speakChunk(startChunk, chunks, voices, startWordOffset);
        } else {
          // Use OpenAI TTS for Fire tablets and devices without browser TTS
          const chunk = chunks[startChunk];
          await playWithOpenAiTts(chunk, openaiVoice);
        }
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
      // IMMEDIATE: Stop any OpenAI TTS audio first (for Fire tablets)
      // This check comes first for faster response on Fire tablets
      if (openaiAudioRef.current) {
        shouldContinueRef.current = false; // Stop chunk chain immediately
        openaiAudioRef.current.pause();
        openaiAudioRef.current.currentTime = 0;
        openaiAudioRef.current = null;
        
        // Save progress so user can resume later
        const stopFile = previewFileRef.current;
        if (stopFile) {
          let charPosition = 0;
          const chunks = ttsChunksRef.current;
          for (let i = 0; i < currentChunkIndexRef.current; i++) {
            charPosition += chunks[i]?.length || 0;
          }
          saveTtsProgress(stopFile.id, currentChunkIndexRef.current, currentWordIndex, charPosition);
        }
        
        setIsPlaying(false);
        isPlayingRef.current = false;
        toast({ title: `Stopped at section ${currentChunkIndexRef.current + 1} of ${totalChunks}. Progress saved.` });
        return;
      }
      
      // Stop browser TTS if active
      if (previewSpeaker === "browser_tts" && window.speechSynthesis) {
        shouldContinueRef.current = false; // Stop chunk chain
        window.speechSynthesis.cancel();
        
        // Save progress so user can resume later
        const stopFile = previewFileRef.current;
        if (stopFile) {
          let charPosition = 0;
          const chunks = ttsChunksRef.current;
          for (let i = 0; i < currentChunkIndexRef.current; i++) {
            charPosition += chunks[i]?.length || 0;
          }
          saveTtsProgress(stopFile.id, currentChunkIndexRef.current, currentWordIndex, charPosition);
          toast({ title: `Paused at section ${currentChunkIndexRef.current + 1} of ${totalChunks}. Progress saved.` });
        }
        
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
      
      // For Echo speakers - call API (non-blocking for responsiveness)
      fetch("/api/media/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: previewSpeaker }),
      }).catch(err => console.error("Stop API error:", err));
      
      // Stop word highlighting when audio stops
      stopHighlighting();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } catch (error) {
      console.error("Stop error:", error);
    }
  };

  // Skip forward/back functions for browser TTS, OpenAI TTS, and Echo
  const handleSkipForward = async () => {
    // For OpenAI TTS on Fire tablets - skip to next chunk
    if (previewSpeaker === "openai_tts" || (!window.speechSynthesis && openaiAudioRef.current)) {
      const chunks = ttsChunksRef.current;
      if (chunks.length === 0) return;
      
      const nextChunk = Math.min(currentChunkIndexRef.current + 1, chunks.length - 1);
      if (nextChunk === currentChunkIndexRef.current) {
        toast({ title: "Already at last section" });
        return;
      }
      
      // Stop current audio and play next chunk
      if (openaiAudioRef.current) {
        openaiAudioRef.current.pause();
        openaiAudioRef.current = null;
      }
      
      currentChunkIndexRef.current = nextChunk;
      setCurrentChunkIndex(nextChunk);
      toast({ title: `Skipped to section ${nextChunk + 1} of ${chunks.length}` });
      
      if (isPlayingRef.current) {
        shouldContinueRef.current = true;
        await playWithOpenAiTts(chunks[nextChunk], openaiVoice, nextChunk);
      }
      return;
    }
    
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
    // For OpenAI TTS on Fire tablets - skip to previous chunk
    if (previewSpeaker === "openai_tts" || (!window.speechSynthesis && openaiAudioRef.current)) {
      const chunks = ttsChunksRef.current;
      if (chunks.length === 0) return;
      
      const prevChunk = Math.max(currentChunkIndexRef.current - 1, 0);
      if (prevChunk === currentChunkIndexRef.current) {
        toast({ title: "Already at first section" });
        return;
      }
      
      // Stop current audio and play previous chunk
      if (openaiAudioRef.current) {
        openaiAudioRef.current.pause();
        openaiAudioRef.current = null;
      }
      
      currentChunkIndexRef.current = prevChunk;
      setCurrentChunkIndex(prevChunk);
      toast({ title: `Skipped to section ${prevChunk + 1} of ${chunks.length}` });
      
      if (isPlayingRef.current) {
        shouldContinueRef.current = true;
        await playWithOpenAiTts(chunks[prevChunk], openaiVoice, prevChunk);
      }
      return;
    }
    
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
      
      // For OpenAI TTS on Fire tablets - adjust audio element volume
      if (previewSpeaker === "openai_tts" || (!window.speechSynthesis && openaiAudioRef.current)) {
        if (openaiAudioRef.current) {
          const currentVolume = openaiAudioRef.current.volume;
          const newVolume = action === "up" 
            ? Math.min(currentVolume + 0.1, 1) 
            : Math.max(currentVolume - 0.1, 0);
          openaiAudioRef.current.volume = newVolume;
          setRadioVolume(Math.round(newVolume * 100));
          toast({ title: `Volume: ${Math.round(newVolume * 100)}%` });
        }
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
    semesterType: "spring_summer" as string,
    semesterStartDate: "2026-05-04",
    semesterEndDate: "2026-08-07",
    course1Code: "",
    course1Name: "",
    course1Professor: "",
    course1ProfessorEmail: "",
    course1DeliveryMode: "" as string,
    course1ClassDay: "" as string,
    course1ClassDay2: "" as string,
    course1ClassTime: "",
    course1ClassEndTime: "",
    course1StartDate: "",
    course1EndDate: "",
    course1SpringSummerTerm: "full" as string,
    course2Code: "",
    course2Name: "",
    course2Professor: "",
    course2ProfessorEmail: "",
    course2DeliveryMode: "" as string,
    course2ClassDay: "" as string,
    course2ClassDay2: "" as string,
    course2ClassTime: "",
    course2ClassEndTime: "",
    course2StartDate: "",
    course2EndDate: "",
    course2SpringSummerTerm: "full" as string,
    course3Code: "",
    course3Name: "",
    course3Professor: "",
    course3ProfessorEmail: "",
    course3DeliveryMode: "" as string,
    course3ClassDay: "" as string,
    course3ClassDay2: "" as string,
    course3ClassTime: "",
    course3ClassEndTime: "",
    course3StartDate: "",
    course3EndDate: "",
    course3SpringSummerTerm: "full" as string,
    secondaryCalendarId: "",
  });
  
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [showAllDayRow, setShowAllDayRow] = useState<boolean>(() => {
    const saved = localStorage.getItem('showAllDayRow');
    return saved !== null ? JSON.parse(saved) : false;
  });
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
        setCompletedTaskHistory(prev => {
          const newHistory = [variables.id, ...prev].slice(0, 10); // Keep max 10
          localStorage.setItem('completedTaskHistory', JSON.stringify(newHistory));
          return newHistory;
        });
        setShowCelebration(true);
      }
    },
  });

  const handleUndoComplete = () => {
    if (completedTaskHistory.length > 0) {
      const [taskToUndo, ...rest] = completedTaskHistory;
      completeMutation.mutate({ id: taskToUndo, isCompleted: false });
      setCompletedTaskHistory(rest);
      localStorage.setItem('completedTaskHistory', JSON.stringify(rest));
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
      const payload: Record<string, any> = {
        semesterName: data.semesterName,
        semesterType: data.semesterType,
        semesterStartDate: new Date(data.semesterStartDate).toISOString(),
        semesterEndDate: data.semesterEndDate ? new Date(data.semesterEndDate).toISOString() : null,
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
      };
      ['course1', 'course2', 'course3'].forEach(prefix => {
        payload[`${prefix}DeliveryMode`] = (data as any)[`${prefix}DeliveryMode`] || null;
        payload[`${prefix}ClassDay`] = (data as any)[`${prefix}ClassDay`] || null;
        payload[`${prefix}ClassDay2`] = (data as any)[`${prefix}ClassDay2`] || null;
        payload[`${prefix}ClassTime`] = (data as any)[`${prefix}ClassTime`] || null;
        payload[`${prefix}ClassEndTime`] = (data as any)[`${prefix}ClassEndTime`] || null;
        payload[`${prefix}SpringSummerTerm`] = (data as any)[`${prefix}SpringSummerTerm`] || null;
        const startVal = (data as any)[`${prefix}StartDate`];
        const endVal = (data as any)[`${prefix}EndDate`];
        payload[`${prefix}StartDate`] = startVal ? new Date(startVal).toISOString() : null;
        payload[`${prefix}EndDate`] = endVal ? new Date(endVal).toISOString() : null;
      });
      return apiRequest("POST", "/api/semester", payload);
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
      refreshFileCounts();
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

  // Project mutations for flyout
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string; status?: string; courseName?: string; startDate?: string; targetDate?: string; priority?: string; notes?: string }) => {
      return await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; description?: string; color?: string; status?: string; courseName?: string; startDate?: string; targetDate?: string; priority?: string; notes?: string } }) => {
      return await apiRequest("PATCH", `/api/projects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
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

  // Helper to check if a task is a CASL101 (ASL) class
  const isCASL101Task = (task: Task) => {
    const courseName = task.courseName?.toUpperCase() || "";
    return courseName.startsWith("CASL101") || courseName.startsWith("CASL 101");
  };

  // Helper to check if a CASL101 task's time has passed (should be auto-hidden)
  const isCASL101Finished = (task: Task) => {
    if (!isCASL101Task(task)) return false;
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    if (task.eventEndTime) {
      // If task has an end time, check if it's passed
      const [endHour, endMin] = task.eventEndTime.split(':').map(Number);
      dueDate.setHours(endHour, endMin, 0, 0);
    }
    return now > dueDate;
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
    if (isCASL101Finished(t)) return false; // Auto-hide finished CASL101 tasks
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
    if (isCASL101Finished(t)) return false; // Auto-hide finished CASL101 tasks
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
  
  // One Week Ahead: tasks due in the 7 days starting from today
  const thisWeekStart = startOfDay(today);
  const thisWeekEnd = addDays(thisWeekStart, 6); // 7 days total (inclusive)
  const dueThisWeekTasks = allTasks.filter(t => {
    if (t.isMissed || t.isCompleted) return false;
    if (isCASL101Finished(t)) return false;
    if (!t.dueDate) return false;
    const dueDateStart = startOfDay(new Date(t.dueDate));
    return dueDateStart >= thisWeekStart && dueDateStart <= thisWeekEnd;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Measure first row positions after render for second row alignment
  // IMPORTANT: Does NOT depend on dueThisWeekTasks - positions only update on resize handle changes
  useEffect(() => {
    const measurePositions = () => {
      if (row1ContainerRef.current && row1TaskRef.current && row1CodeRef.current && row1CourseRef.current && row1DueRef.current) {
        const containerRect = row1ContainerRef.current.getBoundingClientRect();
        const containerLeft = containerRect.left;
        const containerTop = containerRect.top;
        setRow1Positions(prev => ({
          task: row1TaskRef.current!.getBoundingClientRect().left - containerLeft,
          code: row1CodeRef.current!.getBoundingClientRect().left - containerLeft,
          course: row1CourseRef.current!.getBoundingClientRect().left - containerLeft,
          due: row1DueRef.current ? row1DueRef.current.getBoundingClientRect().left - containerLeft : prev.due,
          days: row1DaysRef.current ? row1DaysRef.current.getBoundingClientRect().left - containerLeft : prev.days,
          progressBar: row1ProgressBarRef.current ? row1ProgressBarRef.current.getBoundingClientRect().left - containerLeft : prev.progressBar,
          progressBarTop: row1ProgressBarRef.current ? row1ProgressBarRef.current.getBoundingClientRect().top - containerTop : prev.progressBarTop
        }));
      }
    };
    const timer = setTimeout(measurePositions, 100);
    window.addEventListener('resize', measurePositions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measurePositions);
    };
  }, []);

  // Track calendar wrapper and course rows positions for course button alignment
  useEffect(() => {
    const updatePositions = () => {
      // Don't update during resize to prevent buttons from jumping
      if (isResizingThisWeek) return;
      if (calendarWrapperRef.current) {
        const rect = calendarWrapperRef.current.getBoundingClientRect();
        setCalendarTop(rect.top + window.scrollY);
        setCalendarRight(window.innerWidth - rect.right);
        setCalendarLeft(rect.left);
      }
      if (clockContainerRef.current) {
        setClockWidth(clockContainerRef.current.offsetWidth);
      }
      // Also track course rows container position directly
      if (courseRowsRef.current) {
        const rect = courseRowsRef.current.getBoundingClientRect();
        setCourseRowsTop(rect.top + window.scrollY);
      }
      // Track all day row height and update gridSizes if it has grown
      if (allDayRowRef.current) {
        const actualHeight = allDayRowRef.current.offsetHeight;
        if (actualHeight > gridSizes.allDayRowHeight) {
          setGridSizes(prev => ({ ...prev, allDayRowHeight: actualHeight }));
        }
      }
    };
    updatePositions();
    // Use requestAnimationFrame for smoother updates
    let rafId: number;
    const rafUpdatePositions = () => {
      if (isResizingThisWeek) return;
      rafId = requestAnimationFrame(() => {
        updatePositions();
      });
    };
    window.addEventListener('resize', rafUpdatePositions);
    const observer = new ResizeObserver(rafUpdatePositions);
    if (calendarWrapperRef.current) {
      observer.observe(calendarWrapperRef.current);
    }
    if (courseRowsRef.current) {
      observer.observe(courseRowsRef.current);
    }
    if (allDayRowRef.current) {
      observer.observe(allDayRowRef.current);
    }
    // Also observe the parent container for height changes
    const taskBoxesContainer = document.querySelector('[data-task-boxes-container]');
    if (taskBoxesContainer) {
      observer.observe(taskBoxesContainer);
    }
    return () => {
      window.removeEventListener('resize', rafUpdatePositions);
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [dueTodayTasks.length, dueTomorrowTasks.length, dueThisWeekTasks.length, modulesHoneycombOpen, isResizingThisWeek, gridSizes.allDayRowHeight]);
  
  // Calculate shared row heights for consistent sizing between Urgent and Overdue boxes
  const cppa122Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CPPA122")).length, missedTasks.filter(t => t.courseName?.startsWith("CPPA122")).length) * 64;
  const cfnf400Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CFNF400")).length, missedTasks.filter(t => t.courseName?.startsWith("CFNF400")).length) * 64;
  const casl101Height = 18 + Math.max(1, todayTasks.filter(t => t.courseName?.startsWith("CASL101")).length, missedTasks.filter(t => t.courseName?.startsWith("CASL101")).length) * 64;

  // Weekly view - get the current selected week's days
  const selectedWeekInfo = weeks.find(w => w.weekNumber === selectedWeek);
  // Parse YYYY-MM-DD dates as local dates at noon to avoid any edge cases
  const parseAsLocalDate = (dateStr: string) => {
    // Handle both YYYY-MM-DD and full ISO strings
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // noon local time
  };
  const weekStartDate = selectedWeekInfo ? parseAsLocalDate(selectedWeekInfo.startDate) : new Date(2026, 0, 17, 12);
  const weekEndDate = selectedWeekInfo ? parseAsLocalDate(selectedWeekInfo.endDate) : new Date(2026, 0, 23, 12);
  
  // Generate weekdays for the weekly view
  // School week runs Saturday to Friday, but we display Sunday-Saturday visually
  // Logic:
  // - On Sunday through Friday: Saturday column shows the upcoming Saturday (end of this school week)
  // - On Saturday: Sunday-Friday columns show NEXT week's dates
  const currentDate = new Date();
  const currentDayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
  const isTodaySaturday = currentDayOfWeek === 6;
  
  // Get the raw days from the school week (Saturday to Friday)
  // IMPORTANT: eachDayOfInterval resets times to midnight, which can cause timezone issues
  // (e.g., midnight UTC = previous day in EST). Normalize all dates to noon local time.
  const rawWeekDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate }).map(d => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  });
  
  let weekDays: Date[];
  if (rawWeekDays.length >= 7) {
    // Ensure we only use first 7 days to avoid timezone edge cases
    const sevenDays = rawWeekDays.slice(0, 7);
    // rawWeekDays[0] = Saturday (start of school week), rawWeekDays[1-6] = Sun-Fri
    if (isTodaySaturday) {
      // On Saturday: Show the full school week starting today (Sat, Sun, Mon, Tue, Wed, Thu, Fri)
      // rawWeekDays already has [Sat, Sun, Mon, Tue, Wed, Thu, Fri] - just reorder to put Sat at end for display
      const saturdayDate = sevenDays[0]; // Current Saturday (today)
      const sunToFri = sevenDays.slice(1); // Sun through Fri of THIS week
      weekDays = [...sunToFri, saturdayDate];
    } else {
      // On Sunday-Friday: Show current week with UPCOMING Saturday at end
      // Saturday should be the UPCOMING Saturday (Friday + 1 day)
      const upcomingSaturday = addDays(sevenDays[6], 1); // Friday + 1 = Saturday
      weekDays = [...sevenDays.slice(1), upcomingSaturday];
    }
  } else {
    weekDays = rawWeekDays.slice(0, 7); // Safety limit
  }
  
  // Time slots for the day view - show all 24 hours when travelling, otherwise 6am-11pm
  const isTravelMode = !!(schoolData.isTravelling || profileData.travelTimezone);
  const calStart = isTravelMode ? 0 : 6;
  const timeSlots = isTravelMode
    ? Array.from({ length: 24 }, (_, i) => i) // 12am-11pm (0-23)
    : Array.from({ length: 16 }, (_, i) => i + 6); // 6am-9pm (6-21)
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to current time by default
  useEffect(() => {
    if (calendarView !== "week") return;
    
    const scrollToCurrentTime = () => {
      if (!calendarScrollRef.current) return;
      
      const now = new Date();
      const currentHour = now.getHours();
      const calStartHour = isTravelMode ? 0 : 6;
      
      // Calculate scroll position to show the entire current hour row at the top
      let scrollPosition = 0;
      for (let h = calStartHour; h < currentHour && h < 24; h++) {
        scrollPosition += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
      }
      
      calendarScrollRef.current.scrollTop = Math.max(0, scrollPosition);
    };
    
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToCurrentTime);
    });
  }, [calendarView, gridSizes]);

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
          if (courseCode === "CPPA122") color = "#47B045";
          else if (courseCode === "CFNF400") color = "#FA67B3";
          else if (courseCode === "CASL101") color = "#818cf8";
          
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
      if (isCASL101Finished(t)) return false; // Auto-hide finished CASL101 tasks
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
      if (isCASL101Finished(t)) return false; // Auto-hide finished CASL101 tasks
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
      if (isCASL101Finished(t)) return false; // Auto-hide finished CASL101 tasks
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
      
      // Return task data - actual position will be calculated at render time
      // to properly account for prep conflict heights
      return { task: t, dayIdx, startHour, startMin, endHour, endMin };
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
  
  // Get all-day tasks (tasks without specific time - only midnight)
  const getAllDayTasks = (day: Date) => {
    return allTasks.filter(t => {
      if (t.isCompleted) return false; // Completed tasks don't show on calendar
      if (isCASL101Finished(t)) return false; // Auto-hide finished CASL101 tasks
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

  // Get projects with targetDate on a specific day
  const getProjectsForDay = (day: Date) => {
    return allProjects.filter(p => p.targetDate && isSameDay(new Date(p.targetDate), day));
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
      className="flex h-screen flex-col overflow-hidden relative"
      style={{ 
        backgroundImage: `url(${dashboardBg})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minWidth: '1024px'
      }}
    >
      {/* Main Background Color Overlay */}
      {colorSettings.mainBackgroundOverlay && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            backgroundColor: colorSettings.mainBackground,
            zIndex: 1
          }}
        />
      )}
      {/* Loading overlay for OneDrive file fetching */}
      {isLoadingOneDriveFiles && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent" />
            <span className="text-gray-700 font-medium">Loading files from OneDrive...</span>
          </div>
        </div>
      )}
      {/* Dynamic CSS for blink speed */}
      <style>{`
        .animate-file-box-blink-fast {
          animation: file-box-blink ${blinkSettings.taskBoxFilesBlinkSpeed}s ease-in-out infinite !important;
        }
        .animate-file-blink {
          animation: file-blink ${blinkSettings.allDayFilesBlinkSpeed}s ease-in-out infinite !important;
        }
        .animate-today-date {
          animation: today-date-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
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

      {/* Partner Away Popup - Kitchen Reading Prompt */}
      <Dialog open={showPartnerAwayPopup} onOpenChange={(open) => {
        if (!open) handleDismissPartnerPopup(); // Any close action dismisses for 4 hours
      }}>
        <DialogContent className="max-w-[340px] p-4 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-white">
              <Volume2 className="h-5 w-5 text-blue-400" />
              Play Readings?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-white/80 py-3">
            Your partner is at work. Would you like to play your readings on the Kitchen Echo?
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={handleDismissPartnerPopup}
              data-testid="button-dismiss-partner-popup"
            >
              No, not now
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleKitchenReadingTrigger}
              disabled={isKitchenReadingLoading}
              data-testid="button-play-kitchen-reading"
            >
              {isKitchenReadingLoading ? 'Starting...' : 'Yes, play readings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Readings Popup Dialog - OneDrive Files */}
      <Dialog open={!!readingsPopupCourse} onOpenChange={(open) => !open && setReadingsPopupCourse(null)}>
        <DialogContent className="max-w-[420px] p-4 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-white">
              <FolderOpen 
                className={`h-4 w-4 ${readingsPopupCourse === 'cppa122' ? 'text-green-400 fill-green-200/50' : readingsPopupCourse === 'cfnf400' ? 'text-pink-400 fill-pink-200/50' : 'text-indigo-400 fill-indigo-200/50'}`} 
                strokeWidth={1.5}
              />
              {readingsPopupCourse === 'cppa122' ? 'CPPA122 Local Politics and Government' : readingsPopupCourse === 'cfnf400' ? 'CFNF400 Human Sexuality' : 'CASL101 Sign Language'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-white/60 mb-2">Week {selectedWeek} Readings</div>
          <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto">
            {oneDriveReadingFiles.map(file => {
              const fullName = file.name || '';
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
              const fileKey = file.path || file.id;
              const isListened = listenedOneDriveFiles.has(fileKey);
              
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 cursor-pointer"
                  data-testid={`reading-file-onedrive-${file.id}`}
                  onClick={() => {
                    if (file.downloadUrl) {
                      // Mark as listened and open in PDF reader
                      const newListened = new Set(listenedOneDriveFiles);
                      newListened.add(fileKey);
                      setListenedOneDriveFiles(newListened);
                      localStorage.setItem('listenedOneDriveFiles', JSON.stringify(Array.from(newListened)));
                      setReadingsPopupCourse(null);
                      window.location.href = `/pdf-reader/onedrive?url=${encodeURIComponent(file.downloadUrl)}&name=${encodeURIComponent(file.name)}`;
                    }
                  }}
                >
                  <Checkbox
                    checked={isListened}
                    onCheckedChange={(checked) => {
                      const newListened = new Set(listenedOneDriveFiles);
                      if (checked) {
                        newListened.add(fileKey);
                      } else {
                        newListened.delete(fileKey);
                      }
                      setListenedOneDriveFiles(newListened);
                      localStorage.setItem('listenedOneDriveFiles', JSON.stringify(Array.from(newListened)));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    data-testid={`checkbox-reading-onedrive-${file.id}`}
                  />
                  <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span 
                    className={`text-[11px] ${isListened ? 'text-white/40 line-through' : 'text-white'}`}
                  >
                    {cleanName || fullName}
                  </span>
                </div>
              );
            })}
            {oneDriveReadingFiles.length === 0 && (
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

      {/* Upload Files Dialog - Windows Explorer Style */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-4xl h-[70vh] p-0 overflow-hidden bg-[#1e1e1e] border border-[#3c3c3c] text-white shadow-2xl">
          {/* Title Bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#323232] border-b border-[#3c3c3c]">
            <Upload className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Upload Files</span>
          </div>
          
          {/* Address Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c]">
            <div className="flex items-center gap-1 px-2 py-1 bg-[#3c3c3c] rounded text-xs flex-1">
              <Folder className="h-3 w-3 text-yellow-500" />
              <span className="text-white/80">{uploadTargetFolder || 'Select a folder...'}</span>
            </div>
          </div>
          
          <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100% - 80px)' }}>
            {/* Left Panel - Folder Tree */}
            <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="p-2">
                {/* Root folder */}
                <div className="flex items-center gap-1 py-1 px-1 text-white/90 text-sm font-medium">
                  <Folder className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                  <span>Course Files</span>
                </div>
                
                {/* Week folders */}
                {Array.from({ length: 13 }, (_, i) => i + 1).map(weekNum => {
                  const weekId = `upload-week-${weekNum}`;
                  const isWeekExpanded = flyoutExpandedFolders.has(weekId);
                  
                  return (
                    <div key={weekNum} className="ml-2">
                      {/* Week row */}
                      <div 
                        className="flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer"
                        onClick={() => toggleFlyoutFolder(weekId)}
                        onContextMenu={(e) => handleFolderContextMenu(e, `week-${weekNum}`)}
                        data-testid={`folder-week-${weekNum}`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          {isWeekExpanded ? (
                            <ChevronDown className="h-3 w-3 text-white/60" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-white/60" />
                          )}
                        </div>
                        {isWeekExpanded ? (
                          <FolderOpen className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                        ) : (
                          <Folder className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                        )}
                        <span className="text-xs text-white/80">Week {weekNum}</span>
                      </div>
                      
                      {/* Course folders inside week */}
                      {isWeekExpanded && (
                        <div className="ml-4">
                          {/* CPPA122 */}
                          {(() => {
                            const courseId = `upload-week-${weekNum}-cppa122`;
                            const isCourseExpanded = flyoutExpandedFolders.has(courseId);
                            return (
                              <div>
                                <div 
                                  className="flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer"
                                  onClick={() => toggleFlyoutFolder(courseId)}
                                  onContextMenu={(e) => handleFolderContextMenu(e, `week-${weekNum}-cppa122`)}
                                  data-testid={`folder-week-${weekNum}-cppa122`}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    {isCourseExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-white/60" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-white/60" />
                                    )}
                                  </div>
                                  {isCourseExpanded ? (
                                    <FolderOpen className="h-4 w-4 text-green-500 fill-green-400" />
                                  ) : (
                                    <Folder className="h-4 w-4 text-green-500 fill-green-400" />
                                  )}
                                  <span className="text-xs text-green-400">CPPA122</span>
                                </div>
                                {isCourseExpanded && (
                                  <div className="ml-4">
                                    <div 
                                      className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === `week-${weekNum}-cppa122-reading` ? 'bg-[#094771]' : ''}`}
                                      onClick={() => setUploadTargetFolder(`week-${weekNum}-cppa122-reading`)}
                                    >
                                      <div className="w-4 h-4" />
                                      <Folder className="h-4 w-4 text-green-500 fill-green-400" />
                                      <span className="text-xs text-white/80">Reading</span>
                                    </div>
                                    <div 
                                      className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === `week-${weekNum}-cppa122-module` ? 'bg-[#094771]' : ''}`}
                                      onClick={() => setUploadTargetFolder(`week-${weekNum}-cppa122-module`)}
                                    >
                                      <div className="w-4 h-4" />
                                      <Folder className="h-4 w-4 text-green-500 fill-green-400" />
                                      <span className="text-xs text-white/80">Module</span>
                                    </div>
                                    {/* Custom folders for this course */}
                                    {customFolders.filter(f => f.parent === `week-${weekNum}-cppa122`).map(folder => (
                                      <div 
                                        key={folder.id}
                                        className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === folder.id ? 'bg-[#094771]' : ''}`}
                                        onClick={() => setUploadTargetFolder(folder.id)}
                                        onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                                        data-testid={`folder-custom-${folder.id}`}
                                      >
                                        <div className="w-4 h-4" />
                                        <Folder className="h-4 w-4 text-green-500 fill-green-400" />
                                        <span className="text-xs text-white/80">{folder.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* CFNF400 */}
                          {(() => {
                            const courseId = `upload-week-${weekNum}-cfnf400`;
                            const isCourseExpanded = flyoutExpandedFolders.has(courseId);
                            return (
                              <div>
                                <div 
                                  className="flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer"
                                  onClick={() => toggleFlyoutFolder(courseId)}
                                  onContextMenu={(e) => handleFolderContextMenu(e, `week-${weekNum}-cfnf400`)}
                                  data-testid={`folder-week-${weekNum}-cfnf400`}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    {isCourseExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-white/60" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-white/60" />
                                    )}
                                  </div>
                                  {isCourseExpanded ? (
                                    <FolderOpen className="h-4 w-4 text-pink-500 fill-pink-400" />
                                  ) : (
                                    <Folder className="h-4 w-4 text-pink-500 fill-pink-400" />
                                  )}
                                  <span className="text-xs text-pink-400">CFNF400</span>
                                </div>
                                {isCourseExpanded && (
                                  <div className="ml-4">
                                    <div 
                                      className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === `week-${weekNum}-cfnf400-reading` ? 'bg-[#094771]' : ''}`}
                                      onClick={() => setUploadTargetFolder(`week-${weekNum}-cfnf400-reading`)}
                                    >
                                      <div className="w-4 h-4" />
                                      <Folder className="h-4 w-4 text-pink-500 fill-pink-400" />
                                      <span className="text-xs text-white/80">Reading</span>
                                    </div>
                                    <div 
                                      className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === `week-${weekNum}-cfnf400-module` ? 'bg-[#094771]' : ''}`}
                                      onClick={() => setUploadTargetFolder(`week-${weekNum}-cfnf400-module`)}
                                    >
                                      <div className="w-4 h-4" />
                                      <Folder className="h-4 w-4 text-pink-500 fill-pink-400" />
                                      <span className="text-xs text-white/80">Module</span>
                                    </div>
                                    {/* Custom folders for this course */}
                                    {customFolders.filter(f => f.parent === `week-${weekNum}-cfnf400`).map(folder => (
                                      <div 
                                        key={folder.id}
                                        className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === folder.id ? 'bg-[#094771]' : ''}`}
                                        onClick={() => setUploadTargetFolder(folder.id)}
                                        onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                                        data-testid={`folder-custom-${folder.id}`}
                                      >
                                        <div className="w-4 h-4" />
                                        <Folder className="h-4 w-4 text-pink-500 fill-pink-400" />
                                        <span className="text-xs text-white/80">{folder.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* CASL101 */}
                          {(() => {
                            const courseId = `upload-week-${weekNum}-casl101`;
                            const isCourseExpanded = flyoutExpandedFolders.has(courseId);
                            return (
                              <div>
                                <div 
                                  className="flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer"
                                  onClick={() => toggleFlyoutFolder(courseId)}
                                  onContextMenu={(e) => handleFolderContextMenu(e, `week-${weekNum}-casl101`)}
                                  data-testid={`folder-week-${weekNum}-casl101`}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    {isCourseExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-white/60" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-white/60" />
                                    )}
                                  </div>
                                  {isCourseExpanded ? (
                                    <FolderOpen className="h-4 w-4 text-indigo-500 fill-indigo-400" />
                                  ) : (
                                    <Folder className="h-4 w-4 text-indigo-500 fill-indigo-400" />
                                  )}
                                  <span className="text-xs text-indigo-400">CASL101</span>
                                </div>
                                {isCourseExpanded && (
                                  <div className="ml-4">
                                    <div 
                                      className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === `week-${weekNum}-casl101-reading` ? 'bg-[#094771]' : ''}`}
                                      onClick={() => setUploadTargetFolder(`week-${weekNum}-casl101-reading`)}
                                    >
                                      <div className="w-4 h-4" />
                                      <Folder className="h-4 w-4 text-indigo-500 fill-indigo-400" />
                                      <span className="text-xs text-white/80">Reading</span>
                                    </div>
                                    <div 
                                      className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === `week-${weekNum}-casl101-module` ? 'bg-[#094771]' : ''}`}
                                      onClick={() => setUploadTargetFolder(`week-${weekNum}-casl101-module`)}
                                    >
                                      <div className="w-4 h-4" />
                                      <Folder className="h-4 w-4 text-indigo-500 fill-indigo-400" />
                                      <span className="text-xs text-white/80">Module</span>
                                    </div>
                                    {/* Custom folders for this course */}
                                    {customFolders.filter(f => f.parent === `week-${weekNum}-casl101`).map(folder => (
                                      <div 
                                        key={folder.id}
                                        className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === folder.id ? 'bg-[#094771]' : ''}`}
                                        onClick={() => setUploadTargetFolder(folder.id)}
                                        onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                                        data-testid={`folder-custom-${folder.id}`}
                                      >
                                        <div className="w-4 h-4" />
                                        <Folder className="h-4 w-4 text-indigo-500 fill-indigo-400" />
                                        <span className="text-xs text-white/80">{folder.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Custom folders directly under week */}
                          {customFolders.filter(f => f.parent === `week-${weekNum}`).map(folder => {
                            const folderColor = folder.name.toUpperCase() === 'CPPA122' ? 'text-green-500 fill-green-400' :
                              folder.name.toUpperCase() === 'CFNF400' ? 'text-blue-500 fill-blue-400' :
                              folder.name.toUpperCase() === 'CASL101' ? 'text-purple-500 fill-purple-400' :
                              'text-yellow-500 fill-yellow-400';
                            return (
                              <div 
                                key={folder.id}
                                className={`flex items-center gap-1 py-0.5 px-1 hover:bg-[#2a2d2e] rounded cursor-pointer ${uploadTargetFolder === folder.id ? 'bg-[#094771]' : ''}`}
                                onClick={() => setUploadTargetFolder(folder.id)}
                                onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                                data-testid={`folder-custom-week-${folder.id}`}
                              >
                                <div className="w-4 h-4" />
                                <Folder className={`h-4 w-4 ${folderColor}`} />
                                <span className="text-xs text-white/80">{folder.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Right Panel - Upload Area */}
            <div className="flex-1 bg-[#1e1e1e] flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#3c3c3c]">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-xs text-white/80 hover:bg-[#3c3c3c] rounded"
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                >
                  <FolderPlus className="h-4 w-4 mr-1" />
                  New Folder
                </Button>
              </div>
              
              {/* New Folder Input */}
              {isCreatingFolder && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border-b border-[#3c3c3c]">
                  <Input
                    placeholder="New folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 h-7 text-xs bg-[#3c3c3c] border-[#5c5c5c] text-white"
                    data-testid="input-new-folder-name"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-500"
                    onClick={() => {
                      if (newFolderName.trim()) {
                        setUploadTargetFolder(newFolderName.trim().toLowerCase().replace(/\s+/g, '-'));
                        setNewFolderName('');
                        setIsCreatingFolder(false);
                      }
                    }}
                    data-testid="button-create-folder"
                  >
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-white/60 hover:text-white"
                    onClick={() => setIsCreatingFolder(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              
              {/* Upload Drop Zone */}
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md border-2 border-dashed border-[#3c3c3c] rounded-lg p-8 text-center hover:border-blue-500 hover:bg-[#252526] transition-all cursor-pointer">
                  <input 
                    type="file" 
                    id="file-upload" 
                    multiple 
                    accept=".pdf,.doc,.docx,.txt" 
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      
                      // Require folder selection
                      if (!uploadTargetFolder) {
                        toast({ title: "Please select a folder first", variant: "destructive" });
                        e.target.value = '';
                        return;
                      }
                      
                      let successCount = 0;
                      let errorCount = 0;
                      
                      for (const file of Array.from(files)) {
                        try {
                          // Step 1: Request a presigned upload URL (with folder)
                          const requestRes = await fetch('/api/uploads/request-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: file.name,
                              size: file.size,
                              contentType: file.type || 'application/octet-stream',
                              folder: uploadTargetFolder,
                            }),
                          });
                          
                          if (!requestRes.ok) {
                            throw new Error('Failed to get upload URL');
                          }
                          
                          const { uploadURL } = await requestRes.json();
                          
                          // Step 2: Upload file directly to presigned URL
                          const uploadRes = await fetch(uploadURL, {
                            method: 'PUT',
                            body: file,
                            headers: {
                              'Content-Type': file.type || 'application/octet-stream',
                            },
                          });
                          
                          if (!uploadRes.ok) {
                            throw new Error('Failed to upload file');
                          }
                          
                          successCount++;
                        } catch (error) {
                          console.error('Upload error:', error);
                          errorCount++;
                        }
                      }
                      
                      // Show result toast
                      if (successCount > 0) {
                        toast({ title: `Uploaded ${successCount} file${successCount > 1 ? 's' : ''} to ${uploadTargetFolder}` });
                      }
                      if (errorCount > 0) {
                        toast({ title: `Failed to upload ${errorCount} file${errorCount > 1 ? 's' : ''}`, variant: "destructive" });
                      }
                      
                      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                      e.target.value = '';
                      setIsUploadDialogOpen(false);
                    }}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#3c3c3c] flex items-center justify-center">
                      <Upload className="h-8 w-8 text-blue-400" />
                    </div>
                    <p className="text-base text-white/90 font-medium mb-1">Drop files here</p>
                    <p className="text-sm text-white/60 mb-3">or click to browse</p>
                    <p className="text-xs text-white/40">Supports: PDF, DOC, DOCX, TXT</p>
                  </label>
                </div>
              </div>
              
              {/* Status Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#007acc] text-white text-xs">
                <span>{uploadTargetFolder ? `Uploading to: ${uploadTargetFolder}` : 'Select a folder from the tree'}</span>
                <span>13 weeks available</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={renameFileId !== null} onOpenChange={(open) => !open && setRenameFileId(null)}>
        <DialogContent className="max-w-md bg-[#252526] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Pencil className="h-4 w-4" />
              Rename File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={renameFileName}
              onChange={(e) => setRenameFileName(e.target.value)}
              placeholder="Enter new name..."
              className="bg-[#3c3c3c] border-[#5c5c5c] text-white"
              data-testid="input-rename-file"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameFileName.trim() && renameFileId) {
                  fetch(`/api/files/${renameFileId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: renameFileName.trim() })
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                    setRenameFileId(null);
                    toast({ title: "File renamed" });
                  }).catch(() => {
                    toast({ title: "Failed to rename file", variant: "destructive" });
                  });
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setRenameFileId(null)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (renameFileName.trim() && renameFileId) {
                    fetch(`/api/files/${renameFileId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ displayName: renameFileName.trim() })
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                      setRenameFileId(null);
                      toast({ title: "File renamed" });
                    }).catch(() => {
                      toast({ title: "Failed to rename file", variant: "destructive" });
                    });
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500"
                data-testid="button-confirm-rename"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move File Dialog */}
      <Dialog open={moveFileId !== null} onOpenChange={(open) => !open && setMoveFileId(null)}>
        <DialogContent className="max-w-md bg-[#252526] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Folder className="h-4 w-4" />
              Move File to Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
            {(() => {
              const folders = allFiles
                .map(f => f.folder)
                .filter((f): f is string => !!f && f !== moveFileCurrentFolder)
                .filter((value, index, self) => self.indexOf(value) === index)
                .sort();
              
              return folders.map(folder => {
                const parts = folder.split('-');
                const weekNum = parts[1];
                const course = parts[2]?.toUpperCase() || '';
                const type = parts[3] || '';
                const displayName = `Week ${weekNum} - ${course} - ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                
                return (
                  <div
                    key={folder}
                    className="px-3 py-2 hover:bg-white/10 rounded cursor-pointer flex items-center gap-2"
                    onClick={async () => {
                      if (moveFileId) {
                        try {
                          await fetch(`/api/files/${moveFileId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folder })
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                          setMoveFileId(null);
                          toast({ title: "File moved successfully" });
                        } catch (err) {
                          toast({ title: "Failed to move file", variant: "destructive" });
                        }
                      }
                    }}
                  >
                    <Folder className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">{displayName}</span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => setMoveFileId(null)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder Context Menu */}
      {folderContextMenu && (
        <div 
          className="fixed z-[9999] bg-[#1e1e1e] border border-white/20 rounded-md shadow-lg py-1 min-w-[180px]"
          style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          data-testid="folder-context-menu"
        >
          <div className="px-3 py-1.5 text-xs text-white/50 border-b border-white/10">
            Create Course Folder
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 flex items-center gap-2"
            onClick={async () => {
              const parentFolder = folderContextMenu.parentFolder;
              try {
                const response = await fetch('/api/custom-folders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'CPPA122', parentFolderId: parentFolder })
                });
                if (!response.ok) {
                  console.error('Failed to save folder:', response.status);
                  toast({ title: "Error", description: "Failed to save folder", variant: "destructive" });
                  return;
                }
                const savedFolder = await response.json();
                console.log('Folder saved:', savedFolder);
                const folderId = `${parentFolder}-subfolder-cppa122-${savedFolder.id}`;
                setCustomFolders(prev => [...prev, { id: folderId, name: 'CPPA122', parent: parentFolder }]);
                toast({ title: "Folder created", description: "CPPA122 folder added" });
              } catch (err) {
                console.error('Failed to save folder to database:', err);
                toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
              }
              setFolderContextMenu(null);
            }}
            data-testid="button-new-folder-cppa122"
          >
            <Folder className="h-4 w-4 text-green-500" />
            CPPA122
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 flex items-center gap-2"
            onClick={async () => {
              const parentFolder = folderContextMenu.parentFolder;
              try {
                const response = await fetch('/api/custom-folders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'CFNF400', parentFolderId: parentFolder })
                });
                if (!response.ok) {
                  console.error('Failed to save folder:', response.status);
                  toast({ title: "Error", description: "Failed to save folder", variant: "destructive" });
                  return;
                }
                const savedFolder = await response.json();
                console.log('Folder saved:', savedFolder);
                const folderId = `${parentFolder}-subfolder-cfnf400-${savedFolder.id}`;
                setCustomFolders(prev => [...prev, { id: folderId, name: 'CFNF400', parent: parentFolder }]);
                toast({ title: "Folder created", description: "CFNF400 folder added" });
              } catch (err) {
                console.error('Failed to save folder to database:', err);
                toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
              }
              setFolderContextMenu(null);
            }}
            data-testid="button-new-folder-cfnf400"
          >
            <Folder className="h-4 w-4 text-blue-500" />
            CFNF400
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 flex items-center gap-2"
            onClick={async () => {
              const parentFolder = folderContextMenu.parentFolder;
              try {
                const response = await fetch('/api/custom-folders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'CASL101', parentFolderId: parentFolder })
                });
                if (!response.ok) {
                  console.error('Failed to save folder:', response.status);
                  toast({ title: "Error", description: "Failed to save folder", variant: "destructive" });
                  return;
                }
                const savedFolder = await response.json();
                console.log('Folder saved:', savedFolder);
                const folderId = `${parentFolder}-subfolder-casl101-${savedFolder.id}`;
                setCustomFolders(prev => [...prev, { id: folderId, name: 'CASL101', parent: parentFolder }]);
                toast({ title: "Folder created", description: "CASL101 folder added" });
              } catch (err) {
                console.error('Failed to save folder to database:', err);
                toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
              }
              setFolderContextMenu(null);
            }}
            data-testid="button-new-folder-casl101"
          >
            <Folder className="h-4 w-4 text-purple-500" />
            CASL101
          </button>
          <div className="border-t border-white/10 my-1" />
          <button
            className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 flex items-center gap-2"
            onClick={() => {
              setNewFolderParent(folderContextMenu.parentFolder);
              setNewFolderName('');
              setNewFolderDialogOpen(true);
              setFolderContextMenu(null);
            }}
            data-testid="button-new-folder-custom"
          >
            <FolderPlus className="h-4 w-4" />
            Custom Folder...
          </button>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="bg-[#1e1e1e] border-white/20 text-white [&>button]:text-white">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-white/60">
              Creating folder in: <span className="text-white/90 font-medium">{newFolderParent}</span>
            </p>
            <div>
              <Label htmlFor="folderName" className="text-white/80">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="bg-[#2a2d2e] border-white/20 text-white mt-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
                data-testid="input-new-folder-name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setNewFolderDialogOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-create-folder"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog with Media Controls */}
      <Dialog open={!!previewFile} onOpenChange={async (open) => { if (!open) { if (isPlayingRef.current || isPlaying) { console.log('[Dialog] Blocked close attempt while audio is playing'); return; } const fileToSave = previewFile; const chunksToSave = new Set(checkedChunksRef.current); const totalToSave = ttsChunksRef.current.length || totalChunks; if (fileToSave && fileToSave.id && chunksToSave.size > 0 && totalToSave > 0) { const checkedJson = JSON.stringify(Array.from(chunksToSave)); try { await fetch(`/api/files/${fileToSave.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ checkedChunks: checkedJson, totalChunks: totalToSave }) }); } catch (err) { console.error('Final save on close:', err); } } setPreviewFile(null); setOneDrivePreviewFiles([]); await queryClient.invalidateQueries({ queryKey: ['/api/files'] }); refreshFileCounts(); } }}>
        <DialogContent className="w-[1100px] max-w-[98vw] h-[90vh] flex flex-col p-0 overflow-hidden border border-white/20 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&>button]:text-white">
          {(() => {
            // Extract course code from folder path (e.g., "week-1-cppa122-module" -> "CPPA122")
            const folderParts = previewFile?.folder?.split('-') || [];
            const courseCodeFromFolder = folderParts.length >= 3 ? folderParts[2]?.toUpperCase() : null;
            const colors = courseCodeFromFolder ? dynamicCourseColors[courseCodeFromFolder] : null;
            
            return (
              <DialogHeader 
                className="px-6 py-4 border-b border-white/20 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95"
              >
                <DialogTitle 
                  className="flex items-center gap-2 text-sm text-white"
                >
                  <FileText className="h-4 w-4 text-white" />
                  {previewFile?.displayName || previewFile?.originalName}
                </DialogTitle>
              </DialogHeader>
            );
          })()}
          
          {/* Top Menu Bar - File Selector and Speaker */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-1.5 px-2 sm:px-4 mx-2 sm:mx-6 mt-2 sm:mt-4 gap-2 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            {/* Module and Reading File Selectors */}
            {(() => {
              const folderParts = previewFile?.folder?.split('-') || [];
              const weekNum = folderParts[1];
              const courseCode = folderParts[2];
              const isReading = previewFile?.folder?.includes('reading');
              const isModule = previewFile?.folder?.includes('module');
              
              // Get module files for this week/course
              const moduleFiles = allFiles.filter(f => 
                f.folder?.includes(`week-${weekNum}-${courseCode}`) && 
                f.folder?.includes('module')
              );
              
              // Get reading files for this week/course  
              const readingFiles = allFiles.filter(f => 
                f.folder?.includes(`week-${weekNum}-${courseCode}`) && 
                f.folder?.includes('reading')
              );
              
              // Current file list based on active type
              const relatedFiles = oneDrivePreviewFiles.length > 0 
                ? oneDrivePreviewFiles
                : isReading ? readingFiles : moduleFiles;
              
              const currentIndex = relatedFiles.findIndex(f => f.id === previewFile?.id);
              const canGoPrev = currentIndex > 0;
              const canGoNext = currentIndex < relatedFiles.length - 1;
              
              const goToPrevFile = () => {
                if (canGoPrev) {
                  setPreviewFile(relatedFiles[currentIndex - 1]);
                }
              };
              
              const goToNextFile = () => {
                if (canGoNext) {
                  setPreviewFile(relatedFiles[currentIndex + 1]);
                }
              };
              
              return (
                <div className="flex items-center gap-3 flex-1 sm:flex-initial flex-wrap">
                  {/* Module Files Dropdown */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-white hidden sm:inline">Module:</span>
                    <Select 
                      value={(() => {
                        if (isModule && previewFile) return previewFile.id.toString();
                        if (moduleFiles.length === 0) return 'none';
                        // Default to first unlistened module, or first module if all listened
                        const unlistenedFile = moduleFiles.find(f => !f.listened);
                        const defaultFile = unlistenedFile || moduleFiles[0];
                        return defaultFile?.id?.toString() || 'none';
                      })()} 
                      onValueChange={(val) => {
                        if (val === 'none') return;
                        const file = moduleFiles.find(f => f.id.toString() === val);
                        if (file) setPreviewFile(file);
                      }}
                    >
                      <SelectTrigger 
                        className={`w-auto h-5 text-[9px] px-2 bg-gray-800 transition-all duration-200 whitespace-nowrap ${
                          isModule 
                            ? 'border !border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                            : 'border-gray-700 hover:border-green-500/50'
                        }`}
                        style={{ color: 'white' }}
                        data-testid="select-module-file">
                        <SelectValue>
                          {(() => {
                            if (moduleFiles.length === 0) return 'No modules';
                            const unlistenedFile = moduleFiles.find(f => !f.listened);
                            const fileToShow = isModule && previewFile ? previewFile : (unlistenedFile || moduleFiles[0]);
                            return fileToShow ? (fileToShow.displayName || fileToShow.originalName).replace(/\.pdf$/i, '') : 'No modules';
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] min-w-[350px]">
                        {moduleFiles.length === 0 && (
                          <SelectItem value="none" disabled className="text-[10px] text-gray-500">No module files</SelectItem>
                        )}
                        {moduleFiles.map(file => (
                          <SelectItem 
                            key={file.id} 
                            value={file.id.toString()} 
                            className={`text-[10px] ${file.listened ? 'text-white/50 line-through' : ''}`}
                          >
                            {(file.displayName || file.originalName).replace(/\.pdf$/i, '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Reading Files Dropdown */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-white hidden sm:inline">Reading:</span>
                    <Select 
                      value={(() => {
                        if (isReading && previewFile) return previewFile.id.toString();
                        // Default to first reading file
                        return readingFiles[0]?.id?.toString() || '';
                      })()} 
                      onValueChange={(val) => {
                        const file = readingFiles.find(f => f.id.toString() === val);
                        if (file) setPreviewFile(file);
                      }}
                    >
                      <SelectTrigger 
                        className={`w-auto h-5 text-[9px] px-2 bg-gray-800 transition-all duration-200 whitespace-nowrap ${
                          isReading 
                            ? 'border !border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' 
                            : 'border-gray-700 hover:border-blue-500/50'
                        }`}
                        style={{ color: 'white' }}
                        data-testid="select-reading-file">
                        <SelectValue placeholder="No readings" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] min-w-[350px]">
                        {readingFiles.length === 0 ? (
                          <SelectItem value="none" disabled className="text-[10px] text-gray-500">No reading files</SelectItem>
                        ) : readingFiles.map(file => (
                          <SelectItem 
                            key={file.id} 
                            value={file.id.toString()} 
                            className={`text-[10px] ${file.listened ? 'text-white/50 line-through' : ''}`}
                          >
                            {(file.displayName || file.originalName).replace(/\.pdf$/i, '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Navigation Arrows */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-white hover:bg-gray-700 disabled:opacity-30"
                      onClick={goToPrevFile}
                      disabled={!canGoPrev}
                      data-testid="button-prev-file"
                      title="Previous file"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[9px] text-white/60 min-w-[40px] text-center">
                      {currentIndex >= 0 ? `${currentIndex + 1}/${relatedFiles.length}` : '-'}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-white hover:bg-gray-700 disabled:opacity-30"
                      onClick={goToNextFile}
                      disabled={!canGoNext}
                      data-testid="button-next-file"
                      title="Next file"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
            
            {/* Speaker Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[9px] text-white">Speaker:</span>
              <Select value={previewSpeaker} onValueChange={setPreviewSpeaker}>
                <SelectTrigger className="flex-1 sm:w-[180px] h-6 text-[10px] bg-gray-800 border-gray-700 text-white" data-testid="select-preview-speaker">
                  <SelectValue placeholder="Select Speaker" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {SPEAKERS.map(speaker => (
                    <SelectItem key={speaker.id} value={speaker.id} className="text-[10px]">
                      {speaker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Voice & Speed Controls Bar */}
          <div className="flex items-center justify-between gap-4 p-1.5 px-4 mx-6 mt-2 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            {/* Voice selector - shows for browser TTS */}
            {previewSpeaker === "browser_tts" && availableVoices.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white">Voice:</span>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="w-[180px] h-6 text-[10px] bg-gray-800 border-gray-700 text-white" data-testid="select-voice">
                    <SelectValue placeholder="Select Voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableVoices.map(voice => (
                      <SelectItem key={voice.name} value={voice.name} className="text-[10px]">
                        {voice.name.replace('Microsoft ', '').replace(' Online (Natural)', '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-white hover:bg-gray-700"
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
                  <Volume2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* OpenAI Voice selector - shows for OpenAI TTS (Fire tablets) */}
            {(previewSpeaker === "openai_tts" || !window.speechSynthesis) && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white">Voice:</span>
                <Select 
                  value={openaiVoice} 
                  onValueChange={(v) => setOpenaiVoice(v as typeof openaiVoice)}
                >
                  <SelectTrigger className="w-[120px] h-6 text-[10px] bg-gray-800 border-gray-700 text-white" data-testid="select-openai-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alloy" className="text-[10px]">Alloy</SelectItem>
                    <SelectItem value="echo" className="text-[10px]">Echo</SelectItem>
                    <SelectItem value="fable" className="text-[10px]">Fable</SelectItem>
                    <SelectItem value="onyx" className="text-[10px]">Onyx</SelectItem>
                    <SelectItem value="nova" className="text-[10px]">Nova</SelectItem>
                    <SelectItem value="shimmer" className="text-[10px]">Shimmer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-white hover:bg-gray-700"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/tts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: "Hello, this is a sample of my voice.", voice: openaiVoice }),
                      });
                      if (response.ok) {
                        const blob = await response.blob();
                        const audio = new Audio(URL.createObjectURL(blob));
                        audio.play();
                      }
                    } catch (err) {
                      console.error("Voice preview error:", err);
                    }
                  }}
                  data-testid="button-preview-openai-voice"
                  title="Preview voice"
                >
                  <Volume2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Speed control - shows for browser TTS */}
            {previewSpeaker === "browser_tts" && (
              <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1">
                <Gauge className="h-3 w-3 text-gray-400" />
                <span className="text-[9px] text-white">Speed</span>
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
          </div>
          
          {/* Playback Controls Bar */}
          <div className="flex items-center justify-between gap-2 p-1.5 px-2 sm:px-4 mx-2 sm:mx-6 mt-2 bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
              onClick={handleSkipBack}
              data-testid="button-preview-rewind"
              title="Rewind 20 words"
            >
              <SkipBack className="h-4 w-4 text-white stroke-white" />
            </Button>
            
            <Button
              size="icon"
              variant="outline"
              className={`h-6 w-6 border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent transition-all duration-200 ${
                isPlaying 
                  ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent shadow-[0_0_16px_rgba(59,130,246,0.8),0_0_24px_rgba(59,130,246,0.6)]' 
                  : 'shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)]'
              }`}
              onClick={() => previewFile && handlePlayFile(previewFile.objectPath, previewFile.displayName || previewFile.originalName, false)}
              data-testid="button-preview-play"
              title="Play from start"
            >
              <Play className="h-4 w-4 text-white fill-white" />
            </Button>
            
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 border !border-green-500 text-white hover:text-white hover:!border-green-400 hover:bg-transparent shadow-[0_0_8px_rgba(34,197,94,0.4)] hover:shadow-[0_0_12px_rgba(34,197,94,0.6)] focus:ring-2 focus:ring-green-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
              onClick={() => previewFile && handlePlayFile(previewFile.objectPath, previewFile.displayName || previewFile.originalName, true)}
              data-testid="button-preview-resume"
              title={`Resume from section ${(previewFile?.id ? getTtsProgress(previewFile.id)?.chunkIndex || 0 : 0) + 1}`}
            >
              <RotateCcw className="h-4 w-4 text-white stroke-white" />
            </Button>
            
            <Button
              size="icon"
              variant="destructive"
              className="h-6 w-6 bg-[rgb(255,0,0)] hover:bg-[rgb(220,0,0)] border-[rgb(255,0,0)] focus:ring-2 focus:ring-red-400 focus:ring-offset-1 focus:ring-offset-transparent"
              onClick={handleStopMedia}
              data-testid="button-preview-stop"
            >
              <Square className="h-4 w-4 fill-white" />
            </Button>
            
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
              onClick={handleSkipForward}
              data-testid="button-preview-forward"
              title="Skip forward 20 words"
            >
              <SkipForward className="h-4 w-4 text-white stroke-white" />
            </Button>
            
            <div className="w-px h-6 bg-white/30" />
            
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[9px] border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
              onClick={handleRestartFromBeginning}
              data-testid="button-preview-restart-beginning"
              title="Restart from beginning"
            >
              <RotateCcw className="h-4 w-4 mr-1 text-white stroke-white" />
              <div className="flex flex-col leading-tight">
                <span>Restart</span>
                <span>Beginning</span>
              </div>
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[9px] border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
              onClick={handleRestartCurrentChunk}
              data-testid="button-preview-restart-current"
              title="Restart current section"
            >
              <RefreshCw className="h-4 w-4 mr-1 text-white stroke-white" />
              <div className="flex flex-col leading-tight">
                <span>Restart</span>
                <span>Current</span>
              </div>
            </Button>
            
            <div className="w-px h-6 bg-white/30" />
            
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-white hover:bg-white/20"
                onClick={() => {
                  const newVal = Math.max(0, radioVolume - 5);
                  setRadioVolume(newVal);
                  if (previewSpeaker === "browser_tts") {
                    const rate = 0.5 + (newVal / 100) * 1.5;
                    setBrowserTtsRate(rate);
                  } else {
                    fetch("/api/media/volume", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ level: newVal, entityId: previewSpeaker }),
                    }).catch(console.error);
                  }
                }}
                data-testid="button-volume-down"
              >
                <Minus className="h-3 w-3 text-white" />
              </Button>
              <Slider
                value={[radioVolume]}
                onValueChange={(val) => {
                  setRadioVolume(val[0]);
                  if (previewSpeaker === "browser_tts") {
                    const rate = 0.5 + (val[0] / 100) * 1.5;
                    setBrowserTtsRate(rate);
                  } else {
                    fetch("/api/media/volume", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ level: val[0], entityId: previewSpeaker }),
                    }).catch(console.error);
                  }
                }}
                min={0}
                max={100}
                step={5}
                className="w-24 [&>span:first-child]:h-0.5 [&>span:first-child>span]:h-0.5 [&_[role=slider]]:h-2 [&_[role=slider]]:w-2 [&_[role=slider]]:border-0"
                data-testid="slider-preview-volume"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-white hover:bg-white/20"
                onClick={() => {
                  const newVal = Math.min(100, radioVolume + 5);
                  setRadioVolume(newVal);
                  if (previewSpeaker === "browser_tts") {
                    const rate = 0.5 + (newVal / 100) * 1.5;
                    setBrowserTtsRate(rate);
                  } else {
                    fetch("/api/media/volume", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ level: newVal, entityId: previewSpeaker }),
                    }).catch(console.error);
                  }
                }}
                data-testid="button-volume-up"
              >
                <Plus className="h-3 w-3 text-white" />
              </Button>
              <span className="text-[10px] text-white/70 w-7">{radioVolume}%</span>
            </div>
            
            <div className="w-px h-6 bg-white/30" />
            
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-gray-700"
              data-testid="button-preview-download"
              title="Download PDF"
              onClick={async () => {
                if (!previewFile) return;
                try {
                  // Use direct URL for OneDrive files, otherwise use API
                  const isDirectUrl = previewFile.objectPath?.startsWith('http');
                  const fetchUrl = isDirectUrl ? previewFile.objectPath : `/api/files/${previewFile.id}/download`;
                  const response = await fetch(fetchUrl);
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
            
            <div className="w-px h-6 bg-white/30" />
            
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
            
            <div className="w-px h-6 bg-white/30" />
            
            <div className="flex items-center gap-1">
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
                Complete
              </Label>
            </div>
          </div>
          
          {/* Split View: PDF on left, Highlighted Text on right */}
          <div className="flex-1 flex gap-4 min-h-0 mx-6 mb-4 mt-4 overflow-hidden">
            {/* PDF Viewer - 8.5x11 aspect ratio */}
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex flex-col" style={{ aspectRatio: '8.5 / 11', height: '100%' }}>
              <div className="flex items-center justify-between p-2 bg-gray-200 dark:bg-gray-700">
                <span className="text-xs text-muted-foreground">
                  {numPages || '?'} pages
                </span>
                <div className="flex items-center gap-2">
                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-gray-300 dark:bg-gray-600 rounded px-1.5 py-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500"
                      onClick={() => setPdfZoom(z => Math.max(0.25, z - 0.1))}
                      disabled={pdfZoom <= 0.25}
                      title="Zoom out"
                      data-testid="button-pdf-zoom-out"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-8 text-center">
                      {Math.round(pdfZoom * 100)}%
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500"
                      onClick={() => setPdfZoom(z => Math.min(2, z + 0.1))}
                      disabled={pdfZoom >= 2}
                      title="Zoom in"
                      data-testid="button-pdf-zoom-in"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
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
                    <div className="flex flex-col items-center gap-2">
                      {Array.from({ length: numPages || 0 }, (_, i) => (
                        <Page 
                          key={i + 1}
                          pageNumber={i + 1} 
                          width={Math.round(380 * pdfZoom)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                      ))}
                    </div>
                  </Document>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Highlighted Text for TTS */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-y-auto overflow-x-hidden">
              {isLoadingText ? (
                <div className="flex items-center justify-center h-full p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Extracting text...</span>
                </div>
              ) : previewText ? (
                <div className="flex flex-col min-h-full">
                  {/* Jump to Unlistened button */}
                  {ttsChunks.length > 0 && (
                    <div className="sticky top-0 z-10 flex justify-center py-1.5 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => {
                          const firstUnchecked = ttsChunks.findIndex((_, i) => !checkedChunks.has(i));
                          if (firstUnchecked >= 0) {
                            const el = document.querySelector(`[data-testid="checkbox-chunk-${firstUnchecked}"]`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        data-testid="button-jump-unlistened"
                      >
                        <SkipForward className="h-3 w-3" />
                        Jump to Unlistened
                      </Button>
                    </div>
                  )}
                  <div className="flex-1 p-4">
                <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {(() => {
                    const chunks = ttsChunks.length > 0 ? ttsChunks : [];
                    if (chunks.length === 0) {
                      return <div className="text-muted-foreground">Loading text sections...</div>;
                    }
                    
                    const stripFolderParts = previewFile?.folder?.split('-') || [];
                    const stripCourseCode = stripFolderParts.length >= 3 ? stripFolderParts[2]?.toUpperCase() : null;
                    const stripCourse = stripCourseCode ? coursesData.courses.find(c => c.name && c.name.toUpperCase().includes(stripCourseCode)) : null;
                    const stripColor = stripCourse?.color || '#000000';
                    const sRgb = hexToRgb(stripColor);
                    const sD = `rgb(${Math.max(0,sRgb.r-40)},${Math.max(0,sRgb.g-40)},${Math.max(0,sRgb.b-40)})`;
                    const sL = `rgb(${Math.min(255,sRgb.r+100)},${Math.min(255,sRgb.g+100)},${Math.min(255,sRgb.b+100)})`;
                    const stripGradient = `linear-gradient(180deg, ${sL} 0%, ${sD} 100%)`;

                    const chunkColors = [
                      'bg-blue-50 dark:bg-blue-950/40',
                      'bg-green-50 dark:bg-green-950/40',
                      'bg-purple-50 dark:bg-purple-950/40',
                      'bg-orange-50 dark:bg-orange-950/40',
                      'bg-pink-50 dark:bg-pink-950/40',
                      'bg-cyan-50 dark:bg-cyan-950/40',
                    ];
                    
                    let globalWordIndex = 0;
                    
                    return chunks.map((chunk, chunkIdx) => {
                      const chunkColor = chunkColors[chunkIdx % chunkColors.length];
                      const isCurrentChunk = isPlaying && chunkIdx === currentChunkIndex;
                      
                      const paragraphs = chunk.split(/\n\n+/);
                      
                      return (
                        <div key={chunkIdx} className="mb-4 flex">
                          {/* Checkbox aligned to this chunk */}
                          <div className="flex-shrink-0 w-10 flex items-start justify-center pt-5" style={{ background: stripGradient }} data-testid="checkbox-strip">
                            <div
                              onClick={(e) => { e.stopPropagation(); toggleDashChunkChecked(chunkIdx); }}
                              className="cursor-pointer select-none flex items-center justify-center"
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '3px',
                                border: checkedChunks.has(chunkIdx) ? '1.5px solid #000000' : '1.5px solid rgba(255,255,255,0.8)',
                                backgroundColor: checkedChunks.has(chunkIdx) ? '#000000' : '#ffffff',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                lineHeight: 1,
                              }}
                              data-testid={`checkbox-chunk-${chunkIdx}`}
                            >
                              {checkedChunks.has(chunkIdx) && '\u2713'}
                            </div>
                          </div>
                          <div className="flex-1">
                          <div 
                            className={`${chunkColor} ${isCurrentChunk ? 'ring-2 ring-yellow-400' : ''} ${checkedChunks.has(chunkIdx) ? 'line-through opacity-60' : ''} rounded-r-lg p-4 cursor-pointer hover:opacity-90 transition-opacity relative`}
                            onClick={() => playFromChunk(chunkIdx)}
                            title={`Click to play from Section ${chunkIdx + 1}`}
                          >
                          {/* Chunk header */}
                          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                            <span className={`text-[11px] font-semibold ${checkedChunks.has(chunkIdx) ? 'text-green-600 dark:text-green-400 line-through' : 'text-gray-600 dark:text-gray-400'}`}>
                              Section {chunkIdx + 1} of {chunks.length}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-3 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                              onClick={(e) => { e.stopPropagation(); playFromChunk(chunkIdx); }}
                              data-testid={`button-play-chunk-${chunkIdx}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                          </div>
                          
                          {paragraphs.map((paragraph, pIdx) => {
                            // Split paragraph into lines (single newline)
                            const lines = paragraph.split(/\n/).filter(l => l.trim().length > 0);
                            if (lines.length === 0) return null;
                            
                            return (
                              <div key={pIdx} className="mb-6 pb-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 last:mb-0">
                                {lines.map((line, lIdx) => {
                                  const words = line.trim().split(/\s+/).filter(w => w.length > 0);
                                  if (words.length === 0) return null;
                                  
                                  const lineStartIdx = globalWordIndex;
                                  globalWordIndex += words.length;
                                  
                                  const isBullet = /^[•\-\*►▶→·]/.test(line.trim());
                                  const isHeader = words.length <= 10 && !/[.,:;]$/.test(line.trim()) && line.trim().length > 0 && /^[A-Z]/.test(line.trim());
                                  
                                  return (
                                    <div key={`${pIdx}-${lIdx}`}>
                                      <p 
                                        className={`${isBullet ? 'pl-6' : ''} ${isHeader && !isBullet ? 'font-bold text-[15px] mt-4' : ''}`}
                                        style={{ textIndent: !isBullet && !isHeader ? '1.5em' : '0' }}
                                      >
                                      {words.map((word, wIdx) => {
                                        const wordGlobalIdx = lineStartIdx + wIdx;
                                        const isCurrentWord = syncHighlight && isPlaying && wordGlobalIdx === currentWordIndex;
                                        return (
                                          <span
                                            key={wordGlobalIdx}
                                            ref={isCurrentWord ? (el) => {
                                              if (el && el !== activeWordRef.current) {
                                                activeWordRef.current = el;
                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                              }
                                            } : undefined}
                                            className={isCurrentWord ? "bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white px-0.5 rounded" : ""}
                                          >
                                            {word}{' '}
                                          </span>
                                        );
                                      })}
                                      </p>
                                      {/* Line break after each line */}
                                      <div className="h-3" />
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-4 text-muted-foreground">
                  No text content available
                </div>
              )}
            </div>
          </div>
          
          {/* Share and Done Buttons */}
          <div className="flex justify-between items-center p-4 mx-6 mb-2" style={{ marginTop: '-20px' }}>
            {/* Share Button - Only for admin */}
            {isAdmin ? (
              <Button
                variant="outline"
                className="border !border-white/30 text-white hover:text-white hover:!border-white/50 hover:bg-white/10 transition-all duration-200 h-8 px-4"
                style={{ fontSize: '12px' }}
                onClick={generateShareLink}
                disabled={isGeneratingLink}
                data-testid="button-share-from-reader"
              >
                <Share2 className="h-3 w-3 mr-2" />
                {isGeneratingLink ? "Generating..." : "Share"}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              {/* Progress Bar - shows checked chunks / total */}
              <div className="flex items-center gap-2 bg-gray-900/50 px-2 py-1 rounded-md border border-white/10" data-testid="chunk-completion-bar">
                <div className="w-24 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${totalChunks > 0 
                      ? Math.round((checkedChunks.size / totalChunks) * 100)
                      : previewFile?.totalChunks && previewFile.totalChunks > 0 && previewFile.lastChunkIndex != null && previewFile.lastChunkIndex > 0
                        ? Math.round((previewFile.lastChunkIndex / previewFile.totalChunks) * 100)
                        : 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-emerald-400 font-medium min-w-[60px]">
                  {totalChunks > 0 
                    ? `${checkedChunks.size}/${totalChunks} (${Math.round((checkedChunks.size / totalChunks) * 100)}%)` 
                    : previewFile?.totalChunks && previewFile.totalChunks > 0 && previewFile.lastChunkIndex != null && previewFile.lastChunkIndex > 0
                      ? `${previewFile.lastChunkIndex}/${previewFile.totalChunks} (${Math.round((previewFile.lastChunkIndex / previewFile.totalChunks) * 100)}%)`
                      : '0/0 (0%)'}
                </span>
              </div>
              <Button
                variant="outline"
                className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-8 px-6"
                style={{
                  boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                  fontSize: '12px'
                }}
                onClick={async () => {
                  const fileToSave = previewFile;
                  const chunksToSave = new Set(checkedChunksRef.current);
                  const totalToSave = ttsChunksRef.current.length || totalChunks;
                  if (fileToSave && fileToSave.id && chunksToSave.size > 0 && totalToSave > 0) {
                    const checkedJson = JSON.stringify(Array.from(chunksToSave));
                    try {
                      await fetch(`/api/files/${fileToSave.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ checkedChunks: checkedJson, totalChunks: totalToSave }),
                      });
                    } catch (err) { console.error('Final save error:', err); }
                  }
                  setPreviewFile(null);
                  setOneDrivePreviewFiles([]);
                  await queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                  refreshFileCounts();
                }}
                data-testid="button-preview-done"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 overflow-visible relative z-10" style={{ backgroundColor: 'transparent' }}>
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

      {/* Logo and Name - Fixed on screen, never slides */}
      <img src={unicalLogo} alt="Uni-Cal" className="rounded h-[35px] w-[35px] fixed" style={{ left: '16px', top: '5px', zIndex: 100 }} />
      <div className="flex flex-col fixed" style={{ left: '57px', top: '4px', zIndex: 100 }}>
        <span className="text-white font-bold text-[11.5px] leading-tight">Schedule for {profileData.firstName}{profileData.lastName ? ` ${profileData.lastName}` : ''}</span>
        <span className="text-white/60 font-medium text-[10px] leading-tight">{schoolData.schoolName || 'Toronto Metropolitan University'}</span>
      </div>

      {/* Chang School Logo - fixed, horizontally under hover tab, vertically centered with Uni-Cal logo */}
      <img
        src={changSchoolLogo}
        alt="The Chang School of Continuing Education"
        style={{
          position: 'absolute',
          left: 'calc(50% - 113px)',
          transform: 'translateX(-50%) translateY(-50%)',
          top: '36px',
          height: '42px',
          objectFit: 'contain',
          zIndex: 5,
          opacity: isTopPillOpen ? 0 : 1,
          transition: 'opacity 0.4s ease-in-out',
          pointerEvents: 'none',
        }}
      />

      {/* Top Pill - Slide up/down container for toolbar buttons */}
      <div 
        ref={topPillRef}
        style={{
          position: 'absolute',
          zIndex: 20,
          left: 'calc(50% - 101px)',
          transform: `translateX(-50%) translateY(${isTopPillOpen ? '1px' : '-56px'})`,
          transition: topPillMounted ? 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          animation: (!isTopPillOpen && topPillMounted) ? 'top-pill-container-nudge 6s ease-in-out 0.5s infinite' : 'none',
          top: '0px',
          height: '55px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={() => {
          if (topPillTimeoutRef.current) clearTimeout(topPillTimeoutRef.current);
        }}
        onMouseLeave={() => {
          if (topPillTimeoutRef.current) clearTimeout(topPillTimeoutRef.current);
          topPillTimeoutRef.current = setTimeout(() => {
            closeTopPill();
          }, 1800);
        }}
      >
        {/* Glass pill background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }} />
        
        {/* Down arrow at bottom center */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '-18px',
            width: '60px',
            height: '18px',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 2,
          }}
          onClick={() => {
            openTopPill();
            if (topPillTimeoutRef.current) clearTimeout(topPillTimeoutRef.current);
            topPillTimeoutRef.current = setTimeout(() => {
              closeTopPill();
            }, 1800);
          }}
          onMouseEnter={() => {
            openTopPill();
            if (topPillTimeoutRef.current) clearTimeout(topPillTimeoutRef.current);
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '-20px',
            width: '46px',
            height: '23px',
            borderRadius: '0 0 9999px 9999px',
            background: 'rgba(255, 255, 255, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            pointerEvents: 'none',
            opacity: isTopPillOpen ? 0 : 0.9,
            transition: 'opacity 0.3s ease-in-out',
          }}
        />

        {/* Icon buttons and task buttons with adjustable spacing */}
        <div className="flex items-center flex-wrap justify-center flex-shrink px-4" style={{ gap: `${blinkSettings.buttonSpacing + 4}px`, marginTop: '-3px', position: 'relative', zIndex: 1 }}>
          {/* Hamburger Menu */}
          <DropdownMenu onOpenChange={(open) => { if (open) triggerButtonGlow('hamburger'); }}>
            <DropdownMenuTrigger asChild>
              <div 
                style={{ 
                  marginTop: '4px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(0deg, #042550 0%, #4578B0 100%)',
                  padding: '1px',
                  cursor: 'pointer'
                }}
                data-testid="button-hamburger-menu"
              >
                <Button variant="ghost" size="icon" className={`!h-[42px] !w-[42px] !min-h-[42px] !min-w-[42px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 transition-all duration-200`} style={{ 
                    background: 'linear-gradient(180deg, #042550 0%, #4578B0 100%)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                  <Menu className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
                </Button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem data-testid="menu-item-profile" className="text-xs" onClick={() => setIsProfileDialogOpen(true)}>
                <User className="h-3.5 w-3.5 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-item-school" className="text-xs" onClick={() => setIsSchoolDialogOpen(true)}>
                <GraduationCap className="h-3.5 w-3.5 mr-2" />
                School Settings
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-item-settings" className="text-xs" onClick={() => {
                  setOriginalColorSettings({...colorSettings});
                  setOriginalBlinkSettings({...blinkSettings});
                  setIsSettingsDialogOpen(true);
                }}>
                <Settings className="h-3.5 w-3.5 mr-2" />
                Calendar Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Undo Complete - top gradient #BD0000 */}
          {completedTaskHistory.length > 0 ? (
            <div style={{ position: 'relative', width: '44px', height: '44px', marginTop: '4px', zIndex: 100 }}>
              {/* Bottom circle: 44px, gradient opposite of front */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(0deg, #500404 0%, #B04545 100%)'
              }} />
              {/* Top circle: 38px, gradient bottom to #BD0000 top */}
              <div 
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: '3px',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(0deg, #B04545 0%, #500404 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                className="hover:opacity-80 transition-all duration-200"
                onClick={() => { triggerButtonGlow('undo'); handleUndoComplete(); }}
                data-testid="button-undo-complete"
                title={`Undo last completion (${completedTaskHistory.length} available)`}
              >
                <Undo2 className="h-[18px] w-[18px] text-white" />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '4px', width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(0deg, #888 0%, #ccc 100%)', padding: '1px', zIndex: 100 }}>
              <div 
                className="!h-[42px] !w-[42px] rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(0deg, #ccc 0%, #888 100%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.25)' }}
                data-testid="button-undo-complete"
                title="No task to undo"
              >
                <Undo2 className="h-[18px] w-[18px] text-white" />
              </div>
            </div>
          )}

          {/* Sticky Note Button - Swapped with completed tasks */}
          <div 
            style={{ marginTop: '4px', width: '44px', height: '44px', borderRadius: '50%', position: 'relative' }}
            data-testid="honeycomb-sticky-note"
          >
            {/* Back circle - solid #E8E656 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#E8E656',
                boxShadow: 'none',
              }}
            />
            {/* Front circle with gradient - 38px */}
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: '3px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(0deg, #FDFFCC 0%, #F2D338 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              className="hover:opacity-80 transition-all duration-200"
              onClick={handleAddStickyNote}
              title="Add Sticky Note"
            >
              <StickyNote style={{ color: 'black', strokeWidth: 1.5, height: '18px', width: '18px' }} />
            </div>
          </div>

          {/* Graduation Hat - Swapped with Completed Tasks */}
          <div style={{ marginTop: '4px', width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', padding: '1px' }}>
            <Button 
              size="icon"
              variant="ghost"
              className="!h-[42px] !w-[42px] !min-h-[42px] !min-w-[42px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 transition-all duration-200"
              style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)' }}
              data-testid="button-settings-panel"
              onClick={() => {
                triggerButtonGlow('settings');
                setIsSettingsPanelOpen(true);
                const activeCourses = coursesData.courses.filter(c => c.name.trim());
                const uncheckedAas = activeCourses.filter(c => {
                  const code = c.name.split(' - ')[0];
                  return !aasSentStatus[code];
                });
                if (uncheckedAas.length > 0) {
                  setShowAasReminder(true);
                }
              }}
            >
              <GraduationCap className="text-white" style={{ height: '22px', width: '22px' }} />
            </Button>
          </div>

          {/* Radio Dialog */}
          <Dialog open={isRadioDialogOpen} onOpenChange={setIsRadioDialogOpen}>
            <DialogContent className="max-w-[260px] text-[10px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white p-0 [&>button.absolute]:hidden" style={{ top: '55%' }}>
              {/* Header bar matching flyouts */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <Radio className="h-3 w-3 text-white" />
                  <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    RADIO CONTROLS
                  </h2>
                </div>
                <button 
                  onClick={() => setIsRadioDialogOpen(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-radio"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-3 p-4">
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

          {/* Share Link Dialog */}
          <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
            <DialogContent className="max-w-[360px] text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] p-0 [&>button.absolute]:hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <Share2 className="h-3 w-3 text-white" />
                  <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    TEMPORARY SHARE LINK
                  </h2>
                </div>
                <button 
                  onClick={() => setIsShareDialogOpen(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-share"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-white/80 text-[10px]">
                  This link will expire 1 hour after someone uses it. They can view but not make permanent changes.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-2 py-1.5 text-[10px] bg-black/50 border border-white/30 rounded text-white"
                    data-testid="input-share-link"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-white border-white/30 hover:bg-white/10"
                    onClick={copyShareLink}
                    data-testid="button-copy-share-link"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Completed Tasks Button - Swapped with Graduation Hat */}
          <div style={{ marginTop: '4px', width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', padding: '1px' }}>
            <Button 
              size="icon"
              variant="ghost"
              className="!h-[42px] !w-[42px] !min-h-[42px] !min-w-[42px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 transition-all duration-200"
              style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)' }}
              data-testid="button-completed-tasks"
              onClick={() => { triggerButtonGlow('completed'); setIsCompletedTasksOpen(true); }}
            >
              <CheckSquare className="h-[18px] w-[18px] text-white" />
            </Button>
          </div>

          {/* Todo Button (swapped from tall pill) */}
          <div 
            style={{ marginTop: '4px', width: '44px', height: '44px', borderRadius: '50%', position: 'relative' }}
            data-testid="honeycomb-todo-header"
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(0deg, #F2530E 0%, #FF9E75 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: '3px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(0deg, #FF9E75 0%, #F2530E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              className="hover:opacity-80 transition-all duration-200"
              onClick={() => { if (!isTodoFlyoutOpen) bringFlyoutToFront('todo'); setIsTodoFlyoutOpen(!isTodoFlyoutOpen); }}
            >
              <ListChecks style={{ color: 'white', strokeWidth: 2, height: '18px', width: '18px' }} />
            </div>
          </div>

          {/* Files Button (swapped from tall pill) */}
          <div 
            style={{ marginTop: '4px', width: '44px', height: '44px', borderRadius: '50%', position: 'relative', touchAction: 'manipulation' }}
            onMouseEnter={() => setDecorativeHoneycombHover('middle')}
            onMouseLeave={() => setDecorativeHoneycombHover(null)}
            data-testid="honeycomb-files-header"
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(0deg, #F2530E 0%, #FF9E75 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: '3px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(0deg, #FF9E75 0%, #F2530E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
              onClick={() => { if (!isWeeksFlyoutOpen) bringFlyoutToFront('files'); setIsWeeksFlyoutOpen(!isWeeksFlyoutOpen); }}
              onTouchEnd={(e) => { e.preventDefault(); if (!isWeeksFlyoutOpen) bringFlyoutToFront('files'); setIsWeeksFlyoutOpen(!isWeeksFlyoutOpen); }}
            >
              <Folder style={{ color: 'white', strokeWidth: 2, height: '18px', width: '18px' }} />
            </div>
          </div>

          {/* Projects Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className={`!h-[40px] !min-h-[40px] px-[16px] hover:opacity-80 text-white text-[12px] border-0 font-medium rounded-full !bg-transparent transition-all duration-200`} 
            style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", backgroundImage: `url(${taskButtonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginLeft: '-5px', marginTop: '4px', zIndex: 10, position: 'relative' }} 
            data-testid="button-projects"
            onClick={() => { bringFlyoutToFront('projects'); setIsProjectsFlyoutOpen(true); }}
          >
            + Projects
          </Button>

          {/* Quick Add Button */}
          <Button variant="ghost" size="sm" className={`!h-[40px] !min-h-[40px] px-[16px] hover:opacity-80 text-white text-[12px] border-0 font-medium rounded-full !bg-transparent transition-all duration-200`} style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", backgroundImage: `url(${taskButtonBg})`, backgroundSize: 'cover', backgroundPosition: 'center', marginLeft: '-5px', marginTop: '4px', zIndex: 10, position: 'relative' }} data-testid="button-add-task" onClick={() => { triggerButtonGlow('addtask'); setNewTaskType("other"); bringFlyoutToFront('addTask'); setIsAddDialogOpen(true); }}>+ Add Task</Button>

        </div>
      </div>

      {/* Pomodoro Timer - Fixed on screen, never slides */}
      <div className="fixed flex items-center h-[35px]" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", right: `${16 + clockWidth + 10}px`, top: '5px', zIndex: 100 }}>
        <div
          className="flex items-center justify-center rounded-full cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            width: '37px',
            height: '37px',
            backgroundImage: `url(${clockBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginRight: '8px',
            marginTop: '-1px',
            flexShrink: 0,
            border: '1.5px solid rgba(255, 255, 255, 0.45)',
          }}
          data-testid="button-pomodoro-add"
          onClick={() => {
            setQuickAddStep(0);
            setQuickAddData({ type: "", title: "", courseName: "", dueDate: "", dueDateHour: "18", dueDateMinute: "00", prepDays: 0, priority: "medium", description: "", eventStartTime: "", eventEndTime: "", reminder1: DEFAULT_REMINDER_1, reminder2: DEFAULT_REMINDER_2, reminder3: null, reminder4: null, attachments: [], pasteUrl: "", notes: "", referenceLink: "", subtasks: [], subtaskInput: "", projectId: null, repeatType: "none", repeatInterval: null, repeatIntervalUnit: null, repeatEndDate: "" });
            setIsQuickAddOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex items-center gap-4 rounded-full px-5 h-[35px] overflow-hidden" style={{ backgroundImage: `url(${clockBg})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1.5px solid rgba(255, 255, 255, 0.45)' }}>
          <div className={`text-[15px] font-bold px-1.5 py-0.5 rounded ${
            pomodoroMode === "work" ? "text-white" : 
            pomodoroMode === "shortBreak" ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"
          }`} style={{ fontFamily: "'Raleway', sans-serif", minWidth: '52px' }} data-testid="pomodoro-timer">
            {formatPomodoroTime(pomodoroTime)}
          </div>
          <div className="flex items-center gap-3">
            <button className="p-0.5 hover:bg-white/20 rounded transition-colors" onClick={togglePomodoro} data-testid="button-pomodoro-toggle">
              {pomodoroRunning ? <Pause className="h-3.5 w-3.5 text-white" strokeWidth={2.5} /> : <Play className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />}
            </button>
            <button className="p-0.5 hover:bg-white/20 rounded transition-colors" onClick={resetPomodoro} data-testid="button-pomodoro-reset">
              <RotateCcw className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </button>
            <button className="p-0.5 hover:bg-white/20 rounded transition-colors" onClick={skipPomodoro} data-testid="button-pomodoro-skip">
              <SkipForward className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Clock - Fixed on screen, never slides */}
      <div ref={clockContainerRef} className="fixed h-[35px]" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", right: '16px', top: '5px', zIndex: 100 }}>
        <div style={{ overflow: 'hidden', borderRadius: '9999px', border: '1.5px solid rgba(255, 255, 255, 0.45)' }}>
          <div className="h-[35px] overflow-hidden" style={{ backgroundImage: `url(${clockBg})`, backgroundSize: 'cover', backgroundPosition: 'center', paddingLeft: '5px', paddingRight: '14px', marginLeft: '-14px', borderRadius: '9999px' }} data-testid="digital-clock">
            <div className="flex items-center gap-1 h-full" style={{ transform: 'translateX(14px)' }}>
            <div className="flex items-center gap-1" style={{ transform: 'translateX(12px)' }}>
              <span className="text-[13px] text-white font-normal" style={{ fontFamily: "'Raleway', sans-serif", letterSpacing: '0.3px' }}>
                {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(currentTime)}
              </span>
              <div className="w-[1px] h-4 bg-white/50 mx-1" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', width: '95px' }}>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '14px', fontWeight: 'bold', color: 'white', width: '44px', textAlign: 'right', flexShrink: 0 }}>
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: displayTimezone }).format(currentTime).replace(/\s?(AM|PM)$/i, '')}
              </span>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '10px', fontWeight: 'bold', color: 'white', width: '22px', textAlign: 'center', flexShrink: 0 }}>
                :{String(currentTime.getSeconds()).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '8px', fontWeight: 'bold', color: 'white', width: '16px', textTransform: 'uppercase', flexShrink: 0, marginLeft: '2px' }}>
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: displayTimezone }).format(currentTime).replace(/^\d+\s*/, '')}
              </span>
            </div>
            {profileData.travelTimezone && (
              <span className="text-[11px] text-orange-400 font-medium ml-1">Travel</span>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel Popup - Certificate Tracking Only */}
      <Dialog open={isSettingsPanelOpen} onOpenChange={setIsSettingsPanelOpen}>
        <DialogContent 
          className="overflow-hidden flex flex-col text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] p-0 [&>button.absolute]:hidden" 
          style={{ width: '420px', maxWidth: '95vw', height: '85vh' }}
        >
          {/* Header bar matching flyouts */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
            <div className="flex items-center gap-2">
              <Settings className="h-3 w-3 text-white" />
              <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                CERTIFICATE TRACKING
              </h2>
            </div>
            <button 
              onClick={() => setIsSettingsPanelOpen(false)}
              className="text-white hover:text-white/80 transition-colors p-1"
              data-testid="button-close-settings-panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-2 pt-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* PAG Level Carousel */}
            <div>
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
                <div className={`flex border-b border-black ${checkedCourses['L1_PPA122'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L1_PPA122'] || false} onChange={() => toggleCourse('L1_PPA122')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 122</div>
                  <div className="flex-1 px-1 py-0.5">Local Politics and Government</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L1_PPA122']?.grade || ''} onChange={(e) => updateGrade('L1_PPA122', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L1_PPA122']?.percent || ''} onChange={(e) => updatePercent('L1_PPA122', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L1_PPA124'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L1_PPA124'] || false} onChange={() => toggleCourse('L1_PPA124')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 124</div>
                  <div className="flex-1 px-1 py-0.5">Indigenous Politics and Government</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L1_PPA124']?.grade || ''} onChange={(e) => updateGrade('L1_PPA124', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L1_PPA124']?.percent || ''} onChange={(e) => updatePercent('L1_PPA124', e.target.value)} />
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
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA211'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 px-0.5 py-0.5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA211'] || false} onChange={() => toggleCourse('L2_PPA211')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">Core Req</div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 211</div>
                  <div className="flex-1 px-1 py-0.5">Public Policy</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-1.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA211']?.grade || ''} onChange={(e) => updateGrade('L2_PPA211', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA211']?.percent || ''} onChange={(e) => updatePercent('L2_PPA211', e.target.value)} />
                  </div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-5 border-r border-black"></div>
                  <div className="w-14 px-1 py-0.5 border-r border-black text-[8px] font-semibold">CORE ELECTIVES:</div>
                  <div className="flex-1 px-1 py-0.5 text-[8px]">Select <span className="font-bold">THREE</span> from the following:</div>
                  <div className="w-12 border-l border-black"></div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA120'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA120'] || false} onChange={() => toggleCourse('L2_PPA120')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 120</div>
                  <div className="flex-1 px-1 py-0.5">Canadian Politics and Government</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA120']?.grade || ''} onChange={(e) => updateGrade('L2_PPA120', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA120']?.percent || ''} onChange={(e) => updatePercent('L2_PPA120', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA121'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA121'] || false} onChange={() => toggleCourse('L2_PPA121')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 121</div>
                  <div className="flex-1 px-1 py-0.5">Ontario Politics and Government</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA121']?.grade || ''} onChange={(e) => updateGrade('L2_PPA121', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA121']?.percent || ''} onChange={(e) => updatePercent('L2_PPA121', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA122'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA122'] || false} onChange={() => toggleCourse('L2_PPA122')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 122</div>
                  <div className="flex-1 px-1 py-0.5">Local Politics and Government</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA122']?.grade || ''} onChange={(e) => updateGrade('L2_PPA122', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA122']?.percent || ''} onChange={(e) => updatePercent('L2_PPA122', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA124'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA124'] || false} onChange={() => toggleCourse('L2_PPA124')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 124</div>
                  <div className="flex-1 px-1 py-0.5">Indigenous Politics and Government</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA124']?.grade || ''} onChange={(e) => updateGrade('L2_PPA124', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA124']?.percent || ''} onChange={(e) => updatePercent('L2_PPA124', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA235'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA235'] || false} onChange={() => toggleCourse('L2_PPA235')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 235</div>
                  <div className="flex-1 px-1 py-0.5">Theories of the State</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA235']?.grade || ''} onChange={(e) => updateGrade('L2_PPA235', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA235']?.percent || ''} onChange={(e) => updatePercent('L2_PPA235', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA303'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA303'] || false} onChange={() => toggleCourse('L2_PPA303')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 303</div>
                  <div className="flex-1 px-1 py-0.5">Public Budget Policy/Politics</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA303']?.grade || ''} onChange={(e) => updateGrade('L2_PPA303', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA303']?.percent || ''} onChange={(e) => updatePercent('L2_PPA303', e.target.value)} />
                  </div>
                </div>
                <div className={`flex border-b border-black ${checkedCourses['L2_PPA319'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_PPA319'] || false} onChange={() => toggleCourse('L2_PPA319')} />
                  </div>
                  <div className="w-14 px-1 py-0.5 border-r border-black">PPA 319</div>
                  <div className="flex-1 px-1 py-0.5">Politics of Work and Labour</div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5 py-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_PPA319']?.grade || ''} onChange={(e) => updateGrade('L2_PPA319', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_PPA319']?.percent || ''} onChange={(e) => updatePercent('L2_PPA319', e.target.value)} />
                  </div>
                </div>
                <div className="flex">
                  <div className="w-5 border-r border-black"></div>
                  <div className="w-14 border-r border-black"></div>
                  <div className="flex-1 px-1 py-0.5 text-[8px] font-bold">LIBERAL STUDIES ELECTIVE TABLE A:</div>
                  <div className="w-12 border-l border-black"></div>
                </div>
                <div className={`flex items-stretch ${checkedCourses['L2_LIBERAL'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                  <div className="w-5 border-r border-black flex items-center justify-center">
                    <input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_LIBERAL'] || false} onChange={() => toggleCourse('L2_LIBERAL')} />
                  </div>
                  <div className="w-14 border-r border-black h-11 flex items-start justify-center text-[8px] text-center px-0.5">
                    <span className="leading-none -mt-2"><span className="font-bold">ONE</span> one-term course (LOWER LEVEL) required.</span>
                  </div>
                  <div className="flex-1 h-11 px-1 flex items-center">
                    <input type="text" className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['L2_LIBERAL'] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`} placeholder="Course..." value={openElectives['L2_LIBERAL'] || ''} onChange={(e) => updateOpenElective('L2_LIBERAL', e.target.value)} />
                  </div>
                  <div className="w-12 border-l border-black flex flex-col items-center justify-center gap-0.5">
                    <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_LIBERAL']?.grade || ''} onChange={(e) => updateGrade('L2_LIBERAL', e.target.value)}>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_LIBERAL']?.percent || ''} onChange={(e) => updatePercent('L2_LIBERAL', e.target.value)} />
                  </div>
                </div>
                <div className="h-px bg-black"></div>
                <div className="flex items-stretch">
                  <div className="w-5 border-r border-black flex flex-col">
                    <div className="h-7 border-b border-black"></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN1'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN1'] || false} onChange={() => toggleCourse('L2_ECN1')} /></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN2'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN2'] || false} onChange={() => toggleCourse('L2_ECN2')} /></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN3'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN3'] || false} onChange={() => toggleCourse('L2_ECN3')} /></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN4'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN4'] || false} onChange={() => toggleCourse('L2_ECN4')} /></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN5'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN5'] || false} onChange={() => toggleCourse('L2_ECN5')} /></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN6'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN6'] || false} onChange={() => toggleCourse('L2_ECN6')} /></div>
                    <div className={`h-9 flex items-center justify-center border-b border-black ${checkedCourses['L2_ECN7'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN7'] || false} onChange={() => toggleCourse('L2_ECN7')} /></div>
                    <div className={`h-9 flex items-center justify-center ${checkedCourses['L2_ECN8'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_ECN8'] || false} onChange={() => toggleCourse('L2_ECN8')} /></div>
                  </div>
                  <div className="w-14 border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                    <span className="leading-tight"><span className="font-bold">ONE</span> course required</span>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="h-7 px-1 text-[8px] leading-tight flex items-center border-b border-black"><span><b>CORE ELECTIVE: ONE</b> course required from the following:</span></div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN1'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 101 Principles of Microeconomics ** (Anti-req ECN104)</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN2'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 104 Introductory Microeconomics ** (Anti-req ECN110)</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN3'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 110 The Economy and Society ** (Anti-req ECN104)</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN4'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 201 Principles of Macroeconomics ** (Anti-req ECN204)</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN5'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 204 Introductory Macroeconomics ** (Anti-req ECN210)</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN6'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 210 Understanding Economics ** (Anti-req ECN101,104, 201 and 204)</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center border-b border-black ${checkedCourses['L2_ECN7'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 220 Evolution of the Global Economy</div>
                    <div className={`h-9 px-1 text-[8px] flex items-center ${checkedCourses['L2_ECN8'] ? 'bg-gray-300 text-gray-500' : ''}`}>ECN 320 Introduction to Financial Economics</div>
                  </div>
                  <div className="w-12 border-l border-black flex flex-col">
                    <div className="h-7 border-b border-black"></div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN1']?.grade || ''} onChange={(e) => updateGrade('L2_ECN1', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN1']?.percent || ''} onChange={(e) => updatePercent('L2_ECN1', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN2']?.grade || ''} onChange={(e) => updateGrade('L2_ECN2', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN2']?.percent || ''} onChange={(e) => updatePercent('L2_ECN2', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN3']?.grade || ''} onChange={(e) => updateGrade('L2_ECN3', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN3']?.percent || ''} onChange={(e) => updatePercent('L2_ECN3', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN4']?.grade || ''} onChange={(e) => updateGrade('L2_ECN4', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN4']?.percent || ''} onChange={(e) => updatePercent('L2_ECN4', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN5']?.grade || ''} onChange={(e) => updateGrade('L2_ECN5', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN5']?.percent || ''} onChange={(e) => updatePercent('L2_ECN5', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN6']?.grade || ''} onChange={(e) => updateGrade('L2_ECN6', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN6']?.percent || ''} onChange={(e) => updatePercent('L2_ECN6', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5 border-b border-black">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN7']?.grade || ''} onChange={(e) => updateGrade('L2_ECN7', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN7']?.percent || ''} onChange={(e) => updatePercent('L2_ECN7', e.target.value)} />
                    </div>
                    <div className="h-9 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_ECN8']?.grade || ''} onChange={(e) => updateGrade('L2_ECN8', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_ECN8']?.percent || ''} onChange={(e) => updatePercent('L2_ECN8', e.target.value)} />
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
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L2_OPEN1'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_OPEN1'] || false} onChange={() => toggleCourse('L2_OPEN1')} /></div>
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L2_OPEN2'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L2_OPEN2'] || false} onChange={() => toggleCourse('L2_OPEN2')} /></div>
                  </div>
                  <div className="w-14 border-r border-black h-[88px] flex items-center justify-center text-[8px] text-center px-0.5">
                    <span className="leading-tight"><span className="font-bold">TWO</span> one-term courses required - options are listed in PR Table I.</span>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="h-11 px-1 flex items-center"><input type="text" className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['L2_OPEN1'] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`} placeholder="Course 1..." value={openElectives['L2_OPEN1'] || ''} onChange={(e) => updateOpenElective('L2_OPEN1', e.target.value)} /></div>
                    <div className="h-11 px-1 flex items-center"><input type="text" className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses['L2_OPEN2'] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`} placeholder="Course 2..." value={openElectives['L2_OPEN2'] || ''} onChange={(e) => updateOpenElective('L2_OPEN2', e.target.value)} /></div>
                  </div>
                  <div className="w-12 border-l border-black flex flex-col">
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_OPEN1']?.grade || ''} onChange={(e) => updateGrade('L2_OPEN1', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_OPEN1']?.percent || ''} onChange={(e) => updatePercent('L2_OPEN1', e.target.value)} />
                    </div>
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L2_OPEN2']?.grade || ''} onChange={(e) => updateGrade('L2_OPEN2', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L2_OPEN2']?.percent || ''} onChange={(e) => updatePercent('L2_OPEN2', e.target.value)} />
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
                    <tr className={`border-b border-black ${checkedCourses['L3_PPA333'] ? 'bg-gray-300 text-gray-500' : ''}`}>
                      <td className="px-0.5 py-0.5 border-r border-black text-center align-middle">
                        <input type="checkbox" className="checkbox-black" checked={checkedCourses['L3_PPA333'] || false} onChange={() => toggleCourse('L3_PPA333')} />
                      </td>
                      <td className="px-1 py-0.5 border-r border-black align-middle text-[8px]">Core Req</td>
                      <td className="px-1 py-0.5 border-r border-black align-middle text-[9px]">PPA 333</td>
                      <td className="px-1 py-0.5 align-middle text-[9px]">Research Methods in Public Administration</td>
                      <td className="border-l border-black align-middle">
                        <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                          <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L3_PPA333']?.grade || ''} onChange={(e) => updateGrade('L3_PPA333', e.target.value)}>
                            {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L3_PPA333']?.percent || ''} onChange={(e) => updatePercent('L3_PPA333', e.target.value)} />
                        </div>
                      </td>
                    </tr>
                    {[
                      { code: 'PPA 235', title: 'Theories of the State', id: 'L3_PPA235' },
                      { code: 'PPA 301', title: 'Administrative Law T', id: 'L3_PPA301' },
                      { code: 'PPA 303', title: 'Public Budget Policy/Politics', id: 'L3_PPA303' },
                      { code: 'PPA 319', title: 'Politics of Work and Labour', id: 'L3_PPA319' },
                      { code: 'PPA 335', title: 'Theories of Bureaucracy', id: 'L3_PPA335' },
                      { code: 'PPA 401', title: 'Collaborative Governance', id: 'L3_PPA401' },
                      { code: 'PPA 402', title: 'Program Planning and Evaluation', id: 'L3_PPA402' },
                      { code: 'PPA 403', title: 'e-Government', id: 'L3_PPA403' },
                      { code: 'PPA 404', title: 'Issues in Public Administration', id: 'L3_PPA404' },
                      { code: 'PPA 411', title: 'Advanced Public Policy', id: 'L3_PPA411' },
                      { code: 'PPA 414', title: 'Comparative Public Policy', id: 'L3_PPA414' },
                      { code: 'PPA 425', title: 'Intergovernmental Relations', id: 'L3_PPA425' },
                      { code: 'PPA 490', title: 'Public Admin Themes', id: 'L3_PPA490' },
                      { code: 'PPA 501', title: 'Public Sector Leadership', id: 'L3_PPA501' },
                    ].map((course, idx, arr) => (
                      <tr key={course.code} className={`${idx < arr.length - 1 ? 'border-b border-black' : ''} ${checkedCourses[course.id] ? 'bg-gray-300 text-gray-500' : ''}`}>
                        {idx === 0 && (
                          <>
                            <td rowSpan={14} className="px-0.5 py-0.5 border-r border-black text-center align-middle">
                              <div className="flex flex-col gap-0">
                                {['L3_PPA235','L3_PPA301','L3_PPA303','L3_PPA319','L3_PPA335','L3_PPA401','L3_PPA402','L3_PPA403','L3_PPA404','L3_PPA411','L3_PPA414','L3_PPA425','L3_PPA490','L3_PPA501'].map((cid, i) => (
                                  <div key={cid} className={`h-11 flex items-center justify-center ${i < 13 ? 'border-b border-black' : ''} ${checkedCourses[cid] ? 'bg-gray-300' : ''}`}>
                                    <input type="checkbox" className="checkbox-black" checked={checkedCourses[cid] || false} onChange={() => toggleCourse(cid)} />
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
                            <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades[course.id]?.grade || ''} onChange={(e) => updateGrade(course.id, e.target.value)}>
                              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades[course.id]?.percent || ''} onChange={(e) => updatePercent(course.id, e.target.value)} />
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
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L3_PRACTICUM1'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L3_PRACTICUM1'] || false} onChange={() => toggleCourse('L3_PRACTICUM1')} /></div>
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L3_PRACTICUM2'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L3_PRACTICUM2'] || false} onChange={() => toggleCourse('L3_PRACTICUM2')} /></div>
                  </div>
                  <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center">
                    Select&nbsp;<span className="font-bold">ONE</span>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className={`h-11 px-1 flex items-center text-[9px] ${checkedCourses['L3_PRACTICUM1'] ? 'bg-gray-300 text-gray-500' : ''}`}>PPA 50A/B (Formerly PPA030) ***Practicum1</div>
                    <div className={`h-11 px-1 flex items-center text-[9px] ${checkedCourses['L3_PRACTICUM2'] ? 'bg-gray-300 text-gray-500' : ''}`}>Course Base Option: Need 3 RG2 CORE ELECTIVE and 6 OE</div>
                  </div>
                  <div className="w-12 border-l border-black flex flex-col">
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L3_PRACTICUM1']?.grade || ''} onChange={(e) => updateGrade('L3_PRACTICUM1', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L3_PRACTICUM1']?.percent || ''} onChange={(e) => updatePercent('L3_PRACTICUM1', e.target.value)} />
                    </div>
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L3_PRACTICUM2']?.grade || ''} onChange={(e) => updateGrade('L3_PRACTICUM2', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L3_PRACTICUM2']?.percent || ''} onChange={(e) => updatePercent('L3_PRACTICUM2', e.target.value)} />
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
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L3_POG1'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L3_POG1'] || false} onChange={() => toggleCourse('L3_POG1')} /></div>
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L3_POG2'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L3_POG2'] || false} onChange={() => toggleCourse('L3_POG2')} /></div>
                    <div className={`h-11 flex items-center justify-center ${checkedCourses['L3_POG3'] ? 'bg-gray-300' : ''}`}><input type="checkbox" className="checkbox-black" checked={checkedCourses['L3_POG3'] || false} onChange={() => toggleCourse('L3_POG3')} /></div>
                  </div>
                  <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                    <div className="leading-tight">Select <span className="font-bold">THREE</span><br/>courses not<br/>previously<br/>taken:</div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className={`h-11 px-1 flex items-center text-[9px] ${checkedCourses['L3_POG1'] ? 'bg-gray-300 text-gray-500' : ''}`}>Any POG – 300 or 400 level courses</div>
                    <div className={`h-11 px-1 flex items-center text-[9px] ${checkedCourses['L3_POG2'] ? 'bg-gray-300 text-gray-500' : ''}`}>Any POG – 300 or 400 level courses</div>
                    <div className={`h-11 px-1 flex items-center text-[9px] ${checkedCourses['L3_POG3'] ? 'bg-gray-300 text-gray-500' : ''}`}>Any POG – 300 or 400 level courses</div>
                  </div>
                  <div className="w-12 border-l border-black flex flex-col">
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L3_POG1']?.grade || ''} onChange={(e) => updateGrade('L3_POG1', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L3_POG1']?.percent || ''} onChange={(e) => updatePercent('L3_POG1', e.target.value)} />
                    </div>
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L3_POG2']?.grade || ''} onChange={(e) => updateGrade('L3_POG2', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L3_POG2']?.percent || ''} onChange={(e) => updatePercent('L3_POG2', e.target.value)} />
                    </div>
                    <div className="h-11 flex flex-col items-center justify-center gap-0.5">
                      <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades['L3_POG3']?.grade || ''} onChange={(e) => updateGrade('L3_POG3', e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades['L3_POG3']?.percent || ''} onChange={(e) => updatePercent('L3_POG3', e.target.value)} />
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
                    {['L3_LIBERAL1','L3_LIBERAL2','L3_LIBERAL3','L3_LIBERAL4'].map(cid => (
                      <div key={cid} className={`h-11 flex items-center justify-center ${checkedCourses[cid] ? 'bg-gray-300' : ''}`}>
                        <input type="checkbox" className="checkbox-black" checked={checkedCourses[cid] || false} disabled={!openElectives[cid]?.trim()} onChange={() => toggleCourse(cid)} />
                      </div>
                    ))}
                  </div>
                  <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                    <div className="leading-tight"><span className="font-bold">FOUR</span> COURSES REQUIRED,<br/><br/><span className="font-bold">ONE</span> one-term LOWER LEVEL (TABLE A)<br/><br/>and <span className="font-bold">THREE</span> one-term UPPER LEVEL courses (TABLE B).</div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    {['L3_LIBERAL1','L3_LIBERAL2','L3_LIBERAL3','L3_LIBERAL4'].map((cid, i) => (
                      <div key={cid} className={`h-11 px-1 flex items-center ${checkedCourses[cid] ? 'bg-gray-300 text-gray-500' : ''}`}>
                        <input type="text" className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses[cid] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`} placeholder={`Course ${i+1}...`} value={openElectives[cid] || ''} onChange={(e) => updateOpenElective(cid, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div className="w-12 border-l border-black flex flex-col">
                    {['L3_LIBERAL1','L3_LIBERAL2','L3_LIBERAL3','L3_LIBERAL4'].map(cid => (
                      <div key={cid} className={`h-11 flex flex-col items-center justify-center gap-0.5 ${checkedCourses[cid] ? 'bg-gray-300' : ''}`}>
                        <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades[cid]?.grade || ''} onChange={(e) => updateGrade(cid, e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades[cid]?.percent || ''} onChange={(e) => updatePercent(cid, e.target.value)} />
                      </div>
                    ))}
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
                    {['L3_OPEN1','L3_OPEN2','L3_OPEN3','L3_OPEN4','L3_OPEN5','L3_OPEN6'].map(cid => (
                      <div key={cid} className={`h-11 flex items-center justify-center ${checkedCourses[cid] ? 'bg-gray-300' : ''}`}>
                        <input type="checkbox" className="checkbox-black" checked={checkedCourses[cid] || false} disabled={!openElectives[cid]?.trim()} onChange={() => toggleCourse(cid)} />
                      </div>
                    ))}
                  </div>
                  <div className="w-[55px] border-r border-black flex items-center justify-center text-[8px] text-center px-0.5">
                    <div className="leading-tight"><span className="font-bold">SIX</span> one-term level courses required from <a href="https://www.torontomu.ca/calendar/2025-2026/open-electives/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OE Table</a>.</div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    {['L3_OPEN1','L3_OPEN2','L3_OPEN3','L3_OPEN4','L3_OPEN5','L3_OPEN6'].map((cid, i) => (
                      <div key={cid} className={`h-11 px-1 flex items-center ${checkedCourses[cid] ? 'bg-gray-300 text-gray-500' : ''}`}>
                        <input type="text" className={`w-full text-[10px] px-1 py-0.5 border border-black rounded-sm ${checkedCourses[cid] ? 'bg-gray-300 text-gray-500' : 'bg-white'}`} placeholder={`Course ${i+1}...`} value={openElectives[cid] || ''} onChange={(e) => updateOpenElective(cid, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div className="w-12 border-l border-black flex flex-col">
                    {['L3_OPEN1','L3_OPEN2','L3_OPEN3','L3_OPEN4','L3_OPEN5','L3_OPEN6'].map(cid => (
                      <div key={cid} className={`h-11 flex flex-col items-center justify-center gap-0.5 ${checkedCourses[cid] ? 'bg-gray-300' : ''}`}>
                        <select className="w-10 text-[8px] border border-gray-400 rounded-sm bg-white text-black" value={courseGrades[cid]?.grade || ''} onChange={(e) => updateGrade(cid, e.target.value)}>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <input type="text" className="w-10 text-[8px] px-0.5 border border-gray-400 rounded-sm bg-white text-center text-black" placeholder="%" value={courseGrades[cid]?.percent || ''} onChange={(e) => updatePercent(cid, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
          {/* Save button at bottom */}
          <div className="px-4 py-3 border-t border-white/20 bg-black/30 flex justify-end">
            <Button 
              type="button" 
              variant="outline"
              className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-8 px-6"
              style={{
                boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                fontSize: '12px'
              }}
              onClick={() => {
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

      
      {/* Set Default Layout Checkbox - moved to task boxes area */}
      
      {/* Copyright - Right side of page, rotated */}
      {!isTodoFlyoutOpen && (
        <div 
          className="fixed text-white/60 text-[11px] font-medium z-[70] pointer-events-none"
          style={{ bottom: '50px', right: '0px', transform: 'rotate(-90deg)', transformOrigin: 'right bottom' }}
        >
          © 2026
        </div>
      )}
      
      {/* Navigation Arrows with week dates + Month toggle - bottom aligned */}
      <div className="absolute z-50 flex items-end justify-between gap-2" style={{ top: `${calendarTop - 28}px`, left: '0px', right: `${calendarRight}px` }}>
        <div className="flex items-center gap-1" style={{ marginLeft: '51px' }}>
          <div 
            className="cursor-pointer hover:bg-white/20 rounded p-0.5"
            onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
            data-testid="button-pill-prev-week"
            data-date-nav
          >
            <ChevronLeft className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] text-white/80 whitespace-nowrap font-normal tracking-wide" style={{ fontFamily: "'Raleway', sans-serif", letterSpacing: '0.3px' }} data-testid="text-week-dates">
            {format(weekStartDate, 'EEE, MMMM d')} – {format(weekEndDate, 'EEE, MMMM d')}
          </span>
          <div 
            className="cursor-pointer hover:bg-white/20 rounded p-0.5"
            onClick={() => setSelectedWeek(Math.min(13, selectedWeek + 1))}
            data-testid="button-pill-next-week"
            data-date-nav
          >
            <ChevronRight className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
        </div>
        <Button 
          variant="ghost"
          className="!h-4 !min-h-0 px-1 text-[10px] hover:bg-white/20 rounded font-bold text-white/80 border-0 tracking-wide uppercase underline relative -top-[4px]"
          style={{ marginRight: '3px' }}
          onClick={() => {
            if (calendarView === "week") {
              setCurrentMonth(new Date());
            }
            setCalendarView(calendarView === "month" ? "week" : "month");
          }}
          data-testid="button-month-view"
        >
          {calendarView === "month" ? "Week" : "Month"}
        </Button>
      </div>
      
      {/* Tall Pill Panel - Slides in from right edge */}
      {(() => {
        const pillW = 52;
        const pillH = (6 * 52) + 5;
        const arrowW = 15;
        const arrowH = 30;
        const totalW = pillW + arrowW;
        const midY = pillH / 2;
        const arrowTopY = midY - (arrowH / 2);
        const arrowBotY = midY + (arrowH / 2);
        const r = 28;
        const calH = calendarHeight - 35;
        const pillTop = calendarTop + (calH / 2) - (pillH / 2);
        const slideOffset = pillW + 4;
        sidePillSlideOffset.current = slideOffset;
        
        const startAutoHide = () => {
          if (pillMenuTimeoutRef.current) clearTimeout(pillMenuTimeoutRef.current);
          pillMenuTimeoutRef.current = setTimeout(() => {
            closeSidePill();
          }, 1800);
        };
        const cancelAutoHide = () => {
          if (pillMenuTimeoutRef.current) clearTimeout(pillMenuTimeoutRef.current);
        };
        const handleOpen = () => {
          openSidePill();
          startAutoHide();
        };
        const handleEnter = () => {
          cancelAutoHide();
        };
        const handleLeave = () => {
          startAutoHide();
        };

        const btnStyle = (slot: number, bg: string, extraStyle?: React.CSSProperties): React.CSSProperties => ({
          position: 'absolute',
          width: '44px',
          height: '44px',
          top: `${4 + (slot * 52)}px`,
          right: '8px',
          borderRadius: '50%',
          background: bg,
          padding: '1px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          ...extraStyle,
        });
        const innerStyle = (bg: string, shadow?: string): React.CSSProperties => ({
          position: 'absolute',
          top: '1px',
          left: '1px',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: bg,
          boxShadow: shadow || 'inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        });

        return (
          <div 
            ref={sidePillRef}
            className={`absolute z-[60] ${sidePillIdle ? 'side-pill-container-idle' : ''}`}
            style={{ 
              top: `${pillTop}px`, 
              right: '0px', 
              width: `${totalW + 4}px`, 
              height: `${pillH}px`,
              transform: `translateX(${isPillMenuOpen ? '0px' : `${slideOffset}px`})`,
              transition: sidePillMounted ? 'transform 0.3s ease-in-out' : 'none',
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            {/* Arrow hover zone - always accessible */}
            <div 
              style={{ position: 'absolute', left: '-6px', top: '0', width: `${arrowW + 12}px`, height: `${pillH}px`, cursor: 'pointer', pointerEvents: 'auto', zIndex: 2 }}
              onMouseEnter={handleOpen}
            />
            {/* SVG pill body (no arrow) */}
            <svg width={totalW + 2} height={pillH + 2} viewBox={`-1 -1 ${totalW + 2} ${pillH + 2}`} style={{ position: 'absolute', top: '-1px', left: '-1px', overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <filter id="pillShadow" x="-10%" y="-5%" width="120%" height="110%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(0,0,0,0.1)" />
                </filter>
              </defs>
              <path 
                d={`
                  M ${arrowW} ${r}
                  Q ${arrowW} 0, ${arrowW + r} 0
                  L ${totalW - r} 0
                  Q ${totalW} 0, ${totalW} ${r}
                  L ${totalW} ${pillH - r}
                  Q ${totalW} ${pillH}, ${totalW - r} ${pillH}
                  L ${arrowW + r} ${pillH}
                  Q ${arrowW} ${pillH}, ${arrowW} ${pillH - r}
                  Z
                `}
                fill="rgba(255, 255, 255, 0.45)"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                filter="url(#pillShadow)"
              />
            </svg>
            {/* Rounded tab - only visible when pill is closed */}
            <div
              style={{
                position: 'absolute',
                top: `${arrowTopY}px`,
                left: `${arrowW - 23}px`,
                width: '23px',
                height: '46px',
                borderRadius: '9999px 0 0 9999px',
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                borderRight: 'none',
                pointerEvents: 'none',
                opacity: isPillMenuOpen ? 0 : 0.9,
                transition: 'opacity 0.3s ease-in-out',
              }}
            />

            {/* Bell Button - Slot 0 */}
            <div 
              style={btnStyle(0, isMuted ? 'linear-gradient(0deg, #FF4545 0%, #FF6666 100%)' : 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')}
              data-testid="button-mute-toggle"
              onClick={() => { triggerButtonGlow('bell'); toggleMute(); }}
              title={isMuted ? `Muted for ${Math.ceil((muteUntil! - Date.now()) / 60000)} min` : "Mute for 30 min"}
            >
              <div className="hover:opacity-80 transition-all duration-200" style={innerStyle(isMuted ? 'linear-gradient(180deg, #FF9494 0%, #FF0000 100%)' : 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', isMuted ? 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)' : undefined)}>
                {isMuted ? <BellOff className="h-[18px] w-[18px] text-white" /> : <Bell className="h-[18px] w-[18px] text-white" />}
              </div>
            </div>

            {/* Push Button - Slot 1 */}
            <div 
              style={btnStyle(1, 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')}
              data-testid="honeycomb-push"
              onClick={() => { toast({ title: "Pushing...", description: "Syncing tasks to Google Calendar" }); syncAllCalendarMutation.mutate(); }}
            >
              <div className="hover:opacity-80 transition-all duration-200" style={innerStyle('linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')} title="Push tasks to Google Calendar">
                <Upload style={{ color: 'white', strokeWidth: 2, height: '18px', width: '18px' }} />
              </div>
            </div>

            {/* Pull Button - Slot 2 */}
            <div 
              style={btnStyle(2, 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')}
              data-testid="honeycomb-pull"
              onClick={async () => {
                toast({ title: "Pulling...", description: "Fetching events from Google Calendar" });
                try {
                  const res = await fetch('/api/calendar/pull', { method: 'POST' });
                  if (res.ok) { toast({ title: "Pull complete", description: "Calendar events synced" }); queryClient.invalidateQueries({ queryKey: ['/api/tasks'] }); }
                } catch (error) { toast({ title: "Pull failed", variant: "destructive" }); }
              }}
            >
              <div className="hover:opacity-80 transition-all duration-200" style={innerStyle('linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')} title="Pull events from Google Calendar">
                <Download style={{ color: 'white', strokeWidth: 2, height: '18px', width: '18px' }} />
              </div>
            </div>

            {/* Sync Button - Slot 3 */}
            <div 
              style={btnStyle(3, 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')}
              data-testid="button-sync-calendar"
              onClick={() => { if (!syncAllCalendarMutation.isPending) { if (window.confirm('Are you sure you want to sync?')) { triggerButtonGlow('sync'); syncAllCalendarMutation.mutate(); } } }}
            >
              <div className="hover:opacity-80 transition-all duration-200" style={innerStyle('linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')}>
                {syncAllCalendarMutation.isPending ? <Loader2 className="h-[18px] w-[18px] text-white animate-spin" /> : <RefreshCw className="h-[18px] w-[18px] text-white" />}
              </div>
            </div>

            {/* Kitchen Stop Button - Slot 4 */}
            <div 
              style={btnStyle(4, isKitchenPlaying ? 'linear-gradient(0deg, #8B0000 0%, #DC143C 50%, #FF4500 100%)' : 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', { animation: isKitchenPlaying ? 'pulse 2s infinite' : 'none' })}
              data-testid="button-kitchen-stop"
              onClick={handleKitchenStop}
            >
              <div className="hover:opacity-80 transition-all duration-200" style={innerStyle(isKitchenPlaying ? 'linear-gradient(180deg, #8B0000 0%, #DC143C 50%, #FF4500 100%)' : 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)', isKitchenPlaying ? 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 8px rgba(220,20,60,0.5)' : undefined)} title="Stop Kitchen Reading">
                <Square className="text-white fill-white" style={{ height: '14px', width: '14px' }} />
              </div>
            </div>

            {/* Radio Button - Slot 5 */}
            <div 
              style={btnStyle(5, 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')}
              data-testid="button-radio-dialog"
              onClick={() => { triggerButtonGlow('radio'); setIsRadioDialogOpen(true); }}
            >
              <div className="hover:opacity-80 transition-all duration-200" style={innerStyle('linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 50%, #4a4a4a 100%)')} title="Radio Controls">
                <Radio className="text-white" style={{ height: '16px', width: '16px' }} />
              </div>
            </div>
          </div>
        );
      })()}
      {/* Spring out honeycombs for course readings - moved outside files button */}
      {/* CPPA122 */}
      <div 
        className={`absolute transition-all duration-500 ease-out z-50 ${decorativeHoneycombHover === 'left' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ 
          width: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
          height: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
          top: decorativeHoneycombHover === 'left' ? `${432 + gridSizes.courseRowHeight * 1.2}px` : '455px',
          right: decorativeHoneycombHover === 'left' ? '-26px' : '30px',
          transformOrigin: 'center center'
        }}
      >
        <div 
          className="relative w-full h-full cursor-pointer"
          onClick={() => setReadingsPopupCourse(prev => prev === 'cppa122' ? null : 'cppa122')}
        >
          <img src={hexIcon} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
          <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: 'white', strokeWidth: 3 }} />
        </div>
      </div>
      {/* CFNF400 */}
      <div 
        className={`absolute transition-all duration-500 ease-out z-50 ${decorativeHoneycombHover === 'left' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ 
          width: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
          height: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
          top: decorativeHoneycombHover === 'left' ? `${432 + gridSizes.courseRowHeight * 2.2}px` : '455px',
          right: decorativeHoneycombHover === 'left' ? '-26px' : '30px',
          transformOrigin: 'center center',
          transitionDelay: '50ms'
        }}
      >
        <div 
          className="relative w-full h-full cursor-pointer"
          onClick={() => setReadingsPopupCourse(prev => prev === 'cfnf400' ? null : 'cfnf400')}
        >
          <img src={hexIcon} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
          <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: 'white', strokeWidth: 3 }} />
        </div>
      </div>
      {/* CASL101 */}
      <div 
        className={`absolute transition-all duration-500 ease-out z-50 ${decorativeHoneycombHover === 'left' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ 
          width: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
          height: decorativeHoneycombHover === 'left' ? gridSizes.courseRowHeight * 0.9 : gridSizes.courseRowHeight * 0.3,
          top: decorativeHoneycombHover === 'left' ? `${432 + gridSizes.courseRowHeight * 3.2}px` : '455px',
          right: decorativeHoneycombHover === 'left' ? '-26px' : '30px',
          transformOrigin: 'center center',
          transitionDelay: '100ms'
        }}
      >
        <div 
          className="relative w-full h-full cursor-pointer"
          onClick={() => setReadingsPopupCourse(prev => prev === 'casl101' ? null : 'casl101')}
        >
          <img src={hexIcon} alt="" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(2px 2px 1px rgba(10, 27, 34, 0.6))' }} />
          <FolderOpen className="absolute inset-0 m-auto h-4 w-4" style={{ color: 'white', strokeWidth: 3 }} />
        </div>
      </div>
      
      

      {/* Render Sticky Notes */}
      {stickyNotes.map((note) => {
        const noteColors: Record<string, { bg: string; border: string; header: string }> = {
          yellow: { bg: '#FFFACD', border: '#E6D200', header: '#FFE566' },
          pink: { bg: '#FFE4EC', border: '#FF69B4', header: '#FFB6C1' },
          blue: { bg: '#E0F0FF', border: '#4DA6FF', header: '#87CEEB' },
          green: { bg: '#E0FFE0', border: '#32CD32', header: '#98FB98' },
          orange: { bg: '#FFE4CC', border: '#FF8C00', header: '#FFCC99' },
          purple: { bg: '#F0E0FF', border: '#9370DB', header: '#DDA0DD' },
        };
        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const colors = note.customColor 
          ? { 
              bg: hexToRgba(note.customColor, 0.3), 
              border: note.customColor, 
              header: note.customColor 
            }
          : (noteColors[note.color] || noteColors.yellow);
        
        // Use local drag position during drag for smooth movement
        const isDragging = draggingStickyNote === note.id;
        const displayX = isDragging && dragPosition ? dragPosition.x : note.positionX;
        const displayY = isDragging && dragPosition ? dragPosition.y : note.positionY;
        
        return (
          <div
            key={note.id}
            data-sticky-note
            data-sticky-note-id={note.id}
            className="fixed shadow-lg rounded-md overflow-hidden"
            style={{
              left: `${displayX}px`,
              top: `${displayY}px`,
              width: `${note.width}px`,
              height: note.isMinimized ? '28px' : `${note.height}px`,
              zIndex: isDragging ? 10000 : (note.zIndex || 100),
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              pointerEvents: 'auto',
              willChange: isDragging ? 'left, top' : 'auto',
              transition: isDragging ? 'none' : undefined,
            }}
            data-testid={`sticky-note-${note.id}`}
          >
            {/* Header bar - draggable from anywhere */}
            <div
              className="flex items-center justify-between px-1 py-1 select-none cursor-move"
              style={{ backgroundColor: colors.header, borderBottom: `1px solid ${colors.border}`, touchAction: 'none' }}
              onMouseDown={(e) => handleStickyNotePointerDown(e, note.id, note)}
              onTouchStart={(e) => handleStickyNotePointerDown(e, note.id, note)}
            >
              <div className="flex items-center gap-1 flex-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center justify-center text-gray-600 hover:text-gray-800"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <Palette className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-0 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: '#4ade80' }}
                        title="CPPA122"
                        onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { customColor: '#4ade80', color: 'custom' } })}
                      />
                      <button
                        className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: '#f472b6' }}
                        title="CFNF400"
                        onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { customColor: '#f472b6', color: 'custom' } })}
                      />
                      <button
                        className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: '#818cf8' }}
                        title="CASL101"
                        onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { customColor: '#818cf8', color: 'custom' } })}
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  type="text"
                  value={getStickyNoteTitle(note)}
                  onChange={(e) => handleStickyNoteTitleChange(note.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-[10px] text-gray-700 font-medium border-none outline-none w-20 cursor-text rounded px-0.5"
                  style={{ backgroundColor: 'white', marginRight: '-8px' }}
                  placeholder="Note Name"
                  data-testid={`sticky-note-title-${note.id}`}
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Attachment indicator */}
                {(note.taskId || note.projectId) && (
                  <span className="text-[8px] text-gray-600 truncate max-w-[60px]" title={
                    note.taskId 
                      ? tasks.find(t => t.id === note.taskId)?.title || 'Task'
                      : allProjects?.find(p => p.id === note.projectId)?.name || 'Project'
                  }>
                    <Link2 className="h-2 w-2 inline" />
                  </span>
                )}
                {/* Reminder settings */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={`flex items-center justify-center ${note.reminderTime ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-800`}
                      title="Set reminder"
                    >
                      <Bell className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuLabel className="text-[9px] py-1" style={{ marginLeft: '0px' }}>Reminder Settings</DropdownMenuLabel>
                    <div className="space-y-2 p-1">
                      <div className="space-y-1">
                        <Label className="text-[9px]">Reminder Time</Label>
                        <Input
                          type="datetime-local"
                          className="h-6 text-[8px] px-1"
                          value={note.reminderTime ? format(new Date(note.reminderTime), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => {
                            const value = e.target.value ? new Date(e.target.value) : null;
                            updateStickyNoteMutation.mutate({ id: note.id, updates: { reminderTime: value } });
                          }}
                        />
                      </div>
                      <DropdownMenuSeparator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Volume2 className="h-3 w-3" />
                          <span className="text-[10px]">Alarm</span>
                        </div>
                        <Checkbox
                          checked={note.reminderAlarm}
                          onCheckedChange={(checked) => updateStickyNoteMutation.mutate({ id: note.id, updates: { reminderAlarm: !!checked } })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="text-[10px]">Email</span>
                        </div>
                        <Checkbox
                          checked={note.reminderEmail}
                          onCheckedChange={(checked) => updateStickyNoteMutation.mutate({ id: note.id, updates: { reminderEmail: !!checked } })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          <span className="text-[10px]">Push</span>
                        </div>
                        <Checkbox
                          checked={note.reminderPush}
                          onCheckedChange={(checked) => updateStickyNoteMutation.mutate({ id: note.id, updates: { reminderPush: !!checked } })}
                        />
                      </div>
                      {note.reminderTime && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-6 text-[10px] text-red-600 hover:text-red-700"
                          onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { reminderTime: null, reminderAlarm: false, reminderEmail: false, reminderPush: false } })}
                        >
                          Clear Reminder
                        </Button>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Attach to task/project */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center justify-center text-gray-600 hover:text-gray-800"
                      title="Attach to task or project"
                    >
                      <Paperclip className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto w-48">
                    <DropdownMenuLabel className="text-[10px] py-1">Attach to Task</DropdownMenuLabel>
                    <DropdownMenuItem 
                      className="text-[10px] py-1"
                      onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { taskId: null } })}
                    >
                      <span className="text-gray-500">None</span>
                    </DropdownMenuItem>
                    {tasks.slice(0, 20).map((task) => (
                      <DropdownMenuItem 
                        key={task.id}
                        className="text-[10px] py-1 truncate"
                        onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { taskId: task.id, projectId: null } })}
                      >
                        <span className={note.taskId === task.id ? "font-semibold" : ""}>
                          {task.title}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] py-1">Attach to Project</DropdownMenuLabel>
                    <DropdownMenuItem 
                      className="text-[10px] py-1"
                      onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { projectId: null } })}
                    >
                      <span className="text-gray-500">None</span>
                    </DropdownMenuItem>
                    {allProjects?.map((project) => (
                      <DropdownMenuItem 
                        key={project.id}
                        className="text-[10px] py-1 truncate"
                        onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { projectId: project.id, taskId: null } })}
                      >
                        <span className={note.projectId === project.id ? "font-semibold" : ""}>
                          {project.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={note.customColor || noteColors[note.color]?.header || '#FFFACD'}
                    onChange={(e) => updateStickyNoteMutation.mutate({ id: note.id, updates: { customColor: e.target.value, color: 'custom' } })}
                    className="absolute opacity-0 w-0 h-0"
                    id={`color-picker-${note.id}`}
                  />
                  <label
                    htmlFor={`color-picker-${note.id}`}
                    className="h-3 w-3 rounded-full border border-gray-400 hover:opacity-80 cursor-pointer block"
                    style={{ backgroundColor: note.customColor || colors.header }}
                  />
                </div>
                {/* Bullet list toggle */}
                <button
                  className="h-4 w-4 flex items-center justify-center text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    const textarea = document.querySelector(`[data-testid="sticky-note-content-${note.id}"]`) as HTMLTextAreaElement | null;
                    toggleStickyNoteBullets(note.id, textarea);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Toggle bullet list"
                  data-testid={`sticky-note-bullets-${note.id}`}
                >
                  <List className="h-3 w-3" />
                </button>
                {/* Minimize button */}
                <button
                  className="h-4 w-4 flex items-center justify-center text-gray-600 hover:text-gray-800"
                  onClick={() => updateStickyNoteMutation.mutate({ id: note.id, updates: { isMinimized: !note.isMinimized } })}
                >
                  {note.isMinimized ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </button>
                {/* Delete button */}
                <button
                  className="h-4 w-4 flex items-center justify-center text-gray-600 hover:text-red-600"
                  onClick={() => deleteStickyNoteMutation.mutate(note.id)}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Delete note"
                  data-testid={`sticky-note-delete-${note.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            {/* Content area */}
            {!note.isMinimized && (
              <>
                <textarea
                  className="w-full h-[calc(100%-28px)] p-2 text-[11px] resize-none border-0 outline-none !font-normal"
                  style={{ backgroundColor: 'transparent', fontFamily: 'inherit' }}
                  value={getStickyNoteContent(note)}
                  onChange={(e) => handleStickyNoteContentChange(note.id, e.target.value)}
                  onKeyDown={(e) => handleStickyNoteKeyDown(e, note.id)}
                  placeholder="Write your note here..."
                  data-testid={`sticky-note-content-${note.id}`}
                />
                {/* Resize handle - bottom right corner */}
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                  style={{
                    background: `linear-gradient(135deg, transparent 50%, ${colors.header} 50%)`,
                  }}
                  onMouseDown={(e) => handleStickyNoteResizeStart(e, note.id, note)}
                  onTouchStart={(e) => handleStickyNoteResizeStart(e, note.id, note)}
                  data-testid={`sticky-note-resize-${note.id}`}
                />
              </>
            )}
          </div>
        );
      })}

      {/* Main Content - Full width, positioned below unified header */}
      <main className="flex-1 pt-2 pb-2 flex flex-col overflow-visible relative z-10 min-h-0" style={{ paddingLeft: '29px', paddingRight: '0px', marginTop: '63px' }}>
        
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
                  const completedTasks = allTasks
                    .filter(t => t.isCompleted)
                    .sort((a, b) => {
                      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.dueDate).getTime();
                      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.dueDate).getTime();
                      return bTime - aTime;
                    });
                  
                  if (completedTasks.length === 0) {
                    return <div className="text-muted-foreground text-sm py-4 text-center">No completed tasks yet</div>;
                  }
                  
                  const getCourseColor = (courseName: string | null | undefined) => {
                    if (!courseName) return '#888888';
                    const course = coursesData.courses.find(c => c.name && courseName.includes(c.name.split(' - ')[0]));
                    return course?.color || '#888888';
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
          {/* Add Task Flyout - Burst from Top */}
          <div 
            className={`fixed transition-all ease-out ${isAddDialogOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}
            style={{ 
              width: '900px', 
              maxWidth: '95vw',
              height: '85vh',
              top: '50%',
              left: '50%',
              transform: isAddDialogOpen ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
              transformOrigin: '50% calc(-50vh + 42.5vh)',
              transitionDuration: '400ms',
              zIndex: getFlyoutZIndex('addTask')
            }}
            onClick={() => bringFlyoutToFront('addTask')}
          >
            {/* Flyout content */}
            <section 
              className="h-full overflow-hidden flex flex-col rounded-xl bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 text-white [&_label]:font-normal" 
              style={{
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
              data-testid="section-add-task"
            >
              {/* Header bar matching other flyouts */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <Button 
                  variant="outline"
                  className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200"
                  style={{
                    boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)';
                  }}
                  onClick={() => {
                    const form = document.querySelector('[data-task-form]') as HTMLFormElement;
                    if (form) form.requestSubmit();
                  }}
                  data-testid="button-submit-task-header"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-3 w-3 text-white" />
                    <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      NEW TASK
                    </h2>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setInitialStartTime("");
                      setInitialEndTime("");
                      setNewTaskType("module");
                    }}
                    className="text-white hover:text-white/80 transition-colors p-1"
                    data-testid="button-close-add-task"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-y-auto [&_label]:text-white [&_label]:font-normal [&_input]:font-normal [&_select]:font-normal [&_option]:font-normal [&_span]:text-white [&_p]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_svg]:text-white">
                <TaskForm 
                  key={`add-task-form-${selectedDate?.getTime() || 0}-${initialStartTime}-${initialEndTime}-${newTaskType}`}
                  weekNumber={selectedWeek}
                  initialDate={selectedDate}
                  initialType={newTaskType}
                  initialStartTime={initialStartTime}
                  initialEndTime={initialEndTime}
                  hideSubmitButton={true}
                  onSuccess={() => {
                    setIsAddDialogOpen(false);
                    setInitialStartTime("");
                    setInitialEndTime("");
                  }} 
                />
              </div>
            </section>
          </div>
          
          {/* Quick Add Wizard Dialog */}
          {isQuickAddOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={handleQuickAddClose}>
              <div className="absolute inset-0 bg-black/40" />
              <div 
                className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                style={{
                  width: '380px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                  fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
                onClick={(e) => e.stopPropagation()}
                data-testid="quick-add-wizard"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-black/30 border-b border-white/15">
                  <div className="flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5 text-white" />
                    <span className="text-[11px] text-white font-normal tracking-wide uppercase">
                      {quickAddStep === 0 ? 'Select Type' : quickAddStep === 1 ? 'Task Name' : quickAddStep === 2 ? 'Course' : quickAddStep === 3 ? 'Date & Time' : quickAddStep === 4 ? 'Prep Days' : quickAddStep === 5 ? 'Priority' : quickAddStep === 6 ? 'Reminders' : quickAddStep === 7 ? 'Attachments' : quickAddStep === 8 ? 'Notes & Links' : quickAddStep === 9 ? 'Subtasks & Project' : quickAddStep === 10 ? 'Repeat' : 'Review'}
                    </span>
                  </div>
                  <button onClick={handleQuickAddClose} className="text-white/50 hover:text-white transition-colors" data-testid="button-close-quick-add">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1 px-5 pt-3">
                  {Array.from({ length: 12 }, (_, s) => (
                    <div key={s} className="flex-1 h-[2px] rounded-full transition-colors duration-300" style={{ background: s <= quickAddStep ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)' }} />
                  ))}
                </div>

                {/* Content area */}
                <div className="px-5 py-5 min-h-[200px] max-h-[400px] overflow-y-auto flex flex-col [&_p]:text-white [&_span]:text-white [&_label]:text-white" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
                  {/* Step 0: Task Type */}
                  {quickAddStep === 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-white/60 text-[11px] mb-2">What would you like to add?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {TASK_TYPES.filter(t => t !== "class").map(type => (
                          <button
                            key={type}
                            className={`px-3 py-2.5 rounded-lg text-[12px] text-left transition-all duration-200 ${quickAddData.type === type ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                            onClick={() => { setQuickAddData(p => ({ ...p, type })); setQuickAddStep(1); }}
                            data-testid={`quick-add-type-${type}`}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 1: Title */}
                  {quickAddStep === 1 && (
                    <div className="flex flex-col gap-3 flex-1">
                      <p className="text-white/60 text-[11px]">Enter the {quickAddData.type} name</p>
                      <input
                        type="text"
                        value={quickAddData.title}
                        onChange={(e) => setQuickAddData(p => ({ ...p, title: e.target.value }))}
                        placeholder={`e.g. Chapter 5 ${quickAddData.type}`}
                        className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white text-[13px] placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors"
                        autoFocus
                        data-testid="quick-add-title"
                        onKeyDown={(e) => { if (e.key === 'Enter' && quickAddData.title.trim()) setQuickAddStep(2); }}
                      />
                    </div>
                  )}

                  {/* Step 2: Course */}
                  {quickAddStep === 2 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-white/60 text-[11px] mb-1">Select the course</p>
                      <button
                        className={`px-3 py-2.5 rounded-lg text-[12px] text-left transition-all duration-200 ${quickAddData.courseName === '' ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'}`}
                        onClick={() => { setQuickAddData(p => ({ ...p, courseName: '' })); setQuickAddStep(3); }}
                        data-testid="quick-add-course-none"
                      >
                        No course
                      </button>
                      {COURSES.map(course => (
                        <button
                          key={course.code}
                          className={`px-3 py-2.5 rounded-lg text-[12px] text-left transition-all duration-200 ${quickAddData.courseName === `${course.code} - ${course.name}` ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                          onClick={() => { setQuickAddData(p => ({ ...p, courseName: `${course.code} - ${course.name}` })); setQuickAddStep(3); }}
                          data-testid={`quick-add-course-${course.code}`}
                        >
                          {course.code} - {course.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Step 3: Due Date + Start/End Time */}
                  {quickAddStep === 3 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">When is it due?</p>
                      <input
                        type="date"
                        value={quickAddData.dueDate}
                        onChange={(e) => setQuickAddData(p => ({ ...p, dueDate: e.target.value }))}
                        className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white text-[13px] focus:outline-none focus:border-white/40 transition-colors [color-scheme:dark]"
                        data-testid="quick-add-due-date"
                      />
                      <div className="flex gap-2 items-center">
                        <span className="text-white/50 text-[11px]">Due time:</span>
                        <select
                          value={quickAddData.dueDateHour}
                          onChange={(e) => setQuickAddData(p => ({ ...p, dueDateHour: e.target.value }))}
                          className="bg-white/10 border border-white/15 rounded-lg px-2 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                          data-testid="quick-add-hour"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')} style={{ color: 'black' }}>
                              {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                            </option>
                          ))}
                        </select>
                        <span className="text-white/40">:</span>
                        <select
                          value={quickAddData.dueDateMinute}
                          onChange={(e) => setQuickAddData(p => ({ ...p, dueDateMinute: e.target.value }))}
                          className="bg-white/10 border border-white/15 rounded-lg px-2 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                          data-testid="quick-add-minute"
                        >
                          {['00', '15', '30', '45'].map(m => (
                            <option key={m} value={m} style={{ color: 'black' }}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="border-t border-white/10 pt-3 mt-1">
                        <p className="text-white/60 text-[11px] mb-2">Event time block (optional)</p>
                        <div className="flex gap-2 items-center">
                          <span className="text-white/50 text-[11px] w-[38px]">Start:</span>
                          <input
                            type="time"
                            value={quickAddData.eventStartTime}
                            onChange={(e) => setQuickAddData(p => ({ ...p, eventStartTime: e.target.value }))}
                            className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                            data-testid="quick-add-start-time"
                          />
                        </div>
                        <div className="flex gap-2 items-center mt-2">
                          <span className="text-white/50 text-[11px] w-[38px]">End:</span>
                          <input
                            type="time"
                            value={quickAddData.eventEndTime}
                            onChange={(e) => setQuickAddData(p => ({ ...p, eventEndTime: e.target.value }))}
                            className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                            data-testid="quick-add-end-time"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Prep Days */}
                  {quickAddStep === 4 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">How many preparation days are needed?</p>
                      <select
                        value={quickAddData.prepDays}
                        onChange={(e) => setQuickAddData(p => ({ ...p, prepDays: parseInt(e.target.value) }))}
                        className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white text-[13px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                        data-testid="quick-add-prep-days"
                      >
                        {Array.from({ length: 15 }, (_, i) => (
                          <option key={i} value={i} style={{ color: 'black' }}>{i === 0 ? 'None' : `${i} day${i > 1 ? 's' : ''}`}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Step 5: Priority */}
                  {quickAddStep === 5 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-white/60 text-[11px] mb-1">Set priority level</p>
                      {(['low', 'medium', 'high'] as const).map(p => (
                        <button
                          key={p}
                          className={`px-3 py-2.5 rounded-lg text-[12px] text-left transition-all duration-200 ${quickAddData.priority === p ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                          onClick={() => { setQuickAddData(prev => ({ ...prev, priority: p })); setQuickAddStep(6); }}
                          data-testid={`quick-add-priority-${p}`}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Step 6: Reminders */}
                  {quickAddStep === 6 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">Set reminders before due date</p>
                      {[
                        { label: 'Reminder 1', key: 'reminder1' as const },
                        { label: 'Reminder 2', key: 'reminder2' as const },
                        { label: 'Reminder 3', key: 'reminder3' as const },
                        { label: 'Reminder 4', key: 'reminder4' as const },
                      ].map(r => (
                        <div key={r.key} className="flex gap-2 items-center">
                          <span className="text-white/50 text-[11px] w-[72px]">{r.label}:</span>
                          <select
                            value={quickAddData[r.key] ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setQuickAddData(p => ({ ...p, [r.key]: val === 0 && (r.key === 'reminder3' || r.key === 'reminder4') ? null : val }));
                            }}
                            className="flex-1 bg-white/10 border border-white/15 rounded-lg px-2 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                            data-testid={`quick-add-${r.key}`}
                          >
                            {REMINDER_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value} style={{ color: 'black' }}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 7: Attachments */}
                  {quickAddStep === 7 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">Add attachments</p>
                      <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                        <Upload className="h-4 w-4 text-white/50" />
                        <span className="text-white/60 text-[12px]">Upload file</span>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files) return;
                            for (const file of Array.from(files)) {
                              try {
                                const response = await uploadDroppedFile(file);
                                if (response?.objectPath) {
                                  setQuickAddData(p => ({ ...p, attachments: [...p.attachments, response.objectPath] }));
                                }
                              } catch (err) {
                                toast({ title: "Upload failed", description: file.name, variant: "destructive" });
                              }
                            }
                          }}
                          data-testid="quick-add-file-upload"
                        />
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={quickAddData.pasteUrl}
                          onChange={(e) => setQuickAddData(p => ({ ...p, pasteUrl: e.target.value }))}
                          placeholder="Paste URL to attach..."
                          className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors"
                          data-testid="quick-add-paste-url"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && quickAddData.pasteUrl.trim()) {
                              setQuickAddData(p => ({ ...p, attachments: [...p.attachments, p.pasteUrl.trim()], pasteUrl: '' }));
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (quickAddData.pasteUrl.trim()) {
                              setQuickAddData(p => ({ ...p, attachments: [...p.attachments, p.pasteUrl.trim()], pasteUrl: '' }));
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-[11px] bg-white/15 text-white hover:bg-white/25 transition-colors"
                          data-testid="quick-add-paste-url-add"
                        >
                          Add
                        </button>
                      </div>
                      {quickAddData.attachments.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {quickAddData.attachments.map((att, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                              <Paperclip className="h-3 w-3 text-white/40 flex-shrink-0" />
                              <span className="text-white/70 text-[11px] truncate flex-1">{att.split('/').pop() || att}</span>
                              <button
                                onClick={() => setQuickAddData(p => ({ ...p, attachments: p.attachments.filter((_, i) => i !== idx) }))}
                                className="text-white/30 hover:text-red-400 transition-colors"
                                data-testid={`quick-add-remove-attachment-${idx}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {quickAddData.attachments.length === 0 && (
                        <p className="text-white/30 text-[10px] text-center">No attachments added yet</p>
                      )}
                    </div>
                  )}

                  {/* Step 8: Notes & Reference Links */}
                  {quickAddStep === 8 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">Add notes and reference links</p>
                      <div>
                        <span className="text-white/50 text-[11px]">Notes</span>
                        <textarea
                          value={quickAddData.notes}
                          onChange={(e) => setQuickAddData(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Add any notes..."
                          rows={3}
                          className="w-full mt-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors resize-none"
                          data-testid="quick-add-notes"
                        />
                      </div>
                      <div>
                        <span className="text-white/50 text-[11px]">Reference link</span>
                        <input
                          type="url"
                          value={quickAddData.referenceLink}
                          onChange={(e) => setQuickAddData(p => ({ ...p, referenceLink: e.target.value }))}
                          placeholder="https://..."
                          className="w-full mt-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors"
                          data-testid="quick-add-reference-link"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 9: Subtasks & Project */}
                  {quickAddStep === 9 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">Add subtasks and link to a project</p>
                      <div>
                        <span className="text-white/50 text-[11px]">Subtasks</span>
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={quickAddData.subtaskInput}
                            onChange={(e) => setQuickAddData(p => ({ ...p, subtaskInput: e.target.value }))}
                            placeholder="Add a subtask..."
                            className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors"
                            data-testid="quick-add-subtask-input"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && quickAddData.subtaskInput.trim()) {
                                setQuickAddData(p => ({ ...p, subtasks: [...p.subtasks, { title: p.subtaskInput.trim(), completed: false }], subtaskInput: '' }));
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              if (quickAddData.subtaskInput.trim()) {
                                setQuickAddData(p => ({ ...p, subtasks: [...p.subtasks, { title: p.subtaskInput.trim(), completed: false }], subtaskInput: '' }));
                              }
                            }}
                            className="px-3 py-2 rounded-lg text-[11px] bg-white/15 text-white hover:bg-white/25 transition-colors"
                            data-testid="quick-add-subtask-add"
                          >
                            Add
                          </button>
                        </div>
                        {quickAddData.subtasks.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-2">
                            {quickAddData.subtasks.map((st, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                                <div className="w-3 h-3 rounded-sm border border-white/30 flex-shrink-0" />
                                <span className="text-white/70 text-[11px] flex-1">{st.title}</span>
                                <button
                                  onClick={() => setQuickAddData(p => ({ ...p, subtasks: p.subtasks.filter((_, i) => i !== idx) }))}
                                  className="text-white/30 hover:text-red-400 transition-colors"
                                  data-testid={`quick-add-remove-subtask-${idx}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="border-t border-white/10 pt-3">
                        <span className="text-white/50 text-[11px]">Link to project</span>
                        <select
                          value={quickAddData.projectId ?? ''}
                          onChange={(e) => setQuickAddData(p => ({ ...p, projectId: e.target.value ? parseInt(e.target.value) : null }))}
                          className="w-full mt-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                          data-testid="quick-add-project"
                        >
                          <option value="" style={{ color: 'black' }}>No project</option>
                          {allProjects.map(proj => (
                            <option key={proj.id} value={proj.id} style={{ color: 'black' }}>{proj.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Step 10: Repeat */}
                  {quickAddStep === 10 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px]">Set task repetition</p>
                      <div className="flex flex-col gap-2">
                        {REPEAT_TYPES.map(rt => (
                          <button
                            key={rt}
                            className={`px-3 py-2.5 rounded-lg text-[12px] text-left transition-all duration-200 ${quickAddData.repeatType === rt ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                            onClick={() => setQuickAddData(p => ({ ...p, repeatType: rt }))}
                            data-testid={`quick-add-repeat-${rt}`}
                          >
                            {rt.charAt(0).toUpperCase() + rt.slice(1)}
                          </button>
                        ))}
                      </div>
                      {quickAddData.repeatType === 'custom' && (
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-white/50 text-[11px]">Every</span>
                          <input
                            type="number"
                            min={1}
                            value={quickAddData.repeatInterval ?? 1}
                            onChange={(e) => setQuickAddData(p => ({ ...p, repeatInterval: parseInt(e.target.value) || 1 }))}
                            className="w-16 bg-white/10 border border-white/15 rounded-lg px-2 py-2 text-white text-[12px] focus:outline-none focus:border-white/40"
                            data-testid="quick-add-repeat-interval"
                          />
                          <select
                            value={quickAddData.repeatIntervalUnit ?? 'days'}
                            onChange={(e) => setQuickAddData(p => ({ ...p, repeatIntervalUnit: e.target.value }))}
                            className="bg-white/10 border border-white/15 rounded-lg px-2 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                            data-testid="quick-add-repeat-unit"
                          >
                            {REPEAT_INTERVAL_UNITS.map(u => (
                              <option key={u} value={u} style={{ color: 'black' }}>{u}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {quickAddData.repeatType !== 'none' && (
                        <div className="mt-1">
                          <span className="text-white/50 text-[11px]">End date (optional)</span>
                          <input
                            type="date"
                            value={quickAddData.repeatEndDate}
                            onChange={(e) => setQuickAddData(p => ({ ...p, repeatEndDate: e.target.value }))}
                            className="w-full mt-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-[12px] focus:outline-none focus:border-white/40 [color-scheme:dark]"
                            data-testid="quick-add-repeat-end-date"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 11: Review & Submit */}
                  {quickAddStep === 11 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-white/60 text-[11px] mb-1">Review your task</p>
                      <div className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Type</span>
                          <span className="text-white">{quickAddData.type.charAt(0).toUpperCase() + quickAddData.type.slice(1)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Title</span>
                          <span className="text-white truncate ml-4">{quickAddData.title}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Course</span>
                          <span className="text-white">{quickAddData.courseName || 'None'}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Due Date</span>
                          <span className="text-white">{quickAddData.dueDate ? format(new Date(quickAddData.dueDate + 'T' + quickAddData.dueDateHour + ':' + quickAddData.dueDateMinute), "MMM d, yyyy 'at' h:mm a") : 'Not set'}</span>
                        </div>
                        {(quickAddData.eventStartTime || quickAddData.eventEndTime) && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Time Block</span>
                            <span className="text-white">{quickAddData.eventStartTime || '?'} - {quickAddData.eventEndTime || '?'}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Prep Days</span>
                          <span className="text-white">{quickAddData.prepDays === 0 ? 'None' : `${quickAddData.prepDays} day${quickAddData.prepDays > 1 ? 's' : ''}`}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Priority</span>
                          <span className="text-white">{quickAddData.priority.charAt(0).toUpperCase() + quickAddData.priority.slice(1)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/50">Reminders</span>
                          <span className="text-white text-right">
                            {[quickAddData.reminder1, quickAddData.reminder2, quickAddData.reminder3, quickAddData.reminder4]
                              .filter(r => r !== null && r !== undefined && r > 0)
                              .map(r => REMINDER_OPTIONS.find(o => o.value === r)?.label || `${r}m`)
                              .join(', ') || 'None'}
                          </span>
                        </div>
                        {quickAddData.attachments.length > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Attachments</span>
                            <span className="text-white">{quickAddData.attachments.length} file{quickAddData.attachments.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {quickAddData.notes && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Notes</span>
                            <span className="text-white truncate ml-4">{quickAddData.notes.substring(0, 40)}{quickAddData.notes.length > 40 ? '...' : ''}</span>
                          </div>
                        )}
                        {quickAddData.referenceLink && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Reference</span>
                            <span className="text-white truncate ml-4">{quickAddData.referenceLink.substring(0, 30)}...</span>
                          </div>
                        )}
                        {quickAddData.subtasks.length > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Subtasks</span>
                            <span className="text-white">{quickAddData.subtasks.length}</span>
                          </div>
                        )}
                        {quickAddData.projectId && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Project</span>
                            <span className="text-white">{allProjects.find(p => p.id === quickAddData.projectId)?.name || 'Unknown'}</span>
                          </div>
                        )}
                        {quickAddData.repeatType !== 'none' && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Repeat</span>
                            <span className="text-white">
                              {quickAddData.repeatType === 'custom'
                                ? `Every ${quickAddData.repeatInterval || 1} ${quickAddData.repeatIntervalUnit || 'days'}`
                                : quickAddData.repeatType.charAt(0).toUpperCase() + quickAddData.repeatType.slice(1)}
                              {quickAddData.repeatEndDate ? ` until ${format(new Date(quickAddData.repeatEndDate + 'T00:00'), 'MMM d, yyyy')}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer with navigation */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                  <button
                    onClick={() => { if (quickAddStep > 0) setQuickAddStep(s => s - 1); else handleQuickAddClose(); }}
                    className="text-white/50 hover:text-white text-[11px] transition-colors flex items-center gap-1"
                    data-testid="quick-add-back"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {quickAddStep === 0 ? 'Cancel' : 'Back'}
                  </button>

                  {quickAddStep < 11 && quickAddStep > 0 && (
                    <button
                      onClick={() => setQuickAddStep(s => s + 1)}
                      disabled={(quickAddStep === 1 && !quickAddData.title.trim()) || (quickAddStep === 3 && !quickAddData.dueDate)}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 bg-white/15 text-white hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed"
                      data-testid="quick-add-next"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {quickAddStep === 11 && (
                    <button
                      onClick={async () => {
                        try {
                          const dueDate = new Date(quickAddData.dueDate + 'T' + quickAddData.dueDateHour + ':' + quickAddData.dueDateMinute);
                          let startDate: string | null = null;
                          if (quickAddData.prepDays > 0) {
                            const sd = new Date(dueDate);
                            sd.setDate(sd.getDate() - quickAddData.prepDays);
                            startDate = sd.toISOString();
                          }
                          const res = await apiRequest("POST", "/api/tasks", {
                            title: quickAddData.title,
                            type: quickAddData.type,
                            courseName: quickAddData.courseName || null,
                            dueDate: dueDate.toISOString(),
                            startDate,
                            priority: quickAddData.priority,
                            weekNumber: selectedWeek,
                            description: quickAddData.description || "",
                            reminder1: quickAddData.reminder1,
                            reminder2: quickAddData.reminder2,
                            reminder3: quickAddData.reminder3,
                            reminder4: quickAddData.reminder4,
                            attachments: quickAddData.attachments.length > 0 ? quickAddData.attachments : [],
                            referenceLink: quickAddData.referenceLink || "",
                            repeatType: quickAddData.repeatType,
                            repeatInterval: quickAddData.repeatType === 'custom' ? quickAddData.repeatInterval : null,
                            repeatIntervalUnit: quickAddData.repeatType === 'custom' ? quickAddData.repeatIntervalUnit : null,
                            repeatEndDate: quickAddData.repeatEndDate ? new Date(quickAddData.repeatEndDate + 'T00:00').toISOString() : null,
                            eventStartTime: quickAddData.eventStartTime || null,
                            eventEndTime: quickAddData.eventEndTime || null,
                            notes: quickAddData.notes || null,
                            projectId: quickAddData.projectId,
                          });
                          const newTask = await res.json();
                          if (quickAddData.subtasks.length > 0 && newTask?.id) {
                            for (let i = 0; i < quickAddData.subtasks.length; i++) {
                              try {
                                await apiRequest("POST", "/api/subtasks", {
                                  taskId: newTask.id,
                                  title: quickAddData.subtasks[i].title,
                                  isCompleted: false,
                                  position: i,
                                });
                              } catch (e) {
                                console.error('Failed to create subtask:', e);
                              }
                            }
                          }
                          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/subtasks"] });
                          setIsQuickAddOpen(false);
                          toast({ title: "Task added", description: `${quickAddData.title} has been added to your calendar.` });
                        } catch (err) {
                          toast({ title: "Error", description: "Failed to add task. Please try again.", variant: "destructive" });
                        }
                      }}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-medium bg-white/20 text-white hover:bg-white/30 transition-all duration-200 border border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                      data-testid="quick-add-submit"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Task
                    </button>
                  )}
                </div>
              </div>
              {showQuickAddCloseConfirm && (
                <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 'inherit' }}>
                  <div className="flex flex-col items-center gap-4 px-6 py-5 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(40,40,50,0.98), rgba(20,20,30,0.99))', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    <p className="text-white text-[12px] text-center">You have unsaved changes.<br />Discard this task?</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowQuickAddCloseConfirm(false)}
                        className="px-4 py-2 rounded-lg text-[11px] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all duration-200"
                        data-testid="quick-add-cancel-discard"
                      >
                        Go Back
                      </button>
                      <button
                        onClick={() => { setShowQuickAddCloseConfirm(false); setIsQuickAddOpen(false); }}
                        className="px-4 py-2 rounded-lg text-[11px] text-white bg-red-600/80 hover:bg-red-600 border border-red-500/30 transition-all duration-200"
                        data-testid="quick-add-confirm-discard"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AAS Reminder Popup */}
          <Dialog open={showAasReminder} onOpenChange={setShowAasReminder}>
            <DialogContent className="max-w-sm text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white p-0 [&>button.absolute]:hidden" style={{ top: '45%' }}>
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    AAS REMINDER
                  </h2>
                </div>
                <button 
                  onClick={() => setShowAasReminder(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-aas-reminder"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-[12px] text-white/90">
                  You haven't confirmed sending your AAS letter via the portal for the following course(s):
                </p>
                <div className="space-y-2">
                  {coursesData.courses.filter(c => c.name.trim()).filter(c => {
                    const code = c.name.split(' - ')[0];
                    return !aasSentStatus[code];
                  }).map((course, idx) => {
                    const code = course.name.split(' - ')[0];
                    const name = course.name.split(' - ').slice(1).join(' - ');
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: course.color }} />
                        <span className="text-[11px] font-medium">{code}</span>
                        {name && <span className="text-[11px] text-white/70">- {name}</span>}
                        {course.professor && <span className="text-[10px] text-white/50 ml-auto">({course.professor})</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-white/60">
                  Please send your Academic Accommodation Support letter to each professor via the portal. Check off the AAS box once sent.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-white/30 text-white hover:text-white hover:bg-white/10"
                  onClick={() => setShowAasReminder(false)}
                  data-testid="button-dismiss-aas-reminder"
                >
                  Got it
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Profile Dialog */}
          <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
            <DialogContent className="max-w-md text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white p-0 [&>button.absolute]:hidden" style={{ top: '55%' }}>
              {/* Header bar matching flyouts */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-white" />
                  <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    PROFILE
                  </h2>
                </div>
                <button 
                  onClick={() => setIsProfileDialogOpen(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-profile"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <ProfileForm 
                  profileData={profileData} 
                  timezones={timezones} 
                  onSave={saveProfile}
                  onCancel={() => setIsProfileDialogOpen(false)} 
                />
              </div>
            </DialogContent>
          </Dialog>
          
          {/* School Dialog */}
          <Dialog open={isSchoolDialogOpen} onOpenChange={(open) => { if (!isNewCourseDialogOpen && !newCourseDialogClosingRef.current) setIsSchoolDialogOpen(open); }}>
            <DialogContent 
              className="overflow-hidden flex flex-col max-w-4xl max-h-[90vh] text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white p-0 [&>button.absolute]:hidden"
              onInteractOutside={(e) => { if (isNewCourseDialogOpen || newCourseDialogClosingRef.current) e.preventDefault(); }}
              onEscapeKeyDown={(e) => { if (isNewCourseDialogOpen || newCourseDialogClosingRef.current) e.preventDefault(); }}
              onPointerDownOutside={(e) => { if (isNewCourseDialogOpen || newCourseDialogClosingRef.current) e.preventDefault(); }}
              onFocusOutside={(e) => { if (isNewCourseDialogOpen || newCourseDialogClosingRef.current) e.preventDefault(); }}
            >
              {/* Header bar matching flyouts */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-white/70" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3 w-3 text-white" />
                    <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      SCHOOL SETTINGS
                    </h2>
                  </div>
                  <button 
                    onClick={() => setIsSchoolDialogOpen(false)}
                    className="text-white hover:text-white/80 transition-colors p-1"
                    data-testid="button-close-school"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column - School & Semester Settings */}
                <div className="flex flex-col gap-4" style={{ paddingTop: '0px' }}>
                <SchoolForm 
                  schoolData={schoolData}
                  semesterSettings={semesterSettings}
                  onSave={saveSchool}
                  onCancel={() => setIsSchoolDialogOpen(false)} 
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-8 px-6 self-start"
                  style={{
                    boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                    fontSize: '12px'
                  }}
                  onClick={() => setIsNewCourseDialogOpen(true)}
                  data-testid="button-new-course-school"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Course
                </Button>
                </div>
                
                {/* Right Column - Courses & Weeks */}
                <div className="flex flex-col gap-4" style={{ paddingTop: '0px', marginTop: '-8px' }}>
                {/* Course Legend */}
                <div className="border rounded-lg p-3 space-y-3 mt-2">
                  <Label className="text-[10px] font-medium">Courses</Label>
                  {coursesData.courses.filter(course => course.name.trim()).map((course, index) => {
                    const courseCode = course.name.split(' - ')[0];
                    const courseName = course.name.split(' - ').slice(1).join(' - ') || course.name;
                    const tomorrow = addDays(startOfDay(new Date()), 1);
                    const hasDueTomorrow = allTasks.some(task => 
                      task.courseName?.includes(courseCode) && 
                      !task.isCompleted &&
                      isSameDay(new Date(task.dueDate), tomorrow)
                    );
                    const professorEmail = course.professorEmail;
                    const semCourse = semesterSettings ? (() => {
                      const idx = index + 1;
                      const s = semesterSettings as any;
                      return {
                        delivery: s[`course${idx}DeliveryMode`],
                        day: s[`course${idx}ClassDay`],
                        day2: s[`course${idx}ClassDay2`],
                        time: s[`course${idx}ClassTime`],
                        endTime: s[`course${idx}ClassEndTime`],
                      };
                    })() : null;
                    return (
                      <div key={index} className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-shrink-0">
                            <div 
                              className={`w-3 h-3 rounded-full cursor-pointer ${hasDueTomorrow ? "animate-blink" : ""}`} 
                              style={{ backgroundColor: course.color }}
                              onClick={() => document.getElementById(`school-course-color-${index}`)?.click()}
                            />
                            <input
                              id={`school-course-color-${index}`}
                              type="color"
                              value={course.color}
                              onChange={(e) => {
                                const updatedCourses = [...coursesData.courses];
                                updatedCourses[index] = { ...updatedCourses[index], color: e.target.value };
                                setCoursesData({ courses: updatedCourses });
                                localStorage.setItem('coursesData', JSON.stringify({ courses: updatedCourses }));
                                saveCourses({ courses: updatedCourses });
                              }}
                              className="absolute inset-0 w-0 h-0 opacity-0"
                              data-testid={`input-school-course-color-${index}`}
                            />
                          </div>
                          <span className="text-[10px] text-white">
                            <span className="font-medium">{courseCode}</span>
                            {courseName !== courseCode && <span className="text-white/80"> {courseName}</span>}
                          </span>
                          {course.professor && (
                            professorEmail ? (
                              <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(professorEmail)}&su=${encodeURIComponent(`${courseCode} - `)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] !text-blue-400 underline hover:!text-blue-300 cursor-pointer"
                                data-testid={`link-school-email-professor-${index + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                {course.professor}
                              </a>
                            ) : (
                              <span className="text-[10px] text-white/70">{course.professor}</span>
                            )
                          )}
                          <button
                            className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSchoolEditCourseData({
                                code: courseCode,
                                name: courseName !== courseCode ? courseName : '',
                                professor: course.professor || '',
                                email: course.professorEmail || '',
                                calendarLabel: courseDisplayNames[courseCode] || courseCode,
                              });
                              setSchoolEditCourseIdx(index);
                            }}
                            data-testid={`button-edit-course-${index}`}
                          >
                            <Pencil className="w-2.5 h-2.5 text-white/50 hover:text-white/80" />
                          </button>
                          <label className="flex items-center gap-1 ml-auto cursor-pointer" data-testid={`checkbox-school-aas-${courseCode}`} onClick={() => toggleAasSent(courseCode)}>
                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${aasSentStatus[courseCode] ? 'bg-blue-500 border-blue-500' : 'border-amber-400 bg-transparent'}`}>
                              {aasSentStatus[courseCode] && (
                                <Check className="w-2.5 h-2.5 text-white" />
                              )}
                            </div>
                            <span className={`text-[10px] ${aasSentStatus[courseCode] ? 'text-blue-400' : 'text-amber-400'}`}>
                              AAS
                            </span>
                          </label>
                        </div>
                        {semCourse && (semCourse.delivery || semCourse.day || semCourse.time) && (
                          <div className="flex items-center gap-2 pl-4 text-[9px] text-white/50">
                            {semCourse.delivery && <span>{semCourse.delivery}</span>}
                            {semCourse.day && <span>{semCourse.day}{semCourse.day2 ? `/${semCourse.day2}` : ''}</span>}
                            {semCourse.time && <span>{semCourse.time}{semCourse.endTime ? `-${semCourse.endTime}` : ''}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Course Edit Dialog */}
                {schoolEditCourseIdx !== null && (
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setSchoolEditCourseIdx(null)}>
                    <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-white/20 rounded-lg p-4 w-[280px] space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <h3 className="text-[11px] font-medium text-white">Edit Course</h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[9px] text-white/60 block mb-0.5">Course Code</label>
                          <input
                            type="text"
                            className="w-full text-[10px] text-white bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/50"
                            value={schoolEditCourseData.code}
                            onChange={(e) => setSchoolEditCourseData(prev => ({ ...prev, code: e.target.value }))}
                            data-testid="input-edit-course-code"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/60 block mb-0.5">Course Name</label>
                          <input
                            type="text"
                            className="w-full text-[10px] text-white bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/50"
                            value={schoolEditCourseData.name}
                            onChange={(e) => setSchoolEditCourseData(prev => ({ ...prev, name: e.target.value }))}
                            data-testid="input-edit-course-name"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/60 block mb-0.5">Calendar Label</label>
                          <input
                            type="text"
                            className="w-full text-[10px] text-white bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/50"
                            value={schoolEditCourseData.calendarLabel}
                            onChange={(e) => setSchoolEditCourseData(prev => ({ ...prev, calendarLabel: e.target.value }))}
                            placeholder={schoolEditCourseData.code}
                            data-testid="input-edit-calendar-label"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/60 block mb-0.5">Professor Name</label>
                          <input
                            type="text"
                            className="w-full text-[10px] text-white bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/50"
                            value={schoolEditCourseData.professor}
                            onChange={(e) => setSchoolEditCourseData(prev => ({ ...prev, professor: e.target.value }))}
                            data-testid="input-edit-professor-name"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/60 block mb-0.5">Professor Email</label>
                          <input
                            type="text"
                            className="w-full text-[10px] text-white bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/50"
                            value={schoolEditCourseData.email}
                            onChange={(e) => setSchoolEditCourseData(prev => ({ ...prev, email: e.target.value }))}
                            data-testid="input-edit-professor-email"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] h-6 px-2 text-white/70"
                          onClick={() => setSchoolEditCourseIdx(null)}
                          data-testid="button-cancel-edit-course"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="text-[10px] h-6 px-3 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            const updatedCourses = [...coursesData.courses];
                            const fullName = schoolEditCourseData.name
                              ? `${schoolEditCourseData.code} - ${schoolEditCourseData.name}`
                              : schoolEditCourseData.code;
                            updatedCourses[schoolEditCourseIdx] = {
                              ...updatedCourses[schoolEditCourseIdx],
                              name: fullName,
                              professor: schoolEditCourseData.professor,
                              professorEmail: schoolEditCourseData.email,
                            };
                            setCoursesData({ courses: updatedCourses });
                            localStorage.setItem('coursesData', JSON.stringify({ courses: updatedCourses }));
                            saveCourses({ courses: updatedCourses });
                            const newDisplayNames = { ...courseDisplayNames };
                            if (schoolEditCourseData.calendarLabel.trim()) {
                              newDisplayNames[schoolEditCourseData.code] = schoolEditCourseData.calendarLabel.trim();
                            } else {
                              delete newDisplayNames[schoolEditCourseData.code];
                            }
                            setCourseDisplayNames(newDisplayNames);
                            _courseDisplayNames = newDisplayNames;
                            localStorage.setItem('courseDisplayNames', JSON.stringify(newDisplayNames));
                            setSchoolEditCourseIdx(null);
                          }}
                          data-testid="button-save-edit-course"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Weeks */}
                <div className="border rounded-lg p-3 space-y-0">
                  <Label className="text-[10px] font-medium">Weeks</Label>
                  {[...weeks].sort((a, b) => {
                    const today = startOfDay(new Date());
                    const aEndDay = startOfDay(parseISO(a.endDate));
                    const bEndDay = startOfDay(parseISO(b.endDate));
                    const aFinished = aEndDay < today;
                    const bFinished = bEndDay < today;
                    if (aFinished && !bFinished) return 1;
                    if (!aFinished && bFinished) return -1;
                    return a.weekNumber - b.weekNumber;
                  }).map((week) => {
                    const weekEnd = parseISO(week.endDate);
                    const isWeekFinished = startOfDay(weekEnd) < startOfDay(new Date());
                    const isSelected = selectedWeek === week.weekNumber && !selectedDate;
                    return (
                      <div key={week.weekNumber} className={`flex items-center gap-0.5 rounded-md`} style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.15)' } : undefined}>
                        <Button
                          variant="ghost"
                          className={`justify-start gap-1 h-auto py-0 px-1 w-full ${isWeekFinished ? "opacity-60" : ""} ${isSelected ? "bg-transparent hover:bg-transparent" : ""}`}
                          size="sm"
                          onClick={() => {
                            setSelectedWeek(week.weekNumber);
                            setSelectedDate(null);
                            setIsSchoolDialogOpen(false);
                          }}
                          data-testid={`button-week-school-${week.weekNumber}`}
                        >
                          <div className={`flex items-center gap-1 ${isWeekFinished ? "line-through" : ""}`}>
                            <Calendar className="h-3 w-3 text-white" />
                            <span className="text-[10px] text-white">Week {week.weekNumber}</span>
                            <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-white/70'}`}>
                              ({format(parseISO(week.startDate), "MMM d")} - {format(parseISO(week.endDate), "MMM d")})
                            </span>
                          </div>
                          {week.taskCount > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 min-w-5 text-center justify-center ml-auto text-white border-white">
                              {week.taskCount}
                            </Badge>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>
              </div>
              <div className="px-4 py-3 border-t border-white/20 bg-black/30 flex justify-end">
                <Button 
                  type="submit" 
                  form="school-settings-form"
                  variant="outline"
                  className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-8 px-6" 
                  style={{
                    boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                    fontSize: '12px'
                  }}
                  data-testid="button-save-school"
                >
                  Save School Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Courses Dialog */}
          <Dialog open={isCoursesDialogOpen} onOpenChange={setIsCoursesDialogOpen}>
            <DialogContent className="max-w-xl text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white p-0 [&>button.absolute]:hidden" style={{ top: '55%' }}>
              {/* Header bar matching flyouts */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-3 w-3 text-white" />
                  <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    COURSES & SCHEDULE
                  </h2>
                </div>
                <button 
                  onClick={() => setIsCoursesDialogOpen(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-courses"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <CoursesForm 
                  coursesData={coursesData}
                  semesterSettings={semesterSettings}
                  onSave={saveCourses}
                  onSaveSemesterSchedule={(data) => saveSemesterScheduleMutation.mutate(data)}
                  onGenerateClassTasks={() => generateClassTasksMutation.mutate()}
                  isGenerating={generateClassTasksMutation.isPending}
                  onCancel={() => setIsCoursesDialogOpen(false)} 
                />
              </div>
            </DialogContent>
          </Dialog>
          
          {/* New Course Dialog (opened from grad cap menu) */}
          <Dialog open={isNewCourseDialogOpen} onOpenChange={(open) => { if (!open) { newCourseDialogClosingRef.current = true; setIsNewCourseDialogOpen(false); setTimeout(() => { newCourseDialogClosingRef.current = false; }, 300); } }}>
            <DialogContent 
              className="overflow-hidden flex flex-col w-[520px] max-h-[85vh] text-[11px] bg-gradient-to-br from-gray-800 via-[#111] to-gray-900 border border-white/20 text-white shadow-2xl p-0 [&>button.absolute]:hidden"
              onInteractOutside={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">New Course</DialogTitle>
              <NewCourseDialogInner
                onSave={(courseData) => {
                  const fullName = `${courseData.courseCode} - ${courseData.courseName}`;
                  const updatedCourses = [...coursesData.courses];
                  const emptyIdx = updatedCourses.findIndex(c => !c.name.trim());
                  if (emptyIdx === -1 && updatedCourses.filter(c => c.name.trim()).length >= 3) {
                    toast({ title: "Maximum courses reached", description: "You can only have up to 3 courses.", variant: "destructive" });
                    return;
                  }
                  const targetIdx = emptyIdx !== -1 ? emptyIdx : updatedCourses.length;
                  if (emptyIdx !== -1) {
                    updatedCourses[emptyIdx] = {
                      name: fullName,
                      color: courseData.color,
                      professor: courseData.professorName,
                      professorEmail: courseData.professorEmail,
                    };
                  } else {
                    updatedCourses.push({
                      name: fullName,
                      color: courseData.color,
                      professor: courseData.professorName,
                      professorEmail: courseData.professorEmail,
                    });
                  }
                  setCoursesData({ courses: updatedCourses });
                  localStorage.setItem('coursesData', JSON.stringify({ courses: updatedCourses }));

                  const prefix = `course${targetIdx + 1}`;
                  if (targetIdx < 3) {
                    const schedulePayload: Record<string, any> = {
                      semesterType: courseData.semesterType,
                      [`${prefix}DeliveryMode`]: courseData.deliveryMode || null,
                      [`${prefix}ClassDay`]: courseData.classDay || null,
                      [`${prefix}ClassDay2`]: courseData.classDay2 || null,
                      [`${prefix}ClassTime`]: courseData.classTime || null,
                      [`${prefix}ClassEndTime`]: courseData.classEndTime || null,
                      [`${prefix}SpringSummerTerm`]: courseData.springSummerTerm || null,
                      [`${prefix}StartDate`]: courseData.startDate ? new Date(courseData.startDate).toISOString() : null,
                      [`${prefix}EndDate`]: courseData.endDate ? new Date(courseData.endDate).toISOString() : null,
                    };
                    saveSemesterScheduleMutation.mutate(schedulePayload);
                  }

                  if (courseData.reminders && courseData.reminders.length > 0) {
                    const courseReminders = JSON.parse(localStorage.getItem('courseReminders') || '{}');
                    courseReminders[fullName] = courseData.reminders;
                    localStorage.setItem('courseReminders', JSON.stringify(courseReminders));
                  }

                  newCourseDialogClosingRef.current = true;
                  setIsNewCourseDialogOpen(false);
                  setTimeout(() => { newCourseDialogClosingRef.current = false; }, 300);
                  toast({ title: "Course added", description: `${fullName} has been added.` });

                  if (courseData.deadlines.length > 0) {
                    (async () => {
                      for (const deadline of courseData.deadlines) {
                        if (deadline.title && deadline.dueDate) {
                          try {
                            const dueDate = new Date(deadline.dueDate);
                            dueDate.setHours(23, 59, 0, 0);
                            await apiRequest("POST", "/api/tasks", {
                              title: deadline.title,
                              description: deadline.description || '',
                              type: deadline.type || 'assignment',
                              courseName: fullName,
                              dueDate: dueDate.toISOString(),
                              priority: deadline.type === 'exam' || deadline.type === 'quiz' ? 'high' : 'medium',
                              weekNumber: getWeekNumber(dueDate),
                              reminder1: DEFAULT_REMINDER_1,
                              reminder2: DEFAULT_REMINDER_2,
                            });
                          } catch (err) {
                            console.error("Failed to create deadline task:", err);
                          }
                        }
                      }
                      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                      toast({ title: "Deadlines created", description: `${courseData.deadlines.length} deadline(s) added for ${courseData.courseCode}.` });
                    })();
                  }
                }}
                onClose={() => {
                  newCourseDialogClosingRef.current = true;
                  setIsNewCourseDialogOpen(false);
                  setTimeout(() => { newCourseDialogClosingRef.current = false; }, 300);
                }}
              />
            </DialogContent>
          </Dialog>

          {/* Settings Dialog */}
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogContent data-settings-dialog className="max-w-4xl max-h-[90vh] text-[9px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white [&_.text-sm]:text-xs [&_.text-xs]:text-[9px] [&_.text-muted-foreground]:text-[8px] p-0 [&>button.absolute]:hidden flex flex-col overflow-hidden">
              {/* Header bar matching flyouts */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Settings className="h-3 w-3 text-white" />
                  <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>
                    SETTINGS
                  </h2>
                </div>
                <button 
                  onClick={() => setIsSettingsDialogOpen(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-settings-dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-4 pb-4 pt-0 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col gap-4">
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Colour Settings</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Customise colours for the app</span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Box Background Colour */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Task Boxes Background</Label>
                      <span className="text-xs text-muted-foreground font-mono w-[52px] text-right flex-shrink-0">{colorSettings.boxBackground}</span>
                      <div className="w-14 flex justify-end">
                        <div className="relative">
                          <div 
                            className="w-5 h-5 rounded cursor-pointer border border-white/30"
                            style={{ 
                              backgroundColor: colorSettings.boxGlassEffect 
                                ? `rgba(${parseInt(colorSettings.boxBackground.slice(1,3), 16)}, ${parseInt(colorSettings.boxBackground.slice(3,5), 16)}, ${parseInt(colorSettings.boxBackground.slice(5,7), 16)}, ${colorSettings.boxTransparency / 100})`
                                : colorSettings.boxBackground
                            }}
                            onClick={() => document.getElementById('color-box-background-input')?.click()}
                            data-testid="color-box-background"
                          />
                          <input
                            id="color-box-background-input"
                            type="color"
                            value={colorSettings.boxBackground}
                            onChange={(e) => setColorSettings(prev => ({ ...prev, boxBackground: e.target.value }))}
                            className="absolute opacity-0 w-0 h-0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Glass Effect Toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Header Glass Effect</Label>
                      <div 
                        className={`w-5 h-2.5 rounded-full cursor-pointer transition-colors flex items-center ${colorSettings.boxGlassEffect ? 'bg-[#3b82f6]' : 'bg-gray-400'}`}
                        onClick={() => setColorSettings(prev => ({ ...prev, boxGlassEffect: !prev.boxGlassEffect }))}
                        data-testid="toggle-glass-effect"
                      >
                        <div className={`w-1.5 h-1.5 bg-white rounded-full transition-transform ${colorSettings.boxGlassEffect ? 'translate-x-3' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                    
                    {/* Transparency Slider */}
                    {colorSettings.boxGlassEffect && (
                      <div className="flex items-center gap-3">
                        <Label className="text-xs whitespace-nowrap flex-1">Transparency</Label>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={colorSettings.boxTransparency}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, boxTransparency: parseInt(e.target.value) }))}
                          className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                          data-testid="slider-transparency"
                        />
                        <span className="text-xs text-muted-foreground w-14 text-right">{colorSettings.boxTransparency}%</span>
                      </div>
                    )}
                    
                    {/* Header Bar Colour */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Summary Box Headers</Label>
                      <span className="text-xs text-muted-foreground font-mono w-[52px] text-right flex-shrink-0">{colorSettings.headerBar}</span>
                      <div className="w-14 flex justify-end">
                        <div className="relative">
                          <div 
                            className="w-5 h-5 rounded cursor-pointer border border-white/30"
                            style={{ backgroundColor: colorSettings.headerBar }}
                            onClick={() => document.getElementById('color-header-bar-input')?.click()}
                            data-testid="color-header-bar"
                          />
                          <input
                            id="color-header-bar-input"
                            type="color"
                            value={colorSettings.headerBar}
                            onChange={(e) => setColorSettings(prev => ({ ...prev, headerBar: e.target.value }))}
                            className="absolute opacity-0 w-0 h-0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Today Column Cell Background */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Today Column</Label>
                      <span className="text-xs text-muted-foreground font-mono w-[52px] text-right flex-shrink-0">{colorSettings.todayCellBackground}</span>
                      <div className="w-14 flex justify-end">
                        <input
                          type="color"
                          value={colorSettings.todayCellBackground}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, todayCellBackground: e.target.value }))}
                          className="w-5 h-5 cursor-pointer border-0 p-0 bg-transparent"
                          style={{ WebkitAppearance: 'none' }}
                          data-testid="color-today-cell"
                        />
                      </div>
                    </div>
                    
                    {/* Current Time Row Background */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Current Time Row</Label>
                      <span className="text-xs text-muted-foreground font-mono w-[52px] text-right flex-shrink-0">{colorSettings.currentHourRowBackground}</span>
                      <div className="w-14 flex justify-end">
                        <input
                          type="color"
                          value={colorSettings.currentHourRowBackground}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, currentHourRowBackground: e.target.value }))}
                          className="w-5 h-5 cursor-pointer border-0 p-0 bg-transparent"
                          style={{ WebkitAppearance: 'none' }}
                          data-testid="color-current-hour-row"
                        />
                      </div>
                    </div>
                    
                    {/* Today Date & Current Hour Cell Background */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Today Date & Current Hour</Label>
                      <span className="text-xs text-muted-foreground font-mono w-[52px] text-right flex-shrink-0">{colorSettings.todayCurrentHourCellBackground}</span>
                      <div className="w-14 flex justify-end">
                        <input
                          type="color"
                          value={colorSettings.todayCurrentHourCellBackground}
                          onChange={(e) => setColorSettings(prev => ({ ...prev, todayCurrentHourCellBackground: e.target.value }))}
                          className="w-5 h-5 cursor-pointer border-0 p-0 bg-transparent"
                          style={{ WebkitAppearance: 'none' }}
                          data-testid="color-today-current-hour-cell"
                        />
                      </div>
                    </div>
                    
                    {/* Main Background Overlay Toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Main Background Colour Overlay</Label>
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-5 h-2.5 rounded-full cursor-pointer transition-colors flex items-center ${colorSettings.mainBackgroundOverlay ? 'bg-[#3b82f6]' : 'bg-gray-400'}`}
                          onClick={() => setColorSettings(prev => ({ ...prev, mainBackgroundOverlay: !prev.mainBackgroundOverlay }))}
                          data-testid="toggle-background-overlay"
                        >
                          <div className={`w-1.5 h-1.5 bg-white rounded-full transition-transform ${colorSettings.mainBackgroundOverlay ? 'translate-x-3' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    </div>
                    
                    {/* Main Background Colour - always visible */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Main Background Colour <span className="text-[10px] italic text-muted-foreground whitespace-nowrap">(Overlay toggle must be on)</span></Label>
                      <span className="text-xs text-muted-foreground font-mono w-[52px] text-right flex-shrink-0">{colorSettings.mainBackground}</span>
                      <div className="w-14 flex justify-end flex-shrink-0">
                        <div className="relative w-5 h-5">
                          <div 
                            className={`w-5 h-5 rounded border border-white/30 ${colorSettings.mainBackgroundOverlay ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                            style={{ backgroundColor: colorSettings.mainBackground }}
                            onClick={() => colorSettings.mainBackgroundOverlay && document.getElementById('color-main-background-input')?.click()}
                            data-testid="color-main-background"
                          />
                          {/* Red X when disabled */}
                          {!colorSettings.mainBackgroundOverlay && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                              <X className="w-4 h-4" strokeWidth={1.5} style={{ stroke: '#dc2626', color: '#dc2626' }} />
                            </div>
                          )}
                          <input
                            id="color-main-background-input"
                            type="color"
                            value={colorSettings.mainBackground}
                            onChange={(e) => setColorSettings(prev => ({ ...prev, mainBackground: e.target.value }))}
                            className="absolute opacity-0 w-0 h-0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Layout Settings - in left column */}
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Layout Settings</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Adjust spacing and reset column widths</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Header Button Spacing</Label>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        step="2"
                        value={blinkSettings.buttonSpacing}
                        onChange={(e) => setBlinkSettings(prev => ({ ...prev, buttonSpacing: Number(e.target.value) }))}
                        className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                        data-testid="slider-button-spacing"
                      />
                      <span className="text-xs text-muted-foreground w-14 text-right">{blinkSettings.buttonSpacing}px</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Media Controls Spacing</Label>
                      <input
                        type="range"
                        min="4"
                        max="40"
                        step="2"
                        value={blinkSettings.mediaControlSpacing}
                        onChange={(e) => setBlinkSettings(prev => ({ ...prev, mediaControlSpacing: Number(e.target.value) }))}
                        className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                        data-testid="slider-media-control-spacing"
                      />
                      <span className="text-xs text-muted-foreground w-14 text-right">{blinkSettings.mediaControlSpacing}px</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Menu Background Button Spacing</Label>
                      <input
                        type="range"
                        min="-20"
                        max="40"
                        step="1"
                        value={blinkSettings.tallPillButtonSpacing}
                        onChange={(e) => setBlinkSettings(prev => ({ ...prev, tallPillButtonSpacing: Number(e.target.value) }))}
                        className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                        data-testid="slider-tall-pill-button-spacing"
                      />
                      <span className="text-xs text-muted-foreground w-14 text-right">{blinkSettings.tallPillButtonSpacing}px</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap flex-1">Menu Background Height</Label>
                      <input
                        type="range"
                        min="-50"
                        max="100"
                        step="1"
                        value={blinkSettings.tallPillHeight}
                        onChange={(e) => setBlinkSettings(prev => ({ ...prev, tallPillHeight: Number(e.target.value) }))}
                        className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                        data-testid="slider-tall-pill-height"
                      />
                      <span className="text-xs text-muted-foreground w-14 text-right">{blinkSettings.tallPillHeight}px</span>
                    </div>
                    
                  </div>
                </div>
                
                {/* Column Spacing */}
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Column Spacing</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Reset the column widths in the summary boxes</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      const defaultWidths = {
                        taskGap: 0,
                        taskName: 48,
                        courseCode: 100,
                        courseName: 145,
                        dueDate: 55
                      };
                      setTaskColumnWidths(defaultWidths);
                      localStorage.setItem('taskColumnWidths', JSON.stringify(defaultWidths));
                      
                      toast({ title: "Column widths reset", description: "All summary box columns have been reset to defaults." });
                    }}
                    data-testid="button-reset-column-widths"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset Column Widths
                  </Button>
                </div>
                </div>
                
                </div>
                
                {/* Right Column */}
                <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col gap-4">
                {/* Blinking & Spacing Settings */}
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Blinking & Spacing</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Control blinking animations and button spacing</span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Today Column Blink */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Today Column Blink</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.todayColumnBlink}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, todayColumnBlink: e.target.checked }))}
                          className="h-1.5 w-1.5 rounded border-gray-300 accent-[#3b82f6]"
                          data-testid="toggle-today-column-blink"
                        />
                      </div>
                      {blinkSettings.todayColumnBlink && (
                        <div className="flex items-center gap-3">
                          <Label className="text-[10px] text-muted-foreground flex-1">Speed</Label>
                          <input
                            type="range"
                            min="0.2"
                            max="2"
                            step="0.1"
                            value={blinkSettings.todayColumnBlinkSpeed}
                            onChange={(e) => setBlinkSettings(prev => ({ ...prev, todayColumnBlinkSpeed: Number(e.target.value) }))}
                            className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                            data-testid="slider-today-column-speed"
                          />
                          <span className="text-[10px] text-muted-foreground w-14 text-right">{blinkSettings.todayColumnBlinkSpeed}s</span>
                        </div>
                      )}
                    </div>
                    
                    {/* All Day Files Blink */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">All Day Files Blink</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.allDayFilesBlink}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, allDayFilesBlink: e.target.checked }))}
                          className="h-1.5 w-1.5 rounded border-gray-300 accent-[#3b82f6]"
                          data-testid="toggle-allday-files-blink"
                        />
                      </div>
                      {blinkSettings.allDayFilesBlink && (
                        <div className="flex items-center gap-3">
                          <Label className="text-[10px] text-muted-foreground flex-1">Speed</Label>
                          <input
                            type="range"
                            min="0.2"
                            max="2"
                            step="0.1"
                            value={blinkSettings.allDayFilesBlinkSpeed}
                            onChange={(e) => setBlinkSettings(prev => ({ ...prev, allDayFilesBlinkSpeed: Number(e.target.value) }))}
                            className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                            data-testid="slider-allday-files-speed"
                          />
                          <span className="text-[10px] text-muted-foreground w-14 text-right">{blinkSettings.allDayFilesBlinkSpeed}s</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Show Arrows Toggle */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Show Connection Arrows</Label>
                        <input
                          type="checkbox"
                          checked={blinkSettings.showArrows}
                          onChange={(e) => setBlinkSettings(prev => ({ ...prev, showArrows: e.target.checked }))}
                          className="h-1.5 w-1.5 rounded border-gray-300 accent-[#3b82f6]"
                          data-testid="toggle-show-arrows"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Lines connecting task boxes to calendar entries
                      </p>
                    </div>
                    
                    </div>
                </div>
                
                {/* TTS Highlighting Settings */}
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Text-to-Speech Highlighting</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Fine-tune word highlighting</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <Label className="text-xs whitespace-nowrap flex-1">Start Delay</Label>
                        <input
                          type="range"
                          min="5"
                          max="60"
                          step="1"
                          value={ttsSettings.startDelay}
                          onChange={(e) => setTtsSettings(prev => ({ ...prev, startDelay: Number(e.target.value) }))}
                          className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                          data-testid="input-tts-start-delay"
                        />
                        <span className="text-xs text-muted-foreground w-14 text-right">{ttsSettings.startDelay}s</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Time before highlighting begins (network + TTS processing)
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <Label className="text-xs whitespace-nowrap flex-1">Speech Rate</Label>
                        <input
                          type="range"
                          min="60"
                          max="200"
                          step="5"
                          value={ttsSettings.wordsPerMinute}
                          onChange={(e) => setTtsSettings(prev => ({ ...prev, wordsPerMinute: Number(e.target.value) }))}
                          className="w-1/3 h-0.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3b82f6] [&::-moz-range-thumb]:border-0"
                          data-testid="input-tts-wpm"
                        />
                        <span className="text-xs text-muted-foreground w-14 text-right">{ttsSettings.wordsPerMinute} WPM</span>
                      </div>
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
                        className="h-1.5 w-1.5 rounded border-gray-300 accent-[#3b82f6]"
                        data-testid="input-tts-smart-timing"
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => saveTtsSettings(ttsSettings)}
                      data-testid="button-save-tts-settings"
                    >
                      Save TTS
                    </Button>
                  </div>
                </div>
                
                {/* Data Sync Section */}
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Data Sync</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Push to or pull from the published app</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
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
                      <Upload className="h-3 w-3 mr-1" />
                      Push
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
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
                            refreshFileCounts();
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
                      <Download className="h-3 w-3 mr-1" />
                      Pull
                    </Button>
                  </div>
                </div>
                
                {/* Save Settings Button */}
                </div>
                <div className="flex justify-end">
                  <Button 
                    variant="outline"
                    className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-6 px-4"
                    style={{
                      boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                      fontSize: '12px'
                    }}
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
                </div>
              </div>
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
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Second Google Account</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Connect a second Google account to sync tasks to both accounts</span>
                  </div>
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
                  <div className="border-b border-primary inline-block -mt-1 pb-0">
                    <Label className="text-sm font-medium">Secondary Calendar</Label>
                    <span className="text-sm" style={{ color: '#3b82f6' }}>&nbsp;|</span><span className="text-xs text-muted-foreground italic">&nbsp;Select a secondary calendar to sync tasks to</span>
                  </div>
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

                {/* Show All Day Row Toggle */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">All Day Row</Label>
                      <p className="text-xs text-muted-foreground">Show the all-day row at the top of the calendar</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={showAllDayRow}
                      onChange={(e) => {
                        setShowAllDayRow(e.target.checked);
                        localStorage.setItem('showAllDayRow', JSON.stringify(e.target.checked));
                      }}
                      className="h-4 w-4 accent-blue-500"
                      data-testid="toggle-show-allday-row"
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-visible scrollbar-hidden flex flex-col" style={{ marginTop: '0px', marginLeft: '-25px', marginRight: '-34px', paddingLeft: '25px', paddingRight: '0px' }}>
        {/* Calendar Views */}
        {calendarView === "week" ? (
        <div className="mb-[12px] mt-[0px] relative flex gap-4 transition-all duration-300" style={{ height: calendarHeight - 35, order: 1, paddingTop: '7px' }}>
          
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
          <div ref={calendarWrapperRef} style={{ width: 'calc(100% - 68px)', height: 'calc(100% - 5px)', marginTop: '-2px', marginLeft: '2px', display: 'flex', flexDirection: 'column' }} className="relative overflow-visible">
          
          {/* Glass effect backing box - resizes with calendar */}
          <div 
            className="absolute pointer-events-none"
            style={{ 
              top: '-5px', 
              left: '-15px', 
              right: '-15px', 
              bottom: '-27px', 
              background: 'rgba(255, 255, 255, 0.35)',
              borderRadius: '31px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
          
          {/* BRYN reminder - positioned above today column outside the card */}
          <div className="grid w-full h-[15px] flex-shrink-0" style={{ gridTemplateColumns: getGridTemplateColumns(), marginTop: '-4px' }}>
            <div style={{ minWidth: 0 }} /> {/* Time column spacer */}
            {gridSizes.moduleColumnWidth > 0 && <div style={{ minWidth: 0 }} />} {/* Module column spacer */}
            {weekDays.slice(0, 6).map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              const todayHasTasks = isToday && allTasks.some(t => 
                t.dueDate && !t.isCompleted && isSameDay(new Date(t.dueDate), day)
              );
              return (
                <div key={idx} style={{ minWidth: 0, width: '100%', fontFamily: "'Nunito', 'Avenir', sans-serif" }} className={`text-[11px] font-medium text-white tracking-wide text-center leading-[15px] ${isToday && todayHasTasks ? 'animate-pulse' : ''}`}>
                  {isToday && todayHasTasks ? `${profileData.firstName.toUpperCase()}: Review your today tasks` : ''}
                </div>
              );
            })}
            <div style={{ minWidth: 0, gridColumn: gridSizes.moduleColumnWidth > 0 ? 9 : 8 }} /> {/* Progress column spacer */}
            {/* Saturday column - show reminder if Saturday is today */}
            {(() => {
              const satDay = weekDays[6];
              const isSatToday = satDay && isSameDay(satDay, new Date());
              const satHasTasks = isSatToday && allTasks.some(t => 
                t.dueDate && !t.isCompleted && isSameDay(new Date(t.dueDate), satDay)
              );
              return (
                <div style={{ minWidth: 0, width: '100%', fontFamily: "'Nunito', 'Avenir', sans-serif", gridColumn: gridSizes.moduleColumnWidth > 0 ? 10 : 9 }} className={`text-[11px] font-medium text-white tracking-wide text-center leading-[15px] ${isSatToday && satHasTasks ? 'animate-pulse' : ''}`}>
                  {isSatToday && satHasTasks ? `${profileData.firstName.toUpperCase()}: Review your today tasks` : ''}
                </div>
              );
            })()}
          </div>
          <div className="shadow-lg h-full border border-white flex flex-col relative" style={{ background: '#faf8f5', borderRadius: '16px', overflow: 'clip' }}>
            {/* Progress/Saturday divider line - red separator on left border of Saturday column */}
            <div className="absolute top-0 bottom-0 w-[4px] z-50 pointer-events-none overflow-hidden red-separator-shimmer" style={{ left: `calc(${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px + (${gridSizes.dayColumnWidths.slice(0, 6).reduce((a, b) => a + b, 0) + gridSizes.progressColumnWidth} / ${gridSizes.dayColumnWidths.reduce((a, b) => a + b, 0) + gridSizes.progressColumnWidth}) * (100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px))`, backgroundColor: '#ef4444' }}>
              <div className="absolute inset-0 red-separator-shimmer-sweep" />
            </div>
            
            <div className="p-0 flex-1 flex flex-col overflow-hidden relative z-20" style={{ borderRadius: '16px' }} onClick={() => setSelectedTaskId(null)}>
            {/* Day Headers - Fixed, not scrollable */}
            <div data-calendar-grid="true" className="grid border-b border-border z-[44] h-[41px] w-full flex-shrink-0" style={{ gridTemplateColumns: getGridTemplateColumns() }}>
              <div className="flex items-center justify-center relative" style={{ backgroundColor: colorSettings.headerBar }}>
                <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.8)' }}>Week {selectedWeek}</span>
                {/* Time column resize handle - right edge */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize bg-white/50 hover:bg-white"
                  style={{ zIndex: 9999 }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleColumnResizeStart(e, -1);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    handleColumnResizeStart(e, -1);
                  }}
                  data-testid="time-column-resize-handle"
                />
              </div>
              {gridSizes.moduleColumnWidth > 0 && <div style={{ minWidth: 0, backgroundColor: colorSettings.headerBar }} />}
              {/* Sun-Fri day headers (indices 0-5) */}
              {weekDays.slice(0, 6).map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                const dayName = format(day, "EEE").toUpperCase();
                const dayNum = format(day, "d");
                const hasTodayTasks = isToday && allTasks.some(t => 
                  !t.isCompleted && isSameDay(new Date(t.dueDate), day)
                );
                return (
                  <div 
                    key={idx} 
                    className={`border-l border-border flex flex-col items-center justify-center h-full relative ${isToday && blinkSettings.todayColumnBlink ? "animate-today-date" : ""}`}
                    style={{ backgroundColor: isToday ? '#eef2f7' : "black" }}
                    data-testid={`day-header-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="text-2xl font-bold" style={{ color: '#fff' }}>{dayNum}</div>
                      <div className="text-[10px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>{dayName}</div>
                    </div>
                    {idx < 5 && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize bg-white/50 hover:bg-white"
                        style={{ zIndex: 9999 }}
                        onMouseDown={(e) => { e.stopPropagation(); handleColumnResizeStart(e, idx); }}
                        onTouchStart={(e) => { e.stopPropagation(); handleColumnResizeStart(e, idx); }}
                        data-testid={`day-column-resize-handle-${idx}`}
                      />
                    )}
                  </div>
                );
              })}
              {/* Progress column header (half-width, between Fri and Sat) */}
              <div 
                className="flex items-center justify-center border-l border-border"
                style={{ backgroundColor: '#000000', gridColumn: gridSizes.moduleColumnWidth > 0 ? 9 : 8 }}
              >
                <span className="text-[10px] font-medium tracking-wide text-white/80 uppercase leading-tight text-center">This Week's<br/><span className="mt-1 block">Progress</span></span>
              </div>
              {/* Saturday header */}
              {weekDays[6] && (() => {
                const day = weekDays[6];
                const dayName = format(day, "EEE").toUpperCase();
                const dayNum = format(day, "d");
                const hasTodayTasks = isTodaySaturday && allTasks.some(t => 
                  !t.isCompleted && isSameDay(new Date(t.dueDate), day)
                );
                return (
                  <div 
                    className={`border-l border-border flex flex-col items-center justify-center h-full relative ${isTodaySaturday && blinkSettings.todayColumnBlink ? "animate-today-date" : ""}`}
                    style={{ backgroundColor: isTodaySaturday ? '#eef2f7' : "black", gridColumn: gridSizes.moduleColumnWidth > 0 ? 10 : 9 }}
                    data-testid={`day-header-${format(day, "yyyy-MM-dd")}`}
                  >
                    {!isTodaySaturday && new Date().getDay() !== 6 && (
                      <div className="text-[8px] font-bold tracking-wider uppercase" style={{ marginBottom: '-4px', marginTop: '2px', color: '#E8E656' }}>NEW SCHOOL WEEK</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className="text-2xl font-bold" style={{ color: '#fff' }}>{dayNum}</div>
                      <div className="text-[10px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>{dayName}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
              {/* Course Rows - CPPA122, CFNF400, CASL101 - Fixed, not scrollable - Now shows prep tasks */}
              {/* Pre-compute course row height: minimum = 3 tasks height, expand only if any course has >3 tasks */}
              {(() => {
                const filteredCourses = coursesData.courses.filter(c => c.name).slice(0, 3);
                const minThreeTaskHeight = 3 * 20 + 4; // 64px minimum (3 tasks)
                const maxCourseRowHeight = Math.max(minThreeTaskHeight, ...filteredCourses.map(cd => {
                  const cn = cd.name.split(' - ')[0].toUpperCase();
                  const count = tasks?.filter(task => {
                    if (!task.courseName?.toUpperCase().startsWith(cn)) return false;
                    if (task.isCompleted) return false;
                    const taskDueDate = startOfDay(new Date(task.dueDate));
                    const weekStart = startOfDay(weekDays[0]);
                    const weekEnd = startOfDay(addDays(weekDays[6], 1));
                    if (taskDueDate >= weekStart && taskDueDate < weekEnd) return true;
                    if (task.startDate) {
                      const taskStartDate = startOfDay(new Date(task.startDate));
                      if (taskStartDate < weekEnd && taskDueDate > weekStart) return true;
                    }
                    return false;
                  }).length || 0;
                  return count * 20 + 4;
                }));
                return (
              <div ref={courseRowsRef} data-testid="course-rows-container">
              {filteredCourses.map((courseData, courseIdx) => {
                const courseName = courseData.name.split(' - ')[0].toUpperCase();
                const rgb = hexToRgb(courseData.color);
                const course = { 
                  name: courseName, 
                  bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`, 
                  label: courseData.color, 
                  colors: dynamicCourseColors[courseName] 
                };
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
                            <div className="px-1 py-0.5 text-[10px] font-medium tracking-wide flex items-center justify-center text-white" style={{ backgroundColor: course.label }}>
                              {taskIdx === 0 ? course.name : ''}
                            </div>
                            
                            {/* Static MODULE column task - only when module column is visible */}
                            {gridSizes.moduleColumnWidth > 0 && (
                            <div style={{ backgroundColor: course.bg }}>
                              <div 
                                className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded m-0.5 border ${task.isCompleted ? "text-gray-400" : "text-black"}`}
                                style={{
                                  backgroundColor: task.isCompleted ? '#e5e7eb' : (course.colors?.bg || '#e5e7eb'),
                                  borderColor: task.isCompleted ? '#d1d5db' : (course.colors?.border || '#9ca3af')
                                }}
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
                            )}
                            
                            {/* Sun-Fri columns (6 columns: index 0-5) - dynamic task starts from today */}
                            {weekDays.slice(0, 6).map((day, dayIdx) => {
                              const dayOfWeek = day.getDay(); // 0 = Sunday, 5 = Friday
                              const isBeforeToday = dayOfWeek < currentDayOfWeek;
                              const isTodayColumn = dayOfWeek === currentDayOfWeek;
                              const isFriday = dayOfWeek === 5;
                              const isActualToday = isSameDay(day, today);
                              const cellBg = course.bg;
                              
                              // If this day is before today, show empty cell
                              if (isBeforeToday) {
                                return (
                                  <div 
                                    key={dayIdx}
                                    style={{ backgroundColor: cellBg }}
                                  />
                                );
                              }
                              
                              // On Sunday (currentDayOfWeek === 0), the static MODULE task covers everything
                              // so we don't show a duplicate dynamic task
                              if (currentDayOfWeek === 0) {
                                return (
                                  <div 
                                    key={dayIdx}
                                    style={{ backgroundColor: cellBg }}
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
                                  <div key={dayIdx} className="flex items-center" style={{ backgroundColor: cellBg }}>
                                    <div 
                                      className={`flex-1 flex items-center gap-1 text-[8px] px-1 ml-0.5 ${isFriday ? 'mr-0.5' : ''} ${todayBorderClass} ${
                                        shouldBlink ? "animate-blink" : ""
                                      } ${task.isCompleted ? "text-gray-400" : "text-black"}`}
                                      style={{ 
                                        height: 'calc(100% - 4px)', 
                                        marginTop: '2px', 
                                        marginBottom: '2px',
                                        backgroundColor: task.isCompleted ? '#e5e7eb' : (course.colors?.bg || '#e5e7eb')
                                      }}
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
                                <div key={dayIdx} className="flex items-center" style={{ backgroundColor: cellBg }}>
                                  <div 
                                    className={`w-full ${bgOnly} ${contBorderClass} ${
                                      shouldBlink ? "animate-blink" : ""
                                    } ${isFriday ? 'mr-0.5' : ''}`}
                                    style={{ height: 'calc(100% - 4px)', marginTop: '2px', marginBottom: '2px' }}
                                  />
                                </div>
                              );
                            })}
                            
                            {/* Progress column - empty with black background */}
                            <div style={{ backgroundColor: '#000000', gridColumn: gridSizes.moduleColumnWidth > 0 ? 9 : 8 }} />
                            {/* Saturday column - always course bg */}
                            <div style={{ backgroundColor: course.bg, gridColumn: gridSizes.moduleColumnWidth > 0 ? 10 : 9 }} />
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                
                // Calculate how many tasks this course has in the current week to set dynamic height
                const courseTaskCount = tasks?.filter(task => {
                  if (!task.courseName?.toUpperCase().startsWith(course.name)) return false;
                  if (task.isCompleted) return false;
                  // Check if task falls within the week (due date or prep days)
                  const taskDueDate = startOfDay(new Date(task.dueDate));
                  const weekStart = startOfDay(weekDays[0]);
                  const weekEnd = startOfDay(addDays(weekDays[6], 1));
                  if (taskDueDate >= weekStart && taskDueDate < weekEnd) return true;
                  if (task.startDate) {
                    const taskStartDate = startOfDay(new Date(task.startDate));
                    // Check if any prep day falls in the week
                    if (taskStartDate < weekEnd && taskDueDate > weekStart) return true;
                  }
                  return false;
                }).length || 0;
                
                // Use pre-computed max height so all course rows are the same height
                
                return (
                <div key={course.name} className="grid border-b border-border/50 w-full flex-shrink-0 relative z-[43] group/courserow" style={{ gridTemplateColumns: getGridTemplateColumns(), minHeight: `${maxCourseRowHeight}px` }}>
                  <div className="px-1 py-0.5 text-[8px] font-medium tracking-wide flex flex-col items-center justify-center text-white relative leading-tight" style={{ backgroundColor: course.label }}>
                    {(() => {
                      const code = course.name.split(' - ')[0];
                      const fullName = course.name.split(' - ').slice(1).join(' - ');
                      // CPPA122: show all on one line, centered
                      if (code === 'CPPA122') {
                        return <span className="text-center">CPPA122 Local Politics and Government</span>;
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
                      // CASL101: show full name, centered
                      if (code === 'CASL101') {
                        return (
                          <>
                            <span className="text-center">CASL101</span>
                            <span className="text-center">American Sign</span>
                            <span className="text-center">Language</span>
                          </>
                        );
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
                  {gridSizes.moduleColumnWidth > 0 && <div style={{ minWidth: 0, backgroundColor: course.bg }} />}
                  {weekDays.slice(0, 6).map((day, dayIdx) => {
                    const isDayToday = isSameDay(day, new Date());
                    const cellBgColor = course.bg;
                    const cellDate = startOfDay(day);
                    
                    const dueTasks = tasks?.filter(task => {
                      if (!task.courseName?.toUpperCase().startsWith(course.name)) return false;
                      if (task.isCompleted) return false;
                      const taskDueDate = startOfDay(new Date(task.dueDate));
                      return isSameDay(taskDueDate, cellDate);
                    }) || [];
                    
                    const prepTasks = tasks?.filter(task => {
                      if (!task.courseName?.toUpperCase().startsWith(course.name)) return false;
                      if (task.isCompleted) return false;
                      if (!task.startDate) return false;
                      const taskDueDate = startOfDay(new Date(task.dueDate));
                      const taskStartDate = startOfDay(new Date(task.startDate));
                      return cellDate >= taskStartDate && cellDate < taskDueDate;
                    }) || [];
                    
                    const rgb = hexToRgb(course.label);
                    const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
                    
                    const allItems: { task: typeof dueTasks[0], isPrep: boolean }[] = [
                      ...dueTasks.map(t => ({ task: t, isPrep: false })),
                      ...prepTasks.map(t => ({ task: t, isPrep: true })),
                    ];
                    
                    return (
                      <div 
                        key={dayIdx} 
                        className="overflow-hidden relative flex flex-col gap-0.5 pt-0.5 border-l border-border/50"
                        style={{ backgroundColor: cellBgColor, padding: '2px 2px 2px 4px' }}
                        data-testid={`course-row-${course.name}-${format(day, "yyyy-MM-dd")}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.backgroundColor = '#8B8070';
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.backgroundColor = cellBgColor;
                        }}
                        onDrop={(e) => {
                          e.currentTarget.style.backgroundColor = cellBgColor;
                          handleCourseRowDrop(e, course.name, day);
                        }}
                      >
                        {allItems.map((item, itemIdx) => {
                          const task = item.task;
                          const today = startOfDay(new Date());
                          const tomorrow = addDays(today, 1);
                          const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                          const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                          
                          if (item.isPrep) {
                            return (
                              <div 
                                key={`prep-${task.id}`}
                                className="flex items-center gap-0.5 text-[7px] px-0.5 py-0.5 truncate rounded border cursor-pointer"
                                style={{ 
                                  backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                  borderColor: 'rgba(156, 163, 175, 0.5)',
                                }}
                                onClick={() => setEditingTask(task)}
                                title={`Prep Day - ${task.title}`}
                              >
                                <span className="truncate font-bold text-gray-700">Prep Day - {task.title}</span>
                              </div>
                            );
                          }
                          
                          return (
                            <div 
                              key={task.id}
                              className={`flex items-center gap-0.5 text-[7px] px-0.5 py-0.5 truncate rounded border cursor-pointer ${isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""}`}
                              style={{ 
                                backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`,
                                borderColor: borderColor,
                              }}
                              title={task.title}
                            >
                              <Checkbox
                                checked={task.isCompleted || false}
                                onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                                data-testid={`checkbox-course-row-${task.id}`}
                              />
                              <span 
                                className="truncate cursor-pointer hover:opacity-80"
                                onClick={() => setEditingTask(task)}
                              >
                                {task.title}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {/* Progress column - half-width black with M/R/O bars */}
                  {(() => {
                    const courseCode = course.name?.split(' - ')[0]?.toUpperCase() || '';
                    const courseCodeLower = courseCode.toLowerCase();
                    const courseTasks = allTasks.filter(t => {
                      const taskCourse = t.courseName?.split(' - ')[0]?.toUpperCase() || '';
                      return taskCourse === courseCode && t.weekNumber === selectedWeek;
                    });
                    const moduleFiles = weeklyFiles.filter(f => f.folder === `week-${selectedWeek}-${courseCodeLower}-module`);
                    const readingFiles = weeklyFiles.filter(f => f.folder === `week-${selectedWeek}-${courseCodeLower}-reading`);
                    const calcFileProgress = (files: WeeklyFile[], folderKey: string) => {
                      const fc = fileCounts[folderKey];
                      const fcPct = (fc && fc.total > 0) ? (fc.partialProgress != null ? Math.min(100, Math.round(fc.partialProgress / fc.total)) : (fc.listened > 0 ? Math.round((fc.listened / fc.total) * 100) : 0)) : -1;
                      const fcHasFiles = fc && fc.total > 0;
                      if (files.length === 0) {
                        if (fcHasFiles) {
                          return { percent: Math.max(0, fcPct), hasFiles: true };
                        }
                        return { percent: 0, hasFiles: false };
                      }
                      let totalProgress = 0;
                      for (const f of files) {
                        if (f.listened) {
                          totalProgress += 100;
                        } else if (f.checkedChunks && f.totalChunks && f.totalChunks > 0) {
                          try {
                            const checked = JSON.parse(f.checkedChunks) as number[];
                            totalProgress += Math.round((checked.length / f.totalChunks) * 100);
                          } catch {
                            if (f.lastChunkIndex != null && f.lastChunkIndex >= 0) {
                              totalProgress += Math.round((f.lastChunkIndex / f.totalChunks) * 100);
                            }
                          }
                        } else {
                          const isCurrentlyPlaying = !f.listened && previewFile && f.id === previewFile.id && isPlaying && totalChunks > 0;
                          if (isCurrentlyPlaying) {
                            totalProgress += Math.round(((currentChunkIndex + 1) / totalChunks) * 100);
                          } else if (f.totalChunks && f.totalChunks > 0 && f.lastChunkIndex != null && f.lastChunkIndex >= 0) {
                            totalProgress += Math.round((f.lastChunkIndex / f.totalChunks) * 100);
                          }
                        }
                      }
                      const filesPct = Math.min(100, Math.round(totalProgress / files.length));
                      return { percent: Math.max(filesPct, fcPct >= 0 ? fcPct : 0), hasFiles: true };
                    };
                    const getProgressColor = (percent: number) => {
                      if (percent === 100) return '#22c55e';
                      if (percent > 0) return '#f97316';
                      return '#ef4444';
                    };
                    const moduleFolderKey = `week-${selectedWeek}-${courseCodeLower}-module`;
                    const readingFolderKey = `week-${selectedWeek}-${courseCodeLower}-reading`;
                    const otherFolderKey = `week-${selectedWeek}-${courseCodeLower}-other`;
                    const moduleP = calcFileProgress(moduleFiles, moduleFolderKey);
                    const readingP = calcFileProgress(readingFiles, readingFolderKey);
                    const otherFiles = weeklyFiles.filter(f => f.folder === otherFolderKey);
                    const otherP = calcFileProgress(otherFiles, otherFolderKey);
                    const hasNoData = !moduleP.hasFiles && !readingP.hasFiles && !otherP.hasFiles;
                    const courseHexColor = coursesData.courses.find(c => c.name?.split(' - ')[0]?.toUpperCase() === courseCode)?.color || '#6b7280';
                    const moduleFolderCount = fileCounts[moduleFolderKey];
                    const readingFolderCount = fileCounts[readingFolderKey];
                    const moduleUnread = moduleFolderCount?.unlistened || 0;
                    const readingUnread = readingFolderCount?.unlistened || 0;
                    const progressBg = (() => {
                      const cId = courseCode.toLowerCase();
                      if (cId === 'cppa122') return 'linear-gradient(0deg, #47B045 0%, #0F5004 100%)';
                      if (cId === 'cfnf400') return 'linear-gradient(180deg, rgba(222, 24, 100, 0.88) 0%, rgba(250, 103, 179, 0.78) 100%)';
                      if (cId === 'casl101') return 'linear-gradient(180deg, rgba(80, 4, 66, 0.88) 0%, rgba(176, 69, 162, 0.78) 100%)';
                      const rgb = hexToRgb(courseHexColor);
                      const dR = Math.max(0, rgb.r - 40), dG = Math.max(0, rgb.g - 40), dB = Math.max(0, rgb.b - 40);
                      const lR = Math.min(255, rgb.r + 100), lG = Math.min(255, rgb.g + 100), lB = Math.min(255, rgb.b + 100);
                      return `linear-gradient(180deg, rgba(${dR}, ${dG}, ${dB}, 0.88) 0%, rgba(${lR}, ${lG}, ${lB}, 0.78) 100%)`;
                    })();
                    return (
                      <div 
                        className="border-l border-border/50 flex items-center gap-[3px]"
                        style={{ background: progressBg, gridColumn: gridSizes.moduleColumnWidth > 0 ? 9 : 8, paddingLeft: '0px', paddingRight: '6px' }}
                      >
                        <div className="flex-1 flex flex-col justify-center min-w-0 relative" style={{ gap: '14px', paddingLeft: '4px' }}>
                        {hasNoData ? (
                          <span className="text-[9px] font-bold text-white/60 text-center" style={{ lineHeight: '1.6' }}>{courseName.startsWith('CASL') ? <>No progress<br/>to display</> : 'N/A'}</span>
                        ) : (
                          <>
                            <div className="flex flex-col gap-[2px]">
                              <span className="text-[8px] font-medium leading-none uppercase tracking-wider" style={{ color: '#ffffff' }}>Module</span>
                              {moduleP.hasFiles ? (
                                <div className="flex items-center gap-[3px]">
                                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                                    {moduleP.percent > 0 && (
                                      <div className="h-full rounded-full" style={{ width: `${moduleP.percent}%`, backgroundColor: getProgressColor(moduleP.percent) }} />
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold flex-shrink-0 leading-none text-white">{moduleP.percent}%</span>
                                </div>
                              ) : (
                                <span className="text-[8px] text-white leading-none">N/A</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-[2px]">
                              <span className="text-[8px] font-medium leading-none uppercase tracking-wider" style={{ color: '#ffffff' }}>Reading(s)</span>
                              {readingP.hasFiles ? (
                                <div className="flex items-center gap-[3px]">
                                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                                    {readingP.percent > 0 && (
                                      <div className="h-full rounded-full" style={{ width: `${readingP.percent}%`, backgroundColor: getProgressColor(readingP.percent) }} />
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold flex-shrink-0 leading-none text-white">{readingP.percent}%</span>
                                </div>
                              ) : (
                                <span className="text-[8px] text-white leading-none">N/A</span>
                              )}
                            </div>
                          </>
                        )}
                        </div>
                        <div
                          className="flex-shrink-0 relative cursor-pointer"
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: getBorderGradient(courseHexColor),
                            padding: '1px',
                            marginLeft: '1px',
                          }}
                          data-testid={`progress-pill-${courseCode.toLowerCase()}`}
                          title={`${courseCode} progress`}
                          onClick={async () => {
                            setIsLoadingOneDriveFiles(true);
                            const courseId = courseCode.toLowerCase();
                            const basePath = `/School/1. TMU/Courses/2026/Winter`;
                            try {
                              const baseResponse = await fetch(`/api/onedrive/files?path=${encodeURIComponent(basePath)}`);
                              const baseFolders = await baseResponse.json();
                              if (!Array.isArray(baseFolders)) throw new Error('Failed to list course folders');
                              const matchedFolder = baseFolders.find((f: any) => 
                                f.type === 'folder' && f.name.toUpperCase().startsWith(courseCode)
                              );
                              if (!matchedFolder) { setIsLoadingOneDriveFiles(false); return; }
                              const coursePath = matchedFolder.path;
                              const courseResponse = await fetch(`/api/onedrive/files?path=${encodeURIComponent(coursePath)}`);
                              const courseFolders = await courseResponse.json();
                              const weekFolder = courseFolders.find((f: any) => 
                                f.type === 'folder' && f.name.toLowerCase().startsWith(`week ${selectedWeek}`)
                              );
                              if (weekFolder) {
                                const weekResponse = await fetch(`/api/onedrive/files?path=${encodeURIComponent(weekFolder.path)}`);
                                const weekContents = await weekResponse.json();
                                const moduleFolder = weekContents.find((f: any) => 
                                  f.type === 'folder' && f.name.toLowerCase().includes('module')
                                );
                                if (moduleFolder) {
                                  const moduleResponse = await fetch(`/api/onedrive/files?path=${encodeURIComponent(moduleFolder.path)}`);
                                  const moduleFilesData = await moduleResponse.json();
                                  const pdfFiles = moduleFilesData.filter((f: any) => f.type === 'file' && f.mimeType?.includes('pdf'));
                                  if (pdfFiles.length > 0) {
                                    const folder = `week-${selectedWeek}-${courseId}-module`;
                                    const ensuredFiles = await Promise.all(pdfFiles.map(async (pdf: any) => {
                                      const stablePath = pdf.path || `onedrive://${folder}/${pdf.name}`;
                                      try {
                                        const resp = await fetch('/api/files/ensure', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ objectPath: stablePath, originalName: pdf.name, displayName: pdf.name, folder }),
                                        });
                                        if (resp.ok) {
                                          const dbFile = await resp.json();
                                          return { id: dbFile.id, originalName: dbFile.originalName, displayName: dbFile.displayName, objectPath: pdf.downloadUrl, folder: dbFile.folder, listened: dbFile.listened || false, checkedChunks: dbFile.checkedChunks || undefined, totalChunks: dbFile.totalChunks || undefined, lastChunkIndex: dbFile.lastChunkIndex || undefined } as FileItem;
                                        }
                                      } catch {}
                                      return { id: Date.now() + Math.random(), originalName: pdf.name, displayName: pdf.name, objectPath: pdf.downloadUrl, folder, listened: false } as FileItem;
                                    }));
                                    setOneDrivePreviewFiles(ensuredFiles);
                                    setPreviewFile(ensuredFiles[0]);
                                    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
                                    refreshFileCounts();
                                  }
                                }
                              }
                            } catch (error) {
                              console.error('Error fetching module files:', error);
                            } finally {
                              setIsLoadingOneDriveFiles(false);
                            }
                          }}
                        >
                          <div
                            className="hover:opacity-80 transition-all duration-200"
                            style={{
                              position: 'absolute',
                              top: '1px',
                              left: '2px',
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: getButtonGradient(courseHexColor),
                              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Play className="h-3 w-3 text-white" style={{ marginLeft: '2px' }} />
                          </div>
                          {moduleUnread > 0 && (
                            <div className="absolute bg-[#FF0000] text-white text-[9px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 shadow-lg border border-white/30" style={{ top: '-5px', right: '-2px', zIndex: 1 }}>
                              {moduleUnread}
                            </div>
                          )}
                          {readingUnread > 0 && (
                            <div className="absolute bg-[#FF0000] text-white text-[9px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 shadow-lg border border-white/30" style={{ top: '28px', right: '-2px', zIndex: 1 }}>
                              {readingUnread}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Saturday column cell */}
                  {weekDays[6] && (() => {
                    const day = weekDays[6];
                    const isSatToday = isSameDay(day, new Date());
                    const cellDate = startOfDay(day);
                    const dueTasks = tasks?.filter(task => {
                      if (!task.courseName?.toUpperCase().startsWith(course.name)) return false;
                      if (task.isCompleted) return false;
                      const taskDueDate = startOfDay(new Date(task.dueDate));
                      return isSameDay(taskDueDate, cellDate);
                    }) || [];
                    const prepTasks = tasks?.filter(task => {
                      if (!task.courseName?.toUpperCase().startsWith(course.name)) return false;
                      if (task.isCompleted) return false;
                      if (!task.startDate) return false;
                      const taskDueDate = startOfDay(new Date(task.dueDate));
                      const taskStartDate = startOfDay(new Date(task.startDate));
                      return cellDate >= taskStartDate && cellDate < taskDueDate;
                    }) || [];
                    const rgb = hexToRgb(course.label);
                    const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
                    const allItems: { task: typeof dueTasks[0], isPrep: boolean }[] = [
                      ...dueTasks.map(t => ({ task: t, isPrep: false })),
                      ...prepTasks.map(t => ({ task: t, isPrep: true })),
                    ];
                    return (
                      <div 
                        className="border-l border-border/50 relative overflow-hidden min-w-0 flex flex-col gap-0.5 pt-0.5"
                        style={{ backgroundColor: course.bg, padding: '2px 2px 2px 4px', gridColumn: gridSizes.moduleColumnWidth > 0 ? 10 : 9 }}
                      >
                        {allItems.map((item, itemIdx) => {
                          const task = item.task;
                          const today = startOfDay(new Date());
                          const tomorrow = addDays(today, 1);
                          const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                          const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                          if (item.isPrep) {
                            return (
                              <div 
                                key={`prep-${task.id}`}
                                className="flex items-center gap-0.5 text-[7px] px-0.5 py-0.5 truncate rounded border cursor-pointer"
                                style={{ 
                                  backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                  borderColor: 'rgba(156, 163, 175, 0.5)',
                                }}
                                onClick={() => setEditingTask(task)}
                                title={`Prep Day - ${task.title}`}
                              >
                                <span className="truncate font-bold text-gray-700">Prep Day - {task.title}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={task.id} className={`flex items-center gap-0.5 text-[7px] px-0.5 py-0.5 truncate rounded border cursor-pointer ${isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""} ${task.isCompleted ? "text-gray-400" : "text-black"}`}
                              style={{ backgroundColor: task.isCompleted ? '#e5e7eb' : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`, borderColor: task.isCompleted ? '#d1d5db' : borderColor }}
                              onClick={() => setEditingTask(task)}
                            >
                              <span className="truncate font-bold">{task.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {/* Course row resize handle */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] cursor-row-resize z-[50] opacity-0 group-hover/courserow:opacity-100 hover:bg-blue-400/50 transition-opacity"
                    onMouseDown={(e) => handleRowResizeStart(e, 'course')}
                    onTouchStart={(e) => handleRowResizeStart(e, 'course')}
                    data-testid={`course-row-resize-handle-${course.name}`}
                  />
                  </div>
                );
              })}
              </div>
                ); })()}

            {/* ALL DAY Row - Fixed, not scrollable - Only shows true all-day tasks (midnight due time) */}
            {showAllDayRow && (<div ref={allDayRowRef} className="grid z-[44] w-full flex-shrink-0 relative group/alldayrow" style={{ gridTemplateColumns: getGridTemplateColumns(), minHeight: `${gridSizes.allDayRowHeight}px` }}>
              <div className="text-[10px] font-medium tracking-wide flex items-center justify-center text-white/80 relative border-b border-border/50" style={{ backgroundColor: colorSettings.headerBar }}>
                ALL DAY
              </div>
              {gridSizes.moduleColumnWidth > 0 && <div className="border-b border-border/50" style={{ minWidth: 0, backgroundColor: colorSettings.headerBar }} />}
              {/* Day cells - Sun-Fri */}
              {weekDays.slice(0, 6).map((day, dayIdx) => {
                const allDayTasks = getAllDayTasks(day);
                const allDayEvents = getAllDayCalendarEvents(day);
                
                return (
                  <div 
                    key={dayIdx} 
                    className={`border-l border-border/50 relative p-0.5 flex flex-col gap-0.5 overflow-hidden min-w-0 ${isSameDay(day, new Date()) ? 'border-b border-black' : 'border-b border-border/50'}`}
                    style={{ 
                      backgroundColor: isSameDay(day, new Date()) ? '#eef2f7' : 'white',
                    }}
                    data-testid={`all-day-slot-${format(day, "yyyy-MM-dd")}`}
                  >
                    {/* All-day tasks */}
                    {allDayTasks.map(task => {
                      const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                      const colors = dynamicCourseColors[courseCode];
                      const today = startOfDay(new Date());
                      const tomorrow = addDays(today, 1);
                      const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                      const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                      return (
                        <div
                          key={task.id}
                          className="relative w-full min-w-0"
                          data-testid={`all-day-task-${task.id}`}
                        >
                          <div
                            className={`group flex items-center gap-1 text-[8px] px-1 py-0.5 truncate rounded border w-full min-w-0 cursor-pointer ${
                              isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""
                            } ${task.isCompleted ? "text-gray-400" : "text-black"}`}
                            style={{
                              backgroundColor: task.isCompleted ? '#e5e7eb' : (colors?.bg || '#e5e7eb'),
                              borderColor: task.isCompleted ? '#d1d5db' : (colors?.border || '#9ca3af')
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                taskId: task.id,
                                taskTitle: task.title
                              });
                            }}
                            onTouchStart={(e) => handleTouchStart(e, task.id, task.title)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                          >
                            {!isCASL101Task(task) && (
                              <Checkbox
                                checked={task.isCompleted || false}
                                onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                                data-testid={`checkbox-allday-${task.id}`}
                              />
                            )}
                            <span 
                              onClick={() => setEditingTask(task)}
                              className={`cursor-pointer hover:opacity-80 truncate flex-1 font-bold ${task.isCompleted ? "line-through" : ""}`}
                            >
                              {task.title}
                            </span>
                            {/* Delete button - always visible */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this task?')) {
                                  deleteMutation.mutate(task.id);
                                }
                              }}
                              className="ml-auto shrink-0 p-0.5 rounded hover:bg-red-500/20 text-red-500"
                              title="Delete task"
                              data-testid={`button-delete-allday-${task.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
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
                    {/* Projects with target date on this day */}
                    {getProjectsForDay(day).map(project => {
                      const isCompleted = project.status === 'completed';
                      return (
                        <RouterLink
                          key={`project-${project.id}`}
                          href="/projects"
                          className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate border cursor-pointer hover:opacity-80 w-full min-w-0 ${
                            isCompleted ? "text-gray-400" : "text-white"
                          }`}
                          style={{
                            background: isCompleted ? '#9ca3af' : 'linear-gradient(to right, #6366F1, #8B5CF6)',
                            borderColor: isCompleted ? '#6b7280' : '#4F46E5'
                          }}
                          data-testid={`calendar-project-${project.id}`}
                        >
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          <span className={`truncate font-bold flex-1 min-w-0 ${isCompleted ? "line-through" : ""}`}>
                            {project.name}
                          </span>
                        </RouterLink>
                      );
                    })}
                  </div>
                );
              })}
              {/* Progress column - half-width, black background */}
              <div 
                className="border-l border-border/50 relative"
                style={{ backgroundColor: '#000000', gridColumn: gridSizes.moduleColumnWidth > 0 ? 9 : 8 }}
              />
              {/* Saturday all-day cell */}
              {weekDays[6] && (() => {
                const day = weekDays[6];
                const allDayTasks = getAllDayTasks(day);
                const allDayEvents = getAllDayCalendarEvents(day);
                return (
                  <div 
                    className="border-l border-b border-border/50 relative p-0.5 flex flex-col gap-0.5 overflow-hidden min-w-0"
                    style={{ backgroundColor: isSameDay(day, new Date()) ? '#eef2f7' : '#faf8f5', borderLeftColor: 'rgba(0,0,0,0.15)', gridColumn: gridSizes.moduleColumnWidth > 0 ? 10 : 9 }}
                    data-testid={`all-day-slot-${format(day, "yyyy-MM-dd")}`}
                  >
                    {allDayTasks.map(task => {
                      const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                      const colors = dynamicCourseColors[courseCode];
                      const today = startOfDay(new Date());
                      const tomorrow = addDays(today, 1);
                      const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                      const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                      return (
                        <div key={task.id} className="relative w-full min-w-0" data-testid={`all-day-task-${task.id}`}>
                          <div
                            className={`group flex items-center gap-1 text-[8px] px-1 py-0.5 truncate rounded border w-full min-w-0 cursor-pointer ${isDueToday ? "animate-blink" : isDueTomorrow ? "animate-slow-blink" : ""} ${task.isCompleted ? "text-gray-400" : "text-black"}`}
                            style={{ backgroundColor: task.isCompleted ? '#e5e7eb' : (colors?.bg || '#e5e7eb'), borderColor: task.isCompleted ? '#d1d5db' : (colors?.border || '#9ca3af') }}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id, taskTitle: task.title }); }}
                          >
                            {!isCASL101Task(task) && (
                              <Checkbox checked={task.isCompleted || false} onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })} className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black" data-testid={`checkbox-allday-${task.id}`} />
                            )}
                            <span onClick={() => setEditingTask(task)} className={`cursor-pointer hover:opacity-80 truncate flex-1 font-bold ${task.isCompleted ? "line-through" : ""}`}>{task.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this task?')) { deleteMutation.mutate(task.id); } }} className="ml-auto shrink-0 p-0.5 rounded hover:bg-red-500/20 text-red-500" title="Delete task" data-testid={`button-delete-allday-${task.id}`}><X className="h-3 w-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                    {allDayEvents.map(event => (
                      <a key={event.id} href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate bg-gray-200 dark:bg-gray-700 text-black dark:text-white border border-gray-500 cursor-pointer hover:opacity-80 w-full min-w-0" data-testid={`all-day-gcal-${event.id}`}>
                        <CalendarDays className="h-3 w-3 shrink-0 text-gray-600 dark:text-gray-300" />
                        <span className="truncate font-bold flex-1 min-w-0">{event.title}</span>
                      </a>
                    ))}
                    {getProjectsForDay(day).map(project => {
                      const isCompleted = project.status === 'completed';
                      return (
                        <RouterLink key={`project-${project.id}`} href="/projects" className={`flex items-center gap-1 text-[8px] px-1 py-0.5 rounded truncate border cursor-pointer hover:opacity-80 w-full min-w-0 ${isCompleted ? "text-gray-400" : "text-white"}`} style={{ background: isCompleted ? '#9ca3af' : 'linear-gradient(to right, #6366F1, #8B5CF6)', borderColor: isCompleted ? '#6b7280' : '#4F46E5' }} data-testid={`calendar-project-${project.id}`}>
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          <span className={`truncate font-bold flex-1 min-w-0 ${isCompleted ? "line-through" : ""}`}>{project.name}</span>
                        </RouterLink>
                      );
                    })}
                  </div>
                );
              })()}
              {/* ALL DAY row resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px] cursor-row-resize z-[50] opacity-0 group-hover/alldayrow:opacity-100 hover:bg-blue-400/50 transition-opacity"
                onMouseDown={(e) => handleRowResizeStart(e, 'allDay')}
                onTouchStart={(e) => handleRowResizeStart(e, 'allDay')}
                data-testid="allday-row-resize-handle"
              />
            </div>)}
              
                          {/* Time Slots - Scrollable area */}
            <div ref={calendarScrollRef} className="flex-1 overflow-y-scroll overflow-x-hidden scrollbar-hidden relative flex flex-col" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', backgroundColor: '#faf8f5' }}>
                {timeSlots.map((hour, hourIdx) => {
                  const currentHour = new Date().getHours();
                  const isCurrentHour = hour === currentHour;
                  const rowHeight = gridSizes.timeSlotHeights[hour] || gridSizes.timeSlotHeight;
                  return (
                  <div 
                    key={hour} 
                    className={`grid relative group/row flex-shrink-0`}
                    style={{ gridTemplateColumns: getGridTemplateColumns(), height: `${rowHeight}px`, minHeight: `${rowHeight}px`, overflow: 'visible', borderBottomLeftRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined, borderBottomRightRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined, backgroundColor: '#faf8f5' }}
                  >
                    <div className={`text-[10px] font-medium tracking-wide flex items-center justify-center relative ${isCurrentHour && blinkSettings.todayColumnBlink ? "animate-today-date" : ""}`} style={{ backgroundColor: isCurrentHour ? colorSettings.todayCurrentHourCellBackground : colorSettings.headerBar, color: 'white', borderBottomLeftRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined }}>
                      {hour === 0 || hour === 24 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                    </div>
                    {gridSizes.moduleColumnWidth > 0 && <div style={{ minWidth: 0, backgroundColor: isCurrentHour ? '#f0f0f0' : '#faf8f5' }} data-testid="module-column-cell" />}
                    {weekDays.slice(0, 6).map((day, dayIdx) => {
                      const hourTasks = getTasksForHour(day, hour);
                      const continuingTasks = getContinuingTasksForHour(day, hour);
                      const hourCalendarEvents = getCalendarEventsForHour(day, hour);
                      const isFriday = day.getDay() === 5;
                      const isToday = isSameDay(day, new Date());
                      const totalItems = hourTasks.length + hourCalendarEvents.length;
                      const hasAnyTasks = totalItems > 0 || continuingTasks.length > 0;
                      const columnWidth = totalItems > 0 ? 100 / totalItems : 100;
                      return (
                        <div 
                          key={dayIdx} 
                          className={`border-l relative p-0.5 ${dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour ? "ring-2 ring-primary ring-inset" : ""}`}
                          style={{
                            borderLeftColor: isCurrentHour ? 'rgba(0,0,0,0.15)' : 'hsl(var(--border) / 0.5)',
                            borderBottomRightRadius: hourIdx === timeSlots.length - 1 && dayIdx === 6 ? '16px' : undefined,
                            backgroundColor: isToday ? '#eef2f7' : isCurrentHour ? '#eef2f7' : '#faf8f5'
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
                            bringFlyoutToFront('addTask');
                            setIsAddDialogOpen(true);
                          }}
                        >
                          {/* Background layer - sits below tasks so they don't get covered */}
                          <div 
                            className={`absolute inset-0 z-0 ${hasAnyTasks && !isToday && !isCurrentHour ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} ${dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour ? "bg-primary/20" : ""}`}
                            style={{
                              borderBottomRightRadius: hourIdx === timeSlots.length - 1 && dayIdx === 6 ? '16px' : undefined
                            }}
                          />
                          {/* Hour boundary dotted line */}
                          <div 
                            className={`absolute left-0 right-0 border-t border-dotted z-[1] ${isToday ? 'border-black' : 'border-gray-400 dark:border-gray-500'}`}
                            style={{ top: '0' }}
                          />
                          {/* Half-hour dotted line */}
                          <div 
                            className={`absolute left-0 right-0 border-t border-dotted z-[1] ${isToday ? 'border-black' : 'border-gray-400 dark:border-gray-500'}`}
                            style={{ top: '50%' }}
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
                            const colors = dynamicCourseColors[courseCode];
                            const today = startOfDay(new Date());
                            const tomorrow = addDays(today, 1);
                            const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                            const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                            
                            // Calculate height based on duration for events with start/end times
                            let taskHeight = 40; // Same height for all tasks
                            let topOffset = 2; // Default top offset
                            
                            if (task.eventStartTime && task.eventEndTime) {
                              const [startHour, startMin] = task.eventStartTime.split(':').map(Number);
                              const [endHour, endMin] = task.eventEndTime.split(':').map(Number);
                              const startMinutes = startHour * 60 + startMin;
                              let endMinutes = endHour * 60 + endMin;
                              if (endMinutes <= startMinutes) endMinutes = startMinutes + 60;
                              const calendarEndMinutes = 24 * 60;
                              endMinutes = Math.min(endMinutes, calendarEndMinutes);
                              const durationMinutes = endMinutes - startMinutes;
                              taskHeight = Math.max(40, (durationMinutes / 60) * 44 - 4);
                              topOffset = (startMin / 60) * 44;
                              const slotHeight = 44;
                              const maxTaskHeight = slotHeight - topOffset - 2;
                              if (taskHeight > maxTaskHeight && startHour >= 23) {
                                taskHeight = Math.max(20, maxTaskHeight);
                              }
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
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    taskId: task.id,
                                    taskTitle: task.title
                                  });
                                }}
                                onTouchStart={(e) => handleTouchStart(e, task.id, task.title)}
                                onTouchEnd={handleTouchEnd}
                                onTouchMove={handleTouchMove}
                                className={`absolute hover:opacity-90 shadow-sm cursor-grab active:cursor-grabbing rounded overflow-hidden ${
                                  draggedTask?.id === task.id ? "opacity-50" : ""
                                } ${
                                  selectedTaskId === task.id ? "ring-2 ring-red-500 ring-offset-1" : ""
                                } ${
                                  isDueToday ? "task-blink-border" : ""
                                }`}
                                style={{
                                  top: `${topOffset}px`,
                                  left: `calc(${taskIdx * columnWidth}% + 2px)`,
                                  width: `calc(${columnWidth}% - 4px)`,
                                  height: `${taskHeight}px`,
                                  zIndex: selectedTaskId === task.id ? 50 : (draggedTask?.id === task.id ? 45 : 43),
                                  backgroundColor: task.isCompleted ? '#e5e7eb' : (colors?.bg || '#e5e7eb'),
                                  border: selectedTaskId === task.id ? '2px solid rgb(239, 68, 68)' : `1px solid ${task.isCompleted ? '#d1d5db' : (colors?.border || '#9ca3af')}`,
                                }}
                                data-testid={`time-task-${task.id}`}
                                data-cal-task-id={task.id}
                                data-cal-date={format(day, 'yyyy-MM-dd')}
                              >
                                {/* Silver shimmer header with checkbox and title for due today tasks */}
                                <div className={`flex items-center gap-1.5 px-0.5 py-1 ${isDueToday ? "silver-shimmer-header" : ""}`}>
                                  {!isCASL101Task(task) && (
                                    <Checkbox
                                      checked={task.isCompleted || false}
                                      onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                      className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                                      data-testid={`checkbox-time-${task.id}`}
                                    />
                                  )}
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
                                  className={`text-[9px] font-semibold mt-0.5 mb-3 ml-[18px] px-0.5 ${task.isCompleted ? "text-gray-400" : "text-muted-foreground"}`}
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
                    {/* Progress column - half-width, black background */}
                    <div 
                      className="border-l border-border/50"
                      style={{ backgroundColor: '#000000', gridColumn: gridSizes.moduleColumnWidth > 0 ? 9 : 8 }}
                    />
                    {/* Saturday time slot cell */}
                    {weekDays[6] && (() => {
                      const day = weekDays[6];
                      const isSatToday = isSameDay(day, new Date());
                      const hourTasks = getTasksForHour(day, hour);
                      const continuingTasks = getContinuingTasksForHour(day, hour);
                      const hourCalendarEvents = getCalendarEventsForHour(day, hour);
                      const totalItems = hourTasks.length + hourCalendarEvents.length;
                      const hasAnyTasks = totalItems > 0 || continuingTasks.length > 0;
                      return (
                        <div 
                          className={`border-l relative p-0.5`}
                          style={{ 
                            backgroundColor: isSatToday ? '#eef2f7' : '#faf8f5',
                            borderLeftColor: 'rgba(0,0,0,0.15)',
                            borderBottomRightRadius: hourIdx === timeSlots.length - 1 ? '16px' : undefined,
                            overflow: 'hidden',
                            gridColumn: gridSizes.moduleColumnWidth > 0 ? 10 : 9
                          }}
                        >
                          {/* Hour boundary dotted line */}
                          <div className={`absolute left-0 right-0 border-t border-dotted z-[1] ${isSatToday ? 'border-gray-600' : 'border-gray-400'}`} style={{ top: '0' }} />
                          {/* Half-hour dotted line */}
                          <div className={`absolute left-0 right-0 border-t border-dotted z-[1] ${isSatToday ? 'border-gray-600' : 'border-gray-400'}`} style={{ top: '50%' }} />
                          {/* Render tasks for this hour */}
                          {hourTasks.filter(t => !t.eventEndTime || t.eventStartTime === t.eventEndTime).map((task, taskIdx) => {
                            const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                            const colors = dynamicCourseColors[courseCode];
                            const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), new Date());
                            const columnWidth = 100 / Math.max(1, hourTasks.filter(t => !t.eventEndTime || t.eventStartTime === t.eventEndTime).length);
                            let taskHeight = 40;
                            let topOffset = 2;
                            if (task.eventStartTime) {
                              const [, startMin] = task.eventStartTime.split(':').map(Number);
                              topOffset = (startMin / 60) * 44;
                            }
                            return (
                              <div
                                key={task.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                                onDoubleClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id, taskTitle: task.title }); }}
                                className={`absolute hover:opacity-90 shadow-sm cursor-pointer rounded overflow-hidden ${isDueToday ? "task-blink-border" : ""}`}
                                style={{
                                  top: `${topOffset}px`,
                                  left: `calc(${taskIdx * columnWidth}% + 1px)`,
                                  width: `calc(${columnWidth}% - 2px)`,
                                  height: `${taskHeight}px`,
                                  zIndex: 43,
                                  backgroundColor: task.isCompleted ? '#e5e7eb' : (colors?.bg || '#e5e7eb'),
                                  border: `1px solid ${task.isCompleted ? '#d1d5db' : (colors?.border || '#9ca3af')}`,
                                }}
                                data-testid={`sat-time-task-${task.id}`}
                              >
                                <div className="flex items-center gap-1 px-0.5 py-1">
                                  {!isCASL101Task(task) && (
                                    <Checkbox checked={task.isCompleted || false} onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })} className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black" data-testid={`checkbox-sat-${task.id}`} />
                                  )}
                                  <span className="text-[8px] font-bold text-black truncate">{task.title}</span>
                                </div>
                                {task.eventStartTime && (
                                  <div className="px-1 text-[7px] text-gray-600">{task.eventStartTime}{task.eventEndTime ? ` - ${task.eventEndTime}` : ''}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* Individual time slot row resize handle */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-[3px] cursor-row-resize z-[50] opacity-0 group-hover/row:opacity-100 hover:bg-blue-400/50 transition-opacity"
                      onMouseDown={(e) => handleRowResizeStart(e, 'timeSlot', hour)}
                      onTouchStart={(e) => handleRowResizeStart(e, 'timeSlot', hour)}
                      data-testid={`resize-timeslot-row-${hour}`}
                    />
                                      </div>
                  );
                })}
                
                {/* Multi-hour tasks overlay - rendered as single absolute positioned elements */}
                {getMultiHourTasksForWeek().map(({ task, dayIdx, startHour, startMin, endHour, endMin }) => {
                  const calendarStartHour = 6;
                  let topPx = 0;
                  for (let h = calendarStartHour; h < startHour; h++) {
                    topPx += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
                  }
                  
                  const startHourHeight = gridSizes.timeSlotHeights[startHour] || gridSizes.timeSlotHeight;
                  topPx += (startMin / 60) * startHourHeight;
                  
                  let heightPx = 0;
                  heightPx += ((60 - startMin) / 60) * startHourHeight;
                  for (let h = startHour + 1; h < endHour; h++) {
                    heightPx += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
                  }
                  if (endHour > startHour) {
                    const endHourHeight = gridSizes.timeSlotHeights[endHour] || gridSizes.timeSlotHeight;
                    heightPx += (endMin / 60) * endHourHeight;
                  }
                  
                  const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                  const colors = dynamicCourseColors[courseCode];
                  const today = startOfDay(new Date());
                  const tomorrow = addDays(today, 1);
                  const isDueToday = !task.isCompleted && isSameDay(new Date(task.dueDate), today);
                  const isDueTomorrow = !task.isCompleted && isSameDay(new Date(task.dueDate), tomorrow);
                  
                  const taskDay = weekDays[dayIdx];
                  
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
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          taskId: task.id,
                          taskTitle: task.title
                        });
                      }}
                      className={`absolute hover:opacity-90 shadow-sm cursor-grab active:cursor-grabbing rounded overflow-hidden border ${
                        draggedTask?.id === task.id ? "opacity-50" : ""
                      } ${
                        selectedTaskId === task.id ? "ring-2 ring-red-500 ring-offset-1" : ""
                      } ${
                        isDueToday ? "task-blink-border" : ""
                      }`}
                      style={{
                        top: `${topPx}px`,
                        left: `calc(${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px + (${dayIdx >= 6 ? (gridSizes.dayColumnWidths.slice(0, 6).reduce((a, b) => a + b, 0) + gridSizes.progressColumnWidth) : gridSizes.dayColumnWidths.slice(0, dayIdx).reduce((a, b) => a + b, 0)} / ${gridSizes.dayColumnWidths.reduce((a, b) => a + b, 0) + gridSizes.progressColumnWidth}) * (100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) + 2px)`,
                        width: `calc((${gridSizes.dayColumnWidths[dayIdx >= 6 ? 6 : dayIdx]} / ${gridSizes.dayColumnWidths.reduce((a, b) => a + b, 0) + gridSizes.progressColumnWidth}) * (100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px) - 4px)`,
                        height: `${heightPx}px`,
                        zIndex: selectedTaskId === task.id ? 50 : (draggedTask?.id === task.id ? 45 : 43),
                        backgroundColor: task.isCompleted ? '#e5e7eb' : (colors?.bg || '#e5e7eb'),
                        borderColor: task.isCompleted ? '#d1d5db' : (colors?.border || '#9ca3af')
                      }}
                      data-testid={`multi-hour-task-${task.id}`}
                      data-cal-task-id={task.id}
                      data-cal-date={format(taskDay, 'yyyy-MM-dd')}
                    >
                      {/* Silver shimmer header with checkbox and title for due today tasks */}
                      <div className={`flex items-center gap-1.5 px-0.5 py-1 ${isDueToday ? "silver-shimmer-header" : ""}`}>
                        {!isCASL101Task(task) && (
                          <Checkbox
                            checked={task.isCompleted || false}
                            onCheckedChange={(checked) => completeMutation.mutate({ id: task.id, isCompleted: !!checked })}
                            className="h-3 w-3 shrink-0 border-black data-[state=checked]:bg-black data-[state=checked]:border-black"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <span 
                          onClick={() => setEditingTask(task)}
                          className={`text-[9px] leading-tight font-bold line-clamp-2 cursor-pointer flex-1 ${task.isCompleted ? "line-through text-muted-foreground" : "text-black"}`}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.eventStartTime && task.eventEndTime && (
                        <div 
                          className="text-[8px] font-semibold text-muted-foreground ml-[18px] px-0.5"
                          style={{ animation: 'none' }}
                        >
                          {formatTimeTo12Hour(task.eventStartTime)} - {formatTimeTo12Hour(task.eventEndTime)}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                
                {/* Current time indicator line - rendered last to appear on top */}
                {(() => {
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinutes = now.getMinutes();
                  const calStartHour = calStart;
                  const calEndHour = isTravelMode ? 23 : 21;
                  
                  // Only show if current time is within calendar range
                  if (currentHour < calStartHour || currentHour > calEndHour) return null;
                  
                  let topPosition = 0;
                  for (let h = calStartHour; h < currentHour; h++) {
                    topPosition += gridSizes.timeSlotHeights[h] || gridSizes.timeSlotHeight;
                  }
                  const currentRowHeight = gridSizes.timeSlotHeights[currentHour] || gridSizes.timeSlotHeight;
                  topPosition += (currentMinutes / 60) * currentRowHeight;
                  
                  const isTodayInView = weekDays.some(d => isSameDay(d, now));
                  const todayDayIdx = weekDays.findIndex(d => isSameDay(d, now));
                  const isTodaySat = todayDayIdx === 6;
                  const totalFrUnits = gridSizes.dayColumnWidths.reduce((a: number, b: number) => a + b, 0) + gridSizes.progressColumnWidth;
                  const satPlusProgFr = gridSizes.dayColumnWidths[6] + gridSizes.progressColumnWidth;
                  
                  return (
                    <div 
                      className="absolute left-0 z-[5] pointer-events-none"
                      style={{ 
                        top: `${topPosition}px`, 
                        right: isTodaySat 
                          ? '0px'
                          : `calc((${satPlusProgFr} / ${totalFrUnits}) * (100% - ${gridSizes.timeColumnWidth + gridSizes.moduleColumnWidth}px))`
                      }}
                    >
                      <div 
                        className="w-full border-t border-dashed"
                        style={{ borderColor: 'rgba(0, 0, 0, 0.3)' }}
                      />
                    </div>
                  );
                })()}
            </div>
                      </div>
          {/* Calendar Height Resize Handle */}
          <div
            className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize z-50 hover:bg-blue-400/30 active:bg-blue-400/50"
            style={{ touchAction: 'none' }}
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            data-testid="calendar-height-resize-handle"
          />
          </div>
          {/* Set Default - attached below calendar glass box */}
          {!isTodoFlyoutOpen && (
            <label className="absolute flex items-center gap-1.5 text-white/60 hover:text-white text-[9px] z-[70] cursor-pointer" style={{ bottom: '-26px', right: '15px' }}>
              <input
                type="checkbox"
                checked={showDeviceSaved}
                onChange={saveAsDeviceDefault}
                className="w-3 h-3 rounded border-white/40 bg-transparent accent-green-500"
                data-testid="checkbox-save-device-default"
              />
              {showDeviceSaved ? "Saved!" : "Set Default"}
            </label>
          )}
          </div>
          
          {/* Weeks Flyout - centered panel for week folders */}
          <div 
            className={`fixed ${isResizingWeeksFlyout ? '' : 'transition-all duration-400 ease-out'} overflow-hidden ${isWeeksFlyoutOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} 
            style={{ width: isMobile ? '95vw' : '900px', maxWidth: '900px', height: isMobile ? '90vh' : '85vh', top: '50%', left: '50%', transform: isWeeksFlyoutOpen ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)', transformOrigin: 'center center', transitionDuration: '400ms', zIndex: getFlyoutZIndex('files') }}
            onClick={() => bringFlyoutToFront('files')}
          >
            {/* Resize Handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-50 hover:bg-white/20 active:bg-white/30"
              style={{ touchAction: 'none' }}
              onMouseDown={(e: React.MouseEvent) => {
                e.preventDefault();
                setIsResizingWeeksFlyout(true);
                const startX = e.clientX;
                const startWidth = Math.max(flyoutWidth, flyout2Width);
                
                const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
                  const { clientX } = getPointerXY(moveEvent);
                  const delta = startX - clientX;
                  const newWidth = Math.max(150, Math.min(400, startWidth + delta));
                  setFlyoutWidth(newWidth);
                  setFlyout2Width(newWidth);
                  setWeeksFlyoutWidth(newWidth);
                };
                
                const handleEnd = () => {
                  setIsResizingWeeksFlyout(false);
                  document.removeEventListener('mousemove', handleMove);
                  document.removeEventListener('mouseup', handleEnd);
                  document.removeEventListener('touchmove', handleMove);
                  document.removeEventListener('touchend', handleEnd);
                };
                
                document.addEventListener('mousemove', handleMove);
                document.addEventListener('mouseup', handleEnd);
                document.addEventListener('touchmove', handleMove, { passive: false });
                document.addEventListener('touchend', handleEnd);
              }}
              onTouchStart={(e: React.TouchEvent) => {
                e.preventDefault();
                setIsResizingWeeksFlyout(true);
                const { clientX: startX } = getPointerXY(e);
                const startWidth = Math.max(flyoutWidth, flyout2Width);
                
                const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
                  const { clientX } = getPointerXY(moveEvent);
                  const delta = startX - clientX;
                  const newWidth = Math.max(150, Math.min(400, startWidth + delta));
                  setFlyoutWidth(newWidth);
                  setFlyout2Width(newWidth);
                  setWeeksFlyoutWidth(newWidth);
                };
                
                const handleEnd = () => {
                  setIsResizingWeeksFlyout(false);
                  document.removeEventListener('mousemove', handleMove);
                  document.removeEventListener('mouseup', handleEnd);
                  document.removeEventListener('touchmove', handleMove);
                  document.removeEventListener('touchend', handleEnd);
                };
                
                document.addEventListener('mousemove', handleMove);
                document.addEventListener('mouseup', handleEnd);
                document.addEventListener('touchmove', handleMove, { passive: false });
                document.addEventListener('touchend', handleEnd);
              }}
              data-testid="weeks-flyout-resize-handle"
            />
            <div className="h-full bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 flex flex-col text-white relative rounded-xl" style={{ boxShadow: '-10px 0 40px rgba(0,0,0,0.3)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline"
                    className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200"
                    style={{
                      boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)';
                    }}
                    onClick={() => setIsUploadDialogOpen(true)}
                    data-testid="button-upload-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
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
                    <div className="flex items-center gap-0.5 bg-white/10 rounded-md px-1.5 py-0.5 backdrop-blur-sm whitespace-nowrap">
                      <span className="text-[10px] font-medium text-white">{format(weekStartDate, "MMMM d")}</span>
                      <span className="text-[10px] text-white/50">—</span>
                      <span className="text-[10px] font-medium text-white">{format(weekEndDate, "MMMM d")}</span>
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
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-3 w-3 text-white" />
                    <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      FILES ({allFiles.length})
                    </h2>
                  </div>
                  <button 
                    onClick={() => setIsWeeksFlyoutOpen(false)}
                    className="text-white hover:text-white/80 transition-colors p-1"
                    data-testid="button-close-weeks-flyout"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* OneDrive Files */}
              <div 
                className="flex-1 overflow-y-auto py-2 px-2" 
                style={{ scrollbarWidth: 'none' }}
              >
                {/* Read-only mode header - show simplified navigation for share link users */}
                {isReadOnly && (() => {
                  const defaultPath = "/School/1. TMU/Courses/2026/Winter";
                  const isAtDefaultPath = oneDrivePath === defaultPath;
                  const canGoBack = oneDrivePathHistory.length > 0 && !isAtDefaultPath;
                  
                  return (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/20">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/20"
                    onClick={() => {
                      if (canGoBack) {
                        const previousPath = oneDrivePathHistory[oneDrivePathHistory.length - 1];
                        // Don't go above the default path
                        if (previousPath.startsWith(defaultPath) || previousPath === defaultPath) {
                          setOneDrivePathHistory(oneDrivePathHistory.slice(0, -1));
                          setOneDrivePath(previousPath);
                        }
                      }
                    }}
                    disabled={!canGoBack}
                    data-testid="button-onedrive-back-readonly"
                  >
                    <ArrowLeft className="h-3 w-3 text-white" />
                  </Button>
                  <Eye className="h-3 w-3 text-white/50" />
                  <span className="text-[11px] text-white/60">View Only</span>
                  <span className="text-white/30 mx-1">|</span>
                  <span className="text-[11px] text-white/80 truncate flex-1">
                    {oneDrivePath.split('/').filter(Boolean).pop() || 'Course Files'}
                  </span>
                </div>
                  );
                })()}
                
                {/* OneDrive Navigation - hidden for read-only share link users */}
                {!isReadOnly && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/20">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/20"
                    onClick={() => {
                      if (oneDrivePathHistory.length > 0) {
                        const previousPath = oneDrivePathHistory[oneDrivePathHistory.length - 1];
                        setOneDrivePathHistory(oneDrivePathHistory.slice(0, -1));
                        setOneDrivePath(previousPath);
                      }
                    }}
                    disabled={oneDrivePathHistory.length === 0}
                    data-testid="button-onedrive-back"
                  >
                    <ArrowLeft className="h-4 w-4 text-white" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/20"
                    onClick={() => {
                      setOneDrivePathHistory([]);
                      setOneDrivePath("/");
                    }}
                    data-testid="button-onedrive-home"
                  >
                    <Home className="h-4 w-4 text-white" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/20"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/onedrive/files", oneDrivePath] });
                    }}
                    data-testid="button-onedrive-sync"
                  >
                    <RefreshCw className={`h-4 w-4 text-white ${oneDriveLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <div className="flex items-center gap-1 text-[11px] text-white/60 flex-1 truncate">
                    <Cloud className="h-3 w-3" />
                    <span className="truncate">{oneDrivePath === "/" ? "OneDrive" : oneDrivePath}</span>
                  </div>
                </div>
                )}
                
                {oneDriveLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Folders - show all folders for read-only users (they can navigate freely) */}
                    {oneDriveFolders.map((folder) => {
                      // Check if folder name or current path matches a course - use hardcoded colors
                      const courseColorMap: Record<string, string> = {
                        'CPPA122': '#47B045', // green
                        'CFNF400': '#FA67B3', // pink
                        'CASL101': '#818cf8', // indigo
                      };
                      let folderColor: string | undefined;
                      // First check if we're inside a course folder (path contains course code)
                      for (const [courseCode, color] of Object.entries(courseColorMap)) {
                        if (oneDrivePath.includes(courseCode)) {
                          folderColor = color;
                          break;
                        }
                      }
                      // If not inside a course folder, check if folder name itself is a course
                      if (!folderColor) {
                        for (const [courseCode, color] of Object.entries(courseColorMap)) {
                          if (folder.name.includes(courseCode)) {
                            folderColor = color;
                            break;
                          }
                        }
                      }
                      
                      return (
                        <div
                          key={folder.id}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 cursor-pointer rounded transition-colors"
                          onClick={() => {
                            setOneDrivePathHistory([...oneDrivePathHistory, oneDrivePath]);
                            setOneDrivePath(folder.path);
                          }}
                          data-testid={`onedrive-folder-${folder.id}`}
                        >
                          <Folder 
                            className={folderColor ? "h-4 w-4" : "h-4 w-4 text-yellow-500 fill-yellow-400"}
                            style={folderColor ? { color: folderColor, fill: folderColor } : undefined}
                          />
                          <span className="text-[13px] text-white/90 truncate flex-1">{folder.name}</span>
                          <ChevronRight className="h-3 w-3 text-white/40" />
                        </div>
                      );
                    })}
                    
                    {/* PDF Files - hidden for read-only share link users */}
                    {!isReadOnly && oneDrivePdfFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 cursor-pointer rounded transition-colors group"
                        onClick={() => {
                          if (file.downloadUrl) {
                            const encodedUrl = encodeURIComponent(file.downloadUrl);
                            const encodedName = encodeURIComponent(file.name);
                            window.location.href = `/pdf-reader/onedrive?url=${encodedUrl}&name=${encodedName}`;
                          }
                        }}
                        data-testid={`onedrive-file-${file.id}`}
                      >
                        <FileText className="h-4 w-4 text-red-400" />
                        <span className="text-[13px] text-white/90 truncate flex-1">{file.name}</span>
                        <Play className="h-3 w-3 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                    
                    {/* Other Files - hidden for read-only share link users */}
                    {!isReadOnly && oneDriveFiles.filter(f => !f.mimeType?.includes("pdf")).map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 cursor-pointer rounded transition-colors"
                        onClick={() => {
                          if (file.downloadUrl) {
                            window.open(file.downloadUrl, "_blank");
                          }
                        }}
                        data-testid={`onedrive-file-${file.id}`}
                      >
                        <FileText className="h-4 w-4 text-white/60" />
                        <span className="text-[13px] text-white/70 truncate flex-1">{file.name}</span>
                      </div>
                    ))}
                    
                    {oneDriveItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-white/40">
                        <Folder className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-[12px]">No files found</p>
                      </div>
                    )}
                    
                  </div>
                )}
                
                {/* Legacy week folders hidden - using OneDrive now */}
                {false && (() => {
                  // Get current week number based on today's date
                  const today = new Date();
                  const currentWeekData = weeks.find(w => {
                    const start = new Date(w.startDate);
                    const end = new Date(w.endDate);
                    return today >= start && today <= end;
                  });
                  const currentWeekNum = currentWeekData?.weekNumber || selectedWeek;
                  
                  // Sort weeks: current/future weeks first (by number), past weeks at the bottom
                  const sortedWeeks = [...FLYOUT_WEEKS].sort((a, b) => {
                    const aNum = parseInt(a.id.replace('week-', ''));
                    const bNum = parseInt(b.id.replace('week-', ''));
                    
                    // Check if weeks are past (ended)
                    const aWeekData = weeks.find(w => w.weekNumber === aNum);
                    const bWeekData = weeks.find(w => w.weekNumber === bNum);
                    const aPast = aWeekData ? new Date(aWeekData.endDate) < today : aNum < currentWeekNum;
                    const bPast = bWeekData ? new Date(bWeekData.endDate) < today : bNum < currentWeekNum;
                    
                    // Past weeks go to the bottom
                    if (aPast && !bPast) return 1;
                    if (!aPast && bPast) return -1;
                    
                    // Within same status, sort by week number
                    return aNum - bNum;
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
                      <div key={week.id} className="mb-1">
                        {/* Week folder row */}
                        <div 
                          className={`flex items-center gap-1.5 pr-2 py-1 hover:bg-white/10 cursor-pointer rounded transition-colors ${shouldBlink ? 'animate-week-blink' : ''} ${draggedFileForMove ? 'border border-dashed border-blue-400/50' : 'border-0'}`}
                          onClick={() => toggleFlyoutFolder(week.id)}
                          onContextMenu={(e) => handleFolderContextMenu(e, week.id)}
                          data-testid={`flyout-${week.id}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                            if (draggedFileForMove) {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                            }
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.style.backgroundColor = '';
                            const fileId = e.dataTransfer.getData('text/plain');
                            // Default to first course's reading folder
                            const targetFolder = `${week.id}-cppa122-reading`;
                            if (fileId) {
                              try {
                                const res = await fetch(`/api/files/${fileId}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ folder: targetFolder })
                                });
                                if (res.ok) {
                                  queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                                  refreshFileCounts();
                                  toast({ title: "File moved to CPPA122 Reading" });
                                } else {
                                  toast({ title: "Failed to move file", variant: "destructive" });
                                }
                              } catch (err) {
                                toast({ title: "Failed to move file", variant: "destructive" });
                              }
                            }
                            setDraggedFileForMove(null);
                          }}
                        >
                          {isWeekExpanded ? <ChevronDown className="h-3.5 w-3.5 text-white/60" /> : <ChevronRight className="h-3.5 w-3.5 text-white/60" />}
                          {isWeekExpanded ? <FolderOpen className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" /> : <Folder className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" />}
                          <span className={`text-[13px] truncate ${shouldStrikethrough ? 'text-white/50' : 'text-white/90'}`}>{week.name}</span>
                          <span className="text-[11px] text-white/40 ml-auto">{weekFiles.length}</span>
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
                                <div key={courseFolderId} className="mb-0.5">
                                  <div
                                    className={`flex items-center gap-1.5 pr-2 py-1 hover:bg-white/10 cursor-pointer rounded transition-colors ${draggedFileForMove ? 'border border-dashed border-blue-400/50' : ''}`}
                                    onClick={() => toggleFlyoutFolder(courseFolderId)}
                                    onContextMenu={(e) => handleFolderContextMenu(e, courseFolderId)}
                                    data-testid={`flyout-folder-${courseFolderId}`}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      e.dataTransfer.dropEffect = 'move';
                                      if (draggedFileForMove) {
                                        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                                      }
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '';
                                    }}
                                    onDrop={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      e.currentTarget.style.backgroundColor = '';
                                      const fileId = e.dataTransfer.getData('text/plain');
                                      // Default to 'reading' content folder when dropping on course
                                      const targetFolder = `${week.id}-${course.id}-reading`;
                                      if (fileId) {
                                        try {
                                          const res = await fetch(`/api/files/${fileId}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ folder: targetFolder })
                                          });
                                          if (res.ok) {
                                            queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                                            toast({ title: "File moved to Reading folder" });
                                          } else {
                                            toast({ title: "Failed to move file", variant: "destructive" });
                                          }
                                        } catch (err) {
                                          toast({ title: "Failed to move file", variant: "destructive" });
                                        }
                                      }
                                      setDraggedFileForMove(null);
                                    }}
                                  >
                                    {isCourseExpanded ? <ChevronDown className="h-3.5 w-3.5 text-white/60" /> : <ChevronRight className="h-3.5 w-3.5 text-white/60" />}
                                    {isCourseExpanded ? <FolderOpen className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" /> : <Folder className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" />}
                                    <span className={`text-[12px] truncate flex-1 ${course.color}`}>{course.name}</span>
                                    <span className="text-[11px] text-white/40">{courseFiles.length}</span>
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
                                          <div key={contentFolderId} className="mb-0.5">
                                            <div
                                              className={`flex items-center gap-1.5 pr-2 py-1 hover:bg-white/10 cursor-pointer rounded transition-colors ${draggedFileForMove && draggedFileForMove.folder !== contentFolderId ? 'border border-dashed border-blue-400/50' : ''}`}
                                              onClick={() => toggleFlyoutFolder(contentFolderId)}
                                              onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                e.dataTransfer.dropEffect = 'move';
                                                if (draggedFileForMove && draggedFileForMove.folder !== contentFolderId) {
                                                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                                                }
                                              }}
                                              onDragLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '';
                                              }}
                                              onDrop={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                e.currentTarget.style.backgroundColor = '';
                                                const fileId = e.dataTransfer.getData('text/plain');
                                                if (fileId) {
                                                  try {
                                                    const res = await fetch(`/api/files/${fileId}`, {
                                                      method: 'PATCH',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({ folder: contentFolderId })
                                                    });
                                                    if (res.ok) {
                                                      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                                                      toast({ title: "File moved successfully" });
                                                    } else {
                                                      toast({ title: "Failed to move file", variant: "destructive" });
                                                    }
                                                  } catch (err) {
                                                    toast({ title: "Failed to move file", variant: "destructive" });
                                                  }
                                                }
                                                setDraggedFileForMove(null);
                                              }}
                                            >
                                              {isContentExpanded ? <ChevronDown className="h-3.5 w-3.5 text-white/60" /> : <ChevronRight className="h-3.5 w-3.5 text-white/60" />}
                                              {isContentExpanded ? <FolderOpen className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" /> : <Folder className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" />}
                                              <span className="text-[12px] text-white/90 truncate flex-1">{content.name}</span>
                                              <span className="text-[11px] text-white/40">{contentFiles.length}</span>
                                            </div>
                                            
                                            {/* Files inside content folder */}
                                            {isContentExpanded && (
                                              <div className="ml-3 space-y-0.5">
                                                {contentFiles.map((file) => (
                                                  <div
                                                    key={file.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                      e.dataTransfer.setData('text/plain', file.id.toString());
                                                      e.dataTransfer.effectAllowed = 'move';
                                                      setDraggedFileForMove({ id: file.id, folder: file.folder || '' });
                                                    }}
                                                    onDragEnd={() => setDraggedFileForMove(null)}
                                                    className={`flex items-center gap-1.5 pr-2 py-1 hover:bg-white/10 rounded group cursor-grab active:cursor-grabbing ${draggedFileForMove?.id === file.id ? 'opacity-50' : ''}`}
                                                  >
                                                    <Checkbox
                                                      checked={file.listened || false}
                                                      onCheckedChange={async (checked) => {
                                                        try {
                                                          const resp = await fetch(`/api/files/${file.id}`, {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            credentials: 'include',
                                                            body: JSON.stringify({ listened: checked === true })
                                                          });
                                                          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                                                          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                                                          queryClient.invalidateQueries({ queryKey: ['/api/files/counts'] });
                                                          queryClient.invalidateQueries({ queryKey: ['/api/onedrive/week-counts'] });
                                                        } catch (err) {
                                                          console.error('Failed to update listened status:', err);
                                                        }
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="h-3.5 w-3.5 border border-white/40 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                    />
                                                    <FileText className="h-3.5 w-3.5 text-white/50 shrink-0" />
                                                    <span 
                                                      className={`text-[11px] truncate flex-1 hover:underline cursor-pointer ${file.listened ? 'text-white/40' : 'text-white/80'}`}
                                                      onClick={() => setPreviewFile(file)}
                                                      onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        const menu = document.createElement('div');
                                                        menu.className = 'fixed z-[9999] bg-[#252526] border border-white/20 rounded-md py-1 shadow-lg min-w-[140px]';
                                                        menu.style.left = `${e.clientX}px`;
                                                        menu.style.top = `${e.clientY}px`;
                                                        menu.innerHTML = `
                                                          <div class="px-3 py-1.5 text-sm text-white/90 hover:bg-white/10 cursor-pointer flex items-center gap-2" data-action="move">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/></svg>
                                                            Move to...
                                                          </div>
                                                          <div class="px-3 py-1.5 text-sm text-white/90 hover:bg-white/10 cursor-pointer flex items-center gap-2" data-action="rename">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                                            Rename
                                                          </div>
                                                          <div class="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 cursor-pointer flex items-center gap-2" data-action="delete">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                            Delete
                                                          </div>
                                                        `;
                                                        document.body.appendChild(menu);
                                                        
                                                        const closeMenu = () => {
                                                          menu.remove();
                                                          document.removeEventListener('click', closeMenu);
                                                        };
                                                        
                                                        menu.querySelector('[data-action="move"]')?.addEventListener('click', () => {
                                                          setMoveFileId(file.id);
                                                          setMoveFileCurrentFolder(file.folder || '');
                                                          closeMenu();
                                                        });
                                                        
                                                        menu.querySelector('[data-action="rename"]')?.addEventListener('click', () => {
                                                          setRenameFileId(file.id);
                                                          setRenameFileName(file.displayName || file.originalName);
                                                          closeMenu();
                                                        });
                                                        
                                                        menu.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
                                                          if (confirm(`Delete "${file.displayName || file.originalName}"?`)) {
                                                            try {
                                                              await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
                                                              queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                                                              toast({ title: "File deleted" });
                                                            } catch (err) {
                                                              toast({ title: "Failed to delete file", variant: "destructive" });
                                                            }
                                                          }
                                                          closeMenu();
                                                        });
                                                        
                                                        setTimeout(() => document.addEventListener('click', closeMenu), 0);
                                                      }}
                                                    >
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
              
                          </div>
          </div>
        </div>
        ) : (
        <div className="mb-[12px] mt-[0px] relative flex gap-4 transition-all duration-300" style={{ height: calendarHeight - 35, order: 1 }}>
          <div style={{ width: 'calc(100% - 67px)', height: 'calc(100% - 5px)', marginTop: '-2px' }} className="relative overflow-visible">
          {/* Glass effect backing box */}
          <div 
            className="absolute pointer-events-none"
            style={{ 
              top: '-5px', 
              left: '-15px', 
              right: '-15px', 
              bottom: '-27px', 
              background: 'rgba(255, 255, 255, 0.35)',
              borderRadius: '31px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
          <div className="relative" style={{ height: 'calc(100% + 5px)', marginTop: '8px' }}>
            <div className="absolute inset-0 pointer-events-none z-[100]" style={{ border: '2px solid black', borderRadius: '16px' }} />
            <div className="overflow-hidden h-full" style={{ background: 'black', borderRadius: '16px' }}>
            <div className="p-0 h-full flex flex-col" style={{ overflow: 'hidden' }}>
              {/* Month Header */}
              <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-white z-10">
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
              {(() => {
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                const startDate = startOfWeek(monthStart, { weekStartsOn: 6 });
                const endDate = endOfWeek(monthEnd, { weekStartsOn: 6 });
                
                const days: Date[] = [];
                let d = startDate;
                while (d <= endDate) {
                  days.push(d);
                  d = addDays(d, 1);
                }
                const numRows = Math.ceil(days.length / 7);
                
                return (
                  <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${numRows}, 1fr)`, flex: '1 1 0%', minHeight: 0, height: 0 }}>
                    {days.map((day, idx) => {
                      const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                      const isToday = isSameDay(day, new Date());
                      const dayTasks = allTasks.filter(t => isSameDay(new Date(t.dueDate), day));
                      
                      return (
                        <div
                          key={idx}
                          className={`p-1 border-r border-b border-border last:border-r-0 ${
                            "bg-card"
                          }`}
                          onClick={() => {
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
                            isToday ? "text-[#5979CC]" : "text-foreground"
                          }`}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {dayTasks.slice(0, 3).map((task) => {
                              const courseCode = task.courseName?.split(" ")[0]?.toUpperCase() || "";
                              const colors = dynamicCourseColors[courseCode];
                              return (
                                <div
                                  key={task.id}
                                  className={`text-[7px] px-1 py-0.5 rounded truncate border ${
                                    task.isCompleted ? "line-through" : ""
                                  }`}
                                  style={{
                                    backgroundColor: task.isCompleted ? '#e5e7eb' : (colors?.bg || '#e5e7eb'),
                                    color: task.isCompleted ? '#6b7280' : (colors?.text || '#000'),
                                    borderColor: task.isCompleted ? '#d1d5db' : (colors?.border || '#9ca3af')
                                  }}
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
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
          </div>
          </div>
        </div>
        )}
        {/* Due Today, Due Tomorrow, Due This Week - Grouped by Course */}
        {(() => {
          // Helper function to get course color
          const getCourseColor = (courseName: string | null | undefined) => {
            if (!courseName) return '#888888';
            if (courseName.startsWith('CPPA122')) return '#47B045'; // green
            if (courseName.startsWith('CFNF400')) return '#FA67B3'; // pink
            if (courseName.startsWith('CASL101')) return '#818cf8'; // indigo
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
          
          // Render column header with resize handles on both sides of progress bar
          const renderTaskColumnHeader = () => {
            const handleStyle = { width: '3px', minHeight: '12px', backgroundColor: 'transparent' };
            return (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '-25px', marginBottom: '4px', gap: '0px' }}>
                {/* Col 1: Checkbox placeholder */}
                <div style={{ width: '16px', flexShrink: 0 }} />
                {/* Handle 1 */}
                <div className="cursor-col-resize hover:bg-white/50" style={handleStyle} onMouseDown={(e) => handleTaskColumnResizeStart(e, 'taskName', true)} onTouchStart={(e) => handleTaskColumnResizeStart(e, 'taskName', true)} />
                {/* Col 2: Progress bar placeholder */}
                <div style={{ width: '44px', flexShrink: 0 }} />
                {/* Handle 2 */}
                <div className="cursor-col-resize hover:bg-white/50" style={handleStyle} onMouseDown={(e) => handleTaskColumnResizeStart(e, 'taskName')} onTouchStart={(e) => handleTaskColumnResizeStart(e, 'taskName')} />
                {/* Col 3: Task */}
                <div style={{ width: `${taskColumnWidths.taskName}px`, flexShrink: 0 }} className="text-[8px] text-white font-normal">Task</div>
                {/* Handle 3 */}
                <div className="cursor-col-resize hover:bg-white/50" style={handleStyle} onMouseDown={(e) => handleTaskColumnResizeStart(e, 'courseCode')} onTouchStart={(e) => handleTaskColumnResizeStart(e, 'courseCode')} />
                {/* Col 4: Code */}
                <div style={{ width: `${taskColumnWidths.courseCode}px`, flexShrink: 0 }} className="text-[8px] text-white font-normal">Code</div>
                {/* Handle 4 */}
                <div className="cursor-col-resize hover:bg-white/50" style={handleStyle} onMouseDown={(e) => handleTaskColumnResizeStart(e, 'courseName')} onTouchStart={(e) => handleTaskColumnResizeStart(e, 'courseName')} />
                {/* Col 5: Course */}
                <div style={{ width: `${taskColumnWidths.courseName}px`, flexShrink: 0 }} className="text-[8px] text-white font-normal">Course</div>
                {/* Handle 5 */}
                <div className="cursor-col-resize hover:bg-white/50" style={handleStyle} onMouseDown={(e) => handleTaskColumnResizeStart(e, 'dueDate')} onTouchStart={(e) => handleTaskColumnResizeStart(e, 'dueDate')} />
                {/* Col 6: Due */}
                <div style={{ width: `${taskColumnWidths.dueDate}px`, flexShrink: 0 }} className="text-[8px] text-white font-normal">Due</div>
                {/* Handle 6 */}
                <div className="cursor-col-resize hover:bg-white/50" style={handleStyle} onMouseDown={(e) => handleTaskColumnResizeStart(e, 'dueDate')} onTouchStart={(e) => handleTaskColumnResizeStart(e, 'dueDate')} />
                {/* Col 7: Days */}
                <div className="text-[8px] text-white font-normal">Days</div>
              </div>
            );
          };

          // Helper to calculate progress bar width based on time until due
          // Shows time remaining - more days = longer bar
          const getProgressBarWidth = (task: typeof dueTodayTasks[0] | undefined): number => {
            if (!task) return 0;
            if (task.isCompleted) return 44;
            
            // Always use time-based progress (days until due)
            // More days until due = longer bar (more time remaining)
            const daysUntil = differenceInDays(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
            const maxDays = 7;
            // More days = more fill (capped at 7 days)
            const progressPercent = Math.max(0, Math.min(100, (daysUntil / maxDays) * 100));
            return Math.round((progressPercent / 100) * 44);
          };

          // Helper to get progress bar color based on box type and days until due
          const getProgressColor = (task: typeof dueTodayTasks[0] | undefined, boxType: 'today' | 'tomorrow' | 'thisweek' = 'thisweek'): string => {
            if (!task) return '#22c55e';
            const daysUntil = differenceInDays(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
            if (boxType === 'today') return '#ef4444';
            if (boxType === 'tomorrow') return '#eab308';
            return daysUntil <= 3 ? '#eab308' : '#22c55e';
          };

          // Helper to format days display for Tomorrow box
          // Shows "1(X)d" for prep tasks where X is the actual due date days
          // Returns JSX with proper coloring: "1" and "d" in progress bar color, "(X)" in green if X >= 4
          const getTomorrowDaysDisplay = (task: typeof dueTodayTasks[0] | undefined, progressColor?: string): React.ReactNode => {
            if (!task?.dueDate) return '';
            const daysUntilDue = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            const barColor = progressColor || getProgressColor(task, 'tomorrow');
            
            // If task is actually due tomorrow (1 day), just show "1d" in progress bar color
            if (daysUntilDue <= 1) {
              return <span style={{ color: barColor }}>1d</span>;
            }
            
            // If task has a startDate and is in prep period, show "1(X)d" format
            if (task.startDate) {
              // Green color for (X) if X >= 4, otherwise use a medium green
              const bracketColor = daysUntilDue >= 4 ? '#22c55e' : '#86efac';
              return (
                <>
                  <span style={{ color: barColor }}>1</span>
                  <span style={{ color: bracketColor }}>({daysUntilDue})</span>
                  <span style={{ color: barColor }}>d</span>
                </>
              );
            }
            
            // Fallback to regular days display in progress bar color
            return <span style={{ color: barColor }}>{daysUntilDue}d</span>;
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
            
            // Calculate progress using the helper function (subtasks or time-based)
            const progressBarWidth = getProgressBarWidth(task);
            
            // Color based on box type: Today=red, Tomorrow=yellow, This Week=based on days
            const progressColor = getProgressColor(task, boxType);
            
            // Parse course code and name (format: "CPPA122" or "CPPA122 - Full Name")
            const courseCode = (task.courseName?.split(' - ')[0] || '').trim();
            const courseFullName = (task.courseName?.includes(' - ') ? task.courseName.split(' - ').slice(1).join(' - ') : '').trim();
            
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
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '-25px', gap: '0px' }}>
                  {/* Col 1: Checkbox */}
                  <div style={{ width: '16px', flexShrink: 0 }}>
                    {!isCASL101Task(task) ? (
                      <input
                        type="checkbox"
                        checked={task.isCompleted ?? false}
                        onChange={(e) => completeMutation.mutate({ id: task.id, isCompleted: e.target.checked })}
                        className="h-3.5 w-3.5 rounded-sm border-0 cursor-pointer"
                        style={{ accentColor: getCourseColor(task.courseName) }}
                        data-testid={`checkbox-task-${task.id}`}
                        {...(boxType === 'today' ? { 'data-today-checkbox': task.id } : {})}
                        {...(boxType === 'tomorrow' ? { 'data-tomorrow-checkbox': task.id } : {})}
                      />
                    ) : (
                      <div className="h-3.5 w-3.5" />
                    )}
                  </div>
                  {/* Handle 1 spacer */}
                  <div style={{ width: '3px', flexShrink: 0 }} />
                  {/* Col 2: Progress bar */}
                  <div style={{ width: '44px', flexShrink: 0, position: 'relative' }}>
                    {/* Background track */}
                    <div 
                      className="rounded-full"
                      style={{ 
                        width: '44px', 
                        height: '3px', 
                        backgroundColor: 'rgba(255,255,255,0.15)'
                      }}
                    />
                    {/* Progress fill */}
                    <div 
                      className="rounded-full transition-all duration-300"
                      style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${progressBarWidth}px`, 
                        height: '3px', 
                        backgroundColor: progressColor,
                        opacity: 0.9
                      }}
                      title={`${daysUntil} ${daysUntil === 1 ? 'day' : 'days'} left`}
                    />
                  </div>
                  {/* Handle 2 spacer */}
                  <div style={{ width: '3px', flexShrink: 0 }} />
                  {/* Col 3: Task name */}
                  <button 
                    className="text-[10px] text-white font-bold truncate hover:underline cursor-pointer"
                    onClick={() => setEditingTask(task)}
                    data-testid={`task-link-${task.id}`}
                    style={{ width: `${taskColumnWidths.taskName}px`, flexShrink: 0, textAlign: 'left' }}
                  >
                    {task.title}
                  </button>
                  {/* Handle 3 spacer */}
                  <div style={{ width: '3px', flexShrink: 0 }} />
                  {/* Col 4: Course code */}
                  <div 
                    className="text-[10px] text-white/60 font-normal whitespace-nowrap truncate"
                    style={{ width: `${taskColumnWidths.courseCode}px`, flexShrink: 0 }}
                  >
                    {courseCode}
                  </div>
                  {/* Handle 4 spacer */}
                  <div style={{ width: '3px', flexShrink: 0 }} />
                  {/* Col 5: Course name */}
                  <div 
                    className="text-[10px] text-white/60 font-normal whitespace-nowrap truncate"
                    style={{ width: `${taskColumnWidths.courseName}px`, flexShrink: 0 }}
                  >
                    {courseFullName}
                  </div>
                  {/* Handle 5 spacer */}
                  <div style={{ width: '3px', flexShrink: 0 }} />
                  {/* Col 6: Due date */}
                  <span 
                    className="text-[10px] text-white whitespace-nowrap"
                    style={{ width: `${taskColumnWidths.dueDate}px`, flexShrink: 0 }}
                  >
                    {showDaysUntil ? `${format(new Date(task.dueDate), 'EEE')} ${format(new Date(task.dueDate), 'M/d')}` : format(new Date(task.dueDate), 'M/d')}
                  </span>
                  {/* Handle 6 spacer */}
                  <div style={{ width: '3px', flexShrink: 0 }} />
                  {/* Col 7: Days */}
                  <span 
                    className="text-[10px] font-medium whitespace-nowrap"
                    style={{ color: progressColor }}
                  >
                    {daysUntil}d
                  </span>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {attachments.map((file, idx) => {
                      const matchingFile = findFileByUrl(file.url);
                      const displayName = matchingFile?.displayName || file.name || file.url.split('/').pop() || 'File';
                      return (
                        <button
                          key={idx}
                          className={`flex items-center gap-1.5 text-[10px] text-white cursor-pointer w-full pl-6 ${blinkSettings.taskBoxFilesBlink ? 'animate-file-box-blink-fast' : 'bg-[rgba(127,219,225,0.8)]'}`}
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
        <div style={{ order: 3, height: '0px', position: 'relative', flexShrink: 0 }}>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch fixed" style={{ zIndex: 35, left: `${calendarLeft - 15}px`, right: `${calendarRight - 15}px`, bottom: '12px', height: '157px' }} data-task-boxes-container="true">
          {/* Due This Week - CSS Box */}
          <section 
            className={`flex-1 rounded-[12px] overflow-hidden flex flex-col min-h-[91px] sm:min-h-[131px] ${draggedBox === 'this-week' ? 'opacity-50' : ''}`} 
            style={{ 
              background: colorSettings.boxGlassEffect 
                ? `rgba(${parseInt(colorSettings.boxBackground.slice(1,3), 16)}, ${parseInt(colorSettings.boxBackground.slice(3,5), 16)}, ${parseInt(colorSettings.boxBackground.slice(5,7), 16)}, ${colorSettings.boxTransparency / 100})`
                : colorSettings.boxBackground,
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
              order: boxOrder.indexOf('this-week') + 1, 
              marginLeft: '0px', 
              marginRight: '0px',
              paddingBottom: '5px',
              ...(thisWeekBoxHeight ? { height: `${thisWeekBoxHeight}px`, flexGrow: 1, flexShrink: 0, flexBasis: 0 } : {})
            }} 
            data-testid="section-due-this-week"
            onDragOver={(e) => handleBoxDragOver(e, 'this-week')}
          >
            <div 
              style={{ 
                background: colorSettings.headerBar,
                padding: '6px 12px'
              }}
            >
              <h4 
                className="text-xs font-normal flex items-center justify-between text-white cursor-grab" 
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}
                draggable
                onDragStart={() => handleBoxDragStart('this-week')}
                onDragEnd={handleBoxDragEnd}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-white" />
                  One Week Ahead ({dueThisWeekTasks.length}) -<span className="text-[10px]" style={{ verticalAlign: 'bottom', marginLeft: '-2px', color: '#356397' }}>{(() => {
                    return `${format(thisWeekStart, 'EEE, MMMM d')} - ${format(thisWeekEnd, 'EEE, MMMM d')}`;
                  })()}</span>
                </span>
                {/* 9-dot grip */}
                <div className="grid grid-cols-3 gap-[2px]">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/70" />
                  ))}
                </div>
              </h4>
            </div>
            <div className="flex-1 px-3 flex flex-col" style={{ paddingTop: '6px', paddingBottom: '0px', backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)', overflowY: dueThisWeekTasks.length >= 6 ? 'auto' : 'hidden' }}>
              {dueThisWeekTasks.length === 0 ? (
                <div style={{ position: 'relative', minHeight: '80px' }}>
                  {/* Headers row for empty state */}
                  <div style={{ position: 'relative', height: '12px', marginBottom: '2px' }}>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.remaining}px`, top: '0px' }}>Remaining</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.task}px`, top: '0px' }}>Task</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.code}px`, top: '0px' }}>Code</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.course + 4}px`, top: '0px' }}>Course</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.due}px`, top: '0px' }}>Due</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', right: '0px', top: '0px', width: '22px', textAlign: 'right' }}>Days</span>
                  </div>
                  {/* Empty state message - centered in body */}
                  <div className="flex items-center justify-center text-white/60 text-xs" style={{ height: '60px' }}>No tasks due this week</div>
                </div>
              ) : isMobile ? (
                <div className="flex flex-col gap-2">
                  {dueThisWeekTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 py-2 px-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <input 
                        type="checkbox" 
                        className="h-5 w-5 rounded-sm border-2 border-white/50 flex-shrink-0" 
                        disabled
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{task.title}</div>
                        <div className="text-xs text-white/60">{task.courseName?.split(' - ')[0]} • {task.dueDate ? format(new Date(task.dueDate), 'EEE M/d') : ''}</div>
                      </div>
                      <div className="text-xs text-green-400 flex-shrink-0">
                        {task.dueDate ? `${Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d` : ''}
                      </div>
                    </div>
                  ))}
                  {dueThisWeekTasks.length > 5 && (
                    <div className="text-xs text-white/50 text-center">+{dueThisWeekTasks.length - 5} more</div>
                  )}
                </div>
              ) : (
              <>
              {/* Desktop Layout - ALL rows use HEADER_POS constants, NO measurement needed */}
              {/* Headers row */}
              <div style={{ position: 'relative', height: '10px', marginBottom: '4px' }}>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.remaining}px` }}>Remaining</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.task}px` }}>Task</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.code}px` }}>Code</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.course + 4}px` }}>Course</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.due}px` }}>Due</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', right: '0px', textAlign: 'right' }}>Days</span>
              </div>
              {/* Task rows - each row is position:relative with all content absolutely positioned at same baseline */}
              {dueThisWeekTasks.slice(0, 5).map((task, idx) => (
              <div key={task.id || idx} style={{ position: 'relative', height: '16px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ position: 'absolute', left: '0px', top: '50%', transform: 'translateY(-50%)', visibility: task.type === 'class' ? 'hidden' : 'visible' }}>
                  <input type="checkbox" className="h-3.5 w-3.5 rounded-sm border-0 cursor-pointer" disabled />
                </div>
                <div style={{ position: 'absolute', left: `${HEADER_POS.remaining}px`, top: '50%', transform: 'translateY(-50%)', width: '44px' }}>
                  <div className="rounded-full" style={{ width: '44px', height: '3px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
                  <div className="rounded-full" style={{ position: 'absolute', top: 0, left: 0, width: `${getProgressBarWidth(task)}px`, height: '3px', backgroundColor: getProgressColor(task), opacity: 0.9 }} />
                </div>
                <span style={{ position: 'absolute', left: `${HEADER_POS.task}px`, top: '50%', transform: 'translateY(-50%)', fontSize: '10px', lineHeight: '1', color: 'white', maxWidth: `${HEADER_POS.code - HEADER_POS.task - 5}px`, display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>{task.title || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.code}px`, top: '50%', transform: 'translateY(-50%)', fontSize: '9px', lineHeight: '1', color: '#9ca3af' }}>{task.courseName?.split(' - ')[0] || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.course + 4}px`, top: '50%', transform: 'translateY(-50%)', fontSize: '9px', lineHeight: '1', color: '#9ca3af', maxWidth: `${HEADER_POS.due - HEADER_POS.course - 9}px`, display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>{task.courseName?.split(' - ')[1] || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.due}px`, top: '50%', transform: 'translateY(-50%)', fontSize: '10px', lineHeight: '1', color: 'white' }}>{task.dueDate ? format(new Date(task.dueDate), 'EEE M/d') : ''}</span>
                <span style={{ position: 'absolute', right: '0px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', lineHeight: '1', color: getProgressColor(task), textAlign: 'right' }}>{task.dueDate ? `${Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d` : ''}</span>
              </div>
              ))}
              {dueThisWeekTasks.length > 5 && (
                <div className="text-xs text-white/50 text-center" style={{ marginTop: '2px' }}>+{dueThisWeekTasks.length - 5} more</div>
              )}
              </>
              )}
            </div>
          </section>

          {/* Due Today - CSS Box */}
          <section 
            className={`flex-1 rounded-[12px] overflow-hidden flex flex-col min-h-[91px] sm:min-h-[131px] ${draggedBox === 'today' ? 'opacity-50' : ''}`} 
            style={{ 
              background: colorSettings.boxGlassEffect 
                ? `rgba(${parseInt(colorSettings.boxBackground.slice(1,3), 16)}, ${parseInt(colorSettings.boxBackground.slice(3,5), 16)}, ${parseInt(colorSettings.boxBackground.slice(5,7), 16)}, ${colorSettings.boxTransparency / 100})`
                : colorSettings.boxBackground,
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
              order: boxOrder.indexOf('today') + 1, 
              marginLeft: '0px', 
              marginRight: '0px',
              paddingBottom: '5px'
            }} 
            data-testid="section-due-today"
            onDragOver={(e) => handleBoxDragOver(e, 'today')}
          >
            <div 
              style={{ 
                background: colorSettings.headerBar,
                padding: '6px 12px'
              }}
            >
              <h4 
                className="text-xs font-normal flex items-center justify-between text-white cursor-grab" 
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}
                draggable
                onDragStart={() => handleBoxDragStart('today')}
                onDragEnd={handleBoxDragEnd}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-white" />
                  Today ({dueTodayTasks.length}) -<span className="text-[10px]" style={{ verticalAlign: 'bottom', marginLeft: '-2px', color: '#356397' }}>{format(new Date(), 'EEE, MMMM d, yyyy')}</span>
                </span>
                {/* 9-dot grip */}
                <div className="grid grid-cols-3 gap-[2px]">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/70" />
                  ))}
                </div>
              </h4>
            </div>
            <div className="flex-1 px-3 flex flex-col" style={{ paddingTop: '6px', paddingBottom: '0px', backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)', overflowY: dueTodayTasks.length >= 6 ? 'auto' : 'hidden' }}>
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-white/60 text-xs">Loading...</div>
              ) : dueTodayTasks.length === 0 ? (
                <div style={{ position: 'relative', minHeight: '80px' }}>
                  {/* Headers row for empty state */}
                  <div style={{ position: 'relative', height: '12px', marginBottom: '2px' }}>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.remaining}px`, top: '0px' }}>Remaining</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.task}px`, top: '0px' }}>Task</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.code}px`, top: '0px' }}>Code</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.course}px`, top: '0px' }}>Course</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.due}px`, top: '0px' }}>Due</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', right: '0px', top: '0px', width: '22px', textAlign: 'right' }}>Days</span>
                  </div>
                  {/* Empty state message - centered in body */}
                  <div className="flex items-center justify-center text-white/60 text-xs" style={{ height: '60px' }}>No tasks due today</div>
                </div>
              ) : isMobile ? (
                <div className="flex flex-col gap-2">
                  {dueTodayTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 py-2 px-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <input 
                        type="checkbox" 
                        className="h-5 w-5 rounded-sm border-2 border-white/50 flex-shrink-0" 
                        disabled
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{task.title}</div>
                        <div className="text-xs text-white/60">{task.courseName?.split(' - ')[0]} • {task.dueDate ? format(new Date(task.dueDate), 'EEE M/d') : ''}</div>
                      </div>
                      <div className="text-xs text-green-400 flex-shrink-0">
                        {task.dueDate ? `${Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d` : ''}
                      </div>
                    </div>
                  ))}
                  {dueTodayTasks.length > 5 && (
                    <div className="text-xs text-white/50 text-center">+{dueTodayTasks.length - 5} more</div>
                  )}
                </div>
              ) : (
                <>
              {/* Headers row - uses HEADER_POS */}
              <div style={{ position: 'relative', height: '10px', marginBottom: '4px' }}>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.remaining}px` }}>Remaining</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.task}px` }}>Task</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.code}px` }}>Code</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.course}px` }}>Course</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.due}px` }}>Due</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', right: '0px', textAlign: 'right' }}>Days</span>
              </div>
              {/* Task rows - all use HEADER_POS */}
              {dueTodayTasks.slice(0, 3).map((task, idx) => (
              <div key={task.id || idx} style={{ position: 'relative', height: '16px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ position: 'absolute', left: '0px', top: '0px', visibility: task.type === 'class' ? 'hidden' : 'visible' }}>
                  <input type="checkbox" className="h-3.5 w-3.5 rounded-sm border-0 cursor-pointer" disabled />
                </div>
                <div style={{ position: 'absolute', left: `${HEADER_POS.remaining}px`, top: '6px', width: '44px' }}>
                  <div className="rounded-full" style={{ width: '44px', height: '3px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
                  <div className="rounded-full" style={{ position: 'absolute', top: 0, left: 0, width: `${getProgressBarWidth(task)}px`, height: '3px', backgroundColor: getProgressColor(task, 'today'), opacity: 0.9 }} />
                </div>
                <span style={{ position: 'absolute', left: `${HEADER_POS.task}px`, bottom: '1px', fontSize: '10px', lineHeight: '1', color: 'white', maxWidth: `${HEADER_POS.code - HEADER_POS.task - 5}px`, display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>{task.title || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.code}px`, bottom: '0px', fontSize: '9px', lineHeight: '1', color: '#9ca3af' }}>{task.courseName?.split(' - ')[0] || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.course}px`, bottom: '0px', fontSize: '9px', lineHeight: '1', color: '#9ca3af', maxWidth: `${HEADER_POS.due - HEADER_POS.course - 5}px`, display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>{task.courseName?.split(' - ')[1] || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.due}px`, bottom: '1px', fontSize: '10px', lineHeight: '1', color: 'white' }}>{task.dueDate ? format(new Date(task.dueDate), 'EEE M/d') : ''}</span>
                <span style={{ position: 'absolute', right: '0px', bottom: '1px', fontSize: '10px', lineHeight: '1', color: getProgressColor(task, 'today'), textAlign: 'right' }}>{task.dueDate ? `${differenceInCalendarDays(new Date(task.dueDate), new Date())}d` : ''}</span>
              </div>
              ))}
                </>
              )}
              <div className="flex-1 flex flex-col" />
            </div>
          </section>

          {/* Due Tomorrow - CSS Box */}
          <section 
            className={`flex-1 rounded-[12px] overflow-hidden flex flex-col min-h-[91px] sm:min-h-[131px] ${draggedBox === 'tomorrow' ? 'opacity-50' : ''}`} 
            style={{ 
              background: colorSettings.boxGlassEffect 
                ? `rgba(${parseInt(colorSettings.boxBackground.slice(1,3), 16)}, ${parseInt(colorSettings.boxBackground.slice(3,5), 16)}, ${parseInt(colorSettings.boxBackground.slice(5,7), 16)}, ${colorSettings.boxTransparency / 100})`
                : colorSettings.boxBackground,
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
              order: boxOrder.indexOf('tomorrow') + 1, 
              marginLeft: '0px', 
              marginRight: '0px',
              paddingBottom: '5px'
            }} 
            data-testid="section-due-tomorrow"
            onDragOver={(e) => handleBoxDragOver(e, 'tomorrow')}
          >
            <div 
              style={{ 
                background: colorSettings.headerBar,
                padding: '6px 12px'
              }}
            >
              <h4 
                className="text-xs font-normal flex items-center justify-between text-white cursor-grab" 
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}
                draggable
                onDragStart={() => handleBoxDragStart('tomorrow')}
                onDragEnd={handleBoxDragEnd}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-white" />
                  Tomorrow ({dueTomorrowTasks.length}) -<span className="text-[10px]" style={{ verticalAlign: 'bottom', marginLeft: '-2px', color: '#356397' }}>{format(addDays(new Date(), 1), 'EEE, MMMM d, yyyy')}</span>
                </span>
                {/* 9-dot grip */}
                <div className="grid grid-cols-3 gap-[2px]">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/70" />
                  ))}
                </div>
              </h4>
            </div>
            <div className="flex-1 px-3 flex flex-col" style={{ paddingTop: '6px', paddingBottom: '0px', backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)', overflowY: dueTomorrowTasks.length >= 6 ? 'auto' : 'hidden' }}>
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-white/60 text-xs">Loading...</div>
              ) : dueTomorrowTasks.length === 0 ? (
                <div style={{ position: 'relative', minHeight: '80px' }}>
                  {/* Headers row */}
                  <div style={{ position: 'relative', height: '12px', marginBottom: '2px' }}>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.remaining}px`, top: '0px' }}>Remaining</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.task}px`, top: '0px' }}>Task</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.code}px`, top: '0px' }}>Code</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.course}px`, top: '0px' }}>Course</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.due}px`, top: '0px' }}>Due</span>
                    <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', right: '0px', top: '0px', width: '22px', textAlign: 'right' }}>Days</span>
                  </div>
                  {/* Empty state message - centered in body */}
                  <div className="flex items-center justify-center text-white/60 text-xs" style={{ height: '60px' }}>No tasks due tomorrow</div>
                </div>
              ) : isMobile ? (
                <div className="flex flex-col gap-2">
                  {dueTomorrowTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 py-2 px-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <input 
                        type="checkbox" 
                        className="h-5 w-5 rounded-sm border-2 border-white/50 flex-shrink-0" 
                        disabled
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{task.title}</div>
                        <div className="text-xs text-white/60">{task.courseName?.split(' - ')[0]} • {task.dueDate ? format(new Date(task.dueDate), 'EEE M/d') : ''}</div>
                      </div>
                      <div className="text-xs flex-shrink-0">
                        {getTomorrowDaysDisplay(task)}
                      </div>
                    </div>
                  ))}
                  {dueTomorrowTasks.length > 5 && (
                    <div className="text-xs text-white/50 text-center">+{dueTomorrowTasks.length - 5} more</div>
                  )}
                </div>
              ) : (
                <>
              {/* Headers row - uses HEADER_POS */}
              <div style={{ position: 'relative', height: '10px', marginBottom: '4px' }}>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.remaining}px` }}>Remaining</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.task}px` }}>Task</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.code}px` }}>Code</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.course}px` }}>Course</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', left: `${HEADER_POS.due}px` }}>Due</span>
                <span className="text-[8px] text-white font-normal" style={{ position: 'absolute', right: '0px', textAlign: 'right' }}>Days</span>
              </div>
              {/* Task rows - all use HEADER_POS */}
              {dueTomorrowTasks.slice(0, 3).map((task, idx) => (
              <div key={task.id || idx} style={{ position: 'relative', height: '16px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ position: 'absolute', left: '0px', top: '0px', visibility: task.type === 'class' ? 'hidden' : 'visible' }}>
                  <input type="checkbox" className="h-3.5 w-3.5 rounded-sm border-0 cursor-pointer" disabled />
                </div>
                <div style={{ position: 'absolute', left: `${HEADER_POS.remaining}px`, top: '6px', width: '44px' }}>
                  <div className="rounded-full" style={{ width: '44px', height: '3px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
                  <div className="rounded-full" style={{ position: 'absolute', top: 0, left: 0, width: `${getProgressBarWidth(task)}px`, height: '3px', backgroundColor: getProgressColor(task, 'tomorrow'), opacity: 0.9 }} />
                </div>
                <span style={{ position: 'absolute', left: `${HEADER_POS.task}px`, bottom: '1px', fontSize: '10px', lineHeight: '1', color: 'white', maxWidth: `${HEADER_POS.code - HEADER_POS.task - 5}px`, display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>{task.title || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.code}px`, bottom: '0px', fontSize: '9px', lineHeight: '1', color: '#9ca3af' }}>{task.courseName?.split(' - ')[0] || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.course}px`, bottom: '0px', fontSize: '9px', lineHeight: '1', color: '#9ca3af', maxWidth: `${HEADER_POS.due - HEADER_POS.course - 5}px`, display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>{task.courseName?.split(' - ')[1] || ''}</span>
                <span style={{ position: 'absolute', left: `${HEADER_POS.due}px`, top: '1px', fontSize: '10px', color: 'white' }}>{task.dueDate ? format(new Date(task.dueDate), 'EEE M/d') : ''}</span>
                <span style={{ position: 'absolute', right: '0px', top: '1px', fontSize: '10px', textAlign: 'right' }}>{getTomorrowDaysDisplay(task)}</span>
              </div>
              ))}
                </>
              )}
              <div className="flex-1 flex flex-col" />
            </div>
          </section>
        </div>
        </div>
          );
        })()}

        {/* To Do Bottom Flyout - Burst from bottom */}
        <div 
          className={`fixed transition-all ease-out ${isTodoFlyoutOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
          style={{ 
            width: '900px', 
            height: '85vh',
            top: '50%',
            left: '50%',
            transform: isTodoFlyoutOpen ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
            transformOrigin: '50% calc(50vh + 42.5vh)',
            transitionDuration: '400ms',
            zIndex: getFlyoutZIndex('todo')
          }}
          onClick={() => bringFlyoutToFront('todo')}
        >
          {/* Flyout content */}
          <section 
            className="h-full overflow-hidden flex flex-col rounded-xl bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 text-white" 
            style={{
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.3)'
            }}
            data-testid="section-todo"
          >
            {/* Header bar matching projects/files flyouts */}
            <div 
              className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20"
            >
              <Button 
                variant="outline"
                className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200"
                style={{
                  boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)';
                }}
                onClick={() => {
                  const newItems = [...todoItems, ''];
                  setTodoItems(newItems);
                  setTimeout(() => {
                    const inputEl = document.querySelector(`[data-todo-idx="${newItems.length - 1}"]`) as HTMLInputElement;
                    if (inputEl) inputEl.focus();
                  }, 50);
                }}
                data-testid="button-add-item-flyout"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add To Do
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-3 w-3 text-white" />
                  <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    TO DO ({todoItems.filter(item => item.trim() && !item.startsWith('✓')).length})
                  </h2>
                </div>
                <button 
                  onClick={() => setIsTodoFlyoutOpen(false)}
                  className="text-white hover:text-white/80 transition-colors p-1"
                  data-testid="button-close-todo-flyout"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {todoItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white/40 text-sm">
                  Click "Add To Do" to create an item
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {todoItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-white/40 bg-transparent accent-green-500 flex-shrink-0"
                        checked={item.startsWith('✓')}
                        onChange={(e) => {
                          const newItems = [...todoItems];
                          if (e.target.checked && !newItems[idx].startsWith('✓')) {
                            newItems[idx] = '✓' + newItems[idx];
                          } else if (!e.target.checked && newItems[idx].startsWith('✓')) {
                            newItems[idx] = newItems[idx].slice(1);
                          }
                          setTodoItems(newItems);
                        }}
                      />
                      <input 
                        type="text" 
                        data-todo-idx={idx}
                        className={`flex-1 text-xs px-1.5 py-1 border border-white/20 rounded bg-white/10 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none ${item.startsWith('✓') ? 'line-through text-white/50' : ''}`}
                        placeholder="Item..." 
                        value={item.replace(/^✓/, '')} 
                        onChange={(e) => {
                          const newItems = [...todoItems];
                          const wasChecked = newItems[idx].startsWith('✓');
                          newItems[idx] = (wasChecked ? '✓' : '') + e.target.value;
                          setTodoItems(newItems);
                        }}
                      />
                      <button
                        className="text-white/40 hover:text-white/80 transition-colors p-0.5 flex-shrink-0"
                        onClick={() => {
                          const newItems = todoItems.filter((_, i) => i !== idx);
                          setTodoItems(newItems);
                        }}
                        data-testid={`button-delete-todo-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Projects Flyout - Burst from Left */}
        <div 
          className={`fixed transition-all ease-out ${isProjectsFlyoutOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
          style={{ 
            width: '900px', 
            height: '85vh',
            top: '50%',
            left: '50%',
            transform: isProjectsFlyoutOpen ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
            transformOrigin: 'calc(-50vw + 450px) 50%',
            transitionDuration: '400ms',
            zIndex: getFlyoutZIndex('projects')
          }}
          onClick={() => bringFlyoutToFront('projects')}
        >
          {/* Flyout Panel */}
          <div 
            className="h-full overflow-hidden flex flex-col rounded-xl bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 text-white"
            style={{
              fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '10px 0 40px rgba(0,0,0,0.3)'
            }}
          >
              {/* Header */}
              <div 
                className="flex items-center justify-between px-6 py-3 bg-black/30 border-b border-white/20"
              >
                <Button 
                  variant="outline"
                  className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200"
                  style={{
                    boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)';
                  }}
                  onClick={() => {
                    setEditingProject(null);
                    setProjectDialogOpen(true);
                  }}
                  data-testid="button-new-project-flyout"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3 w-3 text-white" />
                    <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      PROJECTS ({allProjects.length})
                    </h2>
                    <span className="text-[10px] text-white/70">
                      {allTasks.filter(t => t.projectId).length} tasks assigned
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsProjectsFlyoutOpen(false)}
                    className="text-white hover:text-white/80 transition-colors p-1"
                    data-testid="button-close-projects-flyout"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
                {/* Status Filter Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  {[
                    { key: 'all', label: 'All Projects', count: allProjects.length, color: 'text-white' },
                    { key: 'in_progress', label: 'In Progress', count: allProjects.filter(p => p.status === 'in_progress').length, color: 'text-yellow-300' },
                    { key: 'planning', label: 'Planning', count: allProjects.filter(p => p.status === 'planning').length, color: 'text-blue-300' },
                    { key: 'completed', label: 'Completed', count: allProjects.filter(p => p.status === 'completed').length, color: 'text-green-300' },
                    { key: 'on_hold', label: 'On Hold', count: allProjects.filter(p => p.status === 'on_hold').length, color: 'text-gray-300' },
                  ].map(filter => (
                    <div 
                      key={filter.key}
                      className={`cursor-pointer rounded-xl p-4 text-center transition-all ${projectStatusFilter === filter.key ? 'ring-2 ring-white/50' : ''}`}
                      onClick={() => setProjectStatusFilter(filter.key)}
                      style={{ 
                        background: projectStatusFilter === filter.key ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      <div className={`text-2xl font-bold ${filter.color}`}>{filter.count}</div>
                      <div className="text-sm text-white/70">{filter.label}</div>
                    </div>
                  ))}
                </div>
                
                {/* Projects Grid */}
                {(() => {
                  const filteredProjects = projectStatusFilter === 'all' 
                    ? allProjects 
                    : allProjects.filter(p => p.status === projectStatusFilter);
                  
                  if (filteredProjects.length === 0) {
                    return (
                      <div className="text-center py-12 text-white/50">
                        <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <h3 className="text-lg font-medium mb-2">
                          {projectStatusFilter === 'all' ? 'No projects yet' : `No ${projectStatusFilter.replace('_', ' ')} projects`}
                        </h3>
                        <p className="text-sm mb-4">Create a project to organize your tasks and track progress.</p>
                        <Button 
                          variant="outline"
                          className="border-white/30 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => { setEditingProject(null); setProjectDialogOpen(true); }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First Project
                        </Button>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProjects.map(project => {
                        const projectTasks = allTasks.filter(t => t.projectId === project.id);
                        const completedTasks = projectTasks.filter(t => t.isCompleted);
                        const progress = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
                        const isExpanded = expandedProjects.has(project.id);
                        
                        return (
                          <div 
                            key={project.id}
                            className="rounded-xl overflow-hidden flex flex-col"
                            style={{ 
                              background: 'rgba(255, 255, 255, 0.2)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              height: '240px'
                            }}
                          >
                            {/* Project Header with Brown */}
                            <div 
                              className="px-2 py-0.5"
                              style={{ 
                                background: colorSettings.headerBar
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30" 
                                    style={{ backgroundColor: project.color || "#6366F1" }} 
                                  />
                                  <span 
                                    className="text-sm font-medium text-white truncate"
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                                  >
                                    {project.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => {
                                      setEditingProject(project);
                                      setProjectDialogOpen(true);
                                    }}
                                    className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                                    data-testid={`button-edit-project-${project.id}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5 !text-black" strokeWidth={1.5} />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => {
                                      if (confirm("Delete this project?")) {
                                        deleteProjectMutation.mutate(project.id);
                                      }
                                    }}
                                    className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                                    data-testid={`button-delete-project-${project.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 !text-black" strokeWidth={1.5} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Project Body */}
                            <div className="flex-1 p-4 text-white flex flex-col">
                              <div className="flex flex-wrap items-center gap-1.5 mb-2" style={{ marginTop: '-4px' }}>
                                <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                                  project.status === 'completed' ? 'bg-green-500/30 text-green-300 border-green-500/50' :
                                  project.status === 'in_progress' ? 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50' :
                                  project.status === 'planning' ? 'bg-blue-500/30 text-blue-300 border-blue-500/50' :
                                  project.status === 'on_hold' ? 'bg-gray-500/30 text-gray-300 border-gray-500/50' :
                                  'bg-red-500/30 text-red-300 border-red-500/50'
                                }`}>
                                  {(project.status || 'planning').replace('_', ' ')}
                                </Badge>
                                <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                                  project.priority === 'high' ? 'bg-red-500/30 text-red-300 border-red-500/50' :
                                  project.priority === 'medium' ? 'bg-orange-500/30 text-orange-300 border-orange-500/50' :
                                  'bg-green-500/30 text-green-300 border-green-500/50'
                                }`}>
                                  {(project.priority || 'medium').toUpperCase()}
                                </Badge>
                                {project.courseName && (
                                  <Badge 
                                    className="text-[9px] px-1.5 py-0 h-4"
                                    style={{ 
                                      backgroundColor: project.courseName === 'CPPA122' ? '#22C55E' : 
                                                      project.courseName === 'CFNF400' ? '#EC4899' : 
                                                      project.courseName === 'CASL101' ? '#6366F1' : '#6366F1',
                                      color: 'white'
                                    }}
                                  >
                                    {project.courseName}
                                  </Badge>
                                )}
                              </div>

                              {project.description && (
                                <p className="text-[10px] text-white/70 mb-3 line-clamp-2">
                                  {project.description}
                                </p>
                              )}

                              <div className="flex items-center gap-4 text-xs text-white/60 mb-3">
                                {project.startDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>Start: {format(new Date(project.startDate), "MMM d")}</span>
                                  </div>
                                )}
                                {project.targetDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>Due: {format(new Date(project.targetDate), "MMM d")}</span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-auto space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-white/70">
                                  <span>Remaining</span>
                                  <span className="font-medium">{completedTasks.length}/{projectTasks.length} tasks</span>
                                </div>
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-400 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setExpandedProjects(prev => {
                                    const next = new Set(prev);
                                    if (next.has(project.id)) {
                                      next.delete(project.id);
                                    } else {
                                      next.add(project.id);
                                    }
                                    return next;
                                  });
                                }}
                                className="w-full justify-center gap-1 text-white/70 hover:text-white hover:bg-white/10 text-[10px]"
                                style={{ marginTop: '12px', marginBottom: '6px' }}
                              >
                                {isExpanded ? 'Hide Tasks' : `Show Tasks (${projectTasks.length})`}
                              </Button>

                              {isExpanded && projectTasks.length > 0 && (
                                <div className="space-y-1 pt-2 mt-2 border-t border-white/20">
                                  {projectTasks.map((task) => (
                                    <div 
                                      key={task.id}
                                      className={`flex items-center gap-2 p-2 rounded-md text-xs ${
                                        task.isCompleted 
                                          ? "bg-green-500/20 line-through text-white/50" 
                                          : "bg-white/10 text-white"
                                      }`}
                                    >
                                      {task.isCompleted ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                      ) : (
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 flex-shrink-0" />
                                      )}
                                      <span className="flex-1 truncate">{task.title}</span>
                                      {task.dueDate && (
                                        <span className="text-[10px] text-white/50">
                                          {format(new Date(task.dueDate), "MMM d")}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        
        {/* Project Dialog */}
        <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
          <DialogContent className="max-w-lg text-[11px] bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_label]:text-white [&_input]:text-black [&_input]:bg-white [&_textarea]:text-black [&_textarea]:bg-white">
            <DialogHeader>
              <DialogTitle className="text-white text-sm">{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            </DialogHeader>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  color: formData.get('color') as string || '#6366F1',
                  status: formData.get('status') as string || 'planning',
                  targetDate: formData.get('targetDate') as string || undefined,
                  priority: formData.get('priority') as string || 'medium',
                };
                if (editingProject) {
                  updateProjectMutation.mutate({ id: editingProject.id, data });
                } else {
                  createProjectMutation.mutate(data);
                }
                setProjectDialogOpen(false);
                setEditingProject(null);
              }} 
              className="space-y-3"
            >
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-white">Project Name</label>
                <Input 
                  name="name"
                  defaultValue={editingProject?.name || ''}
                  placeholder="Enter project name"
                  required
                  className="text-[11px]"
                  data-testid="input-project-name-flyout"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-white">Description</label>
                <Textarea 
                  name="description"
                  defaultValue={editingProject?.description || ''}
                  placeholder="Describe your project..."
                  rows={2}
                  className="text-[11px]"
                  data-testid="input-project-description-flyout"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-white">Color</label>
                  <input 
                    type="color"
                    name="color"
                    defaultValue={editingProject?.color || '#6366F1'}
                    className="h-9 w-full rounded-md border cursor-pointer"
                    data-testid="input-project-color-flyout"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-white">Status</label>
                  <select 
                    name="status"
                    defaultValue={editingProject?.status || 'planning'}
                    className="w-full h-9 rounded-md border px-2 text-[11px] bg-white text-black"
                    data-testid="select-project-status-flyout"
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-white">Target Date</label>
                  <Input 
                    type="date"
                    name="targetDate"
                    defaultValue={editingProject?.targetDate ? format(new Date(editingProject.targetDate), 'yyyy-MM-dd') : ''}
                    className="text-[11px]"
                    data-testid="input-project-targetdate-flyout"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-white">Priority</label>
                  <select 
                    name="priority"
                    defaultValue={editingProject?.priority || 'medium'}
                    className="w-full h-9 rounded-md border px-2 text-[11px] bg-white text-black"
                    data-testid="select-project-priority-flyout"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setProjectDialogOpen(false); setEditingProject(null); }} className="border-white/30 text-white hover:bg-white/10 hover:text-white">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="outline"
                  className="border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-200"
                  data-testid="button-save-project-flyout"
                >
                  {editingProject ? "Save Changes" : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Task Context Menu for right-click delete */}
        {contextMenu && (
          <div
            className="fixed bg-gray-900/95 border border-white/20 rounded-lg shadow-xl py-1 z-[9999]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              minWidth: '120px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
              onClick={() => {
                deleteMutation.mutate(contextMenu.taskId);
                setContextMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Task
            </button>
          </div>
        )}

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
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-800/95 via-black/90 to-gray-900/95 border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [&_label]:text-white [&_label]:font-normal [&_input]:font-normal [&_select]:font-normal [&_option]:font-normal">
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
                  <Trash2 className="h-5 w-5 text-red-500" />
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
                orient="0"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#ec4899" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-indigo"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="0"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-black"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="0"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#000000" fillOpacity="0.75" />
              </marker>
              <marker
                id="arrowhead-black-down"
                markerWidth="10"
                markerHeight="7"
                refX="3.5"
                refY="10"
                orient="90"
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
  courseColors,
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
  courseColors?: Record<string, { bg: string; border: string; text: string; dot: string; prepBg: string; prepBorder: string; prepText: string; hex: string }>;
}) {
  const Icon = iconMap[task.type] || ClipboardCheck;
  const isMissed = task.isMissed && !task.isCompleted;
  
  // Get course color
  const courseCode = task.courseName?.split(" ")[0] || "";
  const colors = courseColors?.[courseCode];
  
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
      } ${isMissed && !cardBgClass ? "border-destructive bg-destructive/5" : ""} ${
        task.isCompleted ? "opacity-60" : ""
      } ${overdueBlink ? "animate-urgent-blink" : ""} ${urgentBlink ? "animate-shimmer" : ""}`}
      style={{
        ...(overdueBlink && blinkSyncDelay ? { animationDelay: blinkSyncDelay } : {}),
        backgroundColor: cardBgClass ? undefined : (colors?.bg || undefined),
        borderColor: colors?.border || '#9ca3af'
      }}
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
              <p 
                className={`font-normal ${compact ? "text-[8px]" : "text-[10px]"}`}
                style={{ color: colors?.text || undefined }}
              >
                {compact ? (task.courseName.split(" - ")[1] || task.courseName) : task.courseName.split(" - ")[0]}
              </p>
            )}
          </div>
        </div>
        {!compact && (
          <Badge 
            className={colors ? "" : typeColors[task.type]}
            style={colors ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text } : undefined}
          >
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
            <Badge 
              className={`${colors ? "" : typeColors[task.type]} text-[8px] px-1.5 py-0.5`}
              style={colors ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text } : undefined}
            >
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
  profileData: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null; postalCode: string };
  timezones: { value: string; label: string }[];
  onSave: (data: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null; postalCode: string }) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(profileData.firstName);
  const [lastName, setLastName] = useState(profileData.lastName);
  const [birthdate, setBirthdate] = useState(profileData.birthdate);
  const [timezone, setTimezone] = useState(profileData.timezone);
  const [travelTimezone, setTravelTimezone] = useState<string | null>(profileData.travelTimezone);
  const [isTraveling, setIsTraveling] = useState(!!profileData.travelTimezone);
  const [postalCode, setPostalCode] = useState(profileData.postalCode || '');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ firstName, lastName, birthdate, timezone, travelTimezone: isTraveling ? travelTimezone : null, postalCode });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-[10px]">
      <div className="space-y-2">
        <Label htmlFor="firstName" className="text-[10px]">First Name</Label>
        <Input 
          id="firstName" 
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter your first name"
          className="!text-black !text-[10px] h-8"
          style={{ fontSize: '10px' }}
          data-testid="input-profile-firstname"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName" className="text-[10px]">Last Name</Label>
        <Input 
          id="lastName" 
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter your last name"
          className="!text-black !text-[10px] h-8"
          style={{ fontSize: '10px' }}
          data-testid="input-profile-lastname"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="birthdate" className="text-[10px]">Birthdate</Label>
        <Input 
          id="birthdate" 
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className="!text-black !text-[10px] h-8"
          style={{ fontSize: '10px' }}
          data-testid="input-profile-birthdate"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="postalCode" className="text-[10px]">Postal Code / Zip Code</Label>
        <Input 
          id="postalCode" 
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
          placeholder="e.g. M5V 2T6 or 90210"
          className="!text-black !text-[10px] h-8"
          style={{ fontSize: '10px' }}
          data-testid="input-profile-postalcode"
        />
        <p className="text-[9px] text-muted-foreground">Used to track your home location.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone" className="text-[10px]">Home Time Zone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-profile-timezone">
            <SelectValue placeholder="Select time zone" />
          </SelectTrigger>
          <SelectContent className="bg-white !text-[10px]">
            {timezones.map(tz => (
              <SelectItem key={tz.value} value={tz.value} className="text-black !text-[10px]">{tz.label}</SelectItem>
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
            className="h-3 w-3"
            data-testid="checkbox-traveling"
          />
          <Label htmlFor="traveling" className="text-[10px] font-medium cursor-pointer">I'm traveling</Label>
        </div>
        {isTraveling && (
          <div className="space-y-2">
            <Label htmlFor="travelTimezone" className="text-[10px]">Where are you travelling to?</Label>
            <p className="text-[9px] text-muted-foreground">Clock shows travel time. Tasks stay aligned with your home timezone.</p>
            <Select value={travelTimezone || timezone} onValueChange={setTravelTimezone}>
              <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-travel-timezone">
                <SelectValue placeholder="Pick a city" />
              </SelectTrigger>
              <SelectContent className="bg-white !text-[10px] max-h-[200px]">
                {TRAVEL_CITIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-black !text-[10px]">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button 
          type="submit" 
          variant="outline"
          className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-8 px-6" 
          style={{
            boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
            fontSize: '12px'
          }}
          data-testid="button-save-profile"
        >
          Save Profile
        </Button>
      </div>
    </form>
  );
}

const TRAVEL_CITIES = [
  { label: 'Abu Dhabi', value: 'Asia/Dubai' },
  { label: 'Accra', value: 'Africa/Accra' },
  { label: 'Adelaide', value: 'Australia/Adelaide' },
  { label: 'Amsterdam', value: 'Europe/Amsterdam' },
  { label: 'Anchorage', value: 'America/Anchorage' },
  { label: 'Athens', value: 'Europe/Athens' },
  { label: 'Atlanta', value: 'America/New_York' },
  { label: 'Auckland', value: 'Pacific/Auckland' },
  { label: 'Baghdad', value: 'Asia/Baghdad' },
  { label: 'Bangkok', value: 'Asia/Bangkok' },
  { label: 'Barcelona', value: 'Europe/Madrid' },
  { label: 'Beijing', value: 'Asia/Shanghai' },
  { label: 'Beirut', value: 'Asia/Beirut' },
  { label: 'Berlin', value: 'Europe/Berlin' },
  { label: 'Bogota', value: 'America/Bogota' },
  { label: 'Boston', value: 'America/New_York' },
  { label: 'Brisbane', value: 'Australia/Brisbane' },
  { label: 'Brussels', value: 'Europe/Brussels' },
  { label: 'Budapest', value: 'Europe/Budapest' },
  { label: 'Buenos Aires', value: 'America/Argentina/Buenos_Aires' },
  { label: 'Cairo', value: 'Africa/Cairo' },
  { label: 'Calgary', value: 'America/Edmonton' },
  { label: 'Cape Town', value: 'Africa/Johannesburg' },
  { label: 'Casablanca', value: 'Africa/Casablanca' },
  { label: 'Chicago', value: 'America/Chicago' },
  { label: 'Copenhagen', value: 'Europe/Copenhagen' },
  { label: 'Dallas', value: 'America/Chicago' },
  { label: 'Delhi', value: 'Asia/Kolkata' },
  { label: 'Denver', value: 'America/Denver' },
  { label: 'Doha', value: 'Asia/Qatar' },
  { label: 'Dubai', value: 'Asia/Dubai' },
  { label: 'Dublin', value: 'Europe/Dublin' },
  { label: 'Edmonton', value: 'America/Edmonton' },
  { label: 'Frankfurt', value: 'Europe/Berlin' },
  { label: 'Halifax', value: 'America/Halifax' },
  { label: 'Hanoi', value: 'Asia/Ho_Chi_Minh' },
  { label: 'Helsinki', value: 'Europe/Helsinki' },
  { label: 'Ho Chi Minh City', value: 'Asia/Ho_Chi_Minh' },
  { label: 'Hong Kong', value: 'Asia/Hong_Kong' },
  { label: 'Honolulu', value: 'Pacific/Honolulu' },
  { label: 'Houston', value: 'America/Chicago' },
  { label: 'Istanbul', value: 'Europe/Istanbul' },
  { label: 'Jakarta', value: 'Asia/Jakarta' },
  { label: 'Johannesburg', value: 'Africa/Johannesburg' },
  { label: 'Kuala Lumpur', value: 'Asia/Kuala_Lumpur' },
  { label: 'Lagos', value: 'Africa/Lagos' },
  { label: 'Las Vegas', value: 'America/Los_Angeles' },
  { label: 'Lima', value: 'America/Lima' },
  { label: 'Lisbon', value: 'Europe/Lisbon' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Los Angeles', value: 'America/Los_Angeles' },
  { label: 'Madrid', value: 'Europe/Madrid' },
  { label: 'Manila', value: 'Asia/Manila' },
  { label: 'Melbourne', value: 'Australia/Melbourne' },
  { label: 'Mexico City', value: 'America/Mexico_City' },
  { label: 'Miami', value: 'America/New_York' },
  { label: 'Milan', value: 'Europe/Rome' },
  { label: 'Montreal', value: 'America/Toronto' },
  { label: 'Moscow', value: 'Europe/Moscow' },
  { label: 'Mumbai', value: 'Asia/Kolkata' },
  { label: 'Munich', value: 'Europe/Berlin' },
  { label: 'Nairobi', value: 'Africa/Nairobi' },
  { label: 'Nashville', value: 'America/Chicago' },
  { label: 'New York', value: 'America/New_York' },
  { label: 'Osaka', value: 'Asia/Tokyo' },
  { label: 'Oslo', value: 'Europe/Oslo' },
  { label: 'Ottawa', value: 'America/Toronto' },
  { label: 'Paris', value: 'Europe/Paris' },
  { label: 'Perth', value: 'Australia/Perth' },
  { label: 'Philadelphia', value: 'America/New_York' },
  { label: 'Phoenix', value: 'America/Phoenix' },
  { label: 'Prague', value: 'Europe/Prague' },
  { label: 'Quebec City', value: 'America/Toronto' },
  { label: 'Regina', value: 'America/Regina' },
  { label: 'Reykjavik', value: 'Atlantic/Reykjavik' },
  { label: 'Rio de Janeiro', value: 'America/Sao_Paulo' },
  { label: 'Rome', value: 'Europe/Rome' },
  { label: 'San Francisco', value: 'America/Los_Angeles' },
  { label: 'Santiago', value: 'America/Santiago' },
  { label: 'Sao Paulo', value: 'America/Sao_Paulo' },
  { label: 'Seattle', value: 'America/Los_Angeles' },
  { label: 'Seoul', value: 'Asia/Seoul' },
  { label: 'Shanghai', value: 'Asia/Shanghai' },
  { label: 'Singapore', value: 'Asia/Singapore' },
  { label: 'St. John\'s', value: 'America/St_Johns' },
  { label: 'Stockholm', value: 'Europe/Stockholm' },
  { label: 'Sydney', value: 'Australia/Sydney' },
  { label: 'Taipei', value: 'Asia/Taipei' },
  { label: 'Tel Aviv', value: 'Asia/Jerusalem' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Toronto', value: 'America/Toronto' },
  { label: 'Vancouver', value: 'America/Vancouver' },
  { label: 'Vienna', value: 'Europe/Vienna' },
  { label: 'Warsaw', value: 'Europe/Warsaw' },
  { label: 'Washington D.C.', value: 'America/New_York' },
  { label: 'Winnipeg', value: 'America/Winnipeg' },
  { label: 'Zurich', value: 'Europe/Zurich' },
];

const NORTH_AMERICAN_SCHOOLS = [
  'Boston University',
  'Brock University',
  'Carleton University',
  'Columbia University',
  'Concordia University',
  'Cornell University',
  'Dalhousie University',
  'Duke University',
  'Georgetown University',
  'Harvard University',
  'Johns Hopkins University',
  'Lakehead University',
  'Laurentian University',
  'McGill University',
  'McMaster University',
  'Memorial University',
  'MIT',
  'Nipissing University',
  'Northeastern University',
  'Northwestern University',
  'NYU',
  'Ontario Tech University',
  'Princeton University',
  'Queen\'s University',
  'Simon Fraser University',
  'Stanford University',
  'Toronto Metropolitan University',
  'Trent University',
  'UC Berkeley',
  'UCLA',
  'Universit\u00e9 de Montr\u00e9al',
  'Universit\u00e9 Laval',
  'University of Alberta',
  'University of British Columbia',
  'University of Calgary',
  'University of Chicago',
  'University of Guelph',
  'University of Manitoba',
  'University of Michigan',
  'University of New Brunswick',
  'University of Ottawa',
  'University of Pennsylvania',
  'University of Saskatchewan',
  'University of Southern California',
  'University of Toronto',
  'University of Victoria',
  'University of Waterloo',
  'University of Windsor',
  'Western University',
  'Wilfrid Laurier University',
  'Yale University',
  'York University',
  'Other',
];

function SchoolForm({ 
  schoolData, 
  semesterSettings,
  onSave,
  onCancel 
}: { 
  schoolData: { schoolLogo: string | null; schoolName: string; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string; timezone: string; isTravelling?: boolean; travelTimezone?: string };
  semesterSettings: SemesterSettings | null | undefined;
  onSave: (data: { schoolLogo: string | null; schoolName: string; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string; timezone: string; isTravelling?: boolean; travelTimezone?: string; semesterType?: string }) => void;
  onCancel: () => void;
}) {
  const [schoolName, setSchoolName] = useState(schoolData.schoolName || 'Toronto Metropolitan University');
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [numberOfWeeks, setNumberOfWeeks] = useState(schoolData.numberOfWeeks);
  const [week1StartDate, setWeek1StartDate] = useState(schoolData.week1StartDate);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(schoolData.firstDayOfWeek);
  const [timezone, setTimezone] = useState(schoolData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto');
  const [isTravelling, setIsTravelling] = useState(schoolData.isTravelling || false);
  const [travelTimezone, setTravelTimezone] = useState(schoolData.travelTimezone || '');
  const [semesterType, setSemesterType] = useState(semesterSettings?.semesterType || 'winter');
  
  const daysOfWeek = [
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
  ];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSchoolName = schoolName === 'Other' ? customSchoolName : schoolName;
    onSave({ schoolLogo: schoolData.schoolLogo, schoolName: finalSchoolName, numberOfWeeks, week1StartDate, firstDayOfWeek, timezone, isTravelling, travelTimezone: isTravelling ? travelTimezone : undefined, semesterType });
  };

  const semesterEnd = week1StartDate 
    ? format(addWeeks(new Date(week1StartDate), numberOfWeeks), 'MMMM d, yyyy')
    : 'Not set';
  
  return (
    <form id="school-settings-form" onSubmit={handleSubmit} className="space-y-4 text-[10px]">
      <div className="border rounded-lg p-3 space-y-3">
        <Label className="text-[10px] font-medium">School</Label>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="schoolName" className="text-[10px]">School Name</Label>
            <Select value={NORTH_AMERICAN_SCHOOLS.includes(schoolName) ? schoolName : 'Other'} onValueChange={(v) => { setSchoolName(v); if (v !== 'Other') setCustomSchoolName(''); }}>
              <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-school-name">
                <SelectValue placeholder="Select school" />
              </SelectTrigger>
              <SelectContent className="bg-white [&_*]:!text-black !text-[10px] max-h-[200px]">
                {NORTH_AMERICAN_SCHOOLS.map(s => (
                  <SelectItem key={s} value={s} className="!text-black !text-[10px]">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(schoolName === 'Other' || !NORTH_AMERICAN_SCHOOLS.includes(schoolName)) && (
              <Input
                value={customSchoolName || (NORTH_AMERICAN_SCHOOLS.includes(schoolName) ? '' : schoolName)}
                onChange={(e) => { setCustomSchoolName(e.target.value); setSchoolName('Other'); }}
                placeholder="Enter your school name"
                className="!text-black !text-[10px] h-8 mt-1"
                style={{ fontSize: '10px' }}
                data-testid="input-custom-school-name"
              />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="firstDayOfWeek" className="text-[10px]">First Day of School Week</Label>
            <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
              <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-first-day-of-week">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent className="bg-white [&_*]:!text-black !text-[10px]">
                {daysOfWeek.map(day => (
                  <SelectItem key={day.value} value={day.value} className="!text-black !text-[10px]">{day.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-[9px] text-muted-foreground pt-1">
            Semester ends: {semesterEnd}
          </div>
        </div>
      </div>
      
      {semesterSettings && (
        <div className="border rounded-lg p-3 space-y-3">
          <Label className="text-[10px] font-medium">Semester Settings</Label>
          <div className="space-y-2 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Semester</span>
              <span className="font-medium">{semesterSettings.semesterName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="week1StartDate" className="text-[10px] text-white/70">Week 1, Day 1 Date</Label>
                <Input 
                  id="week1StartDate"
                  type="date"
                  value={week1StartDate}
                  onChange={(e) => setWeek1StartDate(e.target.value)}
                  className="!text-black !text-[10px] h-8"
                  style={{ fontSize: '10px' }}
                  data-testid="input-week1-start-date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="semesterType" className="text-[10px] text-white/70">Semester Type</Label>
                <Select value={semesterType} onValueChange={setSemesterType}>
                  <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-semester-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white [&_*]:!text-black !text-[10px]">
                    <SelectItem value="fall" className="!text-black !text-[10px]">Fall</SelectItem>
                    <SelectItem value="winter" className="!text-black !text-[10px]">Winter</SelectItem>
                    <SelectItem value="spring_summer" className="!text-black !text-[10px]">Spring/Summer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="numberOfWeeks" className="text-[10px] text-white/70">Number of School Weeks</Label>
                <Select value={String(numberOfWeeks)} onValueChange={(v) => setNumberOfWeeks(Number(v))}>
                  <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8 w-24 px-2" style={{ color: 'black', fontSize: '10px' }} data-testid="select-number-of-weeks">
                    <SelectValue placeholder="Select weeks" />
                  </SelectTrigger>
                  <SelectContent className="bg-white [&_*]:!text-black !text-[10px] min-w-0 w-24">
                    {[10, 11, 12, 13, 14, 15, 16].map(w => (
                      <SelectItem key={w} value={String(w)} className="!text-black !text-[10px] py-1">{w} weeks</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="timezone" className="text-[10px] text-white/70">Time Zone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="bg-white [&_*]:!text-black !text-[10px] max-h-[200px]">
                    {[
                      { value: 'America/Toronto', label: 'Eastern (Toronto)' },
                      { value: 'America/New_York', label: 'Eastern (New York)' },
                      { value: 'America/Chicago', label: 'Central (Chicago)' },
                      { value: 'America/Denver', label: 'Mountain (Denver)' },
                      { value: 'America/Los_Angeles', label: 'Pacific (LA)' },
                      { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
                      { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
                      { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
                      { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
                      { value: 'America/St_Johns', label: 'Newfoundland (St. John\'s)' },
                      { value: 'America/Regina', label: 'Central - No DST (Regina)' },
                      { value: 'Pacific/Honolulu', label: 'Hawaii' },
                      { value: 'America/Anchorage', label: 'Alaska' },
                      { value: 'Europe/London', label: 'GMT (London)' },
                      { value: 'Europe/Paris', label: 'CET (Paris)' },
                      { value: 'Europe/Berlin', label: 'CET (Berlin)' },
                      { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
                      { value: 'Asia/Shanghai', label: 'CST (Shanghai)' },
                      { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
                      { value: 'UTC', label: 'UTC' },
                    ].map(tz => (
                      <SelectItem key={tz.value} value={tz.value} className="!text-black !text-[10px]">{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="isTravelling"
                  checked={isTravelling}
                  onCheckedChange={(checked) => setIsTravelling(!!checked)}
                  className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  data-testid="checkbox-travelling"
                />
                <Label htmlFor="isTravelling" className="text-[10px] text-white/70 cursor-pointer flex items-center gap-1">
                  <Plane className="h-3 w-3" />
                  I'm travelling
                </Label>
              </div>
              {isTravelling && (
                <div className="space-y-1 ml-5">
                  <Label htmlFor="travelTimezone" className="text-[10px] text-white/70">Where are you travelling to?</Label>
                  <Select value={travelTimezone} onValueChange={setTravelTimezone}>
                    <SelectTrigger className="!text-black [&_*]:!text-black [&_span]:!text-[10px] bg-white !text-[10px] h-8" style={{ color: 'black', fontSize: '10px' }} data-testid="select-travel-timezone">
                      <SelectValue placeholder="Pick a city" />
                    </SelectTrigger>
                    <SelectContent className="bg-white [&_*]:!text-black !text-[10px] max-h-[200px]">
                      {TRAVEL_CITIES.map(c => (
                        <SelectItem key={c.value} value={c.value} className="!text-black !text-[10px]">{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[8px] text-orange-300/70">Due times will show in both your school and travel time zones.</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-[8px] text-white/40 mt-1">Course details shown in the Courses section.</p>
        </div>
      )}
      
    </form>
  );
}

function CoursesForm({ 
  coursesData, 
  semesterSettings,
  onSave,
  onSaveSemesterSchedule,
  onGenerateClassTasks,
  isGenerating,
  onCancel 
}: { 
  coursesData: { courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> };
  semesterSettings: SemesterSettings | null | undefined;
  onSave: (data: { courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> }) => void;
  onSaveSemesterSchedule: (data: Record<string, any>) => void;
  onGenerateClassTasks: () => void;
  isGenerating?: boolean;
  onCancel: () => void;
}) {
  const [courses, setCourses] = useState(coursesData.courses);
  const [isNewCourseOpen, setIsNewCourseOpen] = useState(false);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);

  const handleSaveNewCourse = (courseData: {
    courseCode: string;
    courseName: string;
    professorName: string;
    professorEmail: string;
    color: string;
    semesterType: string;
    deliveryMode: string;
    classDay: string;
    classDay2: string;
    classTime: string;
    classEndTime: string;
    startDate: string;
    endDate: string;
    springSummerTerm: string;
    deadlines: Array<{ title: string; type: string; dueDate: string; description: string }>;
    reminders: number[];
  }) => {
    const fullName = `${courseData.courseCode} - ${courseData.courseName}`;
    const updatedCourses = [...courses];
    
    if (editingCourseIndex !== null) {
      updatedCourses[editingCourseIndex] = {
        name: fullName,
        color: courseData.color,
        professor: courseData.professorName,
        professorEmail: courseData.professorEmail,
      };
    } else {
      const emptyIdx = updatedCourses.findIndex(c => !c.name.trim());
      if (emptyIdx !== -1) {
        updatedCourses[emptyIdx] = {
          name: fullName,
          color: courseData.color,
          professor: courseData.professorName,
          professorEmail: courseData.professorEmail,
        };
      } else {
        updatedCourses.push({
          name: fullName,
          color: courseData.color,
          professor: courseData.professorName,
          professorEmail: courseData.professorEmail,
        });
      }
    }
    
    setCourses(updatedCourses);
    onSave({ courses: updatedCourses });

    const courseIndex = editingCourseIndex !== null ? editingCourseIndex : updatedCourses.findIndex(c => c.name === fullName);
    const prefix = `course${courseIndex + 1}` as const;
    
    if (courseIndex >= 0 && courseIndex < 3) {
      const schedulePayload: Record<string, any> = {
        semesterType: courseData.semesterType,
        [`${prefix}DeliveryMode`]: courseData.deliveryMode || null,
        [`${prefix}ClassDay`]: courseData.classDay || null,
        [`${prefix}ClassDay2`]: courseData.classDay2 || null,
        [`${prefix}ClassTime`]: courseData.classTime || null,
        [`${prefix}ClassEndTime`]: courseData.classEndTime || null,
        [`${prefix}SpringSummerTerm`]: courseData.springSummerTerm || null,
        [`${prefix}StartDate`]: courseData.startDate ? new Date(courseData.startDate).toISOString() : null,
        [`${prefix}EndDate`]: courseData.endDate ? new Date(courseData.endDate).toISOString() : null,
      };
      onSaveSemesterSchedule(schedulePayload);
    }

    if (courseData.reminders && courseData.reminders.length > 0) {
      const courseReminders = JSON.parse(localStorage.getItem('courseReminders') || '{}');
      courseReminders[fullName] = courseData.reminders;
      localStorage.setItem('courseReminders', JSON.stringify(courseReminders));
    }

    setIsNewCourseOpen(false);
    setEditingCourseIndex(null);

    if (courseData.deadlines.length > 0) {
      (async () => {
        let created = 0;
        for (const deadline of courseData.deadlines) {
          if (deadline.title && deadline.dueDate) {
            try {
              const dueDate = new Date(deadline.dueDate);
              dueDate.setHours(23, 59, 0, 0);
              await apiRequest("POST", "/api/tasks", {
                title: deadline.title,
                description: deadline.description || '',
                type: deadline.type || 'assignment',
                courseName: fullName,
                dueDate: dueDate.toISOString(),
                priority: deadline.type === 'exam' || deadline.type === 'quiz' ? 'high' : 'medium',
                weekNumber: getWeekNumber(dueDate),
                reminder1: DEFAULT_REMINDER_1,
                reminder2: DEFAULT_REMINDER_2,
              });
              created++;
            } catch (err) {
              console.error("Failed to create deadline task:", err);
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      })();
    }
  };

  const handleEditCourse = (index: number) => {
    setEditingCourseIndex(index);
    setIsNewCourseOpen(true);
  };

  const handleDeleteCourse = (index: number) => {
    const updatedCourses = [...courses];
    updatedCourses[index] = { name: '', color: '#6b7280', professor: '', professorEmail: '' };
    setCourses(updatedCourses);
    onSave({ courses: updatedCourses });
  };

  const activeCoursesWithIndex = courses
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => course.name.trim());

  const canAddMore = activeCoursesWithIndex.length < 3;

  return (
    <div className="space-y-3 text-[10px]">
      {activeCoursesWithIndex.length === 0 ? (
        <p className="text-[10px] text-white/50 text-center py-4">No courses added yet. Click the button below to add your first course.</p>
      ) : (
        <div className="space-y-2">
          {activeCoursesWithIndex.map(({ course, index: realIndex }) => {
            const prefix = `course${realIndex + 1}`;
            const deliveryMode = (semesterSettings as any)?.[`${prefix}DeliveryMode`] || '';
            const classDay = (semesterSettings as any)?.[`${prefix}ClassDay`] || '';
            const classDay2 = (semesterSettings as any)?.[`${prefix}ClassDay2`] || '';
            const classTime = (semesterSettings as any)?.[`${prefix}ClassTime`] || '';
            const classEndTime = (semesterSettings as any)?.[`${prefix}ClassEndTime`] || '';
            const dayNames: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

            return (
              <div key={realIndex} className="border border-white/20 rounded p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <div className="w-3 h-3 rounded-full cursor-pointer" style={{ backgroundColor: course.color }} onClick={() => document.getElementById(`course-color-${realIndex}`)?.click()} />
                    <input
                      id={`course-color-${realIndex}`}
                      type="color"
                      value={course.color}
                      onChange={(e) => {
                        const updatedCourses = [...courses];
                        updatedCourses[realIndex] = { ...updatedCourses[realIndex], color: e.target.value };
                        setCourses(updatedCourses);
                        onSave({ courses: updatedCourses });
                      }}
                      className="absolute inset-0 w-0 h-0 opacity-0"
                      data-testid={`input-course-color-${realIndex}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium truncate">{course.name.split(' - ')[0]}</span>
                      <span className="text-[9px] text-white/50 truncate">{course.name.split(' - ').slice(1).join(' - ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditCourse(realIndex)}
                      className="p-1 text-white/40 transition-colors"
                      data-testid={`button-edit-course-${realIndex}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(realIndex)}
                      className="p-1 text-white/40 transition-colors"
                      data-testid={`button-delete-course-${realIndex}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-white/50 pl-5">
                  {course.professor && (
                    <span className="flex items-center gap-1">
                      <User className="h-2.5 w-2.5" />
                      {course.professor}
                    </span>
                  )}
                  {(course as any).professorEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" />
                      {(course as any).professorEmail}
                    </span>
                  )}
                  {deliveryMode && (
                    <span className="flex items-center gap-1">
                      {deliveryMode === 'virtual' ? <Radio className="h-2.5 w-2.5" /> : <Cloud className="h-2.5 w-2.5" />}
                      {deliveryMode === 'virtual' ? 'Virtual' : 'Online'}
                    </span>
                  )}
                  {classDay && deliveryMode === 'virtual' && (
                    <span>
                      {dayNames[classDay] || classDay}{classDay2 ? `/${dayNames[classDay2] || classDay2}` : ''} {classTime && classEndTime ? `${classTime}-${classEndTime}` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => { setEditingCourseIndex(null); setIsNewCourseOpen(true); }}
          disabled={!canAddMore}
          className="border !border-green-400/50 text-green-300 transition-all duration-200"
          style={{ fontSize: '11px' }}
          data-testid="button-new-course"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {canAddMore ? 'New Course' : 'Max 3 Courses'}
        </Button>
        <div className="flex items-center gap-2">
          {activeCoursesWithIndex.some(({ index }) => {
            return (semesterSettings as any)?.[`course${index + 1}DeliveryMode`] === 'virtual';
          }) && (
            <Button
              type="button"
              variant="outline"
              onClick={onGenerateClassTasks}
              disabled={isGenerating}
              className="border !border-blue-400/50 text-blue-300 transition-all duration-200"
              style={{ fontSize: '11px' }}
              data-testid="button-generate-class-tasks"
            >
              {isGenerating ? 'Generating...' : 'Generate Class Tasks'}
            </Button>
          )}
        </div>
      </div>

      {isNewCourseOpen && (
        <NewCourseDialog
          existingCourse={editingCourseIndex !== null ? {
            courseCode: courses[editingCourseIndex]?.name?.split(' - ')[0] || '',
            courseName: courses[editingCourseIndex]?.name?.split(' - ').slice(1).join(' - ') || '',
            professorName: courses[editingCourseIndex]?.professor || '',
            professorEmail: (courses[editingCourseIndex] as any)?.professorEmail || '',
            color: courses[editingCourseIndex]?.color || '#6b7280',
            semesterType: semesterSettings?.semesterType || 'winter',
            deliveryMode: (semesterSettings as any)?.[`course${editingCourseIndex + 1}DeliveryMode`] || '',
            classDay: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassDay`] || '',
            classDay2: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassDay2`] || '',
            classTime: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassTime`] || '',
            classEndTime: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassEndTime`] || '',
            startDate: (semesterSettings as any)?.[`course${editingCourseIndex + 1}StartDate`] ? new Date((semesterSettings as any)[`course${editingCourseIndex + 1}StartDate`]).toISOString().split('T')[0] : '',
            endDate: (semesterSettings as any)?.[`course${editingCourseIndex + 1}EndDate`] ? new Date((semesterSettings as any)[`course${editingCourseIndex + 1}EndDate`]).toISOString().split('T')[0] : '',
            springSummerTerm: (semesterSettings as any)?.[`course${editingCourseIndex + 1}SpringSummerTerm`] || 'full',
          } : undefined}
          onSave={handleSaveNewCourse}
          onClose={() => { setIsNewCourseOpen(false); setEditingCourseIndex(null); }}
        />
      )}
    </div>
  );
}

type NewCourseDialogProps = {
  existingCourse?: {
    courseCode: string;
    courseName: string;
    professorName: string;
    professorEmail: string;
    color: string;
    semesterType: string;
    deliveryMode: string;
    classDay: string;
    classDay2: string;
    classTime: string;
    classEndTime: string;
    startDate: string;
    endDate: string;
    springSummerTerm: string;
  };
  onSave: (data: {
    courseCode: string;
    courseName: string;
    professorName: string;
    professorEmail: string;
    color: string;
    semesterType: string;
    deliveryMode: string;
    classDay: string;
    classDay2: string;
    classTime: string;
    classEndTime: string;
    startDate: string;
    endDate: string;
    springSummerTerm: string;
    deadlines: Array<{ title: string; type: string; dueDate: string; description: string }>;
    reminders: number[];
  }) => void;
  onClose: () => void;
};

function NewCourseDialogInner({ existingCourse, onSave, onClose }: NewCourseDialogProps) {
  const [courseCode, setCourseCode] = useState(existingCourse?.courseCode || '');
  const [courseName, setCourseName] = useState(existingCourse?.courseName || '');
  const [professorName, setProfessorName] = useState(existingCourse?.professorName || '');
  const [professorEmail, setProfessorEmail] = useState(existingCourse?.professorEmail || '');
  const [color, setColor] = useState(existingCourse?.color || '#6366F1');
  const [semesterType, setSemesterType] = useState(existingCourse?.semesterType || 'winter');
  const [deliveryMode, setDeliveryMode] = useState(existingCourse?.deliveryMode || '');
  const [classDay, setClassDay] = useState(existingCourse?.classDay || '');
  const [classDay2, setClassDay2] = useState(existingCourse?.classDay2 || '');
  const [classTime, setClassTime] = useState(existingCourse?.classTime || '');
  const [classEndTime, setClassEndTime] = useState(existingCourse?.classEndTime || '');
  const [startDate, setStartDate] = useState(existingCourse?.startDate || '');
  const [endDate, setEndDate] = useState(existingCourse?.endDate || '');
  const [springSummerTerm, setSpringSummerTerm] = useState(existingCourse?.springSummerTerm || 'full');
  const [reminder1, setReminder1] = useState(15);
  const [reminder2, setReminder2] = useState(60);
  const [reminder3, setReminder3] = useState(0);
  const [deadlines, setDeadlines] = useState<Array<{ title: string; type: string; dueDate: string; description: string }>>([]);

  const addDeadline = () => {
    setDeadlines(prev => [...prev, { title: '', type: 'assignment', dueDate: '', description: '' }]);
  };

  const updateDeadline = (index: number, field: string, value: string) => {
    setDeadlines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeDeadline = (index: number) => {
    setDeadlines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) return;
    onSave({
      courseCode: courseCode.trim(),
      courseName: courseName.trim(),
      professorName: professorName.trim(),
      professorEmail: professorEmail.trim(),
      color,
      semesterType,
      deliveryMode,
      classDay,
      classDay2,
      classTime,
      classEndTime,
      startDate,
      endDate,
      springSummerTerm,
      deadlines: deadlines.filter(d => d.title.trim() && d.dueDate),
      reminders: [15, ...(reminder2 > 0 ? [reminder2] : []), ...(reminder3 > 0 ? [reminder3] : [])],
    });
  };

  const dayOptions = [
    { value: '', label: 'None' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  const deadlineTypes = [
    { value: 'assignment', label: 'Assignment' },
    { value: 'exam', label: 'Exam' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'essay', label: 'Essay' },
    { value: 'project', label: 'Project' },
    { value: 'discussion', label: 'Discussion' },
    { value: 'reading', label: 'Reading' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5 text-white" />
          <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            {existingCourse ? 'EDIT COURSE' : 'NEW COURSE'}
          </h2>
        </div>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-white hover:text-white/80 transition-colors p-1" data-testid="button-close-new-course">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Course Number</Label>
              <Input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. CSOC103"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                required
                data-testid="input-new-course-code"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Course Name</Label>
              <Input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. How Society Works"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                required
                data-testid="input-new-course-name"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Color</Label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-white/20 p-0"
                data-testid="input-new-course-color"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Professor Name</Label>
              <Input
                value={professorName}
                onChange={(e) => setProfessorName(e.target.value)}
                placeholder="e.g. Dr. Smith"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                data-testid="input-new-professor-name"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Professor Email</Label>
              <Input
                value={professorEmail}
                onChange={(e) => setProfessorEmail(e.target.value)}
                placeholder="e.g. prof@university.ca"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                data-testid="input-new-professor-email"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <Label className="text-[10px] font-medium mb-2 block">Semester & Schedule</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Semester</Label>
                <select
                  value={semesterType}
                  onChange={(e) => setSemesterType(e.target.value)}
                  className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
                  data-testid="select-new-course-semester"
                >
                  <option value="fall" className="bg-gray-800">Fall</option>
                  <option value="winter" className="bg-gray-800">Winter</option>
                  <option value="spring_summer" className="bg-gray-800">Spring/Summer</option>
                </select>
              </div>
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Delivery Mode</Label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value)}
                  className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
                  data-testid="select-new-course-delivery"
                >
                  <option value="" className="bg-gray-800">Select...</option>
                  <option value="virtual" className="bg-gray-800">Virtual (live class)</option>
                  <option value="online" className="bg-gray-800">Online (async)</option>
                </select>
              </div>
            </div>

            {semesterType === 'spring_summer' && (
              <div className="mt-2">
                <Label className="text-[9px] text-white/60 mb-1 block">Spring/Summer Term</Label>
                <select
                  value={springSummerTerm}
                  onChange={(e) => setSpringSummerTerm(e.target.value)}
                  className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
                  data-testid="select-new-course-term"
                >
                  <option value="full" className="bg-gray-800">Full Length (May-Aug)</option>
                  <option value="first_half" className="bg-gray-800">First Half (May-Jun)</option>
                  <option value="second_half" className="bg-gray-800">Second Half (Jun-Aug)</option>
                </select>
              </div>
            )}

            {deliveryMode === 'virtual' && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">Day 1</Label>
                  <select
                    value={classDay}
                    onChange={(e) => setClassDay(e.target.value)}
                    className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
                    data-testid="select-new-course-day1"
                  >
                    {dayOptions.map(d => (
                      <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">Day 2</Label>
                  <select
                    value={classDay2}
                    onChange={(e) => setClassDay2(e.target.value)}
                    className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
                    data-testid="select-new-course-day2"
                  >
                    {dayOptions.map(d => (
                      <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">Start Time</Label>
                  <Input
                    type="time"
                    value={classTime}
                    onChange={(e) => setClassTime(e.target.value)}
                    className="h-8 !text-[10px] !text-black"
                    data-testid="input-new-course-start-time"
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">End Time</Label>
                  <Input
                    type="time"
                    value={classEndTime}
                    onChange={(e) => setClassEndTime(e.target.value)}
                    className="h-8 !text-[10px] !text-black"
                    data-testid="input-new-course-end-time"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Course Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 !text-[10px] !text-black"
                  data-testid="input-new-course-start-date"
                />
              </div>
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Course End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 !text-[10px] !text-black"
                  data-testid="input-new-course-end-date"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] font-medium flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-400" />
                Class Reminders
              </Label>
            </div>
            <p className="text-[9px] text-white/40 mb-2">Popup reminders before class starts. 15-minute reminder is always active.</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[10px] text-white/80 flex-1">15 minutes before</span>
                <span className="text-[9px] text-amber-400/80 italic">Always on</span>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full shrink-0 ${reminder2 > 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
                <span className="text-[10px] text-white/80 flex-1">Reminder 2</span>
                <select
                  value={reminder2}
                  onChange={(e) => setReminder2(Number(e.target.value))}
                  className="h-6 rounded bg-white/10 border border-white/20 text-white text-[10px] px-1.5"
                  data-testid="select-reminder-2"
                >
                  <option value={0} className="bg-gray-800">Off</option>
                  <option value={5} className="bg-gray-800">5 min before</option>
                  <option value={10} className="bg-gray-800">10 min before</option>
                  <option value={30} className="bg-gray-800">30 min before</option>
                  <option value={45} className="bg-gray-800">45 min before</option>
                  <option value={60} className="bg-gray-800">1 hour before</option>
                  <option value={90} className="bg-gray-800">1.5 hours before</option>
                  <option value={120} className="bg-gray-800">2 hours before</option>
                  <option value={180} className="bg-gray-800">3 hours before</option>
                  <option value={1440} className="bg-gray-800">1 day before</option>
                </select>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full shrink-0 ${reminder3 > 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
                <span className="text-[10px] text-white/80 flex-1">Reminder 3</span>
                <select
                  value={reminder3}
                  onChange={(e) => setReminder3(Number(e.target.value))}
                  className="h-6 rounded bg-white/10 border border-white/20 text-white text-[10px] px-1.5"
                  data-testid="select-reminder-3"
                >
                  <option value={0} className="bg-gray-800">Off</option>
                  <option value={5} className="bg-gray-800">5 min before</option>
                  <option value={10} className="bg-gray-800">10 min before</option>
                  <option value={30} className="bg-gray-800">30 min before</option>
                  <option value={45} className="bg-gray-800">45 min before</option>
                  <option value={60} className="bg-gray-800">1 hour before</option>
                  <option value={90} className="bg-gray-800">1.5 hours before</option>
                  <option value={120} className="bg-gray-800">2 hours before</option>
                  <option value={180} className="bg-gray-800">3 hours before</option>
                  <option value={1440} className="bg-gray-800">1 day before</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] font-medium">Known Deadlines</Label>
              <button
                type="button"
                onClick={addDeadline}
                className="flex items-center gap-1 text-[9px] text-blue-300 transition-colors"
                data-testid="button-add-deadline"
              >
                <Plus className="h-3 w-3" />
                Add Deadline
              </button>
            </div>
            <p className="text-[9px] text-white/40 mb-2">Add tests, exams, assignments, and other deadlines you already know about.</p>

            {deadlines.length === 0 ? (
              <div className="text-center py-3 border border-dashed border-white/15 rounded">
                <p className="text-[9px] text-white/30">No deadlines added yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {deadlines.map((deadline, idx) => (
                  <div key={idx} className="border border-white/15 rounded p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-[1fr_auto_auto] gap-2">
                        <Input
                          value={deadline.title}
                          onChange={(e) => updateDeadline(idx, 'title', e.target.value)}
                          placeholder="Deadline title (e.g. Midterm Exam)"
                          className="h-7 !text-[10px] !text-black"
                          style={{ fontSize: '10px' }}
                          data-testid={`input-deadline-title-${idx}`}
                        />
                        <select
                          value={deadline.type}
                          onChange={(e) => updateDeadline(idx, 'type', e.target.value)}
                          className="h-7 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2 w-28"
                          data-testid={`select-deadline-type-${idx}`}
                        >
                          {deadlineTypes.map(t => (
                            <option key={t.value} value={t.value} className="bg-gray-800">{t.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeDeadline(idx)}
                          className="p-1 text-white/40 transition-colors"
                          data-testid={`button-remove-deadline-${idx}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <Input
                        type="date"
                        value={deadline.dueDate}
                        onChange={(e) => updateDeadline(idx, 'dueDate', e.target.value)}
                        className="h-7 !text-[10px] !text-black"
                        data-testid={`input-deadline-date-${idx}`}
                      />
                      <Input
                        value={deadline.description}
                        onChange={(e) => updateDeadline(idx, 'description', e.target.value)}
                        placeholder="Notes (optional)"
                        className="h-7 !text-[10px] !text-black"
                        style={{ fontSize: '10px' }}
                        data-testid={`input-deadline-description-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              className="border !border-white/30 text-white/60 transition-all duration-200"
              style={{ fontSize: '11px' }}
              data-testid="button-cancel-new-course"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              className="border !border-white/50 text-white transition-all duration-200"
              style={{
                boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                fontSize: '11px'
              }}
              data-testid="button-save-new-course"
            >
              {existingCourse ? 'Update Course' : 'Save Course'}
            </Button>
          </div>
        </form>
    </>
  );
}

function NewCourseDialog(props: NewCourseDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="bg-gradient-to-br from-gray-800 via-[#111] to-gray-900 border border-white/20 rounded-lg w-[520px] max-h-[85vh] overflow-hidden flex flex-col text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <NewCourseDialogInner {...props} />
      </div>
    </div>,
    document.body
  );
}

function TaskForm({ 
  task, 
  weekNumber,
  initialDate,
  initialType,
  initialStartTime,
  initialEndTime,
  hideSubmitButton,
  onSuccess 
}: { 
  task?: Task; 
  weekNumber: number;
  initialDate?: Date | null;
  initialType?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  hideSubmitButton?: boolean;
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
  
  // Pending subtasks for new task creation
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);
  const [newPendingSubtask, setNewPendingSubtask] = useState("");
  
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
      // Create the task and return the response to get the new task ID
      const response = await apiRequest("POST", "/api/tasks", payload);
      const newTask = await response.json();
      
      // If there are pending subtasks, create them for the new task
      if (pendingSubtasks.length > 0 && newTask?.id) {
        for (const subtaskTitle of pendingSubtasks) {
          await apiRequest("POST", `/api/tasks/${newTask.id}/subtasks`, { title: subtaskTitle });
        }
      }
      
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      setPendingSubtasks([]); // Clear pending subtasks after successful creation
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-task-form>
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
              className="bg-white h-8 font-normal"
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
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 font-normal ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 font-normal ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                        className="w-16 h-8 rounded-md border border-input bg-white px-2 font-normal"
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
                        className="w-16 h-8 rounded-md border border-input bg-white px-2 font-normal"
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
                  className="bg-white h-8 flex-1 font-normal"
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
                  className="h-8 rounded-md border border-input bg-white px-1 font-normal"
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
                  className="bg-white h-8 flex-1 font-normal"
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
                  className="h-8 rounded-md border border-input bg-white px-1 font-normal"
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
                className="bg-white h-8 font-normal"
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

      {/* Subtasks Section for NEW tasks - Pending subtasks */}
      {!task && (
        <div className="border border-white/20 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Subtasks (optional)</Label>
            <span className="text-[10px] text-white/60">{pendingSubtasks.length} subtask{pendingSubtasks.length !== 1 ? 's' : ''}</span>
          </div>
          
          {pendingSubtasks.length > 0 && (
            <div className="space-y-1">
              {pendingSubtasks.map((subtask, index) => (
                <div key={index} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
                  <div className="w-3 h-3 rounded-full border border-white/40" />
                  <span className="flex-1 text-xs">{subtask}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 hover:bg-red-500/20"
                    onClick={() => setPendingSubtasks(prev => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Add a subtask..."
              value={newPendingSubtask}
              onChange={(e) => setNewPendingSubtask(e.target.value)}
              className="flex-1 h-8 text-xs bg-black/20 border-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newPendingSubtask.trim()) {
                    setPendingSubtasks(prev => [...prev, newPendingSubtask.trim()]);
                    setNewPendingSubtask("");
                  }
                }
              }}
              data-testid="input-new-subtask"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/20 hover:bg-white/10"
              onClick={() => {
                if (newPendingSubtask.trim()) {
                  setPendingSubtasks(prev => [...prev, newPendingSubtask.trim()]);
                  setNewPendingSubtask("");
                }
              }}
              data-testid="button-add-subtask"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Subtasks Section - Only show when editing existing task */}
      {task && (
        <SubtasksSection taskId={task.id} />
      )}

      {!hideSubmitButton && (
        <div className="flex gap-2 pt-4">
          <Button 
            type="submit" 
            variant="outline"
            disabled={createMutation.isPending} 
            className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200" 
            style={{ 
              fontSize: '11px',
              boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)'
            }} 
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)';
            }}
            data-testid="button-submit-task"
          >
            {createMutation.isPending ? "Saving..." : task ? "Update Task" : "Add Task"}
          </Button>
        </div>
      )}
    </form>
  );
}

// Subtasks Section Component
function SubtasksSection({ taskId }: { taskId: number }) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch subtasks for this task - use array queryKey for proper cache invalidation
  const { data: subtasks = [], isLoading, isError } = useQuery<Subtask[]>({
    queryKey: [`/api/tasks/${taskId}/subtasks`],
  });

  // Create subtask mutation using apiRequest
  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", `/api/tasks/${taskId}/subtasks`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/subtasks`] });
      setNewSubtaskTitle("");
      setShowAddForm(false);
    },
  });

  // Toggle subtask completion using apiRequest
  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/subtasks/${id}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/subtasks`] });
    },
  });

  // Delete subtask mutation using apiRequest
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/subtasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/subtasks`] });
    },
  });

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      createSubtaskMutation.mutate(newSubtaskTitle.trim());
    }
  };

  const completedCount = subtasks.filter(s => s.isCompleted).length;
  const totalCount = subtasks.length;

  return (
    <div className="border-t border-white/20 pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-white/70" />
          <Label className="text-[11px] text-white">Subtasks</Label>
          {totalCount > 0 && (
            <span className="text-[10px] text-white/50">
              ({completedCount}/{totalCount} done)
            </span>
          )}
        </div>
        {!showAddForm && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowAddForm(true)}
            className="h-6 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-add-subtask"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-[10px] text-white/50">Loading subtasks...</div>
      ) : isError ? (
        <div className="text-[10px] text-red-400">Failed to load subtasks</div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 group p-1 rounded hover:bg-white/5"
              data-testid={`subtask-item-${subtask.id}`}
            >
              <button
                type="button"
                onClick={() => toggleSubtaskMutation.mutate({ 
                  id: subtask.id, 
                  isCompleted: !subtask.isCompleted 
                })}
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  subtask.isCompleted 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-white/40 hover:border-white/60'
                }`}
                data-testid={`button-toggle-subtask-${subtask.id}`}
              >
                {subtask.isCompleted && <Check className="h-3 w-3 text-white" />}
              </button>
              <span 
                className={`flex-1 text-[11px] ${
                  subtask.isCompleted ? 'text-white/40 line-through' : 'text-white/90'
                }`}
              >
                {subtask.title}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                data-testid={`button-delete-subtask-${subtask.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {subtasks.length === 0 && !showAddForm && (
            <div className="text-[10px] text-white/40 py-2">
              No subtasks yet. Click "Add" to create one.
            </div>
          )}
        </div>
      )}

      {/* Add subtask form */}
      {showAddForm && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Subtask title..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubtask();
              } else if (e.key === "Escape") {
                setShowAddForm(false);
                setNewSubtaskTitle("");
              }
            }}
            autoFocus
            className="flex h-7 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 text-white placeholder:text-white/40"
            style={{ fontSize: '11px' }}
            data-testid="input-new-subtask"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddSubtask}
            disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
            className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-500 text-white"
            data-testid="button-save-subtask"
          >
            {createSubtaskMutation.isPending ? "..." : "Add"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowAddForm(false);
              setNewSubtaskTitle("");
            }}
            className="h-7 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-cancel-subtask"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
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
