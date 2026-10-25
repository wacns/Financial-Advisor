import { finishAuthRedirect, startGoogleSignIn, startChatGPTSignIn, NATIVE_AUTH_REDIRECT } from "../auth.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Messaging, Preferences } from "../notifications.ts";
import type { Runtime, Satisfies } from "./contracts.ts";
import type * as Self from "./runtime.web.ts";
const desktop = globalThis.financialAdvisorDesktop;
import publicClient from "../public-client.json";
export const native = false;
export const platform = desktop ? "desktop" : "web";
export const clientConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || publicClient.url,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicClient.key,
};
export const authOptions: Runtime["authOptions"] = { flowType: "pkce", detectSessionInUrl: false };
export const preferences: Preferences = {
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
export function currentRoute(): string {
  return location.hash.replace(/^#\/?/, "") || "login";
}
export function navigate(route: string): void {
  location.hash = `/${route}`;
}
export function subscribeRoutes(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
// The page is always active on the web; the callback is never called.
export function subscribeActive(_callback: (active: boolean) => void): () => void {
  return () => {};
}
export function subscribeAuthLinks(callback: (url: string) => void): () => void {
  if (desktop) {
    const stop = desktop.onAuthLink(callback);
    desktop.consumeAuthLink().then((url) => { if (url) callback(url); }).catch(() => {});
    return stop;
  }
  return () => {};
}
export function finishRedirect(client: SupabaseClient | null): Promise<boolean> {
  return finishAuthRedirect(client, location, history);
}
export function googleSignIn(client: SupabaseClient | null): Promise<void> {
  return startGoogleSignIn(client, location, desktop ? { open: desktop.openAuth } : undefined);
}
export function chatgptSignIn(
  client: SupabaseClient | null,
  enabled: boolean,
  link = false,
): Promise<void> {
  return startChatGPTSignIn(client, location, desktop ? { open: desktop.openAuth } : undefined, enabled, link);
}
export function emailRedirect(): string {
  if (desktop) return NATIVE_AUTH_REDIRECT;
  return new URL(location.pathname, location.origin).href;
}
export async function getMessaging(): Promise<Messaging> {
  throw Error("Open the installed mobile app to enable notifications.");
}
export async function exportFile(content: string, type: string, name: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function confirmReset(): Promise<boolean> {
  return window.confirm(
    "Reset all demo changes and restore the sample workspace?",
  );
}
// Compile-time check that this module matches the runtime contract.
export type RuntimeCheck = Satisfies<Runtime, typeof Self>;
