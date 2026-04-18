import PDFDocument from 'pdfkit';
import { sendGmailWithAttachment } from '../server/gmail';

function buildPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const NAVY = '#1e40af';
    const DARK = '#1a1a1a';
    const GRAY = '#6b7280';
    const AMBER_BG = '#fef3c7';
    const AMBER_BORDER = '#f59e0b';
    const CODE_BG = '#1a1a1a';
    const CODE_FG = '#e5e7eb';

    const h1 = (t: string) => {
      doc.moveDown(0.3);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20).text(t);
      doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor(NAVY).lineWidth(2).stroke();
      doc.moveDown(0.6);
    };
    const h2 = (t: string) => {
      doc.moveDown(0.6);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14).text(t);
      doc.moveDown(0.3);
    };
    const h3 = (t: string) => {
      doc.moveDown(0.3);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11.5).text(t);
      doc.moveDown(0.15);
    };
    const p = (t: string) => {
      doc.fillColor(DARK).font('Helvetica').fontSize(10.5).text(t, { align: 'left', lineGap: 2 });
      doc.moveDown(0.3);
    };
    const bullet = (items: string[]) => {
      doc.fillColor(DARK).font('Helvetica').fontSize(10.5);
      items.forEach(it => {
        doc.text('• ' + it, { indent: 12, lineGap: 2 });
      });
      doc.moveDown(0.3);
    };
    const numbered = (items: string[]) => {
      doc.fillColor(DARK).font('Helvetica').fontSize(10.5);
      items.forEach((it, i) => {
        doc.text(`${i + 1}. ${it}`, { indent: 12, lineGap: 2 });
      });
      doc.moveDown(0.3);
    };
    const code = (lines: string[]) => {
      const lineHeight = 13;
      const padding = 8;
      const totalH = lines.length * lineHeight + padding * 2;
      const x = doc.x;
      const y = doc.y;
      const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      if (y + totalH > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const yy = doc.y;
      doc.save().rect(x, yy, w, totalH).fill(CODE_BG).restore();
      doc.fillColor(CODE_FG).font('Courier').fontSize(9.5);
      lines.forEach((ln, i) => doc.text(ln, x + padding, yy + padding + i * lineHeight, { lineBreak: false, width: w - padding * 2 }));
      doc.y = yy + totalH + 6;
      doc.x = doc.page.margins.left;
      doc.moveDown(0.1);
    };
    const callout = (lines: string[]) => {
      const lineHeight = 13;
      const padding = 10;
      doc.font('Helvetica').fontSize(10.5);
      const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const innerW = w - padding * 2 - 6;
      let totalH = padding * 2;
      lines.forEach(ln => { totalH += doc.heightOfString(ln, { width: innerW, lineGap: 2 }) + 4; });
      const x = doc.x;
      const y = doc.y;
      if (y + totalH > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const yy = doc.y;
      doc.save().rect(x, yy, w, totalH).fill(AMBER_BG).restore();
      doc.save().rect(x, yy, 4, totalH).fill(AMBER_BORDER).restore();
      doc.fillColor(DARK).font('Helvetica').fontSize(10.5);
      let cy = yy + padding;
      lines.forEach(ln => {
        doc.text(ln, x + padding + 6, cy, { width: innerW, lineGap: 2 });
        cy = doc.y + 4;
      });
      doc.y = yy + totalH + 8;
      doc.x = doc.page.margins.left;
    };

    h1('UniCal Pi Handoff — What To Do');

    callout([
      'Why this PDF exists: Replit is being shut down. Your Pi at https://uni-cal.app is now the only place UniCal runs. Your Pi is missing 3 important secrets in its .env file, which is why Spotify, the Study Assistant chat, and the essay generator are not working. Below is exactly how to fix it. Copy commands one at a time.',
    ]);

    h2('Current Status');
    p('Your Pi .env currently has these (good):');
    bullet([
      'DATABASE_URL', 'HOME_ASSISTANT_TOKEN', 'DEPLOYED_APP_URL',
      'GOOGLE_SECOND_ACCOUNT_CLIENT_ID', 'GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET',
      'SITE_PASSWORD', 'SITE_PASSWORD_4201', 'SITE_PASSWORD_1010',
    ]);
    p('Missing — you need to add these:');
    bullet([
      'OPENAI_API_KEY — needed for Study Assistant chat + essay generator',
      'SPOTIFY_CLIENT_ID — needed for the Spotify widget to connect',
      'SPOTIFY_CLIENT_SECRET — same',
      '(Optional) GITHUB_PERSONAL_ACCESS_TOKEN3 — only if you want BrynAssist to push code commits for you',
    ]);

    h2('Step 1 — Get the actual secret values');
    p('You need to copy real values from each website. Do this first so when you open the file you can paste them in one go.');

    h3('1a. OpenAI API Key');
    numbered([
      'Go to https://platform.openai.com/api-keys',
      'Sign in (your OpenAI account)',
      'Click "Create new secret key"',
      'Name: UniCal Pi → Create',
      'Copy the key starting with sk-proj-... — save it in a notes app right now, it only shows once',
    ]);

    h3('1b. Spotify Client ID + Secret');
    numbered([
      'Go to https://developer.spotify.com/dashboard',
      'Sign in with the Spotify account you use for UniCal',
      'Click your existing UniCal app (or create one — name: UniCal)',
      'Click Settings (top right)',
      'Copy Client ID — save it',
      'Click "View client secret" → copy it — save it',
      'VERY IMPORTANT: Scroll to Redirect URIs. Make sure https://uni-cal.app/api/spotify/callback is in the list (exactly that, no trailing slash). If not, click Edit → add it → Save. Without this, the green Reconnect button will not work.',
    ]);

    h3('1c. (Optional) GitHub token');
    p('Only if you want BrynAssist to commit code for you. Skip if not.');
    numbered([
      'Go to https://github.com/settings/tokens',
      'Generate new token (classic)',
      'Note: UniCal Pi, expiration: No expiration, scope: check repo',
      'Generate → copy the ghp_... token — save it',
    ]);

    h2('Step 2 — SSH into the Pi');
    p('From a Mac/PC terminal:');
    code(['ssh byhomeyyz@raspberrypi.local']);
    p('Or if you are already at the Pi keyboard, just open a terminal.');

    h2('Step 3 — Add the secrets to .env (the easy way)');
    p('Why we are doing this: The Pi reads .env when the server starts to find passwords/keys for OpenAI, Spotify, etc. Adding lines here makes those services work again after restart.');
    p('Run this one-line-at-a-time. Replace each PASTE_HERE with the real value you saved in Step 1.');
    code([
      'cd ~/Home-View',
      '',
      "echo 'OPENAI_API_KEY=PASTE_OPENAI_KEY_HERE' >> .env",
      "echo 'SPOTIFY_CLIENT_ID=PASTE_SPOTIFY_ID_HERE' >> .env",
      "echo 'SPOTIFY_CLIENT_SECRET=PASTE_SPOTIFY_SECRET_HERE' >> .env",
    ]);
    p('Optional GitHub one:');
    code(["echo 'GITHUB_PERSONAL_ACCESS_TOKEN3=PASTE_GHP_HERE' >> .env"]);
    p('Why echo ... >> .env: the >> means "append a new line to the end of the file." Safer than nano because there is no chance of accidentally deleting existing lines.');

    h2('Step 4 — Verify the names show up');
    code(['cat .env | grep -v "^#" | grep -v "^$" | cut -d= -f1']);
    p('You should now see 11 lines (or 12 with GitHub), including OPENAI_API_KEY, SPOTIFY_CLIENT_ID, and SPOTIFY_CLIENT_SECRET. If you only see 8, the echo commands did not run — try again.');

    h2('Step 5 — Pull the latest code');
    p('Why: A new green "Reconnect" button was added to the Spotify page so you can re-authorize Spotify with one tap. Also the essay generator on the bottom-right Library now defaults to the Pages selector so you can pick page count immediately.');
    code([
      'cd ~/Home-View',
      'git pull origin main',
    ]);

    h2('Step 6 — Rebuild and restart the server');
    p('Why: The server only reads .env when it starts. New env vars + new code → restart so they take effect.');
    code([
      'npm run build',
      'pm2 list           # find the actual process name',
      'pm2 restart <name> # use the name from pm2 list',
    ]);
    p('If pm2 list shows no processes at all, start fresh and save the name as "unical":');
    code([
      'cd ~/Home-View',
      'pm2 start dist/index.cjs --name unical',
      'pm2 save',
    ]);

    h2('Step 7 — Reconnect Spotify');
    numbered([
      'Open https://uni-cal.app on the Pi screen (or any browser)',
      'Go to the Spotify page',
      'Tap the green Reconnect button in the top-right',
      'Confirm the popup → Spotify sign-in → it brings you back',
      'Spotify widget should now show "Connected" and start playing',
    ]);

    h2('Step 8 — Sanity check');
    bullet([
      'Try sending a message in the BrynAssist chat bubble. If it replies, OpenAI key works.',
      'Try generating an essay. If it streams, OpenAI key works.',
      'Spotify widget on dashboard shows song name, not "not connected".',
      'Home Assistant tiles (Cat Washroom, lights) respond when tapped.',
    ]);

    h2('Troubleshooting');
    p('Spotify still says not connected after Step 7:');
    bullet([
      'Check the redirect URI in Spotify dashboard is exactly https://uni-cal.app/api/spotify/callback',
      'Run: cat ~/Home-View/.env | grep SPOTIFY — you should see two lines, ID and SECRET, with real values',
      'Check server logs: pm2 logs <name> --lines 50 — look for "Spotify" errors',
    ]);
    p('BrynAssist chat shows "Error" or does not respond:');
    bullet([
      'Run: cat ~/Home-View/.env | grep OPENAI — must show one line with a real sk-... value',
      'Check OpenAI account has billing set up at platform.openai.com/account/billing',
      'Check server logs: pm2 logs <name> --lines 50',
    ]);
    p('git pull says "Your local changes would be overwritten":');
    code([
      'git stash',
      'git pull origin main',
      'git stash pop',
    ]);

    h2('Going Forward');
    p('Replit is gone. To make code changes from now on:');
    numbered([
      'Edit code in Cursor / Codex / Claude Code on your laptop',
      'Commit + push to GitHub main branch',
      'SSH to Pi → cd ~/Home-View && git pull && npm run build && pm2 restart <name>',
    ]);
    p('The Pi is the source of truth. Always pull after a push.');

    doc.moveDown(1);
    doc.strokeColor('#d1d5db').lineWidth(0.5).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(8.5).text(`Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })} ET · UniCal Pi handoff`);

    doc.end();
  });
}

(async () => {
  const pdf = await buildPdf();
  console.log('PDF size:', pdf.length, 'bytes');

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 600px; color: #1a1a1a; line-height: 1.55;">
      <h2 style="color: #1e40af;">UniCal Pi Handoff Checklist (PDF Attached)</h2>
      <p>Hey Bryn — full step-by-step checklist is attached as <strong>UniCal-Pi-Handoff.pdf</strong>.</p>
      <p>It covers:</p>
      <ul>
        <li>What's missing from your Pi <code>.env</code> right now</li>
        <li>Where to grab the real OpenAI / Spotify / GitHub values</li>
        <li>The safe way to add them (using <code>echo &gt;&gt; .env</code>)</li>
        <li>How to find your pm2 process name</li>
        <li>How to reconnect Spotify with the new green button</li>
        <li>Troubleshooting if anything doesn't work</li>
      </ul>
      <p>Open it on your phone or laptop while you're SSH'd into the Pi.</p>
      <p style="color:#6b7280; font-size: 12px;">Sent from your UniCal workspace · ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })} ET</p>
    </div>
  `;

  const result = await sendGmailWithAttachment({
    to: 'bryn.kai-hendricks@outlook.com, homeworkbryn@gmail.com',
    subject: 'UniCal Pi Handoff Checklist (PDF)',
    htmlBody: html,
    attachments: [{
      filename: 'UniCal-Pi-Handoff.pdf',
      content: pdf,
      mimeType: 'application/pdf',
    }],
  });
  console.log(result);
  process.exit(result.success ? 0 : 1);
})();
