import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Screen, Text } from "@/ui";

/** Step 2: the invite code. Honest about sync: two phones don't see each other yet. */
export default function Invite() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const household = useApp((s) => s.household);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  return (
    <Screen header>
      <Text variant="meta" weight="semibold">
        {t("onb2.step")}
      </Text>
      <Text variant="title">{t("mobile.onb.inviteTitle")}</Text>
      <Text color={colors.ink2}>{t("mobile.onb.inviteLead")}</Text>
      <Card tone="soft" style={{ alignItems: "center" }}>
        <Text variant="label">{t("mobile.onb.code")}</Text>
        <Text variant="display" selectable accessibilityLabel={`${t("mobile.onb.code")}: ${household?.inviteCode ?? ""}`}>
          {household?.inviteCode ?? ""}
        </Text>
      </Card>
      <Text variant="small">{t("mobile.onb.syncSoon")}</Text>
      <View style={{ gap: 10 }}>
        <Button title={t("onb2.solo")} size="lg" onPress={() => completeOnboarding()} />
      </View>
    </Screen>
  );
}
