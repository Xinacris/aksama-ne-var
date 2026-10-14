import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { fonts } from "@anv/core/design/tokens";
import type { IconName } from "@anv/core/design/icons";
import { useListBadge } from "@/hooks/useListBadge";
import { useTheme } from "@/theme";
import { Icon } from "@/ui";

/** Same five tabs and order as the web's phone nav: Bugün, Eşleş, Liste, Tarifler, Hafta. */
const TABS: { name: "bugun" | "eslesme" | "liste" | "tarifler" | "hafta"; icon: IconName }[] = [
  { name: "bugun", icon: "home" },
  { name: "eslesme", icon: "cards" },
  { name: "liste", icon: "basket" },
  { name: "tarifler", icon: "book" },
  { name: "hafta", icon: "calendar" },
];

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const badge = useListBadge();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tomato,
        tabBarInactiveTintColor: colors.ink2,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.sansSemibold, fontSize: 12 },
        tabBarBadgeStyle: { backgroundColor: colors.tomato, color: colors.onTomato, fontFamily: fonts.sansBold, fontSize: 11 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`nav.${tab.name}`),
            tabBarIcon: ({ color, focused }) => <Icon name={tab.icon} size={22} color={color} strokeWidth={focused ? 1.9 : 1.8} />,
            ...(tab.name === "liste" && badge > 0 ? { tabBarBadge: badge, tabBarAccessibilityLabel: `${t("nav.liste")}, ${t("nav.itemsLeft", { count: badge })}` } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
