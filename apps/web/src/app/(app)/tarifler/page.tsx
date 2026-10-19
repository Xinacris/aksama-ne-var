"use client";

import { labelRecord, t, tagLabel } from "@anv/core/i18n";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconHeart, IconHeartOutline, IconLink, IconPlus, IconSearch } from "@/components/icons";
import { QuickAddSheet, useQuickAdd } from "@/components/QuickAdd";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DishChip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/Misc";
import { COURSES, COURSE_LABEL, type Course } from "@anv/core/data/models";
import { cuisineLabelKey } from "@anv/core/recipes/cuisines";
import { byCuisine, cuisinesIn } from "@anv/core/recipes/filters";
import type { Cuisine } from "@anv/core/recipes/schema";
import { formatDuration } from "@anv/core/domain/dates";
import { quickAddIntent } from "@anv/core/domain/quickAdd";
import { daysSinceCooked, lastCookedMap, rotationShort } from "@anv/core/domain/rotation";
import { searchKey } from "@anv/core/lib/text";
import { browsableRecipes, useApp } from "@/store/app";
import s from "./page.module.css";

const COURSE_SHORT = labelRecord<Course>("courseShort", COURSES);

export default function TariflerPage() {
  const recipes = useApp(browsableRecipes);
  const favorites = useApp((x) => x.favorites);
  const cookLog = useApp((x) => x.cookLog);
  const today = useApp((x) => x.today);
  const toggleFavorite = useApp((x) => x.toggleFavorite);
  const [q, setQ] = useState("");
  const [course, setCourse] = useState<Course | "all" | "fav">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState<Cuisine | "all">("all");
  const cuisines = useMemo(() => cuisinesIn(recipes), [recipes]);
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
      .filter(byCuisine(cuisine))
      .filter(
        (r) =>
          !k ||
          searchKey(r.name).includes(k) ||
          searchKey(r.shortName ?? "").includes(k) ||
          r.ingredients.some((i) => searchKey(i.name).includes(k)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [recipes, q, course, tag, fav, cuisine]);

  return (
    <main className={s.page}>
      <div className={s.head}>
        <div className={s.titles}>
          <span className={s.eyebrow}>{t("tarifler.eyebrow", { count: recipes.length })}</span>
          <h1 className={s.title}>{t("tarifler.title")}</h1>
        </div>
        <div className={s.headActions}>
          <ButtonLink href="/tarifler/ice-aktar" size="sm" pill variant="secondary">
            <IconLink size={16} />
            {t("tarifler.fromLink")}
          </ButtonLink>
          <Button size="sm" pill onClick={() => setAdding(true)} aria-haspopup="dialog">
            <IconPlus size={16} />
            {t("tarifler.new")}
          </Button>
        </div>
      </div>

      <TextField
        label={t("tarifler.search")}
        hideLabel
        type="search"
        placeholder={t("tarifler.searchPlaceholder")}
        icon={<IconSearch size={20} />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className={s.filters} role="group" aria-label={t("tarifler.byCourse")}>
        <DishChip selected={course === "all"} onClick={() => setCourse("all")}>
          {t("tarifler.all")}
        </DishChip>
        <DishChip selected={course === "fav"} onClick={() => setCourse("fav")}>
          {t("tarifler.favorites")}
        </DishChip>
        {COURSES.map((c) => (
          <DishChip key={c} selected={course === c} onClick={() => setCourse(c)}>
            {COURSE_SHORT[c]}
          </DishChip>
        ))}
      </div>

      {cuisines.length > 1 && (
        <div className={s.filters} role="group" aria-label={t("recipe.cuisine")}>
          <DishChip selected={cuisine === "all"} onClick={() => setCuisine("all")}>
            {t("recipe.allCuisines")}
          </DishChip>
          {cuisines.map((c) => (
            <DishChip key={c} selected={cuisine === c} onClick={() => setCuisine(c)}>
              {t(cuisineLabelKey(c, "long"))}
            </DishChip>
          ))}
        </div>
      )}

      <div className={s.tagRow} role="group" aria-label={t("tarifler.byTag")}>
        {tags.map((tg) => (
          <button key={tg} type="button" className={s.tagBtn} aria-pressed={tag === tg} onClick={() => setTag(tag === tg ? null : tg)}>
            {tagLabel(tg)}
          </button>
        ))}
      </div>

      <span className={s.count} role="status">
        {t("tarifler.count", { count: list.length })}
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
                  {COURSE_LABEL[r.course]} · {r.stub ? t("tarifler.pendingDetails") : r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)} ·{" "}
                  {rotationShort(daysSinceCooked(r.id, last, today))}
                </span>
                {r.householdId && <span className={s.badge}>{t("tarifler.ours")}</span>}
              </div>
              <button
                type="button"
                className={s.fav}
                aria-pressed={fav.has(r.id)}
                aria-label={t(fav.has(r.id) ? "tarifler.unfav" : "tarifler.fav", { name: r.name })}
                onClick={() => toggleFavorite(r.id)}
              >
                {fav.has(r.id) ? <IconHeart size={20} /> : <IconHeartOutline size={20} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t("tarifler.noResults")}
          text={t(q.trim() ? "tarifler.noResultsName" : "tarifler.noResultsFilter")}
          actions={
            quickAddIntent(q).kind === "empty" ? (
              <Button size="sm" onClick={() => setAdding(true)} aria-haspopup="dialog">
                {t("tarifler.add")}
              </Button>
            ) : (
              // One tap: a name is saved, a link goes to import.
              <Button size="sm" disabled={quick.busy} onClick={() => void quick.go(quickAddIntent(q))}>
                {quickAddIntent(q).kind === "name" ? t("tarifler.addNamed", { name: q.trim() }) : t("quickAdd.importLink")}
              </Button>
            )
          }
        />
      )}
      {adding && <QuickAddSheet open onClose={() => setAdding(false)} />}
    </main>
  );
}
