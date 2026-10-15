// Config plugin: links the local module modules/anv-text-recognition (iOS Vision OCR with Turkish
// first) unless the build sets ANV_IOS_TR_OCR=0. Like withAlarmKit, linking is the module's
// expo-module.config.json, which isn't committed: written here when on, deleted when off. Off → the
// app uses expo-text-extractor's English-only iOS reader (Android uses ML Kit either way, which
// reads Turkish letters).
const fs = require("node:fs");
const path = require("node:path");

const MODULE_DIR = path.join(__dirname, "..", "modules", "anv-text-recognition");
const MODULE_CONFIG = { platforms: ["apple"], apple: { modules: ["AnvTextRecognitionModule"] } };

function turkishOcrEnabled(env = process.env) {
  return env.ANV_IOS_TR_OCR !== "0";
}

function syncModuleConfig(enabled, dir = MODULE_DIR) {
  const file = path.join(dir, "expo-module.config.json");
  if (enabled) {
    fs.writeFileSync(file, JSON.stringify(MODULE_CONFIG, null, 2) + "\n");
    return true;
  }
  fs.rmSync(file, { force: true });
  return false;
}

function withTurkishOcr(config) {
  syncModuleConfig(turkishOcrEnabled());
  return config;
}

module.exports = withTurkishOcr;
module.exports.turkishOcrEnabled = turkishOcrEnabled;
module.exports.syncModuleConfig = syncModuleConfig;
