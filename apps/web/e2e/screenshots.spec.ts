import { expect, test, type Page } from "@playwright/test";

/** Pinned to the design's morning: "Pazartesi, 12 Ekim", before the kıyma reminder is done. */
const DESIGN_NOW = new Date("2026-10-12T08:45:00+03:00");
const only = process.env.SHOTS?.split(",");

async function shot(page: Page, project: string, name: string, fullPage = true) {
  if (only && !only.includes(name)) return;
  await page.waitForTimeout(350);
  await page.screenshot({ path: `screenshots/${project}/${name}.png`, fullPage, animations: "disabled" });
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
  await page.getByLabel("E-posta", { exact: true }).fill(`ali-${Date.now()}@ornek.com`);
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
  if (!only || only.includes("tarif-yeni-select")) {
    // Recipe form with a select opened. The native popup is drawn outside the page, so the
    // select is expanded in place (size=N): the same option colours, captured in the shot.
    await page.goto("/tarifler/yeni");
    await page.getByText("Kaynak ve artarsa").click();
    await page.getByRole("radio", { name: "Saklanır" }).click();
    const sel = page.getByLabel("Öğün");
    await sel.evaluate((el: HTMLSelectElement) => {
      el.size = el.options.length;
      el.style.height = "auto";
      el.focus();
    });
    await sel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    if (!only || only.includes("tarif-yeni-select")) await page.screenshot({ path: `screenshots/${p}/tarif-yeni-select.png`, animations: "disabled" });
  }
  if (!only || only.some((n) => n.startsWith("tarifler-") || n.startsWith("tarif-yeni-"))) {
    // Round 2.2: the quick-add sheet (name and link), a name-only recipe, the bulk-paste box.
    await page.goto("/tarifler");
    await page.getByRole("button", { name: "Yeni tarif" }).click();
    const sheet = page.getByRole("dialog", { name: "Yeni tarif" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(250);
    await shot(page, p, "tarifler-hizli-ekle", false); // a sheet: the screen as seen, not the 100-recipe page
    await sheet.getByLabel("Link yapıştır ya da yemeğin adını yaz").fill("https://www.instagram.com/reel/C9xyz123/");
    await shot(page, p, "tarifler-hizli-ekle-link", false);
    await sheet.getByLabel("Link yapıştır ya da yemeğin adını yaz").fill("Annemin dolması");
    await sheet.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByRole("link", { name: "Ayrıntıları ekle" })).toBeVisible();
    await shot(page, p, "tarifler-hizli-kaydedildi");
    await page.goto("/tarifler/yeni");
    await page.getByRole("region", { name: "Malzemeler" }).getByRole("button", { name: "Toplu yapıştır" }).click();
    await page.getByLabel("Her satıra bir malzeme").fill("2 su bardağı un\n1 tatlı kaşığı tuz\n3 yumurta\n1,5 su bardağı süt\n1 paket kabartma tozu");
    await shot(page, p, "tarif-yeni-toplu");
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
          provider: "gemini",
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
  if (!only || only.some((n) => n.startsWith("pisir"))) {
    await page.goto("/pisir/2026-10-12");
    await expect(page.getByRole("heading", { name: "Başlamadan önce" })).toBeVisible();
    await shot(page, p, "pisir-hazirlik");
    await page.getByRole("button", { name: "Yine de başla" }).click();
    await page.getByRole("button", { name: "Malzemeler" }).click();
    await expect(page.getByRole("dialog", { name: "Malzemeler" })).toBeVisible();
    await page.waitForTimeout(200);
    await shot(page, p, "pisir-malzemeler");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Sonraki" }).click();
    await page.getByRole("tab", { name: /İzmir köfte/ }).click();
    await page.getByRole("button", { name: "Sonraki" }).click();
    await page.waitForTimeout(300);
    await shot(page, p, "pisir-adim");
    if (!only || only.includes("pisir-zamanlayici")) {
      await page.getByRole("button", { name: "Önceki" }).click();
      await page.getByRole("button", { name: /^Zamanlayıcı başlat/ }).click();
      await page.getByRole("tab", { name: /Mercimek/ }).click();
      await page.getByRole("button", { name: "Sonraki" }).click();
      await page.getByRole("button", { name: "Sonraki" }).click();
      await page.getByRole("button", { name: /^Zamanlayıcı başlat/ }).click();
      await page.waitForTimeout(300);
      await shot(page, p, "pisir-zamanlayici");
    }
    if (!only || only.includes("bugun-pisiyor")) {
      await page.goto("/bugun");
      await shot(page, p, "bugun-pisiyor");
    }
    if (!only || only.includes("pisir-bitti")) {
      await page.goto("/pisir/2026-10-12");
      for (const tab of [/Mercimek/, /İzmir köfte/, /Pirinç pilavı/, /Çoban salata/]) {
        await page.getByRole("tab", { name: tab }).click();
        while (await page.getByRole("button", { name: "Sonraki" }).isVisible()) await page.getByRole("button", { name: "Sonraki" }).click();
      }
      await page.getByRole("button", { name: "Bitti" }).click();
      await expect(page.getByRole("heading", { name: "Afiyet olsun" })).toBeVisible();
      await page.waitForTimeout(300);
      await shot(page, p, "pisir-bitti");
    }
  }
  await page.goto("/ev/k7m2-tq");
  await shot(page, p, "davet");
});
