/// <reference types="node" />
/**
 * @jest-environment node
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyReleaseSigning, hasUploadKey } = require("../plugins/withReleaseSigning") as {
  applyReleaseSigning: (s: string) => string;
  hasUploadKey: (home?: string) => boolean;
};

const template = readFileSync(join(__dirname, "fixtures/app.build.gradle"), "utf8");

describe("withReleaseSigning", () => {
  it("adds a release signing config read from Gradle properties and uses it for release builds", () => {
    const out = applyReleaseSigning(template);
    expect(out).toMatch(/def aksamaUploadKey = findProperty\('AKSAMA_UPLOAD_STORE_FILE'\) && .*findProperty\('AKSAMA_UPLOAD_KEY_PASSWORD'\)/);
    expect(out).toMatch(/signingConfigs \{\n        release \{[\s\S]*storeFile file\(findProperty\('AKSAMA_UPLOAD_STORE_FILE'\)\)[\s\S]*enableV1Signing true/);
    const release = out.slice(out.indexOf("buildTypes {"));
    expect(release).toMatch(/release \{[\s\S]*signingConfig aksamaUploadKey \? signingConfigs\.release : signingConfigs\.debug/);
    // debug builds keep the debug key
    expect(release).toMatch(/debug \{\n\s*signingConfig signingConfigs\.debug/);
    expect(out).toContain("WARNING: AKSAMA_UPLOAD_*");
  });

  it("never writes secrets into the generated file and is idempotent", () => {
    const once = applyReleaseSigning(template);
    expect(applyReleaseSigning(once)).toBe(once);
    // the only literal password is the template's public debug one
    expect(once.match(/storePassword ['"][^'"]*['"]/g)).toEqual(["storePassword 'android'"]);
  });

  it("fails loudly when the template changes shape", () => {
    expect(() => applyReleaseSigning("android {\n}\n")).toThrow(/no longer matches the template/);
  });

  it("detects the keys in a user gradle.properties without reading values out", () => {
    const home = mkdtempSync(join(tmpdir(), "gradle-"));
    expect(hasUploadKey(home)).toBe(false);
    writeFileSync(join(home, "gradle.properties"), "AKSAMA_UPLOAD_STORE_FILE=/k\nAKSAMA_UPLOAD_STORE_PASSWORD=x\nAKSAMA_UPLOAD_KEY_ALIAS=a\n");
    expect(hasUploadKey(home)).toBe(false);
    writeFileSync(join(home, "gradle.properties"), "AKSAMA_UPLOAD_STORE_FILE=/k\nAKSAMA_UPLOAD_STORE_PASSWORD=x\nAKSAMA_UPLOAD_KEY_ALIAS=a\nAKSAMA_UPLOAD_KEY_PASSWORD=y\n");
    expect(hasUploadKey(home)).toBe(true);
  });
});
