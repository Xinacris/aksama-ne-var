import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { COURSES, COURSE_LABEL, type Course, type Recipe } from "@anv/core/data/models";
import { cuisineLabelKey } from "@anv/core/recipes/cuisines";
import { byCuisine, cuisinesIn } from "@anv/core/recipes/filters";
import type { Cuisine } from "@anv/core/recipes/schema";
import { formatDuration } from "@anv/core/domain/dates";
import { quickAddIntent } from "@anv/core/domain/quickAdd";
import { daysSinceCooked, lastCookedMap, rotationShort } from "@anv/core/domain/rotation";
import { labelRecord, tagLabel } from "@anv/core/i18n";
import { searchKey } from "@anv/core/lib/text";
import { space, touchTarget } from "@anv/core/design/tokens";
import { QuickAddSheet, useQuickAdd } from "@/components/QuickAdd";
import { browsableRecipes, useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Chip, EmptyState, Field, IconButton, Row, Text } from "@/ui";
import { TabHeader } from "@/ui/more";

const COURSE_SHORT = labelRecord<Course>("courseShort", COURSES);

/** Tarifler: search, course and tag filters, favourites; "Yeni tarif" opens quick add. */
export default function Recipes() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    for (const r of recipes) for (const tg of r.tags) counts.set(tg, (counts.get(tg) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .slice(0, 12)
      .map(([tg]) => tg);
  }, [recipes]);

  const list = useMemo(() => {
    const k = searchKey(q);
    return recipes
      .filter((r) => (course === "all" ? true : course === "fav" ? fav.has(r.id) : r.course === course))
      .filter((r) => !tag || r.tags.includes(tag))
      .filter(byCuisine(cuisine))
      .filter((r) => !k || searchKey(r.name).includes(k) || searchKey(r.shortName ?? "").includes(k) || r.ingredients.some((i) => searchKey(i.name).includes(k)))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [recipes, q, course, tag, fav, cuisine]);

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <TabHeader
        eyebrow={t("tarifler.eyebrow", { count: recipes.length })}
        title={t("tarifler.title")}
        right={<Button title={t("tarifler.new")} icon="plus" size="sm" onPress={() => setAdding(true)} testID="new-recipe" />}
      />
      <Field label={t("tarifler.search")} hideLabel placeholder={t("tarifler.searchPlaceholder")} icon="search" value={q} onChangeText={setQ} returnKeyType="search" clearButtonMode="while-editing" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t("tarifler.byCourse")}>
        <Chip label={t("tarifler.all")} selected={course === "all"} onPress={() => setCourse("all")} />
        <Chip label={t("tarifler.favorites")} selected={course === "fav"} onPress={() => setCourse("fav")} />
        {COURSES.map((c) => (
          <Chip key={c} label={COURSE_SHORT[c]} selected={course === c} onPress={() => setCourse(c)} />
        ))}
      </ScrollView>
      {cuisines.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t("recipe.cuisine")}>
          <Chip label={t("recipe.allCuisines")} selected={cuisine === "all"} onPress={() => setCuisine("all")} />
          {cuisines.map((c) => (
            <Chip key={c} label={t(cuisineLabelKey(c, "long"))} selected={cuisine === c} onPress={() => setCuisine(c)} />
          ))}
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t("tarifler.byTag")}>
        {tags.map((tg) => (
          <Chip key={tg} tone="sand" label={tagLabel(tg)} selected={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
        ))}
      </ScrollView>
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="meta" accessibilityLiveRegion="polite">
          {t("tarifler.count", { count: list.length })}
        </Text>
        <Button title={t("tarifler.fromLink")} icon="link" variant="ghost" size="sm" onPress={() => router.push("/tarifler/ice-aktar")} />
      </Row>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxxl, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => <RecipeRow r={item} fav={fav.has(item.id)} meta={meta(item)} onFav={() => toggleFavorite(item.id)} />}
        ListEmptyComponent={
          <EmptyState title={t("tarifler.noResults")} text={t(q.trim() ? "tarifler.noResultsName" : "tarifler.noResultsFilter")}>
            {quickAddIntent(q).kind === "empty" ? (
              <Button title={t("tarifler.add")} size="sm" onPress={() => setAdding(true)} />
            ) : (
              <Button
                title={quickAddIntent(q).kind === "name" ? t("tarifler.addNamed", { name: q.trim() }) : t("quickAdd.importLink")}
                size="sm"
                busy={quick.busy}
                onPress={() => void quick.go(quickAddIntent(q))}
              />
            )}
          </EmptyState>
        }
      />
      <QuickAddSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );

  function meta(r: Recipe) {
    return `${COURSE_LABEL[r.course]} · ${r.stub ? t("tarifler.pendingDetails") : r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)} · ${rotationShort(daysSinceCooked(r.id, last, today))}`;
  }
}

function RecipeRow({ r, fav, meta, onFav }: { r: Recipe; fav: boolean; meta: string; onFav: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
      <Pressable
        onPress={() => router.push(`/tarif/${r.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`${r.name}, ${meta}`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: touchTarget }}
      >
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.sandSoft }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="bold">{r.name}</Text>
          <Text variant="meta" numberOfLines={2}>
            {meta}
          </Text>
          {r.householdId && (
            <Text variant="small" weight="bold" color={colors.olive}>
              {t("tarifler.ours")}
            </Text>
          )}
        </View>
      </Pressable>
      <IconButton
        icon={fav ? "heart" : "heartOutline"}
        color={fav ? colors.tomato : colors.ink2}
        label={t(fav ? "tarifler.unfav" : "tarifler.fav", { name: r.name })}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          onFav();
        }}
      />
    </View>
  );
}
