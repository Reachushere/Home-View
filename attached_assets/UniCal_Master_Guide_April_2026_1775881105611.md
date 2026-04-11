# UniCal — Complete Master Application Guide

**Owner:** Bryn Kai-Hendricks (TMU Student)  
**App:** UniCal Academic Task Management Dashboard  
**Deployed On:** Raspberry Pi 5 at `http://172.24.1.204:5000`  
**Repository:** `https://github.com/Reachushere/Home-View.git`  
**Generated:** April 10, 2026  

---

# Table of Contents

- [Part 1: Architecture Overview](#part-1-architecture-overview)
- [Part 2: Technology Stack](#part-2-technology-stack)
- [Part 3: File Structure](#part-3-file-structure)
- [Part 4: Database Schema](#part-4-database-schema)
- [Part 5: Semester System](#part-5-semester-system)
- [Part 6: API Endpoints Reference](#part-6-api-endpoints-reference)
- [Part 7: Cat Washroom Study System](#part-7-cat-washroom-study-system)
- [Part 8: OneDrive File Sync](#part-8-onedrive-file-sync)
- [Part 9: Integrations & OAuth](#part-9-integrations--oauth)
- [Part 10: Home Assistant Configuration](#part-10-home-assistant-configuration)
- [Part 11: Raspberry Pi Deployment](#part-11-raspberry-pi-deployment)
- [Part 12: Pi Commands Reference](#part-12-pi-commands-reference)
- [Part 13: Troubleshooting](#part-13-troubleshooting)
- [Part 14: Agent Context Block](#part-14-agent-context-block)
- [Part 15: Complete Environment Variables](#part-15-complete-environment-variables)

---

# Part 1: Architecture Overview

UniCal is a full-stack academic task management app built for a single user (Bryn) at Toronto Metropolitan University. It runs on a Raspberry Pi 5 on the local network and integrates with Home Assistant, Google Calendar, Gmail, Spotify, OneDrive, Outlook Calendar, and OpenAI TTS.

## What It Does

- **Task Management:** Weekly calendar view with tasks, assignments, exams, classes organized by course and semester
- **Semester System:** Manages semesters from Winter 2026 through Fall 2029, with real courses and TBD placeholder slots for future semesters
- **Cat Washroom Study System:** Automated PDF reading system — when bathroom lights turn on, the system finds unread course materials, plays them as TTS audio on the Nest speaker, displays the text on the TV (via Fire Stick) and tablet, and tracks progress
- **Spotify Integration:** Full playback control with a custom holographic player UI
- **OneDrive Sync:** Automatically syncs course PDFs from OneDrive folder structure organized by semester/week/course
- **Calendar Sync:** Bidirectional sync with Google Calendar and Outlook Calendar
- **Announcements:** Pulls D2L (Brightspace) university announcements from a secondary Gmail account
- **Degree Tracking:** Tracks diploma progress across all semesters
- **Scheduled Alexa Announcements:** Morning routines, reminders, scheduled TTS on Echo speakers

## High-Level Architecture

```
Browser (172.24.1.204:5000)
    ↓
Vite Dev Server (frontend) ←→ Express Server (backend)
    ↓                              ↓
React + TanStack Query         PostgreSQL Database
                                   ↓
                            Home Assistant (Nabu Casa)
                            Google APIs (Calendar, Gmail)
                            Microsoft Graph (OneDrive, Outlook)
                            Spotify API
                            OpenAI / Edge TTS
```

The Express server serves both the API and the Vite-bundled frontend on port 5000. All smart home control goes through Home Assistant's REST API via a Nabu Casa cloud URL.

---

# Part 2: Technology Stack

| Technology | Purpose | Version |
|---|---|---|
| **Node.js** | Server runtime | v20.x |
| **TypeScript** | Type-safe JavaScript | 5.x |
| **Express** | HTTP server framework | 4.x |
| **React** | Frontend UI framework | 18.x |
| **Vite** | Frontend build tool / dev server | 5.x |
| **PostgreSQL** | Relational database | 16.x |
| **Drizzle ORM** | Database schema & queries | 0.x |
| **TanStack Query** | Frontend data fetching | v5 |
| **Tailwind CSS** | Utility-first CSS framework | 3.x |
| **shadcn/ui** | React component library | — |
| **wouter** | Client-side routing | — |
| **date-fns / date-fns-tz** | Date manipulation & timezone handling | — |
| **Edge TTS (node-edge-tts)** | Microsoft Edge text-to-speech | — |
| **pdf-parse** | PDF text extraction | — |
| **PM2** | Process manager (Pi deployment) | — |

---

# Part 3: File Structure

```
Home-View/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── dashboard.tsx        # Main dashboard (42,000+ lines — the big one)
│       │   ├── spotify-player.tsx   # Holographic Spotify player
│       │   ├── pdf-reader.tsx       # PDF reader for TV/tablet display during study
│       │   ├── pdf-viewer.tsx       # PDF viewer
│       │   ├── onedrive.tsx         # OneDrive file browser
│       │   ├── onenote.tsx          # OneNote viewer
│       │   ├── files.tsx            # File management
│       │   ├── projects.tsx         # Project tracking
│       │   ├── ticker.tsx           # D2L announcement ticker
│       │   ├── code-checker.tsx     # Code analysis tool
│       │   ├── mobile-notes.tsx     # Mobile notepad
│       │   └── not-found.tsx        # 404 page
│       ├── components/
│       │   ├── CourseDetailDialog.tsx # Course info editing dialog
│       │   └── ui/                  # shadcn/ui components
│       ├── hooks/
│       │   └── use-toast.ts         # Toast notification hook
│       ├── lib/
│       │   └── queryClient.ts       # TanStack Query config
│       ├── App.tsx                  # Route definitions
│       └── index.css                # Global styles + theme variables
├── server/
│   ├── routes.ts                    # ALL backend API routes (~23,000 lines)
│   ├── storage.ts                   # Database CRUD operations (IStorage interface)
│   ├── db.ts                        # Database connection setup
│   ├── index.ts                     # Server entry point
│   ├── vite.ts                      # Vite dev server integration
│   ├── static.ts                    # Static file serving
│   ├── timezone.ts                  # Locked timezone helpers (America/Toronto, password: 5747)
│   ├── gmail.ts                     # Gmail API (send, fetch, D2L announcements)
│   ├── gmailTicker.ts              # Gmail ticker for D2L announcements
│   ├── googleCalendar.ts           # Google Calendar sync
│   ├── secondGoogleAccount.ts      # 2nd Google account OAuth (D2L emails)
│   ├── thirdGoogleAccount.ts       # 3rd Google account OAuth (CRCU)
│   ├── onedrive.ts                 # OneDrive/Microsoft Graph API
│   ├── outlookCalendar.ts          # Outlook Calendar sync
│   ├── spotify.ts                  # Spotify API integration
│   ├── openai-approval.ts         # OpenAI usage approval gate
│   ├── reminderScheduler.ts       # Task reminder scheduling
│   ├── tmuCalendar.ts             # TMU academic calendar parsing
│   └── email.ts                   # Email utilities
├── shared/
│   └── schema.ts                   # Drizzle schema + types + utility functions
├── preload.cjs                     # Node.js preload for Pi deployment
├── drizzle.config.ts              # Drizzle configuration
├── vite.config.ts                 # Vite configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

---

# Part 4: Database Schema

All tables defined in `shared/schema.ts` using Drizzle ORM.

## Core Tables

### `semester_settings`
Central semester configuration. Each row = one semester. Has 3 course "slots" with full course info.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | Auto-increment. Known IDs: W2026=1, SS2026=2, F2026=4, W2027=5, SS2027=6, F2027=7, SS2028=9, F2028=10, W2029=11, SS2029=12, F2029=13 |
| `semesterName` | text | e.g. "Winter 2026 Semester" |
| `semesterStartDate` | timestamp | First day of classes |
| `semesterEndDate` | timestamp | Last day of classes |
| `semesterType` | text | `winter`, `fall`, or `spring_summer` |
| `isActive` | boolean | Only one should be true at a time |
| `readingWeekStart` | timestamp | Start of reading/mid-term break |
| `course1Code` through `course3Code` | text | Course codes (e.g. "CPPA122") or "TBD1", "TBD2" |
| `course1Name` through `course3Name` | text | Full course names |
| `course1Color` through `course3Color` | text | Hex color or gradient string |
| `course1FolderOverride` through `course3FolderOverride` | text | OneDrive folder path override |
| `course1SpringSummerTerm` | text | `full`, `first_half`, or `second_half` (SS only) |

**Semester Date Reference:**

| Semester | Start | End | Weeks | Reading Week |
|---|---|---|---|---|
| W2026 | Jan 12, 2026 | Apr 17, 2026 | 13 | Feb 16, 2026 |
| SS2026 | May 4, 2026 | Aug 4, 2026 | 14 | — |
| F2026 | Sep 14, 2026 | Dec 7, 2026 | 13 | Oct 12, 2026 |
| W2027 | Jan 11, 2027 | Apr 9, 2027 | 13 | Feb 15, 2027 |
| SS2027 | May 3, 2027 | Aug 3, 2027 | 14 | — |
| F2027 | Sep 13, 2027 | Dec 6, 2027 | 13 | — |
| W2028 | Jan 10, 2028 | Apr 14, 2028 | 13 | — |
| SS2028 | May 1, 2028 | Aug 1, 2028 | 14 | — |
| F2028 | Sep 11, 2028 | Dec 4, 2028 | 13 | — |
| W2029 | Jan 15, 2029 | Apr 13, 2029 | 13 | — |
| SS2029 | May 7, 2029 | Aug 7, 2029 | 14 | — |
| F2029 | Sep 10, 2029 | Dec 3, 2029 | 13 | — |

### `tasks`
All assignments, classes, reminders, and events.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `title` | text | Required |
| `type` | text | `reading`, `essay`, `project`, `exam`, `quiz`, `lab`, `class`, `discussion`, etc. |
| `courseName` | text | Associated course |
| `dueDate` | timestamp | Required |
| `startDate` | timestamp | Optional start/prep date |
| `eventStartTime` / `eventEndTime` | text | Time slots (e.g. "09:00") |
| `isCompleted` | boolean | Default false |
| `priority` | text | `low`, `medium`, `high` |
| `gradeWeight` | double | Weight in final grade |
| `gradeValue` / `gradeTotal` | double | Achieved/maximum score |
| `repeatType` | text | `none`, `daily`, `weekly`, `monthly`, `custom` |
| `calendarEventId` | text | Google/Outlook event ID |
| `projectId` | integer | FK to projects |
| `parentTaskId` | integer | Self-reference for recurring |
| `attachments` | text[] | Array of file paths/URLs |

### `subtasks`
Hierarchical child tasks.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `parentTaskId` | integer | FK to tasks.id |
| `parentSubtaskId` | integer | Self-reference for nesting |
| `title` | text | Required |
| `isCompleted` | boolean | Default false |
| `position` | integer | Sort order |

### `files`
Course material files synced from OneDrive.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `originalName` | text | Original filename |
| `displayName` | text | Display name override |
| `folder` | text | Virtual folder tag (e.g. `week-3-cppa122-module`) |
| `objectPath` | text | Storage path |
| `extractedText` | text | Parsed PDF text content |
| `listened` | boolean | Whether TTS playback completed |
| `totalChunks` | integer | Number of TTS audio chunks |
| `lastChunkIndex` | integer | Resume position |
| `preparedAudioPaths` | text | JSON array of generated audio file paths |
| `preparedAt` | timestamp | When audio was generated |

### `projects`
Project containers for grouping tasks.

### `task_links`
Dependencies between tasks/subtasks. Columns: `sourceType`, `sourceId`, `targetType`, `targetId`, `linkType` (`blocks`, `blocked_by`, `relates_to`).

### `sticky_notes`
Floating notes linked to tasks or projects.

### `announcements`
D2L/university announcements synced from Gmail.

### `scheduled_alexa_announcements`
Timed voice announcements for Echo speakers.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `message` | text | TTS text to speak |
| `scheduledAt` | timestamp | When to fire |
| `repeatType` | text | `none`, `daily`, `weekly`, `monthly`, `yearly`, `custom` |
| `repeatInterval` | integer | For custom repeat |
| `repeatIntervalUnit` | text | `days`, `weeks`, `months`, `years` |
| `speakers` | text | Target speakers ("all" or specific) |
| `voiceGender` | text | `female` or `male` |
| `isEnabled` | boolean | Whether active |
| `isSent` | boolean | Whether already sent this cycle |

### `ha_automations`
Custom Home Assistant automation definitions.

### `second_google_account` / `third_google_account`
OAuth tokens for secondary/tertiary Google accounts.

### `degree_tracking_data`
Key-value store for diploma tracking progress.

### `notepad_notes` / `notepad_attachments`
Notepad notes with file attachments.

### `weather_alert_history`
Tracks weather alerts already shown/announced.

### `app_state`
Key-value store for persistent app state (e.g., last sync timestamps).

### `feedback_notes`
User feedback/bug tracking.

---

# Part 5: Semester System

## How Semesters Work

### Active Semester Detection
- Only ONE semester is `isActive = true` at a time
- `storage.getActiveSemesterSettings()` returns it
- The active semester drives: dashboard display, file sync, week calculation, automation behavior

### Auto-Activation (`checkAndActivateSemester`)
**Location:** `server/routes.ts` ~line 11535  
**Runs:** On server start + every 1 hour

Logic:
1. Get current date (Toronto time)
2. If current active semester hasn't ended yet → do nothing
3. Find any semester where `start <= now <= end`
4. If found → deactivate old, activate new
5. If none found (break period) → log "Between semesters" and leave current active unchanged

**Break Period Behavior:**
- During breaks (e.g., Apr 18 – May 3 between W2026 and SS2026), W2026 stays active
- The cat washroom automation checks if today > semester end date and **skips entirely** during breaks (no "checking your readings" message)
- On the first day of the new semester, auto-activation picks it up within 1 hour

### Week Number Calculation (`getWeekNumber`)
**Location:** `shared/schema.ts` ~line 516

1. Aligns semester start to nearest Saturday
2. Calculates: `Math.floor(daysDiff / 7) + 1`
3. If within reading week → returns `-1`
4. If after reading week → subtracts 1 (so weeks stay continuous: 1-6, reading week, 7-13)

### Spring/Summer Half-Term Handling
SS semesters are 14 weeks total, optionally split into two 7-week halves.

Each course has a `springSummerTerm` setting:
- `full` → normal 14-week progression
- `first_half` → only weeks 1-7 (Spring); skipped after week 7
- `second_half` → only weeks 8-14 (Summer); maps to OneDrive folders Week 1-7 by subtracting 7

**OneDrive folder week mapping:**
- `first_half` courses: folder `Week {semesterWeek}` (1-7)
- `second_half` courses: folder `Week {semesterWeek - 7}` (maps 8→1, 9→2, etc.)
- Folder names include season: `Week 1 - Spring`, `Week 1 - Summer`

### Course Slot System
Each semester has 3 course slots. Courses can be:
- **Real courses:** `CPPA122`, `CFNF400`, etc.
- **TBD placeholders:** `TBD1`, `TBD2`, `TBD3` for future semesters

The `findSemSlot` helper (~line 6813) does three-way matching:
1. `TBD_SLOT{N}` → slot N directly
2. Exact code match → that slot
3. `TBD{N}` → slot N if TBD-prefixed

### Display Name Rules
- `fromDb=true` → render only bold displayName, no subtitle
- TBD courses display as "TBD1", "TBD2", etc.
- Color source of truth: DB semester settings ALWAYS checked first (never default to `#6366F1`)

---

# Part 6: API Endpoints Reference

## Task Management
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tasks` | List all tasks (filters: weekNumber, type, completed) |
| GET | `/api/tasks/:id` | Get single task |
| POST | `/api/tasks` | Create task (duplicate prevention) |
| PATCH | `/api/tasks/:id` | Update task |
| PATCH | `/api/tasks/:id/complete` | Toggle completion |
| PATCH | `/api/tasks/:id/flag` | Flag task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/reorder` | Manual reorder |
| POST | `/api/tasks/bulk-import` | Bulk import |
| POST | `/api/tasks/generate-weekly-deadlines` | Auto-generate recurring deadlines |

## Semester & Course
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/semester` | Get active semester settings |
| POST | `/api/semester` | Create/update semester |
| GET | `/api/semester-settings/all` | Get all semesters |
| PATCH | `/api/semester-settings/:id` | Update specific semester |
| PATCH | `/api/semester-settings/calendar` | Update calendar sync settings |
| GET | `/api/course-week-mappings` | Date-to-week mappings |

## Files & OneDrive
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/files` | List all file records |
| GET | `/api/files/:id/text` | Extract PDF text |
| POST | `/api/files/:id/listened` | Mark file as listened |
| POST | `/api/files/prepare-audio` | Generate TTS audio for file |
| POST | `/api/onedrive/sync-course-week` | Manual sync for specific course/week |
| POST | `/api/onedrive/ensure-semester-folders` | Create OneDrive folder structure |
| GET | `/api/onedrive/files` | Browse OneDrive |

## Calendar
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/google-calendar/events` | Fetch Google Calendar events |
| POST | `/api/google-calendar/sync` | Sync tasks ↔ Google Calendar |
| GET | `/api/outlook-calendar/events` | Fetch Outlook events |
| POST | `/api/outlook-calendar/sync` | Sync tasks ↔ Outlook |

## Home Assistant & Automation
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ha/entities` | List HA entities |
| POST | `/api/ha-announce` | TTS announcement on speakers |
| POST | `/api/webhook/cat-lights` | Cat washroom lights ON trigger |
| POST | `/api/webhook/cat-lights-off` | Cat washroom lights OFF |
| POST | `/api/webhook/cat-shower-button` | Shower button direct play |
| POST | `/api/cat-wash/confirm` | Confirm reading prompt (start playback) |
| POST | `/api/cat-wash/decline` | Decline reading prompt |
| POST | `/api/cat-wash/pause` | Pause playback |
| POST | `/api/cat-wash/resume` | Resume playback |
| POST | `/api/cat-wash/stop` | Stop playback |
| POST | `/api/cat-wash/skip` | Skip current file |
| POST | `/api/cat-wash/restart` | Restart current file |
| POST | `/api/cat-wash/volume` | Set volume |
| POST | `/api/voice-command` | Voice command handler (pause/resume/stop/skip/restart/reset) |
| GET | `/api/cat-wash/find-next` | Find next file to play |
| GET | `/api/automation-cooldown` | Check startup/stop cooldown status |

## Scheduled Announcements
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/scheduled-alexa-announcements` | List all |
| POST | `/api/scheduled-alexa-announcements` | Create new |
| PATCH | `/api/scheduled-alexa-announcements/:id` | Update |
| DELETE | `/api/scheduled-alexa-announcements/:id` | Delete |
| POST | `/api/scheduled-alexa-announcements/:id/test` | Test fire |

## Email
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/email/send` | Send email via Gmail |
| POST | `/api/email/send-with-attachment` | Send email with attachment |
| GET | `/api/gmail/recent` | Fetch recent emails |
| POST | `/api/announcements/sync-gmail` | Sync D2L announcements from Gmail |

## Spotify
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/spotify/now-playing` | Currently playing track |
| POST | `/api/spotify/play` | Start playback |
| POST | `/api/spotify/pause` | Pause |
| POST | `/api/spotify/next` | Next track |
| POST | `/api/spotify/previous` | Previous track |
| POST | `/api/spotify/volume` | Set volume |
| POST | `/api/spotify/play-on-speaker` | Play on specific device |

## Misc
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/weather` | Weather data + forecast |
| GET | `/api/news` | RSS news headlines |
| GET | `/api/health` | Server health check |
| GET | `/api/degree-tracking` | Diploma tracking data |
| POST | `/api/degree-tracking` | Update tracking (body: `{ key, value }`) |
| GET | `/api/pending-review` | Morning review items |
| POST | `/api/tablet-nav/set` | Command tablet navigation |
| GET | `/api/tablet-nav` | Tablet polls for commands |

---

# Part 7: Cat Washroom Study System

## Devices

| Device | Entity ID | Purpose |
|---|---|---|
| Cat Washroom Light | `light.cat_lights` | Trigger sensor |
| Nest Speaker | `media_player.bathroom_speaker` | Primary TTS audio playback |
| HA Voice Speaker | `media_player.home_assistant_voice_097c38_media_player` | Voice acknowledgment ("One moment...") |
| Samsung TV | `media_player.tv_cat_wr` | Display (woken via CEC) |
| Fire Stick | `media_player.fire_tv_172_24_0_88` | ADB-controlled, launches Silk Browser |
| Fire Tablet | `media_player.tablet_cat` | Secondary display, polled navigation |
| Kitchen Echo | `media_player.echo_kitchen_studio_black_am` | Radio playback (CHUM FM) |
| Confirmation Boolean | `input_boolean.module_reading_confirmed` | HA boolean for prompt state |
| Pending Boolean | `input_boolean.module_reading_pending` | HA boolean for prompt state |

## Constants (server/routes.ts)
```
NEST_SPEAKER_ENTITY = "media_player.bathroom_speaker"
CAT_WR_HA_VOICE_ENTITY = "media_player.home_assistant_voice_097c38_media_player"
CAT_LIGHTS_ENTITY = "light.cat_lights"
CAT_TV_ENTITY = "media_player.tv_cat_wr"
FIRE_STICK_ADB_ENTITY = "media_player.fire_tv_172_24_0_88"
MODULE_READING_PENDING = "input_boolean.module_reading_pending"
MODULE_READING_CONFIRMED = "input_boolean.module_reading_confirmed"
NABU_CASA_URL = "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa"
HOME_ASSISTANT_URL = (via env or default to Nabu Casa URL)
SERVER_STARTUP_COOLDOWN_MS = 60 * 1000 (60 seconds)
```

## Flow A: Lights Turn ON

**Webhook:** `POST /api/webhook/cat-lights` (triggered by HA automation)

1. **Guard checks:** Is prompt already pending? Is playback active? Is there a post-stop cooldown (60s)? Manual stop cooldown (120s)? Server startup cooldown (60s)? Is it a break period (past semester end date)?
2. **Break period check:** If active semester's end date has passed → exit immediately, no sound at all
3. **Device wake (parallel):** Wake tablet, turn on HA Voice + Nest speakers, set volumes
4. **Acknowledgment:** HA Voice says "One moment, checking your readings." (Cloud TTS primary, Nest speaker fallback)
5. **File lookup:** Calculate current week number → `findNextFileByPriority()` → check DB for unlistened files tagged with current week
6. **OneDrive sync:** If no cached file found, sync OneDrive (30s timeout) then re-check
7. **Priority order:** CPPA modules > other modules > CPPA readings > other readings
8. **If no files:** Play CHUM FM 104.5 radio on kitchen Echo
9. **If file found:** HA Voice asks "Good morning Bryn. Would you like to play your [Course] [Module/Reading] for week [N]?"
10. **Wait for confirmation:** System waits for `input_boolean.module_reading_confirmed` to turn ON (via UI tap or voice command)

## Flow B: Lights Turn OFF

**Webhook:** `POST /api/webhook/cat-lights-off`

1. Stop any active TTS playback on Nest speaker
2. Send `stop_playback` command to tablet
3. Turn off Samsung TV (first) then Fire Stick
4. Clear all playback state variables
5. Reset HA booleans (pending + confirmed)

## Flow C: Confirmed Playback

**Endpoint:** `POST /api/cat-wash/confirm`

1. **Confirmation TTS:** Generate Edge TTS audio for "Okay Bryn, I will now play your [course] [type]"
2. **Play on Nest:** Upload audio to HA → play via `media_player/play_media`. If Nest not actually playing (idle wake issue), **falls back to HA Cloud TTS** (fixed April 2026)
3. **TV Setup (parallel):**
   - Send Samsung TV WoL (`media_player/turn_on`)
   - Check Fire Stick state → turn ON (CEC wakes Samsung) or do OFF→ON cycle
   - Wait 8s for boot → verify TV state → retry up to 3x
   - Launch Silk Browser on Fire Stick via ADB monkey command
   - Navigate to reader URL
4. **Tablet Setup:** Send navigation command to reader URL via tablet polling
5. **Chunk 0 pre-generation:** Start generating first TTS chunk in parallel
6. **Start playback:** `startNestChunkPlayback()` begins the chunk-by-chunk audio loop

### Chunk Playback Loop (`startNestChunkPlayback`)
- Text is split into ~1500 character chunks via `chunkTextForNest()`
- Each chunk is converted to MP3 via Edge TTS (`generateAndSaveTTSAudio`)
- Audio uploaded to HA media → played on Nest via Nabu Casa URL
- Progress tracked: `catWashPlaybackState.chunkIndex`, `wordIndex`
- After each chunk: update DB `lastChunkIndex`, advance to next chunk
- When all chunks done: mark file `listened = true`, find next file, auto-continue
- All files done: announce "All readings for this week are complete. Great job Bryn."

### Resume Logic
When resuming, the system starts **one chunk before** the last saved position to provide context.

## Flow D: Shower Button

**Webhook:** `POST /api/webhook/cat-shower-button`

Same as Flow A but skips the confirmation prompt — goes directly to playback. Has its own startup cooldown check.

## Flow E: Volume Knob

**Endpoint:** `POST /api/cat-wash/volume`

Adjusts volume on whichever speaker is currently active (Nest, HA Voice, or Echo group).

## Flow F: Knob Press — Master STOP

**Endpoint:** `POST /api/cat-wash/stop`

1. Stops all TTS playback
2. Saves current chunk position for resume
3. Sets manual stop cooldown (120s — prevents immediate re-trigger)

## Flow G: Voice Commands

**Endpoint:** `POST /api/voice-command`

Supported commands:
- `pause` → Pause playback, announce "Paused. Say re-zoom to continue, or I'll stop in [N] minutes."
- `resume` / `re-zoom` → Resume from saved position
- `stop` → Full stop (like knob press)
- `skip` → Skip current file, play next
- `restart` → Restart current file from beginning
- `reset` → Reset all files for current week to unlistened

## TTS Fallback Chain

1. **Edge TTS** (primary) → generates MP3 → upload to HA → play via `media_player/play_media`
2. **HA Cloud TTS** (fallback) → `tts/speak` service call directly to speaker
3. **espeak-ng** (last resort) → local offline TTS

For Nest confirmation specifically: if `playOnNestSpeaker` returns `success: true` but `actuallyPlaying: false` (Nest was asleep), it falls through to Cloud TTS fallback.

## Background Processes

- **Audio Preparation Queue:** Pre-generates TTS audio for upcoming files
- **Scheduled Alexa Checker:** Runs every 30 seconds, fires scheduled announcements
- **Semester Auto-Activation:** Runs every 1 hour
- **OneDrive Folder Monitor:** Watches for folder renames

---

# Part 8: OneDrive File Sync

## OneDrive Folder Structure
```
/School/1. TMU/Courses/
├── 2026/
│   ├── Winter/
│   │   ├── CPPA 122 - Local Politics/
│   │   │   ├── Week 1/
│   │   │   │   ├── Module/
│   │   │   │   │   └── lecture.pdf
│   │   │   │   └── Readings/
│   │   │   │       └── reading1.pdf
│   │   │   ├── Week 2/
│   │   │   └── ...
│   │   ├── CFNF 400 - Human Sexuality/
│   │   └── CASL 101 - Sign Language/
│   ├── Spring & Summer/
│   │   ├── TBD3 - Course Name/
│   │   │   ├── Week 1 - Spring/
│   │   │   │   ├── Module/
│   │   │   │   └── Readings/
│   │   │   ├── Week 1 - Summer/
│   │   │   └── ...
│   │   └── ...
│   └── Fall/
│       └── ...
```

## Sync Function: `syncOneDriveFilesForWeek`
**Location:** `server/routes.ts`

1. Takes semester settings + week number
2. For each course slot (1-3):
   - Get course folder path from `folderOverride` or build from semester/course info
   - **Half-term mapping:** If `second_half` and semWeek > 7 → look for `Week {semWeek - 7}`. If `first_half` and semWeek > 7 → skip (course ended)
   - Look for `Module` and `Readings` subfolders inside the week folder
   - Download any new PDFs not already in the database
   - Tag files with virtual folder: `week-{semesterWeek}-{courseCode}-{module|reading}`

## Manual Sync
Dashboard cloud button calls `POST /api/onedrive/sync-course-week` with specific course and week parameters.

## File Tagging
- DB `folder` field uses semester-global week number (e.g., `week-8-tbd3-module` for a second-half course in semester week 8)
- This is intentional — the bathroom automation uses `week-{N}` tags to find files by priority
- The hover tooltip on the dashboard shows the folder-relative path (e.g., "Week 1 - Summer")

---

# Part 9: Integrations & OAuth

## 1. Home Assistant
- **Connection:** REST API via Nabu Casa cloud URL
- **Auth:** Long-Lived Access Token (LLAT) in `HOME_ASSISTANT_TOKEN` env var
- **URL:** `https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa`
- **Usage:** Smart home control, speaker announcements, device state queries

## 2. Google Calendar (Primary)
- **Auth:** Replit connector (`google-calendar` integration)
- **Token refresh:** Automatic via Replit connector API
- **Fallback:** `.google_tokens.json` cache file
- **Scopes:** `calendar.readonly`, `calendar.events`

## 3. Gmail (Primary — homeworkbryn@gmail.com)
- **Auth:** Replit connector (`google-mail` integration)
- **Usage:** Send emails, fetch recent emails, sync D2L announcements
- **Functions:** `sendGmail()`, `sendGmailWithAttachment()`, `fetchRecentEmails()`

## 4. Second Google Account (D2L Announcements)
- **Auth:** Full OAuth2 flow in `server/secondGoogleAccount.ts`
- **Env vars:** `GOOGLE_SECOND_ACCOUNT_CLIENT_ID`, `GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET`
- **Token storage:** `second_google_account` DB table
- **Usage:** Fetches D2L (Brightspace) email notifications from a second Gmail

## 5. Third Google Account (CRCU)
- **Auth:** Same OAuth2 pattern in `server/thirdGoogleAccount.ts`
- **Token storage:** `third_google_account` DB table

## 6. Spotify
- **Auth:** OAuth2 Authorization Code flow in `server/spotify.ts`
- **Env vars:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- **Token storage:** `.cache/spotify-token.json`
- **Token refresh:** Automatic using refresh token via `https://accounts.spotify.com/api/token`

## 7. Microsoft OneDrive & Outlook
- **Auth:** Azure AD OAuth2 + Device Code Flow in `server/onedrive.ts`
- **Token storage:** `.onedrive_tokens.json`
- **Scopes:** `Files.Read`, `Files.ReadWrite`, `Calendars.Read`, `Mail.Read`, `offline_access`
- **Token refresh:** Automatic using refresh token

## 8. OpenAI TTS
- **Env var:** `OPENAI_API_KEY`
- **Usage:** Text-to-speech generation (primarily uses Edge TTS as free alternative)
- **Approval gate:** `server/openai-approval.ts` prevents unauthorized API calls

## 9. Edge TTS (node-edge-tts)
- **No API key needed** — free Microsoft Edge TTS
- **Primary TTS engine** for all study reading playback
- **Voice:** `echo` with slow pace
- **Fallback:** If rate-limited, backs off exponentially (15s, 30s, up to 120s)

---

# Part 10: Home Assistant Configuration

## Required Input Booleans (configuration.yaml)
```yaml
input_boolean:
  module_reading_pending:
    name: Module Reading Pending
    initial: false
  module_reading_confirmed:
    name: Module Reading Confirmed
    initial: false
```

## Required Automations (automations.yaml)

### Cat Washroom Lights ON
```yaml
- alias: "Cat Washroom Lights ON → UniCal"
  trigger:
    - platform: state
      entity_id: light.cat_lights
      to: "on"
  action:
    - service: rest_command.unical_cat_lights_on
```

### Cat Washroom Lights OFF
```yaml
- alias: "Cat Washroom Lights OFF → UniCal"
  trigger:
    - platform: state
      entity_id: light.cat_lights
      to: "off"
  action:
    - service: rest_command.unical_cat_lights_off
```

### Module Reading Confirmed
```yaml
- alias: "Module Reading Confirmed → UniCal"
  trigger:
    - platform: state
      entity_id: input_boolean.module_reading_confirmed
      to: "on"
  condition:
    - condition: state
      entity_id: input_boolean.module_reading_pending
      state: "on"
  action:
    - service: rest_command.unical_cat_wash_confirm
```

## Required REST Commands (configuration.yaml)
```yaml
rest_command:
  unical_cat_lights_on:
    url: "http://172.24.1.204:5000/api/webhook/cat-lights"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"state": "on"}'

  unical_cat_lights_off:
    url: "http://172.24.1.204:5000/api/webhook/cat-lights-off"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"state": "off"}'

  unical_cat_wash_confirm:
    url: "http://172.24.1.204:5000/api/cat-wash/confirm"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{}'

  unical_cat_shower_button:
    url: "http://172.24.1.204:5000/api/webhook/cat-shower-button"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{}'

  unical_voice_command:
    url: "http://172.24.1.204:5000/api/voice-command"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"command": "{{ command }}"}'
```

---

# Part 11: Raspberry Pi Deployment

## Hardware
- **Raspberry Pi 5, 8GB RAM** — essential for Node.js + PostgreSQL + TTS processing
- **Official 27W USB-C power supply** — underpowered supplies cause crashes
- **128GB A2-rated microSD** — required for PostgreSQL random I/O
- **Active cooler** — TTS processing pushes sustained CPU load
- **Ethernet cable** — for reliable network connection

## Initial Setup

### 1. Flash OS
- Raspberry Pi Imager → Raspberry Pi OS (64-bit, Lite)
- Enable SSH, set username `byhomeyyz`, set password, configure WiFi as backup

### 2. Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib build-essential git python3-pip
pip3 install edge-tts --break-system-packages
```

### 3. Set Up Database
```bash
sudo -u postgres psql -c "CREATE USER dashboard WITH PASSWORD 'YOUR_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE dashboard_db OWNER dashboard;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dashboard_db TO dashboard;"
```

### 4. Clone & Build
```bash
cd ~
git clone https://github.com/Reachushere/Home-View.git
cd Home-View
npm install
npm run build
```

### 5. Set Up PM2
```bash
sudo npm install -g pm2
pm2 start dist/index.cjs --name dashboard --cwd /home/byhomeyyz/Home-View --node-args="-r /home/byhomeyyz/Home-View/preload.cjs"
pm2 save
pm2 startup  # follow the printed command to enable auto-start on boot
```

### 6. Environment Variables
Create `.env` file in `/home/byhomeyyz/Home-View/` with all required variables (see Part 15).

---

# Part 12: Pi Commands Reference

## Connecting to the Pi
```bash
# From Windows PowerShell or Terminal
ssh byhomeyyz@172.24.1.204

# Paste in PowerShell: right-click (if QuickEdit enabled)
# Or use Windows Terminal for Ctrl+V paste support
```

## Deploy Updated Code
```bash
cd ~/Home-View && git pull origin main && npm run build && pm2 delete dashboard; pm2 start dist/index.cjs --name dashboard --cwd /home/byhomeyyz/Home-View --node-args="-r /home/byhomeyyz/Home-View/preload.cjs" && pm2 save
```

Or step by step:
```bash
cd ~/Home-View
git pull origin main
npm run build
pm2 delete dashboard
pm2 start dist/index.cjs --name dashboard --cwd /home/byhomeyyz/Home-View --node-args="-r /home/byhomeyyz/Home-View/preload.cjs"
pm2 save
```

## Common PM2 Commands
```bash
pm2 status                    # Show running processes
pm2 logs dashboard            # View live logs
pm2 logs dashboard --lines 100 # View last 100 log lines
pm2 restart dashboard         # Restart the app
pm2 stop dashboard            # Stop the app
pm2 delete dashboard          # Remove from PM2
pm2 save                      # Save current process list (survives reboot)
pm2 startup                   # Generate auto-start script
```

## System Commands
```bash
# Check if port 5000 is in use
sudo lsof -i :5000

# Kill process on port 5000
fuser -k 5000/tcp

# Check disk space
df -h

# Check memory usage
free -h

# Check CPU temperature
vcgencmd measure_temp

# Check Node.js version
node --version

# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check Pi's IP address
hostname -I

# Reboot the Pi
sudo reboot

# Shutdown the Pi
sudo shutdown now
```

## Database Commands
```bash
# Connect to PostgreSQL
sudo -u postgres psql dashboard_db

# Inside psql:
\dt                           # List all tables
\d+ tasks                     # Describe tasks table
SELECT count(*) FROM tasks;   # Count tasks
SELECT * FROM semester_settings WHERE is_active = true;  # Active semester
SELECT * FROM files WHERE listened = false;  # Unlistened files
\q                            # Exit psql
```

## Git Commands (on Pi)
```bash
cd ~/Home-View
git status                    # Check for local changes
git pull origin main          # Pull latest from GitHub
git log --oneline -10         # Last 10 commits
git stash                     # Stash local changes before pull
git stash pop                 # Re-apply stashed changes
```

## Log Management
```bash
# PM2 logs are at:
~/.pm2/logs/dashboard-out.log
~/.pm2/logs/dashboard-error.log

# View recent logs
pm2 logs dashboard --lines 200

# Search logs for errors
grep -i "error" ~/.pm2/logs/dashboard-error.log | tail -20

# Clear PM2 logs
pm2 flush

# Check system logs
journalctl -u postgresql --since "1 hour ago"
```

## Network Troubleshooting
```bash
# Test if app is responding
curl http://localhost:5000/api/health

# Test Home Assistant connectivity
curl -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa/api/

# Check firewall
sudo iptables -L

# Check if port is open
sudo ss -tlnp | grep 5000
```

---

# Part 13: Troubleshooting

## App Won't Start
1. Check PM2 logs: `pm2 logs dashboard --lines 50`
2. Check if port 5000 is already in use: `sudo lsof -i :5000`
3. Kill orphan process: `fuser -k 5000/tcp`
4. Check PostgreSQL is running: `sudo systemctl status postgresql`
5. Verify `.env` file exists and has DATABASE_URL
6. Try running directly: `cd ~/Home-View && node dist/index.cjs` to see errors

## Database Issues
1. Check connection: `sudo -u postgres psql dashboard_db -c "SELECT 1;"`
2. If tables missing: `cd ~/Home-View && npm run db:push`
3. If schema mismatch: `npm run db:push --force`
4. NEVER change primary key ID column types (serial ↔ varchar)

## TV Won't Turn On
1. Check Fire Stick ADB entity in HA: `media_player.fire_tv_172_24_0_88` — is it "available"?
2. Test from HA Developer Tools: call `media_player.turn_on` on the Samsung TV entity
3. CEC stuck: unplug HDMI from Fire Stick for 10 seconds, replug
4. The code hasn't changed — this is typically a CEC/ADB hardware issue

## Nest Speaker Says "Ok" But Doesn't Play Confirmation
This was fixed (April 2026). The code now checks `actuallyPlaying` — if the Nest woke up but didn't play audio, it falls back to HA Cloud TTS.

## Morning Announcements Playing at Wrong Time
1. Check scheduled announcements in the DB or UI
2. After a restart, the dedup tracker (`__alexaSentKeys`) is wiped — announcements near the restart time may re-fire
3. The 2-minute firing window means only announcements within ±2 minutes of current time will trigger

## OneDrive Sync Not Finding Files
1. Verify folder structure matches expected pattern (see Part 8)
2. Check course `folderOverride` in semester settings
3. For SS half-term: ensure `springSummerTerm` is set correctly on each course
4. Check OneDrive token: try browsing files via `/onedrive` page

## Cooldown Timer Not Showing
Fixed (April 2026). `SERVER_START_TIME` now initializes to `Date.now()` immediately. Cooldown is 60 seconds, then shows grey "0s" for an additional 60 seconds.

## Break Period — Automation Still Triggering
Fixed (April 2026). The automation now checks if today is past the active semester's end date and exits immediately — no speaker wake-up, no "checking your readings" message.

---

# Part 14: Agent Context Block

Copy this entire block and paste it as the FIRST message when talking to a new AI agent about this app:

```
I have a full-stack academic task management app called UniCal built with:
- Frontend: React + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query v5 + wouter routing
- Backend: Express + TypeScript on Node.js 20
- Database: PostgreSQL with Drizzle ORM
- Deployed on: Raspberry Pi 5 at http://172.24.1.204:5000
- Repository: https://github.com/Reachushere/Home-View.git
- Process manager: PM2

Key files:
- server/routes.ts — ALL backend routes (~23,000 lines)
- client/src/pages/dashboard.tsx — Main frontend (~42,000 lines)
- shared/schema.ts — Database schema + types
- server/storage.ts — Database CRUD operations
- server/timezone.ts — Locked to America/Toronto (password: 5747)
- server/gmail.ts — Gmail send/fetch
- server/onedrive.ts — OneDrive/Microsoft Graph
- server/spotify.ts — Spotify integration
- client/src/components/CourseDetailDialog.tsx — Course editing

Critical rules:
- NEVER say "anyway"
- NEVER ask multiple questions at once
- NEVER modify CASL task data
- NEVER skip db:push after schema changes
- NEVER change primary key ID column types
- DO NOT TOUCH "Degree Tracker" or "Diploma Tracking" page names
- Color source of truth: DB semester settings checked first, never default to #6366F1
- DisplayName rule: fromDb=true → render only bold displayName, no subtitle
- TBD courses display as "TBD1", "TBD2", etc.
- Server timezone is LOCKED to America/Toronto (password protected)
- getAppTz() on frontend: returns _appTimezoneOverride || 'America/Toronto'
- Calendar pencil edit uses (courseData as any)._semKey NOT (course as any)._semKey
- findSemSlot helper: three-way matching for course slots
- SS half-term: second_half courses map semWeek 8-14 → folder Week 1-7 (subtract 7)
- DB folder tags use semester-global week for bathroom automation consistency

Pi deploy command:
cd ~/Home-View && git pull origin main && npm run build && pm2 delete dashboard; pm2 start dist/index.cjs --name dashboard --cwd /home/byhomeyyz/Home-View --node-args="-r /home/byhomeyyz/Home-View/preload.cjs" && pm2 save

Git push command:
git push https://Reachushere:$GITHUB_PERSONAL_ACCESS_TOKEN3@github.com/Reachushere/Home-View.git main

Semester IDs: W2026=1, SS2026=2, F2026=4, W2027=5, SS2027=6, F2027=7, SS2028=9, F2028=10, W2029=11, SS2029=12, F2029=13

degree-tracking API: POST /api/degree-tracking with { key, value } — not PATCH

The app manages semesters W2026 through F2029 for TMU student Bryn.
Real W2026 courses: CPPA122 (Local Politics), CFNF400 (Human Sexuality), CASL101 (Sign Language)
Future semesters use TBD1, TBD2, TBD3 placeholder slots.

The Cat Washroom Study System automates PDF reading:
- Lights ON → checks for unlistened files → asks confirmation → plays TTS on Nest speaker + shows on TV/tablet
- Entity IDs: light.cat_lights, media_player.bathroom_speaker, media_player.fire_tv_172_24_0_88, media_player.tv_cat_wr
- During semester breaks: automation exits silently (no speakers, no prompts)
- Confirmation TTS requires actuallyPlaying=true, otherwise falls back to Cloud TTS
- SERVER_STARTUP_COOLDOWN_MS = 60 seconds
```

---

# Part 15: Complete Environment Variables

```env
# Database
DATABASE_URL=postgresql://dashboard:YOUR_PASSWORD@localhost:5432/dashboard_db

# Home Assistant
HOME_ASSISTANT_TOKEN=your_long_lived_access_token
HOME_ASSISTANT_URL=https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa

# App URL
DEPLOYED_APP_URL=http://172.24.1.204:5000

# Site Password (protects the app)
SITE_PASSWORD=your_site_password

# Google OAuth (Second Account — D2L)
GOOGLE_SECOND_ACCOUNT_CLIENT_ID=your_client_id
GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET=your_client_secret

# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Microsoft / OneDrive (tokens managed via .onedrive_tokens.json)
# No env vars needed — device code flow stores tokens locally

# GitHub (for git push from Replit)
GITHUB_PERSONAL_ACCESS_TOKEN3=your_github_pat
```

---

*End of UniCal Master Guide — April 10, 2026*
