import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'reminders@uni-call.app';
const TO_EMAIL = 'bryn.kai-hendricks@outlook.com';

export interface TaskReminder {
  id: number;
  title: string;
  dueDate: string;
  courseName?: string | null;
  type?: string | null;
}

export async function sendTaskReminder(task: TaskReminder): Promise<{ success: boolean; error?: string }> {
  try {
    const dueDate = new Date(task.dueDate);
    const formattedDate = dueDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `Task Reminder: ${task.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #4578B0; padding-bottom: 10px;">
            Task Reminder
          </h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #042550; margin-top: 0;">${task.title}</h3>
            <p><strong>Due:</strong> ${formattedDate}</p>
            ${task.courseName ? `<p><strong>Course:</strong> ${task.courseName}</p>` : ''}
            ${task.type ? `<p><strong>Type:</strong> ${task.type}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 14px;">
            This is an automated reminder from your Uni-Cal task manager.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data);
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function sendDailyDigest(tasks: TaskReminder[]): Promise<{ success: boolean; error?: string }> {
  if (tasks.length === 0) {
    return { success: true };
  }

  try {
    const taskListHtml = tasks.map(task => {
      const dueDate = new Date(task.dueDate);
      const formattedDate = dueDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${task.title}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${task.courseName || '-'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${formattedDate}</td>
        </tr>
      `;
    }).join('');

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `Daily Task Digest: ${tasks.length} task${tasks.length > 1 ? 's' : ''} due soon`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #4578B0; padding-bottom: 10px;">
            Daily Task Digest
          </h2>
          <p>You have <strong>${tasks.length} task${tasks.length > 1 ? 's' : ''}</strong> due soon:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #042550; color: white;">
                <th style="padding: 10px; text-align: left;">Task</th>
                <th style="padding: 10px; text-align: left;">Course</th>
                <th style="padding: 10px; text-align: left;">Due</th>
              </tr>
            </thead>
            <tbody>
              ${taskListHtml}
            </tbody>
          </table>
          <p style="color: #666; font-size: 14px;">
            This is an automated digest from your Uni-Cal task manager.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Daily digest sent successfully:', data);
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function sendTestEmail(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: 'Uni-Cal Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #4578B0; padding-bottom: 10px;">
            Email Test Successful!
          </h2>
          <p>Your Uni-Cal email reminders are now set up and working correctly.</p>
          <p style="color: #666; font-size: 14px;">
            You will receive task reminders at this email address.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Test email sent successfully:', data);
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
