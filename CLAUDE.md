Round 3 spec is in PROMPT-v3.md; work on branch round-3; continue from the first unchecked V-item in PROGRESS.md.

Round 2.2 spec is in PROMPT-v2.2.md; continue from the first unchecked M-item in PROGRESS.md.

Round 2.1 spec is in PROMPT-v2.1.md; continue from the first unchecked P-item in PROGRESS.md.

Round 2 spec is in PROMPT-v2.md; continue from the first unchecked R-item in PROGRESS.md.

Before any work, read PROGRESS.md and DECISIONS.md and continue from the first unchecked item. The full spec is in PROMPT.md.

## Notes for agents
- Next.js app lives at the repo root. Design spec: `design/*.dc.html` (do not delete).
- Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`.
- Push to `main` only when lint + typecheck + test + build pass (every push deploys to Vercel production).