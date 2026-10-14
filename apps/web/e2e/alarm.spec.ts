import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const EVENING = new Date("2026-10-12T18:00:00+03:00");

/**
 * Web Audio and Notification are replaced by recorders (headless Chromium has neither a speaker nor a
 * notification centre), and the page's visibility is switchable, so the hidden-tab path is testable.
 */
async function mockPlatform(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__hidden = false;
    w.__osc = 0;
    w.__notes = [];
    Object.defineProperty(Document.prototype, "visibilityState", { configurable: true, get: () => (w.__hidden ? "hidden" : "visible") });
    Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: () => !!w.__hidden });
    const node = () => ({ connect: (n: unknown) => n });
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = node();
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
      createOscillator() {
        return { ...node(), type: "sine", frequency: param(), start: () => void (w.__osc = (w.__osc as number) + 1), stop() {} };
      }
      createGain() {
        return { ...node(), gain: param() };
      }
    }
    w.AudioContext = FakeAudioContext;
    class FakeNotification {
      static permission = "granted";
      static requestPermission = () => Promise.resolve("granted");
      onclick: unknown = null;
      constructor(title: string, opts?: { body?: string }) {
        (w.__notes as { title: string; body?: string }[]).push({ title, body: opts?.body });
      }
      close() {}
    }
    w.Notification = FakeNotification;
  });
}

const osc = (page: Page) => page.evaluate(() => (window as unknown as { __osc: number }).__osc);

async function auditBanner(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).include("[role=alert]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    `${label} axe violations`,
  ).toEqual([]);
}

test("timer alarm: rings in a hidden tab (notification + blinking title), banner on return, Durdur stops it; axe light + dark", async ({ page }) => {
  test.setTimeout(120_000);
  await mockPlatform(page);
  await page.clock.install({ time: EVENING });
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);

  await page.goto("/tarif/kuru-fasulye");
  await page.getByRole("link", { name: "Pişirmeye başla" }).click();
  const anyway = page.getByRole("button", { name: "Yine de başla" });
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole("button", { name: /^Zamanlayıcı başlat · 10 dk/ }).click();
  const title = await page.title();
  const beforeRing = await osc(page);

  // The cook switches tabs; the timer ends while the tab is hidden.
  await page.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = true));
  await page.clock.fastForward("10:01");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notes: { title: string }[] }).__notes.map((n) => n.title))).toEqual(["Süre doldu: Kuru fasulye · 10 dk"]);
  await expect.poll(async () => (await page.title()).startsWith("⏰"), { timeout: 5000 }).toBe(true);
  expect(await osc(page)).toBeGreaterThan(beforeRing);

  // Back to the tab: the banner names the timer and the beeps keep looping.
  await page.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = false));
  const banner = page.getByRole("alert").filter({ hasText: "Süre doldu" });
  await expect(banner).toContainText("Süre doldu: Kuru fasulye · 10 dk");
  const looping = await osc(page);
  await page.clock.runFor(3000);
  expect(await osc(page)).toBeGreaterThan(looping);

  await auditBanner(page, "alarm banner (light)");
  await page.emulateMedia({ colorScheme: "dark" });
  await auditBanner(page, "alarm banner (dark)");

  // Durdur: banner gone, sound stops, the title comes back.
  await page.getByRole("button", { name: "Alarmı durdur" }).click();
  await expect(banner).toHaveCount(0);
  const stopped = await osc(page);
  await page.clock.runFor(3000);
  expect(await osc(page)).toBe(stopped);
  expect(await page.title()).toBe(title);
});

test("timer sound off: the banner still appears, without beeps", async ({ page }) => {
  test.setTimeout(90_000);
  await mockPlatform(page);
  await page.addInitScript(() => localStorage.setItem("anv.timerSound", "off"));
  await page.clock.install({ time: EVENING });
  await page.goto("/giris");
  await page.getByRole("button", { name: /Örnek evle dene/ }).click();
  await expect(page).toHaveURL(/\/bugun/);
  await page.goto("/tarif/kuru-fasulye");
  await page.getByRole("link", { name: "Pişirmeye başla" }).click();
  const anyway = page.getByRole("button", { name: "Yine de başla" });
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole("button", { name: /^Zamanlayıcı başlat · 10 dk/ }).click();
  const before = await osc(page);
  await page.clock.fastForward("10:01");
  await expect(page.getByRole("alert").filter({ hasText: "Süre doldu" })).toBeVisible();
  await page.clock.runFor(3000);
  expect(await osc(page)).toBe(before);
});
