// TTS session + travelling-mode state extracted from server/routes.ts
// (MODULE_SPLIT_PLAN Phase 3). Pure TTS helpers (cleanTextForTTS,
// generateAndSaveTTSAudio, getChunkWithSentenceBoundary) still live in
// server/serverHelpers.ts.
//
// State is exposed via the mutable `tts` object so route handlers in
// routes.ts can keep direct read/write semantics (`tts.session = {...}`,
// `tts.travelling = true`, etc.) without a 70-site refactor.

import {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN,
  DEPLOYED_APP_URL,
  NEST_SPEAKER_ENTITY,
  NON_ALEXA_ENTITIES,
  MAX_CONSECUTIVE_ERRORS,
  MAX_SESSION_AGE_MS,
  CHARS_PER_SECOND,
  CHUNK_SIZE,
  generateAndSaveTTSAudio,
  cleanTextForTTS,
  getChunkWithSentenceBoundary,
  aLog,
} from "../serverHelpers";

export interface TTSSession {
  fullText: string;
  currentPosition: number;
  startTime: number;
  isPlaying: boolean;
  autoTimer: ReturnType<typeof setTimeout> | null;
  targetEntity?: string;
  consecutiveErrors: number;
  sessionCreatedAt: number;
}

export const tts: {
  session: TTSSession | null;
  travelling: boolean;
  travelStart: string | null;
  travelEnd: string | null;
} = {
  session: null,
  travelling: false,
  travelStart: null,
  travelEnd: null,
};

export function getIsTravellingMode(): boolean {
  if (tts.travelling && tts.travelStart && tts.travelEnd) {
    const now = new Date();
    const start = new Date(tts.travelStart);
    const end = new Date(tts.travelEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return now >= start && now <= end;
    }
  }
  return tts.travelling;
}

// Function to fully stop and clean up TTS session
export function stopTTSSession(reason: string) {
  console.log(`[TTS] Stopping session: ${reason}`);
  if (tts.session) {
    if (tts.session.autoTimer) {
      clearTimeout(tts.session.autoTimer);
      tts.session.autoTimer = null;
    }
    tts.session.isPlaying = false;
  }
}

// Function to send next TTS chunk automatically
export async function sendNextChunk() {
  if (!tts.session || !tts.session.isPlaying) {
    console.log("[TTS] sendNextChunk: No active session or not playing");
    return;
  }

  // Safety: check session age to prevent zombie sessions
  const sessionAge = Date.now() - tts.session.sessionCreatedAt;
  if (sessionAge > MAX_SESSION_AGE_MS) {
    stopTTSSession(`Session too old (${Math.round(sessionAge / 60000)} minutes)`);
    return;
  }

  // Safety: check consecutive errors
  if (tts.session.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    stopTTSSession(`Too many consecutive errors (${tts.session.consecutiveErrors})`);
    return;
  }

  console.log("[TTS] sendNextChunk called, currentPosition:", tts.session.currentPosition);

  // Check if we've finished
  if (tts.session.currentPosition >= tts.session.fullText.length) {
    stopTTSSession("Finished entire document");
    return;
  }

  // Get next chunk from cleaned text
  let rawChunk = tts.session.fullText.substring(
    tts.session.currentPosition,
    tts.session.currentPosition + CHUNK_SIZE
  );

  if (rawChunk.trim().length === 0) {
    stopTTSSession("No more content");
    return;
  }

  // Clean the chunk and apply sentence boundary
  let nextChunk = cleanTextForTTS(rawChunk);
  nextChunk = getChunkWithSentenceBoundary(nextChunk, CHUNK_SIZE);

  // Update position BEFORE sending
  const chunkLength = nextChunk.length;
  tts.session.currentPosition += chunkLength;
  tts.session.startTime = Date.now();

  const targetEntity = tts.session.targetEntity || NEST_SPEAKER_ENTITY;
  const isNonAlexa = NON_ALEXA_ENTITIES.includes(targetEntity);
  console.log("[TTS] Auto-continuing, chunk length:", chunkLength,
    "new position:", tts.session.currentPosition,
    "remaining:", tts.session.fullText.length - tts.session.currentPosition,
    "to:", targetEntity, isNonAlexa ? "(non-Alexa, using play_media)" : "(Alexa)");

  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

  try {
    let response: Response;

    if (isNonAlexa) {
      const audioPath = await generateAndSaveTTSAudio(nextChunk, `tts-chunk-${Date.now()}`, "echo");
      const appUrl = DEPLOYED_APP_URL;
      const fullAudioUrl = `${appUrl}${audioPath}`;
      aLog('TTS-Chunk', `Non-Alexa: Generated audio at ${audioPath}, playing on ${targetEntity}`, { fullAudioUrl, appUrl, targetEntity });

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
      tts.session.consecutiveErrors++;
      if (tts.session.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        stopTTSSession(`Giving up after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
        return;
      }
      // Rewind position so the failed chunk gets retried
      tts.session.currentPosition -= chunkLength;
      console.log(`[TTS] Rewound position to ${tts.session.currentPosition} for retry`);
    } else {
      tts.session.consecutiveErrors = 0;
      console.log("[TTS] Chunk sent successfully");
    }

    // Schedule next chunk only if session is still active and healthy
    if (tts.session && tts.session.isPlaying &&
        tts.session.currentPosition < tts.session.fullText.length) {
      if (tts.session.consecutiveErrors > 0) {
        console.log(`[TTS] Retry in 10s due to error (attempt ${tts.session.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
        tts.session.autoTimer = setTimeout(() => {
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
    if (tts.session) {
      tts.session.consecutiveErrors++;
      tts.session.currentPosition -= chunkLength;
      if (tts.session.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        stopTTSSession(`Network error, giving up after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
        return;
      }
      console.log(`[TTS] Network error retry in 10s (attempt ${tts.session.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
      tts.session.autoTimer = setTimeout(() => {
        console.log("[TTS] Network retry timer fired");
        sendNextChunk();
      }, 10000);
    }
  }
}

// Calculate delay based on chunk size and speed
// At 90% speed (slightly slower than normal)
const SPEED_RATE = 0.90;

export function scheduleNextChunk() {
  if (!tts.session || !tts.session.isPlaying) {
    console.log("[TTS] scheduleNextChunk: No active session or not playing, aborting");
    return;
  }

  if (tts.session.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    stopTTSSession("Too many errors, not scheduling more chunks");
    return;
  }

  const baseSeconds = CHUNK_SIZE / CHARS_PER_SECOND;
  const adjustedSeconds = baseSeconds / SPEED_RATE;
  // Add 3-second buffer for Alexa processing overhead
  const delayMs = adjustedSeconds * 1000 + 3000;

  console.log(`[TTS] Scheduling next chunk in ${(delayMs / 1000).toFixed(1)}s`);

  tts.session.autoTimer = setTimeout(() => {
    console.log("[TTS] Timer fired, calling sendNextChunk");
    sendNextChunk();
  }, delayMs);
}
