import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ICONS, type IconName } from "@anv/core/design/icons";

/** The web's stroke icons (shared geometry in core), drawn with react-native-svg. Decorative: hidden from screen readers. */
export function Icon({ name, size = 22, color, strokeWidth }: { name: IconName; size?: number; color: ColorValue; strokeWidth?: number }) {
  const def = ICONS[name] as { strokeWidth?: number; fill?: boolean; shapes: (typeof ICONS)[IconName]["shapes"] };
  const sw = strokeWidth ?? def.strokeWidth ?? 1.8;
  const paint = def.fill
    ? { fill: color, stroke: "none" }
    : { fill: "none", stroke: color, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {def.shapes.map((s, i) =>
        s.kind === "path" ? (
          <Path key={i} d={s.d} {...paint} />
        ) : s.kind === "circle" ? (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...paint} />
        ) : (
          <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} {...paint} />
        ),
      )}
    </Svg>
  );
}
