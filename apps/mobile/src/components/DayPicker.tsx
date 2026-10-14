import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Match, Recipe } from "@anv/core/data/models";
import { SLOT_LABEL } from "@anv/core/data/models";
import { addDays, dayName } from "@anv/core/domain/dates";
import { courseToSlot } from "@anv/core/domain/matching";
import { menuFor } from "@anv/core/domain/plan";
import { recipeLabel } from "@anv/core/domain/shopping";
import { touchTarget } from "@anv/core/design/tokens";
import { recipesMap, useApp } from "@/store";
import { useTheme } from "@/theme";
import { Sheet, Text } from "@/ui";

export interface DayTarget {
  recipe: Recipe;
  match?: Match;
  /** A dolapta dish: only evenings until its use-by day; the list skips its ingredients. */
  leftover?: { fromDate: string; useBy: string };
}

/** "Hangi akşama?" — choose an evening for a dish (match, favourite, recipe page, fridge). */
export function DayPicker({ target, onClose }: { target: DayTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = useApp((x) => x.today);
  const planItems = useApp((x) => x.planItems);
  const recipes = useApp((x) => x.recipes);
  const addToPlan = useApp((x) => x.addToPlan);
  const placeLeftover = useApp((x) => x.placeLeftover);
  const byId = recipesMap(recipes);
  const slot = target ? (courseToSlot(target.recipe.course) ?? (target.leftover ? "ana" : null)) : null;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => !target?.leftover || d <= target.leftover.useBy);

  async function pick(date: string) {
    if (!target || !slot) return;
    if (target.leftover) await placeLeftover({ fromDate: target.leftover.fromDate, recipeId: target.recipe.id, toDate: date, slot });
    else await addToPlan({ date, slot, recipeId: target.recipe.id, source: target.match ? "match" : "manual", matchId: target.match?.id });
    onClose();
  }

  return (
    <Sheet visible={!!target} onClose={onClose} title={target?.leftover ? t("dlg.fromFridgeWhen") : t("dlg.whichEvening")} closeLabel={t("common.close")}>
      {target && <Text weight="semibold">{target.recipe.name}</Text>}
      {slot ? (
        <View style={{ gap: 8 }}>
          {dates.map((d) => {
            const current = menuFor(planItems, d)[slot];
            const cur = current ? byId.get(current.recipeId) : null;
            return (
              <Pressable
                key={d}
                onPress={() => pick(d)}
                accessibilityRole="button"
                style={({ pressed }) => ({ minHeight: touchTarget + 8, borderRadius: 16, padding: 12, backgroundColor: pressed ? colors.surface2 : colors.surface, gap: 2 })}
              >
                <Text weight="bold">{d === today ? t("dlg.tonight") : dayName(d)}</Text>
                <Text variant="meta">{cur ? t("dlg.instead", { slot: SLOT_LABEL[slot], dish: recipeLabel(cur) }) : t("dlg.empty", { slot: SLOT_LABEL[slot] })}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text color={colors.ink2}>{t("dlg.noDessertSlot")}</Text>
      )}
    </Sheet>
  );
}
