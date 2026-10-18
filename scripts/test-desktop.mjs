import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "financial-advisor-desktop-test-"));
const app = await electron.launch({ args: ["--no-sandbox", ...(process.env.DESKTOP_HEADLESS ? ["--ozone-platform=headless"] : []), `--user-data-dir=${userData}`, "desktop"], timeout: 60000 });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByText("Welcome to FinancialAdvisor.")).toBeVisible();
  await expect(page.getByText("Explore the demo ↗")).toBeVisible();
  const context = await page.evaluate(() => ({ node: typeof window.require, bridge: !!window.financialAdvisorDesktop, origin: location.origin }));
  expect(context).toEqual({ node: "undefined", bridge: true, origin: "financialadvisor://app" });
  await page.getByText("Explore the demo ↗").click();
  await expect(page.getByText("A clearer picture, Fatima.")).toBeVisible();
  const settingsLink = page.getByRole("link", { name: "Settings", exact: true });
  if (!await settingsLink.isVisible()) await page.getByRole("button", { name: "More", exact: true }).click();
  await settingsLink.click();
  await expect(page.getByText("App updates", { exact: true })).toBeVisible();
  await expect(page.getByText(/Automatic updates need a configured download feed/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("App updates", { exact: true })).toBeVisible();
  const rejected = await page.evaluate(async () => {
    try { await window.financialAdvisorDesktop.openAuth("https://attacker.example/"); return false; }
    catch { return true; }
  });
  expect(rejected).toBe(true);
  expect(errors).toEqual([]);
  console.log("Desktop smoke test passed: bundled UI, demo, settings, persistence, isolated renderer and rejected external auth target.");
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
