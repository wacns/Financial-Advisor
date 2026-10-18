import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import policy from "../../desktop/policy.cjs";
test("desktop OAuth opens only the configured HTTPS authorization endpoint", () => {
  const origin = "https://project.supabase.co";
  assert.equal(policy.authTarget(`${origin}/auth/v1/authorize?provider=google`, origin), true);
  for (const target of ["https://evil.example/auth/v1/authorize", `${origin}/other`, "file:///etc/passwd", "javascript:alert(1)", "http://project.supabase.co/auth/v1/authorize", "https://attacker@project.supabase.co/auth/v1/authorize"]) assert.equal(policy.authTarget(target, origin), false);
});
test("desktop deep links accept only app callback codes/errors", () => {
  assert.equal(policy.authCallback(`${policy.CALLBACK}?code=one-use`), true);
  assert.equal(policy.authCallback(`${policy.CALLBACK}?error=access_denied`), true);
  for (const target of ["https://example.com/auth/callback?code=bad", `${policy.CALLBACK}#access_token=token`, "com.wacns.financialadvisor://auth/other?code=bad", "com.wacns.financialadvisor://attacker@auth/callback?code=bad"]) assert.equal(policy.authCallback(target), false);
});
test("desktop asset handler confines encoded paths to the bundled application", () => {
  const root = path.resolve("desktop/web");
  assert.equal(policy.assetPath("financialadvisor://app/assets/app.js", root), path.join(root, "assets/app.js"));
  assert.equal(policy.assetPath("financialadvisor://app/", root), path.join(root, "index.html"));
  for (const url of ["financialadvisor://evil/index.html", "file:///etc/passwd", "financialadvisor://app/%2e%2e%2fpackage.json", "financialadvisor://app/%2e%2e%5cpackage.json"]) {
    // Backslash is a directory separator on Windows only.
    if (url.includes("%5c") && process.platform !== "win32") continue;
    assert.throws(() => policy.assetPath(url, root));
  }
});
