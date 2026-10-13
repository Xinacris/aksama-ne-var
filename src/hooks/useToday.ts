"use client";

import { useMemo } from "react";
import type { Activity, PrepTask, Recipe, Slot } from "@/data/models";
import { SLOTS } from "@/data/models";
import { approvalLabel, approvalState, viewActivity, type ApprovalState } from "@/domain/activity";
import { addDays, clockTime, formatDuration, longDate } from "@/domain/dates";
import { dayFor, menuFor, menuItems, menuLine, menuTitle } from "@/domain/plan";
import { eveningLeftover, fridgeItems, type EveningLeftover } from "@/domain/leftovers";
import { offsetLabel, reminderMeta, reminderSentence, topReminder } from "@/domain/prep";
import { recipeLabel } from "@/domain/shopping";
import { lowerFirstTr } from "@/lib/text";
import { now } from "@/lib/clock";
import { recipesMap, selectList, useApp, usersMap } from "@/store/app";
import type { Approval, MenuRow } from "@/components/MenuCard";

/** Activity types worth surfacing as "what my partner did" on Bugün. */
const PARTNER_TYPES = new Set<Activity["type"]>([
  "plan.added",
  "plan.approved",
  "plan.moved",
  "plan.ateOut",
  "plan.changed",
  "match.made",
  "prep.done",
  "shopping.finished",
  "household.joined",
  "recipe.created",
  "recipe.imported",
  "cooking.started",
  "cooking.finished",
  "leftover.set",
]);

export function recipeTime(r: Recipe): string {
  return formatDuration(r.prepMinutes + r.cookMinutes);
}

export function approvalPill(state: ApprovalState): Approval {
  if (state.kind === "both" || (state.kind === "solo" && state.approved)) return { tone: "ok", label: approvalLabel(state) };
  return { tone: "wait", label: approvalLabel(state) };
}

export interface TodayModel {
  today: string;
  dateLabel: string;
  reminder: { task: PrepTask; text: string; meta: string; actionLabel: string; doneAt: string | null } | null;
  partnerLine: { actorId: string; text: string; when: string } | null;
  tonight: {
    title: string;
    photoDish: string;
    rows: MenuRow[];
    mainId: string | null;
    approval: ApprovalState;
    cooked: boolean;
    /** Tonight was cooked: the leftover question. */
    leftover: EveningLeftover | null;
  } | null;
  ateOut: boolean;
  returnedNames: string[];
  /** Yesterday's dinner: lunch today, dolapta, or a choice someone made. */
  leftover: EveningLeftover | null;
  /** Older dolapta dishes still good today (yesterday's is `leftover`). */
  fridge: EveningLeftover[];
  tomorrow: { line: string; sub: string; avatarId: string | null; date: string } | null;
}

export function useToday(): TodayModel {
  const state = useApp();
  return useMemo(() => {
    const { today, me, people, recipes, planItems, planDays, matches, prepTasks, activity } = state;
    const byId = recipesMap(recipes);
    const users = usersMap(people);
    const st = { items: planItems, days: planDays, matches, recipesById: byId };

    // Reminder
    const task = topReminder(prepTasks, today, now());
    const reminder = task
      ? {
          task,
          text: reminderSentence(task, byId.get(task.recipeId), today),
          meta: reminderMeta(task, users),
          actionLabel: task.freezer ? "Çıkardım" : "Yaptım",
          doneAt: task.doneAt ? clockTime(new Date(task.doneAt)) : null,
        }
      : null;

    // Partner activity
    const partnerAct = activity
      .filter((a) => a.actorId !== me?.id && PARTNER_TYPES.has(a.type))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const partnerLine = partnerAct
      ? (() => {
          const v = viewActivity(partnerAct, { recipesById: byId, users, todayIso: today, now: now() });
          return { actorId: v.actorId, text: v.text, when: v.when };
        })()
      : null;

    const lunchSetting = state.household;

    // Tonight
    const day = dayFor(planDays, today);
    const ateOut = day?.status === "ate-out";
    const menu = menuFor(planItems, today);
    const items = menuItems(menu);
    const tonight =
      !ateOut && items.length
        ? {
            title: menuTitle(menu, byId),
            photoDish: (() => {
              const main = menu.ana ?? items[0];
              const r = byId.get(main.recipeId);
              return r ? recipeLabel(r) : "Akşam yemeği";
            })(),
            rows: SLOTS.filter((sl) => menu[sl]).map((sl: Slot) => {
              const r = byId.get(menu[sl]!.recipeId);
              return {
                slot: sl,
                name: r ? r.name : null,
                href: r ? `/tarif/${r.id}?gun=${today}` : undefined,
                time: r ? recipeTime(r) : "",
              };
            }),
            mainId: (menu.ana ?? items[0]).recipeId,
            approval: approvalState(day, me?.id ?? "", people),
            cooked: day?.status === "cooked",
            leftover: day?.status === "cooked" && lunchSetting ? eveningLeftover(st, lunchSetting, today, people.length, today) : null,
          }
        : null;

    // Yesterday's leftovers: shown when they matter (lunch, dolapta) or someone chose something.
    const yesterday = addDays(today, -1);
    const yEv = lunchSetting ? eveningLeftover(st, lunchSetting, yesterday, people.length, today) : null;
    const yesterdayLeftover =
      yEv && yEv.cooked && !yEv.plannedDate && (yEv.outcome.kind === "lunch" || yEv.outcome.kind === "fridge" || yEv.choice !== null) ? yEv : null;

    // Tomorrow
    const tDate = addDays(today, 1);
    const tMenu = menuFor(planItems, tDate);
    const tItems = menuItems(tMenu);
    let tomorrow: TodayModel["tomorrow"] = null;
    if (tItems.length) {
      const main = byId.get((tMenu.ana ?? tItems[0]).recipeId);
      const list = selectList(state);
      const onList = main?.ingredients.find((i) => !i.staple && list.some((r) => r.name === i.name && !r.checkedBy));
      const prep = main?.prepItems[0];
      const sub = [
        onList ? `${onList.name} listede` : null,
        prep ? `${offsetLabel(prep.offset)}: ${lowerFirstTr(prep.label)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const tDay = dayFor(planDays, tDate);
      const waiting = people.find((p) => !(tDay?.approvals ?? []).includes(p.id));
      tomorrow = {
        line: menuLine(tMenu, byId),
        sub,
        avatarId: waiting?.id ?? (tMenu.ana ?? tItems[0]).createdBy,
        date: tDate,
      };
    }

    return {
      today,
      dateLabel: longDate(today),
      reminder,
      partnerLine,
      tonight,
      ateOut,
      returnedNames: (day?.returnedRecipeIds ?? []).map((id) => byId.get(id)?.name).filter((x): x is string => !!x),
      leftover: yesterdayLeftover,
      fridge: lunchSetting ? fridgeItems(st, lunchSetting, today, people.length).filter((f) => f.fromDate !== yesterday) : [],
      tomorrow,
    };
  }, [state]);
}
