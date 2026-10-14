import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import TarifPage from "@/app/(app)/tarif/[id]/page";
import TariflerPage from "@/app/(app)/tarifler/page";
import { useApp } from "@/store/app";
import { nav, router } from "../setup";
import { freshStore } from "./helpers";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
beforeEach(async () => {
  nav.params = {};
  nav.search = new URLSearchParams();
  await freshStore({ demo: true });
});

async function openSheet() {
  render(<TariflerPage />);
  await userEvent.click(screen.getByRole("button", { name: "Yeni tarif" }));
  const sheet = screen.getByRole("dialog", { name: "Yeni tarif" });
  return { sheet, input: within(sheet).getByLabelText("Link yapıştır ya da yemeğin adını yaz") };
}

describe("Quick add sheet", () => {
  it("opens from Yeni tarif with the input focused; a name is saved with one tap and its page opens", async () => {
    const { sheet, input } = await openSheet();
    expect(input).toHaveFocus();
    await userEvent.type(input, "Annemin dolması");
    expect(sheet).toHaveTextContent("Adıyla kaydedilir");
    await userEvent.click(within(sheet).getByRole("button", { name: "Kaydet" }));
    const r = useApp.getState().recipes.find((x) => x.name === "Annemin dolması")!;
    expect(r).toMatchObject({ stub: true, leftoverPolicy: "none", ingredients: [], steps: [], householdId: expect.any(String) });
    expect(router.push).toHaveBeenCalledWith(`/tarif/${r.id}?yeni=1`);
  });

  it("Enter saves too", async () => {
    const { input } = await openSheet();
    await userEvent.type(input, "Ispanaklı börek{Enter}");
    expect(useApp.getState().recipes.some((x) => x.name === "Ispanaklı börek")).toBe(true);
  });

  it("a link goes to the import flow, nothing is saved", async () => {
    const { sheet, input } = await openSheet();
    const before = useApp.getState().recipes.length;
    await userEvent.type(input, "https://www.youtube.com/watch?v=p_mK7_Zi_rk");
    expect(sheet).toHaveTextContent("Link tanındı");
    await userEvent.click(within(sheet).getByRole("button", { name: /Linkten içe aktar/ }));
    expect(router.push).toHaveBeenCalledWith("/tarifler/ice-aktar?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dp_mK7_Zi_rk");
    expect(useApp.getState().recipes).toHaveLength(before);
  });

  it("a name already in the book opens that recipe instead of a duplicate", async () => {
    const { sheet, input } = await openSheet();
    await userEvent.type(input, "izmir köfte");
    expect(sheet).toHaveTextContent("“İzmir köfte” zaten defterde");
    await userEvent.click(within(sheet).getByRole("button", { name: "Tarifi aç" }));
    expect(router.push).toHaveBeenCalledWith("/tarif/izmir-kofte");
    expect(useApp.getState().recipes.filter((x) => x.name === "İzmir köfte")).toHaveLength(1);
  });

  it("empty input asks calmly; 'Ayrıntılı tarif yaz' opens the full form with the name", async () => {
    const { sheet, input } = await openSheet();
    await userEvent.click(within(sheet).getByRole("button", { name: "Kaydet" }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("Bir link yapıştır ya da yemeğin adını yaz.");
    expect(within(sheet).getByRole("link", { name: "Ayrıntılı tarif yaz" })).toHaveAttribute("href", "/tarifler/yeni");
    await userEvent.type(input, "Su böreği");
    expect(within(sheet).getByRole("link", { name: "Ayrıntılı tarif yaz" })).toHaveAttribute("href", "/tarifler/yeni?ad=Su%20b%C3%B6re%C4%9Fi");
  });
});

describe("Search with no results", () => {
  it("adds the searched name with one tap", async () => {
    render(<TariflerPage />);
    await userEvent.type(screen.getByLabelText("Tarif ya da malzeme ara"), "Annemin sarması");
    expect(screen.getByText("Bu aramayla tarif çıkmadı")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "“Annemin sarması” ekle" }));
    const r = useApp.getState().recipes.find((x) => x.name === "Annemin sarması")!;
    expect(r.stub).toBe(true);
    expect(router.push).toHaveBeenCalledWith(`/tarif/${r.id}?yeni=1`);
  });

  it("a pasted link in the search goes to import", async () => {
    render(<TariflerPage />);
    await userEvent.type(screen.getByLabelText("Tarif ya da malzeme ara"), "https://youtu.be/abc123xyz");
    await userEvent.click(screen.getByRole("button", { name: "Linkten içe aktar" }));
    expect(router.push).toHaveBeenCalledWith("/tarifler/ice-aktar?url=https%3A%2F%2Fyoutu.be%2Fabc123xyz");
  });
});

describe("Recipe page after a quick add", () => {
  it("shows the gentle 'Ayrıntıları ekle' prompt", async () => {
    const r = await useApp.getState().addStubRecipe("Annemin dolması");
    nav.params = { id: r.id };
    nav.search = new URLSearchParams("yeni=1");
    render(<TarifPage />);
    expect(screen.getByRole("heading", { level: 3, name: "Kaydedildi, ayrıntılar sonra da olur" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayrıntıları ekle" })).toHaveAttribute("href", `/tarifler/${r.id}/duzenle`);
  });
});
