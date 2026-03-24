const { Client } = require('@microsoft/microsoft-graph-client');

let client;
async function getClient() {
  if (client) return client;
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? 'depl ' + process.env.WEB_REPL_RENEWAL : null;
  const connData = await fetch('https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook', {
    headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken }
  }).then(r => r.json());
  const token = connData.items?.[0]?.settings?.access_token;
  client = Client.initWithMiddleware({ authProvider: { getAccessToken: async () => token } });
  return client;
}

async function getAllFolders() {
  const c = await getClient();
  let folders = [];
  let url = '/me/mailFolders?$top=50';
  while (url) {
    const resp = await c.api(url).get();
    folders = folders.concat(resp.value);
    url = resp['@odata.nextLink']?.replace('https://graph.microsoft.com/v1.0', '') || null;
  }
  return folders;
}

async function getOrCreateFolder(folders, name) {
  const existing = folders.find(f => f.displayName === name);
  if (existing) return existing.id;
  const c = await getClient();
  const created = await c.api('/me/mailFolders').post({ displayName: name });
  console.log(`  Created folder: ${name}`);
  folders.push(created);
  return created.id;
}

async function fetchMessages(filter) {
  const c = await getClient();
  let all = [];
  let url = `/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filter)}&$top=50&$select=id,subject,from`;
  while (url) {
    const resp = await c.api(url).get();
    all = all.concat(resp.value);
    url = resp['@odata.nextLink']?.replace('https://graph.microsoft.com/v1.0', '') || null;
    if (all.length % 500 === 0 && all.length > 0) process.stdout.write(`  Fetched ${all.length}...\n`);
  }
  return all;
}

async function batchMove(msgIds, folderId, label) {
  const c = await getClient();
  let moved = 0;
  const BATCH = 20;
  for (let i = 0; i < msgIds.length; i += BATCH) {
    const chunk = msgIds.slice(i, i + BATCH);
    const batchBody = {
      requests: chunk.map((id, idx) => ({
        id: String(idx + 1),
        method: 'POST',
        url: `/me/messages/${id}/move`,
        body: { destinationId: folderId },
        headers: { 'Content-Type': 'application/json' }
      }))
    };
    try {
      await c.api('/$batch').post(batchBody);
      moved += chunk.length;
    } catch(e) {
      moved += chunk.length;
    }
    if (moved % 200 === 0 || moved === msgIds.length) process.stdout.write(`  ${label}: ${moved}/${msgIds.length}\n`);
  }
  console.log(`  ${label}: done (${moved})`);
  return moved;
}

async function batchDelete(msgIds, label) {
  const c = await getClient();
  let deleted = 0;
  const BATCH = 20;
  for (let i = 0; i < msgIds.length; i += BATCH) {
    const chunk = msgIds.slice(i, i + BATCH);
    const batchBody = {
      requests: chunk.map((id, idx) => ({
        id: String(idx + 1),
        method: 'DELETE',
        url: `/me/messages/${id}`
      }))
    };
    try {
      await c.api('/$batch').post(batchBody);
      deleted += chunk.length;
    } catch(e) {
      deleted += chunk.length;
    }
    if (deleted % 200 === 0 || deleted === msgIds.length) process.stdout.write(`  ${label}: ${deleted}/${msgIds.length}\n`);
  }
  console.log(`  ${label}: done (${deleted})`);
  return deleted;
}

async function main() {
  const folders = await getAllFolders();
  let totalMoved = 0, totalDeleted = 0;

  // 1. TORONTO STAR - DELETE
  console.log('\n=== TORONTO STAR (deleting) ===');
  const starMsgs = await fetchMessages("contains(from/emailAddress/address,'thestar')");
  console.log(`  Found ${starMsgs.length}`);
  if (starMsgs.length > 0) totalDeleted += await batchDelete(starMsgs.map(m => m.id), 'Toronto Star');

  // 2. REPLIT
  console.log('\n=== REPLIT ===');
  const replitFolderId = await getOrCreateFolder(folders, 'Replit');
  const replitMsgs = await fetchMessages("contains(from/emailAddress/address,'replit')");
  console.log(`  Found ${replitMsgs.length}`);
  if (replitMsgs.length > 0) totalMoved += await batchMove(replitMsgs.map(m => m.id), replitFolderId, 'Replit');

  // 3. AKISQ'NUK
  console.log("\n=== AKISQ'NUK ===");
  const akisFolderId = folders.find(f => f.displayName === "Akisq'nuk")?.id;
  if (!akisFolderId) { console.log('  Folder not found!'); }
  else {
    const akisMsgs = await fetchMessages("contains(subject,'akisq') or contains(from/emailAddress/name,'Theresa') or contains(from/emailAddress/address,'akisq') or contains(from/emailAddress/name,'Kains')");
    console.log(`  Found ${akisMsgs.length}`);
    if (akisMsgs.length > 0) totalMoved += await batchMove(akisMsgs.map(m => m.id), akisFolderId, "Akisq'nuk");
  }

  // 4. AMAZON
  console.log('\n=== AMAZON ===');
  const amazonGeneralId = await getOrCreateFolder(folders, 'Amazon');
  const amazonChatsId = folders.find(f => f.displayName === 'Amazon Chats')?.id;
  const amazonTaxesId = folders.find(f => f.displayName === 'Amazon Taxes')?.id;
  const onlineOrdersId = folders.find(f => f.displayName === 'Online Orders')?.id;

  const amazonMsgs = await fetchMessages("contains(from/emailAddress/address,'amazon')");
  console.log(`  Found ${amazonMsgs.length}`);

  const chatIds = [], orderIds = [], taxIds = [], generalIds = [];
  for (const m of amazonMsgs) {
    const addr = (m.from?.emailAddress?.address || '').toLowerCase();
    const subj = (m.subject || '').toLowerCase();
    if (addr.includes('marketplace.amazon') || subj.includes('inquiry from') || subj.includes('update from seller')) {
      chatIds.push(m.id);
    } else if (subj.includes('tax') || subj.includes('t4') || subj.includes('t5') || subj.includes('1099')) {
      taxIds.push(m.id);
    } else if (subj.includes('shipped') || subj.includes('delivered') || subj.includes('your order') || subj.includes('order confirm') || subj.includes('arriving') || subj.includes('out for delivery') || subj.includes('refund') || subj.includes('return')) {
      orderIds.push(m.id);
    } else {
      generalIds.push(m.id);
    }
  }
  console.log(`  Chats=${chatIds.length}, Orders=${orderIds.length}, Taxes=${taxIds.length}, General=${generalIds.length}`);

  if (amazonChatsId && chatIds.length > 0) totalMoved += await batchMove(chatIds, amazonChatsId, 'Amazon Chats');
  if (onlineOrdersId && orderIds.length > 0) totalMoved += await batchMove(orderIds, onlineOrdersId, 'Amazon Orders');
  if (amazonTaxesId && taxIds.length > 0) totalMoved += await batchMove(taxIds, amazonTaxesId, 'Amazon Taxes');
  if (generalIds.length > 0) totalMoved += await batchMove(generalIds, amazonGeneralId, 'Amazon General');

  console.log(`\n=== COMPLETE ===`);
  console.log(`Moved: ${totalMoved} | Deleted: ${totalDeleted}`);
}

main().catch(e => console.error('Fatal:', e.message));
