import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SLOTS, SLOT_LABEL, type Match, type Slot } from "@anv/core/data/models";
import { addDays, dayName, eveningDative, eveningLabel, formatDuration } from "@anv/core/domain/dates";
import { buildDeck, cuisineDeck, nextCard, nextOpenEvening, progress, recentlyPlannedIds, sortMatches, swipesFor } from "@anv/core/domain/matching";
import { dishInSentence } from "@anv/core/domain/prep";
import { daysSinceCooked, lastCookedMap, rotationLabel, rotationShort } from "@anv/core/domain/rotation";
import { matchNote } from "@anv/core/domain/week";
import { intlTag, listJoin, tagLabel } from "@anv/core/i18n";
import { numberAccusative } from "@anv/core/lib/text";
import { touchTarget } from "@anv/core/design/tokens";
import { SwipeCard, type DeckCardView } from "@/components/SwipeCard";
import { cuisineLabelKey, toggleCuisine } from "@anv/core/recipes/cuisines";
import { usePeople } from "@/hooks/usePeople";
import { useSwipeCuisines } from "@/hooks/useSwipeCuisines";
import { recipesMap, useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Chip, EmptyState, Icon, Row, Screen, Text } from "@/ui";
import { Avatar, AvatarStack, TabHeader } from "@/ui/more";

/** Eşleş: swipe the deck for an evening and course; both say "Olur" → match moment (with a haptic). */
export default function MatchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ gun?: string; slot?: string }>();
  const st = useApp();
  const { today, recipes, favorites, cookLog, planItems, planDays, matches, swipes, me, pantry } = st;
  const { people, partner } = usePeople();
  const [chooser, setChooser] = useState(false);
  const [moment, setMoment] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<{ date: string | null; slot: Slot | null }>({ date: null, slot: null });
  const seen = useRef<Set<string> | null>(null);
  const [cuisines, pickCuisines] = useSwipeCuisines();

  const date = sel.date ?? (params.gun && /^\d{4}-\d{2}-\d{2}$/.test(params.gun) ? params.gun : nextOpenEvening(planItems, planDays, today, addDays));
  const slot: Slot = sel.slot ?? (params.slot && (SLOTS as readonly string[]).includes(params.slot) ? (params.slot as Slot) : "ana");
  const byId = recipesMap(recipes);
  const last = useMemo(() => lastCookedMap(cookLog), [cookLog]);
  const solo = people.length < 2;
  const pool = useMemo(
    () => buildDeck({ recipes, favorites, lastCooked: last, slot, date, plannedRecipeIds: recentlyPlannedIds(planItems, today, addDays), matches, size: Infinity }),
    [recipes, favorites, last, slot, date, planItems, today, matches],
  );
  const { available, active, deck } = useMemo(() => cuisineDeck(pool, cuisines), [pool, cuisines]);
  const mine = swipesFor(swipes, date, slot, me?.id);
  const card = nextCard(deck, mine);
  const myDone = progress(deck, mine);
  const partnerDone = partner ? progress(deck, swipesFor(swipes, date, slot, partner.id)) : 0;

  // A match completed by the partner (another tab on the web) shows here too.
  useEffect(() => {
    const ids = new Set(matches.map((m) => m.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    const fresh = matches.find((m) => !seen.current!.has(m.id) && m.date === date && m.slot === slot && m.status === "open" && m.createdBy !== me?.id);
    seen.current = ids;
    if (fresh && !moment) setMoment(fresh);
  }, [matches, date, slot, me?.id, moment]);

  async function decide(d: "like" | "pass") {
    if (!card) return;
    void Haptics.selectionAsync().catch(() => {});
    const m = await st.swipe(card.id, date, slot, d);
    if (m) {
      seen.current?.add(m.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMoment(m);
    }
  }

  async function put() {
    if (!moment) return;
    setBusy(true);
    await st.addToPlan({ date: moment.date, slot: moment.slot, recipeId: moment.recipeId, source: "match", matchId: moment.id });
    const r = byId.get(moment.recipeId);
    st.setNotice({ kind: "info", text: t("eslesme.placed", { dish: r?.name ?? t("eslesme.dish"), evening: eveningDative(moment.date, today).toLocaleLowerCase(intlTag()) }) });
    setMoment(null);
    setBusy(false);
  }

  function toView(id: string): DeckCardView {
    const r = byId.get(id)!;
    const tags = r.tags.slice(0, 3).map(tagLabel);
    if (r.leftoverPolicy !== "none") tags.push(t("eslesme.leftoverTag"));
    return { recipe: r, time: r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes), last: rotationLabel(daysSinceCooked(r.id, last, today), solo), tags };
  }

  const openMatches = sortMatches(matches)
    .filter((m) => m.status !== "placed" || (m.placedDate ?? "") >= today)
    .map((m) => ({ match: m, recipe: byId.get(m.recipeId)!, note: matchNote(m, daysSinceCooked(m.recipeId, last, today)) }))
    .filter((v) => v.recipe)
    .slice(0, 8);
  const momentRecipe = moment ? byId.get(moment.recipeId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header>
        <TabHeader eyebrow={t("eslesme.context", { evening: eveningLabel(date, today), slot: SLOT_LABEL[slot].toLocaleLowerCase(intlTag()) })} title={t("eslesme.title")} />
        <Row style={{ justifyContent: "space-between" }}>
          <Button title={chooser ? t("form.bulk.cancel") : t("eslesme.chooser")} variant="ghost" size="sm" icon="calendar" onPress={() => setChooser((v) => !v)} />
          {card && (
            <Text variant="meta" accessibilityLabel={t("eslesme.counter", { total: deck.length, n: myDone + 1 })}>
              {myDone + 1} / {deck.length}
            </Text>
          )}
        </Row>
        {chooser && (
          <Card tone="soft" style={{ borderWidth: 0 }}>
            <Row>
              {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => (
                <Chip key={d} label={d === today ? t("eslesme.today") : dayName(d)} selected={d === date} onPress={() => setSel((s) => ({ ...s, date: d }))} />
              ))}
            </Row>
            <Row>
              {SLOTS.map((sl) => (
                <Chip key={sl} tone="olive" label={SLOT_LABEL[sl]} selected={sl === slot} onPress={() => setSel((s) => ({ ...s, slot: sl }))} />
              ))}
            </Row>
          </Card>
        )}
        {partner ? (
          <Row style={{ flexWrap: "nowrap" }}>
            <Avatar person={partner} size={24} />
            <Text variant="meta" style={{ flex: 1 }}>
              {t("eslesme.partnerProgress", { name: partner.name, total: deck.length, n: partnerDone, nAcc: numberAccusative(partnerDone) })}
            </Text>
          </Row>
        ) : (
          <Text variant="meta">{t("eslesme.solo")}</Text>
        )}

        {available.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            accessibilityLabel={t("eslesme.cuisineFilter")}
            testID="cuisine-pills"
          >
            <Chip label={t("eslesme.allCuisines")} selected={active.length === 0} onPress={() => pickCuisines([])} />
            {available.map((c) => (
              <Chip key={c} label={t(cuisineLabelKey(c, "short"))} selected={active.includes(c)} onPress={() => pickCuisines(toggleCuisine(cuisines, c))} />
            ))}
          </ScrollView>
        )}

        {card ? (
          <View style={{ gap: 14 }}>
            <SwipeCard key={card.id} card={toView(card.id)} onDecide={decide} />
            <Row style={{ justifyContent: "center", gap: 28 }}>
              <Pressable
                onPress={() => decide("pass")}
                accessibilityRole="button"
                accessibilityLabel={t("swipe.pass")}
                style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}
              >
                <Icon name="close" size={26} color={colors.ink} />
              </Pressable>
              <Pressable
                onPress={() => decide("like")}
                accessibilityRole="button"
                accessibilityLabel={t("swipe.like")}
                style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: colors.tomato, opacity: pressed ? 0.85 : 1 })}
              >
                <Icon name="heart" size={32} color={colors.onTomato} />
              </Pressable>
            </Row>
            <Text variant="small" style={{ textAlign: "center" }}>
              {t("swipe.hint")}
            </Text>
          </View>
        ) : active.length > 0 ? (
          <EmptyState title={t("eslesme.filteredOut")} text={t("eslesme.filteredOutText")}>
            <Button title={t("eslesme.clearFilters")} size="sm" onPress={() => pickCuisines([])} />
          </EmptyState>
        ) : (
          <EmptyState
            title={deck.length ? t("eslesme.out") : t("eslesme.noneForSlot")}
            text={deck.length ? (partner && partnerDone < deck.length ? t("eslesme.partnerStill", { name: partner.name }) : t("eslesme.noCommon")) : t("eslesme.noneFit")}
          >
            <Button title={t("eslesme.otherDay")} size="sm" onPress={() => setChooser(true)} />
            <Button title={t("eslesme.toWeek")} size="sm" variant="secondary" onPress={() => router.push("/hafta")} />
          </EmptyState>
        )}

        <Card>
          <Text variant="h3">{t("eslesme.matches")}</Text>
          {openMatches.length ? (
            openMatches.map((v) => (
              <Row key={v.match.id} style={{ flexWrap: "nowrap", minHeight: touchTarget }}>
                <Icon name={v.match.status === "placed" ? "check" : "heart"} size={16} color={v.match.status === "placed" ? colors.olive : colors.tomato} />
                <View style={{ flex: 1 }}>
                  <Text weight="semibold">{v.recipe.name}</Text>
                  <Text variant="meta">{v.note}</Text>
                </View>
              </Row>
            ))
          ) : (
            <Text variant="meta">{t("match.empty")}</Text>
          )}
          <Text variant="small">{t("eslesme.deckNote")}</Text>
        </Card>
      </Screen>

      <Modal visible={!!moment && !!momentRecipe} animationType="fade" onRequestClose={() => setMoment(null)}>
        {moment && momentRecipe && (
          <Screen header style={{ flexGrow: 1, justifyContent: "center", alignItems: "center", gap: 18 }}>
            <AvatarStack people={solo ? people.slice(0, 1) : people} size={76} />
            <Icon name="heart" size={22} color={colors.tomato} />
            <Text variant="display" style={{ textAlign: "center" }} accessibilityRole="header">
              {solo ? t("eslesme.soloTitle", { dish: momentRecipe.name }) : t("eslesme.bothTitle", { dish: dishInSentence(momentRecipe.name) })}
            </Text>
            <Text style={{ textAlign: "center" }} color={colors.ink2}>
              {t(solo ? "eslesme.soloSub" : "eslesme.bothSub", { evening: eveningLabel(moment.date, today) })}
            </Text>
            <Card style={{ alignSelf: "stretch" }}>
              <Text weight="bold">{momentRecipe.name}</Text>
              <Text variant="meta">
                {momentRecipe.timeNote ?? formatDuration(momentRecipe.prepMinutes + momentRecipe.cookMinutes)} · {rotationShort(daysSinceCooked(momentRecipe.id, last, today))}
              </Text>
              <Text variant="meta">
                {(() => {
                  const missing = momentRecipe.ingredients.filter((i) => !i.staple && !pantry.some((p) => p.name === i.name)).map((i) => (i.label ?? i.name).toLocaleLowerCase(intlTag()));
                  return missing.length
                    ? t("eslesme.toList", { items: listJoin(missing.slice(0, 4)).replace(/^./, (c) => c.toLocaleUpperCase(intlTag())), more: missing.length > 4 ? t("eslesme.andOthers") : "" })
                    : t("eslesme.allHome");
                })()}
              </Text>
            </Card>
            <Button title={t("eslesme.put", { evening: eveningDative(moment.date, today) })} size="lg" busy={busy} onPress={put} style={{ alignSelf: "stretch" }} />
            <Button title={t("match.keepSwiping")} variant="ghost" onPress={() => setMoment(null)} />
          </Screen>
        )}
      </Modal>
    </View>
  );
}
