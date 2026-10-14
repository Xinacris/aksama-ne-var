import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { radius, space, touchTarget } from "@anv/core/design/tokens";
import type { IconName } from "@anv/core/design/icons";
import { usePeople } from "../hooks/usePeople";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { Icon } from "./Icon";
import { IconButton, Sheet, Text } from "./index";

export interface Person {
  id?: string;
  name: string;
  initial?: string;
  avatarInitial?: string;
  color: string;
}

/** Member circle with the initial in the member's colour (same as the web avatar). */
export function Avatar({ person, size = 32 }: { person: Person; size?: number }) {
  const { colors } = useTheme();
  const initial = person.initial ?? person.avatarInitial ?? person.name.charAt(0);
  return (
    <View
      accessibilityLabel={person.name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: person.color, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg }}
    >
      <Text weight="bold" color="#ffffff" style={{ fontSize: size * 0.42, lineHeight: size * 0.6 }}>
        {initial}
      </Text>
    </View>
  );
}

export function AvatarStack({ people, size = 30 }: { people: Person[]; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }} accessible accessibilityLabel={people.map((p) => p.name).join(", ")}>
      {people.map((p, i) => (
        <View key={p.id ?? p.name} style={{ marginLeft: i ? -size * 0.28 : 0 }}>
          <Avatar person={p} size={size} />
        </View>
      ))}
    </View>
  );
}

/** Small status pill: olive (ok / evde var), sand (listede / waiting), tomato (eksik). */
export function Pill({ tone, label, onPress, accessibilityLabel, icon }: { tone: "olive" | "sand" | "tomato"; label: string; onPress?: () => void; accessibilityLabel?: string; icon?: IconName }) {
  const { colors } = useTheme();
  const bg = tone === "olive" ? colors.oliveSoft : tone === "sand" ? colors.sandSoft : colors.tomatoSoft;
  const fg = tone === "olive" ? colors.olive : tone === "sand" ? colors.sandText : colors.tomato;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      {icon && <Icon name={icon} size={13} color={fg} strokeWidth={2.4} />}
      <Text variant="small" weight="bold" color={fg}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} hitSlop={10} style={{ minHeight: touchTarget, justifyContent: "center" }}>
      {body}
    </Pressable>
  );
}

/** A collapsible card ("Ayrıntılar" sections): title + one-line summary, chevron, content when open. */
export function Collapsible({ title, summary, open, onToggle, children }: { title: string; summary?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        style={{ minHeight: 60, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="bold">{title}</Text>
          {summary ? <Text variant="meta">{summary}</Text> : null}
        </View>
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}>
          <Icon name="chevronRight" size={18} color={colors.ink2} />
        </View>
      </Pressable>
      {open && <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: space.md }}>{children}</View>}
    </View>
  );
}

/** Select replacement: a field that opens a bottom sheet of options. */
export function SelectSheet<V extends string>({
  label,
  value,
  options,
  onChange,
  compact,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "—";
  return (
    <View style={{ gap: 6, flex: compact ? 1 : undefined }}>
      <Text variant="label">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        style={{ minHeight: 54, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <Text numberOfLines={1} style={{ flexShrink: 1 }}>
          {current}
        </Text>
        <View style={{ transform: [{ rotate: "90deg" }] }}>
          <Icon name="chevronRight" size={16} color={colors.ink2} />
        </View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} closeLabel={t("common.close")}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.value === value }}
            style={({ pressed }) => ({
              minHeight: 52,
              borderRadius: 16,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: o.value === value ? colors.oliveSoft : pressed ? colors.surface2 : colors.surface,
            })}
          >
            <Text weight={o.value === value ? "bold" : "regular"}>{o.label}</Text>
            {o.value === value && <Icon name="check" size={18} color={colors.olive} />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

/** The store's calm notices as a toast above the tab bar; errors stay longer. */
export function NoticeHost() {
  const notice = useApp((s) => s.notice);
  const dismiss = useApp((s) => s.dismissNotice);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(dismiss, notice.kind === "error" ? 9000 : 4500);
    return () => clearTimeout(id);
  }, [notice, dismiss]);
  if (!notice) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 70, alignItems: "center", paddingHorizontal: space.lg }}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole={notice.kind === "error" ? "alert" : "text"}
        style={{
          maxWidth: 520,
          width: "100%",
          backgroundColor: notice.kind === "error" ? colors.tomatoSoft : colors.ink,
          borderRadius: 18,
          paddingLeft: 16,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={{ flex: 1, paddingVertical: 6 }} color={notice.kind === "error" ? colors.ink : colors.bg}>
          {notice.text}
        </Text>
        <IconButton icon="close" label={t("common.close")} onPress={dismiss} color={notice.kind === "error" ? colors.ink : colors.bg} />
      </View>
    </View>
  );
}

/** Tab screen title row: eyebrow + serif title, with the household avatars → Ayarlar on the right. */
export function TabHeader({ eyebrow, title, right, style }: { eyebrow?: string; title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { people } = usePeople();
  const { t } = useTranslation();
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md }, style]}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text variant="meta" weight="semibold">{eyebrow}</Text> : null}
        <Text variant="title">{title}</Text>
      </View>
      {right ?? (
        <Pressable
          onPress={() => router.push("/ayarlar")}
          accessibilityRole="button"
          accessibilityLabel={t("nav.household", { names: people.map((p) => p.name).join(", ") })}
          style={{ minHeight: touchTarget, minWidth: touchTarget, justifyContent: "center", alignItems: "flex-end" }}
        >
          <AvatarStack people={people} size={32} />
        </Pressable>
      )}
    </View>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Text variant="eyebrow" color={color}>
      {children}
    </Text>
  );
}

/** Choice chips that act as a radio group (one tab stop in spirit; each chip announces selected). */
export function ChoiceChips<V extends string>({ label, options, value, onChange }: { label: string; options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={{ minHeight: touchTarget, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: "center", backgroundColor: on ? colors.olive : colors.surface, borderWidth: on ? 0 : 1.5, borderColor: colors.line }}
            >
              <Text variant="bodySmall" weight="semibold" color={on ? colors.surface : colors.ink}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
