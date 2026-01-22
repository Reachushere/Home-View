// Google Calendar Integration - Replit Connector
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Create a calendar event from a task
export async function createCalendarEvent(task: {
  id: number;
  title: string;
  description?: string | null;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const dueDate = new Date(task.dueDate);
  const hour = dueDate.getHours();
  
  // Check if this is an all-day task (midnight or 11 PM)
  const isAllDay = hour === 0 || hour === 23;
  
  const summary = `${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`;
  
  let event: any;
  
  if (isAllDay) {
    // All-day event uses date (not dateTime)
    const dateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    // Google Calendar uses exclusive end date, so add 1 day for single-day events
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateStr = nextDay.toISOString().split('T')[0];
    event = {
      summary,
      description: task.description || '',
      start: {
        date: dateStr,
      },
      end: {
        date: endDateStr,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 * 24 * 2 }, // 2 days before
          { method: 'popup', minutes: 60 * 24 },     // 1 day before
        ],
      },
    };
  } else {
    // Timed event
    const startTime = dueDate.toISOString();
    const endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
    event = {
      summary,
      description: task.description || '',
      start: {
        dateTime: startTime,
        timeZone: 'America/Toronto',
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/Toronto',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 * 24 * 2 }, // 2 days before
          { method: 'popup', minutes: 60 * 24 },     // 1 day before
          { method: 'popup', minutes: 60 * 2 },      // 2 hours before
          { method: 'popup', minutes: 30 },          // 30 minutes before
        ],
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data;
}

// Create event in a specific calendar (for secondary calendar sync)
export async function createEventInCalendar(calendarId: string, task: {
  id: number;
  title: string;
  description?: string | null;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const dueDate = new Date(task.dueDate);
  const hour = dueDate.getHours();
  const isAllDay = hour === 0 || hour === 23;
  
  const summary = `${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`;
  
  let event: any;
  
  if (isAllDay) {
    const dateStr = dueDate.toISOString().split('T')[0];
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateStr = nextDay.toISOString().split('T')[0];
    
    event = {
      summary,
      description: task.description || '',
      start: { date: dateStr },
      end: { date: endDateStr },
    };
  } else {
    const startTime = dueDate.toISOString();
    const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);
    const endTime = endDate.toISOString();
    
    event = {
      summary,
      description: task.description || '',
      start: { dateTime: startTime, timeZone: 'America/Los_Angeles' },
      end: { dateTime: endTime, timeZone: 'America/Los_Angeles' },
    };
  }

  const response = await calendar.events.insert({
    calendarId: calendarId,
    requestBody: event,
  });

  return response.data;
}

// Delete event from a specific calendar
export async function deleteEventFromCalendar(calendarId: string, eventId: string) {
  const calendar = await getGoogleCalendarClient();
  
  await calendar.events.delete({
    calendarId: calendarId,
    eventId: eventId,
  });
}

// Delete a calendar event
export async function deleteCalendarEvent(eventId: string) {
  const calendar = await getGoogleCalendarClient();
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

// Helper to check if a date should be treated as all-day
function isAllDayEvent(date: Date): boolean {
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();
  // All-day if at midnight (00:00) or near end of day (23:00+)
  return utcHour === 0 || utcHour >= 23;
}

// Update a calendar event (deletes and recreates if switching between all-day/timed)
export async function updateCalendarEvent(eventId: string, task: {
  title: string;
  description?: string | null;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const dueDate = new Date(task.dueDate);
  const isAllDay = isAllDayEvent(dueDate);
  
  const summary = `${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`;
  
  // First, try to get the existing event to check its type
  let existingEvent;
  try {
    existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
  } catch (err) {
    console.log(`Existing event ${eventId} not found, will create new`);
    existingEvent = null;
  }
  
  const existingIsAllDay = !!(existingEvent?.data?.start?.date && !existingEvent?.data?.start?.dateTime);
  
  // If switching between all-day and timed, delete and recreate
  if (existingEvent && existingIsAllDay !== isAllDay) {
    console.log(`Switching event type: was all-day=${existingIsAllDay}, now all-day=${isAllDay}`);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    // Create new event with correct type
    let event: any;
    if (isAllDay) {
      const dateStr = dueDate.toISOString().split('T')[0];
      const nextDay = new Date(dueDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const endDateStr = nextDay.toISOString().split('T')[0];
      event = {
        summary,
        description: task.description || '',
        start: { date: dateStr },
        end: { date: endDateStr },
        reminders: { useDefault: false, overrides: [] },
      };
    } else {
      const startTime = dueDate.toISOString();
      const endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
      event = {
        summary,
        description: task.description || '',
        start: { dateTime: startTime, timeZone: 'America/Toronto' },
        end: { dateTime: endTime, timeZone: 'America/Toronto' },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 720 },
            { method: 'popup', minutes: 360 },
            { method: 'popup', minutes: 120 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };
    }
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    return response.data;
  }
  
  // Same type, just update in place
  let event: any;
  if (isAllDay) {
    const dateStr = dueDate.toISOString().split('T')[0];
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateStr = nextDay.toISOString().split('T')[0];
    event = {
      summary,
      description: task.description || '',
      start: { date: dateStr },
      end: { date: endDateStr },
    };
  } else {
    const startTime = dueDate.toISOString();
    const endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
    event = {
      summary,
      description: task.description || '',
      start: { dateTime: startTime, timeZone: 'America/Toronto' },
      end: { dateTime: endTime, timeZone: 'America/Toronto' },
    };
  }

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: event,
  });

  return response.data;
}

// Create a prep/planning event for when to start working on a task
export async function createPrepCalendarEvent(task: {
  id: number;
  title: string;
  description?: string | null;
  startDate: Date | string;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const startDate = new Date(task.startDate);
  const dueDate = new Date(task.dueDate);
  const isAllDay = isAllDayEvent(startDate);
  
  const summary = `[PREP] ${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`;
  const description = `Start preparing for: ${task.title}\nDue: ${dueDate.toLocaleDateString()}\n\n${task.description || ''}`;
  
  let event: any;
  
  if (isAllDay) {
    const dateStr = startDate.toISOString().split('T')[0];
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateStr = nextDay.toISOString().split('T')[0];
    event = {
      summary,
      description,
      start: { date: dateStr },
      end: { date: endDateStr },
      reminders: { useDefault: false, overrides: [] },
    };
  } else {
    const startTime = startDate.toISOString();
    const endTime = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
    event = {
      summary,
      description,
      start: { dateTime: startTime, timeZone: 'America/Toronto' },
      end: { dateTime: endTime, timeZone: 'America/Toronto' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data;
}

// Update a prep/planning event
export async function updatePrepCalendarEvent(eventId: string, task: {
  title: string;
  description?: string | null;
  startDate: Date | string;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const startDate = new Date(task.startDate);
  const dueDate = new Date(task.dueDate);
  const isAllDay = isAllDayEvent(startDate);
  
  const summary = `[PREP] ${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`;
  const description = `Start preparing for: ${task.title}\nDue: ${dueDate.toLocaleDateString()}\n\n${task.description || ''}`;
  
  // Check if we need to delete and recreate (type change)
  let existingEvent;
  try {
    existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
  } catch (err) {
    existingEvent = null;
  }
  
  const existingIsAllDay = !!(existingEvent?.data?.start?.date && !existingEvent?.data?.start?.dateTime);
  
  if (existingEvent && existingIsAllDay !== isAllDay) {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    let event: any;
    if (isAllDay) {
      const dateStr = startDate.toISOString().split('T')[0];
      const nextDay = new Date(startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const endDateStr = nextDay.toISOString().split('T')[0];
      event = {
        summary,
        description,
        start: { date: dateStr },
        end: { date: endDateStr },
        reminders: { useDefault: false, overrides: [] },
      };
    } else {
      const startTime = startDate.toISOString();
      const endTime = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
      event = {
        summary,
        description,
        start: { dateTime: startTime, timeZone: 'America/Toronto' },
        end: { dateTime: endTime, timeZone: 'America/Toronto' },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 30 }],
        },
      };
    }
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    return response.data;
  }
  
  let event: any;
  if (isAllDay) {
    const dateStr = startDate.toISOString().split('T')[0];
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateStr = nextDay.toISOString().split('T')[0];
    event = {
      summary,
      description,
      start: { date: dateStr },
      end: { date: endDateStr },
    };
  } else {
    const startTime = startDate.toISOString();
    const endTime = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
    event = {
      summary,
      description,
      start: { dateTime: startTime, timeZone: 'America/Toronto' },
      end: { dateTime: endTime, timeZone: 'America/Toronto' },
    };
  }

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: event,
  });

  return response.data;
}

// List calendars
export async function listCalendars() {
  const calendar = await getGoogleCalendarClient();
  
  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

// List events in a date range
export async function listEvents(timeMin: Date, timeMax: Date) {
  const calendar = await getGoogleCalendarClient();
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  
  return response.data.items || [];
}
