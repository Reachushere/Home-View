import fs from 'fs';
import path from 'path';
import { sendGmailWithAttachment } from '../server/gmail';

async function main() {
  const guidePath = path.join(process.cwd(), 'attached_assets', 'Master_App_Guide.md');
  const guideContent = fs.readFileSync(guidePath, 'utf-8');

  const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#333;">
<h1 style="color:#042550;">Master App Guide — Complete Reference</h1>
<p>Generated: March 28, 2026</p>
<p>The full guide is attached as a <strong>.md</strong> file. Open it in any text editor, VS Code, or paste it into ChatGPT.</p>
<hr style="border:none;border-top:2px solid #4578B0;margin:20px 0;">
<p style="color:#666;">This email was sent from your dashboard app.</p>
</div>`;

  console.log('Sending guide via Gmail to homeworkbryn@gmail.com...');
  const result1 = await sendGmailWithAttachment({
    to: 'homeworkbryn@gmail.com',
    subject: 'Master App Guide — Complete Reference (March 28, 2026)',
    htmlBody: htmlContent,
    attachments: [
      {
        filename: 'Master_App_Guide.md',
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

  console.log('Sending guide via Gmail to Outlook...');
  const result2 = await sendGmailWithAttachment({
    to: 'bryn.kai-hendricks@outlook.com',
    subject: 'Master App Guide — Complete Reference (March 28, 2026)',
    htmlBody: htmlContent,
    attachments: [
      {
        filename: 'Master_App_Guide.md',
        content: Buffer.from(guideContent, 'utf-8'),
        mimeType: 'text/markdown',
      }
    ],
  });

  if (result2.success) {
    console.log('Gmail send to Outlook: SUCCESS');
  } else {
    console.error('Gmail send to Outlook failed:', result2.error);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
