import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import zoomLogoPath from "@assets/Zoom_1773653841562.png";
import wifiLogoPath from "@assets/Wifi_1773656687145.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { TASK_TYPES, getWeekNumber } from "@shared/schema";
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
  onSaveCourseInfo?: (updates: { professor?: string; professorEmail?: string; deliveryMode?: string; classDay?: string; classDay2?: string; classTime?: string; classEndTime?: string; zoomLink?: string; semesterTerm?: string; year?: string }) => void;
  onGradeCalculated?: (grade: string, percent: string) => void;
  onDeleteCourse?: () => void;
  semesterStart: Date;
  readingWeekStart: Date | null;
  certificateName?: string;
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

export function CourseDetailDialog({ courseInfo, onClose, onSaveCourseInfo, onGradeCalculated, onDeleteCourse, semesterStart, readingWeekStart, certificateName }: CourseDetailDialogProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskForm>(createEmptyTaskForm());
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
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
      .filter((t) => t.courseName === courseInfo.fullName && t.type !== 'class')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [allTasks, courseInfo.fullName]);

  const completedCount = courseTasks.filter((t) => t.isCompleted).length;
  const totalWeight = courseTasks.reduce((s, t) => s + (t.gradeWeight || 0), 0);

  const gradeCalc = useMemo(() => {
    const gradedTasks = courseTasks.filter(t => t.gradeWeight && t.gradeTotal && t.gradeValue !== null && t.gradeValue !== undefined);
    if (gradedTasks.length === 0) return null;
    let weightedSum = 0;
    let weightedTotal = 0;
    for (const t of gradedTasks) {
      const pct = (t.gradeValue! / t.gradeTotal!) * 100;
      weightedSum += pct * (t.gradeWeight! / 100);
      weightedTotal += t.gradeWeight!;
    }
    const currentPercent = weightedTotal > 0 ? (weightedSum / weightedTotal) * 100 : 0;
    const projectedPercent = weightedTotal > 0 ? weightedSum / (totalWeight > 0 ? totalWeight : weightedTotal) * 100 : 0;
    return {
      currentPercent: Math.round(currentPercent * 10) / 10,
      projectedPercent: Math.round(projectedPercent * 10) / 10,
      currentGrade: percentToLetterGrade(currentPercent),
      projectedGrade: percentToLetterGrade(projectedPercent),
      gradedWeight: weightedTotal,
      gradedCount: gradedTasks.length,
    };
  }, [courseTasks, totalWeight]);

  useEffect(() => {
    if (gradeCalc && onGradeCalculated) {
      onGradeCalculated(gradeCalc.currentGrade, String(gradeCalc.currentPercent));
    }
  }, [gradeCalc, onGradeCalculated]);

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
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Deleted", description: "Assignment removed." });
    },
  });

  const updateGradeValueMutation = useMutation({
    mutationFn: async ({ id, gradeValue }: { id: number; gradeValue: number | null }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, { gradeValue });
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
          background: 'var(--dialog-bg, linear-gradient(180deg, #3a8bbf 0%, color-mix(in srgb, #164a72 70%, black) 100%))',
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
            background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${courseInfo.color}cc 40%, ${courseInfo.colorEnd || courseInfo.color}bb 100%)`,
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
                      if (onSaveCourseInfo) {
                        onSaveCourseInfo(editInfo);
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
                  <label className="text-white text-[9px] mb-0.5 block">Zoom Link</label>
                  <input className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1.5 placeholder:text-white/25" value={editInfo.zoomLink} onChange={(e) => setEditInfo({...editInfo, zoomLink: e.target.value})} placeholder="https://zoom.us/..." data-testid="input-edit-zoom" />
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
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Day 1</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.classDay} onChange={(e) => setEditInfo({...editInfo, classDay: e.target.value})} data-testid="select-edit-day1">
                      <option value="" className="bg-gray-800">—</option>
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => <option key={d} value={d} className="bg-gray-800 capitalize">{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-[9px] mb-0.5 block">Day 2</label>
                    <select className="w-full h-6 text-[10px] bg-white/10 border border-white/15 text-white rounded px-1" value={editInfo.classDay2} onChange={(e) => setEditInfo({...editInfo, classDay2: e.target.value})} data-testid="select-edit-day2">
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
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-white" />
                    <span className="text-white">Professor:</span>
                    <span className="text-white">{courseInfo.professor || "Not set"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-white" />
                    <span className="text-white">Email:</span>
                    {courseInfo.professorEmail ? (
                      <a href={`mailto:${courseInfo.professorEmail}`} className="text-white hover:text-white/80 underline" data-testid="link-professor-email">
                        {courseInfo.professorEmail}
                      </a>
                    ) : (
                      <span className="text-white">Not set</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {courseInfo.deliveryMode === "virtual" ? <img src={zoomLogoPath} alt="Zoom" style={{ width: '38px', height: 'auto', filter: 'brightness(0) invert(1)' }} /> : courseInfo.deliveryMode === "online" ? <img src={wifiLogoPath} alt="Online" style={{ width: '14px', height: 'auto' }} /> : <Globe className="h-3 w-3 text-white" />}
                    <span className="text-white">Mode:</span>
                    <span className="text-white">{deliveryLabel}</span>
                  </div>
                  {courseInfo.courseType && (
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-white" />
                      <span className="text-white">Type:</span>
                      <span className="text-white">{courseInfo.courseType === "core" ? "Core" : courseInfo.courseType === "open_elective" ? "Open Elective" : "Liberal Studies"}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 col-span-2">
                    <GraduationCap className="h-3 w-3 text-white" />
                    <span className="text-white">Certificate:</span>
                    <span className="text-white text-[9px]">{certificateName || certificateType || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-white" />
                    <span className="text-white">Schedule:</span>
                    <span className="text-white capitalize">
                      {courseInfo.classDay
                        ? `${courseInfo.classDay}${courseInfo.classDay2 ? ` & ${courseInfo.classDay2}` : ""}${courseInfo.classTime ? ` ${courseInfo.classTime}` : ""}${courseInfo.classEndTime ? `–${courseInfo.classEndTime}` : ""}`
                        : "Not set"}
                    </span>
                  </div>
                  {courseInfo.deliveryMode === "online" && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-white" />
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
              </>
            )}
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-medium text-white">Assignments</h3>
                <span className="text-[9px] text-white">
                  {completedCount}/{courseTasks.length} done
                  {totalWeight > 0 && ` · ${totalWeight}% weight`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
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
                  <span className={`font-medium ${totalWeight === 100 ? "text-green-400" : totalWeight > 100 ? "text-red-400" : "text-amber-400"}`}>
                    {totalWeight}%{totalWeight === 100 ? " ✓" : totalWeight > 100 ? " !" : ""}
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

            <div className="space-y-1" data-testid="assignments-list">
              {courseTasks.map((task) => {
                const TypeIcon = TASK_TYPE_OPTIONS.find((t) => t.value === task.type)?.icon || FileText;
                const overdue = !task.isCompleted && isOverdue(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all ${
                      task.isCompleted
                        ? "bg-white/5 border-white/5 opacity-60"
                        : overdue
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-white/5 border-white/10 hover:bg-white/8"
                    }`}
                    data-testid={`assignment-row-${task.id}`}
                  >
                    <button
                      onClick={() => toggleTaskMutation.mutate({ id: task.id, isCompleted: !task.isCompleted })}
                      className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.isCompleted ? "bg-green-500 border-green-500" : "border-white/30 hover:border-white/50"
                      }`}
                      data-testid={`button-toggle-task-${task.id}`}
                    >
                      {task.isCompleted && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </button>
                    <TypeIcon className="h-3 w-3 text-white flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-medium truncate flex items-center gap-1 ${task.isCompleted ? "line-through text-white" : "text-white"}`}>
                        {task.title}
                        {task.attachments && task.attachments.length > 0 && (
                          <Paperclip className="h-2.5 w-2.5 text-blue-400 flex-shrink-0 inline" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[8px] text-white">
                        <span className={overdue ? "text-red-400" : ""}>
                          {formatDate(task.dueDate)} {formatTime(task.dueDate)}
                        </span>
                        {task.gradeWeight && <span>{task.gradeWeight}%</span>}
                        {task.gradeTotal && (
                          <span className={task.gradeValue !== null && task.gradeValue !== undefined ? 'text-emerald-400' : 'text-white/30'}>
                            {task.gradeValue !== null && task.gradeValue !== undefined ? `${task.gradeValue}/${task.gradeTotal}` : `—/${task.gradeTotal}`}
                          </span>
                        )}
                        <span className="capitalize">{task.type}</span>
                      </div>
                    </div>
                    {task.gradeTotal && (
                      <input
                        type="number"
                        className="w-10 h-5 text-[9px] text-center bg-white/10 border border-white/20 rounded text-white placeholder:text-white/20 flex-shrink-0"
                        placeholder="Score"
                        value={task.gradeValue ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          updateGradeValueMutation.mutate({ id: task.id, gradeValue: val });
                        }}
                        data-testid={`input-grade-value-${task.id}`}
                      />
                    )}
                    <button
                      onClick={() => deleteTaskMutation.mutate(task.id)}
                      className="flex-shrink-0 text-white/20 hover:text-red-400 transition-colors p-0.5"
                      data-testid={`button-delete-task-${task.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {gradeCalc && (
            <div className="mx-3 mb-3 p-3 rounded-lg border border-white/20" style={{ background: 'rgba(255,255,255,0.08)' }} data-testid="grade-calculator-box">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-semibold text-white">Grade Calculator</span>
                <span className="text-[8px] text-white ml-auto">{gradeCalc.gradedCount} graded · {gradeCalc.gradedWeight}% of {totalWeight || gradeCalc.gradedWeight}% weight</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="text-[8px] text-white mb-1">Current Grade</div>
                  <div className="text-lg font-bold text-white" data-testid="text-current-grade">{gradeCalc.currentGrade}</div>
                  <div className="text-[9px] text-white" data-testid="text-current-percent">{gradeCalc.currentPercent}%</div>
                </div>
                <div className="text-center p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="text-[8px] text-white mb-1">Projected Final</div>
                  <div className="text-lg font-bold text-white/70" data-testid="text-projected-grade">{gradeCalc.projectedGrade}</div>
                  <div className="text-[9px] text-white" data-testid="text-projected-percent">{gradeCalc.projectedPercent}%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/20 flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)', position: 'relative', zIndex: 10 }}>
          <div className="text-[9px] text-white">
            {courseTasks.length} assignment{courseTasks.length !== 1 ? "s" : ""} · {completedCount} completed
          </div>
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
