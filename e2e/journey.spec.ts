import { expect, test, type Page } from "@playwright/test";

/** Monday 12 October 2026, 10:00 in Istanbul — the design's day. */
const NOW = new Date("2026-10-12T10:00:00+03:00");
const TODAY = "2026-10-12";
const TOMORROW = "2026-10-13";

async function signUp(page: Page, name: string, email: string) {
  await page.getByLabel("Adın").fill(name);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("kofte123");
}

test("two members: invite → join → swipe → match → plan → live list → reminders → changes → recipes → persistence → reset", async ({
  page: ali,
  context,
}) => {
  test.setTimeout(180_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ali.clock.setFixedTime(NOW);

  // ── Ali signs up and onboards ──
  await ali.goto("/kayit");
  await signUp(ali, "Ali", "ali@ornek.com");
  await ali.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(ali).toHaveURL(/\/onboarding\/1/);
  await expect(ali.getByRole("heading", { name: "Evde en sık yaptığınız yemekler hangileri?" })).toBeVisible();
  for (const n of ["Karnıyarık", "İzmir köfte", "Mercimek çorbası"]) await ali.getByRole("button", { name: n, exact: true }).click();
  await expect(ali.getByRole("status").filter({ hasText: "yemek" })).toContainText("3 yemek");
  // unknown dish becomes a stub recipe
  await ali.getByLabel("Yemek ara").fill("Annemin dolması");
  await ali.getByRole("button", { name: "“Annemin dolması” olarak ekle" }).click();
  await expect(ali.getByRole("status").filter({ hasText: "yemek" })).toContainText("4 yemek");
  await ali.getByRole("button", { name: /Devam et/ }).click();

  await expect(ali).toHaveURL(/\/onboarding\/2/);
  const linkInput = ali.getByLabel("Davet linki");
  await expect(linkInput).toHaveValue(/\/ev\/[a-z0-9]{4}-[a-z0-9]{2}$/);
  const display = await linkInput.inputValue();
  const code = display.split("/ev/")[1];
  await ali.getByRole("button", { name: "Kopyala" }).click();
  await expect(ali.getByRole("button", { name: "Kopyalandı" })).toBeVisible();
  await expect(ali.getByRole("link", { name: /WhatsApp ile gönder/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=Ak%C5%9Fama/);
  await ali.getByRole("button", { name: "Şimdilik tek başıma başla" }).click();
  await expect(ali).toHaveURL(/\/bugun/);

  // ── Zeynep joins from a second tab of the same browser ──
  const zeynep = await context.newPage();
  await zeynep.clock.setFixedTime(NOW);
  await zeynep.goto(`/ev/${code}`);
  // the new tab inherits Ali's login; switch account for this tab only
  await zeynep.getByRole("button", { name: "Farklı bir hesapla katıl" }).click();
  await expect(zeynep.getByRole("heading", { name: "Ali seni evine çağırıyor" })).toBeVisible();
  await expect(zeynep.getByRole("complementary", { name: "Evin sık yaptıkları" })).toContainText("Karnıyarık");
  await signUp(zeynep, "Zeynep", "zeynep@ornek.com");
  await zeynep.getByRole("button", { name: "Hesap oluştur ve katıl" }).click();
  await expect(zeynep).toHaveURL(/\/onboarding\/1\?katil=1/);
  await expect(zeynep.getByText("bunları seçmiş")).toBeVisible();
  await expect(zeynep.getByRole("button", { name: "Karnıyarık", exact: true })).toHaveAttribute("aria-pressed", "true");
  await zeynep.getByRole("button", { name: /Başlayalım/ }).click();
  await expect(zeynep).toHaveURL(/\/bugun/);

  // Ali's tab updates live: two avatars in the household
  await expect(ali.getByRole("link", { name: /Ev halkı: Ali ve Zeynep/ }).first()).toBeAttached();

  // ── Both swipe the same deck for tomorrow ──
  const deck = `/eslesme?gun=${TOMORROW}&slot=ana`;
  await ali.goto(deck);
  await zeynep.goto(deck);
  await expect(zeynep.getByText(/Ali 12 kartın 0'ını kaydırdı/)).toBeVisible();
  const first = await ali.getByRole("article").getAttribute("aria-label");
  expect(await zeynep.getByRole("article").getAttribute("aria-label")).toBe(first);
  await ali.keyboard.press("ArrowRight"); // keyboard like
  await expect(zeynep.getByText(/Ali 12 kartın 1'ini kaydırdı/)).toBeVisible();
  await zeynep.getByRole("button", { name: "Olur" }).click();
  const momentTitle = /İkiniz de annemin dolması dediniz!/;
  await expect(zeynep.getByRole("heading", { name: momentTitle })).toBeVisible();
  // the match moment also appears live in Ali's tab
  await expect(ali.getByRole("heading", { name: momentTitle })).toBeVisible();
  await zeynep.getByRole("button", { name: "Salı akşamına koy" }).click();
  await expect(zeynep.getByRole("alert").or(zeynep.getByRole("status")).filter({ hasText: "kondu" }).first()).toBeVisible();
  await ali.getByRole("button", { name: "Kaydırmaya devam" }).click();

  // ── Plan tonight from Hafta (the matched stub has no ingredients yet) ──
  await ali.goto("/hafta");
  await ali.getByRole("button", { name: "Pazartesi · Ana yemek ekle" }).click();
  await ali.getByRole("dialog").getByRole("button", { name: /^İzmir köfte/ }).first().click();
  await expect(ali.getByRole("dialog")).toBeHidden();

  // ── The list is generated; Ali checks an item, Zeynep sees it live ──
  await ali.goto("/liste");
  await zeynep.goto("/liste");
  await expect(zeynep.getByText("Ali de markette.")).toBeVisible({ timeout: 15_000 });
  const marketTab = ali.getByRole("tab", { name: /Market/ });
  if (await marketTab.isVisible()) await marketTab.click();
  const firstRow = ali.locator('main ul li button[aria-pressed="false"]').first();
  const rowName = (await firstRow.getAttribute("aria-label"))!.split(",")[0];
  const row = ali.getByRole("button", { name: new RegExp(`^${rowName},`) }).first();
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  const zTab = zeynep.getByRole("tab", { name: /Market/ });
  if (await zTab.isVisible()) await zTab.click();
  await expect(zeynep.getByText("Ali aldı · az önce")).toBeVisible();
  await expect(zeynep.getByRole("button", { name: new RegExp(`^${rowName}.*Ali aldı`) })).toHaveAttribute("aria-pressed", "true");
  // finish shopping on Zeynep's side: the bought item moves to "evde var"
  await zeynep.getByRole("button", { name: "Alışverişi bitir" }).click();
  await expect(zeynep.getByText(/“evde var”a geçti/)).toBeVisible();
  await expect(zeynep.getByRole("button", { name: new RegExp(`^${rowName},`) })).toHaveCount(0);

  // ── Bugün shows the reminder for tonight ──
  await ali.goto("/bugun");
  const banner = ali.getByRole("region", { name: "Günün hatırlatması" });
  await expect(banner).toContainText("Akşama İzmir köfte var");
  await banner.getByRole("button", { name: "Çıkardım" }).click();
  await expect(banner.getByRole("status")).toContainText("Ali tamamladı · 10:00");
  await banner.getByRole("button", { name: "Geri al" }).click();
  await expect(banner).toContainText("Bekliyor");
  await expect(ali.getByText("Zeynep'in onayı bekleniyor").first()).toBeVisible();

  // ── Plan changed: swap with tomorrow, then eat out ──
  await ali.getByRole("button", { name: "Plan değişti" }).click();
  await ali.getByRole("button", { name: /Yarınla yer değiştir/ }).click();
  await expect(ali.getByRole("heading", { name: / sofrası$/ })).not.toHaveText("İzmir köfte sofrası");
  await ali.getByRole("button", { name: "Bugün dışarıda yedik" }).click();
  await expect(ali.getByRole("heading", { name: "Bu akşam dışarıdasınız" })).toBeVisible();
  // tomorrow now has İzmir köfte
  await expect(ali.getByRole("link", { name: /Yarın: İzmir köfte/ })).toBeVisible();

  // ── Recipe detail ──
  await ali.goto(`/tarif/izmir-kofte?gun=${TOMORROW}`);
  await expect(ali.getByRole("heading", { level: 1, name: "İzmir köfte sofrası" })).toBeVisible();
  await expect(ali.getByRole("region", { name: "Ön hazırlık" })).toContainText("Kıymayı buzluktan çıkar");
  await expect(ali.getByRole("region", { name: "Malzemeler" })).toContainText("Kimyon, karabiber, tuz");

  // ── Add a custom recipe ──
  await ali.goto("/tarifler/yeni");
  await ali.getByLabel("Tarifin adı").fill("Fırında mücver");
  await ali.getByLabel("Malzeme", { exact: true }).fill("Kabak");
  await ali.getByLabel("Miktar", { exact: true }).fill("3");
  await ali.getByLabel("1. adım", { exact: true }).fill("Kabakları rendele, suyunu sık, yumurta ve unla karıştırıp fırınla.");
  await ali.getByRole("button", { name: "Tarifi kaydet" }).click();
  await expect(ali.getByRole("heading", { level: 1, name: "Fırında mücver" })).toBeVisible();

  // ── Log out and back in: data persists ──
  await ali.goto("/ayarlar");
  await ali.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(ali).toHaveURL(/\/giris/);
  await ali.getByLabel("E-posta").fill("ali@ornek.com");
  await ali.getByLabel("Şifre").fill("kofte123");
  await ali.getByRole("button", { name: "Giriş yap" }).click();
  await expect(ali).toHaveURL(/\/bugun/);
  await ali.goto("/tarifler");
  await ali.getByLabel("Tarif ya da malzeme ara").fill("mücver");
  await expect(ali.getByRole("link", { name: "Fırında mücver" })).toBeVisible();

  // ── Reset all data ──
  await ali.goto("/ayarlar");
  await ali.getByRole("button", { name: "Tüm verileri sıfırla" }).click();
  await ali.getByRole("button", { name: "Evet, hepsini sil" }).click();
  await expect(ali).toHaveURL(/\/giris/);
  await ali.goto("/bugun");
  await expect(ali).toHaveURL(/\/giris/);
  void TODAY;
});
