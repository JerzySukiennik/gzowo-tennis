const { chromium } = require('/Users/jurek/Downloads/Claude/Projects/Flop/node_modules/playwright-core');
const net = require('net');
function fakePhone(id, name, x0) {
  const sock = net.connect(8793, '127.0.0.1');
  const st = { ui: [], haptics: 0, sock, pitch: 0, mode: 'remote' };
  let buf = '';
  sock.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (m.t === 'ui') st.ui.push(m); if (m.t === 'h') st.haptics++; } });
  sock.on('connect', () => sock.write(JSON.stringify({ t: 'hello', id, name }) + '\n'));
  st.timer = setInterval(() => {
    let m;
    if (st.mode === 'remote') {
      const c = Math.cos(st.pitch), s = Math.sin(st.pitch);
      const X = [0, s, c], Y = [1, 0, 0], Z = [0, c, -s];
      m = [...X, 0, ...Y, 0, ...Z, 0, x0, 1.0, 0, 1];
    } else {
      m = [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, x0, 1.2, -0.3, 1];
    }
    sock.write(JSON.stringify({ t: 'p', s: 2, m }) + '\n');
  }, 1000 / 60);
  st.send = o => sock.write(JSON.stringify(o) + '\n');
  return st;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e.message));
  await page.goto('http://localhost:8792/');
  await page.waitForFunction(() => window.tennis, null, { timeout: 60000 });
  const a = fakePhone('A1', 'iPhone Jurka', -1), b = fakePhone('B2', 'iPhone Taty', 1);
  await page.waitForTimeout(1500);
  const slots = await page.evaluate(() => [...window.tennis.slots]);
  const slotText = await page.$$eval('.slot em', els => els.map(e => e.textContent));
  for (let i = 0; i < 14; i++) { a.pitch += 0.0115; await page.waitForTimeout(30); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: __dirname + '/p-menu.png' });
  const ptr = await page.evaluate(() => { const p = window.tennis.phones.get('A1').ptr; return [p.x.toFixed(2), p.y.toFixed(2)]; });
  const btn = await page.evaluate(() => { const r = document.getElementById('play').getBoundingClientRect(); return [(r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight].map(v => v.toFixed(2)); });
  a.send({ t: 'tap' });
  await page.waitForTimeout(500);
  const appAfterTap = await page.evaluate(() => window.tennis.app);
  a.mode = b.mode = 'hold';
  await page.waitForTimeout(6500);
  await page.screenshot({ path: __dirname + '/p-play.png' });
  const after = await page.evaluate(() => ({ app: window.tennis.app, humans: window.tennis.players.map(p => !p.isBot), cal: window.tennis.players.map(p => !!p.rig.cal) }));
  console.log(JSON.stringify({ slots, slotText, ptr, btn, appAfterTap, after, uiA: a.ui.map(u => `${u.mode}:${u.title}|${u.subtitle}`).slice(-6), hapticsA: a.haptics, errors }, null, 1));
  for (const p of [a, b]) { clearInterval(p.timer); p.sock.end(); }
  await browser.close();
})();
