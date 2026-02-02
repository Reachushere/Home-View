# replit.md

## Overview

This is a full-stack task management application designed for academic coursework tracking. The application allows users to manage tasks organized by week numbers, track different task types (readings, modules, essays, projects, discussions, polls, exams, quizzes), and associate tasks with specific courses. The system supports task completion tracking, due date management, and missed task detection.

## User Preferences

Preferred communication style: Simple, everyday language.
Publishing preference: Always publish with mobile-ready compatibility enabled.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming, supporting light/dark modes
- **Animations**: Framer Motion for smooth transitions and layout animations
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with TypeScript, using tsx for development execution
- **Framework**: Express.js v5 for HTTP server and API routing
- **API Design**: RESTful API with typed routes defined in shared/routes.ts using Zod schemas for request/response validation
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for database migrations with schema defined in shared/schema.ts

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Custom build script using esbuild for server bundling and Vite for client bundling
- **Output**: Server compiled to dist/index.cjs, client assets to dist/public

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/  # UI components including shadcn/ui
│       ├── hooks/       # Custom React hooks (including use-upload for file uploads)
│       ├── lib/         # Utility functions and query client
│       └── pages/       # Page components
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations layer
│   ├── db.ts         # Database connection
│   └── replit_integrations/  # Replit integrations
│       └── object_storage/   # File upload handling via presigned URLs
├── shared/           # Shared code between client and server
│   ├── schema.ts     # Drizzle database schema and types
│   └── routes.ts     # API route contracts with Zod validation
└── migrations/       # Database migration files
```

### Features
- **Planning Periods**: Tasks can have optional start dates to show when to begin preparation
- **Connecting Lines**: Visual lines connect prep tasks across days, showing the full planning period from startDate to dueDate
  - First prep day: rounded-l corners with line extending right
  - Intermediate prep days: no rounding, lines on both sides
  - Due day: rounded-r corners with line extending from left

### Arrow Specifications (PRESERVED FORMAT)
All arrows connecting task boxes to calendar follow these exact specifications:

**General Arrow Rules:**
- All arrows exit 21px to the left from checkboxes
- Dashed line pattern: strokeDasharray="5,3" (5px dash, 3px gap)
- Stroke width: 2px

**Pink/Indigo Arrows (This Week box → Calendar):**
- Connect from This Week box tasks to their calendar positions
- Two-layer rendering: transparent base (0.25 opacity) with opaque overlay for first portion
- End at calendar task position

**Green Arrows (Tomorrow box → Calendar):**
- Connect from Tomorrow box tasks to their calendar positions
- Two-layer rendering with opaque first ~30 dashes, transparent for rest
- Stay visible when calendar scrolls (rendered in separate z-index layers)

**Tomorrow Arrows (Tomorrow box → Calendar task checkbox):**
- Approach from ABOVE the target and point DOWN (mirror of prep arrows)
- Path: exit 21px left from Tomorrow box → down to container bottom → curve to above target → straight down
- Final position offset: targetX = conn.toX + 6 (6px right), lineEndY = conn.toY - 13 (13px up)
- Arrowhead marker: refX="10", refY="3.5" with polygon "0 0, 10 3.5, 0 7"
- Line ends at arrowhead tip (no overlap)

**Prep Arrows (Today box → Prep Extension text):**
- Connect from Today box checkbox to "Prep days" text on prep extensions
- Path: 21px straight left from checkbox, then curved down using quadratic bezier (`Q` command), then straight down to target
- Full path formula: `M fromX fromY L exitX fromY Q exitX midY, toX midY L toX endY`
- Arrowhead points DOWN, positioned 14px above the prep text center
- Two-layer rendering:
  - Layer 1: Transparent base (0.25 opacity) for full path with downward arrowhead
  - Layer 2: Opaque overlay (1.0 opacity) for first 22 dashes using same path
  - Opaque dasharray: `"5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,3,5,0,0,99999"`
- Uses unique `data-today-checkbox` attribute on Today box checkboxes for precise targeting

- **OpenAI TTS**: Server-side text-to-speech using OpenAI's gpt-audio model for devices without browser speechSynthesis (Fire tablets). Endpoint at `/api/tts` accepts text and voice parameters (alloy, echo, fable, onyx, nova, shimmer). Audio plays through device speakers or Bluetooth-paired Echo.
- **File Attachments**: Upload files directly to Replit object storage or paste URLs
- **File Management**: Dedicated /files page for viewing, renaming, and assigning files to tasks
- **Course Color Coding**: CPPA122 (green), CFNF400 (pink), CASL101 (indigo)
- **Calendar Export**: Download .ics files for individual tasks
- **Dashboard Layout**: Three task sections - Due Today (orange cards), Upcoming (pale yellow cards), Missed (red styling)
- **Blinking Animations**: Tasks due today blink fast (0.8s), tasks due tomorrow blink slowly (60s)
- **Task Repeat**: Tasks can repeat daily, weekly, monthly, or at custom intervals with child task generation and Google Calendar sync
- **Semester Transition**: When past Week 13 end date, a banner prompts user to set up a new semester with configurable start date and 3 color-coded courses (code, name, professor). Week calculations use the active semester's start date dynamically.
- **Subtasks**: Tasks can have subtasks for breaking down complex assignments. Subtasks appear in both Add Task and Edit Task dialogs and support:
  - Create/toggle/delete subtasks
  - Completion tracking with progress counter (e.g., "2/5 done")
  - Cascading deletion when parent task is deleted
  - Database tables: `subtasks` (with hierarchy support via parentSubtaskId) and `taskLinks` (for dependencies: blocks, blocked_by, relates_to)
- **Projects**: Full project management system at /projects route with:
  - Create/edit/delete projects with name, description, color, status (planning/in_progress/on_hold/completed), priority (low/medium/high)
  - Link tasks to projects via projectId field
  - Project cards showing progress bars, task counts, and completion percentages
  - Filter cards for status-based filtering (All, In Progress, Planning, Completed, On Hold)
  - Three view modes: Grid (card layout), List (compact rows), Workflow (dependency visualization)
  - Workflow view shows task dependencies (blocks/blocked_by) with visual indicators for blocked/ready/completed tasks
  - Overall progress dashboard with completion stats by priority level
  - Database table: `projects` with API at /api/projects and /api/links for task dependencies

### Key Design Patterns
- **Type Safety**: End-to-end TypeScript with shared types between frontend and backend
- **API Contracts**: Zod schemas define API input/output types in shared/routes.ts, ensuring type consistency
- **Storage Abstraction**: IStorage interface in storage.ts allows for potential database swapping
- **Path Aliases**: TypeScript path aliases (@/, @shared/) for clean imports

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via DATABASE_URL environment variable
- **Drizzle ORM**: Type-safe query builder and schema management
- **connect-pg-simple**: PostgreSQL session storage for Express sessions

### UI Libraries
- **Radix UI**: Headless UI primitives (dialogs, dropdowns, tooltips, etc.)
- **shadcn/ui**: Pre-built component library using Radix UI and Tailwind
- **Lucide React**: Icon library
- **date-fns**: Date manipulation utilities

### Development Tools
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Fast JavaScript bundler for server code
- **Drizzle Kit**: Database migration tooling
- **Replit Plugins**: Runtime error overlay, cartographer, and dev banner for Replit environment

## Known Issues & Lessons Learned (January 2026 Session)

### CRITICAL: HMR/Browser Caching Issues
- Changes often don't apply despite code updates due to HMR or browser caching
- ALWAYS restart workflow AND ask user to hard refresh (Ctrl+Shift+R) after styling changes
- Don't keep making changes if they're not visible - restart first

### Undo Button Styling Errors
- **Problem**: Went in circles trying to apply gradients that weren't visible
- **Root cause**: Used Button component which has its own background styling that interferes
- **Solution**: Use two nested div elements instead of Button component
- **Gradient directions**: 0deg = bottom to top, 180deg = top to bottom
- **Final design**: 
  - Back circle (border): `linear-gradient(180deg, #FFE566 0%, #FF8C00 100%)` - yellow top, orange bottom
  - Front circle: `linear-gradient(0deg, #FFE566 0%, #FF8C00 100%)` - yellow bottom, orange top (flipped)
  - Inner circle: 38x38px, Border: 3px padding (44x44px total)
- **Lesson**: Don't copy-paste and modify - leads to duplicate handlers and mismatched closing tags

### Project Page Errors
- Project box header colors needed to match Today/Tomorrow/This Week boxes (brown #160502)
- Project cards: Fixed height 240px, background `rgba(255, 255, 255, 0.2)`

### Dashboard Layout Issues Encountered
- **This Week box columns**: Layout issues with task columns
- **Oval shapes**: Styling problems
- **Three boxes (Today/Tomorrow/This Week)**: Positioning and sizing issues
- **Calendar**: Current time styling - grey cells for current hour, light beige for today column, blue (#C5D8EC) at intersection
- **Brown headers**: Color consistency across all box headers (#160502)
- **Button attachment**: Buttons not attaching properly to containers
- **Backgrounds**: Various background color issues

### This Week Box - Second Row Alignment (February 2026 Fix)
- **Problem**: Second task row columns not aligning with first row; course name overflowing into due date column
- **Root cause**: First row uses flex layout with dynamic content widths; second row needed to match positions exactly
- **Solution**: Use absolute positioning for row 2 elements based on measured positions from row 1
- **Implementation**:
  - Row 1 uses refs to measure element positions: `row1TaskRef`, `row1CodeRef`, `row1CourseRef`, `row1DueRef`, `row1ProgressBarRef`
  - `measurePositions()` function in useEffect calculates pixel positions relative to container (100ms delay)
  - Row 2 ONLY renders when measurements are available (guard: `row1Positions.due > 0`)
  - Row 2 elements are absolutely positioned using measured values directly (no fallbacks)
  - Course name in row 2 has `maxWidth` set to `(row1Positions.due - row1Positions.course - 10)px` to prevent overflow
  - Tailwind `truncate` class handles text ellipsis
- **CRITICAL**: Row 1 layout must NEVER be modified - it's the reference for all measurements
- **Key state**: `row1Positions` stores { task, code, course, due, days, progressBar, progressBarTop }

### General Lessons
1. **Don't use Button component for custom circular buttons** - use div elements instead
2. **Always restart workflow after styling changes** - HMR is unreliable
3. **Use contrasting colors in gradients** - similar colors don't show visible gradients on small elements
4. **Document gradient directions explicitly**: 0deg goes bottom→top, 180deg goes top→bottom
5. **Check for duplicate code** when copy-pasting - leads to syntax errors
6. **Verify changes are applied** before making more changes - avoid going in circles

### Production vs Development Sync Issue
- Production deployment not syncing with development version - ongoing issue

## TODO / Reminders

### Email Reminders (Not Yet Set Up)
- User wants email reminders sent to bryn.kai-hendricks@outlook.com
- User also wants screen popup reminders
- SendGrid integration was dismissed by user
- Resend integration was also dismissed by user (February 2026)
- User has set up DNS records for uni-call.app domain for Resend (DKIM, MX, SPF)
- To proceed, user needs to either:
  1. Complete the Resend integration authorization flow, OR
  2. Provide RESEND_API_KEY as a secret for manual integration
- Alternative: Could use Nodemailer with another SMTP provider if user provides credentials

### Home Assistant Voice Integration (Incomplete)
- Voice command API endpoints are ready: `/api/voice/add-task` and `/api/voice/tasks-today`
- User needs to configure Home Assistant with:
  1. REST commands in `configuration.yaml`
  2. Custom sentences in `config/custom_sentences/en/calendar_tasks.yaml`
  3. Intent scripts for voice responses
- See conversation history for full YAML configuration examples