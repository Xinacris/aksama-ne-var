import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { LeftoverChoice } from "@anv/core/data/models";
import { addDays } from "@anv/core/domain/dates";
import { CHOICE_LABEL, eatsLunchAtHome, keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { radius, touchTarget } from "@anv/core/design/tokens";
import { usePeople } from "@/hooks/usePeople";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Text } from "@/ui";

function current(ev: EveningLeftover): LeftoverChoice | null {
  if (ev.choice) return ev.choice;
  const k = ev.outcome.kind;
  return k === "fridge" || k === "lunch" || k === "none" ? k : null;
}

/** "Hiç kalmadı · Yarın öğlen · Dolaba kaldır · Kimse yemeyecek" — one tap, with undo (same rules as the web). */
export function LeftoverChoices({ ev, when, title }: { ev: EveningLeftover; when: "tonight" | "yesterday"; title?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const household = useApp((x) => x.household);
  const today = useApp((x) => x.today);
  const setLeftoverChoice = useApp((x) => x.setLeftoverChoice);
  const { byId } = usePeople();
  const [undo, setUndo] = useState<{ prev: LeftoverChoice | null } | null>(null);
  const lunchPossible = !household || eatsLunchAtHome(household, addDays(ev.fromDate, 1));
  const options: LeftoverChoice[] = ["none", ...(lunchPossible ? (["lunch"] as const) : []), "fridge", "discard"];
  const pressed = current(ev);
  const by = ev.choiceBy ? byId.get(ev.choiceBy) : undefined;
  const outcome =
    ev.outcome.kind === "fridge"
      ? t("leftovers.inFridge", { until: keepUntilLabel(ev.outcome.useBy, today) })
      : ev.outcome.kind === "lunch"
        ? t(ev.outcome.date === today ? "leftovers.lunchToday" : "leftovers.lunchTomorrow")
        : ev.outcome.kind === "discard"
          ? t("leftovers.nobody")
          : t("leftovers.noneLeft");
  const heading = title ?? t("leftovers.title");
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{heading}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((c) => {
          const on = pressed === c;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={async () => {
                setUndo({ prev: ev.choice });
                void Haptics.selectionAsync().catch(() => {});
                await setLeftoverChoice(ev.fromDate, c);
              }}
              style={{ minHeight: touchTarget, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: "center", backgroundColor: on ? colors.olive : colors.surface, borderWidth: on ? 0 : 1.5, borderColor: colors.line }}
            >
              <Text variant="bodySmall" weight="semibold" color={on ? colors.surface : colors.ink}>
                {c === "lunch" && when === "yesterday" ? t("leftovers.lunchTodayChoice") : CHOICE_LABEL[c]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
        <Text variant="meta" accessibilityLiveRegion="polite">
          {outcome}
          {by ? t("leftovers.chosenBy", { name: by.name }) : ev.choice === null ? t("leftovers.asRecipe") : ""}
        </Text>
        {undo && (
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={async () => {
              const prev = undo.prev;
              setUndo(null);
              await setLeftoverChoice(ev.fromDate, prev);
            }}
            style={{ minHeight: touchTarget, justifyContent: "center", paddingHorizontal: 8 }}
          >
            <Text variant="meta" weight="bold" color={colors.tomato}>
              {t("common.undo")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
