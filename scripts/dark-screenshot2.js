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
  
  // Set dark mode directly on HTML and in store
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    try {
      const s = JSON.parse(localStorage.getItem('hospeda-storage') || '{}');
      if (s.state) {
        if (!s.state.usuarioPreferencias) s.state.usuarioPreferencias = {};
        s.state.usuarioPreferencias.tema = 'oscuro';
        localStorage.setItem('hospeda-storage', JSON.stringify(s));
      }
    } catch(e) {}
  });
  
  // Dashboard
  await page.screenshot({ path: '/home/z/my-project/download/dark-dashboard.png', fullPage: false });
  console.log('Dashboard OK');
  
  // Find and click Limpieza in sidebar
  const allElements = await page.$$('*');
  for (const el of allElements) {
    const txt = await el.textContent();
    if (txt && txt.trim() === 'Limpieza') {
      await el.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/home/z/my-project/download/dark-limpieza.png', fullPage: false });
      console.log('Limpieza OK');
      break;
    }
  }
  
  // Find and click Habitaciones
  const allElements2 = await page.$$('*');
  for (const el of allElements2) {
    const txt = await el.textContent();
    if (txt && txt.trim() === 'Habitaciones') {
      await el.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/home/z/my-project/download/dark-habitaciones.png', fullPage: false });
      console.log('Habitaciones OK');
      break;
    }
  }
  
  await browser.close();
  console.log('Done');
})();
