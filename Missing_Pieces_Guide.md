# What Was Missing — Additional Setup Details

This guide covers everything that was NOT included in the previous 4 emails. These are the gaps I found after auditing the entire codebase.

---

## 1. Google Apps Script — The Email Automation Brain

**This was completely missing from all previous guides.**

Your app has a unified email intake system powered by a Google Apps Script running on a separate Gmail account (homeworkbryn@gmail.com). This script monitors incoming emails and forwards them to your app via webhooks. Without it, these features stop working:

- **Email-to-ticker**: Send an email with subject starting with "Ticker" to add items to the HA news ticker
- **Email-to-reminder**: Send an email with subject starting with "Reminder" to create a task
- **Email-to-delete**: Send an email with subject starting with "Delete" to remove ticker items, calendar events, or tasks
- **Email-to-homework**: Any other email gets parsed as a homework task

### How It Works

The Apps Script runs on a timer (every 5-10 minutes) in Google Apps Script, checks for new emails, and POSTs them to your app:

```
POST /api/webhook/email
Body: { emailId, subject, body, from, auth: "5747" }
```

The app then routes the email based on the subject prefix to the correct handler.

### What You Need to Set Up

1. **Go to script.google.com** and create a new project
2. **Write (or paste) the Apps Script** that:
   - Reads unread emails from the target Gmail inbox
   - Extracts subject, body, sender, and email ID
   - POSTs to `http://YOUR_PI_IP:5000/api/webhook/email`
   - Marks the email as read after processing
3. **Set up a time-driven trigger** to run every 5 minutes

### Example Apps Script Code

```javascript
function processEmails() {
  var threads = GmailApp.search('is:unread', 0, 10);
  var appUrl = 'http://YOUR_PI_IP:5000';  // Change to your Pi's address

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (msg.isUnread()) {
        var payload = {
          emailId: msg.getId(),
          subject: msg.getSubject(),
          body: msg.getPlainBody(),
          from: msg.getFrom(),
          auth: '5747'
        };

        try {
          UrlFetchApp.fetch(appUrl + '/api/webhook/email', {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
          });
          msg.markRead();
        } catch (e) {
          Logger.log('Error processing email: ' + e.message);
        }
      }
    }
  }
}
```

### Important: Network Access

Google Apps Script runs in Google's cloud. It CANNOT reach a device on your home network directly. You need one of these:
- **Cloudflare Tunnel** (see the Troubleshooting Guide, Section 12)
- **Port forwarding** on your router (less secure)
- **Keep using Replit** just for this webhook (the simplest option)

### The Auth Code

The webhook uses a hardcoded auth code: `5747`. This is NOT a secure authentication method — it's a simple shared secret. For self-hosting, you should:
1. Change `5747` to a strong random string in both the Apps Script and `server/routes.ts`
2. Search for `auth !== '5747'` in `server/routes.ts` and replace all instances

---

## 2. TMU Academic Calendar (iCal Feed)

**Missing from all guides.**

The app can import academic dates (reading week, exam periods, holidays) from TMU's public iCal feed.

### Environment Variable
```env
TMU_ICAL_URL=https://www.torontomu.ca/content/dam/registrar/PDFs/AcademicCalendar/Academic_Calendar_2025-2026_ical.ics
```

This is just a public URL — no authentication needed. The app fetches it periodically and parses the iCal format. If you don't set this variable, the TMU calendar features simply won't show any data (no crash).

---

## 3. OpenAI Base URL Override

**Missing from Integration Guide.**

On Replit, the OpenAI API calls go through Replit's AI integration proxy. On the Pi, they need to go directly to OpenAI.

The code references TWO environment variables for OpenAI:
```env
AI_INTEGRATIONS_OPENAI_API_KEY=sk-xxx    # Currently used (Replit name)
AI_INTEGRATIONS_OPENAI_BASE_URL=          # Replit proxy URL
```

For self-hosting, you need to change this in **5 places** (not just the one mentioned in the Integration Guide):

| File | Line to Find | Change To |
|------|-------------|-----------|
| `server/replit_integrations/audio/client.ts` | `apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY` | `apiKey: process.env.OPENAI_API_KEY` |
| `server/replit_integrations/audio/client.ts` | `baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL` | DELETE this line (use OpenAI's default URL) |
| `server/replit_integrations/image/client.ts` | same two lines | same changes |
| `server/replit_integrations/chat/routes.ts` | same two lines | same changes |
| `server/routes.ts` (2 places, around lines 6297 and 15272) | same two lines | same changes |

After removing the `baseURL` line, OpenAI calls will go directly to `https://api.openai.com` (the default).

---

## 4. Object Storage — Detailed Replacement Plan

**The Integration Guide mentioned 3 options but didn't give implementation details.**

Your app stores files in two directories inside Replit Object Storage:
- `public/` — TTS audio files that the Nest speaker streams
- `.private/` — uploaded PDFs

### The Simplest Replacement (Local File System)

**Step 1:** Create the directories on the Pi:
```bash
mkdir -p /opt/dashboard/uploads/public
mkdir -p /opt/dashboard/uploads/private
```

**Step 2:** Set environment variables:
```env
PUBLIC_OBJECT_SEARCH_PATHS=/opt/dashboard/uploads/public
PRIVATE_OBJECT_DIR=/opt/dashboard/uploads/private
```

**Step 3:** Replace the object storage client. Create a new file `server/localFileStorage.ts`:

```typescript
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '/opt/dashboard/uploads/public';
const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '/opt/dashboard/uploads/private';

export const localStorageClient = {
  async uploadFile(filePath: string, content: Buffer, contentType?: string): Promise<void> {
    const fullPath = filePath.startsWith('.private')
      ? path.join(PRIVATE_DIR, filePath.replace(/^\.private\/?/, ''))
      : path.join(PUBLIC_DIR, filePath.replace(/^public\/?/, ''));

    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content);
  },

  async downloadFile(filePath: string): Promise<Buffer> {
    const fullPath = filePath.startsWith('.private')
      ? path.join(PRIVATE_DIR, filePath.replace(/^\.private\/?/, ''))
      : path.join(PUBLIC_DIR, filePath.replace(/^public\/?/, ''));
    return fs.readFileSync(fullPath);
  },

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = filePath.startsWith('.private')
      ? path.join(PRIVATE_DIR, filePath.replace(/^\.private\/?/, ''))
      : path.join(PUBLIC_DIR, filePath.replace(/^public\/?/, ''));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  },

  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = filePath.startsWith('.private')
      ? path.join(PRIVATE_DIR, filePath.replace(/^\.private\/?/, ''))
      : path.join(PUBLIC_DIR, filePath.replace(/^public\/?/, ''));
    return fs.existsSync(fullPath);
  },

  async listFiles(prefix: string): Promise<string[]> {
    const dir = prefix.startsWith('.private')
      ? path.join(PRIVATE_DIR, prefix.replace(/^\.private\/?/, ''))
      : path.join(PUBLIC_DIR, prefix.replace(/^public\/?/, ''));
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).map(f => path.join(prefix, f));
  }
};
```

**Step 4:** Replace imports. Everywhere the code imports from `objectStorage`, change it:
```typescript
// OLD:
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

// NEW:
import { localStorageClient as objectStorageClient } from "./localFileStorage";
```

**Step 5:** Add static serving for the public directory. In `server/index.ts`, add:
```typescript
app.use('/uploads', express.static('/opt/dashboard/uploads/public'));
```

This way, the Nest speaker can access TTS audio at `http://PI_IP:5000/uploads/tts-audio/filename.mp3`.

### ChatGPT Prompt for Object Storage Replacement
```
[Paste the intro statement]

I need to replace Replit Object Storage with local file system storage. Here is my current object storage client code:

[paste server/replit_integrations/object_storage/objectStorage.ts]

And here is an example of how it's used in routes.ts:

[paste 20-30 lines showing objectStorageClient.upload or objectStorageClient.download usage]

Please create a drop-in replacement file called server/localFileStorage.ts that uses fs.readFileSync/writeFileSync instead of cloud storage. Files should go to /opt/dashboard/uploads/public (for TTS audio) and /opt/dashboard/uploads/private (for PDFs). The API should match the existing objectStorageClient exactly so I only need to change the import line.
```

---

## 5. Replit-Specific Environment Variables to Remove/Replace

**Missing from all guides.**

These environment variables are set automatically by Replit and don't exist on a Pi. The code references them and needs small tweaks:

| Variable | Used For | What to Do on Pi |
|----------|----------|-----------------|
| `REPLIT_CONNECTORS_HOSTNAME` | OAuth connector API | Not needed — you're using direct OAuth |
| `REPL_IDENTITY` | Internal auth token | Not needed |
| `WEB_REPL_RENEWAL` | Deployment auth token | Not needed |
| `REPLIT_DEV_DOMAIN` | Dev server URL | Replace with Pi hostname |
| `REPLIT_DOMAINS` | Production URL | Replace with `DEPLOYED_APP_URL` |
| `REPL_SLUG` | Repl name | Not needed |
| `REPL_OWNER` | Repl owner username | Not needed |

The code already has fallbacks for most of these (e.g., `process.env.REPLIT_DOMAINS?.split(',')[0] || 'fallback'`), but you should audit `server/spotify.ts` and `server/secondGoogleAccount.ts` where `REPLIT_DOMAINS` is used for building redirect URIs. Make sure those fallbacks point to your Pi's address.

---

## 6. Self-Ping Keep-Alive

**Not documented anywhere.**

The app pings itself every 4 minutes to stay alive on Replit (which sleeps idle apps). On a Pi with systemd, this is unnecessary but harmless. The code is around line 7610 in `routes.ts`:

```typescript
const SELF_PING_INTERVAL_MS = 4 * 60 * 1000;
setInterval(async () => {
  await fetch(`http://localhost:${process.env.PORT || 5000}/api/version`);
}, SELF_PING_INTERVAL_MS);
```

You can leave this in (it doesn't hurt) or remove it to keep logs cleaner.

---

## 7. Background Scheduled Tasks — Full List

**The Self-Hosting Guide mentioned background processes but didn't list them all.**

Here's every scheduled process running inside the app:

| Process | Interval | What It Does | Where in Code |
|---------|----------|--------------|---------------|
| Reminder Scheduler | Every 60 seconds | Checks for due task reminders, sends Echo voice announcements + push notifications via Resend email | `server/reminderScheduler.ts` |
| Semester Auto-Activation | Every 6 hours + startup | Activates the semester whose date range includes today | `routes.ts` ~line 7607 |
| Audio Pre-Generation | Every 30 minutes | Pre-generates TTS audio for upcoming unlistened files | `routes.ts` ~line 8100 |
| HA Health Check | Every 60 seconds | Pings HA to track connectivity status | `routes.ts` ~line 7527 |
| Toothbrush Polling | Every 3 seconds (only during playback) | Checks if brushing has started, auto-stops reading | `routes.ts` ~line 8683 |
| Word Advancement | Every ~50ms (only during playback) | Advances the highlighted word on tablet/TV display | `routes.ts` ~line 8762 |
| Self-Ping | Every 4 minutes | Keep-alive for Replit (unnecessary on Pi) | `routes.ts` ~line 7613 |
| Tablet Command Polling | Every 3 seconds | The tablet polls for new navigation/playback commands | `routes.ts` ~line 998 |

These all start automatically when the app boots — no configuration needed.

---

## 8. The Webhook Auth Code (5747)

**Security issue not documented.**

Multiple webhook endpoints use a hardcoded auth code `5747`:
- `/api/webhook/email` — the Gmail intake
- `/api/webhook/reminder` — email-to-task
- `/api/webhook/delete` — email-to-delete
- `/api/webhook/email-homework` — email-to-homework (uses `X-Webhook-Secret` header)

For self-hosting, you should:
1. Pick a strong random string (e.g., generate with `openssl rand -hex 16`)
2. Search for `'5747'` in `server/routes.ts` and replace all instances
3. Update the matching value in your Google Apps Script
4. Add a new env var instead of hardcoding:
```env
WEBHOOK_AUTH_SECRET=your_random_string_here
```

---

## 9. The Replit AI Integrations System

**Missing from all guides.**

Your app uses Replit's AI Integrations for more than just TTS. It's used for:

1. **TTS Audio Generation** (OpenAI TTS voices) — used by the cat washroom reading system
2. **Chat Completions** — used by the syllabus parser (`/api/syllabus/parse`) and assignment PDF parser (`/api/tasks/parse-assignment-pdf`)
3. **Image Generation** — available but may not be actively used

All of these use `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.

### Full List of Files to Update

```
server/replit_integrations/audio/client.ts    — TTS generation
server/replit_integrations/image/client.ts    — Image generation
server/replit_integrations/chat/routes.ts     — Chat completions
server/routes.ts (line ~6297)                 — Syllabus parser
server/routes.ts (line ~15272)                — Assignment PDF parser
server/routes.ts (line ~15387)                — Course list comparison
```

In EACH of these files, change:
```typescript
// FROM:
apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,

// TO:
apiKey: process.env.OPENAI_API_KEY,
// (delete the baseURL line entirely)
```

---

## 10. Uppy File Upload Widget

**Not documented.**

The app uses Uppy (a file upload library) for uploading PDFs. On Replit, Uppy uploads go to Replit's Object Storage via the `@uppy/aws-s3` plugin. On the Pi, you'd need to:

1. Replace the Uppy S3 plugin with direct upload (Uppy supports XHR upload out of the box)
2. Or keep using the current upload endpoints which already handle the file saving

The upload endpoint is at `/api/course-week-upload` in `routes.ts`. It receives the file, stores it via Object Storage, and creates a database record. Once you replace Object Storage with local files (see section 4 above), uploads will work with local storage automatically.

---

## 11. The .spotify-token.json File

**Not documented.**

Spotify tokens are stored in a file called `.spotify-token.json` in the app root directory. This file is auto-created when you authorize Spotify via `/api/spotify/login`. On the Pi:

- Make sure the app has write access to its directory: `sudo chown -R pi:pi /opt/dashboard`
- The file will be created automatically after the first Spotify login
- If you copy the app from Replit, you can also copy this file to skip re-authorization (but the tokens may have expired)

---

## 12. Replit Vite Plugins (Dev Dependencies)

**Not documented.**

The dev dependencies include three Replit-specific Vite plugins:
```
@replit/vite-plugin-cartographer
@replit/vite-plugin-dev-banner
@replit/vite-plugin-runtime-error-modal
```

These are only used during development. The production build (`npm run build`) should work without them, but if you get build errors related to these plugins on the Pi:

1. Open `vite.config.ts`
2. Find the plugin imports and remove them
3. Remove them from the `plugins: [...]` array
4. Or just comment them out with `//`

The app will build and run fine without them.

---

## 13. Session Storage (connect-pg-simple)

**Not documented.**

The app uses `connect-pg-simple` to store user sessions (login state) in PostgreSQL. This is already configured and will work on the Pi with no changes, as long as your DATABASE_URL is correct.

If you see errors about a `session` table not existing:
```bash
# The table is auto-created, but if it's not:
sudo -u postgres psql -d dashboard_db -c "
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
"
```

---

## 14. Edge TTS (Node Package vs Python Package)

**Partially documented but confusing.**

The app uses TWO different edge-tts implementations:
1. **Python edge-tts** — installed via `pip3 install edge-tts` (the fallback TTS engine)
2. **Node.js node-edge-tts** — installed via npm as a dependency in package.json

Both should work on the Pi. The Python version is used as a command-line fallback. The Node version is used directly from the server code. Make sure both are installed:

```bash
# Python version (already in the setup guide)
pip3 install edge-tts --break-system-packages

# Node version (installed automatically with npm install)
npm install
```

---

## Summary: Complete Checklist of Things to Set Up

Use this as your master checklist. Check off each item as you complete it:

```
[ ] 1. Flash Pi OS and SSH in
[ ] 2. Install Node.js 20, PostgreSQL, espeak-ng, edge-tts (Python)
[ ] 3. Create database user and database
[ ] 4. Transfer code to Pi
[ ] 5. Run npm install
[ ] 6. Create .env file with ALL variables (use the template from Integration Guide)
[ ] 7. Rewrite getAccessToken() in googleCalendar.ts (Replit connector to direct OAuth)
[ ] 8. Rewrite getAccessToken() in gmail.ts (same)
[ ] 9. Rewrite getAccessToken() in onedrive.ts (same)
[ ] 10. Rewrite getOutlookAccessToken() in outlookCalendar.ts (same)
[ ] 11. Change OpenAI env vars in 5 files (AI_INTEGRATIONS_ to OPENAI_)
[ ] 12. Remove baseURL lines for OpenAI in those same 5 files
[ ] 13. Fix Spotify redirect URI in spotify.ts (REPLIT_DOMAINS to DEPLOYED_APP_URL)
[ ] 14. Fix redirect URI in secondGoogleAccount.ts (same)
[ ] 15. Fix redirect URI in thirdGoogleAccount.ts (same)
[ ] 16. Replace Object Storage with local file system (or MinIO)
[ ] 17. Replace webhook auth code 5747 with a strong secret
[ ] 18. Remove or comment out Replit Vite plugins if build fails
[ ] 19. Set up Google OAuth and get refresh tokens
[ ] 20. Set up Azure app and get Microsoft refresh token
[ ] 21. Authorize Spotify via /api/spotify/login
[ ] 22. Set up Resend account and get API key
[ ] 23. Set up OpenAI account and get API key
[ ] 24. Set up Google Apps Script for email intake (if needed)
[ ] 25. Run npm run db:push to create database tables
[ ] 26. Run npm run build
[ ] 27. Set up systemd service
[ ] 28. Update HA rest_command URLs to point to Pi
[ ] 29. Test each integration one by one
[ ] 30. Set up Cloudflare Tunnel if you need external access
```
