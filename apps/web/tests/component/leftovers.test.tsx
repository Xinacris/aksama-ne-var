import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import BugunPage from "@/app/(app)/bugun/page";
import { useApp } from "@/store/app";
import { freshStore } from "./helpers";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

describe("Bugün leftovers", () => {
  it("yesterday's lunch card: one-tap choice, synced state, activity, undo", async () => {
    await freshStore({ demo: true });
    render(<BugunPage />);
    const card = screen.getByRole("region", { name: "Artan yemek" });
    expect(card).toHaveTextContent("Dünkü kuru fasulye bugün öğlen için yeterli.");
    const group = within(card).getByRole("group", { name: "Dünden kalan" });
    expect(within(group).getByRole("button", { name: "Bugün öğlen" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("status")).toHaveTextContent("Bugün öğlen yenecek · Ali seçti");

    await userEvent.click(within(group).getByRole("button", { name: "Dolaba kaldır" }));
    expect(card).toHaveTextContent("Dünkü kuru fasulye dolapta.");
    expect(card).toHaveTextContent("Çarşamba'ya kadar · yaklaşık 2 porsiyon");
    expect(useApp.getState().planDays.find((d) => d.date === "2026-10-11")).toMatchObject({ leftoverChoice: "fridge" });
    expect(useApp.getState().activity[0]).toMatchObject({ type: "leftover.set", data: { choice: "fridge", recipeId: "kuru-fasulye" } });

    await userEvent.click(within(card).getByRole("button", { name: "Geri al" }));
    expect(card).toHaveTextContent("bugün öğlen için yeterli.");
    expect(useApp.getState().planDays.find((d) => d.date === "2026-10-11")?.leftoverChoice).toBe("lunch");
  });

  it("nobody home for lunch: the lunch option disappears and the leftover is dolapta", async () => {
    await freshStore({ demo: true });
    await useApp.getState().setLunchAtHome({ lunchAtHome: "no", lunchDays: [] });
    render(<BugunPage />);
    const card = screen.getByRole("region", { name: "Artan yemek" });
    expect(card).toHaveTextContent("Dünkü kuru fasulye dolapta.");
    expect(within(card).queryByRole("button", { name: "Bugün öğlen" })).not.toBeInTheDocument();
  });

  it("Dolapta list: use-by hint, put on an evening (skips the list), Bitti", async () => {
    await freshStore({ demo: true });
    render(<BugunPage />);
    const fridge = screen.getByRole("region", { name: "Dolapta" });
    expect(fridge).toHaveTextContent("Etli biber dolması");
    expect(fridge).toHaveTextContent("Bugüne kadar · Cuma pişti");

    await userEvent.click(within(fridge).getByRole("button", { name: "Etli biber dolması: bir akşama koy" }));
    const dialog = screen.getByRole("dialog");
    // good until today: only this evening is offered
    const days = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    expect(days).toEqual([expect.stringContaining("Bu akşam")]);
    expect(dialog).toHaveTextContent("Dolaptan · hangi akşam?");
  });

  it("marking a dolapta dish finished removes it", async () => {
    await freshStore({ demo: true });
    render(<BugunPage />);
    await userEvent.click(screen.getByRole("button", { name: "Etli biber dolması: bitti" }));
    expect(screen.queryByRole("region", { name: "Dolapta" })).not.toBeInTheDocument();
  });

  it("a dolapta dish placed on an evening adds nothing to the shopping list", async () => {
    await freshStore({ demo: true });
    const before = (await import("@/store/app")).selectList(useApp.getState()).length;
    await useApp.getState().placeLeftover({ fromDate: "2026-10-09", recipeId: "etli-biber-dolmasi", toDate: "2026-10-16" });
    const st = useApp.getState();
    expect(st.planItems.find((i) => i.date === "2026-10-16" && i.slot === "ana")).toMatchObject({ source: "leftover", leftoverFrom: "2026-10-09" });
    expect((await import("@/store/app")).selectList(st).length).toBe(before);
  });
});
