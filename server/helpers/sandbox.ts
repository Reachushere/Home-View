// server/helpers/sandbox.ts
// Centralised sandbox / staging mode for UniCal.
//
// When sandbox mode is ON, every side-effecting integration call (Home
// Assistant service calls, Nest speaker playback, tablet commands, OneDrive
// writes, Microsoft Graph writes) is short-circuited to a no-op and a
// counter is incremented. Reads are NOT blocked — only writes / device
// commands.
//
// Two activation paths:
//   1. process.env.STAGING_MODE === "1"  (boot-time, persistent)
//   2. POST /api/dev/sandbox { enabled: true }  (runtime override, RAM only)
//
// The runtime override always wins over the env var, so a user can flip
// sandbox ON in dev without restarting and back OFF without redeploying.

type SuppressedKind =
  | 'ha_service_call'
  | 'nest_play'
  | 'tablet_command'
  | 'onedrive_write'
  | 'tts_generate';

interface Suppressed {
  ts: number;
  kind: SuppressedKind;
  label: string;
  detail?: any;
}

const MAX_RECENT = 100;
const recent: Suppressed[] = [];
const counters: Record<SuppressedKind, number> = {
  ha_service_call: 0,
  nest_play: 0,
  tablet_command: 0,
  onedrive_write: 0,
  tts_generate: 0,
};

let runtimeOverride: boolean | null = null;
let activatedAt: number | null = null;

export function isSandboxMode(): boolean {
  if (runtimeOverride !== null) return runtimeOverride;
  return process.env.STAGING_MODE === "1";
}

export function setSandboxMode(enabled: boolean | null): boolean {
  runtimeOverride = enabled;
  if (enabled) activatedAt = Date.now();
  else if (enabled === false) activatedAt = null;
  return isSandboxMode();
}

export function recordSuppressed(kind: SuppressedKind, label: string, detail?: any): void {
  counters[kind]++;
  recent.push({ ts: Date.now(), kind, label, detail });
  if (recent.length > MAX_RECENT) recent.splice(0, recent.length - MAX_RECENT);
}

export function getSandboxStatus() {
  return {
    enabled: isSandboxMode(),
    source: runtimeOverride !== null ? 'runtime_override' : (process.env.STAGING_MODE === "1" ? 'env_STAGING_MODE' : 'off'),
    activatedAt,
    counters: { ...counters },
    recent: recent.slice(-30).reverse(),
  };
}

export function clearSandboxStats(): void {
  for (const k of Object.keys(counters) as SuppressedKind[]) counters[k] = 0;
  recent.length = 0;
}
