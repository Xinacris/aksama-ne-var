import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Match, Recipe, Slot } from "@anv/core/data/models";
import { SLOTS, SLOT_LABEL } from "@anv/core/data/models";
import { addDays, dayName } from "@anv/core/domain/dates";
import { dropMessage, slotForRecipe } from "@anv/core/domain/placement";
import { menuFor } from "@anv/core/domain/plan";
import { recipeLabel } from "@anv/core/domain/shopping";
import { touchTarget } from "@anv/core/design/tokens";
import { browsableRecipes, recipesMap, useApp } from "@/store";
import { useTheme } from "@/theme";
import { snapNextLayout } from "@/ui/motion";
import { Sheet, Text } from "@/ui";

export interface DayTarget {
  recipe: Recipe;
  match?: Match;
  /** A dolapta dish: only evenings until its use-by day; the list skips its ingredients. */
  leftover?: { fromDate: string; useBy: string };
}

function Choice({ title, sub, onPress, testID }: { title: string; sub?: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => ({ minHeight: touchTarget + 8, borderRadius: 16, padding: 12, backgroundColor: pressed ? colors.surface2 : colors.surface, gap: 2, justifyContent: "center" })}
    >
      <Text weight="bold">{title}</Text>
      {sub ? <Text variant="meta">{sub}</Text> : null}
    </Pressable>
  );
}

/** The five slots, for a recipe without a category ("which slot?", asked once and saved on the recipe). */
export function SlotChoices({ onPick }: { onPick: (slot: Slot) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {SLOTS.map((sl) => (
        <Choice key={sl} title={SLOT_LABEL[sl]} onPress={() => onPick(sl)} testID={`slot-choice-${sl}`} />
      ))}
    </View>
  );
}

/** "Güne ekle": choose a day for a dish (match, favourite, recipe list, recipe page, fridge). It lands in its own slot. */
export function DayPicker({ target, onClose }: { target: DayTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
  const today = useApp((x) => x.today);
  const planItems = useApp((x) => x.planItems);
  const recipes = useApp(browsableRecipes);
  const dropOnDay = useApp((x) => x.dropOnDay);
  const placeLeftover = useApp((x) => x.placeLeftover);
  const setNotice = useApp((x) => x.setNotice);
  const [chosen, setChosen] = useState<{ id: string; slot: Slot } | null>(null);
  const byId = recipesMap(recipes);
  const own = target ? slotForRecipe(target.recipe) : null;
  const answer = chosen && target && chosen.id === target.recipe.id ? chosen.slot : null;
  const slot = target?.leftover ? (own ?? "ana") : (own ?? answer);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => !target?.leftover || d <= target.leftover.useBy);
  const close = () => {
    setChosen(null);
    onClose();
  };

  async function pick(date: string) {
    if (!target || !slot) return;
    if (target.leftover) await placeLeftover({ fromDate: target.leftover.fromDate, recipeId: target.recipe.id, toDate: date, slot });
    else {
      snapNextLayout();
      const res = await dropOnDay({ date, recipeId: target.recipe.id, origin: target.match ? "match" : "recipe", matchId: target.match?.id, slot: own ? undefined : slot });
      setNotice({ kind: "info", text: dropMessage(res, { name: target.recipe.name, date, recipesById: byId }) });
    }
    close();
  }

  const title = target?.leftover ? t("dlg.fromFridgeWhen") : slot ? t("place.whichDay") : t("board.askSlot");
  return (
    <Sheet visible={!!target} onClose={close} title={title} closeLabel={t("common.close")}>
      {target && <Text weight="semibold">{slot ? target.recipe.name : t("place.askTitle", { name: target.recipe.name })}</Text>}
      {target && !slot ? (
        <>
          <Text variant="meta">{t("place.askText")}</Text>
          <SlotChoices onPick={(sl) => setChosen({ id: target.recipe.id, slot: sl })} />
        </>
      ) : slot ? (
        <View style={{ gap: 8 }}>
          {dates.map((d) => {
            const current = menuFor(planItems, d)[slot];
            const cur = current ? byId.get(current.recipeId) : null;
            const here = !!target && planItems.some((i) => i.date === d && i.recipeId === target.recipe.id);
            return (
              <Choice
                key={d}
                title={d === today ? t("dlg.tonight") : dayName(d)}
                sub={here ? t("place.onDay", { name: target!.recipe.name, day: dayName(d) }) : cur ? t("dlg.instead", { slot: SLOT_LABEL[slot], dish: recipeLabel(cur) }) : t("dlg.empty", { slot: SLOT_LABEL[slot] })}
                onPress={() => pick(d)}
                testID={`day-choice-${d}`}
              />
            );
          })}
        </View>
      ) : null}
    </Sheet>
  );
}
