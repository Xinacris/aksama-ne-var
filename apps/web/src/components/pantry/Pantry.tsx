"use client";

import { t } from "@anv/core/i18n";
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AISLE_LABEL, UNITS, UNIT_LABEL, type PantryItem, type Unit } from "@anv/core/data/models";
import { COMMON_PANTRY, groupPantry, pantryStatus, searchIngredients, type PantryStatus } from "@anv/core/domain/pantry";
import { ingredientLabel } from "@anv/core/domain/recipeText";
import { formatIngredientQuantity } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { useApp } from "@/store/app";
import { IconClose, IconEdit, IconPlus, IconSearch } from "../icons";
import { Button } from "../ui/Button";
import { DishChip } from "../ui/Chip";
import { Dialog } from "../ui/Dialog";
import { SelectField, TextField } from "../ui/Field";
import s from "./Pantry.module.css";

/**
 * "Evde ne var?" quick add: common ingredients as chips by category, a search over the catalog,
 * and free text for anything else. Controlled: the onboarding step collects a selection, the
 * pantry screen adds and removes right away.
 */
export function PantryQuickAdd({ isOn, onToggle, onAdd, showCommon = true }: { isOn: (name: string) => boolean; onToggle: (name: string) => void; onAdd: (name: string) => void; showCommon?: boolean }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchIngredients(q, 10), [q]);
  const free = q.trim();
  const exact = hits.some((n) => searchKey(ingredientLabel(n)) === searchKey(free) || searchKey(n) === searchKey(free));
  function add(name: string) {
    onAdd(name);
    setQ("");
  }
  return (
    <div className={s.quick}>
      <TextField
        label={t("pantry.search")}
        hideLabel
        type="search"
        icon={<IconSearch size={18} />}
        placeholder={t("pantry.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && free) {
            e.preventDefault();
            add(hits[0] && exact ? hits[0] : free);
          }
        }}
      />
      {free ? (
        <div className={s.chips} role="group" aria-label={t("pantry.search")}>
          {hits.map((n) => (
            <DishChip key={n} selected={isOn(n)} onClick={() => (isOn(n) ? onToggle(n) : add(n))}>
              {ingredientLabel(n)}
            </DishChip>
          ))}
          {!exact && (
            <button type="button" className={s.freeBtn} onClick={() => add(free)}>
              <IconPlus size={16} />
              {t("pantry.addFree", { name: free })}
            </button>
          )}
        </div>
      ) : (
        showCommon &&
        COMMON_PANTRY.map((g) => (
          <section key={g.aisle} className={s.group} aria-labelledby={`pq-${g.aisle}`}>
            <h3 id={`pq-${g.aisle}`} className={s.groupTitle}>
              {AISLE_LABEL[g.aisle]}
            </h3>
            <div className={s.chips}>
              {g.names.map((n) => (
                <DishChip key={n} selected={isOn(n)} onClick={() => onToggle(n)}>
                  {ingredientLabel(n)}
                </DishChip>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/** What's at home, grouped by category; each row edits or leaves. */
export function PantryList({ items, onEdit }: { items: PantryItem[]; onEdit: (p: PantryItem) => void }) {
  const remove = useApp((x) => x.removePantryItem);
  const update = useApp((x) => x.updatePantryItem);
  return (
    <div className={s.groups}>
      {groupPantry(items).map((g) => (
        <section key={g.aisle} className={s.group} aria-labelledby={`pl-${g.aisle}`}>
          <h2 id={`pl-${g.aisle}`} className={s.groupTitle}>
            {AISLE_LABEL[g.aisle]} <span className={s.count}>{g.items.length}</span>
          </h2>
          <ul className={s.rows}>
            {g.items.map((p) => {
              const low = pantryStatus(p) === "low";
              const name = ingredientLabel(p.name);
              return (
                <li key={p.id} className={s.row} data-testid={`pantry-row-${p.name}`}>
                  <span className={s.rowName}>
                    {name}
                    {p.quantity !== null && <span className={s.qty}>{formatIngredientQuantity(p)}</span>}
                  </span>
                  <button type="button" className={s.lowBtn} aria-pressed={low} onClick={() => void update(p.id, { status: low ? "have" : "low" })}>
                    {t("pantry.low")}
                  </button>
                  <button type="button" className={s.iconBtn} aria-label={t("pantry.edit", { name })} onClick={() => onEdit(p)}>
                    <IconEdit size={18} />
                  </button>
                  <button type="button" className={s.iconBtn} aria-label={t("pantry.remove", { name })} onClick={() => void remove(p.id)}>
                    <IconClose size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Edit one item: name, optional amount, have / running low. */
export function PantryEditDialog({ item, onClose }: { item: PantryItem | null; onClose: () => void }) {
  const update = useApp((x) => x.updatePantryItem);
  type Draft = { id: string; name: string; qty: string; unit: Unit | ""; status: PantryStatus };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const d: Draft | null =
    item && draft?.id === item.id
      ? draft
      : item
        ? { id: item.id, name: ingredientLabel(item.name), qty: item.quantity === null ? "" : String(item.quantity).replace(".", ","), unit: item.unit ?? "", status: pantryStatus(item) }
        : null;
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch });
  const close = () => {
    setDraft(null);
    setError(null);
    onClose();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d || !item) return;
    if (!d.name.trim()) return setError(t("errors.itemName"));
    const q = d.qty.trim() ? Number(d.qty.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q <= 0)) return setError(t("liste.qtyNumber"));
    await update(item.id, { name: d.name, quantity: q, unit: q === null ? null : d.unit || "adet", status: d.status });
    close();
  }
  return (
    <Dialog open={!!item} onClose={close} eyebrow={t("pantry.title")} title={d?.name ?? ""}>
      {d && (
        <form className={s.form} onSubmit={submit} noValidate>
          <TextField label={t("pantry.name")} value={d.name} onChange={(e) => set({ name: e.target.value })} error={error} />
          <div className={s.formRow}>
            <TextField label={t("pantry.qty")} inputMode="decimal" value={d.qty} onChange={(e) => set({ qty: e.target.value })} placeholder={t("liste.optional")} />
            <SelectField label={t("pantry.unit")} value={d.unit} onChange={(e) => set({ unit: e.target.value as Unit | "" })}>
              <option value="">{t("pantry.noUnit")}</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </SelectField>
          </div>
          <div className={s.chips} role="group" aria-label={t("pantry.status")}>
            <DishChip selected={d.status === "have"} onClick={() => set({ status: "have" })}>
              {t("pantry.have")}
            </DishChip>
            <DishChip selected={d.status === "low"} onClick={() => set({ status: "low" })}>
              {t("pantry.low")}
            </DishChip>
          </div>
          <Button type="submit" size="lg" block>
            {t("pantry.save")}
          </Button>
        </form>
      )}
    </Dialog>
  );
}

export type Mark = "have" | "low" | "none";
const MARKS: Mark[] = ["have", "none", "low"];
const MARK_LABEL: Record<Mark, string> = { have: "pantry.have", none: "pantry.none", low: "pantry.low" };

/** One ingredient's "var / yok / az kaldı": a radio group that may start with nothing chosen. */
function MarkRow({ name, value, onChange }: { name: string; value: Mark | undefined; onChange: (m: Mark) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = value ? MARKS.indexOf(value) : -1;
  const label = ingredientLabel(name);
  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = (i + step + MARKS.length) % MARKS.length;
    onChange(MARKS[to]);
    refs.current[to]?.focus();
  }
  return (
    <li className={s.checkRow}>
      <span className={s.rowName} id={`mk-${name}`}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`mk-${name}`} className={s.marks}>
        {MARKS.map((m, i) => (
          <button
            key={m}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === m}
            tabIndex={i === Math.max(0, current) ? 0 : -1}
            className={s.mark}
            data-mark={m}
            onClick={() => onChange(m)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t(MARK_LABEL[m])}
          </button>
        ))}
      </div>
    </li>
  );
}

/** The reminder's quick checklist: only the relevant ingredients; "Bitti" records the answer. */
export function PantryCheck({ ingredients, answerKey, onDone }: { ingredients: string[]; answerKey: string; onDone: () => void }) {
  const answer = useApp((x) => x.answerPantryCheck);
  const setNotice = useApp((x) => x.setNotice);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [error, setError] = useState<string | null>(null);
  const done = Object.keys(marks).length;
  async function save() {
    if (done === 0) return setError(t("pantry.checkNeedOne"));
    await answer(answerKey, marks);
    setNotice({ kind: "info", text: t("pantry.checkSaved") });
    onDone();
  }
  return (
    <div className={s.check}>
      <ul className={s.rows}>
        {ingredients.map((n) => (
          <MarkRow key={n} name={n} value={marks[n]} onChange={(m) => setMarks((x) => ({ ...x, [n]: m }))} />
        ))}
      </ul>
      <p className={s.marked} role="status">
        {t("pantry.checkMarked", { done, total: ingredients.length })}
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <Button size="lg" block onClick={save}>
        {t("pantry.checkSave")}
      </Button>
    </div>
  );
}
