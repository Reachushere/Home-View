#!/usr/bin/env node
const fs = require('fs');
const WebSocket = require('ws');

const HA_URL = process.env.HOME_ASSISTANT_URL;
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN;
if (!HA_URL || !HA_TOKEN) {
  console.error('HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN must be set');
  process.exit(1);
}

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
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); } }, 30000);
  });
}

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'auth_required') { ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN })); return; }
  if (msg.type === 'auth_ok') { main().catch((err) => { console.error('FAILED:', err); process.exit(1); }); return; }
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
  console.log('Reading current lovelace config...');
  const config = await send({ type: 'lovelace/config' });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapPath = `/tmp/lovelace-snapshot-${stamp}.json`;
  fs.writeFileSync(snapPath, JSON.stringify(config, null, 2));
  console.log(`Snapshot saved to ${snapPath}`);

  const card = config.views?.[0]?.cards?.[0];
  if (!card || card.type !== 'picture-elements') throw new Error('Expected picture-elements card');
  const before = card.elements.length;

  // Remove any prior rascal buttons we may have added (keeps re-runs idempotent)
  card.elements = card.elements.filter(e => !(e.entity === 'timer.rascal_meds_timer' && (e.type === 'state-icon' || e.icon === 'mdi:cat')));

  const newElement = {
    type: 'state-icon',
    entity: 'timer.rascal_meds_timer',
    icon: 'mdi:cat',
    title: 'Reset Rascal meds',
    tap_action: {
      action: 'call-service',
      service: 'timer.start',
      target: { entity_id: 'timer.rascal_meds_timer' },
    },
    style: {
      left: '95.32%',
      top: '37.56%',
      transform: 'translate(-50%, -50%) scale(1.4)',
      color: 'white',
      '--paper-item-icon-color': 'white',
    },
  };
  card.elements.push(newElement);
  console.log(`Element count: ${before} -> ${card.elements.length}`);

  console.log('Saving...');
  await send({ type: 'lovelace/config/save', config });
  console.log('SUCCESS — cat button added at upper right slot. Refresh HA.');
  process.exit(0);
}
