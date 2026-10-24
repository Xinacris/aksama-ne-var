import { AccessibilityInfo, LayoutAnimation } from "react-native";

/** The system's "Reduce motion", kept current (read once at start, then on every change). */
let reduce = false;
void AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reduce = v;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
  reduce = v;
});

/**
 * A dish snapping into its slot (or leaving it): the next layout change animates briefly. Call it
 * right before the store change. Nothing moves when the phone asks for reduced motion.
 */
export function snapNextLayout(): void {
  if (reduce) return;
  LayoutAnimation.configureNext({ duration: 220, create: { type: "easeInEaseOut", property: "opacity" }, update: { type: "spring", springDamping: 0.8 }, delete: { type: "easeInEaseOut", property: "opacity" } });
}
