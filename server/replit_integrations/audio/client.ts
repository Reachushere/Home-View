import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { EdgeTTS } from "node-edge-tts";

let useEdgeTTSFallback = false;
let rateLimitResetTime: number | null = null;

export async function initTTSFallbackStatus() {
  try {
    const { db } = await import("../../db");
    const { appState } = await import("../../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(appState).where(eq(appState.key, 'tts_rate_limit_reset'));
    if (rows.length > 0) {
      const resetMs = parseInt(rows[0].value);
      const MAX_RATE_LIMIT_DURATION = 24 * 60 * 60 * 1000;
      if (resetMs > Date.now() + MAX_RATE_LIMIT_DURATION) {
        console.log(`[TTS] Stored rate limit reset ${new Date(resetMs).toISOString()} is more than 24h away — clearing stale record`);
        useEdgeTTSFallback = false;
        rateLimitResetTime = null;
        await db.delete(appState).where(eq(appState.key, 'tts_rate_limit_reset'));
        console.log(`[TTS] Stale rate limit cleared — using OpenAI TTS`);
      } else if (resetMs > Date.now()) {
        useEdgeTTSFallback = true;
        rateLimitResetTime = resetMs;
        console.log(`[TTS] Rate limit active until ${new Date(resetMs).toISOString()} — using Edge TTS`);
      } else {
        useEdgeTTSFallback = false;
        rateLimitResetTime = null;
        await db.delete(appState).where(eq(appState.key, 'tts_rate_limit_reset'));
        console.log(`[TTS] Rate limit has expired — using OpenAI TTS`);
      }
    }
  } catch (e: any) {
    console.error(`[TTS] Failed to check rate limit status: ${e.message}`);
  }
}

export async function clearTTSRateLimit() {
  try {
    const { db } = await import("../../db");
    const { appState } = await import("../../../shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(appState).where(eq(appState.key, 'tts_rate_limit_reset'));
    useEdgeTTSFallback = false;
    rateLimitResetTime = null;
    console.log(`[TTS] Rate limit manually cleared — using OpenAI TTS`);
    return { cleared: true };
  } catch (e: any) {
    console.error(`[TTS] Failed to clear rate limit: ${e.message}`);
    return { cleared: false, error: e.message };
  }
}

export function getTTSStatus() {
  return {
    usingEdgeTTS: useEdgeTTSFallback,
    rateLimitResetTime: rateLimitResetTime ? new Date(rateLimitResetTime).toISOString() : null,
    edgeTTSConsecutiveFailures: edgeTTSConsecutiveFailures,
  };
}

async function saveRateLimitReset(resetMs: number) {
  try {
    const { db } = await import("../../db");
    const { appState } = await import("../../../shared/schema");
    await db.insert(appState).values({ key: 'tts_rate_limit_reset', value: String(resetMs) })
      .onConflictDoUpdate({ target: appState.key, set: { value: String(resetMs) } });
  } catch (e: any) {
    console.error(`[TTS] Failed to save rate limit reset: ${e.message}`);
  }
}

const edgeVoiceMap: Record<string, string> = {
  echo: "en-US-AndrewMultilingualNeural",
  alloy: "en-US-AvaMultilingualNeural",
  fable: "en-GB-RyanNeural",
  onyx: "en-US-GuyNeural",
  nova: "en-US-JennyNeural",
  shimmer: "en-US-AriaNeural",
};

let edgeTTSConsecutiveFailures = 0;
const EDGE_TTS_MAX_CONSECUTIVE_FAILURES = 5;

async function edgeTTSGenerate(text: string, voice: string, retries = 2): Promise<Buffer> {
  const edgeVoice = edgeVoiceMap[voice] || edgeVoiceMap.echo;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const outPath = join(tmpdir(), `edge-tts-${randomUUID()}.mp3`);
    try {
      const tts = new EdgeTTS({ voice: edgeVoice });
      await tts.ttsPromise(text, outPath);
      const buf = await readFile(outPath);
      if (buf.length === 0) throw new Error("Edge TTS returned empty audio");
      edgeTTSConsecutiveFailures = 0;
      return buf;
    } catch (err: any) {
      console.error(`[Edge TTS] Attempt ${attempt + 1} failed: ${err?.message || err}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        edgeTTSConsecutiveFailures++;
        throw err;
      }
    } finally {
      // Always remove the temp file — including on failure / mid-write
      // crash / retry. Without this, every failed attempt would leak a
      // 3.5 MB file in /tmp and over time fill the entire 4 GB tmpfs,
      // crashing the whole server with ENOSPC. (Bryn 2026-04-19.)
      await unlink(outPath).catch(() => {});
    }
  }
  edgeTTSConsecutiveFailures++;
  throw new Error("Edge TTS failed after retries");
}

// Sweep any orphaned edge-tts*.mp3 / local-tts*.wav files in /tmp on startup.
// Runs once at module load so each server restart self-heals from past leaks.
(async () => {
  try {
    const { readdir, stat } = await import("node:fs/promises");
    const dir = tmpdir();
    const entries = await readdir(dir);
    const now = Date.now();
    let removed = 0;
    let bytes = 0;
    for (const name of entries) {
      if (!/^(edge-tts-|local-tts-).+\.(mp3|wav)$/i.test(name)) continue;
      const full = join(dir, name);
      try {
        const st = await stat(full);
        // Only remove files older than 5 minutes so we never clobber a
        // request currently in flight.
        if (now - st.mtimeMs > 5 * 60 * 1000) {
          await unlink(full).catch(() => {});
          removed++;
          bytes += st.size;
        }
      } catch {}
    }
    if (removed > 0) {
      console.log(`[TTS Cleanup] Removed ${removed} orphaned TTS temp files (${(bytes / 1024 / 1024).toFixed(1)} MB freed)`);
    }
  } catch (e: any) {
    console.warn(`[TTS Cleanup] Startup sweep skipped: ${e?.message || e}`);
  }
})();

async function localTTSGenerate(text: string): Promise<Buffer> {
  const outPath = join(tmpdir(), `local-tts-${randomUUID()}.wav`);
  const cleanText = text.replace(/["""'']/g, "'").replace(/[^\x20-\x7E\n]/g, ' ').slice(0, 5000);
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("espeak-ng", [
        "-v", "en-us",
        "-s", "145",
        "-p", "40",
        "-w", outPath,
        cleanText,
      ]);
      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`espeak-ng exited with code ${code}: ${stderr}`));
      });
      proc.on("error", reject);
    });
    const wavBuf = await readFile(outPath);
    await unlink(outPath).catch(() => {});
    if (wavBuf.length === 0) throw new Error("espeak-ng returned empty audio");
    console.log(`[Local TTS] Generated ${wavBuf.length} bytes via espeak-ng`);
    return wavBuf;
  } catch (err: any) {
    await unlink(outPath).catch(() => {});
    throw new Error(`Local TTS (espeak-ng) failed: ${err.message}`);
  }
}

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

/**
 * Detect audio format from buffer magic bytes.
 * Supports: WAV, MP3, WebM (Chrome/Firefox), MP4/M4A/MOV (Safari/iOS), OGG
 */
export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  // WAV: RIFF....WAVE
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "wav";
  }
  // WebM: EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  // MP3: ID3 tag or frame sync
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  // MP4/M4A/MOV: ....ftyp (Safari/iOS records in these containers)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "mp4";
  }
  // OGG: OggS
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return "ogg";
  }
  return "unknown";
}

/**
 * Convert any audio/video format to WAV using ffmpeg.
 * Uses temp files instead of pipes because video containers (MP4/MOV)
 * require seeking to find the audio track.
 */
export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    // Write input to temp file (required for video containers that need seeking)
    await writeFile(inputPath, audioBuffer);

    // Run ffmpeg with file paths
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",              // Extract audio only (ignore video track)
        "-f", "wav",
        "-ar", "16000",     // 16kHz sample rate (good for speech)
        "-ac", "1",         // Mono
        "-acodec", "pcm_s16le",
        "-y",               // Overwrite output
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {}); // Suppress logs
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    // Read converted audio
    return await readFile(outputPath);
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Auto-detect and convert audio to OpenAI-compatible format.
 * - WAV/MP3: Pass through (already compatible)
 * - WebM/MP4/OGG: Convert to WAV via ffmpeg
 */
export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  // Convert WebM, MP4, OGG, or unknown to WAV
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

/**
 * Voice Chat: DISABLED — requires OpenAI approval gate.
 * These functions are not used in any automation flow.
 * They would only be called from the voice chat UI which now goes through audio/routes.ts with approval.
 */
export async function voiceChat(
  _audioBuffer: Buffer,
  _voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  _inputFormat: "wav" | "mp3" = "wav",
  _outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  throw new Error("voiceChat requires OpenAI approval — use the approved route in audio/routes.ts instead");
}

export async function voiceChatStream(
  _audioBuffer: Buffer,
  _voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  _inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  throw new Error("voiceChatStream requires OpenAI approval — use the approved route in audio/routes.ts instead");
}

/**
 * Text-to-Speech: Converts text to speech verbatim.
 * Uses gpt-audio model via Replit AI Integrations.
 */
export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "echo",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav",
  slowPace: boolean = false
): Promise<Buffer> {
  console.log(`[TTS] Using Edge TTS (free, no charges)`);
  try {
    return await edgeTTSGenerate(text, voice);
  } catch (edgeErr: any) {
    console.warn(`[TTS] Edge TTS failed: ${edgeErr.message} — falling back to local TTS`);
    return localTTSGenerate(text);
  }
}

/**
 * Streaming Text-to-Speech: DISABLED — all TTS now uses Edge TTS.
 * This function previously called OpenAI gpt-audio directly without approval.
 */
export async function textToSpeechStream(
  _text: string,
  _voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "echo",
  _slowPace: boolean = false
): Promise<AsyncIterable<string>> {
  throw new Error("textToSpeechStream is disabled — use textToSpeech (Edge TTS) instead");
}

/**
 * Speech-to-Text: DISABLED — requires OpenAI approval gate.
 * Use the approved route in audio/routes.ts instead.
 */
export async function speechToText(
  _audioBuffer: Buffer,
  _format: "wav" | "mp3" | "webm" = "wav"
): Promise<string> {
  throw new Error("speechToText requires OpenAI approval — use the approved route in audio/routes.ts instead");
}

/**
 * Streaming Speech-to-Text: DISABLED — requires OpenAI approval gate.
 */
export async function speechToTextStream(
  _audioBuffer: Buffer,
  _format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  throw new Error("speechToTextStream requires OpenAI approval — use the approved route in audio/routes.ts instead");
}
