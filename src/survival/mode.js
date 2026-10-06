// 百鬼夜行 — the night parade. The shop after dark, boarded up, and the yōkai coming up out of the snow in rounds.
// You start in the front room with nothing but the dishes on the tables. Kills and hits earn points; points break
// the ofuda seals on the doorways (opening more of the place), buy weapons off the racks, rebuild the boards on the
// windows, buy blessings from the glowing machines round the place (in the front room, the freezer, the kura, out
// by the vending machine and up in the flat), and shake the omikuji box for whatever fortune gives you. The rules
// (how many come, how fast, how tough) follow Black Ops' zombies, solo. Nothing here touches the shop's save.
import * as THREE from 'three';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { WalkGrid } from './nav.js';
import { Gore } from './gore.js';
import { Horde } from './horde.js';
import { Arsenal, WEAPONS, weaponModel } from './weapons.js';
import { Grenades, MAX_GRENADES } from './grenade.js';
import { ParadeSound } from './sfx.js';
import { GAKI_LOOKS } from './yokai.js';
import * as ZP from './props.js';

// ---------------------------------------------------------------- the map
// where the yōkai climb in: the window (or doorway) span to board, the spots either side, which zone it guards
const BARRIERS = [
  { id: 'westFront', zone: 'front', axis: 'x', wall: 0.125, u0: -1.75, u1: -0.2, y0: 1.0, y1: 2.625, sill: 1.0, ext: [-0.85, 0.125, -0.95], int: [0.8, 0.25, -0.95], pane: [0.125, -3.0, -0.125] },
  { id: 'bay', zone: 'front', axis: 'z', wall: -3.25, u0: 6.75, u1: 8.25, y0: 1.0, y1: 2.625, sill: 1.05, ext: [7.5, 0.125, -4.35], int: [7.5, 0.25, -1.3], pane: [-3.25, 6.75, 8.25] },
  { id: 'door', zone: 'front', axis: 'z', wall: -3.25, u0: 12.75, u1: 14.0, y0: 0.35, y1: 2.45, sill: 0.35, ext: [13.4, 0.125, -4.35], int: [13.4, 0.25, -2.45], block: [12.7, 14.05, -3.5, -3.0] },
  { id: 'westA', zone: 'dining', axis: 'x', wall: 0.125, u0: 1.875, u1: 4.125, y0: 1.0, y1: 2.75, sill: 1.0, ext: [-0.85, 0.125, 3.0], int: [0.85, 0.25, 3.0], pane: [0.125, 1.875, 4.125] },
  { id: 'westB', zone: 'dining', axis: 'x', wall: 0.125, u0: 6.625, u1: 8.75, y0: 1.0, y1: 2.75, sill: 1.0, ext: [-0.85, 0.125, 7.7], int: [0.85, 0.25, 7.7], pane: [0.125, 6.625, 8.75] },
];
// doorways sealed with ofuda until you pay; the zone each one opens
const GATES = [
  { id: 'partA', zone: 'dining', cost: 750, label: 'the dining room', box: [7.25, 8.5, -0.25, 0.5], axis: 'z', at: 0.125, u0: 7.25, u1: 8.5, base: 0.25 },
  { id: 'partB', zone: 'dining', cost: 750, label: 'the dining room', box: [12.75, 14.0, -0.25, 0.5], axis: 'z', at: 0.125, u0: 12.75, u1: 14.0, base: 0.25 },
  { id: 'kitchenA', zone: 'kitchen', cost: 1000, label: 'the kitchen', box: [10.0, 11.125, 9.75, 10.5], axis: 'z', at: 10.06, u0: 10.0, u1: 11.125, base: 0.25 },
  { id: 'kitchenB', zone: 'kitchen', cost: 1000, label: 'the kitchen', box: [14.0, 15.125, 9.75, 10.5], axis: 'z', at: 9.98, u0: 14.0, u1: 15.125, base: 0.25, door: 'kitchen' },
  { id: 'hall', zone: 'rest', cost: 1000, label: 'the washrooms', box: [0.375, 1.625, 9.75, 10.5], axis: 'z', at: 10.06, u0: 0.375, u1: 1.625, base: 0.25 },
  { id: 'back', zone: 'grounds', cost: 1250, label: 'the back door', box: [0.375, 1.625, 15.4, 16.2], axis: 'z', at: 15.6, u0: 0.375, u1: 1.625, base: 0.25, door: 'back' },
  { id: 'freezer', zone: 'freezer', cost: 1250, label: 'the walk-in freezer', box: [15.4, 16.25, 11.0, 12.25], axis: 'x', at: 15.6, u0: 11.0, u1: 12.25, base: 0.25, door: 'freezer' },
  { id: 'kura', zone: 'kura', cost: 1000, label: 'the old kura', box: [23.25, 24.75, 2.5, 3.5], y: [0, 1.2], axis: 'z', at: 2.84, u0: 23.25, u1: 24.75, base: 0.5, door: 'kura' },
  { id: 'apt', zone: 'apartment', cost: 1250, label: 'the flat upstairs', box: [15.55, 16.3, 6.45, 7.55], y: [3.0, 4.6], axis: 'x', at: 15.875, u0: 6.5, u1: 7.5, base: 3.75 },
];
// rising out of the floor (or the snow) inside a zone, as well as climbing in through its barriers
const RISES = [
  { zone: 'kitchen', at: [9.0, 0.25, 14.2], indoor: true }, { zone: 'kitchen', at: [13.3, 0.25, 13.7], indoor: true },
  { zone: 'rest', at: [3.4, 0.25, 14.4], indoor: true }, { zone: 'rest', at: [1.0, 0.25, 12.4], indoor: true },
  { zone: 'grounds', at: [-9.5, 0.125, -8.5] }, { zone: 'grounds', at: [-10, 0.125, 6] }, { zone: 'grounds', at: [-9, 0.125, 14.5] },
  { zone: 'grounds', at: [4, 0.125, -9.6] }, { zone: 'grounds', at: [12, 0.125, -9.6] }, { zone: 'grounds', at: [22, 0.125, -9.5] },
  { zone: 'grounds', at: [31.5, 0.125, -6] }, { zone: 'grounds', at: [31.5, 0.125, 6] }, { zone: 'grounds', at: [31, 0.125, 15.5] },
  { zone: 'grounds', at: [12, 0.125, 17] }, { zone: 'grounds', at: [24, 0.125, 16.8] }, { zone: 'grounds', at: [-3, 0.125, 16.8] },
];
const BUYS = [
  { id: 'tanto', zone: 'front', at: [3.0, 1.45, -0.03], face: [0, -1] },
  { id: 'revolver', zone: 'front', at: [10.6, 1.45, -0.03], face: [0, -1] },
  { id: 'katana', zone: 'dining', at: [15.7, 1.4, 2.3], face: [-1, 0] },          // (clear of the mural)
  { id: 'murata', zone: 'kitchen', at: [15.7, 1.5, 14.75], face: [-1, 0] },
  { id: 'type100', zone: 'dining', at: [10.6, 1.6, 0.27], face: [0, 1] },         // back to back with the revolver
  { id: 'type96', zone: 'freezer', at: [17.1, 1.5, 10.645], face: [0, 1] },
  { id: 'odachi', zone: 'kura', at: [24.0, 2.05, 8.73], face: [0, -1] },            // over the sake barrels
];
// the power: a breaker in the washrooms' hall. Until it's thrown the blessings' machines stand dark and the lamps
// burn low
const POWER = { zone: 'rest', at: [1.73, 1.0, 12.6], face: [-1, 0] };
// the blessings: glowing machines, one to an area, each a perk from Black Ops under its own name here.
// at: the machine's foot, face: the way its front looks
export const PERKS = [
  { id: 'omamori', zone: 'front', name: 'Omamori', kanji: '守', cost: 500, text: 'get back up when you fall (solo, three times)', bo: 'quick revive', at: [11.75, 0.25, -0.33], face: [0, -1], color: '#3aa0ff', uses: 3 },
  { id: 'tetsu', zone: 'freezer', name: 'Tetsu', kanji: '鉄', cost: 2500, text: 'take two and a half times the punishment', bo: 'juggernog', at: [17.82, 0.25, 11.75], face: [-1, 0], color: '#ff3a2e' },
  { id: 'hayate', zone: 'grounds', name: 'Hayate', kanji: '速', cost: 2000, text: 'swing and shoot a third faster', bo: 'double tap', at: [20.55, 0.125, -2.7], face: [0, -1], color: '#ffd23a' },
  { id: 'sake', zone: 'kura', name: 'Sake Courage', kanji: '酒', cost: 3000, text: 'reload twice as fast', bo: 'speed cola', at: [26.2, 0.5, 6.8], face: [-1, 0], color: '#4ad86a' },
  { id: 'sanbon', zone: 'apartment', name: 'Sanbon no Ya', kanji: '三', cost: 4000, text: 'carry a third weapon', bo: 'mule kick', at: [7.0, 3.75, 8.18], face: [0, -1], color: '#5ae0c8' },
];
const BOX_SPOTS = [
  { zone: 'dining', at: [15.05, 0.25, 1.15], yaw: Math.PI / 2 },
  { zone: 'kitchen', at: [5.65, 0.25, 14.9], yaw: -Math.PI / 2 },
  { zone: 'grounds', at: [-6.4, 0.125, 0.9], yaw: Math.PI },
];
const BOX_COST = 950;
const POOL = [['tanto', 8], ['katana', 10], ['revolver', 10], ['murata', 10], ['type100', 10], ['naginata', 12], ['kanabo', 12], ['type96', 9], ['tanegashima', 8], ['muramasa', 3]];
const FORTUNE = { type96: ['吉', 'blessing'], type100: ['中吉', 'middle blessing'], muramasa: ['大吉', 'great blessing'], tanegashima: ['吉', 'blessing'], naginata: ['吉', 'blessing'], kanabo: ['吉', 'blessing'], murata: ['中吉', 'middle blessing'], katana: ['中吉', 'middle blessing'], revolver: ['小吉', 'small blessing'], tanto: ['末吉', 'future blessing'] };
const PILES = [1.4, 3.65, 5.9, 8.15, 10.4];
const START = { x: 8.0, z: -1.0, yaw: 0 };
const ZONE_NAMES = { front: 'the front room', dining: 'the dining room', kitchen: 'the kitchen', rest: 'the washrooms', grounds: 'the grounds', freezer: 'the freezer', kura: 'the kura', apartment: 'the flat' };

// ---------------------------------------------------------------- the round's numbers (Black Ops, solo, eased)
// Black Ops' shapes, made gentler: fewer of them, a little slower to rise, softer, and slower to toughen up
export const MAX_ALIVE = 24;              // at most this many up at once; the rest wait and come as these fall
export const EASE = { count: 0.8, delay: 1.3 };
// how many come in a round: Black Ops' 6, 8, 13, 18, 24, 27... at four-fifths: 4, 6, 10, 14, 19, 21...
export function roundCount(r) {
  let mult = Math.max(1, r / 5);
  if (r >= 10) mult *= r * 0.15;
  const max = 24 + Math.floor(0.5 * 6 * mult);
  const early = [0.25, 0.3, 0.5, 0.7, 0.9][r - 1];
  return Math.max(4, Math.floor((early ? Math.floor(max * early) : max) * EASE.count));
}
// the wait between one rising and the next: Black Ops' (2 s on round one, 5% less each round, never under 0.1 s, plus
// 0.1 s solo / 0.05 s in company, on a 20 Hz tick), stretched by 30%: 2.75 s on round one, 0.3 s at the end
export function spawnDelay(r, coop = false) {
  const d = (Math.max(2 * 0.95 ** (r - 1), 0.1) + (coop ? 0.05 : 0.1)) * EASE.delay;
  return Math.round(d / 0.05) * 5 / 100;
}
// how much they take: 100 on round one, 75 more each round to the ninth, then 8% more every round
export const roundHealth = (r) => (r < 10 ? 100 + 75 * (r - 1) : 700 * 1.08 ** (r - 9));
export const BREAK = 20; // seconds to catch your breath between rounds
// oni nights (every fifth round): two oni on the fifth, one more every five rounds after
export const oniCount = (r) => 1 + Math.floor(r / 5);

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function kanjiNum(n) {
  if (n >= 100) return n.toString();
  const t = Math.floor(n / 10), o = n % 10;
  return (t > 1 ? KANJI[t] : '') + (t > 0 ? '十' : '') + (o ? KANJI[o] : '');
}
const pts = (n) => Math.round(n).toLocaleString('en-US');
// the first five rounds are counted the way Japanese tallies are, a stroke of 正 at a time (Black Ops chalks five lines)
const TALLY = ['M18 14 L82 13', 'M50 14 L50 87', 'M51 50 L77 49', 'M26 43 L25 87', 'M11 87 L89 86'];
const tally = (n) => `<svg class="tally" viewBox="0 0 100 100">${TALLY.slice(0, n).map((d) => `<path d="${d}"/>`).join('')}</svg>`;

export class Parade {
  constructor(o) {
    // o: scene, camera, player, world, interactions, doors {front, kitchen, restA, restB, back, freezer, kura}, allDoors, glass [{g, m}],
    //    glassMat, composer, audio, toast, litMat, emitMat, lamps, snowPile, hud (element), onQuit, onAgain
    Object.assign(this, o);
    this.mats = { lit: o.litMat, emit: o.emitMat };
    this.round = 0; this.points = 500; this.kills = 0; this.heads = 0; this.limbs = 0; this.earned = 0; this.time = 0;
    this.zones = new Set(['front']);
    this.perks = new Set();
    this.hp = 100; this.maxHp = 100; this.hurtT = 99; this.dead = false;
    this.mul = 1; this.timers = { double: 0, insta: 0 };
    this.fire = false; this.keys = {};
    this.repairPts = 0;
  }

  // ------------------------------------------------------------------ setting the stage
  start() {
    const { scene, world, interactions } = this;
    this.sfx = new ParadeSound(this.audio);
    this.audio.musicOn = false;
    this.items = interactions.items; interactions.items = []; // the shop's things to click go quiet
    // walking grid over the lot (indoors the steps are gentler)
    const indoor = (x, z) => (x > -0.05 && x < 16.05 && z > -3.5 && z < 16.05) || (x > 20.9 && x < 27.1 && z > 2.9 && z < 9.1) || (x > 15.9 && x < 18.5 && z > 10.3 && z < 13.2);
    this.nav = new WalkGrid(world, { indoor });
    this.gore = new Gore(scene); this.gore.world = world; // (blood can run up the walls)
    const D = this.doors;
    this.horde = new Horde({ scene, mats: this.mats, gore: this.gore, nav: this.nav, doors: this.allDoors.filter((d) => d !== D.front),
      onHit: (k) => this.hurt(k), onTear: (b, k) => this.tear(b, k),
      onSound: (what, k) => { if (what === 'attack' && Math.random() < 0.5) this.sfx.groan(k.pos, k.kind); if (what === 'door') this.audio.doorSound(true, k && false); if (what === 'roar') { this.sfx.groan(k.pos, 'oni'); this.shake = Math.max(this.shake || 0, 0.15); } if (what === 'crash') { this.sfx.board(true, k.pos); this.shake = Math.max(this.shake || 0, 0.3); } } });
    this.horde.onSever = () => { this.limbs++; };
    // you can't walk through them
    world.blockers = [...(world.blockers || []), this.horde];
    const sfx = this.sfx;
    this.arsenal = new Arsenal({ scene, camera: this.camera, world, horde: this.horde, gore: this.gore, mats: this.mats,
      audio: { zmDraw: () => sfx.draw(), zmClick: () => sfx.click(), zmReload: (id) => sfx.reload(id), zmWhoosh: (k) => sfx.whoosh(k), zmHit: (k) => sfx.hit(k), zmShot: (id) => sfx.shot(id), zmSmash: (k) => sfx.smash(k) },
      onDamage: (k, res, how) => this.damaged(k, res, how), onEmpty: () => this.say('out of ammo') });
    // fire-pots: G throws one
    this.grenades = new Grenades({ scene, world, horde: this.horde, gore: this.gore, mats: this.mats, audio: this.audio,
      onDamage: (k, res, how) => this.damaged(k, res, how),
      onBlast: (at) => { this.sfx.blast(at); const d = at.distanceTo(this.player.pos); this.shake = Math.max(this.shake || 0, Math.max(0, 0.9 - d * 0.1)); if (d < 2.2 && !this.dead) { this.hp -= 20 * (1 - d / 2.2); this.hurtT = 0; } } });
    const pass = new RenderPass(this.arsenal.vScene, this.arsenal.vCam); pass.clear = false; pass.clearDepth = true;
    this.composer.insertPass(pass, 1);
    // the front door stands open behind its boards; the doors deeper in are sealed until bought
    D.front.locked = true; D.front.target = D.front.max; D.front.a = D.front.max;
    for (const d of [D.kitchen, D.back, D.freezer, D.kura]) { d.locked = true; d.target = 0; }
    for (const d of [D.restA, D.restB]) d.locked = false;
    this.buildBarriers(); this.buildGates(); this.buildBuys(); this.buildPerks(); this.buildPower(); this.buildBox(); this.buildPiles(); this.buildDoors();
    this.drops = [];
    // you
    const p = this.player;
    p.pos.set(START.x, 0.25, START.z); p.yaw = START.yaw; p.pitch = -0.05; p.vel.set(0, 0, 0); if (p.seated) p.standUp();
    p.dead = false; p.speedMul = 1;
    // a little colder in here tonight: the lamps flicker
    for (const l of this.lamps) l.base = l.mul;
    document.body.classList.add('parade');
    this.hud.classList.add('on');
    this.drawHud(true);
    this.sfx.start();
    this.breakT = 4; this.say('百鬼夜行 · the night parade is coming', 4000);
    this.sub('grab the dishes off the tables: they make fine throwing (Q) · G throws a fire-pot · space jumps', 6000);
  }

  // ---- windows and the front door, boarded
  buildBarriers() {
    const { scene, nav } = this;
    this.barriers = BARRIERS.map((B) => {
      const b = { ...B, boards: 0, max: 6, meshes: [], climber: null };
      const inward = [B.int[0] - B.ext[0], B.int[2] - B.ext[2]], L = Math.hypot(...inward); b.in = [inward[0] / L, inward[1] / L];
      b.center = new THREE.Vector3(B.axis === 'x' ? B.wall : (B.u0 + B.u1) / 2, (B.y0 + B.y1) / 2, B.axis === 'x' ? (B.u0 + B.u1) / 2 : B.wall);
      // the glass goes (the rest of the pane stays)
      if (B.pane) this.openPane(B);
      for (let i = 0; i < b.max; i++) this.addBoard(b, true);
      if (B.block) { // an open doorway: shut to walkers for good (the boards are the only way through)
        const [x0, x1, z0, z1] = B.block; this.world.blockers.push({ blocks: (x, y, z) => x > x0 && x < x1 && z > z0 && z < z1 && y < 2.6 });
        nav.addGate(B.block, -1, 2);
      }
      b.portal = nav.addPortal(B.ext, B.int, { barrier: b });
      // rebuild: hold E at the window
      b.ix = this.interactions.add([b.center.x + b.in[0] * 0.25, b.center.y - 0.2, b.center.z + b.in[1] * 0.25, B.axis === 'x' ? 0.3 : (B.u1 - B.u0) / 2, 0.7, B.axis === 'x' ? (B.u1 - B.u0) / 2 : 0.3],
        () => `hold E · rebuild the boards (${b.boards}/${b.max})`, () => {}, () => b.boards < b.max && !this.dead);
      return b;
    });
    void scene;
  }
  openPane(B) {
    for (const gp of this.glass) {
      const g = gp.g;
      const match = B.axis === 'x' ? g.axis === 'x' && Math.abs(g.x - B.wall) < 0.01 && g.z0 <= B.u0 + 0.01 && g.z1 >= B.u1 - 0.01
        : g.axis === 'z' && Math.abs(g.z - B.wall) < 0.01 && g.x0 <= B.u0 + 0.01 && g.x1 >= B.u1 - 0.01;
      if (!match) continue;
      gp.m.visible = false;
      const a0 = B.axis === 'x' ? g.z0 : g.x0, a1 = B.axis === 'x' ? g.z1 : g.x1;
      for (const [s0, s1] of [[a0, B.u0], [B.u1, a1]]) {
        if (s1 - s0 < 0.05) continue;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s1 - s0, g.y1 - g.y0), this.glassMat); m.renderOrder = 4;
        if (B.axis === 'x') { m.position.set(g.x, (g.y0 + g.y1) / 2, (s0 + s1) / 2); m.rotation.y = Math.PI / 2; } else m.position.set((s0 + s1) / 2, (g.y0 + g.y1) / 2, g.z);
        this.scene.add(m);
      }
    }
  }
  // a plank across the opening (instant, or slapped on with a knock)
  addBoard(b, silent = false) {
    const i = b.boards; if (i >= b.max) return;
    const len = (b.u1 - b.u0) + 0.22, m = ZP.plank(len).mesh(this.mats.lit, this.mats.emit);
    const t = (i + 0.5) / b.max, y = b.y0 + 0.12 + t * (b.y1 - b.y0 - 0.24), tilt = ((i * 37) % 7 - 3) * 0.05;
    const inset = 0.17 + (i & 1) * 0.035;
    if (b.axis === 'x') { m.position.set(b.wall + b.in[0] * inset, y, (b.u0 + b.u1) / 2); m.rotation.set(tilt, Math.PI / 2, 0); }
    else { m.position.set((b.u0 + b.u1) / 2, y, b.wall + b.in[1] * inset); m.rotation.set(0, 0, tilt); }
    this.scene.add(m); b.meshes.push(m); b.boards++;
    if (!silent) this.sfx.board(false, b.center);
  }
  // a yōkai rips a plank away (an oni takes two)
  tear(b, k) {
    const n = k.kind === 'oni' ? b.boards : 1; // an oni's club takes the lot
    for (let j = 0; j < n && b.boards > 0; j++) {
      const m = b.meshes.pop(); b.boards--;
      const v = new THREE.Vector3(-b.in[0] * 2.2 + (Math.random() - 0.5), 1.2 + Math.random(), -b.in[1] * 2.2 + (Math.random() - 0.5));
      this.gore.limb(m, v, new THREE.Vector3(Math.random() * 4, Math.random() * 6, Math.random() * 4), k.pos.y, 0.03);
      this.gore.burst(m.position.x, m.position.y, m.position.z, 4, [0x7a5a3a, 0x6a4a2e, 0x8a6a48], 0.035, 1.5, k.pos.y);
    }
    this.sfx.board(true, b.center);
    if (Math.random() < 0.35) this.sfx.groan(k.pos, k.kind);
  }

  // ---- the ofuda seals over doorways
  buildGates() {
    const { nav } = this;
    this.gates = GATES.map((G) => {
      const g = { ...G, open: false, group: new THREE.Group() };
      const [ylo, yhi] = G.y || [-0.5, 2.0];
      g.nav = nav.addGate(G.box, ylo, yhi);
      const w = G.u1 - G.u0, mid = (G.u0 + G.u1) / 2, grp = g.group;
      // where the seal hangs, in the doorway's plane
      if (G.axis === 'z') grp.position.set(mid, G.base, G.at); else { grp.position.set(G.at, G.base, mid); grp.rotation.y = Math.PI / 2; }
      const pl = (len, x, y, rz) => { const m = ZP.plank(len).mesh(this.mats.lit, this.mats.emit); m.position.set(x, y, 0.06); m.rotation.z = rz; grp.add(m); return m; };
      g.planks = [];
      if (!G.door) {
        g.planks.push(pl(w + 0.2, 0, 0.55, 0.06), pl(w + 0.2, 0, 1.15, -0.05), pl(w + 0.2, 0, 1.75, 0.04));
        const diag = Math.hypot(w, 1.6); g.planks.push(pl(diag, 0, 1.15, Math.atan2(1.6, w)));
        // the player can't get past the planks
        const [x0, x1, z0, z1] = G.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = G.axis === 'z' ? w / 2 : 0.18, hz = G.axis === 'z' ? 0.18 : w / 2;
        this.world.blockers.push({ blocks: (x, y, z) => !g.open && Math.abs(x - cx) < hx && Math.abs(z - cz) < hz && y > G.base - 0.2 && y < G.base + 2.4 });
      }
      g.papers = [];
      const nP = Math.max(3, Math.round(w / 0.32));
      for (let i = 0; i < nP; i++) {
        const m = ZP.ofuda().mesh(this.mats.lit, this.mats.emit);
        m.position.set(-w / 2 + (i + 0.5) * w / nP, 1.25 + ((i * 53) % 5 - 2) * 0.08, G.door ? 0.1 : 0.1); m.rotation.z = ((i * 31) % 5 - 2) * 0.08;
        grp.add(m); g.papers.push(m);
      }
      const rope = ZP.shimenawa(w + 0.1).mesh(this.mats.lit, this.mats.emit); rope.position.set(0, 2.05, 0.12); grp.add(rope); g.papers.push(rope);
      // both faces of the doorway carry the seal
      const back = grp.clone(); back.rotation.y = Math.PI; back.position.set(0, 0, 0); const holder = new THREE.Group(); holder.add(back);
      grp.add(holder); g.backPapers = back;
      this.scene.add(grp);
      const [x0, x1, z0, z1] = G.box, cy = G.base + 1.1;
      g.ix = this.interactions.add([(x0 + x1) / 2, cy, (z0 + z1) / 2, (x1 - x0) / 2 + 0.15, 1.1, (z1 - z0) / 2 + 0.15],
        () => `E · break the seal: open ${G.label} [cost: ${pts(G.cost)}]`, () => this.buyGate(g), () => !g.open && !this.dead);
      return g;
    });
  }
  // breaking one seal opens the whole room: every other doorway into the same place unseals with it
  buyGate(g) {
    if (g.open) return;
    if (!this.spend(g.cost)) return;
    for (const o of this.gates) if (o.zone === g.zone && !o.open) this.openGate(o);
  }
  openGate(g) {
    g.open = true; g.nav.open = true; this.horde.flowT = 0;
    // the planks fall, the paper burns
    for (const m of g.planks) {
      this.scene.attach(m);
      this.gore.limb(m, new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5 + Math.random(), (Math.random() - 0.5) * 1.5), new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3), g.base, 0.03);
    }
    const wp = new THREE.Vector3();
    for (const m of [...g.papers]) { m.getWorldPosition(wp); this.gore.fire(wp.x, wp.y, wp.z, 8, 1.2); this.gore.burst(wp.x, wp.y, wp.z, 3, [0x2a2420, 0x141010], 0.02, 0.8, g.base); }
    this.scene.remove(g.group);
    if (g.door) { const d = this.doors[g.door]; d.locked = false; if (!d.open) { d.toggle(this.player.pos); this.audio.doorSound(true, d.slide); } }
    if (g.id === 'back') this.snowPile.visible = false;
    const fresh = !this.zones.has(g.zone);
    this.zones.add(g.zone);
    this.sfx.seal();
    if (fresh) this.say(`${ZONE_NAMES[g.zone]} is open`, 2200);
  }
  // doors the yōkai and you can open, once their seal is broken
  buildDoors() {
    const D = this.doors;
    for (const [d, name] of [[D.kitchen, 'kitchen door'], [D.restA, 'washroom door'], [D.restB, 'washroom door'], [D.back, 'back door'], [D.freezer, 'freezer door'], [D.kura, 'kura door']]) {
      this.interactions.add(() => d.box(), () => (d.open ? 'E · close the ' : 'E · open the ') + name, () => {
        if (d.open && d.playerInDoorway(this.player.pos)) return;
        const r = d.toggle(this.player.pos); if (r) this.audio.doorSound(r === 'open', d.slide);
      }, () => !d.locked);
    }
  }

  // ---- weapons on the walls, as in Black Ops: a chalk outline glowing on the wall, the weapon hung over it, its name
  // and price written underneath
  buildBuys() {
    const KANJI_OF = { tanto: '短刀', katana: '刀', revolver: '拳銃', murata: '村田銃', type100: '百式', type96: '九六式', odachi: '大太刀' };
    const SHAPE = { tanto: ['blade', 0.62], katana: ['blade', 1.08], revolver: ['pistol', 0.4], murata: ['rifle', 1.25], type100: ['smg', 0.9], type96: ['lmg', 1.3], odachi: ['blade', 1.45] };
    const short = (W) => (W.name.startsWith('Type 26') ? 'Revolver' : W.name);
    this.buys = BUYS.map((B) => {
      const W = WEAPONS[B.id], grp = new THREE.Group();
      grp.position.set(...B.at); grp.rotation.y = Math.atan2(B.face[0], B.face[1]) + Math.PI;
      const [kind, len] = SHAPE[B.id] || ['blade', 0.8];
      const ch = ZP.chalk(kind, len, short(W), KANJI_OF[B.id] || '', pts(W.price));
      ch.position.set(0, -0.02, 0.02); ch.rotation.y = Math.PI; grp.add(ch);
      const glow = ZP.buyGlow(Math.max(1.3, len + 0.8), 1.0); glow.position.set(0, 0.0, 0.015); glow.rotation.y = Math.PI; grp.add(glow);
      // the weapon itself, hung over its outline: turned so its business end points the way the drawing's does (to
      // the left as you face the wall), sized to the drawing, and centred on it
      const wm = weaponModel(B.id).mesh(this.mats.lit, this.mats.emit);
      wm.rotation.set(0, -Math.PI / 2, 0);
      const holder = new THREE.Group(); holder.add(wm); holder.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(wm), size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
      const k = len / Math.max(0.1, size.x);
      holder.scale.setScalar(k); holder.position.set(-mid.x * k, 0.052 - mid.y * k, -0.035 - (mid.z + size.z / 2) * k);
      grp.add(holder);
      // and its price on a tag over it, that turns to face you
      const tag = ZP.priceTag(`${KANJI_OF[B.id] || ''} ${short(W).toLowerCase()}`, pts(W.price)); tag.position.set(0, 0.62, -0.12); grp.add(tag);
      this.scene.add(grp);
      const bx = B.at[0] + B.face[0] * 0.15, bz = B.at[2] + B.face[1] * 0.15, hw = Math.max(0.6, len / 2 + 0.1);
      const ix = this.interactions.add([bx, B.at[1] - 0.05, bz, B.face[0] ? 0.2 : hw, 0.4, B.face[1] ? 0.2 : hw], () => {
        const name = short(W).toLowerCase();
        if (this.arsenal.has(B.id)) return W.kind === 'gun' ? `E · ammo for the ${name} [cost: ${pts(W.ammo)}]` : `you already carry the ${name}`;
        return `E · buy the ${name} [cost: ${pts(W.price)}]`;
      }, () => {
        if (this.arsenal.has(B.id)) { if (W.kind === 'gun' && this.spend(W.ammo)) { this.arsenal.refill(B.id); this.sfx.reload(B.id); } return; }
        if (this.spend(W.price)) { this.arsenal.give(B.id); this.sfx.draw(); this.sub(`${W.name.toLowerCase()} · ${W.kind === 'gun' ? (W.auto ? 'hold the mouse: fully automatic · R to reload' : 'R to reload') : 'hold the mouse to keep swinging'} · 1 / 2 to switch`, 3500); }
      }, () => !this.dead);
      return { ...B, grp, chalk: ch, glow, tag, ix };
    });
  }

  // ---- the power: until the breaker's thrown, the machines are dark and the lamps low
  buildPower() {
    this.power = false;
    const grp = new THREE.Group(), P = POWER;
    grp.position.set(...P.at); grp.rotation.y = Math.atan2(P.face[0], P.face[1]) + Math.PI;
    grp.add(ZP.breaker().mesh(this.mats.lit, this.mats.emit));
    const lever = ZP.breakerLever().mesh(this.mats.lit, this.mats.emit); const pivot = new THREE.Group(); pivot.position.set(0, 0.5, -0.08); pivot.add(lever); pivot.rotation.x = -0.9; grp.add(pivot);
    const tag = ZP.priceTag('電源 · the power', 'throw the switch'); tag.position.set(0, 1.45, -0.15); grp.add(tag);
    this.scene.add(grp);
    this.powerBox = { grp, pivot, tag };
    this.interactions.add([P.at[0] + P.face[0] * 0.2, P.at[1] + 0.55, P.at[2] + P.face[1] * 0.2, P.face[0] ? 0.25 : 0.45, 0.6, P.face[1] ? 0.25 : 0.45],
      () => (this.power ? '電源 · the power is on' : 'E · throw the power switch'), () => this.powerOn(), () => !this.dead);
  }
  powerOn() {
    if (this.power) return;
    this.power = true; this.powerT = 0;
    this.sfx.powerOn();
    this.say('電源 · the power is on', 2600); this.sub('the blessings are lit', 2600);
    this.powerBox.tag.visible = false;
    for (const m of this.perkMachines) this.lightMachine(m, true);
    const [x, y, z] = POWER.at; this.gore.fire(x, y + 0.6, z, 26, 2.4);
  }

  // ---- blessings: the machines, glowing in their colours (and playing their little tunes now and then)
  buildPerks() {
    this.omamoriLeft = 3;
    this.perkMachines = PERKS.map((P, i) => {
      const grp = new THREE.Group();
      let y = P.at[1]; for (let h = P.at[1] + 0.6; h > P.at[1] - 0.3; h -= 0.0625) if (this.world.solid(P.at[0], h, P.at[2])) { y = Math.floor((h + 0.25) / 0.125) * 0.125 - 0.25 + 0.125; break; }
      grp.position.set(P.at[0], y, P.at[2]); grp.rotation.y = Math.atan2(P.face[0], P.face[1]) + Math.PI;
      const body = ZP.perkMachine(P.color, false).mesh(this.mats.lit, this.mats.emit); grp.add(body);
      const face = ZP.perkFace(P); face.position.set(0, 1.12, -0.316); face.rotation.y = Math.PI; grp.add(face);
      const glow = new THREE.PointLight(new THREE.Color(P.color), 0, 5.5, 2); glow.position.set(0, 1.7, -0.9); grp.add(glow);
      face.material.color.setScalar(0.12); // dark until the power's on
      this.scene.add(grp);
      const fx = P.face[0], fz = P.face[1];
      this.interactions.add([P.at[0] + fx * 0.5, y + 1.0, P.at[2] + fz * 0.5, fx ? 0.3 : 0.5, 0.95, fz ? 0.3 : 0.5], () => {
        if (!this.power) return `${P.kanji} ${P.name} · dark: the power's off`;
        if (this.perks.has(P.id)) return `${P.kanji} ${P.name} · yours`;
        if (P.id === 'omamori' && this.omamoriLeft <= 0) return `${P.kanji} ${P.name} · the machine is empty`;
        return `E · ${P.kanji} ${P.name} · ${P.text} [cost: ${pts(P.cost)}]`;
      }, () => this.buyPerk(P), () => !this.dead);
      return { P, grp, body, face, glow, tuneT: 15 + i * 9 + Math.random() * 30 };
    });
  }
  // the machines light up one after another, a flicker and then on, each playing its tune
  lightMachine(m, on) {
    const swap = () => {
      m.grp.remove(m.body); m.body = ZP.perkMachine(m.P.color, on).mesh(this.mats.lit, this.mats.emit); m.grp.add(m.body);
      m.glow.intensity = on ? 2.6 : 0; m.lit = on;
      if (on && m.grp.position.distanceTo(this.player.pos) < 16) this.sfx.jingle(m.P.id, m.grp.position);
    };
    if (!on) return swap();
    const i = this.perkMachines.indexOf(m);
    setTimeout(() => { m.glow.intensity = 1.2; setTimeout(() => { m.glow.intensity = 0; setTimeout(swap, 140); }, 90); }, 500 + i * 450);
  }
  buyPerk(P) {
    if (!this.power) { this.sub("it's dark: throw the power switch in the washrooms' hall", 2200); this.audio.rattle(); return; }
    if (this.perks.has(P.id) || (P.id === 'omamori' && this.omamoriLeft <= 0) || this.downT > 0) return;
    if (!this.spend(P.cost)) return;
    if (P.id === 'omamori') this.omamoriLeft--;
    this.perks.add(P.id); this.applyPerks();
    this.arsenal.drink(P.color); this.sfx.drink(); setTimeout(() => this.sfx.jingle(P.id), 900);
    this.say(`${P.kanji} ${P.name}`, 2400); this.sub(P.text, 2800);
  }
  applyPerks() {
    const has = (id) => this.perks.has(id), A = this.arsenal;
    const was = this.maxHp; this.maxHp = has('tetsu') ? 250 : 100;
    this.hp = this.maxHp > was ? this.hp + this.maxHp - was : Math.min(this.hp, this.maxHp);
    this.player.speedMul = 1;
    A.rateMul = has('hayate') ? 0.75 : 1;
    A.reloadMul = has('sake') ? 0.5 : 1;
    A.setSlots(has('sanbon') ? 3 : 2);
    this.regenDelay = 3.0; this.regenRate = 1;
    this.drawHud(true);
  }

  // ---- the omikuji box
  buildBox() {
    const grp = new THREE.Group(), m = ZP.omikuji().mesh(this.mats.lit, this.mats.emit); grp.add(m);
    this.boxGrp = grp; this.box = { spot: 0, state: 'idle', t: 0, uses: 0, show: new THREE.Group() };
    grp.add(this.box.show);
    this.scene.add(grp); this.placeBox(0);
    this.interactions.add(() => { const [x, y, z] = BOX_SPOTS[this.box.spot].at; return [x, y + 0.75, z, 0.4, 0.55, 0.4]; }, () => {
      const b = this.box;
      if (b.state === 'idle') return `E · shake the omikuji box · ${pts(BOX_COST)}`;
      if (b.state === 'shake') return 'the sticks rattle…';
      if (b.state === 'ready') return `E · ${FORTUNE[b.pick][0]} · take the ${WEAPONS[b.pick].name.toLowerCase()}`;
      return '';
    }, () => this.useBox(), () => !this.dead && this.box.state !== 'gone');
  }
  placeBox(i) {
    const S = BOX_SPOTS[i]; this.box.spot = i;
    this.boxGrp.position.set(...S.at); this.boxGrp.rotation.y = S.yaw; this.boxGrp.visible = true;
  }
  useBox() {
    const b = this.box;
    if (b.state === 'idle') {
      if (!this.spend(BOX_COST)) return;
      b.uses++; b.state = 'shake'; b.t = 0; this.sfx.box();
      // a bad fortune now and then: the box goes elsewhere (and you get your points back)
      b.curse = b.uses > 3 && Math.random() < 0.2;
      const owned = new Set(this.arsenal.slots.filter(Boolean).map((s) => s.id));
      const pool = POOL.filter(([id]) => !owned.has(id)), tot = pool.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * tot; b.pick = pool[pool.length - 1][0];
      for (const [id, w] of pool) { r -= w; if (r <= 0) { b.pick = id; break; } }
    } else if (b.state === 'ready') {
      this.arsenal.give(b.pick); this.sfx.draw();
      this.sub(`${WEAPONS[b.pick].name.toLowerCase()}${WEAPONS[b.pick].cursed ? ' · a cursed blade. every kill heals you' : ''}`, 3000);
      b.state = 'idle'; b.show.clear();
    }
  }
  updateBox(dt) {
    const b = this.box; b.t += dt;
    if (b.state === 'shake') {
      this.boxGrp.children[0].rotation.z = Math.sin(b.t * 30) * 0.08;
      if ((b.cyc = (b.cyc || 0) - dt) <= 0) {
        b.cyc = 0.12 + b.t * 0.05; b.show.clear();
        const ids = Object.keys(FORTUNE), id = ids[Math.floor(Math.random() * ids.length)];
        const wm = weaponModel(id).mesh(this.mats.lit, this.mats.emit); wm.scale.setScalar(0.7); b.show.add(wm);
      }
      b.show.position.set(0, 1.4 + Math.min(1, b.t) * 0.25, 0); b.show.rotation.y += dt * 3;
      if (b.t > 3) {
        this.boxGrp.children[0].rotation.z = 0;
        if (b.curse) {
          this.points += BOX_COST; b.show.clear();
          const [x, y, z] = BOX_SPOTS[b.spot].at; this.gore.fire(x, y + 0.8, z, 30, 1.5);
          this.say('凶 · a curse', 2000); this.sub('the box leaves for somewhere else. your points come back', 3000); this.sfx.fortune(false);
          const others = BOX_SPOTS.map((_, i) => i).filter((i) => i !== b.spot);
          this.placeBox(others[Math.floor(Math.random() * others.length)]); b.state = 'idle'; b.uses = 0;
          return;
        }
        b.state = 'ready'; b.t = 0; b.show.clear();
        const wm = weaponModel(b.pick).mesh(this.mats.lit, this.mats.emit); wm.scale.setScalar(0.7); b.show.add(wm);
        const tg = ZP.tag(FORTUNE[b.pick][0], FORTUNE[b.pick][1]); tg.position.set(0, -0.25, 0); b.show.add(tg);
        this.sfx.fortune(true);
      }
    } else if (b.state === 'ready') {
      b.show.rotation.y += dt * 1.2; b.show.position.y = 1.65 - Math.min(1, b.t / 9) * 0.4;
      if (b.t > 9) { b.state = 'idle'; b.show.clear(); }
    }
  }

  // ---- dishes on the front room's tables: round one's weapons
  buildPiles() {
    this.piles = PILES.map((x) => {
      const z = -2.3;
      let top = 0.8; for (let y = 1.3; y > 0.3; y -= 0.03125) if (this.world.solid(x, y, z)) { top = Math.floor((y + 0.25) / 0.125) * 0.125 - 0.25 + 0.125; break; }
      const p = { x, z, y: top, n: 3, mesh: null };
      this.drawPile(p);
      this.interactions.add([x, top + 0.1, z, 0.3, 0.15, 0.3], () => (p.n ? `E · grab the dishes (${p.n}) · throw with the mouse or Q` : 'nothing left on this table'), () => {
        let got = 0;
        while (p.n > 0 && this.arsenal.addThrowable(['plate', 'cup', 'tokkuri'][(p.n + Math.floor(Math.random() * 3)) % 3])) { p.n--; got++; }
        if (!got) { this.sub('your hands are full of dishes', 1500); return; }
        this.audio.clickSound(); this.drawPile(p);
      }, () => p.n > 0 && !this.dead);
      return p;
    });
  }
  drawPile(p) {
    if (p.mesh) this.scene.remove(p.mesh);
    p.mesh = p.n ? ZP.dishPile(p.n).mesh(this.mats.lit, this.mats.emit) : null;
    if (p.mesh) { p.mesh.position.set(p.x, p.y + 0.002, p.z); this.scene.add(p.mesh); }
  }

  // ------------------------------------------------------------------ points
  spend(n) {
    if (this.points < n) { this.sub(`not enough points · ${pts(n)} needed`, 1600); this.audio.rattle(); return false; }
    this.points -= n; this.sfx.buy(); this.drawHud(); return true;
  }
  earn(n) {
    n *= this.mul; this.points += n; this.earned += n;
    const el = document.createElement('div'); el.className = 'zm-plus'; el.textContent = `+${n}`;
    this.hud.querySelector('.zm-pluses').appendChild(el); setTimeout(() => el.remove(), 900);
    this.drawHud();
  }
  damaged(k, res, how) {
    const reticle = document.getElementById('reticle'); reticle.classList.remove('zm-hit'); void reticle.offsetWidth; reticle.classList.add('zm-hit');
    if (res.killed) {
      this.kills++; if (res.head) this.heads++;
      reticle.classList.add('zm-kill'); setTimeout(() => reticle.classList.remove('zm-kill'), 200);
      this.earn(k.kind === 'oni' ? 300 : how.melee ? 130 : res.head ? 100 : how.blast ? 50 : 60);
      this.sfx.die(k.pos, k.kind);
      if (how.weapon && how.weapon.heal) this.hp = Math.min(this.maxHp, this.hp + how.weapon.heal);
      this.maybeDrop(k);
    } else this.earn(10);
  }

  // ------------------------------------------------------------------ rounds
  roundStats(r, kind) {
    const hp = roundHealth(r);
    if (kind === 'oni') return { hp: hp * 2.5 + 300, speed: 1.2, dmg: 60, reach: 1.5, attackDur: 1.2, hitAt: 0.7, tearTime: 1.0, climbTime: 1.4 };
    // how they move, as in Black Ops: the round times eight, give or take, under 35 walks, under 70 runs, the rest sprint
    const pace = r * 8 + (Math.random() - 0.5) * 20;
    const speed = pace < 35 ? 0.75 + Math.random() * 0.3 : pace < 70 ? 1.8 + Math.random() * 0.4 : 2.6 + Math.random() * 0.5;
    return { hp, speed, dmg: 40, reach: 0.9, attackDur: 0.85, hitAt: 0.42, tearTime: 1.25, climbTime: 1.05 };
  }
  nextRound() {
    this.round++;
    const r = this.round;
    // every fifth night the oni come instead: a few of them, and nothing else
    this.oniRound = r % 5 === 0;
    this.toSpawn = this.oniRound ? oniCount(r) : roundCount(r);
    this.spawnT = 2; this.dropsThisRound = 0; this.repairPts = 0;
    if (r > 1) this.grenades.newRound(); this.grenades.round = r;
    for (const p of this.piles) { p.n = 3; this.drawPile(p); }
    this.sfx.taiko(this.oniRound ? [0, 0.35, 0.7, 1.05, 1.25, 1.45, 1.6] : undefined);
    this.drawHud(true);
    const el = this.hud.querySelector('.zm-round'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    document.body.classList.toggle('zm-oni', this.oniRound);
    if (this.oniRound) { this.spawnT = 4; setTimeout(() => { this.say('鬼の夜 · the oni are coming', 3000); this.sub('they charge in a straight line · step aside, then strike', 3500); }, 1200); }
  }
  pickSpawn() {
    const nav = this.nav, cand = [];
    for (const b of this.barriers) {
      if (!this.zones.has(b.zone)) continue;
      const out = [b.ext[0] - b.in[0] * 1.3, b.ext[1], b.ext[2] - b.in[1] * 1.3];
      cand.push({ at: out, indoor: false });
    }
    for (const R of RISES) if (this.zones.has(R.zone)) cand.push({ at: R.at, indoor: !!R.indoor });
    const P = this.player.pos, scored = [];
    for (const c of cand) {
      const n = nav.node(c.at[0], c.at[1], c.at[2], 1.0); if (n < 0) continue;
      const d = nav.dist[n], straight = Math.hypot(c.at[0] - P.x, c.at[2] - P.z);
      if (d === Infinity || straight < 3.5) continue;
      scored.push({ c, n, w: 1 / (1 + Math.max(0, d - 6) / 6) });
    }
    if (!scored.length) return null;
    let r = Math.random() * scored.reduce((a, s) => a + s.w, 0);
    for (const s of scored) { r -= s.w; if (r <= 0) return s; }
    return scored[0];
  }
  spawnOne() {
    const s = this.pickSpawn(); if (!s) return false;
    const [x, y, z] = this.nav.pos(s.n);
    const kind = this.oniRound ? 'oni' : 'gaki';
    const st = this.roundStats(this.round, kind);
    const k = this.horde.spawn(kind, x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, st, { look: Math.floor(Math.random() * GAKI_LOOKS), blue: Math.random() < 0.4, indoor: s.c.indoor });
    this.sfx.rise(k.pos, s.c.indoor);
    if (kind === 'oni') this.sfx.groan(k.pos, 'oni');
    this.toSpawn--;
    return true;
  }

  // ------------------------------------------------------------------ getting hurt
  hurt(k) {
    if (this.dead || this.downT > 0) return;
    const dmg = k.state === 'charge' ? k.dmg * 1.3 : k.dmg;
    this.hp -= dmg; this.hurtT = 0;
    this.sfx.hurt();
    const flash = this.hud.querySelector('.zm-hurt'); flash.classList.remove('hit'); void flash.offsetWidth; flash.classList.add('hit');
    // a blow knocks you back a step (an oni's sends you flying)
    const dx = this.player.pos.x - k.pos.x, dz = this.player.pos.z - k.pos.z, d = Math.hypot(dx, dz) || 1, push = k.state === 'charge' ? 9 : k.kind === 'oni' ? 5 : 1.6;
    this.player.vel.x += dx / d * push; this.player.vel.z += dz / d * push;
    this.shake = k.kind === 'oni' ? 0.6 : 0.25;
    if (this.hp > 0) return;
    if (this.perks.has('omamori')) { // as quick revive alone: you go down, and get back up, and lose every blessing
      this.downT = 3.2; this.hp = 1; this.player.frozen = true;
      this.perks.clear(); this.applyPerks();
      this.say('守 · the omamori holds', 2600); this.sub('you lose your blessings', 2600);
      document.body.classList.add('zm-down'); this.sfx.down();
      this.gore.fire(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z, 40, 3);
      return;
    }
    this.die();
  }
  die() {
    this.dead = true; this.player.dead = true; this.player.frozen = true; this.hp = 0;
    this.sfx.down(); document.body.classList.add('zm-dead');
    this.deadT = 0;
    setTimeout(() => this.showOver(), 2600);
  }
  showOver() {
    const el = document.getElementById('zm-over');
    const mins = Math.floor(this.time / 60), secs = Math.floor(this.time % 60);
    el.innerHTML = `<div class="card">
      <div class="ttl">百鬼夜行</div>
      <div class="sub">the night parade took you</div>
      <div class="rd"><b>${kanjiNum(this.round)}</b><span>round ${this.round}</span></div>
      <div class="stats">
        <div><b>${this.kills}</b><span>yōkai cut down</span></div>
        <div><b>${this.heads}</b><span>headshots &amp; beheadings</span></div>
        <div><b>${this.limbs}</b><span>limbs taken</span></div>
        <div><b>${pts(this.earned)}</b><span>points earned</span></div>
        <div><b>${mins}:${String(secs).padStart(2, '0')}</b><span>survived</span></div>
      </div>
      <div class="acts"><button class="pill-btn" data-act="again">rise again</button><button class="text-btn" data-act="title">back to the shop</button></div></div>`;
    el.classList.add('on');
    el.querySelector('[data-act="again"]').onclick = () => this.onAgain();
    el.querySelector('[data-act="title"]').onclick = () => this.onQuit();
    document.exitPointerLock?.();
  }

  // ------------------------------------------------------------------ gifts from the dead
  maybeDrop(k) {
    // the last oni of an oni night always leaves ammunition behind. Otherwise, as in Black Ops: each time your
    // points earned pass the next mark (2,000 more, then 14% further apart each time), the next kill drops a gift;
    // and now and then one falls by luck. No more than four a round.
    const lastOni = this.oniRound && this.toSpawn <= 0 && !this.horde.list.some((y) => y.alive);
    if (!this.dropAt) { this.dropStep = 2000; this.dropAt = 2000; }
    const due = this.earned >= this.dropAt;
    if (!lastOni && (this.dropsThisRound >= 4 || (!due && Math.random() > 0.02))) return;
    if (due) { this.dropStep *= 1.14; this.dropAt += this.dropStep; }
    const kinds = Object.keys(ZP.DROPS).filter((d) => d !== this.lastDrop);
    const kind = lastOni ? 'ammo' : kinds[Math.floor(Math.random() * kinds.length)];
    this.lastDrop = kind; this.dropsThisRound++;
    const grp = new THREE.Group(), m = ZP.dropModel(kind).mesh(this.mats.lit, this.mats.emit); grp.add(m);
    const h = ZP.halo(ZP.DROPS[kind].color); h.scale.set(1.6, 1.6, 1); grp.add(h);
    const hex = new THREE.Color(ZP.DROPS[kind].color.replace(/rgba\((\d+),(\d+),(\d+),[^)]*\)/, 'rgb($1,$2,$3)')).getHex();
    const beam = ZP.dropBeam(hex); grp.add(beam);
    grp.position.set(k.pos.x, k.pos.y + 0.9, k.pos.z); this.scene.add(grp);
    this.gore.fire(k.pos.x, k.pos.y + 0.9, k.pos.z, 24, 2.2);
    this.sfx.dropAppear && this.sfx.dropAppear(grp.position);
    this.drops.push({ kind, grp, m, beam, spark: hex, t: 0 });
  }
  takeDrop(d) {
    const D = ZP.DROPS[d.kind];
    this.say(D.name, 1800); this.sub(D.text, 2200); this.sfx.power(d.kind);
    // a flash of its colour over everything, and a burst of light where it was
    const fl = this.hud.querySelector('.zm-flash'); if (fl) { fl.style.setProperty('--c', D.color); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    const at = d.grp.position; for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3; this.gore.ember(at.x, at.y, at.z, Math.cos(a) * v, Math.random() * 3, Math.sin(a) * v, d.spark, 0.05, 0.9); }
    if (d.kind === 'double') this.timers.double = 30;
    if (d.kind === 'insta') this.timers.insta = 30;
    if (d.kind === 'nuke') { for (const k of this.horde.list) if (k.alive) { k.hurt({ dmg: 1e9, part: Math.random() < 0.3 ? 'head' : 'torso', blade: 0.6, dir: new THREE.Vector3(0, 0, 1) }); this.kills++; } this.earn(400); }
    if (d.kind === 'carpenter') { for (const b of this.barriers) while (b.boards < b.max) this.addBoard(b, true); this.sfx.board(false, this.player.pos); this.earn(200); }
    if (d.kind === 'ammo') { this.arsenal.refillAll(); while (this.arsenal.addThrowable(['plate', 'cup', 'tokkuri'][Math.floor(Math.random() * 3)])); }
  }

  // ------------------------------------------------------------------ the frame
  mouse(button, down) {
    if (button === 0) { this.fire = down; if (down && !this.dead) this.arsenal.attack(this.player); }
    if (button === 2 && down && !this.dead) this.arsenal.quickMelee();
  }
  key(code, down) {
    this.keys[code] = down;
    if (!down || this.dead) return;
    if (code === 'KeyE') this.interactions.click();
    if (code === 'KeyR') this.arsenal.reload();
    if (code === 'KeyQ') this.arsenal.throw(this.player);
    if (code === 'KeyG' && !this.arsenal.drinkT) { if (this.grenades.throw(this.camera)) { this.sfx.whoosh(0.8); this.arsenal.anim.throwT = 1; this.drawHud(); } else this.sub('no fire-pots left · two more next round', 1500); }
    if (code === 'KeyV' || code === 'KeyF') this.arsenal.quickMelee();
    if (code === 'Digit1') this.arsenal.swap(0);
    if (code === 'Digit2') this.arsenal.swap(1);
    if (code === 'Digit3') this.arsenal.swap(2);
  }
  wheel() { if (!this.dead) this.arsenal.swap(); }
  update(dt) {
    const p = this.player;
    this.time += dt;
    // rounds: a short breath between them, then the drums
    if (!this.dead) {
      if (this.breakT > 0) { if ((this.breakT -= dt) <= 0) this.nextRound(); }
      else {
        if (this.toSpawn > 0 && (this.spawnT -= dt) <= 0) {
          const alive = this.horde.list.filter((k) => k.alive).length;
          // one attempt per delay: the next rises if there's room (24 up at once), otherwise it waits its turn
          if (alive < MAX_ALIVE && this.spawnOne()) this.spawnT = this.oniRound ? 2.5 + Math.random() * 2.5 : spawnDelay(this.round);
          else this.spawnT = this.oniRound ? 0.5 : spawnDelay(this.round);
        }
        if (this.toSpawn <= 0 && !this.horde.list.some((k) => k.alive)) {
          this.breakT = BREAK; this.sfx.bell(); this.say(this.oniRound ? '鬼 · the oni are gone' : `round ${kanjiNum(this.round)} · survived`, 2600);
          document.body.classList.remove('zm-oni');
          this.sub(`catch your breath · ${BREAK} seconds · rebuild the boards (hold E at a window)`, 3500);
        }
        // groans in the dark
        if ((this.groanT = (this.groanT || 2) - dt) <= 0) {
          this.groanT = 1.2 + Math.random() * 2.5;
          const live = this.horde.list.filter((k) => k.alive); if (live.length) { const k = live[Math.floor(Math.random() * live.length)]; this.sfx.groan(k.pos, k.kind); }
        }
      }
    }
    this.horde.update(dt, this.player);
    this.gore.update(dt);
    this.grenades.update(dt);
    // you: holding fire keeps swinging, hold E to rebuild a window
    if (this.fire && !this.dead && this.arsenal.w.kind === 'melee') this.arsenal.attack(p);
    this.arsenal.update(dt, p, this.fire);
    this.arsenal.insta = this.timers.insta > 0;
    this.mul = this.timers.double > 0 ? 2 : 1;
    for (const k in this.timers) this.timers[k] = Math.max(0, this.timers[k] - dt);
    const hb = this.interactions.hover && this.barriers.find((b) => b.ix === this.interactions.hover);
    if (hb && this.keys.KeyE && !this.dead && hb.boards < hb.max && !(hb.climber && hb.climber.alive && hb.climber.state === 'climb')) {
      if ((this.repairT = (this.repairT || 0) + dt) > 0.75) {
        this.repairT = 0; this.addBoard(hb);
        if (this.repairPts < 500) { this.repairPts += 10; this.earn(10); }
      }
    } else this.repairT = 0;
    // down with the omamori: the yōkai are thrown back while you're on the floor; then you're up, whole
    if (this.downT > 0) {
      this.downT -= dt; p.nod = Math.min(0.7, p.nod + dt * 2);
      for (const y of this.horde.list) if (y.alive && y.pos.distanceTo(p.pos) < 2.5) { const ex = y.pos.x - p.pos.x, ez = y.pos.z - p.pos.z, e = Math.hypot(ex, ez) || 1; y.pos.x += ex / e * dt * 3; y.pos.z += ez / e * dt * 3; }
      if (this.downT <= 0) { this.hp = this.maxHp; p.frozen = false; p.nod = 0; document.body.classList.remove('zm-down'); this.sub('back on your feet', 1500); }
    }
    // health comes back if you stay out of reach a while
    this.hurtT += dt;
    if (!this.dead && this.hurtT > (this.regenDelay || 3) && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5 * (this.regenRate || 1) * dt);
    if (!this.dead && this.hp < this.maxHp * 0.35 && (this.beatT = (this.beatT || 0) - dt) <= 0) { this.beatT = 0.85; this.sfx.beat(); }
    // the dead fall
    if (this.dead) { this.deadT += dt; const k = Math.min(1, this.deadT / 1.2); p.nod = k * 0.9; p.pitch = THREE.MathUtils.lerp(p.pitch, 0.6, dt * 2); }
    // a blow shakes the view
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.5); this.camera.rotation.z += (Math.random() - 0.5) * this.shake * 0.08; this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.04; }
    // gifts: spin, bob, blink before they go; walk into one to take it
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt;
      d.m.rotation.y += dt * 2; d.grp.position.y += Math.sin(d.t * 3) * 0.002;
      if (d.beam) { d.beam.userData.ring.rotation.z += dt * 2.5; d.beam.userData.ring.scale.setScalar(1 + Math.sin(d.t * 4) * 0.12); }
      if (Math.random() < dt * 14) this.gore.ember(d.grp.position.x + (Math.random() - 0.5) * 0.6, d.grp.position.y - 0.7, d.grp.position.z + (Math.random() - 0.5) * 0.6, 0, 1.4 + Math.random(), 0, d.spark, 0.035, 1.2);
      d.grp.visible = d.t < 20 || Math.floor(d.t * 6) % 2 === 0;
      if (Math.hypot(p.pos.x - d.grp.position.x, p.pos.z - d.grp.position.z) < 0.9 && Math.abs(p.pos.y + 0.9 - d.grp.position.y) < 1.2 && !this.dead) { this.takeDrop(d); this.scene.remove(d.grp); this.drops.splice(i, 1); continue; }
      if (d.t > 25) { this.scene.remove(d.grp); this.drops.splice(i, 1); }
    }
    // the machines' faces breathe; now and then one plays its tune, if you're near enough to hear
    for (const m of this.perkMachines) {
      if (!m.lit) { m.face.material.color.setScalar(0.12 + (this.power && Math.random() < 0.2 ? 0.5 : 0)); continue; }
      m.face.material.color.setScalar(1.1 + Math.sin(this.time * 2.2 + m.tuneT) * 0.18);
      if ((m.tuneT -= dt) <= 0) { m.tuneT = 40 + Math.random() * 50; if (m.grp.position.distanceTo(p.pos) < 14) this.sfx.jingle(m.P.id, m.grp.position); }
    }
    // wall buys glow a little brighter as you come near
    for (const b of this.buys) {
      const near = Math.max(0, 1 - b.grp.position.distanceTo(p.pos) / 6), pulse = 0.5 + Math.sin(this.time * 3 + b.at[0]) * 0.5;
      b.chalk.material.color.setScalar(1.15 + near * 0.45 + pulse * 0.15);
      b.glow.material.opacity = 0.5 + near * 0.3 + pulse * 0.2;
      b.tag.position.y = 0.62 + Math.sin(this.time * 2 + b.at[2]) * 0.03; b.tag.material.opacity = 0.75 + near * 0.25;
    }
    // the breaker's lever swings down, once
    if (this.power && this.powerBox) this.powerBox.pivot.rotation.x += (0.9 - this.powerBox.pivot.rotation.x) * Math.min(1, dt * 10);
    this.updateBox(dt);
    // the lamps gutter now and then
    for (const l of this.lamps) { if (Math.random() < dt * 0.6) l.flick = 0.15 + Math.random() * 0.25; l.flick = Math.max(0, (l.flick || 0) - dt); l.mul = (l.base ?? 1) * (this.oniRound && this.breakT <= 0 ? 0.55 : 1) * (this.power ? 1 : 0.55) * (l.flick > 0 ? 0.25 + Math.random() * 0.5 : 0.85 + Math.random() * 0.06); }
    this.sfx.listener = { x: p.pos.x, y: p.pos.y + 1.5, z: p.pos.z, yaw: p.yaw };
    this.vLight();
    if ((this.hudT = (this.hudT || 0) - dt) <= 0) { this.hudT = 0.1; this.drawHud(); }
  }
  // the first-person light follows how dark it is where you stand
  vLight() {
    const inside = this.player.pos.x > 0 && this.player.pos.x < 16 && this.player.pos.z > -3.4 && this.player.pos.z < 16;
    const A = this.arsenal; A.vLight.intensity = inside ? 2.1 : 1.0; A.vKey.intensity = inside ? 1.4 : 0.6;
  }

  // ------------------------------------------------------------------ the HUD
  say(text, ms = 2000) { const el = this.hud.querySelector('.zm-msg'); el.textContent = text; el.classList.add('show'); clearTimeout(this._sayT); this._sayT = setTimeout(() => el.classList.remove('show'), ms); }
  sub(text, ms = 2000) { const el = this.hud.querySelector('.zm-sub'); el.textContent = text; el.classList.add('show'); clearTimeout(this._subT); this._subT = setTimeout(() => el.classList.remove('show'), ms); }
  drawHud(force) {
    const H = this.hud, A = this.arsenal, s = A.slot, w = A.w;
    const set = (sel, html) => { const el = H.querySelector(sel); if (force || el._h !== html) { el.innerHTML = html; el._h = html; } };
    set('.zm-round', this.round ? (this.round <= 5 ? tally(this.round) : `<b>${kanjiNum(this.round)}</b>`) : '');
    set('.zm-points', pts(this.points));
    const ammo = s && w.kind === 'gun' ? `<span class="ammo${s.mag === 0 ? ' out' : ''}">${s.mag}<i>/ ${s.reserve}</i></span>` : '';
    const other = A.slots.map((x, i) => (x && i !== A.cur ? WEAPONS[x.id].name.toLowerCase() : null)).filter(Boolean);
    set('.zm-weapon', `<b>${w.name.toLowerCase()}</b>${ammo}${other.length ? `<em>${other.join(' · ')} · 1/2${A.slots.length > 2 ? '/3' : ''}</em>` : ''}${A.reloading > 0 ? '<em class="rl">reloading…</em>' : ''}`);
    set('.zm-throw', A.throwables.map((t) => `<i class="t-${t}"></i>`).join('') + (A.throwables.length ? '<span>Q</span>' : '')
      + `<b class="pots">${'<i class="t-pot"></i>'.repeat(this.grenades.left)}${'<i class="t-pot gone"></i>'.repeat(MAX_GRENADES - this.grenades.left)}<span>G</span></b>`);
    set('.zm-perks', [...this.perks].map((id) => { const P = PERKS.find((q) => q.id === id); return `<i style="--c:${P.color}" title="${P.name}">${P.kanji}</i>`; }).join(''));
    set('.zm-timers', (this.round && this.breakT > 0 && !this.dead ? `<span class="next">next round in ${Math.ceil(this.breakT)}</span>` : '')
      + Object.entries(this.timers).filter(([, v]) => v > 0).map(([k, v]) => `<span>${k === 'double' ? '招 double points' : '般 one blow kills'} · ${Math.ceil(v)}</span>`).join(''));
    const hurt = H.querySelector('.zm-hurt'), lv = 1 - this.hp / this.maxHp;
    hurt.style.opacity = this.dead ? 1 : Math.max(0, lv * 1.1 - 0.15).toFixed(2);
  }
  pauseText() { return this.round ? `round ${this.round} · ${pts(this.points)} points` : 'the parade is coming'; }
}
