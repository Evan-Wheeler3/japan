// What you fight with: your bare hands and whatever's to hand (plates, tea cups, sake flasks: all throwable),
// then blades and guns off the walls and out of the omikuji box. Weapons are drawn first-person in a scene of
// their own (rendered after the world with the depth cleared, so a katana never sinks into a wall).
import * as THREE from 'three';
import { Model, C } from '../voxel.js';

// ---------------------------------------------------------------- the table of weapons
// melee: dmg, range (m), arc (radians), cleave (how many in one swing), rate (s per swing), blade (chance to sever)
// guns: dmg, head (headshot multiplier), mag, reserve, rate, reload, spread, pierce
export const WEAPONS = {
  hands: { name: 'Bare hands', kind: 'melee', dmg: 45, range: 1.25, arc: 1.2, cleave: 1, rate: 0.5, blade: 0, hit: 0.18 },
  tanto: { name: 'Tantō', kind: 'melee', dmg: 170, range: 1.45, arc: 1.25, cleave: 1, rate: 0.34, blade: 0.35, hit: 0.12, price: 750 },
  katana: { name: 'Katana', kind: 'melee', dmg: 330, range: 2.05, arc: 1.9, cleave: 3, rate: 0.55, blade: 0.7, hit: 0.2, price: 1500 },
  naginata: { name: 'Naginata', kind: 'melee', dmg: 440, range: 2.8, arc: 1.5, cleave: 4, rate: 0.78, blade: 0.75, hit: 0.28 },
  kanabo: { name: 'Kanabō', kind: 'melee', dmg: 850, range: 1.9, arc: 1.6, cleave: 3, rate: 1.0, blunt: true, knock: 3.2, hit: 0.38 },
  muramasa: { name: 'Muramasa', kind: 'melee', dmg: 1400, range: 2.2, arc: 2.1, cleave: 6, rate: 0.42, blade: 1, hit: 0.15, heal: 12, cursed: true },
  revolver: { name: 'Type 26 revolver', kind: 'gun', dmg: 140, head: 3, mag: 6, reserve: 48, rate: 0.3, reload: 2.4, spread: 0.012, pierce: 1, price: 1000, ammo: 500 },
  murata: { name: 'Murata rifle', kind: 'gun', dmg: 360, head: 4, mag: 8, reserve: 56, rate: 0.95, reload: 3.0, spread: 0.002, pierce: 3, price: 1250, ammo: 650, pop: 0.8 },
  tanegashima: { name: 'Tanegashima', kind: 'gun', dmg: 1300, head: 3, mag: 1, reserve: 30, rate: 0.3, reload: 2.8, spread: 0.004, pierce: 5, pop: 1, blast: true },
};
export const THROWN = {
  plate: { name: 'plate', dmg: 70, colors: [0xf4f0e6, 0xe8e4d8, 0x2a4a8a] },
  cup: { name: 'tea cup', dmg: 50, colors: [0x9a6a4a, 0x7a5236, 0xd8c8a8] },
  tokkuri: { name: 'sake flask', dmg: 120, colors: [0xf0ece0, 0x2a3a7a, 0xd8d0c0] },
};

// ---------------------------------------------------------------- viewmodels
const W = 1 / 64;
const steel = C('#c8ccd2', 0, 0.03), steelD = C('#8a9098', 0, 0.03), hamon = C('#f4f6f8', 0.15, 0.02), gold = C('#c8a040', 0, 0.04);
const ironC = C('#2a2a2e', 0, 0.05), black = C('#141416', 0, 0.03), ito = C('#1a1a24', 0, 0.04), itoL = C('#e8e0d0', 0, 0.03), same = C('#d8d0c0', 0, 0.04);
const lacquer = C('#1a0e0a', 0, 0.04), wood = C('#5a3a20', 0, 0.06), woodL = C('#7a5232', 0, 0.06), red = C('#8a1a14', 0, 0.05);
const skin = C('#e0b490', 0, 0.04), sleeve = C('#2a3450', 0, 0.06), sleeveD = C('#1e263c', 0, 0.06);
const wrap = (z) => ((z & 1) ? ito : itoL);

// a blade along -z from the guard at z = 0 (pivot at the grip): length in voxels, curve, colours
function blade(m, x, y, z0, len, curve, edge = hamon, body = steel) {
  for (let i = 0; i < len; i++) {
    const z = z0 - i, dy = Math.round(curve * (i / len) ** 2);
    m.set(x, y + dy, z, body); m.set(x, y + 1 + dy, z, i > len - 3 ? body : edge);
    if (i < len - 4) m.set(x, y - 1 + dy, z, steelD);
  }
}
function swordModel(len, cursed = false) {
  const m = new Model(7, 14, len + 30, W, [3.5, 4, len + 6]);
  const z0 = len + 6; // the guard
  // tsuka (grip) back toward +z, the tsuba, habaki, blade forward
  for (let z = z0 + 1; z < z0 + 22; z++) m.box(2, 3, z, 5, 6, z + 1, cursed ? ((z & 1) ? red : black) : wrap(z));
  m.box(2, 3, z0 + 22, 5, 6, z0 + 24, gold);
  m.box(0, 1, z0, 7, 8, z0 + 1, cursed ? C('#4a0a0a', 0, 0.04) : ironC); m.box(1, 2, z0, 6, 7, z0 + 1, cursed ? red : black);
  m.box(3, 3, z0 - 2, 4, 6, z0, gold);
  blade(m, 3, 3, z0 - 2, len, 5, cursed ? C('#ff3020', 1.2, 0.04) : hamon, cursed ? C('#1a1a1e', 0, 0.03) : steel);
  return m;
}
const MODELS = {
  hands: () => null,
  tanto: () => swordModel(16),
  katana: () => swordModel(44),
  muramasa: () => swordModel(48, true),
  naginata: () => {
    const m = new Model(7, 12, 110, W, [3.5, 4, 70]);
    for (let z = 34; z < 108; z++) m.box(2, 3, z, 5, 6, z + 1, z % 18 === 0 ? gold : lacquer);
    m.box(1, 2, 32, 6, 7, 34, ironC); m.box(3, 3, 30, 4, 6, 32, gold);
    blade(m, 3, 3, 30, 28, 7);
    return m;
  },
  kanabo: () => {
    const m = new Model(9, 9, 70, W, [4.5, 4.5, 52]);
    for (let z = 44; z < 66; z++) m.box(3, 3, z, 6, 6, z + 1, wrap(z));
    m.box(2, 2, 42, 7, 7, 44, gold);
    for (let z = 2; z < 42; z++) { const r = z < 6 ? 3 : 4; m.box(4.5 - r | 0, 4.5 - r | 0, z, 4.5 + r | 0, 4.5 + r | 0, z + 1, (x, y) => ((x + y + z) % 5 === 0 && (z % 4 === 0) ? C('#9a9aa0', 0, 0.04) : ironC)); }
    return m;
  },
  revolver: () => {
    const m = new Model(6, 16, 26, 1 / 72, [3, 6, 18]);
    m.box(2, 8, 0, 4, 10, 14, black); m.box(2, 10, 0, 4, 11, 2, black);            // barrel and sight
    m.box(1, 6, 13, 5, 11, 19, ironC); m.box(1, 7, 14, 5, 10, 18, C('#3e3e44', 0, 0.04)); // frame and cylinder
    m.box(2, 9, 19, 4, 12, 21, black);                                               // hammer
    m.box(2, 0, 19, 4, 8, 24, wood); m.box(2, 0, 22, 4, 7, 24, woodL);                // the grip, angled back
    m.box(2, 4, 15, 4, 6, 17, black);                                                // trigger guard
    return m;
  },
  murata: () => {
    const m = new Model(5, 12, 100, W, [2.5, 6, 64]);
    m.box(2, 7, 0, 3, 8, 60, black); m.box(1, 5, 18, 4, 7, 60, wood); m.box(2, 8, 2, 3, 9, 3, black);
    m.box(1, 6, 58, 4, 9, 70, ironC); m.box(3, 9, 64, 5, 10, 66, steelD);              // the bolt
    m.box(1, 2, 70, 4, 7, 98, wood); m.box(1, 1, 86, 4, 6, 98, woodL); m.box(1, 6, 70, 4, 8, 76, wood);
    for (const z of [20, 40]) m.box(1, 5, z, 4, 8, z + 2, gold);
    return m;
  },
  tanegashima: () => {
    const m = new Model(6, 12, 96, W, [3, 6, 60]);
    m.box(2, 7, 0, 4, 9, 64, ironC); m.box(2, 9, 2, 4, 10, 4, gold);                    // octagonal barrel
    m.box(1, 5, 10, 5, 7, 66, C('#7a1a10', 0, 0.05));                                  // red-lacquered stock
    for (const z of [14, 30, 48]) m.box(1, 5, z, 5, 9, z + 2, gold);
    m.box(4, 7, 60, 6, 10, 64, gold);                                                  // the lock
    m.box(5, 9, 58, 6, 10, 60, C('#ff8020', 2.2, 0.04));                              // the match, smouldering
    m.box(1, 2, 66, 5, 7, 92, C('#5a1410', 0, 0.05));                                  // the butt
    return m;
  },
  plate: () => { const m = new Model(12, 2, 12, 1 / 80, [6, 1, 6]); m.cyl(6, 6, 6, 0, 1, C('#f2eee4', 0, 0.03)); m.cyl(6, 6, 6, 1, 2, C('#2a4a8a', 0, 0.04), 4.6); m.cyl(6, 6, 3, 1, 2, C('#f2eee4', 0, 0.03)); return m; },
  cup: () => { const m = new Model(6, 7, 6, 1 / 60, [3, 0, 3]); m.cyl(3, 3, 3, 0, 7, C('#8a5a3a', 0, 0.06), 2); m.cyl(3, 3, 2, 0, 1, C('#8a5a3a', 0, 0.06)); m.cyl(3, 3, 3, 5, 7, C('#d8c8a8', 0, 0.04), 2); return m; },
  tokkuri: () => { const m = new Model(8, 14, 8, 1 / 64, [4, 0, 4]); m.cyl(4, 4, 4, 0, 7, C('#f0ece0', 0, 0.03)); m.cyl(4, 4, 3, 7, 9, C('#f0ece0', 0, 0.03)); m.cyl(4, 4, 1.6, 9, 13, C('#f0ece0', 0, 0.03)); m.cyl(4, 4, 4, 3, 5, C('#2a3a7a', 0, 0.04)); m.cyl(4, 4, 2, 13, 14, C('#2a3a7a', 0, 0.04)); return m; },
};
// a hand closed round a grip (fingers forward, -z), and the indigo sleeve of a samue running back toward you
const handModel = (left) => {
  const m = new Model(6, 6, 22, 1 / 64, [3, 3, 3]);
  m.box(1, 0, 0, 5, 5, 5, skin); m.box(left ? 5 : 0, 1, 1, left ? 6 : 1, 4, 4, skin);   // fist and thumb
  for (let x = 1; x < 5; x++) m.set(x, 4, 0, C('#c8987a', 0, 0.04));                      // knuckles
  m.box(0, 0, 6, 6, 6, 22, (x, y, z) => (z === 6 || z % 6 === 0 ? sleeveD : sleeve));
  m.box(1, 0, 5, 5, 5, 6, skin);
  return m;
};
// where the hands go on each weapon (weapon-local metres), and how it's held at rest: pivot position, weapon rotation (YXZ)
const GRIP = {
  hands: { rest: [0.2, -0.27, -0.5], rot: [0, 0, 0] },
  tanto: { R: [0, 0, 0.08], rest: [0.22, -0.24, -0.42], rot: [0.6, 0.35, -0.15] },
  katana: { R: [0, 0, 0.08], L: [0, 0, 0.25], rest: [0.22, -0.23, -0.46], rot: [0.72, 0.42, -0.25] },
  muramasa: { R: [0, 0, 0.08], L: [0, 0, 0.25], rest: [0.22, -0.23, -0.46], rot: [0.72, 0.42, -0.25] },
  naginata: { R: [0, 0, 0.32], L: [0, 0, -0.08], rest: [0.2, -0.36, -0.5], rot: [0.32, 0.14, 0] },
  kanabo: { R: [0, 0, 0.17], L: [0, 0, 0.02], rest: [0.3, -0.34, -0.62], rot: [0.95, 0.4, -0.35] },
  revolver: { R: [0, -0.05, 0.055], rest: [0.15, -0.14, -0.4], rot: [0.04, 0.05, 0] },
  murata: { R: [0, -0.05, 0.1], L: [0, -0.04, -0.36], rest: [0.14, -0.2, -0.34], rot: [0.02, 0.02, 0] },
  tanegashima: { R: [0, -0.05, 0.1], L: [0, -0.04, -0.42], rest: [0.14, -0.2, -0.34], rot: [0.02, 0.02, 0] },
};
const vmCache = new Map();
const vmModel = (id) => { if (!vmCache.has(id)) vmCache.set(id, MODELS[id] ? MODELS[id]() : null); return vmCache.get(id); };
export const weaponModel = vmModel;

// ---------------------------------------------------------------- what you're holding
export class Arsenal {
  constructor({ scene, camera, world, horde, gore, audio, mats, onDamage, onEmpty }) {
    Object.assign(this, { scene, camera, world, horde, gore, audio, mats, onDamage, onEmpty });
    this.slots = [null, null]; this.cur = 0;
    this.thrown = []; this.throwables = []; this.maxThrow = 6;
    this.rateMul = 1; this.reloadMul = 1; this.insta = false;
    this.next = 0; this.time = 0; this.reloading = 0; this.swing = null; this.anim = { kick: 0, draw: 0, reload: 0, throwT: 0, swingSide: 1 };
    // the first-person scene: its own camera, its own lights
    this.vScene = new THREE.Scene();
    this.vCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.vLight = new THREE.HemisphereLight(0xffd8b0, 0x2a1810, 2.2); this.vScene.add(this.vLight);
    this.vKey = new THREE.DirectionalLight(0xffe0c0, 1.6); this.vKey.position.set(0.6, 1, 0.3); this.vScene.add(this.vKey);
    this.rig = new THREE.Group(); this.vScene.add(this.rig);
    this.pivot = new THREE.Group(); this.rig.add(this.pivot);
    this.weapon = new THREE.Group(); this.weapon.rotation.order = 'YXZ'; this.pivot.add(this.weapon);
    this.model = new THREE.Group(); this.weapon.add(this.model);
    this.handR = handModel(false).mesh(mats.lit, mats.emit); this.handL = handModel(true).mesh(mats.lit, mats.emit);
    this.throwHand = handModel(true).mesh(mats.lit, mats.emit); this.rig.add(this.throwHand); this.throwHand.visible = false;
    // the faint arc a blade leaves in the air
    this.trail = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.66, 28, 1, 0, 2.3), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.trail.visible = false; this.vScene.add(this.trail);
    this.held = null; this.heldThrow = null;
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd080 })); this.flash.visible = false; this.vScene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 9, 2); scene.add(this.flashLight);
    this.show();
  }
  get w() { const s = this.slots[this.cur]; return s ? WEAPONS[s.id] : WEAPONS.hands; }
  get slot() { return this.slots[this.cur]; }
  has(id) { return this.slots.some((s) => s && s.id === id); }
  // a new weapon: into an empty hand, or in place of the one you're holding
  give(id) {
    const w = WEAPONS[id], s = { id, mag: w.mag || 0, reserve: w.reserve || 0 };
    const empty = this.slots.findIndex((x) => !x);
    if (empty >= 0) this.cur = empty; this.slots[this.cur] = s;
    this.reloading = 0; this.swing = null; this.anim.draw = 1; this.show();
  }
  refill(id) { const s = this.slots.find((x) => x && x.id === id); if (s) { s.mag = WEAPONS[id].mag; s.reserve = WEAPONS[id].reserve; } }
  refillAll() { for (const s of this.slots) if (s && WEAPONS[s.id].kind === 'gun') { s.mag = WEAPONS[s.id].mag; s.reserve = WEAPONS[s.id].reserve; } }
  // two hands' worth of weapons (three with the Sanbon no Ya blessing): losing the third drops what's in it
  setSlots(n) {
    while (this.slots.length < n) this.slots.push(null);
    if (this.slots.length > n) { this.slots.length = n; if (this.cur >= n) { this.cur = 0; this.anim.draw = 1; } this.show(); }
  }
  swap(i = null) {
    const to = i ?? (this.cur + 1) % this.slots.length;
    if (to >= this.slots.length || to === this.cur || (!this.slots[to] && !this.slots[this.cur])) return;
    this.cur = to; this.reloading = 0; this.swing = null; this.anim.draw = 1; this.show(); this.audio.zmDraw && this.audio.zmDraw();
  }
  addThrowable(kind) { if (this.throwables.length >= this.maxThrow) return false; this.throwables.push(kind); this.show(); return true; }
  show() {
    const id = this.slot ? this.slot.id : 'hands', G = GRIP[id];
    if (this.shown !== id) {
      this.model.clear(); this.shown = id;
      const m = vmModel(id); if (m) this.model.add(m.mesh(this.mats.lit, this.mats.emit));
      // the hands close on the grip (bare hands: two fists of their own)
      for (const [h, at] of [[this.handR, G.R], [this.handL, G.L]]) {
        if (at) { this.weapon.add(h); h.position.set(...at); h.rotation.set(0, 0, 0); h.visible = true; }
        else if (id === 'hands') { this.rig.add(h); h.visible = true; }
        else { this.rig.add(h); h.visible = false; }
      }
    }
    // a dish ready to throw sits in the free left hand (or the hand that comes up to throw it)
    const t = this.throwables[this.throwables.length - 1] || null;
    if (this.heldThrowKind !== t || this.heldOn !== id) {
      if (this.heldThrow) this.heldThrow.parent && this.heldThrow.parent.remove(this.heldThrow);
      this.heldThrowKind = t; this.heldOn = id; this.heldThrow = t ? vmModel(t).mesh(this.mats.lit, this.mats.emit) : null;
      if (this.heldThrow) {
        const host = id === 'hands' ? this.handL : this.throwHand;
        this.heldThrow.position.set(0, 0.03, -0.035); this.heldThrow.rotation.set(t === 'plate' ? 1.3 : 0, 0, 0); this.heldThrow.scale.setScalar(0.55); host.add(this.heldThrow);
      }
    }
  }
  // ---- input
  // drinking a blessing: the weapon goes down, a bottle comes up, you knock it back (and can't fight meanwhile)
  drink(color) {
    if (!this.bottle) {
      const b = new THREE.Group(), glass = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.16, 10), glass); b.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 0.08, 8), glass); neck.position.y = 0.12; b.add(neck);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.07, 10), new THREE.MeshLambertMaterial({ color: 0xf6efe0 })); label.position.y = -0.01; b.add(label);
      b.userData.glass = glass; this.bottle = b; this.vScene.add(b);
    }
    this.bottle.userData.glass.color.set(color); this.bottle.userData.glass.emissive.set(color).multiplyScalar(0.35);
    this.drinkT = this.drinkDur = 1.7; this.swing = null; this.reloading = 0;
  }
  attack(player) {
    if (this.time < this.next || this.reloading > 0 || player.dead || this.drinkT > 0) return;
    const w = this.w;
    if (!this.slot && this.throwables.length) return this.throw(player);
    if (w.kind === 'melee') return this.startSwing(w);
    const s = this.slot;
    if (s.mag <= 0) { if (s.reserve > 0) this.reload(); else { this.next = this.time + 0.3; this.audio.zmClick && this.audio.zmClick(); this.onEmpty && this.onEmpty(); } return; }
    this.shoot(w, s);
  }
  quickMelee() {
    if (this.drinkT > 0) return;
    if (this.time < this.next || this.swing) return;
    this.reloading = 0;
    this.startSwing({ ...WEAPONS.hands, dmg: 60, quick: true });
  }
  reload() {
    if (this.drinkT > 0) return;
    const s = this.slot; if (!s) return;
    const w = WEAPONS[s.id];
    if (w.kind !== 'gun' || this.reloading > 0 || s.mag >= w.mag || s.reserve <= 0) return;
    this.reloading = w.reload * this.reloadMul; this.reloadTotal = this.reloading;
    this.audio.zmReload && this.audio.zmReload(s.id);
  }
  throw(player) {
    if (this.drinkT > 0) return;
    if (!this.throwables.length || this.time < this.next) return;
    const kind = this.throwables.pop(); this.show();
    this.next = this.time + 0.45 * this.rateMul; this.anim.throwT = 1;
    const cam = this.camera, o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3());
    const mesh = vmModel(kind).mesh(this.mats.lit, this.mats.emit);
    const p = o.clone().addScaledVector(d, 0.4); p.y -= 0.1;
    mesh.position.copy(p); this.scene.add(mesh);
    this.thrown.push({ kind, mesh, p, v: d.clone().multiplyScalar(15).add(new THREE.Vector3(0, 1.6, 0)), spin: new THREE.Vector3(kind === 'plate' ? 0 : 9, kind === 'plate' ? 22 : 4, 3), t: 0 });
    this.audio.zmWhoosh && this.audio.zmWhoosh(0.6);
  }
  // ---- melee
  startSwing(w) {
    this.next = this.time + w.rate * this.rateMul;
    this.anim.swingSide = -this.anim.swingSide;
    this.swing = { w, t: 0, dur: Math.max(0.24, w.rate * this.rateMul * 0.85), hitAt: w.hit * this.rateMul, done: false, side: this.anim.swingSide, over: w.blunt || (w.blade && Math.random() < 0.25) };
    this.audio.zmWhoosh && this.audio.zmWhoosh(w.blunt ? 0.5 : w.blade ? 1 : 0.7);
  }
  meleeHit(w, player) {
    const cam = this.camera, o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3());
    const yaw = player.yaw, pitch = player.pitch;
    const targets = this.horde.inArc(o, yaw, pitch, w.range, w.arc);
    let n = 0, landed = false;
    for (const { k } of targets) {
      if (n >= w.cleave) break;
      const c = k.center(new THREE.Vector3());
      if (this.occluded(o, c)) continue;
      // which part: where the look ray meets the body, else by the height you swung at
      const r = k.raycast(o, d, w.range + 0.6);
      let part = r ? r.part : null;
      if (!part) {
        const dist = Math.hypot(c.x - o.x, c.z - o.z), y = o.y + d.y * dist - k.pos.y, sc = k.kind === 'oni' ? 1.3 : 1;
        part = k.crawl ? 'torso' : y > 1.42 * sc ? 'head' : y > 0.8 * sc ? 'torso' : (Math.random() < 0.5 ? 'legL' : 'legR');
      }
      if (part === 'torso' && w.blade && Math.random() < 0.4) part = this.swing.side > 0 ? 'armR' : 'armL';
      const dir = new THREE.Vector3(c.x - o.x, 0, c.z - o.z).normalize();
      // a sideways cut carries across the body
      const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-this.swing.side * 0.8);
      if (!w.blunt) dir.add(side).normalize();
      const res = k.hurt({ dmg: this.insta ? 1e9 : w.dmg, part, blade: w.blade || 0, blunt: !!w.blunt, knock: w.knock, dir, side: this.swing.side, point: c, headMul: 1.5 });
      this.onDamage(k, res, { melee: true, weapon: w });
      n++; landed = true;
    }
    if (landed) { this.audio.zmHit && this.audio.zmHit(w.blunt ? 'blunt' : w.blade ? 'blade' : 'punch'); this.anim.kick = Math.max(this.anim.kick, 0.35); }
  }
  // ---- guns
  shoot(w, s) {
    s.mag--; this.next = this.time + w.rate * this.rateMul;
    const cam = this.camera, o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3());
    d.x += (Math.random() - 0.5) * w.spread * 2; d.y += (Math.random() - 0.5) * w.spread * 2; d.z += (Math.random() - 0.5) * w.spread * 2; d.normalize();
    const wallT = this.march(o, d, 60);
    const hits = this.horde.ray(o, d, wallT, w.pierce);
    let mul = 1;
    for (const h of hits) {
      const point = o.clone().addScaledVector(d, h.t);
      const res = h.k.hurt({ dmg: this.insta ? 1e9 : w.dmg * mul, part: h.part, gun: true, headMul: w.head, pop: w.pop, dir: d.clone(), point });
      this.onDamage(h.k, res, { gun: true, weapon: w });
      mul *= 0.75;
    }
    if (hits.length < w.pierce && wallT < 60) {
      const p = o.clone().addScaledVector(d, wallT - 0.02);
      this.gore.burst(p.x, p.y, p.z, 4, [0x6a5a48, 0x3a2a1a, 0x9a8a78], 0.025, 1.4, p.y - 2);
      this.gore.fire(p.x, p.y, p.z, 3, 1.2);
    }
    this.anim.kick = w.blast ? 1.4 : s.id === 'murata' ? 1 : 0.7;
    this.flashT = 0.06;
    const tip = o.clone().addScaledVector(d, 0.8); this.flashLight.position.copy(tip); this.flashLight.intensity = w.blast ? 30 : 16;
    if (w.blast) { this.gore.fire(tip.x, tip.y, tip.z, 18, 1.5); }
    this.audio.zmShot && this.audio.zmShot(s.id);
    if (s.mag <= 0 && s.reserve > 0) setTimeout(() => this.reload(), w.rate * 900);
  }
  // distance along a ray to the first wall
  march(o, d, max) {
    for (let t = 0.2; t < max; t += 0.05) if (this.world.solid(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) return t;
    return max;
  }
  occluded(o, c) {
    const dx = c.x - o.x, dy = c.y - o.y, dz = c.z - o.z, L = Math.hypot(dx, dy, dz);
    for (let t = 0.25; t < L - 0.2; t += 0.08) if (this.world.solid(o.x + dx / L * t, o.y + dy / L * t, o.z + dz / L * t)) return true;
    return false;
  }

  update(dt, player, fireHeld) {
    this.time += dt;
    const w = this.w, s = this.slot, A = this.anim;
    if (fireHeld && w.kind === 'gun' && w.auto) this.attack(player);
    // a swing in progress lands partway through
    if (this.swing) {
      const sw = this.swing; sw.t += dt;
      if (!sw.done && sw.t >= sw.hitAt) { sw.done = true; this.meleeHit(sw.w, player); }
      if (sw.t >= sw.dur) this.swing = null;
    }
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; const W2 = WEAPONS[s.id], take = Math.min(W2.mag - s.mag, s.reserve); s.mag += take; s.reserve -= take; }
    }
    // thrown dishes
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const T = this.thrown[i]; T.t += dt;
      const prev = T.p.clone();
      T.v.y -= 9.8 * dt; T.p.addScaledVector(T.v, dt);
      T.mesh.position.copy(T.p); T.mesh.rotation.x += T.spin.x * dt; T.mesh.rotation.y += T.spin.y * dt; T.mesh.rotation.z += T.spin.z * dt;
      const seg = T.p.clone().sub(prev), len = seg.length(); seg.normalize();
      const hit = len > 0 ? this.horde.ray(prev, seg, len + 0.15, 1)[0] : null;
      let smash = null;
      if (hit) {
        const point = prev.clone().addScaledVector(seg, hit.t);
        const res = hit.k.hurt({ dmg: this.insta ? 1e9 : THROWN[T.kind].dmg, part: hit.part, dir: seg.clone(), point, headMul: 2 });
        this.onDamage(hit.k, res, { thrown: true });
        smash = point;
      } else if (this.world.solid(T.p.x, T.p.y, T.p.z) || T.t > 4) smash = T.p;
      if (smash) {
        const g = this.ground(smash);
        this.gore.burst(smash.x, smash.y, smash.z, 10, THROWN[T.kind].colors, 0.04, 2.2, g);
        this.audio.zmSmash && this.audio.zmSmash(T.kind);
        this.scene.remove(T.mesh); this.thrown.splice(i, 1);
      }
    }
    // ---- the viewmodel: sway with your step, kick, swing
    const cam = this.camera;
    this.vCam.aspect = cam.aspect; this.vCam.updateProjectionMatrix();
    A.kick = Math.max(0, A.kick - dt * 6); A.draw = Math.max(0, A.draw - dt * 4); A.throwT = Math.max(0, A.throwT - dt * 3.5);
    const bob = Math.sin(player.stepPhase * Math.PI) * 0.012, sway = Math.cos(player.stepPhase * Math.PI * 0.5) * 0.01;
    this.rig.position.set(sway, bob - A.draw * 0.3 - (player.dead ? 0.5 : 0), 0);
    this.rig.rotation.set(0, 0, 0);
    const id = s ? s.id : 'hands', kind = w.kind, G = GRIP[id];
    const R = this.handR, L = this.handL, Wp = this.weapon, Pv = this.pivot;
    const rl = this.reloading > 0 ? Math.sin(Math.PI * (1 - this.reloading / this.reloadTotal)) : 0;
    // at rest
    Pv.position.set(...G.rest); Pv.rotation.set(A.kick * 0.22 + rl * 0.7, 0, rl * 0.5);
    Pv.position.z += A.kick * 0.05; Pv.position.y -= rl * 0.14;
    Wp.rotation.set(...G.rot); Wp.position.set(0, 0, 0);
    if (id === 'hands') {
      R.position.set(0.19, -0.2, -0.44); R.rotation.set(0.25, -0.15, 0);
      L.position.set(-0.19, -0.21, -0.42); L.rotation.set(0.25, 0.15, 0);
    }
    // a swing
    if (this.swing) {
      const sw = this.swing, k = Math.min(1, sw.t / sw.dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, pk = Math.sin(k * Math.PI);
      if (id === 'hands' || sw.w.quick) {
        if (id === 'hands') { const fist = sw.side > 0 ? R : L; fist.position.z -= pk * 0.3; fist.position.x += (sw.side > 0 ? -1 : 1) * pk * 0.1; fist.position.y += pk * 0.05; }
        else { Pv.position.z -= pk * 0.18; Pv.position.x -= pk * 0.1; Pv.rotation.y += pk * 0.4; }
      } else if (sw.over) {
        // overhead: up behind your shoulder, then down through them
        Wp.rotation.set(THREE.MathUtils.lerp(2.3, -0.75, e), 0.12, 0);
        Pv.position.set(0.12, -0.18 - pk * 0.06, -0.36);
      } else {
        // a flat cut across the room, right to left or back again
        const sd = sw.side, yaw = THREE.MathUtils.lerp(-1.15, 1.3, e) * sd;
        Wp.rotation.set(0.12, yaw, sd * 1.35);
        Pv.position.set(0.1 - yaw * 0.06, -0.24, -0.28 - pk * 0.06);
      }
    }
    const trail = this.trail;
    trail.visible = false;
    if (this.swing && (w.blade || w.blunt) && !this.swing.w.quick) {
      const sw = this.swing, k = Math.min(1, sw.t / sw.dur);
      if (k > 0.12 && k < 0.75) {
        trail.visible = true; trail.material.opacity = Math.sin((k - 0.12) / 0.63 * Math.PI) * (w.blunt ? 0.12 : 0.28);
        trail.material.color.setHex(w.cursed ? 0xff3020 : 0xdfe8ff);
        if (sw.over) { trail.position.set(0.12, -0.15, -0.3); trail.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.2 - k * 1.2); }
        else { trail.position.set(0.06, -0.2, -0.22); trail.rotation.set(-Math.PI / 2 + 0.25, 0, (sw.side > 0 ? 0.6 : -0.6 + Math.PI) + (k - 0.4) * sw.side * 1.4); }
      }
    }
    // throwing a dish: a hand comes up, swings forward, lets go
    const TH = this.throwHand;
    if (id === 'hands') { TH.visible = false; if (A.throwT > 0) { const k = 1 - A.throwT, pk = Math.sin(k * Math.PI); L.position.z -= pk * 0.32; L.position.y += pk * 0.12; } }
    else if (A.throwT > 0 || this.aiming) { const k = 1 - A.throwT, pk = Math.sin(k * Math.PI); TH.visible = true; TH.position.set(-0.2 + pk * 0.05, -0.3 + pk * 0.16, -0.42 - pk * 0.3); TH.rotation.set(0.2, 0.1, 0); }
    else TH.visible = false;
    // the muzzle flash
    this.flashT = (this.flashT || 0) - dt;
    this.flash.visible = this.flashT > 0 && kind === 'gun';
    if (this.flash.visible) { this.flash.position.set(Pv.position.x - 0.01, Pv.position.y + 0.03, Pv.position.z - (id === 'revolver' ? 0.22 : 0.95)); this.flash.scale.setScalar(1 + Math.random()); }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 220);
    // the drink: weapon down, bottle up to the lips and tipped back, weapon up again
    if (this.bottle) {
      this.bottle.visible = this.drinkT > 0;
      if (this.drinkT > 0) {
        this.drinkT = Math.max(0, this.drinkT - dt);
        const k = 1 - this.drinkT / this.drinkDur, away = Math.min(1, k * 5, (1 - k) * 5), up = Math.min(1, Math.max(0, (k - 0.15) * 4)), tip = Math.min(1, Math.max(0, (k - 0.35) * 3)) * (k < 0.85 ? 1 : (1 - k) / 0.15);
        this.rig.position.y -= away * 0.6;
        this.bottle.position.set(0.02, -0.42 + up * 0.3 + tip * 0.04, -0.3 + tip * 0.08);
        this.bottle.rotation.set(-0.2 - tip * 1.6, 0, 0.1);
      }
    }
  }
  ground(p) { for (let y = p.y; y > p.y - 4; y -= 0.0625) if (this.world.solid(p.x, y, p.z)) return Math.floor((y + 0.25) / 0.125) * 0.125 - 0.25 + 0.125; return p.y - 4; }
  clear() { for (const T of this.thrown) this.scene.remove(T.mesh); this.thrown = []; this.slots = [null, null]; this.cur = 0; this.drinkT = 0; this.throwables = []; this.show(); }
}
