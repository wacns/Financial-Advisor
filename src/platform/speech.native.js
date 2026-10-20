import { requireNativeModule } from "expo-modules-core";
import { PermissionsAndroid, Platform } from "react-native";
export function speechSupported() {
  try {
    return (
      typeof requireNativeModule("FinancialAdvisorNative").recognizeSpeech ===
      "function"
    );
  } catch {
    return false;
  }
}
export async function recognizeSpeech(language = "en-BH") {
  if (Platform.OS === "android") {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED)
      throw Error(
        "Microphone permission was not granted. Text entry remains available.",
      );
  }
  return await requireNativeModule("FinancialAdvisorNative").recognizeSpeech(
    language,
  );
}
export async function stopSpeech() {
  await requireNativeModule("FinancialAdvisorNative").stopSpeech();
}
