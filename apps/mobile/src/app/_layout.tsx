import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { YoungSerif_400Regular } from "@expo-google-fonts/young-serif";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { fonts } from "@anv/core/design/tokens";
import { bootMobile, type MobileData } from "@/boot";
import { useApp } from "@/store";
import { LocaleProvider } from "@/i18n";
import { ThemeProvider, useTheme } from "@/theme";
import { NoticeHost } from "@/ui/more";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    YoungSerif_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const [data, setData] = useState<MobileData | null>(null);
  useEffect(() => {
    void bootMobile().then(setData);
  }, []);
  const ready = (fontsLoaded || !!fontError) && !!data;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider store={data.store}>
          <LocaleProvider store={data.store}>
            <Navigation />
          </LocaleProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const status = useApp((s) => s.status);
  const onboarded = useApp((s) => !!s.me?.onboarded);
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.ink, border: colors.line, primary: colors.tomato, notification: colors.tomato },
  };
  const signedIn = status === "ready" || status === "no-household";
  const inApp = status === "ready" && onboarded;
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.serif, color: colors.ink },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !inApp}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t("nav.bugun") }} />
          <Stack.Screen name="tarif/[id]" options={{ title: "" }} />
          <Stack.Screen name="tarifler/yeni" />
          <Stack.Screen name="tarifler/[id]/duzenle" />
          <Stack.Screen name="tarifler/ice-aktar" />
          <Stack.Screen name="ayarlar" />
        </Stack.Protected>
      </Stack>
      <NoticeHost />
    </NavThemeProvider>
  );
}
