import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { CookingMode } from "@/components/cooking/CookingMode";
import { R } from "../unit/domain/helpers";
import { useApp } from "@/store/app";
import { freshStore } from "./helpers";

beforeAll(() => {
  // jsdom has no PointerEvent; a MouseEvent subclass keeps clientX/clientY for the swipe.
  if (!("PointerEvent" in window)) (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {};
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

const MON = "2026-10-12";

async function openMenu() {
  await freshStore({ demo: true });
  const view = render(<CookingMode id={MON} />);
  await screen.findByRole("heading", { level: 1, name: "Hazırlık" });
  return view;
}

describe("cooking mode", () => {
  it("Hazırlık: pending prep on top, merged ingredients to tick, then steps", async () => {
    await openMenu();
    expect(screen.getByRole("heading", { level: 1, name: "Hazırlık" })).toHaveFocus();
    expect(screen.getByRole("region", { name: "Önceden yapılacaklar" })).toHaveTextContent("Kıymayı buzluktan çıkar");
    const list = screen.getByRole("list", { name: "Malzemeler" });
    const kiyma = within(list).getByRole("button", { name: /Kıyma/ });
    await userEvent.click(kiyma);
    expect(kiyma).toHaveAttribute("aria-pressed", "true");
    expect(useApp.getState().cookingSessions[0].checked).toContain("kıyma");
    expect(useApp.getState().activity[0]).toMatchObject({ type: "cooking.started", data: { date: MON } });

    await userEvent.click(screen.getByRole("button", { name: "Pişirmeye başla" }));
    const tabs = screen.getByRole("tablist", { name: "Yemekler" });
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual([
      `Mercimek1/${R("Mercimek çorbası").steps.length}`,
      `İzmir köfte1/${R("İzmir köfte").steps.length}`,
      `Pirinç pilavı1/${R("Tereyağlı pirinç pilavı").steps.length}`,
      `Çoban salata1/${R("Çoban salata").steps.length}`,
    ]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mercimek çorbası · Adım 1 /");
  });

  it("steps: Sonraki/Önceki, arrow keys and swipes; each dish keeps its own step; focus follows", async () => {
    await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "Pişirmeye başla" }));
    const corba = R("Mercimek çorbası");
    expect(screen.getByText(corba.steps[0])).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Önceki" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    expect(screen.getByText(corba.steps[1])).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText(corba.steps[2])).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText(corba.steps[1])).toBeInTheDocument();

    // swipe left on the step = next
    const area = document.getElementById("pisir-adim")!;
    fireEvent.pointerDown(area, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(area, { clientX: 150, clientY: 210 });
    expect(await screen.findByText(corba.steps[2])).toBeInTheDocument();
    // a vertical scroll is not a swipe
    fireEvent.pointerDown(area, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(area, { clientX: 130, clientY: 400 });
    await act(async () => {});
    expect(screen.getByText(corba.steps[2])).toBeInTheDocument();

    // jump to the köfte: it starts at its own step 1, the soup keeps step 3
    await userEvent.click(screen.getByRole("tab", { name: /İzmir köfte/ }));
    const kofte = R("İzmir köfte");
    expect(screen.getByText(kofte.steps[0])).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Mercimek/ }));
    expect(screen.getByText(corba.steps[2])).toBeInTheDocument();
    const total = ["Mercimek çorbası", "İzmir köfte", "Tereyağlı pirinç pilavı", "Çoban salata"].reduce((n, name) => n + R(name).steps.length, 0);
    expect(screen.getByText(`adım 3/${total}`)).toBeInTheDocument();
  });

  it("leaving and coming back resumes where you were", async () => {
    const view = await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "Pişirmeye başla" }));
    await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    view.unmount();
    render(<CookingMode id={MON} />);
    expect(await screen.findByText(R("Mercimek çorbası").steps[1])).toBeInTheDocument();
    expect(useApp.getState().cookingSessions).toHaveLength(1);
    expect(useApp.getState().activity.filter((a) => a.type === "cooking.started")).toHaveLength(1);
  });

  it("a single recipe: no tabs; last step finishes", async () => {
    await freshStore({ demo: true });
    render(<CookingMode id="menemen" />);
    await userEvent.click(await screen.findByRole("button", { name: "Pişirmeye başla" }));
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const steps = R("Menemen").steps;
    for (let i = 1; i < steps.length; i++) await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    expect(screen.getByText(steps.at(-1)!)).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Bitti" }));
    });
    expect(useApp.getState().cookingSessions[0]).toMatchObject({ phase: "done" });
  });

  it("calm empty state when there is nothing to cook", async () => {
    await freshStore({ demo: true });
    render(<CookingMode id="2026-10-16" />);
    expect(screen.getByRole("heading", { name: "Pişirilecek adım yok" })).toBeInTheDocument();
  });
});
