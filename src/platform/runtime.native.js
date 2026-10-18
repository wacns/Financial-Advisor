import { AppState, Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { createSecureStorage } from "./secure-storage.js";
import publicClient from "../public-client.json";
import {
  startGoogleSignIn,
  finishNativeAuth,
  NATIVE_AUTH_REDIRECT,
} from "../auth.js";
export const native = true;
export const platform = Platform.OS;
export const clientConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || publicClient.url,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicClient.key,
};
export const authOptions = {
  flowType: "pkce",
  detectSessionInUrl: false,
  persistSession: true,
  autoRefreshToken: false,
  storage: createSecureStorage(SecureStore, randomUUID),
};
const privatePreferences = createSecureStorage(SecureStore, randomUUID);
export const preferences = {
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
const listeners = new Set();
export function currentRoute() {
  return route;
}
export function navigate(next) {
  route = next;
  listeners.forEach((callback) => callback());
}
export function subscribeRoutes(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
export function subscribeActive(callback) {
  callback(AppState.currentState === "active");
  const subscription = AppState.addEventListener("change", (state) =>
    callback(state === "active"),
  );
  return () => subscription.remove();
}
export function subscribeAuthLinks(callback) {
  const accepted = (url) => {
    if (url?.startsWith("com.wacns.financialadvisor://auth/callback"))
      callback(url);
  };
  const sub = Linking.addEventListener("url", ({ url }) => accepted(url));
  Linking.getInitialURL()
    .then(accepted)
    .catch(() => {});
  return () => sub.remove();
}
export async function finishRedirect(client) {
  if (client) {
    const { data } = await client.auth.getSession();
    if (data.session) navigate("app/overview");
  }
  return false;
}
export async function googleSignIn(client) {
  await startGoogleSignIn(client, null, {
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
export function emailRedirect() {
  return NATIVE_AUTH_REDIRECT;
}
export async function getMessaging() {
  // Native Firebase is loaded only after explicit opt-in. Expo Go does not
  // contain this module; use an Expo development build or a release build.
  const [firebase, api, notifications] = await Promise.all([
    import("@react-native-firebase/app"),
    import("@react-native-firebase/messaging"),
    import("expo-notifications"),
  ]);
  const messaging = api.getMessaging(firebase.getApp());
  const permission = (status) => ({
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
    addListener(event, callback) {
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
export async function exportFile(content, type, name) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Sharing is unavailable on this device.");
  const file = new File(Paths.cache, name);
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: type,
    dialogTitle: "Export FinancialAdvisor data",
  });
}
export function confirmReset() {
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
