import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IceAktarPage from "@/app/(app)/tarifler/ice-aktar/page";
import TarifPage from "@/app/(app)/tarif/[id]/page";
import AyarlarPage from "@/app/(app)/ayarlar/page";
import { parseRecipeText } from "@/domain/import/parseText";
import { useApp } from "@/store/app";
import { nav, router } from "../setup";
import { freshStore } from "./helpers";

const caption = readFileSync("tests/fixtures/captions/03-satir-ici.txt", "utf8");
const TIKTOK = "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567";

function mockApi(body: unknown, status = 200) {
  const f = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => {
  nav.params = {};
  nav.search = new URLSearchParams();
  window.scrollTo = () => {};
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => vi.unstubAllGlobals());

describe("Linkten ekle", () => {
  it("link → draft in the recipe form with the source card → save credits the creator", async () => {
    await freshStore({ demo: true });
    const api = mockApi({
      source: { platform: "tiktok", url: TIKTOK, author: "@mutfakdefteri", title: "Pratik menemen tarifi", thumbnailUrl: null, needsPaste: false, hasText: true },
      draft: parseRecipeText(caption),
      path: "rules",
      provider: "rules",
      needsPaste: false,
      message: null,
      counted: { platform: "tiktok", provider: "rules" },
    });
    render(<IceAktarPage />);
    await userEvent.type(screen.getByLabelText("Link"), TIKTOK);
    await userEvent.click(screen.getByRole("button", { name: "Taslağı çıkar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Taslağı kontrol et" })).toBeInTheDocument();
    const [, init] = api.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ url: TIKTOK, householdId: useApp.getState().household!.id });
    expect(screen.getByRole("region", { name: "Kaynak" })).toHaveTextContent("@mutfakdefteri");
    expect(screen.getByText("Kontrol edip kaydet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tarifin adı")).toHaveValue("Pratik menemen");
    expect(useApp.getState().importLog).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Tarifi kaydet" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const saved = useApp.getState().recipes.find((r) => r.name === "Pratik menemen")!;
    expect(saved).toMatchObject({ sourceUrl: TIKTOK, sourceAuthor: "@mutfakdefteri", sourcePlatform: "tiktok" });
    expect(useApp.getState().activity[0]).toMatchObject({ type: "recipe.imported" });

    nav.params = { id: saved.id };
    render(<TarifPage />);
    expect(screen.getByText("Kaynak: @mutfakdefteri · TikTok")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Videoyu aç" })).toHaveAttribute("href", TIKTOK);
  });

  it("Instagram: kind message and the paste box opens by itself", async () => {
    await freshStore({ demo: true });
    mockApi({
      source: { platform: "instagram", url: "https://www.instagram.com/reel/C7x/", author: null, title: null, thumbnailUrl: null, needsPaste: true, hasText: false },
      draft: null,
      path: null,
      needsPaste: true,
      message: "Instagram, gönderinin açıklamasını dışarıya vermiyor. Reels'in altındaki açıklamayı kopyalayıp aşağıya yapıştırırsan tarifi oradan çıkarırız.",
      counted: null,
    });
    render(<IceAktarPage />);
    expect(screen.queryByLabelText("Açıklamayı buraya yapıştır")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Link"), "https://www.instagram.com/reel/C7x/");
    await userEvent.click(screen.getByRole("button", { name: "Taslağı çıkar" }));
    expect(await screen.findByText(/Instagram, gönderinin açıklamasını/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Açıklamayı buraya yapıştır")).toHaveFocus());
    expect(screen.getByRole("button", { name: "Açıklama kutusunu gizle" })).toHaveAttribute("aria-expanded", "true");
    expect(useApp.getState().importLog).toHaveLength(0);
  });

  it("shared link (Web Share Target) runs on its own", async () => {
    await freshStore({ demo: true });
    const api = mockApi({ source: null, draft: parseRecipeText(caption), path: "rules", provider: "rules", needsPaste: false, message: null, counted: { platform: null, provider: "rules" } });
    nav.search = new URLSearchParams({ text: `Bu tarife bak ${TIKTOK}` });
    render(<IceAktarPage />);
    await screen.findByRole("heading", { level: 1, name: "Taslağı kontrol et" });
    const [, init] = api.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).url).toBe(TIKTOK);
  });

  it("server error: calm alert and paste path", async () => {
    await freshStore({ demo: true });
    mockApi({ error: "Kaynak geç yanıt verdi. Açıklamayı yapıştırırsan hemen devam ederiz." }, 504);
    render(<IceAktarPage />);
    await userEvent.type(screen.getByLabelText("Link"), TIKTOK);
    await userEvent.click(screen.getByRole("button", { name: "Taslağı çıkar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kaynak geç yanıt verdi");
    expect(screen.getByLabelText("Açıklamayı buraya yapıştır")).toBeInTheDocument();
  });

  it("Ayarlar shows this month's imports split by provider", async () => {
    await freshStore({ demo: true });
    await useApp.getState().logImport({ platform: "tiktok", provider: "gemini" });
    await useApp.getState().logImport({ platform: "youtube", provider: "gemini" });
    await useApp.getState().logImport({ platform: "instagram", provider: "rules" });
    render(<AyarlarPage />);
    expect(screen.getByText("Bu ay 3 tarif içe aktarıldı (2 Gemini, 1 kural).")).toBeInTheDocument();
  });
});
