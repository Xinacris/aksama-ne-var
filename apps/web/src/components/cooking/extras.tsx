"use client";

import { listJoin, t as tr } from "@anv/core/i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CookingSession, CookingTimer, Recipe } from "@anv/core/data/models";
import { addTimerTime, isPaused, newTimer, otherTimers, pauseTimer, remainingSeconds, restartTimer, resumeTimer, stepTimerSlots, timerStepLabel, type CookTarget, type TimerSlot } from "@anv/core/domain/cooking";
import { dismissDue, dueTimers, initialAlarm, silenceAlarm, stepAlarm, type AlarmState } from "@anv/core/domain/timerAlarm";
import { formatCountdown, formatTimerLength } from "@anv/core/domain/durations";
import { eveningLeftover } from "@anv/core/domain/leftovers";
import { now } from "@anv/core/lib/clock";
import { newId } from "@anv/core/lib/id";
import { dishInSentence } from "@anv/core/domain/prep";
import { preferences } from "@/data/preferences";
import { useApp } from "@/store/app";
import { LeftoverChoices } from "../LeftoverChoices";
import { IconBell, IconCheck, IconClock, IconClose, IconPause, IconPlay, IconPlus, IconRestart } from "../icons";
import { Button, ButtonLink } from "../ui/Button";
import { TextField } from "../ui/Field";
import type { CookingExtras } from "./CookingMode";
import { askNotificationPermission, blinkTitle, notifyHidden, startAlarm, stopAlarm, unlockAlarmAudio } from "./alarm";
import s from "./extras.module.css";

/** Re-render every second while something is counting down. */
export function useTick(active: boolean): Date {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? t : now();
}

type WakeLockSentinelLike = { release(): Promise<void>; addEventListener?: (t: string, cb: () => void) => void };

/** Keep the screen on while cooking; re-acquired when the tab becomes visible again. Silently skipped where unsupported. */
export function useWakeLock() {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    let lock: WakeLockSentinelLike | null = null;
    let alive = true;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || lock) return;
      try {
        const l = await nav.wakeLock!.request("screen");
        if (!alive) {
          void l.release();
          return;
        }
        lock = l;
        l.addEventListener?.("release", () => {
          if (lock === l) lock = null;
        });
      } catch {
        // battery saver, permissions policy… cooking works without it
      }
    };
    const onVisible = () => void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
}

/** Timer buttons under a step ("Zamanlayıcı başlat · 20 dk"); a started one becomes its countdown with its controls, in place. */
function StepTimerButtons({ session, recipe, step, multi }: { session: CookingSession; recipe: Recipe; step: number; multi: boolean }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const setNotice = useApp((x) => x.setNotice);
  const slots = stepTimerSlots(session.timers, recipe, step);
  const t = useTick(slots.some((x) => x.timer));
  if (!slots.length) return null;
  const label = timerStepLabel({ recipeId: recipe.id, step }, recipe, multi);
  const change = (id: string, fn: (x: CookingTimer) => CookingTimer) => updateCooking(session.id, { timers: session.timers.map((x) => (x.id === id ? fn(x) : x)) });

  async function start(slot: TimerSlot) {
    // This tap is what lets the page make sound later.
    unlockAlarmAudio();
    await updateCooking(session.id, { timers: [...session.timers, newTimer({ id: newId(), recipe, step, seconds: slot.duration.seconds, now: now(), slot: slot.slot })] });
    const permission = await askNotificationPermission();
    if (permission === "denied" && preferences.takeAlarmHint()) setNotice({ kind: "info", text: tr("alarm.deniedWeb") });
  }

  return (
    <div className={s.stepTimers}>
      {slots.map((slot) => {
        if (!slot.timer) {
          return (
            <Button key={slot.slot} variant="soft" size="lg" className={s.startBtn} onClick={() => void start(slot)}>
              <IconClock size={20} />
              {tr("cook.startTimer", { length: formatTimerLength(slot.duration.seconds) })}
            </Button>
          );
        }
        const x = slot.timer;
        const left = remainingSeconds(x, t);
        const paused = isPaused(x);
        const done = left === 0 && !paused;
        return (
          <div key={slot.slot} className={[s.running, done && s.runningDone].filter(Boolean).join(" ")}>
            <span className={s.runningTime} aria-label={`${label}: ${spokenLeft(x, left)}`}>
              <IconClock size={20} />
              <span className={s.runningDigits}>{formatCountdown(left)}</span>
              <span className={s.runningWord}>{statusWord(x, left)}</span>
            </span>
            <span className={s.runningActions}>
              {done ? (
                <button type="button" className={s.action} onClick={() => change(x.id, (y) => restartTimer(y, now()))} aria-label={tr("cook.restartTimer", { label })}>
                  <IconRestart size={16} />
                  {tr("cook.restart")}
                </button>
              ) : (
                <button
                  type="button"
                  className={s.action}
                  onClick={() => change(x.id, (y) => (paused ? resumeTimer(y, now()) : pauseTimer(y, now())))}
                  aria-label={tr(paused ? "cook.resumeTimer" : "cook.pauseTimer", { label })}
                >
                  {paused ? <IconPlay size={16} /> : <IconPause size={16} />}
                  {paused ? tr("cook.resume") : tr("cook.pause")}
                </button>
              )}
              <button type="button" className={s.action} onClick={() => change(x.id, (y) => addTimerTime(y, 60, now()))} aria-label={tr("cook.addMinute", { label })}>
                {tr("cook.plusMinute")}
              </button>
              <button type="button" className={s.action} onClick={() => change(x.id, (y) => ({ ...y, dismissed: true }))} aria-label={tr("cook.closeTimer", { label })}>
                <IconClose size={16} />
                {tr("common.close")}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function statusWord(x: CookingTimer, left: number): string {
  if (isPaused(x)) return tr("cook.paused");
  if (left === 0) return tr("cook.timeUpLower");
  return tr("cook.leftWord");
}

function spokenLeft(x: CookingTimer, left: number): string {
  const time = formatCountdown(left);
  if (isPaused(x)) return tr("cook.pausedLeft", { time });
  if (left === 0) return tr("cook.timeUpLower");
  return tr("cook.left", { time });
}

/**
 * Rings when timers reach zero: the state comes from `endsAt` (core `stepAlarm`), so a timer that ended
 * while the tab was hidden rings on return, each finish once; old ones (>10 min) only show as finished.
 */
function useTimerAlarm(session: CookingSession, t: Date) {
  const [alarm, setAlarm] = useState<AlarmState>(initialAlarm);
  // Adjusting state while rendering (React's pattern for derived state): stepAlarm returns the same
  // object when nothing changed, so this settles in one extra render.
  const next = stepAlarm(alarm, session.timers, t);
  if (next !== alarm) setAlarm(next);
  const ringing = next.ringing.length > 0;
  const since = next.since;

  useEffect(() => {
    if (!ringing) return;
    startAlarm(preferences.getTimerSound());
    const names = listJoin(dueTimers(session.timers, now()).map((x) => x.label));
    notifyHidden(tr("alarm.notifTitle", { label: names }), tr("alarm.notifBody"), `anv-timer-${session.id}`);
    const restoreTitle = blinkTitle(tr("alarm.blink"));
    return () => {
      stopAlarm();
      restoreTitle();
    };
    // `since` changes when another timer joins the ringing: restart the sound and the notification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringing, since]);

  return { silence: () => setAlarm((a) => silenceAlarm(a)) };
}

/**
 * The "Süre doldu" banner with Durdur, and a compact strip of the timers not under the current
 * step ("Adım 2 · 0:20", tap to go there, × to close). No strip while only this step has timers.
 */
function TimerBar({ session, recipes, recipe, step }: { session: CookingSession; recipes: Recipe[]; recipe: Recipe; step: number }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const active = session.timers.some((x) => !x.dismissed);
  const t = useTick(active);
  const { silence } = useTimerAlarm(session, t);
  const due = dueTimers(session.timers, t);

  const list = otherTimers(session.timers, recipe, step, t);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const multi = recipes.length > 1;
  const dismiss = (id: string) => updateCooking(session.id, { timers: session.timers.map((x) => (x.id === id ? { ...x, dismissed: true } : x)) });
  const open = (x: CookingTimer) => {
    const i = recipes.findIndex((r) => r.id === x.recipeId);
    if (i >= 0) void updateCooking(session.id, { dishIndex: i, positions: { ...session.positions, [x.recipeId]: x.step } });
  };
  // Stop: silence here and mark the finished timers dismissed, which every tab/device sync reaches sees.
  const stop = () => {
    silence();
    void updateCooking(session.id, { timers: dismissDue(session.timers, now()) });
  };

  return (
    <>
      <div className={s.alerts} aria-live="assertive">
        {due.length > 0 && (
          <div className={s.alert} role="alert">
            <span className={s.alertText}>
              <IconBell size={22} />
              <strong>{tr("alarm.timeUp", { names: listJoin(due.map((x) => x.label)) })}</strong>
            </span>
            <Button size="lg" onClick={stop} aria-label={tr("alarm.stopLabel")} className={s.stopBtn}>
              {tr("alarm.stop")}
            </Button>
          </div>
        )}
      </div>
      {list.length > 0 && (
        <section className={s.bar} aria-label={tr("cook.otherTimers")}>
          <ul className={s.timers}>
            {list.map((x) => {
              const left = remainingSeconds(x, t);
              const paused = isPaused(x);
              const label = timerStepLabel(x, byId.get(x.recipeId), multi);
              return (
                <li key={x.id} className={[s.timer, left === 0 && !paused && s.done, paused && s.paused].filter(Boolean).join(" ")}>
                  <button type="button" className={s.timerOpen} onClick={() => open(x)} aria-label={`${label}: ${spokenLeft(x, left)}. ${tr("cook.goToStep")}`}>
                    <span className={s.timerLabel}>{label}</span>
                    <span className={s.timerLeft}>{left || paused ? formatCountdown(left) : tr("cook.done")}</span>
                  </button>
                  <button type="button" className={s.cancel} onClick={() => dismiss(x.id)} aria-label={tr("cook.closeTimer", { label })}>
                    <IconClose size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

/** "Afiyet olsun": tonight is cooked; the leftover question; quick add for what ran out. */
function FinishScreen({ session, target }: { session: CookingSession; target: CookTarget }) {
  const household = useApp((x) => x.household);
  const planItems = useApp((x) => x.planItems);
  const planDays = useApp((x) => x.planDays);
  const matches = useApp((x) => x.matches);
  const recipes = useApp((x) => x.recipes);
  const people = useApp((x) => x.people);
  const today = useApp((x) => x.today);
  const addManualItem = useApp((x) => x.addManualItem);
  const [item, setItem] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headRef.current?.focus(), []);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const ev =
    target.kind === "menu" && household
      ? eveningLeftover({ items: planItems, days: planDays, matches, recipesById: byId }, household, target.date, people.length, today)
      : null;
  const back = target.kind === "menu" ? (target.date === today ? "/bugun" : "/hafta") : `/tarif/${target.recipeId}`;

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = item.trim();
    if (!name) return;
    await addManualItem({ name, quantity: null, unit: null });
    setAdded((a) => [...a, name]);
    setItem("");
  }

  return (
    <div className={s.finish}>
      <span className={s.finishIcon} aria-hidden="true">
        <IconCheck size={30} strokeWidth={2.4} />
      </span>
      <h1 className={s.finishTitle} ref={headRef} tabIndex={-1}>
        {tr("cook.enjoy")}
      </h1>
      <p className={s.finishLead}>
        {target.kind === "menu" ? tr("cook.menuDone") : tr("cook.recipeDone")}
        {session.timers.length ? tr("cook.timersClosed") : ""}
      </p>

      {ev && (
        <section className={s.finishCard} aria-label={tr("cook.leftoverRegion")}>
          <LeftoverChoices ev={ev} when="tonight" title={tr("cook.leftoverQ", { dish: dishInSentence(ev.recipe.shortName ?? ev.recipe.name) })} />
        </section>
      )}

      <section className={s.finishCard} aria-labelledby="eksik">
        <p id="eksik" className={s.finishCardTitle}>
          {tr("cook.missingQ")}
        </p>
        <form onSubmit={add} className={s.addRow}>
          <TextField label={tr("cook.listItem")} hideLabel placeholder={tr("cook.listItemPlaceholder")} value={item} onChange={(e) => setItem(e.target.value)} />
          <Button type="submit" variant="soft" size="md">
            <IconPlus size={18} />
            {tr("cook.addToList")}
          </Button>
        </form>
        {added.length > 0 && (
          <p className={s.added} role="status">
            {tr("cook.added", { items: listJoin(added) })}
          </p>
        )}
      </section>

      <ButtonLink href={back} size="xl" block>
        {target.kind === "menu" && target.date === today ? tr("cook.backToday") : tr("cook.back")}
      </ButtonLink>
    </div>
  );
}

/** Wires timers, wake lock and the finish screen into `CookingMode`. */
export const cookingExtras: CookingExtras = {
  stepActions: ({ session, recipes, recipe, step }) => <StepTimerButtons session={session} recipe={recipe} step={step} multi={recipes.length > 1} />,
  bar: (args) => <TimerBar {...args} />,
  finish: (session, _recipes, target) => <FinishScreen session={session} target={target} />,
};
