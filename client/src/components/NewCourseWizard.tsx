import { useState, useRef } from "react";
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
  { id: 5, label: "Assignments & Grades" },
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
  colorEnd: string;
  colorStops: string;
  borderColor: string;
  courseRowColor: string;
  taskBgColor: string;
  semesterType: string;
  deliveryMode: string;
  classDay: string;
  classDay2: string;
  classTime: string;
  classEndTime: string;
  classTimezone: string;
  startDate: string;
  endDate: string;
  springSummerTerm: string;
  zoomLink: string;
  tasks: WizardTask[];
}

interface NewCourseWizardProps {
  onSave: (data: WizardData) => void;
  onClose: () => void;
  existingSemesterType?: string;
  colorSettings?: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
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

export function NewCourseWizard({ onSave, onClose, existingSemesterType, colorSettings }: NewCourseWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    courseCode: "",
    courseName: "",
    professorName: "",
    professorEmail: "",
    courseType: "core",
    color: "#6366F1",
    colorEnd: "#EC4899",
    colorStops: "",
    borderColor: "",
    courseRowColor: "",
    taskBgColor: "",
    semesterType: existingSemesterType || "winter",
    deliveryMode: "",
    classDay: "",
    classDay2: "",
    classTime: "",
    classEndTime: "",
    classTimezone: "America/Toronto",
    startDate: "",
    endDate: "",
    springSummerTerm: "",
    zoomLink: "",
    tasks: [],
  });

  const [wizardActiveGradientStop, setWizardActiveGradientStop] = useState<'start' | 'end' | number | null>(null);
  const wizardGradBarRef = useRef<HTMLDivElement>(null);

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
      case 4: return !(data.semesterType === "spring_summer" && !data.springSummerTerm);
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
    <div className="flex items-center gap-1 px-4 py-2 bg-white/10 border-b border-white/20">
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
      {(() => {
        const hexToHue = (c: string) => { const r = parseInt(c.slice(1,3),16)/255, g = parseInt(c.slice(3,5),16)/255, b = parseInt(c.slice(5,7),16)/255; const max = Math.max(r,g,b), min = Math.min(r,g,b); if (max===min) return 0; let h = 0; if (max===r) h = ((g-b)/(max-min))%6; else if (max===g) h = (b-r)/(max-min)+2; else h = (r-g)/(max-min)+4; h = Math.round(h*60); return h<0?h+360:h; };
        const hueToHex = (hue: number) => `#${[0,8,4].map(n => { const k = (n + hue/30) % 12; const c2 = 0.5 - 0.5 * Math.max(Math.min(k-3, 9-k, 1), -1); return Math.round(255 * Math.max(0, Math.min(1, c2))).toString(16).padStart(2,'0'); }).join('')}`;
        const hexToSvPos = (hex: string) => { const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255; const max = Math.max(r,g,b), min = Math.min(r,g,b); const v = max; const s = max === 0 ? 0 : (max - min) / max; return { x: s, y: 1 - v }; };
        const svToHex = (hue: number, sx: number, sy: number) => { const s = sx, v = 1 - sy; const c = v * s, x2 = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = v - c; let r1 = 0, g1 = 0, b1 = 0; if (hue < 60) { r1 = c; g1 = x2; } else if (hue < 120) { r1 = x2; g1 = c; } else if (hue < 180) { g1 = c; b1 = x2; } else if (hue < 240) { g1 = x2; b1 = c; } else if (hue < 300) { r1 = x2; b1 = c; } else { r1 = c; b1 = x2; } const f = (ch: number) => Math.round(255 * Math.max(0, Math.min(1, ch + m))).toString(16).padStart(2, '0'); return `#${f(r1)}${f(g1)}${f(b1)}`; };
        const midStops: Array<{position: number; color: string}> = (() => { try { return data.colorStops ? JSON.parse(data.colorStops) : []; } catch { return []; } })();
        const allStops = [{ position: 0, color: data.color }, ...midStops, { position: 100, color: data.colorEnd }].sort((a, b) => a.position - b.position);
        const gradientCss = `linear-gradient(to right, ${allStops.map(s => `${s.color} ${s.position}%`).join(', ')})`;
        const getActiveColor = (): string => {
          if (wizardActiveGradientStop === 'start') return data.color;
          if (wizardActiveGradientStop === 'end') return data.colorEnd;
          if (typeof wizardActiveGradientStop === 'number' && midStops[wizardActiveGradientStop]) return midStops[wizardActiveGradientStop].color;
          return '#000000';
        };
        const setActiveColor = (hex: string) => {
          if (wizardActiveGradientStop === 'start') updateField('color', hex);
          else if (wizardActiveGradientStop === 'end') updateField('colorEnd', hex);
          else if (typeof wizardActiveGradientStop === 'number') {
            const updated = [...midStops];
            updated[wizardActiveGradientStop] = { ...updated[wizardActiveGradientStop], color: hex };
            updateField('colorStops', JSON.stringify(updated));
          }
        };
        return (
        <div>
          <div className="flex items-start gap-3">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] text-white/70">Label Gradient</Label>
                <button className="text-white hover:text-white/80 text-[8px] flex items-center gap-0.5" onClick={() => {
                  const revMid = midStops.map(s => ({ position: 100 - s.position, color: s.color })).reverse();
                  setData(prev => ({...prev, color: prev.colorEnd, colorEnd: prev.color, colorStops: revMid.length ? JSON.stringify(revMid) : ''}));
                }} data-testid="wizard-button-reverse-gradient"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4h14M11 1l3 3-3 3M15 12H1M5 9l-3 3 3 3"/></svg><span>Reverse</span></button>
              </div>
              <div ref={wizardGradBarRef} className="rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '1px', background: 'rgba(0,0,0,0.2)', cursor: 'copy' }}
                onDoubleClick={(e) => {
                  const bar = wizardGradBarRef.current;
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
                  updateField('colorStops', JSON.stringify(newMid));
                  setWizardActiveGradientStop(newIdx);
                }}>
                <div style={{ height: '18px', borderRadius: '3px', background: gradientCss }} data-testid="wizard-gradient-preview-bar" />
              </div>
              <div className="relative" style={{ height: '16px', marginTop: '1px' }}>
                <div style={{ position: 'absolute', left: '0px', top: 0, cursor: 'pointer', zIndex: 10 }} onClick={() => setWizardActiveGradientStop(wizardActiveGradientStop === 'start' ? null : 'start')} data-testid="wizard-gradient-stop-start">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={data.color} stroke={wizardActiveGradientStop === 'start' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={wizardActiveGradientStop === 'start' ? '2' : '1'}/></svg>
                </div>
                {midStops.map((stop, idx) => (
                  <div key={idx} style={{ position: 'absolute', left: `calc(${stop.position}% - 6px)`, top: 0, cursor: 'pointer', touchAction: 'none', zIndex: wizardActiveGradientStop === idx ? 20 : 5 }}
                    onClick={() => setWizardActiveGradientStop(wizardActiveGradientStop === idx ? null : idx)}
                    onPointerDown={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const el = e.currentTarget as HTMLElement;
                      el.setPointerCapture(e.pointerId);
                      const bar = wizardGradBarRef.current;
                      if (!bar) return;
                      const barRect = bar.getBoundingClientRect();
                      const barW = barRect.width;
                      const onMove = (ev: PointerEvent) => {
                        const pct = Math.round(Math.max(1, Math.min(99, ((ev.clientX - barRect.left) / barW) * 100)));
                        const updated = [...midStops];
                        updated[idx] = { ...updated[idx], position: pct };
                        setData(prev => ({...prev, colorStops: JSON.stringify(updated.sort((a, b) => a.position - b.position))}));
                      };
                      const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                    data-testid={`wizard-gradient-stop-mid-${idx}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 11,6 6,12 1,6" fill={stop.color} stroke={wizardActiveGradientStop === idx ? '#ffffff' : 'rgba(255,255,255,0.5)'} strokeWidth={wizardActiveGradientStop === idx ? '2' : '1'}/></svg>
                  </div>
                ))}
                <div style={{ position: 'absolute', right: '0px', top: 0, cursor: 'pointer', zIndex: 10 }} onClick={() => setWizardActiveGradientStop(wizardActiveGradientStop === 'end' ? null : 'end')} data-testid="wizard-gradient-stop-end">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={data.colorEnd} stroke={wizardActiveGradientStop === 'end' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={wizardActiveGradientStop === 'end' ? '2' : '1'}/></svg>
                </div>
              </div>
              {midStops.length === 0 && <div className="text-white/50 text-[9px] mt-1">Double-click gradient bar to add a colour stop</div>}
              {midStops.length > 0 && <div className="text-white/40 text-[8px]" style={{ marginTop: '4px' }}>Double-click bar to add · drag to move</div>}
              {wizardActiveGradientStop != null && (
                <div className="mt-1.5 rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', padding: '6px' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded border border-white/30 shrink-0" style={{ backgroundColor: getActiveColor() }} />
                    <span className="text-white/60 text-[8px] uppercase tracking-wider">{wizardActiveGradientStop === 'start' ? 'Start' : wizardActiveGradientStop === 'end' ? 'End' : `Stop ${(wizardActiveGradientStop as number) + 1}`} Colour</span>
                    {typeof wizardActiveGradientStop === 'number' && (
                      <button className="text-red-400/70 hover:text-red-400 text-[8px] ml-auto mr-1" onClick={() => {
                        const updated = midStops.filter((_, i) => i !== wizardActiveGradientStop);
                        updateField('colorStops', updated.length ? JSON.stringify(updated) : '');
                        setWizardActiveGradientStop(null);
                      }} data-testid="wizard-button-delete-stop"><Trash2 className="w-3 h-3" /></button>
                    )}
                    <button className={`${typeof wizardActiveGradientStop === 'number' ? '' : 'ml-auto '}text-white/40 hover:text-white`} onClick={() => setWizardActiveGradientStop(null)} data-testid="wizard-button-close-color-picker"><X className="w-3 h-3" /></button>
                  </div>
                  {typeof wizardActiveGradientStop === 'number' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-white/50 text-[8px]">Position</span>
                      <input type="range" min={1} max={99} value={midStops[wizardActiveGradientStop]?.position || 50} onChange={(e) => {
                        const updated = [...midStops];
                        updated[wizardActiveGradientStop as number] = { ...updated[wizardActiveGradientStop as number], position: parseInt(e.target.value) };
                        updateField('colorStops', JSON.stringify(updated.sort((a, b) => a.position - b.position)));
                      }} className="flex-1" style={{ height: '6px', accentColor: getActiveColor() }} data-testid="wizard-slider-stop-position" />
                      <span className="text-white/50 text-[8px] w-6 text-right">{midStops[wizardActiveGradientStop]?.position}%</span>
                    </div>
                  )}
                  <div className="relative rounded cursor-crosshair" style={{ height: '92px', touchAction: 'none' }} data-testid={`wizard-color-area-${wizardActiveGradientStop}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const hue = hexToHue(getActiveColor());
                      const update = (cx: number, cy: number) => {
                        const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
                        const y = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
                        setActiveColor(svToHex(hue, x, y));
                      };
                      update(e.clientX, e.clientY);
                      const onMove = (ev: MouseEvent) => { ev.preventDefault(); update(ev.clientX, ev.clientY); };
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const hue = hexToHue(getActiveColor());
                      const update = (cx: number, cy: number) => {
                        const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
                        const y = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
                        setActiveColor(svToHex(hue, x, y));
                      };
                      if (e.touches[0]) update(e.touches[0].clientX, e.touches[0].clientY);
                      const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) update(ev.touches[0].clientX, ev.touches[0].clientY); };
                      const onEnd = () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
                      window.addEventListener('touchmove', onMove, { passive: false });
                      window.addEventListener('touchend', onEnd);
                    }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '3px', background: `linear-gradient(to right, white, hsl(${hexToHue(getActiveColor())}, 100%, 50%))` }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '3px', background: 'linear-gradient(to bottom, transparent, black)' }} />
                    {(() => { const pos = hexToSvPos(getActiveColor()); return <div style={{ position: 'absolute', left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.5), inset 0 0 1px rgba(0,0,0,0.3)', pointerEvents: 'none', backgroundColor: getActiveColor() }} />; })()}
                  </div>
                  <div className="relative mt-1.5 rounded cursor-pointer" style={{ height: '14px', touchAction: 'none' }} data-testid={`wizard-hue-slider-${wizardActiveGradientStop}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const update = (cx: number) => { const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width)); setActiveColor(hueToHex(Math.round(x * 360))); };
                      update(e.clientX);
                      const onMove = (ev: MouseEvent) => { ev.preventDefault(); update(ev.clientX); };
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const update = (cx: number) => { const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width)); setActiveColor(hueToHex(Math.round(x * 360))); };
                      if (e.touches[0]) update(e.touches[0].clientX);
                      const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) update(ev.touches[0].clientX); };
                      const onEnd = () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
                      window.addEventListener('touchmove', onMove, { passive: false });
                      window.addEventListener('touchend', onEnd);
                    }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)', borderRadius: '3px' }} />
                    <div style={{ position: 'absolute', top: '-1px', left: `${(hexToHue(getActiveColor()) / 360) * 100}%`, transform: 'translateX(-50%)', width: '4px', height: '16px', background: 'white', borderRadius: '2px', boxShadow: '0 0 3px rgba(0,0,0,0.5)', border: '1px solid rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input type="color" value={getActiveColor()} onChange={(e) => setActiveColor(e.target.value)} className="w-5 h-5 rounded border border-white/30 cursor-pointer shrink-0" style={{ padding: 0, background: 'transparent', WebkitAppearance: 'none', appearance: 'none' }} data-testid={`wizard-input-color-${wizardActiveGradientStop}`} />
                    <input type="text" value={getActiveColor().toUpperCase()} onChange={(e) => { let v = e.target.value; if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setActiveColor(v); }} className="flex-1 bg-white border border-gray-300 rounded text-black text-[9px] px-1.5 py-0.5 font-mono" style={{ minWidth: 0 }} data-testid={`wizard-input-hex-${wizardActiveGradientStop}`} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '8px' }}>
              <label className="text-white/70 text-[9px] mb-1">Border</label>
              <div className="relative" style={{ width: '20px', height: '20px' }}>
                <div className="absolute inset-0 rounded-sm border border-white/30" style={{ backgroundColor: data.borderColor || data.color }} />
                <input type="color" value={data.borderColor || data.color} onChange={(e) => updateField('borderColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: '20px', height: '20px' }} data-testid="wizard-input-border-color" />
              </div>
              <input type="text" value={data.borderColor ? data.borderColor.toUpperCase() : 'Auto'} onChange={e => { let v = e.target.value; if (v === '' || v === 'Auto') { updateField('borderColor', ''); return; } if (!v.startsWith('#')) v = '#' + v; updateField('borderColor', v); }} className="bg-white border border-gray-300 rounded text-black text-[8px] px-1 py-0.5 font-mono mt-1 text-center focus:outline-none" style={{ width: '50px' }} data-testid="wizard-input-border-color-hex" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '8px' }}>
              <label className="text-white/70 text-[9px] mb-1">Row BG</label>
              <div className="relative" style={{ width: '20px', height: '20px' }}>
                <div className="absolute inset-0 rounded-sm border border-white/30" style={{ backgroundColor: data.courseRowColor || 'transparent' }} />
                <input type="color" value={data.courseRowColor || '#1a1a2e'} onChange={(e) => updateField('courseRowColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: '20px', height: '20px' }} data-testid="wizard-input-row-color" />
              </div>
              <input type="text" value={data.courseRowColor ? data.courseRowColor.toUpperCase() : 'Auto'} onChange={e => { let v = e.target.value; if (v === '' || v === 'Auto') { updateField('courseRowColor', ''); return; } if (!v.startsWith('#')) v = '#' + v; updateField('courseRowColor', v); }} className="bg-white border border-gray-300 rounded text-black text-[8px] px-1 py-0.5 font-mono mt-1 text-center focus:outline-none" style={{ width: '50px' }} data-testid="wizard-input-row-color-hex" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '8px' }}>
              <label className="text-white/70 text-[9px] mb-1">Task BG</label>
              <div className="relative" style={{ width: '20px', height: '20px' }}>
                <div className="absolute inset-0 rounded-sm border border-white/30" style={{ backgroundColor: data.taskBgColor || 'transparent' }} />
                <input type="color" value={data.taskBgColor || '#1a1a2e'} onChange={(e) => updateField('taskBgColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: '20px', height: '20px' }} data-testid="wizard-input-task-color" />
              </div>
              <input type="text" value={data.taskBgColor ? data.taskBgColor.toUpperCase() : 'Auto'} onChange={e => { let v = e.target.value; if (v === '' || v === 'Auto') { updateField('taskBgColor', ''); return; } if (!v.startsWith('#')) v = '#' + v; updateField('taskBgColor', v); }} className="bg-white border border-gray-300 rounded text-black text-[8px] px-1 py-0.5 font-mono mt-1 text-center focus:outline-none" style={{ width: '50px' }} data-testid="wizard-input-task-color-hex" />
            </div>
          </div>
        </div>
        );
      })()}
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
          <Label className="text-[9px] text-white/60 mb-1 block font-semibold">Spring/Summer Term <span className="text-red-400">*</span></Label>
          <select
            value={data.springSummerTerm}
            onChange={(e) => updateField("springSummerTerm", e.target.value)}
            className={`w-full h-8 rounded bg-white/10 text-white text-[10px] px-2 ${!data.springSummerTerm ? 'border-2 border-yellow-500/60' : 'border border-white/20'}`}
            data-testid="wizard-select-term"
          >
            <option value="" className="bg-gray-800">-- Select Term First --</option>
            <option value="first_half" className="bg-gray-800">Spring (First Half) — May-Jun</option>
            <option value="second_half" className="bg-gray-800">Summer (Second Half) — Jun-Aug</option>
            <option value="full" className="bg-gray-800">Full Semester — May-Aug</option>
          </select>
          {!data.springSummerTerm && <p className="text-[8px] text-yellow-400 mt-0.5">You must select a term before filling in other details</p>}
        </div>
      )}

      <div className={data.semesterType === "spring_summer" && !data.springSummerTerm ? 'opacity-30 pointer-events-none' : ''}>
      {data.deliveryMode === "virtual" && (
        <>
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
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Timezone</Label>
          <select
            value={data.classTimezone}
            onChange={(e) => updateField("classTimezone", e.target.value)}
            className="w-full h-8 rounded-md bg-white/10 border border-white/20 text-white text-[10px] px-2"
            data-testid="wizard-select-timezone"
          >
            <option value="America/Toronto" className="bg-gray-800">Eastern (Toronto)</option>
            <option value="America/New_York" className="bg-gray-800">Eastern (New York)</option>
            <option value="America/Chicago" className="bg-gray-800">Central (Chicago)</option>
            <option value="America/Denver" className="bg-gray-800">Mountain (Denver)</option>
            <option value="America/Los_Angeles" className="bg-gray-800">Pacific (Los Angeles)</option>
            <option value="America/Vancouver" className="bg-gray-800">Pacific (Vancouver)</option>
            <option value="America/Edmonton" className="bg-gray-800">Mountain (Edmonton)</option>
            <option value="America/Winnipeg" className="bg-gray-800">Central (Winnipeg)</option>
            <option value="America/Halifax" className="bg-gray-800">Atlantic (Halifax)</option>
            <option value="America/St_Johns" className="bg-gray-800">Newfoundland (St. John's)</option>
            <option value="Europe/London" className="bg-gray-800">GMT (London)</option>
            <option value="Europe/Paris" className="bg-gray-800">CET (Paris)</option>
            <option value="Asia/Tokyo" className="bg-gray-800">JST (Tokyo)</option>
            <option value="UTC" className="bg-gray-800">UTC</option>
          </select>
        </div>
        <div>
          <Label className="text-[9px] text-white/60 mb-1 block">Zoom Link</Label>
          <Input
            value={data.zoomLink}
            onChange={(e) => updateField("zoomLink", e.target.value)}
            placeholder="https://tmuni.zoom.us/j/..."
            className="h-8 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/30"
            data-testid="wizard-input-zoom-link"
          />
        </div>
        </>
      )}

      {data.deliveryMode === "online" && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-[9px] text-blue-300">
          <p className="font-medium mb-1">Online (Asynchronous)</p>
          <p className="text-blue-300/70">Modules follow the weekly school calendar and change every Saturday. Module readings will be tracked through listening progress.</p>
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
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-3">
      <div className="text-center mb-2">
        <ClipboardCheck className="h-7 w-7 text-purple-400 mx-auto mb-1" />
        <h3 className="text-sm font-medium text-white">Assignments & Grades</h3>
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
            <div className="w-5 h-3 rounded-full" style={{ background: (() => { const ms: Array<{position:number;color:string}> = (() => { try { return data.colorStops ? JSON.parse(data.colorStops) : []; } catch { return []; } })(); const stops = [{position:0,color:data.color},...ms,{position:100,color:data.colorEnd}].sort((a,b)=>a.position-b.position); return `linear-gradient(to right, ${stops.map(s=>`${s.color} ${s.position}%`).join(', ')})`; })() }} />
            <span className="text-[11px] font-medium text-white">{data.courseCode} - {data.courseName}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
            <div><span className="text-white/40">Professor:</span> <span className="text-white/80">{data.professorName || "Not set"}</span></div>
            <div><span className="text-white/40">Email:</span> <span className="text-white/80">{data.professorEmail || "Not set"}</span></div>
            <div><span className="text-white/40">Type:</span> <span className="text-white/80">{COURSE_TYPES.find(c => c.value === data.courseType)?.label || data.courseType}</span></div>
            <div><span className="text-white/40">Delivery:</span> <span className="text-white/80">{data.deliveryMode === 'virtual' ? 'Virtual (Live Zoom)' : data.deliveryMode === 'online' ? 'Online (Async)' : 'Not set'}</span></div>
            {data.deliveryMode === 'virtual' && data.zoomLink && <div className="col-span-2"><span className="text-white/40">Zoom:</span> <span className="text-white/80 break-all">{data.zoomLink}</span></div>}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="text-[10px] font-medium text-white mb-2">Semester & Schedule</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
            <div><span className="text-white/40">Semester:</span> <span className="text-white/80">{data.semesterType === 'winter' ? 'Winter' : data.semesterType === 'spring_summer' ? 'Spring/Summer' : data.semesterType === 'fall' ? 'Fall' : data.semesterType || 'Not set'}</span></div>
            {data.springSummerTerm && <div><span className="text-white/40">Term:</span> <span className="text-white/80">{data.springSummerTerm === 'term1' ? 'Term 1' : data.springSummerTerm === 'term2' ? 'Term 2' : 'Full'}</span></div>}
            {data.startDate && <div><span className="text-white/40">Start Date:</span> <span className="text-white/80">{data.startDate}</span></div>}
            {data.endDate && <div><span className="text-white/40">End Date:</span> <span className="text-white/80">{data.endDate}</span></div>}
            {data.classDay && <div><span className="text-white/40">Class Day:</span> <span className="text-white/80">{data.classDay.charAt(0).toUpperCase() + data.classDay.slice(1)}{data.classDay2 ? `, ${data.classDay2.charAt(0).toUpperCase() + data.classDay2.slice(1)}` : ''}</span></div>}
            {data.classTime && <div><span className="text-white/40">Class Time:</span> <span className="text-white/80">{data.classTime}{data.classEndTime ? ` – ${data.classEndTime}` : ''}</span></div>}
            {data.classTimezone && data.classTimezone !== 'America/Toronto' && <div><span className="text-white/40">Timezone:</span> <span className="text-white/80">{data.classTimezone}</span></div>}
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
      className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl w-[560px] max-h-[90vh] overflow-hidden flex flex-col text-white shadow-2xl [&_*]:text-white [&_label]:text-white [&_input]:text-white [&_select]:text-white"
        style={{
          background: colorSettings ? `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)` : 'linear-gradient(180deg, #0a0f1e 0%, #060b14 100%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-xl" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: colorSettings ? `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)` : 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.1) 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)', margin: '0', width: '100%' }}>
          <div className="flex items-center gap-2">
            <GraduationCap className="text-white" style={{ width: '15px', height: '15px' }} />
            <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>
              NEW COURSE WIZARD
            </h2>
          </div>
        </div>

        {renderStepIndicator()}

        <div className="overflow-y-auto p-4" style={{ scrollbarWidth: "thin", height: "400px" }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/20 bg-white/10 flex-shrink-0">
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
