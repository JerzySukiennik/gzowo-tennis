// Gzowo Tennis phone rig: maps an ARKit iPhone pose (held as a racket handle) to body movement and racket pose on court.
import * as THREE from 'three';
import { ROOM_SCALE, ARM_SCALE } from './config.js';

const BODY_FWD = 0.3;

export class PhoneRig {
  constructor(side) {
    this.facing = new THREE.Vector3(0, 0, -side);
    this.P = new THREE.Vector3();
    this.Q = new THREE.Quaternion();
    this.M = new THREE.Matrix4();
    this.S = new THREE.Vector3();
    this.has = false;
    this.lastPose = -1e9;
    this.quality = 0;
    this.cal = null;
    this.bodySmooth = new THREE.Vector3();
    this.bodyOffset = new THREE.Vector3();
    this.armOffset = new THREE.Vector3();
    this.racketQuat = new THREE.Quaternion();
  }

  read(m, s, now) {
    this.M.fromArray(m);
    this.M.decompose(this.P, this.Q, this.S);
    this.quality = s;
    this.has = true;
    this.lastPose = now;
  }

  live(now) {
    return this.has && now - this.lastPose < 700;
  }

  forwardNow() {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.Q);
    f.y = 0;
    if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
    return f.normalize();
  }

  calibrate() {
    if (!this.has) return false;
    const fwd = this.forwardNow();
    const R = new THREE.Quaternion().setFromUnitVectors(fwd, this.facing);
    const body = this.P.clone().addScaledVector(fwd, -BODY_FWD);
    body.y = 0;
    this.bodySmooth.copy(body);
    this.cal = { R, fwd, body0: body.clone(), y0: this.P.y };
    return true;
  }

  update(dt) {
    if (!this.cal) return;
    const { R, fwd, body0, y0 } = this.cal;
    const target = this.P.clone().addScaledVector(fwd, -BODY_FWD);
    target.y = 0;
    this.bodySmooth.lerp(target, 1 - Math.exp(-dt / 0.3));
    this.bodyOffset.copy(this.bodySmooth).sub(body0).applyQuaternion(R).multiplyScalar(ROOM_SCALE);
    this.bodyOffset.y = 0;
    const arm = this.P.clone().sub(this.bodySmooth);
    arm.y = 0;
    this.armOffset.copy(arm.applyQuaternion(R).multiplyScalar(ARM_SCALE));
    this.armOffset.y = this.P.y - y0;
    this.racketQuat.copy(R).multiply(this.Q);
  }
}
