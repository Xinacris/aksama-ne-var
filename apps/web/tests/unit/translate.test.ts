// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { handleImport, type HandlerDeps } from "@/server/import/handler";
import { DailyLimiter } from "@/server/import/rateLimit";
import { CLAUDE_MODEL } from "@/server/llm/claude";
import { geminiProvider } from "@/server/llm/gemini";
import { systemPrompt } from "@/server/llm/prompt";
import { translateRecipe, translationTask, validateTranslation } from "@/server/llm/translate";
import { ProviderError, type LlmProvider } from "@/server/llm/types";
import { handleTranslate, handleTranslateInfo, type TranslateDeps } from "@/server/translate/handler";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const RECIPE = {
  name: "Annemin köftesi",
  steps: ["Kıymayı soğanla yoğur.", "Tavada iki yüzünü pişir."],
  prepItems: ["Kıymayı buzluktan çıkar"],
  notes: { "Bayat ekmek": "içi" },
  ingredients: ["Annemin baharatı"],
};
const ANSWER = {
  name: "Mum’s köfte",
  steps: ["Knead the mince with the onion.", "Cook both sides in a pan."],
  prepItems: ["Take the mince out of the freezer"],
  notes: [{ key: "Bayat ekmek", text: "crumb only" }],
  ingredients: [{ key: "Annemin baharatı", text: "Mum’s spice mix" }],
};

const geminiAnswer = (answer: unknown) => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] });

function claudeMessage(input: unknown): Anthropic.Message {
  return {
    id: "m",
    type: "message",
    role: "assistant",
    model: CLAUDE_MODEL,
    content: [{ type: "tool_use", id: "t", name: "recipe_translation", input } as Anthropic.ToolUseBlock],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message;
}

function deps(env: TranslateDeps["env"], geminiFetch?: ReturnType<typeof vi.fn>, create?: ReturnType<typeof vi.fn>): TranslateDeps & { geminiFetch: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } {
  const g = geminiFetch ?? vi.fn(async () => geminiAnswer(ANSWER));
  const c = create ?? vi.fn(async () => claudeMessage(ANSWER));
  return {
    fetch: vi.fn() as unknown as typeof fetch,
    geminiFetch: g as never,
    env,
    anthropic: () => ({ messages: { create: c } }) as unknown as Pick<Anthropic, "messages">,
    limiter: new DailyLimiter(30),
    create: c,
  } as never;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/translate", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

describe("translation task and validation", () => {
  it("asks for the target language and lines up steps and prep labels", () => {
    const task = translationTask({ from: "tr", to: "en", recipe: RECIPE }, false);
    expect(task.system).toMatch(/from Turkish to English/);
    expect(task.user).toContain("Recipe (tr → en)");
    expect(validateTranslation(ANSWER, RECIPE)).toEqual({
      name: "Mum’s köfte",
      steps: ANSWER.steps,
      prepItems: ANSWER.prepItems,
      notes: { "Bayat ekmek": "crumb only" },
      ingredients: { "Annemin baharatı": "Mum’s spice mix" },
    });
    expect(validateTranslation({ ...ANSWER, steps: ["Only one step."] }, RECIPE)).toBeNull();
    expect(validateTranslation({ ...ANSWER, notes: [{ key: "Unknown", text: "x" }] }, RECIPE)?.notes).toEqual({});
  });
});

describe("provider chain", () => {
  it("Gemini answers with structured JSON", async () => {
    const g = vi.fn(async () => geminiAnswer(ANSWER));
    const out = await translateRecipe({ from: "tr", to: "en", recipe: RECIPE }, { providers: [geminiProvider({ apiKey: "k", fetch: g as never })] });
    expect(out.provider).toBe("gemini");
    expect(out.translation.steps[0]).toBe("Knead the mince with the onion.");
  });

  it("falls through on quota and after invalid output (one retry)", async () => {
    const quota: LlmProvider = { name: "gemini", call: vi.fn(), run: vi.fn(async () => Promise.reject(new ProviderError("quota", 429))) };
    const wrongCount: LlmProvider = { name: "claude", call: vi.fn(), run: vi.fn(async () => ({ ...ANSWER, steps: ["x"] })) };
    await expect(translateRecipe({ from: "tr", to: "en", recipe: RECIPE }, { providers: [quota, wrongCount] })).rejects.toBeInstanceOf(ProviderError);
    expect(wrongCount.run).toHaveBeenCalledTimes(2);
    const good: LlmProvider = { name: "claude", call: vi.fn(), run: vi.fn(async () => ANSWER) };
    const out = await translateRecipe({ from: "tr", to: "en", recipe: RECIPE }, { providers: [quota, good] });
    expect(out.provider).toBe("claude");
  });
});

describe("/api/translate", () => {
  it("GET says unavailable without keys; POST answers 503 then (the action stays hidden)", async () => {
    const d = deps({});
    expect(await handleTranslateInfo(d).json()).toEqual({ available: false });
    const res = await handleTranslate(post({ from: "tr", to: "en", recipe: RECIPE }), d);
    expect(res.status).toBe(503);
  });

  it("translates with Gemini when its key is set", async () => {
    const d = deps({ GEMINI_API_KEY: "g" });
    expect(await handleTranslateInfo(d).json()).toEqual({ available: true });
    const res = await handleTranslate(post({ householdId: "h1", from: "tr", to: "en", recipe: RECIPE }), d);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { translation: { name: string }; provider: string };
    expect(body).toMatchObject({ provider: "gemini", translation: { name: "Mum’s köfte" } });
  });

  it("refuses the same language and bad bodies; errors come in the target language", async () => {
    const d = deps({ GEMINI_API_KEY: "g" });
    const same = await handleTranslate(post({ from: "en", to: "en", recipe: RECIPE }), d);
    expect(same.status).toBe(400);
    expect(((await same.json()) as { error: string }).error).toBe("We couldn’t read this translation request.");
    const tooLong = await handleTranslate(post({ from: "tr", to: "en", recipe: { ...RECIPE, steps: Array(41).fill("x") } }, { "accept-language": "tr-TR" }), d);
    expect(((await tooLong.json()) as { error: string }).error).toBe("Bu çeviri isteğini okuyamadık.");
  });

  it("shares the daily limit per household", async () => {
    const d = deps({ GEMINI_API_KEY: "g" });
    d.limiter = new DailyLimiter(1);
    expect((await handleTranslate(post({ householdId: "h", from: "tr", to: "en", recipe: RECIPE }), d)).status).toBe(200);
    expect((await handleTranslate(post({ householdId: "h", from: "tr", to: "en", recipe: RECIPE }), d)).status).toBe(429);
  });

  it("privacy: the provider gets the recipe text and the two languages only", async () => {
    const d = deps({ GEMINI_API_KEY: "g" });
    const req = post(
      { householdId: "ev-ali-zeynep-42", from: "tr", to: "en", recipe: RECIPE },
      { cookie: "anv_session=ali@demo.ev", "x-forwarded-for": "203.0.113.9" },
    );
    await handleTranslate(req, d);
    const [, init] = d.geminiFetch.mock.calls[0] as [string, RequestInit];
    const raw = String(init.body);
    const body = JSON.parse(raw);
    expect(Object.keys(body).sort()).toEqual(["contents", "generationConfig", "systemInstruction"]);
    for (const secret of ["ev-ali-zeynep-42", "ali@demo.ev", "203.0.113.9", "householdId"]) expect(raw).not.toContain(secret);
    const user = body.contents[0].parts[0].text as string;
    expect(JSON.parse(user.slice(user.indexOf("\n") + 1))).toEqual({
      name: RECIPE.name,
      steps: RECIPE.steps,
      prepItems: RECIPE.prepItems,
      notes: [{ key: "Bayat ekmek", text: "içi" }],
      ingredients: [{ key: "Annemin baharatı", text: "Annemin baharatı" }],
    });
    expect(Object.keys(init.headers as Record<string, string>).sort()).toEqual(["content-type", "x-goog-api-key"]);
  });
});

describe("import in other languages", () => {
  const importDeps = (env: HandlerDeps["env"] = {}, geminiFetch?: ReturnType<typeof vi.fn>): HandlerDeps =>
    ({
      fetch: vi.fn() as unknown as typeof fetch,
      webFetch: vi.fn() as unknown as typeof fetch,
      env,
      anthropic: () => ({ messages: { create: vi.fn() } }) as unknown as Pick<Anthropic, "messages">,
      geminiFetch,
      limiter: new DailyLimiter(30),
    }) as HandlerDeps;
  const importPost = (body: unknown) => new Request("http://localhost/api/import", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const ITALIAN = "Pasta al pomodoro\nIngredienti:\n200 g di spaghetti\n4 pomodori maturi\nOlio d'oliva\nCuocere la pasta in acqua salata.\nSaltare con il sugo.";

  it("the prompt asks for the draft in the user's language and the source language code", () => {
    expect(systemPrompt("en")).toContain("İngilizce yaz");
    expect(systemPrompt("tr")).toContain("Türkçe yaz");
    expect(systemPrompt("tr")).toContain("sourceLang");
  });

  it("without an LLM, non-Turkish text becomes a paste draft with a calm note (in the user's language)", async () => {
    const res = await handleImport(importPost({ text: ITALIAN, locale: "en" }), importDeps());
    const body = (await res.json()) as { draft: { name: string; ingredients: unknown[]; steps: { text: string }[] }; message: string; provider: string; sourceText: string };
    expect(body.provider).toBe("rules");
    expect(body.message).toBe("We couldn’t read this text automatically — please check it.");
    expect(body.draft.name).toBe("Pasta al pomodoro");
    expect(body.draft.ingredients).toEqual([]);
    expect(body.draft.steps.length).toBeGreaterThan(3);
    expect(body.sourceText).toBe(ITALIAN);
    const tr = await (await handleImport(importPost({ text: ITALIAN }), importDeps())).json();
    expect((tr as { message: string }).message).toBe("Bu metni otomatik ayrıştıramadık, lütfen kontrol et.");
  });

  it("with Gemini: the draft comes back in the user's language and keeps the detected source language", async () => {
    const g = vi.fn(async () =>
      geminiAnswer({
        name: "Pasta with tomato",
        sourceLang: "it",
        servings: 2,
        role: "ana",
        totalMinutes: null,
        prepMinutes: null,
        cookMinutes: 10,
        waitMinutes: null,
        cookingMethods: [],
        mainIngredients: [],
        prepTags: [],
        ingredients: [{ amount: 200, unit: "g", item: "Spaghetti", side: "market", note: null }],
        steps: [{ text: "Cook the pasta in salted water.", minutes: 10 }],
        prep: [],
      }),
    );
    const res = await handleImport(importPost({ text: ITALIAN, locale: "en" }), importDeps({ GEMINI_API_KEY: "g" }, g));
    const body = (await res.json()) as { draft: { name: string; sourceLang: string }; sourceLang: string; provider: string };
    expect(body.provider).toBe("gemini");
    expect(body.sourceLang).toBe("it");
    expect(body.draft.name).toBe("Pasta with tomato");
    const sent = JSON.parse(String((g.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.systemInstruction.parts[0].text).toContain("İngilizce yaz");
  });

  it("Turkish captions still go through the rule parser as before", async () => {
    const res = await handleImport(importPost({ text: "Menemen\nMalzemeler:\n3 yumurta\n2 domates\nYapılışı:\nDomatesleri tereyağında pişirin." }), importDeps());
    const body = (await res.json()) as { message: string | null; draft: { ingredients: unknown[] }; sourceLang: string };
    expect(body.message).toBeNull();
    expect(body.draft.ingredients.length).toBe(2);
    expect(body.sourceLang).toBe("tr");
  });
});
