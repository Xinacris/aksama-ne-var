# Mobile app (Expo)

`apps/mobile` — Expo SDK 57, React Native 0.86, Expo Router, TypeScript strict. Same models,
repositories, migrations, store and copy as the web (`packages/core`); data lives on the phone.

## Try it on your phone (Expo Go)

1. Install **Expo Go** from the App Store / Google Play (it must support SDK 57 — the current
   store version does; if it asks to update, update it).
2. On the computer, from the repo root:

   ```bash
   git checkout main && git pull
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
`https://aksama-ne-var.vercel.app`). When the server has no LLM key, `/api/translate` reports
itself unavailable and the phone hides "Çevir / Translate".
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
  (heads-up, steps per dish, timers with pause / +1 dk and an **alarm** — see below, ingredients
  sheet, screen stays on, finish with leftovers), **Ayarlar** (profile, household, dinner time, lunch days, language, theme, import
  usage, timer sound, demo data, reset).
- Turkish and English (phone language on first run, then Ayarlar › Dil / Language), light and dark
  (system, or Açık / Koyu in Ayarlar), VoiceOver/TalkBack labels, 44 pt targets, haptics on ticks,
  matches and finishing.

## What doesn't (yet)

- **Sync between devices.** Two phones (or a phone and a browser) don't see each other; Ayarlar says
  "Eşitleme yakında". Comes with the Supabase round (`docs/SUPABASE_MIGRATION.md`).
- **Push notifications** for prep reminders (reminders show inside the app).
- **Store builds** (EAS) and real icons/splash artwork.

## Timer alarm

- **App open (any screen):** when a timer reaches zero, a banner "Süre doldu: <timer>" / "Time's up:
  <timer>" with a big **Durdur / Stop** covers the top of the screen. The original tone
  (`assets/sounds/timer_alarm.wav`, made by `node scripts/make-alarm-tone.mjs` from the pattern in
  `packages/core/src/domain/alarmTone.ts`; the web plays the same beeps) loops with vibration until
  Stop, for at most 2 minutes. Two timers ending together share one banner and one sound. On iOS it
  rings even with the silent switch on.
- **In cooking mode** the running timer sits under its step (big time, Duraklat / +1 dk / Kapat).
  Timers of other steps or dishes show in a one-line strip ("Adım 2 … 4:12"); tap it to go back to
  that step. Nothing moves while the time counts down.
- **App in the background / phone locked:** a local notification with the same sound at the
  timer's end time, on the Android channel "Zamanlayıcılar / Timers" (id `timers-alarm`, max
  importance; it replaced the old high-importance `timers` channel, which is deleted, because
  Android never lets an app raise a channel's importance). "Timers (silent)" is used when
  Ayarlar › Zamanlayıcı sesi is off. Pause, +1 dk, restart, close, finish and Stop
  cancel or move it. Tapping it opens the cooking session and counts as Stop. There is no
  exact-alarm permission, so some phones (battery savers) deliver it a few seconds late.
- **Permission** is asked the first time a timer starts. If it's refused, the in-app alarm still
  works and a one-line hint appears once.
- A timer that ended more than 10 minutes before the app was opened is only shown as finished,
  without sound.
- **The custom sound needs a native build.** Expo Go plays notifications with the default sound,
  and a development build made before Round 3.1 doesn't have the file either. Then expo-notifications
  logs "Custom sound 'timer_alarm.wav' not found in native app" (iOS) or the same for the channel
  (Android). The file is registered in `app.json` (the `expo-notifications` plugin's `sounds`). Make a
  new development build (`eas build --profile development`, or `npx expo run:ios` on a Mac) or the APK
  (`npm run apk`). iOS limits notification sounds to 30 s (.wav/.caf/.aiff); ours is about 4 s.
- **Android: "Telefonun saatinde kur / Set on phone clock"** under a running timer hands it to the
  phone's Clock app (`AlarmClock.ACTION_SET_TIMER` via expo-intent-launcher, skipping the Clock UI;
  permission `com.android.alarm.permission.SET_ALARM`, a normal permission with no prompt). The app
  then drops its own notification and in-app ring for that finish, so it doesn't ring twice. Android
  has no way to pause, extend or cancel a timer in the Clock app, so the row says so. After +1 dk the
  app rings for the new end again, and the Clock app still rings at the old one. It's a per-timer
  choice, not a setting. No Clock app: an error line, and the app keeps the timer.
- **iOS 26+: "Telefonun saati" (AlarmKit)**, off by default. With it, each running timer is a system
  alarm that rings in silent mode and over the lock screen even if the app was killed, with
  `timer_alarm.wav`. Pause / +1 dk / close cancel or move it. Ayarlar › Zamanlayıcı türü (Telefonun
  saati / Uygulama bildirimi; shown only where it is available) switches back. Alarm permission is
  asked on the first timer. If it's refused, there's one hint and the notification takes over. With
  Zamanlayıcı sesi off it isn't used (AlarmKit can't ring silently). It's a local module
  (`modules/anv-alarmkit`), linked **only** in builds made with `EXPO_PUBLIC_ENABLE_ALARMKIT=1` (see
  README), so the default build never compiles its Swift. Not built or tested on a device yet. No
  countdown on the lock screen: that needs a widget extension (Live Activity), which is a later step.

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

## Build an APK locally (no Expo account)

A release APK you can copy to an Android phone and install, built on this machine (no EAS, no
login). `apps/mobile/android/` is generated by `expo prebuild` and git-ignored (Continuous Native
Generation) — never edit or commit it.

One-time setup (nothing system-wide; delete the two folders to uninstall):

```bash
# JDK 17 (Eclipse Temurin) → ~/.local/jdk-17   (or: sudo pacman -S jdk17-openjdk and set JAVA_HOME)
mkdir -p ~/.local/jdk-17
curl -L "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
  | tar -xz -C ~/.local/jdk-17 --strip-components=1

# Android SDK command-line tools → ~/Android/Sdk
# (zip name: the latest "Command line tools only" for Linux on developer.android.com/studio)
mkdir -p ~/Android/Sdk/cmdline-tools && cd /tmp
curl -LO https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip
unzip -q commandlinetools-linux-*_latest.zip && mv cmdline-tools ~/Android/Sdk/cmdline-tools/latest
export JAVA_HOME=~/.local/jdk-17 ANDROID_HOME=~/Android/Sdk
yes | ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses
~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager platform-tools
```

The Android platform, build-tools and NDK versions the project needs are downloaded by Gradle on
the first build (licenses must be accepted first).

Build (from the repo root):

```bash
npm run apk          # prebuild --clean → gradlew assembleRelease → ~/Downloads/aksama-ne-var-<version>-<sha>.apk
```

`JAVA_HOME` / `ANDROID_HOME` are used when set, else `~/.local/jdk-17` and `~/Android/Sdk`. The
APK contains **all four ABIs** (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`), so one file installs on
any phone, tablet or Chromebook with **Android 7.0 (API 24) or newer** (minSdk 24 is what Expo
SDK 57 / React Native 0.86 require). Extra arguments go to Gradle (`npm run apk -- --max-workers=1`).
The first build takes a while (Gradle, NDK, native modules); later ones reuse `~/.gradle`. At the end
the script runs `apksigner verify` and prints the signature schemes and the signer.

### Low-RAM machines (Gradle memory)

A four-ABI build compiles the native code four times. On a machine with 16 GB or less, put these
limits in **`~/.gradle/gradle.properties`** (per machine, survives `prebuild --clean`, never
committed; user-level properties override the generated project's):

```properties
org.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=512m
org.gradle.workers.max=2
org.gradle.parallel=false
org.gradle.daemon=false
kotlin.daemon.jvmargs=-Xmx1g
```

With 24 GB or more, `-Xmx3g` is fine (never more than half the RAM). If a build still dies
(`OutOfMemoryError`, `Gradle build daemon disappeared unexpectedly`, or the whole machine freezes),
first retry with `npm run apk -- --max-workers=1`. Don't narrow the ABIs: an APK without
`x86`/`x86_64` or `armeabi-v7a` fails with "App not installed" on those devices. Close Metro,
`next dev`, Playwright and emulators while Gradle runs.

### Signing: the release key (back it up!)

Release APKs are signed with one stable upload key so every new APK **installs over the previous
one** and keeps the app's data:

- keystore: `~/.config/aksama-ne-var/release.keystore` (RSA 4096, outside the repo)
- alias and passwords: `~/.gradle/gradle.properties` →
  `AKSAMA_UPLOAD_STORE_FILE`, `AKSAMA_UPLOAD_STORE_PASSWORD`, `AKSAMA_UPLOAD_KEY_ALIAS`,
  `AKSAMA_UPLOAD_KEY_PASSWORD`

**Back up both** (the keystore file and those four lines) somewhere safe outside this machine, for
example a password manager. If the key is lost, no new APK can update an installed one: every
user would have to uninstall (losing local data) and install again. Never regenerate it, and never
commit it.

`plugins/withReleaseSigning.js` (an Expo config plugin) adds a `release` signingConfig to the
generated `android/app/build.gradle`. Gradle reads the values from those properties at build time,
so no secret ever lands in the generated folder. **Fresh clone or another machine without the
keys:** the release is signed with the debug key, and prebuild, Gradle and `npm run apk` all print
a `WARNING`. Such an APK installs on a phone that never had the app, but it can't update one
signed with the release key. To build real releases on another machine, copy the keystore and the
four lines there.

### Installing and updating

Copy the file to the phone (cable, Drive, WhatsApp *as a document*), allow "install unknown apps"
for the app that opens it, open it. Or over USB: `~/Android/Sdk/platform-tools/adb install -r <file>.apk`.

- **Updates:** every new APK must have a higher `android.versionCode` in `app.json` (1.0.1 = 2;
  bump it together with `version`) and the same key. Then it installs over the old one and keeps
  the data.
- **1.0.0 was signed with the debug key.** A phone that has 1.0.0 must uninstall it once before
  installing 1.0.1. From 1.0.1 on, updates install over each other.
- Changing the package name later (below) installs a separate app without the old app's local data.

### When it says "App not installed"

The phone's installer hides the reason. Connect the phone with USB debugging on and run:

```bash
adb install -r aksama-ne-var-<version>-<sha>.apk           # prints INSTALL_FAILED_<REASON>
adb logcat -d | grep -iE "PackageManager|PackageInstaller"   # more detail
```

| code | meaning | fix |
|---|---|---|
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | an installed copy has a different signature | uninstall the old app once |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | installed versionCode is higher | bump `versionCode` |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | no native libs for the phone's CPU | build all four ABIs (default) |
| `INSTALL_FAILED_OLDER_SDK` | Android older than 7.0 | not supported |
| `INSTALL_PARSE_FAILED_*` / `INSTALL_FAILED_INVALID_APK` | damaged or truncated file | send it again; `unzip -tq file.apk` checks it |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` | phone is full | free ~300 MB |

Check a file without a phone: `apksigner verify --verbose --print-certs`, `aapt2 dump badging`
(`minSdkVersion`, `native-code`), `zipalign -c -P 16 4`, all under `~/Android/Sdk/build-tools/<ver>/`.

## Decision for the owner: bundle ID / package name

`app.json` uses the placeholder **`com.PLACEHOLDER.mealplanner`** for both
`ios.bundleIdentifier` and `android.package` (also `slug`/`scheme`: `mealplanner`). It must be
replaced before the first store build, and **it can't be changed after the first release**
(the store treats a new ID as a new app). Neutral, not Turkish-specific, e.g.
`com.<your-company>.mealplanner` or `app.<brand>.dinner`. Display names: "Akşama ne var?" (Turkish),
"What’s for dinner?" (English) via `app.json` `locales`.

## Share-sheet import and screenshots

- **Android:** share a reel or video from Instagram / TikTok / YouTube → "Akşama ne var?" (an
  `ACTION_SEND` `text/plain` intent filter from expo-sharing, via `plugins/withShareIntake.js`). The
  import screen opens with the link and starts on its own (`src/app/+native-intent.ts`,
  `src/share/incoming.ts`).
- **iOS:** the Share Extension is off by default. Build with `ANV_IOS_SHARE_EXTENSION=1` to add it:
  it is a second signed target with an App Group (`group.<bundle id>`), which a free Apple team
  can't sign; EAS registers it on the first build. Expo marks receiving shares experimental.
- **"Ekran görüntüsünden oku"** in the Instagram paste fallback: pick screenshots of the caption;
  the text is read on the phone (expo-text-extractor: Vision / ML Kit) and imported like a pasted
  caption (docs/IMPORT.md). The system photo picker needs no library permission; camera and
  microphone permissions are off (Android `CAMERA` blocked).
- All three need a native build (development build or APK); Expo Go has none of them.

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
