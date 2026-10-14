import type { Activity, LeftoverChoice, PlanDay, Recipe, User } from "../data/models";
import { intlTag, t } from "../i18n";
import { choiceLabel } from "./leftovers";
import { ingredientLabel } from "./recipeText";
import { agoTime, dayName } from "./dates";
import { dishInSentence } from "./prep";
import { dative, genitive } from "../lib/text";

export interface ActivityView {
  id: string;
  actorId: string;
  actorName: string;
  text: string;
  when: string;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

/** Sentence after the actor's name: "Perşembe'ye tavuk sote ekledi". */
export function activityText(
  a: Activity,
  ctx: { recipesById: Map<string, Recipe>; todayIso: string; partnerName?: string },
): string {
  const recipe = ctx.recipesById.get(str(a.data.recipeId));
  const dish = recipe ? dishInSentence(recipe.shortName ?? recipe.name) : t("activity.aDish");
  const date = str(a.data.date);
  const day = date ? dayName(date) : "";
  const isToday = date === ctx.todayIso;
  const d = { dish, day, dayDat: day ? dative(day) : "" };
  switch (a.type) {
    case "household.joined":
      return t("activity.joined");
    case "plan.added":
      return t(isToday ? "activity.addedTonight" : "activity.addedDay", d);
    case "plan.removed":
      return t(isToday ? "activity.removedTonight" : "activity.removedDay", d);
    case "plan.moved":
      return date ? t("activity.movedDay", d) : t("activity.rearranged");
    case "plan.approved":
      return t(isToday ? "activity.approvedTonight" : "activity.approvedDay", d);
    case "plan.ateOut":
      return t(isToday ? "activity.ateOutToday" : "activity.ateOutDay", d);
    case "plan.changed":
      return t(isToday ? "activity.changedTonight" : "activity.changedDay", d);
    case "plan.leftovers":
      return t("activity.leftovers", d);
    case "leftover.set": {
      const choice = str(a.data.choice) as LeftoverChoice | "";
      if (!choice) return t("activity.leftoverReset", d);
      if (choice === "lunch") return t("activity.leftoverSet", { ...d, choice: t(a.data.date === ctx.todayIso ? "activity.lunchTomorrow" : "activity.lunch") });
      return t("activity.leftoverSet", { ...d, choice: choiceLabel(choice) });
    }
    case "match.made":
      return ctx.partnerName ? t("activity.matchedWith", { ...d, partner: ctx.partnerName }) : t("activity.decided", d);
    case "shopping.checked":
      return t("activity.bought", { item: ingredientLabel(str(a.data.itemName)) });
    case "shopping.finished":
      return t("activity.finishedShopping", { count: Number(str(a.data.count)) || 0 });
    case "shopping.added":
      return t("activity.addedToList", { item: ingredientLabel(str(a.data.itemName)).toLocaleLowerCase(intlTag()) });
    case "prep.done":
      return t("activity.prepDone", { label: str(a.data.label) });
    case "recipe.created":
      return t("activity.recipeCreated", d);
    case "recipe.updated":
      return t("activity.recipeUpdated", d);
    case "cooking.started":
      return date ? t(isToday ? "activity.cookStartTonight" : "activity.cookStartDay", d) : t("activity.cookStartDish", d);
    case "cooking.finished":
      return date ? t(isToday ? "activity.cookDoneTonight" : "activity.cookDoneDay", d) : t("activity.cookDoneDish", d);
    case "recipe.imported":
      return t("activity.imported", d);
    default:
      return t("activity.other");
  }
}

export function viewActivity(
  a: Activity,
  ctx: { recipesById: Map<string, Recipe>; users: Map<string, User>; todayIso: string; now: Date },
): ActivityView {
  // "partner" here means the other member relative to the actor (for match lines).
  const other = [...ctx.users.values()].find((u) => u.id !== a.actorId)?.name;
  return {
    id: a.id,
    actorId: a.actorId,
    actorName: ctx.users.get(a.actorId)?.name ?? t("activity.someone"),
    text: activityText(a, { ...ctx, partnerName: other }),
    when: agoTime(a.createdAt, ctx.now),
  };
}

/** Latest activity from someone other than me (for the Bugün partner line). */
export function latestPartnerActivity(list: Activity[], meId: string): Activity | null {
  return [...list].filter((a) => a.actorId !== meId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export type ApprovalState =
  | { kind: "both" }
  | { kind: "waitingPartner"; partnerName: string }
  | { kind: "waitingMe"; partnerName: string }
  | { kind: "none" }
  | { kind: "solo"; approved: boolean };

/** "İkiniz de onayladınız" / "Zeynep'in onayı bekleniyor" / partner approved, waiting on me. */
export function approvalState(day: PlanDay | undefined, meId: string, members: User[]): ApprovalState {
  const approvals = day?.approvals ?? [];
  const others = members.filter((m) => m.id !== meId);
  if (others.length === 0) return { kind: "solo", approved: approvals.includes(meId) };
  const meOk = approvals.includes(meId);
  const pending = others.filter((o) => !approvals.includes(o.id));
  if (meOk && pending.length === 0) return { kind: "both" };
  if (meOk) return { kind: "waitingPartner", partnerName: pending.map((p) => p.name).join(", ") };
  if (pending.length === 0) return { kind: "waitingMe", partnerName: others.map((o) => o.name).join(", ") };
  return { kind: "none" };
}

export function approvalLabel(s: ApprovalState): string {
  switch (s.kind) {
    case "both":
      return t("approval.both");
    case "waitingPartner":
      return t("approval.waitingPartner", { partner: s.partnerName, partnerGen: genitive(s.partnerName) });
    case "waitingMe":
      return t("approval.waitingMe", { partner: s.partnerName });
    case "solo":
      return t(s.approved ? "approval.approved" : "approval.pending");
    default:
      return t("approval.pending");
  }
}
