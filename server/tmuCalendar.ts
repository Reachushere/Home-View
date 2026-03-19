process.env.TZ = 'America/Toronto';

interface ICSEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtstart: string;
  dtend: string;
  isAllDay: boolean;
  rrule?: string;
  recurrenceId?: string;
}

interface FormattedTMUEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  source: 'tmu';
}

let cachedRawEvents: ICSEvent[] = [];
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;

function unfoldICS(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\r/g, '');
}

function unescapeICS(val: string): string {
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseICSDate(val: string, propLine: string): { date: Date; isAllDay: boolean } {
  const tzMatch = propLine.match(/TZID=([^:;]+)/);
  const cleanVal = val.replace(/[^\dTZ]/g, '');

  if (cleanVal.length === 8) {
    const y = parseInt(cleanVal.substring(0, 4));
    const m = parseInt(cleanVal.substring(4, 6)) - 1;
    const d = parseInt(cleanVal.substring(6, 8));
    return { date: new Date(y, m, d), isAllDay: true };
  }

  const y = parseInt(cleanVal.substring(0, 4));
  const mo = parseInt(cleanVal.substring(4, 6)) - 1;
  const d = parseInt(cleanVal.substring(6, 8));
  const h = parseInt(cleanVal.substring(9, 11)) || 0;
  const mi = parseInt(cleanVal.substring(11, 13)) || 0;
  const s = parseInt(cleanVal.substring(13, 15)) || 0;

  if (cleanVal.endsWith('Z')) {
    return { date: new Date(Date.UTC(y, mo, d, h, mi, s)), isAllDay: false };
  }

  return { date: new Date(y, mo, d, h, mi, s), isAllDay: false };
}

function parseICSFeed(icsText: string): ICSEvent[] {
  const unfolded = unfoldICS(icsText);
  const lines = unfolded.split('\n');
  const events: ICSEvent[] = [];
  let currentEvent: Partial<ICSEvent> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.dtstart) {
        events.push({
          uid: currentEvent.uid || '',
          summary: currentEvent.summary || 'Untitled',
          description: currentEvent.description || '',
          location: currentEvent.location || '',
          dtstart: currentEvent.dtstart || '',
          dtend: currentEvent.dtend || currentEvent.dtstart || '',
          isAllDay: currentEvent.isAllDay || false,
          rrule: currentEvent.rrule,
          recurrenceId: currentEvent.recurrenceId,
        });
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 0) continue;

    const propPart = trimmed.substring(0, colonIdx);
    const valPart = trimmed.substring(colonIdx + 1);
    const propName = propPart.split(';')[0].toUpperCase();

    switch (propName) {
      case 'UID':
        currentEvent.uid = valPart;
        break;
      case 'SUMMARY':
        currentEvent.summary = unescapeICS(valPart);
        break;
      case 'DESCRIPTION':
        currentEvent.description = unescapeICS(valPart);
        break;
      case 'LOCATION':
        currentEvent.location = unescapeICS(valPart);
        break;
      case 'DTSTART': {
        const parsed = parseICSDate(valPart, propPart);
        currentEvent.dtstart = parsed.date.toISOString();
        currentEvent.isAllDay = parsed.isAllDay;
        break;
      }
      case 'DTEND': {
        const parsed = parseICSDate(valPart, propPart);
        currentEvent.dtend = parsed.date.toISOString();
        break;
      }
      case 'RRULE':
        currentEvent.rrule = valPart;
        break;
      case 'RECURRENCE-ID': {
        const parsed = parseICSDate(valPart, propPart);
        currentEvent.recurrenceId = parsed.date.toISOString();
        break;
      }
    }
  }

  return events;
}

function expandRecurringEvents(events: ICSEvent[], rangeStart: Date, rangeEnd: Date): ICSEvent[] {
  const overrides = new Map<string, Set<string>>();
  for (const ev of events) {
    if (ev.recurrenceId && ev.uid) {
      if (!overrides.has(ev.uid)) overrides.set(ev.uid, new Set());
      overrides.get(ev.uid)!.add(ev.recurrenceId);
    }
  }

  const result: ICSEvent[] = [];

  for (const ev of events) {
    if (ev.recurrenceId) {
      const evStart = new Date(ev.dtstart);
      if (evStart >= rangeStart && evStart <= rangeEnd) {
        result.push(ev);
      }
      continue;
    }

    if (!ev.rrule) {
      const evStart = new Date(ev.dtstart);
      if (evStart >= rangeStart && evStart <= rangeEnd) {
        result.push(ev);
      }
      continue;
    }

    const ruleMap: Record<string, string> = {};
    for (const part of ev.rrule.split(';')) {
      const [k, v] = part.split('=');
      if (k && v) ruleMap[k.toUpperCase()] = v;
    }

    if (ruleMap['FREQ'] !== 'WEEKLY') {
      const evStart = new Date(ev.dtstart);
      if (evStart >= rangeStart && evStart <= rangeEnd) {
        result.push(ev);
      }
      continue;
    }

    const baseStart = new Date(ev.dtstart);
    const baseEnd = new Date(ev.dtend);
    const durationMs = baseEnd.getTime() - baseStart.getTime();

    const untilStr = ruleMap['UNTIL'];
    let until = new Date(rangeEnd);
    if (untilStr) {
      const parsed = parseICSDate(untilStr, 'DTSTART');
      until = parsed.date;
    }
    const count = ruleMap['COUNT'] ? parseInt(ruleMap['COUNT']) : undefined;
    const interval = ruleMap['INTERVAL'] ? parseInt(ruleMap['INTERVAL']) : 1;
    const uidOverrides = overrides.get(ev.uid);

    let occurrences = 0;
    const maxDate = until < rangeEnd ? until : rangeEnd;
    const cursor = new Date(baseStart);

    while (cursor <= maxDate) {
      if (count && occurrences >= count) break;

      if (cursor >= rangeStart) {
        const isoStart = cursor.toISOString();
        if (!uidOverrides?.has(isoStart)) {
          result.push({
            ...ev,
            dtstart: isoStart,
            dtend: new Date(cursor.getTime() + durationMs).toISOString(),
            uid: `${ev.uid}_${isoStart}`,
          });
        }
      }

      cursor.setDate(cursor.getDate() + 7 * interval);
      occurrences++;

      if (occurrences > 200) break;
    }
  }

  return result;
}

function formatEvents(events: ICSEvent[]): FormattedTMUEvent[] {
  return events.map(ev => ({
    id: `tmu-${ev.uid}`,
    title: ev.summary,
    description: ev.description,
    location: ev.location,
    startDate: ev.dtstart,
    endDate: ev.dtend,
    isAllDay: ev.isAllDay,
    source: 'tmu' as const,
  }));
}

export async function fetchTMUCalendarEvents(rangeStart: Date, rangeEnd: Date): Promise<FormattedTMUEvent[]> {
  const icalUrl = process.env.TMU_ICAL_URL;
  if (!icalUrl) {
    return [];
  }

  const now = Date.now();
  const needsFetch = now - lastFetchTime >= CACHE_DURATION_MS || cachedRawEvents.length === 0;

  if (needsFetch) {
    try {
      const response = await fetch(icalUrl);
      if (!response.ok) {
        console.error(`[TMU Calendar] Failed to fetch ICS feed: ${response.status}`);
      } else {
        const icsText = await response.text();
        cachedRawEvents = parseICSFeed(icsText);
        lastFetchTime = now;
        console.log(`[TMU Calendar] Parsed ${cachedRawEvents.length} events from ICS feed`);
      }
    } catch (err: any) {
      console.error(`[TMU Calendar] Error fetching ICS feed: ${err.message}`);
    }
  }

  const expanded = expandRecurringEvents(cachedRawEvents, rangeStart, rangeEnd);
  return formatEvents(expanded);
}

export function clearTMUCalendarCache(): void {
  cachedRawEvents = [];
  lastFetchTime = 0;
}
