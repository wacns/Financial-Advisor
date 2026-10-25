import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Linking from "expo-linking";
import { captureURL } from "../domain/capture.ts";
import { must } from "../guards.ts";
import type {
  CaptureRequest,
  FinancialAdvisorNative,
  Files,
  PickedFile,
  QuickEntry,
  Satisfies,
} from "./contracts.ts";
import type * as Self from "./files.native.ts";
const nativeModule = () =>
  requireNativeModule<FinancialAdvisorNative>("FinancialAdvisorNative");
export async function pickFile({
  image = false,
  camera = false,
}: { image?: boolean; camera?: boolean } = {}): Promise<PickedFile | null> {
  if (image) {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
      throw Error("Allow camera access to scan a receipt.");
    const response = await (
      camera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync
    )({ mediaTypes: ["images"], quality: 0.4, base64: true });
    if (response.canceled) return null;
    // A picker result that was not cancelled has at least one asset.
    const a = must(response.assets[0], "picked image");
    return {
      name: a.fileName || "receipt.jpg",
      mime: a.mimeType || "image/jpeg",
      data: `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`,
      uri: a.uri,
      size: a.fileSize || must(a.base64, "image data").length * 0.75,
    };
  }
  const response = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
  });
  if (response.canceled) return null;
  const a = must(response.assets[0], "picked document"),
    file = new File(a.uri);
  if (file.size > 16000000) throw Error("File must be smaller than 16 MB.");
  return {
    name: a.name,
    mime: a.mimeType || "application/octet-stream",
    data: `data:${a.mimeType || "application/octet-stream"};base64,${await file.base64()}`,
    uri: a.uri,
    text: /\.(json|csv|txt)$/i.test(a.name) ? await file.text() : "",
    size: file.size,
  };
}
export async function scanReceipt(camera = false): Promise<string | null> {
  const file = await pickFile({ image: true, camera });
  if (!file) return null;
  return await nativeModule().recognize(file.uri);
}
export async function downloadAttachment(data: string, name: string): Promise<void> {
  const file = new File(Paths.cache, name.replace(/[\\/]/g, "_"));
  file.write(
    // atob(undefined) decodes the text "undefined", as before, when data has no comma.
    Uint8Array.from(atob(String(data.split(",")[1])), (c) => c.charCodeAt(0)),
  );
  await Sharing.shareAsync(file.uri);
}
export async function syncWidgets(
  workspace: Parameters<Files["syncWidgets"]>[0],
  owner: string | null | undefined,
): Promise<void> {
  if (Platform.OS === "android")
    await nativeModule().updateWidgets(
      JSON.stringify({
        owner: owner && workspace?.settings?.widgetsEnabled ? owner || "" : "",
        templates:
          owner && workspace?.settings?.widgetsEnabled
            ? workspace?.templates
                ?.slice(0, 4)
                .map((t) => ({ id: t.id, name: t.name })) || []
            : [],
      }),
    );
}
export function subscribeQuickEntry(callback: (entry: QuickEntry) => void): () => void {
  const handle = (url: string | null) => {
    if (!url?.startsWith("com.wacns.financialadvisor://quick/")) return;
    const value = new URL(url);
    callback({
      kind: value.pathname.slice(1),
      templateId: value.searchParams.get("template"),
      owner: value.searchParams.get("owner"),
    });
  };
  const sub = Linking.addEventListener("url", ({ url }) => handle(url));
  Linking.getInitialURL()
    .then(handle)
    .catch(() => {});
  return () => sub.remove();
}
export function subscribeCapture(callback: (capture: CaptureRequest) => void): () => void {
  const handle = (url: string | null) => {
    // captureURL rejects a missing URL itself, so String() keeps that outcome.
    const capture = captureURL(String(url));
    if (capture) callback(capture);
  };
  const sub = Linking.addEventListener("url", ({ url }) => handle(url));
  Linking.getInitialURL()
    .then(handle)
    .catch(() => {});
  return () => sub.remove();
}

export async function requestWidget(): Promise<boolean> {
  return Platform.OS === "android"
    ? nativeModule().requestWidget()
    : false;
}
// Compile-time check that this module matches the files contract.
export type FilesCheck = Satisfies<Files, typeof Self>;
