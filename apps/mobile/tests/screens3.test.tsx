import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
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

  it("the running timer stays under the step (no card, shown once); other steps' timers get the strip", async () => {
    await freshStore({ demo: true });
    routerMock().__params.current = { id: "kuru-fasulye" };
    await render(<Cooking />);
    const start = screen.queryByRole("button", { name: /Yine de başla|^Başla$/ });
    if (start) await fireEvent.press(start);
    await fireEvent.press(await screen.findByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ }));
    // the time appears once, inline, labelled by step; no "Zamanlayıcılar" card, no strip
    const digits = (await screen.findAllByText("10:00"))[0];
    expect(screen.getAllByText("10:00")).toHaveLength(1);
    // fixed layout: tabular figures in a fixed-width box, one line
    expect(StyleSheet.flatten(digits.props.style)).toMatchObject({ fontVariant: ["tabular-nums"], minWidth: expect.any(Number) });
    expect(digits.props.numberOfLines).toBe(1);
    expect(screen.queryByText("Zamanlayıcılar")).toBeNull();
    expect(screen.queryByTestId("other-timers")).toBeNull();
    expect(screen.getByRole("button", { name: "Adım 1: duraklat" })).toBeTruthy();
    // +1 dk keeps the countdown in place (it used to fall back to a start button)
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: 1 dakika ekle" }));
    expect(await screen.findAllByText("11:00")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: duraklat" }));
    expect(await screen.findByText("duraklatıldı")).toBeTruthy();
    // on the next step the timer moves to the strip: "Adım 1", its time, ×; tapping it goes back
    await fireEvent.press(screen.getByRole("button", { name: "Sonraki" }));
    const strip = await screen.findByTestId("other-timers");
    expect(strip).toBeTruthy();
    expect(screen.getByText("Adım 1")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: /^Adım 1: Duraklatıldı, 11:00 kaldı/ }));
    expect(await screen.findByText(/Adım 1 \//)).toBeTruthy();
    expect(screen.queryByTestId("other-timers")).toBeNull();
    // closing it cancels it
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1 zamanlayıcısını kapat" }));
    expect(appStore.getState().cookingSessions[0].timers[0].dismissed).toBe(true);
    expect(await screen.findByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ })).toBeTruthy();
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
