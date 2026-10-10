// Gzowo Tennis venues: stylized courts (stadium, Gzowo grass, clay, rooftop at night) with crowds, decor and bounce physics.
import * as THREE from 'three';
import { COURT, netHeight } from './config.js';

export const VENUES = [
  { id: 'stadion', name: 'Stadion', blurb: 'Twardy kort, równe odbicie', swatch: ['#3c78c8', '#3f9b5a'] },
  { id: 'gzowo', name: 'Gzowo', blurb: 'Trawa: szybko i nisko', swatch: ['#5fbf4e', '#3f8f3a'] },
  { id: 'maczka', name: 'Mączka', blurb: 'Wolno i wysoko', swatch: ['#d8703f', '#1f4d36'] },
  { id: 'dach', name: 'Dach nocą', blurb: 'Neony nad miastem', swatch: ['#7346e0', '#1a1638'] },
];

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function courtTexture(spec) {
  const W = 1024, H = 2048, PX = W / 18;
  const X = x => (x + 9) * PX, Z = z => (z + 18) * PX;
  return canvasTex(W, H, (g) => {
    g.fillStyle = spec.outer;
    g.fillRect(0, 0, W, H);
    if (spec.stripes) {
      for (let i = 0; i < 18; i++) {
        g.fillStyle = i % 2 ? spec.stripes[0] : spec.stripes[1];
        g.fillRect(0, i * 2 * PX, W, 2 * PX);
      }
    } else {
      g.fillStyle = spec.inner;
      g.fillRect(X(-COURT.dblHalfW), Z(-COURT.halfLen), (COURT.dblHalfW * 2) * PX, COURT.halfLen * 2 * PX);
    }
    if (spec.noise) {
      const img = g.getImageData(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * spec.noise;
        img.data[i] += n;
        img.data[i + 1] += n * 0.8;
        img.data[i + 2] += n * 0.6;
      }
      g.putImageData(img, 0, 0);
    }
    if (spec.wear) {
      for (const s of [-1, 1]) {
        const grd = g.createRadialGradient(X(0), Z(s * 11.6), 10, X(0), Z(s * 11.6), 2.6 * PX);
        grd.addColorStop(0, spec.wear);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(X(-4), Z(s * 11.6) - 3 * PX, 8 * PX, 6 * PX);
      }
    }
    g.fillStyle = spec.line || '#ffffff';
    const lw = 0.07 * PX;
    const hline = (x0, x1, z) => g.fillRect(X(x0), Z(z) - lw / 2, (x1 - x0) * PX, lw);
    const vline = (x, z0, z1) => g.fillRect(X(x) - lw / 2, Z(z0), lw, (z1 - z0) * PX);
    for (const s of [-1, 1]) {
      hline(-COURT.dblHalfW, COURT.dblHalfW, s * COURT.halfLen);
      vline(s * COURT.dblHalfW, -COURT.halfLen, COURT.halfLen);
      vline(s * COURT.halfW, -COURT.halfLen, COURT.halfLen);
      hline(-COURT.halfW, COURT.halfW, s * COURT.serviceLen);
      vline(0, s > 0 ? COURT.halfLen - 0.15 : -COURT.halfLen, s > 0 ? COURT.halfLen : -COURT.halfLen + 0.15);
    }
    vline(0, -COURT.serviceLen, COURT.serviceLen);
  });
}

function sky(top, horizon, bottom) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.renderOrder = -1;
  return m;
}

function makeNet() {
  const g = new THREE.Group();
  const netTex = canvasTex(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(20,20,24,0.9)';
    c.lineWidth = 5;
    c.strokeRect(0, 0, 64, 64);
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.repeat.set(160, 12);
  const segs = 40;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const x = -COURT.netHalfW + (2 * COURT.netHalfW * i) / segs;
    pos.push(x, netHeight(x), 0, x, 0.02, 0);
    uv.push(i / segs, 1, i / segs, 0);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const net = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }));
  net.castShadow = true;
  g.add(net);
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const x = -COURT.netHalfW + (2 * COURT.netHalfW * i) / segs;
    pts.push(new THREE.Vector3(x, netHeight(x), 0));
  }
  const tape = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  tape.castShadow = true;
  g.add(tape);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1f3b2a, roughness: 0.5, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.12, 12), postMat);
    post.position.set(s * (COURT.netHalfW + 0.05), 0.56, 0);
    post.castShadow = true;
    g.add(post);
  }
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  strap.position.set(0, 0.46, 0);
  g.add(strap);
  return g;
}

function crowdMaterial(base, uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, ...base });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uExcite = uniforms.uExcite;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uExcite;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = float(gl_InstanceID) * 1.731;
transformed.y += (0.5 + 0.5 * sin(uTime * (5.0 + mod(ph, 3.0)) + ph)) * (0.03 + uExcite * 0.32);`);
  };
  m.customProgramCacheKey = () => 'crowd';
  return m;
}

const SHIRTS = ['#ff5a4e', '#ffd23f', '#3d8bff', '#ffffff', '#2ec27e', '#ff8fd1', '#8f5bff', '#ff9a3c', '#1d1d24', '#5fd0ff'];
const SKINS = ['#f5c9a8', '#e8b48f', '#c98d63', '#8d5a3b', '#f2d2bd'];

function crowd(seats, uniforms) {
  const n = seats.length;
  const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.35, 4, 8);
  bodyGeo.translate(0, 0.42, 0);
  const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
  headGeo.translate(0, 0.98, 0);
  const bodies = new THREE.InstancedMesh(bodyGeo, crowdMaterial({}, uniforms), n);
  const heads = new THREE.InstancedMesh(headGeo, crowdMaterial({}, uniforms), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  seats.forEach((st, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.ry + (Math.random() - 0.5) * 0.4);
    const k = 0.9 + Math.random() * 0.2;
    s.set(k, k, k);
    m.compose(st.p, q, s);
    bodies.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
    bodies.setColorAt(i, c.set(SHIRTS[(Math.random() * SHIRTS.length) | 0]));
    heads.setColorAt(i, c.set(SKINS[(Math.random() * SKINS.length) | 0]));
  });
  bodies.castShadow = true;
  const g = new THREE.Group();
  g.add(bodies, heads);
  return g;
}

function stand(group, uniforms, { center, length, rows, ry, color, density = 0.85, rise = 0.55, depth = 0.9 }) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const seats = [];
  const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  const along = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  for (let r = 0; r < rows; r++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(length, rise * (r + 1), depth), mat);
    const off = dir.clone().multiplyScalar(-(r * depth + depth / 2));
    step.position.copy(center).add(off);
    step.position.y = (rise * (r + 1)) / 2;
    step.rotation.y = ry;
    step.receiveShadow = true;
    group.add(step);
    for (let x = -length / 2 + 0.4; x < length / 2 - 0.3; x += 0.62) {
      if (Math.random() > density) continue;
      const p = center.clone().add(off).add(along.clone().multiplyScalar(x + (Math.random() - 0.5) * 0.1));
      p.y = rise * (r + 1);
      seats.push({ p, ry });
    }
  }
  return seats;
}

function boards(group, z, x, ry, len, colors) {
  const tex = canvasTex(1024, 64, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect((i * w) / n, 0, w / n, h);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const word = ['GZOWO', 'GSP', 'TENIS', 'GZOWO.FUN'][i % 4];
      let size = 34;
      do { g.font = `bold ${size}px -apple-system, Helvetica, sans-serif`; size -= 2; } while (g.measureText(word).width > w / n - 16 && size > 10);
      g.fillText(word, ((i + 0.5) * w) / n, h / 2 + 2);
    }
  });
  const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.15), [
    new THREE.MeshStandardMaterial({ color: 0x222222 }), new THREE.MeshStandardMaterial({ color: 0x222222 }),
    new THREE.MeshStandardMaterial({ color: 0x222222 }), new THREE.MeshStandardMaterial({ color: 0x222222 }),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }),
    new THREE.MeshStandardMaterial({ map: tex }),
  ]);
  b.position.set(x, 0.45, z);
  b.rotation.y = ry;
  b.castShadow = true;
  group.add(b);
}

function umpire(group, x) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x24533a, roughness: 0.6 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), mat);
  legs.position.set(x, 1, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 1), mat);
  seat.position.set(x, 2.05, 0);
  const ref = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  ref.position.set(x, 2.6, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8b48f }));
  head.position.set(x, 3.1, 0);
  for (const m of [legs, seat, ref, head]) { m.castShadow = true; group.add(m); }
}

function tree(group, x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.25 * s, 2.2 * s, 8), new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.9 }));
  trunk.position.set(x, 1.1 * s, z);
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.27 + Math.random() * 0.06, 0.55, 0.32 + Math.random() * 0.1), roughness: 0.85, flatShading: true });
  group.add(trunk);
  trunk.castShadow = true;
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((1.5 - i * 0.25) * s, 0), leafMat);
    leaf.position.set(x + (Math.random() - 0.5) * 0.8 * s, (2.6 + i * 0.9) * s, z + (Math.random() - 0.5) * 0.8 * s);
    leaf.rotation.set(Math.random(), Math.random(), Math.random());
    leaf.castShadow = true;
    group.add(leaf);
  }
}

function sun(group, color, intensity, pos) {
  const d = new THREE.DirectionalLight(color, intensity);
  d.position.copy(pos);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  Object.assign(d.shadow.camera, { left: -16, right: 16, top: 22, bottom: -22, near: 1, far: 120 });
  d.shadow.bias = -0.0004;
  d.shadow.normalBias = 0.02;
  group.add(d, d.target);
  return d;
}

function ground(group, color, size = 300) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.01;
  m.receiveShadow = true;
  group.add(m);
}

function courtMesh(group, spec) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 36), new THREE.MeshStandardMaterial({ map: courtTexture(spec), roughness: spec.rough ?? 0.85 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  group.add(m);
}

export function buildVenue(id) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
  let surf, fog = null, exposure = 1;
  const seats = [];

  if (id === 'stadion') {
    surf = { e: 0.76, fric: 0.8 };
    group.add(sky('#4d9cff', '#d6ecff', '#7fb08a'));
    ground(group, '#3f8f52');
    courtMesh(group, { inner: '#3c78c8', outer: '#3f9b5a', noise: 10 });
    group.add(new THREE.HemisphereLight(0xdcefff, 0x3f6b48, 1.0));
    sun(group, 0xfff2df, 2.6, new THREE.Vector3(14, 30, 10));
    for (const s of [-1, 1]) {
      seats.push(...stand(group, uniforms, { center: new THREE.Vector3(s * 12, 0, 0), length: 34, rows: 9, ry: -s * Math.PI / 2, color: '#d9dce3' }));
      seats.push(...stand(group, uniforms, { center: new THREE.Vector3(0, 0, s * 21), length: 22, rows: 6, ry: s > 0 ? Math.PI : 0, color: '#d9dce3' }));
      boards(group, s * 18, 0, 0, 18, ['#ff5a4e', '#3d8bff', '#ffd23f', '#2ec27e']);
      boards(group, 0, s * 8.8, Math.PI / 2, 36, ['#3d8bff', '#ffd23f', '#ff5a4e', '#8f5bff']);
    }
    umpire(group, -7.2);
  } else if (id === 'gzowo') {
    surf = { e: 0.66, fric: 0.88 };
    group.add(sky('#5bb4ff', '#fff1d0', '#7fb06a'));
    ground(group, '#5aa848');
    courtMesh(group, { outer: '#5fbf4e', stripes: ['#62c451', '#56b346'], wear: 'rgba(150,140,90,0.35)', noise: 14 });
    group.add(new THREE.HemisphereLight(0xfff4dc, 0x557a3c, 1.0));
    sun(group, 0xffe2b8, 2.8, new THREE.Vector3(-20, 24, 12));
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3e, roughness: 0.9 });
    for (const s of [-1, 1]) {
      for (let z = -20; z <= 20; z += 2.5) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), fenceMat);
        post.position.set(s * 10, 0.6, z);
        post.castShadow = true;
        group.add(post);
      }
      for (const y of [0.45, 0.95]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 40), fenceMat);
        rail.position.set(s * 10, y, 0);
        group.add(rail);
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 30;
      tree(group, Math.cos(a) * r * 0.8, Math.sin(a) * r, 1 + Math.random() * 0.8);
    }
    for (const z of [-6, -2, 2, 6]) {
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.6), new THREE.MeshStandardMaterial({ color: ['#ff5a4e', '#ffd23f', '#3d8bff', '#ffffff'][(z + 6) / 4 | 0] }));
      chair.position.set(-12, 0.3, z);
      chair.rotation.z = -0.25;
      chair.castShadow = true;
      group.add(chair);
      seats.push({ p: new THREE.Vector3(-12, 0.1, z), ry: Math.PI / 2 });
    }
    const house = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 6), new THREE.MeshStandardMaterial({ color: '#f2e6cf' }));
    house.position.set(18, 2, -32);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 3, 4), new THREE.MeshStandardMaterial({ color: '#b5442f', flatShading: true }));
    roof.position.set(18, 5.5, -32);
    roof.rotation.y = Math.PI / 4;
    for (const m of [house, roof]) { m.castShadow = true; group.add(m); }
  } else if (id === 'maczka') {
    surf = { e: 0.8, fric: 0.7 };
    group.add(sky('#6aaeff', '#f4e7d6', '#a4704f'));
    ground(group, '#b75d35');
    courtMesh(group, { inner: '#d8703f', outer: '#cf6a3b', noise: 26, rough: 0.95 });
    group.add(new THREE.HemisphereLight(0xfff0e0, 0x8a4b2c, 1.0));
    sun(group, 0xfff0d8, 2.6, new THREE.Vector3(10, 28, -14));
    const wallMat = new THREE.MeshStandardMaterial({ color: '#1f4d36', roughness: 0.8 });
    for (const s of [-1, 1]) {
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 37), wallMat);
      w1.position.set(s * 9.6, 1.5, 0);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(19.5, 3, 0.3), wallMat);
      w2.position.set(0, 1.5, s * 18.6);
      for (const w of [w1, w2]) { w.receiveShadow = true; group.add(w); }
      const sideStand = stand(group, uniforms, { center: new THREE.Vector3(s * 10.4, 0, 0), length: 34, rows: 8, ry: -s * Math.PI / 2, color: '#2c6b4b', rise: 0.6 });
      sideStand.forEach(st => { st.p.y += 3.0; });
      group.children.slice(-8).forEach(m => { m.position.y += 3.0; });
      seats.push(...sideStand);
      for (let z = -15; z <= 15; z += 3) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#7a3b22' }));
        pot.position.set(s * 9.0, 0.25, z);
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: ['#ff4f7a', '#ffd23f', '#ffffff'][Math.abs(z / 3) % 3], flatShading: true }));
        fl.position.set(s * 9.0, 0.7, z);
        group.add(pot, fl);
      }
    }
    umpire(group, -7.2);
  } else {
    surf = { e: 0.76, fric: 0.8 };
    exposure = 1.15;
    group.add(sky('#070a1f', '#3a1f5e', '#090912'));
    fog = new THREE.Fog(0x170f2c, 60, 220);
    ground(group, '#1c1a2a', 60);
    courtMesh(group, { inner: '#7346e0', outer: '#2a2352', noise: 8, rough: 0.6 });
    group.add(new THREE.HemisphereLight(0x8c7cff, 0x1a1030, 0.7));
    sun(group, 0xe8ecff, 2.4, new THREE.Vector3(6, 26, 8));
    const neon = ['#ff3fb4', '#3ff0ff', '#ffe03f'];
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 38), new THREE.MeshStandardMaterial({ color: neon[0], emissive: neon[s > 0 ? 0 : 1], emissiveIntensity: 2.2 }));
      strip.position.set(s * 9.5, 0.1, 0);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(19, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: neon[2], emissive: neon[2], emissiveIntensity: 2 }));
      strip2.position.set(0, 0.1, s * 19);
      group.add(strip, strip2);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 40), new THREE.MeshStandardMaterial({ color: '#c9c9d6', metalness: 0.8, roughness: 0.3 }));
      rail.position.set(s * 12, 0.55, 0);
      group.add(rail);
      seats.push(...stand(group, uniforms, { center: new THREE.Vector3(s * 11, 0, 0), length: 26, rows: 3, ry: -s * Math.PI / 2, color: '#2c2840', density: 0.6 }));
    }
    const winTex = canvasTex(64, 128, (g, w, h) => {
      g.fillStyle = '#0d0f1f';
      g.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) {
        if (Math.random() < 0.45) {
          g.fillStyle = ['#ffd27a', '#fff3c4', '#9fd8ff', '#ff9ad8'][(Math.random() * 4) | 0];
          g.fillRect(x, y, 4, 5);
        }
      }
    });
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = 85 + Math.random() * 130;
      const w = 10 + Math.random() * 18, h = 30 + Math.random() * 80;
      const t = winTex.clone();
      t.needsUpdate = true;
      t.repeat.set(w / 10, h / 20);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: '#141628', emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.1, map: t }));
      b.position.set(Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r);
      group.add(b);
    }
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.1;
      v.multiplyScalar(380);
      sp.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })));
  }

  group.add(makeNet());
  if (seats.length) group.add(crowd(seats, uniforms));

  return {
    id,
    group,
    surf,
    fog,
    exposure,
    update(t, excite) {
      uniforms.uTime.value = t;
      uniforms.uExcite.value = excite;
    },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose();
          m.dispose();
        }
      });
    },
  };
}
