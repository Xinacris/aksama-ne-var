import { fireEvent, render, screen } from "@testing-library/react-native";
import { appStore } from "@anv/core/store/app";
import SignIn from "@/app/(auth)/index";
import Today from "@/app/(tabs)/bugun";
import Recipes from "@/app/(tabs)/tarifler";
import RecipePage from "@/app/tarif/[id]";
import NewRecipe from "@/app/tarifler/yeni";
import { freshStore, routerMock } from "./helpers";

beforeEach(() => {
  routerMock().router.push.mockClear();
  routerMock().router.replace.mockClear();
  routerMock().__params.current = {};
});

describe("Giriş", () => {
  it("loads the sample household with one tap", async () => {
    await freshStore();
    await render(<SignIn />);
    expect(screen.getByText("Tekrar hoş geldin")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("demo"));
    expect(appStore.getState().status).toBe("ready");
    expect(appStore.getState().people.map((p) => p.name).sort()).toEqual(["Ali", "Zeynep"]);
  }, 20000);

  it("shows calm errors for a wrong password", async () => {
    await freshStore({ demo: true });
    appStore.getState().logOut();
    await render(<SignIn />);
    await fireEvent.changeText(screen.getByLabelText("E-posta"), "ali@demo.ev");
    await fireEvent.changeText(screen.getByLabelText("Şifre"), "yanlis");
    await fireEvent.press(screen.getByRole("button", { name: "Giriş yap" }));
    expect(await screen.findByText("E-posta ya da şifre eşleşmedi. Bir daha bakar mısın?", {}, { timeout: 8000 })).toBeTruthy();
  }, 20000);
});

describe.each([
  ["tr", "Akşama ne var?", "Bu akşam", "Pazartesi, 12 Ekim", "Dünkü kuru fasulye bugün öğlen için yeterli."],
  ["en", "What’s for dinner?", "Tonight", "Monday, 12 October", "Yesterday’s kuru fasulye (white bean stew) will do for lunch today."],
] as const)("Bugün (%s)", (locale, title, tonight, date, yesterday) => {
  it("shows the date, reminder, tonight's menu and yesterday's leftovers", async () => {
    await freshStore({ demo: true, locale });
    await render(<Today />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(date)).toBeTruthy();
    expect(screen.getByText(tonight)).toBeTruthy();
    expect(screen.getAllByText(/İzmir köfte/).length).toBeGreaterThan(0);
    expect(screen.getByText(yesterday)).toBeTruthy();
  });
});

describe.each([
  ["tr", "Tarifler", "100 tarif", "Yeni tarif", "Kaydet", "İmam bayıldı"],
  ["en", "Recipes", "100 recipes", "New recipe", "Save", "İmam bayıldı (olive-oil stuffed aubergine)"],
] as const)("Tarifler (%s)", (locale, title, count, newLabel, save, imam) => {
  it("lists, searches, and quick-adds a name with one tap", async () => {
    await freshStore({ demo: true, locale });
    await render(<Recipes />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(count)).toBeTruthy();
    await fireEvent.changeText(screen.getAllByLabelText(locale === "tr" ? "Tarif ya da malzeme ara" : "Search recipes or ingredients")[0], "imam");
    expect(screen.getByText(imam)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: newLabel }));
    await fireEvent.changeText(screen.getByTestId("quick-add-input"), "Annemin dolması");
    await fireEvent.press(screen.getByRole("button", { name: save }));
    const r = appStore.getState().recipes.find((x) => x.name === "Annemin dolması")!;
    expect(r.stub).toBe(true);
    expect(routerMock().router.push).toHaveBeenCalledWith(`/tarif/${r.id}?yeni=1`);
  });
});

describe("Tarifler quick add with a link", () => {
  it("goes to import", async () => {
    await freshStore({ demo: true });
    await render(<Recipes />);
    await fireEvent.press(screen.getByRole("button", { name: "Yeni tarif" }));
    await fireEvent.changeText(screen.getByTestId("quick-add-input"), "https://youtu.be/abc123xyz");
    await fireEvent.press(screen.getByRole("button", { name: "Linkten içe aktar" }));
    expect(routerMock().router.push).toHaveBeenCalledWith("/tarifler/ice-aktar?url=https%3A%2F%2Fyoutu.be%2Fabc123xyz");
  });
});

describe("Tarif page", () => {
  it("shows ingredients with statuses and steps; a name-only recipe asks for details", async () => {
    await freshStore({ demo: true });
    routerMock().__params.current = { id: "izmir-kofte" };
    const { unmount } = await render(<RecipePage />);
    expect(screen.getByText("İzmir köfte")).toBeTruthy();
    expect(screen.getByText("Malzemeler")).toBeTruthy();
    expect(screen.getByText("Hazırlanışı")).toBeTruthy();
    await unmount();
    const stub = await appStore.getState().addStubRecipe("Annemin dolması");
    routerMock().__params.current = { id: stub.id, yeni: "1" };
    await render(<RecipePage />);
    expect(screen.getByText("Kaydedildi, ayrıntılar sonra da olur")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Ayrıntıları ekle" }));
    expect(routerMock().router.push).toHaveBeenCalledWith(`/tarifler/${stub.id}/duzenle`);
  });
});

describe("Recipe form", () => {
  it("Toplu yapıştır fills five ingredients and the recipe saves", async () => {
    await freshStore({ demo: true });
    await render(<NewRecipe />);
    await fireEvent.changeText(screen.getByTestId("recipe-name"), "Pankek");
    await fireEvent.press(screen.getAllByRole("button", { name: "Toplu yapıştır" })[0]);
    await fireEvent.changeText(screen.getByTestId("bulk-ing"), "2 su bardağı un\n1 tatlı kaşığı tuz\n\n3 yumurta\n1,5 su bardağı süt\n1 paket kabartma tozu");
    await fireEvent.press(screen.getByRole("button", { name: "Satırları ekle" }));
    expect(screen.getByTestId("ing-name-4").props.value).toBe("Kabartma tozu");
    expect(screen.getByText("5 malzeme eklendi.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("save-recipe"));
    const r = appStore.getState().recipes.find((x) => x.name === "Pankek")!;
    expect(r.ingredients).toHaveLength(5);
    expect(routerMock().router.replace).toHaveBeenCalledWith(`/tarif/${r.id}`);
  });

  it("a multi-line paste into a step offers to split it", async () => {
    await freshStore({ demo: true });
    await render(<NewRecipe />);
    await fireEvent.changeText(screen.getByTestId("step-0"), "1. Soğanı doğrayın.\n2. Kavurun.\n3. Pirinci ekleyin.");
    expect(screen.getByText("3 satır ayrı ayrı eklensin mi?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Evet, ayır" }));
    expect(screen.getByTestId("step-2").props.value).toBe("Pirinci ekleyin.");
  });

  it("new recipes start with Ayrıntılar closed", async () => {
    await freshStore({ demo: true });
    await render(<NewRecipe />);
    expect(screen.getByRole("button", { name: /Süre, porsiyon, etiketler/ }).props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByLabelText("Pişirme (dk)")).toBeNull();
  });
});
