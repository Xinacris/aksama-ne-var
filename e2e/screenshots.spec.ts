import { expect, test, type Page } from "@playwright/test";

/** Pinned to the design's morning: "Pazartesi, 12 Ekim", before the kıyma reminder is done. */
const DESIGN_NOW = new Date("2026-10-12T08:45:00+03:00");
const only = process.env.SHOTS?.split(",");

async function shot(page: Page, project: string, name: string) {
  if (only && !only.includes(name)) return;
  await page.waitForTimeout(350);
  await page.screenshot({ path: `screenshots/${project}/${name}.png`, fullPage: true, animations: "disabled" });
}

async function demo(page: Page) {
  await page.clock.setFixedTime(DESIGN_NOW);
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}

test("screens", async ({ page }, info) => {
  const p = info.project.name;
  const routes: [string, string][] = [
    ["bugun", "/bugun"],
    ["eslesme", "/eslesme"],
    ["liste", "/liste"],
    ["hafta", "/hafta"],
    ["tarif", "/tarif/izmir-kofte?gun=today"],
    ["tarifler", "/tarifler"],
    ["tarif-yeni", "/tarifler/yeni"],
    ["ayarlar", "/ayarlar"],
    ["akis", "/akis"],
  ];

  // Fresh account for onboarding (design shows an inviter without a partner yet).
  await page.clock.setFixedTime(DESIGN_NOW);
  await page.goto("/giris");
  await shot(page, p, "giris");
  await page.goto("/kayit");
  await shot(page, p, "kayit");
  await page.getByLabel("Adın").fill("Ali");
  await page.getByLabel("E-posta").fill(`ali-${Date.now()}@ornek.com`);
  await page.getByLabel("Şifre").fill("kofte123");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL(/\/onboarding\/1/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const n of ["Mercimek çorbası", "Kuru fasulye", "İzmir köfte", "Karnıyarık", "Menemen", "Pirinç pilavı", "Cacık"]) {
    await page.getByRole("button", { name: n, exact: true }).click();
  }
  await shot(page, p, "onboarding-1");
  await page.getByLabel("Yemek ara").fill("annemin dolması");
  await shot(page, p, "onboarding-1-bos");
  await page.getByLabel("Yemek ara").fill("");
  await page.getByRole("button", { name: /Devam et/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/2/);
  await expect(page.getByLabel("Davet linki")).not.toHaveValue("");
  await shot(page, p, "onboarding-2");
  await page.getByRole("button", { name: "Şimdilik tek başıma başla" }).click();
  await expect(page).toHaveURL(/\/bugun/);
  await shot(page, p, "bugun-bos");
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  await demo(page);
  for (const [name, url] of routes) {
    if (only && !only.includes(name)) continue;
    await page.goto(url);
    await page.locator("main").first().waitFor({ timeout: 10_000 }).catch(() => {});
    await shot(page, p, name);
  }
  if (!only || only.includes("eslesme-eslesti")) {
    await page.goto("/eslesme");
    await page.getByRole("button", { name: "Olur" }).click();
    await expect(page.getByRole("heading", { name: /dediniz!/ })).toBeVisible();
    await page.waitForTimeout(700);
    await shot(page, p, "eslesme-eslesti");
  }
  if (!only || only.includes("ice-aktar") || only.includes("ice-aktar-taslak")) {
    await page.goto("/tarifler/ice-aktar");
    await shot(page, p, "ice-aktar");
    await page.route("**/api/import", (route) =>
      route.fulfill({
        json: {
          source: { platform: "tiktok", url: "https://www.tiktok.com/@mutfakdefteri/video/1", author: "@mutfakdefteri", title: "Pratik menemen tarifi", thumbnailUrl: null, needsPaste: false, hasText: true },
          draft: {
            name: "Pratik menemen",
            servings: 2,
            role: "ana",
            totalMinutes: 20,
            ingredients: [
              { amount: 4, unit: "adet", item: "Domates", side: "pazar", note: null },
              { amount: 3, unit: "adet", item: "Sivri biber", side: "pazar", note: null },
              { amount: 3, unit: "adet", item: "Yumurta", side: "market", note: null },
            ],
            steps: [{ text: "Biberleri tereyağında 3 dakika soteleyin.", minutes: 3 }],
            prep: [],
          },
          path: "llm",
          needsPaste: false,
          message: null,
          counted: null,
        },
      }),
    );
    await page.getByLabel("Link").fill("https://www.tiktok.com/@mutfakdefteri/video/1");
    await page.getByRole("button", { name: "Taslağı çıkar" }).click();
    await expect(page.getByRole("heading", { name: "Taslağı kontrol et" })).toBeVisible();
    await shot(page, p, "ice-aktar-taslak");
  }
  await page.goto("/ev/k7m2-tq");
  await shot(page, p, "davet");
});
