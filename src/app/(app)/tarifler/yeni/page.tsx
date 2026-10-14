"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Loading } from "@/components/Guard";
import { RecipeForm } from "@/components/RecipeForm";
import { draftFromRecipe, emptyDraft } from "@/services/recipeForm";
import { recipesMap, useApp } from "@/store/app";

function Yeni() {
  const router = useRouter();
  const params = useSearchParams();
  const recipes = useApp((x) => x.recipes);
  const createRecipe = useApp((x) => x.createRecipe);
  const copyId = params.get("kopya");
  const source = copyId ? recipesMap(recipes).get(copyId) : undefined;
  const initial = useMemo(() => (source ? draftFromRecipe(source, true) : emptyDraft(params.get("ad") ?? "")), [source, params]);
  return (
    <RecipeForm
      key={source?.id ?? "new"}
      title={source ? `${source.name} · bizim usul` : "Yeni tarif"}
      initial={initial}
      backHref={source ? `/tarif/${source.id}` : "/tarifler"}
      submitLabel="Tarifi kaydet"
      openFilled={!!source}
      onSubmit={async (value) => {
        const r = await createRecipe(value);
        if (r) router.push(`/tarif/${r.id}`);
      }}
    />
  );
}

export default function YeniTarifPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Yeni />
    </Suspense>
  );
}
