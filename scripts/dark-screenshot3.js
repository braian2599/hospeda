const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // Login
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('admin123');
    const btns = await page.$$('button');
    for (const b of btns) {
      const txt = await b.textContent();
      if (txt && txt.includes('Ingresar')) { await b.click(); break; }
    }
    await page.waitForTimeout(3000);
  }
  
  // Set dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  
  // Reservas
  const allElements = await page.$$('*');
  for (const el of allElements) {
    const txt = await el.textContent();
    if (txt && txt.trim() === 'Reservas') {
      await el.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/home/z/my-project/download/dark-reservas.png', fullPage: false });
      console.log('Reservas OK');
      break;
    }
  }
  
  // Check-in
  const allElements2 = await page.$$('*');
  for (const el of allElements2) {
    const txt = await el.textContent();
    if (txt && txt.trim() === 'Check-in') {
      await el.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/home/z/my-project/download/dark-checkin.png', fullPage: false });
      console.log('Check-in OK');
      break;
    }
  }
  
  await browser.close();
  console.log('Done');
})();
