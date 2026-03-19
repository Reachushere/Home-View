# replit.md

## Overview

This project is a full-stack task management application designed for academic use. Its primary purpose is to help students efficiently organize and track their coursework, including tasks, due dates, and completion status. Key capabilities include managing tasks by week, course, and type (readings, essays, exams), detecting missed tasks, and supporting comprehensive semester and subtask management. The application aims to be a comprehensive tool for academic workload management, including integrations for calendar exports and external services.

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
- **Task Management**: Planning periods with visual indicators, due date management, completion tracking, and repeat task configurations.
- **Semester System**: Comprehensive management of academic semesters (Fall/Winter/Spring-Summer) with per-course configuration for delivery mode, class scheduling, and individual start/end dates. Includes automated semester transition prompts and a checklist.
- **Subtasks & Projects**: Nested subtasks with completion tracking and dependencies (blocks, blocked_by, relates_to). Full project management with status, priority, progress bars, and multiple view modes (Grid, List, Workflow).
- **UI/UX**: Dashboard layout with "Due Today," "Upcoming," and "Missed" sections, course color coding, blinking animations for urgency, and visual arrow connections between UI elements.
- **File Management**: Uploads to object storage, URL pasting, and a dedicated files page.
- **Calendar Integration**: .ics file generation for tasks and integration with Google Calendar events.
- **Degree Tracking**: Elective course management with dropdowns, GPA calculation, and functionality to upload and parse course list files to update tasks.
- **Syllabus Upload & Parsing**: Upload PDF syllabus per course via CourseDetailDialog. Uses OpenAI to extract assignments, deadlines, grading breakdown, policies, and week numbering style. Review UI shows parsed items with accept/decline/edit controls. Syllabus paths stored in `app_state` table (key `courseSyllabusPaths`) and localStorage fallback. View Syllabus button available in both edit and view modes.
- **OneDrive Folder Generation**: Auto-creates semester/course/week folder structure on OneDrive. `generateWeekFolderNames()` handles reading week detection by aligning dates to Monday, producing "Reading Week - STUDY" folder without incrementing week numbers. Supports Winter (13 weeks + reading) and Spring/Summer (first_half, second_half, full) term structures.

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
- **OpenAI TTS**: For server-side text-to-speech functionality.
- **Home Assistant**: For push notifications, voice integration, smart trigger webhooks, and Alexa reminder announcements. Includes specific automations for "Cat Wash" and "Cat Lights" that manage audio playback and device control based on sensor data and schedules. Also features dynamic quiet hours based on a partner shift schedule. Voice command webhook (`/api/webhook/voice-command`) supports pause (10-min auto-stop), resume, stop, restart/go_back, reset, and skip — each integrating fully with the cat wash automation (tablet, TV, highlighting, toothbrush polling, Echo clearing, TTS confirmations). Status endpoint at `/api/voice-command/status`.
- **Gmail Ticker System**: Google Apps Script (hosted at script.google.com) pushes emails to the app via webhooks. Supports 5 email types: (1) Subject "Ticker" → bottom ticker bar, (2) Subject "Reminder" → todo list with red button indicator, (3) Subject "Delete" → removes ticker/calendar/todo items by body text, (4) Forwarded from user's Outlook/TMU address → calendar task, (5) D2L Brightspace → D2L announcement ticker. Endpoints: `/api/webhook/ticker`, `/api/webhook/reminder`, `/api/webhook/delete`, `/api/webhook/email-homework`, `/api/announcements/webhook`. Auth: `?auth=5747` or body `auth` field.