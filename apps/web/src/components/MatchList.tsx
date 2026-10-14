import { t } from "@anv/core/i18n";
import type { ReactNode } from "react";
import type { Match, Recipe } from "@anv/core/data/models";
import { IconCheck, IconGrip } from "./icons";
import s from "./MatchList.module.css";

export interface MatchView {
  match: Match;
  recipe: Recipe;
  note: string;
}

export { matchNote } from "@anv/core/domain/week";

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
