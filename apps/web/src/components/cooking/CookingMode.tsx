"use client";

import { t as tr } from "@anv/core/i18n";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CookingSession, Recipe } from "@anv/core/data/models";
import { dishesToCook, mergedIngredients, missingForCooking, moveStep, overallProgress, parseCookTarget, stepOf, type CookTarget } from "@anv/core/domain/cooking";
import { menuFor, menuTitle } from "@anv/core/domain/plan";
import { offsetLabel } from "@anv/core/domain/prep";
import { recipeLabel } from "@anv/core/domain/shopping";
import { recipesMap, selectList, useApp, type AppState } from "@/store/app";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClose } from "../icons";
import { Button, ButtonLink } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/Misc";
import s from "./CookingMode.module.css";

export interface CookingExtras {
  /** Timer buttons for the current step (R8). */
  stepActions?: (args: { session: CookingSession; recipes: Recipe[]; recipe: Recipe; step: number }) => ReactNode;
  /** Above the step navigation: the alarm banner and the other steps' timers. */
  bar?: (args: { session: CookingSession; recipes: Recipe[]; recipe: Recipe; step: number }) => ReactNode;
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
    // Decided once, on opening: nothing missing → straight to step 1, no "Başlamadan önce".
    const nothingMissing = missingNow(useApp.getState(), dishes, target).count === 0;
    void startCooking(key, ids.split(","), { skipPrep: nothingMissing }).then((sess) => sess && setSessionId(sess.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dishes` is keyed by `ids`
  }, [key, ids, startCooking]);

  const session = sessions.find((c) => c.id === sessionId) ?? null;
  const exitHref = target.kind === "menu" ? (target.date === today ? "/bugun" : "/hafta") : `/tarif/${target.recipeId}`;
  const title =
    target.kind === "menu" ? menuTitle(menuFor(planItems, target.date), byId) : (byId.get(target.recipeId)?.name ?? tr("cook.recipe"));

  if (!dishes.length) {
    return (
      <main className={s.page}>
        <TopBar exitHref={exitHref} title={title} />
        <div className={s.empty}>
          <EmptyState
            title={tr("cook.noSteps")}
            text={target.kind === "menu" ? tr("cook.noStepsMenu") : tr("cook.noStepsRecipe")}
            actions={
              <ButtonLink href={exitHref} size="sm">
                {tr("cook.back")}
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
          {tr("cook.preparing")}
        </p>
      </main>
    );
  }

  const cooked = session.recipeIds.map((rid) => byId.get(rid)).filter((r): r is Recipe => !!r && r.steps.length > 0);
  const progress = overallProgress(session, cooked);

  return (
    <main className={s.page}>
      <TopBar exitHref={exitHref} title={title} progress={session.phase === "steps" ? tr("cook.progress", { step: progress.step, total: progress.total }) : undefined} />
      {session.phase === "prep" && <PrepScreen session={session} recipes={cooked} target={target} />}
      {session.phase === "steps" && <StepsScreen session={session} recipes={cooked} extras={extras} />}
      {session.phase === "done" &&
        (extras.finish ? (
          extras.finish(session, cooked, target)
        ) : (
          <div className={s.empty}>
            <EmptyState title={tr("cook.enjoy")} text={tr("cook.finished")} actions={<ButtonLink href={exitHref} size="sm">{tr("cook.back")}</ButtonLink>} />
          </div>
        ))}
    </main>
  );
}

function missingNow(st: AppState, recipes: Recipe[], target: CookTarget) {
  return missingForCooking({ recipes, rows: selectList(st), pantry: st.pantry, tasks: st.prepTasks, target, today: st.today });
}

function TopBar({ exitHref, title, progress }: { exitHref: string; title: string; progress?: string }) {
  return (
    <header className={s.top}>
      <Link href={exitHref} className={s.exit} aria-label={tr("cook.exit")}>
        <IconClose size={20} />
        <span>{tr("cook.exitShort")}</span>
      </Link>
      <span className={s.topTitle}>{title}</span>
      <span className={s.progress}>{progress ?? ""}</span>
    </header>
  );
}

/**
 * "Başlamadan önce": a heads-up, only when something is missing — prep-ahead
 * tasks not done, then ingredients neither bought nor "evde var". Nothing blocks
 * cooking: "Yine de başla" always works.
 */
function PrepScreen({ session, recipes, target }: { session: CookingSession; recipes: Recipe[]; target: CookTarget }) {
  const state = useApp();
  const updateCooking = useApp((x) => x.updateCooking);
  const completeTask = useApp((x) => x.completeTask);
  const markHave = useApp((x) => x.markHave);
  const addManualItem = useApp((x) => x.addManualItem);
  const missing = missingNow(state, recipes, target);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headRef.current?.focus(), []);

  return (
    <div className={s.body}>
      <div className={s.prepHead}>
        <h1 className={s.screenTitle} ref={headRef} tabIndex={-1}>
          {tr("cook.before")}
        </h1>
        <span className={s.muted} role="status">
          {missing.count ? tr("cook.missingCount", { count: missing.count }) : tr("cook.allSet")}
        </span>
      </div>

      {missing.prep.length > 0 && (
        <section className={s.reminders} aria-labelledby="pisir-hatirlat">
          <h2 id="pisir-hatirlat" className={s.smallTitle}>
            {tr("cook.prepAhead")}
          </h2>
          <ul className={s.reminderList}>
            {missing.prep.map((t) => (
              <li key={t.id} className={s.reminder}>
                <span>
                  <strong>{t.label}</strong>
                  <span className={s.muted}> · {offsetLabel(t.offset)}</span>
                </span>
                <button type="button" className={s.linkBtn} onClick={() => completeTask(t.id)}>
                  {tr(t.freezer ? "reminder.tookOut" : "reminder.done")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missing.ingredients.length > 0 && (
        <section aria-labelledby="pisir-eksik">
          <h2 id="pisir-eksik" className={s.smallTitle}>
            {tr("cook.missingIngredients")}
          </h2>
          <ul className={s.missingList} aria-label={tr("cook.missingIngredients")}>
            {missing.ingredients.map((r) => (
              <li key={r.key} className={s.missingRow}>
                <span className={s.checkText}>
                  <span className={s.checkName}>
                    {r.amount && <strong>{r.amount} </strong>}
                    {r.label}
                  </span>
                  <span className={s.muted}>{[recipes.length > 1 ? r.forDishes.join(", ") : null, r.onList ? tr("cook.onList") : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={s.missingActions}>
                  <Button variant="soft" size="sm" aria-label={tr("cook.haveIt", { name: r.label })} onClick={() => markHave(r.name)}>
                    {tr("cook.have")}
                  </Button>
                  {!r.onList && (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={tr("cook.addNamed", { name: r.label })}
                      onClick={() =>
                        addManualItem({ name: r.name, quantity: r.ingredient.quantity, unit: r.ingredient.unit, side: r.ingredient.side, aisle: r.ingredient.aisle, forRecipeId: r.recipeId })
                      }
                    >
                      {tr("cook.addToList")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missing.count === 0 && <p className={s.muted}>{tr("cook.nothingMissing")}</p>}

      <div className={s.nav}>
        <Button size="xl" block onClick={() => updateCooking(session.id, { phase: "steps" })}>
          {missing.count ? tr("cook.startAnyway") : tr("cook.start")}
        </Button>
      </div>
    </div>
  );
}

/** "Malzemeler" bottom sheet in the step view: the full merged list, amounts and dishes. */
function IngredientsSheet({ recipes }: { recipes: Recipe[] }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => mergedIngredients(recipes), [recipes]);
  return (
    <>
      <button type="button" className={s.ingBtn} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {tr("cook.ingredients")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} readOnly eyebrow={recipes.length > 1 ? tr("cook.wholeMenu") : recipeLabel(recipes[0])} title={tr("cook.ingredients")}>
        <ul className={s.sheetList}>
          {rows.map((r) => (
            <li key={r.key} className={s.sheetRow}>
              <span className={s.checkName}>
                {r.amount && <strong>{r.amount} </strong>}
                {r.label}
              </span>
              {recipes.length > 1 && <span className={s.muted}>{r.forDishes.join(", ")}</span>}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
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
      if (document.querySelector("dialog[open]")) return; // the Malzemeler sheet is on top
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
        <div className={s.tabs} role="tablist" aria-label={tr("cook.dishes")}>
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
          if ((e.target as HTMLElement).closest("button")) return;
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
        <div className={s.stepTools}>
          <IngredientsSheet recipes={recipes} />
        </div>
        <div key={`${recipe.id}-${step}`} className={[s.step, dir === "next" && s.fromRight, dir === "prev" && s.fromLeft].filter(Boolean).join(" ")}>
          <h1 className={s.stepEyebrow} ref={headRef} tabIndex={-1}>
            {recipes.length > 1 ? `${recipeLabel(recipe)} · ` : ""}
            {tr("cook.step", { n: step + 1, total: recipe.steps.length })}
          </h1>
          <p className={s.stepText}>{recipe.steps[step]}</p>
          {extras.stepActions?.({ session, recipes, recipe, step })}
        </div>
      </section>

      {extras.bar?.({ session, recipes, recipe, step })}

      <div className={s.nav}>
        <Button variant="secondary" size="xl" className={s.navBtn} onClick={() => go(-1)} disabled={step === 0}>
          <IconChevronLeft size={22} />
          {tr("cook.prev")}
        </Button>
        {!last ? (
          <Button size="xl" className={s.navBtn} onClick={() => go(1)}>
            {tr("cook.next")}
            <IconChevronRight size={22} />
          </Button>
        ) : nextDish >= 0 ? (
          <Button size="xl" className={s.navBtn} onClick={() => selectDish(nextDish)}>
            {recipeLabel(recipes[nextDish])}
            <IconChevronRight size={22} />
          </Button>
        ) : (
          <Button size="xl" className={s.navBtn} onClick={() => finishCooking(session.id)}>
            {tr("cook.done")}
            <IconCheck size={22} strokeWidth={2.4} />
          </Button>
        )}
      </div>
    </div>
  );
}
