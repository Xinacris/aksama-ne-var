/// <reference types="node" />
/**
 * @jest-environment node
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../plugins/withTurkishOcr") as { turkishOcrEnabled: (env?: Record<string, string | undefined>) => boolean; syncModuleConfig: (on: boolean, dir?: string) => boolean };

describe("withTurkishOcr", () => {
  it("is on unless ANV_IOS_TR_OCR=0", () => {
    expect(plugin.turkishOcrEnabled({})).toBe(true);
    expect(plugin.turkishOcrEnabled({ ANV_IOS_TR_OCR: "1" })).toBe(true);
    expect(plugin.turkishOcrEnabled({ ANV_IOS_TR_OCR: "0" })).toBe(false);
  });

  it("links by writing the module's config, unlinks by deleting it; the repo never ships it", () => {
    const dir = mkdtempSync(join(tmpdir(), "anv-ocr-"));
    plugin.syncModuleConfig(true, dir);
    expect(JSON.parse(readFileSync(join(dir, "expo-module.config.json"), "utf8"))).toEqual({ platforms: ["apple"], apple: { modules: ["AnvTextRecognitionModule"] } });
    plugin.syncModuleConfig(false, dir);
    expect(existsSync(join(dir, "expo-module.config.json"))).toBe(false);
    expect(readFileSync(join(__dirname, "../.gitignore"), "utf8")).toContain("/modules/anv-text-recognition/expo-module.config.json");
  });
});
