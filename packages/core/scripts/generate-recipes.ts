/**
 * Generates catalog recipes from dish-list.json through an LLM API (never by hand):
 *
 *   npm run recipes:generate                         # Gemini (default), every dish without a recipe
 *   npm run recipes:generate -- --limit 10           # only the next 10 dishes
 *   npm run recipes:generate -- --only cacik,piyaz   # these slugs
 *   npm run recipes:generate -- --cuisine italian --category dessert
 *   npm run recipes:generate -- --fill               # converted built-ins: write the missing descriptions
 *   GEN_PROVIDER=anthropic npm run recipes:generate  # Claude Haiku 5.5 through the Message Batches API
 *
 * Env: GEMINI_API_KEY (or GOOGLE_API_KEY), GEN_MODEL (default gemini-3.1-flash-lite), GEN_DELAY_MS
 * (pause between Gemini requests, default 6000), GEN_GEMINI_BASE (another endpoint: a proxy, or a
 * local mock for testing the pipeline); ANTHROPIC_API_KEY for anthropic.
 *
 * Resumable: dishes that already have a valid recipe are skipped, every valid recipe is written to
 * its file as soon as it arrives, so it is safe to stop (Ctrl-C) and rerun, also days later. A dish
 * that keeps failing validation is retried twice with the problems, then listed in
 * data/recipes/failed.json (rerun to try again, or pass --skip-failed). Anthropic: the batch id
 * is kept in data/recipes/.anthropic-batch.json, so a rerun resumes polling instead of submitting again.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fileByDishId } from "../src/recipes/files";
import { answerJsonSchema, draftToRecipe, fillPrompt, fillSchema, parseAnswer, systemPrompt, userPrompt } from "../src/recipes/generate";
import type { CatalogRecipe, Dish } from "../src/recipes/schema";
import { DATA_DIR, readCatalogFiles, readDishes, readJson, writeCatalogFile, writeJson } from "./catalogIo";

// ───────────────────────── options ─────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const provider = (opt("provider") ?? process.env.GEN_PROVIDER ?? "gemini").toLowerCase();
const fill = flag("fill");
const limit = opt("limit") ? Number(opt("limit")) : Infinity;
const only = opt("only")?.split(",").map((s) => s.trim());
const cuisine = opt("cuisine");
const category = opt("category");
const skipFailed = flag("skip-failed");
const MAX_ATTEMPTS = 3; // the first try + 2 retries
const PER_REQUEST = fill ? 20 : 5;
const GEMINI_MODEL = process.env.GEN_MODEL ?? "gemini-3.1-flash-lite";
const CLAUDE_MODEL = process.env.GEN_MODEL ?? "claude-haiku-5-5";
const DELAY_MS = Number(process.env.GEN_DELAY_MS ?? 6000);

for (const f of [path.join(DATA_DIR, "../../../../apps/web/.env.local"), path.join(DATA_DIR, "../../.env")]) loadEnvFile(f);

// ───────────────────────── catalog state ─────────────────────────

type Failure = { slug: string; attempts: number; problems: string[]; at: string };

const dishes = readDishes();
const fileOf = fileByDishId(dishes);
const files = readCatalogFiles() as Record<string, CatalogRecipe[]>;
const haveRecipe = new Map(Object.values(files).flat().map((r) => [r.id, r]));
const failed = new Map(readJson<Failure[]>("failed.json", []).map((f) => [f.slug, f]));

function todo(): Dish[] {
  return dishes
    .filter((d) => (only ? only.includes(d.slug) : true))
    .filter((d) => (cuisine ? d.cuisine === cuisine : true) && (category ? d.category === category : true))
    .filter((d) => (fill ? d.existing && haveRecipe.has(d.id) && !haveRecipe.get(d.id)!.description : !d.existing && !haveRecipe.has(d.id)))
    .filter((d) => !(skipFailed && failed.has(d.slug)))
    .slice(0, limit);
}

function save(recipe: CatalogRecipe) {
  const file = fileOf.get(recipe.id)!;
  files[file] = [...files[file].filter((r) => r.id !== recipe.id), recipe];
  haveRecipe.set(recipe.id, recipe);
  writeCatalogFile(file, files[file], dishes);
  if (failed.delete(recipe.slug)) writeJson("failed.json", [...failed.values()]);
}

function fail(slug: string, attempts: number, problems: string[]) {
  failed.set(slug, { slug, attempts, problems, at: new Date().toISOString() });
  writeJson("failed.json", [...failed.values()]);
}

/** Checks one answer item for `dish`; a fill item only adds the description to the existing recipe. */
function accept(raw: unknown, dish: Dish): string[] {
  if (fill) {
    const f = fillSchema.safeParse(raw);
    if (!f.success) return f.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    save({ ...haveRecipe.get(dish.id)!, description: f.data.description });
    return [];
  }
  const { recipe, problems } = draftToRecipe(raw, dish);
  if (recipe) save(recipe);
  return problems;
}

/** Matches answer items to dishes by slug (falls back to position). */
function matchAnswers(items: unknown[], group: Dish[]): Map<string, unknown> {
  const bySlug = new Map<string, unknown>();
  for (const [i, item] of items.entries()) {
    const slug = (item as { slug?: unknown })?.slug;
    const dish = group.find((d) => d.slug === slug) ?? group[i];
    if (dish && !bySlug.has(dish.slug)) bySlug.set(dish.slug, item);
  }
  return bySlug;
}

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const promptFor = (group: Dish[], feedback?: Map<string, string[]>) =>
  fill ? fillPrompt(group.map((dish) => ({ dish, recipe: haveRecipe.get(dish.id)! }))) : userPrompt(group, feedback);

// ───────────────────────── Gemini (free tier) ─────────────────────────

class QuotaExhausted extends Error {}

async function gemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set (apps/web/.env.local or the environment)");
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 32768 },
  };
  for (let attempt = 0; ; attempt++) {
    const base = process.env.GEN_GEMINI_BASE ?? "https://generativelanguage.googleapis.com/v1beta";
    const res = await fetch(`${base}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new Error("empty answer");
      return text;
    }
    const detail = await res.text();
    // Per-day quota: stop cleanly, the next run continues where this one stopped.
    if (res.status === 429 && /per ?day|PerDay|daily/i.test(detail)) throw new QuotaExhausted(detail.slice(0, 300));
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Math.min(600_000, 15_000 * 2 ** attempt);
      console.log(`  Gemini ${res.status}; waiting ${Math.round(wait / 1000)} s (attempt ${attempt + 1})`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
}

async function runGemini(list: Dish[]) {
  let done = 0;
  for (const group of chunk(list, PER_REQUEST)) {
    let pending = group;
    const feedback = new Map<string, string[]>();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
      let items: unknown[];
      try {
        items = parseAnswer(await gemini(promptFor(pending, feedback)));
      } catch (e) {
        if (e instanceof QuotaExhausted) throw e;
        console.log(`  request failed (${(e as Error).message.slice(0, 120)})`);
        for (const d of pending) feedback.set(d.slug, [`the whole answer failed: ${(e as Error).message.slice(0, 120)}`]);
        await sleep(DELAY_MS);
        continue;
      }
      const answers = matchAnswers(items, pending);
      const next: Dish[] = [];
      for (const dish of pending) {
        const problems = answers.has(dish.slug) ? accept(answers.get(dish.slug), dish) : ["missing from the answer"];
        if (!problems.length) {
          done++;
          feedback.delete(dish.slug);
          console.log(`  ✓ ${dish.slug}`);
        } else {
          feedback.set(dish.slug, problems);
          next.push(dish);
        }
      }
      pending = next;
      await sleep(DELAY_MS);
    }
    for (const d of pending) {
      fail(d.slug, MAX_ATTEMPTS, feedback.get(d.slug) ?? []);
      console.log(`  ✗ ${d.slug}: ${(feedback.get(d.slug) ?? []).slice(0, 3).join("; ")}`);
    }
  }
  return done;
}

// ───────────────────────── Anthropic (Message Batches) ─────────────────────────

/** custom_id → slugs (custom ids allow only [a-zA-Z0-9_-], so they are indices). */
type BatchState = { id: string; attempt: number; requests: Record<string, string[]> };

function batchRequests(groups: Dish[][], prompt: (g: Dish[]) => string, tool: Anthropic.Tool) {
  const requests: Record<string, string[]> = {};
  const params = groups.map((g, i) => {
    const custom_id = `r${i}`;
    requests[custom_id] = g.map((d) => d.slug);
    return {
      custom_id,
      params: {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        // The style guide is the same for every request: cached once, read at a tenth of the price.
        system: [{ type: "text" as const, text: systemPrompt(), cache_control: { type: "ephemeral" as const } }],
        tools: [tool],
        tool_choice: { type: "tool" as const, name: tool.name },
        messages: [{ role: "user" as const, content: prompt(g) }],
      },
    };
  });
  return { params, requests };
}

/** Uses `todo()` itself on each round (the dish list may change between resumed runs). */
async function runAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();
  const tool = { name: "save_recipes", description: "Saves the written recipes.", input_schema: answerJsonSchema(fill) as Anthropic.Tool.InputSchema };
  const statePath = ".anthropic-batch.json";
  let state = readJson<BatchState | null>(statePath, null);
  let done = 0;
  const bySlug = new Map(dishes.map((d) => [d.slug, d]));

  for (;;) {
    if (!state) {
      const remaining = todo();
      if (!remaining.length) break;
      // One request per dish (fill: 20 per request): independent, and a failure costs one dish.
      const groups = fill ? chunk(remaining, PER_REQUEST) : remaining.map((d) => [d]);
      const { params, requests } = batchRequests(groups, (g) => promptFor(g), tool);
      const batch = await client.messages.batches.create({ requests: params });
      state = { id: batch.id, attempt: 1, requests };
      writeJson(statePath, state);
      console.log(`batch ${batch.id}: ${groups.length} requests submitted`);
    }

    for (;;) {
      const b = await client.messages.batches.retrieve(state.id);
      if (b.processing_status === "ended") break;
      console.log(`  ${b.processing_status}: ${b.request_counts.processing} processing, ${b.request_counts.succeeded} done`);
      await sleep(60_000);
    }

    const retry = new Map<string, string[]>();
    for await (const result of await client.messages.batches.results(state.id)) {
      const slugs = state.requests[result.custom_id] ?? [];
      const group = slugs.map((s) => bySlug.get(s)).filter((d): d is Dish => !!d);
      if (result.result.type !== "succeeded") {
        for (const d of group) retry.set(d.slug, [`batch request ${result.result.type}`]);
        continue;
      }
      const block = result.result.message.content.find((c) => c.type === "tool_use");
      const items = block && block.type === "tool_use" ? ((block.input as { recipes?: unknown[] }).recipes ?? []) : [];
      const answers = matchAnswers(items, group);
      for (const dish of group) {
        const problems = answers.has(dish.slug) ? accept(answers.get(dish.slug), dish) : ["missing from the answer"];
        if (problems.length) retry.set(dish.slug, problems);
        else {
          done++;
          console.log(`  ✓ ${dish.slug}`);
        }
      }
    }

    if (!retry.size) {
      state = null;
      fs.rmSync(path.join(DATA_DIR, statePath), { force: true });
      break;
    }
    if (state.attempt >= MAX_ATTEMPTS) {
      for (const [slug, problems] of retry) fail(slug, state.attempt, problems);
      console.log(`${retry.size} dishes failed ${MAX_ATTEMPTS} times; see data/recipes/failed.json`);
      fs.rmSync(path.join(DATA_DIR, statePath), { force: true });
      break;
    }
    // Retry the failures in a new, smaller batch, with what was wrong.
    const again = [...retry.keys()].map((s) => bySlug.get(s)!).filter(Boolean);
    const { params, requests } = batchRequests(
      fill ? chunk(again, PER_REQUEST) : again.map((d) => [d]),
      (g) => (fill ? promptFor(g) : userPrompt(g, new Map(g.map((d) => [d.slug, retry.get(d.slug) ?? []])))),
      tool,
    );
    const batch = await client.messages.batches.create({ requests: params });
    state = { id: batch.id, attempt: state.attempt + 1, requests };
    writeJson(statePath, state);
    console.log(`retry batch ${batch.id}: ${again.length} dishes (attempt ${state.attempt})`);
  }
  return done;
}

// ───────────────────────── main ─────────────────────────

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const list = todo();
  console.log(`${provider}${fill ? " (fill descriptions)" : ""}: ${list.length} dishes to write; ${haveRecipe.size} recipes exist`);
  if (!list.length && !(provider === "anthropic" && readJson(".anthropic-batch.json", null))) return;
  const keyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : process.env.GOOGLE_API_KEY ? "GOOGLE_API_KEY" : "GEMINI_API_KEY";
  if (!process.env[keyName]) {
    console.error(`${keyName} is not set. Put it in apps/web/.env.local (or export it) and run again; nothing was written.`);
    process.exit(1);
  }
  try {
    const done = provider === "anthropic" ? await runAnthropic() : await runGemini(list);
    console.log(`done: ${done} written, ${failed.size} in failed.json. Validate with: npm run recipes:validate -- --partial`);
  } catch (e) {
    if (e instanceof QuotaExhausted) {
      console.log("Gemini's daily free quota is used up. Everything written so far is saved; run the same command again tomorrow.");
      return;
    }
    throw e;
  }
}

void main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
