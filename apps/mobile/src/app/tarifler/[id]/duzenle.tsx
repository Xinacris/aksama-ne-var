import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { draftFromRecipe } from "@anv/core/services/recipeForm";
import { RecipeForm } from "@/components/RecipeForm";
import { recipesMap, useApp } from "@/store";
import { Button, EmptyState, Screen } from "@/ui";

/** Edit a household recipe ("Ayrıntıları ekle" for name-only ones). Built-ins open a copy instead. */
export default function EditRecipe() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipes = useApp((x) => x.recipes);
  const updateRecipe = useApp((x) => x.updateRecipe);
  const recipe = recipesMap(recipes).get(id);
  if (!recipe || recipe.householdId === null) {
    return (
      <Screen>
        <EmptyState title={recipe ? t("edit.builtinTitle") : t("edit.notFound")} text={recipe ? t("edit.builtinText") : t("edit.maybeDeleted")}>
          <Button
            title={recipe ? t("edit.editCopy") : t("edit.toRecipes")}
            size="sm"
            onPress={() => router.replace(recipe ? `/tarifler/yeni?kopya=${recipe.id}` : "/tarifler")}
          />
        </EmptyState>
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t(recipe.stub ? "edit.titleComplete" : "edit.title", { name: recipe.name }) }} />
      <RecipeForm
        key={recipe.id}
        initial={draftFromRecipe(recipe)}
        submitLabel={t("edit.save")}
        onSubmit={async (value) => {
          await updateRecipe(recipe.id, value);
          router.back();
        }}
      />
    </>
  );
}
