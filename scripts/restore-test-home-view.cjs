#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const WebSocket = require('ws');

const yamlPath = process.argv[2];
if (!yamlPath) {
  console.error('Usage: node scripts/restore-test-home-view.cjs <picture-elements-card.yaml>');
  process.exit(1);
}
if (!fs.existsSync(yamlPath)) {
  console.error('File not found:', yamlPath);
  process.exit(1);
}

const HA_URL = process.env.HOME_ASSISTANT_URL;
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN;
if (!HA_URL || !HA_TOKEN) {
  console.error('HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN must be set');
  process.exit(1);
}

const cardYaml = fs.readFileSync(yamlPath, 'utf8');
const cardObj = yaml.parse(cardYaml);
console.log(`Loaded card with ${Array.isArray(cardObj.elements) ? cardObj.elements.length : 0} elements`);

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
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout id ' + id));
      }
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
  if (msg.type === 'auth_invalid') {
    console.error('Auth invalid'); process.exit(1);
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.success === false) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1); });

async function main() {
  console.log('Fetching current lovelace config...');
  const config = await send({ type: 'lovelace/config' });
  console.log(`Config has ${config.views?.length || 0} views`);
  if (!config.views || config.views.length === 0) {
    throw new Error('No views in config — refusing to proceed');
  }
  const oldView = config.views[0];
  console.log(`View 0 currently: title=${oldView?.title}, path=${oldView?.path}, type=${oldView?.type}`);
  const oldCardElems = oldView?.cards?.[0]?.elements?.length || 0;
  console.log(`Old view 0 had ${oldCardElems} elements in cards[0]`);

  const newView = {
    type: oldView?.type || 'panel',
    path: oldView?.path || 'test-home',
    title: oldView?.title || 'Test-home',
    cards: [cardObj],
  };
  config.views[0] = newView;

  console.log('Saving updated config...');
  await send({ type: 'lovelace/config/save', config });
  console.log('SUCCESS — view 0 restored. Refresh HA browser.');
  ws.close();
  process.exit(0);
}
