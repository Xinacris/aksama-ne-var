Before any work, read PROGRESS.md and DECISIONS.md and continue from the first unchecked item. The full spec is in PROMPT.md.

## Notes for agents
- Next.js app lives at the repo root. Design spec: `design/*.dc.html` (do not delete).
- Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`.
- Push to `main` only when lint + typecheck + test + build pass (every push deploys to Vercel production).
