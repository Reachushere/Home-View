// Staging pm2 process — runs alongside `dashboard` on a separate port.
// Apply on the Pi after `git pull && npm run build`:
//   pm2 start ecosystem.staging.config.cjs
//   pm2 save
// Promote to prod by pointing Cloudflare Tunnel at PORT 5000 (already default for `dashboard`).
module.exports = {
  apps: [
    {
      name: "dashboard-staging",
      script: "npm",
      args: "run start",
      cwd: process.env.HOME ? `${process.env.HOME}/Home-View` : ".",
      env: {
        NODE_ENV: "production",
        PORT: "5050",
        // Read-only DB role: create a Postgres user with SELECT-only grants
        // and put its DSN here. Falls back to main DATABASE_URL with a warning
        // banner via /api/dev/status if STAGING_READONLY_DATABASE_URL is unset.
        DATABASE_URL: process.env.STAGING_READONLY_DATABASE_URL || process.env.DATABASE_URL,
        STAGING_MODE: "1",
        // Disable side-effecting integrations on staging by default.
        DISABLE_HA_TRIGGERS: "1",
        DISABLE_TTS_PLAYBACK: "1",
        DISABLE_ONEDRIVE_WRITES: "1",
      },
      max_memory_restart: "400M",
      autorestart: true,
      watch: false,
    },
  ],
};
