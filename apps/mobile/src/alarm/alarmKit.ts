import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { CookingSession } from "@anv/core/data/models";
import { finishKey, finishUuid } from "@anv/core/domain/timerAlarm";
import { t } from "@anv/core/i18n";

/**
 * iOS 26+ system alarms for cooking timers (local module `modules/anv-alarmkit`). The module is
 * linked only in builds made with EXPO_PUBLIC_ENABLE_ALARMKIT=1 (plugins/withAlarmKit.js); in
 * every other build, in Expo Go, on Android and on iOS < 26 this file reports "not available"
 * and the app's own notification rings instead.
 */
type AuthState = "authorized" | "denied" | "notDetermined" | "unsupported";

interface AnvAlarmKit {
  isSupported(): boolean;
  authorizationState(): AuthState;
  requestAuthorization(): Promise<AuthState>;
  scheduleTimer(id: string, seconds: number, title: string, stopLabel: string, soundName: string): Promise<boolean>;
  cancel(id: string): void;
  scheduledIds(): string[];
}

const SOUND = "timer_alarm.wav";

function nativeModule(): AnvAlarmKit | null {
  if (Platform.OS !== "ios" || process.env.EXPO_PUBLIC_ENABLE_ALARMKIT !== "1") return null;
  const m = requireOptionalNativeModule<AnvAlarmKit>("AnvAlarmKit");
  try {
    return m?.isSupported() ? m : null;
  } catch {
    return null;
  }
}

/** True where "Telefonun saati" means something on iOS: the module is in the build and iOS is 26+. */
export function alarmKitAvailable(): boolean {
  return nativeModule() !== null;
}

/** Asked the first time a timer starts with "Telefonun saati" (never on launch). */
export async function ensureAlarmKitPermission(): Promise<{ granted: boolean; denied: boolean }> {
  const m = nativeModule();
  if (!m) return { granted: false, denied: false };
  try {
    const state = m.authorizationState() === "notDetermined" ? await m.requestAuthorization() : m.authorizationState();
    return { granted: state === "authorized", denied: state === "denied" };
  } catch {
    return { granted: false, denied: false };
  }
}

type Sessions = Pick<CookingSession, "key" | "phase" | "timers">[];

/**
 * Bring the system alarms in line with the timers: one per running timer (paused, finished and
 * closed ones have none), keyed by a UUID derived from `id@endsAt`, so pause / +1 dk / close
 * cancel the old alarm and schedule the new one. Returns the future finish keys AlarmKit now
 * rings for (core `nextHandoffs` keeps them); those get no app notification and no in-app ring
 * on this phone. A schedule that fails is left to the notification. With "Zamanlayıcı sesi: Kapalı" there are none: AlarmKit can't ring
 * silently, so the silent notification channel takes over.
 */
export async function syncAlarmKit(sessions: Sessions, now: Date, opts: { enabled: boolean; sound: boolean }): Promise<Set<string>> {
  const m = nativeModule();
  const covered = new Set<string>();
  if (!m) return covered;
  if (!opts.enabled || !opts.sound || m.authorizationState() !== "authorized") {
    for (const id of m.scheduledIds()) m.cancel(id);
    return covered;
  }
  const wanted = new Map<string, { key: string; seconds: number; label: string }>();
  // Finished but not closed: its alarm may be ringing right now; only closing it (or Durdur) stops it.
  const ringing = new Set<string>();
  for (const s of sessions) {
    if (s.phase === "done") continue;
    for (const x of s.timers) {
      if (x.dismissed || x.pausedLeft != null) continue;
      const key = finishKey(x);
      const seconds = Math.round((Date.parse(x.endsAt) - now.getTime()) / 1000);
      if (seconds < 1) {
        ringing.add(finishUuid(key));
        continue;
      }
      wanted.set(finishUuid(key), { key, seconds, label: x.label });
    }
  }
  const scheduled = new Set(m.scheduledIds());
  for (const id of scheduled) if (!wanted.has(id) && !ringing.has(id)) m.cancel(id);
  for (const [id, w] of wanted) {
    if (scheduled.has(id)) {
      covered.add(w.key);
      continue;
    }
    const ok = await m.scheduleTimer(id, w.seconds, t("alarm.notifTitle", { label: w.label }), t("alarm.stop"), SOUND).catch(() => false);
    if (ok) covered.add(w.key);
  }
  return covered;
}

/** Cancel every system alarm (switching "Zamanlayıcı türü" back to the notification). */
export function cancelAllAlarmKit(): void {
  const m = nativeModule();
  if (!m) return;
  for (const id of m.scheduledIds()) m.cancel(id);
}
