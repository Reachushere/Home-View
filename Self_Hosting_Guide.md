# Self-Hosting Guide: Dashboard App on Raspberry Pi

## Table of Contents

### Part 1: Setup
1. [Can I Run This on My Home Assistant Laptop?](#can-i-run-this-on-my-home-assistant-laptop)
2. [Equipment to Buy (Amazon Links)](#equipment-to-buy)
3. [Step 1: Flash the Operating System](#step-1-flash-the-operating-system)
4. [Step 2: First Boot](#step-2-first-boot)
5. [Step 3: Install System Dependencies](#step-3-install-system-dependencies)
6. [Step 4: Set Up the Database](#step-4-set-up-the-database)
7. [Step 5: Create the App Directory](#step-5-create-the-app-directory)
8. [Step 6: Get the Code Out of Replit](#step-6-get-the-code-out-of-replit)
9. [Step 7: Set Up Environment Variables](#step-7-set-up-environment-variables)
10. [Step 8: Setting Up OAuth Credentials](#step-8-setting-up-oauth-credentials-the-hard-part)
11. [Step 9: Initialize the Database](#step-9-initialize-the-database)
12. [Step 10: Build and Test](#step-10-build-and-test)
13. [Step 11: Set Up Auto-Start (systemd Service)](#step-11-set-up-auto-start-systemd-service)
14. [Step 12: Set Up Log Rotation](#step-12-set-up-log-rotation)
15. [Step 13: Update Home Assistant Webhooks](#step-13-update-home-assistant-webhooks)
16. [Step 14: Update Google Apps Script](#step-14-update-google-apps-script)
17. [Step 15: Touchscreen Setup](#step-15-touchscreen-setup)

### Part 2: Ongoing Maintenance
18. [Viewing Logs](#viewing-logs)
19. [Restarting / Updating / Backing Up](#restarting-the-app)
20. [Key Differences from Replit](#key-differences-from-replit)
21. [Estimated Migration Effort](#estimated-migration-effort)

### Part 3: Home Assistant YAML Reference
22. [REST Commands (configuration.yaml)](#rest-commands-configurationyaml)
23. [HA Automations (automations.yaml)](#ha-automations-automationsyaml)
24. [HA Input Booleans](#ha-input-booleans-configurationyaml)

### Part 4: Cat Washroom Study Reading System — Complete Flow
25. [Devices Involved](#devices-involved)
26. [Flow A: Lights Turn ON — Full Prompt Flow](#flow-a-lights-turn-on--full-prompt-flow)
27. [Flow B: Lights Turn OFF — Stop Everything](#flow-b-lights-turn-off--stop-everything)
28. [Flow C: Confirmed Playback Flow (Reading the PDF)](#flow-c-confirmed-playback-flow-reading-the-pdf)
29. [Flow D: Shower Button — Direct Play](#flow-d-shower-button--direct-play-skip-prompt)
30. [Flow E: Volume Knob](#flow-e-volume-knob--adjust-active-speaker-volume)
31. [Flow F: Knob Press — Master STOP](#flow-f-knob-press--master-stop)
32. [Flow G: Toothbrush Auto-Stop](#flow-g-toothbrush-auto-stop)
33. [Flow H: Voice Commands (pause/resume/stop/skip/restart/reset)](#flow-h-voice-commands)
34. [Flow I: Play Urgent PDF](#flow-i-play-urgent-pdf-on-demand)
35. [TTS Fallback Chain](#tts-fallback-chain)
36. [Background Processes](#background-processes-no-webhook-needed)

---

## Can I Run This on My Home Assistant Laptop?

No, not directly. Home Assistant OS is a locked-down, purpose-built Linux distribution — it manages its own filesystem, networking, and containers. You can't install Node.js, PostgreSQL, or run arbitrary apps alongside it. It's designed to only run HA and its add-ons. You'd need to replace HAOS with a regular Linux install to do that, which would mean rebuilding your entire HA setup.

A Raspberry Pi 5 on the same local network is the right approach — fast, cheap, always-on, and won't interfere with your HA installation.

---

## Equipment to Buy

| Item | Model / Spec | Approx. Price | Amazon Link |
|------|-------------|---------------|-------------|
| **Raspberry Pi 5** | **8 GB RAM** | ~$80 USD | [amazon.ca/dp/B0CTG5148Q](https://www.amazon.ca/dp/B0CTG5148Q) |
| **Power Supply** | Official Raspberry Pi 5 27W USB-C | ~$12 | [amazon.ca/dp/B0CN1HP2P7](https://www.amazon.ca/dp/B0CN1HP2P7) |
| **microSD Card** | Samsung EVO Select 128 GB (A2-rated) | ~$13 | [amazon.ca/dp/B09B1HMJ9Z](https://www.amazon.ca/dp/B09B1HMJ9Z) |
| **Active Cooler** | Official Raspberry Pi 5 Active Cooler | ~$5 | [amazon.ca/dp/B0CN1GXRKQ](https://www.amazon.ca/dp/B0CN1GXRKQ) |
| **Case** | Official Pi 5 Case (Red/White) | ~$10 | [amazon.ca/dp/B0CN1HP2RZ](https://www.amazon.ca/dp/B0CN1HP2RZ) |
| **Ethernet Cable** | Cat 6, 3-foot or whatever length you need | ~$5 | [amazon.ca/dp/B00N2VILDM](https://www.amazon.ca/dp/B00N2VILDM) |
| **USB microSD Reader** | Anker USB 3.0 Card Reader | ~$8 | [amazon.ca/dp/B006T9B6R2](https://www.amazon.ca/dp/B006T9B6R2) |

**Total: ~$125–135 USD**

**Notes:**
- The 8 GB Pi 5 is essential — Node.js + PostgreSQL + TTS audio processing need the memory. 4 GB would be tight.
- The official 27W power supply is important — underpowered supplies cause random crashes and SD card corruption.
- The microSD must be A2-rated for the random read/write speed needed by PostgreSQL.
- The active cooler is necessary because TTS processing pushes the CPU under sustained load. A passive heatsink alone won't cut it.
- If your PC already has a microSD slot, skip the USB reader.

---

## Setup Instructions

### Step 1: Flash the Operating System

1. On your regular computer, download **Raspberry Pi Imager** from [raspberrypi.com/software](https://www.raspberrypi.com/software/)
2. Insert the microSD card into your computer
3. Open the Imager and choose:
   - **Device:** Raspberry Pi 5
   - **OS:** Raspberry Pi OS (64-bit, Lite) — no desktop environment needed
4. Click the **gear icon** before flashing and configure:
   - **Enable SSH:** Yes
   - **Username:** `pi`
   - **Password:** (set a strong password)
   - **Wi-Fi:** Enter your network name and password (as backup even if using ethernet)
   - **Hostname:** `dashboard-server`
5. Flash the card and wait for verification to complete

### Step 2: First Boot

1. Insert the microSD card into the Pi 5
2. Connect the ethernet cable to your router
3. Plug in the power supply
4. Wait approximately 2 minutes for the first boot to complete
5. From your computer, open a terminal and connect:
   ```bash
   ssh pi@dashboard-server.local
   ```
   If that doesn't resolve, check your router's admin page for the Pi's IP address and use:
   ```bash
   ssh pi@<IP_ADDRESS>
   ```
6. Enter the password you set during flashing

### Step 3: Install System Dependencies

Run each block of commands in order:

```bash
# Update the system
sudo apt update && sudo apt upgrade -y
```

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

```bash
# Install build tools (required for some npm packages)
sudo apt install -y build-essential git
```

```bash
# Install espeak-ng (local offline TTS fallback)
sudo apt install -y espeak-ng
```

```bash
# Install Edge TTS (Microsoft TTS fallback)
sudo apt install -y python3-pip
pip3 install edge-tts --break-system-packages
```

Verify installations:
```bash
node --version        # Should show v20.x.x
psql --version        # Should show 16.x
espeak-ng --version   # Should show espeak-ng version
edge-tts --version    # Should show edge-tts version
```

### Step 4: Set Up the Database

```bash
# Create the database user
sudo -u postgres psql -c "CREATE USER dashboard WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';"

# Create the database
sudo -u postgres psql -c "CREATE DATABASE dashboard_db OWNER dashboard;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dashboard_db TO dashboard;"
```

Replace `CHOOSE_A_STRONG_PASSWORD` with an actual secure password. Write it down — you'll need it for the environment file.

### Step 5: Create the App Directory

```bash
sudo mkdir -p /opt/dashboard
sudo chown pi:pi /opt/dashboard
cd /opt/dashboard
```

### Step 6: Get the Code Out of Replit

Your entire app — every file, every line of code — is yours and can be downloaded at any time. Here are three ways to get it:

**Option A — Download as ZIP (easiest, no account needed):**

1. In Replit, look at the left sidebar where your files are listed
2. Click the **three dots (...)** at the top of the file panel
3. Click **"Download as ZIP"**
4. A `.zip` file will download to your computer (probably to your Downloads folder)
5. That ZIP contains everything: all the server code, frontend code, database schema, configuration files, this guide — all of it

To transfer the ZIP to your Pi, open a terminal on your regular computer and run:
```bash
scp ~/Downloads/home-view.zip pi@dashboard-server.local:/opt/dashboard/
```
(If your computer is Windows, you can use WinSCP or drag-and-drop the file using FileZilla instead.)

Then on the Pi (SSH in first):
```bash
cd /opt/dashboard
sudo apt install -y unzip    # install unzip if not already there
unzip home-view.zip
npm install
```

**Option B — Push to GitHub first (better for ongoing updates):**

1. In Replit, click the **Git** icon in the left sidebar (the branch icon)
2. Click **"Connect to GitHub"** and follow the prompts to create a repository
3. Once connected, all your code is on GitHub — you can access it from anywhere, forever

Then on the Pi:
```bash
cd /opt/dashboard
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
npm install
```

Future updates become easy: edit on Replit, push to GitHub, then `git pull && npm install && npm run build && sudo systemctl restart dashboard` on the Pi.

**Option C — Copy files directly via SCP (no ZIP needed):**

If you just want to copy the project folder from your computer after downloading:
```bash
scp -r ~/Downloads/home-view/* pi@dashboard-server.local:/opt/dashboard/
```

**What you're getting:**
The download includes absolutely everything that makes the app work:
- `server/routes.ts` — the entire backend (all webhooks, TTS, Spotify, calendar, cat washroom logic)
- `server/storage.ts` — database operations
- `shared/schema.ts` — database table definitions
- `client/src/` — the entire frontend (dashboard, Spotify player, PDF reader, OneNote, settings)
- `package.json` — all the dependency definitions (npm install will download them)
- `Self_Hosting_Guide.md` — this guide
- `HA_Automations_Reference.md` — the full HA automations reference
- Everything else: configuration files, assets, styles

The code is fully self-contained. You don't need Replit to run it — it's a standard Node.js + PostgreSQL app that runs anywhere.

### Step 7: Set Up Environment Variables

Create the environment file:
```bash
nano /opt/dashboard/.env
```

Add the following (fill in your actual values):
```env
# Database
DATABASE_URL=postgresql://dashboard:CHOOSE_A_STRONG_PASSWORD@localhost:5432/dashboard_db

# Home Assistant
HOME_ASSISTANT_TOKEN=your_long_lived_access_token_from_ha

# App URL (update to Pi's address)
DEPLOYED_APP_URL=http://dashboard-server.local:5000

# Google Calendar OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token

# Spotify OAuth (from developer.spotify.com)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token

# Microsoft / OneDrive / Outlook (from Azure portal)
MICROSOFT_CLIENT_ID=your_azure_client_id
MICROSOFT_CLIENT_SECRET=your_azure_client_secret
MICROSOFT_REFRESH_TOKEN=your_microsoft_refresh_token

# Gmail (from Google Cloud Console — can be same project as Calendar)
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
```

Save and exit (Ctrl+X, then Y, then Enter).

Secure the file:
```bash
chmod 600 /opt/dashboard/.env
```

### Step 8: Setting Up OAuth Credentials (The Hard Part)

On Replit, the integration connectors handle OAuth automatically. On the Pi, you need to register apps with each service and get refresh tokens manually.

#### Google (Calendar + Gmail)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Calendar API** and **Gmail API**
4. Go to **Credentials**, then Create **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add redirect URI: `http://dashboard-server.local:5000/api/google/callback`
7. Copy the Client ID and Client Secret into your `.env`
8. To get a refresh token, you'll need to do a one-time OAuth flow — open this URL in a browser (replace YOUR_CLIENT_ID):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://dashboard-server.local:5000/api/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/gmail.readonly&access_type=offline&prompt=consent
   ```
9. After authorizing, the callback will receive an authorization code. Exchange it for tokens.

#### Spotify
1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Add redirect URI: `http://dashboard-server.local:5000/api/spotify/callback`
4. Copy Client ID and Client Secret into your `.env`
5. Do the OAuth flow similar to Google to get a refresh token

#### Microsoft (OneDrive + Outlook)
1. Go to [portal.azure.com](https://portal.azure.com) then Azure Active Directory, then App registrations
2. Register a new application
3. Add redirect URI: `http://dashboard-server.local:5000/api/microsoft/callback`
4. Under **Certificates & secrets**, create a new client secret
5. Under **API permissions**, add: `Files.ReadWrite`, `Mail.Read`, `Calendars.Read`
6. Copy Client ID and Client Secret into your `.env`
7. Do the OAuth flow to get a refresh token

### Step 9: Initialize the Database

```bash
cd /opt/dashboard
npm run db:push
```

This creates all the tables. If it asks for confirmation, type `yes`.

### Step 10: Build and Test

```bash
# Build the app
npm run build

# Test run (foreground — you'll see logs)
node dist/index.js
```

Open a browser on your network and go to:
```
http://dashboard-server.local:5000
```

Verify the dashboard loads. Press Ctrl+C to stop the test.

### Step 11: Set Up Auto-Start (systemd Service)

Create the service file:
```bash
sudo nano /etc/systemd/system/dashboard.service
```

Paste this:
```ini
[Unit]
Description=Dashboard App
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/dashboard
EnvironmentFile=/opt/dashboard/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/dashboard.log
StandardError=append:/var/log/dashboard-error.log

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dashboard
sudo systemctl start dashboard
sudo systemctl status dashboard
```

The app will now start automatically on every boot and restart if it crashes.

### Step 12: Set Up Log Rotation

```bash
sudo nano /etc/logrotate.d/dashboard
```

Paste:
```
/var/log/dashboard.log /var/log/dashboard-error.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 pi pi
}
```

### Step 13: Update Home Assistant Webhooks

In your HA `configuration.yaml`, update all `rest_command` URLs from:
```
https://home-view--bkh416.replit.app/api/webhook/...
```
To:
```
http://dashboard-server.local:5000/api/webhook/...
```

Or use the Pi's static IP address instead of the hostname for reliability.

See the **Home Assistant YAML Reference** section below for every `rest_command` and `automation` you need.

### Step 14: Update Google Apps Script

If you have a Google Apps Script pushing emails to the app, update the webhook URLs there too to point to the Pi's address.

**Important:** Since the Pi is on your local network, the Google Apps Script (which runs in the cloud) won't be able to reach `dashboard-server.local`. You'll need either:
- A static public IP with port forwarding on your router (port 5000)
- A reverse tunnel service like **Cloudflare Tunnel** (free) to expose the Pi to the internet securely
- Or keep using Replit just for the Gmail webhook endpoint

### Step 15: Touchscreen Setup

On your 1920x720 touchscreen, open the browser and navigate to:
```
http://dashboard-server.local:5000
```

Bookmark it or set it as the homepage.

---

## Ongoing Maintenance

### Viewing Logs
```bash
# Live logs
sudo journalctl -u dashboard -f

# Or read the log files
tail -100 /var/log/dashboard.log
tail -100 /var/log/dashboard-error.log
```

### Restarting the App
```bash
sudo systemctl restart dashboard
```

### Updating the Code
```bash
cd /opt/dashboard
# Transfer new code (scp or git pull)
npm install
npm run build
sudo systemctl restart dashboard
```

### Backing Up the Database
```bash
pg_dump -U dashboard dashboard_db > /opt/dashboard/backup_$(date +%Y%m%d).sql
```

### Restoring a Backup
```bash
psql -U dashboard dashboard_db < /opt/dashboard/backup_YYYYMMDD.sql
```

---

## Key Differences from Replit

| Feature | Replit | Self-Hosted Pi |
|---------|--------|---------------|
| **OAuth Integrations** | Managed automatically by Replit connectors | You manage tokens, refresh, and re-auth manually |
| **HTTPS** | Automatic | Not included — use Cloudflare Tunnel if needed for external access |
| **Uptime** | Replit manages hosting | You manage power, updates, SD card health |
| **External Webhooks** | Public URL available immediately | Need port forwarding or tunnel for cloud services to reach the Pi |
| **Database Backups** | Replit handles it | You set up cron jobs for backups |
| **Speed** | Cloud latency to HA | Local network — faster for all HA communication |

---

## Estimated Migration Effort

| Task | Time |
|------|------|
| Hardware setup + OS flash | 30 minutes |
| System dependencies | 20 minutes |
| Code transfer + database init | 15 minutes |
| Google OAuth setup | 1-2 hours |
| Spotify OAuth setup | 30 minutes |
| Microsoft OAuth setup | 1-2 hours |
| HA webhook URL updates | 30 minutes |
| Testing everything | 1-2 hours |
| **Total** | **4-7 hours** |

The OAuth setup is the bulk of the work. Everything else is straightforward.

---
---

# Home Assistant YAML Reference

All YAML below goes into your Home Assistant `configuration.yaml` (or split into `automations.yaml` / `rest_commands.yaml` using `!include` if you prefer). Replace `YOUR_APP_URL` with either `https://home-view--bkh416.replit.app` (Replit) or `http://dashboard-server.local:5000` (self-hosted Pi).

---

## REST Commands (configuration.yaml)

These define the HTTP calls HA can make to your app. Every webhook endpoint needs one.

```yaml
rest_command:
  # Cat Washroom Lights — triggers study reading prompt or stop
  cat_lights_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-lights"
    method: POST
    headers:
      Content-Type: "application/json"

  # Cat Washroom Lights — confirmation ("yes, play the reading")
  cat_lights_confirm_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-lights-confirm"
    method: POST
    headers:
      Content-Type: "application/json"

  # Cat Washroom Shower Button — direct play (skips the prompt)
  cat_shower_button_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-shower-button"
    method: POST
    headers:
      Content-Type: "application/json"

  # Cat Washroom Stop — stops playback and saves progress
  cat_wash_stop_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-wash-stop"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"trigger":"{{ trigger }}"}'

  # Cat Washroom Volume Knob — adjusts active speaker volume
  cat_volume_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-volume"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"direction":"{{ direction }}","speed":"{{ speed }}"}'

  # Cat Washroom Knob Press — master STOP button
  cat_knob_press_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-knob-press"
    method: POST
    headers:
      Content-Type: "application/json"

  # Voice Commands — pause, resume, stop, skip, restart, reset
  voice_command_webhook:
    url: "YOUR_APP_URL/api/webhook/voice-command"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"command":"{{ command }}"}'

  # Kitchen Volume Knob — adjusts Kitchen Echo Studio volume
  kitchen_volume_webhook:
    url: "YOUR_APP_URL/api/webhook/kitchen-volume"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"direction":"{{ direction }}","speed":"{{ speed }}"}'

  # Play Urgent PDF — on-demand play most important unlistened reading
  play_urgent_pdf_webhook:
    url: "YOUR_APP_URL/api/webhook/play-urgent-pdf"
    method: POST
    headers:
      Content-Type: "application/json"
      x-webhook-secret: "YOUR_SITE_PASSWORD"
    payload: '{"entity_id":"media_player.nestaudio6787"}'
```

---

## HA Automations (automations.yaml)

### Automation 1: Cat Washroom Lights Changed

Fires whenever the cat washroom lights turn on or off. The app checks the actual state and either starts the study prompt flow (on) or stops everything (off).

```yaml
automation:
  - alias: "Cat Washroom Lights Changed"
    trigger:
      - platform: state
        entity_id: light.cat_lights
    action:
      - service: rest_command.cat_lights_webhook
```

### Automation 2: Cat Washroom Lights Confirmation

Fires when you confirm (button press, voice, or HA toggle) that you want to hear the reading. This resolves the 23-second wait from Automation 1.

```yaml
automation:
  - alias: "Cat Washroom Reading Confirmed"
    trigger:
      - platform: state
        entity_id: input_boolean.module_reading_confirmed
        to: "on"
    action:
      - service: rest_command.cat_lights_confirm_webhook
```

### Automation 3: Cat Washroom Shower Button

Fires when the shower button entity changes. Skips the prompt and goes straight into playback.

```yaml
automation:
  - alias: "Cat Washroom Shower Button"
    trigger:
      - platform: state
        entity_id: switch.cat_shower_button  # or whatever your shower button entity is
    action:
      - service: rest_command.cat_shower_button_webhook
```

### Automation 4: Cat Washroom Volume Knob (Rotate)

Fires when the rotary encoder sends a rotation event. Your ESPHome or Zigbee config should set the `direction` variable to "up" or "down" and `speed` to "normal" or "fast".

```yaml
automation:
  - alias: "Cat Washroom Volume Up"
    trigger:
      - platform: state
        entity_id: sensor.cat_volume_knob_rotation  # your encoder entity
    action:
      - service: rest_command.cat_volume_webhook
        data:
          direction: "{{ 'up' if trigger.to_state.state | float > trigger.from_state.state | float else 'down' }}"
          speed: "normal"

  - alias: "Cat Washroom Volume Fast"
    trigger:
      - platform: state
        entity_id: sensor.cat_volume_knob_fast_rotation  # fast rotation entity
    action:
      - service: rest_command.cat_volume_webhook
        data:
          direction: "{{ 'up' if trigger.to_state.state | float > trigger.from_state.state | float else 'down' }}"
          speed: "fast"
```

### Automation 5: Cat Washroom Knob Press (STOP)

Fires when you press the physical knob button. Stops everything.

```yaml
automation:
  - alias: "Cat Washroom Knob Press STOP"
    trigger:
      - platform: state
        entity_id: binary_sensor.cat_volume_knob_press  # your knob press entity
        to: "on"
    action:
      - service: rest_command.cat_knob_press_webhook
```

### Automation 6: Kitchen Volume Knob

Same pattern as the cat washroom volume knob, but for the kitchen.

```yaml
automation:
  - alias: "Kitchen Volume Up"
    trigger:
      - platform: state
        entity_id: sensor.kitchen_volume_knob_rotation
    action:
      - service: rest_command.kitchen_volume_webhook
        data:
          direction: "{{ 'up' if trigger.to_state.state | float > trigger.from_state.state | float else 'down' }}"
          speed: "normal"
```

---

## HA Input Booleans (configuration.yaml)

These are required for the confirmation flow. The app sets them during the lights prompt and polls them as a backup confirmation method.

```yaml
input_boolean:
  module_reading_pending:
    name: Module Reading Pending
    icon: mdi:book-open-page-variant
  module_reading_confirmed:
    name: Module Reading Confirmed
    icon: mdi:check-circle
```

---
---

# Cat Washroom Study Reading System — Complete Flow

## Overview

The cat washroom has a study reading system that plays your school readings aloud on the Nest speaker while displaying the text on a Fire tablet and Samsung TV. It is triggered by turning on the cat washroom lights or pressing the shower button, and can be stopped in multiple ways.

## Devices Involved

| Device | HA Entity | Role |
|--------|-----------|------|
| Cat Washroom Lights | `light.cat_lights` | Trigger (on/off) |
| Google Nest Speaker | `media_player.bathroom_speaker` | Main audio playback (TTS reading) |
| HA Voice ESPHome Device | `media_player.home_assistant_voice_097c38_media_player` | Voice prompts ("Would you like to play...?") |
| Fire Tablet (Cat WR) | `media_player.tablet_cat` | Displays PDF reader page with synced text |
| Samsung TV (Cat WR) | `media_player.tv_cat_wr` | Displays PDF reader follow-along page |
| Fire Stick (Cat WR TV) | `media_player.fire_tv_172_24_0_88` | Drives Samsung TV display via HDMI |
| Echo Cat Left | `media_player.echo_cat_left_am` | CHUM FM playback (Echo speaker group) |
| Echo Cat Right | `media_player.echo_cat_right_am` | CHUM FM playback (Echo speaker group) |
| Echo Cat Middle | `media_player.echo_cat_washroom_middle` | CHUM FM playback (Echo speaker group) |
| Cat WR Media Group | `media_player.cat_washroom_media_group` | Alexa multi-room group for CHUM FM |
| HA Cloud TTS | `tts.home_assistant_cloud` | Nabu Casa cloud TTS (last-resort prompt voice) |
| Oral-B Toothbrush | `sensor.toothbrush_bryn_toothbrush_state` | Auto-stop trigger (polled, not webhook) |

---

## FLOW A: Lights Turn ON — Full Prompt Flow

**Trigger:** `light.cat_lights` state changes (HA automation calls `rest_command.cat_lights_webhook`)
**Endpoint:** `POST /api/webhook/cat-lights`

### Step-by-step:

**1. Guards (any of these abort the flow):**
- Server startup cooldown (skips if server just restarted within cooldown window)
- Already playing a reading (skips if `catWashPlaybackActive` is true)
- Another prompt is already pending (skips if `catLightsPromptPending` is true)

**2. Query the actual light state from HA:**
- `GET /api/states/light.cat_lights`
- If state is `"off"` — go to **FLOW B** (Lights Turn OFF) instead
- If state is not `"on"` — ignore the webhook

**3. Immediate acknowledgment (plays right away while the app looks up files):**
- Set volume on HA Voice device to 0.64
- Set `input_boolean.module_reading_confirmed` to OFF
- Set `input_boolean.module_reading_pending` to ON
- Play via HA Cloud TTS on the HA Voice device:

> **"One moment, checking your readings."**

**4. Look up the next unlistened file:**
- Get active semester settings from the database
- Calculate the current week number (accounting for reading week)
- Search database for the next unlistened file for this week, prioritized:
  1. Module files first (sorted by course priority)
  2. Reading files second (sorted by course priority)
- If no cached files found, sync from OneDrive first, then search again

**5. Light re-check:**
- Query `light.cat_lights` state again
- If the light turned OFF while the app was looking up files — abort silently

**6. If NO unlistened files found:**
- Play CHUM FM 104.5 on the Echo speaker group:
  - `media_player/play_media` on `media_player.cat_washroom_media_group`
  - `media_content_type: "custom"`, `media_content_id: "play 104.5 chum fm"`
- Done. No prompt.

**7. If an unlistened file IS found — play the voice prompt:**
- Stop any leftover media on all cat washroom speakers first
- Set Nest speaker volume to 0.64
- Generate the prompt message. Example:

> **"Would you like to play week 8, C.P.P.A. 1 22 module?"**

- Try to play via HA Cloud TTS on the HA Voice device
- If that fails, fall back to Edge TTS audio file played on the HA Voice device
- If ALL TTS methods fail, give up and play CHUM FM instead

**8. Wait 2 seconds for the prompt to finish speaking**

**9. Light re-check #2:**
- Query `light.cat_lights` again
- If OFF — abort, reset booleans, done

**10. Wait for confirmation (up to 23 seconds):**
- Primary: wait for `POST /api/webhook/cat-lights-confirm` (resolves the promise immediately)
- Backup: poll `input_boolean.module_reading_confirmed` every 10 seconds
- Timeout after 23 seconds

**11. Reset HA booleans regardless of outcome:**
- `input_boolean.module_reading_pending` OFF
- `input_boolean.module_reading_confirmed` OFF

**12a. If NOT confirmed (23-second timeout):**
- Play CHUM FM 104.5 on Echo speaker group
- Done.

**12b. If CONFIRMED:**
- Light re-check #3 (abort if OFF)
- Play confirmation voice:

> **"Okay, I will now play week 8, C.P.P.A. 1 22 module."**

- Start the full playback flow (**FLOW C** below)

---

## FLOW B: Lights Turn OFF — Stop Everything

**Trigger:** `light.cat_lights` state changes to OFF
**Endpoint:** `POST /api/webhook/cat-lights` (same endpoint, app checks state)

### Step-by-step:

**1. If a reading is actively playing:**
- Save current chunk progress to database
- Stop Nest speaker: `media_player/media_stop` on `media_player.nestaudio6787`
- Turn off Fire Stick: `media_player/turn_off` on `media_player.fire_tv_172_24_0_88`
- Turn off Samsung TV: `media_player/turn_off` on `media_player.tv_cat_wr`
- Play goodbye TTS on Nest speaker:

> **"Stopping. [File Name]. The file position has been saved. See you next time Bryn."**

- Send `stop_playback` command to tablet and TV displays
- Stop toothbrush polling
- Clear playback session from database

**2. If a TTS session is active:**
- Stop the TTS session

**3. Stop all cat washroom speakers (always, even if nothing was playing):**
- `media_player/media_stop` on `media_player.nestaudio6787`
- `media_player/media_stop` on all 3 Echo speakers (`echo_cat_left_am`, `echo_cat_right_am`, `echo_cat_washroom_middle`)
- `media_player/media_stop` on `media_player.cat_washroom_media_group`

**4. Reset state flags:**
- `catLightsPromptPending = false`
- `catWashPlaybackTrigger = null`

---

## FLOW C: Confirmed Playback Flow (Reading the PDF)

**Triggered by:** Flow A confirmation, shower button (Flow D), voice commands (resume/restart/reset/skip), or play-urgent-pdf webhook.

### Step-by-step:

**1. Calculate resume point:**
- Look up `lastChunkIndex` from the database for this file
- Resume from `max(0, savedChunk - 1)` — goes back 1 chunk for context overlap

**2. Build URLs:**
- Tablet URL: `/pdf-reader/{fileId}?catWashFollow=true&resumeChunk={N}&voice=echo&fullscreen=true`
- TV follow URL: `/pdf-reader/{fileId}?catWashFollow=true&followOnly=true&...`

**3. PARALLEL SETUP (all happen simultaneously):**

**Tablet Setup** (`media_player.tablet_cat`):
- ADB: `input keyevent KEYCODE_WAKEUP` — wake the tablet
- ADB: `settings put system screen_brightness 255` — max brightness
- Wait 1.5 seconds
- ADB: `am start --activity-clear-task -a android.intent.action.VIEW -d "{readerUrl}" com.amazon.cloud9` — open PDF reader in Silk browser
- Wait 1 second
- ADB: `settings put global policy_control immersive.full=com.amazon.cloud9` — immersive mode (hide status/nav bars)
- ADB: `input keyevent KEYCODE_F11` — fullscreen

**TV Setup**:
- `media_player/turn_on` on `media_player.fire_tv_172_24_0_88` — wake Fire Stick
- `media_player/turn_on` on `media_player.tv_cat_wr` — turn on Samsung TV
- Wait 3 seconds (let TV boot)
- `media_player/select_source` on `media_player.tv_cat_wr`, source: `"HDMI1"` — switch to Fire Stick input
- ADB on Fire Stick: wake, kill existing Silk browser, open redirect URL, set immersive mode, press center button to dismiss dialogs

**Pre-generate first audio chunk:**
- Check if pre-prepared audio exists (from background 30-min prep job)
- If yes, use the cached .mp3 file
- If no, generate via Edge TTS (voice: `en-US-AndrewMultilingualNeural`)

**Confirmation TTS** (plays on Nest speaker):

> **"Okay, I will now play [file description]."**

- Wait for estimated duration (word count / 140 wpm)

**4. Set playback volume:**
- `media_player/volume_set` on HA Voice device @ 0.75
- `media_player/volume_set` on Nest speaker @ 0.75

**5. Start chunk-by-chunk reading loop:**

For each chunk (starting from resume point):
- Check session is still valid (not cancelled, not stale)
- Generate or use pre-prepared TTS audio for this chunk
- Play on Nest speaker:
  - `media_player/media_stop` on `media_player.nestaudio6787`
  - `media_player/volume_set` @ 0.75
  - `media_player/play_media` with the audio URL
- Wait for estimated chunk duration (word count / 175 wpm + 1 second buffer)
- Poll Nest speaker state to confirm playback finished
- Update database: `lastChunkIndex`, `checkedChunks`
- Send progress to tablet and TV via polling endpoint (they update the highlighted text)
- Pre-generate NEXT chunk audio in background (pipeline)

**6. When ALL chunks are complete:**
- Mark file as "listened" in database
- Play goodbye TTS:

> **"All done with [file name]. Great work Bryn!"**

- Look for the next unlistened file
  - If another file exists: start playing it automatically (back to step 1)
  - If no more files: stop playback, turn off Fire Stick and Samsung TV

**7. Start toothbrush polling** (runs alongside playback):
- Poll `sensor.toothbrush_bryn_toothbrush_state` every 3 seconds
- If state changes to `"running"` or `"brushing"`, auto-stop playback (see Flow F)

---

## FLOW D: Shower Button — Direct Play (Skip Prompt)

**Trigger:** Shower button entity changes in HA
**Endpoint:** `POST /api/webhook/cat-shower-button`

### Step-by-step:

**1. Guards:**
- Server startup cooldown
- Skip if playback already active (assumes you're toggling the shower/fan)
- Skip if a lights prompt is already pending

**2. Look up semester and find next file** (same as Flow A, steps 4-6)

**3. If no unlistened files:**
- Play CHUM FM 104.5 on Echo speaker group
- Done.

**4. If file found — go straight to playback (no prompt, no 23-second wait):**
- Play confirmation:

> **"Okay, I will now play [file description]."**

- Start **Flow C** (confirmed playback) immediately

---

## FLOW E: Volume Knob — Adjust Active Speaker Volume

**Trigger:** Rotary encoder rotation in HA
**Endpoint:** `POST /api/webhook/cat-volume`
**Body:** `{ "direction": "up" | "down", "speed": "normal" | "fast" }`

### Step-by-step:

**1. Query which speakers are currently active:**
- Check state of `media_player.nestaudio6787` (Nest)
- Check state of `media_player.cat_washroom_media_group` (Echo group)
- Active = state is `"playing"`, `"paused"`, or `"buffering"`
- If none active, default to Nest speaker

**2. Calculate new volume:**
- Normal speed: current volume +/- 0.05 (5% per click)
- Fast speed: current volume +/- 0.15 (15% per click)
- Clamped between 0.0 and 1.0

**3. Set volume on each active speaker:**
- `media_player/volume_set` on each active entity

---

## FLOW F: Knob Press — Master STOP

**Trigger:** Physical knob button press in HA
**Endpoint:** `POST /api/webhook/cat-knob-press`

### Step-by-step:

**1. If a reading is actively playing:**
- Internally calls `POST /api/webhook/cat-wash-stop` with `{ "trigger": "knob_press", "keepOpen": true }`
- This triggers the full stop flow: save progress, stop Nest, turn off TV/Fire Stick, play goodbye
- Goodbye TTS:

> **"Stopping. [File Name]. The file position has been saved. See you next time Bryn."**

**2. If nothing is playing:**
- Stop all cat washroom speakers (kills CHUM FM, any leftover media):
  - `media_player/media_stop` on Nest, all 3 Echos, and the media group

---

## FLOW G: Toothbrush Auto-Stop

**Trigger:** App polls `sensor.toothbrush_bryn_toothbrush_state` every 3 seconds (NOT a webhook)
**No HA automation needed** — the app does this internally whenever playback starts.

### Step-by-step:

**1. Polling starts** when any playback begins (Flow C)

**2. Each poll:**
- `GET /api/states/sensor.toothbrush_bryn_toothbrush_state` from HA
- If state is `"running"` or `"brushing"`:
  - Stop playback via internal `cat-wash-stop` logic
  - Save progress to database
  - Stop Nest speaker
  - Turn off Fire Stick and Samsung TV
  - Play goodbye:

> **"Stopping. Your reading position has been saved. See you next time Bryn."**

**3. Polling stops** when playback ends (any stop mechanism)

---

## FLOW H: Voice Commands

**Trigger:** HA voice assistant or custom intent
**Endpoint:** `POST /api/webhook/voice-command`
**Body:** `{ "command": "<command>" }`

### PAUSE
```
{ "command": "pause" }
```
- If nothing playing: **"Nothing is playing right now."**
- Save chunk progress, stop Nest speaker, stop word advancement on tablet
- Start 10-minute auto-stop timer (if no resume within 10 min, everything shuts off):
  - Auto-stop TTS: **"Pause timed out. Playback has been stopped. Your progress has been saved."**
- TTS response:

> **"Paused. Say resume to continue, or I'll stop in 10 minutes."**

### RESUME
```
{ "command": "resume" }
```
- If nothing paused: **"Nothing is paused right now."**
- Clear the 10-minute auto-stop timer
- Stop Echo speakers (clear any CHUM FM that might have started)
- TTS response:

> **"Resuming [file description]."**

- Restart playback from saved chunk position (**Flow C**)

### STOP
```
{ "command": "stop" }
```
- If nothing playing or paused: **"Nothing is playing."**
- If actively playing: save progress, stop Nest, turn off TV/Fire Stick
- TTS response:

> **"Stopped. Your progress has been saved. See you next time Bryn."**

### SKIP (next file)
```
{ "command": "skip" }
```
- If nothing playing: **"Nothing is playing to skip."**
- Mark current file as "listened" (complete) in database
- Stop current playback
- Find next unlistened file
  - If no more files: **"Skipped. No more readings for this week. Great work Bryn!"** (turn off TV/Fire Stick)
  - If next file found: **"Skipped. Now playing [file description]."** (start Flow C with new file)

### RESTART (go back one chunk)
```
{ "command": "restart" }
```
- If nothing playing: **"Nothing is playing to restart."**
- Go back 1 chunk from current position (minimum chunk 0)
- Stop current playback, save new position
- TTS response:

> **"Going back. Restarting from an earlier section."**

- Restart playback from earlier chunk (**Flow C**)

### RESET (start from beginning)
```
{ "command": "reset" }
```
- If nothing playing: **"Nothing is playing to reset."**
- Reset file progress in database: `lastChunkIndex = 0`, `checkedChunks = []`
- Stop current playback
- TTS response:

> **"Resetting [file description]. Starting from the beginning."**

- Start playback from chunk 0 (**Flow C**)

---

## FLOW I: Play Urgent PDF (On-Demand)

**Trigger:** HA script, button, or automation
**Endpoint:** `POST /api/webhook/play-urgent-pdf`
**Auth:** Requires `x-webhook-secret` header matching your site password

### Step-by-step:

**1. Authenticate via header**

**2. Find all unlistened files, ordered by priority:**
1. Module files first (sorted by course)
2. Reading files second (sorted by course)

**3. If no files:**
- TTS on target speaker:

> **"All week [N] readings are complete. Great job!"**

**4. If file found:**
- Start **Flow C** (confirmed playback) immediately

---

## TTS Fallback Chain

The app uses a 3-level fallback chain for generating speech audio:

| Priority | Engine | Voice | When It's Used |
|----------|--------|-------|----------------|
| 1 | OpenAI TTS | alloy | Primary (rate-limited) |
| 2 | Edge TTS (Microsoft) | en-US-AndrewMultilingualNeural | When OpenAI is rate-limited or fails |
| 3 | espeak-ng (local) | Default English | When Edge TTS has 5+ consecutive failures |

For voice prompts (the "Would you like to play?" question), the app uses HA Cloud TTS (Nabu Casa) as the primary method since it's the fastest (no file generation needed), with Edge TTS file playback as the fallback.

---

## Known Issues & Learnings (Nest Speaker)

These are hard-won lessons from debugging the cat washroom reading system. Keep them in mind when modifying the speaker playback code.

### 1. Nest Speaker State Is Unreliable — Always Trust the Service Call

The Google Nest speaker frequently reports its state as `"unknown"` even when it IS actively playing audio. The `media_player` entity in HA does not reliably transition to `"playing"` or `"buffering"` for Cast-based playback.

**Rule:** If the `media_player/play_media` service call returns 200 OK from Home Assistant, treat it as SUCCESS. Do NOT use the speaker's reported state (`idle`, `unknown`, `unavailable`) to determine whether playback actually started. The only failure case is when the HA service call itself throws an error (network failure, HA offline, etc.).

If you add a state check after `play_media`, treat `"unknown"` the same as `"playing"` — return success. Only retry on `"idle"` or `"off"`, and even then, after max retries, still return success since the command was accepted by HA.

### 2. The Nest CAN Play Audio from the Deployed App URL

The Nest speaker successfully plays MP3 files served from `https://home-view--bkh416.replit.app/api/tts-audio/...`. The `/api/tts-audio/` endpoint is explicitly excluded from authentication in `server/index.ts` (line ~190), so no cookies or tokens are needed.

Do NOT add an HA local media upload step — it adds complexity without benefit. The direct URL approach works. If playback appears broken, the issue is almost certainly the state check logic (see point 1), not the URL accessibility.

### 3. Circuit Breaker Must Not Fire on State-Check Failures

The chunk playback loop has a circuit breaker that triggers after 3 consecutive "failures." If `playOnNestSpeaker` incorrectly returns `{success: false}` due to an `"unknown"` state, the circuit breaker fires and prompts the user to switch to Echo speakers — even though the Nest was playing fine.

**Rule:** `playOnNestSpeaker` should only return `{success: false}` when the HA service call itself fails (HTTP error, timeout, HA offline). State check results should never cause a `{success: false}` return.

### 4. Volume Levels

| Context | Volume |
|---------|--------|
| Voice prompts ("Would you like to play?") | 0.35 |
| Reading playback (Nest + HA Voice) | 0.45 |

### 5. Confirm TTS Plays on the Nest, Not HA Voice

The confirmation message ("Okay, I will now play your module...") should play on the Nest speaker using a generated OpenAI/Edge TTS audio file, not via HA Cloud TTS on the HA Voice speaker. The fallback to HA Voice should only happen if the Nest play_media service call actually fails (HTTP error).

### 6. Stale Playback Sessions

The webhook handler checks for stale playback at the start. A session is considered stale if:
- It has been running for 3+ minutes AND is still at chunk 0 (stuck at start)
- It has been running for 10+ minutes regardless of chunk position

Stale sessions are cleared so the next light trigger can start fresh.

---

## Background Processes (No Webhook Needed)

These run automatically inside the app — no HA automation required:

| Process | Interval | What It Does |
|---------|----------|--------------|
| Audio Preparation | Every 30 minutes | Pre-generates TTS audio for upcoming files. Also retries files with failed chunks. |
| Semester Auto-Activation | Every 6 hours + startup | Checks all semesters and activates the one whose date range includes today. |
| Ticker Push to HA | Every 5 minutes | Fetches weather, news, pollen, course announcements and pushes to `sensor.dashboard_ticker`, `sensor.dashboard_weather`, `sensor.dashboard_news` in HA. |
| Toothbrush Polling | Every 3 seconds (only during playback) | Polls toothbrush sensor state. Auto-stops reading if brushing detected. |
| Alexa Reminder Scheduler | Every 60 seconds | Checks for due task reminders and sends Echo voice announcements + iPhone push notifications. |
| Playback Session Persistence | On every chunk change | Saves current playback state to `app_state` table so playback can resume after server restart. |
