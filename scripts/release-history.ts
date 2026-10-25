import { must } from "../src/guards.ts";
export const sourceRepository = "wacns/Financial-Advisor";
/** The parts of GitHub's commit and pull request JSON this file reads. */
export type GitHubCommit = {
  sha: string;
  commit: { message: string };
  author?: { login?: string } | null;
};
export type GitHubPull = {
  number: number;
  title: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user?: { login?: string } | null;
};
export type HistoryEntry = {
  type: "pull" | "commit";
  number?: number;
  sha?: string;
  title: string;
  author: string | null;
  url: string;
};
/** What generate-release-history writes for one release. */
export type ReleaseHistory = {
  version: string;
  sourceRepository: string;
  baseSha: string;
  headSha: string;
  baseRef: string;
  headRef: string;
  entries: HistoryEntry[];
};
const escape = (text: unknown) => String(text).replace(/[\\`*_{}\[\]<>()#!|]/g, "\\$&").replace(/[\r\n]+/g, " ");
export function historyEntries(
  commits: GitHubCommit[],
  associatedPulls: Record<string, GitHubPull[] | undefined>,
): HistoryEntry[] {
  const shas = new Set(commits.map(commit => commit.sha));
  const seen = new Set<number>();
  const entries: HistoryEntry[] = [];
  for (const commit of commits) {
    // A pull without a merge commit is not in this range, as shas.has(null) was false.
    const pulls = (associatedPulls[commit.sha] || []).filter(pr => pr.merged_at && pr.merge_commit_sha !== null && shas.has(pr.merge_commit_sha));
    if (pulls.length) {
      for (const pr of pulls) if (!seen.has(pr.number)) {
        seen.add(pr.number);
        entries.push({ type: "pull", number: pr.number, title: pr.title, author: pr.user?.login || null, url: `https://github.com/${sourceRepository}/pull/${pr.number}` });
      }
    } else entries.push({ type: "commit", sha: commit.sha, title: must(commit.commit.message.split("\n")[0], "commit title"), author: commit.author?.login || null, url: `https://github.com/${sourceRepository}/commit/${commit.sha}` });
  }
  return entries;
}
export function historyMarkdown(history: ReleaseHistory) {
  if (history.sourceRepository !== sourceRepository || !/^[a-f0-9]{40}$/.test(history.baseSha) || !/^[a-f0-9]{40}$/.test(history.headSha)) throw Error("Invalid source history");
  const lines = history.entries.map(entry => {
    const expected = entry.type === "pull" ? `https://github.com/${sourceRepository}/pull/${entry.number}` : `https://github.com/${sourceRepository}/commit/${entry.sha}`;
    if (entry.url !== expected || (entry.type !== "pull" && entry.type !== "commit")) throw Error("Invalid history entry link");
    if (entry.author && !/^[a-z0-9][a-z0-9-]*(?:\[bot\])?$/i.test(entry.author)) throw Error("Invalid GitHub author");
    const author = entry.author ? ` by @${entry.author}` : "";
    // A commit entry always records its sha.
    const label = entry.type === "pull" ? `#${entry.number}` : must(entry.sha, "commit sha").slice(0, 7);
    return `- ${escape(entry.title)}${author} in [${label}](${entry.url})`;
  });
  const comparison = `https://github.com/${sourceRepository}/compare/${encodeURIComponent(history.baseRef)}...${encodeURIComponent(history.headRef)}`;
  return { changes: lines.join("\n") || "- No source commits between these release snapshots.", comparison };
}
