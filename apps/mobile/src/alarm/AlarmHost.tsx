import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { dismissDue, finishKey, initialAlarm, nextHandoffs, silenceAlarm, stepAlarm, type AlarmState } from "@anv/core/domain/timerAlarm";
import { listJoin } from "@anv/core/i18n";
import { now } from "@anv/core/lib/clock";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Icon, Text } from "@/ui";
import { syncAlarmKit } from "./alarmKit";
import { clearPresentedTimerNotifications, inAlarmQueue, setForegroundHandler, syncTimerNotifications } from "./notifications";
import { useHandoffs, useTimerKind, useTimerSound } from "./prefs";
import { startRinging, stopRinging } from "./sound";

/** Re-render every second while a timer counts down or rings, and on return to the foreground. */
function useAlarmClock(active: boolean): Date {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && setT(now()));
    if (!active) return () => sub.remove();
    const id = setInterval(() => setT(now()), 1000);
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [active]);
  return active ? t : now();
}

/**
 * The phone's timer alarm, mounted once above every screen: whatever screen is open, a timer that
 * reaches zero (or reached it while the app was in the background, up to 10 minutes ago) loops the
 * tone with vibration and shows "Süre doldu: …" with a big Durdur. Stop dismisses the finished
 * timers in the session, so every device sync reaches stops too. Also keeps the background
 * notifications in line with the timers and opens the session when one is tapped.
 */
export function AlarmHost() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sessions = useApp((x) => x.cookingSessions);
  const updateCooking = useApp((x) => x.updateCooking);
  const [sound] = useTimerSound();
  const [kind] = useTimerKind();
  const [handoffs, setHandoffs] = useHandoffs();
  const open = useMemo(() => sessions.filter((s) => s.phase !== "done"), [sessions]);
  const timers = useMemo(() => open.flatMap((s) => s.timers), [open]);
  const clock = useAlarmClock(timers.some((x) => !x.dismissed));
  // Finishes the phone's own alarm rings for (Clock app, AlarmKit) don't ring in the app too.
  const handedOff = useMemo(() => new Set(handoffs), [handoffs]);
  const ours = useMemo(() => timers.filter((x) => !handedOff.has(finishKey(x))), [timers, handedOff]);

  // Derived state adjusted during render (stepAlarm returns the same object when nothing changed).
  const [alarm, setAlarm] = useState<AlarmState>(initialAlarm);
  const next = stepAlarm(alarm, ours, clock);
  if (next !== alarm) setAlarm(next);
  const ringingKeys = new Set(next.ringing);
  const ringing = timers.filter((x) => ringingKeys.has(finishKey(x)));
  const isRinging = ringing.length > 0;

  useEffect(() => {
    if (!isRinging) return;
    startRinging(sound);
    void clearPresentedTimerNotifications();
    return stopRinging;
  }, [isRinging, next.since, sound]);

  // Every change to the timers (and the sound / type choice): first the phone's own alarm
  // (AlarmKit on iOS; on Android the Clock app keeps what it was handed), then the app's
  // notifications for the rest.
  useEffect(() => {
    const at = now();
    void inAlarmQueue(async () => {
      const native = Platform.OS === "ios" ? await syncAlarmKit(open, at, { enabled: kind === "phoneClock", sound }) : handedOff;
      const nextKeys = nextHandoffs(handedOff, open, at, native);
      setHandoffs(nextKeys);
      return new Set(nextKeys);
    }).then((covered) => syncTimerNotifications(open, at, sound, covered));
    // `handedOff` changes when a timer is handed to the Clock app; setHandoffs ignores no-op writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sound, kind, handoffs.join()]);

  useEffect(() => {
    setForegroundHandler();
    const openFrom = (r: Notifications.NotificationResponse | null) => {
      const data = r?.notification.request.content.data as { url?: string; sessionKey?: string } | undefined;
      if (!data?.url || !data.sessionKey) return;
      // Tapping the notification is the answer to it: the session opens without ringing again.
      const st = useApp.getState();
      const s = st.cookingSessions.find((c) => c.key === data.sessionKey && c.phase !== "done");
      if (s) void st.updateCooking(s.id, { timers: dismissDue(s.timers, now()) });
      router.push(data.url as never);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    void Notifications.getLastNotificationResponseAsync().then(openFrom).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(openFrom);
    return () => sub.remove();
  }, []);

  const stop = () => {
    setAlarm((a) => silenceAlarm(a));
    const at = now();
    for (const s of open) if (s.timers.some((x) => ringingKeys.has(finishKey(x)))) void updateCooking(s.id, { timers: dismissDue(s.timers, at) });
    void clearPresentedTimerNotifications();
  };

  if (!isRinging) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 16,
          gap: 12,
          backgroundColor: colors.tomatoSoft,
          borderBottomWidth: 2,
          borderBottomColor: colors.tomato,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="clock" size={28} color={colors.tomato} />
          <Text weight="bold" style={{ flex: 1, fontSize: 20, lineHeight: 26 }} color={colors.ink}>
            {t("alarm.timeUp", { names: listJoin(ringing.map((x) => x.label)) })}
          </Text>
        </View>
        <Button title={t("alarm.stop")} size="lg" accessibilityLabel={t("alarm.stopLabel")} onPress={stop} />
      </View>
    </View>
  );
}

