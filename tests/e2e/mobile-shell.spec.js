import {test,expect} from '@playwright/test';

test('Ionic tabs navigate on mobile and notifications explain native availability',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/demo/overview');
  await expect(page.locator('ion-app')).toHaveCount(1);
  const tabs=page.locator('ion-tab-bar');await expect(tabs).toBeVisible();
  await tabs.locator('ion-tab-button[tab="calendar"]').click();
  await expect(page).toHaveURL(/demo\/calendar/);await expect(page.locator('.calendar-grid')).toBeVisible();
  await tabs.locator('ion-tab-button[tab="more"]').click();
  await page.getByRole('link',{name:'Settings',exact:true}).click();
  await expect(page.locator('.notification-settings')).toContainText('Mobile app feature');
  await expect(page.locator('.notification-settings')).toContainText('installed mobile app');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
