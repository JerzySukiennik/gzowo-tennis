// Gzowo Tennis player: hand-scripted stylized character, racket, phone-driven or bot-driven movement.
import * as THREE from 'three';
import { PLAYERS, COURT, GRIP_HEIGHT, HEAD_OFFSET } from './config.js';
import { PhoneRig } from './rig.js';

const UP = new THREE.Vector3(0, 1, 0);
const SKIN = '#e9b48d';

function limb(mat, r, len) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2 - r * 0.2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function racketMesh(color) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const gripMat = new THREE.MeshStandardMaterial({ color: '#202026', roughness: 0.7 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.2, 10), gripMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.x = -0.02;
  const throatGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8);
  for (const s of [-1, 1]) {
    const th = new THREE.Mesh(throatGeo, frameMat);
    th.rotation.z = Math.PI / 2 + s * 0.35;
    th.position.set(-0.155, s * 0.02, 0);
    g.add(th);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.011, 8, 40), frameMat);
  ring.scale.set(1.18, 0.92, 1);
  ring.position.x = -HEAD_OFFSET;
  const strTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.lineWidth = 2;
    for (let i = 4; i < 128; i += 9) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32), new THREE.MeshBasicMaterial({ map: strTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 }));
  strings.scale.copy(ring.scale);
  strings.position.x = -HEAD_OFFSET;
  for (const m of [handle, ring]) { m.castShadow = true; g.add(m); }
  g.add(strings);
  return g;
}

export class Player {
  constructor(scene, idx) {
    this.idx = idx;
    this.cfg = PLAYERS[idx];
    this.side = this.cfg.side;
    this.facing = new THREE.Vector3(0, 0, -this.side);
    this.right = new THREE.Vector3(this.side, 0, 0);
    this.rig = new PhoneRig(this.side);
    this.phoneId = null;
    this.isBot = true;

    this.home = new THREE.Vector3(0, 0, this.side * 12.4);
    this.body = this.home.clone();
    this.prevBody = this.body.clone();
    this.botTarget = this.home.clone();
    this.assist = new THREE.Vector3();

    this.grip = new THREE.Vector3();
    this.rq = new THREE.Quaternion();
    this.head = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.prevHead = new THREE.Vector3();
    this.prevNormal = new THREE.Vector3();
    this.headVel = new THREE.Vector3();
    this.swing = 0;
    this.swingDir = 1;
    this.cooldown = 0;
    this.walk = 0;
    this.lookAt = new THREE.Vector3(0, 1, 0);

    const color = this.cfg.color;
    const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
    const white = new THREE.MeshStandardMaterial({ color: '#f4f4f6', roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1d1d24', roughness: 0.5 });

    this.root = new THREE.Group();
    this.rotor = new THREE.Group();
    this.root.add(this.rotor);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 6, 14), shirt);
    torso.position.y = 1.28;
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.26, 14), white);
    shorts.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), skin);
    head.position.y = 1.78;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 24), shirt);
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.83;
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), dark);
      eye.position.set(s * 0.055, 1.79, -0.135);
      this.rotor.add(eye);
    }
    for (const m of [torso, shorts, head, band]) { m.castShadow = true; this.rotor.add(m); }
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, 0.88, 0);
      const leg = limb(skin, 0.07, 0.7);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), white);
      shoe.position.set(0, -0.84, -0.04);
      shoe.castShadow = true;
      hip.add(leg, shoe);
      this.rotor.add(hip);
      this.legs.push(hip);
    }
    this.freeArm = new THREE.Group();
    this.freeArm.position.set(-0.27, 1.5, 0);
    this.freeArm.add(limb(skin, 0.055, 0.55));
    this.rotor.add(this.freeArm);

    this.upper = limb(skin, 0.058, 0.3);
    this.lower = limb(skin, 0.05, 0.28);
    this.sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), shirt);
    this.racket = racketMesh(color);
    scene.add(this.root, this.upper, this.lower, this.sleeve, this.racket);

    const ringGeo = new THREE.RingGeometry(0.45, 0.6, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.marker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
    this.marker.position.y = 0.012;
    scene.add(this.marker);

    this.resetRacket();
  }

  setHuman(phoneId) {
    this.phoneId = phoneId;
    this.isBot = !phoneId;
    if (!phoneId) this.rig.cal = null;
  }

  resetRacket() {
    this.updateBotRacket(0);
    this.prevHead.copy(this.head);
    this.prevNormal.copy(this.normal);
    this.headVel.set(0, 0, 0);
  }

  anchor(pos) {
    this.home.copy(pos);
    this.assist.set(0, 0, 0);
    if (!this.isBot && this.rig.cal) this.home.sub(this.rig.bodyOffset);
    this.body.copy(pos);
    this.botTarget.copy(pos);
    this.prevBody.copy(pos);
  }

  clampBody() {
    this.body.x = THREE.MathUtils.clamp(this.body.x, -7.5, 7.5);
    const z = this.body.z * this.side;
    this.body.z = THREE.MathUtils.clamp(z, 0.6, 17) * this.side;
  }

  updateBotRacket(dt) {
    this.swing = Math.max(0, this.swing - dt * 2.6);
    const s = this.swing;
    const ph = s > 0 ? 1 - s : 0;
    const arc = s > 0 ? Math.sin(ph * Math.PI) : 0;
    const side = this.swingDir;
    const yaw = s > 0 ? -side * (1.2 - ph * 2.4) : side * 0.4;
    this.grip.copy(this.body)
      .addScaledVector(this.right, side * (0.42 + 0.15 * arc))
      .addScaledVector(this.facing, 0.25 + 0.3 * arc);
    this.grip.y = GRIP_HEIGHT - 0.1 + 0.15 * arc;
    const bx = this.right.clone().multiplyScalar(-side);
    const base = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx, UP.clone(), bx.clone().cross(UP)));
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * 0.25);
    this.rq.setFromAxisAngle(UP, yaw).multiply(base).multiply(tilt);
  }

  update(dt, ctx) {
    this.prevHead.copy(this.head);
    this.prevNormal.copy(this.normal);
    this.prevBody.copy(this.body);
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (!this.isBot && this.rig.cal) {
      this.rig.update(dt);
      if (ctx.contact && ctx.assist.move > 0) {
        const want = ctx.contact.clone();
        const hand = Math.sign((want.x - this.body.x) * this.side) || 1;
        want.addScaledVector(this.right, -hand * 0.75).addScaledVector(this.facing, -0.25);
        const raw = this.home.clone().add(this.rig.bodyOffset);
        const target = want.sub(raw).multiplyScalar(ctx.assist.move);
        target.y = 0;
        this.assist.lerp(target, 1 - Math.exp(-dt * 3.5));
      }
      this.body.copy(this.home).add(this.rig.bodyOffset).add(this.assist);
      this.clampBody();
      this.grip.copy(this.body).add(this.rig.armOffset);
      this.grip.y = GRIP_HEIGHT + this.rig.armOffset.y;
      this.rq.copy(this.rig.racketQuat);
    } else {
      if (ctx.contact && this.isBot) {
        const hand = Math.sign((ctx.contact.x - this.body.x) * this.side) || 1;
        this.swingDir = hand;
        this.botTarget.copy(ctx.contact).addScaledVector(this.right, -hand * 0.7).addScaledVector(this.facing, -0.3);
        this.botTarget.y = 0;
      } else if (ctx.returnHome) {
        this.botTarget.set(this.botTarget.x * 0.98, 0, this.side * 12.2);
      }
      const d = this.botTarget.clone().sub(this.body);
      d.y = 0;
      const maxStep = (ctx.contact ? 7.5 : 3.5) * dt;
      if (d.length() > maxStep) d.setLength(maxStep);
      this.body.add(d);
      this.clampBody();
      this.updateBotRacket(dt);
    }

    this.head.set(-HEAD_OFFSET, 0, 0).applyQuaternion(this.rq).add(this.grip);
    this.normal.set(0, 0, 1).applyQuaternion(this.rq);
    if (dt > 0) this.headVel.copy(this.head).sub(this.prevHead).divideScalar(dt);

    this.animate(dt, ctx);
  }

  animate(dt, ctx) {
    this.root.position.copy(this.body);
    const look = (ctx.ballPos ? ctx.ballPos.clone() : new THREE.Vector3(0, 1, -this.side * 5)).sub(this.body);
    look.y = 0;
    look.lerp(this.facing.clone().multiplyScalar(4), 0.6);
    const yaw = Math.atan2(-look.x, -look.z);
    let dy = yaw - this.rotor.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.rotor.rotation.y += dy * Math.min(1, dt * 8);
    const speed = dt > 0 ? this.body.distanceTo(this.prevBody) / dt : 0;
    this.walk += speed * dt * 3.2;
    const amp = Math.min(0.7, speed * 0.18);
    this.legs[0].rotation.x = Math.sin(this.walk) * amp;
    this.legs[1].rotation.x = -Math.sin(this.walk) * amp;
    this.freeArm.rotation.x = -Math.sin(this.walk) * amp * 0.8;
    this.root.position.y = Math.abs(Math.sin(this.walk)) * amp * 0.06;
    this.marker.position.x = this.body.x;
    this.marker.position.z = this.body.z;

    this.rotor.updateMatrixWorld(true);
    const shoulder = new THREE.Vector3(0.27, 1.5, 0).applyMatrix4(this.rotor.matrixWorld);
    const toGrip = this.grip.clone().sub(shoulder);
    const dist = toGrip.length();
    const L = 0.62;
    const stretch = Math.max(1, dist / L);
    const half = (L / 2) * stretch;
    const bendH = dist < L ? Math.sqrt(Math.max(0, half * half - (dist / 2) ** 2)) : 0;
    const mid = shoulder.clone().addScaledVector(toGrip, 0.5);
    const pole = new THREE.Vector3(0, -1, 0).addScaledVector(this.facing, 0.4);
    const n = toGrip.clone().normalize();
    pole.addScaledVector(n, -pole.dot(n)).normalize();
    const elbow = mid.addScaledVector(pole, bendH);
    this.placeLimb(this.upper, shoulder, elbow, stretch);
    this.placeLimb(this.lower, elbow, this.grip, stretch);
    this.sleeve.position.copy(shoulder);
    this.racket.position.copy(this.grip);
    this.racket.quaternion.copy(this.rq);
  }

  placeLimb(mesh, a, b, stretch) {
    mesh.position.copy(a);
    const dir = b.clone().sub(a);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    mesh.scale.set(1, stretch, 1);
  }
}

export function serveSpot(player, deuce) {
  const x = player.side * (deuce ? 1 : -1) * 0.9;
  return new THREE.Vector3(x, 0, player.side * (COURT.halfLen + 0.4));
}

export function receiveSpot(player, deuce) {
  const x = player.side * (deuce ? 1 : -1) * 2.6;
  return new THREE.Vector3(x, 0, player.side * (COURT.halfLen + 0.8));
}
