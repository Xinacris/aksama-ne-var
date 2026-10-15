import { startActivityAsync } from "expo-intent-launcher";
import { Platform } from "react-native";
import type { CookingTimer } from "@anv/core/data/models";
import { remainingSeconds } from "@anv/core/domain/cooking";

/**
 * Android: hand a running timer to the phone's Clock app (AlarmClock.ACTION_SET_TIMER, needs
 * com.android.alarm.permission.SET_ALARM). Android has no way to pause, extend or cancel a timer
 * set there, so this is the cook's explicit choice per timer; the app then drops its own
 * notification for that finish (core `nextHandoffs`).
 */
const ACTION_SET_TIMER = "android.intent.action.SET_TIMER";
const EXTRA_LENGTH = "android.intent.extra.alarm.LENGTH";
const EXTRA_MESSAGE = "android.intent.extra.alarm.MESSAGE";
const EXTRA_SKIP_UI = "android.intent.extra.alarm.SKIP_UI";

export const phoneClockAvailable = () => Platform.OS === "android";

/** True if the Clock app took the timer. No clock app (or it refused) → false, the app keeps ringing for it. */
export async function setOnPhoneClock(timer: CookingTimer, now: Date): Promise<boolean> {
  if (!phoneClockAvailable()) return false;
  const seconds = remainingSeconds(timer, now);
  if (seconds < 1 || timer.pausedLeft != null) return false;
  try {
    // The launcher turns whole JS numbers into Int extras, which is what LENGTH must be.
    await startActivityAsync(ACTION_SET_TIMER, { extra: { [EXTRA_LENGTH]: seconds, [EXTRA_MESSAGE]: timer.label, [EXTRA_SKIP_UI]: true } });
    return true;
  } catch {
    return false;
  }
}
