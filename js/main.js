// Gzowo Tennis: two-player motion tennis on one TV, each player swinging a tracked iPhone (Gzowo Motion) as the racket.
import * as THREE from 'three';
import { COURT, PLAYERS, ASSIST } from './config.js';
import { VENUES, buildVenue } from './venues.js';
import { Ball } from './ball.js';
import { Player } from './player.js';
import { Match } from './match.js';
import { Net } from './net.js';
import { Sfx } from './audio.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const cams = [new THREE.PerspectiveCamera(52, 1, 0.1, 900), new THREE.PerspectiveCamera(52, 1, 0.1, 900)];
const tvCam = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
const camState = [{ pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false }, { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false }];

const players = [new Player(scene, 0), new Player(scene, 1)];
const ball = new Ball(scene);
const sfx = new Sfx();

const $ = s => document.querySelector(s);
const ui = {
  menu: $('#menu'), hud: $('#hud'), calib: $('#calib'), pause: $('#pause'), over: $('#over'),
  calibNum: $('#calibNum'), calibList: $('#calibList'), callout: $('#callout'), divider: $('#divider'),
  cursors: $('#cursors'), sound: $('#sound'), conn: $('#conn'),
};

let app = 'menu';
let venue = null;
let venueId = 'stadion';
let assistIdx = 0;
const slots = [null, null];
const phones = new Map();
let calibCount = 0;
let calibTimer = null;
let calloutTimer = null;
let serverOnline = false;

const fx = [];
const ringTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
})();

function impact(pos, color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, depthWrite: false }));
  s.position.copy(pos);
  scene.add(s);
  fx.push({ obj: s, t: 0, life: 0.35, kind: 'ring' });
}

function landMark(x, z) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.015, z);
  scene.add(m);
  fx.push({ obj: m, t: 0, life: 1.4, kind: 'mark' });
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'ring') {
      const s = 0.25 + k * 1.3;
      f.obj.scale.set(s, s, s);
    } else {
      const s = 1 + k * 0.8;
      f.obj.scale.set(s, s, s);
    }
    f.obj.material.opacity = 1 - k;
    if (k >= 1) {
      scene.remove(f.obj);
      f.obj.geometry.dispose();
      f.obj.material.dispose();
      fx.splice(i, 1);
    }
  }
}

function showCallout(main, sub, color) {
  const b = ui.callout.querySelector('b'), s = ui.callout.querySelector('span');
  b.textContent = main;
  b.style.color = color || '#fff';
  s.textContent = sub || '';
  s.style.display = sub ? '' : 'none';
  ui.callout.classList.add('on');
  clearTimeout(calloutTimer);
  calloutTimer = setTimeout(() => ui.callout.classList.remove('on'), 1600);
}

const live = () => app !== 'menu';

const hooks = {
  haptic(pl, i, s) {
    if (live() && !pl.isBot) net.haptic(pl.phoneId, i, s);
  },
  sound(type, v) {
    const vol = live() ? 1 : 0.35;
    if (type === 'bounce') sfx.play('bounce', vol * Math.min(1, 0.25 + (v || 4) / 10));
    else if (type === 'net') sfx.play('net', vol * 0.9);
    else if (type === 'ooh') sfx.play('ooh', vol * 0.5);
  },
  hit(pl, p, serving) {
    const vol = live() ? 1 : 0.35;
    sfx.play(serving ? 'serve' : 'hit', vol * (0.55 + 0.45 * p), 0.95 + p * 0.1, THREE.MathUtils.clamp(ball.s.p.x / 8, -0.8, 0.8));
    impact(ball.s.p, pl.cfg.color);
    if (live() && !pl.isBot) net.haptic(pl.phoneId, 0.55 + 0.45 * p, 0.55);
  },
  point(w, l, text) {
    if (!live()) return;
    showCallout(text, `Punkt: ${w.cfg.name}`, w.cfg.color);
    sfx.play(Math.random() < 0.5 ? 'applause' : 'cheer', 0.6);
    if (!w.isBot) {
      net.haptic(w.phoneId, 1, 0.4);
      setTimeout(() => net.haptic(w.phoneId, 0.7, 0.6), 140);
    }
    if (!l.isBot) net.haptic(l.phoneId, 0.3, 0.2);
  },
  score() {
    updateScore();
    pushPhoneUi();
  },
  callout(text, color) {
    if (live()) showCallout(text, '', color);
  },
  landed(x, z) {
    landMark(x, z);
  },
  over(winner) {
    if (app === 'menu') {
      setTimeout(() => { if (app === 'menu') match.start(venue.surf, ASSIST[1], true); }, 1500);
      return;
    }
    app = 'over';
    $('#overDot').style.background = winner.cfg.color;
    $('#overDot').style.boxShadow = `0 0 40px ${winner.cfg.color}`;
    $('#overTitle').textContent = `Wygrywa ${winner.cfg.name}!`;
    $('#overScore').textContent = `${match.scores[0]} : ${match.scores[1]}`;
    sfx.play('cheer', 0.9);
    setScreen();
  },
};

const match = new Match(players, ball, hooks);

function setVenue(id) {
  if (venue) {
    scene.remove(venue.group);
    venue.dispose();
  }
  venueId = id;
  venue = buildVenue(id);
  scene.add(venue.group);
  scene.fog = venue.fog;
  renderer.toneMappingExposure = venue.exposure;
  match.surf = venue.surf;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('sel', c.dataset.id === id));
}

function updateScore() {
  for (let i = 0; i < 2; i++) {
    const side = document.querySelector(`#score .s${i}`);
    const pts = side.querySelector('.pts');
    const val = String(match.scores[i]);
    if (pts.textContent !== val) {
      pts.textContent = val;
      pts.classList.remove('bump');
      void pts.offsetWidth;
      pts.classList.add('bump');
    }
    side.querySelector('.nm').textContent = PLAYERS[i].name;
    side.querySelector('.srv').classList.toggle('on', ['setup', 'toss', 'fault'].includes(match.state) && match.serverIdx === i);
  }
}

function pushPhoneUi() {
  for (const id of phones.keys()) {
    const i = slots.indexOf(id);
    const cfg = i >= 0 ? PLAYERS[i] : null;
    const color = cfg ? cfg.color : '#d9f23a';
    let screen;
    if (app === 'calibrate' && cfg) {
      screen = { mode: 'play', title: calibCount > 0 ? `Kalibracja ${calibCount}` : 'Gotowe!', subtitle: 'Stań na swoim miejscu, telefon pionowo przed sobą, ekranem do siebie', color };
    } else if (app === 'play' && cfg && !players[i].isBot) {
      const me = match.scores[i], op = match.scores[1 - i];
      screen = { mode: 'play', title: cfg.name, subtitle: `${me} : ${op}${match.serverIdx === i && ['setup', 'toss', 'fault'].includes(match.state) ? ' · serwujesz' : ''}`, color };
    } else {
      screen = { mode: 'pointer', title: 'Celuj w telewizor', subtitle: cfg ? `Gracz ${i + 1} · ${cfg.name}` : 'Widz', color };
    }
    net.ui(id, screen);
  }
}

function renderSlots() {
  document.querySelectorAll('.slot').forEach(el => {
    const i = +el.dataset.i;
    const id = slots[i];
    el.classList.toggle('human', !!id);
    const ph = id ? phones.get(id) : null;
    const moving = ph && performance.now() - ph.last < 1000;
    const text = !id ? 'Bot' : moving ? (ph.name || 'iPhone') : `${ph?.name || 'iPhone'} · brak ruchu, otwórz apkę i włącz aparat`;
    const em = el.querySelector('em');
    if (em.textContent !== text) em.textContent = text;
    el.classList.toggle('stale', !!id && !moving);
  });
  serverOnline = true;
  ui.conn.textContent = '';
}

function assignSlots() {
  for (let i = 0; i < 2; i++) if (slots[i] && !phones.has(slots[i])) slots[i] = null;
  for (const id of phones.keys()) {
    if (slots.includes(id)) continue;
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = id;
  }
  renderSlots();
}

function playerOf(id) {
  const i = slots.indexOf(id);
  return i >= 0 ? players[i] : null;
}

const net = new Net(msg => {
  const now = performance.now();
  if (msg.t === 'phones') {
    const ids = new Set(msg.list.map(p => p.id));
    for (const id of [...phones.keys()]) if (!ids.has(id)) { phones.get(id).cursor?.remove(); phones.delete(id); }
    for (const p of msg.list) {
      if (!phones.has(p.id)) phones.set(p.id, { name: p.name, Q: new THREE.Quaternion(), M: new THREE.Matrix4(), ptr: { x: 0.5, y: 0.5, init: false }, cursor: null, last: 0 });
    }
    assignSlots();
    pushPhoneUi();
    return;
  }
  const ph = phones.get(msg.from);
  if (!ph) return;
  if (msg.t === 'p') {
    ph.M.fromArray(msg.m);
    ph.Q.setFromRotationMatrix(ph.M);
    ph.last = now;
    const pl = playerOf(msg.from);
    if (pl) pl.rig.read(msg.m, msg.s, now);
    if (pointerMode()) updatePointer(ph);
  } else if (msg.t === 'tap') {
    if (pointerMode()) pointerClick(ph);
  } else if (msg.t === 'recenter') {
    ph.ptr.init = false;
  } else if (msg.t === 'screenUp') {
    if (app === 'play') togglePause(true);
  }
});

const pointerMode = () => app === 'menu' || app === 'pause' || app === 'over';

function updatePointer(ph) {
  const d = new THREE.Vector3(-1, 0, 0).applyQuaternion(ph.Q);
  const yaw = Math.atan2(d.x, -d.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  if (!ph.ptr.init) {
    ph.ptr.yaw0 = yaw;
    ph.ptr.pitch0 = pitch;
    ph.ptr.init = true;
    ph.ptr.x = 0.5;
    ph.ptr.y = 0.5;
  }
  let dy = yaw - ph.ptr.yaw0;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const tx = THREE.MathUtils.clamp(0.5 + dy / 0.5 * 0.5, 0, 1);
  const ty = THREE.MathUtils.clamp(0.5 - (pitch - ph.ptr.pitch0) / 0.35 * 0.5, 0, 1);
  ph.ptr.x += (tx - ph.ptr.x) * 0.55;
  ph.ptr.y += (ty - ph.ptr.y) * 0.55;
}

function drawCursors() {
  for (const [id, ph] of phones) {
    const show = pointerMode() && ph.ptr.init && performance.now() - ph.last < 1000;
    if (!ph.cursor) {
      ph.cursor = document.createElement('div');
      ph.cursor.className = 'cursor';
      ui.cursors.appendChild(ph.cursor);
    }
    const i = slots.indexOf(id);
    ph.cursor.style.background = i >= 0 ? PLAYERS[i].color : '#d9f23a';
    ph.cursor.style.display = show ? 'block' : 'none';
    ph.cursor.style.left = `${ph.ptr.x * innerWidth}px`;
    ph.cursor.style.top = `${ph.ptr.y * innerHeight}px`;
  }
}

function pointerClick(ph) {
  const x = ph.ptr.x * innerWidth, y = ph.ptr.y * innerHeight;
  ph.cursor?.classList.add('click');
  setTimeout(() => ph.cursor?.classList.remove('click'), 150);
  const el = document.elementFromPoint(x, y)?.closest('button, .card, .seg');
  if (el) el.click();
  unlockSound();
}

function setScreen() {
  ui.menu.classList.toggle('on', app === 'menu');
  ui.calib.classList.toggle('on', app === 'calibrate');
  ui.pause.classList.toggle('on', app === 'pause');
  ui.over.classList.toggle('on', app === 'over');
  ui.hud.classList.toggle('on', app === 'play' || app === 'pause' || app === 'over');
  pushPhoneUi();
}

function toMenu() {
  app = 'menu';
  clearInterval(calibTimer);
  players.forEach(p => p.setHuman(null));
  match.start(venue.surf, ASSIST[1], true);
  setScreen();
}

function startMatch() {
  app = 'play';
  for (const s of camState) s.init = false;
  match.start(venue.surf, ASSIST[assistIdx]);
  setScreen();
}

function startGame() {
  unlockSound();
  players.forEach((p, i) => p.setHuman(slots[i]));
  const humans = players.filter(p => !p.isBot);
  if (!humans.length) { startMatch(); return; }
  app = 'calibrate';
  calibCount = 5;
  ui.calibNum.textContent = calibCount;
  ui.calibList.innerHTML = humans.map(p => `<div data-i="${p.idx}" style="border:2px solid ${p.cfg.color}">${p.cfg.name}</div>`).join('');
  setScreen();
  clearInterval(calibTimer);
  calibTimer = setInterval(() => {
    const now = performance.now();
    const waiting = humans.filter(p => !p.rig.live(now));
    humans.forEach(p => {
      const el = ui.calibList.querySelector(`[data-i="${p.idx}"]`);
      if (el) el.textContent = p.rig.live(now) ? p.cfg.name : `${p.cfg.name}: czekam na ruch telefonu`;
    });
    if (waiting.length) {
      calibCount = 5;
      ui.calibNum.textContent = '…';
      pushPhoneUi();
      return;
    }
    calibCount--;
    ui.calibNum.textContent = calibCount > 0 ? calibCount : '✓';
    for (const p of humans) net.haptic(p.phoneId, calibCount > 0 ? 0.4 : 1, 0.8);
    if (calibCount <= 0) {
      clearInterval(calibTimer);
      for (const p of humans) {
        const ok = p.rig.calibrate();
        if (!ok) p.setHuman(null);
        ui.calibList.querySelector(`[data-i="${p.idx}"]`)?.classList.toggle('ok', ok);
      }
      pushPhoneUi();
      setTimeout(startMatch, 600);
    } else {
      pushPhoneUi();
    }
  }, 1000);
}

function togglePause(on) {
  if (on && app === 'play') app = 'pause';
  else if (!on && app === 'pause') app = 'play';
  setScreen();
}

const courtsEl = $('#courts');
courtsEl.innerHTML = VENUES.map(v => `<button class="card" data-id="${v.id}"><div class="sw" style="background:linear-gradient(135deg, ${v.swatch[0]} 0 60%, ${v.swatch[1]} 60%)"></div><b>${v.name}</b><span>${v.blurb}</span></button>`).join('');
courtsEl.addEventListener('click', e => {
  const c = e.target.closest('.card');
  if (c && c.dataset.id !== venueId) {
    setVenue(c.dataset.id);
    match.start(venue.surf, ASSIST[1], true);
  }
});
const assistEl = $('#assist');
assistEl.innerHTML = ASSIST.map((a, i) => `<button class="seg${i === assistIdx ? ' sel' : ''}" data-i="${i}">${a.label}</button>`).join('');
assistEl.addEventListener('click', e => {
  const s = e.target.closest('.seg');
  if (!s) return;
  assistIdx = +s.dataset.i;
  assistEl.querySelectorAll('.seg').forEach(x => x.classList.toggle('sel', x === s));
});
$('#swap').addEventListener('click', () => {
  [slots[0], slots[1]] = [slots[1], slots[0]];
  renderSlots();
  pushPhoneUi();
});
$('#play').addEventListener('click', startGame);
$('#resume').addEventListener('click', () => togglePause(false));
$('#toMenu').addEventListener('click', toMenu);
$('#again').addEventListener('click', () => {
  players.forEach((p, i) => p.setHuman(p.rig.cal ? slots[i] : null));
  startMatch();
});
$('#overMenu').addEventListener('click', toMenu);

async function unlockSound() {
  await sfx.init();
  ui.sound.classList.add('off');
}
addEventListener('pointerdown', unlockSound, { once: true });
addEventListener('keydown', e => {
  unlockSound();
  if (e.key === 'Escape') togglePause(app === 'play');
});

function followCam(cam, st, pl, dt) {
  const pos = new THREE.Vector3(pl.body.x * 0.55, 3.3, pl.side * (COURT.halfLen + 6.4) + (pl.body.z - pl.side * COURT.halfLen) * 0.75);
  const look = new THREE.Vector3(pl.body.x * 0.3, 0.5, -pl.side * 5);
  if (!st.init) {
    st.pos.copy(pos);
    st.look.copy(look);
    st.init = true;
  } else {
    const k = 1 - Math.exp(-dt * 4);
    st.pos.lerp(pos, k);
    st.look.lerp(look, k);
  }
  cam.position.copy(st.pos);
  cam.lookAt(st.look);
}

let orbit = 0.6;
let debugView = null;
function tvShot(dt) {
  orbit += dt * 0.05;
  tvCam.position.set(Math.sin(orbit) * 30, 12, Math.cos(orbit) * 30);
  tvCam.lookAt(0, 0, 0);
}

function view(cam, x, y, w, h) {
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.render(scene, cam);
}

function labels(now) {
  const humans = players.filter(p => !p.isBot);
  const split = humans.length === 2 && app !== 'menu';
  document.querySelectorAll('#labels .lab').forEach((el, i) => {
    const p = players[i];
    const on = (app === 'play' || app === 'pause') && !p.isBot && (split || humans[0] === p);
    el.classList.toggle('on', on);
    if (on) {
      const text = !p.rig.live(now) ? `${p.cfg.name} · brak telefonu` : p.rig.quality < 2 ? `${p.cfg.name} · słabe śledzenie` : p.cfg.name;
      if (el.textContent !== text) el.textContent = text;
    }
  });
  ui.divider.classList.toggle('on', split);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener('resize', resize);
resize();

setVenue('stadion');
match.start(venue.surf, ASSIST[1], true);
setScreen();

let last = performance.now(), elapsed = 0;
function tick(dt, now) {
  elapsed += dt;
  if (app !== 'pause' && app !== 'calibrate') match.update(dt);
  else for (const p of players) p.update(0, { contact: null, assist: match.assist, ballPos: null, returnHome: false });
  if (app === 'calibrate') for (const p of players) if (!p.isBot) p.rig.update(dt);
  venue.update(elapsed, match.excite);
  sfx.setCrowd(app === 'menu' ? 0.15 : 0.35 + match.excite * 0.6);
  updateFx(dt);
  updateScore();
  if (app === 'menu') renderSlots();
  labels(now);
  drawCursors();
}

function render(dt) {
  const W = renderer.domElement.width, H = renderer.domElement.height;
  renderer.setScissorTest(true);
  renderer.shadowMap.needsUpdate = true;
  const humans = players.filter(p => !p.isBot);
  const gameView = app === 'play' || app === 'pause' || app === 'over';
  if (debugView) {
    tvCam.position.copy(debugView.pos);
    tvCam.lookAt(debugView.look);
    view(tvCam, 0, 0, W, H);
  } else if (gameView && humans.length === 2) {
    followCam(cams[0], camState[0], players[0], dt);
    followCam(cams[1], camState[1], players[1], dt);
    view(cams[0], 0, 0, Math.floor(W / 2), H);
    view(cams[1], Math.floor(W / 2), 0, W - Math.floor(W / 2), H);
  } else if (gameView) {
    const p = humans[0] || players[0];
    followCam(cams[0], camState[0], p, dt);
    view(cams[0], 0, 0, W, H);
  } else {
    tvShot(dt);
    view(tvCam, 0, 0, W, H);
  }
  renderer.setScissorTest(false);
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  tick(dt, now);
  render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.tennis = { debug(v) { debugView = v; }, match, players, ball, tick, render, setVenue, startGame, startMatch, toMenu, slots, phones, get app() { return app; } };
