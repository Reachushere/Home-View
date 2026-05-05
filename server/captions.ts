import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import { storage } from './storage';
import { db } from './db';
import { files as filesTable } from '@shared/schema';

const CAPTIONS_DIR = path.join(process.cwd(), 'persistent-uploads', 'captions');
const TMP_DIR = path.join(process.cwd(), 'persistent-uploads', 'captions-tmp');
const CHUNK_SECONDS = 5 * 60;
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.webm', '.avi', '.wmv', '.flv', '.mpg', '.mpeg', '.3gp']);

function ensureDirs() {
  if (!fs.existsSync(CAPTIONS_DIR)) fs.mkdirSync(CAPTIONS_DIR, { recursive: true });
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

export function captionsVttPath(fileId: number): string {
  return path.join(CAPTIONS_DIR, `${fileId}.vtt`);
}

export function isVideoFile(file: any): boolean {
  if (!file) return false;
  const ct = String(file.contentType || '').toLowerCase();
  if (ct.startsWith('video/')) return true;
  const candidates = [file.originalName, file.displayName, file.objectPath, file.folder]
    .filter(Boolean)
    .map((s: string) => s.toLowerCase());
  for (const c of candidates) {
    for (const ext of Array.from(VIDEO_EXTS)) {
      if (c.endsWith(ext) || c.includes(`${ext}?`) || c.includes(`${ext}/`)) return true;
    }
  }
  return false;
}

const queue: number[] = [];
const inQueue = new Set<number>();
let workerRunning = false;

export function enqueueCaptions(fileId: number, opts?: { force?: boolean }): void {
  if (!Number.isFinite(fileId) || fileId <= 0) return;
  if (inQueue.has(fileId)) return;
  ensureDirs();
  inQueue.add(fileId);
  queue.push(fileId);
  if (opts?.force) {
    try { fs.unlinkSync(captionsVttPath(fileId)); } catch {}
  }
  storage.updateFile(fileId, { captionsStatus: 'pending', captionsError: null } as any).catch(() => {});
  console.log(`[Captions] Enqueued file ${fileId} (queue size=${queue.length})`);
  startWorker();
}

export function getQueueState(): { running: boolean; size: number; pending: number[] } {
  return { running: workerRunning, size: queue.length, pending: [...queue] };
}

function startWorker() {
  if (workerRunning) return;
  workerRunning = true;
  setImmediate(() => workerLoop().catch(e => {
    console.error('[Captions] Worker crashed:', e?.message || e);
    workerRunning = false;
  }));
}

async function workerLoop() {
  while (queue.length > 0) {
    const fileId = queue.shift()!;
    inQueue.delete(fileId);
    try {
      await processFile(fileId);
    } catch (e: any) {
      console.error(`[Captions] file ${fileId} failed:`, e?.message || e);
      try {
        await storage.updateFile(fileId, {
          captionsStatus: 'failed',
          captionsError: String(e?.message || e).slice(0, 500),
        } as any);
      } catch {}
    }
  }
  workerRunning = false;
}

function getInternalBaseUrl(): string {
  const port = parseInt(process.env.PORT || '5000', 10);
  return `http://127.0.0.1:${port}`;
}

async function downloadToTmp(fileId: number): Promise<string> {
  const auth = encodeURIComponent(process.env.SITE_PASSWORD || '');
  const url = `${getInternalBaseUrl()}/api/files/${fileId}/download${auth ? `?auth=${auth}` : ''}`;
  const resp = await fetch(url);
  if (!resp.ok || !resp.body) throw new Error(`download failed: HTTP ${resp.status}`);
  const tmpFile = path.join(TMP_DIR, `${fileId}-src.bin`);
  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(tmpFile);
    ws.on('error', reject);
    ws.on('finish', () => resolve());
    const reader = resp.body!.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { ws.end(); return; }
          if (!ws.write(Buffer.from(value))) await new Promise<void>(r => ws.once('drain', () => r()));
        }
      } catch (e) { reject(e); }
    };
    pump();
  });
  return tmpFile;
}

function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('error', reject);
    p.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-300)}`));
    });
  });
}

async function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]);
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('error', reject);
    p.on('close', () => {
      const v = parseFloat(out.trim());
      resolve(Number.isFinite(v) ? v : 0);
    });
  });
}

async function extractAudioChunk(srcFile: string, startSec: number, durSec: number, outFile: string): Promise<void> {
  // 16 kHz mono mp3 @ 32 kbps — Whisper-friendly, ~4 KB/sec, 20 min ≈ 4.8 MB.
  await runCmd('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-ss', String(startSec),
    '-t', String(durSec),
    '-i', srcFile,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', '32k',
    '-f', 'mp3',
    outFile,
  ]);
}

function fmtVttTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec - h * 3600 - m * 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(whole)}.${String(ms).padStart(3, '0')}`;
}

function parseVttTime(t: string): number {
  // Accept HH:MM:SS.mmm or MM:SS.mmm
  const parts = t.trim().split(':');
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) { h = +parts[0]; m = +parts[1]; s = parseFloat(parts[2]); }
  else if (parts.length === 2) { m = +parts[0]; s = parseFloat(parts[1]); }
  else { s = parseFloat(parts[0]); }
  return h * 3600 + m * 60 + (Number.isFinite(s) ? s : 0);
}

function shiftVttCues(vtt: string, offsetSec: number): { cues: string[]; lastEnd: number } {
  // Strip header, return individual cue blocks with timestamps shifted.
  const lines = vtt.replace(/\r/g, '').split('\n');
  let i = 0;
  // Skip WEBVTT header + any NOTE/STYLE blocks until first blank line after header.
  if (lines[0]?.startsWith('WEBVTT')) {
    while (i < lines.length && lines[i].trim() !== '') i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  const cues: string[] = [];
  let lastEnd = offsetSec;
  let buf: string[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    // Find timing line.
    let timingIdx = -1;
    for (let j = 0; j < buf.length; j++) {
      if (buf[j].includes('-->')) { timingIdx = j; break; }
    }
    if (timingIdx === -1) { buf = []; return; }
    const [a, b] = buf[timingIdx].split('-->').map(s => s.trim());
    const startStr = a.split(' ')[0];
    const endStr = b.split(' ')[0];
    const start = parseVttTime(startStr) + offsetSec;
    const end = parseVttTime(endStr) + offsetSec;
    if (end > lastEnd) lastEnd = end;
    buf[timingIdx] = `${fmtVttTime(start)} --> ${fmtVttTime(end)}`;
    cues.push(buf.join('\n'));
    buf = [];
  };
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '') flush();
    else buf.push(lines[i]);
  }
  flush();
  return { cues, lastEnd };
}

async function transcribeChunk(openai: OpenAI, audioPath: string): Promise<string> {
  // Returns raw VTT body (with WEBVTT header) for this chunk, timestamps relative to chunk start.
  const stream: any = fs.createReadStream(audioPath);
  const res: any = await openai.audio.transcriptions.create({
    file: stream,
    model: 'whisper-1',
    response_format: 'vtt',
    language: 'en',
  } as any);
  return typeof res === 'string' ? res : String(res);
}

async function processFile(fileId: number) {
  const file = await storage.getFile(fileId);
  if (!file) throw new Error(`file ${fileId} not found`);
  if (!isVideoFile(file)) throw new Error('not a video file');

  const outVtt = captionsVttPath(fileId);
  if (fs.existsSync(outVtt)) {
    await storage.updateFile(fileId, {
      captionsStatus: 'ready',
      captionsError: null,
      captionsGeneratedAt: new Date(),
    } as any);
    console.log(`[Captions] file ${fileId}: VTT already exists, marked ready.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  await storage.updateFile(fileId, { captionsStatus: 'processing', captionsError: null } as any);
  console.log(`[Captions] file ${fileId} "${file.originalName}": starting…`);

  ensureDirs();
  const srcFile = await downloadToTmp(fileId);
  let totalDur = 0;
  try {
    totalDur = await probeDuration(srcFile);
  } catch (e: any) {
    console.warn(`[Captions] probe failed: ${e?.message || e}`);
  }
  const dur = totalDur > 0 ? totalDur : Number.MAX_SAFE_INTEGER;
  console.log(`[Captions] file ${fileId} duration=${Math.round(dur)}s, chunking @ ${CHUNK_SECONDS}s`);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const outParts: string[] = ['WEBVTT', ''];
  let chunkIdx = 0;
  for (let start = 0; start < dur; start += CHUNK_SECONDS) {
    const remain = dur - start;
    const take = Math.min(CHUNK_SECONDS, remain);
    if (take < 1 && totalDur > 0) break;
    const audioOut = path.join(TMP_DIR, `${fileId}-c${chunkIdx}.mp3`);
    try {
      await extractAudioChunk(srcFile, start, take, audioOut);
      const stat = fs.statSync(audioOut);
      if (stat.size < 1024) {
        console.log(`[Captions] file ${fileId} chunk ${chunkIdx}: tiny audio (${stat.size}B), end of stream.`);
        try { fs.unlinkSync(audioOut); } catch {}
        break;
      }
      console.log(`[Captions] file ${fileId} chunk ${chunkIdx}: transcribing ${(stat.size/1024).toFixed(0)}KB (offset=${start}s)…`);
      const vttRaw = await transcribeChunk(openai, audioOut);
      const { cues } = shiftVttCues(vttRaw, start);
      for (const c of cues) outParts.push(c, '');
      try { fs.unlinkSync(audioOut); } catch {}
      // Flush a partial VTT after EACH chunk so the player sees captions
      // streaming in instead of waiting for the whole movie to finish.
      try {
        if (outParts.length > 2) {
          fs.writeFileSync(outVtt, outParts.join('\n'), 'utf8');
          console.log(`[Captions] file ${fileId}: partial VTT flushed after chunk ${chunkIdx} (${cues.length} new cues)`);
        }
      } catch (we: any) {
        console.warn(`[Captions] file ${fileId}: partial flush failed: ${we?.message || we}`);
      }
    } catch (e: any) {
      console.error(`[Captions] file ${fileId} chunk ${chunkIdx} failed: ${e?.message || e}`);
      try { fs.unlinkSync(audioOut); } catch {}
      // Continue with next chunk so a single Whisper hiccup doesn't kill the whole movie.
    }
    chunkIdx++;
    if (totalDur === 0) break; // unknown duration: only do one pass
  }
  try { fs.unlinkSync(srcFile); } catch {}

  if (outParts.length <= 2) throw new Error('no cues produced');

  const finalVtt = outParts.join('\n');
  fs.writeFileSync(outVtt, finalVtt, 'utf8');
  await storage.updateFile(fileId, {
    captionsStatus: 'ready',
    captionsError: null,
    captionsGeneratedAt: new Date(),
  } as any);
  console.log(`[Captions] file ${fileId} DONE: ${(finalVtt.length/1024).toFixed(1)}KB → ${outVtt}`);
}

export async function enqueueAllVideosNeedingCaptions(opts?: { force?: boolean; courseCodeFilter?: string }): Promise<{ enqueued: number; scanned: number }> {
  const all: any[] = await db.select().from(filesTable);
  let n = 0;
  for (const f of all) {
    if (opts?.courseCodeFilter) {
      const cc = String(opts.courseCodeFilter).toLowerCase();
      const hay = `${f.folder || ''} ${f.originalName || ''} ${f.objectPath || ''}`.toLowerCase();
      if (!hay.includes(cc)) continue;
    }
    if (!isVideoFile(f)) continue;
    const status = (f as any).captionsStatus || 'none';
    const has = fs.existsSync(captionsVttPath(f.id));
    if (has && status === 'ready') continue;
    if (!opts?.force && (status === 'pending' || status === 'processing')) continue;
    enqueueCaptions(f.id, { force: opts?.force });
    n++;
  }
  return { enqueued: n, scanned: all.length };
}
