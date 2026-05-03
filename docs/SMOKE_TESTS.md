# UniCal Smoke Tests

Fast, **read-only** invariant checks against a running UniCal instance. No real device triggers, no DB writes, no TTS playback.

## Run

```bash
# against local dev (default — usually no auth needed in dev mode)
node scripts/smoke.mjs

# against the Pi over Cloudflare Tunnel — REQUIRES auth (see below)
UNICAL_SESSION_TOKEN=… node scripts/smoke.mjs https://uni-cal.app
```

Exit code is non-zero only if a real check **FAILs**. **WARN** and **SKIP** never fail the run.

> No `npm run smoke` entry — `package.json` is locked. Add manually if desired:
> `"smoke": "node scripts/smoke.mjs"`

## Authentication

All `/api/dev/*` endpoints accept **either** the dashboard session cookie (`uni_cal_session`) **or** a matching `DEV_API_KEY` (sent as the `x-dev-key` header or `?devKey=` query param). The outer auth middleware now whitelists `/api/dev/*` requests that present a valid `DEV_API_KEY`, so terminal smoke runs no longer require copying a browser cookie.

If `DEV_API_KEY` is **unset** on the server (e.g. in production by accident), `/api/dev/*` falls back to session-only auth and unauthenticated requests get **HTTP 401 `{"message":"Not authenticated"}`**.

Smoke supports three ways to authenticate. **Pick one.** Tokens are never echoed to stdout.

| Env var | What it does |
|---|---|
| `DEV_API_KEY` | Recommended for terminal use. Sent as `x-dev-key`. Bypasses both the outer auth middleware and the dev gate. Server must have `DEV_API_KEY` env var set to the same value. |
| `UNICAL_SESSION_TOKEN` | Token value only. Smoke wraps it as `Cookie: uni_cal_session=<token>`. Use when no `DEV_API_KEY` is configured. |
| `UNICAL_COOKIE` | Raw cookie string (use if you have multiple cookies, e.g. `uni_cal_session=…; foo=bar`). |

### Quick verify (Pi)

```bash
curl -H "x-dev-key: $DEV_API_KEY" http://localhost:5000/api/dev/status
# → JSON. Should NOT be {"message":"Not authenticated"}.
```

### How to grab a session token

1. Open the dashboard in a browser and log in.
2. Open DevTools → **Application** (or Storage) → **Cookies** → `https://uni-cal.app`.
3. Copy the **value** of the `uni_cal_session` cookie.
4. Paste into the env var:
   ```bash
   UNICAL_SESSION_TOKEN='paste-value-here' node scripts/smoke.mjs https://uni-cal.app
   ```

Tokens are long-lived (10 years) so you can save the command in your shell history; the value is never printed by smoke.

### What happens with no auth

Smoke prints a single notice:

> **Dev endpoints require authentication.** Provide `UNICAL_SESSION_TOKEN`, `UNICAL_COOKIE`, or `DEV_API_KEY` to run authenticated checks. Public checks will still execute.

…then runs the **public** subset only (server reachability, allowlisted endpoints) and marks every `/api/dev/*` check as `• SKIP`. The run still exits 0 if no real failure occurred.

## Check categories

### Public (always run)
| Check | What it verifies |
|---|---|
| `[public] server reachable` | `GET /login` returns HTML — confirms Express + Cloudflare Tunnel are up |
| `[public] /api/onedrive/status responds` | One of the auth-allowlisted endpoints — confirms server isn't returning 502/503 |

### Authenticated (skip if no auth)
| Check | What it verifies | Failure means |
|---|---|---|
| `dev/system-map` | Routes table + DB tables list | Server didn't initialise dev routes or DB unreachable |
| `dev/status` (DB / semester / week) | DB connection, active semester, current week in `[1,20]` | DB or semester misconfig |
| `dev/build-info` | Returns `recommendedRestart` containing `pm2` | Build introspection broken |
| `dev/trace` | Returns `steps[]` array | devTrace not collecting |
| `dev/file-map` | Returns `summary` | OneDrive sync or storage layer broken |
| `dev/onedrive-audit` | Returns `passed[]` + `failed[]` | OneDrive credentials expired or graph API failure |
| `dev/tts-ready` | No stuck files (extractedText + chunks but no preparedAt) | AudioPrep pipeline degraded |
| `dev/protected-systems` | Lists `Cat Lights` | Guardrail registry missing |
| `dev/handoff` | Returns bundle with `version`, `routes`, `database` | Handoff endpoint broken |
| `dev/patch` (negative) | Rejects unknown find string (404) and path escapes (400) | Patch endpoint security regression |

If auth was provided but a check still returns 401, smoke marks it **FAIL** with: `HTTP 401 — auth provided but rejected (token expired or invalid)` — re-grab the cookie.

## What ChatGPT should ask for when smoke fails

1. **Always:** the full smoke output (copy terminal text). It auto-redacts because tokens are never printed.
2. **If auth-required checks are SKIPPED:** ask user to re-run with `UNICAL_SESSION_TOKEN` set.
3. **If `dev/diagnose` or `dev/flow-snapshot` failed:** the Debug Pack from the Dev Panel.
4. **If `dev/replay` failed:** ask user to run `curl -s $URL/api/dev/replay -d '{"dateOverride":"2026-05-01","simulate":true}' -H 'content-type: application/json' -H "Cookie: uni_cal_session=$UNICAL_SESSION_TOKEN"` and paste output.
5. **If `dev/tts-ready` failed:** TTS Pack from Dev Panel.
6. **If `dev/onedrive-audit` failed:** OneDrive Pack from Dev Panel.
7. **If `build-info.outOfDate=true`:** instruct user to run `cd ~/Home-View && git pull && npm run build && pm2 restart all` on the Pi.

## Hard rules

- Smoke tests **never** call `/api/webhook/cat-lights` or any HA service.
- Smoke tests **never** POST to `/api/dev/test/cat-lights-{on,off}` (those are confirm-gated anyway).
- Smoke tests **never** modify DB rows, file storage, or env vars.
- Smoke tests **never** print or log the value of `UNICAL_SESSION_TOKEN`, `UNICAL_COOKIE`, or `DEV_API_KEY`.
- Auth gating on `/api/dev/*` is **not weakened** — only the `DEV_API_KEY` shortcut and the same browser session cookie are accepted. Non-`/api/dev/*` routes are unaffected by `DEV_API_KEY`.
- If `DEV_API_KEY` is **unset** on the server, `/api/dev/*` requires the session cookie. Production must either set `DEV_API_KEY` (so terminal smoke works) or accept that smoke needs the cookie.
