// Config plugin: "share to Akşama ne var?" from Instagram / TikTok / YouTube (expo-sharing).
// Android: an ACTION_SEND intent filter for text (links arrive as text/plain), always on.
// iOS: a Share Extension target and an App Group, only with ANV_IOS_SHARE_EXTENSION=1 — it adds a
// second signed target and the App Groups capability, which a free Apple team can't sign and
// which needs the extension's bundle id registered (EAS does it on the first build).
const { withPlugins } = require("expo/config-plugins");

function iosShareEnabled(env = process.env) {
  return env.ANV_IOS_SHARE_EXTENSION === "1";
}

function shareOptions(env = process.env) {
  return {
    android: { enabled: true, singleShareMimeTypes: ["text/plain"], multipleShareMimeTypes: [] },
    ios: { enabled: iosShareEnabled(env), activationRule: { supportsText: true, supportsWebUrlWithMaxCount: 1 } },
  };
}

function withShareIntake(config) {
  return withPlugins(config, [["expo-sharing", shareOptions()]]);
}

module.exports = withShareIntake;
module.exports.shareOptions = shareOptions;
