const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  const out = await page.evaluate(() => {
    const T = window.tennis, m = T.match;
    const reasons = {}; let hits = 0;
    const oh = m.hooks.hit, op = m.hooks.point;
    m.hooks.hit = (a, b, c) => { hits++; oh(a, b, c); };
    m.hooks.point = (w, l, x) => { reasons[x] = (reasons[x] || 0) + 1; op(w, l, x); };
    let rnd = 0; const R = Math.random; Math.random = () => { rnd++; return R(); };
    const lands = [];
    const os = m.shoot.bind(m);
    m.shoot = (pl, info) => { os(pl, info); const { landing } = window.__ball || {}; };
    T.startMatch();
    let now = performance.now();
    for (let i = 0; i < 60 * 300; i++) { now += 16.7; T.tick(1 / 60, now); if (T.app === 'over') { T.startMatch(); } }
    return { hits, reasons };
  });
  console.log(JSON.stringify(out));
  await browser.close();
})();
