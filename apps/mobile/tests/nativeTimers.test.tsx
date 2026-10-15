import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { finishKey, finishUuid } from "@anv/core/domain/timerAlarm";
import { setNow } from "@anv/core/lib/clock";
import { appStore } from "@anv/core/store/app";
import { AlarmHost } from "@/alarm/AlarmHost";
import { resetAlarmPrefsForTests } from "@/alarm/prefs";
import Cooking from "@/app/pisir/[id]";
import Settings from "@/app/ayarlar";
import { freshStore, routerMock } from "./helpers";

// A stand-in for the local AlarmKit module (modules/anv-alarmkit): an in-memory list of alarms.
const mockKit = {
  supported: true,
  auth: "authorized" as "authorized" | "denied" | "notDetermined",
  alarms: new Map<string, { seconds: number; title: string; sound: string }>(),
};
const mockNative = {
  isSupported: () => mockKit.supported,
  authorizationState: () => mockKit.auth,
  requestAuthorization: jest.fn(async () => mockKit.auth),
  scheduleTimer: jest.fn(async (id: string, seconds: number, title: string, _stop: string, sound: string) => {
    mockKit.alarms.set(id, { seconds, title, sound });
    return true;
  }),
  cancel: jest.fn((id: string) => void mockKit.alarms.delete(id)),
  scheduledIds: () => [...mockKit.alarms.keys()],
};
jest.mock("expo", () => ({ ...jest.requireActual("expo"), requireOptionalNativeModule: jest.fn((name: string) => (name === "AnvAlarmKit" ? mockNative : null)) }));

type Req = { identifier: string; content: { data: { timerId: string } } };
const notif = () => jest.requireMock("expo-notifications") as { __state: { granted: boolean; canAskAgain: boolean; scheduled: Req[] }; requestPermissionsAsync: jest.Mock };
const launcher = () => jest.requireMock("expo-intent-launcher") as { startActivityAsync: jest.Mock };
const audio = () => jest.requireMock("expo-audio") as { __player: { play: jest.Mock } };

const T0 = new Date(2026, 9, 12, 19, 0);
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const os = Platform.OS;

function setPlatform(value: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => value });
}

async function openKuruFasulye() {
  await freshStore({ demo: true });
  setNow(T0);
  routerMock().__params.current = { id: "kuru-fasulye" };
  await render(
    <>
      <Cooking />
      <AlarmHost />
    </>,
  );
  const start = screen.queryByRole("button", { name: /Yine de başla|^Başla$/ });
  if (start) await fireEvent.press(start);
  await fireEvent.press(await screen.findByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ }));
}

const timer = () => appStore.getState().cookingSessions[0].timers[0];
const scheduledFor = (id: string) => notif().__state.scheduled.filter((r) => r.content.data.timerId === id);

beforeEach(() => {
  const n = notif().__state;
  n.granted = true;
  n.canAskAgain = true;
  n.scheduled = [];
  mockKit.supported = true;
  mockKit.auth = "authorized";
  mockKit.alarms.clear();
  jest.clearAllMocks();
  resetAlarmPrefsForTests();
  delete process.env.EXPO_PUBLIC_ENABLE_ALARMKIT;
});
afterEach(() => setPlatform(os as "ios" | "android"));

describe("Android: Telefonun saatinde kur", () => {
  beforeEach(() => setPlatform("android"));

  it("hands the running timer to the Clock app and drops the app's notification for it", async () => {
    await openKuruFasulye();
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: telefonun saatinde kur" }));
    expect(launcher().startActivityAsync).toHaveBeenCalledWith("android.intent.action.SET_TIMER", {
      extra: { "android.intent.extra.alarm.LENGTH": 600, "android.intent.extra.alarm.MESSAGE": "Kuru fasulye · 10 dk", "android.intent.extra.alarm.SKIP_UI": true },
    });
    expect(await screen.findByText(/Telefonun saatinde kuruldu/)).toBeTruthy();
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(0));
    // it rings on the Clock app, not in the app too
    setNow(at(601));
    await act(async () => void (await new Promise((r) => setTimeout(r, 1100))));
    expect(audio().__player.play).not.toHaveBeenCalled();
  }, 20000);

  it("+1 dk is a new finish the Clock app doesn't know: the app's notification comes back for it", async () => {
    await openKuruFasulye();
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: telefonun saatinde kur" }));
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(0));
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: 1 dakika ekle" }));
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
    expect(screen.queryByText(/Telefonun saatinde kuruldu/)).toBeNull();
  }, 20000);

  it("no Clock app: a calm error, and the app keeps the timer", async () => {
    launcher().startActivityAsync.mockRejectedValueOnce(new Error("No Activity found to handle Intent"));
    await openKuruFasulye();
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: telefonun saatinde kur" }));
    await waitFor(() => expect(appStore.getState().notice?.text).toMatch(/Telefonun saati açılamadı/));
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
  }, 20000);

  it("isn't offered on iOS", async () => {
    setPlatform("ios");
    await openKuruFasulye();
    expect(screen.queryByRole("button", { name: /telefonun saatinde kur/ })).toBeNull();
  }, 20000);
});

describe("iOS: AlarmKit (flag on)", () => {
  beforeEach(() => {
    setPlatform("ios");
    process.env.EXPO_PUBLIC_ENABLE_ALARMKIT = "1";
  });

  it("a timer becomes a system alarm (with the app's sound), no app notification; +1 dk moves it; close cancels it", async () => {
    await openKuruFasulye();
    const key = () => finishKey(timer());
    await waitFor(() => expect(mockKit.alarms.get(finishUuid(key()))).toMatchObject({ seconds: 600, title: "Süre doldu: Kuru fasulye · 10 dk", sound: "timer_alarm.wav" }));
    expect(notif().requestPermissionsAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(0));

    const before = finishUuid(key());
    await fireEvent.press(screen.getByRole("button", { name: "Adım 1: 1 dakika ekle" }));
    await waitFor(() => expect([...mockKit.alarms.keys()]).toEqual([finishUuid(key())]));
    expect(mockKit.alarms.has(before)).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: "Adım 1 zamanlayıcısını kapat" }));
    await waitFor(() => expect(mockKit.alarms.size).toBe(0));
  }, 20000);

  it("alarms refused: one hint, then the app's notification as before", async () => {
    mockKit.auth = "denied";
    await openKuruFasulye();
    await waitFor(() => expect(appStore.getState().notice?.text).toMatch(/Alarm izni kapalı/));
    expect(notif().requestPermissionsAsync).toHaveBeenCalledTimes(0);
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
    expect(mockKit.alarms.size).toBe(0);
  }, 20000);

  it("Ayarlar › Zamanlayıcı türü: Uygulama bildirimi cancels the system alarms and goes back to notifications", async () => {
    await openKuruFasulye();
    await waitFor(() => expect(mockKit.alarms.size).toBe(1));
    await screen.unmount();
    await render(
      <>
        <Settings />
        <AlarmHost />
      </>,
    );
    expect(screen.getByText("Zamanlayıcı türü")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Uygulama bildirimi" }));
    await waitFor(() => expect(mockKit.alarms.size).toBe(0));
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
  }, 20000);

  it("timer sound off: no system alarm (it can't ring silently), the silent notification instead", async () => {
    await freshStore({ demo: true });
    await render(<Settings />);
    await fireEvent.press((await screen.findAllByRole("button", { name: "Kapalı" }))[0]);
    await screen.unmount();
    await openKuruFasulye();
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
    expect(mockKit.alarms.size).toBe(0);
  }, 20000);
});

describe("iOS without AlarmKit", () => {
  beforeEach(() => setPlatform("ios"));

  it("flag off (the default build): no Zamanlayıcı türü, the app's notification", async () => {
    await openKuruFasulye();
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
    expect(mockKit.alarms.size).toBe(0);
    await screen.unmount();
    await render(<Settings />);
    expect(screen.queryByText("Zamanlayıcı türü")).toBeNull();
  }, 20000);

  it("flag on but iOS < 26: the same", async () => {
    process.env.EXPO_PUBLIC_ENABLE_ALARMKIT = "1";
    mockKit.supported = false;
    await openKuruFasulye();
    await waitFor(() => expect(scheduledFor(timer().id)).toHaveLength(1));
    expect(mockKit.alarms.size).toBe(0);
  }, 20000);
});
