import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { AUTH_PROVIDERS, authProvidersUi } from "@anv/core/lib/flags";
import { touchTarget } from "@anv/core/design/tokens";
import { useTheme } from "@/theme";
import { Icon, Text } from "@/ui";

/** Read at build time (EXPO_PUBLIC_AUTH_PROVIDERS_UI=0 hides the buttons). */
export const SHOW_AUTH_PROVIDERS = authProvidersUi(process.env.EXPO_PUBLIC_AUTH_PROVIDERS_UI);

/**
 * "Google / Apple / E-posta ile giriş yap": not wired to a provider yet, shown as "Yakında"
 * (announced as unavailable) behind one flag, like the web. The local flow stays below them.
 */
export function AuthProviders() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!SHOW_AUTH_PROVIDERS) return null;
  return (
    <View style={{ gap: 10 }} accessibilityLabel={t("auth.providers.region")} testID="auth-providers">
      {AUTH_PROVIDERS.map((p) => {
        const name = t(`auth.providers.${p}`);
        return (
          <View
            key={p}
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={t("auth.providers.soonLabel", { name })}
            testID={`auth-${p}`}
            style={{ minHeight: touchTarget + 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Icon name={p === "email" ? "mail" : "user"} size={18} color={colors.ink2} />
            <Text weight="semibold" color={colors.ink2} style={{ flex: 1 }}>
              {name}
            </Text>
            <View style={{ borderRadius: 999, backgroundColor: colors.sandSoft, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text variant="small" weight="bold" color={colors.sandText}>
                {t("auth.providers.soon")}
              </Text>
            </View>
          </View>
        );
      })}
      <Text variant="small" style={{ textAlign: "center" }}>
        {t("auth.providers.note")}
      </Text>
    </View>
  );
}
