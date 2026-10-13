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
                │ else Claude Haiku (key set) → else rules     │
                └──────────────────────────────────────────────┘
                          ▼  { source, draft, path: "llm" | "rules", needsPaste, message }
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
| Claude structurer (tool use, validation, retry) | `src/server/import/llm.ts` |
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

## Environment variables (all optional — the app works without them)

| Variable | Enables | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | "Akıllı okuma": Claude (`claude-haiku-5-5`, forced tool use, `max_tokens` 1500) structures the caption into the app's recipe shape — units normalised (yk, tk, su bardağı, gr, adet), pazar/market side, ordered steps with durations, menu role, prep-ahead notes | the rule-based parser pre-fills the form |
| `YOUTUBE_API_KEY` | full YouTube descriptions (where recipes usually are) | title only; the paste box opens |

Add them in Vercel → Project → Settings → Environment Variables (Production), then redeploy.

## Guardrails

- LLM output is validated with zod (`importedRecipeSchema`); invalid output is retried once with a
  short correction, then the rule parser is used.
- 30 LLM imports per household per day, in server memory (moves to a DB count on `import_log`
  with Supabase). Over the limit the draft still comes from the rule parser, with a calm note.
- 15 s timeout for the whole request (platform fetch + LLM share one AbortSignal).
- Input text is capped at 8 000 characters; request bodies over 20 000 are refused.
- Logs never contain captions or LLM input/output — only error class names.
- The web adapter only reaches public http(s) hosts (DNS-checked, redirects re-checked).
- Usage is counted per household in `importLog` (platform + path, no link or caption) and shown
  in Ayarlar: "Bu ay 12 tarif içe aktarıldı (9 tanesi akıllı okumayla)".

## Credit

The saved recipe keeps `sourceUrl`, `sourceAuthor` and `sourcePlatform`; the recipe page shows
"Kaynak: @author · Instagram" with "Videoyu aç".

## Share target

`src/app/manifest.ts` registers a Web Share Target (`GET /tarifler/ice-aktar?title&text&url`).
Android often puts the link inside `text`; the screen extracts it and starts automatically.
iOS Safari does not support share targets — iOS users paste the link.

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
