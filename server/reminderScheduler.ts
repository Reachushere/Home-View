import { storage } from "./storage";
import { sendTaskReminder, sendHaTaskReminder, sendEchoVoiceAnnouncement, sendDailyDigest, type TaskReminder } from "./email";
import { getIsTravellingMode } from "./routes";
import { db } from "./db";
import { appState } from "@shared/schema";
import { eq } from "drizzle-orm";
import { syncOutlookEventsToReview } from "./outlookCalendar";

function getEasternNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
}

function getEasternDateStr(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(date);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function getEasternHour(date: Date): number {
  return parseInt(date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Toronto' }), 10) % 24;
}

const sentReminders = new Set<string>();

const DAILY_DIGEST_HOUR = 7;
const OUTLOOK_SYNC_HOUR = 8;
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

let announcementsSentThisCycle = 0;
const MAX_ANNOUNCEMENTS_PER_CYCLE = 3;
let lastAnnouncementTime = 0;
const MIN_ANNOUNCEMENT_GAP_MS = 10000;
let dailyDigestJustSent = false;

export async function checkReminders() {
  try {
    await loadSentReminders();
    const allTasks = await storage.getTasks({ showCompleted: false });
    const now = getEasternNow();
    lastCheckTime = now;
    let stateChanged = false;
    announcementsSentThisCycle = 0;

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
          if (announcementsSentThisCycle >= MAX_ANNOUNCEMENTS_PER_CYCLE) {
            console.log(`[Reminder] Rate limit: already sent ${MAX_ANNOUNCEMENTS_PER_CYCLE} announcements this cycle, marking "${task.title}" as sent without announcing`);
            sentReminders.add(key);
            stateChanged = true;
            continue;
          }

          const timeSinceLast = Date.now() - lastAnnouncementTime;
          if (timeSinceLast < MIN_ANNOUNCEMENT_GAP_MS && lastAnnouncementTime > 0) {
            console.log(`[Reminder] Rate limit: only ${timeSinceLast}ms since last announcement, skipping "${task.title}"`);
            sentReminders.add(key);
            stateChanged = true;
            continue;
          }

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
          if (dailyDigestJustSent) {
            console.log(`[Reminder] Skipping individual Echo announcement for "${task.title}" (daily digest already announced)`);
          } else if (!isTravelling) {
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
          announcementsSentThisCycle++;
          lastAnnouncementTime = Date.now();
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
    const todayStr = getEasternDateStr(now);
    const easternHour = getEasternHour(now);

    if (easternHour < DAILY_DIGEST_HOUR) return;

    const lastDigestDate = await getAppState("last_digest_date");
    if (lastDigestDate === todayStr) return;

    await setAppState("last_digest_date", todayStr);
    dailyDigestJustSent = true;
    setTimeout(() => { dailyDigestJustSent = false; }, 120000);
    console.log("[Reminder] Sending daily digest...");

    const allTasks = await storage.getTasks({ showCompleted: false });
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const upcomingTasksRaw: TaskReminder[] = allTasks
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
    const seenTitles = new Set<string>();
    const upcomingTasks = upcomingTasksRaw.filter(t => {
      if (seenTitles.has(t.title)) return false;
      seenTitles.add(t.title);
      return true;
    });
    if (upcomingTasks.length !== upcomingTasksRaw.length) {
      console.log(`[Reminder] Daily digest: deduplicated ${upcomingTasksRaw.length} → ${upcomingTasks.length} tasks (removed ${upcomingTasksRaw.length - upcomingTasks.length} duplicate titles)`);
    }

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
        const hour = getEasternHour(new Date());
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

        const tomorrowStart = new Date(now);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        tomorrowStart.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        const day2End = new Date(tomorrowEnd);
        day2End.setDate(day2End.getDate() + 1);

        const tomorrowTasks = upcomingTasks.filter(t => {
          const d = new Date(t.dueDate);
          return d >= tomorrowStart && d < tomorrowEnd;
        });
        const day2Tasks = upcomingTasks.filter(t => {
          const d = new Date(t.dueDate);
          return d >= tomorrowEnd && d < day2End;
        });
        const day3Tasks = upcomingTasks.filter(t => {
          const d = new Date(t.dueDate);
          return d >= day2End;
        });

        let voiceMsg = `${greeting}.`;
        if (tomorrowTasks.length > 0) {
          const tomorrowList = tomorrowTasks.map(t => t.title).join(", ");
          voiceMsg += ` You have ${tomorrowTasks.length} task${tomorrowTasks.length !== 1 ? 's' : ''} due tomorrow: ${tomorrowList}.`;
        } else {
          voiceMsg += ` No tasks due tomorrow.`;
        }
        if (day2Tasks.length > 0) {
          voiceMsg += ` Also, ${day2Tasks.length} task${day2Tasks.length !== 1 ? 's' : ''} the day after.`;
        }
        if (day3Tasks.length > 0) {
          voiceMsg += ` And ${day3Tasks.length} more in 3 days.`;
        }

        const echoResult = await sendEchoVoiceAnnouncement(voiceMsg);
        if (echoResult.success) {
          console.log(`[Reminder] Daily digest Echo announcement sent (${tomorrowTasks.length} tomorrow, ${day2Tasks.length} day2, ${day3Tasks.length} day3)`);
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

export async function checkOutlookSync() {
  try {
    const now = new Date();
    const todayStr = getEasternDateStr(now);
    const easternHour = getEasternHour(now);

    if (easternHour < OUTLOOK_SYNC_HOUR) return;

    const lastSyncDate = await getAppState("last_outlook_sync_date");
    if (lastSyncDate === todayStr) return;

    await setAppState("last_outlook_sync_date", todayStr);
    console.log("[Reminder] Running Outlook calendar sync...");

    try {
      const result = await syncOutlookEventsToReview();
      console.log(`[Reminder] Outlook sync complete: ${result.added} added, ${result.skipped} skipped`);
    } catch (err: any) {
      console.error("[Reminder] Outlook sync failed:", err.message || err);
    }
  } catch (err) {
    console.error("[Reminder] Error in Outlook sync check:", err);
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
  checkOutlookSync();

  reminderInterval = setInterval(() => {
    checkReminders();
    checkDailyDigest();
    checkOutlookSync();
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
