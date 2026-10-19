import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
}


test.describe("Eşleş: cuisine pills", () => {
  test("multi-select İtalyan + Hint deals only Italian and Indian cards, persists, and runs out into the filtered empty state", async ({ page }) => {
    await demo(page);
    await page.goto("/eslesme?slot=ana");
    const row = page.getByRole("group", { name: "Mutfağa göre süz" });
    await expect(row.getByRole("button", { name: "Tümü" })).toHaveAttribute("aria-pressed", "true");
    // short labels, table order
    await expect(row.getByRole("button")).toHaveText(["Tümü", "Türk", "İtalyan", "Hint", "Fransız", "İspanyol", "Endonezya", "Amerikan", "İngiliz"]);

    await row.getByRole("button", { name: "İtalyan" }).click();
    await row.getByRole("button", { name: "Hint" }).click();
    await expect(row.getByRole("button", { name: "İtalyan" })).toHaveAttribute("aria-pressed", "true");
    await expect(row.getByRole("button", { name: "Hint" })).toHaveAttribute("aria-pressed", "true");
    await expect(row.getByRole("button", { name: "Tümü" })).toHaveAttribute("aria-pressed", "false");

    // the selection survives a reload (localStorage)
    await page.reload();
    await expect(row.getByRole("button", { name: "Hint" })).toHaveAttribute("aria-pressed", "true");

    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const card = page.getByRole("article");
      await expect(card).toHaveAttribute("data-cuisine", /^(italian|indian)$/);
      seen.add((await card.getAttribute("data-cuisine"))!);
      const name = (await card.getAttribute("aria-label"))!;
      await page.getByRole("button", { name: "Bu sefer değil" }).click();
      await expect(page.getByRole("article", { name, exact: true })).toHaveCount(0);
    }
    expect([...seen].sort()).toEqual(["indian", "italian"]);

    await expect(page.getByText("Seçtiğiniz mutfaklarda kart kalmadı")).toBeVisible();
    await page.getByRole("button", { name: "Filtreyi temizle" }).click();
    await expect(row.getByRole("button", { name: "Tümü" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("article")).toBeVisible();
  });

  test("a single small cuisine empties quickly; clearing the filter brings cards back; English labels after a language switch", async ({ page }) => {
    await demo(page);
    await page.goto("/eslesme?slot=salata");
    const row = page.getByRole("group", { name: "Mutfağa göre süz" });
    await row.getByRole("button", { name: "Endonezya" }).click();
    const card = page.getByRole("article");
    await expect(card).toHaveAttribute("data-cuisine", "indonesian");
    await page.getByRole("button", { name: "Bu sefer değil" }).click();
    await expect(page.getByText("Seçtiğiniz mutfaklarda kart kalmadı")).toBeVisible();
    await page.getByRole("button", { name: "Filtreyi temizle" }).click();
    await expect(card).toBeVisible();
    await expect(card).not.toHaveAttribute("data-cuisine", "indonesian");

    await row.getByRole("button", { name: "Amerikan" }).click();
    await page.evaluate(() => localStorage.setItem("anv.locale", "en"));
    await page.reload();
    const en = page.getByRole("group", { name: "Filter by cuisine" });
    await expect(en.getByRole("button", { name: "American" })).toHaveAttribute("aria-pressed", "true");
    await expect(en.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });
});
