// Traffic on the street. It's one way, eastbound, in the south lane: the road works at each end close off the north
// half, so taxis, the odd white kei van and delivery scooters squeeze past the barriers and through. They have their
// lights on, slow for anyone in the road (and honk if you stand there), and stop for the zebra crossing outside the
// shop when its lights go red; while the crossing's green for walkers it plays the kakkō, the two-note cuckoo chirp.
import * as THREE from 'three';
import { TK } from './world.js';

export const LANE = (TK.lane[0] + TK.lane[1]) / 2; // the middle of the open lane
const CROSS = TK.cross;                    // the zebra crossing (painted in world.js)
const STOP = CROSS.x - CROSS.w / 2 - 1.1;  // where an eastbound car's nose waits at red
const X0 = TK.ends.x0 - 14, X1 = TK.ends.x1 + 14;
// the crossing's cycle: cars go, amber, walkers go (the chirp), walkers' light flashing, all red
const CYCLE = [['car', 22], ['amber', 3], ['allred', 1.5], ['walk', 12], ['flash', 4], ['allred', 1.5]];

const lit = (c) => new THREE.MeshLambertMaterial({ color: c });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

// models face +x (the way the traffic goes), sitting on the road at y 0
function wheels(g, len, w, r, list) {
  const m = lit(0x141416);
  for (const x of [-len * 0.32, len * 0.32]) for (const z of [-w / 2, w / 2]) {
    const wh = new THREE.Mesh(wheelGeo, m); wh.scale.set(r, 0.2, r); wh.rotation.x = Math.PI / 2; wh.position.set(x, r, z); g.add(wh); list.push(wh);
  }
}
function lamps(g, len, y, w, head = true) {
  if (head) for (const z of [-w * 0.36, w * 0.36]) g.add(box(0.06, 0.14, 0.26, glow(3.2, 3.0, 2.6), len / 2 + 0.01, y, z));
  for (const z of [-w * 0.38, w * 0.38]) g.add(box(0.06, 0.12, 0.22, glow(2.6, 0.15, 0.1), -len / 2 - 0.01, y + 0.05, z));
}
// a taxi: the tall deep-indigo kind, a gold stripe, the lamp on the roof
function taxi(kind) {
  const g = new THREE.Group(), spin = [];
  const [body, stripe] = kind ? [0x1c2448, 0xc8a050] : [0xe8b830, 0x2a6a3a];
  const L = 4.4, W = 1.7;
  g.add(box(L, 0.75, W, lit(body), 0, 0.68, 0));
  g.add(box(L * 0.62, 0.62, W - 0.08, lit(body), -0.15, 1.36, 0));
  g.add(box(L * 0.6, 0.42, W - 0.06, new THREE.MeshLambertMaterial({ color: 0x1a222c, emissive: 0x3a2c18, emissiveIntensity: 0.6 }), -0.15, 1.38, 0)); // windows, a warm lit cab
  g.add(box(L + 0.02, 0.07, W + 0.02, lit(stripe), 0, 0.9, 0));
  g.add(box(0.5, 0.2, 0.3, glow(2.2, 1.8, 1.0), -0.1, 1.79, 0));                         // the roof lamp
  g.add(box(L * 0.6, 0.06, W - 0.1, lit(0xeef3fb), -0.15, 1.7, 0));                      // a little snow on the roof
  g.add(box(0.06, 0.28, 0.36, glow(2.6, 0.3, 0.2), L * 0.18, 1.45, -0.3));               // the 空車 sign in the windscreen
  lamps(g, L, 0.8, W); wheels(g, L, W, 0.32, spin);
  return { g, spin, len: L, speed: 7.5, sound: 'car' };
}
function keiVan() {
  const g = new THREE.Group(), spin = [];
  const L = 3.4, W = 1.48;
  g.add(box(L, 1.55, W, lit(0xe8e8e4), 0, 1.05, 0));
  g.add(box(0.06, 0.55, W - 0.12, lit(0x1a222c), L / 2 + 0.005, 1.45, 0));
  g.add(box(L * 0.55, 0.5, 0.04, lit(0x1a222c), L * 0.15, 1.45, -W / 2 - 0.005)); g.add(box(L * 0.55, 0.5, 0.04, lit(0x1a222c), L * 0.15, 1.45, W / 2 + 0.005));
  g.add(box(L - 0.1, 0.07, W - 0.1, lit(0xeef3fb), 0, 1.86, 0));
  g.add(box(1.2, 0.3, 0.02, lit(0x2a5aa8), -0.5, 1.1, W / 2 + 0.01));                     // a shop's name on the side
  lamps(g, L, 0.6, W); wheels(g, L, W, 0.27, spin);
  return { g, spin, len: L, speed: 6.5, sound: 'car' };
}
// a Super Cub with a delivery box on the back, its rider in a helmet
function scooter() {
  const g = new THREE.Group(), spin = [];
  g.add(box(1.1, 0.35, 0.22, lit(0x2a4a7a), 0, 0.5, 0));
  g.add(box(0.5, 0.45, 0.5, lit(0xc8302a), -0.55, 0.95, 0));                             // the box
  g.add(box(0.36, 0.55, 0.32, lit(0x2a2a30), 0.05, 1.1, 0));                             // the rider
  g.add(box(0.26, 0.26, 0.26, lit(0xe8e8e8), 0.12, 1.5, 0));                             // helmet
  g.add(box(0.06, 0.4, 0.5, lit(0x8a8c90), 0.55, 0.95, 0));                              // the bars
  g.add(box(0.06, 0.12, 0.14, glow(3.2, 3.0, 2.6), 0.62, 0.95, 0)); g.add(box(0.06, 0.08, 0.1, glow(2.6, 0.2, 0.1), -0.82, 0.8, 0));
  for (const x of [-0.45, 0.45]) { const wh = new THREE.Mesh(wheelGeo, lit(0x141416)); wh.scale.set(0.28, 0.08, 0.28); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.28, 0); g.add(wh); spin.push(wh); }
  return { g, spin, len: 1.8, speed: 8.5, sound: 'scoot' };
}

// the crossing: zebra stripes are in the road (world.js); here, the signals on their poles either side
function signals(scene) {
  const heads = [];
  const pole = lit(0x5a5e62);
  for (const [z, face] of [[TK.road[1] + 0.35, 1], [TK.road[0] - 0.35, -1]]) {
    for (const x of [CROSS.x - CROSS.w / 2 - 0.3, CROSS.x + CROSS.w / 2 + 0.3]) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      g.add(box(0.1, 3.2, 0.1, pole, 0, 1.6 + 0.125, 0));
      // the walkers' light, facing across the road
      const ped = new THREE.Group(); ped.position.set(0, 2.3, -face * 0.12);
      ped.add(box(0.3, 0.62, 0.14, lit(0x2a2c30), 0, 0, 0));
      const red = box(0.22, 0.22, 0.02, glow(0.2, 0.02, 0.02), 0, 0.15, -face * 0.08), grn = box(0.22, 0.22, 0.02, glow(0.02, 0.15, 0.1), 0, -0.15, -face * 0.08);
      ped.add(red, grn); g.add(ped);
      // the cars' light (only on the west poles, facing the oncoming traffic)
      let car = null;
      if (x < CROSS.x) {
        const c = new THREE.Group(); c.position.set(0.1, 3.0, 0);
        c.add(box(0.14, 0.26, 0.8, lit(0x2a2c30), 0, 0, 0));
        car = { g: box(0.02, 0.18, 0.18, glow(0, 0.1, 0.08), -0.08, 0, 0.25), a: box(0.02, 0.18, 0.18, glow(0.12, 0.08, 0), -0.08, 0, 0), r: box(0.02, 0.18, 0.18, glow(0.12, 0, 0), -0.08, 0, -0.25) };
        c.add(car.g, car.a, car.r); g.add(c);
      }
      scene.add(g); heads.push({ red, grn, car });
    }
  }
  return heads;
}

export class Traffic {
  constructor(scene) {
    this.scene = scene; this.cars = []; this.next = 3; this.agents = () => [];
    this.heads = signals(scene);
    this.phase = 0; this.pt = 0; this.chirp = 0;
    // one light rides along ahead of the nearest car, its headlights on the snow
    this.beam = new THREE.PointLight(0xfff2dc, 0, 9, 1.6); scene.add(this.beam);
  }
  get light() { return CYCLE[this.phase][0]; }
  spawn() {
    const r = Math.random(), v = r < 0.3 ? taxi(1) : r < 0.45 ? taxi(0) : r < 0.68 ? keiVan() : scooter();
    v.x = X0; v.v = v.speed; v.honk = 0; v.blocked = 0; v.z = LANE + (v.sound === 'scoot' ? 0.5 : 0) + (Math.random() - 0.5) * 0.3;
    v.g.position.set(v.x, 0.125, v.z); this.scene.add(v.g); this.cars.push(v);
  }
  update(dt, camera, audio) {
    // the crossing's lights
    this.pt += dt;
    if (this.pt > CYCLE[this.phase][1]) { this.pt = 0; this.phase = (this.phase + 1) % CYCLE.length; }
    const L = this.light, flashOn = Math.floor(this.pt * 2.5) & 1;
    for (const h of this.heads) {
      const walk = L === 'walk' || (L === 'flash' && flashOn);
      h.grn.material.color.setRGB(walk ? 0.2 : 0.02, walk ? 2.4 : 0.15, walk ? 1.6 : 0.1);
      h.red.material.color.setRGB(L === 'walk' || L === 'flash' ? 0.2 : 2.6, 0.02, 0.02);
      if (h.car) { h.car.g.material.color.setRGB(0, L === 'car' ? 2.4 : 0.1, L === 'car' ? 1.6 : 0.08); h.car.a.material.color.setRGB(L === 'amber' ? 2.8 : 0.12, L === 'amber' ? 1.6 : 0.08, 0); h.car.r.material.color.setRGB(L === 'car' || L === 'amber' ? 0.12 : 2.8, 0, 0); }
    }
    // the kakkō while it's green for walkers: "ka-kō", a cuckoo, every second and a bit
    if (L === 'walk' && audio && audio.ctx) {
      const d = Math.hypot(camera.position.x - CROSS.x, camera.position.z - (TK.road[0] + TK.road[1]) / 2);
      if (d < 40 && (this.chirp -= dt) <= 0) {
        this.chirp = 1.3; const t = audio.ctx.currentTime, v = Math.min(0.12, 2.4 / (8 + d * d * 0.15));
        audio.tone(1047, t, 0.16, v, 'sine'); audio.tone(831, t + 0.28, 0.24, v, 'sine');
      }
    } else this.chirp = 0;

    // new traffic now and then, a few at a time at most
    if ((this.next -= dt) <= 0) { this.next = 6 + Math.random() * 14; if (this.cars.length < 4) this.spawn(); }
    const people = this.agents();
    let near = null, nd = Infinity;
    for (const v of this.cars) {
      // how fast it may go: slow behind the car in front, stop at the crossing on red, stop for anyone in the road
      let want = v.speed;
      for (const o of this.cars) if (o !== v && o.x > v.x) { const gap = o.x - o.len / 2 - (v.x + v.len / 2); if (gap < 8) want = Math.min(want, Math.max(0, (gap - 1.5) * 1.2)); }
      const front = v.x + v.len / 2;
      if (L !== 'car' && front < STOP + 0.5 && front > STOP - 14) want = Math.min(want, Math.max(0, (STOP - front) * 0.9));
      let person = false;
      for (const p of people) {
        const ahead = p.x - front;
        if (ahead > -0.3 && ahead < 7 && Math.abs(p.z - v.z) < 1.25) { want = Math.min(want, Math.max(0, (ahead - 1.6) * 1.3)); if (ahead < 4) person = true; }
      }
      v.v += Math.max(-9 * dt, Math.min(3 * dt, want - v.v));
      v.x += v.v * dt; v.g.position.x = v.x;
      for (const w of v.spin) w.rotation.y -= v.v * dt / 0.3;
      // held up by someone standing in the road: a tap on the horn
      v.blocked = person && v.v < 0.5 ? v.blocked + dt : 0;
      if (v.blocked > 2.5 && (v.honk -= dt) <= 0 && audio && audio.ctx) {
        v.honk = 4 + Math.random() * 3; const t = audio.ctx.currentTime, d = Math.hypot(camera.position.x - v.x, camera.position.z - v.z), vol = Math.min(0.2, 3 / (4 + d));
        const f = v.sound === 'scoot' ? 520 : 400; audio.tone(f, t, 0.18, vol, 'square'); audio.tone(f * 1.26, t, 0.18, vol * 0.7, 'square');
      }
      const d = Math.hypot(camera.position.x - v.x, camera.position.z - v.z);
      if (d < nd) { nd = d; near = v; }
      // engine and tyres on the snow, louder close by
      if (audio && audio.ctx && d < 30) {
        v.tick = (v.tick || 0) - dt;
        if (v.tick <= 0) {
          const t = audio.ctx.currentTime, vol = Math.min(0.5, 4 / (3 + d)) * (0.4 + v.v / v.speed * 0.6);
          if (v.sound === 'scoot') { v.tick = 0.06; audio.burst(t, 0.07, 260 + v.v * 18, 2.5, vol * 0.35); }
          else { v.tick = 0.1; audio.burst(t, 0.14, 70 + v.v * 6, 0.8, vol * 0.45, audio.master, 'lowpass'); if (v.v > 2) audio.burst(t, 0.12, 2200, 0.6, vol * 0.08, audio.master, 'highpass'); }
        }
      }
    }
    for (const v of [...this.cars]) if (v.x > X1) { this.scene.remove(v.g); this.cars.splice(this.cars.indexOf(v), 1); }
    if (near && nd < 30) { this.beam.intensity = 3.2; this.beam.position.set(near.x + near.len / 2 + 2.5, 0.8, near.z); } else this.beam.intensity = 0;
  }
}
