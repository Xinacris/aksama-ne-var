# PROGRESS — Akşama Ne Var?

Resume: continue from the first unchecked item. Spec: PROMPT.md. Decisions: DECISIONS.md.

## Phases
- [x] 1. Scaffold Next.js + TS + lint/format + Vitest + Playwright at the repo root; tokens, fonts, theme switch; first push to `main` (first Vercel deploy).
  - Theme toggle lives in `src/hooks/useTheme.ts`; UI for it lands in Settings (phase 13).
- [x] 2. Data layer: models, repo interfaces, LocalStorageAdapter, migrations, cross-tab sync bus + tests.
- [x] 3. 100-recipe seed + validation tests.
- [ ] 4. Domain logic (list, prep tasks, matching, rotation, leftovers) + unit tests.
- [ ] 5. Auth + households + invite/join + protected routes + tests.
- [ ] 6. Shared component library ported from `Componentler.dc.html` + component tests.
- [ ] 7. Onboarding 1 & 2.
- [ ] 8. Bugün.
- [ ] 9. Eşleş + match moment.
- [ ] 10. Hafta (desktop board + mobile list, drag-and-drop).
- [ ] 11. Liste (pazar/market, aisles, live sync, finish).
- [ ] 12. Tarif detayı + recipe browser + add/edit recipe.
- [ ] 13. Settings, activity feed, demo seed matching the design's sample data, export/reset.
- [ ] 14. E2E journeys + axe, both viewports.
- [ ] 15. Visual review passes with screenshots; fix drift.
- [ ] 16. Supabase draft schema + migration doc.
- [ ] 17. Final: all scripts green, `npm run build` passes, README, `DEMO.md`, final commit and push, deployment status checked.
