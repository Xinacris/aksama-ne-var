import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "@/components/AppShell";
import { nav } from "../setup";
import { freshStore } from "./helpers";

function setWidth(px: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: px });
  window.dispatchEvent(new Event("resize"));
}

async function renderAt(path: string) {
  nav.pathname = path;
  await act(async () => {
    render(
      <AppShell>
        <main>içerik</main>
      </AppShell>,
    );
  });
  // Two navs share the label (desktop top bar, phone tabs); the tabs are the last one.
  const navs = screen.getAllByRole("navigation", { name: "Ana gezinme" });
  return navs[navs.length - 1];
}

describe.each([360, 390])("bottom nav at %i px", (width) => {
  beforeEach(async () => {
    setWidth(width);
    await freshStore({ demo: true });
  });

  it("has five tabs with Tarifler between Liste and Hafta, labels on one line", async () => {
    const bottom = await renderAt("/bugun");
    const tabs = within(bottom).getAllByRole("link");
    expect(tabs.map((a) => a.textContent?.replace(/\d+$/, ""))).toEqual(["Bugün", "Eşleş", "Liste", "Tarifler", "Hafta"]);
    expect(tabs[3]).toHaveAttribute("href", "/tarifler");
    for (const a of tabs) {
      expect(a.className).toMatch(/\btab\b/); // .tab: nowrap, 56 px tall (layout measured in e2e/nav.spec.ts)
      expect(a.querySelector("svg")).not.toBeNull();
    }
    expect(bottom.className).toMatch(/\bbottom\b/);
    // The Liste badge stays inside its own tab.
    const badge = within(tabs[2]).queryByLabelText(/ürün kaldı/);
    if (badge) expect(tabs[2]).toContainElement(badge);
  });

  it.each([
    ["/tarifler", "Tarifler"],
    ["/tarifler/yeni", "Tarifler"],
    ["/tarifler/ice-aktar", "Tarifler"],
    ["/tarif/izmir-kofte", "Tarifler"],
    ["/liste", "Liste"],
    ["/hafta", "Hafta"],
  ])("%s lights %s only", async (path, label) => {
    const bottom = await renderAt(path);
    const current = within(bottom)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain(label);
  });

  it("leaves the desktop top nav as it was: Tarifler is its last pill", async () => {
    await renderAt("/tarifler");
    const top = screen.getAllByRole("navigation", { name: "Ana gezinme" })[0];
    const pills = within(top).getAllByRole("link");
    expect(pills.map((a) => a.textContent?.replace(/\d+$/, ""))).toEqual(["Bugün", "Hafta", "Eşleş", "Liste", "Tarifler"]);
    expect(pills[4]).toHaveAttribute("aria-current", "page");
  });
});
