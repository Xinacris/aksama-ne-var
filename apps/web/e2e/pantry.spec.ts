import { expect, test, type Page } from "@playwright/test";

/** "Evde ne var?" (Round 3.5): onboarding step, pantry screen, reminders. */

async function demo(page: Page, at: string) {
  await page.clock.setFixedTime(new Date(at));
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}

test("onboarding: pick what's at home (chips, search, free text), then it is on the pantry screen", async ({ page }) => {
  await page.goto("/kayit");
  await page.getByLabel("Adın").fill("Ali");
  await page.getByLabel("E-posta", { exact: true }).fill("ali@ornek.com");
  await page.getByLabel("Şifre").fill("kofte123");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL(/\/onboarding\/1/);
  await page.getByRole("button", { name: /Devam/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/evde/);
  await expect(page.getByRole("heading", { name: "Evde neler var?" })).toBeVisible();
  await expect(page.getByText("Adım 2 / 3")).toBeVisible();
  await page.getByRole("button", { name: "Yumurta", exact: true }).click();
  await page.getByRole("button", { name: "Kuru soğan", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Malzeme ara ya da yaz" });
  await search.fill("nohut");
  await page.getByRole("button", { name: "Nohut", exact: true }).click();
  await search.fill("Annemin salçası");
  await page.getByRole("button", { name: "“Annemin salçası” ekle" }).click();
  await expect(page.getByText("4 şey seçildi")).toBeVisible();
  await page.getByRole("button", { name: /^Devam/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/2/);
  await page.getByRole("button", { name: /Şimdilik tek başıma/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
  await page.goto("/evde");
  await expect(page.getByRole("heading", { name: "Evde ne var?" })).toBeVisible();
  await expect(page.getByText(/^Son güncelleme: /)).toBeVisible();
  for (const n of ["Yumurta", "Kuru soğan", "Nohut", "Annemin salçası"]) await expect(page.getByTestId(`pantry-row-${n}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Süt ve kahvaltılık/ })).toBeVisible();
});

test("onboarding: the pantry step can be skipped", async ({ page }) => {
  await page.goto("/kayit");
  await page.getByLabel("Adın").fill("Ayşe");
  await page.getByLabel("E-posta", { exact: true }).fill("ayse@ornek.com");
  await page.getByLabel("Şifre").fill("kofte123");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await page.getByRole("button", { name: /Devam/ }).click();
  await page.getByRole("button", { name: "Şimdilik geç" }).click();
  await expect(page).toHaveURL(/\/onboarding\/2/);
});

test("pantry screen: edit an amount, mark running low, remove; the list follows", async ({ page }) => {
  await demo(page, "2026-10-12T10:00:00+03:00");
  await page.goto("/liste");
  await page.getByRole("link", { name: /Evde ne var\?/ }).click();
  await expect(page).toHaveURL(/\/evde$/);
  const row = page.getByTestId("pantry-row-Kıyma");
  await row.getByRole("button", { name: "Kıyma: düzenle" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Miktar").fill("750");
  await dlg.getByRole("button", { name: "Kaydet" }).click();
  await expect(row).toContainText("750 g");
  await row.getByRole("button", { name: "Kıyma: az kaldı", exact: true }).click();
  await expect(row.getByRole("button", { name: "Kıyma: az kaldı", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/liste");
  await expect(page.getByRole("button", { name: /^Kıyma/ }).first()).toBeVisible();
  await page.goto("/evde");
  await page.getByTestId("pantry-row-Kıyma").getByRole("button", { name: "Kıyma: kaldır" }).click();
  await expect(page.getByTestId("pantry-row-Kıyma")).toHaveCount(0);
});

test("reminder: the evening before shows a banner; the quick check answers it for good", async ({ page }) => {
  await demo(page, "2026-10-13T21:00:00+03:00");
  const banner = page.getByTestId("pantry-banner");
  await expect(banner).toContainText("Yarın için evde ne var?");
  await banner.getByRole("link", { name: "Kontrol et" }).click();
  await expect(page).toHaveURL(/\/evde\/kontrol\?r=evening%3A2026-10-14/);
  const groups = page.getByRole("radiogroup");
  expect(await groups.count()).toBeGreaterThan(0);
  await groups.first().getByRole("radio", { name: "Var" }).click();
  await groups.nth(1).getByRole("radio", { name: "Yok" }).click();
  await page.getByRole("button", { name: "Bitti" }).click();
  await expect(page).toHaveURL(/\/evde$/);
  await expect(page.getByRole("status").filter({ hasText: "Teşekkürler; liste güncellendi." })).toBeVisible();
  // Answered: no evening banner any more (the week one may still ask).
  await page.reload();
  await expect(page.getByTestId("pantry-banner")).not.toContainText("Yarın için evde ne var?");
});

test("reminder: unanswered, it comes back the morning of the day; 'Sonra' hides it on this device", async ({ page }) => {
  await demo(page, "2026-10-14T09:00:00+03:00");
  const banner = page.getByTestId("pantry-banner");
  await expect(banner).toContainText("Bugün için evde ne var?");
  await banner.getByRole("button", { name: "Sonra" }).click();
  await expect(page.getByTestId("pantry-banner")).not.toContainText("Bugün için evde ne var?");
});

test("reminders off in Ayarlar: no banner", async ({ page }) => {
  await demo(page, "2026-10-13T21:00:00+03:00");
  await expect(page.getByTestId("pantry-banner")).toBeVisible();
  await page.goto("/ayarlar");
  await page.getByRole("group", { name: "Evde ne var hatırlatmaları" }).getByRole("button", { name: "Kapalı" }).click();
  await expect(page.getByTestId("pantry-banner")).toHaveCount(0);
});

test("quick check: names stay readable at phone width (#2)", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone width");
  await demo(page, "2026-10-13T21:00:00+03:00");
  await page.goto("/evde/kontrol?r=evening%3A2026-10-14");
  const groups = page.getByRole("radiogroup");
  expect(await groups.count()).toBeGreaterThan(1);
  for (let i = 0; i < (await groups.count()); i++) {
    const name = page.locator(`#${await groups.nth(i).getAttribute("aria-labelledby")}`.replace(/([^\w#-])/g, "\\$1"));
    const box = (await name.boundingBox())!;
    expect(box.width, "name column width").toBeGreaterThan(120);
    expect(box.height, "name fits on one or two lines").toBeLessThan(48);
  }
});

test("week check with nothing to tick leads to the pantry and can be answered (#3)", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T11:00:00+03:00"));
  await page.goto("/kayit");
  await page.getByLabel("Adın").fill("Deniz");
  await page.getByLabel("E-posta", { exact: true }).fill("deniz@ornek.com");
  await page.getByLabel("Şifre").fill("kofte123");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await page.getByRole("button", { name: /Devam/ }).click();
  await page.getByRole("button", { name: "Şimdilik geç" }).click();
  await page.getByRole("button", { name: /Şimdilik tek başıma/ }).click();
  const banner = page.getByTestId("pantry-banner");
  await expect(banner).toContainText("Bu hafta için evde ne var");
  await banner.getByRole("link", { name: "Kontrol et" }).click();
  await expect(page.getByRole("link", { name: "Evdekilere bak" })).toBeVisible();
  await page.getByRole("button", { name: "Tamam, baktım" }).click();
  await expect(page).toHaveURL(/\/evde$/);
  await expect(page.getByTestId("pantry-banner")).toHaveCount(0);
});

test("reminder banner: short dish names, main screens only (#4)", async ({ page }) => {
  await demo(page, "2026-10-13T21:00:00+03:00");
  await page.evaluate(() => localStorage.setItem("anv.locale", "en"));
  await page.reload();
  const banner = page.getByTestId("pantry-banner");
  await expect(banner).toContainText("Yayla");
  await expect(banner).not.toContainText("(yoghurt and rice soup)");
  await page.goto("/tarifler/yeni");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("pantry-banner")).toHaveCount(0);
});
