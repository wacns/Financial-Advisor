import { test, expect } from "@playwright/test";
import { demoState } from "../../src/finance.js";
import { normalizeWorkspace } from "../../src/domain/model.js";
async function seedDemo(page, input = demoState()) {
  const state = normalizeWorkspace(input);
  await page.addInitScript((value) => {
    if (!localStorage.getItem("northline-bh-demo-v1"))
      localStorage.setItem("northline-bh-demo-v1", JSON.stringify(value));
  }, state);
}
const modal = (p) => p.getByTestId("entry-dialog");
test("captured foreign-currency amounts follow the reviewed account currency", async ({
  page: p,
}) => {
  const input = demoState();
  input.accounts.push({
    id: "capture-usd",
    name: "Dollar cash",
    type: "Cash",
    currency: "USD",
    balance: 10,
  });
  await seedDemo(p, input);
  await p.goto("/#/demo/capture");
  await p
    .getByLabel("Payment messages or spoken text")
    .fill("Paid USD 1.001 at Cafe on 2026-10-19");
  await p.getByRole("button", { name: "Prepare drafts", exact: true }).click();
  await p.getByRole("button", { name: "Review entry 1", exact: true }).click();
  await expect(p.getByLabel("Account", { exact: true })).toHaveValue(
    "capture-usd",
  );
  await expect(p.getByLabel("Amount (USD)", { exact: true })).toHaveValue(
    "1.001",
  );
  await p.getByLabel("Account", { exact: true }).selectOption("current");
  await expect(p.getByLabel("Amount (BHD)", { exact: true })).toHaveValue(
    "1.001",
  );
  await modal(p).getByRole("button", { name: "Cancel", exact: true }).click();
  await p.reload();
  const unchanged = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  expect(unchanged.accounts.find((a) => a.id === "capture-usd").balance).toBe(
    10,
  );
});
test("text capture requires review, preserves precision and blocks duplicate saves", async ({
  page: p,
}) => {
  await seedDemo(p);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/#/demo/capture");
  await p
    .getByLabel("Payment messages or spoken text")
    .fill(
      "Paid BHD 1.001 at Capture Cafe on 2026-10-19. Available balance BHD 700",
    );
  const before = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  await p.getByRole("button", { name: "Prepare drafts", exact: true }).click();
  await expect(p.getByTestId("capture-draft")).toContainText("1.001 BHD");
  expect(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
    ),
  ).toEqual(before);
  await p.getByRole("button", { name: "Review entry 1", exact: true }).click();
  await expect(p.getByLabel("Amount (BHD)", { exact: true })).toHaveValue(
    "1.001",
  );
  await save(p);
  const after = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  expect(after.transactions.length).toBe(before.transactions.length + 1);
  await p.getByRole("button", { name: "Review entry 1", exact: true }).click();
  await modal(p).getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal(p)).toContainText("already recorded");
  expect(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
    ),
  ).toEqual(after);
  await modal(p).getByRole("button", { name: "Cancel", exact: true }).click();
  await p.getByLabel("Ask the money assistant").fill("How much did I spend?");
  await p.getByRole("button", { name: "Ask assistant", exact: true }).click();
  await expect(p.getByText(/You recorded .* in expenses/)).toBeVisible();
  expect(errors).toEqual([]);
});
test("exchange quote preview leaves saved rates untouched until explicit apply", async ({
  page: p,
}) => {
  await seedDemo(p);
  await p.route("https://open.er-api.com/**", (route) =>
    route.fulfill({
      json: {
        result: "success",
        base_code: "BHD",
        time_last_update_unix: Math.floor(Date.now() / 1000),
        rates: {
          BHD: 1,
          USD: 2.66,
          EUR: 2.3,
          GBP: 2,
          SAR: 9.97,
          AED: 9.77,
          KWD: 0.82,
          OMR: 1.02,
          QAR: 9.7,
          INR: 230,
        },
      },
    }),
  );
  await p.goto("/#/demo/currency");
  const before = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  await p
    .getByRole("button", { name: "Fetch latest quotes", exact: true })
    .click();
  await expect(
    p.getByRole("heading", { name: "Review exchange quotes", exact: true }),
  ).toBeVisible();
  expect(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
    ),
  ).toEqual(before);
  await p
    .getByRole("button", { name: "Apply reviewed rates", exact: true })
    .click();
  await expect(
    p.getByRole("heading", { name: "Review exchange quotes", exact: true }),
  ).toBeHidden();
  const after = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  expect(after.settings.rateHistory).toHaveLength(1);
  expect(after.accounts).toEqual(before.accounts);
  expect(after.transactions).toEqual(before.transactions);
});
async function save(p) {
  await modal(p).getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal(p)).toBeHidden();
}
test("contacts, custom tags, transaction pinning and search survive a reload", async ({
  page: p,
}) => {
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/#/demo/contacts");
  await p
    .getByRole("button", { name: "New payee or payer", exact: true })
    .click();
  await p.getByLabel("Contact name", { exact: true }).fill("Blue Pearl Market");
  await save(p);
  await p.goto("/#/demo/tags");
  await p.getByRole("button", { name: "New tag", exact: true }).click();
  await p.getByLabel("Tag name", { exact: true }).fill("Trip 2026");
  await save(p);
  await p.goto("/#/demo/transactions");
  await p.getByRole("button", { name: "Add transaction", exact: true }).click();
  await p.getByLabel("Description", { exact: true }).fill("Travel groceries");
  await p.getByLabel("Amount (BHD)", { exact: true }).fill("1.001");
  await p
    .getByLabel("Payee / payer (optional)")
    .selectOption({ label: "Blue Pearl Market" });
  await p.getByLabel("Labels (comma separated, optional)").fill("Trip 2026");
  await p.getByLabel("Location (optional)").fill("Manama");
  await save(p);
  await p.getByLabel("Search transactions").fill("Pearl Manama");
  await expect(p.getByTestId("transaction-row")).toHaveCount(1);
  await p
    .getByRole("button", { name: "Pin Travel groceries", exact: true })
    .click();
  await expect(
    p.getByRole("heading", { name: "Pinned", exact: true }),
  ).toBeVisible();
  await p.reload();
  await p.getByLabel("Search transactions").fill("Travel groceries");
  await expect(
    p.getByRole("button", { name: "Unpin Travel groceries", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("subscription manual payment updates its calendar and history without posting an expense", async ({
  page: p,
}) => {
  await p.goto("/#/demo/subscriptions");
  await p
    .getByRole("button", { name: "New subscription", exact: true })
    .click();
  await p
    .getByLabel("Subscription name", { exact: true })
    .fill("Quarterly storage");
  await p.getByLabel("Payment amount", { exact: true }).fill("6");
  await p.getByLabel("Repeat every (frequency units)").fill("3");
  await p.getByLabel("First due date").fill("2026-01-31");
  await save(p);
  const before = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  await p
    .getByRole("button", { name: "Record subscription payment", exact: true })
    .click();
  await p.getByLabel("How to record payment").selectOption("manual");
  await save(p);
  const after = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  expect(after.transactions).toEqual(before.transactions);
  expect(after.accounts).toEqual(before.accounts);
  await p
    .getByRole("button", { name: "Schedule & payment history", exact: true })
    .click();
  await expect(
    p.getByText("Marked paid — no transaction", { exact: true }),
  ).toBeVisible();
  await expect(p.getByTestId("subscription-card")).toContainText("2.000");
  await p.reload();
  await expect(p.getByTestId("subscription-card")).toContainText(
    "Quarterly storage",
  );
});
test("installment schedule records a reviewed expense and allows exact reversal", async ({
  page: p,
}) => {
  await p.goto("/#/demo/installments");
  await p.getByRole("button", { name: "New installment", exact: true }).click();
  await p.getByLabel("Installment plan name").fill("Desk plan");
  await p.getByLabel("Total purchase amount").fill("1");
  await p.getByLabel("Number of installments").fill("3");
  await p.getByLabel("First due date").fill("2026-01-31");
  await save(p);
  await p
    .getByRole("button", { name: "Record installment payment", exact: true })
    .click();
  await expect(p.getByLabel("Actual cash amount")).toHaveValue("0.333");
  await save(p);
  await expect(p.getByTestId("installment-card")).toContainText("1 / 3 paid");
  await p
    .getByRole("button", { name: "Schedule & payment history", exact: true })
    .click();
  await p.getByRole("button", { name: "Reverse payment", exact: true }).click();
  await modal(p).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(modal(p)).toBeHidden();
  await expect(p.getByTestId("installment-card")).toContainText("0 / 3 paid");
});
test("new organization and commitment screens fit a small phone", async ({
  page: p,
}) => {
  await p.setViewportSize({ width: 360, height: 780 });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "contacts",
    "tags",
    "subscriptions",
    "installments",
    "transactions",
    "insights",
  ]) {
    await p.goto(`/#/demo/${route}`);
    await expect(
      p.getByText("FinancialAdvisor", { exact: true }).first(),
    ).toBeVisible();
    await expect
      .poll(() => p.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(360);
  }
  expect(errors).toEqual([]);
});
test("shared account UI respects viewer access and routes editor writes through scoped RPC", async ({
  page: p,
}) => {
  const uid = "11111111-1111-4111-8111-111111111111",
    accountId = "22222222-2222-4222-8222-222222222222";
  let role = "viewer",
    rows = [],
    workspaceWrites = 0;
  const user = {
    id: uid,
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const access = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  await p.addInitScript(
    ({ access, user }) =>
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
  await p.route(
    "https://srwzgwodlpylezdaipce.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
      if (url.pathname.endsWith("/northline_workspaces")) {
        if (request.method() === "POST") workspaceWrites++;
        return route.fulfill({
          json: {
            data: {
              currency: "BHD",
              accounts: [],
              transactions: [],
              budgets: [],
              goals: [],
            },
          },
        });
      }
      if (url.pathname.endsWith("/rpc/fa_shared")) {
        const { p_action, p_data } = request.postDataJSON();
        const account = {
          id: accountId,
          name: "Household",
          currency: "BHD",
          owner_id: "33333333-3333-4333-8333-333333333333",
          role,
          archived: false,
          revision: 0,
          balance: 10 - rows.reduce((n, t) => n + Number(t.amount), 0),
        };
        if (p_action === "list") return route.fulfill({ json: [account] });
        if (p_action === "snapshot")
          return route.fulfill({
            json: {
              account,
              members: [{ user_id: uid, role, display_name: "Test member" }],
              transactions: rows,
              activity: [],
              invites: [],
            },
          });
        if (p_action === "save_transaction") {
          expect(p_data.account_id).toBe(accountId);
          expect(p_data).not.toHaveProperty("owner_id");
          rows = [{ ...p_data, actor_id: uid, revision: 1 }];
          return route.fulfill({ json: { id: accountId } });
        }
        throw Error(`Unexpected shared action: ${p_action}`);
      }
      return route.fulfill({ status: 200, json: {} });
    },
  );
  await p.goto("/#/app/shared-accounts");
  await p.getByLabel("Shared account", { exact: true }).selectOption(accountId);
  await expect(p.getByTestId("shared-account-detail")).toContainText("viewer");
  await expect(
    p.getByRole("button", { name: "Add shared transaction", exact: true }),
  ).toHaveCount(0);
  expect(workspaceWrites).toBe(0);
  role = "editor";
  await p
    .getByRole("button", { name: "Refresh shared accounts", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Add shared transaction", exact: true }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Add shared transaction", exact: true })
    .click();
  await p.getByLabel("Shared description").fill("Shared coffee");
  await p.getByLabel("Shared amount (BHD)").fill("0.001");
  await save(p);
  await expect(p.getByText("Shared coffee", { exact: true })).toBeVisible();
  expect(workspaceWrites).toBe(0);
});
