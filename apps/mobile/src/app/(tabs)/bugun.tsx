import * as Haptics from "expo-haptics";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SLOT_LABEL } from "@anv/core/data/models";
import { addDays, dayName, eveningLabel } from "@anv/core/domain/dates";
import { keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { menuFor, menuItems } from "@anv/core/domain/plan";
import { dishInSentence } from "@anv/core/domain/prep";
import { approvalPill, buildToday } from "@anv/core/domain/today";
import { intlTag } from "@anv/core/i18n";
import { touchTarget } from "@anv/core/design/tokens";
import { LeftoverChoices } from "@/components/LeftoverChoices";
import { usePeople } from "@/hooks/usePeople";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, EmptyState, Icon, Row, Screen, Text } from "@/ui";
import { Avatar, Eyebrow, Pill, TabHeader } from "@/ui/more";

/** Bugün: the reminder, tonight's menu, leftovers, what changed, tomorrow (Main.dc.html). */
export default function Today() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = useApp();
  const model = useMemo(() => buildToday(state), [state]);
  const { byId: personById } = usePeople();
  const [changeOpen, setChangeOpen] = useState(false);
  const [leaveEmpty, setLeaveEmpty] = useState(false);
  const { completeTask, undoTask, approve, ateOut, clearAteOut, sendBackToMatches, moveToTomorrow, setNotice } = state;
  const tomorrowPlanned = menuItems(menuFor(state.planItems, addDays(model.today, 1))).length > 0;
  const approval = model.tonight?.approval ?? null;
  const canApprove = approval && (approval.kind === "waitingMe" || approval.kind === "none" || (approval.kind === "solo" && !approval.approved));
  const pill = model.tonight ? (model.tonight.cooked ? { tone: "ok" as const, label: t("bugun.cookedPill") } : approvalPill(model.tonight.approval)) : null;

  return (
    <Screen header>
      <TabHeader eyebrow={model.dateLabel} title={t("app.name")} />

      {model.reminder && (
        <Card tone={model.reminder.task.status === "done" ? "olive" : "sand"} style={{ borderWidth: 0 }}>
          <View accessibilityRole="summary" accessibilityLabel={t("reminder.region")} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Icon name={model.reminder.task.freezer ? "snowflake" : "clock"} size={22} color={colors.olive} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text weight="semibold">{model.reminder.text}</Text>
              <Text variant="meta">{model.reminder.meta}</Text>
            </View>
          </View>
          {model.reminder.task.status === "done" ? (
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="bodySmall" weight="semibold" color={colors.olive} accessibilityLiveRegion="polite">
                {model.reminder.task.doneBy && personById.get(model.reminder.task.doneBy)
                  ? t("reminder.doneBy", { name: personById.get(model.reminder.task.doneBy)!.name })
                  : t("reminder.completed")}
                {model.reminder.doneAt ? ` · ${model.reminder.doneAt}` : ""}
              </Text>
              <Button title={t("common.undo")} variant="ghost" size="sm" onPress={() => undoTask(model.reminder!.task.id)} />
            </Row>
          ) : (
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="bodySmall" weight="semibold" color={colors.sandText}>
                {t("reminder.waiting")}
              </Text>
              <Button
                title={model.reminder.actionLabel}
                icon="check"
                size="sm"
                onPress={async () => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  await completeTask(model.reminder!.task.id);
                }}
              />
            </Row>
          )}
        </Card>
      )}

      {model.partnerLine && personById.get(model.partnerLine.actorId) && (
        <Row style={{ flexWrap: "nowrap" }}>
          <Avatar person={personById.get(model.partnerLine.actorId)!} size={26} />
          <Text variant="bodySmall" style={{ flex: 1 }}>
            <Text variant="bodySmall" weight="bold">
              {personById.get(model.partnerLine.actorId)!.name}
            </Text>{" "}
            {model.partnerLine.text} · {model.partnerLine.when}
          </Text>
        </Row>
      )}

      {model.tonight ? (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Eyebrow>{t("menu.tonight")}</Eyebrow>
            {pill && <Pill tone={pill.tone === "ok" ? "olive" : "sand"} label={pill.label} icon={pill.tone === "ok" ? "check" : undefined} />}
          </Row>
          <Text variant="h2">{model.tonight.title}</Text>
          <View>
            {model.tonight.rows.map((r) => (
              <Pressable
                key={r.slot}
                disabled={!r.href}
                onPress={() => r.href && router.push(r.href as never)}
                accessibilityRole={r.href ? "link" : undefined}
                accessibilityLabel={`${SLOT_LABEL[r.slot]}: ${r.name ?? t("plan.deletedRecipe")}, ${r.time ?? ""}`}
                style={{ minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.line }}
              >
                <Text variant="small" style={{ width: 86 }}>
                  {SLOT_LABEL[r.slot]}
                </Text>
                <Text style={{ flex: 1 }} weight={r.slot === "ana" ? "semibold" : "regular"} color={r.name ? colors.ink : colors.ink2}>
                  {r.name ?? t("plan.deletedRecipe")}
                </Text>
                <Text variant="small">{r.time}</Text>
              </Pressable>
            ))}
          </View>
          {model.tonight.leftover ? (
            <LeftoverChoices ev={model.tonight.leftover} when="tonight" />
          ) : canApprove ? (
            <Button
              title={approval?.kind === "waitingMe" ? t("bugun.meToo") : t("dlg.approve")}
              icon="check"
              variant="soft"
              onPress={() => approve(model.today)}
            />
          ) : null}
          {!model.tonight.cooked && !model.tonight.cooking && (
            <Button title={t("bugun.startCooking")} size="lg" onPress={() => router.push(`/pisir/${model.today}`)} />
          )}
          {!model.tonight.cooked &&
            (model.tonight.cooking ? (
              <Text variant="bodySmall" weight="semibold" color={colors.olive} onPress={() => router.push(`/pisir/${model.today}`)} accessibilityRole="link">
                {model.tonight.cooking.userId === state.me?.id || !personById.get(model.tonight.cooking.userId)
                  ? t("bugun.cooking")
                  : t("bugun.whoCooking", { name: personById.get(model.tonight.cooking.userId)!.name })}{" "}
                · {model.tonight.cooking.step === 0 ? t("bugun.prepPhase") : t("cook.progress", { step: model.tonight.cooking.step, total: model.tonight.cooking.total })}
              </Text>
            ) : null)}
          {model.tonight.mainId && (
            <Link href={`/tarif/${model.tonight.mainId}?gun=${model.today}`} asChild>
              <Pressable accessibilityRole="link" style={{ minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Text weight="bold">{t("menu.openMenu")}</Text>
                <Icon name="arrowRight" size={18} color={colors.ink} />
              </Pressable>
            </Link>
          )}
        </Card>
      ) : model.ateOut ? (
        <Card style={{ alignItems: "flex-start" }}>
          <Icon name="cutlery" size={22} color={colors.ink2} />
          <Text variant="h3">{t("bugun.outTonight")}</Text>
          <Text color={colors.ink2}>
            {model.returnedNames.length ? t("week.returned", { dishes: model.returnedNames.join(", ").toLocaleLowerCase(intlTag()) }) : t("bugun.enjoy")}
          </Text>
          <Button title={t("common.undo")} variant="ghost" size="sm" onPress={() => clearAteOut(model.today)} />
        </Card>
      ) : (
        <EmptyState title={t(leaveEmpty ? "bugun.free" : "bugun.empty")} text={t(leaveEmpty ? "bugun.freeText" : "bugun.emptyText")}>
          <Button title={t("bugun.pickMatch")} size="sm" onPress={() => router.push(`/eslesme?gun=${model.today}` as never)} />
          {!leaveEmpty && <Button title={t("bugun.leaveEmpty")} size="sm" variant="secondary" onPress={() => setLeaveEmpty(true)} />}
        </EmptyState>
      )}

      {model.leftover && <YesterdayCard ev={model.leftover} today={model.today} />}

      {model.fridge.length > 0 && (
        <Card>
          <Text variant="h3">{t("week.inFridge")}</Text>
          {model.fridge.map((f) => (
            <FridgeRow key={f.fromDate} ev={f} today={model.today} />
          ))}
        </Card>
      )}

      {model.tonight && (
        <View style={{ gap: 10 }}>
          <Row style={{ flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t("bugun.ateOutToday")}
                icon="cutlery"
                variant="secondary"
                size="sm"
                onPress={async () => {
                  await ateOut(model.today);
                  setNotice({ kind: "info", text: t("bugun.ateOutNotice") });
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t("bugun.planChanged")} icon="swap" variant="secondary" size="sm" onPress={() => setChangeOpen((v) => !v)} />
            </View>
          </Row>
          {changeOpen && (
            <Card tone="soft" style={{ borderWidth: 0 }}>
              <OptionRow
                title={t(tomorrowPlanned ? "bugun.swapTomorrow" : "bugun.moveTomorrow")}
                sub={t(tomorrowPlanned ? "bugun.swapTomorrowSub" : "bugun.moveTomorrowSub")}
                onPress={async () => {
                  setChangeOpen(false);
                  await moveToTomorrow(model.today);
                }}
              />
              <OptionRow
                title={t("bugun.sendBack")}
                sub={t("bugun.sendBackSub")}
                onPress={async () => {
                  setChangeOpen(false);
                  await sendBackToMatches(model.today);
                }}
              />
              <OptionRow title={t("form.bulk.cancel")} onPress={() => setChangeOpen(false)} />
            </Card>
          )}
          <Text variant="small">{t("bugun.changeNote")}</Text>
        </View>
      )}

      <Pressable
        onPress={() => router.push((model.tomorrow ? "/hafta" : `/eslesme?gun=${addDays(model.today, 1)}`) as never)}
        accessibilityRole="link"
        accessibilityLabel={model.tomorrow ? t("bugun.tomorrowAria", { line: model.tomorrow.line }) : `${t("bugun.tomorrow")}: ${t("bugun.tomorrowEmpty")}`}
        style={{ borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Eyebrow color={colors.ink2}>{t("bugun.tomorrow")}</Eyebrow>
          <Text weight="semibold">{model.tomorrow ? model.tomorrow.line : t("bugun.tomorrowEmpty")}</Text>
          <Text variant="meta">{model.tomorrow ? model.tomorrow.sub : t("bugun.tomorrowEmptySub")}</Text>
        </View>
        {model.tomorrow?.avatarId && personById.get(model.tomorrow.avatarId) && <Avatar person={personById.get(model.tomorrow.avatarId)!} size={28} />}
      </Pressable>
    </Screen>
  );
}

function OptionRow({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: touchTarget, justifyContent: "center", gap: 2, paddingVertical: 6 }}>
      <Text weight="semibold">{title}</Text>
      {sub ? <Text variant="meta">{sub}</Text> : null}
    </Pressable>
  );
}

function YesterdayCard({ ev, today }: { ev: EveningLeftover; today: string }) {
  const { t } = useTranslation();
  const name = dishInSentence(ev.recipe.name);
  const k = ev.outcome.kind;
  const title = t(k === "lunch" ? "bugun.yLunch" : k === "fridge" ? "bugun.yFridge" : k === "discard" ? "bugun.yDiscard" : "bugun.yNone", { dish: name });
  const sub =
    k === "lunch"
      ? t("bugun.inFridgePortions", { count: ev.portions })
      : ev.outcome.kind === "fridge"
        ? t("bugun.untilPortions", { until: keepUntilLabel(ev.outcome.useBy, today), count: ev.portions })
        : null;
  return (
    <Card tone="olive" style={{ borderWidth: 0 }}>
      <Text weight="semibold">{title}</Text>
      {sub && <Text variant="meta">{sub}</Text>}
      <LeftoverChoices ev={ev} when="yesterday" title={t("bugun.fromYesterday")} />
    </Card>
  );
}

function FridgeRow({ ev, today }: { ev: EveningLeftover; today: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const setLeftoverChoice = useApp((s) => s.setLeftoverChoice);
  if (ev.outcome.kind !== "fridge") return null;
  return (
    <Row style={{ flexWrap: "nowrap", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold">{ev.recipe.name}</Text>
        <Text variant="meta">
          {ev.plannedDate
            ? t("bugun.eatenOn", { evening: eveningLabel(ev.plannedDate, today) })
            : t("bugun.cookedOn", { until: keepUntilLabel(ev.outcome.useBy, today), day: dayName(ev.fromDate) })}
        </Text>
      </View>
      <Button
        title={t("cook.done")}
        variant="ghost"
        size="sm"
        accessibilityLabel={t("bugun.doneNamed", { name: ev.recipe.name })}
        onPress={() => setLeftoverChoice(ev.fromDate, "eaten")}
      />
    </Row>
  );
}
