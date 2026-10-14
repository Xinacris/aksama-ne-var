"use client";

import { t } from "@anv/core/i18n";
import { useState } from "react";
import type { LeftoverChoice } from "@anv/core/data/models";
import { addDays } from "@anv/core/domain/dates";
import { CHOICE_LABEL, eatsLunchAtHome, keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { usePeople } from "@/hooks/usePeople";
import { useApp } from "@/store/app";
import s from "./LeftoverChoices.module.css";

/** Which button reads as selected: the explicit choice, or what the defaults resolve to. */
function current(ev: EveningLeftover): LeftoverChoice | null {
  if (ev.choice) return ev.choice;
  const k = ev.outcome.kind;
  return k === "fridge" || k === "lunch" || k === "none" ? k : null;
}

/**
 * "Hiç kalmadı · Yarın öğlen · Dolaba kaldır · Kimse yemeyecek" — one tap,
 * with undo, synced like every other write. `when` is "tonight" (tonight's
 * menu after cooking, finish screen) or "yesterday" (Bugün's lunch card).
 */
export function LeftoverChoices({ ev, when, title = t("leftovers.title") }: { ev: EveningLeftover; when: "tonight" | "yesterday"; title?: string }) {
  const household = useApp((x) => x.household);
  const today = useApp((x) => x.today);
  const setLeftoverChoice = useApp((x) => x.setLeftoverChoice);
  const { byId } = usePeople();
  const [undo, setUndo] = useState<{ prev: LeftoverChoice | null } | null>(null);
  const lunchDate = addDays(ev.fromDate, 1);
  const lunchPossible = !household || eatsLunchAtHome(household, lunchDate);
  const options: LeftoverChoice[] = ["none", ...(lunchPossible ? (["lunch"] as const) : []), "fridge", "discard"];
  const pressed = current(ev);

  async function choose(c: LeftoverChoice) {
    setUndo({ prev: ev.choice });
    await setLeftoverChoice(ev.fromDate, c);
  }

  const by = ev.choiceBy ? byId.get(ev.choiceBy) : undefined;
  const outcome =
    ev.outcome.kind === "fridge"
      ? t("leftovers.inFridge", { until: keepUntilLabel(ev.outcome.useBy, today) })
      : ev.outcome.kind === "lunch"
        ? ev.outcome.date === today
          ? t("leftovers.lunchToday")
          : t("leftovers.lunchTomorrow")
        : ev.outcome.kind === "discard"
          ? t("leftovers.nobody")
          : t("leftovers.noneLeft");

  return (
    <div className={s.wrap}>
      <div className={s.group} role="group" aria-label={title}>
        <span className={s.title}>{title}</span>
        <div className={s.choices}>
          {options.map((c) => (
            <button key={c} type="button" className={s.choice} aria-pressed={pressed === c} onClick={() => choose(c)}>
              {c === "lunch" && when === "yesterday" ? t("leftovers.lunchTodayChoice") : CHOICE_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <p className={s.status} role="status">
        {outcome}
        {by ? t("leftovers.chosenBy", { name: by.name }) : ev.choice === null ? t("leftovers.asRecipe") : ""}
        {undo && (
          <>
            {" · "}
            <button
              type="button"
              className={s.undo}
              onClick={async () => {
                const prev = undo.prev;
                setUndo(null);
                await setLeftoverChoice(ev.fromDate, prev);
              }}
            >
              {t("common.undo")}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
