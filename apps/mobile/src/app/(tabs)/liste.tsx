import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FALLBACK_AISLE, SIDE_LABEL, UNITS, UNIT_LABEL, type Side, type Unit } from "@anv/core/data/models";
import { catalogEntry, normalizeIngredientName } from "@anv/core/data/seed/ingredients";
import { groupList, remainingNote, sideCount, type ListRow } from "@anv/core/domain/shopping";
import { now } from "@anv/core/lib/clock";
import { radius, touchTarget } from "@anv/core/design/tokens";
import { usePeople } from "@/hooks/usePeople";
import { selectList, useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, EmptyState, Field, Icon, IconButton, Row, Screen, Sheet, Text } from "@/ui";
import { SelectSheet, TabHeader } from "@/ui/more";

const FRESH_MS = 2 * 60 * 1000;

/** Liste: grouped by side and aisle, tick to buy (with a haptic), "evde var", finish shopping, add items. */
export default function ShoppingList() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useApp();
  const rows = useMemo(() => selectList(st), [st]);
  const { byId } = usePeople();
  const [side, setSide] = useState<Side>("market");
  const [adding, setAdding] = useState(false);

  async function finish() {
    if (!rows.some((r) => r.checkedBy)) {
      st.setNotice({ kind: "info", text: t("liste.checkFirst") });
      return;
    }
    const n = await st.finishShopping();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    st.setNotice({ kind: "info", text: t("liste.finished", { count: n }) });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header>
        <TabHeader
          eyebrow={t("liste.eyebrow")}
          title={t("liste.title")}
          right={<IconButton icon="plus" label={t("liste.addItem")} filled onPress={() => setAdding(true)} />}
        />
        {rows.length === 0 ? (
          <EmptyState title={t("liste.emptyTitle")} text={t("liste.emptyText")}>
            <Button title={t("liste.addItem")} size="sm" variant="secondary" onPress={() => setAdding(true)} />
          </EmptyState>
        ) : (
          <>
            <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 4 }}>
              {(["pazar", "market"] as Side[]).map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: side === s }}
                  onPress={() => setSide(s)}
                  style={{ flex: 1, minHeight: touchTarget, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: side === s ? colors.surface : "transparent" }}
                >
                  <Text weight="bold">
                    {SIDE_LABEL[s]} · {sideCount(rows, s)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {groupList(rows, side).map((g) => (
              <Card key={g.aisle}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text variant="h3">{g.title}</Text>
                  <Text variant="meta">{g.note}</Text>
                </Row>
                {g.items.map((it) => (
                  <ListItem key={it.key} row={it} meId={st.me?.id} who={it.checkedBy ? byId.get(it.checkedBy) ?? null : null} />
                ))}
              </Card>
            ))}
            {groupList(rows, side).length === 0 && <Text color={colors.ink2}>{side === "pazar" ? t("liste.noPazar") : t("liste.noMarket")}</Text>}
            <View style={{ gap: 6 }}>
              <Button title={t("liste.finish")} size="lg" onPress={finish} />
              <Text variant="small" style={{ textAlign: "center" }}>
                {remainingNote(rows)}
              </Text>
            </View>
          </>
        )}
      </Screen>
      <AddItemSheet visible={adding} onClose={() => setAdding(false)} defaultSide={side} />
    </View>
  );
}

function ListItem({ row, meId, who }: { row: ListRow; meId?: string; who: { name: string; color: string; initial?: string } | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toggleCheck = useApp((s) => s.toggleCheck);
  const markHave = useApp((s) => s.markHave);
  const removeManualItem = useApp((s) => s.removeManualItem);
  const checked = !!row.checkedBy;
  const byPartner = checked && row.checkedBy !== meId;
  const fresh = byPartner && !!row.checkedAt && now().getTime() - new Date(row.checkedAt).getTime() < FRESH_MS;
  const name = row.label ?? row.name;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6, backgroundColor: fresh ? colors.oliveSoft : "transparent", borderRadius: fresh ? 12 : 0 }}>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          void toggleCheck(row);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${name}${row.quantityText ? `, ${row.quantityText}` : ""}${checked && who ? t("liste.rowGot", { name: who.name }) : ""}`}
        style={{ flex: 1, minHeight: touchTarget + 6, flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: checked ? (who?.color ?? colors.olive) : colors.line,
            backgroundColor: checked ? (who?.color ?? colors.olive) : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && (byPartner ? <Text weight="bold" color="#ffffff">{who?.initial ?? ""}</Text> : <Icon name="check" size={16} color="#ffffff" strokeWidth={2.6} />)}
        </View>
        <View style={{ flex: 1, opacity: checked && !fresh ? 0.55 : 1 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <Text weight="semibold" style={{ flexShrink: 1, textDecorationLine: checked && !fresh ? "line-through" : "none" }}>
              {name}
            </Text>
            <Text variant="meta">{row.quantityText}</Text>
          </Row>
          <Text variant="small">
            {row.forLabel || t("liste.manual")}
            {fresh && who ? ` · ${t("liste.gotJustNow", { name: who.name })}` : ""}
          </Text>
        </View>
      </Pressable>
      {row.manualItemId ? (
        <IconButton icon="close" label={t("liste.remove", { name })} onPress={() => removeManualItem(row.manualItemId!)} />
      ) : !checked ? (
        <Pressable onPress={() => markHave(row.name)} accessibilityRole="button" accessibilityLabel={t("cook.haveIt", { name })} hitSlop={6} style={{ minHeight: touchTarget, justifyContent: "center", paddingHorizontal: 4 }}>
          <Text variant="small" weight="bold" color={colors.olive}>
            {t("cook.have")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AddItemSheet({ visible, onClose, defaultSide }: { visible: boolean; onClose: () => void; defaultSide: Side }) {
  const { t } = useTranslation();
  const addManualItem = useApp((s) => s.addManualItem);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [side, setSide] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entry = catalogEntry(normalizeIngredientName(name));
  const effectiveSide = side ?? entry?.side ?? defaultSide;

  async function submit() {
    if (!name.trim()) return setError(t("errors.itemName"));
    const q = qty.trim() ? Number(qty.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q <= 0)) return setError(t("liste.qtyNumber"));
    await addManualItem({ name: normalizeIngredientName(name), quantity: q, unit: q === null ? null : unit || "adet", side: effectiveSide, aisle: entry?.side === effectiveSide ? entry.aisle : FALLBACK_AISLE[effectiveSide] });
    setName("");
    setQty("");
    setUnit("");
    setSide(null);
    setError(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t("liste.addTitle")} closeLabel={t("common.close")}>
      <Field label={t("liste.item")} placeholder={t("liste.itemPlaceholder")} value={name} onChangeText={setName} error={error} autoFocus />
      <Row style={{ flexWrap: "nowrap" }}>
        <View style={{ flex: 1 }}>
          <Field label={t("liste.qty")} placeholder={t("liste.optional")} keyboardType="decimal-pad" value={qty} onChangeText={setQty} />
        </View>
        <SelectSheet compact label={t("liste.unit")} value={unit} options={[{ value: "" as Unit | "", label: "—" }, ...UNITS.map((u) => ({ value: u as Unit | "", label: UNIT_LABEL[u] }))]} onChange={setUnit} />
      </Row>
      <Row>
        {(["pazar", "market"] as Side[]).map((s) => (
          <Button key={s} title={SIDE_LABEL[s]} size="sm" variant={effectiveSide === s ? "primary" : "secondary"} onPress={() => setSide(s)} />
        ))}
      </Row>
      <Button title={t("cook.addToList")} size="lg" onPress={submit} />
    </Sheet>
  );
}
