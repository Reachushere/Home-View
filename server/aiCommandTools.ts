import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { notepadNotes, getWeekNumber, COURSES } from "@shared/schema";
import { easternNow, easternDateStr } from "./timezone";
import * as spotifyApi from "./spotify";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { execSync } from "child_process";

import WebSocket from 'ws';

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || process.env.HOME_ASSISTANT_URL || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnvAi = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnvAi = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnvAi.startsWith("eyJ") ? tokenFromEnvAi : (urlFromEnvAi.startsWith("eyJ") ? urlFromEnvAi : tokenFromEnvAi);

function haWebSocket(msgType: string, msgData?: Record<string, any>, timeoutMs = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    const wsUrl = HOME_ASSISTANT_URL.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/websocket';
    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const timer = setTimeout(() => { ws.close(); reject(new Error('HA WebSocket timeout')); }, timeoutMs);

    ws.on('open', () => {});
    ws.on('message', (raw: WebSocket.Data) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: HOME_ASSISTANT_TOKEN }));
      } else if (msg.type === 'auth_ok') {
        ws.send(JSON.stringify({ id: msgId, type: msgType, ...msgData }));
      } else if (msg.type === 'auth_invalid') {
        clearTimeout(timer); ws.close(); reject(new Error('HA auth invalid'));
      } else if (msg.type === 'result') {
        clearTimeout(timer); ws.close();
        if (msg.success) resolve(msg.result);
        else reject(new Error(msg.error?.message || 'HA WebSocket error'));
      }
    });
    ws.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
  });
}

async function openaiRetryUtil<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseFloat(err?.headers?.['retry-after'] || '0');
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * (attempt + 1), 10000);
        console.log(`[AI Tools] Rate limited (429), retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('openaiRetryUtil exhausted');
}

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
      name: "append_temporary_notes",
      description: "Append text to Bryn's Temporary Notes box (the white scratchpad that appears where the homework box minimizes to). Use whenever Bryn says 'add to notes', 'put on notes', 'jot this down', 'write this in my notes', or similar. The text is appended on a new line with a timestamp prefix and is immediately visible on every device (laptop, phone, Pi) the next time the notes box is opened or focused. This is NOT the same as create_notepad_note (which creates separate notepad cards) — use this tool, not that one, for quick scratchpad capture.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Plain-text content to append. Newlines preserved. Do not include HTML." },
          prefix_timestamp: { type: "boolean", description: "Whether to prefix with a [HH:MM] timestamp. Default true." },
        },
        required: ["content"],
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
      name: "ha_list_dashboards",
      description: "List all available Home Assistant Lovelace dashboards. Returns each dashboard's url_path (the value to pass as 'dashboard' to ha_dashboard_read/write), title, and mode. Use this FIRST if you're unsure which dashboard to target.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_dashboard_read",
      description: "Read the current Home Assistant Lovelace dashboard configuration. Returns the full YAML/JSON config of dashboard cards, views, and layout. Use to understand the current dashboard before making changes. IMPORTANT: For custom dashboards, pass the url_path from ha_list_dashboards (e.g. 'test-home'). The 'lovelace-' prefix in the browser URL is automatic — do NOT include it.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path from ha_list_dashboards (e.g. 'test-home', NOT 'lovelace-test-home'). Omit or use 'lovelace' for the default dashboard." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_dashboard_write",
      description: "Update the Home Assistant Lovelace dashboard configuration. ALWAYS read the current config first with ha_dashboard_read, modify it, then write it back. Be careful — this overwrites the entire dashboard config. IMPORTANT: For custom dashboards, pass the url_path from ha_list_dashboards (e.g. 'test-home'). The 'lovelace-' prefix in the browser URL is automatic — do NOT include it.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path from ha_list_dashboards (e.g. 'test-home'). Default: 'lovelace'." },
          config: { type: "object", description: "The full Lovelace config object to write. Must include 'views' array with all views/cards." },
        },
        required: ["config"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_view_read",
      description: "Read a SINGLE view/tab from a Home Assistant dashboard. Much more efficient than ha_dashboard_read for large dashboards like 'lovelace' (which has 11 views). Returns only the specified view's config (cards, elements, etc). Use view_index or view_title to identify the view. 'Test-home' is view 0 of the default lovelace dashboard.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path. Omit or 'lovelace' for the default dashboard." },
          view_index: { type: "number", description: "Zero-based view index (e.g. 0 for the first tab). Use this OR view_title." },
          view_title: { type: "string", description: "View title to search for (case-insensitive, e.g. 'Test-home'). Use this OR view_index." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_view_write",
      description: "DESTRUCTIVE: Replaces an entire view/tab. AVOID for any view with more than ~10 elements — it will drop items because the LLM can't echo back many nested elements perfectly. Use ha_element_patch instead for single-element edits (state_image, image, style, tap_action, etc). Use ha_view_write ONLY for creating NEW views from scratch or replacing truly small views. Will REFUSE large overwrites unless force=true.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path. Omit or 'lovelace' for the default dashboard." },
          view_index: { type: "number", description: "Zero-based view index. Use this OR view_title." },
          view_title: { type: "string", description: "View title to find (case-insensitive). Use this OR view_index." },
          view_config: { type: "object", description: "The complete view object to replace the existing view with. Must include title, cards/elements, etc." },
          force: { type: "boolean", description: "Set true to bypass safety guardrails that prevent accidental element deletion. Only use if you have the FULL current view with every nested element." },
        },
        required: ["view_config"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_element_patch",
      description: "Surgically MODIFY ONE EXISTING element inside a view's cards/elements tree. ONLY edits keys on an element that is already there (entity, image, state_image, style.left/top/width, tap_action, etc.). \n\n**CANNOT add a new element.** If you need a NEW button, NEW countdown card, NEW image, or any sibling that doesn't already exist, you MUST use `ha_element_add` instead — `_patch` will silently mutate the wrong element or fail.\n\n**CANNOT remove an element.** Use `ha_element_remove` for that.\n\nTypical valid uses: change an entity from `timer.bryn_meds` to `timer.rascal_meds_timer`, move a button by patching its `style: { left, top }`, swap a `state_image.idle` gif, replace a `tap_action`. Finds target by `match_entity` (recursive) or `match_index_path` (literal walk). Shallow-merges `patch` onto the target.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path. Omit or 'lovelace' for the default dashboard." },
          view_index: { type: "number", description: "Zero-based view index (e.g. 0 for Test-home). Use this OR view_title." },
          view_title: { type: "string", description: "View title (case-insensitive). Use this OR view_index." },
          match_entity: { type: "string", description: "Find the element whose 'entity' property equals this value (e.g. 'timer.bryn_meds'). Searches recursively through cards/elements." },
          match_index_path: { type: "array", items: { type: "number" }, description: "Alternative to match_entity: array of indices to walk into the view tree, e.g. [0,5] means view.cards[0].elements[5]." },
          patch: { type: "object", description: "Object of properties to set on the matched element (shallow merge). E.g. { state_image: { idle: '/local/x.gif' } } or { style: { left: '50%' } }." },
          remove_keys: { type: "array", items: { type: "string" }, description: "Optional list of property names to delete from the matched element before applying patch." },
        },
        required: ["patch"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_element_add",
      description: "**THE ONLY way to ADD a new element** (button, image, countdown card, state-icon, custom:button-card, etc.) to a picture-elements card or any card with an 'elements'/'cards'/'children' array. Does NOT echo back existing siblings — server reads the view, locates the target card, pushes your element, writes back. Cannot drop other elements.\n\nUse this whenever the user asks to ADD / COPY / DUPLICATE / PLACE a new tile or countdown — even if you're modeling it after another existing element. To copy an element, first read it with `ha_lovelace_dashboard_get` (or recall its shape), then call `ha_element_add` with the full element object as `element`. Set `dedupe_by_entity: true` to make re-runs idempotent.\n\nExample for adding a Rascal meds countdown styled like the Yasu one: `element: { type: 'custom:button-card', entity: 'timer.rascal_meds_timer', show_state: true, show_name: false, show_icon: false, style: { left: '55%', top: '48%', width: '11%' }, tap_action: { action: 'call-service', service: 'script.rascal_meds_timer_reset_script' }, card_mod: { style: 'ha-card { background: transparent; border: none; color: white; font-size: 190px; font-weight: 800; font-family: Pathway Gothic One; }' } }`",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path. Omit or 'lovelace' for default." },
          view_index: { type: "number", description: "Zero-based view index. Use this OR view_title." },
          view_title: { type: "string", description: "View title (case-insensitive)." },
          card_index_path: { type: "array", items: { type: "number" }, description: "Optional path of card indices. Default [0] means view.cards[0]." },
          container_key: { type: "string", enum: ["elements", "cards", "children"], description: "Which array on the target card to push into. Default 'elements'." },
          element: { type: "object", description: "The new element object to append. e.g. { type: 'state-icon', entity: 'timer.x', icon: 'mdi:cat', tap_action: {...}, style: {...} }" },
          dedupe_by_entity: { type: "boolean", description: "If true and the element has an 'entity', remove any existing siblings with the same entity first (idempotent re-runs)." },
        },
        required: ["element"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_element_remove",
      description: "Remove a specific element from a card's elements/cards/children array WITHOUT touching siblings. Safe surgical delete — cannot drop other elements. Match by entity OR by index path.",
      parameters: {
        type: "object",
        properties: {
          dashboard: { type: "string", description: "Dashboard url_path. Omit or 'lovelace' for default." },
          view_index: { type: "number", description: "Zero-based view index." },
          view_title: { type: "string", description: "View title (case-insensitive)." },
          match_entity: { type: "string", description: "Remove the element whose 'entity' equals this value (e.g. 'timer.bryn_meds'). First match in tree." },
          match_index_path: { type: "array", items: { type: "number" }, description: "Alternative: array of indices to walk to the element to remove." },
          remove_all_matching: { type: "boolean", description: "If true with match_entity, removes ALL siblings with that entity (default: only first)." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_automation_clone",
      description: "Clone an existing automation by its unique id, optionally rename and patch specific top-level fields (e.g. add an Alexa announcement to the actions). Much safer than rewriting the YAML by hand. The server fetches the source automation, applies the patch (deep-merge for objects, replace for arrays you explicitly provide), assigns a new id, and saves it.",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", description: "Unique automation id of the source (NOT the entity_id). Get from ha_config_entries GET /api/config/automation/config or HA UI URL." },
          new_alias: { type: "string", description: "Display name for the cloned automation. Required." },
          patch: { type: "object", description: "Object of top-level keys to override on the clone, e.g. { action: [...] } to replace actions, or { mode: 'restart' }. Arrays REPLACE, objects shallow-merge." },
        },
        required: ["source_id", "new_alias"],
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
      name: "ha_create_helper",
      description: "Create a Home Assistant helper entity (timer, input_boolean, input_number, input_text, input_select, counter, input_datetime) via WebSocket. Use this to create new helper entities that don't exist yet.",
      parameters: {
        type: "object",
        properties: {
          helper_type: { type: "string", enum: ["timer", "input_boolean", "input_number", "input_text", "input_select", "counter", "input_datetime"], description: "Type of helper to create" },
          name: { type: "string", description: "Display name for the helper, e.g. 'Meds Timer Rascal'" },
          icon: { type: "string", description: "MDI icon, e.g. 'mdi:cat', 'mdi:pill'. Optional." },
          duration: { type: "string", description: "For timer type only: duration in HH:MM:SS format, e.g. '12:00:00'" },
          options: { type: "array", items: { type: "string" }, description: "For input_select only: list of options" },
          min_value: { type: "number", description: "For input_number only: minimum value" },
          max_value: { type: "number", description: "For input_number only: maximum value" },
        },
        required: ["helper_type", "name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_create_automation",
      description: "Create a new Home Assistant automation via REST API. HA 2026.x uses PLURAL keys: triggers, conditions, actions. You may pass either singular or plural; this tool normalizes to plural before sending.",
      parameters: {
        type: "object",
        properties: {
          alias: { type: "string", description: "Name/alias for the automation" },
          description: { type: "string", description: "Description of what it does" },
          triggers: { type: "array", items: { type: "object" }, description: "Array of trigger objects (HA 2026.x plural form)" },
          trigger: { type: "array", items: { type: "object" }, description: "Legacy singular alias for triggers (auto-normalized)" },
          conditions: { type: "array", items: { type: "object" }, description: "Array of condition objects (optional, plural)" },
          condition: { type: "array", items: { type: "object" }, description: "Legacy singular alias for conditions (auto-normalized)" },
          actions: { type: "array", items: { type: "object" }, description: "Array of action objects (HA 2026.x plural form)" },
          action: { type: "array", items: { type: "object" }, description: "Legacy singular alias for actions (auto-normalized)" },
          mode: { type: "string", enum: ["single", "restart", "queued", "parallel"], description: "Automation mode. Default 'single'" },
        },
        required: ["alias"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_automation_list",
      description: "List all automations with their entity_id, unique_id, alias, last_triggered, and enabled state.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_automation_get",
      description: "Get the full YAML config of a single automation by its unique id (NOT entity_id). Use ha_automation_list to find ids.",
      parameters: { type: "object", properties: { automation_id: { type: "string", description: "Unique automation id." } }, required: ["automation_id"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_automation_update",
      description: "Update (overwrite) an existing automation's full config by its unique id. ALWAYS read first with ha_automation_get, then send the modified full config back.",
      parameters: {
        type: "object",
        properties: {
          automation_id: { type: "string", description: "Unique id of the automation to update." },
          config: { type: "object", description: "Full automation config (alias, trigger, action, etc)." },
        },
        required: ["automation_id", "config"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_automation_delete",
      description: "Permanently delete an automation by its unique id.",
      parameters: { type: "object", properties: { automation_id: { type: "string" } }, required: ["automation_id"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_automation_toggle",
      description: "Enable, disable, or toggle an automation by its entity_id.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "e.g. automation.rascal_meds_timer" },
          action: { type: "string", enum: ["turn_on", "turn_off", "toggle", "trigger"], description: "What to do." },
        },
        required: ["entity_id", "action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_script_list",
      description: "List all scripts (entity_id starting with script.).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_script_get",
      description: "Get the full config of a script by its object id (the part after 'script.').",
      parameters: { type: "object", properties: { script_id: { type: "string" } }, required: ["script_id"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_script_create",
      description: "Create a new Home Assistant script via REST POST to /api/config/script/config/{object_id}. Object id is the part after 'script.' (lowercase, underscores). Body fields: alias, sequence (array of action steps), mode, fields (optional), icon (optional), description (optional). Reloads scripts after creation so it appears immediately.",
      parameters: {
        type: "object",
        properties: {
          script_id: { type: "string", description: "Object id (no 'script.' prefix), e.g. 'rascal_insulin_alert'" },
          alias: { type: "string", description: "Friendly name shown in HA UI" },
          sequence: { type: "array", items: { type: "object" }, description: "Array of action steps (service calls, delays, etc.)" },
          mode: { type: "string", enum: ["single", "restart", "queued", "parallel"], description: "Default 'single'" },
          icon: { type: "string", description: "Optional mdi icon, e.g. 'mdi:cat'" },
          description: { type: "string" },
          fields: { type: "object", description: "Optional input field schema" },
        },
        required: ["script_id", "alias", "sequence"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_script_update",
      description: "Overwrite an existing script's full config. ALWAYS read it first with ha_script_get, modify, then send the full config back. Reloads scripts after update.",
      parameters: {
        type: "object",
        properties: {
          script_id: { type: "string", description: "Object id (no 'script.' prefix)" },
          config: { type: "object", description: "Full script config (alias, sequence, mode, etc.)" },
        },
        required: ["script_id", "config"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_script_delete",
      description: "Delete a script by object id (no 'script.' prefix). Reloads scripts after delete.",
      parameters: {
        type: "object",
        properties: { script_id: { type: "string" } },
        required: ["script_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_script_run",
      description: "Run a script immediately by entity_id.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "e.g. script.bedtime_routine" },
          variables: { type: "object", description: "Optional variables to pass." },
        },
        required: ["entity_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_template_render",
      description: "Render a Jinja2 template against current HA state. Useful for testing automation logic before saving (e.g. '{{ states(\"sensor.x\") }}').",
      parameters: { type: "object", properties: { template: { type: "string" } }, required: ["template"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_history",
      description: "Get state history for one or more entities over a time range. Defaults to last 24 hours.",
      parameters: {
        type: "object",
        properties: {
          entity_ids: { type: "array", items: { type: "string" } },
          hours_back: { type: "number", description: "How many hours back from now. Default 24." },
          minimal: { type: "boolean", description: "Return only state changes (no attributes). Default true." },
        },
        required: ["entity_ids"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_logbook",
      description: "Get human-readable logbook entries for an entity (state changes, automation triggers, etc).",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string" },
          hours_back: { type: "number", description: "Default 24." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_reload",
      description: "Reload a HA component without restarting. Use after editing yaml-based configs.",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string", enum: ["automation", "script", "scene", "template", "input_boolean", "input_number", "input_text", "input_select", "input_datetime", "timer", "rest", "rest_command", "shell_command", "homeassistant"], description: "What to reload. 'homeassistant' reloads core config." },
        },
        required: ["domain"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_input_set",
      description: "Set the value of an input_* helper (input_boolean, input_number, input_text, input_select, input_datetime).",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "e.g. input_boolean.guest_mode" },
          value: { description: "New value. Type depends on helper: bool for input_boolean, number for input_number, string for input_text/select, ISO datetime for input_datetime." },
        },
        required: ["entity_id", "value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_scene_apply",
      description: "Activate a scene by entity_id (e.g. scene.evening_lights).",
      parameters: { type: "object", properties: { entity_id: { type: "string" } }, required: ["entity_id"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ha_check_config",
      description: "Validate Home Assistant's configuration.yaml. Returns errors if any.",
      parameters: { type: "object", properties: {} },
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
          moduleFolder: { type: "string", description: "OneDrive/library root folder path for this course's MODULES (e.g. '/CFNF400/Modules/' or '/Human Sexuality/'). Single root path — the library walks subfolders for Week 1, Week 2, etc. Pass as moduleFolder (camelCase); will be stored as course{N}_module_folder." },
          readingFolder: { type: "string", description: "OneDrive/library root folder path for this course's READINGS. Single root path. Pass as readingFolder (camelCase); will be stored as course{N}_reading_folder." },
          semesterName: { type: "string", description: "Change the semester display name" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_app_theme",
      description: "Change colors of TWO surfaces ONLY: (a) the dashboard chrome (header bar, main bg, content boxes, today highlight), or (b) the BrynAssist dialog itself (this window — bg, border, header, input, message bubbles, message text). DOES NOT style any feature page (Automations, Library, Notepad, Calendar settings, Course Wizard, etc.) — for those you must use edit_file on the relevant component. If the user asks to change a feature page's colors, your thinking trace MUST acknowledge that and route to edit_file instead.\n\nAmbiguity rules: if the user just says 'change the text color' without saying which surface, ASK which one — don't guess. Default assumption: 'text color' alone usually means dashboard, NOT BrynAssist itself.\n\nSafety: the server validates contrast and will REJECT any wizardTextColor / wizardBodyTextColor change that would be unreadable against the current bubble/dialog bg (and vice versa). Read the error and try a contrasting color.\n\nUndo: set wizardUndo=true to restore the BrynAssist style to whatever it was BEFORE your most recent change. Use this when Bryn says revert/undo/'change it back'.\n\nReset: set wizardReset=true to wipe BrynAssist styles back to factory defaults.",
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
          wizardUndo: { type: "boolean", description: "Set to true to revert BrynAssist wizard styles to the snapshot taken just before the most recent change. Use when user says undo / revert / 'change it back'." },
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
      name: "trigger_library_sync",
      description: "Walk OneDrive for the given semester, find Week N/Module + Week N/Reading folders inside each course, download any new PDFs, and INSERT them into the files table as `week-{N}-{coursecode}-{module|reading}` rows. THIS IS THE ONLY CORRECT WAY TO SCAN ONEDRIVE FOR NEW COURSE FILES — never use shell+jq+curl against the Graph API. Runs the same code path as POST /api/library/sync-semester. Async on the server: returns immediately with `{status: 'syncing'}`; check progress by polling files table with run_sql a few seconds later.",
      parameters: {
        type: "object",
        properties: {
          semester_key: { type: "string", description: "Semester key like 'w2026' (winter 2026), 'f2025' (fall 2025), 'ss2026' (spring/summer 2026). Build it from semesterType + year: winter→w, fall→f, spring_summer→ss." },
        },
        required: ["semester_key"],
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
      description: "FULL OVERWRITE of your persistent memory file. DANGEROUS — wipes everything. Prefer memory_append for adding lessons. Only use memory_write when restructuring/cleaning up. Will auto-snapshot the previous version to .ai-memory.bak.md so you can recover.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Full new memory file contents. PREVIOUS CONTENT IS REPLACED ENTIRELY — include anything you want to keep." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_append",
      description: "SAFE-APPEND a new lesson to your persistent memory file. Use this any time you learn something concrete you want future-you to remember (a bug fix, a confirmed file location, a Pi gotcha, an endpoint name, a Bryn preference). Auto-prepends a dated header. NEVER clobbers existing content. Prefer this over memory_write for normal learning.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Short lesson title (e.g. 'OneDrive list-raw startsWith bug', 'Pi git pull workflow')" },
          where: { type: "string", description: "File:line, endpoint, or system area where this applies. Optional but very helpful." },
          what: { type: "string", description: "The actual fact / pattern / gotcha. Be specific — exact filenames, exact endpoint paths, exact error messages, exact commands." },
          why: { type: "string", description: "One-line reason future-you needs to remember this. Optional." },
        },
        required: ["topic", "what"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pi_deploy",
      description: "Deploy current code to the Pi (uni-cal.app). Use AFTER git_commit_and_push when you want changes live for Bryn. If you're running on the Pi itself, runs `git pull && ./deploy.sh` directly. If you're running on Replit (dev), returns the exact command Bryn needs to run on the Pi (you cannot SSH out). ALWAYS verifies HEAD matches origin/main at the end.",
      parameters: {
        type: "object",
        properties: {
          expectedSha: { type: "string", description: "Optional: the commit SHA you just pushed and expect to see on the Pi. The tool will fail if HEAD != this SHA after deploy." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "onedrive_reauth_start",
      description: "Initiate OneDrive device-code reauth flow when token is dead (status?verify=1 returns tokenWorks:false). Returns the user_code Bryn must type at microsoft.com/link. THIS IS THE ONLY TOKEN RECOVERY PATH — Bryn MUST physically open microsoft.com/link, type the code, sign in. You cannot do that step. After Bryn confirms done, verify with /api/onedrive/status?verify=1&force=1.",
      parameters: { type: "object", properties: {} },
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
      description: "Get instant reference docs and common patterns for ANY programming topic. Has built-in expert knowledge for the project stack (React, Express, Drizzle, Tailwind, shadcn, TanStack, Wouter, Zod, Framer Motion, PostgreSQL). For topics NOT in the built-in cache, automatically generates expert reference docs on-the-fly using a secondary AI — so it works for Python, Rust, Go, Swift, Django, Flask, Rails, Vue, Angular, Svelte, Next.js, or ANY language/framework.",
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
      name: "smart_context",
      description: "Intelligently load the most relevant files and data into your working context before answering a complex question. Analyzes the question, identifies which files/schemas/routes are relevant, reads them, and returns a compressed summary. Simulates having a massive context window by loading exactly what you need. Use before answering architectural questions, debugging complex issues, or making cross-file changes.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question or task you need context for (e.g. 'how does the calendar rendering work?', 'what connects the homework box to the API?')" },
          scope: { type: "string", enum: ["narrow", "medium", "wide"], description: "How much context to load. narrow=1-3 files, medium=5-8 files, wide=10+ files. Default 'medium'." },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deep_research",
      description: "Perform deep research on ANY topic, technology, or project by automatically chaining multiple knowledge tools. Combines: web_search + web_fetch + github_search + code_reference + npm_info into a single comprehensive research report. Use when Bryn asks about an unfamiliar technology, or when you need to understand something you've never seen before. Returns a thorough, multi-source analysis.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What to research (e.g. 'Svelte 5 runes', 'Bun runtime', 'tRPC v11', 'Elixir Phoenix LiveView', 'Rust Axum framework')" },
          depth: { type: "string", enum: ["quick", "standard", "deep"], description: "Research depth. quick=1-2 sources, standard=3-4, deep=5+ sources with code examples. Default 'standard'." },
          goal: { type: "string", description: "What you need to know (e.g. 'how to implement SSR', 'compare to Express', 'migrate from X to Y')" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pair_program",
      description: "Interactive pair programming mode. Given a problem description, generates a step-by-step implementation plan with code for each step, then walks through it. Simulates having a senior dev pair with you. Use for complex features, debugging sessions, or when Bryn wants to understand the approach before you implement it.",
      parameters: {
        type: "object",
        properties: {
          problem: { type: "string", description: "What needs to be built/fixed (e.g. 'add real-time notifications', 'fix the calendar rendering bug', 'implement drag-and-drop task reordering')" },
          current_code: { type: "string", description: "Current relevant code (optional)" },
          file_path: { type: "string", description: "File being worked on (optional)" },
          approach: { type: "string", enum: ["implement", "explain-first", "debug"], description: "implement=just do it, explain-first=explain plan then code, debug=diagnose then fix. Default 'explain-first'." },
        },
        required: ["problem"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "code_complete",
      description: "Generate intelligent code completions, like an IDE autocomplete/Copilot. Given a partial code snippet and optional surrounding context, generates the most likely continuation. Use when Bryn shares incomplete code and wants you to finish it, or when you need to generate boilerplate that fits the existing patterns.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The partial code to complete (cursor position is at the end)" },
          file_path: { type: "string", description: "File path for context (optional — helps match project patterns)" },
          instruction: { type: "string", description: "What to generate (e.g. 'complete this function', 'add error handling', 'implement the missing cases')" },
          max_lines: { type: "integer", description: "Max lines to generate. Default 30." },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "code_review_tool",
      description: "Review code for bugs, security issues, performance problems, and style improvements. Like having a senior engineer review your PR. Analyzes the code and returns actionable feedback with specific line-level suggestions. Can review code in any language.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Code to review" },
          file_path: { type: "string", description: "File path for context" },
          focus: { type: "string", enum: ["bugs", "security", "performance", "style", "all"], description: "What to focus on. Default 'all'." },
          language: { type: "string", description: "Language if not TypeScript. Auto-detected if omitted." },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_tests",
      description: "Generate unit tests or integration tests for any code. Produces ready-to-run test files with proper imports, mocks, and assertions. Supports any testing framework (Jest, Vitest, Mocha, pytest, etc.). Use after writing new functions, API endpoints, or components.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Code to generate tests for" },
          file_path: { type: "string", description: "Source file path (helps determine test file location and imports)" },
          framework: { type: "string", description: "Testing framework (e.g. 'vitest', 'jest', 'mocha', 'pytest'). Default: auto-detect from project." },
          coverage: { type: "string", enum: ["basic", "thorough", "edge-cases"], description: "Test coverage level. Default 'thorough'." },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "convert_code",
      description: "Convert/translate code between ANY programming languages or frameworks. Use when Bryn finds code in Python, Go, Rust, Java, etc. and wants it in TypeScript, or when migrating patterns between frameworks (e.g., Vue→React, Django→Express, Prisma→Drizzle). Uses a secondary AI model for accurate translation.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Source code to convert" },
          from: { type: "string", description: "Source language/framework (e.g. 'python', 'go', 'rust', 'vue', 'django', 'prisma')" },
          to: { type: "string", description: "Target language/framework (e.g. 'typescript', 'react', 'express', 'drizzle'). Default: 'typescript'" },
          preserve_logic: { type: "boolean", description: "Keep exact logic (true) or adapt to target idioms (false). Default: true." },
        },
        required: ["code", "from"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_tree",
      description: "List the full directory structure of any public GitHub repository. Returns the file/folder tree so you can understand how an unfamiliar project is organized before reading specific files. Use this to onboard to ANY codebase — see the architecture at a glance, then use github_file to read specific files.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "GitHub repo in 'owner/repo' format (e.g. 'vercel/next.js', 'drizzle-team/drizzle-orm')" },
          branch: { type: "string", description: "Branch name. Default 'main'." },
          path: { type: "string", description: "Subdirectory to list (e.g. 'src', 'packages/core'). Default: root." },
          max_depth: { type: "integer", description: "Max directory depth. Default 3. Max 5." },
        },
        required: ["repo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "stack_analyze",
      description: "Analyze any codebase or GitHub repo to identify its tech stack, architecture patterns, entry points, and how to work with it. Use when encountering an unfamiliar project — this tool reads package.json, config files, and key source files to build a complete picture. Can analyze local files or remote repos.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "GitHub repo in 'owner/repo' format. If provided, analyzes the remote repo." },
          local_path: { type: "string", description: "Local directory path to analyze. If provided, analyzes local files. Default: project root." },
          branch: { type: "string", description: "Branch for remote repos. Default 'main'." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "project_snapshot",
      description: "Generate a comprehensive bird's-eye view of the entire project. Returns: file tree with sizes, all exports/components, route map (API + frontend), database schema summary, and dependency graph. Use this to understand the full codebase before making architectural decisions or large refactors. Simulates having the entire project in context at once.",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", description: "Optional focus area: 'frontend', 'backend', 'database', 'routes', 'all'. Default: 'all'" },
          include_sizes: { type: "boolean", description: "Include file sizes and line counts. Default true." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "multi_file_edit",
      description: "Apply search-and-replace across multiple files atomically. Use for refactoring: renaming variables/components/functions across the whole project, updating import paths, changing API endpoint names, etc. Shows a preview of all changes before applying. Much safer than editing files one at a time.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Text or regex pattern to find" },
          replace: { type: "string", description: "Replacement text (supports $1, $2 for regex groups)" },
          file_pattern: { type: "string", description: "Glob pattern for files to search (e.g. '**/*.tsx', 'server/**/*.ts', 'client/src/**/*'). Default: '**/*.{ts,tsx}'" },
          is_regex: { type: "boolean", description: "Treat search as regex. Default false (literal match)." },
          dry_run: { type: "boolean", description: "Preview changes without applying. Default false." },
        },
        required: ["search", "replace"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "explain_code",
      description: "Analyze and explain code in ANY language or framework — not just this project's stack. Uses a secondary AI model to provide: what it does, how it works, potential issues, and how to adapt it for UniCal. Use when Bryn pastes code from Stack Overflow, another project, or a language you're less familiar with.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The code to analyze" },
          language: { type: "string", description: "Programming language (e.g. 'python', 'rust', 'go', 'swift'). Auto-detected if not specified." },
          question: { type: "string", description: "Specific question about the code (e.g. 'how would I port this to TypeScript?', 'is this safe?')" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "http_test",
      description: "Make HTTP requests to test API endpoints directly. Simulates what a browser or client would do. Use to verify endpoints work, test error handling, check response formats, or debug API issues. Supports GET, POST, PUT, PATCH, DELETE with headers and body.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to request (e.g. 'http://localhost:3000/api/tasks', or relative path '/api/tasks')" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method. Default GET." },
          headers: { type: "object", description: "Request headers as key-value pairs" },
          body: { type: "string", description: "Request body (JSON string for POST/PUT/PATCH)" },
          timeout: { type: "integer", description: "Timeout in ms. Default 10000." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_dependencies",
      description: "Map import/export relationships between files. Shows which files depend on which, what each file exports, and the full dependency chain for any given file. Essential before refactoring to know what will break. Use to understand how components, routes, and utilities connect.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "File to analyze (e.g. 'client/src/pages/dashboard.tsx'). Shows what it imports and what imports it." },
          direction: { type: "string", enum: ["imports", "importedBy", "both"], description: "Direction: 'imports' (what this file uses), 'importedBy' (what uses this file), 'both'. Default 'both'." },
          depth: { type: "integer", description: "How many levels deep to trace. Default 1. Max 3." },
        },
        required: ["file"],
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
  {
    type: "function" as const,
    function: {
      name: "auto_discover",
      description: "Automatically analyze the project's current tech stack, detect new packages/frameworks that have been added since last analysis, and generate internal documentation for anything unknown. Runs stack_analyze + code_reference generation for any new dependencies. Use this after npm installs, major code changes, or when onboarding to unfamiliar parts of the codebase. Returns a full report of what's known, what's new, and what docs were generated.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", description: "What to analyze: 'full' (entire project), 'packages' (just package.json changes), 'files' (scan new/changed files). Default: 'full'" },
          generate_docs: { type: "boolean", description: "Whether to auto-generate internal reference docs for newly discovered packages/frameworks. Default: true" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "auto_test",
      description: "Automatically generate and run test suites for recent code changes. Analyzes git diff or specified files, generates appropriate tests (unit, integration, endpoint), runs them, and reports results. Use before commits/deploys to catch regressions, or when Bryn asks to verify code quality.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "What to test: file path, 'changed' (git diff), 'endpoints' (API routes), or 'all'. Default: 'changed'" },
          type: { type: "string", description: "Test type: 'unit', 'integration', 'endpoint', 'auto' (detect best type). Default: 'auto'" },
          fix: { type: "boolean", description: "If tests fail, attempt to fix the code and re-run. Default: false" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "retro",
      description: "Run a retrospective analysis on recent changes. Reviews git log, analyzes code quality of recent commits, checks for potential issues (unused imports, type errors, missing error handling), and generates an improvement report. Can post findings as a dashboard announcement or notepad note. Use after deploys, feature completions, or periodically for code health.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", description: "What to review: 'last_commit', 'last_3', 'last_day', 'all_uncommitted'. Default: 'last_commit'" },
          output: { type: "string", description: "Where to send findings: 'response' (just reply), 'announcement' (dashboard), 'notepad' (save note), 'all'. Default: 'response'" },
          depth: { type: "string", description: "Analysis depth: 'quick' (surface scan), 'deep' (full code review with AI). Default: 'quick'" },
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

      case "append_temporary_notes": {
        const raw = String(args.content ?? '');
        if (!raw.trim()) return { success: false, result: { error: "content is empty" } };
        const escapeHtml = (s: string) => s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        const tsPrefix = (args.prefix_timestamp === false) ? '' : (() => {
          try {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            return `[${hh}:${mm}] `;
          } catch { return ''; }
        })();
        const htmlBody = escapeHtml(raw).replace(/\n/g, '<br>');
        const newBlock = `<div>${escapeHtml(tsPrefix)}${htmlBody}</div>`;
        const existing = await db.select().from(appState).where(eq(appState.key, 'blank_canvas_notes_html')).limit(1);
        const prev = existing.length > 0 ? (existing[0].value || '') : '';
        const sep = prev && !prev.endsWith('>') ? '<br>' : '';
        const next = prev + sep + newBlock;
        if (existing.length > 0) {
          await db.update(appState).set({ value: next, updatedAt: new Date() }).where(eq(appState.key, 'blank_canvas_notes_html'));
        } else {
          await db.insert(appState).values({ key: 'blank_canvas_notes_html', value: next });
        }
        return { success: true, result: { appended: raw.length, total_chars: next.length, location: "Temporary Notes box" } };
      }

      case "ha_list_dashboards": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        try {
          const dashboards = await haWebSocket('lovelace/dashboards/list');
          const summary = (dashboards as any[]).map((d: any) => ({
            url_path: d.url_path,
            title: d.title,
            mode: d.mode,
            require_admin: d.require_admin || false,
          }));
          return { success: true, result: { dashboards: summary, hint: "Pass url_path to ha_dashboard_read/write. Do NOT add 'lovelace-' prefix — HA adds it automatically in the browser URL. Only 'storage' mode dashboards can be read/written via API. 'yaml' mode dashboards are edited via YAML files on the Pi." } };
        } catch (err: any) {
          return { success: false, result: { error: `HA list dashboards failed: ${err.message}` } };
        }
      }

      case "ha_dashboard_read": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPath = args.dashboard || null;
        if (dashPath?.startsWith('lovelace-')) dashPath = dashPath.replace('lovelace-', '');
        try {
          const wsMsg: Record<string, any> = {};
          if (dashPath && dashPath !== 'lovelace') wsMsg.url_path = dashPath;
          const config = await haWebSocket('lovelace/config', wsMsg);
          const resolvedPath = dashPath || 'lovelace';
          return { success: true, result: { dashboard: resolvedPath, viewCount: config.views?.length || 0, config } };
        } catch (err: any) {
          return { success: false, result: { error: `HA dashboard '${dashPath || 'default'}' read failed: ${err.message}. Use ha_list_dashboards to find available dashboards. Only 'storage' mode dashboards can be read via API.` } };
        }
      }

      case "ha_dashboard_write": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPathW = args.dashboard || null;
        if (dashPathW?.startsWith('lovelace-')) dashPathW = dashPathW.replace('lovelace-', '');
        try {
          // Fetch existing config for corruption guard + snapshot
          const wsMsgRead: Record<string, any> = {};
          if (dashPathW && dashPathW !== 'lovelace') wsMsgRead.url_path = dashPathW;
          const existingConfig = await haWebSocket('lovelace/config', wsMsgRead);

          const countElements = (node: any): number => {
            if (!node || typeof node !== 'object') return 0;
            let n = 1;
            for (const k of ['cards', 'elements', 'children']) {
              if (Array.isArray(node[k])) for (const c of node[k]) n += countElements(c);
            }
            return n;
          };
          const existingCount = countElements(existingConfig);
          const newCount = countElements(args.config);

          // GUARDRAIL: refuse to clobber a populated dashboard with a much smaller config (corruption signature)
          if (!args.force && existingCount > 15 && newCount < existingCount * 0.9) {
            return { success: false, result: { error: `REFUSED: Existing dashboard has ${existingCount} nested items but you only sent ${newCount}. This would delete elements (LLM truncation pattern). Use ha_element_patch for surgical edits — it cannot drop anything. To override, pass force=true (only with a verified complete config).` } };
          }
          if (!args.force && existingCount > 50) {
            return { success: false, result: { error: `REFUSED: Dashboard has ${existingCount} nested items — too large for safe full overwrite. Use ha_element_patch or ha_view_write for targeted edits. Pass force=true only if you have a verified complete config.` } };
          }

          // SAFETY SNAPSHOT
          try {
            const fsMod = await import('fs');
            const pathMod = await import('path');
            const snapDir = pathMod.resolve(process.cwd(), 'ha-snapshots');
            if (!fsMod.existsSync(snapDir)) fsMod.mkdirSync(snapDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const snapPath = pathMod.join(snapDir, `lovelace-${dashPathW || 'main'}-${stamp}.json`);
            fsMod.writeFileSync(snapPath, JSON.stringify(existingConfig, null, 2));
            const prefix = `lovelace-${dashPathW || 'main'}-`;
            const all = fsMod.readdirSync(snapDir).filter((f: string) => f.startsWith(prefix)).sort();
            if (all.length > 50) for (const f of all.slice(0, all.length - 50)) { try { fsMod.unlinkSync(pathMod.join(snapDir, f)); } catch {} }
            console.log(`[ha_dashboard_write] Snapshot saved: ${snapPath}`);
          } catch (snapErr: any) {
            console.error(`[ha_dashboard_write] Snapshot failed (proceeding anyway):`, snapErr?.message);
          }

          const wsMsg: Record<string, any> = { config: args.config };
          if (dashPathW && dashPathW !== 'lovelace') wsMsg.url_path = dashPathW;
          await haWebSocket('lovelace/config/save', wsMsg);

          // POST-WRITE VERIFY
          try {
            const verifyConfig = await haWebSocket('lovelace/config', wsMsgRead);
            const verifiedCount = countElements(verifyConfig);
            return { success: true, result: { message: `Dashboard updated. Element count: ${existingCount} -> ${verifiedCount}. Refresh HA browser.`, dashboard: dashPathW || 'lovelace', elements_before: existingCount, elements_after: verifiedCount } };
          } catch {
            return { success: true, result: { message: "Dashboard updated. Refresh your HA browser to see changes.", dashboard: dashPathW || 'lovelace' } };
          }
        } catch (err: any) {
          return { success: false, result: { error: `HA dashboard write failed: ${err.message}. Use ha_list_dashboards to verify the correct url_path. Only 'storage' mode dashboards can be written via API.` } };
        }
      }

      case "ha_view_read": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPathVR = args.dashboard || null;
        if (dashPathVR?.startsWith('lovelace-')) dashPathVR = dashPathVR.replace('lovelace-', '');
        try {
          const wsMsg: Record<string, any> = {};
          if (dashPathVR && dashPathVR !== 'lovelace') wsMsg.url_path = dashPathVR;
          const config = await haWebSocket('lovelace/config', wsMsg);
          const views = config.views || [];
          let viewIdx = -1;
          if (args.view_index !== undefined && args.view_index !== null) {
            viewIdx = args.view_index;
          } else if (args.view_title) {
            viewIdx = views.findIndex((v: any) => v && v.title && typeof v.title === 'string' && v.title.toLowerCase() === args.view_title.toLowerCase());
          } else {
            viewIdx = 0;
          }
          if (viewIdx < 0 || viewIdx >= views.length) {
            const viewList = views.map((v: any, i: number) => `${i}: ${(v && v.title) || '(null or untitled)'}`).join(', ');
            return { success: false, result: { error: `View not found. Available views: ${viewList}` } };
          }
          const targetView = views[viewIdx];
          if (!targetView) {
            return { success: false, result: { error: `View at index ${viewIdx} is null/corrupted. Use ha_dashboard_read to see the full config, or try a different view_index.` } };
          }
          return { success: true, result: { dashboard: dashPathVR || 'lovelace', view_index: viewIdx, view_title: targetView.title || '(untitled)', total_views: views.length, view: targetView } };
        } catch (err: any) {
          return { success: false, result: { error: `HA view read failed: ${err.message}` } };
        }
      }

      case "ha_view_write": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPathVW = args.dashboard || null;
        if (dashPathVW?.startsWith('lovelace-')) dashPathVW = dashPathVW.replace('lovelace-', '');
        try {
          const wsMsgR: Record<string, any> = {};
          if (dashPathVW && dashPathVW !== 'lovelace') wsMsgR.url_path = dashPathVW;
          const config = await haWebSocket('lovelace/config', wsMsgR);
          const views = config.views || [];
          let viewIdx = -1;
          if (args.view_index !== undefined && args.view_index !== null) {
            viewIdx = args.view_index;
          } else if (args.view_title) {
            viewIdx = views.findIndex((v: any) => v && v.title && typeof v.title === 'string' && v.title.toLowerCase() === args.view_title.toLowerCase());
          } else {
            return { success: false, result: { error: "Must specify view_index or view_title" } };
          }
          if (viewIdx < 0 || viewIdx >= views.length) {
            const viewList = views.map((v: any, i: number) => `${i}: ${(v && v.title) || '(null or untitled)'}`).join(', ');
            return { success: false, result: { error: `View not found. Available views: ${viewList}` } };
          }
          // GUARDRAIL: refuse to overwrite a large existing view unless force=true.
          // Large view overwrites reliably drop elements because the LLM can't echo back 50+ nested items perfectly.
          const existingView = views[viewIdx];
          const countElements = (node: any): number => {
            if (!node || typeof node !== 'object') return 0;
            let n = 1;
            for (const k of ['cards', 'elements', 'children']) {
              if (Array.isArray(node[k])) for (const c of node[k]) n += countElements(c);
            }
            return n;
          };
          const existingCount = countElements(existingView);
          const newCount = countElements(args.view_config);
          if (!args.force && existingCount > 15 && newCount < existingCount * 0.9) {
            return { success: false, result: { error: `REFUSED: Existing view has ${existingCount} nested items but you only sent ${newCount}. This would delete elements. Use ha_element_patch for surgical edits instead — it won't drop anything. If you REALLY need to overwrite the whole view, re-call with force=true (only do this if you have the complete view config including every element).` } };
          }
          if (!args.force && existingCount > 30) {
            return { success: false, result: { error: `REFUSED: View has ${existingCount} nested items — too large for safe overwrite. Use ha_element_patch to change individual elements surgically. ha_view_write on large views has a history of dropping elements. If you truly need a full overwrite, pass force=true.` } };
          }
          // SAFETY SNAPSHOT: save the entire current config to disk before overwriting
          try {
            const fsMod = await import('fs');
            const pathMod = await import('path');
            const snapDir = pathMod.resolve(process.cwd(), 'ha-snapshots');
            if (!fsMod.existsSync(snapDir)) fsMod.mkdirSync(snapDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const snapPath = pathMod.join(snapDir, `lovelace-${dashPathVW || 'main'}-${stamp}.json`);
            fsMod.writeFileSync(snapPath, JSON.stringify(config, null, 2));
            // Trim: keep only the 50 most recent snapshots per dashboard
            const prefix = `lovelace-${dashPathVW || 'main'}-`;
            const all = fsMod.readdirSync(snapDir).filter((f: string) => f.startsWith(prefix)).sort();
            if (all.length > 50) {
              for (const f of all.slice(0, all.length - 50)) {
                try { fsMod.unlinkSync(pathMod.join(snapDir, f)); } catch {}
              }
            }
            console.log(`[ha_view_write] Snapshot saved: ${snapPath}`);
          } catch (snapErr: any) {
            console.error(`[ha_view_write] Snapshot failed (proceeding anyway):`, snapErr?.message);
          }
          views[viewIdx] = args.view_config;
          config.views = views;
          const wsMsgW: Record<string, any> = { config };
          if (dashPathVW && dashPathVW !== 'lovelace') wsMsgW.url_path = dashPathVW;
          await haWebSocket('lovelace/config/save', wsMsgW);
          // POST-WRITE VERIFY
          try {
            const wsMsgV: Record<string, any> = {};
            if (dashPathVW && dashPathVW !== 'lovelace') wsMsgV.url_path = dashPathVW;
            const verifyConfig = await haWebSocket('lovelace/config', wsMsgV);
            const verifiedCount = countElements(verifyConfig.views?.[viewIdx]);
            return { success: true, result: { message: `View '${args.view_config.title || viewIdx}' updated. Element count: ${existingCount} -> ${verifiedCount}. Refresh HA browser.`, dashboard: dashPathVW || 'lovelace', view_index: viewIdx, elements_before: existingCount, elements_after: verifiedCount } };
          } catch {
            return { success: true, result: { message: `View '${args.view_config.title || viewIdx}' updated. Refresh HA browser.`, dashboard: dashPathVW || 'lovelace', view_index: viewIdx } };
          }
        } catch (err: any) {
          return { success: false, result: { error: `HA view write failed: ${err.message}` } };
        }
      }

      case "ha_element_patch": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPathEP = args.dashboard || null;
        if (dashPathEP?.startsWith('lovelace-')) dashPathEP = dashPathEP.replace('lovelace-', '');
        try {
          const wsMsgR: Record<string, any> = {};
          if (dashPathEP && dashPathEP !== 'lovelace') wsMsgR.url_path = dashPathEP;
          const config = await haWebSocket('lovelace/config', wsMsgR);
          const views = config.views || [];
          let viewIdx = -1;
          if (args.view_index !== undefined && args.view_index !== null) {
            viewIdx = args.view_index;
          } else if (args.view_title) {
            viewIdx = views.findIndex((v: any) => v && v.title && typeof v.title === 'string' && v.title.toLowerCase() === args.view_title.toLowerCase());
          } else {
            viewIdx = 0;
          }
          if (viewIdx < 0 || viewIdx >= views.length || !views[viewIdx]) {
            const viewList = views.map((v: any, i: number) => `${i}: ${(v && v.title) || '(null)'}`).join(', ');
            return { success: false, result: { error: `View not found or null. Available views: ${viewList}` } };
          }
          const view = views[viewIdx];

          // Find target element
          let target: any = null;
          let targetPath: string[] = [];
          if (args.match_index_path && Array.isArray(args.match_index_path)) {
            let node: any = view;
            for (const idx of args.match_index_path) {
              const container = node.cards || node.elements || node.children || null;
              if (!container || !Array.isArray(container) || idx < 0 || idx >= container.length) {
                return { success: false, result: { error: `Index path invalid at ${idx}` } };
              }
              node = container[idx];
              targetPath.push(String(idx));
            }
            target = node;
          } else if (args.match_entity) {
            const findByEntity = (node: any, path: string[]): { el: any, path: string[] } | null => {
              if (!node || typeof node !== 'object') return null;
              if (node.entity === args.match_entity) return { el: node, path };
              for (const key of ['cards', 'elements', 'children']) {
                if (Array.isArray(node[key])) {
                  for (let i = 0; i < node[key].length; i++) {
                    const found = findByEntity(node[key][i], [...path, `${key}[${i}]`]);
                    if (found) return found;
                  }
                }
              }
              return null;
            };
            const found = findByEntity(view, []);
            if (!found) {
              return { success: false, result: { error: `No element found with entity '${args.match_entity}' in view ${viewIdx}` } };
            }
            target = found.el;
            targetPath = found.path;
          } else {
            return { success: false, result: { error: "Must provide match_entity or match_index_path" } };
          }

          if (Array.isArray(args.remove_keys)) {
            for (const k of args.remove_keys) delete target[k];
          }
          Object.assign(target, args.patch || {});

          // SAFETY SNAPSHOT before write
          try {
            const fsMod = await import('fs');
            const pathMod = await import('path');
            const snapDir = pathMod.resolve(process.cwd(), 'ha-snapshots');
            if (!fsMod.existsSync(snapDir)) fsMod.mkdirSync(snapDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const snapPath = pathMod.join(snapDir, `lovelace-${dashPathEP || 'main'}-${stamp}.json`);
            // Re-fetch the pristine config (target was mutated above), so snapshot reflects pre-patch state
            const preConfig = await haWebSocket('lovelace/config', wsMsgR);
            fsMod.writeFileSync(snapPath, JSON.stringify(preConfig, null, 2));
            const prefix = `lovelace-${dashPathEP || 'main'}-`;
            const all = fsMod.readdirSync(snapDir).filter((f: string) => f.startsWith(prefix)).sort();
            if (all.length > 50) for (const f of all.slice(0, all.length - 50)) { try { fsMod.unlinkSync(pathMod.join(snapDir, f)); } catch {} }
            console.log(`[ha_element_patch] Snapshot saved: ${snapPath}`);
          } catch (snapErr: any) {
            console.error(`[ha_element_patch] Snapshot failed (proceeding anyway):`, snapErr?.message);
          }

          const wsMsgW: Record<string, any> = { config };
          if (dashPathEP && dashPathEP !== 'lovelace') wsMsgW.url_path = dashPathEP;
          await haWebSocket('lovelace/config/save', wsMsgW);
          // POST-WRITE VERIFY: confirm patch landed and element count is sane
          try {
            const countAll = (n: any): number => {
              if (!n || typeof n !== 'object') return 0;
              let c = 1;
              for (const k of ['cards', 'elements', 'children']) if (Array.isArray(n[k])) for (const x of n[k]) c += countAll(x);
              return c;
            };
            const beforeCount = countAll(views[viewIdx]);
            const verifyConfig = await haWebSocket('lovelace/config', wsMsgR);
            const afterCount = countAll(verifyConfig.views?.[viewIdx]);
            if (afterCount < beforeCount) {
              return { success: true, result: { warning: `Patch saved but post-write count dropped: ${beforeCount} -> ${afterCount}. Inspect immediately.`, view_index: viewIdx, element_path: targetPath, patched_element: target, elements_before: beforeCount, elements_after: afterCount } };
            }
            return { success: true, result: { message: `Patched element at ${targetPath.join('.') || '(root)'} in view ${viewIdx}. Element count: ${beforeCount} -> ${afterCount}. Refresh HA.`, view_index: viewIdx, element_path: targetPath, patched_element: target, elements_before: beforeCount, elements_after: afterCount } };
          } catch {
            return { success: true, result: { message: `Patched element at ${targetPath.join('.') || '(root)'} in view ${viewIdx}. Refresh HA to see changes.`, view_index: viewIdx, element_path: targetPath, patched_element: target } };
          }
        } catch (err: any) {
          return { success: false, result: { error: `ha_element_patch failed: ${err.message}` } };
        }
      }

      case "ha_element_add": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPathEA = args.dashboard || null;
        if (dashPathEA?.startsWith('lovelace-')) dashPathEA = dashPathEA.replace('lovelace-', '');
        try {
          const wsMsgR: Record<string, any> = {};
          if (dashPathEA && dashPathEA !== 'lovelace') wsMsgR.url_path = dashPathEA;
          const config = await haWebSocket('lovelace/config', wsMsgR);
          const views = config.views || [];
          let viewIdx = -1;
          if (args.view_index !== undefined && args.view_index !== null) viewIdx = args.view_index;
          else if (args.view_title) viewIdx = views.findIndex((v: any) => v?.title?.toLowerCase() === args.view_title.toLowerCase());
          else viewIdx = 0;
          if (viewIdx < 0 || viewIdx >= views.length || !views[viewIdx]) {
            return { success: false, result: { error: `View not found. Available: ${views.map((v: any, i: number) => `${i}:${v?.title || '(null)'}`).join(', ')}` } };
          }
          const view = views[viewIdx];
          const cardPath: number[] = Array.isArray(args.card_index_path) && args.card_index_path.length > 0 ? args.card_index_path : [0];
          let card: any = view;
          for (const idx of cardPath) {
            const arr = card.cards || card.elements || card.children;
            if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) {
              return { success: false, result: { error: `Invalid card path at index ${idx}` } };
            }
            card = arr[idx];
          }
          const containerKey: string = args.container_key || (Array.isArray(card.elements) ? 'elements' : Array.isArray(card.cards) ? 'cards' : 'elements');
          if (!Array.isArray(card[containerKey])) card[containerKey] = [];
          const beforeLen = card[containerKey].length;
          if (args.dedupe_by_entity && args.element?.entity) {
            card[containerKey] = card[containerKey].filter((e: any) => e?.entity !== args.element.entity);
          }
          card[containerKey].push(args.element);

          // Snapshot
          try {
            const fsMod = await import('fs');
            const pathMod = await import('path');
            const snapDir = pathMod.resolve(process.cwd(), 'ha-snapshots');
            if (!fsMod.existsSync(snapDir)) fsMod.mkdirSync(snapDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const snapPath = pathMod.join(snapDir, `lovelace-${dashPathEA || 'main'}-${stamp}.json`);
            const preConfig = await haWebSocket('lovelace/config', wsMsgR);
            fsMod.writeFileSync(snapPath, JSON.stringify(preConfig, null, 2));
            console.log(`[ha_element_add] Snapshot: ${snapPath}`);
          } catch (e: any) { console.error(`[ha_element_add] snapshot failed:`, e?.message); }

          const wsMsgW: Record<string, any> = { config };
          if (dashPathEA && dashPathEA !== 'lovelace') wsMsgW.url_path = dashPathEA;
          await haWebSocket('lovelace/config/save', wsMsgW);
          return { success: true, result: { message: `Element added to view ${viewIdx} card ${cardPath.join('.')}.${containerKey}. Length: ${beforeLen} -> ${card[containerKey].length}. Refresh HA.`, view_index: viewIdx, card_path: cardPath, container_key: containerKey, container_length: card[containerKey].length } };
        } catch (err: any) {
          return { success: false, result: { error: `ha_element_add failed: ${err.message}` } };
        }
      }

      case "ha_element_remove": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        let dashPathER = args.dashboard || null;
        if (dashPathER?.startsWith('lovelace-')) dashPathER = dashPathER.replace('lovelace-', '');
        try {
          const wsMsgR: Record<string, any> = {};
          if (dashPathER && dashPathER !== 'lovelace') wsMsgR.url_path = dashPathER;
          const config = await haWebSocket('lovelace/config', wsMsgR);
          const views = config.views || [];
          let viewIdx = -1;
          if (args.view_index !== undefined && args.view_index !== null) viewIdx = args.view_index;
          else if (args.view_title) viewIdx = views.findIndex((v: any) => v?.title?.toLowerCase() === args.view_title.toLowerCase());
          else viewIdx = 0;
          if (viewIdx < 0 || viewIdx >= views.length || !views[viewIdx]) {
            return { success: false, result: { error: `View not found.` } };
          }
          const view = views[viewIdx];
          let removedCount = 0;
          let removedFrom = '';

          if (Array.isArray(args.match_index_path) && args.match_index_path.length > 0) {
            const path = args.match_index_path;
            let parent: any = view;
            let parentArr: any[] | null = null;
            let lastKey = '';
            for (let i = 0; i < path.length; i++) {
              const arr = parent.cards || parent.elements || parent.children;
              const arrKey = parent.cards ? 'cards' : parent.elements ? 'elements' : 'children';
              if (!Array.isArray(arr) || path[i] < 0 || path[i] >= arr.length) {
                return { success: false, result: { error: `Invalid path at index ${path[i]}` } };
              }
              if (i === path.length - 1) { parentArr = arr; lastKey = arrKey; break; }
              parent = arr[path[i]];
            }
            if (parentArr) {
              parentArr.splice(path[path.length - 1], 1);
              removedCount = 1;
              removedFrom = lastKey;
            }
          } else if (args.match_entity) {
            const removeIn = (node: any): void => {
              if (!node || typeof node !== 'object') return;
              for (const k of ['cards', 'elements', 'children']) {
                if (Array.isArray(node[k])) {
                  const before = node[k].length;
                  node[k] = node[k].filter((e: any) => {
                    if (e?.entity === args.match_entity) {
                      if (removedCount === 0 || args.remove_all_matching) { removedCount++; removedFrom = k; return false; }
                    }
                    return true;
                  });
                  for (const c of node[k]) removeIn(c);
                }
              }
            };
            removeIn(view);
          } else {
            return { success: false, result: { error: "Provide match_entity or match_index_path" } };
          }

          if (removedCount === 0) {
            return { success: false, result: { error: `No matching element found to remove.` } };
          }

          // Snapshot
          try {
            const fsMod = await import('fs');
            const pathMod = await import('path');
            const snapDir = pathMod.resolve(process.cwd(), 'ha-snapshots');
            if (!fsMod.existsSync(snapDir)) fsMod.mkdirSync(snapDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const snapPath = pathMod.join(snapDir, `lovelace-${dashPathER || 'main'}-${stamp}.json`);
            const preConfig = await haWebSocket('lovelace/config', wsMsgR);
            fsMod.writeFileSync(snapPath, JSON.stringify(preConfig, null, 2));
            console.log(`[ha_element_remove] Snapshot: ${snapPath}`);
          } catch (e: any) { console.error(`[ha_element_remove] snapshot failed:`, e?.message); }

          const wsMsgW: Record<string, any> = { config };
          if (dashPathER && dashPathER !== 'lovelace') wsMsgW.url_path = dashPathER;
          await haWebSocket('lovelace/config/save', wsMsgW);
          return { success: true, result: { message: `Removed ${removedCount} element(s) from ${removedFrom} in view ${viewIdx}. Refresh HA.`, removed: removedCount, view_index: viewIdx } };
        } catch (err: any) {
          return { success: false, result: { error: `ha_element_remove failed: ${err.message}` } };
        }
      }

      case "ha_automation_clone": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        const haUrlAC = HOME_ASSISTANT_URL.replace(/\/$/, '');
        try {
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
          const srcResp = await fetch(`${haUrlAC}/api/config/automation/config/${args.source_id}`, { headers });
          if (!srcResp.ok) return { success: false, result: { error: `Source automation '${args.source_id}' not found (HTTP ${srcResp.status}). Get IDs from /api/config/automation/config or browse Settings → Automations.` } };
          const src = await srcResp.json();
          const clone: any = JSON.parse(JSON.stringify(src));
          clone.alias = args.new_alias;
          delete clone.id;
          if (args.patch && typeof args.patch === 'object') {
            for (const k of Object.keys(args.patch)) clone[k] = args.patch[k];
          }
          const newId = `clone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const saveResp = await fetch(`${haUrlAC}/api/config/automation/config/${newId}`, { method: 'POST', headers, body: JSON.stringify(clone) });
          if (!saveResp.ok) {
            const txt = await saveResp.text();
            return { success: false, result: { error: `Save failed (HTTP ${saveResp.status}): ${txt}` } };
          }
          await fetch(`${haUrlAC}/api/services/automation/reload`, { method: 'POST', headers });
          return { success: true, result: { message: `Cloned automation '${args.source_id}' as '${args.new_alias}' (id: ${newId}). Reloaded.`, new_id: newId, new_alias: args.new_alias, clone_config: clone } };
        } catch (err: any) {
          return { success: false, result: { error: `ha_automation_clone failed: ${err.message}` } };
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

      case "ha_create_helper": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        try {
          const helperType = args.helper_type;
          const slug = (args.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          const wsPayload: Record<string, any> = { name: args.name };
          if (args.icon) wsPayload.icon = args.icon;

          if (helperType === 'timer') {
            wsPayload.duration = args.duration || '00:00:00';
            await haWebSocket('timer/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `timer.${slug}`, type: 'timer', duration: wsPayload.duration } };
          } else if (helperType === 'input_boolean') {
            await haWebSocket('input_boolean/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `input_boolean.${slug}`, type: 'input_boolean' } };
          } else if (helperType === 'input_number') {
            wsPayload.min = args.min_value ?? 0;
            wsPayload.max = args.max_value ?? 100;
            wsPayload.mode = 'slider';
            await haWebSocket('input_number/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `input_number.${slug}`, type: 'input_number' } };
          } else if (helperType === 'input_text') {
            wsPayload.min = 0;
            wsPayload.max = 255;
            await haWebSocket('input_text/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `input_text.${slug}`, type: 'input_text' } };
          } else if (helperType === 'input_select') {
            wsPayload.options = args.options || ['option1'];
            await haWebSocket('input_select/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `input_select.${slug}`, type: 'input_select' } };
          } else if (helperType === 'counter') {
            await haWebSocket('counter/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `counter.${slug}`, type: 'counter' } };
          } else if (helperType === 'input_datetime') {
            wsPayload.has_date = true;
            wsPayload.has_time = true;
            await haWebSocket('input_datetime/create', wsPayload);
            return { success: true, result: { created: true, entity_id: `input_datetime.${slug}`, type: 'input_datetime' } };
          }
          return { success: false, result: { error: `Unknown helper type: ${helperType}` } };
        } catch (err: any) {
          return { success: false, result: { error: `Failed to create helper: ${err.message}` } };
        }
      }

      case "ha_create_automation": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
          return { success: false, result: { error: "Home Assistant not configured" } };
        }
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const triggers = args.triggers ?? args.trigger;
          const actions = args.actions ?? args.action;
          const conditions = args.conditions ?? args.condition;
          if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
            return { success: false, result: { error: "Missing 'triggers' (or legacy 'trigger') array" } };
          }
          if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return { success: false, result: { error: "Missing 'actions' (or legacy 'action') array" } };
          }
          const automationConfig: Record<string, any> = {
            alias: args.alias,
            triggers,
            actions,
            mode: args.mode || 'single',
          };
          if (args.description) automationConfig.description = args.description;
          if (conditions) automationConfig.conditions = conditions;
          const slug = (args.alias as string).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          const resp = await fetch(`${haUrl}/api/config/automation/config/${slug}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(automationConfig),
          });
          if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            return { success: false, result: { error: `Failed to create automation: ${resp.status} ${errText.substring(0, 300)}` } };
          }
          const result = await resp.json().catch(() => ({}));
          await fetch(`${haUrl}/api/services/automation/reload`, { method: 'POST', headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' } }).catch(() => {});
          return { success: true, result: { created: true, automation_id: slug, alias: args.alias, ...result } };
        } catch (err: any) {
          return { success: false, result: { error: `Failed to create automation: ${err.message}` } };
        }
      }

      case "ha_automation_list": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` };
          const states = await (await fetch(`${haUrl}/api/states`, { headers })).json();
          const automations = states.filter((s: any) => s.entity_id?.startsWith('automation.')).map((s: any) => ({
            entity_id: s.entity_id,
            unique_id: s.attributes?.id,
            alias: s.attributes?.friendly_name,
            state: s.state,
            last_triggered: s.attributes?.last_triggered,
            mode: s.attributes?.mode,
          }));
          return { success: true, result: { count: automations.length, automations } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_automation_get": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const r = await fetch(`${haUrl}/api/config/automation/config/${args.automation_id}`, { headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` } });
          if (!r.ok) return { success: false, result: { error: `Not found (HTTP ${r.status})` } };
          return { success: true, result: { config: await r.json() } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_automation_update": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
          const r = await fetch(`${haUrl}/api/config/automation/config/${args.automation_id}`, { method: 'POST', headers, body: JSON.stringify(args.config) });
          if (!r.ok) return { success: false, result: { error: `Update failed: ${r.status} ${(await r.text()).slice(0, 200)}` } };
          await fetch(`${haUrl}/api/services/automation/reload`, { method: 'POST', headers });
          return { success: true, result: { updated: true, automation_id: args.automation_id } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_automation_delete": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` };
          const r = await fetch(`${haUrl}/api/config/automation/config/${args.automation_id}`, { method: 'DELETE', headers });
          if (!r.ok) return { success: false, result: { error: `Delete failed: ${r.status}` } };
          await fetch(`${haUrl}/api/services/automation/reload`, { method: 'POST', headers });
          return { success: true, result: { deleted: true, automation_id: args.automation_id } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_automation_toggle": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const r = await fetch(`${haUrl}/api/services/automation/${args.action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: args.entity_id }),
          });
          if (!r.ok) return { success: false, result: { error: `${r.status}` } };
          return { success: true, result: { entity_id: args.entity_id, action: args.action } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_script_list": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const states = await (await fetch(`${haUrl}/api/states`, { headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` } })).json();
          const scripts = states.filter((s: any) => s.entity_id?.startsWith('script.')).map((s: any) => ({
            entity_id: s.entity_id, alias: s.attributes?.friendly_name, last_triggered: s.attributes?.last_triggered,
          }));
          return { success: true, result: { count: scripts.length, scripts } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_script_get": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const r = await fetch(`${haUrl}/api/config/script/config/${args.script_id}`, { headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` } });
          if (!r.ok) return { success: false, result: { error: `Not found (${r.status})` } };
          return { success: true, result: { config: await r.json() } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_script_create": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const slug = String(args.script_id).replace(/^script\./, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
          if (!Array.isArray(args.sequence) || args.sequence.length === 0) {
            return { success: false, result: { error: "Missing 'sequence' array (the script's action steps)" } };
          }
          const config: Record<string, any> = {
            alias: args.alias,
            sequence: args.sequence,
            mode: args.mode || 'single',
          };
          if (args.icon) config.icon = args.icon;
          if (args.description) config.description = args.description;
          if (args.fields) config.fields = args.fields;
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
          const r = await fetch(`${haUrl}/api/config/script/config/${slug}`, { method: 'POST', headers, body: JSON.stringify(config) });
          if (!r.ok) {
            const errText = await r.text().catch(() => '');
            return { success: false, result: { error: `Create script failed: ${r.status} ${errText.slice(0, 300)}` } };
          }
          await fetch(`${haUrl}/api/services/script/reload`, { method: 'POST', headers }).catch(() => {});
          return { success: true, result: { created: true, entity_id: `script.${slug}`, alias: args.alias } };
        } catch (err: any) { return { success: false, result: { error: `Failed to create script: ${err.message}` } }; }
      }

      case "ha_script_update": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const slug = String(args.script_id).replace(/^script\./, '');
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
          const r = await fetch(`${haUrl}/api/config/script/config/${slug}`, { method: 'POST', headers, body: JSON.stringify(args.config) });
          if (!r.ok) {
            const errText = await r.text().catch(() => '');
            return { success: false, result: { error: `Update script failed: ${r.status} ${errText.slice(0, 300)}` } };
          }
          await fetch(`${haUrl}/api/services/script/reload`, { method: 'POST', headers }).catch(() => {});
          return { success: true, result: { updated: true, entity_id: `script.${slug}` } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_script_delete": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const slug = String(args.script_id).replace(/^script\./, '');
          const headers = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
          const r = await fetch(`${haUrl}/api/config/script/config/${slug}`, { method: 'DELETE', headers });
          if (!r.ok) return { success: false, result: { error: `Delete script failed: ${r.status}` } };
          await fetch(`${haUrl}/api/services/script/reload`, { method: 'POST', headers }).catch(() => {});
          return { success: true, result: { deleted: true, entity_id: `script.${slug}` } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_script_run": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const body: any = { entity_id: args.entity_id };
          if (args.variables) Object.assign(body, args.variables);
          const r = await fetch(`${haUrl}/api/services/script/turn_on`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!r.ok) return { success: false, result: { error: `${r.status}` } };
          return { success: true, result: { ran: args.entity_id } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_template_render": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const r = await fetch(`${haUrl}/api/template`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: args.template }),
          });
          if (!r.ok) return { success: false, result: { error: `Render failed: ${r.status} ${(await r.text()).slice(0, 200)}` } };
          return { success: true, result: { rendered: await r.text() } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_history": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const hours = args.hours_back || 24;
          const start = new Date(Date.now() - hours * 3600 * 1000).toISOString();
          const ids = (Array.isArray(args.entity_ids) ? args.entity_ids : []).join(',');
          const minimal = args.minimal !== false ? '&minimal_response=true&no_attributes=true' : '';
          const r = await fetch(`${haUrl}/api/history/period/${start}?filter_entity_id=${ids}${minimal}`, { headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` } });
          if (!r.ok) return { success: false, result: { error: `${r.status}` } };
          const history = await r.json();
          return { success: true, result: { hours_back: hours, series: history } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_logbook": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const hours = args.hours_back || 24;
          const start = new Date(Date.now() - hours * 3600 * 1000).toISOString();
          const filter = args.entity_id ? `?entity=${args.entity_id}` : '';
          const r = await fetch(`${haUrl}/api/logbook/${start}${filter}`, { headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` } });
          if (!r.ok) return { success: false, result: { error: `${r.status}` } };
          return { success: true, result: { entries: await r.json() } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_reload": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const domain = args.domain;
          const service = domain === 'homeassistant' ? 'reload_core_config' : 'reload';
          const r = await fetch(`${haUrl}/api/services/${domain}/${service}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (!r.ok) return { success: false, result: { error: `Reload ${domain} failed: ${r.status}` } };
          return { success: true, result: { reloaded: domain } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_input_set": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const eid = args.entity_id as string;
          const domain = eid.split('.')[0];
          let service = 'set_value';
          const data: any = { entity_id: eid };
          if (domain === 'input_boolean') {
            service = args.value ? 'turn_on' : 'turn_off';
          } else if (domain === 'input_select') {
            service = 'select_option'; data.option = String(args.value);
          } else if (domain === 'input_datetime') {
            service = 'set_datetime';
            const v = String(args.value);
            if (v.includes('T')) { data.datetime = v; } else if (v.includes(':')) { data.time = v; } else { data.date = v; }
          } else {
            data.value = args.value;
          }
          const r = await fetch(`${haUrl}/api/services/${domain}/${service}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!r.ok) return { success: false, result: { error: `${r.status} ${(await r.text()).slice(0, 200)}` } };
          return { success: true, result: { entity_id: eid, value: args.value } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_scene_apply": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const r = await fetch(`${haUrl}/api/services/scene/turn_on`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: args.entity_id }),
          });
          if (!r.ok) return { success: false, result: { error: `${r.status}` } };
          return { success: true, result: { applied: args.entity_id } };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
      }

      case "ha_check_config": {
        if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) return { success: false, result: { error: "HA not configured" } };
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const r = await fetch(`${haUrl}/api/config/core/check_config`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
          });
          if (!r.ok) return { success: false, result: { error: `${r.status}` } };
          return { success: true, result: await r.json() };
        } catch (err: any) { return { success: false, result: { error: err.message } }; }
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
          if (args.moduleFolder !== undefined) updates[`course${n}ModuleFolder`] = args.moduleFolder;
          if (args.readingFolder !== undefined) updates[`course${n}ReadingFolder`] = args.readingFolder;
        }
        if (Object.keys(updates).length === 0) return { success: false, result: { error: "No updates specified" } };
        const updated = await storage.updateSemesterSettings(settings.id, updates);
        return { success: true, result: { updated: Object.keys(updates), semesterName: updated.semesterName } };
      }

      case "update_app_theme": {
        const { appState: appStateTable } = await import("@shared/schema");
        const dashboardFields = ['headerBar', 'mainBackground', 'mainBackgroundGradientEnd', 'boxBackground', 'todayCellBackground', 'boxTransparency', 'boxGlassEffect'];
        const wizardFields = ['wizardBackground', 'wizardBorder', 'wizardHeaderBg', 'wizardInputBg', 'wizardUserBubble', 'wizardAssistantBubble', 'wizardTextColor', 'wizardBodyTextColor'];

        const isLightColor = (bg: string | undefined): boolean => {
          if (!bg) return false;
          const l = bg.toLowerCase().replace(/\s/g, '');
          if (l.includes('white') || l === '#fff' || l === '#ffffff') return true;
          const rgb = l.match(/rgba?\((\d+),(\d+),(\d+)/);
          if (rgb) return (+rgb[1] * 0.299 + +rgb[2] * 0.587 + +rgb[3] * 0.114) > 160;
          const hex = l.match(/#([0-9a-f]{6})/);
          if (hex) { const r = parseInt(hex[1].slice(0,2),16), g = parseInt(hex[1].slice(2,4),16), b = parseInt(hex[1].slice(4,6),16); return (r*0.299+g*0.587+b*0.114) > 160; }
          return false;
        };

        const wizKey = 'ui_wizardStyle';
        const wizBackupKey = 'ui_wizardStyle_prevSnapshot';
        const readKey = async (k: string): Promise<any> => {
          const rows = await db.select().from(appStateTable).where(eq(appStateTable.key, k)).limit(1);
          if (rows.length === 0 || !rows[0].value) return {};
          try { return JSON.parse(rows[0].value); } catch { return {}; }
        };
        const writeKey = async (k: string, v: any) => {
          const rows = await db.select().from(appStateTable).where(eq(appStateTable.key, k)).limit(1);
          const value = JSON.stringify(v);
          if (rows.length > 0) {
            await db.update(appStateTable).set({ value, updatedAt: new Date() }).where(eq(appStateTable.key, k));
          } else {
            await db.insert(appStateTable).values({ key: k, value });
          }
        };

        if (args.wizardUndo) {
          const snapshot = await readKey(wizBackupKey);
          if (!snapshot || Object.keys(snapshot).length === 0) {
            return { success: false, result: { error: "No previous BrynAssist style snapshot exists yet — nothing to undo. (Snapshots are created on each style change.)" } };
          }
          const current = await readKey(wizKey);
          await writeKey(wizKey, snapshot);
          await writeKey(wizBackupKey, current); // make undo itself undoable (acts as redo)
          return { success: true, result: { updated: ['BrynAssist: reverted to previous snapshot'], note: "Close and reopen BrynAssist to see the revert. Calling wizardUndo again will redo the change." } };
        }

        if (args.wizardReset) {
          const current = await readKey(wizKey);
          if (Object.keys(current).length > 0) {
            await writeKey(wizBackupKey, current);
          }
          await writeKey(wizKey, {});
          return { success: true, result: { updated: ['BrynAssist: reset to defaults (snapshot saved — wizardUndo to revert)'], note: "Close and reopen BrynAssist to see changes." } };
        }

        const dashboardUpdates: any = {};
        const wizardUpdates: any = {};
        for (const f of dashboardFields) { if (args[f] !== undefined) dashboardUpdates[f] = args[f]; }
        for (const f of wizardFields) { if (args[f] !== undefined) wizardUpdates[f] = args[f]; }

        if (Object.keys(dashboardUpdates).length === 0 && Object.keys(wizardUpdates).length === 0) {
          return { success: false, result: { error: "No theme updates specified" } };
        }

        // CONTRAST GUARD — refuse changes that would make wizard text invisible.
        if (Object.keys(wizardUpdates).length > 0) {
          const currentWiz = await readKey(wizKey);
          const merged = { ...currentWiz, ...wizardUpdates };
          const defaults: any = {
            wizardBackground: 'linear-gradient(180deg, #0d1b3e 0%, #0f2347 30%, #132d5a 60%, #162f5e 100%)',
            wizardUserBubble: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
            wizardAssistantBubble: 'rgba(30,50,90,0.7)',
          };
          const userBubbleBg = merged.wizardUserBubble || defaults.wizardUserBubble;
          const asstBubbleBg = merged.wizardAssistantBubble || defaults.wizardAssistantBubble;
          const dialogBg = merged.wizardBackground || defaults.wizardBackground;
          const checks: string[] = [];

          if (merged.wizardTextColor) {
            const txtLight = isLightColor(merged.wizardTextColor);
            if (txtLight === isLightColor(userBubbleBg)) checks.push(`wizardTextColor (${merged.wizardTextColor}) has the same lightness as the user bubble bg (${userBubbleBg}) — would be unreadable. Pick the opposite (dark text on light bg, or light text on dark bg).`);
            if (txtLight === isLightColor(asstBubbleBg)) checks.push(`wizardTextColor (${merged.wizardTextColor}) has the same lightness as the assistant bubble bg (${asstBubbleBg}) — would be unreadable.`);
          }
          if (merged.wizardBodyTextColor) {
            if (isLightColor(merged.wizardBodyTextColor) === isLightColor(dialogBg)) {
              checks.push(`wizardBodyTextColor (${merged.wizardBodyTextColor}) has the same lightness as the dialog bg (${dialogBg}) — body text would be unreadable.`);
            }
          }
          if (wizardUpdates.wizardUserBubble && currentWiz.wizardTextColor) {
            if (isLightColor(wizardUpdates.wizardUserBubble) === isLightColor(currentWiz.wizardTextColor)) {
              checks.push(`Changing wizardUserBubble to ${wizardUpdates.wizardUserBubble} would make the existing wizardTextColor (${currentWiz.wizardTextColor}) unreadable. Either change the text color in the same call, or pick a different bubble shade.`);
            }
          }
          if (wizardUpdates.wizardAssistantBubble && currentWiz.wizardTextColor) {
            if (isLightColor(wizardUpdates.wizardAssistantBubble) === isLightColor(currentWiz.wizardTextColor)) {
              checks.push(`Changing wizardAssistantBubble to ${wizardUpdates.wizardAssistantBubble} would make the existing wizardTextColor (${currentWiz.wizardTextColor}) unreadable.`);
            }
          }
          if (checks.length > 0) {
            return { success: false, result: { error: "Contrast guard rejected this BrynAssist style change.", details: checks, hint: "Pick colors with opposite lightness, or include both bubble bg AND text color in the same update_app_theme call so they stay paired." } };
          }
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
          // Snapshot CURRENT state to backup BEFORE writing the new one (so wizardUndo works).
          const current = await readKey(wizKey);
          await writeKey(wizBackupKey, current);
          const merged = { ...current, ...wizardUpdates };
          await writeKey(wizKey, merged);
          results.push(`BrynAssist: ${Object.keys(wizardUpdates).join(', ')} (snapshot saved — wizardUndo to revert)`);
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
        if (/(^|\s|;|&&|\|\|)\s*(sudo\s+)?(psql|pg_dump|pg_restore|pg_dumpall|createdb|dropdb)(\s|$)/i.test(cmd)) {
          return { success: false, result: { error: "Do NOT use psql or any postgres CLI from the shell — local socket auth fails on the Pi (role does not exist). Use the run_sql tool for SELECT/INSERT/UPDATE/DELETE, or db_schema for inspecting tables. Both go through the configured DATABASE_URL and will work on Pi and dev." } };
        }
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

      case "trigger_library_sync": {
        const semesterKey = (args.semester_key || '').trim();
        if (!semesterKey) return { success: false, result: { error: "semester_key required (e.g. 'w2026', 'f2025', 'ss2026')" } };
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(`http://localhost:5000/api/library/sync-semester`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semesterKey }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const body = await response.text();
          let parsed: any = body;
          try { parsed = JSON.parse(body); } catch {}
          return {
            success: response.ok,
            result: {
              status: response.status,
              response: parsed,
              hint: response.ok
                ? `Sync started for ${semesterKey}. Server walks OneDrive in background. Wait ~10-30s then run: SELECT folder, COUNT(*) FROM files WHERE folder LIKE 'week-%' GROUP BY folder ORDER BY folder; — to see new rows. If still nothing, server logs prefix '[LibrarySync:Semester]' explain why (no courses, missing Week N folders, no Module/Reading subfolder, OneDrive disconnected).`
                : `Sync request failed.`,
            },
          };
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
        const bakPath = path.join(projectRoot, '.ai-memory.bak.md');
        try {
          try {
            const prev = await fs.readFile(memPath, 'utf-8');
            await fs.writeFile(bakPath, prev, 'utf-8');
          } catch {}
          await fs.writeFile(memPath, args.content, 'utf-8');
          return { success: true, result: { written: true, size: args.content.length, snapshot: ".ai-memory.bak.md" } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "memory_append": {
        const projectRoot = getProjectRoot();
        const memPath = path.join(projectRoot, '.ai-memory.md');
        try {
          const today = easternDateStr(new Date());
          const topic = String(args.topic || '').trim() || 'Untitled lesson';
          const where = String(args.where || '').trim();
          const what = String(args.what || '').trim();
          const why = String(args.why || '').trim();
          if (!what) return { success: false, result: { error: "'what' is required — describe the actual fact/pattern to remember." } };
          const block = [
            ``,
            `### ${today} — ${topic}`,
            where ? `- Where: ${where}` : null,
            `- What: ${what}`,
            why ? `- Why: ${why}` : null,
            ``,
          ].filter(Boolean).join('\n');
          let existing = '';
          try { existing = await fs.readFile(memPath, 'utf-8'); } catch {}
          await fs.writeFile(memPath, existing + block, 'utf-8');
          return { success: true, result: { appended: true, topic, bytesAdded: block.length, totalSize: (existing + block).length } };
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 300) } };
        }
      }

      case "pi_deploy": {
        const projectRoot = getProjectRoot();
        const isPi = projectRoot.includes('/home/byhomeyyz/') || projectRoot.includes('/Home-View');
        const expected = String(args.expectedSha || '').trim();
        try {
          if (isPi) {
            const { execSync } = await import('child_process');
            const pull = execSync('cd ~/Home-View && git pull 2>&1', { encoding: 'utf-8', timeout: 60000 });
            const deploy = execSync('cd ~/Home-View && ./deploy.sh 2>&1 | tail -30', { encoding: 'utf-8', timeout: 120000 });
            const head = execSync('cd ~/Home-View && git rev-parse HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
            const ok = !expected || head.startsWith(expected);
            return { success: ok, result: { pulled: pull.substring(0, 1000), deployed: deploy.substring(0, 1500), head, expected: expected || '(none)', match: ok, hint: ok ? 'Tell Bryn to hard-refresh (Ctrl+Shift+R) to bust cache.' : `HEAD ${head} does NOT match expected ${expected} — pull may have failed.` } };
          } else {
            const { execSync } = await import('child_process');
            const head = execSync('git rev-parse HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
            return { success: true, result: {
              location: 'replit-dev',
              note: 'Cannot SSH to Pi from Replit. Tell Bryn to run this on the Pi:',
              command: 'cd ~/Home-View && git pull && ./deploy.sh && git rev-parse HEAD',
              expectedHead: expected || head,
              followUp: 'After Bryn runs it, ask for the HEAD output and confirm it matches.',
            } };
          }
        } catch (e: any) {
          return { success: false, result: { error: e.message?.substring(0, 400), hint: 'If git pull failed, check for merge conflicts (likely .onedrive_tokens.json — should be untracked since commit a426e31d6).' } };
        }
      }

      case "onedrive_reauth_start": {
        try {
          const r = await fetch('http://localhost:5000/api/onedrive/auth', {
            method: 'POST',
            headers: { 'x-auth-level': '5747', 'Content-Type': 'application/json' },
          });
          const text = await r.text();
          let payload: any;
          try { payload = JSON.parse(text); } catch { payload = { raw: text.substring(0, 400) }; }
          if (!r.ok) return { success: false, result: { status: r.status, error: 'Auth init failed', detail: payload } };
          const userCode = payload.user_code || payload.userCode || payload.code;
          const verifyUri = payload.verification_uri || payload.verificationUri || 'https://www.microsoft.com/link';
          if (!userCode) return { success: false, result: { error: 'No user_code in response', payload } };
          return { success: true, result: {
            user_code: userCode,
            verification_uri: verifyUri,
            instructions_for_bryn: [
              `1. Open ${verifyUri} on any device`,
              `2. Type this code: ${userCode}`,
              `3. Sign in with the MS account that owns the OneDrive`,
              `4. Approve permissions`,
              `5. Tell BA "done" — BA will verify with /api/onedrive/status?verify=1&force=1`,
            ],
            note: 'You (BA) cannot do step 1-4. Bryn must physically sign in. Wait for confirmation, then verify.',
          } };
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
          const cutoffStr = easternDateStr(cutoff);

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
          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model,
            messages: [
              { role: "system", content: "You are a helpful coding assistant. Be concise, precise, and output-focused. Return code or analysis directly without preamble." },
              { role: "user", content: subtaskPrompt },
            ],
            max_completion_tokens: maxTokens,
          }));
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

      case "smart_context": {
        const question = args.question;
        const scope = args.scope || 'medium';
        try {
          const { execSync } = await import('child_process');
          const { readFileSync } = await import('fs');
          const path = await import('path');

          const keywords = question.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3 && !['what', 'how', 'does', 'the', 'this', 'that', 'with', 'from', 'have', 'been', 'when', 'where', 'which', 'would', 'could', 'should'].includes(w));

          const maxFiles = scope === 'narrow' ? 3 : scope === 'wide' ? 12 : 6;
          const relevantFiles: Array<{ file: string; relevance: number; excerpt: string }> = [];

          const allFiles = execSync(`find . -type f \\( -name '*.ts' -o -name '*.tsx' \\) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -100`, { cwd: projectRoot, timeout: 10000, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

          for (const file of allFiles) {
            try {
              const content = readFileSync(path.default.join(projectRoot, file), 'utf-8');
              const lower = content.toLowerCase();
              let relevance = 0;
              const matchedKeywords: string[] = [];

              for (const kw of keywords) {
                const count = (lower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                if (count > 0) {
                  relevance += Math.min(count, 10);
                  matchedKeywords.push(kw);
                }
              }

              if (file.includes('dashboard')) relevance += 3;
              if (file.includes('route')) relevance += 2;
              if (file.includes('schema')) relevance += 2;
              if (file.includes('storage')) relevance += 1;

              if (relevance > 0) {
                const lines = content.split('\n');
                const excerptLines: string[] = [];
                for (let i = 0; i < lines.length && excerptLines.length < 20; i++) {
                  const lineLower = lines[i].toLowerCase();
                  if (matchedKeywords.some(kw => lineLower.includes(kw)) || lines[i].match(/^(export|function|const|interface|type|class)\s/)) {
                    excerptLines.push(`L${i + 1}: ${lines[i].substring(0, 150)}`);
                  }
                }
                relevantFiles.push({ file, relevance, excerpt: excerptLines.join('\n') });
              }
            } catch {}
          }

          relevantFiles.sort((a, b) => b.relevance - a.relevance);
          const topFiles = relevantFiles.slice(0, maxFiles);

          const contextSections: string[] = [];
          for (const f of topFiles) {
            const fullPath = path.default.join(projectRoot, f.file);
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              const exportLines = lines.filter(l => l.match(/^(export|function|const\s+\w+\s*=|interface|type|class)\s/)).slice(0, 15).map(l => l.substring(0, 200));
              contextSections.push(`=== ${f.file} (${lines.length} lines, relevance: ${f.relevance}) ===\nExports/Key lines:\n${exportLines.join('\n')}\n\nRelevant excerpts:\n${f.excerpt}`);
            } catch {}
          }

          const totalContext = contextSections.join('\n\n');
          return {
            success: true,
            result: {
              question,
              scope,
              filesAnalyzed: allFiles.length,
              filesLoaded: topFiles.length,
              files: topFiles.map(f => ({ path: f.file, relevance: f.relevance })),
              context: totalContext.substring(0, 4000),
              tip: 'Use this context to answer the question. For specific details, use read_file with offset/limit on the most relevant files.',
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Smart context failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "deep_research": {
        const topic = args.topic;
        const depth = args.depth || 'standard';
        const goal = args.goal || '';
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const sources: Array<{ type: string; data: any }> = [];

          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(topic + ' programming guide')}`;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(searchUrl, {
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });
            clearTimeout(timeout);
            const html = await resp.text();
            const resultMatches = html.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)/g) || [];
            const webResults = resultMatches.slice(0, depth === 'quick' ? 2 : depth === 'deep' ? 6 : 4).map(m => {
              const urlMatch = m.match(/href="([^"]+)"/);
              const titleMatch = m.match(/>([^<]+)$/);
              return { url: urlMatch?.[1] || '', title: titleMatch?.[1] || '' };
            });
            sources.push({ type: 'web_search', data: webResults });
          } catch {}

          if (depth !== 'quick') {
            const topUrl = sources[0]?.data?.[0]?.url;
            if (topUrl) {
              try {
                let fetchUrl = topUrl;
                if (fetchUrl.includes('duckduckgo.com/l/?')) {
                  const uddg = new URL(fetchUrl).searchParams.get('uddg');
                  if (uddg) fetchUrl = uddg;
                }
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 10000);
                const r = await fetch(fetchUrl, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
                clearTimeout(t);
                const text = await r.text();
                const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 4000);
                sources.push({ type: 'web_page', data: { url: fetchUrl, content: stripped } });
              } catch {}
            }
          }

          const pkgName = topic.toLowerCase().replace(/\s+/g, '-');
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`, { signal: ctrl.signal });
            clearTimeout(t);
            if (r.ok) {
              const pkg = await r.json() as any;
              sources.push({ type: 'npm', data: { name: pkg.name, description: pkg.description, version: pkg['dist-tags']?.latest, readme: (pkg.readme || '').substring(0, 2000) } });
            }
          } catch {}

          if (depth === 'deep') {
            try {
              const ghSearch = `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=stars&per_page=3`;
              const ctrl = new AbortController();
              const t = setTimeout(() => ctrl.abort(), 8000);
              const r = await fetch(ghSearch, { signal: ctrl.signal, headers: { 'User-Agent': 'BrynAssist/1.0', 'Accept': 'application/vnd.github.v3+json' } });
              clearTimeout(t);
              if (r.ok) {
                const data = await r.json() as any;
                const repos = (data.items || []).slice(0, 3).map((r: any) => ({ name: r.full_name, stars: r.stargazers_count, description: r.description, language: r.language, url: r.html_url }));
                sources.push({ type: 'github_repos', data: repos });
              }
            } catch {}
          }

          const sourceSummary = sources.map(s => `[${s.type}]: ${JSON.stringify(s.data).substring(0, 2000)}`).join('\n\n');
          const synthesis = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'You are a senior technical researcher. Synthesize the following sources into a comprehensive, practical reference. Include: overview, key concepts, code examples, best practices, and gotchas. Be concise but thorough.' },
              { role: 'user', content: `Research topic: ${topic}${goal ? `\nGoal: ${goal}` : ''}\n\nSources:\n${sourceSummary}` },
            ],
            max_completion_tokens: 2500,
          }));

          return {
            success: true,
            result: {
              topic,
              depth,
              sourcesUsed: sources.length,
              sourceTypes: sources.map(s => s.type),
              report: synthesis.choices[0]?.message?.content || '',
              tokens: synthesis.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Deep research failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "pair_program": {
        const problem = args.problem;
        const currentCode = args.current_code || '';
        const filePath = args.file_path || '';
        const approach = args.approach || 'explain-first';
        try {
          let fileContext = '';
          if (filePath) {
            try {
              const { readFileSync } = await import('fs');
              const path = await import('path');
              const content = readFileSync(path.default.join(projectRoot, filePath), 'utf-8');
              const lines = content.split('\n');
              fileContext = `\nFile: ${filePath} (${lines.length} lines)\nFirst 80 lines:\n${lines.slice(0, 80).join('\n')}`;
            } catch {}
          }

          const approachPrompts: Record<string, string> = {
            'implement': `Provide the complete implementation. For each step: 1) What you're doing, 2) The code, 3) Why this approach. Output working code ready to paste.`,
            'explain-first': `First explain your approach (numbered steps with rationale). Then provide the code for each step. Walk through it like pair programming — explain your thinking at each decision point.`,
            'debug': `Diagnose the issue step by step: 1) What symptoms suggest, 2) Most likely root causes (ranked), 3) How to verify each, 4) The fix with code. Think out loud like debugging together.`,
          };

          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: `You are a senior developer pair-programming with Bryn. ${approachPrompts[approach] || approachPrompts['explain-first']} Be thorough but practical. Use TypeScript/React/Express patterns matching this project's conventions.${fileContext}` },
              { role: 'user', content: `Problem: ${problem}${currentCode ? `\n\nCurrent code:\n\`\`\`\n${currentCode.substring(0, 5000)}\n\`\`\`` : ''}` },
            ],
            max_completion_tokens: 3000,
          }));

          return {
            success: true,
            result: {
              approach,
              session: completion.choices[0]?.message?.content || '',
              file: filePath || undefined,
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Pair programming failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "code_complete": {
        const code = args.code;
        const filePath = args.file_path || '';
        const instruction = args.instruction || 'Complete this code naturally';
        const maxLines = args.max_lines || 30;
        try {
          let fileContext = '';
          if (filePath) {
            try {
              const { readFileSync } = await import('fs');
              const path = await import('path');
              const fullContent = readFileSync(path.default.join(projectRoot, filePath), 'utf-8');
              const lines = fullContent.split('\n');
              fileContext = `\nFile: ${filePath} (${lines.length} lines total)\nFirst 50 lines for context:\n${lines.slice(0, 50).join('\n')}`;
            } catch {}
          }
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: `You are an expert code completion engine. Generate the most likely continuation of the given code. Match the existing style, patterns, and conventions exactly. Output ONLY the completion code — no explanation, no markdown fences, no preamble. Max ${maxLines} lines.${fileContext}` },
              { role: 'user', content: `${instruction}\n\nCode to complete:\n${code.substring(code.length - 3000)}` },
            ],
            max_completion_tokens: Math.min(maxLines * 50, 2000),
          }));
          return {
            success: true,
            result: {
              completion: completion.choices[0]?.message?.content || '',
              instruction,
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Code completion failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "code_review_tool": {
        const code = args.code;
        const filePath = args.file_path || 'unknown';
        const focus = args.focus || 'all';
        const language = args.language || 'TypeScript';
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const focusInstructions: Record<string, string> = {
            bugs: 'Focus on logic errors, null/undefined risks, race conditions, off-by-one errors, and incorrect assumptions.',
            security: 'Focus on XSS, SQL injection, auth bypasses, secret exposure, insecure defaults, and input validation.',
            performance: 'Focus on unnecessary re-renders, N+1 queries, missing indexes, memory leaks, large bundle sizes, and slow algorithms.',
            style: 'Focus on naming conventions, code organization, DRY violations, dead code, and readability.',
            all: 'Review for bugs, security, performance, AND style issues.',
          };
          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: `You are a senior engineer doing a thorough code review. ${focusInstructions[focus] || focusInstructions.all} For each issue, provide: severity (critical/warning/info), the problematic line/section, what's wrong, and the fix. Be specific and actionable.` },
              { role: 'user', content: `Review this ${language} code from ${filePath}:\n\n\`\`\`${language}\n${code.substring(0, 8000)}\n\`\`\`` },
            ],
            max_completion_tokens: 2000,
          }));
          return {
            success: true,
            result: {
              file: filePath,
              focus,
              review: completion.choices[0]?.message?.content || '',
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Code review failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "generate_tests": {
        const code = args.code;
        const filePath = args.file_path || '';
        const framework = args.framework || 'vitest';
        const coverage = args.coverage || 'thorough';
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const coverageInstructions: Record<string, string> = {
            basic: 'Write tests for the happy path only. 3-5 test cases.',
            thorough: 'Write tests for happy path, error handling, and boundary conditions. 8-15 test cases.',
            'edge-cases': 'Write tests focusing on edge cases, race conditions, and unusual inputs. Include property-based tests if applicable. 15-25 test cases.',
          };
          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: `You are a senior test engineer. Generate complete, ready-to-run ${framework} test files. Include proper imports, setup/teardown, mocks where needed, and descriptive test names. ${coverageInstructions[coverage] || coverageInstructions.thorough} Output ONLY the test file code in a code block.` },
              { role: 'user', content: `Generate ${framework} tests for this code${filePath ? ` (from ${filePath})` : ''}:\n\n\`\`\`\n${code.substring(0, 8000)}\n\`\`\`` },
            ],
            max_completion_tokens: 3000,
          }));
          return {
            success: true,
            result: {
              framework,
              coverage,
              tests: completion.choices[0]?.message?.content || '',
              suggestedPath: filePath ? filePath.replace(/\.(ts|tsx|js|jsx)$/, `.test.$1`) : `tests/generated.test.ts`,
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Test generation failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "convert_code": {
        const code = args.code;
        const from = args.from;
        const to = args.to || 'typescript';
        const preserveLogic = args.preserve_logic !== false;
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const prompt = `Convert this ${from} code to ${to}.
${preserveLogic ? 'Preserve exact logic and behavior.' : 'Adapt to idiomatic patterns in the target language/framework.'}

Source (${from}):
\`\`\`${from}
${code.substring(0, 8000)}
\`\`\`

Provide:
1. The converted code in a code block
2. Brief notes on key differences/adaptations (3-5 bullet points)
3. Any dependencies needed in the target environment`;

          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: `You are an expert code translator. You convert between any programming languages and frameworks with perfect accuracy. Output clean, idiomatic ${to} code. Include type annotations where applicable.` },
              { role: 'user', content: prompt },
            ],
            max_completion_tokens: 3000,
          }));
          return {
            success: true,
            result: {
              from,
              to,
              conversion: completion.choices[0]?.message?.content || '',
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Code conversion failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "github_tree": {
        const repo = args.repo;
        const branch = args.branch || 'main';
        const subPath = args.path || '';
        const maxDepth = Math.min(args.max_depth || 3, 5);
        try {
          const apiUrl = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(apiUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'BrynAssist/1.0', 'Accept': 'application/vnd.github.v3+json' },
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            if (resp.status === 404) {
              const altBranch = branch === 'main' ? 'master' : 'main';
              const altUrl = `https://api.github.com/repos/${repo}/git/trees/${altBranch}?recursive=1`;
              const ctrl2 = new AbortController();
              const t2 = setTimeout(() => ctrl2.abort(), 10000);
              const resp2 = await fetch(altUrl, { signal: ctrl2.signal, headers: { 'User-Agent': 'BrynAssist/1.0', 'Accept': 'application/vnd.github.v3+json' } });
              clearTimeout(t2);
              if (!resp2.ok) return { success: false, result: { error: `Repo not found or private: ${repo}` } };
              const data2 = await resp2.json() as any;
              const tree = (data2.tree || [])
                .filter((item: any) => {
                  if (subPath && !item.path.startsWith(subPath)) return false;
                  const relPath = subPath ? item.path.slice(subPath.length + 1) : item.path;
                  const depth = relPath.split('/').length;
                  return depth <= maxDepth;
                })
                .map((item: any) => ({ path: item.path, type: item.type === 'blob' ? 'file' : 'dir', size: item.size || 0 }))
                .slice(0, 500);
              return { success: true, result: { repo, branch: altBranch, totalItems: tree.length, tree } };
            }
            return { success: false, result: { error: `GitHub API error: ${resp.status} ${resp.statusText}` } };
          }
          const data = await resp.json() as any;
          const tree = (data.tree || [])
            .filter((item: any) => {
              if (subPath && !item.path.startsWith(subPath)) return false;
              const relPath = subPath ? item.path.slice(subPath.length + 1) : item.path;
              const depth = relPath.split('/').length;
              return depth <= maxDepth;
            })
            .map((item: any) => ({ path: item.path, type: item.type === 'blob' ? 'file' : 'dir', size: item.size || 0 }))
            .slice(0, 500);
          return { success: true, result: { repo, branch, totalItems: tree.length, truncated: data.truncated || false, tree } };
        } catch (e: any) {
          return { success: false, result: { error: `GitHub tree fetch failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "stack_analyze": {
        const repo = args.repo;
        const localPath = args.local_path;
        const branch = args.branch || 'main';
        try {
          const configFiles = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.ts', 'nuxt.config.ts', 'angular.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pyproject.toml', 'Gemfile', 'build.gradle', 'pom.xml', 'docker-compose.yml', 'Dockerfile', '.env.example', 'drizzle.config.ts', 'prisma/schema.prisma', 'tailwind.config.ts', 'tailwind.config.js', 'webpack.config.js'];
          const analysis: Record<string, any> = { source: repo ? `github:${repo}` : (localPath || 'local project') };
          const fileContents: Record<string, string> = {};

          if (repo) {
            for (const cf of configFiles) {
              try {
                const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${cf}`;
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 5000);
                const r = await fetch(rawUrl, { signal: ctrl.signal, headers: { 'User-Agent': 'BrynAssist/1.0' } });
                clearTimeout(t);
                if (r.ok) {
                  const text = await r.text();
                  fileContents[cf] = text.substring(0, 3000);
                }
              } catch {}
            }
          } else {
            const { readFileSync } = await import('fs');
            const path = await import('path');
            const root = localPath || projectRoot;
            for (const cf of configFiles) {
              try {
                const content = readFileSync(path.default.join(root, cf), 'utf-8');
                fileContents[cf] = content.substring(0, 3000);
              } catch {}
            }
          }

          if (fileContents['package.json']) {
            try {
              const pkg = JSON.parse(fileContents['package.json']);
              analysis.name = pkg.name;
              analysis.scripts = Object.keys(pkg.scripts || {});
              const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
              const depNames = Object.keys(allDeps);

              const stack: string[] = [];
              if (depNames.some(d => d.includes('react'))) stack.push('React');
              if (depNames.some(d => d.includes('vue'))) stack.push('Vue');
              if (depNames.some(d => d.includes('angular') || d.includes('@angular'))) stack.push('Angular');
              if (depNames.some(d => d.includes('svelte'))) stack.push('Svelte');
              if (depNames.some(d => d === 'next')) stack.push('Next.js');
              if (depNames.some(d => d === 'nuxt')) stack.push('Nuxt');
              if (depNames.some(d => d === 'express')) stack.push('Express');
              if (depNames.some(d => d === 'fastify')) stack.push('Fastify');
              if (depNames.some(d => d === 'hono')) stack.push('Hono');
              if (depNames.some(d => d.includes('drizzle'))) stack.push('Drizzle ORM');
              if (depNames.some(d => d.includes('prisma'))) stack.push('Prisma');
              if (depNames.some(d => d.includes('typeorm'))) stack.push('TypeORM');
              if (depNames.some(d => d.includes('sequelize'))) stack.push('Sequelize');
              if (depNames.some(d => d.includes('tailwind'))) stack.push('Tailwind CSS');
              if (depNames.some(d => d.includes('vite'))) stack.push('Vite');
              if (depNames.some(d => d.includes('webpack'))) stack.push('Webpack');
              if (depNames.some(d => d === 'typescript')) stack.push('TypeScript');
              if (depNames.some(d => d.includes('tanstack') || d.includes('react-query'))) stack.push('TanStack Query');
              if (depNames.some(d => d.includes('redux'))) stack.push('Redux');
              if (depNames.some(d => d.includes('zustand'))) stack.push('Zustand');
              if (depNames.some(d => d === 'zod')) stack.push('Zod');
              if (depNames.some(d => d.includes('socket.io'))) stack.push('Socket.IO');
              if (depNames.some(d => d.includes('graphql'))) stack.push('GraphQL');
              if (depNames.some(d => d.includes('trpc'))) stack.push('tRPC');
              if (depNames.some(d => d.includes('stripe'))) stack.push('Stripe');
              if (depNames.some(d => d.includes('supabase'))) stack.push('Supabase');
              if (depNames.some(d => d.includes('firebase'))) stack.push('Firebase');
              if (depNames.some(d => d.includes('mongoose') || d.includes('mongodb'))) stack.push('MongoDB');
              if (depNames.some(d => d === 'pg' || d === 'postgres')) stack.push('PostgreSQL');

              analysis.detectedStack = stack;
              analysis.dependencies = depNames.slice(0, 40);
              analysis.totalDependencies = depNames.length;
            } catch {}
          }

          if (fileContents['Cargo.toml']) analysis.language = 'Rust';
          else if (fileContents['go.mod']) analysis.language = 'Go';
          else if (fileContents['requirements.txt'] || fileContents['pyproject.toml']) analysis.language = 'Python';
          else if (fileContents['Gemfile']) analysis.language = 'Ruby';
          else if (fileContents['build.gradle'] || fileContents['pom.xml']) analysis.language = 'Java/Kotlin';
          else if (fileContents['tsconfig.json']) analysis.language = 'TypeScript';
          else if (fileContents['package.json']) analysis.language = 'JavaScript';

          analysis.configFilesFound = Object.keys(fileContents);

          if (Object.keys(fileContents).length > 0) {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const configSummary = Object.entries(fileContents).map(([f, c]) => `--- ${f} ---\n${c}`).join('\n\n').substring(0, 8000);
            const completion = await openaiRetryUtil(() => openai.chat.completions.create({
              model: 'gpt-4.1-nano',
              messages: [
                { role: 'system', content: 'You are a senior architect. Analyze these config files and provide a concise architecture summary. Include: 1) Tech stack, 2) Project structure pattern, 3) Entry points, 4) Build/dev commands, 5) Key patterns/conventions. Be concise — max 500 words.' },
                { role: 'user', content: configSummary },
              ],
              max_completion_tokens: 800,
            }));
            analysis.architectureSummary = completion.choices[0]?.message?.content || '';
          }

          return { success: true, result: analysis };
        } catch (e: any) {
          return { success: false, result: { error: `Stack analysis failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "project_snapshot": {
        const focus = args.focus || 'all';
        const includeSizes = args.include_sizes !== false;
        try {
          const { execSync } = await import('child_process');
          const sections: string[] = [];

          if (focus === 'all' || focus === 'frontend' || focus === 'backend') {
            const treeCmd = includeSizes
              ? `find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \\) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -200 | while read f; do wc -l "$f" 2>/dev/null; done | sort -rn`
              : `find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \\) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | sort | head -200`;
            const tree = execSync(treeCmd, { cwd: projectRoot, timeout: 15000, encoding: 'utf-8' }).trim();
            sections.push(`=== FILE TREE (by size) ===\n${tree}`);
          }

          if (focus === 'all' || focus === 'routes') {
            const apiRoutes = execSync(`grep -rn 'app\\.\(get\\|post\\|put\\|patch\\|delete\\)\\|router\\.\(get\\|post\\|put\\|patch\\|delete\\)' server/routes.ts 2>/dev/null | head -80 | sed 's/^.*://' | sed 's/^[ ]*//'`, { cwd: projectRoot, timeout: 10000, encoding: 'utf-8' }).trim();
            sections.push(`=== API ROUTES ===\n${apiRoutes}`);

            try {
              const frontendRoutes = execSync(`grep -rn 'Route\\|path=\\|<Route' client/src/App.tsx 2>/dev/null | head -30`, { cwd: projectRoot, timeout: 5000, encoding: 'utf-8' }).trim();
              sections.push(`=== FRONTEND ROUTES ===\n${frontendRoutes}`);
            } catch {}
          }

          if (focus === 'all' || focus === 'database') {
            try {
              const schema = execSync(`grep -n 'export const\\|pgTable\\|serial\\|varchar\\|text\\|integer\\|boolean\\|timestamp\\|json' shared/schema.ts 2>/dev/null | head -60`, { cwd: projectRoot, timeout: 5000, encoding: 'utf-8' }).trim();
              sections.push(`=== DATABASE SCHEMA ===\n${schema}`);
            } catch {}
          }

          if (focus === 'all' || focus === 'frontend') {
            try {
              const components = execSync(`find client/src -name '*.tsx' -not -path '*/node_modules/*' | head -60 | while read f; do echo "--- $f ---"; grep -m5 'export\\|function\\|const.*=' "$f" 2>/dev/null | head -5; done`, { cwd: projectRoot, timeout: 15000, encoding: 'utf-8' }).trim();
              sections.push(`=== COMPONENTS & EXPORTS ===\n${components.substring(0, 6000)}`);
            } catch {}
          }

          if (focus === 'all' || focus === 'backend') {
            try {
              const serverExports = execSync(`grep -rn 'export\\|function\\|interface IStorage' server/*.ts 2>/dev/null | grep -v node_modules | head -40`, { cwd: projectRoot, timeout: 5000, encoding: 'utf-8' }).trim();
              sections.push(`=== SERVER EXPORTS ===\n${serverExports}`);
            } catch {}
          }

          const snapshot = sections.join('\n\n');
          return { success: true, result: { focus, totalLength: snapshot.length, snapshot: snapshot.substring(0, 15000) } };
        } catch (e: any) {
          return { success: false, result: { error: `Snapshot failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "multi_file_edit": {
        const search = args.search;
        const replace = args.replace;
        const filePattern = args.file_pattern || '**/*.{ts,tsx}';
        const isRegex = args.is_regex || false;
        const dryRun = args.dry_run || false;
        try {
          const { execSync } = await import('child_process');
          const { readFileSync, writeFileSync } = await import('fs');
          const path = await import('path');

          const globCmd = `find . -type f -name '*.ts' -o -name '*.tsx' | grep -v node_modules | grep -v .git | grep -v dist`;
          const files = execSync(globCmd, { cwd: projectRoot, timeout: 10000, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

          const changes: Array<{ file: string; lineNum: number; before: string; after: string }> = [];
          const regex = isRegex ? new RegExp(search, 'g') : null;

          for (const relFile of files) {
            const fullPath = path.default.join(projectRoot, relFile);
            let content: string;
            try { content = readFileSync(fullPath, 'utf-8'); } catch { continue; }
            const lines = content.split('\n');
            let hasMatch = false;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              let newLine: string;
              if (isRegex && regex) {
                regex.lastIndex = 0;
                if (!regex.test(line)) continue;
                regex.lastIndex = 0;
                newLine = line.replace(regex, replace);
              } else {
                if (!line.includes(search)) continue;
                newLine = line.split(search).join(replace);
              }
              if (newLine !== line) {
                changes.push({ file: relFile, lineNum: i + 1, before: line.trim(), after: newLine.trim() });
                lines[i] = newLine;
                hasMatch = true;
              }
            }

            if (hasMatch && !dryRun) {
              writeFileSync(fullPath, lines.join('\n'), 'utf-8');
            }
          }

          if (changes.length === 0) {
            return { success: true, result: { message: 'No matches found', search, filePattern, filesSearched: files.length } };
          }

          const preview = changes.slice(0, 30).map(c => `${c.file}:${c.lineNum}\n  - ${c.before}\n  + ${c.after}`).join('\n');
          return {
            success: true,
            result: {
              applied: !dryRun,
              totalChanges: changes.length,
              filesAffected: [...new Set(changes.map(c => c.file))].length,
              preview: preview + (changes.length > 30 ? `\n... and ${changes.length - 30} more changes` : ''),
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Multi-file edit failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "explain_code": {
        const code = args.code;
        const language = args.language || 'auto-detect';
        const question = args.question || '';
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const prompt = `Analyze this ${language} code:

\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Provide:
1. **What it does** (1-2 sentences)
2. **How it works** (step by step, concise)
3. **Potential issues** (bugs, security, performance)
4. **UniCal adaptation** (how to port/use this in a TypeScript/React/Express/PostgreSQL project)
${question ? `5. **Specific answer**: ${question}` : ''}

Be concise and practical.`;

          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'You are a polyglot code analyst. You understand every programming language and framework. Be concise, precise, and practical. Focus on actionable insights.' },
              { role: 'user', content: prompt },
            ],
            max_completion_tokens: 2000,
          }));
          return {
            success: true,
            result: {
              language,
              analysis: completion.choices[0]?.message?.content || 'No analysis generated',
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Code analysis failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "http_test": {
        let url = args.url;
        const method = args.method || 'GET';
        const headers = args.headers || {};
        const body = args.body;
        const timeout = args.timeout || 10000;
        try {
          if (url.startsWith('/')) url = `http://localhost:3000${url}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);
          const fetchOpts: any = {
            method,
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...headers },
          };
          if (body && method !== 'GET') fetchOpts.body = body;
          const resp = await fetch(url, fetchOpts);
          clearTimeout(timer);
          const contentType = resp.headers.get('content-type') || '';
          let responseBody: any;
          if (contentType.includes('json')) {
            responseBody = await resp.json();
          } else {
            const text = await resp.text();
            responseBody = text.substring(0, 5000);
          }
          return {
            success: true,
            result: {
              status: resp.status,
              statusText: resp.statusText,
              headers: Object.fromEntries([...resp.headers.entries()].slice(0, 15)),
              body: responseBody,
              bodyLength: typeof responseBody === 'string' ? responseBody.length : JSON.stringify(responseBody).length,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `HTTP request failed: ${e.message?.substring(0, 300)}`, url, method } };
        }
      }

      case "analyze_dependencies": {
        const targetFile = args.file;
        const direction = args.direction || 'both';
        const depth = Math.min(args.depth || 1, 3);
        try {
          const { execSync } = await import('child_process');
          const { readFileSync } = await import('fs');
          const path = await import('path');
          const result: Record<string, any> = { file: targetFile };

          if (direction === 'imports' || direction === 'both') {
            const fullPath = path.default.join(projectRoot, targetFile);
            let content: string;
            try { content = readFileSync(fullPath, 'utf-8'); } catch { return { success: false, result: { error: `File not found: ${targetFile}` } }; }
            const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
            const imports: string[] = [];
            let match;
            while ((match = importRegex.exec(content)) !== null) {
              imports.push(match[1]);
            }
            const localImports = imports.filter(i => i.startsWith('.') || i.startsWith('@/') || i.startsWith('@shared'));
            const externalImports = imports.filter(i => !i.startsWith('.') && !i.startsWith('@/') && !i.startsWith('@shared'));
            result.imports = { local: localImports, external: externalImports, total: imports.length };

            if (depth >= 2) {
              const secondLevel: Record<string, string[]> = {};
              for (const imp of localImports.slice(0, 15)) {
                try {
                  let resolved = imp;
                  if (imp.startsWith('@/')) resolved = `client/src/${imp.slice(2)}`;
                  else if (imp.startsWith('@shared')) resolved = imp.replace('@shared', 'shared');
                  else resolved = path.default.join(path.default.dirname(targetFile), imp);
                  const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
                  for (const ext of extensions) {
                    try {
                      const c = readFileSync(path.default.join(projectRoot, resolved + ext), 'utf-8');
                      const subImports: string[] = [];
                      let m;
                      const r = /(?:import|from)\s+['"]([^'"]+)['"]/g;
                      while ((m = r.exec(c)) !== null) { if (m[1].startsWith('.') || m[1].startsWith('@/')) subImports.push(m[1]); }
                      if (subImports.length > 0) secondLevel[imp] = subImports.slice(0, 10);
                      break;
                    } catch {}
                  }
                } catch {}
              }
              result.secondLevelImports = secondLevel;
            }
          }

          if (direction === 'importedBy' || direction === 'both') {
            try {
              const basename = path.default.basename(targetFile).replace(/\.(ts|tsx)$/, '');
              const searchPatterns = [
                path.default.basename(targetFile),
                basename,
              ];
              const grepPattern = searchPatterns.map(p => `'${p}'`).join('\\|');
              const cmd = `grep -rln "${grepPattern}" --include='*.ts' --include='*.tsx' . 2>/dev/null | grep -v node_modules | grep -v .git | grep -v dist | head -30`;
              const importedBy = execSync(cmd, { cwd: projectRoot, timeout: 10000, encoding: 'utf-8' }).trim().split('\n').filter(f => f && f !== `./${targetFile}`);
              result.importedBy = importedBy;
            } catch {
              result.importedBy = [];
            }
          }

          const lineCount = (() => { try { return readFileSync(path.default.join(projectRoot, targetFile), 'utf-8').split('\n').length; } catch { return 0; } })();
          result.lineCount = lineCount;

          const exports = (() => {
            try {
              const c = readFileSync(path.default.join(projectRoot, targetFile), 'utf-8');
              const exportMatches = c.match(/export\s+(default\s+)?(function|const|class|interface|type|enum)\s+(\w+)/g) || [];
              return exportMatches.map(e => e.replace(/export\s+(default\s+)?/, '').trim()).slice(0, 30);
            } catch { return []; }
          })();
          result.exports = exports;

          return { success: true, result };
        } catch (e: any) {
          return { success: false, result: { error: `Dependency analysis failed: ${e.message?.substring(0, 300)}` } };
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
          try {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const genPrompt = `Provide a concise expert reference for "${topic}"${context ? ` (context: ${context})` : ''}. Include:
1. Summary (what it is, when to use it)
2. Key patterns/idioms (5-8 code examples)
3. Common gotchas/tips (3-5 items)
4. How it relates to TypeScript/React/Express/PostgreSQL if applicable
Be practical and code-focused. Use real syntax.`;
            const completion = await openaiRetryUtil(() => openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: 'You are a polyglot programming expert. Provide concise, accurate, code-heavy reference docs for any language, framework, or library. Cover patterns that a senior developer would need.' },
                { role: 'user', content: genPrompt },
              ],
              max_completion_tokens: 1500,
            }));
            const generated = completion.choices[0]?.message?.content || '';
            return { success: true, result: { found: true, source: 'ai-generated', topic, reference: generated, note: 'Generated on-the-fly — not from built-in cache. Verify critical details with web_search if needed.' } };
          } catch {
            return { success: true, result: { found: false, suggestion: `No built-in reference for "${topic}". Try web_search or github_search for external examples.`, availableTopics: Object.keys(knowledgeBase) } };
          }
        }

        return { success: true, result: { found: true, source: 'built-in', references: matches.map(m => ({ topic: m.topic, ...m.data })), tip: context ? `For your goal (${context}), focus on the patterns most relevant to your use case.` : undefined } };
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

      case "auto_discover": {
        const scope = args.scope || 'full';
        const generateDocs = args.generate_docs !== false;
        try {
          const { execSync } = await import('child_process');
          const { readFileSync, existsSync } = await import('fs');
          const path = await import('path');

          const pkgPath = path.default.join(projectRoot, 'package.json');
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          const depNames = Object.keys(allDeps);

          const knownCachePath = path.default.join(projectRoot, '.brynassist-stack-cache.json');
          let knownDeps: string[] = [];
          try { if (existsSync(knownCachePath)) knownDeps = JSON.parse(readFileSync(knownCachePath, 'utf-8')).deps || []; } catch {}

          const newDeps = depNames.filter(d => !knownDeps.includes(d));
          const categories: Record<string, string[]> = { frontend: [], backend: [], database: [], testing: [], tooling: [], other: [] };
          const frontendPatterns = /react|vue|angular|svelte|next|nuxt|vite|tailwind|radix|shadcn|lucide|wouter|tanstack/i;
          const backendPatterns = /express|fastify|hono|koa|cors|helmet|compression|morgan|passport|jsonwebtoken|bcrypt|nodemailer/i;
          const dbPatterns = /drizzle|prisma|sequelize|typeorm|knex|pg|mysql|sqlite|redis|mongo/i;
          const testPatterns = /jest|vitest|mocha|chai|playwright|cypress|supertest|testing/i;
          const toolingPatterns = /typescript|eslint|prettier|webpack|esbuild|tsup|tsx|nodemon|concurrently/i;
          for (const dep of depNames) {
            if (frontendPatterns.test(dep)) categories.frontend.push(dep);
            else if (backendPatterns.test(dep)) categories.backend.push(dep);
            else if (dbPatterns.test(dep)) categories.database.push(dep);
            else if (testPatterns.test(dep)) categories.testing.push(dep);
            else if (toolingPatterns.test(dep)) categories.tooling.push(dep);
            else categories.other.push(dep);
          }

          let generatedDocs: string[] = [];
          if (generateDocs && newDeps.length > 0) {
            const topNew = newDeps.slice(0, 5);
            for (const dep of topNew) {
              try {
                const OpenAI = (await import("openai")).default;
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const completion = await openaiRetryUtil(() => openai.chat.completions.create({
                  model: 'gpt-4.1-nano',
                  messages: [
                    { role: 'system', content: 'Generate a concise internal reference doc (max 200 words) for a developer. Include: what it does, key API/functions, common patterns, gotchas.' },
                    { role: 'user', content: `Package: ${dep} (version ${allDeps[dep]})` },
                  ],
                  max_completion_tokens: 500,
                }));
                generatedDocs.push(`### ${dep}\n${completion.choices[0]?.message?.content || 'No docs generated'}`);
              } catch {}
            }
          }

          const { writeFileSync } = await import('fs');
          writeFileSync(knownCachePath, JSON.stringify({ deps: depNames, lastScan: new Date().toISOString() }));

          let fileStats = '';
          if (scope === 'full' || scope === 'files') {
            try {
              const tsFiles = execSync(`find ${projectRoot}/client/src ${projectRoot}/server ${projectRoot}/shared -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l`, { timeout: 5000 }).toString().trim();
              const totalLines = execSync(`find ${projectRoot}/client/src ${projectRoot}/server ${projectRoot}/shared -name "*.ts" -o -name "*.tsx" -exec wc -l {} + 2>/dev/null | tail -1`, { timeout: 10000 }).toString().trim();
              fileStats = `${tsFiles} TypeScript files, ${totalLines}`;
            } catch { fileStats = 'Could not count files'; }
          }

          return {
            success: true,
            result: {
              totalDeps: depNames.length,
              newDeps: newDeps.length > 0 ? newDeps : 'None — all packages already known',
              stack: categories,
              docsGenerated: generatedDocs.length > 0 ? generatedDocs : 'No new docs needed',
              codebaseStats: fileStats || undefined,
              hint: newDeps.length > 0 ? `${newDeps.length} new packages detected and catalogued` : 'Stack fully mapped — no new discoveries',
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Auto-discover failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "auto_test": {
        const target = args.target || 'changed';
        const testType = args.type || 'auto';
        const autoFix = args.fix || false;
        try {
          const { execSync } = await import('child_process');
          const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import('fs');
          const path = await import('path');

          let filesToTest: string[] = [];
          if (target === 'changed') {
            try {
              const diff = execSync('git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only', { cwd: projectRoot, timeout: 5000 }).toString().trim();
              filesToTest = diff.split('\n').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
            } catch { filesToTest = []; }
          } else if (target === 'endpoints') {
            filesToTest = ['server/routes.ts'];
          } else if (target === 'all') {
            try {
              const all = execSync(`find ${projectRoot}/server ${projectRoot}/shared -name "*.ts" -not -path "*/node_modules/*" -not -name "*.test.ts"`, { timeout: 5000 }).toString().trim();
              filesToTest = all.split('\n').filter(Boolean).slice(0, 10);
            } catch { filesToTest = []; }
          } else {
            filesToTest = [target];
          }

          if (filesToTest.length === 0) {
            return { success: true, result: { message: 'No files to test — no recent changes detected', files: [] } };
          }

          const fileContents: string[] = [];
          for (const f of filesToTest.slice(0, 5)) {
            try {
              const fullPath = path.default.isAbsolute(f) ? f : path.default.join(projectRoot, f);
              if (existsSync(fullPath)) {
                const content = readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                fileContents.push(`// FILE: ${f} (${lines.length} lines)\n${lines.slice(0, 100).join('\n')}`);
              }
            } catch {}
          }

          const detectType = testType === 'auto'
            ? filesToTest.some(f => f.includes('routes')) ? 'endpoint' : filesToTest.some(f => f.includes('client/')) ? 'unit' : 'integration'
            : testType;

          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openaiRetryUtil(() => openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: `You are a test engineer. Generate a ${detectType} test analysis for the given code files. Don't generate full test files — instead provide: 1) What should be tested (specific functions/routes/components), 2) Edge cases to cover, 3) Potential bugs or regressions spotted, 4) Test coverage estimate (%). Be concise and actionable.` },
              { role: 'user', content: `Files to analyze:\n${fileContents.join('\n\n---\n\n')}` },
            ],
            max_completion_tokens: 2000,
          }));

          let buildCheck = '';
          try {
            execSync('npx tsc --noEmit --pretty 2>&1 | tail -5', { cwd: projectRoot, timeout: 30000 });
            buildCheck = 'TypeScript compilation: PASS';
          } catch (e: any) {
            const output = e.stdout?.toString() || e.stderr?.toString() || '';
            const errorCount = (output.match(/error TS/g) || []).length;
            buildCheck = `TypeScript compilation: ${errorCount} errors detected`;
          }

          return {
            success: true,
            result: {
              testType: detectType,
              filesAnalyzed: filesToTest.slice(0, 5),
              analysis: completion.choices[0]?.message?.content || '',
              buildStatus: buildCheck,
              autoFix: autoFix ? 'Fix mode enabled — review suggestions above' : undefined,
              tokens: completion.usage?.total_tokens,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Auto-test failed: ${e.message?.substring(0, 300)}` } };
        }
      }

      case "retro": {
        const scope = args.scope || 'last_commit';
        const output = args.output || 'response';
        const depth = args.depth || 'quick';
        try {
          const { execSync } = await import('child_process');

          const scopeCommands: Record<string, string> = {
            'last_commit': 'git log -1 --pretty=format:"%h %s (%ci)" && echo "" && git diff HEAD~1 HEAD --stat',
            'last_3': 'git log -3 --pretty=format:"%h %s (%ci)" && echo "" && git diff HEAD~3 HEAD --stat',
            'last_day': 'git log --since="24 hours ago" --pretty=format:"%h %s (%ci)" && echo "" && git diff @{1.day.ago} --stat 2>/dev/null || echo "No changes in last day"',
            'all_uncommitted': 'git status --short && echo "" && git diff --stat',
          };

          const cmd = scopeCommands[scope] || scopeCommands['last_commit'];
          let gitOutput = '';
          try {
            gitOutput = execSync(cmd, { cwd: projectRoot, timeout: 10000 }).toString().trim();
          } catch (e: any) {
            gitOutput = e.stdout?.toString()?.trim() || 'Could not get git info';
          }

          let diffContent = '';
          try {
            const diffCmd = scope === 'all_uncommitted' ? 'git diff' : `git diff HEAD~${scope === 'last_3' ? '3' : '1'} HEAD`;
            diffContent = execSync(diffCmd, { cwd: projectRoot, timeout: 10000 }).toString().substring(0, 8000);
          } catch {}

          let analysis = '';
          if (depth === 'deep' && diffContent) {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openaiRetryUtil(() => openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: 'You are a senior code reviewer. Analyze this diff and provide: 1) Summary of changes, 2) Code quality assessment (1-10), 3) Potential issues (bugs, security, performance), 4) Missing error handling, 5) Improvement suggestions. Be concise and brutally honest.' },
                { role: 'user', content: `Git info:\n${gitOutput}\n\nDiff:\n${diffContent}` },
              ],
              max_completion_tokens: 2000,
            }));
            analysis = completion.choices[0]?.message?.content || '';
          } else {
            const lines = diffContent.split('\n');
            const additions = lines.filter(l => l.startsWith('+')).length;
            const deletions = lines.filter(l => l.startsWith('-')).length;
            const filesChanged = (gitOutput.match(/\d+ file/g) || []).length || 'unknown';
            analysis = `Quick scan: ${additions} additions, ${deletions} deletions across ${filesChanged} files.\n${gitOutput}`;
          }

          if (output === 'announcement' || output === 'all') {
            try {
              const { db } = await import('../db');
              const { announcements } = await import('../shared/schema');
              await db.insert(announcements).values({
                title: `Code Retro: ${scope}`,
                content: analysis.substring(0, 1000),
                type: 'info',
                dismissible: true,
                active: true,
              });
            } catch {}
          }

          if (output === 'notepad' || output === 'all') {
            try {
              const { db } = await import('../db');
              const { notepadNotes } = await import('../shared/schema');
              await db.insert(notepadNotes).values({
                title: `Retro: ${scope} — ${new Date().toLocaleDateString()}`,
                content: analysis,
                color: '#e3f2fd',
                isPinned: false,
              });
            } catch {}
          }

          return {
            success: true,
            result: {
              scope,
              depth,
              gitSummary: gitOutput,
              analysis,
              savedTo: output !== 'response' ? output : undefined,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Retro failed: ${e.message?.substring(0, 300)}` } };
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
  const todayStr = easternDateStr(now);
  const settings = await storage.getActiveSemesterSettings();

  let context = `Current date/time (Eastern): ${now.toLocaleString('en-US', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}\nCurrent semester week: ${currentWeek}\nToday: ${todayStr} (${now.toLocaleDateString('en-US', { timeZone: 'America/Toronto', weekday: 'long' })})\n`;

  if (settings) {
    context += `\nActive semester: ${settings.semesterName}\n`;
    context += `Semester start: ${settings.semesterStartDate ? easternDateStr(settings.semesterStartDate) : ''}\n`;
    if (settings.semesterEndDate) context += `Semester end: ${easternDateStr(settings.semesterEndDate)}\n`;
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
    return due < now && easternDateStr(due) !== todayStr;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const dueToday = allIncomplete.filter(t => easternDateStr(new Date(t.dueDate)) === todayStr);

  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = easternDateStr(tomorrow);
  const dueTomorrow = allIncomplete.filter(t => easternDateStr(new Date(t.dueDate)) === tomorrowStr);

  const thisWeek = allIncomplete.filter(t => t.weekNumber === currentWeek).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const nextWeek = allIncomplete.filter(t => t.weekNumber === currentWeek + 1).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (overdue.length > 0) {
    context += `\n⚠️ OVERDUE (${overdue.length}):\n`;
    for (const t of overdue.slice(0, 8)) {
      const daysLate = Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86400000);
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) was due ${easternDateStr(new Date(t.dueDate))} (${daysLate}d late) priority:${t.priority}\n`;
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
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) due ${easternDateStr(new Date(t.dueDate))} priority:${t.priority}\n`;
    }
  }

  if (nextWeek.length > 0) {
    context += `\nNext week — week ${currentWeek + 1} (${nextWeek.length} tasks):\n`;
    for (const t of nextWeek.slice(0, 6)) {
      context += `  - [#${t.id}] "${t.title}" (${t.type}${t.courseName ? ', ' + t.courseName : ''}) due ${easternDateStr(new Date(t.dueDate))}\n`;
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
