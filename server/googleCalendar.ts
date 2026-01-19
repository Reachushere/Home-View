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
  
  // Create event at the due time, 1 hour duration
  const startTime = dueDate.toISOString();
  const endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
  
  const event = {
    summary: `${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`,
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

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data;
}

// Delete a calendar event
export async function deleteCalendarEvent(eventId: string) {
  const calendar = await getGoogleCalendarClient();
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

// Update a calendar event
export async function updateCalendarEvent(eventId: string, task: {
  title: string;
  description?: string | null;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const dueDate = new Date(task.dueDate);
  const startTime = dueDate.toISOString();
  const endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
  
  const event = {
    summary: `${task.courseName ? `[${task.courseName}] ` : ''}${task.title}`,
    description: task.description || '',
    start: {
      dateTime: startTime,
      timeZone: 'America/Toronto',
    },
    end: {
      dateTime: endTime,
      timeZone: 'America/Toronto',
    },
  };

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
