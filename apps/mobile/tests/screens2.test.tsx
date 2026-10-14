import { fireEvent, render, screen } from "@testing-library/react-native";
import { appStore } from "@anv/core/store/app";
import Match from "@/app/(tabs)/eslesme";
import Week from "@/app/(tabs)/hafta";
import ShoppingList from "@/app/(tabs)/liste";
import { selectList } from "@/store";
import { freshStore, routerMock } from "./helpers";

beforeEach(() => {
  routerMock().router.push.mockClear();
  routerMock().__params.current = {};
});

describe.each([
  ["tr", "Alışveriş", "Alışverişi bitir"],
  ["en", "Shopping", "Finish shopping"],
] as const)("Liste (%s)", (locale, title, finish) => {
  it("groups by aisle; ticking checks the row; finishing moves ticked items home", async () => {
    await freshStore({ demo: true, locale });
    await render(<ShoppingList />);
    expect(screen.getByText(title)).toBeTruthy();
    const before = selectList(appStore.getState()).filter((r) => r.side === "market" && !r.checkedBy);
    const target = before[0];
    const label = target.label ?? target.name;
    const box = screen.getAllByRole("checkbox").find((b) => String(b.props.accessibilityLabel).startsWith(label))!;
    await fireEvent.press(box);
    expect(selectList(appStore.getState()).find((r) => r.key === target.key)!.checkedBy).toBe(appStore.getState().me!.id);
    await fireEvent.press(screen.getByRole("button", { name: finish }));
    expect(appStore.getState().pantry.some((p) => p.name === target.name)).toBe(true);
  });
});

describe("Liste: evde var and adding", () => {
  it("'Evde var' takes an item off the list; a manual item can be added", async () => {
    await freshStore({ demo: true });
    await render(<ShoppingList />);
    const row = selectList(appStore.getState()).find((r) => !r.checkedBy && !r.manualItemId && r.side === "market")!;
    await fireEvent.press(screen.getByRole("button", { name: `${row.name} evde var` }));
    expect(selectList(appStore.getState()).some((r) => r.key === row.key)).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Ürün ekle" }));
    await fireEvent.changeText(screen.getByLabelText("Ürün"), "Deterjan");
    await fireEvent.press(screen.getByRole("button", { name: "Listeye ekle" }));
    expect(selectList(appStore.getState()).some((r) => r.name === "Deterjan")).toBe(true);
  });
});

describe("Hafta", () => {
  it("lists the window's evenings and moves a dish to another evening (no drag-and-drop)", async () => {
    await freshStore({ demo: true });
    await render(<Week />);
    expect(screen.getByText("Son iki gün ve önümüzdeki beş gün")).toBeTruthy();
    const st = appStore.getState();
    const item = st.planItems.find((i) => i.date === st.today && i.slot === "ana")!;
    const recipe = st.recipes.find((r) => r.id === item.recipeId)!;
    await fireEvent.press(screen.getAllByText(recipe.name)[0]);
    await fireEvent.press(screen.getByRole("button", { name: "Başka akşama taşı" }));
    const sheetButtons = screen.getAllByText(/ile yer değiştirir|Ana yemek boş/);
    await fireEvent.press(sheetButtons[0]);
    const moved = appStore.getState().planItems.find((i) => i.id === item.id)!;
    expect(moved.date).not.toBe(st.today);
  });

  it("adds a dish to an empty slot from the picker", async () => {
    await freshStore({ demo: true });
    await render(<Week />);
    const add = screen.getAllByRole("button").find((b) => /· Salata ekle$/.test(String(b.props.accessibilityLabel)))!;
    const label = String(add.props.accessibilityLabel);
    await fireEvent.press(add);
    await fireEvent.changeText(screen.getByLabelText("Tarif ara"), "cacık");
    await fireEvent.press(screen.getAllByText("Cacık").at(-1)!);
    expect(appStore.getState().planItems.some((i) => i.slot === "salata" && i.recipeId === "cacik")).toBe(true);
    expect(label).toMatch(/Salata ekle/);
  });
});

describe("Eşleş", () => {
  it("shows a card; 'Bu sefer değil' moves to the next one", async () => {
    await freshStore({ demo: true });
    await render(<Match />);
    expect(screen.getByText("Ne dersin?")).toBeTruthy();
    const counter = () => screen.getByLabelText(/karttan/).props.accessibilityLabel as string;
    const first = counter();
    await fireEvent.press(screen.getByRole("button", { name: "Bu sefer değil" }));
    expect(counter()).not.toBe(first);
  });

  it("alone in a household, 'Olur' is a match: the moment opens and 'put' plans it", async () => {
    await freshStore();
    await appStore.getState().signUp({ name: "Ali", email: "ali@ornek.com", password: "123456" });
    await appStore.getState().createHousehold();
    await appStore.getState().refresh();
    await render(<Match />);
    await fireEvent.press(screen.getByRole("button", { name: "Olur" }));
    const put = await screen.findByRole("button", { name: /koy$/ });
    expect(appStore.getState().matches).toHaveLength(1);
    await fireEvent.press(put);
    expect(appStore.getState().planItems.some((i) => i.source === "match")).toBe(true);
  }, 20000);
});

