# Self-Hosting Guide: Dashboard App on Raspberry Pi

## Can I Run This on My Home Assistant Laptop?

No, not directly. Home Assistant OS is a locked-down, purpose-built Linux distribution — it manages its own filesystem, networking, and containers. You can't install Node.js, PostgreSQL, or run arbitrary apps alongside it. It's designed to only run HA and its add-ons. You'd need to replace HAOS with a regular Linux install to do that, which would mean rebuilding your entire HA setup.

A Raspberry Pi 5 on the same local network is the right approach — fast, cheap, always-on, and won't interfere with your HA installation.

---

## Equipment to Buy

| Item | Model / Spec | Approx. Price | Why It Matters |
|------|-------------|---------------|----------------|
| **Raspberry Pi 5** | **8 GB RAM** | ~$80 USD | Node.js + PostgreSQL + TTS processing need the memory. 4 GB would be tight. |
| **Power Supply** | Official Raspberry Pi 5 27W USB-C | ~$12 | Underpowered supplies cause random crashes and SD card corruption. |
| **microSD Card** | Samsung EVO Select 128 GB (A2-rated) | ~$13 | 64 GB minimum, 128 GB recommended for audio file caching. Must be A2-rated for speed. |
| **Active Cooler** | Official Raspberry Pi 5 Active Cooler | ~$5 | The Pi 5 runs hot under sustained load. TTS processing will push it. A passive heatsink alone isn't enough. |
| **Case** | Official Pi 5 case or Argon NEO 5 | ~$10–15 | Must be compatible with the active cooler. |
| **Ethernet Cable** | Cat 5e or better, appropriate length | ~$5 | Wi-Fi works but ethernet is more reliable for an always-on server. Connect to same network as your HA laptop. |
| **USB microSD Reader** | Any USB 3.0 reader (if your PC lacks a slot) | ~$8 | Needed to flash the OS onto the card. |

**Total: ~$125–135 USD**

---

## Setup Instructions

### Step 1: Flash the Operating System

1. On your regular computer, download **Raspberry Pi Imager** from [raspberrypi.com/software](https://www.raspberrypi.com/software/)
2. Insert the microSD card into your computer
3. Open the Imager and choose:
   - **Device:** Raspberry Pi 5
   - **OS:** Raspberry Pi OS (64-bit, Lite) — no desktop environment needed
4. Click the **gear icon** (⚙️) before flashing and configure:
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

### Step 6: Transfer the Code

**Option A — From Replit (download zip):**

1. In Replit, click the three dots menu → Download as ZIP
2. From your computer, transfer the file:
   ```bash
   scp ~/Downloads/home-view.zip pi@dashboard-server.local:/opt/dashboard/
   ```
3. On the Pi:
   ```bash
   cd /opt/dashboard
   unzip home-view.zip
   npm install
   ```

**Option B — From Git (if you've pushed to GitHub):**
```bash
cd /opt/dashboard
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
npm install
```

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
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
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
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations
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

In your HA automations, update all webhook URLs from:
```
https://home-view--bkh416.replit.app/api/webhook/...
```
To:
```
http://dashboard-server.local:5000/api/webhook/...
```

Or use the Pi's static IP address instead of the hostname for reliability.

Webhooks to update:
- `/api/webhook/voice-command`
- `/api/webhook/cat-lights-confirm`
- `/api/webhook/ticker`
- `/api/webhook/reminder`
- `/api/webhook/delete`
- `/api/webhook/email-homework`
- `/api/announcements/webhook`
- Any other HA automations pointing to the Replit URL

### Step 14: Update Google Apps Script

If you have a Google Apps Script pushing emails to the app, update the webhook URLs there too to point to the Pi's address.

**Important:** Since the Pi is on your local network, the Google Apps Script (which runs in the cloud) won't be able to reach `dashboard-server.local`. You'll need either:
- A static public IP with port forwarding on your router (port 5000)
- A reverse tunnel service like **Cloudflare Tunnel** (free) to expose the Pi to the internet securely
- Or keep using Replit just for the Gmail webhook endpoint

### Step 15: Touchscreen Setup

On your 1920×720 touchscreen, open the browser and navigate to:
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
| Google OAuth setup | 1–2 hours |
| Spotify OAuth setup | 30 minutes |
| Microsoft OAuth setup | 1–2 hours |
| HA webhook URL updates | 30 minutes |
| Testing everything | 1–2 hours |
| **Total** | **4–7 hours** |

The OAuth setup is the bulk of the work. Everything else is straightforward.
