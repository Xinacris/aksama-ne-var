"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconHeart, IconHeartOutline, IconLink, IconPlus, IconSearch } from "@/components/icons";
import { QuickAddSheet, useQuickAdd } from "@/components/QuickAdd";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DishChip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/Misc";
import { COURSES, COURSE_LABEL, type Course } from "@anv/core/data/models";
import { formatDuration } from "@anv/core/domain/dates";
import { quickAddIntent } from "@anv/core/domain/quickAdd";
import { daysSinceCooked, lastCookedMap, rotationShort } from "@anv/core/domain/rotation";
import { searchKey } from "@anv/core/lib/text";
import { useApp } from "@/store/app";
import s from "./page.module.css";

const COURSE_SHORT: Record<Course, string> = {
  corba: "Çorba",
  ana: "Ana yemek",
  yaninda: "Yanında",
  salata: "Salata / meze",
  kahvalti: "Kahvaltı",
  tatli: "Tatlı",
};

export default function TariflerPage() {
  const recipes = useApp((x) => x.recipes);
  const favorites = useApp((x) => x.favorites);
  const cookLog = useApp((x) => x.cookLog);
  const today = useApp((x) => x.today);
  const toggleFavorite = useApp((x) => x.toggleFavorite);
  const [q, setQ] = useState("");
  const [course, setCourse] = useState<Course | "all" | "fav">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const quick = useQuickAdd();
  const fav = useMemo(() => new Set(favorites.map((f) => f.recipeId)), [favorites]);
  const last = useMemo(() => lastCookedMap(cookLog), [cookLog]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .slice(0, 12)
      .map(([t]) => t);
  }, [recipes]);

  const list = useMemo(() => {
    const k = searchKey(q);
    return recipes
      .filter((r) => (course === "all" ? true : course === "fav" ? fav.has(r.id) : r.course === course))
      .filter((r) => !tag || r.tags.includes(tag))
      .filter(
        (r) =>
          !k ||
          searchKey(r.name).includes(k) ||
          searchKey(r.shortName ?? "").includes(k) ||
          r.ingredients.some((i) => searchKey(i.name).includes(k)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [recipes, q, course, tag, fav]);

  return (
    <main className={s.page}>
      <div className={s.head}>
        <div className={s.titles}>
          <span className={s.eyebrow}>{recipes.length} tarif · evin defteri</span>
          <h1 className={s.title}>Tarifler</h1>
        </div>
        <div className={s.headActions}>
          <ButtonLink href="/tarifler/ice-aktar" size="sm" pill variant="secondary">
            <IconLink size={16} />
            Linkten ekle
          </ButtonLink>
          <Button size="sm" pill onClick={() => setAdding(true)} aria-haspopup="dialog">
            <IconPlus size={16} />
            Yeni tarif
          </Button>
        </div>
      </div>

      <TextField
        label="Tarif ya da malzeme ara"
        hideLabel
        type="search"
        placeholder="ör. karnıyarık, patlıcan…"
        icon={<IconSearch size={20} />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className={s.filters} role="group" aria-label="Öğüne göre süz">
        <DishChip selected={course === "all"} onClick={() => setCourse("all")}>
          Tümü
        </DishChip>
        <DishChip selected={course === "fav"} onClick={() => setCourse("fav")}>
          Sık yaptıklarımız
        </DishChip>
        {COURSES.map((c) => (
          <DishChip key={c} selected={course === c} onClick={() => setCourse(c)}>
            {COURSE_SHORT[c]}
          </DishChip>
        ))}
      </div>

      <div className={s.tagRow} role="group" aria-label="Etikete göre süz">
        {tags.map((t) => (
          <button key={t} type="button" className={s.tagBtn} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </button>
        ))}
      </div>

      <span className={s.count} role="status">
        {list.length} tarif
      </span>

      {list.length ? (
        <ul className={s.grid}>
          {list.map((r) => (
            <li key={r.id} className={s.card}>
              <div className={`ph ${s.thumb}`} aria-hidden="true" />
              <div className={s.texts}>
                <Link href={`/tarif/${r.id}`} className={s.link}>
                  {r.name}
                </Link>
                <span className={s.meta}>
                  {COURSE_LABEL[r.course]} · {r.stub ? "ayrıntı bekliyor" : r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)} ·{" "}
                  {rotationShort(daysSinceCooked(r.id, last, today))}
                </span>
                {r.householdId && <span className={s.badge}>Evin tarifi</span>}
              </div>
              <button
                type="button"
                className={s.fav}
                aria-pressed={fav.has(r.id)}
                aria-label={fav.has(r.id) ? `${r.name}: sık yaptıklarımızdan çıkar` : `${r.name}: sık yaptıklarımıza ekle`}
                onClick={() => toggleFavorite(r.id)}
              >
                {fav.has(r.id) ? <IconHeart size={20} /> : <IconHeartOutline size={20} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Bu aramayla tarif çıkmadı"
          text={q.trim() ? "Farklı bir kelime deneyebilir ya da bu adla hemen ekleyebilirsin; ayrıntıları sonra yazarsın." : "Farklı bir süzgeç deneyebilir ya da kendi tarifini ekleyebilirsin."}
          actions={
            quickAddIntent(q).kind === "empty" ? (
              <Button size="sm" onClick={() => setAdding(true)} aria-haspopup="dialog">
                Tarif ekle
              </Button>
            ) : (
              // One tap: a name is saved, a link goes to import.
              <Button size="sm" disabled={quick.busy} onClick={() => void quick.go(quickAddIntent(q))}>
                {quickAddIntent(q).kind === "name" ? `“${q.trim()}” ekle` : "Linkten içe aktar"}
              </Button>
            )
          }
        />
      )}
      {adding && <QuickAddSheet open onClose={() => setAdding(false)} />}
    </main>
  );
}
