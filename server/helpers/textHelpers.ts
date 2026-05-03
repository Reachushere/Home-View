// Pure helper functions extracted from server/routes.ts (MODULE_SPLIT_PLAN Phase 1).
// No closures, no I/O. Safe to import anywhere.
import { DEFAULT_REMINDER_1, DEFAULT_REMINDER_2 } from '@shared/schema';

export function generateMasterGuide(dateStr: string, timeStr: string): string {
  return `
================================================================================
UNICAL — MASTER APP GUIDE (AUGMENTED)
Generated: ${dateStr} at ${timeStr} ET
================================================================================
This guide augments the original Master App Guide PDF. NO content from the
original has been removed — only new sections have been added. The original
PDF remains the source of truth for: Cat Washroom Study Reading System
(Flows A–I), HA rest_commands, HA automations (1–6), HA input booleans,
TTS Fallback Chain, Known Issues & Learnings, Background Processes,
Complete Integration & OAuth Setup Guide (Integrations 1–11), App Security,
Complete .env Template, Testing Each Integration, and ChatGPT Prompts.

TABLE OF CONTENTS — NEW/AUGMENTED SECTIONS
===========================================
1.  Project Overview & Architecture
2.  Three-Tier Authentication System
3.  Complete File Structure
4.  Database Schema (All Tables)
5.  All API Routes (400+ endpoints)
6.  Frontend Features & Components
7.  Dashboard Layout & UI System
8.  Weather Widget
9.  Homework Panel & Task Management
10. News Ticker (D2L + RSS)
11. Spotify Integration
12. Alexa Speaker Control
13. Calendar System (Google + Outlook)
14. CRCU Shift Scheduling
15. Morning Review System
16. Monthly Reports
17. OneDrive & PDF Reader
18. Email System (Gmail + Outlook)
19. Notepad System
20. Code Checker
21. Contacts & Key Contacts
22. Countdown Bars & Progress Tracking
23. Settings & Blink System
24. Git Setup & Raspberry Pi Migration
25. attached_assets & .gitignore Fix
26. Environment Variables — Complete Reference
27. Deployment & Publishing
28. Troubleshooting

================================================================================
1. PROJECT OVERVIEW & ARCHITECTURE
================================================================================
UniCal is a full-stack academic task management app built for TMU (Toronto
Metropolitan University) students. It runs on:
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: Express.js + TypeScript
- Database: PostgreSQL via Drizzle ORM
- Hosting: Replit (dev/staging) → Raspberry Pi (production target)
- Package manager: npm
- Dev server: npm run dev (runs Express + Vite together)

The app is a single-page dashboard that displays:
- Weekly calendar grid with tasks, events, and time blocks
- Weather widget (Open-Meteo API, no key needed)
- D2L announcement ticker + news ticker
- Homework panel with task management
- Spotify player
- Alexa/Home Assistant speaker controls
- PDF reader with TTS playback in Cat Washroom
- CRCU partner shift calendar
- Morning review & weekly planning dialogs
- Monthly academic reports
- OneDrive file sync
- Contact management
- Code checker with AI analysis

================================================================================
2. THREE-TIER AUTHENTICATION SYSTEM
================================================================================
The app uses a simple site password with three access tiers:

Tier 1 — Code 5747 (Full Access):
  All features unlocked. Dashboard, homework panel, calendar, settings,
  Alexa controls, PDF reader, Spotify, email, contacts, code checker,
  morning review, monthly reports, everything.

Tier 2 — Code 4201 (D2L Ticker + Partner Wizard):
  Can see the D2L announcement ticker and access the partner shift
  scheduling wizard. Cannot access the full dashboard or other features.

Tier 3 — Code 1010 (D2L Ticker Only):
  Can only see the D2L announcement ticker. No other access.

Password is stored in the SITE_PASSWORD, SITE_PASSWORD_4201, and
SITE_PASSWORD_1010 environment variables. Sessions use express-session
stored in the PostgreSQL database.

================================================================================
3. COMPLETE FILE STRUCTURE
================================================================================
/
├── client/
│   └── src/
│       ├── pages/
│       │   └── dashboard.tsx          # Main dashboard (~18,700+ lines)
│       ├── components/
│       │   ├── NotepadDialog.tsx       # Notepad system
│       │   └── ui/                    # shadcn components (dialog, button, etc.)
│       ├── hooks/
│       │   └── use-toast.ts           # Toast notifications
│       ├── lib/
│       │   └── queryClient.ts         # TanStack Query setup
│       ├── App.tsx                    # Router setup
│       ├── index.css                  # Global styles + theme
│       └── main.tsx                   # Entry point
├── server/
│   ├── index.ts                       # Express server setup, auth middleware
│   ├── routes.ts                      # All 400+ API routes (~20,000+ lines)
│   ├── storage.ts                     # Database CRUD interface
│   ├── gmail.ts                       # Gmail OAuth + D2L email parsing
│   ├── googleCalendar.ts              # Google Calendar integration
│   ├── outlookCalendar.ts             # Outlook Calendar integration
│   ├── onedrive.ts                    # OneDrive file sync
│   ├── spotify.ts                     # Spotify playback control
│   ├── vite.ts                        # Vite dev server config
│   └── db.ts                          # Database connection
├── shared/
│   └── schema.ts                      # Drizzle ORM schema (all tables)
├── attached_assets/                   # Local assets (NOT in git — see section 25)
├── drizzle.config.ts                  # Drizzle configuration
├── package.json                       # Dependencies
├── tailwind.config.ts                 # Tailwind configuration
├── tsconfig.json                      # TypeScript config
├── vite.config.ts                     # Vite config
└── .gitignore                         # Git ignore rules

================================================================================
4. DATABASE SCHEMA (ALL TABLES)
================================================================================
All tables are defined in shared/schema.ts using Drizzle ORM.

tasks — Academic tasks (homework, exams, quizzes, etc.)
  id (serial PK), title, description, courseName, type, priority,
  dueDate, isCompleted, weekNumber, eventStartTime, eventEndTime,
  estimatedMinutes, referenceLink, attachments (jsonb), reminderSent,
  calendarEventId, sortOrder

semesters — Academic semester definitions
  id (serial PK), name, startDate, endDate, year, season, isActive,
  readingWeekStart, readingWeekEnd, courses (jsonb)

courses — Course information
  id (serial PK), name, code, color, professorName, professorEmail,
  location, semesterId

files — PDF/document files from OneDrive
  id (serial PK), onedriveId, displayName, webUrl, objectPath,
  contentType, size, folder, listened, lastChunkIndex, checkedChunks,
  semesterId, weekNumber, courseCode, fileType, totalChunks,
  preparedAudioChunks, audioErrors

notepad_notes — Notepad entries
  id (serial PK), title, content, category, sortOrder, groupName,
  createdAt, updatedAt

contacts — Contact management
  id (serial PK), name, email, phone, category, notes, isFavorite

app_state — Key-value store for app settings
  key (text PK), value (text)

sessions — Express sessions for auth
  sid (text PK), sess (json), expire (timestamp)

feedback_notes — User feedback entries
  id (serial PK), content, category, priority, status, createdAt

sticky_notes — Quick sticky notes
  id (serial PK), content, color, position (jsonb), size (jsonb),
  createdAt

monthly_reports — Academic monthly reports
  id (serial PK), month, year, content (jsonb), generatedAt

weather_records — Historical weather data
  id (serial PK), date, temperature, feelsLike, humidity, windSpeed,
  weatherCode, description, recordedAt

saved_email_searches — Saved email search queries
  id (serial PK), name, query, filters (jsonb), createdAt

================================================================================
5. ALL API ROUTES (400+ ENDPOINTS)
================================================================================
The app has over 400 API routes in server/routes.ts. Key groups:

TASKS:
  GET    /api/tasks                    — Get all tasks
  POST   /api/tasks                    — Create a task
  PATCH  /api/tasks/:id                — Update a task
  DELETE /api/tasks/:id                — Delete a task
  POST   /api/tasks/reorder            — Reorder tasks
  POST   /api/tasks/:id/invite         — Send calendar invite for task

SEMESTERS:
  GET    /api/semesters                — Get all semesters
  POST   /api/semesters                — Create semester
  PATCH  /api/semesters/:id            — Update semester
  DELETE /api/semesters/:id            — Delete semester

COURSES:
  GET    /api/courses                  — Get all courses
  POST   /api/courses                  — Create course
  PATCH  /api/courses/:id              — Update course
  DELETE /api/courses/:id              — Delete course

CALENDAR:
  GET    /api/calendar/events          — Google Calendar events
  GET    /api/outlook/events           — Outlook Calendar events

WEATHER:
  GET    /api/weather                  — Current + forecast weather
  GET    /api/weather/records          — Historical weather records

SPOTIFY:
  GET    /api/spotify/status           — Player status
  POST   /api/spotify/play             — Play/resume
  POST   /api/spotify/pause            — Pause
  POST   /api/spotify/next             — Next track
  POST   /api/spotify/previous         — Previous track
  POST   /api/spotify/volume           — Set volume
  GET    /api/spotify/playlists        — Get playlists
  POST   /api/spotify/shuffle          — Toggle shuffle
  POST   /api/spotify/repeat           — Toggle repeat

HOME ASSISTANT:
  GET    /api/ha/status                — HA connection status
  POST   /api/ha/command               — Send HA command
  POST   /api/speakers/stop-all        — STOP ALL speakers (kill switch)

WEBHOOKS (for HA automations):
  POST   /api/webhook/cat-lights       — Cat washroom lights trigger
  POST   /api/webhook/cat-lights-confirm — Confirm reading
  POST   /api/webhook/cat-shower-button — Shower button trigger
  POST   /api/webhook/cat-wash-stop    — Stop reading
  POST   /api/webhook/cat-volume       — Volume knob
  POST   /api/webhook/cat-knob-press   — Knob press STOP
  POST   /api/webhook/voice-command    — Voice commands
  POST   /api/webhook/kitchen-volume   — Kitchen volume
  POST   /api/webhook/play-urgent-pdf  — Play most urgent PDF

FILES (OneDrive):
  GET    /api/files                    — Get all synced files
  POST   /api/files/sync               — Sync from OneDrive
  PATCH  /api/files/:id                — Update file
  GET    /api/tts-audio/:filename      — Serve TTS audio (no auth)

NOTEPAD:
  GET    /api/notepad/notes            — Get all notes
  POST   /api/notepad/notes            — Create note
  PATCH  /api/notepad/notes/:id        — Update note
  DELETE /api/notepad/notes/:id        — Delete note

EMAIL:
  POST   /api/email/search             — Search Gmail/Outlook emails
  POST   /api/email/delete             — Delete email
  GET    /api/email/folders            — Get email folders
  POST   /api/email/move               — Move email to folder

D2L ANNOUNCEMENTS:
  GET    /api/d2l/announcements        — Get parsed D2L announcements
  POST   /api/d2l/refresh              — Refresh from Gmail

MORNING REVIEW:
  GET    /api/morning-review/last-shown — Get last shown timestamp
  POST   /api/morning-review/last-shown — Update last shown
  POST   /api/morning-review/sync-all   — Sync all data

MONTHLY REPORTS:
  GET    /api/monthly-reports          — Get all reports
  POST   /api/monthly-reports/generate — Generate new report

CONTACTS:
  GET    /api/contacts                 — Get all contacts
  POST   /api/contacts                 — Create contact
  PATCH  /api/contacts/:id             — Update contact
  DELETE /api/contacts/:id             — Delete contact

SETTINGS:
  GET    /api/app-state/:key           — Get setting
  POST   /api/app-state/:key           — Set setting

CODE CHECKER:
  POST   /api/code-checker/analyze     — Analyze code with AI
  POST   /api/code-checker/email       — Email analysis results

PUBLISH:
  POST   /api/publish-guide            — Generate & email this guide

PARTNER SHIFTS (CRCU):
  GET    /api/partner-shifts           — Get partner shifts
  POST   /api/partner-shifts           — Create shift
  Various /api/crcu/* routes           — CRCU-specific scheduling

================================================================================
6. FRONTEND FEATURES & COMPONENTS
================================================================================
The dashboard (dashboard.tsx) is the main and only page. It contains:

TOP PILL BAR:
  - Frosted glass pill with all control buttons
  - Header spacing slider (adjusts button spacing)
  - Undo/Redo buttons
  - HA button (opens Home Assistant)
  - Sky Map button (opens sky/astronomy view)
  - Tools pill: Settings, Email, Contacts, Completed Tasks, etc.
  - Actions pill: Quick Add, Alexa, Radio, etc.
  - Info pill: System Health, Feedback, School Courses

CALENDAR GRID:
  - Weekly view with customizable column widths
  - Time column (6 AM – midnight, configurable)
  - Module column (toggleable)
  - Day columns with resize handles
  - Task cards placed at scheduled times
  - Today column highlighted with black border
  - Current hour indicator with blinking animation
  - Drag-and-drop task rescheduling
  - Saturday columns with gradient background

DAY DETAIL VIEW:
  - Click any day to open full 24-hour detail
  - Single column layout with time labels
  - Full-width task rows with course-color left border
  - Drag-and-drop hour scheduling
  - Unscheduled tasks section

COUNTDOWN BARS:
  - Floating overlay on calendar
  - Shows time remaining for upcoming tasks
  - Color-coded: green (plenty of time), yellow (getting tight),
    red (urgent)
  - Displays as "Xd, Yh" format

================================================================================
7. DASHBOARD LAYOUT & UI SYSTEM
================================================================================
The dashboard uses a custom layout system (not CSS Grid for the main layout):

BLINK SETTINGS (persisted in app_state):
  All visual tuning parameters are stored in a blinkSettings object:
  - buttonSpacing: gap between buttons in pills
  - tallPillButtonSpacing: additional spacing for the tall pill
  - countdownBarHeight: height of countdown bars
  - todayColumnBlink: enable/disable today column animation
  - Various other visual toggles

COLOR SETTINGS:
  - headerBar: main header background color
  - todayCurrentHourCellBackground: today's current hour cell color
  - Chang blue: #004C9C (used for various UI elements)

COURSE COLORS:
  - CPPA122: #47B045 (green)
  - CFNF400: #FA67B3 (pink)
  - CASL101: #6366f1 (indigo)
  - CECN210: #34D399 (emerald)
  - CPHL110: #60A5FA (blue)
  - CHST501: #F87171 (red)
  - CPPA235: #CD853F (peru/brown)

MODULE BOX RENDERING:
  - White background z-index: 44
  - Row container z-index: 45
  - Each course gets a colored box with module/reading info
  - N/A shown when no file exists
  - Play button for TTS playback
  - Time remaining shown as "Xd, Yh"

================================================================================
8. WEATHER WIDGET
================================================================================
- Source: Open-Meteo API (free, no API key needed)
- Shows current temperature, feels like, conditions
- 7-day forecast with highs/lows
- Weather codes mapped to descriptions and icons
- Historical weather recorded hourly to weather_records table
- KNOWN BUG: If dayForecast is undefined, effectiveWCode falls through
  showing "0°/0° Snow" — needs guard for undefined dayForecast

================================================================================
9. HOMEWORK PANEL & TASK MANAGEMENT
================================================================================
- Left sidebar panel showing all tasks
- Grouped by: Due Today, This Week, Upcoming, Overdue
- Each task shows: title, course, type icon, priority badge, due date
- Task types: module, reading, essay, discussion, poll, quiz, exam,
  project, reminder, meeting, scholarship, class, other
- Priority levels: high (red), medium (yellow), low (green)
- Swipeable rows: swipe left to delete, swipe right to reschedule
- Inline completion checkbox
- Edit dialog for full task editing
- Calendar invite sending via Google Calendar API
- Reminder system via Alexa announcements + push notifications

IMPORTANT: Never modify CASL task data directly in the database.
Use the API endpoints for all task operations.

KNOWN BUG: POST /api/tasks fails with "value.toISOString is not a
function" — use direct SQL via executeSql as a workaround when needed.

================================================================================
10. NEWS TICKER (D2L + RSS)
================================================================================
- Bottom bar with scrolling news headlines
- D2L announcements parsed from Gmail (notification emails from
  NotificationEmail@toronto-mu.brightspace.com)
- Alert bar shimmer effect for urgent announcements
- Pushed to HA sensors: sensor.dashboard_ticker, sensor.dashboard_weather,
  sensor.dashboard_news every 5 minutes

================================================================================
11. SPOTIFY INTEGRATION
================================================================================
- Embedded player widget on the dashboard
- Uses Spotify Web API with OAuth tokens
- Env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
- Features: play/pause, next/previous, volume control, shuffle, repeat
- Playlist browsing and selection
- Currently playing track display with album art
- Already uses direct tokens (works on Pi without changes)

================================================================================
12. ALEXA SPEAKER CONTROL
================================================================================
- Dialog for controlling all HA-connected speakers
- Individual speaker volume and play/pause controls
- STOP ALL button (red, Square icon) in dialog header
  - Stops all 20+ speaker entities via media_stop + media_pause
  - Entities: media_player.byhome (everywhere group),
    bathroom echo, kitchen echo, cat echoes (array),
    nest speaker, cat WR HA voice

Speaker Entities:
  EVERYWHERE_GROUP: media_player.byhome
  BATHROOM_ECHO: media_player.bathroom_echo
  KITCHEN_ECHO: media_player.kitchen_echo
  CAT_ECHOES: [echo_cat_left_am, echo_cat_right_am,
               echo_cat_washroom_middle]
  NEST_SPEAKER: media_player.bathroom_speaker
  CAT_WR_HA_VOICE: media_player.home_assistant_voice_097c38_media_player

================================================================================
13. CALENDAR SYSTEM
================================================================================
Google Calendar:
  - Shows TMU academic calendar events
  - OAuth via Replit connector (needs rewrite for Pi — see original guide)
  - File: server/googleCalendar.ts

Outlook Calendar:
  - Shows Outlook events alongside Google Calendar
  - OAuth via Replit connector (needs rewrite for Pi — see original guide)
  - File: server/outlookCalendar.ts

Both calendars are merged and displayed on the weekly grid.

================================================================================
14. CRCU SHIFT SCHEDULING
================================================================================
- Partner work shift calendar integration
- Uses second Google account for partner's shifts
- Third Google account for CRCU-specific scheduling
- Env vars: GOOGLE_SECOND_ACCOUNT_CLIENT_ID,
  GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET
- Already uses direct OAuth (works on Pi without changes)

================================================================================
15. MORNING REVIEW SYSTEM
================================================================================
- Auto-shows on first dashboard load each day
- Summarizes: today's tasks, upcoming deadlines, weather, calendar events
- Can be dismissed until next day
- Sync-all endpoint refreshes all data sources
- Last shown timestamp persisted in app_state

================================================================================
16. MONTHLY REPORTS
================================================================================
- Generate monthly academic performance reports
- Stored in monthly_reports table
- Content includes: task completion rates, study hours, grades,
  course progress
- Generated via POST /api/monthly-reports/generate

================================================================================
17. ONEDRIVE & PDF READER
================================================================================
- Syncs PDF course files from OneDrive
- OAuth via Replit connector (needs rewrite for Pi — see original guide)
- File: server/onedrive.ts
- PDF reader page at /pdf-reader/:fileId
- Cat Washroom reading system uses these files (see original guide Flows A-I)
- TTS audio pre-generated every 30 minutes
- Audio served at /api/tts-audio/:filename (no auth required)

================================================================================
18. EMAIL SYSTEM
================================================================================
Gmail:
  - Reads D2L announcement emails
  - Sends emails (code checker results, guide publishing)
  - OAuth via Replit connector (needs rewrite for Pi)
  - File: server/gmail.ts
  - Sender: homeworkbryn@gmail.com

Outlook:
  - Email search and folder management
  - Folder migration and email filing
  - OAuth via Replit connector (needs rewrite for Pi)

================================================================================
19. NOTEPAD SYSTEM
================================================================================
- Full notepad with create/edit/delete notes
- Categories and group organization
- File attachments support
- Sort order management
- Component: NotepadDialog.tsx

================================================================================
20. CODE CHECKER
================================================================================
- Paste code for AI-powered analysis
- Uses OpenAI API (via Replit AI integration)
- Results can be emailed to Outlook address
- POST /api/code-checker/analyze — analyzes code
- POST /api/code-checker/email — emails results

================================================================================
21. CONTACTS & KEY CONTACTS
================================================================================
- Contact management system
- Categories for organization
- Favorite contacts feature
- Key contacts quick-access dialog

================================================================================
22. COUNTDOWN BARS & PROGRESS TRACKING
================================================================================
- Floating overlay on the calendar grid
- Shows upcoming task deadlines
- Color-coded by urgency
- Time remaining displayed as "Xd, Yh" format
- Dockable/undockable from calendar
- Sticky positioning for scroll visibility

================================================================================
23. SETTINGS & BLINK SYSTEM
================================================================================
All visual settings are controlled through the Settings panel:
- Button spacing adjustments
- Column width controls
- Color theme settings
- Toggle animations (today column blink, etc.)
- Time range configuration
- Module column visibility
- All settings persisted in app_state table under 'blinkSettings' key

================================================================================
24. GIT SETUP & RASPBERRY PI MIGRATION
================================================================================

CURRENT GIT REMOTE:
  origin: https://github.com/Reachushere/Home-View.git

CLONING TO PI:
  1. SSH into your Pi:
     ssh pi@192.168.1.XXX

  2. Install Node.js 20+:
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt install -y nodejs

  3. Install PostgreSQL:
     sudo apt install -y postgresql postgresql-contrib
     sudo -u postgres createdb unical
     sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your_password';"

  4. Clone the repo:
     git clone https://github.com/Reachushere/Home-View.git
     cd Home-View

  5. Install dependencies:
     npm install

  6. Create .env file (see section 26 for all variables)

  7. Push database schema:
     npm run db:push

  8. Build and start:
     npm run build
     npm start

  9. Set up as a systemd service for auto-start:
     sudo nano /etc/systemd/system/unical.service
     ---
     [Unit]
     Description=UniCal Dashboard
     After=network.target postgresql.service

     [Service]
     Type=simple
     User=pi
     WorkingDirectory=/home/pi/Home-View
     ExecStart=/usr/bin/node dist/index.js
     Restart=always
     RestartSec=10
     Environment=NODE_ENV=production
     EnvironmentFile=/home/pi/Home-View/.env

     [Install]
     WantedBy=multi-user.target
     ---
     sudo systemctl enable unical
     sudo systemctl start unical

  10. Set up Nginx reverse proxy (optional but recommended):
      sudo apt install -y nginx
      sudo nano /etc/nginx/sites-available/unical
      ---
      server {
          listen 80;
          server_name dashboard-server.local;
          location / {
              proxy_pass http://localhost:5000;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_cache_bypass $http_upgrade;
          }
      }
      ---
      sudo ln -s /etc/nginx/sites-available/unical /etc/nginx/sites-enabled/
      sudo nginx -t && sudo systemctl restart nginx

  11. Add to local DNS (on your router or /etc/hosts):
      192.168.1.XXX   dashboard-server.local

================================================================================
25. attached_assets & .gitignore FIX
================================================================================

PROBLEM:
The attached_assets/ directory is listed in .gitignore, which means
any files in that directory (images, PDFs, the Master Guide PDF, etc.)
are NOT pushed to GitHub and will NOT be available when you clone the
repo on your Raspberry Pi.

THE FIX:
Option A — Remove from .gitignore (recommended for Pi migration):
  1. Open .gitignore in the repo root
  2. Remove or comment out the line:  attached_assets
  3. Run:
     git add attached_assets/
     git commit -m "Include attached_assets in repo"
     git push origin main
  4. Now when you clone on the Pi, all assets will be included

Option B — Manually copy assets to Pi:
  1. On your current machine, zip the assets:
     tar -czf attached_assets.tar.gz attached_assets/
  2. Copy to Pi:
     scp attached_assets.tar.gz pi@192.168.1.XXX:/home/pi/Home-View/
  3. On Pi:
     cd /home/pi/Home-View
     tar -xzf attached_assets.tar.gz
     rm attached_assets.tar.gz

IMPORTANT FILES IN attached_assets/:
  - Master_App_Guide_Printable_*.pdf (this guide's source)
  - Various UI images and icons used by the frontend
  - These images are imported via @assets/ alias in Vite

To use images from attached_assets in the frontend:
  import myImage from "@assets/my-image.png";
  // Then use: <img src={myImage} />

The @assets alias is configured in vite.config.ts to point to
the attached_assets directory.

================================================================================
26. ENVIRONMENT VARIABLES — COMPLETE REFERENCE
================================================================================

# === DATABASE ===
DATABASE_URL=postgresql://postgres:password@localhost:5432/unical

# === SITE AUTHENTICATION ===
SITE_PASSWORD=5747
SITE_PASSWORD_4201=4201
SITE_PASSWORD_1010=1010
SESSION_SECRET=your-random-session-secret-here

# === HOME ASSISTANT ===
HOME_ASSISTANT_TOKEN=eyJ0eX...your_long_lived_access_token
HOME_ASSISTANT_URL_OVERRIDE=https://your-nabu-casa-url.ui.nabu.casa
# Or for local: http://192.168.1.XXX:8123

# === GOOGLE (Calendar + Gmail) ===
# On Replit: uses built-in connectors (no env vars needed)
# On Pi: needs these (see original guide Integration 2 & 3):
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REFRESH_TOKEN=1//0e-your-refresh-token

# === SPOTIFY ===
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
# Token auto-refreshed and cached in .spotify-token.json

# === MICROSOFT (OneDrive + Outlook) ===
# On Replit: uses built-in connectors
# On Pi: needs these (see original guide Integration 5 & 6):
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-secret
MICROSOFT_REFRESH_TOKEN=your-refresh-token

# === OPENAI (TTS) ===
# On Replit: uses Replit AI integration
# On Pi: needs direct API key:
OPENAI_API_KEY=sk-your-openai-key

# === SECOND GOOGLE ACCOUNT (Partner Shifts) ===
GOOGLE_SECOND_ACCOUNT_CLIENT_ID=your-second-google-client-id
GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET=your-second-google-secret
# Refresh token managed via OAuth flow in app

# === REPLIT-SPECIFIC (not needed on Pi) ===
REPLIT_CONNECTORS_HOSTNAME=auto-set-by-replit
REPL_IDENTITY=auto-set-by-replit
REPLIT_DOMAINS=auto-set-by-replit
REPL_ID=auto-set-by-replit

================================================================================
27. DEPLOYMENT & PUBLISHING
================================================================================

ON REPLIT:
  - Dev: npm run dev (runs Express + Vite dev server)
  - The "Start application" workflow runs this automatically
  - Published URL: https://home-view--bkh416.replit.app
  - Publishing via Replit's deploy system handles TLS, domains, etc.

ON RASPBERRY PI:
  - Build: npm run build
  - Start: NODE_ENV=production node dist/index.js
  - Use systemd service for auto-restart (see section 24)
  - Use Nginx for reverse proxy and optional HTTPS via Let's Encrypt
  - HA webhooks must point to the Pi's URL instead of Replit's
  - Update all rest_command URLs in HA configuration.yaml

UPDATING HA WEBHOOKS FOR PI:
  In your HA configuration.yaml, change all rest_command URLs from:
    url: "https://home-view--bkh416.replit.app/api/webhook/..."
  To:
    url: "http://dashboard-server.local:5000/api/webhook/..."
  Or:
    url: "http://192.168.1.XXX:5000/api/webhook/..."

================================================================================
28. TROUBLESHOOTING
================================================================================

APP WON'T START:
  - Check DATABASE_URL is correct and PostgreSQL is running
  - Run: npm run db:push to ensure schema is up to date
  - Check port 5000 is not in use: lsof -i :5000

OAUTH TOKEN EXPIRED:
  - Google: Redo the OAuth flow (see original guide, Integration 2, Step 5)
  - Microsoft: Redo the OAuth flow (see original guide, Integration 5)
  - If in "Testing" mode, tokens expire after 7 days — publish the
    OAuth consent screen app to avoid this

WEATHER SHOWS "0°/0° Snow":
  - Known bug: effectiveWCode falls through when dayForecast is undefined
  - Ensure the weather API is reachable from your Pi

TASKS API FAILS WITH toISOString ERROR:
  - Known bug in POST /api/tasks
  - Workaround: use direct SQL or PATCH existing tasks

SPEAKERS NOT RESPONDING:
  - Check HA connection: GET /api/ha/status
  - Verify HOME_ASSISTANT_TOKEN is valid
  - Ensure HA is reachable from the app's network

PDF READER NOT LOADING:
  - Check OneDrive token is valid
  - Run POST /api/files/sync to re-sync files
  - Verify /api/tts-audio/ endpoint is excluded from auth
    (check server/index.ts around line 190)

GIT PUSH FAILS:
  - Ensure you have push access to the GitHub repo
  - Check: git remote -v
  - If attached_assets not showing: see section 25

REPLIT CONNECTORS DON'T WORK ON PI:
  - This is expected. See original guide "CRITICAL: Replit Connector
    Rewrites" section for the 4 files that need updating:
    server/googleCalendar.ts, server/gmail.ts, server/onedrive.ts,
    server/outlookCalendar.ts

================================================================================
END OF AUGMENTED GUIDE — ${dateStr}
All original PDF content (Cat Washroom Flows A-I, HA configs, OAuth
setup steps, .env template, testing guide, ChatGPT prompts) remains
valid and is NOT repeated here. Refer to the original PDF for those
sections.
================================================================================
`;
}

export function generateICS(title: string, description: string, dueDate: Date, type: string, reminderMinutes?: number[]): string {
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `task-${Date.now()}@schoolplanner`;
  
  const activeReminders = reminderMinutes?.filter(m => m > 0) || [DEFAULT_REMINDER_1, DEFAULT_REMINDER_2];
  
  const reminders = activeReminders.map(minutes => 
    `VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nTRIGGER:-PT${minutes}M\r\nEND:VALARM`
  ).join('\r\nBEGIN:');

  const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//School Task Planner//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(dueDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title} [${type.toUpperCase()}]
DESCRIPTION:${description.replace(/\n/g, '\\n')}
BEGIN:${reminders}
END:VEVENT
END:VCALENDAR`;
}
