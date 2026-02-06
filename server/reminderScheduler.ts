import { storage } from "./storage";
import { sendTaskReminder, sendHaTaskReminder, sendDailyDigest, type TaskReminder } from "./email";

const sentReminders = new Set<string>();

const DAILY_DIGEST_HOUR = 7;
let lastDigestDate = "";
let schedulerRunning = false;
let lastCheckTime: Date | null = null;
let remindersSentCount = 0;

function getReminderKey(taskId: number, reminderMinutes: number): string {
  return `${taskId}-${reminderMinutes}`;
}

export function getSchedulerStatus() {
  return {
    running: schedulerRunning,
    lastCheck: lastCheckTime?.toISOString() || null,
    remindersSent: remindersSentCount,
    trackedReminders: sentReminders.size,
    lastDigestDate,
  };
}

export async function checkReminders() {
  try {
    const allTasks = await storage.getTasks({ showCompleted: false });
    const now = new Date();
    lastCheckTime = now;

    for (const task of allTasks) {
      if (task.isCompleted || !task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      const reminderFields = [
        task.reminder1,
        task.reminder2,
        task.reminder3,
        task.reminder4,
      ];

      for (const reminderMinutes of reminderFields) {
        if (reminderMinutes == null) continue;

        const reminderTime = new Date(dueDate.getTime() - reminderMinutes * 60 * 1000);
        const key = getReminderKey(task.id, reminderMinutes);

        if (sentReminders.has(key)) continue;

        if (now >= reminderTime && now < dueDate) {
          console.log(`[Reminder] Triggering reminder for task "${task.title}" (${reminderMinutes} min before due)`);

          const taskReminder: TaskReminder = {
            id: task.id,
            title: task.title,
            dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : String(task.dueDate),
            courseName: task.courseName,
            type: task.type,
          };

          const [emailResult, haResult] = await Promise.allSettled([
            sendTaskReminder(taskReminder),
            sendHaTaskReminder(taskReminder),
          ]);

          if (emailResult.status === "fulfilled" && emailResult.value.success) {
            console.log(`[Reminder] Email sent for "${task.title}"`);
          } else {
            const err = emailResult.status === "rejected" ? emailResult.reason : emailResult.value.error;
            console.error(`[Reminder] Email failed for "${task.title}":`, err);
          }

          if (haResult.status === "fulfilled" && haResult.value.success) {
            console.log(`[Reminder] HA push sent for "${task.title}"`);
          } else {
            const err = haResult.status === "rejected" ? haResult.reason : haResult.value.error;
            console.error(`[Reminder] HA push failed for "${task.title}":`, err);
          }

          sentReminders.add(key);
          remindersSentCount++;
        }

        if (now > dueDate) {
          sentReminders.add(key);
        }
      }
    }
  } catch (err) {
    console.error("[Reminder] Error checking reminders:", err);
  }
}

export async function checkDailyDigest() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (todayStr === lastDigestDate) return;
    if (now.getHours() < DAILY_DIGEST_HOUR) return;

    console.log("[Reminder] Sending daily digest...");
    lastDigestDate = todayStr;

    const allTasks = await storage.getTasks({ showCompleted: false });
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const upcomingTasks: TaskReminder[] = allTasks
      .filter(task => {
        if (task.isCompleted || !task.dueDate) return false;
        const due = new Date(task.dueDate);
        return due >= now && due <= threeDaysFromNow;
      })
      .map(task => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : String(task.dueDate),
        courseName: task.courseName,
        type: task.type,
      }));

    if (upcomingTasks.length > 0) {
      const result = await sendDailyDigest(upcomingTasks);
      if (result.success) {
        console.log(`[Reminder] Daily digest sent with ${upcomingTasks.length} tasks`);
      } else {
        console.error("[Reminder] Daily digest failed:", result.error);
      }

      const haMsg = upcomingTasks.map(t => t.title).join(", ");
      await sendHaTaskReminder({
        id: 0,
        title: `Daily Digest: ${upcomingTasks.length} tasks due soon`,
        dueDate: new Date().toISOString(),
        courseName: haMsg,
      });
    } else {
      console.log("[Reminder] No upcoming tasks for daily digest");
    }
  } catch (err) {
    console.error("[Reminder] Error sending daily digest:", err);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  console.log("=== [Reminder] Starting reminder scheduler (checking every 60 seconds) ===");
  schedulerRunning = true;

  checkReminders();
  checkDailyDigest();

  reminderInterval = setInterval(() => {
    checkReminders();
    checkDailyDigest();
  }, 60 * 1000);
}

export function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    schedulerRunning = false;
    console.log("[Reminder] Scheduler stopped");
  }
}
