import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { blankState } from "../../src/finance.ts";
import { field } from "../../src/guards.ts";

async function signedIn(page: Page) {
  const user = {
    id: "70000000-0000-4000-8000-000000000001",
    email: "ai-test@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const access = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  await page.addInitScript(
    ({ access, user }: { access: string; user: object }) =>
      localStorage.setItem(
        "sb-srwzgwodlpylezdaipce-auth-token",
        JSON.stringify({
          access_token: access,
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          user,
        }),
      ),
    { access, user },
  );
  const seen: { asks: unknown[]; writes: number; price: number; version: string; balance: number } = {
    asks: [],
    writes: 0,
    price: 3,
    version: "test-1",
    balance: 12,
  };
  const options = () => ({
    hosted: {
      configured: true,
      priceCredits: seen.price,
      pricingVersion: seen.version,
      purchasesEnabled: false,
    },
    byok: {
      configured: true,
      providers: ["openai", "gateway"],
      sessionOnly: true,
    },
    chatgpt: { signInConfigured: false, planConfigured: false },
    balance: seen.balance,
    recentRequests: [],
  });
  await page.route(
    "https://srwzgwodlpylezdaipce.supabase.co/**",
    async (route: Route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/user")) return route.fulfill({ json: user });
      if (path.endsWith("/northline_workspaces")) {
        if (request.method() !== "GET") seen.writes++;
        return route.fulfill({ json: { data: blankState() } });
      }
      if (path.endsWith("/financial-assistant")) {
        const body: unknown = request.postDataJSON();
        if (field(body, "action") !== "ask") return route.fulfill({ json: options() });
        seen.asks.push(body);
        // Subtraction coerces the credits exactly as Number() does.
        if (field(body, "mode") === "hosted") seen.balance -= Number(field(body, "priceCredits"));
        return route.fulfill({
          json: {
            answer: "Explanation ready. No financial entries were saved.",
            drafts: [],
            funding: {
              mode: field(body, "mode"),
              chargedCredits: field(body, "mode") === "hosted" ? field(body, "priceCredits") : 0,
            },
          },
        });
      }
      return route.fulfill({ json: {} });
    },
  );
  await page.goto("/#/app/capture");
  await expect(
    page.getByRole("heading", { name: "Money assistant", exact: true }),
  ).toBeVisible();
  return seen;
}

test("BYOK requires consent, leaves no stored key and cannot write a financial record", async ({
  page,
}) => {
  const seen = await signedIn(page);
  await page.getByLabel("Assistant mode").selectOption("byok");
  await page
    .getByLabel("Your API key (this session only)")
    .fill("sk-session-test-key-never-store-000000");
  await page.getByLabel("Your model ID").fill("account-model");
  await page.getByLabel("Ask the money assistant").fill("Explain my budget");
  await page.getByLabel("Permission for cloud processing").selectOption("yes");
  await page
    .getByRole("button", { name: "Ask assistant", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Accept the selected AI usage charges",
  );
  expect(seen.asks).toHaveLength(0);
  await page.getByLabel("Accept AI usage charges").selectOption("yes");
  await page
    .getByRole("button", { name: "Ask assistant", exact: true })
    .click();
  await expect(
    page.getByText("Explanation ready. No financial entries were saved.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(seen.asks).toHaveLength(1);
  expect(field(seen.asks[0], "mode")).toBe("byok");
  expect(seen.asks[0]).not.toHaveProperty("summary");
  expect(seen.asks[0]).not.toHaveProperty("priceCredits");
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("sk-session-test-key");
  await page.getByLabel("Assistant mode").selectOption("local");
  await page.getByLabel("Assistant mode").selectOption("byok");
  await expect(page.getByLabel("Your API key (this session only)")).toHaveValue(
    "",
  );
  expect(seen.writes).toBe(0);
});

test("hosted price changes reset acceptance and ChatGPT setup never falls back to paid AI", async ({
  page,
}) => {
  const seen = await signedIn(page);
  await page.getByLabel("Assistant mode").selectOption("hosted");
  await expect(
    page.getByText("Prepaid AI credits: 12", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Accept AI usage charges").selectOption("yes");
  seen.price = 4;
  seen.version = "test-2";
  await page
    .getByRole("button", { name: "Refresh AI balance", exact: true })
    .click();
  await expect(page.getByLabel("Accept AI usage charges")).toHaveValue("no");
  await page.getByLabel("Permission for cloud processing").selectOption("yes");
  await page.getByLabel("Ask the money assistant").fill("Explain income");
  await page.getByLabel("Accept AI usage charges").selectOption("yes");
  await page
    .getByRole("button", { name: "Ask assistant", exact: true })
    .click();
  await expect(
    page.getByText("Prepaid AI credits: 8", { exact: true }),
  ).toBeVisible();
  expect(field(seen.asks[0], "priceCredits")).toBe(4);
  expect(field(seen.asks[0], "pricingVersion")).toBe("test-2");
  expect(field(seen.asks[0], "requestId")).toMatch(/^[a-f0-9-]{36}$/);
  expect(seen.asks[0]).not.toHaveProperty("apiKey");
  await page.getByLabel("Assistant mode").selectOption("chatgpt");
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Ask assistant", exact: true }),
  ).toBeDisabled();
  expect(seen.asks).toHaveLength(1);
  expect(seen.writes).toBe(0);
});

test("login offers the ChatGPT foundation with an honest unavailable state", async ({
  page,
}) => {
  await page.route("**/functions/v1/financial-assistant", (route) =>
    route.fulfill({ json: { chatgpt: { signInConfigured: false } } }),
  );
  await page.goto("/#/login");
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "ChatGPT sign-in is awaiting OpenAI approval and setup. Google and email are available.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeEnabled();
});
