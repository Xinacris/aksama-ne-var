import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { importHref, quickAddAction, quickAddHint, quickAddIntent, type QuickAdd } from "@anv/core/domain/quickAdd";
import { browsableRecipes, useApp } from "@/store";
import { Button, Field, Sheet } from "@/ui";

const sameName = (a: string, b: string) => a.toLocaleLowerCase("tr") === b.toLocaleLowerCase("tr");

/** One tap: a link goes to import, a dish name is saved as a name-only recipe and its page opens (same as the web). */
export function useQuickAdd() {
  const recipes = useApp(browsableRecipes);
  const addStubRecipe = useApp((x) => x.addStubRecipe);
  const [busy, setBusy] = useState(false);
  const existing = (q: QuickAdd) => (q.kind === "name" ? recipes.find((r) => sameName(r.name, q.name)) : undefined);

  async function go(q: QuickAdd, onDone?: () => void): Promise<void> {
    if (q.kind === "empty") return;
    if (q.kind === "url" || q.kind === "text") {
      onDone?.();
      router.push(importHref(q) as never);
      return;
    }
    const known = existing(q);
    if (known) {
      onDone?.();
      router.push(`/tarif/${known.id}`);
      return;
    }
    setBusy(true);
    try {
      const r = await addStubRecipe(q.name);
      onDone?.();
      if (r) router.push(`/tarif/${r.id}?yeni=1`);
    } finally {
      setBusy(false);
    }
  }
  return { go, busy, existing };
}

export function QuickAddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { go, busy, existing } = useQuickAdd();
  const q = quickAddIntent(value);
  const known = existing(q);
  const close = () => {
    setValue("");
    setError(null);
    onClose();
  };

  function submit() {
    if (q.kind === "empty") {
      setError(t("quickAdd.empty"));
      return;
    }
    setError(null);
    void go(q, close);
  }

  return (
    <Sheet visible={visible} onClose={close} title={t("quickAdd.title")} closeLabel={t("common.close")}>
      <Field
        label={t("quickAdd.field")}
        placeholder={t("quickAdd.placeholder")}
        value={value}
        onChangeText={(v) => {
          setValue(v);
          if (error) setError(null);
        }}
        hint={quickAddHint(q, known?.name ?? null)}
        error={error}
        autoFocus
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={submit}
        icon={q.kind === "url" ? "link" : "plus"}
        testID="quick-add-input"
      />
      <Button title={busy ? t("quickAdd.saving") : quickAddAction(q, !!known)} size="lg" busy={busy} onPress={submit} icon={q.kind === "url" || q.kind === "text" ? "arrowRight" : undefined} />
      <Button
        title={t("quickAdd.detailed")}
        variant="ghost"
        onPress={() => {
          const ad = q.kind === "name" ? q.name : "";
          close();
          router.push((ad ? `/tarifler/yeni?ad=${encodeURIComponent(ad)}` : "/tarifler/yeni") as never);
        }}
      />
    </Sheet>
  );
}
