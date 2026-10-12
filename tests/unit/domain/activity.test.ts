import { describe, expect, it } from "vitest";
import type { Activity } from "@/data/models";
import { activityText, approvalLabel, approvalState, latestPartnerActivity, viewActivity } from "@/domain/activity";
import { day, R, recipesById, user } from "./helpers";

const act = (type: Activity["type"], data: Activity["data"], actorId = "ali", createdAt = "2026-10-11T12:00:00.000Z"): Activity => ({
  id: type + createdAt,
  householdId: "h",
  actorId,
  type,
  data,
  createdBy: actorId,
  createdAt,
  updatedAt: createdAt,
});

describe("activity copy", () => {
  const ctx = { recipesById, todayIso: "2026-10-12" };
  it("matches the design's activity lines", () => {
    expect(activityText(act("plan.added", { recipeId: R("Tavuk sote").id, date: "2026-10-15" }), ctx)).toBe("Perşembe'ye tavuk sote ekledi");
    expect(activityText(act("plan.approved", { date: "2026-10-12" }), ctx)).toBe("bu akşamki menüyü onayladı");
    expect(activityText(act("plan.added", { recipeId: R("İzmir köfte").id, date: "2026-10-13" }), ctx)).toBe("Salı'ya İzmir köfte ekledi");
    expect(activityText(act("plan.added", { recipeId: R("Karnıyarık").id, date: "2026-10-16" }), ctx)).toBe("Cuma'ya karnıyarık ekledi");
    expect(activityText(act("shopping.checked", { itemName: "Kıyma" }), ctx)).toBe("Kıyma aldı");
    expect(activityText(act("match.made", { recipeId: R("Karnıyarık").id }), { ...ctx, partnerName: "Zeynep" })).toBe("ile karnıyarık için eşleştiniz");
  });

  it("builds a view with actor name and relative time", () => {
    const users = new Map([["ali", user("ali", "Ali")]]);
    const v = viewActivity(act("plan.added", { recipeId: R("Tavuk sote").id, date: "2026-10-15" }), {
      ...ctx,
      users,
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(`${v.actorName} ${v.text} · ${v.when}`).toBe("Ali Perşembe'ye tavuk sote ekledi · dün");
  });

  it("finds the partner's latest activity", () => {
    const list = [act("plan.added", {}, "zeynep", "2026-10-12T10:00:00Z"), act("plan.approved", {}, "ali", "2026-10-12T11:00:00Z")];
    expect(latestPartnerActivity(list, "ali")?.actorId).toBe("zeynep");
    expect(latestPartnerActivity([], "ali")).toBeNull();
  });
});

describe("approval state", () => {
  const ali = user("ali", "Ali");
  const zeynep = user("zeynep", "Zeynep");
  it("covers both, waiting and solo", () => {
    expect(approvalLabel(approvalState(day("d", { approvals: ["ali", "zeynep"] }), "ali", [ali, zeynep]))).toBe("İkiniz de onayladınız");
    expect(approvalLabel(approvalState(day("d", { approvals: ["ali"] }), "ali", [ali, zeynep]))).toBe("Zeynep'in onayı bekleniyor");
    expect(approvalLabel(approvalState(day("d", { approvals: ["zeynep"] }), "ali", [ali, zeynep]))).toBe("Zeynep onayladı");
    expect(approvalState(undefined, "ali", [ali, zeynep]).kind).toBe("none");
    expect(approvalState(day("d", { approvals: ["ali"] }), "ali", [ali])).toEqual({ kind: "solo", approved: true });
    expect(approvalLabel(approvalState(day("d", { approvals: ["zeynep"] }), "zeynep", [zeynep, ali]))).toBe("Ali'nin onayı bekleniyor");
  });
});
