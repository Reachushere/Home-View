// server/serverHelpers.ts
// Module-scope helpers extracted from server/routes.ts (Phase 1 of the
// routes.ts code split per Split_Routes_Guide). All exports here are pure
// top-level declarations with no closure dependencies on registerRoutes.
//
// What lives here:
//   - getRequestAuthLevel
//   - generateRepeatDates
//   - getPdfParser
//   - Centralised configuration constants (HA URLs, entity ids, etc.)
//   - automationLog + aLog
//   - HA fetch / service-call helpers + retry queue
//   - formatLocalDate
//   - FlickDevice / FlickRoomGroup / FLICK_DEVICES (room/device registry)
//   - generateAndSaveTTSAudio
//   - parsePublicObjectPath
//   - cleanTextForTTS
//   - getChunkWithSentenceBoundary
//   - BUILD_VERSION, MAX_CONSECUTIVE_ERRORS, MAX_SESSION_AGE_MS,
//     CHARS_PER_SECOND, CHUNK_SIZE
//
// What still lives in routes.ts (because of mutable closure state):
//   - currentTTSSession + sendNextChunk / scheduleNextChunk / stopTTSSession
//   - isTravellingMode + getIsTravellingMode (plus its mutators)

import type { RepeatType, RepeatIntervalUnit } from "@shared/schema";
import { textToSpeech } from "./replit_integrations/audio/client";

// ─────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────
export function getRequestAuthLevel(req: any): string {
  const cookie = req.cookies?.uni_cal_session;
  if (!cookie) {
    if (!process.env.SITE_PASSWORD) return '5747';
    return '';
  }
  const parts = cookie.split('.');
  if (parts.length === 3) return parts[0];
  if (parts.length === 2) return '5747';
  return '';
}

// ─────────────────────────────────────────────────────────────────────────
// Repeated-task date generator
// ─────────────────────────────────────────────────────────────────────────
export function generateRepeatDates(
  startDueDate: Date,
  repeatType: RepeatType,
  repeatEndDate: Date | null,
  repeatInterval?: number,
  repeatIntervalUnit?: RepeatIntervalUnit,
  repeatSpanDays?: number
): Date[] {
  const dates: Date[] = [];
  if (repeatType === "none") return dates;

  const spanDays = (repeatSpanDays && repeatSpanDays > 1) ? repeatSpanDays : 1;

  // Default end date: 6 months from start (or 5 years for yearly)
  const defaultMs = repeatType === "yearly" ? 5 * 365 * 24 * 60 * 60 * 1000 : 180 * 24 * 60 * 60 * 1000;
  const endDate = repeatEndDate || new Date(startDueDate.getTime() + defaultMs);
  let currentDate = new Date(startDueDate);

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
      case "yearly":
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
      case "custom":
        if (repeatIntervalUnit === "days") {
          newDate.setDate(newDate.getDate() + (repeatInterval || 1));
        } else if (repeatIntervalUnit === "weeks") {
          newDate.setDate(newDate.getDate() + (repeatInterval || 1) * 7);
        } else if (repeatIntervalUnit === "months") {
          newDate.setMonth(newDate.getMonth() + (repeatInterval || 1));
        } else if (repeatIntervalUnit === "years") {
          newDate.setFullYear(newDate.getFullYear() + (repeatInterval || 1));
        }
        break;
    }
    return newDate;
  };

  let count = 0;
  while (count < 200) {
    currentDate = addInterval(currentDate);
    if (currentDate > endDate) break;
    if (spanDays > 1) {
      for (let d = 0; d < spanDays; d++) {
        const spanDate = new Date(currentDate);
        spanDate.setDate(spanDate.getDate() + d);
        if (spanDate > endDate) break;
        dates.push(spanDate);
        count++;
      }
    } else {
      dates.push(new Date(currentDate));
      count++;
    }
  }

  return dates;
}

// ─────────────────────────────────────────────────────────────────────────
// PDF parser dynamic import
// ─────────────────────────────────────────────────────────────────────────
export async function getPdfParser() {
  const { PDFParse } = await import("pdf-parse");
  return PDFParse;
}

// ─────────────────────────────────────────────────────────────────────────
// CENTRALIZED CONFIGURATION
// Change these values in ONE place if URLs or devices change.
// ─────────────────────────────────────────────────────────────────────────
export const DEPLOYED_APP_URL = process.env.DEPLOYED_APP_URL || (process.env.REPL_ID ? `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.repl.co` : "http://localhost:5000");
export const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
export const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);

export const BATHROOM_ECHO_ENTITY = "media_player.bathroom_speaker";
export const KITCHEN_ECHO_ENTITY = "media_player.echo_kitchen_studio_black_am";
export const NEST_SPEAKER_ENTITY = "media_player.bathroom_speaker";
export const CAT_WR_HA_VOICE_ENTITY = "media_player.home_assistant_voice_097c38_media_player";
export const NON_ALEXA_ENTITIES = [NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY];
export const MODULE_READING_PENDING = "input_boolean.module_reading_pending";
export const MODULE_READING_CONFIRMED = "input_boolean.module_reading_confirmed";
export const PARTNER_PHONE_ENTITY = "device_tracker.y_phone_app";
export const HA_CLOUD_TTS_ENTITY = "tts.home_assistant_cloud";
export const CAT_LIGHTS_ENTITY = "light.cat_lights";
export const CAT_TV_ENTITY = "media_player.tv_cat_wr";
export const FIRE_STICK_ADB_ENTITY = "media_player.fire_tv_172_24_0_88";
export const CAT_WR_MEDIA_GROUP = "media_player.cat_washroom_media_group";
export const CAT_ECHO_ENTITIES = [
  "media_player.echo_cat_left_am",
  "media_player.echo_cat_right_am",
  "media_player.echo_cat_washroom_middle",
];

export const SPOTIFYPLUS_ENTITY = "media_player.spotifyplus_byhomeyyz";
export const EVERYWHERE_GROUP_ENTITY = "media_player.byhome";

export const NABU_CASA_URL = "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";

// ─────────────────────────────────────────────────────────────────────────
// Automation log
// ─────────────────────────────────────────────────────────────────────────
export interface AutomationLogEntry {
  ts: string;
  tag: string;
  msg: string;
  data?: any;
}
export const automationLog: AutomationLogEntry[] = [];
export function aLog(tag: string, msg: string, data?: any) {
  const entry: AutomationLogEntry = { ts: new Date().toISOString(), tag, msg, ...(data !== undefined ? { data } : {}) };
  automationLog.push(entry);
  if (automationLog.length > 500) automationLog.shift();
  console.log(`[${tag}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Home Assistant fetch helpers + retry queue
// ─────────────────────────────────────────────────────────────────────────
export async function haFetch(url: string, options: RequestInit = {}, maxRetries = 3, label = 'HA'): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      timer = null;
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 200)}`);
      }
      return resp;
    } catch (e: any) {
      if (timer) clearTimeout(timer);
      const msg = e?.message || String(e);
      if (attempt < maxRetries - 1) {
        const delay = 1500 * (attempt + 1);
        console.warn(`[${label}] fetch attempt ${attempt + 1}/${maxRetries} failed: ${msg} — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`[${label}] All ${maxRetries} fetch attempts failed: ${msg}`);
      }
    }
  }
  throw new Error(`[${label}] Unreachable`);
}

export async function haServiceCall(service: string, data: object, label = 'HA'): Promise<Response> {
  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
  return haFetch(`${haUrl}/api/services/${service}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, 3, label);
}

interface QueuedHACommand {
  service: string;
  data: object;
  label: string;
  queuedAt: number;
  attempts: number;
}
export const haCommandQueue: QueuedHACommand[] = [];
export const HA_QUEUE_MAX_AGE_MS = 5 * 60 * 1000;
export const HA_QUEUE_MAX_SIZE = 50;
let haQueueProcessing = false;
export function isHAQueueProcessing(): boolean { return haQueueProcessing; }

export async function processHACommandQueue(): Promise<void> {
  if (haQueueProcessing || haCommandQueue.length === 0) return;
  haQueueProcessing = true;
  try {
    let remaining = haCommandQueue.length;
    for (let processed = 0; processed < remaining; processed++) {
      const cmd = haCommandQueue.shift();
      if (!cmd) break;
      const now = Date.now();
      if (now - cmd.queuedAt > HA_QUEUE_MAX_AGE_MS) {
        console.log(`[HA Queue] Expired command dropped: ${cmd.label} ${cmd.service} (queued ${Math.round((now - cmd.queuedAt) / 1000)}s ago)`);
        continue;
      }
      try {
        await haServiceCall(cmd.service, cmd.data, `${cmd.label} [Replayed]`);
        console.log(`[HA Queue] Successfully replayed: ${cmd.label} ${cmd.service} (was queued ${Math.round((now - cmd.queuedAt) / 1000)}s ago)`);
      } catch (e: any) {
        cmd.attempts++;
        if (cmd.attempts >= 3) {
          console.warn(`[HA Queue] Giving up on: ${cmd.label} ${cmd.service} after ${cmd.attempts} attempts`);
        } else {
          haCommandQueue.push(cmd);
          console.warn(`[HA Queue] Replay failed (attempt ${cmd.attempts}): ${cmd.label} ${cmd.service} — moved to back of queue`);
        }
      }
    }
  } finally {
    haQueueProcessing = false;
  }
}

export async function haServiceCallSafe(service: string, data: object, label = 'HA'): Promise<boolean> {
  try {
    await haServiceCall(service, data, label);
    if (haCommandQueue.length > 0 && !haQueueProcessing) {
      processHACommandQueue().catch(() => {});
    }
    return true;
  } catch (e: any) {
    console.warn(`[HA Safe] ${label} ${service} failed: ${e.message} — queuing for retry`);
    if (haCommandQueue.length < HA_QUEUE_MAX_SIZE) {
      haCommandQueue.push({ service, data, label, queuedAt: Date.now(), attempts: 1 });
    } else {
      console.warn(`[HA Queue] Queue full (${HA_QUEUE_MAX_SIZE}) — dropping: ${label} ${service}`);
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Date formatter (local YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Flick device registry (room → devices)
// ─────────────────────────────────────────────────────────────────────────
export interface FlickDevice {
  id: string;
  name: string;
  entityId: string;
  type: "tablet" | "echo" | "echo_show" | "tv" | "speaker" | "group";
  canDisplay: boolean;
  room: string;
}

export interface FlickRoomGroup {
  room: string;
  icon: string;
  devices: FlickDevice[];
}

export const FLICK_DEVICES: FlickRoomGroup[] = [
  {
    room: "Hallway", icon: "🚪",
    devices: [
      { id: "hallway_tablet_entrance", name: "Tablet (Entrance)", entityId: "media_player.tablet_hallway_entrance", type: "tablet", canDisplay: true, room: "Hallway" },
      { id: "hallway_tablet", name: "Tablet (Main)", entityId: "media_player.tablet_hallway", type: "tablet", canDisplay: true, room: "Hallway" },
      { id: "hallway_echo_entrance", name: "Echo (Entrance)", entityId: "media_player.echo_hallway_entrance_am", type: "echo", canDisplay: false, room: "Hallway" },
      { id: "hallway_group", name: "All Hallway", entityId: "media_player.hallway_media_group", type: "group", canDisplay: false, room: "Hallway" },
    ]
  },
  {
    room: "Living Room", icon: "🛋️",
    devices: [
      { id: "lr_tablet", name: "Fire Tablet (11)", entityId: "media_player.tablet_11", type: "tablet", canDisplay: true, room: "Living Room" },
      { id: "lr_echo_couch_l", name: "Echo (Couch L)", entityId: "media_player.echo_lr_couch_l_am", type: "echo", canDisplay: false, room: "Living Room" },
      { id: "lr_echo_couch_r", name: "Echo (Couch R)", entityId: "media_player.echo_lr_couch_r_am", type: "echo", canDisplay: false, room: "Living Room" },
      { id: "lr_echo_hub", name: "Echo (Hub)", entityId: "media_player.echo_lr_hub_am", type: "echo", canDisplay: false, room: "Living Room" },
      { id: "lr_echo_studio", name: "Echo Studio (White)", entityId: "media_player.echo_lr_studio_white_am", type: "echo", canDisplay: false, room: "Living Room" },
      { id: "lr_echo_tv_shelf", name: "Echo (TV Shelf)", entityId: "media_player.echo_lr_tv_shelf_am", type: "echo", canDisplay: false, room: "Living Room" },
      { id: "lr_tv", name: "TV (70\")", entityId: "media_player.tv_living_room_70", type: "tv", canDisplay: true, room: "Living Room" },
      { id: "lr_group", name: "All Living Room", entityId: "media_player.living_room_media_group", type: "group", canDisplay: false, room: "Living Room" },
    ]
  },
  {
    room: "King Bedroom", icon: "🛏️",
    devices: [
      { id: "king_tablet", name: "Tablet", entityId: "media_player.bd24bb29_04a116d8_king", type: "tablet", canDisplay: true, room: "King Bedroom" },
      { id: "king_echo_l", name: "Echo (Left)", entityId: "media_player.echo_king_l_am", type: "echo", canDisplay: false, room: "King Bedroom" },
      { id: "king_echo_r", name: "Echo (Right)", entityId: "media_player.echo_king_r_am", type: "echo", canDisplay: false, room: "King Bedroom" },
      { id: "king_echo_tv", name: "Echo (TV)", entityId: "media_player.echo_king_tv_am", type: "echo", canDisplay: false, room: "King Bedroom" },
      { id: "king_tv", name: "TV", entityId: "media_player.tv_king", type: "tv", canDisplay: true, room: "King Bedroom" },
      { id: "king_group", name: "All King Bedroom", entityId: "media_player.king_bedroom_media_group", type: "group", canDisplay: false, room: "King Bedroom" },
    ]
  },
  {
    room: "Queen Bedroom", icon: "👑",
    devices: [
      { id: "queen_tablet", name: "Tablet", entityId: "media_player.tablet_queen", type: "tablet", canDisplay: true, room: "Queen Bedroom" },
      { id: "queen_echo_balcony", name: "Echo (Balcony)", entityId: "media_player.echo_queen_balcony_am", type: "echo", canDisplay: false, room: "Queen Bedroom" },
      { id: "queen_echo_bed_l", name: "Echo (Bed L)", entityId: "media_player.echo_queen_bed_l_am", type: "echo", canDisplay: false, room: "Queen Bedroom" },
      { id: "queen_echo_bed_r", name: "Echo (Bed R)", entityId: "media_player.echo_queen_bed_r_am", type: "echo", canDisplay: false, room: "Queen Bedroom" },
      { id: "queen_group", name: "All Queen Bedroom", entityId: "media_player.queen_bedroom_media_group", type: "group", canDisplay: false, room: "Queen Bedroom" },
    ]
  },
  {
    room: "Kitchen", icon: "🍳",
    devices: [
      { id: "kitchen_tablet", name: "Tablet (Kitchen Island)", entityId: "media_player.tablet_kitchen_island", type: "tablet", canDisplay: true, room: "Kitchen" },
      { id: "kitchen_echo_cupboards_l", name: "Echo (Cupboards L)", entityId: "media_player.echo_kitchen_cupboards_left_am", type: "echo", canDisplay: false, room: "Kitchen" },
      { id: "kitchen_echo_cupboards_r", name: "Echo (Cupboards R)", entityId: "media_player.echo_kitchen_cupboards_r_am", type: "echo", canDisplay: false, room: "Kitchen" },
      { id: "kitchen_echo_fridge", name: "Echo (Fridge)", entityId: "media_player.echo_kitchen_fridge_am", type: "echo", canDisplay: false, room: "Kitchen" },
      { id: "kitchen_echo_hutch", name: "Echo (Hutch)", entityId: "media_player.echo_kitchen_hutch_am", type: "echo", canDisplay: false, room: "Kitchen" },
      { id: "kitchen_echo_island", name: "Echo (Island Corner)", entityId: "media_player.echo_kitchen_island_corner_am", type: "echo", canDisplay: false, room: "Kitchen" },
      { id: "kitchen_echo_studio", name: "Echo Studio (Black)", entityId: "media_player.echo_kitchen_studio_black_am", type: "echo", canDisplay: false, room: "Kitchen" },
      { id: "kitchen_tv", name: "TV", entityId: "media_player.tv_kitchen", type: "tv", canDisplay: true, room: "Kitchen" },
      { id: "kitchen_group", name: "All Kitchen", entityId: "media_player.kitchen_media_group", type: "group", canDisplay: false, room: "Kitchen" },
    ]
  },
  {
    room: "Cat Washroom", icon: "🐱",
    devices: [
      { id: "cat_tablet", name: "Tablet", entityId: "media_player.tablet_cat", type: "tablet", canDisplay: true, room: "Cat Washroom" },
      { id: "cat_echo_middle", name: "Echo (Middle)", entityId: "media_player.echo_cat_washroom_middle", type: "echo", canDisplay: false, room: "Cat Washroom" },
      { id: "cat_echo_left", name: "Echo (Left)", entityId: "media_player.echo_cat_left_am", type: "echo", canDisplay: false, room: "Cat Washroom" },
      { id: "cat_echo_right", name: "Echo (Right)", entityId: "media_player.echo_cat_right_am", type: "echo", canDisplay: false, room: "Cat Washroom" },
      { id: "cat_nest", name: "Nest Speaker", entityId: "media_player.bathroom_speaker", type: "speaker", canDisplay: false, room: "Cat Washroom" },
      { id: "cat_tv", name: "TV", entityId: CAT_TV_ENTITY, type: "tv", canDisplay: true, room: "Cat Washroom" },
      { id: "cat_group", name: "All Cat Washroom", entityId: CAT_WR_MEDIA_GROUP, type: "group", canDisplay: false, room: "Cat Washroom" },
    ]
  },
  {
    room: "Pug Washroom", icon: "🐶",
    devices: [
      { id: "pug_echo_show", name: "Echo Show", entityId: "media_player.echo_show_pug_am", type: "echo_show", canDisplay: true, room: "Pug Washroom" },
      { id: "pug_group", name: "All Pug Washroom", entityId: "media_player.pug_media_group", type: "group", canDisplay: false, room: "Pug Washroom" },
    ]
  },
  {
    room: "Closet", icon: "👔",
    devices: [
      { id: "closet_echo", name: "Echo", entityId: "media_player.echo_closet_am", type: "echo", canDisplay: false, room: "Closet" },
      { id: "closet_group", name: "All Closet", entityId: "media_player.closet_media_group", type: "group", canDisplay: false, room: "Closet" },
    ]
  },
  {
    room: "Everywhere", icon: "🏠",
    devices: [
      { id: "everywhere", name: "All Speakers", entityId: EVERYWHERE_GROUP_ENTITY, type: "group", canDisplay: false, room: "Everywhere" },
    ]
  },
];

// ─────────────────────────────────────────────────────────────────────────
// TTS session shared constants (the mutable session itself stays in routes.ts)
// ─────────────────────────────────────────────────────────────────────────
export const MAX_CONSECUTIVE_ERRORS = 5;
export const MAX_SESSION_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours max session
// Alexa TTS at 90% speed: ~180 wpm = ~900 chars/min = ~15 chars/sec
// Conservative estimate to avoid cutting off speech mid-sentence
export const CHARS_PER_SECOND = 13;
export const CHUNK_SIZE = 2000;

// ─────────────────────────────────────────────────────────────────────────
// Generate OpenAI TTS audio and save locally for HA media_player playback
// ─────────────────────────────────────────────────────────────────────────
export async function generateAndSaveTTSAudio(text: string, fileId: string, voice: string = "echo", slowPace: boolean = false): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  const ttsDir = path.join(process.cwd(), 'dist', 'public', 'tts-audio');
  if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });

  // Normalize text for TTS
  let normalizedText = text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/doi:[^\s]+/gi, '')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
    .replace(/\([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)*,?\s*\d{4}[a-z]?\)/g, '')
    .replace(/pp?\.\s*\d+(?:\s*[-–]\s*\d+)?/gi, '')
    .replace(/\([^)]{50,}\)/g, '')
    .replace(/[–—]/g, ', ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4096); // OpenAI limit

  console.log(`Generating Edge TTS for ${normalizedText.length} chars, file: ${fileId}`);

  const ttsStart = Date.now();
  const audioBuffer = await textToSpeech(normalizedText, voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer", "mp3", slowPace);
  console.log(`Edge TTS completed in ${Date.now() - ttsStart}ms, ${audioBuffer.length} bytes`);

  if (audioBuffer.length === 0) {
    throw new Error(`TTS returned empty audio buffer for file: ${fileId}`);
  }

  const audioFileName = `${fileId}-${Date.now()}.mp3`;
  fs.writeFileSync(path.join(ttsDir, audioFileName), audioBuffer);
  const proxyUrl = `/tts-audio/${audioFileName}`;
  console.log(`TTS audio saved locally: ${proxyUrl}`);
  return proxyUrl;
}

// ─────────────────────────────────────────────────────────────────────────
// Parse public object path to bucket/object name
// ─────────────────────────────────────────────────────────────────────────
export function parsePublicObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Invalid path");
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

// ─────────────────────────────────────────────────────────────────────────
// Clean text for TTS — remove URLs, citations, tab-panel artefacts, French
// abstracts, references, footnotes, etc.
// ─────────────────────────────────────────────────────────────────────────
export function cleanTextForTTS(text: string): string {
  console.log("cleanTextForTTS input length:", text.length);

  // First pass: Remove URLs, emails, video/audio references, timestamps
  let cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/^Video\s+.+$/gm, '')
    .replace(/^Audio\s+.+$/gm, '')
    .replace(/^Link\s+.+$/gm, '')
    .replace(/^Watch\s+.+$/gm, '')
    .replace(/^Listen\s+.+$/gm, '')
    .replace(/^Click\s+.+$/gm, '')
    .replace(/click[\s-]*n[\s-]*reveal/gi, '')
    .replace(/\bn\.d\.\b/g, '')
    .replace(/\([^)]*n\.d\.[^)]*\)/g, '')
    .replace(/\[[^\]]*n\.d\.[^\]]*\]/g, '')
    .replace(/\d+:\d+:\d+/g, '')
    .replace(/\d+:\d+/g, '')
    .replace(/\((?:[A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)*(?:,?\s*(?:et\s+al\.?)?)?(?:,?\s*\d{4}[a-z]?)?\s*(?:,\s*(?:p+\.\s*\d[\d\s,-]*|ch(?:apter)?\.?\s*\d+))?)\)/gi, '')
    .replace(/\((?:\d{4}[a-z]?)\)/g, '')
    .replace(/\([^)]{0,5}\d{4}[a-z]?[^)]{0,5}\)/g, '')
    .replace(/\[[^\]]*\d{4}[^\]]*\]/g, '')
    .replace(/\[\d+(?:[,;\s]+\d+)*\]/g, '')
    .replace(/\b(?:et\s+al\.?)\b/gi, '')
    .replace(/\b(?:pp?\.)\s*\d[\d\s,-]*/g, '')
    .replace(/\b(?:vol\.?|issue|no\.)\s*\d+/gi, '')
    .replace(/\b(?:doi|DOI)\s*[:.]?\s*\S+/g, '')
    .replace(/\b(?:ISBN|ISSN)\s*[:.]?\s*[\d-]+/g, '')
    .replace(/\b(?:Retrieved|Accessed)\s+(?:from|on)\b[^.]*\./gi, '')
    .replace(/^\s*(?:References?|Works?\s+Cited|Bibliography)\s*$/gim, '')
    .replace(/^[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*(?:[A-Z]\.?\s*)?)?(?:,?\s*(?:&|and)\s+[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*(?:[A-Z]\.?\s*)?)?)*\s*\(\d{4}[a-z]?\)\.\s*.+$/gm, '')
    .replace(/^[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*)+(?:,?\s*(?:&|and)\s+[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*)+)*\.\s*\(\d{4}[a-z]?\)\./gm, '');

  console.log("After URL/timestamp/citation cleanup:", cleanedText.length);

  // JSTOR-specific lines
  cleanedText = cleanedText
    .replace(/^This content downloaded from.*$/gm, '')
    .replace(/^All use subject to.*$/gm, '')
    .replace(/---PAGE---/g, '. ')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^CJUR?\s*\d+:\d+.*$/gm, '')
    .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/gm, '');

  // Copyright notices and publisher boilerplate
  cleanedText = cleanedText
    .replace(/Copyright\s+\d{4}\s+Nelson Education Ltd\.?\s*All Rights Reserved\.?\s*May not be copied[\s\S]*?(?:require it|permitted)\./gi, '')
    .replace(/Copyright\s+\d{4}\s+.*?All Rights Reserved\.?/gi, '')
    .replace(/May not be copied,?\s*scanned,?\s*or duplicated.*?(?:require it|permitted)\./gi, '')
    .replace(/Due to electronic rights,?\s*some third.party content may be suppressed.*?(?:require it)\./gi, '')
    .replace(/Nelson Education reserves the right to remove additional content at any time if subsequent rights restrictions require it\./gi, '')
    .replace(/Nelson Education Ltd\.?/gi, '')
    .replace(/\(c\)\s+[^\n.]+(?:Press|Publishing|Books|Media|Photos?|Images?|Reuters|Getty|AP|Corbis|Alamy|Shutterstock|iStock|ZUMA)[^\n.]*/gi, '')
    .replace(/^\s*\d{1,3}\s+(?:Local Government|NEL)\b.*$/gm, '')
    .replace(/\bNEL\b/g, '')
    .replace(/^\d+\s+See\s+.*$/gm, '')
    .replace(/^\d+\s+[A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+,\s+.*$/gm, '');

  console.log("After JSTOR cleanup:", cleanedText.length);

  // French abstracts
  cleanedText = cleanedText
    .replace(/R\s*sum[^]*?(?=Abstract|Introduction|The\s|This\s|In\s)/gi, '')
    .replace(/Résumé[^]*?(?=Abstract|Introduction|The\s|This\s|In\s)/gi, '');

  const chunks = cleanedText.split(/(?<=[.!?])\s+|\n+/);
  const englishChunks = chunks.filter(chunk => {
    const trimmed = chunk.trim();
    if (trimmed.length < 20) return true;

    const frenchWordPatterns = [
      /\b(le|la|les|du|des|au|aux|un|une)\b/gi,
      /\b(et|ou|que|qui|dont|dans|sur|pour|par|avec|sans)\b/gi,
      /\b(je|tu|il|elle|nous|vous|ils|elles|on)\b/gi,
      /\b(est|sont|ont|fait|peut|doit|cette|ces|cette)\b/gi,
      /\b(gouvernement|municipale?|canadien|question|politique)\b/gi,
    ];

    let frenchWordCount = 0;
    for (const pattern of frenchWordPatterns) {
      const matches = trimmed.match(pattern);
      if (matches) frenchWordCount += matches.length;
    }

    const accentedCount = (trimmed.match(/[àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g) || []).length;

    const words = trimmed.split(/\s+/).length;
    const frenchScore = frenchWordCount + (accentedCount * 2);
    const frenchRatio = frenchScore / words;

    return frenchRatio < 0.25;
  });
  cleanedText = englishChunks.join(' ');

  console.log("After French filter:", cleanedText.length);

  // References / Bibliography sections
  cleanedText = cleanedText
    .replace(/(?:^|\n)\s*(?:References|Bibliography|Works?\s*Cited|Literature\s*Cited|Sources?\s*Cited|Endnotes|Footnotes|Notes)\s*\n[\s\S]*$/gim, '')
    .replace(/(?:^|\n)\s*(?:References|Bibliography|Works?\s*Cited)\s*(?:\n|$)[\s\S]*$/gim, '')
    .replace(/\b(?:References|Bibliography|Works?\s*Cited|Reference\s*List)\s+(?:[A-Z][a-z]+,?\s+[A-Z]\.[\s\S]*$)/gim, '');

  // Inline APA/MLA citations
  cleanedText = cleanedText
    .replace(/\([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*(?:,?\s*(?:et\s+al\.?))?,?\s*\d{4}[a-z]?(?:,\s*p{1,2}\.\s*\d+(?:-\d+)?)?\)/g, '')
    .replace(/\([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*,?\s*n\.d\.(?:,\s*p{1,2}\.\s*\d+(?:-\d+)?)?\)/g, '');

  // Standalone reference-style lines
  cleanedText = cleanedText
    .replace(/^[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s+\(\d{4}\)\..*$/gm, '')
    .replace(/^[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s+(?:and|&)\s+[A-Z][a-z]+,\s+[A-Z]\..*\(\d{4}\)\..*$/gm, '')
    .replace(/^[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4},\s+\w+\s+\d+\)\..*$/gm, '');

  // Dense citation blocks
  cleanedText = cleanedText
    .replace(/(?:[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s*(?:,?\s*(?:&|and)\s+[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s*)*\(\d{4}[a-z]?\)\.\s*[^.]*\.\s*(?:[A-Z][a-z]+[^.]*\.\s*)?(?:\d+\([^)]*\)[^.]*\.\s*)?){2,}/g, '');

  // Section headings
  cleanedText = cleanedText
    .replace(/^(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?|Key Takeaways|Coming Up Next|Discussions? and Assignments?|Reminder|Tab Panels?.*|Tab:.*)\s*$/gim, '')
    .replace(/^(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?)\s+/gim, '');

  // Tab/accordion artefacts (D2L/Brightspace)
  cleanedText = cleanedText
    .replace(/\bTab\s*Panels?\b/g, '')
    .replace(/\btab\s*panels?\b/gi, '')
    .replace(/\btab\s*\d+\b/gi, '')
    .replace(/\btab\s+expand\b/gi, '')
    .replace(/\btab\s+collapse\b/gi, '')
    .replace(/\btab\s+selected\b/gi, '')
    .replace(/\btab\s+unselected\b/gi, '')
    .replace(/\bselected\s+tab\b/gi, '')
    .replace(/\bcurrent\s+tab\b/gi, '')
    .replace(/\bexpand\s+tab\b/gi, '')
    .replace(/\bcollapse\s+tab\b/gi, '')
    .replace(/\btabs?\s*:/gi, '')
    .replace(/\bexpand\s+all\b/gi, '')
    .replace(/\bcollapse\s+all\b/gi, '')
    .replace(/\(expanded\)/gi, '')
    .replace(/\(collapsed\)/gi, '')
    .replace(/\(selected\)/gi, '')
    .replace(/\(unselected\)/gi, '')
    .replace(/\(active\)/gi, '')
    .replace(/\(inactive\)/gi, '')
    .replace(/\bTab\b/g, '')
    .replace(/\btab\b/g, '');

  cleanedText = cleanedText
    .replace(/x{3,}/gi, '')
    .replace(/(?:X[\s,;]+){2,}X?\b/g, '')
    .replace(/(?:\bX\b[\s,;]*){3,}/g, '')
    .replace(/\s+X(?=\s+[A-Z]|\s*$)/g, ' ')
    .replace(/\b(?:AB|BC|MB|NB|NL|NS|ON|PE[I]?|QC|SK)(?:[,;\s/]+(?:AB|BC|MB|NB|NL|NS|ON|PE[I]?|QC|SK)){1,}\b/g, '')
    .replace(/\bMunicipal Responsibility\s+(?:NL|PEI?|NS|NB|QC|ON|MB|SK|AB|BC)[\s\w]*(?:AB|BC)\b/g, '')
    .replace(/^.*(?:AB|BC|MB|NB|NL|NS|ON|PE[I]?|QC|SK)\s+(?:AB|BC|MB|NB|NL|NS|ON|PE[I]?|QC|SK).*$/gm, '');

  // Spaced-out headings like "ar e po l i T i c a l"
  cleanedText = cleanedText
    .replace(/(?:[a-zA-Z]\s+){5,}[a-zA-Z]/g, '');

  // Inline footnote numbers
  cleanedText = cleanedText
    .replace(/(?<=\w)(\d{1,3})(?=\s+[A-Z])/g, '')
    .replace(/\b\d{1,2}\s+(?:See|Ibid|Op\.?\s*cit|Supra|Infra)\b.*$/gm, '');

  // Final cleanup
  let result = cleanedText
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[<>]/g, '')
    .replace(/[^\w\s.,!?;:'"()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove headings that ended up inline after whitespace collapse
  result = result
    .replace(/(\.\s+)(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?|Key Takeaways|Coming Up Next|Discussions? and Assignments?|Reminder)\s+/gi, '$1')
    .replace(/^(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?|Key Takeaways|Coming Up Next|Discussions? and Assignments?|Reminder)\s+/i, '');

  console.log("Final cleaned length:", result.length);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Get chunk respecting sentence boundary
// ─────────────────────────────────────────────────────────────────────────
export function getChunkWithSentenceBoundary(text: string, maxLength: number): string {
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

// ─────────────────────────────────────────────────────────────────────────
// Build version (re-evaluated on each module load)
// ─────────────────────────────────────────────────────────────────────────
export const BUILD_VERSION = Date.now().toString();
