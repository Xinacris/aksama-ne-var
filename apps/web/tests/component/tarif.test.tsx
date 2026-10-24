import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import TarifPage from "@/app/(app)/tarif/[id]/page";
import TariflerPage from "@/app/(app)/tarifler/page";
import YeniTarifPage from "@/app/(app)/tarifler/yeni/page";
import { selectList, useApp } from "@/store/app";
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
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
  nav.params = {};
  nav.search = new URLSearchParams();
});

describe("Tarif detail", () => {
  it("menu context: parts, prep timeline, ingredient statuses, steps", async () => {
    await freshStore({ demo: true });
    nav.params = { id: "izmir-kofte" };
    nav.search = new URLSearchParams("gun=today");
    render(<TarifPage />);
    expect(screen.getByText("Bu akşamın menüsü")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "İzmir köfte sofrası" })).toBeInTheDocument();
    const parts = screen.getByRole("navigation", { name: "Menünün parçaları" });
    expect(within(parts).getByRole("link", { name: /İzmir köfte/ })).toHaveAttribute("aria-current", "true");
    const prep = screen.getByRole("region", { name: "Ön hazırlık" });
    expect(prep).toHaveTextContent("Sofra 19:30");
    expect(prep).toHaveTextContent("Kıymayı buzluktan çıkar");
    expect(prep).toHaveTextContent("18:30 · Zeynep'e hatırlatılacak");
    expect(prep).toHaveTextContent("pirinç pilavı için");
    const ing = screen.getByRole("region", { name: "Malzemeler" });
    expect(within(ing).getByText("Evde · buzlukta")).toBeInTheDocument();
    expect(within(ing).getAllByRole("button", { name: /evde var olarak işaretle/ }).length).toBeGreaterThan(0);
    expect(within(ing).getByText("Kimyon, karabiber, tuz")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").some((li) => li.textContent?.includes("Harçtan uzun köfteler yap"))).toBe(true);
  });

  it("completing a prep step from the timeline", async () => {
    await freshStore({ demo: true });
    nav.params = { id: "izmir-kofte" };
    nav.search = new URLSearchParams("gun=today");
    render(<TarifPage />);
    await userEvent.click(screen.getByRole("button", { name: "Kıymayı buzluktan çıkar: yapıldı olarak işaretle" }));
    expect(screen.getByRole("region", { name: "Ön hazırlık" })).toHaveTextContent("Ali yaptı · 08:45");
    expect(screen.getByText("Evde · çözülüyor")).toBeInTheDocument();
  });

  it("missing ingredient can be added to the list; servings scale quantities", async () => {
    await freshStore({ demo: true });
    nav.params = { id: "hamsi-tava" };
    render(<TarifPage />);
    const ing = screen.getByRole("region", { name: "Malzemeler" });
    expect(within(ing).getByText("1 kg")).toBeInTheDocument();
    await userEvent.click(within(ing).getByRole("button", { name: "Bir kişi artır" }));
    expect(within(ing).getByText("1,25 kg")).toBeInTheDocument();
    await userEvent.click(within(ing).getByRole("button", { name: "hamsi listeye ekle" }));
    expect(selectList(useApp.getState()).some((r) => r.name === "Hamsi" && r.forLabel === "Hamsi tava")).toBe(true);
  });

  it("unknown recipe shows a calm empty state", async () => {
    await freshStore({ demo: true });
    nav.params = { id: "yok" };
    render(<TarifPage />);
    expect(screen.getByRole("heading", { name: "Bu tarifi bulamadık" })).toBeInTheDocument();
  });

  it("'Pişirmeye başla' opens cooking mode: the recipe alone, or tonight's whole menu", async () => {
    await freshStore({ demo: true });
    nav.params = { id: "menemen" };
    const { unmount } = render(<TarifPage />);
    expect(screen.getByRole("link", { name: "Pişirmeye başla" })).toHaveAttribute("href", "/pisir/menemen");
    unmount();
    nav.params = { id: "izmir-kofte" };
    nav.search = new URLSearchParams("gun=today");
    render(<TarifPage />);
    expect(screen.getByRole("link", { name: "Menüyü pişirmeye başla" })).toHaveAttribute("href", "/pisir/2026-10-12");
  });
});

describe("Tarifler", () => {
  it("lists all 1,000, filters by course, tag and search (Turkish casing)", async () => {
    await freshStore({ demo: true });
    render(<TariflerPage />);
    expect(screen.getByRole("status")).toHaveTextContent("1000 tarif");
    await userEvent.click(screen.getByRole("button", { name: "Çorba" }));
    expect(screen.getByRole("status")).toHaveTextContent("200 tarif");
    await userEvent.click(screen.getByRole("button", { name: "Tümü" }));
    await userEvent.type(screen.getByLabelText("Tarif ya da malzeme ara"), "İMAM");
    expect(screen.getByRole("link", { name: "İmam bayıldı" })).toBeInTheDocument();
  });

  it("toggles a favorite", async () => {
    await freshStore({ demo: true });
    render(<TariflerPage />);
    // The list shows a page at a time (#10): find it first.
    await userEvent.type(screen.getByRole("searchbox", { name: "Tarif ya da malzeme ara" }), "Mantar sote");
    await userEvent.click(screen.getByRole("button", { name: "Mantar sote: sık yaptıklarımıza ekle" }));
    expect(useApp.getState().favorites.some((f) => f.recipeId === "mantar-sote")).toBe(true);
  });
});

describe("Yeni tarif", () => {
  it("validates and creates a custom recipe", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    await userEvent.click(screen.getByRole("button", { name: "Tarifi kaydet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tarifin adını yazar mısın?");
    await userEvent.type(screen.getByLabelText("Tarifin adı"), "Annemin dolması");
    await userEvent.type(screen.getByLabelText("Malzeme"), "Kıyma");
    await userEvent.type(screen.getByLabelText("Miktar"), "250");
    await userEvent.selectOptions(screen.getByLabelText("Birim"), "g");
    await userEvent.type(screen.getByLabelText("1. adım"), "Biberleri doldur.");
    await userEvent.click(screen.getByRole("button", { name: "Tarifi kaydet" }));
    const r = useApp.getState().recipes.find((x) => x.name === "Annemin dolması");
    expect(r).toMatchObject({ householdId: expect.any(String), ingredients: [{ name: "Kıyma", quantity: 250, unit: "g", aisle: "Kasap" }] });
    expect(router.push).toHaveBeenCalledWith(`/tarif/${r!.id}`);
  });
});

describe("Recipe form: Ayrıntılar", () => {
  const section = (title: string) => screen.getByText(title, { selector: "summary span" }).closest("details")!;

  it("new recipe: only name, Öğün, Malzemeler and Hazırlanışı are open", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    expect(screen.getByLabelText("Tarifin adı")).toBeInTheDocument();
    expect(screen.getByLabelText("Öğün")).toBeInTheDocument();
    expect(screen.getByLabelText("Malzeme").closest("details")).toBeNull();
    expect(screen.getByLabelText("1. adım").closest("details")).toBeNull();
    for (const t of ["Süre, porsiyon, etiketler", "Ön hazırlık", "Kaynak ve artarsa"]) expect(section(t)).not.toHaveAttribute("open");
    expect(section("Süre, porsiyon, etiketler")).toHaveTextContent("15 dk hazırlık · 30 dk pişirme · 4 kişilik");
    expect(section("Kaynak ve artarsa")).toHaveTextContent("Artmaz");
    expect(screen.getByLabelText("Pişirme (dk)").closest("details")).toBe(section("Süre, porsiyon, etiketler"));
    expect(screen.getByLabelText("Kaynak").closest("details")).toBe(section("Kaynak ve artarsa"));
    expect(screen.getByLabelText("Buzluktan çıkacak malzeme").closest("details")).toBe(section("Ön hazırlık"));
  });

  it("a validation error inside a closed section opens the sections", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    await userEvent.type(screen.getByLabelText("Tarifin adı"), "Annemin dolması");
    await userEvent.clear(screen.getByLabelText("Kaç kişilik"));
    await userEvent.click(screen.getByRole("button", { name: "Tarifi kaydet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Kişi sayısı");
    expect(section("Süre, porsiyon, etiketler")).toHaveAttribute("open");
  });

  it("edit opens the sections that have values", async () => {
    await freshStore({ demo: true });
    nav.search = new URLSearchParams("kopya=izmir-kofte");
    render(<YeniTarifPage />);
    expect(section("Süre, porsiyon, etiketler")).toHaveAttribute("open");
    expect(section("Ön hazırlık")).toHaveAttribute("open");
    expect(section("Kaynak ve artarsa")).not.toHaveAttribute("open");
  });
});

describe("Recipe form: Toplu yapıştır", () => {
  it("fills five ingredient rows from five lines, replacing the empty row; rows stay editable", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    const toggle = screen.getAllByRole("button", { name: "Toplu yapıştır" })[0];
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const box = screen.getByLabelText("Her satıra bir malzeme");
    expect(box).toHaveFocus();
    await userEvent.click(box);
    await userEvent.paste("2 su bardağı un\n1 tatlı kaşığı tuz\n\n3 yumurta\n1 su bardağı süt\nTuz, karabiber");
    await userEvent.click(screen.getByRole("button", { name: "Satırları ekle" }));
    const names = screen.getAllByLabelText("Malzeme").map((el) => (el as HTMLInputElement).value);
    expect(names).toEqual(["Un", "Tuz", "Yumurta", "Süt", "Tuz", "Karabiber"]);
    expect(screen.getAllByLabelText("Miktar").map((el) => (el as HTMLInputElement).value).slice(0, 4)).toEqual(["2", "1", "3", "1"]);
    expect(screen.getAllByLabelText("Birim").map((el) => (el as HTMLSelectElement).value).slice(0, 2)).toEqual(["su bardağı", "tatlı kaşığı"]);
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("6 malzeme eklendi.");
    expect(screen.queryByLabelText("Her satıra bir malzeme")).toBeNull();
    // Still a normal row
    await userEvent.clear(screen.getAllByLabelText("Miktar")[0]);
    await userEvent.type(screen.getAllByLabelText("Miktar")[0], "3");
    expect(screen.getAllByLabelText("Miktar")[0]).toHaveValue("3");
  });

  it("fills steps, strips numbering and blank lines, and saves", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    await userEvent.type(screen.getByLabelText("Tarifin adı"), "Krep");
    await userEvent.click(screen.getAllByRole("button", { name: "Toplu yapıştır" })[1]);
    await userEvent.click(screen.getByLabelText("Her satıra bir adım"));
    await userEvent.paste("1. Unu ve yumurtayı çırpın.\n\n2) Sütü azar azar ekleyin.\n3- Tavada iki yüzünü pişirin.");
    await userEvent.click(screen.getByRole("button", { name: "Satırları ekle" }));
    expect(screen.getByLabelText("1. adım")).toHaveValue("Unu ve yumurtayı çırpın.");
    expect(screen.getByLabelText("3. adım")).toHaveValue("Tavada iki yüzünü pişirin.");
    expect(screen.queryByLabelText("4. adım")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Tarifi kaydet" }));
    const r = useApp.getState().recipes.find((x) => x.name === "Krep")!;
    expect(r.steps).toEqual(["Unu ve yumurtayı çırpın.", "Sütü azar azar ekleyin.", "Tavada iki yüzünü pişirin."]);
  });

  it("a multi-line paste into one step offers to split it", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    await userEvent.click(screen.getByLabelText("1. adım"));
    await userEvent.paste("1. Soğanı doğrayın.\n2. Kavurun.\n3. Pirinci ekleyin.");
    const offer = screen.getByRole("group", { name: "Yapıştırılan satırlar" });
    expect(offer).toHaveTextContent("3 satır ayrı ayrı eklensin mi?");
    await userEvent.click(within(offer).getByRole("button", { name: "Evet, ayır" }));
    expect(screen.getByLabelText("1. adım")).toHaveValue("Soğanı doğrayın.");
    expect(screen.getByLabelText("3. adım")).toHaveValue("Pirinci ekleyin.");
    expect(screen.queryByRole("group", { name: "Yapıştırılan satırlar" })).toBeNull();
  });

  it("a multi-line paste into an ingredient name offers to split; 'Hayır' keeps it as it is", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    await userEvent.click(screen.getByLabelText("Malzeme"));
    await userEvent.paste("500 g kıyma\n2 adet soğan");
    await userEvent.click(within(screen.getByRole("group", { name: "Yapıştırılan satırlar" })).getByRole("button", { name: "Hayır" }));
    expect(screen.getAllByLabelText("Malzeme")).toHaveLength(1);
    await userEvent.clear(screen.getByLabelText("Malzeme"));
    await userEvent.paste("500 g kıyma\n2 adet soğan");
    await userEvent.click(within(screen.getByRole("group", { name: "Yapıştırılan satırlar" })).getByRole("button", { name: "Evet, ayır" }));
    expect(screen.getAllByLabelText("Malzeme").map((el) => (el as HTMLInputElement).value)).toEqual(["Kıyma", "Kuru soğan"]);
  });

  it("a one-line paste offers nothing", async () => {
    await freshStore({ demo: true });
    render(<YeniTarifPage />);
    await userEvent.click(screen.getByLabelText("1. adım"));
    await userEvent.paste("Soğanı doğrayın.");
    expect(screen.queryByRole("group", { name: "Yapıştırılan satırlar" })).toBeNull();
  });
});
