import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import ListePage from "@/app/(app)/liste/page";
import { selectList, useApp } from "@/store/app";
import { freshStore, soloUser } from "./helpers";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

describe("Liste", () => {
  it("empty state for a new household", async () => {
    await freshStore();
    await soloUser();
    render(<ListePage />);
    expect(screen.getByRole("heading", { name: "Liste şimdilik boş" })).toBeInTheDocument();
  });

  it("market tab by default with counts, aisles and the partner's fresh check", async () => {
    await freshStore({ demo: true });
    render(<ListePage />);
    expect(screen.getByRole("tab", { name: /Market 3\/8/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Pazar 6/ })).toBeInTheDocument();
    const kasap = screen.getByRole("region", { name: "Kasap" });
    expect(within(kasap).getByText("tamam")).toBeInTheDocument();
    expect(within(kasap).getByText("Zeynep aldı · az önce")).toBeInTheDocument();
    expect(within(kasap).getByRole("button", { name: /Kıyma, 500 g, Zeynep aldı/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("pazar tab groups by Sebze / Yeşillik", async () => {
    await freshStore({ demo: true });
    render(<ListePage />);
    await userEvent.click(screen.getByRole("tab", { name: /Pazar/ }));
    expect(screen.getByRole("region", { name: "Sebze" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Yeşillik" })).toBeInTheDocument();
  });

  it("checking shows my mark; finishing moves bought items to the pantry", async () => {
    await freshStore({ demo: true });
    render(<ListePage />);
    await userEvent.click(screen.getByRole("button", { name: /^Yumurta/ }));
    expect(screen.getByRole("button", { name: /^Yumurta, 10 adet, Ali aldı/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Alışverişi bitir" }));
    const rows = selectList(useApp.getState());
    expect(rows.find((r) => r.name === "Yumurta")).toBeUndefined();
    expect(rows.every((r) => !r.checkedBy)).toBe(true);
    expect(useApp.getState().notice?.text).toMatch(/4 ürün/);
  });

  it("adds a manual item that lands in the catalog's aisle", async () => {
    await freshStore({ demo: true });
    render(<ListePage />);
    await userEvent.click(screen.getByRole("button", { name: "Ürün ekle" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Ürün"), "limon");
    await userEvent.click(within(dialog).getByRole("button", { name: "Listeye ekle" }));
    const row = selectList(useApp.getState()).find((r) => r.manualItemId && r.name === "Limon");
    expect(row).toMatchObject({ side: "pazar", aisle: "Meyve", forLabel: "Elle eklendi" });
  });
});
