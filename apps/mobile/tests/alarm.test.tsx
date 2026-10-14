import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CookingSession } from "@anv/core/data/models";
import { newTimer, pauseTimer, resumeTimer } from "@anv/core/domain/cooking";
import { setNow } from "@anv/core/lib/clock";
import { appStore } from "@anv/core/store/app";
import { AlarmHost } from "@/alarm/AlarmHost";
import { CHANNEL, CHANNEL_SILENT, SOUND, syncTimerNotifications } from "@/alarm/notifications";
import { resetAlarmPrefsForTests } from "@/alarm/prefs";
import Cooking from "@/app/pisir/[id]";
import { freshStore, routerMock } from "./helpers";

type Req = { identifier: string; content: { sound: string | false; data: { url: string } }; trigger: { date: Date; channelId: string } };
const notif = () =>
  jest.requireMock("expo-notifications") as { __state: { granted: boolean; canAskAgain: boolean; scheduled: Req[] }; requestPermissionsAsync: jest.Mock; scheduleNotificationAsync: jest.Mock };
const audio = () => jest.requireMock("expo-audio") as { __player: { play: jest.Mock; pause: jest.Mock } };

const T0 = new Date(2026, 9, 12, 19, 0);
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);

/** The demo household with a one-recipe session started at T0; `timers` seconds each, all started at T0. */
async function sessionWith(...timers: number[]): Promise<CookingSession> {
  await freshStore({ demo: true });
  setNow(T0);
  const st = appStore.getState();
  const s = (await st.startCooking("kuru-fasulye", ["kuru-fasulye"], { skipPrep: true }))!;
  const recipe = st.recipes.find((r) => r.id === "kuru-fasulye")!;
  await st.updateCooking(s.id, { timers: timers.map((sec, i) => newTimer({ id: `t${i}`, recipe, step: i, seconds: sec, now: T0 })) });
  return appStore.getState().cookingSessions.find((c) => c.id === s.id)!;
}

beforeEach(() => {
  const n = notif().__state;
  n.granted = true;
  n.canAskAgain = true;
  n.scheduled = [];
  jest.clearAllMocks();
  resetAlarmPrefsForTests();
  routerMock().__params.current = {};
});

describe("background notifications follow the timers", () => {
  it("one per running timer at endsAt, with the alarm sound on the Timers channel and the session's link", async () => {
    const s = await sessionWith(600);
    await syncTimerNotifications([s], T0, true);
    const [req] = notif().__state.scheduled;
    expect(notif().__state.scheduled).toHaveLength(1);
    expect(req.trigger).toMatchObject({ channelId: CHANNEL, date: at(600) });
    expect(req.content.sound).toBe(SOUND);
    expect(req.content.data.url).toBe("/pisir/kuru-fasulye");
  });

  it("pause cancels it, resume schedules the new end, closing the timer cancels it", async () => {
    const s = await sessionWith(600);
    await syncTimerNotifications([s], T0, true);
    const paused = { ...s, timers: s.timers.map((x) => pauseTimer(x, at(100))) };
    await syncTimerNotifications([paused], at(100), true);
    expect(notif().__state.scheduled).toHaveLength(0);
    const resumed = { ...s, timers: paused.timers.map((x) => resumeTimer(x, at(400))) };
    await syncTimerNotifications([resumed], at(400), true);
    expect(notif().__state.scheduled.map((r) => r.trigger.date)).toEqual([at(900)]);
    const closed = { ...s, timers: resumed.timers.map((x) => ({ ...x, dismissed: true })) };
    await syncTimerNotifications([closed], at(401), true);
    expect(notif().__state.scheduled).toHaveLength(0);
  });

  it("timer sound off moves it to the silent channel; a finished session has none", async () => {
    const s = await sessionWith(600);
    await syncTimerNotifications([s], T0, true);
    await syncTimerNotifications([s], T0, false);
    const [req] = notif().__state.scheduled;
    expect(notif().__state.scheduled).toHaveLength(1);
    expect(req.trigger.channelId).toBe(CHANNEL_SILENT);
    expect(req.content.sound).toBe(false);
    await syncTimerNotifications([{ ...s, phase: "done" }], T0, false);
    expect(notif().__state.scheduled).toHaveLength(0);
  });

  it("without permission nothing is scheduled (the in-app alarm still rings)", async () => {
    notif().__state.granted = false;
    const s = await sessionWith(600);
    await syncTimerNotifications([s], T0, true);
    expect(notif().scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("permission on the first timer", () => {
  it("is asked when a timer starts; denied → the one-line hint once", async () => {
    notif().__state.granted = false;
    await freshStore({ demo: true });
    routerMock().__params.current = { id: "kuru-fasulye" };
    await render(<Cooking />);
    const start = screen.queryByRole("button", { name: /Yine de başla|^Başla$/ });
    if (start) await fireEvent.press(start);
    await fireEvent.press(await screen.findByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ }));
    expect(notif().requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(appStore.getState().notice?.text).toMatch(/Bildirim izni kapalı/);
    appStore.getState().setNotice(null);
    // second timer: asked again only if the system allows it; the hint never comes back
    notif().__state.canAskAgain = false;
    await fireEvent.press(screen.getByRole("button", { name: /zamanlayıcısını kapat$/ }));
    await fireEvent.press(await screen.findByRole("button", { name: /Zamanlayıcı başlat · 10 dk/ }));
    expect(notif().requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(appStore.getState().notice).toBeNull();
  }, 20000);
});

describe("the in-app alarm", () => {
  it("rings when a timer reaches zero, with a banner; Durdur stops it and dismisses the timer", async () => {
    await sessionWith(60);
    setNow(at(61));
    await render(<AlarmHost />);
    expect(await screen.findByText(/^Süre doldu: Kuru fasulye/)).toBeTruthy();
    expect(audio().__player.play).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Alarmı durdur" }));
    expect(screen.queryByText(/^Süre doldu/)).toBeNull();
    expect(audio().__player.pause).toHaveBeenCalled();
    expect(appStore.getState().cookingSessions[0].timers[0].dismissed).toBe(true);
  }, 20000);

  it("two timers ending at once: one banner naming both, one sound", async () => {
    await sessionWith(60, 60);
    setNow(at(60));
    await render(<AlarmHost />);
    const banner = await screen.findByText(/^Süre doldu:/);
    expect(banner.props.children).toMatch(/Kuru fasulye · 1 dk ve Kuru fasulye · 1 dk$/);
    expect(audio().__player.play).toHaveBeenCalledTimes(1);
  }, 20000);

  it("no sound on launch for a timer that finished more than 10 minutes ago", async () => {
    await sessionWith(60);
    setNow(at(60 + 11 * 60));
    await render(<AlarmHost />);
    expect(screen.queryByText(/^Süre doldu/)).toBeNull();
    expect(audio().__player.play).not.toHaveBeenCalled();
  }, 20000);

  it("a timer closed while ringing stops the alarm", async () => {
    const s = await sessionWith(60);
    setNow(at(61));
    await render(<AlarmHost />);
    expect(await screen.findByText(/^Süre doldu/)).toBeTruthy();
    await appStore.getState().updateCooking(s.id, { timers: [] });
    expect(screen.queryByText(/^Süre doldu/)).toBeNull();
    expect(audio().__player.pause).toHaveBeenCalled();
  }, 20000);
});
