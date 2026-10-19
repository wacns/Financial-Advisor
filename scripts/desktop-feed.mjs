import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(new URL("../desktop/package.json", import.meta.url));
const yaml = require("js-yaml");
export const metadataNames = ["latest.yml", "latest-linux.yml", "latest-mac.yml"];
export function prepareFeed(directory, version, repository) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid desktop release version");
  const names = fs.readdirSync(directory).sort();
  const pattern = new RegExp(`^FinancialAdvisor-${version.replaceAll(".", "\\.")}-(?:win|linux|mac)-(?:x64|arm64|x86_64|amd64)\\.(?:exe|AppImage|deb|dmg|zip)(?:\\.blockmap)?$`);
  for (const name of names) {
    if (!metadataNames.includes(name) && !pattern.test(name)) throw Error(`Unexpected public asset: ${name}`);
    if (!fs.lstatSync(path.join(directory, name)).isFile()) throw Error(`Not a regular asset: ${name}`);
  }
  const feeds = metadataNames.map((name) => {
    const doc = yaml.load(fs.readFileSync(path.join(directory, name), "utf8"));
    if (doc.version !== version || !Array.isArray(doc.files) || !doc.files.length) throw Error(`Invalid metadata: ${name}`);
    function publicUrl(file) {
      if (!pattern.test(file) || !names.includes(file)) throw Error(`Missing or invalid installer: ${file}`);
      return `https://github.com/${repository}/releases/download/v${version}/${encodeURIComponent(file)}`;
    }
    for (const file of doc.files) {
      const url = publicUrl(file.url);
      const bytes = fs.readFileSync(path.join(directory, file.url));
      if (crypto.createHash("sha512").update(bytes).digest("base64") !== file.sha512 || (file.size != null && file.size !== bytes.length)) throw Error(`Installer checksum/size mismatch: ${file.url}`);
      file.url = url;
    }
    if (doc.path) doc.path = publicUrl(doc.path);
    return { name, content: yaml.dump(doc, { lineWidth: -1 }) };
  });
  const checksums = names.map(name => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex")}  ${name}`).join("\n") + "\n";
  return { names, feeds, checksums };
}
