import type { PlanItem, Slot } from "@/data/models";
import type { Repos } from "@/data/repos";
import { builtinRecipes } from "@/data/seed/recipes";
import { addDays, fromIsoDate } from "@/domain/dates";
import { ingredientKey } from "@/domain/shopping";
import { hashPassword, randomSalt } from "@/lib/crypto";
import { now, withNow } from "@/lib/clock";
import { buildDeck, nextOpenEvening, recentlyPlannedIds } from "@/domain/matching";
import { lastCookedMap } from "@/domain/rotation";
import { MEMBER_COLORS } from "./household";

export const DEMO_PASSWORD = "demo1234";
export const DEMO_ACCOUNTS = [
  { name: "Ali", email: "ali@demo.ev" },
  { name: "Zeynep", email: "zeynep@demo.ev" },
] as const;
export const DEMO_INVITE = "k7m2-tq";

const id = (name: string) => {
  const r = builtinRecipes.find((x) => x.name === name);
  if (!r) throw new Error(`demo: missing recipe ${name}`);
  return r.id;
};

/** Local date+time → ISO, so demo timestamps read naturally in the UI. */
function at(dateIso: string, h: number, m = 0): string {
  const d = fromIsoDate(dateIso);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** The 14 items on the design's shopping list; everything else in the week is "evde var". */
const DESIGN_LIST = new Set([
  "Kıyma",
  "Süzme yoğurt",
  "Tereyağı",
  "Yumurta",
  "Kırmızı mercimek",
  "Baldo pirinç",
  "Arpa şehriye",
  "Biber salçası",
  "Kemer patlıcan",
  "Domates",
  "Sivri biber",
  "Patates",
  "Salatalık",
  "Maydanoz",
]);

/**
 * Seed the design's sample household relative to `today` (the design's
 * "Pazartesi, 12 Ekim"): Ali & Zeynep, a populated week, matches, cooking
 * history, a shopping list with Zeynep's checks, and activity.
 * Returns Ali's user id. If the demo already exists, nothing is changed.
 */
export async function seedDemo(repos: Repos, today: string): Promise<string> {
  const existing = await repos.auth.findUserByEmail(DEMO_ACCOUNTS[0].email);
  if (existing) return existing.id;

  const nowTs = now();
  const T = (n: number) => addDays(today, n);

  const users = [];
  for (const [i, a] of DEMO_ACCOUNTS.entries()) {
    const salt = randomSalt();
    const u = await withNow(at(T(-45), 20, i), () =>
      repos.auth.createUser({
        email: a.email,
        name: a.name,
        avatarInitial: a.name[0],
        passwordSalt: salt,
        passwordHash: "",
        onboarded: true,
      }),
    );
    await repos.auth.updateUser(u.id, { passwordHash: await hashPassword(DEMO_PASSWORD, salt) });
    users.push(u);
  }
  const [ali, zeynep] = users;

  // Free the design's invite code if someone else already has it.
  const clash = await repos.households.findByInviteCode(DEMO_INVITE);
  const household = await withNow(at(T(-45), 20, 5), () =>
    repos.households.create({
      name: "Ali ve Zeynep",
      inviteCode: clash ? `${DEMO_INVITE.slice(0, 4)}-${Math.random().toString(36).slice(2, 4)}` : DEMO_INVITE,
      createdBy: ali.id,
      dinnerTime: "19:30",
      lunchAtHome: "yes",
      lunchDays: [],
    }),
  );
  const hid = household.id;
  await withNow(at(T(-45), 20, 6), () =>
    repos.households.addMember({ householdId: hid, userId: ali.id, role: "owner", color: MEMBER_COLORS[0], createdBy: ali.id }),
  );
  await withNow(at(T(-44), 9), () =>
    repos.households.addMember({ householdId: hid, userId: zeynep.id, role: "member", color: MEMBER_COLORS[1], createdBy: zeynep.id }),
  );

  // Favorites: the seven onboarding picks + "Sık yaptıklarınız".
  for (const name of [
    "Mercimek çorbası",
    "Kuru fasulye",
    "İzmir köfte",
    "Karnıyarık",
    "Menemen",
    "Tereyağlı pirinç pilavı",
    "Cacık",
    "Taze fasulye",
    "Bulgur pilavı",
  ]) {
    await repos.households.addFavorite({ householdId: hid, recipeId: id(name), createdBy: ali.id });
  }

  // Cooking history drives "en son … önce" and "Sık yaptıklarınız".
  const history: [string, number[]][] = [
    ["Kuru fasulye", [-1, -15, -29, -43]],
    ["Tarhana çorbası", [-1]],
    ["Tereyağlı pirinç pilavı", [-1, -14, -28]],
    ["Turşu", [-1]],
    ["Mercimek çorbası", [-8, -22, -36]],
    ["İzmir köfte", [-14, -28, -50]],
    ["Menemen", [-5, -19, -33]],
    ["Cacık", [-6, -20, -40]],
    ["Taze fasulye", [-10, -31]],
    ["Bulgur pilavı", [-12, -26]],
    ["Karnıyarık", [-21]],
    ["Fırın makarna", [-35]],
    ["Etli nohut", [-42]],
    ["Mantı", [-60]],
  ];
  for (const [name, days] of history) {
    for (const d of days) await repos.plan.addCookLog({ householdId: hid, recipeId: id(name), date: T(d), createdBy: ali.id });
  }

  // The week on the board.
  const add = (date: string, slot: Slot, name: string, by: string, source: PlanItem["source"] = "manual", ts?: string) =>
    withNow(ts ?? at(T(-3), 21), () =>
      repos.plan.addItem({ householdId: hid, date, slot, recipeId: id(name), source, createdBy: by }),
    );
  // Friday: etli biber dolması, cooked; what is left sits in the fridge (Bugün's "Dolapta").
  const fri = T(-3);
  await add(fri, "ana", "Etli biber dolması", zeynep.id, "manual", at(T(-5), 20));
  await add(fri, "salata", "Cacık", zeynep.id, "manual", at(T(-5), 20));
  await repos.plan.addCookLog({ householdId: hid, recipeId: id("Etli biber dolması"), date: fri, createdBy: zeynep.id });
  await repos.plan.addCookLog({ householdId: hid, recipeId: id("Cacık"), date: fri, createdBy: zeynep.id });
  await repos.plan.upsertDay(hid, fri, { status: "cooked", leftoverChoice: "fridge", leftoverChoiceBy: zeynep.id, approvals: [ali.id, zeynep.id], cookedAt: at(fri, 20) }, zeynep.id);

  const sun = T(-1);
  await add(sun, "corba", "Tarhana çorbası", ali.id);
  await add(sun, "ana", "Kuru fasulye", ali.id);
  await add(sun, "yaninda", "Tereyağlı pirinç pilavı", ali.id);
  await add(sun, "salata", "Turşu", ali.id);
  await repos.plan.upsertDay(hid, sun, { status: "cooked", leftoverChoice: "lunch", leftoverChoiceBy: ali.id, approvals: [ali.id, zeynep.id], cookedAt: at(sun, 20) }, ali.id);

  await repos.plan.upsertDay(hid, T(-2), { status: "ate-out", returnedRecipeIds: [id("Etli nohut")] }, zeynep.id);

  const mon = T(0);
  await add(mon, "corba", "Mercimek çorbası", ali.id);
  await add(mon, "ana", "İzmir köfte", ali.id);
  await add(mon, "yaninda", "Tereyağlı pirinç pilavı", ali.id);
  await add(mon, "salata", "Çoban salata", ali.id);
  await repos.plan.upsertDay(hid, mon, { approvals: [ali.id, zeynep.id] }, ali.id);

  const tue = T(1);
  await add(tue, "corba", "Yayla çorbası", zeynep.id);
  await add(tue, "ana", "Karnıyarık", ali.id, "match");
  await add(tue, "yaninda", "Şehriyeli pilav", zeynep.id);
  await add(tue, "salata", "Cacık", zeynep.id);
  await repos.plan.upsertDay(hid, tue, { approvals: [ali.id], leftoverChoice: "lunch", leftoverChoiceBy: ali.id }, ali.id);

  const wed = T(2);
  await add(wed, "ana", "Menemen", ali.id);
  await add(wed, "salata", "Çoban salata", ali.id);
  await repos.plan.upsertDay(hid, wed, { approvals: [ali.id] }, ali.id);

  const thu = T(3);
  const thuTs = at(T(-1), 13);
  await add(thu, "corba", "Ezogelin çorbası", zeynep.id, "manual", thuTs);
  await add(thu, "ana", "Tavuk sote", zeynep.id, "manual", thuTs);
  await add(thu, "yaninda", "Bulgur pilavı", zeynep.id, "manual", thuTs);
  await add(thu, "salata", "Cacık", zeynep.id, "manual", thuTs);
  await repos.plan.upsertDay(hid, thu, { approvals: [zeynep.id], leftoverChoice: "none" }, zeynep.id);

  // Matches: karnıyarık placed on Tuesday; etli nohut back from Saturday; two open.
  const match = (name: string, status: "open" | "placed" | "returned", extra: { placedDate?: string; returnedFrom?: string; ts: string }) =>
    withNow(extra.ts, () =>
      repos.swipes.addMatch({
        householdId: hid,
        recipeId: id(name),
        date: extra.placedDate ?? extra.returnedFrom ?? T(1),
        slot: "ana",
        status,
        placedDate: extra.placedDate ?? null,
        returnedFrom: extra.returnedFrom ?? null,
        createdBy: ali.id,
      }),
    );
  await match("Karnıyarık", "placed", { placedDate: tue, ts: at(T(-2), 21) });
  await match("Etli nohut", "returned", { returnedFrom: T(-2), ts: at(T(-2), 19) });
  await match("Mantı", "open", { ts: at(T(-3), 21, 30) });
  await match("Fırın makarna", "open", { ts: at(T(-3), 21, 10) });

  // Zeynep already swiped 8 of the 12 cards for the next open evening; her
  // choices stay hidden. She liked the first card, so Ali's first "Olur" is a match.
  const items = await repos.plan.listItems(hid);
  const days = await repos.plan.listDays(hid);
  const target = nextOpenEvening(items, days, today, addDays);
  const deck = buildDeck({
    recipes: builtinRecipes,
    favorites: await repos.households.listFavorites(hid),
    lastCooked: lastCookedMap(await repos.plan.listCookLog(hid)),
    slot: "ana",
    date: target,
    plannedRecipeIds: recentlyPlannedIds(items, today, addDays),
    matches: await repos.swipes.listMatches(hid),
  });
  for (const [i, r] of deck.slice(0, 8).entries()) {
    await repos.swipes.addSwipe({
      householdId: hid,
      userId: zeynep.id,
      recipeId: r.id,
      date: target,
      slot: "ana",
      decision: i % 2 === 0 ? "like" : "pass",
      createdBy: zeynep.id,
    });
  }

  // Pantry: everything this week needs except the design's 14 list items is at home;
  // the kıyma for tonight and the tavuk but for Thursday are in the freezer.
  const weekRecipes = new Set<string>();
  for (const it of await repos.plan.listItems(hid)) if (it.date >= today) weekRecipes.add(it.recipeId);
  for (const m of await repos.swipes.listMatches(hid)) if (m.status === "returned") weekRecipes.add(m.recipeId);
  const pantryNames = new Set<string>();
  for (const r of builtinRecipes) {
    if (!weekRecipes.has(r.id)) continue;
    for (const ing of r.ingredients) if (!ing.staple && !DESIGN_LIST.has(ing.name)) pantryNames.add(ing.name);
  }
  await repos.shopping.addPantry([
    ...[...pantryNames].map((name) => ({ householdId: hid, name, quantity: null, unit: null, createdBy: ali.id })),
    { householdId: hid, name: "Kıyma", quantity: 500, unit: "g" as const, createdBy: ali.id },
  ]);

  // Zeynep is at the market: three items checked, kıyma "az önce".
  const checkAt = (name: string, ts: Date) =>
    withNow(ts, () =>
      repos.shopping.check({ householdId: hid, itemKey: ingredientKey(name), checkedBy: zeynep.id, createdBy: zeynep.id }),
    );
  await checkAt("Süzme yoğurt", new Date(nowTs.getTime() - 9 * 60000));
  await checkAt("Baldo pirinç", new Date(nowTs.getTime() - 6 * 60000));
  await checkAt("Kıyma", new Date(nowTs.getTime() - 40 * 1000));

  // Activity.
  const act = (actor: string, type: Parameters<Repos["activity"]["add"]>[0]["type"], payload: Record<string, string | number | null>, ts: Date | string) =>
    withNow(ts, () => repos.activity.add({ householdId: hid, actorId: actor, type, data: payload, createdBy: actor }));
  await act(zeynep.id, "household.joined", {}, at(T(-44), 9, 1));
  await act(zeynep.id, "plan.ateOut", { date: T(-2) }, at(T(-2), 21));
  await act(ali.id, "match.made", { recipeId: id("Karnıyarık"), date: tue }, at(T(-2), 21, 5));
  await act(zeynep.id, "plan.added", { recipeId: id("Tavuk sote"), date: thu }, thuTs);
  await act(ali.id, "plan.added", { recipeId: id("İzmir köfte"), date: mon }, at(T(-1), 18));
  await act(zeynep.id, "shopping.checked", { itemName: "Süzme yoğurt" }, new Date(nowTs.getTime() - 9 * 60000));
  await act(zeynep.id, "plan.approved", { date: mon }, new Date(nowTs.getTime() - 14 * 60000));
  await act(zeynep.id, "shopping.checked", { itemName: "Kıyma" }, new Date(nowTs.getTime() - 40 * 1000));

  return ali.id;
}
