"use client";

import { t } from "@anv/core/i18n";
import { useParams, useRouter } from "next/navigation";
import { RecipeForm } from "@/components/RecipeForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { draftForEdit, mergeEdit } from "@anv/core/services/recipeForm";
import { getLocale } from "@anv/core/i18n";
import { recipesMap, useApp } from "@/store/app";

export default function DuzenlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const recipes = useApp((x) => x.recipes);
  const rawRecipes = useApp((x) => x.rawRecipes);
  const updateRecipe = useApp((x) => x.updateRecipe);
  const recipe = recipesMap(recipes).get(id);
  if (!recipe || recipe.householdId === null) {
    return (
      <main style={{ padding: 16, maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <EmptyState
          title={recipe ? t("edit.builtinTitle") : t("edit.notFound")}
          text={recipe ? t("edit.builtinText") : t("edit.maybeDeleted")}
          actions={
            recipe ? (
              <ButtonLink href={`/tarifler/yeni?kopya=${recipe.id}`} size="sm">
                {t("edit.editCopy")}
              </ButtonLink>
            ) : (
              <ButtonLink href="/tarifler" size="sm">
                {t("edit.toRecipes")}
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
      title={t(recipe.stub ? "edit.titleComplete" : "edit.title", { name: recipe.name })}
      initial={draftForEdit(rawRecipes.find((r) => r.id === recipe.id) ?? recipe, getLocale())}
      backHref={`/tarif/${recipe.id}`}
      submitLabel={t("edit.save")}
      onSubmit={async (value) => {
        await updateRecipe(recipe.id, mergeEdit(rawRecipes.find((r) => r.id === recipe.id) ?? recipe, value, getLocale()));
        router.push(`/tarif/${recipe.id}`);
      }}
    />
  );
}
