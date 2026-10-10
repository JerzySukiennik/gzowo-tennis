// Gzowo Tennis match: tie-break rules, serve flow, swept racket contact, assisted shot aiming and bots.
import * as THREE from 'three';
import { COURT, BALL_R, TIEBREAK_TO } from './config.js';
import { solveShot, predict, landing } from './ball.js';
import { serveSpot, receiveSpot } from './player.js';

const TOL = BALL_R;

export class Match {
  constructor(players, ball, hooks) {
    this.players = players;
    this.ball = ball;
    this.hooks = hooks;
    this.state = 'idle';
    this.scores = [0, 0];
    this.surf = { e: 0.76, fric: 0.8 };
    this.assist = { move: 0.5, reach: 0.32 };
    this.excite = 0;
  }

  start(surf, assist, demo = false) {
    this.surf = surf;
    this.assist = assist;
    this.demo = demo;
    this.scores = [0, 0];
    this.pointIndex = 0;
    this.first = Math.random() < 0.5 ? 0 : 1;
    this.faults = 0;
    this.winner = null;
    this.toSetup(0.4);
    this.hooks.score();
  }

  get serverIdx() {
    const n = this.pointIndex;
    if (n === 0) return this.first;
    return Math.floor((n - 1) / 2) % 2 === 0 ? 1 - this.first : this.first;
  }

  get deuce() { return this.pointIndex % 2 === 0; }

  toSetup(delay) {
    this.state = 'setup';
    this.timer = delay;
    this.ball.hide();
    this.lastHitter = null;
    this.bounces = 0;
    this.serveLive = false;
    this.prediction = null;
    const s = this.players[this.serverIdx], r = this.players[1 - this.serverIdx];
    s.anchor(serveSpot(s, this.deuce));
    r.anchor(receiveSpot(r, this.deuce));
    s.resetRacket();
    r.resetRacket();
    this.hooks.score();
  }

  toss() {
    const s = this.players[this.serverIdx];
    const p = s.body.clone().addScaledVector(s.right, 0.35).addScaledVector(s.facing, 0.4);
    p.y = 1.3;
    this.ball.place(p, new THREE.Vector3(0, 5.4, 0), 0);
    this.state = 'toss';
    this.lastHitter = null;
    this.bounces = 0;
    this.hooks.sound('toss');
    if (!s.isBot) this.hooks.haptic(s, 0.25, 0.9);
  }

  award(winnerIdx, text) {
    if (this.state === 'point' || this.state === 'over') return;
    this.scores[winnerIdx]++;
    this.state = 'point';
    this.timer = 2.0;
    this.ball.s.v.multiplyScalar(0.5);
    const w = this.players[winnerIdx], l = this.players[1 - winnerIdx];
    this.excite = 1;
    this.hooks.point(w, l, text);
    this.hooks.score();
    const [a, b] = this.scores;
    if ((a >= TIEBREAK_TO || b >= TIEBREAK_TO) && Math.abs(a - b) >= 2) {
      this.winner = winnerIdx;
      this.timer = 2.4;
    }
  }

  fault(text) {
    this.faults++;
    const receiver = 1 - this.serverIdx;
    if (this.faults >= 2) {
      this.faults = 0;
      this.award(receiver, 'Podwójny błąd');
    } else {
      this.state = 'fault';
      this.timer = 1.4;
      this.hooks.callout(text, '#ffffff');
      this.hooks.sound('ooh');
    }
  }

  canHit(pl) {
    if (pl.cooldown > 0 || !this.ball.active) return false;
    if (this.state === 'toss') return pl.idx === this.serverIdx;
    if (this.state !== 'rally') return false;
    if (this.lastHitter === pl) return false;
    return Math.sign(this.ball.s.p.z) === pl.side;
  }

  contactFor(pl) {
    if (this.state === 'toss' && pl.idx === this.serverIdx) return this.ball.s.p.clone();
    if (this.prediction && this.prediction.side === pl.side) return this.prediction.p;
    return null;
  }

  refreshPrediction() {
    if (!this.lastHitter) { this.prediction = null; return; }
    const side = -this.lastHitter.side;
    const pr = predict({ ...this.ball.s, bounced: Math.sign(this.ball.s.p.z) === side ? this.bounces : 0 }, this.surf, side);
    this.prediction = pr ? { side, p: pr.p } : null;
    if (this.bounces === 0) {
      const land = landing(this.ball.s.p, this.ball.s.v, this.ball.s.spin, this.surf);
      this.landsIn = !!land && !land.net && Math.abs(land.x) <= COURT.halfW && Math.abs(land.z) <= COURT.halfLen && Math.sign(land.z) === side;
    }
  }

  shoot(pl, info) {
    const ball = this.ball;
    const serving = this.state === 'toss';
    const from = ball.s.p.clone();
    const oppSide = -pl.side;
    let p, yaw, spin = 0, lob = false;
    if (pl.isBot) {
      p = serving ? 0.55 + Math.random() * 0.35 : 0.35 + Math.random() * 0.5;
      yaw = (Math.random() - 0.5) * 0.7 - from.x * 0.04 * pl.side;
      spin = Math.random() * 0.6;
      lob = !serving && Math.random() < 0.06;
    } else {
      const v = info.vel;
      const speed = Math.hypot(v.x, v.z) + Math.abs(v.y) * 0.35;
      p = THREE.MathUtils.clamp((speed - 1.5) / 12, 0.08, 1);
      const n = info.normal.clone();
      if (n.dot(pl.facing) < 0) n.negate();
      const nh = new THREE.Vector3(n.x, 0, n.z);
      const vh = new THREE.Vector3(v.x, 0, v.z);
      const dir = nh.lengthSq() > 0.01 ? nh.normalize() : pl.facing.clone();
      if (vh.lengthSq() > 1) dir.lerp(vh.normalize(), 0.45);
      yaw = Math.atan2(dir.dot(pl.right), Math.max(0.2, dir.dot(pl.facing)));
      yaw = THREE.MathUtils.clamp(yaw, -0.75, 0.75);
      spin = THREE.MathUtils.clamp(v.y / 6, -0.6, 1);
      lob = !serving && n.y > 0.5 && v.y > 1;
    }
    const zSign = oppSide;
    let target, speedH, clear, netMiss = false;
    if (serving) {
      const boxSign = -Math.sign(pl.body.x || pl.side);
      const depth = THREE.MathUtils.lerp(4.4, 6.2, p);
      const x = THREE.MathUtils.clamp(boxSign * 2.0 + Math.tan(yaw) * 3.2 * Math.sign(pl.right.x), -COURT.halfW - 1, COURT.halfW + 1);
      target = new THREE.Vector3(x, BALL_R, zSign * depth);
      speedH = THREE.MathUtils.lerp(13, 23, p);
      clear = 0.22;
      spin = Math.max(0, spin) * 0.5;
    } else if (lob) {
      const depth = THREE.MathUtils.lerp(8.5, 12.6, p);
      const x = from.x * 0.3 + Math.tan(yaw) * (depth + Math.abs(from.z)) * 0.45 * Math.sign(pl.right.x);
      target = new THREE.Vector3(THREE.MathUtils.clamp(x, -COURT.halfW - 1.5, COURT.halfW + 1.5), BALL_R, zSign * depth);
      speedH = THREE.MathUtils.lerp(7, 10, p);
      clear = 3.2;
      spin = 0.1;
    } else {
      const depth = THREE.MathUtils.lerp(5.0, 12.5, p);
      const x = from.x * 0.25 + Math.tan(yaw) * (depth + Math.abs(from.z)) * 0.45 * Math.sign(pl.right.x);
      target = new THREE.Vector3(THREE.MathUtils.clamp(x, -COURT.halfW - 1.5, COURT.halfW + 1.5), BALL_R, zSign * depth);
      speedH = THREE.MathUtils.lerp(11, 22, p);
      clear = 0.3 + (1 - p) * 0.45;
    }
    if (pl.isBot) {
      target.x += (Math.random() - 0.5) * 1.2;
      target.z += (Math.random() - 0.5) * 1.4 * zSign;
      if (!serving) target.x = THREE.MathUtils.clamp(target.x, -COURT.halfW + 0.3, COURT.halfW - 0.3);
      const miss = Math.random();
      if (miss < 0.06) target.x = Math.sign(target.x || 1) * (COURT.halfW + 0.4 + Math.random());
      else if (miss < 0.1) target.z = zSign * (COURT.halfLen + 0.5 + Math.random());
      else if (miss < 0.15) netMiss = true;
    }
    const vel = solveShot(from, target, speedH, spin, this.surf, clear);
    if (netMiss) vel.y *= 0.5;
    ball.s.v.copy(vel);
    ball.s.spin = spin;
    this.serveLive = serving;
    this.lastHitter = pl;
    this.bounces = 0;
    this.state = 'rally';
    pl.cooldown = 0.35;
    pl.swing = 1;
    pl.swingDir = Math.sign((from.x - pl.body.x) * pl.side) || 1;
    for (const o of this.players) if (o !== pl) o.cooldown = 0;
    this.refreshPrediction();
    this.excite = Math.min(1, this.excite + p * 0.5);
    this.hooks.hit(pl, p, serving);
  }

  sweep(dt) {
    const N = 10;
    const h = dt / N;
    const ev = [];
    const before = new THREE.Vector3();
    const c0 = new THREE.Vector3(), c1 = new THREE.Vector3(), n0 = new THREE.Vector3(), n1 = new THREE.Vector3(), rel = new THREE.Vector3();
    for (let k = 1; k <= N; k++) {
      if (!this.ball.active) return;
      before.copy(this.ball.s.p);
      ev.length = 0;
      this.ball.step(h, this.surf, ev);
      for (const e of ev) this.onEvent(e);
      if (this.state !== 'rally' && this.state !== 'toss') continue;
      for (const pl of this.players) {
        if (!this.canHit(pl)) continue;
        if (pl.isBot) {
          const reach = pl.body.clone().addScaledVector(pl.right, (Math.sign((this.ball.s.p.x - pl.body.x) * pl.side) || 1) * 0.75);
          reach.y = this.ball.s.p.y;
          const d = reach.distanceTo(this.ball.s.p);
          const okHeight = this.ball.s.p.y > 0.3 && this.ball.s.p.y < (this.state === 'toss' ? 2.9 : 2.2);
          const ready = this.state === 'toss' ? this.ball.s.v.y < -0.5 : (this.bounces >= 1 && this.ball.s.p.y > 0.7) || (this.bounces === 0 && this.landsIn && this.ball.s.p.y > 0.8 && Math.abs(this.ball.s.p.z) > COURT.serviceLen);
          if (d < 0.9 && okHeight && ready) this.shoot(pl, null);
          continue;
        }
        if (this.state === 'toss') {
          if (pl.headVel.length() > 4 && this.ball.s.v.y < 2 && this.ball.s.p.y > 0.8) {
            this.shoot(pl, { vel: pl.headVel.clone(), normal: pl.normal.clone() });
            break;
          }
          continue;
        }
        const t0 = (k - 1) / N, t1 = k / N;
        c0.lerpVectors(pl.prevHead, pl.head, t0);
        c1.lerpVectors(pl.prevHead, pl.head, t1);
        n0.lerpVectors(pl.prevNormal, pl.normal, t0).normalize();
        n1.lerpVectors(pl.prevNormal, pl.normal, t1).normalize();
        const d0 = before.clone().sub(c0).dot(n0);
        rel.copy(this.ball.s.p).sub(c1);
        const d1 = rel.dot(n1);
        const inPlane = rel.addScaledVector(n1, -d1).length();
        const crossed = Math.sign(d0) !== Math.sign(d1) || Math.abs(d1) < BALL_R + 0.03;
        const near = this.ball.s.p.distanceTo(c1) < this.assist.reach * 1.25 && pl.headVel.length() > 3;
        if ((crossed && inPlane < this.assist.reach) || near) {
          this.shoot(pl, { vel: pl.headVel.clone(), normal: n1.clone() });
          break;
        }
      }
    }
  }

  onEvent(e) {
    if (e.type === 'bounce') this.hooks.sound('bounce', e.speed);
    if (this.state === 'toss') {
      return;
    }
    if (this.state !== 'rally' || !this.lastHitter) return;
    const hitter = this.lastHitter;
    const receiver = this.players[1 - hitter.idx];
    if (e.type === 'net') {
      this.hooks.sound('net');
      if (this.serveLive) this.fault('Siatka');
      else this.award(receiver.idx, 'Siatka');
      return;
    }
    const side = Math.sign(e.z) || hitter.side;
    this.bounces++;
    if (this.bounces === 1) {
      if (side === hitter.side) { this.award(receiver.idx, 'Nie przeszła'); return; }
      let inside;
      if (this.serveLive) {
        const boxSign = -Math.sign(hitter.body.x || hitter.side);
        inside = e.x * boxSign >= -TOL && Math.abs(e.x) <= COURT.halfW + TOL && Math.abs(e.z) <= COURT.serviceLen + TOL;
        if (!inside) { this.fault('Błąd serwisu'); return; }
      } else {
        inside = Math.abs(e.x) <= COURT.halfW + TOL && Math.abs(e.z) <= COURT.halfLen + TOL;
        if (!inside) { this.award(receiver.idx, 'Aut'); return; }
      }
      this.hooks.landed(e.x, e.z);
      this.refreshPrediction();
    } else if (this.bounces >= 2) {
      this.award(hitter.idx, this.serveLive ? 'As!' : 'Punkt!');
    }
  }

  update(dt) {
    this.excite = Math.max(0, this.excite - dt * 0.6);
    const ctxFor = pl => ({
      contact: this.contactFor(pl),
      assist: this.assist,
      ballPos: this.ball.active ? this.ball.s.p : null,
      returnHome: this.lastHitter === pl,
    });
    for (const pl of this.players) pl.update(dt, ctxFor(pl));

    if (this.state === 'setup') {
      this.timer -= dt;
      if (this.timer <= 0) this.toss();
    } else if (this.state === 'fault') {
      this.timer -= dt;
      this.sweep(dt);
      if (this.timer <= 0) { const f = this.faults; this.toSetup(0.5); this.faults = f; }
    } else if (this.state === 'toss') {
      this.sweep(dt);
      if (this.state === 'toss' && this.ball.s.p.y < 0.5 && this.ball.s.v.y < 0) this.toSetup(0.6);
    } else if (this.state === 'rally') {
      this.sweep(dt);
      const p = this.ball.s.p;
      if (this.state === 'rally' && (Math.abs(p.z) > 32 || Math.abs(p.x) > 20)) {
        const receiver = this.players[1 - this.lastHitter.idx];
        this.award(this.bounces === 0 ? receiver.idx : this.lastHitter.idx, this.bounces === 0 ? 'Aut' : 'Punkt!');
      }
    } else if (this.state === 'point') {
      this.timer -= dt;
      if (this.ball.active) this.ball.step(dt, this.surf, null);
      if (this.timer <= 0) {
        if (this.winner !== null) {
          this.state = 'over';
          this.ball.hide();
          this.hooks.over(this.players[this.winner]);
        } else {
          this.pointIndex++;
          this.faults = 0;
          this.toSetup(0.8);
        }
      }
    }
    this.ball.sync(dt);
  }
}
