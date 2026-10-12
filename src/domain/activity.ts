import type { Activity, PlanDay, Recipe, User } from "@/data/models";
import { agoTime, dayName } from "./dates";
import { dishInSentence } from "./prep";
import { dative, genitive } from "@/lib/text";

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
  const dish = recipe ? dishInSentence(recipe.shortName ?? recipe.name) : "bir yemek";
  const date = str(a.data.date);
  const day = date ? dayName(date) : "";
  const isToday = date === ctx.todayIso;
  switch (a.type) {
    case "household.joined":
      return "eve katıldı";
    case "plan.added":
      return isToday ? `bu akşama ${dish} ekledi` : `${dative(day)} ${dish} ekledi`;
    case "plan.removed":
      return isToday ? "bu akşamın menüsünü değiştirdi" : `${day} menüsünü değiştirdi`;
    case "plan.moved":
      return date ? `${dative(day)} ${dish} taşıdı` : "planı yeniden düzenledi";
    case "plan.approved":
      return isToday ? "bu akşamki menüyü onayladı" : `${day} menüsünü onayladı`;
    case "plan.ateOut":
      return isToday ? "bugün dışarıda yediğinizi işaretledi" : `${day} akşamı dışarıda yediğinizi işaretledi`;
    case "plan.changed":
      return isToday ? "bu akşamın planını değiştirdi" : `${day} planını değiştirdi`;
    case "plan.leftovers":
      return `${day} yemeğinin ertesi güne artacağını işaretledi`;
    case "match.made":
      return ctx.partnerName ? `ile ${dish} için eşleştiniz` : `${dish} için karar verdi`;
    case "shopping.checked":
      return `${str(a.data.itemName)} aldı`;
    case "shopping.finished":
      return `alışverişi bitirdi · ${str(a.data.count)} ürün eve girdi`;
    case "shopping.added":
      return `listeye ${str(a.data.itemName).toLocaleLowerCase("tr")} ekledi`;
    case "prep.done":
      return `“${str(a.data.label)}” işini tamamladı`;
    case "recipe.created":
      return `${dish} tarifini ekledi`;
    case "recipe.updated":
      return `${dish} tarifini güncelledi`;
    default:
      return "bir şey güncelledi";
  }
}

export function viewActivity(
  a: Activity,
  ctx: { recipesById: Map<string, Recipe>; users: Map<string, User>; todayIso: string; now: Date; partnerName?: string },
): ActivityView {
  return {
    id: a.id,
    actorId: a.actorId,
    actorName: ctx.users.get(a.actorId)?.name ?? "Biri",
    text: activityText(a, ctx),
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
      return "İkiniz de onayladınız";
    case "waitingPartner":
      return `${genitive(s.partnerName)} onayı bekleniyor`;
    case "waitingMe":
      return `${s.partnerName} onayladı`;
    case "solo":
      return s.approved ? "Onaylandı" : "Onay bekliyor";
    default:
      return "Onay bekliyor";
  }
}
