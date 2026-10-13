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
  await expect(ali.getByRole("heading", { level: 1, name: "Hazırlık" })).toBeVisible();
  await ali.getByRole("list", { name: "Malzemeler" }).getByRole("button", { name: /Kıyma/ }).click();
  await ali.getByRole("button", { name: "Pişirmeye başla" }).click();
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

  // Leftover question pre-selected from the recipe default (İzmir köfte: saklanır 2 gün)
  const card = ali.getByRole("region", { name: "Artan yemek" });
  await expect(card.getByRole("button", { name: "Dolaba kaldır" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Hiç kalmadı" }).click();
  await expect(card.getByRole("button", { name: "Hiç kalmadı" })).toHaveAttribute("aria-pressed", "true");

  // Back on Bugün: cooked, the choice is applied — and Zeynep sees the same
  await ali.getByRole("link", { name: "Bugün'e dön" }).click();
  await expect(ali.getByText("Pişti · afiyet olsun")).toBeVisible();
  await expect(ali.getByRole("group", { name: "Artan oldu mu?" }).getByRole("button", { name: "Hiç kalmadı" })).toHaveAttribute("aria-pressed", "true");
  await expect(zeynep.getByText("Pişti · afiyet olsun")).toBeVisible();
  await expect(zeynep.getByText(/Ali pişiriyor/)).toHaveCount(0);

  // Tomorrow: no lunch, nothing dolapta from tonight
  await ali.clock.setFixedTime(new Date("2026-10-13T10:00:00+03:00"));
  await ali.goto("/bugun");
  await expect(ali.getByRole("region", { name: "Artan yemek" })).toContainText("Dünkü İzmir köfte: artan yok.");
});
