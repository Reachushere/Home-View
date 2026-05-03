# UniCal / Home-View — Code Map

> Source-of-truth map for ChatGPT / Replit Agent / human maintainers.
> If you move a file, **update this doc in the same commit**.

**Live URL:** https://uni-cal.app  
**Deploy target:** Raspberry Pi via Cloudflare Tunnel  
**Process manager:** PM2 (`pm2 restart all` on the Pi)  
**Deploy command:**
```bash
cd ~/Home-View && git pull && npm run build && pm2 restart all
```

---

## 0. Top-level layout

```
client/        Vite + React frontend (TanStack Query, wouter, Tailwind, shadcn)
server/        Express backend (Drizzle ORM, Postgres)
shared/        Drizzle schema + shared TS types (DO NOT change without explicit ask)
docs/          This folder
scripts/       Utilities — incl. smoke.mjs
.local/
  patch-backups/   Auto-written by POST /api/dev/patch
dev-change-log.md  Auto-appended by POST /api/dev/patch
```

---

## 1. Where each major feature lives

| Feature | Primary file(s) |
|---|---|
| **Cat Lights automation** | `server/routes.ts` `POST /api/webhook/cat-lights` (~line 21340) |
| **Cat Wash / Shower Button** | `server/routes.ts` `POST /api/webhook/cat-shower-button` |
| **Cat Knob / Volume / Stop** | `server/routes.ts` `/api/webhook/cat-knob-press`, `/cat-volume`, `/cat-wash-stop` |
| **TTS generation (chunked)** | `server/replit_integrations/audio/client.ts` (`textToSpeech`) + `server/serverHelpers.ts` (`generateAndSaveTTSAudio`, chunking) |
| **TTS playback orchestration** | `server/routes.ts` (TTSSession, `sendNextChunk`, `scheduleNextChunk`, `stopTTSSession`) |
| **AudioPrep queue** | `server/routes.ts` (search "AudioPrep") |
| **PDF text extraction** | `server/routes.ts` (`getPdfParser` import from `serverHelpers`, extraction inlined in routes) |
| **OneDrive auth + listing** | `server/onedrive.ts` |
| **OneDrive sync (per-week)** | `server/routes.ts` `syncOneDriveFilesForWeek()` (~line 18148) |
| **File priority selection** | `server/routes.ts` `findNextFileByPriority()` (~line 18580), `findNextCatWashFile()` (~line 20607) |
| **Calendar (Google primary)** | `server/googleCalendar.ts` |
| **Calendar (Google #2 / #3)** | `server/secondGoogleAccount.ts`, `server/thirdGoogleAccount.ts` |
| **Calendar (Outlook)** | `server/outlookCalendar.ts` |
| **Gmail send + D2L scrape** | `server/gmail.ts` |
| **Reminder scheduler loop** | `server/reminderScheduler.ts` |
| **DB schema (Drizzle)** | `shared/schema.ts` |
| **Storage interface** | `server/storage.ts` (`IStorage` + `DatabaseStorage`) |
| **Spotify** | `server/spotify.ts` |
| **TMU calendar pull** | `server/tmuCalendar.ts` |
| **HA fetch / queue / helpers** | `server/serverHelpers.ts` (`haFetch`, `haServiceCall`, `haServiceCallSafe`, `haCommandQueue`, `processHACommandQueue`) |
| **Object storage (Replit)** | `server/replit_integrations/object_storage.ts` |
| **Frontend dashboard** | `client/src/pages/dashboard.tsx` (single huge page) |
| **Course Pipeline diagram** | `client/src/components/CourseAutomationPipeline.tsx` |
| **Library / files browser** | `client/src/components/LibraryView.tsx` |
| **Course detail** | `client/src/components/CourseDetailDialog.tsx` |
| **First-run wizard** | `client/src/components/SystemSetupWizard.tsx` |
| **Hidden Dev Panel** | `client/src/components/DevPanel.tsx` (Ctrl+Shift+D) |
| **Dev introspection backend** | `server/dev/devTrace.ts`, `server/dev/devRoutes.ts` |

---

## 2. Subsystem ownership

### TTS / audio
- **Generation:** `server/replit_integrations/audio/client.ts`
- **Chunking:** `server/serverHelpers.ts` (`CHARS_PER_SECOND`, `CHUNK_SIZE`, `getChunkWithSentenceBoundary`)
- **Playback session state:** `server/routes.ts` module-scope `currentTTSSession` + `sendNextChunk` / `scheduleNextChunk` / `stopTTSSession`
- **AudioPrep batch queue:** `server/routes.ts` (search `AudioPrep`)

### OneDrive
- **Auth + low-level API:** `server/onedrive.ts` (`getOneDriveFile`, `listOneDriveItems`, `getOneDriveItemByPath`, device-code flow)
- **Per-week file sync:** `server/routes.ts` `syncOneDriveFilesForWeek()`
- **Folder path edits:** `server/routes.ts` `POST /api/syllabus/paths`, `/api/assignments/paths`, `/api/textbook/paths`
- **Folder audit (read-only):** `GET /api/dev/onedrive-audit`

### Cat Lights / Shower Button
- All in `server/routes.ts` near lines 21262, 21326. Uses:
  - `catWashTrace` → in-memory ring (legacy)
  - `devLogStep` → new structured trace (post-2026-05)
  - `findNextFileByPriority` for file selection
  - `playChumFmRadio` for fallback
  - `haServiceCall` / `haServiceCallSafe` for HA actions

### Semester / course folders
- **Active semester:** `storage.getActiveSemesterSettings()` in `server/storage.ts`
- **Week calculation:** `getWeekNumber` in `shared/schema.ts`
- **OneDrive course mapping:** `storage.getOneDriveCoursesBySemester(semId)`
- **Folder path edits:** see "OneDrive" section above
- **Course list constants:** `COURSES` in `shared/schema.ts`, electives in `shared/electiveCourses.ts`

---

## 3. ⚠️ Dangerous to edit (Protected Systems)

These work today. ChatGPT / agent must NOT touch these without explicit user approval:

| System | Why protected |
|---|---|
| Cat Lights webhook | Multi-stage timing & cooldown logic — small edits cause double-prompts |
| Shower Button webhook | Same — coupled to playback state |
| HA service-call queue | `processHACommandQueue` ordering matters |
| Edge TTS / Cloud TTS generation | Falls back across multiple providers; rebuilding silently breaks audio |
| OneDrive auth flow | Device-code refresh tokens — easy to invalidate |
| `shared/schema.ts` | Schema drift = silent data loss |
| `files.preparedAt` / `files.preparedAudioPaths` / `files.listenedAt` | Drives "what to play next" — overwriting these resets progress |

The same list is exposed at `GET /api/dev/protected-systems`.

---

## 4. Commands you must run after edits

| You changed | Run |
|---|---|
| Anything in `client/` | On Pi: `npm run build && pm2 restart all` |
| Anything in `server/` | On Pi: `pm2 restart all` |
| `shared/schema.ts` | `npm run db:push` (after agreeing in chat) |
| `package.json` | `npm install && npm run build && pm2 restart all` |

The full deploy sequence is always:
```bash
cd ~/Home-View && git pull && npm run build && pm2 restart all
```

`pm2 status` → process is named `dashboard`.

---

## 5. Developer tooling cheat-sheet

| Endpoint | Purpose |
|---|---|
| `GET  /api/dev/system-map` | Routes + DB tables + semesters + env |
| `GET  /api/dev/app-map` | Feature-grouped route map + key file index |
| `GET  /api/dev/status` | Uptime, HA / OneDrive / DB connection, current week |
| `GET  /api/dev/build-info` | Build mode, last build, recommended restart cmd |
| `GET  /api/dev/trace` | Last ~300 trace events (`?subsystem=cat_lights` filter) |
| `GET  /api/dev/automation-trace` | Same, alias |
| `GET  /api/dev/recent-errors` | Last 50 trace events that looked like errors |
| `GET  /api/dev/file-map` | Last file selection + per-folder readiness summary |
| `GET  /api/dev/onedrive-audit` | Pass/fail checklist per course folder |
| `GET  /api/dev/tts-ready` | Per-file TTS readiness (extracted text, chunks, audio paths) |
| `GET  /api/dev/protected-systems` | The do-not-touch list (also above) |
| `GET  /api/dev/handoff?format=text` | Full ChatGPT handoff bundle |
| `GET  /api/dev/file?file=…&lines=A,B` | Read project file (5 MB cap, blocks `.env`, `.git/`, etc.) |
| `POST /api/dev/patch` | Safe single-occurrence find/replace + auto-backup |
| `GET/POST /api/dev/layout-map` | Frontend posts calendar/countdown bounding boxes |

In the dashboard: **Ctrl+Shift+D** opens the Dev Panel. Use **Copy Handoff** to dump the full bundle into your clipboard for ChatGPT.

Run `node scripts/smoke.mjs` (or `node scripts/smoke.mjs https://uni-cal.app`) for a smoke check of the dev endpoints + critical invariants.

---

## 6. Phase-1 refactor status (2026-05-03)

Already extracted from `routes.ts` → `server/serverHelpers.ts`:
- HA URL/token constants, entity IDs
- `haFetch`, `haServiceCall`, `haServiceCallSafe`, `haCommandQueue`, `processHACommandQueue`
- `FLICK_DEVICES` registry
- TTS pure helpers (`CHUNK_SIZE`, `CHARS_PER_SECOND`, `generateAndSaveTTSAudio`, `parsePublicObjectPath`, `getPdfParser`, `generateRepeatDates`, `formatLocalDate`, `automationLog`/`aLog`)
- Auth helper (`getRequestAuthLevel`)

**Still in `routes.ts` (queued for Phase-2 split):**
- AudioPrep batch queue
- PDF text extraction inline calls
- `syncOneDriveFilesForWeek`
- Cat Lights / Cat Wash webhook handlers
- TTS playback session (`currentTTSSession`, `sendNextChunk`, `scheduleNextChunk`)
- Travelling-mode flag (re-exported for `reminderScheduler`)

Target Phase-2 layout (when scheduled):
```
server/services/audioPrep.ts          — AudioPrep queue
server/services/textExtraction.ts     — PDF / DOCX / PPTX → text
server/services/oneDriveCourseSync.ts — syncOneDriveFilesForWeek + helpers
server/services/courseFolderAudit.ts  — onedrive-audit logic
server/services/semesterCourses.ts    — semester / course / week helpers
server/services/homeAssistant.ts      — re-export of HA helpers (already in serverHelpers)
server/routes/index.ts                — registers all route groups
server/routes/{files,onedrive,tts,automation,calendar,weather,media,adminDiagnostics}.ts
```

These splits are **not done yet**. Each carries real risk because of the closure-bound module-scope state in `routes.ts`. Do them one at a time, run `npm run check` and `node scripts/smoke.mjs` after each, and commit each independently.

---

## 7. Rollback

- Per-patch backups: `.local/patch-backups/<filename>.<iso-stamp>.bak`
  Restore: `cp .local/patch-backups/<file>.bak <original-path>`
- Git reflog on the Pi: `git reflog && git reset --hard <prev-commit>`
- Replit checkpoints: in chat, ask the agent to roll back to the last checkpoint.
