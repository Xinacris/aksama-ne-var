# Mobile app (Expo)

`apps/mobile` — Expo SDK 57, React Native 0.86, Expo Router, TypeScript strict. Same models,
repositories, migrations, store and copy as the web (`packages/core`); data lives on the phone.

## Try it on your phone (Expo Go)

1. Install **Expo Go** from the App Store / Google Play (it must support SDK 57 — the current
   store version does; if it asks to update, update it).
2. On the computer, from the repo root:

   ```bash
   git checkout round-3
   npm install
   npm run mobile          # = expo start in apps/mobile
   ```

3. Scan the QR code: iPhone → Camera app; Android → the scanner inside Expo Go.
   Phone and computer on the **same Wi-Fi**. If that doesn't work (office/guest Wi-Fi, VPN):

   ```bash
   npm run mobile -- --tunnel
   ```

   (Expo may offer to install `@expo/ngrok` once; no account is needed.)
4. In the app: **Örnek evle dene · Ali ve Zeynep** (sample household), or create a local account.

Import and translation call the web app's API (`EXPO_PUBLIC_API_URL`, default
`https://aksama-ne-var.vercel.app`). Until `round-3` is merged and deployed, production has
`/api/import` (works) but not `/api/translate` — the phone then simply hides "Çevir / Translate".
To use a local web server instead: `EXPO_PUBLIC_API_URL=http://<computer-ip>:3000 npm run mobile`
(with `npm run dev` running).

## What works

- Local accounts (sign up / sign in), the demo household, setting up a household or joining one
  **by invite code on the same phone**.
- Onboarding (dishes you make often → invite code), **Bugün** (reminder, tonight's menu, approve,
  leftovers, fridge, plan changes, tomorrow), **Tarifler** (search, course and tag filters,
  favourites, quick add: link → import, name → one-tap save), recipe page (statuses, prep
  timeline, steps, put on an evening, edit / copy / delete, Translate), the full recipe form with
  "Ayrıntılar" and Toplu yapıştır, **import** from a link or pasted text, **Liste** (aisles, ticks,
  "evde var", finish shopping, add/remove items), **Hafta** (evening cards, move a dish to another
  evening, swap, remove, day options), **Eşleş** (swipe deck, match moment), **Pişirme modu**
  (heads-up, steps per dish, timers that vibrate, ingredients sheet, screen stays on, finish with
  leftovers), **Ayarlar** (profile, household, dinner time, lunch days, language, theme, import
  usage, demo data, reset).
- Turkish and English (phone language on first run, then Ayarlar › Dil / Language), light and dark
  (system, or Açık / Koyu in Ayarlar), VoiceOver/TalkBack labels, 44 pt targets, haptics on ticks,
  matches and finishing.

## What doesn't (yet)

- **Sync between devices.** Two phones (or a phone and a browser) don't see each other; Ayarlar says
  "Eşitleme yakında". Comes with the Supabase round (`docs/SUPABASE_MIGRATION.md`).
- **Share sheet import** (sharing a reel from Instagram/TikTok straight into the app). Needs a
  development build — see the plan below.
- **Push notifications** for prep reminders (reminders show inside the app).
- **Store builds** (EAS) and real icons/splash artwork.
- Timer alarms only fire while the app is open (no background notifications).

## Checks (no device needed)

```bash
cd apps/mobile
npx tsc --noEmit
npx expo lint
npx jest                      # jest-expo + @testing-library/react-native
npx expo-doctor
npx expo export --platform ios --output-dir dist/ios
npx expo export --platform android --output-dir dist/android
```

`npm run lint|typecheck|test` at the root include the mobile workspace.

## Decision for the owner: bundle ID / package name

`app.json` uses the placeholder **`com.PLACEHOLDER.mealplanner`** for both
`ios.bundleIdentifier` and `android.package` (also `slug`/`scheme`: `mealplanner`). It must be
replaced before the first store build, and **it can't be changed after the first release**
(the store treats a new ID as a new app). Neutral, not Turkish-specific, e.g.
`com.<your-company>.mealplanner` or `app.<brand>.dinner`. Display names: "Akşama ne var?" (Turkish),
"What’s for dinner?" (English) via `app.json` `locales`.

## Share-sheet import — plan

1. Create a development build (`npx expo prebuild` / EAS development profile).
2. Add `expo-share-intent` (or a small config plugin): iOS Share Extension + Android
   `ACTION_SEND` intent filter for `text/plain` and URLs.
3. On receive, open `/tarifler/ice-aktar?url=…` (or `?text=…`) — the screen already starts the
   import by itself for both parameters (the web's Web Share Target uses the same route).
4. Test with Instagram, TikTok and YouTube shares on both platforms.

## Store-release checklist (later)

- [ ] Final bundle ID / package name (above); Apple Developer + Google Play accounts.
- [ ] `eas.json` with development / preview / production profiles; `eas build`, `eas submit`.
- [ ] App icon (1024² + Android adaptive layers), splash in both themes — the template's are placeholders.
- [ ] Version / build numbers; `runtimeVersion` + `expo-updates` if OTA updates are wanted.
- [ ] Privacy: App Store privacy labels / Play data safety — local data only today; import sends
      caption text (and translation sends recipe text) to the web API, which may pass it to
      Gemini/Claude; no tracking, no ads.
- [ ] Privacy policy URL and support URL.
- [ ] Screenshots in Turkish and English (6.7″, 6.1″ iPhone; phone sizes for Play).
- [ ] Real accounts and sync (Supabase) before a public release — local-only accounts are demo-grade.
- [ ] Push notifications for reminders (`expo-notifications`, needs a development build).
