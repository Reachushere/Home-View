import { google } from 'googleapis';
import { storage } from './storage';
import type { ThirdGoogleAccount } from '@shared/schema';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_SECOND_ACCOUNT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured for third account');
  }
  
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
  const redirectUri = domain 
    ? `https://${domain}/api/google/third-account/callback`
    : 'http://localhost:5000/api/google/third-account/callback';
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getThirdAccountAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokensThird(code: string): Promise<ThirdGoogleAccount> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get required tokens from Google');
  }
  
  oauth2Client.setCredentials(tokens);
  
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email || 'unknown';
  
  const expiresAt = tokens.expiry_date 
    ? new Date(tokens.expiry_date) 
    : new Date(Date.now() + 3600 * 1000);
  
  const account = await storage.saveThirdGoogleAccount({
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  });
  
  return account;
}

async function getValidAccessToken(account: ThirdGoogleAccount): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(account.expiresAt);
  const bufferMs = 5 * 60 * 1000;
  
  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return account.accessToken;
  }
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: account.refreshToken,
  });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }
  
  const newExpiresAt = credentials.expiry_date 
    ? new Date(credentials.expiry_date) 
    : new Date(Date.now() + 3600 * 1000);
  
  await storage.updateThirdGoogleAccount(account.id, {
    accessToken: credentials.access_token,
    expiresAt: newExpiresAt,
  });
  
  return credentials.access_token;
}

export async function getThirdAccountCalendarClient() {
  const account = await storage.getThirdGoogleAccount();
  
  if (!account) {
    throw new Error('Third Google account (CRCU) not connected');
  }
  
  const accessToken = await getValidAccessToken(account);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function isThirdAccountConnected(): Promise<{ connected: boolean; email?: string }> {
  try {
    const account = await storage.getThirdGoogleAccount();
    if (account) {
      return { connected: true, email: account.email };
    }
    return { connected: false };
  } catch {
    return { connected: false };
  }
}

export async function disconnectThirdAccount(): Promise<void> {
  await storage.deleteThirdGoogleAccount();
}

export async function getEventsFromThirdAccount(timeMin: Date, timeMax: Date) {
  try {
    const calendar = await getThirdAccountCalendarClient();
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching events from third account (CRCU):', error);
    return [];
  }
}

export async function listThirdAccountCalendars() {
  try {
    const calendar = await getThirdAccountCalendarClient();
    const response = await calendar.calendarList.list();
    return response.data.items || [];
  } catch (error) {
    console.error('Error listing third account calendars:', error);
    return [];
  }
}

export async function getEventsFromThirdAccountCalendar(calendarId: string, timeMin: Date, timeMax: Date) {
  try {
    const calendar = await getThirdAccountCalendarClient();
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching events from third account calendar:', error);
    return [];
  }
}
