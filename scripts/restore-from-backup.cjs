#!/usr/bin/env node
const fs = require('fs');
const WebSocket = require('ws');

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scripts/restore-from-backup.cjs <lovelace.lovelace.json>');
  process.exit(1);
}
if (!fs.existsSync(jsonPath)) {
  console.error('File not found:', jsonPath);
  process.exit(1);
}

const HA_URL = process.env.HOME_ASSISTANT_URL;
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN;
if (!HA_URL || !HA_TOKEN) {
  console.error('HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN must be set');
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, 'utf8');
const parsed = JSON.parse(raw);
const newConfig = parsed.data?.config;
if (!newConfig || !Array.isArray(newConfig.views)) {
  console.error('Could not find data.config.views in backup file');
  process.exit(1);
}
console.log(`Backup config has ${newConfig.views.length} views, view 0: title=${newConfig.views[0]?.title}, ${newConfig.views[0]?.cards?.[0]?.elements?.length || 0} elements`);

const wsUrl = HA_URL.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/websocket';
const ws = new WebSocket(wsUrl);
let msgId = 1;
const pending = new Map();

function send(msg) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    msg.id = id;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(msg));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); }
    }, 30000);
  });
}

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'auth_required') {
    ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }));
    return;
  }
  if (msg.type === 'auth_ok') {
    main().catch((err) => { console.error('FAILED:', err); process.exit(1); });
    return;
  }
  if (msg.type === 'auth_invalid') { console.error('Auth invalid'); process.exit(1); }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.success === false) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1); });

async function main() {
  console.log('Reading current config (for backup)...');
  const current = await send({ type: 'lovelace/config' });
  const backupPath = `/tmp/lovelace-current-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(current, null, 2));
  console.log(`Saved current config backup to ${backupPath}`);

  console.log('Writing backup config to HA...');
  await send({ type: 'lovelace/config/save', config: newConfig });
  console.log('SUCCESS — main dashboard restored from March 26 backup. Refresh HA browser.');
  process.exit(0);
}
