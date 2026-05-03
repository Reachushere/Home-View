# UniCal Maintenance Playbook

Practical guide for ChatGPT-assisted code changes. Read this before touching anything.

## 1. Get a debug pack

Open the app at `https://uni-cal.app/?dev=1` (or hit `Ctrl+Shift+D`). The Dev Panel appears in the bottom-right.

| Button | When to use |
|---|---|
| **Copy Debug Pack** | Generic "something is wrong" — broadest snapshot |
| **Page Pack** | "This page/box/button looks wrong" — page-aware |
| **Guided Fix** | You don't know which pack to copy — wizard picks for you |
| **Backend Pack** | API/server-side issue, no UI involvement |
| **TTS Pack** | Audio not playing, TTS prompt wrong |
| **OneDrive Pack** | Files missing, sync issues |
| **Minimal Prompt** | Short ChatGPT message — diagnosis + blocker only |

Paste the result into ChatGPT.

## 2. Use `/api/dev/diagnose` for one-shot answers

```bash
curl -s https://uni-cal.app/api/dev/diagnose | jq
```

Returns `{ summary, primaryBlocker, recommendedNextStep, confidence, snapshot }`. If `primaryBlocker` is `no_blocker_detected`, the system is healthy.

## 3. Backend change workflow

1. Edit server file (typically `server/routes.ts`, `server/dev/*`, `server/storage.ts`, etc.).
2. Replit pushes to GitHub via `/tmp/push.cjs`.
3. On the Pi:
   ```bash
   cd ~/Home-View && git pull && pm2 restart dashboard
   ```
4. Run smoke: `node scripts/smoke.mjs https://uni-cal.app`
5. Open Dev Panel → check diagnosis card is green.

**No `npm run build` required** for backend-only changes (tsx runs TS directly).

## 4. Frontend change workflow

1. Edit `client/src/**/*` file.
2. Push to GitHub.
3. On the Pi:
   ```bash
   cd ~/Home-View && git pull && npm run build && pm2 restart dashboard
   ```
4. Hard-refresh browser (Cmd+Shift+R / Ctrl+Shift+R).
5. Open Dev Panel → Build tab → confirm `outOfDate: false`.

**`npm run build` IS required.** The Dev Panel's `⚠ build stale` chip will warn you if you forget.

## 5. When `npm run build` is required

- Any change under `client/src/`
- Any change to `index.html`, `vite.config.ts`, `tailwind.config.ts`, or `client/index.css`
- Any new dependency added that the frontend imports

## 6. When `pm2 restart dashboard` is required

- **Always**, after any `git pull` (whether frontend or backend changed)
- After editing `.env` or any secret
- If the server is hung or memory-bloated

## 7. Rollback safe patches

```bash
cd ~/Home-View
git log --oneline -10            # find the bad commit
git revert <commit-sha>          # creates a clean revert
git push                         # push the revert
# back on Replit, it'll catch up via the next pull/push cycle
```

For a hard reset (DESTRUCTIVE, last resort):
```bash
git reset --hard <good-sha>
git push --force-with-lease
npm run build && pm2 restart dashboard
```

## 8. Protected systems — DO NOT modify without explicit permission

| System | Files | Why protected |
|---|---|---|
| **Cat Lights handler** | `server/routes.ts` `app.post("/api/webhook/cat-lights")` | Live HA integration — wrong logic plays/stops audio at random times |
| **OneDrive sync** | `server/onedrive.ts`, `syncOneDriveFilesForWeek` | Wrong folder paths break entire file pipeline |
| **TTS / AudioPrep** | `server/tts*.ts`, `findNextFileByPriority`, `describeFileForTTS` | Regenerates hours of audio if changed wrong |
| **devTrace instrumentation** | `server/dev/devTrace.ts`, the 6 `cat_lights:*` `logDecision` call sites | Removing breaks the entire diagnose/flow-snapshot/Debug Pack chain |
| **Semester schema** | `shared/schema.ts` `semesters`, `files` | Migration would require coordinated DB change |
| **drizzle.config.ts** | — | Pre-configured, do not touch |
| **vite.config.ts / server/vite.ts** | — | Pre-configured, do not touch |

## 9. What NOT to touch without explicit permission

- `package.json` (Replit blocks edits — ask user to update)
- `.env` / secrets (always go through environment-secrets skill)
- Any DB migration (`drizzle-kit push`) — confirm with user first
- Any change that triggers HA devices in test mode
- Removing or renaming `data-testid` attributes on existing elements
