import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { draftFromRecipe, emptyDraft } from "@anv/core/services/recipeForm";
import { RecipeForm } from "@/components/RecipeForm";
import { recipesMap, useApp } from "@/store";

/** Full form for a new recipe (or "bizim usul" copy of a built-in one). */
export default function NewRecipe() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ ad?: string; kopya?: string }>();
  const recipes = useApp((x) => x.recipes);
  const createRecipe = useApp((x) => x.createRecipe);
  const source = params.kopya ? recipesMap(recipes).get(params.kopya) : undefined;
  const initial = useMemo(() => (source ? draftFromRecipe(source, true) : emptyDraft(params.ad ?? "")), [source, params.ad]);
  return (
    <>
      <Stack.Screen options={{ title: source ? t("form.copyTitle", { name: source.name }) : t("quickAdd.title") }} />
      <RecipeForm
        key={source?.id ?? "new"}
        initial={initial}
        openFilled={!!source}
        submitLabel={t("form.saveRecipe")}
        onSubmit={async (value) => {
          const r = await createRecipe(value);
          if (r) router.replace(`/tarif/${r.id}`);
        }}
      />
    </>
  );
}
