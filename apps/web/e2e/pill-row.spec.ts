import { expect, test, type Locator, type Page } from "@playwright/test";

// The cuisine pill row on Eşleş: at 1280 (mouse) the pills wrap and all show; at 390 (touch) one
// scrolling line with an edge fade. Both line up with the header; one "active" look only.
const NOW = new Date("2026-10-12T10:00:00+03:00");

async function open(page: Page, width: number, scheme: "light" | "dark" = "light") {
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.clock.setFixedTime(NOW);
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
  await page.goto("/eslesme?slot=ana");
  const row = page.getByRole("group", { name: "Mutfağa göre süz" });
  await expect(row.getByRole("button")).toHaveCount(9);
  return row;
}

const left = async (l: Locator) => (await l.boundingBox())!.x;

async function expectAligned(page: Page, row: Locator) {
  const header = await left(page.getByRole("heading", { level: 1, name: "Ne dersin?" }));
  expect(Math.abs((await left(row.getByRole("button", { name: "Tümü" }))) - header)).toBeLessThanOrEqual(1);
}

test.describe("cuisine pill row", () => {
  test("states and layout at this project's width", async ({ page }, info) => {
    const desktop = info.project.name === "desktop";
    const width = desktop ? 1280 : 390;
    const row = await open(page, width);
    await expectAligned(page, row);

    if (desktop) {
      // every pill fully inside the row: nothing clipped, nothing scrolls
      const box = (await row.boundingBox())!;
      for (const b of await row.getByRole("button").all()) {
        const p = (await b.boundingBox())!;
        expect(p.x).toBeGreaterThanOrEqual(box.x);
        expect(p.x + p.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      }
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(row).toHaveAttribute("data-fade-end", "false");
    } else {
      await expect(row).toHaveAttribute("data-fade-start", "false");
      await expect(row).toHaveAttribute("data-fade-end", "true");
    }
    await expect(row).toHaveScreenshot(`none-${width}.png`);

    // two selected: Tümü lets go; exactly the selected pills carry the accent fill
    await row.getByRole("button", { name: "İtalyan" }).click();
    await row.getByRole("button", { name: "Hint" }).click();
    await page.mouse.move(0, 0);
    await expect(row.getByRole("button", { name: "Tümü" })).toHaveAttribute("aria-pressed", "false");
    const filled = await row.getByRole("button").evaluateAll((els) => els.filter((e) => getComputedStyle(e).backgroundColor === getComputedStyle(e).borderColor && e.getAttribute("aria-pressed") === "true").length);
    expect(filled).toBe(2);
    // unselected pills have the neutral border, not the accent (the old "İspanyol" outline)
    const ispanyol = row.getByRole("button", { name: "İspanyol" });
    const accent = await row.getByRole("button", { name: "Hint" }).evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(await ispanyol.evaluate((e) => getComputedStyle(e).borderTopColor)).not.toBe(accent);
    // a mouse click leaves no focus ring
    expect(await row.getByRole("button", { name: "Hint" }).evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("none");
    await row.evaluate((el) => (el.scrollLeft = 0));
    await expectAligned(page, row);
    await expect(row).toHaveScreenshot(`two-${width}.png`);

    // keyboard focus: a ring, distinct from selected
    await page.keyboard.press("Tab");
    const focused = row.getByRole("button", { name: "Fransız" });
    await expect(focused).toBeFocused();
    expect(await focused.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("solid");
    await expect(focused).toHaveAttribute("aria-pressed", "false");
    // the browser scrolls the focused pill into view, inside the gutter (scroll-padding), ring unclipped
    const rb = (await row.boundingBox())!;
    const fb = (await focused.boundingBox())!;
    expect(fb.x + fb.width).toBeLessThanOrEqual(rb.x + rb.width);
    await expect(row).toHaveScreenshot(`focus-${width}.png`);
  });

  test("dark theme and English labels keep the row aligned and unclipped", async ({ browser }, info) => {
    const width = info.project.name === "desktop" ? 1280 : 390;
    const context = await browser.newContext({ locale: "en-GB", hasTouch: info.project.name !== "desktop" });
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/giris");
    await page.getByRole("button", { name: /Try the sample home/ }).click();
    await expect(page).toHaveURL(/\/bugun/);
    await page.goto("/eslesme?slot=ana");
    const row = page.getByRole("group", { name: "Filter by cuisine" });
    await expect(row.getByRole("button")).toHaveCount(9);
    const header = await left(page.getByRole("heading", { level: 1 }));
    expect(Math.abs((await left(row.getByRole("button", { name: "All" }))) - header)).toBeLessThanOrEqual(1);
    if (info.project.name === "desktop") expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    else await expect(row).toHaveAttribute("data-fade-end", "true");
    await context.close();
  });
});
