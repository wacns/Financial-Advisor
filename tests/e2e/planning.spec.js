import { test, expect } from "@playwright/test";

test("bills and salary can be scheduled, recorded, paused, edited and restored on reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2027-01-31T10:00:00Z"));
  await page.goto("/#/demo/bills");
  await page.getByRole("button", { name: "New schedule", exact: true }).click();
  await page.getByLabel("Schedule name").fill("Test internet");
  await page.getByLabel("Amount (BHD)", { exact: true }).fill("12.345");
  await page.getByLabel("Next due date").fill("2027-01-31");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const bill = page.locator("[data-testid=schedule-row]").filter({
    has: page.getByRole("heading", { name: "Test internet", exact: true }),
  });
  await bill
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(bill).toContainText("28 Feb 2027");
  await page
    .getByRole("button", { name: "Pause Test internet", exact: true })
    .click();
  await expect(
    bill.getByRole("button", { name: "Record payment", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Resume Test internet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Test internet", exact: true })
    .click();
  await page.getByLabel("Amount (BHD)", { exact: true }).fill("15.001");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(bill).toContainText("15.001");
  await expect(bill).toContainText("28 Feb 2027");
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page.getByLabel("Search transactions").fill("Test internet");
  await expect(page.locator("[data-testid=transaction-row]")).toHaveCount(1);
  await expect(page.locator("[data-testid=transaction-list]")).toContainText(
    "12.345",
  );
  await page.getByRole("link", { name: "Bills & salary", exact: true }).click();
  await page.getByRole("button", { name: "New schedule", exact: true }).click();
  await page.getByLabel("Schedule name").fill("Test salary");
  await page.getByLabel("Direction").selectOption("income");
  await page.getByLabel("Amount (BHD)", { exact: true }).fill("1000.001");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const salary = page.locator("[data-testid=schedule-row]").filter({
    has: page.getByRole("heading", { name: "Test salary", exact: true }),
  });
  await salary
    .getByRole("button", { name: "Record income", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page.getByLabel("Search transactions").fill("Test salary");
  await expect(page.locator("[data-testid=transaction-list]")).toContainText(
    "1,000.001",
  );
  await expect(page.locator("[data-testid=positive]")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("loan repayments validate principal, preserve balances on failure, and persist payment history", async ({
  page,
}) => {
  await page.goto("/#/demo/debts");
  await page.getByRole("button", { name: "Add debt", exact: true }).click();
  await page.getByLabel("Debt name").fill("Test finance");
  await page.getByLabel("Outstanding principal (BHD)").fill("500");
  await page.getByLabel("Planned monthly payment (BHD)").fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const card = page.locator("[data-testid=debt-card]").filter({
    has: page.getByRole("heading", { name: "Test finance", exact: true }),
  });
  await card
    .getByRole("button", { name: "Record repayment", exact: true })
    .click();
  await page.getByLabel("Principal portion (BHD)").fill("101");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "cannot exceed the total",
  );
  await page.getByLabel("Principal portion (BHD)").fill("90.001");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.locator("[data-testid=plan-big-number]")).toContainText(
    "409.999",
  );
  await expect(page.locator("[data-testid=planning-history]")).toContainText(
    "90.001",
  );
  await page.reload();
  await expect(card.locator("[data-testid=plan-big-number]")).toContainText(
    "409.999",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/northline-debts.png",
    fullPage: true,
  });
});

test("project expenses count once, archived history remains, and mobile planning has no overflow", async ({
  page,
}) => {
  await page.goto("/#/demo/projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Test home");
  await page.getByLabel("Project budget (BHD)").fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const card = page.locator("[data-testid=project-card]").filter({
    has: page.getByRole("heading", { name: "Test home", exact: true }),
  });
  await card.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByLabel("Amount (BHD)", { exact: true }).fill("25.125");
  await page.getByLabel("Description").fill("New paint");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.locator("[data-testid=plan-big-number]")).toContainText(
    "25.125",
  );
  await expect(card).toContainText("74.875");
  await page
    .getByRole("button", { name: "Archive Test home", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Add expense", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(card).toContainText("25.125");
  await page
    .getByRole("button", { name: "Reopen Test home", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Add expense", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["bills", "debts", "projects"]) {
    await page.goto(`/#/demo/${route}`);
    await expect(page.locator('[aria-level="1"]')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/northline-projects-mobile.png",
    fullPage: true,
  });
});

test("an existing workspace with no planning arrays keeps its accounts and gains empty planners", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "northline-bh-demo-v1",
      JSON.stringify({
        currency: "BHD",
        accounts: [
          {
            id: "old",
            name: "Existing account",
            type: "Savings",
            balance: 123.456,
          },
        ],
        transactions: [],
        budgets: [],
        goals: [],
      }),
    ),
  );
  await page.goto("/#/demo/projects");
  await expect(
    page.getByRole("heading", { name: "A budget for your next chapter." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await expect(page.locator("[data-testid=account-detail]")).toContainText(
    "123.456",
  );
});
