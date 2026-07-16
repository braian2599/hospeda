const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://127.0.0.1:3456';
const OUT = path.join(__dirname, '../public/screenshots');
const W = 1440, H = 900;

async function shot(page, file, opts = {}) {
  await page.waitForTimeout(opts.wait || 1500);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('scrollbar-width', 'none');
  });
  await page.screenshot({
    path: path.join(OUT, file),
    clip: opts.clip || { x: 0, y: 0, width: W, height: H },
  });
  console.log(`  ✓ ${file}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'es-AR' });

  // ─── 1. Login page ───
  console.log('1/5 Login...');
  const p1 = await ctx.newPage();
  await p1.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot(p1, 'login.png');
  await p1.close();

  // ─── 2. Register page ───
  console.log('2/5 Register...');
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await shot(p2, 'register.png');
  await p2.close();

  // ─── 3. Landing hero ───
  console.log('3/5 Landing hero...');
  const p3 = await ctx.newPage();
  await p3.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await shot(p3, 'landing-hero.png');
  await p3.close();

  // ─── 4. Landing features ───
  console.log('4/5 Landing features...');
  const p4 = await ctx.newPage();
  await p4.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p4.evaluate(() => document.getElementById('caracteristicas')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await shot(p4, 'landing-features.png', { wait: 2500 });
  await p4.close();

  // ─── 5. Landing plans ───
  console.log('5/5 Landing plans...');
  const p5 = await ctx.newPage();
  await p5.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p5.evaluate(() => document.getElementById('planes')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await shot(p5, 'landing-plans.png', { wait: 2500 });
  await p5.close();

  await browser.close();
  console.log('\nAll screenshots done!');
})().catch(e => { console.error(e); process.exit(1); });