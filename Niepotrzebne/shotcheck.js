const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  const r = await page.evaluate(async () => {
    const THREE = await import('three');
    const { solveShot, landing } = await import('/js/ball.js');
    const surf = { e: 0.76, fric: 0.8 };
    const out = [];
    for (const [tx, tz, sp, clear] of [[5.0, -10, 15, 0.4], [0, -13.0, 15, 0.4], [1, -8, 15, -0.25], [2, -9, 9, 0.85], [2, -11, 19, 0.35]]) {
      const from = new THREE.Vector3(1, 0.9, 11);
      const v = solveShot(from, new THREE.Vector3(tx, 0.034, tz), sp, 0.3, surf, clear);
      const l = landing(from, v, 0.3, surf);
      out.push(`target ${tx},${tz} -> land ${l ? l.x.toFixed(2) + ',' + l.z.toFixed(2) + (l.net ? ' NET' : '') + ' t=' + l.t.toFixed(2) : 'none'} v=${v.toArray().map(x => x.toFixed(1))}`);
    }
    return out;
  });
  console.log(r.join('\n'));
  await browser.close();
})();
