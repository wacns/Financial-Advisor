import fs from "node:fs";
const androidFirebaseFile =
  process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
const iosFirebaseFile =
  process.env.GOOGLE_SERVICE_INFO_PLIST || "./GoogleService-Info.plist";
const androidFirebase = fs.existsSync(androidFirebaseFile);
const iosFirebase = fs.existsSync(iosFirebaseFile);
const pushEnvironment =
  process.env.APP_PUSH_ENVIRONMENT ||
  (["production", "preview"].includes(process.env.EAS_BUILD_PROFILE)
    ? "production"
    : "development");
export default {
  expo: {
    name: "FinancialAdvisor",
    slug: "financial-advisor",
    version: "1.5.0",
    platforms: ["ios", "android"],
    scheme: "com.wacns.financialadvisor",
    orientation: "default",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.wacns.financialadvisor",
      supportsTablet: true,
      ...(iosFirebase ? { googleServicesFile: iosFirebaseFile } : {}),
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        FirebaseMessagingAutoInitEnabled: false,
      },
    },
    android: {
      package: "com.wacns.financialadvisor",
      versionCode: 3,
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
