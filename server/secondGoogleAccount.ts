// Second Google Account OAuth Integration
import { google } from 'googleapis';
import { storage } from './storage';
import type { SecondGoogleAccount } from '@shared/schema';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_SECOND_ACCOUNT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured for second account');
  }
  
  // Determine the correct redirect URI based on environment
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
  const redirectUri = domain 
    ? `https://${domain}/api/google/second-account/callback`
    : 'http://localhost:5000/api/google/second-account/callback';
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Generate OAuth URL for second account login
export function getSecondAccountAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<SecondGoogleAccount> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get required tokens from Google');
  }
  
  oauth2Client.setCredentials(tokens);
  
  // Get user email
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email || 'unknown';
  
  // Calculate expiry time
  const expiresAt = tokens.expiry_date 
    ? new Date(tokens.expiry_date) 
    : new Date(Date.now() + 3600 * 1000); // Default 1 hour
  
  // Save to database
  const account = await storage.saveSecondGoogleAccount({
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  });
  
  return account;
}

// Get a valid access token, refreshing if needed
async function getValidAccessToken(account: SecondGoogleAccount): Promise<string> {
  // Check if token is still valid (with 5 min buffer)
  const now = new Date();
  const expiresAt = new Date(account.expiresAt);
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  
  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return account.accessToken;
  }
  
  // Token expired or expiring soon, refresh it
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: account.refreshToken,
  });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }
  
  // Update stored token
  const newExpiresAt = credentials.expiry_date 
    ? new Date(credentials.expiry_date) 
    : new Date(Date.now() + 3600 * 1000);
  
  await storage.updateSecondGoogleAccount(account.id, {
    accessToken: credentials.access_token,
    expiresAt: newExpiresAt,
  });
  
  return credentials.access_token;
}

// Get Google Calendar client for second account
export async function getSecondAccountCalendarClient() {
  const account = await storage.getSecondGoogleAccount();
  
  if (!account) {
    throw new Error('Second Google account not connected');
  }
  
  const accessToken = await getValidAccessToken(account);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Check if second account is connected
export async function isSecondAccountConnected(): Promise<{ connected: boolean; email?: string }> {
  try {
    const account = await storage.getSecondGoogleAccount();
    if (account) {
      return { connected: true, email: account.email };
    }
    return { connected: false };
  } catch {
    return { connected: false };
  }
}

// Disconnect second account
export async function disconnectSecondAccount(): Promise<void> {
  await storage.deleteSecondGoogleAccount();
}

// Create event in second account's primary calendar
export async function createEventInSecondAccount(task: {
  id: number;
  title: string;
  description?: string | null;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getSecondAccountCalendarClient();
  
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
          { method: 'popup', minutes: 60 * 24 * 2 },
          { method: 'popup', minutes: 60 * 24 },
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

// Create prep event in second account
export async function createPrepEventInSecondAccount(task: {
  id: number;
  title: string;
  description?: string | null;
  startDate: Date | string;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getSecondAccountCalendarClient();
  
  const startDate = new Date(task.startDate);
  const dueDate = new Date(task.dueDate);
  const hour = startDate.getHours();
  const isAllDay = hour === 0 || hour === 23;
  
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
          { method: 'popup', minutes: 60 * 24 },
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

// Delete event from second account
export async function deleteEventFromSecondAccount(eventId: string): Promise<void> {
  const calendar = await getSecondAccountCalendarClient();
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

// Update event in second account
export async function updateEventInSecondAccount(eventId: string, task: {
  title: string;
  description?: string | null;
  dueDate: Date | string;
  courseName?: string | null;
}) {
  const calendar = await getSecondAccountCalendarClient();
  
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

// Get events from second account (for conflict detection)
export async function getEventsFromSecondAccount(timeMin: Date, timeMax: Date) {
  try {
    const calendar = await getSecondAccountCalendarClient();
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching events from second account:', error);
    return [];
  }
}
