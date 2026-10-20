import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { releaseNotes, publicChangelog } from "./release-notes.mjs";
if (!process.env.GH_TOKEN) throw Error("RELEASES_TOKEN is required to publish release notes");
const repository = "wacns/financial-advisor-releases";
const version = process.env.RELEASE_NOTES_VERSION || JSON.parse(fs.readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")).version;
const body = releaseNotes(version);
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const api = (endpoint, data) => JSON.parse(data ? execFileSync("gh", ["api", endpoint, "--method", "POST", "--input", "-"], { input: JSON.stringify(data), encoding: "utf8" }) : gh("api", endpoint));
const repo = api(`repos/${repository}`);
if (repo.private) throw Error("Release notes destination must be public");
const releases = api(`repos/${repository}/releases?per_page=100`);
const release = releases.find(item => item.tag_name === `v${version}`);
if (!release) throw Error(`Public release v${version} must exist before its notes are published`);
const ref = api(`repos/${repository}/git/ref/heads/${repo.default_branch}`);
const parent = api(`repos/${repository}/git/commits/${ref.object.sha}`);
const current = api(`repos/${repository}/git/trees/${parent.tree.sha}?recursive=1`);
const latestVersion = releases.filter(item => !item.draft || item.tag_name === `v${version}`).map(item => item.tag_name.replace(/^v/, "")).filter(item => /^\d+\.\d+\.\d+$/.test(item)).sort((a, b) => {
  const left = a.split(".").map(Number), right = b.split(".").map(Number);
  return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
})[0];
const entries = [{ path: "CHANGELOG.md", content: publicChangelog(latestVersion) }, { path: `release-notes/${version}.md`, content: body }];
const changed = entries.filter(({ path, content }) => {
  const bytes = Buffer.from(content);
  const sha = crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  return current.tree.find(entry => entry.path === path)?.sha !== sha;
});
if (changed.length) {
  const tree = api(`repos/${repository}/git/trees`, { base_tree: parent.tree.sha, tree: changed.map(entry => ({ ...entry, mode: "100644", type: "blob" })) });
  const commit = api(`repos/${repository}/git/commits`, { message: `Document FinancialAdvisor ${version} release changes`, tree: tree.sha, parents: [ref.object.sha] });
  execFileSync("gh", ["api", `repos/${repository}/git/refs/heads/${repo.default_branch}`, "--method", "PATCH", "--input", "-"], { input: JSON.stringify({ sha: commit.sha, force: false }), stdio: ["pipe", "ignore", "pipe"] });
}
if (release.body !== body) execFileSync("gh", ["api", `repos/${repository}/releases/${release.id}`, "--method", "PATCH", "--input", "-"], { input: JSON.stringify({ body }), stdio: ["pipe", "ignore", "pipe"] });
console.log(`Release changelog published: https://github.com/${repository}/releases/tag/v${version}`);
