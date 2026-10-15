import { expect, test, type Page } from "@playwright/test";

/**
 * Native <select> lists in both themes. The open popup is drawn by the
 * browser/OS (not capturable in a page screenshot), so this checks what it is
 * drawn from: the root's color-scheme and every option's computed colours,
 * which must be the theme's surface + ink with readable contrast.
 */

const NOW = new Date("2026-10-12T10:00:00+03:00");

type Report = { label: string; scheme: string; selectBg: string; selectFg: string; options: { bg: string; fg: string; checked: boolean; contrast: number }[] }[];

async function selectColours(page: Page): Promise<Report> {
  return page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (c: string) => {
      const [r, g, b] = rgb(c).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    return [...document.querySelectorAll("select")].map((sel) => {
      const cs = getComputedStyle(sel);
      return {
        label: sel.labels?.[0]?.textContent ?? sel.name,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        selectBg: cs.backgroundColor,
        selectFg: cs.color,
        options: [...sel.options].map((o) => {
          const os = getComputedStyle(o);
          return { bg: os.backgroundColor, fg: os.color, checked: o.selected, contrast: Math.round(ratio(os.backgroundColor, os.color) * 10) / 10 };
        }),
      };
    });
  });
}

async function tokens(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    probe.style.background = "var(--surface)";
    probe.style.color = "var(--ink)";
    probe.style.borderColor = "var(--olive-soft)";
    probe.style.borderStyle = "solid";
    const cs = getComputedStyle(probe);
    const out = { surface: cs.backgroundColor, ink: cs.color, chosen: cs.borderTopColor };
    probe.remove();
    return out;
  });
}

async function checkAll(page: Page, expectScheme: "light" | "dark") {
  const t = await tokens(page);
  const report = await selectColours(page);
  expect(report.length).toBeGreaterThan(0);
  for (const r of report) {
    expect(r.scheme, r.label).toBe(expectScheme);
    expect(r.selectBg, `${r.label} select background`).toBe(t.surface);
    expect(r.selectFg, `${r.label} select text`).toBe(t.ink);
    for (const o of r.options) {
      expect(o.bg, `${r.label} option background`).toBe(o.checked ? t.chosen : t.surface);
      expect(o.fg, `${r.label} option text`).toBe(t.ink);
      expect(o.contrast, `${r.label} option contrast`).toBeGreaterThanOrEqual(7);
    }
  }
  return report.map((r) => r.label);
}

for (const mode of ["system-dark", "chosen-dark", "chosen-light-on-dark-system", "system-light"] as const) {
  test(`every select is readable: ${mode}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: mode === "system-light" ? "light" : "dark" });
    await page.clock.setFixedTime(NOW);
    await page.goto("/giris");
    await page.getByRole("button", { name: /Örnek evle dene/ }).click();
    await expect(page).toHaveURL(/\/bugun/);
    if (mode.startsWith("chosen")) {
      await page.goto("/ayarlar");
      await page.getByRole("group", { name: "Tema" }).getByRole("button", { name: mode === "chosen-dark" ? "Koyu" : "Açık" }).click();
    }
    const scheme = mode === "system-light" || mode === "chosen-light-on-dark-system" ? "light" : "dark";

    // Recipe form: Öğün, Birim, Nereden, Reyon, Buzluktan…, Kaç gün içinde (Saklanır), Ne zaman (ön hazırlık)
    await page.goto("/tarifler/yeni");
    await page.getByText("Kaynak ve artarsa").click();
    await page.getByText("Ön hazırlık", { exact: true }).click();
    await page.getByRole("radio", { name: "Saklanır" }).click();
    await page.getByRole("button", { name: "Ön hazırlık ekle" }).click();
    const labels = await checkAll(page, scheme);
    for (const l of ["Öğün", "Kaç gün içinde", "Birim", "Nereden", "Reyon", "Buzluktan çıkacak malzeme", "Ne zaman"]) expect(labels).toContain(l);

    // Liste › Ürün ekle: Birim
    await page.goto("/liste");
    await page.getByRole("button", { name: "Ürün ekle" }).click();
    expect(await checkAll(page, scheme)).toContain("Birim");
  });
}
