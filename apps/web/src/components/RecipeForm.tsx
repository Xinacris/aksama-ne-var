"use client";

import { t } from "@anv/core/i18n";
import { AISLE_LABEL, SIDE_LABEL, UNIT_LABEL } from "@anv/core/data/models";
import Link from "next/link";
import { useState, type ClipboardEvent, type FormEvent, type ReactNode } from "react";
import { AISLES, COURSES, COURSE_LABEL, UNITS } from "@anv/core/data/models";
import { catalogEntry, INGREDIENT_CATALOG, normalizeIngredientName } from "@anv/core/data/seed/ingredients";
import { emptyIngredient, genelSummary, initialOpen, parseDraft, prepSummary, sourceSummary, type DetailSection, type RecipeDraft } from "@anv/core/services/recipeForm";
import { cookTimeLooksLong } from "@anv/core/domain/import/timing";
import { ingredientsFromLines, isBlankIngredient, pastedLines, stepsFromLines } from "@anv/core/services/bulkPaste";
import { POLICY_OPTION } from "@anv/core/domain/leftovers";
import type { RecipeInput } from "@/store/app";
import { IconChevronLeft, IconPlus, IconTrash } from "./icons";
import { Button } from "./ui/Button";
import { ChoiceChips } from "./ui/ChoiceChips";
import { SelectField, TextArea, TextField } from "./ui/Field";
import s from "./RecipeForm.module.css";

const policyChoices = () => (["none", "lunch", "store"] as const).map((value) => ({ value, label: POLICY_OPTION[value] }));

/** Prep-ahead timings offered in the form (labels: `form.offset.<value>`). */
const OFFSETS = ["night-before", "morning", "-120min", "-90min", "-60min", "-45min", "-30min", "-15min"];

export function RecipeForm({
  title,
  initial,
  backHref,
  submitLabel,
  onSubmit,
  header,
  backLabel = t("form.back"),
  openFilled = true,
}: {
  title: string;
  initial: RecipeDraft;
  backHref: string;
  submitLabel: string;
  onSubmit: (value: RecipeInput) => Promise<void>;
  /** Shown under the title (the import screen's source card). */
  header?: ReactNode;
  backLabel?: string;
  /** Open the "Ayrıntılar" sections that already hold values (edit, copy, import). False for a blank new recipe. */
  openFilled?: boolean;
}) {
  const [d, setD] = useState<RecipeDraft>(initial);
  const [open, setOpen] = useState(() => initialOpen(initial, openFilled));
  const toggle = (k: DetailSection, v: boolean) => setOpen((o) => (o[k] === v ? o : { ...o, [k]: v }));
  // "Toplu yapıştır": which list's textarea is open, its text, and the last result for screen readers.
  const [bulk, setBulk] = useState<null | "ing" | "step">(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  // A multi-line paste into one field: offer to split it into rows.
  const [offer, setOffer] = useState<null | { kind: "ing" | "step"; index: number; before: string; text: string; count: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = parseDraft(d);
    if (!res.ok) {
      setError(res.error);
      // The problem may sit in a closed section: open them all so it can be found.
      setOpen({ genel: true, prep: true, source: true });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(res.value);
    } finally {
      setBusy(false);
    }
  }

  function setIng(i: number, patch: Partial<RecipeDraft["ingredients"][number]>) {
    setD((x) => {
      const ingredients = x.ingredients.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        // Known ingredient: fill side and aisle from the catalog.
        if (patch.name !== undefined) {
          const c = catalogEntry(normalizeIngredientName(patch.name));
          if (c) Object.assign(next, { side: c.side, aisle: c.aisle });
        }
        return next;
      });
      return { ...x, ingredients };
    });
  }

  function addIngredientRows(text: string, at?: { index: number; before: string }) {
    const rows = ingredientsFromLines(text);
    if (!rows.length) return 0;
    setD((x) => {
      if (at) {
        const keep = at.before.trim() ? [{ ...x.ingredients[at.index], name: at.before }] : [];
        return { ...x, ingredients: [...x.ingredients.slice(0, at.index), ...keep, ...rows, ...x.ingredients.slice(at.index + 1)] };
      }
      return { ...x, ingredients: [...x.ingredients.filter((i) => !isBlankIngredient(i)), ...rows] };
    });
    return rows.length;
  }

  function addStepRows(text: string, at?: { index: number; before: string }) {
    const rows = stepsFromLines(text);
    if (!rows.length) return 0;
    setD((x) => {
      if (at) {
        const keep = at.before.trim() ? [at.before.trim()] : [];
        return { ...x, steps: [...x.steps.slice(0, at.index), ...keep, ...rows, ...x.steps.slice(at.index + 1)] };
      }
      return { ...x, steps: [...x.steps.filter((st) => st.trim()), ...rows] };
    });
    return rows.length;
  }

  function applyBulk() {
    const n = bulk === "ing" ? addIngredientRows(bulkText) : addStepRows(bulkText);
    if (!n) {
      setBulkNote(t("form.bulk.none"));
      return;
    }
    setBulkNote(t(bulk === "ing" ? "form.bulk.ingAdded" : "form.bulk.stepAdded", { count: n }));
    setBulk(null);
    setBulkText("");
  }

  function onPasteInto(kind: "ing" | "step", index: number) {
    return (e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData("text");
      const count = pastedLines(text).length;
      // The paste itself goes through as usual; the offer only adds a choice next to the field.
      setOffer(count > 1 ? { kind, index, before: e.currentTarget.value, text, count } : null);
    };
  }

  function splitOffer() {
    if (!offer) return;
    const at = { index: offer.index, before: offer.before };
    const n = offer.kind === "ing" ? addIngredientRows(offer.text, at) : addStepRows(offer.text, at);
    setBulkNote(t(offer.kind === "ing" ? "form.bulk.ingSplit" : "form.bulk.stepSplit", { count: n }));
    setOffer(null);
  }

  const offerRow = (kind: "ing" | "step", index: number) =>
    offer?.kind === kind && offer.index === index ? (
      <div className={s.offer} role="group" aria-label={t("form.bulk.pasted")}>
        <span className={s.offerText}>{t("form.bulk.offer", { count: offer.count })}</span>
        <div className={s.offerActions}>
          <Button size="sm" pill onClick={splitOffer}>
            {t("form.bulk.yes")}
          </Button>
          <Button size="sm" pill variant="ghost" onClick={() => setOffer(null)}>
            {t("form.bulk.no")}
          </Button>
        </div>
      </div>
    ) : null;

  const bulkBox = (kind: "ing" | "step") =>
    bulk === kind ? (
      <div className={s.bulk}>
        <TextArea
          label={t(kind === "ing" ? "form.bulk.ingLabel" : "form.bulk.stepLabel")}
          hint={t(kind === "ing" ? "form.bulk.ingHint" : "form.bulk.stepHint")}
          rows={6}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          autoFocus
        />
        <div className={s.offerActions}>
          <Button size="sm" pill onClick={applyBulk}>
            {t("form.bulk.add")}
          </Button>
          <Button
            size="sm"
            pill
            variant="ghost"
            onClick={() => {
              setBulk(null);
              setBulkText("");
            }}
          >
            {t("form.bulk.cancel")}
          </Button>
        </div>
      </div>
    ) : null;

  const bulkToggle = (kind: "ing" | "step") => (
    <Button
      variant="ghost"
      size="sm"
      pill
      aria-expanded={bulk === kind}
      onClick={() => {
        setBulk(bulk === kind ? null : kind);
        setBulkText("");
        setBulkNote("");
      }}
    >
      {t("form.bulk.toggle")}
    </Button>
  );

  const longCook = cookTimeLooksLong(Number(d.cookMinutes.replace(",", ".")) || 0, d.steps);
  const ingredientNames = d.ingredients.map((i) => normalizeIngredientName(i.name)).filter(Boolean);

  return (
    <main className={s.page}>
      <Link href={backHref} className={s.back}>
        <IconChevronLeft size={20} />
        {backLabel}
      </Link>
      <h1 className={s.title}>{title}</h1>
      {header}
      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section className={s.card} aria-labelledby="f-genel">
          <h2 id="f-genel" className={s.cardTitle}>
            {t("form.general")}
          </h2>
          <TextField label={t("form.name")} value={d.name} onChange={(e) => set("name", e.target.value)} required />
          <SelectField label={t("form.course")} value={d.course} onChange={(e) => set("course", e.target.value)}>
            {COURSES.map((c) => (
              <option key={c} value={c}>
                {COURSE_LABEL[c]}
              </option>
            ))}
          </SelectField>
        </section>

        <section className={s.card} aria-labelledby="f-malzeme">
          <h2 id="f-malzeme" className={s.cardTitle}>
            {t("form.ingredients")}
          </h2>
          <datalist id="malzeme-adlari">
            {INGREDIENT_CATALOG.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
          {d.ingredients.map((ing, i) => (
            <div key={i} className={s.ingRow} role="group" aria-label={t("form.ingN", { n: i + 1 })}>
              <div className={s.ingTop}>
                <TextField
                  label={t("form.ingredient")}
                  list="malzeme-adlari"
                  value={ing.name}
                  onChange={(e) => setIng(i, { name: e.target.value })}
                  onPaste={onPasteInto("ing", i)}
                />
                <TextField label={t("form.qty")} inputMode="decimal" value={ing.quantity} onChange={(e) => setIng(i, { quantity: e.target.value })} />
                <SelectField label={t("form.unit")} value={ing.unit} onChange={(e) => setIng(i, { unit: e.target.value })}>
                  <option value="">—</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </SelectField>
                <button
                  type="button"
                  className={s.iconBtn}
                  aria-label={t("form.removeIng", { n: i + 1 })}
                  onClick={() => set("ingredients", d.ingredients.filter((_, idx) => idx !== i))}
                >
                  <IconTrash size={18} />
                </button>
              </div>
              <div className={s.ingBottom}>
                <SelectField label={t("form.side")} value={ing.side} onChange={(e) => setIng(i, { side: e.target.value as "pazar" | "market" })}>
                  <option value="pazar">{SIDE_LABEL.pazar}</option>
                  <option value="market">{SIDE_LABEL.market}</option>
                </SelectField>
                <SelectField label={t("form.aisle")} value={ing.aisle} onChange={(e) => setIng(i, { aisle: e.target.value })}>
                  {AISLES.map((a) => (
                    <option key={a} value={a}>
                      {AISLE_LABEL[a]}
                    </option>
                  ))}
                </SelectField>
              </div>
              {offerRow("ing", i)}
            </div>
          ))}
          {bulkBox("ing")}
          <div className={s.listActions}>
            <Button variant="soft" size="sm" pill onClick={() => set("ingredients", [...d.ingredients, emptyIngredient()])}>
              <IconPlus size={16} />
              {t("form.addIng")}
            </Button>
            {bulkToggle("ing")}
          </div>
        </section>

        <section className={s.card} aria-labelledby="f-adim">
          <h2 id="f-adim" className={s.cardTitle}>
            {t("form.steps")}
          </h2>
          {d.steps.map((step, i) => (
            <div key={i} className={s.stepItem}>
              <div className={s.stepRow}>
                <span className={s.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <TextArea
                  label={t("form.stepN", { n: i + 1 })}
                  hideLabel
                  value={step}
                  rows={2}
                  onChange={(e) => set("steps", d.steps.map((x, idx) => (idx === i ? e.target.value : x)))}
                  onPaste={onPasteInto("step", i)}
                />
                <button type="button" className={s.iconBtn} aria-label={t("form.removeStep", { n: i + 1 })} onClick={() => set("steps", d.steps.filter((_, idx) => idx !== i))}>
                  <IconTrash size={18} />
                </button>
              </div>
              {offerRow("step", i)}
            </div>
          ))}
          {bulkBox("step")}
          <div className={s.listActions}>
            <Button variant="soft" size="sm" pill onClick={() => set("steps", [...d.steps, ""])}>
              <IconPlus size={16} />
              {t("form.addStep")}
            </Button>
            {bulkToggle("step")}
          </div>
        </section>

        <section className={s.details} aria-labelledby="f-ayrinti">
          <div className={s.detailsHead}>
            <h2 id="f-ayrinti" className={s.cardTitle}>
              {t("form.details")}
            </h2>
            <p className={s.formNote}>{t("form.detailsNote")}</p>
          </div>
          <details className={s.more} open={open.genel} onToggle={(e) => toggle("genel", e.currentTarget.open)}>
            <summary className={s.summary}>
              <span className={s.summaryTitle}>{t("form.sec.genel")}</span>
              <span className={s.summaryText}>{genelSummary(d)}</span>
            </summary>
            <div className={s.moreBody}>
              <div className={s.grid4}>
                <TextField label={t("form.prepMin")} inputMode="numeric" value={d.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
                <TextField
                  label={t("form.cookMin")}
                  inputMode="numeric"
                  value={d.cookMinutes}
                  onChange={(e) => set("cookMinutes", e.target.value)}
                  // Gentle only: never blocks saving.
                  hint={longCook ? t("form.longCook") : undefined}
                />
                <TextField
                  label={t("form.waitMin")}
                  inputMode="numeric"
                  placeholder="0"
                  value={d.waitMinutes}
                  onChange={(e) => set("waitMinutes", e.target.value)}
                />
                <TextField label={t("form.servings")} inputMode="numeric" value={d.servings} onChange={(e) => set("servings", e.target.value)} />
              </div>
              <p className={s.formNote}>{t("form.cookNote")}</p>
              <TextField label={t("form.tags")} hint={t("form.tagsHint")} value={d.tags} onChange={(e) => set("tags", e.target.value)} />
            </div>
          </details>
          <details className={s.more} open={open.prep} onToggle={(e) => toggle("prep", e.currentTarget.open)}>
            <summary className={s.summary}>
              <span className={s.summaryTitle}>{t("form.sec.prep")}</span>
              <span className={s.summaryText}>{prepSummary(d)}</span>
            </summary>
            <div className={s.moreBody}>
              {d.prepItems.map((p, i) => (
                <div key={i} className={s.prepRow} role="group" aria-label={t("form.prepN", { n: i + 1 })}>
                  <TextField
                    label={t("form.prepWhat")}
                    value={p.label}
                    placeholder={t("form.prepPlaceholder")}
                    onChange={(e) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <SelectField label={t("form.prepWhen")} value={p.offset} onChange={(e) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, offset: e.target.value } : x)))}>
                    {OFFSETS.map((v) => (
                      <option key={v} value={v}>
                        {t(`form.offset.${v}`)}
                      </option>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    className={s.iconBtn}
                    aria-label={t("form.removePrep", { n: i + 1 })}
                    onClick={() => set("prepItems", d.prepItems.filter((_, idx) => idx !== i))}
                  >
                    <IconTrash size={18} />
                  </button>
                  <label className={s.check} style={{ gridColumn: "1 / -1" }}>
                    <input
                      type="checkbox"
                      checked={p.freezer}
                      onChange={(e) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, freezer: e.target.checked } : x)))}
                    />
                    {t("form.freezerRelated")}
                  </label>
                </div>
              ))}
              <Button
                variant="soft"
                size="sm"
                pill
                className={s.add}
                onClick={() => set("prepItems", [...d.prepItems, { label: "", offset: "morning", freezer: false }])}
              >
                <IconPlus size={16} />
                {t("form.addPrep")}
              </Button>
              <SelectField label={t("form.freezerItem")} value={d.freezerItem} onChange={(e) => set("freezerItem", e.target.value)}>
                <option value="">{t("form.none")}</option>
                {ingredientNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </SelectField>
            </div>
          </details>
          <details className={s.more} open={open.source} onToggle={(e) => toggle("source", e.currentTarget.open)}>
            <summary className={s.summary}>
              <span className={s.summaryTitle}>{t("form.sec.source")}</span>
              <span className={s.summaryText}>{sourceSummary(d)}</span>
            </summary>
            <div className={s.moreBody}>
              <TextField
                label={t("form.source")}
                hint={t("form.sourceHint")}
                value={d.source}
                onChange={(e) => set("source", e.target.value)}
              />
              <div className={s.leftover}>
                <ChoiceChips
                  label={t("form.leftoverQ")}
                  options={policyChoices()}
                  value={d.leftoverPolicy}
                  onChange={(v) => set("leftoverPolicy", v)}
                />
                {d.leftoverPolicy === "store" && (
                  <SelectField label={t("form.keepDays")} className={s.days} value={d.leftoverDays} onChange={(e) => set("leftoverDays", e.target.value)}>
                    {["1", "2", "3", "4"].map((n) => (
                      <option key={n} value={n}>
                        {t("form.days", { count: Number(n) })}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
              <p className={s.formNote}>{t("form.lunchNote")}</p>
            </div>
          </details>
        </section>

        <p role="status" className="visually-hidden">
          {bulkNote}
        </p>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <div className={s.actions}>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? t("form.saving") : submitLabel}
          </Button>
        </div>
      </form>
    </main>
  );
}
