const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e.message));
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  await page.evaluate(async () => { window.__L = await import('/js/ball.js'); });
  const out = await page.evaluate(() => {
    const T = window.tennis, m = T.match, P = T.players[0];
    const mat = (X, Y, Z, p) => [X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, p[0], p[1], p[2], 1];
    let now = performance.now();
    P.setHuman('fake0');
    P.rig.read(mat([0, -1, 0], [1, 0, 0], [0, 0, 1], [0, 1.2, -0.3]), 2, now);
    P.rig.calibrate();
    const stats = { humanHits: 0, botHits: 0, reasons: {}, swings: 0, serves: 0 };
    const oh = m.hooks.hit, op = m.hooks.point;
    const os = m.shoot.bind(m); stats.log = []; m.shoot = (pl, info) => { const st = m.state; const from = T.ball.s.p.clone(); os(pl, info); if (pl === P) { const { landing } = window.__L; const l = landing(T.ball.s.p, T.ball.s.v, T.ball.s.spin, m.surf); stats.log.push(`${st} from ${from.toArray().map(v=>v.toFixed(1))} body ${P.body.x.toFixed(1)} vel ${info ? info.vel.toArray().map(v=>v.toFixed(1)) : ''} n ${info ? info.normal.toArray().map(v=>v.toFixed(2)) : ''} land ${l ? l.x.toFixed(1)+','+l.z.toFixed(1) : '-'}`); } };
    m.hooks.hit = (pl, p, s) => { if (pl === P) { stats.humanHits++; if (s) stats.serves++; } else stats.botHits++; oh(pl, p, s); };
    m.hooks.point = (w, l, x) => { const k = (w === P ? 'win:' : 'lose:') + x; stats.reasons[k] = (stats.reasons[k] || 0) + 1; op(w, l, x); };
    m.start(m.surf, { move: 0.8, reach: 0.38 });
    let swingT = -1;
    for (let i = 0; i < 60 * 240; i++) {
      now += 16.7;
      const b = T.ball.s;
      const neutral = P.body.clone().addScaledVector(P.right, 0.75);
      const toward = (m.state === 'rally' && m.lastHitter !== P && Math.sign(b.p.z) === 1) || (m.state === 'toss' && m.serverIdx === 0 && b.v.y < 0 && b.p.y < 2.6);
      if (swingT < 0 && toward && Math.abs(b.p.z - neutral.z) < 1.3 && b.p.y < 1.8) { swingT = 0; stats.swings++; }
      let pos = [0.3, 0.95, 0.1];
      if (swingT >= 0) {
        const k = Math.min(1, swingT / 0.15);
        pos = [0.3, 0.95 + (b.p.y - 1.05) * 0.8 * Math.min(1, swingT / 0.05), 0.1 - 0.7 * k];
        swingT += 1 / 60;
        if (swingT > 0.35) swingT = -1;
      }
      P.rig.read(mat([-1, 0, 0], [0, 1, 0], [0, 0, -1], pos), 2, now);
      T.tick(1 / 60, now);
      if (T.app === 'over' || m.state === 'over') break;
    }
    return { stats, scores: m.scores, state: m.state };
  });
  console.log(JSON.stringify(out, null, 1), errors);
  await browser.close();
})();
