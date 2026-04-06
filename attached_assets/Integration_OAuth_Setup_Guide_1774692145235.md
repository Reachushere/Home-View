# Complete Integration & OAuth Setup Guide — Self-Hosting Edition

This guide covers **every external service** your app connects to, what each one does, how to set it up from scratch on a Raspberry Pi, and — critically — which parts of the code need to change because they currently rely on Replit's built-in connectors.

---

## Table of Contents

1. [Overview: What Connects to What](#overview)
2. [Tools You'll Need](#tools-youll-need)
3. [CRITICAL: Replit Connector Rewrites](#critical-replit-connector-rewrites)
4. [Integration 1: Home Assistant](#integration-1-home-assistant)
5. [Integration 2: Google Calendar](#integration-2-google-calendar)
6. [Integration 3: Gmail](#integration-3-gmail)
7. [Integration 4: Spotify](#integration-4-spotify)
8. [Integration 5: Microsoft OneDrive](#integration-5-microsoft-onedrive)
9. [Integration 6: Microsoft Outlook Calendar](#integration-6-microsoft-outlook-calendar)
10. [Integration 7: OpenAI (TTS)](#integration-7-openai-tts)
11. [Integration 8: Resend (Email Sending)](#integration-8-resend-email-sending)
12. [Integration 9: Second Google Account (Partner Shifts)](#integration-9-second-google-account)
13. [Integration 10: Third Google Account (CRCU)](#integration-10-third-google-account)
14. [Integration 11: Object Storage](#integration-11-object-storage)
15. [App Security: Site Password & Sessions](#app-security)
16. [Complete .env Template](#complete-env-template)
17. [Testing Each Integration](#testing-each-integration)
18. [ChatGPT Prompts for Integration Help](#chatgpt-prompts)

---

## Overview

Your app talks to **10 external services**. Here's what each one does:

| # | Service | What It Does in Your App | Auth Method |
|---|---------|--------------------------|-------------|
| 1 | Home Assistant | Smart home control, speaker playback, sensor data, webhooks | Long-lived access token |
| 2 | Google Calendar | Shows academic calendar events on dashboard | OAuth 2.0 (currently Replit connector) |
| 3 | Gmail | Reads D2L announcement emails, sends emails | OAuth 2.0 (currently Replit connector) |
| 4 | Spotify | Music player on dashboard (play, pause, playlists) | OAuth 2.0 (already uses direct tokens) |
| 5 | Microsoft OneDrive | Syncs PDF course files for TTS reading | OAuth 2.0 (currently Replit connector) |
| 6 | Microsoft Outlook | Shows Outlook calendar events on dashboard | OAuth 2.0 (currently Replit connector) |
| 7 | OpenAI | Generates TTS audio from PDF text | API key (currently Replit AI integration) |
| 8 | Resend | Sends reminder emails (task due dates, daily digest) | API key |
| 9 | Second Google Account | Partner's work shift calendar | OAuth 2.0 (direct, already works) |
| 10 | Third Google Account | CRCU partner shifts | OAuth 2.0 (direct, already works) |

Plus one infrastructure service:
| 11 | Object Storage | Stores uploaded PDFs and TTS audio files | Replit-managed (needs replacement) |

---

## Tools You'll Need

Before you start, install these on your regular computer (not the Pi):

### Required Tools

| Tool | What It's For | Where to Get It |
|------|---------------|-----------------|
| **Web Browser** (Chrome/Edge) | Setting up OAuth apps, approving permissions | Already have it |
| **Terminal / SSH** | Connecting to the Pi, running commands | Built into Mac/Linux. Windows: use PowerShell or install PuTTY |
| **Text Editor** | Editing .env files and code | VS Code (free, code.visualstudio.com) or Notepad++ |

### Helpful But Optional

| Tool | What It's For | Where to Get It |
|------|---------------|-----------------|
| **Postman** | Testing API calls and OAuth flows manually | Free at postman.com/downloads |
| **jq** | Pretty-printing JSON in the terminal | `sudo apt install jq` on the Pi |
| **curl** | Making test HTTP requests from command line | Already installed on Pi |

### Accounts You'll Need

| Account | URL | What For |
|---------|-----|----------|
| Google Cloud Console | console.cloud.google.com | Google Calendar + Gmail APIs |
| Spotify Developer | developer.spotify.com | Spotify music control |
| Azure Portal | portal.azure.com | OneDrive + Outlook |
| OpenAI Platform | platform.openai.com | TTS audio generation |
| Resend | resend.com | Sending reminder emails |

---

## CRITICAL: Replit Connector Rewrites

**This is the most important section.** Four of your integrations currently work through Replit's connector system, which handles OAuth automatically. On a Pi, this system doesn't exist. You need to rewrite the auth code in four files.

### What Needs to Change

The following files each have a `getAccessToken()` function that calls Replit's connector API. On a Pi, this won't work — you need to replace it with direct OAuth using your own client ID, client secret, and refresh token.

| File | Connector Used | What To Replace |
|------|---------------|-----------------|
| `server/googleCalendar.ts` | google-calendar | `getAccessToken()` function (lines 1-30) |
| `server/gmail.ts` | google-mail | `getAccessToken()` function (lines 1-35) |
| `server/onedrive.ts` | onedrive | `getAccessToken()` function (lines 1-35) |
| `server/outlookCalendar.ts` | outlook | `getOutlookAccessToken()` function (lines 1-40) |

### The Pattern to Replace

Each file currently has code like this (DON'T use this on the Pi):
```typescript
// THIS IS THE REPLIT CONNECTOR CODE — DOES NOT WORK ON PI
const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
const xReplitToken = process.env.REPL_IDENTITY
  ? 'repl ' + process.env.REPL_IDENTITY
  : process.env.WEB_REPL_RENEWAL
  ? 'depl ' + process.env.WEB_REPL_RENEWAL
  : null;

connectionSettings = await fetch(
  'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
  { headers: { 'X_REPLIT_TOKEN': xReplitToken } }
).then(res => res.json()).then(data => data.items?.[0]);
```

### The Replacement Pattern

Replace each `getAccessToken()` with this pattern (customize for each service):

```typescript
// DIRECT OAUTH — WORKS ON PI
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;       // Change per service
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET; // Change per service
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN; // Change per service

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Google token: ${error}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken!;
}
```

The same pattern works for Microsoft — just change the token URL and env var names.

### ChatGPT Prompt for Rewriting Connector Code

If you want ChatGPT to do the rewrite for you, paste this:

```
[Paste the intro statement from the Troubleshooting Guide]

I need to rewrite 4 files that currently use Replit's connector system for OAuth. On my self-hosted Pi, Replit connectors don't exist. I need to replace the getAccessToken() function in each file to use direct OAuth 2.0 refresh token flow instead.

Here is the current code for [paste the file name]:

[paste the first 40 lines of the file]

Please rewrite the getAccessToken() function to use direct OAuth with these environment variables:
- For Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
- For Microsoft: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN

The rest of the file should stay exactly the same — only the auth function needs to change. The function should:
1. Cache the access token in memory
2. Refresh it automatically when it expires (with a 5-minute buffer)
3. Use the standard OAuth 2.0 refresh_token grant flow
4. Throw a clear error if environment variables are missing
```

---

## Integration 1: Home Assistant

**Difficulty: Easy**
**Already works on Pi: Yes** (no code changes needed)

### What You Need
- Your Home Assistant URL (either Nabu Casa cloud URL or local IP)
- A long-lived access token

### How to Get the Token
1. Open Home Assistant in your browser
2. Click your name/profile in the bottom-left corner
3. Scroll down to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Give it a name like "Dashboard App"
6. Copy the token immediately — you can't see it again

### Environment Variables
```env
HOME_ASSISTANT_TOKEN=eyJ0eX...your_very_long_token_here
HOME_ASSISTANT_URL_OVERRIDE=https://your-nabu-casa-url.ui.nabu.casa
```

If your Pi is on the same network as HA, you can also use the local URL:
```env
HOME_ASSISTANT_URL_OVERRIDE=http://192.168.1.XXX:8123
```
(Local is faster but only works when on the same network.)

### Test It
```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR_HA_URL/api/ | jq .
# Should show: {"message": "API running."}
```

---

## Integration 2: Google Calendar

**Difficulty: Medium-Hard**
**Requires code change: YES** (Replit connector rewrite)

### Step 1: Create a Google Cloud Project

1. Go to **console.cloud.google.com**
2. Click the project dropdown at the top, then "New Project"
3. Name it something like "Dashboard App"
4. Click "Create"

### Step 2: Enable the Calendar API

1. In your new project, go to **APIs & Services** in the left sidebar, then **Library**
2. Search for "Google Calendar API"
3. Click it, then click **Enable**

### Step 3: Set Up OAuth Consent Screen

1. Go to **APIs & Services**, then **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace org, then choose Internal)
3. Fill in:
   - App name: "Dashboard"
   - User support email: your email
   - Developer email: your email
4. Click "Save and Continue"
5. On the "Scopes" page, click "Add or Remove Scopes"
6. Add: `https://www.googleapis.com/auth/calendar.readonly`
7. Click "Save and Continue"
8. On "Test users", click "Add Users"
9. Add your Gmail address
10. Click "Save and Continue"

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services**, then **Credentials**
2. Click **Create Credentials**, then **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: "Dashboard Calendar"
5. Under "Authorized redirect URIs", add:
   ```
   http://dashboard-server.local:5000/api/google/callback
   ```
   (also add your Pi's IP version: `http://192.168.1.XXX:5000/api/google/callback`)
6. Click "Create"
7. **Copy the Client ID and Client Secret** — save them somewhere safe

### Step 5: Get a Refresh Token (The Tricky Part)

You need to do a one-time browser authorization to get a refresh token. Here's how:

**5a. Open this URL in your browser** (replace YOUR_CLIENT_ID with your actual client ID):
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://dashboard-server.local:5000/api/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar.readonly&access_type=offline&prompt=consent
```

**5b. Sign in and approve the permissions**

**5c. You'll be redirected to a URL that looks like:**
```
http://dashboard-server.local:5000/api/google/callback?code=4/0VERY_LONG_CODE_HERE
```

**5d. Copy the `code` value** (everything after `code=` and before any `&`)

**5e. Exchange the code for tokens.** Run this on your Pi (or any terminal):
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=THE_CODE_FROM_STEP_5D" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://dashboard-server.local:5000/api/google/callback"
```

**5f. You'll get a JSON response like:**
```json
{
  "access_token": "ya29.a0...",
  "expires_in": 3599,
  "refresh_token": "1//0e...",
  "scope": "https://www.googleapis.com/auth/calendar.readonly",
  "token_type": "Bearer"
}
```

**5g. Copy the `refresh_token` value** — this is what you put in your .env file. This token lasts indefinitely (as long as you don't revoke access).

### Step 6: Rewrite the Auth Code

Open `server/googleCalendar.ts` and replace the entire `getAccessToken()` function (approximately lines 1-30) with the direct OAuth pattern from the "Replit Connector Rewrites" section above. Use these env vars:
- `process.env.GOOGLE_CLIENT_ID`
- `process.env.GOOGLE_CLIENT_SECRET`
- `process.env.GOOGLE_REFRESH_TOKEN`
- Token URL: `https://oauth2.googleapis.com/token`

### Environment Variables
```env
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//0exxxxxxxxxx
```

### If the Refresh Token Stops Working

Google refresh tokens can expire if:
- You revoke access at myaccount.google.com > Security > Third-party apps
- The app stays in "Testing" mode and the token is older than 7 days
- You change the client secret

**Fix:** Redo steps 5a through 5g to get a new refresh token.

**To avoid the 7-day expiry:** In the OAuth consent screen, click "Publish App" to move from Testing to Production. Google may ask you to verify the app, but for personal use you can often skip that by staying under 100 users.

---

## Integration 3: Gmail

**Difficulty: Medium-Hard**
**Requires code change: YES** (Replit connector rewrite)

### Setup

Use the **same Google Cloud project** as Google Calendar. You just need to add the Gmail scope.

### Step 1: Enable the Gmail API

1. Go to **APIs & Services**, then **Library**
2. Search for "Gmail API"
3. Click it, then click **Enable**

### Step 2: Add Gmail Scope

1. Go to **OAuth consent screen**
2. Click "Edit App"
3. Go to "Scopes" page
4. Add: `https://www.googleapis.com/auth/gmail.readonly`
5. If you also need to send emails via Gmail: add `https://www.googleapis.com/auth/gmail.send`
6. Save

### Step 3: Get a New Refresh Token

Because you added a new scope, you need a new refresh token that includes both Calendar and Gmail:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://dashboard-server.local:5000/api/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/gmail.readonly%20https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent
```

Then exchange the code for tokens using the same curl command as step 5e in the Calendar section.

**Note:** You can use the SAME client ID, secret, and refresh token for both Calendar and Gmail — they share the same Google project. Just use the same env vars in both files:
```env
GOOGLE_CLIENT_ID=same_as_calendar
GOOGLE_CLIENT_SECRET=same_as_calendar
GOOGLE_REFRESH_TOKEN=new_token_with_all_scopes
```

### Step 4: Rewrite the Auth Code

Open `server/gmail.ts` and replace the `getAccessToken()` function with the same direct OAuth pattern. Use the same env vars as Google Calendar.

---

## Integration 4: Spotify

**Difficulty: Medium**
**Requires code change: SMALL** (just update the redirect URI logic)

Spotify already uses direct OAuth (not Replit connectors), so it mostly works. You just need to update how the redirect URI is determined.

### Step 1: Create a Spotify App

1. Go to **developer.spotify.com/dashboard**
2. Click "Create App"
3. Fill in:
   - App name: "Dashboard"
   - App description: "Home dashboard music player"
   - Redirect URI: `http://dashboard-server.local:5000/api/spotify/callback`
     (also add your Pi's IP version)
4. Check the "Web API" box
5. Click "Save"

### Step 2: Get Client ID and Secret

1. In your app's dashboard, you'll see the **Client ID**
2. Click "Show client secret" to see the **Client Secret**
3. Copy both

### Step 3: Small Code Change

In `server/spotify.ts`, find these lines (around line 33 and line 66):
```typescript
const host = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co';
const redirectUri = `https://${host}/api/spotify/callback`;
```

Replace with:
```typescript
const host = process.env.DEPLOYED_APP_URL?.replace(/^https?:\/\//, '') || 'dashboard-server.local:5000';
const redirectUri = `http://${host}/api/spotify/callback`;
```

### Step 4: Authorize Spotify

1. Start the app on your Pi
2. Open `http://PI_IP:5000/api/spotify/login` in a browser
3. Sign in to Spotify and approve
4. You'll be redirected back — the app saves the tokens to `.spotify-token.json` automatically
5. That's it — Spotify is connected

### Environment Variables
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### If Spotify Disconnects

The app auto-refreshes Spotify tokens using the saved refresh token in `.spotify-token.json`. If that file gets deleted or corrupted:
1. Delete `.spotify-token.json` from the app directory
2. Visit `http://PI_IP:5000/api/spotify/login` again
3. Re-authorize

---

## Integration 5: Microsoft OneDrive

**Difficulty: Hard**
**Requires code change: YES** (Replit connector rewrite)

### Step 1: Register an Azure App

1. Go to **portal.azure.com**
2. Search for "App registrations" in the top search bar
3. Click "New registration"
4. Fill in:
   - Name: "Dashboard"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Platform = "Web", URI = `http://dashboard-server.local:5000/api/microsoft/callback`
5. Click "Register"

### Step 2: Get Client ID

After registering, you'll see the **Application (client) ID** on the overview page. Copy it.

### Step 3: Create a Client Secret

1. Go to **Certificates & secrets** in the left menu
2. Click "New client secret"
3. Description: "Dashboard App"
4. Expiry: Choose "24 months" (you'll need to renew after that)
5. Click "Add"
6. **Copy the Value immediately** — you can't see it again after leaving this page

### Step 4: Add API Permissions

1. Go to **API permissions** in the left menu
2. Click "Add a permission"
3. Choose "Microsoft Graph"
4. Choose "Delegated permissions"
5. Add these permissions:
   - `Files.ReadWrite` (OneDrive file access)
   - `Files.ReadWrite.All` (full OneDrive access)
   - `User.Read` (basic profile)
6. Click "Add permissions"
7. If you see "Grant admin consent", click it (if you're the admin)

### Step 5: Get a Refresh Token

**5a. Open this URL** (replace YOUR_CLIENT_ID):
```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://dashboard-server.local:5000/api/microsoft/callback&scope=Files.ReadWrite%20Files.ReadWrite.All%20User.Read%20offline_access&response_mode=query
```

**5b. Sign in with your Microsoft account and approve**

**5c. Copy the `code` from the redirect URL**

**5d. Exchange for tokens:**
```bash
curl -X POST https://login.microsoftonline.com/common/oauth2/v2.0/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=THE_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://dashboard-server.local:5000/api/microsoft/callback" \
  -d "scope=Files.ReadWrite%20Files.ReadWrite.All%20User.Read%20offline_access"
```

**5e. Copy the `refresh_token` from the response**

### Step 6: Rewrite the Auth Code

Open `server/onedrive.ts` and replace the `getAccessToken()` function. For Microsoft, the token URL is different:

```typescript
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const refreshToken = process.env.MICROSOFT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Files.ReadWrite Files.ReadWrite.All User.Read offline_access',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Microsoft token: ${error}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  // Microsoft sometimes returns a new refresh token — save it
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.log('[OneDrive] Got new refresh token — update your .env MICROSOFT_REFRESH_TOKEN');
  }

  return cachedAccessToken!;
}
```

### Environment Variables
```env
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_REFRESH_TOKEN=0.AAAA...very_long_token
```

### Important: Microsoft Refresh Token Rotation

Microsoft sometimes issues a NEW refresh token when you use the old one. If this happens, the old one stops working. The code above logs a warning when this happens. When you see that log message, update your .env file with the new token.

To handle this automatically, you could save the new token to a file:
```typescript
if (data.refresh_token && data.refresh_token !== refreshToken) {
  fs.writeFileSync('/opt/dashboard/.microsoft-refresh-token', data.refresh_token);
}
```

---

## Integration 6: Microsoft Outlook Calendar

**Difficulty: Hard**
**Requires code change: YES** (Replit connector rewrite)

### Setup

Use the **same Azure app** as OneDrive. Just add Outlook permissions.

### Step 1: Add Calendar Permissions

1. Go to your Azure app, then **API permissions**
2. Add these Delegated permissions:
   - `Calendars.Read`
   - `Calendars.ReadWrite` (if you need to create events)
   - `Mail.Read` (if you also need email access)
   - `Mail.ReadWrite` (if you need to move emails to folders)
3. Click "Grant admin consent" if available

### Step 2: Get a New Refresh Token

Because you added new scopes, get a new token with ALL Microsoft scopes:

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://dashboard-server.local:5000/api/microsoft/callback&scope=Files.ReadWrite%20Files.ReadWrite.All%20Calendars.Read%20Calendars.ReadWrite%20Mail.Read%20Mail.ReadWrite%20User.Read%20offline_access&response_mode=query
```

Exchange the code for tokens using the same curl command as OneDrive step 5d, but with the expanded scope.

### Step 3: Rewrite the Auth Code

Open `server/outlookCalendar.ts` and replace `getOutlookAccessToken()` with the same pattern as OneDrive. You can use the **same** env vars (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN) since it's the same Azure app.

### Important: One Token for Both

Since OneDrive and Outlook use the same Azure app, you only need ONE set of Microsoft credentials and ONE refresh token. Both files can use the same env vars. Just make sure the refresh token was obtained with ALL the scopes (Files + Calendar + Mail).

---

## Integration 7: OpenAI (TTS)

**Difficulty: Easy**
**Requires code change: YES** (env var name change)

OpenAI generates the text-to-speech audio for the cat washroom reading system. On Replit, it uses the Replit AI Integrations system. On the Pi, you need your own API key.

### Step 1: Get an API Key

1. Go to **platform.openai.com**
2. Click your profile icon, then "API keys" (or go to platform.openai.com/api-keys)
3. Click "Create new secret key"
4. Name it "Dashboard TTS"
5. Copy the key

### Step 2: Add to .env
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Code Change

Open `server/replit_integrations/audio/client.ts` and find:
```typescript
apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
```
Change to:
```typescript
apiKey: process.env.OPENAI_API_KEY,
```

Also check `server/routes.ts` for any references to `AI_INTEGRATIONS_OPENAI_API_KEY` and change them the same way.

### Cost

OpenAI TTS costs about $0.015 per 1,000 characters. A typical 10-page PDF is about 5,000 characters, so about $0.075 (7.5 cents) per reading. For a full semester of ~50 readings, that's about $3-4 total.

The app has fallback TTS engines (Edge TTS and espeak-ng) that are free, so if you run out of OpenAI credits, readings will still work — they'll just sound slightly different.

---

## Integration 8: Resend (Email Sending)

**Difficulty: Easy**
**Requires code change: No**

Resend sends reminder emails (task due dates, daily digests) from `reminders@uni-cal.app`.

### Step 1: Create a Resend Account

1. Go to **resend.com** and sign up
2. Free tier gives you 100 emails/day — more than enough

### Step 2: Set Up a Domain (Optional but Recommended)

If you have your own domain:
1. In Resend dashboard, go to "Domains"
2. Add your domain and set up the DNS records they give you
3. This lets you send from a custom email address

If you don't have a domain, you can send from Resend's default: `onboarding@resend.dev` (limited to your verified email only).

### Step 3: Get API Key

1. In Resend dashboard, go to "API Keys"
2. Click "Create API Key"
3. Name: "Dashboard"
4. Permission: "Full access"
5. Copy the key

### Environment Variables
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Integration 9: Second Google Account

**Difficulty: Medium**
**Requires code change: SMALL**

This is for your partner's work shift calendar. It already uses direct OAuth (not Replit connectors), so it mostly works on the Pi.

### Setup

1. Use the same Google Cloud project as your main calendar
2. Make sure the redirect URI includes your Pi's address
3. The app has built-in OAuth flow at `/api/second-google/auth`

### Code Change

In `server/secondGoogleAccount.ts`, find the redirect URI construction (around line 21):
```typescript
const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
```
Replace with:
```typescript
const domain = process.env.DEPLOYED_APP_URL?.replace(/^https?:\/\//, '') || 'dashboard-server.local:5000';
```

### Environment Variables
```env
GOOGLE_SECOND_ACCOUNT_CLIENT_ID=same_as_main_or_different
GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET=same_as_main_or_different
```

---

## Integration 10: Third Google Account

**Difficulty: Medium**
**Requires code change: SMALL** (same as second account)

Same setup as the Second Account. In `server/thirdGoogleAccount.ts`, make the same redirect URI fix.

---

## Integration 11: Object Storage

**Difficulty: Hard**
**Requires code change: YES** (full replacement)

On Replit, file uploads (PDFs, TTS audio) are stored in Replit's Object Storage service. On a Pi, this doesn't exist.

### Options (Pick One)

**Option A: Local File System (Simplest)**

Replace Object Storage calls with simple file system operations. Store files in `/opt/dashboard/uploads/`.

This is the easiest approach for self-hosting. You'd need to:
1. Create `/opt/dashboard/uploads/public/` and `/opt/dashboard/uploads/private/`
2. Rewrite the upload endpoints to use `fs.writeFileSync` instead of Object Storage
3. Serve the public files via Express static middleware

**Option B: MinIO (S3-Compatible, More Robust)**

MinIO is a free, self-hosted object storage that works like Amazon S3. Install it on the Pi:
```bash
wget https://dl.min.io/server/minio/release/linux-arm64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Start MinIO
mkdir -p /opt/minio-data
minio server /opt/minio-data --console-address ":9001"
```

Then update the object storage client code to use MinIO's S3-compatible API.

**Option C: Keep Replit for Storage**

If you keep running the app on Replit (even just for storage), you can keep the Object Storage as-is.

### ChatGPT Prompt for Object Storage Rewrite

```
[Paste the intro statement]

I need to replace Replit Object Storage with local file system storage on my Raspberry Pi. The app currently uses object storage for:
1. Storing uploaded PDF files (via /api/course-week-upload endpoint)
2. Storing generated TTS audio files (MP3s, served via /api/tts-audio/ endpoint)

The current code uses these files for object storage operations:
- server/replit_integrations/object_storage/objectStorage.ts
- server/replit_integrations/object_storage/routes.ts

I want to replace all object storage calls with simple fs.readFileSync/fs.writeFileSync operations, storing files in /opt/dashboard/uploads/. I need the /api/tts-audio/ endpoint to keep working so the Nest speaker can stream audio files.

Please show me what to change.
```

---

## App Security

### SITE_PASSWORD

This password protects the dashboard from unauthorized access. Anyone who visits the URL gets a login prompt.

```env
SITE_PASSWORD=your_chosen_password
```

If you leave this empty, the dashboard has no login protection (fine if it's only accessible on your local network).

### SESSION_SECRET

This is a random string used to sign browser session cookies. Generate one with:
```bash
openssl rand -hex 32
```

```env
SESSION_SECRET=a1b2c3d4e5f6...random_hex_string
```

---

## Complete .env Template

Here is every environment variable your app uses. Copy this entire block into `/opt/dashboard/.env` and fill in the values:

```env
# ========== DATABASE ==========
DATABASE_URL=postgresql://dashboard:YOUR_DB_PASSWORD@localhost:5432/dashboard_db

# ========== APP ==========
DEPLOYED_APP_URL=http://dashboard-server.local:5000
PORT=5000
SITE_PASSWORD=your_dashboard_login_password
SESSION_SECRET=generate_with_openssl_rand_hex_32
NODE_ENV=production

# ========== HOME ASSISTANT ==========
HOME_ASSISTANT_TOKEN=eyJ0eX...your_ha_long_lived_token
HOME_ASSISTANT_URL_OVERRIDE=https://your-ha-url.ui.nabu.casa

# ========== GOOGLE (Calendar + Gmail) ==========
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//0exxxxxxxxxx

# ========== GOOGLE (Second Account - Partner Shifts) ==========
GOOGLE_SECOND_ACCOUNT_CLIENT_ID=same_or_different_client_id
GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET=same_or_different_client_secret
# (Refresh token stored in database after OAuth flow)

# ========== SPOTIFY ==========
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
# (Refresh token stored in .spotify-token.json after OAuth flow)

# ========== MICROSOFT (OneDrive + Outlook) ==========
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_REFRESH_TOKEN=0.AAAA...very_long_token

# ========== OPENAI (TTS) ==========
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# ========== RESEND (Email) ==========
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# ========== TIMEZONE ==========
TZ=America/Toronto
```

---

## Testing Each Integration

After setting everything up, test each integration one at a time:

### Home Assistant
```bash
curl -s http://localhost:5000/api/version
# Should return the app version

curl -s http://localhost:5000/api/weather
# Should return weather data from HA
```

### Google Calendar
```bash
curl -s http://localhost:5000/api/events
# Should return calendar events (might need auth cookie — test from the dashboard)
```

### Spotify
```bash
curl -s http://localhost:5000/api/spotify/status
# Should show connected: true after authorizing
```

### OneDrive
```bash
curl -s http://localhost:5000/api/onedrive/files
# Should return file listing (might need auth cookie)
```

### TTS (OpenAI)
- Turn on the cat lights — the app should generate TTS and you should hear the prompt

### Resend
- Create a task with a reminder — you should get an email when it's due

---

## ChatGPT Prompts for Integration Help

### General OAuth Issues
```
[Paste the intro statement from the Troubleshooting Guide]

I'm setting up OAuth 2.0 for [Google/Microsoft/Spotify] on my self-hosted Pi. I've rewritten the getAccessToken() function to use direct refresh token flow instead of Replit connectors.

When I try to [describe action], I get this error: [paste error].

My current getAccessToken() code is:
[paste the function]

My environment variables (redacted):
- CLIENT_ID: [present/missing]
- CLIENT_SECRET: [present/missing]
- REFRESH_TOKEN: [present/missing]

The token URL I'm using is: [paste URL]
The scopes I requested were: [list scopes]
```

### Token Exchange Issues
```
[Paste the intro statement]

I'm trying to exchange an OAuth authorization code for tokens. I have:
- Service: [Google/Microsoft/Spotify]
- Client ID: [present]
- Client Secret: [present]
- Authorization Code: [present, starts with...]
- Redirect URI: [paste exact URI]

When I run the curl command to exchange, I get: [paste the response]

Here is the exact curl command I ran (with secrets redacted):
[paste command]
```

### Refresh Token Expired
```
[Paste the intro statement]

My [Google/Microsoft/Spotify] refresh token has stopped working. The error I get when trying to refresh is: [paste error].

This token was working [yesterday/last week/a month ago]. I [did/did not] revoke access, [did/did not] change the client secret, [did/did not] remove test users.

How do I get a new refresh token? Please give me the exact URL to open in my browser and the exact curl command to exchange the code.
```

### Replit Connector Rewrite Help
```
[Paste the intro statement]

I need to rewrite the authentication code in [file name] to work without Replit connectors. Here is the current file:

[paste the first 60 lines]

Currently it uses Replit's connector API (REPLIT_CONNECTORS_HOSTNAME, REPL_IDENTITY) which doesn't exist on my self-hosted Pi. I need it to use direct OAuth 2.0 refresh token flow with environment variables (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN).

Please rewrite only the authentication function. Keep everything else the same. The function should cache the access token and refresh it automatically before it expires.
```
