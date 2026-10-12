"use client";

import { SLOTS, SLOT_LABEL, type Match, type Recipe, type Slot } from "@/data/models";
import { dayName } from "@/domain/dates";
import { recipeLabel } from "@/domain/shopping";
import { usePeople } from "@/hooks/usePeople";
import { IconCheck, IconCutlery, IconGrip, IconHeart, IconMore, IconPlus, IconSnowflakeSmall } from "../icons";
import { matchListStyles } from "../MatchList";
import { Avatar, AvatarStack } from "../ui/Avatar";
import { DishTag } from "../ui/Chip";
import type { BoardHandlers } from "./Board";
import type { AsideMatch, DayModel } from "./useWeek";
import s from "./DayList.module.css";

/** Mobile equivalent of the board: one stacked card per evening, tap to add or change. */
export function DayList({
  days,
  matches,
  frequent,
  handlers,
  onPlace,
}: {
  days: DayModel[];
  matches: AsideMatch[];
  frequent: Recipe[];
  handlers: BoardHandlers;
  onPlace: (recipe: Recipe, match?: Match) => void;
}) {
  return (
    <>
      <div className={s.list}>
        {days.map((d) => (
          <DayCard key={d.date} day={d} handlers={handlers} />
        ))}
      </div>
      <section className={s.panel} aria-labelledby="m-eslesmeler">
        <h2 id="m-eslesmeler" className={s.panelTitle}>
          Eşleşmelerden
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
                  <button type="button" className={s.matchBtn} onClick={() => onPlace(m.recipe, m.match)} aria-label={`${m.recipe.name}, ${m.note}. Bir akşama koy`}>
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
          <p className={s.hint}>Henüz eşleşme yok. Birlikte kaydırınca burada birikir.</p>
        )}
      </section>
      <section className={s.panel} aria-labelledby="m-sik">
        <h2 id="m-sik" className={s.panelTitle}>
          Sık yaptıklarınız
        </h2>
        <div className={s.chips}>
          {frequent.map((r) => (
            <button key={r.id} type="button" className={s.chipBtn} onClick={() => onPlace(r)} aria-label={`${r.name}. Bir akşama koy`}>
              <DishTag variant="draggable">{recipeLabel(r)}</DishTag>
            </button>
          ))}
        </div>
        <p className={s.hint}>Dokun, hangi akşama koyacağını seç.</p>
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
          {day.isToday && <span className={s.pill}>Bugün</span>}
        </div>
        <button type="button" className={s.more} onClick={() => handlers.onDay(day)} aria-label={`${full} günü seçenekleri`}>
          <IconMore size={18} />
        </button>
      </div>
      {day.lunch && <span className={s.lunch}>Öğlen · {day.lunch.name.toLocaleLowerCase("tr")}</span>}
      {day.ateOut ? (
        <div className={s.ateBody}>
          <span className={s.ateIcon}>
            <IconCutlery size={20} />
          </span>
          <span className={s.ateTexts}>
            <strong>Dışarıda yendi</strong>
            {day.returnedNames.length ? `Planlanan ${day.returnedNames.join(", ").toLocaleLowerCase("tr")} eşleşmelere geri döndü.` : null}
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
                    <span className={[!cell.recipe && s.missing, slot === "ana" && day.leftoverOut && s.leftoverTag].filter(Boolean).join(" ")}>
                      {cell.recipe?.name ?? "Silinmiş tarif"}
                    </span>
                    {slot === "ana" && cell.recipe?.freezerItem && (
                      <span className={s.snow} role="img" aria-label={`Buzluktan çıkacak: ${cell.recipe.freezerItem.toLocaleLowerCase("tr")}`}>
                        <IconSnowflakeSmall size={14} />
                      </span>
                    )}
                  </button>
                ) : (
                  <button type="button" className={s.add} onClick={() => handlers.onAdd(day.date, slot)} aria-label={`${full} · ${SLOT_LABEL[slot]} ekle`}>
                    <IconPlus size={14} />
                    Ekle
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
  const leftover = day.leftoverOut ? " · ertesi güne artar" : "";
  switch (day.note.kind) {
    case "cooked":
      return <div className={s.foot}>Pişti{leftover}</div>;
    case "approved":
      return (
        <div className={`${s.foot} ${s.footOk}`}>
          <AvatarStack people={people} size={18} overlap={5} borderColor="transparent" />
          Onaylandı{leftover}
        </div>
      );
    case "match":
      return (
        <div className={`${s.foot} ${s.footMatch}`}>
          <IconHeart size={14} />
          Eşleşmeden{leftover}
        </div>
      );
    case "light":
      return <div className={s.foot}>Hafif akşam{leftover}</div>;
    case "addedBy": {
      const p = byId.get(day.note.userId);
      return p ? (
        <div className={s.foot}>
          <Avatar person={p} size={18} />
          {p.name} ekledi{leftover}
        </div>
      ) : null;
    }
    case "empty":
      return <div className={s.foot}>Boş bırakmak da olur</div>;
    default:
      return null;
  }
}
