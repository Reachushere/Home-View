import { storage } from "./storage";
import { sendTaskReminder, sendHaTaskReminder, sendEchoVoiceAnnouncement, sendDailyDigest, type TaskReminder } from "./email";
import { getIsTravellingMode } from "./routes";
import { db } from "./db";
import { appState } from "@shared/schema";
import { eq } from "drizzle-orm";

const sentReminders = new Set<string>();

const DAILY_DIGEST_HOUR = 7;
let schedulerRunning = false;
let lastCheckTime: Date | null = null;
let remindersSentCount = 0;
let sentRemindersLoaded = false;

function getReminderKey(taskId: number, reminderMinutes: number): string {
  return `${taskId}-${reminderMinutes}`;
}

async function getAppState(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(appState).where(eq(appState.key, key));
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function setAppState(key: string, value: string): Promise<void> {
  try {
    await db.insert(appState)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appState.key,
        set: { value, updatedAt: new Date() },
      });
  } catch (err) {
    console.error(`[Reminder] Failed to persist app state for key "${key}":`, err);
  }
}

async function loadSentReminders(): Promise<void> {
  if (sentRemindersLoaded) return;
  try {
    const stored = await getAppState("sent_reminders");
    if (stored) {
      const keys: string[] = JSON.parse(stored);
      for (const k of keys) {
        sentReminders.add(k);
      }
      console.log(`[Reminder] Loaded ${keys.length} sent reminder keys from database`);
    }
    sentRemindersLoaded = true;
  } catch (err) {
    console.error("[Reminder] Failed to load sent reminders:", err);
    sentRemindersLoaded = true;
  }
}

async function persistSentReminders(): Promise<void> {
  const keys = Array.from(sentReminders);
  await setAppState("sent_reminders", JSON.stringify(keys));
}

export function getSchedulerStatus() {
  return {
    running: schedulerRunning,
    lastCheck: lastCheckTime?.toISOString() || null,
    remindersSent: remindersSentCount,
    trackedReminders: sentReminders.size,
  };
}

export async function checkReminders() {
  try {
    await loadSentReminders();
    const allTasks = await storage.getTasks({ showCompleted: false });
    const now = new Date();
    lastCheckTime = now;
    let stateChanged = false;

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

          const timeLabel = reminderMinutes >= 60 
            ? `${Math.round(reminderMinutes / 60)} hour${Math.round(reminderMinutes / 60) !== 1 ? 's' : ''}` 
            : `${reminderMinutes} minutes`;
          const voiceMessage = `Reminder: ${task.title}${task.courseName ? `, for ${task.courseName}` : ''}, is due in ${timeLabel}.`;

          const isTravelling = getIsTravellingMode();
          const notifications: Promise<{ success: boolean; error?: string }>[] = [
            sendTaskReminder(taskReminder),
            sendHaTaskReminder(taskReminder),
          ];
          if (!isTravelling) {
            notifications.push(sendEchoVoiceAnnouncement(voiceMessage));
          } else {
            console.log(`[Reminder] Skipping Echo announcement for "${task.title}" (travelling mode)`);
          }

          const results = await Promise.allSettled(notifications);

          const [emailResult, haResult] = results;
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

          if (!isTravelling && results[2]) {
            const echoResult = results[2];
            if (echoResult.status === "fulfilled" && echoResult.value.success) {
              console.log(`[Reminder] Echo voice announcement sent for "${task.title}"`);
            } else {
              const err = echoResult.status === "rejected" ? echoResult.reason : echoResult.value.error;
              console.error(`[Reminder] Echo voice announcement failed for "${task.title}":`, err);
            }
          }

          sentReminders.add(key);
          stateChanged = true;
          remindersSentCount++;
        }

        if (now > dueDate) {
          if (!sentReminders.has(key)) {
            sentReminders.add(key);
            stateChanged = true;
          }
        }
      }
    }

    if (stateChanged) {
      await persistSentReminders();
    }
  } catch (err) {
    console.error("[Reminder] Error checking reminders:", err);
  }
}

export async function checkDailyDigest() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (now.getHours() < DAILY_DIGEST_HOUR) return;

    const lastDigestDate = await getAppState("last_digest_date");
    if (lastDigestDate === todayStr) return;

    await setAppState("last_digest_date", todayStr);
    console.log("[Reminder] Sending daily digest...");

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

      const isTravelling = getIsTravellingMode();
      if (!isTravelling) {
        const taskList = upcomingTasks.map(t => t.title).join(", ");
        const voiceMsg = `Good morning. You have ${upcomingTasks.length} task${upcomingTasks.length !== 1 ? 's' : ''} due soon: ${taskList}.`;
        const echoResult = await sendEchoVoiceAnnouncement(voiceMsg);
        if (echoResult.success) {
          console.log(`[Reminder] Daily digest Echo announcement sent`);
        } else {
          console.error(`[Reminder] Daily digest Echo announcement failed:`, echoResult.error);
        }
      } else {
        console.log(`[Reminder] Skipping daily digest Echo announcement (travelling mode)`);
      }
    } else {
      console.log("[Reminder] No upcoming tasks for daily digest");
    }
  } catch (err) {
    console.error("[Reminder] Error sending daily digest:", err);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log("[Reminder] Cleared existing scheduler interval before starting new one");
  }

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
