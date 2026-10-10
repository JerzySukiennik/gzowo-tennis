const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  await page.evaluate(() => window.tennis.startMatch());
  await page.waitForTimeout(600);
  const offs = [[2.5, 1.6, -1.2], [0, 1.5, -3], [-2.4, 1.4, 0.5]];
  for (let i = 0; i < offs.length; i++) {
    await page.evaluate(async (o) => {
      const THREE = await import('three');
      const T = window.tennis; const p = T.players[0];
      T.debug({ pos: new THREE.Vector3(p.body.x + o[0], o[1], p.body.z + o[2]), look: new THREE.Vector3(p.body.x, 1.0, p.body.z) });
    }, offs[i]);
    await page.waitForTimeout(400);
    await page.screenshot({ path: __dirname + `/c-${i}.png` });
  }
  await browser.close();
})();
