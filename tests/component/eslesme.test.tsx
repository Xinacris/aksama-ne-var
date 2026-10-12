import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import EslesmePage from "@/app/(app)/eslesme/page";
import { useApp } from "@/store/app";
import { nav } from "../setup";
import { freshStore, soloUser } from "./helpers";

beforeEach(() => {
  nav.search = new URLSearchParams();
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

describe("Eşleş", () => {
  it("shows the next open evening, my counter and the partner's hidden progress", async () => {
    await freshStore({ demo: true });
    render(<EslesmePage />);
    expect(screen.getByRole("button", { name: /Cuma akşamı için ana yemek/ })).toBeInTheDocument();
    expect(screen.getByText("1 / 12")).toBeInTheDocument();
    expect(screen.getByText(/Zeynep 12 kartın 8'ini kaydırdı · seçimleri gizli/)).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveAccessibleName("Taze fasulye");
  });

  it("pass with the button moves to the next card", async () => {
    await freshStore({ demo: true });
    render(<EslesmePage />);
    await userEvent.click(screen.getByRole("button", { name: "Bu sefer değil" }));
    expect(await screen.findByText("2 / 12")).toBeInTheDocument();
  });

  it("→ key likes; liking the card the partner liked shows the match moment and places it", async () => {
    await freshStore({ demo: true });
    render(<EslesmePage />);
    await userEvent.keyboard("{ArrowRight}");
    expect(await screen.findByRole("heading", { name: "İkiniz de taze fasulye dediniz!" })).toBeInTheDocument();
    expect(screen.getByText("Cuma akşamı için tatlı bir uzlaşma.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cuma akşamına koy" }));
    const s = useApp.getState();
    const placed = s.planItems.find((i) => i.date === "2026-10-16" && i.slot === "ana");
    expect(placed?.source).toBe("match");
    expect(s.matches.find((m) => m.recipeId === placed!.recipeId)?.status).toBe("placed");
    expect(s.notice?.text).toMatch(/cuma akşamına kondu/);
  });

  it("keep swiping closes the moment", async () => {
    await freshStore({ demo: true });
    render(<EslesmePage />);
    await userEvent.click(screen.getByRole("button", { name: "Olur" }));
    await userEvent.click(await screen.findByRole("button", { name: "Kaydırmaya devam" }));
    expect(screen.getByRole("heading", { name: "Ne dersin?" })).toBeInTheDocument();
  });

  it("solo user: a like is a match with singular copy", async () => {
    await freshStore();
    await soloUser();
    render(<EslesmePage />);
    expect(screen.getByText(/Tek başınasın/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Olur" }));
    expect(await screen.findByRole("heading", { name: /olsun!$/ })).toBeInTheDocument();
  });

  it("finished deck shows a calm empty state", async () => {
    await freshStore();
    await soloUser();
    nav.search = new URLSearchParams("gun=2026-10-13&slot=salata");
    render(<EslesmePage />);
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        await userEvent.click(screen.getByRole("button", { name: "Bu sefer değil" }));
      });
    }
    expect(await screen.findByRole("heading", { name: "Kartlar bitti" })).toBeInTheDocument();
  });

  it("day/slot chooser is reachable and labelled", async () => {
    await freshStore({ demo: true });
    render(<EslesmePage />);
    const toggle = screen.getByRole("button", { name: /için ana yemek/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Gün ve öğün seç" })).toBeInTheDocument();
  });
});
