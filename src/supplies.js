// What the kitchen runs on. Every station starts the night full (the morning delivery) and each dish it makes uses a
// serving: tea leaves at the urns, salmon at the sushi case, rice at the cookers, skewers at the grills, and so on, and
// once the kura's yours the house sake keg on the back bar drains a cup with every bill. When one runs low a crate
// marker pops up over it; when it's empty, nothing more comes off that station until someone fetches a crate from the
// storeroom upstairs (or a fresh keg from the shed in the yard) and carries it down. A crate fills both hands.
// It all costs: the wholesaler's bill for what was used comes off the takings at sunrise.
// (Only where the map has a pantry: up on the mountain the old wholesaler still stocks the kitchen himself.)
import * as THREE from 'three';
import { Model, C } from './voxel.js';
import { MAP } from './maps/index.js';
import { sakeTaru } from './props.js';

// cap: servings in a full crate (and on a full station); unit: what a serving costs from the wholesaler
export const SUPPLY = {
  tea: { what: 'tea leaves', crate: 'a tin of tea leaves', cap: 12, unit: 60 },
  sushi: { what: 'salmon', crate: 'a box of salmon on ice', cap: 6, unit: 180 },
  onigiri: { what: 'rice', crate: 'a sack of rice', cap: 8, unit: 70 },
  yakitori: { what: 'skewers', crate: 'a crate of skewers', cap: 6, unit: 220 },
  gyoza: { what: 'gyoza', crate: 'a tray of gyoza', cap: 6, unit: 180 },
  tempura: { what: 'prawns', crate: 'a crate of prawns', cap: 6, unit: 240 },
  ramen: { what: 'noodles and broth', crate: 'a crate of noodles and broth', cap: 5, unit: 300 },
  sake: { what: 'sake', crate: 'a keg of sake', cap: 12, unit: 100 },
};
export const isLoad = (type) => type === 'keg' || (typeof type === 'string' && type.startsWith('crate_'));
export const crateKind = (type) => (type === 'keg' ? 'sake' : type && type.startsWith('crate_') ? type.slice(6) : null);
export const lowAt = (kind) => Math.max(1, Math.round(SUPPLY[kind].cap * 0.34)); // the marker shows from here down

// ---------------------------------------------------------------- the crates
const crates = {};
export function crateModel(kind) {
  if (kind === 'sake') return sakeTaru();
  if (crates[kind]) return crates[kind];
  const m = new Model(14, 10, 11, 1 / 32, [7, 0, 5.5]);
  const wood = C('#b08a5a', 0, 0.07), woodD = C('#7a5a34', 0, 0.06);
  const crate = (top) => {
    m.box(0, 0, 0, 14, 7, 11, (x, y, z) => ((y === 0 || y === 6 || y === 3) ? woodD : (x === 0 || x === 13 || z === 0 || z === 10) && y % 3 ? wood : wood));
    m.box(1, 1, 1, 13, 7, 10, null);
    for (let z = 1; z < 10; z++) for (let x = 1; x < 13; x++) for (let y = 1; y < 7; y++) m.set(x, y, z, 0);
    for (let z = 1; z < 10; z++) for (let x = 1; x < 13; x++) { const c = top(x, z); if (c) { m.set(x, 5, z, c); m.set(x, 4, z, c); } }
  };
  if (kind === 'tea') {                          // green tea tins, lids up
    const tin = C('#3a7a3a', 0, 0.05), lid = C('#c8b060', 0.1, 0.04);
    crate((x, z) => ((x - 1) % 4 < 3 && (z - 1) % 3 < 2 ? lid : null));
    for (let x = 1; x < 13; x++) for (let z = 1; z < 10; z++) if ((x - 1) % 4 < 3 && (z - 1) % 3 < 2) { m.set(x, 3, z, tin); m.set(x, 2, z, tin); m.set(x, 6, z, lid); }
  } else if (kind === 'sushi') {                 // a white polystyrene fish box, salmon sides on ice
    const box = C('#f2f2ee', 0, 0.03), band = C('#2a5aa0', 0, 0.04), fish = C('#f08a4a', 0, 0.05), stripe = C('#fbd2b0', 0, 0.03), ice = C('#d8ecf4', 0.1, 0.03);
    m.box(0, 0, 0, 14, 7, 11, (x, y) => (y === 2 ? band : box));
    for (let z = 1; z < 10; z++) for (let x = 1; x < 13; x++) for (let y = 1; y < 7; y++) m.set(x, y, z, 0);
    for (let z = 1; z < 10; z++) for (let x = 1; x < 13; x++) m.set(x, 4, z, ice);
    for (const z0 of [2, 6]) for (let x = 2; x < 12; x++) for (let z = z0; z < z0 + 3; z++) m.set(x, 5, z, x % 3 ? fish : stripe);
  } else if (kind === 'onigiri') {               // a sack of rice, tied at the top, a red printed band
    const sack = C('#e8dcc0', 0, 0.06), print = C('#c8302a', 0, 0.04), tie = C('#8a6a3a', 0, 0.05);
    for (let y = 0; y < 10; y++) for (let z = 0; z < 11; z++) for (let x = 0; x < 14; x++) {
      const r = y < 7 ? 1 : 1 - (y - 6) * 0.22, dx = (x - 6.5) / (7 * r), dz = (z - 5) / (5.5 * r);
      if (dx * dx + dz * dz < 1) m.set(x, y, z, y === 3 || y === 4 ? (z === 0 || z === 10 || x === 0 || x === 13 ? print : sack) : sack);
    }
    m.box(6, 9, 4, 8, 10, 6, tie);
  } else {
    const fill = {
      yakitori: (x, z) => (x % 4 === 1 ? C('#c8b070', 0, 0.04) : z % 3 === 1 ? C('#a85a38', 0, 0.08) : C('#d88a6a', 0, 0.08)),
      gyoza: (x, z) => ((x + z) % 3 ? C('#f0e6d0', 0, 0.04) : C('#d8c8a8', 0, 0.05)),
      tempura: (x, z) => ((x + z * 2) % 5 < 3 ? C('#f08a5a', 0, 0.05) : C('#f4f0e8', 0, 0.03)),
      ramen: (x, z) => (x < 7 ? ((x + z) & 1 ? C('#f2d070', 0, 0.06) : C('#e8c050', 0, 0.06)) : (z < 5 ? C('#c8883a', 0, 0.05) : C('#8a3a20', 0, 0.05))),
    }[kind] || (() => C('#c8b090', 0, 0.05));
    crate(fill);
  }
  return (crates[kind] = m);
}

// the marker over a station that's running low: a crate, and what it's for (red-ringed and through the walls when
// it's out, like the bin when it's full)
function markTex(kind, out, drawIcon) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = out ? '#c8302a' : '#2a2622'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4efe4'; g.beginPath(); g.arc(64, 64, 49, 0, Math.PI * 2); g.fill();
  // the crate
  g.fillStyle = '#b08a5a'; g.strokeStyle = '#4a3020'; g.lineWidth = 4;
  g.beginPath(); g.rect(30, 62, 68, 38); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(30, 75); g.lineTo(98, 75); g.moveTo(30, 88); g.lineTo(98, 88); g.stroke();
  // what goes in it, peeking out of the top
  if (drawIcon && kind !== 'sake') { g.save(); g.translate(64, 46); g.scale(0.5, 0.5); drawIcon(g, kind); g.restore(); }
  else { g.fillStyle = '#d8c48a'; g.beginPath(); g.ellipse(64, 46, 18, 16, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#c8302a'; g.fillRect(56, 40, 16, 10); }
  if (out) { g.fillStyle = '#c8302a'; g.font = '700 30px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('!', 104, 40); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Supplies {
  constructor(service, drawIcon) {
    this.s = service; this.P = MAP.shop.pantry || null; this.on = !!this.P;
    this.level = {}; this.cost = 0; this.warned = {};
    for (const k of Object.keys(SUPPLY)) this.level[k] = SUPPLY[k].cap;
    if (!this.on) return;
    // the markers, one over each place a supply goes
    this.marks = {};
    for (const k of Object.keys(SUPPLY)) {
      const at = this.point(k); if (!at) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex(k, false, drawIcon), transparent: true, depthWrite: false }));
      sp.scale.set(0.3, 0.3, 1); sp.position.set(at[0], at[1], at[2]); sp.visible = false; service.scene.add(sp);
      this.marks[k] = { sp, tex: [sp.material.map, markTex(k, true, drawIcon)], at };
    }
    // crates on the storeroom shelves (there are always more), and the keg on the back bar
    this.shelf = {};
    for (const [k, [x, y, z]] of Object.entries(this.P.shelves)) {
      const g = new THREE.Group();
      for (const dx of [-0.24, 0.24]) { const c = crateModel(k).mesh(service.litMat, service.emitMat); c.position.set(dx, 0, 0); g.add(c); }
      g.position.set(x, y, z); service.scene.add(g); this.shelf[k] = g;
    }
    const K = this.P.keg;
    if (K) { this.kegMesh = sakeTaru().mesh(service.litMat, service.emitMat); this.kegMesh.scale.setScalar(0.8); this.kegMesh.position.set(...K.at); this.kegMesh.visible = false; service.scene.add(this.kegMesh); }
  }
  // what's tracked tonight: the dishes on the menu (bar the ice cream: the freezer's its own store) and the sake once
  // the kura's yours
  tracked(k) { return this.on && !!SUPPLY[k] && (k === 'sake' ? this.sake() : this.s.menuKinds.has(k)); }
  sake() { return !!this.P && !!this.P.keg && this.s.owned.includes('kura'); }
  kinds() { return Object.keys(SUPPLY).filter((k) => this.tracked(k)); }
  // where the marker goes: over the urns, the sushi case, the rice cookers, the middle of a kind's stations, the keg
  point(k) {
    const BX = MAP.shop.boxes;
    if (k === 'tea') return [BX.urns[0], BX.urns[1] + 0.75, BX.urns[2]];
    if (k === 'sushi') return [BX.sushi[0], BX.sushi[1] + 0.55, BX.sushi[2]];
    if (k === 'onigiri') return [BX.rice[0], BX.rice[1] + 0.55, BX.rice[2]];
    if (k === 'sake') return this.P.keg && [this.P.keg.at[0], this.P.keg.at[1] + 0.95, this.P.keg.at[2]];
    const sts = this.s.stations.filter((st) => st.kind === k); if (!sts.length) return null;
    return [sts.reduce((a, st) => a + st.x, 0) / sts.length, 1.95, sts.reduce((a, st) => a + st.z, 0) / sts.length];
  }
  // where someone stands to restock it (for the hired help)
  stand(k) {
    const M = MAP.shop;
    if (k === 'tea') return M.urnStand;
    if (k === 'sushi' || k === 'onigiri') return M.passCook;
    if (k === 'sake') return this.P.keg.stand;
    const st = this.s.stations.find((x) => x.kind === k); return st && [st.x, st.z - 0.75];
  }
  ok(k) { return !this.tracked(k) || this.level[k] > 0; }
  // a serving used: false if there's none left
  use(k) {
    if (!this.tracked(k)) return true;
    if (this.level[k] <= 0) return false;
    this.level[k]--; this.cost += SUPPLY[k].unit;
    const name = k === 'sake' ? 'the house sake' : `the ${this.dish(k)}`;
    if (this.level[k] === 0) this.s.sayAll(`${name}: out of ${SUPPLY[k].what} · ${k === 'sake' ? 'a fresh keg from the shed in the yard' : 'more in the storeroom upstairs'}`);
    else if (this.level[k] === lowAt(k) && !this.warned[k]) { this.warned[k] = true; this.s.sayAll(`${name} is running low on ${SUPPLY[k].what} (${this.level[k]} left)`); }
    return true;
  }
  refill(k) { this.level[k] = SUPPLY[k].cap; this.warned[k] = false; }
  dish(k) { return { tea: 'tea', sushi: 'sushi case', onigiri: 'rice cookers', yakitori: 'yakitori grills', gyoza: 'gyoza teppan', tempura: 'fryers', ramen: 'ramen pot', sake: 'sake keg' }[k]; }
  outText(k) { return `out of ${SUPPLY[k].what} · ${k === 'sake' ? 'fetch a keg from the shed' : 'fetch a crate from the storeroom upstairs'}`; }
  // the morning delivery: everything full again, and a fresh bill
  reset() { for (const k of Object.keys(SUPPLY)) this.refill(k); this.cost = 0; }
  update() {
    if (!this.on) return;
    if (this.kegMesh) this.kegMesh.visible = this.sake();
    for (const [k, m] of Object.entries(this.marks)) {
      const show = this.tracked(k) && this.level[k] <= lowAt(k);
      m.sp.visible = show;
      if (!show) continue;
      const out = this.level[k] <= 0 ? 1 : 0;
      if (m.sp.userData.out !== out) { m.sp.userData.out = out; m.sp.material.map = m.tex[out]; m.sp.material.needsUpdate = true; }
      // empty is a job to do: it shows through the walls
      m.sp.material.depthTest = !out; m.sp.renderOrder = out ? 30 : 21;
      m.sp.position.y = m.at[1] + (out ? Math.sin(performance.now() / 260) * 0.03 : 0);
    }
  }
  snapshot() { return [this.level, this.cost]; }
  applySnapshot([level, cost]) { this.level = { ...level }; this.cost = cost; }
}
