import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AISLE_LABEL, UNITS, UNIT_LABEL, type PantryItem, type Unit } from "@anv/core/data/models";
import { COMMON_PANTRY, groupPantry, pantryStatus, searchIngredients, type PantryStatus } from "@anv/core/domain/pantry";
import { reminderText, type PantryReminder, reminderNames } from "@anv/core/domain/pantryReminders";
import { ingredientLabel } from "@anv/core/domain/recipeText";
import { formatIngredientQuantity } from "@anv/core/domain/shopping";
import { searchKey } from "@anv/core/lib/text";
import { touchTarget } from "@anv/core/design/tokens";
import { reminderUrl } from "@/reminders/notifications";
import { useDismissedReminders } from "@/reminders/prefs";
import { usePantryReminders } from "@/reminders/usePantryReminders";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Chip, Field, Icon, IconButton, Row, Sheet, Text } from "@/ui";
import { SelectSheet } from "@/ui/more";

/** "Evde ne var?" quick add: common ingredients by category, catalog search, free text (as on the web). */
export function PantryQuickAdd({ isOn, onToggle, onAdd }: { isOn: (name: string) => boolean; onToggle: (name: string) => void; onAdd: (name: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchIngredients(q, 10), [q]);
  const free = q.trim();
  const exact = hits.some((n) => searchKey(ingredientLabel(n)) === searchKey(free) || searchKey(n) === searchKey(free));
  const add = (n: string) => {
    onAdd(n);
    setQ("");
  };
  return (
    <View style={{ gap: 14 }}>
      <Field
        label={t("pantry.search")}
        hideLabel
        icon="search"
        placeholder={t("pantry.searchPlaceholder")}
        value={q}
        onChangeText={setQ}
        returnKeyType="done"
        onSubmitEditing={() => free && add(hits[0] && exact ? hits[0] : free)}
      />
      {free ? (
        <Row>
          {hits.map((n) => (
            <Chip key={n} label={ingredientLabel(n)} selected={isOn(n)} onPress={() => (isOn(n) ? onToggle(n) : add(n))} />
          ))}
          {!exact && (
            <Pressable
              onPress={() => add(free)}
              accessibilityRole="button"
              testID="pantry-add-free"
              style={{ minHeight: touchTarget, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.ink2, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Icon name="plus" size={16} color={colors.ink} />
              <Text variant="bodySmall" weight="semibold">
                {t("pantry.addFree", { name: free })}
              </Text>
            </Pressable>
          )}
        </Row>
      ) : (
        COMMON_PANTRY.map((g) => (
          <View key={g.aisle} style={{ gap: 8 }}>
            <Text variant="label">{AISLE_LABEL[g.aisle]}</Text>
            <Row>
              {g.names.map((n) => (
                <Chip key={n} label={ingredientLabel(n)} selected={isOn(n)} onPress={() => onToggle(n)} />
              ))}
            </Row>
          </View>
        ))
      )}
    </View>
  );
}

/** What's at home by category; "Az kaldı" toggles, edit opens a sheet, × removes. */
export function PantryList({ items, onEdit }: { items: PantryItem[]; onEdit: (p: PantryItem) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const remove = useApp((x) => x.removePantryItem);
  const update = useApp((x) => x.updatePantryItem);
  return (
    <View style={{ gap: 16 }}>
      {groupPantry(items).map((g) => (
        <View key={g.aisle} style={{ gap: 8 }}>
          <Text variant="label" accessibilityRole="header">
            {AISLE_LABEL[g.aisle]} · {g.items.length}
          </Text>
          {g.items.map((p) => {
            const low = pantryStatus(p) === "low";
            const name = ingredientLabel(p.name);
            return (
              <View key={p.id} testID={`pantry-row-${p.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingLeft: 14, minHeight: touchTarget + 8 }}>
                <View style={{ flex: 1 }}>
                  <Text weight="semibold">{name}</Text>
                  {p.quantity !== null && <Text variant="meta">{formatIngredientQuantity(p)}</Text>}
                </View>
                <Chip tone="sand" label={t("pantry.low")} selected={low} onPress={() => void update(p.id, { status: low ? "have" : "low" })} />
                <IconButton icon="edit" label={t("pantry.edit", { name })} onPress={() => onEdit(p)} />
                <IconButton icon="close" label={t("pantry.remove", { name })} onPress={() => void remove(p.id)} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Edit one item: name, optional amount and unit, have / running low. */
export function PantryEditSheet({ item, onClose }: { item: PantryItem | null; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useApp((x) => x.updatePantryItem);
  type Draft = { id: string; name: string; qty: string; unit: Unit | ""; status: PantryStatus };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const d: Draft | null =
    item && draft?.id === item.id
      ? draft
      : item
        ? { id: item.id, name: ingredientLabel(item.name), qty: item.quantity === null ? "" : String(item.quantity).replace(".", ","), unit: item.unit ?? "", status: pantryStatus(item) }
        : null;
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch });
  const close = () => {
    setDraft(null);
    setError(null);
    onClose();
  };
  async function save() {
    if (!d || !item) return;
    if (!d.name.trim()) return setError(t("errors.itemName"));
    const q = d.qty.trim() ? Number(d.qty.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q <= 0)) return setError(t("liste.qtyNumber"));
    await update(item.id, { name: d.name, quantity: q, unit: q === null ? null : d.unit || "adet", status: d.status });
    close();
  }
  return (
    <Sheet visible={!!item} onClose={close} title={d?.name ?? ""} closeLabel={t("common.close")}>
      {d && (
        <>
          <Field label={t("pantry.name")} value={d.name} onChangeText={(v) => set({ name: v })} error={error} />
          <Row style={{ flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Field label={t("pantry.qty")} keyboardType="decimal-pad" value={d.qty} onChangeText={(v) => set({ qty: v })} placeholder={t("liste.optional")} />
            </View>
            <SelectSheet compact label={t("pantry.unit")} value={d.unit} onChange={(v) => set({ unit: v })} options={[{ value: "" as Unit | "", label: t("pantry.noUnit") }, ...UNITS.map((u) => ({ value: u as Unit | "", label: UNIT_LABEL[u] }))]} />
          </Row>
          <Row>
            <Chip label={t("pantry.have")} selected={d.status === "have"} onPress={() => set({ status: "have" })} />
            <Chip label={t("pantry.low")} selected={d.status === "low"} onPress={() => set({ status: "low" })} />
          </Row>
          <Button title={t("pantry.save")} onPress={save} testID="pantry-save" />
        </>
      )}
    </Sheet>
  );
}

export type Mark = "have" | "low" | "none";
const MARKS: Mark[] = ["have", "none", "low"];
const MARK_LABEL: Record<Mark, string> = { have: "pantry.have", none: "pantry.none", low: "pantry.low" };

/** The reminder's quick "var / yok / az kaldı" checklist. */
export function PantryCheck({ ingredients, answerKey, onDone }: { ingredients: string[]; answerKey: string; onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const answer = useApp((x) => x.answerPantryCheck);
  const setNotice = useApp((x) => x.setNotice);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [error, setError] = useState<string | null>(null);
  const done = Object.keys(marks).length;
  const tone = (m: Mark) => (m === "have" ? colors.olive : m === "none" ? colors.tomato : colors.sand);
  async function save() {
    if (done === 0) return setError(t("pantry.checkNeedOne"));
    await answer(answerKey, marks);
    setNotice({ kind: "info", text: t("pantry.checkSaved") });
    onDone();
  }
  return (
    <View style={{ gap: 12 }}>
      {ingredients.map((n) => (
        <Card key={n} style={{ gap: 8 }}>
          <Text weight="semibold">{ingredientLabel(n)}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("pantry.markGroup", { name: ingredientLabel(n) })} style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {MARKS.map((m) => {
              const on = marks[n] === m;
              return (
                <Pressable
                  key={m}
                  testID={`mark-${n}-${m}`}
                  onPress={() => setMarks((x) => ({ ...x, [n]: m }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={{ minHeight: touchTarget, minWidth: 72, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: on ? tone(m) : colors.line, backgroundColor: on ? tone(m) : colors.bg }}
                >
                  <Text variant="bodySmall" weight="semibold" color={on ? (m === "low" ? colors.ink : colors.onTomato) : colors.ink}>
                    {t(MARK_LABEL[m])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
      <Text variant="meta" accessibilityLiveRegion="polite">
        {t("pantry.checkMarked", { done, total: ingredients.length })}
      </Text>
      {error && (
        <Text color={colors.tomato} weight="semibold" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button title={t("pantry.checkSave")} onPress={save} testID="pantry-check-done" />
    </View>
  );
}

/** In-app delivery of due reminders (always; the fallback when notifications are off or failed). */
export function PantryBanner() {
  const { t } = useTranslation();
  const plan = usePantryReminders();
  const recipes = useApp((x) => x.recipes);
  const [dismissed, dismiss] = useDismissedReminders();
  const names = useMemo(() => reminderNames(recipes), [recipes]);
  const top: PantryReminder | undefined = plan.due.find((r) => !dismissed.includes(r.id));
  if (!top) return null;
  const text = reminderText(top, names);
  return (
    <Card tone="sand" style={{ borderWidth: 0, gap: 10 }}>
      <View testID="pantry-banner" accessibilityRole="summary" accessibilityLabel={t("pantry.banner")} style={{ gap: 4 }}>
        <Text weight="bold">{text.title}</Text>
        <Text variant="bodySmall">{text.body}</Text>
      </View>
      <Row>
        <Button title={t("pantry.bannerOpen")} size="sm" onPress={() => router.push(reminderUrl(top) as never)} testID="pantry-banner-open" />
        <Button title={t("pantry.bannerLater")} size="sm" variant="ghost" onPress={() => dismiss(top.id)} />
      </Row>
    </Card>
  );
}
