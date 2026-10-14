import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { messageOf } from "@anv/core/services/errors";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Field, Screen, Text } from "@/ui";

/** Signed in without a household: set one up, or join one by its invite code. */
export default function HouseholdChoice() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useApp((s) => s.status);
  const createHousehold = useApp((s) => s.createHousehold);
  const joinHousehold = useApp((s) => s.joinHousehold);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  if (status === "ready") return <Redirect href="/onboarding/yemekler" />;

  async function create() {
    setBusy("create");
    try {
      await createHousehold();
      await useApp.getState().refresh();
      router.replace("/onboarding/yemekler");
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setBusy("join");
    setError(null);
    try {
      await joinHousehold(code);
      await useApp.getState().refresh();
      router.replace("/onboarding/yemekler?katil=1");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen header>
      <View style={{ gap: 10, marginTop: 12 }}>
        <Text variant="display">{t("mobile.onb.title")}</Text>
        <Text color={colors.ink2}>{t("mobile.onb.lead")}</Text>
      </View>
      <Button title={t("mobile.onb.create")} size="lg" busy={busy === "create"} onPress={create} />
      <Card>
        <Text variant="h3">{t("mobile.onb.joinTitle")}</Text>
        <Field label={t("mobile.onb.code")} hint={t("mobile.onb.codeHint")} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} error={error} />
        <Button title={t("mobile.onb.join")} variant="secondary" busy={busy === "join"} disabled={!code.trim()} onPress={join} />
      </Card>
    </Screen>
  );
}
