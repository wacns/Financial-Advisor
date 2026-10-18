const path = require("node:path");
const CALLBACK = "com.wacns.financialadvisor://auth/callback";
function authCallback(value) {
  try {
    const url = new URL(value), expected = new URL(CALLBACK);
    return value.length <= 8192 && url.protocol === expected.protocol &&
      url.hostname === expected.hostname && url.pathname === expected.pathname &&
      !url.username && !url.password && !url.port &&
      (url.searchParams.has("code") || url.searchParams.has("error"));
  } catch { return false; }
}
function authTarget(value, supabaseUrl) {
  try {
    const url = new URL(value), expected = new URL(supabaseUrl);
    return url.protocol === "https:" && url.origin === expected.origin &&
      url.pathname === "/auth/v1/authorize" && !url.username && !url.password;
  } catch { return false; }
}
function assetPath(value, root) {
  const url = new URL(value);
  if (url.protocol !== "financialadvisor:" || url.hostname !== "app") throw Error("Invalid app origin");
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const result = path.resolve(root, relative);
  if (result !== root && !result.startsWith(root + path.sep)) throw Error("Invalid asset path");
  return result;
}
module.exports = { authCallback, authTarget, assetPath, CALLBACK };
