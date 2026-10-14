import { expect, test } from "@playwright/test";

/** `npm run screenshots` › the main screens in English (en-GB browser), demo household, design morning. */
const DESIGN_NOW = new Date("2026-10-12T08:45:00+03:00");
const only = process.env.SHOTS?.split(",");

test.use({ locale: "en-GB" });

test("screens in English", async ({ page }, info) => {
  const p = info.project.name;
  await page.clock.setFixedTime(DESIGN_NOW);
  await page.goto("/giris");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  if (!only || only.includes("en-giris")) await page.screenshot({ path: `screenshots/${p}/en-giris.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: /Try the sample home/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
  const routes: [string, string][] = [
    ["en-bugun", "/bugun"],
    ["en-eslesme", "/eslesme"],
    ["en-liste", "/liste"],
    ["en-hafta", "/hafta"],
    ["en-tarif", "/tarif/izmir-kofte?gun=today"],
    ["en-tarifler", "/tarifler"],
    ["en-tarif-yeni", "/tarifler/yeni"],
    ["en-ayarlar", "/ayarlar"],
    ["en-pisir", "/pisir/2026-10-12"],
  ];
  for (const [name, url] of routes) {
    if (only && !only.includes(name)) continue;
    await page.goto(url);
    await page.locator("main").first().waitFor({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(350);
    await page.screenshot({ path: `screenshots/${p}/${name}.png`, fullPage: true, animations: "disabled" });
  }
  if (!only || only.includes("en-hizli-ekle")) {
    await page.goto("/tarifler");
    await page.getByRole("button", { name: "New recipe" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/${p}/en-hizli-ekle.png`, animations: "disabled" });
  }
});
