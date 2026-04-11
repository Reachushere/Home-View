const fs = require('fs');
const path = require('path');
const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e';
const SCOPES = 'Files.ReadWrite.All User.Read Notes.ReadWrite.All Mail.ReadWrite Mail.Send Calendars.ReadWrite offline_access';

async function main() {
  console.log('Starting OneDrive device code auth...\n');
  const dcRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES }).toString(),
  });
  const dc = await dcRes.json();
  if (!dc.user_code) { console.error('Failed to get device code:', dc); process.exit(1); }

  console.log('========================================');
  console.log(`Go to: ${dc.verification_uri}`);
  console.log(`Enter code: ${dc.user_code}`);
  console.log('========================================\n');
  console.log('Waiting for you to confirm...');

  const deadline = Date.now() + (dc.expires_in || 900) * 1000;
  let interval = (dc.interval || 5) * 1000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: dc.device_code,
        }).toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        const tokenFile = path.join(process.cwd(), '.onedrive_tokens.json');
        const tokens = {
          refresh_token: data.refresh_token,
          access_token: data.access_token,
          expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        };
        fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
        console.log(`\nSuccess! Token saved to ${tokenFile}`);
        console.log('Now restart the app: pm2 restart dashboard');
        process.exit(0);
      }
      if (data.error === 'authorization_pending') { process.stdout.write('.'); continue; }
      if (data.error === 'slow_down') { interval += 5000; continue; }
      if (data.error === 'expired_token' || data.error === 'authorization_declined') {
        console.error('\nAuth failed:', data.error);
        process.exit(1);
      }
    } catch (err) { console.error('\nPoll error:', err.message); }
  }
  console.error('\nTimed out');
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
