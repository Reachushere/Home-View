import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { getWeekDates, getWeekNumber, FIRST_WEEK, LAST_WEEK, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2, type RepeatType, type RepeatIntervalUnit, type InsertTask } from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, listEvents, listCalendars, createPrepCalendarEvent, updatePrepCalendarEvent, createEventInCalendar, deleteEventFromCalendar } from "./googleCalendar";
import { getSecondAccountAuthUrl, exchangeCodeForTokens, isSecondAccountConnected, disconnectSecondAccount, createEventInSecondAccount, createPrepEventInSecondAccount, deleteEventFromSecondAccount, updateEventInSecondAccount, getEventsFromSecondAccount } from "./secondGoogleAccount";

// Helper function to generate repeated task due dates
function generateRepeatDates(
  startDueDate: Date,
  repeatType: RepeatType,
  repeatEndDate: Date | null,
  repeatInterval?: number,
  repeatIntervalUnit?: RepeatIntervalUnit
): Date[] {
  const dates: Date[] = [];
  if (repeatType === "none") return dates;
  
  // Default end date: 6 months from start if not specified
  const endDate = repeatEndDate || new Date(startDueDate.getTime() + 180 * 24 * 60 * 60 * 1000);
  let currentDate = new Date(startDueDate);
  
  // Add interval based on repeat type
  const addInterval = (date: Date): Date => {
    const newDate = new Date(date);
    switch (repeatType) {
      case "daily":
        newDate.setDate(newDate.getDate() + 1);
        break;
      case "weekly":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "monthly":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case "custom":
        if (repeatIntervalUnit === "days") {
          newDate.setDate(newDate.getDate() + (repeatInterval || 1));
        } else if (repeatIntervalUnit === "weeks") {
          newDate.setDate(newDate.getDate() + (repeatInterval || 1) * 7);
        }
        break;
    }
    return newDate;
  };
  
  // Generate dates until end date (max 100 to prevent infinite loops)
  let count = 0;
  while (count < 100) {
    currentDate = addInterval(currentDate);
    if (currentDate > endDate) break;
    dates.push(new Date(currentDate));
    count++;
  }
  
  return dates;
}

// Dynamic import for pdf-parse to avoid CommonJS compatibility issues
let pdfParse: any = null;
async function getPdfParser() {
  if (!pdfParse) {
    const module = await import("pdf-parse");
    pdfParse = (module as any).default || (module as any).PDFParse || module;
  }
  return pdfParse;
}

// Use Nabu Casa cloud URL for remote access
const HOME_ASSISTANT_URL = "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
// Auto-detect which env var contains the JWT token (starts with "eyJ")
const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);
const BATHROOM_ECHO_ENTITY = "media_player.cat_wr";

// Track TTS reading session for resume functionality
interface TTSSession {
  fullText: string;
  currentPosition: number;
  startTime: number;
  isPlaying: boolean;
  autoTimer: ReturnType<typeof setTimeout> | null;
  targetEntity?: string;
}
let currentTTSSession: TTSSession | null = null;
// Alexa reads faster than expected - ~200 words per minute at normal speed
// At 80% speed: ~160 wpm = ~800 chars/min = ~13.3 chars/sec
// But we want to send next chunk BEFORE current finishes, so use higher value
const CHARS_PER_SECOND = 18; // Send next chunk early to avoid gaps
const CHUNK_SIZE = 2000; // Characters per TTS chunk

// Clean text for TTS - remove special characters that cause errors
function cleanTextForTTS(text: string): string {
  return text
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[<>]/g, '')
    .replace(/[^\w\s.,!?;:'"()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Get chunk with sentence boundary detection
function getChunkWithSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  let cutoff = maxLength;
  const lastPeriod = text.lastIndexOf('.', cutoff);
  const lastQuestion = text.lastIndexOf('?', cutoff);
  const lastExclaim = text.lastIndexOf('!', cutoff);
  const bestBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);
  
  if (bestBreak > maxLength * 0.5) {
    cutoff = bestBreak + 1;
  }
  
  return text.substring(0, cutoff);
}

// Function to send next TTS chunk automatically
async function sendNextChunk() {
  if (!currentTTSSession || !currentTTSSession.isPlaying) {
    console.log("sendNextChunk: No active session or not playing");
    return;
  }
  
  console.log("sendNextChunk called, currentPosition:", currentTTSSession.currentPosition);
  
  // Check if we've finished
  if (currentTTSSession.currentPosition >= currentTTSSession.fullText.length) {
    console.log("TTS auto-read complete - finished entire document");
    currentTTSSession.isPlaying = false;
    return;
  }
  
  // Get next chunk from cleaned text
  let rawChunk = currentTTSSession.fullText.substring(
    currentTTSSession.currentPosition,
    currentTTSSession.currentPosition + CHUNK_SIZE
  );
  
  if (rawChunk.trim().length === 0) {
    console.log("TTS auto-read complete - no more content");
    currentTTSSession.isPlaying = false;
    return;
  }
  
  // Clean the chunk and apply sentence boundary
  let nextChunk = cleanTextForTTS(rawChunk);
  nextChunk = getChunkWithSentenceBoundary(nextChunk, CHUNK_SIZE);
  
  // Update position BEFORE sending - advance by the chunk length we're about to send
  const chunkLength = nextChunk.length;
  currentTTSSession.currentPosition += chunkLength;
  currentTTSSession.startTime = Date.now();
  
  const targetEntity = currentTTSSession.targetEntity || BATHROOM_ECHO_ENTITY;
  console.log("Auto-continuing TTS, sent chunk length:", chunkLength, 
    "new position:", currentTTSSession.currentPosition,
    "remaining:", currentTTSSession.fullText.length - currentTTSSession.currentPosition,
    "to:", targetEntity);
  
  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
  
  try {
    // Use 90% speaking rate
    const ssmlChunk = `<speak><prosody rate="90%">${nextChunk}</prosody></speak>`;
    
    console.log("Sending chunk to Home Assistant...");
    const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: ssmlChunk,
        target: targetEntity,
        data: { type: "tts" }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Auto-continue TTS error, response:", response.status, errorText);
      // Don't stop - try to continue anyway
      console.log("Attempting to continue despite error...");
    } else {
      console.log("Chunk sent successfully");
    }
    
    // Always schedule next chunk if we still have content
    if (currentTTSSession && currentTTSSession.isPlaying && 
        currentTTSSession.currentPosition < currentTTSSession.fullText.length) {
      console.log("Scheduling next chunk...");
      scheduleNextChunk();
    } else {
      console.log("Not scheduling next - session ended or no more content");
    }
  } catch (error) {
    console.error("Auto-continue error:", error);
    // Don't stop completely on error - try to schedule next anyway
    if (currentTTSSession && currentTTSSession.isPlaying && 
        currentTTSSession.currentPosition < currentTTSSession.fullText.length) {
      console.log("Scheduling next chunk despite error...");
      scheduleNextChunk();
    }
  }
}

// Calculate delay based on chunk size and speed
// At 90% speed (slightly slower than normal)
const SPEED_RATE = 0.90;

function scheduleNextChunk() {
  if (!currentTTSSession || !currentTTSSession.isPlaying) {
    console.log("scheduleNextChunk: No active session or not playing, aborting schedule");
    return;
  }
  
  // Clear any existing timer
  if (currentTTSSession.autoTimer) {
    console.log("Clearing existing timer");
    clearTimeout(currentTTSSession.autoTimer);
  }
  
  // Calculate estimated speaking time
  // Base: CHUNK_SIZE chars / CHARS_PER_SECOND chars per sec
  // Adjust for speed: divide by speed rate (88% = 0.88 means slower)
  const baseSeconds = CHUNK_SIZE / CHARS_PER_SECOND;
  const adjustedSeconds = baseSeconds / SPEED_RATE;
  const delayMs = adjustedSeconds * 1000;
  
  console.log(`scheduleNextChunk: Scheduling next chunk in ${(delayMs / 1000).toFixed(1)} seconds (${CHUNK_SIZE} chars at ${SPEED_RATE * 100}% speed)`);
  
  currentTTSSession.autoTimer = setTimeout(() => {
    console.log("Timer fired, calling sendNextChunk");
    sendNextChunk();
  }, delayMs);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // GET /api/tasks
  app.get(api.tasks.list.path, async (req, res) => {
    const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : undefined;
    const type = req.query.type as string | undefined;
    const showCompleted = req.query.showCompleted !== 'false';
    
    const tasks = await storage.getTasks({ weekNumber, type, showCompleted });
    
    // Mark missed tasks
    const now = new Date();
    const tasksWithMissed = tasks.map(task => ({
      ...task,
      isMissed: !task.isCompleted && new Date(task.dueDate) < now
    }));
    
    res.json(tasksWithMissed);
  });

  // GET /api/tasks/:id
  app.get(api.tasks.get.path, async (req, res) => {
    const task = await storage.getTask(Number(req.params.id));
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  });

  // POST /api/tasks
  app.post(api.tasks.create.path, async (req, res) => {
    try {
      const input = api.tasks.create.input.parse(req.body);
      const task = await storage.createTask(input);
      
      // Auto-sync to Google Calendar (primary account)
      try {
        const event = await createCalendarEvent({
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          courseName: task.courseName,
        });
        // Update task with calendar event ID
        await storage.updateTask(task.id, {
          calendarEventId: event.id,
          calendarProvider: "google",
        });
        
        // Also sync to secondary calendar if configured
        const activeSemester = await storage.getActiveSemesterSettings();
        if (activeSemester?.secondaryCalendarId) {
          try {
            const secondaryEvent = await createEventInCalendar(activeSemester.secondaryCalendarId, {
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              courseName: task.courseName,
            });
            await storage.updateTask(task.id, {
              secondaryCalendarEventId: secondaryEvent.id,
            });
          } catch (secErr) {
            console.error("Auto-sync to secondary calendar failed:", secErr);
          }
        }
      } catch (calErr) {
        console.error("Auto-sync to Google Calendar failed:", calErr);
      }
      
      // Also sync to second Google account if connected
      try {
        const secondAccountStatus = await isSecondAccountConnected();
        if (secondAccountStatus.connected) {
          const secondEvent = await createEventInSecondAccount({
            id: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            courseName: task.courseName,
          });
          await storage.updateTask(task.id, {
            secondAccountCalendarEventId: secondEvent.id,
          });
          
          // Also sync prep event if task has startDate
          if (task.startDate) {
            const prepEvent = await createPrepEventInSecondAccount({
              id: task.id,
              title: task.title,
              description: task.description,
              startDate: task.startDate,
              dueDate: task.dueDate,
              courseName: task.courseName,
            });
            await storage.updateTask(task.id, {
              secondAccountPrepEventId: prepEvent.id,
            });
          }
        }
      } catch (secAccErr) {
        console.error("Auto-sync to second Google account failed:", secAccErr);
      }
      
      // Generate repeated task instances if repeat is set
      if (task.repeatType && task.repeatType !== "none") {
        const activeSemester = await storage.getActiveSemesterSettings();
        const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
        
        const repeatDates = generateRepeatDates(
          task.dueDate,
          task.repeatType as RepeatType,
          task.repeatEndDate,
          task.repeatInterval ?? undefined,
          task.repeatIntervalUnit as RepeatIntervalUnit | undefined
        );
        
        // Calculate the duration of prep period (if any)
        let prepDuration = 0;
        if (task.startDate) {
          prepDuration = task.dueDate.getTime() - task.startDate.getTime();
        }
        
        // Create child tasks for each repeat date
        for (const repeatDueDate of repeatDates) {
          const childStartDate = prepDuration > 0 
            ? new Date(repeatDueDate.getTime() - prepDuration) 
            : null;
          
          const childTask: InsertTask = {
            title: task.title,
            description: task.description,
            type: task.type,
            courseName: task.courseName,
            startDate: childStartDate,
            dueDate: repeatDueDate,
            eventStartTime: task.eventStartTime,
            eventEndTime: task.eventEndTime,
            reminder1: task.reminder1,
            reminder2: task.reminder2,
            reminder3: task.reminder3,
            reminder4: task.reminder4,
            weekNumber: getWeekNumber(repeatDueDate, semesterStart),
            priority: task.priority,
            notes: task.notes,
            referenceLink: task.referenceLink,
            attachments: task.attachments,
            repeatType: "none", // Child tasks don't repeat
            parentTaskId: task.id,
          };
          
          try {
            const createdChild = await storage.createTask(childTask);
            // Sync child to calendar too
            const childEvent = await createCalendarEvent({
              id: createdChild.id,
              title: createdChild.title,
              description: createdChild.description,
              dueDate: createdChild.dueDate,
              courseName: createdChild.courseName,
            });
            await storage.updateTask(createdChild.id, {
              calendarEventId: childEvent.id,
              calendarProvider: "google",
            });
            
            // Also sync child to second Google account
            const secondStatus = await isSecondAccountConnected();
            if (secondStatus.connected) {
              try {
                const childSecondEvent = await createEventInSecondAccount({
                  id: createdChild.id,
                  title: createdChild.title,
                  description: createdChild.description,
                  dueDate: createdChild.dueDate,
                  courseName: createdChild.courseName,
                });
                await storage.updateTask(createdChild.id, {
                  secondAccountCalendarEventId: childSecondEvent.id,
                });
              } catch (secErr) {
                console.error("Error syncing child task to second account:", secErr);
              }
            }
          } catch (childErr) {
            console.error("Error creating repeated task instance:", childErr);
          }
        }
      }
      
      // Fetch the updated parent task
      const updatedTask = await storage.getTask(task.id);
      res.status(201).json(updatedTask);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // PATCH /api/tasks/:id
  app.patch(api.tasks.update.path, async (req, res) => {
    try {
      const input = api.tasks.update.input.parse(req.body);
      const existingTask = await storage.getTask(Number(req.params.id));
      const task = await storage.updateTask(Number(req.params.id), input);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Auto-sync to Google Calendar if task has calendar event
      if (task.calendarEventId) {
        try {
          await updateCalendarEvent(task.calendarEventId, {
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            courseName: task.courseName,
          });
        } catch (calErr) {
          console.error("Auto-update Google Calendar failed:", calErr);
        }
      }
      
      // Also sync to second Google account if connected and has event
      if (task.secondAccountCalendarEventId) {
        try {
          await updateEventInSecondAccount(task.secondAccountCalendarEventId, {
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            courseName: task.courseName,
          });
        } catch (secAccErr) {
          console.error("Auto-update second Google account failed:", secAccErr);
        }
      }
      
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // DELETE /api/tasks/:id
  app.delete(api.tasks.delete.path, async (req, res) => {
    const taskId = Number(req.params.id);
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Delete from Google Calendar if synced
    if (task.calendarEventId) {
      try {
        await deleteCalendarEvent(task.calendarEventId);
      } catch (calErr) {
        console.error("Auto-delete from Google Calendar failed:", calErr);
      }
    }
    
    // Delete from secondary calendar if synced
    if (task.secondaryCalendarEventId) {
      const activeSemester = await storage.getActiveSemesterSettings();
      if (activeSemester?.secondaryCalendarId) {
        try {
          await deleteEventFromCalendar(activeSemester.secondaryCalendarId, task.secondaryCalendarEventId);
        } catch (secErr) {
          console.error("Auto-delete from secondary calendar failed:", secErr);
        }
      }
    }
    
    // Delete from second Google account if synced
    if (task.secondAccountCalendarEventId) {
      try {
        await deleteEventFromSecondAccount(task.secondAccountCalendarEventId);
      } catch (secAccErr) {
        console.error("Auto-delete from second Google account failed:", secAccErr);
      }
    }
    if (task.secondAccountPrepEventId) {
      try {
        await deleteEventFromSecondAccount(task.secondAccountPrepEventId);
      } catch (secAccErr) {
        console.error("Auto-delete prep event from second account failed:", secAccErr);
      }
    }
    
    // If this is a parent task with repeat, also delete all child tasks
    if (task.repeatType && task.repeatType !== "none") {
      const childTasks = await storage.getChildTasks(taskId);
      for (const child of childTasks) {
        // Delete child from calendar
        if (child.calendarEventId) {
          try {
            await deleteCalendarEvent(child.calendarEventId);
          } catch (calErr) {
            console.error("Failed to delete child calendar event:", calErr);
          }
        }
        // Delete child from second Google account
        if (child.secondAccountCalendarEventId) {
          try {
            await deleteEventFromSecondAccount(child.secondAccountCalendarEventId);
          } catch (secAccErr) {
            console.error("Failed to delete child from second account:", secAccErr);
          }
        }
      }
      // Delete all child tasks
      await storage.deleteChildTasks(taskId);
    }
    
    await storage.deleteTask(taskId);
    res.status(204).end();
  });

  // PATCH /api/tasks/:id/complete
  app.patch(api.tasks.complete.path, async (req, res) => {
    const { isCompleted } = req.body;
    const task = await storage.updateTask(Number(req.params.id), { isCompleted });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  });

  // ============= SEMESTER SETTINGS ROUTES =============

  // GET /api/semester - Get active semester settings
  app.get(api.semester.get.path, async (_req, res) => {
    try {
      const settings = await storage.getActiveSemesterSettings();
      res.json(settings || null);
    } catch (err) {
      console.error("Error fetching semester settings:", err);
      res.status(500).json({ error: "Failed to fetch semester settings" });
    }
  });

  // POST /api/semester - Create new semester settings
  app.post(api.semester.create.path, async (req, res) => {
    try {
      const input = api.semester.create.input.parse(req.body);
      const settings = await storage.createSemesterSettings(input);
      res.status(201).json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error creating semester settings:", err);
      res.status(500).json({ error: "Failed to create semester settings" });
    }
  });

  // PATCH /api/semester-settings/calendar - Update secondary calendar
  app.patch("/api/semester-settings/calendar", async (req, res) => {
    try {
      const { secondaryCalendarId } = req.body;
      const activeSemester = await storage.getActiveSemesterSettings();
      if (!activeSemester) {
        return res.status(404).json({ error: "No active semester settings found" });
      }
      const updated = await storage.updateSemesterSettings(activeSemester.id, { secondaryCalendarId });
      res.json(updated);
    } catch (err) {
      console.error("Error updating secondary calendar:", err);
      res.status(500).json({ error: "Failed to update secondary calendar" });
    }
  });

  // ============= FILE MANAGEMENT ROUTES =============

  // GET /api/files - List all uploaded files
  app.get("/api/files", async (_req, res) => {
    try {
      const files = await storage.getFiles();
      res.json(files);
    } catch (err) {
      console.error("Error fetching files:", err);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // GET /api/files/:id - Get single file
  app.get("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err) {
      console.error("Error fetching file:", err);
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  // GET /api/files/:id/download - Download the actual file
  app.get("/api/files/:id/download", async (req, res) => {
    try {
      const file = await storage.getFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const mediaUrl = file.objectPath;
      
      if (mediaUrl.startsWith("/objects/")) {
        const { ObjectStorageService } = await import("./replit_integrations/object_storage");
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(mediaUrl);
        
        // Download file content as buffer
        const [content] = await objectFile.download();
        
        // Set content type based on file extension
        const ext = (file.originalName || '').toLowerCase().split('.').pop();
        const contentTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'mp3': 'audio/mpeg',
          'mp4': 'video/mp4',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        
        res.setHeader('Content-Type', contentTypes[ext || ''] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.displayName || file.originalName}"`);
        res.setHeader('Content-Length', content.length.toString());
        res.send(content);
      } else {
        // For external URLs, redirect
        res.redirect(mediaUrl);
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // GET /api/files/:id/text - Extract text content from a file (for PDF reading with highlighting)
  app.get("/api/files/:id/text", async (req, res) => {
    try {
      const file = await storage.getFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const mediaUrl = file.objectPath;
      let textContent = "";
      let fileBuffer: Buffer | null = null;
      
      if (mediaUrl.startsWith("/objects/")) {
        const { ObjectStorageService } = await import("./replit_integrations/object_storage");
        const objectStorage = new ObjectStorageService();
        
        try {
          const objectFile = await objectStorage.getObjectEntityFile(mediaUrl);
          const [content] = await objectFile.download();
          fileBuffer = content;
        } catch (error) {
          console.error("Error reading from object storage:", error);
          return res.status(400).json({ error: "Failed to read file from storage" });
        }
      } else {
        const fileResponse = await fetch(mediaUrl);
        if (!fileResponse.ok) {
          return res.status(400).json({ error: "Failed to fetch file content" });
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
      
      if (!fileBuffer) {
        return res.status(400).json({ error: "Failed to read file" });
      }

      const isPDF = fileBuffer.slice(0, 4).toString() === '%PDF';
      
      if (isPDF) {
        try {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(fileBuffer) });
          await parser.load();
          const pdfText = await parser.getText();
          
          // Use a special marker to indicate page breaks for sync with PDF viewer
          const PAGE_BREAK_MARKER = '\n\n---PAGE---\n\n';
          
          if (pdfText && typeof pdfText === 'object') {
            if (pdfText.pages && Array.isArray(pdfText.pages)) {
              textContent = pdfText.pages.map((page: any) => page.text || '').join(PAGE_BREAK_MARKER);
            } else if (Array.isArray(pdfText)) {
              textContent = pdfText.map((item: any) => typeof item === 'string' ? item : item.text || '').join(PAGE_BREAK_MARKER);
            } else if (pdfText.text) {
              textContent = pdfText.text;
            } else {
              textContent = Object.values(pdfText).filter(v => typeof v === 'string').join(PAGE_BREAK_MARKER);
            }
          } else if (typeof pdfText === 'string') {
            textContent = pdfText;
          } else {
            textContent = String(pdfText || '');
          }
          await parser.destroy();
        } catch (error) {
          console.error("Error parsing PDF:", error);
          return res.status(400).json({ error: "Failed to parse PDF" });
        }
      } else {
        textContent = fileBuffer.toString('utf-8');
      }
      
      // Clean up the text while preserving formatting structure
      textContent = textContent
        // Convert fancy quotes to regular quotes
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        // Convert dashes
        .replace(/[\u2013\u2014]/g, "-")
        // Preserve bullet characters
        .replace(/[\u2022\u25CF\u25E6\u25AA\u25AB]/g, '•')
        // Keep alphanumeric, punctuation, newlines, and common symbols
        .replace(/[^\x20-\x7E\n•→►▶]/g, ' ')
        // Normalize multiple spaces (but not newlines)
        .replace(/[ \t]+/g, ' ')
        // Preserve single line breaks (likely formatting)
        // but collapse 3+ into 2
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      res.json({ text: textContent, fileName: file.displayName || file.originalName });
    } catch (err) {
      console.error("Error extracting file text:", err);
      res.status(500).json({ error: "Failed to extract file text" });
    }
  });

  // PATCH /api/files/:id - Update file (rename, change folder, or mark listened)
  app.patch("/api/files/:id", async (req, res) => {
    try {
      const { displayName, folder, listened } = req.body;
      if (!displayName && folder === undefined && listened === undefined) {
        return res.status(400).json({ error: "displayName, folder, or listened is required" });
      }
      const file = await storage.updateFile(Number(req.params.id), { displayName, folder, listened });
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err) {
      console.error("Error updating file:", err);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  // POST /api/files/:id/assign - Assign file to a task
  app.post("/api/files/:id/assign", async (req, res) => {
    try {
      const { taskId } = req.body;
      if (!taskId) {
        return res.status(400).json({ error: "taskId is required" });
      }

      const file = await storage.getFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const task = await storage.getTask(Number(taskId));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Add file to task attachments if not already there
      const currentAttachments = task.attachments || [];
      if (!currentAttachments.includes(file.objectPath)) {
        const updatedTask = await storage.updateTask(task.id, {
          attachments: [...currentAttachments, file.objectPath],
        });
        res.json({ success: true, task: updatedTask, file });
      } else {
        res.json({ success: true, message: "File already attached to task", task, file });
      }
    } catch (err) {
      console.error("Error assigning file:", err);
      res.status(500).json({ error: "Failed to assign file to task" });
    }
  });

  // POST /api/files/assign-by-path - Assign file to a task by object path
  app.post("/api/files/assign-by-path", async (req, res) => {
    try {
      const { objectPath, taskId } = req.body;
      if (!objectPath || !taskId) {
        return res.status(400).json({ error: "objectPath and taskId are required" });
      }

      const file = await storage.getFileByPath(objectPath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const task = await storage.getTask(Number(taskId));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Add file to task attachments if not already there
      const currentAttachments = task.attachments || [];
      if (!currentAttachments.includes(file.objectPath)) {
        const updatedTask = await storage.updateTask(task.id, {
          attachments: [...currentAttachments, file.objectPath],
        });
        res.json({ success: true, task: updatedTask, file });
      } else {
        res.json({ success: true, message: "File already attached to task", task, file });
      }
    } catch (err) {
      console.error("Error assigning file by path:", err);
      res.status(500).json({ error: "Failed to assign file to task" });
    }
  });

  // DELETE /api/files/:id - Delete file and remove from all task attachments
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Remove file reference from all tasks that have it attached
      const allTasks = await storage.getTasks({});
      for (const task of allTasks) {
        if (task.attachments && task.attachments.includes(file.objectPath)) {
          const updatedAttachments = task.attachments.filter(a => a !== file.objectPath);
          await storage.updateTask(task.id, { attachments: updatedAttachments });
        }
      }

      await storage.deleteFile(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      console.error("Error deleting file:", err);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // GET /api/files/:id/tasks - Get tasks that have this file attached
  app.get("/api/files/:id/tasks", async (req, res) => {
    try {
      const file = await storage.getFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const allTasks = await storage.getTasks({});
      const tasksWithFile = allTasks.filter(task => 
        task.attachments && task.attachments.includes(file.objectPath)
      );
      
      res.json(tasksWithFile);
    } catch (err) {
      console.error("Error fetching tasks for file:", err);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // ============= END FILE MANAGEMENT ROUTES =============

  // ============= DELETED FOLDERS ROUTES =============
  
  // GET /api/deleted-folders - Get all deleted folders
  app.get("/api/deleted-folders", async (_req, res) => {
    try {
      const folders = await storage.getDeletedFolders();
      res.json(folders);
    } catch (err) {
      console.error("Error fetching deleted folders:", err);
      res.status(500).json({ error: "Failed to fetch deleted folders" });
    }
  });

  // POST /api/deleted-folders - Add a folder to deleted list
  app.post("/api/deleted-folders", async (req, res) => {
    try {
      const { folderId } = req.body;
      if (!folderId) {
        return res.status(400).json({ error: "folderId is required" });
      }
      const folder = await storage.addDeletedFolder(folderId);
      res.json(folder);
    } catch (err) {
      console.error("Error adding deleted folder:", err);
      res.status(500).json({ error: "Failed to add deleted folder" });
    }
  });

  // DELETE /api/deleted-folders/:folderId - Remove a folder from deleted list (restore it)
  app.delete("/api/deleted-folders/:folderId", async (req, res) => {
    try {
      const folderId = decodeURIComponent(req.params.folderId);
      await storage.removeDeletedFolder(folderId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing deleted folder:", err);
      res.status(500).json({ error: "Failed to remove deleted folder" });
    }
  });

  // ============= END DELETED FOLDERS ROUTES =============

  // ============= CUSTOM FOLDERS ROUTES =============
  
  // GET /api/custom-folders - Get all custom folders
  app.get("/api/custom-folders", async (_req, res) => {
    try {
      const folders = await storage.getCustomFolders();
      res.json(folders);
    } catch (err) {
      console.error("Error fetching custom folders:", err);
      res.status(500).json({ error: "Failed to fetch custom folders" });
    }
  });

  // POST /api/custom-folders - Create a custom folder
  app.post("/api/custom-folders", async (req, res) => {
    try {
      const { parentFolderId, name } = req.body;
      if (!parentFolderId || !name) {
        return res.status(400).json({ error: "parentFolderId and name are required" });
      }
      const folder = await storage.createCustomFolder({ parentFolderId, name });
      res.json(folder);
    } catch (err) {
      console.error("Error creating custom folder:", err);
      res.status(500).json({ error: "Failed to create custom folder" });
    }
  });

  // PATCH /api/custom-folders/:id - Rename a custom folder
  app.patch("/api/custom-folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      const folder = await storage.updateCustomFolder(id, name);
      res.json(folder);
    } catch (err) {
      console.error("Error renaming custom folder:", err);
      res.status(500).json({ error: "Failed to rename custom folder" });
    }
  });

  // DELETE /api/custom-folders/:id - Delete a custom folder
  app.delete("/api/custom-folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomFolder(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting custom folder:", err);
      res.status(500).json({ error: "Failed to delete custom folder" });
    }
  });

  // DELETE /api/custom-folders - Delete ALL custom folders
  app.delete("/api/custom-folders", async (_req, res) => {
    try {
      const folders = await storage.getCustomFolders();
      for (const folder of folders) {
        await storage.deleteCustomFolder(folder.id);
      }
      res.json({ success: true, deleted: folders.length });
    } catch (err) {
      console.error("Error deleting all custom folders:", err);
      res.status(500).json({ error: "Failed to delete custom folders" });
    }
  });

  // ============= END CUSTOM FOLDERS ROUTES =============

  // GET /api/calendar/list - List all available Google calendars for selection
  app.get("/api/calendar/list", async (_req, res) => {
    try {
      const calendars = await listCalendars();
      const formattedCalendars = calendars.map((c: any) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary || false,
        backgroundColor: c.backgroundColor,
      }));
      res.json(formattedCalendars);
    } catch (err) {
      console.error("List calendars error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/calendar/debug - Debug Google Calendar connection
  app.get("/api/calendar/debug", async (_req, res) => {
    try {
      const calendars = await listCalendars();
      const primary = calendars.find((c: any) => c.primary);
      
      // Get events from the past week to now + 2 months
      const now = new Date();
      const twoMonthsLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const events = await listEvents(now, twoMonthsLater);
      
      res.json({
        connectedEmail: primary?.id || 'unknown',
        calendarSummary: primary?.summary || 'unknown',
        totalCalendars: calendars.length,
        upcomingEventsCount: events.length,
        sampleEvents: events.slice(0, 5).map((e: any) => ({
          id: e.id,
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
        })),
      });
    } catch (err) {
      console.error("Calendar debug error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ============= SECOND GOOGLE ACCOUNT ROUTES =============

  // GET /api/google/second-account/status - Check if second account is connected
  app.get("/api/google/second-account/status", async (_req, res) => {
    try {
      const status = await isSecondAccountConnected();
      res.json(status);
    } catch (err) {
      console.error("Second account status error:", err);
      res.json({ connected: false, error: String(err) });
    }
  });

  // GET /api/google/second-account/auth - Start OAuth flow for second account
  app.get("/api/google/second-account/auth", async (_req, res) => {
    try {
      const authUrl = getSecondAccountAuthUrl();
      res.json({ authUrl });
    } catch (err) {
      console.error("Second account auth error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/google/second-account/callback - OAuth callback handler
  app.get("/api/google/second-account/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send('Missing authorization code');
      }
      
      const account = await exchangeCodeForTokens(code);
      
      // Redirect back to dashboard with success message
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Success</title></head>
          <body>
            <h1>Second Google Account Connected!</h1>
            <p>Connected email: ${account.email}</p>
            <p>You can close this window and return to the app.</p>
            <script>
              setTimeout(() => {
                window.opener?.postMessage({ type: 'SECOND_ACCOUNT_CONNECTED', email: '${account.email}' }, '*');
                window.close();
              }, 1500);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Second account callback error:", err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Connection Failed</h1>
            <p>Error: ${String(err)}</p>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
    }
  });

  // DELETE /api/google/second-account - Disconnect second account
  app.delete("/api/google/second-account", async (_req, res) => {
    try {
      await disconnectSecondAccount();
      res.json({ success: true });
    } catch (err) {
      console.error("Second account disconnect error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/google/second-account/events - Get events from second account
  app.get("/api/google/second-account/events", async (req, res) => {
    try {
      const timeMin = new Date(req.query.timeMin as string || Date.now());
      const timeMax = new Date(req.query.timeMax as string || Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const events = await getEventsFromSecondAccount(timeMin, timeMax);
      res.json(events);
    } catch (err) {
      console.error("Second account events error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ============= END SECOND GOOGLE ACCOUNT ROUTES =============

  // POST /api/tasks/:id/sync-calendar - Manually sync task to Google Calendar
  app.post("/api/tasks/:id/sync-calendar", async (req, res) => {
    try {
      const task = await storage.getTask(Number(req.params.id));
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // If already synced, update the event
      if (task.calendarEventId) {
        await updateCalendarEvent(task.calendarEventId, {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          courseName: task.courseName,
        });
        return res.json({ success: true, message: 'Calendar event updated' });
      }
      
      // Create new calendar event
      const event = await createCalendarEvent({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        courseName: task.courseName,
      });
      
      // Update task with calendar event ID
      const updatedTask = await storage.updateTask(task.id, {
        calendarEventId: event.id,
        calendarProvider: "google",
      });
      
      res.json({ success: true, task: updatedTask, message: 'Task synced to Google Calendar' });
    } catch (err) {
      console.error("Error syncing task to calendar:", err);
      res.status(500).json({ message: 'Failed to sync task to Google Calendar', error: String(err) });
    }
  });

  // POST /api/tasks/sync-all-calendar - Sync all tasks to Google Calendar
  app.post("/api/tasks/sync-all-calendar", async (req, res) => {
    try {
      const tasks = await storage.getTasks({});
      const results = { dueEvents: { created: 0, updated: 0, failed: 0 }, prepEvents: { created: 0, updated: 0, failed: 0, skipped: 0 } };
      
      for (const task of tasks) {
        // Sync due date event
        try {
          if (task.calendarEventId) {
            // Update existing calendar event (may return new ID if type changed)
            const updatedEvent = await updateCalendarEvent(task.calendarEventId, {
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              courseName: task.courseName,
            });
            // If event was recreated, update the stored ID
            if (updatedEvent.id && updatedEvent.id !== task.calendarEventId) {
              await storage.updateTask(task.id, { calendarEventId: updatedEvent.id });
            }
            results.dueEvents.updated++;
          } else {
            // Create new calendar event
            const event = await createCalendarEvent({
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              courseName: task.courseName,
            });
            
            await storage.updateTask(task.id, {
              calendarEventId: event.id,
              calendarProvider: "google",
            });
            
            results.dueEvents.created++;
          }
        } catch (err) {
          console.error(`Failed to sync due date for task ${task.id}:`, err);
          results.dueEvents.failed++;
        }
        
        // Sync prep/start date event (if task has a startDate)
        if (task.startDate) {
          try {
            if (task.prepCalendarEventId) {
              // Update existing prep event
              const updatedEvent = await updatePrepCalendarEvent(task.prepCalendarEventId, {
                title: task.title,
                description: task.description,
                startDate: task.startDate,
                dueDate: task.dueDate,
                courseName: task.courseName,
              });
              // If event was recreated, update the stored ID
              if (updatedEvent.id && updatedEvent.id !== task.prepCalendarEventId) {
                await storage.updateTask(task.id, { prepCalendarEventId: updatedEvent.id });
              }
              results.prepEvents.updated++;
            } else {
              // Create new prep event
              const event = await createPrepCalendarEvent({
                id: task.id,
                title: task.title,
                description: task.description,
                startDate: task.startDate,
                dueDate: task.dueDate,
                courseName: task.courseName,
              });
              
              await storage.updateTask(task.id, { prepCalendarEventId: event.id });
              results.prepEvents.created++;
            }
          } catch (err) {
            console.error(`Failed to sync prep event for task ${task.id}:`, err);
            results.prepEvents.failed++;
          }
        } else {
          results.prepEvents.skipped++;
        }
      }
      
      res.json({ success: true, results });
    } catch (err) {
      console.error("Error syncing all tasks:", err);
      res.status(500).json({ message: 'Failed to sync tasks', error: String(err) });
    }
  });

  // PATCH /api/tasks/:id/reschedule
  app.patch(api.tasks.reschedule.path, async (req, res) => {
    const { dueDate, weekNumber } = req.body;
    const task = await storage.updateTask(Number(req.params.id), { 
      dueDate: new Date(dueDate),
      weekNumber,
      isMissed: false
    });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Auto-sync to Google Calendar if task has calendar event
    if (task.calendarEventId) {
      try {
        await updateCalendarEvent(task.calendarEventId, {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          courseName: task.courseName,
        });
      } catch (calErr) {
        console.error("Auto-update Google Calendar on reschedule failed:", calErr);
      }
    }
    
    res.json(task);
  });

  // GET /api/tasks/:id/ics - Generate ICS file for calendar sync
  app.get(api.tasks.exportCalendar.path, async (req, res) => {
    const task = await storage.getTask(Number(req.params.id));
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const dueDate = new Date(task.dueDate);
    const icsContent = generateICS(task.title, task.description || '', dueDate, task.type);
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${task.title.replace(/[^a-z0-9]/gi, '_')}.ics"`);
    res.send(icsContent);
  });

  // GET /api/weeks/current
  app.get(api.weeks.current.path, async (_req, res) => {
    const activeSemester = await storage.getActiveSemesterSettings();
    const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
    const now = new Date();
    const weekNum = getWeekNumber(now, semesterStart);
    const { start, end } = getWeekDates(weekNum, semesterStart);
    res.json({
      weekNumber: weekNum,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  });

  // GET /api/weeks
  app.get(api.weeks.list.path, async (_req, res) => {
    const activeSemester = await storage.getActiveSemesterSettings();
    const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
    const taskCounts = await storage.getTaskCountByWeek();
    const weeks = [];
    
    for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
      const { start, end } = getWeekDates(w, semesterStart);
      weeks.push({
        weekNumber: w,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        taskCount: taskCounts[w] || 0,
      });
    }
    
    res.json(weeks);
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // POST /api/tts - Send text-to-speech to Home Assistant Echo device
  app.post("/api/tts", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Use notify.alexa_media for Echo devices via Alexa Media Player integration
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          target: BATHROOM_ECHO_ENTITY,
          data: {
            type: "tts"
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant TTS error:", errorText);
        return res.status(response.status).json({ error: "Failed to send TTS to Home Assistant" });
      }

      res.json({ success: true, message: "Text-to-speech sent to bathroom Echo" });
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to send text-to-speech" });
    }
  });

  // POST /api/media/play - Extract text from PDF and read it aloud via TTS
  app.post("/api/media/play", async (req, res) => {
    try {
      const { mediaUrl, entityId } = req.body;
      const targetEntity = entityId || BATHROOM_ECHO_ENTITY;
      
      if (!mediaUrl) {
        return res.status(400).json({ error: "Media URL is required" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      // Read file content from object storage
      let textContent = "";
      let fileBuffer: Buffer | null = null;
      
      if (mediaUrl.startsWith("/objects/")) {
        // It's an object storage path - read from object storage
        const { ObjectStorageService } = await import("./replit_integrations/object_storage");
        const objectStorage = new ObjectStorageService();
        
        try {
          const objectFile = await objectStorage.getObjectEntityFile(mediaUrl);
          
          // Download the file content as buffer
          const [content] = await objectFile.download();
          fileBuffer = content;
        } catch (error) {
          console.error("Error reading from object storage:", error);
          return res.status(400).json({ error: "Failed to read file from storage" });
        }
      } else {
        // It's a regular URL - fetch it
        const fileResponse = await fetch(mediaUrl);
        if (!fileResponse.ok) {
          return res.status(400).json({ error: "Failed to fetch file content" });
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
      
      if (!fileBuffer) {
        return res.status(400).json({ error: "Failed to read file" });
      }

      // Check if it's a PDF by looking at the magic bytes
      const isPDF = fileBuffer.slice(0, 4).toString() === '%PDF';
      
      if (isPDF) {
        // Parse PDF and extract text using PDFParse class
        try {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(fileBuffer) });
          await parser.load();
          const pdfText = await parser.getText();
          // getText() returns an object with pages array containing text
          if (pdfText && typeof pdfText === 'object') {
            if (pdfText.pages && Array.isArray(pdfText.pages)) {
              // Extract text from each page
              textContent = pdfText.pages.map((page: any) => page.text || '').join(' ');
            } else if (Array.isArray(pdfText)) {
              textContent = pdfText.map((item: any) => typeof item === 'string' ? item : item.text || '').join(' ');
            } else if (pdfText.text) {
              textContent = pdfText.text;
            } else {
              // Fallback - try to extract any text properties
              textContent = Object.values(pdfText).filter(v => typeof v === 'string').join(' ');
            }
          } else if (typeof pdfText === 'string') {
            textContent = pdfText;
          } else {
            textContent = String(pdfText || '');
          }
          await parser.destroy();
        } catch (error) {
          console.error("Error parsing PDF:", error);
          return res.status(400).json({ error: "Failed to parse PDF" });
        }
      } else {
        // Treat as plain text
        textContent = fileBuffer.toString('utf-8');
      }
      
      if (!textContent || textContent.trim().length === 0) {
        return res.status(400).json({ error: "File is empty or not readable" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Clean up the text for TTS
      let cleanedContent = textContent.trim();
      // Remove excessive whitespace and newlines
      cleanedContent = cleanedContent.replace(/\s+/g, ' ');
      // Remove special Unicode characters that cause Simon Says error
      cleanedContent = cleanedContent
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[^\x20-\x7E]/g, ' ');
      cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
      // Limit length for TTS - Alexa can handle up to ~3000 chars per message
      if (cleanedContent.length > 3000) {
        cleanedContent = cleanedContent.substring(0, 3000);
      }
      // Save session for resume functionality - store full cleaned text (up to 100,000 chars)
      const fullCleanedText = textContent.trim()
        .replace(/\s+/g, ' ')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ').trim();
      
      currentTTSSession = {
        fullText: fullCleanedText.length > 100000 ? fullCleanedText.substring(0, 100000) : fullCleanedText,
        currentPosition: 0,
        startTime: Date.now(),
        isPlaying: true,
        autoTimer: null
      };
      
      // Use simple message without prefix for Simon Says compatibility
      // cleanedContent = "Now reading your document. " + cleanedContent;
      
      // Use TTS type like the working /api/tts endpoint
      console.log("TTS content preview:", cleanedContent.substring(0, 200));
      console.log("Total document length:", fullCleanedText.length, "characters");
      
      // Store the target entity in session for resume
      currentTTSSession.targetEntity = targetEntity;
      
      // Restore volume in case it was muted by previous stop
      await fetch(`${haUrl}/api/services/media_player/volume_set`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: targetEntity,
          volume_level: 0.5
        }),
      });
      
      // Clean and chunk the content
      cleanedContent = cleanTextForTTS(cleanedContent);
      cleanedContent = getChunkWithSentenceBoundary(cleanedContent, CHUNK_SIZE);
      
      // Use 90% speaking rate
      const ssmlContent = `<speak><prosody rate="90%">${cleanedContent}</prosody></speak>`;
      
      console.log("Sending TTS to:", targetEntity);
      console.log("Cleaned message length:", cleanedContent.length);
      
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ssmlContent,
          target: targetEntity,
          data: {
            type: "tts"
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant TTS error:", errorText);
        currentTTSSession = null;
        return res.status(response.status).json({ error: "Failed to read file content" });
      }

      // Update position AFTER sending first chunk - advance by the chunk length we just sent
      currentTTSSession.currentPosition = cleanedContent.length;
      console.log("First chunk sent, updated position to:", currentTTSSession.currentPosition);

      // Schedule automatic continuation for the rest of the document
      scheduleNextChunk();

      res.json({ success: true, message: "Reading PDF content aloud", targetEntity });
    } catch (error) {
      console.error("Play media error:", error);
      res.status(500).json({ error: "Failed to play media" });
    }
  });

  // POST /api/media/stop - Stop media playback on Echo device
  app.post("/api/media/stop", async (req, res) => {
    try {
      const { entityId } = req.body || {};
      const targetEntity = entityId || currentTTSSession?.targetEntity || BATHROOM_ECHO_ENTITY;
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Cancel auto-continuation timer and calculate position
      if (currentTTSSession) {
        // Clear the auto timer
        if (currentTTSSession.autoTimer) {
          clearTimeout(currentTTSSession.autoTimer);
          currentTTSSession.autoTimer = null;
        }
        
        if (currentTTSSession.isPlaying) {
          const elapsedSeconds = (Date.now() - currentTTSSession.startTime) / 1000;
          const charsRead = Math.floor(elapsedSeconds * CHARS_PER_SECOND);
          currentTTSSession.currentPosition = Math.min(
            currentTTSSession.currentPosition + charsRead,
            currentTTSSession.fullText.length
          );
          currentTTSSession.isPlaying = false;
          console.log(`TTS stopped at position ${currentTTSSession.currentPosition} of ${currentTTSSession.fullText.length}`);
        }
      }
      
      // Mute volume to silence ongoing TTS (most reliable method)
      await fetch(`${haUrl}/api/services/media_player/volume_set`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: targetEntity,
          volume_level: 0
        }),
      });
      
      console.log("Muted speaker to stop TTS");
      
      // Try media_player/media_stop as well
      await fetch(`${haUrl}/api/services/media_player/media_stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: targetEntity,
        }),
      });
      
      // Restore volume after TTS would have finished (use longer delay)
      // This gives the current announcement time to complete while muted
      setTimeout(async () => {
        await fetch(`${haUrl}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: targetEntity,
            volume_level: 0.5
          }),
        });
        console.log("Restored volume after mute");
      }, 60000); // 60 seconds - long enough for any chunk to finish

      const canResume = currentTTSSession && currentTTSSession.currentPosition < currentTTSSession.fullText.length;
      res.json({ success: true, canResume });
    } catch (error) {
      console.error("Stop error:", error);
      res.status(500).json({ error: "Failed to stop media" });
    }
  });

  // POST /api/media/resume - Resume TTS from where it was stopped
  app.post("/api/media/resume", async (_req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      if (!currentTTSSession || currentTTSSession.currentPosition >= currentTTSSession.fullText.length) {
        return res.status(400).json({ error: "Nothing to resume" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Restore volume in case it was muted by stop
      await fetch(`${haUrl}/api/services/media_player/volume_set`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: currentTTSSession.targetEntity || BATHROOM_ECHO_ENTITY,
          volume_level: 0.5
        }),
      });
      
      // Get remaining text from current position
      let remainingText = currentTTSSession.fullText.substring(currentTTSSession.currentPosition);
      
      if (remainingText.trim().length === 0) {
        return res.status(400).json({ error: "Already finished reading" });
      }

      // Clean the text the same way as Play
      remainingText = remainingText
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[^\x20-\x7E]/g, ' ');
      remainingText = remainingText.replace(/\s+/g, ' ').trim();
      
      // Limit length for TTS (about 4 minutes of reading)
      if (remainingText.length > 3000) {
        remainingText = remainingText.substring(0, 3000);
      }
      
      // Add prefix
      remainingText = "Continuing. " + remainingText;

      // Update session
      currentTTSSession.startTime = Date.now();
      currentTTSSession.isPlaying = true;
      
      console.log("Resuming TTS from position", currentTTSSession.currentPosition, "preview:", remainingText.substring(0, 100));
      
      // Use 90% speaking rate
      const ssmlContent = `<speak><prosody rate="90%">${remainingText}</prosody></speak>`;
      
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ssmlContent,
          target: BATHROOM_ECHO_ENTITY,
          data: {
            type: "tts"
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant resume error:", errorText);
        return res.status(response.status).json({ error: "Failed to resume" });
      }

      // Schedule automatic continuation for the rest of the document
      scheduleNextChunk();

      res.json({ success: true, message: "Resumed reading" });
    } catch (error) {
      console.error("Resume error:", error);
      res.status(500).json({ error: "Failed to resume" });
    }
  });

  // POST /api/media/seek - Skip forward or backward on Echo device
  app.post("/api/media/seek", async (req, res) => {
    try {
      const { direction } = req.body; // "forward" or "backward"
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Use Alexa Media Player's skip commands
      const service = direction === "forward" ? "media_next_track" : "media_previous_track";
      
      const response = await fetch(`${haUrl}/api/services/media_player/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: BATHROOM_ECHO_ENTITY,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant seek error:", errorText);
        return res.status(response.status).json({ error: "Failed to seek" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Seek error:", error);
      res.status(500).json({ error: "Failed to seek" });
    }
  });

  // POST /api/media/volume - Set volume on Echo device
  app.post("/api/media/volume", async (req, res) => {
    try {
      const { action, entityId } = req.body; // "up", "down", or a number 0-1
      const targetEntity = entityId || currentTTSSession?.targetEntity || BATHROOM_ECHO_ENTITY;
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      let service = "volume_up";
      let body: any = { entity_id: targetEntity };
      
      if (action === "down") {
        service = "volume_down";
      } else if (action === "up") {
        service = "volume_up";
      } else if (typeof action === "number") {
        service = "volume_set";
        body.volume_level = action;
      }
      
      const response = await fetch(`${haUrl}/api/services/media_player/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant volume error:", errorText);
        return res.status(response.status).json({ error: "Failed to adjust volume" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Volume error:", error);
      res.status(500).json({ error: "Failed to adjust volume" });
    }
  });

  // POST /api/tasks/:id/calendar - Add task to Google Calendar
  app.post("/api/tasks/:id/calendar", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const event = await createCalendarEvent({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        courseName: task.courseName,
      });

      // Update task with calendar event ID
      await storage.updateTask(taskId, {
        calendarEventId: event.id,
        calendarProvider: "google",
      });

      res.json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    } catch (error) {
      console.error("Google Calendar error:", error);
      res.status(500).json({ error: "Failed to add to Google Calendar" });
    }
  });

  // DELETE /api/tasks/:id/calendar - Remove task from Google Calendar
  app.delete("/api/tasks/:id/calendar", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (!task.calendarEventId) {
        return res.status(400).json({ error: "Task is not on calendar" });
      }

      await deleteCalendarEvent(task.calendarEventId);

      // Clear calendar info from task
      await storage.updateTask(taskId, {
        calendarEventId: null,
        calendarProvider: null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Google Calendar delete error:", error);
      res.status(500).json({ error: "Failed to remove from Google Calendar" });
    }
  });

  // GET /api/calendar/events - Fetch events from both Google accounts
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const activeSemester = await storage.getActiveSemesterSettings();
      const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
      const weekNumber = Number(req.query.weekNumber) || getWeekNumber(new Date(), semesterStart);
      const { start, end } = getWeekDates(weekNumber, semesterStart);
      
      // Fetch events from primary account
      let primaryEvents: any[] = [];
      try {
        primaryEvents = await listEvents(start, end);
      } catch (err) {
        console.error("Failed to fetch primary account events:", err);
      }
      
      // Fetch events from second Google account
      let secondAccountEvents: any[] = [];
      try {
        const secondStatus = await isSecondAccountConnected();
        if (secondStatus.connected) {
          secondAccountEvents = await getEventsFromSecondAccount(start, end);
        }
      } catch (err) {
        console.error("Failed to fetch second account events:", err);
      }
      
      // Combine events from both accounts
      const allEvents = [...primaryEvents, ...secondAccountEvents];
      
      // Get all tasks to find which events are already synced from this app
      const tasks = await storage.getTasks({});
      const syncedEventIds = new Set([
        ...tasks.map(t => t.calendarEventId).filter(Boolean),
        ...tasks.map(t => t.secondAccountCalendarEventId).filter(Boolean),
        ...tasks.map(t => t.secondAccountPrepEventId).filter(Boolean),
        ...tasks.map(t => t.prepCalendarEventId).filter(Boolean),
        ...tasks.map(t => t.secondaryCalendarEventId).filter(Boolean),
      ]);
      
      // Filter out events that are already synced from this app
      const externalEvents = allEvents.filter(event => event.id && !syncedEventIds.has(event.id));
      
      // Transform to a simpler format
      const formattedEvents = externalEvents.map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        startDate: event.start?.dateTime || event.start?.date,
        endDate: event.end?.dateTime || event.end?.date,
        isAllDay: !event.start?.dateTime,
        htmlLink: event.htmlLink,
        source: 'google',
      }));
      
      // Now filter to only show events that conflict with tasks in this app
      // Get tasks for this week
      const weekTasks = tasks.filter(t => {
        const taskDue = new Date(t.dueDate);
        return taskDue >= start && taskDue <= end;
      });
      
      // Check for conflicts: all-day events conflict if task is due same day
      // Timed events conflict if they overlap within 1 hour of task due time
      const conflictingEvents = formattedEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        const eventEnd = event.endDate ? new Date(event.endDate) : new Date(eventStart.getTime() + 60 * 60 * 1000);
        
        return weekTasks.some(task => {
          const taskDue = new Date(task.dueDate);
          
          if (event.isAllDay) {
            // All-day event: conflict if task is due on the same date
            const eventDate = eventStart.toDateString();
            const taskDate = taskDue.toDateString();
            return eventDate === taskDate;
          } else {
            // Timed event: conflict if overlapping within 1 hour buffer
            const buffer = 60 * 60 * 1000; // 1 hour
            const taskStartWindow = new Date(taskDue.getTime() - buffer);
            const taskEndWindow = new Date(taskDue.getTime() + buffer);
            
            // Check overlap
            return eventStart < taskEndWindow && eventEnd > taskStartWindow;
          }
        });
      });
      
      res.json(conflictingEvents);
    } catch (error) {
      console.error("Fetch Google Calendar events error:", error);
      res.status(500).json({ error: "Failed to fetch Google Calendar events" });
    }
  });

  // Export all data for sync
  app.get("/api/export", async (_req, res) => {
    try {
      const tasks = await storage.getTasks();
      const files = await storage.getFiles();
      const semester = await storage.getActiveSemesterSettings();
      const deletedFolders = await storage.getDeletedFolders();
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks,
        files,
        semester,
        deletedFolders,
      };
      
      res.json(exportData);
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Import data for sync (with CORS for cross-origin sync)
  app.options("/api/import", (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });
  
  app.post("/api/import", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    try {
      const { tasks, files, semester, deletedFolders } = req.body;
      
      let imported = { tasks: 0, files: 0, semester: false, deletedFolders: 0 };
      
      // Import semester settings
      if (semester) {
        const existing = await storage.getActiveSemesterSettings();
        if (existing) {
          await storage.updateSemesterSettings(existing.id, semester);
        } else {
          await storage.createSemesterSettings(semester);
        }
        imported.semester = true;
      }
      
      // Import tasks (skip if ID already exists)
      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          try {
            const existing = await storage.getTask(task.id);
            if (!existing) {
              const { id, ...taskData } = task;
              await storage.createTask({
                ...taskData,
                dueDate: new Date(task.dueDate),
                startDate: task.startDate ? new Date(task.startDate) : null,
                repeatEndDate: task.repeatEndDate ? new Date(task.repeatEndDate) : null,
              });
              imported.tasks++;
            }
          } catch (err) {
            console.error("Error importing task:", err);
          }
        }
      }
      
      // Import files (skip if objectPath already exists)
      if (files && Array.isArray(files)) {
        for (const file of files) {
          try {
            const existing = await storage.getFileByPath(file.objectPath);
            if (!existing) {
              const { id, createdAt, ...fileData } = file;
              await storage.createFile(fileData);
              imported.files++;
            }
          } catch (err) {
            console.error("Error importing file:", err);
          }
        }
      }
      
      // Import deleted folders
      if (deletedFolders && Array.isArray(deletedFolders)) {
        for (const folder of deletedFolders) {
          try {
            await storage.addDeletedFolder(folder.folderId);
            imported.deletedFolders++;
          } catch (err) {
            // Folder might already be marked as deleted
          }
        }
      }
      
      res.json({ success: true, imported });
    } catch (err) {
      console.error("Import error:", err);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  // Seed database with sample tasks
  await seedDatabase();

  return httpServer;
}

function generateICS(title: string, description: string, dueDate: Date, type: string, reminderMinutes?: number[]): string {
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `task-${Date.now()}@schoolplanner`;
  
  // Use provided reminders or default to 30min and 2hr
  const activeReminders = reminderMinutes?.filter(m => m > 0) || [DEFAULT_REMINDER_1, DEFAULT_REMINDER_2];
  
  // Create reminder lines
  const reminders = activeReminders.map(minutes => 
    `VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nTRIGGER:-PT${minutes}M\r\nEND:VALARM`
  ).join('\r\nBEGIN:');

  const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000); // 1 hour event

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//School Task Planner//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(dueDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title} [${type.toUpperCase()}]
DESCRIPTION:${description.replace(/\n/g, '\\n')}
BEGIN:${reminders}
END:VEVENT
END:VCALENDAR`;
}

async function seedDatabase() {
  const existingTasks = await storage.getTasks();
  if (existingTasks.length === 0) {
    console.log("Seeding database with sample tasks...");
    
    const sampleTasks = [
      {
        title: "Read Chapter 5: Data Structures",
        description: "Complete reading and take notes on arrays and linked lists",
        type: "reading",
        courseName: "CS 201",
        dueDate: new Date("2026-01-19T23:59:00"),
        weekNumber: 3,
        priority: "high",
        repeatType: "none" as const,
      },
      {
        title: "Module 2: Introduction to Algorithms",
        description: "Complete all video lectures and quizzes",
        type: "module",
        courseName: "CS 201",
        dueDate: new Date("2026-01-20T23:59:00"),
        weekNumber: 3,
        priority: "medium",
        repeatType: "none" as const,
      },
      {
        title: "Essay: Impact of AI on Society",
        description: "2000 words minimum, APA format",
        type: "essay",
        courseName: "ENG 101",
        dueDate: new Date("2026-01-24T17:00:00"),
        weekNumber: 3,
        priority: "high",
        repeatType: "none" as const,
      },
      {
        title: "Group Project: Database Design",
        description: "Submit ER diagram and schema documentation",
        type: "project",
        courseName: "CS 301",
        dueDate: new Date("2026-01-31T23:59:00"),
        weekNumber: 4,
        priority: "high",
        repeatType: "none" as const,
      },
      {
        title: "Discussion: Ethics in Technology",
        description: "Post initial response and reply to 2 classmates",
        type: "discussion",
        courseName: "PHIL 200",
        dueDate: new Date("2026-01-22T23:59:00"),
        weekNumber: 3,
        priority: "medium",
        repeatType: "none" as const,
      },
      {
        title: "Weekly Poll: Study Habits",
        description: "Complete the class survey",
        type: "poll",
        courseName: "PSY 101",
        dueDate: new Date("2026-01-17T18:00:00"),
        weekNumber: 2,
        priority: "low",
        repeatType: "none" as const,
      },
      {
        title: "Midterm Exam: Computer Networks",
        description: "Covers chapters 1-6, bring calculator",
        type: "exam",
        courseName: "CS 401",
        dueDate: new Date("2026-02-14T10:00:00"),
        weekNumber: 6,
        priority: "high",
        repeatType: "none" as const,
      },
      {
        title: "Quiz: SQL Basics",
        description: "Online quiz, 30 minutes, open book",
        type: "quiz",
        courseName: "CS 301",
        dueDate: new Date("2026-01-18T14:00:00"),
        weekNumber: 2,
        priority: "medium",
        repeatType: "none" as const,
      },
    ];

    for (const task of sampleTasks) {
      await storage.createTask(task);
    }
    console.log("Seeding complete.");
  }
  
  // Seed file records if they don't exist (for production sync)
  const existingFiles = await storage.getFiles();
  if (existingFiles.length === 0) {
    console.log("Seeding database with file records...");
    
    const fileRecords = [
      {
        originalName: "CPPA122, Module 1 - Welcome.pdf",
        displayName: "CPPA122, Module 1 - Welcome.pdf",
        objectPath: "/objects/uploads/8dbf73fc-9cc2-45d3-bfa9-166b64d9b598",
        contentType: "application/pdf",
        size: 380949,
        folder: "week-1-cppa122-module",
        listened: false,
      },
      {
        originalName: "A Citizen's Guide to Government.pdf",
        displayName: "A Citizen's Guide to Government.pdf",
        objectPath: "/objects/uploads/92c68aff-ae80-438e-8ece-c33dd1647630",
        contentType: "application/pdf",
        size: 617534,
        folder: "week-1-cppa122-reading",
        listened: false,
      },
      {
        originalName: "CPPA122, Module 2 - Introduction.pdf",
        displayName: "CPPA122, Module 2 - Introduction.pdf",
        objectPath: "/objects/uploads/d2596e74-c454-4d29-9b77-e0a14e060957",
        contentType: "application/pdf",
        size: 292550,
        folder: "week-2-cppa122-module",
        listened: false,
      },
      {
        originalName: "156CBA1A.pdf",
        displayName: "156CBA1A.pdf",
        objectPath: "/objects/uploads/b1e539de-a397-454e-8912-e97df6f4feaf",
        contentType: "application/pdf",
        size: 1016087,
        folder: "week-2-cppa122-reading",
        listened: false,
      },
      {
        originalName: "156C823F.pdf",
        displayName: "156C823F.pdf",
        objectPath: "/objects/uploads/35d6e9ef-f8fc-46dc-88b7-0d441307862d",
        contentType: "application/pdf",
        size: 1348962,
        folder: "week-2-cppa122-reading",
        listened: false,
      },
      {
        originalName: "44320906-Supplementary.pdf",
        displayName: "44320906-Supplementary.pdf",
        objectPath: "/objects/uploads/7fbb3260-4e04-4578-8a79-207c29f64fa8",
        contentType: "application/pdf",
        size: 630516,
        folder: "week-3-cppa122-reading",
        listened: false,
      },
      {
        originalName: "AM.OrgCdnLocGovt.Spicer.pdf",
        displayName: "AM.OrgCdnLocGovt.Spicer.pdf",
        objectPath: "/objects/uploads/b12aa8b5-4ca0-4b01-9b07-7b7b919157e1",
        contentType: "application/pdf",
        size: 414847,
        folder: "week-3-cppa122-reading",
        listened: false,
      },
      {
        originalName: "IMFG_Paper_No47_Power_and_Purpose_Taylor_Dobson.pdf",
        displayName: "IMFG_Paper_No47_Power_and_Purpose_Taylor_Dobson.pdf",
        objectPath: "/objects/uploads/eb371306-ee4d-4920-b911-160bd535d8e1",
        contentType: "application/pdf",
        size: 1177012,
        folder: "week-3-cppa122-reading",
        listened: false,
      },
      {
        originalName: "CPPA122, Module 3 - Introduction.pdf",
        displayName: "CPPA122, Module 3 - Introduction.pdf",
        objectPath: "/objects/uploads/fb73649f-402b-4dbe-834e-8b165e2c0535",
        contentType: "application/pdf",
        size: 385275,
        folder: "week-3-cppa122-module",
        listened: false,
      },
    ];

    for (const file of fileRecords) {
      try {
        await storage.createFile(file);
      } catch (err) {
        // Ignore duplicate key errors (file already exists)
        console.log(`File ${file.displayName} already exists or error:`, err);
      }
    }
    console.log("File seeding complete.");
  }
}
