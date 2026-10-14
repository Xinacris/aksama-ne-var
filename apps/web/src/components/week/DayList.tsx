"use client";

import { intlTag, t } from "@anv/core/i18n";
import { SLOTS, SLOT_LABEL, type Match, type Recipe, type Slot } from "@anv/core/data/models";
import { dayName } from "@anv/core/domain/dates";
import { recipeLabel } from "@anv/core/domain/shopping";
import { usePeople } from "@/hooks/usePeople";
import { IconCheck, IconCutlery, IconGrip, IconHeart, IconMore, IconPlus, IconSnowflakeSmall } from "../icons";
import { matchListStyles } from "../MatchList";
import { Avatar, AvatarStack } from "../ui/Avatar";
import { DishTag } from "../ui/Chip";
import type { BoardHandlers } from "./Board";
import type { AsideMatch, DayModel } from "./useWeek";
import { keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { useApp } from "@/store/app";
import s from "./DayList.module.css";

/** Mobile equivalent of the board: one stacked card per evening, tap to add or change. */
export function DayList({
  days,
  matches,
  frequent,
  fridge,
  handlers,
  onPlace,
  onPlaceLeftover,
}: {
  days: DayModel[];
  matches: AsideMatch[];
  frequent: Recipe[];
  fridge: EveningLeftover[];
  handlers: BoardHandlers;
  onPlace: (recipe: Recipe, match?: Match) => void;
  onPlaceLeftover: (ev: EveningLeftover) => void;
}) {
  const today = useApp((x) => x.today);
  return (
    <>
      <div className={s.list}>
        {days.map((d) => (
          <DayCard key={d.date} day={d} handlers={handlers} />
        ))}
      </div>
      <section className={s.panel} aria-labelledby="m-eslesmeler">
        <h2 id="m-eslesmeler" className={s.panelTitle}>
          {t("week.fromMatches")}
        </h2>
        {matches.length ? (
          <ul className={matchListStyles.list}>
            {matches.map((m) => (
              <li key={m.match.id} className={[matchListStyles.item, m.match.status === "placed" && matchListStyles.placed].filter(Boolean).join(" ")}>
                {m.match.status === "placed" ? (
                  <>
                    <span className={matchListStyles.icon}>
                      <IconCheck size={16} strokeWidth={2.2} />
                    </span>
                    <span className={matchListStyles.texts}>
                      <span className={matchListStyles.name}>{m.recipe.name}</span>
                      <span className={matchListStyles.note}>{m.note}</span>
                    </span>
                  </>
                ) : (
                  <button type="button" className={s.matchBtn} onClick={() => onPlace(m.recipe, m.match)} aria-label={t("week.putOnEvening", { name: m.recipe.name, note: m.note })}>
                    <span className={matchListStyles.icon}>
                      <IconGrip size={16} strokeWidth={3} />
                    </span>
                    <span className={matchListStyles.texts}>
                      <span className={matchListStyles.name}>{m.recipe.name}</span>
                      <span className={matchListStyles.note}>{m.note}</span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.hint}>{t("match.empty")}</p>
        )}
      </section>
      {fridge.length > 0 && (
        <section className={s.panel} aria-labelledby="m-dolap">
          <h2 id="m-dolap" className={s.panelTitle}>
            {t("week.inFridge")}
          </h2>
          <div className={s.chips}>
            {fridge.map((f) => (
              <button
                key={f.fromDate}
                type="button"
                className={s.chipBtn}
                onClick={() => onPlaceLeftover(f)}
                aria-label={t("week.fridgePut", { name: f.recipe.name })}
              >
                <DishTag variant="leftover">
                  {recipeLabel(f.recipe)}
                  {f.outcome.kind === "fridge" ? ` · ${keepUntilLabel(f.outcome.useBy, today).toLocaleLowerCase(intlTag())}` : ""}
                </DishTag>
              </button>
            ))}
          </div>
          <p className={s.hint}>{t("week.fridgeHint")}</p>
        </section>
      )}
      <section className={s.panel} aria-labelledby="m-sik">
        <h2 id="m-sik" className={s.panelTitle}>
          {t("week.frequent")}
        </h2>
        <div className={s.chips}>
          {frequent.map((r) => (
            <button key={r.id} type="button" className={s.chipBtn} onClick={() => onPlace(r)} aria-label={t("week.putRecipe", { name: r.name })}>
              <DishTag variant="draggable">{recipeLabel(r)}</DishTag>
            </button>
          ))}
        </div>
        <p className={s.hint}>{t("week.tapToPlace")}</p>
      </section>
    </>
  );
}

function DayCard({ day, handlers }: { day: DayModel; handlers: BoardHandlers }) {
  const { people, byId } = usePeople();
  const full = dayName(day.date);
  const cls = [s.day, day.isToday && s.today, day.isPast && s.past, day.filled === 0 && !day.ateOut && s.empty, day.ateOut && s.ate]
    .filter(Boolean)
    .join(" ");
  return (
    <article className={cls} aria-label={`${full}, ${day.dayMonth}`}>
      <div className={s.head}>
        <div className={s.headTexts}>
          <h2 className={s.name} style={{ margin: 0 }}>
            {full}
          </h2>
          <span className={s.date}>{day.dayMonth}</span>
          {day.isToday && <span className={s.pill}>{t("week.today")}</span>}
        </div>
        <button type="button" className={s.more} onClick={() => handlers.onDay(day)} aria-label={t("week.dayOptions", { day: full })}>
          <IconMore size={18} />
        </button>
      </div>
      {day.lunch && <span className={s.lunch}>{t("week.lunch", { dish: day.lunch.name.toLocaleLowerCase(intlTag()) })}</span>}
      {day.ateOut ? (
        <div className={s.ateBody}>
          <span className={s.ateIcon}>
            <IconCutlery size={20} />
          </span>
          <span className={s.ateTexts}>
            <strong>{t("week.ateOut")}</strong>
            {day.returnedNames.length ? t("week.returned", { dishes: day.returnedNames.join(", ").toLocaleLowerCase(intlTag()) }) : null}
          </span>
        </div>
      ) : (
        <ul className={s.rows}>
          {SLOTS.map((slot: Slot) => {
            const cell = day.menu[slot];
            return (
              <li key={slot} className={s.row}>
                <span className={s.slot}>{SLOT_LABEL[slot]}</span>
                {cell ? (
                  <button
                    type="button"
                    className={[s.dish, slot === "ana" && s.main].filter(Boolean).join(" ")}
                    onClick={() => handlers.onTile(cell.item.id, day.date, slot, cell.recipe)}
                  >
                    <span className={[!cell.recipe && s.missing, ((slot === "ana" && day.leftoverOut) || cell.item.source === "leftover") && s.leftoverTag].filter(Boolean).join(" ")}>
                      {cell.item.source === "leftover" ? t("week.fromFridge") : ""}
                      {cell.recipe?.name ?? t("plan.deletedRecipe")}
                    </span>
                    {slot === "ana" && cell.recipe?.freezerItem && (
                      <span className={s.snow} role="img" aria-label={t("week.freezerItem", { item: cell.recipe.freezerItem.toLocaleLowerCase(intlTag()) })}>
                        <IconSnowflakeSmall size={14} />
                      </span>
                    )}
                  </button>
                ) : (
                  <button type="button" className={s.add} onClick={() => handlers.onAdd(day.date, slot)} aria-label={t("week.addTo", { day: full, slot: SLOT_LABEL[slot] })}>
                    <IconPlus size={14} />
                    {t("week.add")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Foot day={day} people={people} byId={byId} />
    </article>
  );
}

function Foot({ day, people, byId }: { day: DayModel; people: ReturnType<typeof usePeople>["people"]; byId: ReturnType<typeof usePeople>["byId"] }) {
  const leftover = day.leftoverOut ? t("week.lastsNextDay") : "";
  switch (day.note.kind) {
    case "cooked":
      return <div className={s.foot}>{t("week.cooked")}{leftover}</div>;
    case "approved":
      return (
        <div className={`${s.foot} ${s.footOk}`}>
          <AvatarStack people={people} size={18} overlap={5} borderColor="transparent" />
          {t("week.approved")}
          {leftover}
        </div>
      );
    case "match":
      return (
        <div className={`${s.foot} ${s.footMatch}`}>
          <IconHeart size={14} />
          {t("week.fromMatch")}
          {leftover}
        </div>
      );
    case "light":
      return <div className={s.foot}>{t("week.light")}{leftover}</div>;
    case "addedBy": {
      const p = byId.get(day.note.userId);
      return p ? (
        <div className={s.foot}>
          <Avatar person={p} size={18} />
          {t("week.addedBy", { name: p.name })}
          {leftover}
        </div>
      ) : null;
    }
    case "empty":
      return <div className={s.foot}>{t("week.emptyOk")}</div>;
    default:
      return null;
  }
}
