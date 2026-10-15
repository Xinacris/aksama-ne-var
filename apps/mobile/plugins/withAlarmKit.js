// Config plugin: links the local AlarmKit module (modules/anv-alarmkit) only when the build is
// made with EXPO_PUBLIC_ENABLE_ALARMKIT=1. Expo autolinking links a local module only if its
// folder has an expo-module.config.json, so that file is not committed: this plugin writes it
// when the flag is on and deletes it when it is off. With the flag off, the Swift is never
// compiled, so a mistake in it can't break the iOS build. The JS side
// (src/alarm/alarmKit.ts) finds no native module and keeps using the app's notification.
// Turning it on: see README ("iOS: telefonun saati / AlarmKit").
const fs = require("node:fs");
const path = require("node:path");
const { withInfoPlist } = require("expo/config-plugins");

const MODULE_DIR = path.join(__dirname, "..", "modules", "anv-alarmkit");
const MODULE_CONFIG = { platforms: ["apple"], apple: { modules: ["AnvAlarmKitModule"] } };
const USAGE = "So your cooking timers ring like the phone’s own alarm when time is up, also in silent mode and on the lock screen.";

function alarmKitEnabled(env = process.env) {
  return env.EXPO_PUBLIC_ENABLE_ALARMKIT === "1";
}

/** Write or remove the module's expo-module.config.json; returns whether the module is linked. */
function syncModuleConfig(enabled, dir = MODULE_DIR) {
  const file = path.join(dir, "expo-module.config.json");
  if (enabled) {
    fs.writeFileSync(file, JSON.stringify(MODULE_CONFIG, null, 2) + "\n");
    return true;
  }
  fs.rmSync(file, { force: true });
  return false;
}

function withAlarmKit(config) {
  const enabled = syncModuleConfig(alarmKitEnabled());
  if (!enabled) return config;
  return withInfoPlist(config, (c) => {
    // English base string; the Turkish one comes from locales/tr.json (InfoPlist.strings).
    c.modResults.NSAlarmKitUsageDescription = c.modResults.NSAlarmKitUsageDescription || USAGE;
    return c;
  });
}

module.exports = withAlarmKit;
module.exports.alarmKitEnabled = alarmKitEnabled;
module.exports.syncModuleConfig = syncModuleConfig;
