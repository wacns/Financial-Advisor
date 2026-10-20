import { requireNativeModule } from "expo-modules-core";
import { PermissionsAndroid, Platform } from "react-native";
import type { FinancialAdvisorNative, Satisfies, Speech } from "./contracts.ts";
import type * as Self from "./speech.native.ts";
const nativeModule = () =>
  requireNativeModule<FinancialAdvisorNative>("FinancialAdvisorNative");
export function speechSupported(): boolean {
  try {
    return typeof nativeModule().recognizeSpeech === "function";
  } catch {
    return false;
  }
}
export async function recognizeSpeech(language = "en-BH"): Promise<string> {
  if (Platform.OS === "android") {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED)
      throw Error(
        "Microphone permission was not granted. Text entry remains available.",
      );
  }
  return await nativeModule().recognizeSpeech(language);
}
export async function stopSpeech(): Promise<void> {
  await nativeModule().stopSpeech();
}
// Compile-time check that this module matches the speech contract.
export type SpeechCheck = Satisfies<Speech, typeof Self>;
