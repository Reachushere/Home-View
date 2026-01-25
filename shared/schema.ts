import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const TASK_TYPES = [
  "class",
  "reading",
  "module", 
  "essay",
  "project",
  "discussion",
  "poll",
  "exam",
  "quiz",
  "other"
] as const;

export const REPEAT_TYPES = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "custom"
] as const;

export const REPEAT_INTERVAL_UNITS = [
  "days",
  "weeks"
] as const;

export type RepeatType = typeof REPEAT_TYPES[number];
export type RepeatIntervalUnit = typeof REPEAT_INTERVAL_UNITS[number];

export const COURSES = [
  { code: "CPPA122", name: "Local Politics", color: "blue" },
  { code: "CFNF400", name: "Human Sexuality", color: "pink" },
  { code: "CASL101", name: "American Sign Language", color: "yellow" },
] as const;

export type Course = typeof COURSES[number];

export type TaskType = typeof TASK_TYPES[number];

// Reminder options in minutes - lots of choices
export const REMINDER_OPTIONS = [
  { value: 0, label: "None" },
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 45, label: "45 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 90, label: "1.5 hours before" },
  { value: 120, label: "2 hours before" },
  { value: 180, label: "3 hours before" },
  { value: 240, label: "4 hours before" },
  { value: 360, label: "6 hours before" },
  { value: 480, label: "8 hours before" },
  { value: 720, label: "12 hours before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
  { value: 4320, label: "3 days before" },
  { value: 10080, label: "1 week before" },
] as const;

// Default reminders: 30 min and 2 hours
export const DEFAULT_REMINDER_1 = 30; // 30 minutes
export const DEFAULT_REMINDER_2 = 120; // 2 hours

// Semester settings table to store dynamic semester configuration
export const semesterSettings = pgTable("semester_settings", {
  id: serial("id").primaryKey(),
  semesterName: text("semester_name").notNull().default("Winter 2026 Semester"),
  semesterStartDate: timestamp("semester_start_date").notNull(),
  course1Code: text("course1_code").notNull(),
  course1Name: text("course1_name").notNull(),
  course1Professor: text("course1_professor"),
  course1ProfessorEmail: text("course1_professor_email"),
  course2Code: text("course2_code").notNull(),
  course2Name: text("course2_name").notNull(),
  course2Professor: text("course2_professor"),
  course2ProfessorEmail: text("course2_professor_email"),
  course3Code: text("course3_code").notNull(),
  course3Name: text("course3_name").notNull(),
  course3Professor: text("course3_professor"),
  course3ProfessorEmail: text("course3_professor_email"),
  secondaryCalendarId: text("secondary_calendar_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSemesterSettingsSchema = createInsertSchema(semesterSettings).omit({ id: true, createdAt: true });
export type SemesterSettings = typeof semesterSettings.$inferSelect;
export type InsertSemesterSettings = z.infer<typeof insertSemesterSettingsSchema>;

// Store OAuth tokens for second Google account
export const secondGoogleAccount = pgTable("second_google_account", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSecondGoogleAccountSchema = createInsertSchema(secondGoogleAccount).omit({ id: true, createdAt: true, updatedAt: true });
export type SecondGoogleAccount = typeof secondGoogleAccount.$inferSelect;
export type InsertSecondGoogleAccount = z.infer<typeof insertSecondGoogleAccountSchema>;

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  displayName: text("display_name").notNull(),
  objectPath: text("object_path").notNull().unique(),
  contentType: text("content_type"),
  size: integer("size"),
  folder: text("folder"),
  listened: boolean("listened").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export type FileRecord = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export const deletedFolders = pgTable("deleted_folders", {
  id: serial("id").primaryKey(),
  folderId: text("folder_id").notNull().unique(),
  deletedAt: timestamp("deleted_at").defaultNow(),
});

export const insertDeletedFolderSchema = createInsertSchema(deletedFolders).omit({ id: true, deletedAt: true });
export type DeletedFolder = typeof deletedFolders.$inferSelect;
export type InsertDeletedFolder = z.infer<typeof insertDeletedFolderSchema>;

export const customFolders = pgTable("custom_folders", {
  id: serial("id").primaryKey(),
  parentFolderId: text("parent_folder_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomFolderSchema = createInsertSchema(customFolders).omit({ id: true, createdAt: true });
export type CustomFolder = typeof customFolders.$inferSelect;
export type InsertCustomFolder = z.infer<typeof insertCustomFolderSchema>;

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // reading, module, essay, project, discussion, poll, exam, quiz
  courseName: text("course_name"),
  startDate: timestamp("start_date"), // Optional: when to start working on the task (planning/prep period)
  dueDate: timestamp("due_date").notNull(),
  eventStartTime: text("event_start_time"), // Time the task/event starts (e.g., "09:00")
  eventEndTime: text("event_end_time"), // Time the task/event ends (e.g., "10:00")
  reminder1: integer("reminder_1").default(30), // Default: 30 minutes before
  reminder2: integer("reminder_2").default(120), // Default: 2 hours before
  reminder3: integer("reminder_3"), // Optional additional reminder
  reminder4: integer("reminder_4"), // Optional additional reminder
  weekNumber: integer("week_number").notNull(), // 2-13
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"), // When the task was marked as completed
  isMissed: boolean("is_missed").default(false),
  priority: text("priority").default("medium"), // low, medium, high
  notes: text("notes"),
  referenceLink: text("reference_link"), // URL reference for the task
  attachments: text("attachments").array(), // Array of attachment URLs/paths
  calendarEventId: text("calendar_event_id"), // For synced calendar events (due date)
  calendarProvider: text("calendar_provider"), // 'google' or 'outlook'
  prepCalendarEventId: text("prep_calendar_event_id"), // For synced prep/start date events
  secondaryCalendarEventId: text("secondary_calendar_event_id"), // For synced secondary calendar events
  secondAccountCalendarEventId: text("second_account_calendar_event_id"), // For second Google account sync
  secondAccountPrepEventId: text("second_account_prep_event_id"), // For second Google account prep events
  repeatType: text("repeat_type").default("none"), // none, daily, weekly, monthly, custom
  repeatInterval: integer("repeat_interval"), // For custom: every X units
  repeatIntervalUnit: text("repeat_interval_unit"), // days or weeks (for custom)
  repeatEndDate: timestamp("repeat_end_date"), // Optional: when to stop repeating
  parentTaskId: integer("parent_task_id"), // Links repeated instances to original task
});

// Base schema from drizzle, then override date fields to accept ISO strings
const baseInsertSchema = createInsertSchema(tasks).omit({ id: true });

// Helper to validate and transform date strings
const dateStringToDate = z.string().min(1).transform((s, ctx) => {
  const date = new Date(s);
  if (isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date format",
    });
    return z.NEVER;
  }
  return date;
});

export const insertTaskSchema = baseInsertSchema.extend({
  dueDate: z.union([z.date(), dateStringToDate]),
  startDate: z.union([z.date(), dateStringToDate]).optional().nullable(),
  repeatEndDate: z.union([z.date(), dateStringToDate]).optional().nullable(),
  repeatType: z.enum(REPEAT_TYPES).optional().default("none"),
  repeatIntervalUnit: z.enum(REPEAT_INTERVAL_UNITS).optional().nullable(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTaskRequest = Partial<InsertTask>;

// Week calculation helpers
// Week 2 starts Saturday Jan 11, 2025 (today is Jan 17, 2025 - Friday of Week 2)
// Weeks run Saturday to Friday
export const SEMESTER_START = new Date("2026-01-10T12:00:00"); // Week 1 Saturday (noon to avoid timezone shifts)
export const FIRST_WEEK = 1;
export const LAST_WEEK = 13;

export function getWeekNumber(date: Date, customSemesterStart?: Date): number {
  const startOfSemester = new Date(customSemesterStart || SEMESTER_START);
  const diffTime = date.getTime() - startOfSemester.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

export function getWeekDates(weekNum: number, customSemesterStart?: Date): { start: Date; end: Date } {
  const startOfSemester = new Date(customSemesterStart || SEMESTER_START);
  const weekStart = new Date(startOfSemester);
  weekStart.setDate(startOfSemester.getDate() + (weekNum - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { start: weekStart, end: weekEnd };
}
