# Complete Troubleshooting Guide — Self-Hosting on Raspberry Pi

This guide covers every section of the Self-Hosting Guide and gives you:
1. What can go wrong in each step
2. How to diagnose the problem
3. How to fix it
4. A ready-to-copy ChatGPT prompt if you need AI help

---

## ChatGPT Introduction Statement (Copy This First, Every Time)

Whenever you need to ask ChatGPT for help with this project, **paste this block first** before describing your problem. It gives ChatGPT enough context to understand what you're working with:

---

> **Copy everything between the lines below:**

---

```
I am self-hosting a full-stack academic task management web application on a Raspberry Pi 5 (8GB RAM) running Raspberry Pi OS Lite (64-bit, no desktop environment).

The app is built with:
- Backend: Node.js 20 + Express.js + TypeScript
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui components
- Database: PostgreSQL (local, on the same Pi)
- ORM: Drizzle ORM (schema defined in shared/schema.ts, pushed with "npm run db:push")
- Build: The app is built with "npm run build" which compiles TypeScript and bundles the frontend. The production server runs with "node dist/index.js" on port 5000.
- Process Manager: systemd service called "dashboard" (runs as user "pi", working directory /opt/dashboard)

The app integrates with:
- Home Assistant (via REST API using a long-lived access token) for smart home automation, media player control, and sensor data
- Google Calendar API (OAuth 2.0) for calendar events
- Gmail API (OAuth 2.0) for email processing
- Spotify Web API (OAuth 2.0) for music playback control
- Microsoft Graph API (OAuth 2.0) for OneDrive file access and Outlook calendar
- OpenAI TTS API for text-to-speech audio generation (with Edge TTS and espeak-ng as fallbacks)

The app has a "cat washroom study reading system" that:
- Converts PDF files to text, chunks them, generates TTS audio
- Plays audio on a Google Nest speaker via Home Assistant's media_player service
- Syncs a follow-along text display on a Fire Tablet and Samsung TV via a Fire Stick
- Is triggered by Home Assistant webhooks (light switches, buttons, voice commands)
- Uses webhook endpoints like /api/webhook/cat-lights, /api/webhook/voice-command, etc.

The app serves both the API and the React frontend from the same Express server on port 5000. In production, Vite builds static files that Express serves.

The main server file is server/routes.ts (~17,000 lines). The database schema is in shared/schema.ts. The frontend entry point is client/src/App.tsx.

Environment variables are stored in /opt/dashboard/.env and loaded via systemd's EnvironmentFile directive.

Here is my problem:
```

---

> **Then describe your specific problem after "Here is my problem:"**

---

## Section-by-Section Troubleshooting

---

### Section 1: Flashing the OS (Raspberry Pi Imager)

#### Problem: "The imager won't detect my microSD card"
**Diagnosis:**
```bash
# On your computer (not the Pi), check if the card is detected
# Windows: Open Disk Management (right-click Start then Disk Management)
# Mac: Open Disk Utility
# Linux: Run:
lsblk
```
**Fixes:**
- Try a different USB port
- Try a different card reader
- The card might be locked — check the tiny switch on the side of the SD adapter (slide it UP toward the label end)
- Try formatting the card first with SD Card Formatter from sdcard.org/downloads/formatter/

#### Problem: "Flash completed but verification failed"
**Fixes:**
- Re-download the Raspberry Pi Imager (your download might be corrupted)
- Try a different microSD card — verification failures often mean the card is defective
- Make sure you're not running out of space on the card

**ChatGPT prompt addition:**
```
I'm using Raspberry Pi Imager to flash Raspberry Pi OS Lite (64-bit) to a microSD card for a Raspberry Pi 5. The flash completes but verification fails. I've tried [describe what you tried]. Here is the error message: [paste error]
```

---

### Section 2: First Boot and SSH

#### Problem: "ssh: connect to host dashboard-server.local port 22: Connection refused"
**Diagnosis:**
```bash
# Try pinging the hostname
ping dashboard-server.local

# If that doesn't work, find the Pi's IP from your router's admin page
# (usually 192.168.1.1 or 192.168.0.1 in a browser)
# Then try:
ssh pi@192.168.1.XXX
```
**Fixes:**
- Wait longer — first boot can take up to 5 minutes
- Make sure ethernet cable is plugged in before powering on
- Check that SSH was enabled in the Imager settings (if not, you need to re-flash)
- If using Wi-Fi only: the Pi might not have connected — re-flash with correct Wi-Fi credentials

#### Problem: "Permission denied (publickey)" or wrong password
**Fixes:**
- Make sure you're using the password you set in the Imager (not the default "raspberry")
- If you forgot the password, re-flash the card with new settings
- If you get publickey errors, force password auth:
```bash
ssh -o PreferredAuthentications=password pi@dashboard-server.local
```

**ChatGPT prompt addition:**
```
I flashed Raspberry Pi OS Lite (64-bit) to a Pi 5 using Raspberry Pi Imager with SSH enabled, username "pi", and a custom password. When I try to SSH in, I get this error: [paste error]. I am connected via [ethernet/wifi]. My router shows [does it show the Pi or not?].
```

---

### Section 3: Installing System Dependencies

#### Problem: "E: Unable to locate package nodejs" or Node.js version is wrong
**Diagnosis:**
```bash
node --version
# Should show v20.x.x
```
**Fixes:**
```bash
# Remove any old Node.js
sudo apt remove -y nodejs
sudo rm -f /etc/apt/sources.list.d/nodesource.list

# Re-add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

#### Problem: "espeak-ng: command not found" after installing
**Fix:**
```bash
sudo apt install -y espeak-ng
# If still not found:
which espeak-ng
# Should show /usr/bin/espeak-ng
```

#### Problem: "pip3 install edge-tts" fails
**Fixes:**
```bash
# Make sure pip is installed
sudo apt install -y python3-pip python3-venv

# Try with --break-system-packages flag (required on newer Debian/Pi OS)
pip3 install edge-tts --break-system-packages

# Verify
edge-tts --version
```

**ChatGPT prompt addition:**
```
I'm installing dependencies on a Raspberry Pi 5 running Raspberry Pi OS Lite (64-bit, Debian Bookworm based). I ran the following command: [paste command]. I got this error: [paste error]. My current versions are: Node [paste node --version], Python [paste python3 --version], pip [paste pip3 --version].
```

---

### Section 4: Setting Up PostgreSQL

#### Problem: "psql: error: connection refused" or "role does not exist"
**Diagnosis:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If it's not running:
sudo systemctl start postgresql
sudo systemctl enable postgresql
```
**Fixes:**
```bash
# If the user already exists and you need to reset the password:
sudo -u postgres psql -c "ALTER USER dashboard WITH PASSWORD 'your_new_password';"

# If the database already exists:
sudo -u postgres psql -c "DROP DATABASE dashboard_db;"
sudo -u postgres psql -c "CREATE DATABASE dashboard_db OWNER dashboard;"
```

#### Problem: "FATAL: Peer authentication failed for user 'dashboard'"
**Fix:** Edit the PostgreSQL auth config:
```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```
Find the line that says:
```
local   all   all   peer
```
Change `peer` to `md5`:
```
local   all   all   md5
```
Then restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

**ChatGPT prompt addition:**
```
I'm setting up PostgreSQL on a Raspberry Pi 5 (Raspberry Pi OS Lite, Debian Bookworm). I created a user called "dashboard" and a database called "dashboard_db". When I try to connect, I get this error: [paste error]. Here is my pg_hba.conf: [paste relevant lines]. PostgreSQL version: [paste psql --version].
```

---

### Section 5: Transferring the Code

#### Problem: "scp: command not found" (on Windows)
**Fix:** Use one of these instead:
- **PowerShell** (Windows 10+): scp should work natively in PowerShell
- **WinSCP**: Free graphical tool — download from winscp.net. Just drag and drop files.
- **FileZilla**: Another free option — set protocol to SFTP, port 22

#### Problem: "npm install" fails with errors
**Diagnosis:**
```bash
# Check available memory
free -h

# Check disk space
df -h
```
**Fixes:**
```bash
# If out of memory (Pi 5 8GB should be fine, but just in case):
# Create a swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Then retry
npm install

# If you get permission errors:
sudo chown -R pi:pi /opt/dashboard
npm install
```

#### Problem: "npm install" hangs or takes forever
**Fixes:**
- This is normal on a Pi for the first install — it can take 5-10 minutes
- If it's been more than 15 minutes, press Ctrl+C and try again
- Make sure you have a stable internet connection

**ChatGPT prompt addition:**
```
I transferred my Node.js project to a Raspberry Pi 5 at /opt/dashboard. When I run "npm install", I get this error: [paste error]. My Node version is [paste node --version]. My npm version is [paste npm --version]. Available memory: [paste output of "free -h"]. Disk space: [paste output of "df -h /opt/dashboard"].
```

---

### Section 6: Environment Variables (.env file)

#### Problem: "The app starts but can't connect to the database"
**Diagnosis:**
```bash
# Check your DATABASE_URL format
grep DATABASE_URL /opt/dashboard/.env

# It should look exactly like this (with your actual password):
# DATABASE_URL=postgresql://dashboard:YOUR_PASSWORD@localhost:5432/dashboard_db
```
**Common mistakes:**
- Password contains special characters that need escaping (wrap the whole URL in quotes, or URL-encode special chars like @ # % etc.)
- Typo in the database name (dashboard_db)
- PostgreSQL isn't running: sudo systemctl status postgresql

#### Problem: "Home Assistant webhooks aren't working"
**Diagnosis:**
```bash
# Test the HA connection from the Pi
curl -s -H "Authorization: Bearer YOUR_HA_TOKEN" \
  https://YOUR_HA_URL/api/ | head -20

# You should see: {"message": "API running."}
```
**Fixes:**
- Make sure your HA long-lived access token is correct (generate a new one from HA, go to Profile, then Long-Lived Access Tokens)
- If using Nabu Casa URL: make sure your HA subscription is active
- If using local URL: make sure the Pi can reach HA on your network

**ChatGPT prompt addition:**
```
I'm setting up environment variables for my self-hosted Node.js app on a Raspberry Pi 5. The .env file is at /opt/dashboard/.env. When the app starts, I see this error in the logs: [paste error]. Here are the relevant environment variables (with secrets redacted): DATABASE_URL=postgresql://dashboard:***@localhost:5432/dashboard_db, HOME_ASSISTANT_TOKEN=[present/missing], DEPLOYED_APP_URL=[paste value].
```

---

### Section 7: OAuth Setup (Google, Spotify, Microsoft)

This is the hardest part. Here's how to troubleshoot each one.

#### Google (Calendar + Gmail)

**Problem: "Error 400: redirect_uri_mismatch"**
**Fix:** The redirect URI in your Google Cloud Console must EXACTLY match what the app sends. Go to:
1. console.cloud.google.com, then your project, then Credentials, then your OAuth client
2. Under "Authorized redirect URIs", add:
```
http://dashboard-server.local:5000/api/google/callback
```
(or use the Pi's IP address: http://192.168.1.XXX:5000/api/google/callback)

**Problem: "Access blocked: This app's request is invalid" or "Error 403"**
**Fix:**
1. Make sure the Calendar API and Gmail API are enabled:
   - Go to APIs and Services, then Library
   - Search "Google Calendar API", then click Enable
   - Search "Gmail API", then click Enable
2. If the app is in "Testing" mode, add your email as a test user:
   - Go to OAuth consent screen, then Test users, then Add your Gmail address

**Problem: "invalid_grant" error when using the refresh token**
**Fix:** The refresh token has expired or been revoked. You need to redo the OAuth flow:
1. Open the authorization URL in a browser
2. Sign in and approve
3. Copy the new authorization code
4. Exchange it for new tokens
5. Update your .env with the new refresh token

**ChatGPT prompt addition:**
```
I'm setting up Google OAuth 2.0 for my self-hosted Node.js app on a Raspberry Pi. I need Calendar API (read) and Gmail API (read) access. I created an OAuth 2.0 client in Google Cloud Console with redirect URI http://[my-pi-address]:5000/api/google/callback. When I try to authorize, I get this error: [paste error]. My OAuth consent screen is set to [Internal/External] and is in [Testing/Production] mode.
```

#### Spotify

**Problem: "INVALID_CLIENT" error**
**Fix:** Double-check your Client ID and Client Secret at developer.spotify.com/dashboard. Make sure:
- The redirect URI is added: http://dashboard-server.local:5000/api/spotify/callback
- You're using the correct app's credentials (not a different app)

**Problem: "Insufficient client scope"**
**Fix:** When doing the OAuth flow, make sure you request all needed scopes. The app needs:
```
user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read user-read-recently-played streaming
```

**ChatGPT prompt addition:**
```
I'm setting up Spotify OAuth for my self-hosted Node.js app. I created a Spotify app at developer.spotify.com with redirect URI http://[my-pi-address]:5000/api/spotify/callback. When I try to [authorize/play music/get playlists], I get this error: [paste error]. I have these scopes configured: [list scopes].
```

#### Microsoft (OneDrive + Outlook)

**Problem: "AADSTS50011: The reply URL specified in the request does not match"**
**Fix:** In Azure Portal, go to App registrations, then your app, then Authentication:
- Add the redirect URI: http://dashboard-server.local:5000/api/microsoft/callback
- Make sure it's under "Web" platform (not SPA or Mobile)

**Problem: "Insufficient privileges to complete the operation"**
**Fix:** In Azure Portal, go to App registrations, then your app, then API permissions:
- Add these permissions (Delegated, not Application):
  - Files.ReadWrite (OneDrive)
  - Mail.Read (Outlook mail)
  - Calendars.Read (Outlook calendar)
- Click "Grant admin consent" if you're the admin
- If you're not the admin, you need to ask your admin to approve

**ChatGPT prompt addition:**
```
I'm setting up Microsoft OAuth (Azure AD) for my self-hosted Node.js app. I registered an app in Azure Portal with redirect URI http://[my-pi-address]:5000/api/microsoft/callback. I need OneDrive (Files.ReadWrite), Outlook mail (Mail.Read), and Outlook calendar (Calendars.Read) access. When I try to [authorize/access files/read calendar], I get this error: [paste error]. My app registration is set to [single tenant/multi-tenant]. The API permissions I've configured are: [list them].
```

---

### Section 8: Database Initialization (db:push)

#### Problem: "npm run db:push" fails with connection error
**Diagnosis:**
```bash
# Make sure PostgreSQL is running
sudo systemctl status postgresql

# Test the connection manually
psql -U dashboard -d dashboard_db -h localhost
# Enter your password when prompted
# If you get in, type \q to exit
```
**Fixes:**
- Check DATABASE_URL in .env matches exactly
- Make sure PostgreSQL is listening on localhost:
```bash
sudo grep "listen_addresses" /etc/postgresql/*/main/postgresql.conf
# Should show: listen_addresses = 'localhost'
```

#### Problem: "relation already exists" or migration conflicts
**Fix:**
```bash
# Force push (drops and recreates tables — WARNING: destroys existing data)
npm run db:push --force

# Or drop the database and start fresh:
sudo -u postgres psql -c "DROP DATABASE dashboard_db;"
sudo -u postgres psql -c "CREATE DATABASE dashboard_db OWNER dashboard;"
npm run db:push
```

**ChatGPT prompt addition:**
```
I'm using Drizzle ORM with PostgreSQL on a Raspberry Pi. My schema is defined in shared/schema.ts and I'm running "npm run db:push" to create the tables. I get this error: [paste error]. My DATABASE_URL is postgresql://dashboard:***@localhost:5432/dashboard_db. PostgreSQL is [running/not running]. Drizzle config is in drizzle.config.ts.
```

---

### Section 9: Build and Test

#### Problem: "npm run build" fails with TypeScript errors
**Diagnosis:**
```bash
# Run the build and save the full error output
npm run build 2>&1 | tee /tmp/build-errors.txt

# Look at the first error (fix errors from top to bottom)
head -50 /tmp/build-errors.txt
```
**Fixes:**
- Most build errors are TypeScript type issues — they don't affect whether the app runs, but they block the build
- If you get "out of memory" during build:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### Problem: "node dist/index.js" crashes immediately
**Diagnosis:**
```bash
# Run it and see the error
node dist/index.js 2>&1 | head -50
```
**Common causes:**
- Missing .env file or environment variables
- PostgreSQL not running
- Port 5000 already in use: run `sudo fuser -k 5000/tcp` then try again
- Missing npm packages: run `npm install` again

#### Problem: "App starts but the page is blank in the browser"
**Fixes:**
- Make sure you ran `npm run build` (not just dev mode — dev mode won't work in production)
- Check that dist/public exists and contains files: `ls dist/public/`
- Try accessing http://PI_IP_ADDRESS:5000 (not localhost — you're not on the Pi)

**ChatGPT prompt addition:**
```
I built my Node.js + React + Vite app on a Raspberry Pi 5 using "npm run build". The build [succeeded/failed with these errors: paste errors]. When I run "node dist/index.js", [it crashes with: paste error / it starts but: describe what happens]. I'm trying to access it from another device at http://[Pi address]:5000.
```

---

### Section 10: systemd Service

#### Problem: "Service dashboard failed to start"
**Diagnosis:**
```bash
# Check the status
sudo systemctl status dashboard

# Check the logs
sudo journalctl -u dashboard -n 50 --no-pager

# Check if the service file is correct
cat /etc/systemd/system/dashboard.service
```
**Fixes:**
- Make sure the paths are correct in the service file:
  - WorkingDirectory=/opt/dashboard — this directory must exist
  - ExecStart=/usr/bin/node dist/index.js — verify the node path with `which node`
  - EnvironmentFile=/opt/dashboard/.env — this file must exist
- After editing the service file:
```bash
sudo systemctl daemon-reload
sudo systemctl restart dashboard
```

#### Problem: "Service starts but keeps restarting"
**Diagnosis:**
```bash
# Watch the logs live
sudo journalctl -u dashboard -f
```
**Common causes:**
- The app crashes on startup (database connection, missing env vars)
- Port 5000 is already in use by another process
- File permissions: run `sudo chown -R pi:pi /opt/dashboard`

**ChatGPT prompt addition:**
```
I set up a systemd service on a Raspberry Pi 5 to run my Node.js app. The service file is at /etc/systemd/system/dashboard.service. When I run "sudo systemctl start dashboard", [describe what happens]. Here is the output of "sudo systemctl status dashboard": [paste output]. Here are the last 50 lines of the journal: [paste output of "sudo journalctl -u dashboard -n 50 --no-pager"].
```

---

### Section 11: Home Assistant Webhook Updates

#### Problem: "Webhooks worked on Replit but not from the Pi"
**Diagnosis:**
```bash
# Test if HA can reach the Pi
# From any computer on your network:
curl http://dashboard-server.local:5000/api/version

# You should see a JSON response with the version
```
**Fixes:**
- In HA's configuration.yaml, update ALL rest_command URLs from:
  ```
  https://home-view--bkh416.replit.app/api/webhook/...
  ```
  to:
  ```
  http://RASPBERRY_PI_IP:5000/api/webhook/...
  ```
- Use the Pi's static IP address (not hostname) for reliability — hostnames can be flaky on some networks
- Set a static IP on the Pi:
```bash
sudo nmcli con mod "Wired connection 1" ipv4.addresses 192.168.1.100/24
sudo nmcli con mod "Wired connection 1" ipv4.method manual
sudo nmcli con mod "Wired connection 1" ipv4.gateway 192.168.1.1
sudo nmcli con mod "Wired connection 1" ipv4.dns "8.8.8.8 8.8.4.4"
sudo nmcli con up "Wired connection 1"
```
(Replace the IP addresses with ones appropriate for your network.)

#### Problem: "HA automation fires but the app doesn't respond"
**Diagnosis:**
```bash
# Check if the app is running
sudo systemctl status dashboard

# Check the app logs for incoming webhook requests
sudo journalctl -u dashboard -f
# Then trigger the automation in HA — you should see log lines starting with [Cat Lights] or [Shower Button] etc.
```
**Fixes:**
- If no log lines appear: HA isn't reaching the app. Check the URL in your rest_command.
- If log lines appear but show errors: the error message will tell you what's wrong
- Make sure there's no firewall blocking port 5000:
```bash
sudo ufw status
# If active and port 5000 is not allowed:
sudo ufw allow 5000
```

**ChatGPT prompt addition:**
```
I'm connecting Home Assistant to my self-hosted Node.js app on a Raspberry Pi 5. HA is running on a separate device at [HA URL]. My app is at http://[Pi IP]:5000. I updated the rest_commands in configuration.yaml to point to the Pi. When I trigger the automation for [cat lights/shower button/voice command/etc.], [describe what happens — nothing, error, partial response]. Here are the HA rest_commands I configured: [paste relevant yaml]. Here are the app logs when I trigger it: [paste logs].
```

---

### Section 12: Google Apps Script (Gmail Webhooks)

#### Problem: "Google Apps Script can't reach the Pi"
**Explanation:** Google Apps Script runs in Google's cloud — it can't access devices on your home network directly. The Pi is behind your router's firewall.

**Solutions (pick one):**

**1. Cloudflare Tunnel (recommended, free):**
```bash
# Install cloudflared on the Pi
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate (follow the URL it gives you)
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create dashboard

# Configure it
mkdir -p ~/.cloudflared
```
Then create ~/.cloudflared/config.yml with:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/pi/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: dashboard.yourdomain.com
    service: http://localhost:5000
  - service: http_status:404
```
Then run:
```bash
cloudflared tunnel run dashboard
```

**2. Keep using Replit just for Gmail webhooks** — easiest option, no network changes needed

**3. Port forwarding** — forward port 5000 on your router to the Pi's IP (less secure, not recommended)

**ChatGPT prompt addition:**
```
I have a Google Apps Script that sends webhook requests to my web app. The app was previously hosted on Replit (public URL) but I've moved it to a Raspberry Pi on my home network at http://192.168.x.x:5000. The Apps Script can no longer reach the app because it's behind my router. I want to set up [Cloudflare Tunnel / port forwarding / another solution] so Google's servers can reach my Pi. I [do/don't] have a domain name. My router is [brand/model if known].
```

---

### Section 13: Touchscreen Setup

#### Problem: "The dashboard looks wrong on my 1920x720 screen"
**Fixes:**
- Make sure the browser is in fullscreen mode (F11)
- Check the zoom level is 100% (Ctrl+0 to reset)
- The app is designed for exactly 1920x720 — other resolutions will look different

#### Problem: "Touch events aren't working"
**Fixes:**
- Most USB touchscreens work out of the box with Pi OS
- If touch is offset or inverted:
```bash
# List input devices
xinput list

# Calibrate
sudo apt install -y xinput-calibrator
xinput_calibrator
```

---

## General: App Crashes / Won't Start

#### Quick diagnostic checklist:
```bash
# 1. Is PostgreSQL running?
sudo systemctl status postgresql

# 2. Is the app service running?
sudo systemctl status dashboard

# 3. What do the logs say?
sudo journalctl -u dashboard -n 100 --no-pager

# 4. Can you start it manually?
cd /opt/dashboard
node dist/index.js

# 5. Is port 5000 free?
sudo fuser 5000/tcp
# If something is using it:
sudo fuser -k 5000/tcp

# 6. Is the .env file readable?
cat /opt/dashboard/.env | head -5

# 7. Are node_modules installed?
ls /opt/dashboard/node_modules | head -5

# 8. Is the build up to date?
ls -la /opt/dashboard/dist/index.js
```

#### How to share logs with ChatGPT:
```bash
# Save the last 200 lines of logs to a file
sudo journalctl -u dashboard -n 200 --no-pager > /tmp/dashboard-logs.txt

# Then copy the contents and paste into ChatGPT after the intro statement
cat /tmp/dashboard-logs.txt
```

---

## General: Database Issues

#### Problem: "relation 'tasks' does not exist" (or any table)
```bash
# Tables weren't created. Run:
cd /opt/dashboard
npm run db:push
```

#### Problem: "column 'xyz' does not exist" (schema out of sync)
```bash
# Schema changed but database wasn't updated. Run:
cd /opt/dashboard
npm run db:push
# If that fails:
npm run db:push --force
# WARNING: --force may drop and recreate tables, losing data. Back up first:
pg_dump -U dashboard dashboard_db > backup_before_push.sql
```

#### Problem: "ECONNREFUSED 127.0.0.1:5432" (can't connect to database)
```bash
# PostgreSQL isn't running
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**ChatGPT prompt addition:**
```
I'm running PostgreSQL on a Raspberry Pi 5 for my Node.js app. The database is called "dashboard_db" and the user is "dashboard". I'm using Drizzle ORM with the schema in shared/schema.ts. When the app tries to [query/insert/connect], I get this error: [paste error]. PostgreSQL status: [paste output of "sudo systemctl status postgresql"]. I can/cannot connect manually with: psql -U dashboard -d dashboard_db -h localhost.
```

---

## General: App Works But Something Specific Is Broken

If the app loads but a specific feature doesn't work, here's how to give ChatGPT the right context:

**For calendar issues:**
```
[Paste the intro statement from the top of this guide]

The calendar integration with [Google/Outlook/both] is not working. When I [open the dashboard/click on a date/try to create an event], I see [describe what happens]. The browser console shows: [open browser dev tools with F12, go to Console tab, paste any red errors]. The server logs show: [paste relevant lines from "sudo journalctl -u dashboard -n 50 --no-pager"].
```

**For Spotify issues:**
```
[Paste the intro statement from the top of this guide]

The Spotify integration is not working. When I [try to play/pause/see playlists], I see [describe what happens]. My Spotify OAuth tokens are [present in .env / missing]. The server logs show: [paste relevant lines].
```

**For cat washroom / TTS issues:**
```
[Paste the intro statement from the top of this guide]

The cat washroom study reading system is not working correctly. When I [turn on the cat lights / press the shower button / say a voice command], [describe what happens vs what should happen]. The server logs show: [paste the lines starting with "[Cat Lights]" or "[Shower Button]" or "[Voice Command]" from "sudo journalctl -u dashboard -f"].

The system uses these HA entities:
- Nest speaker: media_player.bathroom_speaker
- HA Voice: media_player.home_assistant_voice_097c38_media_player
- Fire Stick: media_player.fire_tv_172_24_0_88
- Samsung TV: media_player.tv_cat_wr
- Fire Tablet: media_player.tablet_cat (uses tablet-nav polling, NOT ADB)
- Echo speakers: media_player.echo_cat_left_am, echo_cat_right_am, echo_cat_washroom_middle
- Echo group: media_player.cat_washroom_media_group
```

**For weather/ticker issues:**
```
[Paste the intro statement from the top of this guide]

The weather/news ticker at the bottom of the dashboard is [not showing / showing wrong data / showing errors]. The ticker gets data from Home Assistant sensors (sensor.dashboard_ticker, sensor.dashboard_weather, sensor.dashboard_news). The server logs show: [paste relevant lines]. The HA sensors show: [check in HA Developer Tools then States].
```

---

## Quick Reference: Useful Commands

| What You Want To Do | Command |
|---------------------|---------|
| Check if app is running | sudo systemctl status dashboard |
| View live logs | sudo journalctl -u dashboard -f |
| View last 100 log lines | sudo journalctl -u dashboard -n 100 --no-pager |
| Restart the app | sudo systemctl restart dashboard |
| Stop the app | sudo systemctl stop dashboard |
| Start the app | sudo systemctl start dashboard |
| Check PostgreSQL | sudo systemctl status postgresql |
| Check disk space | df -h |
| Check memory | free -h |
| Check what's using port 5000 | sudo fuser 5000/tcp |
| Kill whatever's on port 5000 | sudo fuser -k 5000/tcp |
| Back up the database | pg_dump -U dashboard dashboard_db > backup.sql |
| Rebuild the app | npm run build |
| Update database schema | npm run db:push |
| Check Pi temperature | vcgencmd measure_temp |
| Check Pi CPU usage | top -bn1 (then press q to exit) |
