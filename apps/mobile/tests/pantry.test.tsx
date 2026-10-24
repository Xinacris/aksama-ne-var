import * as Notifications from "expo-notifications";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { setNow } from "@anv/core/lib/clock";
import { appStore } from "@anv/core/store/app";
import PantryStep from "@/app/onboarding/evde";
import Pantry from "@/app/evde/index";
import PantryCheckScreen from "@/app/evde/kontrol";
import Today from "@/app/(tabs)/bugun";
import SignIn from "@/app/(auth)/index";
import { syncPantryNotifications } from "@/reminders/notifications";
import { PantryReminderHost } from "@/reminders/PantryReminderHost";
import { planPantryReminders, DEFAULT_REMINDER_SETTINGS } from "@anv/core/domain/pantryReminders";
import { recipesMap } from "@/store";
import { freshStore, routerMock } from "./helpers";

const notif = Notifications as unknown as { __state: { granted: boolean; canAskAgain: boolean; scheduled: { identifier: string; content: { data?: { kind?: string; url?: string } } }[] } };

beforeEach(() => {
  routerMock().router.push.mockClear();
  routerMock().router.replace.mockClear();
  routerMock().__params.current = {};
  notif.__state.scheduled = [];
  notif.__state.granted = true;
});

describe("onboarding: Evde neler var? (Round 3.5)", () => {
  it("chips, search and free text add to the pantry; continue goes to the invite", async () => {
    await freshStore({ demo: true });
    // Start from an empty pantry, like a new household.
    for (const p of appStore.getState().pantry) await appStore.getState().removePantryItem(p.id);
    await render(<PantryStep />);
    expect(screen.getByText("Adım 2 / 3")).toBeTruthy();
    await fireEvent.press(screen.getByText("Yumurta"));
    await fireEvent.changeText(screen.getByLabelText("Malzeme ara ya da yaz"), "Annemin salçası");
    await fireEvent.press(screen.getByTestId("pantry-add-free"));
    expect(screen.getByText("2 şey seçildi")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("pantry-continue"));
    expect(appStore.getState().pantry.map((p) => p.name).sort()).toEqual(["Annemin salçası", "Yumurta"]);
    expect(routerMock().router.push).toHaveBeenCalledWith("/onboarding/davet");
  });

  it("can be skipped; for a joining partner it is the last step", async () => {
    await freshStore({ demo: true });
    routerMock().__params.current = { son: "1" };
    await render(<PantryStep />);
    expect(screen.getByText("Adım 2 / 2")).toBeTruthy();
    await fireEvent.press(screen.getByText("Şimdilik geç"));
    expect(routerMock().router.push).not.toHaveBeenCalled();
    expect(appStore.getState().me?.onboarded).toBe(true);
  });
});

describe("Evde ne var? screen", () => {
  it("groups by category, marks az kaldı, edits an amount and removes", async () => {
    await freshStore({ demo: true });
    await render(<Pantry />);
    expect(screen.getByText(/^Son güncelleme: /)).toBeTruthy();
    expect(screen.getByText(/^Kasap · /)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Kıyma: düzenle"));
    await fireEvent.changeText(screen.getByLabelText("Miktar"), "750");
    await fireEvent.press(screen.getByTestId("pantry-save"));
    expect(appStore.getState().pantry.find((p) => p.name === "Kıyma")!.quantity).toBe(750);
    await fireEvent.press(screen.getByLabelText("Kıyma: kaldır"));
    expect(appStore.getState().pantry.some((p) => p.name === "Kıyma")).toBe(false);
  });
});

describe("reminders on the phone", () => {
  it("schedules the evening-before and morning-of notifications; answering cancels them", async () => {
    await freshStore({ demo: true }); // Monday 08:45
    const st = () => appStore.getState();
    const plan = () => planPantryReminders({ now: new Date(2026, 9, 12, 8, 45), planItems: st().planItems, planDays: st().planDays, recipesById: recipesMap(st().recipes), pantry: st().pantry, answers: st().pantryAnswers, settings: DEFAULT_REMINDER_SETTINGS });
    await syncPantryNotifications(plan().scheduled, new Map());
    const ids = notif.__state.scheduled.map((s) => s.identifier);
    expect(ids.some((id) => id.startsWith("pantry:evening:2026-10-13@"))).toBe(true);
    expect(ids.some((id) => id.startsWith("pantry:morning:2026-10-13@"))).toBe(true);
    expect(notif.__state.scheduled[0].content.data?.url).toMatch(/^\/evde\/kontrol\?r=/);
    await st().answerPantryCheck("day:2026-10-13", { [plan().scheduled.find((r) => r.date === "2026-10-13")!.ingredients[0]]: "have" });
    await syncPantryNotifications(plan().scheduled, new Map());
    expect(notif.__state.scheduled.some((s) => s.identifier.includes("2026-10-13"))).toBe(false);
  });

  it("without permission nothing is scheduled and the banner shows due reminders instead", async () => {
    notif.__state.granted = false;
    await freshStore({ demo: true });
    setNow(new Date(2026, 9, 12, 21, 0)); // after the evening reminder for Tuesday
    const result = await syncPantryNotifications([], new Map());
    expect(result).toBe("noPermission");
    await render(<Today />);
    expect(screen.getByTestId("pantry-banner")).toBeTruthy();
    expect(screen.getByText("Yarın için evde ne var?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("pantry-banner-open"));
    expect(routerMock().router.push).toHaveBeenCalledWith("/evde/kontrol?r=evening%3A2026-10-13");
  });

  it("the quick check marks var / yok / az kaldı and records the answer", async () => {
    await freshStore({ demo: true });
    setNow(new Date(2026, 9, 12, 21, 0));
    routerMock().__params.current = { r: "evening:2026-10-13" };
    await render(<PantryCheckScreen />);
    const radios = screen.getAllByRole("radio");
    await fireEvent.press(radios[0]); // first item: var
    await fireEvent.press(radios[4]); // second item: yok
    await fireEvent.press(screen.getByTestId("pantry-check-done"));
    expect(appStore.getState().pantryAnswers.map((a) => a.key)).toContain("day:2026-10-13");
    expect(routerMock().router.replace).toHaveBeenCalledWith("/evde");
  });

  it("the host reconciles on mount without touching timer notifications", async () => {
    await freshStore({ demo: true });
    notif.__state.scheduled.push({ identifier: "timer-abc:a", content: {} });
    await render(<PantryReminderHost />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const ids = notif.__state.scheduled.map((s) => s.identifier);
    expect(ids).toContain("timer-abc:a");
    expect(ids.some((id) => id.startsWith("pantry:"))).toBe(true);
  });
});

describe("welcome: sign-in providers are 'Yakında' (Round 3.5)", () => {
  it("shows Google / Apple / e-posta as unavailable; Giriş yapmadan devam et opens the local sign-up", async () => {
    await freshStore();
    await render(<SignIn />);
    for (const p of ["google", "apple", "email"]) expect(screen.getByTestId(`auth-${p}`).props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByLabelText("Google ile giriş yap (yakında)")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("continue-local"));
    expect(routerMock().router.push).toHaveBeenCalledWith("/kayit");
  });
});
