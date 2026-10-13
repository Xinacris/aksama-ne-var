# Akşama Ne Var? — Round 2.1: free-first LLM providers for recipe import

Round 2 (`PROMPT-v2.md`) built recipe import with Claude Haiku as the only LLM, falling back to the rule-based parser. This round puts the LLM behind a provider interface and makes **Gemini's free tier the default**, so import costs nothing in normal use. Everything else from round 2 stays as it is.

## 0. Operating rules

1. Before any work, read `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `PROMPT-v2.md` and `docs/IMPORT.md`, then read the existing import route and its tests. If round 2 is not fully done (any unchecked R-item in `PROGRESS.md`), finish round 2 first, then start this round.
2. Save this file as `PROMPT-v2.1.md` at the repo root. Append `## Round 2.1` to `PROGRESS.md` with the checklist in section 3 (P1…P4). Add one line to the top of `CLAUDE.md`: *"Round 2.1 spec is in PROMPT-v2.1.md; continue from the first unchecked P-item in PROGRESS.md."*
3. Never ask a question; log judgement calls in `DECISIONS.md` (decision + reason).
4. Push rule unchanged: push to `main` after each finished phase only when `npm run lint && npm run typecheck && npm test && npm run build` pass; run `npm run test:e2e` before the final push.
5. The app must keep working on Vercel with **no** environment variables.

## 1. What to build

1. **Provider interface** in `src/server/llm/`: one function like `structureRecipe(text, meta) → { draft, provider }`, with implementations:
   - **Gemini** — enabled when `GEMINI_API_KEY` is set. Default model `gemini-3.1-flash-lite`, overridable with `GEMINI_MODEL`. Use Gemini's structured JSON output (response schema) matching the existing recipe draft type.
   - **Claude** — the existing Haiku implementation (`claude-haiku-5-5`), moved behind the same interface, enabled when `ANTHROPIC_API_KEY` is set.
   - **Rules** — the existing rule-based Turkish parser, always available.
2. **Order and fall-through:** Gemini → Claude → rules. If a provider is not configured, skip it. If it returns a rate-limit/quota error (HTTP 429 / resource exhausted), a timeout or invalid JSON after one retry, move to the next provider instead of failing. The route response keeps saying which provider produced the draft (`gemini` | `claude` | `rules`).
3. **One prompt, one validator:** both LLM providers use the same system prompt text and the same schema validation, so drafts look the same whichever one answered. Move the prompt into one shared file.
4. **Privacy:** Gemini's free tier may use inputs to improve Google's products. Send only the caption/description text and the source platform — never user names, household names, emails or anything from storage. Add a test that asserts the outgoing request body contains only those fields.
5. **Usage visibility:** the existing per-household import counter in Ayarlar now shows the provider split, e.g. "Bu ay 12 tarif içe aktarıldı (11 Gemini, 1 kural)". Keep the existing rate limit.
6. **Tests:** unit tests for provider selection (no keys; only Gemini; only Claude; both), fall-through on 429, timeout and invalid JSON; the privacy test above. Mock both SDKs/HTTP calls; no real network in tests. Existing import e2e stays green.
7. **Docs:** update `docs/IMPORT.md` — provider order, env vars (`GEMINI_API_KEY`, `GEMINI_MODEL`, `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`), how to get a free key in Google AI Studio, the free-tier data note, and how to add another provider. Update `.env.example`.

## 2. Out of scope

No audio/video transcription, no scraping, no Apify or other unofficial APIs (same rule as round 2). Do not change the import UI beyond the usage line in Ayarlar.

## 3. Phases (append to PROGRESS.md as P1…P4)

- P1. Provider interface; move the Claude implementation behind it; shared prompt + validator; existing tests green.
- P2. Gemini implementation with structured output; selection order and fall-through; unit + privacy tests.
- P3. Ayarlar usage line with provider split; docs/IMPORT.md and .env.example updated.
- P4. Final: all scripts and e2e green, push, check Vercel status (`gh api repos/{owner}/{repo}/commits/main/status`).

When done, the last line of `PROGRESS.md` must read: `ROUND 2.1 DONE — live: <Vercel URL>` followed by one line: "Add GEMINI_API_KEY in Vercel to make import free; ANTHROPIC_API_KEY is now an optional fallback."
