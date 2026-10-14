import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Recipe } from "@anv/core/data/models";
import { ONBOARDING_GROUPS } from "@anv/core/domain/onboarding";
import { recipeLabel } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { usePeople } from "@/hooks/usePeople";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Chip, Field, Row, Screen, Text } from "@/ui";

/** Step 1: the dishes you make most (favourites seed the deck and the first week). */
export default function PickDishes() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ katil?: string }>();
  const joining = params.katil === "1";
  const recipes = useApp((s) => s.recipes);
  const favorites = useApp((s) => s.favorites);
  const members = useApp((s) => s.members);
  const setFavorites = useApp((s) => s.setFavorites);
  const addStubRecipe = useApp((s) => s.addStubRecipe);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const { partner } = usePeople();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const initial = useMemo(() => new Set(favorites.map((f) => f.recipeId)), [favorites]);
  const chosen = selected ?? initial;
  const full = members.length >= 2;
  const q = searchKey(query);

  const groups = useMemo(() => {
    const custom = recipes.filter((r) => r.householdId !== null);
    return ONBOARDING_GROUPS.map((g) => {
      let items: Recipe[];
      if (!q) {
        const base = g.ids.map((id) => recipes.find((r) => r.id === id)).filter((r): r is Recipe => !!r);
        items = [...base, ...recipes.filter((r) => g.courses.includes(r.course) && (chosen.has(r.id) || custom.includes(r)) && !base.includes(r))];
      } else {
        items = recipes.filter((r) => g.courses.includes(r.course) && (searchKey(r.name).includes(q) || searchKey(r.shortName ?? "").includes(q)));
      }
      return { key: g.key, items };
    }).filter((g) => g.items.length > 0);
  }, [recipes, q, chosen]);

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
    if (joining || full) await completeOnboarding();
    else router.push("/onboarding/davet");
    setBusy(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header>
        <Text variant="meta" weight="semibold">
          {t(joining || full ? "onb1.step11" : "onb1.step12")}
        </Text>
        <Text variant="title">{t("onb1.title")}</Text>
        <Text color={colors.ink2}>{t("onb1.lead")}</Text>
        {joining && partner && (
          <Text variant="bodySmall">
            {partner.name} {t("onb1.partnerPicked")}
          </Text>
        )}
        <Field label={t("onb1.search")} hideLabel placeholder={t("onb1.searchPlaceholder")} value={query} onChangeText={setQuery} icon="search" returnKeyType="search" />
        {groups.map((g) => (
          <View key={g.key} style={{ gap: 10 }}>
            <Text variant="h3">{t(`onb1.group.${g.key}`)}</Text>
            <Row>
              {g.items.map((r) => (
                <Chip key={r.id} label={recipeLabel(r)} selected={chosen.has(r.id)} onPress={() => toggle(r.id)} />
              ))}
            </Row>
          </View>
        ))}
        {groups.length === 0 && query.trim() ? (
          <View style={{ gap: 8 }}>
            <Text color={colors.ink2}>{t("onb1.notFound")}</Text>
            <Button title={t("onb1.addAs", { name: query.trim() })} variant="soft" onPress={addUnknown} />
          </View>
        ) : null}
        <View style={{ height: 90 }} />
      </Screen>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 32, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 }}>
        <Text variant="meta" accessibilityLiveRegion="polite">
          {t("onb1.chosen", { count: chosen.size })}
          {t("onb1.chosenTail")}
        </Text>
        <Button title={t(joining || full ? "onb1.letsStart" : "onb1.continue")} icon="arrowRight" busy={busy} onPress={next} />
      </View>
    </View>
  );
}
