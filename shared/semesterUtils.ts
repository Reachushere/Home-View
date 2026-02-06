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
