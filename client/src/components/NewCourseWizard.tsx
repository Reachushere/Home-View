import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
  Bell,
  BookOpen,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Vote,
  AlertCircle,
} from "lucide-react";
import { REMINDER_OPTIONS, TASK_TYPES } from "@shared/schema";

const WIZARD_STEPS = [
  { id: 1, label: "Course Info" },
  { id: 2, label: "Professor" },
  { id: 3, label: "Course Type" },
  { id: 4, label: "Semester" },
  { id: 5, label: "Tasks & Grades" },
  { id: 6, label: "Review" },
];

const COURSE_TYPES = [
  { value: "core", label: "Core Course", description: "Required for your program" },
  { value: "open_elective", label: "Open Elective", description: "Elective of your choice" },
  { value: "liberal_studies", label: "Liberal Studies", description: "General education requirement" },
];

const TASK_TYPE_OPTIONS = [
  { value: "reading", label: "Reading" },
  { value: "essay", label: "Essay" },
  { value: "exam", label: "Exam" },
  { value: "quiz", label: "Quiz" },
  { value: "discussion", label: "Discussion Post" },
  { value: "poll", label: "Review Poll" },
  { value: "project", label: "Project" },
  { value: "module", label: "Module" },
  { value: "class", label: "Class" },
  { value: "other", label: "Other" },
];

interface WizardTask {
  title: string;
  type: string;
  dueDate: string;
  dueTime: string;
  description: string;
  reminder1: number;
  reminder2: number;
  reminder3: number;
  reminder4: number;
  gradeWeight: number | null;
  gradeTotal: number | null;
}

interface WizardData {
  courseCode: string;
  courseName: string;
  professorName: string;
  professorEmail: string;
  courseType: string;
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
  tasks: WizardTask[];
}

interface NewCourseWizardProps {
  onSave: (data: WizardData) => void;
  onClose: () => void;
  existingSemesterType?: string;
}

const COLORS = [
  "#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EF4444", "#14B8A6", "#F97316", "#06B6D4",
];

const DAY_OPTIONS = [
  { value: "", label: "None" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

function createEmptyTask(): WizardTask {
  return {
    title: "",
    type: "reading",
    dueDate: "",
    dueTime: "",
    description: "",
    reminder1: 30,
    reminder2: 120,
    reminder3: 0,
    reminder4: 0,
    gradeWeight: null,
    gradeTotal: null,
  };
}

export function NewCourseWizard({ onSave, onClose, existingSemesterType }: NewCourseWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    courseCode: "",
    courseName: "",
    professorName: "",
    professorEmail: "",
    courseType: "core",
    color: "#6366F1",
    semesterType: existingSemesterType || "winter",
    deliveryMode: "",
    classDay: "",
    classDay2: "",
    classTime: "",
    classEndTime: "",
    startDate: "",
    endDate: "",
    springSummerTerm: "full",
    tasks: [],
  });

  const updateField = <K extends keyof WizardData>(field: K, value: WizardData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const addTask = () => {
    setData(prev => ({ ...prev, tasks: [...prev.tasks, createEmptyTask()] }));
  };

  const updateTask = (index: number, field: keyof WizardTask, value: any) => {
    setData(prev => {
      const tasks = [...prev.tasks];
      tasks[index] = { ...tasks[index], [field]: value };
      return { ...prev, tasks };
    });
  };

  const removeTask = (index: number) => {
    setData(prev => ({ ...prev, tasks: prev.tasks.filter((_, i) => i !== index) }));
  };

  const canProceed = () => {
    switch (step) {
      case 1: return data.courseCode.trim() !== "" && data.courseName.trim() !== "";
      case 2: return true;
      case 3: return data.courseType !== "";
      case 4: return true;
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < 6 && canProceed()) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSave = () => {
    onSave(data);
  };

  const totalGradeWeight = data.tasks.reduce((sum, t) => sum + (t.gradeWeight || 0), 0);

  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 px-4 py-2 bg-black/20 border-b border-white/10">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <button
            onClick={() => { if (s.id < step) setStep(s.id); }}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] transition-all ${
              s.id === step
                ? "bg-white/20 text-white font-medium"
                : s.id < step
                ? "text-white/60 cursor-pointer hover:text-white/80"
                : "text-white/30 cursor-default"
            }`}
            data-testid={`wizard-step-${s.id}`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
              s.id === step ? "bg-white text-black" : s.id < step ? "bg-white/40 text-white" : "bg-white/10 text-white/40"
            }`}>
              {s.id}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
          {i < WIZARD_STEPS.length - 1 && (
            <div className={`w-3 h-px mx-0.5 ${s.id < step ? "bg-white/40" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <BookOpen className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-white">Course Information</h3>
        <p className="text-[9px] text-white/50 mt-1">Enter the course code and name</p>
      </div>
      <div>
        <Label className="text-[10px] text-white/70 mb-1.5 block">Course Code *</Label>
        <Input
          value={data.courseCode}
          onChange={(e) => updateField("courseCode", e.target.value.toUpperCase())}
          placeholder="e.g. CSOC103"
          className="h-9 text-[11px] bg-white/10 border-white/20 text-white placeholder:text-white/30"
          data-testid="wizard-input-course-code"
        />
      </div>
      <div>
        <Label className="text-[10px] text-white/70 mb-1.5 block">Course Name *</Label>
        <Input
          value={data.courseName}
          onChange={(e) => updateField("courseName", e.target.value)}
          placeholder="e.g. How Society Works"
          className="h-9 text-[11px] bg-white/10 border-white/20 text-white placeholder:text-white/30"
          data-testid="wizard-input-course-name"
        />
      </div>
      <div>
        <Label className="text-[10px] text-white/70 mb-1.5 block">Course Color</Label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full border-2 border-white cursor-pointer"
              style={{ backgroundColor: data.color }}
              onClick={() => document.getElementById("wizard-color-input")?.click()}
              data-testid="wizard-color-preview"
            />
            <input
              id="wizard-color-input"
              type="color"
              value={data.color}
              onChange={(e) => updateField("color", e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              data-testid="wizard-color-picker"
            />
          </div>
          <span className="text-[10px] text-white/50">{data.color}</span>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <GraduationCap className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-white">Professor Details</h3>
        <p className="text-[9px] text-white/50 mt-1">Optional - enter your professor's information</p>
      </div>
      <div>
        <Label className="text-[10px] text-white/70 mb-1.5 block">Professor Name</Label>
        <Input
          value={data.professorName}
          onChange={(e) => updateField("professorName", e.target.value)}
          placeholder="e.g. Dr. Smith"
          className="h-9 text-[11px] bg-white/10 border-white/20 text-white placeholder:text-white/30"
          data-testid="wizard-input-professor-name"
        />
      </div>
      <div>
        <Label className="text-[10px] text-white/70 mb-1.5 block">Professor Email</Label>
        <Input
          type="email"
          value={data.professorEmail}
          onChange={(e) => updateField("professorEmail", e.target.value)}
          placeholder="e.g. smith@university.ca"
          className="h-9 text-[11px] bg-white/10 border-white/20 text-white placeholder:text-white/30"
          data-testid="wizard-input-professor-email"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <ClipboardCheck className="h-8 w-8 text-amber-400 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-white">Course Type</h3>
        <p className="text-[9px] text-white/50 mt-1">How does this course count toward your degree?</p>
      </div>
      <div className="space-y-2">
        {COURSE_TYPES.map(ct => (
          <button
            key={ct.value}
            onClick={() => updateField("courseType", ct.value)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              data.courseType === ct.value
                ? "bg-white/15 border-white/40"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
            data-testid={`wizard-course-type-${ct.value}`}
          >
            <div className="text-[11px] font-medium text-white">{ct.label}</div>
            <div className="text-[9px] text-white/50 mt-0.5">{ct.description}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-3">
      <div className="text-center mb-3">
        <FileText className="h-8 w-8 text-blue-400 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-white">Semester & Schedule</h3>
        <p className="text-[9px] text-white/50 mt-1">Configure how this course fits in your semester</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Semester Type</Label>
          <select
            value={data.semesterType}
            onChange={(e) => updateField("semesterType", e.target.value)}
            className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
            data-testid="wizard-select-semester-type"
          >
            <option value="fall" className="bg-gray-800">Fall</option>
            <option value="winter" className="bg-gray-800">Winter</option>
            <option value="spring_summer" className="bg-gray-800">Spring/Summer</option>
          </select>
        </div>
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Delivery Mode</Label>
          <select
            value={data.deliveryMode}
            onChange={(e) => updateField("deliveryMode", e.target.value)}
            className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
            data-testid="wizard-select-delivery"
          >
            <option value="" className="bg-gray-800">Select...</option>
            <option value="virtual" className="bg-gray-800">Virtual (live class)</option>
            <option value="online" className="bg-gray-800">Online (async)</option>
          </select>
        </div>
      </div>

      {data.semesterType === "spring_summer" && (
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Spring/Summer Term</Label>
          <select
            value={data.springSummerTerm}
            onChange={(e) => updateField("springSummerTerm", e.target.value)}
            className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
            data-testid="wizard-select-term"
          >
            <option value="full" className="bg-gray-800">Full Length (May-Aug)</option>
            <option value="first_half" className="bg-gray-800">First Half (May-Jun)</option>
            <option value="second_half" className="bg-gray-800">Second Half (Jun-Aug)</option>
          </select>
        </div>
      )}

      {data.deliveryMode === "virtual" && (
        <div className="grid grid-cols-4 gap-2">
          <div>
            <Label className="text-[9px] text-white/60 mb-1 block">Day 1</Label>
            <select
              value={data.classDay}
              onChange={(e) => updateField("classDay", e.target.value)}
              className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
              data-testid="wizard-select-day1"
            >
              {DAY_OPTIONS.map(d => (
                <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[9px] text-white/60 mb-1 block">Day 2</Label>
            <select
              value={data.classDay2}
              onChange={(e) => updateField("classDay2", e.target.value)}
              className="w-full h-8 rounded bg-white/10 border border-white/20 text-white text-[10px] px-2"
              data-testid="wizard-select-day2"
            >
              {DAY_OPTIONS.map(d => (
                <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[9px] text-white/60 mb-1 block">Start Time</Label>
            <Input
              type="time"
              value={data.classTime}
              onChange={(e) => updateField("classTime", e.target.value)}
              className="h-8 !text-[10px] !text-black"
              data-testid="wizard-input-start-time"
            />
          </div>
          <div>
            <Label className="text-[9px] text-white/60 mb-1 block">End Time</Label>
            <Input
              type="time"
              value={data.classEndTime}
              onChange={(e) => updateField("classEndTime", e.target.value)}
              className="h-8 !text-[10px] !text-black"
              data-testid="wizard-input-end-time"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Course Start Date</Label>
          <Input
            type="date"
            value={data.startDate}
            onChange={(e) => updateField("startDate", e.target.value)}
            className="h-8 !text-[10px] !text-black"
            data-testid="wizard-input-start-date"
          />
        </div>
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Course End Date</Label>
          <Input
            type="date"
            value={data.endDate}
            onChange={(e) => updateField("endDate", e.target.value)}
            className="h-8 !text-[10px] !text-black"
            data-testid="wizard-input-end-date"
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-3">
      <div className="text-center mb-2">
        <ClipboardCheck className="h-7 w-7 text-purple-400 mx-auto mb-1" />
        <h3 className="text-sm font-medium text-white">Tasks & Grade Breakdown</h3>
        <p className="text-[9px] text-white/50 mt-0.5">Add all known assignments, exams, and other graded items</p>
      </div>

      {totalGradeWeight > 0 && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] ${
          totalGradeWeight === 100 ? "bg-green-500/20 text-green-300" :
          totalGradeWeight > 100 ? "bg-red-500/20 text-red-300" :
          "bg-amber-500/20 text-amber-300"
        }`}>
          <AlertCircle className="h-3 w-3" />
          Total grade weight: {totalGradeWeight}%{totalGradeWeight === 100 ? " (Complete)" : totalGradeWeight > 100 ? " (Exceeds 100%!)" : ` (${100 - totalGradeWeight}% remaining)`}
        </div>
      )}

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {data.tasks.map((task, index) => (
          <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/40 font-medium">TASK {index + 1}</span>
              <button
                onClick={() => removeTask(index)}
                className="text-red-400/60 hover:text-red-400 p-0.5"
                data-testid={`wizard-remove-task-${index}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-white/50 mb-0.5 block">Title *</Label>
                <Input
                  value={task.title}
                  onChange={(e) => updateTask(index, "title", e.target.value)}
                  placeholder="e.g. Midterm Exam"
                  className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                  data-testid={`wizard-task-title-${index}`}
                />
              </div>
              <div>
                <Label className="text-[9px] text-white/50 mb-0.5 block">Type</Label>
                <select
                  value={task.type}
                  onChange={(e) => updateTask(index, "type", e.target.value)}
                  className="w-full h-7 rounded bg-white/10 border border-white/15 text-white text-[10px] px-1.5"
                  data-testid={`wizard-task-type-${index}`}
                >
                  {TASK_TYPE_OPTIONS.map(t => (
                    <option key={t.value} value={t.value} className="bg-gray-800">{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-white/50 mb-0.5 block">Due Date</Label>
                <Input
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => updateTask(index, "dueDate", e.target.value)}
                  className="h-7 !text-[10px] !text-black"
                  data-testid={`wizard-task-due-${index}`}
                />
              </div>
              <div>
                <Label className="text-[9px] text-white/50 mb-0.5 block">Due Time</Label>
                <Input
                  type="time"
                  value={task.dueTime}
                  onChange={(e) => updateTask(index, "dueTime", e.target.value)}
                  className="h-7 !text-[10px] !text-black"
                  data-testid={`wizard-task-time-${index}`}
                />
              </div>
            </div>

            <div>
              <Label className="text-[9px] text-white/50 mb-0.5 block">Description</Label>
              <Input
                value={task.description}
                onChange={(e) => updateTask(index, "description", e.target.value)}
                placeholder="Optional description"
                className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                data-testid={`wizard-task-desc-${index}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              <div>
                <Label className="text-[9px] text-white/50 mb-0.5 block flex items-center gap-1">
                  <span>Task Value</span>
                  <span className="text-white/30">(total points)</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={task.gradeTotal ?? ""}
                  onChange={(e) => updateTask(index, "gradeTotal", e.target.value ? Number(e.target.value) : null)}
                  placeholder="e.g. 40"
                  className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                  data-testid={`wizard-task-grade-total-${index}`}
                />
              </div>
              <div>
                <Label className="text-[9px] text-white/50 mb-0.5 block flex items-center gap-1">
                  <span>% of Grade</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={task.gradeWeight ?? ""}
                  onChange={(e) => updateTask(index, "gradeWeight", e.target.value ? Number(e.target.value) : null)}
                  placeholder="e.g. 25"
                  className="h-7 text-[10px] bg-white/10 border-white/15 text-white placeholder:text-white/25"
                  data-testid={`wizard-task-grade-weight-${index}`}
                />
              </div>
            </div>

            <div className="pt-1 border-t border-white/5">
              <Label className="text-[9px] text-white/50 mb-1 block flex items-center gap-1">
                <Bell className="h-2.5 w-2.5" />
                Reminders
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {([["reminder1", "Reminder 1"], ["reminder2", "Reminder 2"], ["reminder3", "Reminder 3"], ["reminder4", "Reminder 4"]] as const).map(([field, label]) => (
                  <div key={field}>
                    <span className="text-[8px] text-white/40">{label}</span>
                    <select
                      value={task[field]}
                      onChange={(e) => updateTask(index, field, Number(e.target.value))}
                      className="w-full h-6 rounded bg-white/10 border border-white/15 text-white text-[9px] px-1"
                      data-testid={`wizard-task-${field}-${index}`}
                    >
                      {REMINDER_OPTIONS.map(r => (
                        <option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addTask}
        className="w-full py-2 rounded-lg border border-dashed border-white/20 text-white/60 text-[10px] hover:bg-white/5 hover:text-white/80 hover:border-white/30 transition-all flex items-center justify-center gap-1.5"
        data-testid="wizard-add-task"
      >
        <Plus className="h-3 w-3" />
        Add Task
      </button>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-3">
      <div className="text-center mb-3">
        <GraduationCap className="h-8 w-8 text-green-400 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-white">Review & Save</h3>
        <p className="text-[9px] text-white/50 mt-1">Confirm your course details before saving</p>
      </div>

      <div className="space-y-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="text-[11px] font-medium text-white">{data.courseCode} - {data.courseName}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
            <div><span className="text-white/40">Professor:</span> <span className="text-white/80">{data.professorName || "Not set"}</span></div>
            <div><span className="text-white/40">Email:</span> <span className="text-white/80">{data.professorEmail || "Not set"}</span></div>
            <div><span className="text-white/40">Type:</span> <span className="text-white/80">{COURSE_TYPES.find(c => c.value === data.courseType)?.label || data.courseType}</span></div>
            <div><span className="text-white/40">Delivery:</span> <span className="text-white/80">{data.deliveryMode || "Not set"}</span></div>
            {data.startDate && <div><span className="text-white/40">Start:</span> <span className="text-white/80">{data.startDate}</span></div>}
            {data.endDate && <div><span className="text-white/40">End:</span> <span className="text-white/80">{data.endDate}</span></div>}
          </div>
        </div>

        {data.tasks.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-medium text-white mb-2">{data.tasks.length} Task{data.tasks.length !== 1 ? "s" : ""} to Create</div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {data.tasks.map((task, i) => (
                <div key={i} className="flex items-center justify-between text-[9px] py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/80">{task.title || `Task ${i + 1}`}</span>
                    <span className="text-white/30">({TASK_TYPE_OPTIONS.find(t => t.value === task.type)?.label})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {task.dueDate && <span className="text-white/40">{task.dueDate}</span>}
                    {task.gradeWeight && <span className="text-amber-400/80">{task.gradeWeight}%</span>}
                  </div>
                </div>
              ))}
            </div>
            {totalGradeWeight > 0 && (
              <div className={`mt-2 pt-1.5 border-t border-white/10 text-[10px] font-medium ${
                totalGradeWeight === 100 ? "text-green-400" : totalGradeWeight > 100 ? "text-red-400" : "text-amber-400"
              }`}>
                Total Grade Weight: {totalGradeWeight}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-gradient-to-br from-gray-800 via-[#111] to-gray-900 border border-white/20 rounded-lg w-[560px] max-h-[90vh] overflow-hidden flex flex-col text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
            <h2 className="text-xs font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}>
              NEW COURSE WIZARD
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-white/80 transition-colors p-1"
            data-testid="wizard-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {renderStepIndicator()}

        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "thin" }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-black/20 flex-shrink-0">
          <Button
            variant="outline"
            onClick={step === 1 ? onClose : handleBack}
            className="border !border-white/30 text-white/60 transition-all duration-200"
            style={{ fontSize: "11px" }}
            data-testid="wizard-back"
          >
            {step === 1 ? (
              "Cancel"
            ) : (
              <><ChevronLeft className="h-3 w-3 mr-1" /> Back</>
            )}
          </Button>

          {step < 6 ? (
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={!canProceed()}
              className="border !border-white/50 text-white transition-all duration-200 disabled:opacity-30"
              style={{
                boxShadow: canProceed() ? "0 0 6px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.2)" : "none",
                fontSize: "11px",
              }}
              data-testid="wizard-next"
            >
              Next <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleSave}
              className="border !border-white/50 text-white transition-all duration-200"
              style={{
                boxShadow: "0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)",
                fontSize: "11px",
              }}
              data-testid="wizard-save"
            >
              Save Course
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
