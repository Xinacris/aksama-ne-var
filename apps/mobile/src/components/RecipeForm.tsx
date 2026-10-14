import { useState, type ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AISLES, AISLE_LABEL, COURSES, COURSE_LABEL, SIDE_LABEL, UNITS, UNIT_LABEL, type Aisle } from "@anv/core/data/models";
import { catalogEntry, normalizeIngredientName } from "@anv/core/data/seed/ingredients";
import { cookTimeLooksLong } from "@anv/core/domain/import/timing";
import { POLICY_OPTION } from "@anv/core/domain/leftovers";
import { ingredientsFromLines, isBlankIngredient, pastedLines, stepsFromLines } from "@anv/core/services/bulkPaste";
import {
  emptyIngredient,
  genelSummary,
  initialOpen,
  parseDraft,
  prepSummary,
  sourceSummary,
  type DetailSection,
  type RecipeDraft,
} from "@anv/core/services/recipeForm";
import type { RecipeInput } from "@anv/core/store/app";
import { useTheme } from "@/theme";
import { Button, Card, Field, IconButton, Row, Screen, Text } from "@/ui";
import { ChoiceChips, Collapsible, SelectSheet } from "@/ui/more";

const OFFSETS = ["night-before", "morning", "-120min", "-90min", "-60min", "-45min", "-30min", "-15min"];

/**
 * The full recipe form on the phone: name and course, Malzemeler and
 * Hazırlanışı open; times/tags, Ön hazırlık and Kaynak/Artarsa in collapsible
 * "Ayrıntılar"; Toplu yapıştır for both lists. Same draft, validation and
 * summaries as the web (packages/core/services/recipeForm).
 */
export function RecipeForm({
  initial,
  submitLabel,
  onSubmit,
  header,
  openFilled = true,
}: {
  initial: RecipeDraft;
  submitLabel: string;
  onSubmit: (value: RecipeInput) => Promise<void>;
  header?: ReactNode;
  openFilled?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [d, setD] = useState<RecipeDraft>(initial);
  const [open, setOpen] = useState(() => initialOpen(initial, openFilled));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<null | "ing" | "step">(null);
  const [bulkText, setBulkText] = useState("");
  const [note, setNote] = useState("");
  const [offer, setOffer] = useState<null | { kind: "ing" | "step"; index: number; before: string; text: string; count: number }>(null);
  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggle = (k: DetailSection) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  async function submit() {
    const res = parseDraft(d);
    if (!res.ok) {
      setError(res.error);
      setOpen({ genel: true, prep: true, source: true });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(res.value);
    } finally {
      setBusy(false);
    }
  }

  function setIng(i: number, patch: Partial<RecipeDraft["ingredients"][number]>) {
    setD((x) => ({
      ...x,
      ingredients: x.ingredients.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        if (patch.name !== undefined) {
          const c = catalogEntry(normalizeIngredientName(patch.name));
          if (c) Object.assign(next, { side: c.side, aisle: c.aisle });
        }
        return next;
      }),
    }));
  }

  function addRows(kind: "ing" | "step", text: string, at?: { index: number; before: string }): number {
    if (kind === "ing") {
      const rows = ingredientsFromLines(text);
      if (!rows.length) return 0;
      setD((x) => {
        if (at) {
          const keep = at.before.trim() ? [{ ...x.ingredients[at.index], name: at.before }] : [];
          return { ...x, ingredients: [...x.ingredients.slice(0, at.index), ...keep, ...rows, ...x.ingredients.slice(at.index + 1)] };
        }
        return { ...x, ingredients: [...x.ingredients.filter((i) => !isBlankIngredient(i)), ...rows] };
      });
      return rows.length;
    }
    const rows = stepsFromLines(text);
    if (!rows.length) return 0;
    setD((x) => {
      if (at) {
        const keep = at.before.trim() ? [at.before.trim()] : [];
        return { ...x, steps: [...x.steps.slice(0, at.index), ...keep, ...rows, ...x.steps.slice(at.index + 1)] };
      }
      return { ...x, steps: [...x.steps.filter((s) => s.trim()), ...rows] };
    });
    return rows.length;
  }

  /** A change that brought several lines at once is a paste: offer to split it into rows. */
  function watchPaste(kind: "ing" | "step", index: number, before: string, next: string) {
    if (next.length - before.length < 2 || !next.includes("\n")) return;
    const appended = next.startsWith(before);
    const pasted = appended ? next.slice(before.length) : next;
    const count = pastedLines(pasted).length;
    if (count > 1) setOffer({ kind, index, before: appended ? before : "", text: pasted, count });
  }

  const offerRow = (kind: "ing" | "step", index: number) =>
    offer && offer.kind === kind && offer.index === index && offer.count > 1 ? (
      <View accessibilityLabel={t("form.bulk.pasted")} style={{ backgroundColor: colors.oliveSoft, borderRadius: 16, padding: 12, gap: 8 }}>
        <Text weight="semibold">{t("form.bulk.offer", { count: offer.count })}</Text>
        <Row>
          <Button
            title={t("form.bulk.yes")}
            size="sm"
            onPress={() => {
              const n = addRows(offer.kind, offer.text, { index: offer.index, before: offer.before });
              setNote(t(offer.kind === "ing" ? "form.bulk.ingSplit" : "form.bulk.stepSplit", { count: n }));
              setOffer(null);
            }}
          />
          <Button title={t("form.bulk.no")} size="sm" variant="ghost" onPress={() => setOffer(null)} />
        </Row>
      </View>
    ) : null;

  const bulkBox = (kind: "ing" | "step") =>
    bulk === kind ? (
      <View style={{ backgroundColor: colors.surface2, borderRadius: 18, padding: 14, gap: 10 }}>
        <Field
          label={t(kind === "ing" ? "form.bulk.ingLabel" : "form.bulk.stepLabel")}
          hint={t(kind === "ing" ? "form.bulk.ingHint" : "form.bulk.stepHint")}
          multiline
          value={bulkText}
          onChangeText={setBulkText}
          autoFocus
          testID={`bulk-${kind}`}
        />
        <Row>
          <Button
            title={t("form.bulk.add")}
            size="sm"
            onPress={() => {
              const n = addRows(kind, bulkText);
              if (!n) {
                setNote(t("form.bulk.none"));
                return;
              }
              setNote(t(kind === "ing" ? "form.bulk.ingAdded" : "form.bulk.stepAdded", { count: n }));
              setBulk(null);
              setBulkText("");
            }}
          />
          <Button
            title={t("form.bulk.cancel")}
            size="sm"
            variant="ghost"
            onPress={() => {
              setBulk(null);
              setBulkText("");
            }}
          />
        </Row>
      </View>
    ) : null;

  const bulkToggle = (kind: "ing" | "step") => (
    <Button
      title={t("form.bulk.toggle")}
      variant="ghost"
      size="sm"
      onPress={() => {
        setBulk(bulk === kind ? null : kind);
        setBulkText("");
        setNote("");
      }}
    />
  );

  const longCook = cookTimeLooksLong(Number(d.cookMinutes.replace(",", ".")) || 0, d.steps);
  const ingredientNames = d.ingredients.map((i) => normalizeIngredientName(i.name)).filter(Boolean);
  const unitOptions = [{ value: "", label: "—" }, ...UNITS.map((u) => ({ value: u as string, label: UNIT_LABEL[u] }))];

  return (
    <Screen>
      {header}
      <Card>
        <Text variant="h3">{t("form.general")}</Text>
        <Field label={t("form.name")} value={d.name} onChangeText={(v) => set("name", v)} testID="recipe-name" />
        <SelectSheet label={t("form.course")} value={d.course} options={COURSES.map((c) => ({ value: c as string, label: COURSE_LABEL[c] }))} onChange={(v) => set("course", v)} />
      </Card>

      <Card>
        <Text variant="h3">{t("form.ingredients")}</Text>
        {d.ingredients.map((ing, i) => (
          <View key={i} accessibilityLabel={t("form.ingN", { n: i + 1 })} style={{ gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Row style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t("form.ingredient")}
                  value={ing.name}
                  onChangeText={(v) => {
                    watchPaste("ing", i, ing.name, v);
                    setIng(i, { name: v });
                  }}
                  testID={`ing-name-${i}`}
                />
              </View>
              <IconButton icon="trash" label={t("form.removeIng", { n: i + 1 })} onPress={() => set("ingredients", d.ingredients.filter((_, idx) => idx !== i))} />
            </Row>
            <Row style={{ flexWrap: "nowrap" }}>
              <View style={{ flex: 1 }}>
                <Field label={t("form.qty")} keyboardType="decimal-pad" value={ing.quantity} onChangeText={(v) => setIng(i, { quantity: v })} />
              </View>
              <SelectSheet compact label={t("form.unit")} value={ing.unit} options={unitOptions} onChange={(v) => setIng(i, { unit: v })} />
            </Row>
            <Row style={{ flexWrap: "nowrap" }}>
              <SelectSheet compact label={t("form.side")} value={ing.side} options={(["pazar", "market"] as const).map((v) => ({ value: v, label: SIDE_LABEL[v] }))} onChange={(v) => setIng(i, { side: v })} />
              <SelectSheet compact label={t("form.aisle")} value={ing.aisle} options={AISLES.map((a) => ({ value: a as string, label: AISLE_LABEL[a as Aisle] }))} onChange={(v) => setIng(i, { aisle: v })} />
            </Row>
            {offerRow("ing", i)}
          </View>
        ))}
        {bulkBox("ing")}
        <Row>
          <Button title={t("form.addIng")} icon="plus" variant="soft" size="sm" onPress={() => set("ingredients", [...d.ingredients, emptyIngredient()])} />
          {bulkToggle("ing")}
        </Row>
      </Card>

      <Card>
        <Text variant="h3">{t("form.steps")}</Text>
        {d.steps.map((step, i) => (
          <View key={i} style={{ gap: 8 }}>
            <Row style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t("form.stepN", { n: i + 1 })}
                  multiline
                  value={step}
                  onChangeText={(v) => {
                    watchPaste("step", i, step, v);
                    set(
                      "steps",
                      d.steps.map((x, idx) => (idx === i ? v : x)),
                    );
                  }}
                  testID={`step-${i}`}
                />
              </View>
              <IconButton icon="trash" label={t("form.removeStep", { n: i + 1 })} onPress={() => set("steps", d.steps.filter((_, idx) => idx !== i))} />
            </Row>
            {offerRow("step", i)}
          </View>
        ))}
        {bulkBox("step")}
        <Row>
          <Button title={t("form.addStep")} icon="plus" variant="soft" size="sm" onPress={() => set("steps", [...d.steps, ""])} />
          {bulkToggle("step")}
        </Row>
      </Card>

      <View style={{ gap: 10 }}>
        <Text variant="h3">{t("form.details")}</Text>
        <Text variant="small">{t("form.detailsNote")}</Text>
        <Collapsible title={t("form.sec.genel")} summary={genelSummary(d)} open={open.genel} onToggle={() => toggle("genel")}>
          <Row style={{ flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Field label={t("form.prepMin")} keyboardType="number-pad" value={d.prepMinutes} onChangeText={(v) => set("prepMinutes", v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("form.cookMin")} keyboardType="number-pad" value={d.cookMinutes} onChangeText={(v) => set("cookMinutes", v)} hint={longCook ? t("form.longCook") : undefined} />
            </View>
          </Row>
          <Row style={{ flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Field label={t("form.waitMin")} keyboardType="number-pad" placeholder="0" value={d.waitMinutes} onChangeText={(v) => set("waitMinutes", v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("form.servings")} keyboardType="number-pad" value={d.servings} onChangeText={(v) => set("servings", v)} />
            </View>
          </Row>
          <Text variant="small">{t("form.cookNote")}</Text>
          <Field label={t("form.tags")} hint={t("form.tagsHint")} value={d.tags} onChangeText={(v) => set("tags", v)} />
        </Collapsible>

        <Collapsible title={t("form.sec.prep")} summary={prepSummary(d)} open={open.prep} onToggle={() => toggle("prep")}>
          {d.prepItems.map((p, i) => (
            <View key={i} style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Row style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("form.prepWhat")}
                    placeholder={t("form.prepPlaceholder")}
                    value={p.label}
                    onChangeText={(v) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, label: v } : x)))}
                  />
                </View>
                <IconButton icon="trash" label={t("form.removePrep", { n: i + 1 })} onPress={() => set("prepItems", d.prepItems.filter((_, idx) => idx !== i))} />
              </Row>
              <SelectSheet
                label={t("form.prepWhen")}
                value={p.offset}
                options={OFFSETS.map((v) => ({ value: v, label: t(`form.offset.${v}`) }))}
                onChange={(v) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, offset: v } : x)))}
              />
              <Pressable
                onPress={() => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, freezer: !x.freezer } : x)))}
                accessibilityRole="switch"
                accessibilityState={{ checked: p.freezer }}
                style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text weight="semibold">{t("form.freezerRelated")}</Text>
                <Switch value={p.freezer} onValueChange={(v) => set("prepItems", d.prepItems.map((x, idx) => (idx === i ? { ...x, freezer: v } : x)))} trackColor={{ true: colors.olive }} />
              </Pressable>
            </View>
          ))}
          <Button title={t("form.addPrep")} icon="plus" variant="soft" size="sm" onPress={() => set("prepItems", [...d.prepItems, { label: "", offset: "morning", freezer: false }])} />
          <SelectSheet
            label={t("form.freezerItem")}
            value={d.freezerItem}
            options={[{ value: "", label: t("form.none") }, ...ingredientNames.map((n) => ({ value: n, label: n }))]}
            onChange={(v) => set("freezerItem", v)}
          />
        </Collapsible>

        <Collapsible title={t("form.sec.source")} summary={sourceSummary(d)} open={open.source} onToggle={() => toggle("source")}>
          <Field label={t("form.source")} hint={t("form.sourceHint")} value={d.source} onChangeText={(v) => set("source", v)} />
          <ChoiceChips
            label={t("form.leftoverQ")}
            options={(["none", "lunch", "store"] as const).map((value) => ({ value, label: POLICY_OPTION[value] }))}
            value={d.leftoverPolicy}
            onChange={(v) => set("leftoverPolicy", v)}
          />
          {d.leftoverPolicy === "store" && (
            <SelectSheet
              label={t("form.keepDays")}
              value={d.leftoverDays}
              options={["1", "2", "3", "4"].map((n) => ({ value: n, label: t("form.days", { count: Number(n) }) }))}
              onChange={(v) => set("leftoverDays", v)}
            />
          )}
          <Text variant="small">{t("form.lunchNote")}</Text>
        </Collapsible>
      </View>

      {note ? (
        <Text variant="meta" accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
      {error && (
        <View accessibilityLiveRegion="assertive" style={{ backgroundColor: colors.tomatoSoft, borderRadius: 14, padding: 12 }}>
          <Text weight="semibold">{error}</Text>
        </View>
      )}
      <Button title={busy ? t("form.saving") : submitLabel} size="lg" busy={busy} onPress={submit} testID="save-recipe" />
    </Screen>
  );
}
