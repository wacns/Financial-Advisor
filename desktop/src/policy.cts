import path = require("node:path");
const CALLBACK = "com.wacns.financialadvisor://auth/callback";
function authCallback(value: string): boolean {
  try {
    const url = new URL(value), expected = new URL(CALLBACK);
    return value.length <= 8192 && url.protocol === expected.protocol &&
      url.hostname === expected.hostname && url.pathname === expected.pathname &&
      !url.username && !url.password && !url.port &&
      (url.searchParams.has("code") || url.searchParams.has("error"));
  } catch { return false; }
}
function authTarget(value: string, supabaseUrl: string): boolean {
  try {
    const url = new URL(value), expected = new URL(supabaseUrl);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.origin === expected.origin && url.pathname === "/auth/v1/authorize") return true;
    // Explicit identity linking can return the provider authorization URL.
    // Confine it to OpenAI and this project's registered Supabase callback.
    return url.origin === "https://auth.openai.com" && url.pathname === "/api/accounts/authorize" &&
      url.searchParams.get("redirect_uri") === `${expected.origin}/auth/v1/callback` &&
      /^oaiapp_[a-z0-9_-]+$/i.test(url.searchParams.get("client_id") || "") &&
      !!url.searchParams.get("state") && !!url.searchParams.get("nonce") &&
      url.searchParams.get("code_challenge_method") === "S256" &&
      /^[a-z0-9_-]{43}$/i.test(url.searchParams.get("code_challenge") || "");
  } catch { return false; }
}
function assetPath(value: string, root: string): string {
  const url = new URL(value);
  if (url.protocol !== "financialadvisor:" || url.hostname !== "app") throw Error("Invalid app origin");
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const result = path.resolve(root, relative);
  if (result !== root && !result.startsWith(root + path.sep)) throw Error("Invalid asset path");
  return result;
}
// The same CommonJS exports object as before.
export = { authCallback, authTarget, assetPath, CALLBACK };
