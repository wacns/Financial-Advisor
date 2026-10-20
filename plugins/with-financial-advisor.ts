import {
  withAndroidManifest,
  withDangerousMod,
  withPodfile,
  withAppBuildGradle,
  withXcodeProject,
  IOSConfig,
} from "expo/config-plugins";
import type { AndroidConfig, ConfigPlugin } from "expo/config-plugins";
/** Android manifest meta-data, plus the tools:replace attribute this plugin sets. */
type MetaData = {
  $: AndroidConfig.Manifest.ManifestMetaData["$"] & { "tools:replace"?: string };
};
import { mergeContents } from "@expo/config-plugins/build/utils/generateCode.js";
import fs from "node:fs";
import path from "node:path";
// Expo loads this file itself and uses its default export.
const withFinancialAdvisor: ConfigPlugin = (config) => {
  config = withDangerousMod(config, ["ios", async config => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const directory = path.join(config.modRequest.platformProjectRoot, projectName);
    fs.mkdirSync(directory, {recursive:true});
    fs.copyFileSync(path.join(config.modRequest.projectRoot, "native/ios/FinancialAdvisorIntents.swift"), path.join(directory, "FinancialAdvisorIntents.swift"));
    return config;
  }]);
  config = withXcodeProject(config, config => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({filepath:`${projectName}/FinancialAdvisorIntents.swift`,groupName:projectName,project:config.modResults});
    // node-xcode's pbxFile includes an unset explicitFileType; omit it so
    // Xcode uses the sourcecode.swift type instead of a literal "undefined".
    for (const file of Object.values(config.modResults.pbxFileReferenceSection()))
      // pbxproj entries are loosely typed objects; Reflect reads and deletes exactly as before.
      if (typeof file === "object" && file !== null && String(Reflect.get(file, "path")).replaceAll('"','').endsWith("/FinancialAdvisorIntents.swift")) Reflect.deleteProperty(file, "explicitFileType");
    return config;
  });
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = mergeContents({
      src: config.modResults.contents,
      newSrc: `
// Signing values are read only by Gradle; no credentials are written into source.
if (System.getenv('ANDROID_RELEASE_KEYSTORE')) {
    android.signingConfigs.create('financialAdvisorRelease') {
        storeFile file(System.getenv('ANDROID_RELEASE_KEYSTORE'))
        storePassword System.getenv('ANDROID_RELEASE_STORE_PASSWORD')
        keyAlias System.getenv('ANDROID_RELEASE_KEY_ALIAS')
        keyPassword System.getenv('ANDROID_RELEASE_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.financialAdvisorRelease
}
`,
      tag: 'financial-advisor-release-signing',
      anchor: /^dependencies \{/m,
      offset: 0,
      comment: '//',
    }).contents;
    return config;
  });
  config = withPodfile(config, (config) => {
    config.modResults.contents = mergeContents({
      src: config.modResults.contents,
      newSrc: '$RNFirebaseDisableSPM = true\n$RNFirebaseAsStaticFramework = true',
      tag: 'financial-advisor-firebase-cocoapods',
      anchor: /prepare_react_native_project!/,
      offset: 1,
      comment: '#',
    }).contents;
    return config;
  });
  config = withAndroidManifest(config, (config) => {
    config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw Error("Missing Android application element.");
    // The same array as application["meta-data"], typed to allow tools:replace.
    const metaData: MetaData[] = (application["meta-data"] ??= []);
    for (const [name, value] of Object.entries({
      firebase_messaging_auto_init_enabled: "false",
      firebase_analytics_collection_enabled: "false",
      "com.google.firebase.messaging.default_notification_channel_id":
        "payment-reminders",
    })) {
      const existing = metaData.find(
        (row) => row.$["android:name"] === name,
      );
      if (existing) {
        existing.$["android:value"] = value;
        existing.$["tools:replace"] = [...new Set([
          ...(existing.$["tools:replace"] || "").split(",").filter(Boolean),
          "android:value",
        ])].join(",");
      }
      else
        metaData.push({
          $: { "android:name": name, "android:value": value, "tools:replace": "android:value" },
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
export default withFinancialAdvisor;
