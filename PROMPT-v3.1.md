# Round 3.1 (resume) — move everything to `main`, fix the APK that won't install, timer alarm

Repo: `aksama-ne-var` (npm workspaces: `apps/web` Next.js, `apps/mobile` Expo, `packages/core`). The owner will not answer questions: make reasonable choices that fit the product and log each judgement call in `DECISIONS.md` (decision + reason).

**A previous session ran this same spec and was killed mid-way because the machine ran out of RAM.** Nobody knows where it stopped. Start with R0, treat every step as possibly already done (verify, then skip or finish it), and keep memory use low (section "Memory rules").

## Purpose

1. From now on all development happens on `main`. Bring everything from `round-3` into `main` and close `round-3`.
2. The release APK sent to a friend (`aksama-ne-var-1.0.0-5d26bbe.apk`, 61 MB, sent over WhatsApp) fails on his Android phone with the system installer's **"App not installed"** ("Uygulama yüklenmedi"). Find the real cause and ship an APK that installs — and keeps installing over itself on future updates.
3. Cooking-mode timers must ring an alarm when they reach zero, on the phone and on the web.

## Rules

1. **`main` is the only working branch.** Every push to `main` deploys production (Vercel, Root Directory `apps/web`). Push only when every check that exists is green: `npm run lint && npm run typecheck && npm test && npm run build` at the root, plus the mobile checks. Never force-push. After each push check the production deploy with `gh api repos/{owner}/{repo}/commits/main/status`; if it fails, stop pushing, fix it on `main` first, and report it.
2. **Safe points, small and frequent:** commit after every meaningful sub-step (not only after a whole item) so another crash loses little. After each finished item: checks green → commit → tick it in `PROGRESS.md` → push `main`. Before any long or heavy command (Gradle build, full test run, Playwright), make sure the work so far is committed and `PROGRESS.md` says what you are about to do.
3. Keep a `## In progress` section at the end of `PROGRESS.md` up to date while working (task, done, left as a checklist, findings); remove it when the item is finished.
4. No accounts or logins (EAS, Expo, stores, Vercel CLI writes, Supabase). No paid services. No new environment variables required for the web app to work.
5. Keep the quality bar: TypeScript strict, tests for logic, axe checks on web, light + dark themes, every new string in Turkish **and** English.
6. Do not commit keystores, passwords or the generated `apps/mobile/android/` folder.

## Memory rules (the last run died of RAM)

1. Run `free -h` at the start and before each heavy step; note total RAM in `PROGRESS.md`.
2. **One heavy process at a time.** Never run a Gradle build, `next build`, Playwright, Metro/Expo dev server or the full test suite in parallel with each other. Stop leftovers first: `cd apps/mobile/android 2>/dev/null && ./gradlew --stop`; kill stray `expo start`/Metro, `next dev`, Playwright browsers and Kotlin daemons from the crashed session (`pgrep -af "gradle|kotlin|expo|metro|next|playwright"`).
3. **Gradle limits** go in `~/.gradle/gradle.properties` (machine-specific, survives `prebuild --clean`, never committed): `org.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=512m`, `org.gradle.workers.max=2`, `org.gradle.parallel=false`, `org.gradle.daemon=false`, `kotlin.daemon.jvmargs=-Xmx1g`. If total RAM is ≥ 24 GB you may raise `-Xmx` to 3g; never above half of total RAM. If a build still runs out of memory, use `--max-workers=1` before anything else. Do not narrow ABIs to save memory.
4. Run Playwright with `--workers=1` and Vitest/Jest with at most 2 workers on this machine (CLI flags, don't change the committed configs unless they already are machine-independent).
5. **No Android emulator** this round.
6. Prefer targeted checks while iterating (the touched package's tests, `tsc -p` of that package); run the full root check only before a push.

## Structure — work items

### R0. Find where the last session stopped

1. Clean up leftover processes (Memory rules 2). Run `git status`, `git stash list`, `git branch -a`, `git fetch --prune`, `git log --oneline -15 main`, `git log --oneline origin/main..main`, and — if `round-3` still exists locally or remotely — `git log --oneline main..origin/round-3`.
2. Read `CLAUDE.md`, `PROGRESS.md` (look for `## Round 3.1` and any `## In progress`), the end of `DECISIONS.md`, `docs/MOBILE.md`.
3. Make sure `PROMPT-v3.1.md` at the repo root is **this** file (overwrite an older copy) and that `PROGRESS.md` has `## Round 3.1` with the checklist R0…R4; add it if missing, keep existing ticks.
4. Check each item's real state, independent of the ticks:
   - R1: is `round-3` fully in `main`? Does the branch still exist locally / on GitHub? Does `CLAUDE.md` still mention `round-3`?
   - R2: does `~/.config/aksama-ne-var/release.keystore` exist? Are the `AKSAMA_UPLOAD_*` keys in `~/.gradle/gradle.properties`? Is there a signing config plugin in `apps/mobile/plugins/`? Version 1.0.1 / versionCode 2? Any newer APK in `~/Downloads`? Any diagnosis notes in `DECISIONS.md`?
   - R3: any alarm code, sound asset, notification code, settings toggle, tests?
5. **Uncommitted changes** are most likely the crashed session's work. Don't throw them away: read the diff, keep what is sound and finish it; if part of it is broken or half-written, fix it. Only if it is unrelated to this spec, `git stash push -m "pre-round-3.1-resume"` and mention it in the report. Unpushed commits on `main`: verify them with the checks before pushing.
6. Write a short **"Where I found it (resume)"** note under `## Round 3.1` (what was done, what was half-done, what was untouched) and continue from the first item that is not really finished.

### R1. Consolidate on `main` and close `round-3`

1. If `round-3` has commits that `main` lacks: merge it into `main` (fast-forward if possible, otherwise `git merge --no-ff round-3`; resolve conflicts keeping both sides' intent, log non-trivial resolutions). Do not squash — keep history.
2. Checks green → push `main` → confirm the production deploy succeeds and the live site opens (`curl -sSf` the production URL).
3. Only after `git log main..origin/round-3` is empty: delete the branch locally and on GitHub (`git branch -d round-3`, `git push origin --delete round-3`). Never use `-D`. If it is already gone, just confirm.
4. In `CLAUDE.md`, replace the "work on branch round-3" line with: *"All work happens on `main`. Every push to `main` deploys production — push only with all checks green. Current spec: PROMPT-v3.1.md; continue from the first unchecked item in PROGRESS.md."* Fix any other doc that still points to `round-3`.

### R2. APK that installs

**Diagnose before changing anything** (skip if a diagnosis is already in `DECISIONS.md` and still matches). Use the existing APK if it is still in `~/Downloads`; otherwise rebuild commit `5d26bbe` with `npm run apk` in a temporary worktree (memory rules apply).

1. `apksigner verify --verbose --print-certs` — which signature schemes (v1/v2/v3) and which certificate.
2. `aapt2 dump badging` — package, versionCode/versionName, `sdkVersion` (minSdk), `targetSdkVersion`, `native-code` (ABIs).
3. `zipalign -c -v -P 16 4` and `unzip -tq` — alignment and integrity.
4. If `adb devices` shows a phone, `adb install -r` it and capture the exact `INSTALL_FAILED_*` code plus `adb logcat -d | grep -iE "PackageManager|PackageInstaller"`.
5. Write the findings to `DECISIONS.md` and name the most likely cause. Usual suspects for "App not installed" on a phone that never had the app: missing ABIs (e.g. only `x86_64` or only `arm64-v8a` because `reactNativeArchitectures` was narrowed to save build memory), minSdk above the phone's Android version, an unsigned/badly signed or unaligned APK. On a phone that had an earlier build: a different signing certificate for the same package.

**Fix** (each part: skip if already done and verified):

1. Fix what the evidence points to.
2. Always, regardless of the cause:
   - **All four ABIs** (`armeabi-v7a, arm64-v8a, x86, x86_64`) in the release APK, so one file works on any phone. Handle memory with the Gradle limits above, not by narrowing ABIs.
   - **Stable signing key.** Debug keystores differ per machine and can be regenerated by `prebuild --clean`, so the next APK would refuse to install over this one. If it doesn't exist yet, create one release keystore outside the repo at `~/.config/aksama-ne-var/release.keystore` (`keytool`, RSA 4096, long validity, random passwords) and put the passwords and alias in `~/.gradle/gradle.properties` as `AKSAMA_UPLOAD_STORE_FILE`, `AKSAMA_UPLOAD_STORE_PASSWORD`, `AKSAMA_UPLOAD_KEY_ALIAS`, `AKSAMA_UPLOAD_KEY_PASSWORD`. **If the keystore already exists, never overwrite or regenerate it.** Add a small config plugin in `apps/mobile/plugins/` that injects a `release` signingConfig reading those properties at prebuild time, and falls back to debug signing with a clear warning when they are missing. Never print the passwords.
   - **Version bump:** `version` 1.0.1 and Android `versionCode` 2 (later APKs must always have a higher versionCode).
3. Rebuild with `npm run apk` and verify again with steps 1–3 (and 4 if a phone is connected): v2+ signature with the new certificate, all four ABIs, aligned, minSdk ≤ 24 unless the Expo SDK requires more (state which Android versions are supported).
4. Update `docs/MOBILE.md`: keystore location, back it up, how updates install over each other, how to read install errors with `adb`, and the Gradle memory settings for low-RAM machines.

### R3. Timer alarm

Timers already exist in cooking mode (multiple, persistent, household-synced). Add an alarm when one reaches zero. Build on whatever the crashed session already wrote.

1. **Core (`packages/core`):** expose "finished" as a pure function of stored `endsAt` timestamps (not tick counting), so a timer that ended while the app was closed or the tab hidden is detected on return. Each timer finishes exactly once; pause, resume, reset, edit and delete behave correctly. Unit tests with fake time.
2. **Sound:** create an original alarm tone (a short synthesized beep pattern generated by a small script, committed with the asset). No third-party sound files.
3. **Mobile (`apps/mobile`):**
   - In the foreground: loop the alarm sound (expo-audio) with a vibration pattern and show a clear banner "Süre doldu: <timer name>" / "Time's up: <timer name>" with a large **Durdur / Stop** button. Keep ringing until stopped, auto-stop after 2 minutes. Ring even in silent mode on iOS — it's a kitchen timer (log this).
   - In the background or with the screen locked: schedule a local notification with sound for `endsAt` (expo-notifications, Android channel "Zamanlayıcılar / Timers", high importance). Cancel or reschedule it on pause, reset, edit, delete and when the alarm already rang in the foreground. Tapping it opens the cooking session.
   - Ask for notification permission the first time a timer starts, not on app launch. If denied, the in-app alarm still works; show a one-line hint once.
   - Do not request exact-alarm permissions; note in `DECISIONS.md` that some phones may deliver a few seconds late.
4. **Web (`apps/web`):** Web Audio beep pattern looping until Stop (same 2-minute cap). Unlock the `AudioContext` on the tap that starts the timer. When the tab is hidden: a browser notification if permission was granted (asked on the first timer start), plus a blinking `document.title`. `navigator.vibrate` where available.
5. **Household:** decide how the alarm behaves when the same session's timers are open on more than one device (default suggestion: ring on every device showing that session; Stop on one acknowledges it everywhere sync reaches). Log the decision.
6. **Settings:** "Zamanlayıcı sesi / Timer sound" toggle, default on, persisted.
7. **Tests:** core fire-once logic; web Playwright test that the banner appears and Stop clears it (audio mocked); mobile tests for schedule/cancel with mocked expo-notifications. axe on the banner, light + dark.

### R4. Final APK

Stop every other heavy process, then rebuild the APK from the final `main` (it must include R3), verify as in R2, copy to `~/Downloads/aksama-ne-var-<version>-<short sha>.apk`.

## KERNEL CHECK (before you report)

- **Key output:** `main` has everything, `round-3` is gone, production deploy green, a verified APK in `~/Downloads`, alarms ring on phone and web.
- **Edge cases:** timer ending while app closed/tab hidden; two timers ending at once (one banner listing both, one sound); notification permission denied; timer deleted while ringing; installing the new APK over the old one; resuming after a crash with half-written files.
- **Reusable:** `npm run apk` still works on a fresh clone (with the fallback warning when no keystore exists) and on a low-RAM machine with the documented Gradle settings.
- **Nested logic avoided:** alarm state derived from `endsAt` in core, not duplicated per platform.
- **Error states:** missing keystore, failed deploy, failed `adb install`, out-of-memory build — each reported, none silent.
- **Least surprise:** no sound on app launch for timers that finished long ago (more than 10 minutes) — show them as finished instead.

## At the end, tell me (in Turkish, short)

- Where the last session had stopped and what you had to redo or fix from it.
- `round-3` merged and deleted? Production deploy status.
- Why the APK failed (the evidence) and what fixed it.
- APK path, size, version, supported Android versions; how to install it (and that it installs over 1.0.1+ from now on, but a phone that had 1.0.0 must uninstall it once).
- Where the keystore is and that I must back it up — losing it means users must uninstall to update.
- How the alarm behaves on phone and web, and anything I need to try by hand.
- What you changed in `~/.gradle/gradle.properties` for memory, and the peak memory you saw during the APK build if you could measure it.
