import { getOneDriveClient } from './onedrive';
import { storage } from './storage';

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
  const client = await getOneDriveClient();

  const now = new Date();
  const startDateTime = now.toISOString();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);
  const endDateTime = end.toISOString();

  try {
    const response = await client
      .api('/me/calendarview')
      .query({
        startDateTime,
        endDateTime,
        $orderby: 'start/dateTime',
        $top: 100,
        $select: 'id,subject,bodyPreview,start,end,location,organizer,isAllDay,isCancelled',
      })
      .get();

    return (response.value || []).filter((ev: any) => !ev.isCancelled);
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
