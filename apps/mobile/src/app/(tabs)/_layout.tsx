import { Tabs } from "expo-router";
import { fonts } from "@anv/core/design/tokens";
import type { IconName } from "@anv/core/design/icons";
import { useListBadge } from "@/hooks/useListBadge";
import { useTheme } from "@/theme";
import { Icon } from "@/ui";

/** Same five tabs and order as the web's phone nav: Bugün, Eşleş, Liste, Tarifler, Hafta. */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "bugun", title: "Bugün", icon: "home" },
  { name: "eslesme", title: "Eşleş", icon: "cards" },
  { name: "liste", title: "Liste", icon: "basket" },
  { name: "tarifler", title: "Tarifler", icon: "book" },
  { name: "hafta", title: "Hafta", icon: "calendar" },
];

export default function TabLayout() {
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
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => <Icon name={t.icon} size={22} color={color} strokeWidth={focused ? 1.9 : 1.8} />,
            ...(t.name === "liste" && badge > 0 ? { tabBarBadge: badge, tabBarAccessibilityLabel: `${t.title}, ${badge}` } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
