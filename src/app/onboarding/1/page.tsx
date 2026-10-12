"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Guard, Loading } from "@/components/Guard";
import { IconArrowRight, IconSearch } from "@/components/icons";
import { SimpleShell } from "@/components/SimpleShell";
import { DishChip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Field";
import type { Course, Recipe } from "@/data/models";
import { recipeLabel } from "@/domain/shopping";
import { searchKey } from "@/lib/text";
import { useApp } from "@/store/app";
import s from "../onboarding.module.css";

/** The design's suggested dishes, shown while the search box is empty. */
const SUGGESTED: { title: string; courses: Course[]; names: string[] }[] = [
  {
    title: "Çorbalar",
    courses: ["corba"],
    names: ["Mercimek çorbası", "Ezogelin çorbası", "Tarhana çorbası", "Yayla çorbası", "Domates çorbası", "Tavuk suyu çorba"],
  },
  {
    title: "Ana yemekler",
    courses: ["ana", "kahvalti"],
    names: [
      "Kuru fasulye",
      "İzmir köfte",
      "Karnıyarık",
      "İmam bayıldı",
      "Etli nohut",
      "Taze fasulye",
      "Tavuk sote",
      "Patates oturtma",
      "Mantı",
      "Fırın makarna",
      "Menemen",
      "Türlü",
    ],
  },
  {
    title: "Yanında",
    courses: ["yaninda"],
    names: ["Tereyağlı pirinç pilavı", "Bulgur pilavı", "Şehriyeli pilav", "Makarna", "Patates kızartması"],
  },
  { title: "Salata ve meze", courses: ["salata"], names: ["Cacık", "Çoban salata", "Piyaz", "Gavurdağı", "Haydari", "Turşu"] },
];

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
  const completeOnboarding = useApp((st) => st.completeOnboarding);
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
    return SUGGESTED.map((g) => {
      let items: Recipe[];
      if (!q) {
        const base = g.names.map((n) => recipes.find((r) => r.name === n)).filter((r): r is Recipe => !!r);
        const extra = recipes.filter(
          (r) => g.courses.includes(r.course) && (chosen.has(r.id) || custom.includes(r)) && !base.includes(r),
        );
        items = [...base, ...extra];
      } else {
        items = recipes
          .filter((r) => g.courses.includes(r.course) && matches(r, q))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      }
      return { title: g.title, items };
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
    if (joining || householdFull) {
      await completeOnboarding();
      router.push("/bugun");
    } else {
      router.push("/onboarding/2");
    }
  }

  return (
    <SimpleShell aside={joining || householdFull ? "Adım 1 / 1" : "Adım 1 / 2"}>
        <main className={s.main1}>
          <div className={s.intro}>
            <h1 className={s.title}>Evde en sık yaptığınız yemekler hangileri?</h1>
            <p className={s.lead}>
              Birkaç tane seçmeniz yeter. İlk haftanın planını ve eşleşme kartlarını bunlardan hazırlarız; kiler saymak yok.
            </p>
          </div>
          {joining && partner && (
            <p className={s.joined}>
              <strong>{partner.name}</strong> bunları seçmiş. İstediğini çıkar, eksik olanları ekle; seçimler ikinizin.
            </p>
          )}

          <TextField
            label="Yemek ara"
            id="yemek-ara"
            type="search"
            placeholder="ör. imam bayıldı, ezogelin…"
            icon={<IconSearch size={20} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && groups.length === 0 && query.trim()) void addUnknown();
            }}
          />

          <div className={s.groups}>
            {groups.map((g) => (
              <section key={g.title} className={s.group} aria-labelledby={`g-${g.title}`}>
                <h2 id={`g-${g.title}`} className={s.groupTitle}>
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
                <span className={s.notFoundText}>Bu isimde bir yemek bulamadık.</span>
                <button type="button" className={s.addBtn} onClick={addUnknown}>
                  “{query.trim()}” olarak ekle
                </button>
              </div>
            )}
          </div>
        </main>

        <footer className={s.footer}>
          <div className={s.footerInner}>
            <span className={s.count} role="status">
              <strong>{chosen.size} yemek</strong> seçildi · sonradan her zaman değişir
            </span>
            <button type="button" className={s.continue} onClick={next} disabled={busy}>
              {joining || householdFull ? "Başlayalım" : "Devam et"}
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
