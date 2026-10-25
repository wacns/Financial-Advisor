import fs from "node:fs";
import type { ExpoConfig } from "expo/config";
const androidFirebaseFile =
  process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
const iosFirebaseFile =
  process.env.GOOGLE_SERVICE_INFO_PLIST || "./GoogleService-Info.plist";
const androidFirebase = fs.existsSync(androidFirebaseFile);
const iosFirebase = fs.existsSync(iosFirebaseFile);
const easProjectId = process.env.EAS_PROJECT_ID || "f6d80f34-ee40-4075-9cca-4216d9c94d7d";
if (easProjectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(easProjectId)) {
  throw new Error("EAS_PROJECT_ID must be the UUID of the Expo project.");
}
const pushEnvironment =
  process.env.APP_PUSH_ENVIRONMENT ||
  (["production", "preview"].some((profile) => profile === process.env.EAS_BUILD_PROFILE)
    ? "production"
    : "development");
const config: { expo: ExpoConfig } = {
  expo: {
    name: "FinancialAdvisor",
    owner: "financial-advisor",
    icon: "./assets/app-icon.png",
    slug: "financial-advisor",
    version: "1.7.1",
    runtimeVersion: { policy: "fingerprint" },
    updates: easProjectId
      ? {
          url: `https://u.expo.dev/${easProjectId}`,
          checkAutomatically: "ON_LOAD",
          fallbackToCacheTimeout: 0,
          requestHeaders: { "expo-channel-name": process.env.APP_UPDATE_CHANNEL || "preview" },
        }
      : { enabled: false },
    ...(easProjectId ? { extra: { eas: { projectId: easProjectId } } } : {}),
    platforms: ["ios", "android"],
    scheme: "com.wacns.financialadvisor",
    orientation: "default",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.wacns.financialadvisor",
      buildNumber: "6",
      supportsTablet: true,
      ...(iosFirebase ? { googleServicesFile: iosFirebaseFile } : {}),
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        FirebaseMessagingAutoInitEnabled: false,
        NSMicrophoneUsageDescription: "Use your microphone to create a transaction draft for review.",
        NSSpeechRecognitionUsageDescription: "Turn speech into a transaction draft that you review before saving.",
      },
    },
    android: {
      package: "com.wacns.financialadvisor",
      versionCode: 6,
      ...(androidFirebase ? { googleServicesFile: androidFirebaseFile } : {}),
      permissions: ["POST_NOTIFICATIONS", "RECORD_AUDIO"],
      allowBackup: false,
    },
    plugins: [
      "expo-secure-store",
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "Unlock your FinancialAdvisor workspace with Face ID.",
        },
      ],
      [
        "expo-image-picker",
        {
          cameraPermission: "Allow FinancialAdvisor to scan receipts.",
          photosPermission: "Choose a receipt photo for FinancialAdvisor.",
        },
      ],
      "expo-web-browser",
      [
        "expo-notifications",
        {
          mode: pushEnvironment,
          enableBackgroundRemoteNotifications: true,
          defaultChannel: "payment-reminders",
        },
      ],
      "expo-system-ui",
      ["expo-build-properties", { ios: { useFrameworks: "static" } }],
      "./plugins/with-financial-advisor.ts",
      ...(androidFirebase || iosFirebase
        ? ["@react-native-firebase/app", "@react-native-firebase/messaging"]
        : []),
    ],
  },
};
export default config;
