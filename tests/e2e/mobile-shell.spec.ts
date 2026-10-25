import { test, expect } from "@playwright/test";

test("shared React mobile tabs navigate and notifications explain native availability", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/demo/overview");
  await expect(page.locator("ion-app")).toHaveCount(0);
  const tabs = page.getByTestId("mobile-tabs");
  await expect(tabs).toBeVisible();
  await tabs.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/demo\/calendar/);
  await expect(page.getByTestId("calendar-grid")).toBeVisible();
  await tabs.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("notification-settings")).toContainText(
    "Mobile app feature",
  );
  await expect(page.getByTestId("notification-settings")).toContainText(
    "installed mobile app",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
