# UniCal Module Split Plan

`server/routes.ts` is currently **31,985 lines**. This plan splits it in 5 phases without behaviour changes. **No phase has been executed yet.**

## Hard prerequisites before any phase

1. `node scripts/smoke.mjs` passes 100% (no FAILs, WARNs OK).
2. `npm run check` passes.
3. Last successful Cat Lights run is captured in `/api/dev/flow-snapshot` (so we can replay-validate after the split).
4. Working tree is clean and pushed.

## Phase 1 — extract pure helpers only

**Files affected:** `server/routes.ts` → new `server/_helpers/time.ts`, `server/_helpers/file-priority.ts`, `server/_helpers/tts-format.ts`

**What moves:** `getWeekNumber`, `findNextFileByPriority`, `describeFileForTTS`, `taskDateStr`, any pure date/format helpers with **no I/O and no closures over module-scope state**.

**Risk:** ★☆☆☆☆ low — pure functions, easy to unit-test.

**Validation:**
```bash
npm run check
node scripts/smoke.mjs
curl -s localhost:5000/api/dev/replay -d '{"dateOverride":"2026-05-01","simulate":true}' -H 'content-type: application/json'
```

**Rollback:** `git revert <sha>` — no data side-effects possible.

---

## Phase 2 — extract AudioPrep / text-extraction services

**Files affected:** `server/routes.ts` → new `server/services/audio-prep.ts`, `server/services/text-extraction.ts`

**What moves:** PDF→text, text→speech queue, any function that calls OpenAI TTS or extracts file text. Keeps the existing `/api/audio-prep/*` routes thin wrappers.

**Risk:** ★★★☆☆ medium — async I/O, depends on OpenAI keys + storage.

**Validation:**
```bash
node scripts/smoke.mjs   # tts-ready check must pass
# Manual: trigger one file prep via /api/audio-prep/prepare/:id and verify it generates audio
```

**Rollback:** `git revert <sha>` then `pm2 restart dashboard`. Audio files already generated remain valid (idempotent storage paths).

---

## Phase 3 — extract OneDrive course audit/sync services

**Files affected:** `server/routes.ts` → migrate logic into `server/onedrive.ts` (already exists, needs surface expansion)

**What moves:** `syncOneDriveFilesForWeek`, course-folder audit logic, the `/api/onedrive/*` admin endpoints.

**Risk:** ★★★★☆ high — this is on the hot path for Cat Lights file selection. A wrong move silently breaks the morning prompt.

**Validation:**
```bash
node scripts/smoke.mjs   # onedrive-audit + file-map checks must both PASS
curl -s localhost:5000/api/dev/replay -d '{"forceWeek":1,"simulate":true}' -H 'content-type: application/json'
# Verify finalAction matches the value before the split
```

**Rollback:** `git revert <sha>` then `pm2 restart dashboard`. Sync is idempotent — no DB cleanup needed.

---

## Phase 4 — extract Cat Lights route only after smoke tests pass

**Files affected:** `server/routes.ts` → new `server/routes/cat-lights.ts`

**What moves:** the entire `/api/webhook/cat-lights` handler (lines ~21336–~21850 in current file) plus the helper closures it uses (`catLightsPromptPending`, `playChumFmRadio`).

**Risk:** ★★★★★ critical — PROTECTED system. A typo breaks Bryn's morning routine.

**Pre-flight:** Phases 1–3 must be deployed and stable for at least 7 days with green smoke + green diagnose.

**Validation:**
```bash
node scripts/smoke.mjs                              # full pass
# Replay every known scenario:
for w in 0 1 7 13 14; do
  curl -s localhost:5000/api/dev/replay -d "{\"forceWeek\":$w,\"simulate\":true}" -H 'content-type: application/json'
done
# Then validate against last 5 real snapshots:
curl -s localhost:5000/api/dev/validate
```

**Rollback:** `git revert <sha>` IMMEDIATELY then `pm2 restart dashboard`. Verify next live HA webhook produces correct `flow-snapshot`.

---

## Phase 5 — extract calendar/weather/media/admin routes

**Files affected:** new `server/routes/calendar.ts`, `server/routes/weather.ts`, `server/routes/media.ts`, `server/routes/admin.ts`

**What moves:** Google Calendar endpoints, weather proxy, media playback control, dashboard admin endpoints. Each in its own file, registered from `server/index.ts`.

**Risk:** ★★☆☆☆ low–medium — these are mostly thin wrappers around external APIs.

**Validation:**
```bash
npm run check
node scripts/smoke.mjs
# Spot-check each subsystem from the dashboard UI
```

**Rollback:** per-file `git revert` is possible since each route group is independent post-split.

---

## After all phases

`server/routes.ts` should be **<2,000 lines** and contain only the `registerRoutes(app)` orchestrator + the few endpoints not worth extracting.
