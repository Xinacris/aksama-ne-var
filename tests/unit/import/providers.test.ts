// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { handleImport, providersFromEnv, type HandlerDeps } from "@/server/import/handler";
import { DailyLimiter } from "@/server/import/rateLimit";
import { providerInput, structureRecipe, type LlmProvider } from "@/server/llm";
import { CLAUDE_TOOL } from "@/server/llm/claude";
import { GEMINI_DEFAULT_MODEL, geminiProvider, thinkingFor, toGeminiSchema } from "@/server/llm/gemini";
import { RECIPE_JSON_SCHEMA, SYSTEM_PROMPT, userPrompt } from "@/server/llm/prompt";

const caption = readFileSync("tests/fixtures/captions/03-satir-ici.txt", "utf8");
const TIKTOK = "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tiktokOk = vi.fn(async () => json({ title: caption, author_unique_id: "mutfakdefteri", author_name: "Mutfak Defteri" })) as unknown as typeof fetch;

const VALID = {
  name: "Menemen",
  servings: 2,
  role: "ana",
  totalMinutes: 20,
  ingredients: [
    { amount: 4, unit: "adet", item: "domates", side: "pazar", note: null },
    { amount: 2, unit: "yk", item: "tereyağı", side: "market", note: null },
  ],
  steps: [{ text: "Yumurtaları ekleyip 2 dakika pişirin.", minutes: 2 }],
  prep: [],
};

const geminiOk = (out: unknown = VALID) => json({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(out) }] }, finishReason: "STOP" }] });
const geminiText = (text: string) => json({ candidates: [{ content: { parts: [{ text }] } }] });
const geminiQuota = () => json({ error: { code: 429, message: "Resource has been exhausted (e.g. check quota).", status: "RESOURCE_EXHAUSTED" } }, 429);

function toolMessage(input: unknown): Anthropic.Message {
  return { content: [{ type: "tool_use", id: "tu_1", name: CLAUDE_TOOL, input }] } as unknown as Anthropic.Message;
}

type Mock = ReturnType<typeof vi.fn>;

function deps(env: HandlerDeps["env"], gemini: Mock = vi.fn(async () => geminiOk()), create: Mock = vi.fn(async () => toolMessage(VALID))) {
  return {
    fetch: tiktokOk,
    webFetch: vi.fn() as unknown as typeof fetch,
    env,
    anthropic: () => ({ messages: { create } }) as unknown as Pick<Anthropic, "messages">,
    geminiFetch: gemini as unknown as HandlerDeps["geminiFetch"],
    limiter: new DailyLimiter(30),
    gemini,
    create,
  };
}

const post = (body: unknown) => new Request("http://localhost/api/import", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const run = async (d: ReturnType<typeof deps>, body: unknown = { url: TIKTOK, householdId: "ev-ali-zeynep" }) => (await handleImport(post(body), d)).json();

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("provider selection", () => {
  const names = (env: HandlerDeps["env"]) => providersFromEnv(env, deps(env)).map((p) => p.name);

  it("order is Gemini → Claude; unconfigured providers are skipped", () => {
    expect(names({})).toEqual([]);
    expect(names({ GEMINI_API_KEY: "g" })).toEqual(["gemini"]);
    expect(names({ ANTHROPIC_API_KEY: "a" })).toEqual(["claude"]);
    expect(names({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" })).toEqual(["gemini", "claude"]);
  });

  it("no keys: rules, no LLM call", async () => {
    const d = deps({});
    expect(await run(d)).toMatchObject({ provider: "rules", path: "rules", llmAvailable: false });
    expect(d.gemini).not.toHaveBeenCalled();
    expect(d.create).not.toHaveBeenCalled();
  });

  it("only Gemini: Gemini answers", async () => {
    const d = deps({ GEMINI_API_KEY: "g" });
    const body = await run(d);
    expect(body).toMatchObject({ provider: "gemini", path: "llm", llmAvailable: true, counted: { platform: "tiktok", provider: "gemini" } });
    expect(body.draft.ingredients[1]).toEqual({ amount: 2, unit: "yemek kaşığı", item: "tereyağı", side: "market", note: null });
    expect(d.create).not.toHaveBeenCalled();
  });

  it("only Claude: Claude answers", async () => {
    const d = deps({ ANTHROPIC_API_KEY: "a" });
    expect(await run(d)).toMatchObject({ provider: "claude", llmAvailable: true });
    expect(d.gemini).not.toHaveBeenCalled();
  });

  it("both: Gemini first, Claude untouched when Gemini answers", async () => {
    const d = deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    expect((await run(d)).provider).toBe("gemini");
    expect(d.gemini).toHaveBeenCalledTimes(1);
    expect(d.create).not.toHaveBeenCalled();
  });

  it("the daily limit still applies to the whole LLM chain", async () => {
    const d = { ...deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }), limiter: new DailyLimiter(1) };
    expect((await run(d)).provider).toBe("gemini");
    const second = await run(d);
    expect(second.provider).toBe("rules");
    expect(second.message).toMatch(/sınırına ulaşıldı/);
    expect(d.gemini).toHaveBeenCalledTimes(1);
    expect(d.create).not.toHaveBeenCalled();
  });
});

describe("Gemini", () => {
  it("structured JSON output: model, key header, response schema", async () => {
    const d = deps({ GEMINI_API_KEY: "g-key" });
    await run(d);
    const [url, init] = d.gemini.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`);
    expect(GEMINI_DEFAULT_MODEL).toBe("gemini-3.1-flash-lite");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: toGeminiSchema(RECIPE_JSON_SCHEMA) });
    expect(body.systemInstruction.parts[0].text).toBe(SYSTEM_PROMPT);
  });

  it("thinking is kept low: minimal for Gemini 3, budget 0 for 2.5 Flash, nothing for unknown families", () => {
    expect(thinkingFor("gemini-3.1-flash-lite", "minimal")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingFor("gemini-2.5-flash-lite", "minimal")).toEqual({ thinkingBudget: 0 });
    expect(thinkingFor("gemma-4", "minimal")).toBeNull();
  });

  it("a model that refuses 'minimal' (400 INVALID_ARGUMENT) is retried once with 'low', and remembered", async () => {
    const levels: string[] = [];
    const gemini = vi.fn(async (_url: string, init: RequestInit) => {
      const level = JSON.parse(String(init.body)).generationConfig.thinkingConfig.thinkingLevel;
      levels.push(level);
      return level === "minimal" ? json({ error: { code: 400, status: "INVALID_ARGUMENT", message: "thinking level" } }, 400) : geminiOk();
    });
    const model = "gemini-3.1-flash-lite-test-refuses-minimal";
    expect((await run(deps({ GEMINI_API_KEY: "g", GEMINI_MODEL: model }, gemini))).provider).toBe("gemini");
    expect((await run(deps({ GEMINI_API_KEY: "g", GEMINI_MODEL: model }, gemini))).provider).toBe("gemini");
    expect(levels).toEqual(["minimal", "low", "low"]);
  });

  it("the last provider may use the rest of the request; one with a fallback after it is capped", async () => {
    let seen = 0;
    const slow: LlmProvider = {
      name: "gemini",
      call: (_i, { signal }) =>
        new Promise((resolve, reject) => {
          const t = setTimeout(() => resolve(VALID), 60);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            seen++;
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    };
    // alone and last: 60 ms of work fits a 2 s deadline even though the cap would be shorter
    expect((await structureRecipe(caption, { platform: null, title: null }, { providers: [slow], deadline: Date.now() + 2_000 })).provider).toBe("gemini");
    expect(seen).toBe(0);
  });

  it("GEMINI_MODEL overrides the model", async () => {
    const d = deps({ GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-3.1-flash" });
    await run(d);
    expect(d.gemini.mock.calls[0][0]).toContain("/models/gemini-3.1-flash:generateContent");
  });

  it("response schema: nullable types, no null in enums, nested items", () => {
    const s = toGeminiSchema(RECIPE_JSON_SCHEMA) as Record<string, Record<string, Record<string, unknown>>>;
    expect(s.type).toBe("OBJECT");
    expect(s.properties.servings).toEqual({ type: "INTEGER", nullable: true, minimum: 1, maximum: 20 });
    expect(s.properties.role).toEqual({ type: "STRING", nullable: true, enum: ["corba", "ana", "yaninda", "salata"] });
    const ing = (s.properties.ingredients.items as { properties: Record<string, { enum?: unknown[] }> }).properties;
    expect(ing.unit.enum).toContain("yemek kaşığı");
    expect(ing.unit.enum).not.toContain(null);
  });

  it("both providers share one prompt and one validator: same draft whichever answers", async () => {
    const viaGemini = await run(deps({ GEMINI_API_KEY: "g" }));
    const viaClaude = await run(deps({ ANTHROPIC_API_KEY: "a" }));
    expect(viaGemini.draft).toEqual(viaClaude.draft);
    // the step's duration is already in its text, so nothing is appended
    expect(viaGemini.draft.steps[0].text).toBe("Yumurtaları ekleyip 2 dakika pişirin.");
    const d = deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, vi.fn(async () => geminiQuota()));
    await run(d);
    const geminiUser = JSON.parse(String((d.gemini.mock.calls[0] as [string, RequestInit])[1].body)).contents[0].parts[0].text;
    const [params] = d.create.mock.calls[0];
    expect(params.system).toBe(SYSTEM_PROMPT);
    expect(params.messages[0].content).toBe(geminiUser);
  });
});

describe("fall-through", () => {
  it("Gemini 429 → Claude; the response and log say why (status only)", async () => {
    const d = deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, vi.fn(async () => geminiQuota()));
    const body = await run(d);
    expect(body).toMatchObject({ provider: "claude", counted: { provider: "claude" } });
    expect(body.fallbacks).toEqual([{ provider: "gemini", kind: "quota", status: 429, reason: "RESOURCE_EXHAUSTED" }]);
    expect(String(warn.mock.calls.at(-1)?.[0])).toBe("[import] gemini gave up (quota 429 RESOURCE_EXHAUSTED); trying next");
    expect(d.gemini).toHaveBeenCalledTimes(1); // no retry on quota
    expect(d.create).toHaveBeenCalledTimes(1);
  });

  it("an unknown model (404 NOT_FOUND) is reported with its status and falls through", async () => {
    const gemini = vi.fn(async () => json({ error: { code: 404, message: "models/x is not found", status: "NOT_FOUND" } }, 404));
    const body = await run(deps({ GEMINI_API_KEY: "g" }, gemini));
    expect(body.provider).toBe("rules");
    expect(body.fallbacks).toEqual([{ provider: "gemini", kind: "error", status: 404, reason: "NOT_FOUND" }]);
  });

  it("503 UNAVAILABLE is retried once after a short pause; a second 503 falls through", async () => {
    const ok = vi.fn().mockResolvedValueOnce(json({ error: { code: 503, status: "UNAVAILABLE" } }, 503)).mockResolvedValueOnce(geminiOk());
    const claude: LlmProvider = { name: "claude", call: async () => VALID };
    const first = await structureRecipe(caption, { platform: null, title: null }, { providers: [geminiProvider({ apiKey: "g", fetch: ok, retryDelayMs: 1 }), claude] });
    expect(first.provider).toBe("gemini");
    expect(ok).toHaveBeenCalledTimes(2);
    const down = vi.fn(async () => json({ error: { code: 503, status: "UNAVAILABLE" } }, 503));
    const fallbacks: unknown[] = [];
    const second = await structureRecipe(caption, { platform: null, title: null }, { providers: [geminiProvider({ apiKey: "g", fetch: down, retryDelayMs: 1 }), claude], onFailure: (f) => fallbacks.push(f) });
    expect(second.provider).toBe("claude");
    expect(down).toHaveBeenCalledTimes(2);
    expect(fallbacks).toEqual([{ provider: "gemini", kind: "error", status: 503, reason: "UNAVAILABLE" }]);
  });

  it("RESOURCE_EXHAUSTED with another status code is quota too", async () => {
    const gemini = vi.fn(async () => json({ error: { code: 400, status: "RESOURCE_EXHAUSTED" } }, 400));
    expect((await run(deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, gemini))).provider).toBe("claude");
  });

  it("Gemini 429 and no Claude key → rules", async () => {
    const d = deps({ GEMINI_API_KEY: "g" }, vi.fn(async () => geminiQuota()));
    const body = await run(d);
    expect(body.provider).toBe("rules");
    expect(body.draft.name).toBe("Pratik menemen");
  });

  it("invalid JSON: one retry, then the next provider", async () => {
    const gemini = vi.fn(async () => geminiText("{ bu json değil"));
    const d = deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, gemini);
    expect((await run(d)).provider).toBe("claude");
    expect(gemini).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((gemini.mock.calls[1] as unknown as [string, RequestInit])[1].body)).contents[0].parts[0].text).toMatch(/şemaya uymadı/);
  });

  it("valid JSON that fails the schema counts as invalid; a good retry keeps Gemini", async () => {
    const gemini = vi.fn().mockResolvedValueOnce(geminiOk({ name: "", ingredients: "yok" })).mockResolvedValueOnce(geminiOk());
    const d = deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, gemini);
    expect((await run(d)).provider).toBe("gemini");
    expect(gemini).toHaveBeenCalledTimes(2);
    expect(d.create).not.toHaveBeenCalled();
  });

  it("timeout → next provider", async () => {
    const hang: LlmProvider = {
      name: "gemini",
      call: (_input, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    };
    const claude: LlmProvider = { name: "claude", call: async () => VALID };
    const out = await structureRecipe(caption, { platform: "tiktok", title: null }, { providers: [hang, claude], timeoutMs: 20 });
    expect(out.provider).toBe("claude");
  });

  it("Gemini fetch timing out is reported as a timeout and moves on", async () => {
    const gemini = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" })))),
    );
    const failures: string[] = [];
    const claude: LlmProvider = { name: "claude", call: async () => VALID };
    const out = await structureRecipe(
      caption,
      { platform: "tiktok", title: null },
      { providers: [geminiProvider({ apiKey: "g", fetch: gemini }), claude], timeoutMs: 20, onFailure: (f) => failures.push(`${f.provider}:${f.kind}`) },
    );
    expect(out.provider).toBe("claude");
    expect(failures).toEqual(["gemini:timeout"]);
  });

  it("Claude 429 after Gemini failed → rules", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error("rate_limit_error"), { status: 429 });
    });
    const d = deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, vi.fn(async () => json({}, 503)), create);
    expect((await run(d)).provider).toBe("rules");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("the request's overall deadline stops the chain: rules, next provider not called", async () => {
    const ctrl = new AbortController();
    const first: LlmProvider = {
      name: "gemini",
      call: async () => {
        ctrl.abort();
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
    };
    const second = { name: "claude" as const, call: vi.fn(async () => VALID) };
    const out = await structureRecipe(caption, { platform: null, title: null }, { providers: [first, second], signal: ctrl.signal });
    expect(out.provider).toBe("rules");
    expect(second.call).not.toHaveBeenCalled();
  });

  it("logs never contain the caption", async () => {
    await run(deps({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, vi.fn(async () => geminiText(caption))));
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("tereyağı");
  });
});

describe("privacy", () => {
  it("Gemini gets only the caption text and the platform — no household, names or emails", async () => {
    const d = deps({ GEMINI_API_KEY: "g" });
    const req = new Request("http://localhost/api/import", {
      method: "POST",
      body: JSON.stringify({ url: TIKTOK, householdId: "ev-ali-zeynep-42" }),
      headers: { "content-type": "application/json", cookie: "anv_session=ali@demo.ev", "x-forwarded-for": "203.0.113.9" },
    });
    await handleImport(req, d);
    const [, init] = d.gemini.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    // Exactly these fields, and the only variable text is the caption + platform.
    expect(Object.keys(body).sort()).toEqual(["contents", "generationConfig", "systemInstruction"]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: SYSTEM_PROMPT }] });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: userPrompt({ text: caption.trim(), platform: "tiktok" }, false) }] }]);
    expect(Object.keys(body.generationConfig).sort()).toEqual(["maxOutputTokens", "responseMimeType", "responseSchema", "temperature", "thinkingConfig"]);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });

    const raw = String(init.body);
    for (const secret of ["ev-ali-zeynep-42", "ali@demo.ev", "203.0.113.9", "mutfakdefteri", "Mutfak Defteri", TIKTOK]) expect(raw).not.toContain(secret);
    expect(Object.keys(init.headers as Record<string, string>).sort()).toEqual(["content-type", "x-goog-api-key"]);
  });

  it("provider input type has only text and platform; a public title becomes the caption's first line", () => {
    expect(providerInput("Malzemeler:\n2 yumurta", { platform: "youtube", title: "Kahvaltılık menemen" })).toEqual({
      text: "Kahvaltılık menemen\n\nMalzemeler:\n2 yumurta",
      platform: "youtube",
    });
    expect(providerInput("Menemen\nMalzemeler", { platform: null, title: "Menemen" })).toEqual({ text: "Menemen\nMalzemeler", platform: null });
  });
});
