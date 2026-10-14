import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryData, type DataContext } from "@/data/context";
import { appStore, setDataContext, selectList } from "@/store/app";
import { setNow } from "@/lib/clock";
import { builtinRecipes } from "@/data/seed/recipes";

const id = (name: string) => builtinRecipes.find((r) => r.name === name)!.id;

let d: DataContext;
beforeEach(async () => {
  setNow(new Date(2026, 9, 12, 8, 0));
  d = createMemoryData();
  setDataContext(d);
  appStore.setState({ status: "booting", me: null, household: null });
  await appStore.getState().refresh();
});

async function signUpWithHousehold(name: string, email: string) {
  await appStore.getState().signUp({ name, email, password: "123456" });
  await appStore.getState().createHousehold();
  await appStore.getState().refresh();
}

describe("app store", () => {
  it("starts anonymous, signs up, creates a household and becomes ready", async () => {
    expect(appStore.getState().status).toBe("anon");
    await appStore.getState().signUp({ name: "Ali", email: "ali@ornek.com", password: "123456" });
    expect(appStore.getState().status).toBe("no-household");
    await appStore.getState().createHousehold();
    await appStore.getState().refresh();
    expect(appStore.getState().status).toBe("ready");
    expect(appStore.getState().people.map((p) => p.name)).toEqual(["Ali"]);
  });

  it("surfaces a calm error for a duplicate email", async () => {
    await appStore.getState().signUp({ name: "Ali", email: "ali@ornek.com", password: "123456" });
    appStore.getState().logOut();
    await expect(appStore.getState().signUp({ name: "Ali", email: "ali@ornek.com", password: "123456" })).rejects.toThrow(/zaten/);
  });

  it("logs out and back in with data intact", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().addToPlan({ date: "2026-10-12", slot: "ana", recipeId: id("İzmir köfte"), source: "manual" });
    appStore.getState().logOut();
    expect(appStore.getState().status).toBe("anon");
    await appStore.getState().logIn({ email: "ali@ornek.com", password: "123456" });
    await appStore.getState().refresh();
    expect(appStore.getState().planItems).toHaveLength(1);
  });

  it("plans a dish, generates prep tasks and a shopping list, logs activity", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().addToPlan({ date: "2026-10-12", slot: "ana", recipeId: id("İzmir köfte"), source: "manual" });
    const s = appStore.getState();
    expect(s.prepTasks.map((t) => t.label)).toContain("Kıymayı buzluktan çıkar");
    expect(selectList(s).map((r) => r.name)).toContain("Kıyma");
    expect(s.activity[0].type).toBe("plan.added");
  });

  it("checks an item, finishes shopping, and the bought item leaves the list", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().addToPlan({ date: "2026-10-12", slot: "ana", recipeId: id("İzmir köfte"), source: "manual" });
    const kiyma = selectList(appStore.getState()).find((r) => r.name === "Kıyma")!;
    await appStore.getState().toggleCheck(kiyma);
    expect(selectList(appStore.getState()).find((r) => r.name === "Kıyma")?.checkedBy).toBe(appStore.getState().me!.id);
    const bought = await appStore.getState().finishShopping();
    expect(bought).toBe(1);
    const after = selectList(appStore.getState());
    expect(after.find((r) => r.name === "Kıyma")).toBeUndefined();
    expect(after.find((r) => r.name === "Patates")).toBeDefined();
  });

  it("matches only when both members like the same card", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    const code = appStore.getState().household!.inviteCode;
    const aliId = appStore.getState().me!.id;
    appStore.getState().logOut();
    await appStore.getState().signUp({ name: "Zeynep", email: "zeynep@ornek.com", password: "123456" });
    await appStore.getState().joinHousehold(code);
    expect(appStore.getState().people.map((p) => p.name)).toEqual(["Ali", "Zeynep"]);
    expect(await appStore.getState().swipe(id("Karnıyarık"), "2026-10-13", "ana", "like")).toBeNull();
    // Ali's turn (same browser, other "tab")
    d.session.set(aliId);
    await appStore.getState().refresh();
    const m = await appStore.getState().swipe(id("Karnıyarık"), "2026-10-13", "ana", "like");
    expect(m?.recipeId).toBe(id("Karnıyarık"));
    await appStore.getState().addToPlan({ date: "2026-10-13", slot: "ana", recipeId: m!.recipeId, source: "match", matchId: m!.id });
    expect(appStore.getState().matches[0].status).toBe("placed");
  });

  it("ate out keeps the menu's ingredients on the list via the returned match", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().addToPlan({ date: "2026-10-12", slot: "ana", recipeId: id("Karnıyarık"), source: "manual" });
    await appStore.getState().ateOut("2026-10-12");
    const s = appStore.getState();
    expect(s.planItems).toHaveLength(0);
    expect(s.matches[0]).toMatchObject({ status: "returned", returnedFrom: "2026-10-12" });
    expect(selectList(s).map((r) => r.name)).toContain("Kemer patlıcan");
  });

  it("completes and undoes a prep task", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().addToPlan({ date: "2026-10-12", slot: "ana", recipeId: id("İzmir köfte"), source: "manual" });
    const t = appStore.getState().prepTasks.find((x) => x.label === "Kıymayı buzluktan çıkar")!;
    await appStore.getState().completeTask(t.id);
    expect(appStore.getState().prepTasks.find((x) => x.id === t.id)?.status).toBe("done");
    await appStore.getState().undoTask(t.id);
    expect(appStore.getState().prepTasks.find((x) => x.id === t.id)?.status).toBe("pending");
  });

  it("loads the demo household matching the design", async () => {
    setNow(null);
    await appStore.getState().loadDemo();
    const s = appStore.getState();
    expect(s.status).toBe("ready");
    expect(s.people.map((p) => p.name)).toEqual(["Ali", "Zeynep"]);
    expect(s.household?.inviteCode).toBe("k7m2-tq");
    const rows = selectList(s);
    expect(rows.length).toBe(14);
    expect(rows.filter((r) => r.side === "pazar")).toHaveLength(6);
    expect(rows.filter((r) => r.checkedBy)).toHaveLength(3);
  });

  it("reset clears everything", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().resetAll();
    expect(appStore.getState().status).toBe("anon");
    expect(await d.repos.auth.findUserByEmail("ali@ornek.com")).toBeNull();
  });
});
