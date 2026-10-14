// Config plugin: release builds are signed with the owner's stable upload key, so every new APK
// installs over the previous one. The key never enters the repo or the generated android/ folder:
// Gradle reads AKSAMA_UPLOAD_* from ~/.gradle/gradle.properties when it builds. Without them the
// release falls back to the debug key with a loud warning (fine for a fresh clone; such an APK
// can't update one signed with the real key).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { withAppBuildGradle } = require("expo/config-plugins");

const KEYS = ["AKSAMA_UPLOAD_STORE_FILE", "AKSAMA_UPLOAD_STORE_PASSWORD", "AKSAMA_UPLOAD_KEY_ALIAS", "AKSAMA_UPLOAD_KEY_PASSWORD"];
const MARK = "// @aksama release signing";

const RELEASE_CONFIG = `        release { ${MARK}
            if (aksamaUploadKey) {
                storeFile file(findProperty('AKSAMA_UPLOAD_STORE_FILE'))
                storePassword findProperty('AKSAMA_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('AKSAMA_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('AKSAMA_UPLOAD_KEY_PASSWORD')
                enableV1Signing true
                enableV2Signing true
                enableV3Signing true
            }
        }
`;

const GUARD = `${MARK}
def aksamaUploadKey = ${KEYS.map((k) => `findProperty('${k}')`).join(" && ")}
if (!aksamaUploadKey) {
    logger.warn("WARNING: AKSAMA_UPLOAD_* not found in ~/.gradle/gradle.properties — the release APK is signed with the DEBUG key and cannot update an APK signed with the release key. See docs/MOBILE.md.")
}

android {`;

/** Rewrites the template's app/build.gradle: a `release` signing config and the release build type using it. */
function applyReleaseSigning(gradle) {
  if (gradle.includes(MARK)) return gradle;
  const signing = /(signingConfigs \{\n)/;
  const releaseType = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!signing.test(gradle) || !releaseType.test(gradle) || !/^android \{/m.test(gradle)) {
    throw new Error("withReleaseSigning: app/build.gradle no longer matches the template (signingConfigs / release buildType)");
  }
  return gradle
    .replace(/^android \{/m, GUARD)
    .replace(signing, `$1${RELEASE_CONFIG}`)
    .replace(releaseType, "$1signingConfig aksamaUploadKey ? signingConfigs.release : signingConfigs.debug");
}

/** True when the user-level gradle.properties has every AKSAMA_UPLOAD_* key (values are never read out). */
function hasUploadKey(gradleUserHome = process.env.GRADLE_USER_HOME || path.join(os.homedir(), ".gradle")) {
  let text = "";
  try {
    text = fs.readFileSync(path.join(gradleUserHome, "gradle.properties"), "utf8");
  } catch {
    return false;
  }
  return KEYS.every((k) => new RegExp(`^\\s*${k}\\s*=\\s*\\S`, "m").test(text));
}

const withReleaseSigning = (config) => {
  if (!hasUploadKey()) {
    console.warn("\n⚠️  withReleaseSigning: no AKSAMA_UPLOAD_* keys in ~/.gradle/gradle.properties — release builds fall back to the DEBUG key (docs/MOBILE.md → Signing).\n");
  }
  return withAppBuildGradle(config, (c) => {
    c.modResults.contents = applyReleaseSigning(c.modResults.contents);
    return c;
  });
};

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
module.exports.hasUploadKey = hasUploadKey;
