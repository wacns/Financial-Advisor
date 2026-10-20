import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Checks the last web build (npm run build). The .web/.native split must keep native-only code
// out of the browser bundle and must still pick the web variants.
const assets = path.join("dist", "assets");
const bundle = () =>
  fs
    .readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .map((name) => fs.readFileSync(path.join(assets, name), "utf8"))
    .join("\n");

test("the web bundle contains no native-only platform code", (t) => {
  if (!fs.existsSync(assets)) return t.skip("Run npm run build first; dist/ is missing.");
  const code = bundle();
  for (const marker of [
    "expo-secure-store",
    "expo-local-authentication",
    "Sign-in requires a secure connection.",
    "Sharing is unavailable on this device.",
  ])
    assert.equal(code.includes(marker), false, marker);
});

test("the web bundle uses the web platform variants", (t) => {
  if (!fs.existsSync(assets)) return t.skip("Run npm run build first; dist/ is missing.");
  assert.ok(bundle().includes("Open the installed mobile app to enable notifications."));
});
