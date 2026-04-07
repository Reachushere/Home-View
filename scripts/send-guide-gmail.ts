import fs from 'fs';
import path from 'path';
import { sendGmailWithAttachment } from '../server/gmail';

async function main() {
  const guidePath = path.join(process.cwd(), 'HA_Automations_Reference.md');
  const guideContent = fs.readFileSync(guidePath, 'utf-8');

  const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#333;">
<h1 style="color:#042550;">Cat Washroom Automations — Updated Reference</h1>
<p>Updated: April 7, 2026</p>
<p>Key changes in this update:</p>
<ul>
<li><strong>Tablet navigation</strong> — Cat washroom tablet now uses tablet-nav polling (not ADB Silk browser launch). ADB is only used for wakeup + brightness.</li>
<li><strong>All webhook URLs</strong> updated to Pi self-hosted address (http://172.24.1.204:5000)</li>
<li><strong>Removed</strong> ADB force-stop com.amazon.cloud9 from tablet stop flow</li>
</ul>
<p>The full reference is attached as a <strong>.md</strong> file.</p>
<hr style="border:none;border-top:2px solid #4578B0;margin:20px 0;">
<p style="color:#666;">This email was sent from your dashboard app.</p>
</div>`;

  console.log('Sending updated reference via Gmail to homeworkbryn@gmail.com...');
  const result1 = await sendGmailWithAttachment({
    to: 'homeworkbryn@gmail.com',
    subject: 'Cat Washroom Automations — Updated Reference (April 7, 2026)',
    htmlBody: htmlContent,
    attachments: [
      {
        filename: 'HA_Automations_Reference.md',
        content: Buffer.from(guideContent, 'utf-8'),
        mimeType: 'text/markdown',
      }
    ],
  });

  if (result1.success) {
    console.log('Gmail send to homeworkbryn@gmail.com: SUCCESS');
  } else {
    console.error('Gmail send failed:', result1.error);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
