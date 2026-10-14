import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import HaftaPage from "@/app/(app)/hafta/page";
import { useApp } from "@/store/app";
import { freshStore } from "./helpers";

beforeAll(() => {
  // jsdom: no <dialog> modal API and no matchMedia
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

describe("Hafta (mobile list)", () => {
  it("shows the range, summary and the design's week", async () => {
    await freshStore({ demo: true });
    render(<HaftaPage />);
    expect(screen.getByRole("heading", { name: "10 – 16 Ekim" })).toBeInTheDocument();
    expect(screen.getByText("5 akşam planlı")).toBeInTheDocument();
    expect(screen.getByText("Cumartesi dışarıda · Cuma henüz boş")).toBeInTheDocument();
    expect(screen.getByText("14 ürün")).toBeInTheDocument();
    expect(screen.getByText("Kıyma 500 g · Pzt sabah")).toBeInTheDocument();
    const sat = screen.getByRole("article", { name: /Cumartesi/ });
    expect(sat).toHaveTextContent("Dışarıda yendi");
    expect(sat).toHaveTextContent("Planlanan etli nohut eşleşmelere geri döndü.");
    expect(screen.getByRole("article", { name: /Çarşamba/ })).toHaveTextContent("Öğlen · karnıyarık");
  });

  it("adds a dish to an empty slot through the picker", async () => {
    await freshStore({ demo: true });
    render(<HaftaPage />);
    await userEvent.click(screen.getByRole("button", { name: "Cuma · Çorba ekle" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getAllByRole("button", { name: /Mercimek çorbası/ })[0]);
    expect(useApp.getState().planItems.some((i) => i.date === "2026-10-16" && i.slot === "corba")).toBe(true);
    expect(screen.getByRole("article", { name: /^Cuma,/ })).toHaveTextContent("Mercimek çorbası");
  });

  it("places a match on an evening via the day picker", async () => {
    await freshStore({ demo: true });
    render(<HaftaPage />);
    await userEvent.click(screen.getByRole("button", { name: /Mantı, .* Bir akşama koy/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Cuma(?!rtesi)/ }));
    const s = useApp.getState();
    expect(s.planItems.find((i) => i.date === "2026-10-16" && i.slot === "ana")).toBeDefined();
    expect(s.matches.find((m) => s.recipes.find((r) => r.id === m.recipeId)?.name === "Mantı")?.status).toBe("placed");
  });

  it("removes a planned dish and marks a day eaten out", async () => {
    await freshStore({ demo: true });
    render(<HaftaPage />);
    await userEvent.click(within(screen.getByRole("article", { name: /Perşembe/ })).getByRole("button", { name: /Tavuk sote/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Plandan çıkar" }));
    expect(screen.getByRole("article", { name: /Perşembe/ })).not.toHaveTextContent("Tavuk sote");
    await userEvent.click(screen.getByRole("button", { name: "Perşembe günü seçenekleri" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Dışarıda yedik/ }));
    expect(screen.getByRole("article", { name: /Perşembe/ })).toHaveTextContent("Dışarıda yendi");
  });

  it("navigates weeks", async () => {
    await freshStore({ demo: true });
    render(<HaftaPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sonraki hafta" }));
    expect(screen.getByRole("heading", { name: "17 – 23 Ekim" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bu haftaya dön" }));
    expect(screen.getByRole("heading", { name: "10 – 16 Ekim" })).toBeInTheDocument();
  });
});
