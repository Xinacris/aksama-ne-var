"use client";

import { useParams, useRouter } from "next/navigation";
import { RecipeForm } from "@/components/RecipeForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { draftFromRecipe } from "@anv/core/services/recipeForm";
import { recipesMap, useApp } from "@/store/app";

export default function DuzenlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const recipes = useApp((x) => x.recipes);
  const updateRecipe = useApp((x) => x.updateRecipe);
  const recipe = recipesMap(recipes).get(id);
  if (!recipe || recipe.householdId === null) {
    return (
      <main style={{ padding: 16, maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <EmptyState
          title={recipe ? "Hazır tarifler düzenlenmez" : "Bu tarifi bulamadık"}
          text={recipe ? "Size özel bir kopyasını açıp istediğiniz gibi değiştirebilirsiniz." : "Silinmiş olabilir."}
          actions={
            recipe ? (
              <ButtonLink href={`/tarifler/yeni?kopya=${recipe.id}`} size="sm">
                Kopyasını düzenle
              </ButtonLink>
            ) : (
              <ButtonLink href="/tarifler" size="sm">
                Tariflere git
              </ButtonLink>
            )
          }
        />
      </main>
    );
  }
  return (
    <RecipeForm
      key={recipe.id}
      title={recipe.stub ? `${recipe.name} · tarifi tamamla` : `${recipe.name} · düzenle`}
      initial={draftFromRecipe(recipe)}
      backHref={`/tarif/${recipe.id}`}
      submitLabel="Değişiklikleri kaydet"
      onSubmit={async (value) => {
        await updateRecipe(recipe.id, value);
        router.push(`/tarif/${recipe.id}`);
      }}
    />
  );
}
