import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { prepareMobileAssets } from "./mobile-assets.mjs";
import { releaseNotes } from "./release-notes.mjs";
if (!process.env.GH_TOKEN) throw Error("RELEASES_TOKEN must be configured for public mobile publishing");
const { repository } = JSON.parse(fs.readFileSync(new URL("../desktop/update-feed.json", import.meta.url), "utf8"));
if (repository !== "wacns/financial-advisor-releases") throw Error("Unexpected downloads repository");
const version = process.env.MOBILE_RELEASE_VERSION;
const directory = path.resolve(process.argv[2] || "mobile-installers");
const { names, checksums } = prepareMobileAssets(directory, version);
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const api = endpoint => JSON.parse(gh("api", endpoint));
const repo = api(`repos/${repository}`);
if (repo.private) throw Error("Downloads repository must be public");
const releaseVersion = process.env.PUBLIC_RELEASE_VERSION || JSON.parse(fs.readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")).version;
if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) throw Error("Invalid public release version");
const tag = `v${releaseVersion}`;
let release = api(`repos/${repository}/releases?per_page=100`).find(r => r.tag_name === tag);
const notes = releaseNotes(releaseVersion);
if (!release) {
  gh("release", "create", tag, "--repo", repository, "--target", repo.default_branch, "--draft", "--prerelease", "--title", `FinancialAdvisor ${releaseVersion} — preview`, "--notes", notes);
  release = api(`repos/${repository}/releases?per_page=100`).find(r => r.tag_name === tag);
  if (!release) throw Error("Created mobile release draft was not returned by GitHub");
}
fs.writeFileSync(path.join(directory, "MOBILE-SHA256SUMS.txt"), checksums);
const assets = api(`repos/${repository}/releases/${release.id}/assets?per_page=100`);
for (const name of [...names, "MOBILE-SHA256SUMS.txt"]) {
  const file = path.join(directory, name);
  const digest = "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const existing = assets.find(a => a.name === name);
  if (existing) {
    if (existing.digest !== digest) throw Error(`Refusing to overwrite different public asset: ${name}`);
  } else gh("release", "upload", tag, "--repo", repository, file);
}
const uploaded = api(`repos/${repository}/releases/${release.id}/assets?per_page=100`);
for (const name of names) {
  const expected = "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex");
  if (uploaded.find(a => a.name === name)?.digest !== expected) throw Error(`Public upload checksum mismatch: ${name}`);
}
if (release.draft) gh("release", "edit", tag, "--repo", repository, "--draft=false", "--prerelease", "--latest=false");
console.log(`Published mobile installers: https://github.com/${repository}/releases/tag/${tag}`);
