import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const NOW = new Date("2026-10-12T10:00:00+03:00");

async function audit(page: Page, label: string) {
  await page.locator("main").first().waitFor();
  await page.waitForTimeout(300);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${label} axe violations`).toEqual([]);
}

test.describe("accessibility (axe)", () => {
  test("public screens", async ({ page }) => {
    await page.goto("/giris");
    await audit(page, "giris");
    await page.goto("/kayit");
    await audit(page, "kayit");
    await page.goto("/ev/yok-00");
    await audit(page, "davet-yok");
  });

  test("onboarding", async ({ page }) => {
    await page.goto("/kayit");
    await page.getByLabel("Adın").fill("Ali");
    await page.getByLabel("E-posta", { exact: true }).fill("ali@ornek.com");
    await page.getByLabel("Şifre").fill("kofte123");
    await page.getByRole("button", { name: "Hesap oluştur" }).click();
    await expect(page.getByRole("heading", { name: /en sık yaptığınız/ })).toBeVisible();
    await audit(page, "onboarding-1");
    await page.getByRole("button", { name: /Devam et/ }).click();
    await expect(page.getByRole("heading", { name: "Evde neler var?" })).toBeVisible();
    await page.getByRole("button", { name: "Yumurta", exact: true }).click();
    await audit(page, "onboarding-evde");
    await page.getByRole("button", { name: /^Devam/ }).click();
    await expect(page.getByLabel("Davet linki")).toBeVisible();
    await audit(page, "onboarding-2");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`main screens (${scheme})`, async ({ page }) => {
      // One long walk over ~15 screens with axe on each: ~50 s on its own, more under load.
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme });
      await page.clock.setFixedTime(NOW);
      await page.goto("/giris");
      await page.getByRole("button", { name: /Örnek evle dene/ }).click();
      await expect(page).toHaveURL(/\/bugun/);
      for (const url of ["/bugun", "/eslesme", "/liste", "/hafta", "/tarif/izmir-kofte?gun=today", "/tarifler", "/tarifler/yeni", "/tarifler/ice-aktar", "/ayarlar", "/akis"]) {
        await page.goto(url);
        await audit(page, `${url} ${scheme}`);
      }
      // Recipe form with the leftover chips on "Saklanır" (shows "Kaç gün içinde")
      await page.goto("/tarifler/yeni");
      for (const t of ["Süre, porsiyon, etiketler", "Ön hazırlık", "Kaynak ve artarsa"]) await page.getByText(t, { exact: true }).click();
      await page.getByRole("radio", { name: "Saklanır" }).click();
      await expect(page.getByLabel("Kaç gün içinde")).toBeVisible();
      await audit(page, `tarif-yeni saklanır ${scheme}`);
      // Round 2.2: quick-add sheet, a name-only recipe, bulk paste and the split offer
      await page.goto("/tarifler");
      await page.getByRole("button", { name: "Yeni tarif" }).click();
      await page.getByLabel("Link yapıştır ya da yemeğin adını yaz").fill("Annemin dolması");
      await audit(page, `hizli-ekle ${scheme}`);
      await page.getByRole("button", { name: "Kaydet" }).click();
      await expect(page.getByRole("link", { name: "Ayrıntıları ekle" })).toBeVisible();
      await audit(page, `hizli-kaydedildi ${scheme}`);
      await page.goto("/tarifler/yeni");
      await page.getByRole("region", { name: "Malzemeler" }).getByRole("button", { name: "Toplu yapıştır" }).click();
      await page.getByLabel("Her satıra bir malzeme").fill("2 su bardağı un\n3 yumurta");
      await page.getByLabel("1. adım", { exact: true }).focus();
      await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.setData("text/plain", "1. Soğanı doğrayın.\n2. Kavurun.");
        document.activeElement!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      });
      await expect(page.getByRole("group", { name: "Yapıştırılan satırlar" })).toBeVisible();
      await audit(page, `toplu-yapistir ${scheme}`);
      // Cooking mode: "Başlamadan önce", the Malzemeler sheet, a step with a running timer, the finish screen
      await page.goto("/pisir/2026-10-12");
      await expect(page.getByRole("heading", { name: "Başlamadan önce" })).toBeVisible();
      await audit(page, `pisir-hazirlik ${scheme}`);
      await page.getByRole("button", { name: "Yine de başla" }).click();
      await page.getByRole("button", { name: "Malzemeler" }).click();
      await expect(page.getByRole("dialog", { name: "Malzemeler" })).toBeVisible();
      await audit(page, `pisir-malzemeler ${scheme}`);
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: /İzmir köfte/ }).click();
      await page.getByRole("button", { name: /^Zamanlayıcı başlat/ }).click();
      await expect(page.getByRole("button", { name: /Adım 1: duraklat$/ })).toBeVisible();
      await audit(page, `pisir-adim ${scheme}`);
      await page.getByRole("button", { name: "Sonraki" }).click();
      await expect(page.getByRole("region", { name: "Diğer zamanlayıcılar" })).toBeVisible();
      await audit(page, `pisir-diger-zamanlayicilar ${scheme}`);
      await page.goto("/bugun");
      await audit(page, `bugun-pisiyor ${scheme}`);
      await page.goto("/pisir/menemen");
      await page.getByRole("button", { name: "Yine de başla" }).click();
      while (await page.getByRole("button", { name: "Sonraki" }).isVisible()) await page.getByRole("button", { name: "Sonraki" }).click();
      await page.getByRole("button", { name: "Bitti" }).click();
      await expect(page.getByRole("heading", { name: "Afiyet olsun" })).toBeVisible();
      await audit(page, `pisir-bitti ${scheme}`);

      await page.goto("/eslesme");
      await page.getByRole("button", { name: "Olur" }).click();
      await expect(page.getByRole("heading", { name: /dediniz!/ })).toBeVisible();
      await audit(page, `eslesme-eslesti ${scheme}`);
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`main screens in English (${scheme})`, async ({ browser }, info) => {
      const context = await browser.newContext({ locale: "en-GB", colorScheme: scheme, viewport: info.project.use.viewport, hasTouch: info.project.use.hasTouch });
      const page = await context.newPage();
      await page.clock.setFixedTime(NOW);
      await page.goto("/giris");
      await audit(page, `en giris ${scheme}`);
      await page.getByRole("button", { name: /Try the sample home/ }).click();
      await expect(page).toHaveURL(/\/bugun/);
      for (const url of ["/bugun", "/eslesme", "/liste", "/hafta", "/tarif/izmir-kofte?gun=today", "/tarifler", "/tarifler/yeni", "/ayarlar", "/pisir/2026-10-12"]) {
        await page.goto(url);
        await audit(page, `en ${url} ${scheme}`);
      }
      await context.close();
    });
  }
});
