"use client";

import { t } from "@anv/core/i18n";
import { ONBOARDING_GROUPS } from "@anv/core/domain/onboarding";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Guard, Loading } from "@/components/Guard";
import { IconArrowRight, IconSearch } from "@/components/icons";
import { SimpleShell } from "@/components/SimpleShell";
import { DishChip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Field";
import type { Recipe } from "@anv/core/data/models";
import { recipeLabel } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { useApp } from "@/store/app";
import s from "../onboarding.module.css";

function matches(r: Recipe, q: string) {
  return searchKey(r.name).includes(q) || (r.shortName ? searchKey(r.shortName).includes(q) : false);
}

function Step1() {
  const router = useRouter();
  const params = useSearchParams();
  const joining = params.get("katil") === "1";
  const status = useApp((st) => st.status);
  const recipes = useApp((st) => st.recipes);
  const favorites = useApp((st) => st.favorites);
  const members = useApp((st) => st.members);
  const people = useApp((st) => st.people);
  const me = useApp((st) => st.me);
  const createHousehold = useApp((st) => st.createHousehold);
  const setFavorites = useApp((st) => st.setFavorites);
  const addStubRecipe = useApp((st) => st.addStubRecipe);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = useRef(false);

  // A brand-new account may arrive here before its household exists.
  useEffect(() => {
    if (status === "no-household" && !joining && !creating.current) {
      creating.current = true;
      void createHousehold().then(() => useApp.getState().refresh());
    }
  }, [status, joining, createHousehold]);

  // Start from the household's favorites (an invited partner sees the inviter's picks).
  const initial = useMemo(() => new Set(favorites.map((f) => f.recipeId)), [favorites]);
  const chosen = selected ?? initial;

  const q = searchKey(query);
  const groups = useMemo(() => {
    const custom = recipes.filter((r) => r.householdId !== null);
    return ONBOARDING_GROUPS.map((g) => {
      let items: Recipe[];
      if (!q) {
        const base = g.ids.map((id) => recipes.find((r) => r.id === id)).filter((r): r is Recipe => !!r);
        const extra = recipes.filter(
          (r) => g.courses.includes(r.course) && (chosen.has(r.id) || custom.includes(r)) && !base.includes(r),
        );
        items = [...base, ...extra];
      } else {
        items = recipes
          .filter((r) => g.courses.includes(r.course) && matches(r, q))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      }
      return { key: g.key, title: t(`onb1.group.${g.key}`), items };
    }).filter((g) => g.items.length > 0);
  }, [recipes, q, chosen]);

  if (status !== "ready") return <Loading />;

  const partner = people.find((p) => p.id !== me?.id);
  const householdFull = members.length >= 2;

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function addUnknown() {
    const r = await addStubRecipe(query);
    const next = new Set(chosen);
    next.add(r.id);
    setSelected(next);
    setQuery("");
  }

  async function next() {
    setBusy(true);
    await setFavorites([...chosen]);
    // Next: "Evde ne var?" (skippable); it is the last step for a partner who joined.
    router.push(joining || householdFull ? "/onboarding/evde?son=1" : "/onboarding/evde");
  }

  return (
    <SimpleShell aside={t(joining || householdFull ? "onb1.step11" : "onb1.step12")}>
        <main className={s.main1}>
          <div className={s.intro}>
            <h1 className={s.title}>{t("onb1.title")}</h1>
            <p className={s.lead}>
              {t("onb1.lead")}
            </p>
          </div>
          {joining && partner && (
            <p className={s.joined}>
              <strong>{partner.name}</strong> {t("onb1.partnerPicked")}
            </p>
          )}

          <TextField
            label={t("onb1.search")}
            id="yemek-ara"
            type="search"
            placeholder={t("onb1.searchPlaceholder")}
            icon={<IconSearch size={20} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && groups.length === 0 && query.trim()) void addUnknown();
            }}
          />

          <div className={s.groups}>
            {groups.map((g) => (
              <section key={g.key} className={s.group} aria-labelledby={`g-${g.key}`}>
                <h2 id={`g-${g.key}`} className={s.groupTitle}>
                  {g.title}
                </h2>
                <div className={s.chips}>
                  {g.items.map((r) => (
                    <DishChip key={r.id} selected={chosen.has(r.id)} onClick={() => toggle(r.id)}>
                      {recipeLabel(r)}
                    </DishChip>
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && query.trim() && (
              <div className={s.notFound}>
                <span className={s.notFoundText}>{t("onb1.notFound")}</span>
                <button type="button" className={s.addBtn} onClick={addUnknown}>
                  {t("onb1.addAs", { name: query.trim() })}
                </button>
              </div>
            )}
          </div>
        </main>

        <footer className={s.footer}>
          <div className={s.footerInner}>
            <span className={s.count} role="status">
              <strong>{t("onb1.chosen", { count: chosen.size })}</strong>
              {t("onb1.chosenTail")}
            </span>
            <button type="button" className={s.continue} onClick={next} disabled={busy}>
              {t("onb1.continue")}
              <IconArrowRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        </footer>
    </SimpleShell>
  );
}

export default function OnboardingStep1() {
  return (
    <Guard need="auth">
      <Suspense fallback={<Loading />}>
        <Step1 />
      </Suspense>
    </Guard>
  );
}
