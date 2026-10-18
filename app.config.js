import fs from "node:fs";
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
  (["production", "preview"].includes(process.env.EAS_BUILD_PROFILE)
    ? "production"
    : "development");
export default {
  expo: {
    name: "FinancialAdvisor",
    owner: "financial-advisor",
    icon: "./assets/app-icon.png",
    slug: "financial-advisor",
    version: "1.6.0",
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
      buildNumber: "4",
      supportsTablet: true,
      ...(iosFirebase ? { googleServicesFile: iosFirebaseFile } : {}),
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        FirebaseMessagingAutoInitEnabled: false,
      },
    },
    android: {
      package: "com.wacns.financialadvisor",
      versionCode: 4,
      ...(androidFirebase ? { googleServicesFile: androidFirebaseFile } : {}),
      permissions: ["POST_NOTIFICATIONS"],
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
      "./plugins/with-financial-advisor.cjs",
      ...(androidFirebase || iosFirebase
        ? ["@react-native-firebase/app", "@react-native-firebase/messaging"]
        : []),
    ],
  },
};
