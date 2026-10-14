"use client";

import { listJoin, t as tr } from "@anv/core/i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CookingSession, Recipe } from "@anv/core/data/models";
import { newTimer, remainingSeconds, ringingTimers, stepTimers, visibleTimers, type CookTarget } from "@anv/core/domain/cooking";
import { formatCountdown, formatTimerLength } from "@anv/core/domain/durations";
import { eveningLeftover } from "@anv/core/domain/leftovers";
import { now } from "@anv/core/lib/clock";
import { newId } from "@anv/core/lib/id";
import { dishInSentence } from "@anv/core/domain/prep";
import { useApp } from "@/store/app";
import { LeftoverChoices } from "../LeftoverChoices";
import { IconCheck, IconClock, IconClose, IconPlus } from "../icons";
import { Button, ButtonLink } from "../ui/Button";
import { TextField } from "../ui/Field";
import type { CookingExtras } from "./CookingMode";
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

/** Three soft beeps (Web Audio) + vibration where supported. */
function ring() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        const at = ctx.currentTime + i * 0.45;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.4);
      }
      setTimeout(() => void ctx.close().catch(() => {}), 2000);
    }
  } catch {
    // no audio: the banner and vibration still tell the cook
  }
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    // unsupported
  }
}

/** Timer buttons under a step ("Zamanlayıcı başlat · 20 dk"); a running one shows its countdown. */
function StepTimerButtons({ session, recipe, step }: { session: CookingSession; recipe: Recipe; step: number }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const found = stepTimers(recipe.steps[step]);
  const running = session.timers.filter((t) => t.recipeId === recipe.id && t.step === step && !t.dismissed);
  const t = useTick(running.length > 0);
  if (!found.length) return null;
  return (
    <div className={s.stepTimers}>
      {found.map((d) => {
        const r = running.find((x) => x.seconds === d.seconds);
        if (r) {
          const left = remainingSeconds(r, t);
          return (
            <span key={d.index} className={s.running}>
              <IconClock size={20} />
              {left > 0 ? tr("cook.left", { time: formatCountdown(left) }) : tr("cook.timeUp")}
            </span>
          );
        }
        return (
          <Button
            key={d.index}
            variant="soft"
            size="lg"
            className={s.startBtn}
            onClick={() => updateCooking(session.id, { timers: [...session.timers, newTimer({ id: newId(), recipe, step, seconds: d.seconds, now: now() })] })}
          >
            <IconClock size={20} />
            {tr("cook.startTimer", { length: formatTimerLength(d.seconds) })}
          </Button>
        );
      })}
    </div>
  );
}

/** Sticky list of timers (dish + time left), running across steps and dishes; finished ones ring and wait for "Tamam". */
function TimerBar({ session }: { session: CookingSession }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const active = session.timers.some((x) => !x.dismissed);
  const t = useTick(active);
  const rung = useRef<Set<string>>(new Set());
  const ringing = ringingTimers(session.timers, t);

  useEffect(() => {
    for (const r of ringing) {
      if (rung.current.has(r.id)) continue;
      rung.current.add(r.id);
      // Ring only for timers that just ended, not for old ones found after a reload.
      if (t.getTime() - Date.parse(r.endsAt) < 60_000) ring();
    }
  }, [ringing, t]);

  const list = visibleTimers(session.timers, t);
  const dismiss = (id: string) => updateCooking(session.id, { timers: session.timers.map((x) => (x.id === id ? { ...x, dismissed: true } : x)) });

  return (
    <>
      <div className={s.alerts} aria-live="assertive" role="alert" aria-label={tr("cook.timerAlerts")}>
        {ringing.map((r) => (
          <div key={r.id} className={s.alert}>
            <span>
              <strong>{tr("cook.timeUpFor")}</strong> {r.label}
            </span>
            <Button size="sm" onClick={() => dismiss(r.id)}>
              {tr("cook.ok")}
            </Button>
          </div>
        ))}
      </div>
      {list.length > 0 && (
        <section className={s.bar} aria-label={tr("cook.timers")}>
          <ul className={s.timers}>
            {list.map((x) => {
              const left = remainingSeconds(x, t);
              return (
                <li key={x.id} className={[s.timer, left === 0 && s.done].filter(Boolean).join(" ")}>
                  <span className={s.timerLabel}>{x.label.split(" · ")[0]}</span>
                  <span className={s.timerLeft} aria-label={left ? tr("cook.left", { time: formatCountdown(left) }) : tr("cook.timeUpLower")}>
                    {left ? formatCountdown(left) : tr("cook.done")}
                  </span>
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
