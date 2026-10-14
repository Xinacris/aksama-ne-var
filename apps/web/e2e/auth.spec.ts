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
    await page.getByLabel("E-posta").fill("ali@ornek.com");
    await page.getByLabel("Şifre").fill("kofte123");
    await page.getByRole("button", { name: "Hesap oluştur" }).click();
    await expect(page).toHaveURL(/\/onboarding\/1/);

    // log out by clearing the session, then try a wrong password
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem("anv:lastSession");
    });
    await page.goto("/giris");
    await page.getByLabel("E-posta").fill("ali@ornek.com");
    await page.getByLabel("Şifre").fill("yanlis");
    await page.getByRole("button", { name: "Giriş yap" }).click();
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
});
