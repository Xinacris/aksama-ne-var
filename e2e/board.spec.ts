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
