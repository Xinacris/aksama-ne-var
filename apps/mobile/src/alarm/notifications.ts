import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { CookingSession } from "@anv/core/data/models";
import { ALARM_VIBRATION, alarmSchedule, reconcileSchedule } from "@anv/core/domain/timerAlarm";
import { getLocale, t } from "@anv/core/i18n";

/**
 * Timer alarms while the app is in the background or the phone is locked: one local notification
 * per running timer at its `endsAt` (core `alarmSchedule`), reconciled against what is scheduled
 * after every change — pause, +1 min, restart, close, finish and Stop all cancel or move it.
 * No exact-alarm permission: Android may deliver a few seconds late.
 */
export const CHANNEL = "timers";
export const CHANNEL_SILENT = "timers-silent";
export const SOUND = "timer_alarm.wav";

let channelsFor: string | null = null;

/** Android channels "Zamanlayıcılar" (alarm sound, high importance) and a silent one for "Zamanlayıcı sesi: Kapalı". */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android" || channelsFor === getLocale()) return;
  channelsFor = getLocale();
  const common = {
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: ALARM_VIBRATION,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  };
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    ...common,
    name: t("alarm.channel"),
    sound: SOUND,
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, { ...common, name: t("alarm.channelSilent"), sound: null });
}

/** In the foreground the in-app alarm rings; the system notification stays out of the way. */
export function setForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/**
 * Asked the first time a timer starts (never on launch). `granted`: notifications may be shown;
 * `denied`: the cook said no (now or earlier) — the in-app alarm still works.
 */
export async function ensureNotificationPermission(): Promise<{ granted: boolean; denied: boolean }> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return { granted: true, denied: false };
    if (!current.canAskAgain) return { granted: false, denied: true };
    const asked = await Notifications.requestPermissionsAsync();
    return { granted: asked.granted, denied: !asked.granted };
  } catch {
    return { granted: false, denied: false };
  }
}

type Sessions = Pick<CookingSession, "key" | "phase" | "timers">[];

let chain: Promise<void> = Promise.resolve();

/** Bring the scheduled notifications in line with the sessions (serialized, so quick taps can't race). */
export function syncTimerNotifications(sessions: Sessions, now: Date, sound: boolean): Promise<void> {
  chain = chain.then(() => reconcile(sessions, now, sound)).catch((e) => console.warn("[alarm]", e));
  return chain;
}

async function reconcile(sessions: Sessions, now: Date, sound: boolean): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannels();
  // The sound choice is part of the id, so turning "Zamanlayıcı sesi" off moves pending ones to the silent channel.
  const wanted = alarmSchedule(sessions, now).map((w) => ({ ...w, id: `${w.id}:${sound ? "s" : "m"}` }));
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).map((r) => r.identifier);
  const { cancel, schedule } = reconcileSchedule(scheduled, wanted);
  for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
  for (const w of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: w.id,
      content: {
        title: t("alarm.notifTitle", { label: w.label }),
        body: t("alarm.notifBody"),
        sound: sound ? SOUND : false,
        data: { url: `/pisir/${w.sessionKey}`, sessionKey: w.sessionKey, timerId: w.timerId },
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.fireAt, channelId: sound ? CHANNEL : CHANNEL_SILENT },
    });
  }
}

/** Remove timer notifications already in the shade (after Stop, or when the in-app alarm took over). */
export async function clearPresentedTimerNotifications(): Promise<void> {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) if (n.request.identifier.startsWith("timer-")) await Notifications.dismissNotificationAsync(n.request.identifier);
  } catch {
    // nothing to clear
  }
}
