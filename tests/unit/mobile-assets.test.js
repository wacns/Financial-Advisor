import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { prepareMobileAssets } from "../../scripts/mobile-assets.mjs";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fa-mobile-release-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const names = ["FinancialAdvisor-1.6.0-android-preview.apk", "FinancialAdvisor-1.6.0-ios-unsigned.ipa"];
  for (const name of names) fs.writeFileSync(path.join(dir, name), name);
  fs.writeFileSync(path.join(dir, "SHA256SUMS.txt"), names.map(name => `${crypto.createHash("sha256").update(name).digest("hex")}  ${name}`).join("\n") + "\n");
  return { dir, names };
}
test("mobile publishing selects checksum-verified APK and IPA", t => {
  const { dir, names } = fixture(t);
  const prepared = prepareMobileAssets(dir, "1.6.0");
  assert.deepEqual(prepared.names, names);
  assert.ok(prepared.checksums.includes(names[1]));
});
test("mobile publishing rejects a changed or wrong-version binary", t => {
  const { dir, names } = fixture(t);
  assert.throws(() => prepareMobileAssets(dir, "1.6.1"), /Unexpected mobile asset/);
  fs.appendFileSync(path.join(dir, names[0]), "changed");
  assert.throws(() => prepareMobileAssets(dir, "1.6.0"), /Source checksum mismatch/);
});
test("mobile publishing refuses extra source files", t => {
  const { dir } = fixture(t);
  fs.writeFileSync(path.join(dir, "private-source.js"), "source");
  assert.throws(() => prepareMobileAssets(dir, "1.6.0"), /Unexpected mobile asset/);
});
