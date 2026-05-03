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
