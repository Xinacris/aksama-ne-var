import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { CookingSession, CookingTimer, Recipe } from "@anv/core/data/models";
import {
  addTimerTime,
  dishesToCook,
  isPaused,
  mergedIngredients,
  missingForCooking,
  moveStep,
  newTimer,
  otherTimers,
  overallProgress,
  parseCookTarget,
  pauseTimer,
  restartTimer,
  resumeTimer,
  stepOf,
  stepTimerSlots,
  timerStepLabel,
  type CookTarget,
  type TimerSlot,
} from "@anv/core/domain/cooking";
import { eveningLeftover } from "@anv/core/domain/leftovers";
import { menuFor, menuTitle } from "@anv/core/domain/plan";
import { dishInSentence, offsetLabel } from "@anv/core/domain/prep";
import { recipeLabel } from "@anv/core/domain/shopping";
import { listJoin } from "@anv/core/i18n";
import { now } from "@anv/core/lib/clock";
import { newId } from "@anv/core/lib/id";
import { touchTarget } from "@anv/core/design/tokens";
import { ensureNotificationPermission } from "@/alarm/notifications";
import { useTakeAlarmHint } from "@/alarm/prefs";
import { OtherTimersStrip, StepTimers, type TimerActions } from "@/components/CookTimers";
import { LeftoverChoices } from "@/components/LeftoverChoices";
import { recipesMap, selectList, useApp, type AppState } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, EmptyState, Field, Row, Screen, Sheet, Text } from "@/ui";

function missingNow(st: AppState, recipes: Recipe[], target: CookTarget) {
  return missingForCooking({ recipes, rows: selectList(st), pantry: st.pantry, tasks: st.prepTasks, target, today: st.today });
}

/** Re-render every second while something counts down. */
function useTick(active: boolean): Date {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? t : now();
}

/**
 * Pişirme modu on the phone: `/pisir/<date>` for an evening's menu, `/pisir/<recipe id>` for one recipe.
 * Same shared session as the web (resumable), the screen stays on (expo-keep-awake).
 */
export default function Cooking() {
  useKeepAwake();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const target = useMemo(() => parseCookTarget(id), [id]);
  const recipes = useApp((x) => x.recipes);
  const planItems = useApp((x) => x.planItems);
  const today = useApp((x) => x.today);
  const sessions = useApp((x) => x.cookingSessions);
  const startCooking = useApp((x) => x.startCooking);
  const byId = recipesMap(recipes);
  const dishes = useMemo(() => dishesToCook(target, planItems, byId), [target, planItems, byId]);
  const key = target.kind === "menu" ? target.date : target.recipeId;
  const ids = dishes.map((d) => d.id).join(",");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!ids || started.current === `${key}|${ids}`) return;
    started.current = `${key}|${ids}`;
    const nothingMissing = missingNow(useApp.getState(), dishes, target).count === 0;
    void startCooking(key, ids.split(","), { skipPrep: nothingMissing }).then((s) => s && setSessionId(s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dishes` is keyed by `ids`
  }, [ids, key]);

  const session = sessions.find((c) => c.id === sessionId) ?? null;
  const title = target.kind === "menu" ? menuTitle(menuFor(planItems, target.date), byId) : (byId.get(target.recipeId)?.name ?? t("cook.recipe"));
  const cooked = session ? session.recipeIds.map((rid) => byId.get(rid)).filter((r): r is Recipe => !!r && r.steps.length > 0) : [];
  const progress = session ? overallProgress(session, cooked) : null;
  const back = () => (router.canGoBack() ? router.back() : router.replace(target.kind === "menu" && target.date === today ? "/bugun" : "/tarifler"));

  return (
    <>
      <Stack.Screen options={{ title: progress && session?.phase === "steps" ? `${title} · ${t("cook.progress", { step: progress.step, total: progress.total })}` : title }} />
      {!dishes.length ? (
        <Screen>
          <EmptyState title={t("cook.noSteps")} text={target.kind === "menu" ? t("cook.noStepsMenu") : t("cook.noStepsRecipe")}>
            <Button title={t("cook.back")} size="sm" onPress={back} />
          </EmptyState>
        </Screen>
      ) : !session ? (
        <Screen>
          <Text accessibilityLiveRegion="polite">{t("cook.preparing")}</Text>
        </Screen>
      ) : session.phase === "prep" ? (
        <PrepScreen session={session} recipes={cooked} target={target} />
      ) : session.phase === "steps" ? (
        <StepsScreen session={session} recipes={cooked} />
      ) : (
        <FinishScreen session={session} target={target} onBack={back} />
      )}
    </>
  );
}

function PrepScreen({ session, recipes, target }: { session: CookingSession; recipes: Recipe[]; target: CookTarget }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useApp();
  const missing = missingNow(st, recipes, target);
  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="title">{t("cook.before")}</Text>
        <Text variant="meta" accessibilityLiveRegion="polite">
          {missing.count ? t("cook.missingCount", { count: missing.count }) : t("cook.allSet")}
        </Text>
      </Row>
      {missing.prep.length > 0 && (
        <Card>
          <Text variant="h3">{t("cook.prepAhead")}</Text>
          {missing.prep.map((task) => (
            <Row key={task.id} style={{ flexWrap: "nowrap", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{task.label}</Text>
                <Text variant="meta">{offsetLabel(task.offset)}</Text>
              </View>
              <Button
                title={t(task.freezer ? "reminder.tookOut" : "reminder.done")}
                size="sm"
                variant="soft"
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  void st.completeTask(task.id);
                }}
              />
            </Row>
          ))}
        </Card>
      )}
      {missing.ingredients.length > 0 && (
        <Card>
          <Text variant="h3">{t("cook.missingIngredients")}</Text>
          {missing.ingredients.map((r) => (
            <View key={r.key} style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
              <Text>
                {r.amount ? <Text weight="bold">{r.amount} </Text> : null}
                {r.label}
              </Text>
              <Text variant="meta">{[recipes.length > 1 ? r.forDishes.join(", ") : null, r.onList ? t("cook.onList") : null].filter(Boolean).join(" · ")}</Text>
              <Row>
                <Button title={t("cook.have")} size="sm" variant="soft" accessibilityLabel={t("cook.haveIt", { name: r.label })} onPress={() => st.markHave(r.name)} />
                {!r.onList && (
                  <Button
                    title={t("cook.addToList")}
                    size="sm"
                    variant="secondary"
                    accessibilityLabel={t("cook.addNamed", { name: r.label })}
                    onPress={() => st.addManualItem({ name: r.name, quantity: r.ingredient.quantity, unit: r.ingredient.unit, side: r.ingredient.side, aisle: r.ingredient.aisle, forRecipeId: r.recipeId })}
                  />
                )}
              </Row>
            </View>
          ))}
        </Card>
      )}
      {missing.count === 0 && <Text color={colors.ink2}>{t("cook.nothingMissing")}</Text>}
      <Button title={missing.count ? t("cook.startAnyway") : t("cook.start")} size="lg" onPress={() => st.updateCooking(session.id, { phase: "steps" })} />
    </Screen>
  );
}

function StepsScreen({ session, recipes }: { session: CookingSession; recipes: Recipe[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const updateCooking = useApp((x) => x.updateCooking);
  const finishCooking = useApp((x) => x.finishCooking);
  const [sheet, setSheet] = useState(false);
  const dishIndex = Math.min(session.dishIndex, recipes.length - 1);
  const recipe = recipes[dishIndex];
  const step = stepOf(session, recipe);
  const last = step === recipe.steps.length - 1;
  const nextDish = recipes.findIndex((r, i) => i !== dishIndex && stepOf(session, r) < r.steps.length - 1);
  const go = (delta: number) => updateCooking(session.id, { positions: moveStep(session.positions, recipe, delta) });
  const rows = useMemo(() => mergedIngredients(recipes), [recipes]);
  const slots = stepTimerSlots(session.timers, recipe, step);
  const anyActive = session.timers.some((x) => !x.dismissed);
  const tick = useTick(anyActive);
  const others = otherTimers(session.timers, recipe, step, tick);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const setNotice = useApp((x) => x.setNotice);
  const takeAlarmHint = useTakeAlarmHint();

  const change = (tid: string, fn: (x: CookingTimer) => CookingTimer) => updateCooking(session.id, { timers: session.timers.map((x) => (x.id === tid ? fn(x) : x)) });
  const dismiss = (tid: string) => change(tid, (x) => ({ ...x, dismissed: true }));
  // Finished timers ring from the AlarmHost above every screen ("Süre doldu" + Durdur).
  async function start(slot: TimerSlot) {
    await updateCooking(session.id, { timers: [...session.timers, newTimer({ id: newId(), recipe, step, seconds: slot.duration.seconds, now: now(), slot: slot.slot })] });
    // Asked on the first timer, never on launch; without it the alarm rings only while the app is open.
    const { denied } = await ensureNotificationPermission();
    if (denied && takeAlarmHint()) setNotice({ kind: "info", text: t("alarm.deniedPhone") });
  }
  const actions: TimerActions = {
    start: (slot) => void start(slot),
    togglePause: (tid) => change(tid, (y) => (isPaused(y) ? resumeTimer(y, now()) : pauseTimer(y, now()))),
    addMinute: (tid) => change(tid, (y) => addTimerTime(y, 60, now())),
    restart: (tid) => change(tid, (y) => restartTimer(y, now())),
    close: dismiss,
  };
  // A timer in the strip opens its step (and dish), where its controls are.
  const openTimerStep = (x: CookingTimer) => {
    const i = recipes.findIndex((r) => r.id === x.recipeId);
    if (i < 0) return;
    void updateCooking(session.id, { dishIndex: i, positions: { ...session.positions, [x.recipeId]: x.step } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {recipes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 12 }} accessibilityRole="tablist" accessibilityLabel={t("cook.dishes")} style={{ flexGrow: 0 }}>
          {recipes.map((r, i) => (
            <Pressable
              key={r.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === dishIndex }}
              onPress={() => updateCooking(session.id, { dishIndex: i })}
              style={{ minHeight: touchTarget, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: i === dishIndex ? colors.ink : colors.surface, borderWidth: i === dishIndex ? 0 : 1, borderColor: colors.line }}
            >
              <Text variant="bodySmall" weight="bold" color={i === dishIndex ? colors.bg : colors.ink}>
                {recipeLabel(r)} · {stepOf(session, r) + 1}/{r.steps.length}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="eyebrow" accessibilityRole="header">
            {recipes.length > 1 ? `${recipeLabel(recipe)} · ` : ""}
            {t("cook.step", { n: step + 1, total: recipe.steps.length })}
          </Text>
          <Button title={t("cook.ingredients")} size="sm" variant="ghost" onPress={() => setSheet(true)} />
        </Row>
        <Text style={{ fontSize: 22, lineHeight: 31 }} accessibilityLiveRegion="polite">
          {recipe.steps[step]}
        </Text>
        <StepTimers slots={slots} label={timerStepLabel({ recipeId: recipe.id, step }, recipe, recipes.length > 1)} now={tick} actions={actions} />
        <OtherTimersStrip timers={others} byId={byId} withDish={recipes.length > 1} now={tick} onOpen={openTimerStep} onClose={dismiss} />
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 10, padding: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface }}>
        <View style={{ flex: 1 }}>
          <Button title={t("cook.prev")} icon="chevronLeft" variant="secondary" size="lg" disabled={step === 0} onPress={() => go(-1)} />
        </View>
        <View style={{ flex: 1 }}>
          {!last ? (
            <Button title={t("cook.next")} size="lg" onPress={() => go(1)} />
          ) : nextDish >= 0 ? (
            <Button title={recipeLabel(recipes[nextDish])} size="lg" onPress={() => updateCooking(session.id, { dishIndex: nextDish })} />
          ) : (
            <Button
              title={t("cook.done")}
              icon="check"
              size="lg"
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                void finishCooking(session.id);
              }}
            />
          )}
        </View>
      </View>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title={t("cook.ingredients")} closeLabel={t("common.close")}>
        <Text variant="meta">{recipes.length > 1 ? t("cook.wholeMenu") : recipeLabel(recipes[0])}</Text>
        {rows.map((r) => (
          <View key={r.key} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 }}>
            <Text>
              {r.amount ? <Text weight="bold">{r.amount} </Text> : null}
              {r.label}
            </Text>
            {recipes.length > 1 && <Text variant="meta">{r.forDishes.join(", ")}</Text>}
          </View>
        ))}
      </Sheet>
    </View>
  );
}

function FinishScreen({ session, target, onBack }: { session: CookingSession; target: CookTarget; onBack: () => void }) {
  const { t } = useTranslation();
  const st = useApp();
  const [item, setItem] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const byId = recipesMap(st.recipes);
  const ev =
    target.kind === "menu" && st.household
      ? eveningLeftover({ items: st.planItems, days: st.planDays, matches: st.matches, recipesById: byId }, st.household, target.date, st.people.length, st.today)
      : null;
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {t("cook.enjoy")}
      </Text>
      <Text>
        {target.kind === "menu" ? t("cook.menuDone") : t("cook.recipeDone")}
        {session.timers.length ? t("cook.timersClosed") : ""}
      </Text>
      {ev && (
        <Card>
          <LeftoverChoices ev={ev} when="tonight" title={t("cook.leftoverQ", { dish: dishInSentence(ev.recipe.shortName ?? ev.recipe.name) })} />
        </Card>
      )}
      <Card>
        <Text weight="bold">{t("cook.missingQ")}</Text>
        <Field label={t("cook.listItem")} hideLabel placeholder={t("cook.listItemPlaceholder")} value={item} onChangeText={setItem} />
        <Button
          title={t("cook.addToList")}
          icon="plus"
          variant="soft"
          onPress={async () => {
            const name = item.trim();
            if (!name) return;
            await st.addManualItem({ name, quantity: null, unit: null });
            setAdded((a) => [...a, name]);
            setItem("");
          }}
        />
        {added.length > 0 && <Text variant="meta" accessibilityLiveRegion="polite">{t("cook.added", { items: listJoin(added) })}</Text>}
      </Card>
      <Button title={target.kind === "menu" && target.date === st.today ? t("cook.backToday") : t("cook.back")} size="lg" onPress={onBack} />
    </Screen>
  );
}
