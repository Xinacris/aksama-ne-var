import { expect, test } from "@playwright/test";

const NOW = new Date("2026-10-12T10:00:00+03:00");

test.describe("weekly board drag and drop", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "board DnD is the desktop layout");
    await page.clock.setFixedTime(NOW);
    await page.goto("/giris");
    await page.getByRole("button", { name: /Örnek evle dene/ }).click();
    await expect(page).toHaveURL(/\/bugun/);
    await page.goto("/hafta");
    await expect(page.getByRole("heading", { name: "10 – 16 Ekim" })).toBeVisible();
  });

  test("drag a match onto Friday's main slot with the mouse", async ({ page }) => {
    const source = page.getByRole("button", { name: /^Mantı, .*Plana sürükle/ });
    const target = page.getByRole("button", { name: "Cuma · Ana yemek ekle" });
    const s = (await source.boundingBox())!;
    const t = (await target.boundingBox())!;
    await page.mouse.move(s.x + 20, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + 40, s.y + s.height / 2, { steps: 4 });
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 });
    await expect(page.getByText("Buraya bırak")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Cuma · Ana yemek: Mantı" })).toBeVisible();
    await expect(page.getByText("Cuma'ya kondu")).toBeVisible();
  });

  test("move a planned dish to another day with the keyboard", async ({ page }) => {
    const tile = page.getByRole("button", { name: "Çarşamba · Ana yemek: Menemen" });
    await tile.focus();
    await page.keyboard.press("Space");
    for (const _ of [1, 2]) {
      void _;
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(250);
    }
    await expect(page.getByRole("status").filter({ hasText: "Cuma · Ana yemek üzerinde" })).toBeAttached();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Cuma · Ana yemek: Menemen" })).toBeVisible();
  });

  test("Enter on a tile opens its actions; remove from plan", async ({ page }) => {
    const tile = page.getByRole("button", { name: "Perşembe · Çorba: Ezogelin çorbası" });
    await tile.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").getByRole("button", { name: "Plandan çıkar" }).click();
    await expect(page.getByRole("button", { name: "Perşembe · Çorba ekle" })).toBeVisible();
  });
});

test.describe("category-locked drops (Round 3.5)", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "board DnD is the desktop layout");
    await page.clock.setFixedTime(NOW);
    await page.goto("/giris");
    await page.getByRole("button", { name: /Örnek evle dene/ }).click();
    await expect(page).toHaveURL(/\/bugun/);
    await page.goto("/hafta");
    await expect(page.getByRole("heading", { name: "10 – 16 Ekim" })).toBeVisible();
  });

  /** Pick up `source`, hover the day header of `day`, run `during`, drop. */
  async function dragToDay(page: import("@playwright/test").Page, source: import("@playwright/test").Locator, day: string, during?: () => Promise<void>) {
    await source.scrollIntoViewIfNeeded();
    const s = (await source.boundingBox())!;
    const target = page.getByRole("button", { name: new RegExp(`^${day}, .*gün seçenekleri`) });
    const t = (await target.boundingBox())!;
    await page.mouse.move(s.x + 12, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + 30, s.y + s.height / 2, { steps: 4 });
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + 120, { steps: 14 });
    if (during) await during();
    await page.mouse.up();
  }

  test("a recipe from the recipes list lands in its own slot; other slots are disabled while dragging", async ({ page }) => {
    const panel = page.getByRole("complementary");
    await panel.getByRole("searchbox", { name: "Tarif ara" }).fill("Sütlaç");
    const chip = panel.getByRole("button", { name: /^Sütlaç\. Plana sürükle/ });
    await dragToDay(page, chip, "Cuma", async () => {
      await expect(page.getByText("Buraya bırak")).toBeVisible();
      // Friday's main slot is shown disabled; the dessert slot is the one target.
      await expect(page.locator('[aria-disabled="true"]').filter({ has: page.getByRole("button", { name: "Cuma · Ana yemek ekle" }) })).toHaveCount(1);
    });
    await expect(page.getByRole("button", { name: "Cuma · Tatlı: Sütlaç" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Sütlaç → Cuma · Tatlı." })).toBeVisible();
  });

  test("a matched dish that gets displaced goes back to the matches", async ({ page }) => {
    const manti = page.getByRole("button", { name: /^Mantı, .*Plana sürükle/ });
    await dragToDay(page, manti, "Salı");
    await expect(page.getByRole("button", { name: "Salı · Ana yemek: Mantı" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Karnıyarık eşleşmelere döndü." })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Karnıyarık, Salıdan geri döndü\. Plana sürükle/ })).toBeVisible();
  });

  test("a dish added by hand leaves the day and stays in the recipes", async ({ page }) => {
    const makarna = page.getByRole("button", { name: /^Fırın makarna, .*Plana sürükle/ });
    await dragToDay(page, makarna, "Perşembe");
    await expect(page.getByRole("button", { name: "Perşembe · Ana yemek: Fırın makarna" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Tavuk sote günden çıktı; tariflerde duruyor." })).toBeVisible();
    // Other slots untouched.
    await expect(page.getByRole("button", { name: "Perşembe · Çorba: Ezogelin çorbası" })).toBeVisible();
    await page.getByRole("complementary").getByRole("searchbox", { name: "Tarif ara" }).fill("Tavuk sote");
    await expect(page.getByRole("button", { name: /^Tavuk sote\. Plana sürükle/ })).toBeVisible();
  });

  test("a recipe without a category asks for its slot once", async ({ page }) => {
    await page.goto("/tarifler");
    await page.getByRole("searchbox", { name: "Tarif ya da malzeme ara" }).fill("Annemin keki");
    await page.getByRole("button", { name: "“Annemin keki” ekle" }).click();
    await page.goto("/hafta");
    const search = page.getByRole("complementary").getByRole("searchbox", { name: "Tarif ara" });
    await search.fill("Annemin keki");
    await dragToDay(page, page.getByRole("button", { name: /^Annemin keki\. Plana sürükle/ }), "Cuma");
    const ask = page.getByRole("dialog", { name: "Annemin keki hangi bölüme girsin?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Tatlı" }).click();
    await expect(page.getByRole("button", { name: "Cuma · Tatlı: Annemin keki" })).toBeVisible();
    // Saved on the recipe: the next drop doesn't ask.
    await search.fill("Annemin keki");
    await dragToDay(page, page.getByRole("button", { name: /^Annemin keki\. Plana sürükle/ }), "Cumartesi");
    await expect(page.getByRole("button", { name: "Cumartesi · Tatlı: Annemin keki" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Enter on a recipe opens Güne ekle (no drag needed)", async ({ page }) => {
    const panel = page.getByRole("complementary");
    await panel.getByRole("searchbox", { name: "Tarif ara" }).fill("Revani");
    await panel.getByRole("button", { name: /^Revani\. Plana sürükle/ }).focus();
    await page.keyboard.press("Enter");
    const dlg = page.getByRole("dialog", { name: "Revani" });
    await dlg.getByRole("button", { name: /^Çarşamba/ }).click();
    await expect(page.getByRole("button", { name: "Çarşamba · Tatlı: Revani" })).toBeVisible();
  });
});
