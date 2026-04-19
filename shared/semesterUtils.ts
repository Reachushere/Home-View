// Semester date calculation utilities
// These compute standard academic semester date ranges

export type SemesterType = "fall" | "winter" | "spring_summer";
export type SpringSummerTerm = "full" | "first_half" | "second_half";

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  let day = firstDay.getDay();
  let diff = weekday - day;
  if (diff < 0) diff += 7;
  const firstOccurrence = 1 + diff;
  const nthOccurrence = firstOccurrence + (n - 1) * 7;
  return new Date(year, month, nthOccurrence);
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  let day = lastDay.getDay();
  let diff = day - weekday;
  if (diff < 0) diff += 7;
  return new Date(year, month, lastDay.getDate() - diff);
}

function getSecondToLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = getLastWeekdayOfMonth(year, month, weekday);
  return new Date(year, month, last.getDate() - 7);
}

// Fall: Second Monday in September to second Friday in December
export function getFallDates(year: number): { start: Date; end: Date } {
  return {
    start: getNthWeekdayOfMonth(year, 8, 1, 2), // 2nd Monday of September (month 8)
    end: getNthWeekdayOfMonth(year, 11, 5, 2),   // 2nd Friday of December (month 11)
  };
}

// Winter: Second Monday in January to second Monday in April
export function getWinterDates(year: number): { start: Date; end: Date } {
  return {
    start: getNthWeekdayOfMonth(year, 0, 1, 2), // 2nd Monday of January
    end: getNthWeekdayOfMonth(year, 3, 1, 2),   // 2nd Monday of April
  };
}

// Spring/Summer: First Monday in May to first Friday in August (full semester)
export function getSpringSummerDates(year: number, term: SpringSummerTerm = "full"): { start: Date; end: Date } {
  const fullStart = getNthWeekdayOfMonth(year, 4, 1, 1); // 1st Monday of May
  const fullEnd = getNthWeekdayOfMonth(year, 7, 5, 1);   // 1st Friday of August

  if (term === "full") {
    return { start: fullStart, end: fullEnd };
  }

  if (term === "first_half") {
    // First Monday in May to second-to-last Friday in June
    return {
      start: fullStart,
      end: getSecondToLastWeekdayOfMonth(year, 5, 5), // 2nd-to-last Friday of June
    };
  }

  // second_half: Last Monday in June to first Friday in August
  return {
    start: getLastWeekdayOfMonth(year, 5, 1), // Last Monday of June
    end: fullEnd,
  };
}

export function getSemesterDates(type: SemesterType, year: number, springSummerTerm?: SpringSummerTerm): { start: Date; end: Date } {
  switch (type) {
    case "fall":
      return getFallDates(year);
    case "winter":
      return getWinterDates(year);
    case "spring_summer":
      return getSpringSummerDates(year, springSummerTerm || "full");
  }
}

export function parseSemesterLabel(label: string): { type: SemesterType; year: number } | null {
  const match = label.match(/^(Winter|Spring\/Summer|Fall)\s+(\d{4})$/);
  if (!match) return null;
  const typeMap: Record<string, SemesterType> = {
    "Winter": "winter",
    "Spring/Summer": "spring_summer",
    "Fall": "fall",
  };
  return { type: typeMap[match[1]], year: parseInt(match[2]) };
}

export function generateSemesterOptions(startYear: number = 2026, endYear: number = 2029): string[] {
  const options: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    options.push(`Winter ${year}`);
    if (year < endYear) {
      options.push(`Spring/Summer ${year}`);
      options.push(`Fall ${year}`);
    }
  }
  return options;
}

export interface FutureSemesterDates {
  label: string;
  type: SemesterType;
  startDate: string;
  endDate: string;
  breakStart: string;
  breakEnd: string;
  confirmMonth: string;
}

export const FUTURE_SEMESTER_SCHEDULE: FutureSemesterDates[] = [
  { label: "Fall 2026", type: "fall", startDate: "2026-09-14", endDate: "2026-12-07", breakStart: "2026-10-12", breakEnd: "2026-10-16", confirmMonth: "2026-09" },
  { label: "Winter 2027", type: "winter", startDate: "2027-01-11", endDate: "2027-04-09", breakStart: "2027-02-15", breakEnd: "2027-02-19", confirmMonth: "2026-12" },
  { label: "Spring/Summer 2027", type: "spring_summer", startDate: "2027-05-03", endDate: "2027-08-13", breakStart: "2027-06-27", breakEnd: "2027-06-27", confirmMonth: "2027-04" },
  { label: "Fall 2027", type: "fall", startDate: "2027-09-13", endDate: "2027-12-06", breakStart: "2027-10-11", breakEnd: "2027-10-15", confirmMonth: "2027-09" },
  { label: "Winter 2028", type: "winter", startDate: "2028-01-10", endDate: "2028-04-07", breakStart: "2028-02-14", breakEnd: "2028-02-18", confirmMonth: "2027-12" },
  { label: "Spring/Summer 2028", type: "spring_summer", startDate: "2028-05-01", endDate: "2028-08-04", breakStart: "2028-06-17", breakEnd: "2028-06-18", confirmMonth: "2028-04" },
  { label: "Fall 2028", type: "fall", startDate: "2028-09-11", endDate: "2028-12-04", breakStart: "2028-10-09", breakEnd: "2028-10-13", confirmMonth: "2028-09" },
  { label: "Winter 2029", type: "winter", startDate: "2029-01-15", endDate: "2029-04-13", breakStart: "2029-02-12", breakEnd: "2029-02-16", confirmMonth: "2028-12" },
  { label: "Spring/Summer 2029", type: "spring_summer", startDate: "2029-05-07", endDate: "2029-08-10", breakStart: "2029-06-25", breakEnd: "2029-06-25", confirmMonth: "2029-04" },
  { label: "Fall 2029", type: "fall", startDate: "2029-09-10", endDate: "2029-12-07", breakStart: "2029-10-08", breakEnd: "2029-10-12", confirmMonth: "2029-09" },
  { label: "Winter 2030", type: "winter", startDate: "2030-01-14", endDate: "2030-04-12", breakStart: "2030-02-18", breakEnd: "2030-02-22", confirmMonth: "2029-12" },
  { label: "Spring/Summer 2030", type: "spring_summer", startDate: "2030-05-06", endDate: "2030-08-09", breakStart: "2030-06-24", breakEnd: "2030-06-24", confirmMonth: "2030-04" },
  { label: "Fall 2030", type: "fall", startDate: "2030-09-09", endDate: "2030-12-06", breakStart: "2030-10-14", breakEnd: "2030-10-18", confirmMonth: "2030-09" },
  { label: "Winter 2031", type: "winter", startDate: "2031-01-13", endDate: "2031-04-11", breakStart: "2031-02-17", breakEnd: "2031-02-21", confirmMonth: "2030-12" },
];

// Convert ('winter', 2029) → 'w2029', ('spring_summer', 2029) → 'ss2029', ('fall', 2029) → 'f2029'
export function semKeyFromTypeYear(type: SemesterType, year: number): string {
  const prefix = type === 'winter' ? 'w' : type === 'fall' ? 'f' : 'ss';
  return `${prefix}${year}`;
}

// Inverse: 'w2029' → { type: 'winter', year: 2029 }
export function parseSemKey(key: string): { type: SemesterType; year: number } | null {
  const m = key.match(/^(ss|f|w)(\d{4})$/);
  if (!m) return null;
  const type: SemesterType = m[1] === 'w' ? 'winter' : m[1] === 'f' ? 'fall' : 'spring_summer';
  return { type, year: parseInt(m[2]) };
}

// Get the next semester chronologically after the given key. Returns FUTURE_SEMESTER_SCHEDULE
// entry if available, else computes one via getSemesterDates.
export function getNextSemesterAfter(currentKey: string): FutureSemesterDates | null {
  const parsed = parseSemKey(currentKey);
  if (!parsed) return null;
  // Order within a year: winter → spring_summer → fall → winter (next year)
  let nextType: SemesterType;
  let nextYear = parsed.year;
  if (parsed.type === 'winter') nextType = 'spring_summer';
  else if (parsed.type === 'spring_summer') nextType = 'fall';
  else { nextType = 'winter'; nextYear = parsed.year + 1; }
  const nextKey = semKeyFromTypeYear(nextType, nextYear);
  // Try schedule first
  const labelMap: Record<SemesterType, string> = { winter: 'Winter', spring_summer: 'Spring/Summer', fall: 'Fall' };
  const label = `${labelMap[nextType]} ${nextYear}`;
  const fromSched = FUTURE_SEMESTER_SCHEDULE.find(s => s.label === label);
  if (fromSched) return fromSched;
  // Compute fresh
  const dates = getSemesterDates(nextType, nextYear);
  return {
    label,
    type: nextType,
    startDate: formatDate(dates.start),
    endDate: formatDate(dates.end),
    breakStart: formatDate(dates.start),
    breakEnd: formatDate(dates.start),
    confirmMonth: '',
  };
}

export function getUpcomingSemesterToConfirm(): FutureSemesterDates | null {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return FUTURE_SEMESTER_SCHEDULE.find(s => s.confirmMonth === currentYM) || null;
}

export function getNextSemesterByStartDate(): FutureSemesterDates | null {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return FUTURE_SEMESTER_SCHEDULE.find(s => s.startDate === todayStr) || null;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function dayOfWeekToNumber(day: string): number {
  const map: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  return map[day.toLowerCase()] ?? 1;
}
