import { intlTag, t } from "@anv/core/i18n";
import type { ReactNode } from "react";
import type { Match, Recipe } from "@anv/core/data/models";
import { ablativeSuffix, dative } from "@anv/core/lib/text";
import { dayName } from "@anv/core/domain/dates";
import { rotationShort } from "@anv/core/domain/rotation";
import { IconCheck, IconGrip } from "./icons";
import s from "./MatchList.module.css";

export interface MatchView {
  match: Match;
  recipe: Recipe;
  note: string;
}

/** "Salı'ya kondu", "Cumartesiden geri döndü", "En son 2 ay önce". */
export function matchNote(m: Match, daysSince: number | null): string {
  if (m.status === "placed" && m.placedDate) {
    const day = dayName(m.placedDate);
    return t("match.placedOn", { day, dayDat: dative(day) });
  }
  if (m.status === "returned" && m.returnedFrom) {
    const day = dayName(m.returnedFrom);
    return t("match.returnedFrom", { day, dayAbl: `${day}${ablativeSuffix(day)}` });
  }
  const r = rotationShort(daysSince);
  return r.charAt(0).toLocaleUpperCase(intlTag()) + r.slice(1);
}

export function MatchList({
  items,
  renderItem,
  empty = t("match.empty"),
}: {
  items: MatchView[];
  renderItem?: (v: MatchView, defaultContent: ReactNode) => ReactNode;
  empty?: string;
}) {
  if (!items.length) return <p className={s.empty}>{empty}</p>;
  return (
    <ul className={s.list}>
      {items.map((v) => {
        const placed = v.match.status === "placed";
        const content = (
          <>
            <span className={s.icon}>{placed ? <IconCheck size={16} strokeWidth={2.2} /> : <IconGrip size={16} strokeWidth={3} />}</span>
            <span className={s.texts}>
              <span className={s.name}>{v.recipe.name}</span>
              <span className={s.note}>{v.note}</span>
            </span>
          </>
        );
        return (
          <li key={v.match.id} className={[s.item, placed && s.placed].filter(Boolean).join(" ")}>
            {renderItem ? renderItem(v, content) : content}
          </li>
        );
      })}
    </ul>
  );
}

export const matchListStyles = s;
