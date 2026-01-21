import { db } from "./db";
import { tasks, files, type Task, type InsertTask, type UpdateTaskRequest, type FileRecord, type InsertFile, getWeekNumber } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getTasks(filters?: { weekNumber?: number; type?: string; showCompleted?: boolean }): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  getTaskCountByWeek(): Promise<Record<number, number>>;
  getFiles(): Promise<FileRecord[]>;
  getFile(id: number): Promise<FileRecord | undefined>;
  getFileByPath(objectPath: string): Promise<FileRecord | undefined>;
  createFile(file: InsertFile): Promise<FileRecord>;
  updateFile(id: number, updates: { displayName?: string; folder?: string | null; listened?: boolean }): Promise<FileRecord>;
  deleteFile(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTasks(filters?: { weekNumber?: number; type?: string; showCompleted?: boolean }): Promise<Task[]> {
    let query = db.select().from(tasks);
    
    const conditions = [];
    if (filters?.weekNumber) {
      conditions.push(eq(tasks.weekNumber, filters.weekNumber));
    }
    if (filters?.type) {
      conditions.push(eq(tasks.type, filters.type));
    }
    if (filters?.showCompleted === false) {
      conditions.push(eq(tasks.isCompleted, false));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(tasks).where(and(...conditions)).orderBy(tasks.dueDate);
    }
    
    return await db.select().from(tasks).orderBy(tasks.dueDate);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: number, updates: UpdateTaskRequest): Promise<Task> {
    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getTaskCountByWeek(): Promise<Record<number, number>> {
    const allTasks = await db.select().from(tasks);
    const counts: Record<number, number> = {};
    for (const task of allTasks) {
      counts[task.weekNumber] = (counts[task.weekNumber] || 0) + 1;
    }
    return counts;
  }

  async getFiles(): Promise<FileRecord[]> {
    return await db.select().from(files).orderBy(files.createdAt);
  }

  async getFile(id: number): Promise<FileRecord | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async getFileByPath(objectPath: string): Promise<FileRecord | undefined> {
    const [file] = await db.select().from(files).where(eq(files.objectPath, objectPath));
    return file;
  }

  async createFile(insertFile: InsertFile): Promise<FileRecord> {
    const [file] = await db.insert(files).values(insertFile).returning();
    return file;
  }

  async updateFile(id: number, updates: { displayName?: string; folder?: string | null; listened?: boolean }): Promise<FileRecord> {
    const setData: Record<string, unknown> = {};
    if (updates.displayName !== undefined) {
      setData.displayName = updates.displayName;
    }
    if (updates.folder !== undefined) {
      setData.folder = updates.folder;
    }
    if (updates.listened !== undefined) {
      setData.listened = updates.listened;
    }
    const [updated] = await db
      .update(files)
      .set(setData)
      .where(eq(files.id, id))
      .returning();
    return updated;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }
}

export const storage = new DatabaseStorage();
