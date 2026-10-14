import { useEffect } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTranslation } from "react-i18next";
import type { Recipe } from "@anv/core/data/models";
import { radius } from "@anv/core/design/tokens";
import { useTheme } from "@/theme";
import { Icon, Row, Text } from "@/ui";

const THRESHOLD = 110;

export interface DeckCardView {
  recipe: Recipe;
  time: string;
  last: string;
  tags: string[];
}

/**
 * The swipe card (Eslesme.dc.html) on the phone: drag right for "Olur", left
 * for "Bu sefer değil"; the two buttons below do the same (and are what
 * VoiceOver/TalkBack users get). Render with `key={recipe.id}`.
 */
export function SwipeCard({ card, onDecide, disabled }: { card: DeckCardView; onDecide: (d: "like" | "pass") => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const reduceMotion = useSharedValue(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.value = v;
    });
  }, [reduceMotion]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const fling = Math.abs(e.velocityX) > 800 && Math.abs(e.translationX) > 30;
      if (Math.abs(e.translationX) > THRESHOLD || fling) {
        const d = e.translationX > 0 ? "like" : "pass";
        x.value = reduceMotion.value ? 0 : withTiming(d === "like" ? 600 : -600, { duration: 220 });
        scheduleOnRN(onDecide, d);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value * 0.15 }, { rotate: `${x.value / 18}deg` }],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, THRESHOLD], [0, 1], "clamp") }));
  const passStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-THRESHOLD, -20], [1, 0], "clamp") }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${card.recipe.name}. ${card.time}. ${card.last}`}
        accessibilityHint={t("swipe.hint")}
        style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }, cardStyle]}
      >
        <View style={{ height: 240, backgroundColor: colors.sandSoft }} />
        <View style={{ padding: 18, gap: 8 }}>
          <Text variant="h2">{card.recipe.name}</Text>
          <Row>
            <Icon name="clock" size={16} color={colors.ink2} />
            <Text variant="meta">{card.time}</Text>
          </Row>
          <Row>
            <Icon name="history" size={16} color={colors.ink2} />
            <Text variant="meta">{card.last}</Text>
          </Row>
          {card.tags.length > 0 && (
            <Row>
              {card.tags.map((tg) => (
                <View key={tg} style={{ backgroundColor: colors.sandSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text variant="small" weight="bold" color={colors.sandText}>
                    {tg}
                  </Text>
                </View>
              ))}
            </Row>
          )}
        </View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 18, left: 18, backgroundColor: colors.olive, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }, likeStyle]}>
          <Text weight="bold" color={colors.surface}>
            {t("swipe.like")}
          </Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 18, right: 18, backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }, passStyle]}>
          <Text weight="bold" color={colors.bg}>
            {t("swipe.pass")}
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
