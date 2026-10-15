import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import BugunPage from "@/app/(app)/bugun/page";
import { CookingMode } from "@/components/cooking/CookingMode";
import { cookingExtras } from "@/components/cooking/extras";
import { setNow } from "@anv/core/lib/clock";
import { stepTimers } from "@anv/core/domain/cooking";
import { ALARM_VIBRATION } from "@anv/core/domain/timerAlarm";
import { useApp } from "@/store/app";
import { R } from "@anv/core/testing/builders";
import { freshStore } from "./helpers";

const MON = "2026-10-12";
const at = (h: number, m: number, s = 0) => new Date(2026, 9, 12, h, m, s);

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

async function stepsOfMenu() {
  await freshStore({ demo: true, at: at(18, 0) });
  const view = render(<CookingMode id={MON} extras={cookingExtras} />);
  await userEvent.click(await screen.findByRole("button", { name: "Yine de başla" }));
  return view;
}

const OTHER = { name: "Diğer zamanlayıcılar" };

describe("cooking timers", () => {
  it("start two timers on different dishes; the step shows its own, the strip the others; finish rings until Durdur", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    await stepsOfMenu();
    const corba = R("Mercimek çorbası");
    // first step with a real duration ("birkaç dakika" is not one)
    const idx = corba.steps.findIndex((t) => stepTimers(t).length > 0);
    expect(idx).toBeGreaterThan(0);
    for (let i = 0; i < idx; i++) await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    await userEvent.click(screen.getByRole("button", { name: /^Zamanlayıcı başlat/ }));
    // shown once, in place of its button; no strip while only this step has a timer
    expect(screen.getAllByText("20:00")).toHaveLength(1);
    expect(screen.queryByRole("region", OTHER)).toBeNull();
    expect(screen.getByRole("button", { name: new RegExp(`· Adım ${idx + 1}: duraklat$`) })).toBeInTheDocument();

    // five minutes later, a second timer on the köfte (resting harç): the soup moves to the strip
    setNow(at(18, 5));
    await userEvent.click(screen.getByRole("tab", { name: /İzmir köfte/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Zamanlayıcı başlat · 20 dk/ }));
    const strip = screen.getByRole("region", OTHER);
    expect(within(strip).getAllByRole("listitem")).toHaveLength(1);
    expect(strip).toHaveTextContent(new RegExp(`Mercimek.* · Adım ${idx + 1}\\d+:\\d\\d`));
    const timers = useApp.getState().cookingSessions[0].timers;
    expect(timers.map((t) => t.endsAt)).toEqual([at(18, 20).toISOString(), at(18, 25).toISOString()]);

    // 18:20: the soup rings, the köfte keeps counting under its step
    setNow(at(18, 20, 1));
    expect(await screen.findByText(/Süre doldu:/, {}, { timeout: 2500 })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Süre doldu: Mercimek çorbası · 20 dk");
    expect(await screen.findByText("4:59", {}, { timeout: 2500 })).toBeInTheDocument();
    expect(vibrate).toHaveBeenCalledWith(ALARM_VIBRATION);
    // Durdur: the banner goes, the vibration stops, the soup timer is dismissed (everywhere sync reaches)
    await userEvent.click(screen.getByRole("button", { name: "Alarmı durdur" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(vibrate).toHaveBeenLastCalledWith(0);
    expect(useApp.getState().cookingSessions[0].timers.find((t) => t.endsAt === at(18, 20).toISOString())?.dismissed).toBe(true);
    expect(screen.queryByRole("region", OTHER)).toBeNull();
  });

  it("+1 dk keeps the countdown in place; a strip timer opens its step", async () => {
    await stepsOfMenu();
    await userEvent.click(screen.getByRole("tab", { name: /İzmir köfte/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Zamanlayıcı başlat · 20 dk/ }));
    await userEvent.click(screen.getByRole("button", { name: /Adım 1: 1 dakika ekle$/ }));
    expect(screen.getByText("21:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Zamanlayıcı başlat · 20 dk/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    const strip = screen.getByRole("region", OTHER);
    await userEvent.click(within(strip).getByRole("button", { name: /Adım 1: 21:00 kaldı/ }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Adım 1 /");
    expect(screen.queryByRole("region", OTHER)).toBeNull();
  });

  it("timers survive a reload (end timestamps, not counters)", async () => {
    const view = await stepsOfMenu();
    await userEvent.click(screen.getByRole("tab", { name: /İzmir köfte/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Zamanlayıcı başlat · 20 dk/ }));
    view.unmount();
    setNow(at(18, 5));
    render(<CookingMode id={MON} extras={cookingExtras} />);
    expect(await screen.findByText("15:00")).toBeInTheDocument();
  });
});

describe("finish → leftover question", () => {
  it("'Afiyet olsun' marks tonight cooked, pre-selects Artmaz, applies the choice, quick-adds to the list", async () => {
    await stepsOfMenu();
    // jump to the last dish's last step
    const salata = R("Çoban salata");
    await userEvent.click(screen.getByRole("tab", { name: /Çoban salata/ }));
    for (let i = 1; i < salata.steps.length; i++) await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    // other dishes are not done: the button offers the next one; finish from the last
    for (const name of [/Mercimek/, /İzmir köfte/, /Pirinç pilavı/]) {
      await userEvent.click(screen.getByRole("tab", { name }));
      while (screen.queryByRole("button", { name: "Sonraki" })) await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Bitti" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Afiyet olsun" })).toHaveFocus();
    const st = useApp.getState();
    expect(st.planDays.find((d) => d.date === MON)?.status).toBe("cooked");
    expect(st.cookLog.filter((c) => c.date === MON).map((c) => c.recipeId).sort()).toEqual(["coban-salata", "izmir-kofte", "mercimek-corbasi", "tereyagli-pirinc-pilavi"]);
    // the clock is pinned, so check presence rather than order
    expect(st.activity.some((a) => a.type === "cooking.finished" && a.data.date === MON)).toBe(true);

    const card = screen.getByRole("region", { name: "Artan yemek" });
    // Nothing is guessed: "Hiç kalmadı" (Artmaz) is pre-selected until someone keeps it
    expect(within(card).getByRole("button", { name: "Hiç kalmadı" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("button", { name: "Dolaba kaldır" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(within(card).getByRole("button", { name: "Yarın öğlen" }));
    expect(useApp.getState().planDays.find((d) => d.date === MON)?.leftoverChoice).toBe("lunch");

    await userEvent.type(screen.getByLabelText("Listeye eklenecek ürün"), "salça");
    await userEvent.click(screen.getByRole("button", { name: "Listeye ekle" }));
    expect(screen.getByText("Listeye eklendi: salça")).toBeInTheDocument();
    expect(useApp.getState().shoppingItems.some((i) => i.name === "Domates salçası" || i.name === "Salça")).toBe(true);
  });
});

describe("Bugün while cooking", () => {
  it("the tonight card shows who is cooking and the progress", async () => {
    await freshStore({ demo: true, at: at(18, 0) });
    const kofte = R("İzmir köfte");
    const ids = ["mercimek-corbasi", "izmir-kofte", "tereyagli-pirinc-pilavi", "coban-salata"];
    const sess = (await useApp.getState().startCooking(MON, ids))!;
    await useApp.getState().updateCooking(sess.id, { phase: "steps", positions: { "mercimek-corbasi": 1, [kofte.id]: 1 } });
    render(<BugunPage />);
    expect(screen.getByText(/^Pişiyor · adım 3\//)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Devam et" })).toHaveAttribute("href", `/pisir/${MON}`);
  });

  it("the partner sees 'Ali pişiriyor'", async () => {
    await freshStore({ demo: true, at: at(18, 0) });
    await useApp.getState().startCooking(MON, ["izmir-kofte"]);
    const zeynep = useApp.getState().people.find((p) => p.name === "Zeynep")!;
    // Same session seen from Zeynep's side
    useApp.setState({ me: zeynep });
    render(<BugunPage />);
    expect(screen.getByText(/^Ali pişiriyor · hazırlık/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mutfağa bak" })).toBeInTheDocument();
  });
});
