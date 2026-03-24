import { Client } from '@microsoft/microsoft-graph-client';
import { storage } from './storage';

// Outlook connector - uses dedicated Outlook integration with Calendar permissions
let outlookConnectionSettings: any;

async function getOutlookAccessToken() {
  if (outlookConnectionSettings && outlookConnectionSettings.settings.expires_at && new Date(outlookConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return outlookConnectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  outlookConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = outlookConnectionSettings?.settings?.access_token || outlookConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!outlookConnectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

async function getOutlookClient() {
  const accessToken = await getOutlookAccessToken();
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export interface OutlookEvent {
  id: string;
  subject: string;
  bodyPreview: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  isAllDay?: boolean;
  isCancelled?: boolean;
}

export async function fetchOutlookCalendarEvents(daysAhead: number = 14): Promise<OutlookEvent[]> {
  const client = await getOutlookClient();

  const now = new Date();
  const startDateTime = now.toISOString();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);
  const endDateTime = end.toISOString();

  try {
    const calendarsResponse = await client.api('/me/calendars').select('id,name').get();
    const calendars = calendarsResponse.value || [];
    console.log(`[Outlook Calendar] Found ${calendars.length} calendars: ${calendars.map((c: any) => c.name).join(', ')}`);

    const allEvents: OutlookEvent[] = [];

    for (const cal of calendars) {
      try {
        const response = await client
          .api(`/me/calendars/${cal.id}/calendarview`)
          .query({
            startDateTime,
            endDateTime,
            $orderby: 'start/dateTime',
            $top: 100,
            $select: 'id,subject,bodyPreview,start,end,location,organizer,isAllDay,isCancelled',
          })
          .get();

        const events = (response.value || []).filter((ev: any) => !ev.isCancelled);
        console.log(`[Outlook Calendar] "${cal.name}": ${events.length} events`);
        allEvents.push(...events);
      } catch (calError: any) {
        console.error(`[Outlook Calendar] Error fetching from "${cal.name}":`, calError.message || calError);
      }
    }

    allEvents.sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
    return allEvents;
  } catch (error: any) {
    console.error('[Outlook Calendar] Error fetching events:', error.message || error);
    throw error;
  }
}

export async function syncOutlookEventsToReview(): Promise<{ added: number; skipped: number }> {
  const events = await fetchOutlookCalendarEvents(30);
  let added = 0;
  let skipped = 0;

  for (const event of events) {
    const existing = await storage.getPendingReviewItemByExternalId(event.id, 'outlook_calendar');
    if (existing) {
      skipped++;
      continue;
    }

    const startDt = new Date(event.start.dateTime + (event.start.timeZone === 'UTC' ? 'Z' : ''));
    const endDt = new Date(event.end.dateTime + (event.end.timeZone === 'UTC' ? 'Z' : ''));

    const startTime = event.isAllDay ? null : `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`;
    const endTime = event.isAllDay ? null : `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`;

    await storage.createPendingReviewItem({
      source: 'outlook_calendar',
      sourceEmail: event.organizer?.emailAddress?.address || null,
      externalId: event.id,
      title: event.subject || 'Untitled Event',
      description: event.bodyPreview || null,
      startDate: startDt,
      endDate: endDt,
      eventStartTime: startTime,
      eventEndTime: endTime,
      location: event.location?.displayName || null,
      rawData: JSON.stringify(event),
      status: 'pending',
      courseName: null,
      taskType: 'meeting',
    });
    added++;
  }

  console.log(`[Outlook Calendar] Synced: ${added} added, ${skipped} skipped (already exists)`);
  return { added, skipped };
}
