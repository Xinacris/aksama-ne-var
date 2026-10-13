import { expect, test } from "@playwright/test";

const EVENING = new Date("2026-10-12T18:00:00+03:00");

test("Bugün → Pişirmeye başla → steps → timer (fake clock, reload) → finish → leftover choice", async ({ page: ali, context }) => {
  test.setTimeout(120_000);
  await ali.clock.install({ time: EVENING });
  await ali.goto("/giris");
  await ali.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(ali).toHaveURL(/\/bugun/);

  // Zeynep in a second tab of the same browser
  const zeynep = await context.newPage();
  await zeynep.clock.install({ time: EVENING });
  await zeynep.goto("/giris?cikis=1");
  await zeynep.getByLabel("E-posta").fill("zeynep@demo.ev");
  await zeynep.getByLabel("Şifre").fill("demo1234");
  await zeynep.getByRole("button", { name: "Giriş yap" }).click();
  await expect(zeynep).toHaveURL(/\/bugun/);

  // Ali starts cooking from tonight's card
  await ali.getByRole("link", { name: "Pişirmeye başla" }).click();
  await expect(ali).toHaveURL(/\/pisir\/2026-10-12/);
  // Prep-ahead tasks are still open tonight, so the heads-up shows first
  await expect(ali.getByRole("heading", { level: 1, name: "Başlamadan önce" })).toBeVisible();
  await expect(ali.getByRole("region", { name: "Önceden yapılacaklar" })).toContainText("Köfte harcını yoğur");
  await ali.getByRole("button", { name: "Yine de başla" }).click();
  await expect(ali.getByRole("tablist", { name: "Yemekler" })).toBeVisible();

  // Zeynep sees it live, with the activity line
  await expect(zeynep.getByText(/^Ali pişiriyor · adım 1\//)).toBeVisible();
  await expect(zeynep.getByText("bu akşamın menüsünü pişirmeye başladı").first()).toBeVisible();

  // Go through the soup with buttons and keys
  await ali.getByRole("button", { name: "Sonraki" }).click();
  await ali.keyboard.press("ArrowRight");
  await expect(ali.getByRole("heading", { level: 1 })).toContainText("Adım 3");
  await expect(zeynep.getByText(/^Ali pişiriyor · adım 3\//)).toBeVisible();

  // Köfte: start the 20-minute timer, it survives a reload
  await ali.getByRole("tab", { name: /İzmir köfte/ }).click();
  await ali.getByRole("button", { name: /^Zamanlayıcı başlat · 20 dk/ }).click();
  const bar = ali.getByRole("region", { name: "Zamanlayıcılar" });
  await expect(bar).toContainText("İzmir köfte");
  await ali.clock.fastForward("05:00");
  await ali.reload();
  await expect(ali.getByRole("region", { name: "Zamanlayıcılar" })).toContainText(/1[45]:\d\d/);

  // 15 more minutes: it rings with a visible banner
  await ali.clock.fastForward("15:05");
  await expect(ali.getByRole("alert", { name: "Zamanlayıcı uyarıları" })).toContainText("Süre doldu: İzmir köfte · 20 dk");
  await ali.getByRole("button", { name: "Tamam" }).click();
  await expect(ali.getByRole("alert", { name: "Zamanlayıcı uyarıları" })).toBeEmpty();

  // Finish every dish
  for (const tab of [/Mercimek/, /İzmir köfte/, /Pirinç pilavı/, /Çoban salata/]) {
    await ali.getByRole("tab", { name: tab }).click();
    while (await ali.getByRole("button", { name: "Sonraki" }).isVisible()) await ali.getByRole("button", { name: "Sonraki" }).click();
  }
  await ali.getByRole("button", { name: "Bitti" }).click();
  await expect(ali.getByRole("heading", { level: 1, name: "Afiyet olsun" })).toBeVisible();

  // Leftover question defaults to Artmaz ("Hiç kalmadı"); keeping it is an explicit tap
  const card = ali.getByRole("region", { name: "Artan yemek" });
  await expect(card.getByRole("button", { name: "Hiç kalmadı" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Dolaba kaldır" }).click();
  await expect(card.getByRole("button", { name: "Dolaba kaldır" })).toHaveAttribute("aria-pressed", "true");

  // Back on Bugün: cooked, the choice is applied — and Zeynep sees the same
  await ali.getByRole("link", { name: "Bugün'e dön" }).click();
  await expect(ali.getByText("Pişti · afiyet olsun")).toBeVisible();
  await expect(ali.getByRole("group", { name: "Artan oldu mu?" }).getByRole("button", { name: "Dolaba kaldır" })).toHaveAttribute("aria-pressed", "true");
  await expect(zeynep.getByText("Pişti · afiyet olsun")).toBeVisible();
  await expect(zeynep.getByText(/Ali pişiriyor/)).toHaveCount(0);

  // Tomorrow: the köfte Ali kept is dolapta (İzmir köfte keeps two days)
  await ali.clock.setFixedTime(new Date("2026-10-13T10:00:00+03:00"));
  await ali.goto("/bugun");
  await expect(ali.getByRole("region", { name: "Artan yemek" })).toContainText("Dünkü İzmir köfte dolapta.");
});

// ───────── "Başlamadan önce" only when something is missing ─────────

const FASULYE = "/tarif/kuru-fasulye";
// Kuru fasulye in the demo: dana kuşbaşı, soğan and salça are at home; these three are not.
const NEEDED = ["Kuru fasulye", "Biber salçası", "Tereyağı"];

async function demoAt(page: import("@playwright/test").Page) {
  await page.clock.install({ time: EVENING });
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}

/** Put what's missing on the list from the recipe page, then tick `buy` in Liste (as if bought). */
async function buy(page: import("@playwright/test").Page, names: string[]) {
  await page.goto(FASULYE);
  await page.getByRole("region", { name: "Malzemeler" }).getByRole("button", { name: "kuru fasulye listeye ekle" }).click();
  await page.goto("/liste");
  for (const n of names) {
    const row = page.getByRole("button", { name: new RegExp(`^${n},`) }).first();
    await row.click();
    await expect(row).toHaveAttribute("aria-pressed", "true");
  }
}

test("all ingredients bought → Pişirmeye başla opens step 1 directly", async ({ page }) => {
  await demoAt(page);
  await buy(page, NEEDED);
  await page.goto(FASULYE);
  await page.getByRole("link", { name: "Pişirmeye başla" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adım 1 /");
  await expect(page.getByRole("heading", { name: "Başlamadan önce" })).toHaveCount(0);
  // the full list is still one tap away
  await page.getByRole("button", { name: "Malzemeler" }).click();
  await expect(page.getByRole("dialog", { name: "Malzemeler" })).toContainText("Kuru fasulye");
});

test("one item missing → heads-up → Evde var → it disappears → Yine de başla → step 1", async ({ page }) => {
  await demoAt(page);
  await buy(page, NEEDED.filter((n) => n !== "Biber salçası"));
  await page.goto(FASULYE);
  await page.getByRole("link", { name: "Pişirmeye başla" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Başlamadan önce" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "eksik" })).toHaveText("1 eksik");
  const missing = page.getByRole("list", { name: "Eksik malzemeler" });
  await expect(missing.getByRole("listitem")).toHaveCount(1);
  await missing.getByRole("button", { name: "Biber salçası evde var" }).click();
  await expect(page.getByRole("list", { name: "Eksik malzemeler" })).toHaveCount(0);
  await expect(page.getByText("Hepsi tamam")).toBeVisible();
  await page.getByRole("button", { name: "Yine de başla" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adım 1 /");
});
