// Gzowo Tennis ball: integrator with drag, topspin, bounces and net, plus the shot solver built on it.
import * as THREE from 'three';
import { BALL_R, G, DRAG, MAGNUS, COURT, netHeight } from './config.js';

const SUB = 1 / 240;

export function integrate(s, dt, surf, events) {
  const p = s.p, v = s.v;
  const px = p.x, py = p.y, pz = p.z;
  const speed = Math.hypot(v.x, v.y, v.z);
  const ax = -DRAG * speed * v.x;
  const ay = -DRAG * speed * v.y - G - MAGNUS * s.spin * Math.min(1.5, speed / 20);
  const az = -DRAG * speed * v.z;
  v.x += ax * dt;
  v.y += ay * dt;
  v.z += az * dt;
  p.x += v.x * dt;
  p.y += v.y * dt;
  p.z += v.z * dt;
  if (pz !== 0 && Math.sign(pz) !== Math.sign(p.z) && Math.abs(px) < COURT.netHalfW + 0.2) {
    const t = pz / (pz - p.z);
    const yAt = py + (p.y - py) * t;
    const xAt = px + (p.x - px) * t;
    if (yAt < netHeight(xAt) + BALL_R && yAt > -0.1) {
      p.z = Math.sign(pz) * BALL_R * 1.5;
      v.z *= -0.12;
      v.x *= 0.3;
      v.y = Math.min(v.y, 0) * 0.3;
      s.spin = 0;
      if (events) events.push({ type: 'net', x: xAt, y: yAt });
    }
  }
  if (p.y < BALL_R && v.y < 0) {
    p.y = BALL_R;
    const vin = -v.y;
    v.y = vin * surf.e;
    const kick = 1 + 0.14 * s.spin;
    v.x *= surf.fric * kick;
    v.z *= surf.fric * kick;
    s.spin *= 0.4;
    if (v.y < 0.35) {
      v.y = 0;
      v.x *= 0.98;
      v.z *= 0.98;
    }
    if (events && vin > 0.35) events.push({ type: 'bounce', x: p.x, z: p.z, speed: vin });
  }
}

export function landing(from, vel, spin, surf, maxT = 6) {
  const s = { p: from.clone(), v: vel.clone(), spin };
  const ev = [];
  for (let t = 0; t < maxT; t += SUB) {
    integrate(s, SUB, surf, ev);
    if (ev.length) {
      const e = ev[0];
      return e.type === 'bounce' ? { x: e.x, z: e.z, t, net: false } : { x: e.x, z: 0, t, net: true };
    }
  }
  return null;
}

function ballistic(from, aim, speedH, spin, clear) {
  const dx = aim.x - from.x, dz = aim.z - from.z;
  const d = Math.max(0.5, Math.hypot(dx, dz));
  const gEff = G + MAGNUS * spin * Math.min(1.5, speedH / 20);
  let T = d / speedH;
  let vy = 0;
  for (let i = 0; i < 40; i++) {
    vy = (BALL_R - from.y + 0.5 * gEff * T * T) / T;
    if (from.z * aim.z < 0) {
      const tn = T * (from.z / (from.z - aim.z));
      const yn = from.y + vy * tn - 0.5 * gEff * tn * tn;
      if (yn < netHeight(from.x + dx * (tn / T)) + clear) { T *= 1.05; continue; }
    }
    break;
  }
  return new THREE.Vector3(dx / T, vy, dz / T);
}

export function solveShot(from, target, speedH, spin, surf, clear = 0.4) {
  const aim = target.clone();
  let vel = ballistic(from, aim, speedH, spin, clear);
  for (let it = 0; it < 4; it++) {
    const land = landing(from, vel, spin, surf);
    if (!land || land.net) break;
    const ex = target.x - land.x, ez = target.z - land.z;
    if (Math.hypot(ex, ez) < 0.06) break;
    aim.x += ex;
    aim.z += ez;
    vel = ballistic(from, aim, speedH, spin, clear);
  }
  return vel;
}

export function predict(state, surf, side, maxT = 4) {
  const s = { p: state.p.clone(), v: state.v.clone(), spin: state.spin };
  const ev = [];
  let bounced = state.bounced || 0;
  let pre = null, deep = null;
  for (let t = 0; t < maxT; t += SUB * 2) {
    ev.length = 0;
    integrate(s, SUB * 2, surf, ev);
    for (const e of ev) {
      if (e.type === 'bounce') bounced++;
      if (e.type === 'net') return null;
    }
    if (Math.sign(s.p.z) !== side) continue;
    if (bounced >= 2) break;
    const z = Math.abs(s.p.z);
    if (bounced === 0 && !pre && z > COURT.serviceLen && s.p.y > 0.7 && s.p.y < 1.5) pre = { p: s.p.clone(), t, bounced };
    if (bounced === 1) {
      if (s.p.y > 0.75 && s.p.y < 1.4) return { p: s.p.clone(), t, bounced };
      if (!deep && z > COURT.halfLen + 3 && s.p.y < 2.2) deep = { p: s.p.clone(), t, bounced };
    }
    if (z > COURT.halfLen + 6) break;
  }
  return deep || pre;
}

export class Ball {
  constructor(scene) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#d9f23a';
    g.fillRect(0, 0, 256, 128);
    const img = g.getImageData(0, 0, 256, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n;
      img.data[i + 1] += n;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 6;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 64 + Math.sin((x / 256) * Math.PI * 4) * 30;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.5, 24, 16),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0x2a3300, emissiveIntensity: 0.6 })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.trailN = 14;
    this.trailPos = new Float32Array(this.trailN * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    const alpha = new Float32Array(this.trailN);
    for (let i = 0; i < this.trailN; i++) alpha[i] = 1 - i / this.trailN;
    tg.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    this.trail = new THREE.Line(tg, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.95,1.0,0.6, vA * 0.55); }',
    }));
    this.trail.frustumCulled = false;
    scene.add(this.trail);

    this.s = { p: new THREE.Vector3(0, -5, 0), v: new THREE.Vector3(), spin: 0 };
    this.active = false;
    this.spinAngle = 0;
  }

  place(p, v = new THREE.Vector3(), spin = 0) {
    this.s.p.copy(p);
    this.s.v.copy(v);
    this.s.spin = spin;
    for (let i = 0; i < this.trailN; i++) p.toArray(this.trailPos, i * 3);
    this.active = true;
    this.sync(0);
  }

  hide() {
    this.active = false;
    this.mesh.visible = false;
    this.trail.visible = false;
  }

  step(dt, surf, events) {
    let t = dt;
    while (t > 1e-6) {
      const h = Math.min(SUB, t);
      integrate(this.s, h, surf, events);
      t -= h;
    }
  }

  sync(dt) {
    this.mesh.visible = this.trail.visible = this.active;
    this.mesh.position.copy(this.s.p);
    this.spinAngle += dt * (8 + this.s.spin * 20);
    this.mesh.rotation.set(this.spinAngle, this.spinAngle * 0.3, 0);
    this.trailPos.copyWithin(3, 0, (this.trailN - 1) * 3);
    this.s.p.toArray(this.trailPos, 0);
    this.trail.geometry.attributes.position.needsUpdate = true;
  }
}
