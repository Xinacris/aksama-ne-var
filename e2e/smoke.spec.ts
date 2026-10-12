import { expect, test } from "@playwright/test";

test("home renders the app title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Akşama ne var?" })).toBeVisible();
});
