import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const guidePath = path.join(process.cwd(), 'attached_assets', 'Master_App_Guide.md');
  const guideContent = fs.readFileSync(guidePath, 'utf-8');
  
  const plainText = guideContent
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
    })
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\|/g, ' | ')
    .replace(/---+/g, '────────────────────────');

  function mdToHtml(md: string): string {
    let html = md;
    
    html = html.replace(/^### (.+)$/gm, '<h3 style="color:#042550;margin:24px 0 12px;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="color:#042550;border-bottom:2px solid #4578B0;padding-bottom:8px;margin:32px 0 16px;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="color:#042550;border-bottom:3px solid #042550;padding-bottom:12px;margin:40px 0 20px;">$1</h1>');
    
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      return `<pre style="background:#f4f4f4;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;border:1px solid #ddd;line-height:1.5;">${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
    });
    
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    html = html.replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      const tds = cells.map(c => `<td style="padding:8px 12px;border:1px solid #ddd;">${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    });
    html = html.replace(/^\|[\s-|]+\|$/gm, '');
    html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table style="border-collapse:collapse;width:100%;margin:16px 0;">$1</table>');
    
    html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:2px solid #ddd;margin:32px 0;">');
    
    const lines = html.split('\n');
    const result: string[] = [];
    for (const line of lines) {
      if (line.startsWith('<h') || line.startsWith('<pre') || line.startsWith('<table') || line.startsWith('<tr') || line.startsWith('<hr') || line.trim() === '') {
        result.push(line);
      } else {
        result.push(`<p style="margin:8px 0;line-height:1.6;">${line}</p>`);
      }
    }
    
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#333;font-size:15px;">
${result.join('\n')}
</body>
</html>`;
  }

  const htmlContent = mdToHtml(guideContent);

  const attachment = Buffer.from(guideContent).toString('base64');

  console.log('Sending email to homeworkbryn@gmail.com...');
  
  const { data, error } = await resend.emails.send({
    from: 'reminders@uni-cal.app',
    to: 'homeworkbryn@gmail.com',
    subject: 'Master App Guide — Complete Reference (March 28, 2026)',
    html: htmlContent,
    text: plainText,
    attachments: [
      {
        filename: 'Master_App_Guide.md',
        content: attachment,
        content_type: 'text/markdown',
      }
    ],
  });

  if (error) {
    console.error('Email send error:', error);
    process.exit(1);
  }
  
  console.log('Email sent successfully! ID:', data?.id);

  console.log('\nSending copy to Outlook...');
  const { data: data2, error: error2 } = await resend.emails.send({
    from: 'reminders@uni-cal.app',
    to: 'bryn.kai-hendricks@outlook.com',
    subject: 'Master App Guide — Complete Reference (March 28, 2026)',
    text: plainText,
    attachments: [
      {
        filename: 'Master_App_Guide.md',
        content: attachment,
        content_type: 'text/markdown',
      }
    ],
  });

  if (error2) {
    console.error('Outlook email error:', error2);
    process.exit(1);
  }

  console.log('Outlook email sent! ID:', data2?.id);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
