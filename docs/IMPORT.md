# Recipe import ("Linkten ekle")

The user pastes (or, on Android, shares) a link to a recipe video or page. The app turns
the public text into a **draft** that opens in the normal recipe form. Nothing is saved until
the user presses "Tarifi kaydet".

```
Tarifler › Linkten ekle  ─┐
Android share sheet ──────┤→ /tarifler/ice-aktar?url=…&text=…
                          │
                          ▼  POST /api/import { url?, text?, householdId }
                ┌──────────────────────────────────────────────┐
                │ detect platform + normalise URL (detect.ts)  │
                │ source adapter → public text (adapters/*)    │
                │ pasted text wins over fetched text           │
                │ schema.org recipe? use it as is              │
                │ else provider chain (src/server/llm):        │
                │   Gemini → Claude → rule parser              │
                └──────────────────────────────────────────────┘
                          ▼  { source, draft, provider: "gemini" | "claude" | "rules",
                               path: "llm" | "rules", needsPaste, message }
       draft → existing RecipeForm (source card + "Kontrol edip kaydet") → save
```

## Code map

| Piece | File |
|---|---|
| URL detection, normalisation, link-in-text | `src/domain/import/detect.ts` |
| Source adapters (one per platform) | `src/domain/import/adapters/{tiktok,youtube,instagram,web}.ts`, registry in `adapters/index.ts` |
| schema.org/Recipe JSON-LD reader | `src/domain/import/schemaOrg.ts` |
| Rule-based Turkish parser | `src/domain/import/parseText.ts` (+ `units.ts`, `catalogMatch.ts`) |
| Pipeline (pure, deps injected) | `src/domain/import/pipeline.ts` |
| LLM provider chain: order, retry, fall-through | `src/server/llm/index.ts` (`structureRecipe`) |
| Shared prompt + JSON Schema / shared validator | `src/server/llm/prompt.ts` / `src/server/llm/validate.ts` |
| Providers | `src/server/llm/gemini.ts` (REST, structured output), `src/server/llm/claude.ts` (forced tool use) |
| Provider selection from env | `providersFromEnv` in `src/server/import/handler.ts` |
| Route handler, rate limit, private-host guard | `src/server/import/{handler,rateLimit,guardedFetch}.ts`, `src/app/api/import/route.ts` |
| Draft → form | `src/services/importDraft.ts` |
| Screen | `src/app/(app)/tarifler/ice-aktar/page.tsx` |
| Caption fixtures (written for the tests, not copied from creators) | `tests/fixtures/captions/*.txt` |

## Sources — official/public endpoints only

| Platform | What we call | What we get |
|---|---|---|
| TikTok | public oEmbed `https://www.tiktok.com/oembed?url=…` | caption (`title`), author handle, thumbnail |
| YouTube | with `YOUTUBE_API_KEY`: Data API v3 `videos.list?part=snippet`; without: public oEmbed | full description (key) or title + thumbnail only |
| Instagram | nothing — Meta's oEmbed no longer returns caption or thumbnail | link card; the paste box opens with a short explanation |
| Any other site | the page itself, through a private-network guard | `schema.org/Recipe` JSON-LD if present, otherwise title/og:image |

No HTML scraping of Instagram/TikTok, no video or audio download, no unofficial APIs (terms of
service). The paste box ("Açıklamayı buraya yapıştır") is always available and opens itself when
the fetched text has no ingredient-like lines.

## Providers — free first

The caption goes through an ordered chain; the first provider that returns a valid draft wins,
and the response says which one (`provider: "gemini" | "claude" | "rules"`).

| # | Provider | Enabled when | Model | How it returns structure |
|---|---|---|---|---|
| 1 | Gemini | `GEMINI_API_KEY` set | `gemini-3.1-flash-lite` (or `GEMINI_MODEL`) | `responseMimeType: application/json` + `responseSchema` |
| 2 | Claude | `ANTHROPIC_API_KEY` set | `claude-haiku-5-5`, `max_tokens` 1500 | forced tool use (`tarif_taslagi`) |
| 3 | Rules | always | — | `parseRecipeText` (rule-based Turkish parser) |

- Not configured → skipped.
- 429 / `RESOURCE_EXHAUSTED` (quota) → next provider immediately, no retry.
- Timeout → next provider. Each attempt has its own 7 s budget inside the request's 15 s
  deadline; once the overall deadline passes the chain stops and the rule parser answers.
- Invalid JSON or output that fails the schema → one retry with a short correction, then next.
- Other errors (5xx, network) → next.

Both LLMs get the **same** system prompt and user message (`prompt.ts`), the same output
schema (`RECIPE_JSON_SCHEMA`, converted to Gemini's OpenAPI subset by `toGeminiSchema`), and
their output goes through the **same** validator (`validateDraft`: tidy → zod
`importedRecipeSchema` → durations written into step text). A draft looks the same whichever
provider answered.

## Environment variables (all optional — the app works without them)

| Variable | Enables | Without it |
|---|---|---|
| `GEMINI_API_KEY` | "Akıllı okuma" with Gemini's free tier, tried first | the chain starts with Claude, or uses the rules |
| `GEMINI_MODEL` | another Gemini model (e.g. a newer flash-lite) | `gemini-3.1-flash-lite` |
| `ANTHROPIC_API_KEY` | Claude Haiku as the fallback (or the only LLM) | no paid fallback |
| `YOUTUBE_API_KEY` | full YouTube descriptions (where recipes usually are) | title only; the paste box opens |

Add them in Vercel → Project → Settings → Environment Variables (Production), then redeploy.
Locally, copy `.env.example` to `.env.local`.

### Getting a free Gemini key

1. Open [Google AI Studio](https://aistudio.google.com/apikey) with a Google account.
2. **Create API key** (it creates or picks a Google Cloud project; no billing needed for the free tier).
3. Put it in Vercel as `GEMINI_API_KEY` and redeploy. Ayarlar then shows imports as
   "(… Gemini, … kural)".

Free-tier limits are per project per minute/day; when they're hit Gemini answers 429 and the
chain moves on to Claude (if set) or the rules — the user never sees an error.

### Free-tier data note

On the free tier Google may use prompts and responses to improve its products (paid tier: it
does not). So the providers receive **only** `ProviderInput = { text, platform }`: the
caption/description (a YouTube title is folded in as its first line) and the platform name.
Never user names, household names or ids, emails, links, author handles or anything from
storage — the household id is used only as the server's rate-limit key.
`tests/unit/import/providers.test.ts` › "privacy" asserts the exact Gemini request body and
headers. Captions are public posts; still, if that is not acceptable for a deployment, leave
`GEMINI_API_KEY` unset or use a paid-tier key.

## Guardrails

- LLM output is validated with zod (`importedRecipeSchema`); invalid output is retried once with a
  short correction, then the next provider (finally the rule parser) is used.
- 30 smart imports per household per day across the whole chain, in server memory (moves to a DB
  count on `import_log` with Supabase). Over the limit the draft still comes from the rule
  parser, with a calm note.
- 15 s timeout for the whole request (platform fetch + LLM share one AbortSignal).
- Input text is capped at 8 000 characters; request bodies over 20 000 are refused.
- Logs never contain captions or LLM input/output — only provider names and failure kinds
  (`[import] gemini gave up (quota); trying next`).
- The web adapter only reaches public http(s) hosts (DNS-checked, redirects re-checked).
- Usage is counted per household in `importLog` (platform + provider, no link or caption) and
  shown in Ayarlar: "Bu ay 12 tarif içe aktarıldı (11 Gemini, 1 kural)".

## Credit

The saved recipe keeps `sourceUrl`, `sourceAuthor` and `sourcePlatform`; the recipe page shows
"Kaynak: @author · Instagram" with "Videoyu aç".

## Share target

`src/app/manifest.ts` registers a Web Share Target (`GET /tarifler/ice-aktar?title&text&url`).
Android often puts the link inside `text`; the screen extracts it and starts automatically.
iOS Safari does not support share targets — iOS users paste the link.

## Adding an LLM provider

1. Write `src/server/llm/<name>.ts` returning an `LlmProvider`:
   ```ts
   export function mistralProvider(opts: { apiKey: string; fetch: typeof fetch }): LlmProvider {
     return {
       name: "mistral",
       async call(input, { signal, retry }) {
         const res = await opts.fetch(URL, { method: "POST", signal, headers: { authorization: `Bearer ${opts.apiKey}` },
           body: JSON.stringify({ system: SYSTEM_PROMPT, user: userPrompt(input, retry), schema: RECIPE_JSON_SCHEMA }) })
           .catch(() => { throw new ProviderError(signal.aborted ? "timeout" : "error"); });
         if (res.status === 429) throw new ProviderError("quota");
         if (!res.ok) throw new ProviderError("error");
         return parseItsJson(res); // raw object; throw ProviderError("invalid") if it isn't JSON
       },
     };
   }
   ```
   Use only `SYSTEM_PROMPT`, `userPrompt(input, retry)` and `RECIPE_JSON_SCHEMA` from
   `prompt.ts`, and send nothing but `input` (text + platform). Don't validate — the chain does.
2. Add its name to `LlmProviderName` (`src/server/llm/types.ts`), to `IMPORT_PROVIDERS`
   (`src/domain/import/types.ts`), to the `importLog.provider` enum (`src/data/models.ts`, with a
   migration only if old rows change), to the `import_provider` enum in `supabase/schema.sql`,
   and its label in `src/domain/import/usage.ts`.
3. Add it to `providersFromEnv` (`src/server/import/handler.ts`) at the right place in the order,
   behind its env var, and pass the var through in `src/app/api/import/route.ts`.
4. Test it like `tests/unit/import/providers.test.ts`: mocked HTTP, request shape, 429 →
   fall-through, invalid JSON → one retry, and the privacy body check.

## Adding a source adapter

1. Add the platform to `SOURCE_PLATFORMS` in `src/data/models.ts` (and the `source_platform`
   enum in `supabase/schema.sql`) if it is new, plus its label in `PLATFORM_LABEL`.
2. Teach `detectPlatform` / `normalizeUrl` in `detect.ts` its URL shapes; add cases to
   `tests/unit/import/detect.test.ts`.
3. Write `src/domain/import/adapters/<name>.ts` implementing `SourceAdapter`:
   ```ts
   export const exampleAdapter: SourceAdapter = {
     platform: "example",
     async fetchSource(url, ctx) {
       const data = await getJson(ctx, `https://example.com/oembed?url=${encodeURIComponent(url)}`, "example");
       return { platform: "example", url, title: s(data.title), text: s(data.description),
                author: s(data.author_name), thumbnailUrl: s(data.thumbnail_url), needsPaste: !s(data.description) };
     },
   };
   ```
   Use only `ctx.fetch` (tests mock it; the route may guard it). Throw `SourceUnavailableError`
   when the platform answers with an error — the UI then explains calmly and offers pasting.
   If the source has structured data, return it as `recipe` (an `ImportedRecipe`) and the
   pipeline uses it without calling the LLM.
4. Register it in `ADAPTERS` (`adapters/index.ts`). If its endpoint is a fixed public host, add it
   to the plain-fetch allowlist in `src/server/import/handler.ts`; arbitrary user hosts stay on
   the guarded fetch.
5. Add adapter tests with a mocked `fetch` (see `tests/unit/import/adapters.test.ts`).

Recipe-site partnerships start from the schema.org adapter (`web.ts`): a partner feed or API
would be its own adapter returning the same `ImportedRecipe`.
