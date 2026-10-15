import { expect, test, type Page } from "@playwright/test";

const EVENING = new Date("2026-10-12T18:00:00+03:00");

/** Where the things around a running timer are; any change between ticks is a layout shift. */
async function boxes(page: Page) {
  return page.evaluate(() => {
    const at = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(",");
    };
    const step = document.querySelector("#pisir-adim");
    const buttons = [...(step?.querySelectorAll("button, span") ?? [])].map(at);
    return { step: at(step), text: at(step?.querySelector("p") ?? null), buttons, nav: at([...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Sonraki")) ?? null) };
  });
}

// A small Android phone (360 × 640) and an iPhone (390 × 844 in the "mobile" project, 1440 on desktop).
for (const size of [{ width: 360, height: 640 }, null]) {
  test(`a running timer never moves anything while it counts${size ? ` (${size.width}×${size.height})` : ""}`, async ({ page }) => {
    test.setTimeout(90_000);
    if (size) await page.setViewportSize(size);
    await page.clock.install({ time: EVENING });
    await page.goto("/giris");
    await page.getByRole("button", { name: /Örnek evle dene/ }).click();
    await expect(page).toHaveURL(/\/bugun/);
    await page.goto("/tarif/kuru-fasulye");
    await page.getByRole("link", { name: "Pişirmeye başla" }).click();
    await page.getByRole("button", { name: "Yine de başla" }).click();
    await page.getByRole("button", { name: /^Zamanlayıcı başlat · 10 dk/ }).click();
    await expect(page.locator("#pisir-adim")).toContainText("10:00");
    const first = await boxes(page);

    // Ticks with different digit widths, including the drop from 10:00 to 9:59 (one digit fewer).
    for (const [jump, shows] of [
      ["00:01", "9:59"],
      ["00:03", "9:56"],
      ["00:45", "9:11"],
      ["01:00", "8:11"],
    ] as const) {
      await page.clock.fastForward(jump);
      await expect(page.locator("#pisir-adim")).toContainText(shows);
      expect(await boxes(page), `after ${shows}`).toEqual(first);
    }
  });
}
