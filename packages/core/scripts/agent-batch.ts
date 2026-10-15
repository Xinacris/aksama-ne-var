/**
 * The catalog's agent workflow (Round 3.4): recipes written by Claude Code subagents (model haiku)
 * instead of an API key. One batch = one agent = one catalog file, ≤ 10 dishes. The orchestrating
 * session is the only writer of the state file; an agent only writes its staging file and, through
 * `run`, its own catalog file. Resumable: everything lives in data/recipes/.gen-state.json.
 *
 *   npx tsx scripts/agent-batch.ts brief                  # (re)write data/recipes/agent/BRIEF.md
 *   npx tsx scripts/agent-batch.ts plan                   # create the state file: every missing dish in batches
 *   npx tsx scripts/agent-batch.ts plan-fill              # add description batches for the built-ins
 *   npx tsx scripts/agent-batch.ts plan-retry             # add one retry batch per file for the failed dishes
 *   npx tsx scripts/agent-batch.ts next 4                 # hand out up to 4 pending batches on distinct files
 *   npx tsx scripts/agent-batch.ts run <batch> <staged>   # (agent) place + validate its staged recipes
 *   npx tsx scripts/agent-batch.ts record <batch> <tokens># (orchestrator) store the agent's result
 *   npx tsx scripts/agent-batch.ts reset-running          # after a crash: running → pending
 *   npx tsx scripts/agent-batch.ts status
 */
import fs from "node:fs";
import path from "node:path";
import { INGREDIENT_CATALOG } from "../src/data/seed/ingredients";
import { fileByDishId } from "../src/recipes/files";
import { fillSchema, systemPrompt } from "../src/recipes/generate";
import { qualityProblems } from "../src/recipes/quality";
import type { CatalogRecipe, Dish } from "../src/recipes/schema";
import { recipeProblems } from "../src/recipes/validate";
import { DATA_DIR, readCatalogFiles, readDishes } from "./catalogIo";

const BATCH_SIZE = 10;
const FILL_SIZE = 25;
const STATE = path.join(DATA_DIR, ".gen-state.json");
const AGENT_DIR = path.join(DATA_DIR, "agent");
const STAGING = path.join(AGENT_DIR, "staging");
const RESULTS = path.join(AGENT_DIR, "results");

type Kind = "generate" | "fill" | "retry";
type Status = "pending" | "running" | "done" | "partial" | "failed";
interface Batch {
  id: string;
  kind: Kind;
  file: string;
  slugs: string[];
  status: Status;
  passed: string[];
  failed: { slug: string; problems: string[] }[];
  tokens: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}
interface State {
  version: 1;
  note: string;
  batches: Batch[];
}

const dishes = readDishes();
const bySlug = new Map(dishes.map((d) => [d.slug, d]));
const fileOf = fileByDishId(dishes);

function readState(): State {
  if (!fs.existsSync(STATE)) throw new Error("no state file: run `plan` first");
  return JSON.parse(fs.readFileSync(STATE, "utf8")) as State;
}
function writeState(s: State) {
  atomicWrite(STATE, `${JSON.stringify(s, null, 1)}\n`);
}
/** Write to a temp file and rename, so a reader (another agent's `run`) never sees half a file. */
function atomicWrite(file: string, text: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

const ALCOHOL = new Set(INGREDIENT_CATALOG.filter((c) => c.alcohol).map((c) => c.key));

/** The style guide with a compact pantry (key=Turkish name, one line per aisle). */
function brief(): string {
  const rules = systemPrompt().split("\nPANTRY (pantryKey=Turkish name)\n")[0];
  const byAisle = new Map<string, string[]>();
  for (const c of INGREDIENT_CATALOG) {
    const list = byAisle.get(c.aisle) ?? [];
    list.push(`${c.key}=${c.name}${ALCOHOL.has(c.key) ? " [ALCOHOL]" : ""}`);
    byAisle.set(c.aisle, list);
  }
  const pantry = [...byAisle].map(([aisle, items]) => `${aisle}: ${items.join("; ")}`).join("\n");
  return `# Agent brief: write catalog recipes for "Akşama ne var?"

Your batch (in the prompt) gives each dish's id, slug, cuisine, category, region and title, and one target file.

## What to produce
A JSON array of COMPLETE recipe objects, saved to packages/core/data/recipes/agent/staging/<BATCH>.json:
{ id, slug, cuisine, category, region|null  ← copy exactly from the dish line
  title {tr,en}, shortTitle {tr?,en?}|null, description {tr,en},
  servings, prepMinutes, cookMinutes, waitMinutes|null, timeNote {tr,en}|null, difficulty 1|2|3,
  ingredients: [{ name {tr,en}, amount|null, unit|null, note {tr,en}|null, pantryKey, substitute|null }],
    substitute = { name {tr,en}, amount|null, unit|null, pantryKey, reason: "alcoholFree", note {tr,en} }
  steps: [{ text {tr,en}, timerSeconds|null }],
  prepAhead: [{ text {tr,en}, when: "night-before"|"morning"|"-60min" (any "-Nmin"), freezer?: true }]  (omit if none),
  freezerItem: pantryKey|null, tags: [], mealSlots: ["breakfast"|"lunch"|"dinner"],
  leftover: { likelihood "low"|"medium"|"high", keepsDays 1-4, reheatable bool },
  source: "curated-v1", version: 1 }
No other keys. Every timerSeconds equals a time written in that step's Turkish text ("20 dakika" → 1200, "2 saat" → 7200).
English spelling: British ("yoghurt", "flavour", "chilli").

## Place and check: ONE command (from the repo root /home/xinacris/aksama-ne-var)
npx tsx packages/core/scripts/agent-batch.ts run <BATCH> packages/core/data/recipes/agent/staging/<BATCH>.json
It writes the recipes that pass into the catalog file and lists the ones that don't, with exact problems.
If some fail: fix only those in the staged file and run the same command again. At most 2 fix rounds.
Never edit any other file. Do not run git.

# STYLE GUIDE
${rules}
PANTRY (pantryKey=Turkish name; use only these keys, copied exactly)
${pantry}
`;
}

function fillBrief(): string {
  return `# Agent brief: descriptions for existing recipes

For each recipe in your batch, write a description: one or two sentences in natural Turkish and a natural (British) English version, on what the dish is and what makes it good. No clichés ("nefis", "enfes", "mükemmel"), no exclamation marks. Do not change anything else.

Save a JSON array [{ "slug": ..., "description": { "tr": ..., "en": ... } }] to packages/core/data/recipes/agent/staging/<BATCH>.json, then run from the repo root:
npx tsx packages/core/scripts/agent-batch.ts run <BATCH> packages/core/data/recipes/agent/staging/<BATCH>.json
Fix failures (at most 2 rounds). Never edit any other file. Do not run git.
`;
}

const now = () => new Date().toISOString();
const newBatch = (id: string, kind: Kind, file: string, slugs: string[]): Batch => ({ id, kind, file, slugs, status: "pending", passed: [], failed: [], tokens: null, startedAt: null, finishedAt: null });

function plan() {
  if (fs.existsSync(STATE)) throw new Error("state file exists; refusing to overwrite (delete it deliberately to re-plan)");
  const have = new Set(Object.values(readCatalogFiles()).flat().map((r) => (r as CatalogRecipe).id));
  const byFile = new Map<string, string[]>();
  for (const d of dishes) {
    if (d.existing || have.has(d.id)) continue;
    const f = fileOf.get(d.id)!;
    byFile.set(f, [...(byFile.get(f) ?? []), d.slug]);
  }
  const batches: Batch[] = [];
  for (const [file, slugs] of byFile)
    for (let i = 0; i < slugs.length; i += BATCH_SIZE) batches.push(newBatch(`g${String(batches.length + 1).padStart(3, "0")}`, "generate", file, slugs.slice(i, i + BATCH_SIZE)));
  writeState({ version: 1, note: "Written only by the orchestrating session (agent-batch.ts next/record). Agents write staging + results.", batches });
  console.log(`${batches.length} batches, ${batches.reduce((n, b) => n + b.slugs.length, 0)} dishes`);
}

function planFill() {
  const s = readState();
  const files = readCatalogFiles() as Record<string, CatalogRecipe[]>;
  let n = 0;
  for (const [file, rows] of Object.entries(files)) {
    const slugs = rows.filter((r) => bySlug.get(r.slug)?.existing && !r.description).map((r) => r.slug);
    for (let i = 0; i < slugs.length; i += FILL_SIZE) {
      s.batches.push(newBatch(`f${String(++n).padStart(3, "0")}`, "fill", file, slugs.slice(i, i + FILL_SIZE)));
    }
  }
  writeState(s);
  console.log(`${n} fill batches`);
}

function planRetry() {
  const s = readState();
  const done = new Set(s.batches.flatMap((b) => b.passed));
  const byFile = new Map<string, string[]>();
  for (const b of s.batches) for (const f of b.failed) if (!done.has(f.slug)) byFile.set(b.file, [...new Set([...(byFile.get(b.file) ?? []), f.slug])]);
  let n = s.batches.filter((b) => b.kind === "retry").length;
  for (const [file, slugs] of byFile) for (let i = 0; i < slugs.length; i += BATCH_SIZE) s.batches.push(newBatch(`r${String(++n).padStart(3, "0")}`, "retry", file, slugs.slice(i, i + BATCH_SIZE)));
  writeState(s);
  console.log(`${byFile.size} files with failed dishes → retry batches added`);
}

function next(count: number) {
  const s = readState();
  const busy = new Set(s.batches.filter((b) => b.status === "running").map((b) => b.file));
  const out: Batch[] = [];
  for (const b of s.batches) {
    if (out.length >= count) break;
    if (b.status !== "pending" || busy.has(b.file)) continue;
    b.status = "running";
    b.startedAt = now();
    busy.add(b.file);
    out.push(b);
  }
  writeState(s);
  for (const b of out) {
    const lines = b.slugs.map((slug) => {
      const d = bySlug.get(slug)!;
      return b.kind === "fill" ? slug : JSON.stringify({ id: d.id, slug: d.slug, cuisine: d.cuisine, category: d.category, region: d.region ?? null, title: d.title, ...(d.hint ? { hint: d.hint } : {}) });
    });
    console.log(JSON.stringify({ batch: b.id, kind: b.kind, file: b.file, dishes: lines }));
  }
}

/** Agent command: place what passes, report what doesn't (writes results/<batch>.json). */
function run(batchId: string, stagedPath: string) {
  const s = readState();
  const batch = s.batches.find((b) => b.id === batchId);
  if (!batch) throw new Error(`unknown batch ${batchId}`);
  const raw = JSON.parse(fs.readFileSync(stagedPath, "utf8")) as unknown;
  if (!Array.isArray(raw)) throw new Error("the staged file must be a JSON array");
  const filePath = path.join(DATA_DIR, batch.file);
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8")) as CatalogRecipe[];
  const passed: string[] = [];
  const failed: { slug: string; problems: string[] }[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const slug = (item as { slug?: string })?.slug ?? "(no slug)";
    seen.add(slug);
    if (!batch.slugs.includes(slug)) {
      failed.push({ slug, problems: [`not in batch ${batchId} (allowed: ${batch.slugs.join(", ")})`] });
      continue;
    }
    const dish = bySlug.get(slug)!;
    const at = rows.findIndex((r) => r.slug === slug);
    if (batch.kind === "fill") {
      const f = fillSchema.safeParse(item);
      if (!f.success || at < 0) {
        failed.push({ slug, problems: f.success ? ["recipe not found in the file"] : f.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
        continue;
      }
      rows[at] = { ...rows[at], description: f.data.description };
      passed.push(slug);
      continue;
    }
    const problems = identityProblems(item, dish);
    const { recipe, problems: base } = recipeProblems(item);
    problems.push(...base);
    if (recipe) {
      problems.push(...qualityProblems(recipe));
      if (!recipe.description) problems.push("description: missing (TR + EN)");
    }
    if (problems.length || !recipe) {
      failed.push({ slug, problems });
      continue;
    }
    if (at >= 0) rows[at] = recipe;
    else rows.push(recipe);
    passed.push(slug);
  }
  for (const slug of batch.slugs) if (!seen.has(slug)) failed.push({ slug, problems: ["missing from the staged file"] });
  const order = new Map(dishes.map((d, i) => [d.id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  atomicWrite(filePath, `${JSON.stringify(rows, null, 1)}\n`);
  fs.mkdirSync(RESULTS, { recursive: true });
  atomicWrite(path.join(RESULTS, `${batchId}.json`), `${JSON.stringify({ batch: batchId, passed, failed, at: now() }, null, 1)}\n`);
  console.log(`${batchId}: ${passed.length} passed, ${failed.length} failed`);
  for (const f of failed) console.log(`  ✗ ${f.slug}\n${f.problems.map((p) => `      ${p}`).join("\n")}`);
}

function identityProblems(item: unknown, dish: Dish): string[] {
  const r = item as Partial<CatalogRecipe>;
  const out: string[] = [];
  if (r.id !== dish.id) out.push(`id must be ${dish.id}`);
  if (r.cuisine !== dish.cuisine) out.push(`cuisine must be ${dish.cuisine}`);
  if (r.category !== dish.category) out.push(`category must be ${dish.category}`);
  if ((r.region ?? null) !== (dish.region ?? null)) out.push(`region must be ${dish.region ?? null}`);
  return out;
}

function record(batchId: string, tokens: number) {
  const s = readState();
  const b = s.batches.find((x) => x.id === batchId);
  if (!b) throw new Error(`unknown batch ${batchId}`);
  const resultPath = path.join(RESULTS, `${batchId}.json`);
  const result = fs.existsSync(resultPath) ? (JSON.parse(fs.readFileSync(resultPath, "utf8")) as { passed: string[]; failed: Batch["failed"] }) : { passed: [], failed: b.slugs.map((slug) => ({ slug, problems: ["agent produced no result"] })) };
  b.passed = result.passed;
  b.failed = result.failed.filter((f) => !result.passed.includes(f.slug));
  b.tokens = tokens;
  b.finishedAt = now();
  b.status = b.failed.length === 0 ? "done" : b.passed.length ? "partial" : "failed";
  writeState(s);
  console.log(`${batchId}: ${b.status} (${b.passed.length}/${b.slugs.length}), ${tokens} tokens`);
}

function resetRunning() {
  const s = readState();
  let n = 0;
  for (const b of s.batches) if (b.status === "running") {
    b.status = "pending";
    b.startedAt = null;
    n++;
  }
  writeState(s);
  console.log(`${n} running → pending`);
}

function status() {
  const s = readState();
  const count = (k: Status) => s.batches.filter((b) => b.status === k).length;
  const tokens = s.batches.reduce((n, b) => n + (b.tokens ?? 0), 0);
  const passed = s.batches.reduce((n, b) => n + b.passed.length, 0);
  const failedOpen = new Set(s.batches.flatMap((b) => b.failed.map((f) => f.slug)));
  for (const p of s.batches.flatMap((b) => b.passed)) failedOpen.delete(p);
  console.log(`batches ${s.batches.length}: done ${count("done")}, partial ${count("partial")}, failed ${count("failed")}, running ${count("running")}, pending ${count("pending")}`);
  console.log(`dishes passed ${passed}, still failing ${failedOpen.size}${failedOpen.size ? ` (${[...failedOpen].join(", ")})` : ""}; agent tokens ${tokens}`);
}

const [cmd, a, b] = process.argv.slice(2);
fs.mkdirSync(STAGING, { recursive: true });
switch (cmd) {
  case "brief":
    fs.writeFileSync(path.join(AGENT_DIR, "BRIEF.md"), brief());
    fs.writeFileSync(path.join(AGENT_DIR, "BRIEF-fill.md"), fillBrief());
    console.log(`BRIEF.md ${fs.statSync(path.join(AGENT_DIR, "BRIEF.md")).size} bytes`);
    break;
  case "plan":
    plan();
    break;
  case "plan-fill":
    planFill();
    break;
  case "plan-retry":
    planRetry();
    break;
  case "next":
    next(Number(a ?? 4));
    break;
  case "run":
    run(a, b);
    break;
  case "record":
    record(a, Number(b ?? 0));
    break;
  case "reset-running":
    resetRunning();
    break;
  case "status":
    status();
    break;
  default:
    console.log("commands: brief | plan | plan-fill | plan-retry | next N | run <batch> <staged> | record <batch> <tokens> | reset-running | status");
}
