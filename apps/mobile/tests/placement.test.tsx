import { fireEvent, render, screen } from "@testing-library/react-native";
import { appStore } from "@anv/core/store/app";
import { addDays } from "@anv/core/domain/dates";
import Recipes from "@/app/(tabs)/tarifler";
import { freshStore, routerMock } from "./helpers";

beforeEach(() => {
  routerMock().router.push.mockClear();
});

describe("Tarifler: long-press → Güne ekle → day (Round 3.5)", () => {
  it("puts a dessert in the dessert slot of the chosen day, without a match", async () => {
    await freshStore({ demo: true });
    await render(<Recipes />);
    await fireEvent.changeText(screen.getByLabelText("Tarif ya da malzeme ara"), "Sütlaç");
    await fireEvent(screen.getByTestId("recipe-row-sutlac"), "longPress");
    await fireEvent.press(screen.getByTestId("recipe-add-to-day"));
    const day = addDays(appStore.getState().today, 2);
    await fireEvent.press(screen.getByTestId(`day-choice-${day}`));
    const st = appStore.getState();
    expect(st.planItems.some((i) => i.date === day && i.slot === "tatli" && i.recipeId === "sutlac")).toBe(true);
    expect(st.notice?.text).toMatch(/^Sütlaç → .* · Tatlı\.$/);
  });

  it("a recipe without a category asks for its slot once and saves it", async () => {
    await freshStore({ demo: true });
    const r = await appStore.getState().addStubRecipe("Annemin keki");
    await render(<Recipes />);
    await fireEvent.changeText(screen.getByLabelText("Tarif ya da malzeme ara"), "Annemin keki");
    await fireEvent(screen.getByTestId(`recipe-row-${r.id}`), "longPress");
    await fireEvent.press(screen.getByTestId("recipe-add-to-day"));
    await fireEvent.press(screen.getByTestId("slot-choice-tatli"));
    const day = appStore.getState().today;
    await fireEvent.press(screen.getByTestId(`day-choice-${day}`));
    const st = appStore.getState();
    expect(st.planItems.some((i) => i.date === day && i.slot === "tatli" && i.recipeId === r.id)).toBe(true);
    expect(st.recipes.find((x) => x.id === r.id)?.category).toBe("dessert");
  });

  it("screen readers get the same action", async () => {
    await freshStore({ demo: true });
    await render(<Recipes />);
    await fireEvent.changeText(screen.getByLabelText("Tarif ya da malzeme ara"), "Revani");
    await fireEvent(screen.getByTestId("recipe-row-revani"), "accessibilityAction", { nativeEvent: { actionName: "addToDay" } });
    expect(screen.getByText("Hangi güne?")).toBeTruthy();
  });
});
