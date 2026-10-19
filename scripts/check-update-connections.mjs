import fs from "node:fs";
import config from "../app.config.js";

const results = [];
let failed = false;
function result(name, status, message) {
  results.push({ name, status, message });
  console.log(`${name}: ${status} — ${message}`);
  if (status === "FAIL") failed = true;
}

if (!process.env.EXPO_TOKEN) {
  result("Expo", "FAIL", "EXPO_TOKEN is not available to this workflow. Add the repository secret or check its environment scope.");
} else {
  try {
    const response = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.EXPO_TOKEN}` },
      body: JSON.stringify({
        query: "query CheckUpdateProject($appId: String!) { app { byId(appId: $appId) { id slug ownerAccount { name } } } }",
        variables: { appId: config.expo.extra.eas.projectId },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    const project = body.data?.app?.byId;
    if (!response.ok || body.errors?.length || !project) {
      result("Expo", "FAIL", `Project access was rejected (HTTP ${response.status}). Check token validity and membership in the project's account.`);
    } else if (project.id !== config.expo.extra.eas.projectId || project.slug !== config.expo.slug || project.ownerAccount?.name !== config.expo.owner) {
      result("Expo", "FAIL", "The project ID is readable, but its owner/slug does not match app.config.js.");
    } else {
      result("Expo", "PASS", `Token can read @${project.ownerAccount.name}/${project.slug} (${project.id}). Publishing permission and device delivery are not tested by this read-only check.`);
    }
  } catch {
    result("Expo", "FAIL", "Could not complete the Expo API connection check. No token values or API response bodies were logged.");
  }
}

const desktopFeed = process.env.DESKTOP_UPDATE_URL || JSON.parse(fs.readFileSync(new URL("../desktop/update-feed.json", import.meta.url), "utf8")).url;
{
  try {
    const base = new URL(desktopFeed);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw Error("Invalid feed");
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    const files = ["latest.yml", "latest-linux.yml", "latest-mac.yml"];
    const checks = await Promise.all(files.map(async (file) => {
      const response = await fetch(new URL(file, base), { signal: AbortSignal.timeout(30000) });
      const content = await response.text();
      return { file, status: response.status, valid: response.ok && /^version:\s*\S+/m.test(content) && /sha512:/m.test(content) && /(?:^files:|^path:)/m.test(content) };
    }));
    for (const check of checks) result(`Desktop ${check.file}`, check.valid ? "PASS" : "FAIL", check.valid ? "Update metadata is reachable without repository credentials. Installer download, signing and installation remain separate checks." : `Feed metadata is missing, invalid or inaccessible (HTTP ${check.status}).`);
  } catch {
    result("Desktop", "FAIL", "Could not read the HTTPS update feed. Use a base URL without embedded credentials or query tokens.");
  }
}

const summary = "# Update connection check\n\n" + results.map(({ name, status, message }) => `- **${name}: ${status}** — ${message}`).join("\n") + "\n\nNo updates were published and no installers were changed.\n";
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (failed) process.exitCode = 1;
