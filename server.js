// Gzowo Tennis relay: serves the game and bridges Gzowo Motion iPhones (TCP, newline JSON, Bonjour _gzmotion._tcp) to browsers (WebSocket).
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const HTTP_PORT = Number(process.argv[2] || 8792);
const PHONE_PORT = HTTP_PORT + 1;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || /^(node_modules|ios|Niepotrzebne)(\/|$)/.test(rel)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const browsers = new Set();
const phones = new Map();

function toBrowsers(text) { for (const b of browsers) if (b.readyState === 1) b.send(text); }
function phoneList() { return JSON.stringify({ t: 'phones', list: [...phones.entries()].map(([id, p]) => ({ id, name: p.name })) }); }

wss.on('connection', ws => {
  browsers.add(ws);
  ws.send(phoneList());
  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    const to = msg.to;
    delete msg.to;
    const line = JSON.stringify(msg) + '\n';
    if (to) { const p = phones.get(to); if (p) p.sock.write(line); }
    else for (const p of phones.values()) p.sock.write(line);
  });
  ws.on('close', () => browsers.delete(ws));
});

const phoneServer = net.createServer(sock => {
  sock.setNoDelay(true);
  let id = null;
  let buf = '';
  sock.on('data', chunk => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line) continue;
      if (!id) {
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.t !== 'hello' || !msg.id) continue;
        id = String(msg.id);
        const old = phones.get(id);
        if (old && old.sock !== sock) old.sock.destroy();
        phones.set(id, { sock, name: msg.name || 'iPhone' });
        console.log('phone connected', id, sock.remoteAddress);
        toBrowsers(phoneList());
        continue;
      }
      toBrowsers(`{"from":"${id}",${line.slice(1)}`);
    }
  });
  const drop = () => {
    if (id && phones.get(id)?.sock === sock) {
      phones.delete(id);
      console.log('phone disconnected', id);
      toBrowsers(phoneList());
    }
  };
  sock.on('close', drop);
  sock.on('error', drop);
});

server.listen(HTTP_PORT, () => console.log(`game  http://localhost:${HTTP_PORT}`));
phoneServer.listen(PHONE_PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`phones tcp :${PHONE_PORT}  (${ips.join(', ')})`);
  const dns = spawn('dns-sd', ['-R', 'Gzowo Tennis', '_gzmotion._tcp', 'local', String(PHONE_PORT)], { stdio: 'ignore' });
  const stop = () => { dns.kill(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
});
