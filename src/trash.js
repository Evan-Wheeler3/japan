// The kitchen bin. Every guest leaves a little rubbish behind (napkins, skewers, the ends of things), so it fills up
// over the night; when it's full it says so (through the walls), and someone has to tie the bag off and carry it out to
// the gomi station: out the back door into the yard, or, while that's still shut, out the front to the one on the
// pavement. Full and left too long, it starts to show: the night's rating takes the hit. Taro takes it out himself
// when he's free. The bags pile up at the station until the morning collection.
import * as THREE from 'three';
import { Model, C } from './voxel.js';
import { MAP } from './maps/index.js';

export const CAP = 12; // guests to a bag

// the tied-off bag, as you carry it (and as it sits at the station)
let bagM = null;
export function bagModel() {
  if (bagM) return bagM;
  const m = new Model(10, 14, 9, 1 / 32);
  const bag = C('#d4dad2', 0, 0.06), hi = C('#f0f2ec', 0, 0.05), tie = C('#e8b830', 0, 0.04); // the city's semi-clear bags, tied off yellow
  for (let y = 0; y < 11; y++) {
    const r = y < 2 ? 3.4 + y * 0.6 : y < 8 ? 4.4 : 4.4 - (y - 7) * 0.9;
    for (let z = 0; z < 9; z++) for (let x = 0; x < 10; x++) {
      const d = Math.hypot((x - 4.5) / 1.0, (z - 4.0) / 0.88);
      if (d < r) m.set(x, y, z, (x + y * 3 + z) % 7 === 0 ? hi : bag);
    }
  }
  m.box(4, 11, 3, 6, 13, 5, bag); m.box(3, 13, 3, 7, 14, 5, tie);
  return (bagM = m);
}
// rubbish inside the bin, as high as it's filled (a separate little mesh so it can rise)
function fillModel() {
  const m = new Model(10, 1, 10, 1 / 32);
  const a = C('#2a3430', 0, 0.06), b = C('#d8d0bc', 0, 0.06), c = C('#c8302a', 0, 0.05), d = C('#8a6a3a', 0, 0.06);
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) { const h = (x * 7 + z * 13) % 11; m.set(x, 0, z, h < 6 ? a : h < 8 ? b : h < 9 ? c : d); }
  return m;
}
// the bin's bubble: a little bin with a lid, red ringed when it's full
function binTex(full) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = full ? '#c8302a' : '#2a2622'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4efe4'; g.beginPath(); g.arc(64, 64, 49, 0, Math.PI * 2); g.fill();
  g.fillStyle = full ? '#c8302a' : '#3a3632';
  g.fillRect(36, 36, 56, 9); g.fillRect(54, 28, 20, 8);
  g.beginPath(); g.moveTo(40, 50); g.lineTo(88, 50); g.lineTo(82, 98); g.lineTo(46, 98); g.closePath(); g.fill();
  g.fillStyle = '#f4efe4'; for (const x of [54, 64, 74]) g.fillRect(x - 2, 58, 4, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Trash {
  constructor(service) {
    this.s = service; this.T = MAP.shop.trash;
    this.n = 0;           // how many guests' worth is in it
    this.overT = 0;       // seconds it's sat overflowing tonight
    this.bags = {};       // bags waiting at each station for the morning
    this.piles = {};
    const T = this.T; if (!T) return;
    const [bx, by, bz] = T.bin;
    this.fill = fillModel().mesh(service.litMat, service.emitMat); this.fill.position.set(bx, by, bz); service.scene.add(this.fill);
    this.tex = [binTex(false), binTex(true)];
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex[0], transparent: true, depthWrite: false }));
    this.bubble.scale.set(0.3, 0.3, 1); this.bubble.position.set(bx, by + 1.25, bz); this.bubble.visible = false; service.scene.add(this.bubble);
    for (const st of T.stations) { const g = new THREE.Group(); g.position.set(st.at[0], st.at[1], st.at[2]); g.rotation.y = st.yaw || 0; service.scene.add(g); this.piles[st.key] = g; this.bags[st.key] = 0; }
    this.redraw();
  }
  full() { return this.n >= CAP; }
  // a guest's leftovers go in
  add(k = 1) {
    const was = this.full();
    this.n = Math.min(CAP + 4, this.n + k);
    if (!was && this.full()) this.s.sayAll('the kitchen bin is full — take the trash out to the gomi station');
    this.redraw();
  }
  empty() { this.n = 0; this.redraw(); }
  // which station a bag goes to tonight: the yard's if the back door's open to us, the street's if not
  station() {
    const T = this.T; if (!T) return null;
    const back = (this.s.crowd.doors || []).find((d) => d.spec && d.spec.key === 'back');
    return T.stations.find((st) => (st.door === 'back' ? back && !back.locked : true)) || T.stations[T.stations.length - 1];
  }
  // for the busboy: where to stand at the bin, and at the station
  route() { const st = this.station(); return st && { bin: this.T.stand, out: st.stand, key: st.key }; }
  dropOff(key = this.station().key) { this.bags[key] = (this.bags[key] || 0) + 1; this.redraw(); }
  // the morning collection
  collect() { for (const k in this.bags) this.bags[k] = 0; this.overT = 0; this.redraw(); }
  update(dt, open) {
    if (!this.T) return;
    if (open && this.full() && this.s.role !== 'guest') this.overT += dt;
    const show = this.n >= CAP * 0.75;
    this.bubble.visible = show;
    if (show) {
      const f = this.full() ? 1 : 0;
      if (this.bubble.userData.f !== f) { this.bubble.userData.f = f; this.bubble.material.map = this.tex[f]; this.bubble.material.needsUpdate = true; }
      // a full bin is a job to do: it shows through the walls, like a guest waiting to order
      this.bubble.material.depthTest = !f; this.bubble.renderOrder = f ? 30 : 21;
      this.bubble.position.y = this.T.bin[1] + 1.25 + (f ? Math.sin(performance.now() / 260) * 0.03 : 0);
    }
  }
  redraw() {
    if (!this.T) return;
    const k = Math.min(1, this.n / CAP);
    this.fill.visible = this.n > 0; this.fill.position.y = this.T.bin[1] + 0.08 + k * this.T.depth;
    for (const [key, g] of Object.entries(this.piles)) {
      const n = Math.min(6, this.bags[key] || 0);
      while (g.children.length > n) g.remove(g.children[g.children.length - 1]);
      while (g.children.length < n) {
        const i = g.children.length, b = bagModel().mesh(this.s.litMat, this.s.emitMat);
        b.position.set(-0.45 + (i % 3) * 0.32, i >= 3 ? 0.3 : 0, (i % 2) * 0.12 - 0.06); b.rotation.y = i * 1.3;
        g.add(b);
      }
    }
  }
  snapshot() { return [this.n, this.bags]; }
  applySnapshot([n, bags]) { if (n !== this.n || JSON.stringify(bags) !== JSON.stringify(this.bags)) { this.n = n; this.bags = { ...bags }; this.redraw(); } }
}
