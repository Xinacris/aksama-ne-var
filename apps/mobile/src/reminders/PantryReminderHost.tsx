import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { useApp } from "@/store";
import { syncPantryNotifications } from "./notifications";
import { usePantryReminders } from "./usePantryReminders";

/**
 * Keeps the phone's scheduled pantry notifications in line with the plan, the pantry and the
 * answers, and opens the quick check when one is tapped. Renders nothing: due reminders show as
 * the in-app banner (`PantryBanner`), which is also the fallback when notifications are off.
 */
export function PantryReminderHost() {
  const plan = usePantryReminders();
  const recipes = useApp((x) => x.recipes);
  const names = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const key = plan.scheduled.map((r) => `${r.id}@${r.fireAt.getTime()}`).join("|");

  useEffect(() => {
    void syncPantryNotifications(plan.scheduled, names);
    // `key` captures what matters in the schedule; names only change the copy of new ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const data = r?.notification.request.content.data as { kind?: string; url?: string } | undefined;
      if (data?.kind !== "pantry" || !data.url) return;
      router.push(data.url as never);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return null;
}
