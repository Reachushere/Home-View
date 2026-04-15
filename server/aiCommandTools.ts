import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { notepadNotes, getWeekNumber, COURSES } from "@shared/schema";
import { easternNow } from "./timezone";
import * as spotifyApi from "./spotify";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { execSync } from "child_process";

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || "";

const pendingConfirmations = new Map<string, { name: string; arguments: any; createdAt: number }>();
const CONFIRM_TTL_MS = 5 * 60 * 1000;

export function createPendingConfirmation(name: string, args: any): string {
  const token = crypto.randomBytes(16).toString('hex');
  pendingConfirmations.set(token, { name, arguments: args, createdAt: Date.now() });
  for (const [k, v] of pendingConfirmations) {
    if (Date.now() - v.createdAt > CONFIRM_TTL_MS) pendingConfirmations.delete(k);
  }
  return token;
}

export function consumePendingConfirmation(token: string): { name: string; arguments: any } | null {
  const entry = pendingConfirmations.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CONFIRM_TTL_MS) {
    pendingConfirmations.delete(token);
    return null;
  }
  pendingConfirmations.delete(token);
  return { name: entry.name, arguments: entry.arguments };
}

export const AI_COMMAND_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a new task/assignment/event in UniCal. The user might say 'add a quiz for CPPA122 next Friday' or 'create a reading for CFNF400 week 5'.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          type: { type: "string", enum: ["class","reading","module","essay","project","discussion","poll","exam","quiz","reminder","meeting","scholarship","medical","school","household","financial","personal","outside","phone_call","other"], description: "Task type" },
          courseName: { type: "string", description: "Course code like CPPA122, CFNF400, CASL101. Leave empty for non-course tasks." },
          dueDate: { type: "string", description: "ISO date string for due date (YYYY-MM-DDTHH:mm:ss). Use Eastern Time." },
          eventStartTime: { type: "string", description: "Start time in HH:mm format (24h). Optional." },
          eventEndTime: { type: "string", description: "End time in HH:mm format (24h). Optional." },
          description: { type: "string", description: "Task description/notes. Optional." },
          priority: { type: "string", enum: ["low","medium","high"], description: "Priority level. Default medium." },
          weekNumber: { type: "integer", description: "Week number in semester (1-15). Will be auto-calculated from dueDate if not provided." },
        },
        required: ["title", "type", "dueDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description: "Update an existing task. Use search_tasks first to find the task ID. Can change title, due date, type, priority, description, completion status, etc.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "integer", description: "The task ID to update" },
          title: { type: "string" },
          type: { type: "string", enum: ["class","reading","module","essay","project","discussion","poll","exam","quiz","reminder","meeting","scholarship","medical","school","household","financial","personal","outside","phone_call","other"] },
          courseName: { type: "string" },
          dueDate: { type: "string", description: "ISO date string" },
          eventStartTime: { type: "string", description: "HH:mm format" },
          eventEndTime: { type: "string", description: "HH:mm format" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low","medium","high"] },
          isCompleted: { type: "boolean", description: "Mark task as completed (true) or incomplete (false)" },
          gradeWeight: { type: "number", description: "Grade weight percentage" },
          gradeValue: { type: "number", description: "Score achieved" },
          gradeTotal: { type: "number", description: "Total possible points" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_task",
      description: "Delete a task by ID. DESTRUCTIVE — confirm with user first.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "integer", description: "The task ID to delete" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_tasks",
      description: "Search for tasks by title, course, type, or week number. Use this to find task IDs before updating or deleting. Returns up to 20 results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query to match against task titles" },
          courseName: { type: "string", description: "Filter by course code (e.g. CPPA122)" },
          type: { type: "string", description: "Filter by task type" },
          weekNumber: { type: "integer", description: "Filter by week number" },
          showCompleted: { type: "boolean", description: "Include completed tasks. Default false." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "Mark a task as completed or uncompleted.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "integer", description: "The task ID" },
          completed: { type: "boolean", description: "true to complete, false to uncomplete" },
        },
        required: ["taskId", "completed"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_upcoming_tasks",
      description: "Get upcoming tasks (not completed) for the current or specified week. Good for questions like 'what do I have this week' or 'what's due soon'.",
      parameters: {
        type: "object",
        properties: {
          weekNumber: { type: "integer", description: "Week number. Defaults to current week." },
          limit: { type: "integer", description: "Max results. Default 15." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_notepad_note",
      description: "Create a new notepad note.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Note title" },
          content: { type: "string", description: "Note content (markdown supported)" },
          color: { type: "string", description: "Note color. Optional." },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_service_call",
      description: "Call a Home Assistant service. Use for controlling lights, switches, media players, etc. Examples: 'turn on the cat lights', 'turn off bathroom light'.",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string", description: "HA domain: light, switch, media_player, input_boolean, climate, fan, etc." },
          service: { type: "string", description: "Service to call: turn_on, turn_off, toggle, set_temperature, etc." },
          entity_id: { type: "string", description: "Entity ID, e.g. light.cat_lights, switch.bathroom_fan" },
          extra_data: { type: "object", description: "Additional service data like brightness, color_temp, temperature, etc." },
        },
        required: ["domain", "service", "entity_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_announce",
      description: "Make an announcement on Alexa/Echo speakers or HA media players. Examples: 'announce dinner is ready', 'tell the house it's time for class'.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The announcement message to speak" },
          target: { type: "string", enum: ["everywhere","kitchen","bathroom","cat_room","living_room","king_bedroom","queen_bedroom"], description: "Where to announce. Default 'everywhere'." },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_semester_info",
      description: "Get current semester information including courses, dates, and settings. Use when user asks about their courses, semester dates, etc.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_course_list",
      description: "List all available courses in the system.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "spotify_control",
      description: "Control Spotify playback. Play, pause, next, previous, or search and play music.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["play","pause","next","previous","search_and_play"], description: "Playback action" },
          query: { type: "string", description: "Search query for search_and_play action" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_semester_settings",
      description: "Update semester settings like course details, professor info, class days/times, zoom links, colors, display names, etc. Use get_semester_info first to see current values.",
      parameters: {
        type: "object",
        properties: {
          courseNumber: { type: "integer", enum: [1, 2, 3], description: "Which course slot to update (1, 2, or 3)" },
          professor: { type: "string", description: "Professor name" },
          professorEmail: { type: "string", description: "Professor email" },
          classDay: { type: "string", description: "Primary class day (e.g. monday, tuesday)" },
          classTime: { type: "string", description: "Class start time in HH:mm format" },
          classEndTime: { type: "string", description: "Class end time in HH:mm format" },
          zoomLink: { type: "string", description: "Zoom/meeting link" },
          displayName: { type: "string", description: "Custom display name for the course" },
          color: { type: "string", description: "Course color (hex code)" },
          semesterName: { type: "string", description: "Change the semester display name" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_app_theme",
      description: "Change the app's visual theme/colors. Updates stored in app state and takes effect on next page load. Examples: 'make the app darker', 'change header to navy blue', 'set background to purple'.",
      parameters: {
        type: "object",
        properties: {
          headerBar: { type: "string", description: "Header bar color (hex code, e.g. #051729)" },
          mainBackground: { type: "string", description: "Main background color (hex code, e.g. #3a8bbf)" },
          mainBackgroundGradientEnd: { type: "string", description: "Background gradient end color (hex code)" },
          boxBackground: { type: "string", description: "Content box background color (hex code, e.g. #ffffff)" },
          todayCellBackground: { type: "string", description: "Today cell highlight color (hex code)" },
          boxTransparency: { type: "integer", description: "Box transparency level 0-100 (higher = more transparent)" },
          boxGlassEffect: { type: "boolean", description: "Enable/disable glass/frosted effect on boxes" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_ui_setting",
      description: "Change a UI setting stored in app state. Used for various app preferences and configuration values.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Setting key name" },
          value: { type: "string", description: "Setting value (will be stored as string)" },
        },
        required: ["key", "value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bulk_complete_tasks",
      description: "Mark multiple tasks as completed at once. DESTRUCTIVE — confirm with user first. Use search_tasks to find the task IDs.",
      parameters: {
        type: "object",
        properties: {
          taskIds: { type: "array", items: { type: "integer" }, description: "Array of task IDs to mark as completed" },
        },
        required: ["taskIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bulk_delete_tasks",
      description: "Delete multiple tasks at once. VERY DESTRUCTIVE — always confirm with user first.",
      parameters: {
        type: "object",
        properties: {
          taskIds: { type: "array", items: { type: "integer" }, description: "Array of task IDs to delete" },
        },
        required: ["taskIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "manage_sticky_note",
      description: "Create, update, or delete a sticky note on the dashboard.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete"], description: "Action to perform" },
          id: { type: "integer", description: "Sticky note ID (required for update/delete)" },
          title: { type: "string", description: "Note title" },
          content: { type: "string", description: "Note content" },
          color: { type: "string", description: "Note color (yellow, blue, green, pink, purple, orange)" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description: "Send an email from the app's Gmail account (homeworkbryn@gmail.com) to Bryn's Outlook (bryn.kai-hendricks@outlook.com). Good for sending yourself reminders or notes.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body text" },
        },
        required: ["subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "notepad_crud",
      description: "Full notepad note management — list, get, create, update, or delete notepad notes. Notepad is for longer-form notes with rich text content.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "create", "update", "delete"], description: "Action to perform" },
          id: { type: "integer", description: "Note ID (required for get/update/delete)" },
          title: { type: "string", description: "Note title (for create/update)" },
          content: { type: "string", description: "Note content/body text (for create/update)" },
          color: { type: "string", description: "Note color (for create/update)" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sync_task_to_calendar",
      description: "Sync a task to Google Calendar. Creates a calendar event for the task and stores the event ID.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "integer", description: "The task ID to sync to Google Calendar" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read a file from the project. Returns the file contents. Use this to understand existing code before making changes. Can read partial files with offset/limit for large files.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path to the file (e.g. 'client/src/pages/dashboard.tsx', 'server/routes.ts')" },
          offset: { type: "integer", description: "Line number to start reading from (1-indexed). Use for large files." },
          limit: { type: "integer", description: "Max number of lines to read. Default 500. Use for large files." },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Write or create a file in the project. DESTRUCTIVE — always confirm with user first. Use read_file first to understand what exists, then use edit_file for targeted changes. Only use write_file for new files or complete rewrites.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path for the file" },
          content: { type: "string", description: "Complete file content to write" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description: "Make a targeted edit to a file by replacing an exact string match. DESTRUCTIVE — always confirm with user first. Use read_file first to find the exact text to replace. The oldText must match exactly (including whitespace).",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path to the file to edit" },
          oldText: { type: "string", description: "Exact text to find and replace (must be unique in the file)" },
          newText: { type: "string", description: "Replacement text" },
        },
        required: ["filePath", "oldText", "newText"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_directory",
      description: "List files and directories at a given path. Returns names, types (file/directory), and sizes.",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "Relative path to list (e.g. 'client/src/pages', 'server'). Default is project root." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_code",
      description: "Search for a pattern across project files using grep. Returns matching file paths and line content. Use this to find where things are defined or used.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Search pattern (regex supported)" },
          fileGlob: { type: "string", description: "File glob to filter (e.g. '*.tsx', '*.ts', 'server/**/*.ts'). Default searches all code files." },
          maxResults: { type: "integer", description: "Max results to return. Default 20." },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_shell_command",
      description: "Execute a shell command in the project directory. DESTRUCTIVE — always confirm with user first. Use for: npm install, git operations, build commands, etc. Has a 30-second timeout. Dangerous commands are blocked.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory relative to project root. Default is project root." },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "staging_manage",
      description: "Manage the staging environment. Staging lets you preview code changes on port 5001 before deploying to production (port 5000). Actions: 'setup' creates staging worktree + branch, 'start' launches staging server, 'stop' stops staging server, 'status' checks if staging is running, 'apply' merges staging changes into main and restarts production, 'discard' removes staging changes.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["setup", "start", "stop", "status", "apply", "discard"], description: "Staging action to perform" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restart_application",
      description: "Restart the running application. Use after making code changes to apply them. On the Pi this uses PM2, in development it restarts the dev server.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

export async function executeToolCall(name: string, args: Record<string, any>): Promise<{ success: boolean; result: any; needsConfirmation?: boolean; confirmationMessage?: string }> {
  try {
    switch (name) {
      case "create_task": {
        const dueDate = new Date(args.dueDate);
        const weekNumber = args.weekNumber || getWeekNumber(dueDate);
        const task = await storage.createTask({
          title: args.title,
          type: args.type,
          courseName: args.courseName || null,
          dueDate,
          eventStartTime: args.eventStartTime || null,
          eventEndTime: args.eventEndTime || null,
          description: args.description || null,
          priority: args.priority || "medium",
          weekNumber,
          isCompleted: false,
        });
        return { success: true, result: { id: task.id, title: task.title, type: task.type, courseName: task.courseName, dueDate: task.dueDate, weekNumber: task.weekNumber } };
      }

      case "update_task": {
        const { taskId, ...updates } = args;
        const existing = await storage.getTask(taskId);
        if (!existing) return { success: false, result: { error: `Task #${taskId} not found` } };
        const updateData: any = {};
        if (updates.title) updateData.title = updates.title;
        if (updates.type) updateData.type = updates.type;
        if (updates.courseName !== undefined) updateData.courseName = updates.courseName;
        if (updates.dueDate) {
          updateData.dueDate = new Date(updates.dueDate);
          updateData.weekNumber = getWeekNumber(updateData.dueDate);
        }
        if (updates.eventStartTime !== undefined) updateData.eventStartTime = updates.eventStartTime;
        if (updates.eventEndTime !== undefined) updateData.eventEndTime = updates.eventEndTime;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.priority) updateData.priority = updates.priority;
        if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted;
        if (updates.gradeWeight !== undefined) updateData.gradeWeight = updates.gradeWeight;
        if (updates.gradeValue !== undefined) updateData.gradeValue = updates.gradeValue;
        if (updates.gradeTotal !== undefined) updateData.gradeTotal = updates.gradeTotal;
        const updated = await storage.updateTask(taskId, updateData);
        return { success: true, result: { id: updated.id, title: updated.title, type: updated.type, dueDate: updated.dueDate, courseName: updated.courseName } };
      }

      case "delete_task": {
        const existing = await storage.getTask(args.taskId);
        if (!existing) return { success: false, result: { error: `Task #${args.taskId} not found` } };
        await storage.deleteTask(args.taskId);
        return { success: true, result: { deleted: true, taskId: args.taskId, title: existing.title } };
      }

      case "search_tasks": {
        let allTasks = await storage.getTasks({ showCompleted: args.showCompleted !== false ? true : false });
        if (args.courseName) {
          allTasks = allTasks.filter(t => t.courseName?.toLowerCase().includes(args.courseName.toLowerCase()));
        }
        if (args.type) {
          allTasks = allTasks.filter(t => t.type === args.type);
        }
        if (args.weekNumber) {
          allTasks = allTasks.filter(t => t.weekNumber === args.weekNumber);
        }
        if (args.query) {
          const q = args.query.toLowerCase();
          allTasks = allTasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
        }
        if (!args.showCompleted) {
          allTasks = allTasks.filter(t => !t.isCompleted);
        }
        const results = allTasks.slice(0, 20).map(t => ({
          id: t.id, title: t.title, type: t.type, courseName: t.courseName,
          dueDate: t.dueDate, weekNumber: t.weekNumber, isCompleted: t.isCompleted,
          priority: t.priority,
        }));
        return { success: true, result: { count: results.length, tasks: results } };
      }

      case "complete_task": {
        const existing = await storage.getTask(args.taskId);
        if (!existing) return { success: false, result: { error: `Task #${args.taskId} not found` } };
        const updated = await storage.updateTask(args.taskId, { isCompleted: args.completed });
        return { success: true, result: { id: updated.id, title: updated.title, isCompleted: updated.isCompleted } };
      }

      case "get_upcoming_tasks": {
        const now = easternNow();
        const weekNum = args.weekNumber || getWeekNumber(now);
        const limit = args.limit || 15;
        let allTasks = await storage.getTasks({ weekNumber: weekNum, showCompleted: false });
        allTasks = allTasks.filter(t => !t.isCompleted);
        allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const results = allTasks.slice(0, limit).map(t => ({
          id: t.id, title: t.title, type: t.type, courseName: t.courseName,
          dueDate: t.dueDate, weekNumber: t.weekNumber, priority: t.priority,
          eventStartTime: t.eventStartTime, eventEndTime: t.eventEndTime,
        }));
        return { success: true, result: { currentWeek: weekNum, count: results.length, tasks: results } };
      }

      case "create_notepad_note": {
        const [note] = await db.insert(notepadNotes).values({
          title: args.title,
          content: args.content,
          color: args.color || null,
        }).returning();
        return { success: true, result: { id: note.id, title: note.title } };
      }

      case "ha_service_call": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const serviceData: any = { entity_id: args.entity_id };
        if (args.extra_data) Object.assign(serviceData, args.extra_data);
        const resp = await fetch(`${haUrl}/api/services/${args.domain}/${args.service}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceData),
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          return { success: false, result: { error: `HA service call failed: ${resp.status} ${errText.substring(0, 200)}` } };
        }
        return { success: true, result: { service: `${args.domain}/${args.service}`, entity_id: args.entity_id } };
      }

      case "ha_announce": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const targetMap: Record<string, string[]> = {
          everywhere: ["media_player.byhome"],
          kitchen: ["media_player.echo_kitchen_studio_black_am"],
          bathroom: ["media_player.bathroom_speaker"],
          cat_room: ["media_player.echo_cat_left_am", "media_player.echo_cat_right_am"],
          living_room: ["media_player.living_room_media_group"],
          king_bedroom: ["media_player.king_bedroom_media_group"],
          queen_bedroom: ["media_player.queen_bedroom_media_group"],
        };
        const targets = targetMap[args.target || "everywhere"] || targetMap.everywhere;
        const errors: string[] = [];
        for (const target of targets) {
          const announceResp = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: args.message, target, data: { type: "announce" } }),
          });
          if (!announceResp.ok) {
            const errText = await announceResp.text().catch(() => '');
            errors.push(`${target}: ${announceResp.status} ${errText.substring(0, 100)}`);
          }
        }
        if (errors.length === targets.length) {
          return { success: false, result: { error: `All announcements failed: ${errors.join('; ')}` } };
        }
        return { success: true, result: { announced: true, message: args.message, target: args.target || "everywhere", ...(errors.length > 0 ? { partialErrors: errors } : {}) } };
      }

      case "get_semester_info": {
        const settings = await storage.getActiveSemesterSettings();
        if (!settings) return { success: true, result: { error: "No active semester" } };
        const courses = [];
        for (let i = 1; i <= 3; i++) {
          const code = (settings as any)[`course${i}Code`];
          const name = (settings as any)[`course${i}Name`];
          if (code) courses.push({ code, name, professor: (settings as any)[`course${i}Professor`], day: (settings as any)[`course${i}ClassDay`], time: (settings as any)[`course${i}ClassTime`] });
        }
        return {
          success: true,
          result: {
            semesterName: settings.semesterName,
            startDate: settings.semesterStartDate,
            endDate: settings.semesterEndDate,
            currentWeek: getWeekNumber(easternNow()),
            courses,
          },
        };
      }

      case "get_course_list": {
        return { success: true, result: { courses: COURSES.map(c => ({ code: c.code, name: c.name })) } };
      }

      case "spotify_control": {
        try {
          switch (args.action) {
            case "play": {
              await spotifyApi.play();
              return { success: true, result: { action: "play" } };
            }
            case "pause": {
              await spotifyApi.pause();
              return { success: true, result: { action: "pause" } };
            }
            case "next": {
              await spotifyApi.next();
              return { success: true, result: { action: "next" } };
            }
            case "previous": {
              await spotifyApi.previous();
              return { success: true, result: { action: "previous" } };
            }
            case "search_and_play": {
              if (!args.query) return { success: false, result: { error: "Search query required" } };
              const results = await spotifyApi.search(args.query, 'track', 5);
              const tracks = results?.tracks?.items;
              if (!tracks || tracks.length === 0) return { success: false, result: { error: `No results found for "${args.query}"` } };
              const trackUris = tracks.map((t: any) => t.uri);
              await spotifyApi.playTracks(trackUris);
              return { success: true, result: { action: "search_and_play", query: args.query, playing: tracks[0]?.name, artist: tracks[0]?.artists?.[0]?.name } };
            }
            default:
              return { success: false, result: { error: `Unknown spotify action: ${args.action}` } };
          }
        } catch (spotErr: any) {
          return { success: false, result: { error: `Spotify error: ${spotErr.message || 'Unknown error'}` } };
        }
      }

      case "update_semester_settings": {
        const settings = await storage.getActiveSemesterSettings();
        if (!settings) return { success: false, result: { error: "No active semester found" } };
        const updates: any = {};
        if (args.semesterName) updates.semesterName = args.semesterName;
        if (args.courseNumber) {
          const n = args.courseNumber;
          if (args.professor) updates[`course${n}Professor`] = args.professor;
          if (args.professorEmail) updates[`course${n}ProfessorEmail`] = args.professorEmail;
          if (args.classDay) updates[`course${n}ClassDay`] = args.classDay;
          if (args.classTime) updates[`course${n}ClassTime`] = args.classTime;
          if (args.classEndTime) updates[`course${n}ClassEndTime`] = args.classEndTime;
          if (args.zoomLink) updates[`course${n}ZoomLink`] = args.zoomLink;
          if (args.displayName) updates[`course${n}DisplayName`] = args.displayName;
          if (args.color) updates[`course${n}Color`] = args.color;
        }
        if (Object.keys(updates).length === 0) return { success: false, result: { error: "No updates specified" } };
        const updated = await storage.updateSemesterSettings(settings.id, updates);
        return { success: true, result: { updated: Object.keys(updates), semesterName: updated.semesterName } };
      }

      case "update_app_theme": {
        const { appState: appStateTable } = await import("@shared/schema");
        const themeUpdates: any = {};
        const fields = ['headerBar', 'mainBackground', 'mainBackgroundGradientEnd', 'boxBackground', 'todayCellBackground', 'boxTransparency', 'boxGlassEffect'];
        for (const f of fields) {
          if (args[f] !== undefined) themeUpdates[f] = args[f];
        }
        if (Object.keys(themeUpdates).length === 0) return { success: false, result: { error: "No theme updates specified" } };
        const key = 'ui_colorSettings';
        const existingRows = await db.select().from(appStateTable).where(eq(appStateTable.key, key)).limit(1);
        let current: any = {};
        if (existingRows.length > 0 && existingRows[0].value) {
          try { current = JSON.parse(existingRows[0].value); } catch {}
        }
        const merged = { ...current, ...themeUpdates };
        const value = JSON.stringify(merged);
        if (existingRows.length > 0) {
          await db.update(appStateTable).set({ value, updatedAt: new Date() }).where(eq(appStateTable.key, key));
        } else {
          await db.insert(appStateTable).values({ key, value });
        }
        return { success: true, result: { updated: Object.keys(themeUpdates), note: "Theme changes will apply on next page load or refresh" } };
      }

      case "update_ui_setting": {
        const { appState: appStateTable } = await import("@shared/schema");
        const key = `ui_${args.key}`;
        const existingRows = await db.select().from(appStateTable).where(eq(appStateTable.key, key)).limit(1);
        if (existingRows.length > 0) {
          await db.update(appStateTable).set({ value: String(args.value), updatedAt: new Date() }).where(eq(appStateTable.key, key));
        } else {
          await db.insert(appStateTable).values({ key, value: String(args.value) });
        }
        return { success: true, result: { key: args.key, value: args.value } };
      }

      case "bulk_complete_tasks": {
        if (!Array.isArray(args.taskIds) || args.taskIds.length === 0) {
          return { success: false, result: { error: "No task IDs provided" } };
        }
        const completed: number[] = [];
        const failed: number[] = [];
        for (const id of args.taskIds) {
          try {
            await storage.updateTask(id, { isCompleted: true });
            completed.push(id);
          } catch {
            failed.push(id);
          }
        }
        return { success: true, result: { completed: completed.length, failed: failed.length, completedIds: completed } };
      }

      case "bulk_delete_tasks": {
        if (!Array.isArray(args.taskIds) || args.taskIds.length === 0) {
          return { success: false, result: { error: "No task IDs provided" } };
        }
        const deleted: number[] = [];
        const failedDel: number[] = [];
        for (const id of args.taskIds) {
          try {
            await storage.deleteTask(id);
            deleted.push(id);
          } catch {
            failedDel.push(id);
          }
        }
        return { success: true, result: { deleted: deleted.length, failed: failedDel.length, deletedIds: deleted } };
      }

      case "manage_sticky_note": {
        switch (args.action) {
          case "create": {
            const note = await storage.createStickyNote({
              title: args.title || "Note",
              content: args.content || "",
              color: args.color || "yellow",
            });
            return { success: true, result: { id: note.id, title: note.title, action: "created" } };
          }
          case "update": {
            if (!args.id) return { success: false, result: { error: "Sticky note ID required for update" } };
            const updates: any = {};
            if (args.title) updates.title = args.title;
            if (args.content) updates.content = args.content;
            if (args.color) updates.color = args.color;
            const updated = await storage.updateStickyNote(args.id, updates);
            return { success: true, result: { id: updated.id, title: updated.title, action: "updated" } };
          }
          case "delete": {
            if (!args.id) return { success: false, result: { error: "Sticky note ID required for delete" } };
            await storage.deleteStickyNote(args.id);
            return { success: true, result: { id: args.id, action: "deleted" } };
          }
          default:
            return { success: false, result: { error: `Unknown sticky note action: ${args.action}` } };
        }
      }

      case "notepad_crud": {
        switch (args.action) {
          case "list": {
            const notes = await db.select().from(notepadNotes).orderBy(notepadNotes.sortOrder);
            return { success: true, result: notes.map(n => ({ id: n.id, title: n.title, color: n.color, updatedAt: n.updatedAt })) };
          }
          case "get": {
            if (!args.id) return { success: false, result: { error: "Note ID required" } };
            const [note] = await db.select().from(notepadNotes).where(eq(notepadNotes.id, args.id));
            if (!note) return { success: false, result: { error: "Note not found" } };
            return { success: true, result: note };
          }
          case "create": {
            const [note] = await db.insert(notepadNotes).values({
              title: args.title || "Untitled",
              content: args.content || "",
              color: args.color || null,
            }).returning();
            return { success: true, result: { id: note.id, title: note.title, action: "created" } };
          }
          case "update": {
            if (!args.id) return { success: false, result: { error: "Note ID required for update" } };
            const updates: any = {};
            if (args.title) updates.title = args.title;
            if (args.content !== undefined) updates.content = args.content;
            if (args.color) updates.color = args.color;
            updates.updatedAt = new Date();
            const [updated] = await db.update(notepadNotes).set(updates).where(eq(notepadNotes.id, args.id)).returning();
            if (!updated) return { success: false, result: { error: "Note not found" } };
            return { success: true, result: { id: updated.id, title: updated.title, action: "updated" } };
          }
          case "delete": {
            if (!args.id) return { success: false, result: { error: "Note ID required for delete" } };
            await db.delete(notepadNotes).where(eq(notepadNotes.id, args.id));
            return { success: true, result: { id: args.id, action: "deleted" } };
          }
          default:
            return { success: false, result: { error: `Unknown notepad action: ${args.action}` } };
        }
      }

      case "sync_task_to_calendar": {
        const task = await storage.getTask(args.taskId);
        if (!task) return { success: false, result: { error: `Task #${args.taskId} not found` } };
        const { createCalendarEvent } = await import("./googleCalendar");
        const event = await createCalendarEvent({
          title: task.title,
          dueDate: new Date(task.dueDate),
          startTime: task.eventStartTime || undefined,
          endTime: task.eventEndTime || undefined,
          description: task.description || undefined,
          courseName: task.courseName || undefined,
        });
        if (event?.id) {
          await storage.updateTask(args.taskId, { calendarEventId: event.id });
          return { success: true, result: { taskId: args.taskId, calendarEventId: event.id, synced: true } };
        }
        return { success: false, result: { error: "Calendar event creation returned no ID" } };
      }

      case "send_email": {
        const { sendGmail } = await import("./gmail");
        const result = await sendGmail(
          "bryn.kai-hendricks@outlook.com",
          args.subject,
          args.body
        );
        if (result.success) {
          return { success: true, result: { sent: true, to: "bryn.kai-hendricks@outlook.com", subject: args.subject } };
        }
        return { success: false, result: { error: result.error || "Email failed" } };
      }

      case "read_file": {
        const safePath = resolveProjectPath(args.filePath);
        if (!safePath) return { success: false, result: { error: "Invalid file path — must be within the project directory" } };
        try {
          const content = await fs.readFile(safePath, 'utf-8');
          const lines = content.split('\n');
          const offset = (args.offset || 1) - 1;
          const limit = args.limit || 500;
          const slice = lines.slice(offset, offset + limit);
          const totalLines = lines.length;
          const numbered = slice.map((line, i) => `${offset + i + 1}: ${line}`).join('\n');
          return { success: true, result: { content: numbered, totalLines, showing: `${offset + 1}-${Math.min(offset + limit, totalLines)}` } };
        } catch (e: any) {
          if (e.code === 'ENOENT') return { success: false, result: { error: `File not found: ${args.filePath}` } };
          return { success: false, result: { error: e.message } };
        }
      }

      case "write_file": {
        const safePath = resolveProjectPath(args.filePath);
        if (!safePath) return { success: false, result: { error: "Invalid file path — must be within the project directory" } };
        if (isProtectedFile(args.filePath)) return { success: false, result: { error: `Protected file — cannot modify: ${args.filePath}` } };
        const dir = path.dirname(safePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(safePath, args.content, 'utf-8');
        return { success: true, result: { written: args.filePath, bytes: Buffer.byteLength(args.content) } };
      }

      case "edit_file": {
        const safePath = resolveProjectPath(args.filePath);
        if (!safePath) return { success: false, result: { error: "Invalid file path — must be within the project directory" } };
        if (isProtectedFile(args.filePath)) return { success: false, result: { error: `Protected file — cannot modify: ${args.filePath}` } };
        try {
          const content = await fs.readFile(safePath, 'utf-8');
          const occurrences = content.split(args.oldText).length - 1;
          if (occurrences === 0) return { success: false, result: { error: "oldText not found in file. Read the file first to get exact text." } };
          if (occurrences > 1) return { success: false, result: { error: `oldText found ${occurrences} times — must be unique. Add more context to make it unique.` } };
          const newContent = content.replace(args.oldText, args.newText);
          await fs.writeFile(safePath, newContent, 'utf-8');
          return { success: true, result: { edited: args.filePath, replacements: 1 } };
        } catch (e: any) {
          if (e.code === 'ENOENT') return { success: false, result: { error: `File not found: ${args.filePath}` } };
          return { success: false, result: { error: e.message } };
        }
      }

      case "list_directory": {
        const safePath = resolveProjectPath(args.dirPath || '.');
        if (!safePath) return { success: false, result: { error: "Invalid directory path" } };
        try {
          const entries = await fs.readdir(safePath, { withFileTypes: true });
          const filtered = entries.filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist');
          const items = await Promise.all(filtered.map(async (e) => {
            const fullPath = path.join(safePath, e.name);
            let size = 0;
            if (e.isFile()) {
              try { const stat = await fs.stat(fullPath); size = stat.size; } catch {}
            }
            return { name: e.name, type: e.isDirectory() ? 'directory' : 'file', size: e.isFile() ? size : undefined };
          }));
          return { success: true, result: { path: args.dirPath || '.', items } };
        } catch (e: any) {
          return { success: false, result: { error: e.message } };
        }
      }

      case "search_code": {
        const projectRoot = getProjectRoot();
        const maxResults = args.maxResults || 20;
        const globArg = args.fileGlob ? `--include='${args.fileGlob}'` : "--include='*.ts' --include='*.tsx' --include='*.css' --include='*.json' --include='*.html'";
        try {
          const cmd = `grep -rn ${globArg} --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -m ${maxResults} ${JSON.stringify(args.pattern)} .`;
          const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }).trim();
          const matches = output.split('\n').slice(0, maxResults).map(line => {
            const match = line.match(/^\.\/(.+?):(\d+):(.*)$/);
            if (match) return { file: match[1], line: parseInt(match[2]), content: match[3].substring(0, 200) };
            return { raw: line.substring(0, 200) };
          });
          return { success: true, result: { matches, count: matches.length } };
        } catch (e: any) {
          if (e.status === 1) return { success: true, result: { matches: [], count: 0, message: "No matches found" } };
          return { success: false, result: { error: e.message?.substring(0, 200) || "Search failed" } };
        }
      }

      case "run_shell_command": {
        const projectRoot = getProjectRoot();
        const cmd = args.command;
        if (isDangerousCommand(cmd)) return { success: false, result: { error: "Command blocked for safety. Dangerous commands like rm -rf, format, shutdown, etc. are not allowed." } };
        const cwd = args.cwd ? resolveProjectPath(args.cwd) || projectRoot : projectRoot;
        try {
          const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } });
          return { success: true, result: { output: output.substring(0, 5000), exitCode: 0 } };
        } catch (e: any) {
          return { success: false, result: { output: (e.stdout || '').substring(0, 3000), stderr: (e.stderr || '').substring(0, 2000), exitCode: e.status } };
        }
      }

      case "staging_manage": {
        const projectRoot = getProjectRoot();
        const stagingDir = path.join(path.dirname(projectRoot), 'Home-View-staging');
        switch (args.action) {
          case "setup": {
            try {
              execSync('git stash --include-untracked 2>/dev/null || true', { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
              try { execSync(`git branch -D staging 2>/dev/null`, { cwd: projectRoot, timeout: 5000 }); } catch {}
              try { execSync(`git worktree remove "${stagingDir}" --force 2>/dev/null`, { cwd: projectRoot, timeout: 5000 }); } catch {}
              execSync(`git branch staging HEAD`, { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 });
              execSync(`git worktree add "${stagingDir}" staging`, { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
              execSync('npm install --ignore-scripts 2>/dev/null || true', { cwd: stagingDir, encoding: 'utf-8', timeout: 60000 });
              execSync('git stash pop 2>/dev/null || true', { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
              return { success: true, result: { action: "setup", stagingDir, message: "Staging environment created. Make file changes, then use staging_manage start to preview on port 5001." } };
            } catch (e: any) {
              execSync('git stash pop 2>/dev/null || true', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 });
              return { success: false, result: { error: e.message?.substring(0, 500) } };
            }
          }
          case "start": {
            try {
              try { execSync('fuser -k 5001/tcp 2>/dev/null', { timeout: 5000 }); } catch {}
              execSync(`cd "${stagingDir}" && PORT=5001 NODE_ENV=development nohup npx tsx server/index.ts > /tmp/staging-server.log 2>&1 &`, { timeout: 5000, shell: '/bin/bash' });
              return { success: true, result: { action: "start", port: 5001, url: "http://172.24.1.204:5001", message: "Staging server starting on port 5001. Check status in a few seconds." } };
            } catch (e: any) {
              return { success: false, result: { error: e.message?.substring(0, 500) } };
            }
          }
          case "stop": {
            try { execSync('fuser -k 5001/tcp 2>/dev/null', { timeout: 5000 }); } catch {}
            return { success: true, result: { action: "stop", message: "Staging server stopped." } };
          }
          case "status": {
            let running = false;
            try { execSync('fuser 5001/tcp 2>/dev/null', { timeout: 3000 }); running = true; } catch {}
            let worktreeExists = false;
            try { await fs.access(stagingDir); worktreeExists = true; } catch {}
            let recentLog = '';
            try { recentLog = execSync('tail -20 /tmp/staging-server.log 2>/dev/null || echo "No log"', { encoding: 'utf-8', timeout: 3000 }).substring(0, 1000); } catch {}
            return { success: true, result: { running, worktreeExists, stagingDir, port: 5001, recentLog } };
          }
          case "apply": {
            try {
              try { execSync('fuser -k 5001/tcp 2>/dev/null', { timeout: 5000 }); } catch {}
              execSync('git add -A && git commit -m "Staging changes" --allow-empty', { cwd: stagingDir, encoding: 'utf-8', timeout: 10000 });
              execSync('git checkout main', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 });
              execSync('git merge staging --no-ff -m "Merge staging changes"', { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
              try { execSync(`git worktree remove "${stagingDir}" --force`, { cwd: projectRoot, timeout: 5000 }); } catch {}
              try { execSync('git branch -D staging', { cwd: projectRoot, timeout: 5000 }); } catch {}
              return { success: true, result: { action: "apply", message: "Staging changes merged into main. Use restart_application to apply." } };
            } catch (e: any) {
              return { success: false, result: { error: e.message?.substring(0, 500) } };
            }
          }
          case "discard": {
            try { execSync('fuser -k 5001/tcp 2>/dev/null', { timeout: 5000 }); } catch {}
            try { execSync(`git worktree remove "${stagingDir}" --force`, { cwd: projectRoot, timeout: 5000 }); } catch {}
            try { execSync('git branch -D staging', { cwd: projectRoot, timeout: 5000 }); } catch {}
            return { success: true, result: { action: "discard", message: "Staging environment discarded. All staging changes removed." } };
          }
          default:
            return { success: false, result: { error: `Unknown staging action: ${args.action}` } };
        }
      }

      case "restart_application": {
        const projectRoot = getProjectRoot();
        try {
          const isPi = projectRoot.includes('/home/byhomeyyz/');
          if (isPi) {
            const output = execSync('pm2 restart dashboard 2>&1 || (npm run build && pm2 restart dashboard)', { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
            return { success: true, result: { restarted: true, env: "pi", output: output.substring(0, 500) } };
          } else {
            return { success: true, result: { restarted: false, env: "replit", message: "In development, the dev server auto-restarts on file changes. No manual restart needed." } };
          }
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      default:
        return { success: false, result: { error: `Unknown tool: ${name}` } };
    }
  } catch (err: any) {
    return { success: false, result: { error: err.message || "Tool execution failed" } };
  }
}

function getProjectRoot(): string {
  return process.cwd();
}

function resolveProjectPath(relativePath: string): string | null {
  const projectRoot = getProjectRoot();
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(projectRoot)) return null;
  if (resolved.includes('..')) return null;
  return resolved;
}

function isProtectedFile(filePath: string): boolean {
  const protected_patterns = ['.env', 'package-lock.json', '.git/'];
  const normalized = filePath.replace(/\\/g, '/');
  return protected_patterns.some(p => normalized.includes(p));
}

function isDangerousCommand(cmd: string): boolean {
  const dangerous = [
    /rm\s+-rf\s+\//, /rm\s+-rf\s+~/, /mkfs/, /dd\s+if=/, /shutdown/, /reboot/,
    /:(){ :|:& };:/, />\s*\/dev\/sd/, /chmod\s+-R\s+777\s+\//, /chown\s+-R.*\/$/,
    /curl.*\|\s*(bash|sh)/, /wget.*\|\s*(bash|sh)/, /eval\s*\(/, /FORMAT\s+C:/i,
  ];
  return dangerous.some(pattern => pattern.test(cmd));
}

export async function getAppContext(): Promise<string> {
  const now = easternNow();
  const currentWeek = getWeekNumber(now);
  const settings = await storage.getActiveSemesterSettings();

  let context = `Current date/time (Eastern): ${now.toISOString()}\nCurrent semester week: ${currentWeek}\n`;

  if (settings) {
    context += `\nActive semester: ${settings.semesterName}\n`;
    context += `Semester start: ${settings.semesterStartDate?.toISOString().split('T')[0]}\n`;
    if (settings.semesterEndDate) context += `Semester end: ${settings.semesterEndDate.toISOString().split('T')[0]}\n`;
    for (let i = 1; i <= 3; i++) {
      const code = (settings as any)[`course${i}Code`];
      const name = (settings as any)[`course${i}Name`];
      if (code) context += `Course ${i}: ${code} — ${name}\n`;
    }
  }

  const upcomingTasks = await storage.getTasks({ weekNumber: currentWeek, showCompleted: false });
  const incomplete = upcomingTasks.filter(t => !t.isCompleted).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 10);
  if (incomplete.length > 0) {
    context += `\nUpcoming tasks (${incomplete.length}):\n`;
    for (const t of incomplete) {
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) due ${new Date(t.dueDate).toISOString().split('T')[0]} week ${t.weekNumber}\n`;
    }
  }

  context += `\nKnown HA entities:\n`;
  context += `  - light.cat_lights (Cat room lights)\n`;
  context += `  - media_player.byhome (Everywhere speaker group)\n`;
  context += `  - media_player.echo_kitchen_studio_black_am (Kitchen Echo)\n`;
  context += `  - media_player.bathroom_speaker (Bathroom speaker)\n`;

  return context;
}
