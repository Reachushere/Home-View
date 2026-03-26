# replit.md

## Overview

This project is a full-stack task management application designed for academic use. Its primary purpose is to help students efficiently organize and track their coursework, including tasks, due dates, and completion status. Key capabilities include managing tasks by week, course, and type (readings, essays, exams), detecting missed tasks, and supporting comprehensive semester and subtask management. The application aims to be a comprehensive tool for academic workload management, including integrations for calendar exports and external services.

## User Preferences

Preferred communication style: Simple, everyday language.
Publishing preference: Always publish with mobile-ready compatibility enabled.
Publish reminder: Every time I suggest publishing, I MUST ask the user: "Would you like me to email you a copy of the HA automation and webhook code that changed?" If they say yes, compile all relevant webhook endpoint code (from server/routes.ts) and HA automation YAML (from Self_Hosting_Guide.md) that work together for the changed automation, and email it to them via the app's email system.

## CRITICAL: Timezone Rule (5747-Protected)

**ALL server-side date/time logic MUST use `server/timezone.ts` functions.** The timezone is locked to `America/Toronto` and requires password `5747` to change. This is NON-NEGOTIABLE.

- NEVER use raw `new Date()` for date comparisons, day boundaries, or hour checks
- NEVER use `setHours(0,0,0,0)` on a raw Date — use `easternMidnight()` instead
- NEVER compute "tomorrow" or day boundaries with UTC arithmetic — use `easternDateStr()` + `addDays()`
- ALWAYS import from `server/timezone.ts`: `easternNow`, `easternDateStr`, `easternHour`, `easternMidnight`, `taskDateStr`, `addDays`
- ALWAYS compare task dates using `taskDateStr(dueDate)` which returns YYYY-MM-DD in Eastern time
- The daily digest voice message has a MAX_NAMES_TO_READ cap of 10 — if more tasks, read first 5 names + "and X more"
- This rule has been broken multiple times before. It MUST NOT be broken again.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter.
- **State Management**: TanStack Query (React Query).
- **UI Components**: shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with custom properties for theming (light/dark modes).
- **Animations**: Framer Motion.
- **Form Handling**: React Hook Form with Zod validation.

### Backend
- **Runtime**: Node.js with TypeScript.
- **Framework**: Express.js v5.
- **API Design**: RESTful API with typed routes and Zod schemas for validation.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations.
- **Schema Management**: Drizzle Kit for migrations.

### Build System
- **Development**: Vite dev server with HMR, proxied via Express.
- **Production**: Custom build script using esbuild for server and Vite for client.

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend, including Replit integrations.
- `shared/`: Shared types, schemas, and API contracts.
- `migrations/`: Database migration files.

### Key Features
- **Task Management**: Planning periods with visual indicators, due date management, completion tracking, and repeat task configurations.
- **Semester System**: Comprehensive management of academic semesters (Fall/Winter/Spring-Summer) with per-course configuration for delivery mode, class scheduling, and individual start/end dates. Includes automated semester transition prompts and a checklist.
- **Subtasks & Projects**: Nested subtasks with completion tracking and dependencies (blocks, blocked_by, relates_to). Full project management with status, priority, progress bars, and multiple view modes (Grid, List, Workflow).
- **UI/UX**: Dashboard layout with "Due Today," "Upcoming," and "Missed" sections, course color coding, blinking animations for urgency, and visual arrow connections between UI elements.
- **File Management**: Uploads to object storage, URL pasting, and a dedicated files page.
- **Calendar Integration**: .ics file generation for tasks, Google Calendar sync, and .ics invite emails to attendees via Resend.
- **Outlook Calendar Integration**: Syncs Outlook calendar events (via Microsoft Graph API with dedicated Outlook connector) to a pending review queue. Runs daily at 8am via scheduler.
- **Morning Review Dialog**: Auto-triggers at 9am daily if pending items exist. Shows Outlook calendar events and Gmail-parsed tasks grouped by source. Accept creates tasks, reject skips. Bulk accept/reject available.
- **Invite Functionality**: Each task card has an "Invite" button that expands an email input field. Sends .ics calendar invites to specified email addresses via Resend.
- **Degree Tracking**: Elective course management with dropdowns, GPA calculation, and functionality to upload and parse course list files to update tasks.
- **Syllabus Upload & Parsing**: Upload PDF syllabus per course via CourseDetailDialog. Uses OpenAI to extract assignments, deadlines, grading breakdown, policies, and week numbering style. Review UI shows parsed items with accept/decline/edit controls. Syllabus paths stored in `app_state` table (key `courseSyllabusPaths`) and localStorage fallback. View Syllabus button available in both edit and view modes.
- **OneDrive Folder Generation**: Auto-creates semester/course/week folder structure on OneDrive. `generateWeekFolderNames()` handles reading week detection by aligning dates to Monday, producing "Reading Week - STUDY" folder without incrementing week numbers. Supports Winter (13 weeks + reading) and Spring/Summer (first_half, second_half, full) term structures.
- **Quick Notes (OneDrive Scratchpad)**: Live-syncing notes viewer at `/onenote`. Reads `.txt`, `.md`, and `.html` files from a `QuickNotes` folder in OneDrive root. Auto-creates folder and default `notes.txt` on first access. Auto-refreshes content every 5 seconds. Edit files on phone via OneDrive/Word app for instant sync to dashboard. Supports basic markdown rendering for `.md` files and HTML rendering for `.html` files.

### Design Patterns
- **Type Safety**: End-to-end TypeScript with shared types.
- **API Contracts**: Zod schemas for API validation.
- **Storage Abstraction**: `IStorage` interface for database flexibility.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Type-safe database query builder.
- **connect-pg-simple**: PostgreSQL session store for Express.
- **Radix UI**: Headless UI primitives.
- **shadcn/ui**: Component library.
- **Lucide React**: Icon library.
- **date-fns**: Date utility library.
- **Vite**: Frontend build tool.
- **esbuild**: Server code bundler.
- **Drizzle Kit**: Database migration tool.
- **Replit Plugins**: Runtime error overlay, cartographer, and dev banner.
- **OpenAI TTS**: For server-side text-to-speech functionality. Fallback chain: OpenAI gpt-audio → Edge TTS (Microsoft, free) → espeak-ng (local, offline, zero rate limits). Edge TTS failure detection tracks consecutive failures; after 5 failures, automatically switches to local TTS. Background audio repair job runs every 30 minutes to re-prepare files with failed/missing chunks.
- **Home Assistant**: For push notifications, voice integration, smart trigger webhooks, and Alexa reminder announcements. Includes specific automations for "Cat Wash" and "Cat Lights" that manage audio playback and device control based on sensor data and schedules. **Samsung TV Browser**: The cat washroom TV follow display now uses Samsung TV's built-in browser via `media_player/play_media` with `media_content_type: 'url'` as the primary method. Fire Stick + Silk browser is the fallback. Samsung TV source list uses `'HDMI'` (not `'HDMI1'`). `'Internet'` source also works to open the built-in browser app. Also features dynamic quiet hours based on a partner shift schedule. Voice command webhook (`/api/webhook/voice-command`) supports pause (10-min auto-stop), resume, stop, restart/go_back, reset, and skip — each integrating fully with the cat wash automation (tablet, TV, highlighting, toothbrush polling, Echo clearing, TTS confirmations). Status endpoint at `/api/voice-command/status`. Playback state is persisted to the `app_state` DB table (key `playback_session`) so that server restarts during active playback save chunk progress and announce recovery via HA Cloud TTS. Audio preparation queue pauses during live playback to prevent TTS resource contention. Circuit breaker stops playback after 3 consecutive Nest speaker failures and announces the error. HA health monitor pings HA every 60s, tracks connectivity state, creates HA persistent notification on recovery. Health endpoint at `GET /api/health` (includes `commandQueue` status). Self-ping every 4 min prevents Replit sleep. Cat lights confirmation is webhook-primary (`/api/webhook/cat-lights-confirm`) with 10s backup poll (down from 1.5s). **HA Resilience**: `haServiceCallSafe()` queues failed non-critical HA calls (volume, booleans, TV off) for automatic retry on reconnection. Command queue (max 50, 5-min TTL) drains on each successful health check. `waitForNestPlaybackEnd` uses time-based estimation as primary (no HA polling during chunk wait), with lightweight HA state verification only after the timer expires. If HA goes offline mid-playback, circuit breaker pauses and waits up to 5 min for reconnection before stopping.
- **Standard Dialog/Page Styling**: All new dialogs and pages must follow the Degree Tracking panel style: Header uses `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)` with backdrop blur, white text in Avenir font at 12px. Body uses `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`. Outer border: `1.5px solid rgba(255,255,255,0.35)`. Buttons use the same header gradient background with `inset 0 1px 0 rgba(255,255,255,0.3)` box-shadow.
- **Gmail Ticker System**: Google Apps Script (hosted at script.google.com) pushes emails to the app via webhooks. Supports 5 email types: (1) Subject "Ticker" → bottom ticker bar, (2) Subject "Reminder" → todo list with red button indicator, (3) Subject "Delete" → removes ticker/calendar/todo items by body text, (4) Forwarded from user's Outlook/TMU address → calendar task, (5) D2L Brightspace → D2L announcement ticker. Endpoints: `/api/webhook/ticker`, `/api/webhook/reminder`, `/api/webhook/delete`, `/api/webhook/email-homework`, `/api/announcements/webhook`. Auth: `?auth=5747` or body `auth` field.