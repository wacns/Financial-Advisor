import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { prepareFeed, metadataNames } from "../../scripts/desktop-feed.mjs";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fa-feed-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = "FinancialAdvisor-1.6.1-linux-x64.AppImage";
  const bytes = Buffer.from("test installer");
  fs.writeFileSync(path.join(dir, file), bytes);
  const metadata = { version: "1.6.1", files: [{ url: file, sha512: crypto.createHash("sha512").update(bytes).digest("base64"), size: bytes.length }], path: file };
  for (const name of metadataNames) fs.writeFileSync(path.join(dir, name), JSON.stringify(metadata));
  return { dir, file };
}
test("public desktop feed preserves hashes and points every installer to its public versioned release", t => {
  const { dir, file } = fixture(t);
  const { feeds, checksums } = prepareFeed(dir, "1.6.1", "wacns/financial-advisor-releases");
  assert.equal(feeds.length, 3);
  for (const feed of feeds) {
    assert.ok(feed.content.includes(`https://github.com/wacns/financial-advisor-releases/releases/download/v1.6.1/${file}`));
    assert.ok(feed.content.includes("sha512:"));
  }
  assert.ok(checksums.includes(file));
});
test("public feed rejects changed installer bytes", t => {
  const { dir, file } = fixture(t);
  fs.appendFileSync(path.join(dir, file), "modified");
  assert.throws(() => prepareFeed(dir, "1.6.1", "wacns/financial-advisor-releases"), /checksum\/size mismatch/);
});
test("public feed rejects source files and mobile installers", t => {
  const { dir } = fixture(t);
  fs.writeFileSync(path.join(dir, "private-source.js"), "source");
  assert.throws(() => prepareFeed(dir, "1.6.1", "wacns/financial-advisor-releases"), /Unexpected public asset/);
  fs.unlinkSync(path.join(dir, "private-source.js"));
  fs.writeFileSync(path.join(dir, "FinancialAdvisor-1.6.1-android-preview.apk"), "apk");
  assert.throws(() => prepareFeed(dir, "1.6.1", "wacns/financial-advisor-releases"), /Unexpected public asset/);
});
