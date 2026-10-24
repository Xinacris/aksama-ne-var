"use client";

import { intlTag, t as tr } from "@anv/core/i18n";
import { tileName } from "@anv/core/domain/shopping";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SLOTS, SLOT_LABEL, SLOT_SHORT, type Match, type Recipe, type Slot } from "@anv/core/data/models";
import { dayName } from "@anv/core/domain/dates";
import { dropMessage, slotForRecipe, type DropOrigin, type DropResult } from "@anv/core/domain/placement";
import { recipeLabel } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { byPantryCoverage, pantryNames } from "@anv/core/domain/pantry";
import { usePeople } from "@/hooks/usePeople";
import { browsableRecipes, recipesMap, useApp } from "@/store/app";
import { keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { IconCheck, IconCutlery, IconGrip, IconHeart, IconPlus, IconSearch, IconSnowflakeSmall } from "../icons";
import { matchListStyles } from "../MatchList";
import { Avatar, AvatarStack } from "../ui/Avatar";
import { DishTag } from "../ui/Chip";
import { TextField } from "../ui/Field";
import { SlotAskDialog } from "./Dialogs";
import type { AsideMatch, DayModel } from "./useWeek";
import s from "./Board.module.css";

type DragData =
  | { kind: "item"; itemId: string; recipe: Recipe; from: { date: string; slot: Slot } }
  | { kind: "match"; match: Match; recipe: Recipe }
  | { kind: "fav"; recipe: Recipe }
  | { kind: "recipe"; recipe: Recipe }
  | { kind: "leftover"; recipe: Recipe; fromDate: string; useBy: string };
/** The whole day is the drop target: the dish picks its own slot (category-locked). */
type DropData = { kind: "day"; date: string };

/** The one slot a dragged dish can take (highlighted while dragging); null = it has no category yet. */
function dragSlot(d: DragData | null): Slot | null {
  if (!d) return null;
  if (d.kind === "item") return slotForRecipe(d.recipe) ?? d.from.slot;
  if (d.kind === "leftover") return slotForRecipe(d.recipe) ?? "ana";
  return slotForRecipe(d.recipe);
}

const LEFTOVER_STROKE = "#7A8A3A";

export interface BoardHandlers {
  onAdd: (date: string, slot: Slot) => void;
  onTile: (itemId: string, date: string, slot: Slot, recipe: Recipe | null) => void;
  onDay: (day: DayModel) => void;
  /** Click / Enter on a dish in the aside: "Güne ekle" without dragging. */
  onPlace?: (recipe: Recipe, match?: Match) => void;
}

/** Arrow keys jump between slot targets instead of nudging pixels. */
const coordinateGetter: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const dirs: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  const d = dirs[event.code];
  if (!d) return undefined;
  event.preventDefault();
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id);
    if (!r) continue;
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    const along = d[0] ? dx * d[0] : dy * d[1];
    if (along < 10) continue;
    const across = d[0] ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = { x: currentCoordinates.x + dx, y: currentCoordinates.y + dy };
    }
  }
  return best ?? undefined;
};

function dropLabel(data: DropData | undefined, drag: DragData | undefined): string {
  if (!data) return "";
  const slot = dragSlot(drag ?? null);
  return slot ? tr("board.dayTargetSlot", { day: dayName(data.date), slot: SLOT_LABEL[slot] }) : tr("board.dayTarget", { day: dayName(data.date) });
}
function dragName(data: DragData | undefined): string {
  return data ? data.recipe.name : tr("board.dish");
}

const announcements: Announcements = {
  onDragStart: ({ active }) => tr("board.dragStart", { name: dragName(active.data.current as DragData) }),
  onDragOver: ({ active, over }) =>
    over ? tr("board.over", { name: dragName(active.data.current as DragData), target: dropLabel(over.data.current as DropData, active.data.current as DragData) }) : tr("board.notOver"),
  onDragEnd: ({ active, over }) =>
    over ? tr("board.dropped", { name: dragName(active.data.current as DragData), target: dropLabel(over.data.current as DropData, active.data.current as DragData) }) : tr("board.droppedNothing"),
  onDragCancel: () => tr("board.cancelled"),
};

export function Board({
  days,
  matches,
  frequent,
  fridge,
  handlers,
}: {
  days: DayModel[];
  matches: AsideMatch[];
  frequent: Recipe[];
  fridge: EveningLeftover[];
  handlers: BoardHandlers;
}) {
  const dropOnDay = useApp((x) => x.dropOnDay);
  const moveToDay = useApp((x) => x.moveToDay);
  const placeLeftover = useApp((x) => x.placeLeftover);
  const today = useApp((x) => x.today);
  const recipes = useApp(browsableRecipes);
  const setNotice = useApp((x) => x.setNotice);
  const [dragging, setDragging] = useState<DragData | null>(null);
  /** A drop waiting for "which slot?" (recipe without a category). */
  const [ask, setAsk] = useState<{ date: string; recipe: Recipe; origin: DropOrigin; matchId?: string } | null>(null);
  /** Motion: the tile that just landed (snap) and the match that just came back. */
  const [landed, setLanded] = useState<string | null>(null);
  const [returned, setReturned] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);
  const flash = (set: (v: string | null) => void, v: string, ms: number) => {
    set(v);
    timers.current.push(window.setTimeout(() => set(null), ms));
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragData) ?? null);
  }

  function report(res: DropResult, recipe: Recipe, date: string) {
    setNotice({ kind: "info", text: dropMessage(res, { name: recipe.name, date, recipesById: recipesMap(recipes) }) });
    if (res.kind !== "placed") return;
    flash(setLanded, `${date}:${res.slot}`, 450);
    if (res.displaced?.to === "matches") flash(setReturned, res.displaced.recipeId, 1400);
  }

  async function drop(date: string, recipe: Recipe, origin: DropOrigin, matchId?: string, slot?: Slot) {
    const res = await dropOnDay({ date, recipeId: recipe.id, origin, matchId, slot });
    if (res.kind === "needsSlot") setAsk({ date, recipe, origin, matchId });
    else report(res, recipe, date);
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const a = e.active.data.current as DragData | undefined;
    const o = e.over?.data.current as DropData | undefined;
    if (!a || !o) return;
    if (a.kind === "leftover") {
      if (o.date > a.useBy || o.date < today) {
        setNotice({ kind: "info", text: tr("board.leftoverWindow", { name: a.recipe.name, until: keepUntilLabel(a.useBy, today).toLocaleLowerCase(intlTag()) }) });
        return;
      }
      await placeLeftover({ fromDate: a.fromDate, recipeId: a.recipe.id, toDate: o.date, slot: slotForRecipe(a.recipe) ?? "ana" });
      return;
    }
    if (a.kind === "item") {
      report(await moveToDay(a.itemId, o.date), a.recipe, o.date);
      return;
    }
    await drop(o.date, a.recipe, a.kind === "match" ? "match" : a.kind === "fav" ? "favorite" : "recipe", a.kind === "match" ? a.match.id : undefined);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            tr("board.instructions"),
        },
      }}
    >
      <div className={s.wrap}>
        <section aria-label={tr("board.region")} className={s.boardSection}>
          <div className={s.scroller}>
            <div className={s.grid}>
              {days.map((d, i) => (
                <DayColumn key={d.date} day={d} hasNext={i < days.length - 1} handlers={handlers} dragging={dragging} landed={landed} />
              ))}
            </div>
          </div>
          <div className={s.legend}>
            <span className={s.legendItem}>
              <svg width="28" height="8" viewBox="0 0 28 8" fill="none" aria-hidden="true">
                <path d="M1 4 H27" stroke={LEFTOVER_STROKE} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
              </svg>
              {tr("board.legendLeftover")}
            </span>
            <span className={s.legendItem}>
              <span className={s.legendSnow}>
                <IconSnowflakeSmall size={14} />
              </span>
              {tr("board.legendFreezer")}
            </span>
          </div>
        </section>

        <aside aria-label={tr("board.aside")} className={s.aside}>
          <div className={s.panel}>
            <div className={s.panelHead}>
              <h2 className={s.panelTitle}>{tr("week.fromMatches")}</h2>
              <Link href="/eslesme" className={s.panelLink}>
                {tr("board.swipe")}
              </Link>
            </div>
            {matches.length ? (
              <ul className={matchListStyles.list}>
                {matches.map((m) => (
                  <MatchRow key={m.match.id} m={m} dragging={dragging} returning={returned === m.recipe.id} onPlace={handlers.onPlace} />
                ))}
              </ul>
            ) : (
              <p className={s.hint}>{tr("match.empty")}</p>
            )}
          </div>
          {fridge.length > 0 && (
            <div className={s.panel}>
              <h2 className={s.panelTitle}>{tr("week.inFridge")}</h2>
              <div className={s.chips}>
                {fridge.map((f) => (
                  <LeftoverChip key={f.fromDate} ev={f} today={today} />
                ))}
              </div>
              <p className={s.hint}>{tr("board.dragFridge")}</p>
            </div>
          )}
          <div className={s.panel}>
            <h2 className={s.panelTitle}>{tr("week.frequent")}</h2>
            <div className={s.chips}>
              {frequent.map((r) => (
                <FavChip key={r.id} recipe={r} onPlace={handlers.onPlace} />
              ))}
            </div>
            <p className={s.hint}>{tr("board.dragFav")}</p>
          </div>
          <RecipePanel recipes={recipes} onPlace={handlers.onPlace} />
        </aside>
      </div>
      <SlotAskDialog
        target={ask ? { name: ask.recipe.name } : null}
        onClose={() => setAsk(null)}
        onPick={async (slot) => {
          const a = ask;
          setAsk(null);
          if (a) await drop(a.date, a.recipe, a.origin, a.matchId, slot);
        }}
      />
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className={s.overlay}>
            <IconGrip size={14} strokeWidth={3} />
            {recipeLabel(dragging.recipe)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayColumn({ day, hasNext, handlers, dragging, landed }: { day: DayModel; hasNext: boolean; handlers: BoardHandlers; dragging: DragData | null; landed: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.date}`, data: { kind: "day", date: day.date } satisfies DropData });
  const full = dayName(day.date);
  return (
    <div className={[s.col, day.isPast && s.past].filter(Boolean).join(" ")} ref={setNodeRef}>
      <button
        type="button"
        className={[s.dayHead, day.isToday && s.dayHeadToday].filter(Boolean).join(" ")}
        onClick={() => handlers.onDay(day)}
        aria-label={tr("board.dayHead", { day: full, date: day.dayMonth, today: day.isToday ? tr("board.todaySuffix") : "" })}
      >
        {day.isToday ? (
          <>
            <span className={s.dayName}>
              {day.short} <span className={s.dayNum}>{day.dayNum}</span>
            </span>
            <span className={s.todayPill}>{tr("week.today")}</span>
          </>
        ) : (
          <>
            <span className={s.dayName}>{day.short}</span>
            <span className={s.dayDate}>{day.dayMonth}</span>
          </>
        )}
      </button>
      {day.lunch ? (
        <div className={s.lunch}>
          <span>{tr("board.lunch")}</span>· {tileName(day.lunch).toLocaleLowerCase(intlTag())}
        </div>
      ) : (
        <div className={s.lunchSpacer} />
      )}

      {day.ateOut ? (
        <button type="button" className={[s.ateOut, isOver && s.ateOutOver].filter(Boolean).join(" ")} onClick={() => handlers.onDay(day)}>
          <span className={s.ateIcon}>
            <IconCutlery size={22} />
          </span>
          <span className={s.ateTitle}>{tr("week.ateOut")}</span>
          <span className={s.ateNote}>
            {day.returnedNames.length
              ? tr("week.returned", { dishes: day.returnedNames.join(", ").toLocaleLowerCase(intlTag()) })
              : tr("board.kitchenOff")}
          </span>
        </button>
      ) : (
        <div className={[s.card, day.isToday && s.cardToday, day.filled === 0 && s.cardEmpty, isOver && s.cardOver].filter(Boolean).join(" ")}>
          {SLOTS.map((slot) => (
            <SlotCellView key={slot} day={day} slot={slot} handlers={handlers} dragging={dragging} over={isOver} landed={landed === `${day.date}:${slot}`} />
          ))}
        </div>
      )}

      <DayFoot day={day} />

      {day.leftoverOut && hasNext && (
        <svg className={s.link} width="25" height="140" viewBox="0 0 25 140" fill="none" aria-hidden="true">
          <path d="M0 139 H12 V1 H25" stroke={LEFTOVER_STROKE} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          <circle cx="2" cy="139" r="3.5" fill={LEFTOVER_STROKE} />
        </svg>
      )}
    </div>
  );
}

function SlotCellView({
  day,
  slot,
  handlers,
  dragging,
  over,
  landed,
}: {
  day: DayModel;
  slot: Slot;
  handlers: BoardHandlers;
  dragging: DragData | null;
  over: boolean;
  landed: boolean;
}) {
  const cell = day.menu[slot];
  const { setNodeRef: setDragRef, listeners, attributes, isDragging } = useDraggable({
    id: cell ? `item:${cell.item.id}` : `noitem:${day.date}:${slot}`,
    disabled: !cell,
    data: cell ? ({ kind: "item", itemId: cell.item.id, recipe: cell.recipe ?? fallbackRecipe(cell.item.recipeId), from: { date: day.date, slot } } satisfies DragData) : undefined,
  });
  // While dragging: the dish's own slot is the target, every other slot is shown disabled.
  const target = dragging ? dragSlot(dragging) : null;
  const self = dragging?.kind === "item" && dragging.itemId === cell?.item.id;
  const state = !dragging || target === null ? null : slot === target ? "valid" : "disabled";
  const stateCls = state === "valid" ? s.slotValid : state === "disabled" ? s.slotDisabled : null;

  if (state === "valid" && over && !self) {
    return (
      <div className={s.drop} aria-hidden="true">
        {tr("board.dropHere")}
        {cell?.recipe ? <span className={s.dropInstead}>{tileName(cell.recipe)}</span> : null}
      </div>
    );
  }
  if (!cell) {
    return (
      <div className={stateCls ?? undefined} aria-disabled={state === "disabled" || undefined} title={state === "disabled" ? tr("board.slotDisabled") : undefined}>
        <button type="button" className={s.add} onClick={() => handlers.onAdd(day.date, slot)} aria-label={tr("week.addTo", { day: dayName(day.date), slot: SLOT_LABEL[slot] })} tabIndex={dragging ? -1 : undefined}>
          <IconPlus size={14} />
          {state === "valid" ? tr("board.slotValid", { slot: SLOT_SHORT[slot] }) : SLOT_SHORT[slot]}
        </button>
      </div>
    );
  }
  const isLeftover = cell.item.source === "leftover";
  const leftoverSource = (slot === "ana" && day.leftoverOut) || isLeftover;
  return (
    <div className={stateCls ?? undefined} aria-disabled={state === "disabled" || undefined}>
      <button
        ref={setDragRef}
        type="button"
        {...listeners}
        {...attributes}
        className={[s.tile, slot === "ana" && s.tileMain, leftoverSource && s.tileLeftover, isDragging && s.tileDragging, landed && s.tileLanded].filter(Boolean).join(" ")}
        onClick={() => handlers.onTile(cell.item.id, day.date, slot, cell.recipe)}
        aria-label={tr("board.tile", { day: dayName(day.date), slot: SLOT_LABEL[slot], fromFridge: isLeftover ? tr("board.fromFridgeLower") : "", name: cell.recipe?.name ?? tr("board.deletedLower") })}
        aria-roledescription={tr("board.movable")}
      >
        <span className={s.tileLabel}>{isLeftover ? tr("board.fromFridge") : SLOT_SHORT[slot]}</span>
        <span className={[s.tileName, !cell.recipe && s.tileMissing].filter(Boolean).join(" ")}>{cell.recipe ? tileName(cell.recipe) : tr("plan.deletedRecipe")}</span>
        {slot === "ana" && cell.recipe?.freezerItem && (
          <span role="img" aria-label={tr("week.freezerItem", { item: cell.recipe.freezerItem.toLocaleLowerCase(intlTag()) })} className={s.freezer}>
            <IconSnowflakeSmall size={14} />
          </span>
        )}
      </button>
    </div>
  );
}

function fallbackRecipe(id: string): Recipe {
  return {
    id,
    householdId: null,
    name: tr("plan.deletedRecipe"),
    course: "ana",
    prepMinutes: 0,
    cookMinutes: 0,
    servings: 1,
    tags: [],
    ingredients: [],
    prepItems: [],
    steps: [],
    leftoverPolicy: "none",
    leftoverDays: 2,
    freezerItem: null,
    createdBy: null,
    createdAt: "",
    updatedAt: "",
  };
}

function DayFoot({ day }: { day: DayModel }) {
  const { people, byId } = usePeople();
  let content: ReactNode = null;
  let cls = s.foot;
  switch (day.note.kind) {
    case "cooked":
      content = tr("week.cooked");
      break;
    case "approved":
      cls = `${s.foot} ${s.footOk}`;
      content = (
        <>
          <AvatarStack people={people} size={18} overlap={5} borderColor="transparent" />
          {tr("week.approved")}
        </>
      );
      break;
    case "match":
      cls = `${s.foot} ${s.footMatch}`;
      content = (
        <>
          <IconHeart size={14} />
          {tr("week.fromMatch")}
        </>
      );
      break;
    case "light":
      content = tr("week.light");
      break;
    case "addedBy": {
      const p = byId.get(day.note.userId);
      content = p ? (
        <>
          <Avatar person={p} size={18} />
          {tr("week.addedBy", { name: p.name })}
        </>
      ) : null;
      break;
    }
    case "empty":
      content = tr("week.emptyOk");
      break;
  }
  return <div className={cls}>{content}</div>;
}

function MatchRow({ m, dragging, returning, onPlace }: { m: AsideMatch; dragging: DragData | null; returning: boolean; onPlace?: BoardHandlers["onPlace"] }) {
  const placed = m.match.status === "placed";
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `match:${m.match.id}`, disabled: placed, data: { kind: "match", match: m.match, recipe: m.recipe } satisfies DragData });
  const isDragging = dragging?.kind === "match" && dragging.match.id === m.match.id;
  return (
    <li
      className={[matchListStyles.item, placed && matchListStyles.placed, isDragging && matchListStyles.dragging, returning && matchListStyles.returning].filter(Boolean).join(" ")}
    >
      {placed ? (
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
        <button
          ref={setNodeRef}
          type="button"
          className={s.matchBtn}
          {...listeners}
          {...attributes}
          onClick={() => onPlace?.(m.recipe, m.match)}
          aria-label={tr("board.dragMatch", { name: m.recipe.name, note: m.note })}
          aria-roledescription={tr("board.movable")}
        >
          <span className={matchListStyles.icon}>
            <IconGrip size={16} strokeWidth={3} />
          </span>
          <span className={matchListStyles.texts}>
            <span className={matchListStyles.name}>{m.recipe.name}</span>
            <span className={matchListStyles.note}>{isDragging ? tr("board.dragging") : m.note}</span>
          </span>
        </button>
      )}
    </li>
  );
}

function LeftoverChip({ ev, today }: { ev: EveningLeftover; today: string }) {
  const useBy = ev.outcome.kind === "fridge" ? ev.outcome.useBy : today;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `leftover:${ev.fromDate}`,
    data: { kind: "leftover", recipe: ev.recipe, fromDate: ev.fromDate, useBy } satisfies DragData,
  });
  const hint = keepUntilLabel(useBy, today);
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={s.chipBtn}
      {...listeners}
      {...attributes}
      aria-label={tr("board.dragLeftover", { name: ev.recipe.name, hint: hint.toLocaleLowerCase(intlTag()) })}
      aria-roledescription={tr("board.movable")}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DishTag variant="leftover">
        {recipeLabel(ev.recipe)} · {hint.toLocaleLowerCase(intlTag())}
      </DishTag>
    </button>
  );
}

function FavChip({ recipe, onPlace }: { recipe: Recipe; onPlace?: BoardHandlers["onPlace"] }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `fav:${recipe.id}`, data: { kind: "fav", recipe } satisfies DragData });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={s.chipBtn}
      {...listeners}
      {...attributes}
      onClick={() => onPlace?.(recipe)}
      aria-label={tr("board.dragRecipe", { name: recipe.name })}
      aria-roledescription={tr("board.movable")}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DishTag variant="draggable">{recipeLabel(recipe)}</DishTag>
    </button>
  );
}

/** "Tarifler" in the aside: any recipe can go straight onto a day, no match needed. */
function RecipePanel({ recipes, onPlace }: { recipes: Recipe[]; onPlace?: BoardHandlers["onPlace"] }) {
  const [q, setQ] = useState("");
  const pantry = useApp((x) => x.pantry);
  // What can be made with what's at home comes first.
  const shown = useMemo(() => {
    const k = searchKey(q);
    const hits = k ? recipes.filter((r) => searchKey(r.name).includes(k) || searchKey(r.shortName ?? "").includes(k)) : recipes;
    return byPantryCoverage(hits, pantryNames(pantry)).slice(0, k ? 24 : 10);
  }, [recipes, q, pantry]);
  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>{tr("board.recipes")}</h2>
        <Link href="/tarifler" className={s.panelLink}>
          {tr("board.moreRecipes")}
        </Link>
      </div>
      <TextField label={tr("dlg.searchRecipe")} hideLabel type="search" placeholder={tr("dlg.searchRecipeDots")} icon={<IconSearch size={18} />} value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length ? (
        <div className={s.chips} data-testid="board-recipes">
          {shown.map((r) => (
            <RecipeChip key={r.id} recipe={r} onPlace={onPlace} />
          ))}
        </div>
      ) : (
        <p className={s.hint}>{tr("dlg.noSuchRecipe")}</p>
      )}
      <p className={s.hint}>{tr("board.recipesHint")}</p>
    </div>
  );
}

function RecipeChip({ recipe, onPlace }: { recipe: Recipe; onPlace?: BoardHandlers["onPlace"] }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `recipe:${recipe.id}`, data: { kind: "recipe", recipe } satisfies DragData });
  const slot = slotForRecipe(recipe);
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={s.chipBtn}
      {...listeners}
      {...attributes}
      onClick={() => onPlace?.(recipe)}
      aria-label={`${tr("board.dragRecipe", { name: recipe.name })}${slot ? ` · ${SLOT_LABEL[slot]}` : ""}`}
      aria-roledescription={tr("board.movable")}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DishTag variant="draggable">{recipeLabel(recipe)}</DishTag>
    </button>
  );
}
