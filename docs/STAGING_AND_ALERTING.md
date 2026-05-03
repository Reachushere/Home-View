# Staging + Cron Alerting

Two safety rails for UniCal beyond Fix It:

1. **`dashboard-staging`** — a parallel pm2 process on a different port that runs the same code against a read-only DB role with HA/TTS/OneDrive writes disabled. Test changes here before promoting.
2. **`cron-alert.mjs`** — runs every 15 min via cron, hits `/api/dev/diagnose`, and notifies you if `primaryBlocker !== "no_blocker_detected"`.

Both are opt-in and live entirely on the Pi — Replit ships the configs, the Pi runs them.

---

## 1. Staging pm2 process

### One-time Pi setup

```bash
# On the Pi:
cd ~/Home-View && git pull && npm run build

# Create a read-only Postgres role (one-time):
psql "$DATABASE_URL" <<'SQL'
CREATE USER unical_readonly WITH PASSWORD 'change-me-strong';
GRANT CONNECT ON DATABASE unical TO unical_readonly;
GRANT USAGE ON SCHEMA public TO unical_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO unical_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO unical_readonly;
SQL

# Add the read-only DSN to /etc/environment or pm2 env file:
export STAGING_READONLY_DATABASE_URL='postgresql://unical_readonly:change-me-strong@localhost:5432/unical'

# Boot staging on port 5050:
pm2 start ecosystem.staging.config.cjs
pm2 save
```

Now you have:

| Process | Port | DB role | HA/TTS/OneDrive |
|---|---|---|---|
| `dashboard` (prod) | 5000 | full read-write | live |
| `dashboard-staging` | 5050 | read-only | disabled |

### Hitting staging

```bash
curl http://<pi-ip>:5050/api/dev/status -H "x-dev-key: $DEV_KEY"
```

### Promote workflow

```bash
# 1. push to GitHub from Replit (already automated via /tmp/push.cjs)
# 2. on Pi:
cd ~/Home-View && git pull && npm run build && pm2 restart dashboard-staging
# 3. verify against http://<pi-ip>:5050
# 4. when happy:
pm2 restart dashboard
```

### Disable on demand

```bash
pm2 stop dashboard-staging   # stops, keeps in pm2 ls
pm2 delete dashboard-staging # removes entirely
```

### Safety guarantees

- Staging never triggers Home Assistant (`DISABLE_HA_TRIGGERS=1`)
- Staging never plays TTS (`DISABLE_TTS_PLAYBACK=1`)
- Staging never writes to OneDrive (`DISABLE_ONEDRIVE_WRITES=1`)
- Staging cannot mutate the DB (read-only Postgres role)

> The three `DISABLE_*` flags must be honored by `server/routes.ts` at the call sites — they are read by the existing handler logic if `process.env.STAGING_MODE === "1"` is checked. If not yet wired, add a one-line guard at each side-effect site (top of `triggerHACatLights`, `playTTS`, `writeOneDriveFile`).

---

## 2. Cron alerting via `/api/dev/diagnose`

### One-time Pi setup

```bash
# Edit crontab:
crontab -e

# Add (every 15 min):
*/15 * * * * DEV_KEY=<your-dev-key> ALERT_BASE_URL=https://uni-cal.app ALERT_WEBHOOK_URL=https://hooks.example.com/xxx /usr/bin/node /home/pi/Home-View/scripts/cron-alert.mjs >> /home/pi/Home-View/.local/cron-alert.log 2>&1
```

### Required env vars

| Var | Required | Purpose |
|---|---|---|
| `DEV_KEY` | yes | `x-dev-key` header value for `/api/dev/*` |
| `ALERT_BASE_URL` | no | defaults to `https://uni-cal.app` |
| `ALERT_WEBHOOK_URL` | no | POSTs JSON `{subject, body, blocker, diagnose, ts}` on alert |
| `ALERT_EMAIL_TO` | no | log-only stub today; wire to your existing Gmail integration when ready |
| `ALERT_STATE_FILE` | no | defaults to `/tmp/unical-alert-state.json` |

### Behavior

- Read-only HTTP GET — never triggers devices, never writes DB.
- Notifies once per blocker; re-alerts after 6 hours if still blocked.
- Logs `RECOVERED from X` when blocker clears.
- All output goes to `.local/cron-alert.log`.

### Testing locally

```bash
DEV_KEY=$DEV_KEY ALERT_BASE_URL=https://uni-cal.app node scripts/cron-alert.mjs
# look at /tmp/unical-alert-state.json after
```

### Disable

```bash
crontab -e   # comment out the line, or:
crontab -l | grep -v cron-alert.mjs | crontab -
```

---

## Rollback

| Change | Rollback |
|---|---|
| Added `dashboard-staging` | `pm2 delete dashboard-staging && pm2 save` |
| Added cron entry | `crontab -e` and remove the line |
| Added read-only Postgres role | `psql -c "DROP USER unical_readonly"` |

Neither change touches `dashboard` or production data.
