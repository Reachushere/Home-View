import { db } from "./db";
import { tasks, type Task, type InsertTask, type UpdateTaskRequest, getWeekNumber } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getTasks(filters?: { weekNumber?: number; type?: string; showCompleted?: boolean }): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  getTaskCountByWeek(): Promise<Record<number, number>>;
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
}

export const storage = new DatabaseStorage();
