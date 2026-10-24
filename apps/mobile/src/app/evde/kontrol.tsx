import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { findReminder, reminderText, reminderNames } from "@anv/core/domain/pantryReminders";
import { PantryCheck } from "@/components/Pantry";
import { usePantryReminders } from "@/reminders/usePantryReminders";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, EmptyState, Screen, Text } from "@/ui";

/** A reminder's quick check (from the banner or a tapped notification). */
export default function PantryCheckScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { r: id = "" } = useLocalSearchParams<{ r?: string }>();
  const plan = usePantryReminders();
  const recipes = useApp((x) => x.recipes);
  const names = useMemo(() => reminderNames(recipes), [recipes]);
  const answer = useApp((x) => x.answerPantryCheck);
  const r = findReminder(plan, id);
  const text = r ? reminderText(r, names) : null;
  return (
    <Screen>
      <Stack.Screen options={{ title: t("pantry.checkEyebrow") }} />
      <Text variant="title">{text?.title ?? t("pantry.title")}</Text>
      {text && <Text color={colors.ink2}>{text.body}</Text>}
      {r && r.ingredients.length === 0 ? (
        // A week check with nothing at home and nothing planned: the pantry, or answer it.
        <>
          <Text variant="bodySmall">{t("pantry.checkEmpty")}</Text>
          <Button title={t("pantry.checkOpenPantry")} onPress={() => router.replace("/evde")} />
          <Button
            title={t("pantry.checkLooked")}
            variant="secondary"
            testID="pantry-check-looked"
            onPress={async () => {
              await answer(r.answerKey, {});
              router.replace("/evde");
            }}
          />
        </>
      ) : r ? (
        <>
          <Text variant="bodySmall">{t("pantry.checkLead")}</Text>
          <PantryCheck ingredients={r.ingredients} answerKey={r.answerKey} onDone={() => router.replace("/evde")} />
        </>
      ) : (
        <EmptyState title={t("pantry.checkNothing")}>
          <Button title={t("pantry.checkOpenPantry")} size="sm" onPress={() => router.replace("/evde")} />
        </EmptyState>
      )}
    </Screen>
  );
}
