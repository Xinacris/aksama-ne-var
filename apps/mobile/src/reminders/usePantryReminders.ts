import { useEffect, useMemo, useState } from "react";
import { planPantryReminders, type ReminderPlan } from "@anv/core/domain/pantryReminders";
import { now } from "@anv/core/lib/clock";
import { recipesMap, useApp } from "@/store";
import { useReminderSettings } from "./prefs";

/** The household's pantry reminders now (shared core scheduler), re-evaluated every minute. */
export function usePantryReminders(): ReminderPlan {
  const [settings] = useReminderSettings();
  const status = useApp((x) => x.status);
  const planItems = useApp((x) => x.planItems);
  const planDays = useApp((x) => x.planDays);
  const recipes = useApp((x) => x.recipes);
  const pantry = useApp((x) => x.pantry);
  const answers = useApp((x) => x.pantryAnswers);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    void tick;
    if (status !== "ready") return { scheduled: [], due: [] };
    return planPantryReminders({ now: now(), planItems, planDays, recipesById: recipesMap(recipes), pantry, answers, settings });
  }, [status, planItems, planDays, recipes, pantry, answers, settings, tick]);
}
