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
- **File Attachments**: Upload files directly to Replit object storage or paste URLs
- **File Management**: Dedicated /files page for viewing, renaming, and assigning files to tasks
- **Course Color Coding**: CPPA122 (green), CFNF400 (pink), CASL101 (indigo)
- **Calendar Export**: Download .ics files for individual tasks
- **Dashboard Layout**: Three task sections - Due Today (orange cards), Upcoming (pale yellow cards), Missed (red styling)
- **Blinking Animations**: Tasks due today blink fast (0.8s), tasks due tomorrow blink slowly (60s)

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