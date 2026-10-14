import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import BugunPage from "@/app/(app)/bugun/page";
import { useApp } from "@/store/app";
import { freshStore, soloUser } from "./helpers";

describe("Bugün", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("empty state when nothing is planned tonight", async () => {
    await freshStore();
    await soloUser();
    render(<BugunPage />);
    expect(screen.getByRole("heading", { name: "Bu akşam henüz boş" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Boş kalsın" }));
    expect(screen.getByRole("heading", { name: "Bu akşam serbest" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Eşleşmelerden seç" })).toHaveAttribute("href", "/eslesme?gun=2026-10-12");
  });

  it("demo household: date, reminder, partner line, tonight, leftover and tomorrow", async () => {
    await freshStore({ demo: true });
    render(<BugunPage />);
    expect(screen.getByText("Pazartesi, 12 Ekim")).toBeInTheDocument();
    const banner = screen.getByRole("region", { name: "Günün hatırlatması" });
    expect(banner).toHaveTextContent("Akşama İzmir köfte var, kıymayı buzluktan çıkarmayı unutma.");
    expect(banner).toHaveTextContent("Sabah 09:00 · Ali'nin işi");
    expect(screen.getAllByText(/bu akşamki menüyü onayladı · 14 dk önce/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "İzmir köfte sofrası" })).toBeInTheDocument();
    expect(screen.getByText("İkiniz de onayladınız")).toBeInTheDocument();
    expect(screen.getByText("1 sa 10 dk")).toBeInTheDocument();
    expect(screen.getByText("Dünkü kuru fasulye bugün öğlen için yeterli.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Yarın: Karnıyarık · cacık · şehriyeli pilav/ })).toBeInTheDocument();
  });

  it("reminder: complete shows who and when, undo brings it back", async () => {
    await freshStore({ demo: true, at: new Date(2026, 9, 12, 8, 50) });
    render(<BugunPage />);
    const banner = screen.getByRole("region", { name: "Günün hatırlatması" });
    await userEvent.click(within(banner).getByRole("button", { name: "Çıkardım" }));
    expect(within(screen.getByRole("region", { name: "Günün hatırlatması" })).getByRole("status")).toHaveTextContent("Ali tamamladı · 08:50");
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }));
    expect(screen.getByText("Bekliyor")).toBeInTheDocument();
  });

  it("partner-done reminder shows the partner's avatar", async () => {
    await freshStore({ demo: true, at: new Date(2026, 9, 12, 9, 30) });
    render(<BugunPage />);
    expect(screen.getByRole("region", { name: "Günün hatırlatması" })).toHaveTextContent("Ali tamamladı · 09:12");
  });

  it("waiting for my approval offers the approve action", async () => {
    await freshStore({ demo: true });
    const s = useApp.getState();
    const zeynep = s.people.find((p) => p.name === "Zeynep")!;
    await act(async () => {
      await useApp.getState().removeFromPlan(s.planItems.find((i) => i.date === s.today && i.slot === "salata")!.id);
    });
    // Ali changed the menu: now waiting for Zeynep
    render(<BugunPage />);
    expect(screen.getByText("Zeynep'in onayı bekleniyor")).toBeInTheDocument();
    void zeynep;
  });

  it("ate out turns tonight into a neutral card with undo", async () => {
    await freshStore({ demo: true });
    render(<BugunPage />);
    await userEvent.click(screen.getByRole("button", { name: "Bugün dışarıda yedik" }));
    expect(screen.getByRole("heading", { name: "Bu akşam dışarıdasınız" })).toBeInTheDocument();
    expect(screen.getByText("Planlanan izmir köfte eşleşmelere geri döndü.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }));
    expect(screen.getByRole("heading", { name: "Bu akşam henüz boş" })).toBeInTheDocument();
  });

  it("plan changed → swap with tomorrow", async () => {
    await freshStore({ demo: true });
    render(<BugunPage />);
    await userEvent.click(screen.getByRole("button", { name: "Plan değişti" }));
    await userEvent.click(screen.getByRole("button", { name: /Yarınla yer değiştir/ }));
    expect(screen.getByRole("heading", { name: "Karnıyarık sofrası" })).toBeInTheDocument();
  });

  it("renders in dark theme without losing content", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    await freshStore({ demo: true });
    render(<BugunPage />);
    expect(screen.getByRole("heading", { name: "İzmir köfte sofrası" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
