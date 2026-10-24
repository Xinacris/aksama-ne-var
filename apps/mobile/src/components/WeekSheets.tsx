import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SLOT_LABEL, type LeftoverChoice, type Match, type Recipe, type Slot } from "@anv/core/data/models";
import { addDays, dayName, eveningLabel, formatDuration } from "@anv/core/domain/dates";
import type { LeftoverOutcome } from "@anv/core/domain/leftovers";
import { dropMessage, slotForRecipe } from "@anv/core/domain/placement";
import { menuFor } from "@anv/core/domain/plan";
import { recipeLabel } from "@anv/core/domain/shopping";
import type { AsideMatch } from "@anv/core/domain/week";
import { labelRecord } from "@anv/core/i18n";
import { searchKey } from "@anv/core/lib/text";
import { touchTarget } from "@anv/core/design/tokens";
import { browsableRecipes, recipesMap, useApp } from "@/store";
import { useTheme } from "@/theme";
import { snapNextLayout } from "@/ui/motion";
import { Field, Sheet, Text } from "@/ui";

function Option({ title, sub, onPress, danger }: { title: string; sub?: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ minHeight: touchTarget + 6, borderRadius: 16, padding: 12, gap: 2, justifyContent: "center", backgroundColor: pressed ? colors.surface2 : colors.surface })}
    >
      <Text weight="bold" color={danger ? colors.tomato : colors.ink}>
        {title}
      </Text>
      {sub ? <Text variant="meta">{sub}</Text> : null}
    </Pressable>
  );
}

/** Choose a dish for a day's slot: matches, frequent dishes, or search (same lists as the web dialog). */
export function RecipePicker({ target, onClose, matches, frequent }: { target: { date: string; slot: Slot } | null; onClose: () => void; matches: AsideMatch[]; frequent: Recipe[] }) {
  const { t } = useTranslation();
  const recipes = useApp(browsableRecipes);
  const today = useApp((x) => x.today);
  const dropOnDay = useApp((x) => x.dropOnDay);
  const setNotice = useApp((x) => x.setNotice);
  const [q, setQ] = useState("");
  const slot = target?.slot ?? null;
  // Category-locked: this slot's dishes, plus ones without a category (picking one answers it).
  const fits = (r: Recipe) => {
    const own = slotForRecipe(r);
    return !!slot && (own === slot || own === null);
  };
  const results = useMemo(() => {
    const k = searchKey(q);
    return recipes
      .filter((r) => {
        const own = slotForRecipe(r);
        return !!slot && (own === slot || own === null) && (!k || searchKey(r.name).includes(k) || searchKey(r.shortName ?? "").includes(k));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .slice(0, k ? 30 : 12);
  }, [recipes, q, slot]);
  async function pick(r: Recipe, match?: Match) {
    if (!target) return;
    snapNextLayout();
    const res = await dropOnDay({ date: target.date, recipeId: r.id, origin: match ? "match" : "recipe", matchId: match?.id, slot: target.slot });
    setNotice({ kind: "info", text: dropMessage(res, { name: r.name, date: target.date, recipesById: recipesMap(recipes) }) });
    setQ("");
    onClose();
  }
  const m = matches.filter((x) => x.match.status !== "placed" && fits(x.recipe));
  const f = frequent.filter(fits);
  return (
    <Sheet visible={!!target} onClose={onClose} title={target ? `${eveningLabel(target.date, today)} · ${SLOT_LABEL[target.slot]}` : ""} closeLabel={t("common.close")}>
      {m.length > 0 && <Text variant="label">{t("week.fromMatches")}</Text>}
      {m.map((x) => (
        <Option key={x.match.id} title={x.recipe.name} sub={x.note} onPress={() => pick(x.recipe, x.match)} />
      ))}
      {f.length > 0 && <Text variant="label">{t("week.frequent")}</Text>}
      {f.map((r) => (
        <Option key={r.id} title={r.name} sub={r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)} onPress={() => pick(r)} />
      ))}
      <Text variant="label">{t("dlg.allRecipes")}</Text>
      <Field label={t("dlg.searchRecipe")} hideLabel placeholder={t("dlg.searchRecipeDots")} icon="search" value={q} onChangeText={setQ} />
      {results.length ? results.map((r) => <Option key={r.id} title={r.name} sub={r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)} onPress={() => pick(r)} />) : <Text variant="meta">{t("dlg.noSuchRecipe")}</Text>}
    </Sheet>
  );
}

/** A planned dish: open it, swap it, move it to another evening (no drag-and-drop on phones), or remove it. */
export function SlotSheet({
  target,
  onClose,
  onReplace,
}: {
  target: { itemId: string; date: string; slot: Slot; recipe: Recipe | null } | null;
  onClose: () => void;
  onReplace: (date: string, slot: Slot) => void;
}) {
  const { t } = useTranslation();
  const today = useApp((x) => x.today);
  const planItems = useApp((x) => x.planItems);
  const recipes = useApp(browsableRecipes);
  const removeFromPlan = useApp((x) => x.removeFromPlan);
  const moveToDay = useApp((x) => x.moveToDay);
  const setNotice = useApp((x) => x.setNotice);
  const [moving, setMoving] = useState(false);
  const byId = recipesMap(recipes);
  const close = () => {
    setMoving(false);
    onClose();
  };
  if (!target) return <Sheet visible={false} onClose={close} title="" closeLabel={t("common.close")}>{null}</Sheet>;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => d !== target.date);
  return (
    <Sheet visible onClose={close} title={target.recipe?.name ?? t("plan.deletedRecipe")} closeLabel={t("common.close")}>
      <Text variant="meta">
        {eveningLabel(target.date, today)} · {SLOT_LABEL[target.slot]}
      </Text>
      {moving ? (
        <>
          <Text variant="label">{t("mobile.week.moveTo")}</Text>
          {dates.map((d) => {
            const cur = menuFor(planItems, d)[target.slot];
            const r = cur ? byId.get(cur.recipeId) : null;
            return (
              <Option
                key={d}
                title={d === today ? t("dlg.tonight") : dayName(d)}
                sub={r ? t("mobile.week.swapWith", { dish: recipeLabel(r) }) : t("dlg.empty", { slot: SLOT_LABEL[target.slot] })}
                onPress={async () => {
                  snapNextLayout();
                  const res = await moveToDay(target.itemId, d);
                  if (target.recipe) setNotice({ kind: "info", text: dropMessage(res, { name: target.recipe.name, date: d, recipesById: byId }) });
                  close();
                }}
              />
            );
          })}
        </>
      ) : (
        <>
          {target.recipe && (
            <Option
              title={t("dlg.openRecipe")}
              onPress={() => {
                close();
                router.push(`/tarif/${target.recipe!.id}?gun=${target.date}`);
              }}
            />
          )}
          <Option title={t("mobile.week.moveToDay")} onPress={() => setMoving(true)} />
          <Option title={t("dlg.replace")} onPress={() => onReplace(target.date, target.slot)} />
          <Option
            title={t("dlg.remove")}
            danger
            onPress={async () => {
              await removeFromPlan(target.itemId);
              close();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

const DAY_CHOICES: [LeftoverChoice | null, string][] = [
  [null, "dlg.asRecipe"],
  ["lunch", "dlg.lunchNext"],
  ["fridge", "dlg.toFridge"],
  ["none", "dlg.noLeftovers"],
];
const OUTCOME_SHORT = labelRecord<LeftoverOutcome["kind"]>("dlg.out", ["none", "lunch", "fridge", "discard", "eaten"]);

/** Day-level actions: approve, leftovers, eaten out, clear (same as the web's day dialog). */
export function DaySheet({
  target,
  onClose,
}: {
  target: { date: string; leftover: { choice: LeftoverChoice | null; kind: LeftoverOutcome["kind"] } | null; ateOut: boolean; approved: boolean; filled: number } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useApp();
  const run = (fn: () => Promise<void>) => async () => {
    await fn();
    onClose();
  };
  if (!target) return <Sheet visible={false} onClose={onClose} title="" closeLabel={t("common.close")}>{null}</Sheet>;
  return (
    <Sheet visible onClose={onClose} title={eveningLabel(target.date, st.today)} closeLabel={t("common.close")}>
      {target.ateOut ? (
        <Option title={t("dlg.undoAteOut")} onPress={run(() => st.clearAteOut(target.date))} />
      ) : (
        <>
          {target.filled > 0 && !target.approved && <Option title={t("dlg.approve")} onPress={run(() => st.approve(target.date))} />}
          {target.leftover && (
            <View style={{ gap: 8 }}>
              <Text variant="meta">{t("dlg.ifLeftoverNow", { now: OUTCOME_SHORT[target.leftover.kind] })}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t("dlg.ifLeftover")}>
                {DAY_CHOICES.map(([choice, key]) => {
                  const on = target.leftover!.choice === choice;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={run(() => st.setLeftoverChoice(target.date, choice))}
                      style={{ minHeight: touchTarget, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.olive : colors.surface, borderWidth: on ? 0 : 1.5, borderColor: colors.line }}
                    >
                      <Text variant="bodySmall" weight="semibold" color={on ? colors.surface : colors.ink}>
                        {t(key)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          <Option title={t("dlg.ateOut")} sub={t("dlg.ateOutSub")} onPress={run(() => st.ateOut(target.date))} />
          {target.filled > 0 && <Option title={t("dlg.clear")} danger onPress={run(() => st.sendBackToMatches(target.date))} />}
        </>
      )}
    </Sheet>
  );
}
