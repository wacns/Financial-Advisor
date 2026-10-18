const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
module.exports = function withFinancialAdvisor(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application["meta-data"] ??= [];
    for (const [name, value] of Object.entries({
      firebase_messaging_auto_init_enabled: "false",
      firebase_analytics_collection_enabled: "false",
      "com.google.firebase.messaging.default_notification_channel_id":
        "payment-reminders",
    })) {
      const existing = application["meta-data"].find(
        (row) => row.$["android:name"] === name,
      );
      if (existing) existing.$["android:value"] = value;
      else
        application["meta-data"].push({
          $: { "android:name": name, "android:value": value },
        });
    }
    return config;
  });
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const directory = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/drawable",
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "ic_stat_finance.xml"),
        '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M4,17L6,19L17,8L17,15L20,15L20,4L9,4L9,7L16,7Z"/></vector>',
      );
      return config;
    },
  ]);
  return config;
};
