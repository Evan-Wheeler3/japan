// Customers: voxel people who come in from the snow, find a seat, linger, and leave.
import * as THREE from 'three';
import { Model, C } from './voxel.js';
import { MAP } from './maps/index.js';

const V = 1 / 16;

// ---------------------------------------------------------------- looks
const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6040', '#6e4128', '#4a2c1c'];
const HAIR = ['#1a1412', '#3a2418', '#6a4024', '#a8783a', '#d8c08a', '#8a8a8a', '#e8e4dc', '#7a2a1a'];
const COAT = ['#c8a878', '#24324e', '#e8c040', '#8a1c24', '#4a4a4a', '#2a2a2c', '#5a6a3a', '#6a3a5a', '#b05a2a', '#d8d2c4'];
const PANTS = ['#2a3a5a', '#1c1c20', '#8a7a5a', '#3a3a3a', '#4a5a7a'];
const UMB = ['#141416', '#8a1a20', '#1d3a6a', '#2a4a2a', '#e8c040', '#5a2a5a'];

export const LOOK_OPTIONS = { SKIN, HAIR, COAT, PANTS };
export function randomLook(r) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: pick(SKIN), hair: pick(HAIR), coat: pick(COAT), pants: pick(PANTS), shoes: r() < 0.5 ? '#141414' : '#4a2a18',
    hairStyle: Math.floor(r() * 5), hat: r() < 0.22 ? Math.floor(r() * 2) : -1, glasses: r() < 0.25, long: r() < 0.35,
    umbrella: pick(UMB), scarf: r() < 0.25 ? pick(['#a82a2a', '#e8e0d0', '#2a5a8a', '#d8a030']) : null,
  };
}

function buildParts(L) {
  const skin = C(L.skin, 0, 0.04), hair = C(L.hair, 0, 0.06), coat = C(L.coat, 0, 0.05), coatD = C(L.coat, 0, 0.12);
  const pants = C(L.pants, 0, 0.05), shoes = C(L.shoes, 0, 0.04), dark = C('#1a1210', 0, 0.02), white = C('#f0ece4', 0, 0.02);
  // torso (from hips up), coat may hang below the hips
  const torso = new Model(6, 12, 4, V, [3, 2, 2]);
  torso.box(0, 2, 0, 6, 12, 4, coat);
  if (L.long) torso.box(0, 0, 0, 6, 2, 4, coatD);
  torso.box(2, 4, 0, 4, 11, 1, coatD);
  if (L.scarf) torso.box(1, 10, 0, 5, 12, 4, C(L.scarf, 0, 0.05));
  // head with hair, eyes facing -z
  const head = new Model(6, 7, 6, V, [3, 0, 3]);
  head.box(1, 0, 1, 5, 4, 5, skin);
  head.set(2, 2, 0, dark); head.set(3, 2, 0, dark); head.box(2, 2, 0, 4, 3, 1, skin);
  head.set(2, 2, 1, dark); head.set(3, 2, 1, dark);
  if (L.glasses) { head.box(1, 2, 0, 5, 3, 1, dark); head.set(2, 2, 0, C('#a8c0d0', 0, 0.03)); head.set(3, 2, 0, C('#a8c0d0', 0, 0.03)); }
  const hs = L.hairStyle;
  if (hs !== 3) head.box(1, 4, 1, 5, 5, 5, hair);                    // 3 = bald
  if (hs === 1 || hs === 4) head.box(1, 1, 4, 5, 4, 6, hair);         // longer back
  if (hs === 2) head.box(0, 0, 3, 6, 4, 6, hair);                     // long hair
  if (hs === 4) head.box(2, 5, 3, 4, 6, 5, hair);                     // bun
  if (hs !== 3 && hs !== 2) { head.box(1, 3, 4, 5, 4, 5, hair); head.box(0, 2, 2, 1, 4, 5, hair); head.box(5, 2, 2, 6, 4, 5, hair); }
  if (L.hat === 0) head.box(1, 4, 1, 5, 6, 5, C('#3a3a3a', 0, 0.05));    // beanie
  if (L.hat === 1) { head.box(0, 4, 0, 6, 5, 5, C('#6a5a44', 0, 0.06)); head.box(1, 5, 1, 5, 6, 5, C('#6a5a44', 0, 0.06)); } // flat cap
  const arm = new Model(2, 9, 2, V, [1, 9, 1]);
  arm.box(0, 2, 0, 2, 9, 2, coat); arm.box(0, 0, 0, 2, 2, 2, skin);
  const thigh = new Model(2, 6, 3, V, [1, 6, 1.5]);
  thigh.box(0, 0, 0, 2, 6, 3, pants);
  if (L.long) thigh.box(0, 3, 0, 2, 6, 3, coatD);
  const shin = new Model(2, 7, 4, V, [1, 7, 2.5]);
  shin.box(0, 1, 1, 2, 7, 4, pants); shin.box(0, 0, 0, 2, 1, 4, shoes);
  void white;
  return { torso, head, arm, thigh, shin };
}

function buildUmbrella(hex) {
  const m = new Model(15, 16, 15, V, [7.5, 0, 7.5]);
  const c = C(hex, 0, 0.06), cD = C(hex, 0, 0.14);
  m.box(7, 0, 7, 8, 13, 8, C('#2a2420', 0, 0.03));
  [7.4, 6.6, 5.4, 3.8, 2.0].forEach((rad, i) => m.cyl(7.5, 7.5, rad, 12 + i, 13 + i, (x, y, z, a) => (Math.floor((a + Math.PI) * 1.3) & 1 ? c : cD), i === 0 ? rad - 1.2 : -1));
  m.box(7, 16, 7, 8, 16, 8, c);
  return m;
}

// ---------------------------------------------------------------- one person
export class Person {
  constructor(look, litMat, emitMat) {
    this.look = look;
    const P = buildParts(look);
    const mk = (model) => model.mesh(litMat, emitMat);
    const g = this.group = new THREE.Group();
    const hips = this.hips = new THREE.Group(); hips.position.y = 13 * V; g.add(hips);
    this.torso = mk(P.torso); hips.add(this.torso);
    const neck = this.neck = new THREE.Group(); neck.position.y = 10 * V; this.torso.add(neck);
    this.head = mk(P.head); neck.add(this.head);
    this.arms = [-1, 1].map((s) => { const n = new THREE.Group(); n.position.set(s * 4 * V, 9.5 * V, 0); this.torso.add(n); n.add(mk(P.arm)); return n; });
    this.legs = [-1, 1].map((s) => {
      const t = new THREE.Group(); t.position.set(s * 1.5 * V, 0, 0); hips.add(t); t.add(mk(P.thigh));
      const k = new THREE.Group(); k.position.y = -6 * V; t.add(k); k.add(mk(P.shin));
      return { t, k };
    });
    this.umbrella = mk(buildUmbrella(look.umbrella));
    this.umbrella.position.set(0.16, 0.95, -0.12); this.umbrella.visible = false; g.add(this.umbrella);
    this.phase = Math.random() * 10; this.sit = 0; this.idleT = Math.random() * 10;
  }
  // walk speed (m/s) drives the gait; sit 0..1 blends into a seated pose
  pose(dt, speed, sitAmt, seatY, outdoors) {
    this.phase += speed * dt * 5.2;
    this.idleT += dt;
    const w = Math.min(1, speed / 1.0) * (1 - sitAmt), s = Math.sin(this.phase);
    this.legs.forEach((L, i) => {
      const ph = i ? s : -s;
      L.t.rotation.x = ph * 0.55 * w + sitAmt * (Math.PI / 2);
      L.k.rotation.x = -Math.max(0, -ph) * 0.8 * w - sitAmt * (Math.PI / 2);
    });
    const sip = sitAmt > 0.9 ? Math.max(0, Math.sin(this.idleT * 0.35) - 0.85) * 6.5 : 0;
    this.arms.forEach((a, i) => {
      a.rotation.x = (i ? -s : s) * 0.45 * w + sitAmt * (0.95 + (i === 1 ? sip * 0.9 : 0));
      a.rotation.z = (i ? -1 : 1) * 0.05;
    });
    if (outdoors) this.arms[1].rotation.x = 0.55;
    this.umbrella.visible = outdoors;
    const bob = Math.abs(Math.cos(this.phase)) * 0.025 * w;
    this.hips.position.y = THREE.MathUtils.lerp(13 * V + bob, seatY, sitAmt);
    this.neck.rotation.y = sitAmt > 0.9 ? Math.sin(this.idleT * 0.21) * 0.5 : 0;
    this.neck.rotation.x = sip * 0.06;
  }
}

// ---------------------------------------------------------------- nav grid + A*
export class NavGrid {
  constructor(world, x0, z0, x1, z1, cell = 0.25) {
    Object.assign(this, { x0, z0, cell });
    this.w = Math.ceil((x1 - x0) / cell); this.h = Math.ceil((z1 - z0) / cell);
    this.ok = new Uint8Array(this.w * this.h);
    this.test = (cx, cz) => {
      let good = world.solid(cx, 0.06, cz); // sidewalk or floor under foot (not the street)
      for (const [dx, dz] of [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) for (const y of [0.6, 1.05, 1.55])
        if (good && world.solid(cx + dx, y, cz + dz)) good = false;
      return good;
    };
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) this.ok[j * this.w + i] = this.test(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) ? 1 : 0;
  }
  // shut a doorway to walkers (a locked door), or open it again: [x0, x1, z0, z1]
  setBlocked([x0, x1, z0, z1], blocked) {
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const cx = this.x0 + (i + 0.5) * this.cell, cz = this.z0 + (j + 0.5) * this.cell;
      if (cx > x0 && cx < x1 && cz > z0 && cz < z1) this.ok[j * this.w + i] = !blocked && this.test(cx, cz) ? 1 : 0;
    }
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell); return (i < 0 || j < 0 || i >= this.w || j >= this.h) ? -1 : j * this.w + i; }
  center(k) { return [this.x0 + ((k % this.w) + 0.5) * this.cell, this.z0 + (Math.floor(k / this.w) + 0.5) * this.cell]; }
  // filter(cx, cz): optional test a cell's center must pass
  nearest(x, z, maxR = 1.5, filter = null) {
    const k = this.idx(x, z);
    if (k >= 0 && this.ok[k] && (!filter || filter(...this.center(k)))) return k;
    let best = -1, bd = Infinity;
    const r = Math.ceil(maxR / this.cell), i0 = Math.floor((x - this.x0) / this.cell), j0 = Math.floor((z - this.z0) / this.cell);
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h || !this.ok[j * this.w + i]) continue;
      const [cx, cz] = this.center(j * this.w + i), d = (cx - x) ** 2 + (cz - z) ** 2;
      if (filter && !filter(cx, cz)) continue;
      if (d < bd) { bd = d; best = j * this.w + i; }
    }
    return best;
  }
  los(a, b) {
    const [ax, az] = this.center(a), [bx, bz] = this.center(b);
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (this.cell * 0.4));
    for (let s = 1; s < n; s++) { const k = this.idx(ax + (bx - ax) * s / n, az + (bz - az) * s / n); if (k < 0 || !this.ok[k]) return false; }
    return true;
  }
  path(fx, fz, tx, tz) {
    const s = this.nearest(fx, fz), t = this.nearest(tx, tz);
    if (s < 0 || t < 0) return null;
    const W = this.w, g = new Float32Array(W * this.h).fill(Infinity), came = new Int32Array(W * this.h).fill(-1), closed = new Uint8Array(W * this.h);
    const heap = [];
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const tj = Math.floor(t / W), ti = t % W;
    const hfn = (k) => { const dx = Math.abs((k % W) - ti), dz = Math.abs(Math.floor(k / W) - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[s] = 0; push(s, hfn(s));
    while (heap.length) {
      const [, k] = pop();
      if (k === t) break;
      if (closed[k]) continue; closed[k] = 1;
      const i = k % W, j = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni;
        if (!this.ok[nk] || closed[nk]) continue;
        if (di && dj && (!this.ok[j * W + ni] || !this.ok[nj * W + i])) continue;
        const ng = g[k] + (di && dj ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; came[nk] = k; push(nk, ng + hfn(nk)); }
      }
    }
    if (came[t] < 0 && s !== t) return null;
    const raw = [t]; let k = t; while (k !== s) { k = came[k]; raw.push(k); } raw.reverse();
    const out = [raw[0]]; let i = 0;
    while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !this.los(raw[i], raw[j])) j--; out.push(raw[j]); i = j; }
    return out.map((q) => this.center(q));
  }
}

// ---------------------------------------------------------------- the crowd
export class Crowd {
  constructor({ scene, world, seats, doors, litMat, emitMat, audio, player, inside }) {
    Object.assign(this, { scene, world, seats, doors, litMat, emitMat, audio, player, inside });
    const C = MAP.shop.crowd;
    this.nav = new NavGrid(world, ...C.nav);
    this.people = [];
    this.nextId = 1;
    this.others = []; // other players' positions (co-op), so customers step around them too
    this.puppet = false; // co-op guest: customers are positioned by the host, not simulated here
    this.r = Math.random; // a different crowd every night: looks, seats, timing
    this.spawns = C.spawns.map((s) => [...s]);
    for (const r of C.blocked || []) this.nav.setBlocked(r, true); // staff only
    this.passers = C.passersby || null; this.nextPasser = 0.5;      // people just walking by on a busy street
    this.nextArrival = 12;
    this.max = 10;
    this.auto = true; // random walk-ins; the shift turns this off and sends people in waves
    for (const s of seats) {
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
      const a = s.approach || [s.x - fx * 0.62, s.z - fz * 0.62];
      const k = this.nav.nearest(a[0], a[1], 1.0, (cx, cz) => inside(cx, cz) === inside(s.x, s.z));
      s.app = k >= 0 ? this.nav.center(k) : null;
      s.occupant = null;
    }
  }
  freeSeats() { return this.seats.filter((s) => !s.occupant && s.app && !(s.dishes && s.dishes.length)); }
  pickSeat() {
    const free = this.freeSeats();
    if (!free.length) return null;
    const wt = MAP.shop.seatWeight;
    let tot = free.reduce((a, s) => a + wt(s), 0), x = this.r() * tot;
    for (const s of free) { x -= wt(s); if (x <= 0) return s; }
    return free[0];
  }
  make(look, id = this.nextId++) {
    const p = new Person(look, this.litMat, this.emitMat);
    this.scene.add(p.group);
    const q = { id, look, person: p, pos: new THREE.Vector3(), yaw: 0, speed: 0, sitAmt: 0, path: null, state: 'walk', timer: 0, seat: null };
    this.people.push(q);
    return q;
  }
  arrive() {
    const seat = this.pickSeat();
    if (!seat) return;
    const sp = this.spawns[Math.floor(this.r() * this.spawns.length)];
    const path = this.nav.path(sp[0], sp[1], seat.app[0], seat.app[1]);
    if (!path) return;
    const q = this.make(randomLook(this.r));
    q.pos.set(sp[0], 0.125, sp[1]); q.seat = seat; seat.occupant = q;
    q.path = path; q.state = 'walk'; q.then = 'sitdown';
  }
  // someone walking past: from one end of the street to the other, keeping to a lane (a pavement, or the road)
  passby() {
    const P = this.passers;
    if (P.lanes) {
      const [z0, z1] = P.lanes[Math.floor(this.r() * P.lanes.length)], z = z0 + this.r() * (z1 - z0);
      const east = this.r() < 0.5, xa = east ? P.ends[0] : P.ends[1], xb = east ? P.ends[1] : P.ends[0];
      const path = this.nav.path(xa, z, xb, z); if (!path) return;
      const q = this.make(randomLook(this.r));
      q.pos.set(xa, 0.125, z); q.path = path; q.state = 'walk'; q.then = 'despawn';
      q.passer = true; q.pace = 0.85 + this.r() * 0.45;
      return;
    }
    const S = this.spawns; if (S.length < 2) return;
    const i = Math.floor(this.r() * S.length), a = S[i], b = S[(i + 1 + Math.floor(this.r() * (S.length - 1))) % S.length];
    const path = this.nav.path(a[0], a[1], b[0], b[1]); if (!path) return;
    const q = this.make(randomLook(this.r));
    q.pos.set(a[0], 0.125, a[1]); q.path = path; q.state = 'walk'; q.then = 'despawn';
    q.passer = true; q.pace = 0.85 + this.r() * 0.45;
  }
  leave(q) {
    const sp = this.spawns[Math.floor(this.r() * this.spawns.length)];
    q.path = this.nav.path(q.pos.x, q.pos.z, sp[0], sp[1]);
    q.state = q.path ? 'walk' : 'gone'; q.then = 'despawn';
  }
  positions() { return this.people.map((q) => q.pos); }
  floorAt(x, z) { return this.world.solid(x, 0.3, z) ? 0.375 : this.world.solid(x, 0.18, z) ? 0.25 : this.world.solid(x, 0.06, z) ? 0.125 : 0; }

  remove(q) {
    this.scene.remove(q.person.group);
    // each person's voxel meshes are built just for them, so free them (sprites share one geometry: leave those)
    q.person.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    if (q.seat && q.seat.occupant === q) q.seat.occupant = null;
    this.people.splice(this.people.indexOf(q), 1);
  }
  clearAll() { for (const q of [...this.people]) this.remove(q); }

  // ---- co-op: the host sends everyone's position; guests glide toward it
  snapshot() {
    const r2 = (v) => Math.round(v * 100) / 100;
    return this.people.map((q) => [q.id, r2(q.pos.x), r2(q.pos.y), r2(q.pos.z), r2(q.yaw), r2(q.sitAmt), r2(q.speed || 0), q.seat ? this.seats.indexOf(q.seat) : -1, q.state]);
  }
  applySnapshot(list, looks) {
    const seen = new Set();
    for (const [id, x, y, z, yaw, sitAmt, speed, seatIdx, state] of list) {
      seen.add(id);
      let q = this.people.find((p) => p.id === id);
      if (!q) {
        const look = looks[id]; if (!look) continue; // wait until we know what they look like
        q = this.make(look, id); q.pos.set(x, y, z); q.yaw = yaw;
      }
      q.target = [x, y, z, yaw]; q.sitAmt = sitAmt; q.speed = speed; q.state = state;
      const seat = seatIdx >= 0 ? this.seats[seatIdx] : null;
      if (q.seat !== seat) { if (q.seat && q.seat.occupant === q) q.seat.occupant = null; q.seat = seat; }
      if (seat && seat.occupant !== 'player') seat.occupant = q;
    }
    for (const q of [...this.people]) if (!seen.has(q.id)) this.remove(q);
  }
  updatePuppets(dt) {
    const k = Math.min(1, dt * 10);
    for (const q of this.people) {
      if (q.target) {
        const [x, y, z, yaw] = q.target;
        q.pos.x += (x - q.pos.x) * k; q.pos.y += (y - q.pos.y) * k; q.pos.z += (z - q.pos.z) * k;
        let dy = yaw - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); q.yaw += dy * k;
      }
      this.poseOne(q, dt, q.speed || 0);
    }
  }
  poseOne(q, dt, speed) {
    const p = q.person;
    const outdoors = !this.inside(q.pos.x, q.pos.z);
    const seatY = q.seat ? q.seat.y - q.pos.y : 0.5;
    p.pose(dt, speed, q.sitAmt, Math.max(0.3, seatY), outdoors && q.state === 'walk');
    p.group.position.set(q.pos.x, q.pos.y, q.pos.z);
    p.group.rotation.y = q.yaw;
    if (q.sitAmt > 0 && q.seat) {
      // nudge the hips back toward the seat so knees point forward
      const back = (q.seat.kind === "booth" ? 0.02 : 0.1) * q.sitAmt;
      p.group.position.x += Math.sin(q.yaw) * back; p.group.position.z += Math.cos(q.yaw) * back;
    }
  }

  update(dt) {
    if (this.puppet) return this.updatePuppets(dt);
    this.nextArrival -= dt;
    if (this.passers && (this.nextPasser -= dt) <= 0) {
      const [lo, hi] = this.passers.every;
      this.nextPasser = lo + this.r() * (hi - lo);
      if (this.people.filter((q) => q.passer).length < this.passers.max) this.passby();
    }
    if (this.auto && this.nextArrival < 0) { if (this.people.length < this.max) this.arrive(); this.nextArrival = 25 + this.r() * 45; }
    for (let i = this.people.length - 1; i >= 0; i--) {
      const q = this.people[i];
      let speed = 0;
      if (q.state === 'walk') {
        const tgt = q.path && q.path[0];
        if (!tgt) { this.reached(q); }
        else {
          const dx = tgt[0] - q.pos.x, dz = tgt[1] - q.pos.z, d = Math.hypot(dx, dz);
          // politely wait if a player is standing right in their way
          let pl = this.player.seated ? null : this.player.pos, pd = pl ? Math.hypot(pl.x - q.pos.x, pl.z - q.pos.z) : 1e9;
          for (const o of this.others) { const od = Math.hypot(o.x - q.pos.x, o.z - q.pos.z); if (od < pd) { pd = od; pl = o; } }
          const px = pl ? pl.x - q.pos.x : 0, pz = pl ? pl.z - q.pos.z : 0;
          let blockedByYou = !!pl && pd < 0.7 && (px * dx + pz * dz) / (d * pd + 1e-6) > 0.6;
          // after a polite pause, step around you
          q.waited = blockedByYou ? (q.waited || 0) + dt : Math.max(0, (q.waited || 0) - dt * 0.5);
          if (q.waited > 1.0) {
            blockedByYou = false;
            const side = (px * dz - pz * dx) > 0 ? -1 : 1;
            const sx = -dz / (d + 1e-6) * side, sz = dx / (d + 1e-6) * side;
            const nx = q.pos.x + sx * 0.6 * dt, nz = q.pos.z + sz * 0.6 * dt, k = this.nav.idx(nx, nz);
            if (k >= 0 && this.nav.ok[k]) { q.pos.x = nx; q.pos.z = nz; }
          }
          // open doors on the way (people only passing by don't come in)
          if (!q.passer) for (const door of this.doors) {
            if (!door.open && Math.abs((door.y0 || 0) - q.pos.y) < 1.5 && Math.hypot(door.center.x - q.pos.x, door.center.z - q.pos.z) < 1.3) {
              door.toggle(q.pos);
              this.audio.doorSound(true);
              if (door.bell) this.audio.doorBell(Math.max(0.15, 1 - Math.hypot(this.player.pos.x - q.pos.x, this.player.pos.z - q.pos.z) / 18));
            }
          }
          const doorShut = !q.passer && this.doors.some((door) => Math.abs(door.a) < 0.6 && Math.abs((door.y0 || 0) - q.pos.y) < 1.5 && Math.hypot(door.center.x - q.pos.x, door.center.z - q.pos.z) < 0.9);
          if (!blockedByYou && !doorShut) {
            speed = 1.15 * (q.pace || 1);
            const step = Math.min(d, speed * dt);
            if (d > 1e-4) { q.pos.x += dx / d * step; q.pos.z += dz / d * step; }
            const want = Math.atan2(-dx, -dz);
            let dy = want - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            q.yaw += dy * Math.min(1, dt * 8);
            if (d < 0.08) q.path.shift();
          }
          q.pos.y += (this.floorAt(q.pos.x, q.pos.z) - q.pos.y) * Math.min(1, dt * 10);
        }
      } else if (q.state === 'sitting') {          // sliding from the approach point into the seat
        q.t += dt / 0.9;
        const k = Math.min(1, q.t);
        q.pos.x = THREE.MathUtils.lerp(q.from[0], q.seat.x, k); q.pos.z = THREE.MathUtils.lerp(q.from[1], q.seat.z, k);
        let dy = q.seat.yaw - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); q.yaw += dy * Math.min(1, dt * 6);
        q.sitAmt = Math.min(1, k * 1.2);
        if (k >= 1) { q.state = 'sit'; q.timer = 90 + this.r() * 180; if (this.onSeated) this.onSeated(q); }
      } else if (q.state === 'sit') {
        if (!q.svc) { q.timer -= dt; if (q.timer < 0) this.rise(q); }
      } else if (q.state === 'stand') {
        let dy = q.standYaw - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); q.yaw += dy * Math.min(1, dt * 5);
      } else if (q.state === 'rising') {
        q.t += dt / 0.9;
        const k = Math.min(1, q.t);
        q.pos.x = THREE.MathUtils.lerp(q.seat.x, q.from[0], k); q.pos.z = THREE.MathUtils.lerp(q.seat.z, q.from[1], k);
        q.sitAmt = Math.max(0, 1 - k * 1.3);
        if (k >= 1) {
          q.seat.occupant = null; q.seat = null; q.pos.y = this.floorAt(q.pos.x, q.pos.z);
          if (q.afterRise) { const f = q.afterRise; q.afterRise = null; f(); } else this.leave(q);
        }
      }
      q.speed = speed;
      if (q.state === 'gone') { this.remove(q); continue; }
      this.poseOne(q, dt, speed);
    }
  }
  // stand up from the seat, then do something
  rise(q, after = null) { if (!q.seat) { if (after) after(); else this.leave(q); return; } q.state = 'rising'; q.t = 0; q.from = q.seat.app; q.afterRise = after; }
  // walk to a spot and wait there facing yaw
  goTo(q, x, z, yaw, onArrive = null) {
    const path = this.nav.path(q.pos.x, q.pos.z, x, z);
    if (!path) { q.state = 'stand'; q.standYaw = yaw; if (onArrive) onArrive(); return; }
    path.push([x, z]);
    q.path = path; q.state = 'walk'; q.then = 'stand'; q.standYaw = yaw; q.onArrive = onArrive;
  }
  reached(q) {
    if (q.then === 'stand') { q.state = 'stand'; const f = q.onArrive; q.onArrive = null; if (f) f(); return; }
    if (q.then === 'sitdown') {
      if (q.seat.occupant !== q) { this.leave(q); return; }
      q.state = 'sitting'; q.t = 0; q.from = [q.pos.x, q.pos.z];
    } else q.state = 'gone';
  }
}
