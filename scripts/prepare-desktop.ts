import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { loadEnv } from "vite";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
// Compile the Electron main, preload and policy sources to the CommonJS files Electron loads.
execFileSync(npm, ["run", "desktop:compile"], { stdio: "inherit", shell: process.platform === "win32" });
execFileSync(npm, ["run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
// TS-ESCAPE: desktop/update-feed.json is this repository's own file and is read unchecked, as before.
const updateUrl = process.env.DESKTOP_UPDATE_URL || JSON.parse(fs.readFileSync("desktop/update-feed.json", "utf8")).url;
const publicEnv = loadEnv("production", process.cwd(), "VITE_");
// TS-ESCAPE: src/public-client.json is this repository's own file and is read unchecked, as before.
const publicClient = JSON.parse(fs.readFileSync("src/public-client.json", "utf8"));
if (updateUrl && (new URL(updateUrl).protocol !== "https:" || new URL(updateUrl).username || new URL(updateUrl).password)) throw Error("DESKTOP_UPDATE_URL must be a public HTTPS URL without credentials.");
fs.rmSync("desktop/web", { recursive: true, force: true });
fs.cpSync("dist", "desktop/web", { recursive: true });
fs.writeFileSync("desktop/runtime-config.json", JSON.stringify({
  updateUrl,
  supabaseUrl: process.env.VITE_SUPABASE_URL || publicEnv.VITE_SUPABASE_URL || publicClient.url,
  macSigned: process.env.DESKTOP_MAC_SIGNED === "true",
}));
