// The night parade: gaki (the hungry dead, in tattered burial white) and, every fifth round, oni (red and blue
// brutes with iron clubs). Every body is a rig of separate voxel pieces so a
// blade can take off an arm, a leg or the head; a gaki that loses a leg keeps coming, dragging itself along the floor.
import * as THREE from 'three';
import { Model, C, hash01 } from '../voxel.js';
import { BLOOD } from './gore.js';

const V = 1 / 16;
const FLESH = C('#8c0a0a', 0, 0.12), FLESH_D = C('#5a0404', 0, 0.1), BONE = C('#ece4d0', 0, 0.04);
// what flies off when one's torn apart: mostly dark red, a little bone
const GUTS = [...BLOOD, 0x7a1010, 0x9a1c1c, 0x5a0a0a, 0x6a1414, 0xd8c8b0];

// ---------------------------------------------------------------- looks
const SKINS = ['#a9b5a0', '#9ea8b6', '#c4b994', '#b8a8a0', '#8e9a86'];
const ROBES = ['#e6e1d4', '#d8d2c2', '#cfc8b4', '#e9e6dc'];
const HAIRS = ['#0e0c0c', '#16120f', '#2a2622', '#8a8680'];

// a gaki's parts. style: 0 robed with long hair, 1 robed and balding, 2 bare and starving (ribs, belly, loincloth), 3 robed with a topknot
function gakiParts(seed) {
  const r = (k) => hash01(seed, k, 31);
  const skinHex = SKINS[Math.floor(r(1) * SKINS.length)], robeHex = ROBES[Math.floor(r(2) * ROBES.length)], hairHex = HAIRS[Math.floor(r(3) * HAIRS.length)];
  const style = Math.floor(r(4) * 4);
  const skin = C(skinHex, 0, 0.07), skinD = C(skinHex, 0, 0.16), shade = C('#4a4a44', 0, 0.06);
  const robe = C(robeHex, 0, 0.09), stain = C('#8a7a5a', 0, 0.12), blood = C('#6a0a0a', 0, 0.1), rope = C('#6a6252', 0, 0.06);
  const hair = C(hairHex, 0, 0.05), dark = C('#120a08', 0, 0.02), eye = C('#fff0a0', 1.6, 0.02), tooth = C('#d8d0b8', 0, 0.03), white = C('#f2efe6', 0, 0.02);
  const robed = style !== 2;
  // burial white gone grey at the hem, a few old stains, fresher blood down the front
  const robeD = C(robeHex, 0, 0.2), grime = C('#9a907a', 0, 0.1);
  const cloth = (x, y, z) => {
    const h = hash01((x >> 1) + seed * 3, y >> 1, z >> 1);
    if (y <= 1) return hash01(x, y, z + seed) > 0.5 ? grime : robeD;
    if (z <= 1 && y >= 5 && h > 0.9) return blood;
    return h > 0.94 ? stain : h > 0.8 ? robeD : robe;
  };
  // torso: from the hips up (pivot at the hips), front is z = 0
  const torso = new Model(8, 13, 7, V, [4, 2, 3.5]);
  if (robed) {
    torso.box(1, 0, 1, 7, 12, 6, cloth);
    torso.box(3, 8, 0, 5, 12, 1, skin); torso.set(3, 7, 0, skin);           // the collar falls open at the throat
    torso.box(1, 8, 1, 3, 12, 2, cloth); torso.box(5, 9, 1, 7, 12, 2, cloth);
    torso.box(1, 4, 0, 7, 5, 6, rope);                                        // a rope belt
    torso.set(3, 10, 0, blood); torso.set(4, 9, 0, blood); torso.set(3, 8, 1, blood);  // it dribbles from the mouth
    for (let x = 1; x < 7; x++) if (hash01(x, seed, 5) > 0.55) torso.set(x, 0, 0, cloth(x, 0, 0));
  } else {
    torso.box(1, 2, 1, 7, 12, 6, skin);
    for (const y of [7, 9, 11]) for (let x = 2; x < 6; x++) torso.set(x, y, 0, skinD);   // ribs
    torso.box(2, 2, 0, 6, 7, 1, skin); torso.box(3, 3, -0, 5, 6, 1, skinD);              // the swollen belly
    torso.box(1, 0, 1, 7, 2, 6, white); torso.box(3, 0, 0, 5, 2, 1, white);             // a loincloth
  }
  if (style === 0) torso.box(1, 5, 6, 7, 12, 7, hair);                     // long hair down the back
  // head (pivot at the neck), the face at z = 1
  const head = new Model(7, 9, 7, V, [3.5, 0, 3.5]);
  head.box(1, 0, 1, 6, 6, 6, skin);
  head.box(1, 0, 1, 2, 2, 3, skinD); head.box(5, 0, 1, 6, 2, 3, skinD);    // hollow cheeks
  head.set(2, 3, 1, eye); head.set(4, 3, 1, eye);                            // eyes, sunk and glowing
  head.set(2, 4, 1, shade); head.set(4, 4, 1, shade); head.set(3, 3, 1, skinD);
  head.set(2, 1, 1, tooth); head.set(3, 1, 1, dark); head.set(4, 1, 1, tooth); head.set(3, 0, 1, dark); // a gaping mouth
  if (style !== 2) { head.box(2, 5, 0, 5, 6, 1, white); head.set(3, 6, 0, white); head.box(1, 5, 1, 6, 6, 6, (x, y, z) => (z === 1 || x === 1 || x === 5 || z === 5 ? white : null)); } // the tenkan
  if (style === 0) { head.box(1, 6, 1, 6, 7, 6, hair); head.box(0, 0, 3, 1, 7, 7, hair); head.box(6, 0, 3, 7, 7, 7, hair); head.box(1, 0, 6, 6, 7, 7, hair); head.box(1, 2, 0, 3, 6, 1, hair); }
  if (style === 1) for (const [x, z] of [[1, 4], [5, 4], [2, 5], [4, 5], [1, 3]]) head.box(x, 3, z, x + 1, 6, z + 1, hair);
  if (style === 2) { head.box(1, 6, 2, 6, 7, 5, skinD); head.set(2, 6, 3, hair); head.set(4, 6, 4, hair); }
  if (style === 3) { head.box(1, 6, 1, 6, 7, 6, skinD); head.box(1, 3, 4, 6, 7, 6, hair); head.box(3, 7, 3, 4, 8, 6, hair); }
  // arms (pivot at the shoulder, hanging down -y): long and thin, a wide sleeve, black claws
  const arm = new Model(4, 12, 4, V, [2, 12, 2]);
  arm.box(1, 0, 1, 3, 12, 3, skin); arm.box(1, 0, 1, 3, 1, 3, dark);
  if (robed) { arm.box(0, 6, 0, 4, 12, 4, cloth); arm.box(0, 5, 2, 4, 6, 4, cloth); }
  // legs: a bare thigh (or the robe's skirt), a shin and a grey foot
  const thigh = new Model(3, 6, 4, V, [1.5, 6, 2]);
  thigh.box(0, 0, 0, 3, 6, 4, robed ? cloth : skin);
  const shin = new Model(3, 7, 5, V, [1.5, 7, 2.5]);
  shin.box(0, 1, 1, 3, 7, 4, robed && style !== 3 ? cloth : skin); shin.box(0, 0, 0, 3, 1, 4, skinD); shin.set(1, 0, 0, dark);
  if (robed) shin.box(0, 1, 1, 3, 3, 4, skin);
  head.set(2, 0, 1, blood);
  return { torso, head, arm, thigh, shin, dims: { hip: 13, neck: 11, shX: 4.5, shY: 10.5, legX: 1.6, knee: 6, scale: 0.88 + r(6) * 0.1 }, blood: BLOOD };
}

// an oni: half again as big, muscled, horned, in a tiger skin, with an iron kanabō
function oniParts(blue) {
  const skin = C(blue ? '#3c5cb8' : '#c43a26', 0, 0.06), skinD = C(blue ? '#2a4290' : '#9a2a1a', 0, 0.08), skinL = C(blue ? '#5a7ad0' : '#e05a3a', 0, 0.06);
  const tiger = C('#e0a028', 0, 0.06), stripe = C('#1a120a', 0, 0.04), horn = C('#ece0c0', 0, 0.04), hornD = C('#a89870', 0, 0.04);
  const hair = C('#141010', 0, 0.06), eye = C('#ffd040', 2.0, 0.02), dark = C('#1a0606', 0, 0.02), fang = C('#f4ecd8', 0, 0.02);
  const tigerAt = (x, y) => ((x + y * 2) % 5 === 0 ? stripe : tiger);
  const torso = new Model(10, 14, 8, V, [5, 3, 4]);
  torso.box(1, 3, 1, 9, 14, 7, skin);
  torso.box(2, 9, 0, 8, 13, 1, skinL); torso.box(4, 9, 0, 6, 13, 1, skinD);   // chest
  for (const y of [4, 6]) torso.box(3, y, 0, 7, y + 1, 1, skinD);             // belly
  torso.box(0, 0, 0, 10, 4, 8, (x, y) => tigerAt(x, y));                      // the tiger-skin loincloth
  torso.box(1, 12, 1, 9, 14, 7, skin);
  const head = new Model(9, 11, 9, V, [4.5, 0, 4.5]);
  head.box(1, 0, 1, 8, 7, 8, skin);
  head.box(2, 3, 1, 7, 4, 2, skinD); head.set(3, 3, 1, eye); head.set(5, 3, 1, eye);
  head.box(2, 4, 1, 7, 5, 2, dark);                                           // a heavy brow
  head.box(2, 0, 1, 7, 2, 2, dark); head.set(2, 1, 1, fang); head.set(6, 1, 1, fang); head.set(3, 0, 1, fang); head.set(5, 0, 1, fang);
  head.box(1, 6, 1, 8, 8, 8, hair); head.box(0, 2, 3, 1, 8, 9, hair); head.box(8, 2, 3, 9, 8, 9, hair); head.box(1, 1, 7, 8, 8, 9, hair);
  for (const x of [2, 6]) { head.box(x, 8, 3, x + 1, 10, 4, horn); head.set(x + (x < 4 ? -0 : 0), 10, 4, hornD); }
  const arm = new Model(5, 12, 5, V, [2.5, 12, 2.5]);
  arm.box(0, 2, 0, 5, 12, 5, skin); arm.box(1, 8, 0, 4, 11, 1, skinL); arm.box(0, 0, 0, 5, 3, 5, skinD);
  arm.box(0, 4, 0, 5, 5, 5, C('#c8a040', 0, 0.04));                          // an iron cuff
  const thigh = new Model(5, 6, 5, V, [2.5, 6, 2.5]);
  thigh.box(0, 0, 0, 5, 6, 5, skin); thigh.box(0, 3, 0, 5, 6, 5, (x, y) => tigerAt(x, y + 7));
  const shin = new Model(5, 7, 6, V, [2.5, 7, 3]);
  shin.box(0, 1, 1, 5, 7, 5, skin); shin.box(0, 0, 0, 5, 1, 5, skinD);
  const club = new Model(4, 26, 4, V, [2, 3, 2]);
  const iron = C('#3a3a3e', 0, 0.06), stud = C('#8a8a90', 0, 0.04), grip = C('#3a2414', 0, 0.06);
  club.box(1, 0, 1, 3, 6, 3, grip);
  club.box(0, 6, 0, 4, 26, 4, (x, y, z) => ((x + z) % 3 === 0 && y % 3 === 0 && (x === 0 || x === 3 || z === 0 || z === 3) ? stud : iron));
  return { torso, head, arm, thigh, shin, club, dims: { hip: 13, neck: 11, shX: 6.2, shY: 10.5, legX: 2.6, knee: 6, scale: 1.2 }, blood: BLOOD };
}

// models are built once per look and shared by every yōkai wearing it
const cache = new Map();
const parts = (key, build) => cache.get(key) || cache.set(key, build()).get(key);
export const GAKI_LOOKS = 10;

// ---------------------------------------------------------------- a stump: red flesh round a white bone
const stumpModel = parts('stump', () => { const m = new Model(4, 1, 4, V, [2, 0.5, 2]); m.box(0, 0, 0, 4, 1, 4, FLESH); m.box(1, 0, 1, 3, 1, 3, FLESH_D); m.box(1, 0, 1, 2, 1, 2, BONE); return m; });

const DUMMY = new THREE.Object3D(), DUMMY_LEG = { t: new THREE.Object3D(), k: new THREE.Object3D() };
// ---------------------------------------------------------------- a body: hips, torso, neck, head, two arms, two legs
class Rig {
  constructor(P, mats) {
    const d = P.dims, mk = (m) => m.mesh(mats.lit, mats.emit);
    this.P = P; this.d = d; this.mats = mats;
    const g = this.group = new THREE.Group();
    this.body = new THREE.Group(); g.add(this.body); this.body.scale.setScalar(d.scale);
    const hips = this.hips = new THREE.Group(); hips.position.y = d.hip * V; this.body.add(hips);
    this.torso = new THREE.Group(); hips.add(this.torso); this.torso.add(mk(P.torso));
    this.neck = new THREE.Group(); this.neck.position.y = d.neck * V; this.torso.add(this.neck); this.neck.add(mk(P.head));
    this.arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * d.shX * V, d.shY * V, 0); this.torso.add(a); a.add(mk(P.arm)); return a; });
    this.legs = [-1, 1].map((s) => {
      const t = new THREE.Group(); t.position.set(s * d.legX * V, 0, 0); hips.add(t); t.add(mk(P.thigh));
      const k = new THREE.Group(); k.position.y = -d.knee * V; t.add(k); k.add(mk(P.shin));
      return { t, k };
    });
    if (P.club) { this.club = mk(P.club); this.club.position.set(0, -11 * V, -0.5 * V); this.club.rotation.x = Math.PI / 2 - 0.2; this.arms[1].add(this.club); }
  }
  // the rig with only the pieces still attached (severed ones are debris now, and mustn't be posed)
  live(limbs) {
    const v = this._v || (this._v = { arms: [], legs: [] });
    v.body = this.body; v.hips = this.hips; v.d = this.d;
    const top = limbs.torso !== false; // cut in half: the top's debris now
    v.torso = top ? this.torso : DUMMY;
    v.neck = top && limbs.head ? this.neck : DUMMY;
    v.arms[0] = top && limbs.armL ? this.arms[0] : DUMMY; v.arms[1] = top && limbs.armR ? this.arms[1] : DUMMY;
    v.legs[0] = limbs.legL ? this.legs[0] : DUMMY_LEG; v.legs[1] = limbs.legR ? this.legs[1] : DUMMY_LEG;
    return v;
  }
  stump(parent, pos, rx = 0, rz = 0) {
    const m = stumpModel.mesh(this.mats.lit, this.mats.emit); m.position.copy(pos); m.rotation.set(rx, 0, rz); parent.add(m); return m;
  }
}

// ---------------------------------------------------------------- one yōkai
let NEXT = 1;
export class Yokai {
  constructor(kind, horde, opts = {}) {
    this.id = NEXT++; this.kind = kind; this.horde = horde;
    const mats = horde.mats;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.speed = 0; this.phase = Math.random() * 10; this.t = 0;
    this.limbs = { head: true, armL: true, armR: true, legL: true, legR: true };
    this.crawl = false; this.flinch = 0; this.attackT = 0; this.state = 'rise'; this.riseT = 0;
    this.wobble = (Math.random() - 0.5) * 0.6;
    // no two bleed alike: some gush, some barely seep; and each dies its own way
    this.bleed = 0.6 + Math.random() * 1.1;
    this.temper = Math.random();
    {
      const P = kind === 'oni' ? parts(opts.blue ? 'oniB' : 'oniR', () => oniParts(opts.blue)) : parts('gaki' + (opts.look ?? 0), () => gakiParts(opts.look ?? 0));
      this.rig = new Rig(P, mats); this.group = this.rig.group;
      this.size = kind === 'oni' ? 0.42 : 0.28; this.height = kind === 'oni' ? 2.5 : 1.75;
    }
    horde.scene.add(this.group);
  }
  get alive() { return this.state !== 'dead'; }
  get s() { return this.rig ? this.rig.d.scale : 1; }
  // ---- where a ray meets this body: { t, part } in world units (or null)
  boxes() {
    const k = this.s / 0.92;
    if (this.crawl) return [
      ['head', [-0.17 * k, 0.12, -1.1 * k, 0.17 * k, 0.48, -0.72 * k]], ['torso', [-0.22 * k, 0.04, -0.75 * k, 0.22 * k, 0.42, 0.12]],
      ['armL', [-0.42 * k, 0.0, -1.2 * k, -0.2 * k, 0.3, -0.3 * k]], ['armR', [0.2 * k, 0.0, -1.2 * k, 0.42 * k, 0.3, -0.3 * k]],
    ];
    return [
      ['head', [-0.2 * k, 1.42 * k, -0.24 * k, 0.2 * k, 1.85 * k, 0.2 * k]],
      ['torso', [-0.23 * k, 0.78 * k, -0.2 * k, 0.23 * k, 1.44 * k, 0.17 * k]],
      ['armL', [-0.4 * k, 0.75 * k, -0.62 * k, -0.2 * k, 1.42 * k, 0.12 * k]], ['armR', [0.2 * k, 0.75 * k, -0.62 * k, 0.4 * k, 1.42 * k, 0.12 * k]],
      ['legL', [-0.24 * k, 0, -0.16 * k, 0, 0.8 * k, 0.16 * k]], ['legR', [0, 0, -0.16 * k, 0.24 * k, 0.8 * k, 0.16 * k]],
    ];
  }
  raycast(o, d, maxT = 60) {
    if (!this.alive || this.state === 'rise' && this.riseT < 0.5) return null;
    // into this body's frame: feet at the origin, facing -z
    const c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    const ox = o.x - this.pos.x, oz = o.z - this.pos.z, oy = o.y - this.pos.y - this.lift();
    const lx = ox * c + oz * s, lz = -ox * s + oz * c, dx = d.x * c + d.z * s, dz = -d.x * s + d.z * c;
    let best = null;
    for (const [part, b] of this.boxes()) {
      if (!this.limbs[part] && part !== 'torso') continue;
      const t = slab(lx, oy, lz, dx, d.y, dz, b);
      if (t !== null && t < maxT && (!best || t < best.t)) best = { t, part };
    }
    return best;
  }
  lift() { return this.state === 'rise' ? -1.8 * (1 - Math.min(1, this.riseT / 1.4)) : 0; }
  // the middle of the body, for aiming and splashes
  center(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + (this.crawl ? 0.25 : this.height * 0.6) + this.lift(), this.pos.z); }

  // ---- getting hurt. hit: { dmg, part, blade (0..1 chance to sever), blunt, gun, dir: Vector3, point: Vector3 }
  hurt(hit) {
    if (!this.alive) return { killed: false };
    const H = this.horde, gore = H.gore, ground = this.pos.y;
    let dmg = hit.dmg, part = hit.part || 'torso';
    const head = part === 'head';
    if (head) dmg *= hit.headMul || 2;
    if (this.state === 'stagger') dmg *= 1.5; // an oni catching its breath after a charge
    if (this.kind === 'oni' && !head) dmg *= 1;
    this.hp -= dmg; this.flinch = 1;
    const p = hit.point || this.center(), dir = hit.dir || new THREE.Vector3(0, 0, 1);
    // blood out of the wound, and some onto the floor (and up the wall behind, if there's one close)
    const n = Math.round((hit.blunt ? 34 : hit.gun ? 26 : 40) * this.bleed);
    gore.spray(p.x, p.y, p.z, dir.x * 0.9, 0.5, dir.z * 0.9, n, 2.8, 1.0, ground);
    if (hit.blade || hit.blunt || hit.gun) gore.splat(p.x + dir.x * 0.5, ground, p.z + dir.z * 0.5, 0.2 + 0.15 * this.bleed);
    gore.wall && gore.wall(p, dir, 0.25 + 0.3 * this.bleed);
    const killed = this.hp <= 0;
    let severed = null;
    // blades take limbs: more often on the killing blow; the head only comes off if it's a killing blow (or a big blade)
    if (hit.blade && part !== 'torso') {
      const chance = killed ? Math.min(1, hit.blade + 0.35) : hit.blade * (part === 'head' ? 0.35 : 1);
      if (Math.random() < chance && (part !== 'head' || killed || hit.blade >= 0.9)) severed = part;
    }
    if (hit.blade && part === 'torso' && Math.random() < hit.blade * 0.5) {
      // a horizontal cut through the body takes an arm on the side it came from
      const side = hit.side ?? (Math.random() < 0.5 ? -1 : 1);
      const arm = side < 0 ? 'armL' : 'armR';
      if (this.limbs[arm]) severed = arm;
    }
    // a heavy round through an arm or a leg can take it clean off
    if (hit.gun && !severed && part !== 'torso' && part !== 'head' && Math.random() < Math.min(0.65, hit.dmg / 700 + (killed ? 0.2 : 0))) severed = part;
    if (this.kind === 'oni' && severed && severed.startsWith('leg') && !hit.blast) severed = null; // too thick
    if (severed && this.limbs[severed]) this.sever(severed, dir);
    // a blast tears pieces off whatever it doesn't kill outright
    if (hit.blast && !killed) for (const q of ['armL', 'armR', 'legL', 'legR']) if (this.limbs[q] && Math.random() < hit.blast * 0.45 && !(this.kind === 'oni' && q.startsWith('leg'))) this.sever(q, dir, 1.6);
    // a headshot kill from a gun can burst the head
    if (killed && head && hit.gun && this.limbs.head && Math.random() < (hit.pop ?? 0.55)) this.popHead(dir);
    else if (killed && !severed) this.finish(hit, part, dir);
    if (killed || !this.limbs.head) this.die(hit);
    return { killed: killed || !this.limbs.head, head, severed };
  }
  // the killing blow, each its own way: depends on what did it, how hard, and on the yōkai
  finish(hit, part, dir) {
    const r = Math.random(), big = hit.dmg >= 500 || hit.insta;
    if (hit.blast) {
      if (r < 0.55 * hit.blast + 0.2) return this.explode(dir, 1 + hit.blast);
      for (const q of ['armL', 'armR', 'legL', 'legR', 'head']) if (this.limbs[q] && Math.random() < 0.4) this.sever(q, dir, 1.8);
      return;
    }
    if (hit.blade) {
      if (big && r < 0.3) return this.cutInHalf(dir, hit.side ?? 1);                    // clean through at the waist
      if (r < 0.55 && this.limbs.head) return this.sever('head', dir);                  // off with it
      if (r < 0.75) { const a = this.temper < 0.5 ? 'armL' : 'armR'; if (this.limbs[a]) this.sever(a, dir); }
      return;
    }
    if (hit.blunt) {
      if (hit.dmg >= 700 && r < 0.4) return this.explode(dir, 1.3);                     // the kanabō: burst like a melon
      if (r < 0.5 && this.limbs.head) return this.popHead(dir);
      return;
    }
    if (hit.gun) {
      if (hit.dmg >= 300 && part === 'torso' && r < 0.3) return this.cutInHalf(dir, 1); // a rifle round through the middle
      if (r < 0.3 && part !== 'head') { const q = ['armL', 'armR'][r < 0.15 ? 0 : 1]; if (this.limbs[q]) this.sever(q, dir, 1.2); }
    }
  }
  // cut in two at the waist: the top half goes flying, the legs stand a moment and fold
  cutInHalf(dir, side = 1) {
    if (this.limbs.torso === false) return;
    const R = this.rig, H = this.horde, gore = H.gore, ground = this.pos.y, sc = this.s;
    this.limbs.torso = false;
    H.scene.attach(R.torso);
    R.stump(R.hips, new THREE.Vector3(0, 0.5 * V, 0));
    const v = new THREE.Vector3(dir.x * 2.4 + side * 0.6, 1.4 + Math.random(), dir.z * 2.4);
    gore.limb(R.torso, v, new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, side * 6), ground, 0.16 * sc);
    gore.spurt(R.hips, new THREE.Vector3(0, 0.5 * V, 0), new THREE.Vector3(0, 1, 0), 2.6, ground);
    gore.spurt(R.torso, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), 1.6, ground);
    const wp = new THREE.Vector3(); R.hips.getWorldPosition(wp);
    gore.spray(wp.x, wp.y, wp.z, dir.x, 0.9, dir.z, Math.round(90 * this.bleed), 3.6, 1.6, ground);
    gore.burst(wp.x, wp.y, wp.z, 14, GUTS, 0.045, 2.6, ground);
    H.onSever && H.onSever(this, 'torso');
  }
  // blown apart: limbs, head and the top half every which way, and a shower of the rest
  explode(dir, power = 1.5) {
    const R = this.rig, H = this.horde, gore = H.gore, ground = this.pos.y;
    const c = this.center(new THREE.Vector3());
    for (const q of ['head', 'armL', 'armR', 'legL', 'legR']) if (this.limbs[q]) {
      const a = Math.random() * Math.PI * 2, d = new THREE.Vector3(Math.cos(a) * 0.6 + dir.x, 0, Math.sin(a) * 0.6 + dir.z).normalize();
      this.sever(q, d, power * (1 + Math.random()));
    }
    this.cutInHalf(dir, Math.random() < 0.5 ? -1 : 1);
    R.torso.visible = Math.random() < 0.5; // sometimes there's nothing left of the middle to speak of
    gore.burst(c.x, c.y, c.z, 34, GUTS, 0.05, 4.5 * power, ground);
    gore.spray(c.x, c.y, c.z, 0, 1, 0, Math.round(160 * this.bleed), 4.5, 2.2, ground);
    gore.pool(c.x, ground, c.z, 1.4);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; gore.wall && gore.wall(c, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 0.5); }
  }
  sever(part, dir, power = 1) {
    const R = this.rig, H = this.horde, gore = H.gore, ground = this.pos.y, sc = this.s;
    let obj, parent, joint, spurtDir;
    if (part === 'head') { obj = R.neck; parent = R.torso; joint = R.neck.position.clone(); spurtDir = new THREE.Vector3(0, 1, 0); }
    else if (part === 'armL' || part === 'armR') { const a = R.arms[part === 'armL' ? 0 : 1]; obj = a; parent = R.torso; joint = a.position.clone(); spurtDir = new THREE.Vector3(part === 'armL' ? -1 : 1, 0.3, 0); }
    else { const l = R.legs[part === 'legL' ? 0 : 1]; obj = l.t; parent = R.hips; joint = l.t.position.clone(); spurtDir = new THREE.Vector3(0, -1, 0.2); }
    this.limbs[part] = false;
    // the piece leaves the body and becomes debris, a stump stays behind (and one on the piece)
    H.scene.attach(obj);
    const side = part === 'armL' ? -1 : 1;
    if (part === 'head') { R.stump(obj, new THREE.Vector3(), Math.PI); R.stump(parent, joint); }
    else if (part.startsWith('arm')) { R.stump(obj, new THREE.Vector3(), 0, side * Math.PI / 2); R.stump(parent, joint, 0, -side * Math.PI / 2); }
    else { R.stump(obj, new THREE.Vector3()); R.stump(parent, joint, Math.PI); }
    const v = new THREE.Vector3(dir.x * 2.2 + (Math.random() - 0.5), 1.6 + Math.random() * 1.6, dir.z * 2.2 + (Math.random() - 0.5)).multiplyScalar(power);
    if (part.startsWith('leg') && power <= 1) v.set(dir.x * 0.6, 0.6, dir.z * 0.6);
    gore.limb(obj, v, new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12), ground, part === 'head' ? 0.18 * sc : 0.1 * sc);
    gore.spurt(parent, joint, spurtDir, (part === 'head' ? 2.2 : 1.4) * (0.6 + this.bleed * 0.6), ground);
    gore.spurt(obj, new THREE.Vector3(), new THREE.Vector3(0, part === 'head' ? -1 : 1, 0), 0.8, ground);
    const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
    gore.spray(wp.x, wp.y, wp.z, dir.x, 0.6, dir.z, Math.round(60 * this.bleed), 3.4, 1.3, ground);
    gore.burst(wp.x, wp.y, wp.z, 8, GUTS, 0.04, 2.0 * power, ground);
    gore.wall && gore.wall(wp, dir, 0.4);
    if (part === 'armR' && R.club) this.unarmed = true;
    if (part.startsWith('leg')) this.goProne();
    H.onSever && H.onSever(this, part);
  }
  popHead(dir) {
    const R = this.rig, H = this.horde, gore = H.gore, ground = this.pos.y;
    const wp = new THREE.Vector3(); R.neck.getWorldPosition(wp); wp.y += 0.15 * this.s;
    R.neck.visible = false; this.limbs.head = false;
    R.stump(R.torso, R.neck.position.clone(), 0);
    const skinHex = '#a9b5a0';
    gore.burst(wp.x, wp.y, wp.z, 18, [...BLOOD, 0xece4d0, 0xa9b5a0, 0x9ea8b6, 0x141010], 0.05, 3.2, ground);
    gore.spray(wp.x, wp.y, wp.z, dir.x, 0.8, dir.z, 70, 3.6, 1.6, ground);
    gore.spurt(R.torso, R.neck.position.clone(), new THREE.Vector3(0, 1, 0), 2.2, ground);
    void skinHex;
  }
  goProne() {
    if (this.crawl) return;
    this.crawl = true; this.speedMul = 0.45;
    this.horde.onCrawl && this.horde.onCrawl(this);
  }
  die(hit) {
    if (this.state === 'dead') return;
    this.state = 'dead'; this.t = 0; this.hp = 0;
    const dir = hit.dir || new THREE.Vector3(0, 0, 1);
    // fall away from the blow
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.fallDir = dir.x * fx + dir.z * fz > 0 ? 1 : -1; // forward onto its face, or back
    this.knock = hit.blunt ? new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(hit.knock || 2.5) : new THREE.Vector3();
    this.horde.gore.pool(this.pos.x + fx * 0.4 * this.fallDir, this.pos.y, this.pos.z + fz * 0.4 * this.fallDir, this.kind === 'oni' ? 1.4 : 0.9);
  }

  // ---- the pose for this frame
  pose(dt) {
    const R = this.rig.live(this.limbs), st = this.state, run = this.speed > 1.8;
    this.phase += this.speed * dt * (run ? 4.4 : 3.2) / (this.kind === 'oni' ? 1.3 : 1);
    const s = Math.sin(this.phase), w = Math.min(1, this.speed / 0.8);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    R.body.position.y = this.lift();
    R.body.rotation.set(0, 0, 0); R.body.position.x = R.body.position.z = 0;
    if (this.crawl) {
      // face down, dragging itself along by the arms
      R.hips.position.y = 0.16 / this.s; R.torso.rotation.set(Math.PI / 2 - 0.15, 0, Math.sin(this.phase) * 0.08);
      R.neck.rotation.x = -1.2;
      R.arms.forEach((a, i) => { a.rotation.x = Math.PI - 0.3 + Math.sin(this.phase + i * Math.PI) * 0.5 * w; a.rotation.z = (i ? -1 : 1) * 0.25; });
      R.legs.forEach((L, i) => { L.t.rotation.x = Math.PI / 2 - 0.2; L.k.rotation.x = 0.2 + Math.sin(this.phase + i) * 0.1; });
    } else {
      R.hips.position.y = R.d.hip * V + Math.abs(Math.cos(this.phase)) * 0.02 * w;
      const lean = run ? 0.45 : 0.22 + this.wobble * 0.15;
      R.torso.rotation.set(lean - this.flinch * 0.5, Math.sin(this.phase * 0.5) * 0.1, Math.sin(this.phase) * (run ? 0.05 : 0.12) * w + this.wobble * 0.2);
      R.neck.rotation.set(-lean * 0.6, 0, this.wobble * 0.6 + Math.sin(this.phase * 0.7) * 0.1);
      R.legs.forEach((L, i) => {
        const ph = i ? s : -s, amp = run ? 0.85 : this.kind === 'oni' ? 0.45 : 0.5;
        L.t.rotation.x = ph * amp * w - (run ? 0.15 : 0);
        L.k.rotation.x = -Math.max(0, -ph) * (run ? 1.3 : 0.8) * w - (run ? 0.3 : 0);
      });
      // arms: reaching for you (gaki), swinging the club (oni)
      R.arms.forEach((a, i) => {
        if (this.kind === 'oni') {
          a.rotation.x = i === 1 && !this.unarmed ? 0.5 + Math.sin(this.phase) * 0.15 : (i ? -s : s) * 0.5 * w;
          a.rotation.z = (i ? -1 : 1) * 0.18;
        } else if (run) { a.rotation.x = 1.0 + (i ? -s : s) * 0.9; a.rotation.z = (i ? -1 : 1) * 0.2; }
        else { a.rotation.x = 1.35 + Math.sin(this.phase * 0.8 + i * 1.7) * 0.18 + (i ? this.wobble : -this.wobble) * 0.3; a.rotation.z = (i ? -1 : 1) * 0.08; }
      });
    }
    // attacking: claws (or the club) come down
    if (st === 'attack') {
      const k = this.t / this.attackDur, sw = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 2;
      if (this.kind === 'oni' && !this.unarmed) { R.arms[1].rotation.x = 0.5 + 2.6 * (1 - Math.abs(k * 2 - 1)) * (k < 0.5 ? 1 : 1) - (k > 0.5 ? (k - 0.5) * 6 : 0); }
      else R.arms.forEach((a, i) => { a.rotation.x = (this.crawl ? Math.PI - 0.3 : 1.4) + 1.1 * sw - (k > 0.45 ? 1.6 * (k - 0.45) : 0); });
      R.torso.rotation.x += 0.25 * sw;
    }
    if (st === 'tear') {
      const k = (this.t % 1.2) / 1.2;
      R.arms.forEach((a, i) => { a.rotation.x = 1.6 + Math.sin(k * Math.PI * 2 + i) * 0.5; });
      R.torso.rotation.x = 0.2 - Math.sin(k * Math.PI * 2) * 0.15;
    }
    if (st === 'stomp') { // rearing up, club raised, one foot coming down
      const k = Math.min(1, this.t / 0.75);
      R.torso.rotation.x = -0.35 * Math.sin(k * Math.PI); R.arms.forEach((a) => { a.rotation.x = 2.6 * Math.sin(k * Math.PI * 0.8); a.rotation.z *= 2; });
      R.legs[0].t.rotation.x = -0.7 * Math.sin(k * Math.PI); R.legs[0].k.rotation.x = 0.6 * Math.sin(k * Math.PI);
      R.body.position.y = -0.04 * Math.max(0, Math.sin(k * Math.PI * 2));
    }
    if (st === 'charge') { R.torso.rotation.x = 0.75; R.neck.rotation.x = -0.5; R.arms.forEach((a, i) => { a.rotation.x = -0.6 + (i ? -1 : 1) * Math.sin(this.phase) * 0.4; }); }
    if (st === 'stagger') { R.torso.rotation.x = 0.55 + Math.sin(this.t * 7) * 0.05; R.neck.rotation.x = 0.3; R.arms.forEach((a) => { a.rotation.x = 0.15; a.rotation.z *= 0.5; }); }
    if (st === 'climb') { R.torso.rotation.x = 0.9; R.legs.forEach((L) => { L.t.rotation.x = 1.0; L.k.rotation.x = -1.4; }); R.arms.forEach((a) => { a.rotation.x = 2.2; }); }
    if (st === 'rise') R.arms.forEach((a, i) => { a.rotation.x = 2.6 + Math.sin(this.riseT * 6 + i * 2) * 0.4; });
    if (st === 'dead') this.poseDead(dt);
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
  }
  poseDead(dt) {
    const R = this.rig.live(this.limbs), k = Math.min(1, this.t / 0.55);
    // topple: rotate the whole body about the feet, then lie still; later sink away
    const fall = (this.fallDir > 0 ? 1 : -1) * Math.PI / 2 * (k * k);
    R.body.rotation.x = this.crawl ? 0 : -fall;
    R.body.position.y = (this.crawl ? 0 : -0.05 * k) - Math.max(0, this.t - 9) * 0.25;
    R.arms.forEach((a, i) => { a.rotation.x = 0.3 + i * 0.4; a.rotation.z = (i ? -1 : 1) * (0.3 + k * 0.6); });
    R.legs.forEach((L, i) => { L.t.rotation.x = i * 0.3; L.k.rotation.x = -0.2; });
    if (this.knock && this.t < 0.5) { this.pos.addScaledVector(this.knock, dt * (1 - this.t * 2)); }
  }
  remove() {
    const H = this.horde;
    H.scene.remove(this.group);
  }
}

// ray vs axis-aligned box in local space: entry distance or null
function slab(ox, oy, oz, dx, dy, dz, [x0, y0, z0, x1, y1, z1]) {
  let t0 = 0, t1 = Infinity;
  for (const [o, d, a, b] of [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
    let ta = (a - o) / d, tb = (b - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null;
  }
  return t0;
}
