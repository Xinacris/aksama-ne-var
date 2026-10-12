import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import AkisPage from "@/app/(app)/akis/page";
import AyarlarPage from "@/app/(app)/ayarlar/page";
import { useApp } from "@/store/app";
import { router } from "../setup";
import { freshStore, soloUser } from "./helpers";

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

describe("Ayarlar", () => {
  it("updates the profile name and initial", async () => {
    await freshStore({ demo: true });
    render(<AyarlarPage />);
    const name = screen.getByLabelText("Adın");
    await userEvent.clear(name);
    await userEvent.type(name, "Ali Can");
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(useApp.getState().me?.name).toBe("Ali Can");
  });

  it("switches theme and persists the preference", async () => {
    await freshStore({ demo: true });
    render(<AyarlarPage />);
    await userEvent.click(screen.getByRole("button", { name: "Koyu" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("anv.theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Koyu" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Açık" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("solo household shows the invite link and WhatsApp share", async () => {
    await freshStore();
    await soloUser();
    render(<AyarlarPage />);
    expect(screen.getByLabelText("Davet linki")).toHaveValue(`localhost:3000/ev/${useApp.getState().household!.inviteCode}`);
    expect(screen.getByRole("link", { name: /WhatsApp ile gönder/ })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/\?text=/));
  });

  it("reset asks first, then clears everything", async () => {
    await freshStore({ demo: true });
    render(<AyarlarPage />);
    await userEvent.click(screen.getByRole("button", { name: "Tüm verileri sıfırla" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Geri alınamaz");
    await userEvent.click(screen.getByRole("button", { name: "Evet, hepsini sil" }));
    expect(useApp.getState().status).toBe("anon");
    expect(router.replace).toHaveBeenCalledWith("/giris");
  });

  it("exports JSON without password hashes", async () => {
    await freshStore({ demo: true });
    const json = JSON.parse(await useApp.getState().exportJson());
    expect(json.data.users[0].passwordHash).toBe("[gizli]");
    expect(json.data.planItems.length).toBeGreaterThan(0);
  });
});

describe("Akış", () => {
  it("groups activity by day", async () => {
    await freshStore({ demo: true });
    render(<AkisPage />);
    expect(screen.getByRole("heading", { name: "Bugün" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dün" })).toBeInTheDocument();
    expect(screen.getByText(/Perşembe'ye tavuk sote ekledi/)).toBeInTheDocument();
  });

  it("empty state", async () => {
    await freshStore();
    await soloUser();
    render(<AkisPage />);
    expect(screen.getByRole("heading", { name: "Henüz sessiz" })).toBeInTheDocument();
  });
});
