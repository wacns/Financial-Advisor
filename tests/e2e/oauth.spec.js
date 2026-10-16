import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:5174";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "fatima@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "google" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
function token() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
}
test("Google PKCE redirect, callback, verified workspace, and sign-out with mocked Supabase", async ({
  page,
}) => {
  let authorize,
    exchanges = 0,
    userChecks = 0,
    workspaceReads = 0,
    workspaceWrites = 0;
  let workspace = {
    currency: "BHD",
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
  };
  await page.route("https://northline-test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith("/authorize")) {
      authorize = url;
      return route.fulfill({
        contentType: "text/html",
        body: "<p>Mock Google consent</p>",
      });
    }
    if (url.pathname.endsWith("/token")) {
      exchanges++;
      const data = request.postDataJSON();
      expect(url.searchParams.get("grant_type")).toBe("pkce");
      expect(data.auth_code).toBe("mock-google-code");
      expect(data.code_verifier.length).toBeGreaterThan(20);
      return route.fulfill({
        json: {
          access_token: token(),
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    }
    if (url.pathname.endsWith("/user")) {
      userChecks++;
      return route.fulfill({ json: user });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      expect(userChecks).toBeGreaterThan(0);
      if (request.method() === "POST") {
        const record = request.postDataJSON();
        expect(record.user_id).toBe(user.id);
        workspace = record.data;
        workspaceWrites++;
        return route.fulfill({ status: 201, json: {} });
      }
      workspaceReads++;
      expect(url.searchParams.get("user_id")).toBe(`eq.${user.id}`);
      return route.fulfill({ json: { data: workspace } });
    }
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204 });
    throw Error(`Unexpected Supabase endpoint: ${url.pathname}`);
  });
  await page.goto("/#/login");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page.getByText("Mock Google consent")).toBeVisible();
  expect(authorize.searchParams.get("provider")).toBe("google");
  expect(authorize.searchParams.get("redirect_to")).toBe(`${origin}/`);
  expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
  expect(authorize.searchParams.get("code_challenge").length).toBeGreaterThan(
    20,
  );
  await page.goto("/?code=mock-google-code");
  await expect(
    page.getByRole("heading", { name: "A clearer picture." }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${origin}/#/app/overview`);
  expect(exchanges).toBe(1);
  expect(workspaceReads).toBe(1);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Cloud project");
  await page.getByLabel("Project budget (BHD)").fill("100.001");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cloud project", exact: true }),
  ).toBeVisible();
  expect(workspaceWrites).toBe(1);
  expect(workspace.projects[0].budget).toBe(100.001);
  expect(workspace.recurring).toEqual([]);
  expect(workspace.debts).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cloud project", exact: true }),
  ).toBeVisible();
  await page.getByRole('link', {name:'Accounts', exact:true}).click();
  for (const name of ['Cloud current', 'Cloud savings']) {
    await page.getByRole('button', {name:'Add account', exact:true}).click();
    await page.getByLabel('Account name', {exact:true}).fill(name);
    await page.getByLabel('Current balance in BHD (negative for debt)').fill('100');
    await page.getByRole('button', {name:'Save', exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await page.getByRole('button', {name:'Record transfer', exact:true}).click();
  await page.getByLabel('Amount (BHD)', {exact:true}).fill('0.001');
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(workspace.accounts.map(a => a.balance)).toEqual([99.999, 100.001]);
  expect(workspace.transactions[0].type).toBe('transfer');
  await page.reload();
  await expect(page.locator('.account-detail').first()).toContainText('99.999');
  await page.getByRole('link', {name:'Calendar', exact:true}).click();
  await page.getByRole('button', {name:'New schedule', exact:true}).click();
  await page.getByLabel('Schedule name').fill('Cloud subscription');
  await page.getByLabel('Amount (BHD)', {exact:true}).fill('1.234');
  const dueDate = await page.getByLabel('Next due date').inputValue();
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator(`[data-calendar-date="${dueDate}"]`).click();
  await page.locator('.day-agenda').getByRole('button', {name:'Record payment', exact:true}).click();
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page.locator('.day-agenda')).toContainText('Recorded');
  expect(workspace.accounts[0].balance).toBe(98.765);
  expect(workspace.transactions.filter(t => t.recurringId)).toHaveLength(1);
  await page.reload();
  await expect(page.locator('.day-agenda')).toContainText('Recorded');
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to FinancialAdvisor." }),
  ).toBeVisible();
});
test("denied and expired OAuth callbacks display recoverable errors", async ({
  page,
}) => {
  await page.goto(
    "/?error=access_denied&error_description=sensitive-provider-detail",
  );
  await expect(page.locator("#auth-message")).toContainText("cancelled");
  await expect(page).toHaveURL(`${origin}/#/login`);
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeEnabled();
  await page.goto("/?code=expired-code");
  await expect(page.locator("#auth-message")).toContainText("expired");
  await expect(page).toHaveURL(`${origin}/#/login`);
});
