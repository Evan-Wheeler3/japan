// Blood, splinters and severed limbs, all in clean little voxels: droplets that arc and land as splats on the
// floor, chunks that bounce and settle, whole limbs that tumble away, and stumps that keep spurting for a moment.
import * as THREE from 'three';

const MAXD = 1200, MAXS = 500, MAXC = 420, MAXE = 160;
const G = 9.8;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

export const BLOOD = [0x8c0a0a, 0x6e0606, 0xa81212, 0x5a0404];

export class Gore {
  constructor(scene) {
    this.scene = scene;
    const box = new THREE.BoxGeometry(1, 1, 1);
    // droplets: tiny cubes in flight
    this.drops = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXD);
    this.drops.count = 0; this.drops.frustumCulled = false; scene.add(this.drops);
    this.d = { p: new Float32Array(MAXD * 3), v: new Float32Array(MAXD * 3), g: new Float32Array(MAXD), s: new Float32Array(MAXD), c: new Uint32Array(MAXD), n: 0 };
    // splats: flat squares on the floor, oldest overwritten first
    const flat = new THREE.BoxGeometry(1, 0.004, 1);
    const sm = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.splats = new THREE.InstancedMesh(flat, sm, MAXS); this.splats.count = 0; this.splats.frustumCulled = false; scene.add(this.splats);
    this.sN = 0; this.grow = []; // pools that spread under a body
    // chunks: bigger tumbling bits (flesh, bone, paper, splinters, shards)
    this.chunks = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXC);
    this.chunks.count = 0; this.chunks.frustumCulled = false; scene.add(this.chunks);
    this.ch = [];
    // embers: glowing bits (burning seals, a musket's flash)
    this.embers = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXE);
    this.embers.count = 0; this.embers.frustumCulled = false; scene.add(this.embers);
    this.em = [];
    this.limbs = []; this.spurts = [];
    // a dummy colour so instanceColor buffers exist from the start
    for (const im of [this.drops, this.splats, this.chunks, this.embers]) { im.setColorAt(0, _c.set(0xffffff)); }
  }
  // ---- droplets
  spray(x, y, z, dx, dy, dz, n, speed, spread, ground, color = BLOOD) {
    const D = this.d;
    for (let i = 0; i < n; i++) {
      if (D.n >= MAXD) this.killDrop(0);
      const k = D.n++, sp = speed * (0.4 + Math.random() * 0.8);
      D.p[k * 3] = x; D.p[k * 3 + 1] = y; D.p[k * 3 + 2] = z;
      D.v[k * 3] = (dx + (Math.random() - 0.5) * spread) * sp;
      D.v[k * 3 + 1] = (dy + (Math.random() - 0.3) * spread) * sp;
      D.v[k * 3 + 2] = (dz + (Math.random() - 0.5) * spread) * sp;
      D.g[k] = ground; D.s[k] = 0.022 + Math.random() * 0.03;
      D.c[k] = Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color;
    }
  }
  killDrop(k) {
    const D = this.d, l = --D.n;
    if (k !== l) {
      for (let a = 0; a < 3; a++) { D.p[k * 3 + a] = D.p[l * 3 + a]; D.v[k * 3 + a] = D.v[l * 3 + a]; }
      D.g[k] = D.g[l]; D.s[k] = D.s[l]; D.c[k] = D.c[l];
    }
  }
  // ---- splats
  splat(x, y, z, size, color = null, grow = 0) {
    const i = this.sN++ % MAXS;
    this.splats.count = Math.min(MAXS, this.sN);
    const col = color ?? BLOOD[(Math.random() * BLOOD.length) | 0];
    const sx = size * (0.7 + Math.random() * 0.6), sz = size * (0.7 + Math.random() * 0.6);
    const yy = y + 0.002 + (i % 7) * 0.0004;
    const s = { i, x, y: yy, z, sx, sz, rot: Math.random() * Math.PI, k: grow ? 0.15 : 1, grow };
    this.setSplat(s);
    this.splats.setColorAt(i, _c.set(col)); this.splats.instanceColor.needsUpdate = true;
    if (grow) this.grow.push(s);
  }
  setSplat(s) {
    if (s.q) _q.copy(s.q); else _q.setFromEuler(_e.set(0, s.rot, 0));
    _s.set(s.sx * s.k, 1, s.sz * s.k); _p.set(s.x, s.y, s.z);
    this.splats.setMatrixAt(s.i, _m.compose(_p, _q, _s)); this.splats.instanceMatrix.needsUpdate = true;
  }
  // blood up a wall: from p along dir (flat), the first wall within reach gets a splash (and a streak running down)
  wall(p, dir, size) {
    const W = this.world; if (!W) return;
    const L = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / L, dz = dir.z / L, y = p.y + (Math.random() - 0.3) * 0.4;
    for (let t = 0.15; t < 1.9; t += 0.05) {
      const x = p.x + dx * t, z = p.z + dz * t;
      if (!W.solid(x, y, z)) continue;
      const bx = p.x + dx * (t - 0.05), bz = p.z + dz * (t - 0.05);
      const nx = W.solid(x, y, bz) && !W.solid(bx, y, bz); // stepping along x is what ran into it: the wall faces x
      const normal = nx ? new THREE.Vector3(-Math.sign(dx), 0, 0) : new THREE.Vector3(0, 0, -Math.sign(dz));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI));
      const i = this.sN++ % MAXS; this.splats.count = Math.min(MAXS, this.sN);
      // snug against the wall face, just proud of it
      const wx = nx ? Math.round(x / 0.125) * 0.125 + normal.x * 0.003 : bx, wz = nx ? bz : Math.round(z / 0.125) * 0.125 + normal.z * 0.003;
      const s = { i, x: nx ? (dx > 0 ? Math.floor(x / 0.125) * 0.125 - 0.003 : Math.ceil(x / 0.125) * 0.125 + 0.003) : wx, y, z: nx ? wz : (dz > 0 ? Math.floor(z / 0.125) * 0.125 - 0.003 : Math.ceil(z / 0.125) * 0.125 + 0.003),
        sx: size * (0.6 + Math.random() * 0.6), sz: size * (0.6 + Math.random() * 0.6), q, k: 1 };
      this.setSplat(s);
      this.splats.setColorAt(i, _c.set(BLOOD[(Math.random() * BLOOD.length) | 0])); this.splats.instanceColor.needsUpdate = true;
      // and a run of drips down from it
      if (Math.random() < 0.7) for (let j = 1; j < 4; j++) {
        const k = this.sN++ % MAXS; this.splats.count = Math.min(MAXS, this.sN);
        const d = { ...s, i: k, y: s.y - j * size * 0.35, sx: size * 0.12, sz: size * 0.3, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal) };
        if (d.y < 0.05) break;
        this.setSplat(d); this.splats.setColorAt(k, _c.set(0x5a0404)); this.splats.instanceColor.needsUpdate = true;
      }
      return;
    }
  }
  // a pool spreading under a body
  pool(x, y, z, size) { this.splat(x, y, z, size, 0x4e0303, 2.5); }
  // ---- chunks
  chunk(x, y, z, vx, vy, vz, color, size, ground, life = 14) {
    if (this.ch.length >= MAXC) this.ch.shift();
    this.ch.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
      w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14), color, size, ground, life, rest: false, bloody: BLOOD.includes(color) });
  }
  burst(x, y, z, n, colors, size, speed, ground, up = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random());
      this.chunk(x, y, z, Math.cos(a) * sp, (0.4 + Math.random()) * speed * up, Math.sin(a) * sp, colors[(Math.random() * colors.length) | 0], size * (0.6 + Math.random() * 0.8), ground);
    }
  }
  ember(x, y, z, vx, vy, vz, color, size, life = 0.8) {
    if (this.em.length >= MAXE) this.em.shift();
    this.em.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), color, size, life, t: 0 });
  }
  fire(x, y, z, n, speed = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * Math.random();
      this.ember(x, y, z, Math.cos(a) * sp, 0.5 + Math.random() * speed, Math.sin(a) * sp, [0xffd060, 0xff8a20, 0xff5010][(Math.random() * 3) | 0], 0.03 + Math.random() * 0.05, 0.4 + Math.random() * 0.7);
    }
  }
  // ---- a severed limb (an Object3D already in the scene) flying off; it settles on the floor and sinks later
  limb(obj, vel, spin, ground, bottom = 0.06) {
    this.limbs.push({ obj, v: vel.clone(), w: spin.clone(), ground, bottom, t: 0, rest: false });
    if (this.limbs.length > 40) { const old = this.limbs.shift(); this.scene.remove(old.obj); }
  }
  // blood pumping from a stump: follows obj, at a local offset, roughly along local dir
  spurt(obj, offset, dir, dur, ground) { this.spurts.push({ obj, offset: offset.clone(), dir: dir.clone(), t: 0, dur, ground, acc: 0 }); }

  update(dt) {
    // droplets
    const D = this.d;
    for (let k = D.n - 1; k >= 0; k--) {
      D.v[k * 3 + 1] -= G * dt;
      D.p[k * 3] += D.v[k * 3] * dt; D.p[k * 3 + 1] += D.v[k * 3 + 1] * dt; D.p[k * 3 + 2] += D.v[k * 3 + 2] * dt;
      if (D.p[k * 3 + 1] <= D.g[k]) {
        if (Math.random() < 0.55) this.splat(D.p[k * 3], D.g[k], D.p[k * 3 + 2], 0.03 + Math.random() * 0.07, D.c[k]);
        this.killDrop(k);
      }
    }
    for (let k = 0; k < D.n; k++) {
      const s = D.s[k];
      _m.makeScale(s, s, s).setPosition(D.p[k * 3], D.p[k * 3 + 1], D.p[k * 3 + 2]);
      this.drops.setMatrixAt(k, _m); this.drops.setColorAt(k, _c.set(D.c[k]));
    }
    this.drops.count = D.n; this.drops.instanceMatrix.needsUpdate = true; if (this.drops.instanceColor) this.drops.instanceColor.needsUpdate = true;
    // pools
    for (let i = this.grow.length - 1; i >= 0; i--) {
      const s = this.grow[i]; s.k = Math.min(1, s.k + dt / s.grow); this.setSplat(s);
      if (s.k >= 1) this.grow.splice(i, 1);
    }
    // chunks
    for (let i = this.ch.length - 1; i >= 0; i--) {
      const c = this.ch[i];
      c.life -= dt; if (c.life <= 0) { this.ch.splice(i, 1); continue; }
      if (!c.rest) {
        c.v.y -= G * dt; c.p.addScaledVector(c.v, dt);
        c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
        if (c.p.y <= c.ground + c.size / 2) {
          c.p.y = c.ground + c.size / 2;
          if (c.v.y < -1.2) { c.v.y *= -0.3; c.v.x *= 0.5; c.v.z *= 0.5; c.w.multiplyScalar(0.5); if (c.bloody && Math.random() < 0.5) this.splat(c.p.x, c.ground, c.p.z, c.size * 2.2); }
          else { c.rest = true; c.r.x = Math.round(c.r.x / (Math.PI / 2)) * Math.PI / 2; c.r.z = Math.round(c.r.z / (Math.PI / 2)) * Math.PI / 2; }
        }
      }
    }
    this.ch.forEach((c, k) => {
      const sc = c.size * Math.min(1, c.life / 1.5);
      _q.setFromEuler(c.r); _s.set(sc, sc, sc);
      this.chunks.setMatrixAt(k, _m.compose(c.p, _q, _s)); this.chunks.setColorAt(k, _c.set(c.color));
    });
    this.chunks.count = this.ch.length; this.chunks.instanceMatrix.needsUpdate = true; if (this.chunks.instanceColor) this.chunks.instanceColor.needsUpdate = true;
    // embers
    for (let i = this.em.length - 1; i >= 0; i--) {
      const e = this.em[i]; e.t += dt; if (e.t > e.life) { this.em.splice(i, 1); continue; }
      e.v.y += 1.5 * dt; e.v.multiplyScalar(1 - dt * 2); e.p.addScaledVector(e.v, dt);
    }
    this.em.forEach((e, k) => {
      const sc = e.size * (1 - e.t / e.life);
      _m.makeScale(sc, sc, sc).setPosition(e.p.x, e.p.y, e.p.z);
      this.embers.setMatrixAt(k, _m); this.embers.setColorAt(k, _c.set(e.color));
    });
    this.embers.count = this.em.length; this.embers.instanceMatrix.needsUpdate = true; if (this.embers.instanceColor) this.embers.instanceColor.needsUpdate = true;
    // limbs
    for (let i = this.limbs.length - 1; i >= 0; i--) {
      const L = this.limbs[i], o = L.obj; L.t += dt;
      if (!L.rest) {
        L.v.y -= G * dt; o.position.addScaledVector(L.v, dt);
        o.rotation.x += L.w.x * dt; o.rotation.y += L.w.y * dt; o.rotation.z += L.w.z * dt;
        if (o.position.y <= L.ground + L.bottom) {
          o.position.y = L.ground + L.bottom;
          if (L.v.y < -1.5) { L.v.y *= -0.25; L.v.x *= 0.5; L.v.z *= 0.5; L.w.multiplyScalar(0.4); this.splat(o.position.x, L.ground, o.position.z, 0.18); }
          else {
            // lie flat: the limb tips over onto its side
            L.rest = true; o.rotation.x = Math.PI / 2 * Math.sign(o.rotation.x || 1); o.rotation.z = 0;
            this.splat(o.position.x, L.ground, o.position.z, 0.22, 0x5a0404, 1.5);
          }
        }
      }
      if (L.t > 22) { o.position.y -= dt * 0.15; if (L.t > 24) { this.scene.remove(o); this.limbs.splice(i, 1); } }
    }
    // stumps
    for (let i = this.spurts.length - 1; i >= 0; i--) {
      const s = this.spurts[i]; s.t += dt;
      if (s.t > s.dur || !s.obj.parent) { this.spurts.splice(i, 1); continue; }
      const pulse = 0.5 + 0.5 * Math.sin(s.t * 14);
      s.acc += dt * 60 * pulse * (1 - s.t / s.dur);
      if (s.acc < 1) continue;
      const n = Math.floor(s.acc); s.acc -= n;
      s.obj.updateWorldMatrix(true, false);
      const p = s.obj.localToWorld(_p.copy(s.offset)), d = s.dir.clone().transformDirection(s.obj.matrixWorld);
      this.spray(p.x, p.y, p.z, d.x, d.y, d.z, n, 2.2 + pulse * 1.5, 0.5, s.ground);
    }
  }
  // drop everything (a new game)
  clear() {
    this.d.n = 0; this.drops.count = 0; this.sN = 0; this.splats.count = 0; this.grow = []; this.ch = []; this.em = []; this.spurts = [];
    for (const L of this.limbs) this.scene.remove(L.obj); this.limbs = [];
  }
}
