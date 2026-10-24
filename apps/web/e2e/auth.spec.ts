import { expect, test } from "@playwright/test";

test.describe("auth & protected routes", () => {
  test("anonymous visitors are sent to log in", async ({ page }) => {
    await page.goto("/bugun");
    await expect(page).toHaveURL(/\/giris\?next=%2Fbugun/);
    await expect(page.getByRole("heading", { name: "Tekrar hoş geldin" })).toBeVisible();
  });

  test("sign up lands in onboarding; wrong password is refused calmly", async ({ page }) => {
    await page.goto("/kayit");
    await page.getByLabel("Adın").fill("Ali");
    await page.getByLabel("E-posta", { exact: true }).fill("ali@ornek.com");
    await page.getByLabel("Şifre").fill("kofte123");
    await page.getByRole("button", { name: "Hesap oluştur" }).click();
    await expect(page).toHaveURL(/\/onboarding\/1/);

    // log out by clearing the session, then try a wrong password
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem("anv:lastSession");
    });
    await page.goto("/giris");
    await page.getByLabel("E-posta", { exact: true }).fill("ali@ornek.com");
    await page.getByLabel("Şifre").fill("yanlis");
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page.getByText(/E-posta ya da şifre eşleşmedi/)).toBeVisible();
  });

  test("an unknown invite link shows a calm empty state", async ({ page }) => {
    await page.goto("/ev/yok-00");
    await expect(page.getByRole("heading", { name: "Bu davet bir eve ait görünmüyor" })).toBeVisible();
  });

  test("demo household opens straight into the app", async ({ page }) => {
    await page.goto("/giris");
    await page.getByRole("button", { name: /Örnek evle dene/ }).click();
    await expect(page).toHaveURL(/\/bugun/);
  });

  test("Google / Apple / e-posta are shown as Yakında and do nothing; the local flow continues (Round 3.5)", async ({ page }) => {
    await page.goto("/giris");
    const providers = page.getByTestId("auth-providers");
    for (const name of ["Google ile giriş yap (yakında)", "Apple ile giriş yap (yakında)", "E-posta ile giriş yap (yakında)"]) {
      const b = providers.getByRole("button", { name });
      await expect(b).toHaveAttribute("aria-disabled", "true");
      await expect(b).toBeDisabled();
      await b.click({ force: true });
    }
    await expect(page).toHaveURL(/\/giris$/);
    await page.getByRole("link", { name: "Giriş yapmadan devam et" }).click();
    await expect(page).toHaveURL(/\/kayit/);
    await expect(page.getByRole("heading", { name: "Giriş yapmadan devam et" })).toBeVisible();
    await expect(page.getByTestId("auth-providers")).toBeVisible();
  });
});
