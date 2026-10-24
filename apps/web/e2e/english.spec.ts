import { expect, test } from "@playwright/test";

/** Round 3: an English browser gets the English UI; Settings › Language switches and remembers. */
test.use({ locale: "en-GB" });

const NOW = new Date("2026-10-12T10:00:00+03:00");

test("main journey in English: demo → Today → Recipes (quick add) → List → Week → Settings language switch", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/giris");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await page.getByRole("button", { name: /Try the sample home/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
  await expect(page.getByRole("heading", { level: 1, name: "What’s for dinner?" })).toBeVisible();
  await expect(page.getByText("Monday, 12 October")).toBeVisible();
  await expect(page.getByRole("region", { name: "Today’s reminder" })).toContainText("don’t forget");

  // Only the visible one (phone tabs or desktop top bar) is in the accessibility tree.
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Recipes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Recipes" })).toBeVisible();
  await expect(page.getByText("1000 recipes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Paste a link or type the dish’s name").fill("Mum’s stuffed peppers");
  await expect(sheet).toContainText("Saved with just its name");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mum’s stuffed peppers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add details" })).toBeVisible();

  await page.goto("/liste");
  await expect(page.getByRole("heading", { level: 1, name: "Shopping" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish shopping" })).toBeVisible();
  await page.goto("/hafta");
  await expect(page.getByRole("region", { name: "The week at a glance" })).toBeVisible();

  await page.goto("/ayarlar");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Türkçe" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  // Remembered on reload (browser says English, the person chose Turkish)
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("the tab title and description follow English (#8)", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-GB" });
  const page = await ctx.newPage();
  await page.goto("/giris");
  await expect(page).toHaveTitle("What’s for dinner?");
  await page.getByRole("link", { name: "Continue without signing in" }).click();
  await expect(page).toHaveURL(/\/kayit/);
  await expect(page).toHaveTitle("What’s for dinner?");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Decide dinner together/);
  await ctx.close();
});
