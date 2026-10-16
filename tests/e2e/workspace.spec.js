import {test,expect} from '@playwright/test';
test('protected route redirects; demo entry, transaction persistence, budgets, goals, and export work',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/app/overview');await expect(page).toHaveURL(/login/);await expect(page.getByRole('heading',{name:'Welcome to FinancialAdvisor.'})).toBeVisible();
 await page.getByRole('link',{name:'Explore the demo'}).click();await expect(page.getByRole('heading',{name:'A clearer picture, Fatima.'})).toBeVisible();
 await page.screenshot({path:'artifacts/northline-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Add transaction',exact:true}).click();
 await page.getByLabel('Amount (BHD)',{exact:true}).fill('0.001');await page.getByLabel('Description').fill('Browser test groceries');await page.getByLabel('Category',{exact:true}).selectOption('Food & drink');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('link',{name:'Transactions',exact:true}).click();await page.getByRole('textbox',{name:'Search transactions'}).fill('Browser test');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody')).toContainText('0.001');
 await page.reload();await page.getByRole('textbox',{name:'Search transactions'}).fill('Browser test');await expect(page.locator('tbody')).toContainText('Browser test groceries');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/financial-advisor-.*csv/);const stream=await file.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;expect(csv).toContain('Amount (BHD),Currency');expect(csv).toContain('"0.001","BHD"');
 await page.getByRole('link',{name:'Budgets',exact:true}).click();await page.getByRole('button',{name:'Set a budget'}).click();await page.getByLabel('Category',{exact:true}).selectOption('Health');await page.getByLabel('Monthly spending limit (BHD)').fill('300');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.wide-budget')).toContainText('Health');
 await page.getByRole('link',{name:'Goals',exact:true}).click();await page.getByRole('button',{name:'New goal'}).click();await page.getByLabel('Goal name').fill('New bicycle');await page.getByLabel('Target amount (BHD)').fill('800');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Update New bicycle progress'}).click();await page.getByLabel('Total saved so far (BHD)').fill('200');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.goal-card').filter({hasText:'New bicycle'})).toContainText('25%');
 expect(errors).toEqual([]);
});
test('mobile navigation is usable without page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#/demo/overview');
 await expect(page.getByRole('heading',{name:'A clearer picture, Fatima.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/northline-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('link',{name:'Accounts',exact:true}).click();await expect(page.getByRole('heading',{name:'A home for your money.'})).toBeVisible();
});

test('Bahrain settings are fixed, old demo data is retained, and dates ignore device timezone',async({browser})=>{
 const context=await browser.newContext({timezoneId:'America/Los_Angeles'});
 const page=await context.newPage();
 await page.clock.setFixedTime(new Date('2026-10-31T21:30:00Z'));
 await page.addInitScript(()=>localStorage.setItem('northline-demo',JSON.stringify({currency:'USD',accounts:[{balance:100}]})));
 await page.goto('/#/demo/overview');
 await expect(page.getByLabel('Selected month')).toHaveValue('2026-11');
 await expect(page.locator('.balance .stat-number')).toContainText('BHD');
 await page.getByRole('button',{name:'Add transaction',exact:true}).click();
 await expect(page.getByLabel('Date',{exact:true})).toHaveValue('2026-11-01');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('link',{name:'Settings',exact:true}).click();
 await expect(page.locator('.regional-settings')).toContainText('Bahrain');
 await expect(page.locator('.regional-settings')).toContainText('Bahraini dinar (BHD)');
 await expect(page.locator('#currency')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('northline-demo')).currency)).toBe('USD');
 await context.close();
});
