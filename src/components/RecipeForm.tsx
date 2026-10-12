"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AISLES, COURSES, COURSE_LABEL, UNITS } from "@/data/models";
import { catalogEntry, INGREDIENT_CATALOG, normalizeIngredientName } from "@/data/seed/ingredients";
import { emptyIngredient, parseDraft, type RecipeDraft } from "@/services/recipeForm";
import type { RecipeInput } from "@/store/app";
import { IconChevronLeft, IconPlus, IconTrash } from "./icons";
import { Button } from "./ui/Button";
import { SelectField, TextArea, TextField } from "./ui/Field";
import s from "./RecipeForm.module.css";

const OFFSETS: [string, string][] = [
  ["night-before", "Akşamdan"],
  ["morning", "Sabah"],
  ["-120min", "2 sa önce"],
  ["-90min", "1,5 sa önce"],
  ["-60min", "1 sa önce"],
  ["-45min", "45 dk önce"],
  ["-30min", "30 dk önce"],
  ["-15min", "15 dk önce"],
];

export function RecipeForm({
  title,
  initial,
  backHref,
  submitLabel,
  onSubmit,
}: {
  title: string;
  initial: RecipeDraft;
  backHref: string;
  submitLabel: string;
  onSubmit: (value: RecipeInput) => Promise<void>;
}) {
  const [d, setD] = useState<RecipeDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = parseDraft(d);
    if (!res.ok) {
      setError(res.error);
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

  const ingredientNames = d.ingredients.map((i) => normalizeIngredientName(i.name)).filter(Boolean);

  return (
    <main className={s.page}>
      <Link href={backHref} className={s.back}>
        <IconChevronLeft size={20} />
        Geri
      </Link>
      <h1 className={s.title}>{title}</h1>
      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section className={s.card} aria-labelledby="f-genel">
          <h2 id="f-genel" className={s.cardTitle}>
            Genel
          </h2>
          <TextField label="Tarifin adı" value={d.name} onChange={(e) => set("name", e.target.value)} required />
          <SelectField label="Öğün" value={d.course} onChange={(e) => set("course", e.target.value)}>
            {COURSES.map((c) => (
              <option key={c} value={c}>
                {COURSE_LABEL[c]}
              </option>
            ))}
          </SelectField>
          <div className={s.grid3}>
            <TextField label="Hazırlık (dk)" inputMode="numeric" value={d.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
            <TextField label="Pişirme (dk)" inputMode="numeric" value={d.cookMinutes} onChange={(e) => set("cookMinutes", e.target.value)} />
            <TextField label="Kaç kişilik" inputMode="numeric" value={d.servings} onChange={(e) => set("servings", e.target.value)} />
          </div>
          <TextField label="Etiketler" hint="Virgülle ayır: Fırında, Kıymalı, Akşamdan ıslat" value={d.tags} onChange={(e) => set("tags", e.target.value)} />
          <TextField
            label="Kaynak"
            hint="Serbest metin: “Instagram'dan içe aktarıldı”, “Annemin defteri” ya da bir link."
            value={d.source}
            onChange={(e) => set("source", e.target.value)}
          />
          <label className={s.check}>
            <input type="checkbox" checked={d.leftoverFriendly} onChange={(e) => set("leftoverFriendly", e.target.checked)} />
            Ertesi güne artar
          </label>
        </section>

        <section className={s.card} aria-labelledby="f-malzeme">
          <h2 id="f-malzeme" className={s.cardTitle}>
            Malzemeler
          </h2>
          <datalist id="malzeme-adlari">
            {INGREDIENT_CATALOG.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
          {d.ingredients.map((ing, i) => (
            <div key={i} className={s.ingRow} role="group" aria-label={`${i + 1}. malzeme`}>
              <div className={s.ingTop}>
                <TextField label="Malzeme" list="malzeme-adlari" value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} />
                <TextField label="Miktar" inputMode="decimal" value={ing.quantity} onChange={(e) => setIng(i, { quantity: e.target.value })} />
                <SelectField label="Birim" value={ing.unit} onChange={(e) => setIng(i, { unit: e.target.value })}>
                  <option value="">—</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </SelectField>
                <button
                  type="button"
                  className={s.iconBtn}
                  aria-label={`${i + 1}. malzemeyi kaldır`}
                  onClick={() => set("ingredients", d.ingredients.filter((_, idx) => idx !== i))}
                >
                  <IconTrash size={18} />
                </button>
              </div>
              <div className={s.ingBottom}>
                <SelectField label="Nereden" value={ing.side} onChange={(e) => setIng(i, { side: e.target.value as "pazar" | "market" })}>
                  <option value="pazar">Pazar</option>
                  <option value="market">Market</option>
                </SelectField>
                <SelectField label="Reyon" value={ing.aisle} onChange={(e) => setIng(i, { aisle: e.target.value })}>
                  {AISLES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          ))}
          <Button variant="soft" size="sm" pill className={s.add} onClick={() => set("ingredients", [...d.ingredients, emptyIngredient()])}>
            <IconPlus size={16} />
            Malzeme ekle
          </Button>
          <SelectField label="Buzluktan çıkacak malzeme" value={d.freezerItem} onChange={(e) => set("freezerItem", e.target.value)}>
            <option value="">Yok</option>
            {ingredientNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectField>
        </section>

        <section className={s.card} aria-labelledby="f-hazirlik">
          <h2 id="f-hazirlik" className={s.cardTitle}>
            Ön hazırlık
          </h2>
          {d.prepItems.map((p, i) => (
            <div key={i} className={s.prepRow} role="group" aria-label={`${i + 1}. ön hazırlık`}>
              <TextField
                label="Ne yapılacak"
                value={p.label}
                placeholder="ör. Kıymayı buzluktan çıkar"
                onChange={(e) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
              />
              <SelectField label="Ne zaman" value={p.offset} onChange={(e) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, offset: e.target.value } : x)))}>
                {OFFSETS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </SelectField>
              <button
                type="button"
                className={s.iconBtn}
                aria-label={`${i + 1}. ön hazırlığı kaldır`}
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
                Buzlukla ilgili
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
            Ön hazırlık ekle
          </Button>
        </section>

        <section className={s.card} aria-labelledby="f-adim">
          <h2 id="f-adim" className={s.cardTitle}>
            Hazırlanışı
          </h2>
          {d.steps.map((step, i) => (
            <div key={i} className={s.stepRow}>
              <span className={s.stepNum} aria-hidden="true">
                {i + 1}
              </span>
              <TextArea label={`${i + 1}. adım`} hideLabel value={step} rows={2} onChange={(e) => set("steps", d.steps.map((x, idx) => (idx === i ? e.target.value : x)))} />
              <button type="button" className={s.iconBtn} aria-label={`${i + 1}. adımı kaldır`} onClick={() => set("steps", d.steps.filter((_, idx) => idx !== i))}>
                <IconTrash size={18} />
              </button>
            </div>
          ))}
          <Button variant="soft" size="sm" pill className={s.add} onClick={() => set("steps", [...d.steps, ""])}>
            <IconPlus size={16} />
            Adım ekle
          </Button>
        </section>

        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <div className={s.actions}>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Kaydediliyor…" : submitLabel}
          </Button>
        </div>
      </form>
    </main>
  );
}
