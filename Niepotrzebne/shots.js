const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: __dirname + '/s-menu.png' });
  for (const v of ['stadion', 'gzowo', 'maczka', 'dach']) {
    await page.evaluate(v => { window.tennis.setVenue(v); window.tennis.startMatch(); }, v);
    await page.waitForTimeout(5500);
    await page.screenshot({ path: __dirname + `/s-${v}.png` });
  }
  console.log(JSON.stringify(errors));
  await browser.close();
})();
