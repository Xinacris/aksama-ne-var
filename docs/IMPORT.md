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
                │ schema.org recipe? use it as is ("web")      │
                │ "yazılı tarif" link in the text? follow it → │
                │   its schema.org recipe ("web")              │
                │ strip channel boilerplate (boilerplate.ts)   │
                │ else provider chain (apps/web/src/server/llm):        │
                │   Gemini → Claude → rule parser              │
                │ junk steps dropped (links, promos)           │
                └──────────────────────────────────────────────┘
                          ▼  { source, draft, provider: "gemini" | "claude" | "web" | "rules",
                               path, writtenRecipeUrl, needsPaste, message, fallbacks }
       draft → existing RecipeForm (source card + "Kontrol edip kaydet") → save
```

## Code map

| Piece | File |
|---|---|
| URL detection, normalisation, link-in-text | `packages/core/src/domain/import/detect.ts` |
| Source adapters (one per platform) | `packages/core/src/domain/import/adapters/{tiktok,youtube,instagram,web}.ts`, registry in `adapters/index.ts` |
| schema.org/Recipe JSON-LD reader | `packages/core/src/domain/import/schemaOrg.ts` |
| Rule-based Turkish parser | `packages/core/src/domain/import/parseText.ts` (+ `units.ts`, `catalogMatch.ts`) |
| Pipeline (pure, deps injected) | `packages/core/src/domain/import/pipeline.ts` |
| LLM provider chain: order, retry, fall-through | `apps/web/src/server/llm/index.ts` (`structureRecipe`) |
| Shared prompt + JSON Schema / shared validator | `apps/web/src/server/llm/prompt.ts` / `apps/web/src/server/llm/validate.ts` |
| Providers | `apps/web/src/server/llm/gemini.ts` (REST, structured output), `apps/web/src/server/llm/claude.ts` (forced tool use) |
| Provider selection from env | `providersFromEnv` in `apps/web/src/server/import/handler.ts` |
| Route handler, rate limit, private-host guard | `apps/web/src/server/import/{handler,rateLimit,guardedFetch}.ts`, `apps/web/src/app/api/import/route.ts` |
| Draft → form | `packages/core/src/services/importDraft.ts` |
| Screen | `apps/web/src/app/(app)/tarifler/ice-aktar/page.tsx` |
| Caption fixtures (written for the tests, not copied from creators) | `packages/core/tests/fixtures/captions/*.txt` |

## Sources — official/public endpoints only

| Platform | What we call | What we get |
|---|---|---|
| TikTok | public oEmbed `https://www.tiktok.com/oembed?url=…` | caption (`title`), author handle, thumbnail |
| YouTube | with `YOUTUBE_API_KEY`: Data API v3 `videos.list?part=snippet`; without: public oEmbed | full description (key) or title + thumbnail only |
| Instagram | public oEmbed without a token, `https://graph.facebook.com/v24.0/instagram_oembed?url=…&omitscript=true` (Meta made it tokenless in June 2026) | public vs private/deleted, and nothing else today: tested live on 2026-10-15, the `html` is the embed shell ("View this post on Instagram") with no caption, author or thumbnail. The link card and paste box open (on the phone also "Ekran görüntüsünden oku"); a private/deleted post gets its own message; a caption in the HTML, if Meta ever puts it back, is used |
| Any other site | the page itself, through a private-network guard | `schema.org/Recipe` JSON-LD if present, otherwise title/og:image |

No HTML scraping of Instagram/TikTok, no video or audio download, no unofficial APIs (terms of
service). The paste box ("Açıklamayı buraya yapıştır") is always available and opens itself when
the fetched text has no ingredient-like lines.

## Written recipes linked from a video

Recipe channels (Yemek.com and others) often keep only ingredients — or nothing — in the video
description and link the written recipe: "Yazılı tarif için: https://…/tarif/…". Before any
structuring, `packages/core/src/domain/import/links.ts` scans the description/caption for links:

- Social (Instagram, Facebook, X, TikTok, Pinterest, …), video (YouTube, Vimeo, …) and link-in-bio
  hosts are never recipe pages. Chef/profile pages are skipped; a site's home page ranks low.
- Preferred: a link on a line with "yazılı tarif"/"recipe" (then "tarif"), and paths like
  `/tarif/…`, `/recipe/…`. Lines with abone/takip/sponsor/ürünler/sosyal medya don't count.
- At most **2** links are tried, through the existing web adapter (guarded fetch: public hosts only,
  ≤ 3 redirects, 1.5 MB HTML cap; 8 s per page inside the request deadline).
- Shorteners (bit.ly, …) are expanded only when no direct link worked and only from a line that
  points to the recipe: one `HEAD` through the guarded fetch, 5 s, ≤ 3 redirects.
- If the page has a schema.org/Recipe with ingredients **and** steps, it is the draft
  (`provider: "web"`) — no LLM call for structure; tags and times are still suggested from it.
  The video stays the Kaynak ("YouTube · Yemek.com") and the page is stored as
  `writtenRecipeUrl`, shown on the recipe page as **Yazılı tarif**.

## Boilerplate never becomes a step

`packages/core/src/domain/import/boilerplate.ts` removes, before the LLM or the rule parser sees the text: lines
that are mostly a link, social handles/links, subscribe/follow calls (abone ol, takip et,
bildirimleri aç, subscribe), "SOSYAL MEDYA HESAPLARIMIZ", hashtag-only lines, sponsor/affiliate
lines (sponsor, işbirliği, indirim kodu, "ürünlerine ulaşmak için"), and chef/site promos ("tüm
tariflerine ulaşmak için", "sitemizi ziyaret edin"). Matching lower-cases with the Turkish locale
first ("İndirim", "İnstagram"). The LLM prompt says steps are cooking actions only — never links,
promotions or channel info — and an empty list when there are none; the shared validator and the
pipeline drop any step that still matches. When no steps remain, the review screen says: "Bu
açıklamada adımlar yok. Yazılı tarifin linki varsa yapıştır ya da adımları kendin ekle."

## Providers — free first

`AI_PROVIDER` picks the provider: `anthropic` (Claude only — the intended production setting),
`gemini` (Gemini only — development/testing on the free tier), `none` (rule parser only). Unset
(today's production) → every configured provider in the order below. A chosen provider without
its key falls back to the rules with a log warning; an unknown value is ignored with a warning.

The caption goes through an ordered chain; the first provider that returns a valid draft wins,
and the response says which one (`provider: "gemini" | "claude" | "rules"`).

| # | Provider | Enabled when | Model | How it returns structure |
|---|---|---|---|---|
| 1 | Gemini | `GEMINI_API_KEY` set | `gemini-3.1-flash-lite` (or `GEMINI_MODEL`) | `responseMimeType: application/json` + `responseSchema`; `thinkingConfig.thinkingLevel: "minimal"` (falls back to `"low"` if a model refuses it) |
| 2 | Claude | `ANTHROPIC_API_KEY` set | `claude-haiku-5-5`, `max_tokens` 1500 | forced tool use (`tarif_taslagi`) |
| 3 | Rules | always | — | `parseRecipeText` (rule-based Turkish parser) |

- Not configured → skipped.
- 429 / `RESOURCE_EXHAUSTED` (quota) → next provider immediately, no retry.
- Timeout → next provider. A provider with another one after it gets 8 s per attempt; the last
  one may use what is left of the request's 25 s deadline. Once the deadline passes the chain
  stops and the rule parser answers.
- 500/503 (Gemini "model is overloaded") → one retry after 0.8 s, then next.
- Invalid JSON or output that fails the schema → one retry with a short correction, then next.
- Other errors (5xx, network) → next.

Both LLMs get the **same** system prompt and user message (`prompt.ts`) — including the timing
and tag rules above — the same output
schema (`RECIPE_JSON_SCHEMA`, converted to Gemini's OpenAPI subset by `toGeminiSchema`), and
their output goes through the **same** validator (`validateDraft`: tidy → zod
`importedRecipeSchema` → durations written into step text). A draft looks the same whichever
provider answered.

## Environment variables (all optional — the app works without them)

| Variable | Enables | Without it |
|---|---|---|
| `AI_PROVIDER` | `anthropic` \| `gemini` \| `none`: one provider only | every configured provider, Gemini → Claude |
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
`apps/web/tests/unit/import/providers.test.ts` › "privacy" asserts the exact Gemini request body and
headers. Captions are public posts; still, if that is not acceptable for a deployment, leave
`GEMINI_API_KEY` unset or use a paid-tier key.

## Guardrails

- LLM output is validated with zod (`importedRecipeSchema`); invalid output is retried once with a
  short correction, then the next provider (finally the rule parser) is used.
- 30 smart imports per household per day across the whole chain, in server memory (moves to a DB
  count on `import_log` with Supabase). Over the limit the draft still comes from the rule
  parser, with a calm note.
- 25 s deadline for the whole request (platform fetch, written-recipe page, LLM share one
  AbortSignal; the route's `maxDuration` is 30 s).
- Why a provider gave up is logged and returned as `fallbacks: [{ provider, kind, status, reason }]`
  (HTTP status and the provider's error code only — never caption text).
- Input text is capped at 8 000 characters; request bodies over 20 000 are refused.
- Logs never contain captions or LLM input/output — only provider names and failure kinds
  (`[import] gemini gave up (quota); trying next`).
- The web adapter only reaches public http(s) hosts (DNS-checked, redirects re-checked).
- Usage is counted per household in `importLog` (platform + provider, no link or caption) and
  shown in Ayarlar: "Bu ay 12 tarif içe aktarıldı (11 Gemini, 1 kural)".

## What the draft pre-fills

| Field | Where it comes from |
|---|---|
| **Kaynak** (never empty) | `sourceLabel` in `packages/core/src/services/importDraft.ts`: "YouTube · Yemek.com", "TikTok · @mutfakdefteri", just "Instagram" when the author is unknown, the site name for web pages (og:site_name, else the host), "Yapıştırılan tarif metni" for text pasted without any link. Same on every path: fetched text, pasted text, rules, LLM, schema.org. The paste-fallback call fetches the link again; if the platform answers less the second time, `keepSource` keeps the first answer's author/title/thumbnail for the same link. Editable. |
| Credit fields | `sourceUrl`, `sourcePlatform`, `sourceAuthor`, `sourceThumbnailUrl` (the platform's own thumbnail URL; never downloaded or re-hosted). The recipe page shows "Kaynak: <the Kaynak text>" with "Videoyu aç"; recipes imported before this had no text and keep the derived "Kaynak: @author · Platform". |
| **Etiketler** | Only the vocabulary in `packages/core/src/domain/import/tags.ts`, in the app's existing spelling: cooking method (Kızartma, Fırında, Tencere, Tavada, Izgara, Haşlama, Buharda, Pişirmeden), main ingredient (Kıymalı, Etli, Tavuklu, Balık, Vejetaryen, Bakliyat), prep (Akşamdan ıslat, Marine, Dinlendirme). Synonyms map onto them (Tencerede → Tencere, Balıklı → Balık, Baklagil → Bakliyat, Etsiz → Vejetaryen); anything else is dropped. LLMs fill `cookingMethods` / `mainIngredients` / `prepTags`; the rule parser uses keywords (kızart/kızgın yağ → Kızartma, fırın → Fırında, balık/morina → Balık, …). Merged with tags already in the form, deduplicated; the user can remove any. |
| **Hazırlık / Pişirme / Bekleme** | Pişirme is time on heat or in the oven only. Marinating, resting, soaking, chilling and rising go to **Bekleme (dk)** (`waitMinutes`), overnight soaks to the prep-ahead notes. LLMs return `prepMinutes`, `cookMinutes`, `waitMinutes` separately and are told this explicitly; the rule parser reads "Hazırlık/Pişirme/Bekleme:" lines and otherwise counts heat steps as cooking and waiting steps (`isWaitingStep`) as Bekleme (`packages/core/src/domain/import/timing.ts`). Pişirme over 90 min with no step that simmers or roasts that long shows "Süre uzun görünüyor, kontrol et" under the field — a hint, never a block. |
| **Artarsa ne olur?** | Always "Artmaz / hepsi biter". Nothing about leftovers is guessed — not by the LLM, not by the rules. |

## Credit

The saved recipe keeps `sourceUrl`, `sourceAuthor`, `sourcePlatform` and `sourceThumbnailUrl`, and
the Kaynak text; the recipe page shows "Kaynak: YouTube · Yemek.com" with "Videoyu aç".

## Costs

| Piece | Cost |
|---|---|
| TikTok / YouTube / Instagram oEmbed | free, no key (Meta's tokenless oEmbed may have lower rate limits; a 429 shows "Instagram şu an yanıt vermedi" and the paste box) |
| YouTube Data API v3 (`videos.list`, 1 unit) | free within the default 10 000 units/day quota |
| Gemini 3.1 Flash-Lite, free tier | free; Google may use free-tier inputs, and its limits are unpublished and change — dev/testing only |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10 / 1M input, $0.50 / 1M output tokens (prompts under 100K tokens). One import ≈ 2.3k input (prompt + schema + a typical caption) + ≈ 600 output tokens ≈ **$0.0005**; a maximum 20 000-character caption ≈ $0.0015. About $0.50 per 1 000 imports; the daily limit is 30 smart imports per household |
| Rule parser, on-device screenshot reading | free |

The prompt stays far under 100k tokens: captions are capped at 20 000 characters (≈ 6–7k tokens).
Keys exist only on the server (`/api/import`, `/api/translate`); the phone calls those routes and
has no key in its bundle.

## Share target

`apps/web/src/app/manifest.ts` registers a Web Share Target (`GET /tarifler/ice-aktar?title&text&url`).
Android often puts the link inside `text`; the screen extracts it and starts automatically.
iOS Safari does not support share targets — iOS users paste the link.

**Phone app:** Android's share sheet offers "Akşama ne var?" for text shares (expo-sharing intent
filter; `src/app/+native-intent.ts` turns the share into `/tarifler/ice-aktar?text=…`). The iOS Share
Extension is built only with `ANV_IOS_SHARE_EXTENSION=1` (it adds a signed extension target and an
App Group). Both need a native build.

## Instagram from screenshots (phone)

In the Instagram paste fallback the phone also offers **"Ekran görüntüsünden oku"**: pick up to six
screenshots of the caption, in order; expo-text-extractor reads them on the device (iOS Vision,
Android ML Kit through Google Play services — free, nothing uploaded), core `captionFromScreenshots`
merges the pages (lines repeated where scrolled screenshots overlap are dropped, as are Instagram's
own interface lines: likes, comments, "devamı", "Çeviriyi gör", times) and the text is imported like
a pasted caption. Needs a native build; Expo Go shows paste only.

**Turkish letters (Round 3.3).** On iOS the local module `apps/mobile/modules/anv-text-recognition`
reads instead of expo-text-extractor (whose iOS reader is English-only): Vision with
`recognitionLanguages` = `tr-TR`, `en-US` as far as the device's Vision supports them (asked on the
device: Apple publishes no per-version list), `.accurate`, language correction on. It's linked unless
the build sets `ANV_IOS_TR_OCR=0`. Android's ML Kit Latin recognizer reads Turkish letters already.
Two safety nets on the server, for text the phone marks `textOrigin: "ocr"`:
- the LLMs get one extra system-prompt rule (`OCR_RULE`): restore Turkish letters in the name,
  ingredients and steps; change letters only, never numbers, amounts or units; leave a word as is
  when unsure. Every other request's prompt is byte-identical to before;
- the rule parser gets the text through `restoreDiacritics` (core `domain/import/diacritics.ts`): a
  recipe dictionary of words with one meaning ("sogan" → "soğan", "pisirin" → "pişirin"), and words
  that are real both ways ("sis"/"şiş", "kasik"/"kaşık", "dis"/"diş", "ilik"/"ılık") only in a clear
  context ("yemek kasigi", "2 dis sarimsak", "ilik su", "sis kebap"). Unknown words are kept as read;
  text that doesn't come out Turkish (an English caption) is returned unchanged.

## Adding an LLM provider

1. Write `apps/web/src/server/llm/<name>.ts` returning an `LlmProvider`:
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
2. Add its name to `LlmProviderName` (`apps/web/src/server/llm/types.ts`), to `IMPORT_PROVIDERS`
   (`packages/core/src/domain/import/types.ts`), to the `importLog.provider` enum (`packages/core/src/data/models.ts`, with a
   migration only if old rows change), to the `import_provider` enum in `supabase/schema.sql`,
   and its label in `packages/core/src/domain/import/usage.ts`.
3. Add it to `providersFromEnv` (`apps/web/src/server/import/handler.ts`) at the right place in the order,
   behind its env var, and pass the var through in `apps/web/src/app/api/import/route.ts`.
4. Test it like `apps/web/tests/unit/import/providers.test.ts`: mocked HTTP, request shape, 429 →
   fall-through, invalid JSON → one retry, and the privacy body check.

## Adding a source adapter

1. Add the platform to `SOURCE_PLATFORMS` in `packages/core/src/data/models.ts` (and the `source_platform`
   enum in `supabase/schema.sql`) if it is new, plus its label in `PLATFORM_LABEL`.
2. Teach `detectPlatform` / `normalizeUrl` in `detect.ts` its URL shapes; add cases to
   `packages/core/tests/unit/import/detect.test.ts`.
3. Write `packages/core/src/domain/import/adapters/<name>.ts` implementing `SourceAdapter`:
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
   to the plain-fetch allowlist in `apps/web/src/server/import/handler.ts`; arbitrary user hosts stay on
   the guarded fetch.
5. Add adapter tests with a mocked `fetch` (see `packages/core/tests/unit/import/adapters.test.ts`).

Recipe-site partnerships start from the schema.org adapter (`web.ts`): a partner feed or API
would be its own adapter returning the same `ImportedRecipe`.

## Round 3: other languages and "Çevir / Translate"

- **Import in any language.** The request carries the user's `locale` (`tr` | `en`). The shared prompt
  (`systemPrompt(locale)`) tells the provider to read the caption in whatever language it is and to
  write the draft in the user's language, and to report `sourceLang` (ISO 639-1). The response adds
  `sourceLang` and `sourceText` (the original caption/page text); both are saved with the recipe
  (`Recipe.sourceLang`, `Recipe.sourceText`). The recipe's `lang` is the language its text is
  written in, i.e. the user's.
- **Without an LLM** the rule parser still reads Turkish only. Text that shows no sign of Turkish
  (`looksTurkish`: Turkish letters or common kitchen words) gets a plain paste draft — its lines as
  steps, no guessed ingredients — and the note "Bu metni otomatik ayrıştıramadık, lütfen kontrol et." /
  "We couldn’t read this text automatically — please check it."
- **Messages** from the pipeline and the route come in the request's language (`i18n.getFixedT(locale)`,
  or `Accept-Language` when the body has none).
- **`/api/translate`** (`apps/web/src/server/translate/handler.ts`, `server/llm/translate.ts`):
  `GET` → `{ available }` (the apps hide the action when it's false — no keys, never a broken button);
  `POST { householdId?, from, to, recipe: { name, steps, prepItems, notes, ingredients } }` →
  `{ translation, provider }`. Same provider order and fall-through as import (Gemini → Claude, one
  retry on invalid output, 25 s deadline), same daily limit per household (its own counter). The
  answer must have exactly as many steps and prep labels as the request. **Privacy:** only the recipe
  text and the two language codes reach a provider; the household id is the quota key only
  (`tests/unit/translate.test.ts` › privacy checks the exact Gemini body).
- Providers now take a generic task (`LlmTask`: system, user message, JSON Schema, Claude tool);
  `call()` is the import task, `run()` any other. The import's request body is unchanged.
- The saved translation goes to `translations[locale]` with `origin: "llm"` and is editable like any text
  (editing in that language changes the translation, not the source).
