"use client";

import type { LeftoverChoice } from "@anv/core/data/models";
import type { LeftoverOutcome } from "@anv/core/domain/leftovers";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SLOT_LABEL, type Match, type Recipe, type Slot } from "@anv/core/data/models";
import { addDays, dayName, eveningLabel, formatDuration } from "@anv/core/domain/dates";
import { SLOT_COURSES, courseToSlot } from "@anv/core/domain/matching";
import { menuFor } from "@anv/core/domain/plan";
import { recipeLabel } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { recipesMap, useApp } from "@/store/app";
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
  const recipes = useApp((x) => x.recipes);
  const today = useApp((x) => x.today);
  const addToPlan = useApp((x) => x.addToPlan);
  const [q, setQ] = useState("");
  const slot = target?.slot ?? null;
  const fits = (r: Recipe) => (slot ? SLOT_COURSES[slot].includes(r.course) : false);
  const results = useMemo(() => {
    const k = searchKey(q);
    const courses = slot ? SLOT_COURSES[slot] : [];
    return recipes
      .filter((r) => courses.includes(r.course) && (!k || searchKey(r.name).includes(k) || searchKey(r.shortName ?? "").includes(k)))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .slice(0, k ? 30 : 12);
  }, [recipes, q, slot]);

  async function pick(r: Recipe, match?: Match) {
    if (!target) return;
    await addToPlan({ date: target.date, slot: target.slot, recipeId: r.id, source: match ? "match" : "manual", matchId: match?.id });
    setQ("");
    onClose();
  }

  const m = matches.filter((x) => x.match.status !== "placed" && fits(x.recipe));
  const f = frequent.filter(fits);

  return (
    <Dialog open={!!target} onClose={onClose} eyebrow="Plana ekle" title={target ? slotTitle(target.date, target.slot, today) : ""}>
      {m.length > 0 && (
        <section className={s.section} aria-labelledby="pk-m">
          <h3 id="pk-m" className={s.sectionTitle}>
            Eşleşmelerden
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
            Sık yaptıklarınız
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
          Tüm tarifler
        </h3>
        <TextField label="Tarif ara" hideLabel type="search" placeholder="Tarif ara…" icon={<IconSearch size={18} />} value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length ? (
          <ul className={s.options}>
            {results.map((r) => (
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
        ) : (
          <p className={s.empty}>Bu isimde bir tarif yok. Tarifler sayfasından ekleyebilirsin.</p>
        )}
      </section>
    </Dialog>
  );
}

/** Choose an evening for a dish (tapping a match or a frequent dish). */
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
  const recipes = useApp((x) => x.recipes);
  const addToPlan = useApp((x) => x.addToPlan);
  const placeLeftover = useApp((x) => x.placeLeftover);
  const byId = recipesMap(recipes);
  const slot = target ? (courseToSlot(target.recipe.course) ?? (target.leftover ? "ana" : null)) : null;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => !target?.leftover || d <= target.leftover.useBy);

  async function pick(date: string) {
    if (!target || !slot) return;
    if (target.leftover) await placeLeftover({ fromDate: target.leftover.fromDate, recipeId: target.recipe.id, toDate: date, slot });
    else await addToPlan({ date, slot, recipeId: target.recipe.id, source: target.match ? "match" : "manual", matchId: target.match?.id });
    onClose();
  }

  return (
    <Dialog open={!!target} onClose={onClose} eyebrow={target?.leftover ? "Dolaptan · hangi akşam?" : "Hangi akşama?"} title={target ? target.recipe.name : ""}>
      {slot ? (
        <ul className={s.options}>
          {dates.map((d) => {
            const current = menuFor(planItems, d)[slot];
            const cur = current ? byId.get(current.recipeId) : null;
            return (
              <li key={d}>
                <button type="button" className={s.option} onClick={() => pick(d)}>
                  <span className={s.optionText}>
                    {d === today ? "Bu akşam" : dayName(d)}
                    <span className={s.optionSub}>
                      {cur ? `${SLOT_LABEL[slot]}: ${recipeLabel(cur)} yerine` : `${SLOT_LABEL[slot]} boş`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={s.empty}>Tatlılar akşam menüsüne slot olarak girmiyor; tarifini her zaman açabilirsin.</p>
      )}
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
    <Dialog open={!!target} onClose={onClose} eyebrow={target ? slotTitle(target.date, target.slot, today) : ""} title={target?.recipe?.name ?? "Silinmiş tarif"}>
      {target && (
        <ul className={s.options}>
          {target.recipe && (
            <li>
              <Link className={s.option} href={`/tarif/${target.recipe.id}?gun=${target.date}`} onClick={onClose}>
                Tarifi ve ön hazırlığı aç
              </Link>
            </li>
          )}
          <li>
            <button type="button" className={s.option} onClick={() => onReplace(target.date, target.slot)}>
              Başka yemekle değiştir
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
              Plandan çıkar
            </button>
          </li>
        </ul>
      )}
    </Dialog>
  );
}

const DAY_CHOICES: [LeftoverChoice | null, string][] = [
  [null, "Tarifteki gibi"],
  ["lunch", "Ertesi gün öğlen"],
  ["fridge", "Dolaba kalır"],
  ["none", "Artmaz"],
];

const OUTCOME_SHORT: Record<LeftoverOutcome["kind"], string> = {
  none: "artmaz",
  lunch: "ertesi gün öğlen",
  fridge: "dolaba kalır",
  discard: "kimse yemeyecek",
  eaten: "bitti",
};

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
    <Dialog open={!!target} onClose={onClose} eyebrow="Gün" title={target ? eveningLabel(target.date, today) : ""}>
      {target && (
        <ul className={s.options}>
          {target.ateOut ? (
            <li>
              <button type="button" className={s.option} onClick={run(() => clearAteOut(target.date))}>
                Dışarıda yemedik, geri al
              </button>
            </li>
          ) : (
            <>
              {target.filled > 0 && !target.approved && (
                <li>
                  <button type="button" className={s.option} onClick={run(() => approve(target.date))}>
                    Menüyü onayla
                  </button>
                </li>
              )}
              {target.leftover && (
                <li>
                  <div className={s.leftoverGroup} role="group" aria-label="Artarsa">
                    <span className={s.optionSub}>Artarsa · şu an: {OUTCOME_SHORT[target.leftover.kind]}</span>
                    <div className={s.leftoverChoices}>
                      {DAY_CHOICES.map(([choice, label]) => (
                        <button
                          key={label}
                          type="button"
                          className={s.choice}
                          aria-pressed={target.leftover!.choice === choice}
                          onClick={run(() => setLeftoverChoice(target.date, choice))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              )}
              <li>
                <button type="button" className={s.option} onClick={run(() => ateOut(target.date))}>
                  <span className={s.optionText}>
                    Dışarıda yedik
                    <span className={s.optionSub}>Ana yemek eşleşmelere döner, malzemeler listede kalır.</span>
                  </span>
                </button>
              </li>
              {target.filled > 0 && (
                <li>
                  <button type="button" className={`${s.option} ${s.danger}`} onClick={run(() => sendBack(target.date))}>
                    Bu akşamı boşalt
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
