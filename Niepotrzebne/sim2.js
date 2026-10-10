const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  const out = await page.evaluate(() => {
    const T = window.tennis, m = T.match, log = [];
    T.startMatch();
    let now = performance.now(), hits = 0, lastHitter = null, minD = 1e9, rec = null;
    for (let i = 0; i < 60 * 40; i++) {
      now += 16.7; T.tick(1 / 60, now);
      if (m.state === 'rally' && m.lastHitter) {
        if (m.lastHitter !== lastHitter) {
          if (rec) log.push(`P${rec.idx} missed? minD=${minD.toFixed(2)} pred=${JSON.stringify(rec.pred)} body=${rec.body}`);
          lastHitter = m.lastHitter; minD = 1e9;
          const r = T.players[1 - lastHitter.idx];
          rec = { idx: r.idx, pred: m.prediction ? [m.prediction.p.x.toFixed(1), m.prediction.p.y.toFixed(2), m.prediction.p.z.toFixed(1)] : null, body: '' };
        }
        const r = T.players[rec.idx];
        if (Math.sign(T.ball.s.p.z) === r.side) {
          const hand = Math.sign((T.ball.s.p.x - r.body.x) * r.side) || 1;
          const reach = r.body.clone().addScaledVector(r.right, hand * 0.75); reach.y = T.ball.s.p.y;
          const d = reach.distanceTo(T.ball.s.p);
          if (d < minD) { minD = d; rec.body = `${r.body.x.toFixed(1)},${r.body.z.toFixed(1)} ball=${T.ball.s.p.x.toFixed(1)},${T.ball.s.p.y.toFixed(2)},${T.ball.s.p.z.toFixed(1)} b=${m.bounces} vy=${T.ball.s.v.y.toFixed(1)} cd=${r.cooldown.toFixed(2)}`; }
        }
      } else if (m.state !== 'rally' && rec) { log.push(`end ${m.state} P${rec.idx} minD=${minD.toFixed(2)} pred=${JSON.stringify(rec.pred)} body=${rec.body}`); rec = null; lastHitter = null; }
    }
    return log;
  });
  console.log(out.slice(0, 20).join('\n'));
  await browser.close();
})();
