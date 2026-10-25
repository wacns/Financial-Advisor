import fs from "node:fs";
import type { Configuration } from "electron-builder";
// Read relative to this file, as require() resolved it, and only when no URL is set.
// TS-ESCAPE: desktop/update-feed.json is this repository's own file and is read unchecked, as before.
const feedUrl = (): string =>
  JSON.parse(fs.readFileSync(new URL("./desktop/update-feed.json", import.meta.url), "utf8")).url;
const config: Configuration = {
  appId: "com.wacns.financialadvisor",
  productName: "FinancialAdvisor",
  icon: "desktop/assets/icon.png",
  directories: { app: "desktop", output: "release-desktop" },
  files: ["main.cjs", "preload.cjs", "policy.cjs", "runtime-config.json", "assets/**/*", "web/**/*", "package.json"],
  asar: true,
  artifactName: "FinancialAdvisor-${version}-${os}-${arch}.${ext}",
  protocols: [{ name: "FinancialAdvisor sign-in", schemes: ["com.wacns.financialadvisor"] }],
  publish: [{ provider: "generic", url: process.env.DESKTOP_UPDATE_URL || feedUrl() }],
  win: { target: [{ target: "nsis", arch: ["x64"] }] },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, perMachine: false, deleteAppDataOnUninstall: false },
  mac: { category: "public.app-category.finance", target: ["dmg", "zip"], hardenedRuntime: true },
  linux: { category: "Office", target: ["AppImage", "deb"], syncDesktopName: true, maintainer: "FinancialAdvisor <43343208+wacns@users.noreply.github.com>" },
};
export default config;
