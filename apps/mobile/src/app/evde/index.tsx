import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PantryItem } from "@anv/core/data/models";
import { agoTime } from "@anv/core/domain/dates";
import { pantryUpdatedAt } from "@anv/core/domain/pantry";
import { now } from "@anv/core/lib/clock";
import { PantryBanner, PantryEditSheet, PantryList, PantryQuickAdd } from "@/components/Pantry";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Card, EmptyState, Screen, Text } from "@/ui";

/** "Evde ne var?" on the phone: what's at home first (grouped), adding below it. */
export default function Pantry() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pantry = useApp((x) => x.pantry);
  const answers = useApp((x) => x.pantryAnswers);
  const addPantryItems = useApp((x) => x.addPantryItems);
  const removePantryItem = useApp((x) => x.removePantryItem);
  const setNotice = useApp((x) => x.setNotice);
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const byName = useMemo(() => new Map(pantry.map((p) => [p.name, p])), [pantry]);
  const updated = pantryUpdatedAt(pantry, answers);

  async function add(name: string) {
    const n = await addPantryItems([{ name }]);
    setNotice({ kind: "info", text: n ? t("pantry.added", { count: n }) : t("pantry.alreadyThere") });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("pantry.title") }} />
      <PantryBanner />
      <Text variant="meta" weight="semibold">
        {updated ? t("pantry.updated", { when: agoTime(updated, now()) }) : t("pantry.never")}
      </Text>
      <Text color={colors.ink2}>{t("pantry.lead")}</Text>
      <Text variant="meta" accessibilityLiveRegion="polite">
        {t("pantry.items", { count: pantry.length })}
      </Text>
      {pantry.length ? <PantryList items={pantry} onEdit={setEditing} /> : <EmptyState title={t("pantry.emptyTitle")} text={t("pantry.emptyText")} />}
      <Card>
        <Text variant="h3">{t("pantry.addTitle")}</Text>
        <PantryQuickAdd
          isOn={(n) => byName.has(n)}
          onToggle={(n) => {
            const p = byName.get(n);
            if (p) void removePantryItem(p.id);
            else void add(n);
          }}
          onAdd={(n) => void add(n)}
        />
      </Card>
      <PantryEditSheet item={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
