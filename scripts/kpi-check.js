const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 400 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('admin123');
    for (const b of await page.$$('button')) {
      if ((await b.textContent())?.includes('Ingresar')) { await b.click(); break; }
    }
    await page.waitForTimeout(3000);
  }
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(500);
  const kpiGrid = await page.$('.grid.grid-cols-2');
  if (kpiGrid) await kpiGrid.screenshot({ path: '/home/z/my-project/download/kpi-fill-check.png' });
  else await page.screenshot({ path: '/home/z/my-project/download/kpi-fill-check.png' });
  await browser.close();
  console.log('Done');
})();
