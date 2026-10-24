import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { PantryQuickAdd } from "@/components/Pantry";
import { askReminderPermission } from "@/reminders/notifications";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Screen, Text } from "@/ui";

/** Onboarding: "Evde neler var?" — a few taps, or skip. Last step for a partner who joined. */
export default function PantryStep() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { son } = useLocalSearchParams<{ son?: string }>();
  const last = son === "1";
  const pantry = useApp((x) => x.pantry);
  const addPantryItems = useApp((x) => x.addPantryItems);
  const completeOnboarding = useApp((x) => x.completeOnboarding);
  const initial = useMemo(() => pantry.map((p) => p.name), [pantry]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = picked ?? initial;
  const toggle = (n: string) => setPicked(chosen.includes(n) ? chosen.filter((x) => x !== n) : [...chosen, n]);

  async function next(save: boolean) {
    setBusy(true);
    const fresh = chosen.filter((n) => !initial.includes(n));
    if (save && fresh.length) {
      await addPantryItems(fresh.map((name) => ({ name })));
      // Reminders keep the pantry current: ask for notifications now that there is something to remind about.
      await askReminderPermission();
    }
    if (last) await completeOnboarding();
    else router.push("/onboarding/davet");
    setBusy(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header>
        <Text variant="meta" weight="semibold">
          {t(last ? "onbPantry.step22" : "onbPantry.step23")}
        </Text>
        <Text variant="title">{t("onbPantry.title")}</Text>
        <Text color={colors.ink2}>{t("onbPantry.lead")}</Text>
        <PantryQuickAdd isOn={(n) => chosen.includes(n)} onToggle={toggle} onAdd={(n) => !chosen.includes(n) && setPicked([...chosen, n])} />
        <View style={{ height: 140 }} />
      </Screen>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 32, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 }}>
        <Text variant="meta" accessibilityLiveRegion="polite">
          {t("onbPantry.chosen", { count: chosen.length })}
        </Text>
        <Button title={t(last ? "onbPantry.letsStart" : "onbPantry.continue")} icon="arrowRight" busy={busy} onPress={() => next(true)} testID="pantry-continue" />
        <Button title={t("onbPantry.skip")} variant="ghost" disabled={busy} onPress={() => next(false)} />
      </View>
    </View>
  );
}
