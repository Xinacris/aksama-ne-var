import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { messageOf } from "@anv/core/services/errors";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Field, IconButton, Row, Screen, Text } from "@/ui";

/** Yeni hesap: a local account on this phone; the household comes next (onboarding). */
export default function SignUp() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const signUp = useApp((s) => s.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signUp({ name, email, password });
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <Screen header>
      <IconButton icon="chevronLeft" label={t("form.back")} onPress={() => router.back()} />
      <View style={{ gap: 10 }}>
        <Text variant="display">{t("kayit.title")}</Text>
        <Text color={colors.ink2}>{t("kayit.lead")}</Text>
      </View>
      <Field label={t("auth.yourName")} value={name} onChangeText={setName} autoComplete="given-name" textContentType="givenName" />
      <Field label={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <Field
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t("mobile.passwordHint")}
        error={error}
        onSubmitEditing={submit}
      />
      <Button title={busy ? t("auth.preparing") : t("auth.createAccount")} size="lg" busy={busy} onPress={submit} />
      <Row style={{ justifyContent: "center" }}>
        <Text variant="bodySmall" color={colors.ink2}>
          {t("kayit.haveAccount")}
        </Text>
        <Button title={t("auth.signIn")} variant="ghost" size="sm" onPress={() => router.back()} />
      </Row>
    </Screen>
  );
}
