/**
 * ============================================================
 * LOCKED TIMEZONE: America/Toronto (Eastern Time)
 * ============================================================
 * Password-protected. The timezone CANNOT be changed without
 * providing auth code 5747. This is enforced at runtime.
 *
 * ALL server-side date logic MUST use these functions.
 * NEVER use raw new Date() for comparisons or day boundaries.
 * ============================================================
 */

let LOCKED_TZ = 'America/Toronto';
let tzLocked = true;
const TZ_PASSWORD = '5747';

export function getTimezone(): string {
  return LOCKED_TZ;
}

export function isTimezoneLocked(): boolean {
  return tzLocked;
}

export function changeTimezone(newTz: string, password: string): { success: boolean; error?: string } {
  if (password !== TZ_PASSWORD) {
    console.warn(`[Timezone] BLOCKED: unauthorized attempt to change timezone to "${newTz}"`);
    return { success: false, error: 'Incorrect password. Timezone change denied.' };
  }
  const old = LOCKED_TZ;
  LOCKED_TZ = newTz;
  process.env.TZ = newTz;
  console.log(`[Timezone] Changed from "${old}" to "${newTz}" (authorized with password)`);
  return { success: true };
}

export function easternNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: LOCKED_TZ }));
}

export function easternDateStr(date: Date = new Date()): string {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: LOCKED_TZ });
}

export function easternHour(date: Date = new Date()): number {
  return parseInt(
    date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: LOCKED_TZ }),
    10,
  ) % 24;
}

export function easternMidnight(date: Date = new Date()): Date {
  const d = easternNow();
  if (date !== undefined) {
    const str = new Date(date).toLocaleString('en-US', { timeZone: LOCKED_TZ });
    const parsed = new Date(str);
    d.setFullYear(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

export function easternTodayStr(): string {
  return easternDateStr(new Date());
}

export function easternTomorrowMidnight(): Date {
  const m = easternMidnight();
  m.setDate(m.getDate() + 1);
  return m;
}

export function taskDateStr(dueDate: string | Date): string {
  return easternDateStr(new Date(dueDate));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function easternTimestamp(): string {
  return new Date().toLocaleString('en-US', { timeZone: LOCKED_TZ });
}
