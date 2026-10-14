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

test("from Bugün: Tarifler → quick add by name → the recipe exists", async ({ page }) => {
  await demo(page);
  await tabs(page).filter({ hasText: "Tarifler" }).click();
  await page.getByRole("button", { name: "Yeni tarif" }).click();
  const sheet = page.getByRole("dialog", { name: "Yeni tarif" });
  const input = sheet.getByLabel("Link yapıştır ya da yemeğin adını yaz");
  await expect(input).toBeFocused();
  await input.fill("Annemin dolması");
  await sheet.getByRole("button", { name: "Kaydet" }).click();
  await expect(page).toHaveURL(/\/tarif\/[^/?]+\?yeni=1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Annemin dolması" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ayrıntıları ekle" })).toBeVisible();
  // It is in the book (and survives a reload).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Annemin dolması" })).toBeVisible();
  await tabs(page).filter({ hasText: "Tarifler" }).click();
  await page.getByLabel("Tarif ya da malzeme ara").fill("annemin");
  await expect(page.getByRole("link", { name: "Annemin dolması" })).toBeVisible();
  await expect(page.getByText(/ayrıntı bekliyor/)).toBeVisible();
});

test("quick add with a link lands on import", async ({ page }) => {
  await demo(page);
  await page.goto("/tarifler");
  await page.getByRole("button", { name: "Yeni tarif" }).click();
  const sheet = page.getByRole("dialog", { name: "Yeni tarif" });
  // Stub the import call: this test is about where the link goes, not the providers.
  await page.route("**/api/import", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ needsPaste: true, source: null }) }));
  await sheet.getByLabel("Link yapıştır ya da yemeğin adını yaz").fill("https://www.instagram.com/reel/C9xyz123/");
  await sheet.getByRole("button", { name: /Linkten içe aktar/ }).click();
  await expect(page).toHaveURL(/\/tarifler\/ice-aktar\?url=https%3A%2F%2Fwww\.instagram\.com%2Freel%2FC9xyz123%2F/);
  await expect(page.getByLabel("Link", { exact: true })).toHaveValue("https://www.instagram.com/reel/C9xyz123/");
});

test("search with no results adds the name with one tap", async ({ page }) => {
  await demo(page);
  await page.goto("/tarifler");
  await page.getByLabel("Tarif ya da malzeme ara").fill("Babaannemin keşkeği");
  await page.getByRole("button", { name: "“Babaannemin keşkeği” ekle" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Babaannemin keşkeği" })).toBeVisible();
});

test("Toplu yapıştır fills 5 ingredients, and the recipe saves with them", async ({ page }) => {
  await demo(page);
  await page.goto("/tarifler/yeni");
  await page.getByLabel("Tarifin adı").fill("Pankek");
  await page.getByRole("region", { name: "Malzemeler" }).getByRole("button", { name: "Toplu yapıştır" }).click();
  await page.getByLabel("Her satıra bir malzeme").fill("2 su bardağı un\n1 tatlı kaşığı tuz\n\n3 yumurta\n1,5 su bardağı süt\n1 paket kabartma tozu");
  await page.getByRole("button", { name: "Satırları ekle" }).click();
  const names = page.getByLabel("Malzeme", { exact: true });
  await expect(names).toHaveCount(5);
  await expect(names.first()).toHaveValue("Un");
  await expect(page.getByLabel("Miktar", { exact: true }).nth(3)).toHaveValue("1,5");
  await expect(page.getByLabel("Birim").first()).toHaveValue("su bardağı");
  await page.getByRole("button", { name: "Tarifi kaydet" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pankek" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Malzemeler" })).toContainText(/kabartma tozu/i);
});
