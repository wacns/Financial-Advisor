import { AppState, Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSecureStorage } from "./secure-storage.ts";
import publicClient from "../public-client.json";
import {
  startGoogleSignIn,
  startChatGPTSignIn,
  finishNativeAuth,
  NATIVE_AUTH_REDIRECT,
} from "../auth.ts";
import type { NativeAuthRuntime } from "../auth.ts";
import type { Messaging, NotificationLike, Preferences } from "../notifications.ts";
import type { Runtime, Satisfies } from "./contracts.ts";
import type * as Self from "./runtime.native.ts";
export const native = true;
export const platform: string = Platform.OS;
export const clientConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || publicClient.url,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicClient.key,
};
export const authOptions: Runtime["authOptions"] = {
  flowType: "pkce",
  detectSessionInUrl: false,
  persistSession: true,
  autoRefreshToken: false,
  storage: createSecureStorage(SecureStore, randomUUID),
};
const privatePreferences = createSecureStorage(SecureStore, randomUUID);
export const preferences: Preferences = {
  async get(key) {
    const current = await privatePreferences.getItem(key);
    if (current !== null) return current;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await privatePreferences.setItem(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  set: (key, value) => privatePreferences.setItem(key, value),
  async remove(key) {
    await privatePreferences.removeItem(key);
    await AsyncStorage.removeItem(key);
  },
};
let route = "login";
const listeners = new Set<() => void>();
export function currentRoute(): string {
  return route;
}
export function navigate(next: string): void {
  route = next;
  listeners.forEach((callback) => callback());
}
export function subscribeRoutes(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
export function subscribeActive(callback: (active: boolean) => void): () => void {
  callback(AppState.currentState === "active");
  const subscription = AppState.addEventListener("change", (state) =>
    callback(state === "active"),
  );
  return () => subscription.remove();
}
export function subscribeAuthLinks(callback: (url: string) => void): () => void {
  const accepted = (url: string | null) => {
    if (url?.startsWith("com.wacns.financialadvisor://auth/callback"))
      callback(url);
  };
  const sub = Linking.addEventListener("url", ({ url }) => accepted(url));
  Linking.getInitialURL()
    .then(accepted)
    .catch(() => {});
  return () => sub.remove();
}
export async function finishRedirect(client: SupabaseClient | null): Promise<boolean> {
  if (client) {
    const { data } = await client.auth.getSession();
    if (data.session) navigate("app/overview");
  }
  return false;
}
export async function googleSignIn(client: SupabaseClient | null): Promise<void> {
  return providerSignIn(client, startGoogleSignIn);
}
export async function chatgptSignIn(
  client: SupabaseClient | null,
  enabled: boolean,
  link = false,
): Promise<void> {
  return providerSignIn(client, (c, location, runtime) => startChatGPTSignIn(c, location, runtime, enabled, link));
}
type StartSignIn = (
  client: SupabaseClient | null,
  location: null,
  runtime: NativeAuthRuntime,
) => Promise<void>;
async function providerSignIn(client: SupabaseClient | null, start: StartSignIn): Promise<void> {
  await start(client, null, {
    open: async (url) => {
      if (new URL(url).protocol !== "https:")
        throw Error("Sign-in requires a secure connection.");
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        NATIVE_AUTH_REDIRECT,
      );
      if (result.type === "success") await finishNativeAuth(client, result.url);
      else throw Error("Sign-in was cancelled. You can try again.");
    },
  });
  navigate("app/overview");
}
export function emailRedirect(): string {
  return NATIVE_AUTH_REDIRECT;
}
type ListenerEvent = { token?: string; notification?: NotificationLike };
export async function getMessaging(): Promise<Messaging> {
  // Native Firebase is loaded only after explicit opt-in. Expo Go does not
  // contain this module; use an Expo development build or a release build.
  const [firebase, api, notifications] = await Promise.all([
    import("@react-native-firebase/app"),
    import("@react-native-firebase/messaging"),
    import("expo-notifications"),
  ]);
  const messaging = api.getMessaging(firebase.getApp());
  const permission = (status: number) => ({
    receive:
      status === api.AuthorizationStatus.AUTHORIZED ||
      status === api.AuthorizationStatus.PROVISIONAL
        ? "granted"
        : "denied",
  });
  return {
    async requestPermissions() {
      if (platform === "android") {
        const result = await notifications.requestPermissionsAsync();
        if (!result.granted) return { receive: "denied" };
      }
      const result = await api.requestPermission(messaging);
      if (platform === "ios")
        await api.registerDeviceForRemoteMessages(messaging);
      return permission(result);
    },
    async checkPermissions() {
      if (
        platform === "android" &&
        !(await notifications.getPermissionsAsync()).granted
      )
        return { receive: "denied" };
      return permission(await api.hasPermission(messaging));
    },
    async getToken() {
      return { token: await api.getToken(messaging) };
    },
    deleteToken: () => api.deleteToken(messaging),
    createChannel: (options) =>
      notifications.setNotificationChannelAsync(options.id, {
        name: options.name,
        importance: notifications.AndroidImportance.DEFAULT,
      }),
    addListener(event: string, callback: (event: ListenerEvent) => void) {
      let remove = () => {};
      if (event === "tokenReceived")
        remove = api.onTokenRefresh(messaging, (token) => callback({ token }));
      if (event === "notificationReceived")
        remove = api.onMessage(messaging, (notification) =>
          callback({ notification }),
        );
      if (event === "notificationActionPerformed") {
        remove = api.onNotificationOpenedApp(messaging, (notification) =>
          callback({ notification }),
        );
        api
          .getInitialNotification(messaging)
          .then((notification) => {
            if (notification) callback({ notification });
          })
          .catch(() => {});
      }
      return { remove };
    },
  };
}
export async function exportFile(content: string, type: string, name: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Sharing is unavailable on this device.");
  const file = new File(Paths.cache, name);
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: type,
    dialogTitle: "Export FinancialAdvisor data",
  });
}
export function confirmReset(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      "Reset demo?",
      "Restore the sample workspace and remove your demo changes.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Reset", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
// Compile-time check that this module matches the runtime contract.
export type RuntimeCheck = Satisfies<Runtime, typeof Self>;
