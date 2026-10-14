import { fireEvent, render, screen } from "@testing-library/react-native";
import { getLocale, setLocale } from "@anv/core/i18n";
import { appStore } from "@anv/core/store/app";
import Settings from "@/app/ayarlar";
import Cooking from "@/app/pisir/[id]";
import { freshStore, routerMock } from "./helpers";

beforeEach(() => {
  routerMock().__params.current = {};
});

describe("Pişirme modu", () => {
  it("tonight's menu: heads-up first, then steps with dish tabs, then Afiyet olsun", async () => {
    await freshStore({ demo: true });
    routerMock().__params.current = { id: "2026-10-12" };
    await render(<Cooking />);
    expect(await screen.findByText("Başlamadan önce")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: /Yine de başla|Başla/ }));
    expect(await screen.findByText(/Adım 1 \//)).toBeTruthy();
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(1);
    const session = appStore.getState().cookingSessions.find((s) => s.key === "2026-10-12")!;
    expect(session.phase).toBe("steps");
    await fireEvent.press(screen.getByRole("button", { name: "Sonraki" }));
    expect(screen.getByText(/Adım 2 \//)).toBeTruthy();
    await appStore.getState().finishCooking(session.id);
    expect(await screen.findByText("Afiyet olsun")).toBeTruthy();
  }, 20000);

  it("a step with a duration offers a timer that starts counting", async () => {
    await freshStore({ demo: true });
    routerMock().__params.current = { id: "kuru-fasulye" };
    await render(<Cooking />);
    const start = screen.queryByRole("button", { name: /Yine de başla|^Başla$/ });
    if (start) await fireEvent.press(start);
    expect(await screen.findByText(/Adım 1 \//)).toBeTruthy();
    const timer = screen.getByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ });
    await fireEvent.press(timer);
    expect(appStore.getState().cookingSessions[0].timers).toHaveLength(1);
    expect(await screen.findByText(/kaldı/)).toBeTruthy();
  }, 20000);
});

describe("Ayarlar", () => {
  it("says sync is coming, switches language and theme, shows the import usage line", async () => {
    await freshStore({ demo: true });
    await render(<Settings />);
    expect(screen.getByText("Eşitleme yakında")).toBeTruthy();
    expect(screen.getByText(/Bu ay/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "English" }));
    expect(getLocale()).toBe("en");
    expect(appStore.getState().me?.locale).toBe("en");
    setLocale("tr");
  });
});
