export const sourceRepository = "wacns/Financial-Advisor";
const escape = text => String(text).replace(/[\\`*_{}\[\]<>()#!|]/g, "\\$&").replace(/[\r\n]+/g, " ");
export function historyEntries(commits, associatedPulls) {
  const shas = new Set(commits.map(commit => commit.sha));
  const seen = new Set();
  const entries = [];
  for (const commit of commits) {
    const pulls = (associatedPulls[commit.sha] || []).filter(pr => pr.merged_at && shas.has(pr.merge_commit_sha));
    if (pulls.length) {
      for (const pr of pulls) if (!seen.has(pr.number)) {
        seen.add(pr.number);
        entries.push({ type: "pull", number: pr.number, title: pr.title, author: pr.user?.login || null, url: `https://github.com/${sourceRepository}/pull/${pr.number}` });
      }
    } else entries.push({ type: "commit", sha: commit.sha, title: commit.commit.message.split("\n")[0], author: commit.author?.login || null, url: `https://github.com/${sourceRepository}/commit/${commit.sha}` });
  }
  return entries;
}
export function historyMarkdown(history) {
  if (history.sourceRepository !== sourceRepository || !/^[a-f0-9]{40}$/.test(history.baseSha) || !/^[a-f0-9]{40}$/.test(history.headSha)) throw Error("Invalid source history");
  const lines = history.entries.map(entry => {
    const expected = entry.type === "pull" ? `https://github.com/${sourceRepository}/pull/${entry.number}` : `https://github.com/${sourceRepository}/commit/${entry.sha}`;
    if (entry.url !== expected || (entry.type !== "pull" && entry.type !== "commit")) throw Error("Invalid history entry link");
    if (entry.author && !/^[a-z0-9][a-z0-9-]*(?:\[bot\])?$/i.test(entry.author)) throw Error("Invalid GitHub author");
    const author = entry.author ? ` by @${entry.author}` : "";
    const label = entry.type === "pull" ? `#${entry.number}` : entry.sha.slice(0, 7);
    return `- ${escape(entry.title)}${author} in [${label}](${entry.url})`;
  });
  const comparison = `https://github.com/${sourceRepository}/compare/${encodeURIComponent(history.baseRef)}...${encodeURIComponent(history.headRef)}`;
  return { changes: lines.join("\n") || "- No source commits between these release snapshots.", comparison };
}
