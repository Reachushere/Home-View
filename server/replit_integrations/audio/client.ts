import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { EdgeTTS } from "node-edge-tts";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
      if (resetMs > Date.now()) {
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

async function edgeTTSGenerate(text: string, voice: string, retries = 2): Promise<Buffer> {
  const edgeVoice = edgeVoiceMap[voice] || edgeVoiceMap.echo;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const outPath = join(tmpdir(), `edge-tts-${randomUUID()}.mp3`);
      const tts = new EdgeTTS({ voice: edgeVoice });
      await tts.ttsPromise(text, outPath);
      const buf = await readFile(outPath);
      await unlink(outPath).catch(() => {});
      if (buf.length === 0) throw new Error("Edge TTS returned empty audio");
      return buf;
    } catch (err: any) {
      console.error(`[Edge TTS] Attempt ${attempt + 1} failed: ${err?.message || err}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Edge TTS failed after retries");
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
 * Voice Chat: User speaks, LLM responds with audio (audio-in, audio-out).
 * Uses gpt-audio model via Replit AI Integrations.
 * Note: Browser records WebM/opus - convert to WAV using ffmpeg before calling this.
 */
export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  const audioBase64 = audioBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: outputFormat },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
  });
  const message = response.choices[0]?.message as any;
  const transcript = message?.audio?.transcript || message?.content || "";
  const audioData = message?.audio?.data ?? "";
  return {
    transcript,
    audioResponse: Buffer.from(audioData, "base64"),
  };
}

/**
 * Streaming Voice Chat: For real-time audio responses.
 * Note: Streaming only supports pcm16 output format.
 *
 * @example
 * // Converting browser WebM to WAV before calling:
 * const webmBuffer = Buffer.from(req.body.audio, "base64");
 * const wavBuffer = await convertWebmToWav(webmBuffer);
 * for await (const chunk of voiceChatStream(wavBuffer)) { ... }
 */
export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.transcript) {
        yield { type: "transcript", data: delta.audio.transcript };
      }
      if (delta?.audio?.data) {
        yield { type: "audio", data: delta.audio.data };
      }
    }
  })();
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
  if (useEdgeTTSFallback) {
    console.log(`[TTS] Using Edge TTS fallback (voice: ${edgeVoiceMap[voice] || edgeVoiceMap.echo})`);
    return edgeTTSGenerate(text, voice);
  }

  try {
    const systemContent = slowPace
      ? "You are an assistant that performs text-to-speech. Speak at a slow, measured pace — slightly slower than normal conversational speed. Enunciate clearly."
      : "You are an assistant that performs text-to-speech. Read the text naturally and clearly.";
    const response = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice, format },
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: `Repeat the following text verbatim: ${text}` },
      ],
    });
    const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
    return Buffer.from(audioData, "base64");
  } catch (err: any) {
    if (err?.status === 429 || err?.code === 'RATELIMIT_EXCEEDED') {
      const resetHeader = err?.headers?.get?.('x-ratelimit-reset') || err?.headers?.['x-ratelimit-reset'];
      const resetMs = resetHeader ? parseInt(String(resetHeader)) : Date.now() + 30 * 24 * 60 * 60 * 1000;
      console.log(`[TTS] Rate limited — switching to Edge TTS until ${new Date(resetMs).toISOString()}`);
      useEdgeTTSFallback = true;
      rateLimitResetTime = resetMs;
      await saveRateLimitReset(resetMs);
      return edgeTTSGenerate(text, voice);
    }
    throw err;
  }
}

/**
 * Streaming Text-to-Speech: Converts text to speech with real-time streaming.
 * Uses gpt-audio model via Replit AI Integrations.
 * Note: Streaming only supports pcm16 output format.
 */
export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "echo",
  slowPace: boolean = false
): Promise<AsyncIterable<string>> {
  const systemContent = slowPace
    ? "You are an assistant that performs text-to-speech. Speak at a slow, measured pace — slightly slower than normal conversational speed. Enunciate clearly."
    : "You are an assistant that performs text-to-speech. Read the text naturally and clearly.";
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.data) {
        yield delta.audio.data;
      }
    }
  })();
}

/**
 * Speech-to-Text: Transcribes audio using dedicated transcription model.
 * Uses gpt-4o-mini-transcribe for accurate transcription.
 */
export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<string> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const response = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
  });
  return response.text;
}

/**
 * Streaming Speech-to-Text: Transcribes audio with real-time streaming.
 * Uses gpt-4o-mini-transcribe for accurate transcription.
 */
export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    stream: true,
  });

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") {
        yield event.delta;
      }
    }
  })();
}
