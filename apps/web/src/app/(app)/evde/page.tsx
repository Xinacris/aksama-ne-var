"use client";

import { t } from "@anv/core/i18n";
import { useMemo, useState } from "react";
import type { PantryItem } from "@anv/core/data/models";
import { agoTime } from "@anv/core/domain/dates";
import { pantryUpdatedAt } from "@anv/core/domain/pantry";
import { now } from "@anv/core/lib/clock";
import { PantryEditDialog, PantryList, PantryQuickAdd } from "@/components/pantry/Pantry";
import { EmptyState } from "@/components/ui/Misc";
import { useApp } from "@/store/app";
import s from "./page.module.css";

/** "Evde ne var?": add, edit and remove what's at home, grouped by category. */
export default function EvdePage() {
  const pantry = useApp((x) => x.pantry);
  const answers = useApp((x) => x.pantryAnswers);
  const addPantryItems = useApp((x) => x.addPantryItems);
  const removePantryItem = useApp((x) => x.removePantryItem);
  const setNotice = useApp((x) => x.setNotice);
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const names = useMemo(() => new Map(pantry.map((p) => [p.name, p])), [pantry]);
  const updated = pantryUpdatedAt(pantry, answers);

  async function add(name: string) {
    const n = await addPantryItems([{ name }]);
    setNotice({ kind: "info", text: n ? t("pantry.added", { count: n }) : t("pantry.alreadyThere") });
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <span className={s.eyebrow}>{updated ? t("pantry.updated", { when: agoTime(updated, now()) }) : t("pantry.never")}</span>
        <h1 className={s.title}>{t("pantry.title")}</h1>
        <p className={s.lead}>{t("pantry.lead")}</p>
      </header>
      <div className={s.cols}>
        <section className={s.card} aria-labelledby="evde-ekle">
          <h2 id="evde-ekle" className={s.cardTitle}>
            {t("pantry.addTitle")}
          </h2>
          <PantryQuickAdd
            isOn={(n) => names.has(n)}
            onToggle={(n) => {
              const p = names.get(n);
              if (p) void removePantryItem(p.id);
              else void add(n);
            }}
            onAdd={(n) => void add(n)}
          />
        </section>
        <section className={s.list} aria-label={t("pantry.groups")}>
          <span className={s.count} role="status">
            {t("pantry.items", { count: pantry.length })}
          </span>
          {pantry.length ? <PantryList items={pantry} onEdit={setEditing} /> : <EmptyState title={t("pantry.emptyTitle")} text={t("pantry.emptyText")} />}
        </section>
      </div>
      <PantryEditDialog item={editing} onClose={() => setEditing(null)} />
    </main>
  );
}
