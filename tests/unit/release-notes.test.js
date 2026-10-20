import test from "node:test";
import assert from "node:assert/strict";
import { releaseNotes, publicChangelog } from "../../scripts/release-notes.mjs";
test("release descriptions include real platform versions, changes and a readable public changelog", () => {
  const notes = releaseNotes("1.6.1");
  assert.match(notes, /## What's Changed/);
  assert.match(notes, /\| Android \| APK \/ AAB \| 1\.6\.0 \|/);
  assert.match(notes, /## Known limitations/);
  assert.match(notes, /\*\*Full Changelog\*\*: https:\/\/github\.com\/wacns\/financial-advisor-releases\/blob\/main\/CHANGELOG\.md/);
  assert.doesNotMatch(notes, /github\.com\/wacns\/Financial-Advisor\//);
});
test("missing or invalid version notes stop publishing instead of reusing another version", () => {
  assert.throws(() => releaseNotes("999.999.999"), /Add docs\/releases\/999\.999\.999\.md/);
  assert.throws(() => releaseNotes("../1.6.1"), /Invalid release notes version/);
});
test("public changelog lists release changes newest first", () => {
  const changelog = publicChangelog();
  assert.ok(changelog.indexOf("## 1.6.1\n") < changelog.indexOf("## 1.6.0\n"));
  assert.match(changelog, /### What's Changed/);
  assert.match(changelog, /Android release builds now use the runner's installed SDK/);
});

test("changelog generation excludes versions newer than the latest published release", () => {
  const changelog = publicChangelog("1.6.0");
  assert.doesNotMatch(changelog, /## 1\.6\.1/);
  assert.match(changelog, /## 1\.6\.0/);
});
