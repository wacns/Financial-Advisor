import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { historyMarkdown } from "./release-history.ts";
import type { ReleaseHistory } from "./release-history.ts";
import { trustedJson } from "./trusted.ts";
const directory = fileURLToPath(new URL("../docs/releases/", import.meta.url));
const repository = "wacns/financial-advisor-releases";
function savedHistory(version: string): ReleaseHistory | undefined {
  if (!process.env.RELEASE_HISTORY_FILE) return undefined;
  const history = trustedJson<ReleaseHistory>(fs.readFileSync(process.env.RELEASE_HISTORY_FILE, "utf8"));
  return history.version === version ? history : undefined;
}
export function releaseNotes(
  version: string,
  history: ReleaseHistory | undefined = savedHistory(version),
): string {
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
export function publicChangelog(
  latestVersion?: string,
  histories: Record<string, ReleaseHistory | undefined> = {},
): string {
  const versions = fs.readdirSync(directory).filter(name => /^\d+\.\d+\.\d+\.md$/.test(name)).map(name => name.slice(0, -3));
  versions.sort((a, b) => {
    // Versions matched x.y.z above; NaN defaults match the old undefined arithmetic.
    const [l0 = NaN, l1 = NaN, l2 = NaN] = a.split(".").map(Number),
      [r0 = NaN, r1 = NaN, r2 = NaN] = b.split(".").map(Number);
    return r0 - l0 || r1 - l1 || r2 - l2;
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
