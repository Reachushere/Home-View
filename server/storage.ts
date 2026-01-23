import { db } from "./db";
import { tasks, files, semesterSettings, secondGoogleAccount, deletedFolders, customFolders, type Task, type InsertTask, type UpdateTaskRequest, type FileRecord, type InsertFile, type SemesterSettings, type InsertSemesterSettings, type SecondGoogleAccount, type InsertSecondGoogleAccount, type DeletedFolder, type CustomFolder, type InsertCustomFolder, getWeekNumber } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface IStorage {
  getTasks(filters?: { weekNumber?: number; type?: string; showCompleted?: boolean }): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  deleteChildTasks(parentTaskId: number): Promise<void>;
  getChildTasks(parentTaskId: number): Promise<Task[]>;
  getTaskCountByWeek(): Promise<Record<number, number>>;
  getFiles(): Promise<FileRecord[]>;
  getFile(id: number): Promise<FileRecord | undefined>;
  getFileByPath(objectPath: string): Promise<FileRecord | undefined>;
  createFile(file: InsertFile): Promise<FileRecord>;
  updateFile(id: number, updates: { displayName?: string; folder?: string | null; listened?: boolean }): Promise<FileRecord>;
  deleteFile(id: number): Promise<void>;
  getActiveSemesterSettings(): Promise<SemesterSettings | undefined>;
  createSemesterSettings(settings: InsertSemesterSettings): Promise<SemesterSettings>;
  updateSemesterSettings(id: number, updates: Partial<SemesterSettings>): Promise<SemesterSettings>;
  getSecondGoogleAccount(): Promise<SecondGoogleAccount | undefined>;
  saveSecondGoogleAccount(account: InsertSecondGoogleAccount): Promise<SecondGoogleAccount>;
  updateSecondGoogleAccount(id: number, updates: Partial<SecondGoogleAccount>): Promise<SecondGoogleAccount>;
  deleteSecondGoogleAccount(): Promise<void>;
  getDeletedFolders(): Promise<DeletedFolder[]>;
  addDeletedFolder(folderId: string): Promise<DeletedFolder>;
  removeDeletedFolder(folderId: string): Promise<void>;
  getCustomFolders(): Promise<CustomFolder[]>;
  createCustomFolder(folder: InsertCustomFolder): Promise<CustomFolder>;
  updateCustomFolder(id: number, name: string): Promise<CustomFolder>;
  deleteCustomFolder(id: number): Promise<void>;
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
    // If marking as completed, set completedAt timestamp
    // If marking as not completed, clear completedAt
    const modifiedUpdates = { ...updates } as typeof updates & { completedAt?: Date | null };
    if ('isCompleted' in updates) {
      if (updates.isCompleted === true) {
        modifiedUpdates.completedAt = new Date();
      } else if (updates.isCompleted === false) {
        modifiedUpdates.completedAt = null;
      }
    }
    
    const [updated] = await db
      .update(tasks)
      .set(modifiedUpdates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async deleteChildTasks(parentTaskId: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.parentTaskId, parentTaskId));
  }

  async getChildTasks(parentTaskId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.parentTaskId, parentTaskId)).orderBy(tasks.dueDate);
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

  async getActiveSemesterSettings(): Promise<SemesterSettings | undefined> {
    const [settings] = await db
      .select()
      .from(semesterSettings)
      .where(eq(semesterSettings.isActive, true))
      .orderBy(desc(semesterSettings.createdAt))
      .limit(1);
    return settings;
  }

  async createSemesterSettings(settings: InsertSemesterSettings): Promise<SemesterSettings> {
    await db.update(semesterSettings).set({ isActive: false });
    const [newSettings] = await db.insert(semesterSettings).values({
      ...settings,
      isActive: true,
    }).returning();
    return newSettings;
  }

  async updateSemesterSettings(id: number, updates: Partial<SemesterSettings>): Promise<SemesterSettings> {
    const [updated] = await db
      .update(semesterSettings)
      .set(updates)
      .where(eq(semesterSettings.id, id))
      .returning();
    return updated;
  }

  async getSecondGoogleAccount(): Promise<SecondGoogleAccount | undefined> {
    const [account] = await db
      .select()
      .from(secondGoogleAccount)
      .orderBy(desc(secondGoogleAccount.createdAt))
      .limit(1);
    return account;
  }

  async saveSecondGoogleAccount(account: InsertSecondGoogleAccount): Promise<SecondGoogleAccount> {
    // Delete any existing accounts first (only one second account allowed)
    await db.delete(secondGoogleAccount);
    const [newAccount] = await db.insert(secondGoogleAccount).values(account).returning();
    return newAccount;
  }

  async updateSecondGoogleAccount(id: number, updates: Partial<SecondGoogleAccount>): Promise<SecondGoogleAccount> {
    const [updated] = await db
      .update(secondGoogleAccount)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(secondGoogleAccount.id, id))
      .returning();
    return updated;
  }

  async deleteSecondGoogleAccount(): Promise<void> {
    await db.delete(secondGoogleAccount);
  }

  async getDeletedFolders(): Promise<DeletedFolder[]> {
    return await db.select().from(deletedFolders);
  }

  async addDeletedFolder(folderId: string): Promise<DeletedFolder> {
    const [folder] = await db.insert(deletedFolders).values({ folderId }).returning();
    return folder;
  }

  async removeDeletedFolder(folderId: string): Promise<void> {
    await db.delete(deletedFolders).where(eq(deletedFolders.folderId, folderId));
  }

  async getCustomFolders(): Promise<CustomFolder[]> {
    return await db.select().from(customFolders);
  }

  async createCustomFolder(folder: InsertCustomFolder): Promise<CustomFolder> {
    const [created] = await db.insert(customFolders).values(folder).returning();
    return created;
  }

  async updateCustomFolder(id: number, name: string): Promise<CustomFolder> {
    const [updated] = await db
      .update(customFolders)
      .set({ name })
      .where(eq(customFolders.id, id))
      .returning();
    return updated;
  }

  async deleteCustomFolder(id: number): Promise<void> {
    await db.delete(customFolders).where(eq(customFolders.id, id));
  }
}

export const storage = new DatabaseStorage();
