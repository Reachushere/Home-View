# UniCal Smoke Tests

Fast, **read-only** invariant checks against a running UniCal instance. No real device triggers, no DB writes, no TTS playback.

## Run

```bash
# against local dev (default)
node scripts/smoke.mjs

# against the Pi over Cloudflare Tunnel
node scripts/smoke.mjs https://uni-cal.app

# with auth gate (if DEV_API_KEY env var is set on the server)
DEV_API_KEY=xxx node scripts/smoke.mjs https://uni-cal.app
```

Exit code is non-zero if any check FAILs. WARNs do not fail the run.

> Note: there is no `npm run smoke` entry yet — `package.json` is locked. Add manually if desired:
> `"smoke": "node scripts/smoke.mjs"`

## What each check means

| Check | What it verifies | Failure means |
|---|---|---|
| `dev/system-map` | Routes table + DB tables list | Server didn't initialise dev routes or DB is unreachable |
| `dev/diagnose` | Returns `summary`, `primaryBlocker`, `recommendedNextStep` | Diagnose endpoint broken — debug pack will be incomplete |
| `dev/build-info` | Returns `outOfDate`, `bundleHash`, `lastBuildAt` | Build introspection broken or `dist/` missing |
| `dev/file-map` | Returns `candidates` array with accept/reject reasons | OneDrive sync or storage layer broken |
| `dev/flow-snapshot` | Returns `finalAction` + `blocker` (or `empty:true` hint) | devTrace not collecting Cat Lights events |
| `dev/replay` (dry-run) | `{dateOverride:"2026-05-01",simulate:true}` returns predicted action | Cat Lights branch logic regression — DO NOT deploy |
| `dev/validate` | Validates last snapshot against expected action | Last real Cat Lights run produced wrong outcome |
| `dev/tts-ready` | Returns prepared-audio readiness | AudioPrep pipeline degraded |
| `dev/onedrive-audit` | Returns sync state per course folder | OneDrive credentials expired or graph API failure |
| `dev/protected-systems` | Returns guardrail list | Guardrail registry missing |

## What ChatGPT should ask for when smoke fails

1. **Always:** the full smoke output (copy terminal text).
2. **If `diagnose` or `flow-snapshot` failed:** the Debug Pack from the Dev Panel.
3. **If `replay` failed:** ask user to run `curl -s $URL/api/dev/replay -d '{"dateOverride":"2026-05-01","simulate":true}' -H 'content-type: application/json'` and paste output.
4. **If `tts-ready` failed:** TTS Pack from Dev Panel.
5. **If `onedrive-audit` failed:** OneDrive Pack from Dev Panel.
6. **If `build-info.outOfDate=true`:** instruct user to run `cd ~/Home-View && git pull && npm run build && pm2 restart all` on the Pi.

## Hard rules

- Smoke tests **never** call `/api/webhook/cat-lights` or any HA service.
- Smoke tests **never** POST to `/api/dev/test/cat-lights-{on,off}` (those are confirm-gated anyway).
- Smoke tests **never** modify DB rows, file storage, or env vars.
