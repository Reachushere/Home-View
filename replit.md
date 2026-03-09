# replit.md

## Overview

This project is a full-stack task management application for academic use, enabling users to organize and track coursework by week, course, and task type (readings, essays, exams, etc.). It includes features for due date management, completion tracking, and detection of missed tasks. The primary goal is to provide a comprehensive tool for students to manage their academic workload efficiently.

## User Preferences

Preferred communication style: Simple, everyday language.
Publishing preference: Always publish with mobile-ready compatibility enabled.

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
- **Planning Periods**: Tasks can have optional start dates with visual "connecting lines" indicating preparation periods from `startDate` to `dueDate`.
- **Task Visualization**: Specific arrow specifications for connecting tasks between UI elements (e.g., "This Week" box to Calendar, "Today" box to "Prep Extension" text). These arrows use two-layer rendering (transparent base, opaque overlay) and precise positioning for visual clarity.
- **OpenAI TTS Integration**: Server-side text-to-speech for devices without browser `speechSynthesis`.
- **File Management**: Uploads to Replit object storage, URL pasting, and a dedicated `/files` page for management.
- **Course Color Coding**: Visual identification for specific courses (e.g., CPPA122 - green).
- **Calendar Export**: .ics file generation for individual tasks.
- **Dashboard Layout**: "Due Today," "Upcoming," and "Missed" sections with distinct visual indicators.
- **Blinking Animations**: Visual cues for task urgency.
- **Task Repeat**: Configurable daily, weekly, monthly, or custom interval task repetition with Google Calendar sync.
- **Semester System**: Comprehensive semester management with Fall/Winter/Spring-Summer types. Per-course configuration for delivery mode (Virtual/Online), class day/time scheduling, individual start/end dates, and Spring/Summer term options (full/first-half/second-half). Auto-generation of class tasks for Virtual courses with duplicate prevention. Semester date calculation utilities for computing standard academic date ranges.
- **Semester Transition**: Automated prompt and configuration for new academic semesters.
- **Subtasks**: Nested tasks with completion tracking, progress counters, and cascading deletion. Supports task dependencies (blocks, blocked_by, relates_to).
- **Projects**: Comprehensive project management with creation/editing, status, priority, progress bars, task linking, and multiple view modes (Grid, List, Workflow). Workflow view visualizes task dependencies.

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
- **OpenAI TTS**: For server-side text-to-speech.
- **Home Assistant**: For push notifications, voice integration, smart trigger webhooks, and Alexa reminder announcements.
  - **Cat Wash Automation** (`/api/webhook/cat-wash`): Water sensor triggers playback of current week's unlistened CPPA module. Opens PDF reader on Fire Tablets and Samsung TV via Fire Stick for visual follow-along. **Day restriction**: Wed-Fri only (all days during Spring/Summer). Resumes from saved progress. Stops when toothbrush starts running (`/api/webhook/cat-wash-stop`) or door opens (`/api/webhook/cat-door`). **Audio plays on Google Nest speaker** (`media_player.nestaudio6787`) via server-side TTS — no tablet Bluetooth needed. Helper functions: `extractAndChunkPdf`, `openUrlOnFireDevice`, `openUrlOnFireStick`.
  - **Cat Wash Dry** (`/api/webhook/cat-wash-dry`): When `water_sensor_cat_shower` changes to dry during active cat wash playback, switches speaker from tablet Bluetooth (Echo Cat Left) to Echo Cat Middle (`media_player.echo_cat_washroom_middle`). Re-opens PDF reader on tablets/TV with `speaker` param and `resumeChunk` to continue from exact position.
  - **Cat Lights Trigger** (`/api/webhook/cat-lights`): When `light.cat_lights` turns ON and the current week's CPPA module hasn't been fully listened to, starts/resumes playback. **Audio plays on Google Nest speaker** via server-side TTS. Light turning OFF does NOT stop playback. **Day restriction**: Wed-Fri only (all days during Spring/Summer). **Home theatre**: Fire Stick entity is turned on first (HDMI-CEC triggers TV), with direct TV turn_on as backup.
  - **Cat Door Stop** (`/api/webhook/cat-door`): When `binary_sensor.door_sensor_cat` opens, stops all cat washroom playback and saves progress. Plays goodbye message on Nest speaker.
  - **TTS Architecture**: Server extracts PDF text, chunks it (~4000 chars), generates OpenAI TTS audio (voice: nova) for each chunk, and casts to **Google Nest speaker** via `media_player.play_media`. Server-side `startNestChunkPlayback()` manages the loop: generates audio per chunk, casts to Nest, polls Nest state to detect when chunk finishes, then plays next. **Attention prompts**: "Bryn, are you paying attention?" every 5 chunks (not at the start — only after 3+ chunks from the starting position). **Filename announcement**: reads out the file name before starting chunks. **Goodbye message**: on stop (toothbrush/door), plays "Stopping. [filename]. File position saved. See you next time Bryn." on Nest. **Echo stop**: Alexa Echos are stopped (`media_player.media_stop`) at the start of each session. **Auto-continuation**: when all chunks finish, server checks for the next file and auto-continues.
  - **Device Opening**: Tablets use `command_activity` → `command_broadcast_intent` → `command_webview` fallback chain. Fire Sticks use `androidtv/adb_command` to launch Silk with URL intent → `media_player/play_media` with `url` type fallback.
  - **Resume Logic**: Both cat-wash and cat-lights webhooks resume from saved `lastChunkIndex`. Progress is saved by the tablet via `POST /api/cat-wash/update-progress`.
  - **Alexa Reminder Announcements**: Server-side 60-second interval checks tasks with explicit scheduled times (eventStartTime or non-midnight dueDate). Only fires for non-default reminders (skips schema defaults of 30/120 unless user has set custom reminder3/4). Deduplicates with a Set of `taskId-reminderMinutes-dueDate` keys. Auto-cleans keys older than 24 hours.
  - **Partner Shift Schedule & Dynamic Quiet Hours**: `shift_schedule` table stores per-day shift type (day/night/off) as YYYY-MM-DD strings. Quiet hours adjust based on today's shift: night shift (7:30p-7:30a) → quiet 10am-5pm, day shift (7:30a-7:30p) → quiet 10pm-5am, no shift → quiet 10pm-8am. Tasks with explicit reminders always announce even during quiet hours (wake-up override). Calendar Settings dialog has expandable "Partner Shift Schedule" section with year calendar grid (12 mini-months, click to cycle off→day→night). API: `GET/POST /api/shift-schedule`, `DELETE /api/shift-schedule/:date`.

## Upcoming Semesters

### Spring/Summer 2026
**Semester Start**: May 4, 2026
**Note**: This semester has courses with different start/end dates and schedules.

| Course | Name | Start | End | Days | Time | Notes |
|--------|------|-------|-----|------|------|-------|
| CSOC103 | How Society Works | May 4, 2026 | July 31, 2026 | Online | Async | Full-length online course |
| CPHL110 | Philosophy of Religion I | May 5, 2026 | June 16, 2026 | Tue/Thu | 1:00-4:00pm | Intensive 7-week course |
| CASL201 | Intro to ASL II | June 22, 2026 | August 10, 2026 | Mon/Wed | 9:30am-12:30pm | Starts after CPHL ends |

**OneDrive Folder Path**: `/School/1. TMU/Courses/2026/Spring & Summer/`
- `CSOC 103 - How Society Works`
- `CPHL 110 - Philosophy of Religion I` (Weeks 1-7)
- `CASL 201 - Intro to ASL II`

**Key Considerations for Schema**:
- Courses need individual start/end dates (not just semester-wide)
- Class schedules (days of week, times) should be stored per course
- Week numbers may need to be relative to each course's start date