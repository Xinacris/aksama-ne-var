import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { reconcileReminders, reminderNotificationId, reminderText, type PantryReminder } from "@anv/core/domain/pantryReminders";
import { getLocale, t } from "@anv/core/i18n";

/**
 * Pantry reminders as scheduled local notifications (Round 3.5). The plan comes from core
 * (`planPantryReminders`); this only reconciles the phone's schedule with it: what's answered or
 * no longer relevant is cancelled, what's new is added. Only `pantry:` ids are touched (timers keep
 * theirs). Without permission, or if scheduling fails, nothing is scheduled and the in-app banner
 * shows due reminders instead.
 */
export const REMINDER_CHANNEL = "pantry-reminders";
let channelFor: string | null = null;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android" || channelFor === getLocale()) return;
  channelFor = getLocale();
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, { name: t("pantry.title"), importance: Notifications.AndroidImportance.HIGH });
}

/** Where a reminder opens: its quick check. */
export function reminderUrl(r: Pick<PantryReminder, "id">): string {
  return `/evde/kontrol?r=${encodeURIComponent(r.id)}`;
}

export type SyncResult = "scheduled" | "noPermission" | "failed";
let chain: Promise<SyncResult> = Promise.resolve("scheduled");

/** Serialized, so quick changes can't race; never throws. */
export function syncPantryNotifications(scheduled: readonly PantryReminder[], names: ReadonlyMap<string, string>): Promise<SyncResult> {
  chain = chain.then(() => reconcile(scheduled, names)).catch((e: unknown) => {
    console.warn("[reminders]", e);
    return "failed" as const;
  });
  return chain;
}

async function reconcile(wanted: readonly PantryReminder[], names: ReadonlyMap<string, string>): Promise<SyncResult> {
  if (!(await Notifications.getPermissionsAsync()).granted) return "noPermission";
  await ensureChannel();
  const held = (await Notifications.getAllScheduledNotificationsAsync()).map((r) => r.identifier);
  const { cancel, schedule } = reconcileReminders(held, wanted);
  for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
  for (const r of schedule) {
    const text = reminderText(r, names);
    await Notifications.scheduleNotificationAsync({
      identifier: reminderNotificationId(r),
      content: { title: text.title, body: text.body, data: { kind: "pantry", url: reminderUrl(r), reminderId: r.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: REMINDER_CHANNEL },
    });
  }
  return "scheduled";
}

/** Asked when the household fills the pantry (onboarding) or turns reminders on; never on launch. */
export async function askReminderPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
