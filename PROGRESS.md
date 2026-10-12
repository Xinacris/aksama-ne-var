# PROGRESS — Akşama Ne Var?

Resume: continue from the first unchecked item. Spec: PROMPT.md. Decisions: DECISIONS.md.

Deploy: https://aksama-ne-var.vercel.app (Vercel production alias; verified 200 after commit 8b92179). Check status with `gh api repos/Xinacris/aksama-ne-var/commits/main/status`.

## Phases
- [x] 1. Scaffold Next.js + TS + lint/format + Vitest + Playwright at the repo root; tokens, fonts, theme switch; first push to `main` (first Vercel deploy).
  - Theme toggle lives in `src/hooks/useTheme.ts`; UI for it lands in Settings (phase 13).
- [x] 2. Data layer: models, repo interfaces, LocalStorageAdapter, migrations, cross-tab sync bus + tests.
- [x] 3. 100-recipe seed + validation tests.
- [x] 4. Domain logic (list, prep tasks, matching, rotation, leftovers) + unit tests.
- [x] 5. Auth + households + invite/join + protected routes + tests.
- [x] 6. Shared component library ported from `Componentler.dc.html` + component tests.
  - `src/components/ui/*` (Button, Field, Avatar, Chip, Misc: SyncIndicator/ActivityLine/EmptyState/PhotoPlaceholder/Notice), `MenuCard`, `ReminderBanner`, `AppShell` (bottom + top nav).
- [x] 7. Onboarding 1 & 2.
- [x] 8. Bugün.
- [x] 9. Eşleş + match moment.
- [x] 10. Hafta (desktop board + mobile list, drag-and-drop).
- [x] 11. Liste (pazar/market, aisles, live sync, finish).
- [x] 12. Tarif detayı + recipe browser + add/edit recipe.
- [x] 13. Settings, activity feed, demo seed matching the design's sample data, export/reset.
- [x] 14. E2E journeys + axe, both viewports.
- [x] 15. Visual review passes with screenshots; fix drift.
  - Two passes over Bugün, Eşleş (+ match moment), Liste, Tarif, Hafta, Onboarding at 390/1440 × light/dark. Fixes: reminder banner keeps the done state, Yarın line capped at 3 dishes, menu time = longest + 5 min, plan-change button padding, form overflow at 390, AA contrast for sand text.
- [x] 16. Supabase draft schema + migration doc.
- [ ] 17. Final: all scripts green, `npm run build` passes, README, `DEMO.md`, final commit and push, deployment status checked.
