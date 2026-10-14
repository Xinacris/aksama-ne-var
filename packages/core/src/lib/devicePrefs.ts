import type { KeyValueStore } from "../data/storage";

/** Device-level preferences next to the theme (`anv.theme`): not synced across household members. */
export const TIMER_SOUND_KEY = "anv.timerSound";
/** Set once the "notifications are off" hint has been shown. */
export const ALARM_HINT_KEY = "anv.alarmHintShown";

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
