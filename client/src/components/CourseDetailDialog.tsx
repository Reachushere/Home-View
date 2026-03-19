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
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import zoomLogoPath from "@assets/Zoom2_1773776262533.png";
import wifiLogoPath from "@assets/Wifi_1773656687145.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { TASK_TYPES, getWeekNumber, REMINDER_OPTIONS, REPEAT_TYPES, REPEAT_INTERVAL_UNITS } from "@shared/schema";
import type { Task } from "@shared/schema";

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
  deliveryMode: string;
  classDay: string;
  classDay2?: string;
  classTime: string;
  classEndTime?: string;
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
  onSaveCourseInfo?: (updates: { professor?: string; professorEmail?: string; deliveryMode?: string; classDay?: string; classDay2?: string; classTime?: string; classEndTime?: string; zoomLink?: string; semesterTerm?: string; year?: string; color?: string; colorEnd?: string }) => void;
  onGradeCalculated?: (grade: string, percent: string) => void;
  onDeleteCourse?: () => void;
  onOpenEditTask?: (task: Task) => void;
  semesterStart: Date;
  readingWeekStart: Date | null;
  certificateName?: string;
  onPushUndo?: (action: { type: string; description: string; data: any }) => void;
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

function DebouncedGradeInput({ value, onSave, placeholder, testId }: { value: number | null | undefined; onSave: (val: number | null) => void; placeholder: string; testId: string }) {
  const fmt = (v: number | null | undefined) => v != null ? (Number.isInteger(v) ? v.toFixed(2) : String(v)) : '';
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
      className="w-[30px] h-5 text-[9px] text-center bg-white border border-white/30 rounded text-black placeholder:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      placeholder={placeholder}
      value={local}
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

export function CourseDetailDialog({ courseInfo, onClose, onSaveCourseInfo, onGradeCalculated, onDeleteCourse, onOpenEditTask, semesterStart, readingWeekStart, certificateName, onPushUndo }: CourseDetailDialogProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskForm>(createEmptyTaskForm());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [editTaskFields, setEditTaskFields] = useState<any>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
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
  const [showSyllabusViewer, setShowSyllabusViewer] = useState(false);
  const [syllabusViewerUrl, setSyllabusViewerUrl] = useState<string>('');
  const [weekStyleChoice, setWeekStyleChoice] = useState<string | null>(null);
  const { uploadFile, isUploading } = useUpload();
  const [editInfo, setEditInfo] = useState({
    professor: courseInfo.professor || '',
    professorEmail: courseInfo.professorEmail || '',
    deliveryMode: courseInfo.deliveryMode || '',
    classDay: courseInfo.classDay || '',
    classDay2: courseInfo.classDay2 || '',
    classTime: courseInfo.classTime || '',
    classEndTime: courseInfo.classEndTime || '',
    zoomLink: courseInfo.zoomLink || '',
    semesterTerm: courseInfo.semesterTerm || '',
    year: courseInfo.year || '',
    color: courseInfo.color || '#3b82f6',
    colorEnd: courseInfo.colorEnd || courseInfo.color || '#3b82f6',
  });

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
    return allTasks
      .filter((t) => t.courseName === courseInfo.fullName && t.type !== 'class' && t.type !== 'module')
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [allTasks, courseInfo.fullName]);

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
    if (sortField === 'manual') return courseTasks;
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
    return sorted;
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
    const gradedTasks = courseTasks.filter(t => t.gradeWeight && t.gradeTotal && t.gradeValue !== null && t.gradeValue !== undefined && (t.gradeValue !== 0 || t.isCompleted));
    if (gradedTasks.length === 0) return null;
    let weightedSum = 0;
    let weightedTotal = 0;
    let rawReceived = 0;
    let rawTotal = 0;
    for (const t of gradedTasks) {
      const pct = (t.gradeValue! / t.gradeTotal!) * 100;
      weightedSum += pct * (t.gradeWeight! / 100);
      weightedTotal += t.gradeWeight!;
      rawReceived += t.gradeValue!;
      rawTotal += t.gradeTotal!;
    }
    const currentPercent = weightedTotal > 0 ? (weightedSum / weightedTotal) * 100 : 0;
    const projectedPercent = weightedTotal > 0 ? weightedSum / (totalWeight > 0 ? totalWeight : weightedTotal) * 100 : 0;
    const rawPercent = rawTotal > 0 ? (rawReceived / rawTotal) * 100 : 0;
    return {
      currentPercent: Math.round(currentPercent * 100) / 100,
      projectedPercent: Math.round(projectedPercent * 100) / 100,
      rawPercent: Math.round(rawPercent * 100) / 100,
      currentGrade: percentToLetterGrade(currentPercent),
      projectedGrade: percentToLetterGrade(projectedPercent),
      gradedWeight: weightedTotal,
      gradedCount: gradedTasks.length,
    };
  }, [courseTasks, totalWeight]);

  const onGradeCalculatedRef = useRef(onGradeCalculated);
  onGradeCalculatedRef.current = onGradeCalculated;

  useEffect(() => {
    if (onGradeCalculatedRef.current && gradeCalc) {
      onGradeCalculatedRef.current(gradeCalc.currentGrade, String(gradeCalc.rawPercent));
    }
  }, [gradeCalc?.rawPercent, gradeCalc?.currentGrade]);

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
      return apiRequest("PATCH", `/api/tasks/${id}`, { isCompleted });
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
      const uploadResult = await uploadFile(file);
      if (!uploadResult) throw new Error("Upload failed");

      toast({ title: "Analyzing syllabus...", description: "AI is reading through the entire syllabus..." });

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
        throw new Error(err.error || "Failed to parse syllabus");
      }

      const parsed = await parseResp.json();
      setSyllabusData(parsed);

      setSyllabusObjectPath(uploadResult.objectPath);
      try {
        await fetch('/api/syllabus/paths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseCode: courseInfo.courseCode, objectPath: uploadResult.objectPath }),
        });
      } catch {}

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
        className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-md border transition-all ${
          isDragging ? "opacity-40 border-blue-400/50" :
          isDragOver ? "border-blue-400 bg-blue-400/10" :
          task.isCompleted ? "bg-white/5 border-white/5" :
          overdue ? "bg-red-500/10 border-red-500/20" :
          "bg-white/5 border-white/10 hover:bg-white/8"
        }`}
        data-testid={`assignment-row-${task.id}`}
      >
        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60" data-testid={`drag-handle-${task.id}`}>
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleTaskMutation.mutate({ id: task.id, isCompleted: !task.isCompleted, _task: task }); }}
          className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.isCompleted ? "bg-green-500 border-green-500" : "border-white/30 hover:border-white/50"
          }`}
          data-testid={`button-toggle-task-${task.id}`}
        >
          {task.isCompleted && <CheckCircle2 className="h-3 w-3 text-white" />}
        </button>
        <TypeIcon className={`h-3 w-3 flex-shrink-0 ${task.isCompleted ? "text-white/50" : "text-white"}`} />
        <div className="flex-1 min-w-0">
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
        <div className="flex items-center flex-shrink-0" style={{ gap: '6px' }} onClick={(e) => e.stopPropagation()}>
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
          <span className="text-[9px] text-white w-[30px] text-center" data-testid={`text-grade-percent-${task.id}`}>
            {task.gradeValue !== null && task.gradeValue !== undefined && task.gradeTotal ? `${((task.gradeValue / task.gradeTotal) * 100).toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
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
            className="flex-shrink-0 text-white/30 hover:text-blue-400 transition-colors p-0.5"
            title="Duplicate task"
            data-testid={`button-duplicate-task-${task.id}`}
          >
            <Copy className="h-3 w-3" />
          </button>
          {assignToGroup === task.id ? (
            <select
              className="h-5 text-[8px] bg-white/10 border border-white/20 rounded text-white px-0.5"
              value={task.assignmentGroup || ''}
              onChange={(e) => assignTaskToGroup(task.id, e.target.value || null)}
              autoFocus
              onBlur={() => setAssignToGroup(null)}
              data-testid={`select-group-${task.id}`}
            >
              <option value="">No Group</option>
              {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setAssignToGroup(task.id); }}
              className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors p-0.5"
              title="Assign to group"
              data-testid={`button-assign-group-${task.id}`}
            >
              <FolderPlus className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); deleteTaskMutation.mutate({ id: task.id, _task: task }); }}
            className="flex-shrink-0 text-white hover:text-red-400 transition-colors p-0.5"
            data-testid={`button-delete-task-${task.id}`}
          >
            <Trash2 className="h-3 w-3" />
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
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => { setExpandedTaskId(null); setEditTaskFields(null); }} className="h-7 text-[10px] text-white hover:text-white hover:bg-white/10" data-testid={`button-inline-cancel-${task.id}`}>Cancel</Button>
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
              className="h-7 text-[10px] bg-white/20 hover:bg-white/30 text-white"
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

  return createPortal(
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="course-detail-overlay"
    >
      <div
        className="flex flex-col text-white rounded-lg overflow-hidden"
        style={{
          width: "480px",
          maxWidth: "95vw",
          height: "88vh",
          background: 'linear-gradient(180deg, #3a8bbf 0%, color-mix(in srgb, #164a72 70%, black) 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.05)',
        }}
        data-testid="course-detail-dialog"
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg"
          style={{
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${editInfo.color || courseInfo.color}cc 40%, ${editInfo.colorEnd || courseInfo.colorEnd || courseInfo.color}bb 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="text-white flex-shrink-0" style={{ width: '15px', height: '15px' }} />
            <div className="min-w-0">
              <h2
                className="font-normal text-white truncate"
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}
                data-testid="text-course-title"
              >
                {courseInfo.courseCode} — {courseInfo.courseName}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-white flex-shrink-0">
            {courseInfo.deliveryMode === "virtual" ? (
              <span className="flex items-center gap-0.5"><img src={zoomLogoPath} alt="Zoom" style={{ width: '38px', height: 'auto', filter: 'brightness(0) invert(1)' }} /> Virtual</span>
            ) : courseInfo.deliveryMode === "online" ? (
              <span className="flex items-center gap-0.5"><img src={wifiLogoPath} alt="Online" style={{ width: '14px', height: 'auto' }} /> Online</span>
            ) : null}
            {courseInfo.courseType && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">
                {courseInfo.courseType === "core" ? "Core" : courseInfo.courseType === "open_elective" ? "Elective" : "Liberal Studies"}
              </span>
            )}
            {onDeleteCourse && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 rounded hover:bg-white/15 transition-colors"
                data-testid="button-delete-course"
              >
                <Trash2 className="w-3 h-3 text-white/60 hover:text-white" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}>
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white uppercase tracking-wider font-semibold">Course Info</span>
              {!isEditingInfo ? (
                <button
                  onClick={() => setIsEditingInfo(true)}
                  className="flex items-center gap-1 text-[9px] text-white hover:text-white transition-colors"
                  data-testid="button-edit-course-info"
                >
                  <Pencil className="w-2.5 h-2.5" />
                  Edit
                </button>
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
                        zoomLink: courseInfo.zoomLink || '',
                      });
                      setIsEditingInfo(false);
                    }}
                    className="text-[9px] text-white hover:text-white transition-colors px-1.5 py-0.5 rounded border border-white/20"
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
                        onSaveCourseInfo(editInfo);
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
                    className="flex items-center gap-0.5 text-[9px] text-emerald-400 hover:text-emerald-300 transition-colors px-1.5 py-0.5 rounded border border-emerald-500/30"
                    data-testid="button-save-edit-info"
                  >
                    <Check className="w-2.5 h-2.5" />
                    Save
                  </button>
                </div>
              )}
            </div>
            {isEditingInfo ? (
              <div className="space-y-2 text-[10px]">
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
                <div>
                  <label className="text-white text-[9px] mb-0.5 block">Zoom Link{editInfo.deliveryMode === 'virtual' && <span className="text-red-400 ml-0.5">*</span>}</label>
                  <input className={`w-full h-6 text-[10px] bg-white/10 text-white rounded px-1.5 placeholder:text-white/25 ${editInfo.deliveryMode === 'virtual' && !editInfo.zoomLink?.trim() ? 'border border-red-500/70' : 'border border-white/15'}`} value={editInfo.zoomLink} onChange={(e) => setEditInfo({...editInfo, zoomLink: e.target.value})} placeholder={editInfo.deliveryMode === 'virtual' ? "Required — https://zoom.us/..." : "https://zoom.us/..."} data-testid="input-edit-zoom" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Semester</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.semesterTerm} onChange={(e) => setEditInfo({...editInfo, semesterTerm: e.target.value})} data-testid="select-edit-semester-term">
                      <option value="" className="bg-gray-800">—</option>
                      <option value="fall" className="bg-gray-800">Fall</option>
                      <option value="winter" className="bg-gray-800">Winter</option>
                      <option value="spring_summer_full" className="bg-gray-800">Spring/Summer (Full)</option>
                      <option value="spring_summer_first" className="bg-gray-800">Spring/Summer (1st Half)</option>
                      <option value="spring_summer_second" className="bg-gray-800">Spring/Summer (2nd Half)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Year</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.year} onChange={(e) => setEditInfo({...editInfo, year: e.target.value})} data-testid="select-edit-year">
                      <option value="" className="bg-gray-800">—</option>
                      <option value="2026" className="bg-gray-800">2026</option>
                      <option value="2027" className="bg-gray-800">2027</option>
                      <option value="2028" className="bg-gray-800">2028</option>
                      <option value="2029" className="bg-gray-800">2029</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Delivery Mode</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.deliveryMode} onChange={(e) => setEditInfo({...editInfo, deliveryMode: e.target.value})} data-testid="select-edit-delivery">
                      <option value="" className="bg-gray-800">Not set</option>
                      <option value="virtual" className="bg-gray-800">Virtual (Live Zoom)</option>
                      <option value="online" className="bg-gray-800">Online (Async)</option>
                      <option value="in-person" className="bg-gray-800">In-Person</option>
                    </select>
                  </div>
                </div>
                <div className={`grid gap-2 ${editInfo.semesterTerm === 'Summer' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Day</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.classDay} onChange={(e) => setEditInfo({...editInfo, classDay: e.target.value})} data-testid="select-edit-day1">
                      <option value="" className="bg-gray-800">—</option>
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => <option key={d} value={d} className="bg-gray-800 capitalize">{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                    </select>
                  </div>
                  {editInfo.semesterTerm === 'Summer' && (
                    <div>
                      <label className="text-white text-[9px] mb-0.5 block">Day 2</label>
                      <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.classDay2} onChange={(e) => setEditInfo({...editInfo, classDay2: e.target.value})} data-testid="select-edit-day2">
                        <option value="" className="bg-gray-800">—</option>
                        {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => <option key={d} value={d} className="bg-gray-800 capitalize">{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Start</label>
                    <input type="time" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.classTime} onChange={(e) => setEditInfo({...editInfo, classTime: e.target.value})} data-testid="input-edit-start-time" />
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">End</label>
                    <input type="time" className="w-full h-6 text-[10px] bg-white/10 border border-white/15 rounded px-1" style={{ color: 'white', colorScheme: 'dark' }} value={editInfo.classEndTime} onChange={(e) => setEditInfo({...editInfo, classEndTime: e.target.value})} data-testid="input-edit-end-time" />
                  </div>
                </div>
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
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Course Colour</label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-white/60 text-[8px]">Start</label>
                        <input type="color" value={editInfo.color} onChange={(e) => setEditInfo({...editInfo, color: e.target.value})} className="w-7 h-7 rounded-full border border-white/30 cursor-pointer" style={{ padding: 0, background: 'transparent', WebkitAppearance: 'none', appearance: 'none' }} data-testid="input-edit-color-start" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-white/60 text-[8px]">End</label>
                        <input type="color" value={editInfo.colorEnd} onChange={(e) => setEditInfo({...editInfo, colorEnd: e.target.value})} className="w-7 h-7 rounded-full border border-white/30 cursor-pointer" style={{ padding: 0, background: 'transparent', WebkitAppearance: 'none', appearance: 'none' }} data-testid="input-edit-color-end" />
                      </div>
                      <div className="w-10 h-5 rounded-full" style={{ background: `linear-gradient(to right, ${editInfo.color}, ${editInfo.colorEnd})` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {syllabusObjectPath && (
                      <Paperclip className="h-3.5 w-3.5 text-white" data-testid="icon-syllabus-attached" />
                    )}
                    {syllabusObjectPath && (
                      <button
                        onClick={async () => {
                          setSyllabusObjectPath('');
                          try {
                            await fetch('/api/syllabus/paths', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ courseCode: courseInfo.courseCode, objectPath: '' }),
                            });
                          } catch {}
                          toast({ title: "Syllabus removed" });
                        }}
                        className="hover:opacity-70 transition-opacity"
                        data-testid="button-delete-syllabus"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white" />
                      </button>
                    )}
                    <label className={`cursor-pointer ${syllabusObjectPath ? 'opacity-40 pointer-events-none' : ''}`} data-testid="button-upload-syllabus">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleUploadSyllabus}
                        disabled={isParsingSyllabus || isUploading || !!syllabusObjectPath}
                      />
                      <div className={`h-6 px-2 text-[9px] bg-emerald-600/30 hover:bg-emerald-600/50 text-white border border-emerald-400/30 rounded-md flex items-center gap-1 transition-colors whitespace-nowrap ${isParsingSyllabus || isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isParsingSyllabus ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        {isParsingSyllabus ? 'Parsing...' : 'Add Syllabus'}
                      </div>
                    </label>
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
                  </div>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end' }}>
                    <Mail className="h-3 w-3 text-white flex-shrink-0" style={{ justifySelf: 'start' }} />
                    <span className="text-white whitespace-nowrap" style={{ justifySelf: 'start' }}>Email:</span>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center', justifyItems: 'end' }}>
                      <BookOpen className="h-3 w-3 text-white" style={{ justifySelf: 'start' }} />
                      <span className="text-white whitespace-nowrap" style={{ justifySelf: 'start' }}>Type:</span>
                      <span className="text-white" style={{ justifySelf: 'end' }}>{courseInfo.courseType === "core" ? "Core" : courseInfo.courseType === "open_elective" ? "Open Elective" : "Liberal Studies"}</span>
                    </div>
                  )}
                  <div className="col-span-2" style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                    <GraduationCap className="h-3 w-3 text-white flex-shrink-0" />
                    <span className="text-white">Certificate:</span>
                    <span className="text-white text-[9px]">{certificateName || certificateType || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                    <Calendar className="h-3 w-3 text-white flex-shrink-0" />
                    <span className="text-white">Schedule:</span>
                    <span className="text-white capitalize">
                      {courseInfo.classDay
                        ? `${courseInfo.classDay}${courseInfo.classDay2 ? ` & ${courseInfo.classDay2}` : ""}${courseInfo.classTime ? ` ${((t: string) => { const [h,m] = t.split(':').map(Number); const p = h >= 12 ? 'PM' : 'AM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${m.toString().padStart(2,'0')} ${p}`; })(courseInfo.classTime)}` : ""}${courseInfo.classEndTime ? `–${((t: string) => { const [h,m] = t.split(':').map(Number); const p = h >= 12 ? 'PM' : 'AM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${m.toString().padStart(2,'0')} ${p}`; })(courseInfo.classEndTime)}` : ""}`
                        : "Not set"}
                    </span>
                  </div>
                  {courseInfo.deliveryMode === "online" && (
                    <div style={{ display: 'grid', gridTemplateColumns: '12px 58px 1fr', gap: '6px', alignItems: 'center' }}>
                      <Clock className="h-3 w-3 text-white flex-shrink-0" />
                      <span className="text-white">Modules:</span>
                      <span className="text-white">Weekly (change every Saturday)</span>
                    </div>
                  )}
                </div>
                {courseInfo.zoomLink && (
                  <a
                    href={courseInfo.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-white hover:text-white/80 bg-white/10 border border-white/20 rounded px-2 py-1.5"
                    data-testid="link-zoom"
                  >
                    <img src={zoomLogoPath} alt="Zoom" style={{ width: '38px', height: 'auto', filter: 'brightness(0) invert(1)' }} />
                    <span className="truncate">{courseInfo.zoomLink}</span>
                    <ExternalLink className="h-2.5 w-2.5 ml-auto flex-shrink-0" />
                  </a>
                )}
                <div className="mt-1">
                  {syllabusObjectPath ? (
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3 w-3 text-emerald-400 shrink-0" data-testid="icon-syllabus-attached-view" />
                      <button
                        onClick={() => {
                          setSyllabusViewerUrl(`/api/syllabus/view?path=${encodeURIComponent(syllabusObjectPath)}`);
                          setShowSyllabusViewer(true);
                        }}
                        className="text-[10px] text-white underline hover:text-white/70 transition-colors"
                        data-testid="button-view-syllabus"
                      >
                        View Syllabus
                      </button>
                      <button
                        onClick={async () => {
                          setSyllabusObjectPath('');
                          try {
                            await fetch('/api/syllabus/paths', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ courseCode: courseInfo.courseCode, objectPath: '' }),
                            });
                          } catch {}
                          toast({ title: "Syllabus removed" });
                        }}
                        className="hover:opacity-70 transition-opacity"
                        data-testid="button-delete-syllabus-view"
                      >
                        <Trash2 className="h-3 w-3 text-red-400/70 hover:text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-white/40 italic" data-testid="text-no-syllabus">No syllabus uploaded — use Edit to add one</span>
                  )}
                </div>
              </>
            )}
          </div>

          {showSyllabusViewer && syllabusViewerUrl && (
            <div className="mx-3 mb-2 border border-white/20 rounded-lg overflow-hidden" data-testid="syllabus-viewer">
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-900/30 border-b border-white/15">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-white font-medium">Syllabus</span>
                </div>
                <button onClick={() => setShowSyllabusViewer(false)} className="text-white/60 hover:text-white" data-testid="button-close-syllabus-viewer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <iframe
                src={syllabusViewerUrl}
                className="w-full bg-white"
                style={{ height: '400px' }}
                title="Syllabus Viewer"
              />
            </div>
          )}

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

          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-medium text-white">Assignments</h3>
                <span className="text-[9px] text-white">
                  {completedCount}/{courseTasks.length} done
                  {totalWeight > 0 && ` · ${totalWeight.toFixed(2)}% weight`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="h-6 px-2 text-[9px] bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  data-testid="button-add-assignment"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {totalWeight > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 text-[9px] mb-1">
                  <span className="text-white">Grade Weight</span>
                  <span className={`font-medium ${Math.abs(totalWeight - 100) < 0.005 ? "text-green-400" : totalWeight > 100 ? "text-red-400" : "text-amber-400"}`}>
                    {totalWeight.toFixed(2)}%{Math.abs(totalWeight - 100) < 0.005 ? " ✓" : totalWeight > 100 ? " !" : ""}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(totalWeight, 100)}%`,
                      backgroundColor: totalWeight === 100 ? "#22c55e" : totalWeight > 100 ? "#ef4444" : "#f59e0b",
                    }}
                  />
                </div>
              </div>
            )}

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
                <div className="flex items-center gap-1.5 px-1.5 py-1 text-[7px] text-white/60 uppercase tracking-wider">
                  <div className="flex-shrink-0" style={{ width: '14px' }} />
                  <div className="flex-shrink-0 w-4" />
                  <div className="flex-shrink-0 w-3" />
                  <div className={`flex-1 min-w-0 ${hdrCls('title')}`} onClick={() => toggleSort('title')} data-testid="sort-title">
                    Assignment<SortIcon field="title" />
                  </div>
                  <div className="flex items-end flex-shrink-0" style={{ gap: '6px' }}>
                    <span className={`w-[30px] text-center leading-tight ${hdrCls('score')}`} onClick={() => toggleSort('score')} style={{ display: 'inline-flex', justifyContent: 'center' }} data-testid="sort-score">
                      Score<br/>received<SortIcon field="score" />
                    </span>
                    <span className={`w-[30px] text-center leading-tight ${hdrCls('total')}`} onClick={() => toggleSort('total')} data-testid="sort-total">
                      Total<SortIcon field="total" />
                    </span>
                    <span className={`w-[30px] text-center leading-tight ${hdrCls('weight')}`} onClick={() => toggleSort('weight')} data-testid="sort-weight">
                      Wt%<SortIcon field="weight" />
                    </span>
                    <span className={`w-[30px] text-center leading-tight ${hdrCls('percent')}`} onClick={() => toggleSort('percent')} data-testid="sort-percent">
                      %<SortIcon field="percent" />
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <div className="p-0.5"><div className="w-3" /></div>
                    <div className="p-0.5"><div className="w-3" /></div>
                  </div>
                </div>
              );
            })()}

            {courseTasks.length > 0 && (
              <div className="flex items-center gap-1 px-2 mb-1">
                <button
                  onClick={() => setShowGroupInput(!showGroupInput)}
                  className="flex items-center gap-1 text-[8px] text-white/50 hover:text-white/80 transition-colors"
                  data-testid="button-create-group"
                >
                  <FolderPlus className="h-3 w-3" />
                  <span>New Group</span>
                </button>
                {showGroupInput && (
                  <div className="flex items-center gap-1 ml-1">
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
              </div>
            )}

            <div className="flex flex-col" style={{ gap: '5px' }} data-testid="assignments-list">
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

              {ungroupedTasks.map(task => renderAssignmentRow(task, null))}
            </div>
            {courseTasks.length > 0 && (
              <div className="flex items-center gap-1.5 px-1.5 py-1.5 mt-1 rounded-md border border-white/20 bg-white/10" data-testid="grade-totals-row">
                <div className="flex-shrink-0" style={{ width: '14px' }} />
                <div className="w-4 flex-shrink-0" />
                <div className="w-3 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-[9px] font-semibold text-white">Totals</div>
                <div className="flex items-center flex-shrink-0" style={{ gap: '6px' }}>
                  <span className="text-[9px] font-semibold text-white w-[30px] text-center" data-testid="text-sum-value">
                    {(() => { const v = courseTasks.reduce((s, t) => s + (t.gradeValue || 0), 0); return v ? v.toFixed(2) : '—'; })()}
                  </span>
                  <span className="text-[9px] font-semibold text-white w-[30px] text-center" data-testid="text-sum-total">
                    {(() => { const v = courseTasks.reduce((s, t) => s + (t.gradeTotal || 0), 0); return v ? v.toFixed(2) : '—'; })()}
                  </span>
                  <span className={`text-[9px] font-semibold w-[30px] text-center ${
                    totalWeight === 100 ? 'text-green-400' : totalWeight > 100 ? 'text-red-400' : 'text-amber-400'
                  }`} data-testid="text-sum-weight">
                    {totalWeight ? totalWeight.toFixed(2) : '—'}
                  </span>
                  <span className={`text-[9px] font-semibold w-[30px] text-center ${
                    (() => {
                      const sumTotal = courseTasks.reduce((s, t) => s + (t.gradeTotal || 0), 0);
                      const sumValue = courseTasks.reduce((s, t) => s + (t.gradeValue || 0), 0);
                      return sumTotal > 0 && sumValue > 0 ? 'text-emerald-400' : 'text-white/50';
                    })()
                  }`} data-testid="text-total-percent">
                    {(() => {
                      const sumTotal = courseTasks.reduce((s, t) => s + (t.gradeTotal || 0), 0);
                      const sumValue = courseTasks.reduce((s, t) => s + (t.gradeValue || 0), 0);
                      return sumTotal > 0 ? `${((sumValue / sumTotal) * 100).toFixed(2)}%` : '—';
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <div className="p-0.5"><div className="w-3" /></div>
                  <div className="p-0.5"><div className="w-3" /></div>
                </div>
              </div>
            )}
          </div>

          {gradeCalc && (
            <div className="mx-3 mb-3 p-3 rounded-lg border border-white/20" style={{ background: 'rgba(255,255,255,0.08)' }} data-testid="grade-calculator-box">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-semibold text-white">Grade Calculator</span>
                <span className="text-[8px] text-white ml-auto">{gradeCalc.gradedCount} graded · {gradeCalc.gradedWeight.toFixed(2)}% of {(totalWeight || gradeCalc.gradedWeight).toFixed(2)}% weight</span>
              </div>
              <div className="text-center p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="text-[8px] text-white mb-1">Current Grade</div>
                <div className="text-lg font-bold text-white" data-testid="text-current-grade">{gradeCalc.currentGrade}</div>
                <div className="text-[9px] text-white" data-testid="text-current-percent">{gradeCalc.currentPercent.toFixed(2)}%</div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/20 flex items-center justify-end flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)', position: 'relative', zIndex: 10 }}>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              onPointerDown={(e) => { e.stopPropagation(); }}
              className="border !border-white/30 text-white/70 hover:text-white hover:!border-white/50 hover:bg-transparent transition-all duration-200 h-6 w-[110px] cursor-pointer"
              style={{ fontSize: '12px', pointerEvents: 'auto', position: 'relative', zIndex: 99999 }}
              data-testid="button-cancel-course-detail"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (onSaveCourseInfo) {
                  onSaveCourseInfo(editInfo);
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
              className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-all duration-200 h-6 w-[110px]"
              style={{
                boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                fontSize: '12px'
              }}
              data-testid="button-save-course-detail"
            >
              Save
            </Button>
          </div>
        </div>
      </div>

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
