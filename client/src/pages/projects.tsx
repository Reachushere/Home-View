import { useState, useMemo } from "react";
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
  Unlock
} from "lucide-react";
import { format } from "date-fns";
import type { Project, Task, TaskLink } from "@shared/schema";
import projectsBg from "@assets/BG2_1769891044656.jpg";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "Create New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input 
              data-testid="input-project-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
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
              <label className="text-sm font-medium">Color</label>
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
              <label className="text-sm font-medium">Status</label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger data-testid="select-project-status">
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
              <label className="text-sm font-medium">Course (optional)</label>
              <Select 
                value={formData.courseName || "none"} 
                onValueChange={(v) => setFormData({ ...formData, courseName: v === "none" ? "" : v })}
              >
                <SelectTrigger data-testid="select-project-course">
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
              <label className="text-sm font-medium">Priority</label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger data-testid="select-project-priority">
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
              <label className="text-sm font-medium">Start Date</label>
              <Input 
                type="date"
                data-testid="input-project-start-date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Date</label>
              <Input 
                type="date"
                data-testid="input-project-target-date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea 
              data-testid="input-project-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" data-testid="button-save-project">
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
  onToggleExpand
}: { 
  project: Project;
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const completedTasks = tasks.filter(t => t.isCompleted);
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  
  return (
    <div 
      data-testid={`card-project-${project.id}`}
      className="rounded-[12px] overflow-hidden flex flex-col hover-elevate transition-all"
      style={{ 
        background: 'rgba(255, 255, 255, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      {/* Orange gradient header */}
      <div 
        style={{ 
          background: 'linear-gradient(180deg, #FF6E3D 0%, #FFDD63 100%)',
          padding: '8px 12px'
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
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
            >
              {project.name}
            </span>
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
      
      {/* Body with backdrop blur */}
      <div className="flex-1 p-3" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
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
        </div>

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

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onToggleExpand}
          className="w-full justify-center gap-1 text-white hover:text-white hover:bg-white/20 text-xs"
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
        backgroundImage: `url(${projectsBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <header className="border-b border-white/20 sticky top-0 z-10 bg-black/40 backdrop-blur-sm">
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
                <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                  <FolderOpen className="w-6 h-6" />
                  Projects
                </h1>
                <p className="text-sm text-white/70">
                  {projects.length} projects, {allTasks.filter(t => t.projectId).length} tasks assigned
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex border border-white/20 rounded-md">
                <Button 
                  variant={viewMode === "grid" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grid"
                  className="text-white hover:text-white hover:bg-white/10"
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
              />
            ))}
          </div>
        )}
      </main>

      <ProjectDialog
        project={editingProject}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        onSave={handleSaveProject}
      />
    </div>
  );
}
