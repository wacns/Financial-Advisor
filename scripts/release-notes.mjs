import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(new URL("../docs/releases/", import.meta.url));
const repository = "wacns/financial-advisor-releases";
export function releaseNotes(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid release notes version");
  const file = path.join(directory, `${version}.md`);
  if (!fs.existsSync(file)) throw Error(`Add docs/releases/${version}.md with the changes for this version before publishing`);
  const changes = fs.readFileSync(file, "utf8").trim();
  if (!changes.includes("## What's Changed") || !/^[-*] /m.test(changes)) throw Error(`Release ${version} needs a What's Changed section with changes`);
  return `${changes}\n\n**Full Changelog**: https://github.com/${repository}/blob/main/CHANGELOG.md\n`;
}
export function publicChangelog(latestVersion) {
  const versions = fs.readdirSync(directory).filter(name => /^\d+\.\d+\.\d+\.md$/.test(name)).map(name => name.slice(0, -3));
  versions.sort((a, b) => {
    const left = a.split(".").map(Number), right = b.split(".").map(Number);
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  });
  const included = latestVersion ? versions.slice(versions.indexOf(latestVersion)) : versions;
  if (latestVersion && !versions.includes(latestVersion)) throw Error("Latest public release needs versioned notes");
  return "# FinancialAdvisor changelog\n\nPublic release history. Application source remains private.\n\n" + included.map(version => {
    const body = fs.readFileSync(path.join(directory, `${version}.md`), "utf8").trim().replace(/^#{2,5} /gm, heading => `#${heading}`);
    return `## ${version}\n\n${body}\n`;
  }).join("\n");
}
