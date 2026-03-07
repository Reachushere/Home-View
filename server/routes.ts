import type { Express } from "express";
import type { Server } from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getWeekDates, getWeekNumber, FIRST_WEEK, LAST_WEEK, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2, type RepeatType, type RepeatIntervalUnit, type InsertTask, type FileRecord } from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, listEvents, listCalendars, createPrepCalendarEvent, updatePrepCalendarEvent, createEventInCalendar, deleteEventFromCalendar, createRecurringClassEvent } from "./googleCalendar";
import { getSecondAccountAuthUrl, exchangeCodeForTokens, isSecondAccountConnected, disconnectSecondAccount, createEventInSecondAccount, createPrepEventInSecondAccount, deleteEventFromSecondAccount, updateEventInSecondAccount, getEventsFromSecondAccount } from "./secondGoogleAccount";
import { textToSpeech } from "./replit_integrations/audio/client";
import { sendTestEmail, sendTaskReminder, sendDailyDigest, sendTestSms, sendSmsReminder, sendTestHaPush, sendHaTaskReminder, sendEchoVoiceAnnouncement, type TaskReminder } from "./email";
import { getSchedulerStatus } from "./reminderScheduler";
import { listOneDriveItems, getOneDriveFile, searchOneDriveFiles } from "./onedrive";

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
const KITCHEN_ECHO_ENTITY = "media_player.echo_kitchen_studio_black_am";
const PARTNER_PHONE_ENTITY = "device_tracker.y_phone_app";

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
      { id: "cat_tv", name: "TV", entityId: "media_player.tv_cat_wr", type: "tv", canDisplay: true, room: "Cat Washroom" },
      { id: "cat_group", name: "All Cat Washroom", entityId: "media_player.cat_washroom_media_group", type: "group", canDisplay: false, room: "Cat Washroom" },
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
      { id: "everywhere", name: "All Speakers", entityId: "media_player.byhome", type: "group", canDisplay: false, room: "Everywhere" },
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
async function generateAndSaveTTSAudio(text: string, fileId: string): Promise<string> {
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
  
  // Generate audio using OpenAI TTS
  const audioBuffer = await textToSpeech(normalizedText, "nova", "mp3");
  
  // Save to object storage
  const audioFileName = `tts-audio/${fileId}-${Date.now()}.mp3`;
  const { bucketName, objectName } = parsePublicObjectPath(`${publicPath}/${audioFileName}`);
  
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  await file.save(audioBuffer, {
    contentType: 'audio/mpeg',
    metadata: {
      cacheControl: 'public, max-age=3600',
    },
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
    .replace(/\d+:\d+:\d+/g, '') // Remove timestamps like 1:23:45
    .replace(/\d+:\d+/g, ''); // Remove timestamps like 1:23
  
  console.log("After URL/timestamp cleanup:", cleanedText.length);
  
  // Remove JSTOR-specific lines (not entire paragraphs - just specific lines)
  cleanedText = cleanedText
    .replace(/^This content downloaded from.*$/gm, '')
    .replace(/^All use subject to.*$/gm, '')
    .replace(/---PAGE---/g, '. ')  // Replace page markers with sentence breaks
    .replace(/^\d+\s*$/gm, '')  // Remove standalone page numbers
    .replace(/^CJUR?\s*\d+:\d+.*$/gm, '')  // Remove journal reference lines like "CJUR 4:1 (June 1995) 83"
    .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/gm, ''); // Remove IP address lines
  
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
  
  const targetEntity = currentTTSSession.targetEntity || BATHROOM_ECHO_ENTITY;
  console.log("[TTS] Auto-continuing, chunk length:", chunkLength, 
    "new position:", currentTTSSession.currentPosition,
    "remaining:", currentTTSSession.fullText.length - currentTTSSession.currentPosition,
    "to:", targetEntity);
  
  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
  
  try {
    const ssmlChunk = `<speak><prosody rate="90%">${nextChunk}</prosody></speak>`;
    
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

  try {
    const fixResult = await db.execute(sql`UPDATE files SET folder = REPLACE(folder, 'casl101-other', 'casl101-module') WHERE folder LIKE '%casl101-other%'`);
    const count = (fixResult as any)?.rowCount || (fixResult as any)?.changes || 0;
    if (count > 0) {
      console.log(`Fixed ${count} CASL101 file folder(s) from 'other' to 'module'`);
    }
  } catch (e) {
    console.error("Failed to fix CASL101 file folders:", e);
  }

  app.get('/api/version', (_req, res) => {
    res.json({ version: BUILD_VERSION });
  });

  app.post('/api/client-error', (req, res) => {
    const { message, stack, userAgent, url, timestamp } = req.body || {};
    console.error(`[CLIENT ERROR] ${timestamp || new Date().toISOString()} | UA: ${userAgent || 'unknown'} | URL: ${url || 'unknown'} | ${message} | Stack: ${stack || 'none'}`);
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

  // PATCH /api/semester - Update active semester settings (all fields)
  app.patch("/api/semester", async (req, res) => {
    try {
      const activeSemester = await storage.getActiveSemesterSettings();
      if (!activeSemester) {
        return res.status(404).json({ error: "No active semester settings found" });
      }
      const updated = await storage.updateSemesterSettings(activeSemester.id, req.body);
      res.json(updated);
    } catch (err) {
      console.error("Error updating semester settings:", err);
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

      const allTasks = await storage.getAllTasks();
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

        const courseName = `${config.code} - ${config.name}`;
        const [startHour, startMinute] = classTime.split(':').map(Number);
        const [endHour, endMinute] = classEndTime.split(':').map(Number);

        const current = new Date(semesterStart);
        while (current <= semesterEnd) {
          if (classDays.includes(current.getDay())) {
            const taskDate = new Date(current);
            taskDate.setHours(endHour, endMinute, 0, 0);

            const weekNum = getWeekNumber(taskDate, undefined, activeSemester?.readingWeekStart);
            if (weekNum >= FIRST_WEEK && weekNum <= LAST_WEEK) {
              const dateStr = taskDate.toISOString().split('T')[0];
              const isDuplicate = existingClassTasks.some(t => {
                if (!t.dueDate) return false;
                const existingDateStr = new Date(t.dueDate).toISOString().split('T')[0];
                return existingDateStr === dateStr 
                  && t.courseName === courseName 
                  && t.eventStartTime === classTime;
              });

              if (isDuplicate) {
                skippedCount++;
              } else {
                const task = await storage.createTask({
                  title: `${config.code} Class`,
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

      const basePath = `/School/1. TMU/Courses/2026/Winter`;
      const courses = ['CPPA122', 'CFNF400', 'CASL101'];
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
        
        counts[folderKey].total++;
        if (file.listened) {
          counts[folderKey].listened++;
          counts[folderKey].partialProgress += 100;
        } else {
          counts[folderKey].unlistened++;
          if (file.checkedChunks && file.totalChunks && file.totalChunks > 0) {
            try {
              const checked = JSON.parse(file.checkedChunks) as number[];
              counts[folderKey].partialProgress += Math.round((checked.length / file.totalChunks) * 100);
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
          const parser = new PdfParser({ data: new Uint8Array(fileBuffer) });
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
      const parser = new PdfParser({ data: new Uint8Array(buffer) });
      await parser.load();
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

  // ============= END ONEDRIVE ROUTES =============

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
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      for (const task of tasks) {
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
            const event = await createCalendarEvent({
              id: task.id, title: task.title, description: task.description,
              dueDate: task.dueDate, courseName: task.courseName,
            });
            await storage.updateTask(task.id, { calendarEventId: event.id, calendarProvider: "google" });
            results.dueEvents.created++;
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
        
        await delay(100);
        
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
          await delay(100);
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
    const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : new Date(Date.UTC(2026, 0, 10, 12, 0, 0));
    const readingWeek = activeSemester?.readingWeekStart || null;
    const now = new Date();
    const weekNum = getWeekNumber(now, semesterStart, readingWeek);
    const { start, end } = getWeekDates(weekNum, semesterStart, readingWeek);
    // Format as YYYY-MM-DD using UTC
    const formatDateOnly = (d: Date) => {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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
    const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : new Date(Date.UTC(2026, 0, 10, 12, 0, 0));
    const readingWeek = activeSemester?.readingWeekStart || null;
    const taskCounts = await storage.getTaskCountByWeek();
    const weeks = [];
    
    // Format as YYYY-MM-DD using UTC
    const formatDateOnly = (d: Date) => {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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
      const { text, voice = "alloy" } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }
      
      // Validate voice parameter
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
      const selectedVoice = validVoices.includes(voice) ? voice : "alloy";
      
      // Apply full TTS text cleaning first
      let normalizedText = cleanTextForTTS(text);
      
      // Additional normalization for voice quality
      normalizedText = normalizedText
        // Remove DOIs
        .replace(/doi:[^\s]+/gi, '')
        // Remove citation brackets like [1], [2,3], (Smith, 2020)
        .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
        .replace(/\([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)*,?\s*\d{4}[a-z]?\)/g, '')
        // Remove page numbers like pp. 123-456 or p. 123
        .replace(/pp?\.\s*\d+(?:\s*[-–]\s*\d+)?/gi, '')
        // Remove excessive parentheses content (often citations)
        .replace(/\([^)]{50,}\)/g, '')
        // Normalize dashes and special characters
        .replace(/[–—]/g, ', ')
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        // Remove multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
      
      // Limit text length to avoid excessive API costs
      const trimmedText = normalizedText.slice(0, 4096);
      
      console.log(`TTS request: ${trimmedText.length} chars, voice: ${selectedVoice}`);
      
      const audioBuffer = await textToSpeech(
        trimmedText,
        selectedVoice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        "mp3"
      );
      
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
      const { text, voice = "nova", entityId } = req.body;
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
      const selectedVoice = validVoices.includes(voice as any) ? voice : "nova";

      const cleanedText = cleanTextForTTS(text);
      console.log(`[TTS Speaker] Generating OpenAI audio (${cleanedText.length} chars, voice: ${selectedVoice})`);

      const audioPath = await generateAndSaveTTSAudio(cleanedText, `speaker-tts-${Date.now()}`);
      const appUrl = "https://home-view--bkh416.replit.app";
      const fullAudioUrl = `${appUrl}${audioPath}`;
      console.log(`[TTS Speaker] Audio generated: ${audioPath}`);
      console.log(`[TTS Speaker] Playing via media_player/play_media on ${entityId} (NOT alexa_media)`);

      const playResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: entityId,
          media_content_id: fullAudioUrl,
          media_content_type: "music",
        }),
      });

      if (!playResp.ok) {
        const errText = await playResp.text();
        console.error(`[TTS Speaker] play_media FAILED: ${playResp.status} ${errText}`);
        return res.status(500).json({ error: "Failed to play audio on speaker" });
      }

      const wordCount = cleanedText.split(/\s+/).length;
      const estimatedDurationMs = Math.max(5000, (wordCount / 145) * 60 * 1000 + 2000);
      console.log(`[TTS Speaker] SUCCESS - audio playing on ${entityId} (~${Math.round(estimatedDurationMs/1000)}s estimated)`);

      res.json({ success: true, entityId, method: "openai_audio_play_media", estimatedDurationMs });
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
        semesterStartDate: new Date("2026-01-12T00:00:00.000Z"),
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
      const today = new Date();
      
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

  let pendingTabletCommand: { action: string; url?: string; timestamp: number } | null = null;

  const DEPLOYED_APP_URL = "https://home-view--bkh416.replit.app";

  async function setTabletCommand(cmd: { action: string; url?: string; timestamp: number }, propagate = true) {
    pendingTabletCommand = cmd;
    if (propagate) {
      try {
        await fetch(`${DEPLOYED_APP_URL}/api/tablet-nav/set?auth=${encodeURIComponent(process.env.SITE_PASSWORD || '')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd),
        });
      } catch (e: any) {
        console.log(`[Tablet Nav] Failed to propagate to deployed: ${e.message}`);
      }
    }
  }

  app.get("/api/tablet-nav", (_req, res) => {
    if (pendingTabletCommand && Date.now() - pendingTabletCommand.timestamp < 30000) {
      return res.json(pendingTabletCommand);
    }
    res.json({ action: null });
  });

  app.get("/api/cat-wash/find-next", async (req, res) => {
    const authParam = (req.query.auth as string) || '';
    if (authParam !== (process.env.SITE_PASSWORD || '')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(new Date(), new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
      }
      const nextFile = await findNextCatWashFile(storage, currentWeekNumber);
      if (!nextFile) {
        return res.json({ found: false, weekNumber: currentWeekNumber });
      }
      res.json({ found: true, fileId: nextFile.id, fileName: nextFile.displayName || nextFile.originalName, folder: nextFile.folder, weekNumber: currentWeekNumber });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tablet-nav/set", (req, res) => {
    const authParam = (req.query.auth as string) || '';
    if (authParam !== (process.env.SITE_PASSWORD || '')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { action, url, timestamp } = req.body;
    if (action) {
      pendingTabletCommand = { action, url, timestamp: timestamp || Date.now() };
      console.log(`[Tablet Nav] Command set: ${action} ${url || ''}`);
    }
    res.json({ ok: true });
  });

  // Track active cat-wash playback session with unique session ID to prevent concurrent loops
  let catWashPlaybackActive = false;
  let catWashSessionId = 0;
  let catWashPlaybackStartedAt: Date | null = null;
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
  } | null = null;
  
  // GET /api/shower/next-reading - Get next unlistened module/reading file for current week
  app.get("/api/shower/next-reading", async (req, res) => {
    try {
      const allFiles = await storage.getFiles();
      
      // Get current week number from semester settings
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(new Date(), new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
      }
      
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
      
      // Separate by course and type for priority ordering
      // Priority: 1. CPPA modules, 2. CFNF modules, 3. CPPA readings, 4. CFNF readings
      const isModule = (f: any) => 
        f.folder?.toLowerCase().includes('module') || 
        f.originalName?.toLowerCase().includes('module');
      const isReading = (f: any) => 
        f.folder?.toLowerCase().includes('reading') || 
        f.originalName?.toLowerCase().includes('reading');
      const isCPPA = (f: any) => 
        f.folder?.toLowerCase().includes('cppa') || 
        f.originalName?.toLowerCase().includes('cppa');
      const isCFNF = (f: any) => 
        f.folder?.toLowerCase().includes('cfnf') || 
        f.originalName?.toLowerCase().includes('cfnf');
      
      const cppaModules = unlistenedFiles.filter(f => isCPPA(f) && isModule(f));
      const cfnfModules = unlistenedFiles.filter(f => isCFNF(f) && isModule(f));
      const cppaReadings = unlistenedFiles.filter(f => isCPPA(f) && isReading(f));
      const cfnfReadings = unlistenedFiles.filter(f => isCFNF(f) && isReading(f));
      
      // Priority order: CPPA modules > CFNF modules > CPPA readings > CFNF readings
      const orderedFiles = [...cppaModules, ...cfnfModules, ...cppaReadings, ...cfnfReadings];
      
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

    const partialFiles = allFiles.filter((f: any) => {
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
    });

    const unlistenedFiles = allFiles.filter((f: any) => {
      if (f.listened || f.id === excludeFileId) return false;
      if (partialFiles.some((p: any) => p.id === f.id)) return false;
      const weekMatch = f.folder?.match(/week-(\d+)/i);
      return weekMatch && parseInt(weekMatch[1], 10) === weekNumber;
    });

    const courses = [...new Set(unlistenedFiles.map(getCourseCode))].filter(Boolean);
    let orderedUnlistened: any[] = [];
    for (const course of courses) {
      const courseFiles = unlistenedFiles.filter((f: any) => getCourseCode(f) === course);
      const modules = courseFiles.filter(isModuleFile);
      const readings = courseFiles.filter((f: any) => !isModuleFile(f));
      orderedUnlistened.push(...modules, ...readings);
    }

    const orderedFiles = [...partialFiles, ...orderedUnlistened];
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
        const parser = new PdfParser({ data: new Uint8Array(content) });
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

    // Parse URL to build intent URI — encode & as %26 so Android intent parser doesn't split them
    const urlObj = new URL(url);
    const intentPath = urlObj.pathname + '?' + urlObj.searchParams.toString().replace(/&/g, '%26');
    const intentUri = `intent://${urlObj.host}${intentPath}#Intent;scheme=https;package=com.amazon.cloud9;end`;

    const jsCode = `
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
          body: JSON.stringify({ browser_id: browserId, code: jsCode }),
        });
        const body = await resp.text();
        console.log(`[Device] ${deviceName} → browser_mod.javascript/silk_intent (${browserId}): ${resp.status} body=${body.substring(0, 200)}`);
        if (resp.ok) {
          results.push(`${browserId}:silk_intent:${resp.status}`);
          console.log(`[Device] ${deviceName} results: [${results.join(', ')}] success=true`);
          return true;
        }
        results.push(`${browserId}:silk_intent:${resp.status}`);
      } catch (e: any) {
        console.log(`[Device] ${deviceName} → browser_mod.javascript (${browserId}) ERROR: ${e.message}`);
        results.push(`${browserId}:silk_intent:error`);
      }
    }

    console.log(`[Device] ${deviceName} results: [${results.join(', ')}] success=false`);
    return false;
  }

  // Helper to open URL on Fire Stick via androidtv integration
  async function openUrlOnFireStick(haUrl: string, entityId: string, url: string): Promise<boolean> {
    // Step 0: Wake up Fire Stick first (triggers HDMI-CEC to turn on TV)
    try {
      await fetch(`${haUrl}/api/services/androidtv/adb_command`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, command: 'input keyevent KEYCODE_WAKEUP' }),
      });
      console.log(`[Cat Wash] Fire Stick ${entityId} WAKEUP sent`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (e: any) {
      console.log(`[Cat Wash] Fire Stick WAKEUP failed: ${e.message}`);
    }
    // Method 1: Use androidtv.adb_command to launch Silk with URL
    try {
      const adbCmd = `am start -a android.intent.action.VIEW -d "${url}" com.amazon.cloud9`;
      const resp = await fetch(`${haUrl}/api/services/androidtv/adb_command`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, command: adbCmd }),
      });
      console.log(`[Cat Wash] Fire Stick ${entityId} adb_command: ${resp.status}`);
      if (resp.ok) return true;
    } catch (e: any) {
      console.log(`[Cat Wash] Fire Stick adb_command failed: ${e.message}`);
    }
    // Method 2: media_player.play_media with url type
    try {
      const resp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, media_content_id: url, media_content_type: 'url' }),
      });
      console.log(`[Cat Wash] Fire Stick ${entityId} play_media url: ${resp.status}`);
      if (resp.ok) return true;
    } catch (e: any) {
      console.log(`[Cat Wash] Fire Stick play_media failed: ${e.message}`);
    }
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
      endpoints: ["/api/webhook/cat-wash", "/api/webhook/cat-wash-dry", "/api/webhook/cat-lights", "/api/webhook/cat-wash-stop"],
    });
  });

  app.post("/api/webhook/test-tablet-open", async (req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL?.replace(/\/$/, '');
      if (!haUrl || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      const appUrl = "https://home-view--bkh416.replit.app";
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
          browserIds: ['6507d68f-6563ca6c'],
          notifyServices: ['mobile_app_tablet_cat', 'mobile_app_fire_tablet_cat', 'mobile_app_tablet_cat_wall'],
          mediaPlayer: 'media_player.tablet_cat',
        },
        {
          name: 'tablet_catn',
          browserIds: ['02392750-18703322'],
          notifyServices: ['mobile_app_tablet_catn', 'mobile_app_tablet_cat2', 'mobile_app_tablet_catn_2'],
          mediaPlayer: 'media_player.tablet_catn',
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

  app.post("/api/webhook/cat-wash", async (req, res) => {
    try {
      console.log("[Cat Wash] ====== WEBHOOK TRIGGERED ======");
      console.log("[Cat Wash] Timestamp:", new Date().toISOString());
      console.log("[Cat Wash] Request body:", JSON.stringify(req.body));
      console.log("[Cat Wash] Architecture: tablet-browser TTS → Bluetooth → Echo (NO alexa_media/AMP calls)");

      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      if (catWashPlaybackActive && catWashPlaybackState) {
        // Check for stale state: if playback started more than 5 minutes ago and chunk hasn't
        // advanced, the tablet likely never loaded the PDF reader (devices failed to open).
        // In that case, treat it as not playing and allow the new trigger.
        const msSinceStart = catWashPlaybackStartedAt ? Date.now() - catWashPlaybackStartedAt.getTime() : 0;
        const chunkStillAtStart = catWashPlaybackState.chunkIndex === 0;
        const likelyStale = msSinceStart > 5 * 60 * 1000 && chunkStillAtStart;

        if (likelyStale) {
          console.log(`[Cat Wash] Clearing stale playback state (started ${Math.round(msSinceStart / 1000)}s ago, still at chunk 0)`);
          catWashPlaybackActive = false;
          catWashPlaybackStartedAt = null;
          catWashPlaybackState = null;
        } else {
          console.log(`[Cat Wash] Already playing: "${catWashPlaybackState.fileName}" chunk ${catWashPlaybackState.chunkIndex}/${catWashPlaybackState.totalChunks} - skipping`);
          return res.json({ action: "skipped", reason: "Playback already active", currentFile: catWashPlaybackState.fileName });
        }
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = "https://home-view--bkh416.replit.app";
      const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');

      // Query the DEPLOYED server for the next file, since tablets run the deployed app
      // which has a separate database. Fall back to local DB if deployed server is unreachable.
      let nextFile: any = null;
      let chunks: string[] = [];
      let currentWeekNumber = 1;

      try {
        const deployedResp = await fetch(`${DEPLOYED_APP_URL}/api/cat-wash/find-next?auth=${authParam}`);
        if (deployedResp.ok) {
          const deployedData = await deployedResp.json();
          currentWeekNumber = deployedData.weekNumber || 1;
          if (deployedData.found && deployedData.fileId) {
            console.log(`[Cat Wash] Deployed server found file: ${deployedData.fileName} (id=${deployedData.fileId})`);
            // Get the full file from deployed server to extract text
            const fileResp = await fetch(`${DEPLOYED_APP_URL}/api/files/${deployedData.fileId}?auth=${authParam}`);
            if (fileResp.ok) {
              nextFile = await fileResp.json();
              const extractResult = await extractAndChunkPdf(nextFile);
              if (extractResult && extractResult.chunks.length > 0) {
                chunks = extractResult.chunks;
              } else {
                console.log(`[Cat Wash] Deployed file has no readable text, falling back to local`);
                nextFile = null;
              }
            }
          } else {
            console.log(`[Cat Wash] Deployed server: no files for week ${currentWeekNumber}`);
            return res.json({ action: "no_files", message: `All week ${currentWeekNumber} readings complete` });
          }
        }
      } catch (e: any) {
        console.log(`[Cat Wash] Failed to query deployed server: ${e.message}, using local DB`);
      }

      // Fallback to local database if deployed server didn't work
      if (!nextFile) {
        const semesterSettings = await storage.getActiveSemesterSettings();
        if (semesterSettings?.semesterStartDate) {
          currentWeekNumber = getWeekNumber(new Date(), new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
        }
        const localNextFile = await findNextCatWashFile(storage, currentWeekNumber);
        if (!localNextFile) {
          console.log("[Cat Wash] No files to play (local fallback) for week " + currentWeekNumber);
          return res.json({ action: "no_files", message: `All week ${currentWeekNumber} readings complete` });
        }
        const extractResult = await extractAndChunkPdf(localNextFile);
        if (extractResult && extractResult.chunks.length > 0) {
          nextFile = localNextFile;
          chunks = extractResult.chunks;
        } else {
          console.log("[Cat Wash] No files with readable text content (local fallback)");
          return res.status(400).json({ error: "No PDFs with readable text content" });
        }
      }

      const isModuleFile = (f: any) => f.folder?.toLowerCase().includes('module');

      const fileName = nextFile.displayName || nextFile.originalName || 'Unknown file';
      const fileType = isModuleFile(nextFile) ? 'module' : 'reading';
      console.log(`[Cat Wash] Selected: ${fileName} (${fileType}, id=${nextFile.id}, folder=${nextFile.folder})`);

      const readerUrl = `${appUrl}/pdf-reader/${nextFile.id}?catWashFollow=true&autoplay=true&auth=${authParam}`;

      // Always start from the beginning on a fresh trigger.
      // Old lastChunkIndex/checkedChunks data from previous failed attempts
      // was causing playback to jump to the middle of the document.
      // Reset all stale progress data for this file.
      let resumeFromChunk = 0;
      const progressKey = `file-${nextFile.id}`;
      delete playbackProgress[progressKey];
      await storage.updateFile(nextFile.id, { lastChunkIndex: 0, checkedChunks: '[]' });

      console.log(`[Cat Wash] ${chunks.length} chunks, starting from beginning`);

      // === STEP 2: Open PDF reader on all display devices ===
      // Set pending tablet command so tablets already on our app (in Silk) auto-navigate
      await setTabletCommand({ action: 'navigate', url: readerUrl, timestamp: Date.now() });

      const deviceResults: Record<string, string> = {};

      // Fire Tablets (browser_mod.javascript opens Silk if HA app is in foreground)
      const fireTablets = [
        { name: 'tablet_cat_wall', browserIds: ['6507d68f-6563ca6c'], mediaPlayer: 'media_player.tablet_cat' },
        { name: 'tablet_catn', browserIds: ['02392750-18703322'], mediaPlayer: 'media_player.tablet_catn' },
      ];

      await Promise.all(fireTablets.map(async (device) => {
        const opened = await openUrlOnFireDevice(haUrl, device.browserIds, readerUrl, device.name);
        deviceResults[device.name] = opened ? 'browser_mod' : 'no_method_succeeded';
      }));

      // Samsung TV via Fire Stick - turn on TV, then open Silk browser to PDF reader
      try {
        // Step 1: Turn on the TV
        const turnOnResp = await fetch(`${haUrl}/api/services/media_player/turn_on`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: 'media_player.tv_cat_wr' }),
        });
        console.log(`[Cat Wash] Samsung TV turn_on: ${turnOnResp.status}`);

        // Brief delay for TV to wake up
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 2: Open URL via Fire Stick ADB command (most reliable for Fire Sticks)
        const fireStickSuccess = await openUrlOnFireStick(haUrl, 'media_player.fire_stick_cat_wr', readerUrl);
        deviceResults['samsung_tv'] = fireStickSuccess ? 'adb:media_player.fire_stick_cat_wr' : 'failed';
      } catch (e: any) {
        console.log(`[Cat Wash] Samsung TV/Fire Stick error: ${e.message}`);
        deviceResults['samsung_tv'] = 'error';
      }

      console.log(`[Cat Wash] Device results: ${JSON.stringify(deviceResults)}`);

      // === STEP 3: Track playback state (tablet handles audio via Bluetooth → Echo) ===
      // The tablet's PDF reader plays OpenAI TTS audio through its browser <audio> element.
      // Audio goes from tablet → Bluetooth → Echo speaker. No server-side AMP calls needed.
      // The server just tracks state so the progress/stop endpoints work.
      catWashSessionId++;
      const currentSession = catWashSessionId;
      if (catWashPlaybackActive) {
        console.log("[Cat Wash] Stopping previous playback session");
      }
      catWashPlaybackActive = true;
      catWashPlaybackStartedAt = new Date();
      catWashPlaybackState = {
        fileId: nextFile.id,
        fileName,
        chunkIndex: resumeFromChunk,
        totalChunks: chunks.length,
        chunks,
        currentWords: [],
        wordIndex: 0,
        startedAt: new Date(),
        chunkStartedAt: new Date(),
        estimatedChunkDuration: 0,
      };

      console.log(`[Cat Wash] Session ${currentSession}: tablet will handle TTS playback via Bluetooth → Echo`);
      console.log(`[Cat Wash] Reader URL: ${readerUrl}`);

      res.json({
        action: "playing",
        file: { id: nextFile.id, name: fileName, type: fileType, folder: nextFile.folder },
        readerUrl,
        currentWeek: currentWeekNumber,
        totalChunks: chunks.length,
        devices: deviceResults,
        playbackMode: "tablet-bluetooth",
      });

    } catch (error: any) {
      console.error("[Cat Wash] Error:", error);
      res.status(500).json({ error: "Failed to trigger cat wash reading", details: error.message });
    }
  });

  // POST /api/webhook/cat-lights - Triggered when light.cat_lights turns on/off
  // If the current week's CPPA module hasn't been fully listened to,
  // turning the light ON starts/resumes playback on Cat Wash speaker group, turning it OFF stops and saves progress.
  app.post("/api/webhook/cat-lights", async (req, res) => {
    try {
      const { state } = req.body;
      const rawNewState = req.body.new_state;
      const lightState = state || (typeof rawNewState === 'string' ? rawNewState : rawNewState?.state) || 'unknown';
      console.log(`[Cat Lights] ====== WEBHOOK TRIGGERED ======`);
      console.log(`[Cat Lights] Timestamp: ${new Date().toISOString()}`);
      console.log(`[Cat Lights] Light state: ${lightState}`);
      console.log(`[Cat Lights] Request body: ${JSON.stringify(req.body)}`);
      console.log(`[Cat Lights] Architecture: tablet-browser TTS → Bluetooth → Echo (NO alexa_media/AMP calls)`);

      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = "https://home-view--bkh416.replit.app";
      const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');

      // === LIGHT TURNED OFF → Playback continues (door sensor handles stop) ===
      if (lightState === 'off') {
        console.log("[Cat Lights] Light off - playback continues (stop is handled by door sensor)");
        return res.json({ action: "ignored", reason: "Light off does not stop playback; door sensor does" });
      }

      // === LIGHT TURNED ON → Check if CPPA module needs playing ===
      if (lightState !== 'on') {
        return res.json({ action: "ignored", reason: `Unknown state: ${lightState}` });
      }

      if (catWashPlaybackActive && catWashPlaybackState) {
        const msSinceStart = catWashPlaybackStartedAt ? Date.now() - catWashPlaybackStartedAt.getTime() : 0;
        const chunkStillAtStart = catWashPlaybackState.chunkIndex === 0;
        const likelyStale = msSinceStart > 5 * 60 * 1000 && chunkStillAtStart;

        if (likelyStale) {
          console.log(`[Cat Lights] Clearing stale playback state (started ${Math.round(msSinceStart / 1000)}s ago, still at chunk 0)`);
          catWashPlaybackActive = false;
          catWashPlaybackStartedAt = null;
          catWashPlaybackState = null;
        } else {
          console.log(`[Cat Lights] Already playing: "${catWashPlaybackState.fileName}" - skipping`);
          return res.json({ action: "skipped", reason: "Playback already active", currentFile: catWashPlaybackState.fileName });
        }
      }

      const today = new Date();

      // Get current week number
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(today, new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
      }

      // Find CPPA module for current week that hasn't been fully listened to
      const allFiles = await storage.getFiles();
      const cppaModule = allFiles.find((f: any) => {
        if (f.listened) return false;
        const weekMatch = f.folder?.match(/week-(\d+)/i);
        if (!weekMatch || parseInt(weekMatch[1], 10) !== currentWeekNumber) return false;
        const isCppa = f.folder?.toLowerCase().includes('cppa');
        const isModule = f.folder?.toLowerCase().includes('module');
        return isCppa && isModule;
      });

      if (!cppaModule) {
        console.log(`[Cat Lights] No unlistened CPPA module for week ${currentWeekNumber}`);
        return res.json({ action: "skipped", reason: `No unlistened CPPA module for week ${currentWeekNumber}` });
      }

      const fileName = cppaModule.displayName || cppaModule.originalName || 'Unknown file';
      console.log(`[Cat Lights] Found CPPA module: ${fileName} (id=${cppaModule.id})`);

      // Build reader URL with autoplay - tablet browser plays TTS audio via Bluetooth → Echo
      const readerUrl = `${appUrl}/pdf-reader/${cppaModule.id}?catWashFollow=true&autoplay=true&auth=${authParam}`;

      // Extract chunks to store in state
      const extractResult = await extractAndChunkPdf(cppaModule);
      if (!extractResult || extractResult.chunks.length === 0) {
        return res.status(400).json({ error: "PDF has no readable text content" });
      }
      const { chunks } = extractResult;

      // Resume from saved progress if available
      let resumeFromChunk = cppaModule.lastChunkIndex || 0;
      if (resumeFromChunk >= chunks.length) resumeFromChunk = 0;

      console.log(`[Cat Lights] Starting playback from chunk ${resumeFromChunk}/${chunks.length}`);

      // Update session state
      catWashSessionId++;
      if (catWashPlaybackActive) {
        console.log("[Cat Lights] Stopping previous playback session");
      }
      catWashPlaybackActive = true;
      catWashPlaybackStartedAt = new Date();
      catWashPlaybackState = {
        fileId: cppaModule.id,
        fileName,
        chunkIndex: resumeFromChunk,
        totalChunks: chunks.length,
        chunks,
        currentWords: [],
        wordIndex: 0,
        startedAt: new Date(),
        chunkStartedAt: new Date(),
        estimatedChunkDuration: 0,
      };

      // Open PDF reader on tablets — set pending nav for Silk-based polling + try browser_mod for HA-based tablets
      await setTabletCommand({ action: 'navigate', url: readerUrl, timestamp: Date.now() });

      const deviceResults: Record<string, string> = {};
      const fireTablets = [
        { name: 'tablet_cat_wall', browserIds: ['6507d68f-6563ca6c'] },
        { name: 'tablet_catn', browserIds: ['02392750-18703322'] },
      ];

      await Promise.all(fireTablets.map(async (device) => {
        const opened = await openUrlOnFireDevice(haUrl, device.browserIds, readerUrl, device.name);
        deviceResults[device.name] = opened ? 'silk_intent' : 'pending_nav';
      }));

      // Also try Samsung TV via Fire Stick
      try {
        const turnOnResp = await fetch(`${haUrl}/api/services/media_player/turn_on`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: 'media_player.tv_cat_wr' }),
        });
        console.log(`[Cat Lights] Samsung TV turn_on: ${turnOnResp.status}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        const fireStickSuccess = await openUrlOnFireStick(haUrl, 'media_player.fire_stick_cat_wr', readerUrl);
        deviceResults['samsung_tv'] = fireStickSuccess ? 'adb:media_player.fire_stick_cat_wr' : 'failed';
      } catch (e: any) {
        console.log(`[Cat Lights] Samsung TV error: ${e.message}`);
        deviceResults['samsung_tv'] = 'error';
      }

      console.log(`[Cat Lights] Device results: ${JSON.stringify(deviceResults)}`);

      res.json({
        action: "playing",
        file: { id: cppaModule.id, name: fileName },
        resumeFromChunk,
        totalChunks: chunks.length,
        devices: deviceResults,
        playbackMode: "tablet-bluetooth",
      });

    } catch (error: any) {
      console.error("[Cat Lights] Error:", error);
      res.status(500).json({ error: "Failed to handle cat lights webhook", details: error.message });
    }
  });

  // POST /api/webhook/cat-wash-stop - Triggered when toothbrush returns to charger (running → charging)
  // Stops cat wash playback and saves progress.
  app.post("/api/webhook/cat-wash-stop", async (req, res) => {
    try {
      console.log(`[Cat Wash Stop Webhook] ====== WEBHOOK TRIGGERED ======`);
      console.log(`[Cat Wash Stop Webhook] Timestamp: ${new Date().toISOString()}`);
      console.log(`[Cat Wash Stop Webhook] Request body: ${JSON.stringify(req.body)}`);

      const stopped: string[] = [];

      if (catWashPlaybackActive && catWashPlaybackState) {
        const savedFileId = catWashPlaybackState.fileId;
        const savedChunk = catWashPlaybackState.chunkIndex;
        console.log(`[Cat Wash Stop Webhook] Stopping playback - file ${savedFileId} (${catWashPlaybackState.fileName}), chunk ${savedChunk}/${catWashPlaybackState.totalChunks}`);

        if (savedFileId && savedChunk > 0) {
          try {
            await storage.updateFile(savedFileId, { lastChunkIndex: savedChunk });
            console.log(`[Cat Wash Stop Webhook] Saved progress: chunk ${savedChunk}`);
          } catch (e: any) {
            console.log(`[Cat Wash Stop Webhook] Failed to save progress: ${e.message}`);
          }
        }

        stopped.push(`playback:${catWashPlaybackState.fileName}`);
        catWashPlaybackActive = false;
        catWashPlaybackStartedAt = null;
        catWashPlaybackState = null;
      }

      if (currentTTSSession) {
        console.log(`[Cat Wash Stop Webhook] Stopping active TTS session`);
        stopTTSSession("Toothbrush returned to charger - stopping playback");
        stopped.push("ttsSession");
      }

      await setTabletCommand({ action: 'go_home', timestamp: Date.now() });
      console.log(`[Cat Wash Stop Webhook] Stopped: ${stopped.join(', ') || 'nothing was playing'}`);
      res.json({ action: "stopped", stoppedItems: stopped });

    } catch (error: any) {
      console.error("[Cat Wash Stop Webhook] Error:", error);
      res.status(500).json({ error: "Failed to handle stop webhook", details: error.message });
    }
  });

  // POST /api/webhook/cat-wash-dry - Triggered when water_sensor_cat_shower changes to dry
  // Switches cat wash TTS playback from tablet Bluetooth (Echo Cat Left) to Echo Cat Middle speaker
  app.post("/api/webhook/cat-wash-dry", async (req, res) => {
    try {
      const rawSensorNewState = req.body?.new_state;
      const sensorState = req.body?.state || (typeof rawSensorNewState === 'string' ? rawSensorNewState : rawSensorNewState?.state) || 'unknown';
      console.log(`[Cat Wash Dry] ====== WEBHOOK TRIGGERED ======`);
      console.log(`[Cat Wash Dry] Timestamp: ${new Date().toISOString()}`);
      console.log(`[Cat Wash Dry] Sensor state: ${sensorState}`);
      console.log(`[Cat Wash Dry] Architecture: switching from tablet Bluetooth → Echo Cat Middle speaker`);

      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }

      if (!catWashPlaybackActive || !catWashPlaybackState) {
        console.log("[Cat Wash Dry] No active cat wash playback to switch - ignoring");
        return res.json({ action: "ignored", reason: "No active cat wash playback" });
      }

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = "https://home-view--bkh416.replit.app";
      const authParam = encodeURIComponent(process.env.SITE_PASSWORD || '');
      const newSpeaker = "media_player.echo_cat_washroom_middle";

      const currentFileId = catWashPlaybackState.fileId;
      const currentFileName = catWashPlaybackState.fileName;
      const currentChunk = catWashPlaybackState.chunkIndex;
      const totalChunks = catWashPlaybackState.totalChunks;

      console.log(`[Cat Wash Dry] Current playback: "${currentFileName}" chunk ${currentChunk}/${totalChunks}`);
      console.log(`[Cat Wash Dry] Switching speaker to: ${newSpeaker}`);

      // Build new URL with speaker param and resume chunk
      const newReaderUrl = `${appUrl}/pdf-reader/${currentFileId}?catWashFollow=true&autoplay=true&speaker=${encodeURIComponent(newSpeaker)}&resumeChunk=${currentChunk}&auth=${authParam}`;

      // Re-open on tablets with the new speaker parameter
      await setTabletCommand({ action: 'navigate', url: newReaderUrl, timestamp: Date.now() });

      const tabletDevices = [
        { name: 'tablet_cat_wall', browserIds: ['6507d68f-6563ca6c'] },
        { name: 'tablet_catn', browserIds: ['02392750-18703322'] },
      ];

      const deviceResults: Record<string, string> = {};

      await Promise.all(tabletDevices.map(async (device) => {
        const opened = await openUrlOnFireDevice(haUrl, device.browserIds, newReaderUrl, device.name);
        deviceResults[device.name] = opened ? 'silk_intent' : 'pending_nav';
      }));

      // Also re-open on Samsung TV
      try {
        const fireStickSuccess = await openUrlOnFireStick(haUrl, 'media_player.fire_stick_cat_wr', newReaderUrl);
        deviceResults['samsung_tv'] = fireStickSuccess ? 'adb:media_player.fire_stick_cat_wr' : 'failed';
      } catch (e: any) {
        console.log(`[Cat Wash Dry] Samsung TV error: ${e.message}`);
        deviceResults['samsung_tv'] = 'error';
      }

      console.log(`[Cat Wash Dry] Device results: ${JSON.stringify(deviceResults)}`);
      console.log(`[Cat Wash Dry] Switched to ${newSpeaker} - tablet will now send TTS to speaker instead of Bluetooth`);

      res.json({
        action: "switched_speaker",
        file: { id: currentFileId, name: currentFileName },
        resumeFromChunk: currentChunk,
        totalChunks,
        newSpeaker,
        devices: deviceResults,
      });

    } catch (error: any) {
      console.error("[Cat Wash Dry] Error:", error);
      res.status(500).json({ error: "Failed to handle cat wash dry webhook", details: error.message });
    }
  });

  // GET /api/cat-wash/progress - Returns current playback state for the active session
  app.get("/api/cat-wash/progress", (_req, res) => {
    if (!catWashPlaybackActive || !catWashPlaybackState) {
      return res.json({ active: false });
    }

    const state = catWashPlaybackState;
    res.json({
      active: true,
      fileId: state.fileId,
      fileName: state.fileName,
      chunkIndex: state.chunkIndex,
      totalChunks: state.totalChunks,
      chunkText: state.chunks[state.chunkIndex] || '',
      words: state.currentWords,
    });
  });

  // POST /api/cat-wash/update-progress - Tablet reports its playback progress
  app.post("/api/cat-wash/update-progress", async (req, res) => {
    const { fileId, chunkIndex, totalChunks, words, wordIndex, completed } = req.body;

    if (catWashPlaybackState && catWashPlaybackState.fileId === fileId) {
      catWashPlaybackState.chunkIndex = chunkIndex ?? catWashPlaybackState.chunkIndex;
      catWashPlaybackState.currentWords = words ?? catWashPlaybackState.currentWords;
      catWashPlaybackState.wordIndex = wordIndex ?? catWashPlaybackState.wordIndex;
      catWashPlaybackState.chunkStartedAt = new Date();
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
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(new Date(), new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
      }

      const nextFile = await findNextCatWashFile(storage, currentWeekNumber, fileId);
      if (nextFile) {
        const appUrl = "https://home-view--bkh416.replit.app";
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
  app.post("/api/cat-wash/stop", async (_req, res) => {
    console.log("[Cat Wash Stop] === STOP ALL PLAYBACK ===");

    const stopped: string[] = [];

    if (catWashPlaybackActive) {
      console.log(`[Cat Wash Stop] Stopping cat wash playback (file: ${catWashPlaybackState?.fileName})`);
      stopped.push("catWashPlayback");
    }
    catWashPlaybackActive = false;
    catWashPlaybackStartedAt = null;
    catWashPlaybackState = null;

    if (currentTTSSession) {
      console.log(`[Cat Wash Stop] Stopping active TTS session (entity: ${currentTTSSession.targetEntity})`);
      stopTTSSession("Force stopped via cat-wash/stop");
      stopped.push("ttsSession");
    }

    // NO Alexa Media Player (AMP) calls to Echo devices — audio plays via tablet Bluetooth.
    // Stopping the tablets (by clearing server state) is sufficient.
    // Sending media_stop to Echo entities causes Alexa to speak confirmations.

    await setTabletCommand({ action: 'go_home', timestamp: Date.now() });
    console.log(`[Cat Wash Stop] Stopped: ${stopped.join(', ')}`);
    res.json({ stopped: true, stoppedItems: stopped });
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

      const appUrl = `https://${req.get('host') || 'home-view--bkh416.replit.app'}`;
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

  // POST /api/shower/trigger - Trigger automatic reading from Home Assistant
  // This is the endpoint Home Assistant should call when motion is detected
  app.post("/api/shower/trigger", async (req, res) => {
    try {
      const targetEntity = req.body?.entityId || BATHROOM_ECHO_ENTITY;
      
      if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
        return res.status(500).json({ error: "Home Assistant not configured" });
      }
      
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      // First, sync OneDrive to get latest files
      console.log("Shower trigger: Syncing OneDrive files...");
      const { listOneDriveItems } = await import("./onedrive");
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      // Get current week number
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(new Date(), new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
      }
      
      // Sync OneDrive files for current week
      const courses = [
        { code: 'CPPA122', path: '/School/1. TMU/Courses/2026/Winter/CPPA122 - Local Politics and Government' },
        { code: 'CFNF400', path: '/School/1. TMU/Courses/2026/Winter/CFNF400 - Human Sexuality' }
      ];
      
      for (const course of courses) {
        try {
          const weekFolders = await listOneDriveItems(course.path);
          const currentWeekFolder = weekFolders.find((f: any) => {
            if (f.type !== 'folder') return false;
            const weekMatch = f.name.match(/Week\s+(\d+)/i);
            return weekMatch && parseInt(weekMatch[1], 10) === currentWeekNumber;
          });
          
          if (!currentWeekFolder) continue;
          
          const weekContents = await listOneDriveItems(currentWeekFolder.path);
          
          // Check Module folder
          const moduleFolder = weekContents.find((f: any) => 
            f.type === 'folder' && f.name.toLowerCase() === 'module'
          );
          
          if (moduleFolder) {
            const moduleFiles = await listOneDriveItems(moduleFolder.path);
            for (const file of moduleFiles) {
              if (file.type !== 'file' || !file.name.endsWith('.pdf')) continue;
              
              const existingFiles = await storage.getFiles();
              const folderName = `week-${currentWeekNumber}-${course.code.toLowerCase()}-module`;
              if (existingFiles.some((f: any) => f.originalName === file.name && f.folder === folderName)) continue;
              
              const downloadResponse = await fetch(file.downloadUrl);
              if (!downloadResponse.ok) continue;
              
              const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
              const uploadUrl = await objectStorage.getObjectEntityUploadURL();
              const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: fileBuffer,
                headers: { 'Content-Type': 'application/pdf' }
              });
              if (!uploadResponse.ok) continue;
              
              const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
              await storage.createFile({
                originalName: file.name,
                displayName: file.name,
                objectPath: objectPath,
                contentType: 'application/pdf',
                size: file.size,
                folder: folderName,
                listened: false
              });
            }
          }
          
          // Check Reading folder
          const readingFolder = weekContents.find((f: any) => 
            f.type === 'folder' && f.name.toLowerCase() === 'reading'
          );
          
          if (readingFolder) {
            const readingFiles = await listOneDriveItems(readingFolder.path);
            for (const file of readingFiles) {
              if (file.type !== 'file' || !file.name.endsWith('.pdf')) continue;
              
              const existingFiles = await storage.getFiles();
              const folderName = `week-${currentWeekNumber}-${course.code.toLowerCase()}-reading`;
              if (existingFiles.some((f: any) => f.originalName === file.name && f.folder === folderName)) continue;
              
              const downloadResponse = await fetch(file.downloadUrl);
              if (!downloadResponse.ok) continue;
              
              const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
              const uploadUrl = await objectStorage.getObjectEntityUploadURL();
              const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: fileBuffer,
                headers: { 'Content-Type': 'application/pdf' }
              });
              if (!uploadResponse.ok) continue;
              
              const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
              await storage.createFile({
                originalName: file.name,
                displayName: file.name,
                objectPath: objectPath,
                contentType: 'application/pdf',
                size: file.size,
                folder: folderName,
                listened: false
              });
            }
          }
        } catch (e) {
          console.error(`Shower trigger: Error syncing ${course.code}:`, e);
        }
      }
      
      // Get all files and filter for current week unlistened
      const allFiles = await storage.getFiles();
      const unlistenedFiles = allFiles.filter((f: any) => {
        if (f.listened) return false;
        const weekMatch = f.folder?.match(/week-(\d+)/i);
        return weekMatch && parseInt(weekMatch[1], 10) === currentWeekNumber;
      });
      
      // Priority order: CPPA modules > CFNF modules > CPPA readings > CFNF readings
      const isModule = (f: any) => f.folder?.toLowerCase().includes('module');
      const isCPPA = (f: any) => f.folder?.toLowerCase().includes('cppa');
      const isCFNF = (f: any) => f.folder?.toLowerCase().includes('cfnf');
      
      const cppaModules = unlistenedFiles.filter((f: any) => isCPPA(f) && isModule(f));
      const cfnfModules = unlistenedFiles.filter((f: any) => isCFNF(f) && isModule(f));
      const cppaReadings = unlistenedFiles.filter((f: any) => isCPPA(f) && !isModule(f));
      const cfnfReadings = unlistenedFiles.filter((f: any) => isCFNF(f) && !isModule(f));
      
      const orderedFiles = [...cppaModules, ...cfnfModules, ...cppaReadings, ...cfnfReadings];
      
      // If no files left, play CHUM FM radio
      if (orderedFiles.length === 0) {
        console.log("Shower trigger: All files complete, playing CHUM FM radio");
        
        await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_id: targetEntity,
            media_content_type: "custom",
            media_content_id: "play 104.5 chumfm"
          }),
        });
        
        return res.json({
          action: "radio",
          message: `All week ${currentWeekNumber} readings complete! Playing CHUM FM 104.5`,
          currentWeek: currentWeekNumber
        });
      }
      
      // Get next file to play
      const nextFile = orderedFiles[0];
      console.log(`Shower trigger: Playing ${nextFile.displayName || nextFile.originalName}`);
      
      // Check for resume progress
      const progressKey = `file-${nextFile.id}`;
      const progress = playbackProgress[progressKey];
      const resumeFromChunk = progress?.chunkIndex || 0;
      
      // Extract text from PDF
      let textContent = "";
      try {
        const objectFile = await objectStorage.getObjectEntityFile(nextFile.objectPath);
        const [content] = await objectFile.download();
        
        const isPDF = content.slice(0, 4).toString() === '%PDF';
        if (isPDF) {
          const PdfParser = await getPdfParser();
          const parser = new PdfParser({ data: new Uint8Array(content) });
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
        console.error("Shower trigger: Error extracting text:", error);
        return res.status(500).json({ error: "Failed to extract text from file" });
      }
      
      if (!textContent.trim()) {
        return res.status(400).json({ error: "File is empty or not readable" });
      }
      
      // Clean and chunk the text for TTS (larger chunks for OpenAI - up to 4096 chars)
      let cleanedContent = textContent.trim().replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, ' ');
      const chunks = cleanedContent.match(/.{1,1500}[.!?]?\s*/g) || [cleanedContent];
      
      // Start from resume point
      const chunk = chunks[resumeFromChunk] || chunks[0];
      
      // Announce which file we're reading
      const fileName = nextFile.displayName || nextFile.originalName;
      const courseMatch = nextFile.folder?.match(/(cppa|cfnf)\d*/i);
      const courseName = courseMatch ? courseMatch[0].toUpperCase() : '';
      const announcement = resumeFromChunk > 0 
        ? `Resuming ${courseName} reading, chunk ${resumeFromChunk + 1} of ${chunks.length}.`
        : `Now reading ${courseName} ${isModule(nextFile) ? 'module' : 'reading'}: ${fileName.replace('.pdf', '')}. ${chunks.length} sections total.`;
      
      // Combine announcement with content for a single audio file
      const fullTextForTTS = `${announcement} ... ${chunk}`;
      
      console.log(`Shower trigger: Generating OpenAI TTS for chunk ${resumeFromChunk + 1}/${chunks.length}`);
      
      // Generate OpenAI TTS audio and save to object storage
      const audioPath = await generateAndSaveTTSAudio(fullTextForTTS, `shower-${nextFile.id}-chunk-${resumeFromChunk}`);
      const audioUrl = `https://home-view--bkh416.replit.app${audioPath}`;
      
      console.log(`Shower trigger: Playing audio on Echo: ${audioUrl}`);
      
      // Play the audio on the Echo via Home Assistant media_player
      const playResponse = await fetch(`${haUrl}/api/services/media_player/play_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: targetEntity,
          media_content_id: audioUrl,
          media_content_type: "audio/mp3"
        }),
      });
      
      if (!playResponse.ok) {
        const errorText = await playResponse.text();
        console.error(`Shower trigger: Failed to play audio: ${playResponse.status} - ${errorText}`);
      } else {
        console.log(`Shower trigger: Audio playback started successfully`);
      }
      
      // Save progress
      playbackProgress[progressKey] = {
        chunkIndex: resumeFromChunk,
        totalChunks: chunks.length,
        lastPlayed: new Date()
      };
      
      res.json({
        action: "reading",
        file: {
          id: nextFile.id,
          name: fileName,
          folder: nextFile.folder
        },
        currentWeek: currentWeekNumber,
        chunkIndex: resumeFromChunk,
        totalChunks: chunks.length,
        resuming: resumeFromChunk > 0,
        remainingFiles: orderedFiles.length,
        audioUrl: audioUrl
      });
      
    } catch (error: any) {
      console.error("Shower trigger error:", error);
      res.status(500).json({ error: "Failed to trigger shower reading", details: error.message });
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
      
      // Validate entity_id against known Echo devices
      const allowedEntities = [
        BATHROOM_ECHO_ENTITY, KITCHEN_ECHO_ENTITY,
        "media_player.cat_wash_2",
        "media_player.echo_cat_left_am", "media_player.echo_cat_right_am",
        "media_player.echo_cat_washroom_middle", "media_player.echo_closet_am",
        "media_player.echo_lr_couch_r_am", "media_player.echo_hallway_entrance_am",
        "media_player.echo_king_l_am", "media_player.echo_king_r_am",
        "media_player.echo_king_tv_am", "media_player.echo_kitchen_cupboards_left_am",
        "media_player.echo_kitchen_cupboards_r_am", "media_player.echo_kitchen_fridge_am",
        "media_player.echo_kitchen_hutch_am", "media_player.echo_kitchen_island_corner_am",
        "media_player.echo_kitchen_studio_black_am", "media_player.echo_lr_hub_am"
      ];
      const requestedEntity = req.body?.entity_id || BATHROOM_ECHO_ENTITY;
      const targetEntity = allowedEntities.includes(requestedEntity) ? requestedEntity : BATHROOM_ECHO_ENTITY;
      
      // Get current week number
      const semesterSettings = await storage.getActiveSemesterSettings();
      let currentWeekNumber = 1;
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(new Date(), new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
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
        console.log("[Webhook] No urgent PDFs found, announcing completion");
        await fetch(`${haUrl}/api/services/notify/alexa_media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `All week ${currentWeekNumber} readings are complete. Great job!`,
            target: targetEntity,
            data: { type: "tts" }
          }),
        });
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
          const parser = new PdfParser({ data: new Uint8Array(content) });
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
      const ssmlContent = `<speak><prosody rate="90%">${fullFirstMessage}</prosody></speak>`;
      
      console.log(`[Webhook] Sending first chunk (${firstChunk.length} chars) to ${targetEntity}`);
      
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ssmlContent,
          target: targetEntity,
          data: { type: "tts" }
        }),
      });
      
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
              payload: '{"entity_id": "media_player.cat_wr"}'
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
          const audioUrl = `https://home-view--bkh416.replit.app${audioPath}`;
          
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
      const targetEntity = entityId || BATHROOM_ECHO_ENTITY;
      
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
          const parser = new PdfParser({ data: new Uint8Array(content) });
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
      await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Section ${nextChunkIndex + 1} of ${chunks.length}. ${chunk}`,
          target: targetEntity,
          data: { type: "tts" }
        }),
      });
      
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
      const today = new Date();
      let currentWeekNumber = 1;
      
      if (semesterSettings?.semesterStartDate) {
        currentWeekNumber = getWeekNumber(today, new Date(semesterSettings.semesterStartDate), semesterSettings.readingWeekStart);
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
      
      // Priority order: CPPA modules -> CFNF modules -> CPPA readings -> CFNF readings
      // Exclude ASL (visual-only course)
      const orderedFiles = weekFiles
        .filter((f: any) => {
          const folder = (f.folder || '').toLowerCase();
          return !folder.includes('casl') && !folder.includes('asl');
        })
        .sort((a: any, b: any) => {
          const aFolder = (a.folder || '').toLowerCase();
          const bFolder = (b.folder || '').toLowerCase();
          
          const aIsCPPA = aFolder.includes('cppa');
          const bIsCPPA = bFolder.includes('cppa');
          const aIsModule = aFolder.includes('module');
          const bIsModule = bFolder.includes('module');
          
          // CPPA modules first
          if (aIsCPPA && aIsModule && !(bIsCPPA && bIsModule)) return -1;
          if (bIsCPPA && bIsModule && !(aIsCPPA && aIsModule)) return 1;
          
          // Then CFNF modules
          if (!aIsCPPA && aIsModule && !(bIsModule)) return -1;
          if (!bIsCPPA && bIsModule && !(aIsModule)) return 1;
          
          // Then CPPA readings
          if (aIsCPPA && !aIsModule && !(bIsCPPA && !bIsModule)) return -1;
          if (bIsCPPA && !bIsModule && !(aIsCPPA && !aIsModule)) return 1;
          
          return 0;
        });
      
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
          const parser = new PdfParser({ data: new Uint8Array(content) });
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
      
      // Send TTS to Echo
      const response = await fetch(`${haUrl}/api/services/notify/alexa_media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: chunk,
          target: BATHROOM_ECHO_ENTITY,
          data: { type: "tts" }
        }),
      });
      
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
      
      const basePath = `/School/1. TMU/Courses/2026/Winter`;
      const courseCodes = ['CPPA122', 'CFNF400', 'CASL101'];
      
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
                  
                  await storage.createFile({
                    originalName: file.name,
                    displayName: file.name,
                    objectPath: objectPath,
                    contentType: 'application/pdf',
                    size: file.size,
                    folder: folderName,
                    listened: false
                  });
                  
                  existingFileKeys.add(fileKey);
                  syncedFiles.push({ name: file.name, folder: folderName, course: courseCode, week: weekNum });
                  console.log(`Synced: ${file.name} -> ${folderName}`);
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
      
      // Use 90% speaking rate
      const ssmlContent = `<speak><prosody rate="90%">${cleanedContent}</prosody></speak>`;
      
      console.log("=== TTS PLAY REQUEST ===");
      console.log("Target entity:", targetEntity);
      console.log("Cleaned message length:", cleanedContent.length);
      console.log("HA URL:", haUrl);
      console.log("Message preview:", cleanedContent.substring(0, 100));
      
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
      const targetEntity = entityId || currentTTSSession?.targetEntity || BATHROOM_ECHO_ENTITY;
      
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
      
      // Also try the Alexa-specific stop command
      try {
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
      } catch (e) {
        // Alexa media command may not be available
        console.log("Alexa media stop command not available");
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
      currentTTSSession.consecutiveErrors = 0;
      
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

  // POST /api/media/restart - Restart TTS from beginning
  app.post("/api/media/restart", async (req, res) => {
    try {
      const { mediaUrl, entityId } = req.body;
      const targetEntity = entityId || BATHROOM_ECHO_ENTITY;
      
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
  app.post("/api/media/skip-chunk", async (req, res) => {
    try {
      const { direction, entityId } = req.body; // "forward" or "backward"
      const targetEntity = entityId || currentTTSSession?.targetEntity || BATHROOM_ECHO_ENTITY;
      
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
        "media_player.cat_wr",
        "media_player.echo_cat_left_am",
        "media_player.echo_cat_right_am",
        "media_player.echo_cat_washroom_middle",
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
        "media_player.cat_wr",
        "media_player.echo_cat_left_am",
        "media_player.echo_cat_right_am",
        "media_player.echo_cat_washroom_middle",
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
        "media_player.byhome",
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
      
      // Set volume on the target device
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
        "media_player.cat_wr",
        "media_player.echo_cat_left_am",
        "media_player.echo_cat_right_am",
        "media_player.echo_cat_washroom_middle",
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
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const activeSemester = await storage.getActiveSemesterSettings();
      const semesterStart = activeSemester ? new Date(activeSemester.semesterStartDate) : undefined;
      const weekNumber = Number(req.query.weekNumber) || getWeekNumber(new Date(), semesterStart, activeSemester?.readingWeekStart);
      const { start, end } = getWeekDates(weekNumber, semesterStart, activeSemester?.readingWeekStart);
      
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
      // For all-day events, Google returns just a date (e.g., "2026-01-28")
      // This gets parsed as midnight UTC, which shifts to previous day in some timezones
      // We append T12:00:00 (noon) to keep the date stable across timezones
      const formattedEvents = externalEvents.map(event => {
        const isAllDay = !event.start?.dateTime;
        let startDate = event.start?.dateTime || event.start?.date;
        let endDate = event.end?.dateTime || event.end?.date;
        
        // Fix all-day event dates by adding noon time to prevent timezone shift
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
          source: 'google',
        };
      });
      
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
        if (existing) {
          await storage.updateSemesterSettings(existing.id, semester);
        } else {
          await storage.createSemesterSettings(semester);
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
