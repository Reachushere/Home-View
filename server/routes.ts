import type { Express } from "express";
import express from "express";
import type { Server } from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { getWeekDates, getWeekNumber, FIRST_WEEK, LAST_WEEK, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2, COURSES, type RepeatType, type RepeatIntervalUnit, type InsertTask, type FileRecord, degreeTrackingData, feedbackNotes, insertFeedbackNoteSchema, appState, announcements } from "@shared/schema";
import { z } from "zod";
import { LIBERAL_STUDIES_COURSES, OPEN_ELECTIVE_COURSES } from "@shared/electiveCourses";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, listEvents, listCalendars, createPrepCalendarEvent, updatePrepCalendarEvent, createEventInCalendar, deleteEventFromCalendar, createRecurringClassEvent, findExistingEventBySummary, findAndDeleteDuplicateEvents, createYearlyScholarshipEvent } from "./googleCalendar";
import { getSecondAccountAuthUrl, exchangeCodeForTokens, isSecondAccountConnected, disconnectSecondAccount, createEventInSecondAccount, createPrepEventInSecondAccount, deleteEventFromSecondAccount, updateEventInSecondAccount, getEventsFromSecondAccount } from "./secondGoogleAccount";
import { getThirdAccountAuthUrl, exchangeCodeForTokensThird, isThirdAccountConnected, disconnectThirdAccount, getEventsFromThirdAccount, listThirdAccountCalendars, getEventsFromThirdAccountCalendar } from "./thirdGoogleAccount";
import { textToSpeech, initTTSFallbackStatus } from "./replit_integrations/audio/client";
import { sendTestEmail, sendTaskReminder, sendDailyDigest, sendTestSms, sendSmsReminder, sendTestHaPush, sendHaTaskReminder, sendEchoVoiceAnnouncement, sendCalendarInvite, type TaskReminder } from "./email";
import { syncOutlookEventsToReview, fetchOutlookCalendarEvents, findOrCreateMailFolder, createMailRule, moveExistingEmailsToFolder, moveAllEmailsFromFolder, deleteMailRulesByName, getMailFolderId, moveEmailsNotFromDomains } from "./outlookCalendar";
import { parseTickerCommand, extractInlineExpiry } from "./gmailTicker";
// fetchD2LAnnouncements available in ./gmail but Gmail connector lacks read scope; D2L sync handled by external Apps Script
import { getSchedulerStatus } from "./reminderScheduler";
import { fetchTMUCalendarEvents } from "./tmuCalendar";
import { listOneDriveItems, getOneDriveFile, searchOneDriveFiles, createOneDriveFolder, getOneDriveFileContentAsText, getOneDriveItemByPath, createOneDriveTextFile, updateOneDriveFileContent, deleteOneDriveItem } from "./onedrive";
import * as spotifyApi from "./spotify";

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

// Dynamic import for pdf-parse v2
async function getPdfParser() {
  const { PDFParse } = await import("pdf-parse");
  return PDFParse;
}

// ===== CENTRALIZED CONFIGURATION =====
// Change these values in ONE place if URLs or devices change.
const DEPLOYED_APP_URL = process.env.DEPLOYED_APP_URL || "https://home-view--bkh416.replit.app";
const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);

const BATHROOM_ECHO_ENTITY = "media_player.bathroom_speaker";
const KITCHEN_ECHO_ENTITY = "media_player.echo_kitchen_studio_black_am";
const NEST_SPEAKER_ENTITY = "media_player.bathroom_speaker";
const CAT_WR_HA_VOICE_ENTITY = "media_player.home_assistant_voice_097c38_media_player";
const NON_ALEXA_ENTITIES = [NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY];
const MODULE_READING_PENDING = "input_boolean.module_reading_pending";
const MODULE_READING_CONFIRMED = "input_boolean.module_reading_confirmed";
const PARTNER_PHONE_ENTITY = "device_tracker.y_phone_app";
const HA_CLOUD_TTS_ENTITY = "tts.home_assistant_cloud";
const CAT_LIGHTS_ENTITY = "light.cat_lights";
const CAT_TV_ENTITY = "media_player.tv_cat_wr";
const CAT_WR_MEDIA_GROUP = "media_player.cat_washroom_media_group";
const CAT_ECHO_ENTITIES = [
  "media_player.echo_cat_left_am",
  "media_player.echo_cat_right_am",
  "media_player.echo_cat_washroom_middle",
];

const SPOTIFYPLUS_ENTITY = "media_player.spotifyplus_byhomeyyz";
const EVERYWHERE_GROUP_ENTITY = "media_player.byhome";

async function haFetch(url: string, options: RequestInit = {}, maxRetries = 3, label = 'HA'): Promise<Response> {
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

async function haServiceCall(service: string, data: object, label = 'HA'): Promise<Response> {
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
const haCommandQueue: QueuedHACommand[] = [];
const HA_QUEUE_MAX_AGE_MS = 5 * 60 * 1000;
const HA_QUEUE_MAX_SIZE = 50;
let haQueueProcessing = false;

async function processHACommandQueue(): Promise<void> {
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

async function haServiceCallSafe(service: string, data: object, label = 'HA'): Promise<boolean> {
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

import { easternNow as torontoDate, easternDateStr, easternHour, easternMidnight, taskDateStr, addDays } from "./timezone";

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface FlickDevice {
  id: string;
  name: string;
  entityId: string;
  type: "tablet" | "echo" | "echo_show" | "tv" | "speaker" | "group";
  canDisplay: boolean;
  room: string;
}

interface FlickRoomGroup {
  room: string;
  icon: string;
  devices: FlickDevice[];
}

const FLICK_DEVICES: FlickRoomGroup[] = [
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

// Track travelling state (synced from client) to suppress Echo announcements
let isTravellingMode = false;
let travelStartDate: string | null = null;
let travelEndDate: string | null = null;
export function getIsTravellingMode(): boolean {
  if (isTravellingMode && travelStartDate && travelEndDate) {
    const now = new Date();
    const start = new Date(travelStartDate);
    const end = new Date(travelEndDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return now >= start && now <= end;
    }
  }
  return isTravellingMode;
}

// Track TTS reading session for resume functionality
interface TTSSession {
  fullText: string;
  currentPosition: number;
  startTime: number;
  isPlaying: boolean;
  autoTimer: ReturnType<typeof setTimeout> | null;
  targetEntity?: string;
  consecutiveErrors: number;
  sessionCreatedAt: number;
}
let currentTTSSession: TTSSession | null = null;
const MAX_CONSECUTIVE_ERRORS = 5;
const MAX_SESSION_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours max session
// Alexa TTS at 90% speed: ~180 wpm = ~900 chars/min = ~15 chars/sec
// Use conservative estimate to avoid cutting off speech mid-sentence
const CHARS_PER_SECOND = 13; // Conservative: let chunk finish before sending next
const CHUNK_SIZE = 2000; // Characters per TTS chunk

// Helper to generate OpenAI TTS audio and save to object storage for playback
async function generateAndSaveTTSAudio(text: string, fileId: string, voice: string = "echo", slowPace: boolean = false): Promise<string> {
  const publicPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0]?.trim();
  if (!publicPath) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
  }
  
  // Normalize text for TTS
  let normalizedText = text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/doi:[^\s]+/gi, '')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
    .replace(/\([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)*,?\s*\d{4}[a-z]?\)/g, '')
    .replace(/pp?\.\s*\d+(?:\s*[-–]\s*\d+)?/gi, '')
    .replace(/\([^)]{50,}\)/g, '')
    .replace(/[–—]/g, ', ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4096); // OpenAI limit
  
  console.log(`Generating OpenAI TTS for ${normalizedText.length} chars, file: ${fileId}`);
  
  const ttsStart = Date.now();
  const audioBuffer = await textToSpeech(normalizedText, voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer", "mp3", slowPace);
  console.log(`OpenAI TTS completed in ${Date.now() - ttsStart}ms, ${audioBuffer.length} bytes`);
  
  if (audioBuffer.length === 0) {
    throw new Error(`TTS returned empty audio buffer for file: ${fileId}`);
  }
  
  const audioFileName = `tts-audio/${fileId}-${Date.now()}.mp3`;
  const { bucketName, objectName } = parsePublicObjectPath(`${publicPath}/${audioFileName}`);
  
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  await new Promise<void>((resolve, reject) => {
    const stream = file.createWriteStream({
      contentType: 'audio/mpeg',
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
      resumable: false,
    });
    stream.on('finish', () => resolve());
    stream.on('error', (err: any) => reject(err));
    stream.end(audioBuffer);
  });
  
  // Return a proxy URL through the app (object storage public access is blocked)
  const proxyUrl = `/api/tts-audio/${encodeURIComponent(audioFileName)}`;
  console.log(`TTS audio saved, proxy path: ${proxyUrl}`);
  return proxyUrl;
}

// Parse public object path to bucket/object name
function parsePublicObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Invalid path");
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

// Clean text for TTS - remove special characters that cause errors
function cleanTextForTTS(text: string): string {
  console.log("cleanTextForTTS input length:", text.length);
  
  // First pass: Remove URLs, emails, video/audio references, timestamps
  let cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // Remove email addresses
    .replace(/^Video\s+.+$/gm, '') // Lines starting with "Video"
    .replace(/^Audio\s+.+$/gm, '') // Lines starting with "Audio"
    .replace(/^Link\s+.+$/gm, '') // Lines starting with "Link"
    .replace(/^Watch\s+.+$/gm, '') // Lines starting with "Watch"
    .replace(/^Listen\s+.+$/gm, '') // Lines starting with "Listen"
    .replace(/^Click\s+.+$/gm, '') // Lines starting with "Click"
    .replace(/click[\s-]*n[\s-]*reveal/gi, '') // Remove "click-n-reveal" references
    .replace(/\bn\.d\.\b/g, '') // Remove standalone "n.d."
    .replace(/\([^)]*n\.d\.[^)]*\)/g, '') // Remove bracketed citations containing "n.d." like "(Author, n.d.)"
    .replace(/\[[^\]]*n\.d\.[^\]]*\]/g, '') // Remove square-bracketed references containing "n.d."
    .replace(/\d+:\d+:\d+/g, '') // Remove timestamps like 1:23:45
    .replace(/\d+:\d+/g, '') // Remove timestamps like 1:23
    .replace(/\((?:[A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)*(?:,?\s*(?:et\s+al\.?)?)?(?:,?\s*\d{4}[a-z]?)?\s*(?:,\s*(?:p+\.\s*\d[\d\s,-]*|ch(?:apter)?\.?\s*\d+))?)\)/gi, '') // Remove parenthetical citations like (Smith, 2019), (Jones & Lee, 2020, pp. 45-67), (Brown et al., 2018)
    .replace(/\((?:\d{4}[a-z]?)\)/g, '') // Remove standalone year citations like (2019)
    .replace(/\([^)]{0,5}\d{4}[a-z]?[^)]{0,5}\)/g, '') // Remove short bracketed items with years like (2019a), (p. 2019)
    .replace(/\[[^\]]*\d{4}[^\]]*\]/g, '') // Remove square-bracketed references with years like [Smith, 2019]
    .replace(/\[\d+(?:[,;\s]+\d+)*\]/g, '') // Remove numeric citations like [1], [2,3], [1; 2; 3]
    .replace(/\b(?:et\s+al\.?)\b/gi, '') // Remove standalone "et al."
    .replace(/\b(?:pp?\.)\s*\d[\d\s,-]*/g, '') // Remove page references like p. 45, pp. 123-456
    .replace(/\b(?:vol\.?|issue|no\.)\s*\d+/gi, '') // Remove volume/issue references
    .replace(/\b(?:doi|DOI)\s*[:.]?\s*\S+/g, '') // Remove DOI references
    .replace(/\b(?:ISBN|ISSN)\s*[:.]?\s*[\d-]+/g, '') // Remove ISBN/ISSN
    .replace(/\b(?:Retrieved|Accessed)\s+(?:from|on)\b[^.]*\./gi, '') // Remove "Retrieved from..." lines
    .replace(/^\s*(?:References?|Works?\s+Cited|Bibliography)\s*$/gim, '') // Remove reference section headers
    .replace(/^[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*(?:[A-Z]\.?\s*)?)?(?:,?\s*(?:&|and)\s+[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*(?:[A-Z]\.?\s*)?)?)*\s*\(\d{4}[a-z]?\)\.\s*.+$/gm, '') // Remove full reference entries like "Smith, J. A. (2019). Title of article..."
    .replace(/^[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*)+(?:,?\s*(?:&|and)\s+[A-Z][a-z]+(?:,\s*[A-Z]\.?\s*)+)*\.\s*\(\d{4}[a-z]?\)\./gm, ''); // Remove APA author-date entries
  
  console.log("After URL/timestamp/citation cleanup:", cleanedText.length);
  
  // Remove JSTOR-specific lines (not entire paragraphs - just specific lines)
  cleanedText = cleanedText
    .replace(/^This content downloaded from.*$/gm, '')
    .replace(/^All use subject to.*$/gm, '')
    .replace(/---PAGE---/g, '. ')  // Replace page markers with sentence breaks
    .replace(/^\d+\s*$/gm, '')  // Remove standalone page numbers
    .replace(/^CJUR?\s*\d+:\d+.*$/gm, '')  // Remove journal reference lines like "CJUR 4:1 (June 1995) 83"
    .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/gm, ''); // Remove IP address lines

  // Remove copyright notices and publisher boilerplate (Nelson Education full block)
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
  
  // Remove French abstract sections entirely (common in Canadian academic papers)
  // Look for "R sum" or "Résumé" followed by French text until "Abstract" or English section
  cleanedText = cleanedText
    .replace(/R\s*sum[^]*?(?=Abstract|Introduction|The\s|This\s|In\s)/gi, '')
    .replace(/Résumé[^]*?(?=Abstract|Introduction|The\s|This\s|In\s)/gi, '');
  
  // Split into chunks (by sentences or line breaks) and filter French ones
  const chunks = cleanedText.split(/(?<=[.!?])\s+|\n+/);
  const englishChunks = chunks.filter(chunk => {
    const trimmed = chunk.trim();
    if (trimmed.length < 20) return true;  // Keep short chunks
    
    // Count French indicators
    const frenchWordPatterns = [
      /\b(le|la|les|du|des|au|aux|un|une)\b/gi,  // French articles
      /\b(et|ou|que|qui|dont|dans|sur|pour|par|avec|sans)\b/gi,  // French prepositions/conjunctions
      /\b(je|tu|il|elle|nous|vous|ils|elles|on)\b/gi,  // French pronouns
      /\b(est|sont|ont|fait|peut|doit|cette|ces|cette)\b/gi,  // Common French words
      /\b(gouvernement|municipale?|canadien|question|politique)\b/gi,  // French versions of English words
    ];
    
    let frenchWordCount = 0;
    for (const pattern of frenchWordPatterns) {
      const matches = trimmed.match(pattern);
      if (matches) frenchWordCount += matches.length;
    }
    
    // Count accented characters (strong French indicator)
    const accentedCount = (trimmed.match(/[àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g) || []).length;
    
    const words = trimmed.split(/\s+/).length;
    const frenchScore = frenchWordCount + (accentedCount * 2);  // Weight accents more
    const frenchRatio = frenchScore / words;
    
    // Filter if more than 25% French indicators
    return frenchRatio < 0.25;
  });
  cleanedText = englishChunks.join(' ');
  
  console.log("After French filter:", cleanedText.length);
  
  // Remove entire References/Bibliography/Works Cited sections (heading + all content after)
  // Works with both newline-separated and space-joined text
  cleanedText = cleanedText
    .replace(/(?:^|\n)\s*(?:References|Bibliography|Works?\s*Cited|Literature\s*Cited|Sources?\s*Cited|Endnotes|Footnotes|Notes)\s*\n[\s\S]*$/gim, '')
    .replace(/(?:^|\n)\s*(?:References|Bibliography|Works?\s*Cited)\s*(?:\n|$)[\s\S]*$/gim, '')
    .replace(/\b(?:References|Bibliography|Works?\s*Cited|Reference\s*List)\s+(?:[A-Z][a-z]+,?\s+[A-Z]\.[\s\S]*$)/gim, '');

  // Remove inline APA/MLA-style citations like (Smith, 2020) or (Smith & Jones, 2019, p. 45)
  cleanedText = cleanedText
    .replace(/\([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*(?:,?\s*(?:et\s+al\.?))?,?\s*\d{4}[a-z]?(?:,\s*p{1,2}\.\s*\d+(?:-\d+)?)?\)/g, '')
    .replace(/\([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*,?\s*n\.d\.(?:,\s*p{1,2}\.\s*\d+(?:-\d+)?)?\)/g, '');

  // Remove standalone citation-style lines (Author, Year. Title. Journal...)
  cleanedText = cleanedText
    .replace(/^[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s+\(\d{4}\)\..*$/gm, '')
    .replace(/^[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s+(?:and|&)\s+[A-Z][a-z]+,\s+[A-Z]\..*\(\d{4}\)\..*$/gm, '')
    .replace(/^[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4},\s+\w+\s+\d+\)\..*$/gm, '');

  // Remove dense citation blocks that survive other filters (sequences of Author, Year patterns)
  cleanedText = cleanedText
    .replace(/(?:[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s*(?:,?\s*(?:&|and)\s+[A-Z][a-z]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*\s*)*\(\d{4}[a-z]?\)\.\s*[^.]*\.\s*(?:[A-Z][a-z]+[^.]*\.\s*)?(?:\d+\([^)]*\)[^.]*\.\s*)?){2,}/g, '');

  // Remove section headings (standalone or at start of lines followed by content)
  cleanedText = cleanedText
    .replace(/^(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?|Key Takeaways|Coming Up Next|Discussions? and Assignments?|Reminder|Tab Panels?.*|Tab:.*)\s*$/gim, '')
    .replace(/^(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?)\s+/gim, '');

  // Remove tab/accordion UI artifacts from PDFs (e.g. "Tab 1", "tab expand", "Tab Panel", "Tab Panels", etc.)
  // These are navigation elements from D2L/Brightspace LMS that get embedded when saving course pages as PDF
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

  // Remove spaced-out headings like "ar e po l i T i c a l pa r T i e s" (single letters with spaces)
  cleanedText = cleanedText
    .replace(/(?:[a-zA-Z]\s+){5,}[a-zA-Z]/g, '');

  // Remove inline footnote numbers (superscript references like 65, 66, 67 appearing mid-sentence)
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

  // Post-cleanup: remove heading words that ended up inline after whitespace collapse
  result = result
    .replace(/(\.\s+)(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?|Key Takeaways|Coming Up Next|Discussions? and Assignments?|Reminder)\s+/gi, '$1')
    .replace(/^(Introduction|Conclusion|Summary|Overview|Abstract|Preface|Foreword|Acknowledgements?|References|Bibliography|Appendix|Module \d+|Chapter \d+|Section \d+|Learning Objectives?|Learning Outcomes?|Table of Contents|Readings?|Key Takeaways|Coming Up Next|Discussions? and Assignments?|Reminder)\s+/i, '');
  
  console.log("Final cleaned length:", result.length);
  return result;
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

// Function to fully stop and clean up TTS session
function stopTTSSession(reason: string) {
  console.log(`[TTS] Stopping session: ${reason}`);
  if (currentTTSSession) {
    if (currentTTSSession.autoTimer) {
      clearTimeout(currentTTSSession.autoTimer);
      currentTTSSession.autoTimer = null;
    }
    currentTTSSession.isPlaying = false;
  }
}

// Function to send next TTS chunk automatically
async function sendNextChunk() {
  if (!currentTTSSession || !currentTTSSession.isPlaying) {
    console.log("[TTS] sendNextChunk: No active session or not playing");
    return;
  }

  // Safety: check session age to prevent zombie sessions
  const sessionAge = Date.now() - currentTTSSession.sessionCreatedAt;
  if (sessionAge > MAX_SESSION_AGE_MS) {
    stopTTSSession(`Session too old (${Math.round(sessionAge / 60000)} minutes)`);
    return;
  }

  // Safety: check consecutive errors
  if (currentTTSSession.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    stopTTSSession(`Too many consecutive errors (${currentTTSSession.consecutiveErrors})`);
    return;
  }
  
  console.log("[TTS] sendNextChunk called, currentPosition:", currentTTSSession.currentPosition);
  
  // Check if we've finished
  if (currentTTSSession.currentPosition >= currentTTSSession.fullText.length) {
    stopTTSSession("Finished entire document");
    return;
  }
  
  // Get next chunk from cleaned text
  let rawChunk = currentTTSSession.fullText.substring(
    currentTTSSession.currentPosition,
    currentTTSSession.currentPosition + CHUNK_SIZE
  );
  
  if (rawChunk.trim().length === 0) {
    stopTTSSession("No more content");
    return;
  }
  
  // Clean the chunk and apply sentence boundary
  let nextChunk = cleanTextForTTS(rawChunk);
  nextChunk = getChunkWithSentenceBoundary(nextChunk, CHUNK_SIZE);
  
  // Update position BEFORE sending - advance by the chunk length we're about to send
  const chunkLength = nextChunk.length;
  currentTTSSession.currentPosition += chunkLength;
  currentTTSSession.startTime = Date.now();
  
  const targetEntity = currentTTSSession.targetEntity || NEST_SPEAKER_ENTITY;
  const isNonAlexa = NON_ALEXA_ENTITIES.includes(targetEntity);
  console.log("[TTS] Auto-continuing, chunk length:", chunkLength, 
    "new position:", currentTTSSession.currentPosition,
    "remaining:", currentTTSSession.fullText.length - currentTTSSession.currentPosition,
    "to:", targetEntity, isNonAlexa ? "(non-Alexa, using play_media)" : "(Alexa)");
  
  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
  
  try {
    let response: Response;
    
    if (isNonAlexa) {
      const audioPath = await generateAndSaveTTSAudio(nextChunk, `tts-chunk-${Date.now()}`, "echo");
      const appUrl = DEPLOYED_APP_URL;
      const fullAudioUrl = `${appUrl}${audioPath}`;
      console.log(`[TTS] Non-Alexa: Generated audio at ${audioPath}, playing on ${targetEntity}`);
      
      response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: targetEntity,
          media_content_id: fullAudioUrl,
          media_content_type: "music",
        }),
      });
    } else {
      const ssmlChunk = `<speak><prosody rate="90%">${nextChunk}</prosody></speak>`;
      
      response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
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
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TTS] Chunk send error, status:", response.status, errorText);
      currentTTSSession.consecutiveErrors++;
      if (currentTTSSession.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        stopTTSSession(`Giving up after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
        return;
      }
      // Rewind position so the failed chunk gets retried
      currentTTSSession.currentPosition -= chunkLength;
      console.log(`[TTS] Rewound position to ${currentTTSSession.currentPosition} for retry`);
    } else {
      currentTTSSession.consecutiveErrors = 0;
      console.log("[TTS] Chunk sent successfully");
    }
    
    // Schedule next chunk only if session is still active and healthy
    if (currentTTSSession && currentTTSSession.isPlaying && 
        currentTTSSession.currentPosition < currentTTSSession.fullText.length) {
      // On error, wait longer before retrying to let transient issues resolve
      if (currentTTSSession.consecutiveErrors > 0) {
        console.log(`[TTS] Retry in 10s due to error (attempt ${currentTTSSession.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
        currentTTSSession.autoTimer = setTimeout(() => {
          console.log("[TTS] Retry timer fired, calling sendNextChunk");
          sendNextChunk();
        }, 10000);
      } else {
        scheduleNextChunk();
      }
    } else {
      console.log("[TTS] Not scheduling next - session ended or no more content");
    }
  } catch (error) {
    console.error("[TTS] Auto-continue error:", error);
    if (currentTTSSession) {
      currentTTSSession.consecutiveErrors++;
      // Rewind position for retry
      currentTTSSession.currentPosition -= chunkLength;
      if (currentTTSSession.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        stopTTSSession(`Network error, giving up after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
        return;
      }
      // Retry after delay
      console.log(`[TTS] Network error retry in 10s (attempt ${currentTTSSession.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
      currentTTSSession.autoTimer = setTimeout(() => {
        console.log("[TTS] Network retry timer fired");
        sendNextChunk();
      }, 10000);
    }
  }
}

// Calculate delay based on chunk size and speed
// At 90% speed (slightly slower than normal)
const SPEED_RATE = 0.90;

function scheduleNextChunk() {
  if (!currentTTSSession || !currentTTSSession.isPlaying) {
    console.log("[TTS] scheduleNextChunk: No active session or not playing, aborting");
    return;
  }

  // Safety: don't schedule if too many errors
  if (currentTTSSession.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    stopTTSSession("Too many errors, not scheduling more chunks");
    return;
  }
  
  // Clear any existing timer
  if (currentTTSSession.autoTimer) {
    clearTimeout(currentTTSSession.autoTimer);
    currentTTSSession.autoTimer = null;
  }
  
  const baseSeconds = CHUNK_SIZE / CHARS_PER_SECOND;
  const adjustedSeconds = baseSeconds / SPEED_RATE;
  // Add 3-second buffer for Alexa processing overhead
  const delayMs = adjustedSeconds * 1000 + 3000;
  
  console.log(`[TTS] Scheduling next chunk in ${(delayMs / 1000).toFixed(1)}s`);
  
  currentTTSSession.autoTimer = setTimeout(() => {
    console.log("[TTS] Timer fired, calling sendNextChunk");
    sendNextChunk();
  }, delayMs);
}

const BUILD_VERSION = Date.now().toString();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await initTTSFallbackStatus();

  const serverPort = process.env.PORT || 5000;

  setTimeout(async () => {
    try {
      const nestPlaying = await isNestSpeakerPlaying();
      if (nestPlaying) {
        console.log(`[Startup] Nest speaker is playing — starting toothbrush polling for orphaned session recovery`);
        startToothbrushPolling();
      }
    } catch (e: any) {
      console.log(`[Startup] Error checking Nest state: ${e.message}`);
    }
  }, 10000);

  (async () => {
    try {
      const allTasks = await storage.getTasks({});
      const autoCreatedIds = allTasks
        .filter(t => t.type === 'module' || t.type === 'reading')
        .filter(t => !t.isCompleted)
        .filter(t => {
          const title = t.title || '';
          return /^(CPPA|CFNF|CASL\d*)\s+(Module|Reading|Module & Reading)$/.test(title)
            || /^Module( & Reading)?$/.test(title)
            || /^Reading$/.test(title);
        })
        .map(t => t.id);
      if (autoCreatedIds.length > 0) {
        for (const id of autoCreatedIds) {
          await storage.deleteTask(id);
        }
        console.log(`[Cleanup] Removed ${autoCreatedIds.length} auto-created module/reading tasks`);
      }
    } catch (e) {
      console.error('[Cleanup] Error removing auto-created tasks:', e);
    }
  })();

  try {
    const fixResult = await db.execute(sql`UPDATE files SET folder = REPLACE(folder, 'casl101-other', 'casl101-module') WHERE folder LIKE '%casl101-other%'`);
    const count = (fixResult as any)?.rowCount || (fixResult as any)?.changes || 0;
    if (count > 0) {
      console.log(`Fixed ${count} CASL101 file folder(s) from 'other' to 'module'`);
    }
  } catch (e) {
    console.error("Failed to fix CASL101 file folders:", e);
  }

  app.get('/api/degree-tracking', async (_req, res) => {
    try {
      const rows = await db.select().from(degreeTrackingData);
      const result: Record<string, any> = {};
      for (const row of rows) {
        try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to load degree tracking data' });
    }
  });

  app.post('/api/degree-tracking', async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: 'key is required' });
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      await db.insert(degreeTrackingData).values({ key, value: valueStr }).onConflictDoUpdate({ target: degreeTrackingData.key, set: { value: valueStr } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save degree tracking data' });
    }
  });

  app.post('/api/degree-tracking/bulk', async (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Object required' });
      let saved = 0;
      for (const [key, value] of Object.entries(data)) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        await db.insert(degreeTrackingData).values({ key, value: valueStr }).onConflictDoUpdate({ target: degreeTrackingData.key, set: { value: valueStr } });
        saved++;
      }
      res.json({ ok: true, saved });
    } catch (e) {
      res.status(500).json({ error: 'Failed to bulk save degree tracking data' });
    }
  });

  app.get('/api/ha-redirect', (req, res) => {
    const path = req.query.path ? decodeURIComponent(String(req.query.path)) : '/lovelace/test-home';
    const haUrl = `http://172.24.0.2:8123${path}`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${haUrl}"><script>window.location.replace("${haUrl}");</script></head><body></body></html>`);
  });

  app.get('/api/version', (_req, res) => {
    res.json({ version: BUILD_VERSION });
  });

  app.get('/tablet', (req, res) => {
    const baseUrl = DEPLOYED_APP_URL;
    const targetUrl = req.query.target ? decodeURIComponent(String(req.query.target)) : `${baseUrl}/?auth=5747`;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Uni-Cal Tablet</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000}
iframe{width:100vw;height:100vh;border:none;position:fixed;top:0;left:0}
</style>
</head>
<body>
<iframe id="frame" src="${targetUrl}" allow="fullscreen;autoplay" allowfullscreen></iframe>
<script>
(function(){
  var frame = document.getElementById('frame');
  var lastTs = 0;

  function goFullscreen() {
    var el = document.documentElement;
    try {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    } catch(e){}
  }
  document.addEventListener('click', goFullscreen);
  document.addEventListener('touchstart', goFullscreen);
  setTimeout(goFullscreen, 500);
  setTimeout(goFullscreen, 2000);
  setTimeout(goFullscreen, 5000);

  function poll() {
    var url = '${baseUrl}/api/tablet-nav?device=master&auth=5747&_t=' + Date.now();
    fetch(url, {cache:'no-store'}).then(function(r){return r.json()}).then(function(data){
      if (!data || !data.action) return;
      if (data.timestamp && data.timestamp <= lastTs) return;
      if (data.timestamp && (Date.now() - data.timestamp > 120000)) return;
      lastTs = data.timestamp || Date.now();
      fetch('${baseUrl}/api/tablet-nav/ack', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp:data.timestamp,device:'master'})}).catch(function(){});
      fetch('${baseUrl}/api/debug-beacon', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'tablet-page:'+data.action,data:{url:(data.url||'').substring(0,80)}})}).catch(function(){});
      if (data.action === 'navigate' && data.url) {
        frame.src = data.url;
      } else if (data.action === 'go_home') {
        frame.src = '${baseUrl}/?auth=5747';
      }
    }).catch(function(){});
  }
  setInterval(poll, 3000);
  setTimeout(poll, 500);

  fetch('${baseUrl}/api/debug-beacon', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'tablet-page:loaded',data:{target:'${targetUrl.substring(0,80)}',ua:navigator.userAgent.substring(0,60)}})}).catch(function(){});
})();
</script>
</body>
</html>`);
  });

  app.post('/api/client-error', (req, res) => {
    const { message, stack, userAgent, url, timestamp } = req.body || {};
    console.error(`[CLIENT ERROR] ${timestamp || new Date().toISOString()} | UA: ${userAgent || 'unknown'} | URL: ${url || 'unknown'} | ${message} | Stack: ${stack || 'none'}`);
    res.json({ ok: true });
  });

  app.post('/api/debug-beacon', (req, res) => {
    const { step, data } = req.body || {};
    console.log(`[DEBUG-BEACON] ${step}: ${JSON.stringify(data || {})}`);
    res.json({ ok: true });
  });

  // GET /api/tasks
  app.get(api.tasks.list.path, async (req, res) => {
    const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : undefined;
    const type = req.query.type as string | undefined;
    const showCompleted = req.query.showCompleted !== 'false';
    
    const tasks = await storage.getTasks({ weekNumber, type, showCompleted });
    
    // Mark missed tasks and add subtask counts
    const now = new Date();
    const tasksWithExtras = await Promise.all(tasks.map(async (task) => {
      const subtasks = await storage.getSubtasksByTask(task.id);
      const subtaskCount = subtasks.length;
      const completedSubtaskCount = subtasks.filter(s => s.isCompleted).length;
      
      return {
        ...task,
        isMissed: !task.isCompleted && new Date(task.dueDate) < now,
        subtaskCount,
        completedSubtaskCount
      };
    }));
    
    res.json(tasksWithExtras);
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
      if (!input.startDate && input.dueDate) {
        const due = new Date(input.dueDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (due.getTime() > now.getTime()) {
          input.startDate = now.toISOString();
        }
      }
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
            weekNumber: getWeekNumber(repeatDueDate, semesterStart, activeSemester?.readingWeekStart),
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

  app.post("/api/tasks/bulk-import", async (req, res) => {
    try {
      const { tasks: incoming } = req.body as { tasks: any[] };
      if (!Array.isArray(incoming)) return res.status(400).json({ message: 'tasks must be an array' });
      
      const existing = await storage.getTasks({});
      const existingMap = new Map<string, any>();
      existing.forEach(t => {
        const key = `${t.courseName}||${t.title}||${t.type}||${t.weekNumber || ''}`;
        existingMap.set(key, t);
      });
      
      let created = 0, updated = 0, skipped = 0;
      for (const t of incoming) {
        const key = `${t.courseName}||${t.title}||${t.type}||${t.weekNumber || ''}`;
        const { id, isMissed, subtaskCount, completedSubtaskCount, calendarEventId, calendarProvider, prepCalendarEventId, secondaryCalendarEventId, secondAccountCalendarEventId, secondAccountPrepEventId, ...taskData } = t;
        if (taskData.dueDate && typeof taskData.dueDate === 'string') taskData.dueDate = new Date(taskData.dueDate);
        if (taskData.startDate && typeof taskData.startDate === 'string') taskData.startDate = new Date(taskData.startDate);
        if (taskData.completedAt && typeof taskData.completedAt === 'string') taskData.completedAt = new Date(taskData.completedAt);
        if (taskData.repeatEndDate && typeof taskData.repeatEndDate === 'string') taskData.repeatEndDate = new Date(taskData.repeatEndDate);
        
        const existingTask = existingMap.get(key);
        if (existingTask) {
          if (taskData.gradeWeight !== undefined || taskData.gradeValue !== undefined || taskData.gradeTotal !== undefined || taskData.assignmentGroup !== undefined) {
            await storage.updateTask(existingTask.id, {
              gradeWeight: taskData.gradeWeight,
              gradeValue: taskData.gradeValue,
              gradeTotal: taskData.gradeTotal,
              assignmentGroup: taskData.assignmentGroup,
              sortOrder: taskData.sortOrder,
              dueDate: taskData.dueDate,
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          try {
            if (!taskData.startDate && taskData.dueDate) {
              const due = new Date(taskData.dueDate);
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              if (due.getTime() > now.getTime()) {
                taskData.startDate = now;
              }
            }
            await storage.createTask(taskData);
            created++;
          } catch (e: any) {
            console.error(`Bulk import failed for "${t.title}":`, e.message);
            skipped++;
          }
        }
      }
      
      res.json({ success: true, created, updated, skipped, total: incoming.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/reorder", async (req, res) => {
    try {
      const { updates } = req.body as { updates: { id: number; sortOrder: number; assignmentGroup?: string | null }[] };
      if (!Array.isArray(updates)) return res.status(400).json({ message: 'updates must be an array' });
      for (const u of updates) {
        await storage.updateTask(u.id, { sortOrder: u.sortOrder, assignmentGroup: u.assignmentGroup ?? undefined });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
      
      // If repeatType changed from "none" to something else, generate recurring instances
      if (existingTask && (!existingTask.repeatType || existingTask.repeatType === "none") && task.repeatType && task.repeatType !== "none") {
        try {
          const activeSemester = await storage.getActiveSemesterSettings();
          const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
          
          const repeatDates = generateRepeatDates(
            task.dueDate,
            task.repeatType as RepeatType,
            task.repeatEndDate,
            task.repeatInterval ?? undefined,
            task.repeatIntervalUnit as RepeatIntervalUnit | undefined
          );
          
          let prepDuration = 0;
          if (task.startDate) {
            prepDuration = task.dueDate.getTime() - task.startDate.getTime();
          }
          
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
              weekNumber: getWeekNumber(repeatDueDate, semesterStart, activeSemester?.readingWeekStart),
              priority: task.priority,
              notes: task.notes,
              referenceLink: task.referenceLink,
              attachments: task.attachments,
              repeatType: "none",
              parentTaskId: task.id,
            };
            
            try {
              const createdChild = await storage.createTask(childTask);
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
            } catch (childErr) {
              console.error("Failed to create recurring child from PATCH:", childErr);
            }
          }
        } catch (recurErr) {
          console.error("Error generating recurring instances from PATCH:", recurErr);
        }
      }
      
      // Handle prep calendar event changes
      // If startDate was removed (had prep days, now has 0), delete prep events
      if (existingTask?.startDate && !task.startDate) {
        // Delete main prep event
        if (existingTask.prepCalendarEventId) {
          try {
            await deleteCalendarEvent(existingTask.prepCalendarEventId);
            await storage.updateTask(task.id, { prepCalendarEventId: null });
          } catch (prepErr) {
            console.error("Failed to delete prep calendar event:", prepErr);
          }
        }
        // Delete second account prep event
        if (existingTask.secondAccountPrepEventId) {
          try {
            await deleteEventFromSecondAccount(existingTask.secondAccountPrepEventId);
            await storage.updateTask(task.id, { secondAccountPrepEventId: null });
          } catch (secPrepErr) {
            console.error("Failed to delete second account prep event:", secPrepErr);
          }
        }
      }
      // If startDate was added or changed, update/create prep events
      else if (task.startDate && task.prepCalendarEventId) {
        try {
          await updatePrepCalendarEvent(task.prepCalendarEventId, {
            title: task.title,
            description: task.description,
            startDate: task.startDate,
            dueDate: task.dueDate,
            courseName: task.courseName,
          });
        } catch (prepErr) {
          console.error("Failed to update prep calendar event:", prepErr);
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
    
    // Delete prep calendar event if synced
    if (task.prepCalendarEventId) {
      try {
        await deleteCalendarEvent(task.prepCalendarEventId);
      } catch (prepErr) {
        console.error("Auto-delete prep event from Google Calendar failed:", prepErr);
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
    
    // Delete all subtasks and related links for this task
    await storage.deleteSubtasksByTask(taskId);
    
    await storage.deleteTask(taskId);
    res.status(204).end();
  });

  // DELETE /api/tasks/:id/future - Delete this task and all future recurring instances
  app.delete("/api/tasks/:id/future", async (req, res) => {
    const taskId = Number(req.params.id);
    const task = await storage.getTask(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const parentId = task.parentTaskId || task.id;
    const allSiblings = await storage.getChildTasks(parentId);
    const parentTask = task.parentTaskId ? await storage.getTask(parentId) : task;

    const tasksToDelete = [task];
    for (const sibling of allSiblings) {
      if (sibling.id !== task.id && new Date(sibling.dueDate) >= new Date(task.dueDate)) {
        tasksToDelete.push(sibling);
      }
    }
    if (parentTask && parentTask.id !== task.id && new Date(parentTask.dueDate) >= new Date(task.dueDate)) {
      tasksToDelete.push(parentTask);
    }

    for (const t of tasksToDelete) {
      if (t.calendarEventId) {
        try { await deleteCalendarEvent(t.calendarEventId); } catch {}
      }
      if (t.secondAccountCalendarEventId) {
        try { await deleteEventFromSecondAccount(t.secondAccountCalendarEventId); } catch {}
      }
      if (t.prepCalendarEventId) {
        try { await deleteCalendarEvent(t.prepCalendarEventId); } catch {}
      }
      if (t.secondAccountPrepEventId) {
        try { await deleteEventFromSecondAccount(t.secondAccountPrepEventId); } catch {}
      }
      await storage.deleteSubtasksByTask(t.id);
      await storage.deleteTask(t.id);
    }

    res.status(204).end();
  });

  // PATCH /api/tasks/:id/update-recurring - Update all recurring siblings with same fields
  app.patch("/api/tasks/:id/update-recurring", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: 'Task not found' });

      const fields = { ...req.body };
      const dateFields = ['dueDate', 'startDate', 'completedAt', 'repeatEndDate', 'createdAt', 'deletedAt', 'lastMovedAt', 'reminderTime'];
      for (const key of dateFields) {
        if (fields[key] && typeof fields[key] === 'string') fields[key] = new Date(fields[key]);
      }
      const parentId = task.parentTaskId || task.id;
      const allSiblings = await storage.getChildTasks(parentId);
      const parentTask = task.parentTaskId ? await storage.getTask(parentId) : task;

      const tasksToUpdate: number[] = [taskId];
      for (const sibling of allSiblings) {
        if (sibling.id !== taskId) {
          tasksToUpdate.push(sibling.id);
        }
      }
      if (parentTask && parentTask.id !== taskId) {
        tasksToUpdate.push(parentTask.id);
      }

      if (tasksToUpdate.length <= 1 && fields.originalTitle && task.courseName) {
        const allTasksList = await storage.getTasks();
        for (const t of allTasksList) {
          if (t.id !== taskId && t.title === fields.originalTitle && t.courseName === task.courseName) {
            tasksToUpdate.push(t.id);
          }
        }
        delete fields.originalTitle;
      } else {
        delete fields.originalTitle;
      }

      // Calculate prep duration from the edited task so we can apply it relatively
      // to each sibling's own dueDate
      let prepDuration = 0;
      if (fields.startDate && fields.dueDate) {
        prepDuration = new Date(fields.dueDate).getTime() - new Date(fields.startDate).getTime();
      } else if (fields.startDate && task.dueDate) {
        prepDuration = new Date(task.dueDate).getTime() - new Date(fields.startDate).getTime();
      }

      const uniqueIds = [...new Set(tasksToUpdate)];
      for (const id of uniqueIds) {
        if (id === taskId) {
          await storage.updateTask(id, fields);
        } else {
          const siblingTask = allSiblings.find(s => s.id === id) || (parentTask?.id === id ? parentTask : null);
          const siblingDueDate = siblingTask?.dueDate ? new Date(siblingTask.dueDate) : null;
          const siblingFields = { ...fields };

          if (siblingDueDate && !isNaN(siblingDueDate.getTime())) {
            if (fields.eventStartTime && typeof fields.eventStartTime === 'string' && fields.eventStartTime.includes(':')) {
              const [newHour, newMin] = (fields.eventStartTime as string).split(':').map(Number);
              const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' });
              const parts = fmt.formatToParts(siblingDueDate);
              const yy = Number(parts.find(p => p.type === 'year')!.value);
              const mm = Number(parts.find(p => p.type === 'month')!.value);
              const dd = Number(parts.find(p => p.type === 'day')!.value);
              const etDateStr = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T${String(newHour).padStart(2,'0')}:${String(newMin).padStart(2,'0')}:00`;
              const probe = new Date(etDateStr + 'Z');
              const probeETHour = parseInt(probe.toLocaleString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', hour12: false }), 10) % 24;
              const offsetHours = probeETHour - probe.getUTCHours();
              const utcDate = new Date(probe.getTime() - offsetHours * 3600000);
              siblingFields.dueDate = utcDate;
            }

            if (prepDuration > 0 && (fields.startDate !== undefined)) {
              const dueDateForPrep = siblingFields.dueDate ? new Date(siblingFields.dueDate as Date) : siblingDueDate;
              siblingFields.startDate = new Date(dueDateForPrep.getTime() - prepDuration);
            } else {
              delete siblingFields.startDate;
            }
          }

          delete siblingFields.weekNumber;
          if (!(fields.eventStartTime && typeof fields.eventStartTime === 'string' && fields.eventStartTime.includes(':'))) {
            delete siblingFields.dueDate;
            delete siblingFields.startDate;
          }
          if (!siblingFields.dueDate) delete siblingFields.dueDate;
          await storage.updateTask(id, siblingFields);
        }
      }

      res.json({ updated: uniqueIds.length });
    } catch (error) {
      console.error("Error updating recurring tasks:", error);
      res.status(500).json({ message: "Failed to update recurring tasks" });
    }
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

  // GET /api/semesters - Get all semester settings
  app.get("/api/semesters", async (_req, res) => {
    try {
      const all = await storage.getAllSemesterSettings();
      res.json(all);
    } catch (err) {
      console.error("Error fetching all semester settings:", err);
      res.status(500).json({ error: "Failed to fetch semester settings" });
    }
  });

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

  // PATCH /api/semester - Update active semester settings (all fields)
  app.patch("/api/semester", async (req, res) => {
    try {
      const activeSemester = await storage.getActiveSemesterSettings();
      if (!activeSemester) {
        return res.status(404).json({ error: "No active semester settings found" });
      }
      const dateFields = ['semesterStartDate', 'semesterEndDate', 'course1StartDate', 'course1EndDate', 'course2StartDate', 'course2EndDate', 'course3StartDate', 'course3EndDate', 'readingWeekStart', 'createdAt'];
      const body = { ...req.body };
      for (const field of dateFields) {
        if (body[field] && typeof body[field] === 'string') {
          body[field] = new Date(body[field]);
        }
      }
      const updated = await storage.updateSemesterSettings(activeSemester.id, body);
      res.json(updated);
    } catch (err) {
      console.error("Error updating semester settings:", err);
      res.status(500).json({ error: "Failed to update semester settings" });
    }
  });

  // PATCH /api/semesters/:id - Update any semester settings row by ID
  app.patch("/api/semesters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const dateFields = ['semesterStartDate', 'semesterEndDate', 'course1StartDate', 'course1EndDate', 'course2StartDate', 'course2EndDate', 'course3StartDate', 'course3EndDate', 'readingWeekStart', 'createdAt'];
      const body = { ...req.body };
      for (const field of dateFields) {
        if (body[field] && typeof body[field] === 'string') {
          body[field] = new Date(body[field]);
        }
      }
      const updated = await storage.updateSemesterSettings(id, body);
      res.json(updated);
    } catch (err) {
      console.error("Error updating semester settings by ID:", err);
      res.status(500).json({ error: "Failed to update semester settings" });
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

  // PATCH /api/semester-settings/professor-emails - Update professor emails
  app.patch("/api/semester-settings/professor-emails", async (req, res) => {
    try {
      const { course1ProfessorEmail, course2ProfessorEmail, course3ProfessorEmail } = req.body;
      const activeSemester = await storage.getActiveSemesterSettings();
      if (!activeSemester) {
        return res.status(404).json({ error: "No active semester settings found" });
      }
      const updated = await storage.updateSemesterSettings(activeSemester.id, { 
        course1ProfessorEmail, 
        course2ProfessorEmail, 
        course3ProfessorEmail 
      });
      res.json(updated);
    } catch (err) {
      console.error("Error updating professor emails:", err);
      res.status(500).json({ error: "Failed to update professor emails" });
    }
  });

  app.get("/api/semester-checklist", async (_req, res) => {
    try {
      const semester = await storage.getActiveSemesterSettings();
      if (!semester) return res.json({ items: [], allChecked: true, semesterId: null });
      const courseCodes = [semester.course1Code, semester.course2Code, semester.course3Code].filter(Boolean);
      const items = await storage.initSemesterChecklist(semester.id, courseCodes);
      const allChecked = items.every(i => i.isChecked);
      res.json({ items, allChecked, semesterId: semester.id });
    } catch (err) {
      console.error("Error fetching semester checklist:", err);
      res.status(500).json({ error: "Failed to fetch semester checklist" });
    }
  });

  app.patch("/api/semester-checklist", async (req, res) => {
    try {
      const { semesterSettingsId, courseCode, itemType, isChecked } = req.body;
      const updated = await storage.upsertSemesterChecklistItem({ semesterSettingsId, courseCode, itemType, isChecked });
      const allItems = await storage.getSemesterChecklist(semesterSettingsId);
      const allChecked = allItems.every(i => i.isChecked);
      res.json({ item: updated, allChecked });
    } catch (err) {
      console.error("Error updating semester checklist:", err);
      res.status(500).json({ error: "Failed to update semester checklist" });
    }
  });

  app.get("/api/course-week-mappings", async (req, res) => {
    try {
      const semester = await storage.getActiveSemesterSettings();
      if (!semester) return res.json([]);
      const mappings = await storage.getAllCourseWeekMappings(semester.id);
      res.json(mappings);
    } catch (err) {
      console.error("Error fetching all course week mappings:", err);
      res.status(500).json({ error: "Failed to fetch course week mappings" });
    }
  });

  app.get("/api/course-week-mappings/:courseCode", async (req, res) => {
    try {
      const semester = await storage.getActiveSemesterSettings();
      if (!semester) return res.json([]);
      const mappings = await storage.getCourseWeekMappings(req.params.courseCode, semester.id);
      res.json(mappings);
    } catch (err) {
      console.error("Error fetching course week mappings:", err);
      res.status(500).json({ error: "Failed to fetch course week mappings" });
    }
  });

  app.put("/api/course-week-mappings", async (req, res) => {
    try {
      const semester = await storage.getActiveSemesterSettings();
      if (!semester) return res.status(400).json({ error: "No active semester" });
      const { courseCode, weekNumber, confirmed, courseWeekLabel, notes } = req.body;
      const mapping = await storage.upsertCourseWeekMapping({
        courseCode,
        semesterSettingsId: semester.id,
        weekNumber,
        confirmed,
        courseWeekLabel: courseWeekLabel || null,
        notes: notes || null,
      });
      res.json(mapping);
    } catch (err) {
      console.error("Error updating course week mapping:", err);
      res.status(500).json({ error: "Failed to update course week mapping" });
    }
  });

  app.put("/api/course-week-mappings/bulk", async (req, res) => {
    try {
      const semester = await storage.getActiveSemesterSettings();
      if (!semester) return res.status(400).json({ error: "No active semester" });
      const { courseCode, mappings } = req.body;
      const results = [];
      for (const m of mappings) {
        const mapping = await storage.upsertCourseWeekMapping({
          courseCode,
          semesterSettingsId: semester.id,
          weekNumber: m.weekNumber,
          confirmed: m.confirmed,
          courseWeekLabel: m.courseWeekLabel || null,
          notes: m.notes || null,
        });
        results.push(mapping);
      }
      res.json(results);
    } catch (err) {
      console.error("Error bulk updating course week mappings:", err);
      res.status(500).json({ error: "Failed to bulk update course week mappings" });
    }
  });

  const weatherCache: { data: any | null; timestamp: number } = { data: null, timestamp: 0 };

  app.get("/api/weather", async (_req, res) => {
    try {
      const now = Date.now();
      if (weatherCache.data && now - weatherCache.timestamp < 15 * 60 * 1000) {
        return res.json(weatherCache.data);
      }
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.6275&longitude=-79.3962&current=weather_code,temperature_2m,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America/Toronto&forecast_days=10&past_days=7');
      const data = await response.json();
      weatherCache.data = data;
      weatherCache.timestamp = now;
      res.json(data);
    } catch (err) {
      console.error("Error fetching weather:", err);
      res.status(500).json({ error: "Failed to fetch weather" });
    }
  });

  const weatherAlertCache: { data: any | null; timestamp: number } = { data: null, timestamp: 0 };

  const WEATHER_ALERT_ZONES = ['on61', 'on20', 'on21', 'on29'];

  async function fetchWeatherAlertsFromECCC(): Promise<{ title: string; summary: string; type: string; updated: string }[]> {
    const seen = new Set<string>();
    const alerts: { title: string; summary: string; type: string; updated: string }[] = [];

    const fetches = WEATHER_ALERT_ZONES.map(async (zone) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`https://weather.gc.ca/warnings/report_e.html?${zone}=`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniCal/1.0)' },
          redirect: 'follow',
        });
        clearTimeout(timeout);
        const html = await response.text();

        const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*\(/);
        if (!stateMatch) return;
        const stateJson = stateMatch[1].replace(/\\u002F/g, '/');
        const state = JSON.parse(stateJson);
        const alertObj = state?.alert?.alert || {};
        for (const zoneKey of Object.keys(alertObj)) {
          const zoneData = alertObj[zoneKey];
          if (!zoneData || typeof zoneData !== 'object') continue;
          const zoneAlerts = zoneData.alerts || [];
          const zoneName = zoneData.displayName || zoneKey;
          for (const a of zoneAlerts) {
            if (!a || a.status !== 'active') continue;
            const rawTitle = a.alertBannerText || a.type || '';
            const dedup = `${zoneKey}-${rawTitle}`;
            if (seen.has(dedup)) continue;
            seen.add(dedup);
            const title = `${rawTitle}${zoneName ? ` - ${zoneName}` : ''}`.replace(/&amp;/g, '&');
            const isWarning = /warning/i.test(rawTitle);
            const isWatch = /watch/i.test(rawTitle);
            const isAdvisory = /advisory|statement|special/i.test(rawTitle);
            alerts.push({
              title,
              summary: (a.issueTimeText || '').slice(0, 300),
              type: isWarning ? 'warning' : isWatch ? 'watch' : isAdvisory ? 'advisory' : 'info',
              updated: a.issueTime || new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.error(`[Weather Alerts] Failed to fetch zone ${zone}:`, e);
      }
    });

    await Promise.all(fetches);
    return alerts;
  }

  app.get("/api/weather-alerts", async (_req, res) => {
    try {
      const now = Date.now();
      if (weatherAlertCache.data && now - weatherAlertCache.timestamp < 5 * 60 * 1000) {
        return res.json(weatherAlertCache.data);
      }

      const alerts = await fetchWeatherAlertsFromECCC();
      const result = { alerts, count: alerts.length, hasAlerts: alerts.length > 0, timestamp: new Date().toISOString() };
      weatherAlertCache.data = result;
      weatherAlertCache.timestamp = now;
      res.json(result);
    } catch (err) {
      console.error("Error fetching weather alerts:", err);
      res.status(500).json({ error: "Failed to fetch weather alerts", alerts: [], count: 0, hasAlerts: false });
    }
  });

  app.get("/api/ha/sensor/weather-alerts", async (_req, res) => {
    try {
      const now = Date.now();
      if (!weatherAlertCache.data || now - weatherAlertCache.timestamp > 5 * 60 * 1000) {
        const alerts = await fetchWeatherAlertsFromECCC();
        weatherAlertCache.data = { alerts, count: alerts.length, hasAlerts: alerts.length > 0, timestamp: new Date().toISOString() };
        weatherAlertCache.timestamp = now;
      }
      const d = weatherAlertCache.data;
      res.json({
        state: d.count,
        attributes: {
          friendly_name: "Weather Alerts Toronto",
          has_alerts: d.hasAlerts,
          alert_count: d.count,
          alert_1_title: d.alerts[0]?.title || '',
          alert_1_type: d.alerts[0]?.type || '',
          alert_1_summary: d.alerts[0]?.summary || '',
          alert_2_title: d.alerts[1]?.title || '',
          alert_2_type: d.alerts[1]?.type || '',
          alert_2_summary: d.alerts[1]?.summary || '',
          alert_3_title: d.alerts[2]?.title || '',
          alert_3_type: d.alerts[2]?.type || '',
          alert_3_summary: d.alerts[2]?.summary || '',
          last_updated: d.timestamp,
        },
      });
    } catch (err) {
      console.error("Error fetching weather alerts for HA:", err);
      res.status(500).json({ error: "Failed to fetch weather alerts" });
    }
  });

  const pollenCache: { data: any | null; timestamp: number } = { data: null, timestamp: 0 };

  app.get("/api/pollen", async (_req, res) => {
    try {
      const now = Date.now();
      if (pollenCache.data && now - pollenCache.timestamp < 30 * 60 * 1000) {
        return res.json(pollenCache.data);
      }
      const response = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=43.6275&longitude=-79.3962&current=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen,european_aqi&timezone=America/Toronto');
      const raw = await response.json();
      const c = raw.current || {};
      const treePollen = Math.max(c.alder_pollen || 0, c.birch_pollen || 0, c.olive_pollen || 0);
      const grassPollen = c.grass_pollen || 0;
      const ragweedPollen = c.ragweed_pollen || 0;
      const mugwortPollen = c.mugwort_pollen || 0;
      const weedPollen = Math.max(ragweedPollen, mugwortPollen);
      const overallMax = Math.max(treePollen, grassPollen, weedPollen);

      const getLevel = (val: number) => {
        if (val <= 10) return 'Low';
        if (val <= 30) return 'Moderate';
        if (val <= 60) return 'High';
        return 'Very High';
      };

      const result = {
        tree: { value: treePollen, level: getLevel(treePollen), details: { alder: c.alder_pollen || 0, birch: c.birch_pollen || 0, olive: c.olive_pollen || 0 } },
        grass: { value: grassPollen, level: getLevel(grassPollen) },
        weed: { value: weedPollen, level: getLevel(weedPollen), details: { ragweed: ragweedPollen, mugwort: mugwortPollen } },
        overall: { value: overallMax, level: getLevel(overallMax) },
        aqi: c.european_aqi || 0,
        timestamp: new Date().toISOString(),
      };
      pollenCache.data = result;
      pollenCache.timestamp = now;
      res.json(result);
    } catch (err) {
      console.error("Error fetching pollen:", err);
      res.status(500).json({ error: "Failed to fetch pollen data" });
    }
  });

  app.get("/api/ha/sensor/pollen", async (_req, res) => {
    try {
      const now = Date.now();
      if (!pollenCache.data || now - pollenCache.timestamp > 30 * 60 * 1000) {
        const response = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=43.6275&longitude=-79.3962&current=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen,european_aqi&timezone=America/Toronto');
        const raw = await response.json();
        const c = raw.current || {};
        const treePollen = Math.max(c.alder_pollen || 0, c.birch_pollen || 0, c.olive_pollen || 0);
        const grassPollen = c.grass_pollen || 0;
        const ragweedPollen = c.ragweed_pollen || 0;
        const mugwortPollen = c.mugwort_pollen || 0;
        const weedPollen = Math.max(ragweedPollen, mugwortPollen);
        const overallMax = Math.max(treePollen, grassPollen, weedPollen);
        const getLevel = (val: number) => {
          if (val <= 10) return 'Low';
          if (val <= 30) return 'Moderate';
          if (val <= 60) return 'High';
          return 'Very High';
        };
        pollenCache.data = {
          tree: { value: treePollen, level: getLevel(treePollen), details: { alder: c.alder_pollen || 0, birch: c.birch_pollen || 0, olive: c.olive_pollen || 0 } },
          grass: { value: grassPollen, level: getLevel(grassPollen) },
          weed: { value: weedPollen, level: getLevel(weedPollen), details: { ragweed: ragweedPollen, mugwort: mugwortPollen } },
          overall: { value: overallMax, level: getLevel(overallMax) },
          aqi: c.european_aqi || 0,
          timestamp: new Date().toISOString(),
        };
        pollenCache.timestamp = now;
      }
      const p = pollenCache.data;
      res.json({
        state: p.overall.value,
        attributes: {
          unit_of_measurement: "grains/m³",
          friendly_name: "Pollen Index Toronto",
          level: p.overall.level,
          tree_pollen: p.tree.value,
          tree_level: p.tree.level,
          tree_alder: p.tree.details.alder,
          tree_birch: p.tree.details.birch,
          grass_pollen: p.grass.value,
          grass_level: p.grass.level,
          weed_pollen: p.weed.value,
          weed_level: p.weed.level,
          weed_ragweed: p.weed.details.ragweed,
          weed_mugwort: p.weed.details.mugwort,
          aqi: p.aqi,
          last_updated: p.timestamp,
        },
      });
    } catch (err) {
      console.error("Error fetching pollen for HA:", err);
      res.status(500).json({ error: "Failed to fetch pollen sensor data" });
    }
  });

  const newsCache: { data: any[] | null; timestamp: number } = { data: null, timestamp: 0 };

  app.use('/api/ticker-assets', express.static(path.join(process.cwd(), 'attached_assets')));

  app.get("/api/ticker", async (req, res) => {
    try {
      const LOGOS: Record<string, { file: string; height: number }> = {
        'CNN': { file: 'CNN_1773536484180.png', height: 28 },
        'CBC': { file: 'cbc-news-logo-black-and-white_1773536865600.png', height: 22 },
        'CTV': { file: 'CTV2_1773545440801.png', height: 20 },
        'Global': { file: 'Global_White_1773536754594.png', height: 24 },
        'MSNBC': { file: 'MSNBC_1773536950584.png', height: 14 },
        'Politico': { file: 'Politico_1773537080711.png', height: 20 },
        'Raw Story': { file: 'Raw_Story_1773607642361.png', height: 18 },
        'ABC News': { file: 'ABC_1773609250051.png', height: 24 },
        'BBC': { file: 'BBC_1773609711103.png', height: 13 },
        'Fox News': { file: 'Fox_News_1773610204651.png', height: 15 },
      };
      const ALERT_LOGO_FILE = 'Weather_Alert_1773608511887.png';
      const WMO: Record<number, string> = {0:'Clear',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',45:'Fog',48:'Rime Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',61:'Light Rain',63:'Rain',65:'Heavy Rain',66:'Freezing Rain',67:'Heavy Freezing Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',77:'Snow Grains',80:'Light Showers',81:'Showers',82:'Heavy Showers',85:'Light Snow Showers',86:'Heavy Snow Showers',95:'Thunderstorm',96:'Thunderstorm w/ Hail',99:'Severe Thunderstorm'};
      const US_SOURCES = ['CNN','Politico','Raw Story','MSNBC','ABC News','Fox News'];
      const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      const now = Date.now();
      const withTimeout = (url: string, ms: number) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        return fetch(url, { signal: controller.signal }).then(r => { clearTimeout(timer); return r.json(); }).catch(() => { clearTimeout(timer); return null; });
      };
      const port = process.env.PORT || 5000;

      const [alertRes, wxRes, pollenRes, newsRes] = await Promise.all([
        weatherAlertCache.data ? Promise.resolve(weatherAlertCache.data) : withTimeout(`http://localhost:${port}/api/weather-alerts`, 3000),
        weatherCache.data ? Promise.resolve(weatherCache.data) : withTimeout(`http://localhost:${port}/api/weather`, 3000),
        pollenCache.data ? Promise.resolve(pollenCache.data) : withTimeout(`http://localhost:${port}/api/pollen`, 3000),
        newsCache.data ? Promise.resolve(newsCache.data) : withTimeout(`http://localhost:${port}/api/news`, 4000),
      ]);

      let tickerItems = '';

      if (alertRes && alertRes.alerts) {
        for (const a of alertRes.alerts) {
          tickerItems += `<span class="t-item t-alert"><img src="/api/ticker-assets/${ALERT_LOGO_FILE}" class="t-logo" style="height:28px"/><span class="t-alert-text">⚠️ ${a.title}</span></span>`;
        }
      }

      if (wxRes && wxRes.current) {
        const c = wxRes.current;
        const temp = Math.round(c.temperature_2m);
        const desc = WMO[c.weather_code as number] || 'Mixed';
        const wind = Math.round(c.wind_speed_10m);
        tickerItems += `<span class="t-item"><span class="t-forecast"><img src="/cn-tower.png" style="height:1.2em;width:auto;display:inline-block;vertical-align:middle;margin-right:4px" /> <b>TORONTO FORECAST</b>:</span> <span class="t-data">${temp}°C — ${desc}  |  Wind: ${wind} km/h</span></span>`;
        if (wxRes.daily && wxRes.daily.time && wxRes.daily.time.length >= 3) {
          const parts = wxRes.daily.time.slice(0, 3).map((t: string, i: number) => {
            const dt = new Date(t + 'T12:00:00');
            return `${DAYS[dt.getDay()]}: ${Math.round(wxRes.daily.temperature_2m_max[i])}°/${Math.round(wxRes.daily.temperature_2m_min[i])}°`;
          });
          tickerItems += `<span class="t-item"><span class="t-forecast"><img src="/forecast-icon.png" style="height:1.2em;width:auto;display:inline-block;vertical-align:middle;margin-right:4px" /> <b>3-DAY FORECAST</b></span> <span class="t-data" style="color:rgba(255,255,255,0.95)"> |  ${parts.join('  •  ')}</span></span>`;
          const WMO_BRIEF: Record<number, string> = {0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'foggy',48:'foggy',51:'light drizzle',53:'drizzle',55:'heavy drizzle',61:'light rain',63:'rain',65:'heavy rain',66:'freezing rain',67:'heavy freezing rain',71:'light snow',73:'snow',75:'heavy snow',77:'snow grains',80:'light showers',81:'showers',82:'heavy showers',85:'light snow showers',86:'heavy snow showers',95:'thunderstorms',96:'thunderstorms with hail',99:'severe thunderstorms'};
          const briefParts: string[] = [];
          briefParts.push(`Currently ${temp}° and ${WMO_BRIEF[c.weather_code as number] || 'mixed conditions'}. Today's high ${Math.round(wxRes.daily.temperature_2m_max[0])}°, low ${Math.round(wxRes.daily.temperature_2m_min[0])}°.`);
          for (let bi = 1; bi <= 2; bi++) {
            if (wxRes.daily.time[bi]) {
              const bdt = new Date(wxRes.daily.time[bi] + 'T12:00:00');
              const bDesc = WMO_BRIEF[wxRes.daily.weather_code?.[bi] as number] || 'mixed conditions';
              briefParts.push(`${DAYS[bdt.getDay()]}: ${bDesc}, ${Math.round(wxRes.daily.temperature_2m_max[bi])}°/${Math.round(wxRes.daily.temperature_2m_min[bi])}°.`);
            }
          }
          tickerItems += `<span class="t-item"><span class="t-forecast"><img src="/newspaper-icon.png" style="height:1.2em;width:auto;display:inline-block;vertical-align:middle;margin-right:4px;" /> <b>FORECAST BRIEF</b></span> <span class="t-data" style="color:rgba(255,255,255,0.95)"> |  ${briefParts.join('  ')}</span></span>`;
        }
      }

      if (pollenRes && pollenRes.overall) {
        tickerItems += `<span class="t-item"><span class="t-forecast">🌿 <b>POLLEN</b>:</span> <span class="t-data" style="color:rgba(255,255,255,0.95)">${pollenRes.overall.level} (Tree: ${pollenRes.tree.level}, Grass: ${pollenRes.grass.level}, Weed: ${pollenRes.weed.level})  |  AQI: ${pollenRes.aqi}</span></span>`;
      }

      const customAnnouncements = await storage.getAnnouncements();
      const tickerNow = new Date();
      for (const a of customAnnouncements) {
        if (!a.courseName) continue;
        const received = new Date(a.receivedAt);
        const isCustom = a.courseName === 'Custom';
        if (!isCustom) {
          const dayOfWeek = received.getDay();
          const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
          const fridayEnd = new Date(received);
          fridayEnd.setDate(received.getDate() + daysUntilFriday);
          fridayEnd.setHours(23, 59, 59, 999);
          if (tickerNow > fridayEnd) continue;
        }
        const escapedBody = (a.body || a.snippet || a.subject || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const label = isCustom ? `📌` : `📢 <b>${a.courseName}</b>`;
        tickerItems += `<span class="t-item"><span class="t-forecast">${label}${isCustom ? '' : ':'}</span> <span class="t-data" style="color:rgba(255,255,255,0.95)">${escapedBody}</span></span>`;
      }

      if (newsRes && Array.isArray(newsRes)) {
        const ca: any[] = [], us: any[] = [], bbc: any[] = [];
        newsRes.forEach((h: any) => {
          if (h.source === 'BBC') bbc.push(h);
          else if (US_SOURCES.includes(h.source)) us.push(h);
          else ca.push(h);
        });
        const max = Math.max(ca.length, us.length, bbc.length);
        const interleaved: any[] = [];
        for (let i = 0; i < max; i++) {
          if (i < ca.length) interleaved.push(ca[i]);
          if (i < us.length) interleaved.push(us[i]);
          if (i < bbc.length) interleaved.push(bbc[i]);
        }
        for (const item of interleaved) {
          const logoInfo = LOGOS[item.source];
          const escapedTitle = (item.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const escapedLink = (item.link || '#').replace(/"/g, '&quot;');
          const logoHtml = logoInfo
            ? `<img src="/api/ticker-assets/${logoInfo.file}" class="t-logo" style="height:${logoInfo.height}px"/>`
            : `<span style="font-size:11px;font-weight:700;padding:0 4px;border-radius:3px;background:#555;color:#fff">${item.source}</span>`;
          let timeAgoHtml = '';
          if (item.publishedAt) {
            const diff = Date.now() - new Date(item.publishedAt).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins >= 0 && mins <= 4320) {
              const ago = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
              timeAgoHtml = `<span style="font-size:11px;color:rgba(255,255,255,0.6);margin-left:4px">${ago}</span>`;
            }
          }
          tickerItems += `<span class="t-item"><a href="${escapedLink}" target="_blank">${logoHtml}<span class="t-sep">|</span><span class="t-headline">${escapedTitle}</span>${timeAgoHtml}</a></span>`;
        }
      }

      const authQS = req.query.auth ? `?auth=${req.query.auth}` : '';

      if (!tickerItems) {
        const retryHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}html,body{height:100%;overflow:hidden;background:#000}.ticker-wrap{position:fixed;left:0;right:0;bottom:0;height:38px;overflow:hidden;background:#000;border-top:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center}.loading{color:rgba(255,255,255,0.5);font-size:14px;font-weight:600}</style></head><body><div class="ticker-wrap"><span class="loading">Loading news ticker...</span></div></body></html>`;
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', '');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(retryHtml);
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
html,body{width:100%;height:100%;overflow:hidden;background:#000}
@keyframes tickerScroll{0%{transform:translate3d(var(--ticker-start),0,0)}100%{transform:translate3d(var(--ticker-end),0,0)}}
@keyframes tickerAlertBlink{0%,100%{opacity:1}50%{opacity:0.3}}
.ticker-wrap{position:fixed;left:0;right:0;bottom:0;width:100vw;height:38px;overflow:hidden;background:#000;border-top:1px solid rgba(255,255,255,0.15)}
.ticker-track{display:flex;align-items:center;height:100%;white-space:nowrap;position:relative;will-change:transform;backface-visibility:hidden}
.t-item{display:inline-flex;align-items:center;gap:6px;margin:0 16px;opacity:1}
.t-item a{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.t-item a:hover{text-decoration:underline}
.t-alert{animation:tickerAlertBlink 1s ease-in-out infinite}
.t-alert-text{font-size:13px;font-weight:700;color:#ff4444;text-shadow:0 0 6px rgba(255,68,68,0.5)}
.t-forecast{font-size:13px;font-weight:400;color:rgb(0,255,0);text-shadow:0 0 4px rgba(0,255,0,0.3)}
.t-data{font-size:13px;font-weight:400;color:rgba(255,255,255,0.95)}
.t-headline{font-size:13px;font-weight:400;color:rgba(255,255,255,0.9)}
.t-sep{color:rgba(255,255,255,0.85);margin:0 4px;font-weight:300;font-size:13px;line-height:1;vertical-align:middle}
.t-logo{border-radius:2px;object-fit:contain;vertical-align:middle}
</style></head><body>
<div class="ticker-wrap"><div class="ticker-track" id="track">${tickerItems}</div></div>
<script>
(function(){
  const track=document.getElementById('track');
  if(!track) return;
  function initScroll(){
    const cw=track.scrollWidth;
    const sw=window.innerWidth;
    const total=sw+cw;
    const dur=total/65;
    track.style.setProperty('--ticker-start',sw+'px');
    track.style.setProperty('--ticker-end','-'+cw+'px');
    track.style.animation='none';
    track.offsetHeight;
    track.style.animation='tickerScroll '+dur+'s linear infinite';
  }
  requestAnimationFrame(initScroll);
  const hasNews = track.querySelectorAll('.t-headline').length > 0;
  if (!hasNews) {
    setTimeout(() => location.reload(), 30000);
  } else {
    let lastRefresh = Date.now();
    function refreshContent(){
      if (Date.now() - lastRefresh < 120000) return;
      lastRefresh = Date.now();
      var url = location.href;
      fetch(url).then(function(r){return r.text()}).then(function(html){
        var parser = new DOMParser();
        var doc = parser.parseFromString(html,'text/html');
        var newTrack = doc.getElementById('track');
        if(newTrack && newTrack.innerHTML !== track.innerHTML){
          track.innerHTML = newTrack.innerHTML;
          requestAnimationFrame(initScroll);
        }
      }).catch(function(){});
    }
    track.addEventListener('animationiteration', refreshContent);
  }
})();
</script></body></html>`;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Content-Security-Policy', '');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(html);
    } catch (err) {
      console.error("Error serving ticker:", err);
      res.status(500).send("Ticker error");
    }
  });

  app.get("/api/news", async (_req, res) => {
    try {
      const now = Date.now();
      if (newsCache.data && now - newsCache.timestamp < 10 * 60 * 1000) {
        return res.json(newsCache.data);
      }

      const feeds = [
        { source: 'CNN', url: 'https://news.google.com/rss/search?q=site:cnn.com+when:1d&hl=en-US&gl=US&ceid=US:en' },
        { source: 'CBC', url: 'https://www.cbc.ca/cmlink/rss-topstories' },
        { source: 'CTV', url: 'https://news.google.com/rss/search?q=site:ctvnews.ca+when:1d&hl=en-CA&gl=CA&ceid=CA:en' },
        { source: 'Global', url: 'https://globalnews.ca/politics/feed/' },
        { source: 'MSNBC', url: 'https://msnbc.com/feed' },
        { source: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
        { source: 'Raw Story', url: 'https://www.rawstory.com/feed', count: 3 },
        { source: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories', count: 3 },
        { source: 'BBC', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', count: 2 },
        { source: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/politics.xml', count: 3 },
      ];

      const results: { title: string; source: string; link: string; publishedAt?: string }[] = [];

      await Promise.allSettled(feeds.map(async (feed) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(feed.url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniCal/1.0)' }
          });
          clearTimeout(timeout);
          const xml = await response.text();

          const maxItems = (feed as any).count || 7;
          const items = xml.split(/<item[\s>]/i).slice(1, maxItems + 1);
          for (const item of items) {
            const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/is);
            const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/is);
            const pubDateMatch = item.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/is);
            if (titleMatch?.[1]) {
              let title = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).trim();
              title = title.replace(/\s*-\s*(CTV News|Google News|CNN)$/i, '').trim();
              const sportsFilter = /\b(NFL|NBA|NHL|MLB|CFL|MLS|FIFA|UEFA|NASCAR|PGA|ATP|WTA|Premier League|Super Bowl|Stanley Cup|World Series|World Cup|touchdown|quarterback|hockey|soccer|baseball|basketball|football score|playoff|championship game|draft pick|free agent signing|free agent|trade deadline|hat trick|grand slam|home run|Raptors|Maple Leafs|Blue Jays|Argonauts|Toronto FC|Canadiens|Senators|Oilers|Canucks|Flames|Jets|Bruins|Lakers|Warriors|Yankees|Dodgers|Chiefs|Eagles|coach|roster|medal|Olympic|athletics|tennis|boxing|UFC|MMA|wrestling|cricket|golf|curling|skiing|snowboard|goalie|goaltender|defenseman|striker|midfielder|pitcher|outfielder|inning|shutout|penalty shot|power play|slapshot|offseason|All-Star|all-star game|MVP|signing|signed.*deal|contract extension)\b/i;
              const junkFilter = /^LIVE:|^WATCH:|^BREAKING:?\s*$|^Video:|^Photos:|^Gallery:|News Live$|Live Stream|Full Episode|News in \d+ Minutes/i;
              if (title && title !== feed.source && title !== 'Google News' && title !== 'MS NOW' && !sportsFilter.test(title) && !junkFilter.test(title)) {
                const publishedAt = pubDateMatch?.[1]?.trim() ? new Date(pubDateMatch[1].trim()).toISOString() : undefined;
                results.push({
                  title,
                  source: feed.source,
                  link: linkMatch?.[1]?.trim() || '',
                  ...(publishedAt && !isNaN(new Date(publishedAt).getTime()) ? { publishedAt } : {}),
                });
              }
            }
          }
        } catch (e) {
          console.error(`[News] Failed to fetch ${feed.source}:`, e);
        }
      }));

      const bySource: Record<string, typeof results> = {};
      for (const item of results) {
        if (!bySource[item.source]) bySource[item.source] = [];
        if (bySource[item.source].length < 3) {
          bySource[item.source].push(item);
        }
      }
      const sources = Object.keys(bySource).sort(() => Math.random() - 0.5);
      const interleaved: typeof results = [];
      let round = 0;
      let added = true;
      while (added) {
        added = false;
        for (const src of sources) {
          if (round < bySource[src].length) {
            interleaved.push(bySource[src][round]);
            added = true;
          }
        }
        round++;
      }
      newsCache.data = interleaved;
      newsCache.timestamp = now;
      res.json(interleaved);
    } catch (err) {
      console.error("Error fetching news:", err);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  app.get("/api/ha/news", async (_req, res) => {
    try {
      const now = Date.now();
      if (newsCache.data && now - newsCache.timestamp < 10 * 60 * 1000) {
        return res.json({ headlines: newsCache.data });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`http://localhost:${port}/api/news`, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        return res.json({ headlines: data });
      }
      res.json({ headlines: [] });
    } catch (err) {
      console.error("Error in /api/ha/news:", err);
      res.json({ headlines: [] });
    }
  });

  app.get("/api/scholarships", async (_req, res) => {
    try {
      const data = await storage.getScholarships();
      res.json(data);
    } catch (err) {
      console.error("Error fetching scholarships:", err);
      res.status(500).json({ error: "Failed to fetch scholarships" });
    }
  });

  app.post("/api/scholarships", async (req, res) => {
    try {
      const created = await storage.createScholarship(req.body);
      res.json(created);
    } catch (err) {
      console.error("Error creating scholarship:", err);
      res.status(500).json({ error: "Failed to create scholarship" });
    }
  });

  app.patch("/api/scholarships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateScholarship(id, req.body);
      res.json(updated);
    } catch (err) {
      console.error("Error updating scholarship:", err);
      res.status(500).json({ error: "Failed to update scholarship" });
    }
  });

  app.delete("/api/scholarships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteScholarship(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting scholarship:", err);
      res.status(500).json({ error: "Failed to delete scholarship" });
    }
  });

  app.post("/api/scholarships/calendar-events", async (req, res) => {
    try {
      const { name, applicationsOpen, deadline, description, recurring } = req.body;
      const results: any[] = [];
      if (applicationsOpen) {
        const openEvent = await createYearlyScholarshipEvent({ name, date: applicationsOpen, type: 'open', description, recurring: recurring !== false });
        if (openEvent) results.push({ type: 'open', eventId: openEvent.id });
      }
      if (deadline) {
        const deadlineEvent = await createYearlyScholarshipEvent({ name, date: deadline, type: 'deadline', description, recurring: recurring !== false });
        if (deadlineEvent) results.push({ type: 'deadline', eventId: deadlineEvent.id });
      }
      res.json({ success: true, events: results });
    } catch (err) {
      console.error("Error creating scholarship calendar events:", err);
      res.status(500).json({ error: "Failed to create scholarship calendar events" });
    }
  });

  app.get("/api/key-contacts", async (_req, res) => {
    try {
      const data = await storage.getKeyContacts();
      res.json(data);
    } catch (err) {
      console.error("Error fetching key contacts:", err);
      res.status(500).json({ error: "Failed to fetch key contacts" });
    }
  });

  app.get("/api/key-contacts/export.vcf", async (_req, res) => {
    try {
      const contacts = await storage.getKeyContacts();
      const vcards = contacts.map(c => {
        const nameParts = c.name.trim().split(/\s+/);
        const lastName = nameParts.length > 1 ? nameParts.pop() : '';
        const firstName = nameParts.join(' ');
        let vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
        vcard += `N:${lastName};${firstName};;;\r\n`;
        vcard += `FN:${c.name}\r\n`;
        if (c.title) vcard += `TITLE:${c.title}\r\n`;
        if (c.organization) vcard += `ORG:${c.organization}${c.department ? ';' + c.department : ''}\r\n`;
        if (c.email) vcard += `EMAIL;TYPE=INTERNET:${c.email}\r\n`;
        if (c.phone) vcard += `TEL;TYPE=CELL:${c.phone}\r\n`;
        if (c.office) vcard += `ADR;TYPE=WORK:;;${c.office};;;;\r\n`;
        if (c.notes) vcard += `NOTE:${c.notes.replace(/\n/g, '\\n')}\r\n`;
        if (c.category) vcard += `CATEGORIES:${c.category}\r\n`;
        vcard += 'END:VCARD';
        return vcard;
      }).join('\r\n');
      res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.vcf"');
      res.send(vcards);
    } catch (err) {
      console.error("Error exporting contacts:", err);
      res.status(500).json({ error: "Failed to export contacts" });
    }
  });

  app.post("/api/key-contacts", async (req, res) => {
    try {
      const created = await storage.createKeyContact(req.body);
      res.json(created);
    } catch (err) {
      console.error("Error creating key contact:", err);
      res.status(500).json({ error: "Failed to create key contact" });
    }
  });

  app.patch("/api/key-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateKeyContact(id, req.body);
      res.json(updated);
    } catch (err) {
      console.error("Error updating key contact:", err);
      res.status(500).json({ error: "Failed to update key contact" });
    }
  });

  app.delete("/api/key-contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteKeyContact(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting key contact:", err);
      res.status(500).json({ error: "Failed to delete key contact" });
    }
  });

  app.post("/api/key-contacts/sync-professor", async (req, res) => {
    try {
      const { professorName, professorEmail, courseCode } = req.body;
      if (!professorName?.trim()) {
        return res.json({ synced: false, reason: 'no name' });
      }
      const existing = await storage.getKeyContacts();
      const match = existing.find(c => 
        c.category === 'professor' && (
          (c.email && professorEmail && c.email.toLowerCase() === professorEmail.toLowerCase()) ||
          c.name.toLowerCase() === professorName.toLowerCase()
        )
      );
      if (match) {
        const updates: Record<string, string> = {};
        if (professorEmail && match.email !== professorEmail) updates.email = professorEmail;
        if (courseCode && (!match.organization || !match.organization.includes(courseCode))) {
          updates.organization = match.organization ? `${match.organization}, ${courseCode}` : courseCode;
        }
        if (Object.keys(updates).length > 0) {
          await storage.updateKeyContact(match.id, updates);
        }
        res.json({ synced: true, action: 'updated', id: match.id });
      } else {
        const created = await storage.createKeyContact({
          name: professorName.trim(),
          email: professorEmail?.trim() || null,
          category: 'professor',
          organization: courseCode || null,
        });
        res.json({ synced: true, action: 'created', id: created.id });
      }
    } catch (err) {
      console.error("Error syncing professor to contacts:", err);
      res.status(500).json({ error: "Failed to sync professor" });
    }
  });

  app.get("/api/entity-comments/:entityType/:entityId", async (req, res) => {
    try {
      const comments = await storage.getEntityComments(req.params.entityType, req.params.entityId);
      res.json(comments);
    } catch (err) {
      console.error("Error getting entity comments:", err);
      res.status(500).json({ error: "Failed to get comments" });
    }
  });

  app.put("/api/entity-comments/:entityType/:entityId", async (req, res) => {
    try {
      const { content } = req.body;
      if (content === undefined) return res.status(400).json({ error: "content required" });
      if (!content.trim()) {
        const existing = await storage.getEntityComments(req.params.entityType, req.params.entityId);
        if (existing.length > 0) {
          await storage.deleteEntityComment(existing[0].id);
        }
        return res.json({ deleted: true });
      }
      const comment = await storage.upsertEntityComment(req.params.entityType, req.params.entityId, content);
      res.json(comment);
    } catch (err) {
      console.error("Error saving entity comment:", err);
      res.status(500).json({ error: "Failed to save comment" });
    }
  });

  app.delete("/api/entity-comments/:id", async (req, res) => {
    try {
      await storage.deleteEntityComment(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting entity comment:", err);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.post("/api/semester-reset-files", async (_req, res) => {
    try {
      const allFiles = await storage.getFiles();
      let resetCount = 0;
      for (const file of allFiles) {
        if (file.listened) {
          await storage.updateFile(file.id, { listened: false, lastChunkIndex: 0, totalChunks: 0, checkedChunks: '' });
          resetCount++;
        }
      }
      console.log(`[Semester Reset] Reset listened status on ${resetCount} files`);
      res.json({ success: true, resetCount });
    } catch (err) {
      console.error("Error resetting files:", err);
      res.status(500).json({ error: "Failed to reset files" });
    }
  });

  app.get("/api/feedback-notes", async (_req, res) => {
    try {
      const notes = await db.select().from(feedbackNotes).orderBy(sql`created_at DESC`);
      res.json(notes);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch feedback notes" });
    }
  });

  app.post("/api/feedback-notes", async (req, res) => {
    try {
      const parsed = insertFeedbackNoteSchema.parse(req.body);
      const [note] = await db.insert(feedbackNotes).values(parsed).returning();
      res.json(note);
    } catch (err) {
      res.status(500).json({ error: "Failed to save feedback note" });
    }
  });

  app.delete("/api/feedback-notes/:id", async (req, res) => {
    try {
      await db.delete(feedbackNotes).where(eq(feedbackNotes.id, parseInt(req.params.id)));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete feedback note" });
    }
  });

  app.get("/api/shift-schedule", async (_req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      const schedule = await storage.getShiftSchedule();
      res.json(schedule);
    } catch (err) {
      console.error("Error fetching shift schedule:", err);
      res.status(500).json({ error: "Failed to fetch shift schedule" });
    }
  });

  app.post("/api/shift-schedule", async (req, res) => {
    try {
      const validShiftTypes = ['day', 'night', 'off'];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const { date, shiftType, bulk } = req.body;
      if (bulk && Array.isArray(bulk)) {
        const validatedBulk = bulk.filter((e: any) =>
          typeof e.date === 'string' && dateRegex.test(e.date) &&
          typeof e.shiftType === 'string' && validShiftTypes.includes(e.shiftType)
        );
        await storage.setShiftBulk(validatedBulk);
        const schedule = await storage.getShiftSchedule();
        return res.json(schedule);
      }
      if (!date || !shiftType) {
        return res.status(400).json({ error: "date and shiftType required" });
      }
      if (!dateRegex.test(date) || !validShiftTypes.includes(shiftType)) {
        return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD) or shiftType (day/night/off)" });
      }
      const result = await storage.setShiftDay(date, shiftType);
      res.json(result);
    } catch (err) {
      console.error("Error setting shift schedule:", err);
      res.status(500).json({ error: "Failed to set shift schedule" });
    }
  });

  app.delete("/api/shift-schedule/:date", async (req, res) => {
    try {
      await storage.deleteShiftDay(req.params.date);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting shift day:", err);
      res.status(500).json({ error: "Failed to delete shift day" });
    }
  });

  // POST /api/tasks/auto-create-file-tasks - Auto-create tasks for module/reading files without corresponding tasks
  app.post("/api/tasks/auto-create-file-tasks", async (req, res) => {
    try {
      const { weekNumber } = req.body;
      if (!weekNumber) return res.status(400).json({ error: "weekNumber required" });

      const activeSemester = await storage.getActiveSemesterSettings();
      const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
      const readingWeekStart = activeSemester?.readingWeekStart || null;
      const weekDates = getWeekDates(weekNumber, semesterStart, readingWeekStart);

      const friday = new Date(weekDates.start);
      friday.setDate(friday.getDate() + 6);
      friday.setHours(12, 0, 0, 0);

      const allFiles = await storage.getFiles();
      const allTasks = await storage.getTasks({ weekNumber });

      const created: any[] = [];

      for (const course of COURSES) {
        const courseCode = course.code.toLowerCase();
        const courseFullName = `${course.code} - ${course.name}`;
        const moduleFolderKey = `week-${weekNumber}-${courseCode}-module`;
        const readingFolderKey = `week-${weekNumber}-${courseCode}-reading`;

        const hasModuleFiles = allFiles.some(f => f.folder === moduleFolderKey);
        const hasReadingFiles = allFiles.some(f => f.folder === readingFolderKey);

        if (!hasModuleFiles && !hasReadingFiles) continue;

        const courseTasksForWeek = allTasks.filter(t => {
          const taskCourse = t.courseName?.split(' - ')[0]?.toUpperCase() || '';
          return taskCourse === course.code.toUpperCase() && (t.type === 'module' || t.type === 'reading');
        });

        if (courseTasksForWeek.length > 0) continue;

        const title = hasModuleFiles && hasReadingFiles
          ? `${course.code} Module & Reading`
          : hasModuleFiles
            ? `${course.code} Module`
            : `${course.code} Reading`;

        const newTask = await storage.createTask({
          title,
          type: "module",
          courseName: courseFullName,
          dueDate: friday,
          weekNumber,
          priority: "medium",
          description: "",
          isCompleted: false,
        } as InsertTask);

        created.push(newTask);
      }

      res.json({ created, count: created.length });
    } catch (err) {
      console.error("Error auto-creating file tasks:", err);
      res.status(500).json({ error: "Failed to auto-create file tasks" });
    }
  });

  // POST /api/semester/generate-class-tasks - Auto-create class tasks for virtual courses
  app.post("/api/semester/generate-class-tasks", async (req, res) => {
    try {
      const activeSemester = await storage.getActiveSemesterSettings();
      if (!activeSemester) {
        return res.status(404).json({ error: "No active semester settings found" });
      }

      const validDeliveryModes = ['virtual', 'online', '', null];
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', '', null];

      const courseConfigs = [
        { prefix: 'course1' as const, code: activeSemester.course1Code, name: activeSemester.course1Name },
        { prefix: 'course2' as const, code: activeSemester.course2Code, name: activeSemester.course2Name },
        { prefix: 'course3' as const, code: activeSemester.course3Code, name: activeSemester.course3Name },
      ];

      const dayToNumber: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };

      const allTasks = await storage.getTasks();
      const existingClassTasks = allTasks.filter(t => t.type === 'class');

      const createdTasks: any[] = [];
      let skippedCount = 0;

      for (const config of courseConfigs) {
        const deliveryMode = (activeSemester as any)[`${config.prefix}DeliveryMode`];
        if (deliveryMode !== 'virtual') continue;

        const classDay1 = (activeSemester as any)[`${config.prefix}ClassDay`];
        const classDay2 = (activeSemester as any)[`${config.prefix}ClassDay2`];
        const classTime = (activeSemester as any)[`${config.prefix}ClassTime`] || '09:00';
        const classEndTime = (activeSemester as any)[`${config.prefix}ClassEndTime`] || '12:00';
        const courseStartDate = (activeSemester as any)[`${config.prefix}StartDate`];
        const courseEndDate = (activeSemester as any)[`${config.prefix}EndDate`];

        if (!validDays.includes(classDay1) || !validDays.includes(classDay2)) continue;

        const classDays: number[] = [];
        if (classDay1 && dayToNumber[classDay1] !== undefined) classDays.push(dayToNumber[classDay1]);
        if (classDay2 && dayToNumber[classDay2] !== undefined) classDays.push(dayToNumber[classDay2]);

        if (classDays.length === 0) continue;

        const semesterStart = courseStartDate ? new Date(courseStartDate) : new Date(activeSemester.semesterStartDate);
        const semesterEnd = courseEndDate 
          ? new Date(courseEndDate) 
          : (activeSemester.semesterEndDate ? new Date(activeSemester.semesterEndDate) : new Date(semesterStart.getTime() + 13 * 7 * 24 * 60 * 60 * 1000));

        const courseName = config.name.startsWith(config.code) ? config.name : `${config.code} - ${config.name}`;
        const displayName = config.name.startsWith(config.code) ? config.name.replace(`${config.code} - `, '') : config.name;
        const dmLabel = deliveryMode === 'virtual' ? 'Online' : deliveryMode === 'online' ? 'Online' : deliveryMode === 'in-person' ? 'In-Person' : '';
        const classTitle = dmLabel ? `${dmLabel} ${displayName} Class` : `${displayName} Class`;
        const [startHour, startMinute] = classTime.split(':').map(Number);
        const [endHour, endMinute] = classEndTime.split(':').map(Number);

        const current = new Date(semesterStart);
        while (current <= semesterEnd) {
          if (classDays.includes(current.getDay())) {
            const taskDate = new Date(current);
            taskDate.setHours(12, 0, 0, 0);

            const weekNum = getWeekNumber(taskDate, undefined, activeSemester?.readingWeekStart);
            if (weekNum >= FIRST_WEEK && weekNum <= LAST_WEEK) {
              const dateStr = formatLocalDate(taskDate);
              const isDuplicate = existingClassTasks.some(t => {
                if (!t.dueDate) return false;
                const existingDateStr = formatLocalDate(new Date(t.dueDate));
                return existingDateStr === dateStr 
                  && t.courseName === courseName 
                  && t.eventStartTime === classTime;
              });

              if (isDuplicate) {
                skippedCount++;
              } else {
                const task = await storage.createTask({
                  title: classTitle,
                  type: "class",
                  courseName,
                  dueDate: taskDate,
                  eventStartTime: classTime,
                  eventEndTime: classEndTime,
                  weekNumber: weekNum,
                  priority: "medium",
                  reminder1: DEFAULT_REMINDER_1,
                  reminder2: DEFAULT_REMINDER_2,
                });
                createdTasks.push(task);
              }
            }
          }
          current.setDate(current.getDate() + 1);
        }
      }

      const message = skippedCount > 0 
        ? `Created ${createdTasks.length} class tasks (${skippedCount} duplicates skipped)`
        : `Created ${createdTasks.length} class tasks`;

      res.json({ message, tasks: createdTasks });
    } catch (err) {
      console.error("Error generating class tasks:", err);
      res.status(500).json({ error: "Failed to generate class tasks" });
    }
  });

  // ============= FILE MANAGEMENT ROUTES =============

  // POST /api/files/sync-names - Sync file names to include course names and module numbers
  app.post("/api/files/sync-names", async (_req, res) => {
    try {
      // First, delete duplicate files (keep only the one with the highest ID for each object_path)
      await db.execute(sql`
        DELETE FROM files 
        WHERE id NOT IN (
          SELECT MAX(id) FROM files GROUP BY object_path
        )
      `);
      
      // Update CPPA122 files that don't have the course name yet
      await db.execute(sql`
        UPDATE files SET display_name = REPLACE(display_name, 'CPPA122, ', 'CPPA122 - Local Politics and Government, ') 
        WHERE display_name LIKE 'CPPA122,%' AND display_name NOT LIKE 'CPPA122 - Local Politics and Government,%'
      `);
      
      // Update CFNF400 files that don't have the course name yet
      await db.execute(sql`
        UPDATE files SET display_name = REPLACE(display_name, 'CFNF400, ', 'CFNF400 - Human Sexuality, ') 
        WHERE display_name LIKE 'CFNF400,%' AND display_name NOT LIKE 'CFNF400 - Human Sexuality,%'
      `);
      
      // Update CASL101 files that don't have the course name yet
      await db.execute(sql`
        UPDATE files SET display_name = REPLACE(display_name, 'CASL101, ', 'CASL101 - Sign Language, ') 
        WHERE display_name LIKE 'CASL101,%' AND display_name NOT LIKE 'CASL101 - Sign Language,%'
      `);
      
      res.json({ success: true, message: "File names synced and duplicates removed" });
    } catch (err) {
      console.error("Error syncing file names:", err);
      res.status(500).json({ error: "Failed to sync file names" });
    }
  });
  
  // POST /api/cleanup-duplicates - Remove duplicate tasks and files (with CORS)
  app.options("/api/cleanup-duplicates", (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });
  
  app.post("/api/cleanup-duplicates", async (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    try {
      // Delete duplicate files (keep only the one with the highest ID for each object_path)
      await db.execute(sql`
        DELETE FROM files 
        WHERE id NOT IN (
          SELECT MAX(id) FROM files GROUP BY object_path
        )
      `);
      
      // Delete duplicate tasks (keep only the one with highest ID for same title + due_date + course_name)
      await db.execute(sql`
        DELETE FROM tasks 
        WHERE id NOT IN (
          SELECT MAX(id) FROM tasks GROUP BY title, due_date, course_name
        )
      `);
      
      // Update file display names with course names
      await db.execute(sql`
        UPDATE files SET display_name = REPLACE(display_name, 'CPPA122, ', 'CPPA122 - Local Politics and Government, ') 
        WHERE display_name LIKE 'CPPA122,%' AND display_name NOT LIKE 'CPPA122 - Local Politics and Government,%'
      `);
      await db.execute(sql`
        UPDATE files SET display_name = REPLACE(display_name, 'CFNF400, ', 'CFNF400 - Human Sexuality, ') 
        WHERE display_name LIKE 'CFNF400,%' AND display_name NOT LIKE 'CFNF400 - Human Sexuality,%'
      `);
      await db.execute(sql`
        UPDATE files SET display_name = REPLACE(display_name, 'CASL101, ', 'CASL101 - Sign Language, ') 
        WHERE display_name LIKE 'CASL101,%' AND display_name NOT LIKE 'CASL101 - Sign Language,%'
      `);
      
      res.json({ success: true, message: "Duplicates removed and file names synced" });
    } catch (err) {
      console.error("Error cleaning up duplicates:", err);
      res.status(500).json({ error: "Failed to clean up duplicates" });
    }
  });

  // GET /api/onedrive/week-counts/:weekNum - Fetch file counts from OneDrive for a given week
  app.get("/api/onedrive/week-counts/:weekNum", async (req, res) => {
    try {
      const weekNum = parseInt(req.params.weekNum);
      if (isNaN(weekNum)) return res.status(400).json({ error: "Invalid week number" });

      const semester = await storage.getActiveSemesterSettings();
      const year = semester?.semesterStartDate ? new Date(semester.semesterStartDate).getFullYear() : new Date().getFullYear();
      const semFolder = getSemesterTypeFolder(semester?.semesterType);
      const basePath = `/School/1. TMU/Courses/${year}/${semFolder}`;
      const courses: string[] = [];
      if (semester?.course1Code) courses.push(semester.course1Code);
      if (semester?.course2Code) courses.push(semester.course2Code);
      if (semester?.course3Code) courses.push(semester.course3Code);
      if (courses.length === 0) return res.json({});
      const counts: Record<string, { total: number; listened: number; unlistened: number }> = {};

      // Get list of course folders from OneDrive
      const { getOneDriveClient } = await import("./onedrive");
      const client = await getOneDriveClient();
      
      let baseFolders: any[] = [];
      try {
        const baseResp = await client.api(`/me/drive/root:${basePath}:/children`).get();
        baseFolders = baseResp.value || [];
      } catch (e) {
        return res.json(counts);
      }

      // Check files from database first to get listened status
      const dbFiles = await storage.getFiles();
      const dbListened = new Set<string>();
      for (const f of dbFiles) {
        if (f.listened && f.originalName) {
          dbListened.add(f.originalName.toLowerCase());
        }
      }

      // Process each course in parallel
      await Promise.all(courses.map(async (courseCode) => {
        const courseId = courseCode.toLowerCase();
        try {
          const matchedFolder = baseFolders.find((f: any) => 
            f.folder && f.name.toUpperCase().startsWith(courseCode)
          );
          if (!matchedFolder) return;

          const coursePath = `${basePath}/${matchedFolder.name}`;
          const courseResp = await client.api(`/me/drive/root:${coursePath}:/children`).get();
          const courseFolders = courseResp.value || [];
          
          const weekFolder = courseFolders.find((f: any) => 
            f.folder && f.name.toLowerCase().startsWith(`week ${weekNum}`)
          );
          if (!weekFolder) return;

          const weekPath = `${coursePath}/${weekFolder.name}`;
          const weekResp = await client.api(`/me/drive/root:${weekPath}:/children`).get();
          const weekContents = weekResp.value || [];

          // Count files in Module and Reading subfolders
          for (const subfolder of weekContents) {
            if (!subfolder.folder) continue;
            const subName = subfolder.name.toLowerCase();
            let type: string | null = null;
            if (subName.includes('module')) type = 'module';
            else if (subName.includes('reading')) type = 'reading';
            if (!type) continue;

            const subPath = `${weekPath}/${subfolder.name}`;
            const subResp = await client.api(`/me/drive/root:${subPath}:/children`).get();
            const files = (subResp.value || []).filter((f: any) => !f.folder);
            
            const key = `week-${weekNum}-${courseId}-${type}`;
            let listened = 0;
            let unlistened = 0;
            for (const file of files) {
              if (dbListened.has(file.name.toLowerCase())) {
                listened++;
              } else {
                unlistened++;
              }
            }
            counts[key] = { total: files.length, listened, unlistened };
          }
        } catch (e) {
          // Skip course on error
        }
      }));

      res.json(counts);
    } catch (err) {
      console.error("Error fetching OneDrive week counts:", err);
      res.status(500).json({ error: "Failed to fetch OneDrive week counts" });
    }
  });

  // GET /api/files/counts - Fast file counts by week/course/type with listened breakdown
  // Returns: { "week-4-cppa122-module": { total: 3, listened: 1, unlistened: 2 }, ... }
  app.get("/api/files/counts", async (_req, res) => {
    try {
      const files = await storage.getFiles();
      const counts: Record<string, { total: number; listened: number; unlistened: number; partialProgress: number }> = {};
      
      for (const file of files) {
        if (!file.folder) continue;
        
        const folderMatch = file.folder.match(/^week-(\d+)-([a-z0-9]+)-(module|reading|other)$/i);
        if (!folderMatch) continue;
        
        const folderKey = file.folder.toLowerCase();
        if (!counts[folderKey]) {
          counts[folderKey] = { total: 0, listened: 0, unlistened: 0, partialProgress: 0 };
        }
        
        const isPrepared = file.listened || (file.totalChunks && file.totalChunks > 0);
        if (!isPrepared) continue;
        
        counts[folderKey].total++;
        if (file.listened) {
          counts[folderKey].listened++;
          counts[folderKey].partialProgress += 100;
        } else {
          counts[folderKey].unlistened++;
          if (file.checkedChunks && file.checkedChunks !== 'null' && file.checkedChunks !== '[]' && file.totalChunks && file.totalChunks > 0) {
            try {
              const checked = JSON.parse(file.checkedChunks);
              if (Array.isArray(checked) && checked.length > 0) {
                counts[folderKey].partialProgress += Math.round((checked.length / file.totalChunks) * 100);
              } else if (file.lastChunkIndex != null && file.lastChunkIndex > 0) {
                counts[folderKey].partialProgress += Math.round((file.lastChunkIndex / file.totalChunks) * 100);
              }
            } catch {
              if (file.lastChunkIndex != null && file.lastChunkIndex > 0) {
                counts[folderKey].partialProgress += Math.round((file.lastChunkIndex / file.totalChunks) * 100);
              }
            }
          } else if (file.totalChunks && file.totalChunks > 0 && file.lastChunkIndex != null && file.lastChunkIndex > 0) {
            counts[folderKey].partialProgress += Math.round((file.lastChunkIndex / file.totalChunks) * 100);
          }
        }
      }
      
      res.json(counts);
    } catch (err) {
      console.error("Error fetching file counts:", err);
      res.status(500).json({ error: "Failed to fetch file counts" });
    }
  });

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

  // GET /api/files/recently-prepared (must be before :id route)
  app.get("/api/files/recently-prepared", async (_req, res) => {
    res.json({ files: (globalThis as any).__recentlyPreparedFiles || [] });
  });

  // GET /api/files/:id - Get single file
  app.get("/api/files/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid file ID" });
      }
      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err) {
      console.error("Error fetching file:", err);
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  // GET /api/proxy-pdf - Proxy a PDF from an external URL (e.g., OneDrive download URL)
  app.get("/api/proxy-pdf", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url || !url.startsWith('http')) {
        return res.status(400).json({ error: "Valid URL is required" });
      }
      
      const pdfResponse = await fetch(url);
      if (!pdfResponse.ok) {
        return res.status(502).json({ error: `Failed to fetch PDF: ${pdfResponse.status}` });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      const contentLength = pdfResponse.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      if (pdfResponse.body) {
        const reader = pdfResponse.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const buffer = await pdfResponse.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
    } catch (err) {
      console.error("Error proxying PDF:", err);
      res.status(500).json({ error: "Failed to proxy PDF" });
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
        
        await objectStorageService.downloadObject(objectFile, res);
      } else if (mediaUrl.startsWith("onedrive://")) {
        // OneDrive file - look up the actual download URL from OneDrive
        const fileName = mediaUrl.split('/').pop() || '';
        const folderPart = mediaUrl.replace('onedrive://', '').split('/')[0] || '';
        // Parse folder like "week-5-cppa122-module" to find the OneDrive path
        const parts = folderPart.split('-');
        const weekNum = parts[1];
        const courseCode = parts[2]?.toUpperCase();
        
        if (courseCode && weekNum) {
          try {
            const basePath = `/School/1. TMU/Courses/2026/Winter`;
            const baseFolders = await listOneDriveItems(basePath);
            const matchedFolder = baseFolders.find((f: any) => 
              f.type === 'folder' && f.name.toUpperCase().startsWith(courseCode)
            );
            if (matchedFolder) {
              const courseFolders = await listOneDriveItems(matchedFolder.path);
              const weekFolder = courseFolders.find((f: any) => 
                f.type === 'folder' && f.name.toLowerCase().startsWith(`week ${weekNum}`)
              );
              if (weekFolder) {
                const weekContents = await listOneDriveItems(weekFolder.path);
                const typeFolder = weekContents.find((f: any) => 
                  f.type === 'folder' && f.name.toLowerCase().includes(folderPart.includes('reading') ? 'reading' : 'module')
                );
                if (typeFolder) {
                  const files = await listOneDriveItems(typeFolder.path);
                  const matchedFile = files.find((f: any) => f.name === fileName);
                  if (matchedFile?.downloadUrl) {
                    const pdfResponse = await fetch(matchedFile.downloadUrl);
                    if (pdfResponse.ok && pdfResponse.body) {
                      res.setHeader('Content-Type', 'application/pdf');
                      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
                      const reader = pdfResponse.body.getReader();
                      const pump = async () => {
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          res.write(value);
                        }
                        res.end();
                      };
                      await pump();
                      return;
                    }
                  }
                }
              }
            }
            return res.status(404).json({ error: "OneDrive file not found" });
          } catch (onedriveErr) {
            console.error("Error fetching from OneDrive:", onedriveErr);
            return res.status(500).json({ error: "Failed to fetch OneDrive file" });
          }
        } else {
          return res.status(400).json({ error: "Invalid OneDrive path format" });
        }
      } else if (mediaUrl.startsWith("/School/")) {
        try {
          const { getOneDriveClient } = await import("./onedrive");
          const client = await getOneDriveClient();
          const encodedPath = encodeURIComponent(mediaUrl).replace(/%2F/g, '/');
          const item = await client.api(`/me/drive/root:${encodedPath}`).get();
          const downloadUrl = item['@microsoft.graph.downloadUrl'];
          if (!downloadUrl) {
            return res.status(400).json({ error: "Could not get OneDrive download URL" });
          }
          const pdfResponse = await fetch(downloadUrl);
          if (pdfResponse.ok && pdfResponse.body) {
            res.setHeader('Content-Type', pdfResponse.headers.get('content-type') || 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${mediaUrl.split('/').pop()}"`);
            const reader = pdfResponse.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } else {
            res.status(502).json({ error: "Failed to fetch file from OneDrive" });
          }
        } catch (fetchErr) {
          console.error("Error fetching OneDrive file for download:", fetchErr);
          res.status(500).json({ error: "Failed to fetch OneDrive file" });
        }
      } else if (mediaUrl.startsWith("http")) {
        // External URL - proxy the download to avoid CORS issues
        try {
          const pdfResponse = await fetch(mediaUrl);
          if (pdfResponse.ok && pdfResponse.body) {
            res.setHeader('Content-Type', pdfResponse.headers.get('content-type') || 'application/pdf');
            const reader = pdfResponse.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } else {
            res.status(502).json({ error: "Failed to fetch external file" });
          }
        } catch (fetchErr) {
          console.error("Error proxying file:", fetchErr);
          res.status(502).json({ error: "Failed to proxy file download" });
        }
      } else {
        res.status(400).json({ error: "Unsupported file path format" });
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

      if (file.extractedText) {
        console.log(`[TextAPI] Using cached extractedText for file ${file.id} (${file.extractedText.length} chars)`);
        return res.json({ text: file.extractedText });
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
      } else if (mediaUrl.startsWith("/School/") || mediaUrl.startsWith("onedrive://")) {
        try {
          const { getOneDriveClient } = await import("./onedrive");
          const client = await getOneDriveClient();
          const encodedPath = encodeURIComponent(mediaUrl).replace(/%2F/g, '/');
          const item = await client.api(`/me/drive/root:${encodedPath}`).get();
          const downloadUrl = item['@microsoft.graph.downloadUrl'];
          if (!downloadUrl) {
            return res.status(400).json({ error: "Could not get OneDrive download URL" });
          }
          const fileResponse = await fetch(downloadUrl);
          if (!fileResponse.ok) {
            return res.status(400).json({ error: "Failed to fetch file from OneDrive" });
          }
          const arrayBuffer = await fileResponse.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        } catch (error) {
          console.error("Error fetching from OneDrive for text extraction:", error);
          return res.status(400).json({ error: "Failed to fetch file from OneDrive" });
        }
      } else if (mediaUrl.startsWith("http")) {
        const fileResponse = await fetch(mediaUrl);
        if (!fileResponse.ok) {
          return res.status(400).json({ error: "Failed to fetch file content" });
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        return res.status(400).json({ error: "Unsupported file path format" });
      }
      
      if (!fileBuffer) {
        return res.status(400).json({ error: "Failed to read file" });
      }

      const isPDF = fileBuffer.slice(0, 4).toString() === '%PDF';
      
      if (isPDF) {
        try {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(fileBuffer), verbosity: 0 });
          await parser.load();
          const pdfText = await parser.getText();
          
          const PAGE_BREAK_MARKER = '\n\n---PAGE---\n\n';
          
          console.log(`[PDF Parse] getText type: ${typeof pdfText}, isArray: ${Array.isArray(pdfText)}, keys: ${pdfText && typeof pdfText === 'object' ? Object.keys(pdfText).join(',') : 'N/A'}`);
          if (pdfText && typeof pdfText === 'object' && (pdfText as any).pages) {
            console.log(`[PDF Parse] pages count: ${(pdfText as any).pages.length}`);
          }
          
          if (pdfText && typeof pdfText === 'object') {
            if (pdfText.pages && Array.isArray(pdfText.pages)) {
              console.log(`[PDF Parse] Extracting from ${pdfText.pages.length} pages`);
              textContent = pdfText.pages.map((page: any) => page.text || '').join(PAGE_BREAK_MARKER);
            } else if (Array.isArray(pdfText)) {
              console.log(`[PDF Parse] Array with ${pdfText.length} items`);
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
          console.log(`[PDF Parse] Raw extracted text length: ${textContent.length}`);
          await parser.destroy();
        } catch (error) {
          console.error("Error parsing PDF:", error);
          return res.status(400).json({ error: "Failed to parse PDF" });
        }
      } else {
        textContent = fileBuffer.toString('utf-8');
      }
      
      // Filter out boxed content (sidebars, callout boxes, etc.)
      // Heuristics: detect blocks that appear to be in boxes based on formatting patterns
      const filterBoxedContent = (text: string): string => {
        return text;
      };
      
      // Apply boxed content filter
      textContent = filterBoxedContent(textContent);
      
      // Apply the same TTS cleaning to display text (removes French, JSTOR refs, URLs, etc.)
      // This ensures what users see matches what they hear
      textContent = cleanTextForTTS(textContent);
      
      // Restore some formatting for display (TTS cleaning removes newlines)
      // Re-add paragraph breaks where there were multiple spaces
      textContent = textContent
        .replace(/\. {2,}/g, '.\n\n')
        .replace(/\s+/g, ' ')
        .trim();

      if (textContent && file.id) {
        storage.updateFile(file.id, { extractedText: textContent }).then(() => {
          console.log(`[TextAPI] Cached ${textContent.length} chars for file ${file.id}`);
        }).catch((e: any) => console.error(`[TextAPI] Cache save failed:`, e.message));
      }

      res.json({ text: textContent, fileName: file.displayName || file.originalName });
    } catch (err) {
      console.error("Error extracting file text:", err);
      res.status(500).json({ error: "Failed to extract file text" });
    }
  });

  // POST /api/extract-text-from-url - Extract text from a PDF at a given URL (for OneDrive files)
  app.post("/api/extract-text-from-url", async (req, res) => {
    try {
      let { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Decode HTML entities in URL (OneDrive returns &amp; instead of &)
      url = url.replace(/&amp;/g, '&');
      console.log("Extracting text from URL:", url.substring(0, 100) + "...");

      // Fetch the PDF from the URL
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Failed to fetch file, status:", response.status, response.statusText);
        return res.status(400).json({ error: `Failed to fetch file from URL: ${response.status}` });
      }
      console.log("Successfully fetched PDF, extracting text...");

      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Extract text using pdf-parse (same pattern as file extraction)
      const PdfParser = await getPdfParser();
      const parser = new PdfParser({ data: new Uint8Array(buffer), verbosity: 0 });
      const pdfText = await parser.getText();

      // Use PAGE_BREAK_MARKER for page breaks
      const PAGE_BREAK_MARKER = '\n\n---PAGE---\n\n';
      let textContent = '';
      
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

      // Clean up text
      textContent = textContent
        .replace(/\r\n/g, '\n')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .trim();

      console.log("Text extraction complete. Length:", textContent.length, "chars, first 100:", textContent.substring(0, 100));
      res.json({ text: textContent });
    } catch (err) {
      console.error("Error extracting text from URL:", err);
      res.status(500).json({ error: "Failed to extract text from URL" });
    }
  });

  // PATCH /api/files/:id - Update file (rename, change folder, mark listened, or save progress)
  app.patch("/api/files/:id", async (req, res) => {
    try {
      const { displayName, folder, listened, lastChunkIndex, totalChunks, checkedChunks } = req.body;
      if (!displayName && folder === undefined && listened === undefined && lastChunkIndex === undefined && totalChunks === undefined && checkedChunks === undefined) {
        return res.status(400).json({ error: "displayName, folder, listened, lastChunkIndex, totalChunks, or checkedChunks is required" });
      }
      const file = await storage.updateFile(Number(req.params.id), { displayName, folder, listened, lastChunkIndex, totalChunks, checkedChunks });
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err) {
      console.error("Error updating file:", err);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  // POST /api/files/ensure - Create or find a file by objectPath (for OneDrive files that need DB entries)
  app.post("/api/files/ensure", async (req, res) => {
    try {
      const { objectPath, originalName, displayName, folder } = req.body;
      if (!objectPath || !originalName) {
        return res.status(400).json({ error: "objectPath and originalName are required" });
      }
      
      // Check if file already exists by objectPath
      let file = await storage.getFileByPath(objectPath);
      if (file) {
        // Update folder if provided and different
        if (folder && file.folder !== folder) {
          file = await storage.updateFile(file.id, { folder }) || file;
        }
        return res.json(file);
      }
      
      // Fallback: check by originalName + folder to prevent duplicates
      // (same file may exist under a different objectPath, e.g. uploaded vs OneDrive path)
      if (folder) {
        const allFiles = await storage.getFiles();
        const match = allFiles.find(f => f.originalName === originalName && f.folder === folder);
        if (match) {
          // Update the objectPath to the new stable path so future lookups match
          file = await storage.updateFile(match.id, { objectPath }) || match;
          return res.json(file);
        }
      }
      
      // Create new file entry
      file = await storage.createFile({
        objectPath,
        originalName,
        displayName: displayName || originalName,
        folder: folder || null,
        contentType: 'application/pdf',
        size: 0,
        listened: false,
        lastChunkIndex: 0,
        totalChunks: 0,
      });
      
      res.json(file);
    } catch (err) {
      console.error("Error ensuring file:", err);
      res.status(500).json({ error: "Failed to ensure file" });
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

  // ============= ONEDRIVE ROUTES =============
  
  // GET /api/onedrive/files - List files in a OneDrive folder
  app.get("/api/onedrive/files", async (req, res) => {
    try {
      const path = (req.query.path as string) || '/';
      const items = await listOneDriveItems(path);
      res.json(items);
    } catch (err: any) {
      console.error("Error listing OneDrive files:", err);
      res.status(500).json({ error: err.message || "Failed to list OneDrive files" });
    }
  });

  // GET /api/onedrive/file/:id - Get file details and download URL
  app.get("/api/onedrive/file/:id", async (req, res) => {
    try {
      const itemId = req.params.id;
      const file = await getOneDriveFile(itemId);
      res.json(file);
    } catch (err: any) {
      console.error("Error getting OneDrive file:", err);
      res.status(500).json({ error: err.message || "Failed to get OneDrive file" });
    }
  });

  // GET /api/onedrive/search - Search for files
  app.get("/api/onedrive/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const items = await searchOneDriveFiles(query);
      res.json(items);
    } catch (err: any) {
      console.error("Error searching OneDrive:", err);
      res.status(500).json({ error: err.message || "Failed to search OneDrive" });
    }
  });

  const QUICKNOTES_PATH = '/QuickNotes';
  const QUICKNOTES_DEFAULT_FILE = 'notes.txt';

  app.get("/api/quicknotes/debug", async (req, res) => {
    try {
      const path = (req.query.path as string) || QUICKNOTES_PATH;
      const items = await listOneDriveItems(path);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/quicknotes/files", async (_req, res) => {
    try {
      const items = await listOneDriveItems(QUICKNOTES_PATH);
      const notes = items.filter((f: any) => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html');
      });
      res.json(notes);
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === 'itemNotFound' || err.message?.includes('itemNotFound') || err.message?.includes('Resource not found')) {
        try {
          await createOneDriveFolder('/', 'QuickNotes');
          await createOneDriveTextFile(QUICKNOTES_PATH, QUICKNOTES_DEFAULT_FILE, 'Type your notes here from your phone using the OneDrive app.\nThis file syncs live to your dashboard.\n');
          const items = await listOneDriveItems(QUICKNOTES_PATH);
          const notes = items.filter((f: any) => {
            const name = (f.name || '').toLowerCase();
            return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html');
          });
          res.json(notes);
        } catch (createErr: any) {
          console.error("Error creating QuickNotes folder:", createErr);
          res.status(500).json({ error: createErr.message || "Failed to create QuickNotes folder" });
        }
      } else {
        console.error("Error listing QuickNotes:", err);
        res.status(500).json({ error: err.message || "Failed to list notes" });
      }
    }
  });

  app.get("/api/quicknotes/file/:id/content", async (req, res) => {
    try {
      const content = await getOneDriveFileContentAsText(req.params.id);
      res.json({ content });
    } catch (err: any) {
      console.error("Error getting QuickNotes content:", err);
      res.status(500).json({ error: err.message || "Failed to get note content" });
    }
  });

  app.get("/api/quicknotes/file/:id/meta", async (req, res) => {
    try {
      const meta = await getOneDriveFile(req.params.id);
      res.json(meta);
    } catch (err: any) {
      console.error("Error getting QuickNotes meta:", err);
      res.status(500).json({ error: err.message || "Failed to get note metadata" });
    }
  });

  app.put("/api/quicknotes/file/:id/content", async (req, res) => {
    try {
      const { content } = req.body;
      if (typeof content !== 'string') {
        return res.status(400).json({ error: "content field required" });
      }
      const result = await updateOneDriveFileContent(req.params.id, content);
      res.json(result);
    } catch (err: any) {
      console.error("Error saving QuickNotes content:", err);
      res.status(500).json({ error: err.message || "Failed to save note" });
    }
  });

  app.post("/api/quicknotes/files", async (req, res) => {
    try {
      const { name, content } = req.body;
      const fileName = name || `Note ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.txt`;
      const result = await createOneDriveTextFile(QUICKNOTES_PATH, fileName, content || '');
      res.json(result);
    } catch (err: any) {
      console.error("Error creating QuickNote:", err);
      res.status(500).json({ error: err.message || "Failed to create note" });
    }
  });

  app.patch("/api/quicknotes/file/:id/rename", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Name is required" });
      }
      const { renameOneDriveItem } = await import("./onedrive");
      await renameOneDriveItem(req.params.id, name);
      res.json({ success: true, name });
    } catch (err: any) {
      console.error("Error renaming QuickNote:", err);
      res.status(500).json({ error: err.message || "Failed to rename note" });
    }
  });

  app.delete("/api/quicknotes/file/:id", async (req, res) => {
    try {
      await deleteOneDriveItem(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting QuickNote:", err);
      res.status(500).json({ error: err.message || "Failed to delete note" });
    }
  });

  app.get("/api/quicknotes/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      if (!q.trim()) return res.json([]);
      const allFiles = await listOneDriveItems(QUICKNOTES_PATH);
      const textFiles = allFiles.filter((f: any) => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html');
      });
      const matching = textFiles.filter((f: any) => f.name.toLowerCase().includes(q.toLowerCase()));
      res.json(matching);
    } catch (err: any) {
      console.error("Error searching QuickNotes:", err);
      res.status(500).json({ error: err.message || "Failed to search notes" });
    }
  });

  app.get("/api/onenote/notebooks", async (req, res) => {
    try {
      const { listOneNoteNotebooks } = await import("./onedrive");
      const notebooks = await listOneNoteNotebooks();
      res.json(notebooks);
    } catch (err: any) {
      console.error("Error listing OneNote notebooks:", err);
      res.status(500).json({ error: err.message || "Failed to list notebooks" });
    }
  });

  app.get("/api/onenote/pages", async (req, res) => {
    try {
      const notebookPath = req.query.notebook as string;
      const section = req.query.section as string;
      if (!notebookPath || !section) {
        return res.status(400).json({ error: "notebook and section query params required" });
      }
      const { getOneNotePages } = await import("./onedrive");
      const pages = await getOneNotePages(notebookPath, section + '.one');
      res.json(pages);
    } catch (err: any) {
      console.error("Error getting OneNote pages:", err);
      res.status(500).json({ error: err.message || "Failed to get pages" });
    }
  });

  app.post("/api/onedrive/ensure-semester-folders", async (req, res) => {
    try {
      const { semesterId } = req.body;
      let semester: any;
      if (semesterId) {
        const allSemesters = await storage.getAllSemesterSettings();
        semester = allSemesters.find((s: any) => s.id === semesterId);
      } else {
        semester = await storage.getActiveSemesterSettings();
      }
      if (!semester) return res.status(404).json({ error: "Semester not found" });

      const { createOneDriveFolder } = await import("./onedrive");
      const semType = getSemesterTypeFolder(semester.semesterType);
      const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const year = startDate.getFullYear();
      const basePath = `/School/1. TMU/Courses/${year}`;
      const semFolder = semType;

      await createOneDriveFolder(basePath, semFolder);
      const semPath = `${basePath}/${semFolder}`;

      const results: string[] = [];

      for (let i = 1; i <= 3; i++) {
        const code = ((semester as any)[`course${i}Code`] || '').replace(/\s/g, '');
        if (!code) continue;
        const name = (semester as any)[`course${i}Name`] || '';
        const folderName = name ? `${code} - ${name}` : code;
        await createOneDriveFolder(semPath, folderName);
        const coursePath = `${semPath}/${folderName}`;

        const weekNames = generateWeekFolderNames(semester, i);
        for (const weekName of weekNames) {
          await createOneDriveFolder(coursePath, weekName);
          const weekPath = `${coursePath}/${weekName}`;
          await createOneDriveFolder(weekPath, "Module");
          await createOneDriveFolder(weekPath, "Reading");
        }
        results.push(`${folderName} (${weekNames.length} weeks)`);
      }

      console.log(`[OneDrive] Ensured semester folders for ${semester.semesterName}: ${results.join(', ')}`);
      res.json({ success: true, folders: results });
    } catch (err: any) {
      console.error("Error ensuring semester folders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/rename-course-folder", async (req, res) => {
    try {
      const { semesterId, courseIndex, oldCode, oldName, newCode, newName } = req.body;
      if (!courseIndex || (!newCode && !newName)) {
        return res.status(400).json({ error: "Missing courseIndex, newCode, or newName" });
      }

      let semester: any;
      if (semesterId) {
        const allSemesters = await storage.getAllSemesterSettings();
        semester = allSemesters.find((s: any) => s.id === semesterId);
      } else {
        semester = await storage.getActiveSemesterSettings();
      }
      if (!semester) return res.status(404).json({ error: "Semester not found" });

      const { renameOneDriveFolder, createOneDriveFolder, checkOneDriveFolderExists } = await import("./onedrive");
      const semType = getSemesterTypeFolder(semester.semesterType);
      const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const year = startDate.getFullYear();
      const semPath = `/School/1. TMU/Courses/${year}/${semType}`;

      const effectiveOldCode = (oldCode || '').replace(/\s/g, '');
      const effectiveNewCode = (newCode || '').replace(/\s/g, '');
      const oldFolderName = oldName ? `${effectiveOldCode} - ${oldName}` : effectiveOldCode;
      const newFolderName = newName ? `${effectiveNewCode} - ${newName}` : effectiveNewCode;

      if (oldFolderName === newFolderName) {
        return res.json({ success: true, action: 'no_change' });
      }

      const oldPath = `${semPath}/${oldFolderName}`;
      const oldExists = await checkOneDriveFolderExists(oldPath);

      if (oldExists) {
        const result = await renameOneDriveFolder(oldPath, newFolderName);
        console.log(`[OneDrive] Renamed folder: ${oldFolderName} → ${newFolderName}: ${JSON.stringify(result)}`);
        res.json({ success: true, action: 'renamed', from: oldFolderName, to: newFolderName, ...result });
      } else {
        await createOneDriveFolder(semPath, newFolderName);
        const coursePath = `${semPath}/${newFolderName}`;
        const weekNames = generateWeekFolderNames(semester, courseIndex);
        for (const weekName of weekNames) {
          await createOneDriveFolder(coursePath, weekName);
          const weekPath = `${coursePath}/${weekName}`;
          await createOneDriveFolder(weekPath, "Module");
          await createOneDriveFolder(weekPath, "Reading");
        }
        console.log(`[OneDrive] Created new folder structure: ${newFolderName} (${weekNames.length} weeks, old '${oldFolderName}' not found)`);
        res.json({ success: true, action: 'created', folder: newFolderName, weeks: weekNames.length });
      }
    } catch (err: any) {
      console.error("Error renaming course folder:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/create-semester-folders", async (req, res) => {
    try {
      const { semesterName, semesterFolder, year, courses, numWeeks } = req.body;
      if (!semesterFolder || !year || !courses || !numWeeks) {
        return res.status(400).json({ error: "Missing required fields: semesterFolder, year, courses, numWeeks" });
      }

      const basePath = `/School/1. TMU/Courses/${year}`;
      const results: any[] = [];

      const semFolderResult = await createOneDriveFolder(basePath, semesterFolder);
      results.push({ path: `${basePath}/${semesterFolder}`, ...semFolderResult });
      const semPath = `${basePath}/${semesterFolder}`;

      const semester = await storage.getActiveSemesterSettings();
      for (let ci = 0; ci < courses.length; ci++) {
        const course = courses[ci];
        const courseFolderName = `${course.code} - ${course.name}`;
        const courseResult = await createOneDriveFolder(semPath, courseFolderName);
        results.push({ path: `${semPath}/${courseFolderName}`, ...courseResult });
        const coursePath = `${semPath}/${courseFolderName}`;

        const weekNames = semester ? generateWeekFolderNames(semester, ci + 1) : Array.from({ length: numWeeks }, (_, i) => `Week ${i + 1}`);
        for (const weekFolderName of weekNames) {
          const weekResult = await createOneDriveFolder(coursePath, weekFolderName);
          results.push({ path: `${coursePath}/${weekFolderName}`, ...weekResult });
          const weekPath = `${coursePath}/${weekFolderName}`;

          const moduleResult = await createOneDriveFolder(weekPath, "Module");
          results.push({ path: `${weekPath}/Module`, ...moduleResult });

          const readingResult = await createOneDriveFolder(weekPath, "Reading");
          results.push({ path: `${weekPath}/Reading`, ...readingResult });
        }
      }

      const created = results.filter(r => r.created).length;
      const existed = results.filter(r => r.exists).length;
      console.log(`[OneDrive] Created ${created} folders, ${existed} already existed for ${semesterName || semesterFolder}`);
      res.json({ success: true, created, existed, total: results.length, details: results });
    } catch (err: any) {
      console.error("Error creating semester folders:", err);
      res.status(500).json({ error: err.message || "Failed to create semester folders" });
    }
  });

  app.post("/api/onedrive/ensure-all-semester-folders", async (req, res) => {
    try {
      const allSemesters = await storage.getAllSemesterSettings();

      const { createOneDriveFolder } = await import("./onedrive");
      const allResults: Array<{ semester: string; folders: string[] }> = [];

      if (allSemesters && allSemesters.length > 0) {
        for (const semester of allSemesters) {
          const semType = getSemesterTypeFolder(semester.semesterType);
          const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
          const year = startDate.getFullYear();
          const basePath = `/School/1. TMU/Courses/${year}`;

          await createOneDriveFolder(basePath, semType);
          const semPath = `${basePath}/${semType}`;
          const courseResults: string[] = [];

          for (let i = 1; i <= 3; i++) {
            const code = ((semester as any)[`course${i}Code`] || '').replace(/\s/g, '');
            if (!code) continue;
            const name = (semester as any)[`course${i}Name`] || '';
            const folderName = name ? `${code} - ${name}` : code;
            await createOneDriveFolder(semPath, folderName);
            const coursePath = `${semPath}/${folderName}`;

            const weekNames = generateWeekFolderNames(semester, i);
            for (const weekName of weekNames) {
              await createOneDriveFolder(coursePath, weekName);
              const weekPath = `${coursePath}/${weekName}`;
              await createOneDriveFolder(weekPath, "Module");
              await createOneDriveFolder(weekPath, "Reading");
            }
            courseResults.push(`${folderName} (${weekNames.length} weeks)`);
          }

          allResults.push({ semester: semester.semesterName || `${semType} ${year}`, folders: courseResults });
          console.log(`[OneDrive] Ensured folders for ${semester.semesterName}: ${courseResults.join(', ')}`);
        }
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const semesterTypes = ['Winter', 'Spring & Summer', 'Fall'];
      const existingKeys = new Set(
        (allSemesters || []).map((s: any) => {
          const semType = getSemesterTypeFolder(s.semesterType);
          const year = s.semesterStartDate ? new Date(s.semesterStartDate).getFullYear() : currentYear;
          return `${year}/${semType}`;
        })
      );

      const placeholderResults: string[] = [];
      for (let year = currentYear; year <= currentYear + 2; year++) {
        const yearPath = `/School/1. TMU/Courses/${year}`;
        try {
          await createOneDriveFolder('/School/1. TMU/Courses', String(year));
        } catch (e: any) {
          console.log(`[OneDrive] Year folder ${year}: ${e.message}`);
        }
        for (const semType of semesterTypes) {
          const key = `${year}/${semType}`;
          if (existingKeys.has(key)) continue;
          try {
            await createOneDriveFolder(yearPath, semType);
            placeholderResults.push(`${year}/${semType}`);
            console.log(`[OneDrive] Created placeholder folder: ${year}/${semType}`);
          } catch (e: any) {
            console.log(`[OneDrive] Placeholder ${year}/${semType}: ${e.message}`);
          }
        }
      }

      res.json({ success: true, semesters: allResults, placeholders: placeholderResults });
    } catch (err: any) {
      console.error("Error ensuring all semester folders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/ensure-placeholder-folders", async (req, res) => {
    try {
      const allSemesters = await storage.getAllSemesterSettings();
      const { createOneDriveFolder } = await import("./onedrive");

      const now = new Date();
      const currentYear = now.getFullYear();
      const semesterTypes = ['Winter', 'Spring & Summer', 'Fall'];
      const existingKeys = new Set(
        (allSemesters || []).map((s: any) => {
          const semType = getSemesterTypeFolder(s.semesterType);
          const year = s.semesterStartDate ? new Date(s.semesterStartDate).getFullYear() : currentYear;
          return `${year}/${semType}`;
        })
      );

      const placeholderResults: string[] = [];
      for (let year = currentYear; year <= currentYear + 2; year++) {
        const yearPath = `/School/1. TMU/Courses/${year}`;
        try {
          await createOneDriveFolder('/School/1. TMU/Courses', String(year));
        } catch (e: any) {
          // ignore if year folder already exists
        }
        for (const semType of semesterTypes) {
          const key = `${year}/${semType}`;
          if (existingKeys.has(key)) continue;
          try {
            await createOneDriveFolder(yearPath, semType);
            placeholderResults.push(`${year}/${semType}`);
            console.log(`[OneDrive] Created placeholder folder: ${year}/${semType}`);
          } catch (e: any) {
            // ignore if folder already exists
          }
        }
      }

      res.json({ success: true, placeholders: placeholderResults });
    } catch (err: any) {
      console.error("Error ensuring placeholder folders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/rename-week-folders", async (req, res) => {
    try {
      const { courseCode, courseName, weekStyle } = req.body;
      if (!courseCode || !weekStyle) {
        return res.status(400).json({ error: "courseCode and weekStyle are required" });
      }

      const allSemesters = await storage.getAllSemesterSettings();
      const { listOneDriveFolderChildren, renameOneDriveItem } = await import("./onedrive");

      let targetSemester: any = null;
      let courseIndex = -1;
      for (const sem of allSemesters || []) {
        for (let i = 1; i <= 5; i++) {
          const code = sem[`course${i}Code` as keyof typeof sem];
          if (code && String(code).toLowerCase() === courseCode.toLowerCase()) {
            targetSemester = sem;
            courseIndex = i;
            break;
          }
        }
        if (targetSemester) break;
      }

      if (!targetSemester || courseIndex < 0) {
        return res.status(404).json({ error: "Course not found in any semester" });
      }

      const semType = getSemesterTypeFolder(targetSemester.semesterType);
      const year = targetSemester.semesterStartDate
        ? new Date(targetSemester.semesterStartDate).getFullYear()
        : new Date().getFullYear();
      const cName = targetSemester[`course${courseIndex}Name` as keyof typeof targetSemester] || courseName || courseCode;
      const cCode = String(targetSemester[`course${courseIndex}Code` as keyof typeof targetSemester] || courseCode);
      const courseFolderName = `${cCode} - ${cName}`;
      const courseFolderPath = `/School/1. TMU/Courses/${year}/${semType}/${courseFolderName}`;

      const children = await listOneDriveFolderChildren(courseFolderPath);
      const weekFolders = (children || []).filter((c: any) =>
        c.folder && (c.name.startsWith("Week ") || c.name.startsWith("Reading Week"))
      ).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      if (weekFolders.length === 0) {
        return res.json({ success: true, message: "No week folders found to rename.", renamed: 0 });
      }

      const newNames = generateWeekFolderNames(targetSemester, courseIndex);
      let renamedCount = 0;

      for (let i = 0; i < weekFolders.length && i < newNames.length; i++) {
        const folder = weekFolders[i];
        const newName = newNames[i];
        if (folder.name !== newName) {
          try {
            await renameOneDriveItem(folder.id, newName);
            renamedCount++;
            console.log(`[OneDrive] Renamed "${folder.name}" → "${newName}"`);
          } catch (e: any) {
            console.error(`[OneDrive] Failed to rename "${folder.name}":`, e.message);
          }
        }
      }

      res.json({ success: true, message: `Renamed ${renamedCount} week folders to "${weekStyle}" style.`, renamed: renamedCount });
    } catch (err: any) {
      console.error("Rename week folders error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============= END ONEDRIVE ROUTES =============

  // ============= D2L ANNOUNCEMENTS =============
  app.get("/api/announcements", async (_req, res) => {
    try {
      const all = await storage.getAnnouncements();
      const now = new Date();
      const active = [];
      for (const a of all) {
        if (a.courseName === 'Custom' || a.courseName === 'REMINDER' || a.courseName === 'URGENT') {
          active.push(a);
          continue;
        }
        const received = new Date(a.receivedAt);
        const dayOfWeek = received.getDay();
        const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
        const fridayEnd = new Date(received);
        fridayEnd.setDate(received.getDate() + daysUntilFriday);
        fridayEnd.setHours(23, 59, 59, 999);
        if (now <= fridayEnd) {
          active.push(a);
        } else {
          storage.deleteAnnouncement(a.id).catch(() => {});
        }
      }
      res.json(active);
    } catch (err: any) {
      console.error("Error fetching announcements:", err.message);
      res.json([]);
    }
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const { body } = req.body;
      if (!body || typeof body !== 'string' || !body.trim()) {
        return res.status(400).json({ error: "body is required" });
      }
      const tag = req.body.courseName || 'Custom';
      const created = await storage.createAnnouncement({
        emailId: `manual-${Date.now()}`,
        subject: tag === 'Custom' ? 'Custom Ticker' : `${tag} Ticker`,
        body: body.trim(),
        snippet: body.trim().substring(0, 200),
        courseName: tag,
        receivedAt: new Date(),
      });
      console.log(`[Ticker] Manually added ticker item id:${created.id} body:"${body.trim().substring(0, 50)}"`);
      res.json(created);
    } catch (err: any) {
      console.error("Error creating announcement:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      await storage.deleteAnnouncement(id);
      console.log(`[Ticker] Deleted ticker item id:${id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting announcement:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/announcements/reorder", async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds array required" });
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(announcements).set({ sortOrder: i }).where(eq(announcements.id, orderedIds[i]));
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error reordering announcements:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/announcements/webhook", async (req, res) => {
    try {
      const { emailId, subject, body, snippet, courseName, receivedAt } = req.body;
      if (!subject) {
        return res.status(400).json({ error: "subject is required" });
      }
      const id = emailId || `manual-${Date.now()}`;
      const existing = await storage.getAnnouncementByEmailId(id);
      if (existing) {
        return res.json({ success: true, message: "Already exists", id: existing.id });
      }
      const created = await storage.createAnnouncement({
        emailId: id,
        subject,
        body: body || '',
        snippet: snippet || subject.slice(0, 100),
        courseName: courseName || extractCourseFromSubject(subject),
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      });
      console.log(`[Announcements] New: "${subject}" (${created.courseName})`);
      res.json({ success: true, id: created.id });
    } catch (err: any) {
      console.error("Announcement webhook error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  function extractCourseFromSubject(subject: string): string {
    const match = subject.match(/\[([^\]]+)\]/);
    if (match) return match[1].trim();
    const codeMatch = subject.match(/([A-Z]{3,4}\s?\d{3})/i);
    if (codeMatch) return codeMatch[1];
    return 'University';
  }

  app.post('/api/webhook/reminder', async (req, res) => {
    try {
      const { subject, body, auth } = req.body;
      if (auth !== '5747') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const title = (subject || '').replace(/^reminder\s*/i, '').trim() || (body || '').trim() || 'Reminder';
      const description = body?.trim() || null;

      const dueDate = new Date();
      dueDate.setHours(9, 0, 0, 0);

      const semesterSettings = await storage.getActiveSemesterSettings();
      let weekNumber = 1;
      if (semesterSettings?.semesterStartDate) {
        const { getWeekNumber } = await import('../shared/schema');
        weekNumber = getWeekNumber(
          new Date(),
          new Date(semesterSettings.semesterStartDate),
          semesterSettings.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : null
        );
      }

      const task = await storage.createTask({
        title,
        type: 'reminder',
        courseName: null,
        dueDate,
        eventStartTime: null,
        eventEndTime: null,
        weekNumber,
        priority: 'medium',
        description,
        isCompleted: false,
        isAcknowledged: false,
      });
      console.log(`[Email Reminder] Created reminder #${task.id}: "${title}"`);
      return res.json({ action: 'created', id: task.id, title });
    } catch (err: any) {
      console.error('[Email Reminder] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/webhook/delete', async (req, res) => {
    try {
      const { body, auth } = req.body;
      if (auth !== '5747') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!body || typeof body !== 'string') {
        return res.status(400).json({ error: 'Missing body' });
      }
      const text = body.trim().toLowerCase().replace(/^delete\s+/i, '');

      const tickerMatch = text.match(/^ticker\s+(?:item\s+)?(.+)/i);
      if (tickerMatch) {
        const target = tickerMatch[1].trim();
        const all = await storage.getAnnouncements();
        const matches = all.filter(a => a.body.toLowerCase().includes(target) || a.snippet?.toLowerCase().includes(target) || a.subject?.toLowerCase().includes(target));
        for (const m of matches) {
          await storage.deleteAnnouncement(m.id);
        }
        console.log(`[Email Delete] Deleted ${matches.length} ticker items matching "${target}"`);
        return res.json({ action: 'deleted', type: 'ticker', target, count: matches.length });
      }

      const calendarMatch = text.match(/^calendar\s+(?:item\s+|entry\s+)?(.+)/i);
      if (calendarMatch) {
        const target = calendarMatch[1].trim();
        const allTasks = await storage.getTasks();
        const matches = allTasks.filter((t: any) => t.title.toLowerCase().includes(target) || t.description?.toLowerCase().includes(target));
        for (const m of matches) {
          if ((m as any).calendarEventId) {
            try { await deleteCalendarEvent((m as any).calendarEventId); } catch (e: any) { console.log(`[Email Delete] Failed to remove Google Calendar event: ${e.message}`); }
          }
          if ((m as any).prepCalendarEventId) {
            try { await deleteCalendarEvent((m as any).prepCalendarEventId); } catch (e: any) { console.log(`[Email Delete] Failed to remove prep calendar event: ${e.message}`); }
          }
          if ((m as any).secondAccountCalendarEventId) {
            try { await deleteEventFromSecondAccount((m as any).secondAccountCalendarEventId); } catch (e: any) { console.log(`[Email Delete] Failed to remove second account event: ${e.message}`); }
          }
          if ((m as any).secondAccountPrepEventId) {
            try { await deleteEventFromSecondAccount((m as any).secondAccountPrepEventId); } catch (e: any) { console.log(`[Email Delete] Failed to remove second account prep event: ${e.message}`); }
          }
          if ((m as any).repeatType && (m as any).repeatType !== 'none') {
            const children = await storage.getChildTasks(m.id);
            for (const child of children) {
              if ((child as any).calendarEventId) { try { await deleteCalendarEvent((child as any).calendarEventId); } catch {} }
              if ((child as any).secondAccountCalendarEventId) { try { await deleteEventFromSecondAccount((child as any).secondAccountCalendarEventId); } catch {} }
              await storage.deleteTask(child.id);
            }
          }
          await storage.deleteTask(m.id);
        }
        console.log(`[Email Delete] Deleted ${matches.length} calendar tasks matching "${target}" (with Google Calendar cleanup)`);
        return res.json({ action: 'deleted', type: 'calendar', target, count: matches.length });
      }

      const todoMatch = text.match(/^(?:todo|reminder|to-do|to do)\s+(.+)/i);
      if (todoMatch) {
        const target = todoMatch[1].trim();
        const allTasks = await storage.getTasks();
        const matches = allTasks.filter((t: any) => t.type === 'reminder' && (t.title.toLowerCase().includes(target) || t.description?.toLowerCase().includes(target)));
        for (const m of matches) {
          await storage.deleteTask(m.id);
        }
        console.log(`[Email Delete] Deleted ${matches.length} todo/reminder tasks matching "${target}"`);
        return res.json({ action: 'deleted', type: 'todo', target, count: matches.length });
      }

      return res.status(400).json({ error: 'Unrecognized delete target. Use: "ticker item xyz", "calendar item xyz", or "todo xyz"' });
    } catch (err: any) {
      console.error('[Email Delete] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Unified email intake — routes emails from homeworkbryn@gmail.com to the correct handler
  app.post('/api/webhook/email', async (req, res) => {
    try {
      const { emailId, subject, body, from, auth } = req.body;
      if (auth !== '5747') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const subjectLower = (subject || '').trim().toLowerCase();
      const bodyLower = (body || '').trim().toLowerCase();

      // Route based on subject prefix
      if (subjectLower.startsWith('ticker')) {
        // Forward to ticker handler
        const tickerResp = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/ticker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId, subject, body, auth }),
        });
        const tickerData = await tickerResp.json();
        console.log(`[Email Router] Routed to ticker: "${subject}"`);
        return res.json({ routed: 'ticker', ...tickerData });
      }

      if (subjectLower.startsWith('reminder') || subjectLower.startsWith('remind')) {
        // Forward to reminder handler
        const remResp = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, body, auth }),
        });
        const remData = await remResp.json();
        console.log(`[Email Router] Routed to reminder: "${subject}"`);
        return res.json({ routed: 'reminder', ...remData });
      }

      if (subjectLower.startsWith('delete')) {
        // Forward to delete handler
        const delResp = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: subject, auth }),
        });
        const delData = await delResp.json();
        console.log(`[Email Router] Routed to delete: "${subject}"`);
        return res.json({ routed: 'delete', ...delData });
      }

      // Default: route to email-homework (task creation)
      const hwResp = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/email-homework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': auth },
        body: JSON.stringify({ subject, body, from }),
      });
      const hwData = await hwResp.json();
      console.log(`[Email Router] Routed to email-homework: "${subject}"`);
      return res.json({ routed: 'email-homework', ...hwData });

    } catch (err: any) {
      console.error('[Email Router] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });
  console.log('[Email Router] Unified email intake ready at POST /api/webhook/email');

  const tickerExpirations = new Map<number, NodeJS.Timeout>();
  app.post('/api/webhook/ticker', async (req, res) => {
    try {
      const { emailId, body, subject, auth } = req.body;
      if (auth !== '5747') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      let rawBody = (body && typeof body === 'string' && body.trim()) ? body.trim() : null;
      if (rawBody) {
        rawBody = rawBody.replace(/^ticker\s+item\s+/i, '').trim();
      }
      const subjectText = (subject && typeof subject === 'string') ? subject.replace(/^ticker\s*/i, '').trim() : null;
      const messageBody = rawBody || subjectText;
      if (!messageBody) {
        return res.status(400).json({ error: 'Missing body and subject' });
      }
      const { command, target, expireMinutes } = parseTickerCommand(messageBody);

      if (command === 'clear') {
        const all = await storage.getAnnouncements();
        for (const a of all) {
          await storage.deleteAnnouncement(a.id);
          if (tickerExpirations.has(a.id)) { clearTimeout(tickerExpirations.get(a.id)!); tickerExpirations.delete(a.id); }
        }
        console.log(`[Gmail Ticker] Cleared all ${all.length} ticker items`);
        return res.json({ action: 'cleared', count: all.length });
      }

      if (command === 'delete' && target) {
        const all = await storage.getAnnouncements();
        const lowerTarget = target.toLowerCase();
        const matches = all.filter(a => a.body.toLowerCase().includes(lowerTarget) || a.snippet?.toLowerCase().includes(lowerTarget));
        for (const m of matches) {
          await storage.deleteAnnouncement(m.id);
          if (tickerExpirations.has(m.id)) { clearTimeout(tickerExpirations.get(m.id)!); tickerExpirations.delete(m.id); }
        }
        console.log(`[Gmail Ticker] Deleted ${matches.length} ticker items matching "${target}"`);
        return res.json({ action: 'deleted', target, count: matches.length });
      }

      if (command === 'expire' && expireMinutes) {
        const all = await storage.getAnnouncements();
        if (all.length > 0) {
          const latest = all[all.length - 1];
          const ms = expireMinutes * 60 * 1000;
          const timeout = setTimeout(async () => {
            try {
              await storage.deleteAnnouncement(latest.id);
              tickerExpirations.delete(latest.id);
              console.log(`[Gmail Ticker] Auto-expired ticker item: "${latest.body.slice(0, 60)}..." (id: ${latest.id})`);
            } catch (err: any) {
              console.error('[Gmail Ticker] Expire cleanup error:', err.message);
            }
          }, ms);
          tickerExpirations.set(latest.id, timeout);
          console.log(`[Gmail Ticker] Set ${expireMinutes}min expiration for: "${latest.body.slice(0, 60)}..." (id: ${latest.id})`);
          return res.json({ action: 'expire_set', minutes: expireMinutes, itemId: latest.id });
        }
        return res.json({ action: 'expire_noop', reason: 'no items' });
      }

      const { cleanBody, expireMinutes: inlineExpire } = extractInlineExpiry(messageBody);
      const finalBody = cleanBody || messageBody;

      const msgId = emailId || `webhook-${Date.now()}`;
      const existing = await storage.getAnnouncementByEmailId(msgId);
      if (existing) {
        return res.json({ action: 'duplicate', emailId: msgId });
      }

      const created = await storage.createAnnouncement({
        emailId: msgId,
        subject: 'Ticker Update',
        body: finalBody,
        snippet: finalBody.slice(0, 200),
        courseName: 'Custom',
        receivedAt: new Date(),
      });
      console.log(`[Gmail Ticker] Added to ticker: "${finalBody.slice(0, 60)}..." (id: ${created.id})`);

      if (inlineExpire) {
        const ms = inlineExpire * 60 * 1000;
        const timeout = setTimeout(async () => {
          try {
            await storage.deleteAnnouncement(created.id);
            tickerExpirations.delete(created.id);
            console.log(`[Gmail Ticker] Auto-expired ticker item: "${finalBody.slice(0, 60)}..." (id: ${created.id})`);
          } catch (err: any) {
            console.error('[Gmail Ticker] Expire cleanup error:', err.message);
          }
        }, ms);
        tickerExpirations.set(created.id, timeout);
        console.log(`[Gmail Ticker] Set inline ${inlineExpire}min expiration for: "${finalBody.slice(0, 60)}..." (id: ${created.id})`);
        return res.json({ action: 'added_with_expiry', id: created.id, expiresInMinutes: inlineExpire });
      }

      return res.json({ action: 'added', id: created.id });
    } catch (err: any) {
      console.error('[Gmail Ticker] Webhook error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });
  console.log('[Gmail Ticker] Webhook endpoint ready at POST /api/webhook/ticker');

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

  // ============= THIRD GOOGLE ACCOUNT ROUTES (CRCU - Partner Shifts) =============

  app.get("/api/google/third-account/status", async (_req, res) => {
    try {
      const status = await isThirdAccountConnected();
      res.json(status);
    } catch (err) {
      console.error("Third account status error:", err);
      res.json({ connected: false, error: String(err) });
    }
  });

  app.get("/api/google/third-account/auth", async (_req, res) => {
    try {
      const authUrl = getThirdAccountAuthUrl();
      res.json({ authUrl });
    } catch (err) {
      console.error("Third account auth error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/google/third-account/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send('Missing authorization code');
      }
      
      const account = await exchangeCodeForTokensThird(code);
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Success</title></head>
          <body>
            <h1>CRCU Account Connected!</h1>
            <p>Connected email: ${account.email}</p>
            <p>You can close this window and return to the app.</p>
            <script>
              setTimeout(() => {
                window.opener?.postMessage({ type: 'THIRD_ACCOUNT_CONNECTED', email: '${account.email}' }, '*');
                window.close();
              }, 1500);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Third account callback error:", err);
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

  app.delete("/api/google/third-account", async (_req, res) => {
    try {
      await disconnectThirdAccount();
      res.json({ success: true });
    } catch (err) {
      console.error("Third account disconnect error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/google/third-account/events", async (req, res) => {
    try {
      const calendarId = req.query.calendarId as string || 'primary';
      const timeMin = new Date(req.query.timeMin as string || Date.now());
      const timeMax = new Date(req.query.timeMax as string || Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const events = calendarId === 'primary' 
        ? await getEventsFromThirdAccount(timeMin, timeMax)
        : await getEventsFromThirdAccountCalendar(calendarId, timeMin, timeMax);
      res.json(events);
    } catch (err) {
      console.error("Third account events error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/google/third-account/calendars", async (_req, res) => {
    try {
      const calendars = await listThirdAccountCalendars();
      res.json(calendars);
    } catch (err) {
      console.error("Third account calendars error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/google/third-account/sync-shifts", async (req, res) => {
    try {
      const calendarId = 'family01331437021788124598@group.calendar.google.com';
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), 0, 1);
      const timeMax = new Date(now.getFullYear() + 1, 0, 31, 23, 59, 59);
      
      const events = await getEventsFromThirdAccountCalendar(calendarId, timeMin, timeMax);
      
      const shiftEntries: { date: string; shiftType: string }[] = [];
      
      for (const event of events) {
        const summary = (event.summary || '').toLowerCase();
        if (!summary.includes('crcu')) continue;
        
        const startStr = event.start?.dateTime || event.start?.date;
        if (!startStr) continue;
        
        const startDate = new Date(startStr);
        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        
        const hour = startDate.getHours();
        const minute = startDate.getMinutes();
        const timeVal = hour + minute / 60;
        const isNight = timeVal >= 14 || timeVal < 4 || summary.includes('🌙');
        
        shiftEntries.push({
          date: dateStr,
          shiftType: isNight ? 'night' : 'day',
        });
      }
      
      await storage.clearAllShifts();
      
      if (shiftEntries.length > 0) {
        await storage.setShiftBulk(shiftEntries);
      }
      
      const schedule = await storage.getShiftSchedule();
      res.json({ synced: shiftEntries.length, schedule });
    } catch (err) {
      console.error("CRCU shift sync error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ============= END THIRD GOOGLE ACCOUNT ROUTES =============

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
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      for (let ti = 0; ti < tasks.length; ti++) {
        const task = tasks[ti];
        if (ti > 0 && ti % 5 === 0) await delay(1000);
        try {
          if (task.calendarEventId) {
            const updatedEvent = await updateCalendarEvent(task.calendarEventId, {
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              courseName: task.courseName,
            });
            if (updatedEvent?.deleted) {
              const event = await createCalendarEvent({
                id: task.id, title: task.title, description: task.description,
                dueDate: task.dueDate, courseName: task.courseName,
              });
              await storage.updateTask(task.id, { calendarEventId: event.id, calendarProvider: "google" });
              results.dueEvents.created++;
            } else {
              if (updatedEvent.id && updatedEvent.id !== task.calendarEventId) {
                await storage.updateTask(task.id, { calendarEventId: updatedEvent.id });
              }
              results.dueEvents.updated++;
            }
          } else {
            const summary = `${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`;
            const dateStr = formatLocalDate(new Date(task.dueDate));
            const existingId = await findExistingEventBySummary(summary, dateStr);
            if (existingId) {
              await storage.updateTask(task.id, { calendarEventId: existingId, calendarProvider: "google" });
              results.dueEvents.updated++;
            } else {
              const event = await createCalendarEvent({
                id: task.id, title: task.title, description: task.description,
                dueDate: task.dueDate, courseName: task.courseName,
              });
              await storage.updateTask(task.id, { calendarEventId: event.id, calendarProvider: "google" });
              results.dueEvents.created++;
            }
          }
        } catch (err: any) {
          const status = err?.status || err?.code;
          if (status === 410) {
            try {
              const event = await createCalendarEvent({
                id: task.id, title: task.title, description: task.description,
                dueDate: task.dueDate, courseName: task.courseName,
              });
              await storage.updateTask(task.id, { calendarEventId: event.id, calendarProvider: "google" });
              results.dueEvents.created++;
            } catch (recreateErr) {
              console.error(`Failed to recreate event for task ${task.id}:`, recreateErr);
              results.dueEvents.failed++;
            }
          } else {
            console.error(`Failed to sync due date for task ${task.id}:`, err);
            results.dueEvents.failed++;
          }
        }
        
        await delay(300);
        
        if (task.startDate) {
          try {
            if (task.prepCalendarEventId) {
              const updatedEvent = await updatePrepCalendarEvent(task.prepCalendarEventId, {
                title: task.title, description: task.description,
                startDate: task.startDate, dueDate: task.dueDate, courseName: task.courseName,
              });
              if (updatedEvent?.deleted) {
                const event = await createPrepCalendarEvent({
                  id: task.id, title: task.title, description: task.description,
                  startDate: task.startDate, dueDate: task.dueDate, courseName: task.courseName,
                });
                await storage.updateTask(task.id, { prepCalendarEventId: event.id });
                results.prepEvents.created++;
              } else {
                if (updatedEvent.id && updatedEvent.id !== task.prepCalendarEventId) {
                  await storage.updateTask(task.id, { prepCalendarEventId: updatedEvent.id });
                }
                results.prepEvents.updated++;
              }
            } else {
              const event = await createPrepCalendarEvent({
                id: task.id, title: task.title, description: task.description,
                startDate: task.startDate, dueDate: task.dueDate, courseName: task.courseName,
              });
              await storage.updateTask(task.id, { prepCalendarEventId: event.id });
              results.prepEvents.created++;
            }
          } catch (err: any) {
            const status = err?.status || err?.code;
            if (status === 410) {
              try {
                const event = await createPrepCalendarEvent({
                  id: task.id, title: task.title, description: task.description,
                  startDate: task.startDate, dueDate: task.dueDate, courseName: task.courseName,
                });
                await storage.updateTask(task.id, { prepCalendarEventId: event.id });
                results.prepEvents.created++;
              } catch (recreateErr) {
                console.error(`Failed to recreate prep event for task ${task.id}:`, recreateErr);
                results.prepEvents.failed++;
              }
            } else {
              console.error(`Failed to sync prep event for task ${task.id}:`, err);
              results.prepEvents.failed++;
            }
          }
          await delay(300);
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

  app.post("/api/calendar/deduplicate", async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const timeMin = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
      const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const timeMax = end.toISOString();
      const result = await findAndDeleteDuplicateEvents(timeMin, timeMax);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Error deduplicating calendar:", err);
      res.status(500).json({ message: 'Failed to deduplicate', error: String(err) });
    }
  });

  // PATCH /api/tasks/:id/reschedule
  app.patch(api.tasks.reschedule.path, async (req, res) => {
    const { dueDate, weekNumber } = req.body;
    const parsedDate = new Date(dueDate);
    const etHour = parseInt(parsedDate.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Toronto' }), 10) % 24;
    const etMin = parseInt(parsedDate.toLocaleString('en-US', { minute: 'numeric', timeZone: 'America/Toronto' }), 10);
    const hasTime = etHour !== 0 || etMin !== 0;
    const eventStartTime = hasTime ? `${etHour.toString().padStart(2, '0')}:${etMin.toString().padStart(2, '0')}` : null;
    const updateFields: Record<string, any> = { 
      dueDate: parsedDate,
      weekNumber,
      isMissed: false
    };
    if (eventStartTime) {
      updateFields.eventStartTime = eventStartTime;
    }
    const task = await storage.updateTask(Number(req.params.id), updateFields);
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
    const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : new Date(2026, 0, 10, 12, 0, 0);
    const readingWeek = activeSemester?.readingWeekStart || null;
    const now = new Date();
    const weekNum = getWeekNumber(now, semesterStart, readingWeek);
    const { start, end } = getWeekDates(weekNum, semesterStart, readingWeek);
    // Format as YYYY-MM-DD using local time
    const formatDateOnly = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    res.json({
      weekNumber: weekNum,
      startDate: formatDateOnly(start),
      endDate: formatDateOnly(end),
    });
  });

  // GET /api/weeks
  app.get(api.weeks.list.path, async (_req, res) => {
    const activeSemester = await storage.getActiveSemesterSettings();
    const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : new Date(2026, 0, 10, 12, 0, 0);
    const readingWeek = activeSemester?.readingWeekStart || null;
    const taskCounts = await storage.getTaskCountByWeek();
    const weeks = [];
    
    // Format as YYYY-MM-DD using local time
    const formatDateOnly = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
      const { start, end } = getWeekDates(w, semesterStart, readingWeek);
      weeks.push({
        weekNumber: w,
        startDate: formatDateOnly(start),
        endDate: formatDateOnly(end),
        taskCount: taskCounts[w] || 0,
      });
    }
    
    res.json(weeks);
  });

  // ============================================
  // SUBTASK ROUTES
  // ============================================
  
  // GET /api/tasks/:taskId/subtasks - Get all subtasks for a task
  app.get("/api/tasks/:taskId/subtasks", async (req, res) => {
    try {
      const taskId = Number(req.params.taskId);
      const subtasks = await storage.getSubtasksByTask(taskId);
      res.json(subtasks);
    } catch (err) {
      console.error("Error fetching subtasks:", err);
      res.status(500).json({ message: "Failed to fetch subtasks" });
    }
  });

  // POST /api/tasks/:taskId/subtasks - Create a subtask
  app.post("/api/tasks/:taskId/subtasks", async (req, res) => {
    try {
      const taskId = Number(req.params.taskId);
      const subtaskData = {
        ...req.body,
        parentTaskId: taskId,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      };
      const subtask = await storage.createSubtask(subtaskData);
      res.status(201).json(subtask);
    } catch (err) {
      console.error("Error creating subtask:", err);
      res.status(500).json({ message: "Failed to create subtask" });
    }
  });

  // PATCH /api/subtasks/:id - Update a subtask
  app.patch("/api/subtasks/:id", async (req, res) => {
    try {
      const subtaskId = Number(req.params.id);
      const updates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      // Remove undefined values
      Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
      const subtask = await storage.updateSubtask(subtaskId, updates);
      res.json(subtask);
    } catch (err) {
      console.error("Error updating subtask:", err);
      res.status(500).json({ message: "Failed to update subtask" });
    }
  });

  // DELETE /api/subtasks/:id - Delete a subtask
  app.delete("/api/subtasks/:id", async (req, res) => {
    try {
      const subtaskId = Number(req.params.id);
      await storage.deleteSubtask(subtaskId);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting subtask:", err);
      res.status(500).json({ message: "Failed to delete subtask" });
    }
  });

  // ============================================
  // TASK LINK ROUTES
  // ============================================

  // GET /api/tasks/:taskId/links - Get all links for a task
  app.get("/api/tasks/:taskId/links", async (req, res) => {
    try {
      const taskId = Number(req.params.taskId);
      const links = await storage.getLinksForTask(taskId);
      res.json(links);
    } catch (err) {
      console.error("Error fetching task links:", err);
      res.status(500).json({ message: "Failed to fetch task links" });
    }
  });

  // GET /api/subtasks/:subtaskId/links - Get all links for a subtask
  app.get("/api/subtasks/:subtaskId/links", async (req, res) => {
    try {
      const subtaskId = Number(req.params.subtaskId);
      const links = await storage.getLinksForSubtask(subtaskId);
      res.json(links);
    } catch (err) {
      console.error("Error fetching subtask links:", err);
      res.status(500).json({ message: "Failed to fetch subtask links" });
    }
  });

  // GET /api/links - Get all task links
  app.get("/api/links", async (req, res) => {
    try {
      const links = await storage.getAllTaskLinks();
      res.json(links);
    } catch (err) {
      console.error("Error fetching all task links:", err);
      res.status(500).json({ message: "Failed to fetch task links" });
    }
  });

  // POST /api/links - Create a new link between tasks/subtasks
  app.post("/api/links", async (req, res) => {
    try {
      const { sourceType, sourceId, targetType, targetId, linkType } = req.body;
      const link = await storage.createTaskLink({
        sourceType,
        sourceId,
        targetType,
        targetId,
        linkType: linkType || "relates_to",
      });
      res.status(201).json(link);
    } catch (err) {
      console.error("Error creating task link:", err);
      res.status(500).json({ message: "Failed to create task link" });
    }
  });

  // DELETE /api/links/:id - Delete a link
  app.delete("/api/links/:id", async (req, res) => {
    try {
      const linkId = Number(req.params.id);
      await storage.deleteTaskLink(linkId);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting task link:", err);
      res.status(500).json({ message: "Failed to delete task link" });
    }
  });

  // ============================================
  // VOICE COMMAND ROUTES (Home Assistant / Alexa integration)
  // ============================================

  // POST /api/voice/add-task - Add a task via voice command
  // Accepts natural language like "Read chapter 5 for CPPA122 due Friday"
  app.post("/api/voice/add-task", async (req, res) => {
    try {
      const { text, course, due, type, week } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ success: false, message: "Task description is required" });
      }
      
      // Parse due date from natural language
      let dueDate = new Date();
      dueDate.setHours(23, 59, 0, 0); // Default to end of day
      
      const dueLower = (due || "").toLowerCase().trim();
      const today = new Date();
      
      if (dueLower === "today") {
        dueDate = new Date(today);
        dueDate.setHours(23, 59, 0, 0);
      } else if (dueLower === "tomorrow") {
        dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(23, 59, 0, 0);
      } else if (dueLower.startsWith("next ")) {
        const dayName = dueLower.replace("next ", "");
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const targetDay = days.indexOf(dayName);
        if (targetDay >= 0) {
          dueDate = new Date(today);
          const currentDay = dueDate.getDay();
          let daysToAdd = targetDay - currentDay;
          if (daysToAdd <= 0) daysToAdd += 7;
          daysToAdd += 7; // "next" means the following week
          dueDate.setDate(dueDate.getDate() + daysToAdd);
          dueDate.setHours(23, 59, 0, 0);
        }
      } else if (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].includes(dueLower)) {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const targetDay = days.indexOf(dueLower);
        dueDate = new Date(today);
        const currentDay = dueDate.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        dueDate.setDate(dueDate.getDate() + daysToAdd);
        dueDate.setHours(23, 59, 0, 0);
      } else if (dueLower.includes("in ") && dueLower.includes(" day")) {
        const match = dueLower.match(/in (\d+) day/);
        if (match) {
          dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + parseInt(match[1]));
          dueDate.setHours(23, 59, 0, 0);
        }
      } else if (due) {
        // Try to parse as a date string
        const parsed = new Date(due);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
          dueDate.setHours(23, 59, 0, 0);
        }
      }
      
      // Match course code
      let courseName = "";
      const courseUpper = (course || "").toUpperCase().trim();
      const courses = ["CPPA122", "CFNF400", "CASL101"];
      
      // Check for exact match or partial match
      for (const c of courses) {
        if (courseUpper === c || courseUpper.includes(c) || c.includes(courseUpper)) {
          courseName = c;
          break;
        }
      }
      
      // Also check in the text itself for course codes
      if (!courseName) {
        const textUpper = text.toUpperCase();
        for (const c of courses) {
          if (textUpper.includes(c)) {
            courseName = c;
            break;
          }
        }
      }
      
      // Determine task type
      let taskType = type || "other";
      const textLower = text.toLowerCase();
      if (textLower.includes("read") || textLower.includes("chapter")) taskType = "reading";
      else if (textLower.includes("module")) taskType = "module";
      else if (textLower.includes("essay") || textLower.includes("paper") || textLower.includes("write")) taskType = "essay";
      else if (textLower.includes("quiz")) taskType = "quiz";
      else if (textLower.includes("exam") || textLower.includes("test")) taskType = "exam";
      else if (textLower.includes("discuss")) taskType = "discussion";
      else if (textLower.includes("project")) taskType = "project";
      
      // Get current week number
      const activeSemester = await storage.getActiveSemesterSettings();
      const semesterStart = activeSemester?.semesterStartDate 
        ? new Date(activeSemester.semesterStartDate) 
        : undefined;
      const weekNumber = week || getWeekNumber(dueDate, semesterStart, activeSemester?.readingWeekStart);
      
      // Create the task
      const task = await storage.createTask({
        title: text,
        description: "",
        weekNumber,
        type: taskType as any,
        dueDate,
        isCompleted: false,
        courseName: courseName || undefined,
        repeatType: "none",
      });
      
      // Auto-sync to Google Calendar
      try {
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
      } catch (calErr) {
        console.error("Calendar sync failed:", calErr);
      }
      
      // Prepare response message
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dueDateStr = `${dayNames[dueDate.getDay()]}, ${dueDate.toLocaleDateString()}`;
      const courseStr = courseName ? ` for ${courseName}` : "";
      
      res.json({
        success: true,
        message: `Task added${courseStr}: "${text}" due ${dueDateStr}`,
        task: {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
          courseName: task.courseName,
          type: task.type,
          weekNumber: task.weekNumber,
        },
      });
      
    } catch (err) {
      console.error("Voice add-task error:", err);
      res.status(500).json({ success: false, message: "Failed to add task" });
    }
  });

  // GET /api/voice/tasks-today - Get tasks due today (for voice query)
  app.get("/api/voice/tasks-today", async (_req, res) => {
    try {
      const tasks = await storage.getTasks();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayTasks = tasks.filter(t => {
        const due = new Date(t.dueDate);
        return due >= today && due < tomorrow && !t.isCompleted;
      });
      
      if (todayTasks.length === 0) {
        return res.json({ success: true, message: "You have no tasks due today.", tasks: [] });
      }
      
      const taskList = todayTasks.map(t => t.title).join(", ");
      res.json({
        success: true,
        message: `You have ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today: ${taskList}`,
        tasks: todayTasks,
      });
    } catch (err) {
      console.error("Voice tasks-today error:", err);
      res.status(500).json({ success: false, message: "Failed to get tasks" });
    }
  });

  // ============================================
  // TEXT-TO-SPEECH ROUTES (OpenAI TTS for Fire tablets)
  // ============================================

  app.post("/api/tts/clean-text", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }
      const cleaned = cleanTextForTTS(text);
      res.json({ text: cleaned });
    } catch (err) {
      console.error("Error cleaning text:", err);
      res.status(500).json({ message: "Failed to clean text" });
    }
  });

  // GET /api/tts-audio/:filename - Proxy TTS audio from object storage
  app.get("/api/tts-audio/:filename", async (req, res) => {
    try {
      const audioPath = decodeURIComponent(req.params.filename);
      const publicPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0]?.trim();
      if (!publicPath) {
        return res.status(500).json({ error: "Storage not configured" });
      }
      const { bucketName, objectName } = parsePublicObjectPath(`${publicPath}/${audioPath}`);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      const stream = file.createReadStream();
      stream.pipe(res);
    } catch (error: any) {
      console.error("Error serving TTS audio:", error.message);
      res.status(500).json({ error: "Failed to serve audio" });
    }
  });

  // POST /api/tts - Generate speech from text using OpenAI
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice = "echo" } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
      const selectedVoice = validVoices.includes(voice) ? voice : "echo";
      
      let normalizedText = cleanTextForTTS(text);
      
      normalizedText = normalizedText
        .replace(/doi:[^\s]+/gi, '')
        .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
        .replace(/\([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)*,?\s*\d{4}[a-z]?\)/g, '')
        .replace(/pp?\.\s*\d+(?:\s*[-–]\s*\d+)?/gi, '')
        .replace(/\([^)]{50,}\)/g, '')
        .replace(/[–—]/g, ', ')
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      
      const trimmedText = normalizedText.slice(0, 4096);
      const startTime = Date.now();
      console.log(`TTS request: ${trimmedText.length} chars, voice: ${selectedVoice}`);
      
      const audioBuffer = await textToSpeech(
        trimmedText,
        selectedVoice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        "mp3",
        true
      );
      
      console.log(`TTS completed in ${Date.now() - startTime}ms, ${audioBuffer.length} bytes`);
      
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      });
      res.send(audioBuffer);
    } catch (err) {
      console.error("Error generating TTS:", err);
      res.status(500).json({ message: "Failed to generate speech" });
    }
  });

  app.post("/api/tts/speaker", async (req, res) => {
    try {
      const { text, voice = "echo", entityId } = req.body;
      console.log(`[TTS Speaker] Request received - entity: ${entityId}, voice: ${voice}, text length: ${text?.length || 0}`);

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }
      if (!entityId) {
        return res.status(400).json({ error: "entityId is required" });
      }
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
      const selectedVoice = validVoices.includes(voice as any) ? voice : "echo";

      const cleanedText = cleanTextForTTS(text);
      console.log(`[TTS Speaker] Generating OpenAI audio (${cleanedText.length} chars, voice: ${selectedVoice})`);

      const isNonAlexa = NON_ALEXA_ENTITIES.includes(entityId);
      const wordCount = cleanedText.split(/\s+/).length;
      const estimatedDurationMs = Math.max(5000, (wordCount / 145) * 60 * 1000 + 2000);

      let playResp: Response;

      if (isNonAlexa) {
        const audioPath = await generateAndSaveTTSAudio(cleanedText, `speaker-tts-${Date.now()}`);
        const appUrl = DEPLOYED_APP_URL;
        const fullAudioUrl = `${appUrl}${audioPath}`;
        console.log(`[TTS Speaker] Non-Alexa: Generated audio at ${audioPath}, playing on ${entityId} via play_media`);

        playResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_id: entityId,
            media_content_id: fullAudioUrl,
            media_content_type: "music",
          }),
        });
      } else {
        const ssmlContent = `<speak><prosody rate="90%">${cleanedText}</prosody></speak>`;
        console.log(`[TTS Speaker] Alexa: Sending TTS to ${entityId} via notify/alexa_media (${cleanedText.length} chars)`);

        playResp = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: ssmlContent,
            target: entityId,
            data: { type: "tts" },
          }),
        });
      }

      if (!playResp.ok) {
        const errText = await playResp.text();
        console.error(`[TTS Speaker] ${isNonAlexa ? 'play_media' : 'alexa_media'} FAILED: ${playResp.status} ${errText}`);
        return res.status(500).json({ error: "Failed to play audio on speaker" });
      }

      console.log(`[TTS Speaker] SUCCESS - playing on ${entityId} via ${isNonAlexa ? 'play_media' : 'notify/alexa_media'} (~${Math.round(estimatedDurationMs/1000)}s estimated)`);

      res.json({ success: true, entityId, method: isNonAlexa ? "openai_audio_play_media" : "alexa_media_tts", estimatedDurationMs });
    } catch (err) {
      console.error("[TTS Speaker] Error:", err);
      res.status(500).json({ error: "Failed to play TTS on speaker" });
    }
  });

  // ============================================
  // EMAIL REMINDER ROUTES
  // ============================================

  // POST /api/email/test - Send a test email
  app.post("/api/email/test", async (_req, res) => {
    try {
      const result = await sendTestEmail();
      if (result.success) {
        res.json({ message: "Test email sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send test email" });
      }
    } catch (err) {
      console.error("Error sending test email:", err);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // POST /api/email/reminder - Send a reminder for a specific task
  app.post("/api/email/reminder", async (req, res) => {
    try {
      const { taskId } = req.body;
      if (!taskId) {
        return res.status(400).json({ message: "taskId is required" });
      }
      
      const task = await storage.getTask(Number(taskId));
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const result = await sendTaskReminder({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        courseName: task.courseName,
        type: task.type,
      });
      
      if (result.success) {
        res.json({ message: "Reminder sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send reminder" });
      }
    } catch (err) {
      console.error("Error sending reminder:", err);
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  // POST /api/email/digest - Send a digest of upcoming tasks
  app.post("/api/email/digest", async (_req, res) => {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      
      // Get all incomplete tasks due in the next 3 days
      const allTasks = await storage.getTasks({ showCompleted: false });
      const upcomingTasks = allTasks.filter(task => {
        const dueDate = new Date(task.dueDate);
        return dueDate >= now && dueDate <= threeDaysFromNow;
      });
      
      const taskReminders: TaskReminder[] = upcomingTasks.map(task => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        courseName: task.courseName,
        type: task.type,
      }));
      
      const result = await sendDailyDigest(taskReminders);
      
      if (result.success) {
        res.json({ message: `Digest sent with ${taskReminders.length} tasks` });
      } else {
        res.status(500).json({ message: result.error || "Failed to send digest" });
      }
    } catch (err) {
      console.error("Error sending digest:", err);
      res.status(500).json({ message: "Failed to send digest" });
    }
  });

  // POST /api/sms/test - Send a test SMS
  app.post("/api/sms/test", async (_req, res) => {
    try {
      const result = await sendTestSms();
      if (result.success) {
        res.json({ message: "Test SMS sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send test SMS" });
      }
    } catch (err) {
      console.error("Error sending test SMS:", err);
      res.status(500).json({ message: "Failed to send test SMS" });
    }
  });

  // POST /api/sms/reminder - Send an SMS reminder for a specific task
  app.post("/api/sms/reminder", async (req, res) => {
    try {
      const { taskId } = req.body;
      if (!taskId) {
        return res.status(400).json({ message: "taskId is required" });
      }
      
      const task = await storage.getTask(Number(taskId));
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const result = await sendSmsReminder({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        courseName: task.courseName,
        type: task.type,
      });
      
      if (result.success) {
        res.json({ message: "SMS reminder sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send SMS reminder" });
      }
    } catch (err) {
      console.error("Error sending SMS reminder:", err);
      res.status(500).json({ message: "Failed to send SMS reminder" });
    }
  });

  // === Server-side Pomodoro Timer ===
  let pomodoroState: {
    mode: "work" | "shortBreak" | "longBreak";
    duration: number;
    startedAt: number | null;
    pausedRemaining: number | null;
    running: boolean;
    count: number;
  } = {
    mode: "work",
    duration: 25 * 60,
    startedAt: null,
    pausedRemaining: null,
    running: false,
    count: 0,
  };
  let pomodoroTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearPomodoroTimeout() {
    if (pomodoroTimeout) {
      clearTimeout(pomodoroTimeout);
      pomodoroTimeout = null;
    }
  }

  function schedulePomodoroEnd(remainingSeconds: number) {
    clearPomodoroTimeout();
    pomodoroTimeout = setTimeout(async () => {
      pomodoroState.running = false;
      pomodoroState.startedAt = null;
      pomodoroState.pausedRemaining = null;

      if (pomodoroState.mode === "work") {
        pomodoroState.count += 1;
        const breakMsg = pomodoroState.count % 4 === 0 ? "Time for a long break!" : "Time for a short break!";
        try {
          await sendEchoVoiceAnnouncement("Pomodoro complete! " + breakMsg);
        } catch (e) { console.error("Pomodoro announcement error:", e); }
        if (pomodoroState.count % 4 === 0) {
          pomodoroState.mode = "longBreak";
          pomodoroState.duration = 15 * 60;
        } else {
          pomodoroState.mode = "shortBreak";
          pomodoroState.duration = 5 * 60;
        }
      } else {
        try {
          await sendEchoVoiceAnnouncement("Break is over! Time to focus!");
        } catch (e) { console.error("Pomodoro announcement error:", e); }
        pomodoroState.mode = "work";
        pomodoroState.duration = 25 * 60;
      }
      pomodoroState.pausedRemaining = pomodoroState.duration;
      console.log("Pomodoro timer expired, mode now:", pomodoroState.mode);
    }, remainingSeconds * 1000);
  }

  app.get("/api/ha-url", (_req, res) => {
    const url = process.env.HOME_ASSISTANT_URL;
    if (url) {
      res.json({ url });
    } else {
      res.status(404).json({ error: "Home Assistant URL not configured" });
    }
  });

  // GET /api/pomodoro/status
  app.get("/api/pomodoro/status", (_req, res) => {
    let remaining = pomodoroState.pausedRemaining ?? pomodoroState.duration;
    if (pomodoroState.running && pomodoroState.startedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroState.startedAt) / 1000);
      remaining = Math.max(0, pomodoroState.duration - elapsed);
    }
    res.json({
      mode: pomodoroState.mode,
      running: pomodoroState.running,
      remaining,
      count: pomodoroState.count,
    });
  });

  // POST /api/pomodoro/start
  app.post("/api/pomodoro/start", (req, res) => {
    const { mode, duration, count } = req.body;
    if (mode) pomodoroState.mode = mode;
    if (typeof count === "number") pomodoroState.count = count;
    const remaining = pomodoroState.pausedRemaining ?? duration ?? pomodoroState.duration;
    pomodoroState.duration = remaining;
    pomodoroState.startedAt = Date.now();
    pomodoroState.pausedRemaining = null;
    pomodoroState.running = true;
    schedulePomodoroEnd(remaining);
    res.json({ message: "Pomodoro started", remaining });
  });

  // POST /api/pomodoro/pause
  app.post("/api/pomodoro/pause", (_req, res) => {
    if (pomodoroState.running && pomodoroState.startedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroState.startedAt) / 1000);
      pomodoroState.pausedRemaining = Math.max(0, pomodoroState.duration - elapsed);
    }
    pomodoroState.running = false;
    pomodoroState.startedAt = null;
    clearPomodoroTimeout();
    res.json({ message: "Pomodoro paused", remaining: pomodoroState.pausedRemaining });
  });

  // POST /api/pomodoro/reset
  app.post("/api/pomodoro/reset", (req, res) => {
    clearPomodoroTimeout();
    const { mode } = req.body || {};
    pomodoroState.mode = mode || pomodoroState.mode;
    if (pomodoroState.mode === "work") pomodoroState.duration = 25 * 60;
    else if (pomodoroState.mode === "shortBreak") pomodoroState.duration = 5 * 60;
    else pomodoroState.duration = 15 * 60;
    pomodoroState.startedAt = null;
    pomodoroState.pausedRemaining = pomodoroState.duration;
    pomodoroState.running = false;
    res.json({ message: "Pomodoro reset", remaining: pomodoroState.duration });
  });

  // POST /api/pomodoro/skip
  app.post("/api/pomodoro/skip", (_req, res) => {
    clearPomodoroTimeout();
    pomodoroState.running = false;
    pomodoroState.startedAt = null;
    if (pomodoroState.mode === "work") {
      pomodoroState.count += 1;
      if (pomodoroState.count % 4 === 0) {
        pomodoroState.mode = "longBreak";
        pomodoroState.duration = 15 * 60;
      } else {
        pomodoroState.mode = "shortBreak";
        pomodoroState.duration = 5 * 60;
      }
    } else {
      pomodoroState.mode = "work";
      pomodoroState.duration = 25 * 60;
    }
    pomodoroState.pausedRemaining = pomodoroState.duration;
    res.json({ message: "Pomodoro skipped", mode: pomodoroState.mode, remaining: pomodoroState.duration, count: pomodoroState.count });
  });

  const translationCache = new Map<string, string>();
  app.post("/api/translate-ja", async (req, res) => {
    try {
      const { texts } = req.body as { texts: string[] };
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({ error: "texts array required" });
      }
      const results: Record<string, string> = {};
      const toTranslate: string[] = [];
      for (const t of texts) {
        if (translationCache.has(t)) {
          results[t] = translationCache.get(t)!;
        } else if (/^[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF\s\d\-.,!?()]+$/.test(t)) {
          results[t] = t;
          translationCache.set(t, t);
        } else {
          toTranslate.push(t);
        }
      }
      if (toTranslate.length > 0) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const batch = toTranslate.slice(0, 20);
        const prompt = batch.map((t, i) => `${i + 1}. ${t}`).join("\n");
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Translate each line to Japanese. For song/album/artist names, use the commonly known Japanese title if one exists (e.g. official Japanese release name), otherwise transliterate to katakana. Keep numbers and punctuation. Return ONLY the translations, one per line, numbered to match input. Format: '1. translation'" },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        });
        const responseText = completion.choices[0]?.message?.content || "";
        const lines = responseText.split("\n").filter(l => l.trim());
        for (let i = 0; i < batch.length; i++) {
          const line = lines[i] || "";
          const translated = line.replace(/^\d+\.\s*/, "").trim() || batch[i];
          results[batch[i]] = translated;
          translationCache.set(batch[i], translated);
        }
      }
      res.json({ translations: results });
    } catch (err: any) {
      console.error("[Translate] Error:", err.message);
      res.status(500).json({ error: "Translation failed" });
    }
  });

  // POST /api/ha-announce - Send a voice announcement to Echo speakers
  app.post("/api/ha-announce", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      const result = await sendEchoVoiceAnnouncement(message);
      if (result.success) {
        res.json({ message: "Announcement sent" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send announcement" });
      }
    } catch (err) {
      console.error("Error sending announcement:", err);
      res.status(500).json({ message: "Failed to send announcement" });
    }
  });

  // POST /api/ha-push/test - Send a test push notification via Home Assistant
  app.post("/api/ha-push/test", async (_req, res) => {
    try {
      const result = await sendTestHaPush();
      if (result.success) {
        res.json({ message: "Test push notification sent successfully via Home Assistant" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send test push notification" });
      }
    } catch (err) {
      console.error("Error sending test HA push:", err);
      res.status(500).json({ message: "Failed to send test push notification" });
    }
  });

  app.get("/api/travelling", (_req, res) => {
    res.json({ isTravelling: getIsTravellingMode(), travelStartDate, travelEndDate });
  });

  app.post("/api/travelling", (req, res) => {
    const { isTravelling, startDate, endDate } = req.body;
    isTravellingMode = !!isTravelling;
    travelStartDate = startDate || null;
    travelEndDate = endDate || null;
    const effectivelyTravelling = getIsTravellingMode();
    console.log(`[Travelling] Mode set to: ${isTravellingMode}, dates: ${travelStartDate} - ${travelEndDate}, effective: ${effectivelyTravelling}`);
    res.json({ isTravelling: effectivelyTravelling });
  });

  app.post("/api/echo/test", async (_req, res) => {
    try {
      const result = await sendEchoVoiceAnnouncement("Hey Bryn! This is a test announcement from Uni-Cal.");
      if (result.success) {
        res.json({ message: "Test voice announcement sent to Echo devices" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send Echo announcement" });
      }
    } catch (err) {
      console.error("Error sending test Echo announcement:", err);
      res.status(500).json({ message: "Failed to send Echo announcement" });
    }
  });

  app.get("/api/reminders/status", (_req, res) => {
    res.json(getSchedulerStatus());
  });

  // POST /api/ha-push/reminder - Send a push notification reminder for a specific task via Home Assistant
  app.post("/api/ha-push/reminder", async (req, res) => {
    try {
      const { taskId } = req.body;
      if (!taskId) {
        return res.status(400).json({ message: "taskId is required" });
      }
      
      const task = await storage.getTask(Number(taskId));
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const result = await sendHaTaskReminder({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        courseName: task.courseName,
        type: task.type,
      });
      
      if (result.success) {
        res.json({ message: "Push notification reminder sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send push notification reminder" });
      }
    } catch (err) {
      console.error("Error sending HA push reminder:", err);
      res.status(500).json({ message: "Failed to send push notification reminder" });
    }
  });

  // ============================================
  // PROJECT ROUTES
  // ============================================

  // GET /api/projects - Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (err) {
      console.error("Error fetching projects:", err);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // GET /api/projects/:id - Get a single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (err) {
      console.error("Error fetching project:", err);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // GET /api/projects/:id/tasks - Get all tasks for a project
  app.get("/api/projects/:id/tasks", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const tasks = await storage.getTasksByProject(projectId);
      res.json(tasks);
    } catch (err) {
      console.error("Error fetching project tasks:", err);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  // POST /api/projects - Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const { name, description, color, status, courseName, startDate, targetDate, priority, notes } = req.body;
      const project = await storage.createProject({
        name,
        description,
        color,
        status,
        courseName,
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        priority,
        notes,
      });
      res.status(201).json(project);
    } catch (err) {
      console.error("Error creating project:", err);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // PATCH /api/projects/:id - Update a project
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const updates = req.body;
      if (updates.startDate) updates.startDate = new Date(updates.startDate);
      if (updates.targetDate) updates.targetDate = new Date(updates.targetDate);
      const project = await storage.updateProject(projectId, updates);
      res.json(project);
    } catch (err) {
      console.error("Error updating project:", err);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // DELETE /api/projects/:id - Delete a project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      await storage.deleteProject(projectId);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting project:", err);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // POST /api/projects/:id/tasks/:taskId - Add a task to a project
  app.post("/api/projects/:id/tasks/:taskId", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const taskId = Number(req.params.taskId);
      const task = await storage.updateTask(taskId, { projectId });
      res.json(task);
    } catch (err) {
      console.error("Error adding task to project:", err);
      res.status(500).json({ message: "Failed to add task to project" });
    }
  });

  // DELETE /api/projects/:id/tasks/:taskId - Remove a task from a project
  app.delete("/api/projects/:id/tasks/:taskId", async (req, res) => {
    try {
      const taskId = Number(req.params.taskId);
      const task = await storage.updateTask(taskId, { projectId: null });
      res.json(task);
    } catch (err) {
      console.error("Error removing task from project:", err);
      res.status(500).json({ message: "Failed to remove task from project" });
    }
  });

  // ========== Sticky Notes Routes ==========
  
  // GET /api/sticky-notes - Get all sticky notes
  app.get("/api/sticky-notes", async (req, res) => {
    try {
      const notes = await storage.getStickyNotes();
      res.json(notes);
    } catch (err) {
      console.error("Error fetching sticky notes:", err);
      res.status(500).json({ message: "Failed to fetch sticky notes" });
    }
  });

  // POST /api/sticky-notes - Create a new sticky note
  app.post("/api/sticky-notes", async (req, res) => {
    try {
      const note = await storage.createStickyNote(req.body);
      res.json(note);
    } catch (err) {
      console.error("Error creating sticky note:", err);
      res.status(500).json({ message: "Failed to create sticky note" });
    }
  });

  // PATCH /api/sticky-notes/:id - Update a sticky note
  app.patch("/api/sticky-notes/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updates = { ...req.body };
      // Convert lastMovedAt from string to Date if provided
      if (updates.lastMovedAt && typeof updates.lastMovedAt === 'string') {
        updates.lastMovedAt = new Date(updates.lastMovedAt);
      }
      // Convert reminderTime from string to Date if provided
      if (updates.reminderTime && typeof updates.reminderTime === 'string') {
        updates.reminderTime = new Date(updates.reminderTime);
      }
      const note = await storage.updateStickyNote(id, updates);
      res.json(note);
    } catch (err) {
      console.error("Error updating sticky note:", err);
      res.status(500).json({ message: "Failed to update sticky note" });
    }
  });

  // DELETE /api/sticky-notes/:id - Delete a sticky note
  app.delete("/api/sticky-notes/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteStickyNote(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting sticky note:", err);
      res.status(500).json({ message: "Failed to delete sticky note" });
    }
  });

  // Access Token routes for time-limited sharing
  app.get("/api/access-tokens", async (req, res) => {
    try {
      const tokens = await storage.getAccessTokens();
      res.json(tokens);
    } catch (err) {
      console.error("Error getting access tokens:", err);
      res.status(500).json({ message: "Failed to get access tokens" });
    }
  });

  app.post("/api/access-tokens", async (req, res) => {
    try {
      const { name } = req.body;
      const token = crypto.randomUUID();
      const created = await storage.createAccessToken({ token, name: name || null, firstUsedAt: null, expiresAt: null, isRevoked: false });
      res.json(created);
    } catch (err) {
      console.error("Error creating access token:", err);
      res.status(500).json({ message: "Failed to create access token" });
    }
  });

  app.post("/api/access-tokens/validate", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ valid: false, message: "Token required" });
      }
      
      const accessToken = await storage.getAccessToken(token);
      if (!accessToken) {
        return res.json({ valid: false, message: "Invalid token" });
      }
      
      if (accessToken.isRevoked) {
        return res.json({ valid: false, message: "Token has been revoked" });
      }
      
      const now = new Date();
      
      // Check if token has expired
      if (accessToken.expiresAt && new Date(accessToken.expiresAt) < now) {
        return res.json({ valid: false, message: "Token has expired" });
      }
      
      // If first use, set expiration to 1 hour from now
      if (!accessToken.firstUsedAt) {
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        await storage.updateAccessToken(accessToken.id, { firstUsedAt: now, expiresAt });
        return res.json({ valid: true, message: "Access granted", expiresAt });
      }
      
      return res.json({ valid: true, message: "Access granted", expiresAt: accessToken.expiresAt });
    } catch (err) {
      console.error("Error validating access token:", err);
      res.status(500).json({ valid: false, message: "Failed to validate token" });
    }
  });

  app.delete("/api/access-tokens/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteAccessToken(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting access token:", err);
      res.status(500).json({ message: "Failed to delete access token" });
    }
  });

  app.patch("/api/access-tokens/:id/revoke", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = await storage.updateAccessToken(id, { isRevoked: true });
      res.json(updated);
    } catch (err) {
      console.error("Error revoking access token:", err);
      res.status(500).json({ message: "Failed to revoke access token" });
    }
  });

  app.post("/api/background-photo/upload", async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating background photo upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Profile photo upload
  app.post("/api/profile-photo/upload", async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating profile photo upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  app.post("/api/uploads/direct", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });
      const fileBuffer = Buffer.concat(chunks);
      const fileName = (req.headers['x-file-name'] as string) || 'upload.pdf';
      const contentType = (req.headers['content-type'] as string) || 'application/octet-stream';

      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorageService = new ObjectStorageService();
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

      const { randomUUID } = await import("crypto");
      const objectId = randomUUID();
      const fullPath = `${privateDir}/uploads/${objectId}`;

      const pathParts = fullPath.replace(/^\//, '').split('/');
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await new Promise<void>((resolve, reject) => {
        const stream = file.createWriteStream({ contentType, resumable: false });
        stream.on('finish', resolve);
        stream.on('error', reject);
        stream.end(fileBuffer);
      });

      const objectPath = `/objects/uploads/${objectId}`;
      const createdFile = await storage.createFile({
        originalName: fileName,
        displayName: fileName,
        objectPath,
        contentType,
        size: fileBuffer.length,
      });

      console.log(`[Upload] Direct upload success: ${fileName} -> ${objectPath} (${fileBuffer.length} bytes)`);
      res.json({ objectPath, fileId: createdFile?.id, metadata: { name: fileName, size: fileBuffer.length, contentType } });
    } catch (error: any) {
      console.error("[Upload] Direct upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  // ============================================
  // SHOWER AUTOMATION - Auto-play PDFs on motion
  // ============================================
  
  // POST /api/debug/setup-semester - Set up semester settings on production
  app.post("/api/debug/setup-semester", async (req, res) => {
    try {
      // Check if settings already exist
      const existing = await storage.getActiveSemesterSettings();
      if (existing) {
        return res.json({ message: "Semester settings already exist", settings: existing });
      }
      
      // Create Winter 2026 settings (Jan 12, 2026 start)
      const newSettings = await storage.createSemesterSettings({
        semesterName: "Winter 2026",
        semesterStartDate: new Date("2026-01-12T00:00:00"),
        course1Code: "CPPA122",
        course1Name: "Local Politics and Government",
        course2Code: "CFNF400", 
        course2Name: "Human Sexuality",
        course3Code: "CASL101",
        course3Name: "American Sign Language",
        isActive: true
      });
      
      return res.json({ message: "Semester settings created", settings: newSettings });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/debug/week - Debug endpoint to check current week calculation
  app.get("/api/debug/week", async (req, res) => {
    try {
      const semesterSettings = await storage.getActiveSemesterSettings();
      const today = torontoDate();
      
      if (!semesterSettings?.semesterStartDate) {
        return res.json({
          error: "No semester settings found",
          semesterSettings: null,
          serverTime: today.toISOString()
        });
      }
      
      const startDate = new Date(semesterSettings.semesterStartDate);
      const diffTime = today.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const currentWeekNumber = getWeekNumber(today, startDate, semesterSettings.readingWeekStart);
      
      return res.json({
        semesterStartDate: semesterSettings.semesterStartDate,
        startDateParsed: startDate.toISOString(),
        serverTime: today.toISOString(),
        diffDays,
        currentWeekNumber,
        semesterName: semesterSettings.semesterName
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });
  
  // In-memory storage for playback progress (persists until server restart)
  const playbackProgress: Record<string, { chunkIndex: number; totalChunks: number; lastPlayed: Date; lastCompletedChunk?: number; fileId?: number }> = {};
  
  // Track active kitchen playback session (for stopping)
  let kitchenPlaybackActive = false;
  let kitchenPlaybackAbortController: AbortController | null = null;

  const pendingTabletCommands: Record<string, { action: string; url?: string; goodbyeText?: string; timestamp: number }> = {};

  let tabletTableReady = false;
  async function ensureTabletTable() {
    if (!tabletTableReady) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS tablet_commands (device TEXT PRIMARY KEY, cmd JSONB NOT NULL)`);
      tabletTableReady = true;
    }
  }

  async function dbSetTabletCommand(device: string, cmd: { action: string; url?: string; goodbyeText?: string; timestamp: number }) {
    try {
      await ensureTabletTable();
      const cmdJson = JSON.stringify(cmd);
      await db.execute(sql`INSERT INTO tablet_commands (device, cmd) VALUES (${device}, ${cmdJson}::jsonb) ON CONFLICT (device) DO UPDATE SET cmd = ${cmdJson}::jsonb`);
      const verify = await db.execute(sql`SELECT cmd FROM tablet_commands WHERE device = ${device}`);
      console.log(`[Tablet Nav DB] SET ${device}: wrote ${cmdJson.substring(0, 80)}, verify rows=${verify.rows?.length}`);
    } catch (e: any) {
      console.log(`[Tablet Nav DB] Error saving ${device}: ${e.message}`);
    }
  }

  async function dbGetTabletCommand(device: string): Promise<{ action: string; url?: string; goodbyeText?: string; timestamp: number } | null> {
    try {
      await ensureTabletTable();
      const result = await db.execute(sql`SELECT cmd FROM tablet_commands WHERE device = ${device}`);
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as any;
        const cmd = typeof row.cmd === 'string' ? JSON.parse(row.cmd) : row.cmd;
        console.log(`[Tablet Nav DB] GET ${device}: found rows=${result.rows.length} action=${cmd?.action} ts=${cmd?.timestamp}`);
        return cmd;
      }
      console.log(`[Tablet Nav DB] GET ${device}: no rows found`);
    } catch (e: any) {
      console.log(`[Tablet Nav DB] Error loading ${device}: ${e.message}`);
    }
    return null;
  }

  async function dbClearTabletCommand(device: string) {
    try {
      await db.execute(sql`DELETE FROM tablet_commands WHERE device = ${device}`);
    } catch {}
  }


  async function setTabletCommand(cmd: { action: string; url?: string; goodbyeText?: string; timestamp: number }, propagate = true, device = 'master') {
    pendingTabletCommands[device] = cmd;
    await dbSetTabletCommand(device, cmd);
    if (propagate) {
      try {
        await fetch(`${DEPLOYED_APP_URL}/api/tablet-nav/set?auth=${encodeURIComponent(process.env.SITE_PASSWORD || '')}&device=${device}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd),
        });
      } catch (e: any) {
        console.log(`[Tablet Nav] Failed to propagate ${device} to deployed: ${e.message}`);
      }
    }
  }

  app.get("/api/ha-entity-state", async (req, res) => {
    const entity = req.query.entity as string;
    if (!entity) return res.status(400).json({ error: "entity required" });
    try {
      const resp = await fetch(`http://172.24.0.2:8123/api/states/${encodeURIComponent(entity)}`, {
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: "HA error" });
      const data = await resp.json() as any;
      res.json({ entity_id: data.entity_id, state: data.state });
    } catch {
      res.status(500).json({ error: "Failed to reach HA" });
    }
  });

  app.get("/api/tablet-nav", async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const rawDevice = (req.query.device as string) || 'master';
    const device = rawDevice === 'follower' ? 'master' : rawDevice;
    let cmd = pendingTabletCommands[device];
    let source = 'memory';
    if (!cmd) {
      cmd = (await dbGetTabletCommand(device)) || undefined;
      source = 'db';
      if (cmd) pendingTabletCommands[device] = cmd;
    }
    if (cmd && cmd.action) {
      const age = Date.now() - cmd.timestamp;
      if (age < 120000) {
        console.log(`[Tablet Nav GET] ${device} FOUND from ${source}: action=${cmd.action} age=${age}ms`);
        return res.json(cmd);
      } else {
        console.log(`[Tablet Nav GET] ${device} EXPIRED from ${source}: action=${cmd.action} age=${age}ms`);
        delete pendingTabletCommands[device];
        await dbClearTabletCommand(device);
      }
    }
    res.json({ action: null });
  });

  app.get("/api/tablet-nav/debug", (_req, res) => {
    const devices = Object.keys(pendingTabletCommands);
    const cmds: Record<string, any> = {};
    for (const d of devices) {
      const c = pendingTabletCommands[d];
      cmds[d] = c ? { action: c.action, age: Date.now() - c.timestamp, url: c.url?.substring(0, 60) } : null;
    }
    res.json({ pendingCommands: cmds, deviceCount: devices.length });
  });

  app.get("/api/cat-wash/find-next", async (req, res) => {
    const authParam = (req.query.auth as string) || '';
    if (authParam !== (process.env.SITE_PASSWORD || '')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
      const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
      currentWeekNumber = getWeekNumber(torontoDate(), semStart, rwStart);
      const nextFile = await findNextCatWashFile(storage, currentWeekNumber);
      if (!nextFile) {
        return res.json({ found: false, weekNumber: currentWeekNumber });
      }
      res.json({ found: true, fileId: nextFile.id, fileName: nextFile.displayName || nextFile.originalName, folder: nextFile.folder, weekNumber: currentWeekNumber });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tablet-nav/ack", async (req, res) => {
    const { timestamp, device } = req.body;
    const deviceKey = device || 'master';
    const cmd = pendingTabletCommands[deviceKey];
    if (cmd && cmd.timestamp === timestamp) {
      delete pendingTabletCommands[deviceKey];
      await dbClearTabletCommand(deviceKey);
      console.log(`[Tablet Nav] Command acknowledged and cleared for ${deviceKey}`);
    }
    res.json({ ok: true });
  });

  app.post("/api/tablet-nav/set", async (req, res) => {
    const authParam = (req.query.auth as string) || '';
    if (authParam !== (process.env.SITE_PASSWORD || '')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const deviceParam = (req.query.device as string) || 'master';
    const { action, url, goodbyeText, timestamp } = req.body;
    if (action) {
      const ts = timestamp || Date.now();
      const cmd = { action, url, goodbyeText, timestamp: ts };
      pendingTabletCommands[deviceParam] = cmd;
      await dbSetTabletCommand(deviceParam, cmd);
      console.log(`[Tablet Nav] Command SET for ${deviceParam}: ${action} url=${url || 'none'} ts=${ts} pending=${JSON.stringify(Object.keys(pendingTabletCommands))}`);
    }
    res.json({ ok: true });
  });

  app.post("/api/fix-tablets", async (req, res) => {
    const authParam = (req.query.auth as string) || '';
    if (authParam !== (process.env.SITE_PASSWORD || '')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
    const dashboardUrl = `${DEPLOYED_APP_URL}/tablet`;
    const results: string[] = [];

    const tabletAdbEntities = [
      { entity: "media_player.tablet_hallway_entrance", name: "Hallway Entrance" },
      { entity: "media_player.tablet_hallway", name: "Hallway Main" },
      { entity: "media_player.tablet_11", name: "Living Room" },
      { entity: "media_player.bd24bb29_04a116d8_king", name: "King Bedroom" },
      { entity: "media_player.tablet_queen", name: "Queen Bedroom" },
      { entity: "media_player.tablet_kitchen_island", name: "Kitchen Island" },
      { entity: "media_player.tablet_cat", name: "Cat Washroom" },
    ];

    for (const tablet of tabletAdbEntities) {
      try {
        await fetch(`${haUrl}/api/services/androidtv/adb_command`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: tablet.entity, command: 'input keyevent KEYCODE_WAKEUP' }),
        });
        await new Promise(r => setTimeout(r, 500));

        await fetch(`${haUrl}/api/services/androidtv/adb_command`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: tablet.entity, command: `am start --activity-clear-task -a android.intent.action.VIEW -d "${dashboardUrl}" com.amazon.cloud9` }),
        });
        await new Promise(r => setTimeout(r, 500));

        await fetch(`${haUrl}/api/services/androidtv/adb_command`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: tablet.entity, command: 'settings put global policy_control immersive.full=com.amazon.cloud9' }),
        });
        await fetch(`${haUrl}/api/services/androidtv/adb_command`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: tablet.entity, command: 'input keyevent KEYCODE_F11' }),
        });
        results.push(`${tablet.name}: OK`);
        console.log(`[Fix Tablets] ${tablet.name} (${tablet.entity}): navigated to dashboard + fullscreen`);
      } catch (e: any) {
        results.push(`${tablet.name}: ERROR ${e.message}`);
        console.error(`[Fix Tablets] ${tablet.name} error: ${e.message}`);
      }
    }

    pendingTabletCommands['master'] = { action: 'go_home', timestamp: Date.now() };
    pendingTabletCommands['tv'] = { action: 'go_home', timestamp: Date.now() };
    await dbSetTabletCommand('master', { action: 'go_home', timestamp: Date.now() });
    await dbSetTabletCommand('tv', { action: 'go_home', timestamp: Date.now() });

    res.json({ ok: true, results });
  });

  let currentTvFollowUrl: string | null = null;
  let currentTabletReaderUrl: string | null = null;

  app.get("/api/cat-wash/tablet-redirect", (_req, res) => {
    if (currentTabletReaderUrl) {
      console.log(`[Cat Wash Tablet] Redirecting to: ${currentTabletReaderUrl}`);
      return res.redirect(currentTabletReaderUrl);
    }
    res.status(404).send('<html><body style="background:#0a0a1a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>No active playback</h2></body></html>');
  });

  app.get("/api/cat-wash/tv-follow", (_req, res) => {
    const tvUrl = (_req.query.url ? decodeURIComponent(String(_req.query.url)) : '') || currentTvFollowUrl || '';
    const baseUrl = DEPLOYED_APP_URL;
    console.log(`[Cat Wash TV] Serving fullscreen wrapper, target: ${tvUrl || 'none'}`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<title>Uni-Cal TV</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#0a0a1a}
iframe{width:100%;height:100%;border:none;position:fixed;top:0;left:0;right:0;bottom:0}
#waiting{display:flex;align-items:center;justify-content:center;height:100vh;color:white;font-family:sans-serif;font-size:24px;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1}
</style>
</head>
<body>
${tvUrl ? `<iframe id="frame" src="${tvUrl}" allow="fullscreen;autoplay"></iframe>` : '<div id="waiting">No active playback</div>'}
<script>
(function(){
  function goFullscreen() {
    var el = document.documentElement;
    try {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    } catch(e){}
  }
  document.addEventListener('click', goFullscreen);
  document.addEventListener('touchstart', goFullscreen);
  setTimeout(goFullscreen, 500);
  setTimeout(goFullscreen, 2000);

  var lastTs = 0;
  function poll() {
    var url = '${baseUrl}/api/tablet-nav?device=tv&auth=5747&_t=' + Date.now();
    fetch(url, {cache:'no-store'}).then(function(r){return r.json()}).then(function(data){
      if (!data || !data.action) return;
      if (data.timestamp && data.timestamp <= lastTs) return;
      if (data.timestamp && (Date.now() - data.timestamp > 120000)) return;
      var frame = document.getElementById('frame');
      var waiting = document.getElementById('waiting');
      if (data.action === 'navigate' && data.url) {
        lastTs = data.timestamp || Date.now();
        fetch('${baseUrl}/api/tablet-nav/ack', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp:data.timestamp,device:'tv'})}).catch(function(){});
        if (data.url.indexOf('tv-follow') !== -1) return;
        var targetUrl = data.url;
        if (targetUrl.indexOf('/tablet?') !== -1) {
          try { targetUrl = new URL(targetUrl).searchParams.get('target') || targetUrl; } catch(e){}
        }
        if (!frame) {
          if (waiting) waiting.remove();
          frame = document.createElement('iframe');
          frame.id = 'frame';
          frame.allow = 'fullscreen;autoplay';
          frame.style.cssText = 'width:100vw;height:100vh;border:none;position:fixed;top:0;left:0';
          document.body.appendChild(frame);
        }
        frame.src = targetUrl;
      } else if (data.action === 'stop_playback') {
        lastTs = data.timestamp || Date.now();
        fetch('${baseUrl}/api/tablet-nav/ack', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp:data.timestamp,device:'tv'})}).catch(function(){});
      }
    }).catch(function(){});
  }
  setInterval(poll, 3000);
  poll();
})();
</script>
</body>
</html>`);
  });

  app.get("/api/cat-wash/test-tv-browser", async (_req, res) => {
    const entityId = 'media_player.fire_stick_cat_wr';
    const testUrl = `${DEPLOYED_APP_URL}/api/cat-wash/tv-follow`;
    const method = String(_req.query.method || 'all');
    const results: { method: string; success: boolean; error?: string }[] = [];

    currentTvFollowUrl = `${DEPLOYED_APP_URL}/pdf-reader?catWashFollow=true`;

    console.log(`[TV Test] ====== TEST START (method=${method}) ======`);
    console.log(`[TV Test] Entity: ${entityId}`);
    console.log(`[TV Test] URL: ${testUrl}`);

    try {
      const stateResp = await fetch(`${HOME_ASSISTANT_URL.replace(/\/$/, '')}/api/states/${entityId}`, {
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' }
      });
      if (stateResp.ok) {
        const stateData = await stateResp.json();
        console.log(`[TV Test] Fire Stick state: "${stateData.state}", attrs: ${JSON.stringify(stateData.attributes?.source || 'unknown')}`);
      }
    } catch (e: any) {
      console.log(`[TV Test] State check failed: ${e.message}`);
    }

    if (method === 'all' || method === 'wake') {
      try {
        await haServiceCall('media_player/turn_on', { entity_id: CAT_TV_ENTITY }, 'TV Test Samsung TurnOn');
        console.log(`[TV Test] Samsung TV turn_on: OK`);
        results.push({ method: 'samsung_turn_on', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Samsung TV turn_on failed: ${e.message}`);
        results.push({ method: 'samsung_turn_on', success: false, error: e.message });
      }

      try {
        await haServiceCall('media_player/turn_on', { entity_id: entityId }, 'TV Test FireStick TurnOn');
        console.log(`[TV Test] Fire Stick turn_on: OK`);
        results.push({ method: 'firestick_turn_on', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Fire Stick turn_on failed: ${e.message}`);
        results.push({ method: 'firestick_turn_on', success: false, error: e.message });
      }

      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'input keyevent KEYCODE_WAKEUP' }, 'TV Test Wake');
        console.log(`[TV Test] WAKEUP: OK`);
        results.push({ method: 'wakeup', success: true });
      } catch (e: any) {
        console.log(`[TV Test] WAKEUP failed: ${e.message}`);
        results.push({ method: 'wakeup', success: false, error: e.message });
      }

      console.log(`[TV Test] Waiting 12s for TV to boot...`);
      await new Promise(r => setTimeout(r, 12000));
    }

    if (method === 'all' || method === 'silk') {
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'am force-stop com.amazon.cloud9' }, 'TV Test Kill Silk');
        console.log(`[TV Test] force-stop Silk: OK`);
      } catch (e: any) {
        console.log(`[TV Test] force-stop Silk failed: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 1500));

      const adbCmd = `am start --activity-clear-task -a android.intent.action.VIEW -d "${testUrl}" com.amazon.cloud9`;
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: adbCmd }, 'TV Test Silk');
        console.log(`[TV Test] Silk am start: OK`);
        results.push({ method: 'silk_am_start', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Silk am start failed: ${e.message}`);
        results.push({ method: 'silk_am_start', success: false, error: e.message });
      }
    }

    if (method === 'silk-no-flags') {
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'am force-stop com.amazon.cloud9' }, 'TV Test Kill Silk2');
      } catch (e: any) {}
      await new Promise(r => setTimeout(r, 1500));

      const adbCmd = `am start -a android.intent.action.VIEW -d "${testUrl}" com.amazon.cloud9`;
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: adbCmd }, 'TV Test Silk NoFlags');
        console.log(`[TV Test] Silk (no flags): OK`);
        results.push({ method: 'silk_no_flags', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Silk (no flags) failed: ${e.message}`);
        results.push({ method: 'silk_no_flags', success: false, error: e.message });
      }
    }

    if (method === 'generic') {
      const adbCmd = `am start -a android.intent.action.VIEW -d "${testUrl}"`;
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: adbCmd }, 'TV Test Generic');
        console.log(`[TV Test] Generic intent: OK`);
        results.push({ method: 'generic_intent', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Generic intent failed: ${e.message}`);
        results.push({ method: 'generic_intent', success: false, error: e.message });
      }
    }

    if (method === 'play_media') {
      try {
        await haServiceCall('media_player/play_media', { entity_id: entityId, media_content_id: testUrl, media_content_type: 'url' }, 'TV Test PlayMedia');
        console.log(`[TV Test] play_media: OK`);
        results.push({ method: 'play_media', success: true });
      } catch (e: any) {
        console.log(`[TV Test] play_media failed: ${e.message}`);
        results.push({ method: 'play_media', success: false, error: e.message });
      }
    }

    if (method === 'silk-activity') {
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'am force-stop com.amazon.cloud9' }, 'TV Test Kill Silk3');
      } catch (e: any) {}
      await new Promise(r => setTimeout(r, 1500));

      const adbCmd = `am start -n com.amazon.cloud9/.BrowserActivity -a android.intent.action.VIEW -d "${testUrl}"`;
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: adbCmd }, 'TV Test SilkActivity');
        console.log(`[TV Test] Silk BrowserActivity: OK`);
        results.push({ method: 'silk_browser_activity', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Silk BrowserActivity failed: ${e.message}`);
        results.push({ method: 'silk_browser_activity', success: false, error: e.message });
      }
    }

    if (method === 'list-browsers') {
      const cmds = [
        'pm list packages | grep -i brows',
        'pm list packages | grep -i silk',
        'pm list packages | grep -i cloud9',
        'pm list packages | grep -i chrome',
        'pm list packages | grep -i firefox',
        'pm list packages | grep -i web',
      ];
      for (const cmd of cmds) {
        try {
          await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: cmd }, `TV Test List ${cmd.split('grep')[1]?.trim()}`);
          console.log(`[TV Test] ${cmd}: OK (check HA logs for output)`);
          results.push({ method: cmd, success: true });
        } catch (e: any) {
          console.log(`[TV Test] ${cmd}: ${e.message}`);
          results.push({ method: cmd, success: false, error: e.message });
        }
      }
    }

    if (method === 'adb-test') {
      const testCmds = [
        { cmd: 'input keyevent KEYCODE_HOME', label: 'HOME button' },
        { cmd: 'input keyevent 26', label: 'POWER button' },
        { cmd: 'dumpsys package com.amazon.cloud9 | head -1', label: 'Check Silk installed' },
        { cmd: 'getprop ro.product.model', label: 'Get device model' },
      ];
      for (const { cmd, label } of testCmds) {
        try {
          await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: cmd }, `TV Test ${label}`);
          console.log(`[TV Test] ${label}: OK`);
          results.push({ method: label, success: true });
        } catch (e: any) {
          console.log(`[TV Test] ${label}: FAILED — ${e.message}`);
          results.push({ method: label, success: false, error: e.message });
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (method === 'remote') {
      const remoteEntities = [
        'remote.fire_stick_cat_wr',
        'remote.cat_wr_fire_stick',
        'remote.fire_tv_cat_wr',
      ];
      for (const remoteEntity of remoteEntities) {
        try {
          const stateResp2 = await fetch(`${HOME_ASSISTANT_URL.replace(/\/$/, '')}/api/states/${remoteEntity}`, {
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' }
          });
          if (stateResp2.ok) {
            const stateData2 = await stateResp2.json();
            console.log(`[TV Test] Remote entity ${remoteEntity}: state="${stateData2.state}"`);
            results.push({ method: `remote_check_${remoteEntity}`, success: true });
          } else {
            console.log(`[TV Test] Remote entity ${remoteEntity}: HTTP ${stateResp2.status}`);
            results.push({ method: `remote_check_${remoteEntity}`, success: false, error: `HTTP ${stateResp2.status}` });
          }
        } catch (e: any) {
          console.log(`[TV Test] Remote entity ${remoteEntity}: ${e.message}`);
          results.push({ method: `remote_check_${remoteEntity}`, success: false, error: e.message });
        }
      }
    }

    if (method === 'samsung-browser') {
      const tvEntity = CAT_TV_ENTITY;
      console.log(`[TV Test] Testing Samsung Smart TV browser methods on ${tvEntity}`);

      const samsungMethods = [
        { service: 'media_player/play_media', data: { entity_id: tvEntity, media_content_id: testUrl, media_content_type: 'url' }, label: 'Samsung play_media url' },
        { service: 'media_player/play_media', data: { entity_id: tvEntity, media_content_id: testUrl, media_content_type: 'browser' }, label: 'Samsung play_media browser' },
        { service: 'media_player/select_source', data: { entity_id: tvEntity, source: 'Internet' }, label: 'Samsung select_source Internet' },
        { service: 'media_player/select_source', data: { entity_id: tvEntity, source: 'Web Browser' }, label: 'Samsung select_source Web Browser' },
        { service: 'media_player/select_source', data: { entity_id: tvEntity, source: 'Browser' }, label: 'Samsung select_source Browser' },
        { service: 'samsungtv/select_source', data: { entity_id: tvEntity, source: 'Internet' }, label: 'Samsung samsungtv/select_source Internet' },
      ];
      for (const { service, data, label } of samsungMethods) {
        try {
          await haServiceCall(service, data, `TV Test ${label}`);
          console.log(`[TV Test] ${label}: OK`);
          results.push({ method: label, success: true });
        } catch (e: any) {
          console.log(`[TV Test] ${label}: FAILED — ${e.message}`);
          results.push({ method: label, success: false, error: e.message });
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (method === 'samsung-open-url') {
      const tvEntity = CAT_TV_ENTITY;
      try {
        await haServiceCall('media_player/play_media', { entity_id: tvEntity, media_content_id: testUrl, media_content_type: 'url' }, 'Samsung Open URL');
        console.log(`[TV Test] Samsung open URL: OK`);
        results.push({ method: 'samsung_open_url', success: true });
      } catch (e: any) {
        console.log(`[TV Test] Samsung open URL: FAILED — ${e.message}`);
        results.push({ method: 'samsung_open_url', success: false, error: e.message });
      }
    }

    if (method === 'samsung-sources') {
      const tvEntity = CAT_TV_ENTITY;
      try {
        const stateResp2 = await fetch(`${HOME_ASSISTANT_URL.replace(/\/$/, '')}/api/states/${tvEntity}`, {
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (stateResp2.ok) {
          const stateData2 = await stateResp2.json();
          console.log(`[TV Test] Samsung TV state: "${stateData2.state}"`);
          console.log(`[TV Test] Samsung TV source: "${stateData2.attributes?.source}"`);
          console.log(`[TV Test] Samsung TV source_list: ${JSON.stringify(stateData2.attributes?.source_list)}`);
          console.log(`[TV Test] Samsung TV app_name: "${stateData2.attributes?.app_name}"`);
          console.log(`[TV Test] Samsung TV supported_features: ${stateData2.attributes?.supported_features}`);
          results.push({ method: 'samsung_state', success: true, error: `state=${stateData2.state}, source=${stateData2.attributes?.source}, sources=${JSON.stringify(stateData2.attributes?.source_list)}, app=${stateData2.attributes?.app_name}` });
        }
      } catch (e: any) {
        results.push({ method: 'samsung_state', success: false, error: e.message });
      }
    }

    if (method === 'firestick-internet') {
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'am force-stop com.amazon.cloud9' }, 'TV Test Kill Old');
      } catch (e: any) {}
      await new Promise(r => setTimeout(r, 1000));

      const browsers = [
        { pkg: 'com.amazon.cloud9', activity: 'com.amazon.cloud9.BrowserActivity', label: 'Silk BrowserActivity' },
        { pkg: 'com.amazon.cloud9', activity: 'com.amazon.cloud9.MainActivity', label: 'Silk MainActivity' },
        { pkg: 'com.amazon.cloud9', activity: null, label: 'Silk (package only)' },
        { pkg: 'com.amazon.internet', activity: null, label: 'Amazon Internet' },
        { pkg: 'org.mozilla.tv.firefox', activity: null, label: 'Firefox TV' },
        { pkg: 'com.phlox.tvwebbrowser', activity: null, label: 'TV Web Browser' },
      ];
      for (const { pkg, activity, label } of browsers) {
        try {
          const cmd = activity
            ? `am start -n ${pkg}/${activity} -a android.intent.action.VIEW -d "${testUrl}"`
            : `am start -a android.intent.action.VIEW -d "${testUrl}" ${pkg}`;
          await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: cmd }, `TV Test ${label}`);
          console.log(`[TV Test] ${label}: OK`);
          results.push({ method: label, success: true });
        } catch (e: any) {
          console.log(`[TV Test] ${label}: FAILED — ${e.message}`);
          results.push({ method: label, success: false, error: e.message });
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    console.log(`[TV Test] ====== TEST COMPLETE ======`);
    console.log(`[TV Test] Results: ${JSON.stringify(results)}`);
    res.json({ results, testUrl });
  });

  const SERVER_START_TIME = Date.now();
  const SERVER_STARTUP_COOLDOWN_MS = 60 * 1000;

  // ===== HA Connectivity Health Monitor =====
  interface HAHealthState {
    connected: boolean;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
    lastCheckAt: number | null;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    totalChecks: number;
    totalFailures: number;
    lastError: string | null;
    wasDownSince: number | null;
  }
  const haHealth: HAHealthState = {
    connected: true,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastCheckAt: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    totalChecks: 0,
    totalFailures: 0,
    lastError: null,
    wasDownSince: null,
  };

  async function checkHAConnectivity(): Promise<boolean> {
    haHealth.totalChecks++;
    haHealth.lastCheckAt = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`${HOME_ASSISTANT_URL.replace(/\/$/, '')}/api/`, {
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        const wasDown = !haHealth.connected;
        const downSince = haHealth.wasDownSince;
        haHealth.connected = true;
        haHealth.lastSuccessAt = Date.now();
        haHealth.consecutiveSuccesses++;
        haHealth.consecutiveFailures = 0;
        haHealth.lastError = null;
        haHealth.wasDownSince = null;

        if (wasDown && downSince) {
          const downDuration = Math.round((Date.now() - downSince) / 1000);
          console.log(`[HA Health] ✓ Connection RESTORED after ${downDuration}s of downtime`);
          try {
            await fetch(`${HOME_ASSISTANT_URL.replace(/\/$/, '')}/api/services/persistent_notification/create`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: "Study Dashboard Reconnected",
                message: `Dashboard connection restored after ${downDuration}s of downtime. Automations are active again.`,
                notification_id: "study_dashboard_health",
              }),
            });
          } catch {}
          if (haCommandQueue.length > 0) {
            console.log(`[HA Health] Draining ${haCommandQueue.length} queued command(s) after reconnection`);
            processHACommandQueue().catch(e => console.warn(`[HA Queue] Drain error: ${e.message}`));
          }
        }
        if (haCommandQueue.length > 0 && !haQueueProcessing) {
          processHACommandQueue().catch(() => {});
        }
        return true;
      }
      throw new Error(`HTTP ${resp.status}`);
    } catch (e: any) {
      haHealth.consecutiveFailures++;
      haHealth.consecutiveSuccesses = 0;
      haHealth.totalFailures++;
      haHealth.lastFailureAt = Date.now();
      haHealth.lastError = e?.message || String(e);

      if (haHealth.connected) {
        haHealth.connected = false;
        haHealth.wasDownSince = Date.now();
        console.error(`[HA Health] ✗ Connection LOST: ${haHealth.lastError}`);
      } else {
        console.warn(`[HA Health] ✗ Still disconnected (${haHealth.consecutiveFailures} consecutive failures): ${haHealth.lastError}`);
      }
      return false;
    }
  }

  const HA_HEALTH_CHECK_INTERVAL_MS = 60 * 1000;
  let haHealthInterval: ReturnType<typeof setInterval> | null = null;

  setTimeout(() => {
    checkHAConnectivity().then(ok => {
      console.log(`[HA Health] Initial check: ${ok ? 'connected' : 'disconnected'}`);
    });
    haHealthInterval = setInterval(() => {
      checkHAConnectivity();
    }, HA_HEALTH_CHECK_INTERVAL_MS);
  }, 10000);

  app.get("/api/health", async (_req, res) => {
    const uptimeSeconds = Math.round((Date.now() - SERVER_START_TIME) / 1000);
    res.json({
      status: "ok",
      uptime: uptimeSeconds,
      ha: {
        connected: haHealth.connected,
        lastSuccessAt: haHealth.lastSuccessAt ? new Date(haHealth.lastSuccessAt).toISOString() : null,
        lastFailureAt: haHealth.lastFailureAt ? new Date(haHealth.lastFailureAt).toISOString() : null,
        consecutiveFailures: haHealth.consecutiveFailures,
        totalChecks: haHealth.totalChecks,
        totalFailures: haHealth.totalFailures,
        lastError: haHealth.lastError,
        downSince: haHealth.wasDownSince ? new Date(haHealth.wasDownSince).toISOString() : null,
        commandQueue: {
          pending: haCommandQueue.length,
          processing: haQueueProcessing,
          oldest: haCommandQueue.length > 0 ? new Date(haCommandQueue[0].queuedAt).toISOString() : null,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  async function checkAndActivateSemester(): Promise<void> {
    try {
      const now = new Date();
      const allSemesters = await storage.getAllSemesterSettings();
      const currentActive = allSemesters.find(s => s.isActive);

      if (currentActive) {
        const endDate = currentActive.semesterEndDate ? new Date(currentActive.semesterEndDate) : null;
        if (endDate && now < endDate) return;
      }

      const sorted = allSemesters
        .filter(s => {
          const start = new Date(s.semesterStartDate);
          const end = s.semesterEndDate ? new Date(s.semesterEndDate) : null;
          return start <= now && (!end || now <= end);
        })
        .sort((a, b) => new Date(b.semesterStartDate).getTime() - new Date(a.semesterStartDate).getTime());

      const shouldBeActive = sorted[0];
      if (!shouldBeActive) {
        const upcoming = allSemesters
          .filter(s => new Date(s.semesterStartDate) > now)
          .sort((a, b) => new Date(a.semesterStartDate).getTime() - new Date(b.semesterStartDate).getTime());
        if (upcoming.length > 0) {
          const nextStart = new Date(upcoming[0].semesterStartDate);
          const daysUntil = Math.ceil((nextStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`[Semester Auto] Between semesters — next is "${upcoming[0].semesterName}" in ${daysUntil} days`);
        }
        return;
      }

      if (currentActive && currentActive.id === shouldBeActive.id) return;

      if (currentActive) {
        await storage.updateSemesterSettings(currentActive.id, { isActive: false });
      }
      await storage.updateSemesterSettings(shouldBeActive.id, { isActive: true });
      console.log(`[Semester Auto] Activated "${shouldBeActive.semesterName}" (ID ${shouldBeActive.id})`);
    } catch (e: any) {
      console.error(`[Semester Auto] Error: ${e.message}`);
    }
  }

  checkAndActivateSemester();
  setInterval(checkAndActivateSemester, 6 * 60 * 60 * 1000);

  // Self-ping to keep Replit from sleeping (every 4 minutes)
  const SELF_PING_INTERVAL_MS = 4 * 60 * 1000;
  const APP_URL = DEPLOYED_APP_URL;
  setTimeout(() => {
    setInterval(async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        await fetch(`${APP_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
      } catch (e: any) {
        console.warn(`[Self-Ping] Failed: ${e.message}`);
      }
    }, SELF_PING_INTERVAL_MS);
  }, 30000);

  // Track active cat-wash playback session with unique session ID to prevent concurrent loops
  let catWashPlaybackActive = false;
  let catWashSessionId = 0;
  let catWashPlaybackStartedAt: Date | null = null;
  let catWashManuallyStoppedAt: Date | null = null;
  let catWashPlaybackTrigger: 'lights' | 'manual' | null = null;
  let lastVolumeChange: { volume: number; direction: string; timestamp: number } | null = null;
  let catLightsConfirmResolve: ((value: boolean) => void) | null = null;
  let catLightsLastPromptAt: number | null = null;
  let catLightsPromptPending = false;
  let coursePlayPriority: Record<string, number> = {};
  const CAT_LIGHTS_PROMPT_COOLDOWN_MS = 3 * 60 * 1000;
  let catLightsBypassCooldown = false;
  let lastPlaybackStoppedAt: number = 0;
  let toothbrushPollInterval: ReturnType<typeof setInterval> | null = null;

  interface PersistedPlaybackSession {
    fileId: number;
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
    trigger: 'lights' | 'manual';
    startedAt: string;
    updatedAt: string;
    status: 'active' | 'paused';
  }

  async function savePlaybackSession(data: PersistedPlaybackSession): Promise<void> {
    try {
      const json = JSON.stringify(data);
      const existing = await db.select().from(appState).where(eq(appState.key, 'playback_session')).limit(1);
      if (existing.length > 0) {
        await db.update(appState).set({ value: json, updatedAt: new Date() }).where(eq(appState.key, 'playback_session'));
      } else {
        await db.insert(appState).values({ key: 'playback_session', value: json });
      }
    } catch (e: any) {
      console.error(`[PlaybackPersist] Save failed: ${e.message}`);
    }
  }

  async function getPersistedPlaybackSession(): Promise<PersistedPlaybackSession | null> {
    try {
      const rows = await db.select().from(appState).where(eq(appState.key, 'playback_session')).limit(1);
      if (rows.length > 0 && rows[0].value) {
        return JSON.parse(rows[0].value) as PersistedPlaybackSession;
      }
    } catch (e: any) {
      console.error(`[PlaybackPersist] Load failed: ${e.message}`);
    }
    return null;
  }

  async function clearPlaybackSession(): Promise<void> {
    try {
      await db.delete(appState).where(eq(appState.key, 'playback_session'));
    } catch (e: any) {
      console.error(`[PlaybackPersist] Clear failed: ${e.message}`);
    }
  }

  const PROF_REQD_COURSES = new Set(['CPPA101','CPPA102','CPPA120','CPPA121','CPPA122','CPPA124','CPPA125']);
  const LIBERAL_CODES = new Set(LIBERAL_STUDIES_COURSES.map(c => c.code.replace(/\s/g, '')));
  const OPEN_ELECTIVE_CODES = new Set(OPEN_ELECTIVE_COURSES.map(c => c.code.replace(/\s/g, '')));

  function getCoursePriorityForFile(f: any): number {
    const folder = (f.folder || '').toLowerCase();
    const name = (f.originalName || '').toLowerCase();
    const codeWithNum = folder.match(/([a-z]{3,5}\s?\d{3})/i)?.[1]?.toUpperCase().replace(/\s/g, '') ||
                        name.match(/([a-z]{3,5}\s?\d{3})/i)?.[1]?.toUpperCase().replace(/\s/g, '') || '';
    if (!codeWithNum) return 999;

    for (const [key, priority] of Object.entries(coursePlayPriority)) {
      const keyCode = key.split(':')[1] || '';
      if (keyCode.toUpperCase().replace(/\s/g, '') === codeWithNum && priority > 0) {
        return priority;
      }
    }

    if (PROF_REQD_COURSES.has(codeWithNum)) return 100;
    if (LIBERAL_CODES.has(codeWithNum)) return 200;
    if (OPEN_ELECTIVE_CODES.has(codeWithNum)) return 300;
    return 999;
  }

  function getSemesterTypeFolder(semType: string | null | undefined): string {
    const t = (semType || 'winter').toLowerCase();
    if (t.includes('spring') || t.includes('summer')) return 'Spring & Summer';
    if (t.includes('fall')) return 'Fall';
    return 'Winter';
  }

  function generateWeekFolderNames(semester: any, courseIndex: number): string[] {
    const semType = (semester.semesterType || 'winter').toLowerCase();
    const isSpSu = semType.includes('spring') || semType.includes('summer');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function fmt(d: Date): string {
      return `${months[d.getMonth()]} ${d.getDate()}`;
    }

    if (!isSpSu) {
      const semStart = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const readingWeekStart = semester.readingWeekStart ? new Date(semester.readingWeekStart) : null;
      const weeks: string[] = [];
      let weekStart = new Date(semStart);
      weekStart.setHours(0, 0, 0, 0);
      const dayOfWeek = weekStart.getDay();
      if (dayOfWeek !== 1) {
        weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7));
      }

      let weekNum = 1;
      let readingWeekInserted = false;
      for (let i = 0; weekNum <= 13; i++) {
        const wStart = new Date(weekStart);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 4);

        if (readingWeekStart && !readingWeekInserted) {
          const rwStart = new Date(readingWeekStart);
          rwStart.setHours(0, 0, 0, 0);
          const rwDay = rwStart.getDay();
          if (rwDay === 0) rwStart.setDate(rwStart.getDate() + 1);
          else if (rwDay === 6) rwStart.setDate(rwStart.getDate() + 2);
          else if (rwDay !== 1) rwStart.setDate(rwStart.getDate() - (rwDay - 1));
          if (wStart.getTime() === rwStart.getTime()) {
            weeks.push(`Reading Week - STUDY`);
            weekStart.setDate(weekStart.getDate() + 7);
            readingWeekInserted = true;
            continue;
          }
        }

        const startStr = fmt(wStart);
        const endStr = wStart.getMonth() === wEnd.getMonth() ? `${wEnd.getDate()}` : fmt(wEnd);
        weeks.push(`Week ${weekNum} - ${startStr}-${endStr}`);
        weekNum++;
        weekStart.setDate(weekStart.getDate() + 7);
        if (i > 20) break;
      }
      return weeks;
    }

    const springSummerTerm = (semester[`course${courseIndex}SpringSummerTerm`] || 'full').toLowerCase();
    let courseStart: Date;
    let courseEnd: Date;
    const semStart = new Date(semester.semesterStartDate || Date.now());

    if (springSummerTerm === 'first_half') {
      courseStart = semester[`course${courseIndex}StartDate`] ? new Date(semester[`course${courseIndex}StartDate`]) : new Date(semStart);
      courseEnd = semester[`course${courseIndex}EndDate`] ? new Date(semester[`course${courseIndex}EndDate`]) : new Date(courseStart.getTime() + 7 * 7 * 86400000);
    } else if (springSummerTerm === 'second_half') {
      courseStart = semester[`course${courseIndex}StartDate`] ? new Date(semester[`course${courseIndex}StartDate`]) : new Date(semStart);
      courseEnd = semester[`course${courseIndex}EndDate`] ? new Date(semester[`course${courseIndex}EndDate`]) : new Date(courseStart.getTime() + 6 * 7 * 86400000);
    } else {
      courseStart = semester[`course${courseIndex}StartDate`] ? new Date(semester[`course${courseIndex}StartDate`]) : new Date(semStart);
      courseEnd = semester[`course${courseIndex}EndDate`] ? new Date(semester[`course${courseIndex}EndDate`]) : new Date(courseStart.getTime() + 13 * 7 * 86400000);
    }
    courseStart.setHours(0, 0, 0, 0);
    courseEnd.setHours(0, 0, 0, 0);
    const dayOW = courseStart.getDay();
    if (dayOW !== 1) {
      courseStart.setDate(courseStart.getDate() - ((dayOW + 6) % 7));
    }

    const weeks: string[] = [];
    let weekStart = new Date(courseStart);
    let weekNum = 1;

    if (springSummerTerm === 'full') {
      const midpoint = 8;
      let secondHalfNum = 1;
      while (weekStart.getTime() < courseEnd.getTime()) {
        const wStart = new Date(weekStart);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 4);
        const startStr = fmt(wStart);
        const endStr = wStart.getMonth() === wEnd.getMonth() ? `${wEnd.getDate()}` : fmt(wEnd);
        if (weekNum >= midpoint) {
          weeks.push(`Week ${weekNum} (${secondHalfNum}) - ${startStr}-${endStr}`);
          secondHalfNum++;
        } else {
          weeks.push(`Week ${weekNum} - ${startStr}-${endStr}`);
        }
        weekNum++;
        weekStart.setDate(weekStart.getDate() + 7);
      }
    } else {
      while (weekStart.getTime() < courseEnd.getTime()) {
        const wStart = new Date(weekStart);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 4);
        const startStr = fmt(wStart);
        const endStr = wStart.getMonth() === wEnd.getMonth() ? `${wEnd.getDate()}` : fmt(wEnd);
        weeks.push(`Week ${weekNum} - ${startStr}-${endStr}`);
        weekNum++;
        weekStart.setDate(weekStart.getDate() + 7);
      }
    }
    return weeks;
  }

  async function getSemesterOneDriveCourses(semesterSettings: any): Promise<Array<{ code: string; path: string }>> {
    if (!semesterSettings) return [];
    const semType = getSemesterTypeFolder(semesterSettings.semesterType);
    const startDate = semesterSettings.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date();
    const year = startDate.getFullYear();
    const basePath = `/School/1. TMU/Courses/${year}/${semType}`;
    const courses: Array<{ code: string; path: string }> = [];
    for (let i = 1; i <= 3; i++) {
      const code = (semesterSettings as any)[`course${i}Code`];
      const name = (semesterSettings as any)[`course${i}Name`];
      if (!code || !code.trim()) continue;
      const codeClean = code.replace(/\s/g, '');
      const folderName = name ? `${codeClean} - ${name}` : codeClean;
      courses.push({ code: codeClean, path: `${basePath}/${folderName}` });
    }
    return courses;
  }

  async function syncOneDriveFilesForWeek(semesterSettings: any, currentWeekNumber: number, logPrefix: string = '[Sync]'): Promise<void> {
    try {
      const { listOneDriveItems } = await import("./onedrive");
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorageSync = new ObjectStorageService();
      const courses = await getSemesterOneDriveCourses(semesterSettings);
      console.log(`${logPrefix} Syncing OneDrive for ${courses.length} courses, week ${currentWeekNumber}`);
      for (const course of courses) {
        try {
          const weekFolders = await listOneDriveItems(course.path);
          const currentWeekFolder = weekFolders.find((f: any) => f.type === 'folder' && f.name.match(/Week\s+(\d+)/i)?.[1] && parseInt(f.name.match(/Week\s+(\d+)/i)![1], 10) === currentWeekNumber);
          if (!currentWeekFolder) continue;
          const weekContents = await listOneDriveItems(currentWeekFolder.path);
          for (const subType of ['module', 'reading']) {
            const subFolder = weekContents.find((f: any) => f.type === 'folder' && f.name.toLowerCase() === subType);
            if (!subFolder) continue;
            const subFiles = await listOneDriveItems(subFolder.path);
            for (const file of subFiles) {
              if (file.type !== 'file' || !file.name.endsWith('.pdf')) continue;
              const existingFiles = await storage.getFiles();
              const folderName = `week-${currentWeekNumber}-${course.code.toLowerCase()}-${subType}`;
              if (existingFiles.some((f: any) => f.originalName === file.name && f.folder === folderName)) continue;
              const downloadResponse = await fetch(file.downloadUrl);
              if (!downloadResponse.ok) continue;
              const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
              const uploadUrl = await objectStorageSync.getObjectEntityUploadURL();
              const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: fileBuffer, headers: { 'Content-Type': 'application/pdf' } });
              if (!uploadResponse.ok) continue;
              const objectPath = objectStorageSync.normalizeObjectEntityPath(uploadUrl);
              const newFile = await storage.createFile({ originalName: file.name, displayName: file.name, objectPath, contentType: 'application/pdf', size: file.size, folder: folderName, listened: false });
              console.log(`${logPrefix} Synced new file: ${file.name} → ${folderName}`);
              if (newFile?.id) {
                queueFileForPreparation(newFile.id);
              }
            }
          }
        } catch (e: any) { console.log(`${logPrefix} OneDrive sync error for ${course.code}: ${e.message}`); }
      }
      console.log(`${logPrefix} OneDrive sync complete`);
    } catch (e: any) { console.log(`${logPrefix} OneDrive sync failed: ${e.message}`); }
  }

  let audioPreparationActive = false;
  let audioPreparationPaused = false;
  const audioPreparationQueue: number[] = [];

  async function prepareFileAudio(fileId: number): Promise<void> {
    try {
      const file = await storage.getFile(fileId);
      if (!file) {
        console.log(`[AudioPrep] File ${fileId} not found — skipping`);
        return;
      }
      if (file.preparedAudioPaths) {
        console.log(`[AudioPrep] File ${fileId} (${file.originalName}) already prepared — skipping`);
        return;
      }

      console.log(`[AudioPrep] ===== Preparing file ${fileId}: ${file.originalName} =====`);
      const startTime = Date.now();

      let text = await extractFileText(file);
      if (!text || text.length < 20) {
        console.log(`[AudioPrep] No usable text extracted from ${file.originalName} — skipping`);
        return;
      }

      const chunks = chunkTextForNest(text);
      if (chunks.length === 0) {
        console.log(`[AudioPrep] No chunks generated for ${file.originalName} — skipping`);
        return;
      }

      console.log(`[AudioPrep] ${file.originalName}: ${text.length} chars → ${chunks.length} chunks`);
      const audioPaths: string[] = [];
      const voice = 'echo';

      let consecutiveRateLimits = 0;
      for (let i = 0; i < chunks.length; i++) {
        while (audioPreparationPaused) {
          await new Promise(r => setTimeout(r, 2000));
        }
        try {
          console.log(`[AudioPrep] Generating chunk ${i + 1}/${chunks.length} for ${file.originalName} (${chunks[i].length} chars)`);
          const audioPath = await generateAndSaveTTSAudio(chunks[i], `prep-${fileId}-chunk-${i}`, voice, true);
          audioPaths.push(audioPath);
          consecutiveRateLimits = 0;
        } catch (e: any) {
          const isRateLimit = e.message?.includes('429') || e.message?.includes('rate limit') || e.message?.includes('Rate limit');
          console.error(`[AudioPrep] Failed to generate chunk ${i + 1} for ${file.originalName}: ${e.message}`);
          if (isRateLimit) {
            consecutiveRateLimits++;
            const backoffMs = Math.min(consecutiveRateLimits * 15000, 120000);
            console.log(`[AudioPrep] Rate limited (${consecutiveRateLimits}x) — backing off ${backoffMs / 1000}s`);
            await new Promise(r => setTimeout(r, backoffMs));
            i--;
            continue;
          }
          audioPaths.push('');
          await new Promise(r => setTimeout(r, 2000));
        }
        await new Promise(r => setTimeout(r, 800));
      }

      await storage.updateFile(fileId, {
        extractedText: text,
        totalChunks: chunks.length,
        preparedAudioPaths: JSON.stringify(audioPaths),
        preparedAt: new Date(),
      });

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[AudioPrep] ===== Completed ${file.originalName}: ${chunks.length} chunks in ${elapsed}s =====`);
    } catch (e: any) {
      console.error(`[AudioPrep] Error preparing file ${fileId}: ${e.message}`);
    }
  }

  async function processAudioPreparationQueue(): Promise<void> {
    if (audioPreparationActive) return;
    audioPreparationActive = true;
    try {
      while (audioPreparationQueue.length > 0) {
        while (audioPreparationPaused) {
          console.log(`[AudioPrep] Queue paused — waiting for live playback to finish`);
          await new Promise(r => setTimeout(r, 5000));
        }
        const fileId = audioPreparationQueue.shift()!;
        await prepareFileAudio(fileId);
      }
    } finally {
      audioPreparationActive = false;
    }
  }

  function queueFileForPreparation(fileId: number): void {
    if (!audioPreparationQueue.includes(fileId)) {
      audioPreparationQueue.push(fileId);
      console.log(`[AudioPrep] Queued file ${fileId} for preparation (queue size: ${audioPreparationQueue.length})`);
      processAudioPreparationQueue().catch(e => console.error(`[AudioPrep] Queue processing error: ${e.message}`));
    }
  }

  setTimeout(async () => {
    try {
      const allFiles = await storage.getFiles();
      const voiceMigrationDone = globalThis.__voiceMigrationDone;
      if (!voiceMigrationDone) {
        const filesWithPrep = allFiles.filter((f: any) => f.preparedAudioPaths);
        if (filesWithPrep.length > 0) {
          console.log(`[AudioPrep] One-time: clearing ${filesWithPrep.length} pre-generated audio caches (voice migration to echo+slowPace)`);
          for (const f of filesWithPrep) {
            try { await storage.updateFile(f.id, { preparedAudioPaths: null }); } catch {}
          }
        }
        (globalThis as any).__voiceMigrationDone = true;
      }
      const citationCleanupDone = (globalThis as any).__citationCleanupDone;
      if (!citationCleanupDone) {
        const filesWithText = allFiles.filter((f: any) => f.extractedText);
        if (filesWithText.length > 0) {
          console.log(`[AudioPrep] One-time: clearing ${filesWithText.length} cached extracted texts (citation cleanup improvement)`);
          for (const f of filesWithText) {
            try { await storage.updateFile(f.id, { extractedText: null, preparedAudioPaths: null }); } catch {}
          }
        }
        (globalThis as any).__citationCleanupDone = true;
      }
      const unprepared = allFiles.filter((f: any) => !f.preparedAudioPaths && !f.listened);
      if (unprepared.length > 0) {
        const semesterSettings = await storage.getActiveSemesterSettings();
        const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date();
        const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : null;
        const currentWeek = getWeekNumber(torontoDate(), semStart, rwStart);

        const getFileWeek = (f: any) => {
          const m = f.folder?.match(/week-(\d+)/i);
          return m ? parseInt(m[1], 10) : 999;
        };
        unprepared.sort((a: any, b: any) => {
          const aw = getFileWeek(a), bw = getFileWeek(b);
          const aDist = Math.abs(aw - currentWeek), bDist = Math.abs(bw - currentWeek);
          return aDist - bDist;
        });

        console.log(`[AudioPrep] Startup: ${unprepared.length} unprepared files found, queuing (current week ${currentWeek})`);
        for (const f of unprepared) {
          queueFileForPreparation(f.id);
        }
      } else {
        console.log(`[AudioPrep] Startup: all files already prepared or listened`);
      }
    } catch (e: any) {
      console.error(`[AudioPrep] Startup scan error: ${e.message}`);
    }

    const AUDIO_REPAIR_INTERVAL_MS = 30 * 60 * 1000;
    setInterval(async () => {
      if (audioPreparationActive || audioPreparationPaused || catWashPlaybackActive) return;
      try {
        const allFiles = await storage.getFiles();
        const filesWithGaps = allFiles.filter((f: any) => {
          if (!f.preparedAudioPaths || f.listened) return false;
          try {
            const paths: string[] = JSON.parse(f.preparedAudioPaths);
            return paths.some(p => !p || p.length === 0);
          } catch { return false; }
        });
        if (filesWithGaps.length > 0) {
          console.log(`[AudioPrep Repair] Found ${filesWithGaps.length} file(s) with incomplete audio — re-preparing`);
          for (const f of filesWithGaps) {
            await storage.updateFile(f.id, { preparedAudioPaths: null });
            queueFileForPreparation(f.id);
          }
        }
      } catch (e: any) {
        console.error(`[AudioPrep Repair] Error: ${e.message}`);
      }
    }, AUDIO_REPAIR_INTERVAL_MS);

    try {
      const persisted = await getPersistedPlaybackSession();
      if (persisted) {
        const sessionAge = Date.now() - new Date(persisted.updatedAt).getTime();
        const maxAge = 30 * 60 * 1000;
        if (sessionAge > maxAge) {
          console.log(`[PlaybackRecovery] Found stale session (${Math.round(sessionAge / 60000)}m old, status=${persisted.status}) — clearing`);
          await clearPlaybackSession();
        } else if (persisted.status === 'paused') {
          console.log(`[PlaybackRecovery] Found paused session: "${persisted.fileName}" at chunk ${persisted.chunkIndex}/${persisted.totalChunks} — saving progress, not resuming`);
          try {
            await storage.updateFile(persisted.fileId, { lastChunkIndex: persisted.chunkIndex });
          } catch {}
          await clearPlaybackSession();
        } else {
          console.log(`[PlaybackRecovery] Found active session: "${persisted.fileName}" at chunk ${persisted.chunkIndex}/${persisted.totalChunks} (${Math.round(sessionAge / 1000)}s ago) — RESUMING`);
          const file = await storage.getFile(persisted.fileId);
          if (file && !file.listened) {
            const resumeChunk = persisted.chunkIndex;
            try {
              await storage.updateFile(persisted.fileId, { lastChunkIndex: resumeChunk });
            } catch {}
            await clearPlaybackSession();

            catWashPlaybackTrigger = persisted.trigger || 'manual';
            console.log(`[PlaybackRecovery] Starting full playback flow from chunk ${resumeChunk}`);
            const updatedFile = await storage.getFile(persisted.fileId);
            if (updatedFile) {
              startConfirmedPlaybackFlow(updatedFile, '[PlaybackRecovery]', 'echo', null);
            }
          } else {
            console.log(`[PlaybackRecovery] File ${persisted.fileId} not found or already listened — clearing`);
            await clearPlaybackSession();
          }
        }
      }
    } catch (e: any) {
      console.error(`[PlaybackRecovery] Startup recovery check error: ${e.message}`);
    }
  }, 15000);

  function findNextFileByPriority(allFiles: any[], currentWeekNumber: number, excludeFileId?: number): any | null {
    const weekFiles = allFiles.filter((f: any) => {
      if (f.listened) return false;
      if (excludeFileId && f.id === excludeFileId) return false;
      const weekMatch = f.folder?.match(/week-(\d+)/i);
      return weekMatch && parseInt(weekMatch[1], 10) === currentWeekNumber;
    });
    if (weekFiles.length === 0) return null;
    const ordered = orderFilesByCoursePriority(weekFiles);
    const partiallyListened = ordered.filter((f: any) => (f.lastChunkIndex || 0) > 0);
    const fresh = ordered.filter((f: any) => (f.lastChunkIndex || 0) === 0);
    const prioritized = [...partiallyListened, ...fresh];
    return prioritized[0] || null;
  }

  function isSpotifyPlayingOnEverywhere(): boolean {
    return spotifyActivePlaybacks.has(EVERYWHERE_GROUP_ENTITY);
  }

  async function stopAllCatWashroomSpeakers(haUrl: string): Promise<void> {
    const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
    const everywhereActive = isSpotifyPlayingOnEverywhere();
    if (everywhereActive) {
      console.log(`[Speakers] Everywhere group is playing Spotify — only stopping Nest speaker + media group, preserving cat washroom Echos`);
      await Promise.allSettled([
        fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: NEST_SPEAKER_ENTITY }),
        }),
        fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: CAT_WR_MEDIA_GROUP }),
        }),
        fetch(`${haUrl}/api/services/media_player/media_pause`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: CAT_WR_MEDIA_GROUP }),
        }),
      ]);
    } else {
      await Promise.allSettled([
        fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: NEST_SPEAKER_ENTITY }),
        }),
        fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: CAT_ECHO_ENTITIES }),
        }),
        fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: CAT_WR_MEDIA_GROUP }),
        }),
        fetch(`${haUrl}/api/services/media_player/media_pause`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: CAT_ECHO_ENTITIES }),
        }),
        fetch(`${haUrl}/api/services/media_player/media_pause`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: CAT_WR_MEDIA_GROUP }),
        }),
      ]);
      console.log(`[Speakers] Stopped Nest + cat washroom Echos + media group (stop + pause)`);
    }
  }

  async function playChumFmRadio(haUrl: string): Promise<void> {
    if (catWashPlaybackActive) {
      console.log(`[Radio] BLOCKED: CPPA playback is active — refusing to play CHUM FM`);
      return;
    }
    try {
      await haServiceCall('media_player/play_media', {
        entity_id: CAT_WR_MEDIA_GROUP, media_content_type: "custom", media_content_id: "play 104.5 chum fm"
      }, 'CHUM FM');
      console.log(`[Radio] Playing CHUM FM 104.5 on Cat Washroom speaker group`);
    } catch (e: any) {
      console.error(`[Radio] Failed to play CHUM FM: ${e.message}`);
    }
  }

  async function startConfirmedPlaybackFlow(
    fileToPlay: any,
    logPrefix: string,
    voice: string = "echo",
    confirmationTTS: string | null = null
  ): Promise<void> {
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    const appUrl = DEPLOYED_APP_URL;
    const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');
    const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

    audioPreparationPaused = true;
    console.log(`${logPrefix} Paused audio preparation for live playback`);

    const fileName = fileToPlay.displayName || fileToPlay.originalName || 'Unknown file';
    const savedChunk = fileToPlay.lastChunkIndex || 0;
    const resumeFromChunk = Math.max(0, savedChunk > 0 ? savedChunk - 1 : 0);
    console.log(`${logPrefix} Will resume from chunk ${resumeFromChunk} (saved: ${savedChunk})`);

    if (savedChunk > 0 && resumeFromChunk < savedChunk) {
      try {
        let currentChecked: number[] = [];
        if (fileToPlay.checkedChunks) {
          try { currentChecked = JSON.parse(fileToPlay.checkedChunks); } catch {}
        }
        const contextIdx = resumeFromChunk;
        if (currentChecked.includes(contextIdx)) {
          currentChecked = currentChecked.filter(c => c !== contextIdx);
          await storage.updateFile(fileToPlay.id, { checkedChunks: JSON.stringify(currentChecked) });
          console.log(`${logPrefix} Removed checkmark from context chunk ${contextIdx} for replay`);
        }
      } catch (e: any) {
        console.log(`${logPrefix} Error removing context chunk checkmark: ${e.message}`);
      }
    }

    const readerUrl = `${appUrl}/pdf-reader/${fileToPlay.id}?catWashFollow=true&autoplay=false&resumeChunk=${resumeFromChunk}&voice=echo&fullscreen=true&auth=${authParam}`;
    const tvFollowUrl = `${appUrl}/pdf-reader/${fileToPlay.id}?catWashFollow=true&autoplay=false&resumeChunk=${resumeFromChunk}&followOnly=true&voice=echo&fullscreen=true&auth=${authParam}`;

    catWashSessionId++;
    const currentSession = catWashSessionId;
    if (catWashPlaybackActive) {
      console.log(`${logPrefix} Stopping previous playback session`);
      if (nestPlaybackAbort) nestPlaybackAbort();
    }
    catWashPlaybackActive = true;
    catWashPlaybackStartedAt = new Date();
    startToothbrushPolling();

    const lightsNavTimestamp = Date.now();
    await Promise.all([
      setTabletCommand({ action: 'navigate', url: readerUrl, timestamp: lightsNavTimestamp }, true, 'master'),
      setTabletCommand({ action: 'navigate', url: tvFollowUrl, timestamp: lightsNavTimestamp }, true, 'tv'),
    ]);
    console.log(`${logPrefix} tablet-nav set for devices`);

    const textExtractionPromise = extractFileText(fileToPlay);

    try {
      await fetch(`${haUrl}/api/services/media_player/volume_set`, {
        method: 'POST', headers: haHeaders,
        body: JSON.stringify({ entity_id: CAT_WR_HA_VOICE_ENTITY, volume_level: 0.45 }),
      });
      console.log(`${logPrefix} Set HA Voice volume to 0.45`);
    } catch (e: any) { console.warn(`${logPrefix} HA Voice volume set error (non-fatal): ${e.message}`); }

    const fileText = await textExtractionPromise;
    console.log(`${logPrefix} Text extraction ready (${fileText ? fileText.length : 0} chars)`);
    const fileChunks = fileText ? chunkTextForNest(fileText) : [];
    const totalChunksCalc = fileChunks.length;

    if (fileToPlay.totalChunks !== totalChunksCalc && totalChunksCalc > 0) {
      try { await storage.updateFile(fileToPlay.id, { totalChunks: totalChunksCalc }); } catch {}
    }

    let preGeneratedChunk0Path: string | null = null;
    let prePreparedPaths: string[] = [];
    if (fileToPlay.preparedAudioPaths) {
      try { prePreparedPaths = JSON.parse(fileToPlay.preparedAudioPaths); } catch {}
    }
    const chunk0PreGenPromise = (fileChunks.length > resumeFromChunk)
      ? (prePreparedPaths[resumeFromChunk] && prePreparedPaths[resumeFromChunk].length > 0
          ? Promise.resolve().then(() => { preGeneratedChunk0Path = prePreparedPaths[resumeFromChunk]; console.log(`${logPrefix} Using pre-prepared audio for chunk ${resumeFromChunk}`); })
          : generateAndSaveTTSAudio(fileChunks[resumeFromChunk], `nest-chunk-${fileToPlay.id}-${resumeFromChunk}-${Date.now()}`, voice, true)
              .then(p => { preGeneratedChunk0Path = p; console.log(`${logPrefix} Pre-generated chunk ${resumeFromChunk} TTS`); })
              .catch(e => { console.warn(`${logPrefix} Chunk 0 pre-gen failed (will retry): ${e.message}`); })
        )
      : Promise.resolve();

    const initialChunkText = fileChunks[resumeFromChunk] || '';
    const initialWords = initialChunkText.split(/\s+/).filter((w: string) => w.length > 0);
    const initialWordCount = initialWords.length;
    const initialEstimatedMs = Math.max(5000, (initialWordCount / 175) * 60 * 1000 + 1000);

    catWashPlaybackState = {
      fileId: fileToPlay.id,
      fileName,
      chunkIndex: resumeFromChunk,
      totalChunks: totalChunksCalc,
      chunks: fileChunks,
      currentWords: initialWords,
      wordIndex: 0,
      startedAt: new Date(),
      chunkStartedAt: new Date(),
      estimatedChunkDuration: initialEstimatedMs,
      playbackMode: 'server-tts',
    };

    await savePlaybackSession({
      fileId: fileToPlay.id,
      fileName,
      chunkIndex: resumeFromChunk,
      totalChunks: totalChunksCalc,
      trigger: catWashPlaybackTrigger || 'manual',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    });
    console.log(`${logPrefix} Persisted playback session to DB (file=${fileToPlay.id}, chunk=${resumeFromChunk}/${totalChunksCalc})`);

    const tabletSetupPromise = (async () => {
      try {
        const tabletEntity = 'media_player.tablet_cat';
        const haUrl2 = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const haHeaders2 = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

        try {
          const stateResp = await fetch(`${haUrl2}/api/states/${tabletEntity}`, { headers: haHeaders2 });
          if (stateResp.ok) {
            const stateData = await stateResp.json();
            console.log(`${logPrefix} Tablet entity state: "${stateData.state}"`);
            if (stateData.state === 'unavailable') {
              console.error(`${logPrefix} Tablet is UNAVAILABLE in HA — ADB commands will not work`);
            }
          } else {
            console.error(`${logPrefix} Tablet state check failed: HTTP ${stateResp.status}`);
          }
        } catch (e: any) {
          console.error(`${logPrefix} Tablet state check error: ${e.message}`);
        }

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await haServiceCall('androidtv/adb_command', { entity_id: tabletEntity, command: 'input keyevent KEYCODE_WAKEUP' }, 'Tablet Wakeup');
            console.log(`${logPrefix} Tablet wakeup: OK (attempt ${attempt})`);
            break;
          } catch (e: any) {
            console.error(`${logPrefix} Tablet wakeup attempt ${attempt}: FAILED — ${e.message}`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
          }
        }

        try {
          await haServiceCall('androidtv/adb_command', { entity_id: tabletEntity, command: 'settings put system screen_brightness 255' }, 'Tablet Brightness');
          console.log(`${logPrefix} Tablet brightness: OK`);
        } catch (e: any) {
          console.error(`${logPrefix} Tablet brightness: FAILED — ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 4000));

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await haServiceCall('androidtv/adb_command', {
              entity_id: tabletEntity,
              command: `am start --activity-clear-task -a android.intent.action.VIEW -d "${readerUrl}" com.amazon.cloud9`
            }, `Tablet Silk Nav ${attempt}`);
            console.log(`${logPrefix} Tablet open Silk: OK (attempt ${attempt})`);
            break;
          } catch (e: any) {
            console.error(`${logPrefix} Tablet open Silk attempt ${attempt}/3: FAILED — ${e.message}`);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
          }
        }

        await new Promise(r => setTimeout(r, 3000));

        const sendTabletFullscreen = async (fAttempt: number) => {
          try {
            await haServiceCall('androidtv/adb_command', {
              entity_id: tabletEntity,
              command: 'settings put global policy_control immersive.full=com.amazon.cloud9'
            }, `Tablet Immersive ${fAttempt}`);
            console.log(`${logPrefix} Tablet immersive mode set (attempt ${fAttempt})`);
          } catch (e: any) { console.error(`${logPrefix} Tablet immersive ${fAttempt}: FAILED — ${e.message}`); }
          try {
            await haServiceCall('androidtv/adb_command', {
              entity_id: tabletEntity, command: 'input keyevent KEYCODE_F11'
            }, `Tablet F11 ${fAttempt}`);
            console.log(`${logPrefix} Tablet F11 sent (attempt ${fAttempt})`);
          } catch (e: any) { console.error(`${logPrefix} Tablet F11 ${fAttempt}: FAILED — ${e.message}`); }
          await new Promise(r => setTimeout(r, 1500));
          try {
            await haServiceCall('androidtv/adb_command', {
              entity_id: tabletEntity, command: 'input tap 540 360'
            }, `Tablet Tap ${fAttempt}`);
            console.log(`${logPrefix} Tablet center tap sent (attempt ${fAttempt})`);
          } catch (e: any) { console.error(`${logPrefix} Tablet tap ${fAttempt}: FAILED — ${e.message}`); }
        };

        await sendTabletFullscreen(1);
        setTimeout(() => sendTabletFullscreen(2), 8000);
        setTimeout(() => sendTabletFullscreen(3), 16000);
        console.log(`${logPrefix} Tablet setup complete (with 3 fullscreen attempts at 0s, 8s, 16s)`);
      } catch (e: any) {
        console.error(`${logPrefix} Tablet setup error: ${e.message}`);
      }
    })();

    const tvSetupPromise = (async () => {
      try {
        console.log(`${logPrefix} ====== TV SETUP START ======`);
        const haUrl2 = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const haHeaders2 = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
        try {
          const fsResp = await fetch(`${haUrl2}/api/states/media_player.fire_stick_cat_wr`, { headers: haHeaders2 });
          if (fsResp.ok) {
            const fsData = await fsResp.json();
            console.log(`${logPrefix} Fire Stick entity state: "${fsData.state}"`);
          } else {
            console.error(`${logPrefix} Fire Stick state check HTTP ${fsResp.status}`);
          }
        } catch (e: any) {
          console.error(`${logPrefix} Fire Stick state check error: ${e.message}`);
        }

        const turnOnResults = await Promise.allSettled([
          haServiceCall('media_player/turn_on', { entity_id: 'media_player.fire_stick_cat_wr' }, 'FireStick TurnOn'),
          haServiceCall('media_player/turn_on', { entity_id: CAT_TV_ENTITY }, 'Samsung TV TurnOn'),
        ]);
        turnOnResults.forEach((r, i) => {
          const label = i === 0 ? 'Fire Stick' : 'Samsung TV';
          if (r.status === 'fulfilled') console.log(`${logPrefix} ${label} turn_on: OK`);
          else console.error(`${logPrefix} ${label} turn_on: FAILED — ${(r as any).reason?.message || r.reason}`);
        });
        console.log(`${logPrefix} Waiting 12s for TV to boot...`);
        await new Promise(resolve => setTimeout(resolve, 12000));

        for (let srcAttempt = 1; srcAttempt <= 5; srcAttempt++) {
          try {
            await haServiceCall('media_player/select_source', { entity_id: CAT_TV_ENTITY, source: 'HDMI1' }, `TV Source ${srcAttempt}`);
            console.log(`${logPrefix} Samsung TV HDMI1 selected (attempt ${srcAttempt})`);
            break;
          } catch (e: any) {
            console.error(`${logPrefix} Samsung TV HDMI1 attempt ${srcAttempt}/5: ${e.message}`);
            if (srcAttempt < 5) await new Promise(r => setTimeout(r, 5000));
          }
        }

        console.log(`${logPrefix} Opening URL on Fire Stick...`);
        const tvOpened = await openUrlOnFireStick(haUrl, 'media_player.fire_stick_cat_wr', tvFollowUrl);
        console.log(`${logPrefix} TV URL result: success=${tvOpened}`);
        if (!tvOpened) {
          console.log(`${logPrefix} TV URL open failed — retrying after 6s`);
          await new Promise(r => setTimeout(r, 6000));
          const tvRetry = await openUrlOnFireStick(haUrl, 'media_player.fire_stick_cat_wr', tvFollowUrl);
          console.log(`${logPrefix} TV URL retry result: success=${tvRetry}`);
        }
        console.log(`${logPrefix} ====== TV SETUP COMPLETE ======`);
      } catch (e: any) {
        console.error(`${logPrefix} ====== TV SETUP ERROR: ${e.message} ======`);
      }
    })();

    const confirmTTSPromise = confirmationTTS ? (async () => {
      try {
        try {
          await haServiceCallSafe('media_player/volume_set', { entity_id: NEST_SPEAKER_ENTITY, volume_level: 0.75 }, 'Nest Pre-Confirm Vol');
        } catch (e: any) { console.warn(`${logPrefix} Pre-confirm volume set error (non-fatal): ${e.message}`); }
        let confirmPlayed = false;
        try {
          const confirmPath = await generateAndSaveTTSAudio(confirmationTTS, `confirm-${Date.now()}`);
          const nestResult = await playOnNestSpeaker(`${appUrl}${confirmPath}`);
          if (nestResult.success) {
            confirmPlayed = true;
            console.log(`${logPrefix} Confirm TTS played on Nest speaker via OpenAI/Edge TTS (actuallyPlaying=${nestResult.actuallyPlaying})`);
          } else {
            console.warn(`${logPrefix} Nest speaker confirm failed — falling back to HA Voice`);
          }
        } catch (e: any) {
          console.warn(`${logPrefix} Nest speaker confirm failed: ${e.message} — falling back to HA Voice`);
        }
        if (!confirmPlayed) {
          try {
            await haServiceCall('tts/speak', {
              entity_id: HA_CLOUD_TTS_ENTITY,
              media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
              message: confirmationTTS
            }, 'Confirm HA Cloud TTS');
            console.log(`${logPrefix} Confirm TTS played via HA Cloud TTS on HA Voice speaker (fallback)`);
          } catch (e: any) {
            console.warn(`${logPrefix} HA Voice confirm also failed: ${e.message}`);
          }
        }
        const confirmWordCount = confirmationTTS.split(/\s+/).length;
        const confirmWaitMs = Math.max(4000, (confirmWordCount / 140) * 60 * 1000 + 1500);
        console.log(`${logPrefix} Confirm TTS playing, waiting ${Math.round(confirmWaitMs / 1000)}s`);
        await new Promise(r => setTimeout(r, confirmWaitMs));
        console.log(`${logPrefix} Confirm TTS finished`);
      } catch (e: any) {
        console.error(`${logPrefix} Confirm TTS error: ${e.message}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    })() : Promise.resolve();

    await Promise.allSettled([tabletSetupPromise, tvSetupPromise, chunk0PreGenPromise, confirmTTSPromise]);

    try {
      await haServiceCallSafe('media_player/volume_set', { entity_id: NEST_SPEAKER_ENTITY, volume_level: 0.75 }, 'Nest Playback Vol');
      console.log(`${logPrefix} Nest volume set to 0.75 for playback`);
    } catch (e: any) { console.warn(`${logPrefix} Nest playback volume set error (non-fatal): ${e.message}`); }

    currentTabletReaderUrl = readerUrl;
    startNestChunkPlayback(fileToPlay.id, fileName, fileChunks, resumeFromChunk, currentSession, voice, preGeneratedChunk0Path);
  }

  function describeFileForTTS(file: any, weekNumber: number): string {
    const folder = (file.folder || '').toLowerCase();
    const origName = (file.originalName || '').toLowerCase();
    const dispName = (file.displayName || '').toLowerCase();
    const combinedName = `${origName} ${dispName}`;
    const codeMatch = folder.match(/([a-z]{3,5}\s?\d{3})/i) || combinedName.match(/([a-z]{3,5}\s?\d{3})/i);
    const courseCode = codeMatch ? codeMatch[1].toUpperCase().replace(/\s/g, '') : '';
    const shortCode = courseCode.length >= 4 ? courseCode.substring(0, 4) : courseCode;
    const isModule = folder.includes('module') || origName.includes('module') || dispName.includes('module');
    const fileType = isModule ? 'Module' : 'Reading';
    if (shortCode) {
      return `your ${shortCode} ${fileType} for week ${weekNumber}`;
    }
    return `your ${fileType} for week ${weekNumber}`;
  }

  function orderFilesByCoursePriority(files: any[]): any[] {
    const isModule = (f: any) =>
      f.folder?.toLowerCase().includes('module') ||
      f.originalName?.toLowerCase().includes('module');

    const getCourseCode = (f: any): string => {
      const folder = (f.folder || '').toLowerCase();
      const name = (f.originalName || '').toLowerCase();
      const match = folder.match(/([a-z]{3,5}\s?\d{3})/i) || name.match(/([a-z]{3,5}\s?\d{3})/i);
      return match ? match[1].toUpperCase().replace(/\s/g, '') : 'UNKNOWN';
    };

    const coursesWithUnlistenedModules = new Set<string>();
    for (const f of files) {
      if (isModule(f) && !f.listened) {
        coursesWithUnlistenedModules.add(getCourseCode(f));
      }
    }

    const eligible = files.filter(f => {
      if (isModule(f)) return true;
      const code = getCourseCode(f);
      return !coursesWithUnlistenedModules.has(code);
    });

    const withPriority = eligible.map(f => ({
      file: f,
      coursePriority: getCoursePriorityForFile(f),
      isModule: isModule(f) ? 0 : 1,
    }));

    withPriority.sort((a, b) => {
      if (a.coursePriority !== b.coursePriority) return a.coursePriority - b.coursePriority;
      return a.isModule - b.isModule;
    });

    const blockedCourses = coursesWithUnlistenedModules.size > 0 ? Array.from(coursesWithUnlistenedModules).join(', ') : 'none';
    console.log(`[FileOrder] ${files.length} files, per-course module blocking (blocked: ${blockedCourses}), ${eligible.length} eligible`);

    return withPriority.map(w => w.file);
  }

  async function isNestSpeakerPlaying(): Promise<boolean> {
    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const resp = await fetch(`${haUrl}/api/states/${NEST_SPEAKER_ENTITY}`, {
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        return (data.state || '').toLowerCase() === 'playing';
      }
    } catch {}
    return false;
  }

  const startToothbrushPolling = () => {
    if (toothbrushPollInterval) clearInterval(toothbrushPollInterval);
    console.log(`[Toothbrush] Starting polling for sensor.toothbrush_bryn_toothbrush_state`);
    let tbPollCount = 0;
    toothbrushPollInterval = setInterval(async () => {
      tbPollCount++;
      const nestPlaying = await isNestSpeakerPlaying();
      if (!catWashPlaybackActive && !nestPlaying) {
        console.log(`[Toothbrush] Playback no longer active and Nest not playing, stopping poll (after ${tbPollCount} polls)`);
        if (toothbrushPollInterval) { clearInterval(toothbrushPollInterval); toothbrushPollInterval = null; }
        return;
      }
      try {
        const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
        const resp = await fetch(`${haUrl}/api/states/sensor.toothbrush_bryn_toothbrush_state`, {
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          const state = (data.state || '').toLowerCase();
          if (tbPollCount <= 3 || tbPollCount % 10 === 0) {
            console.log(`[Toothbrush] Poll #${tbPollCount}: state="${data.state}" (playbackActive=${catWashPlaybackActive}, nestPlaying=${nestPlaying})`);
          }
          if (state === 'running' || state === 'brushing') {
            console.log(`[Toothbrush] State changed to "${data.state}" — stopping cat wash playback (poll #${tbPollCount})`);
            if (toothbrushPollInterval) { clearInterval(toothbrushPollInterval); toothbrushPollInterval = null; }
            
            if (catWashPlaybackActive) {
              try {
                const stopUrl = `http://localhost:${process.env.PORT || 5000}/api/webhook/cat-wash-stop`;
                await fetch(stopUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'toothbrush_poll' }) });
              } catch (e: any) {
                console.log(`[Toothbrush] Error calling stop endpoint: ${e.message}`);
              }
            } else if (nestPlaying) {
              console.log(`[Toothbrush] Nest still playing (orphaned session after deploy) — stopping Nest directly`);
              try {
                await stopNestSpeaker();
                const goodbyeText = "Stopping. Your reading position has been saved. See you next time Bryn.";
                const appUrl = DEPLOYED_APP_URL;
                const goodbyePath = await generateAndSaveTTSAudio(goodbyeText, `nest-goodbye-tb-${Date.now()}`, "echo");
                await new Promise(r => setTimeout(r, 500));
                await playOnNestSpeaker(`${appUrl}${goodbyePath}`);
              } catch (e: any) {
                console.log(`[Toothbrush] Error stopping orphaned Nest playback: ${e.message}`);
              }
            }
          }
        } else {
          console.log(`[Toothbrush] HA returned ${resp.status} for toothbrush state`);
        }
      } catch (e: any) {
        console.log(`[Toothbrush] Poll error: ${e.message}`);
      }
    }, 3000);
  };

  const stopToothbrushPolling = () => {
    if (toothbrushPollInterval) {
      clearInterval(toothbrushPollInterval);
      toothbrushPollInterval = null;
      console.log(`[Toothbrush] Polling stopped`);
    }
  };
  let catWashPlaybackState: {
    fileId: number;
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
    chunks: string[];
    currentWords: string[];
    wordIndex: number;
    startedAt: Date;
    chunkStartedAt: Date;
    estimatedChunkDuration: number;
    playbackMode?: 'tablet-bluetooth' | 'server-tts';
  } | null = null;

  let nestPlaybackAbort: (() => void) | null = null;
  let wordAdvanceInterval: ReturnType<typeof setInterval> | null = null;

  function startWordAdvancement() {
    stopWordAdvancement();
    wordAdvanceInterval = setInterval(() => {
      if (!catWashPlaybackState || !catWashPlaybackActive) {
        stopWordAdvancement();
        return;
      }
      const { currentWords, wordIndex, chunkStartedAt, estimatedChunkDuration } = catWashPlaybackState;
      if (currentWords.length === 0) return;
      const elapsed = Date.now() - chunkStartedAt.getTime();
      const progress = Math.min(elapsed / estimatedChunkDuration, 1);
      const newIndex = Math.min(Math.floor(progress * currentWords.length), currentWords.length - 1);
      if (newIndex !== wordIndex) {
        catWashPlaybackState.wordIndex = newIndex;
      }
    }, 200);
  }

  function stopWordAdvancement() {
    if (wordAdvanceInterval) {
      clearInterval(wordAdvanceInterval);
      wordAdvanceInterval = null;
    }
  }

  async function uploadAudioToHA(audioPath: string): Promise<string | null> {
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    try {
      const localPath = audioPath.startsWith('/') ? audioPath : `/${audioPath}`;
      const fullLocalUrl = `http://localhost:${process.env.PORT || 5000}${localPath}`;
      const audioResp = await fetch(fullLocalUrl);
      if (!audioResp.ok) {
        console.error(`[HA Upload] Failed to fetch local audio: ${audioResp.status}`);
        return null;
      }
      const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
      const fileName = `tts_${Date.now()}.mp3`;

      const boundary = `----HAUpload${Date.now()}`;
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="media_content_id"\r\n\r\nmedia-source://media_source/local/.\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      ];
      const bodyEnd = `\r\n--${boundary}--\r\n`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(bodyParts[0]),
        Buffer.from(bodyParts[1]),
        audioBuffer,
        Buffer.from(bodyEnd),
      ]);

      const uploadResp = await fetch(`${haUrl}/api/media_source/local_source/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuffer,
      });

      if (!uploadResp.ok) {
        const errText = await uploadResp.text();
        console.error(`[HA Upload] Upload failed: ${uploadResp.status} ${errText}`);
        return null;
      }
      const result = await uploadResp.json() as any;
      const mediaId = result.media_content_id || `media-source://media_source/local/./${fileName}`;
      console.log(`[HA Upload] Uploaded ${fileName} (${Math.round(audioBuffer.length / 1024)}KB) → ${mediaId}`);
      return mediaId;
    } catch (e: any) {
      console.error(`[HA Upload] Error: ${e.message}`);
      return null;
    }
  }

  async function playOnNestSpeaker(audioUrl: string, maxRetries: number = 2): Promise<{ success: boolean; actuallyPlaying: boolean }> {
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${DEPLOYED_APP_URL}${audioUrl}`;
    console.log(`[Nest] Playing audio: ${fullUrl}`);
    try {
      await haServiceCall('media_player/play_media', {
        entity_id: NEST_SPEAKER_ENTITY, media_content_id: fullUrl, media_content_type: "music"
      }, 'Nest Play Direct');
    } catch (e: any) {
      console.error(`[Nest] play_media failed: ${e.message}`);
      return { success: false, actuallyPlaying: false };
    }
    for (let check = 0; check <= maxRetries; check++) {
      await new Promise(r => setTimeout(r, check === 0 ? 4000 : 3000));
      try {
        const { state: speakerState } = await getNestMediaState();
        console.log(`[Nest] Speaker state check ${check + 1}: ${speakerState}`);
        if (speakerState === 'playing' || speakerState === 'buffering') {
          return { success: true, actuallyPlaying: true };
        }
        if (speakerState === 'unknown') {
          console.log(`[Nest] State is "unknown" — assuming play_media succeeded`);
          return { success: true, actuallyPlaying: false };
        }
        if (check === maxRetries) {
          console.log(`[Nest] State "${speakerState}" after ${maxRetries + 1} checks — play_media was sent, assuming it played`);
          return { success: true, actuallyPlaying: false };
        }
        console.log(`[Nest] State "${speakerState}" — rechecking...`);
      } catch (e: any) {
        console.warn(`[Nest] State check error: ${e.message} — assuming play_media succeeded`);
        return { success: true, actuallyPlaying: false };
      }
    }
    return { success: true, actuallyPlaying: false };
  }

  async function playChunkViaHACloudTTS(chunkText: string, sessionId: number, speakerEntity: string = CAT_WR_HA_VOICE_ENTITY): Promise<boolean> {
    const MAX_TTS_CHARS = 3500;
    const textToSpeak = chunkText.length > MAX_TTS_CHARS ? chunkText.substring(0, MAX_TTS_CHARS) : chunkText;
    try {
      await haServiceCall('tts/speak', {
        entity_id: HA_CLOUD_TTS_ENTITY,
        media_player_entity_id: speakerEntity,
        message: textToSpeak
      }, 'Chunk HA Cloud TTS');
      console.log(`[HA Cloud TTS] Playing chunk (${textToSpeak.length} chars) on ${speakerEntity}`);
      const wordCount = textToSpeak.split(/\s+/).length;
      const estimatedMs = Math.max(5000, (wordCount / 155) * 60 * 1000 + 2000);
      console.log(`[HA Cloud TTS] Waiting ~${Math.round(estimatedMs / 1000)}s for chunk to finish`);
      const ABORT_CHECK_MS = 2000;
      for (let waited = 0; waited < estimatedMs; waited += ABORT_CHECK_MS) {
        if (!catWashPlaybackActive || catWashSessionId !== sessionId) {
          console.log(`[HA Cloud TTS] Abort detected during wait`);
          await haServiceCallSafe('media_player/media_stop', { entity_id: speakerEntity }, 'HA Voice Abort Stop');
          return false;
        }
        await new Promise(r => setTimeout(r, ABORT_CHECK_MS));
      }
      return true;
    } catch (e: any) {
      console.error(`[HA Cloud TTS] Failed: ${e.message}`);
      return false;
    }
  }

  async function playChunkViaEchoTTS(chunkText: string, sessionId: number): Promise<boolean> {
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    const MAX_ALEXA_CHARS = 3000;
    const textToSpeak = chunkText.length > MAX_ALEXA_CHARS ? chunkText.substring(0, MAX_ALEXA_CHARS) : chunkText;
    const ssmlContent = `<speak><prosody rate="90%">${textToSpeak.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;
    try {
      const resp = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: ssmlContent,
          target: [
            "media_player.echo_cat_left_am",
            "media_player.echo_cat_right_am",
            "media_player.echo_cat_washroom_middle",
          ],
          data: { type: "tts" },
        }),
      });
      if (!resp.ok) {
        console.error(`[Echo TTS] alexa_media failed: ${resp.status}`);
        return false;
      }
      console.log(`[Echo TTS] Playing chunk (${textToSpeak.length} chars) on Echo washroom speakers`);
      const wordCount = textToSpeak.split(/\s+/).length;
      const estimatedMs = Math.max(5000, (wordCount / 155) * 60 * 1000 + 2000);
      console.log(`[Echo TTS] Waiting ~${Math.round(estimatedMs / 1000)}s for chunk to finish`);
      const ABORT_CHECK_MS = 2000;
      for (let waited = 0; waited < estimatedMs; waited += ABORT_CHECK_MS) {
        if (!catWashPlaybackActive || catWashSessionId !== sessionId) {
          console.log(`[Echo TTS] Abort detected during wait`);
          return false;
        }
        await new Promise(r => setTimeout(r, ABORT_CHECK_MS));
      }
      return true;
    } catch (e: any) {
      console.error(`[Echo TTS] Failed: ${e.message}`);
      return false;
    }
  }

  async function promptFallbackSwitch(sessionId: number, fallbackName: string, promptMessage: string): Promise<boolean> {
    console.log(`[${fallbackName} Fallback] Prompting user`);
    try {
      await haServiceCallSafe('media_player/volume_set', { entity_id: CAT_WR_HA_VOICE_ENTITY, volume_level: 0.35 }, 'Fallback Vol');
      await haServiceCallSafe('input_boolean/turn_off', { entity_id: MODULE_READING_CONFIRMED }, 'Fallback Bool Reset');
      await haServiceCall('tts/speak', {
        entity_id: HA_CLOUD_TTS_ENTITY,
        media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
        message: promptMessage
      }, 'Fallback Prompt TTS');
      console.log(`[${fallbackName} Fallback] Prompt sent, waiting for confirmation (up to 30s)`);
      const POLL_MS = 1500;
      const MAX_WAIT_MS = 30000;
      for (let waited = 0; waited < MAX_WAIT_MS; waited += POLL_MS) {
        if (!catWashPlaybackActive || catWashSessionId !== sessionId) {
          console.log(`[${fallbackName} Fallback] Session aborted during wait`);
          return false;
        }
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const resp = await haFetch(`${haUrl}/api/states/${MODULE_READING_CONFIRMED}`, {
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
          }, 2, 'Fallback Confirm Check');
          const data = await resp.json();
          if (data.state === 'on') {
            console.log(`[${fallbackName} Fallback] User confirmed — switching to ${fallbackName} playback`);
            return true;
          }
        } catch {}
        await new Promise(r => setTimeout(r, POLL_MS));
      }
      console.log(`[${fallbackName} Fallback] No confirmation received within ${MAX_WAIT_MS / 1000}s`);
      return false;
    } catch (e: any) {
      console.error(`[${fallbackName} Fallback] Error: ${e.message}`);
      return false;
    }
  }

  async function stopNestSpeaker(): Promise<void> {
    try {
      await haServiceCall('media_player/media_stop', { entity_id: NEST_SPEAKER_ENTITY }, 'Nest Stop');
      console.log(`[Nest] Stopped playback`);
    } catch (e: any) {
      console.error(`[Nest] Error stopping: ${e.message}`);
    }
  }

  async function getNestMediaState(): Promise<{ state: string; position?: number; duration?: number }> {
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    try {
      const resp = await haFetch(`${haUrl}/api/states/${NEST_SPEAKER_ENTITY}`, {
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` },
      }, 2, 'Nest State');
      const data = await resp.json();
      const result = {
        state: data.state,
        position: data.attributes?.media_position,
        duration: data.attributes?.media_duration,
      };
      console.log(`[Nest State] entity=${NEST_SPEAKER_ENTITY} state=${data.state} media_title=${data.attributes?.media_title || 'none'}`);
      return result;
    } catch (e: any) {
      console.warn(`[Nest State] Failed to query: ${e.message}`);
    }
    return { state: 'unknown' };
  }

  async function waitForNestPlaybackEnd(estimatedMs: number, sessionId: number): Promise<boolean> {
    const startTime = Date.now();
    const ABORT_CHECK_MS = 2000;
    const timerWaitMs = estimatedMs + 1000;

    for (let waited = 0; waited < timerWaitMs; waited += ABORT_CHECK_MS) {
      if (!catWashPlaybackActive || catWashSessionId !== sessionId) {
        console.log(`[Nest] Abort detected during timer wait (${Math.round(waited / 1000)}s in)`);
        return false;
      }
      await new Promise(r => setTimeout(r, ABORT_CHECK_MS));
    }

    if (!haHealth.connected) {
      console.log(`[Nest] Timer done (${Math.round(estimatedMs / 1000)}s). HA offline — trusting timer, moving to next chunk`);
      return true;
    }

    const HA_CHECK_INTERVAL_MS = 2000;
    const maxExtraWait = 15000;

    for (let extra = 0; extra < maxExtraWait; extra += HA_CHECK_INTERVAL_MS) {
      if (!catWashPlaybackActive || catWashSessionId !== sessionId) return false;
      try {
        const state = await getNestMediaState();
        if (state.state === 'idle' || state.state === 'off' || state.state === 'paused') {
          console.log(`[Nest] Chunk confirmed done via HA (${Math.round((Date.now() - startTime) / 1000)}s total)`);
          return true;
        }
      } catch {
        console.log(`[Nest] HA state check failed — trusting timer`);
        return true;
      }
      await new Promise(r => setTimeout(r, HA_CHECK_INTERVAL_MS));
    }
    console.log(`[Nest] Timer + HA check window elapsed (${Math.round((Date.now() - startTime) / 1000)}s) — moving to next chunk`);
    return true;
  }

  async function startNestChunkPlayback(
    fileId: number,
    fileName: string,
    chunks: string[],
    startChunk: number,
    sessionId: number,
    voice: string = "echo",
    preGeneratedFirstChunkPath: string | null = null
  ) {
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    const appUrl = DEPLOYED_APP_URL;
    let aborted = false;
    nestPlaybackAbort = () => { aborted = true; };

    console.log(`[Nest Playback] Starting session ${sessionId}: "${fileName}" from chunk ${startChunk}/${chunks.length}`);

    try {
      if (chunks.length === 0) {
        console.log(`[Nest Playback] No chunks for "${fileName}" (id=${fileId}) — text extraction failed, marking listened and skipping`);
        await clearPlaybackSession();
        try {
          await storage.updateFile(fileId, { listened: true });
          console.log(`[Nest Playback] Marked file ${fileId} as listened (extraction failed)`);
        } catch (e: any) {
          console.error(`[Nest Playback] Failed to mark file ${fileId} listened: ${e.message}`);
        }
        try {
          const allFiles = await storage.getFiles();
          const semesterSettings = await storage.getActiveSemesterSettings();
          const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
          const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
          const currentWeekNumber = getWeekNumber(torontoDate(), semStart, rwStart);

          const unlistenedFiles = allFiles.filter((f: any) => {
            if (f.listened || f.id === fileId) return false;
            const weekMatch = f.folder?.match(/week-(\d+)/i);
            if (weekMatch) return parseInt(weekMatch[1], 10) === currentWeekNumber;
            return false;
          });

          const isModule = (f: any) => f.folder?.toLowerCase().includes('module') || f.originalName?.toLowerCase().includes('module');
          const isCPPA = (f: any) => f.folder?.toLowerCase().includes('cppa') || f.originalName?.toLowerCase().includes('cppa');
          const cppaModules = unlistenedFiles.filter((f: any) => isCPPA(f) && isModule(f));
          const otherFiles = unlistenedFiles.filter((f: any) => !(isCPPA(f) && isModule(f)));
          const orderedFiles = [...cppaModules, ...otherFiles];

          if (orderedFiles.length > 0) {
            const nextFile = orderedFiles[0];
            console.log(`[Nest Playback] Skipping to next file: ${nextFile.displayName || nextFile.originalName} (id=${nextFile.id})`);
            const nextText = await extractFileText(nextFile);
            if (nextText) {
              const nextChunks = chunkTextForNest(nextText);
              if (nextChunks.length > 0) {
                catWashPlaybackState = {
                  fileId: nextFile.id,
                  fileName: nextFile.displayName || nextFile.originalName,
                  chunkIndex: 0,
                  totalChunks: nextChunks.length,
                  chunks: nextChunks,
                  currentWords: [],
                  wordIndex: 0,
                  startedAt: new Date(),
                  chunkStartedAt: new Date(),
                };
                const nextName = nextFile.displayName || nextFile.originalName;
                await savePlaybackSession({
                  fileId: nextFile.id,
                  fileName: nextName,
                  chunkIndex: 0,
                  totalChunks: nextChunks.length,
                  trigger: catWashPlaybackTrigger || 'manual',
                  startedAt: catWashPlaybackStartedAt?.toISOString() || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  status: 'active',
                });
                startNestChunkPlayback(nextFile.id, nextName, nextChunks, 0, sessionId, voice);
                return;
              }
            }
            console.log(`[Nest Playback] Next file also has no extractable text, stopping`);
          } else {
            console.log(`[Nest Playback] No more unlistened files for week ${currentWeekNumber}`);
          }
        } catch (e: any) {
          console.error(`[Nest Playback] Error finding next file: ${e.message}`);
        }
        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        catWashPlaybackState = null;
        return;
      }

      console.log(`[Nest Playback] Starting first chunk immediately`);

      let preparedAudioCache: string[] = [];
      if (fileId) {
        try {
          const fileForCache = await storage.getFile(fileId);
          if (fileForCache?.preparedAudioPaths) {
            preparedAudioCache = JSON.parse(fileForCache.preparedAudioPaths);
            console.log(`[Nest Playback] Loaded ${preparedAudioCache.filter(p => p && p.length > 0).length} pre-prepared audio chunks`);
          }
        } catch {}
      }

      let chunksPlayedSinceLastPrompt = 0;
      const ATTENTION_INTERVAL = 3;
      let lookaheadAudioPath: string | null = null;
      let lookaheadChunkIndex: number = -1;
      let lookaheadPromise: Promise<string | null> | null = null;
      let consecutivePlayFailures = 0;
      const MAX_PLAY_FAILURES = 3;

      for (let i = startChunk; i < chunks.length; i++) {
        if (aborted || !catWashPlaybackActive || catWashSessionId !== sessionId) {
          console.log(`[Nest Playback] Aborted at chunk ${i}`);
          if (fileId) {
            try { await storage.updateFile(fileId, { lastChunkIndex: i }); } catch {}
            console.log(`[Nest Playback] Saved progress on abort: chunk ${i}`);
          }
          break;
        }

        if (catWashPlaybackState) {
          catWashPlaybackState.chunkIndex = i;
          const chunkText = chunks[i] || '';
          catWashPlaybackState.currentWords = chunkText.split(/\s+/).filter((w: string) => w.length > 0);
          catWashPlaybackState.wordIndex = 0;
        }

        if (i > startChunk) {
          savePlaybackSession({
            fileId: fileId || 0,
            fileName,
            chunkIndex: i,
            totalChunks: chunks.length,
            trigger: catWashPlaybackTrigger || 'manual',
            startedAt: catWashPlaybackStartedAt?.toISOString() || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
          }).catch(() => {});
        }

        if (chunksPlayedSinceLastPrompt >= ATTENTION_INTERVAL) {
          console.log(`[Nest Playback] Attention prompt after ${chunksPlayedSinceLastPrompt} chunks`);
          const promptPath = await generateAndSaveTTSAudio("Bryn, are you paying attention?", `nest-attention-${Date.now()}`, voice);
          await playOnNestSpeaker(`${appUrl}${promptPath}`);
          await new Promise(r => setTimeout(r, 4000));
          chunksPlayedSinceLastPrompt = 0;
        }

        const chunkText = chunks[i];

        try {
          let audioPath: string;
          if (preparedAudioCache[i] && preparedAudioCache[i].length > 0) {
            audioPath = preparedAudioCache[i];
            console.log(`[Nest Playback] Using pre-prepared audio for chunk ${i + 1}/${chunks.length}`);
          } else if (i === startChunk && preGeneratedFirstChunkPath) {
            audioPath = preGeneratedFirstChunkPath;
            console.log(`[Nest Playback] Using pre-generated audio for chunk ${i + 1}/${chunks.length}`);
          } else if (lookaheadChunkIndex === i && lookaheadAudioPath) {
            audioPath = lookaheadAudioPath;
            console.log(`[Nest Playback] Using look-ahead audio for chunk ${i + 1}/${chunks.length}`);
          } else {
            if (lookaheadChunkIndex === i && lookaheadPromise) {
              console.log(`[Nest Playback] Waiting for in-flight look-ahead for chunk ${i + 1}/${chunks.length}`);
              const resolved = await lookaheadPromise;
              if (resolved) {
                audioPath = resolved;
                console.log(`[Nest Playback] Look-ahead resolved for chunk ${i + 1}/${chunks.length}`);
              } else {
                console.log(`[Nest Playback] Look-ahead failed, regenerating chunk ${i + 1}/${chunks.length} (${chunkText.length} chars)`);
                audioPath = await generateAndSaveTTSAudio(chunkText, `nest-chunk-${fileId}-${i}-${Date.now()}`, voice, true);
              }
            } else {
              console.log(`[Nest Playback] Generating chunk ${i + 1}/${chunks.length} (${chunkText.length} chars)`);
              audioPath = await generateAndSaveTTSAudio(chunkText, `nest-chunk-${fileId}-${i}-${Date.now()}`, voice, true);
            }
          }
          lookaheadAudioPath = null;
          lookaheadChunkIndex = -1;
          lookaheadPromise = null;

          const wordCount = chunkText.split(/\s+/).length;
          const estimatedMs = Math.max(5000, (wordCount / 175) * 60 * 1000 + 1000);

          if (catWashPlaybackState) {
            catWashPlaybackState.estimatedChunkDuration = estimatedMs;
          }

          let chunkPlaying = false;
          const playResult = await playOnNestSpeaker(`${appUrl}${audioPath}`);
          if (playResult.success) {
            chunkPlaying = true;
            consecutivePlayFailures = 0;
            if (!playResult.actuallyPlaying) {
              console.log(`[Nest Playback] Nest state unconfirmed for chunk ${i + 1} — trusting play_media succeeded`);
            }
          } else {
            consecutivePlayFailures++;
            console.error(`[Nest Playback] Chunk ${i + 1} play_media FAILED (${consecutivePlayFailures}/${MAX_PLAY_FAILURES})`);
          }
          if (consecutivePlayFailures >= MAX_PLAY_FAILURES) {
            if (!haHealth.connected) {
              console.warn(`[Nest Playback] HA offline — pausing playback at chunk ${i}`);
              if (fileId) { try { await storage.updateFile(fileId, { lastChunkIndex: i }); } catch {} }
              await savePlaybackSession({
                fileId: fileId || 0, fileName, chunkIndex: i, totalChunks: chunks.length,
                trigger: catWashPlaybackTrigger || 'manual',
                startedAt: catWashPlaybackStartedAt?.toISOString() || new Date().toISOString(),
                updatedAt: new Date().toISOString(), status: 'paused',
              }).catch(() => {});
              let waitedForReconnect = 0;
              const RECONNECT_TIMEOUT_MS = 5 * 60 * 1000;
              const RECONNECT_CHECK_MS = 10000;
              while (waitedForReconnect < RECONNECT_TIMEOUT_MS && catWashPlaybackActive && catWashSessionId === sessionId) {
                if (haHealth.connected) {
                  console.log(`[Nest Playback] HA reconnected after ${Math.round(waitedForReconnect / 1000)}s — resuming at chunk ${i}`);
                  consecutivePlayFailures = 0;
                  i--;
                  break;
                }
                await new Promise(r => setTimeout(r, RECONNECT_CHECK_MS));
                waitedForReconnect += RECONNECT_CHECK_MS;
              }
              if (waitedForReconnect >= RECONNECT_TIMEOUT_MS) {
                console.error(`[Nest Playback] HA still offline after ${RECONNECT_TIMEOUT_MS / 1000}s — stopping`);
                break;
              }
              continue;
            }
            console.error(`[Nest Playback] CIRCUIT BREAKER: ${MAX_PLAY_FAILURES} consecutive Nest failures — trying Echo fallback`);

            const echoConfirmed = await promptFallbackSwitch(sessionId, 'Echo',
              "Bryn, the Nest speaker encountered errors. Do you want to play your file on the Echo speakers for now?");
            if (echoConfirmed && catWashPlaybackActive && catWashSessionId === sessionId) {
              console.log(`[Echo Fallback] User confirmed — playing remaining chunks via Echo TTS`);
              let echoFailures = 0;
              for (let ei = i; ei < chunks.length; ei++) {
                if (!catWashPlaybackActive || catWashSessionId !== sessionId) break;
                if (catWashPlaybackState) {
                  catWashPlaybackState.chunkIndex = ei;
                }
                const ok = await playChunkViaEchoTTS(chunks[ei], sessionId);
                if (!ok) {
                  if (!catWashPlaybackActive || catWashSessionId !== sessionId) break;
                  echoFailures++;
                  if (echoFailures >= 3) {
                    console.error(`[Echo Fallback] 3 consecutive Echo failures — trying HA Voice`);
                    break;
                  }
                  continue;
                }
                echoFailures = 0;
                if (fileId) {
                  try { await storage.updateFile(fileId, { lastChunkIndex: ei }); } catch {}
                }
              }
              if (echoFailures < 3) break;
            }

            if (!catWashPlaybackActive || catWashSessionId !== sessionId) break;

            const haVoiceConfirmed = await promptFallbackSwitch(sessionId, 'HA Voice',
              "Bryn, all other voice software encountered errors. Do you want to play your file here on Home Assistant Voice for now?");
            if (haVoiceConfirmed && catWashPlaybackActive && catWashSessionId === sessionId) {
              console.log(`[HA Voice Fallback] User confirmed — playing remaining chunks via HA Cloud TTS`);
              for (let hi = i; hi < chunks.length; hi++) {
                if (!catWashPlaybackActive || catWashSessionId !== sessionId) break;
                if (catWashPlaybackState) {
                  catWashPlaybackState.chunkIndex = hi;
                }
                const ok = await playChunkViaHACloudTTS(chunks[hi], sessionId);
                if (!ok) {
                  if (!catWashPlaybackActive || catWashSessionId !== sessionId) break;
                  continue;
                }
                if (fileId) {
                  try { await storage.updateFile(fileId, { lastChunkIndex: hi }); } catch {}
                }
              }
            } else {
              console.log(`[Fallback] No fallback confirmed — stopping playback`);
              haServiceCallSafe('tts/speak', {
                entity_id: HA_CLOUD_TTS_ENTITY,
                media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
                message: "Stopping. Your position has been saved."
              }, 'Error TTS');
            }
            break;
          }
          if (!chunkPlaying) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          if (catWashPlaybackState) {
            catWashPlaybackState.chunkStartedAt = new Date(Date.now() + 500);
            catWashPlaybackState.wordIndex = 0;
          }
          startWordAdvancement();
          console.log(`[Nest Playback] Playing chunk ${i + 1}, ~${Math.round(estimatedMs / 1000)}s`);

          const nextIdx = i + 1;
          if (nextIdx < chunks.length && !(preparedAudioCache[nextIdx] && preparedAudioCache[nextIdx].length > 0)) {
            console.log(`[Nest Playback] Look-ahead: pre-generating chunk ${nextIdx + 1}/${chunks.length} in background`);
            lookaheadChunkIndex = nextIdx;
            lookaheadPromise = generateAndSaveTTSAudio(chunks[nextIdx], `nest-chunk-${fileId}-${nextIdx}-${Date.now()}`, voice, true)
              .then(path => { lookaheadAudioPath = path; return path; })
              .catch(err => { console.log(`[Nest Playback] Look-ahead generation failed for chunk ${nextIdx + 1}: ${err.message}`); return null; });
          }

          const completed = await waitForNestPlaybackEnd(estimatedMs, sessionId);
          if (!completed) {
            console.log(`[Nest Playback] Session ended during chunk ${i + 1}`);
            if (fileId) {
              try { await storage.updateFile(fileId, { lastChunkIndex: i }); } catch {}
              console.log(`[Nest Playback] Saved progress on session end: chunk ${i}`);
            }
            break;
          }

          chunksPlayedSinceLastPrompt++;
          console.log(`[Nest Playback] Chunk ${i + 1} done, chunksPlayedSinceLastPrompt=${chunksPlayedSinceLastPrompt}`);

          if (fileId) {
            const existingFile = await storage.getFile(fileId);
            let currentChecked: number[] = [];
            if (existingFile?.checkedChunks) {
              try { currentChecked = JSON.parse(existingFile.checkedChunks); } catch {}
            }
            if (!currentChecked.includes(i)) {
              currentChecked.push(i);
              currentChecked.sort((a, b) => a - b);
            }
            try {
              await storage.updateFile(fileId, {
                lastChunkIndex: i,
                checkedChunks: JSON.stringify(currentChecked),
              });
              console.log(`[Nest Playback] Saved chunk ${i} as checked (${currentChecked.length}/${chunks.length} total)`);
            } catch {}
          }
        } catch (chunkErr: any) {
          console.error(`[Nest Playback] Error on chunk ${i + 1}: ${chunkErr.message}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!aborted && catWashPlaybackActive && catWashSessionId === sessionId) {
        console.log(`[Nest Playback] All chunks complete for "${fileName}"`);
        const allChecked = Array.from({ length: chunks.length }, (_, i) => i);
        try { await storage.updateFile(fileId, { listened: true, lastChunkIndex: chunks.length, checkedChunks: JSON.stringify(allChecked) }); } catch {}

        const semesterSettings = await storage.getActiveSemesterSettings();
        const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
        const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
        const currentWeekNumber = getWeekNumber(torontoDate(), semStart, rwStart);
        const completedFileDesc = describeFileForTTS({ folder: catWashPlaybackState?.fileName || fileName, originalName: fileName }, currentWeekNumber);

        const allFilesNow = await storage.getFiles();
        const nextFile = findNextFileByPriority(allFilesNow, currentWeekNumber, fileId);

        if (nextFile) {
          const nextFileDesc = describeFileForTTS(nextFile, currentWeekNumber);
          const transitionText = `${completedFileDesc} is complete. Now playing ${nextFileDesc}.`;
          console.log(`[Nest Playback] Transition: "${transitionText}"`);
          const transitionPath = await generateAndSaveTTSAudio(transitionText, `nest-transition-${Date.now()}`, voice);
          await playOnNestSpeaker(`${appUrl}${transitionPath}`);
          await new Promise(r => setTimeout(r, 6000));

          const nextText = await extractFileText(nextFile);
          if (nextText) {
            const nextChunks = chunkTextForNest(nextText);
            if (nextChunks.length > 0) {
              const nextName = nextFile.displayName || nextFile.originalName;
              console.log(`[Nest Playback] Starting next file: "${nextName}" (${nextChunks.length} chunks)`);
              catWashPlaybackState = {
                fileId: nextFile.id,
                fileName: nextName,
                chunkIndex: 0,
                totalChunks: nextChunks.length,
                chunks: nextChunks,
                currentWords: [],
                wordIndex: 0,
                startedAt: new Date(),
                chunkStartedAt: new Date(),
                estimatedChunkDuration: 0,
                playbackMode: 'server-tts',
              };
              await savePlaybackSession({
                fileId: nextFile.id,
                fileName: nextName,
                chunkIndex: 0,
                totalChunks: nextChunks.length,
                trigger: catWashPlaybackTrigger || 'manual',
                startedAt: catWashPlaybackStartedAt?.toISOString() || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active',
              });
              startNestChunkPlayback(nextFile.id, nextName, nextChunks, 0, sessionId, voice);
              return;
            } else {
              console.error(`[Nest Playback] Next file "${nextFile.displayName || nextFile.originalName}" produced 0 chunks after splitting`);
            }
          } else {
            console.error(`[Nest Playback] Failed to extract text from next file "${nextFile.displayName || nextFile.originalName}" (id: ${nextFile.id})`);
          }
        }

        const completionPath = await generateAndSaveTTSAudio("All readings for this week are complete. Great job Bryn.", `nest-complete-${Date.now()}`, voice);
        await playOnNestSpeaker(`${appUrl}${completionPath}`);
        await clearPlaybackSession();
        console.log(`[Nest Playback] All readings complete — cleared persisted session`);
      }

    } catch (err: any) {
      console.error(`[Nest Playback] Fatal error: ${err.message}`, err.stack?.split('\n').slice(0, 3).join(' | '));
      try {
        await haServiceCall('tts/speak', {
          entity_id: HA_CLOUD_TTS_ENTITY,
          media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
          message: "Sorry, playback encountered an error and stopped."
        }, 'Fatal Error TTS');
      } catch {}
    } finally {
      if (catWashSessionId === sessionId) {
        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        catWashPlaybackState = null;
        nestPlaybackAbort = null;
        stopToothbrushPolling();
        stopWordAdvancement();
      }
      audioPreparationPaused = false;
      console.log(`[Nest Playback] Resumed audio preparation`);
    }
  }

  function chunkTextForNest(text: string, maxLength: number = 1500): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 > maxLength && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += (current ? ' ' : '') + sentence;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(c => c.length > 10);
  }

  async function extractFileText(file: any): Promise<string | null> {
    try {
      if (file.extractedText) {
        console.log(`[ExtractText] Using cached text for ${file.originalName} (${file.extractedText.length} chars)`);
        return file.extractedText;
      }

      let buffer: Buffer | null = null;

      if (file.objectPath?.startsWith('/School/')) {
        console.log(`[ExtractText] Downloading from OneDrive path: ${file.objectPath}`);
        const { getOneDriveClient } = await import("./onedrive");
        const client = await getOneDriveClient();
        const encodedPath = encodeURIComponent(file.objectPath).replace(/%2F/g, '/');
        const item = await client.api(`/me/drive/root:${encodedPath}`).get();
        const downloadUrl = item['@microsoft.graph.downloadUrl'];
        if (!downloadUrl) {
          console.error(`[ExtractText] No download URL from OneDrive for: ${file.objectPath}`);
          return null;
        }
        const pdfResponse = await fetch(downloadUrl);
        if (!pdfResponse.ok) {
          console.error(`[ExtractText] OneDrive download failed: ${pdfResponse.status}`);
          return null;
        }
        buffer = Buffer.from(await pdfResponse.arrayBuffer());
        console.log(`[ExtractText] Downloaded ${buffer.length} bytes from OneDrive`);
      } else if (file.objectPath) {
        try {
          const { ObjectStorageService } = await import("./replit_integrations/object_storage");
          const objectStorage = new ObjectStorageService();
          const foundFile = await objectStorage.getObjectEntityFile(file.objectPath);
          if (foundFile) {
            const chunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
              const stream = foundFile.createReadStream();
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.on('end', () => resolve());
              stream.on('error', (err: Error) => reject(err));
            });
            buffer = Buffer.concat(chunks);
            console.log(`[ExtractText] Downloaded ${buffer.length} bytes from object storage`);
          } else {
            console.error(`[ExtractText] File not found in object storage: ${file.objectPath}`);
          }
        } catch (osErr: any) {
          console.error(`[ExtractText] Object storage download error: ${osErr.message}`);
        }
      }

      if (!buffer) return null;
      const PdfParser = await getPdfParser();
      const parser = new PdfParser({ data: new Uint8Array(buffer), verbosity: 0 });
      await parser.load();
      const pdfText = await parser.getText();
      let textContent = '';
      if (pdfText && typeof pdfText === 'object') {
        if (pdfText.pages && Array.isArray(pdfText.pages)) {
          textContent = pdfText.pages.map((p: any) => p.text || '').join('\n\n');
        } else if (pdfText.text) {
          textContent = pdfText.text;
        }
      } else if (typeof pdfText === 'string') {
        textContent = pdfText;
      }
      console.log(`[ExtractText] Extracted ${textContent.length} chars from ${file.originalName}`);
      const cleanedText = cleanTextForTTS(textContent);

      if (cleanedText && file.id) {
        try {
          await storage.updateFile(file.id, { extractedText: cleanedText });
          console.log(`[ExtractText] Cached ${cleanedText.length} chars for file ${file.id}`);
        } catch (cacheErr: any) {
          console.error(`[ExtractText] Failed to cache text: ${cacheErr.message}`);
        }
      }

      return cleanedText;
    } catch (e: any) {
      console.error(`[ExtractText] Error for ${file.originalName}: ${e.message}`);
      return null;
    }
  }

  let voiceCommandPauseState_: {
    fileId: number;
    chunkIndex: number;
    fileName: string;
    pausedAt: Date;
    autoStopTimer: ReturnType<typeof setTimeout>;
  } | null = null;

  function clearVoiceCommandPause_() {
    if (voiceCommandPauseState_) {
      clearTimeout(voiceCommandPauseState_.autoStopTimer);
      voiceCommandPauseState_ = null;
    }
  }

  async function stopNestPlaybackWithGoodbye(reason: string, keepOpen: boolean = false): Promise<void> {
    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    const appUrl = DEPLOYED_APP_URL;

    clearVoiceCommandPause_();

    if (nestPlaybackAbort) {
      nestPlaybackAbort();
      nestPlaybackAbort = null;
    }

    await Promise.allSettled([
      stopNestSpeaker(),
      haServiceCallSafe('media_player/media_stop', { entity_id: CAT_WR_HA_VOICE_ENTITY }, 'Stop HA Voice'),
    ]);

    let fileName = catWashPlaybackState?.fileName || '';
    const savedFileId = catWashPlaybackState?.fileId;
    const savedChunk = catWashPlaybackState?.chunkIndex || 0;

    if (savedFileId && savedChunk > 0) {
      try {
        await storage.updateFile(savedFileId, { lastChunkIndex: savedChunk });
        console.log(`[Nest Stop] Saved progress: file ${savedFileId}, chunk ${savedChunk}`);
      } catch {}
    }

    const cleanName = fileName ? fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const goodbyeText = cleanName
      ? `Stopping. Your position has been saved. See you next time Bryn.`
      : `Stopping. Your position has been saved. See you next time Bryn.`;

    console.log(`[Nest Stop] Reason: ${reason}. Goodbye: "${goodbyeText}"`);

    try {
      await new Promise(r => setTimeout(r, 500));
      await haServiceCall('tts/speak', {
        entity_id: HA_CLOUD_TTS_ENTITY,
        media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
        message: goodbyeText
      }, 'Goodbye TTS');
      const wordCount = goodbyeText.split(/\s+/).length;
      await new Promise(r => setTimeout(r, Math.max(3000, (wordCount / 175) * 60 * 1000)));
    } catch (e: any) {
      console.error(`[Nest Stop] Error playing goodbye: ${e.message}`);
    }

    catWashPlaybackActive = false;
    catWashPlaybackStartedAt = null;
    catWashPlaybackState = null;
    nestPlaybackAbort = null;
    currentTvFollowUrl = null;
    currentTabletReaderUrl = null;
    lastPlaybackStoppedAt = Date.now();
    stopToothbrushPolling();
    stopWordAdvancement();
    await clearPlaybackSession();
    console.log(`[Nest Stop] Cleared persisted playback session`);

    const stopTimestamp = Date.now();
    await Promise.all([
      setTabletCommand({ action: 'stop_playback', goodbyeText: '', keepOpen, timestamp: stopTimestamp }, true, 'master'),
      setTabletCommand({ action: 'stop_playback', keepOpen, timestamp: stopTimestamp }, true, 'tv'),
    ]);

    await Promise.allSettled([
      haServiceCallSafe('media_player/turn_off', { entity_id: 'media_player.fire_stick_cat_wr' }, 'Nest Stop TV'),
      haServiceCallSafe('media_player/turn_off', { entity_id: 'media_player.samsung_tv' }, 'Nest Stop TV'),
    ]);
    console.log(`[Nest Stop] Fire Stick + Samsung TV turn-off sent`);
  }

  // GET /api/shower/next-reading - Get next unlistened module/reading file for current week
  app.get("/api/shower/next-reading", async (req, res) => {
    try {
      const allFiles = await storage.getFiles();
      
      // Get current week number from semester settings
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
      const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
      currentWeekNumber = getWeekNumber(torontoDate(), semStart, rwStart);
      
      // Filter for unlistened files from current week
      const unlistenedFiles = allFiles.filter(f => {
        if (f.listened) return false;
        
        // Extract week number from folder name (e.g., "week-4-cppa122-module")
        const weekMatch = f.folder?.match(/week-(\d+)/i);
        if (weekMatch) {
          const fileWeek = parseInt(weekMatch[1], 10);
          return fileWeek === currentWeekNumber;
        }
        return false;
      });
      
      const orderedFiles = orderFilesByCoursePriority(unlistenedFiles);
      
      if (orderedFiles.length === 0) {
        return res.json({ 
          message: `All modules and readings for week ${currentWeekNumber} have been listened to!`, 
          nextFile: null,
          allComplete: true,
          currentWeek: currentWeekNumber
        });
      }
      
      const nextFile = orderedFiles[0];
      
      // Check if we have progress for this file
      const progressKey = `file-${nextFile.id}`;
      const progress = playbackProgress[progressKey];
      
      const checkModule = (f: any) => 
        f.folder?.toLowerCase().includes('module') || 
        f.originalName?.toLowerCase().includes('module');
      const fileType = checkModule(nextFile) ? 'module' : 'reading';

      res.json({
        file: {
          id: nextFile.id,
          name: nextFile.displayName || nextFile.originalName,
          folder: nextFile.folder,
          objectPath: nextFile.objectPath,
          type: fileType
        },
        readerUrl: `/pdf-reader/${nextFile.id}`,
        currentWeek: currentWeekNumber,
        progress: progress || { chunkIndex: 0, totalChunks: 0 },
        resuming: !!progress
      });
    } catch (error) {
      console.error("Error getting next reading:", error);
      res.status(500).json({ error: "Failed to get next reading" });
    }
  });
  
  async function findNextCatWashFile(storageRef: any, weekNumber: number, excludeFileId?: number) {
    const allFiles = await storageRef.getFiles();
    const isModuleFile = (f: any) => f.folder?.toLowerCase().includes('module');
    const getCourseCode = (f: any) => {
      const match = f.folder?.match(/week-\d+-([a-z]+\d+)/i);
      return match ? match[1].toLowerCase() : '';
    };

    const isPartiallyListened = (f: any) => {
      if (f.listened || f.id === excludeFileId) return false;
      const hasCheckedChunks = (() => {
        if (!f.checkedChunks) return false;
        try { const arr = JSON.parse(f.checkedChunks); return Array.isArray(arr) && arr.length > 0; } catch { return false; }
      })();
      const hasLastChunk = f.lastChunkIndex != null && f.lastChunkIndex > 0;
      if (!hasCheckedChunks && !hasLastChunk) return false;
      if (f.totalChunks && f.totalChunks > 0) {
        if (hasCheckedChunks) {
          try { const arr = JSON.parse(f.checkedChunks); if (arr.length >= f.totalChunks) return false; } catch {}
        }
        if (hasLastChunk && f.lastChunkIndex >= f.totalChunks) return false;
      }
      return true;
    };

    const getFileWeek = (f: any) => {
      const weekMatch = f.folder?.match(/week-(\d+)/i);
      return weekMatch ? parseInt(weekMatch[1], 10) : -1;
    };

    const currentWeekPartials = allFiles.filter((f: any) => isPartiallyListened(f) && getFileWeek(f) === weekNumber);
    const otherWeekPartials = allFiles.filter((f: any) => isPartiallyListened(f) && getFileWeek(f) !== weekNumber);

    const allPartialIds = new Set([...currentWeekPartials, ...otherWeekPartials].map((f: any) => f.id));

    const unlistenedFiles = allFiles.filter((f: any) => {
      if (f.listened || f.id === excludeFileId) return false;
      if (allPartialIds.has(f.id)) return false;
      return getFileWeek(f) === weekNumber;
    });

    const allWeekUnlistened = allFiles.filter((f: any) => !f.listened && f.id !== excludeFileId && getFileWeek(f) === weekNumber);

    const getCourseCodeForFile = (f: any): string => {
      const folder = (f.folder || '').toLowerCase();
      const name = (f.originalName || '').toLowerCase();
      const match = folder.match(/([a-z]{3,5}\s?\d{3})/i) || name.match(/([a-z]{3,5}\s?\d{3})/i);
      return match ? match[1].toUpperCase().replace(/\s/g, '') : 'UNKNOWN';
    };

    const coursesWithUnlistenedModules = new Set<string>();
    for (const f of allWeekUnlistened) {
      if (isModuleFile(f)) {
        coursesWithUnlistenedModules.add(getCourseCodeForFile(f));
      }
    }

    const filteredUnlistened = unlistenedFiles.filter(f => {
      if (isModuleFile(f)) return true;
      return !coursesWithUnlistenedModules.has(getCourseCodeForFile(f));
    });

    const filteredPartials = currentWeekPartials.filter(f => {
      if (isModuleFile(f)) return true;
      return !coursesWithUnlistenedModules.has(getCourseCodeForFile(f));
    });

    const orderedUnlistened = [...filteredUnlistened].sort((a, b) => {
      const aPri = getCoursePriorityForFile(a);
      const bPri = getCoursePriorityForFile(b);
      if (aPri !== bPri) return aPri - bPri;
      const aModule = isModuleFile(a) ? 0 : 1;
      const bModule = isModuleFile(b) ? 0 : 1;
      return aModule - bModule;
    });

    const blockedCourses = coursesWithUnlistenedModules.size > 0 ? Array.from(coursesWithUnlistenedModules).join(', ') : 'none';
    console.log(`[CatWashFile] week=${weekNumber}, unlistened=${allWeekUnlistened.length}, per-course module blocking (blocked: ${blockedCourses})`);

    const orderedFiles = [...filteredPartials, ...orderedUnlistened];
    return orderedFiles.length > 0 ? orderedFiles[0] : null;
  }

  async function extractAndChunkPdf(file: any): Promise<{ textContent: string; chunks: string[] } | null> {
    let textContent = "";
    try {
      let content: Buffer;
      const mediaUrl = file.objectPath || '';

      if (mediaUrl.startsWith("/objects/")) {
        const { ObjectStorageService } = await import("./replit_integrations/object_storage");
        const objectStorage = new ObjectStorageService();
        const objectFile = await objectStorage.getObjectEntityFile(mediaUrl);
        const [downloaded] = await objectFile.download();
        content = downloaded;
      } else if (mediaUrl.startsWith("/School/")) {
        const { getOneDriveClient } = await import("./onedrive");
        const client = await getOneDriveClient();
        const encodedPath = encodeURIComponent(mediaUrl).replace(/%2F/g, '/');
        const item = await client.api(`/me/drive/root:${encodedPath}`).get();
        const downloadUrl = item['@microsoft.graph.downloadUrl'];
        if (!downloadUrl) throw new Error("Could not get OneDrive download URL");
        const pdfResponse = await fetch(downloadUrl);
        if (!pdfResponse.ok) throw new Error(`OneDrive download failed: ${pdfResponse.status}`);
        content = Buffer.from(await pdfResponse.arrayBuffer());
      } else if (mediaUrl.startsWith("onedrive://")) {
        const folderPart = mediaUrl.replace('onedrive://', '').split('/')[0] || '';
        const fileNamePart = mediaUrl.split('/').pop() || '';
        const parts = folderPart.split('-');
        const weekNum = parts[1];
        const courseCode = parts[2]?.toUpperCase();
        const basePath = `/School/1. TMU/Courses/2026/Winter`;
        const baseFolders = await listOneDriveItems(basePath);
        const matchedFolder = baseFolders.find((f: any) => f.type === 'folder' && f.name.toUpperCase().startsWith(courseCode));
        if (!matchedFolder) throw new Error("Course folder not found in OneDrive");
        const courseFolders = await listOneDriveItems(matchedFolder.path);
        const weekFolder = courseFolders.find((f: any) => f.type === 'folder' && f.name.toLowerCase().startsWith(`week ${weekNum}`));
        if (!weekFolder) throw new Error("Week folder not found in OneDrive");
        const weekContents = await listOneDriveItems(weekFolder.path);
        const typeFolder = weekContents.find((f: any) => f.type === 'folder' && f.name.toLowerCase().includes(folderPart.includes('reading') ? 'reading' : 'module'));
        if (!typeFolder) throw new Error("Type folder not found in OneDrive");
        const files = await listOneDriveItems(typeFolder.path);
        const matchedFile = files.find((f: any) => f.name === fileNamePart);
        if (!matchedFile?.downloadUrl) throw new Error("File not found in OneDrive");
        const pdfResponse = await fetch(matchedFile.downloadUrl);
        content = Buffer.from(await pdfResponse.arrayBuffer());
      } else if (mediaUrl.startsWith("http")) {
        const pdfResponse = await fetch(mediaUrl);
        content = Buffer.from(await pdfResponse.arrayBuffer());
      } else {
        throw new Error(`Unsupported path format: ${mediaUrl.substring(0, 50)}`);
      }

      const isPDF = content.slice(0, 4).toString() === '%PDF';
      if (isPDF) {
        const PdfParser = await getPdfParser();
        const parser = new PdfParser({ data: new Uint8Array(content), verbosity: 0 });
        await parser.load();
        const pdfText = await parser.getText();
        if (pdfText && typeof pdfText === 'object') {
          if (pdfText.pages && Array.isArray(pdfText.pages)) {
            textContent = pdfText.pages.map((page: any) => page.text || '').join(' ');
          } else if (Array.isArray(pdfText)) {
            textContent = pdfText.map((item: any) => typeof item === 'string' ? item : item.text || '').join(' ');
          } else if (pdfText.text) {
            textContent = pdfText.text;
          }
        } else {
          textContent = String(pdfText || '');
        }
        await parser.destroy();
      } else {
        textContent = content.toString('utf-8');
      }
    } catch (error: any) {
      console.error(`[Cat Wash] Text extraction error for ${file.id}:`, error.message);
      return null;
    }

    let cleanedContent = textContent.trim().replace(/[^\x20-\x7E\n]/g, ' ');
    if (cleanedContent.length < 10) return null;

    const paragraphs = cleanedContent.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
    const maxLen = 4000;
    const chunks: string[] = [];

    if (paragraphs.length > 1) {
      let currentChunk = "";
      for (const para of paragraphs) {
        if (para.length > maxLen) {
          if (currentChunk) { chunks.push(currentChunk.trim()); currentChunk = ""; }
          let remaining = para;
          while (remaining.length > 0) {
            if (remaining.length <= maxLen) { chunks.push(remaining); break; }
            let splitAt = remaining.lastIndexOf('. ', maxLen);
            if (splitAt < 500) splitAt = remaining.lastIndexOf(' ', maxLen);
            if (splitAt < 300) splitAt = maxLen;
            chunks.push(remaining.slice(0, splitAt + 1).trim());
            remaining = remaining.slice(splitAt + 1).trim();
          }
        } else if ((currentChunk + "\n\n" + para).length > maxLen) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = para;
        } else {
          currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());
    } else {
      let remaining = cleanedContent.replace(/\s+/g, ' ');
      while (remaining.length > 0) {
        if (remaining.length <= maxLen) { chunks.push(remaining); break; }
        let splitAt = remaining.lastIndexOf('. ', maxLen);
        if (splitAt < 500) splitAt = remaining.lastIndexOf(' ', maxLen);
        if (splitAt < 300) splitAt = maxLen;
        chunks.push(remaining.slice(0, splitAt + 1).trim());
        remaining = remaining.slice(splitAt + 1).trim();
      }
    }

    return { textContent: cleanedContent, chunks };
  }

  async function openUrlOnFireDevice(haUrl: string, browserIds: string[], url: string, deviceName: string): Promise<boolean> {
    const results: string[] = [];

    const urlObj = new URL(url);
    const navigatePath = `${urlObj.pathname}${urlObj.search}`;
    const intentUri = `intent://${urlObj.host}${urlObj.pathname}${urlObj.search}#Intent;scheme=https;package=com.amazon.cloud9;launchFlags=0x14008000;end`;

    const bustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const directNavCode = `window.location.replace('${bustUrl}');`;

    const intentCode = `
var a = document.createElement('a');
a.href = '${intentUri}';
a.style.display = 'none';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
`;

    for (const browserId of browserIds) {
      try {
        const resp = await fetch(`${haUrl}/api/services/browser_mod/javascript`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ browser_id: browserId, code: directNavCode }),
        });
        const body = await resp.text();
        console.log(`[Device] ${deviceName} → browser_mod.javascript/direct_nav (${browserId}): ${resp.status} body=${body.substring(0, 200)}`);
        const bodyEmpty = body.trim() === '[]' || body.trim() === '';
        if (resp.ok && !bodyEmpty) {
          results.push(`${browserId}:direct_nav:${resp.status}`);
          console.log(`[Device] ${deviceName} results: [${results.join(', ')}] success=true (direct nav)`);
          return true;
        }
        if (bodyEmpty) {
          console.log(`[Device] ${deviceName} → browser_mod returned empty (browser not connected)`);
        }
        results.push(`${browserId}:direct_nav:${resp.status}:${bodyEmpty ? 'no_browser' : 'ok'}`);
      } catch (e: any) {
        console.log(`[Device] ${deviceName} → browser_mod.javascript/direct_nav (${browserId}) ERROR: ${e.message}`);
        results.push(`${browserId}:direct_nav:error`);
      }

      try {
        const resp = await fetch(`${haUrl}/api/services/browser_mod/javascript`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ browser_id: browserId, code: intentCode }),
        });
        const body = await resp.text();
        console.log(`[Device] ${deviceName} → browser_mod.javascript/silk_intent (${browserId}): ${resp.status} body=${body.substring(0, 200)}`);
        const bodyEmpty = body.trim() === '[]' || body.trim() === '';
        if (resp.ok && !bodyEmpty) {
          results.push(`${browserId}:silk_intent:${resp.status}`);
          console.log(`[Device] ${deviceName} results: [${results.join(', ')}] success=true (intent fallback)`);
          return true;
        }
        results.push(`${browserId}:silk_intent:${resp.status}:${bodyEmpty ? 'no_browser' : 'ok'}`);
      } catch (e: any) {
        console.log(`[Device] ${deviceName} → browser_mod.javascript/silk_intent (${browserId}) ERROR: ${e.message}`);
        results.push(`${browserId}:silk_intent:error`);
      }
    }

    console.log(`[Device] ${deviceName} results: [${results.join(', ')}] success=false`);
    return false;
  }

  // Helper to open URL on Fire Stick via androidtv integration
  async function openUrlOnFireStick(haUrl: string, entityId: string, url: string): Promise<boolean> {
    console.log(`[Cat Wash] ====== openUrlOnFireStick START (${entityId}) ======`);

    for (let wakeAttempt = 1; wakeAttempt <= 2; wakeAttempt++) {
      try {
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'input keyevent KEYCODE_WAKEUP' }, `FireStick Wake ${wakeAttempt}`);
        console.log(`[Cat Wash] Fire Stick WAKEUP sent (attempt ${wakeAttempt})`);
        break;
      } catch (e: any) {
        console.log(`[Cat Wash] Fire Stick WAKEUP attempt ${wakeAttempt} failed: ${e.message}`);
        if (wakeAttempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 4000));

    try {
      await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'input keyevent KEYCODE_HOME' }, 'FireStick Home');
      console.log(`[Cat Wash] Fire Stick HOME sent`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e: any) {
      console.log(`[Cat Wash] Fire Stick HOME failed: ${e.message}`);
    }

    try {
      await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'am force-stop com.amazon.cloud9' }, 'FireStick Kill Silk');
      console.log(`[Cat Wash] Fire Stick force-stopped Silk`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e: any) {
      console.log(`[Cat Wash] Fire Stick force-stop Silk failed: ${e.message}`);
    }

    currentTvFollowUrl = url;
    const appUrl = DEPLOYED_APP_URL;
    const redirectUrl = `${appUrl}/api/cat-wash/tv-follow`;
    console.log(`[Cat Wash] TV redirect URL stored. Opening: ${redirectUrl}`);
    console.log(`[Cat Wash] TV will redirect to: ${url}`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const adbCmd = `am start --activity-clear-task -a android.intent.action.VIEW -d "${redirectUrl}" com.amazon.cloud9`;
        await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: adbCmd }, `FireStick Open URL ${attempt}`);
        console.log(`[Cat Wash] Fire Stick URL opened (attempt ${attempt})`);

        const sendFullscreenCmds = async (fAttempt: number) => {
          try {
            await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'settings put global policy_control immersive.full=com.amazon.cloud9' }, `FireStick Immersive ${fAttempt}`);
            console.log(`[Cat Wash] Fire Stick immersive mode set (attempt ${fAttempt})`);
          } catch (e: any) {
            console.log(`[Cat Wash] Fire Stick immersive ${fAttempt} failed: ${e.message}`);
          }
          try {
            await haServiceCall('androidtv/adb_command', { entity_id: entityId, command: 'input keyevent KEYCODE_DPAD_CENTER' }, `FireStick DPAD ${fAttempt}`);
            console.log(`[Cat Wash] Fire Stick DPAD_CENTER sent (attempt ${fAttempt})`);
          } catch (e: any) {
            console.log(`[Cat Wash] Fire Stick DPAD ${fAttempt} failed: ${e.message}`);
          }
        };

        setTimeout(() => sendFullscreenCmds(1), 5000);
        setTimeout(() => sendFullscreenCmds(2), 12000);
        setTimeout(() => sendFullscreenCmds(3), 20000);

        console.log(`[Cat Wash] ====== openUrlOnFireStick SUCCESS ======`);
        return true;
      } catch (e: any) {
        console.log(`[Cat Wash] Fire Stick adb_command attempt ${attempt} failed: ${e.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 4000));
      }
    }

    console.log(`[Cat Wash] All ADB attempts failed — trying play_media fallback`);
    try {
      await haServiceCall('media_player/play_media', { entity_id: entityId, media_content_id: redirectUrl, media_content_type: 'url' }, 'FireStick play_media');
      console.log(`[Cat Wash] Fire Stick play_media url succeeded`);
      return true;
    } catch (e: any) {
      console.log(`[Cat Wash] Fire Stick play_media also failed: ${e.message}`);
    }

    console.log(`[Cat Wash] ====== openUrlOnFireStick FAILED ======`);
    return false;
  }

  // playCatWashFile is no longer needed for server-side TTS.
  // The tablet handles all audio playback via browser <audio> → Bluetooth → Echo.
  // Auto-continuation is handled by the tablet calling POST /api/cat-wash/update-progress
  // with { completed: true }, which returns the next file URL for the tablet to navigate to.

  app.get("/api/webhook/status", (_req, res) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      catWashPlaybackActive,
      catWashPlaybackStartedAt,
      currentFile: catWashPlaybackState?.fileName || null,
      currentChunk: catWashPlaybackState?.chunkIndex || 0,
      totalChunks: catWashPlaybackState?.totalChunks || 0,
      endpoints: ["/api/webhook/cat-lights", "/api/webhook/cat-lights-confirm", "/api/webhook/cat-shower-button", "/api/webhook/cat-wash-stop", "/api/webhook/cat-volume", "/api/webhook/cat-knob-press", "/api/webhook/voice-command"],
    });
  });

  app.post("/api/webhook/test-tablet-open", async (req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL?.replace(/\/$/, '');
      if (!haUrl || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      const appUrl = DEPLOYED_APP_URL;
      const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');
      const testUrl = `${appUrl}/pdf-reader/139?catWashFollow=true&autoplay=true&auth=${authParam}`;
      const { device: targetDevice, method: testMethod } = req.body;

      console.log(`[TEST] ====== TABLET OPEN TEST ======`);
      console.log(`[TEST] URL: ${testUrl}`);
      console.log(`[TEST] Target device: ${targetDevice || 'all'}`);
      console.log(`[TEST] Method: ${testMethod || 'all'}`);

      await setTabletCommand({ action: 'navigate', url: testUrl, timestamp: Date.now() });

      const results: Record<string, any> = {};

      const tablets = [
        {
          name: 'tablet_cat_wall',
          browserIds: ['browser_mod_0da8b0a7_fd42ec2e'],
          notifyServices: ['mobile_app_tablet_cat', 'mobile_app_fire_tablet_cat', 'mobile_app_tablet_cat_wall'],
          mediaPlayer: 'media_player.tablet_cat',
        },
      ];

      const filteredTablets = targetDevice ? tablets.filter(t => t.name === targetDevice) : tablets;

      for (const device of filteredTablets) {
        console.log(`[TEST] --- Testing ${device.name} ---`);
        const deviceResults: Record<string, any> = {};

        if (!testMethod || testMethod === 'browser_mod') {
          const opened = await openUrlOnFireDevice(haUrl, device.browserIds, testUrl, device.name);
          deviceResults.browser_mod = opened;
        }

        if (!testMethod || testMethod === 'notify_command') {
          for (const svc of device.notifyServices) {
            try {
              const resp = await fetch(`${haUrl}/api/services/notify/${svc}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: "command_webview",
                  data: { url: testUrl },
                }),
              });
              const body = await resp.text();
              console.log(`[TEST] ${device.name} notify/${svc} command_webview: ${resp.status} body=${body.substring(0, 200)}`);
              deviceResults[`notify_${svc}_webview`] = resp.ok;
              if (resp.ok) break;
            } catch (e: any) {
              console.log(`[TEST] ${device.name} notify/${svc} ERROR: ${e.message}`);
              deviceResults[`notify_${svc}_webview`] = `error: ${e.message}`;
            }
          }
        }

        if (!testMethod || testMethod === 'notify_url') {
          for (const svc of device.notifyServices) {
            try {
              const resp = await fetch(`${haUrl}/api/services/notify/${svc}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: "PDF Reader",
                  message: "Opening reading...",
                  data: { clickAction: testUrl, url: testUrl, tag: "test-tablet", importance: "high", channel: "cat-wash" },
                }),
              });
              const body = await resp.text();
              console.log(`[TEST] ${device.name} notify/${svc} url notification: ${resp.status} body=${body.substring(0, 200)}`);
              deviceResults[`notify_${svc}_url`] = resp.ok;
              if (resp.ok) break;
            } catch (e: any) {
              deviceResults[`notify_${svc}_url`] = `error: ${e.message}`;
            }
          }
        }

        if (!testMethod || testMethod === 'play_media') {
          try {
            const resp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: device.mediaPlayer, media_content_id: testUrl, media_content_type: 'url' }),
            });
            const body = await resp.text();
            console.log(`[TEST] ${device.name} play_media (${device.mediaPlayer}): ${resp.status} body=${body.substring(0, 200)}`);
            deviceResults.play_media = resp.ok;
          } catch (e: any) {
            deviceResults.play_media = `error: ${e.message}`;
          }
        }

        results[device.name] = deviceResults;
      }

      console.log(`[TEST] Results: ${JSON.stringify(results)}`);
      res.json({ action: "test_complete", url: testUrl, results });
    } catch (e: any) {
      console.error(`[TEST] Error: ${e.message}`, e.stack);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/webhook/cat-shower-button", async (req, res) => {
    try {
      console.log(`[Shower Button] ====== WEBHOOK TRIGGERED ======`);
      console.log(`[Shower Button] Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })}`);

      const timeSinceStart = Date.now() - SERVER_START_TIME;
      if (timeSinceStart < SERVER_STARTUP_COOLDOWN_MS) {
        console.log(`[Shower Button] Ignoring — server started ${Math.round(timeSinceStart / 1000)}s ago (cooldown)`);
        return res.json({ action: "ignored", reason: "Server startup cooldown" });
      }

      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

      if (catWashPlaybackActive) {
        console.log(`[Shower Button] Playback already active — letting it continue (button is toggling shower/fan off)`);
        return res.json({ action: "skipped", reason: "Playback already active — not interrupting" });
      }

      if (catLightsPromptPending) {
        console.log(`[Shower Button] Lights prompt pending — skipping (button is toggling shower/fan off)`);
        return res.json({ action: "skipped", reason: "Prompt already pending — not interrupting" });
      }

      const today = torontoDate();
      const semesterSettings = await storage.getActiveSemesterSettings();

      if (!semesterSettings) {
        console.log(`[Shower Button] No active semester — playing CHUM FM`);
        await playChumFmRadio(haUrl);
        return res.json({ action: "radio", reason: "No active semester" });
      }

      let currentWeekNumber = 1;
      const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
      const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
      currentWeekNumber = getWeekNumber(today, semStart, rwStart);

      const allFilesBefore = await storage.getFiles();
      let nextFile = findNextFileByPriority(allFilesBefore, currentWeekNumber);

      if (!nextFile) {
        console.log(`[Shower Button] No cached files found — syncing OneDrive first`);
        await syncOneDriveFilesForWeek(semesterSettings, currentWeekNumber, '[Shower Button]');
        const allFilesAfter = await storage.getFiles();
        nextFile = findNextFileByPriority(allFilesAfter, currentWeekNumber);
      } else {
        console.log(`[Shower Button] Using cached file — syncing OneDrive in background`);
        syncOneDriveFilesForWeek(semesterSettings, currentWeekNumber, '[Shower Button]').catch(e => console.log(`[Shower Button] Background sync error: ${e.message}`));
      }

      if (!nextFile) {
        console.log(`[Shower Button] No unlistened files for week ${currentWeekNumber} — playing CHUM FM`);
        await playChumFmRadio(haUrl);
        return res.json({ action: "radio", reason: `All week ${currentWeekNumber} readings complete — playing CHUM FM 104.5` });
      }

      const fileName = nextFile.displayName || nextFile.originalName || 'Unknown file';
      const fileDesc = describeFileForTTS(nextFile, currentWeekNumber);
      console.log(`[Shower Button] Found file: ${fileDesc} — ${fileName} (id=${nextFile.id})`);

      res.json({ action: "playing", file: { id: nextFile.id, name: fileName }, currentWeek: currentWeekNumber });

      const confirmTTS = `Okay, I will now play ${fileDesc}.`;

      catWashPlaybackTrigger = 'button';
      await startConfirmedPlaybackFlow(nextFile, '[Shower Button]', 'echo', confirmTTS);

    } catch (error: any) {
      console.error("[Shower Button] Error:", error);
      res.status(500).json({ error: "Failed to handle shower button webhook", details: error.message });
    }
  });

  app.post("/api/webhook/cat-lights-confirm", async (req, res) => {
    console.log(`[Cat Lights Confirm] ====== CONFIRMATION RECEIVED ======`);
    if (catLightsConfirmResolve) {
      catLightsConfirmResolve(true);
      catLightsConfirmResolve = null;

      if (!isSpotifyPlayingOnEverywhere()) {
        try {
          const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
          const catEchoEntities = CAT_ECHO_ENTITIES;
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: catEchoEntities }),
          });
          console.log(`[Cat Lights Confirm] Stopped media on cat washroom Echos`);
        } catch (e: any) {
          console.warn(`[Cat Lights Confirm] Failed to stop Echos (non-fatal): ${e.message}`);
        }
      } else {
        console.log(`[Cat Lights Confirm] Everywhere group playing — preserving cat washroom Echos`);
      }

      res.json({ action: "confirmed", message: "Module reading confirmed — starting playback" });
    } else {
      console.log(`[Cat Lights Confirm] No pending confirmation to resolve`);
      res.json({ action: "ignored", reason: "No pending confirmation" });
    }
  });

  // POST /api/webhook/cat-lights - Triggered when light.cat_lights turns on/off
  // If the current week's CPPA module hasn't been fully listened to,
  // turning the light ON starts/resumes playback on Cat Wash speaker group, turning it OFF stops and saves progress.
  app.post("/api/webhook/cat-lights", async (req, res) => {
    try {
      console.log(`[Cat Lights] ====== WEBHOOK TRIGGERED ======`);
      console.log(`[Cat Lights] Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })}`);
      console.log(`[Cat Lights] Request body: ${JSON.stringify(req.body)}`);

      const timeSinceStart = Date.now() - SERVER_START_TIME;
      if (timeSinceStart < SERVER_STARTUP_COOLDOWN_MS) {
        console.log(`[Cat Lights] Ignoring — server started ${Math.round(timeSinceStart / 1000)}s ago (cooldown: ${SERVER_STARTUP_COOLDOWN_MS / 1000}s)`);
        return res.json({ action: "ignored", reason: "Server startup cooldown" });
      }

      const haUrl0 = HOME_ASSISTANT_URL?.replace(/\/$/, '') || '';
      const haHeaders0 = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

      await new Promise(r => setTimeout(r, 800));

      let lightState = 'unknown';
      const bodyState = req.body?.state || req.body?.new_state?.state || '';
      if (bodyState === 'on' || bodyState === 'off') {
        lightState = bodyState;
        console.log(`[Cat Lights] Using body state directly: ${lightState}`);
      } else {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const lightResp = await fetch(`${haUrl0}/api/states/${CAT_LIGHTS_ENTITY}`, { headers: haHeaders0 });
            if (lightResp.ok) {
              const lightData = await lightResp.json();
              lightState = lightData?.state || 'unknown';
              if (lightState !== 'unknown') break;
            }
          } catch (e: any) {
            console.log(`[Cat Lights] Attempt ${attempt}/3 failed to query light state: ${e.message}`);
          }
          if (attempt < 3) {
            console.log(`[Cat Lights] Retrying light state query in 1s (attempt ${attempt + 1}/3)...`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      console.log(`[Cat Lights] Light state: ${lightState} (body state: ${bodyState})`);
      console.log(`[Cat Lights] Architecture: server-side TTS → Google Nest speaker (media_player.play_media)`);

      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = DEPLOYED_APP_URL;
      const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');

      // === LIGHT TURNED OFF → Stop all playback + save progress ===
      if (lightState === 'off') {
        console.log("[Cat Lights] Light off — stopping all playback and saving progress");
        const stopped: string[] = [];
        if (catWashPlaybackActive) {
          stopped.push(`playback:${catWashPlaybackState?.fileName || ''}`);
          await stopNestPlaybackWithGoodbye('light_off');
        }
        if (currentTTSSession) {
          console.log(`[Cat Lights] Stopping active TTS session (light off)`);
          stopTTSSession("Light turned off - stopping playback");
          stopped.push("ttsSession");
        }
        try {
          await stopAllCatWashroomSpeakers(haUrl);
          stopped.push("echoSpeakers");
        } catch (e: any) {
          console.warn(`[Cat Lights] Failed to stop Echo speakers: ${e.message}`);
        }
        await Promise.allSettled([
          haServiceCallSafe('media_player/turn_off', { entity_id: 'media_player.fire_stick_cat_wr' }, 'Stop TV FireStick'),
          haServiceCallSafe('media_player/turn_off', { entity_id: CAT_TV_ENTITY }, 'Stop TV Samsung'),
        ]);
        stopped.push("tv");
        console.log(`[Cat Lights] Fire Stick + Samsung TV turn-off sent`);
        catLightsPromptPending = false;
        catWashPlaybackTrigger = null;
        await clearPlaybackSession();
        console.log(`[Cat Lights] Stopped: ${stopped.join(', ') || 'nothing was playing'}`);
        return res.json({ action: "stopped", reason: "Light turned off", stoppedItems: stopped });
      }

      // === LIGHT TURNED ON → Check if CPPA module needs playing ===
      if (lightState !== 'on') {
        return res.json({ action: "ignored", reason: `Unknown state: ${lightState}` });
      }

      // Cooldown: skip if prompted within last 5 minutes
      const bypassRequested = req.body?.bypass === true;
      if (bypassRequested) {
        console.log(`[Cat Lights] Cooldown BYPASSED via request`);
        catLightsPromptPending = false;
      }

      if (catLightsPromptPending) {
        console.log(`[Cat Lights] Prompt already pending — skipping duplicate`);
        return res.json({ action: "skipped", reason: "Prompt already pending" });
      }

      const msSinceStop = Date.now() - lastPlaybackStoppedAt;
      if (msSinceStop < 60000) {
        console.log(`[Cat Lights] Playback was stopped ${Math.round(msSinceStop / 1000)}s ago — skipping prompt (60s cooldown)`);
        return res.json({ action: "skipped", reason: "Post-stop cooldown" });
      }

      if (catWashPlaybackActive && catWashPlaybackState) {
        const msSinceStart = catWashPlaybackStartedAt ? Date.now() - catWashPlaybackStartedAt.getTime() : 0;
        const chunkStillAtStart = catWashPlaybackState.chunkIndex === 0;
        const likelyStale = (msSinceStart > 3 * 60 * 1000 && chunkStillAtStart) || msSinceStart > 10 * 60 * 1000;

        if (likelyStale) {
          console.log(`[Cat Lights] Clearing stale playback state (started ${Math.round(msSinceStart / 1000)}s ago, chunk ${catWashPlaybackState.chunkIndex})`);
          catWashPlaybackActive = false;
          catWashPlaybackStartedAt = null;
          catWashPlaybackState = null;
        } else {
          console.log(`[Cat Lights] Already playing: "${catWashPlaybackState.fileName}" chunk ${catWashPlaybackState.chunkIndex} - skipping`);
          return res.json({ action: "skipped", reason: "Playback already active", currentFile: catWashPlaybackState.fileName });
        }
      }

      try {
        const verifyResp = await fetch(`${haUrl0}/api/states/${CAT_LIGHTS_ENTITY}`, { headers: haHeaders0 });
        if (verifyResp.ok) {
          const verifyData = await verifyResp.json();
          if (verifyData?.state === 'off') {
            console.log(`[Cat Lights] Body said ON but HA confirms light is OFF — aborting`);
            return res.json({ action: "ignored", reason: "Light actually off (verified)" });
          }
        }
      } catch {}

      catLightsLastPromptAt = Date.now();
      catLightsPromptPending = true;

      res.json({ action: "processing", reason: "Light on — processing in background" });

      const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

      const nowToronto = torontoDate();
      const currentHour = nowToronto.getHours();
      const currentMinute = nowToronto.getMinutes();
      const inHARestartWindow = currentHour === 4 && currentMinute < 10;

      if (inHARestartWindow) {
        const minutesLeft = 10 - currentMinute;
        console.log(`[Cat Lights] HA restart window detected (4:${String(currentMinute).padStart(2, '0')} AM) — waiting ${minutesLeft} minutes until 4:10 AM`);

        try {
          await haServiceCall('tts/speak', {
            entity_id: HA_CLOUD_TTS_ENTITY,
            media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
            message: `Home Assistant is currently restarting. I'll check your readings in about ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
          }, 'Cat Lights HA Restart Notice');
          console.log(`[Cat Lights] HA restart notice played`);
        } catch (e: any) {
          console.warn(`[Cat Lights] HA restart notice TTS failed (expected during restart): ${e.message}`);
        }

        const msUntil410 = minutesLeft * 60 * 1000;
        await new Promise(r => setTimeout(r, msUntil410));

        try {
          const lightCheckResp = await fetch(`${haUrl0}/api/states/${CAT_LIGHTS_ENTITY}`, { headers: haHeaders0 });
          if (lightCheckResp.ok) {
            const lightCheckData = await lightCheckResp.json();
            if (lightCheckData?.state === 'off') {
              console.log(`[Cat Lights] Lights turned off during HA restart wait — aborting`);
              catLightsPromptPending = false;
              return;
            }
            console.log(`[Cat Lights] Lights still on after HA restart wait — proceeding`);
          }
        } catch (e: any) {
          console.warn(`[Cat Lights] Post-restart light check failed: ${e.message} — proceeding anyway`);
        }
      }

      const earlyDeviceWakePromise = (async () => {
        const tabletEntity = 'media_player.tablet_cat';
        const fireStickEntity = 'media_player.fire_stick_cat_wr';
        try {
          await Promise.allSettled([
            haServiceCallSafe('androidtv/adb_command', { entity_id: tabletEntity, command: 'input keyevent KEYCODE_WAKEUP' }, 'Cat Lights Early Tablet Wake'),
            haServiceCallSafe('androidtv/adb_command', { entity_id: fireStickEntity, command: 'input keyevent KEYCODE_WAKEUP' }, 'Cat Lights Early TV Wake'),
            haServiceCallSafe('media_player/turn_on', { entity_id: fireStickEntity }, 'Cat Lights Early FireStick On'),
            haServiceCallSafe('media_player/turn_on', { entity_id: CAT_TV_ENTITY }, 'Cat Lights Early Samsung On'),
          ]);
          console.log(`[Cat Lights] Early device wake: tablet + TV wake commands sent`);
        } catch (e: any) {
          console.warn(`[Cat Lights] Early device wake failed (non-fatal): ${e.message}`);
        }
      })();

      const immediatePromptPromise = (async () => {
        try {
          await Promise.allSettled([
            haServiceCallSafe('media_player/volume_set', { entity_id: CAT_WR_HA_VOICE_ENTITY, volume_level: 0.35 }, 'Cat Lights Vol'),
            haServiceCallSafe('input_boolean/turn_off', { entity_id: MODULE_READING_CONFIRMED }, 'Cat Lights Bool'),
            haServiceCallSafe('input_boolean/turn_on', { entity_id: MODULE_READING_PENDING }, 'Cat Lights Bool'),
          ]);
          await haServiceCall('tts/speak', {
            entity_id: HA_CLOUD_TTS_ENTITY,
            media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
            message: "One moment, checking your readings."
          }, 'Cat Lights Quick TTS');
          console.log(`[Cat Lights] Quick acknowledgment played via HA Cloud TTS`);
        } catch (e: any) {
          console.warn(`[Cat Lights] Quick acknowledgment failed: ${e.message}`);
        }
      })();

      const today = torontoDate();
      const semesterSettings = await storage.getActiveSemesterSettings();

      if (!semesterSettings) {
        console.log(`[Cat Lights] No active semester — skipping prompt`);
        catLightsPromptPending = false;
        return;
      }

      let currentWeekNumber = 1;
      const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
      const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
      currentWeekNumber = getWeekNumber(today, semStart, rwStart);

      const allFilesBefore = await storage.getFiles();
      let nextFile = findNextFileByPriority(allFilesBefore, currentWeekNumber);

      if (!nextFile) {
        console.log(`[Cat Lights] No cached files found — syncing OneDrive first`);
        await syncOneDriveFilesForWeek(semesterSettings, currentWeekNumber, '[Cat Lights]');
        const allFilesAfter = await storage.getFiles();
        nextFile = findNextFileByPriority(allFilesAfter, currentWeekNumber);
      } else {
        console.log(`[Cat Lights] Using cached file — syncing OneDrive in background`);
        syncOneDriveFilesForWeek(semesterSettings, currentWeekNumber, '[Cat Lights]').catch(e => console.log(`[Cat Lights] Background sync error: ${e.message}`));
      }

      await Promise.allSettled([immediatePromptPromise, earlyDeviceWakePromise]);

      try {
        const lightCheckResp = await fetch(`${haUrl0}/api/states/${CAT_LIGHTS_ENTITY}`, { headers: haHeaders0 });
        if (lightCheckResp.ok) {
          const lightCheckData = await lightCheckResp.json();
          if (lightCheckData?.state === 'off') {
            console.log(`[Cat Lights] Light turned off during file lookup — aborting prompt`);
            catLightsPromptPending = false;
            return;
          }
        }
      } catch {}

      if (!nextFile) {
        console.log(`[Cat Lights] No unlistened files for week ${currentWeekNumber} — playing CHUM FM on Echo speakers`);
        catLightsPromptPending = false;
        await playChumFmRadio(haUrl);
        return;
      }

      const fileName = nextFile.displayName || nextFile.originalName || 'Unknown file';
      const fileDesc = describeFileForTTS(nextFile, currentWeekNumber);
      console.log(`[Cat Lights] Found next file: ${fileDesc} — ${fileName} (id=${nextFile.id})`);

      const ttsMessage = `Would you like to play ${fileDesc}?`;
      console.log(`[Cat Lights] Sending TTS prompt: "${ttsMessage}"`);
      try {
        try {
          await stopAllCatWashroomSpeakers(haUrl);
          console.log(`[Cat Lights] Stopped any existing media before TTS prompt`);
        } catch (e: any) {
          console.warn(`[Cat Lights] Pre-prompt media stop error (non-fatal): ${e.message}`);
        }

        await haServiceCallSafe('media_player/volume_set', { entity_id: NEST_SPEAKER_ENTITY, volume_level: 0.35 }, 'Cat Lights Vol');

        let ttsPlayed = false;
        try {
          await haServiceCall('tts/speak', {
            entity_id: HA_CLOUD_TTS_ENTITY,
            media_player_entity_id: CAT_WR_HA_VOICE_ENTITY,
            message: ttsMessage
          }, 'Cat Lights Cloud TTS');
          ttsPlayed = true;
          console.log(`[Cat Lights] TTS prompt played via HA Cloud TTS`);
        } catch (e: any) {
          console.warn(`[Cat Lights] HA Cloud TTS failed: ${e.message} — trying Edge TTS fallback`);
          try {
            const audioPath = await generateAndSaveTTSAudio(ttsMessage, `cat-lights-prompt-${Date.now()}`);
            const appUrl2 = DEPLOYED_APP_URL;
            await haServiceCall('media_player/play_media', { entity_id: CAT_WR_HA_VOICE_ENTITY, media_content_id: `${appUrl2}${audioPath}`, media_content_type: "music" }, 'Cat Lights TTS');
            ttsPlayed = true;
            console.log(`[Cat Lights] TTS prompt played via Edge TTS on HA Voice`);
          } catch (e2: any) {
            console.error(`[Cat Lights] All TTS methods failed: ${e2.message}`);
          }
        }
        if (!ttsPlayed) {
          console.error(`[Cat Lights] Could not play TTS prompt after all retries — falling back to CHUM FM`);
          catLightsPromptPending = false;
          await playChumFmRadio(haUrl);
          return;
        }
      } catch (e: any) {
        console.error(`[Cat Lights] Critical failure in prompt setup: ${e.message} — falling back to CHUM FM`);
        catLightsPromptPending = false;
        await playChumFmRadio(haUrl);
        return;
      }

      await new Promise(r => setTimeout(r, 2000));

      try {
        const lightCheck2 = await fetch(`${haUrl0}/api/states/${CAT_LIGHTS_ENTITY}`, { headers: haHeaders0 });
        if (lightCheck2.ok) {
          const ld2 = await lightCheck2.json();
          if (ld2?.state === 'off') {
            console.log(`[Cat Lights] Light turned off during confirmation wait — aborting`);
            catLightsPromptPending = false;
            await Promise.allSettled([
              haServiceCallSafe('input_boolean/turn_off', { entity_id: MODULE_READING_PENDING }, 'Cat Lights Bool'),
              haServiceCallSafe('input_boolean/turn_off', { entity_id: MODULE_READING_CONFIRMED }, 'Cat Lights Bool'),
            ]);
            return;
          }
        }
      } catch {}

      {
        const maxWaitMs = 23000;
        console.log(`[Cat Lights] Waiting up to ${maxWaitMs / 1000}s for confirmation (webhook-primary, backup poll every 10s)...`);

        const confirmed = await new Promise<boolean>((resolve) => {
          let resolved = false;
          const finish = (val: boolean) => { if (!resolved) { resolved = true; clearTimeout(timeout); clearInterval(boolPoll); catLightsConfirmResolve = null; resolve(val); } };
          const timeout = setTimeout(() => finish(false), maxWaitMs);
          catLightsConfirmResolve = () => finish(true);
          const boolPoll = setInterval(async () => {
            if (!catLightsPromptPending) {
              finish(false);
              return;
            }
            try {
              const resp = await haFetch(`${haUrl}/api/states/${MODULE_READING_CONFIRMED}`, { headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}` } }, 1, 'Cat Lights Poll');
              const data = await resp.json();
              if (data.state === 'on') {
                console.log(`[Cat Lights] Confirmation received via backup poll`);
                finish(true);
              }
            } catch {}
          }, 10000);
        });

        await Promise.allSettled([
          haServiceCallSafe('input_boolean/turn_off', { entity_id: MODULE_READING_PENDING }, 'Cat Lights Bool'),
          haServiceCallSafe('input_boolean/turn_off', { entity_id: MODULE_READING_CONFIRMED }, 'Cat Lights Bool'),
        ]);

        if (!confirmed) {
          catLightsPromptPending = false;
          if (catWashPlaybackActive) {
            console.log(`[Cat Lights] No confirmation received but CPPA playback already active — skipping CHUM FM`);
            return;
          }
          console.log(`[Cat Lights] No confirmation received — playing CHUM FM on Echo speakers`);
          await playChumFmRadio(haUrl);
          return;
        }

        try {
          const lightCheck3 = await fetch(`${haUrl0}/api/states/${CAT_LIGHTS_ENTITY}`, { headers: haHeaders0 });
          if (lightCheck3.ok) {
            const ld3 = await lightCheck3.json();
            if (ld3?.state === 'off') {
              console.log(`[Cat Lights] Light turned off after confirmation — aborting playback start`);
              catLightsPromptPending = false;
              return;
            }
          }
        } catch {}

        console.log(`[Cat Lights] Confirmation received — starting playback`);
        catLightsPromptPending = false;

        const confirmTTS = `Okay, I will now play ${fileDesc}.`;
        catWashPlaybackTrigger = 'lights';
        await startConfirmedPlaybackFlow(nextFile, '[Cat Lights]', 'echo', confirmTTS);
        return;
      }

    } catch (error: any) {
      console.error("[Cat Lights] Error:", error);
      res.status(500).json({ error: "Failed to handle cat lights webhook", details: error.message });
    }
  });

  // POST /api/webhook/cat-wash-stop - Triggered when toothbrush starts running (idle/charging → running)
  // Stops cat wash playback and saves progress.
  app.post("/api/webhook/cat-wash-stop", async (req, res) => {
    try {
      console.log(`[Cat Wash Stop Webhook] ====== WEBHOOK TRIGGERED ======`);
      console.log(`[Cat Wash Stop Webhook] Timestamp: ${new Date().toISOString()}`);
      console.log(`[Cat Wash Stop Webhook] Request body: ${JSON.stringify(req.body)}`);

      const stopped: string[] = [];
      const fileName = catWashPlaybackState?.fileName || '';

      if (catWashPlaybackActive) {
        stopped.push(`playback:${fileName}`);
        await stopNestPlaybackWithGoodbye(req.body?.trigger || 'toothbrush', !!req.body?.keepOpen);
      }

      if (currentTTSSession) {
        console.log(`[Cat Wash Stop Webhook] Stopping active TTS session`);
        stopTTSSession("Toothbrush started running - stopping playback");
        stopped.push("ttsSession");
      }

      try {
        await stopAllCatWashroomSpeakers(haUrl);
        stopped.push("echoSpeakers");
      } catch (e: any) {
        console.warn(`[Cat Wash Stop Webhook] Failed to stop Echo speakers: ${e.message}`);
      }

      await Promise.allSettled([
        haServiceCallSafe('media_player/turn_off', { entity_id: 'media_player.fire_stick_cat_wr' }, 'Stop TV FireStick'),
        haServiceCallSafe('media_player/turn_off', { entity_id: CAT_TV_ENTITY }, 'Stop TV Samsung'),
      ]);
      stopped.push("tv");
      console.log(`[Cat Wash Stop Webhook] Fire Stick + Samsung TV turn-off sent`);

      catWashPlaybackTrigger = null;
      console.log(`[Cat Wash Stop Webhook] Stopped: ${stopped.join(', ') || 'nothing was playing'}`);
      res.json({ action: "stopped", stoppedItems: stopped });

    } catch (error: any) {
      console.error("[Cat Wash Stop Webhook] Error:", error);
      res.status(500).json({ error: "Failed to handle stop webhook", details: error.message });
    }
  });


  // POST /api/webhook/kitchen-volume - Control Kitchen Echo Studio volume (fire-and-forget for HA automations)
  app.post("/api/webhook/kitchen-volume", async (req, res) => {
    try {
      const { direction, speed } = req.body || {};
      console.log(`[Kitchen Volume] ====== WEBHOOK TRIGGERED ====== direction=${direction} speed=${speed}`);

      res.json({ success: true, direction, speed });

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };
      const entity = KITCHEN_ECHO_ENTITY;

      const stateResp = await fetch(`${haUrl}/api/states/${entity}`, { headers: haHeaders });
      const stateData = stateResp.ok ? await stateResp.json() : null;
      const currentVolume = stateData?.attributes?.volume_level ?? 0.5;

      const step = speed === 'fast' ? 0.15 : 0.05;
      let newVolume: number;

      if (direction === 'up') {
        newVolume = Math.min(1, currentVolume + step);
      } else {
        newVolume = Math.max(0, currentVolume - step);
      }

      await fetch(`${haUrl}/api/services/media_player/volume_set`, {
        method: 'POST', headers: haHeaders,
        body: JSON.stringify({ entity_id: entity, volume_level: newVolume }),
      });
      console.log(`[Kitchen Volume] Set volume: ${currentVolume} → ${newVolume} (${direction}, ${speed})`);
    } catch (err: any) {
      console.error(`[Kitchen Volume] Error: ${err.message}`);
    }
  });

  app.post("/api/webhook/cat-volume", async (req, res) => {
    try {
      const { direction, speed } = req.body || {};
      console.log(`[Cat Volume] ====== WEBHOOK TRIGGERED ====== direction=${direction} speed=${speed}`);

      res.json({ success: true, direction, speed });

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

      const allCatEntities = [
        NEST_SPEAKER_ENTITY,
        CAT_WR_MEDIA_GROUP,
      ];

      const activeEntities: string[] = [];
      await Promise.all(allCatEntities.map(async (entityId) => {
        try {
          const resp = await fetch(`${haUrl}/api/states/${entityId}`, { headers: haHeaders });
          if (resp.ok) {
            const data = await resp.json();
            if (data.state === 'playing' || data.state === 'paused' || data.state === 'buffering') {
              activeEntities.push(entityId);
            }
          }
        } catch {}
      }));

      if (activeEntities.length === 0) {
        activeEntities.push(NEST_SPEAKER_ENTITY);
        console.log(`[Cat Volume] No active speakers found — defaulting to Nest`);
      }

      const step = speed === 'fast' ? 0.15 : 0.05;

      for (const entityId of activeEntities) {
        const stateResp = await fetch(`${haUrl}/api/states/${entityId}`, { headers: haHeaders });
        const stateData = stateResp.ok ? await stateResp.json() : null;
        const currentVolume = stateData?.attributes?.volume_level ?? 0.5;

        let newVolume: number;
        if (direction === 'up') {
          newVolume = Math.min(1, currentVolume + step);
        } else {
          newVolume = Math.max(0, currentVolume - step);
        }

        await fetch(`${haUrl}/api/services/media_player/volume_set`, {
          method: 'POST', headers: haHeaders,
          body: JSON.stringify({ entity_id: entityId, volume_level: newVolume }),
        });
        console.log(`[Cat Volume] ${entityId}: ${currentVolume} → ${newVolume} (${direction}, ${speed})`);
        lastVolumeChange = { volume: Math.round(newVolume * 100), direction, timestamp: Date.now() };
      }

      console.log(`[Cat Volume] Adjusted ${activeEntities.length} active speaker(s)`);
    } catch (err: any) {
      console.error(`[Cat Volume] Error: ${err.message}`);
    }
  });

  // POST /api/webhook/cat-knob-press - STOP button: stops all playback on cat washroom speakers + Nest
  app.post("/api/webhook/cat-knob-press", async (req, res) => {
    try {
      console.log(`[Cat Knob] ====== KNOB PRESS RECEIVED (STOP BUTTON) ======`);
      console.log(`[Cat Knob] Body: ${JSON.stringify(req.body)}`);
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      if (catWashPlaybackActive) {
        console.log(`[Cat Knob] Playback active — stopping via cat-wash-stop`);
        try {
          await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/cat-wash-stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger: 'knob_press', keepOpen: true }),
          });
        } catch (e: any) {
          console.error(`[Cat Knob] Error calling stop: ${e.message}`);
        }
        res.json({ success: true, action: 'stopped' });
        return;
      }

      await stopAllCatWashroomSpeakers(haUrl);
      console.log(`[Cat Knob] Stopped all cat washroom speakers (Nest + Echos)`);
      res.json({ success: true, action: 'stopped' });
    } catch (err: any) {
      console.error(`[Cat Knob] Error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/cat-wash/progress - Returns current playback state for the active session
  app.get("/api/cat-wash/progress", (_req, res) => {
    if (catWashPlaybackActive && catWashPlaybackState && catWashPlaybackStartedAt) {
      const msSinceStart = Date.now() - catWashPlaybackStartedAt.getTime();
      const chunkStillAtStart = catWashPlaybackState.chunkIndex === 0;
      if (msSinceStart > 10 * 60 * 1000 && chunkStillAtStart) {
        console.log(`[Cat Wash Progress] Auto-clearing stale state (started ${Math.round(msSinceStart / 1000)}s ago, still at chunk 0)`);
        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        catWashPlaybackState = null;
        return res.json({ active: false });
      }
    }

    if (!catWashPlaybackActive || !catWashPlaybackState) {
      return res.json({ active: false });
    }

    const state = catWashPlaybackState;
    const volumeEvent = lastVolumeChange && (Date.now() - lastVolumeChange.timestamp < 5000) ? lastVolumeChange : null;
    res.json({
      active: true,
      fileId: state.fileId,
      fileName: state.fileName,
      chunkIndex: state.chunkIndex,
      totalChunks: state.totalChunks,
      chunkText: state.chunks[state.chunkIndex] || '',
      words: state.currentWords,
      wordIndex: state.wordIndex || 0,
      volumeChange: volumeEvent,
    });
  });

  // POST /api/cat-wash/update-progress - Tablet reports its playback progress
  app.post("/api/cat-wash/update-progress", async (req, res) => {
    const { fileId, chunkIndex, totalChunks, words, wordIndex, completed } = req.body;

    if (catWashPlaybackState && catWashPlaybackState.fileId === fileId) {
      catWashPlaybackState.chunkIndex = chunkIndex ?? catWashPlaybackState.chunkIndex;
      catWashPlaybackState.totalChunks = totalChunks ?? catWashPlaybackState.totalChunks;
      catWashPlaybackState.currentWords = words ?? catWashPlaybackState.currentWords;
      catWashPlaybackState.wordIndex = wordIndex ?? catWashPlaybackState.wordIndex;
      catWashPlaybackState.chunkStartedAt = new Date();
      if (req.body.chunkText && chunkIndex != null) {
        catWashPlaybackState.chunks[chunkIndex] = req.body.chunkText;
      }
    } else if (fileId && !catWashPlaybackActive) {
      console.log(`[Cat Wash] Re-activating playback state from tablet progress report (fileId=${fileId})`);
      catWashPlaybackActive = true;
      catWashPlaybackStartedAt = new Date();
      startToothbrushPolling();
      const file = await storage.getFile(fileId);
      catWashPlaybackState = {
        fileId,
        fileName: file?.displayName || file?.originalName || 'Unknown',
        chunkIndex: chunkIndex ?? 0,
        totalChunks: totalChunks ?? 0,
        chunks: [],
        currentWords: words || [],
        wordIndex: wordIndex ?? 0,
        startedAt: new Date(),
        chunkStartedAt: new Date(),
        estimatedChunkDuration: 0,
      };
    }

    if (fileId && chunkIndex != null) {
      await storage.updateFile(fileId, { lastChunkIndex: chunkIndex, totalChunks: totalChunks ?? undefined });
    }

    // When the tablet signals file completion, find and return the next file
    if (completed && fileId) {
      console.log(`[Cat Wash] Tablet reports file ${fileId} complete`);
      await storage.updateFile(fileId, { listened: true });

      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
      const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
      currentWeekNumber = getWeekNumber(torontoDate(), semStart, rwStart);

      const nextFile = await findNextCatWashFile(storage, currentWeekNumber, fileId);
      if (nextFile) {
        const appUrl = DEPLOYED_APP_URL;
        const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');
        const nextReaderUrl = `${appUrl}/pdf-reader/${nextFile.id}?catWashFollow=true&autoplay=true&auth=${authParam}`;
        const nextFileName = nextFile.displayName || nextFile.originalName || 'Unknown file';

        catWashPlaybackState = {
          fileId: nextFile.id,
          fileName: nextFileName,
          chunkIndex: 0,
          totalChunks: 0,
          chunks: [],
          currentWords: [],
          wordIndex: 0,
          startedAt: new Date(),
          chunkStartedAt: new Date(),
          estimatedChunkDuration: 0,
        };

        console.log(`[Cat Wash] Next file: ${nextFileName} (id=${nextFile.id})`);
        return res.json({ nextFile: { id: nextFile.id, name: nextFileName, readerUrl: nextReaderUrl } });
      } else {
        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        catWashPlaybackState = null;
        console.log("[Cat Wash] All files complete");
        return res.json({ allComplete: true });
      }
    }

    res.json({ ok: true });
  });

  // POST /api/cat-wash/stop - Stop ALL playback (cat wash, cat lights, TTS sessions, all echo devices)
  app.post("/api/cat-wash/stop", async (req, res) => {
    const keepOpen = req.body?.keepOpen === true;
    console.log(`[Cat Wash Stop] === STOP ALL PLAYBACK === (keepOpen=${keepOpen})`);

    clearVoiceCommandPause_();
    const stopped: string[] = [];

    if (catWashPlaybackActive && catWashPlaybackState) {
      const { fileId, chunkIndex, fileName } = catWashPlaybackState;
      console.log(`[Cat Wash Stop] Stopping cat wash playback (file: ${fileName}, chunk: ${chunkIndex})`);
      if (fileId && chunkIndex != null) {
        try {
          await storage.updateFile(fileId, { lastChunkIndex: chunkIndex });
          console.log(`[Cat Wash Stop] Saved progress: file ${fileId}, chunk ${chunkIndex}`);
        } catch (e: any) {
          console.error(`[Cat Wash Stop] Failed to save progress: ${e.message}`);
        }
      }
      stopped.push("catWashPlayback");
    }
    catWashPlaybackActive = false;
    catWashPlaybackStartedAt = null;
    catWashPlaybackState = null;
    catWashManuallyStoppedAt = new Date();
    currentTvFollowUrl = null;
    currentTabletReaderUrl = null;
    stopToothbrushPolling();
    await clearPlaybackSession();

    if (currentTTSSession) {
      console.log(`[Cat Wash Stop] Stopping active TTS session (entity: ${currentTTSSession.targetEntity})`);
      stopTTSSession("Force stopped via cat-wash/stop");
      stopped.push("ttsSession");
    }

    if (nestPlaybackAbort) {
      nestPlaybackAbort();
      nestPlaybackAbort = null;
      stopped.push("nestPlaybackAbort");
    }

    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      await fetch(`${haUrl}/api/services/media_player/media_stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: NEST_SPEAKER_ENTITY }),
      });
      console.log(`[Cat Wash Stop] Sent media_stop to Nest speaker`);
      stopped.push("nestSpeaker");

      const appUrl = DEPLOYED_APP_URL;
      try {
        const stopConfirmPath = await generateAndSaveTTSAudio("Stop received.", `cat-wash-stop-confirm-${Date.now()}`);
        await playOnNestSpeaker(`${appUrl}${stopConfirmPath}`);
        console.log(`[Cat Wash Stop] Played "Stop received" on Nest`);
      } catch (e2: any) {
        console.log(`[Cat Wash Stop] Stop confirm TTS error: ${e2.message}`);
      }
    } catch (e: any) {
      console.error(`[Cat Wash Stop] Failed to stop Nest speaker: ${e.message}`);
    }

    if (!keepOpen) {
      const stopTs = Date.now();
      await Promise.all([
        setTabletCommand({ action: 'stop_playback', timestamp: stopTs }, true, 'master'),
        setTabletCommand({ action: 'stop_playback', timestamp: stopTs }, true, 'tv'),
      ]);

      try {
        const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
        await fetch(`${haUrl}/api/services/media_player/turn_off`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: 'media_player.fire_stick_cat_wr' }),
        });
        await fetch(`${haUrl}/api/services/media_player/turn_off`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: 'media_player.samsung_tv' }),
        });
        console.log(`[Cat Wash Stop] TV turned off`);
        stopped.push("tv");
      } catch (e: any) {
        console.log(`[Cat Wash Stop] TV turn off error: ${e.message}`);
      }
    } else {
      console.log(`[Cat Wash Stop] keepOpen=true — tablet/TV stay on reader`);
    }

    stopWordAdvancement();
    console.log(`[Cat Wash Stop] Stopped: ${stopped.join(', ')}`);
    res.json({ stopped: true, stoppedItems: stopped });
  });

  app.post("/api/webhook/voice-command", async (req, res) => {
    const command = (req.body?.command || '').toLowerCase().trim();
    console.log(`[Voice Command] ====== WEBHOOK TRIGGERED ====== command="${command}"`);
    console.log(`[Voice Command] Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })}`);

    if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
      return res.status(500).json({ error: "Home Assistant not configured" });
    }

    const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
    const appUrl = DEPLOYED_APP_URL;
    const haHeaders = { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' };

    try {
      if (command === 'pause') {
        if (!catWashPlaybackActive || !catWashPlaybackState) {
          console.log(`[Voice Command] Pause requested but no active playback`);
          try {
            const noPlayPath = await generateAndSaveTTSAudio("Nothing is playing right now.", `vc-no-play-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${noPlayPath}`);
          } catch {}
          return res.json({ action: "ignored", reason: "No active playback" });
        }

        const { fileId, chunkIndex, fileName } = catWashPlaybackState;
        console.log(`[Voice Command] Pausing: "${fileName}" at chunk ${chunkIndex}`);

        if (nestPlaybackAbort) {
          nestPlaybackAbort();
          nestPlaybackAbort = null;
        }
        await stopNestSpeaker();
        stopWordAdvancement();

        if (fileId && chunkIndex != null) {
          try {
            await storage.updateFile(fileId, { lastChunkIndex: chunkIndex });
            console.log(`[Voice Command] Saved progress: file ${fileId}, chunk ${chunkIndex}`);
          } catch (e: any) {
            console.error(`[Voice Command] Failed to save progress: ${e.message}`);
          }
        }

        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        const savedState = { ...catWashPlaybackState };
        catWashPlaybackState = null;
        stopToothbrushPolling();

        const PAUSE_TIMEOUT_MS = 10 * 60 * 1000;
        clearVoiceCommandPause_();
        const autoStopTimer = setTimeout(async () => {
          console.log(`[Voice Command] 10-minute pause timeout — auto-stopping`);
          voiceCommandPauseState_ = null;
          await clearPlaybackSession();

          const stopTimestamp = Date.now();
          await Promise.all([
            setTabletCommand({ action: 'stop_playback', goodbyeText: '', timestamp: stopTimestamp }, true, 'master'),
            setTabletCommand({ action: 'stop_playback', timestamp: stopTimestamp }, true, 'tv'),
          ]);

          try {
            await fetch(`${haUrl}/api/services/media_player/turn_off`, {
              method: 'POST', headers: haHeaders,
              body: JSON.stringify({ entity_id: 'media_player.fire_stick_cat_wr' }),
            });
            await fetch(`${haUrl}/api/services/media_player/turn_off`, {
              method: 'POST', headers: haHeaders,
              body: JSON.stringify({ entity_id: 'media_player.samsung_tv' }),
            });
          } catch {}

          try {
            const timeoutPath = await generateAndSaveTTSAudio("Pause timed out. Playback has been stopped. Your progress has been saved.", `vc-timeout-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${timeoutPath}`);
          } catch {}
        }, PAUSE_TIMEOUT_MS);

        voiceCommandPauseState_ = {
          fileId: savedState.fileId,
          chunkIndex: savedState.chunkIndex,
          fileName: savedState.fileName,
          pausedAt: new Date(),
          autoStopTimer,
        };

        savePlaybackSession({
          fileId: savedState.fileId,
          fileName: savedState.fileName,
          chunkIndex: savedState.chunkIndex,
          totalChunks: savedState.totalChunks || 0,
          trigger: catWashPlaybackTrigger || 'manual',
          startedAt: catWashPlaybackStartedAt?.toISOString() || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'paused',
        }).catch(() => {});

        try {
          const pausePath = await generateAndSaveTTSAudio("Paused. Say resume to continue, or I'll stop in 10 minutes.", `vc-pause-${Date.now()}`);
          await playOnNestSpeaker(`${appUrl}${pausePath}`);
        } catch {}

        return res.json({ action: "paused", file: fileName, chunk: chunkIndex });

      } else if (command === 'resume') {
        if (!voiceCommandPauseState_) {
          console.log(`[Voice Command] Resume requested but nothing is paused`);
          try {
            const noPausePath = await generateAndSaveTTSAudio("Nothing is paused right now.", `vc-no-pause-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${noPausePath}`);
          } catch {}
          return res.json({ action: "ignored", reason: "Nothing paused" });
        }

        const { fileId, fileName } = voiceCommandPauseState_;
        console.log(`[Voice Command] Resuming: "${fileName}" (fileId=${fileId})`);
        clearVoiceCommandPause_();

        const file = await storage.getFile(fileId);
        if (!file) {
          console.log(`[Voice Command] File ${fileId} not found`);
          try {
            const notFoundPath = await generateAndSaveTTSAudio("The file could not be found.", `vc-notfound-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${notFoundPath}`);
          } catch {}
          return res.json({ action: "error", reason: "File not found" });
        }

        try {
          const echoEntities = CAT_ECHO_ENTITIES;
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST', headers: haHeaders,
            body: JSON.stringify({ entity_id: echoEntities }),
          });
          console.log(`[Voice Command] Cleared Echo speakers before resume`);
        } catch (e: any) {
          console.warn(`[Voice Command] Echo clear error (non-fatal): ${e.message}`);
        }

        const fileDesc = describeFileForTTS(file, 0).replace(/ for week 0$/, '');
        const confirmTTS = `Resuming ${fileDesc}.`;
        catWashPlaybackTrigger = catWashPlaybackTrigger || 'manual';
        catLightsPromptPending = false;

        res.json({ action: "resuming", file: fileName, fileId });

        await startConfirmedPlaybackFlow(file, '[Voice Resume]', 'echo', confirmTTS);
        return;

      } else if (command === 'stop') {
        const wasPaused = !!voiceCommandPauseState_;
        clearVoiceCommandPause_();
        await clearPlaybackSession();

        if (!catWashPlaybackActive && !wasPaused) {
          console.log(`[Voice Command] Stop requested but nothing is playing or paused`);
          try {
            const noPlayPath = await generateAndSaveTTSAudio("Nothing is playing.", `vc-nostop-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${noPlayPath}`);
          } catch {}
          return res.json({ action: "ignored", reason: "Nothing playing or paused" });
        }

        console.log(`[Voice Command] Stopping all playback`);

        if (catWashPlaybackActive) {
          await stopNestPlaybackWithGoodbye('voice_command_stop');
        } else {
          const stopTimestamp = Date.now();
          await Promise.all([
            setTabletCommand({ action: 'stop_playback', goodbyeText: '', timestamp: stopTimestamp }, true, 'master'),
            setTabletCommand({ action: 'stop_playback', timestamp: stopTimestamp }, true, 'tv'),
          ]);

          try {
            await fetch(`${haUrl}/api/services/media_player/turn_off`, {
              method: 'POST', headers: haHeaders,
              body: JSON.stringify({ entity_id: 'media_player.fire_stick_cat_wr' }),
            });
            await fetch(`${haUrl}/api/services/media_player/turn_off`, {
              method: 'POST', headers: haHeaders,
              body: JSON.stringify({ entity_id: 'media_player.samsung_tv' }),
            });
          } catch {}

          try {
            const stopPath = await generateAndSaveTTSAudio("Stopped. Your progress has been saved. See you next time Bryn.", `vc-stop-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${stopPath}`);
          } catch {}
        }

        if (currentTTSSession) {
          stopTTSSession("Voice command stop");
        }

        return res.json({ action: "stopped" });

      } else if (command === 'restart' || command === 'go_back') {
        let targetFileId: number | null = null;
        let targetChunk: number = 0;
        let targetFileName: string = '';

        if (catWashPlaybackActive && catWashPlaybackState) {
          targetFileId = catWashPlaybackState.fileId;
          targetChunk = Math.max(0, catWashPlaybackState.chunkIndex - 1);
          targetFileName = catWashPlaybackState.fileName;

          if (nestPlaybackAbort) {
            nestPlaybackAbort();
            nestPlaybackAbort = null;
          }
          await stopNestSpeaker();
          stopWordAdvancement();
          catWashPlaybackActive = false;
          catWashPlaybackStartedAt = null;
          catWashPlaybackState = null;
          stopToothbrushPolling();
        } else if (voiceCommandPauseState_) {
          targetFileId = voiceCommandPauseState_.fileId;
          targetChunk = Math.max(0, voiceCommandPauseState_.chunkIndex - 1);
          targetFileName = voiceCommandPauseState_.fileName;
          clearVoiceCommandPause_();
        }

        if (!targetFileId) {
          console.log(`[Voice Command] Restart requested but no active/paused playback`);
          try {
            const noPath = await generateAndSaveTTSAudio("Nothing is playing to restart.", `vc-norestart-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${noPath}`);
          } catch {}
          return res.json({ action: "ignored", reason: "Nothing to restart" });
        }

        console.log(`[Voice Command] Restart: "${targetFileName}" going back to chunk ${targetChunk}`);

        try {
          await storage.updateFile(targetFileId, { lastChunkIndex: targetChunk });
        } catch (e: any) {
          console.error(`[Voice Command] Failed to update chunk: ${e.message}`);
        }

        const file = await storage.getFile(targetFileId);
        if (!file) {
          return res.json({ action: "error", reason: "File not found" });
        }

        try {
          const echoEntities = CAT_ECHO_ENTITIES;
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST', headers: haHeaders,
            body: JSON.stringify({ entity_id: echoEntities }),
          });
        } catch {}

        const confirmTTS = `Going back. Restarting from an earlier section.`;
        catWashPlaybackTrigger = catWashPlaybackTrigger || 'manual';
        catLightsPromptPending = false;

        res.json({ action: "restarting", file: targetFileName, fromChunk: targetChunk });

        await startConfirmedPlaybackFlow(file, '[Voice Restart]', 'echo', confirmTTS);
        return;

      } else if (command === 'reset') {
        let targetFileId: number | null = null;
        let targetFileName: string = '';

        if (catWashPlaybackActive && catWashPlaybackState) {
          targetFileId = catWashPlaybackState.fileId;
          targetFileName = catWashPlaybackState.fileName;

          if (nestPlaybackAbort) {
            nestPlaybackAbort();
            nestPlaybackAbort = null;
          }
          await stopNestSpeaker();
          stopWordAdvancement();
          catWashPlaybackActive = false;
          catWashPlaybackStartedAt = null;
          catWashPlaybackState = null;
          stopToothbrushPolling();
        } else if (voiceCommandPauseState_) {
          targetFileId = voiceCommandPauseState_.fileId;
          targetFileName = voiceCommandPauseState_.fileName;
          clearVoiceCommandPause_();
        }

        if (!targetFileId) {
          console.log(`[Voice Command] Reset requested but no active/paused playback`);
          try {
            const noPath = await generateAndSaveTTSAudio("Nothing is playing to reset.", `vc-noreset-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${noPath}`);
          } catch {}
          return res.json({ action: "ignored", reason: "Nothing to reset" });
        }

        console.log(`[Voice Command] Reset: "${targetFileName}" back to chunk 0`);

        try {
          await storage.updateFile(targetFileId, { lastChunkIndex: 0, checkedChunks: '[]' });
        } catch (e: any) {
          console.error(`[Voice Command] Failed to reset file: ${e.message}`);
        }

        const file = await storage.getFile(targetFileId);
        if (!file) {
          return res.json({ action: "error", reason: "File not found" });
        }

        try {
          const echoEntities = CAT_ECHO_ENTITIES;
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST', headers: haHeaders,
            body: JSON.stringify({ entity_id: echoEntities }),
          });
        } catch {}

        const fileDesc = describeFileForTTS(file, 0).replace(/ for week 0$/, '');
        const confirmTTS = `Resetting ${fileDesc}. Starting from the beginning.`;
        catWashPlaybackTrigger = catWashPlaybackTrigger || 'manual';
        catLightsPromptPending = false;

        res.json({ action: "resetting", file: targetFileName });

        await startConfirmedPlaybackFlow(file, '[Voice Reset]', 'echo', confirmTTS);
        return;

      } else if (command === 'skip') {
        let currentFileId: number | null = null;
        let currentFileName: string = '';

        if (catWashPlaybackActive && catWashPlaybackState) {
          currentFileId = catWashPlaybackState.fileId;
          currentFileName = catWashPlaybackState.fileName;

          if (nestPlaybackAbort) {
            nestPlaybackAbort();
            nestPlaybackAbort = null;
          }
          await stopNestSpeaker();
          stopWordAdvancement();
          catWashPlaybackActive = false;
          catWashPlaybackStartedAt = null;
          catWashPlaybackState = null;
          stopToothbrushPolling();
        } else if (voiceCommandPauseState_) {
          currentFileId = voiceCommandPauseState_.fileId;
          currentFileName = voiceCommandPauseState_.fileName;
          clearVoiceCommandPause_();
        }

        if (!currentFileId) {
          console.log(`[Voice Command] Skip requested but no active/paused playback`);
          try {
            const noPath = await generateAndSaveTTSAudio("Nothing is playing to skip.", `vc-noskip-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${noPath}`);
          } catch {}
          return res.json({ action: "ignored", reason: "Nothing to skip" });
        }

        console.log(`[Voice Command] Skip: marking "${currentFileName}" as listened and finding next`);

        try {
          await storage.updateFile(currentFileId, { listened: true });
        } catch (e: any) {
          console.error(`[Voice Command] Failed to mark listened: ${e.message}`);
        }

        const semesterSettings = await storage.getActiveSemesterSettings();
        const semStart = semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date("2026-01-12T00:00:00");
        const rwStart = semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : new Date("2026-02-16T00:00:00");
        const currentWeekNumber = getWeekNumber(torontoDate(), semStart, rwStart);

        const allFiles = await storage.getFiles();
        const nextFile = findNextFileByPriority(allFiles, currentWeekNumber, currentFileId);

        if (!nextFile) {
          console.log(`[Voice Command] No more files for week ${currentWeekNumber}`);

          const stopTimestamp = Date.now();
          await Promise.all([
            setTabletCommand({ action: 'stop_playback', goodbyeText: '', timestamp: stopTimestamp }, true, 'master'),
            setTabletCommand({ action: 'stop_playback', timestamp: stopTimestamp }, true, 'tv'),
          ]);

          try {
            await fetch(`${haUrl}/api/services/media_player/turn_off`, {
              method: 'POST', headers: haHeaders,
              body: JSON.stringify({ entity_id: 'media_player.fire_stick_cat_wr' }),
            });
            await fetch(`${haUrl}/api/services/media_player/turn_off`, {
              method: 'POST', headers: haHeaders,
              body: JSON.stringify({ entity_id: 'media_player.samsung_tv' }),
            });
          } catch {}

          try {
            const donePath = await generateAndSaveTTSAudio("Skipped. No more readings for this week. Great work Bryn!", `vc-skipdone-${Date.now()}`);
            await playOnNestSpeaker(`${appUrl}${donePath}`);
          } catch {}

          return res.json({ action: "skipped_and_done", skippedFile: currentFileName });
        }

        const nextFileName = nextFile.displayName || nextFile.originalName || 'Unknown';
        const fileDesc = describeFileForTTS(nextFile, currentWeekNumber);
        console.log(`[Voice Command] Skipping to next: ${fileDesc} (id=${nextFile.id})`);

        try {
          const echoEntities = CAT_ECHO_ENTITIES;
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST', headers: haHeaders,
            body: JSON.stringify({ entity_id: echoEntities }),
          });
        } catch {}

        const confirmTTS = `Skipped. Now playing ${fileDesc}.`;
        catWashPlaybackTrigger = catWashPlaybackTrigger || 'manual';
        catLightsPromptPending = false;

        res.json({ action: "skipping", skippedFile: currentFileName, nextFile: nextFileName });

        await startConfirmedPlaybackFlow(nextFile, '[Voice Skip]', 'echo', confirmTTS);
        return;

      } else if (command === 'clear_player' || command === 'clear player') {
        console.log(`[Voice Command] Clear player requested — resetting all playback state`);

        clearVoiceCommandPause_();

        if (nestPlaybackAbort) {
          nestPlaybackAbort();
          nestPlaybackAbort = null;
        }
        await stopNestSpeaker();
        stopWordAdvancement();
        stopToothbrushPolling();

        if (currentTTSSession) {
          stopTTSSession("Clear player command");
        }

        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        catWashPlaybackState = null;
        catWashManuallyStoppedAt = null;
        catLightsPromptPending = false;
        currentTvFollowUrl = null;
        currentTabletReaderUrl = null;

        try {
          const echoEntities = CAT_ECHO_ENTITIES;
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST', headers: haHeaders,
            body: JSON.stringify({ entity_id: echoEntities }),
          });
        } catch {}

        try {
          const clearPath = await generateAndSaveTTSAudio("Player cleared. Ready for a new session.", `vc-clear-${Date.now()}`);
          await playOnNestSpeaker(`${appUrl}${clearPath}`);
        } catch {}

        return res.json({ action: "cleared" });

      } else {
        console.log(`[Voice Command] Unknown command: "${command}"`);
        return res.json({ action: "unknown", command });
      }

    } catch (error: any) {
      console.error(`[Voice Command] Error: ${error.message}`);
      res.status(500).json({ error: "Voice command failed", details: error.message });
    }
  });

  app.get("/api/voice-command/status", (_req, res) => {
    const status: any = {
      playbackActive: catWashPlaybackActive,
      paused: !!voiceCommandPauseState_,
    };
    if (catWashPlaybackActive && catWashPlaybackState) {
      status.playing = {
        fileId: catWashPlaybackState.fileId,
        fileName: catWashPlaybackState.fileName,
        chunkIndex: catWashPlaybackState.chunkIndex,
        totalChunks: catWashPlaybackState.totalChunks,
      };
    }
    if (voiceCommandPauseState_) {
      status.pauseInfo = {
        fileId: voiceCommandPauseState_.fileId,
        fileName: voiceCommandPauseState_.fileName,
        chunkIndex: voiceCommandPauseState_.chunkIndex,
        pausedAt: voiceCommandPauseState_.pausedAt.toISOString(),
        autoStopIn: Math.max(0, 10 * 60 * 1000 - (Date.now() - voiceCommandPauseState_.pausedAt.getTime())),
      };
    }
    res.json(status);
  });

  app.get("/api/ha/entities", async (_req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const response = await fetch(`${haUrl}/api/states`, {
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) return res.status(response.status).json({ error: "HA request failed" });
      const states: any[] = await response.json();
      const mediaPlayers = states
        .filter((s: any) => s.entity_id.startsWith("media_player."))
        .map((s: any) => ({
          entity_id: s.entity_id,
          friendly_name: s.attributes?.friendly_name || s.entity_id,
          state: s.state,
          device_class: s.attributes?.device_class,
          supported_features: s.attributes?.supported_features,
        }));
      res.json(mediaPlayers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/flick/rooms", (_req, res) => {
    res.json(FLICK_DEVICES);
  });

  app.post("/api/flick", async (req, res) => {
    try {
      const { deviceId, fileId, currentChunkIndex, totalChunks: totalChunksCount } = req.body;
      if (!deviceId) return res.status(400).json({ error: "deviceId is required" });
      if (!fileId) return res.status(400).json({ error: "fileId is required" });

      let device: FlickDevice | undefined;
      for (const group of FLICK_DEVICES) {
        device = group.devices.find(d => d.id === deviceId);
        if (device) break;
      }
      if (!device) return res.status(404).json({ error: "Device not found" });

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      console.log(`[Flick] Sending file ${fileId} to ${device.name} (${device.room}) (chunk ${currentChunkIndex}/${totalChunksCount})`);

      if (typeof currentChunkIndex === 'number' && currentChunkIndex > 0) {
        try {
          await storage.updateFile(fileId, {
            lastChunkIndex: currentChunkIndex,
            totalChunks: totalChunksCount || 0
          });
          console.log(`[Flick] Progress saved: chunk ${currentChunkIndex}`);
        } catch (e) {
          console.error("[Flick] Failed to save progress:", e);
        }
      }

      const appUrl = `https://${req.get('host') || new URL(DEPLOYED_APP_URL).host}`;
      const readerUrl = `${appUrl}/pdf-reader/${fileId}?autoplay=true&speaker=${encodeURIComponent(device.entityId)}`;

      const navigateToReader = async (targetDevice: FlickDevice) => {
        if (!targetDevice.canDisplay) return;
        const speakerEntity = device.entityId;
        const deviceReaderUrl = `${appUrl}/pdf-reader/${fileId}?autoplay=true&speaker=${encodeURIComponent(speakerEntity)}`;
        try {
          if (targetDevice.type === "tablet" || targetDevice.type === "echo_show") {
            const navResp = await fetch(`${haUrl}/api/services/browser_mod/navigate`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                browser_id: targetDevice.entityId,
                path: deviceReaderUrl
              }),
            });
            console.log(`[Flick] Navigated ${targetDevice.entityId} via browser_mod: ${navResp.status}`);
          } else if (targetDevice.type === "tv") {
            const castResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                entity_id: targetDevice.entityId,
                media_content_id: deviceReaderUrl,
                media_content_type: "url"
              }),
            });
            console.log(`[Flick] Cast to TV ${targetDevice.entityId}: ${castResp.status}`);
          }
        } catch (navErr) {
          console.error(`[Flick] Display navigation failed for ${targetDevice.name}:`, navErr);
        }
      };

      if (device.canDisplay) {
        await navigateToReader(device);
      } else if (device.type === "group") {
        const roomGroup = FLICK_DEVICES.find(g => g.devices.some(d => d.id === device.id));
        if (roomGroup) {
          const screenDevices = roomGroup.devices.filter(d => d.canDisplay && d.id !== device.id);
          for (const screenDevice of screenDevices) {
            await navigateToReader(screenDevice);
          }
        }
      }

      res.json({
        success: true,
        device: device.name,
        room: device.room,
        readerUrl,
        entityId: device.entityId,
        canDisplay: device.canDisplay,
        resumeChunk: currentChunkIndex || 0
      });
    } catch (error: any) {
      console.error("[Flick] Error:", error);
      res.status(500).json({ error: "Failed to flick", details: error.message });
    }
  });

  app.get("/api/course-play-priority", (_req, res) => {
    res.json(coursePlayPriority);
  });

  app.post("/api/course-play-priority", (req, res) => {
    coursePlayPriority = req.body || {};
    console.log(`[Course Priority] Updated: ${JSON.stringify(coursePlayPriority)}`);
    res.json({ success: true });
  });

  app.post("/api/trigger-playback", async (req, res) => {
    try {
      const { fileId, weekNumber } = req.body || {};
      console.log(`[Trigger Playback] Manual trigger — fileId=${fileId}, week=${weekNumber}`);

      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const semesterSettings = await storage.getActiveSemesterSettings();
      if (!semesterSettings) {
        return res.status(400).json({ error: "No active semester" });
      }

      const today = torontoDate();
      const semStart = semesterSettings.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : new Date();
      const rwStart = semesterSettings.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : semStart;
      const currentWeek = weekNumber || getWeekNumber(today, semStart, rwStart);

      await syncOneDriveFilesForWeek(semesterSettings, currentWeek, '[Trigger Playback]');

      let targetFile: any = null;
      const allFiles = await storage.getFiles();

      if (fileId) {
        targetFile = allFiles.find((f: any) => f.id === fileId);
      }
      if (!targetFile) {
        targetFile = findNextFileByPriority(allFiles, currentWeek);
      }

      if (!targetFile) {
        const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
        console.log(`[Trigger Playback] No files — playing CHUM FM`);
        await playChumFmRadio(haUrl);
        return res.json({ action: "radio", reason: `All week ${currentWeek} readings complete — playing CHUM FM` });
      }

      const fileName = targetFile.displayName || targetFile.originalName || 'Unknown';
      console.log(`[Trigger Playback] Starting playback: ${fileName} (id=${targetFile.id})`);

      res.json({ action: "playing", file: { id: targetFile.id, name: fileName }, currentWeek });

      await startConfirmedPlaybackFlow(targetFile, '[Trigger Playback]', 'echo');

    } catch (error: any) {
      console.error("[Trigger Playback] Error:", error);
      res.status(500).json({ error: "Failed to trigger playback", details: error.message });
    }
  });

  app.post("/api/webhook/email-homework", async (req, res) => {
    try {
      const webhookSecret = process.env.SITE_PASSWORD;
      const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization']?.replace('Bearer ', '');
      if (webhookSecret && authHeader !== webhookSecret) {
        console.warn("[Email Homework] Unauthorized attempt");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { subject, body, from } = req.body || {};
      console.log(`[Email Homework] ====== RECEIVED ======`);
      console.log(`[Email Homework] From: ${from}, Subject: ${subject}`);
      console.log(`[Email Homework] Body: ${body}`);

      if (!subject) {
        return res.status(400).json({ error: "Missing subject" });
      }

      const coursePattern = /^([A-Z]{3,5}\d{3})\s+/i;
      const courseMatch = subject.match(coursePattern);
      const courseName = courseMatch ? courseMatch[1].toUpperCase() : null;
      const titleText = courseMatch ? subject.slice(courseMatch[0].length).trim() : subject.trim();

      const fullText = [titleText, body || ''].join(' ');

      let dueDate: Date | null = null;
      const dueDatePatterns = [
        /due\s+(\d{4}-\d{2}-\d{2})/i,
        /due\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /due\s+(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      ];
      for (const pat of dueDatePatterns) {
        const m = fullText.match(pat);
        if (m) {
          let dateStr = m[1];
          const hasYear = /\d{4}/.test(dateStr);
          if (!hasYear) {
            dateStr = dateStr.replace(/,?\s*$/, '') + ', ' + new Date().getFullYear();
          }
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            if (parsed.getTime() < Date.now() - 86400000 && !hasYear) {
              parsed.setFullYear(parsed.getFullYear() + 1);
            }
            dueDate = parsed;
            break;
          }
        }
      }

      if (!dueDate) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
      }

      let eventStartTime: string | null = null;
      let eventEndTime: string | null = null;
      const noonMatch = fullText.match(/\bat\s+noon\b/i);
      const timeMatch = fullText.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
      const rangeMatch = fullText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

      if (rangeMatch) {
        let startH = parseInt(rangeMatch[1]);
        const startM = rangeMatch[2] ? parseInt(rangeMatch[2]) : 0;
        const startAmPm = (rangeMatch[3] || rangeMatch[6] || '').toLowerCase();
        let endH = parseInt(rangeMatch[4]);
        const endM = rangeMatch[5] ? parseInt(rangeMatch[5]) : 0;
        const endAmPm = rangeMatch[6].toLowerCase();
        if (startAmPm === 'pm' && startH !== 12) startH += 12;
        if (startAmPm === 'am' && startH === 12) startH = 0;
        if (endAmPm === 'pm' && endH !== 12) endH += 12;
        if (endAmPm === 'am' && endH === 12) endH = 0;
        if (!startAmPm && startH < endH - 5) { if (endH >= 12) startH += 12; }
        eventStartTime = `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}`;
        eventEndTime = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
        dueDate.setHours(startH, startM, 0, 0);
      } else if (noonMatch) {
        eventStartTime = '12:00';
        dueDate.setHours(12, 0, 0, 0);
      } else if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = (timeMatch[3] || '').toLowerCase();
        if (ampm === 'pm' && h !== 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        if (!ampm && h >= 1 && h <= 7) h += 12;
        eventStartTime = `${String(h).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
        dueDate.setHours(h, mins, 0, 0);
      } else {
        dueDate.setHours(9, 0, 0, 0);
      }

      let taskType = courseName ? 'reading' : 'reminder';
      const typeLower = fullText.toLowerCase();
      if (/\bessay\b/.test(typeLower)) taskType = 'essay';
      else if (/\bquiz\b/.test(typeLower)) taskType = 'quiz';
      else if (/\bexam\b|\btest\b|\bfinal\b|\bmidterm\b/.test(typeLower)) taskType = 'exam';
      else if (/\bdiscussion\b|\bforum\b|\bpost\b/.test(typeLower)) taskType = 'discussion';
      else if (/\bproject\b|\bpresentation\b/.test(typeLower)) taskType = 'project';
      else if (/\bpoll\b|\bsurvey\b/.test(typeLower)) taskType = 'poll';
      else if (/\bmodule\b/.test(typeLower)) taskType = 'module';

      let weekNumber = 1;
      const weekMatch = fullText.match(/week\s*(\d+)/i);
      if (weekMatch) {
        weekNumber = parseInt(weekMatch[1], 10);
      } else {
        const semesterSettings = await storage.getActiveSemesterSettings();
        if (semesterSettings?.semesterStartDate) {
          const { getWeekNumber } = await import('../shared/schema');
          weekNumber = getWeekNumber(
            new Date(),
            new Date(semesterSettings.semesterStartDate),
            semesterSettings.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : null
          );
        }
      }

      let priority = 'medium';
      if (/\burgent\b|\bhigh\b|\basap\b|\bimportant\b/i.test(fullText)) priority = 'high';
      else if (/\blow\b|\boptional\b/i.test(fullText)) priority = 'low';

      const description = body?.trim() || null;

      const emailMessageId = req.body.messageId || `gmail-${Date.now()}`;
      const existing = await storage.getPendingReviewItemByExternalId(emailMessageId, 'gmail_task');
      if (existing) {
        console.log(`[Email Homework] Already queued: ${emailMessageId}`);
        return res.json({ success: true, queued: true, alreadyExists: true, id: existing.id });
      }

      const reviewItem = await storage.createPendingReviewItem({
        source: 'gmail_task',
        sourceEmail: from || null,
        externalId: emailMessageId,
        title: titleText,
        description: description,
        startDate: dueDate,
        endDate: null,
        eventStartTime: eventStartTime,
        eventEndTime: eventEndTime,
        location: null,
        rawData: JSON.stringify({ subject, body, from, parsedType: taskType, courseName, weekNumber, priority }),
        status: 'pending',
        courseName: courseName,
        taskType: taskType,
      });

      console.log(`[Email Homework] Queued for review #${reviewItem.id}: "${titleText}" (${taskType}, ${courseName})`);
      res.json({ success: true, queued: true, reviewItemId: reviewItem.id, title: titleText, type: taskType, courseName });

    } catch (error: any) {
      console.error("[Email Homework] Error:", error);
      res.status(500).json({ error: "Failed to create task from email", details: error.message });
    }
  });

  // POST /api/webhook/play-urgent-pdf - Home Assistant webhook to play most urgent unlistened PDF
  // Priority: 1) CPPA modules, 2) Other course modules, 3) CPPA readings
  // Resumes from last position if partially listened
  app.post("/api/webhook/play-urgent-pdf", async (req, res) => {
    try {
      console.log("[Webhook] play-urgent-pdf triggered");
      
      // Authenticate webhook using SITE_PASSWORD as shared secret
      const webhookSecret = process.env.SITE_PASSWORD;
      const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization']?.replace('Bearer ', '');
      if (webhookSecret && authHeader !== webhookSecret) {
        console.warn("[Webhook] Unauthorized play-urgent-pdf attempt");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Validate entity_id against known speakers
      const allowedEntities = [
        BATHROOM_ECHO_ENTITY, KITCHEN_ECHO_ENTITY, NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY,
        "media_player.cat_wash_2",
        ...CAT_ECHO_ENTITIES, "media_player.echo_closet_am",
        "media_player.echo_lr_couch_r_am", "media_player.echo_hallway_entrance_am",
        "media_player.echo_king_l_am", "media_player.echo_king_r_am",
        "media_player.echo_king_tv_am", "media_player.echo_kitchen_cupboards_left_am",
        "media_player.echo_kitchen_cupboards_r_am", "media_player.echo_kitchen_fridge_am",
        "media_player.echo_kitchen_hutch_am", "media_player.echo_kitchen_island_corner_am",
        "media_player.echo_kitchen_studio_black_am", "media_player.echo_lr_hub_am"
      ];
      const requestedEntity = req.body?.entity_id || NEST_SPEAKER_ENTITY;
      const targetEntity = allowedEntities.includes(requestedEntity) ? requestedEntity : NEST_SPEAKER_ENTITY;
      
      // Get current week number
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(torontoDate(), new Date(semesterSettings.semesterStartDate));
      }
      
      // Get all files
      const allFiles = await storage.getFiles();
      
      // Filter for unlistened files in current week
      const unlistenedFiles = allFiles.filter((f: any) => {
        if (f.listened) return false;
        const weekMatch = f.folder?.match(/week-(\d+)/i);
        return weekMatch && parseInt(weekMatch[1], 10) === currentWeekNumber;
      });
      
      // Priority buckets
      const isCPPA = (f: any) => f.folder?.toLowerCase().includes('cppa');
      const isModule = (f: any) => f.folder?.toLowerCase().includes('module');
      
      const cppaModules = unlistenedFiles.filter((f: any) => isCPPA(f) && isModule(f));
      const otherModules = unlistenedFiles.filter((f: any) => !isCPPA(f) && isModule(f));
      const cppaReadings = unlistenedFiles.filter((f: any) => isCPPA(f) && !isModule(f));
      const otherReadings = unlistenedFiles.filter((f: any) => !isCPPA(f) && !isModule(f));
      
      const orderedFiles = [...cppaModules, ...otherModules, ...cppaReadings, ...otherReadings];
      
      if (orderedFiles.length === 0) {
        // Announce that all readings are complete
        const isNonAlexaTarget = NON_ALEXA_ENTITIES.includes(targetEntity);
        console.log("[Webhook] No urgent PDFs found, announcing completion");
        const completionMsg = `All week ${currentWeekNumber} readings are complete. Great job!`;
        if (isNonAlexaTarget) {
          const audioPath = await generateAndSaveTTSAudio(completionMsg, `tts-done-${Date.now()}`, "echo");
          const appUrl = DEPLOYED_APP_URL;
          await fetch(`${haUrl}/api/services/media_player/play_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: targetEntity, media_content_id: `${appUrl}${audioPath}`, media_content_type: "music" }),
          });
        } else {
          await fetch(`${haUrl}/api/services/notify/alexa_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: completionMsg, target: targetEntity, data: { type: "tts" } }),
          });
        }
        return res.json({ action: "complete", message: `All week ${currentWeekNumber} readings done` });
      }
      
      const nextFile = orderedFiles[0];
      const fileName = nextFile.displayName || nextFile.originalName;
      const courseMatch = nextFile.folder?.match(/(cppa|cfnf|csoc|cphl|casl)\d*/i);
      const courseName = courseMatch ? courseMatch[0].toUpperCase() : '';
      const fileType = isModule(nextFile) ? 'module' : 'reading';
      
      console.log(`[Webhook] Selected: ${courseName} ${fileType} - ${fileName}`);
      
      // Stop any existing TTS session
      if (currentTTSSession) {
        stopTTSSession("New webhook playback requested");
      }
      
      // Extract text from the PDF
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      let textContent = "";
      try {
        const objectFile = await objectStorage.getObjectEntityFile(nextFile.objectPath);
        const [content] = await objectFile.download();
        
        const isPDF = content.slice(0, 4).toString() === '%PDF';
        if (isPDF) {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(content), verbosity: 0 });
          await parser.load();
          const pdfText = await parser.getText();
          
          if (pdfText && typeof pdfText === 'object') {
            if (pdfText.pages && Array.isArray(pdfText.pages)) {
              textContent = pdfText.pages.map((page: any) => page.text || '').join(' ');
            } else if (Array.isArray(pdfText)) {
              textContent = pdfText.map((item: any) => typeof item === 'string' ? item : item.text || '').join(' ');
            } else if (pdfText.text) {
              textContent = pdfText.text;
            } else {
              textContent = Object.values(pdfText).filter(v => typeof v === 'string').join(' ');
            }
          } else {
            textContent = String(pdfText || '');
          }
          await parser.destroy();
        } else {
          textContent = content.toString('utf-8');
        }
      } catch (error) {
        console.error("[Webhook] Error extracting text:", error);
        return res.status(500).json({ error: "Failed to extract text from file" });
      }
      
      if (!textContent.trim()) {
        return res.status(400).json({ error: "File is empty or not readable" });
      }
      
      // Clean text for TTS
      const fullCleanedText = cleanTextForTTS(textContent);
      
      // Determine resume position from database progress or in-memory progress
      let resumePosition = 0;
      const progressKey = `file-${nextFile.id}`;
      const memProgress = playbackProgress[progressKey];
      
      if (nextFile.lastChunkIndex && nextFile.lastChunkIndex > 0 && nextFile.totalChunks && nextFile.totalChunks > 0) {
        // Estimate character position from chunk progress
        const chunkRatio = nextFile.lastChunkIndex / nextFile.totalChunks;
        resumePosition = Math.floor(chunkRatio * fullCleanedText.length);
        console.log(`[Webhook] Resuming from DB progress: chunk ${nextFile.lastChunkIndex}/${nextFile.totalChunks} (~char ${resumePosition})`);
      } else if (memProgress) {
        const chunkRatio = memProgress.chunkIndex / memProgress.totalChunks;
        resumePosition = Math.floor(chunkRatio * fullCleanedText.length);
        console.log(`[Webhook] Resuming from memory progress: chunk ${memProgress.chunkIndex}/${memProgress.totalChunks} (~char ${resumePosition})`);
      }
      
      // Build announcement
      const isResuming = resumePosition > 0;
      const progressPct = resumePosition > 0 ? Math.round((resumePosition / fullCleanedText.length) * 100) : 0;
      const announcement = isResuming
        ? `Resuming ${courseName} ${fileType}, ${fileName.replace('.pdf', '')}, at ${progressPct} percent.`
        : `Now reading ${courseName} ${fileType}, ${fileName.replace('.pdf', '')}. ${orderedFiles.length} file${orderedFiles.length > 1 ? 's' : ''} remaining this week.`;
      
      // Get the text from resume position
      const remainingText = fullCleanedText.substring(resumePosition);
      
      // Create TTS session
      currentTTSSession = {
        fullText: remainingText.length > 100000 ? remainingText.substring(0, 100000) : remainingText,
        currentPosition: 0,
        startTime: Date.now(),
        isPlaying: true,
        autoTimer: null,
        consecutiveErrors: 0,
        sessionCreatedAt: Date.now(),
        targetEntity
      };
      
      // Restore volume
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
      
      // Build first chunk with announcement
      let firstChunk = cleanTextForTTS(remainingText.substring(0, 3000));
      firstChunk = getChunkWithSentenceBoundary(firstChunk, CHUNK_SIZE);
      const fullFirstMessage = `${announcement} ... ${firstChunk}`;
      const isNonAlexaTarget = NON_ALEXA_ENTITIES.includes(targetEntity);
      
      console.log(`[Webhook] Sending first chunk (${firstChunk.length} chars) to ${targetEntity} ${isNonAlexaTarget ? '(non-Alexa)' : '(Alexa)'}`);
      
      let response: Response;
      if (isNonAlexaTarget) {
        const audioPath = await generateAndSaveTTSAudio(fullFirstMessage, `tts-first-${Date.now()}`, "echo");
        const appUrl = DEPLOYED_APP_URL;
        const fullAudioUrl = `${appUrl}${audioPath}`;
        console.log(`[Webhook] Non-Alexa: Generated audio at ${audioPath}`);
        
        response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: targetEntity, media_content_id: fullAudioUrl, media_content_type: "music" }),
        });
      } else {
        const ssmlContent = `<speak><prosody rate="90%">${fullFirstMessage}</prosody></speak>`;
        response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: ssmlContent, target: targetEntity, data: { type: "tts" } }),
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Webhook] HA TTS error:", errorText);
        currentTTSSession = null;
        return res.status(response.status).json({ error: "Failed to start playback" });
      }
      
      // Update position after first chunk
      currentTTSSession.currentPosition = firstChunk.length;
      
      // Save progress with correct resume chunk index
      const totalChunksForFile = Math.ceil(fullCleanedText.length / CHUNK_SIZE);
      const resumeChunkIndex = resumePosition > 0 ? Math.floor(resumePosition / CHUNK_SIZE) : 0;
      playbackProgress[progressKey] = {
        chunkIndex: resumeChunkIndex,
        totalChunks: totalChunksForFile,
        lastPlayed: new Date(),
        fileId: nextFile.id
      };
      
      // Schedule auto-continuation
      scheduleNextChunk();
      
      console.log(`[Webhook] Playback started: ${courseName} ${fileType} - ${fileName}`);
      
      res.json({
        action: "playing",
        file: { id: nextFile.id, name: fileName, folder: nextFile.folder },
        course: courseName,
        type: fileType,
        resuming: isResuming,
        progressPercent: progressPct,
        remainingFiles: orderedFiles.length,
        currentWeek: currentWeekNumber
      });
      
    } catch (error: any) {
      console.error("[Webhook] play-urgent-pdf error:", error);
      res.status(500).json({ error: "Failed to play urgent PDF", details: error.message });
    }
  });

  // POST /api/ha/register-play-urgent-script - Register a Home Assistant script for Alexa routines
  app.post("/api/ha/register-play-urgent-script", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = req.body?.appUrl || `https://${req.headers.host}`;
      
      // Create a HA script that calls our webhook endpoint
      const scriptConfig = {
        alias: "Play Urgent School Reading",
        description: "Plays the most urgent unlistened PDF from school courses on Echo speakers",
        icon: "mdi:book-open-page-variant",
        mode: "single",
        sequence: [
          {
            service: "rest_command.play_urgent_pdf",
            data: {}
          }
        ]
      };
      
      // First register the REST command
      // We need to create a rest_command via HA config - notify user of manual step
      const webhookUrl = `${appUrl}/api/webhook/play-urgent-pdf`;
      
      res.json({
        success: true,
        webhookUrl,
        haSetupInstructions: {
          step1: "Add this to your Home Assistant configuration.yaml under rest_command:",
          restCommand: {
            play_urgent_pdf: {
              url: webhookUrl,
              method: "POST",
              content_type: "application/json",
              headers: {
                "x-webhook-secret": "YOUR_SITE_PASSWORD_HERE"
              },
              payload: '{"entity_id": "media_player.bathroom_speaker"}'
            }
          },
          step2: "Add this script to your configuration.yaml under script:",
          script: {
            play_urgent_school_reading: scriptConfig
          },
          step3: "Restart Home Assistant, then expose 'Play Urgent School Reading' to Alexa via Nabu Casa",
          step4: "The script will appear as an action in Alexa routines"
        }
      });
      
    } catch (error: any) {
      console.error("Register HA script error:", error);
      res.status(500).json({ error: "Failed to generate HA config", details: error.message });
    }
  });

  // POST /api/files/generate-all-tts - Pre-generate TTS audio for all module files
  app.post("/api/files/generate-all-tts", async (req, res) => {
    try {
      const { weekNumber } = req.body;
      
      // Get all module files for the specified week (or all weeks if not specified)
      const allFiles = await storage.getFiles();
      const moduleFiles = allFiles.filter((f: FileRecord) => {
        const isModule = f.folder?.includes('-module');
        const matchesWeek = weekNumber ? f.folder?.includes(`week-${weekNumber}-`) : true;
        const needsGeneration = !f.ttsAudioUrl;
        return isModule && matchesWeek && needsGeneration;
      });
      
      console.log(`Pre-generating TTS for ${moduleFiles.length} module files...`);
      
      const results: { fileId: number; name: string; status: string; audioUrl?: string; error?: string }[] = [];
      
      for (const file of moduleFiles) {
        try {
          console.log(`Generating TTS for: ${file.displayName}`);
          
          // Download the PDF from OneDrive
          const objectPath = file.objectPath;
          const content = await getOneDriveFile(objectPath);
          
          if (!content) {
            results.push({ fileId: file.id, name: file.displayName, status: 'error', error: 'Empty file' });
            continue;
          }
          
          // Extract text from PDF
          let textContent = '';
          if (file.contentType?.includes('pdf') || file.originalName.endsWith('.pdf')) {
            const PdfParser = await getPdfParser();
            const parsed = await PdfParser(content);
            textContent = parsed.text;
          } else if (Buffer.isBuffer(content)) {
            textContent = content.toString('utf-8');
          }
          
          if (!textContent.trim()) {
            results.push({ fileId: file.id, name: file.displayName, status: 'error', error: 'No text content' });
            continue;
          }
          
          // Generate OpenAI TTS audio and save to object storage
          const audioPath = await generateAndSaveTTSAudio(textContent, `module-${file.id}`);
          const audioUrl = `${DEPLOYED_APP_URL}${audioPath}`;
          
          // Update file record with audio URL
          await storage.updateFile(file.id, { 
            ttsAudioUrl: audioUrl,
            ttsGeneratedAt: new Date()
          });
          
          results.push({ fileId: file.id, name: file.displayName, status: 'success', audioUrl });
          console.log(`TTS generated for: ${file.displayName}`);
          
        } catch (error: any) {
          console.error(`Error generating TTS for ${file.displayName}:`, error);
          results.push({ fileId: file.id, name: file.displayName, status: 'error', error: error.message });
        }
      }
      
      res.json({
        success: true,
        totalFiles: moduleFiles.length,
        results
      });
      
    } catch (error: any) {
      console.error("Error generating TTS files:", error);
      res.status(500).json({ error: "Failed to generate TTS files", details: error.message });
    }
  });

  // POST /api/shower/mark-listened - Mark a file as listened
  app.post("/api/shower/mark-listened", async (req, res) => {
    try {
      const { fileId } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ error: "File ID required" });
      }
      
      // Update the file to mark it as listened
      await storage.updateFile(fileId, { listened: true });
      
      // Clear progress for this file
      delete playbackProgress[`file-${fileId}`];
      
      res.json({ success: true, fileId, listened: true });
    } catch (error) {
      console.error("Error marking file as listened:", error);
      res.status(500).json({ error: "Failed to mark file as listened" });
    }
  });

  // POST /api/shower/next-chunk - Continue to next chunk of current file
  app.post("/api/shower/next-chunk", async (req, res) => {
    try {
      const { fileId, entityId } = req.body;
      const targetEntity = entityId || NEST_SPEAKER_ENTITY;
      
      if (!fileId) {
        return res.status(400).json({ error: "File ID required" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Get the file
      const allFiles = await storage.getFiles();
      const file = allFiles.find((f: any) => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Get current progress
      const progressKey = `file-${fileId}`;
      const progress = playbackProgress[progressKey];
      
      if (!progress) {
        return res.status(400).json({ error: "No progress found for this file. Use /trigger to start." });
      }
      
      const nextChunkIndex = progress.chunkIndex + 1;
      
      // If we've finished all chunks, mark as listened
      if (nextChunkIndex >= progress.totalChunks) {
        await storage.updateFile(fileId, { listened: true });
        delete playbackProgress[progressKey];
        
        return res.json({
          action: "completed",
          message: "File reading complete!",
          fileId,
          listened: true
        });
      }
      
      // Extract text again to get the chunk
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      let textContent = "";
      try {
        const objectFile = await objectStorage.getObjectEntityFile(file.objectPath);
        const [content] = await objectFile.download();
        
        const isPDF = content.slice(0, 4).toString() === '%PDF';
        if (isPDF) {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(content), verbosity: 0 });
          await parser.load();
          const pdfText = await parser.getText();
          
          if (pdfText && typeof pdfText === 'object') {
            if (pdfText.pages && Array.isArray(pdfText.pages)) {
              textContent = pdfText.pages.map((page: any) => page.text || '').join(' ');
            } else if (Array.isArray(pdfText)) {
              textContent = pdfText.map((item: any) => typeof item === 'string' ? item : item.text || '').join(' ');
            } else if (pdfText.text) {
              textContent = pdfText.text;
            }
          } else {
            textContent = String(pdfText || '');
          }
          await parser.destroy();
        } else {
          textContent = content.toString('utf-8');
        }
      } catch (error) {
        console.error("Error extracting text:", error);
        return res.status(500).json({ error: "Failed to extract text from file" });
      }
      
      // Chunk the text
      let cleanedContent = textContent.trim().replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, ' ');
      const chunks = cleanedContent.match(/.{1,450}[.!?]?\s*/g) || [cleanedContent];
      const chunk = chunks[nextChunkIndex];
      
      // Send TTS
      const chunkMessage = `Section ${nextChunkIndex + 1} of ${chunks.length}. ${chunk}`;
      const isNonAlexa = NON_ALEXA_ENTITIES.includes(targetEntity);
      if (isNonAlexa) {
        const audioPath = await generateAndSaveTTSAudio(chunkMessage, `next-chunk-${fileId}-${nextChunkIndex}`, "echo");
        const appUrl = DEPLOYED_APP_URL;
        await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: targetEntity, media_content_id: `${appUrl}${audioPath}`, media_content_type: "music" }),
        });
      } else {
        await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: chunkMessage, target: targetEntity, data: { type: "tts" } }),
        });
      }
      
      // Update progress
      playbackProgress[progressKey] = {
        chunkIndex: nextChunkIndex,
        totalChunks: chunks.length,
        lastPlayed: new Date()
      };
      
      res.json({
        action: "reading",
        fileId,
        chunkIndex: nextChunkIndex,
        totalChunks: chunks.length,
        hasMore: nextChunkIndex < chunks.length - 1
      });
      
    } catch (error) {
      console.error("Error playing next chunk:", error);
      res.status(500).json({ error: "Failed to play next chunk" });
    }
  });

  // POST /api/shower/update-progress - Update playback progress
  app.post("/api/shower/update-progress", async (req, res) => {
    try {
      const { taskId, chunkIndex, totalChunks } = req.body;
      
      if (!taskId) {
        return res.status(400).json({ error: "Task ID required" });
      }
      
      const progressKey = `task-${taskId}`;
      playbackProgress[progressKey] = {
        chunkIndex: chunkIndex || 0,
        totalChunks: totalChunks || 0,
        lastPlayed: new Date()
      };
      
      res.json({ success: true, progress: playbackProgress[progressKey] });
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  // GET /api/partner-status - Check if partner's phone is away from home
  app.post("/api/ha/service", async (req, res) => {
    try {
      const { domain, service, data } = req.body;
      if (!domain || !service) return res.status(400).json({ error: "domain and service required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const resp = await fetch(`${haUrl}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      });
      console.log(`[HA Service] ${domain}/${service}: ${resp.status}`);
      res.json({ status: resp.status });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/partner-status", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      const response = await fetch(`${haUrl}/api/states/${PARTNER_PHONE_ENTITY}`, {
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get partner status: ${response.status}`);
      }
      
      const data = await response.json();
      const state = data.state?.toLowerCase() || '';
      
      // Partner is "at work" if state is "work" (zone.work)
      // Partner is "away" if state is not "home" (could be "not_home", "work", etc.)
      const isAtWork = state === 'work';
      const isAway = state !== 'home';
      
      res.json({ 
        isAway,
        isAtWork,
        state: data.state,
        friendlyName: data.attributes?.friendly_name || PARTNER_PHONE_ENTITY
      });
    } catch (error: any) {
      console.error("Error checking partner status:", error);
      res.status(500).json({ error: "Failed to check partner status", details: error.message });
    }
  });

  // POST /api/ha/automation/partner-leaves-work - Create HA automation to notify when partner leaves work zone
  app.post("/api/ha/automation/partner-leaves-work", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      const automationConfig = {
        alias: "Notify when Yasu leaves work",
        description: "Send push notification to iPhone when Yasu's phone leaves the work zone",
        mode: "single",
        trigger: [
          {
            platform: "zone",
            entity_id: PARTNER_PHONE_ENTITY,
            zone: "zone.work",
            event: "leave"
          }
        ],
        condition: [],
        action: [
          {
            service: "notify.mobile_app_iphone_10",
            data: {
              title: "Yasu Left Work",
              message: "Yasu just left the work zone.",
              data: {
                push: {
                  sound: "default",
                  interruption_level: "time-sensitive"
                }
              }
            }
          }
        ]
      };

      const response = await fetch(`${haUrl}/api/services/automation/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(automationConfig),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HA automation create error, trying config endpoint:', errorText);

        const configResponse = await fetch(`${haUrl}/api/config/automation/config/uni_cal_partner_leaves_work`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(automationConfig),
        });

        if (!configResponse.ok) {
          const configError = await configResponse.text();
          console.error('HA automation config error:', configError);
          return res.status(500).json({ error: "Failed to create automation", details: configError });
        }
      }

      console.log('HA automation created: Notify when Yasu leaves work');
      res.json({ success: true, message: "Automation created: You'll get a notification when Yasu leaves the work zone" });
    } catch (error: any) {
      console.error("Error creating partner leaves work automation:", error);
      res.status(500).json({ error: "Failed to create automation", details: error.message });
    }
  });

  // GET /api/ha/device-trackers - List all device trackers to find correct entity IDs
  app.get("/api/ha/device-trackers", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      const response = await fetch(`${haUrl}/api/states`, {
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get states: ${response.status}`);
      }
      
      const data = await response.json();
      // Filter to device_tracker and person entities
      const trackers = data.filter((entity: any) => 
        entity.entity_id.startsWith('device_tracker.') || 
        entity.entity_id.startsWith('person.')
      ).map((entity: any) => ({
        entity_id: entity.entity_id,
        state: entity.state,
        friendly_name: entity.attributes?.friendly_name
      }));
      
      res.json(trackers);
    } catch (error: any) {
      console.error("Error listing device trackers:", error);
      res.status(500).json({ error: "Failed to list device trackers", details: error.message });
    }
  });

  // POST /api/kitchen/trigger - Trigger reading on kitchen Echo (same as shower but different speaker)
  app.post("/api/kitchen/trigger", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // First, sync OneDrive to get latest files
      console.log("Kitchen trigger: Syncing OneDrive...");
      try {
        const syncResp = await fetch('http://localhost:5000/api/onedrive/sync', { method: 'POST' });
        if (!syncResp.ok) {
          console.log("OneDrive sync warning:", await syncResp.text());
        }
      } catch (syncErr) {
        console.log("OneDrive sync skipped:", syncErr);
      }
      
      // Get current week number from semester settings
      const semesterSettings = await storage.getActiveSemesterSettings();
      const today = torontoDate();
      let currentWeekNumber = 1;
      
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(today, new Date(semesterSettings.semesterStartDate));
      }
      
      console.log(`Kitchen trigger: Current week is ${currentWeekNumber}`);
      
      // Get all files and filter to current week's unlistened files
      const allFiles = await storage.getFiles();
      const weekFiles = allFiles.filter((f: any) => {
        if (f.listened) return false;
        const folderLower = (f.folder || '').toLowerCase();
        const weekMatch = folderLower.match(/week[- ]?(\d+)/);
        if (!weekMatch) return false;
        const fileWeek = parseInt(weekMatch[1], 10);
        return fileWeek === currentWeekNumber;
      });
      
      const orderedFiles = orderFilesByCoursePriority(
        weekFiles.filter((f: any) => {
          const folder = (f.folder || '').toLowerCase();
          return !folder.includes('casl') && !folder.includes('asl');
        })
      );
      
      // If no unlistened files, play radio
      if (orderedFiles.length === 0) {
        console.log("Kitchen trigger: All readings complete, playing radio");
        
        await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: KITCHEN_ECHO_ENTITY,
            media_content_id: "play 104.5 chumfm",
            media_content_type: "custom"
          }),
        });
        
        return res.json({ 
          action: "radio", 
          message: "All readings complete for this week! Playing CHUM FM 104.5",
          currentWeek: currentWeekNumber
        });
      }
      
      // Get the next file to read
      const nextFile = orderedFiles[0];
      const fileName = nextFile.displayName || nextFile.originalName || 'Unknown file';
      const folder = nextFile.folder || '';
      
      // Determine course and type for announcement
      const isCPPA = folder.toLowerCase().includes('cppa');
      const isModule = folder.toLowerCase().includes('module');
      const courseName = isCPPA ? 'CPPA 122 Local Politics and Government' : 'CFNF 400 Human Sexuality';
      const contentType = isModule ? 'Module' : 'Reading';
      
      console.log(`Kitchen trigger: Playing ${fileName}`);
      
      // Check for existing progress - resume from the same chunk (replay it)
      const progressKey = `file-${nextFile.id}`;
      const existingProgress = playbackProgress[progressKey];
      // Resume from the same chunk that was last playing (replay it)
      const resumeFromChunk = existingProgress?.lastCompletedChunk ?? 0;
      
      // Extract text from the file
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      let textContent = "";
      try {
        const objectFile = await objectStorage.getObjectEntityFile(nextFile.objectPath);
        const [content] = await objectFile.download();
        
        const isPDF = content.slice(0, 4).toString() === '%PDF';
        if (isPDF) {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(content), verbosity: 0 });
          await parser.load();
          const pdfText = await parser.getText();
          
          if (pdfText && typeof pdfText === 'object') {
            if (pdfText.pages && Array.isArray(pdfText.pages)) {
              textContent = pdfText.pages.map((page: any) => page.text || '').join(' ');
            } else if (Array.isArray(pdfText)) {
              textContent = pdfText.map((item: any) => typeof item === 'string' ? item : item.text || '').join(' ');
            } else if (pdfText.text) {
              textContent = pdfText.text;
            }
          } else {
            textContent = String(pdfText || '');
          }
          await parser.destroy();
        } else {
          textContent = content.toString('utf-8');
        }
      } catch (error) {
        console.error("Error extracting text from file:", error);
        return res.status(500).json({ error: "Failed to extract text from file" });
      }
      
      // Chunk the text (~450 chars per chunk for TTS)
      let cleanedContent = textContent.trim().replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, ' ');
      const chunks = cleanedContent.match(/.{1,450}[.!?]?\s*/g) || [cleanedContent];
      
      // Announce what we're about to read
      const announcement = resumeFromChunk > 0 
        ? `Resuming ${courseName}, ${contentType}: ${fileName.replace('.pdf', '')}. Starting from section ${resumeFromChunk + 1} of ${chunks.length}.`
        : `Now reading ${courseName}, ${contentType}: ${fileName.replace('.pdf', '')}. ${chunks.length} sections total.`;
      
      // Send announcement
      await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: announcement,
          target: KITCHEN_ECHO_ENTITY,
          data: { type: "tts" }
        }),
      });
      
      // Return immediately - play chunks in background
      res.json({
        action: "reading",
        file: {
          id: nextFile.id,
          name: fileName,
          folder: nextFile.folder
        },
        currentWeek: currentWeekNumber,
        totalChunks: chunks.length,
        startingFromChunk: resumeFromChunk + 1,
        remainingFiles: orderedFiles.length - 1
      });
      
      // Set up abort controller for stopping playback
      kitchenPlaybackAbortController = new AbortController();
      kitchenPlaybackActive = true;
      
      // Play chunks in background (don't await)
      (async () => {
        try {
          // Wait for announcement to finish (~5 seconds should be enough)
          await new Promise(resolve => setTimeout(resolve, 6000));
          
          for (let i = resumeFromChunk; i < chunks.length; i++) {
            // Check if playback was stopped
            if (!kitchenPlaybackActive) {
              console.log(`Kitchen trigger: Playback stopped at chunk ${i + 1}`);
              break;
            }
            
            const chunk = chunks[i];
            console.log(`Kitchen trigger: Playing chunk ${i + 1} of ${chunks.length}`);
            
            await fetch(`${haUrl}/api/services/notify/alexa_media`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: chunk,
                target: KITCHEN_ECHO_ENTITY,
                data: { type: "tts" }
              }),
            });
            
            // Save progress after each chunk starts
            playbackProgress[progressKey] = {
              chunkIndex: i,
              lastCompletedChunk: i,
              totalChunks: chunks.length,
              lastPlayed: new Date(),
              fileId: nextFile.id
            };
            
            // IMPORTANT: Alexa TTS takes time to process before speaking
            // Use ~50 chars per second (slower estimate) + 5 second buffer for processing
            const estimatedDuration = Math.max(8000, (chunk.length / 50) * 1000 + 5000);
            console.log(`Kitchen trigger: Waiting ${estimatedDuration}ms for chunk ${i + 1} (${chunk.length} chars)`);
            await new Promise(resolve => setTimeout(resolve, estimatedDuration));
          }
          
          // All chunks complete - mark file as listened (only if not stopped)
          if (kitchenPlaybackActive) {
            console.log(`Kitchen trigger: All ${chunks.length} chunks complete, marking file ${nextFile.id} as listened`);
            await storage.updateFile(nextFile.id, { listened: true });
            delete playbackProgress[progressKey];
          }
          
          kitchenPlaybackActive = false;
          kitchenPlaybackAbortController = null;
        } catch (error) {
          console.error("Kitchen background playback error:", error);
          kitchenPlaybackActive = false;
          kitchenPlaybackAbortController = null;
        }
      })();
      
    } catch (error: any) {
      console.error("Kitchen trigger error:", error);
      res.status(500).json({ error: "Failed to trigger kitchen reading", details: error.message });
    }
  });
  
  // POST /api/kitchen/stop - Stop playback on kitchen Echo
  app.post("/api/kitchen/stop", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Stop background playback loop
      kitchenPlaybackActive = false;
      if (kitchenPlaybackAbortController) {
        kitchenPlaybackAbortController.abort();
        kitchenPlaybackAbortController = null;
      }
      
      // Stop media playback on Echo
      await fetch(`${haUrl}/api/services/media_player/media_stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: KITCHEN_ECHO_ENTITY
        }),
      });
      
      console.log("Kitchen playback stopped (both background loop and Echo)");
      
      res.json({ success: true, message: "Playback stopped on Kitchen Echo" });
    } catch (error: any) {
      console.error("Kitchen stop error:", error);
      res.status(500).json({ error: "Failed to stop kitchen playback", details: error.message });
    }
  });
  
  // GET /api/kitchen/status - Get current playback status
  app.get("/api/kitchen/status", async (req, res) => {
    res.json({
      isPlaying: kitchenPlaybackActive,
      progress: Object.values(playbackProgress).find(p => (p as any).fileId) || null
    });
  });
  
  // GET /api/tts/status - Get TTS session status
  app.get("/api/tts/status", (req, res) => {
    if (!currentTTSSession) {
      return res.json({ active: false });
    }
    res.json({
      active: true,
      isPlaying: currentTTSSession.isPlaying,
      position: currentTTSSession.currentPosition,
      totalLength: currentTTSSession.fullText.length,
      progressPercent: Math.round((currentTTSSession.currentPosition / currentTTSSession.fullText.length) * 100),
      consecutiveErrors: currentTTSSession.consecutiveErrors,
      sessionAgeMinutes: Math.round((Date.now() - currentTTSSession.sessionCreatedAt) / 60000),
      targetEntity: currentTTSSession.targetEntity
    });
  });

  // POST /api/tts/force-stop - Force stop any running TTS session
  app.post("/api/tts/force-stop", (req, res) => {
    if (currentTTSSession) {
      stopTTSSession("Force stopped via API");
      currentTTSSession = null;
    }
    res.json({ success: true, message: "TTS session force stopped" });
  });

  // POST /api/shower/start-reading - Start TTS playback on Echo
  app.post("/api/shower/start-reading", async (req, res) => {
    try {
      const { text, taskId, chunkIndex = 0 } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text content required" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      // Chunk text for TTS (max ~500 chars for Echo TTS)
      const chunks = text.match(/.{1,450}[.!?]?\s*/g) || [text];
      const chunk = chunks[chunkIndex] || chunks[0];
      
      // Update progress
      if (taskId) {
        playbackProgress[`task-${taskId}`] = {
          chunkIndex,
          totalChunks: chunks.length,
          lastPlayed: new Date()
        };
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Send TTS to Nest speaker
      const isNonAlexa = NON_ALEXA_ENTITIES.includes(NEST_SPEAKER_ENTITY);
      let response: Response;
      if (isNonAlexa) {
        const audioPath = await generateAndSaveTTSAudio(chunk, `start-reading-${Date.now()}`, "echo");
        const appUrl = DEPLOYED_APP_URL;
        response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: NEST_SPEAKER_ENTITY, media_content_id: `${appUrl}${audioPath}`, media_content_type: "music" }),
        });
      } else {
        response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: chunk, target: NEST_SPEAKER_ENTITY, data: { type: "tts" } }),
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant TTS error:", errorText);
        return res.status(response.status).json({ error: "Failed to send TTS" });
      }
      
      res.json({ 
        success: true, 
        chunkIndex,
        totalChunks: chunks.length,
        hasMore: chunkIndex < chunks.length - 1
      });
    } catch (error) {
      console.error("Error starting reading:", error);
      res.status(500).json({ error: "Failed to start reading" });
    }
  });

  // POST /api/shower/sync-onedrive - Auto-sync module/reading files from OneDrive for all weeks
  app.post("/api/shower/sync-onedrive", async (req, res) => {
    try {
      const { listOneDriveItems } = await import("./onedrive");
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      const activeSemester = await storage.getActiveSemesterSettings();
      const allSemesters = await storage.getAllSemesterSettings();
      const semester = activeSemester || allSemesters[0];
      if (!semester) {
        return res.json({ success: true, message: 'No semester configured', synced: [] });
      }
      const semesterTypeMap: Record<string, string> = { winter: 'Winter', fall: 'Fall', spring_summer: 'Spring_Summer' };
      const semesterFolder = semesterTypeMap[semester.semesterType] || semester.semesterType;
      const year = semester.semesterName?.match(/\d{4}/)?.[0] || '2026';
      const basePath = `/School/1. TMU/Courses/${year}/${semesterFolder}`;
      const courseCodes = [semester.course1Code, semester.course2Code, semester.course3Code].filter(Boolean) as string[];
      console.log(`[Sync] Using semester: ${semester.semesterName}, path: ${basePath}, courses: ${courseCodes.join(', ')}`);
      
      // Get all existing files once to avoid repeated DB queries
      const existingFiles = await storage.getFiles();
      const existingFileKeys = new Set(
        existingFiles.map((f: any) => `${f.originalName}|||${f.folder}`)
      );
      
      // List base folder to find course folders dynamically
      const baseFolders = await listOneDriveItems(basePath);
      
      const syncedFiles: any[] = [];
      const errors: any[] = [];
      
      for (const courseCode of courseCodes) {
        try {
          const matchedFolder = baseFolders.find((f: any) => 
            f.type === 'folder' && f.name.toUpperCase().startsWith(courseCode)
          );
          if (!matchedFolder) {
            console.log(`No OneDrive folder found for ${courseCode}`);
            continue;
          }
          
          const coursePath = matchedFolder.path;
          const weekFolders = await listOneDriveItems(coursePath);
          
          // Process ALL week folders (not just current week)
          for (const weekFolder of weekFolders) {
            if (weekFolder.type !== 'folder') continue;
            const weekMatch = weekFolder.name.match(/Week\s+(\d+)/i);
            if (!weekMatch) continue;
            const weekNum = parseInt(weekMatch[1], 10);
            
            const weekContents = await listOneDriveItems(weekFolder.path);
            
            // Process Module and Reading subfolders
            for (const subfolder of weekContents) {
              if (subfolder.type !== 'folder') continue;
              const subName = subfolder.name.toLowerCase();
              let type: string | null = null;
              if (subName.includes('module')) type = 'module';
              else if (subName.includes('reading')) type = 'reading';
              if (!type) continue;
              
              const folderName = `week-${weekNum}-${courseCode.toLowerCase()}-${type}`;
              const subFiles = await listOneDriveItems(subfolder.path);
              
              for (const file of subFiles) {
                if (file.type !== 'file' || !file.name.toLowerCase().endsWith('.pdf')) continue;
                
                const fileKey = `${file.name}|||${folderName}`;
                if (existingFileKeys.has(fileKey)) continue;
                
                try {
                  const downloadResponse = await fetch(file.downloadUrl);
                  if (!downloadResponse.ok) {
                    errors.push({ file: file.name, week: weekNum, error: 'Download failed' });
                    continue;
                  }
                  
                  const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
                  const uploadUrl = await objectStorage.getObjectEntityUploadURL();
                  const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: fileBuffer,
                    headers: { 'Content-Type': 'application/pdf' }
                  });
                  
                  if (!uploadResponse.ok) {
                    errors.push({ file: file.name, week: weekNum, error: 'Upload to storage failed' });
                    continue;
                  }
                  
                  const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
                  
                  const newFile = await storage.createFile({
                    originalName: file.name,
                    displayName: file.name,
                    objectPath: objectPath,
                    contentType: 'application/pdf',
                    size: file.size,
                    folder: folderName,
                    listened: false
                  });
                  
                  existingFileKeys.add(fileKey);

                  let textLength = 0;
                  let totalChunks = 0;
                  try {
                    const extractedText = await extractFileText({ ...newFile, objectPath });
                    if (extractedText) {
                      textLength = extractedText.length;
                      totalChunks = Math.ceil(extractedText.length / CHUNK_SIZE);
                      await storage.updateFile(newFile.id, { totalChunks, extractedText });
                    }
                  } catch (parseErr: any) {
                    console.error(`[Sync] Text extraction failed for ${file.name}:`, parseErr.message);
                  }

                  const preparedEntry = {
                    id: newFile.id,
                    name: file.name,
                    folder: folderName,
                    totalChunks,
                    textLength,
                    preparedAt: new Date().toISOString(),
                  };
                  recentlyPreparedFiles.push(preparedEntry);

                  syncedFiles.push({ name: file.name, folder: folderName, course: courseCode, week: weekNum });
                  console.log(`[Sync] New file: ${file.name} -> ${folderName} (${totalChunks} chunks, ${textLength} chars, ready for TTS)`);
                } catch (fileErr: any) {
                  errors.push({ file: file.name, week: weekNum, error: fileErr.message });
                }
              }
            }
          }
        } catch (courseError: any) {
          errors.push({ course: courseCode, error: courseError.message });
        }
      }
      
      res.json({ 
        success: true, 
        totalSynced: syncedFiles.length,
        synced: syncedFiles,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error("Error syncing OneDrive files:", error);
      res.status(500).json({ error: "Failed to sync OneDrive files", details: error.message });
    }
  });

  const recentlyPreparedFiles: { id: number; name: string; folder: string; totalChunks: number; textLength: number; preparedAt: string }[] = [];
  (globalThis as any).__recentlyPreparedFiles = recentlyPreparedFiles;

  app.post("/api/files/prepare-audio", async (req, res) => {
    try {
      const { fileId } = req.body || {};
      if (fileId) {
        queueFileForPreparation(fileId);
        return res.json({ action: "queued", fileId });
      }
      const allFiles = await storage.getFiles();
      const unprepared = allFiles.filter((f: any) => !f.preparedAudioPaths && f.folder && (f.folder.includes('-module') || f.folder.includes('-reading')));
      for (const file of unprepared) {
        queueFileForPreparation(file.id);
      }
      res.json({ action: "queued", count: unprepared.length, files: unprepared.map((f: any) => ({ id: f.id, name: f.originalName, folder: f.folder })) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const TTS_FILTER_VERSION = 4;
  setTimeout(async () => {
    try {
      const rows = await db.select().from(appState).where(eq(appState.key, 'tts_filter_version'));
      const currentVersion = rows.length > 0 ? parseInt(rows[0].value) : 0;
      if (currentVersion < TTS_FILTER_VERSION) {
        await db.execute(sql`UPDATE files SET extracted_text = NULL, prepared_audio_paths = NULL, prepared_at = NULL WHERE extracted_text IS NOT NULL`);
        await db.insert(appState).values({ key: 'tts_filter_version', value: String(TTS_FILTER_VERSION) })
          .onConflictDoUpdate({ target: appState.key, set: { value: String(TTS_FILTER_VERSION) } });
        console.log(`[Startup] TTS filter version ${currentVersion} → ${TTS_FILTER_VERSION}: cleared cached text and audio for re-extraction`);
      }
    } catch (e: any) {
      console.error(`[Startup] Filter version check failed: ${e.message}`);
    }

    try {
      const allFiles = await storage.getFiles();
      const unprepared = allFiles.filter((f: any) => !f.preparedAudioPaths && f.folder && (f.folder.includes('-module') || f.folder.includes('-reading')));
      if (unprepared.length > 0) {
        console.log(`[AudioPrep] Startup scan: ${unprepared.length} unprepared files found — queueing`);
        for (const file of unprepared) {
          queueFileForPreparation(file.id);
        }
      } else {
        console.log(`[AudioPrep] Startup scan: all files already prepared`);
      }
    } catch (e: any) {
      console.error(`[AudioPrep] Startup scan error: ${e.message}`);
    }
  }, 30000);

  app.post("/api/files/monitor-sync", async (req, res) => {
    try {
      const { listOneDriveItems, getOneDriveFile } = await import("./onedrive");
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();

      const allSemesters = await storage.getAllSemesterSettings();
      const springSummer = allSemesters.find(s => s.semesterType === 'spring_summer' && s.semesterName?.includes('2026'));
      if (!springSummer) {
        return res.json({ success: true, message: 'No Spring/Summer 2026 semester found', synced: [] });
      }

      const courseCodes = [springSummer.course1Code, springSummer.course2Code, springSummer.course3Code].filter(Boolean);
      const basePath = `/School/1. TMU/Courses/2026/Spring_Summer`;

      const existingFiles = await storage.getFiles();
      const existingFileKeys = new Set(
        existingFiles.map((f: any) => `${f.originalName}|||${f.folder}`)
      );

      let baseFolders: any[] = [];
      try {
        baseFolders = await listOneDriveItems(basePath);
      } catch (e: any) {
        return res.json({ success: true, message: 'OneDrive Spring_Summer folder not found yet', synced: [] });
      }

      const syncedFiles: any[] = [];
      const errors: any[] = [];

      for (const courseCode of courseCodes) {
        try {
          const matchedFolder = baseFolders.find((f: any) =>
            f.type === 'folder' && f.name.toUpperCase().startsWith(courseCode.toUpperCase())
          );
          if (!matchedFolder) continue;

          const coursePath = matchedFolder.path;
          const weekFolders = await listOneDriveItems(coursePath);

          for (const weekFolder of weekFolders) {
            if (weekFolder.type !== 'folder') continue;
            const weekMatch = weekFolder.name.match(/Week\s+(\d+)/i);
            if (!weekMatch) continue;
            const weekNum = parseInt(weekMatch[1], 10);

            const weekContents = await listOneDriveItems(weekFolder.path);

            for (const subfolder of weekContents) {
              if (subfolder.type !== 'folder') continue;
              const subName = subfolder.name.toLowerCase();
              let type: string | null = null;
              if (subName.includes('module')) type = 'module';
              else if (subName.includes('reading')) type = 'reading';
              if (!type) continue;

              const folderName = `week-${weekNum}-${courseCode.toLowerCase()}-${type}`;
              const subFiles = await listOneDriveItems(subfolder.path);

              for (const file of subFiles) {
                if (file.type !== 'file' || !file.name.toLowerCase().endsWith('.pdf')) continue;

                const fileKey = `${file.name}|||${folderName}`;
                if (existingFileKeys.has(fileKey)) continue;

                try {
                  const downloadResponse = await fetch(file.downloadUrl);
                  if (!downloadResponse.ok) {
                    errors.push({ file: file.name, week: weekNum, error: 'Download failed' });
                    continue;
                  }

                  const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());

                  const uploadUrl = await objectStorage.getObjectEntityUploadURL();
                  const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: fileBuffer,
                    headers: { 'Content-Type': 'application/pdf' },
                  });

                  if (!uploadResponse.ok) {
                    errors.push({ file: file.name, week: weekNum, error: 'Upload to storage failed' });
                    continue;
                  }

                  const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);

                  const newFile = await storage.createFile({
                    originalName: file.name,
                    displayName: file.name,
                    objectPath,
                    contentType: 'application/pdf',
                    size: file.size,
                    folder: folderName,
                    listened: false,
                  });

                  existingFileKeys.add(fileKey);

                  let textLength = 0;
                  let totalChunks = 0;
                  try {
                    const PdfParser = await getPdfParser();
                    const parsed = await PdfParser(fileBuffer);
                    let textContent = '';
                    if (parsed && typeof parsed === 'object') {
                      if (parsed.text) textContent = parsed.text;
                      else if ((parsed as any).pages && Array.isArray((parsed as any).pages)) {
                        textContent = (parsed as any).pages.map((p: any) => p.text || '').join('\n\n');
                      }
                    } else if (typeof parsed === 'string') {
                      textContent = parsed;
                    }
                    const cleaned = cleanTextForTTS(textContent);
                    textLength = cleaned.length;
                    totalChunks = Math.ceil(cleaned.length / CHUNK_SIZE);

                    await storage.updateFile(newFile.id, { totalChunks, extractedText: cleaned });
                  } catch (parseErr: any) {
                    console.error(`[Monitor] Failed to extract text from ${file.name}:`, parseErr.message);
                  }

                  const preparedEntry = {
                    id: newFile.id,
                    name: file.name,
                    folder: folderName,
                    totalChunks,
                    textLength,
                    preparedAt: new Date().toISOString(),
                  };
                  recentlyPreparedFiles.push(preparedEntry);
                  syncedFiles.push(preparedEntry);

                  console.log(`[Monitor] Synced & prepared: ${file.name} -> ${folderName} (${totalChunks} chunks, ${textLength} chars)`);
                } catch (fileErr: any) {
                  errors.push({ file: file.name, week: weekNum, error: fileErr.message });
                }
              }
            }
          }
        } catch (courseError: any) {
          errors.push({ course: courseCode, error: courseError.message });
        }
      }

      res.json({
        success: true,
        totalSynced: syncedFiles.length,
        synced: syncedFiles,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("[Monitor] Error syncing Spring/Summer files:", error);
      res.status(500).json({ error: "Failed to monitor Spring/Summer files", details: error.message });
    }
  });

  app.post("/api/files/pre-extract", async (_req, res) => {
    try {
      const allFiles = await storage.getFiles();
      const needExtraction = allFiles.filter((f: any) => !f.extractedText && f.objectPath);
      console.log(`[Pre-Extract] Found ${needExtraction.length} files needing text extraction`);

      if (needExtraction.length === 0) {
        return res.json({ success: true, message: 'All files already have cached text', extracted: 0 });
      }

      res.json({ success: true, message: `Extracting ${needExtraction.length} files in background`, queued: needExtraction.length });

      (async () => {
        let extracted = 0;
        let failed = 0;
        for (const file of needExtraction) {
          try {
            const text = await extractFileText(file);
            if (text) {
              extracted++;
              console.log(`[Pre-Extract] ${extracted}/${needExtraction.length}: ${file.originalName} (${text.length} chars)`);
            } else {
              failed++;
              console.log(`[Pre-Extract] Failed: ${file.originalName} (no text)`);
            }
          } catch (e: any) {
            failed++;
            console.error(`[Pre-Extract] Error: ${file.originalName}: ${e.message}`);
          }
        }
        console.log(`[Pre-Extract] Complete: ${extracted} extracted, ${failed} failed`);
      })();
    } catch (error: any) {
      console.error("[Pre-Extract] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/files/recently-prepared", async (_req, res) => {
    res.json({ files: recentlyPreparedFiles });
  });

  app.post("/api/files/acknowledge-prepared", async (req, res) => {
    const { fileIds } = req.body;
    if (fileIds && Array.isArray(fileIds)) {
      for (let i = recentlyPreparedFiles.length - 1; i >= 0; i--) {
        if (fileIds.includes(recentlyPreparedFiles[i].id)) {
          recentlyPreparedFiles.splice(i, 1);
        }
      }
    } else {
      recentlyPreparedFiles.length = 0;
    }
    res.json({ success: true });
  });

  // POST /api/echo/tts - Send text-to-speech to Home Assistant Echo device
  app.post("/api/echo/tts", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Use Nest speaker (non-Alexa) for cat washroom TTS
      const audioPath = await generateAndSaveTTSAudio(message, `echo-tts-${Date.now()}`, "echo");
      const appUrl = DEPLOYED_APP_URL;
      const response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: NEST_SPEAKER_ENTITY, media_content_id: `${appUrl}${audioPath}`, media_content_type: "music" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Home Assistant TTS error:", errorText);
        return res.status(response.status).json({ error: "Failed to send TTS to Home Assistant" });
      }

      res.json({ success: true, message: "Text-to-speech sent to Nest speaker" });
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to send text-to-speech" });
    }
  });

  // POST /api/media/play - Extract text from PDF and read it aloud via TTS
  app.post("/api/media/play", async (req, res) => {
    try {
      const { mediaUrl, entityId } = req.body;
      const targetEntity = entityId || NEST_SPEAKER_ENTITY;
      
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
          const parser = new PdfParser({ data: new Uint8Array(fileBuffer), verbosity: 0 });
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

      // Skip first page if it's a title/cover page (< 300 words with academic keywords)
      const titlePageKeywords = /jstor|published|publisher|author[s]?:|doi:|copyright|©|issn|isbn|volume\s+\d|issue\s+\d|journal|university press|all rights reserved|accessed|stable url|abstract|keywords:|pp\.\s*\d+|pages?\s+\d+/i;
      const firstPageBreak = textContent.indexOf('---PAGE---');
      if (firstPageBreak > 0) {
        const firstPageContent = textContent.substring(0, firstPageBreak);
        const firstPageWordCount = firstPageContent.split(/\s+/).length;
        if (firstPageWordCount < 300 && titlePageKeywords.test(firstPageContent.toLowerCase())) {
          textContent = textContent.substring(firstPageBreak + 10);
          console.log("Skipped first page (title page detected)");
        }
      }
      // Also skip learning objectives section at the beginning
      const learningObjMatch = textContent.match(/^[\s\S]*?(?:Learning Objectives?|By the end of this (?:module|chapter|unit|lesson),[\s\S]*?)\n\n/i);
      if (learningObjMatch && learningObjMatch[0].length < 2000) {
        const afterObjectives = textContent.substring(learningObjMatch[0].length);
        if (afterObjectives.trim().length > 500) {
          textContent = afterObjectives;
          console.log("Skipped learning objectives section");
        }
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
      // Apply the same French/JSTOR filtering to the full text so all chunks are clean
      const fullCleanedText = cleanTextForTTS(textContent);
      
      currentTTSSession = {
        fullText: fullCleanedText.length > 100000 ? fullCleanedText.substring(0, 100000) : fullCleanedText,
        currentPosition: 0,
        startTime: Date.now(),
        isPlaying: true,
        autoTimer: null,
        consecutiveErrors: 0,
        sessionCreatedAt: Date.now()
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
      
      console.log("=== TTS PLAY REQUEST ===");
      console.log("Target entity:", targetEntity);
      console.log("Cleaned message length:", cleanedContent.length);
      console.log("HA URL:", haUrl);
      console.log("Message preview:", cleanedContent.substring(0, 100));
      
      const isNonAlexa = NON_ALEXA_ENTITIES.includes(targetEntity);
      let response: Response;
      if (isNonAlexa) {
        const audioPath = await generateAndSaveTTSAudio(cleanedContent, `tts-play-${Date.now()}`, "echo");
        const appUrl = DEPLOYED_APP_URL;
        console.log(`[TTS Play] Non-Alexa: Generated audio at ${audioPath}`);
        response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: targetEntity, media_content_id: `${appUrl}${audioPath}`, media_content_type: "music" }),
        });
      } else {
        const ssmlContent = `<speak><prosody rate="90%">${cleanedContent}</prosody></speak>`;
        response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: ssmlContent, target: targetEntity, data: { type: "tts" } }),
        });
      }

      const responseText = await response.text();
      console.log("HA Response status:", response.status);
      console.log("HA Response:", responseText);
      
      if (!response.ok) {
        console.error("Home Assistant TTS error:", responseText);
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
      const targetEntity = entityId || currentTTSSession?.targetEntity || NEST_SPEAKER_ENTITY;
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Cancel auto-continuation timer and clear session completely
      if (currentTTSSession) {
        // Clear the auto timer
        if (currentTTSSession.autoTimer) {
          clearTimeout(currentTTSSession.autoTimer);
          currentTTSSession.autoTimer = null;
        }
        
        // Calculate position before clearing
        if (currentTTSSession.isPlaying) {
          const elapsedSeconds = (Date.now() - currentTTSSession.startTime) / 1000;
          const charsRead = Math.floor(elapsedSeconds * CHARS_PER_SECOND);
          currentTTSSession.currentPosition = Math.min(
            currentTTSSession.currentPosition + charsRead,
            currentTTSSession.fullText.length
          );
          console.log(`TTS stopped at position ${currentTTSSession.currentPosition} of ${currentTTSSession.fullText.length}`);
        }
        
        // Mark as stopped
        currentTTSSession.isPlaying = false;
        // Clear the session entirely to prevent further chunks
        currentTTSSession = null;
      }
      
      // Send stop command to the media player
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
      
      console.log("Stopped media player");
      
      // Also try the Alexa-specific stop command (only for Alexa devices)
      if (!NON_ALEXA_ENTITIES.includes(targetEntity)) {
        try {
          await fetch(`${haUrl}/api/services/notify/alexa_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "stop", target: targetEntity, data: { type: "tts" } }),
          });
        } catch (e) {
          console.log("Alexa media stop command not available");
        }
      }

      res.json({ success: true, canResume: false });
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
          entity_id: currentTTSSession.targetEntity || NEST_SPEAKER_ENTITY,
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
      currentTTSSession.consecutiveErrors = 0;
      
      console.log("Resuming TTS from position", currentTTSSession.currentPosition, "preview:", remainingText.substring(0, 100));
      
      const targetEntity = currentTTSSession.targetEntity || NEST_SPEAKER_ENTITY;
      const isNonAlexa = NON_ALEXA_ENTITIES.includes(targetEntity);
      let response: Response;
      if (isNonAlexa) {
        const audioPath = await generateAndSaveTTSAudio(remainingText, `tts-resume-${Date.now()}`, "echo");
        const appUrl = DEPLOYED_APP_URL;
        response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: targetEntity, media_content_id: `${appUrl}${audioPath}`, media_content_type: "music" }),
        });
      } else {
        const ssmlContent = `<speak><prosody rate="90%">${remainingText}</prosody></speak>`;
        response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: ssmlContent, target: targetEntity, data: { type: "tts" } }),
        });
      }

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

  // POST /api/media/restart - Restart TTS from beginning
  app.post("/api/media/restart", async (req, res) => {
    try {
      const { mediaUrl, entityId } = req.body;
      const targetEntity = entityId || NEST_SPEAKER_ENTITY;
      
      if (!mediaUrl) {
        return res.status(400).json({ error: "Media URL is required" });
      }
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Clear any existing session
      if (currentTTSSession) {
        if (currentTTSSession.autoTimer) {
          clearTimeout(currentTTSSession.autoTimer);
        }
        currentTTSSession = null;
      }
      
      // Restore volume in case it was muted
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

      // Re-trigger play from the beginning by calling the play endpoint logic
      // This is a simplified restart - just call the play endpoint
      res.json({ success: true, message: "Use play endpoint to restart" });
    } catch (error) {
      console.error("Restart error:", error);
      res.status(500).json({ error: "Failed to restart" });
    }
  });

  // POST /api/media/skip-chunk - Skip to next or previous chunk in TTS
  app.post("/api/media/attention-prompt", async (req, res) => {
    try {
      const appUrl = DEPLOYED_APP_URL;
      const promptPath = await generateAndSaveTTSAudio("Bryn, are you paying attention?", `attention-prompt-${Date.now()}`, "echo");
      await playOnNestSpeaker(`${appUrl}${promptPath}`);
      console.log(`[Attention Prompt] Played on Nest speaker`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error(`[Attention Prompt] Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/media/skip-chunk", async (req, res) => {
    try {
      const { direction, entityId } = req.body; // "forward" or "backward"
      const targetEntity = entityId || currentTTSSession?.targetEntity || NEST_SPEAKER_ENTITY;
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      if (!currentTTSSession) {
        return res.status(400).json({ error: "No active TTS session" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Clear the auto timer
      if (currentTTSSession.autoTimer) {
        clearTimeout(currentTTSSession.autoTimer);
        currentTTSSession.autoTimer = null;
      }
      
      // Calculate new position based on direction
      if (direction === "forward") {
        // Skip forward by one chunk
        currentTTSSession.currentPosition = Math.min(
          currentTTSSession.currentPosition + CHUNK_SIZE,
          currentTTSSession.fullText.length
        );
      } else {
        // Skip backward by one chunk
        currentTTSSession.currentPosition = Math.max(
          currentTTSSession.currentPosition - CHUNK_SIZE,
          0
        );
      }
      
      console.log(`Skipping ${direction} to position ${currentTTSSession.currentPosition}`);
      
      // If we have more content, send the next chunk immediately
      if (currentTTSSession.currentPosition < currentTTSSession.fullText.length) {
        currentTTSSession.isPlaying = true;
        currentTTSSession.consecutiveErrors = 0;
        currentTTSSession.startTime = Date.now();
        sendNextChunk();
        res.json({ success: true, position: currentTTSSession.currentPosition });
      } else {
        currentTTSSession.isPlaying = false;
        res.json({ success: true, message: "Reached end of document" });
      }
    } catch (error) {
      console.error("Skip chunk error:", error);
      res.status(500).json({ error: "Failed to skip chunk" });
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
          entity_id: NEST_SPEAKER_ENTITY,
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

  // POST /api/media/play-radio - Play TuneIn radio station on Alexa
  app.post("/api/media/play-radio", async (req, res) => {
    try {
      const { stationId, entityId } = req.body;
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(400).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Use the entity passed from the frontend
      const device = entityId || "media_player.echo_lr_studio_white_am";
      
      console.log(`Playing CHUM FM on ${device}`);
      
      const response = await fetch(`${haUrl}/api/services/media_player/play_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: device,
          media_content_id: "play 104.5 chumfm",
          media_content_type: "custom"
        }),
      });
      
      const responseText = await response.text();
      console.log(`Response (${response.status}):`, responseText);

      res.json({ success: true });
    } catch (error) {
      console.error("Play radio error:", error);
      res.status(500).json({ error: "Failed to play radio" });
    }
  });

  // POST /api/media/play-radio-all - Play radio on ALL Echo devices
  app.post("/api/media/play-radio-all", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(400).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // All Echo devices (excluding lr studio and lr couch left)
      const devices = [
        NEST_SPEAKER_ENTITY,
        ...CAT_ECHO_ENTITIES,
        "media_player.echo_closet_am",
        "media_player.echo_lr_couch_r_am",
        "media_player.echo_hallway_entrance_am",
        "media_player.echo_king_l_am",
        "media_player.echo_king_r_am",
        "media_player.echo_king_tv_am",
        "media_player.echo_kitchen_cupboards_left_am",
        "media_player.echo_kitchen_cupboards_r_am",
        "media_player.echo_kitchen_fridge_am",
        "media_player.echo_kitchen_hutch_am",
        "media_player.echo_kitchen_island_corner_am",
        "media_player.echo_kitchen_studio_black_am",
        "media_player.echo_lr_hub_am",
        "media_player.echo_lr_tv_shelf_am",
        "media_player.echo_queen_balcony_am",
        "media_player.echo_queen_bed_l_am",
        "media_player.echo_queen_bed_r_am",
        "media_player.echo_show_pug_am"
      ];
      
      console.log(`Playing CHUM FM on ALL devices: ${devices.join(', ')}`);
      
      for (const device of devices) {
        await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: device,
            media_content_id: "play 104.5 chumfm",
            media_content_type: "custom"
          }),
        });
      }
      
      console.log(`All devices started`);
      res.json({ success: true });
    } catch (error) {
      console.error("Play radio all error:", error);
      res.status(500).json({ error: "Failed to play radio on all devices" });
    }
  });

  // POST /api/media/stop-radio - Stop radio on Echo devices
  app.post("/api/media/stop-radio", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(400).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Stop ALL devices that might be playing
      const devices = [
        NEST_SPEAKER_ENTITY,
        ...CAT_ECHO_ENTITIES,
        "media_player.echo_closet_am",
        "media_player.echo_lr_couch_l_am",
        "media_player.echo_lr_couch_r_am",
        "media_player.echo_hallway_entrance_am",
        "media_player.echo_king_l_am",
        "media_player.echo_king_r_am",
        "media_player.echo_king_tv_am",
        "media_player.echo_kitchen_cupboards_left_am",
        "media_player.echo_kitchen_cupboards_r_am",
        "media_player.echo_kitchen_fridge_am",
        "media_player.echo_kitchen_hutch_am",
        "media_player.echo_kitchen_island_corner_am",
        "media_player.echo_kitchen_studio_black_am",
        "media_player.echo_lr_hub_am",
        "media_player.echo_lr_studio_white_am",
        "media_player.echo_lr_tv_shelf_am",
        "media_player.echo_queen_balcony_am",
        "media_player.echo_queen_bed_l_am",
        "media_player.echo_queen_bed_r_am",
        "media_player.echo_show_pug_am",
        EVERYWHERE_GROUP_ENTITY,
        "media_player.everywhere_2"
      ];
      
      console.log(`Stopping media on all devices`);
      
      // Send all stop commands in parallel for faster execution
      await Promise.all(devices.map(device => 
        fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: device
          }),
        }).catch(err => console.error(`Failed to stop ${device}:`, err))
      ));
      
      console.log(`All devices stopped`);
      res.json({ success: true });
    } catch (error) {
      console.error("Stop radio error:", error);
      res.status(500).json({ error: "Failed to stop radio" });
    }
  });

  // POST /api/media/volume - Adjust volume on Echo devices
  app.post("/api/media/volume", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(400).json({ error: "Home Assistant not configured" });
      }

      const { direction, level, entityId } = req.body; // direction: 'up' or 'down', or level: 0-100, entityId: specific speaker
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // Use the specified entityId or default to a single device
      const targetDevice = entityId || "media_player.echo_lr_studio_white_am";
      
      console.log(`Setting volume on device: ${targetDevice}`);
      
      // First get current volume from the target device
      const statesResponse = await fetch(`${haUrl}/api/states/${targetDevice}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      let currentVolume = 0.5; // Default 50%
      if (statesResponse.ok) {
        const stateData = await statesResponse.json();
        currentVolume = stateData.attributes?.volume_level || 0.5;
        console.log(`Current volume on ${targetDevice}: ${currentVolume}`);
      }
      
      // Calculate new volume
      let newVolume: number;
      if (level !== undefined) {
        newVolume = level / 100; // Convert 0-100 to 0-1
      } else {
        const step = 0.1; // 10% steps
        newVolume = direction === 'up' 
          ? Math.min(1, currentVolume + step)
          : Math.max(0, currentVolume - step);
      }
      
      console.log(`Setting volume to ${newVolume} on ${targetDevice}`);
      
      if (targetDevice === EVERYWHERE_GROUP_ENTITY) {
        const excludeSet = new Set<string>(Array.isArray(req.body.excludeEntityIds) ? req.body.excludeEntityIds : []);
        const allEchoDevices = FLICK_DEVICES.flatMap(g => g.devices).filter(d => (d.type === "echo" || d.type === "echo_show") && d.entityId.includes("_am") && !excludeSet.has(d.entityId));
        console.log(`[Volume] BYhome group → setting volume on ${allEchoDevices.length} individual Echo devices (excluded: ${excludeSet.size})`);
        await Promise.allSettled(allEchoDevices.map(d =>
          fetch(`${haUrl}/api/services/media_player/volume_set`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: d.entityId, volume_level: newVolume }),
          })
        ));
        console.log(`[Volume] Set volume to ${newVolume} on all Echo devices`);
        res.json({ success: true, direction, newVolume: Math.round(newVolume * 100) });
      } else {
        const volumeResponse = await fetch(`${haUrl}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: targetDevice,
            volume_level: newVolume
          }),
        });
        
        if (!volumeResponse.ok) {
          const errorText = await volumeResponse.text();
          console.error(`Home Assistant volume_set failed: ${volumeResponse.status} - ${errorText}`);
          return res.status(500).json({ error: `Failed to set volume: ${volumeResponse.status}` });
        }
        
        console.log(`Volume set successfully on ${targetDevice}`);
        res.json({ success: true, direction, newVolume: Math.round(newVolume * 100) });
      }
    } catch (error) {
      console.error("Volume control error:", error);
      res.status(500).json({ error: "Failed to adjust volume" });
    }
  });

  // POST /api/media/volume-all - Adjust volume on ALL Echo devices
  app.post("/api/media/volume-all", async (req, res) => {
    try {
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(400).json({ error: "Home Assistant not configured" });
      }

      const { direction, level } = req.body;
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // All Echo devices
      const devices = [
        NEST_SPEAKER_ENTITY,
        ...CAT_ECHO_ENTITIES,
        "media_player.echo_closet_am",
        "media_player.echo_lr_couch_r_am",
        "media_player.echo_hallway_entrance_am",
        "media_player.echo_king_l_am",
        "media_player.echo_king_r_am",
        "media_player.echo_king_tv_am",
        "media_player.echo_kitchen_cupboards_left_am",
        "media_player.echo_kitchen_cupboards_r_am",
        "media_player.echo_kitchen_fridge_am",
        "media_player.echo_kitchen_hutch_am",
        "media_player.echo_kitchen_island_corner_am",
        "media_player.echo_kitchen_studio_black_am",
        "media_player.echo_lr_hub_am",
        "media_player.echo_lr_studio_white_am",
        "media_player.echo_lr_tv_shelf_am",
        "media_player.echo_queen_balcony_am",
        "media_player.echo_queen_bed_l_am",
        "media_player.echo_queen_bed_r_am",
        "media_player.echo_show_pug_am"
      ];
      
      console.log(`Setting volume on ALL ${devices.length} devices`);
      
      // Get current volume from first device
      const statesResponse = await fetch(`${haUrl}/api/states/${devices[0]}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      let currentVolume = 0.5;
      if (statesResponse.ok) {
        const stateData = await statesResponse.json();
        currentVolume = stateData.attributes?.volume_level || 0.5;
      }
      
      // Calculate new volume
      let newVolume: number;
      if (level !== undefined) {
        newVolume = level / 100;
      } else {
        const step = 0.1;
        newVolume = direction === 'up' 
          ? Math.min(1, currentVolume + step)
          : Math.max(0, currentVolume - step);
      }
      
      console.log(`Setting volume to ${newVolume} on all devices`);
      
      // Set volume on all devices in parallel
      await Promise.all(devices.map(device => 
        fetch(`${haUrl}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: device,
            volume_level: newVolume
          }),
        })
      ));
      
      console.log(`Volume set successfully on all devices`);
      res.json({ success: true, direction, newVolume: Math.round(newVolume * 100) });
    } catch (error) {
      console.error("Volume all control error:", error);
      res.status(500).json({ error: "Failed to adjust volume on all devices" });
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

  // DELETE /api/calendar/event/:eventId - Delete a calendar event by ID
  app.delete("/api/calendar/event/:eventId", async (req, res) => {
    try {
      await deleteCalendarEvent(req.params.eventId);
      res.json({ success: true });
    } catch (err) {
      console.error("Calendar event delete error:", err);
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // POST /api/calendar/class - Create a recurring class event
  app.post("/api/calendar/class", async (req, res) => {
    try {
      const { courseName, courseCode, startDate, endDate, startTime, endTime, daysOfWeek, location } = req.body;
      
      const event = await createRecurringClassEvent({
        courseName,
        courseCode,
        startDate,
        endDate,
        startTime,
        endTime,
        daysOfWeek,
        location
      });
      
      res.json({ success: true, event });
    } catch (err) {
      console.error("Error creating class event:", err);
      res.status(500).json({ message: "Failed to create class event", error: String(err) });
    }
  });

  // GET /api/calendar/events - Fetch events from both Google accounts
  app.get("/api/calendar/upcoming-events", async (req, res) => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 120 * 24 * 60 * 60 * 1000);

      let primaryEvents: any[] = [];
      try {
        primaryEvents = await listEvents(start, end);
      } catch (err) {
        console.error("Failed to fetch primary upcoming events:", err);
      }

      let secondAccountEvents: any[] = [];
      try {
        const secondStatus = await isSecondAccountConnected();
        if (secondStatus.connected) {
          secondAccountEvents = await getEventsFromSecondAccount(start, end);
        }
      } catch (err) {
        console.error("Failed to fetch second account upcoming events:", err);
      }

      let tmuUpcomingEvents: any[] = [];
      try {
        const tmuFormatted = await fetchTMUCalendarEvents(start, end);
        tmuUpcomingEvents = tmuFormatted.map(e => ({
          id: e.id,
          start: { dateTime: e.startDate },
          end: { dateTime: e.endDate },
          summary: e.title,
          description: e.description,
          location: e.location,
          htmlLink: '',
          _source: 'tmu',
        }));
      } catch (err) {
        console.error("Failed to fetch TMU upcoming events:", err);
      }

      const allEvents = [...primaryEvents, ...secondAccountEvents, ...tmuUpcomingEvents];

      const tasks = await storage.getTasks({});
      const syncedEventIds = new Set([
        ...tasks.map(t => t.calendarEventId).filter(Boolean),
        ...tasks.map(t => t.secondAccountCalendarEventId).filter(Boolean),
        ...tasks.map(t => t.secondAccountPrepEventId).filter(Boolean),
        ...tasks.map(t => t.prepCalendarEventId).filter(Boolean),
        ...tasks.map(t => t.secondaryCalendarEventId).filter(Boolean),
      ]);

      const externalEvents = allEvents.filter(event => event.id && !syncedEventIds.has(event.id));

      const formattedEvents = externalEvents.map(event => {
        const isAllDay = !event.start?.dateTime;
        let startDate = event.start?.dateTime || event.start?.date;
        let endDate = event.end?.dateTime || event.end?.date;
        if (isAllDay && startDate && !startDate.includes('T')) {
          startDate = `${startDate}T12:00:00`;
        }
        if (isAllDay && endDate && !endDate.includes('T')) {
          endDate = `${endDate}T12:00:00`;
        }
        return {
          id: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          startDate,
          endDate,
          isAllDay,
          htmlLink: event.htmlLink,
          source: event._source === 'tmu' ? 'tmu' : 'google',
        };
      });

      const seen = new Set<string>();
      const dedupedEvents = formattedEvents.filter(e => {
        const key = `${e.title}||${e.startDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Further deduplicate: collapse events that match the same course + similar task type at the same time
      const courseTaskSeen2 = new Set<string>();
      const finalEvents2 = dedupedEvents.filter(e => {
        const titleMatch = e.title.match(/^\[([A-Z]{2,5}\d{3}[A-Z]?\s*-\s*[^\]]+)\]\s*(.*)/i);
        if (titleMatch) {
          const courseId = titleMatch[1].split('-')[0].trim().toUpperCase().replace(/\s/g, '');
          const taskPart = titleMatch[2].trim().toLowerCase();
          const normalizedType = taskPart.includes('module') ? 'module' : taskPart.includes('reading') ? 'reading' : taskPart;
          const startKey = e.startDate ? e.startDate.substring(0, 16) : '';
          const dedupeKey = `${courseId}||${normalizedType}||${startKey}`;
          if (courseTaskSeen2.has(dedupeKey)) return false;
          courseTaskSeen2.add(dedupeKey);
        }
        return true;
      });

      res.json(finalEvents2);
    } catch (error) {
      console.error("Fetch upcoming calendar events error:", error);
      res.status(500).json({ error: "Failed to fetch upcoming calendar events" });
    }
  });

  app.get("/api/calendar/events", async (req, res) => {
    try {
      const activeSemester = await storage.getActiveSemesterSettings();
      const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
      const weekNumber = Number(req.query.weekNumber) || getWeekNumber(torontoDate(), semesterStart, activeSemester?.readingWeekStart);
      const { start, end } = getWeekDates(weekNumber, semesterStart, activeSemester?.readingWeekStart);
      
      const endOfWeek = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      
      // Fetch events from primary account
      let primaryEvents: any[] = [];
      try {
        primaryEvents = await listEvents(start, endOfWeek);
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
      
      let tmuEvents: any[] = [];
      try {
        const tmuFormatted = await fetchTMUCalendarEvents(start, endOfWeek);
        tmuEvents = tmuFormatted.map(e => ({
          id: e.id,
          start: { dateTime: e.startDate },
          end: { dateTime: e.endDate },
          summary: e.title,
          description: e.description,
          location: e.location,
          htmlLink: '',
          _source: 'tmu',
        }));
      } catch (err) {
        console.error("Failed to fetch TMU calendar events:", err);
      }

      // Combine events from all accounts
      const allEvents = [...primaryEvents, ...secondAccountEvents, ...tmuEvents];
      
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
      const formattedEvents = externalEvents.map(event => {
        const isAllDay = !event.start?.dateTime;
        let startDate = event.start?.dateTime || event.start?.date;
        let endDate = event.end?.dateTime || event.end?.date;
        
        if (isAllDay && startDate && !startDate.includes('T')) {
          startDate = `${startDate}T12:00:00`;
        }
        if (isAllDay && endDate && !endDate.includes('T')) {
          endDate = `${endDate}T12:00:00`;
        }
        
        return {
          id: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          startDate,
          endDate,
          isAllDay,
          htmlLink: event.htmlLink,
          source: event._source === 'tmu' ? 'tmu' : 'google',
        };
      });
      
      // Deduplicate events by title + startDate to prevent duplicates from multiple accounts
      const seen = new Set<string>();
      const dedupedEvents = formattedEvents.filter(e => {
        const key = `${e.title}||${e.startDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Further deduplicate: collapse events that match the same course + similar task type at the same time
      const courseTaskSeen = new Set<string>();
      const finalEvents = dedupedEvents.filter(e => {
        const titleMatch = e.title.match(/^\[([A-Z]{2,5}\d{3}[A-Z]?\s*-\s*[^\]]+)\]\s*(.*)/i);
        if (titleMatch) {
          const courseId = titleMatch[1].split('-')[0].trim().toUpperCase().replace(/\s/g, '');
          const taskPart = titleMatch[2].trim().toLowerCase();
          const normalizedType = taskPart.includes('module') ? 'module' : taskPart.includes('reading') ? 'reading' : taskPart;
          const startKey = e.startDate ? e.startDate.substring(0, 16) : '';
          const dedupeKey = `${courseId}||${normalizedType}||${startKey}`;
          if (courseTaskSeen.has(dedupeKey)) return false;
          courseTaskSeen.add(dedupeKey);
        }
        return true;
      });

      res.json(finalEvents);
    } catch (error) {
      console.error("Fetch Google Calendar events error:", error);
      res.status(500).json({ error: "Failed to fetch Google Calendar events" });
    }
  });

  // Export all data for sync (with CORS for cross-origin sync)
  app.options("/api/export", (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });
  
  app.get("/api/export", async (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    try {
      const tasks = await storage.getTasks();
      const files = await storage.getFiles();
      const semester = await storage.getActiveSemesterSettings();
      const deletedFolders = await storage.getDeletedFolders();
      const customFolders = await storage.getCustomFolders();
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks,
        files,
        semester,
        deletedFolders,
        customFolders,
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
      const { tasks, files, semester, deletedFolders, customFolders } = req.body;
      
      let imported = { tasks: 0, files: 0, semester: false, deletedFolders: 0, customFolders: 0 };
      
      // Import semester settings
      if (semester) {
        const existing = await storage.getActiveSemesterSettings();
        const { id, createdAt, ...semesterData } = semester;
        if (semesterData.semesterStartDate) semesterData.semesterStartDate = new Date(semesterData.semesterStartDate);
        if (semesterData.semesterEndDate) semesterData.semesterEndDate = new Date(semesterData.semesterEndDate);
        if (semesterData.readingWeekStart) semesterData.readingWeekStart = new Date(semesterData.readingWeekStart);
        if (semesterData.course1StartDate) semesterData.course1StartDate = new Date(semesterData.course1StartDate);
        if (semesterData.course1EndDate) semesterData.course1EndDate = new Date(semesterData.course1EndDate);
        if (semesterData.course2StartDate) semesterData.course2StartDate = new Date(semesterData.course2StartDate);
        if (semesterData.course2EndDate) semesterData.course2EndDate = new Date(semesterData.course2EndDate);
        if (semesterData.course3StartDate) semesterData.course3StartDate = new Date(semesterData.course3StartDate);
        if (semesterData.course3EndDate) semesterData.course3EndDate = new Date(semesterData.course3EndDate);
        if (existing) {
          await storage.updateSemesterSettings(existing.id, semesterData);
        } else {
          await storage.createSemesterSettings(semesterData);
        }
        imported.semester = true;
      }
      
      // Import tasks - create or update all
      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          try {
            const existing = await storage.getTask(task.id);
            const taskData = {
              ...task,
              dueDate: new Date(task.dueDate),
              startDate: task.startDate ? new Date(task.startDate) : null,
              repeatEndDate: task.repeatEndDate ? new Date(task.repeatEndDate) : null,
              completedAt: task.completedAt ? new Date(task.completedAt) : null,
            };
            
            if (existing) {
              const { id, ...updates } = taskData;
              await storage.updateTask(task.id, updates);
            } else {
              const { id, ...newTask } = taskData;
              await storage.createTask(newTask);
            }
            imported.tasks++;
          } catch (err) {
            console.error("Error importing task:", err);
          }
        }
      }
      
      // Import files - create or update all
      if (files && Array.isArray(files)) {
        for (const file of files) {
          try {
            const existing = await storage.getFileByPath(file.objectPath);
            if (existing) {
              await storage.updateFile(existing.id, {
                displayName: file.displayName,
                folder: file.folder,
                listened: file.listened,
              });
            } else {
              const { id, createdAt, ...fileData } = file;
              await storage.createFile(fileData);
            }
            imported.files++;
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
      
      // Import custom folders
      if (customFolders && Array.isArray(customFolders)) {
        // Get existing folders to check for duplicates
        const existingFolders = await storage.getCustomFolders();
        const existingByParentAndName = new Map(existingFolders.map(f => [`${f.parentFolderId}:${f.name}`, f]));
        
        for (const folder of customFolders) {
          try {
            const key = `${folder.parentFolderId}:${folder.name}`;
            const existing = existingByParentAndName.get(key);
            if (existing) {
              // Already exists, skip or update name if different
              await storage.updateCustomFolder(existing.id, folder.name);
            } else {
              await storage.createCustomFolder({ name: folder.name, parentFolderId: folder.parentFolderId });
            }
            imported.customFolders++;
          } catch (err) {
            console.error("Error importing custom folder:", err);
          }
        }
      }
      
      res.json({ success: true, imported });
    } catch (err) {
      console.error("Import error:", err);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  app.post("/api/dev-dismiss", async (req, res) => {
    try {
      const { taskId, text } = req.body;
      const filePath = path.join(process.cwd(), "client", "public", "dev-tasks.json");
      const raw = await fs.promises.readFile(filePath, "utf-8");
      const tasks: { id: string; text: string; complete?: boolean }[] = JSON.parse(raw);
      const filtered = tasks.filter(t => t.id !== taskId && t.text !== text);
      await fs.promises.writeFile(filePath, JSON.stringify(filtered, null, 2) + "\n");
      res.json({ ok: true, remaining: filtered.length });
    } catch (err) {
      console.error("dev-dismiss error:", err);
      res.status(500).json({ error: "Failed to update dev-tasks.json" });
    }
  });

  app.post("/api/tasks/parse-ics", async (req, res) => {
    try {
      const { icsContent } = req.body;
      if (!icsContent || typeof icsContent !== 'string') {
        return res.status(400).json({ error: "icsContent is required" });
      }

      const events: Array<{
        title: string;
        description: string;
        startDate: string | null;
        endDate: string | null;
        location: string;
        allDay: boolean;
      }> = [];

      const lines = icsContent.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/);
      let inEvent = false;
      let currentEvent: Record<string, string> = {};

      for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
          inEvent = true;
          currentEvent = {};
        } else if (line === 'END:VEVENT') {
          inEvent = false;
          const summary = currentEvent['SUMMARY'] || '';
          const description = (currentEvent['DESCRIPTION'] || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
          const dtstart = currentEvent['DTSTART'] || currentEvent['DTSTART;VALUE=DATE'] || '';
          const dtend = currentEvent['DTEND'] || currentEvent['DTEND;VALUE=DATE'] || '';
          const location = (currentEvent['LOCATION'] || '').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
          const allDay = !!(currentEvent['DTSTART;VALUE=DATE'] || (dtstart && dtstart.length === 8));

          const parseIcsDate = (val: string): string | null => {
            if (!val) return null;
            const clean = val.replace(/[^0-9TZ]/g, '');
            if (clean.length === 8) {
              return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T00:00:00.000Z`;
            }
            if (clean.length >= 15) {
              const d = `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T${clean.slice(9,11)}:${clean.slice(11,13)}:${clean.slice(13,15)}.000Z`;
              return d;
            }
            return null;
          };

          if (summary) {
            events.push({
              title: summary.replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
              description,
              startDate: parseIcsDate(dtstart),
              endDate: parseIcsDate(dtend),
              location,
              allDay,
            });
          }
        } else if (inEvent) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            let key = line.slice(0, colonIdx);
            const value = line.slice(colonIdx + 1);
            if (key.includes(';') && !key.startsWith('DTSTART;VALUE') && !key.startsWith('DTEND;VALUE')) {
              key = key.split(';')[0];
            }
            currentEvent[key] = value;
          }
        }
      }

      res.json({ events, count: events.length });
    } catch (err) {
      console.error("ICS parse error:", err);
      res.status(500).json({ error: "Failed to parse ICS file" });
    }
  });

  app.get("/api/ui-settings/:key", async (req, res) => {
    try {
      const row = await db.select().from(appState).where(eq(appState.key, `ui_${req.params.key}`)).limit(1);
      res.json({ value: row.length > 0 ? row[0].value : null });
    } catch (err: any) {
      res.json({ value: null });
    }
  });

  app.post("/api/ui-settings/:key", async (req, res) => {
    try {
      const key = `ui_${req.params.key}`;
      const { value } = req.body;
      const row = await db.select().from(appState).where(eq(appState.key, key)).limit(1);
      if (row.length > 0) {
        await db.update(appState).set({ value: String(value), updatedAt: new Date() }).where(eq(appState.key, key));
      } else {
        await db.insert(appState).values({ key, value: String(value) });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/syllabus/paths", async (_req, res) => {
    try {
      const row = await db.select().from(appState).where(eq(appState.key, 'courseSyllabusPaths')).limit(1);
      const paths = row.length > 0 ? JSON.parse(row[0].value) : {};
      res.json(paths);
    } catch (err: any) {
      console.error("Error getting syllabus paths:", err);
      res.json({});
    }
  });

  app.post("/api/syllabus/paths", async (req, res) => {
    try {
      const { courseCode, objectPath } = req.body;
      if (!courseCode) return res.status(400).json({ error: "courseCode required" });
      const row = await db.select().from(appState).where(eq(appState.key, 'courseSyllabusPaths')).limit(1);
      const paths = row.length > 0 ? JSON.parse(row[0].value) : {};
      if (objectPath) {
        paths[courseCode] = objectPath;
      } else {
        delete paths[courseCode];
      }
      const value = JSON.stringify(paths);
      if (row.length > 0) {
        await db.update(appState).set({ value, updatedAt: new Date() }).where(eq(appState.key, 'courseSyllabusPaths'));
      } else {
        await db.insert(appState).values({ key: 'courseSyllabusPaths', value });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error saving syllabus path:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/syllabus/view", async (req, res) => {
    try {
      const objectPath = req.query.path as string;
      if (!objectPath) return res.status(400).json({ error: "path required" });

      const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
      const pathParts = privateDir.replace(/^\//, '').split('/');
      const bucketName = pathParts[0];
      const filePath = objectPath.replace('/objects/', '');
      const fullObjectName = `.private/${filePath}`;
      console.log(`[Syllabus View] bucket=${bucketName}, object=${fullObjectName}`);
      const [buffer] = await objectStorageClient.bucket(bucketName).file(fullObjectName).download();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.send(buffer);
    } catch (err: any) {
      console.error("Error serving syllabus:", err);
      res.status(500).json({ error: "Failed to load syllabus" });
    }
  });

  app.post("/api/syllabus/parse", async (req, res) => {
    try {
      const { objectPath, courseName, courseCode, fileName } = req.body;
      if (!objectPath || !courseName) {
        return res.status(400).json({ error: "objectPath and courseName are required" });
      }

      const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
      const pathParts = privateDir.replace(/^\//, '').split('/');
      const bucketName = pathParts[0];
      const filePath = objectPath.replace('/objects/', '');
      const fullObjectName = `.private/${filePath}`;
      let fileBuffer: Buffer;
      try {
        console.log(`[Syllabus Parse] Downloading from bucket=${bucketName}, object=${fullObjectName}`);
        const [buffer] = await objectStorageClient.bucket(bucketName).file(fullObjectName).download();
        fileBuffer = buffer;
      } catch (dlErr) {
        console.error("Failed to download syllabus from object storage:", dlErr);
        return res.status(500).json({ error: "Failed to read uploaded file" });
      }

      let pdfText = '';
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(fileBuffer), verbosity: 0 });
        const result = await parser.getText();
        pdfText = result.text || '';
      } catch (pdfErr) {
        console.error("Failed to parse syllabus PDF:", pdfErr);
        return res.status(500).json({ error: "Failed to parse PDF content" });
      }

      if (!pdfText.trim()) {
        return res.status(400).json({ error: "Could not extract text from syllabus PDF" });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `You are analyzing a university course syllabus for "${courseName}" (${courseCode || ''}).

Extract ALL of the following information from this syllabus. Be thorough — do not skip anything.

Return a JSON object with these fields:

1. "courseInfo": {
  "professor": string or null (professor/instructor name),
  "professorEmail": string or null (professor email),
  "officeHours": string or null (office hours description),
  "textbook": string or null (required textbook/materials),
  "description": string or null (course description summary)
}

2. "gradingBreakdown": array of objects, each with:
  - "component": string (e.g. "Midterm Exam", "Final Paper", "Participation")
  - "weight": number (percentage, e.g. 30 for 30%)
  - "description": string or null (any details about this component)

3. "items": array of ALL deadlines, assignments, exams, quizzes, discussions, projects, and important dates found. Each item:
  - "title": string (e.g. "Assignment 1 - Essay on Policy")
  - "type": string (one of: reading, essay, exam, quiz, discussion, poll, project, module, assignment, other)
  - "date": string or null (ISO date if found, e.g. "2026-01-30", or null if no specific date)
  - "dateDescription": string or null (date as written in syllabus, e.g. "Week 5, Friday 11:59pm")
  - "time": string or null (time if specified, e.g. "23:59")
  - "weight": number or null (grade percentage weight if mentioned)
  - "description": string (details, requirements, word count, format, etc.)
  - "category": string (one of: assignment, exam, deadline, event, policy)

4. "policies": array of notable course policies, each with:
  - "title": string (e.g. "Late Submission Policy")
  - "description": string (summary of the policy)

5. "weekNumbering": {
  - "style": string (one of: "skip_break" if the course skips the break/reading week number so Week 6 is followed by Week 7 after break, "include_break" if the course counts break week as a numbered week like Week 7 = Reading Week then Week 8, or "continuous" if weeks just count 1-13 regardless of breaks)
  - "breakWeekLabel": string or null (how the syllabus labels the break/reading week, e.g. "Reading Week", "Study Week", "Break", "Week 7 - No Class")
  - "totalWeeks": number or null (total number of instructional weeks mentioned)
  - "evidence": string (quote or describe the part of the syllabus that shows how weeks are numbered around the break)
}

Be extremely thorough. Include EVERY assignment, deadline, exam, quiz, discussion post, and important date mentioned anywhere in the syllabus — even if found in a weekly schedule/outline table.

Syllabus text:
${pdfText.substring(0, 12000)}

Return ONLY the JSON object, no markdown formatting.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      let parsed: any;
      try {
        const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response", raw: responseText });
      }

      console.log(`[Syllabus] Parsed ${courseName}: ${parsed.items?.length || 0} items, ${parsed.gradingBreakdown?.length || 0} grading components`);

      res.json({
        ...parsed,
        objectPath,
        fileName: fileName || 'Syllabus.pdf',
      });
    } catch (err: any) {
      console.error("Error parsing syllabus:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Parse uploaded assignment PDF and extract task details
  app.post("/api/tasks/parse-assignment-pdf", async (req, res) => {
    try {
      const { objectPath, courseName, fileName } = req.body;
      if (!objectPath || !courseName) {
        return res.status(400).json({ error: "objectPath and courseName are required" });
      }

      const bucketId = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split('/')[1] || '';
      const filePath = objectPath.replace('/objects/', '');
      let fileBuffer: Buffer;
      try {
        const [buffer] = await objectStorageClient.bucket(bucketId).file(filePath).download();
        fileBuffer = buffer;
      } catch (dlErr) {
        console.error("Failed to download file from object storage:", dlErr);
        return res.status(500).json({ error: "Failed to read uploaded file" });
      }

      let pdfText = '';
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(fileBuffer), verbosity: 0 });
        const result = await parser.getText();
        pdfText = result.text || '';
      } catch (pdfErr) {
        console.error("Failed to parse PDF:", pdfErr);
        return res.status(500).json({ error: "Failed to parse PDF content" });
      }

      if (!pdfText.trim()) {
        return res.status(400).json({ error: "Could not extract text from PDF" });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `Extract assignment details from this academic document. Return a JSON object with these fields:
- title: string (the assignment name, e.g. "Assignment 2 - Municipal Issues Policy Paper")
- type: string (one of: reading, essay, exam, quiz, discussion, poll, project, module, class, assignment, other)
- description: string (comprehensive summary including requirements, word count, format, grading breakdown, topics/options, and any other key details)
- gradeWeight: number or null (percentage of final grade if mentioned, e.g. 30 for 30%)
- dueDescription: string (the due date description as written, e.g. "End of Week 10, Friday 11:59 pm")
- wordCount: string or null (required word count if mentioned)
- format: string or null (format requirements like "APA", "double spaced", etc.)

Document text:
${pdfText.substring(0, 4000)}

Return ONLY the JSON object, no markdown formatting.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      let parsed: any;
      try {
        const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response", raw: responseText });
      }

      res.json({
        ...parsed,
        objectPath,
        fileName: fileName || 'Assignment.pdf',
      });
    } catch (err: any) {
      console.error("Error parsing assignment PDF:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Seed database with sample tasks
  await seedDatabase();

  // NOTE: Alexa reminder announcements are handled ONLY by server/reminderScheduler.ts
  // which persists sent keys to the database. Do NOT add a duplicate here.

  // One-time fix: CFNF Module 8 (file id=28) incorrectly marked as listened on production
  try {
    const file28 = await storage.getFile(28);
    if (file28 && file28.listened === true && file28.displayName?.includes('Module 8')) {
      await storage.updateFile(28, { listened: false });
      console.log('[Startup Fix] Corrected CFNF Module 8 (file 28) listened=false');
    }
  } catch (e) {
    // Ignore if file doesn't exist on this environment
  }

  // One-time fix: Essay Assignment 1 (task id=23) lost eventStartTime during reschedule
  try {
    const task23 = await storage.getTask(23);
    if (task23 && !task23.eventStartTime && task23.title === 'Essay Assignment 1') {
      await storage.updateTask(23, { eventStartTime: '18:00' });
      console.log('[Startup Fix] Restored Essay Assignment 1 (task 23) eventStartTime=18:00');
    }
  } catch (e) {
    // Ignore if task doesn't exist on this environment
  }

  // Auto-sync CRCU shifts on startup
  (async () => {
    try {
      const thirdAccStatus = await isThirdAccountConnected();
      if (thirdAccStatus.connected) {
        const calendarId = 'family01331437021788124598@group.calendar.google.com';
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), 0, 1);
        const timeMax = new Date(now.getFullYear() + 1, 0, 31, 23, 59, 59);
        const events = await getEventsFromThirdAccountCalendar(calendarId, timeMin, timeMax);
        const shiftEntries: { date: string; shiftType: string }[] = [];
        for (const event of events) {
          const summary = (event.summary || '').toLowerCase();
          if (!summary.includes('crcu')) continue;
          const startStr = event.start?.dateTime || event.start?.date;
          if (!startStr) continue;
          const startDate = new Date(startStr);
          const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const hour = startDate.getHours();
          const isNight = hour >= 18 || hour < 6 || summary.includes('🌙');
          shiftEntries.push({ date: dateStr, shiftType: isNight ? 'night' : 'day' });
        }
        await storage.clearAllShifts();
        if (shiftEntries.length > 0) {
          await storage.setShiftBulk(shiftEntries);
        }
        console.log(`[Startup] Auto-synced ${shiftEntries.length} CRCU shifts`);
      } else {
        console.log('[Startup] Third Google account not connected, skipping CRCU shift sync');
      }
    } catch (err) {
      console.error('[Startup] CRCU shift auto-sync failed:', err);
    }
  })();

  (async () => {
    try {
      const sem = await storage.getActiveSemesterSettings();
      if (sem && !sem.course1BorderColor && !sem.course1CourseRowColor && !sem.course1TaskBgColor) {
        const rows = await db.select().from(degreeTrackingData).where(eq(degreeTrackingData.key, 'coursesData'));
        if (rows.length > 0 && rows[0].value) {
          const parsed = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
          const courses = parsed?.courses || [];
          const colorPayload: Record<string, any> = {};
          for (let i = 0; i < Math.min(courses.length, 3); i++) {
            const prefix = `course${i + 1}`;
            const c = courses[i];
            if (c.borderColor) colorPayload[`${prefix}BorderColor`] = c.borderColor;
            if (c.courseRowColor) colorPayload[`${prefix}CourseRowColor`] = c.courseRowColor;
            if (c.taskBgColor) colorPayload[`${prefix}TaskBgColor`] = c.taskBgColor;
          }
          if (Object.keys(colorPayload).length > 0) {
            await storage.updateSemesterSettings(sem.id, colorPayload);
            console.log(`[Startup] Seeded semester color columns from degree_tracking_data`);
          }
        }
      }
    } catch (err) {
      console.error('[Startup] Color migration failed:', err);
    }
  })();

  app.post("/api/tasks/compare-course-list", async (req, res) => {
    try {
      const { courseListText, courseName } = req.body;
      if (!courseListText || typeof courseListText !== 'string') {
        return res.status(400).json({ error: "courseListText is required" });
      }

      const existingTasks = await storage.getTasks();
      const courseCode = courseName?.split(' - ')[0]?.trim()?.toUpperCase() || '';
      const courseTasks = existingTasks.filter(t => {
        const tc = t.courseName?.split(' - ')[0]?.trim()?.toUpperCase() || '';
        return tc === courseCode;
      });

      const lines = courseListText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      const parsedItems: Array<{
        title: string;
        type: string;
        weekNumber: number | null;
        dueDate: string | null;
        startDate: string | null;
        gradeWeight: number | null;
        referenceLink: string | null;
        eventStartTime: string | null;
        eventEndTime: string | null;
      }> = [];

      const typeKeywords: Record<string, string[]> = {
        'reading': ['reading', 'read ch', 'textbook', 'chapter'],
        'module': ['module', 'lesson', 'lecture', 'watch'],
        'discussion': ['discussion', 'forum', 'post', 'respond', 'reply'],
        'quiz': ['quiz', 'test'],
        'exam': ['exam', 'midterm', 'final exam'],
        'essay': ['essay', 'paper', 'write', 'report', 'assignment', 'submit'],
        'poll': ['poll', 'survey', 'vote'],
        'project': ['project', 'presentation', 'group'],
      };

      const detectType = (text: string): string => {
        const lower = text.toLowerCase();
        for (const [type, keywords] of Object.entries(typeKeywords)) {
          if (keywords.some(kw => lower.includes(kw))) return type;
        }
        return 'other';
      };

      const parseDate = (text: string): string | null => {
        const datePatterns = [
          /(\d{4}-\d{2}-\d{2})/,
          /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
          /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/i,
          /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/i,
        ];
        for (const pattern of datePatterns) {
          const match = text.match(pattern);
          if (match) {
            const d = new Date(match[1]);
            if (!isNaN(d.getTime())) return d.toISOString();
          }
        }
        return null;
      };

      const parseTime = (text: string): { start: string | null; end: string | null } => {
        const timeRange = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)/);
        if (timeRange) {
          return { start: timeRange[1].trim(), end: timeRange[2].trim() };
        }
        const ampmRange = text.match(/(\d{1,2}\s*(?:am|pm|AM|PM))\s*[-–]\s*(\d{1,2}\s*(?:am|pm|AM|PM))/);
        if (ampmRange) {
          return { start: ampmRange[1].trim(), end: ampmRange[2].trim() };
        }
        return { start: null, end: null };
      };

      const parseWeek = (text: string): number | null => {
        const weekMatch = text.match(/week\s*(\d+)/i);
        if (weekMatch) return parseInt(weekMatch[1]);
        return null;
      };

      const parseWeight = (text: string): number | null => {
        const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
        if (weightMatch) return parseFloat(weightMatch[1]);
        return null;
      };

      let currentWeek: number | null = null;
      let currentDate: string | null = null;

      for (const line of lines) {
        const weekHeader = line.match(/^week\s*(\d+)/i);
        if (weekHeader) {
          currentWeek = parseInt(weekHeader[1]);
          const headerDate = parseDate(line);
          if (headerDate) currentDate = headerDate;
          continue;
        }

        const dateHeader = parseDate(line);
        if (dateHeader && line.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d)/i) && line.length < 50) {
          currentDate = dateHeader;
          continue;
        }

        if (line.match(/^[-=]+$/) || line.match(/^#{1,3}\s/) || line.length < 3) continue;

        const title = line
          .replace(/(\d{4}-\d{2}-\d{2})/g, '')
          .replace(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g, '')
          .replace(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/gi, '')
          .replace(/(\d+(?:\.\d+)?)\s*%/g, '')
          .replace(/week\s*\d+/gi, '')
          .replace(/\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?/g, '')
          .replace(/\d{1,2}\s*(?:am|pm|AM|PM)\s*[-–]\s*\d{1,2}\s*(?:am|pm|AM|PM)/g, '')
          .replace(/^\s*[-•*]\s*/, '')
          .replace(/\s*[-–]\s*[-–]\s*/g, ' - ')
          .replace(/\s*[-–]\s*$/g, '')
          .replace(/^\s*[-–]\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!title || title.length < 3) continue;

        const type = detectType(line);
        const week = parseWeek(line) || currentWeek;
        const date = parseDate(line) || currentDate;
        const weight = parseWeight(line);
        const times = parseTime(line);

        parsedItems.push({
          title,
          type,
          weekNumber: week,
          dueDate: date,
          startDate: null,
          gradeWeight: weight,
          referenceLink: null,
          eventStartTime: times.start,
          eventEndTime: times.end,
        });
      }

      const changes: Array<{
        id: string;
        changeType: 'new' | 'modified' | 'removed';
        category: string;
        description: string;
        details: Record<string, { old: string; new: string }>;
        parsed: typeof parsedItems[0] | null;
        existingTaskId: number | null;
      }> = [];

      let changeIdx = 0;
      const matchedExistingIds = new Set<number>();

      for (const item of parsedItems) {
        const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchingTask = courseTasks.find(t => {
          const titleMatch = normalizeTitle(t.title) === normalizeTitle(item.title);
          const fuzzyMatch = normalizeTitle(t.title).includes(normalizeTitle(item.title)) || 
                            normalizeTitle(item.title).includes(normalizeTitle(t.title));
          const weekMatch = item.weekNumber === null || t.weekNumber === item.weekNumber;
          return (titleMatch || (fuzzyMatch && weekMatch));
        });

        if (matchingTask) {
          matchedExistingIds.add(matchingTask.id);
          const diffs: Record<string, { old: string; new: string }> = {};
          if (item.dueDate && matchingTask.dueDate) {
            const existingDate = formatLocalDate(new Date(matchingTask.dueDate));
            const newDate = formatLocalDate(new Date(item.dueDate));
            if (existingDate !== newDate) diffs['dueDate'] = { old: existingDate, new: newDate };
          }
          if (item.type !== 'other' && item.type !== matchingTask.type) {
            diffs['type'] = { old: matchingTask.type, new: item.type };
          }
          if (item.gradeWeight !== null && item.gradeWeight !== matchingTask.gradeWeight) {
            diffs['gradeWeight'] = { old: String(matchingTask.gradeWeight || ''), new: String(item.gradeWeight) };
          }
          if (item.eventStartTime && item.eventStartTime !== matchingTask.eventStartTime) {
            diffs['eventStartTime'] = { old: matchingTask.eventStartTime || '', new: item.eventStartTime };
          }
          if (item.eventEndTime && item.eventEndTime !== matchingTask.eventEndTime) {
            diffs['eventEndTime'] = { old: matchingTask.eventEndTime || '', new: item.eventEndTime };
          }
          if (Object.keys(diffs).length > 0) {
            changes.push({
              id: `change-${changeIdx++}`,
              changeType: 'modified',
              category: item.type,
              description: `Update "${matchingTask.title}" (Week ${matchingTask.weekNumber})`,
              details: diffs,
              parsed: item,
              existingTaskId: matchingTask.id,
            });
          }
        } else {
          changes.push({
            id: `change-${changeIdx++}`,
            changeType: 'new',
            category: item.type,
            description: `Add "${item.title}"${item.weekNumber ? ` (Week ${item.weekNumber})` : ''}`,
            details: {},
            parsed: item,
            existingTaskId: null,
          });
        }
      }

      for (const task of courseTasks) {
        if (!matchedExistingIds.has(task.id) && !task.isCompleted) {
          changes.push({
            id: `change-${changeIdx++}`,
            changeType: 'removed',
            category: task.type,
            description: `Remove "${task.title}" (Week ${task.weekNumber})`,
            details: {},
            parsed: null,
            existingTaskId: task.id,
          });
        }
      }

      res.json({ changes, parsedCount: parsedItems.length, existingCount: courseTasks.length });
    } catch (error) {
      console.error("Error comparing course list:", error);
      res.status(500).json({ error: "Failed to compare course list" });
    }
  });

  app.post("/api/tasks/apply-course-changes", async (req, res) => {
    try {
      const { changes, courseName } = req.body;
      if (!changes || !Array.isArray(changes)) {
        return res.status(400).json({ error: "changes array is required" });
      }

      const results = { created: 0, updated: 0, deleted: 0, errors: 0 };
      const courseCode = courseName?.split(' - ')[0]?.trim()?.toUpperCase() || '';

      for (const change of changes) {
        try {
          if (change.existingTaskId) {
            const existingTask = await storage.getTask(change.existingTaskId);
            if (existingTask) {
              const taskCode = existingTask.courseName?.split(' - ')[0]?.trim()?.toUpperCase() || '';
              if (courseCode && taskCode !== courseCode) {
                results.errors++;
                continue;
              }
            }
          }
          if (change.changeType === 'new' && change.parsed) {
            await storage.createTask({
              title: change.parsed.title,
              type: change.parsed.type || 'other',
              courseName: courseName || '',
              weekNumber: change.parsed.weekNumber || 1,
              dueDate: change.parsed.dueDate ? new Date(change.parsed.dueDate) : new Date(),
              startDate: change.parsed.startDate ? new Date(change.parsed.startDate) : null,
              gradeWeight: change.parsed.gradeWeight,
              eventStartTime: change.parsed.eventStartTime,
              eventEndTime: change.parsed.eventEndTime,
            });
            results.created++;
          } else if (change.changeType === 'modified' && change.existingTaskId) {
            const updates: Record<string, unknown> = {};
            for (const [field, diff] of Object.entries(change.details)) {
              const d = diff as { old: string; new: string };
              if (field === 'dueDate') updates.dueDate = new Date(d.new);
              else if (field === 'gradeWeight') updates.gradeWeight = Math.round(parseFloat(d.new));
              else updates[field] = d.new;
            }
            await storage.updateTask(change.existingTaskId, updates);
            results.updated++;
          } else if (change.changeType === 'removed' && change.existingTaskId) {
            await storage.deleteTask(change.existingTaskId);
            results.deleted++;
          }
        } catch (err) {
          console.error("Error applying change:", change, err);
          results.errors++;
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error applying course changes:", error);
      res.status(500).json({ error: "Failed to apply changes" });
    }
  });

  app.get("/api/spotify/status", async (_req, res) => {
    res.json({ connected: spotifyApi.isConnected() });
  });

  app.get("/api/spotify/login", async (req, res) => {
    try {
      const authUrl = spotifyApi.getAuthUrl();
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).send("Failed to start Spotify login: " + error.message);
    }
  });

  app.get("/api/spotify/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("No authorization code received");
      }
      await spotifyApi.handleCallback(code);
      res.redirect("/?auth=5747&spotify=connected");
    } catch (error: any) {
      console.error("Spotify callback error:", error?.message || error);
      res.status(500).send("Spotify connection failed: " + error.message);
    }
  });

  app.get("/api/spotify/now-playing", async (_req, res) => {
    try {
      const playback = await spotifyApi.getNowPlaying();
      if (!playback || !playback.item) {
        return res.json({ playing: false });
      }
      const track = playback.item as any;
      res.json({
        playing: playback.is_playing,
        name: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        album: track.album?.name || "",
        albumArt: track.album?.images?.[0]?.url || "",
        albumArtSmall: track.album?.images?.[track.album.images.length - 1]?.url || "",
        progress: playback.progress_ms,
        duration: track.duration_ms,
        trackUrl: track.external_urls?.spotify || "",
      });
    } catch (error: any) {
      console.error("Spotify now-playing error:", error?.message || error);
      res.status(500).json({ error: "Failed to get Spotify status" });
    }
  });

  app.get("/api/spotify/recent", async (_req, res) => {
    try {
      const recent = await spotifyApi.getRecentTracks(5);
      const tracks = (recent?.items || []).map((item: any) => ({
        name: item.track.name,
        artist: item.track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        album: item.track.album?.name || "",
        albumArt: item.track.album?.images?.[0]?.url || "",
        albumArtSmall: item.track.album?.images?.[item.track.album.images.length - 1]?.url || "",
        playedAt: item.played_at,
        trackUrl: item.track.external_urls?.spotify || "",
      }));
      res.json(tracks);
    } catch (error: any) {
      console.error("Spotify recent error:", error?.message || error);
      res.status(500).json({ error: "Failed to get recent tracks" });
    }
  });

  app.put("/api/spotify/play", async (_req, res) => {
    try {
      await spotifyApi.play();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify play error:", error?.message || error);
      res.status(500).json({ error: "Failed to play" });
    }
  });

  app.put("/api/spotify/pause", async (_req, res) => {
    try {
      await spotifyApi.pause();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify pause error:", error?.message || error);
      res.status(500).json({ error: "Failed to pause" });
    }
  });

  app.post("/api/spotify/next", async (_req, res) => {
    try {
      await spotifyApi.next();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify next error:", error?.message || error);
      res.status(500).json({ error: "Failed to skip" });
    }
  });

  app.post("/api/spotify/previous", async (_req, res) => {
    try {
      await spotifyApi.previous();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify previous error:", error?.message || error);
      res.status(500).json({ error: "Failed to go back" });
    }
  });

  app.get("/api/spotify/playlists", async (_req, res) => {
    try {
      const data = await spotifyApi.getPlaylists();
      const items = (data?.items || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url || "",
        imageSmall: p.images?.[p.images.length - 1]?.url || p.images?.[0]?.url || "",
        trackCount: p.tracks?.total || 0,
        uri: p.uri,
        owner: p.owner?.display_name || "",
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch playlists" });
    }
  });

  app.get("/api/spotify/albums", async (_req, res) => {
    try {
      const data = await spotifyApi.getSavedAlbums();
      const items = (data?.items || []).map((item: any) => ({
        id: item.album.id,
        name: item.album.name,
        artist: item.album.artists?.map((a: any) => a.name).join(", ") || "",
        image: item.album.images?.[0]?.url || "",
        imageSmall: item.album.images?.[item.album.images.length - 1]?.url || item.album.images?.[0]?.url || "",
        trackCount: item.album.total_tracks || 0,
        uri: item.album.uri,
        year: item.album.release_date?.substring(0, 4) || "",
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch albums" });
    }
  });

  app.get("/api/spotify/artists", async (_req, res) => {
    try {
      const data = await spotifyApi.getTopArtists();
      const items = (data?.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url || "",
        imageSmall: a.images?.[a.images.length - 1]?.url || a.images?.[0]?.url || "",
        genres: a.genres?.slice(0, 3) || [],
        uri: a.uri,
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch artists" });
    }
  });

  app.get("/api/spotify/tracks", async (_req, res) => {
    try {
      const data = await spotifyApi.getSavedTracks();
      const items = (data?.items || []).map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists?.map((a: any) => a.name).join(", ") || "",
        album: item.track.album?.name || "",
        image: item.track.album?.images?.[0]?.url || "",
        imageSmall: item.track.album?.images?.[item.track.album.images.length - 1]?.url || "",
        duration: item.track.duration_ms || 0,
        uri: item.track.uri,
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tracks" });
    }
  });

  app.put("/api/spotify/volume", async (req, res) => {
    try {
      const { volume } = req.body;
      await spotifyApi.setVolume(volume);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set volume" });
    }
  });

  app.put("/api/spotify/play-context", async (req, res) => {
    try {
      const { uri, offset } = req.body;
      await spotifyApi.playContext(uri, offset);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to play" });
    }
  });

  app.put("/api/spotify/play-tracks", async (req, res) => {
    try {
      const { uris } = req.body;
      await spotifyApi.playTracks(uris);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to play tracks" });
    }
  });

  app.put("/api/spotify/shuffle", async (req, res) => {
    try {
      const { state } = req.body;
      await spotifyApi.setShuffle(state);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set shuffle" });
    }
  });

  app.put("/api/spotify/repeat", async (req, res) => {
    try {
      const { state } = req.body;
      await spotifyApi.setRepeat(state);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set repeat" });
    }
  });

  app.get("/api/spotify/playback-state", async (_req, res) => {
    try {
      const data = await spotifyApi.getPlaybackState();
      if (!data) {
        res.json({ active: false });
        return;
      }
      res.json({
        active: true,
        volume: data.device?.volume_percent ?? 50,
        shuffle: data.shuffle_state ?? false,
        repeat: data.repeat_state ?? "off",
        deviceName: data.device?.name || "Unknown",
        deviceType: data.device?.type || "Unknown",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get playback state" });
    }
  });

  app.get("/api/spotify/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) { res.json({ tracks: [], artists: [], albums: [], playlists: [] }); return; }
      const data = await spotifyApi.search(q);
      res.json({
        tracks: (data?.tracks?.items || []).map((t: any) => ({
          id: t.id, name: t.name,
          artist: t.artists?.map((a: any) => a.name).join(", ") || "",
          album: t.album?.name || "",
          image: t.album?.images?.[0]?.url || "",
          imageSmall: t.album?.images?.[t.album.images.length - 1]?.url || "",
          duration: t.duration_ms || 0, uri: t.uri,
        })),
        artists: (data?.artists?.items || []).map((a: any) => ({
          id: a.id, name: a.name,
          image: a.images?.[0]?.url || "",
          imageSmall: a.images?.[a.images.length - 1]?.url || "",
          genres: a.genres?.slice(0, 3) || [], uri: a.uri,
        })),
        albums: (data?.albums?.items || []).map((a: any) => ({
          id: a.id, name: a.name,
          artist: a.artists?.map((ar: any) => ar.name).join(", ") || "",
          image: a.images?.[0]?.url || "",
          imageSmall: a.images?.[a.images.length - 1]?.url || "",
          year: a.release_date?.substring(0, 4) || "", uri: a.uri,
        })),
        playlists: (data?.playlists?.items || []).map((p: any) => ({
          id: p.id, name: p.name,
          image: p.images?.[0]?.url || "",
          imageSmall: p.images?.[p.images.length - 1]?.url || p.images?.[0]?.url || "",
          owner: p.owner?.display_name || "", uri: p.uri,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search" });
    }
  });

  app.get("/api/spotify/related-artists", async (req, res) => {
    try {
      const artistId = req.query.artistId as string;
      if (!artistId) return res.json({ artists: [] });
      const data = await spotifyApi.getRelatedArtists(artistId);
      const artists = (data?.artists || []).slice(0, 8).map((a: any) => ({
        id: a.id, name: a.name,
        image: a.images?.[0]?.url || "",
        imageSmall: a.images?.[a.images.length - 1]?.url || "",
        genres: a.genres?.slice(0, 3) || [],
        uri: a.uri,
      }));
      res.json({ artists });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get related artists" });
    }
  });

  app.post("/api/spotify/bulk-images", async (req, res) => {
    try {
      const { items } = req.body as { items: { name: string; uri: string; searchQuery?: string }[] };
      if (!items || !Array.isArray(items)) return res.json({ images: {} });
      const images: Record<string, string> = {};
      const ids: Record<string, string> = {};
      for (const item of items) {
        try {
          const parts = item.uri.split(":");
          const type = parts[1];
          const id = parts[2];
          if (type === "artist") {
            try {
              const data = await spotifyApi.getArtistById(id);
              if (data?.images?.[0]?.url) images[item.name] = data.images[0].url;
              if (data?.id) ids[item.name] = data.id;
            } catch {}
            if (!images[item.name]) {
              const q = item.searchQuery || item.name;
              const searchData = await spotifyApi.search(q, 'artist', 3);
              const artists = searchData?.artists?.items || [];
              for (const a of artists) {
                if (a?.images?.[0]?.url) {
                  images[item.name] = a.images[0].url;
                  if (a.id) ids[item.name] = a.id;
                  break;
                }
              }
            }
          } else if (type === "playlist") {
            const data = await spotifyApi.getPlaylistById(id);
            if (data?.images?.[0]?.url) images[item.name] = data.images[0].url;
          } else if (type === "track") {
            try {
              const trackData = await spotifyApi.getTrackById(id);
              if (trackData?.album?.images?.[0]?.url) images[item.name] = trackData.album.images[0].url;
              if (trackData?.artists?.[0]?.id) ids[item.name] = trackData.artists[0].id;
            } catch {
              const q = item.searchQuery || item.name;
              const searchData = await spotifyApi.search(q, 'track', 1);
              const track = searchData?.tracks?.items?.[0];
              if (track?.album?.images?.[0]?.url) images[item.name] = track.album.images[0].url;
            }
          }
        } catch (e: any) {
          console.error(`[Spotify] Bulk image fetch failed for ${item.name}:`, e.message);
        }
      }
      const found = Object.keys(images);
      const missing = items.map(i => i.name).filter(n => !images[n]);
      console.log(`[Spotify] Bulk images: ${found.length} found, ${missing.length} missing${missing.length ? ': ' + missing.join(', ') : ''}`);
      res.json({ images, ids });
    } catch (error: any) {
      console.error("[Spotify] Bulk images error:", error.message);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.get("/api/spotify/devices", async (_req, res) => {
    try {
      const data = await spotifyApi.getDevices();
      const devices = (data?.devices || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
        volume: d.volume_percent,
      }));
      res.json(devices);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get devices" });
    }
  });

  app.put("/api/spotify/transfer", async (req, res) => {
    try {
      const { deviceId } = req.body;
      await spotifyApi.transferPlayback(deviceId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to transfer playback" });
    }
  });

  app.get("/api/spotify/rooms", async (_req, res) => {
    try {
      const rooms = FLICK_DEVICES.map(g => ({
        room: g.room,
        icon: g.icon,
        speakers: g.devices.filter(d => d.type === "echo" || d.type === "echo_show" || d.type === "speaker" || d.type === "group").map(d => ({
          id: d.id,
          name: d.name,
          entityId: d.entityId,
          type: d.type,
          room: d.room,
        })),
      })).filter(g => g.speakers.length > 0);
      res.json(rooms);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get rooms" });
    }
  });

  app.post("/api/spotify/play-on-speaker", async (req, res) => {
    try {
      const { entityId, spotifyUri, artistName, searchQuery, deviceType, announceMessage, command } = req.body;
      if (!entityId) return res.status(400).json({ error: "entityId required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      if (command === "pause" || command === "stop") {
        
        console.log(`[Spotify] ${command} command for entity: ${entityId}`);
        try {
          await fetch(`${haUrl}/api/services/media_player/media_${command === "stop" ? "stop" : "pause"}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
          });
          console.log(`[Spotify] SpotifyPlus ${command} sent`);
        } catch (e: any) {
          console.log(`[Spotify] SpotifyPlus ${command} failed: ${e.message}`);
        }
        try {
          await fetch(`${haUrl}/api/services/media_player/media_${command === "stop" ? "stop" : "pause"}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: entityId }),
          });
          console.log(`[Spotify] ${command} sent to ${entityId}`);
        } catch (e: any) {
          console.log(`[Spotify] ${command} on ${entityId} failed: ${e.message}`);
        }
        if (command === "stop") {
          spotifyActivePlaybacks.delete(entityId);
          if (spotifyActivePlaybacks.size === 0) clearSpotifyStaleTimer();
        } else {
          startSpotifyStaleTimer();
        }
        return res.json({ ok: true, action: command });
      }

      const isEcho = entityId.includes("echo") || entityId.includes("_am") || deviceType === "echo" || deviceType === "echo_show";

      if (isEcho) {
        let targetEntity = entityId;
        if (entityId === EVERYWHERE_GROUP_ENTITY) {
          const anyEcho = FLICK_DEVICES.flatMap(g => g.devices).find(d => d.type === "echo" && d.entityId.includes("_am"));
          if (anyEcho) {
            console.log(`[Spotify] BYhome group → using Echo for voice command: ${anyEcho.entityId}`);
            targetEntity = anyEcho.entityId;
          }
        } else if (entityId.includes("_group") || entityId.includes("_media_group")) {
          const roomGroup = FLICK_DEVICES.find(g => 
            g.devices.some(d => d.entityId === entityId) ||
            g.speakers?.some((s: any) => s.entityId === entityId)
          );
          if (roomGroup) {
            const echoDevice = roomGroup.devices.find(d => d.type === "echo" && d.entityId.includes("_am"));
            if (echoDevice) {
              console.log(`[Spotify] Resolved group ${entityId} → individual Echo: ${echoDevice.entityId}`);
              targetEntity = echoDevice.entityId;
            }
          }
          if (targetEntity === entityId) {
            for (const group of FLICK_DEVICES) {
              for (const dev of group.devices) {
                if (dev.type === "group" && dev.entityId === entityId) {
                  const echoInRoom = group.devices.find(d => d.type === "echo" && d.entityId.includes("_am"));
                  if (echoInRoom) {
                    console.log(`[Spotify] Resolved group ${entityId} → Echo in ${group.room}: ${echoInRoom.entityId}`);
                    targetEntity = echoInRoom.entityId;
                  }
                  break;
                }
              }
              if (targetEntity !== entityId) break;
            }
          }
        }

        if (announceMessage) {
          const isEverywhereGroup = entityId === EVERYWHERE_GROUP_ENTITY;
          if (isEverywhereGroup) {
            const allEchoTargets = FLICK_DEVICES.flatMap(g => g.devices).filter(d => (d.type === "echo" || d.type === "echo_show") && d.entityId.includes("_am")).map(d => d.entityId);
            console.log(`[Spotify] TTS announce on ALL ${allEchoTargets.length} Echo speakers: "${announceMessage}"`);
            try {
              await fetch(`${haUrl}/api/services/notify/alexa_media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: announceMessage,
                  data: { type: "tts" },
                  target: allEchoTargets,
                }),
              });
              await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (ttsErr: any) {
              console.log(`[Spotify] TTS announce on all speakers failed (continuing): ${ttsErr.message}`);
            }
          } else {
            console.log(`[Spotify] TTS announce on ${targetEntity}: "${announceMessage}"`);
            try {
              await fetch(`${haUrl}/api/services/notify/alexa_media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: announceMessage,
                  data: { type: "tts" },
                  target: [targetEntity],
                }),
              });
              await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (ttsErr: any) {
              console.log(`[Spotify] TTS announce failed (continuing): ${ttsErr.message}`);
            }
          }
        }

        
        
        const spotifyPlusSourceMap: Record<string, string> = {
          [EVERYWHERE_GROUP_ENTITY]: "BYhome",
          "media_player.king_bedroom_media_group": "King Bedroom",
          "media_player.queen_bedroom_media_group": "Queen Bedroom",
          "media_player.living_room_media_group": "Echo - LR Studio White AM",
          "media_player.kitchen_media_group": "Echo - Kitchen Studio Black AM",
          "media_player.hallway_media_group": "Echo - Hallway Corner",
          "media_player.closet_media_group": "Echo - Closet AM",
          "media_player.pug_media_group": "Echo Show - Pug AM",
          "media_player.echo_closet_am": "Echo - Closet AM",
          "media_player.echo_show_pug_am": "Echo Show - Pug AM",
          "media_player.echo_lr_couch_l_am": "Echo - LR Couch (L) AM",  
          "media_player.echo_lr_studio_white_am": "Echo - LR Studio White AM",
          "media_player.echo_king_l_am": "Echo - King (L) AM",
          "media_player.echo_king_r_am": "Echo - King (R) AM",
          "media_player.echo_king_tv_am": "Echo - King TV AM",
          "media_player.echo_queen_bed_l_am": "Echo - Queen Bed (L) AM",
          "media_player.echo_queen_bed_r_am": "Echo - Queen Bed (R) AM",
          "media_player.echo_queen_balcony_am": "Echo - Queen Balcony AM",
          "media_player.echo_kitchen_island_corner_am": "Echo - Kitchen Island Corner AM",
          "media_player.echo_kitchen_studio_black_am": "Echo - Kitchen Studio Black AM",
          "media_player.echo_kitchen_cupboards_left_am": "Echo - Kitchen Cupboards (Left) AM",
          "media_player.echo_kitchen_cupboards_r_am": "Echo - Kitchen Cupboards (R) AM",
          "media_player.echo_kitchen_hutch_am": "Echo - Kitchen Hutch AM",
          "media_player.echo_kitchen_fridge_am": "Echo - Kitchen Fridge AM",
          "media_player.echo_hallway_entrance_am": "Echo - Hallway Corner",
          "media_player.echo_lr_hub_am": "Echo - LR Hub AM",
          "media_player.echo_lr_tv_shelf_am": "Echo - LR TV Shelf AM",
        };

        const groupEntityId = entityId !== targetEntity ? entityId : null;
        const spSource = spotifyPlusSourceMap[entityId] || spotifyPlusSourceMap[targetEntity];
        
        const isRadioCommand = !spotifyUri && searchQuery && (searchQuery.toLowerCase().includes("fm") || searchQuery.toLowerCase().includes("radio") || searchQuery.toLowerCase().includes("tunein") || searchQuery.toLowerCase().includes("chum"));
        if (isRadioCommand) {
          const voiceCommand = `play ${searchQuery}`;
          console.log(`[Spotify] Radio/TuneIn content detected, sending voice command to ${targetEntity}: "${voiceCommand}"`);
          try {
            await fetch(`${haUrl}/api/services/media_player/turn_on`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: targetEntity }),
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (wakeErr: any) {
            console.log(`[Spotify] Wake-up failed (continuing): ${wakeErr.message}`);
          }
          await fetch(`${haUrl}/api/services/media_player/play_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: targetEntity, media_content_id: voiceCommand, media_content_type: "custom" }),
          });
          trackSpotifyPlayback(entityId, artistName);
          clearSpotifyStaleTimer();
        } else if (spSource && spotifyUri) {
          console.log(`[Spotify] Using SpotifyPlus: source="${spSource}", uri=${spotifyUri}`);
          
          try {
            await fetch(`${haUrl}/api/services/media_player/turn_on`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e: any) {
            console.log(`[Spotify] SpotifyPlus turn_on failed (continuing): ${e.message}`);
          }

          const selectResp = await fetch(`${haUrl}/api/services/media_player/select_source`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity_id: SPOTIFYPLUS_ENTITY,
              source: spSource,
            }),
          });
          console.log(`[Spotify] SpotifyPlus select_source "${spSource}": ${selectResp.status}`);
          await new Promise(resolve => setTimeout(resolve, 2000));

          const isArtistUri = spotifyUri.startsWith("spotify:artist:");
          if (isArtistUri) {
            console.log(`[Spotify] Artist URI detected, using player_media_play_context for shuffle play`);
            const playResp = await fetch(`${haUrl}/api/services/spotifyplus/player_media_play_context`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_id: SPOTIFYPLUS_ENTITY,
                context_uri: spotifyUri,
                position_ms: 0,
                delay: 0.50,
              }),
            });
            const playText = await playResp.text();
            console.log(`[Spotify] SpotifyPlus player_media_play_context response: ${playResp.status} body=${playText.substring(0, 300)}`);
            if (!playResp.ok) {
              console.log(`[Spotify] player_media_play_context failed, falling back to voice command`);
              const searchTerm = searchQuery || artistName || "music";
              const voiceCommand = `play ${searchTerm} on Spotify`;
              console.log(`[Spotify] Sending voice command to ${targetEntity}: "${voiceCommand}"`);
              await fetch(`${haUrl}/api/services/media_player/play_media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ entity_id: targetEntity, media_content_id: voiceCommand, media_content_type: "custom" }),
              });
            }
          } else {
            const playResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_id: SPOTIFYPLUS_ENTITY,
                media_content_id: spotifyUri,
                media_content_type: "spotify",
              }),
            });
            const playText = await playResp.text();
            console.log(`[Spotify] SpotifyPlus play response: ${playResp.status} body=${playText.substring(0, 300)}`);
          }
          trackSpotifyPlayback(entityId, artistName);
          clearSpotifyStaleTimer();
        } else {
          console.log(`[Spotify] No SpotifyPlus source for ${entityId}, using voice command fallback`);
          const searchTerm = searchQuery || artistName || "music";
          const voiceCommand = `play ${searchTerm} on Spotify`;
          
          console.log(`[Spotify] Waking up Echo: ${targetEntity}`);
          try {
            await fetch(`${haUrl}/api/services/media_player/turn_on`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: targetEntity }),
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (wakeErr: any) {
            console.log(`[Spotify] Wake-up failed (continuing): ${wakeErr.message}`);
          }
          
          console.log(`[Spotify] Sending voice command to ${targetEntity}: "${voiceCommand}"`);
          await fetch(`${haUrl}/api/services/media_player/play_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity_id: targetEntity,
              media_content_id: voiceCommand,
              media_content_type: "custom",
            }),
          });
        }
      } else {
        const searchTerm = searchQuery || artistName || "music";
        const voiceCmd = `play ${searchTerm} on Spotify`;
        console.log(`[Spotify] Non-echo device, sending voice command to ${entityId}: "${voiceCmd}"`);
        await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: entityId, media_content_id: voiceCmd, media_content_type: "custom" }),
        });
      }
      console.log(`[Spotify] Play command complete for ${entityId}: "${searchQuery || artistName}"`);
      trackSpotifyPlayback(entityId, artistName);
      clearSpotifyStaleTimer();

      const volumeTarget = entityId;
      try {
        await fetch(`${haUrl}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: volumeTarget, volume_level: 0.35 }),
        });
        console.log(`[Spotify] Set volume to 35% on ${volumeTarget}`);
      } catch (volErr: any) {
        console.log(`[Spotify] Volume set failed (continuing): ${volErr.message}`);
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Spotify] Play on speaker error:", error);
      res.status(500).json({ error: "Failed to play on speaker" });
    }
  });

  app.post("/api/spotify/group-speakers", async (req, res) => {
    try {
      const { sourceEntityId, targetEntityId } = req.body;
      if (!sourceEntityId || !targetEntityId) return res.status(400).json({ error: "Both entity IDs required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      await fetch(`${haUrl}/api/services/media_player/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: sourceEntityId, group_members: [targetEntityId] }),
      });
      console.log(`[Spotify] Grouped ${targetEntityId} into ${sourceEntityId}`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Spotify] Group speakers error:", error);
      res.status(500).json({ error: "Failed to group speakers" });
    }
  });

  let spotifyActivePlaybacks: Map<string, { entityId: string; startedAt: number; artistName?: string }> = new Map();
  let spotifyStaleTimer: NodeJS.Timeout | null = null;
  const SPOTIFY_STALE_TIMEOUT_MS = 10 * 60 * 1000;

  function trackSpotifyPlayback(entityId: string, artistName?: string) {
    spotifyActivePlaybacks.set(entityId, { entityId, startedAt: Date.now(), artistName });
    console.log(`[Spotify] Tracking playback on ${entityId} (${artistName || 'unknown'}). Active: ${spotifyActivePlaybacks.size}`);
  }

  function clearSpotifyStaleTimer() {
    if (spotifyStaleTimer) {
      clearTimeout(spotifyStaleTimer);
      spotifyStaleTimer = null;
    }
  }

  function startSpotifyStaleTimer() {
    clearSpotifyStaleTimer();
    spotifyStaleTimer = setTimeout(async () => {
      if (spotifyActivePlaybacks.size === 0) return;
      console.log(`[Spotify] Stale timeout (${SPOTIFY_STALE_TIMEOUT_MS / 1000}s) reached. Clearing ${spotifyActivePlaybacks.size} stale playback(s).`);
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      try {
        await fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
        });
        console.log(`[Spotify] Stale cleanup: SpotifyPlus stopped`);
      } catch (e: any) {
        console.log(`[Spotify] Stale cleanup: SpotifyPlus stop failed: ${e.message}`);
      }
      for (const [, pb] of spotifyActivePlaybacks) {
        try {
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: pb.entityId }),
          });
          console.log(`[Spotify] Stale cleanup: stopped ${pb.entityId}`);
        } catch (e: any) {
          console.log(`[Spotify] Stale cleanup: ${pb.entityId} stop failed: ${e.message}`);
        }
      }
      spotifyActivePlaybacks.clear();
      console.log(`[Spotify] All stale playbacks cleared`);
    }, SPOTIFY_STALE_TIMEOUT_MS);
    console.log(`[Spotify] Stale timer started (${SPOTIFY_STALE_TIMEOUT_MS / 1000}s)`);
  }

  app.post("/api/spotify/stop-all", async (_req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      const results: string[] = [];
      clearSpotifyStaleTimer();

      try {
        await fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
        });
        results.push("SpotifyPlus stopped");
      } catch (e: any) {
        results.push(`SpotifyPlus stop failed: ${e.message}`);
      }

      for (const [, pb] of spotifyActivePlaybacks) {
        try {
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: pb.entityId }),
          });
          results.push(`Stopped ${pb.entityId}`);
        } catch (e: any) {
          results.push(`${pb.entityId} stop failed: ${e.message}`);
        }
      }

      try {
        await spotifyApi.pause();
        results.push("Spotify API paused");
      } catch (e: any) {
        results.push(`Spotify API pause failed: ${e.message}`);
      }

      const count = spotifyActivePlaybacks.size;
      spotifyActivePlaybacks.clear();
      console.log(`[Spotify] Stop-all: cleared ${count} tracked playbacks. Results: ${results.join(', ')}`);
      res.json({ ok: true, cleared: count, results });
    } catch (error: any) {
      console.error("[Spotify] Stop-all error:", error);
      res.status(500).json({ error: "Failed to stop all" });
    }
  });

  app.post("/api/spotify/flick", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

      let device: FlickDevice | undefined;
      let deviceRoom = "";
      for (const group of FLICK_DEVICES) {
        const found = group.devices.find(d => d.id === deviceId);
        if (found) { device = found; deviceRoom = group.room; break; }
      }
      if (!device) return res.status(404).json({ error: "Device not found" });

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = `https://${req.get('host') || new URL(DEPLOYED_APP_URL).host}`;
      const authParam = req.query.auth || "bryn";
      const spotifyUrl = `${appUrl}/spotify?auth=${authParam}`;
      console.log(`[Spotify Flick] Sending to ${device.name} (${deviceRoom}): ${spotifyUrl}`);

      const navigateDevice = async (targetDevice: FlickDevice) => {
        if (!targetDevice.canDisplay) return;
        try {
          if (targetDevice.type === "tablet" || targetDevice.type === "echo_show") {
            const navResp = await fetch(`${haUrl}/api/services/browser_mod/navigate`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ browser_id: targetDevice.entityId, path: spotifyUrl }),
            });
            console.log(`[Spotify Flick] Navigated ${targetDevice.entityId} via browser_mod: ${navResp.status}`);
          } else if (targetDevice.type === "tv") {
            const castResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: targetDevice.entityId, media_content_id: spotifyUrl, media_content_type: "url" }),
            });
            console.log(`[Spotify Flick] Cast to TV ${targetDevice.entityId}: ${castResp.status}`);
          }
        } catch (navErr: any) {
          console.error(`[Spotify Flick] Navigation failed for ${targetDevice.name}: ${navErr.message}`);
        }
      };

      if (device.canDisplay) {
        await navigateDevice(device);
      } else if (device.type === "group") {
        const roomGroup = FLICK_DEVICES.find(g => g.devices.some(d => d.id === device!.id));
        if (roomGroup) {
          const screenDevices = roomGroup.devices.filter(d => d.canDisplay && d.id !== device!.id);
          for (const screenDevice of screenDevices) {
            await navigateDevice(screenDevice);
          }
        }
      }

      res.json({ success: true, device: device.name, room: deviceRoom });
    } catch (error: any) {
      console.error("[Spotify Flick] Error:", error);
      res.status(500).json({ error: "Failed to flick", details: error.message });
    }
  });

  app.post("/api/spotify/ungroup-speaker", async (req, res) => {
    try {
      const { entityId } = req.body;
      if (!entityId) return res.status(400).json({ error: "entityId required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      await fetch(`${haUrl}/api/services/media_player/unjoin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId }),
      });
      console.log(`[Spotify] Ungrouped ${entityId}`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Spotify] Ungroup speaker error:", error);
      res.status(500).json({ error: "Failed to ungroup speaker" });
    }
  });

  app.post("/api/spotify/go-home", async (req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const homeUrl = "http://172.24.0.2:8123/lovelace/test-home";
      const tabletWrapperUrl = `${DEPLOYED_APP_URL}/tablet`;
      const tabletAdbEntities = [
        { entity: "media_player.tablet_hallway_entrance", name: "Hallway Entrance" },
        { entity: "media_player.tablet_hallway", name: "Hallway Main" },
        { entity: "media_player.tablet_11", name: "Living Room" },
        { entity: "media_player.bd24bb29_04a116d8_king", name: "King Bedroom" },
        { entity: "media_player.tablet_queen", name: "Queen Bedroom" },
        { entity: "media_player.tablet_kitchen_island", name: "Kitchen Island" },
        { entity: "media_player.tablet_cat", name: "Cat Washroom" },
      ];
      console.log(`[Spotify Home] Navigating ${tabletAdbEntities.length} tablets to ${homeUrl} via ADB`);
      res.json({ ok: true, navigating: tabletAdbEntities.length });

      await Promise.allSettled(
        tabletAdbEntities.map(async (tablet) => {
          try {
            await haServiceCall('androidtv/adb_command', {
              entity_id: tablet.entity,
              command: `am start --activity-clear-task -a android.intent.action.VIEW -d "${homeUrl}" com.amazon.cloud9`
            }, `Spotify Home ADB ${tablet.name}`);
            console.log(`[Spotify Home] ${tablet.name} → ADB navigate sent`);
          } catch (e: any) {
            console.log(`[Spotify Home] ${tablet.name} → ADB failed: ${e.message}`);
          }
        })
      );
    } catch (error: any) {
      console.error("[Spotify Home] Error:", error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pending-review", async (_req, res) => {
    try {
      const status = (_req.query.status as string) || undefined;
      const items = await storage.getPendingReviewItems(status);
      const todayStart = new Date(torontoDate().toDateString());
      const filtered = items.filter(item => {
        if (!item.startDate) return true;
        const itemDate = new Date(new Date(item.startDate).toDateString());
        return itemDate >= todayStart;
      });
      res.json(filtered);
    } catch (error: any) {
      console.error("[Review] Error fetching pending items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pending-review/:id/accept", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = (await storage.getPendingReviewItems()).find(i => i.id === id);
      if (!item) return res.status(404).json({ error: "Not found" });

      const rawData = item.rawData ? JSON.parse(item.rawData) : {};

      let weekNumber = 1;
      if (rawData.weekNumber) {
        weekNumber = rawData.weekNumber;
      } else {
        const semesterSettings = await storage.getActiveSemesterSettings();
        if (semesterSettings?.semesterStartDate) {
          const { getWeekNumber } = await import('../shared/schema');
          weekNumber = getWeekNumber(
            new Date(),
            new Date(semesterSettings.semesterStartDate),
            semesterSettings.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : null
          );
        }
      }

      const taskData: any = {
        title: item.title,
        type: item.taskType || 'meeting',
        courseName: item.courseName || null,
        dueDate: item.startDate || new Date(),
        eventStartTime: item.eventStartTime || null,
        eventEndTime: item.eventEndTime || null,
        weekNumber,
        priority: rawData.priority || 'medium',
        description: item.description || null,
        isCompleted: false,
        isAcknowledged: true,
        ...(req.body.overrides || {}),
      };

      const task = await storage.createTask(taskData);

      try {
        const event = await createCalendarEvent({
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          courseName: task.courseName,
        });
        if (event?.id) {
          await storage.updateTask(task.id, { calendarEventId: event.id, calendarProvider: 'google' });
        }
      } catch (calErr: any) {
        console.log(`[Review] Calendar sync failed (non-fatal): ${calErr.message}`);
      }

      await storage.updatePendingReviewItem(id, { status: 'accepted' });

      console.log(`[Review] Accepted item #${id} -> task #${task.id}: "${task.title}"`);
      res.json({ success: true, task });
    } catch (error: any) {
      console.error("[Review] Error accepting item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pending-review/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updatePendingReviewItem(id, { status: 'rejected' });
      console.log(`[Review] Rejected item #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Review] Error rejecting item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/pending-review/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePendingReviewItem(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Review] Error deleting item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/outlook/sync", async (_req, res) => {
    try {
      const result = await syncOutlookEventsToReview();
      res.json(result);
    } catch (error: any) {
      console.error("[Outlook] Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/outlook/events-debug", async (_req, res) => {
    try {
      const events = await fetchOutlookCalendarEvents(30);
      res.json({ count: events.length, events: events.map(e => ({ id: e.id, subject: e.subject, start: e.start, end: e.end })) });
    } catch (error: any) {
      console.error("[Outlook] Events debug error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/outlook/migrate-folder", async (req, res) => {
    try {
      const { sourceFolder, destFolder, deleteRulesContaining, keepDomains } = req.body;

      if (deleteRulesContaining) {
        const deleted = await deleteMailRulesByName(deleteRulesContaining);
        console.log(`[Outlook Mail] Deleted ${deleted} rules containing "${deleteRulesContaining}"`);
      }

      if (sourceFolder && destFolder) {
        const srcId = await getMailFolderId(sourceFolder);
        const dstId = await findOrCreateMailFolder(destFolder);
        if (!srcId) return res.status(404).json({ error: `Folder "${sourceFolder}" not found` });

        if (keepDomains && Array.isArray(keepDomains)) {
          const result = await moveEmailsNotFromDomains(srcId, dstId, keepDomains);
          res.json({ success: true, ...result, from: sourceFolder, to: destFolder });
        } else {
          const moved = await moveAllEmailsFromFolder(srcId, dstId);
          res.json({ success: true, moved, from: sourceFolder, to: destFolder });
        }
      } else {
        res.json({ success: true, message: "Rules cleaned up" });
      }
    } catch (error: any) {
      console.error("[Outlook Mail] Migrate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/outlook/file-emails", async (req, res) => {
    try {
      const { folderName, senderDomain, moveExisting } = req.body;
      if (!folderName || !senderDomain) {
        return res.status(400).json({ error: "folderName and senderDomain are required" });
      }

      const folderId = await findOrCreateMailFolder(folderName);

      const ruleName = `Auto-file ${senderDomain} → ${folderName}`;
      const rule = await createMailRule(ruleName, senderDomain, folderId);

      let movedCount = 0;
      if (moveExisting !== false) {
        movedCount = await moveExistingEmailsToFolder(senderDomain, folderId);
      }

      res.json({
        success: true,
        folderId,
        rule: { id: rule.id, displayName: rule.displayName },
        movedExisting: movedCount
      });
    } catch (error: any) {
      console.error("[Outlook Mail] File emails error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks/:id/invite", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const { emails } = req.body;
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: "emails array required" });
      }

      await storage.updateTask(taskId, { inviteEmails: emails } as any);

      const startDate = task.dueDate ? new Date(task.dueDate) : new Date();
      if (task.eventStartTime) {
        const [h, m] = task.eventStartTime.split(':').map(Number);
        startDate.setHours(h, m, 0, 0);
      }

      let endDate: Date | undefined;
      if (task.eventEndTime) {
        endDate = new Date(startDate);
        const [h, m] = task.eventEndTime.split(':').map(Number);
        endDate.setHours(h, m, 0, 0);
      }

      const result = await sendCalendarInvite({
        to: emails,
        title: task.title,
        description: task.description || undefined,
        startDate,
        endDate,
        organizerName: 'Bryn',
        organizerEmail: 'bryn.kai-hendricks@outlook.com',
      });

      if (result.success) {
        console.log(`[Invite] Sent .ics to ${emails.join(', ')} for task #${taskId}`);
        res.json({ success: true, sentTo: emails });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error: any) {
      console.error("[Invite] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

function generateICS(title: string, description: string, dueDate: Date, type: string, reminderMinutes?: number[]): string {
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `task-${Date.now()}@schoolplanner`;
  
  const activeReminders = reminderMinutes?.filter(m => m > 0) || [DEFAULT_REMINDER_1, DEFAULT_REMINDER_2];
  
  const reminders = activeReminders.map(minutes => 
    `VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nTRIGGER:-PT${minutes}M\r\nEND:VALARM`
  ).join('\r\nBEGIN:');

  const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

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
