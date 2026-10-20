import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { historyEntries, historyMarkdown, sourceRepository } from "./release-history.mjs";
const publicRepository = "wacns/financial-advisor-releases";
const version = process.env.RELEASE_NOTES_VERSION || JSON.parse(fs.readFileSync(new URL("../desktop/package.json", import.meta.url))).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid release history version");
if (!process.env.RELEASE_HISTORY_FILE) throw Error("RELEASE_HISTORY_FILE is required");
function api(endpoint, optional = false) {
  const result = spawnSync("gh", ["api", endpoint], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) {
    if (optional && /HTTP 404/.test(result.stderr || "")) return null;
    throw Error(`GitHub source history request failed: ${endpoint}. Check Contents and Pull requests read permissions.`);
  }
  return JSON.parse(result.stdout);
}
const contents = api(`repos/${publicRepository}/contents/release-history/${version}.json`, true);
const saved = contents ? JSON.parse(Buffer.from(contents.content, "base64")) : null;
const bootstrap = JSON.parse(fs.readFileSync(new URL("../docs/releases/history.json", import.meta.url), "utf8"))[version];
let range = saved || bootstrap;
if (!range) {
  const prior = api(`repos/${publicRepository}/contents/release-history`) || [];
  const compareVersions = (a, b) => { const left=a.split(".").map(Number), right=b.split(".").map(Number); return left[0]-right[0] || left[1]-right[1] || left[2]-right[2]; };
  const previous = prior.map(file => file.name.replace(/\.json$/, "")).filter(name => /^\d+\.\d+\.\d+$/.test(name) && compareVersions(name, version) < 0).sort(compareVersions).at(-1);
  if (!previous) throw Error("First release history needs a verified base/head in docs/releases/history.json");
  const file = api(`repos/${publicRepository}/contents/release-history/${previous}.json`);
  const previousHistory = JSON.parse(Buffer.from(file.content, "base64"));
  const tag = api(`repos/${sourceRepository}/commits/v${version}`, true);
  range = { baseRef: previousHistory.headRef, baseSha: previousHistory.headSha, headRef: tag ? `v${version}` : process.env.GITHUB_SHA, headSha: tag?.sha || process.env.GITHUB_SHA };
}
if (!range.baseRef || !range.headRef || (saved && (saved.version !== version || saved.sourceRepository !== sourceRepository))) throw Error("Invalid saved release history");
const base = api(`repos/${sourceRepository}/commits/${encodeURIComponent(range.baseRef)}`);
const head = api(`repos/${sourceRepository}/commits/${encodeURIComponent(range.headRef)}`);
if ((range.baseSha && base.sha !== range.baseSha) || (range.headSha && head.sha !== range.headSha)) throw Error("Release history references moved; refusing to change the recorded source range");
const commits = [];
let total;
for (let page=1; total == null || commits.length < total; page++) {
  const compared = api(`repos/${sourceRepository}/compare/${base.sha}...${head.sha}?per_page=100&page=${page}`);
  if (!["ahead", "identical"].includes(compared.status)) throw Error("Release history base must be an ancestor of its head");
  total = compared.total_commits;
  if (total && !compared.commits.length) throw Error("Incomplete commit history");
  commits.push(...compared.commits);
}
if (new Set(commits.map(c=>c.sha)).size !== total) throw Error("Incomplete or duplicate commit history");
const pulls = {};
for (const commit of commits) {
  pulls[commit.sha] = [];
  for (let page=1;;page++) {
    const associated = api(`repos/${sourceRepository}/commits/${commit.sha}/pulls?per_page=100&page=${page}`);
    pulls[commit.sha].push(...associated);
    if (associated.length < 100) break;
  }
}
const history = { version, sourceRepository, baseRef: range.baseRef, headRef: range.headRef, baseSha: base.sha, headSha: head.sha, entries: historyEntries(commits, pulls) };
historyMarkdown(history);
fs.mkdirSync(path.dirname(process.env.RELEASE_HISTORY_FILE), { recursive: true });
fs.writeFileSync(process.env.RELEASE_HISTORY_FILE, JSON.stringify(history, null, 2) + "\n");
console.log(`Prepared ${history.entries.length} verified PR/commit entries for ${version}; source files and diffs are excluded.`);
