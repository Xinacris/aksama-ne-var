import { expect, test, type Page } from "@playwright/test";

/** Round 2.2: Tarifler on phones (bottom nav, quick add, toplu yapıştır). Mobile project only. */
const NOW = new Date("2026-10-12T10:00:00+03:00");

async function demo(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}

const tabs = (page: Page) => page.getByRole("navigation", { name: "Ana gezinme" }).last().getByRole("link");

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "mobile", "bottom nav is the phone layout");
});

for (const width of [360, 390]) {
  test(`bottom nav at ${width} px: five tabs, one line each, badge inside its tab, 44 px+ targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await demo(page);
    await expect(tabs(page)).toHaveText([/^Bugün/, /^Eşleş/, /^Liste/, /^Tarifler/, /^Hafta/]);
    const boxes = [];
    for (const t of await tabs(page).all()) {
      const box = (await t.boundingBox())!;
      boxes.push(box);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      // One line: the label's own line box is a single line high.
      const lines = await t.evaluate((el) => {
        const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())!;
        const r = document.createRange();
        r.selectNodeContents(text);
        return r.getClientRects().length;
      });
      expect(lines).toBe(1);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 0.5);
    expect(boxes[4].x + boxes[4].width).toBeLessThanOrEqual(width);
    const badge = tabs(page).nth(2).getByLabel(/ürün kaldı/);
    if (await badge.count()) {
      const b = (await badge.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(boxes[2].x + boxes[2].width);
      expect(b.x).toBeGreaterThanOrEqual(boxes[2].x);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("Tarifler tab opens the recipe list and stays lit on a recipe", async ({ page }) => {
  await demo(page);
  await tabs(page).filter({ hasText: "Tarifler" }).click();
  await expect(page).toHaveURL(/\/tarifler$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tarifler" })).toBeVisible();
  await expect(tabs(page).filter({ hasText: "Tarifler" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "İzmir köfte" }).click();
  await expect(page).toHaveURL(/\/tarif\/izmir-kofte/);
  await expect(tabs(page).filter({ hasText: "Tarifler" })).toHaveAttribute("aria-current", "page");
});
