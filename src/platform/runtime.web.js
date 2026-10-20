import { finishAuthRedirect, startGoogleSignIn, startChatGPTSignIn, NATIVE_AUTH_REDIRECT } from "../auth.js";
const desktop = globalThis.financialAdvisorDesktop;
import publicClient from "../public-client.json";
export const native = false;
export const platform = desktop ? "desktop" : "web";
export const clientConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || publicClient.url,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicClient.key,
};
export const authOptions = { flowType: "pkce", detectSessionInUrl: false };
export const preferences = {
  async get(key) {
    return localStorage.getItem(key);
  },
  async set(key, value) {
    localStorage.setItem(key, value);
  },
  async remove(key) {
    localStorage.removeItem(key);
  },
};
export function currentRoute() {
  return location.hash.replace(/^#\/?/, "") || "login";
}
export function navigate(route) {
  location.hash = `/${route}`;
}
export function subscribeRoutes(callback) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
export function subscribeActive() {
  return () => {};
}
export function subscribeAuthLinks(callback) {
  if (desktop) {
    const stop = desktop.onAuthLink(callback);
    desktop.consumeAuthLink().then((url) => { if (url) callback(url); }).catch(() => {});
    return stop;
  }
  return () => {};
}
export function finishRedirect(client) {
  return finishAuthRedirect(client, location, history);
}
export function googleSignIn(client) {
  return startGoogleSignIn(client, location, desktop ? { open: desktop.openAuth } : undefined);
}
export function chatgptSignIn(client, enabled, link = false) {
  return startChatGPTSignIn(client, location, desktop ? { open: desktop.openAuth } : undefined, enabled, link);
}
export function emailRedirect() {
  if (desktop) return NATIVE_AUTH_REDIRECT;
  return new URL(location.pathname, location.origin).href;
}
export async function getMessaging() {
  throw Error("Open the installed mobile app to enable notifications.");
}
export async function exportFile(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function confirmReset() {
  return window.confirm(
    "Reset all demo changes and restore the sample workspace?",
  );
}
