// Chores before the sign turns: optional, and worth it. Guests track slush in all night, and the wind
// drifts snow back over the front path. Sweep every patch of slush and tonight's tips are 30% better; shovel
// every drift off the path and guests wait 25% longer. Whatever's left undone when the shop opens is
// forgotten until tomorrow.
import { Model, C, hash01 } from './voxel.js';
import { MAP } from './maps/index.js';

const STROKES = 3;
// where the slush and the drifts are come from the map (MAP.shop.chores)

const slush = (seed) => {
  const m = new Model(22, 1, 16, 1 / 32, [11, 0, 8]);
  const wet = C('#3a2a1e', 0, 0.04), grey = C('#8a8e94', 0, 0.06), white = C('#d8dde4', 0, 0.04);
  for (let x = 0; x < 22; x++) for (let z = 0; z < 16; z++) {
    const d = Math.hypot((x - 10.5) / 11, (z - 7.5) / 8) + (hash01(x, z, seed) - 0.5) * 0.35;
    if (d > 0.95) continue;
    const h = hash01(x >> 1, z >> 1, seed + 3);
    m.set(x, 0, z, d < 0.55 && h > 0.7 ? (h > 0.9 ? white : grey) : wet);
  }
  return m;
};
const drift = (seed) => {
  const m = new Model(14, 7, 10, 1 / 16, [7, 0, 5]);
  const snow = C('#eef2f8', 0, 0.03), shade = C('#c8d2e0', 0, 0.04);
  for (let x = 0; x < 14; x++) for (let z = 0; z < 10; z++) {
    const d = Math.hypot((x - 6.5) / 7, (z - 4.5) / 5);
    const h = Math.round(7 * Math.max(0, 1 - d * d) + (hash01(x, z, seed) - 0.5) * 1.5);
    for (let y = 0; y < h; y++) m.set(x, y, z, y === h - 1 ? snow : shade);
  }
  return m;
};

export class Chores {
  constructor({ scene, service, interactions, audio, litMat, emitMat, between }) {
    Object.assign(this, { service, audio, between });
    this.left = { sweep: [], shovel: [] };
    const CH = MAP.shop.chores, SPOTS = this.SPOTS = { sweep: CH.sweep, shovel: CH.shovel }, Y = { sweep: CH.sweepY, shovel: CH.shovelY };
    this.spots = {};
    for (const kind of ['sweep', 'shovel']) {
      this.spots[kind] = SPOTS[kind].map(([x, z], i) => {
        const mesh = (kind === 'sweep' ? slush(i * 7 + 1) : drift(i * 7 + 2)).mesh(litMat, emitMat);
        mesh.position.set(x, Y[kind] + 0.002, z); mesh.rotation.y = hash01(i, 3, 5) * Math.PI; mesh.visible = false; scene.add(mesh);
        interactions.add(kind === 'sweep' ? [x, Y[kind] + 0.05, z, 0.36, 0.06, 0.28] : [x, Y[kind] + 0.2, z, 0.45, 0.22, 0.35],
          () => {
            const n = this.left[kind][i], done = STROKES - n;
            return kind === 'sweep' ? `Sweep up the slush (${done}/${STROKES}) · optional chore` : `Shovel the drift off the path (${done}/${STROKES}) · optional chore`;
          },
          () => { this.audio[kind === 'sweep' ? 'sweep' : 'shovel'](); service.request('chore', kind, i); },
          () => this.active() && this.left[kind][i] > 0, { highlight: mesh });
        return mesh;
      });
    }
    this.reset();
  }
  active() { return this.between(); }
  reset() {
    for (const kind of ['sweep', 'shovel']) this.left[kind] = this.SPOTS[kind].map(() => STROKES);
    this.draw();
  }
  // one stroke of the broom or the shovel (run by whoever owns the shop)
  stroke(kind, i) {
    const s = this.service;
    if (!this.active() || !(this.left[kind][i] > 0)) return;
    this.left[kind][i]--;
    this.draw();
    if (this.left[kind].some((n) => n > 0)) return;
    if (kind === 'sweep') { s.tipMul = 1.3; s.sayAll('the floors are spotless. guests tip 30% better tonight'); }
    else { s.choreP = 1.25; s.sayAll('the path is clear. guests will wait 25% longer tonight'); }
    s.sfxAll('kaching');
  }
  draw() {
    const open = this.active();
    for (const kind of ['sweep', 'shovel']) this.spots[kind].forEach((m, i) => {
      const n = this.left[kind][i];
      m.visible = open && n > 0;
      const k = 0.35 + 0.65 * n / STROKES;
      m.scale.set(k, kind === 'shovel' ? k : 1, k);
    });
  }
  update() { const open = this.active(); if (open !== this.wasOpen) { this.wasOpen = open; this.draw(); } }
  snapshot() { return [this.left.sweep.join(''), this.left.shovel.join('')]; }
  applySnapshot([a, b]) {
    const key = a + b; if (key === this.key) return; this.key = key;
    this.left.sweep = [...a].map(Number); this.left.shovel = [...b].map(Number); this.draw();
  }
}
