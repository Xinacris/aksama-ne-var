import { expect, test, type Page } from "@playwright/test";

const NOW = new Date("2026-10-12T10:00:00+03:00");
const TIKTOK = "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567?is_from_webapp=1";

const DRAFT = {
  source: { platform: "tiktok", url: "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567", author: "@mutfakdefteri", title: "Pratik menemen tarifi", thumbnailUrl: null, needsPaste: false, hasText: true },
  draft: {
    name: "Biberli tava menemen",
    servings: 2,
    role: "ana",
    totalMinutes: 20,
    ingredients: [
      { amount: 4, unit: "adet", item: "Domates", side: "pazar", note: null },
      { amount: 3, unit: "adet", item: "Sivri biber", side: "pazar", note: null },
      { amount: 3, unit: "adet", item: "Yumurta", side: "market", note: null },
      { amount: null, unit: null, item: "Tuz", side: "market", note: null },
    ],
    steps: [
      { text: "Biberleri tereyağında 3 dakika soteleyin.", minutes: 3 },
      { text: "Domatesleri ekleyip suyunu çekene kadar pişirin.", minutes: null },
      { text: "Yumurtaları kırıp karıştırın.", minutes: null },
    ],
    prep: [],
  },
  path: "rules",
  needsPaste: false,
  message: null,
  counted: { platform: "tiktok", path: "rules" },
  llmAvailable: false,
};

async function demo(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}

test("import: TikTok link → draft → save → appears in Tarifler with credit", async ({ page }) => {
  await page.route("**/api/import", async (route) => {
    const body = route.request().postDataJSON() as { url: string; householdId: string };
    expect(body.url).toBe(TIKTOK);
    expect(body.householdId).not.toBe("");
    await route.fulfill({ json: DRAFT });
  });
  await demo(page);
  await page.goto("/tarifler");
  await page.getByRole("link", { name: "Linkten ekle" }).click();
  await expect(page).toHaveURL(/\/tarifler\/ice-aktar/);
  await page.getByLabel("Link").fill(TIKTOK);
  await page.getByRole("button", { name: "Taslağı çıkar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Taslağı kontrol et" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kaynak" })).toContainText("@mutfakdefteri");
  await expect(page.getByLabel("Tarifin adı")).toHaveValue("Biberli tava menemen");
  await page.getByRole("button", { name: "Tarifi kaydet" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Biberli tava menemen" })).toBeVisible();
  await expect(page.getByText("Kaynak: @mutfakdefteri · TikTok")).toBeVisible();
  await expect(page.getByRole("link", { name: "Videoyu aç" })).toHaveAttribute("href", DRAFT.source.url);

  await page.goto("/tarifler");
  await page.getByLabel("Tarif ya da malzeme ara").fill("biberli tava");
  await expect(page.getByRole("link", { name: "Biberli tava menemen" })).toBeVisible();

  await page.goto("/ayarlar");
  await expect(page.getByText("Bu ay 1 tarif içe aktarıldı.")).toBeVisible();
});

test("import: Instagram goes to the paste path, pasted caption gives a draft", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/import", async (route) => {
    calls++;
    const body = route.request().postDataJSON() as { text: string };
    if (!body.text) {
      await route.fulfill({
        json: {
          source: { platform: "instagram", url: "https://www.instagram.com/reel/C7xYz12AbCd/", author: null, title: null, thumbnailUrl: null, needsPaste: true, hasText: false },
          draft: null,
          path: null,
          needsPaste: true,
          message: "Instagram, gönderinin açıklamasını dışarıya vermiyor. Reels'in altındaki açıklamayı kopyalayıp aşağıya yapıştırırsan tarifi oradan çıkarırız.",
          counted: null,
        },
      });
    } else {
      await route.fulfill({ json: { ...DRAFT, source: { ...DRAFT.source, platform: "instagram", url: "https://www.instagram.com/reel/C7xYz12AbCd/", author: null } } });
    }
  });
  await demo(page);
  await page.goto("/tarifler/ice-aktar");
  await page.getByLabel("Link").fill("https://www.instagram.com/reel/C7xYz12AbCd/?igsh=abc");
  await page.getByRole("button", { name: "Taslağı çıkar" }).click();
  await expect(page.getByText(/Instagram, gönderinin açıklamasını/)).toBeVisible();
  const paste = page.getByLabel("Açıklamayı buraya yapıştır");
  await expect(paste).toBeFocused();
  await paste.fill("Menemen\n4 adet domates\n3 adet sivri biber\n3 adet yumurta");
  await page.getByRole("button", { name: "Taslağı çıkar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Taslağı kontrol et" })).toBeVisible();
  expect(calls).toBe(2);
});
