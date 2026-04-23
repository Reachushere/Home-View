import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FolderOpen, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Pencil, 
  ArrowLeft,
  Target,
  PauseCircle,
  XCircle,
  Lightbulb,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronUp,
  GitBranch,
  ArrowRight,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { format } from "date-fns";
import type { Project, Task, TaskLink } from "@shared/schema";

const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;
const COURSE_COLORS: Record<string, string> = {
  CPPA122: "#22C55E",
  CFNF400: "#EC4899",
  CASL101: "#6366F1",
};

function getStatusIcon(status: string) {
  switch (status) {
    case "planning": return <Lightbulb className="w-4 h-4" />;
    case "in_progress": return <Clock className="w-4 h-4" />;
    case "on_hold": return <PauseCircle className="w-4 h-4" />;
    case "completed": return <CheckCircle2 className="w-4 h-4" />;
    case "cancelled": return <XCircle className="w-4 h-4" />;
    default: return <FolderOpen className="w-4 h-4" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "planning": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "in_progress": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200";
    case "on_hold": return "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-200";
    case "completed": return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "medium": return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200";
    case "low": return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    default: return "bg-gray-100 text-gray-800";
  }
}

interface ProjectFormData {
  name: string;
  description: string;
  color: string;
  status: string;
  courseName: string;
  startDate: string;
  targetDate: string;
  priority: string;
  notes: string;
  projectType: string;
  metadata: any;
  initialTasks?: string;
  tags?: string[];
  dependsOnProjectIds?: number[];
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function LegalComplaintEditor({
  metadata,
  onChange,
  projectId,
  onAttachmentsChanged,
}: {
  metadata: any;
  onChange: (m: any) => void;
  projectId?: number;
  onAttachmentsChanged?: () => void;
}) {
  const m = metadata || {};
  const update = (patch: any) => onChange({ ...m, ...patch });
  const updateNested = (key: string, patch: any) => onChange({ ...m, [key]: { ...(m[key] || {}), ...patch } });

  const parties = m.parties || {};
  const jurisdiction = m.jurisdiction || {};
  const filing = m.filing || {};
  const claims: any[] = m.claims || [];
  const keyDates: any[] = m.keyDates || [];
  const attachments: any[] = m.attachments || [];

  const addPartyTo = (group: 'plaintiffs' | 'defendants' | 'counsel') => {
    const next = { ...(parties || {}) };
    next[group] = [...(next[group] || []), { name: '', role: '', contact: '' }];
    update({ parties: next });
  };
  const updatePartyAt = (group: string, idx: number, patch: any) => {
    const next = { ...(parties || {}) };
    next[group] = [...(next[group] || [])];
    next[group][idx] = { ...next[group][idx], ...patch };
    update({ parties: next });
  };
  const removePartyAt = (group: string, idx: number) => {
    const next = { ...(parties || {}) };
    next[group] = (next[group] || []).filter((_: any, i: number) => i !== idx);
    update({ parties: next });
  };

  const addClaim = () => update({ claims: [...claims, { id: uid('claim'), title: '', description: '', elements: [], status: 'open' }] });
  const updateClaim = (idx: number, patch: any) => {
    const next = [...claims]; next[idx] = { ...next[idx], ...patch }; update({ claims: next });
  };
  const removeClaim = (idx: number) => update({ claims: claims.filter((_, i) => i !== idx) });
  const addElement = (idx: number) => {
    const next = [...claims];
    next[idx] = { ...next[idx], elements: [...(next[idx].elements || []), ''] };
    update({ claims: next });
  };
  const updateElement = (cIdx: number, eIdx: number, val: string) => {
    const next = [...claims];
    const els = [...(next[cIdx].elements || [])]; els[eIdx] = val;
    next[cIdx] = { ...next[cIdx], elements: els };
    update({ claims: next });
  };
  const removeElement = (cIdx: number, eIdx: number) => {
    const next = [...claims];
    next[cIdx] = { ...next[cIdx], elements: (next[cIdx].elements || []).filter((_: any, i: number) => i !== eIdx) };
    update({ claims: next });
  };

  const addKeyDate = () => update({ keyDates: [...keyDates, { id: uid('kd'), date: '', label: '', type: 'deadline', notes: '' }] });
  const updateKeyDate = (idx: number, patch: any) => {
    const next = [...keyDates]; next[idx] = { ...next[idx], ...patch }; update({ keyDates: next });
  };
  const removeKeyDate = (idx: number) => update({ keyDates: keyDates.filter((_, i) => i !== idx) });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length || !projectId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      const res = await fetch(`/api/projects/${projectId}/legal/upload`, { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (data.added?.length) {
        update({ attachments: [...attachments, ...data.added] });
      }
      onAttachmentsChanged?.();
    } catch (e) {
      console.error('Legal attachment upload failed', e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const handleDeleteAttachment = async (attId: string) => {
    if (!projectId) {
      update({ attachments: attachments.filter(a => a.id !== attId) });
      return;
    }
    try {
      await fetch(`/api/projects/${projectId}/legal/attachments/${attId}`, { method: 'DELETE', credentials: 'include' });
      update({ attachments: attachments.filter(a => a.id !== attId) });
      onAttachmentsChanged?.();
    } catch (e) { console.error(e); }
  };

  const partyGroup = (label: string, group: 'plaintiffs' | 'defendants' | 'counsel') => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-white/90">{label}</label>
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-blue-300 hover:text-blue-200" onClick={() => addPartyTo(group)} data-testid={`button-add-${group}`}>
          + Add
        </Button>
      </div>
      {(parties[group] || []).map((p: any, i: number) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
          <Input className="text-[11px] h-7" placeholder="Name" value={p.name || ''} onChange={(e) => updatePartyAt(group, i, { name: e.target.value })} data-testid={`input-${group}-name-${i}`} />
          <Input className="text-[11px] h-7" placeholder="Role" value={p.role || ''} onChange={(e) => updatePartyAt(group, i, { role: e.target.value })} />
          <Input className="text-[11px] h-7" placeholder="Contact" value={p.contact || ''} onChange={(e) => updatePartyAt(group, i, { contact: e.target.value })} />
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-300 hover:text-red-200" onClick={() => removePartyAt(group, i)} data-testid={`button-remove-${group}-${i}`}>×</Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 p-3 rounded-md border border-amber-400/30 bg-amber-500/5" data-testid="legal-complaint-editor">
      <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Legal Complaint Details</div>

      {/* Summary + relief */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium">Case Summary</label>
        <Textarea className="text-[11px]" rows={2} placeholder="Brief description of the dispute" value={m.summary || ''} onChange={(e) => update({ summary: e.target.value })} data-testid="input-legal-summary" />
        <label className="text-[11px] font-medium">Relief Sought</label>
        <Textarea className="text-[11px]" rows={2} placeholder="Damages, injunctive relief, refund, etc." value={m.reliefSought || ''} onChange={(e) => update({ reliefSought: e.target.value })} data-testid="input-legal-relief" />
      </div>

      {/* Jurisdiction */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-white/90">Jurisdiction</div>
        <div className="grid grid-cols-2 gap-2">
          <Input className="text-[11px] h-7" placeholder="Court (e.g. ON Superior Court)" value={jurisdiction.court || ''} onChange={(e) => updateNested('jurisdiction', { court: e.target.value })} data-testid="input-legal-court" />
          <Input className="text-[11px] h-7" placeholder="Case / File Number" value={jurisdiction.caseNumber || ''} onChange={(e) => updateNested('jurisdiction', { caseNumber: e.target.value })} data-testid="input-legal-case-number" />
          <Input className="text-[11px] h-7 col-span-2" placeholder="Venue / Location" value={jurisdiction.venue || ''} onChange={(e) => updateNested('jurisdiction', { venue: e.target.value })} />
        </div>
      </div>

      {/* Filing dates */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-white/90">Filing & Service</div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-[10px] text-white/70">Filed</label><Input type="date" className="text-[11px] h-7" value={filing.filedDate || ''} onChange={(e) => updateNested('filing', { filedDate: e.target.value })} data-testid="input-legal-filed-date" /></div>
          <div><label className="text-[10px] text-white/70">Served</label><Input type="date" className="text-[11px] h-7" value={filing.servedDate || ''} onChange={(e) => updateNested('filing', { servedDate: e.target.value })} /></div>
          <div><label className="text-[10px] text-white/70">Response Due</label><Input type="date" className="text-[11px] h-7" value={filing.responseDeadline || ''} onChange={(e) => updateNested('filing', { responseDeadline: e.target.value })} data-testid="input-legal-response-deadline" /></div>
        </div>
      </div>

      {/* Parties */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold text-white/90">Parties</div>
        {partyGroup('Plaintiffs', 'plaintiffs')}
        {partyGroup('Defendants', 'defendants')}
        {partyGroup('Counsel', 'counsel')}
        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
          <label className="text-[11px] text-white/90">Judge</label>
          <Input className="text-[11px] h-7" placeholder="Presiding judge (if assigned)" value={parties.judge || ''} onChange={(e) => updateNested('parties', { judge: e.target.value })} />
        </div>
      </div>

      {/* Claims */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/90">Claims / Causes of Action</div>
          <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-blue-300 hover:text-blue-200" onClick={addClaim} data-testid="button-add-claim">+ Add Claim</Button>
        </div>
        {claims.map((c, i) => (
          <div key={c.id} className="border border-white/15 rounded-md p-2 space-y-2 bg-black/20" data-testid={`claim-${i}`}>
            <div className="flex items-start gap-2">
              <Input className="text-[11px] h-7 flex-1" placeholder="Claim title (e.g. Breach of Contract)" value={c.title} onChange={(e) => updateClaim(i, { title: e.target.value })} data-testid={`input-claim-title-${i}`} />
              <Select value={c.status || 'open'} onValueChange={(v) => updateClaim(i, { status: v })}>
                <SelectTrigger className="bg-white text-black text-[11px] h-7 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['open', 'pleaded', 'discovery', 'resolved', 'dismissed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-300 hover:text-red-200" onClick={() => removeClaim(i)} data-testid={`button-remove-claim-${i}`}>×</Button>
            </div>
            <Textarea className="text-[11px]" rows={2} placeholder="Description of this claim" value={c.description || ''} onChange={(e) => updateClaim(i, { description: e.target.value })} />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase text-white/60">Elements to prove</div>
                <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] text-blue-300" onClick={() => addElement(i)} data-testid={`button-add-element-${i}`}>+ Element</Button>
              </div>
              {(c.elements || []).map((el: string, ei: number) => (
                <div key={ei} className="flex items-center gap-1">
                  <span className="text-[10px] text-white/40 w-4">{ei + 1}.</span>
                  <Input className="text-[11px] h-6 flex-1" value={el} onChange={(e) => updateElement(i, ei, e.target.value)} placeholder="e.g. Existence of valid contract" />
                  <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-300" onClick={() => removeElement(i, ei)}>×</Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Key Dates */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/90">Key Dates & Deadlines</div>
          <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-blue-300 hover:text-blue-200" onClick={addKeyDate} data-testid="button-add-key-date">+ Add Date</Button>
        </div>
        {keyDates.map((kd, i) => (
          <div key={kd.id} className="grid grid-cols-[120px_1fr_120px_auto] gap-1 items-center" data-testid={`keydate-${i}`}>
            <Input type="date" className="text-[11px] h-7" value={kd.date} onChange={(e) => updateKeyDate(i, { date: e.target.value })} data-testid={`input-keydate-date-${i}`} />
            <Input className="text-[11px] h-7" placeholder="Label" value={kd.label} onChange={(e) => updateKeyDate(i, { label: e.target.value })} data-testid={`input-keydate-label-${i}`} />
            <Select value={kd.type} onValueChange={(v) => updateKeyDate(i, { type: v })}>
              <SelectTrigger className="bg-white text-black text-[11px] h-7"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['hearing', 'deadline', 'filing', 'service', 'other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-300" onClick={() => removeKeyDate(i)}>×</Button>
          </div>
        ))}
      </div>

      {/* Attachments — Pi-local, only after project exists */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/90">Attachments / Evidence</div>
          {projectId ? (
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-blue-300 hover:text-blue-200" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="button-upload-legal-files">
              {uploading ? 'Uploading…' : '+ Upload File(s)'}
            </Button>
          ) : (
            <span className="text-[10px] text-white/50 italic">Save project first to upload</span>
          )}
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} data-testid="input-legal-file" />
        {attachments.length === 0 ? (
          <div className="text-[10px] text-white/40 italic">No files attached yet.</div>
        ) : (
          <div className="space-y-1">
            {attachments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-black/20 border border-white/10" data-testid={`attachment-${a.id}`}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-300 hover:text-blue-200 truncate flex-1" data-testid={`link-attachment-${a.id}`}>{a.filename}</a>
                <span className="text-[10px] text-white/40">{a.size ? `${Math.round(a.size / 1024)} KB` : ''}</span>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-300" onClick={() => handleDeleteAttachment(a.id)} data-testid={`button-delete-attachment-${a.id}`}>×</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WizardSubtask {
  title: string;
  dueDate: string;
}

interface WizardTask {
  title: string;
  dueDate: string;
  priority: string;
  blockedByIdx: number[];
  expanded?: boolean;
  notes?: string;
  estimatedMinutes?: number | "";
  tags?: string;
  attachments?: string;
  repeatType?: string;
  reminder1?: number | "";
  reminder2?: number | "";
  reminder3?: number | "";
  reminder4?: number | "";
  subtasks?: WizardSubtask[];
}

function ProjectWizard({
  open,
  onOpenChange,
  onComplete,
  existingProjects = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: ProjectFormData, tasks: WizardTask[]) => Promise<void> | void;
  existingProjects?: Project[];
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ProjectFormData>({
    name: "",
    description: "",
    color: "#6366F1",
    status: "planning",
    courseName: "",
    startDate: "",
    targetDate: "",
    priority: "medium",
    notes: "",
    projectType: "general",
    metadata: null,
  });
  const [tasks, setTasks] = useState<WizardTask[]>([]);

  const reset = () => {
    setStep(0);
    setData({
      name: "",
      description: "",
      color: "#6366F1",
      status: "planning",
      courseName: "",
      startDate: "",
      targetDate: "",
      priority: "medium",
      notes: "",
      projectType: "general",
      metadata: null,
    });
    setTasks([]);
  };

  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const addTaskRow = () => {
    const dflt = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    setTasks((t) => [...t, {
      title: "", dueDate: dflt, priority: "medium", blockedByIdx: [],
      expanded: false, notes: "", estimatedMinutes: "", tags: "", attachments: "",
      repeatType: "none", reminder1: 30, reminder2: 120, reminder3: "", reminder4: "",
      subtasks: [],
    }]);
  };

  const addSubtask = (taskIdx: number) => {
    setTasks((ts) => ts.map((t, i) => i === taskIdx ? {
      ...t,
      subtasks: [...(t.subtasks || []), { title: "", dueDate: t.dueDate }],
    } : t));
  };

  const updateSubtask = (taskIdx: number, subIdx: number, patch: Partial<WizardSubtask>) => {
    setTasks((ts) => ts.map((t, i) => i === taskIdx ? {
      ...t,
      subtasks: (t.subtasks || []).map((s, j) => j === subIdx ? { ...s, ...patch } : s),
    } : t));
  };

  const removeSubtask = (taskIdx: number, subIdx: number) => {
    setTasks((ts) => ts.map((t, i) => i === taskIdx ? {
      ...t,
      subtasks: (t.subtasks || []).filter((_, j) => j !== subIdx),
    } : t));
  };

  const toggleProjectLink = (projectId: number) => {
    setData((d) => {
      const cur = d.dependsOnProjectIds || [];
      return {
        ...d,
        dependsOnProjectIds: cur.includes(projectId)
          ? cur.filter((id) => id !== projectId)
          : [...cur, projectId],
      };
    });
  };

  const updateTask = (idx: number, patch: Partial<WizardTask>) => {
    setTasks((t) => t.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const removeTask = (idx: number) => {
    setTasks((t) =>
      t
        .filter((_, i) => i !== idx)
        .map((x) => ({
          ...x,
          blockedByIdx: x.blockedByIdx
            .filter((b) => b !== idx)
            .map((b) => (b > idx ? b - 1 : b)),
        }))
    );
  };

  const toggleDep = (taskIdx: number, depIdx: number) => {
    setTasks((t) =>
      t.map((x, i) => {
        if (i !== taskIdx) return x;
        const has = x.blockedByIdx.includes(depIdx);
        return {
          ...x,
          blockedByIdx: has ? x.blockedByIdx.filter((b) => b !== depIdx) : [...x.blockedByIdx, depIdx],
        };
      })
    );
  };

  const validTasks = tasks.filter((t) => t.title.trim().length > 0);
  const showDepStep = true;
  const totalSteps = 8;

  const labels = ["Name", "Description", "Style", "Schedule", "Tags & Links", "Tasks", "Dependencies", "Review"];

  const canAdvance = () => {
    if (step === 0) return data.name.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const cleanedTasks = tasks
        .map((t, originalIdx) => ({ ...t, originalIdx }))
        .filter((t) => t.title.trim().length > 0);
      const remap: Record<number, number> = {};
      cleanedTasks.forEach((t, newIdx) => {
        remap[t.originalIdx] = newIdx;
      });
      const finalTasks: WizardTask[] = cleanedTasks.map((t) => ({
        title: t.title.trim(),
        dueDate: t.dueDate,
        priority: t.priority,
        blockedByIdx: t.blockedByIdx
          .map((b) => remap[b])
          .filter((b) => b !== undefined && b !== null) as number[],
      }));
      await onComplete(data, finalTasks);
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl text-[11px] text-white [&_label]:text-white [&_input]:text-black [&_input]:bg-white [&_select]:text-black [&_select]:bg-white [&_textarea]:text-black [&_textarea]:bg-white [&_input]:text-[11px] [&_select]:text-[11px] [&_textarea]:text-[11px]">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">Create New Project — {labels[step]}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {labels.map((label, i) => (
            <button
              key={i}
              type="button"
              data-testid={`button-wizard-step-${i}`}
              onClick={() => { if (i <= step) setStep(i); }}
              className={`px-2 py-0.5 rounded text-[10px] ${
                i === step ? "bg-white text-black" : i < step ? "bg-white/40 text-white" : "bg-white/10 text-white/40"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="min-h-[220px] space-y-3">
          {step === 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Project Name</label>
              <Input
                data-testid="input-wizard-name"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="e.g. Final Essay — POL101"
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Description</label>
              <Textarea
                data-testid="input-wizard-description"
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="What is this project about?"
                rows={4}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      data-testid="input-wizard-color"
                      value={data.color}
                      onChange={(e) => setData({ ...data, color: e.target.value })}
                      className="h-9 w-14 rounded-md border cursor-pointer"
                    />
                    <Input value={data.color} onChange={(e) => setData({ ...data, color: e.target.value })} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">Status</label>
                  <Select value={data.status} onValueChange={(v) => setData({ ...data, status: v })}>
                    <SelectTrigger data-testid="select-wizard-status" className="bg-white text-black text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium">Course (optional)</label>
                <Input
                  data-testid="input-wizard-course"
                  value={data.courseName}
                  onChange={(e) => setData({ ...data, courseName: e.target.value })}
                  placeholder="e.g. POL101"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">Start Date</label>
                  <Input
                    type="date"
                    data-testid="input-wizard-start"
                    value={data.startDate}
                    onChange={(e) => setData({ ...data, startDate: e.target.value })}
                    className="!text-black !bg-white"
                    style={{ color: "#000", background: "#fff", colorScheme: "light" }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium">Target Date</label>
                  <Input
                    type="date"
                    data-testid="input-wizard-target"
                    value={data.targetDate}
                    onChange={(e) => setData({ ...data, targetDate: e.target.value })}
                    className="!text-black !bg-white"
                    style={{ color: "#000", background: "#fff", colorScheme: "light" }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium">Priority</label>
                <Select value={data.priority} onValueChange={(v) => setData({ ...data, priority: v })}>
                  <SelectTrigger data-testid="select-wizard-priority" className="bg-white text-black text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "urgent"].map((p) => (
                      <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-[11px] font-medium">Tags / Labels (comma-separated)</label>
                <Input
                  data-testid="input-wizard-project-tags"
                  value={(data.tags || []).join(", ")}
                  onChange={(e) => setData({ ...data, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="e.g. urgent, school, group-project"
                />
                <p className="text-[10px] text-white/50">Use tags to categorize and filter projects.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium">This project depends on (other projects)</label>
                {existingProjects.length === 0 ? (
                  <p className="text-[10px] text-white/60">No other projects yet — you'll be able to add project-to-project dependencies later.</p>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-[180px] overflow-y-auto">
                    {existingProjects.map((p) => {
                      const active = (data.dependsOnProjectIds || []).includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-testid={`button-project-link-${p.id}`}
                          onClick={() => toggleProjectLink(p.id)}
                          className={`px-2 py-0.5 rounded text-[10px] truncate max-w-[180px] ${active ? "bg-orange-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                          title={active ? `Depends on: ${p.name}` : `Click to mark depends on: ${p.name}`}
                        >
                          {active ? "✓ " : ""}{p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium">Tasks for this project</label>
                <Button type="button" size="sm" variant="outline" onClick={addTaskRow} className="border-white/30 text-white hover:bg-white/10 hover:text-white h-7 text-[10px]" data-testid="button-add-task-row">
                  <Plus className="h-3 w-3 mr-1" /> Add Task
                </Button>
              </div>
              {tasks.length === 0 && (
                <p className="text-[10px] text-white/60">No tasks yet. Click "Add Task" to add one. Click the chevron on each task to set notes, reminders, recurring, files, time estimate, tags, and subtasks.</p>
              )}
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {tasks.map((t, i) => (
                  <div key={i} className="bg-white/5 p-2 rounded space-y-2">
                    <div className="flex gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => updateTask(i, { expanded: !t.expanded })}
                        className="text-white/70 hover:text-white"
                        data-testid={`button-task-expand-${i}`}
                        title={t.expanded ? "Collapse" : "Expand for more options"}
                      >
                        {t.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <Input
                        data-testid={`input-wizard-task-title-${i}`}
                        value={t.title}
                        onChange={(e) => updateTask(i, { title: e.target.value })}
                        placeholder="Task title"
                        className="flex-1 h-7"
                      />
                      <Input
                        type="date"
                        data-testid={`input-wizard-task-due-${i}`}
                        value={t.dueDate}
                        onChange={(e) => updateTask(i, { dueDate: e.target.value })}
                        className="w-32 h-7 !text-black !bg-white"
                        style={{ color: "#000", background: "#fff", colorScheme: "light" }}
                      />
                      <Select value={t.priority} onValueChange={(v) => updateTask(i, { priority: v })}>
                        <SelectTrigger data-testid={`select-wizard-task-priority-${i}`} className="w-24 h-7 bg-white text-black text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "urgent"].map((p) => (
                            <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeTask(i)} className="h-7 w-7 text-white/70 hover:text-red-400" data-testid={`button-remove-task-${i}`}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {t.expanded && (
                      <div className="pl-5 pt-1 space-y-2 border-l border-white/10">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-white/70">Estimated time (min)</label>
                            <Input
                              type="number"
                              min={0}
                              data-testid={`input-task-est-${i}`}
                              value={t.estimatedMinutes ?? ""}
                              onChange={(e) => updateTask(i, { estimatedMinutes: e.target.value === "" ? "" : Number(e.target.value) })}
                              placeholder="e.g. 60"
                              className="h-7"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-white/70">Tags (comma-separated)</label>
                            <Input
                              data-testid={`input-task-tags-${i}`}
                              value={t.tags || ""}
                              onChange={(e) => updateTask(i, { tags: e.target.value })}
                              placeholder="e.g. essay, draft"
                              className="h-7"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-white/70">Notes</label>
                          <Textarea
                            data-testid={`input-task-notes-${i}`}
                            value={t.notes || ""}
                            onChange={(e) => updateTask(i, { notes: e.target.value })}
                            placeholder="Anything to remember about this task…"
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-white/70">File attachments (one URL per line)</label>
                          <Textarea
                            data-testid={`input-task-attachments-${i}`}
                            value={t.attachments || ""}
                            onChange={(e) => updateTask(i, { attachments: e.target.value })}
                            placeholder="https://drive.google.com/…"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-white/70">Repeat</label>
                            <Select value={t.repeatType || "none"} onValueChange={(v) => updateTask(i, { repeatType: v })}>
                              <SelectTrigger data-testid={`select-task-repeat-${i}`} className="h-7 bg-white text-black text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["none", "daily", "weekly", "monthly"].map((r) => (
                                  <SelectItem key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-white/70">Reminders (minutes before due)</label>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((n) => {
                              const key = `reminder${n}` as "reminder1" | "reminder2" | "reminder3" | "reminder4";
                              const val = t[key];
                              return (
                                <Input
                                  key={n}
                                  type="number"
                                  min={0}
                                  data-testid={`input-task-reminder${n}-${i}`}
                                  value={val ?? ""}
                                  onChange={(e) => updateTask(i, { [key]: e.target.value === "" ? "" : Number(e.target.value) } as Partial<WizardTask>)}
                                  placeholder={n === 1 ? "30" : n === 2 ? "120" : "—"}
                                  className="h-7"
                                />
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-white/50">Common: 30 (30 min), 120 (2 h), 1440 (1 day), 10080 (1 week). Leave blank for none.</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-white/70">Subtasks</label>
                            <Button type="button" size="sm" variant="outline" onClick={() => addSubtask(i)} className="border-white/30 text-white hover:bg-white/10 hover:text-white h-6 text-[10px]" data-testid={`button-add-subtask-${i}`}>
                              <Plus className="h-3 w-3 mr-1" /> Subtask
                            </Button>
                          </div>
                          {(t.subtasks || []).length === 0 ? (
                            <p className="text-[9px] text-white/50">No subtasks.</p>
                          ) : (
                            <div className="space-y-1">
                              {(t.subtasks || []).map((s, j) => (
                                <div key={j} className="flex gap-1 items-center">
                                  <Input
                                    data-testid={`input-subtask-title-${i}-${j}`}
                                    value={s.title}
                                    onChange={(e) => updateSubtask(i, j, { title: e.target.value })}
                                    placeholder="Subtask title"
                                    className="flex-1 h-7"
                                  />
                                  <Input
                                    type="date"
                                    data-testid={`input-subtask-due-${i}-${j}`}
                                    value={s.dueDate}
                                    onChange={(e) => updateSubtask(i, j, { dueDate: e.target.value })}
                                    className="w-32 h-7 !text-black !bg-white"
                                    style={{ color: "#000", background: "#fff", colorScheme: "light" }}
                                  />
                                  <Button type="button" size="icon" variant="ghost" onClick={() => removeSubtask(i, j)} className="h-6 w-6 text-white/70 hover:text-red-400" data-testid={`button-remove-subtask-${i}-${j}`}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Task Dependencies</label>
              <p className="text-[10px] text-white/60">For each task, click any task that must be completed first (it will be marked as a "blocked by" dependency).</p>
              {validTasks.length < 2 && (
                <div className="bg-white/5 p-3 rounded text-[11px] text-white/70">
                  Add at least 2 tasks in the previous step to set up dependencies between them. You can also skip this step and add dependencies later from the workflow view on the project card.
                </div>
              )}
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {validTasks.map((t, i) => (
                  <div key={i} className="bg-white/5 p-2 rounded">
                    <div className="text-[11px] font-medium mb-1 truncate">{i + 1}. {t.title}</div>
                    <div className="flex flex-wrap gap-1">
                      {validTasks.map((other, j) => {
                        if (i === j) return null;
                        const active = t.blockedByIdx.includes(j);
                        return (
                          <button
                            key={j}
                            type="button"
                            data-testid={`button-dep-${i}-${j}`}
                            onClick={() => toggleDep(i, j)}
                            className={`px-2 py-0.5 rounded text-[10px] truncate max-w-[140px] ${
                              active ? "bg-orange-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
                            }`}
                            title={active ? `Blocked by: ${other.title}` : `Click to mark blocked by: ${other.title}`}
                          >
                            {active ? "✓ " : ""}{other.title || `Task ${j + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-2 text-[11px]">
              <div className="bg-white/5 p-3 rounded space-y-1">
                <div><span className="text-white/60">Name:</span> <span className="font-medium">{data.name || "(unnamed)"}</span></div>
                {data.description && <div><span className="text-white/60">Description:</span> {data.description}</div>}
                <div className="flex gap-3 flex-wrap">
                  <span><span className="text-white/60">Status:</span> {data.status}</span>
                  <span><span className="text-white/60">Priority:</span> {data.priority}</span>
                  {data.courseName && <span><span className="text-white/60">Course:</span> {data.courseName}</span>}
                  {data.targetDate && <span><span className="text-white/60">Due:</span> {data.targetDate}</span>}
                </div>
                {data.tags && data.tags.length > 0 && (
                  <div><span className="text-white/60">Tags:</span> {data.tags.join(", ")}</div>
                )}
                {data.dependsOnProjectIds && data.dependsOnProjectIds.length > 0 && (
                  <div><span className="text-white/60">Depends on projects:</span> {data.dependsOnProjectIds.map((id) => existingProjects.find((p) => p.id === id)?.name || `#${id}`).join(", ")}</div>
                )}
              </div>
              <div className="bg-white/5 p-3 rounded">
                <div className="text-white/60 mb-1">Tasks ({validTasks.length})</div>
                {validTasks.length === 0 ? (
                  <div className="text-white/50 text-[10px]">None — you can add tasks from the project card later.</div>
                ) : (
                  <ul className="space-y-1">
                    {validTasks.map((t, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">{i + 1}. {t.title} <span className="text-white/40">({t.priority})</span></span>
                        <span className="text-white/60 text-[10px]">{t.dueDate}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {showDepStep && validTasks.some((t) => t.blockedByIdx.length > 0) && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-white/60 mb-1">Dependencies</div>
                    <ul className="space-y-0.5 text-[10px]">
                      {validTasks.map((t, i) =>
                        t.blockedByIdx.length > 0 ? (
                          <li key={i}>
                            <span className="font-medium">{t.title}</span>
                            <span className="text-white/50"> blocked by: </span>
                            {t.blockedByIdx.map((b) => validTasks[b]?.title || `Task ${b + 1}`).join(", ")}
                          </li>
                        ) : null
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || submitting}
            className="border-white/30 text-white hover:bg-white/10 hover:text-white"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-3 w-3 mr-1" /> Back
          </Button>
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance() || submitting}
              className="border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent"
              data-testid="button-wizard-next"
            >
              Next <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleFinish}
              disabled={submitting || data.name.trim().length === 0}
              className="border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)]"
              data-testid="button-wizard-finish"
            >
              {submitting ? "Creating..." : "Create Project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ 
  project, 
  open, 
  onOpenChange, 
  onSave 
}: { 
  project?: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ProjectFormData) => void;
}) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: project?.name || "",
    description: project?.description || "",
    color: project?.color || "#6366F1",
    status: project?.status || "planning",
    courseName: project?.courseName || "",
    startDate: project?.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
    targetDate: project?.targetDate ? format(new Date(project.targetDate), "yyyy-MM-dd") : "",
    priority: project?.priority || "medium",
    notes: project?.notes || "",
    projectType: (project as any)?.projectType || "general",
    metadata: (project as any)?.metadata || null,
    initialTasks: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg text-[11px] text-white [&_label]:text-white [&_input]:text-black [&_input]:bg-white [&_select]:text-black [&_select]:bg-white [&_textarea]:text-black [&_textarea]:bg-white [&_input]:text-[11px] [&_select]:text-[11px] [&_textarea]:text-[11px]">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">{project ? "Edit Project" : "Create New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-white">Project Name</label>
            <Input 
              data-testid="input-project-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium">Description</label>
            <Textarea 
              data-testid="input-project-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your project..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Color</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color"
                  data-testid="input-project-color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-9 w-14 rounded-md border cursor-pointer"
                />
                <Input 
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium">Status</label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger data-testid="select-project-status" className="bg-white text-black text-[11px] [&>span]:text-black [&>span]:text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Course (optional)</label>
              <Select 
                value={formData.courseName || "none"} 
                onValueChange={(v) => setFormData({ ...formData, courseName: v === "none" ? "" : v })}
              >
                <SelectTrigger data-testid="select-project-course" className="bg-white text-black text-[11px] [&>span]:text-black [&>span]:text-[11px]">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Course</SelectItem>
                  <SelectItem value="CPPA122">CPPA122</SelectItem>
                  <SelectItem value="CFNF400">CFNF400</SelectItem>
                  <SelectItem value="CASL101">CASL101</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium">Priority</label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger data-testid="select-project-priority" className="bg-white text-black text-[11px] [&>span]:text-black [&>span]:text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Start Date</label>
              <Input 
                type="date"
                data-testid="input-project-start-date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Target Date</label>
              <Input 
                type="date"
                data-testid="input-project-target-date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium">Project Type</label>
            <Select
              value={formData.projectType}
              onValueChange={(v) => setFormData({ ...formData, projectType: v })}
            >
              <SelectTrigger data-testid="select-project-type" className="bg-white text-black text-[11px] [&>span]:text-black [&>span]:text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Project</SelectItem>
                <SelectItem value="legal_complaint">Legal Complaint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.projectType === 'legal_complaint' && (
            <LegalComplaintEditor
              metadata={formData.metadata}
              onChange={(m) => setFormData({ ...formData, metadata: m })}
              projectId={project?.id}
            />
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-medium">Notes</label>
            <Textarea 
              data-testid="input-project-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-white/30 text-white hover:bg-white/10 hover:text-white">
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="outline"
              data-testid="button-save-project"
              className="border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
            >
              {project ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ 
  project, 
  tasks, 
  onEdit, 
  onDelete,
  expanded,
  onToggleExpand,
  headerBarColor,
  onRename,
  onAddTask,
  isAddingTask,
}: { 
  project: Project;
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  headerBarColor: string;
  onRename: (name: string) => void;
  onAddTask: (title: string, dueDate: string) => void;
  isAddingTask: boolean;
}) {
  const completedTasks = tasks.filter(t => t.isCompleted);
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDate, setAddDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const submitAdd = () => {
    const t = addTitle.trim();
    if (!t || !addDate) return;
    onAddTask(t, addDate);
    setAddTitle("");
    setAddOpen(false);
  };
  
  return (
    <div 
      data-testid={`card-project-${project.id}`}
      className="rounded-[12px] overflow-hidden flex flex-col hover-elevate transition-all"
      style={{ 
        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 100%)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.1)'
      }}
    >
      {/* Header - matching Today box header */}
      <div 
        style={{ 
          backgroundColor: headerBarColor,
          padding: '8px 12px'
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30" 
              style={{ backgroundColor: project.color || "#6366F1" }} 
            />
            {isEditingName ? (
              <input
                className="text-xs font-medium text-white bg-white/20 border border-white/40 rounded px-1 py-0.5 outline-none w-full"
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif" }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim() && editName.trim() !== project.name) {
                    onRename(editName.trim());
                  } else {
                    setEditName(project.name);
                  }
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    setEditName(project.name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                data-testid={`input-rename-project-${project.id}`}
              />
            ) : (
              <span 
                className="text-xs font-medium text-white truncate cursor-text"
                style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                onClick={(e) => { e.stopPropagation(); setEditName(project.name); setIsEditingName(true); }}
                data-testid={`text-project-name-${project.id}`}
              >
                {project.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onEdit}
              className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
              data-testid={`button-edit-project-${project.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onDelete}
              className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
              data-testid={`button-delete-project-${project.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Body */}
      <div className="flex-1 p-3">
        {project.description && (
          <p className="text-xs text-white/80 mb-3 line-clamp-2">
            {project.description}
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge className={`${getStatusColor(project.status || "planning")} text-xs`}>
            {getStatusIcon(project.status || "planning")}
            <span className="ml-1">{(project.status || "planning").replace("_", " ")}</span>
          </Badge>
          <Badge className={`${getPriorityColor(project.priority || "medium")} text-xs`}>
            {(project.priority || "medium").toUpperCase()}
          </Badge>
          {project.courseName && (
            <Badge 
              className="text-xs"
              style={{ 
                backgroundColor: COURSE_COLORS[project.courseName] || "#6366F1",
                color: "white"
              }}
            >
              {project.courseName}
            </Badge>
          )}
          {(project as any).projectType === 'legal_complaint' && (
            <Badge className="text-xs bg-amber-500/30 text-amber-100 border border-amber-400/50" data-testid={`badge-legal-${project.id}`}>
              ⚖ LEGAL
            </Badge>
          )}
        </div>

        {(project as any).projectType === 'legal_complaint' && (() => {
          const meta: any = (project as any).metadata || {};
          const caseNum = meta.jurisdiction?.caseNumber;
          const court = meta.jurisdiction?.court;
          const allDates: { date: string; label: string }[] = [];
          if (meta.filing?.responseDeadline) allDates.push({ date: meta.filing.responseDeadline, label: 'Response due' });
          (meta.keyDates || []).forEach((kd: any) => kd.date && allDates.push({ date: kd.date, label: kd.label || kd.type }));
          const upcoming = allDates
            .filter(d => new Date(d.date) >= new Date(new Date().toDateString()))
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          const claimsCount = (meta.claims || []).length;
          const attCount = (meta.attachments || []).length;
          const daysUntil = upcoming ? Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
          return (
            <div className="mb-3 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-100 space-y-0.5" data-testid={`legal-summary-${project.id}`}>
              {(caseNum || court) && (
                <div className="flex items-center gap-2 truncate">
                  {caseNum && <span className="font-semibold" data-testid={`text-case-number-${project.id}`}>{caseNum}</span>}
                  {court && <span className="text-amber-200/80 truncate">{court}</span>}
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-amber-200/90">
                <span>{claimsCount} claim{claimsCount === 1 ? '' : 's'}</span>
                <span>{attCount} file{attCount === 1 ? '' : 's'}</span>
                {upcoming && (
                  <span data-testid={`text-next-deadline-${project.id}`}>
                    Next: {upcoming.label} in <span className={daysUntil != null && daysUntil <= 7 ? 'text-red-300 font-semibold' : 'font-semibold'}>{daysUntil}d</span>
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        <div className="flex items-center gap-4 text-xs text-white/70 mb-3">
          {project.startDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Start: {format(new Date(project.startDate), "MMM d")}</span>
            </div>
          )}
          {project.targetDate && (
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>Due: {format(new Date(project.targetDate), "MMM d")}</span>
            </div>
          )}
        </div>

        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-xs text-white/80">
            <span>Progress</span>
            <span className="font-medium">{completedTasks.length}/{tasks.length} tasks</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggleExpand}
            className="flex-1 justify-center gap-1 text-white hover:text-white hover:bg-white/20 text-xs"
            data-testid={`button-toggle-tasks-${project.id}`}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Hide Tasks
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Show Tasks ({tasks.length})
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(o => !o)}
            className="gap-1 text-white hover:text-white hover:bg-white/20 text-xs px-2"
            data-testid={`button-add-task-${project.id}`}
            title="Add task to this project"
          >
            <Plus className="w-3.5 h-3.5" />
            Task
          </Button>
        </div>

        {addOpen && (
          <div className="mt-2 p-2 rounded-md bg-white/15 border border-white/30 space-y-2" data-testid={`form-add-task-${project.id}`}>
            <input
              type="text"
              autoFocus
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); else if (e.key === 'Escape') setAddOpen(false); }}
              placeholder="Task title..."
              className="w-full bg-white/20 border border-white/30 rounded px-2 py-1.5 text-white text-xs placeholder-white/50 focus:outline-none focus:border-white/60"
              data-testid={`input-new-task-title-${project.id}`}
            />
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="flex-1 bg-white/20 border border-white/30 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/60 [color-scheme:dark]"
                data-testid={`input-new-task-date-${project.id}`}
              />
              <Button
                size="sm"
                onClick={submitAdd}
                disabled={isAddingTask || !addTitle.trim() || !addDate}
                className="text-xs h-7"
                data-testid={`button-confirm-add-task-${project.id}`}
              >
                {isAddingTask ? "..." : "Add"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setAddOpen(false); setAddTitle(""); }}
                className="text-xs h-7 text-white hover:bg-white/20"
                data-testid={`button-cancel-add-task-${project.id}`}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {expanded && tasks.length > 0 && (
          <div className="space-y-1 pt-2 mt-2 border-t border-white/30">
            {tasks.map((task) => (
              <div 
                key={task.id}
                className={`flex items-center gap-2 p-2 rounded-md text-xs ${
                  task.isCompleted 
                    ? "bg-green-500/20 line-through text-white/60" 
                    : "bg-white/20 text-white"
                }`}
                data-testid={`task-item-${task.id}`}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/50 flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{task.title}</span>
                {task.dueDate && (
                  <span className="text-[10px] text-white/60">
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
}

function WorkflowView({ 
  project, 
  tasks,
  taskLinks 
}: { 
  project: Project;
  tasks: Task[];
  taskLinks: TaskLink[];
}) {
  const taskMap = useMemo(() => {
    const map = new Map<number, Task>();
    tasks.forEach(t => map.set(t.id, t));
    return map;
  }, [tasks]);

  const taskDependencies = useMemo(() => {
    const deps = new Map<number, { blocks: number[]; blockedBy: number[] }>();
    const taskIds = new Set(tasks.map(t => t.id));
    tasks.forEach(t => deps.set(t.id, { blocks: [], blockedBy: [] }));
    
    // Only process links where both source and target are tasks in this project
    taskLinks.forEach(link => {
      if (link.sourceType === 'task' && link.targetType === 'task') {
        // Filter to only include links between tasks in THIS project
        if (!taskIds.has(link.sourceId) || !taskIds.has(link.targetId)) return;
        
        if (link.linkType === 'blocks') {
          const source = deps.get(link.sourceId);
          if (source) source.blocks.push(link.targetId);
          const target = deps.get(link.targetId);
          if (target) target.blockedBy.push(link.sourceId);
        } else if (link.linkType === 'blocked_by') {
          const source = deps.get(link.sourceId);
          if (source) source.blockedBy.push(link.targetId);
          const target = deps.get(link.targetId);
          if (target) target.blocks.push(link.sourceId);
        }
      }
    });
    return deps;
  }, [tasks, taskLinks]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDeps = taskDependencies.get(a.id);
      const bDeps = taskDependencies.get(b.id);
      const aBlockedCount = aDeps?.blockedBy.length || 0;
      const bBlockedCount = bDeps?.blockedBy.length || 0;
      if (aBlockedCount !== bBlockedCount) return aBlockedCount - bBlockedCount;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, taskDependencies]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No tasks in this project yet.</p>
        <p className="text-sm">Add tasks and create dependencies to see the workflow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedTasks.map((task, index) => {
        const deps = taskDependencies.get(task.id);
        const blockedByTasks = deps?.blockedBy.map(id => taskMap.get(id)).filter(Boolean) || [];
        const blocksTasks = deps?.blocks.map(id => taskMap.get(id)).filter(Boolean) || [];
        const isBlocked = blockedByTasks.some(t => !t?.isCompleted);
        
        return (
          <div key={task.id} className="relative">
            {index > 0 && blockedByTasks.length > 0 && (
              <div className="absolute left-6 -top-3 h-3 w-0.5 bg-orange-400" />
            )}
            <Card 
              className={`${
                task.isCompleted 
                  ? 'bg-green-50/50 dark:bg-green-900/10' 
                  : isBlocked 
                    ? 'bg-orange-50/50 dark:bg-orange-900/10'
                    : ''
              }`}
              data-testid={`workflow-task-${task.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${task.isCompleted ? 'text-green-500' : isBlocked ? 'text-orange-500' : 'text-blue-500'}`}>
                    {task.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isBlocked ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Unlock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                      {task.courseName && (
                        <Badge 
                          className="text-[10px] py-0"
                          style={{ 
                            backgroundColor: COURSE_COLORS[task.courseName] || "#6366F1",
                            color: "white"
                          }}
                        >
                          {task.courseName}
                        </Badge>
                      )}
                    </div>
                    
                    {blockedByTasks.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Blocked by:
                        </span>
                        {blockedByTasks.map(t => (
                          <Badge 
                            key={t!.id} 
                            variant="outline" 
                            className={`text-[10px] ${t!.isCompleted ? 'line-through opacity-50' : 'border-orange-300'}`}
                          >
                            {t!.title}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {blocksTasks.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" /> Blocks:
                        </span>
                        {blocksTasks.map(t => (
                          <Badge 
                            key={t!.id} 
                            variant="outline" 
                            className={`text-[10px] ${t!.isCompleted ? 'line-through opacity-50' : 'border-blue-300'}`}
                          >
                            {t!.title}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const savedColors = useMemo(() => {
    try {
      const saved = localStorage.getItem('colorSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          headerBar: parsed.headerBar || '#160502',
          mainBackground: parsed.mainBackground || '#3a8bbf',
          mainBackgroundGradient: parsed.mainBackgroundGradient ?? true,
          mainBackgroundGradientEnd: parsed.mainBackgroundGradientEnd || '#164a72',
        };
      }
    } catch {}
    return { headerBar: '#160502', mainBackground: '#3a8bbf', mainBackgroundGradient: true, mainBackgroundGradientEnd: '#164a72' };
  }, []);
  const headerBarColor = savedColors.headerBar;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list" | "workflow">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: allTaskLinks = [] } = useQuery<TaskLink[]>({
    queryKey: ["/api/links"],
    enabled: viewMode === "workflow",
  });

  const tasksByProject = useMemo(() => {
    const map = new Map<number, Task[]>();
    allTasks.forEach(task => {
      if (task.projectId) {
        const existing = map.get(task.projectId) || [];
        existing.push(task);
        map.set(task.projectId, existing);
      }
    });
    return map;
  }, [allTasks]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === "all") return projects;
    return projects.filter(p => p.status === statusFilter);
  }, [projects, statusFilter]);

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProjectFormData> }) => {
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

  const addTaskToProjectMutation = useMutation({
    mutationFn: async (data: { title: string; dueDate: string; projectId: number }) => {
      return await apiRequest("POST", "/api/tasks", {
        title: data.title,
        dueDate: data.dueDate,
        projectId: data.projectId,
        taskType: "homework",
        type: "task",
        priority: "medium",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task added to project" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to add task", description: e?.message || "", variant: "destructive" });
    },
  });

  const handleSaveProject = (data: ProjectFormData) => {
    const { initialTasks: _ignore, ...projectData } = data;
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data: projectData as ProjectFormData });
    } else {
      createProjectMutation.mutate(projectData as ProjectFormData);
    }
    setEditingProject(null);
    setDialogOpen(false);
  };

  const handleWizardComplete = async (data: ProjectFormData, wizardTasks: WizardTask[]) => {
    try {
      const res: any = await createProjectMutation.mutateAsync(data);
      const created: any = res && typeof res.json === "function" ? await res.json() : res;
      const newProjectId = created?.id ?? created?.project?.id;
      if (!newProjectId) return;

      const newTaskIds: number[] = [];
      let subtaskCount = 0;
      for (const wt of wizardTasks) {
        try {
          const attachmentList = (wt.attachments || "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          const tagList = (wt.tags || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const taskPayload: any = {
            title: wt.title,
            dueDate: wt.dueDate,
            projectId: newProjectId,
            taskType: "homework",
            type: "task",
            priority: wt.priority,
          };
          if (wt.notes) taskPayload.notes = wt.notes;
          if (typeof wt.estimatedMinutes === "number" && wt.estimatedMinutes > 0) {
            taskPayload.estimatedMinutes = wt.estimatedMinutes;
          }
          if (tagList.length > 0) taskPayload.tags = tagList;
          if (attachmentList.length > 0) taskPayload.attachments = attachmentList;
          if (wt.repeatType && wt.repeatType !== "none") taskPayload.repeatType = wt.repeatType;
          if (typeof wt.reminder1 === "number") taskPayload.reminder1 = wt.reminder1;
          if (typeof wt.reminder2 === "number") taskPayload.reminder2 = wt.reminder2;
          if (typeof wt.reminder3 === "number") taskPayload.reminder3 = wt.reminder3;
          if (typeof wt.reminder4 === "number") taskPayload.reminder4 = wt.reminder4;
          const tRes: any = await apiRequest("POST", "/api/tasks", taskPayload);
          const tCreated: any = tRes && typeof tRes.json === "function" ? await tRes.json() : tRes;
          const tid = tCreated?.id ?? tCreated?.task?.id;
          newTaskIds.push(tid);
          if (tid && wt.subtasks && wt.subtasks.length > 0) {
            for (const sub of wt.subtasks) {
              if (!sub.title.trim()) continue;
              try {
                await apiRequest("POST", `/api/tasks/${tid}/subtasks`, {
                  title: sub.title.trim(),
                  dueDate: sub.dueDate || wt.dueDate,
                });
                subtaskCount++;
              } catch { /* ignore individual subtask failures */ }
            }
          }
        } catch {
          newTaskIds.push(0);
        }
      }

      let depCount = 0;
      for (let i = 0; i < wizardTasks.length; i++) {
        const sourceId = newTaskIds[i];
        if (!sourceId) continue;
        for (const blockerIdx of wizardTasks[i].blockedByIdx) {
          const targetId = newTaskIds[blockerIdx];
          if (!targetId) continue;
          try {
            await apiRequest("POST", "/api/links", {
              sourceType: "task",
              sourceId,
              targetType: "task",
              targetId,
              linkType: "blocked_by",
            });
            depCount++;
          } catch { /* ignore individual link failures */ }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      const taskCount = newTaskIds.filter(Boolean).length;
      if (taskCount > 0 || depCount > 0 || subtaskCount > 0) {
        const parts: string[] = [];
        if (taskCount > 0) parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`);
        if (subtaskCount > 0) parts.push(`${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}`);
        if (depCount > 0) parts.push(`${depCount} dependency link${depCount === 1 ? "" : "s"}`);
        toast({ title: `Created project with ${parts.join(", ")}` });
      }
      if (subtaskCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/subtasks"] });
      }
    } catch {
      // createProjectMutation already shows an error toast
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleDeleteProject = (id: number) => {
    if (window.confirm("Are you sure you want to delete this project? Tasks will be unlinked but not deleted.")) {
      deleteProjectMutation.mutate(id);
    }
  };

  const toggleProjectExpanded = (id: number) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const projectStats = useMemo(() => {
    const stats = {
      total: projects.length,
      planning: 0,
      in_progress: 0,
      on_hold: 0,
      completed: 0,
      cancelled: 0,
    };
    projects.forEach(p => {
      const status = p.status as keyof typeof stats;
      if (status in stats) stats[status]++;
    });
    return stats;
  }, [projects]);

  const overallProgress = useMemo(() => {
    const tasksWithProjects = allTasks.filter(t => t.projectId);
    const completedTasks = tasksWithProjects.filter(t => t.isCompleted);
    const totalTasks = tasksWithProjects.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
    
    const byPriority = {
      high: { total: 0, completed: 0 },
      medium: { total: 0, completed: 0 },
      low: { total: 0, completed: 0 },
    };
    
    projects.forEach(p => {
      const tasks = tasksByProject.get(p.id) || [];
      const priority = (p.priority || 'medium') as keyof typeof byPriority;
      if (priority in byPriority) {
        byPriority[priority].total += tasks.length;
        byPriority[priority].completed += tasks.filter(t => t.isCompleted).length;
      }
    });

    return {
      totalTasks,
      completedTasks: completedTasks.length,
      completionRate,
      pendingTasks: totalTasks - completedTasks.length,
      byPriority,
    };
  }, [allTasks, projects, tasksByProject]);

  return (
    <div 
      className="min-h-screen"
      style={{
        background: savedColors.mainBackgroundGradient 
          ? `linear-gradient(180deg, ${savedColors.mainBackground} 0%, ${savedColors.mainBackgroundGradientEnd} 100%)`
          : savedColors.mainBackground,
        backgroundAttachment: 'fixed',
        fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <header className="border-b border-white/20 sticky top-0 z-10 backdrop-blur-sm" style={{ backgroundColor: savedColors.mainBackgroundGradientEnd }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Link href="/">
                <div 
                  style={{ 
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(0deg, #042550 0%, #4578B0 100%)',
                    padding: '1px',
                    cursor: 'pointer'
                  }}
                  data-testid="button-back-home"
                >
                  <Button variant="ghost" size="icon" className="!h-[42px] !w-[42px] !min-h-[42px] !min-w-[42px] !p-0 aspect-square hover:opacity-80 rounded-full border-0 transition-all duration-200" style={{ 
                    background: 'linear-gradient(180deg, #042550 0%, #4578B0 100%)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </Button>
                </div>
              </Link>
              <div>
                <h1 className="text-base font-bold flex items-center gap-1.5 text-white">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Projects
                </h1>
                <p className="text-sm text-white/70">
                  {projects.length} projects, {allTasks.filter(t => t.projectId).length} tasks assigned
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex rounded-md">
                <Button 
                  variant={viewMode === "grid" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grid"
                  style={{ 
                    background: 'linear-gradient(to bottom, #042550, #4578B0)',
                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.5), 0 0 16px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                  }}
                  className="text-white hover:text-white border border-blue-400/50 rounded-md"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button 
                  variant={viewMode === "list" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                  className="text-white hover:text-white hover:bg-white/10"
                >
                  <LayoutList className="w-4 h-4" />
                </Button>
                <Button 
                  variant={viewMode === "workflow" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setViewMode("workflow")}
                  data-testid="button-view-workflow"
                  className="text-white hover:text-white hover:bg-white/10"
                >
                  <GitBranch className="w-4 h-4" />
                </Button>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => { setEditingProject(null); setDialogOpen(true); }}
                data-testid="button-create-project"
                className="border !border-blue-500 text-white hover:text-white hover:!border-blue-400 hover:bg-transparent shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-transparent transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
          <div 
            className={`cursor-pointer hover-elevate rounded-[12px] p-4 text-center ${statusFilter === "all" ? "bg-white/50" : ""}`}
            onClick={() => setStatusFilter("all")}
            data-testid="filter-all"
            style={{ 
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <div className="text-2xl font-bold text-white" data-testid="stat-total">{projectStats.total}</div>
            <div className="text-sm text-white/70">All Projects</div>
          </div>
          <div 
            className={`cursor-pointer hover-elevate rounded-[12px] p-4 text-center ${statusFilter === "in_progress" ? "bg-white/50" : ""}`}
            onClick={() => setStatusFilter("in_progress")}
            data-testid="filter-in-progress"
            style={{ 
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <div className="text-2xl font-bold text-yellow-300" data-testid="stat-in-progress">{projectStats.in_progress}</div>
            <div className="text-sm text-white/70">In Progress</div>
          </div>
          <div 
            className={`cursor-pointer hover-elevate rounded-[12px] p-4 text-center ${statusFilter === "planning" ? "bg-white/50" : ""}`}
            onClick={() => setStatusFilter("planning")}
            data-testid="filter-planning"
            style={{ 
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <div className="text-2xl font-bold text-blue-300" data-testid="stat-planning">{projectStats.planning}</div>
            <div className="text-sm text-white/70">Planning</div>
          </div>
          <div 
            className={`cursor-pointer hover-elevate rounded-[12px] p-4 text-center ${statusFilter === "completed" ? "bg-white/50" : ""}`}
            onClick={() => setStatusFilter("completed")}
            data-testid="filter-completed"
            style={{ 
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <div className="text-2xl font-bold text-green-300" data-testid="stat-completed">{projectStats.completed}</div>
            <div className="text-sm text-white/70">Completed</div>
          </div>
          <div 
            className={`cursor-pointer hover-elevate rounded-[12px] p-4 text-center ${statusFilter === "on_hold" ? "bg-white/50" : ""}`}
            onClick={() => setStatusFilter("on_hold")}
            data-testid="filter-on-hold"
            style={{ 
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <div className="text-2xl font-bold text-gray-300" data-testid="stat-on-hold">{projectStats.on_hold}</div>
            <div className="text-sm text-white/70">On Hold</div>
          </div>
        </div>

        {overallProgress.totalTasks > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{overallProgress.completionRate}%</div>
                  <div className="text-sm text-muted-foreground">Completion Rate</div>
                  <Progress value={overallProgress.completionRate} className="h-2 mt-2" />
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{overallProgress.completedTasks}</div>
                  <div className="text-sm text-muted-foreground">Completed Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{overallProgress.pendingTasks}</div>
                  <div className="text-sm text-muted-foreground">Pending Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{overallProgress.totalTasks}</div>
                  <div className="text-sm text-muted-foreground">Total Tasks</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-medium text-red-600">
                    High Priority
                  </div>
                  <div className="text-lg font-bold">
                    {overallProgress.byPriority.high.completed}/{overallProgress.byPriority.high.total}
                  </div>
                  <Progress 
                    value={overallProgress.byPriority.high.total > 0 
                      ? (overallProgress.byPriority.high.completed / overallProgress.byPriority.high.total) * 100 
                      : 0} 
                    className="h-1.5 mt-1" 
                  />
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-medium text-orange-600">
                    Medium Priority
                  </div>
                  <div className="text-lg font-bold">
                    {overallProgress.byPriority.medium.completed}/{overallProgress.byPriority.medium.total}
                  </div>
                  <Progress 
                    value={overallProgress.byPriority.medium.total > 0 
                      ? (overallProgress.byPriority.medium.completed / overallProgress.byPriority.medium.total) * 100 
                      : 0} 
                    className="h-1.5 mt-1" 
                  />
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-medium text-green-600">
                    Low Priority
                  </div>
                  <div className="text-lg font-bold">
                    {overallProgress.byPriority.low.completed}/{overallProgress.byPriority.low.total}
                  </div>
                  <Progress 
                    value={overallProgress.byPriority.low.total > 0 
                      ? (overallProgress.byPriority.low.completed / overallProgress.byPriority.low.total) * 100 
                      : 0} 
                    className="h-1.5 mt-1" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {projectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {statusFilter === "all" ? "No projects yet" : `No ${statusFilter.replace("_", " ")} projects`}
            </h3>
            <p className="text-muted-foreground mb-4">
              Create a project to organize your tasks and track progress.
            </p>
            <Button onClick={() => { setEditingProject(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>
          </div>
        ) : viewMode === "workflow" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Select 
                value={selectedProjectId?.toString() || ""} 
                onValueChange={(v) => setSelectedProjectId(v ? Number(v) : null)}
              >
                <SelectTrigger className="w-[280px]" data-testid="select-workflow-project">
                  <SelectValue placeholder="Select a project to view workflow" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: p.color || "#6366F1" }} 
                        />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProjectId && (
                <Badge className={getStatusColor(projects.find(p => p.id === selectedProjectId)?.status || "planning")}>
                  {(projects.find(p => p.id === selectedProjectId)?.status || "planning").replace("_", " ")}
                </Badge>
              )}
            </div>
            
            {selectedProjectId ? (
              <WorkflowView 
                project={projects.find(p => p.id === selectedProjectId)!}
                tasks={tasksByProject.get(selectedProjectId) || []}
                taskLinks={allTaskLinks}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a project above to view its task workflow and dependencies.</p>
              </div>
            )}
          </div>
        ) : (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" 
            : "space-y-8"
          }>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={tasksByProject.get(project.id) || []}
                onEdit={() => handleEditProject(project)}
                onDelete={() => handleDeleteProject(project.id)}
                expanded={expandedProjects.has(project.id)}
                onToggleExpand={() => toggleProjectExpanded(project.id)}
                headerBarColor={headerBarColor}
                onRename={(name) => updateProjectMutation.mutate({ id: project.id, data: { name } })}
                onAddTask={(title, dueDate) => addTaskToProjectMutation.mutate({ title, dueDate, projectId: project.id })}
                isAddingTask={addTaskToProjectMutation.isPending}
              />
            ))}
          </div>
        )}
      </main>

      {editingProject ? (
        <ProjectDialog
          project={editingProject}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingProject(null);
          }}
          onSave={handleSaveProject}
        />
      ) : (
        <ProjectWizard
          existingProjects={projects}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingProject(null);
          }}
          onComplete={handleWizardComplete}
        />
      )}
    </div>
  );
}
