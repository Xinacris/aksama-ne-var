// Builds a release APK locally (no Expo account): expo prebuild → gradlew assembleRelease → ~/Downloads.
// Uses JAVA_HOME / ANDROID_HOME when set, else ~/.local/jdk-17 and ~/Android/Sdk (see docs/MOBILE.md).
// Extra arguments go to Gradle, e.g. `npm run apk -- -PreactNativeArchitectures=arm64-v8a`.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const env = { ...process.env, CI: "1" };
env.JAVA_HOME ||= join(home, ".local/jdk-17");
env.ANDROID_HOME ||= join(home, "Android/Sdk");
env.PATH = `${join(env.JAVA_HOME, "bin")}:${env.PATH}`;
for (const [name, dir] of [["JAVA_HOME", env.JAVA_HOME], ["ANDROID_HOME", env.ANDROID_HOME]]) {
  if (!existsSync(dir)) throw new Error(`${name} not found at ${dir} — see "Build an APK locally" in docs/MOBILE.md`);
}

const run = (cmd, args, cwd = app) => execFileSync(cmd, args, { cwd, env, stdio: "inherit" });

// Prebuild rewrites the "android"/"ios" scripts to `expo run:*`; keep package.json as committed (Expo Go flow).
const pkgPath = join(app, "package.json");
const pkg = readFileSync(pkgPath, "utf8");
try {
  run("npx", ["expo", "prebuild", "-p", "android", "--clean"]);
} finally {
  writeFileSync(pkgPath, pkg);
}

const gradleArgs = process.argv.slice(2);
run("./gradlew", ["assembleRelease", "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a", "-Porg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g", ...gradleArgs], join(app, "android"));

const version = JSON.parse(readFileSync(join(app, "app.json"), "utf8")).expo.version;
const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: app, encoding: "utf8" }).trim();
const out = join(home, "Downloads", `aksama-ne-var-${version}-${sha}.apk`);
mkdirSync(dirname(out), { recursive: true });
copyFileSync(join(app, "android/app/build/outputs/apk/release/app-release.apk"), out);
console.log(`\nAPK: ${out} (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
