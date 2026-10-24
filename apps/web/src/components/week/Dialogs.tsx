"use client";

import { labelRecord, t } from "@anv/core/i18n";
import type { LeftoverChoice } from "@anv/core/data/models";
import type { LeftoverOutcome } from "@anv/core/domain/leftovers";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SLOTS, SLOT_LABEL, type Match, type Recipe, type Slot } from "@anv/core/data/models";
import { addDays, dayName, eveningLabel, formatDuration } from "@anv/core/domain/dates";
import { dropMessage, slotForRecipe } from "@anv/core/domain/placement";
import { byPantryCoverage, pantryCoverage, pantryNames } from "@anv/core/domain/pantry";
import { menuFor } from "@anv/core/domain/plan";
import { recipeLabel } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { browsableRecipes, recipesMap, useApp } from "@/store/app";
import { IconSearch } from "../icons";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/Field";
import type { AsideMatch } from "./useWeek";
import s from "./Dialogs.module.css";

function slotTitle(date: string, slot: Slot, today: string) {
  return `${eveningLabel(date, today)} · ${SLOT_LABEL[slot]}`;
}

/** Choose a dish for a day's slot: matches, frequent dishes, or search. */
export function RecipePicker({
  target,
  onClose,
  matches,
  frequent,
}: {
  target: { date: string; slot: Slot } | null;
  onClose: () => void;
  matches: AsideMatch[];
  frequent: Recipe[];
}) {
  const recipes = useApp(browsableRecipes);
  const today = useApp((x) => x.today);
  const dropOnDay = useApp((x) => x.dropOnDay);
  const setNotice = useApp((x) => x.setNotice);
  const [q, setQ] = useState("");
  const slot = target?.slot ?? null;
  // Category-locked: only dishes of this slot, plus ones without a category (picking one answers it).
  const fits = (r: Recipe) => {
    const own = slotForRecipe(r);
    return !!slot && (own === slot || own === null);
  };
  const pantry = useApp((x) => x.pantry);
  const have = useMemo(() => pantryNames(pantry), [pantry]);
  const results = useMemo(() => {
    const k = searchKey(q);
    const fitting = recipes
      .filter((r) => {
        const own = slotForRecipe(r);
        return !!slot && (own === slot || own === null) && (!k || searchKey(r.name).includes(k) || searchKey(r.shortName ?? "").includes(k));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    // Dishes you can make with what's at home first.
    return byPantryCoverage(fitting, have).slice(0, k ? 30 : 12);
  }, [recipes, q, slot, have]);
  const sub = (r: Recipe) => {
    const c = pantryCoverage(r, have);
    const time = r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes);
    return have.size && c.have ? `${time} · ${t("pantry.coverage", { have: c.have, total: c.total })}` : time;
  };

  async function pick(r: Recipe, match?: Match) {
    if (!target) return;
    const res = await dropOnDay({ date: target.date, recipeId: r.id, origin: match ? "match" : "recipe", matchId: match?.id, slot: target.slot });
    setNotice({ kind: "info", text: dropMessage(res, { name: r.name, date: target.date, recipesById: recipesMap(recipes) }) });
    setQ("");
    onClose();
  }

  const m = matches.filter((x) => x.match.status !== "placed" && fits(x.recipe));
  const f = frequent.filter(fits);

  return (
    <Dialog open={!!target} onClose={onClose} eyebrow={t("dlg.addToPlan")} title={target ? slotTitle(target.date, target.slot, today) : ""}>
      {m.length > 0 && (
        <section className={s.section} aria-labelledby="pk-m">
          <h3 id="pk-m" className={s.sectionTitle}>
            {t("week.fromMatches")}
          </h3>
          <ul className={s.options}>
            {m.map((x) => (
              <li key={x.match.id}>
                <button type="button" className={s.option} onClick={() => pick(x.recipe, x.match)}>
                  <span className={s.optionText}>
                    {x.recipe.name}
                    <span className={s.optionSub}>{x.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {f.length > 0 && (
        <section className={s.section} aria-labelledby="pk-f">
          <h3 id="pk-f" className={s.sectionTitle}>
            {t("week.frequent")}
          </h3>
          <ul className={s.options}>
            {f.map((r) => (
              <li key={r.id}>
                <button type="button" className={s.option} onClick={() => pick(r)}>
                  <span className={s.optionText}>
                    {r.name}
                    <span className={s.optionSub}>{r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className={s.section} aria-labelledby="pk-a">
        <h3 id="pk-a" className={s.sectionTitle}>
          {t("dlg.allRecipes")}
        </h3>
        <TextField label={t("dlg.searchRecipe")} hideLabel type="search" placeholder={t("dlg.searchRecipeDots")} icon={<IconSearch size={18} />} value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length ? (
          <ul className={s.options}>
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" className={s.option} onClick={() => pick(r)}>
                  <span className={s.optionText}>
                    {r.name}
                    <span className={s.optionSub}>{sub(r)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{t("dlg.noSuchRecipe")}</p>
        )}
      </section>
    </Dialog>
  );
}

/** The five slots, for a recipe without a category ("which slot?", asked once). */
export function SlotChoices({ onPick }: { onPick: (slot: Slot) => void }) {
  return (
    <ul className={s.options}>
      {SLOTS.map((sl) => (
        <li key={sl}>
          <button type="button" className={s.option} onClick={() => onPick(sl)}>
            {SLOT_LABEL[sl]}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Hangi bölüme girsin?" after dropping a recipe without a category on the board. */
export function SlotAskDialog({ target, onPick, onClose }: { target: { name: string } | null; onPick: (slot: Slot) => void; onClose: () => void }) {
  return (
    <Dialog open={!!target} onClose={onClose} eyebrow={t("board.askSlot")} title={target ? t("place.askTitle", { name: target.name }) : ""}>
      <p className={s.empty}>{t("place.askText")}</p>
      <SlotChoices onPick={onPick} />
    </Dialog>
  );
}

/** "Güne ekle": choose a day for a dish (a match, a frequent dish, any recipe). It goes into its own slot. */
export function DayPicker({
  target,
  onClose,
}: {
  /** `leftover`: a dolapta dish — only evenings until its use-by day; the list skips its ingredients. */
  target: { recipe: Recipe; match?: Match; leftover?: { fromDate: string; useBy: string } } | null;
  onClose: () => void;
}) {
  const today = useApp((x) => x.today);
  const planItems = useApp((x) => x.planItems);
  const recipes = useApp(browsableRecipes);
  const dropOnDay = useApp((x) => x.dropOnDay);
  const placeLeftover = useApp((x) => x.placeLeftover);
  const setNotice = useApp((x) => x.setNotice);
  const [chosen, setChosen] = useState<{ id: string; slot: Slot } | null>(null);
  const byId = recipesMap(recipes);
  const own = target ? slotForRecipe(target.recipe) : null;
  const answer = chosen && target && chosen.id === target.recipe.id ? chosen.slot : null;
  const slot = target?.leftover ? (own ?? "ana") : (own ?? answer);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => !target?.leftover || d <= target.leftover.useBy);
  const close = () => {
    setChosen(null);
    onClose();
  };

  async function pick(date: string) {
    if (!target || !slot) return;
    if (target.leftover) await placeLeftover({ fromDate: target.leftover.fromDate, recipeId: target.recipe.id, toDate: date, slot });
    else {
      const res = await dropOnDay({ date, recipeId: target.recipe.id, origin: target.match ? "match" : "recipe", matchId: target.match?.id, slot: own ? undefined : slot });
      setNotice({ kind: "info", text: dropMessage(res, { name: target.recipe.name, date, recipesById: byId }) });
    }
    close();
  }

  return (
    <Dialog
      open={!!target}
      onClose={close}
      eyebrow={target?.leftover ? t("dlg.fromFridgeWhen") : slot ? t("place.whichDay") : t("board.askSlot")}
      title={target ? (slot ? target.recipe.name : t("place.askTitle", { name: target.recipe.name })) : ""}
    >
      {target && !slot ? (
        <>
          <p className={s.empty}>{t("place.askText")}</p>
          <SlotChoices onPick={(sl) => setChosen({ id: target.recipe.id, slot: sl })} />
        </>
      ) : slot ? (
        <ul className={s.options}>
          {dates.map((d) => {
            const menu = menuFor(planItems, d);
            const current = menu[slot];
            const cur = current ? byId.get(current.recipeId) : null;
            const here = target ? current?.recipeId === target.recipe.id || planItems.some((i) => i.date === d && i.recipeId === target.recipe.id) : false;
            return (
              <li key={d}>
                <button type="button" className={s.option} onClick={() => pick(d)}>
                  <span className={s.optionText}>
                    {d === today ? t("dlg.tonight") : dayName(d)}
                    <span className={s.optionSub}>
                      {here
                        ? t("place.onDay", { name: target!.recipe.name, day: dayName(d) })
                        : cur
                          ? t("dlg.instead", { slot: SLOT_LABEL[slot], dish: recipeLabel(cur) })
                          : t("dlg.empty", { slot: SLOT_LABEL[slot] })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Dialog>
  );
}

/** Actions for a planned dish: open, replace, remove. */
export function SlotDialog({
  target,
  onClose,
  onReplace,
}: {
  target: { itemId: string; date: string; slot: Slot; recipe: Recipe | null } | null;
  onClose: () => void;
  onReplace: (date: string, slot: Slot) => void;
}) {
  const today = useApp((x) => x.today);
  const removeFromPlan = useApp((x) => x.removeFromPlan);
  return (
    <Dialog open={!!target} onClose={onClose} eyebrow={target ? slotTitle(target.date, target.slot, today) : ""} title={target?.recipe?.name ?? t("plan.deletedRecipe")}>
      {target && (
        <ul className={s.options}>
          {target.recipe && (
            <li>
              <Link className={s.option} href={`/tarif/${target.recipe.id}?gun=${target.date}`} onClick={onClose}>
                {t("dlg.openRecipe")}
              </Link>
            </li>
          )}
          <li>
            <button type="button" className={s.option} onClick={() => onReplace(target.date, target.slot)}>
              {t("dlg.replace")}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`${s.option} ${s.danger}`}
              onClick={async () => {
                await removeFromPlan(target.itemId);
                onClose();
              }}
            >
              {t("dlg.remove")}
            </button>
          </li>
        </ul>
      )}
    </Dialog>
  );
}

const DAY_CHOICES: [LeftoverChoice | null, string][] = [
  [null, "dlg.asRecipe"],
  ["lunch", "dlg.lunchNext"],
  ["fridge", "dlg.toFridge"],
  ["none", "dlg.noLeftovers"],
];

const OUTCOME_SHORT = labelRecord<LeftoverOutcome["kind"]>("dlg.out", ["none", "lunch", "fridge", "discard", "eaten"]);

/** Day-level actions: approve, leftovers, eaten out, clear. */
export function DayDialog({
  target,
  onClose,
}: {
  target: {
    date: string;
    hasMain: boolean;
    leftover: { choice: LeftoverChoice | null; kind: LeftoverOutcome["kind"] } | null;
    ateOut: boolean;
    approved: boolean;
    filled: number;
  } | null;
  onClose: () => void;
}) {
  const today = useApp((x) => x.today);
  const approve = useApp((x) => x.approve);
  const setLeftoverChoice = useApp((x) => x.setLeftoverChoice);
  const ateOut = useApp((x) => x.ateOut);
  const clearAteOut = useApp((x) => x.clearAteOut);
  const sendBack = useApp((x) => x.sendBackToMatches);
  const run = (fn: () => Promise<void>) => async () => {
    await fn();
    onClose();
  };
  return (
    <Dialog open={!!target} onClose={onClose} eyebrow={t("dlg.day")} title={target ? eveningLabel(target.date, today) : ""}>
      {target && (
        <ul className={s.options}>
          {target.ateOut ? (
            <li>
              <button type="button" className={s.option} onClick={run(() => clearAteOut(target.date))}>
                {t("dlg.undoAteOut")}
              </button>
            </li>
          ) : (
            <>
              {target.filled > 0 && !target.approved && (
                <li>
                  <button type="button" className={s.option} onClick={run(() => approve(target.date))}>
                    {t("dlg.approve")}
                  </button>
                </li>
              )}
              {target.leftover && (
                <li>
                  <div className={s.leftoverGroup} role="group" aria-label={t("dlg.ifLeftover")}>
                    <span className={s.optionSub}>{t("dlg.ifLeftoverNow", { now: OUTCOME_SHORT[target.leftover.kind] })}</span>
                    <div className={s.leftoverChoices}>
                      {DAY_CHOICES.map(([choice, label]) => (
                        <button
                          key={label}
                          type="button"
                          className={s.choice}
                          aria-pressed={target.leftover!.choice === choice}
                          onClick={run(() => setLeftoverChoice(target.date, choice))}
                        >
                          {t(label)}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              )}
              <li>
                <button type="button" className={s.option} onClick={run(() => ateOut(target.date))}>
                  <span className={s.optionText}>
                    {t("dlg.ateOut")}
                    <span className={s.optionSub}>{t("dlg.ateOutSub")}</span>
                  </span>
                </button>
              </li>
              {target.filled > 0 && (
                <li>
                  <button type="button" className={`${s.option} ${s.danger}`} onClick={run(() => sendBack(target.date))}>
                    {t("dlg.clear")}
                  </button>
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </Dialog>
  );
}
