All work happens on `main`. Every push to `main` deploys production — push only with all checks green. Before any work, read PROGRESS.md and continue from its last section (currently "Handoff after Round 3.1"); also read DECISIONS.md. Latest spec: PROMPT-v3.1.md (done).

Round 3 spec is in PROMPT-v3.md (done).

Round 2.2 spec is in PROMPT-v2.2.md; continue from the first unchecked M-item in PROGRESS.md.

Round 2.1 spec is in PROMPT-v2.1.md; continue from the first unchecked P-item in PROGRESS.md.

Round 2 spec is in PROMPT-v2.md; continue from the first unchecked R-item in PROGRESS.md.

Before any work, read PROGRESS.md and DECISIONS.md and continue from the first unchecked item. The full spec is in PROMPT.md.

## Notes for agents
- npm workspaces monorepo: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/core` (framework-free shared TS: no React / React Native / Next / Expo imports — ESLint enforces it). Design spec: `design/*.dc.html` (do not delete).
- Web code imports shared modules as `@anv/core/<path>` (e.g. `@anv/core/domain/plan`); `@/…` in web means `apps/web/src`. Inside `packages/core/src` imports are relative. Details: `docs/MONOREPO.md`.
- Scripts (root, run across workspaces): `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run mobile`.
- Push to `main` only when lint + typecheck + test + build pass (every push deploys to Vercel production). Vercel Root Directory must be `apps/web` once the monorepo is merged.