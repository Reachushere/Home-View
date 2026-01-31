import { db } from "./db";
import { tasks, files, semesterSettings, secondGoogleAccount, deletedFolders, customFolders, subtasks, taskLinks, projects, type Task, type InsertTask, type UpdateTaskRequest, type FileRecord, type InsertFile, type SemesterSettings, type InsertSemesterSettings, type SecondGoogleAccount, type InsertSecondGoogleAccount, type DeletedFolder, type CustomFolder, type InsertCustomFolder, type Subtask, type InsertSubtask, type TaskLink, type InsertTaskLink, type Project, type InsertProject, getWeekNumber } from "@shared/schema";
import { eq, and, gte, lte, desc, or } from "drizzle-orm";

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
  // Subtasks
  getSubtasksByTask(taskId: number): Promise<Subtask[]>;
  getSubtask(id: number): Promise<Subtask | undefined>;
  createSubtask(subtask: InsertSubtask): Promise<Subtask>;
  updateSubtask(id: number, updates: Partial<InsertSubtask>): Promise<Subtask>;
  deleteSubtask(id: number): Promise<void>;
  deleteSubtasksByTask(taskId: number): Promise<void>;
  // Task Links
  getLinksForTask(taskId: number): Promise<TaskLink[]>;
  getLinksForSubtask(subtaskId: number): Promise<TaskLink[]>;
  createTaskLink(link: InsertTaskLink): Promise<TaskLink>;
  deleteTaskLink(id: number): Promise<void>;
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  getTasksByProject(projectId: number): Promise<Task[]>;
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

  // Subtask methods
  async getSubtasksByTask(taskId: number): Promise<Subtask[]> {
    return await db.select().from(subtasks)
      .where(eq(subtasks.parentTaskId, taskId))
      .orderBy(subtasks.position, subtasks.createdAt);
  }

  async getSubtask(id: number): Promise<Subtask | undefined> {
    const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, id));
    return subtask;
  }

  async createSubtask(subtask: InsertSubtask): Promise<Subtask> {
    const [created] = await db.insert(subtasks).values(subtask).returning();
    return created;
  }

  async updateSubtask(id: number, updates: Partial<InsertSubtask>): Promise<Subtask> {
    const modifiedUpdates = { ...updates } as typeof updates & { completedAt?: Date | null };
    if ('isCompleted' in updates) {
      if (updates.isCompleted === true) {
        modifiedUpdates.completedAt = new Date();
      } else if (updates.isCompleted === false) {
        modifiedUpdates.completedAt = null;
      }
    }
    const [updated] = await db
      .update(subtasks)
      .set(modifiedUpdates)
      .where(eq(subtasks.id, id))
      .returning();
    return updated;
  }

  async deleteSubtask(id: number): Promise<void> {
    // Also delete any links associated with this subtask
    await db.delete(taskLinks).where(
      or(
        and(eq(taskLinks.sourceType, 'subtask'), eq(taskLinks.sourceId, id)),
        and(eq(taskLinks.targetType, 'subtask'), eq(taskLinks.targetId, id))
      )
    );
    await db.delete(subtasks).where(eq(subtasks.id, id));
  }

  async deleteSubtasksByTask(taskId: number): Promise<void> {
    // Get all subtask IDs for this task first
    const taskSubtasks = await db.select({ id: subtasks.id }).from(subtasks)
      .where(eq(subtasks.parentTaskId, taskId));
    
    // Delete links for each subtask
    for (const sub of taskSubtasks) {
      await db.delete(taskLinks).where(
        or(
          and(eq(taskLinks.sourceType, 'subtask'), eq(taskLinks.sourceId, sub.id)),
          and(eq(taskLinks.targetType, 'subtask'), eq(taskLinks.targetId, sub.id))
        )
      );
    }
    
    await db.delete(subtasks).where(eq(subtasks.parentTaskId, taskId));
  }

  // Task Link methods
  async getLinksForTask(taskId: number): Promise<TaskLink[]> {
    return await db.select().from(taskLinks).where(
      or(
        and(eq(taskLinks.sourceType, 'task'), eq(taskLinks.sourceId, taskId)),
        and(eq(taskLinks.targetType, 'task'), eq(taskLinks.targetId, taskId))
      )
    );
  }

  async getLinksForSubtask(subtaskId: number): Promise<TaskLink[]> {
    return await db.select().from(taskLinks).where(
      or(
        and(eq(taskLinks.sourceType, 'subtask'), eq(taskLinks.sourceId, subtaskId)),
        and(eq(taskLinks.targetType, 'subtask'), eq(taskLinks.targetId, subtaskId))
      )
    );
  }

  async createTaskLink(link: InsertTaskLink): Promise<TaskLink> {
    const [created] = await db.insert(taskLinks).values(link).returning();
    return created;
  }

  async deleteTaskLink(id: number): Promise<void> {
    await db.delete(taskLinks).where(eq(taskLinks.id, id));
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project> {
    const modifiedUpdates = { ...updates, updatedAt: new Date() } as typeof updates & { updatedAt: Date; completedAt?: Date | null };
    if ('status' in updates) {
      if (updates.status === 'completed') {
        modifiedUpdates.completedAt = new Date();
      } else {
        modifiedUpdates.completedAt = null;
      }
    }
    const [updated] = await db.update(projects).set(modifiedUpdates).where(eq(projects.id, id)).returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    // Unlink tasks from this project before deleting
    await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.dueDate);
  }
}

export const storage = new DatabaseStorage();
