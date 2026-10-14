import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SLOTS, SLOT_LABEL, type Match, type Recipe, type Slot } from "@anv/core/data/models";
import { dayName } from "@anv/core/domain/dates";
import { keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { recipeLabel, tileName } from "@anv/core/domain/shopping";
import { buildWeek, type DayModel } from "@anv/core/domain/week";
import { intlTag } from "@anv/core/i18n";
import { numberAccusative } from "@anv/core/lib/text";
import { touchTarget } from "@anv/core/design/tokens";
import { DayPicker, type DayTarget } from "@/components/DayPicker";
import { DaySheet, RecipePicker, SlotSheet } from "@/components/WeekSheets";
import { usePeople } from "@/hooks/usePeople";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Chip, Icon, IconButton, Row, Screen, Text } from "@/ui";
import { Avatar, TabHeader } from "@/ui/more";

/** Hafta on the phone: one card per evening; "move to day" actions instead of drag-and-drop. */
export default function Week() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useApp();
  const [offset, setOffset] = useState(0);
  const week = useMemo(() => buildWeek(st, offset), [st, offset]);
  const { partner } = usePeople();
  const [pick, setPick] = useState<{ date: string; slot: Slot } | null>(null);
  const [tile, setTile] = useState<{ itemId: string; date: string; slot: Slot; recipe: Recipe | null } | null>(null);
  const [day, setDay] = useState<DayModel | null>(null);
  const [place, setPlace] = useState<DayTarget | null>(null);
  const eyebrow = offset === 0 ? t("hafta.window") : offset < 0 ? t("hafta.weeksAgo", { count: -offset }) : t("hafta.weeksLater", { count: offset });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header>
        <TabHeader
          eyebrow={eyebrow}
          title={week.range}
          right={
            <Row style={{ flexWrap: "nowrap" }}>
              <IconButton icon="chevronLeft" label={t("hafta.prev")} filled onPress={() => setOffset((o) => o - 1)} />
              {offset !== 0 && <Button title={t("hafta.today")} size="sm" variant="ghost" accessibilityLabel={t("hafta.backToThisWeek")} onPress={() => setOffset(0)} />}
              <IconButton icon="chevronRight" label={t("hafta.next")} filled onPress={() => setOffset((o) => o + 1)} />
            </Row>
          }
        />

        <Card tone="soft" style={{ borderWidth: 0, gap: 6 }}>
          <Text weight="bold">{t("hafta.planned", { count: week.summary.planned })}</Text>
          <Text variant="meta">{week.summary.note}</Text>
          <Text variant="meta">
            {t("hafta.items", { count: week.list.total })} · {t("hafta.split", { pazar: week.list.pazar, market: week.list.market })}
            {partner && week.list.partnerBought > 0
              ? ` · ${t("hafta.partnerBought", { name: partner.name, count: week.list.partnerBought, nAcc: numberAccusative(week.list.partnerBought) }).replace(/ · $/, "")}`
              : ""}
          </Text>
          {week.freezer.length > 0 && (
            <View style={{ gap: 2 }}>
              <Text variant="label">{t("hafta.freezer")}</Text>
              {week.freezer.map((f) => (
                <Text key={f.taskId} variant="meta" style={f.done ? { textDecorationLine: "line-through" } : undefined}>
                  {f.text} {f.who ? `· ${f.who}` : ""}
                  {f.done ? " ✓" : ""}
                </Text>
              ))}
            </View>
          )}
        </Card>

        {week.days.map((d) => (
          <DayCard key={d.date} day={d} onAdd={(slot) => setPick({ date: d.date, slot })} onTile={(slot, cell) => setTile({ itemId: cell.item.id, date: d.date, slot, recipe: cell.recipe })} onDay={() => setDay(d)} />
        ))}

        {week.matches.length > 0 && (
          <Card>
            <Text variant="h3">{t("week.fromMatches")}</Text>
            {week.matches.map((m) => (
              <Pressable
                key={m.match.id}
                disabled={m.match.status === "placed"}
                onPress={() => setPlace({ recipe: m.recipe, match: m.match as Match })}
                accessibilityRole="button"
                accessibilityLabel={t("week.putOnEvening", { name: m.recipe.name, note: m.note })}
                style={{ minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: 10, opacity: m.match.status === "placed" ? 0.6 : 1 }}
              >
                <Icon name={m.match.status === "placed" ? "check" : "heart"} size={16} color={m.match.status === "placed" ? colors.olive : colors.tomato} />
                <View style={{ flex: 1 }}>
                  <Text weight="semibold">{m.recipe.name}</Text>
                  <Text variant="meta">{m.note}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        )}

        {week.fridge.length > 0 && (
          <Card>
            <Text variant="h3">{t("week.inFridge")}</Text>
            <Row>
              {week.fridge.map((f: EveningLeftover) => (
                <Chip
                  key={f.fromDate}
                  tone="olive"
                  label={`${recipeLabel(f.recipe)}${f.outcome.kind === "fridge" ? ` · ${keepUntilLabel(f.outcome.useBy, st.today).toLocaleLowerCase(intlTag())}` : ""}`}
                  onPress={() => f.outcome.kind === "fridge" && setPlace({ recipe: f.recipe, leftover: { fromDate: f.fromDate, useBy: f.outcome.useBy } })}
                />
              ))}
            </Row>
            <Text variant="small">{t("week.fridgeHint")}</Text>
          </Card>
        )}

        {week.frequent.length > 0 && (
          <Card>
            <Text variant="h3">{t("week.frequent")}</Text>
            <Row>
              {week.frequent.map((r) => (
                <Chip key={r.id} tone="sand" label={recipeLabel(r)} onPress={() => setPlace({ recipe: r })} />
              ))}
            </Row>
            <Text variant="small">{t("week.tapToPlace")}</Text>
          </Card>
        )}
      </Screen>

      <RecipePicker target={pick} onClose={() => setPick(null)} matches={week.matches} frequent={week.frequent} />
      <SlotSheet
        target={tile}
        onClose={() => setTile(null)}
        onReplace={(date, slot) => {
          setTile(null);
          setPick({ date, slot });
        }}
      />
      <DaySheet
        target={
          day
            ? {
                date: day.date,
                leftover: day.leftover && !day.isPast ? { choice: day.leftover.choice, kind: day.leftover.outcome.kind } : null,
                ateOut: day.ateOut,
                approved: !!st.me && day.approvals.includes(st.me.id),
                filled: day.filled,
              }
            : null
        }
        onClose={() => setDay(null)}
      />
      <DayPicker target={place} onClose={() => setPlace(null)} />
    </View>
  );
}

function DayCard({
  day,
  onAdd,
  onTile,
  onDay,
}: {
  day: DayModel;
  onAdd: (slot: Slot) => void;
  onTile: (slot: Slot, cell: NonNullable<DayModel["menu"][Slot]>) => void;
  onDay: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { byId } = usePeople();
  const full = dayName(day.date);
  const by = day.note.kind === "addedBy" ? byId.get(day.note.userId) : undefined;
  const foot =
    day.note.kind === "cooked"
      ? t("week.cooked")
      : day.note.kind === "approved"
        ? t("week.approved")
        : day.note.kind === "match"
          ? t("week.fromMatch")
          : day.note.kind === "light"
            ? t("week.light")
            : day.note.kind === "addedBy" && by
              ? t("week.addedBy", { name: by.name })
              : day.note.kind === "empty"
                ? t("week.emptyOk")
                : "";
  return (
    <Card style={{ opacity: day.isPast ? 0.7 : 1, borderColor: day.isToday ? colors.tomato : colors.line, borderWidth: day.isToday ? 1.5 : 1 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{full}</Text>
          <Text variant="meta">
            {day.dayMonth}
            {day.isToday ? ` · ${t("week.today")}` : ""}
          </Text>
        </View>
        <IconButton icon="more" label={t("week.dayOptions", { day: full })} onPress={onDay} />
      </Row>
      {day.lunch && <Text variant="meta">{t("week.lunch", { dish: tileName(day.lunch).toLocaleLowerCase(intlTag()) })}</Text>}
      {day.ateOut ? (
        <View style={{ gap: 4 }}>
          <Text weight="semibold">{t("week.ateOut")}</Text>
          {day.returnedNames.length > 0 && <Text variant="meta">{t("week.returned", { dishes: day.returnedNames.join(", ").toLocaleLowerCase(intlTag()) })}</Text>}
        </View>
      ) : (
        SLOTS.map((slot) => {
          const cell = day.menu[slot];
          return (
            <View key={slot} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, minHeight: touchTarget }}>
              <Text variant="small" style={{ width: 84 }}>
                {SLOT_LABEL[slot]}
              </Text>
              {cell ? (
                <Pressable onPress={() => onTile(slot, cell)} accessibilityRole="button" style={{ flex: 1, minHeight: touchTarget, justifyContent: "center" }}>
                  <Text weight={slot === "ana" ? "bold" : "regular"} color={cell.recipe ? colors.ink : colors.ink2}>
                    {cell.item.source === "leftover" ? t("week.fromFridge") : ""}
                    {cell.recipe ? tileName(cell.recipe) : t("plan.deletedRecipe")}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onAdd(slot)}
                  accessibilityRole="button"
                  accessibilityLabel={t("week.addTo", { day: full, slot: SLOT_LABEL[slot] })}
                  style={{ flex: 1, minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Icon name="plus" size={14} color={colors.ink2} />
                  <Text variant="bodySmall" color={colors.ink2}>
                    {t("week.add")}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}
      {foot ? (
        <Row>
          {by && <Avatar person={by} size={18} />}
          <Text variant="small">
            {foot}
            {day.leftoverOut ? t("week.lastsNextDay") : ""}
          </Text>
        </Row>
      ) : null}
    </Card>
  );
}
