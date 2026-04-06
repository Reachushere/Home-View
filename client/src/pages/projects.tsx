import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Unlock
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
    case "planning": return <Lightbulb className="w-3.5 h-3.5" />;
    case "in_progress": return <Clock className="w-3.5 h-3.5" />;
    case "on_hold": return <PauseCircle className="w-3.5 h-3.5" />;
    case "completed": return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "cancelled": return <XCircle className="w-3.5 h-3.5" />;
    default: return <FolderOpen className="w-3.5 h-3.5" />;
  }
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case "planning": return { background: 'rgba(96,165,250,0.15)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.3)' };
    case "in_progress": return { background: 'rgba(251,191,36,0.15)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.3)' };
    case "on_hold": return { background: 'rgba(156,163,175,0.15)', color: '#d1d5db', border: '1px solid rgba(156,163,175,0.3)' };
    case "completed": return { background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' };
    case "cancelled": return { background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' };
    default: return { background: 'rgba(156,163,175,0.15)', color: '#d1d5db', border: '1px solid rgba(156,163,175,0.3)' };
  }
}

function getPriorityBadgeStyle(priority: string) {
  switch (priority) {
    case "high": return { background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' };
    case "medium": return { background: 'rgba(249,115,22,0.12)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.25)' };
    case "low": return { background: 'rgba(34,197,94,0.12)', color: '#86efac', border: '1px solid rgba(34,197,94,0.25)' };
    default: return { background: 'rgba(156,163,175,0.12)', color: '#d1d5db', border: '1px solid rgba(156,163,175,0.25)' };
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
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: project?.name || "",
        description: project?.description || "",
        color: project?.color || "#6366F1",
        status: project?.status || "planning",
        courseName: project?.courseName || "",
        startDate: project?.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
        targetDate: project?.targetDate ? format(new Date(project.targetDate), "yyyy-MM-dd") : "",
        priority: project?.priority || "medium",
        notes: project?.notes || "",
      });
    }
  }, [open, project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg text-[11px]"
        style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-sm">{project ? "Edit Project" : "Create New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-white/80">Project Name</label>
            <Input 
              data-testid="input-project-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              required
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-[11px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-white/80">Description</label>
            <Textarea 
              data-testid="input-project-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your project..."
              rows={3}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-[11px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/80">Color</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color"
                  data-testid="input-project-color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-9 w-14 rounded-md border border-white/15 cursor-pointer bg-transparent"
                />
                <Input 
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 bg-white/5 border-white/15 text-white text-[11px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/80">Status</label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger data-testid="select-project-status" className="bg-white/5 border-white/15 text-white text-[11px]">
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
              <label className="text-[11px] font-medium text-white/80">Course (optional)</label>
              <Select 
                value={formData.courseName || "none"} 
                onValueChange={(v) => setFormData({ ...formData, courseName: v === "none" ? "" : v })}
              >
                <SelectTrigger data-testid="select-project-course" className="bg-white/5 border-white/15 text-white text-[11px]">
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
              <label className="text-[11px] font-medium text-white/80">Priority</label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger data-testid="select-project-priority" className="bg-white/5 border-white/15 text-white text-[11px]">
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
              <label className="text-[11px] font-medium text-white/80">Start Date</label>
              <Input 
                type="date"
                data-testid="input-project-start-date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="bg-white/5 border-white/15 text-white text-[11px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/80">Target Date</label>
              <Input 
                type="date"
                data-testid="input-project-target-date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="bg-white/5 border-white/15 text-white text-[11px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-white/80">Notes</label>
            <Textarea 
              data-testid="input-project-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-[11px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button 
              type="submit" 
              data-testid="button-save-project"
              style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)' }}
              className="text-white border-0 hover:brightness-110"
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
  onRename
}: { 
  project: Project;
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onRename: (name: string) => void;
}) {
  const completedTasks = tasks.filter(t => t.isCompleted);
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(project.name);
  
  return (
    <div 
      data-testid={`card-project-${project.id}`}
      className="rounded-lg overflow-hidden flex flex-col transition-all hover:translate-y-[-1px]"
      style={{ 
        background: '#1a1f2e',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div 
        style={{ 
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: project.color || "#6366F1" }} 
            />
            {isEditingName ? (
              <input
                className="text-[13px] font-semibold text-white bg-white/10 border border-white/20 rounded px-1.5 py-0.5 outline-none w-full"
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
                className="text-[13px] font-semibold text-white truncate cursor-text"
                onClick={(e) => { e.stopPropagation(); setEditName(project.name); setIsEditingName(true); }}
                data-testid={`text-project-name-${project.id}`}
              >
                {project.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button 
              onClick={onEdit}
              className="h-6 w-6 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              data-testid={`button-edit-project-${project.id}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button 
              onClick={onDelete}
              className="h-6 w-6 flex items-center justify-center rounded text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
              data-testid={`button-delete-project-${project.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-3.5">
        {project.description && (
          <p className="text-[11px] text-white/50 mb-3 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span 
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={getStatusBadgeStyle(project.status || "planning")}
          >
            {getStatusIcon(project.status || "planning")}
            {(project.status || "planning").replace("_", " ")}
          </span>
          <span 
            className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={getPriorityBadgeStyle(project.priority || "medium")}
          >
            {project.priority || "medium"}
          </span>
          {project.courseName && (
            <span 
              className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: COURSE_COLORS[project.courseName] || "#6366F1" }}
            >
              {project.courseName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] text-white/40 mb-3">
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

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40">Progress</span>
            <span className="text-white/60 font-medium">{completedTasks.length}/{tasks.length}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${progress}%`,
                background: progress === 100 ? '#22c55e' : 'linear-gradient(90deg, #2563eb, #3b82f6)',
              }}
            />
          </div>
        </div>

        <button 
          onClick={onToggleExpand}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-white/40 hover:text-white/70 py-1.5 rounded transition-colors hover:bg-white/5"
          data-testid={`button-toggle-tasks-${project.id}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide Tasks
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show Tasks ({tasks.length})
            </>
          )}
        </button>

        {expanded && tasks.length > 0 && (
          <div className="space-y-1 pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {tasks.map((task) => (
              <div 
                key={task.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] ${
                  task.isCompleted 
                    ? "line-through text-white/30" 
                    : "text-white/80"
                }`}
                style={{ background: task.isCompleted ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)' }}
                data-testid={`task-item-${task.id}`}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500/60 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{task.title}</span>
                {task.dueDate && (
                  <span className="text-[9px] text-white/30">
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
    
    taskLinks.forEach(link => {
      if (link.sourceType === 'task' && link.targetType === 'task') {
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
      <div className="text-center py-8">
        <GitBranch className="w-10 h-10 mx-auto mb-3 text-white/20" />
        <p className="text-white/40 text-sm">No tasks in this project yet.</p>
        <p className="text-white/25 text-xs mt-1">Add tasks and create dependencies to see the workflow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedTasks.map((task, index) => {
        const deps = taskDependencies.get(task.id);
        const blockedByTasks = deps?.blockedBy.map(id => taskMap.get(id)).filter(Boolean) || [];
        const blocksTasks = deps?.blocks.map(id => taskMap.get(id)).filter(Boolean) || [];
        const isBlocked = blockedByTasks.some(t => !t?.isCompleted);
        
        return (
          <div key={task.id} className="relative">
            {index > 0 && blockedByTasks.length > 0 && (
              <div className="absolute left-6 -top-2 h-2 w-px" style={{ background: 'rgba(251,191,36,0.4)' }} />
            )}
            <div 
              className="rounded-lg p-3"
              style={{
                background: task.isCompleted 
                  ? 'rgba(34,197,94,0.06)' 
                  : isBlocked 
                    ? 'rgba(251,191,36,0.06)'
                    : 'rgba(255,255,255,0.03)',
                border: `1px solid ${task.isCompleted ? 'rgba(34,197,94,0.15)' : isBlocked ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)'}`,
              }}
              data-testid={`workflow-task-${task.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isBlocked ? (
                    <Lock className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Unlock className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-medium ${task.isCompleted ? 'line-through text-white/30' : 'text-white/80'}`}>
                    {task.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-[10px] text-white/30">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    )}
                    {task.courseName && (
                      <span 
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: COURSE_COLORS[task.courseName] || "#6366F1" }}
                      >
                        {task.courseName}
                      </span>
                    )}
                  </div>
                  
                  {blockedByTasks.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-amber-400/70 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Blocked by:
                      </span>
                      {blockedByTasks.map(t => (
                        <span 
                          key={t!.id} 
                          className={`px-1.5 py-0.5 rounded text-[9px] ${t!.isCompleted ? 'line-through opacity-40' : ''}`}
                          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fde68a' }}
                        >
                          {t!.title}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {blocksTasks.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-blue-400/70 flex items-center gap-1">
                        <ArrowRight className="w-2.5 h-2.5" /> Blocks:
                      </span>
                      {blocksTasks.map(t => (
                        <span 
                          key={t!.id} 
                          className={`px-1.5 py-0.5 rounded text-[9px] ${t!.isCompleted ? 'line-through opacity-40' : ''}`}
                          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd' }}
                        >
                          {t!.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const { toast } = useToast();
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
    mutationFn: async ({ id, data }: { id: number; data: ProjectFormData }) => {
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

  const handleSaveProject = (data: ProjectFormData) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    } else {
      createProjectMutation.mutate(data);
    }
    setEditingProject(null);
    setDialogOpen(false);
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
    return { totalTasks, completedTasks: completedTasks.length, completionRate, pendingTasks: totalTasks - completedTasks.length };
  }, [allTasks]);

  const statItems = [
    { key: "all", label: "All", count: projectStats.total, color: '#e2e8f0' },
    { key: "in_progress", label: "Active", count: projectStats.in_progress, color: '#fbbf24' },
    { key: "planning", label: "Planning", count: projectStats.planning, color: '#60a5fa' },
    { key: "completed", label: "Done", count: projectStats.completed, color: '#22c55e' },
    { key: "on_hold", label: "On Hold", count: projectStats.on_hold, color: '#9ca3af' },
  ];

  return (
    <div 
      className="min-h-screen"
      style={{
        background: '#0f1219',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <header 
        className="sticky top-0 z-10"
        style={{ 
          background: 'linear-gradient(180deg, rgba(15,18,25,0.98) 0%, rgba(15,18,25,0.95) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <button 
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  data-testid="button-back-home"
                >
                  <ArrowLeft className="w-4 h-4 text-white/60" />
                </button>
              </Link>
              <div>
                <h1 className="text-[14px] font-semibold text-white flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                  Projects
                </h1>
                <p className="text-[11px] text-white/35 mt-0.5">
                  {projects.length} project{projects.length !== 1 ? 's' : ''} &middot; {allTasks.filter(t => t.projectId).length} tasks
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { mode: "grid" as const, icon: LayoutGrid },
                  { mode: "list" as const, icon: LayoutList },
                  { mode: "workflow" as const, icon: GitBranch },
                ].map(({ mode, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="h-7 w-8 flex items-center justify-center transition-colors"
                    style={{ 
                      background: viewMode === mode ? 'rgba(37,99,235,0.3)' : 'transparent',
                      color: viewMode === mode ? '#93c5fd' : 'rgba(255,255,255,0.35)',
                    }}
                    data-testid={`button-view-${mode}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => { setEditingProject(null); setDialogOpen(true); }}
                data-testid="button-create-project"
                className="h-7 px-3 rounded-md text-[11px] font-medium text-white flex items-center gap-1.5 transition-all hover:brightness-110"
                style={{ 
                  background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: '0 1px 4px rgba(37,99,235,0.3)',
                }}
              >
                <Plus className="w-3 h-3" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-5">
        <div className="flex items-center gap-2 mb-5">
          {statItems.map(item => (
            <button
              key={item.key}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
              onClick={() => setStatusFilter(item.key)}
              style={{
                background: statusFilter === item.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: statusFilter === item.key ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                color: statusFilter === item.key ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
              data-testid={`filter-${item.key.replace('_', '-')}`}
            >
              <span className="font-bold" style={{ color: item.color }} data-testid={`stat-${item.key === 'all' ? 'total' : item.key.replace('_', '-')}`}>{item.count}</span>
              {item.label}
            </button>
          ))}
        </div>

        {overallProgress.totalTasks > 0 && (
          <div 
            className="mb-5 rounded-lg p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <div className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Overall</div>
                  <div className="text-[18px] font-bold text-white">{overallProgress.completionRate}%</div>
                </div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${overallProgress.completionRate}%`,
                        background: overallProgress.completionRate === 100 ? '#22c55e' : 'linear-gradient(90deg, #2563eb, #3b82f6)',
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <div className="text-center">
                  <div className="font-bold text-green-400">{overallProgress.completedTasks}</div>
                  <div className="text-white/30">Done</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-amber-400">{overallProgress.pendingTasks}</div>
                  <div className="text-white/30">Pending</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-white/60">{overallProgress.totalTasks}</div>
                  <div className="text-white/30">Total</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {projectsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto text-white/15 mb-4" />
            <h3 className="text-[14px] font-medium text-white/70 mb-2">
              {statusFilter === "all" ? "No projects yet" : `No ${statusFilter.replace("_", " ")} projects`}
            </h3>
            <p className="text-[12px] text-white mb-4">
              Create a project to organize your tasks and track progress.
            </p>
            <button 
              onClick={() => { setEditingProject(null); setDialogOpen(true); }}
              className="h-8 px-4 rounded-md text-[12px] font-medium text-white inline-flex items-center gap-1.5 transition-all hover:brightness-110"
              style={{ 
                background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 1px 4px rgba(37,99,235,0.3)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Your First Project
            </button>
          </div>
        ) : viewMode === "workflow" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Select 
                value={selectedProjectId?.toString() || ""} 
                onValueChange={(v) => setSelectedProjectId(v ? Number(v) : null)}
              >
                <SelectTrigger className="w-[280px] bg-white/5 border-white/10 text-white text-[11px]" data-testid="select-workflow-project">
                  <SelectValue placeholder="Select a project to view workflow" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: p.color || "#6366F1" }} 
                        />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProjectId && (
                <span 
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={getStatusBadgeStyle(projects.find(p => p.id === selectedProjectId)?.status || "planning")}
                >
                  {(projects.find(p => p.id === selectedProjectId)?.status || "planning").replace("_", " ")}
                </span>
              )}
            </div>
            
            {selectedProjectId ? (
              <WorkflowView 
                project={projects.find(p => p.id === selectedProjectId)!}
                tasks={tasksByProject.get(selectedProjectId) || []}
                taskLinks={allTaskLinks}
              />
            ) : (
              <div className="text-center py-12">
                <GitBranch className="w-12 h-12 mx-auto mb-4 text-white/15" />
                <p className="text-white/40 text-sm">Select a project above to view its task workflow.</p>
              </div>
            )}
          </div>
        ) : (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
            : "space-y-3"
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
                onRename={(name) => updateProjectMutation.mutate({ id: project.id, data: { ...project, name, description: project.description || "", color: project.color || "#6366F1", status: project.status || "planning", courseName: project.courseName || "", startDate: project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "", targetDate: project.targetDate ? format(new Date(project.targetDate), "yyyy-MM-dd") : "", priority: project.priority || "medium", notes: project.notes || "" } })}
              />
            ))}
          </div>
        )}
      </main>

      <ProjectDialog
        project={editingProject}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveProject}
      />
    </div>
  );
}
