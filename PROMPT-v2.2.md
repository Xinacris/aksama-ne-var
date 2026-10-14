# Akşama Ne Var? — Round 2.2: recipes on mobile + easy recipe adding

On phones (< 1024 px) there is no way to reach **Tarifler**: the bottom nav (`TABS` in `src/components/AppShell.tsx`) has only Bugün, Eşleş, Liste, Hafta, and the desktop top nav (`TOP`, which has Tarifler) is hidden. No mobile screen links to `/tarifler`; the only route is Ayarlar → Linkten ekle → Geri. Adding a recipe by hand is also slow: `/tarifler/yeni` is a long four-section form (Genel, Malzemeler, Ön hazırlık, Hazırlanışı) with five fields per ingredient. If screenshots are attached (iPhone 13, demo household), they show the bottom nav, the Tarifler page and the full new-recipe form; otherwise reproduce it yourself at 390 px with the demo household. 95 % of users will be on phones, and this round must not break the desktop layout.

## 0. First: check where the last session stopped

The previous session worked on import quality fixes (last commit on `main`: `73714d7`, "Import times: ignore placeholder prep…"). It may have been closed mid-task. Before anything in this round:

1. Run `git status`, `git stash list`, `git log --oneline -10` and `git log origin/main..HEAD --oneline`. Read `CLAUDE.md`, `PROGRESS.md` (especially the "Follow-ups after Round 2.1" section and any `## In progress` section) and the end of `DECISIONS.md`.
2. Check the latest production deploy: `gh api repos/{owner}/{repo}/commits/main/status`. If it failed, fix that first.
3. Decide what is unfinished: uncommitted or stashed changes, local commits not pushed, an `## In progress` section, unchecked items, or recent commits whose work is not recorded in `PROGRESS.md`.
4. If something is unfinished: run lint, typecheck, test and build; finish it (or revert it if it is broken and not worth saving — log why in `DECISIONS.md`); record it under "Follow-ups after Round 2.1" in `PROGRESS.md`; commit; push only when green.
5. Write a short **"Where I found it"** note at the top of the Round 2.2 section in `PROGRESS.md`: what state the repo was in, what you finished or reverted, deploy status. Then start M1.

## 0.1 Operating rules

1. Read `AppShell.tsx`, `src/app/(app)/tarifler/**`, `src/components/RecipeForm.tsx`, `src/services/recipeForm.ts` and `src/domain/import/parseText.ts` before starting M1.
2. Save this file as `PROMPT-v2.2.md` at the repo root. Append `## Round 2.2` to `PROGRESS.md` with the checklist in section 3 (M0…M5). Add one line to the top of `CLAUDE.md`: *"Round 2.2 spec is in PROMPT-v2.2.md; continue from the first unchecked M-item in PROGRESS.md."*
3. Never ask a question; log judgement calls in `DECISIONS.md` (decision + reason).
4. Push rule unchanged: push to `main` after each finished phase only when `npm run lint && npm run typecheck && npm test && npm run build` pass; run `npm run test:e2e` before the final push.
5. **Safe points:** after each phase, commit and tick its item in `PROGRESS.md`. If you have to stop mid-phase, commit what is done (no push unless green) and add a `## In progress` section at the end of `PROGRESS.md`: the task, what is done, what is left as a checklist, and anything you found. Remove that section when the phase is finished.

## 1. What to build

1. **Tarifler in the mobile bottom nav.** Add a fifth tab "Tarifler" (book-style icon in `icons.tsx`, same stroke style) between Liste and Hafta, active for `/tarifler/*` and `/tarif/*`. Grid becomes 5 columns; labels and the Liste badge must not overlap or wrap at 360 px. Keep 44 px+ touch targets and the safe-area padding.
2. **Quick add (the default way to add).** "Yeni tarif" on Tarifler opens a bottom sheet (use the existing `Dialog`) with one input: *"Link yapıştır ya da yemeğin adını yaz"*.
   - If the input is a URL → go to `/tarifler/ice-aktar?url=…` (existing import flow).
   - Otherwise → save a recipe with just the name (all other fields at their current defaults, leftovers "Artmaz") and open its detail page with a gentle "Ayrıntıları ekle" prompt. Saving takes one tap.
   - A small "Ayrıntılı tarif yaz" link in the sheet still opens the full form.
3. **Shorter full form.** On `/tarifler/yeni` and edit, only "Tarifin adı" and Öğün stay open; Genel's remaining fields, Ön hazırlık and Kaynak/Artarsa go into collapsible "Ayrıntılar" sections (native `<details>` or the existing pattern, closed by default on new recipes, open on edit when they have values). Malzemeler and Hazırlanışı stay visible.
4. **Paste many lines at once.**
   - Malzemeler gets a "Toplu yapıştır" toggle: a textarea, one ingredient per line, parsed with `parseIngredientLine` into rows the user can still edit. Unparsed lines become rows with the raw text as the name.
   - Hazırlanışı gets the same: one step per line (numbering like "1." / "1)" stripped), blank lines ignored.
   - Pasting a multi-line text into a single ingredient or step field offers "N satır ayrı ayrı eklensin mi?".
5. **Empty and search states.** When a search on Tarifler finds nothing, the existing "add with this name" action uses quick add (one tap saves).
6. **Tests:** unit tests for the URL-vs-name decision and both line parsers (Turkish examples: "2 su bardağı un", "1 tatlı kaşığı tuz", "Tuz, karabiber", numbered steps). Component test for the 5-tab nav at 360 px and 390 px. e2e (mobile project): from Bugün tap Tarifler → quick add by name → recipe exists; quick add with a URL lands on import; toplu yapıştır fills 5 ingredients. Existing e2e and axe checks stay green in light and dark. Update the screenshot spec to include the new nav and the quick-add sheet.

## 2. Out of scope

No clipboard reading (permission prompts; leave it for the native app). No monorepo or Expo work yet. No changes to import providers, leftovers, cooking mode or the desktop top nav (except that its Tarifler link keeps working). No monetization.

## 3. Phases (append to PROGRESS.md as M1…M5)

- M0. Checked where the last session stopped; unfinished work finished or reverted; "Where I found it" note written.
- M1. Tarifler tab in the bottom nav; active states; 360/390 px checks; component test.
- M2. Quick-add sheet (URL → import, name → one-tap save → detail with "Ayrıntıları ekle"); search empty state uses it; tests.
- M3. Collapsible "Ayrıntılar" in the full form (new + edit); existing form tests green.
- M4. Toplu yapıştır for ingredients and steps; multi-line paste offer; unit + component tests.
- M5. Final: e2e (mobile + desktop), axe light/dark, screenshots checked, all scripts green, push, check Vercel status (`gh api repos/{owner}/{repo}/commits/main/status`).

When done, the last line of `PROGRESS.md` must read: `ROUND 2.2 DONE — live: <Vercel URL>`.
