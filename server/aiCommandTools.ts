import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { notepadNotes, getWeekNumber, COURSES } from "@shared/schema";
import { easternNow } from "./timezone";

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);

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
        for (const target of targets) {
          await fetch(`${haUrl}/api/services/notify/alexa_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: args.message, target, data: { type: "announce" } }),
          });
        }
        return { success: true, result: { announced: true, message: args.message, target: args.target || "everywhere" } };
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
        const base = '';
        switch (args.action) {
          case "play": {
            await fetch('/api/spotify/play', { method: 'PUT' }).catch(() => {});
            return { success: true, result: { action: "play" } };
          }
          case "pause": {
            await fetch('/api/spotify/pause', { method: 'PUT' }).catch(() => {});
            return { success: true, result: { action: "pause" } };
          }
          case "next": {
            await fetch('/api/spotify/next', { method: 'POST' }).catch(() => {});
            return { success: true, result: { action: "next" } };
          }
          case "previous": {
            await fetch('/api/spotify/previous', { method: 'POST' }).catch(() => {});
            return { success: true, result: { action: "previous" } };
          }
          default:
            return { success: false, result: { error: `Unknown spotify action: ${args.action}` } };
        }
      }

      default:
        return { success: false, result: { error: `Unknown tool: ${name}` } };
    }
  } catch (err: any) {
    return { success: false, result: { error: err.message || "Tool execution failed" } };
  }
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
