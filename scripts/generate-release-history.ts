import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { historyEntries, historyMarkdown, sourceRepository } from "./release-history.ts";
import type { GitHubCommit, GitHubPull, ReleaseHistory } from "./release-history.ts";
import type { ContentFile } from "./github-types.ts";
import { trustedJson } from "./trusted.ts";
/** The source range a release covers; recorded ranges may lack the resolved SHAs. */
type Range = { baseRef?: string; baseSha?: string; headRef?: string; headSha?: string };
const publicRepository = "wacns/financial-advisor-releases";
// String() is the conversion JSON.parse applies to a Buffer.
const version = process.env.RELEASE_NOTES_VERSION || trustedJson<{ version: string }>(String(fs.readFileSync(new URL("../desktop/package.json", import.meta.url)))).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid release history version");
if (!process.env.RELEASE_HISTORY_FILE) throw Error("RELEASE_HISTORY_FILE is required");
function api<T>(endpoint: string): T;
function api<T>(endpoint: string, optional: true): T | null;
function api<T>(endpoint: string, optional = false): T | null {
  const result = spawnSync("gh", ["api", endpoint], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) {
    if (optional && /HTTP 404/.test(result.stderr || "")) return null;
    throw Error(`GitHub source history request failed: ${endpoint}. Check Contents and Pull requests read permissions.`);
  }
  return trustedJson<T>(result.stdout);
}
const contents = api<ContentFile>(`repos/${publicRepository}/contents/release-history/${version}.json`, true);
const saved = contents ? trustedJson<ReleaseHistory>(String(Buffer.from(contents.content, "base64"))) : null;
const bootstrap = trustedJson<Record<string, Range | undefined>>(fs.readFileSync(new URL("../docs/releases/history.json", import.meta.url), "utf8"))[version];
let range: Range | undefined = saved || bootstrap;
if (!range) {
  const prior = api<ContentFile[]>(`repos/${publicRepository}/contents/release-history`) || [];
  // Names matched x.y.z; NaN defaults match the old undefined arithmetic.
  const compareVersions = (a: string, b: string) => { const [l0=NaN,l1=NaN,l2=NaN]=a.split(".").map(Number), [r0=NaN,r1=NaN,r2=NaN]=b.split(".").map(Number); return l0-r0 || l1-r1 || l2-r2; };
  const previous = prior.map(file => file.name.replace(/\.json$/, "")).filter(name => /^\d+\.\d+\.\d+$/.test(name) && compareVersions(name, version) < 0).sort(compareVersions).at(-1);
  if (!previous) throw Error("First release history needs a verified base/head in docs/releases/history.json");
  const file = api<ContentFile>(`repos/${publicRepository}/contents/release-history/${previous}.json`);
  const previousHistory = trustedJson<ReleaseHistory>(String(Buffer.from(file.content, "base64")));
  const tag = api<{ sha: string }>(`repos/${sourceRepository}/commits/v${version}`, true);
  range = { baseRef: previousHistory.headRef, baseSha: previousHistory.headSha, headRef: tag ? `v${version}` : process.env.GITHUB_SHA, headSha: tag?.sha || process.env.GITHUB_SHA };
}
if (!range.baseRef || !range.headRef || (saved && (saved.version !== version || saved.sourceRepository !== sourceRepository))) throw Error("Invalid saved release history");
const { baseRef, headRef } = range;
const base = api<{ sha: string }>(`repos/${sourceRepository}/commits/${encodeURIComponent(baseRef)}`);
const head = api<{ sha: string }>(`repos/${sourceRepository}/commits/${encodeURIComponent(headRef)}`);
if ((range.baseSha && base.sha !== range.baseSha) || (range.headSha && head.sha !== range.headSha)) throw Error("Release history references moved; refusing to change the recorded source range");
const commits: GitHubCommit[] = [];
let total: number | undefined;
for (let page=1; total == null || commits.length < total; page++) {
  const compared = api<{ status: string; total_commits: number; commits: GitHubCommit[] }>(`repos/${sourceRepository}/compare/${base.sha}...${head.sha}?per_page=100&page=${page}`);
  if (!["ahead", "identical"].includes(compared.status)) throw Error("Release history base must be an ancestor of its head");
  total = compared.total_commits;
  if (total && !compared.commits.length) throw Error("Incomplete commit history");
  commits.push(...compared.commits);
}
if (new Set(commits.map(c=>c.sha)).size !== total) throw Error("Incomplete or duplicate commit history");
const pulls: Record<string, GitHubPull[]> = {};
for (const commit of commits) {
  const list: GitHubPull[] = (pulls[commit.sha] = []);
  for (let page=1;;page++) {
    const associated = api<GitHubPull[]>(`repos/${sourceRepository}/commits/${commit.sha}/pulls?per_page=100&page=${page}`);
    list.push(...associated);
    if (associated.length < 100) break;
  }
}
const history: ReleaseHistory = { version, sourceRepository, baseRef, headRef, baseSha: base.sha, headSha: head.sha, entries: historyEntries(commits, pulls) };
historyMarkdown(history);
fs.mkdirSync(path.dirname(process.env.RELEASE_HISTORY_FILE), { recursive: true });
fs.writeFileSync(process.env.RELEASE_HISTORY_FILE, JSON.stringify(history, null, 2) + "\n");
console.log(`Prepared ${history.entries.length} verified PR/commit entries for ${version}; source files and diffs are excluded.`);
