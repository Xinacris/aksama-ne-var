import { useState } from "react";
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { space } from "@anv/core/design/tokens";
import { useTheme } from "@/theme";
import { Chip } from "./index";

export interface PillOption {
  key: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

const FADE = 28;
const STEPS = 7;

/**
 * A row of toggle pills (filters), the phone's counterpart of the web's PillRow: full-bleed inside
 * the screen's padding, padded with the same gutter so the first pill lines up with the header,
 * one line that scrolls sideways. A soft fade shows on a side only while pills are hidden past it.
 */
export function PillRow({ label, options, testID }: { label: string; options: PillOption[]; testID?: string }) {
  const { colors } = useTheme();
  const [box, setBox] = useState({ width: 0, content: 0, x: 0 });
  const max = Math.max(0, box.content - box.width);
  const fadeStart = max > 1 && box.x > 1;
  const fadeEnd = max > 1 && box.x < max - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setBox((b) => (b.x === x ? b : { ...b, x }));
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setBox((b) => (b.width === width ? b : { ...b, width }));
  };
  const onContentSizeChange = (content: number) => setBox((b) => (b.content === content ? b : { ...b, content }));

  // A gradient made of a few bands of the background colour (no gradient dependency).
  const fade = (side: "left" | "right") => (
    <View testID={`pill-fade-${side}`} pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, [side]: 0, width: FADE, flexDirection: side === "left" ? "row" : "row-reverse" }}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: colors.bg, opacity: 1 - i / STEPS }} />
      ))}
    </View>
  );

  return (
    <View style={{ marginHorizontal: -space.lg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
        accessibilityLabel={label}
        testID={testID}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
      >
        {options.map((o) => (
          <Chip key={o.key} label={o.label} selected={o.selected} onPress={o.onToggle} />
        ))}
      </ScrollView>
      {fadeStart && fade("left")}
      {fadeEnd && fade("right")}
    </View>
  );
}
