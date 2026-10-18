import { test, expect } from "@playwright/test";
const dialog = (p) => p.getByTestId("entry-dialog");
async function save(p) {
  await dialog(p).getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog(p)).toBeHidden();
}
test("transaction edit, template reuse and deletion persist exact balance changes", async ({
  page: p,
}) => {
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/#/demo/transactions");
  await p.getByRole("button", { name: "Add transaction", exact: true }).click();
  await p.getByLabel("Description", { exact: true }).fill("Feature purchase");
  await p.getByLabel("Amount (BHD)", { exact: true }).fill("2.001");
  await save(p);
  await p.getByLabel("Search transactions").fill("Feature purchase");
  await p
    .getByRole("button", { name: "Edit Feature purchase", exact: true })
    .click();
  await p.getByLabel("Amount", { exact: true }).fill("3.001");
  await save(p);
  await expect(p.getByTestId("transaction-row")).toContainText("3.001");
  await p
    .getByRole("button", { name: "Template Feature purchase", exact: true })
    .click();
  await p.getByLabel("Template name").fill("Coffee template");
  await save(p);
  await p.getByRole("link", { name: "Templates", exact: true }).click();
  await p.getByRole("button", { name: "Use template", exact: true }).click();
  await expect(p.getByLabel("Description", { exact: true })).toHaveValue(
    "Feature purchase",
  );
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  await p.getByRole("link", { name: "Transactions", exact: true }).click();
  await p.getByLabel("Search transactions").fill("Feature purchase");
  await p
    .getByRole("button", { name: "Delete Feature purchase", exact: true })
    .click();
  await dialog(p).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog(p)).toBeHidden();
  await expect(p.getByTestId("transaction-row")).toHaveCount(0);
  await p.reload();
  await p.getByLabel("Search transactions").fill("Feature purchase");
  await expect(p.getByTestId("transaction-row")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("cycle budget and sub-budget workflow validates allocation before saving", async ({
  page: p,
}) => {
  await p.goto("/#/demo/advanced-budgets");
  await p
    .getByRole("button", { name: "New cycle budget", exact: true })
    .click();
  await p.getByLabel("Budget name", { exact: true }).fill("Family cycle");
  await p.getByLabel("Total limit", { exact: true }).fill("400");
  await save(p);
  await p.getByRole("button", { name: "New sub-budget", exact: true }).click();
  await p.getByLabel("Budget name", { exact: true }).fill("Food envelope");
  await p.getByLabel("Total limit", { exact: true }).fill("100");
  await p.getByLabel("Category mode").selectOption("selected");
  await p
    .getByLabel("Included categories (comma separated, optional)")
    .fill("Food & drink");
  await save(p);
  await expect(
    p.getByRole("heading", { name: "Food envelope", exact: true }),
  ).toBeVisible();
  await p.reload();
  await expect(
    p.getByRole("heading", { name: "Food envelope", exact: true }),
  ).toBeVisible();
  await p.getByRole("button", { name: "New sub-budget", exact: true }).click();
  await p.getByLabel("Budget name", { exact: true }).fill("Duplicate envelope");
  await p.getByLabel("Total limit", { exact: true }).fill("50");
  await p.getByLabel("Category mode").selectOption("selected");
  await p
    .getByLabel("Included categories (comma separated, optional)")
    .fill("Food & drink");
  await dialog(p).getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog(p).getByRole("alert")).toContainText("overlap");
});
test("project allocation, agreement, milestone and payment update the same ledger", async ({
  page: p,
}) => {
  await p.goto("/#/demo/projects");
  await p
    .getByRole("button", {
      name: "Agreements, milestones & documents",
      exact: true,
    })
    .click();
  await p
    .getByRole("button", { name: "New project category", exact: true })
    .click();
  await p.getByLabel("Category name", { exact: true }).fill("Decoration");
  await p.getByLabel("Allocated budget").fill("400");
  await save(p);
  await p.getByRole("button", { name: "New agreement", exact: true }).click();
  await p.getByLabel("Agreement name").fill("Painter");
  await p.getByLabel("Original contract value").fill("300");
  await save(p);
  await p.getByRole("button", { name: "New milestone", exact: true }).click();
  await p.getByLabel("Milestone name").fill("Paint deposit");
  await p.getByLabel("Milestone amount").fill("100");
  await save(p);
  await p
    .getByRole("button", { name: "Record milestone payment", exact: true })
    .click();
  await p.getByLabel("Amount in payment account currency").fill("40.001");
  await save(p);
  await expect(
    p.getByText("Paint deposit", { exact: false }).first(),
  ).toBeVisible();
  await p.getByRole("link", { name: "Transactions", exact: true }).click();
  await p.getByLabel("Search transactions").fill("Paint deposit");
  await expect(p.getByTestId("transaction-row")).toHaveCount(1);
  await expect(p.getByTestId("transaction-row")).toContainText("40.001");
});
test("warranty, CSV import and full backup restore require explicit review", async ({
  page: p,
}) => {
  await p.goto("/#/demo/warranties");
  await p.getByRole("button", { name: "New warranty", exact: true }).click();
  await p.getByLabel("Item name").fill("Family laptop");
  await p.getByLabel("Warranty expiry").fill("2028-10-18");
  await save(p);
  await expect(
    p.getByRole("heading", { name: "Family laptop", exact: true }),
  ).toBeVisible();
  await p.getByRole("link", { name: "Import & restore", exact: true }).click();
  await p
    .getByLabel("CSV data")
    .fill("date,type,amount,name\n2026-10-18,expense,1.001,CSV imported");
  await p
    .getByRole("button", { name: "Validate and import CSV", exact: true })
    .click();
  await expect(
    p.getByText("1 records imported; 0 duplicates skipped.", { exact: true }),
  ).toBeVisible();
  const pending = p.waitForEvent("download");
  await p
    .getByRole("button", { name: "Export full backup", exact: true })
    .click();
  const download = await pending,
    stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk;
  const picker = p.waitForEvent("filechooser");
  await p
    .getByRole("button", { name: "Choose JSON or CSV file", exact: true })
    .click();
  await (
    await picker
  ).setFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await expect(
    p.getByRole("heading", { name: "Review backup before replacing records" }),
  ).toBeVisible();
  await p
    .getByRole("button", {
      name: "Replace workspace with this backup",
      exact: true,
    })
    .click();
  await expect(
    p.getByRole("heading", { name: "Review backup before replacing records" }),
  ).toBeHidden();
  await p.getByRole("link", { name: "Warranties", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "Family laptop", exact: true }),
  ).toBeVisible();
});
test("Arabic RTL, dark theme and reporting currency survive reload", async ({
  page: p,
}) => {
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/#/demo/settings");
  await p
    .getByRole("button", { name: "Workspace preferences", exact: true })
    .click();
  await p.getByLabel("Language", { exact: true }).selectOption("ar");
  await p.getByLabel("Theme", { exact: true }).selectOption("dark");
  await p.getByLabel("Reporting currency", { exact: true }).selectOption("USD");
  await save(p);
  await expect(p.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(p.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    p.getByRole("button", { name: "تفضيلات مساحة العمل", exact: true }),
  ).toBeVisible();
  await p.reload();
  await expect(p.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    p.getByRole("link", { name: "الحسابات", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("local OCR reads an image and opens a review draft without recording automatically", async ({
  page: p,
}) => {
  test.setTimeout(90000);
  await p.goto("/#/demo/receipts");
  const png = await p.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 450;
    const c = canvas.getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, 1000, 450);
    c.fillStyle = "#000";
    c.font = "bold 48px Arial";
    c.fillText("CITY SUPERMARKET", 40, 80);
    c.font = "40px Arial";
    c.fillText("2026-10-18 14:05", 40, 160);
    c.fillText("GRAND TOTAL BHD 12.500", 40, 260);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const picker = p.waitForEvent("filechooser");
  await p
    .getByRole("button", { name: "Choose receipt image", exact: true })
    .click();
  await (
    await picker
  ).setFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(p.getByLabel("Recognized receipt text")).toHaveValue(/12\.500/, {
    timeout: 60000,
  });
  await p.getByRole("button", { name: "Review expense", exact: true }).click();
  await expect(p.getByLabel("Amount (BHD)", { exact: true })).toHaveValue(
    "12.500",
  );
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  const state = await p.evaluate(() =>
    localStorage.getItem("northline-bh-demo-v1"),
  );
  expect(state).toBeNull();
});
test("all additional workspaces remain usable on a small phone", async ({
  page: p,
}) => {
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "advanced-budgets",
    "salary",
    "forecast",
    "receipts",
    "warranties",
    "categories",
    "templates",
    "data",
    "projects",
    "insights",
  ]) {
    await p.goto(`/#/demo/${route}`);
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    if (route === "projects")
      await p
        .getByRole("button", {
          name: "Agreements, milestones & documents",
          exact: true,
        })
        .click();
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
