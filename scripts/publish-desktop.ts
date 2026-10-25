import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { prepareFeed } from "./desktop-feed.ts";
import { releaseNotes } from "./release-notes.ts";
import { trustedJson } from "./trusted.ts";
import type { GitCommit, GitRef, GitTree, Release, ReleaseAsset, Repository } from "./github-types.ts";

if (!process.env.GH_TOKEN) throw Error("Save RELEASES_TOKEN in the private repository's Actions secrets. It needs Contents: read/write only for wacns/financial-advisor-releases.");
const { repository } = trustedJson<{ repository: string }>(fs.readFileSync(new URL("../desktop/update-feed.json", import.meta.url), "utf8"));
if (repository !== "wacns/financial-advisor-releases") throw Error("Unexpected downloads repository");
// A missing version becomes the text "undefined", which fails the version checks exactly as before.
const version = String(process.env.DESKTOP_RELEASE_VERSION);
const notes = releaseNotes(version);
const directory = path.resolve(process.argv[2] || "installers");
const { names, feeds, checksums } = prepareFeed(directory, version, repository);
const gh = (...args: string[]) => execFileSync("gh", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const api = <T>(endpoint: string, body?: unknown): T => trustedJson<T>(body ? execFileSync("gh", ["api", endpoint, "--method", "POST", "--input", "-"], { input: JSON.stringify(body), encoding: "utf8" }) : gh("api", endpoint));
const repo = api<Repository>(`repos/${repository}`);
if (repo.private) throw Error("Downloads repository must be public");
const tag = `v${version}`;
const existing = api<Release[]>(`repos/${repository}/releases?per_page=100`).find(r => r.tag_name === tag);
fs.writeFileSync(path.join(directory, "SHA256SUMS.txt"), checksums);
const assetNames = [...names, "SHA256SUMS.txt"];
if (existing && !existing.draft) {
  const assets = api<ReleaseAsset[]>(`repos/${repository}/releases/${existing.id}/assets?per_page=100`);
  for (const name of assetNames) {
    const digest = "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex");
    if (assets.find(a => a.name === name)?.digest !== digest) throw Error(`Published release differs: ${name}. Increment the desktop version.`);
  }
} else {
  if (!existing) gh("release", "create", tag, "--repo", repository, "--target", repo.default_branch, "--draft", "--prerelease", "--title", tag, "--notes", notes);
  gh("release", "upload", tag, "--repo", repository, "--clobber", ...assetNames.map(n => path.join(directory, n)));
  gh("release", "edit", tag, "--repo", repository, "--draft=false", "--prerelease", "--latest=false", "--title", tag);
}
// Publish all platform metadata in one commit after installer assets are available.
const ref = api<GitRef>(`repos/${repository}/git/ref/heads/${repo.default_branch}`);
const parent = api<GitCommit>(`repos/${repository}/git/commits/${ref.object.sha}`);
const tree = api<GitTree>(`repos/${repository}/git/trees`, { base_tree: parent.tree.sha, tree: feeds.map(({ name, content }) => ({ path: `updates/${name}`, mode: "100644", type: "blob", content })) });
const commit = api<GitCommit>(`repos/${repository}/git/commits`, { message: `Publish desktop ${version} update metadata`, tree: tree.sha, parents: [ref.object.sha] });
execFileSync("gh", ["api", `repos/${repository}/git/refs/heads/${repo.default_branch}`, "--method", "PATCH", "--input", "-"], { input: JSON.stringify({ sha: commit.sha, force: false }), stdio: ["pipe", "ignore", "pipe"] });
console.log(`Published https://github.com/${repository}/releases/tag/${tag} and public update metadata.`);
