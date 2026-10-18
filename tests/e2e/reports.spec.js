import { test, expect } from "@playwright/test";

const fixture = {
  currency: "BHD",
  accounts: [
    { id: "a", name: "Current", type: "Current account", balance: 100 },
    { id: "b", name: "Savings", type: "Savings", balance: 50 },
  ],
  transactions: [
    {
      id: "salary",
      name: "Salary",
      type: "income",
      amount: 1000,
      category: "Income",
      date: "2026-10-14",
      accountId: "a",
    },
    {
      id: "food",
      name: "Coffee",
      type: "expense",
      amount: 2.345,
      category: "Food & drink",
      date: "2026-10-15",
      accountId: "a",
    },
    {
      id: "home",
      name: "Home supplies",
      type: "expense",
      amount: 10,
      category: "Home",
      date: "2026-10-15",
      accountId: "b",
    },
  ],
  budgets: [{ id: "budget", category: "Food & drink", limit: 20 }],
  goals: [],
  debts: [],
  projects: [],
  recurring: [
    {
      id: "bill",
      name: "Weekly bill",
      type: "expense",
      category: "Utilities",
      amount: 2,
      accountId: "a",
      frequency: "weekly",
      nextDue: "2026-10-20",
      anchorDay: 20,
      anchorMonth: 10,
      paused: false,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-16T10:00:00Z"));
  await page.addInitScript((data) => {
    if (!localStorage.getItem("northline-bh-demo-v1"))
      localStorage.setItem("northline-bh-demo-v1", JSON.stringify(data));
  }, fixture);
});

test("recording a transfer persists both balances, appears for both accounts and exports its destination", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/demo/accounts");
  await page
    .getByRole("button", { name: "Record transfer", exact: true })
    .click();
  await page.getByLabel("Amount (BHD)", { exact: true }).fill("0.001");
  await page.getByLabel("To account", { exact: true }).selectOption("a");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("different accounts");
  await page.getByLabel("To account", { exact: true }).selectOption("b");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page
      .locator("[data-testid=account-detail]")
      .filter({
        has: page.getByRole("heading", { name: "Current", exact: true }),
      }),
  ).toContainText("99.999");
  await expect(
    page
      .locator("[data-testid=account-detail]")
      .filter({
        has: page.getByRole("heading", { name: "Savings", exact: true }),
      }),
  ).toContainText("50.001");
  await expect(page.locator("[data-testid=account-total]")).toContainText(
    "150.000",
  );
  await page.reload();
  await expect(
    page.locator("[data-testid=account-detail]").first(),
  ).toContainText("99.999");
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page
    .getByLabel("Transaction type", { exact: true })
    .selectOption("transfer");
  for (const accountId of ["a", "b"]) {
    await page
      .getByLabel("Transaction account", { exact: true })
      .selectOption(accountId);
    await expect(page.locator("[data-testid=transaction-row]")).toHaveCount(1);
    await expect(page.locator("[data-testid=transaction-list]")).toContainText(
      "Current → Savings",
    );
  }
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const stream = await (await downloaded).createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk;
  expect(csv).toContain('"transfer","0.001","BHD","Current","Savings"');
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.locator("[data-testid=stats-grid]")).toContainText(
    "1,000.000",
  );
  await expect(page.locator("[data-testid=stats-grid]")).toContainText(
    "12.345",
  );
  expect(errors).toEqual([]);
});

test("account-specific reports and month changes show the right recorded totals", async ({
  page,
}) => {
  await page.goto("/#/demo/insights");
  await expect(page.locator("[data-testid=report-stats]")).toContainText(
    "12.345",
  );
  await expect(page.locator("[data-testid=spending-legend]")).toContainText(
    "Home",
  );
  await page.getByLabel("Report account", { exact: true }).selectOption("a");
  await expect(page.locator("[data-testid=report-stats]")).toContainText(
    "2.345",
  );
  await expect(page.locator("[data-testid=spending-legend]")).not.toContainText(
    "Home",
  );
  await page.getByLabel("Report account", { exact: true }).selectOption("b");
  await expect(page.locator("[data-testid=report-stats]")).toContainText(
    "10.000",
  );
  await expect(page.locator("[data-testid=spending-legend]")).not.toContainText(
    "Food & drink",
  );
  await page.getByLabel("Selected month").fill("2026-09");
  await expect(page.locator("[data-testid=spending-legend]")).toContainText(
    "Record an expense",
  );
  await page.getByLabel("Selected month").fill("2026-10");
  await page.getByRole("heading", { name: "Your last six months" }).isVisible();
  await expect(page.locator("[data-testid=trend-row]")).toHaveCount(6);
});

test("calendar projections are read-only and recording the next occurrence retains history after reload", async ({
  page,
}) => {
  await page.goto("/#/demo/calendar");
  await page.locator("[data-testid=calendar-2026-10-27]").click();
  await expect(page.locator("[data-testid=day-agenda]")).toContainText(
    "Projected",
  );
  await expect(
    page
      .locator("[data-testid=day-agenda]")
      .getByRole("button", { name: "Record payment" }),
  ).toHaveCount(0);
  await page.locator("[data-testid=calendar-2026-10-20]").click();
  await page
    .locator("[data-testid=day-agenda]")
    .getByRole("button", { name: "Record payment" })
    .click();
  await page.getByLabel("Actual amount (BHD)").fill("2.345");
  await page.getByLabel("Payment date").fill("2026-10-20");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("[data-testid=day-agenda]")).toContainText(
    "Recorded",
  );
  await expect(page.locator("[data-testid=day-agenda]")).toContainText("2.345");
  await page.reload();
  await page.locator("[data-testid=calendar-2026-10-20]").click();
  await expect(page.locator("[data-testid=day-agenda]")).toContainText(
    "Recorded",
  );
  await page.locator("[data-testid=calendar-2026-10-27]").click();
  await expect(
    page
      .locator("[data-testid=day-agenda]")
      .getByRole("button", { name: "Record payment" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.getByLabel("Selected month")).toHaveValue("2026-11");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByLabel("Selected month")).toHaveValue("2026-10");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-bh-demo-v1")),
  );
  expect(saved.accounts[0].balance).toBe(97.655);
  expect(
    saved.transactions.filter((t) => t.recurringId === "bill"),
  ).toHaveLength(1);
});

test("new screens and transfer entry remain usable on small phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "overview",
    "calendar",
    "insights",
    "transactions",
    "accounts",
  ]) {
    await page.goto(`/#/demo/${route}`);
    await expect(page.locator('[aria-level="1"]')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Record transfer", exact: true })
    .click();
  await expect(page.getByLabel("From account", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
