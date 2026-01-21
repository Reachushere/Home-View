import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { getWeekDates, getWeekNumber, FIRST_WEEK, LAST_WEEK, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2 } from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, listEvents, listCalendars, createPrepCalendarEvent, updatePrepCalendarEvent } from "./googleCalendar";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.PDFParse;

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
// Average reading speed: ~150 words per minute, ~750 characters per minute
const CHARS_PER_SECOND = 12.5;
const CHUNK_SIZE = 3000; // Characters per TTS chunk

// Function to send next TTS chunk automatically
async function sendNextChunk() {
  if (!currentTTSSession || !currentTTSSession.isPlaying) return;
  
  // Calculate position based on elapsed time
  const elapsedSeconds = (Date.now() - currentTTSSession.startTime) / 1000;
  const charsRead = Math.floor(elapsedSeconds * CHARS_PER_SECOND);
  currentTTSSession.currentPosition += charsRead;
  
  // Check if we've finished
  if (currentTTSSession.currentPosition >= currentTTSSession.fullText.length) {
    console.log("TTS auto-read complete - finished entire document");
    currentTTSSession.isPlaying = false;
    return;
  }
  
  // Get next chunk
  let nextChunk = currentTTSSession.fullText.substring(
    currentTTSSession.currentPosition,
    currentTTSSession.currentPosition + CHUNK_SIZE
  );
  
  if (nextChunk.trim().length === 0) {
    console.log("TTS auto-read complete - no more content");
    currentTTSSession.isPlaying = false;
    return;
  }
  
  // Update session
  currentTTSSession.startTime = Date.now();
  
  console.log("Auto-continuing TTS from position", currentTTSSession.currentPosition, 
    "remaining:", currentTTSSession.fullText.length - currentTTSSession.currentPosition);
  
  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
  
  try {
    const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: nextChunk,
        target: BATHROOM_ECHO_ENTITY,
        data: { type: "tts" }
      }),
    });
    
    if (!response.ok) {
      console.error("Auto-continue TTS error");
      currentTTSSession.isPlaying = false;
      return;
    }
    
    // Schedule next chunk
    scheduleNextChunk();
  } catch (error) {
    console.error("Auto-continue error:", error);
    currentTTSSession.isPlaying = false;
  }
}

function scheduleNextChunk() {
  if (!currentTTSSession || !currentTTSSession.isPlaying) return;
  
  // Calculate how long this chunk will take to read
  const readTimeMs = (CHUNK_SIZE / CHARS_PER_SECOND) * 1000;
  
  // Add 2 seconds buffer for Alexa processing
  const delayMs = readTimeMs + 2000;
  
  console.log(`Scheduling next chunk in ${Math.round(delayMs / 1000)} seconds`);
  
  // Clear any existing timer
  if (currentTTSSession.autoTimer) {
    clearTimeout(currentTTSSession.autoTimer);
  }
  
  currentTTSSession.autoTimer = setTimeout(sendNextChunk, delayMs);
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
      
      // Auto-sync to Google Calendar
      try {
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
        res.status(201).json(updatedTask);
      } catch (calErr) {
        console.error("Auto-sync to Google Calendar failed:", calErr);
        // Still return the task even if calendar sync fails
        res.status(201).json(task);
      }
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
    // Get task first to check for calendar event
    const task = await storage.getTask(Number(req.params.id));
    
    // Delete from Google Calendar if synced
    if (task?.calendarEventId) {
      try {
        await deleteCalendarEvent(task.calendarEventId);
      } catch (calErr) {
        console.error("Auto-delete from Google Calendar failed:", calErr);
      }
    }
    
    await storage.deleteTask(Number(req.params.id));
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

  // PATCH /api/files/:id - Rename a file
  app.patch("/api/files/:id", async (req, res) => {
    try {
      const { displayName } = req.body;
      if (!displayName) {
        return res.status(400).json({ error: "displayName is required" });
      }
      const file = await storage.updateFileName(Number(req.params.id), displayName);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err) {
      console.error("Error renaming file:", err);
      res.status(500).json({ error: "Failed to rename file" });
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
    const now = new Date();
    const weekNum = getWeekNumber(now);
    const { start, end } = getWeekDates(weekNum);
    res.json({
      weekNumber: weekNum,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  });

  // GET /api/weeks
  app.get(api.weeks.list.path, async (_req, res) => {
    const taskCounts = await storage.getTaskCountByWeek();
    const weeks = [];
    
    for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
      const { start, end } = getWeekDates(w);
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
          const parser = new pdfParse({ data: new Uint8Array(fileBuffer) });
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
      
      // Use notify.alexa_media with announce type (announcements work, TTS/Simon Says doesn't)
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanedContent,
          target: targetEntity,
          data: {
            type: "announce"
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant TTS error:", errorText);
        currentTTSSession = null;
        return res.status(response.status).json({ error: "Failed to read file content" });
      }

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
      
      // Use Alexa Media Player's alexa_media service to send "stop" command
      // This can interrupt TTS announcements
      await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "stop",
          target: targetEntity,
          data: {
            type: "tts"
          }
        }),
      });

      // Also try media_stop for regular media
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
      
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: remainingText,
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

  // GET /api/calendar/events - Fetch events from Google Calendar
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const weekNumber = Number(req.query.weekNumber) || getWeekNumber(new Date());
      const { start, end } = getWeekDates(weekNumber);
      
      const events = await listEvents(start, end);
      
      // Get all tasks to find which events are already synced
      const tasks = await storage.getTasks({});
      const syncedEventIds = new Set(tasks.map(t => t.calendarEventId).filter(Boolean));
      
      // Filter out events that are already synced from this app
      const externalEvents = events.filter(event => event.id && !syncedEventIds.has(event.id));
      
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
      
      res.json(formattedEvents);
    } catch (error) {
      console.error("Fetch Google Calendar events error:", error);
      res.status(500).json({ error: "Failed to fetch Google Calendar events" });
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
      },
      {
        title: "Module 2: Introduction to Algorithms",
        description: "Complete all video lectures and quizzes",
        type: "module",
        courseName: "CS 201",
        dueDate: new Date("2026-01-20T23:59:00"),
        weekNumber: 3,
        priority: "medium",
      },
      {
        title: "Essay: Impact of AI on Society",
        description: "2000 words minimum, APA format",
        type: "essay",
        courseName: "ENG 101",
        dueDate: new Date("2026-01-24T17:00:00"),
        weekNumber: 3,
        priority: "high",
      },
      {
        title: "Group Project: Database Design",
        description: "Submit ER diagram and schema documentation",
        type: "project",
        courseName: "CS 301",
        dueDate: new Date("2026-01-31T23:59:00"),
        weekNumber: 4,
        priority: "high",
      },
      {
        title: "Discussion: Ethics in Technology",
        description: "Post initial response and reply to 2 classmates",
        type: "discussion",
        courseName: "PHIL 200",
        dueDate: new Date("2026-01-22T23:59:00"),
        weekNumber: 3,
        priority: "medium",
      },
      {
        title: "Weekly Poll: Study Habits",
        description: "Complete the class survey",
        type: "poll",
        courseName: "PSY 101",
        dueDate: new Date("2026-01-17T18:00:00"),
        weekNumber: 2,
        priority: "low",
      },
      {
        title: "Midterm Exam: Computer Networks",
        description: "Covers chapters 1-6, bring calculator",
        type: "exam",
        courseName: "CS 401",
        dueDate: new Date("2026-02-14T10:00:00"),
        weekNumber: 6,
        priority: "high",
      },
      {
        title: "Quiz: SQL Basics",
        description: "Online quiz, 30 minutes, open book",
        type: "quiz",
        courseName: "CS 301",
        dueDate: new Date("2026-01-18T14:00:00"),
        weekNumber: 2,
        priority: "medium",
      },
    ];

    for (const task of sampleTasks) {
      await storage.createTask(task);
    }
    console.log("Seeding complete.");
  }
}
