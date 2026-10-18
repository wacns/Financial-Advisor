import { finishAuthRedirect, startGoogleSignIn } from "../auth.js";
export const native = false;
export const platform = "web";
export const clientConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
export function subscribeAuthLinks() {
  return () => {};
}
export function finishRedirect(client) {
  return finishAuthRedirect(client, location, history);
}
export function googleSignIn(client) {
  return startGoogleSignIn(client, location);
}
export function emailRedirect() {
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
