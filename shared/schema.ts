import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const TASK_TYPES = [
  "reading",
  "module", 
  "essay",
  "project",
  "discussion",
  "poll",
  "exam",
  "quiz"
] as const;

export const COURSES = [
  { code: "CPPA122", name: "Local Politics", color: "blue" },
  { code: "CFNF400", name: "Human Sexuality", color: "green" },
  { code: "CASL101", name: "American Sign Language", color: "yellow" },
] as const;

export type Course = typeof COURSES[number];

export type TaskType = typeof TASK_TYPES[number];

export const REMINDER_OFFSETS = [30, 120, 360, 720] as const; // minutes: 30min, 2hr, 6hr, 12hr

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // reading, module, essay, project, discussion, poll, exam, quiz
  courseName: text("course_name"),
  dueDate: timestamp("due_date").notNull(),
  weekNumber: integer("week_number").notNull(), // 2-13
  isCompleted: boolean("is_completed").default(false),
  isMissed: boolean("is_missed").default(false),
  priority: text("priority").default("medium"), // low, medium, high
  notes: text("notes"),
  referenceLink: text("reference_link"), // URL reference for the task
  attachments: text("attachments").array(), // Array of attachment URLs/paths
  calendarEventId: text("calendar_event_id"), // For synced calendar events
  calendarProvider: text("calendar_provider"), // 'google' or 'outlook'
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTaskRequest = Partial<InsertTask>;

// Week calculation helpers
// Week 2 starts Saturday Jan 11, 2025 (today is Jan 17, 2025 - Friday of Week 2)
// Weeks run Saturday to Friday
export const SEMESTER_START = new Date("2026-01-10"); // Week 1 Saturday
export const FIRST_WEEK = 1;
export const LAST_WEEK = 13;

export function getWeekNumber(date: Date): number {
  const startOfSemester = new Date(SEMESTER_START);
  const diffTime = date.getTime() - startOfSemester.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

export function getWeekDates(weekNum: number): { start: Date; end: Date } {
  const startOfSemester = new Date(SEMESTER_START);
  const weekStart = new Date(startOfSemester);
  weekStart.setDate(startOfSemester.getDate() + (weekNum - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { start: weekStart, end: weekEnd };
}
