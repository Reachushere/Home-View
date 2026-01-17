import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Layers,
  FileText,
  FolderKanban,
  MessageSquare,
  Vote,
  GraduationCap,
  ClipboardCheck,
  Calendar,
  Clock,
  Plus,
  Download,
  RefreshCw,
  Bell,
  CalendarDays,
} from "lucide-react";
import type { Task } from "@shared/schema";
import { TASK_TYPES, REMINDER_OFFSETS } from "@shared/schema";
import { format } from "date-fns";

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

interface WeekInfo {
  weekNumber: number;
  startDate: string;
  endDate: string;
  taskCount: number;
}

export default function Dashboard() {
  const [selectedWeek, setSelectedWeek] = useState<number>(2);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);

  const { data: weeks = [] } = useQuery<WeekInfo[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { weekNumber: selectedWeek }],
    queryFn: () => fetch(`/api/tasks?weekNumber=${selectedWeek}`).then(r => r.json()),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/tasks/${id}/complete`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
    },
  });

  const currentWeekInfo = weeks.find(w => w.weekNumber === selectedWeek);
  const missedTasks = tasks.filter(t => t.isMissed && !t.isCompleted);
  const upcomingTasks = tasks.filter(t => !t.isMissed && !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Week Navigator */}
      <aside className="w-72 border-r border-border bg-sidebar p-4 flex flex-col gap-4 overflow-auto">
        <div className="flex items-center gap-2 px-2 py-4">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-sidebar-foreground">
            School Planner
          </h1>
        </div>

        <div className="text-sm text-muted-foreground px-2 mb-2">
          Today: {format(new Date(), "MMM d, yyyy")}
        </div>

        <nav className="flex flex-col gap-1">
          {weeks.map((week) => (
            <Button
              key={week.weekNumber}
              variant={selectedWeek === week.weekNumber ? "secondary" : "ghost"}
              className="justify-between gap-2"
              onClick={() => setSelectedWeek(week.weekNumber)}
              data-testid={`button-week-${week.weekNumber}`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Week {week.weekNumber}</span>
              </div>
              {week.taskCount > 0 && (
                <Badge variant="outline" className="ml-auto">
                  {week.taskCount}
                </Badge>
              )}
            </Button>
          ))}
        </nav>

        <div className="mt-auto p-4 rounded-md bg-card border border-card-border">
          <div className="text-sm text-muted-foreground">This Week</div>
          <div className="text-lg font-semibold text-foreground">
            {tasks.filter(t => !t.isCompleted).length} tasks remaining
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {completedTasks.length} completed
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Week {selectedWeek}
            </h2>
            {currentWeekInfo && (
              <p className="text-muted-foreground">
                {format(new Date(currentWeekInfo.startDate), "MMM d")} - {format(new Date(currentWeekInfo.endDate), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-task">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
              </DialogHeader>
              <TaskForm 
                weekNumber={selectedWeek}
                onSuccess={() => setIsAddDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        </header>

        {/* Missed Tasks Section */}
        {missedTasks.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-destructive mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Missed ({missedTasks.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                  onReschedule={() => setRescheduleTask(task)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => deleteMutation.mutate(task.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Tasks Section */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Upcoming ({upcomingTasks.length})
          </h3>
          {isLoading ? (
            <div className="text-muted-foreground">Loading tasks...</div>
          ) : upcomingTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No upcoming tasks for this week
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                  onReschedule={() => setRescheduleTask(task)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => deleteMutation.mutate(task.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-muted-foreground mb-4">
              Completed ({completedTasks.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={(isCompleted) => completeMutation.mutate({ id: task.id, isCompleted })}
                  onReschedule={() => setRescheduleTask(task)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => deleteMutation.mutate(task.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Reschedule Dialog */}
        <Dialog open={!!rescheduleTask} onOpenChange={(open) => !open && setRescheduleTask(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reschedule Task</DialogTitle>
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <TaskForm 
                task={editingTask}
                weekNumber={editingTask.weekNumber}
                onSuccess={() => setEditingTask(null)} 
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function TaskCard({
  task,
  onComplete,
  onReschedule,
  onEdit,
  onDelete,
}: {
  task: Task;
  onComplete: (isCompleted: boolean) => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = iconMap[task.type] || ClipboardCheck;
  const isMissed = task.isMissed && !task.isCompleted;
  
  const handleExportCalendar = () => {
    window.open(`/api/tasks/${task.id}/ics`, '_blank');
  };

  return (
    <Card
      className={`transition-all ${
        isMissed ? "border-destructive/50 bg-destructive/5" : ""
      } ${task.isCompleted ? "opacity-60" : ""}`}
      data-testid={`card-task-${task.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.isCompleted || false}
            onCheckedChange={(checked) => onComplete(!!checked)}
            data-testid={`checkbox-task-${task.id}`}
          />
          <div>
            <CardTitle className={`text-sm font-medium ${task.isCompleted ? "line-through" : ""}`}>
              {task.title}
            </CardTitle>
            {task.courseName && (
              <p className="text-xs text-muted-foreground">{task.courseName}</p>
            )}
          </div>
        </div>
        <Badge className={typeColors[task.type]}>
          <Icon className="h-3 w-3 mr-1" />
          {task.type}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {format(new Date(task.dueDate), "MMM d, h:mm a")}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bell className="h-3 w-3" />
          <span>Reminders: 12h, 6h, 2h, 30min before</span>
        </div>

        <div className="flex items-center gap-2 pt-2 flex-wrap">
          {isMissed && (
            <Button size="sm" variant="destructive" onClick={onReschedule} data-testid={`button-reschedule-${task.id}`}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Reschedule
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExportCalendar} data-testid={`button-export-${task.id}`}>
            <Download className="h-3 w-3 mr-1" />
            Calendar
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`button-edit-${task.id}`}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskForm({ 
  task, 
  weekNumber, 
  onSuccess 
}: { 
  task?: Task; 
  weekNumber: number; 
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    type: task?.type || "reading",
    courseName: task?.courseName || "",
    dueDate: task?.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : "",
    priority: task?.priority || "medium",
    weekNumber: task?.weekNumber || weekNumber,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        dueDate: new Date(data.dueDate),
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
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Assignment title"
          required
          data-testid="input-title"
        />
      </div>

      <div>
        <Label htmlFor="type">Type</Label>
        <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
          <SelectTrigger data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPES.map(type => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="courseName">Course Name</Label>
        <Input
          id="courseName"
          value={formData.courseName}
          onChange={(e) => setFormData(prev => ({ ...prev, courseName: e.target.value }))}
          placeholder="e.g., CS 201"
          data-testid="input-course"
        />
      </div>

      <div>
        <Label htmlFor="dueDate">Due Date & Time</Label>
        <Input
          id="dueDate"
          type="datetime-local"
          value={formData.dueDate}
          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
          required
          data-testid="input-duedate"
        />
      </div>

      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
          <SelectTrigger data-testid="select-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Add notes or details..."
          data-testid="input-description"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-task">
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
