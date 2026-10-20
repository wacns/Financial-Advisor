import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Linking from "expo-linking";
import { captureURL } from "../domain/capture.js";
export async function pickFile({ image = false, camera = false } = {}) {
  if (image) {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
      throw Error("Allow camera access to scan a receipt.");
    const response = await (
      camera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync
    )({ mediaTypes: ["images"], quality: 0.4, base64: true });
    if (response.canceled) return null;
    const a = response.assets[0];
    return {
      name: a.fileName || "receipt.jpg",
      mime: a.mimeType || "image/jpeg",
      data: `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`,
      uri: a.uri,
      size: a.fileSize || a.base64.length * 0.75,
    };
  }
  const response = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
  });
  if (response.canceled) return null;
  const a = response.assets[0],
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
export async function scanReceipt(camera = false) {
  const file = await pickFile({ image: true, camera });
  if (!file) return null;
  return await requireNativeModule("FinancialAdvisorNative").recognize(
    file.uri,
  );
}
export async function downloadAttachment(data, name) {
  const file = new File(Paths.cache, name.replace(/[\\/]/g, "_"));
  file.write(Uint8Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0)));
  await Sharing.shareAsync(file.uri);
}
export async function syncWidgets(workspace, owner) {
  if (Platform.OS === "android")
    await requireNativeModule("FinancialAdvisorNative").updateWidgets(
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
export function subscribeQuickEntry(callback) {
  const handle = (url) => {
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
export function subscribeCapture(callback) {
  const handle = (url) => {
    const capture = captureURL(url);
    if (capture) callback(capture);
  };
  const sub = Linking.addEventListener("url", ({ url }) => handle(url));
  Linking.getInitialURL()
    .then(handle)
    .catch(() => {});
  return () => sub.remove();
}

export async function requestWidget() {
  return Platform.OS === "android"
    ? requireNativeModule("FinancialAdvisorNative").requestWidget()
    : false;
}
