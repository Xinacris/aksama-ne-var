// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { handleImport, type HandlerDeps } from "@/server/import/handler";
import { DailyLimiter } from "@/server/import/rateLimit";

/** The route with a YouTube video whose description links a written recipe (fixtures are self-written). */

const VIDEO = "https://www.youtube.com/watch?v=abcDEF12345";
const RECIPE_URL = "https://ornek-mutfak.com/tarif/limonlu-kekikli-tavuk/";
const withRecipeLink = readFileSync("tests/fixtures/captions/16-kanal-aciklamasi.txt", "utf8");
const boilerplateOnly = readFileSync("tests/fixtures/captions/17-sadece-kanal.txt", "utf8");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const html = (body: string) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

const RECIPE_PAGE = `<html><head><meta property="og:site_name" content="Örnek Mutfak">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Limonlu Kekikli Tavuk","author":{"@type":"Person","name":"Deniz Şef"},
"recipeYield":"4","prepTime":"PT15M","cookTime":"PT40M","recipeCategory":"Ana Yemek",
"recipeIngredient":["6 adet tavuk but","2 yemek kaşığı zeytinyağı","1 adet limon","1 tatlı kaşığı kekik","3 diş sarımsak"],
"recipeInstructions":[{"@type":"HowToStep","text":"Zeytinyağı, limon suyu, kekik ve ezilmiş sarımsağı karıştırın."},{"@type":"HowToStep","text":"Tavukları sosla marine edip buzdolabında 30 dakika bekletin."},{"@type":"HowToStep","text":"200 derece fırında 40 dakika pişirin."}]}</script>
</head><body></body></html>`;

function youtube(description: string) {
  return vi.fn(async (url: string) => {
    if (url.startsWith("https://www.googleapis.com/youtube/v3/videos")) {
      return json({ items: [{ snippet: { title: "HAFTA SONU MENÜSÜ: Limonlu Kekikli Tavuk", description, channelTitle: "Örnek Mutfak", thumbnails: { high: { url: "https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg" } } } }] });
    }
    throw new Error(`unexpected platform fetch ${url}`);
  }) as unknown as typeof fetch;
}

function deps(over: Partial<HandlerDeps> = {}, gemini?: ReturnType<typeof vi.fn>) {
  return {
    fetch: youtube(withRecipeLink),
    webFetch: vi.fn(async (url: string) => (url === RECIPE_URL ? html(RECIPE_PAGE) : new Response("", { status: 404 }))) as unknown as typeof fetch,
    env: { YOUTUBE_API_KEY: "yt" },
    anthropic: () => ({ messages: { create: vi.fn() } }) as unknown as Pick<Anthropic, "messages">,
    geminiFetch: gemini as unknown as HandlerDeps["geminiFetch"],
    limiter: new DailyLimiter(30),
    ...over,
  } satisfies HandlerDeps;
}

const post = (body: unknown) => new Request("http://localhost/api/import", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("written recipe linked from a video", () => {
  it("description with a recipe-site link → JSON-LD page → draft with real steps, provider 'web', no LLM call", async () => {
    const gemini = vi.fn();
    const d = deps({ env: { YOUTUBE_API_KEY: "yt", GEMINI_API_KEY: "g" } }, gemini);
    const body = await (await handleImport(post({ url: VIDEO, householdId: "h1" }), d)).json();
    expect(body).toMatchObject({ provider: "web", path: "rules", writtenRecipeUrl: RECIPE_URL, counted: { platform: "youtube", provider: "web" } });
    // the video stays the source (Kaynak "YouTube · Örnek Mutfak")
    expect(body.source).toMatchObject({ platform: "youtube", url: VIDEO, author: "Örnek Mutfak" });
    expect(body.draft.steps.map((s: { text: string }) => s.text)).toEqual([
      "Zeytinyağı, limon suyu, kekik ve ezilmiş sarımsağı karıştırın.",
      "Tavukları sosla marine edip buzdolabında 30 dakika bekletin.",
      "200 derece fırında 40 dakika pişirin.",
    ]);
    expect(body.draft).toMatchObject({ prepMinutes: 15, cookMinutes: 40 });
    expect(body.draft.tags).toEqual(expect.arrayContaining(["Fırında", "Tavuklu", "Marine"]));
    expect(gemini).not.toHaveBeenCalled();
    // only the recipe page was fetched: no social, profile, home page or shortener requests
    expect((d.webFetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([RECIPE_URL]);
  });

  it("the linked page has no recipe data → the description is structured instead (boilerplate stripped first)", async () => {
    const gemini = vi.fn(async (_u: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)).contents[0].parts[0].text as string;
      // what the LLM sees has no links, socials, sponsor or subscribe lines
      expect(sent).not.toMatch(/https?:|bit\.ly|abone|SOSYAL MEDYA|Instagram|sponsor/i);
      expect(sent).toContain("6 adet tavuk but");
      return json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: "Limonlu kekikli tavuk",
                    servings: 4,
                    role: "ana",
                    totalMinutes: null,
                    prepMinutes: null,
                    cookMinutes: null,
                    waitMinutes: null,
                    ingredients: [{ amount: 6, unit: "adet", item: "tavuk but", side: "market", note: null }],
                    // a model that ignores the instruction: junk "steps" must not survive validation
                    steps: [
                      { text: "Yazılı tarif için: https://ornek-mutfak.com/tarif/x/", minutes: null },
                      { text: "Kanalımıza abone olun!", minutes: null },
                      { text: "SOSYAL MEDYA HESAPLARIMIZ", minutes: null },
                    ],
                    prep: [],
                    cookingMethods: [],
                    mainIngredients: ["Tavuklu"],
                    prepTags: [],
                  }),
                },
              ],
            },
          },
        ],
      });
    });
    const d = deps({ env: { YOUTUBE_API_KEY: "yt", GEMINI_API_KEY: "g" }, webFetch: vi.fn(async () => html("<html><title>Örnek Mutfak</title></html>")) as unknown as typeof fetch }, gemini);
    const body = await (await handleImport(post({ url: VIDEO }), d)).json();
    expect(body).toMatchObject({ provider: "gemini", writtenRecipeUrl: null });
    expect(body.draft.steps).toEqual([]);
    expect(body.draft.ingredients).toHaveLength(1);
  });

  it("boilerplate-only description: no junk steps, empty steps, paste path", async () => {
    const d = deps({ fetch: youtube(boilerplateOnly) });
    const body = await (await handleImport(post({ url: VIDEO }), d)).json();
    expect(body.provider).toBe("rules");
    expect(body.draft.steps).toEqual([]);
    expect(body.draft.ingredients).toEqual([]);
    expect(JSON.stringify(body.draft)).not.toMatch(/https?:|bit\.ly|abone|SOSYAL MEDYA|sponsor/i);
    expect(body.needsPaste).toBe(true);
    // the sponsor/subscribe shorteners were never expanded
    expect(d.webFetch).not.toHaveBeenCalled();
  });

  it("the rules path on the real-shaped description: ingredients kept, no junk steps", async () => {
    const d = deps({ webFetch: vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch });
    const body = await (await handleImport(post({ url: VIDEO }), d)).json();
    expect(body.provider).toBe("rules");
    expect(body.draft.ingredients.length).toBeGreaterThanOrEqual(6);
    expect(body.draft.steps).toEqual([]);
  });

  it("a shortener on a recipe line is expanded (HEAD, guarded fetch) only when no direct link exists", async () => {
    const text = "Pratik tavuk\n\nTarifin tamamı: bit.ly/tavukTarif\nAbone ol: bit.ly/abone";
    const webFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://bit.ly/tavukTarif" && init?.method === "HEAD") return new Response(null, { status: 200, headers: { location: RECIPE_URL } });
      if (url === RECIPE_URL) return html(RECIPE_PAGE);
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const body = await (await handleImport(post({ url: VIDEO }), deps({ fetch: youtube(text), webFetch }))).json();
    expect(body).toMatchObject({ provider: "web", writtenRecipeUrl: RECIPE_URL });
    const calls = (webFetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => c[0])).toEqual(["https://bit.ly/tavukTarif", RECIPE_URL]);
    expect((calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("at most two links are tried", async () => {
    const text = ["Tarif: https://a.ornek.com/tarif/1", "Tarif: https://b.ornek.com/tarif/2", "Tarif: https://c.ornek.com/tarif/3", "Malzemeler:", "2 adet yumurta"].join("\n");
    const webFetch = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await handleImport(post({ url: VIDEO }), deps({ fetch: youtube(text), webFetch }));
    expect((webFetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });
});
