import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export function prepareMobileAssets(directory, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid mobile version");
  const pattern = new RegExp(`^FinancialAdvisor-${version.replaceAll(".", "\\.")}-(?:android-(?:preview|release)\\.(?:apk|aab)|ios-unsigned\\.ipa)$`);
  const expected = new Map(fs.readFileSync(path.join(directory, "SHA256SUMS.txt"), "utf8").trim().split("\n").map(line => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) throw Error("Invalid source checksums");
    return [match[2], match[1]];
  }));
  const names = fs.readdirSync(directory).filter(name => name !== "SHA256SUMS.txt").sort();
  if (!names.some(name => name.endsWith(".apk")) || !names.some(name => name.endsWith(".ipa"))) throw Error("Both APK and IPA are required");
  const checksums = names.map(name => {
    if (!pattern.test(name) || !fs.lstatSync(path.join(directory, name)).isFile()) throw Error(`Unexpected mobile asset: ${name}`);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex");
    if (expected.get(name) !== hash) throw Error(`Source checksum mismatch: ${name}`);
    return `${hash}  ${name}`;
  }).join("\n") + "\n";
  return { names, checksums };
}
