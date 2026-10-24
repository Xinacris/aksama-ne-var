import { expect, test, type Page } from "@playwright/test";

const MON = new Date("2026-10-12T10:00:00+03:00");
const WED = new Date("2026-10-14T10:00:00+03:00");

async function demo(page: Page) {
  await page.clock.setFixedTime(MON);
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}

test("'Artmaz' on a recipe → cooking it creates no lunch; 'öğlen yenir' does", async ({ page }) => {
  await demo(page);
  // A custom recipe that leaves nothing over
  await page.goto("/tarifler/yeni");
  await page.getByLabel("Tarifin adı").fill("Sahanda yumurta");
  // New recipes start as "Artmaz" (in the closed "Kaynak ve artarsa" section); "Kaç gün içinde" only shows for "Saklanır"
  await expect(page.getByText("Kaynak ve artarsa")).toBeVisible();
  await page.getByText("Kaynak ve artarsa").click();
  const policy = page.getByRole("radiogroup", { name: "Artarsa ne olur?" });
  await expect(policy.getByRole("radio", { name: "Artmaz / hepsi biter" })).toBeChecked();
  await expect(page.getByLabel("Kaç gün içinde")).toHaveCount(0);
  await policy.getByRole("radio", { name: "Saklanır" }).click();
  await expect(page.getByLabel("Kaç gün içinde")).toBeVisible();
  // keyboard: one tab stop, arrows move the choice
  await policy.getByRole("radio", { name: "Saklanır" }).press("ArrowRight");
  await expect(policy.getByRole("radio", { name: "Artmaz / hepsi biter" })).toBeChecked();
  await expect(policy.getByRole("radio", { name: "Artmaz / hepsi biter" })).toBeFocused();
  await expect(page.getByLabel("Kaç gün içinde")).toHaveCount(0);
  await page.getByLabel("Malzeme", { exact: true }).fill("Yumurta");
  await page.getByLabel("Miktar", { exact: true }).fill("4");
  await page.getByLabel("1. adım", { exact: true }).fill("Yumurtaları tereyağında 5 dakika pişir.");
  await page.getByRole("button", { name: "Tarifi kaydet" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sahanda yumurta" })).toBeVisible();
  const recipeUrl = page.url();

  // Put it on Tuesday's main slot (replaces karnıyarık and its "öğlen" choice)
  await page.getByRole("button", { name: "Güne ekle" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Salı/ }).click();

  // Wednesday: Tuesday was cooked (rollover) — no lunch, nothing dolapta
  await page.clock.setFixedTime(WED);
  await page.goto("/bugun");
  await expect(page.getByRole("heading", { name: "Akşama ne var?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Artan yemek" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Dolapta" }).filter({ hasText: /sahanda yumurta/i })).toHaveCount(0);
  await page.goto("/hafta");
  await expect(page.getByText(/Öğlen · sahanda yumurta/i)).toHaveCount(0);
  await page.goto("/bugun");

  // Change the recipe default to "ertesi gün öğlen yenir": the lunch appears
  await page.goto(recipeUrl.replace("/tarif/", "/tarifler/") + "/duzenle");
  // Artmaz and no Kaynak: the section starts closed on edit too
  await page.getByText("Kaynak ve artarsa").click();
  await page.getByRole("radiogroup", { name: "Artarsa ne olur?" }).getByRole("radio", { name: "Ertesi gün öğlen yenir" }).click();
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sahanda yumurta" })).toBeVisible();
  await page.goto("/bugun");
  const card = page.getByRole("region", { name: "Artan yemek" });
  await expect(card).toContainText("Dünkü sahanda yumurta bugün öğlen için yeterli.");

  // One tap: nobody will eat it — neutral, undoable
  await card.getByRole("button", { name: "Kimse yemeyecek" }).click();
  await expect(card).toContainText("Dünkü sahanda yumurta: kimse yemeyecek.");
  await card.getByRole("button", { name: "Geri al" }).click();
  await expect(card).toContainText("bugün öğlen için yeterli.");
});

test("leftover choice syncs to the other tab and the activity feed", async ({ page, context }) => {
  await demo(page);
  const other = await context.newPage();
  await other.clock.setFixedTime(MON);
  await other.goto("/bugun");
  const card = page.getByRole("region", { name: "Artan yemek" });
  await card.getByRole("button", { name: "Dolaba kaldır" }).click();
  await expect(other.getByRole("region", { name: "Artan yemek" })).toContainText("Dünkü kuru fasulye dolapta.");
  await other.goto("/akis");
  await expect(other.getByText("artan kuru fasulye için “Dolaba kaldır” dedi").first()).toBeVisible();
});

test("drag a dolapta dish onto the board; the list does not grow", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "board DnD is the desktop layout");
  await demo(page);
  await page.goto("/liste");
  const before = await page.getByRole("button", { name: /,/ }).count();
  await page.goto("/hafta");
  const source = page.getByRole("button", { name: /^Dolapta: Etli biber dolması/ });
  const target = page.getByRole("button", { name: "Pazartesi · Ana yemek: İzmir köfte" });
  const s = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(s.x + 20, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + 40, s.y + s.height / 2, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Pazartesi · Ana yemek: dolaptan Etli biber dolması" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Dolapta: Etli biber dolması/ })).toHaveCount(0);
  await page.goto("/liste");
  // köfte's kıyma etc. leave the list; nothing is added for the leftover
  expect(await page.getByRole("button", { name: /,/ }).count()).toBeLessThanOrEqual(before);
});
