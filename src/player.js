// First-person walker with voxel collision, step-up onto curbs/thresholds and a gentle head bob.
import * as THREE from 'three';
import { L } from './world.js';

export class Player {
  constructor(camera, world, dom) {
    this.cam = camera; this.world = world;
    // in the corner by the kitchen door, looking across the whole room to the far corner
    this.pos = new THREE.Vector3(15.3, L.floor, 9.45);
    this.vel = new THREE.Vector3();
    this.yaw = 0.82; this.pitch = 0.03;
    this.radius = 0.22; this.height = 1.62; this.eye = 1.55;
    this.keys = {};
    this.bob = 0; this.stepPhase = 0; this.eyeY = this.pos.y + this.eye; this.vy = 0;
    this.onStep = null;
    this.sens = 0.0022; // mouse look, radians per pixel
    this.stick = { x: 0, y: 0 }; // on-screen thumbstick (touch), -1..1, y down = backward
    this.locked = false;
    this.frozen = false; this.nod = 0; // a bow: hold still, dip the head (0..1)
    this.speedMul = 1; // a hot can from the vending machine puts a spring in your step
    addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const k = this.sens * (this.sensMul ?? 1);
      this.yaw -= e.movementX * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * k, -1.35, 1.35);
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === dom; });
  }

  // samples a grid finer than one world voxel so thin posts (door jambs) can't slip between samples
  blocked(x, z, feet) {
    const r = this.radius, W = this.world, doors = !this.inDoor, st = r / 2;
    for (let y = feet + 0.3; y < feet + this.height; y += 0.12)
      for (let dx = -r; dx <= r + 1e-6; dx += st)
        for (let dz = -r; dz <= r + 1e-6; dz += st)
          if (W.solid(x + dx, y, z + dz, doors)) return true;
    return false;
  }
  // true if a closing door has swung onto us; we then ignore doors so we can step out
  touchingDoor() {
    const p = this.pos, r = this.radius, W = this.world;
    if (!W.blockers) return false;
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]])
      for (const b of W.blockers) if (b.blocks(p.x + dx, p.y + 1.0, p.z + dz)) return true;
    return false;
  }
  groundAt(x, z, feet) {
    const r = this.radius * 0.8;
    let g = -10;
    for (const [dx, dz] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) {
      for (let y = feet + 0.3; y > feet - 1.0; y -= 0.0625) {
        if (this.world.solid(x + dx, y, z + dz)) { g = Math.max(g, Math.floor((y + 0.25) / 0.125) * 0.125 - 0.25 + 0.125); break; }
      }
    }
    return g;
  }

  sitOn(seat) {
    this.seated = seat; seat.occupant = 'player';
    this.vel.set(0, 0, 0); this.yaw = seat.yaw; this.pitch = -0.1;
  }
  standUp() {
    const s = this.seated; this.seated = null; s.occupant = null;
    if (s.app) this.pos.set(s.app[0], s.floorY ?? 0.25, s.app[1]);
    this.vy = 0;
  }
  update(dt) {
    if (this.seated) {
      const k = this.locked ? this.keys : {};
      if (k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || (this.locked && Math.hypot(this.stick.x, this.stick.y) > 0.4)) this.standUp();
      else {
        const s = this.seated, back = 0.08, ey = s.y + 0.72;
        this.eyeY += (ey - this.eyeY) * Math.min(1, dt * 6);
        const tx = s.x + Math.sin(s.yaw) * back, tz = s.z + Math.cos(s.yaw) * back;
        this.cam.position.x += (tx - this.cam.position.x) * Math.min(1, dt * 6);
        this.cam.position.z += (tz - this.cam.position.z) * Math.min(1, dt * 6);
        this.cam.position.y = this.eyeY;
        if (k.ArrowLeft) this.yaw += dt * 1.8;
        if (k.ArrowRight) this.yaw -= dt * 1.8;
        this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        return;
      }
    }
    const k = this.locked && !this.frozen ? this.keys : {};
    const st = this.locked && !this.frozen ? this.stick : { x: 0, y: 0 }, push = Math.hypot(st.x, st.y);
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - st.y;
    const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + st.x;
    if (k.ArrowLeft) this.yaw += dt * 1.8;
    if (k.ArrowRight) this.yaw -= dt * 1.8;
    const speed = (k.ShiftLeft || k.ShiftRight || push > 0.95 ? 4.6 : 2.7) * this.speedMul; // push the stick all the way to hurry
    const fw = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rt = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const want = fw.multiplyScalar(f).add(rt.multiplyScalar(s));
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(speed);
    const a = 1 - Math.exp(-dt * 9);
    this.vel.x += (want.x - this.vel.x) * a;
    this.vel.z += (want.z - this.vel.z) * a;

    this.inDoor = this.touchingDoor();
    // horizontal move, axis separated so we slide along walls
    const p = this.pos, B = L.bounds;
    const nx = THREE.MathUtils.clamp(p.x + this.vel.x * dt, B.x0, B.x1);
    if (!this.blocked(nx, p.z, p.y)) p.x = nx; else this.vel.x = 0;
    const nz = THREE.MathUtils.clamp(p.z + this.vel.z * dt, B.z0, B.z1);
    if (!this.blocked(p.x, nz, p.y)) p.z = nz; else this.vel.z = 0;

    // ground follow: step up instantly, fall with gravity
    const g = this.groundAt(p.x, p.z, p.y);
    // only step up if there's headroom up there, otherwise we'd climb walls one step per frame
    if (g > p.y + 0.01 && this.blocked(p.x, p.z, g)) { this.vy = 0; }
    else if (g >= p.y - 0.01) { p.y = g; this.vy = 0; }
    else { this.vy -= 9.8 * dt; p.y = Math.max(g, p.y + this.vy * dt); }

    // head bob + footsteps
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.stepPhase += sp * dt * 1.05;
    const amp = Math.min(1, sp / 2.7);
    this.bob += ((Math.sin(this.stepPhase * Math.PI) * 0.035 * amp) - this.bob) * Math.min(1, dt * 12);
    const ph = Math.floor(this.stepPhase);
    if (ph !== this._lastStep) { this._lastStep = ph; if (sp > 0.4 && this.onStep) this.onStep(); }

    const targetEye = p.y + this.eye;
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 14);
    const n = this.nod, lean = n * 0.22;
    this.cam.position.set(p.x - Math.sin(this.yaw) * lean, this.eyeY + this.bob - n * 0.3, p.z - Math.cos(this.yaw) * lean);
    this.cam.rotation.set(this.pitch - n * 0.95, this.yaw, Math.sin(this.stepPhase * Math.PI * 0.5) * 0.004 * amp, 'YXZ');
  }
}
