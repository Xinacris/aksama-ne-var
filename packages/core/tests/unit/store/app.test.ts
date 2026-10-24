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

describe("store in English", () => {
  it("shows recipes, tasks and list rows in English while lists still merge by catalog name", async () => {
    const { setLocale } = await import("@/i18n");
    await appStore.getState().loadDemo();
    setLocale("en");
    try {
      await appStore.getState().refresh();
      const s = appStore.getState();
      expect(s.recipes.find((r) => r.id === "izmir-kofte")!.name).toBe("İzmir köfte (meatball and potato bake)");
      expect(s.rawRecipes.find((r) => r.id === "izmir-kofte")!.name).toBe("İzmir köfte");
      const task = s.prepTasks.find((t) => t.recipeId === "izmir-kofte" && t.freezer);
      if (task) expect(task.label).toBe("Take the mince out of the freezer");
      const rows = selectList(s);
      const anyCatalog = rows.find((r) => r.label);
      expect(anyCatalog).toBeTruthy();
      expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    } finally {
      setLocale("tr");
      await appStore.getState().refresh();
    }
    expect(appStore.getState().recipes.find((r) => r.id === "izmir-kofte")!.name).toBe("İzmir köfte");
  });
});

describe("Evde ne var? (Round 3.5)", () => {
  it("adds, edits and removes pantry items; the list leaves out what is at home", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().dropOnDay({ date: "2026-10-12", recipeId: id("İzmir köfte"), origin: "recipe" });
    expect(selectList(appStore.getState()).map((r) => r.name)).toContain("Kıyma");
    expect(await appStore.getState().addPantryItems([{ name: "kıyma", quantity: 500, unit: "g" }, { name: "Annemin salçası" }])).toBe(2);
    let s = appStore.getState();
    expect(s.pantry.map((p) => p.name).sort()).toEqual(["Annemin salçası", "Kıyma"]);
    expect(selectList(s).map((r) => r.name)).not.toContain("Kıyma");
    // Adding it again updates the amount instead of a second row.
    expect(await appStore.getState().addPantryItems([{ name: "Kıyma", quantity: 1, unit: "kg" }])).toBe(0);
    const k = appStore.getState().pantry.find((p) => p.name === "Kıyma")!;
    expect([k.quantity, k.unit]).toEqual([1, "kg"]);
    await appStore.getState().updatePantryItem(k.id, { status: "low" });
    s = appStore.getState();
    expect(selectList(s).map((r) => r.name)).toContain("Kıyma"); // az kaldı → back on the list
    await appStore.getState().removePantryItem(k.id);
    expect(appStore.getState().pantry.map((p) => p.name)).toEqual(["Annemin salçası"]);
  });

  it("answering a check marks var / az kaldı / yok and records the answer for the household", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().addPantryItems([{ name: "Kıyma" }, { name: "Domates" }, { name: "Yumurta" }]);
    await appStore.getState().answerPantryCheck("day:2026-10-13", { Kıyma: "have", Domates: "none", Yumurta: "low" });
    const s = appStore.getState();
    expect(s.pantry.find((p) => p.name === "Domates")).toBeUndefined();
    expect(s.pantry.find((p) => p.name === "Yumurta")!.status).toBe("low");
    expect(s.pantry.find((p) => p.name === "Kıyma")!.status).toBe("have");
    expect(s.pantryAnswers.map((a) => a.key)).toEqual(["day:2026-10-13"]);
  });

  it("an old pantry row (before 3.5, no status) still loads and counts as at home", async () => {
    await signUpWithHousehold("Ali", "ali@ornek.com");
    await appStore.getState().markHave("Kıyma");
    const row = appStore.getState().pantry[0];
    expect(row.status).toBeUndefined();
    await appStore.getState().dropOnDay({ date: "2026-10-12", recipeId: id("İzmir köfte"), origin: "recipe" });
    expect(selectList(appStore.getState()).map((r) => r.name)).not.toContain("Kıyma");
  });
});
