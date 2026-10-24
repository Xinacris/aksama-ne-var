import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { COURSE_LABEL, SLOTS, SLOT_SHORT, type Ingredient } from "@anv/core/data/models";
import { clockTime, dayMonth, dayName, formatDuration, toIsoDate } from "@anv/core/domain/dates";
import { eveningLeftover, policyMeta } from "@anv/core/domain/leftovers";
import { menuFor, menuItems, menuTitle, totalMinutes } from "@anv/core/domain/plan";
import { dishInSentence, offsetLabel } from "@anv/core/domain/prep";
import { daysSinceCooked, lastCookedMap, rotationLabel } from "@anv/core/domain/rotation";
import { formatIngredientQuantity, ingredientStatus, recipeLabel } from "@anv/core/domain/shopping";
import { sourceCredit } from "@anv/core/services/importDraft";
import { intlTag, t as tr } from "@anv/core/i18n";
import { dative } from "@anv/core/lib/text";
import { touchTarget } from "@anv/core/design/tokens";
import { DayPicker, type DayTarget } from "@/components/DayPicker";
import { TranslateAction } from "@/components/TranslateAction";
import { usePeople } from "@/hooks/usePeople";
import { recipesMap, selectList, useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Divider, EmptyState, Icon, IconButton, Row, Screen, Sheet, Text } from "@/ui";
import { Eyebrow, Pill } from "@/ui/more";

const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase(intlTag()) + s.slice(1);

/** Recipe page: menu context (?gun=), prep timeline, ingredient statuses, steps, actions. */
export default function RecipePage() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; gun?: string; yeni?: string }>();
  const st = useApp();
  const { recipes, planItems, planDays, household, today, cookLog, favorites, pantry, prepTasks, people } = st;
  const { byId: personById } = usePeople();
  const [servings, setServings] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [place, setPlace] = useState<DayTarget | null>(null);
  const byId = recipesMap(recipes);
  const recipe = byId.get(params.id);

  if (!recipe) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <EmptyState title={t("tarif.notFound")} text={t("tarif.notFoundText")}>
          <Button title={t("edit.toRecipes")} size="sm" onPress={() => router.replace("/tarifler")} />
        </EmptyState>
      </Screen>
    );
  }

  const gun = params.gun === "today" ? today : params.gun && /^\d{4}-\d{2}-\d{2}$/.test(params.gun) ? params.gun : null;
  const menu = gun ? menuFor(planItems, gun) : {};
  const items = menuItems(menu);
  const ctx = gun && items.some((i) => i.recipeId === recipe.id) ? gun : null;
  const evening = ctx && household ? eveningLeftover({ items: planItems, days: planDays, matches: [], recipesById: byId }, household, ctx, people.length, today) : null;
  const shown = servings ?? recipe.servings;
  const factor = shown / recipe.servings;
  const solo = people.length < 2;
  const isFav = favorites.some((f) => f.recipeId === recipe.id);
  const custom = recipe.householdId !== null;
  const rows = selectList(st);

  const eyebrow = ctx ? (ctx === today ? t("tarif.tonightMenu") : t("tarif.dayMenu", { day: dayName(ctx) })) : COURSE_LABEL[recipe.course];
  const title = ctx ? menuTitle(menu, byId) : recipe.name;
  const meta = (
    ctx
      ? [
          t("tarif.parts", { count: items.length }),
          t("tarif.about", { time: formatDuration(totalMinutes(menu, byId)) }),
          `${t("tarif.serves", { n: recipe.servings })}${evening?.outcome.kind === "lunch" ? t("tarif.lastsTomorrow") : evening?.outcome.kind === "fridge" ? t("tarif.leftoverFridge") : ""}`,
        ]
      : [
          recipe.stub ? t("tarifler.pendingDetails") : (recipe.timeNote ?? formatDuration(recipe.prepMinutes + recipe.cookMinutes)),
          recipe.waitMinutes ? t("tarif.plusWait", { time: formatDuration(recipe.waitMinutes) }) : null,
          t("tarif.serves", { n: recipe.servings }),
          policyMeta(recipe),
        ]
  )
    .filter(Boolean)
    .join(" · ");
  const rotation = rotationLabel(daysSinceCooked(recipe.id, lastCookedMap(cookLog), today), solo);
  const tasks = ctx ? prepTasks.filter((x) => x.date === ctx && items.some((i) => i.recipeId === x.recipeId)).sort((a, b) => a.dueAt.localeCompare(b.dueAt)) : [];
  const main = recipe.ingredients.filter((i) => !i.staple || (i.quantity !== null && i.name !== "Tuz"));
  const staples = recipe.ingredients.filter((i) => i.staple && !(i.quantity !== null && i.name !== "Tuz"));

  function status(ing: Ingredient): { tone: "olive" | "sand" | "tomato"; label: string; action?: () => void; aria?: string } {
    if (ing.staple) return { tone: "olive", label: t("tarif.inHome") };
    const s2 = ingredientStatus(ing, rows, pantry);
    const name = lowerFirst(ing.label ?? ing.name);
    if (s2 === "evde") {
      const removable = pantry.some((p) => p.name === ing.name && p.quantity === null);
      return removable ? { tone: "olive", label: t("tarif.inHome"), action: () => st.unmarkHave(ing.name), aria: t("tarif.unmarkHave", { name }) } : { tone: "olive", label: t("tarif.inHome") };
    }
    if (s2 === "listede") return { tone: "sand", label: t("tarif.onList"), action: () => st.markHave(ing.name), aria: t("tarif.markHave", { name }) };
    return {
      tone: "tomato",
      label: t("tarif.missingAdd"),
      action: () => st.addManualItem({ name: ing.name, quantity: ing.quantity ? ing.quantity * factor : null, unit: ing.unit, side: ing.side, aisle: ing.aisle, forRecipeId: recipe!.id }),
      aria: t("cook.addNamed", { name }),
    };
  }

  const creator = recipe.createdBy ? personById.get(recipe.createdBy) : undefined;
  const credit = recipe.sourceUrl
    ? recipe.source
      ? tr("import.credit", { text: recipe.source })
      : sourceCredit({ platform: recipe.sourcePlatform, author: recipe.sourceAuthor, url: recipe.sourceUrl })
    : recipe.source;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => <IconButton icon="more" label={t("tarif.more")} onPress={() => setMenuOpen(true)} />,
        }}
      />
      <View style={{ gap: 6 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Text variant="title">{title}</Text>
        {recipe.description ? <Text color={colors.ink2}>{recipe.description}</Text> : null}
        <Text variant="meta">{meta}</Text>
        <Text variant="meta">{rotation}</Text>
      </View>

      {ctx && items.length > 1 && (
        <View accessibilityLabel={t("tarif.menuParts")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SLOTS.filter((sl) => menu[sl]).map((sl) => {
            const r = byId.get(menu[sl]!.recipeId);
            if (!r) return null;
            const on = r.id === recipe.id;
            return (
              <Pressable
                key={sl}
                onPress={() => router.replace(`/tarif/${r.id}?gun=${ctx}`)}
                accessibilityRole="link"
                accessibilityState={{ selected: on }}
                style={{ minHeight: touchTarget, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.ink : colors.surface, borderWidth: on ? 0 : 1, borderColor: colors.line }}
              >
                <Text variant="small" weight="bold" color={on ? colors.bg : colors.ink2}>
                  {sl === "ana" ? t("tarif.mainShort") : SLOT_SHORT[sl].toLocaleUpperCase(intlTag())}
                </Text>
                <Text variant="bodySmall" weight="semibold" color={on ? colors.bg : colors.ink}>
                  {recipeLabel(r)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {credit ? (
        <Card tone="soft" style={{ borderWidth: 0, gap: 6 }}>
          <Text variant="bodySmall" weight="bold">
            {credit}
            {creator ? <Text variant="bodySmall">{t("tarif.addedBy", { name: creator.name, date: dayMonth(toIsoDate(new Date(recipe.createdAt))) })}</Text> : null}
          </Text>
          <Row>
            {recipe.sourceUrl && (
              <Button
                title={recipe.sourcePlatform === "web" || !recipe.sourcePlatform ? t("tarif.openPage") : t("tarif.openVideo")}
                variant="ghost"
                size="sm"
                onPress={() => Linking.openURL(recipe.sourceUrl!)}
              />
            )}
            {recipe.writtenRecipeUrl && <Button title={t("tarif.written")} variant="ghost" size="sm" onPress={() => Linking.openURL(recipe.writtenRecipeUrl!)} />}
          </Row>
        </Card>
      ) : null}

      {st.rawRecipes.find((r) => r.id === recipe.id) && <TranslateAction raw={st.rawRecipes.find((r) => r.id === recipe.id)!} />}

      {recipe.stub && (
        <EmptyState title={params.yeni ? t("tarif.stubSaved") : t("tarif.stubTitle")} text={t("tarif.stubText")}>
          <Button title={t("tarif.addDetails")} size="sm" onPress={() => router.push(`/tarifler/${recipe.id}/duzenle`)} />
        </EmptyState>
      )}

      {(tasks.length > 0 || (!ctx && recipe.prepItems.length > 0)) && (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="h3">{t("tarif.prep")}</Text>
            <Text variant="meta">{t("tarif.dinnerAt", { time: household?.dinnerTime ?? "19:30" })}</Text>
          </Row>
          {ctx
            ? tasks.map((task) => {
                const done = task.status === "done";
                const doer = task.doneBy ? personById.get(task.doneBy) : undefined;
                const assignee = task.assigneeId ? personById.get(task.assigneeId) : undefined;
                const other = task.recipeId !== recipe.id ? byId.get(task.recipeId) : undefined;
                const due = clockTime(new Date(task.dueAt));
                const sub = done
                  ? t("tarif.didAt", { name: doer?.name ?? t("tarif.someone"), time: task.doneAt ? clockTime(new Date(task.doneAt)) : "" })
                  : other
                    ? t("tarif.forDish", { due, dish: dishInSentence(recipeLabel(other)) })
                    : `${due}${assignee && !solo ? t("tarif.willRemind", { name: assignee.name, nameDat: dative(assignee.name) }) : ""}`;
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => {});
                      return done ? st.undoTask(task.id) : st.completeTask(task.id);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={`${offsetLabel(task.offset)}: ${task.label}. ${sub}`}
                    style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: touchTarget }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: done ? (doer?.color ?? colors.olive) : colors.line, backgroundColor: done ? (doer?.color ?? colors.olive) : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {done && <Icon name="check" size={14} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="small" weight="bold" color={colors.tomato}>
                        {offsetLabel(task.offset)}
                      </Text>
                      <Text weight="semibold" style={done ? { textDecorationLine: "line-through", color: colors.ink2 } : undefined}>
                        {task.label}
                      </Text>
                      <Text variant="meta">{sub}</Text>
                    </View>
                  </Pressable>
                );
              })
            : recipe.prepItems.map((p) => (
                <View key={p.label} style={{ gap: 2 }}>
                  <Text variant="small" weight="bold" color={colors.tomato}>
                    {offsetLabel(p.offset)}
                  </Text>
                  <Text weight="semibold">{p.label}</Text>
                  <Text variant="meta">{t("tarif.remindOnPlan")}</Text>
                </View>
              ))}
        </Card>
      )}

      {recipe.ingredients.length > 0 && (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="h3">{t("tarif.ingredients")}</Text>
            <Row style={{ flexWrap: "nowrap" }}>
              <IconButton icon="minus" label={t("tarif.fewer")} filled onPress={() => setServings(Math.max(1, shown - 1))} />
              <Text variant="bodySmall" weight="semibold" accessibilityLiveRegion="polite">
                {t("tarif.servingsN", { n: shown })}
              </Text>
              <IconButton icon="plus" label={t("tarif.more1")} filled onPress={() => setServings(Math.min(12, shown + 1))} />
            </Row>
          </Row>
          {main.map((ing) => {
            const q = formatIngredientQuantity(ing, factor);
            const s = status(ing);
            return (
              <View key={ing.name}>
                <Divider />
                <Row style={{ flexWrap: "nowrap", justifyContent: "space-between", paddingTop: 8 }}>
                  <Text style={{ flex: 1 }}>
                    {q ? <Text weight="bold">{q} </Text> : null}
                    {ing.quantity === null ? (ing.label ?? ing.name) : lowerFirst(ing.label ?? ing.name)}
                    {ing.note ? ` (${ing.note})` : ""}
                  </Text>
                  <Pill tone={s.tone} label={s.label} onPress={s.action} accessibilityLabel={s.aria} />
                </Row>
                {ing.substitute && (
                  <Text variant="meta" style={{ marginTop: 4 }}>
                    {ing.substitute.note}
                  </Text>
                )}
              </View>
            );
          })}
          {staples.length > 0 && (
            <View>
              <Divider />
              <Row style={{ flexWrap: "nowrap", justifyContent: "space-between", paddingTop: 8 }}>
                <Text style={{ flex: 1 }}>{staples.map((i, idx) => (idx === 0 ? (i.label ?? i.name) : lowerFirst(i.label ?? i.name))).join(", ")}</Text>
                <Pill tone="olive" label={t("tarif.inHome")} />
              </Row>
            </View>
          )}
        </Card>
      )}

      {recipe.steps.length > 0 && (
        <Card>
          <Text variant="h3">{t("tarif.method")}</Text>
          {recipe.steps.map((text, i) => (
            <Row key={i} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <Text variant="small" weight="bold">
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1 }}>{text}</Text>
            </Row>
          ))}
        </Card>
      )}

      <View style={{ gap: 10 }}>
        {recipe.steps.length > 0 && (
          <Button title={ctx && items.length > 1 ? t("tarif.cookMenu") : t("bugun.startCooking")} size="lg" onPress={() => router.push(`/pisir/${ctx ?? recipe.id}`)} />
        )}
        <Button title={t("place.addToDay")} variant="secondary" onPress={() => setPlace({ recipe })} />
      </View>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={recipe.name} closeLabel={t("common.close")}>
        <Button
          title={isFav ? t("tarif.unfav") : t("tarif.fav")}
          icon={isFav ? "heart" : "heartOutline"}
          variant="soft"
          onPress={async () => {
            await st.toggleFavorite(recipe.id);
            setMenuOpen(false);
          }}
        />
        <Button
          title={custom ? t("tarif.edit") : t("edit.editCopy")}
          icon="edit"
          variant="soft"
          onPress={() => {
            setMenuOpen(false);
            router.push(custom ? `/tarifler/${recipe.id}/duzenle` : `/tarifler/yeni?kopya=${recipe.id}`);
          }}
        />
        {!custom && <Text variant="small">{t("tarif.copySub")}</Text>}
        {custom &&
          (confirmDelete ? (
            <View style={{ gap: 6 }}>
              <Text variant="small">{t("tarif.deleteSub")}</Text>
              <Button
                title={t("tarif.confirmDelete")}
                icon="trash"
                onPress={async () => {
                  await st.deleteRecipe(recipe.id);
                  setMenuOpen(false);
                  router.replace("/tarifler");
                }}
              />
            </View>
          ) : (
            <Button title={t("tarif.delete")} icon="trash" variant="ghost" onPress={() => setConfirmDelete(true)} />
          ))}
      </Sheet>
      <DayPicker target={place} onClose={() => setPlace(null)} />
    </Screen>
  );
}
