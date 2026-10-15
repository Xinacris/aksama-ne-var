# Round 3.2 — Cooking-mode timer fix + background timers + social import update

Pasted by the owner on 2026-10-15 ("PRISM KERNEL"). The owner's answers to the four open questions are at the end and override the spec where they differ.

## Purpose
Fix the cooking-mode timer UX on mobile, make timers survive backgrounding (ideally via the OS's native timer/alarm), and update recipe import to the cheapest reliable path.

## Rules
- Work on main. Keep web (Next.js) and mobile (Expo) behaviour consistent where it applies.
- Do NOT touch the Android APK/build pipeline this round.
- Use "component" terminology; every new UI string in TR + EN.
- Timer state must be timestamp-based (endsAt), never interval-decrement-based.

## Interface
### 1. Cooking-mode timer UI regression (observed on iPhone, Expo dev build)
Current behaviour when the user starts a step timer in cooking mode:
- A "Zamanlayıcılar" card appears below the step text. Each row has: timer label (the recipe name, e.g. "Çılbır (bizim usul)"), remaining time, "Duraklat", "+1 dk", "Kapat".
- The row is a flexible horizontal layout, so as the digits change width every second (0:13 → 0:11 → 0:07) the label column reflows and wraps onto 2–3 lines differently each tick. The whole card visibly jumps up and down while counting.
- Remaining time is shown twice: inline under the step ("0:07 kaldı") AND in the card.
- The previous design (before this card was added) was simpler and better.
- Console shows: "expo-notifications: Custom sound 'timer_alarm…'" warning (sound not found/registered).

Required:
- Revert to the previous, simpler design: a single inline timer under the step text with time + pause / +1 dk / close. No separate card when only the current step's timer runs.
- Show a compact "other running timers" strip ONLY when timers from other steps are active.
- Time text: fontVariant ['tabular-nums'] and a fixed min-width; labels numberOfLines={1} with ellipsis; action buttons fixed width. Nothing on screen may move while a timer counts down.
- Label timers by step ("Adım 2 · 0:20" / "Step 2 · 0:20"), not by recipe name.

### 2. Background + native timers
- Persist timers ({id, recipeId, stepIndex, label, endsAt, pausedRemainingMs}); on app foreground, recompute remaining time from endsAt.
- On start, schedule a local notification at endsAt via expo-notifications with the custom alarm sound. Fix the warning above: register the sound in the expo-notifications config plugin (`sounds`), create an Android notification channel with that sound + max importance, and document that custom sounds don't work in Expo Go (dev build required). iOS sound ≤30 s, .caf/.wav/.aiff.
- Pause / +1 dk / close must cancel and reschedule the notification.
- Android native timer: "Telefonun saatinde kur / Set on phone clock" action firing AlarmClock.ACTION_SET_TIMER (EXTRA_LENGTH, EXTRA_MESSAGE, EXTRA_SKIP_UI=true) via expo-intent-launcher; add permission com.android.alarm.permission.SET_ALARM.
- iOS native timer: iOS 26+ exposes AlarmKit for third-party countdown timers (lock screen / Dynamic Island, rings in silent mode). Look for a maintained Expo/RN AlarmKit package; if none, write a minimal local Expo module. Fall back to the local notification on iOS < 26 or if permission is denied. Add NSAlarmKitUsageDescription (TR+EN).
- Settings: "Zamanlayıcı türü: Uygulama bildirimi / Telefonun saati" (default: phone clock where supported).
- Web: in-tab timer + Notification API, endsAt-based.

### 3. Recipe import update
- TikTok: oEmbed (no key), `title` = caption → parser. Unchanged.
- Instagram: Meta made Instagram oEmbed callable WITHOUT an access token (2026). Call it for public posts/reels and try to extract the caption text from the returned `html` (embed blockquote). Caption found → parse; not found → fall back to the existing paste-caption flow. No scraping, no third-party scrapers.
- YouTube Shorts: Data API v3 if key present, else oEmbed title.
- Mobile: accept shared URLs from the OS share sheet (Instagram/TikTok/YouTube → "Akşama Ne Var?") and open the import screen prefilled.
- AI provider abstraction: AI_PROVIDER = anthropic | gemini | none.
  - anthropic (default, prod): claude-haiku-5-5, structured JSON output, prompt well under 100k tokens.
  - gemini (dev/testing only): free-tier Flash-Lite; README notes free-tier data is used by Google and limits are unpublished.
  - none: rule-based parser.
- All keys server-side only (API route / edge function), never in the mobile bundle.

## Structure
- Timer logic in a shared package (pure functions: start, pause, resume, extend, remaining(now)) used by web + mobile; platform adapters for notifications / native timers.
- Import providers behind one interface: fetchSource(url) → {platform, text, thumbnail?}; parseRecipe(text) → Recipe draft.

## Motion
1. Fix the timer UI regression; verify zero layout shift on a small Android screen and an iPhone.
2. Background timers + notification sound (dev build).
3. Native timer integrations (Android intent, iOS AlarmKit with fallback).
4. Import updates + share-sheet intake.
5. README: what needs a dev build, env vars, provider costs.

## KERNEL CHECK
- Key output: a timer that never shifts layout and rings even when the app is backgrounded or killed.
- Edge cases: two timers ending at once; app killed and reopened mid-timer; device time change; notification permission denied; private Instagram post or missing caption; oEmbed rate-limited.
- Reusable: shared timer core + provider interface.
- Nested logic avoided: early returns in providers, no nested ternaries in components.
- Error states: clear TR/EN messages for permission denied, import failed, "paste the caption instead".
- Least surprise: closing a timer also cancels its scheduled notification/native timer.

## Owner's answers (2026-10-15)

1. **Android phone clock: an opt-in button.** The app notification stays the default. Each running timer gets a "Telefonun saatinde kur" button that hands it to the Clock app. That timer's app notification is then cancelled, so it doesn't ring twice. A one-line note says that pause and +1 dk won't reach the Clock app. (Android has no API to pause or cancel a timer set in the Clock app.)
2. **iOS AlarmKit: a local Expo module in `apps/mobile/modules`** with `@available(iOS 26)` guards, falling back to the notification. **Gated behind a flag** (`EXPO_PUBLIC_ENABLE_ALARMKIT` / a config plugin toggle, default off). When it's off, the native module is not linked at all, so a Swift compile error can never break the iOS build. The README says how to turn it on for the first test build. (There's no Xcode on this machine, so the Swift is compiled only on the owner's build.)
3. **Instagram: use tokenless oEmbed as a check.** Tested live: it answers without a token, but its HTML has no caption, author or thumbnail. It tells a public post apart from a private or deleted one. Extract a caption only if the HTML ever contains one. In the fallback, offer **"Açıklamayı yapıştır"** and **"Ekran görüntüsünden oku / Read from screenshot"**. The screenshot path uses on-device text recognition (iOS Vision via expo-text-extractor, or ML Kit on Android: free, no server cost) and feeds the text to the same parser. Several screenshots are allowed for long captions. Web: paste only. Record the oEmbed finding in DECISIONS.md.
4. **AI provider: keep Gemini in prod for now.** The code supports `AI_PROVIDER = anthropic | gemini | none`. When it's unset, the chain stays as it is today (Gemini, then Claude if the keys exist). The owner switches it later by setting `AI_PROVIDER`.
