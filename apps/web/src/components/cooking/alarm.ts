"use client";

import { ALARM_TONE, ALARM_TONE_MS, ALARM_VIBRATION } from "@anv/core/domain/timerAlarm";

/**
 * Web side of the timer alarm: the shared beep pattern with Web Audio, looped
 * until stopped. Browsers only let a page make sound after a tap, so
 * `unlockAlarmAudio()` runs on the tap that starts a timer.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

function audioContext(): Ctx | null {
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  return ctx;
}

/** Call from a click/tap handler: creates or resumes the AudioContext so the alarm can play later. */
export function unlockAlarmAudio(): void {
  try {
    const c = audioContext();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    // A silent blip: Safari unlocks only after something actually played.
    const g = c.createGain();
    g.gain.value = 0;
    const o = c.createOscillator();
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch {
    // no audio here: banner, title and vibration still work
  }
}

function playPattern(c: Ctx) {
  let at = c.currentTime + 0.02;
  for (const { freq, ms } of ALARM_TONE) {
    const dur = ms / 1000;
    if (freq) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
      gain.gain.setValueAtTime(0.3, at + dur - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(at);
      osc.stop(at + dur + 0.01);
    }
    at += dur;
  }
}

function vibrate(pattern: number[] | number) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

/** Start ringing (sound only when `sound`; vibration either way). Loops until `stopAlarm()`. */
export function startAlarm(sound: boolean): void {
  stopAlarm();
  const once = () => {
    vibrate(ALARM_VIBRATION);
    if (!sound) return;
    try {
      const c = audioContext();
      if (!c) return;
      if (c.state === "suspended") void c.resume().catch(() => {});
      playPattern(c);
    } catch {
      // ignore: the banner is the fallback
    }
  };
  once();
  loop = setInterval(once, ALARM_TONE_MS);
}

export function stopAlarm(): void {
  if (loop) clearInterval(loop);
  loop = null;
  vibrate(0);
}

/** Ask for notification permission once (first timer start). Resolves to the resulting permission. */
export async function askNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** A system notification while the tab is hidden (permission granted). Clicking it focuses the tab. */
export function notifyHidden(title: string, body: string, tag: string): void {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") return;
    const n = new Notification(title, { body, tag, requireInteraction: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // some browsers allow notifications only from a service worker; the blinking title remains
  }
}

/** Blink `document.title` while the tab is hidden; returns a function that restores it. */
export function blinkTitle(text: string): () => void {
  const original = document.title;
  let on = false;
  const id = setInterval(() => {
    if (document.visibilityState === "visible") {
      document.title = original;
      on = false;
      return;
    }
    on = !on;
    document.title = on ? text : original;
  }, 1000);
  return () => {
    clearInterval(id);
    document.title = original;
  };
}
