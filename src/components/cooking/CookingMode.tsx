"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CookingSession, Recipe } from "@/data/models";
import { dishesToCook, mergedIngredients, moveStep, overallProgress, parseCookTarget, pendingPrep, stepOf, type CookTarget } from "@/domain/cooking";
import { menuFor, menuTitle } from "@/domain/plan";
import { offsetLabel } from "@/domain/prep";
import { recipeLabel } from "@/domain/shopping";
import { recipesMap, useApp } from "@/store/app";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClose } from "../icons";
import { Button, ButtonLink } from "../ui/Button";
import { EmptyState } from "../ui/Misc";
import s from "./CookingMode.module.css";

export interface CookingExtras {
  /** Timer buttons for the current step (R8). */
  stepActions?: (args: { session: CookingSession; recipe: Recipe; step: number }) => ReactNode;
  /** Sticky bar above the step navigation (running timers). */
  bar?: (session: CookingSession, recipes: Recipe[]) => ReactNode;
  /** "Afiyet olsun" screen. */
  finish?: (session: CookingSession, recipes: Recipe[], target: CookTarget) => ReactNode;
}

/** Full-screen cooking mode for one recipe or an evening's menu. */
export function CookingMode({ id, extras = {} }: { id: string; extras?: CookingExtras }) {
  const target = useMemo(() => parseCookTarget(id), [id]);
  const recipes = useApp((x) => x.recipes);
  const planItems = useApp((x) => x.planItems);
  const today = useApp((x) => x.today);
  const sessions = useApp((x) => x.cookingSessions);
  const startCooking = useApp((x) => x.startCooking);
  const byId = recipesMap(recipes);
  const dishes = useMemo(() => dishesToCook(target, planItems, byId), [target, planItems, byId]);
  const key = target.kind === "menu" ? target.date : target.recipeId;
  const ids = dishes.map((d) => d.id).join(",");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!ids || started.current === `${key}|${ids}`) return;
    started.current = `${key}|${ids}`;
    void startCooking(key, ids.split(",")).then((sess) => sess && setSessionId(sess.id));
  }, [key, ids, startCooking]);

  const session = sessions.find((c) => c.id === sessionId) ?? null;
  const exitHref = target.kind === "menu" ? (target.date === today ? "/bugun" : "/hafta") : `/tarif/${target.recipeId}`;
  const title =
    target.kind === "menu" ? menuTitle(menuFor(planItems, target.date), byId) : (byId.get(target.recipeId)?.name ?? "Tarif");

  if (!dishes.length) {
    return (
      <main className={s.page}>
        <TopBar exitHref={exitHref} title={title} />
        <div className={s.empty}>
          <EmptyState
            title="Pişirilecek adım yok"
            text={target.kind === "menu" ? "Bu akşamın menüsünde adımları olan bir tarif bulunmuyor." : "Bu tarifin henüz adımları yok. Ekledikten sonra pişirme modu açılır."}
            actions={
              <ButtonLink href={exitHref} size="sm">
                Geri dön
              </ButtonLink>
            }
          />
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={s.page}>
        <TopBar exitHref={exitHref} title={title} />
        <p className={s.loading} role="status">
          Mutfak hazırlanıyor…
        </p>
      </main>
    );
  }

  const cooked = session.recipeIds.map((rid) => byId.get(rid)).filter((r): r is Recipe => !!r && r.steps.length > 0);
  const progress = overallProgress(session, cooked);

  return (
    <main className={s.page}>
      <TopBar exitHref={exitHref} title={title} progress={session.phase === "steps" ? `adım ${progress.step}/${progress.total}` : undefined} />
      {session.phase === "prep" && <PrepScreen session={session} recipes={cooked} target={target} />}
      {session.phase === "steps" && <StepsScreen session={session} recipes={cooked} extras={extras} />}
      {session.phase === "done" &&
        (extras.finish ? (
          extras.finish(session, cooked, target)
        ) : (
          <div className={s.empty}>
            <EmptyState title="Afiyet olsun" text="Pişirme bitti." actions={<ButtonLink href={exitHref} size="sm">Geri dön</ButtonLink>} />
          </div>
        ))}
    </main>
  );
}

function TopBar({ exitHref, title, progress }: { exitHref: string; title: string; progress?: string }) {
  return (
    <header className={s.top}>
      <Link href={exitHref} className={s.exit} aria-label="Pişirme modundan çık">
        <IconClose size={20} />
        <span>Çık</span>
      </Link>
      <span className={s.topTitle}>{title}</span>
      <span className={s.progress}>{progress ?? ""}</span>
    </header>
  );
}

/** "Hazırlık": pending prep reminders on top, then every ingredient of the menu, tap to check. */
function PrepScreen({ session, recipes, target }: { session: CookingSession; recipes: Recipe[]; target: CookTarget }) {
  const prepTasks = useApp((x) => x.prepTasks);
  const today = useApp((x) => x.today);
  const updateCooking = useApp((x) => x.updateCooking);
  const completeTask = useApp((x) => x.completeTask);
  const rows = useMemo(() => mergedIngredients(recipes), [recipes]);
  const pending = pendingPrep(prepTasks, target, recipes.map((r) => r.id), today);
  const checked = new Set(session.checked);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headRef.current?.focus(), []);

  function toggle(key: string) {
    const next = checked.has(key) ? session.checked.filter((k) => k !== key) : [...session.checked, key];
    void updateCooking(session.id, { checked: next });
  }

  return (
    <div className={s.body}>
      <div className={s.prepHead}>
        <h1 className={s.screenTitle} ref={headRef} tabIndex={-1}>
          Hazırlık
        </h1>
        <span className={s.muted}>
          {checked.size}/{rows.length} hazır
        </span>
      </div>

      {pending.length > 0 && (
        <section className={s.reminders} aria-labelledby="pisir-hatirlat">
          <h2 id="pisir-hatirlat" className={s.smallTitle}>
            Önceden yapılacaklar
          </h2>
          <ul className={s.reminderList}>
            {pending.map((t) => (
              <li key={t.id} className={s.reminder}>
                <span>
                  <strong>{t.label}</strong>
                  <span className={s.muted}> · {offsetLabel(t.offset)}</span>
                </span>
                <button type="button" className={s.linkBtn} onClick={() => completeTask(t.id)}>
                  {t.freezer ? "Çıkardım" : "Yaptım"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className={s.checklist} aria-label="Malzemeler">
        {rows.map((r) => {
          const on = checked.has(r.key);
          return (
            <li key={r.key}>
              <button type="button" className={s.checkRow} aria-pressed={on} onClick={() => toggle(r.key)}>
                <span className={s.box} aria-hidden="true">
                  {on && <IconCheck size={18} strokeWidth={3} />}
                </span>
                <span className={s.checkText}>
                  <span className={s.checkName}>
                    {r.amount && <strong>{r.amount} </strong>}
                    {r.name}
                  </span>
                  {recipes.length > 1 && <span className={s.muted}>{r.forDishes.join(", ")}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={s.nav}>
        <Button size="xl" block onClick={() => updateCooking(session.id, { phase: "steps" })}>
          Pişirmeye başla
        </Button>
      </div>
    </div>
  );
}

/** One step per screen; dish tabs for menus, each dish keeping its own step. */
function StepsScreen({ session, recipes, extras }: { session: CookingSession; recipes: Recipe[]; extras: CookingExtras }) {
  const updateCooking = useApp((x) => x.updateCooking);
  const finishCooking = useApp((x) => x.finishCooking);
  const dishIndex = Math.min(session.dishIndex, recipes.length - 1);
  const recipe = recipes[dishIndex];
  const step = stepOf(session, recipe);
  const last = step === recipe.steps.length - 1;
  const nextDish = recipes.findIndex((r, i) => i !== dishIndex && stepOf(session, r) < r.steps.length - 1);
  const headRef = useRef<HTMLHeadingElement>(null);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Focus the step on every change so screen readers read it and keys keep working.
  useEffect(() => {
    headRef.current?.focus({ preventScroll: true });
  }, [recipe.id, step]);

  function go(delta: number) {
    if ((delta < 0 && step === 0) || (delta > 0 && last)) return;
    setDir(delta > 0 ? "next" : "prev");
    void updateCooking(session.id, { positions: moveStep(session.positions, recipe, delta) });
  }

  function selectDish(i: number) {
    if (i === dishIndex) return;
    setDir(null);
    void updateCooking(session.id, { dishIndex: i });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.getAttribute("role") === "tab")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={s.body}>
      {recipes.length > 1 && (
        <div className={s.tabs} role="tablist" aria-label="Yemekler">
          {recipes.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              id={`tab-${r.id}`}
              aria-selected={i === dishIndex}
              aria-controls="pisir-adim"
              tabIndex={i === dishIndex ? 0 : -1}
              className={s.tab}
              onClick={() => selectDish(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const n = (i + (e.key === "ArrowRight" ? 1 : -1) + recipes.length) % recipes.length;
                  selectDish(n);
                  document.getElementById(`tab-${recipes[n].id}`)?.focus();
                }
              }}
            >
              <span className={s.tabName}>{recipeLabel(r).replace(/ çorbası$/, "")}</span>
              <span className={s.tabStep}>
                {stepOf(session, r) + 1}/{r.steps.length}
              </span>
            </button>
          ))}
        </div>
      )}

      <section
        id="pisir-adim"
        role={recipes.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={recipes.length > 1 ? `tab-${recipe.id}` : undefined}
        className={s.stepArea}
        onPointerDown={(e) => {
          touch.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        <div key={`${recipe.id}-${step}`} className={[s.step, dir === "next" && s.fromRight, dir === "prev" && s.fromLeft].filter(Boolean).join(" ")}>
          <h1 className={s.stepEyebrow} ref={headRef} tabIndex={-1}>
            {recipes.length > 1 ? `${recipeLabel(recipe)} · ` : ""}Adım {step + 1} / {recipe.steps.length}
          </h1>
          <p className={s.stepText}>{recipe.steps[step]}</p>
          {extras.stepActions?.({ session, recipe, step })}
        </div>
      </section>

      {extras.bar?.(session, recipes)}

      <div className={s.nav}>
        <Button variant="secondary" size="xl" className={s.navBtn} onClick={() => go(-1)} disabled={step === 0}>
          <IconChevronLeft size={22} />
          Önceki
        </Button>
        {!last ? (
          <Button size="xl" className={s.navBtn} onClick={() => go(1)}>
            Sonraki
            <IconChevronRight size={22} />
          </Button>
        ) : nextDish >= 0 ? (
          <Button size="xl" className={s.navBtn} onClick={() => selectDish(nextDish)}>
            {recipeLabel(recipes[nextDish])}
            <IconChevronRight size={22} />
          </Button>
        ) : (
          <Button size="xl" className={s.navBtn} onClick={() => finishCooking(session.id)}>
            Bitti
            <IconCheck size={22} strokeWidth={2.4} />
          </Button>
        )}
      </div>
    </div>
  );
}
