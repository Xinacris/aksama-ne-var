import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, space, touchTarget, type as typeScale } from "@anv/core/design/tokens";
import type { IconName } from "@anv/core/design/icons";
import { useTheme } from "../theme";
import { Icon } from "./Icon";

export { Icon };

type Variant = "body" | "bodySmall" | "meta" | "small" | "eyebrow" | "title" | "display" | "h2" | "h3" | "label";

/** Text in the app's type scale: Young Serif for titles, Figtree for the rest. */
export function Text({
  variant = "body",
  color,
  weight,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; weight?: "regular" | "medium" | "semibold" | "bold" }) {
  const { colors } = useTheme();
  const serif = variant === "title" || variant === "display" || variant === "h2" || variant === "h3";
  const scale =
    variant === "label" ? { size: 14, line: 19 } : (typeScale as Record<string, { size: number; line: number; letterSpacing?: number }>)[variant];
  const family = serif
    ? fonts.serif
    : weight === "bold" || variant === "eyebrow" || variant === "label"
      ? fonts.sansBold
      : weight === "semibold"
        ? fonts.sansSemibold
        : weight === "medium"
          ? fonts.sansMedium
          : fonts.sans;
  const base: TextStyle = {
    fontFamily: family,
    fontSize: scale.size,
    lineHeight: scale.line,
    color: color ?? (variant === "meta" || variant === "small" ? colors.ink2 : variant === "eyebrow" ? colors.tomato : colors.ink),
    ...(variant === "eyebrow" ? { letterSpacing: scale.letterSpacing, textTransform: "uppercase" } : {}),
  };
  return <RNText accessibilityRole={serif ? "header" : undefined} style={[base, style]} maxFontSizeMultiplier={1.6} {...rest} />;
}

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost";

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled,
  busy,
  style,
  accessibilityLabel,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.tomato, secondary: colors.surface, soft: colors.surface2, ghost: "transparent" }[variant];
  const fg = variant === "primary" ? colors.onTomato : colors.ink;
  const height = size === "lg" ? 54 : size === "sm" ? touchTarget : 48;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      testID={testID}
      hitSlop={size === "sm" ? 4 : 0}
      style={({ pressed }) => [
        {
          minHeight: height,
          paddingHorizontal: size === "sm" ? space.lg : space.xl,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1.5 : 0,
          borderColor: colors.line,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text variant={size === "sm" ? "bodySmall" : "body"} weight="bold" color={fg}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Round icon-only button with a 44 pt target and a spoken label. */
export function IconButton({ icon, label, onPress, color, filled }: { icon: IconName; label: string; onPress?: () => void; color?: string; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: touchTarget / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? colors.surface2 : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={color ?? colors.ink} />
    </Pressable>
  );
}

export function Card({ children, style, tone = "surface" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "surface" | "soft" | "olive" | "tomato" | "sand" }) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, soft: colors.surface2, olive: colors.oliveSoft, tomato: colors.tomatoSoft, sand: colors.sandSoft }[tone];
  return (
    <View style={[{ backgroundColor: bg, borderRadius: radius.card, borderWidth: tone === "surface" ? 1 : 0, borderColor: colors.line, padding: 18, gap: space.md }, style]}>
      {children}
    </View>
  );
}

/** Scrolling screen body on the app background, with the bottom safe area. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  header,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Top safe area for screens without a native header (tabs). */
  header?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const content: ViewStyle = { padding: padded ? space.lg : 0, paddingTop: (header ? insets.top : 0) + (padded ? space.lg : 0), gap: space.lg, paddingBottom: space.xxxl };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.bg }, content, style]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[content, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone = "tomato",
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: "tomato" | "olive" | "sand";
}) {
  const { colors } = useTheme();
  const on = tone === "olive" ? colors.olive : tone === "sand" ? colors.sand : colors.tomato;
  const bg = selected ? on : tone === "sand" ? colors.sandSoft : colors.surface;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={({ pressed }) => ({
        minHeight: touchTarget,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        backgroundColor: bg,
        borderWidth: selected || tone === "sand" ? 0 : 1.5,
        borderColor: colors.line,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {selected && <Icon name="check" size={16} color={colors.onTomato} />}
      <Text variant="bodySmall" weight="semibold" color={selected ? colors.onTomato : tone === "sand" ? colors.sandText : colors.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string; hint?: string; error?: string | null; hideLabel?: boolean; icon?: IconName }>(
  function Field({ label, hint, error, hideLabel, icon, style, multiline, ...input }, ref) {
    const { colors, scheme } = useTheme();
    return (
      <View style={{ gap: 6 }}>
        {!hideLabel && (
          <Text variant="label" nativeID={`${label}-label`}>
            {label}
          </Text>
        )}
        <View
          style={{
            minHeight: multiline ? 96 : 54,
            borderRadius: radius.field,
            borderWidth: 1.5,
            borderColor: error ? colors.tomato : colors.line,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: multiline ? "flex-start" : "center",
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          {icon && <Icon name={icon} size={20} color={colors.ink2} />}
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            accessibilityHint={hint}
            placeholderTextColor={colors.ink2}
            keyboardAppearance={scheme}
            multiline={multiline}
            style={[
              { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 16, paddingVertical: multiline ? 14 : 0, minHeight: multiline ? 96 : 50, textAlignVertical: multiline ? "top" : "center" },
              style,
            ]}
            {...input}
          />
        </View>
        {hint && !error && <Text variant="small">{hint}</Text>}
        {error && (
          <Text variant="small" color={colors.tomato} accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        )}
      </View>
    );
  },
);

export function EmptyState({ title, text, children, icon = "emptyPlate" }: { title: string; text?: string; children?: ReactNode; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line, padding: space.xxl, alignItems: "center", gap: space.md }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={26} color={colors.ink2} />
      </View>
      <Text variant="h3" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {text && (
        <Text variant="bodySmall" color={colors.ink2} style={{ textAlign: "center" }}>
          {text}
        </Text>
      )}
      {children}
    </View>
  );
}

/** Bottom sheet: a modal sliding up from the bottom, keyboard-aware, with a close button. */
export function Sheet({ visible, onClose, title, children, closeLabel }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; closeLabel: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(27,22,18,0.45)" }]} onPress={onClose} accessibilityLabel={closeLabel} accessibilityRole="button" />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, paddingBottom: space.xl + insets.bottom, gap: space.lg, maxHeight: "88%" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="h2">{title}</Text>
            <IconButton icon="close" label={closeLabel} onPress={onClose} filled />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap }, style]}>{children}</View>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}

export function PressableRow({ children, style, ...rest }: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [{ minHeight: touchTarget, opacity: pressed ? 0.8 : 1 }, style]}>
      {children}
    </Pressable>
  );
}
