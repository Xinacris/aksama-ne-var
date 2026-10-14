import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ADAPTERS, SourceUnavailableError } from "@/domain/import/adapters";
import { isoMinutes, pageMeta, readSchemaOrgRecipe } from "@/domain/import/schemaOrg";
import { runImport } from "@/domain/import/pipeline";
import type { ImportedRecipe } from "@/domain/import/types";

const caption = (n: string) => readFileSync(`tests/fixtures/captions/${n}.txt`, "utf8");

function mockFetch(routes: Record<string, () => Response | Promise<Response>>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new TypeError(`unexpected fetch ${url}`);
    return routes[key]();
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

const RECIPE_PAGE = `<html><head><title>Fırında Köfte | Örnek Tarifler</title>
<script type="application/ld+json">{ broken json </script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},{"@type":["Recipe"],"name":"Fırında Patatesli Köfte","author":{"@type":"Person","name":"Ayşe Mutfakta"},"image":["https://ornek-tarifler.com/k.jpg"],"recipeYield":"4 porsiyon","totalTime":"PT1H10M","recipeCategory":"Ana Yemek","recipeIngredient":["500 gr kıyma","3 adet patates","1 adet soğan","Tuz, karabiber"],"recipeInstructions":[{"@type":"HowToStep","text":"Kıymayı soğan ve baharatla yoğurun."},{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"200 derece fırında 35 dakika pişirin."}]}]}]}</script>
</head><body></body></html>`;

describe("schema.org reader", () => {
  it("reads a Recipe inside @graph, skipping broken blocks", () => {
    const r = readSchemaOrgRecipe(RECIPE_PAGE)!;
    expect(r.author).toBe("Ayşe Mutfakta");
    expect(r.image).toBe("https://ornek-tarifler.com/k.jpg");
    expect(r.recipe.name).toBe("Fırında patatesli köfte");
    expect(r.recipe.servings).toBe(4);
    expect(r.recipe.totalMinutes).toBe(70);
    expect(r.recipe.role).toBe("ana");
    expect(r.recipe.ingredients.map((i) => i.item)).toEqual(["Kıyma", "Patates", "Soğan", "Tuz", "Karabiber"]);
    expect(r.recipe.steps).toEqual([
      { text: "Kıymayı soğan ve baharatla yoğurun.", minutes: null },
      { text: "200 derece fırında 35 dakika pişirin.", minutes: 35 },
    ]);
  });

  it("reads ingredients grouped as nested arrays (one list per sub-recipe)", () => {
    const page = `<script type="application/ld+json">{"@type":"Recipe","name":"Peri peri tavuk","recipeIngredient":[["1 adet bütün tavuk","2 yemek kaşığı tuz"],["4 adet kapya biber",["5 diş sarımsak"]]],"recipeInstructions":["Tavuğu salamuraya yatırın.","Fırında 45 dakika pişirin."]}</script>`;
    const r = readSchemaOrgRecipe(page)!;
    expect(r.recipe.ingredients.map((i) => i.item.toLocaleLowerCase("tr"))).toEqual(["bütün tavuk", "tuz", "kapya biber", "sarımsak"]);
    expect(r.recipe.steps).toHaveLength(2);
  });

  it("returns null without recipe data and reads page meta", () => {
    expect(readSchemaOrgRecipe("<html><title>Blog</title></html>")).toBeNull();
    expect(pageMeta(`<meta property="og:title" content="Kek &amp; çay"><meta content="https://x.com/i.jpg" property="og:image">`)).toEqual({ title: "Kek & çay", image: "https://x.com/i.jpg", siteName: null });
  });

  it("parses ISO durations", () => {
    expect(isoMinutes("PT1H30M")).toBe(90);
    expect(isoMinutes("PT45M")).toBe(45);
    expect(isoMinutes("P0DT2H")).toBe(120);
    expect(isoMinutes("20 dakika")).toBe(20);
    expect(isoMinutes(null)).toBeNull();
  });
});

describe("source adapters", () => {
  it("TikTok oEmbed: caption, handle, thumbnail", async () => {
    const fetch = mockFetch({ "https://www.tiktok.com/oembed": () => json({ title: caption("03-satir-ici"), author_name: "Mutfak Defteri", author_unique_id: "mutfakdefteri", thumbnail_url: "https://p16.tiktokcdn.com/t.jpg" }) });
    const src = await ADAPTERS.tiktok.fetchSource("https://www.tiktok.com/@mutfakdefteri/video/1", { fetch, env: {} });
    expect(fetch.mock.calls[0][0]).toBe("https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40mutfakdefteri%2Fvideo%2F1");
    expect(src).toMatchObject({ platform: "tiktok", author: "@mutfakdefteri", title: "Pratik menemen tarifi", thumbnailUrl: "https://p16.tiktokcdn.com/t.jpg", needsPaste: false });
    expect(src.text).toContain("Malzemeler:");
  });

  it("TikTok endpoint failing → SourceUnavailableError", async () => {
    const fetch = mockFetch({ "https://www.tiktok.com/oembed": () => json({ message: "x" }, 400) });
    await expect(ADAPTERS.tiktok.fetchSource("https://www.tiktok.com/@a/video/1", { fetch, env: {} })).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it("YouTube with API key reads the full description", async () => {
    const fetch = mockFetch({
      "https://www.googleapis.com/youtube/v3/videos": () => json({ items: [{ snippet: { title: "Mercimek çorbası", description: caption("01-mercimek-basliklar"), channelTitle: "Evde Pişir", thumbnails: { high: { url: "https://i.ytimg.com/h.jpg" } } } }] }),
    });
    const src = await ADAPTERS.youtube.fetchSource("https://www.youtube.com/shorts/aBcDeFgHiJk", { fetch, env: { YOUTUBE_API_KEY: "k" } });
    expect(String(fetch.mock.calls[0][0])).toContain("id=aBcDeFgHiJk&key=k");
    expect(src).toMatchObject({ author: "Evde Pişir", thumbnailUrl: "https://i.ytimg.com/h.jpg", needsPaste: false });
    expect(src.text).toContain("kırmızı mercimek");
  });

  it("YouTube without a key falls back to public oEmbed (title only)", async () => {
    const fetch = mockFetch({ "https://www.youtube.com/oembed": () => json({ title: "5 dakikada menemen", author_name: "Evde Pişir", thumbnail_url: "https://i.ytimg.com/t.jpg" }) });
    const src = await ADAPTERS.youtube.fetchSource("https://www.youtube.com/watch?v=aBcDeFgHiJk", { fetch, env: {} });
    expect(src).toMatchObject({ title: "5 dakikada menemen", text: "5 dakikada menemen", needsPaste: true });
  });

  it("Instagram never fetches", async () => {
    const fetch = mockFetch({});
    const src = await ADAPTERS.instagram.fetchSource("https://www.instagram.com/reel/C7x/", { fetch, env: {} });
    expect(fetch).not.toHaveBeenCalled();
    expect(src).toMatchObject({ platform: "instagram", needsPaste: true, text: null });
  });

  it("web reads schema.org data, and falls back to page meta", async () => {
    const withData = await ADAPTERS.web.fetchSource("https://ornek-tarifler.com/kofte", { fetch: mockFetch({ "https://ornek-tarifler.com": () => html(RECIPE_PAGE) }), env: {} });
    expect(withData).toMatchObject({ author: "Ayşe Mutfakta", needsPaste: false });
    expect(withData.recipe?.ingredients).toHaveLength(5);
    const without = await ADAPTERS.web.fetchSource("https://blog.ornek.com/yazi", { fetch: mockFetch({ "https://blog.ornek.com": () => html("<title>Pazar kahvaltısı</title>") }), env: {} });
    expect(without).toMatchObject({ title: "Pazar kahvaltısı", author: "blog.ornek.com", needsPaste: true, recipe: null });
  });
});

describe("runImport", () => {
  const llmDraft: ImportedRecipe = { name: "Menemen", servings: 2, role: "ana", totalMinutes: 20, ingredients: [{ amount: 3, unit: "adet", item: "Yumurta", side: "market", note: null }], steps: [{ text: "Pişir.", minutes: 10 }], prep: [] };

  it("TikTok caption → rules draft when no structurer", async () => {
    const fetch = mockFetch({ "https://www.tiktok.com/oembed": () => json({ title: caption("03-satir-ici"), author_unique_id: "mutfakdefteri" }) });
    const { result, counted } = await runImport({ url: "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567?is_from_webapp=1" }, { fetch, env: {} });
    expect(result.path).toBe("rules");
    expect(result.needsPaste).toBe(false);
    expect(result.draft?.name).toBe("Pratik menemen");
    expect(result.source).toMatchObject({ platform: "tiktok", url: "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567", author: "@mutfakdefteri", hasText: true });
    expect(result.source).not.toHaveProperty("text");
    expect(result.provider).toBe("rules");
    expect(counted).toEqual({ platform: "tiktok", provider: "rules" });
  });

  it("uses the structurer and reports its provider; rules when it throws", async () => {
    const fetch = mockFetch({ "https://www.tiktok.com/oembed": () => json({ title: caption("03-satir-ici") }) });
    const url = "https://www.tiktok.com/@a/video/1";
    const viaGemini = await runImport({ url }, { fetch, env: {}, structure: async () => ({ draft: llmDraft, provider: "gemini" }) });
    expect(viaGemini.result).toMatchObject({ path: "llm", provider: "gemini" });
    expect(viaGemini.counted).toEqual({ platform: "tiktok", provider: "gemini" });
    expect((await runImport({ url }, { fetch, env: {}, structure: async () => ({ draft: llmDraft, provider: "claude" }) })).result).toMatchObject({ path: "llm", provider: "claude" });
    const failed = await runImport({ url }, { fetch, env: {}, structure: async () => Promise.reject(new Error("x")) });
    expect(failed.result).toMatchObject({ path: "rules", provider: "rules" });
  });

  it("Instagram: link card + kind paste message; pasted caption then gives a draft", async () => {
    const fetch = mockFetch({});
    const first = await runImport({ url: "https://www.instagram.com/reel/C7xYz12AbCd/?igsh=abc" }, { fetch, env: {} });
    expect(first.result).toMatchObject({ draft: null, needsPaste: true, source: { platform: "instagram", url: "https://www.instagram.com/reel/C7xYz12AbCd/" } });
    expect(first.result.message).toMatch(/Instagram/);
    expect(first.counted).toBeNull();
    const second = await runImport({ url: "https://www.instagram.com/reel/C7xYz12AbCd/", text: caption("02-kofte-emoji") }, { fetch, env: {} });
    expect(second.result.needsPaste).toBe(false);
    expect(second.result.draft?.ingredients.length).toBeGreaterThan(5);
  });

  it("platform endpoint failing → calm message and paste path, no crash", async () => {
    const fetch = mockFetch({ "https://www.tiktok.com/oembed": () => new Response("", { status: 503 }) });
    const { result } = await runImport({ url: "https://vm.tiktok.com/ZMabc/" }, { fetch, env: {} });
    expect(result).toMatchObject({ draft: null, needsPaste: true });
    expect(result.message).toBe("TikTok şu an yanıt vermedi. Açıklamayı yapıştırırsan oradan devam ederiz.");
  });

  it("caption without ingredients opens the paste box", async () => {
    const fetch = mockFetch({ "https://www.tiktok.com/oembed": () => json({ title: caption("07-sadece-hikaye") }) });
    const { result } = await runImport({ url: "https://www.tiktok.com/@a/video/1" }, { fetch, env: {} });
    expect(result.needsPaste).toBe(true);
    expect(result.message).toMatch(/malzeme listesi bulamadık/);
  });

  it("schema.org pages skip the structurer", async () => {
    const structure = vi.fn(async () => ({ draft: llmDraft, provider: "gemini" as const }));
    const { result } = await runImport({ url: "https://ornek-tarifler.com/kofte" }, { fetch: mockFetch({ "https://ornek-tarifler.com": () => html(RECIPE_PAGE) }), env: {}, structure });
    expect(structure).not.toHaveBeenCalled();
    expect(result).toMatchObject({ path: "rules", needsPaste: false, draft: { name: "Fırında patatesli köfte" } });
  });

  it("paste only (no link) and invalid links", async () => {
    const fetch = mockFetch({});
    const pasteOnly = await runImport({ text: caption("01-mercimek-basliklar") }, { fetch, env: {} });
    expect(pasteOnly.result).toMatchObject({ source: null, path: "rules", needsPaste: false });
    const bad = await runImport({ url: "çok güzel tarif" }, { fetch, env: {} });
    expect(bad.result).toMatchObject({ source: null, draft: null, needsPaste: true });
    expect(bad.result.message).toMatch(/bağlantıya benzemiyor/);
  });
});
