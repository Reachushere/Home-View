# replit.md

## Overview

This is a full-stack task management application designed for academic coursework tracking. The application allows users to manage tasks organized by week numbers, track different task types (readings, modules, essays, projects, discussions, polls, exams, quizzes), and associate tasks with specific courses. The system supports task completion tracking, due date management, and missed task detection.

## User Preferences

Preferred communication style: Simple, everyday language.

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