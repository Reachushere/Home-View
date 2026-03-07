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
- **Home Assistant**: For push notifications, voice integration, and smart trigger webhooks.
  - **Cat Wash Automation** (`/api/webhook/cat-wash`): Water sensor triggers playback of current week's unlistened CPPA module (same logic as cat-lights). Opens PDF reader on Fire Tablets and Samsung TV via Fire Stick with `catWashFollow=true&autoplay=true`. **Day restriction**: Wed-Fri only. Resumes from saved progress. Stops when toothbrush returns to charging (`/api/webhook/cat-wash-stop`, sensor: `sensor.toothbrush_bryn_toothbrush_state`). The **tablet's browser** handles all TTS playback using OpenAI voice via `<audio>` element — audio outputs through Bluetooth to the Echo speaker. No server-side AMP calls. **Auto-continuation**: when all chunks finish, the tablet calls `POST /api/cat-wash/update-progress` with `completed: true` to get the next file URL and auto-navigates. Helper functions: `extractAndChunkPdf`, `openUrlOnFireDevice`, `openUrlOnFireStick`.
  - **Cat Wash Dry** (`/api/webhook/cat-wash-dry`): When `water_sensor_cat_shower` changes to dry during active cat wash playback, switches speaker from tablet Bluetooth (Echo Cat Left) to Echo Cat Middle (`media_player.echo_cat_washroom_middle`). Re-opens PDF reader on tablets/TV with `speaker` param and `resumeChunk` to continue from exact position. PDF reader supports `resumeChunk` URL param for mid-session speaker switches.
  - **Cat Lights Trigger** (`/api/webhook/cat-lights`): When `light.cat_lights` turns ON and the current week's CPPA module hasn't been fully listened to, starts/resumes playback from saved progress on the Cat Wash speaker group (`media_player.cat_wash_2`). Light turning OFF does NOT stop playback. Only applies to CPPA module files, not all readings. **Day restriction**: Only triggers Wednesday through Friday (Sat/Sun/Mon/Tue are skipped — school week starts Saturday). **Home theatre**: Fire Stick entity is turned on first (HDMI-CEC triggers TV), with direct TV turn_on as backup.
  - **Cat Door Stop** (`/api/webhook/cat-door`): When `binary_sensor.door_sensor_cat` opens, stops all cat washroom playback (cat wash, cat lights, TTS sessions) and saves progress. This is the stop mechanism for cat lights playback.
  - **TTS Architecture**: Server extracts PDF text, chunks it (~1500 chars), and serves chunk data. The tablet's PDF reader generates OpenAI TTS audio for each chunk via `/api/tts`, plays it through browser `<audio>` element (Bluetooth → Echo), and highlights words in sync. No AMP/Alexa voice involved. Echo speakers cannot play arbitrary URLs without AMP — server-side TTS fallback to Echo is NOT possible.
  - **Device Opening**: Tablets use `command_activity` → `command_broadcast_intent` → `command_webview` fallback chain. Fire Sticks use `androidtv/adb_command` to launch Silk with URL intent → `media_player/play_media` with `url` type fallback.
  - **Resume Logic**: Both cat-wash and cat-lights webhooks resume from saved `lastChunkIndex`. Progress is saved by the tablet via `POST /api/cat-wash/update-progress`.

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