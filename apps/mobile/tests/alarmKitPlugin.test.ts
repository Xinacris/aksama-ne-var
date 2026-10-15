/// <reference types="node" />
/**
 * @jest-environment node
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../plugins/withAlarmKit") as {
  alarmKitEnabled: (env?: Record<string, string | undefined>) => boolean;
  syncModuleConfig: (enabled: boolean, dir?: string) => boolean;
};

describe("withAlarmKit", () => {
  it("is off unless EXPO_PUBLIC_ENABLE_ALARMKIT is exactly 1", () => {
    expect(plugin.alarmKitEnabled({})).toBe(false);
    expect(plugin.alarmKitEnabled({ EXPO_PUBLIC_ENABLE_ALARMKIT: "true" })).toBe(false);
    expect(plugin.alarmKitEnabled({ EXPO_PUBLIC_ENABLE_ALARMKIT: "1" })).toBe(true);
  });

  it("links the module only by writing its expo-module.config.json, and removes it when off", () => {
    const dir = mkdtempSync(join(tmpdir(), "anv-alarmkit-"));
    const file = join(dir, "expo-module.config.json");
    expect(plugin.syncModuleConfig(true, dir)).toBe(true);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ platforms: ["apple"], apple: { modules: ["AnvAlarmKitModule"] } });
    expect(plugin.syncModuleConfig(false, dir)).toBe(false);
    expect(existsSync(file)).toBe(false);
    // off twice is fine
    expect(plugin.syncModuleConfig(false, dir)).toBe(false);
  });

  it("the repo never ships the file (the default build has no AlarmKit code)", () => {
    expect(existsSync(join(__dirname, "../modules/anv-alarmkit/expo-module.config.json"))).toBe(false);
    expect(readFileSync(join(__dirname, "../.gitignore"), "utf8")).toContain("/modules/anv-alarmkit/expo-module.config.json");
  });
});
