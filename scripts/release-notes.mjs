import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { historyMarkdown } from "./release-history.mjs";
const directory = fileURLToPath(new URL("../docs/releases/", import.meta.url));
const repository = "wacns/financial-advisor-releases";
function savedHistory(version) {
  if (!process.env.RELEASE_HISTORY_FILE) return undefined;
  const history = JSON.parse(fs.readFileSync(process.env.RELEASE_HISTORY_FILE, "utf8"));
  return history.version === version ? history : undefined;
}
export function releaseNotes(version, history = savedHistory(version)) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid release notes version");
  const file = path.join(directory, `${version}.md`);
  if (!fs.existsSync(file)) throw Error(`Add docs/releases/${version}.md with the changes for this version before publishing`);
  const changes = fs.readFileSync(file, "utf8").trim();
  if (!changes.includes("## What's Changed") || !/^[-*] /m.test(changes)) throw Error(`Release ${version} needs a What's Changed section with changes`);
  if (history) {
    if (history.version !== version) throw Error("History version does not match release notes");
    const generated = historyMarkdown(history);
    const body = changes.replace("## What's Changed", `## What's Changed\n\n${generated.changes}\n\n## Release highlights`);
    return `${body}\n\n**Full Changelog**: ${generated.comparison}\n\nSource commit, PR and comparison links require access to the private source repository.\n\n[Public release history](https://github.com/${repository}/blob/main/CHANGELOG.md)\n`;
  }
  return `${changes}\n\n**Full Changelog**: https://github.com/${repository}/blob/main/CHANGELOG.md\n`;
}
export function publicChangelog(latestVersion, histories = {}) {
  const versions = fs.readdirSync(directory).filter(name => /^\d+\.\d+\.\d+\.md$/.test(name)).map(name => name.slice(0, -3));
  versions.sort((a, b) => {
    const left = a.split(".").map(Number), right = b.split(".").map(Number);
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  });
  const included = latestVersion ? versions.slice(versions.indexOf(latestVersion)) : versions;
  if (latestVersion && !versions.includes(latestVersion)) throw Error("Latest public release needs versioned notes");
  return "# FinancialAdvisor changelog\n\nPublic release history. Application source remains private.\n\n" + included.map(version => {
    const history = histories[version] || savedHistory(version);
    const raw = history ? releaseNotes(version, history) : fs.readFileSync(path.join(directory, `${version}.md`), "utf8");
    const body = raw.trim().replace(/^#{2,5} /gm, heading => `#${heading}`);
    return `## ${version}\n\n${body}\n`;
  }).join("\n");
}
