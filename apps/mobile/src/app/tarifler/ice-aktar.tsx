import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { SourcePlatform } from "@anv/core/data/models";
import { extractUrl } from "@anv/core/domain/import/detect";
import type { ImportProvider, ImportResult } from "@anv/core/domain/import/types";
import { getLocale } from "@anv/core/i18n";
import { keepSource, sourceCredit, toRecipeDraft } from "@anv/core/services/importDraft";
import type { RecipeDraft } from "@anv/core/services/recipeForm";
import { postJson } from "@/api";
import { RecipeForm } from "@/components/RecipeForm";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Field, Screen, Text } from "@/ui";

type ApiResponse = ImportResult & { error?: string; counted?: { platform: SourcePlatform | null; provider: ImportProvider } | null };

/** Linkten ekle: the web's /api/import, then the same draft review in the full form. */
export default function ImportRecipe() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ url?: string; text?: string }>();
  const household = useApp((x) => x.household);
  const createRecipe = useApp((x) => x.createRecipe);
  const logImport = useApp((x) => x.logImport);
  const sharedText = params.text ?? "";
  const sharedUrl = params.url || extractUrl(sharedText) || "";
  const [url, setUrl] = useState(sharedUrl);
  const [text, setText] = useState(sharedText && extractUrl(sharedText) === sharedText.trim() ? "" : sharedText.replace(sharedUrl, "").trim());
  const [pasteOpen, setPasteOpen] = useState(!!text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [attempt, setAttempt] = useState(0);
  const auto = useRef(false);
  const lastTags = useRef("");

  async function run() {
    if (!url.trim() && !text.trim()) {
      setError(t("import.needLink"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<ApiResponse>("/api/import", { url: url.trim(), text: text.trim(), householdId: household?.id ?? "", locale: getLocale() });
      const body = res.body;
      if (!res.ok || body.error) {
        setError(body.error ?? t("import.failed"));
        setPasteOpen(true);
        return;
      }
      const source = keepSource(result?.source ?? null, body.source);
      setResult({ ...body, source });
      if (body.counted) await logImport({ platform: body.counted.platform, provider: body.counted.provider });
      if (body.needsPaste) {
        setPasteOpen(true);
        setDraft(null);
      } else if (body.draft) {
        setDraft({
          ...toRecipeDraft(body.draft, source, lastTags.current, body.writtenRecipeUrl ?? null),
          ...(body.sourceLang ? { sourceLang: body.sourceLang } : {}),
          ...(body.sourceText ? { sourceText: body.sourceText } : {}),
        });
        lastTags.current = "";
        setAttempt((n) => n + 1);
      }
    } catch {
      setError(t("import.offline"));
      setPasteOpen(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (auto.current || !household || (!sharedUrl && !sharedText)) return;
    auto.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for a link handed over by quick add
  }, [household]);

  if (draft && result) {
    return (
      <>
        <Stack.Screen options={{ title: t("import.checkTitle") }} />
        <RecipeForm
          key={attempt}
          initial={draft}
          submitLabel={t("form.saveRecipe")}
          header={
            <Card tone="soft" style={{ borderWidth: 0 }}>
              {result.source?.url && (
                <Text variant="bodySmall" weight="bold">
                  {sourceCredit({ platform: result.source.platform, author: result.source.author, url: result.source.url })}
                </Text>
              )}
              <Text variant="bodySmall" accessibilityLiveRegion="polite">
                <Text variant="bodySmall" weight="bold">
                  {t("import.checkSave")}
                </Text>{" "}
                {result.provider === "web"
                  ? t(result.writtenRecipeUrl ? "import.fromWritten" : "import.fromPage")
                  : result.path === "llm"
                    ? t("import.fromLlm")
                    : t("import.fromRules")}
              </Text>
              {result.draft && result.draft.steps.length === 0 && <Text variant="small">{t("import.noSteps")}</Text>}
              <Button
                title={t("import.repaste")}
                variant="ghost"
                size="sm"
                onPress={() => {
                  lastTags.current = draft.tags;
                  setDraft(null);
                  setPasteOpen(true);
                }}
              />
            </Card>
          }
          onSubmit={async (value) => {
            const r = await createRecipe(value, { imported: true });
            if (r) router.replace(`/tarif/${r.id}`);
          }}
        />
      </>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("import.title") }} />
      <Text color={colors.ink2}>{t("import.lead")}</Text>
      <Field
        label={t("import.link")}
        placeholder="https://www.instagram.com/reel/…"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        icon="link"
        value={url}
        onChangeText={setUrl}
        testID="import-url"
      />
      {result?.source?.url && (
        <Card tone="soft" style={{ borderWidth: 0 }}>
          <Text variant="bodySmall" weight="bold">
            {sourceCredit({ platform: result.source.platform, author: result.source.author, url: result.source.url })}
          </Text>
          <Button title={t("import.open")} variant="ghost" size="sm" onPress={() => Linking.openURL(result.source!.url)} />
        </Card>
      )}
      {result?.message && (
        <Text accessibilityLiveRegion="polite" color={colors.ink2}>
          {result.message}
        </Text>
      )}
      <Button title={pasteOpen ? t("import.hidePaste") : t("import.showPaste")} variant="ghost" onPress={() => setPasteOpen((v) => !v)} />
      {pasteOpen && <Field label={t("import.pasteLabel")} hint={t("import.pasteHint")} multiline maxLength={8000} value={text} onChangeText={setText} />}
      {error && (
        <View accessibilityLiveRegion="assertive" style={{ backgroundColor: colors.tomatoSoft, borderRadius: 14, padding: 12 }}>
          <Text weight="semibold">{error}</Text>
        </View>
      )}
      <Button title={busy ? t("import.working") : t("import.go")} size="lg" busy={busy} onPress={run} />
      <Text variant="small">{t("import.note")}</Text>
    </Screen>
  );
}
