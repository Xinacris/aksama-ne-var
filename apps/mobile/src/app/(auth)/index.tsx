import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@anv/core/services/demo";
import { listJoin } from "@anv/core/i18n";
import { messageOf } from "@anv/core/services/errors";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Divider, Field, Row, Screen, Text } from "@/ui";

/** Giriş: local account sign-in, or the sample household in one tap. */
export default function SignIn() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const logIn = useApp((s) => s.logIn);
  const loadDemo = useApp((s) => s.loadDemo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"login" | "demo" | null>(null);

  async function submit() {
    setBusy("login");
    setError(null);
    try {
      await logIn({ email, password });
    } catch (e) {
      setError(messageOf(e));
      setBusy(null);
    }
  }

  return (
    <Screen header>
      <View style={{ gap: 10, marginTop: 12 }}>
        <Text variant="eyebrow">{t("app.name")}</Text>
        <Text variant="display">{t("giris.title")}</Text>
        <Text color={colors.ink2}>{t("giris.lead")}</Text>
      </View>
      <Field
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        error={error}
      />
      <Button title={busy === "login" ? t("auth.signingIn") : t("auth.signIn")} size="lg" busy={busy === "login"} onPress={submit} />
      <Row style={{ justifyContent: "center" }}>
        <Text variant="bodySmall" color={colors.ink2}>
          {t("giris.noAccount")}
        </Text>
        <Button title={t("auth.createAccount")} variant="ghost" size="sm" onPress={() => router.push("/kayit")} />
      </Row>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
        <Text variant="meta">{t("giris.or")}</Text>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
      </View>
      <Button
        title={t("giris.demo")}
        variant="secondary"
        size="lg"
        busy={busy === "demo"}
        testID="demo"
        onPress={async () => {
          setBusy("demo");
          try {
            await loadDemo();
          } finally {
            setBusy(null);
          }
        }}
      />
      <Text variant="small" style={{ textAlign: "center" }}>
        {t("giris.demoNote", { emails: listJoin(DEMO_ACCOUNTS.map((a) => a.email)), password: DEMO_PASSWORD })}
      </Text>
    </Screen>
  );
}
