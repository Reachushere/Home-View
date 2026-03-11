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
    options.push(`Spring/Summer ${year}`);
    options.push(`Fall ${year}`);
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
];

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
