// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { handleImport, type HandlerDeps } from "@/server/import/handler";
import { DailyLimiter } from "@/server/import/rateLimit";
import { assertPublicUrl, guardedFetch, isPrivateAddress } from "@/server/import/guardedFetch";
import { CLAUDE_MAX_TOKENS, CLAUDE_MODEL } from "@/server/llm/claude";

const caption = readFileSync("../../packages/core/tests/fixtures/captions/03-satir-ici.txt", "utf8");
const TIKTOK = "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tiktokOk = vi.fn(async () => json({ title: caption, author_unique_id: "mutfakdefteri", thumbnail_url: "https://p16.tiktokcdn.com/t.jpg" })) as unknown as typeof fetch;

const VALID = {
  name: "Menemen",
  servings: 2,
  role: "ana",
  totalMinutes: 20,
  ingredients: [
    { amount: 4, unit: "adet", item: "domates", side: "pazar", note: null },
    { amount: 2, unit: "yk", item: "tereyağı", side: "market" },
  ],
  steps: [
    { text: "Biberleri tereyağında soteleyin.", minutes: 3 },
    { text: "Yumurtaları ekleyip 2 dakika pişirin.", minutes: 2 },
  ],
  prep: [],
};

function toolMessage(input: unknown): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: CLAUDE_MODEL,
    content: [{ type: "tool_use", id: "tu_1", name: "tarif_taslagi", input } as Anthropic.ToolUseBlock],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message;
}

function deps(over: Partial<HandlerDeps> & { create?: ReturnType<typeof vi.fn> } = {}): HandlerDeps & { create: ReturnType<typeof vi.fn> } {
  const create = over.create ?? vi.fn(async () => toolMessage(VALID));
  return {
    fetch: tiktokOk,
    webFetch: vi.fn(async () => {
      throw new Error("web fetch not expected");
    }) as unknown as typeof fetch,
    env: {},
    anthropic: () => ({ messages: { create } }) as unknown as Pick<Anthropic, "messages">,
    limiter: new DailyLimiter(30),
    ...over,
    create,
  };
}

const post = (body: unknown) => new Request("http://localhost/api/import", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("POST /api/import", () => {
  it("without any key: rule parser, never calls an LLM", async () => {
    const d = deps();
    const res = await handleImport(post({ url: TIKTOK, householdId: "h1" }), d);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ path: "rules", provider: "rules", llmAvailable: false, needsPaste: false, source: { platform: "tiktok", author: "@mutfakdefteri" } });
    expect(body.draft.name).toBe("Pratik menemen");
    expect(d.create).not.toHaveBeenCalled();
  });

  it("only ANTHROPIC_API_KEY: Claude Haiku via forced tool use, validated and normalised", async () => {
    const d = deps({ env: { ANTHROPIC_API_KEY: "sk-test" } });
    const body = await (await handleImport(post({ url: TIKTOK, householdId: "h1" }), d)).json();
    expect(body).toMatchObject({ path: "llm", provider: "claude", llmAvailable: true });
    expect(body.counted).toEqual({ platform: "tiktok", provider: "claude" });
    expect(body.draft.ingredients[1]).toEqual({ amount: 2, unit: "yemek kaşığı", item: "tereyağı", side: "market", note: null });
    // duration from the tool output is written into the step text when missing
    expect(body.draft.steps[0].text).toBe("Biberleri tereyağında soteleyin. (3 dk)");
    expect(body.draft.steps[1].text).toBe("Yumurtaları ekleyip 2 dakika pişirin.");
    const [params, opts] = d.create.mock.calls[0];
    expect(params).toMatchObject({ model: "claude-haiku-5-5", max_tokens: CLAUDE_MAX_TOKENS, tool_choice: { type: "tool", name: "tarif_taslagi" } });
    expect(params.messages[0].content).toContain("Biberleri tereyağında");
    expect(params.messages[0].content).toContain("Kaynak: tiktok");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("invalid tool output → retries once, then succeeds", async () => {
    const create = vi.fn().mockResolvedValueOnce(toolMessage({ name: "", ingredients: "yok" })).mockResolvedValueOnce(toolMessage(VALID));
    const body = await (await handleImport(post({ url: TIKTOK }), deps({ env: { ANTHROPIC_API_KEY: "k" }, create }))).json();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[0].content).toMatch(/şemaya uymadı/);
    expect(body.provider).toBe("claude");
  });

  it("invalid twice → falls back to the rule parser", async () => {
    const create = vi.fn(async () => toolMessage({ nope: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = await (await handleImport(post({ url: TIKTOK }), deps({ env: { ANTHROPIC_API_KEY: "k" }, create }))).json();
    expect(create).toHaveBeenCalledTimes(2);
    expect(body.provider).toBe("rules");
    expect(body.draft.ingredients.length).toBeGreaterThan(3);
    // never log the caption
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Biberleri");
    warn.mockRestore();
  });

  it("Claude API error → rules, caption not logged", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error(`overloaded: ${caption}`), { name: "APIError" });
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = await (await handleImport(post({ url: TIKTOK }), deps({ env: { ANTHROPIC_API_KEY: "k" }, create }))).json();
    expect(body.provider).toBe("rules");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("tereyağı");
    warn.mockRestore();
  });

  it("platform endpoint failing → 200 with the paste path", async () => {
    const failing = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    const body = await (await handleImport(post({ url: TIKTOK }), deps({ fetch: failing }))).json();
    expect(body).toMatchObject({ draft: null, needsPaste: true, message: "TikTok şu an yanıt vermedi. Açıklamayı yapıştırırsan oradan devam ederiz." });
  });

  it("rate limit per household: over the quota uses rules and says so", async () => {
    const d = deps({ env: { ANTHROPIC_API_KEY: "k" }, limiter: new DailyLimiter(1) });
    expect((await (await handleImport(post({ url: TIKTOK, householdId: "h1" }), d)).json()).provider).toBe("claude");
    const second = await (await handleImport(post({ url: TIKTOK, householdId: "h1" }), d)).json();
    expect(second.provider).toBe("rules");
    expect(second.message).toMatch(/sınırına ulaşıldı/);
    expect((await (await handleImport(post({ url: TIKTOK, householdId: "h2" }), d)).json()).provider).toBe("claude");
    expect(d.create).toHaveBeenCalledTimes(2);
  });

  it("pasted text works without a link; caps and bad input are rejected calmly", async () => {
    const ok = await (await handleImport(post({ text: caption }), deps())).json();
    expect(ok).toMatchObject({ source: null, path: "rules" });
    expect((await handleImport(post({}), deps())).status).toBe(400);
    expect((await handleImport(post({ text: "x".repeat(20_001) }), deps())).status).toBe(400);
    const bad = await handleImport(new Request("http://localhost/api/import", { method: "POST", body: "{" }), deps());
    expect(bad.status).toBe(400);
  });

  it("web links go through the guarded fetch, platform endpoints do not", async () => {
    const webFetch = vi.fn(async () => new Response("<title>Blog</title>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    const d = deps({ webFetch });
    await handleImport(post({ url: "https://ornek-tarifler.com/kofte" }), d);
    expect(webFetch).toHaveBeenCalledTimes(1);
    await handleImport(post({ url: TIKTOK }), d);
    expect(webFetch).toHaveBeenCalledTimes(1);
  });
});

describe("guards", () => {
  it("daily limiter resets the next day", () => {
    let day = "2026-10-13";
    const l = new DailyLimiter(2, () => day);
    expect([l.take("h"), l.take("h"), l.take("h")]).toEqual([true, true, false]);
    day = "2026-10-14";
    expect(l.take("h")).toBe(true);
  });

  it("private addresses are blocked", async () => {
    expect(["127.0.0.1", "10.1.2.3", "192.168.1.5", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"].every(isPrivateAddress)).toBe(true);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    await expect(assertPublicUrl("http://localhost:3000/x")).rejects.toThrow("blocked-host");
    await expect(assertPublicUrl("http://169.254.169.254/latest")).rejects.toThrow("blocked-host");
    await expect(assertPublicUrl("https://evil.example/x", async () => ["10.0.0.2"])).rejects.toThrow("blocked-host");
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("https://ornek.com/x", async () => ["93.184.216.34"])).resolves.toBeInstanceOf(URL);
  });

  it("redirects to private hosts are blocked", async () => {
    const base = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } })) as unknown as typeof fetch;
    const f = guardedFetch(base, async () => ["93.184.216.34"]);
    await expect(f("https://ornek.com/x")).rejects.toThrow("blocked-host");
  });
});
