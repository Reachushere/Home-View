// Pure helper functions extracted from dashboard.tsx (Phase 2 of refactor).
// These have no closure/state dependencies and are safe to import anywhere.

export const isValidHex = (v: string): boolean =>
  /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v);

export const safeHex = (v: string, fallback: string): string =>
  isValidHex(v) ? v : fallback;

export const shortTermLabel = (val: string): string => val.replace(/^20/, '');

export const ttsKeyFor = (
  courseCode: string,
  week: number,
  type: 'module' | 'reading',
): string => `${courseCode.replace(/\s/g, '').toUpperCase()}-w${week}-${type}`;

export const TICKER_TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push(`${h12}:${m.toString().padStart(2, '0')} ${period}`);
    }
  }
  opts.push('11:59 PM');
  return opts;
})();

export const buildExpiryISO = (dateStr: string, timeStr: string): string | null => {
  if (!dateStr) return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1]); const min = parseInt(m[2]); const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, h, min, 0, 0);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

export const isoToDateTimeParts = (iso: string | null | undefined): { date: string; time: string } => {
  if (!iso) return { date: '', time: '11:59 PM' };
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return { date: '', time: '11:59 PM' };
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const h = dt.getHours();
  const min = dt.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const time = `${h12}:${pad(min)} ${period}`;
  return { date, time };
};
