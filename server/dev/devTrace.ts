// ────────────────────────────────────────────────────────────────────────
// Developer introspection — automation trace + last-file-selection
// snapshot. Pure module-scope state; no DB. Imported by server/routes.ts
// to instrument Cat Lights flow and by server/dev/devRoutes.ts to expose
// the data over HTTP.
// ────────────────────────────────────────────────────────────────────────

export type Subsystem =
  | 'cat_lights' | 'calendar' | 'onedrive' | 'tts' | 'audio_prep'
  | 'files' | 'auth' | 'database' | 'frontend_layout' | 'shower_button'
  | 'home_assistant' | 'patch' | 'system' | 'other';

export interface TraceStep {
  time: string;
  ts: number;
  step: string;
  subsystem: Subsystem;
  // Phase-2 decision-trace fields (all optional — existing callers keep working).
  decision?: string;
  reason?: string;
  inputs?: any;
  outputs?: any;
  data?: any;
}

const MAX_STEPS = 300;
const steps: TraceStep[] = [];

// Recent critical errors — separate small ring so they don't get evicted
// by routine trace events.
const errors: TraceStep[] = [];
const MAX_ERRORS = 50;

// Heuristic: subsystem tag inferred from step name prefix when not given.
function inferSubsystem(step: string): Subsystem {
  const s = step.toLowerCase();
  if (s.startsWith('cat_lights') || s.includes('catlights')) return 'cat_lights';
  if (s.startsWith('shower') || s.includes('shower_button')) return 'shower_button';
  if (s.startsWith('onedrive') || s.includes('onedrive')) return 'onedrive';
  if (s.startsWith('tts') || s.includes('tts:')) return 'tts';
  if (s.startsWith('audio_prep') || s.includes('audioprep')) return 'audio_prep';
  if (s.startsWith('calendar') || s.includes('layout')) return 'calendar';
  if (s.startsWith('files') || s.includes('file_')) return 'files';
  if (s.startsWith('auth')) return 'auth';
  if (s.startsWith('db') || s.includes('database')) return 'database';
  if (s.startsWith('ha:') || s.includes('home_assistant')) return 'home_assistant';
  if (s.startsWith('patch')) return 'patch';
  return 'other';
}

export function logStep(step: string, data?: any, subsystem?: Subsystem): void {
  const now = new Date();
  // Backward-compat: data may carry the new decision/reason/inputs/outputs
  // fields directly. Hoist them onto the entry for first-class queryability.
  const d: any = data || {};
  const entry: TraceStep = {
    time: now.toISOString(),
    ts: now.getTime(),
    step,
    subsystem: subsystem || inferSubsystem(step),
    decision: d.decision,
    reason: d.reason,
    inputs: d.inputs,
    outputs: d.outputs,
    data,
  };
  steps.push(entry);
  if (steps.length > MAX_STEPS) steps.splice(0, steps.length - MAX_STEPS);
  if ((d.error || d.err) || /error|fail|critical/i.test(step)) {
    errors.push(entry);
    if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
  }
}

// Phase-2 helper: structured decision logger. Equivalent to
// logStep(step, { decision, reason, inputs, outputs }) but explicit.
export function logDecision(step: string, decision: string, reason: string, inputs?: any, outputs?: any, subsystem?: Subsystem): void {
  logStep(step, { decision, reason, inputs, outputs }, subsystem);
}

// ────────────── Runtime flags ──────────────
// Read by service code at decision points; mutated via POST /api/dev/flags.
export interface RuntimeFlags {
  disableAudioPrepQueue: boolean;
  disableTTS: boolean;
  disableOneDriveSync: boolean;
  forceSmallChunkMode: boolean;
  verboseLogging: boolean;
}
const flags: RuntimeFlags = {
  disableAudioPrepQueue: false,
  disableTTS: false,
  disableOneDriveSync: false,
  forceSmallChunkMode: false,
  verboseLogging: false,
};
export function getFlags(): RuntimeFlags { return { ...flags }; }
export function setFlags(patch: Partial<RuntimeFlags>): RuntimeFlags {
  for (const k of Object.keys(patch) as (keyof RuntimeFlags)[]) {
    if (typeof patch[k] === 'boolean') (flags as any)[k] = patch[k];
  }
  logStep('flags:updated', { outputs: { ...flags } }, 'system');
  return { ...flags };
}

export function getSteps(subsystem?: Subsystem): TraceStep[] {
  if (!subsystem) return steps.slice();
  return steps.filter(s => s.subsystem === subsystem);
}

export function getRecentErrors(): TraceStep[] {
  return errors.slice();
}

export function clearSteps(): void {
  steps.length = 0;
}

// ────────────── Last file-selection snapshot ──────────────
// The Cat Lights / Cat Wash flows call setFileSelection() each time they
// pick (or fail to pick) a file. /api/dev/file-map returns this snapshot.

export interface FileSelectionSnapshot {
  time: string;
  ts: number;
  source: string;             // 'cat_lights' | 'cat_wash' | 'next_reading' | …
  semester: string | null;
  weekNumber: number | null;
  course: string | null;
  selectedFileId: number | null;
  selectedFileName: string | null;
  folder: string | null;
  objectPath: string | null;
  oneDrivePath: string | null;
  reason?: string;
}

let lastSelection: FileSelectionSnapshot | null = null;

export function setFileSelection(s: Partial<FileSelectionSnapshot> & { source: string }): void {
  const now = new Date();
  lastSelection = {
    time: now.toISOString(),
    ts: now.getTime(),
    source: s.source,
    semester: s.semester ?? null,
    weekNumber: s.weekNumber ?? null,
    course: s.course ?? null,
    selectedFileId: s.selectedFileId ?? null,
    selectedFileName: s.selectedFileName ?? null,
    folder: s.folder ?? null,
    objectPath: s.objectPath ?? null,
    oneDrivePath: s.oneDrivePath ?? null,
    reason: s.reason,
  };
}

export function getLastSelection(): FileSelectionSnapshot | null {
  return lastSelection;
}

// ────────────── Layout snapshot (posted from frontend) ──────────────
// dashboard.tsx POSTs to /api/dev/layout-map periodically with the
// computed bounding boxes / view state so /api/dev/layout-map GET can
// return it without round-tripping through the browser.

export interface LayoutSnapshot {
  time: string;
  ts: number;
  view: 'week' | 'month' | string;
  countdown: { isFixed: boolean; top?: number; height?: number };
  calendar: { top: number; height: number; width?: number };
  glassBacking?: { top: number; height: number };
  extra?: any;
}

let lastLayout: LayoutSnapshot | null = null;

export function setLayoutSnapshot(s: Omit<LayoutSnapshot, 'time' | 'ts'>): void {
  const now = new Date();
  lastLayout = { time: now.toISOString(), ts: now.getTime(), ...s };
}

export function getLayoutSnapshot(): LayoutSnapshot | null {
  return lastLayout;
}
