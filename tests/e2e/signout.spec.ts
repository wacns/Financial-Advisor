import { test, expect } from "@playwright/test";
import { demoState } from "../../src/finance.ts";
import { normalizeWorkspace } from "../../src/domain/model.ts";
import { DEMO_STORAGE_KEY } from "../../src/locale.ts";
import { must } from "../../src/guards.ts";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`leaving demo from Personal account returns to login and preserves records at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://srwzgwodlpylezdaipce.supabase.co/**", (route) => {
      const request = route.request();
      if (new URL(request.url()).pathname.includes("/rest/") && request.method() !== "GET")
        writes.push(request.url());
      return route.fulfill({ json: { chatgpt: { signInConfigured: false } } });
    });
    const saved = normalizeWorkspace(demoState());
    const account = must(saved.accounts[0], "demo account");
    account.name = "Preserved demo savings";
    account.balance = 123.456;
    const serialized = JSON.stringify(saved);
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: DEMO_STORAGE_KEY,
      value: serialized,
    });

    await page.goto("/#/login");
    await page.getByRole("link", { name: "Explore the demo" }).click();
    await expect(page.getByRole("heading", { name: "A clearer picture, Fatima." })).toBeVisible();
    if (viewport.width < 800)
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Personal account", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Leave demo", exact: true }).click();

    await expect(page).toHaveURL(/#\/login$/);
    expect(errors).toEqual([]);
    await expect(page.getByRole("heading", { name: "Welcome to FinancialAdvisor." })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), DEMO_STORAGE_KEY)).toBe(serialized);

    await page.getByRole("link", { name: "Explore the demo" }).click();
    await expect(page.getByRole("heading", { name: "A clearer picture, Fatima." })).toBeVisible();
    await expect(page.getByText("Preserved demo savings", { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}
