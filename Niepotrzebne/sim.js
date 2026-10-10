const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e.message));
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  const out = await page.evaluate((secs) => {
    const T = window.tennis, m = T.match, log = [];
    const h = m.hooks; const oh = h.hit, op = h.point, oc = h.callout;
    let t = 0;
    h.hit = (pl, p, s) => { log.push(`${t.toFixed(1)} hit P${pl.idx} ${s ? 'SERVE' : ''} z=${T.ball.s.p.z.toFixed(1)} y=${T.ball.s.p.y.toFixed(2)}`); oh(pl, p, s); };
    h.point = (w, l, x) => { log.push(`${t.toFixed(1)} POINT P${w.idx} ${x} ${m.scores}`); op(w, l, x); };
    h.callout = (x, c) => { log.push(`${t.toFixed(1)} callout ${x}`); oc(x, c); };
    const os = m.toSetup.bind(m); m.toSetup = d => { log.push(`${t.toFixed(1)} setup server=P${m.serverIdx} faults=${m.faults}`); os(d); };
    T.startMatch();
    const stats = { rallies: [], hits: 0 };
    let now = performance.now();
    for (let i = 0; i < secs * 60; i++) { t += 1 / 60; now += 16.7; T.tick(1 / 60, now); if (T.app === 'over') break; }
    const hits = log.filter(l=>l.includes('hit P')).length; const pts = log.filter(l=>l.includes('POINT')).length; log.push('hits='+hits+' points='+pts); return { log, scores: m.scores, app: T.app, t };
  }, 240);
  console.log(out.log.slice(-400).filter(l => !l.includes("hit P")).join('\n'));
  console.log('...', out.scores, out.app, out.t.toFixed(0) + 's', errors);
  await browser.close();
})();
