"use client";

import { listJoin, t as tr } from "@anv/core/i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CookingSession, CookingTimer, Recipe } from "@anv/core/data/models";
import { addTimerTime, isPaused, newTimer, pauseTimer, remainingSeconds, restartTimer, resumeTimer, stepTimers, visibleTimers, type CookTarget } from "@anv/core/domain/cooking";
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

/** Timer buttons under a step ("Zamanlayıcı başlat · 20 dk"); a running one shows its countdown. */
function StepTimerButtons({ session, recipe, step }: { session: CookingSession; recipe: Recipe; step: number }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const setNotice = useApp((x) => x.setNotice);
  const found = stepTimers(recipe.steps[step]);
  const running = session.timers.filter((t) => t.recipeId === recipe.id && t.step === step && !t.dismissed);
  const t = useTick(running.length > 0);
  if (!found.length) return null;

  async function start(seconds: number) {
    // This tap is what lets the page make sound later.
    unlockAlarmAudio();
    await updateCooking(session.id, { timers: [...session.timers, newTimer({ id: newId(), recipe, step, seconds, now: now() })] });
    const permission = await askNotificationPermission();
    if (permission === "denied" && preferences.takeAlarmHint()) setNotice({ kind: "info", text: tr("alarm.deniedWeb") });
  }

  return (
    <div className={s.stepTimers}>
      {found.map((d) => {
        const r = running.find((x) => x.seconds === d.seconds);
        if (r) {
          const left = remainingSeconds(r, t);
          return (
            <span key={d.index} className={s.running}>
              <IconClock size={20} />
              {isPaused(r) ? tr("cook.pausedLeft", { time: formatCountdown(left) }) : left > 0 ? tr("cook.left", { time: formatCountdown(left) }) : tr("cook.timeUp")}
            </span>
          );
        }
        return (
          <Button key={d.index} variant="soft" size="lg" className={s.startBtn} onClick={() => void start(d.seconds)}>
            <IconClock size={20} />
            {tr("cook.startTimer", { length: formatTimerLength(d.seconds) })}
          </Button>
        );
      })}
    </div>
  );
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

/** Sticky list of timers (dish + time left, pause / +1 dk / restart / close) and the "Süre doldu" banner with Durdur. */
function TimerBar({ session }: { session: CookingSession }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const active = session.timers.some((x) => !x.dismissed);
  const t = useTick(active);
  const { silence } = useTimerAlarm(session, t);
  const due = dueTimers(session.timers, t);

  const list = visibleTimers(session.timers, t);
  const change = (id: string, fn: (x: CookingTimer) => CookingTimer) => updateCooking(session.id, { timers: session.timers.map((x) => (x.id === id ? fn(x) : x)) });
  const dismiss = (id: string) => change(id, (x) => ({ ...x, dismissed: true }));
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
        <section className={s.bar} aria-label={tr("cook.timers")}>
          <ul className={s.timers}>
            {list.map((x) => {
              const left = remainingSeconds(x, t);
              const paused = isPaused(x);
              return (
                <li key={x.id} className={[s.timer, left === 0 && !paused && s.done, paused && s.paused].filter(Boolean).join(" ")}>
                  <span className={s.timerLabel}>{x.label.split(" · ")[0]}</span>
                  <span
                    className={s.timerLeft}
                    aria-label={paused ? tr("cook.pausedLeft", { time: formatCountdown(left) }) : left ? tr("cook.left", { time: formatCountdown(left) }) : tr("cook.timeUpLower")}
                  >
                    {left || paused ? formatCountdown(left) : tr("cook.done")}
                  </span>
                  {left > 0 && (
                    <button
                      type="button"
                      className={s.cancel}
                      onClick={() => change(x.id, (y) => (paused ? resumeTimer(y, now()) : pauseTimer(y, now())))}
                      aria-label={tr(paused ? "cook.resumeTimer" : "cook.pauseTimer", { label: x.label })}
                    >
                      {paused ? <IconPlay size={16} /> : <IconPause size={16} />}
                    </button>
                  )}
                  <button type="button" className={s.plus} onClick={() => change(x.id, (y) => addTimerTime(y, 60, now()))} aria-label={tr("cook.addMinute", { label: x.label })}>
                    {tr("cook.plusMinute")}
                  </button>
                  <button type="button" className={s.cancel} onClick={() => change(x.id, (y) => restartTimer(y, now()))} aria-label={tr("cook.restartTimer", { label: x.label })}>
                    <IconRestart size={16} />
                  </button>
                  <button type="button" className={s.cancel} onClick={() => dismiss(x.id)} aria-label={tr("cook.closeTimer", { label: x.label })}>
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
  stepActions: (args) => <StepTimerButtons {...args} />,
  bar: (session) => <TimerBar session={session} />,
  finish: (session, _recipes, target) => <FinishScreen session={session} target={target} />,
};
