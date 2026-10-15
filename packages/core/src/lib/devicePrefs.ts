import type { KeyValueStore } from "../data/storage";

/** Device-level preferences next to the theme (`anv.theme`): not synced across household members. */
export const TIMER_SOUND_KEY = "anv.timerSound";
/** Set once the "notifications are off" hint has been shown. */
export const ALARM_HINT_KEY = "anv.alarmHintShown";
/** "Zamanlayıcı türü": the app's notification, or the phone's own alarm (AlarmKit) where there is one. */
export const TIMER_KIND_KEY = "anv.timerKind";
/** Finishes handed to the phone's Clock app on this device (`id@endsAt`), so the app doesn't ring them too. */
export const TIMER_HANDOFF_KEY = "anv.timerHandoffs";

export type TimerKind = "notification" | "phoneClock";

/** Timer sound is on unless turned off. */
export function readTimerSound(store: Pick<KeyValueStore, "getItem"> | null | undefined): boolean {
  try {
    return store?.getItem(TIMER_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeTimerSound(store: Pick<KeyValueStore, "setItem"> | null | undefined, on: boolean): void {
  try {
    store?.setItem(TIMER_SOUND_KEY, on ? "on" : "off");
  } catch {
    // storage unavailable: the choice applies until reload
  }
}

/** True the first time only: show the "notifications are off" hint once per device. */
export function takeAlarmHint(store: Pick<KeyValueStore, "getItem" | "setItem"> | null | undefined): boolean {
  try {
    if (!store || store.getItem(ALARM_HINT_KEY)) return false;
    store.setItem(ALARM_HINT_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Defaults to the phone clock where this device has one (`phoneClockAvailable`). */
export function readTimerKind(store: Pick<KeyValueStore, "getItem"> | null | undefined, phoneClockAvailable: boolean): TimerKind {
  if (!phoneClockAvailable) return "notification";
  try {
    return store?.getItem(TIMER_KIND_KEY) === "notification" ? "notification" : "phoneClock";
  } catch {
    return "phoneClock";
  }
}

export function writeTimerKind(store: Pick<KeyValueStore, "setItem"> | null | undefined, kind: TimerKind): void {
  try {
    store?.setItem(TIMER_KIND_KEY, kind);
  } catch {
    // storage unavailable: the choice applies until reload
  }
}

export function readHandoffs(store: Pick<KeyValueStore, "getItem"> | null | undefined): string[] {
  try {
    const v: unknown = JSON.parse(store?.getItem(TIMER_HANDOFF_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeHandoffs(store: Pick<KeyValueStore, "setItem"> | null | undefined, keys: string[]): void {
  try {
    store?.setItem(TIMER_HANDOFF_KEY, JSON.stringify(keys));
  } catch {
    // storage unavailable: the hand-off is remembered until the app closes
  }
}
