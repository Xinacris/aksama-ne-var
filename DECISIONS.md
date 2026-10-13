# DECISIONS

One line each: decision — reason.

- Read all `design/*.dc.html` before any UI work; design date "Pazartesi, 12 Ekim" coincides with the build date (2026-10-12), so demo seed is relative to "today" — keeps the demo looking like the design on any day.
- Next.js 16.4 (create-next-app) with `cacheComponents`/`partialPrefetching` turned off — app is fully client-side over localStorage; server only renders shells, so the cache-components constraints add risk without benefit.
- Styling: CSS Modules + global token CSS (`src/app/globals.css`) — design is hand-written CSS; modules port it 1:1 without a Tailwind translation layer.
- Theme: `data-theme` on `<html>` set by an inline boot script before paint (no flash); `prefers-color-scheme` CSS fallback when JS is off. The boot script and `src/data/preferences.ts` are the only places reading the theme key — the boot script must run before React.
- Node pinned to 24.x (current LTS on 2026-10-12; Node 26 is not LTS yet). Local dev machine runs 26, which only produces an engine warning.
- `@types/node@24` instead of the scaffold's `^20` — vitest 5 peer requires >=22.
- `typecheck` runs `next typegen` first so route-aware types (`LayoutProps`, `PageProps`) exist without a build.
- E2E server = `next build && next start` on port 3100 (production parity, the build is what Vercel runs).
- Storage layout: one JSON array per table under `anv:t:<table>`, schema version in `anv:meta`; rows are zod-validated on read, invalid rows dropped, unparseable tables quarantined to `anv:corrupt:<table>:<ts>` — the app keeps working with a calm notice instead of crashing.
- Built-in recipes live in code (`src/data/seed`), not in storage; only household custom recipes are stored — keeps storage small and lets the seed improve without migrations.
- Session: sessionStorage holds the per-tab user, localStorage remembers the last login so new tabs and restarts stay logged in; logout only clears the shared fallback if it points at the same user.
- Emails and invite codes compared with plain `toLowerCase()` (Turkish casing turns `I` into `ı`, which breaks ASCII emails); Turkish casing is used for user-facing search/sort.
- Sync: writes publish a coalesced `change` message per tick over BroadcastChannel; `storage` events are a fallback. Presence heartbeats use the same channel.
- Recipes reference a canonical ingredient catalog (`src/data/seed/ingredients.ts`) with base unit, kitchen-measure conversions and pack sizes; the `i()` builder throws on unknown names — this is what makes list aggregation reliable.
- Pantry staples (salt, oil, spices, kuru nane, bayat ekmek) are flagged `staple` and never auto-listed; recipe detail shows them as "Evde var" like the design.
- Design names kept verbatim; long names get a `shortName` for chips/tags ("Tereyağlı pirinç pilavı" → "Pirinç pilavı", "Ezogelin çorbası" → "Ezogelin").
- "Ertesi güne artar" tag is derived from `leftoverFriendly` and appended last (matches the design's card tag order) instead of being stored in `tags`.
- Menemen and other breakfast/one-plate dishes have course `kahvalti` but fill the "Ana yemek" slot and appear under "Ana yemekler" in onboarding, as in the design.
- Shopping list window = today + next 6 days (not the board's "2 back / 5 ahead"); past evenings never add to the list. Dishes sent back to matches by "dışarıda yedik"/"plan değişti" keep their ingredients on the list until placed again or a week passes ("malzemeler listede kalır").
- List quantities are shown as purchase amounts: summed in a base unit, then rounded up to packs (250 g kıyma, 1 kavanoz salça, 10 yumurta) or, for pazar produce sold by weight, to 500 g — reproduces the design's sample list ("Kıyma 500 g", "Domates 1,5 kg", "Arpa şehriye 1 paket").
- "Alışverişi bitir" stores the bought (pack-rounded) amount in the pantry; cooking a dish (rollover of past planned evenings) consumes measured pantry stock; unmeasured "evde var" entries persist until removed.
- Plan transitions are pure functions returning operation lists (`src/domain/plan.ts`); the store applies them through repos — keeps business rules testable and out of components.
- Prep tasks alternate household members in time order per day (first-joined member gets the first task) — reproduces the design (kıyma → Ali, köfte harcı → Zeynep). Night-before = 21:00 the previous day, morning = 09:00, offsets relative to the household dinner time (default 19:30).
- Solo household: a single "Olur" is a match (no partner to wait for); copy switches to singular.
- "Plan değişti → Yarına taşı" swaps with tomorrow's menu when tomorrow is planned, instead of cascading — reversible and never destroys a plan.
- Adding a dish counts as the adder's approval; any menu change resets approvals to the person who changed it.
- Households are capped at 2 members (the design's copy and colors are built around "ikiniz"); a third person gets a calm "Bu ev şu an dolu" state.
- Joining while already in another household is refused with a pointer to Ayarlar › Ev (leave first) — never silently moves data between households.
- Route protection is client-side (`Guard`): data lives in localStorage, so the server can't know the session. Anonymous → `/giris?next=…`; signed in without a household → `/onboarding/1`.
- Login page also offers "Örnek evle dene · Ali ve Zeynep" (same seeder as Ayarlar › Demo verisini yükle) so the morning demo is one click.
- Mobile keeps exactly the 4 designed tabs; Ayarlar is reached by tapping the household avatars (and from Bugün's header), Tarifler from Hafta and Ayarlar. Desktop top nav adds "Tarifler" and a settings icon.
- Presence: each tab broadcasts a heartbeat (4 s) with its route; a partner counts as "here" for 12 s — powers "Zeynep de burada / de markette" and the olive ring on avatars.
- Export JSON scrubs password hashes and salts.
- `vercel.json` pins `framework: nextjs` — the Vercel project was imported while the repo only had a README, so it defaulted to "Other" and every Next.js deploy failed until the preset was pinned in code (no Vercel login needed).
- Onboarding 1 shows the design's curated chips while the search is empty and searches the full recipe DB (all 4 groups) when typing; new users start with nothing selected (the design's preselection is sample state). Unknown names become household stub recipes ("“x” olarak ekle", also on Enter).
- An invited partner sees onboarding 1 prefilled with the household's favorites (shared, not per-person) and finishes with "Başlayalım" → Bugün (step 2 is skipped: the house is already full).
- Onboarding 2's WhatsApp button is a real `<a href="https://wa.me/?text=…" target="_blank">` styled like the design button — it navigates, so a link is the right element. "Kopyalandı" reverts to "Kopyala" after 3 s; clipboard failure selects the field and explains calmly.
- `screenshots/` is git-ignored (regenerate with `npm run screenshots`; `SHOTS=bugun,liste` limits the set).
- Bugün reminder = first of today's tasks (due order) that is pending or was completed in the last 2 h — so "Ali tamamladı · 09:12 / Geri al" stays visible after tapping "Çıkardım" (design interaction) and the banner then moves on to the next task. Freezer tasks use "Çıkardım", others "Yaptım".
- Night-before tasks (e.g. "Fasulyeyi ıslatmaya koy") surface on the previous day's Bugün as "Yarın akşama … var, …mayı unutma."
- "Plan değişti" opens an inline option group (Yarına taşı / Yarınla yer değiştir, Eşleşmelere geri gönder, Vazgeç) rather than a modal — keeps focus in place and needs no focus trap.
- "Bugün dışarıda yedik" acts immediately (no confirm, nothing to punish) with a calm notice; the day becomes a neutral "Bu akşam dışarıdasınız" card with "Geri al".
- Bugün desktop (≥1024): two columns (reminder/partner/tonight | leftover/plan değişti/yarın/"Evde son hareketler"); the page header hides avatars/sync there because the top nav shows them.
- The partner activity line links to the activity feed (/akis); match activity reads "Ali ve Zeynep karnıyarık için eşleşti" so it is correct from both perspectives.
- Screenshots pin the clock to 2026-10-12 08:45 (+03) — the design's morning, before the kıyma task is done; the demo marks it done by Ali at 09:12 only once that time has passed.
- Eşleş defaults to the next evening without a main dish (from today); the "<Gün> akşamı için ana yemek" eyebrow is a toggle that opens a day (7 days) + slot chooser — the design shows the context line but no picker, so the line itself becomes the control.
- Decks leave out dishes planned between 3 days ago and 7 days ahead (no karnıyarık twice in a week) and dishes already matched for that day/slot; 12 cards max, favorites first, least recently cooked first, then alphabetical (deterministic for both members).
- Swipe: drag threshold 100 px or a fast flick (>0.6 px/ms over 30 px); a small "Olur" / "Bu sefer değil" stamp fades in while dragging; reduced-motion skips the fly-out. ←/→ work anywhere on the page except inside form fields.
- When the partner completes a match in another tab while I'm on Eşleş for the same day/slot, the match moment appears live in my tab too.
- After "<Gün> akşamına koy" the deck moves on to the next open evening and a calm notice confirms ("… kondu. Eksikler listede.").
- Un and toz şeker are pantry staples (like salt) — a teaspoon of sugar shouldn't put "1 kg şeker" on the list.
- Hafta renders the dnd-kit board at ≥1024px and a stacked day list below (JS media query, so only one tree is in the DOM). Every drag has a non-drag path: empty slot "+" → recipe picker dialog; tap a tile → open / replace / remove; tap a match or frequent dish → day picker; day header → approve / leftovers toggle / dışarıda yedik / boşalt.
- Board keyboard DnD: Space picks up, arrows jump to the nearest slot in that direction, Space/Enter drops, Esc cancels; Enter on a tile (without dragging) opens its actions. Turkish screen-reader announcements.
- Dropping on a whole day picks the slot from the dish's course; dropping a planned tile on an occupied slot swaps the two; tatlı can't be dropped into a menu (calm notice).
- Dialogs use the native `<dialog>` (focus trap, Esc, backdrop); bottom sheet on phones.
- "Sık yaptıklarınız" = most-cooked first (cook log), then favorites, max 8.
- Liste: Market tab is the default (as designed); desktop shows Pazar and Market side by side. A partner's check is highlighted ("<Ad> aldı · az önce", sand background) for 2 minutes, then fades to the normal checked style. My checks show a check mark in my color; the partner's show their initial.
- The presence banner says "<Ad> de markette" only while the partner's tab is open on /liste; otherwise it says checks will appear live. Hidden for solo households.
- Manual items get a separate "kaldır" button next to the row (a nested button inside the row button would be invalid HTML).
- "Alışverişi bitir" with nothing checked does nothing destructive and explains calmly.
- Tarif detail URL is the dish (`/tarif/<id>`); `?gun=YYYY-MM-DD` (or `today`) adds the menu context: menu title, part chips, the day's whole prep timeline (tap a dot to complete/undo), and "Bu parçayı başka yemekle değiştir". Without context it is a plain recipe page with "Bir akşama koy".
- Ingredient status pills are actions: "Listede" → mark "evde var"; "Evde var" (user-marked) → unmark; "Eksik · ekle" → add to list for this dish. Staples collapse into one "Kimyon, karabiber, tuz · Evde var" row as in the design. The recipe's freezer item shows "Evde · buzlukta" / "Evde · çözülüyor" once the freezer task is done.
- "Pişirmeye başla" switches on a cooking mode where step numbers become checkable; no timers or tracking (nothing to grade the cook).
- Built-in recipes are read-only; "Kopyasını düzenle" opens a prefilled household copy ("… (bizim usul)"). Deleting a custom recipe that is planned leaves a calm "Silinmiş tarif" in the plan; the list and prep tasks skip it.
- Recipe form keeps every field as text and validates with zod on submit (Turkish decimal comma accepted); known ingredient names auto-fill pazar/market and aisle from the catalog.
- Demo seed ("Demo verisini yükle" / login button) is idempotent: if ali@demo.ev exists it just signs in as Ali. It recreates the design's week relative to today (Cmt dışarıda, Paz kuru fasulye + artan, Pzt İzmir köfte sofrası onaylı, Sal karnıyarık eşleşmeden, Çar menemen hafif akşam, Per Zeynep'in tavuk sotesi, Cum boş), the 14-item list with Zeynep's 3 checks, matches, cooking history and activity.
- Settings: leaving the household asks first and keeps the household's data; reset asks first. Dinner time is editable (prep reminders reschedule).
- `--sand-text` token: sand text on sand-soft (tags, "onayı bekleniyor", "Listede", "aldı · az önce") is mixed 18% toward ink in light mode to pass WCAG AA; dark mode keeps the design's sand. Checked list rows use ink2 text instead of `opacity: .6` (the opacity failed AA in dark mode). Everything else uses the design tokens unchanged.
- A new tab inherits the last login; the invite page offers "Farklı bir hesapla katıl" (logs out only this tab) so the two-tab demo works from one browser.
- Logout goes through `/giris?cikis=1`, so no guarded page can redirect back to itself with `?next=`.
- E2E: journey (both viewports, two pages in one context, clock pinned to Mon 12 Oct 10:00 Istanbul), board DnD with mouse + keyboard (desktop), axe on every main screen in light and dark (wcag2a/aa, 21a/aa) — all green.

## Round 2

Data-model plan (each change ships with a versioned migration in `src/data/migrations.ts` + a unit test, and is mirrored in `supabase/schema.sql`):

- v3 — Recipe gets `sourceUrl`, `sourceAuthor`, `sourcePlatform` (instagram/youtube/tiktok/web); old link-shaped `source` text moves to `sourceUrl` — credit needs the link and the creator separately; `source` stays a free-text note ("Annemin defteri").
- v3 — New `importLog` table (household, platform, path `llm`|`rules`, by, time) for "Bu ay N tarif içe aktarıldı" in Ayarlar; it stores no link or caption — usage counting needs neither, and captions are someone else's text.
- v4 — Recipe `leftoverFriendly: boolean` becomes `leftoverPolicy` (`none` | `lunch` | `store`) + `leftoverDays` (1–4, default 2); old custom recipes: true → `lunch`, false → `none` (exactly the old behaviour). Built-in defaults are a data table (`src/data/seed/leftovers.ts`), not code.
- v4 — Household gets `lunchAtHome` (`yes` | `no` | `some`) + `lunchDays` (weekday numbers, 0 = Pazar); default `yes` keeps today's "Öğlen · …" behaviour.
- v4 — PlanDay `leftovers: boolean` becomes `leftoverChoice` (null = follow defaults, or `none` | `lunch` | `fridge` | `discard` | `eaten`); old true → `lunch`, false → `none`, so stored weeks look exactly as before. The effective leftover is derived (pure rule in `src/domain/leftovers.ts`), never stored twice.
- v4 — PlanItem `source` gains `leftover`, plus optional `leftoverFrom` (the evening it was cooked): a dolapta dish dropped onto a day is a normal plan item, so menus/board/Bugün need no special casing; list, prep tasks, cook log and pantry use skip it.
- v5 — New `cookingSessions` table (household, key = menu date or recipe id, user, phase, per-dish step positions, checked ingredients, timers with absolute `endsAt`, started/finished) — syncs to the other tab through the normal change bus and survives reloads.
- Activity gains `leftover.set`, `cooking.started`, `cooking.finished`, `recipe.imported`; old rows stay valid (the enum only grows).
- Import step durations: when the LLM returns a duration the step text lacks, it is appended as "(20 dk)" instead of adding a parallel `stepMinutes` array — the cooking mode parses durations from text anyway, and the form stays one textarea per step.
