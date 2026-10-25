import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { releaseNotes, publicChangelog } from "./release-notes.ts";
import { trustedJson } from "./trusted.ts";
import type { ReleaseHistory } from "./release-history.ts";
import type { GitCommit, GitRef, GitTree, Release, Repository } from "./github-types.ts";
if (!process.env.GH_TOKEN) throw Error("RELEASES_TOKEN is required to publish release notes");
const repository = "wacns/financial-advisor-releases";
const version = process.env.RELEASE_NOTES_VERSION || trustedJson<{ version: string }>(fs.readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")).version;
if (!process.env.RELEASE_HISTORY_FILE) throw Error("Generate source release history before publishing notes");
const history = trustedJson<ReleaseHistory>(fs.readFileSync(process.env.RELEASE_HISTORY_FILE, "utf8"));
const body = releaseNotes(version, history);
const gh = (...args: string[]) => execFileSync("gh", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const api = <T>(endpoint: string, data?: unknown): T => trustedJson<T>(data ? execFileSync("gh", ["api", endpoint, "--method", "POST", "--input", "-"], { input: JSON.stringify(data), encoding: "utf8" }) : gh("api", endpoint));
const repo = api<Repository>(`repos/${repository}`);
if (repo.private) throw Error("Release notes destination must be public");
const releases = api<Release[]>(`repos/${repository}/releases?per_page=100`);
const release = releases.find(item => item.tag_name === `v${version}`);
if (!release) throw Error(`Public release v${version} must exist before its notes are published`);
const ref = api<GitRef>(`repos/${repository}/git/ref/heads/${repo.default_branch}`);
const parent = api<GitCommit>(`repos/${repository}/git/commits/${ref.object.sha}`);
const current = api<GitTree>(`repos/${repository}/git/trees/${parent.tree.sha}?recursive=1`);
const latestVersion = releases.filter(item => !item.draft || item.tag_name === `v${version}`).map(item => item.tag_name.replace(/^v/, "")).filter(item => /^\d+\.\d+\.\d+$/.test(item)).sort((a, b) => {
  // Tags matched x.y.z; NaN defaults match the old undefined arithmetic.
  const [l0 = NaN, l1 = NaN, l2 = NaN] = a.split(".").map(Number), [r0 = NaN, r1 = NaN, r2 = NaN] = b.split(".").map(Number);
  return r0 - l0 || r1 - l1 || r2 - l2;
})[0];
const histories: Record<string, ReleaseHistory> = {};
for (const entry of current.tree.filter(item => /^release-history\/\d+\.\d+\.\d+\.json$/.test(item.path))) {
  const blob = api<{ content: string }>(`repos/${repository}/git/blobs/${entry.sha}`);
  // String() is the conversion JSON.parse applies to a Buffer.
  const saved = trustedJson<ReleaseHistory>(String(Buffer.from(blob.content, "base64")));
  histories[saved.version] = saved;
}
histories[version] = history;
const entries = [{ path: "CHANGELOG.md", content: publicChangelog(latestVersion, histories) }, { path: `release-notes/${version}.md`, content: body }, { path: `release-history/${version}.json`, content: JSON.stringify(history, null, 2) + "\n" }];
const changed = entries.filter(({ path, content }) => {
  const bytes = Buffer.from(content);
  const sha = crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  return current.tree.find(entry => entry.path === path)?.sha !== sha;
});
if (changed.length) {
  const tree = api<GitTree>(`repos/${repository}/git/trees`, { base_tree: parent.tree.sha, tree: changed.map(entry => ({ ...entry, mode: "100644", type: "blob" })) });
  const commit = api<GitCommit>(`repos/${repository}/git/commits`, { message: `Document FinancialAdvisor ${version} release changes`, tree: tree.sha, parents: [ref.object.sha] });
  execFileSync("gh", ["api", `repos/${repository}/git/refs/heads/${repo.default_branch}`, "--method", "PATCH", "--input", "-"], { input: JSON.stringify({ sha: commit.sha, force: false }), stdio: ["pipe", "ignore", "pipe"] });
}
if (release.body !== body || release.name !== release.tag_name) execFileSync("gh", ["api", `repos/${repository}/releases/${release.id}`, "--method", "PATCH", "--input", "-"], { input: JSON.stringify({ body, name: release.tag_name }), stdio: ["pipe", "ignore", "pipe"] });
console.log(`Release changelog published: https://github.com/${repository}/releases/tag/v${version}`);
