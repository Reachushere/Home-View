import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  BookOpen,
  Video,
  Globe,
  Mail,
  User,
  Clock,
  Calendar,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  FileText,
  MessageSquare,
  ClipboardCheck,
  AlertCircle,
  Pencil,
  Check,
  Upload,
  Loader2,
  Paperclip,
  X,
  GripVertical,
  FolderPlus,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Flag,
  ClipboardList,
} from "lucide-react";
import zoomLogoPath from "@assets/Zoom2_1773776262533.png";
import wifiLogoPath from "@assets/Wifi_1773656687145.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { TASK_TYPES, getWeekNumber, getWeekDates, FIRST_WEEK, LAST_WEEK, REMINDER_OPTIONS, REPEAT_TYPES, REPEAT_INTERVAL_UNITS } from "@shared/schema";
import type { Task, CourseWeekMapping } from "@shared/schema";

const TASK_TYPE_OPTIONS = [
  { value: "reading", label: "Reading", icon: BookOpen },
  { value: "essay", label: "Essay", icon: FileText },
  { value: "exam", label: "Exam", icon: AlertCircle },
  { value: "quiz", label: "Quiz", icon: ClipboardCheck },
  { value: "discussion", label: "Discussion Post", icon: MessageSquare },
  { value: "poll", label: "Review Poll", icon: ClipboardCheck },
  { value: "project", label: "Project", icon: FileText },
  { value: "module", label: "Module", icon: BookOpen },
  { value: "class", label: "Class", icon: Video },
  { value: "other", label: "Other", icon: FileText },
];

const REMINDER_PRESETS = [
  { value: 0, label: "None" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

interface CourseInfo {
  courseCode: string;
  courseName: string;
  fullName: string;
  professor: string;
  professorEmail: string;
  color: string;
  colorEnd?: string;
  colorStops?: string;
  borderColor?: string;
  courseRowColor?: string;
  taskBgColor?: string;
  deliveryMode: string;
  classDay: string;
  classDay2?: string;
  classTime: string;
  classEndTime?: string;
  classTime2?: string;
  classEndTime2?: string;
  zoomLink?: string;
  courseType: string;
  startDate?: string;
  endDate?: string;
  semesterTerm?: string;
  year?: string;
}

interface CourseDetailDialogProps {
  courseInfo: CourseInfo;
  onClose: () => void;
  onSaveCourseInfo?: (updates: { professor?: string; professorEmail?: string; deliveryMode?: string; classDay?: string; classDay2?: string; classTime?: string; classEndTime?: string; classTime2?: string; classEndTime2?: string; zoomLink?: string; semesterTerm?: string; year?: string; startDate?: string; endDate?: string; color?: string; colorEnd?: string; colorStops?: string; borderColor?: string; courseRowColor?: string; taskBgColor?: string; semesterKey?: string; courseRank?: number }) => void;
  onLiveColorChange?: (updates: { color?: string; colorEnd?: string; colorStops?: string; borderColor?: string; courseRowColor?: string; taskBgColor?: string }) => void;
  onGradeCalculated?: (grade: string, percent: string) => void;
  onDeleteCourse?: () => void;
  onOpenEditTask?: (task: Task) => void;
  semesterStart: Date;
  readingWeekStart: Date | null;
  certificateName?: string;
  onPushUndo?: (action: { type: string; description: string; data: any }) => void;
  initialEditMode?: boolean;
  courseRank?: number;
  usedRanks?: number[];
}

interface NewTaskForm {
  title: string;
  type: string;
  dueDate: string;
  dueTime: string;
  description: string;
  reminder1: number;
  reminder2: number;
  reminder3: number;
  reminder4: number;
  gradeWeight: string;
  gradeTotal: string;
  gradeValue: string;
}

function DebouncedGradeInput({ value, onSave, placeholder, testId, disabled }: { value: number | null | undefined; onSave: (val: number | null) => void; placeholder: string; testId: string; disabled?: boolean }) {
  const fmt = (v: number | null | undefined) => v != null ? v.toFixed(2) : '';
  const [local, setLocal] = useState(fmt(value));
  const [editing, setEditing] = useState(false);
  const lastAcceptedRef = useRef(value);

  useEffect(() => {
    if (!editing && value !== lastAcceptedRef.current) {
      lastAcceptedRef.current = value;
      setLocal(fmt(value));
    }
  }, [value, editing]);

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*\.?[0-9]*"
      className="w-[33px] h-[23px] text-[9px] text-center bg-transparent border border-amber-400/60 rounded text-white placeholder:text-amber-400/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:border-white/20 disabled:text-white/30 disabled:placeholder:text-white/20 disabled:cursor-not-allowed"
      placeholder={placeholder}
      value={local}
      disabled={disabled}
      onFocus={() => setEditing(true)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = local !== '' ? parseFloat(String(local)) : null;
        const finalVal = parsed !== null && !isNaN(parsed) ? Math.round(parsed * 100) / 100 : null;
        const current = value ?? null;
        const changed = finalVal === null ? current !== null : Math.abs((finalVal) - (current || 0)) > 0.001;
        if (changed) {
          lastAcceptedRef.current = finalVal;
          setLocal(fmt(finalVal));
          onSave(finalVal);
        }
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      data-testid={testId}
    />
  );
}

function createEmptyTaskForm(): NewTaskForm {
  return {
    title: "",
    type: "reading",
    dueDate: "",
    dueTime: "18:00",
    description: "",
    reminder1: 30,
    reminder2: 120,
    reminder3: 0,
    reminder4: 0,
    gradeWeight: "",
    gradeTotal: "",
    gradeValue: "",
  };
}

function percentToLetterGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 85) return 'A';
  if (pct >= 80) return 'A-';
  if (pct >= 77) return 'B+';
  if (pct >= 73) return 'B';
  if (pct >= 70) return 'B-';
  if (pct >= 67) return 'C+';
  if (pct >= 63) return 'C';
  if (pct >= 60) return 'C-';
  if (pct >= 50) return 'D';
  return 'F';
}

const SEMESTER_OPTIONS: { key: string; label: string; term: string; year: string; start: string; end: string }[] = [
  { key: 'ss2025', label: 'Spring/Summer 2025', term: 'spring_summer_full', year: '2025', start: '2025-05-05', end: '2025-08-08' },
  { key: 'f2025', label: 'Fall 2025', term: 'fall', year: '2025', start: '2025-09-08', end: '2025-12-07' },
  { key: 'w2026', label: 'Winter 2026', term: 'winter', year: '2026', start: '2026-01-13', end: '2026-04-17' },
  { key: 'ss2026', label: 'Spring/Summer 2026', term: 'spring_summer_full', year: '2026', start: '2026-05-04', end: '2026-08-07' },
  { key: 'f2026', label: 'Fall 2026', term: 'fall', year: '2026', start: '2026-09-14', end: '2026-12-07' },
  { key: 'w2027', label: 'Winter 2027', term: 'winter', year: '2027', start: '2027-01-11', end: '2027-04-16' },
  { key: 'ss2027', label: 'Spring/Summer 2027', term: 'spring_summer_full', year: '2027', start: '2027-05-03', end: '2027-08-06' },
  { key: 'f2027', label: 'Fall 2027', term: 'fall', year: '2027', start: '2027-09-13', end: '2027-12-06' },
  { key: 'w2028', label: 'Winter 2028', term: 'winter', year: '2028', start: '2028-01-10', end: '2028-04-14' },
  { key: 'ss2028', label: 'Spring/Summer 2028', term: 'spring_summer_full', year: '2028', start: '2028-05-01', end: '2028-08-04' },
  { key: 'f2028', label: 'Fall 2028', term: 'fall', year: '2028', start: '2028-09-11', end: '2028-12-04' },
  { key: 'w2029', label: 'Winter 2029', term: 'winter', year: '2029', start: '2029-01-08', end: '2029-04-13' },
];

function semesterKeyFromTermYear(term?: string, year?: string): string {
  if (!term || !year) return '';
  if (term.startsWith('spring_summer')) return `ss${year}`;
  if (term === 'fall') return `f${year}`;
  if (term === 'winter') return `w${year}`;
  return '';
}

export function CourseDetailDialog({ courseInfo, onClose, onSaveCourseInfo, onLiveColorChange, onGradeCalculated, onDeleteCourse, onOpenEditTask, semesterStart, readingWeekStart, certificateName, onPushUndo, initialEditMode, courseRank, usedRanks }: CourseDetailDialogProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskForm>(createEmptyTaskForm());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [editTaskFields, setEditTaskFields] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ type: string; id: string; label: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [dialogPos, setDialogPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dialogDragRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    if (!commentTarget) return;
    setCommentLoading(true);
    fetch(`/api/entity-comments/${commentTarget.type}/${commentTarget.id}`)
      .then(r => r.json())
      .then(data => { setCommentText(Array.isArray(data) && data.length > 0 ? data[0].content : ''); })
      .catch(() => setCommentText(''))
      .finally(() => setCommentLoading(false));
  }, [commentTarget?.type, commentTarget?.id]);

  const saveComment = useCallback(() => {
    if (!commentTarget) return;
    setCommentSaving(true);
    fetch(`/api/entity-comments/${commentTarget.type}/${commentTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText }),
    })
      .then(() => toast({ title: 'Comment saved' }))
      .catch(() => toast({ title: 'Failed to save', variant: 'destructive' }))
      .finally(() => setCommentSaving(false));
  }, [commentTarget, commentText, toast]);
  const [isEditingInfo, setIsEditingInfo] = useState(!!initialEditMode);
  const [activeGradientStop, setActiveGradientStop] = useState<'start' | 'end' | number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isParsingSyllabus, setIsParsingSyllabus] = useState(false);
  const [syllabusData, setSyllabusData] = useState<any>(null);
  const [syllabusItemStates, setSyllabusItemStates] = useState<Record<number, { accepted: boolean | null; editing: boolean; edits: any }>>({});
  const [syllabusObjectPath, setSyllabusObjectPath] = useState<string>('');

  useEffect(() => {
    fetch('/api/syllabus/paths')
      .then(r => r.json())
      .then(paths => {
        if (paths[courseInfo.courseCode]) {
          setSyllabusObjectPath(paths[courseInfo.courseCode]);
        } else {
          try {
            const saved = localStorage.getItem('courseSyllabusPaths');
            const local = saved ? JSON.parse(saved) : {};
            if (local[courseInfo.courseCode]) {
              setSyllabusObjectPath(local[courseInfo.courseCode]);
              fetch('/api/syllabus/paths', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseCode: courseInfo.courseCode, objectPath: local[courseInfo.courseCode] }),
              }).catch(() => {});
            }
          } catch {}
        }
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem('courseSyllabusPaths');
          const local = saved ? JSON.parse(saved) : {};
          if (local[courseInfo.courseCode]) setSyllabusObjectPath(local[courseInfo.courseCode]);
        } catch {}
      });
  }, [courseInfo.courseCode]);
  const [showWeekMappings, setShowWeekMappings] = useState(false);
  const [showAssignments, setShowAssignments] = useState(!initialEditMode);
  const weekMappingsRef = useRef<HTMLDivElement>(null);
  const assignmentsRef = useRef<HTMLDivElement>(null);
  const [weekMappingEdits, setWeekMappingEdits] = useState<Record<number, { confirmed: boolean; courseWeekLabel: string; notes: string }>>({});
  const [weekStyleChoice, setWeekStyleChoice] = useState<string | null>(null);
  const [showWeekCalendar, setShowWeekCalendar] = useState(false);
  const [weekCalendarMonth, setWeekCalendarMonth] = useState(() => {
    const s = semesterStart ? new Date(semesterStart) : new Date();
    return new Date(s.getFullYear(), s.getMonth(), 1);
  });
  const [courseWeek1Start, setCourseWeek1Start] = useState<Date | null>(null);
  const [courseWeekLength, setCourseWeekLength] = useState(7);
  const [readingWeekVariable, setReadingWeekVariable] = useState(false);
  const [readingWeekExclusions, setReadingWeekExclusions] = useState<Set<number>>(new Set());
  const [showReadingWeekCalendar, setShowReadingWeekCalendar] = useState(false);
  const [readingWeekCalMonth, setReadingWeekCalMonth] = useState(new Date());
  const [selectedReadingWeekStart, setSelectedReadingWeekStart] = useState<Date | null>(null);
  const [weekUploadingState, setWeekUploadingState] = useState<Record<string, boolean>>({});
  const [courseWeekCalendarOpen, setCourseWeekCalendarOpen] = useState<number | null>(null);
  const [courseWeekCalMonth, setCourseWeekCalMonth] = useState(new Date());

  const handleWeekFileUpload = useCallback(async (weekNum: number, uploadType: 'module' | 'reading') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.ppt,.pptx,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const stateKey = `${weekNum}-${uploadType}`;
      setWeekUploadingState(prev => ({ ...prev, [stateKey]: true }));
      try {
        const weekDates = getWeekDates(weekNum, semesterStart, readingWeekStart);
        const ws = new Date(weekDates.start);
        const we = new Date(weekDates.end);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const startStr = `${months[ws.getMonth()]} ${ws.getDate()}`;
        const endStr = ws.getMonth() === we.getMonth() ? `${we.getDate()}` : `${months[we.getMonth()]} ${we.getDate()}`;
        const dateRange = `${startStr}-${endStr}`;

        const codeClean = courseInfo.courseCode.replace(/\s/g, '');
        const namePart = courseInfo.fullName || courseInfo.courseName || '';

        const semYear = semesterStart ? new Date(semesterStart).getFullYear().toString() : '';
        const semMonth = semesterStart ? new Date(semesterStart).getMonth() : 0;
        const semTypeHeader = semMonth >= 8 ? 'fall' : semMonth >= 4 ? 'spring_summer' : 'winter';

        const resp = await fetch('/api/course-week-upload', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/pdf',
            'x-course-code': codeClean,
            'x-course-name': namePart,
            'x-week-num': String(weekNum),
            'x-upload-type': uploadType,
            'x-week-date-range': dateRange,
            'x-file-name': file.name,
            'x-semester-year': semYear,
            'x-semester-type': semTypeHeader,
          },
          body: file,
        });
        const result = await resp.json();
        if (resp.ok && result.success) {
          toast({ title: `${uploadType === 'module' ? 'Module' : 'Reading'} uploaded`, description: `${file.name} saved to OneDrive and queued for TTS preparation` });
        } else {
          toast({ title: 'Upload failed', description: result.error || 'Unknown error', variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Upload error', description: err.message, variant: 'destructive' });
      } finally {
        setWeekUploadingState(prev => ({ ...prev, [stateKey]: false }));
      }
    };
    input.click();
  }, [courseInfo.courseCode, courseInfo.courseName, courseInfo.fullName, semesterStart, readingWeekStart, toast]);
  const { uploadFile, isUploading } = useUpload();
  const [editInfo, setEditInfo] = useState({
    professor: courseInfo.professor || '',
    professorEmail: courseInfo.professorEmail || '',
    deliveryMode: courseInfo.deliveryMode || '',
    classDay: courseInfo.classDay || '',
    classDay2: courseInfo.classDay2 || '',
    classTime: courseInfo.classTime || '',
    classEndTime: courseInfo.classEndTime || '',
    classTime2: courseInfo.classTime2 || '',
    classEndTime2: courseInfo.classEndTime2 || '',
    zoomLink: courseInfo.zoomLink || '',
    semesterTerm: courseInfo.semesterTerm || '',
    year: courseInfo.year || '',
    startDate: courseInfo.startDate || '',
    endDate: courseInfo.endDate || '',
    color: courseInfo.color || '#3b82f6',
    colorEnd: courseInfo.colorEnd || courseInfo.color || '#3b82f6',
    colorStops: courseInfo.colorStops || '',
    borderColor: courseInfo.borderColor || '',
    courseRowColor: courseInfo.courseRowColor || '',
    taskBgColor: courseInfo.taskBgColor || '',
    courseRank: courseRank ?? 0,
  });

  useEffect(() => {
    if (onLiveColorChange && isEditingInfo) {
      onLiveColorChange({
        color: editInfo.color,
        colorEnd: editInfo.colorEnd,
        colorStops: editInfo.colorStops,
        borderColor: editInfo.borderColor,
        courseRowColor: editInfo.courseRowColor,
        taskBgColor: editInfo.taskBgColor,
      });
    }
  }, [editInfo.color, editInfo.colorEnd, editInfo.colorStops, editInfo.borderColor, editInfo.courseRowColor, editInfo.taskBgColor]);

  const CERTIFICATE_TYPE_OPTIONS = [
    { group: 'Certificate 1', options: [
      'C1 - Mandatory Required Professional',
      'C1 - Selected Required Professional',
      'C1 - Liberal Studies Elective - Lower Level Table A',
      'C1 - Professionally Related (Open) Elective Table 1',
    ]},
    { group: 'Certificate 2', options: [
      'C2 - Mandatory Required Professional',
      'C2 - Selected Required Professional',
      'C2 - Liberal Studies Elective - Lower Level Table A',
      'C2 - Professionally Related Elective - Upper Level Table B',
      'C2 - Open Elective',
    ]},
    { group: 'Certificate 3', options: [
      'C3 - Required Group 1',
      'C3 - Required Group 2',
      'C3 - Liberal Studies Elective Lower Level Table A',
      'C3 - Liberal Studies Elective Upper Level Table B',
      'C3 - Open Elective',
    ]},
  ];
  const [certificateType, setCertificateType] = useState(() => {
    try {
      const saved = localStorage.getItem('courseCertificateTypes');
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed[courseInfo.courseCode] || '';
    } catch { return ''; }
  });
  const updateCertificateType = (val: string) => {
    setCertificateType(val);
    try {
      const saved = localStorage.getItem('courseCertificateTypes');
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[courseInfo.courseCode] = val;
      localStorage.setItem('courseCertificateTypes', JSON.stringify(parsed));
    } catch {}
  };

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const courseTasks = useMemo(() => {
    const codeUpper = courseInfo.courseCode.toUpperCase().replace(/\s/g, '');
    const codeNoC = codeUpper.replace(/^C(?=[A-Z]{2,})/, '');
    return allTasks
      .filter((t) => {
        if (t.type === 'class' || t.type === 'module') return false;
        if (!t.courseName) return false;
        const tCode = t.courseName.split(' - ')[0]?.trim().toUpperCase().replace(/\s/g, '');
        return tCode === codeUpper || tCode === 'C' + codeUpper || tCode === codeNoC;
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [allTasks, courseInfo.courseCode]);

  const { data: weekMappingsData } = useQuery<CourseWeekMapping[]>({
    queryKey: ['/api/course-week-mappings', courseInfo.courseCode],
    queryFn: () => fetch(`/api/course-week-mappings/${courseInfo.courseCode}`).then(r => r.json()),
  });

  useEffect(() => {
    if (weekMappingsData && weekMappingsData.length > 0) {
      const edits: Record<number, { confirmed: boolean; courseWeekLabel: string; notes: string }> = {};
      for (const m of weekMappingsData) {
        edits[m.weekNumber] = { confirmed: m.confirmed ?? false, courseWeekLabel: m.courseWeekLabel || '', notes: m.notes || '' };
      }
      setWeekMappingEdits(prev => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(edits)) {
          if (!(Number(k) in merged)) merged[Number(k)] = v;
        }
        return merged;
      });
    }
  }, [weekMappingsData]);

  const saveWeekMapping = useCallback(async (weekNumber: number, data: { confirmed: boolean; courseWeekLabel: string; notes: string }) => {
    try {
      await fetch('/api/course-week-mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseCode: courseInfo.courseCode, weekNumber, ...data }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/course-week-mappings', courseInfo.courseCode] });
    } catch {}
  }, [courseInfo.courseCode]);

  const confirmAllWeeks = useCallback(async () => {
    const mappings = [];
    for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
      const existing = weekMappingEdits[w];
      mappings.push({ weekNumber: w, confirmed: true, courseWeekLabel: existing?.courseWeekLabel || '', notes: existing?.notes || '' });
    }
    try {
      await fetch('/api/course-week-mappings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseCode: courseInfo.courseCode, mappings }),
      });
      const edits: Record<number, { confirmed: boolean; courseWeekLabel: string; notes: string }> = {};
      for (const m of mappings) edits[m.weekNumber] = { confirmed: true, courseWeekLabel: m.courseWeekLabel, notes: m.notes };
      setWeekMappingEdits(edits);
      queryClient.invalidateQueries({ queryKey: ['/api/course-week-mappings', courseInfo.courseCode] });
      toast({ title: 'All weeks confirmed' });
    } catch {}
  }, [courseInfo.courseCode, weekMappingEdits, toast]);

  type SortField = 'manual' | 'title' | 'dueDate' | 'score' | 'total' | 'weight' | 'percent';
  const [sortField, setSortField] = useState<SortField>('manual');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField('manual'); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    const pushCompleted = (list: typeof courseTasks) => {
      const incomplete = list.filter(t => !t.isCompleted);
      const completed = list.filter(t => t.isCompleted);
      return [...incomplete, ...completed];
    };
    if (sortField === 'manual') return pushCompleted(courseTasks);
    const sorted = [...courseTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
        case 'dueDate': cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
        case 'score': cmp = (a.gradeValue || 0) - (b.gradeValue || 0); break;
        case 'total': cmp = (a.gradeTotal || 0) - (b.gradeTotal || 0); break;
        case 'weight': cmp = (a.gradeWeight || 0) - (b.gradeWeight || 0); break;
        case 'percent': {
          const pA = a.gradeValue != null && a.gradeTotal ? (a.gradeValue / a.gradeTotal) : -1;
          const pB = b.gradeValue != null && b.gradeTotal ? (b.gradeValue / b.gradeTotal) : -1;
          cmp = pA - pB;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return pushCompleted(sorted);
  }, [courseTasks, sortField, sortDir]);

  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [assignToGroup, setAssignToGroup] = useState<number | null>(null);

  const groups = useMemo(() => {
    const g = new Set<string>();
    courseTasks.forEach(t => { if (t.assignmentGroup) g.add(t.assignmentGroup); });
    return Array.from(g).sort();
  }, [courseTasks]);

  const ungroupedTasks = useMemo(() => sortedTasks.filter(t => !t.assignmentGroup), [sortedTasks]);

  const groupedTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    groups.forEach(g => { map[g] = sortedTasks.filter(t => t.assignmentGroup === g); });
    return map;
  }, [sortedTasks, groups]);

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: number; sortOrder: number; assignmentGroup?: string | null }[]) => {
      await apiRequest('POST', '/api/tasks/reorder', { updates });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/tasks'] }); },
  });

  const handleDragStart = (taskId: number) => { setDragId(taskId); };
  const handleDragOver = (e: React.DragEvent, taskId: number) => { e.preventDefault(); setDragOverId(taskId); };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };

  const handleDrop = (e: React.DragEvent, targetId: number, targetGroup?: string | null) => {
    e.preventDefault();
    if (dragId === null || dragId === targetId) { handleDragEnd(); return; }
    const taskList = targetGroup ? (groupedTasks[targetGroup] || []) : ungroupedTasks;
    const allList = [...taskList];
    const dragIdx = allList.findIndex(t => t.id === dragId);
    const targetIdx = allList.findIndex(t => t.id === targetId);
    if (dragIdx < 0) {
      const dragTask = courseTasks.find(t => t.id === dragId);
      if (dragTask) allList.splice(targetIdx, 0, dragTask);
    } else {
      const [moved] = allList.splice(dragIdx, 1);
      allList.splice(targetIdx, 0, moved);
    }
    const updates = allList.map((t, i) => ({ id: t.id, sortOrder: i, assignmentGroup: targetGroup ?? null }));
    reorderMutation.mutate(updates);
    handleDragEnd();
  };

  const handleDropOnGroup = (e: React.DragEvent, groupName: string) => {
    e.preventDefault();
    if (dragId === null) return;
    const existing = groupedTasks[groupName] || [];
    const updates = [{ id: dragId, sortOrder: existing.length, assignmentGroup: groupName }];
    reorderMutation.mutate(updates);
    handleDragEnd();
  };

  const [pendingGroups, setPendingGroups] = useState<string[]>([]);
  const allGroups = useMemo(() => {
    const merged = new Set([...groups, ...pendingGroups]);
    return Array.from(merged).sort();
  }, [groups, pendingGroups]);

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    setPendingGroups(prev => [...prev, newGroupName.trim()]);
    setNewGroupName('');
    setShowGroupInput(false);
  };

  const assignTaskToGroup = (taskId: number, groupName: string | null) => {
    const updates = [{ id: taskId, sortOrder: 0, assignmentGroup: groupName }];
    reorderMutation.mutate(updates);
    setAssignToGroup(null);
  };

  const toggleGroupCollapse = (g: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  };

  const completedCount = courseTasks.filter((t) => t.isCompleted).length;
  const totalWeight = courseTasks.reduce((s, t) => s + (t.gradeWeight || 0), 0);

  const gradeCalc = useMemo(() => {
    const gradedTasks = courseTasks.filter(t => !t.excludeFromGpa && t.gradeTotal && t.gradeValue !== null && t.gradeValue !== undefined && (t.gradeValue !== 0 || t.isCompleted));
    if (gradedTasks.length === 0) return null;
    const sumScore = gradedTasks.reduce((s, t) => s + (t.gradeValue || 0), 0);
    const sumTotal = gradedTasks.reduce((s, t) => s + (t.gradeTotal || 0), 0);
    const gradedWeight = gradedTasks.reduce((s, t) => s + (t.gradeWeight || 0), 0);
    const currentPercent = sumTotal > 0 ? (sumScore / sumTotal) * 100 : 0;
    return {
      currentPercent: Math.round(currentPercent * 100) / 100,
      currentGrade: percentToLetterGrade(currentPercent),
      gradedWeight,
      gradedCount: gradedTasks.length,
    };
  }, [courseTasks, totalWeight]);

  const onGradeCalculatedRef = useRef(onGradeCalculated);
  onGradeCalculatedRef.current = onGradeCalculated;

  useEffect(() => {
    if (onGradeCalculatedRef.current) {
      if (gradeCalc) {
        onGradeCalculatedRef.current(gradeCalc.currentGrade, String(gradeCalc.currentPercent));
      } else {
        onGradeCalculatedRef.current('', '');
      }
    }
  }, [gradeCalc?.currentPercent, gradeCalc?.currentGrade]);

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Record<string, any>) => {
      return apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setNewTask(createEmptyTaskForm());
      setShowAddForm(false);
      toast({ title: "Assignment added", description: "Task created and added to your calendar." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, isCompleted, _task }: { id: number; isCompleted: boolean; _task?: any }) => {
      if (onPushUndo && _task) {
        onPushUndo({
          type: isCompleted ? 'complete' : 'uncomplete',
          description: `${isCompleted ? 'Completed' : 'Uncompleted'} "${_task.title}"`,
          data: { taskId: id, taskTitle: _task.title }
        });
      }
      const patch: Record<string, any> = { isCompleted };
      if (isCompleted) patch.excludeFromGpa = false;
      return apiRequest("PATCH", `/api/tasks/${id}`, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async ({ id, _task }: { id: number; _task?: any }) => {
      if (onPushUndo && _task) {
        onPushUndo({
          type: 'delete',
          description: `Deleted "${_task.title}"`,
          data: { taskId: _task.id, taskTitle: _task.title, title: _task.title, description: _task.description, type: _task.type, courseName: _task.courseName, dueDate: _task.dueDate, startDate: _task.startDate, weekNumber: _task.weekNumber, isCompleted: _task.isCompleted, eventStartTime: _task.eventStartTime, eventEndTime: _task.eventEndTime, priority: _task.priority, gradeWeight: _task.gradeWeight, gradeTotal: _task.gradeTotal, gradeValue: _task.gradeValue }
        });
      }
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Deleted", description: "Assignment removed." });
    },
  });

  const updateGradeValueMutation = useMutation({
    mutationFn: async ({ id, gradeValue, _task }: { id: number; gradeValue: number | null; _task?: any }) => {
      if (onPushUndo && _task) {
        onPushUndo({
          type: 'edit',
          description: `Changed grade for "${_task.title}"`,
          data: { taskId: id, taskTitle: _task.title, oldFields: { gradeValue: _task.gradeValue }, newFields: { gradeValue } }
        });
      }
      return apiRequest("PATCH", `/api/tasks/${id}`, { gradeValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data, _task }: { id: number; data: Record<string, any>; _task?: any }) => {
      if (onPushUndo && _task) {
        const oldFields: Record<string, any> = {};
        const newFields: Record<string, any> = {};
        for (const key of Object.keys(data)) {
          const oldVal = (_task as any)[key];
          if (String(oldVal ?? '') !== String(data[key] ?? '')) {
            oldFields[key] = oldVal;
            newFields[key] = data[key];
          }
        }
        if (Object.keys(oldFields).length > 0) {
          onPushUndo({
            type: 'edit',
            description: `Updated "${_task.title}"`,
            data: { taskId: id, taskTitle: _task.title, oldFields, newFields }
          });
        }
      }
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ id, flagged }: { id: number; flagged: boolean }) => {
      return apiRequest("PATCH", `/api/tasks/${id}/flag`, { flagged });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const handleUploadAssignment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }

    setIsParsingPdf(true);
    toast({ title: "Uploading...", description: `Uploading ${file.name}` });

    try {
      const uploadResult = await uploadFile(file);
      if (!uploadResult) throw new Error("Upload failed");

      toast({ title: "Analyzing...", description: "AI is reading the assignment document..." });

      const parseResp = await fetch("/api/tasks/parse-assignment-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath: uploadResult.objectPath,
          courseName: courseInfo.fullName,
          fileName: file.name,
        }),
      });

      if (!parseResp.ok) {
        const err = await parseResp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to parse assignment");
      }

      const parsed = await parseResp.json();

      const existingTask = courseTasks.find(t =>
        t.title.toLowerCase().includes(parsed.title?.toLowerCase()?.split(' - ')[0]?.trim() || '___') ||
        parsed.title?.toLowerCase()?.includes(t.title.toLowerCase().split(' - ')[0]?.trim() || '___')
      );

      if (existingTask) {
        await apiRequest("PATCH", `/api/tasks/${existingTask.id}`, {
          title: parsed.title || existingTask.title,
          description: parsed.description || existingTask.description,
          type: parsed.type || existingTask.type,
          gradeWeight: parsed.gradeWeight || existingTask.gradeWeight,
          attachments: [...(existingTask.attachments || []), uploadResult.objectPath],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        toast({ title: "Assignment updated", description: `"${parsed.title}" updated with PDF attached.` });
      } else {
        await apiRequest("POST", "/api/tasks", {
          title: parsed.title || file.name.replace('.pdf', ''),
          description: parsed.description || "",
          type: parsed.type || "assignment",
          courseName: courseInfo.fullName,
          dueDate: new Date().toISOString(),
          priority: "high",
          weekNumber: 1,
          gradeWeight: parsed.gradeWeight || null,
          attachments: [uploadResult.objectPath],
          excludeFromGpa: true,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        toast({ title: "Assignment created", description: `"${parsed.title}" created with PDF attached. Please set the due date.` });
      }
    } catch (err: any) {
      console.error("Upload assignment error:", err);
      toast({ title: "Error", description: err.message || "Failed to process assignment.", variant: "destructive" });
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleUploadSyllabus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }

    setIsParsingSyllabus(true);
    toast({ title: "Uploading syllabus...", description: `Uploading ${file.name}` });

    try {
      console.log('[Syllabus] Starting direct upload for:', file.name, file.size, 'bytes');
      const uploadResp = await fetch('/api/uploads/direct', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/pdf',
          'X-File-Name': file.name,
        },
        body: file,
      });
      if (!uploadResp.ok) {
        const errData = await uploadResp.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }
      const uploadResult = await uploadResp.json();
      console.log('[Syllabus] Upload success:', uploadResult.objectPath);
      if (!uploadResult?.objectPath) throw new Error("Upload failed - no object path returned");

      setSyllabusObjectPath(uploadResult.objectPath);
      try {
        await fetch('/api/syllabus/paths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseCode: courseInfo.courseCode, objectPath: uploadResult.objectPath }),
        });
        console.log('[Syllabus] Path saved to server');
      } catch (e) { console.error('[Syllabus] Failed to save path to server:', e); }
      try {
        const saved = localStorage.getItem('courseSyllabusPaths');
        const local = saved ? JSON.parse(saved) : {};
        local[courseInfo.courseCode] = uploadResult.objectPath;
        localStorage.setItem('courseSyllabusPaths', JSON.stringify(local));
        console.log('[Syllabus] Path saved to localStorage');
      } catch {}

      toast({ title: "Syllabus uploaded!", description: "Now analyzing with AI..." });

      const parseResp = await fetch("/api/syllabus/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath: uploadResult.objectPath,
          courseName: courseInfo.fullName,
          courseCode: courseInfo.courseCode,
          fileName: file.name,
        }),
      });

      if (!parseResp.ok) {
        const err = await parseResp.json().catch(() => ({}));
        console.error('[Syllabus] Parse failed:', err);
        toast({ title: "Syllabus saved", description: "AI parsing failed but your syllabus PDF is attached. You can view it anytime.", variant: "default" });
        setIsParsingSyllabus(false);
        return;
      }

      const parsed = await parseResp.json();
      setSyllabusData(parsed);

      const allItems = [
        ...(parsed.items || []).map((item: any, i: number) => ({ ...item, _idx: i, _source: 'item' })),
        ...(parsed.gradingBreakdown || []).map((g: any, i: number) => ({ title: g.component, weight: g.weight, description: g.description, type: 'other', category: 'grading', _idx: i + 1000, _source: 'grading' })),
      ];

      const initialStates: Record<number, { accepted: boolean | null; editing: boolean; edits: any }> = {};
      allItems.forEach((item: any) => {
        initialStates[item._idx] = { accepted: null, editing: false, edits: { ...item } };
      });

      if (parsed.weekNumbering) {
        initialStates[-1] = { accepted: null, editing: false, edits: { ...parsed.weekNumbering } };
      }

      setSyllabusItemStates(initialStates);

      if (parsed.courseInfo) {
        const ci = parsed.courseInfo;
        if (ci.professor || ci.professorEmail) {
          const updates: any = {};
          if (ci.professor && !courseInfo.professor) updates.professor = ci.professor;
          if (ci.professorEmail && !courseInfo.professorEmail) updates.professorEmail = ci.professorEmail;
          if (Object.keys(updates).length > 0 && onSaveCourseInfo) {
            onSaveCourseInfo(updates);
          }
        }
      }

      toast({ title: "Syllabus parsed!", description: `Found ${parsed.items?.length || 0} items. Review them below.` });
    } catch (err: any) {
      console.error("Syllabus parse error:", err);
      toast({ title: "Error", description: err.message || "Failed to process syllabus.", variant: "destructive" });
    } finally {
      setIsParsingSyllabus(false);
    }
  };

  const handleAcceptSyllabusItem = async (idx: number) => {
    const state = syllabusItemStates[idx];
    if (!state) return;
    const item = state.edits;

    if (item._source === 'grading') {
      setSyllabusItemStates(prev => ({ ...prev, [idx]: { ...prev[idx], accepted: true } }));
      toast({ title: "Accepted", description: `${item.title} - ${item.weight}% noted.` });
      return;
    }

    try {
      const existingDupe = courseTasks.find(t =>
        t.title.trim().toLowerCase() === (item.title || '').trim().toLowerCase()
      );
      if (existingDupe) {
        setSyllabusItemStates(prev => ({ ...prev, [idx]: { ...prev[idx], accepted: true } }));
        toast({ title: "Already exists", description: `"${item.title}" is already in your assignments.` });
        return;
      }

      let dueDate: Date;
      if (item.date) {
        dueDate = new Date(item.date);
        if (item.time) {
          const [h, m] = item.time.split(':').map(Number);
          dueDate.setHours(h, m, 0, 0);
        } else {
          dueDate.setHours(23, 59, 0, 0);
        }
      } else {
        dueDate = new Date();
        dueDate.setHours(23, 59, 0, 0);
      }

      await apiRequest("POST", "/api/tasks", {
        title: item.title,
        description: item.description || "",
        type: item.type || "other",
        courseName: courseInfo.fullName,
        dueDate: dueDate.toISOString(),
        priority: item.type === "exam" || item.type === "quiz" ? "high" : "medium",
        weekNumber: getWeekNumber(dueDate, semesterStart, readingWeekStart),
        reminder1: 30,
        reminder2: 120,
        gradeWeight: item.weight || null,
        excludeFromGpa: true,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSyllabusItemStates(prev => ({ ...prev, [idx]: { ...prev[idx], accepted: true } }));
      toast({ title: "Added", description: `"${item.title}" added to assignments and calendar.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create task.", variant: "destructive" });
    }
  };

  const handleDeclineSyllabusItem = (idx: number) => {
    setSyllabusItemStates(prev => ({ ...prev, [idx]: { ...prev[idx], accepted: false } }));
  };

  const handleAcceptWeekNumbering = async (style: string) => {
    try {
      const resp = await fetch("/api/onedrive/rename-week-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: courseInfo.courseCode,
          courseName: courseInfo.courseName,
          weekStyle: style,
        }),
      });
      if (!resp.ok) throw new Error("Failed to update folders");
      const data = await resp.json();
      setSyllabusItemStates(prev => ({ ...prev, [-1]: { ...prev[-1], accepted: true } }));
      toast({ title: "Folders updated", description: data.message || `Week numbering set to "${style}".` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update week folders.", variant: "destructive" });
    }
  };

  const handleAddTask = () => {
    if (!newTask.title.trim() || !newTask.dueDate) {
      toast({ title: "Missing fields", description: "Title and due date are required.", variant: "destructive" });
      return;
    }

    const dueDate = new Date(newTask.dueDate);
    if (newTask.dueTime) {
      const [h, m] = newTask.dueTime.split(":").map(Number);
      dueDate.setHours(h, m, 0, 0);
    } else {
      dueDate.setHours(23, 59, 0, 0);
    }

    createTaskMutation.mutate({
      title: newTask.title,
      description: newTask.description || "",
      type: newTask.type || "other",
      courseName: courseInfo.fullName,
      dueDate: dueDate.toISOString(),
      priority: newTask.type === "exam" || newTask.type === "quiz" ? "high" : "medium",
      weekNumber: getWeekNumber(dueDate, semesterStart, readingWeekStart),
      reminder1: newTask.reminder1 || 30,
      reminder2: newTask.reminder2 || 120,
      reminder3: newTask.reminder3 || null,
      reminder4: newTask.reminder4 || null,
      gradeWeight: newTask.gradeWeight ? parseInt(newTask.gradeWeight) : null,
      gradeTotal: newTask.gradeTotal ? parseInt(newTask.gradeTotal) : null,
      gradeValue: newTask.gradeValue ? parseInt(newTask.gradeValue) : null,
      excludeFromGpa: true,
    });
  };

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (d: string | Date) => {
    const date = new Date(d);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const isOverdue = (d: string | Date) => new Date(d) < new Date() ;

  const deliveryLabel = courseInfo.deliveryMode === "virtual" ? "Virtual (Live Zoom)" : courseInfo.deliveryMode === "online" ? "Online (Async)" : courseInfo.deliveryMode || "Not set";

  const renderAssignmentRow = (task: Task, currentGroup: string | null) => {
    const TypeIcon = TASK_TYPE_OPTIONS.find((t) => t.value === task.type)?.icon || FileText;
    const overdue = !task.isCompleted && isOverdue(task.dueDate);
    const isDragging = dragId === task.id;
    const isDragOver = dragOverId === task.id;
    return (
      <React.Fragment key={task.id}>
      <div
        draggable
        onDragStart={() => handleDragStart(task.id)}
        onDragOver={(e) => handleDragOver(e, task.id)}
        onDrop={(e) => handleDrop(e, task.id, currentGroup)}
        onDragEnd={handleDragEnd}
        className={`flex items-center px-1.5 py-1.5 rounded-md border transition-all ${
          isDragging ? "opacity-40 border-blue-400/50" :
          isDragOver ? "border-blue-400 bg-blue-400/10" :
          task.isCompleted ? "bg-white/5 border-white/5" :
          overdue ? "bg-red-500/10 border-red-500/20" :
          "bg-white/5 border-white/10 hover:bg-white/8"
        }`}
        data-testid={`assignment-row-${task.id}`}
      >
        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60" style={{ marginRight: '10px' }} data-testid={`drag-handle-${task.id}`}>
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleTaskMutation.mutate({ id: task.id, isCompleted: !task.isCompleted, _task: task }); }}
          className={`flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
            task.isCompleted ? "bg-green-500 border-green-500" : "border-white/30 hover:border-white/50"
          }`}
          style={{ marginRight: '10px' }}
          data-testid={`button-toggle-task-${task.id}`}
        >
          {task.isCompleted && <Check className="h-3 w-3 text-white" />}
        </button>
        {assignToGroup === task.id ? (
          <select
            className="h-5 text-[8px] bg-white/10 border border-white/20 rounded text-white px-0.5 flex-shrink-0"
            style={{ marginLeft: '3px', marginRight: '10px' }}
            value={task.assignmentGroup || ''}
            onChange={(e) => assignTaskToGroup(task.id, e.target.value || null)}
            autoFocus
            onBlur={() => setAssignToGroup(null)}
            onClick={(e) => e.stopPropagation()}
            data-testid={`select-group-${task.id}`}
          >
            <option value="">No Group</option>
            {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setAssignToGroup(task.id); }}
            className="flex-shrink-0 text-white hover:text-white/60 transition-colors p-0.5"
            style={{ marginLeft: '3px', marginRight: '10px' }}
            title="Assign to group"
            data-testid={`button-assign-group-${task.id}`}
          >
            <FolderPlus className="h-[15px] w-[15px]" />
          </button>
        )}
        <Flag
          className={`h-[14px] w-[14px] flex-shrink-0 cursor-pointer transition-colors ${task.flagged ? 'text-red-400 fill-red-400' : 'text-white/20 hover:text-red-400'}`}
          style={{ marginLeft: '8px', marginRight: '4px' }}
          onClick={(e) => { e.stopPropagation(); toggleFlagMutation.mutate({ id: task.id, flagged: !task.flagged }); }}
          data-testid={`flag-toggle-${task.id}`}
        />
        <MessageSquare className={`h-[19px] w-[19px] flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity ${task.isCompleted ? "text-white/50" : "text-white"}`} style={{ marginLeft: '17px', marginRight: '10px' }} onClick={(e) => { e.stopPropagation(); if (expandedTaskId === task.id) { setExpandedTaskId(null); setEditTaskFields(null); } else { setExpandedTaskId(task.id); const d = task.dueDate ? new Date(task.dueDate) : null; setEditTaskFields({ title: task.title || '', type: task.type || 'other', dueDate: d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '', dueTime: d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '', description: task.description || '', gradeWeight: task.gradeWeight?.toString() || '', gradeTotal: task.gradeTotal?.toString() || '', gradeValue: task.gradeValue?.toString() || '', reminder1: task.reminder1 ?? 30, reminder2: task.reminder2 ?? 120, reminder3: task.reminder3 ?? null, reminder4: task.reminder4 ?? null }); } }} data-testid={`button-comments-${task.id}`} />
        <div className="flex-1 min-w-0" style={{ marginLeft: '21px' }}>
          <div
            className={`text-[10px] font-medium truncate flex items-center gap-1 cursor-pointer hover:underline ${task.isCompleted ? "line-through text-white/50" : "text-white"}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (expandedTaskId === task.id) {
                setExpandedTaskId(null);
                setEditTaskFields(null);
              } else {
                setExpandedTaskId(task.id);
                const d = task.dueDate ? new Date(task.dueDate) : null;
                setEditTaskFields({
                  title: task.title || '',
                  type: task.type || 'other',
                  dueDate: d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '',
                  dueTime: d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '',
                  description: task.description || '',
                  gradeWeight: task.gradeWeight?.toString() || '',
                  gradeTotal: task.gradeTotal?.toString() || '',
                  gradeValue: task.gradeValue?.toString() || '',
                  reminder1: task.reminder1 ?? 30,
                  reminder2: task.reminder2 ?? 120,
                  reminder3: task.reminder3 ?? null,
                  reminder4: task.reminder4 ?? null,
                });
              }
            }}
            data-testid={`link-edit-task-${task.id}`}
          >
            {task.title}
            {task.attachments && task.attachments.length > 0 && (
              <Paperclip className="h-2.5 w-2.5 text-blue-400 flex-shrink-0 inline" />
            )}
          </div>
          <div className="flex items-center gap-2 text-[8px] text-white">
            <span className={overdue ? "text-red-400" : ""}>
              {formatDate(task.dueDate)} {formatTime(task.dueDate)}
            </span>
            <span className="capitalize">{task.type}</span>
          </div>
        </div>
        <div className="flex items-center flex-shrink-0" style={{ gap: '10px', position: 'relative', left: '-8px' }} onClick={(e) => e.stopPropagation()}>
          <DebouncedGradeInput
            value={task.gradeValue}
            onSave={(val) => updateGradeValueMutation.mutate({ id: task.id, gradeValue: val, _task: task })}
            placeholder="Scr"
            testId={`input-grade-value-${task.id}`}
          />
          <DebouncedGradeInput
            value={task.gradeTotal}
            onSave={(val) => updateTaskMutation.mutate({ id: task.id, data: { gradeTotal: val }, _task: task })}
            placeholder="Tot"
            testId={`input-grade-total-${task.id}`}
          />
          <DebouncedGradeInput
            value={task.gradeWeight}
            onSave={(val) => updateTaskMutation.mutate({ id: task.id, data: { gradeWeight: val }, _task: task })}
            placeholder="Wt"
            testId={`input-grade-weight-${task.id}`}
          />
          <span className="text-[9px] text-white w-[33px] text-center" data-testid={`text-grade-percent-${task.id}`}>
            {task.gradeValue !== null && task.gradeValue !== undefined && task.gradeTotal ? `${((task.gradeValue / task.gradeTotal) * 100).toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="flex items-center flex-shrink-0" style={{ gap: '10px', marginLeft: '8px' }} onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center cursor-pointer" title={task.excludeFromGpa ? "Excluded from grade" : "Included in grade"} data-testid={`toggle-gpa-${task.id}`}>
            <div className="relative" onClick={() => updateTaskMutation.mutate({ id: task.id, data: { excludeFromGpa: !task.excludeFromGpa }, _task: task })}>
              <div className={`w-6 h-3.5 rounded-full transition-colors ${task.excludeFromGpa ? 'bg-red-500/60' : 'bg-green-500/60'}`} />
              <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${task.excludeFromGpa ? 'left-0.5' : 'left-3'}`} />
            </div>
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const { id, gradeValue, isCompleted, ...rest } = task;
              createTaskMutation.mutate({
                ...rest,
                title: `${task.title} (copy)`,
                isCompleted: false,
                gradeValue: null,
              });
            }}
            className="flex-shrink-0 text-white hover:text-blue-400 transition-colors p-0.5"
            style={{ marginLeft: '6px' }}
            title="Duplicate task"
            data-testid={`button-duplicate-task-${task.id}`}
          >
            <Copy className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteTaskMutation.mutate({ id: task.id, _task: task }); }}
            className="flex-shrink-0 text-white hover:text-red-400 transition-colors p-0.5"
            data-testid={`button-delete-task-${task.id}`}
          >
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
      {expandedTaskId === task.id && editTaskFields && (
        <div className="bg-white/5 border border-white/15 rounded-lg p-3 mb-1 space-y-2 ml-6" data-testid={`inline-edit-form-${task.id}`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Title</Label>
              <Input value={editTaskFields.title} onChange={(e) => setEditTaskFields({ ...editTaskFields, title: e.target.value })} className="h-7 text-[10px] bg-white/10 border-white/15 text-white" data-testid={`input-inline-title-${task.id}`} />
            </div>
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Type</Label>
              <select value={editTaskFields.type} onChange={(e) => setEditTaskFields({ ...editTaskFields, type: e.target.value })} className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5" data-testid={`select-inline-type-${task.id}`}>
                {TASK_TYPE_OPTIONS.map((t) => (<option key={t.value} value={t.value} className="bg-gray-800">{t.label}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Due Date</Label>
              <Input type="date" value={editTaskFields.dueDate} onChange={(e) => setEditTaskFields({ ...editTaskFields, dueDate: e.target.value })} className="h-7 !text-[10px] text-white bg-white/10 border-white/15" style={{ colorScheme: 'dark' }} data-testid={`input-inline-date-${task.id}`} />
            </div>
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Due Time</Label>
              <Input type="time" value={editTaskFields.dueTime} onChange={(e) => setEditTaskFields({ ...editTaskFields, dueTime: e.target.value })} className="h-7 !text-[10px] text-white bg-white/10 border-white/15" style={{ colorScheme: 'dark' }} data-testid={`input-inline-time-${task.id}`} />
            </div>
          </div>
          <div>
            <Label className="text-[9px] text-white mb-0.5 block">Description</Label>
            <Input value={editTaskFields.description} onChange={(e) => setEditTaskFields({ ...editTaskFields, description: e.target.value })} className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25" placeholder="Optional description" data-testid={`input-inline-desc-${task.id}`} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Grade Weight (%)</Label>
              <Input type="number" value={editTaskFields.gradeWeight} onChange={(e) => setEditTaskFields({ ...editTaskFields, gradeWeight: e.target.value })} placeholder="e.g. 20" className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25" data-testid={`input-inline-weight-${task.id}`} />
            </div>
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Total Points</Label>
              <Input type="number" value={editTaskFields.gradeTotal} onChange={(e) => setEditTaskFields({ ...editTaskFields, gradeTotal: e.target.value })} placeholder="e.g. 100" className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25" data-testid={`input-inline-total-${task.id}`} />
            </div>
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Score Earned</Label>
              <Input type="number" value={editTaskFields.gradeValue} onChange={(e) => setEditTaskFields({ ...editTaskFields, gradeValue: e.target.value })} placeholder="e.g. 85" className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25" data-testid={`input-inline-value-${task.id}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Reminder 1</Label>
              <select value={editTaskFields.reminder1 ?? ''} onChange={(e) => setEditTaskFields({ ...editTaskFields, reminder1: e.target.value ? parseInt(e.target.value) : null })} className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5" data-testid={`select-inline-r1-${task.id}`}>
                {REMINDER_PRESETS.map((r) => (<option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Reminder 2</Label>
              <select value={editTaskFields.reminder2 ?? ''} onChange={(e) => setEditTaskFields({ ...editTaskFields, reminder2: e.target.value ? parseInt(e.target.value) : null })} className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5" data-testid={`select-inline-r2-${task.id}`}>
                {REMINDER_PRESETS.map((r) => (<option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Reminder 3</Label>
              <select value={editTaskFields.reminder3 ?? ''} onChange={(e) => setEditTaskFields({ ...editTaskFields, reminder3: e.target.value ? parseInt(e.target.value) : null })} className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5" data-testid={`select-inline-r3-${task.id}`}>
                {REMINDER_PRESETS.map((r) => (<option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-[9px] text-white mb-0.5 block">Reminder 4</Label>
              <select value={editTaskFields.reminder4 ?? ''} onChange={(e) => setEditTaskFields({ ...editTaskFields, reminder4: e.target.value ? parseInt(e.target.value) : null })} className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5" data-testid={`select-inline-r4-${task.id}`}>
                {REMINDER_PRESETS.map((r) => (<option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button size="sm" variant="ghost" onClick={() => { setExpandedTaskId(null); setEditTaskFields(null); }} className="h-9 px-4 text-[13px] font-semibold text-white hover:text-white hover:bg-white/10 border border-white/20" data-testid={`button-inline-cancel-${task.id}`}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                const updates: Record<string, any> = {};
                if (editTaskFields.title !== task.title) updates.title = editTaskFields.title;
                if (editTaskFields.type !== task.type) updates.type = editTaskFields.type;
                if (editTaskFields.description !== (task.description || '')) updates.description = editTaskFields.description;
                if (editTaskFields.dueDate) {
                  const dd = new Date(editTaskFields.dueDate);
                  if (editTaskFields.dueTime) {
                    const [h, m] = editTaskFields.dueTime.split(':').map(Number);
                    dd.setHours(h, m, 0, 0);
                  } else {
                    dd.setHours(23, 59, 0, 0);
                  }
                  updates.dueDate = dd.toISOString();
                }
                const gw = editTaskFields.gradeWeight ? parseInt(editTaskFields.gradeWeight) : null;
                const gt = editTaskFields.gradeTotal ? parseInt(editTaskFields.gradeTotal) : null;
                const gv = editTaskFields.gradeValue ? parseInt(editTaskFields.gradeValue) : null;
                if (gw !== (task.gradeWeight ?? null)) updates.gradeWeight = gw;
                if (gt !== (task.gradeTotal ?? null)) updates.gradeTotal = gt;
                if (gv !== (task.gradeValue ?? null)) updates.gradeValue = gv;
                if (editTaskFields.reminder1 !== (task.reminder1 ?? null)) updates.reminder1 = editTaskFields.reminder1;
                if (editTaskFields.reminder2 !== (task.reminder2 ?? null)) updates.reminder2 = editTaskFields.reminder2;
                if (editTaskFields.reminder3 !== (task.reminder3 ?? null)) updates.reminder3 = editTaskFields.reminder3;
                if (editTaskFields.reminder4 !== (task.reminder4 ?? null)) updates.reminder4 = editTaskFields.reminder4;
                if (Object.keys(updates).length > 0) {
                  updateTaskMutation.mutate({ id: task.id, data: updates, _task: task });
                }
                setExpandedTaskId(null);
                setEditTaskFields(null);
                toast({ title: "Task updated" });
              }}
              className="h-9 px-5 text-[13px] font-semibold bg-blue-600 hover:bg-blue-500 text-white"
              data-testid={`button-inline-save-${task.id}`}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
      </React.Fragment>
    );
  };

  const handleDialogDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dialogDragRef.current = { dragging: true, startX: clientX, startY: clientY, origX: dialogPos.x, origY: dialogPos.y };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dialogDragRef.current.dragging) return;
      const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const dx = cx - dialogDragRef.current.startX;
      const dy = cy - dialogDragRef.current.startY;
      setDialogPos({ x: dialogDragRef.current.origX + dx, y: dialogDragRef.current.origY + dy });
    };
    const handleUp = () => {
      dialogDragRef.current.dragging = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", pointerEvents: 'none' }}
      data-testid="course-detail-overlay"
    >
      <div
        className="flex flex-col text-white rounded-lg overflow-hidden"
        style={{
          pointerEvents: 'auto',
          width: "960px",
          maxWidth: "95vw",
          height: "88vh",
          background: 'linear-gradient(180deg, #3a8bbf 0%, color-mix(in srgb, #164a72 70%, black) 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.05)',
          transform: `translate(${dialogPos.x}px, ${dialogPos.y}px)`,
        }}
        data-testid="course-detail-dialog"
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg"
          onMouseDown={handleDialogDragStart}
          onTouchStart={handleDialogDragStart}
          style={{
            cursor: 'grab',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${editInfo.color || courseInfo.color}cc 40%, ${editInfo.colorEnd || courseInfo.colorEnd || courseInfo.color}bb 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="text-white flex-shrink-0" style={{ width: '15px', height: '15px' }} />
            <div className="min-w-0 flex items-center gap-2">
              <h2
                className="font-normal text-white truncate"
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}
                data-testid="text-course-title"
              >
                {courseInfo.courseCode} — {courseInfo.courseName}
              </h2>
              {courseInfo.courseType && (
                <span className="text-[9px] text-white px-1.5 rounded-md border border-white/30 bg-white/10 flex-shrink-0 flex items-center" style={{ alignSelf: 'stretch' }}>
                  {courseInfo.courseType === "core" ? "Core" : courseInfo.courseType === "open_elective" ? "Elective" : "Liberal Studies"}
                </span>
              )}
              {gradeCalc && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }} data-testid="grade-calculator-inline">
                  <span className="text-[11px] font-bold text-white" data-testid="text-current-grade">{gradeCalc.currentGrade}</span>
                  <span className="text-[10px] text-white">({gradeCalc.currentPercent.toFixed(1)}%)</span>
                  <span className="text-[9px] text-white/70" style={{ marginLeft: '2px' }}>{gradeCalc.gradedCount} graded · {gradeCalc.gradedWeight.toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-white flex-shrink-0">
            {courseInfo.deliveryMode === "virtual" ? (
              <span className="flex items-center gap-0.5"><img src={zoomLogoPath} alt="Zoom" style={{ width: '38px', height: 'auto', filter: 'brightness(0) invert(1)' }} /> Virtual</span>
            ) : courseInfo.deliveryMode === "online" ? (
              <span className="flex items-center gap-0.5"><img src={wifiLogoPath} alt="Online" style={{ width: '14px', height: 'auto' }} /> Online</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white uppercase font-medium">Course Info</span>
            {syllabusObjectPath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/syllabus/view?path=${encodeURIComponent(syllabusObjectPath)}`, '_blank');
                }}
                className="px-2 py-0 text-[10px] text-white border-white/40 hover:bg-white/15 hover:text-white bg-white/10 leading-none"
                style={{ height: '22px', minHeight: '22px', maxHeight: '22px' }}
                data-testid="button-view-syllabus"
              >
                <Paperclip className="w-3 h-3 mr-1" />
                View Syllabus
              </Button>
            )}
            <span className="text-[9px] text-white">Rank</span>
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)' }}>
              <select className="h-4 text-[10px] bg-transparent border-none text-white rounded px-0.5 outline-none cursor-pointer" style={{ WebkitAppearance: 'none', appearance: 'none', paddingRight: '12px' }} value={courseRank} onChange={(e) => {
                const val = parseInt(e.target.value);
                onSaveCourseInfo({ courseRank: val });
              }} data-testid="select-course-rank-header">
                <option value={0} className="bg-gray-800">—</option>
                {[1, 2, 3].map(n => {
                  const taken = (usedRanks || []).includes(n) && courseRank !== n;
                  return <option key={n} value={n} className="bg-gray-800" disabled={taken} style={taken ? { color: '#555' } : {}}>{n}</option>;
                })}
              </select>
              <ChevronDown className="w-3 h-3 text-white/60 -ml-4 pointer-events-none" />
            </div>
          </div>
              {!isEditingInfo ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingInfo(true)}
                    className="flex items-center gap-1.5 text-[11px] text-white hover:text-white transition-colors font-semibold"
                    data-testid="button-edit-course-info"
                  >
                    Edit
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditInfo({
                        professor: courseInfo.professor || '',
                        professorEmail: courseInfo.professorEmail || '',
                        deliveryMode: courseInfo.deliveryMode || '',
                        classDay: courseInfo.classDay || '',
                        classDay2: courseInfo.classDay2 || '',
                        classTime: courseInfo.classTime || '',
                        classEndTime: courseInfo.classEndTime || '',
                        classTime2: courseInfo.classTime2 || '',
                        classEndTime2: courseInfo.classEndTime2 || '',
                        zoomLink: courseInfo.zoomLink || '',
                        startDate: courseInfo.startDate || '',
                        endDate: courseInfo.endDate || '',
                        color: courseInfo.color || '#3b82f6',
                        colorEnd: courseInfo.colorEnd || courseInfo.color || '#3b82f6',
                        colorStops: courseInfo.colorStops || '',
                        borderColor: courseInfo.borderColor || '',
                        courseRowColor: courseInfo.courseRowColor || '',
                        taskBgColor: courseInfo.taskBgColor || '',
                      });
                      if (onLiveColorChange) {
                        onLiveColorChange({
                          color: courseInfo.color || '#3b82f6',
                          colorEnd: courseInfo.colorEnd || courseInfo.color || '#3b82f6',
                          colorStops: courseInfo.colorStops || '',
                          borderColor: courseInfo.borderColor || '',
                          courseRowColor: courseInfo.courseRowColor || '',
                          taskBgColor: courseInfo.taskBgColor || '',
                        });
                      }
                      setIsEditingInfo(false);
                    }}
                    className="text-[11px] text-white hover:text-white transition-colors px-3 py-1 rounded border border-white/30 hover:bg-white/10"
                    data-testid="button-cancel-edit-info"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editInfo.deliveryMode === 'virtual' && !editInfo.zoomLink?.trim()) {
                        toast({ title: "URL is required for virtual courses", variant: "destructive" });
                        return;
                      }
                      if (onSaveCourseInfo) {
                        const semKey = semesterKeyFromTermYear(editInfo.semesterTerm, editInfo.year);
                        onSaveCourseInfo({ ...editInfo, semesterKey: semKey || undefined, courseRank: editInfo.courseRank || undefined });
                      }
                      if (editInfo.professor?.trim()) {
                        fetch('/api/key-contacts/sync-professor', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ professorName: editInfo.professor, professorEmail: editInfo.professorEmail, courseCode: courseInfo.courseCode }),
                        }).catch(() => {});
                      }
                      setIsEditingInfo(false);
                      toast({ title: "Course info updated" });
                    }}
                    className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium transition-colors px-3 py-1 rounded bg-white hover:bg-white/90"
                    data-testid="button-save-edit-info"
                  >
                    <Check className="w-3 h-3" />
                    Save
                  </button>
                </div>
              )}
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}>
          <div className="p-3 space-y-2">
            {isEditingInfo ? (
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center gap-1.5 justify-start">
                    <label className="cursor-pointer" data-testid="button-upload-assignment">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleUploadAssignment}
                        disabled={isParsingPdf || isUploading}
                      />
                      <div className={`h-6 px-2 text-[9px] bg-blue-600/30 hover:bg-blue-600/50 text-white border border-blue-400/30 rounded-md flex items-center gap-1 transition-colors ${isParsingPdf || isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isParsingPdf || isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {isParsingPdf ? 'Parsing...' : isUploading ? 'Uploading...' : 'Upload PDF'}
                      </div>
                    </label>
                    <label className={`cursor-pointer ${syllabusObjectPath ? 'opacity-40 pointer-events-none' : ''}`} data-testid="button-upload-syllabus">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleUploadSyllabus}
                        disabled={isParsingSyllabus || isUploading || !!syllabusObjectPath}
                      />
                      <div className={`h-6 px-2 text-[9px] ${syllabusObjectPath ? 'bg-gray-500/40 text-white/50 border-gray-400/30' : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-white border-emerald-400/30'} border rounded-md flex items-center gap-1 transition-colors whitespace-nowrap ${isParsingSyllabus || isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isParsingSyllabus ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        {isParsingSyllabus ? 'Parsing...' : 'Add Syllabus'}
                      </div>
                    </label>
                    <Paperclip
                      className={`h-3.5 w-3.5 ${syllabusObjectPath ? 'text-white/40' : 'text-white'} ${syllabusObjectPath ? 'cursor-pointer hover:opacity-70' : ''} transition-opacity`}
                      onClick={() => {
                        if (syllabusObjectPath) window.open(`/api/syllabus/view?path=${encodeURIComponent(syllabusObjectPath)}`, '_blank');
                      }}
                      data-testid="button-view-syllabus-edit"
                    />
                    <Trash2
                      className={`h-3.5 w-3.5 ${syllabusObjectPath ? 'text-white cursor-pointer hover:opacity-70' : 'text-white/40'} transition-opacity`}
                        onClick={async () => {
                          if (!syllabusObjectPath) return;
                          setSyllabusObjectPath('');
                          try {
                            await fetch('/api/syllabus/paths', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ courseCode: courseInfo.courseCode, objectPath: '' }),
                            });
                            const saved = localStorage.getItem('courseSyllabusPaths');
                            const local = saved ? JSON.parse(saved) : {};
                            delete local[courseInfo.courseCode];
                            localStorage.setItem('courseSyllabusPaths', JSON.stringify(local));
                          } catch {}
                          toast({ title: "Syllabus removed" });
                        }}
                        data-testid="button-delete-syllabus"
                      />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Professor</label>
                    <input className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1.5 placeholder:text-white/25" value={editInfo.professor} onChange={(e) => setEditInfo({...editInfo, professor: e.target.value})} placeholder="Professor name" data-testid="input-edit-professor" />
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Email</label>
                    <input className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1.5 placeholder:text-white/25" value={editInfo.professorEmail} onChange={(e) => setEditInfo({...editInfo, professorEmail: e.target.value})} placeholder="professor@email.com" data-testid="input-edit-email" />
                  </div>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Delivery Mode</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.deliveryMode} onChange={(e) => setEditInfo({...editInfo, deliveryMode: e.target.value})} data-testid="select-edit-delivery">
                      <option value="" className="bg-gray-800">Not set</option>
                      <option value="virtual" className="bg-gray-800">Virtual (Live Zoom)</option>
                      <option value="online" className="bg-gray-800">Online (Async)</option>
                      <option value="in-person" className="bg-gray-800">In-Person</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Zoom Link{editInfo.deliveryMode === 'virtual' && <span className="text-red-400 ml-0.5">*</span>}</label>
                    <input className={`w-full h-6 text-[10px] bg-white/10 text-white rounded px-1.5 placeholder:text-white/25 ${editInfo.deliveryMode === 'virtual' && !editInfo.zoomLink?.trim() ? 'border border-red-500/70' : 'border border-white/15'}`} value={editInfo.zoomLink} onChange={(e) => setEditInfo({...editInfo, zoomLink: e.target.value})} placeholder={editInfo.deliveryMode === 'virtual' ? "Required — https://zoom.us/..." : "https://zoom.us/..."} data-testid="input-edit-zoom" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Semester</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={semesterKeyFromTermYear(editInfo.semesterTerm, editInfo.year)} onChange={(e) => { const opt = SEMESTER_OPTIONS.find(o => o.key === e.target.value); if (opt) { setEditInfo({...editInfo, semesterTerm: opt.term, year: opt.year, startDate: opt.start, endDate: opt.end }); } else { setEditInfo({...editInfo, semesterTerm: '', year: '', startDate: '', endDate: '' }); } }} data-testid="select-edit-semester-term">
                      <option value="" className="bg-gray-800">—</option>
                      {SEMESTER_OPTIONS.map(o => <option key={o.key} value={o.key} className="bg-gray-800">{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Start</label>
                    <input type="date" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.startDate} onChange={(e) => setEditInfo({...editInfo, startDate: e.target.value})} data-testid="input-edit-start-date" />
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">End</label>
                    <input type="date" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.endDate} onChange={(e) => setEditInfo({...editInfo, endDate: e.target.value})} data-testid="input-edit-end-date" />
                  </div>
                </div>
                {editInfo.deliveryMode !== 'online' && (() => {
                  const isSpSu = editInfo.semesterTerm?.startsWith('spring_summer');
                  return (
                    <div className="space-y-2">
                      <div className="grid gap-2 grid-cols-3">
                        <div>
                          <label className="text-white text-[9px] mb-0.5 block">{isSpSu ? 'Day of Week 1' : 'Day of Week'}</label>
                          <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.classDay} onChange={(e) => setEditInfo({...editInfo, classDay: e.target.value})} data-testid="select-edit-day1">
                            <option value="" className="bg-gray-800">—</option>
                            {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => <option key={d} value={d} className="bg-gray-800 capitalize">{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-white text-[9px] mb-0.5 block">Start</label>
                          <input type="time" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.classTime} onChange={(e) => setEditInfo({...editInfo, classTime: e.target.value})} data-testid="input-edit-start-time" />
                        </div>
                        <div>
                          <label className="text-white text-[9px] mb-0.5 block">End</label>
                          <input type="time" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.classEndTime} onChange={(e) => setEditInfo({...editInfo, classEndTime: e.target.value})} data-testid="input-edit-end-time" />
                        </div>
                      </div>
                      {isSpSu && (
                        <div className="grid gap-2 grid-cols-3">
                          <div>
                            <label className="text-white text-[9px] mb-0.5 block">Day of Week 2</label>
                            <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.classDay2} onChange={(e) => setEditInfo({...editInfo, classDay2: e.target.value})} data-testid="select-edit-day2">
                              <option value="" className="bg-gray-800">—</option>
                              {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => <option key={d} value={d} className="bg-gray-800 capitalize">{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-white text-[9px] mb-0.5 block">Start</label>
                            <input type="time" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.classTime2} onChange={(e) => setEditInfo({...editInfo, classTime2: e.target.value})} data-testid="input-edit-start-time-2" />
                          </div>
                          <div>
                            <label className="text-white text-[9px] mb-0.5 block">End</label>
                            <input type="time" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.classEndTime2} onChange={(e) => setEditInfo({...editInfo, classEndTime2: e.target.value})} data-testid="input-edit-end-time-2" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div>
                  <label className="text-white text-[9px] mb-0.5 block">Certificate Type</label>
                  <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={certificateType} onChange={(e) => updateCertificateType(e.target.value)} data-testid="select-edit-certificate-type-detail">
                    <option value="" className="bg-gray-800">-- Select --</option>
                    {CERTIFICATE_TYPE_OPTIONS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.options.map(o => <option key={o} value={o} className="bg-gray-800">{o}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="flex items-end justify-between">
                  {(() => {
                    const midStops: Array<{ position: number; color: string }> = editInfo.colorStops ? (() => { try { return JSON.parse(editInfo.colorStops); } catch { return []; } })() : [];
                    const allStops = [
                      { position: 0, color: editInfo.color, key: 'start' as const },
                      ...midStops.map((s: any, i: number) => ({ position: s.position, color: s.color, key: i as number })),
                      { position: 100, color: editInfo.colorEnd, key: 'end' as const },
                    ].sort((a, b) => a.position - b.position);
                    const gradientCss = `linear-gradient(to right, ${allStops.map(s => `${s.color} ${s.position}%`).join(', ')})`;
                    const getActiveColor = (): string => {
                      if (activeGradientStop === 'start') return editInfo.color;
                      if (activeGradientStop === 'end') return editInfo.colorEnd;
                      if (typeof activeGradientStop === 'number' && midStops[activeGradientStop]) return midStops[activeGradientStop].color;
                      return '#000000';
                    };
                    const setActiveColor = (hex: string) => {
                      if (activeGradientStop === 'start') setEditInfo({...editInfo, color: hex});
                      else if (activeGradientStop === 'end') setEditInfo({...editInfo, colorEnd: hex});
                      else if (typeof activeGradientStop === 'number') {
                        const updated = [...midStops];
                        updated[activeGradientStop] = { ...updated[activeGradientStop], color: hex };
                        setEditInfo({...editInfo, colorStops: JSON.stringify(updated)});
                      }
                    };
                    const hexToHue = (c: string) => { const r = parseInt(c.slice(1,3),16)/255, g = parseInt(c.slice(3,5),16)/255, b = parseInt(c.slice(5,7),16)/255; const max = Math.max(r,g,b), min = Math.min(r,g,b); if (max===min) return 0; let h = 0; if (max===r) h = ((g-b)/(max-min))%6; else if (max===g) h = (b-r)/(max-min)+2; else h = (r-g)/(max-min)+4; h = Math.round(h*60); return h<0?h+360:h; };
                    const hueToHex = (hue: number) => `#${[0,8,4].map(n => { const k = (n + hue/30) % 12; const c2 = 0.5 - 0.5 * Math.max(Math.min(k-3, 9-k, 1), -1); return Math.round(255 * Math.max(0, Math.min(1, c2))).toString(16).padStart(2,'0'); }).join('')}`;
                    const hexToSvPos = (hex: string) => {
                      const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
                      const max = Math.max(r,g,b), min = Math.min(r,g,b);
                      const v = max;
                      const s = max === 0 ? 0 : (max - min) / max;
                      return { x: s, y: 1 - v };
                    };
                    const svToHex = (hue: number, sx: number, sy: number) => {
                      const s = sx, v = 1 - sy;
                      const c = v * s, x2 = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = v - c;
                      let r1 = 0, g1 = 0, b1 = 0;
                      if (hue < 60) { r1 = c; g1 = x2; } else if (hue < 120) { r1 = x2; g1 = c; } else if (hue < 180) { g1 = c; b1 = x2; } else if (hue < 240) { g1 = x2; b1 = c; } else if (hue < 300) { r1 = x2; b1 = c; } else { r1 = c; b1 = x2; }
                      const f = (ch: number) => Math.round(255 * Math.max(0, Math.min(1, ch + m))).toString(16).padStart(2, '0');
                      return `#${f(r1)}${f(g1)}${f(b1)}`;
                    };
                    const gradBarRef = useRef<HTMLDivElement>(null);
                    return (
                    <div className="flex items-start gap-3">
                    <div style={{ width: '200px' }}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-white text-[9px]">Course Colour</label>
                        <button className="text-white hover:text-white/80 text-[8px] flex items-center gap-0.5" onClick={() => {
                          const revMid = midStops.map(s => ({ position: 100 - s.position, color: s.color })).reverse();
                          setEditInfo({...editInfo, color: editInfo.colorEnd, colorEnd: editInfo.color, colorStops: revMid.length ? JSON.stringify(revMid) : ''});
                        }} data-testid="button-reverse-gradient"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4h14M11 1l3 3-3 3M15 12H1M5 9l-3 3 3 3"/></svg><span>Reverse</span></button>
                      </div>
                      <div ref={gradBarRef} className="rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '1px', background: 'rgba(0,0,0,0.2)', cursor: 'copy' }}
                        onDoubleClick={(e) => {
                          const bar = gradBarRef.current;
                          if (!bar) return;
                          const rect = bar.getBoundingClientRect();
                          const pct = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left - 3) / (rect.width - 6)) * 100)));
                          const leftStop = allStops.filter(s => s.position <= pct).pop()!;
                          const rightStop = allStops.find(s => s.position >= pct)!;
                          const t = rightStop.position === leftStop.position ? 0 : (pct - leftStop.position) / (rightStop.position - leftStop.position);
                          const lR = parseInt(leftStop.color.slice(1,3),16), lG = parseInt(leftStop.color.slice(3,5),16), lB = parseInt(leftStop.color.slice(5,7),16);
                          const rR = parseInt(rightStop.color.slice(1,3),16), rG = parseInt(rightStop.color.slice(3,5),16), rB = parseInt(rightStop.color.slice(5,7),16);
                          const mR = Math.round(lR + (rR-lR)*t), mG = Math.round(lG + (rG-lG)*t), mB = Math.round(lB + (rB-lB)*t);
                          const newColor = `#${mR.toString(16).padStart(2,'0')}${mG.toString(16).padStart(2,'0')}${mB.toString(16).padStart(2,'0')}`;
                          const newMid = [...midStops, { position: pct, color: newColor }].sort((a, b) => a.position - b.position);
                          const newIdx = newMid.findIndex(s => s.position === pct && s.color === newColor);
                          setEditInfo({...editInfo, colorStops: JSON.stringify(newMid)});
                          setActiveGradientStop(newIdx);
                        }}>
                        <div style={{ height: '18px', borderRadius: '3px', background: gradientCss }} data-testid="gradient-preview-bar" />
                      </div>
                      <div className="relative" style={{ height: '16px', marginTop: '1px' }}>
                        <div style={{ position: 'absolute', left: '0px', top: 0, cursor: 'pointer', zIndex: 10 }} onClick={() => setActiveGradientStop(activeGradientStop === 'start' ? null : 'start')} data-testid="gradient-stop-start">
                          <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={editInfo.color} stroke={activeGradientStop === 'start' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={activeGradientStop === 'start' ? '2' : '1'}/></svg>
                        </div>
                        {midStops.map((stop, idx) => (
                          <div key={idx} style={{ position: 'absolute', left: `calc(${stop.position}% - 6px)`, top: 0, cursor: 'pointer', touchAction: 'none', zIndex: activeGradientStop === idx ? 20 : 5 }}
                            onClick={() => setActiveGradientStop(activeGradientStop === idx ? null : idx)}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const el = e.currentTarget as HTMLElement;
                              el.setPointerCapture(e.pointerId);
                              const bar = gradBarRef.current;
                              if (!bar) return;
                              const barRect = bar.getBoundingClientRect();
                              const barW = barRect.width;
                              const onMove = (ev: PointerEvent) => {
                                const pct = Math.round(Math.max(1, Math.min(99, ((ev.clientX - barRect.left) / barW) * 100)));
                                const updated = [...midStops];
                                updated[idx] = { ...updated[idx], position: pct };
                                setEditInfo(prev => ({...prev, colorStops: JSON.stringify(updated.sort((a, b) => a.position - b.position))}));
                              };
                              const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                              window.addEventListener('pointermove', onMove);
                              window.addEventListener('pointerup', onUp);
                            }}
                            data-testid={`gradient-stop-mid-${idx}`}>
                            <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 11,6 6,12 1,6" fill={stop.color} stroke={activeGradientStop === idx ? '#ffffff' : 'rgba(255,255,255,0.5)'} strokeWidth={activeGradientStop === idx ? '2' : '1'}/></svg>
                          </div>
                        ))}
                        <div style={{ position: 'absolute', right: '0px', top: 0, cursor: 'pointer', zIndex: 10 }} onClick={() => setActiveGradientStop(activeGradientStop === 'end' ? null : 'end')} data-testid="gradient-stop-end">
                          <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={editInfo.colorEnd} stroke={activeGradientStop === 'end' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={activeGradientStop === 'end' ? '2' : '1'}/></svg>
                        </div>
                        {midStops.length > 0 && <span className="text-white text-[9px] absolute" style={{ bottom: '-23px', left: '0px' }}>Double-click bar to add · drag to move</span>}
                      </div>
                      {midStops.length === 0 && <div className="text-white text-[11px] text-left" style={{ marginTop: '7px', marginBottom: '10px' }}>Double-click gradient bar to add a colour stop</div>}
                      {midStops.length > 0 && <div style={{ height: '24px' }} />}
                      {activeGradientStop != null && (
                        <div className="mt-1 rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', padding: '6px' }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-5 h-5 rounded border border-white/30 shrink-0" style={{ backgroundColor: getActiveColor() }} />
                            <span className="text-white/60 text-[8px] uppercase tracking-wider">{activeGradientStop === 'start' ? 'Start' : activeGradientStop === 'end' ? 'End' : `Stop ${(activeGradientStop as number) + 1}`} Colour</span>
                            {typeof activeGradientStop === 'number' && (
                              <button className="text-red-400/70 hover:text-red-400 text-[8px] ml-auto mr-1" onClick={() => {
                                const updated = midStops.filter((_, i) => i !== activeGradientStop);
                                setEditInfo({...editInfo, colorStops: updated.length ? JSON.stringify(updated) : ''});
                                setActiveGradientStop(null);
                              }} data-testid="button-delete-stop"><Trash2 className="w-3 h-3" /></button>
                            )}
                            <button className={`${typeof activeGradientStop === 'number' ? '' : 'ml-auto '}text-white/40 hover:text-white`} onClick={() => setActiveGradientStop(null)} data-testid="button-close-color-picker"><X className="w-3 h-3" /></button>
                          </div>
                          {typeof activeGradientStop === 'number' && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-white/50 text-[8px]">Position</span>
                              <input type="range" min={1} max={99} value={midStops[activeGradientStop]?.position || 50} onChange={(e) => {
                                const updated = [...midStops];
                                updated[activeGradientStop as number] = { ...updated[activeGradientStop as number], position: parseInt(e.target.value) };
                                setEditInfo({...editInfo, colorStops: JSON.stringify(updated.sort((a, b) => a.position - b.position))});
                              }} className="flex-1" style={{ height: '6px', accentColor: getActiveColor() }} data-testid="slider-stop-position" />
                              <span className="text-white/50 text-[8px] w-6 text-right">{midStops[activeGradientStop]?.position}%</span>
                            </div>
                          )}
                          <div className="relative rounded cursor-crosshair" style={{ height: '92px', touchAction: 'none' }} data-testid={`color-area-${activeGradientStop}`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              const el = e.currentTarget;
                              el.setPointerCapture(e.pointerId);
                              const rect = el.getBoundingClientRect();
                              const pad = 6;
                              const hue = hexToHue(getActiveColor());
                              const update = (ev: PointerEvent) => {
                                const x = Math.max(0, Math.min(1, (ev.clientX - rect.left - pad) / (rect.width - pad * 2)));
                                const y = Math.max(0, Math.min(1, (ev.clientY - rect.top - pad) / (rect.height - pad * 2)));
                                setActiveColor(svToHex(hue, x, y));
                              };
                              update(e.nativeEvent);
                              const onMove = (ev: PointerEvent) => update(ev);
                              const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                              window.addEventListener('pointermove', onMove);
                              window.addEventListener('pointerup', onUp);
                            }}>
                            <div style={{ position: 'absolute', top: '6px', left: '6px', right: '6px', bottom: '6px', borderRadius: '3px', background: `linear-gradient(to right, white, hsl(${hexToHue(getActiveColor())}, 100%, 50%))` }} />
                            <div style={{ position: 'absolute', top: '6px', left: '6px', right: '6px', bottom: '6px', borderRadius: '3px', background: 'linear-gradient(to bottom, transparent, black)' }} />
                            {(() => {
                              const pos = hexToSvPos(getActiveColor());
                              return (
                                <div style={{ position: 'absolute', left: `calc(6px + ${pos.x} * (100% - 12px))`, top: `calc(6px + ${pos.y} * (100% - 12px))`, transform: 'translate(-50%, -50%)', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.5), inset 0 0 1px rgba(0,0,0,0.3)', pointerEvents: 'none', backgroundColor: getActiveColor() }} />
                              );
                            })()}
                          </div>
                          <div className="relative mt-1.5 rounded cursor-pointer" style={{ height: '14px', touchAction: 'none' }} data-testid={`hue-slider-${activeGradientStop}`}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                              setActiveColor(hueToHex(Math.round(x * 360)));
                            }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              const el = e.currentTarget;
                              el.setPointerCapture(e.pointerId);
                              const rect = el.getBoundingClientRect();
                              const update = (ev: PointerEvent) => {
                                const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                                setActiveColor(hueToHex(Math.round(x * 360)));
                              };
                              update(e.nativeEvent);
                              const onMove = (ev: PointerEvent) => update(ev);
                              const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                              window.addEventListener('pointermove', onMove);
                              window.addEventListener('pointerup', onUp);
                            }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)', borderRadius: '3px' }} />
                            <div style={{ position: 'absolute', top: '-1px', left: `${(hexToHue(getActiveColor()) / 360) * 100}%`, transform: 'translateX(-50%)', width: '4px', height: '16px', background: 'white', borderRadius: '2px', boxShadow: '0 0 3px rgba(0,0,0,0.5)', border: '1px solid rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <input type="color" value={getActiveColor()} onChange={(e) => setActiveColor(e.target.value)} className="w-5 h-5 rounded border border-white/30 cursor-pointer shrink-0" style={{ padding: 0, background: 'transparent', WebkitAppearance: 'none', appearance: 'none' }} data-testid={`input-edit-color-${activeGradientStop}`} />
                            <input type="text" value={getActiveColor().toUpperCase()} onChange={(e) => { let v = e.target.value; if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setActiveColor(v); }} className="flex-1 bg-white border border-gray-300 rounded text-black text-[9px] px-1.5 py-0.5 font-mono" style={{ minWidth: 0 }} data-testid={`input-hex-${activeGradientStop}`} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <label className="text-white text-[9px] mb-1">Border</label>
                      <div className="relative" style={{ width: '20px', height: '20px' }}>
                        <div className="absolute inset-0 rounded-sm border border-white/30" style={{ backgroundColor: editInfo.borderColor || editInfo.color }} />
                        <input type="color" value={editInfo.borderColor || editInfo.color} onChange={(e) => setEditInfo({...editInfo, borderColor: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: '20px', height: '20px' }} data-testid="input-border-color" />
                        {editInfo.borderColor && (
                          <button className="text-white/40 hover:text-white/70 absolute" style={{ top: '-4px', right: '-10px' }} onClick={() => setEditInfo({...editInfo, borderColor: ''})} title="Reset to auto">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                      <input type="text" value={editInfo.borderColor ? editInfo.borderColor.toUpperCase() : 'Auto'} onChange={e => { let v = e.target.value; if (v === '' || v === 'Auto') { setEditInfo({...editInfo, borderColor: ''}); return; } if (!v.startsWith('#')) v = '#' + v; setEditInfo({...editInfo, borderColor: v}); }} className="bg-white border border-gray-300 rounded text-black text-[8px] px-1 py-0.5 font-mono mt-1 text-center focus:outline-none focus:border-gray-400" style={{ width: '56px' }} data-testid="input-border-color-hex" />
                    </div>
                    <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <label className="text-white text-[9px] mb-1">Row BG</label>
                      <div className="relative" style={{ width: '20px', height: '20px' }}>
                        <div className="absolute inset-0 rounded-sm border border-white/30" style={{ backgroundColor: editInfo.courseRowColor || editInfo.color }} />
                        <input type="color" value={editInfo.courseRowColor || editInfo.color} onChange={(e) => setEditInfo({...editInfo, courseRowColor: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: '20px', height: '20px' }} data-testid="input-course-row-color" />
                        {editInfo.courseRowColor && (
                          <button className="text-white/40 hover:text-white/70 absolute" style={{ top: '-4px', right: '-10px' }} onClick={() => setEditInfo({...editInfo, courseRowColor: ''})} title="Reset to auto">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                      <input type="text" value={editInfo.courseRowColor ? editInfo.courseRowColor.toUpperCase() : 'Auto'} onChange={e => { let v = e.target.value; if (v === '' || v === 'Auto') { setEditInfo({...editInfo, courseRowColor: ''}); return; } if (!v.startsWith('#')) v = '#' + v; setEditInfo({...editInfo, courseRowColor: v}); }} className="bg-white border border-gray-300 rounded text-black text-[8px] px-1 py-0.5 font-mono mt-1 text-center focus:outline-none focus:border-gray-400" style={{ width: '56px' }} data-testid="input-course-row-color-hex" />
                    </div>
                    <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <label className="text-white text-[9px] mb-1">Task BG</label>
                      <div className="relative" style={{ width: '20px', height: '20px' }}>
                        <div className="absolute inset-0 rounded-sm border border-white/30" style={{ backgroundColor: editInfo.taskBgColor || `color-mix(in srgb, ${editInfo.color} 45%, white)` }} />
                        <input type="color" value={editInfo.taskBgColor || editInfo.color} onChange={(e) => setEditInfo({...editInfo, taskBgColor: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: '20px', height: '20px' }} data-testid="input-task-bg-color" />
                        {editInfo.taskBgColor && (
                          <button className="text-white/40 hover:text-white/70 absolute" style={{ top: '-4px', right: '-10px' }} onClick={() => setEditInfo({...editInfo, taskBgColor: ''})} title="Reset to auto">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                      <input type="text" value={editInfo.taskBgColor ? editInfo.taskBgColor.toUpperCase() : 'Auto'} onChange={e => { let v = e.target.value; if (v === '' || v === 'Auto') { setEditInfo({...editInfo, taskBgColor: ''}); return; } if (!v.startsWith('#')) v = '#' + v; setEditInfo({...editInfo, taskBgColor: v}); }} className="bg-white border border-gray-300 rounded text-black text-[8px] px-1 py-0.5 font-mono mt-1 text-center focus:outline-none focus:border-gray-400" style={{ width: '56px' }} data-testid="input-task-bg-color-hex" />
                    </div>
                    </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-1.5 text-[10px]">
                  <div className="flex items-center gap-1.5" style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                    <User className="h-3 w-3 text-white flex-shrink-0" />
                    <span className="text-white whitespace-nowrap">Professor:</span>
                    <span className="text-white truncate">{courseInfo.professor || "Not set"}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '12px auto 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end', marginLeft: '210px' }}>
                    <Mail className="h-3 w-3 text-white flex-shrink-0" style={{ justifySelf: 'end' }} />
                    <span className="text-white whitespace-nowrap" style={{ justifySelf: 'end' }}>Email:</span>
                    {courseInfo.professorEmail ? (
                      <a href={`mailto:${courseInfo.professorEmail}`} className="text-white hover:text-white/80 underline truncate" style={{ justifySelf: 'end' }} data-testid="link-professor-email">
                        {courseInfo.professorEmail}
                      </a>
                    ) : (
                      <span className="text-white" style={{ justifySelf: 'end' }}>Not set</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                    {courseInfo.deliveryMode === "virtual" ? <img src={zoomLogoPath} alt="Zoom" style={{ width: '38px', height: 'auto', filter: 'brightness(0) invert(1)' }} /> : courseInfo.deliveryMode === "online" ? <img src={wifiLogoPath} alt="Online" style={{ width: '14px', height: 'auto' }} /> : <Globe className="h-3 w-3 text-white" />}
                    <span className="text-white">Mode:</span>
                    <span className="text-white">{deliveryLabel}</span>
                  </div>
                  {courseInfo.courseType && (
                    <div style={{ display: 'grid', gridTemplateColumns: '12px auto 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end', marginLeft: '210px' }}>
                      <BookOpen className="h-3 w-3 text-white" style={{ justifySelf: 'end' }} />
                      <span className="text-white whitespace-nowrap" style={{ justifySelf: 'end' }}>Type:</span>
                      <span className="text-white" style={{ justifySelf: 'end' }}>{courseInfo.courseType === "core" ? "Core" : courseInfo.courseType === "open_elective" ? "Open Elective" : "Liberal Studies"}</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                    <GraduationCap className="h-3 w-3 text-white flex-shrink-0" />
                    <span className="text-white">Certificate:</span>
                    <span className="text-white text-[9px]">{certificateName || certificateType || '—'}</span>
                  </div>
                  {courseInfo.deliveryMode === "online" ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '12px auto 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end', marginLeft: '210px' }}>
                      <Clock className="h-3 w-3 text-white flex-shrink-0" style={{ justifySelf: 'end' }} />
                      <span className="text-white" style={{ justifySelf: 'end' }}>Modules:</span>
                      <span className="text-white" style={{ justifySelf: 'end' }}>Weekly</span>
                    </div>
                  ) : (() => {
                    const fmt = (t: string) => { const [h,m] = t.split(':').map(Number); const p = h >= 12 ? 'PM' : 'AM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${m.toString().padStart(2,'0')} ${p}`; };
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '12px auto 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end', marginLeft: '210px' }}>
                        <Calendar className="h-3 w-3 text-white flex-shrink-0" style={{ justifySelf: 'end' }} />
                        <span className="text-white" style={{ justifySelf: 'end' }}>Schedule:</span>
                        <span className="text-white capitalize" style={{ justifySelf: 'end' }}>
                          {courseInfo.classDay
                            ? `${courseInfo.classDay}${courseInfo.classTime ? ` ${fmt(courseInfo.classTime)}` : ""}${courseInfo.classEndTime ? `–${fmt(courseInfo.classEndTime)}` : ""}`
                            : "Not set"}
                        </span>
                      </div>
                    );
                  })()}
                  {(courseInfo.startDate || courseInfo.endDate) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                      <Calendar className="h-3 w-3 text-white flex-shrink-0" />
                      <span className="text-white">Dates:</span>
                      <span className="text-white">
                        {courseInfo.startDate ? new Date(courseInfo.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        {' – '}
                        {courseInfo.endDate ? new Date(courseInfo.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                  )}
                  {courseInfo.deliveryMode !== "online" && (() => {
                    const isSpSu = courseInfo.semesterTerm?.startsWith('spring_summer');
                    if (!isSpSu) return null;
                    const fmt = (t: string) => { const [h,m] = t.split(':').map(Number); const p = h >= 12 ? 'PM' : 'AM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${m.toString().padStart(2,'0')} ${p}`; };
                    return (
                      <>
                        <div />
                        <div style={{ display: 'grid', gridTemplateColumns: '12px auto 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end', marginLeft: '100px' }}>
                          <Calendar className="h-3 w-3 text-white flex-shrink-0" style={{ justifySelf: 'end' }} />
                          <span className="text-white" style={{ justifySelf: 'end' }}>Day 2:</span>
                          <span className="text-white capitalize" style={{ justifySelf: 'end' }}>
                            {courseInfo.classDay2
                              ? `${courseInfo.classDay2}${courseInfo.classTime2 ? ` ${fmt(courseInfo.classTime2)}` : (courseInfo.classTime ? ` ${fmt(courseInfo.classTime)}` : "")}${courseInfo.classEndTime2 ? `–${fmt(courseInfo.classEndTime2)}` : (courseInfo.classEndTime ? `–${fmt(courseInfo.classEndTime)}` : "")}`
                              : "Not set"}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {courseInfo.zoomLink && (
                  <a
                    href={courseInfo.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-white hover:text-white/80 bg-white/10 border border-white/20 rounded px-2 py-1.5"
                    style={{ maxWidth: '50%' }}
                    data-testid="link-zoom"
                  >
                    <img src={zoomLogoPath} alt="Zoom" style={{ width: '38px', height: 'auto', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
                    <span className="truncate">{courseInfo.zoomLink}</span>
                    <ExternalLink className="h-2.5 w-2.5 ml-auto flex-shrink-0" />
                  </a>
                )}
              </>
            )}
          </div>
          <div style={{ height: '10px' }} />

          {syllabusData && Object.keys(syllabusItemStates).length > 0 && (
            <div className="mx-3 mb-2 border border-emerald-400/30 rounded-lg overflow-hidden" data-testid="syllabus-review-panel">
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-900/30 border-b border-emerald-400/20">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-white font-medium">Syllabus Review</span>
                  <span className="text-[8px] text-white/60">
                    {Object.values(syllabusItemStates).filter(s => s.accepted === true).length} accepted ·{' '}
                    {Object.values(syllabusItemStates).filter(s => s.accepted === null).length} pending
                  </span>
                </div>
                <button onClick={() => { setSyllabusData(null); setSyllabusItemStates({}); }} className="text-white/60 hover:text-white text-[9px]" data-testid="button-dismiss-syllabus-review">
                  Dismiss
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}>

                {syllabusData.weekNumbering && syllabusItemStates[-1] && syllabusItemStates[-1].accepted === null && (
                  <div className="px-3 py-2 border-b border-white/10 bg-amber-900/15" data-testid="syllabus-week-numbering">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="h-3 w-3 text-amber-400" />
                      <span className="text-[10px] text-white font-medium">Week Numbering Style</span>
                    </div>
                    <p className="text-[9px] text-white/70 mb-1.5">
                      Detected: <span className="text-white font-medium">{syllabusData.weekNumbering.style === 'skip_break' ? 'Skips break week number' : syllabusData.weekNumbering.style === 'include_break' ? 'Counts break as a numbered week' : 'Continuous numbering'}</span>
                      {syllabusData.weekNumbering.breakWeekLabel && <> · Break label: "{syllabusData.weekNumbering.breakWeekLabel}"</>}
                    </p>
                    {syllabusData.weekNumbering.evidence && (
                      <p className="text-[8px] text-white/50 mb-2 italic">"{syllabusData.weekNumbering.evidence}"</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAcceptWeekNumbering(syllabusData.weekNumbering.style)}
                        className="h-5 px-2 text-[8px] bg-green-600/30 hover:bg-green-600/50 text-white border border-green-400/30 rounded flex items-center gap-1"
                        data-testid="button-accept-week-style"
                      >
                        <Check className="h-2.5 w-2.5" /> Accept
                      </button>
                      <button
                        onClick={() => {
                          setWeekStyleChoice(syllabusData.weekNumbering.style);
                          handleDeclineSyllabusItem(-1);
                        }}
                        className="h-5 px-2 text-[8px] bg-red-600/20 hover:bg-red-600/30 text-white border border-red-400/20 rounded flex items-center gap-1"
                        data-testid="button-decline-week-style"
                      >
                        <X className="h-2.5 w-2.5" /> Decline
                      </button>
                    </div>
                  </div>
                )}

                {syllabusData.weekNumbering && syllabusItemStates[-1] && syllabusItemStates[-1].accepted === false && weekStyleChoice !== null && (
                  <div className="px-3 py-2 border-b border-white/10 bg-amber-900/15" data-testid="syllabus-week-numbering-choose">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Calendar className="h-3 w-3 text-amber-400" />
                      <span className="text-[10px] text-white font-medium">Choose Week Numbering</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {['skip_break', 'include_break', 'continuous'].filter(s => s !== weekStyleChoice).map(style => (
                        <button
                          key={style}
                          onClick={() => { handleAcceptWeekNumbering(style); setWeekStyleChoice(null); }}
                          className="h-6 px-2 text-[9px] bg-white/5 hover:bg-white/10 text-white border border-white/15 rounded flex items-center gap-2 text-left"
                          data-testid={`button-week-style-${style}`}
                        >
                          <span className="font-medium">{style === 'skip_break' ? 'Skip break number' : style === 'include_break' ? 'Count break as week' : 'Continuous 1-13'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {syllabusData.courseInfo?.description && (
                  <div className="px-3 py-1.5 border-b border-white/10 bg-white/3">
                    <p className="text-[9px] text-white/60 italic">{syllabusData.courseInfo.description}</p>
                  </div>
                )}

                {(() => {
                  const items = [
                    ...(syllabusData.items || []).map((item: any, i: number) => ({ ...item, _idx: i, _source: 'item' })),
                    ...(syllabusData.gradingBreakdown || []).map((g: any, i: number) => ({ title: g.component, weight: g.weight, description: g.description, type: 'other', category: 'grading', _idx: i + 1000, _source: 'grading' })),
                  ];
                  return items.map((item: any) => {
                    const state = syllabusItemStates[item._idx];
                    if (!state) return null;
                    const isAccepted = state.accepted === true;
                    const isDeclined = state.accepted === false;
                    const isEditing = state.editing;
                    const edits = state.edits;

                    return (
                      <div
                        key={item._idx}
                        className={`px-3 py-1.5 border-b border-white/8 flex items-start gap-2 transition-colors ${isAccepted ? 'bg-green-900/10 opacity-60' : isDeclined ? 'bg-red-900/10 opacity-40' : 'hover:bg-white/5'}`}
                        data-testid={`syllabus-item-${item._idx}`}
                      >
                        <div className="flex flex-col gap-0.5 mt-0.5 flex-shrink-0">
                          {!isAccepted && !isDeclined ? (
                            <>
                              <button
                                onClick={() => handleAcceptSyllabusItem(item._idx)}
                                className="w-4 h-4 rounded border border-green-400/40 bg-green-600/20 hover:bg-green-600/40 flex items-center justify-center transition-colors"
                                title="Accept"
                                data-testid={`button-accept-item-${item._idx}`}
                              >
                                <Check className="h-2.5 w-2.5 text-green-400" />
                              </button>
                              <button
                                onClick={() => handleDeclineSyllabusItem(item._idx)}
                                className="w-4 h-4 rounded border border-red-400/30 bg-red-600/15 hover:bg-red-600/30 flex items-center justify-center transition-colors"
                                title="Decline"
                                data-testid={`button-decline-item-${item._idx}`}
                              >
                                <X className="h-2.5 w-2.5 text-red-400" />
                              </button>
                            </>
                          ) : isAccepted ? (
                            <div className="w-4 h-4 rounded bg-green-600/30 flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-green-400" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded bg-red-600/20 flex items-center justify-center">
                              <X className="h-2.5 w-2.5 text-red-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                className="w-full h-5 text-[9px] bg-white/10 border border-white/20 rounded px-1.5 text-white"
                                value={edits.title || ''}
                                onChange={(e) => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], edits: { ...prev[item._idx].edits, title: e.target.value } } }))}
                                placeholder="Title"
                                data-testid={`input-edit-syllabus-title-${item._idx}`}
                              />
                              <div className="flex gap-1">
                                <input
                                  type="date"
                                  className="flex-1 h-5 text-[9px] bg-white/10 border border-white/20 rounded px-1.5 text-white"
                                  style={{ colorScheme: 'dark' }}
                                  value={edits.date || ''}
                                  onChange={(e) => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], edits: { ...prev[item._idx].edits, date: e.target.value } } }))}
                                  data-testid={`input-edit-syllabus-date-${item._idx}`}
                                />
                                <input
                                  type="time"
                                  className="w-20 h-5 text-[9px] bg-white/10 border border-white/20 rounded px-1.5 text-white"
                                  style={{ colorScheme: 'dark' }}
                                  value={edits.time || ''}
                                  onChange={(e) => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], edits: { ...prev[item._idx].edits, time: e.target.value } } }))}
                                  data-testid={`input-edit-syllabus-time-${item._idx}`}
                                />
                                <input
                                  className="w-14 h-5 text-[9px] bg-white/10 border border-white/20 rounded px-1.5 text-white text-center"
                                  value={edits.weight ?? ''}
                                  onChange={(e) => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], edits: { ...prev[item._idx].edits, weight: e.target.value ? parseFloat(e.target.value) : null } } }))}
                                  placeholder="Wt%"
                                  data-testid={`input-edit-syllabus-weight-${item._idx}`}
                                />
                              </div>
                              <textarea
                                className="w-full h-10 text-[8px] bg-white/10 border border-white/20 rounded px-1.5 py-1 text-white resize-none"
                                value={edits.description || ''}
                                onChange={(e) => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], edits: { ...prev[item._idx].edits, description: e.target.value } } }))}
                                placeholder="Description"
                                data-testid={`input-edit-syllabus-desc-${item._idx}`}
                              />
                              <button
                                onClick={() => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], editing: false } }))}
                                className="h-4 px-2 text-[8px] bg-white/10 hover:bg-white/20 text-white rounded"
                                data-testid={`button-done-edit-${item._idx}`}
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-white font-medium truncate">{edits.title || item.title}</span>
                                {item._source === 'grading' && (
                                  <span className="text-[7px] px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded">Grading</span>
                                )}
                                {edits.weight != null && (
                                  <span className="text-[8px] text-amber-400 flex-shrink-0">{edits.weight}%</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[8px] text-white/60">
                                {(edits.date || edits.dateDescription) && (
                                  <span>{edits.date || edits.dateDescription}</span>
                                )}
                                {edits.type && edits.type !== 'other' && (
                                  <span className="capitalize">{edits.type}</span>
                                )}
                              </div>
                              {edits.description && (
                                <p className="text-[8px] text-white/50 mt-0.5 line-clamp-2">{edits.description}</p>
                              )}
                            </>
                          )}
                        </div>

                        {!isAccepted && !isDeclined && !isEditing && (
                          <button
                            onClick={() => setSyllabusItemStates(prev => ({ ...prev, [item._idx]: { ...prev[item._idx], editing: true } }))}
                            className="flex-shrink-0 w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center mt-0.5 transition-colors"
                            title="Edit"
                            data-testid={`button-edit-item-${item._idx}`}
                          >
                            <Pencil className="h-2.5 w-2.5 text-white/50" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}

                {syllabusData.policies && syllabusData.policies.length > 0 && (
                  <div className="px-3 py-2 border-t border-white/15">
                    <div className="text-[9px] text-white/70 font-medium mb-1">Policies</div>
                    {syllabusData.policies.map((p: any, i: number) => (
                      <div key={i} className="text-[8px] text-white/50 mb-1">
                        <span className="text-white/70 font-medium">{p.title}:</span> {p.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ padding: `12px 12px 12px 12px`, marginTop: isEditingInfo ? 0 : '-21px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div ref={weekMappingsRef}>
            <div style={{ border: '2px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '12px' }}>
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => { const next = !showWeekMappings; setShowWeekMappings(next); if (next) setTimeout(() => { const el = weekMappingsRef.current; if (el) { const scrollParent = el.closest('.overflow-y-auto'); if (scrollParent) { scrollParent.scrollTo({ top: 0, behavior: 'smooth' }); } } }, 80); }}
              data-testid="button-toggle-week-mappings"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-white/70" />
                <h3 className="text-[11px] font-medium text-white uppercase">Weeks and Modules</h3>
                {(() => {
                  const confirmed = Object.values(weekMappingEdits).filter(v => v.confirmed).length;
                  const total = LAST_WEEK - FIRST_WEEK + 1;
                  return (
                    <span className={`text-[9px] ${confirmed === total ? 'text-green-400' : 'text-white/50'}`}>
                      {confirmed}/{total} confirmed
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1">
                {showWeekMappings ? <ChevronDown className="h-3 w-3 text-white/50" /> : <ChevronRight className="h-3 w-3 text-white/50" />}
              </div>
            </div>

            {showWeekMappings && (
              <div className="mt-2 bg-white/5 border border-white/15 rounded-lg p-3 space-y-1" data-testid="week-mappings-panel">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-white">Confirm each week follows the standard TMU academic calendar for this course</span>
                  <Button
                    size="sm"
                    onClick={confirmAllWeeks}
                    className="h-5 px-2 text-[8px] bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30"
                    data-testid="button-confirm-all-weeks"
                  >
                    <Check className="h-2.5 w-2.5 mr-1" />
                    Confirm All
                  </Button>
                </div>

                <div className="mb-3 border border-white/15 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <button
                    className="flex items-center gap-1.5 text-[9px] font-medium text-white hover:text-white/80 transition-colors w-full"
                    onClick={() => setShowWeekCalendar(!showWeekCalendar)}
                    data-testid="button-toggle-week-calendar"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Set Week 1 Start Date</span>
                    {courseWeek1Start && <span className="text-[8px] text-green-300 ml-1">({courseWeek1Start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>}
                    {showWeekCalendar ? <ChevronDown className="h-2.5 w-2.5 ml-auto" /> : <ChevronRight className="h-2.5 w-2.5 ml-auto" />}
                  </button>

                  {showWeekCalendar && (() => {
                    const month = weekCalendarMonth;
                    const year = month.getFullYear();
                    const mo = month.getMonth();
                    const firstDay = new Date(year, mo, 1).getDay();
                    const daysInMonth = new Date(year, mo + 1, 0).getDate();
                    const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                    const handleDayClick = (day: number) => {
                      const selected = new Date(year, mo, day);
                      const dayOfWeek = selected.getDay();
                      const saturdayOffset = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
                      const weekStart = new Date(year, mo, day + saturdayOffset);
                      setCourseWeek1Start(weekStart);

                      const newEdits = { ...weekMappingEdits };
                      let currentStart = new Date(weekStart);
                      let courseWeekNum = 1;
                      for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
                        const isExcluded = readingWeekVariable && readingWeekExclusions.has(w);
                        const weekEnd = new Date(currentStart);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        if (!isExcluded) {
                          newEdits[w] = {
                            ...(newEdits[w] || { confirmed: false, notes: '' }),
                            confirmed: true,
                            courseWeekLabel: `Week ${courseWeekNum}`,
                          };
                          courseWeekNum++;
                        } else {
                          newEdits[w] = {
                            ...(newEdits[w] || { confirmed: false, notes: '' }),
                            confirmed: true,
                            courseWeekLabel: 'Reading Week',
                          };
                        }
                        currentStart = new Date(weekEnd);
                        currentStart.setDate(currentStart.getDate() + 1);
                      }
                      setWeekMappingEdits(newEdits);
                      for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
                        saveWeekMapping(w, newEdits[w]);
                      }
                    };

                    const getWeekOfDay = (day: number) => {
                      if (!courseWeek1Start) return null;
                      const d = new Date(year, mo, day);
                      const diff = Math.floor((d.getTime() - courseWeek1Start.getTime()) / (7 * 24 * 60 * 60 * 1000));
                      if (diff < 0) return null;
                      return diff + FIRST_WEEK;
                    };

                    return (
                      <div className="mt-2" data-testid="week-calendar-picker">
                        <div className="flex items-center justify-between mb-2">
                          <button onClick={() => setWeekCalendarMonth(new Date(year, mo - 1, 1))} className="text-white/60 hover:text-white p-0.5" data-testid="week-cal-prev">
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-[13px] font-medium text-white">{monthName}</span>
                          <button onClick={() => setWeekCalendarMonth(new Date(year, mo + 1, 1))} className="text-white/60 hover:text-white p-0.5" data-testid="week-cal-next">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                          {dayLabels.map(d => <div key={d} className="text-[8px] text-white text-center font-medium">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const d = new Date(year, mo, day);
                            const dayNorm = new Date(year, mo, day);
                            dayNorm.setHours(0,0,0,0);
                            const w1 = courseWeek1Start ? new Date(courseWeek1Start) : null;
                            if (w1) w1.setHours(0,0,0,0);
                            const isWeek1Start = w1 && dayNorm.getTime() === w1.getTime();
                            const isInWeek1 = w1 && dayNorm >= w1 && dayNorm < new Date(w1.getTime() + 7 * 24 * 60 * 60 * 1000);
                            const weekIdx = getWeekOfDay(day);
                            const isExcludedWeek = weekIdx !== null && readingWeekExclusions.has(weekIdx);
                            return (
                              <button
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={`h-6 text-[11px] rounded transition-colors ${
                                  isWeek1Start ? 'bg-green-500 text-white font-bold' :
                                  isInWeek1 ? 'bg-green-500/30 text-white' :
                                  isExcludedWeek ? 'bg-amber-500/20 text-white' :
                                  'text-white hover:bg-white/15'
                                }`}
                                data-testid={`week-cal-day-${day}`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-[8px] text-white">
                          Click any day to set the Saturday of that week as Week 1 start. All subsequent weeks will be numbered automatically.
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-2 flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer" data-testid="checkbox-reading-week-variable">
                      <div
                        className="flex items-center justify-center border border-white/40 rounded-sm cursor-pointer"
                        style={{ width: '13px', height: '13px', background: readingWeekVariable ? 'white' : 'transparent' }}
                        onClick={() => {
                          const next = !readingWeekVariable;
                          setReadingWeekVariable(next);
                          if (!next) {
                            setReadingWeekExclusions(new Set());
                            setShowReadingWeekCalendar(false);
                          }
                        }}
                      >
                        {readingWeekVariable && <span style={{ color: 'black', fontSize: '9px', fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
                      </div>
                      <span className="text-[10px] text-white">Reading week variable</span>
                    </label>
                  </div>

                  {readingWeekVariable && (
                    <div className="mt-2">
                      <button
                        className="flex items-center gap-1 text-[8px] text-white/70 hover:text-white transition-colors"
                        onClick={() => setShowReadingWeekCalendar(!showReadingWeekCalendar)}
                        data-testid="button-toggle-reading-week-cal"
                      >
                        <Calendar className="h-2.5 w-2.5" />
                        <span>Select reading week</span>
                        {selectedReadingWeekStart && (
                          <span className="text-[8px] text-amber-300 ml-1">
                            ({selectedReadingWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(selectedReadingWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                          </span>
                        )}
                        {showReadingWeekCalendar ? <ChevronDown className="h-2.5 w-2.5 ml-auto" /> : <ChevronRight className="h-2.5 w-2.5 ml-auto" />}
                      </button>

                      {showReadingWeekCalendar && (() => {
                        const rwMonth = readingWeekCalMonth;
                        const rwYear = rwMonth.getFullYear();
                        const rwMo = rwMonth.getMonth();
                        const rwFirstDay = new Date(rwYear, rwMo, 1).getDay();
                        const rwDaysInMonth = new Date(rwYear, rwMo + 1, 0).getDate();
                        const rwMonthName = rwMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        const rwDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                        const handleReadingWeekDayClick = (day: number) => {
                          const selected = new Date(rwYear, rwMo, day);
                          const dayOfWeek = selected.getDay();
                          const satOffset = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
                          const rwStart = new Date(rwYear, rwMo, day + satOffset);
                          setSelectedReadingWeekStart(rwStart);

                          if (courseWeek1Start) {
                            const w1 = new Date(courseWeek1Start);
                            w1.setHours(12, 0, 0, 0);
                            rwStart.setHours(12, 0, 0, 0);
                            const diffMs = rwStart.getTime() - w1.getTime();
                            const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
                            const rwWeekNum = diffWeeks + FIRST_WEEK;

                            const next = new Set<number>();
                            if (rwWeekNum >= FIRST_WEEK && rwWeekNum <= LAST_WEEK) {
                              next.add(rwWeekNum);
                            }
                            setReadingWeekExclusions(next);

                            const newEdits = { ...weekMappingEdits };
                            let courseWeekNum = 1;
                            for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
                              const excl = next.has(w);
                              if (!excl) {
                                newEdits[w] = { ...(newEdits[w] || { confirmed: false, notes: '' }), confirmed: true, courseWeekLabel: `Week ${courseWeekNum}` };
                                courseWeekNum++;
                              } else {
                                newEdits[w] = { ...(newEdits[w] || { confirmed: false, notes: '' }), confirmed: true, courseWeekLabel: 'Reading Week' };
                              }
                            }
                            setWeekMappingEdits(newEdits);
                            for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) saveWeekMapping(w, newEdits[w]);
                          }
                        };

                        return (
                          <div className="mt-2" data-testid="reading-week-calendar-picker">
                            <div className="flex items-center justify-between mb-2">
                              <button onClick={() => setReadingWeekCalMonth(new Date(rwYear, rwMo - 1, 1))} className="text-white/60 hover:text-white p-0.5" data-testid="rw-cal-prev">
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-[13px] font-medium text-white">{rwMonthName}</span>
                              <button onClick={() => setReadingWeekCalMonth(new Date(rwYear, rwMo + 1, 1))} className="text-white/60 hover:text-white p-0.5" data-testid="rw-cal-next">
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-7 gap-0.5 mb-1">
                              {rwDayLabels.map(d => <div key={d} className="text-[8px] text-white text-center font-medium">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-0.5">
                              {Array.from({ length: rwFirstDay }, (_, i) => <div key={`re${i}`} />)}
                              {Array.from({ length: rwDaysInMonth }, (_, i) => {
                                const day = i + 1;
                                const dayDate = new Date(rwYear, rwMo, day);
                                dayDate.setHours(0, 0, 0, 0);
                                const rwSel = selectedReadingWeekStart ? new Date(selectedReadingWeekStart) : null;
                                if (rwSel) rwSel.setHours(0, 0, 0, 0);
                                const isRWStart = rwSel && dayDate.getTime() === rwSel.getTime();
                                const isInRW = rwSel && dayDate >= rwSel && dayDate < new Date(rwSel.getTime() + 7 * 24 * 60 * 60 * 1000);
                                return (
                                  <button
                                    key={day}
                                    onClick={() => handleReadingWeekDayClick(day)}
                                    className={`h-6 text-[11px] rounded transition-colors ${
                                      isRWStart ? 'bg-amber-500 text-white font-bold' :
                                      isInRW ? 'bg-amber-500/30 text-white' :
                                      'text-white hover:bg-white/15'
                                    }`}
                                    data-testid={`rw-cal-day-${day}`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-2 text-[8px] text-white">
                              Click any day to select the reading week. Weeks after the reading week will shift up by one in the course numbering.
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {Array.from({ length: LAST_WEEK - FIRST_WEEK + 1 }, (_, i) => i + FIRST_WEEK).map((weekNum) => {
                  const weekDates = getWeekDates(weekNum, semesterStart, readingWeekStart);
                  const weekStart = new Date(weekDates.start);
                  const weekEnd = new Date(weekDates.end);
                  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const dateRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
                  const edit = weekMappingEdits[weekNum] || { confirmed: false, courseWeekLabel: '', notes: '' };
                  const isConfirmed = edit.confirmed;
                  const hasCustomLabel = edit.courseWeekLabel && edit.courseWeekLabel !== '';
                  const effectiveRWStart = selectedReadingWeekStart || readingWeekStart;
                  const currentWeek = getWeekNumber(new Date(), semesterStart, effectiveRWStart);
                  const isCurrent = weekNum === currentWeek;

                  return (
                    <div
                      key={weekNum}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded ${isCurrent ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5'}`}
                      data-testid={`week-mapping-row-${weekNum}`}
                    >
                      <button
                        onClick={() => {
                          const newState = { ...edit, confirmed: !isConfirmed };
                          setWeekMappingEdits(prev => ({ ...prev, [weekNum]: newState }));
                          saveWeekMapping(weekNum, newState);
                        }}
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isConfirmed
                            ? 'bg-green-500/30 border-green-500/50 text-green-300'
                            : 'bg-white/5 border-white/20 text-white/30 hover:border-white/40'
                        }`}
                        data-testid={`button-confirm-week-${weekNum}`}
                      >
                        {isConfirmed && <Check className="h-3 w-3" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-medium ${isCurrent ? 'text-blue-300' : 'text-white'}`}>
                            Week {weekNum}
                          </span>
                          <span className="text-[8px] text-white">{dateRange}</span>
                          {isCurrent && <span className="text-[7px] px-1 py-0.5 bg-blue-500/20 text-blue-300 rounded">Current</span>}
                          {hasCustomLabel && (
                            <span className="text-[8px] px-1 py-0.5 bg-amber-500/15 text-amber-300 rounded">
                              Course: {edit.courseWeekLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleWeekFileUpload(weekNum, 'reading')}
                        disabled={weekUploadingState[`${weekNum}-reading`]}
                        className="flex-shrink-0 h-5 px-2.5 text-[9px] font-medium bg-white hover:bg-white/90 text-black border border-white/50 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                        data-testid={`button-upload-reading-${weekNum}`}
                      >
                        {weekUploadingState[`${weekNum}-reading`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Reading
                      </button>

                      <button
                        onClick={() => handleWeekFileUpload(weekNum, 'module')}
                        disabled={weekUploadingState[`${weekNum}-module`]}
                        className="flex-shrink-0 h-5 px-2.5 text-[9px] font-medium bg-white hover:bg-white/90 text-black border border-white/50 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                        data-testid={`button-upload-module-${weekNum}`}
                      >
                        {weekUploadingState[`${weekNum}-module`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Module
                      </button>

                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => { setCourseWeekCalendarOpen(courseWeekCalendarOpen === weekNum ? null : weekNum); setCourseWeekCalMonth(weekStart); }}
                          className="w-20 h-5 text-[8px] bg-white/10 border border-white/25 rounded px-1.5 text-white hover:border-white/40 flex items-center gap-1 transition-colors"
                          data-testid={`button-course-week-label-${weekNum}`}
                        >
                          <Calendar className="h-2.5 w-2.5 flex-shrink-0 text-white/50" />
                          <span className="truncate">{edit.courseWeekLabel || 'Set week'}</span>
                        </button>
                        {courseWeekCalendarOpen === weekNum && (
                          <div className="absolute right-0 top-6 z-50 bg-gray-900 border border-white/25 rounded-lg p-2 shadow-xl" style={{ width: '200px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1">
                              <button onClick={() => setCourseWeekCalMonth(new Date(courseWeekCalMonth.getFullYear(), courseWeekCalMonth.getMonth() - 1, 1))} className="text-white/50 hover:text-white p-0.5"><ChevronLeft className="h-3 w-3" /></button>
                              <span className="text-[9px] text-white font-medium">{courseWeekCalMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                              <button onClick={() => setCourseWeekCalMonth(new Date(courseWeekCalMonth.getFullYear(), courseWeekCalMonth.getMonth() + 1, 1))} className="text-white/50 hover:text-white p-0.5"><ChevronRight className="h-3 w-3" /></button>
                            </div>
                            <div className="grid grid-cols-7 gap-0.5 text-center">
                              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-[7px] text-white/40 font-medium py-0.5">{d}</div>)}
                              {(() => {
                                const yr = courseWeekCalMonth.getFullYear();
                                const mo = courseWeekCalMonth.getMonth();
                                const firstDow = new Date(yr, mo, 1).getDay();
                                const dim = new Date(yr, mo + 1, 0).getDate();
                                const cells = [];
                                for (let i = 0; i < firstDow; i++) cells.push(<div key={`e-${i}`} />);
                                for (let d = 1; d <= dim; d++) {
                                  const dt = new Date(yr, mo, d);
                                  const wn = getWeekNumber(dt, semesterStart, readingWeekStart);
                                  const isThisWeek = wn === weekNum;
                                  cells.push(
                                    <button
                                      key={d}
                                      className={`text-[8px] py-0.5 rounded transition-colors ${isThisWeek ? 'bg-blue-500/30 text-blue-200 font-bold' : 'text-white/70 hover:bg-white/10'}`}
                                      onClick={() => {
                                        const label = `Week ${weekNum}`;
                                        const newState = { ...edit, courseWeekLabel: label };
                                        setWeekMappingEdits(prev => ({ ...prev, [weekNum]: newState }));
                                        saveWeekMapping(weekNum, newState);
                                        setCourseWeekCalendarOpen(null);
                                      }}
                                    >{d}</button>
                                  );
                                }
                                return cells;
                              })()}
                            </div>
                            <div className="mt-1 flex gap-1">
                              <input
                                type="text"
                                placeholder="Custom label"
                                value={edit.courseWeekLabel}
                                onChange={(e) => setWeekMappingEdits(prev => ({ ...prev, [weekNum]: { ...edit, courseWeekLabel: e.target.value } }))}
                                onBlur={() => saveWeekMapping(weekNum, edit)}
                                className="flex-1 h-5 text-[8px] bg-white/10 border border-white/25 rounded px-1.5 text-white placeholder:text-white/40 focus:border-white/50 outline-none"
                                data-testid={`input-course-week-label-${weekNum}`}
                              />
                              <button onClick={() => setCourseWeekCalendarOpen(null)} className="text-[7px] text-white/50 hover:text-white px-1">Done</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Notes"
                        value={edit.notes}
                        onChange={(e) => {
                          setWeekMappingEdits(prev => ({ ...prev, [weekNum]: { ...edit, notes: e.target.value } }));
                        }}
                        onBlur={() => saveWeekMapping(weekNum, edit)}
                        className="w-20 h-5 text-[8px] bg-white/10 border border-white/25 rounded px-1.5 text-white placeholder:text-white/70 focus:border-white/50 outline-none"
                        data-testid={`input-week-notes-${weekNum}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          <div ref={assignmentsRef} style={{ marginTop: '-21px' }}>
            <div style={{ border: '2px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '12px' }}>
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => { const next = !showAssignments; setShowAssignments(next); if (next) setTimeout(() => { const el = assignmentsRef.current; if (el) { const scrollParent = el.closest('.overflow-y-auto'); if (scrollParent) { scrollParent.scrollTo({ top: 0, behavior: 'smooth' }); } else { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } }, 80); }}
              data-testid="button-toggle-assignments"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-3.5 w-3.5 text-white/70" />
                <h3 className="text-[11px] font-medium text-white uppercase">Assignments</h3>
                <span className="text-[9px] text-white">
                  {completedCount}/{courseTasks.length} done
                  {totalWeight > 0 && <span className="text-[11px] font-medium" style={{ color: totalWeight > 100 ? '#ef4444' : totalWeight < 100 ? '#f97316' : 'white' }}> · {totalWeight.toFixed(2)}% weight</span>}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {showAssignments && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setShowAddForm(!showAddForm); }}
                    className="px-2 text-[9px] bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    style={{ height: '19px', marginBottom: '5px' }}
                    data-testid="button-add-assignment"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
                {showAssignments ? <ChevronDown className="h-3 w-3 text-white/50" /> : <ChevronRight className="h-3 w-3 text-white/50" />}
              </div>
            </div>

            {showAssignments && (<>

            {showAddForm && (
              <div className="bg-white/5 border border-white/15 rounded-lg p-3 mb-3 space-y-2" data-testid="add-assignment-form">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Title *</Label>
                    <Input
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g. Midterm Exam"
                      className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                      data-testid="input-task-title"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Type</Label>
                    <select
                      value={newTask.type}
                      onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                      className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5"
                      data-testid="select-task-type"
                    >
                      {TASK_TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value} className="bg-gray-800">{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Due Date *</Label>
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="h-7 !text-[10px] text-white bg-white/10 border-white/15"
                      style={{ colorScheme: 'dark' }}
                      data-testid="input-task-due-date"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Due Time</Label>
                    <Input
                      type="time"
                      value={newTask.dueTime}
                      onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                      className="h-7 !text-[10px] text-white bg-white/10 border-white/15"
                      style={{ colorScheme: 'dark' }}
                      data-testid="input-task-due-time"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[9px] text-white mb-0.5 block">Description</Label>
                  <Input
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Optional description"
                    className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                    data-testid="input-task-description"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Grade Weight (%)</Label>
                    <Input
                      type="number"
                      value={newTask.gradeWeight}
                      onChange={(e) => setNewTask({ ...newTask, gradeWeight: e.target.value })}
                      placeholder="e.g. 20"
                      className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                      data-testid="input-task-weight"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Total Points</Label>
                    <Input
                      type="number"
                      value={newTask.gradeTotal}
                      onChange={(e) => setNewTask({ ...newTask, gradeTotal: e.target.value })}
                      placeholder="e.g. 100"
                      className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                      data-testid="input-task-total"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Score Earned</Label>
                    <Input
                      type="number"
                      value={newTask.gradeValue}
                      onChange={(e) => setNewTask({ ...newTask, gradeValue: e.target.value })}
                      placeholder="e.g. 85"
                      className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                      data-testid="input-task-value"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Reminder 1</Label>
                    <select
                      value={newTask.reminder1}
                      onChange={(e) => setNewTask({ ...newTask, reminder1: parseInt(e.target.value) })}
                      className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5"
                      data-testid="select-reminder-1"
                    >
                      {REMINDER_PRESETS.map((r) => (
                        <option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Reminder 2</Label>
                    <select
                      value={newTask.reminder2}
                      onChange={(e) => setNewTask({ ...newTask, reminder2: parseInt(e.target.value) })}
                      className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5"
                      data-testid="select-reminder-2"
                    >
                      {REMINDER_PRESETS.map((r) => (
                        <option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Reminder 3</Label>
                    <select
                      value={newTask.reminder3}
                      onChange={(e) => setNewTask({ ...newTask, reminder3: parseInt(e.target.value) })}
                      className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5"
                      data-testid="select-reminder-3"
                    >
                      {REMINDER_PRESETS.map((r) => (
                        <option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[9px] text-white mb-0.5 block">Reminder 4</Label>
                    <select
                      value={newTask.reminder4}
                      onChange={(e) => setNewTask({ ...newTask, reminder4: parseInt(e.target.value) })}
                      className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5"
                      data-testid="select-reminder-4"
                    >
                      {REMINDER_PRESETS.map((r) => (
                        <option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowAddForm(false); setNewTask(createEmptyTaskForm()); }}
                    className="h-7 text-[10px] text-white hover:text-white hover:bg-white/10"
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddTask}
                    disabled={createTaskMutation.isPending}
                    className="h-7 text-[10px] bg-white/20 hover:bg-white/30 text-white"
                    data-testid="button-save-assignment"
                  >
                    {createTaskMutation.isPending ? "Adding..." : "Add to Calendar"}
                  </Button>
                </div>
              </div>
            )}

            {courseTasks.length === 0 && !showAddForm && (
              <div className="text-center py-8 text-white/30 text-[10px]" data-testid="text-no-assignments">
                <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No assignments yet</p>
                <p className="mt-1">Click "Add" to create your first assignment</p>
              </div>
            )}

            {courseTasks.length > 0 && (() => {
              const SortIcon = ({ field }: { field: SortField }) => {
                if (sortField !== field) return null;
                return sortDir === 'asc' ? <ArrowUp className="h-2 w-2 inline ml-0.5" /> : <ArrowDown className="h-2 w-2 inline ml-0.5" />;
              };
              const hdrCls = (field: SortField) =>
                `cursor-pointer select-none hover:text-white/80 transition-colors ${sortField === field ? 'text-white/90' : ''}`;
              return (
                <div className="flex items-end px-1.5 py-1 text-[8px] font-bold text-white" style={{ margin: '0 4px', letterSpacing: '0' }}>
                  <div className="flex-shrink-0" style={{ width: '14px', marginRight: '10px' }} />
                  <div className="flex-shrink-0 flex justify-center" style={{ width: '16px', marginRight: '10px', overflow: 'visible' }}>
                    <span className="text-[8px] font-bold text-white" style={{ whiteSpace: 'nowrap' }}>Done</span>
                  </div>
                  <div className="flex-shrink-0 flex justify-center" style={{ width: '15px', marginLeft: '8px', marginRight: '10px', overflow: 'visible' }}>
                    <span className="text-[8px] font-bold text-white" style={{ whiteSpace: 'nowrap' }}>Assign</span>
                  </div>
                  <div className="flex-shrink-0 flex justify-center" style={{ width: '14px', marginLeft: '8px', marginRight: '4px', overflow: 'visible' }}>
                  </div>
                  <div className="flex-shrink-0 flex justify-center" style={{ width: '19px', marginLeft: '18px', marginRight: '10px', overflow: 'visible' }}>
                    <span className="text-[8px] font-bold text-white" style={{ whiteSpace: 'nowrap' }}>Comments</span>
                  </div>
                  <div className={`flex-1 min-w-0 ${hdrCls('title')}`} style={{ marginLeft: isEditingInfo ? '21px' : '21px' }} onClick={() => toggleSort('title')} data-testid="sort-title">Assignments<SortIcon field="title" />
                  </div>
                  <div className="flex items-end flex-shrink-0 text-white" style={{ gap: '10px', position: 'relative', left: isEditingInfo ? '-24px' : '-15px' }}>
                    <span className={`w-[33px] text-center leading-tight ${hdrCls('score')}`} onClick={() => toggleSort('score')} style={{ display: 'inline-flex', justifyContent: 'center', position: 'relative', left: isEditingInfo ? '-5px' : '-5px' }} data-testid="sort-score">
                      Score<SortIcon field="score" />
                    </span>
                    <span className={`w-[33px] text-center leading-tight ${hdrCls('total')}`} onClick={() => toggleSort('total')} style={{ display: 'inline-flex', justifyContent: 'center', position: 'relative', left: isEditingInfo ? '-5px' : '-4px' }} data-testid="sort-total">
                      Total<SortIcon field="total" />
                    </span>
                    <span className={`w-[33px] text-center leading-tight ${hdrCls('weight')}`} onClick={() => toggleSort('weight')} style={{ display: 'inline-flex', justifyContent: 'center', position: 'relative', left: isEditingInfo ? '-1px' : undefined }} data-testid="sort-weight">
                      Weight<SortIcon field="weight" />
                    </span>
                    <span className={`w-[33px] text-center leading-tight ${hdrCls('percent')}`} onClick={() => toggleSort('percent')} style={{ display: 'inline-flex', justifyContent: 'center' }} data-testid="sort-percent">
                      Percent<SortIcon field="percent" />
                    </span>
                  </div>
                  <div className="flex items-end flex-shrink-0" style={{ gap: '10px', marginLeft: isEditingInfo ? '-8px' : '1px' }}>
                    <div style={{ width: '24px', textAlign: 'center', lineHeight: '1.1' }}><span className="text-[8px] font-bold text-white">Grade<br/>Received</span></div>
                    <div style={{ width: '19px', textAlign: 'center', marginLeft: '6px' }}><span className="text-[8px] font-bold text-white">Copy</span></div>
                    <div style={{ width: '19px' }} />
                  </div>
                </div>
              );
            })()}

            {showGroupInput && (
              <div className="flex items-center gap-1 px-2 mb-1">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createGroup(); }}
                  placeholder="Group name..."
                  className="h-5 text-[9px] px-1.5 bg-white/10 border border-white/20 rounded text-white w-[120px]"
                  autoFocus
                  data-testid="input-group-name"
                />
                <button onClick={createGroup} className="text-[8px] text-white/60 hover:text-white px-1" data-testid="button-confirm-group">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => { setShowGroupInput(false); setNewGroupName(''); }} className="text-[8px] text-white/60 hover:text-white px-1">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex flex-col overflow-y-auto" style={{ gap: '5px', maxHeight: 'none', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }} data-testid="assignments-list">
              {allGroups.map(groupName => {
                const tasks = groupedTasks[groupName] || [];
                const isCollapsed = collapsedGroups.has(groupName);
                const groupWeight = tasks.reduce((s, t) => s + (t.gradeWeight || 0), 0);
                const groupValue = tasks.reduce((s, t) => s + (t.gradeValue || 0), 0);
                const groupTotal = tasks.reduce((s, t) => s + (t.gradeTotal || 0), 0);
                return (
                  <div key={groupName} className="rounded-md border border-white/15 overflow-hidden" data-testid={`group-${groupName}`}>
                    <div
                      className="flex items-center gap-1.5 px-2 py-1 bg-white/10 cursor-pointer select-none"
                      onClick={() => toggleGroupCollapse(groupName)}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => handleDropOnGroup(e, groupName)}
                      data-testid={`group-header-${groupName}`}
                    >
                      {isCollapsed ? <ChevronRight className="h-3 w-3 text-white/60" /> : <ChevronDown className="h-3 w-3 text-white/60" />}
                      <span className="text-[9px] font-semibold text-white flex-1">{groupName}</span>
                      <span className="text-[7px] text-white/50">{tasks.length} items · Wt: {groupWeight.toFixed(2)}%</span>
                      {groupTotal > 0 && <span className="text-[7px] text-white/50">· {((groupValue / groupTotal) * 100).toFixed(2)}%</span>}
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col" style={{ gap: '3px', padding: '3px' }}>
                        {tasks.map(task => renderAssignmentRow(task, groupName))}
                      </div>
                    )}
                  </div>
                );
              })}

              {ungroupedTasks.map(task => (
                <div key={`ungrouped-${task.id}`} style={{ padding: '0 4px' }}>
                  {renderAssignmentRow(task, null)}
                </div>
              ))}
            </div>
            {courseTasks.length > 0 && (
              <div className="flex items-center px-1.5 py-1.5 mt-1 rounded-md border border-amber-400/30 bg-amber-400/5" style={{ margin: '4px 4px 0 4px' }} data-testid="grade-totals-row">
                <div className="flex-shrink-0" style={{ width: '14px', marginRight: '10px' }} />
                <div className="flex-shrink-0" style={{ width: '16px', marginRight: '10px' }} />
                <div className="flex-shrink-0" style={{ width: '15px', marginLeft: '3px', marginRight: '10px' }} />
                <div className="flex-shrink-0" style={{ width: '14px', marginLeft: '8px', marginRight: '4px' }} />
                <div className="flex-shrink-0" style={{ width: '19px', marginLeft: '17px', marginRight: '10px' }} />
                <div className="flex-1 min-w-0 text-[11px] font-bold text-white" style={{ marginLeft: '25px' }}>Totals</div>
                <div className="flex items-center flex-shrink-0" style={{ gap: '10px', position: 'relative', left: isEditingInfo ? '-17px' : '-8px' }}>
                  <span className="text-[11px] font-bold w-[33px] text-center text-amber-400" data-testid="text-sum-value">
                    {(() => { const v = courseTasks.filter(t => !t.excludeFromGpa).reduce((s, t) => s + (t.gradeValue || 0), 0); return v ? v.toFixed(2) : '—'; })()}
                  </span>
                  <span className="text-[11px] font-bold w-[33px] text-center text-amber-400" data-testid="text-sum-total">
                    {(() => { const v = courseTasks.filter(t => !t.excludeFromGpa).reduce((s, t) => s + (t.gradeTotal || 0), 0); return v ? v.toFixed(2) : '—'; })()}
                  </span>
                  <span className={`text-[11px] font-bold w-[33px] text-center ${
                    totalWeight === 100 ? 'text-green-400' : totalWeight > 100 ? 'text-red-400' : 'text-amber-400'
                  }`} data-testid="text-sum-weight">
                    {totalWeight ? totalWeight.toFixed(2) : '—'}
                  </span>
                  <span className="w-[33px]" />
                </div>
                <div className="flex items-center flex-shrink-0" style={{ gap: '10px', marginLeft: isEditingInfo ? '1px' : '8px', visibility: 'hidden' }}>
                  <div style={{ width: '24px', height: '14px' }} />
                  <div style={{ padding: '2px', marginLeft: '6px' }}><div style={{ width: '15px', height: '15px' }} /></div>
                  <div style={{ padding: '2px' }}><div style={{ width: '15px', height: '15px' }} /></div>
                </div>
              </div>
            )}

          </>)}
          </div>
          </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/20 flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)', position: 'relative', zIndex: 10, opacity: expandedTaskId !== null ? 0.35 : 1, pointerEvents: expandedTaskId !== null ? 'none' : 'auto' }}>
          <div>
            {onDeleteCourse && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded hover:bg-white/15 transition-colors"
                data-testid="button-delete-course"
              >
                <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                if (onLiveColorChange) {
                  onLiveColorChange({
                    color: courseInfo.color || '#3b82f6',
                    colorEnd: courseInfo.colorEnd || courseInfo.color || '#3b82f6',
                    colorStops: courseInfo.colorStops || '',
                    borderColor: courseInfo.borderColor || '',
                    courseRowColor: courseInfo.courseRowColor || '',
                    taskBgColor: courseInfo.taskBgColor || '',
                  });
                }
                onClose();
              }}
              onPointerDown={(e) => { e.stopPropagation(); }}
              disabled={expandedTaskId !== null || isEditingInfo}
              className={`border transition-all duration-200 h-6 w-[110px] disabled:cursor-not-allowed ${!isEditingInfo && expandedTaskId === null ? '!border-white/30 text-white/70 hover:text-white hover:!border-white/50 hover:bg-transparent cursor-pointer' : '!border-white/10 text-white/20'}`}
              style={{ fontSize: '12px', pointerEvents: expandedTaskId !== null || isEditingInfo ? 'none' : 'auto', position: 'relative', zIndex: 99999 }}
              data-testid="button-cancel-course-detail"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (onSaveCourseInfo) {
                  const semKey = semesterKeyFromTermYear(editInfo.semesterTerm, editInfo.year);
                  onSaveCourseInfo({ ...editInfo, semesterKey: semKey || undefined, courseRank: editInfo.courseRank || undefined });
                }
                if (editInfo.professor?.trim()) {
                  fetch('/api/key-contacts/sync-professor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ professorName: editInfo.professor, professorEmail: editInfo.professorEmail, courseCode: courseInfo.courseCode }),
                  }).catch(() => {});
                }
                onClose();
              }}
              disabled={expandedTaskId !== null || isEditingInfo}
              className={`border transition-all duration-200 h-6 w-[110px] disabled:cursor-not-allowed ${!isEditingInfo && expandedTaskId === null ? '!border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent' : '!border-white/10 text-white/20'}`}
              style={{
                boxShadow: !isEditingInfo && expandedTaskId === null ? '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)' : 'none',
                fontSize: '12px'
              }}
              data-testid="button-save-course-detail"
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      {commentTarget && (
        <div
          className="fixed z-[10005] flex flex-col rounded-lg overflow-hidden"
          style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '320px', minHeight: '240px',
            background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), 4px 4px 0 rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid="comment-postit"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-400/50">
            <span className="text-[11px] font-bold text-amber-900 truncate flex-1">{commentTarget.label}</span>
            <button onClick={() => { saveComment(); setCommentTarget(null); }} className="text-amber-800 hover:text-amber-950 ml-2" data-testid="button-close-comment">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 p-2">
            {commentLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-amber-800" /></div>
            ) : (
              <textarea
                className="w-full h-[160px] bg-transparent text-[12px] text-amber-950 placeholder:text-amber-700/50 resize-none focus:outline-none"
                placeholder="Write your comments here..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                autoFocus
                data-testid="input-comment-text"
              />
            )}
          </div>
          <div className="flex items-center justify-end px-3 py-2 border-t border-amber-400/50">
            <button
              onClick={saveComment}
              disabled={commentSaving}
              className="text-[10px] font-bold px-3 py-1 rounded bg-amber-800 text-white hover:bg-amber-900 disabled:opacity-50"
              data-testid="button-save-comment"
            >
              {commentSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[10004] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowDeleteConfirm(false)}
          data-testid="delete-course-confirm-overlay"
        >
          <div
            className="rounded-lg overflow-hidden text-white w-[340px]"
            style={{
              background: 'linear-gradient(180deg, #1e1e2e 0%, #0d0d1a 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="delete-course-confirm-dialog"
          >
            <div className="px-5 py-4 border-b border-white/15 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold">Delete Course</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-white/80 leading-relaxed">
                Are you sure you want to delete <strong>{courseInfo.courseCode}</strong>? This will remove the course from your list.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-white/15">
              <button
                className="px-4 py-1.5 text-[11px] bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                onClick={() => setShowDeleteConfirm(false)}
                data-testid="button-cancel-delete-course"
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-[11px] bg-red-500/80 hover:bg-red-500 rounded text-white transition-colors"
                onClick={() => {
                  onDeleteCourse?.();
                  setShowDeleteConfirm(false);
                }}
                data-testid="button-confirm-delete-course"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
