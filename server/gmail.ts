// Gmail integration for D2L announcement emails
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
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

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

const D2L_SENDER = 'NotificationEmail@toronto-mu.brightspace.com';

export interface D2LAnnouncement {
  id: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  courseName: string;
  read: boolean;
}

function extractCourseName(subject: string): string {
  const match = subject.match(/\[([^\]]+)\]/);
  if (match) return match[1].trim();
  const dashMatch = subject.match(/^([A-Z]{3,4}\s?\d{3})/i);
  if (dashMatch) return dashMatch[1];
  return 'University';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fetchD2LAnnouncements(maxResults: number = 20): Promise<D2LAnnouncement[]> {
  try {
    const gmail = await getGmailClient();

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `from:${D2L_SENDER}`,
      maxResults,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) return [];

    const announcements: D2LAnnouncement[] = [];

    for (const msg of messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || 'No Subject';
        const dateStr = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
        const isRead = !detail.data.labelIds?.includes('UNREAD');

        let bodyText = '';
        const payload = detail.data.payload;

        if (payload?.body?.data) {
          bodyText = decodeBase64Url(payload.body.data);
        } else if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText = decodeBase64Url(part.body.data);
              break;
            }
            if (part.mimeType === 'text/html' && part.body?.data) {
              bodyText = stripHtml(decodeBase64Url(part.body.data));
            }
          }
        }

        const cleanSubject = subject
          .replace(/^Fwd:\s*/i, '')
          .replace(/^Fw:\s*/i, '')
          .trim();

        announcements.push({
          id: msg.id!,
          subject: cleanSubject,
          snippet: detail.data.snippet || '',
          body: bodyText.slice(0, 500),
          date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          courseName: extractCourseName(cleanSubject),
          read: isRead,
        });
      } catch (e: any) {
        console.error(`[Gmail] Failed to fetch message ${msg.id}:`, e.message);
      }
    }

    announcements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return announcements;
  } catch (err: any) {
    console.error('[Gmail] Error fetching D2L announcements:', err.message);
    throw err;
  }
}
