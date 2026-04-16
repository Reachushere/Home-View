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

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || process.env.HOME_ASSISTANT_URL || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnvAi = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnvAi = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnvAi.startsWith("eyJ") ? tokenFromEnvAi : (urlFromEnvAi.startsWith("eyJ") ? urlFromEnvAi : tokenFromEnvAi);

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
      name: "ha_list_entities",
      description: "Search Home Assistant for available entities. Use this BEFORE ha_service_call when you don't know the exact entity_id. Also use for 'what lights do I have?', 'list devices', 'show automations', etc. Bryn has 400+ devices — always search, never guess.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term to filter entities (e.g. 'kitchen', 'light', 'bedroom', 'fan'). Searches entity_id and friendly_name." },
          domain: { type: "string", description: "Filter by domain: light, switch, media_player, climate, fan, sensor, automation, scene, script, input_boolean, binary_sensor, cover, lock, etc." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_discover",
      description: "Deep-discover the Home Assistant setup. Returns areas/rooms, automation list, scene list, and entity counts by domain. Use this to learn about Bryn's smart home setup. Call this once, then save findings to memory with memory_write.",
      parameters: {
        type: "object",
        properties: {
          include: { type: "string", enum: ["all", "areas", "automations", "scenes", "summary"], description: "What to discover. 'all' returns everything, 'summary' returns domain counts + areas. Default: 'all'." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_get_state",
      description: "Get the current state of a specific HA entity. Use to check if a light is on/off, a sensor value, automation status, etc. Example: 'is the kitchen light on?' → ha_get_state(entity_id:'light.light_kitchen_rings')",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "The entity ID to check, e.g. light.cat_lights, sensor.temperature" },
        },
        required: ["entity_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_dashboard_read",
      description: "Read the current Home Assistant Lovelace dashboard configuration. Returns the full YAML/JSON config of dashboard cards, views, and layout. Use to understand the current dashboard before making changes.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard URL path (e.g. 'lovelace' for default, or 'lovelace-rooms', etc.). Default: 'lovelace'." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_dashboard_write",
      description: "Update the Home Assistant Lovelace dashboard configuration. ALWAYS read the current config first with ha_dashboard_read, modify it, then write it back. Be careful — this overwrites the entire dashboard config.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard URL path (default: 'lovelace')" },
          config: { type: "object", description: "The full Lovelace config object to write. Must include 'views' array with all views/cards." },
        },
        required: ["config"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_config_entries",
      description: "List HA config entries, integrations, or call any HA REST API endpoint. For advanced HA interactions like reading/writing automations, scripts, helpers, etc.",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP method" },
          path: { type: "string", description: "HA API path after the base URL, e.g. '/api/config/automation/config/automation_id', '/api/template', '/api/services'" },
          body: { type: "object", description: "Request body for POST/PUT" },
        },
        required: ["method", "path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_service_call",
      description: "Call a Home Assistant service. Use for controlling lights, switches, media players, etc. IMPORTANT: If you don't know the exact entity_id, use ha_list_entities first to find it.",
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
      description: "Change the app's visual theme/colors OR the BrynAssist dialog's appearance. Updates stored in DB and take effect on next page load/refresh. For dashboard: use headerBar, mainBackground, etc. For BrynAssist dialog (this window): use wizard* properties. IMPORTANT: When user asks to change 'text color', use wizardTextColor for message text or wizardBodyTextColor for the prompt examples/body text. Do NOT change bubble backgrounds (wizardUserBubble/wizardAssistantBubble) unless the user specifically asks to change bubble/message background colors. Set wizardReset to true to reset ALL BrynAssist styles back to defaults.",
      parameters: {
        type: "object",
        properties: {
          headerBar: { type: "string", description: "Dashboard header bar color (hex code)" },
          mainBackground: { type: "string", description: "Dashboard main background color (hex code)" },
          mainBackgroundGradientEnd: { type: "string", description: "Dashboard background gradient end color (hex code)" },
          boxBackground: { type: "string", description: "Dashboard content box background color (hex code)" },
          todayCellBackground: { type: "string", description: "Today cell highlight color (hex code)" },
          boxTransparency: { type: "integer", description: "Box transparency level 0-100" },
          boxGlassEffect: { type: "boolean", description: "Enable/disable glass effect" },
          wizardBackground: { type: "string", description: "BrynAssist dialog background CSS (e.g. 'linear-gradient(180deg, #0a1628 0%, #0f2347 100%)' or a hex color)" },
          wizardBorder: { type: "string", description: "BrynAssist dialog border CSS (e.g. '1.5px solid rgba(100,160,255,0.3)')" },
          wizardHeaderBg: { type: "string", description: "BrynAssist header area background CSS" },
          wizardInputBg: { type: "string", description: "BrynAssist input area background CSS" },
          wizardUserBubble: { type: "string", description: "BrynAssist user message bubble BACKGROUND CSS (not text). Only change when user asks about bubble/message background color" },
          wizardAssistantBubble: { type: "string", description: "BrynAssist assistant message bubble BACKGROUND CSS (not text). Only change when user asks about bubble/message background color" },
          wizardTextColor: { type: "string", description: "BrynAssist message text color (hex code, e.g. '#ffffff'). Use this when user asks to change the text/font color in messages" },
          wizardBodyTextColor: { type: "string", description: "BrynAssist body/prompt example text color (hex code, e.g. '#ffffff'). Use this when user asks to change the welcome text or prompt example colors" },
          wizardReset: { type: "boolean", description: "Set to true to reset ALL BrynAssist wizard styles back to defaults. Use when user asks to reset/fix BrynAssist appearance" },
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
      description: "Make a targeted edit to a file. Two modes: (1) String replace: provide oldText+newText for exact match replacement. (2) Line replace: provide startLine+endLine+newText to replace a line range. Always read_file first to see exact content and line numbers. String mode: oldText must match exactly (including whitespace). Line mode: use when string matching is difficult (long lines, special chars).",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path to the file to edit" },
          oldText: { type: "string", description: "Exact text to find and replace (must be unique in the file). Use this OR startLine+endLine." },
          newText: { type: "string", description: "Replacement text" },
          startLine: { type: "integer", description: "Start line number (1-indexed, inclusive). Use with endLine as alternative to oldText." },
          endLine: { type: "integer", description: "End line number (1-indexed, inclusive). Use with startLine." },
        },
        required: ["filePath", "newText"],
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
  {
    type: "function" as const,
    function: {
      name: "check_build",
      description: "Run TypeScript type-checking to verify the project compiles. ALWAYS call this after making code edits. Returns any compilation errors so you can fix them. This is how you verify your changes work.",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", description: "Optional: specific file to check (e.g. 'server/aiCommandTools.ts'). If omitted, checks entire project." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_logs",
      description: "Read recent server logs or error output. Use this to check if the app is running correctly after changes, or to debug runtime errors.",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["server", "build", "staging"], description: "Which logs to read. 'server' = main app stdout/stderr, 'build' = last build output, 'staging' = staging server logs." },
          lines: { type: "integer", description: "Number of lines to read from the end. Default 50." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_backup",
      description: "Create a git backup commit of the current state before making risky changes. This allows easy rollback. Call this before starting a multi-file code change.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Backup commit message describing what you're about to change" },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_diff",
      description: "Show what files have been changed and the diff. Use after making edits to review your changes before committing.",
      parameters: {
        type: "object",
        properties: {
          staged: { type: "boolean", description: "If true, shows staged changes. Default false (shows unstaged)." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_commit_and_push",
      description: "Commit all current changes and push to GitHub. Use after verifying changes work (check_build passes). This deploys the code — the Pi can then pull and restart.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Commit message describing the changes" },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_project_map",
      description: "Get a high-level map of the project structure showing all directories and key files. Use this to orient yourself before making changes.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_ui",
      description: "Analyze a React component's UI structure by reading its JSX. Returns all visible elements, text content, CSS/Tailwind classes, conditional renders, event handlers, and data-testid attributes. This is your 'eyes' — use it to understand what the user sees on any page or component before and after changes.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "Component file path relative to project root (e.g. 'client/src/pages/dashboard.tsx')" },
          search_term: { type: "string", description: "Optional: search for a specific element, text, or class name within the component. Returns surrounding context." },
          offset: { type: "integer", description: "Line offset to start reading from (for large files). Default 1." },
          limit: { type: "integer", description: "Max lines to read. Default 300." },
        },
        required: ["file"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "smoke_test",
      description: "Run a comprehensive smoke test: checks server health, hits all critical API endpoints, verifies responses. Returns pass/fail for each. Use after code changes to ensure nothing is broken.",
      parameters: {
        type: "object",
        properties: {
          endpoints: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of specific API paths to test (e.g. ['/api/tasks', '/api/health']). If omitted, tests all known critical endpoints."
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_node_script",
      description: "Write and execute a Node.js script for custom testing or data processing. The script runs in the project directory with full access to the Node.js API. Use for: complex validation logic, data transformations, API integration tests, or anything that needs custom code. Script has a 30-second timeout.",
      parameters: {
        type: "object",
        properties: {
          script: { type: "string", description: "Node.js script content to execute. Use console.log for output." },
        },
        required: ["script"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Generate an image using DALL-E 3. Creates a JPG/PNG from a text description. Costs ~$0.04-0.08 per image from the OpenAI account. The image is saved to the project's public assets folder and returns the file path. Use for: creating graphics, icons, illustrations, backgrounds, concept art, or any visual content Bryn requests.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed description of the image to generate. Be specific about style, colors, composition, and subject matter." },
          size: { type: "string", enum: ["1024x1024", "1792x1024", "1024x1792"], description: "Image dimensions. 1024x1024 (square), 1792x1024 (landscape), 1024x1792 (portrait). Default 1024x1024." },
          quality: { type: "string", enum: ["standard", "hd"], description: "Image quality. 'standard' (~$0.04) or 'hd' (~$0.08) for more detail. Default standard." },
          filename: { type: "string", description: "Output filename without extension (e.g. 'cat-graduation'). Will be saved as PNG." },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "take_screenshot",
      description: "Take a screenshot of a page in the running app using a headless browser. This is your REAL eyes — you can see exactly what the user sees. The screenshot is saved as a PNG file. After taking it, use analyze_ui or read the image path to reference it. Use this to verify UI changes, check layout, debug visual issues.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "URL path to screenshot (e.g. '/' for dashboard, '/m' for mobile). Default '/'." },
          filename: { type: "string", description: "Output filename without extension (e.g. 'dashboard-after-fix'). Saved to /generated/ folder." },
          width: { type: "integer", description: "Viewport width in pixels. Default 1280." },
          height: { type: "integer", description: "Viewport height in pixels. Default 800." },
          fullPage: { type: "boolean", description: "If true, captures the entire scrollable page. Default false (viewport only)." },
          waitFor: { type: "string", description: "CSS selector to wait for before capturing (e.g. '[data-testid=\"task-list\"]'). Ensures content is loaded." },
          delay: { type: "integer", description: "Extra milliseconds to wait after page load before capturing. Default 2000." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "browser_test",
      description: "Run a browser-level test using Puppeteer. Opens a real headless browser, navigates pages, clicks buttons, fills forms, and verifies results. This is the equivalent of a real user testing the app. Write test steps as a series of actions. Returns pass/fail with details.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["goto", "click", "type", "select", "wait", "screenshot", "check_text", "check_element", "check_url", "evaluate"], description: "Action to perform" },
                selector: { type: "string", description: "CSS selector for click/type/select/check_element/wait" },
                value: { type: "string", description: "Value for type/select/goto(url path)/check_text(expected text)/evaluate(JS code)" },
                description: { type: "string", description: "Human-readable description of what this step does" },
              },
              required: ["action"],
            },
            description: "Ordered list of test steps to execute in the browser",
          },
          name: { type: "string", description: "Name for this test (e.g. 'task creation flow')" },
        },
        required: ["steps"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_sql",
      description: "Execute a SQL query against the PostgreSQL database. Use for checking data, debugging, understanding schema. SELECT queries run freely. INSERT/UPDATE/DELETE require confirmation.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "SQL query to execute. Use SELECT for reads, INSERT/UPDATE/DELETE for writes." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "db_schema",
      description: "Show the current database schema — all tables, columns, and types. Use this before writing SQL queries or modifying shared/schema.ts.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "install_package",
      description: "Install an npm package. Runs 'npm install <package>'. Use when you need a new dependency for a feature.",
      parameters: {
        type: "object",
        properties: {
          package_name: { type: "string", description: "Package name (e.g. 'lodash' or 'dayjs@1.11.0')" },
          dev: { type: "boolean", description: "Install as devDependency. Default false." },
        },
        required: ["package_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "http_check",
      description: "Fetch a URL from the running app and return the HTTP status, headers, and a content preview. Use this to verify the app is running, check API responses, or test endpoints after changes. This is how you 'see' if the app works.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "URL path to check, e.g. '/api/tasks' or '/'. Will be prepended with http://localhost:5000" },
          method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"], description: "HTTP method. Default GET." },
          body: { type: "string", description: "JSON body for POST/PATCH requests." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_read",
      description: "Read your persistent memory file. This contains notes, preferences, and context from previous sessions. Load this at the start of complex tasks to remember past work.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_write",
      description: "Write to your persistent memory file. Save important context, decisions, patterns, and notes here so you remember them in future sessions. Append new info — don't overwrite everything.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Content to write to memory. Will replace the entire memory file, so include existing content you want to keep." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "process_check",
      description: "Check if the app server is running, what port it's on, and system resource usage. Use after restart_application or when debugging crashes.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_performance",
      description: "Check app performance metrics: bundle size, build time, page load speed, and memory usage. Use after making changes to verify nothing degraded.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Page URL path to test load speed. Default: /" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "conversation_history",
      description: "Read recent conversation history with the wizard. Shows what commands were run, tools used, and timestamps from the last 7 days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days of history to retrieve. Default: 7, max: 30." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "health_check",
      description: "Run a comprehensive health check: tests key endpoints, checks database connectivity, verifies disk space, and reports overall system status.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for current information. Use for: looking up facts, checking documentation, finding solutions to errors, getting current news/weather details, researching topics for Bryn's courses, or any question requiring external knowledge. Returns top search results with titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (e.g. 'TMU Chang School exam schedule 2026', 'Node.js pm2 restart command', 'Toronto weather this week')" },
          num_results: { type: "integer", description: "Number of results to return. Default 5, max 10." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_fetch",
      description: "Fetch the text content of a web page. Use after web_search to read a specific page for detailed information. Returns the page's main text content (HTML stripped). Has a 15-second timeout.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to fetch (e.g. 'https://example.com/page')" },
          max_length: { type: "integer", description: "Max characters to return. Default 5000." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "code_reference",
      description: "Get instant reference docs and common patterns for the project's tech stack. Use when you need to know how a library works, best practices for a pattern, or example code. Much faster than web_search for stack-specific questions. Covers: React, Express, Drizzle ORM, Tailwind CSS, shadcn/ui, TanStack Query, Wouter, Zod, Framer Motion, PostgreSQL, and Node.js patterns.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What you need help with (e.g. 'drizzle relations', 'tanstack mutation', 'shadcn dialog', 'express middleware', 'zod validation', 'tailwind animation', 'framer motion variants')" },
          context: { type: "string", description: "Optional: what you're trying to accomplish, so the reference can be more targeted" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_search",
      description: "Search GitHub for real-world code examples and patterns. Use when you need to see how other projects implement something, find library usage examples, or solve an unfamiliar problem. Returns code snippets from public repos.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Code search query (e.g. 'drizzle-orm postgres array column', 'react-hook-form nested fields', 'express rate limiting middleware')" },
          language: { type: "string", description: "Filter by language: typescript, javascript, css, sql. Default: typescript." },
          num_results: { type: "integer", description: "Number of results. Default 5, max 10." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_file",
      description: "Read a specific file from any public GitHub repository. Use to study how other projects implement features, read library source code, or grab example configs. Returns the raw file content.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "GitHub repo in 'owner/repo' format (e.g. 'drizzle-team/drizzle-orm', 'shadcn-ui/ui', 'TanStack/query')" },
          path: { type: "string", description: "File path within the repo (e.g. 'src/index.ts', 'README.md', 'examples/basic/src/App.tsx')" },
          branch: { type: "string", description: "Branch name. Default 'main'." },
          max_length: { type: "integer", description: "Max characters to return. Default 8000." },
        },
        required: ["repo", "path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "npm_info",
      description: "Get package information from the npm registry. Returns: description, latest version, dependencies, README excerpt, homepage, and repository URL. Use when you need to understand a package before using it, check compatibility, or read its docs.",
      parameters: {
        type: "object",
        properties: {
          package_name: { type: "string", description: "npm package name (e.g. 'drizzle-orm', '@tanstack/react-query', 'framer-motion')" },
        },
        required: ["package_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ai_subtask",
      description: "Delegate a sub-task to a secondary AI model for parallel processing. The secondary model (gpt-4.1-mini) is faster and cheaper — use it for: summarizing large text, generating boilerplate code, analyzing data, translating content, formatting output, or any task that doesn't need your full reasoning power. You stay in control — review the result and use it in your response.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "Clear instruction for the secondary model (e.g. 'Summarize this error log and identify the root cause', 'Generate a TypeScript interface for this JSON data', 'Write a SQL query that finds all overdue tasks grouped by course')" },
          input: { type: "string", description: "Input data for the secondary model (e.g. error log text, JSON data, code snippet). Keep under 10000 chars." },
          model: { type: "string", enum: ["gpt-4.1-mini", "gpt-4.1-nano"], description: "Which model to use. gpt-4.1-mini for moderate tasks, gpt-4.1-nano for simple/fast tasks. Default: gpt-4.1-mini." },
          max_tokens: { type: "integer", description: "Max response tokens. Default 2000." },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plan_task",
      description: "Decompose a complex task into ordered steps BEFORE executing. Use this when Bryn asks for something that involves 3+ files or multiple logical stages (e.g. 'add a new page with API endpoint and database table', 'refactor the homework box'). Creates a plan, then execute each step in order. Also use to show Bryn what you're about to do for transparency.",
      parameters: {
        type: "object",
        properties: {
          objective: { type: "string", description: "What you're trying to accomplish (1-2 sentences)" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "integer", description: "Step number (1-based)" },
                action: { type: "string", description: "What to do in this step (1-2 sentences)" },
                tools: { type: "string", description: "Which tools you'll use (e.g. 'read_file, edit_file, check_build')" },
                files: { type: "string", description: "Files involved (e.g. 'server/routes.ts, shared/schema.ts')" },
              },
              required: ["step", "action"],
            },
            description: "Ordered list of steps to complete the task",
          },
          risk_level: { type: "string", enum: ["low", "medium", "high"], description: "How risky is this change? Low = cosmetic/text. Medium = logic/feature. High = schema/architecture." },
        },
        required: ["objective", "steps"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "codebase_explore",
      description: "Explore multiple files and code patterns in ONE call. Use this instead of calling read_file and search_code separately when you need broad codebase awareness. Can search for patterns across the entire project AND read specific file sections simultaneously. Returns a combined view of the codebase. Use when investigating bugs, planning refactors, or understanding how features connect across files.",
      parameters: {
        type: "object",
        properties: {
          searches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pattern: { type: "string", description: "Regex pattern to search for across the codebase" },
                file_glob: { type: "string", description: "Optional file filter (e.g. '*.tsx', 'server/**/*.ts')" },
              },
              required: ["pattern"],
            },
            description: "Code patterns to search for (up to 5 simultaneous searches)",
          },
          read_sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                file: { type: "string", description: "File path to read" },
                offset: { type: "integer", description: "Start line (1-indexed)" },
                limit: { type: "integer", description: "Number of lines to read (default 100)" },
              },
              required: ["file"],
            },
            description: "File sections to read simultaneously (up to 5)",
          },
          summary_question: { type: "string", description: "Optional: a question to guide what to focus on in the results (e.g. 'How does the homework box get its width?')" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "db_migrate",
      description: "Run database migration (drizzle push) to sync schema changes. Use after modifying shared/schema.ts to apply changes to the database. Equivalent to 'npm run db:push'.",
      parameters: {
        type: "object",
        properties: {
          force: { type: "boolean", description: "Use --force flag for destructive changes. Default false. DANGEROUS — confirm with user first." },
        },
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

      case "ha_dashboard_read": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrlDash = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const dashPath = args.dashboard || 'lovelace';
        try {
          const resp = await fetch(`${haUrlDash}/api/lovelace/config/${dashPath}`, {
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          });
          if (resp.status === 404) {
            const defaultResp = await fetch(`${haUrlDash}/api/lovelace/config`, {
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            });
            if (!defaultResp.ok) return { success: false, result: { error: `HA dashboard API error: ${defaultResp.status}` } };
            const config = await defaultResp.json();
            return { success: true, result: { dashboard: 'default', viewCount: config.views?.length || 0, config } };
          }
          if (!resp.ok) return { success: false, result: { error: `HA dashboard API error: ${resp.status}` } };
          const config = await resp.json();
          return { success: true, result: { dashboard: dashPath, viewCount: config.views?.length || 0, config } };
        } catch (err: any) {
          return { success: false, result: { error: `HA dashboard read failed: ${err.message}` } };
        }
      }

      case "ha_dashboard_write": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrlDashW = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const dashPathW = args.dashboard || 'lovelace';
        try {
          const url = dashPathW === 'lovelace'
            ? `${haUrlDashW}/api/lovelace/config`
            : `${haUrlDashW}/api/lovelace/config/${dashPathW}`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(args.config),
          });
          if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            return { success: false, result: { error: `HA dashboard write failed: ${resp.status} ${errText.substring(0, 300)}` } };
          }
          return { success: true, result: { message: "Dashboard updated successfully. Refresh your HA browser to see changes.", dashboard: dashPathW } };
        } catch (err: any) {
          return { success: false, result: { error: `HA dashboard write failed: ${err.message}` } };
        }
      }

      case "ha_config_entries": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrlCfg = HOME_ASSISTANT_URL.replace(/\/$/, '');
        try {
          const fetchOpts: any = {
            method: args.method || 'GET',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          };
          if (args.body && (args.method === 'POST' || args.method === 'PUT')) {
            fetchOpts.body = JSON.stringify(args.body);
          }
          const resp = await fetch(`${haUrlCfg}${args.path}`, fetchOpts);
          if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            return { success: false, result: { error: `HA API ${args.method} ${args.path} failed: ${resp.status} ${errText.substring(0, 300)}` } };
          }
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('json')) {
            const data = await resp.json();
            const str = JSON.stringify(data);
            if (str.length > 15000) {
              return { success: true, result: { note: "Response truncated (too large)", data: JSON.parse(str.substring(0, 15000) + '..."') } };
            }
            return { success: true, result: data };
          }
          const text = await resp.text();
          return { success: true, result: { text: text.substring(0, 5000) } };
        } catch (err: any) {
          return { success: false, result: { error: `HA API call failed: ${err.message}` } };
        }
      }

      case "ha_discover": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured. Needs rebuild: npm run build && pm2 restart all" } };
        }
        const haUrlDisc = HOME_ASSISTANT_URL.replace(/\/$/, '');
        try {
          const include = args.include || 'all';
          const result: any = {};

          const statesResp = await fetch(`${haUrlDisc}/api/states`, {
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          });
          if (!statesResp.ok) return { success: false, result: { error: `HA API error: ${statesResp.status}` } };
          const allStates: any[] = await statesResp.json();

          const domainCounts: Record<string, number> = {};
          for (const e of allStates) {
            const d = e.entity_id.split('.')[0];
            domainCounts[d] = (domainCounts[d] || 0) + 1;
          }
          result.totalEntities = allStates.length;
          result.domainCounts = domainCounts;

          if (include === 'all' || include === 'automations') {
            const automations = allStates.filter((e: any) => e.entity_id.startsWith('automation.'));
            result.automations = automations.map((e: any) => ({
              entity_id: e.entity_id,
              name: e.attributes?.friendly_name || '',
              state: e.state,
              last_triggered: e.attributes?.last_triggered || null,
            }));
          }

          if (include === 'all' || include === 'scenes') {
            const scenes = allStates.filter((e: any) => e.entity_id.startsWith('scene.'));
            result.scenes = scenes.map((e: any) => ({
              entity_id: e.entity_id,
              name: e.attributes?.friendly_name || '',
            }));
          }

          if (include === 'all' || include === 'areas') {
            try {
              const areasResp = await fetch(`${haUrlDisc}/api/config/areas/list`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: '{}',
              });
              if (areasResp.ok) {
                const areas = await areasResp.json();
                result.areas = Array.isArray(areas) ? areas.map((a: any) => ({
                  id: a.area_id || a.id,
                  name: a.name,
                })) : areas?.result?.map((a: any) => ({ id: a.area_id || a.id, name: a.name })) || [];
              }
            } catch {}
          }

          if (include === 'all' || include === 'summary') {
            const lights = allStates.filter((e: any) => e.entity_id.startsWith('light.'));
            const lightsOn = lights.filter((e: any) => e.state === 'on');
            result.lightsSummary = { total: lights.length, on: lightsOn.length, off: lights.length - lightsOn.length };

            const groups = allStates.filter((e: any) =>
              e.entity_id.includes('group') || e.entity_id.includes('all_') ||
              (e.attributes?.entity_id && Array.isArray(e.attributes.entity_id))
            );
            result.groups = groups.slice(0, 30).map((e: any) => ({
              entity_id: e.entity_id,
              name: e.attributes?.friendly_name || '',
              state: e.state,
              members: e.attributes?.entity_id || [],
            }));
          }

          result.tip = "Use memory_write to save key findings (room groups, common entities, automation names) so you remember them next time.";
          return { success: true, result };
        } catch (err: any) {
          return { success: false, result: { error: `HA discovery failed: ${err.message}` } };
        }
      }

      case "ha_get_state": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrlState = HOME_ASSISTANT_URL.replace(/\/$/, '');
        try {
          const resp = await fetch(`${haUrlState}/api/states/${args.entity_id}`, {
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          });
          if (!resp.ok) {
            if (resp.status === 404) return { success: false, result: { error: `Entity '${args.entity_id}' not found in HA. Use ha_list_entities to search for the correct entity.` } };
            return { success: false, result: { error: `HA API error: ${resp.status}` } };
          }
          const state: any = await resp.json();
          return { success: true, result: {
            entity_id: state.entity_id,
            state: state.state,
            name: state.attributes?.friendly_name || '',
            attributes: {
              brightness: state.attributes?.brightness,
              color_temp: state.attributes?.color_temp,
              rgb_color: state.attributes?.rgb_color,
              temperature: state.attributes?.temperature,
              unit: state.attributes?.unit_of_measurement,
              device_class: state.attributes?.device_class,
              entity_id: state.attributes?.entity_id,
            },
            last_changed: state.last_changed,
            last_updated: state.last_updated,
          }};
        } catch (err: any) {
          return { success: false, result: { error: `HA connection failed: ${err.message}` } };
        }
      }

      case "ha_list_entities": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured. Needs rebuild: npm run build && pm2 restart all" } };
        }
        const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
        try {
          const resp = await fetch(`${haUrl}/api/states`, {
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          });
          if (!resp.ok) {
            return { success: false, result: { error: `HA API error: ${resp.status}` } };
          }
          const states: any[] = await resp.json();
          let filtered = states;
          if (args.domain) {
            filtered = filtered.filter((e: any) => e.entity_id.startsWith(args.domain + '.'));
          }
          if (args.search) {
            const s = args.search.toLowerCase();
            filtered = filtered.filter((e: any) =>
              e.entity_id.toLowerCase().includes(s) ||
              (e.attributes?.friendly_name || '').toLowerCase().includes(s)
            );
          }
          const results = filtered.slice(0, 50).map((e: any) => ({
            entity_id: e.entity_id,
            name: e.attributes?.friendly_name || '',
            state: e.state,
          }));
          return { success: true, result: { count: filtered.length, showing: results.length, entities: results } };
        } catch (err: any) {
          return { success: false, result: { error: `HA connection failed: ${err.message}` } };
        }
      }

      case "ha_service_call": {
        console.log(`[AI HA] URL="${HOME_ASSISTANT_URL ? HOME_ASSISTANT_URL.substring(0, 40) : 'EMPTY'}..." TOKEN="${HOME_ASSISTANT_TOKEN ? 'SET(' + HOME_ASSISTANT_TOKEN.length + ' chars)' : 'EMPTY'}"`);
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          const diag = `URL=${HOME_ASSISTANT_URL ? 'set' : 'MISSING'}, TOKEN=${HOME_ASSISTANT_TOKEN ? 'set' : 'MISSING'}. env HOME_ASSISTANT_URL=${process.env.HOME_ASSISTANT_URL ? 'set' : 'missing'}, env HOME_ASSISTANT_TOKEN=${process.env.HOME_ASSISTANT_TOKEN ? 'set' : 'missing'}. The app needs HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN environment variables, or the code needs rebuilding (npm run build && pm2 restart all).`;
          console.log(`[AI HA] FAILED: ${diag}`);
          return { success: false, result: { error: `Home Assistant not configured. Diagnostic: ${diag}` } };
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
          const diag = `URL=${HOME_ASSISTANT_URL ? 'set' : 'MISSING'}, TOKEN=${HOME_ASSISTANT_TOKEN ? 'set' : 'MISSING'}. env HOME_ASSISTANT_URL=${process.env.HOME_ASSISTANT_URL ? 'set' : 'missing'}, env HOME_ASSISTANT_TOKEN=${process.env.HOME_ASSISTANT_TOKEN ? 'set' : 'missing'}. Needs rebuild: npm run build && pm2 restart all`;
          return { success: false, result: { error: `Home Assistant not configured. Diagnostic: ${diag}` } };
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
        const dashboardFields = ['headerBar', 'mainBackground', 'mainBackgroundGradientEnd', 'boxBackground', 'todayCellBackground', 'boxTransparency', 'boxGlassEffect'];
        const wizardFields = ['wizardBackground', 'wizardBorder', 'wizardHeaderBg', 'wizardInputBg', 'wizardUserBubble', 'wizardAssistantBubble', 'wizardTextColor', 'wizardBodyTextColor'];

        if (args.wizardReset) {
          const key = 'ui_wizardStyle';
          const existingRows = await db.select().from(appStateTable).where(eq(appStateTable.key, key)).limit(1);
          if (existingRows.length > 0) {
            await db.update(appStateTable).set({ value: '{}', updatedAt: new Date() }).where(eq(appStateTable.key, key));
          }
          return { success: true, result: { updated: ['BrynAssist: reset to defaults'], note: "Close and reopen BrynAssist to see changes." } };
        }

        const dashboardUpdates: any = {};
        const wizardUpdates: any = {};
        for (const f of dashboardFields) { if (args[f] !== undefined) dashboardUpdates[f] = args[f]; }
        for (const f of wizardFields) { if (args[f] !== undefined) wizardUpdates[f] = args[f]; }

        if (Object.keys(dashboardUpdates).length === 0 && Object.keys(wizardUpdates).length === 0) {
          return { success: false, result: { error: "No theme updates specified" } };
        }

        const results: string[] = [];

        if (Object.keys(dashboardUpdates).length > 0) {
          const key = 'ui_colorSettings';
          const existingRows = await db.select().from(appStateTable).where(eq(appStateTable.key, key)).limit(1);
          let current: any = {};
          if (existingRows.length > 0 && existingRows[0].value) { try { current = JSON.parse(existingRows[0].value); } catch {} }
          const merged = { ...current, ...dashboardUpdates };
          const value = JSON.stringify(merged);
          if (existingRows.length > 0) {
            await db.update(appStateTable).set({ value, updatedAt: new Date() }).where(eq(appStateTable.key, key));
          } else {
            await db.insert(appStateTable).values({ key, value });
          }
          results.push(`Dashboard: ${Object.keys(dashboardUpdates).join(', ')}`);
        }

        if (Object.keys(wizardUpdates).length > 0) {
          const key = 'ui_wizardStyle';
          const existingRows = await db.select().from(appStateTable).where(eq(appStateTable.key, key)).limit(1);
          let current: any = {};
          if (existingRows.length > 0 && existingRows[0].value) { try { current = JSON.parse(existingRows[0].value); } catch {} }
          const merged = { ...current, ...wizardUpdates };
          const value = JSON.stringify(merged);
          if (existingRows.length > 0) {
            await db.update(appStateTable).set({ value, updatedAt: new Date() }).where(eq(appStateTable.key, key));
          } else {
            await db.insert(appStateTable).values({ key, value });
          }
          results.push(`BrynAssist: ${Object.keys(wizardUpdates).join(', ')}`);
        }

        return { success: true, result: { updated: results, note: "Changes apply on page refresh. For BrynAssist changes, close and reopen the dialog." } };
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
          const limit = args.limit || 1000;
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

          if (args.startLine && args.endLine) {
            const lines = content.split('\n');
            const start = Math.max(1, args.startLine) - 1;
            const end = Math.min(lines.length, args.endLine);
            if (start >= lines.length) return { success: false, result: { error: `startLine ${args.startLine} exceeds file length (${lines.length} lines)` } };
            const replaced = lines.slice(start, end).join('\n');
            const before = lines.slice(0, start);
            const after = lines.slice(end);
            const newContent = [...before, args.newText, ...after].join('\n');
            await fs.writeFile(safePath, newContent, 'utf-8');
            return { success: true, result: { edited: args.filePath, mode: 'line-replace', linesReplaced: `${args.startLine}-${args.endLine}`, oldSnippet: replaced.substring(0, 200) } };
          }

          if (!args.oldText) return { success: false, result: { error: "Provide either oldText or startLine+endLine" } };

          const occurrences = content.split(args.oldText).length - 1;
          if (occurrences === 0) {
            const trimmedSearch = args.oldText.trim();
            const lines = content.split('\n');
            const closeMatches: string[] = [];
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(trimmedSearch.split('\n')[0].trim())) {
                closeMatches.push(`Line ${i + 1}: ${lines[i].substring(0, 150)}`);
              }
            }
            const hint = closeMatches.length > 0
              ? ` Possible matches:\n${closeMatches.slice(0, 5).join('\n')}\nTip: Use startLine+endLine mode for tricky edits.`
              : ' Tip: Use search_code to find the right text, or use startLine+endLine mode.';
            return { success: false, result: { error: `oldText not found in file.${hint}` } };
          }
          if (occurrences > 1) return { success: false, result: { error: `oldText found ${occurrences} times — must be unique. Add more surrounding context to make it unique.` } };
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

      case "check_build": {
        const projectRoot = getProjectRoot();
        try {
          const cmd = args.focus
            ? `npx tsc --noEmit --pretty false 2>&1 | grep -i "${args.focus}" | head -30`
            : 'npx tsc --noEmit --pretty false 2>&1 | head -50';
          const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
          const errors = output.trim();
          if (!errors || errors.length === 0) {
            return { success: true, result: { compiles: true, message: "No TypeScript errors found. Build is clean." } };
          }
          const errorLines = errors.split('\n').filter(l => l.includes('error TS'));
          return { success: true, result: { compiles: false, errorCount: errorLines.length, errors: errors.substring(0, 4000) } };
        } catch (e: any) {
          const output = (e.stdout || '') + (e.stderr || '');
          if (output.includes('error TS')) {
            const errorLines = output.split('\n').filter((l: string) => l.includes('error TS'));
            return { success: true, result: { compiles: false, errorCount: errorLines.length, errors: output.substring(0, 4000) } };
          }
          return { success: true, result: { compiles: true, message: "Build check completed." } };
        }
      }

      case "read_logs": {
        const source = args.source || 'server';
        const lines = args.lines || 50;
        try {
          let logFile = '';
          if (source === 'staging') {
            logFile = '/tmp/staging-server.log';
          } else if (source === 'build') {
            const projectRoot = getProjectRoot();
            const output = execSync(`npm run build 2>&1 | tail -${lines}`, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
            return { success: true, result: { source: 'build', output: output.substring(0, 5000) } };
          } else {
            const projectRoot = getProjectRoot();
            const isPi = projectRoot.includes('/home/byhomeyyz/');
            if (isPi) {
              const output = execSync(`pm2 logs dashboard --nostream --lines ${lines} 2>&1`, { encoding: 'utf-8', timeout: 10000 });
              return { success: true, result: { source: 'server', output: output.substring(0, 5000) } };
            }
            const logFiles = execSync('ls -t /tmp/logs/Start_application_*.log 2>/dev/null | head -1', { encoding: 'utf-8', timeout: 3000 }).trim();
            if (logFiles) logFile = logFiles;
            else return { success: true, result: { source: 'server', output: "No server log files found" } };
          }
          const output = execSync(`tail -${lines} "${logFile}" 2>/dev/null || echo "Log file not found"`, { encoding: 'utf-8', timeout: 5000 });
          return { success: true, result: { source, output: output.substring(0, 5000) } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "git_backup": {
        const projectRoot = getProjectRoot();
        try {
          execSync('git add -A', { cwd: projectRoot, timeout: 10000 });
          const status = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }).trim();
          if (!status) return { success: true, result: { message: "No changes to backup — working tree is clean." } };
          execSync(`git commit -m "🔒 AI backup: ${args.message.replace(/"/g, '\\"').substring(0, 100)}"`, { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
          const hash = execSync('git rev-parse --short HEAD', { cwd: projectRoot, encoding: 'utf-8', timeout: 3000 }).trim();
          return { success: true, result: { backed_up: true, commit: hash, message: `Backup created at ${hash}. You can rollback with: git reset --hard ${hash}` } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "git_diff": {
        const projectRoot = getProjectRoot();
        try {
          const cmd = args.staged ? 'git diff --cached --stat && echo "---DIFF---" && git diff --cached' : 'git diff --stat && echo "---DIFF---" && git diff';
          const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
          return { success: true, result: { diff: output.substring(0, 8000) } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "git_commit_and_push": {
        const projectRoot = getProjectRoot();
        try {
          execSync('git add -A', { cwd: projectRoot, timeout: 10000 });
          const status = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }).trim();
          if (!status) return { success: true, result: { message: "No changes to commit." } };
          execSync(`git commit -m "${args.message.replace(/"/g, '\\"').substring(0, 200)}"`, { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 });
          const hash = execSync('git rev-parse --short HEAD', { cwd: projectRoot, encoding: 'utf-8', timeout: 3000 }).trim();
          const ghToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN3;
          if (ghToken) {
            execSync(`git push https://Reachushere:${ghToken}@github.com/Reachushere/Home-View.git main 2>&1`, { cwd: projectRoot, encoding: 'utf-8', timeout: 30000 });
            const isPi = projectRoot.includes('/home/byhomeyyz/');
            if (isPi) {
              try {
                const deployOut = execSync('bash deploy.sh 2>&1', { cwd: projectRoot, encoding: 'utf-8', timeout: 120000 });
                return { success: true, result: { committed: true, pushed: true, deployed: true, commit: hash, message: `Committed, pushed ${hash}, and auto-deployed on Pi.`, deployLog: deployOut.substring(deployOut.length - 500) } };
              } catch (deployErr: any) {
                return { success: true, result: { committed: true, pushed: true, deployed: false, commit: hash, message: `Committed and pushed ${hash}, but auto-deploy failed.`, deployError: deployErr.message?.substring(0, 300) } };
              }
            }
            return { success: true, result: { committed: true, pushed: true, commit: hash, message: `Committed and pushed ${hash}. Run deploy.sh on the Pi to apply.` } };
          }
          return { success: true, result: { committed: true, pushed: false, commit: hash, message: `Committed ${hash} but GitHub push token not found. Push manually.` } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      case "get_project_map": {
        const projectRoot = getProjectRoot();
        try {
          const tree = execSync(
            "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/attached_assets/*' -not -name '*.log' -not -name '*.json' -not -name '*.lock' | sort | head -200",
            { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 }
          );
          const dirs = execSync(
            "find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -maxdepth 4 | sort",
            { cwd: projectRoot, encoding: 'utf-8', timeout: 10000 }
          );
          return { success: true, result: {
            directories: dirs.trim().substring(0, 3000),
            key_files: tree.trim().substring(0, 5000),
            tip: "Key areas: client/src/pages/ (UI pages), client/src/components/ (shared components), server/ (backend), shared/schema.ts (DB types)"
          }};
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "run_sql": {
        const query = (args.query || '').trim();
        if (!query) return { success: false, result: { error: "No SQL query provided" } };
        try {
          const result = await db.execute(query);
          const rows = (result as any).rows || result;
          const rowArray = Array.isArray(rows) ? rows : [];
          return { success: true, result: { rowCount: rowArray.length, rows: rowArray.slice(0, 50), truncated: rowArray.length > 50 } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      case "db_schema": {
        try {
          const result = await db.execute(`
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
          `);
          const rows = (result as any).rows || result;
          const tables: Record<string, any[]> = {};
          for (const row of rows as any[]) {
            if (!tables[row.table_name]) tables[row.table_name] = [];
            tables[row.table_name].push({ column: row.column_name, type: row.data_type, nullable: row.is_nullable, default: row.column_default });
          }
          return { success: true, result: { tables, tableCount: Object.keys(tables).length } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      case "install_package": {
        const pkgName = args.package_name;
        if (!pkgName || pkgName.includes('&&') || pkgName.includes(';') || pkgName.includes('|')) {
          return { success: false, result: { error: "Invalid package name" } };
        }
        const projectRoot = getProjectRoot();
        try {
          const devFlag = args.dev ? ' --save-dev' : '';
          const output = execSync(`npm install ${pkgName}${devFlag} 2>&1`, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
          return { success: true, result: { installed: pkgName, output: output.substring(0, 1000) } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      case "http_check": {
        const urlPath = args.path || '/';
        const method = args.method || 'GET';
        const port = 5000;
        try {
          const url = `http://localhost:${port}${urlPath}`;
          const options: any = {
            method,
            headers: { 'Accept': 'application/json, text/html' },
          };
          if (args.body && (method === 'POST' || method === 'PATCH')) {
            options.headers['Content-Type'] = 'application/json';
            options.body = args.body;
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          options.signal = controller.signal;
          const response = await fetch(url, options);
          clearTimeout(timeout);
          const contentType = response.headers.get('content-type') || '';
          let body = '';
          if (contentType.includes('json')) {
            const json = await response.json();
            body = JSON.stringify(json, null, 2).substring(0, 5000);
          } else {
            const text = await response.text();
            body = text.substring(0, 3000);
          }
          return { success: true, result: { status: response.status, statusText: response.statusText, contentType, bodyPreview: body } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300), hint: "Server may not be running. Try read_logs or process_check." } };
        }
      }

      case "memory_read": {
        const projectRoot = getProjectRoot();
        const memPath = path.join(projectRoot, '.ai-memory.md');
        try {
          const content = await fs.readFile(memPath, 'utf-8');
          return { success: true, result: { content } };
        } catch {
          return { success: true, result: { content: "(No memory file exists yet. Use memory_write to create one.)" } };
        }
      }

      case "memory_write": {
        const projectRoot = getProjectRoot();
        const memPath = path.join(projectRoot, '.ai-memory.md');
        try {
          await fs.writeFile(memPath, args.content, 'utf-8');
          return { success: true, result: { written: true, size: args.content.length } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "process_check": {
        try {
          const projectRoot = getProjectRoot();
          const isPi = projectRoot.includes('/home/byhomeyyz/');
          let processInfo = '';
          if (isPi) {
            processInfo = execSync('pm2 jlist 2>/dev/null | head -3000', { encoding: 'utf-8', timeout: 5000 });
          } else {
            processInfo = execSync('ps aux | grep -E "(node|tsx|vite)" | grep -v grep | head -10', { encoding: 'utf-8', timeout: 5000 });
          }
          const portCheck = execSync('ss -tlnp 2>/dev/null | grep -E ":5000|:5001" || netstat -tlnp 2>/dev/null | grep -E ":5000|:5001" || echo "Port check unavailable"', { encoding: 'utf-8', timeout: 5000 });
          const memInfo = execSync('free -h 2>/dev/null | head -2 || echo "Memory info unavailable"', { encoding: 'utf-8', timeout: 3000 });
          return { success: true, result: {
            processes: processInfo.substring(0, 2000),
            ports: portCheck.trim(),
            memory: memInfo.trim(),
            environment: isPi ? 'raspberry-pi' : 'replit',
          }};
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "take_screenshot": {
        const projectRoot = getProjectRoot();
        try {
          const puppeteer = await import('puppeteer-core');
          const isPi = projectRoot.includes('/home/byhomeyyz/');
          const chromiumPath = isPi
            ? '/usr/bin/chromium'
            : (await (async () => { try { return execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf-8' }).trim(); } catch { return '/usr/bin/chromium'; } })());
          
          const browser = await puppeteer.default.launch({
            executablePath: chromiumPath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
          });
          
          const page = await browser.newPage();
          const width = args.width || 1280;
          const height = args.height || 800;
          await page.setViewport({ width, height });
          
          const urlPath = args.path || '/';
          const port = isPi ? 5000 : 5000;
          await page.goto(`http://localhost:${port}${urlPath}`, { waitUntil: 'networkidle2', timeout: 30000 });
          
          if (args.waitFor) {
            try { await page.waitForSelector(args.waitFor, { timeout: 10000 }); } catch {}
          }
          
          const delay = args.delay ?? 2000;
          if (delay > 0) await new Promise(r => setTimeout(r, delay));
          
          const outputDir = path.join(projectRoot, 'client', 'public', 'generated');
          await fs.mkdir(outputDir, { recursive: true });
          const filename = (args.filename || `screenshot-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
          const outputPath = path.join(outputDir, `${filename}.png`);
          
          await page.screenshot({ path: outputPath, fullPage: args.fullPage || false });
          
          const title = await page.title();
          const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
          const visibleText = await page.evaluate(() => {
            const body = document.body;
            if (!body) return '';
            const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
            const texts: string[] = [];
            let node;
            while (node = walker.nextNode()) {
              const t = (node.textContent || '').trim();
              if (t.length > 2) texts.push(t);
            }
            return texts.slice(0, 50).join(' | ');
          });
          
          const testIds = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[data-testid]'))
              .map(el => (el as HTMLElement).dataset.testid)
              .slice(0, 40);
          });
          
          await browser.close();
          
          const relativePath = `/generated/${filename}.png`;
          return { success: true, result: {
            saved: relativePath,
            viewport: `${width}x${height}`,
            pageTitle: title,
            elementCount,
            testIds,
            visibleTextPreview: (visibleText as string).substring(0, 2000),
            hint: `Screenshot saved. View at http://localhost:5000${relativePath}`,
          }};
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500), hint: "Chromium may not be installed. Run: sudo apt install chromium" } };
        }
      }

      case "browser_test": {
        const projectRoot = getProjectRoot();
        const testName = args.name || 'Unnamed test';
        const steps = args.steps || [];
        if (!steps.length) return { success: false, result: { error: "No test steps provided" } };

        try {
          const puppeteer = await import('puppeteer-core');
          const isPi = projectRoot.includes('/home/byhomeyyz/');
          const chromiumPath = isPi
            ? '/usr/bin/chromium'
            : (await (async () => { try { return execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf-8' }).trim(); } catch { return '/usr/bin/chromium'; } })());
          
          const browser = await puppeteer.default.launch({
            executablePath: chromiumPath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
          });
          
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          
          const port = 5000;
          const baseUrl = `http://localhost:${port}`;
          const results: { step: number; action: string; description?: string; passed: boolean; detail?: string }[] = [];
          let stepNum = 0;

          for (const step of steps) {
            stepNum++;
            const desc = step.description || `${step.action} ${step.selector || step.value || ''}`;
            try {
              switch (step.action) {
                case 'goto':
                  await page.goto(`${baseUrl}${step.value || '/'}`, { waitUntil: 'networkidle2', timeout: 15000 });
                  results.push({ step: stepNum, action: 'goto', description: desc, passed: true, detail: `Navigated to ${step.value || '/'}` });
                  break;
                case 'click':
                  await page.waitForSelector(step.selector!, { timeout: 8000 });
                  await page.click(step.selector!);
                  results.push({ step: stepNum, action: 'click', description: desc, passed: true });
                  break;
                case 'type':
                  await page.waitForSelector(step.selector!, { timeout: 8000 });
                  await page.type(step.selector!, step.value || '');
                  results.push({ step: stepNum, action: 'type', description: desc, passed: true });
                  break;
                case 'select':
                  await page.waitForSelector(step.selector!, { timeout: 8000 });
                  await page.select(step.selector!, step.value || '');
                  results.push({ step: stepNum, action: 'select', description: desc, passed: true });
                  break;
                case 'wait':
                  if (step.selector) {
                    await page.waitForSelector(step.selector, { timeout: 10000 });
                    results.push({ step: stepNum, action: 'wait', description: desc, passed: true, detail: `Found ${step.selector}` });
                  } else {
                    await new Promise(r => setTimeout(r, parseInt(step.value || '1000')));
                    results.push({ step: stepNum, action: 'wait', description: desc, passed: true });
                  }
                  break;
                case 'screenshot': {
                  const outputDir = path.join(projectRoot, 'client', 'public', 'generated');
                  await fs.mkdir(outputDir, { recursive: true });
                  const fname = `test-${testName.replace(/[^a-zA-Z0-9]/g, '_')}-step${stepNum}`;
                  await page.screenshot({ path: path.join(outputDir, `${fname}.png`) });
                  results.push({ step: stepNum, action: 'screenshot', description: desc, passed: true, detail: `/generated/${fname}.png` });
                  break;
                }
                case 'check_text': {
                  const bodyText = await page.evaluate(() => document.body?.innerText || '');
                  const found = bodyText.includes(step.value || '');
                  results.push({ step: stepNum, action: 'check_text', description: desc, passed: found, detail: found ? `Found "${step.value}"` : `"${step.value}" not found on page` });
                  break;
                }
                case 'check_element': {
                  const el = await page.$(step.selector!);
                  results.push({ step: stepNum, action: 'check_element', description: desc, passed: !!el, detail: el ? `Found ${step.selector}` : `${step.selector} not found` });
                  break;
                }
                case 'check_url': {
                  const currentUrl = page.url();
                  const matches = currentUrl.includes(step.value || '');
                  results.push({ step: stepNum, action: 'check_url', description: desc, passed: matches, detail: `Current URL: ${currentUrl}` });
                  break;
                }
                case 'evaluate': {
                  const evalResult = await page.evaluate(step.value || 'true');
                  results.push({ step: stepNum, action: 'evaluate', description: desc, passed: !!evalResult, detail: JSON.stringify(evalResult).substring(0, 300) });
                  break;
                }
                default:
                  results.push({ step: stepNum, action: step.action, description: desc, passed: false, detail: `Unknown action: ${step.action}` });
              }
            } catch (e: any) {
              results.push({ step: stepNum, action: step.action, description: desc, passed: false, detail: e.message?.substring(0, 200) });
            }
          }

          await browser.close();

          const passed = results.filter(r => r.passed).length;
          const failed = results.filter(r => !r.passed).length;
          return { success: true, result: {
            testName,
            summary: `${passed}/${results.length} steps passed${failed > 0 ? ` — ${failed} FAILED` : ''}`,
            passed, failed, total: results.length,
            allPassed: failed === 0,
            results,
          }};
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500), hint: "Chromium may not be installed. Run: sudo apt install chromium" } };
        }
      }

      case "generate_image": {
        try {
          const OpenAI = (await import("openai")).default;
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) return { success: false, result: { error: "OPENAI_API_KEY not configured" } };
          const openai = new OpenAI({ apiKey });
          const size = args.size || "1024x1024";
          const quality = args.quality || "standard";
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: args.prompt,
            n: 1,
            size: size as any,
            quality: quality as any,
            response_format: "url",
          });
          const imageUrl = response.data[0]?.url;
          if (!imageUrl) return { success: false, result: { error: "No image URL returned from DALL-E" } };
          const revisedPrompt = response.data[0]?.revised_prompt || args.prompt;
          const projectRoot = getProjectRoot();
          const outputDir = path.join(projectRoot, 'client', 'public', 'generated');
          await fs.mkdir(outputDir, { recursive: true });
          const filename = (args.filename || `ai-image-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
          const outputPath = path.join(outputDir, `${filename}.png`);
          const imageResponse = await fetch(imageUrl);
          const arrayBuffer = await imageResponse.arrayBuffer();
          await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
          const relativePath = `/generated/${filename}.png`;
          const cost = quality === 'hd' ? '$0.080' : '$0.040';
          return { success: true, result: {
            saved: outputPath,
            webPath: relativePath,
            size,
            quality,
            cost,
            revisedPrompt: revisedPrompt.substring(0, 300),
            hint: `Image accessible at http://localhost:5000${relativePath} or on Pi at http://172.24.1.204:5000${relativePath}`,
          }};
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      case "analyze_ui": {
        const filePath = args.file;
        const safePath = resolveProjectPath(filePath);
        if (!safePath) return { success: false, result: { error: "Invalid file path" } };
        try {
          const content = await fs.readFile(safePath, 'utf-8');
          const lines = content.split('\n');
          
          if (args.search_term) {
            const term = args.search_term.toLowerCase();
            const matches: { line: number; content: string; context: string }[] = [];
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(term)) {
                const start = Math.max(0, i - 3);
                const end = Math.min(lines.length, i + 4);
                matches.push({
                  line: i + 1,
                  content: lines[i].trim(),
                  context: lines.slice(start, end).map((l, idx) => `${start + idx + 1}: ${l}`).join('\n'),
                });
              }
            }
            return { success: true, result: { file: filePath, matchCount: matches.length, matches: matches.slice(0, 15) } };
          }

          const offset = (args.offset || 1) - 1;
          const limit = args.limit || 300;
          const slice = lines.slice(offset, offset + limit);

          const elements: string[] = [];
          const testIds: string[] = [];
          const classNames: Set<string> = new Set();
          const eventHandlers: string[] = [];
          const conditionals: string[] = [];
          const textContent: string[] = [];

          for (const line of slice) {
            const trimmed = line.trim();
            const testIdMatch = trimmed.match(/data-testid=["']([^"']+)["']/);
            if (testIdMatch) testIds.push(testIdMatch[1]);

            const classMatch = trimmed.match(/className=["']([^"']+)["']/);
            if (classMatch) classMatch[1].split(/\s+/).forEach(c => classNames.add(c));

            const dynClassMatch = trimmed.match(/className=\{[^}]*\}/);
            if (dynClassMatch) classNames.add(dynClassMatch[0]);

            if (/on(Click|Change|Submit|KeyDown|MouseEnter|Focus)=/.test(trimmed)) {
              eventHandlers.push(trimmed.substring(0, 120));
            }

            if (/\{.*\?.*:/.test(trimmed) || /\{.*&&/.test(trimmed) || /isLoading|isError|isPending/.test(trimmed)) {
              conditionals.push(trimmed.substring(0, 150));
            }

            const tagMatch = trimmed.match(/<([\w.]+)/);
            if (tagMatch && !['div', 'span', 'p', 'Fragment'].includes(tagMatch[1])) {
              elements.push(tagMatch[1]);
            }

            if (/>\s*[A-Z][\w\s]+<\//.test(trimmed)) {
              const textMatch = trimmed.match(/>([^<>{]+)</);
              if (textMatch && textMatch[1].trim().length > 2) textContent.push(textMatch[1].trim());
            }
          }

          return { success: true, result: {
            file: filePath,
            totalLines: lines.length,
            showing: `${offset + 1}-${Math.min(offset + limit, lines.length)}`,
            summary: {
              uniqueComponents: [...new Set(elements)].slice(0, 50),
              testIds: testIds.slice(0, 30),
              tailwindClasses: [...classNames].slice(0, 40),
              eventHandlers: eventHandlers.slice(0, 20),
              conditionalRenders: conditionals.slice(0, 15),
              visibleText: textContent.slice(0, 20),
            },
            code: slice.map((l, i) => `${offset + i + 1}: ${l}`).join('\n').substring(0, 8000),
          }};
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "smoke_test": {
        const defaultEndpoints = [
          '/api/health',
          '/api/tasks',
          '/api/semesters',
          '/api/notepad-notes',
          '/api/sticky-notes',
          '/api/spotify/now-playing',
          '/api/theme',
          '/api/ui-settings',
          '/',
        ];
        const endpoints = (args.endpoints && args.endpoints.length > 0) ? args.endpoints : defaultEndpoints;
        const results: { endpoint: string; status: number | string; ok: boolean; time: number; preview?: string }[] = [];

        for (const ep of endpoints) {
          const start = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(`http://localhost:5000${ep}`, { signal: controller.signal });
            clearTimeout(timeout);
            const elapsed = Date.now() - start;
            let preview = '';
            const ct = resp.headers.get('content-type') || '';
            if (ct.includes('json')) {
              const json = await resp.json();
              preview = JSON.stringify(json).substring(0, 200);
            }
            results.push({ endpoint: ep, status: resp.status, ok: resp.ok, time: elapsed, preview });
          } catch (e: any) {
            results.push({ endpoint: ep, status: e.message?.substring(0, 100) || 'error', ok: false, time: Date.now() - start });
          }
        }

        const passed = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok).length;
        return { success: true, result: {
          summary: `${passed}/${results.length} endpoints passed${failed > 0 ? `, ${failed} FAILED` : ''}`,
          passed, failed, total: results.length,
          results,
        }};
      }

      case "run_node_script": {
        const script = args.script;
        if (!script || typeof script !== 'string') return { success: false, result: { error: "No script provided" } };
        if (script.length > 10000) return { success: false, result: { error: "Script too long (max 10000 chars)" } };

        const projectRoot = getProjectRoot();
        const scriptPath = path.join(projectRoot, '.ai-temp-script.mjs');
        try {
          await fs.writeFile(scriptPath, script, 'utf-8');
          const output = execSync(`node "${scriptPath}" 2>&1`, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 30000,
            maxBuffer: 2 * 1024 * 1024,
            env: { ...process.env, NODE_PATH: path.join(projectRoot, 'node_modules') },
          });
          await fs.unlink(scriptPath).catch(() => {});
          return { success: true, result: { output: output.substring(0, 8000) } };
        } catch (e: any) {
          await fs.unlink(scriptPath).catch(() => {});
          const output = (e.stdout || '') + '\n' + (e.stderr || '');
          return { success: false, result: { error: output.substring(0, 3000) } };
        }
      }

      case "check_performance": {
        const projectRoot = getProjectRoot();
        const results: Record<string, any> = {};
        try {
          const distPath = path.join(projectRoot, 'dist', 'public');
          try {
            const duOutput = execSync(`du -sh "${distPath}" 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 }).trim();
            results.bundleSize = duOutput;
            const jsFiles = execSync(`find "${distPath}" -name "*.js" -exec ls -lh {} \\; 2>/dev/null | head -10`, { encoding: 'utf-8', timeout: 5000 });
            results.jsFiles = jsFiles.trim();
            const cssFiles = execSync(`find "${distPath}" -name "*.css" -exec ls -lh {} \\; 2>/dev/null | head -5`, { encoding: 'utf-8', timeout: 5000 });
            results.cssFiles = cssFiles.trim();
          } catch { results.bundleSize = 'Build not found — run a build first'; }

          const memInfo = execSync('free -h 2>/dev/null | head -2 || echo "N/A"', { encoding: 'utf-8', timeout: 3000 }).trim();
          results.memory = memInfo;
          const loadAvg = execSync('cat /proc/loadavg 2>/dev/null || echo "N/A"', { encoding: 'utf-8', timeout: 3000 }).trim();
          results.loadAverage = loadAvg;
          const diskUsage = execSync('df -h . 2>/dev/null | tail -1 || echo "N/A"', { encoding: 'utf-8', timeout: 3000 }).trim();
          results.diskUsage = diskUsage;

          const testUrl = `http://localhost:5000${args.url || '/'}`;
          const loadStart = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(testUrl, { signal: controller.signal });
            clearTimeout(timeout);
            const body = await resp.text();
            results.pageLoad = {
              url: testUrl,
              status: resp.status,
              timeMs: Date.now() - loadStart,
              sizeBytes: body.length,
              sizeKb: Math.round(body.length / 1024),
            };
          } catch (e: any) {
            results.pageLoad = { url: testUrl, error: e.message?.substring(0, 200) };
          }

          return { success: true, result: results };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "conversation_history": {
        const projectRoot = getProjectRoot();
        const convDir = path.join(projectRoot, '.ai-conversations');
        try {
          const files = await fs.readdir(convDir);
          const daysBack = Math.min(args.days || 7, 30);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - daysBack);
          const cutoffStr = cutoff.toISOString().split('T')[0];

          const conversations: any[] = [];
          for (const file of files.sort().reverse()) {
            const dateStr = file.replace('.jsonl', '');
            if (dateStr < cutoffStr) continue;
            const content = await fs.readFile(path.join(convDir, file), 'utf-8');
            const entries = content.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            conversations.push({ date: dateStr, entryCount: entries.length, entries: entries.slice(-20) });
          }
          return { success: true, result: {
            daysRetrieved: daysBack,
            totalDays: conversations.length,
            conversations,
          }};
        } catch {
          return { success: true, result: { daysRetrieved: 0, conversations: [], note: "No conversation history yet." } };
        }
      }

      case "health_check": {
        const checks: Record<string, any> = {};

        const endpoints = ['/api/health', '/api/tasks', '/api/semesters', '/'];
        const endpointResults: { endpoint: string; ok: boolean; status: number | string; ms: number }[] = [];
        for (const ep of endpoints) {
          const start = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(`http://localhost:5000${ep}`, { signal: controller.signal });
            clearTimeout(timeout);
            endpointResults.push({ endpoint: ep, ok: resp.ok, status: resp.status, ms: Date.now() - start });
          } catch (e: any) {
            endpointResults.push({ endpoint: ep, ok: false, status: e.message?.substring(0, 80) || 'error', ms: Date.now() - start });
          }
        }
        checks.endpoints = endpointResults;
        checks.endpointsHealthy = endpointResults.every(r => r.ok);

        try {
          const dbResult = await db.execute('SELECT 1 as alive');
          checks.database = { connected: true };
        } catch (e: any) {
          checks.database = { connected: false, error: e.message?.substring(0, 200) };
        }

        try {
          const disk = execSync('df -h . 2>/dev/null | tail -1', { encoding: 'utf-8', timeout: 3000 }).trim();
          const parts = disk.split(/\s+/);
          checks.disk = { total: parts[1], used: parts[2], available: parts[3], usedPercent: parts[4] };
          const pct = parseInt(parts[4] || '0');
          checks.diskWarning = pct > 85 ? `Disk usage at ${parts[4]} — getting full!` : null;
        } catch { checks.disk = { error: 'Could not check' }; }

        try {
          const mem = execSync('free -h 2>/dev/null | head -2', { encoding: 'utf-8', timeout: 3000 }).trim();
          checks.memory = mem;
        } catch { checks.memory = 'N/A'; }

        try {
          const uptime = execSync('uptime 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim();
          checks.uptime = uptime;
        } catch { checks.uptime = 'N/A'; }

        const allOk = checks.endpointsHealthy && checks.database?.connected && !checks.diskWarning;
        checks.overallStatus = allOk ? 'HEALTHY' : 'ISSUES DETECTED';

        return { success: true, result: checks };
      }

      case "plan_task": {
        const plan = {
          objective: args.objective,
          steps: args.steps || [],
          risk_level: args.risk_level || 'medium',
          created: new Date().toISOString(),
          status: 'planned',
        };
        console.log(`[AI Plan] ${plan.objective} — ${plan.steps.length} steps (risk: ${plan.risk_level})`);
        return {
          success: true,
          result: {
            plan,
            instruction: "Plan created. Now execute each step in order. After each step, verify before moving to the next. If a step fails, diagnose and retry before continuing.",
          },
        };
      }

      case "codebase_explore": {
        const projectRoot = getProjectRoot();
        const results: Record<string, any> = {};
        const searches = (args.searches || []).slice(0, 5);
        const readSections = (args.read_sections || []).slice(0, 5);

        for (let i = 0; i < searches.length; i++) {
          const s = searches[i];
          try {
            const globArg = s.file_glob ? ` --include='${s.file_glob}'` : '';
            const grepResult = execSync(
              `grep -rn '${s.pattern.replace(/'/g, "'\\''")}' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.css'${globArg} . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v '.git/' | head -30`,
              { cwd: projectRoot, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }
            ).trim();
            const matches = grepResult.split('\n').filter(Boolean).map(line => {
              const parts = line.match(/^\.\/(.+?):(\d+):(.*)$/);
              return parts ? { file: parts[1], line: parseInt(parts[2]), content: parts[3].trim().substring(0, 200) } : { raw: line.substring(0, 200) };
            });
            results[`search_${i + 1}`] = { pattern: s.pattern, matches, count: matches.length };
          } catch {
            results[`search_${i + 1}`] = { pattern: s.pattern, matches: [], count: 0 };
          }
        }

        for (let i = 0; i < readSections.length; i++) {
          const r = readSections[i];
          try {
            const filePath = path.join(projectRoot, r.file);
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const offset = Math.max(0, (r.offset || 1) - 1);
            const limit = r.limit || 100;
            const section = lines.slice(offset, offset + limit);
            results[`file_${i + 1}`] = {
              file: r.file,
              fromLine: offset + 1,
              toLine: offset + section.length,
              totalLines: lines.length,
              content: section.map((l, idx) => `${offset + idx + 1}: ${l}`).join('\n').substring(0, 8000),
            };
          } catch (e: any) {
            results[`file_${i + 1}`] = { file: r.file, error: e.message?.substring(0, 200) };
          }
        }

        if (args.summary_question) {
          results.focus = args.summary_question;
        }

        return { success: true, result: results };
      }

      case "db_migrate": {
        const projectRoot = getProjectRoot();
        try {
          const forceFlag = args.force ? ' --force' : '';
          const output = execSync(`npx drizzle-kit push${forceFlag} 2>&1`, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 30000,
            maxBuffer: 2 * 1024 * 1024,
            env: { ...process.env },
          });
          return { success: true, result: { output: output.substring(0, 2000), migrated: true } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 500) } };
        }
      }

      case "github_file": {
        const repo = args.repo;
        const filePath = args.path;
        const branch = args.branch || 'main';
        const maxLength = args.max_length || 8000;
        try {
          const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(rawUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'BrynAssist/1.0' },
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            if (resp.status === 404) {
              const altBranch = branch === 'main' ? 'master' : 'main';
              const altUrl = `https://raw.githubusercontent.com/${repo}/${altBranch}/${filePath}`;
              const ctrl2 = new AbortController();
              const t2 = setTimeout(() => ctrl2.abort(), 10000);
              const resp2 = await fetch(altUrl, { signal: ctrl2.signal, headers: { 'User-Agent': 'BrynAssist/1.0' } });
              clearTimeout(t2);
              if (!resp2.ok) return { success: false, result: { error: `File not found: ${repo}/${filePath} (tried ${branch} and ${altBranch} branches)` } };
              let content = await resp2.text();
              if (content.length > maxLength) content = content.substring(0, maxLength) + '\n... [truncated]';
              return { success: true, result: { repo, path: filePath, branch: altBranch, length: content.length, content } };
            }
            return { success: false, result: { error: `HTTP ${resp.status}: ${resp.statusText}` } };
          }
          let content = await resp.text();
          if (content.length > maxLength) content = content.substring(0, maxLength) + '\n... [truncated]';
          return { success: true, result: { repo, path: filePath, branch, length: content.length, content } };
        } catch (e: any) {
          return { success: false, result: { error: `Failed to fetch file: ${e.message?.substring(0, 200)}` } };
        }
      }

      case "npm_info": {
        const pkgName = args.package_name;
        try {
          const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(registryUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
          });
          clearTimeout(timeout);
          if (!resp.ok) return { success: false, result: { error: `Package not found: ${pkgName}` } };
          const data = await resp.json() as any;
          const latest = data['dist-tags']?.latest;
          const latestVersion = latest ? data.versions?.[latest] : null;
          const result: Record<string, any> = {
            name: data.name,
            description: data.description,
            latestVersion: latest,
            license: data.license,
            homepage: data.homepage || latestVersion?.homepage,
            repository: typeof data.repository === 'string' ? data.repository : data.repository?.url,
            keywords: (data.keywords || []).slice(0, 10),
          };
          if (latestVersion) {
            result.dependencies = Object.keys(latestVersion.dependencies || {}).slice(0, 20);
            result.peerDependencies = Object.keys(latestVersion.peerDependencies || {}).slice(0, 10);
          }
          const readme = data.readme || '';
          if (readme) {
            result.readmeExcerpt = readme.substring(0, 3000) + (readme.length > 3000 ? '\n... [truncated — use web_fetch on homepage for full docs]' : '');
          }
          return { success: true, result };
        } catch (e: any) {
          return { success: false, result: { error: `npm lookup failed: ${e.message?.substring(0, 200)}` } };
        }
      }

      case "ai_subtask": {
        const task = args.task;
        const input = args.input || '';
        const model = args.model || 'gpt-4.1-mini';
        const maxTokens = Math.min(args.max_tokens || 2000, 4000);
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const subtaskPrompt = input
            ? `${task}\n\nInput:\n${input.substring(0, 10000)}`
            : task;
          const completion = await openai.chat.completions.create({
            model,
            messages: [
              { role: "system", content: "You are a helpful coding assistant. Be concise, precise, and output-focused. Return code or analysis directly without preamble." },
              { role: "user", content: subtaskPrompt },
            ],
            max_completion_tokens: maxTokens,
          });
          const reply = completion.choices[0]?.message?.content || '';
          const usage = completion.usage;
          return {
            success: true,
            result: {
              model,
              response: reply,
              tokens: { prompt: usage?.prompt_tokens, completion: usage?.completion_tokens, total: usage?.total_tokens },
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `AI subtask failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "code_reference": {
        const topic = (args.topic || '').toLowerCase();
        const context = args.context || '';
        const knowledgeBase: Record<string, { summary: string; patterns: string[]; tips: string[] }> = {
          'drizzle': {
            summary: 'Drizzle ORM — type-safe SQL toolkit for TypeScript. This project uses PostgreSQL with drizzle-orm and drizzle-kit.',
            patterns: [
              "Schema: pgTable('name', { id: serial('id').primaryKey(), title: text('title').notNull() })",
              "Array columns: text('tags').array() — call .array() as method, not wrapper",
              "Insert schema: createInsertSchema(table).omit({ id: true, createdAt: true })",
              "Select type: typeof table.$inferSelect",
              "Query: db.select().from(table).where(eq(table.id, id))",
              "Insert: db.insert(table).values({ title: 'test' }).returning()",
              "Update: db.update(table).set({ title: 'new' }).where(eq(table.id, id))",
              "Delete: db.delete(table).where(eq(table.id, id))",
              "Relations: relations(table, ({ one, many }) => ({ author: one(users, { fields: [table.authorId], references: [users.id] }) }))",
              "Migration: npx drizzle-kit push (use db_migrate tool)",
              "JSON column: jsonb('data').$type<MyType>()",
              "Timestamp: timestamp('created_at').defaultNow()",
              "Enum: pgEnum('status', ['active', 'inactive'])",
            ],
            tips: [
              'Always use .array() as a method call, never as wrapper: text().array() NOT array(text())',
              'Use createInsertSchema from drizzle-zod for validation',
              'After schema changes, run db_migrate to push to DB',
              'Use .returning() on insert/update to get the created/updated row back',
            ],
          },
          'tanstack': {
            summary: 'TanStack Query v5 — data fetching/caching for React. Object-form only for all hooks.',
            patterns: [
              "Query: useQuery({ queryKey: ['/api/tasks'], queryFn: undefined }) — default fetcher is pre-configured",
              "Typed query: useQuery<Task[]>({ queryKey: ['/api/tasks'] })",
              "Variable key: useQuery({ queryKey: ['/api/tasks', id] }) — use array segments for cache invalidation",
              "Mutation: useMutation({ mutationFn: (data) => apiRequest('POST', '/api/tasks', data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tasks'] }) })",
              "Loading state: if (query.isLoading) return <Skeleton />",
              "Error state: if (query.error) return <Error />",
              "Invalidate: queryClient.invalidateQueries({ queryKey: ['/api/tasks'] })",
              "Prefetch: queryClient.prefetchQuery({ queryKey: ['/api/tasks'] })",
            ],
            tips: [
              'NEVER use string template queryKeys like [`/api/tasks/${id}`] — use array: ["/api/tasks", id]',
              'Queries dont need queryFn — default fetcher handles it',
              'Always invalidate cache after mutations',
              'Use isPending for mutation loading state, isLoading for query loading state',
              'Import apiRequest from @lib/queryClient for POST/PATCH/DELETE',
            ],
          },
          'react': {
            summary: 'React 18 with TypeScript, Vite, no explicit React import needed.',
            patterns: [
              "State: const [value, setValue] = useState<Type>(initial)",
              "Effect: useEffect(() => { /* setup */ return () => { /* cleanup */ } }, [deps])",
              "Ref: const ref = useRef<HTMLDivElement>(null)",
              "Memo: const computed = useMemo(() => expensive(a, b), [a, b])",
              "Callback: const handler = useCallback((e) => { }, [deps])",
              "Context: const ctx = useContext(MyContext)",
              "Portal: createPortal(<Component />, document.body)",
              "Lazy: const Page = lazy(() => import('./pages/Page'))",
            ],
            tips: [
              'Do NOT import React — Vite JSX transform does it automatically',
              'Use import.meta.env.VITE_* for frontend env vars (not process.env)',
              'Always add data-testid to interactive and display elements',
            ],
          },
          'shadcn': {
            summary: 'shadcn/ui — Radix-based component library with Tailwind styling.',
            patterns: [
              "Import: import { Button } from '@/components/ui/button'",
              "Form: import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form'",
              "Dialog: <Dialog open={open} onOpenChange={setOpen}><DialogTrigger><DialogContent><DialogTitle>",
              "Select: <Select><SelectTrigger><SelectValue /><SelectContent><SelectItem value='opt1'>Option</SelectItem>",
              "Toast: const { toast } = useToast() — import from '@/hooks/use-toast'",
              "Form hook: const form = useForm({ resolver: zodResolver(schema), defaultValues: {} })",
            ],
            tips: [
              'useToast is from @/hooks/use-toast NOT from shadcn',
              'SelectItem MUST have a value prop or it throws',
              'Always provide defaultValues to useForm',
              'Use zodResolver from @hookform/resolvers/zod',
            ],
          },
          'express': {
            summary: 'Express v5 backend with TypeScript.',
            patterns: [
              "Route: app.get('/api/items', async (req, res) => { const items = await storage.getItems(); res.json(items); })",
              "POST: app.post('/api/items', async (req, res) => { const parsed = insertSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json(parsed.error); const item = await storage.createItem(parsed.data); res.json(item); })",
              "Middleware: app.use((req, res, next) => { /* logic */ next(); })",
              "Error handling: app.use((err, req, res, next) => { res.status(500).json({ error: err.message }); })",
            ],
            tips: [
              'Always validate request body with Zod before passing to storage',
              'Keep routes thin — business logic goes in storage interface',
              'Use try/catch in async route handlers',
            ],
          },
          'tailwind': {
            summary: 'Tailwind CSS with custom properties for theming.',
            patterns: [
              "Custom color: --my-var: 23 10% 23% (HSL space-separated, no hsl() wrapper)",
              "Dark mode: className='bg-white dark:bg-gray-900 text-black dark:text-white'",
              "Responsive: className='w-full md:w-1/2 lg:w-1/3'",
              "Animation: className='transition-all duration-300 ease-in-out'",
              "Glass: className='backdrop-blur-md bg-white/10 border border-white/20'",
              "Grid: className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'",
            ],
            tips: [
              'Custom properties in index.css must use H S% L% format (space-separated with %)',
              'darkMode: ["class"] in tailwind.config.ts',
              'Always use explicit dark: variants for visual properties when not using utility classes',
            ],
          },
          'wouter': {
            summary: 'Wouter — lightweight React router.',
            patterns: [
              "Route: <Route path='/page' component={Page} />",
              "Link: <Link href='/page'>Go</Link>",
              "Hook: const [location, setLocation] = useLocation()",
              "Params: <Route path='/items/:id'>{(params) => <Item id={params.id} />}</Route>",
              "Navigate: setLocation('/page')",
            ],
            tips: ['Use Link component or useLocation, never modify window.location directly'],
          },
          'zod': {
            summary: 'Zod — TypeScript-first schema validation.',
            patterns: [
              "Schema: const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() })",
              "Optional: z.string().optional()",
              "Enum: z.enum(['a', 'b', 'c'])",
              "Array: z.array(z.string())",
              "Extend: insertSchema.extend({ confirmPassword: z.string() })",
              "Parse: const result = schema.safeParse(data); if (!result.success) handleErrors(result.error)",
              "Infer type: type MyType = z.infer<typeof schema>",
            ],
            tips: ['Use .safeParse() instead of .parse() to avoid throwing', 'Use createInsertSchema from drizzle-zod for DB schemas'],
          },
          'framer': {
            summary: 'Framer Motion — animation library for React.',
            patterns: [
              "Animate: <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>",
              "Transition: transition={{ duration: 0.3, ease: 'easeInOut' }}",
              "Variants: const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }",
              "Gesture: <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>",
              "AnimatePresence: <AnimatePresence>{show && <motion.div key='modal' exit={{ opacity: 0 }}>}</AnimatePresence>",
              "Layout: <motion.div layout> — auto-animates layout changes",
            ],
            tips: ['Always wrap conditional renders in AnimatePresence for exit animations', 'Use layout prop for smooth reflow animations'],
          },
          'postgres': {
            summary: 'PostgreSQL database accessed via Drizzle ORM.',
            patterns: [
              "Raw SQL: db.execute('SELECT * FROM tasks WHERE id = $1', [id])",
              "JSON query: SELECT data->>'name' FROM items WHERE data->>'type' = 'book'",
              "Array contains: WHERE 'tag' = ANY(tags)",
              "Date range: WHERE due_date BETWEEN $1 AND $2",
              "Upsert: INSERT INTO ... ON CONFLICT (id) DO UPDATE SET ...",
              "Count: SELECT COUNT(*) FROM tasks WHERE is_completed = false",
            ],
            tips: ['Use parameterized queries ($1, $2) to prevent SQL injection', 'Use run_sql tool for quick queries, db_schema to see structure'],
          },
        };

        const matches: { topic: string; data: typeof knowledgeBase[string] }[] = [];
        for (const [key, data] of Object.entries(knowledgeBase)) {
          if (topic.includes(key) || key.includes(topic.split(' ')[0])) {
            matches.push({ topic: key, data });
          }
        }

        const topicWords = topic.split(/\s+/);
        if (matches.length === 0) {
          for (const [key, data] of Object.entries(knowledgeBase)) {
            const allText = (data.summary + ' ' + data.patterns.join(' ') + ' ' + data.tips.join(' ')).toLowerCase();
            if (topicWords.some(w => allText.includes(w))) {
              matches.push({ topic: key, data });
            }
          }
        }

        if (matches.length === 0) {
          return { success: true, result: { found: false, suggestion: `No built-in reference for "${topic}". Try web_search or github_search for external examples.`, availableTopics: Object.keys(knowledgeBase) } };
        }

        return { success: true, result: { found: true, references: matches.map(m => ({ topic: m.topic, ...m.data })), tip: context ? `For your goal (${context}), focus on the patterns most relevant to your use case.` : undefined } };
      }

      case "github_search": {
        const query = args.query;
        const language = args.language || 'typescript';
        const numResults = Math.min(args.num_results || 5, 10);
        try {
          const searchUrl = `https://github.com/search?q=${encodeURIComponent(query)}+language:${language}&type=code`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
            },
          });
          clearTimeout(timeout);
          const html = await resp.text();

          const results: { repo: string; file: string; snippet: string; url: string }[] = [];
          const codeBlocks = html.split(/data-testid="results-list"/).slice(1);
          const itemPattern = /href="\/([^"]+\/blob\/[^"]+)"[^>]*>[\s\S]*?<td[^>]*class="[^"]*blob-code[^"]*"[^>]*>([\s\S]*?)<\/td>/g;
          let match;
          const searchHtml = codeBlocks[0] || html;
          const repoPattern = /href="\/([^"]+?)\/blob\/([^"]+?)"[^>]*>/g;
          let repoMatch;
          while ((repoMatch = repoPattern.exec(searchHtml)) !== null && results.length < numResults) {
            const fullPath = repoMatch[1];
            const filePath = repoMatch[2];
            const repoParts = fullPath.split('/');
            const repo = repoParts.slice(0, 2).join('/');
            results.push({
              repo,
              file: filePath,
              snippet: '',
              url: `https://github.com/${fullPath}/blob/${filePath}`,
            });
          }

          if (results.length === 0) {
            const fallbackUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:github.com ${query} ${language}`)}`;
            const ctrl2 = new AbortController();
            const t2 = setTimeout(() => ctrl2.abort(), 10000);
            const resp2 = await fetch(fallbackUrl, { signal: ctrl2.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
            clearTimeout(t2);
            const html2 = await resp2.text();
            const linkPattern = /class="result__a"[^>]*href="([^"]*github\.com[^"]*)"[^>]*>([^<]*)/g;
            let linkMatch;
            while ((linkMatch = linkPattern.exec(html2)) !== null && results.length < numResults) {
              let url = linkMatch[1];
              if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
                try { url = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || url); } catch {}
              }
              results.push({ repo: '', file: '', snippet: linkMatch[2].trim(), url });
            }
          }

          return { success: true, result: { query, language, results, count: results.length, tip: results.length > 0 ? 'Use web_fetch on a result URL to read the full file content.' : 'No results found. Try broadening your search terms.' } };
        } catch (e: any) {
          const fallbackUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:github.com ${query} ${language}`)}`;
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 10000);
            const resp = await fetch(fallbackUrl, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
            clearTimeout(t);
            const html = await resp.text();
            const results: { repo: string; file: string; snippet: string; url: string }[] = [];
            const linkPattern = /class="result__a"[^>]*href="([^"]*github\.com[^"]*)"[^>]*>([^<]*)/g;
            let linkMatch;
            while ((linkMatch = linkPattern.exec(html)) !== null && results.length < numResults) {
              let url = linkMatch[1];
              if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
                try { url = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || url); } catch {}
              }
              results.push({ repo: '', file: '', snippet: linkMatch[2].trim(), url });
            }
            return { success: true, result: { query, language, results, count: results.length, fallback: true } };
          } catch (e2: any) {
            return { success: false, result: { error: `GitHub search failed: ${e.message?.substring(0, 200)}. Fallback also failed.` } };
          }
        }
      }

      case "web_search": {
        const query = args.query;
        const numResults = Math.min(args.num_results || 5, 10);
        try {
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          clearTimeout(timeout);
          const html = await resp.text();
          const results: { title: string; url: string; snippet: string }[] = [];
          const resultBlocks = html.split(/class="result__body"/g).slice(1, numResults + 1);
          for (const block of resultBlocks) {
            const titleMatch = block.match(/class="result__a"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/);
            const urlMatch = block.match(/class="result__url"[^>]*href="([^"]*)"/) || block.match(/class="result__a"[^>]*href="([^"]*)"/);
            const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/td>/) || block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/span>/);
            const title = (titleMatch?.[1] || '').replace(/<[^>]*>/g, '').trim();
            let url = (urlMatch?.[1] || '').trim();
            if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
              try { url = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || url); } catch {}
            }
            const snippet = (snippetMatch?.[1] || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
            if (title && url) {
              results.push({ title, url, snippet });
            }
          }
          if (results.length === 0) {
            const fallbackTitles = [...html.matchAll(/class="result__a"[^>]*>([^<]+)<\/a>/g)].slice(0, numResults);
            const fallbackUrls = [...html.matchAll(/class="result__a"[^>]*href="([^"]*)"/g)].slice(0, numResults);
            for (let i = 0; i < Math.min(fallbackTitles.length, fallbackUrls.length); i++) {
              let fUrl = fallbackUrls[i][1].trim();
              if (fUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
                try { fUrl = decodeURIComponent(fUrl.split('uddg=')[1]?.split('&')[0] || fUrl); } catch {}
              }
              results.push({ title: fallbackTitles[i][1].trim(), url: fUrl, snippet: '' });
            }
          }
          return { success: true, result: { query, results, count: results.length } };
        } catch (e: any) {
          return { success: false, result: { error: `Web search failed: ${e.message?.substring(0, 200)}` } };
        }
      }

      case "web_fetch": {
        const url = args.url;
        const maxLength = args.max_length || 5000;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            return { success: false, result: { error: `HTTP ${resp.status}: ${resp.statusText}` } };
          }
          const html = await resp.text();
          let text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
          if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '... [truncated]';
          }
          return { success: true, result: { url, length: text.length, content: text } };
        } catch (e: any) {
          return { success: false, result: { error: `Fetch failed: ${e.message?.substring(0, 200)}` } };
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
  const todayStr = now.toISOString().split('T')[0];
  const settings = await storage.getActiveSemesterSettings();

  let context = `Current date/time (Eastern): ${now.toLocaleString('en-US', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}\nCurrent semester week: ${currentWeek}\nToday: ${todayStr} (${now.toLocaleDateString('en-US', { timeZone: 'America/Toronto', weekday: 'long' })})\n`;

  if (settings) {
    context += `\nActive semester: ${settings.semesterName}\n`;
    context += `Semester start: ${settings.semesterStartDate?.toISOString().split('T')[0]}\n`;
    if (settings.semesterEndDate) context += `Semester end: ${settings.semesterEndDate.toISOString().split('T')[0]}\n`;
    if ((settings as any).readingWeekStart) context += `Reading week: ${(settings as any).readingWeekStart} to ${(settings as any).readingWeekEnd || '?'}\n`;
    if ((settings as any).examPeriodStart) context += `Exam period: ${(settings as any).examPeriodStart} to ${(settings as any).examPeriodEnd || '?'}\n`;
    const courses: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const code = (settings as any)[`course${i}Code`];
      const name = (settings as any)[`course${i}Name`];
      if (code) { context += `Course ${i}: ${code} — ${name}\n`; courses.push(code); }
    }
  }

  const allTasks = await storage.getTasks({ showCompleted: false });
  const allIncomplete = allTasks.filter(t => !t.isCompleted);

  const overdue = allIncomplete.filter(t => {
    const due = new Date(t.dueDate);
    return due < now && due.toISOString().split('T')[0] !== todayStr;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const dueToday = allIncomplete.filter(t => new Date(t.dueDate).toISOString().split('T')[0] === todayStr);

  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dueTomorrow = allIncomplete.filter(t => new Date(t.dueDate).toISOString().split('T')[0] === tomorrowStr);

  const thisWeek = allIncomplete.filter(t => t.weekNumber === currentWeek).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const nextWeek = allIncomplete.filter(t => t.weekNumber === currentWeek + 1).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (overdue.length > 0) {
    context += `\n⚠️ OVERDUE (${overdue.length}):\n`;
    for (const t of overdue.slice(0, 8)) {
      const daysLate = Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86400000);
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) was due ${new Date(t.dueDate).toISOString().split('T')[0]} (${daysLate}d late) priority:${t.priority}\n`;
    }
  }

  if (dueToday.length > 0) {
    context += `\n🔴 DUE TODAY (${dueToday.length}):\n`;
    for (const t of dueToday) {
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) priority:${t.priority}\n`;
    }
  } else {
    context += `\nNothing due today.\n`;
  }

  if (dueTomorrow.length > 0) {
    context += `\nDue tomorrow (${dueTomorrow.length}):\n`;
    for (const t of dueTomorrow) {
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) priority:${t.priority}\n`;
    }
  }

  if (thisWeek.length > 0) {
    context += `\nThis week — week ${currentWeek} (${thisWeek.length} tasks):\n`;
    for (const t of thisWeek.slice(0, 12)) {
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) due ${new Date(t.dueDate).toISOString().split('T')[0]} priority:${t.priority}\n`;
    }
  }

  if (nextWeek.length > 0) {
    context += `\nNext week — week ${currentWeek + 1} (${nextWeek.length} tasks):\n`;
    for (const t of nextWeek.slice(0, 6)) {
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) due ${new Date(t.dueDate).toISOString().split('T')[0]}\n`;
    }
  }

  const totalActive = allIncomplete.length;
  const completedTasks = allTasks.filter(t => t.isCompleted);
  context += `\nTask stats: ${totalActive} active, ${completedTasks.length} completed, ${overdue.length} overdue\n`;

  const courseCounts: Record<string, number> = {};
  for (const t of allIncomplete) {
    if (t.courseName) courseCounts[t.courseName] = (courseCounts[t.courseName] || 0) + 1;
  }
  if (Object.keys(courseCounts).length > 0) {
    context += `Tasks by course: ${Object.entries(courseCounts).map(([c, n]) => `${c}(${n})`).join(', ')}\n`;
  }

  context += `\nKnown HA entities (use ha_list_entities for full discovery):\n`;
  context += `  Speakers: media_player.byhome (everywhere), media_player.kitchen_media_group, media_player.king_bedroom_media_group, media_player.queen_bedroom_media_group, media_player.cat_washroom_media_group\n`;
  context += `  Echos: media_player.echo_kitchen_studio_black_am (kitchen), media_player.echo_king_l_am, media_player.echo_king_r_am, media_player.echo_queen_bed_l_am\n`;
  context += `  Nest: media_player.bathroom_speaker\n`;
  context += `  Lights: light.cat_lights\n`;
  context += `  TVs: media_player.tv_living_room_70, media_player.tv_king, media_player.tv_kitchen, media_player.tv_cat_wr\n`;
  context += `  Spotify: media_player.spotifyplus_byhomeyyz\n`;
  context += `  Fire TV: media_player.fire_tv_172_24_0_88 (ADB control)\n`;

  return context;
}
