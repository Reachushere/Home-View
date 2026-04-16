// Gmail integration for D2L announcement emails
// Uses direct REST API calls with the connected Gmail access token
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;
let gmailCachedAT: string | null = null;
let gmailCachedExp = 0;

function loadGoogleTokens() {
  try {
    const p = path.join(process.cwd(), '.google_tokens.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return null;
}

function saveGoogleTokens(t: any) {
  try { fs.writeFileSync(path.join(process.cwd(), '.google_tokens.json'), JSON.stringify(t, null, 2)); } catch {}
}

async function refreshGoogleToken(rt: string) {
  const clientId = process.env.GOOGLE_SECOND_ACCOUNT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured');
  const p = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: rt });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
  if (!r.ok) throw new Error('Gmail token refresh failed: ' + await r.text());
  return r.json();
}

export async function getGmailAccessToken(): Promise<string> {
  return getAccessToken();
}

async function getAccessToken(): Promise<string> {
  if (gmailCachedAT && gmailCachedExp > Date.now() + 60000) return gmailCachedAT;

  const stored = loadGoogleTokens();
  if (stored && stored.refresh_token) {
    try {
      const r = await refreshGoogleToken(stored.refresh_token);
      const ea = Date.now() + (r.expires_in || 3600) * 1000;
      gmailCachedAT = r.access_token;
      gmailCachedExp = ea;
      saveGoogleTokens({ refresh_token: r.refresh_token || stored.refresh_token, access_token: r.access_token, expires_at: ea });
      return r.access_token;
    } catch (e) {
      console.error('[Gmail] Refresh failed:', e);
    }
  }

  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Gmail not connected — authenticate via /api/google/primary-calendar/auth (shares Google tokens)');
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

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
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

async function gmailGet(endpoint: string): Promise<any> {
  const token = await getAccessToken();
  const resp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gmail API error ${resp.status}: ${errBody}`);
  }
  return resp.json();
}

export async function sendGmail(params: { to: string; subject: string; htmlBody: string; textBody?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const boundary = 'boundary_' + Date.now();
    const mimeLines = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      '',
      params.textBody || params.htmlBody.replace(/<[^>]+>/g, ''),
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      '',
      params.htmlBody,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const raw = Buffer.from(mimeLines).toString('base64url');

    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[Gmail] Send error:', errBody);
      return { success: false, error: `Gmail API error ${resp.status}: ${errBody}` };
    }

    const data = await resp.json();
    console.log('[Gmail] Email sent successfully, id:', data.id);
    return { success: true };
  } catch (err: any) {
    console.error('[Gmail] Send error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendGmailWithAttachment(params: { to: string; subject: string; htmlBody: string; attachments: Array<{ filename: string; content: Buffer; mimeType: string }> }): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const boundary = 'boundary_att_' + Date.now();
    const mimeLines = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      '',
      params.htmlBody,
    ];

    for (const att of params.attachments) {
      mimeLines.push('', `--${boundary}`);
      mimeLines.push(`Content-Type: ${att.mimeType}`);
      mimeLines.push(`Content-Transfer-Encoding: base64`);
      mimeLines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      mimeLines.push('');
      mimeLines.push(att.content.toString('base64'));
    }

    mimeLines.push('', `--${boundary}--`);

    const raw = Buffer.from(mimeLines.join('\r\n')).toString('base64url');

    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[Gmail] Send with attachment error:', errBody);
      return { success: false, error: `Gmail API error ${resp.status}: ${errBody}` };
    }

    const data = await resp.json() as any;
    console.log('[Gmail] Email with attachment sent, id:', data.id);
    return { success: true };
  } catch (err: any) {
    console.error('[Gmail] Send with attachment error:', err.message);
    return { success: false, error: err.message };
  }
}

export interface RecentEmail {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  fromName: string;
  date: string;
  read: boolean;
  labels: string[];
}

export async function fetchRecentEmails(maxResults: number = 10, query?: string): Promise<RecentEmail[]> {
  try {
    const q = query ? encodeURIComponent(query) : '';
    const endpoint = q ? `messages?q=${q}&maxResults=${maxResults}` : `messages?maxResults=${maxResults}`;
    const listData = await gmailGet(endpoint);

    const messages = listData.messages || [];
    if (messages.length === 0) return [];

    const emails: RecentEmail[] = [];

    for (const msg of messages) {
      try {
        const detail = await gmailGet(`messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);

        const headers = detail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || 'No Subject';
        const fromRaw = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
        const dateStr = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';
        const isRead = !detail.labelIds?.includes('UNREAD');

        let fromName = fromRaw;
        const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
        if (nameMatch) fromName = nameMatch[1].trim();

        let fromEmail = fromRaw;
        const emailMatch = fromRaw.match(/<([^>]+)>/);
        if (emailMatch) fromEmail = emailMatch[1];

        emails.push({
          id: msg.id,
          subject,
          snippet: detail.snippet || '',
          from: fromEmail,
          fromName,
          date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          read: isRead,
          labels: detail.labelIds || [],
        });
      } catch (e: any) {
        console.error(`[Gmail] Failed to fetch email ${msg.id}:`, e.message);
      }
    }

    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return emails;
  } catch (err: any) {
    console.error('[Gmail] Error fetching recent emails:', err.message);
    throw err;
  }
}

async function gmailGetWithToken(endpoint: string, token: string): Promise<any> {
  const resp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gmail API error ${resp.status}: ${errBody}`);
  }
  return resp.json();
}

export async function fetchD2LAnnouncements(maxResults: number = 20): Promise<D2LAnnouncement[]> {
  try {
    let useSecondAccount = false;
    let secondToken: string | null = null;
    try {
      const { getSecondAccountGmailAccessToken } = await import('./secondGoogleAccount');
      secondToken = await getSecondAccountGmailAccessToken();
      useSecondAccount = true;
    } catch (e: any) {
      console.log('[D2L] Second account not available, falling back to primary Gmail:', e.message);
    }

    const query = encodeURIComponent(`from:${D2L_SENDER}`);
    const fetcher = useSecondAccount && secondToken
      ? (ep: string) => gmailGetWithToken(ep, secondToken!)
      : gmailGet;
    const listData = await fetcher(`messages?q=${query}&maxResults=${maxResults}`);

    const messages = listData.messages || [];
    if (messages.length === 0) return [];

    const announcements: D2LAnnouncement[] = [];

    for (const msg of messages) {
      try {
        const detail = await fetcher(`messages/${msg.id}?format=full`);

        const headers = detail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || 'No Subject';
        const dateStr = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';
        const isRead = !detail.labelIds?.includes('UNREAD');

        let bodyText = '';
        const payload = detail.payload;

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
          id: msg.id,
          subject: cleanSubject,
          snippet: detail.snippet || '',
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
