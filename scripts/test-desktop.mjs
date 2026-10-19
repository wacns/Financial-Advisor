import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "financial-advisor-desktop-test-"));
const executablePath = process.env.DESKTOP_EXECUTABLE_PATH;
const app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox", ...(process.env.DESKTOP_HEADLESS ? ["--ozone-platform=headless"] : []), `--user-data-dir=${userData}`, ...(!executablePath ? ["desktop"] : [])], timeout: 60000 });
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
  await page.evaluate(() => { location.hash = "/demo/receipts"; });
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 450;
    const c = canvas.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, 1000, 450);
    c.fillStyle = "#000"; c.font = "bold 48px Arial"; c.fillText("CITY SUPERMARKET", 40, 80);
    c.font = "40px Arial"; c.fillText("2026-10-18 14:05", 40, 160); c.fillText("GRAND TOTAL BHD 12.500", 40, 260);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose receipt image", exact: true }).click();
  await (await chooser).setFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.getByLabel("Recognized receipt text")).toHaveValue(/12\.500/, { timeout: 60000 });
  await page.getByRole("button", { name: "Review expense", exact: true }).click();
  await expect(page.getByLabel("Amount (BHD)", { exact: true })).toHaveValue("12.500");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("northline-bh-demo-v1"))).toBeNull();
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
  console.log("Desktop smoke test passed: bundled UI, demo, local OCR/review without saving, settings, persistence, isolated renderer and rejected external auth target.");
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
