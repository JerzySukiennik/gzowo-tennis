const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  await page.evaluate(() => {
    const m = window.tennis.match; window.__log = [];
    const h = m.hooks; const oh = h.hit, op = h.point, oc = h.callout;
    h.hit = (pl, p, s) => { window.__log.push(`hit P${pl.idx} p=${p.toFixed(2)}${s ? ' serve' : ''}`); oh(pl, p, s); };
    h.point = (w, l, t) => { window.__log.push(`point P${w.idx} ${t}`); op(w, l, t); };
    h.callout = (t, c) => { window.__log.push(`callout ${t}`); oc(t, c); };
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: __dirname + '/t-menu.png' });
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  await page.evaluate(() => window.tennis.startGame());
  await page.waitForTimeout(25000);
  await page.screenshot({ path: __dirname + '/t-play.png' });
  const res = await page.evaluate(() => ({ app: window.tennis.app, scores: window.tennis.match.scores, state: window.tennis.match.state, log: window.__log.slice(-60) }));
  console.log(JSON.stringify({ fps, res, errors }, null, 1));
  await browser.close();
})();
