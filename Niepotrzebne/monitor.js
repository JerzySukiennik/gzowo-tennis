const WebSocket = require('ws');
const secs = Number(process.argv[2] || 3);
const ws = new WebSocket('ws://localhost:8792');
let last = null, n = 0, phones = null;
ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.t === 'phones') phones = m.list;
  if (m.t === 'p') { last = m; n++; }
});
setTimeout(() => {
  console.log('phones', JSON.stringify(phones), 'poses/s', (n / secs).toFixed(0));
  if (last) {
    const c = i => last.m.slice(i * 4, i * 4 + 3).map(v => v.toFixed(2)).join(',');
    console.log('X(bottom)=', c(0), ' Y=', c(1), ' Z(screen)=', c(2), ' pos=', c(3), ' q=', last.s);
  }
  process.exit(0);
}, secs * 1000);
