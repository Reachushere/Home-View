#!/usr/bin/env node
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
  console.log('Reading current lovelace config from HA...');
  const config = await send({ type: 'lovelace/config' });
  const view = config.views?.[0];
  if (!view) throw new Error('No view 0 found');
  console.log(`View 0: title=${view.title}, ${view.cards?.length || 0} cards`);

  const card = view.cards?.[0];
  if (!card || card.type !== 'picture-elements') {
    throw new Error(`Expected picture-elements card, got type=${card?.type}`);
  }
  console.log(`Card has ${card.elements?.length || 0} elements`);

  // Kill card-level default ripple
  let cardChanged = false;
  if (!card.tap_action || card.tap_action.action !== 'none') {
    card.tap_action = { action: 'none' };
    cardChanged = true;
  }
  if (!card.hold_action || card.hold_action.action !== 'none') {
    card.hold_action = { action: 'none' };
    cardChanged = true;
  }

  // Add tap_action: none to elements missing one (but leave existing ones untouched)
  let elementsChanged = 0;
  for (const el of card.elements || []) {
    if (!el.tap_action) {
      el.tap_action = { action: 'none' };
      elementsChanged++;
    }
  }

  console.log(`Card-level changed: ${cardChanged}, elements patched: ${elementsChanged}`);
  if (!cardChanged && elementsChanged === 0) {
    console.log('Nothing to change — oval may be from something else.');
    process.exit(0);
  }

  console.log('Writing config back...');
  await send({ type: 'lovelace/config/save', config });
  console.log('SUCCESS. Refresh HA browser.');
  process.exit(0);
}
