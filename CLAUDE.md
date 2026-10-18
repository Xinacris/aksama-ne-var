All work happens on `main`. Every push to `main` deploys production — push only with all checks green. Before any work, read `docs/PROGRESS.md` (the build log) and continue from its last section ("Round 3.4 — full catalog run" › "Done" and "Sabah notu"; the open owner items of 3.2 are in "Handoff after Round 3.2"); also read `docs/DECISIONS.md`. Backlog: `docs/BACKLOG.md`; demo script: `docs/DEMO.md`.

Round specs live in `docs/prompts/`, which is **gitignored and local only** (never commit prompts): `PROMPT-v1.md` (the original spec), `PROMPT-v2.md`, `PROMPT-v2.1.md`, `PROMPT-v2.2.md`, `PROMPT-v3.md`, `PROMPT-v3.1.md` … `PROMPT-v3.4.md` (all done; v3.4 = the 1,000-recipe catalog). New round prompts go to `docs/prompts/PROMPT-v<round>.md` (the `.gitignore` rule covers them).

Catalog work (extending or regenerating recipes): the reusable agent workflow and the resume procedure are in `docs/PROGRESS.md` › "Round 3.4 — full catalog run" (`packages/core/scripts/agent-batch.ts`, `packages/core/data/recipes/agent/BRIEF.md`, state file `packages/core/data/recipes/.gen-state.json`).

## Notes for agents
- npm workspaces monorepo: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/core` (framework-free shared TS: no React / React Native / Next / Expo imports — ESLint enforces it). Design spec: `design/*.dc.html` (do not delete).
- Web code imports shared modules as `@anv/core/<path>` (e.g. `@anv/core/domain/plan`); `@/…` in web means `apps/web/src`. Inside `packages/core/src` imports are relative. Details: `docs/MONOREPO.md`.
- Scripts (root, run across workspaces): `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run mobile`.
- Push to `main` only when lint + typecheck + test + build pass (every push deploys to Vercel production). Vercel Root Directory must be `apps/web` once the monorepo is merged.