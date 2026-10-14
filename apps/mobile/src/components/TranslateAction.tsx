import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Recipe } from "@anv/core/data/models";
import { hasLocaleText } from "@anv/core/domain/recipeText";
import { getLocale } from "@anv/core/i18n";
import { requestTranslation, translateAvailable, type FetchLike } from "@anv/core/services/translate";
import { API_URL } from "@/api";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Text } from "@/ui";

/** "Çevir / Translate" (same rules as the web): only for household recipes without text in this language, only when the server can translate. */
export function TranslateAction({ raw }: { raw: Recipe }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const household = useApp((x) => x.household);
  const saveTranslation = useApp((x) => x.saveTranslation);
  const setNotice = useApp((x) => x.setNotice);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const locale = getLocale();
  const needed = raw.householdId !== null && !hasLocaleText(raw, locale);
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    void translateAvailable(fetch as unknown as FetchLike, API_URL).then((a) => alive && setAvailable(a));
    return () => {
      alive = false;
    };
  }, [needed]);
  if (!needed || !available) return null;
  return (
    <View style={{ backgroundColor: colors.surface2, borderRadius: 18, padding: 12, gap: 8 }}>
      <Text variant="bodySmall">{t("translate.note", { lang: t(`language.in.${raw.lang ?? "tr"}`) })}</Text>
      <Button
        title={busy ? t("translate.working") : t("translate.action")}
        size="sm"
        variant="soft"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          const out = await requestTranslation(fetch as unknown as FetchLike, API_URL, raw, locale, household?.id ?? "");
          if (out.ok) {
            await saveTranslation(raw.id, locale, out.translation);
            setNotice({ kind: "info", text: t("translate.done") });
          } else setNotice({ kind: "error", text: out.error ?? t("translate.failed") });
          setBusy(false);
        }}
      />
    </View>
  );
}
