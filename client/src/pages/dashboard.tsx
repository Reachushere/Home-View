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
  ChevronLeft,
  ChevronRight,
  X,
  Link,
  Paperclip,
} from "lucide-react";
import type { Task } from "@shared/schema";
import { TASK_TYPES, COURSES, getWeekNumber } from "@shared/schema";
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

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

const courseColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "CPPA122": { bg: "bg-blue-500/30", border: "border-blue-500", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  "CFNF400": { bg: "bg-green-500/30", border: "border-green-500", text: "text-green-700 dark:text-green-300", dot: "bg-green-500" },
  "CASL101": { bg: "bg-yellow-500/30", border: "border-yellow-500", text: "text-yellow-700 dark:text-yellow-300", dot: "bg-yellow-500" },
};

interface WeekInfo {
  weekNumber: number;
  startDate: string;
  endDate: string;
  taskCount: number;
}

export default function Dashboard() {
  const [selectedWeek, setSelectedWeek] = useState<number>(2);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 0, 17)); // January 2026
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);

  const { data: weeks = [] } = useQuery<WeekInfo[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => fetch("/api/tasks").then(r => r.json()),
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

  // Filter tasks by selected date if a date is clicked
  const displayTasks = selectedDate 
    ? allTasks.filter(t => isSameDay(new Date(t.dueDate), selectedDate))
    : tasks;

  const missedTasks = displayTasks.filter(t => t.isMissed && !t.isCompleted);
  const upcomingTasks = displayTasks.filter(t => !t.isMissed && !t.isCompleted);
  const completedTasks = displayTasks.filter(t => t.isCompleted);

  // Calendar generation - display starts Sunday, but backend weeks run Sat-Fri
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Display starts on Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const displayCalendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Current week dates (Week 2 = Jan 17-23, 2026)
  const currentWeekInfo = weeks.find(w => w.weekNumber === 2); // Current week is Week 2
  const currentWeekStart = currentWeekInfo ? new Date(currentWeekInfo.startDate) : null;
  const currentWeekEnd = currentWeekInfo ? new Date(currentWeekInfo.endDate) : null;

  const isInCurrentWeek = (day: Date) => {
    if (!currentWeekStart || !currentWeekEnd) return false;
    // Use startOfDay to compare only dates, not times
    const dayStart = startOfDay(day);
    const weekStart = startOfDay(currentWeekStart);
    const weekEnd = endOfDay(currentWeekEnd);
    return isWithinInterval(dayStart, { start: weekStart, end: weekEnd });
  };

  const getTasksForDay = (day: Date) => {
    return allTasks.filter(t => isSameDay(new Date(t.dueDate), day));
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
    }
  };

  const getCourseColor = (courseName: string | null) => {
    if (!courseName) return null;
    const courseCode = courseName.split(" ")[0];
    return courseColors[courseCode] || null;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
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

        {/* Course Legend */}
        <div className="px-2 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Courses</h3>
          {COURSES.map((course) => {
            const colors = courseColors[course.code];
            return (
              <div key={course.code} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${colors?.dot}`} />
                <span className="text-sm">
                  <span className="font-medium">{course.code}</span>
                  <span className="text-muted-foreground"> - {course.name}</span>
                </span>
              </div>
            );
          })}
        </div>

        <nav className="flex flex-col gap-1 mt-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-1">Weeks</h3>
          {weeks.map((week) => (
            <Button
              key={week.weekNumber}
              variant={selectedWeek === week.weekNumber && !selectedDate ? "secondary" : "ghost"}
              className="justify-between gap-2"
              onClick={() => {
                setSelectedWeek(week.weekNumber);
                setSelectedDate(null);
              }}
              data-testid={`button-week-${week.weekNumber}`}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Week {week.weekNumber}</span>
                </div>
                <span className="text-[10px] text-muted-foreground ml-6">
                  {format(parseISO(week.startDate), "MMM d")} - {format(parseISO(week.endDate), "MMM d")}
                </span>
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
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} data-testid="button-prev-month">
              <ChevronLeft className="h-5 w-5 text-white" />
            </Button>
            <h2 className="text-2xl font-medium text-white min-w-[200px] text-center" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} data-testid="button-next-month">
              <ChevronRight className="h-5 w-5 text-white" />
            </Button>
          </div>
          <h1 className="text-2xl font-medium text-white" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Bryn's Task Management Application</h1>
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
                initialDate={selectedDate}
                onSuccess={() => setIsAddDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Calendar Grid */}
        <Card className="mb-6">
          <CardContent className="p-4">
            {/* Day Headers */}
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '6px repeat(7, 1fr)' }}>
              <div></div>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days with Week Numbers */}
            <div className="space-y-3">
              {Array.from({ length: Math.ceil(displayCalendarDays.length / 7) }).map((_, weekIdx) => {
                const weekDays = displayCalendarDays.slice(weekIdx * 7, weekIdx * 7 + 7);
                const saturdayOfWeek = weekDays[6];
                const weekNum = saturdayOfWeek ? getWeekNumber(saturdayOfWeek) : 0;
                const showWeekNum = weekNum >= 1 && weekNum <= 13;
                
                // Check which parts of this row are in the current week
                const sunFriDays = weekDays.slice(0, 6);
                const saturdayDay = weekDays[6];
                const sunFriInCurrentWeek = sunFriDays.some(day => isInCurrentWeek(day));
                const saturdayInCurrentWeek = saturdayDay && isInCurrentWeek(saturdayDay);
                
                return (
                  <div key={`week-row-${weekIdx}`} className="relative grid gap-1" style={{ gridTemplateColumns: '6px repeat(7, 1fr)' }}>
                    {/* Week number label */}
                    <div className="flex items-center justify-end">
                      {showWeekNum && (
                        <span 
                          className="text-[13px] font-bold text-foreground whitespace-nowrap"
                          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                        >
                          Week {weekNum}
                        </span>
                      )}
                    </div>
                    
                    {/* Days of the week */}
                    {weekDays.map((day, dayIdx) => {
                      const idx = weekIdx * 7 + dayIdx;
                      const dayTasks = getTasksForDay(day);
                      const dayReminders = getRemindersForDay(day);
                      const isToday = isSameDay(day, new Date());
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isCurrentWeekDay = isInCurrentWeek(day);
                      
                      const taskReminderPairs: Array<{ task: typeof dayTasks[0] | null; reminder: typeof dayReminders[0] | null }> = [];
                      const usedReminderIds = new Set<number>();
                      
                      dayTasks.forEach(task => {
                        const matchingReminder = dayReminders.find(r => r.id === task.id && !usedReminderIds.has(r.id));
                        if (matchingReminder) {
                          usedReminderIds.add(matchingReminder.id);
                          taskReminderPairs.push({ task, reminder: matchingReminder });
                        } else {
                          taskReminderPairs.push({ task, reminder: null });
                        }
                      });
                      
                      dayReminders.forEach(reminder => {
                        if (!usedReminderIds.has(reminder.id)) {
                          taskReminderPairs.push({ task: null, reminder });
                        }
                      });
                      
                      const totalItems = taskReminderPairs.length;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => handleDayClick(day)}
                          className={`
                            h-[80px] p-1 rounded-md text-left transition-all overflow-hidden flex flex-col items-start justify-start
                            ${isCurrentWeekDay 
                              ? "bg-foreground text-background"
                              : "border " + (isCurrentMonth 
                                ? "bg-card" 
                                : "bg-muted/30 text-muted-foreground")}
                            ${isToday ? "ring-2 ring-primary ring-offset-2" : ""}
                            ${isSelected ? "ring-2 ring-primary" : (!isCurrentWeekDay ? "hover:border-primary/50" : "")}
                          `}
                          data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                        >
                          <div className={`text-xs font-medium mb-1 text-left ${
                            isCurrentWeekDay
                              ? "text-background"
                              : isCurrentMonth 
                                ? "text-foreground" 
                                : "text-muted-foreground"
                          } ${isToday && !isCurrentWeekDay ? "text-primary" : ""}`}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {taskReminderPairs.slice(0, 3).map((pair, pairIdx) => {
                              const { task, reminder } = pair;
                              const colors = task ? getCourseColor(task.courseName) : reminder ? getCourseColor(reminder.courseName) : null;
                              const is24hrReminder = reminder?.reminderType === '24hr';
                              const urgent = task ? isUrgentTask(task) : false;
                              
                              return (
                                <div key={`pair-${pairIdx}`} className="flex items-center gap-0.5">
                                  {reminder && (
                                    <div 
                                      className={`text-[9px] px-0.5 py-px rounded font-medium flex items-center ${
                                        isCurrentWeekDay 
                                          ? "bg-red-500 text-white" 
                                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                                      } ${is24hrReminder ? "animate-urgent-blink" : ""}`}
                                      title={`Reminder: ${reminder.title}`}
                                    >
                                      <Bell className="h-2 w-2" />
                                    </div>
                                  )}
                                  {task ? (
                                    <div 
                                      className={`text-[9px] truncate px-0.5 py-px rounded font-medium flex-1 ${
                                        colors 
                                          ? isCurrentWeekDay 
                                            ? `${colors.dot} text-white` 
                                            : `${colors.bg} ${colors.text}`
                                          : isCurrentWeekDay 
                                            ? "bg-gray-500 text-white" 
                                            : "bg-gray-500/30 text-gray-700 dark:text-gray-300"
                                      } ${task.isCompleted ? "line-through opacity-50" : ""} ${urgent ? "animate-urgent-blink" : ""}`}
                                    >
                                      {task.title}
                                    </div>
                                  ) : reminder && (
                                    <div 
                                      className={`text-[9px] truncate px-0.5 py-px rounded font-medium flex-1 ${
                                        colors 
                                          ? isCurrentWeekDay 
                                            ? `${colors.dot} text-white` 
                                            : `${colors.bg} ${colors.text}`
                                          : isCurrentWeekDay 
                                            ? "bg-gray-500 text-white" 
                                            : "bg-gray-500/30 text-gray-700 dark:text-gray-300"
                                      }`}
                                    >
                                      {reminder.title}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {totalItems > 3 && (
                              <div className={`text-[9px] ${isCurrentWeekDay ? "text-background/70" : "text-muted-foreground"}`}>
                                +{totalItems - 3} more
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    
                    {/* Red border overlay for Sun-Fri of current week */}
                    {sunFriInCurrentWeek && (
                      <div 
                        className="absolute pointer-events-none border-4 border-red-500 rounded-lg z-10"
                        style={{
                          left: '4px',
                          right: 'calc((100% - 6px) / 7 + 8px)',
                          top: '-6px',
                          bottom: '-6px',
                        }}
                      />
                    )}
                    
                    {/* Red border overlay for Saturday of current week */}
                    {saturdayInCurrentWeek && (
                      <div 
                        className="absolute pointer-events-none border-4 border-red-500 rounded-lg z-10"
                        style={{
                          left: 'calc(100% - (100% - 6px) / 7 - 4px)',
                          right: '-6px',
                          top: '-6px',
                          bottom: '-6px',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date / Week Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {selectedDate 
                ? format(selectedDate, "EEEE, MMMM d, yyyy")
                : `Week ${selectedWeek} Tasks`}
            </h3>
            {selectedDate && (
              <Button variant="link" className="p-0 h-auto" onClick={() => setSelectedDate(null)}>
                Clear date filter
              </Button>
            )}
          </div>
        </div>

        {/* Upcoming and Missed Tasks Side by Side */}
        <div className="flex gap-6 mb-6">
          {/* Upcoming Tasks Section */}
          <section className="flex-1">
            <h4 className="text-md font-semibold text-white mb-3">
              Upcoming ({upcomingTasks.length})
            </h4>
            {isLoading ? (
              <div className="text-muted-foreground">Loading tasks...</div>
            ) : upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming tasks {selectedDate ? "for this date" : "for this week"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

          {/* Missed Tasks Section */}
          {missedTasks.length > 0 && (
            <section className="w-[300px] flex-shrink-0">
              <h4 className="text-md font-semibold text-destructive mb-3 flex items-center gap-2 animate-urgent-blink">
                <Clock className="h-4 w-4" />
                Missed ({missedTasks.length})
              </h4>
              <div className="space-y-4 bg-white rounded-lg p-4">
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
        </div>

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <section>
            <h4 className="text-md font-semibold text-muted-foreground mb-3">
              Completed ({completedTasks.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
  
  // Get course color
  const courseCode = task.courseName?.split(" ")[0] || "";
  const colors = courseColors[courseCode];
  
  const handleExportCalendar = () => {
    window.open(`/api/tasks/${task.id}/ics`, '_blank');
  };

  return (
    <Card
      className={`transition-all h-full border ${
        colors ? `${colors.border}` : "border-gray-500"
      } ${isMissed ? "border-destructive/50 bg-destructive/5" : ""} ${
        task.isCompleted ? "opacity-60" : ""
      }`}
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
              <p className={`text-xs font-medium ${colors?.text || "text-muted-foreground"}`}>
                {task.courseName}
              </p>
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

        {task.referenceLink && (
          <div className="flex items-center gap-1 text-xs">
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
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{task.attachments.length} attachment{task.attachments.length > 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {task.attachments.map((attachment, idx) => (
                <a
                  key={idx}
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate max-w-[150px]"
                  data-testid={`link-attachment-${task.id}-${idx}`}
                >
                  {attachment.split('/').pop() || attachment}
                </a>
              ))}
            </div>
          </div>
        )}

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
  initialDate,
  onSuccess 
}: { 
  task?: Task; 
  weekNumber: number;
  initialDate?: Date | null;
  onSuccess: () => void;
}) {
  const getDefaultDate = () => {
    if (task?.dueDate) return format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm");
    if (initialDate) return format(initialDate, "yyyy-MM-dd'T'HH:mm");
    return "";
  };

  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    type: task?.type || "reading",
    courseName: task?.courseName || "",
    dueDate: getDefaultDate(),
    priority: task?.priority || "medium",
    weekNumber: task?.weekNumber || weekNumber,
    referenceLink: task?.referenceLink || "",
    attachments: task?.attachments || [] as string[],
  });
  const [newAttachment, setNewAttachment] = useState("");

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
        <Label htmlFor="courseName">Course</Label>
        <Select value={formData.courseName} onValueChange={(v) => setFormData(prev => ({ ...prev, courseName: v }))}>
          <SelectTrigger data-testid="select-course">
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {COURSES.map(course => {
              const colors = courseColors[course.code];
              return (
                <SelectItem key={course.code} value={`${course.code} - ${course.name}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors?.dot}`} />
                    {course.code} - {course.name}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
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

      <div>
        <Label htmlFor="referenceLink">Reference Link (optional)</Label>
        <Input
          id="referenceLink"
          type="url"
          value={formData.referenceLink}
          onChange={(e) => setFormData(prev => ({ ...prev, referenceLink: e.target.value }))}
          placeholder="https://example.com/resource"
          data-testid="input-reference-link"
        />
      </div>

      <div>
        <Label>Attachments (optional)</Label>
        <div className="space-y-2">
          {formData.attachments.map((attachment, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">
                {attachment}
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
            <Input
              value={newAttachment}
              onChange={(e) => setNewAttachment(e.target.value)}
              placeholder="Paste attachment URL..."
              data-testid="input-new-attachment"
            />
            <Button
              type="button"
              variant="outline"
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
