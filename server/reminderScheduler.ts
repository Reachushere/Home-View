import { storage } from "./storage";
import { sendTaskReminder, sendHaTaskReminder, sendEchoVoiceAnnouncement, sendDailyDigest, type TaskReminder } from "./email";
import { getIsTravellingMode } from "./routes";
import { db } from "./db";
import { appState } from "@shared/schema";
import { eq } from "drizzle-orm";
import { syncOutlookEventsToReview } from "./outlookCalendar";
import { easternNow, easternDateStr, easternHour, easternMidnight, taskDateStr, addDays } from "./timezone";

const getEasternNow = easternNow;
const getEasternDateStr = easternDateStr;
const getEasternHour = easternHour;
const getEasternMidnight = easternMidnight;
const addDaysET = addDays;

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

async function digestAlreadySentToday(): Promise<boolean> {
  const todayStr = getEasternDateStr(new Date());
  const lastDigestDate = await getAppState("last_digest_date");
  return lastDigestDate === todayStr;
}

export async function checkReminders() {
  try {
    await loadSentReminders();
    const allTasks = await storage.getTasks({ showCompleted: false });
    const nowReal = new Date();
    lastCheckTime = nowReal;
    let stateChanged = false;
    announcementsSentThisCycle = 0;
    const echoAnnouncedTaskIds = new Set<number>();

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

        if (nowReal >= reminderTime && nowReal < dueDate) {
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

          console.log(`[Reminder] Triggering reminder for task "${task.title}" (${reminderMinutes} min before due) | now=${nowReal.toISOString()} dueDate=${dueDate.toISOString()} actualMinLeft=${Math.round((dueDate.getTime() - nowReal.getTime()) / 60000)}`);

          const taskReminder: TaskReminder = {
            id: task.id,
            title: task.title,
            dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : String(task.dueDate),
            courseName: task.courseName,
            type: task.type,
          };

          const actualMinutesLeft = Math.max(0, Math.round((dueDate.getTime() - nowReal.getTime()) / (60 * 1000)));
          const timeLabel = actualMinutesLeft >= 1440
            ? `${Math.round(actualMinutesLeft / 1440)} day${Math.round(actualMinutesLeft / 1440) !== 1 ? 's' : ''}`
            : actualMinutesLeft >= 60 
              ? `${Math.round(actualMinutesLeft / 60)} hour${Math.round(actualMinutesLeft / 60) !== 1 ? 's' : ''}` 
              : `${actualMinutesLeft} minutes`;
          const voiceMessage = `Reminder: ${task.title}${task.courseName ? `, for ${task.courseName}` : ''}, is due in ${timeLabel}.`;

          const isTravelling = getIsTravellingMode();
          const digestSentToday = await digestAlreadySentToday();
          const notifications: Promise<{ success: boolean; error?: string }>[] = [
            sendTaskReminder(taskReminder),
            sendHaTaskReminder(taskReminder),
          ];
          if (echoAnnouncedTaskIds.has(task.id)) {
            console.log(`[Reminder] Skipping duplicate Echo announcement for "${task.title}" (already announced this cycle for a different reminder slot)`);
          } else if (digestSentToday) {
            console.log(`[Reminder] Skipping individual Echo announcement for "${task.title}" (daily digest already announced today)`);
          } else if (!isTravelling) {
            notifications.push(sendEchoVoiceAnnouncement(voiceMessage));
            echoAnnouncedTaskIds.add(task.id);
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

        if (nowReal > dueDate) {
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
    console.log("[Reminder] Sending daily digest (Echo announcements suppressed for individual reminders rest of today)...");

    const allTasks = await storage.getTasks({ showCompleted: false });
    const threeDaysFromNow = addDaysET(now, 3);
    const todayMidnight = getEasternMidnight(now);

    const upcomingTasksRaw: TaskReminder[] = allTasks
      .filter(task => {
        if (task.isCompleted || !task.dueDate) return false;
        const dueStr = getEasternDateStr(new Date(task.dueDate));
        const todayStrCheck = getEasternDateStr(todayMidnight);
        const endStr = getEasternDateStr(threeDaysFromNow);
        return dueStr >= todayStrCheck && dueStr <= endStr;
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

        const todayMid = easternMidnight();
        const tomorrowDateStr = easternDateStr(addDays(todayMid, 1));
        const day2DateStr = easternDateStr(addDays(todayMid, 2));
        const day3DateStr = easternDateStr(addDays(todayMid, 3));

        const tomorrowTasks = upcomingTasks.filter(t => taskDateStr(t.dueDate) === tomorrowDateStr);
        const day2Tasks = upcomingTasks.filter(t => taskDateStr(t.dueDate) === day2DateStr);
        const day3Tasks = upcomingTasks.filter(t => taskDateStr(t.dueDate) === day3DateStr);

        console.log(`[Reminder] Digest voice: tomorrow=${tomorrowDateStr} (${tomorrowTasks.length}), day2=${day2DateStr} (${day2Tasks.length}), day3=${day3DateStr} (${day3Tasks.length})`);

        const MAX_NAMES_TO_READ = 10;

        function deduplicateTaskNames(tasks: TaskReminder[]): string[] {
          const seen = new Set<string>();
          const result: string[] = [];
          for (const t of tasks) {
            const baseName = t.title.includes(' - ') ? t.title.split(' - ')[0].trim() : t.title.trim();
            if (!seen.has(baseName.toLowerCase())) {
              seen.add(baseName.toLowerCase());
              result.push(baseName);
            }
          }
          return result;
        }

        let voiceMsg = `${greeting}.`;
        if (tomorrowTasks.length > 0) {
          const dedupedNames = deduplicateTaskNames(tomorrowTasks);
          if (dedupedNames.length <= MAX_NAMES_TO_READ) {
            const tomorrowList = dedupedNames.join(", ");
            voiceMsg += ` You have ${tomorrowTasks.length} task${tomorrowTasks.length !== 1 ? 's' : ''} due tomorrow: ${tomorrowList}.`;
          } else {
            const firstFew = dedupedNames.slice(0, 5).join(", ");
            voiceMsg += ` You have ${tomorrowTasks.length} tasks due tomorrow, including: ${firstFew}, and ${dedupedNames.length - 5} more.`;
          }
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
