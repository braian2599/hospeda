const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  // Login first
  const page = await context.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // Debug: check what's on the page
  const html = await page.content();
  const hasInput = html.includes('input');
  console.log('Page has input:', hasInput);
  
  // Try to find inputs
  const inputs = await page.$$('input');
  console.log('Found inputs:', inputs.length);
  
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('admin123');
    const btn = await page.$('button[type="submit"]');
    if (btn) {
      await btn.click();
    } else {
      const buttons = await page.$$('button');
      console.log('Found buttons:', buttons.length);
      if (buttons.length > 0) await buttons[0].click();
    }
    await page.waitForTimeout(3000);
    console.log('Logged in, URL:', page.url());
    
    // Set dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      const storage = JSON.parse(localStorage.getItem('hospeda-storage') || '{}');
      if (storage.state && storage.state.usuarioPreferencias) {
        storage.state.usuarioPreferencias.tema = 'oscuro';
      } else if (storage.state) {
        storage.state.usuarioPreferencias = { tema: 'oscuro' };
      } else {
        storage.state = { usuarioPreferencias: { tema: 'oscuro' } };
      }
      localStorage.setItem('hospeda-storage', JSON.stringify(storage));
    });
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Dashboard screenshot
    await page.screenshot({ path: '/home/z/my-project/download/dark-dashboard.png', fullPage: false });
    console.log('Dashboard screenshot taken');
    
    // Navigate to Limpieza - click sidebar item
    const sidebarItems = await page.$$('nav a, [data-modulo], button');
    for (const item of sidebarItems) {
      const text = await item.textContent();
      if (text && text.includes('Limpieza')) {
        await item.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: '/home/z/my-project/download/dark-limpieza.png', fullPage: false });
        console.log('Limpieza screenshot taken');
        break;
      }
    }
    
    // Navigate to Habitaciones
    for (const item of sidebarItems) {
      const text = await item.textContent();
      if (text && text.includes('Habitaciones')) {
        await item.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: '/home/z/my-project/download/dark-habitaciones.png', fullPage: false });
        console.log('Habitaciones screenshot taken');
        break;
      }
    }
  } else {
    // Maybe already logged in, just set dark mode
    console.log('No inputs found, trying direct navigation');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: '/home/z/my-project/download/dark-page.png', fullPage: false });
  }
  
  await browser.close();
  console.log('Done');
})();
