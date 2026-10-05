// Working the night: take orders, pour tea and make food, serve, ring up, bus and wash dishes, restock.
// (Internally a cup is still a 'mug', so co-op snapshots keep their shape.)
import * as THREE from 'three';
import { Model, C } from './voxel.js';
import { Belt } from './belt.js';

export const MENU = {
  tea: { name: 'Green tea', price: 300 },
  sushi: { name: 'Salmon nigiri', price: 600 },
  yakitori: { name: 'Yakitori', price: 800 },
  gyoza: { name: 'Gyoza', price: 700 },
  onigiri: { name: 'Onigiri', price: 350 },    // these three are bought from the catalog
  tempura: { name: 'Tempura', price: 900 },
  ramen: { name: 'Miso ramen', price: 1100 },
};
// how often each dish is ordered, when it's on the menu
const FOOD_WEIGHT = { yakitori: 0.3, sushi: 0.22, gyoza: 0.2, onigiri: 0.16, tempura: 0.16, ramen: 0.18 };
const NAMES = ['a tired salaryman', 'the ski instructor', 'two snowboarders', 'a night-shift nurse', 'the old fisherman', 'a ferry deckhand',
  'an onsen tourist', 'the snowplow driver', 'a poet in a long scarf', 'a nervous first date', 'the shrine caretaker', 'a student up late cramming',
  'the mountain hut keeper', 'a long-haul trucker', 'the baker from the village', 'an off-duty taxi driver'];
const yen = (v) => `¥${Math.round(v).toLocaleString('en-US')}`;

// ---------------------------------------------------------------- little voxel models for dishes
const INVISIBLE = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

// counter tops you can set things on: [x0, x1, z0, z1, top y]. Spots near props on the counters are kept clear.
const COUNTERS = [
  [3.8, 11.7, 6.32, 6.7, 1.125],     // the kaiten counter, your side of the belt
  [11.8, 12.17, 6.8, 9.6, 1.125],    // ...and its east leg
  [3.8, 9.95, 9.15, 9.5, 1.0],       // the back bar, in front of the urns and plates
  [14.3, 15.7, -1.7, -1.05, 1.0],    // the register counter in the genkan
  [7.1, 11.9, 12.3, 13.05, 0.875],   // kitchen prep island
];
const KEEP_CLEAR = [[4.3, 9.75, 0.25], [5.0, 9.75, 0.25], [6.3, 9.65, 0.6], [7.95, 9.7, 0.35], [9.5, 9.7, 0.22],
  [15.0, -1.35, 0.3], [15.55, -1.45, 0.2], [14.5, -1.35, 0.2], [9.5, 12.65, 0.45]];

const W = C('#f2efe8', 0, 0.03), rim = C('#2a4a7a', 0, 0.04), teaC = C('#8ab840', 0, 0.05), ring = C('#6a7a4a', 0, 0.06);
const glaze = C('#6d7a5a', 0, 0.05), glazeL = C('#a8b08a', 0, 0.05);
// yunomi: a tall handle-less tea cup
function mugModel(state) {
  const m = new Model(5, 5, 5, 1 / 32, [2.5, 0, 2.5]);
  m.cyl(2.5, 2.5, 2.0, 0, 5, (x, y) => (y === 4 ? glazeL : glaze), state === 'empty' || state === 'dirty' ? 1.1 : -1);
  m.cyl(2.5, 2.5, 2.0, 0, 1, glaze);
  if (state === 'coffee') m.cyl(2.5, 2.5, 1.2, 4, 5, teaC);
  if (state === 'dirty') m.cyl(2.5, 2.5, 1.2, 1, 2, ring);
  return m;
}
function plateModel(food) {
  const m = new Model(10, 7, 10, 1 / 32, [5, 0, 5]);
  m.cyl(5, 5, 4.6, 0, 1, (x, y, z) => (Math.hypot(x + 0.5 - 5, z + 0.5 - 5) > 3.8 ? rim : W));
  if (food === 'sushi') {
    const rice = C('#fbf8ee', 0, 0.02), salmon = C('#f08a4a', 0, 0.04), stripe = C('#fbd2b0', 0, 0.03);
    for (const z0 of [2, 5]) { m.box(2, 1, z0, 7, 3, z0 + 2, rice); m.box(2, 3, z0, 8, 4, z0 + 2, (x) => (x % 2 ? stripe : salmon)); }
    m.box(7, 1, 7, 9, 2, 9, C('#f2b8b0', 0, 0.04)); m.set(8, 1, 2, C('#8ab84a', 0, 0.04));
  }
  if (food === 'yakitori') {
    for (const z of [3, 5, 7]) { m.box(1, 1, z, 9, 2, z + 1, C('#c8b070', 0, 0.04)); for (const x of [2, 4, 6]) m.box(x, 1, z, x + 2, 3, z + 1, x === 4 ? C('#e8f0d0', 0, 0.04) : C('#7a3a18', 0, 0.08)); }
  }
  if (food === 'gyoza') {
    for (let i = 0; i < 5; i++) { const x = 2 + i * 1.3 | 0; m.box(x, 1, 3, x + 1, 3, 7, (vx, y) => (y === 1 ? C('#c8862a', 0, 0.05) : C('#f0e6d0', 0, 0.04))); }
    m.cyl(8, 8, 1.2, 1, 2, C('#2a140a', 0, 0.03));
  }
  if (food === 'onigiri') {
    for (const x0 of [2, 6]) { m.box(x0, 1, 3, x0 + 3, 4, 7, (x, y) => (y < 3 ? C('#fbf8ee', 0, 0.02) : C('#fbf8ee', 0, 0.02))); m.box(x0, 1, 3, x0 + 3, 3, 4, C('#1b2a1a', 0, 0.05)); m.set(x0 + 1, 4, 5, C('#fbf8ee', 0, 0.02)); }
    m.set(5, 2, 7, C('#f08a4a', 0, 0.04));
  }
  if (food === 'tempura') {
    const batter = (x, y, z) => ((x + y + z) & 1 ? C('#e8b850', 0, 0.08) : C('#f0cc70', 0, 0.08));
    for (const [x, z] of [[2, 3], [4, 6], [6, 3]]) m.box(x, 1, z, x + 3, 3, z + 2, batter);
    m.set(8, 2, 4, C('#f08a5a', 0, 0.04)); m.set(8, 2, 7, C('#f08a5a', 0, 0.04)); m.box(7, 1, 7, 9, 2, 9, C('#e8f0e0', 0, 0.04));
  }
  if (food === 'ramen') {
    m.cyl(5, 5, 4.3, 1, 5, (x, y, z) => (Math.hypot(x + 0.5 - 5, z + 0.5 - 5) > 3.3 ? (y === 4 ? C('#2a2a2a', 0, 0.03) : C('#8a2a20', 0, 0.04)) : null));
    m.cyl(5, 5, 3.4, 4, 5, C('#c8883a', 0, 0.05));                                    // broth
    m.box(3, 5, 3, 5, 6, 5, C('#f0e8d8', 0, 0.03)); m.set(3, 5, 4, C('#f2c840', 0, 0.04)); // egg
    m.box(5, 5, 5, 7, 6, 7, C('#d89a8a', 0, 0.05)); m.set(6, 5, 3, C('#3a8a3a', 0, 0.06)); m.set(4, 5, 6, C('#1b2a1a', 0, 0.05));
  }
  if (food === 'dirty') { m.set(4, 1, 4, C('#8a5a2a', 0, 0.1)); m.set(6, 1, 5, C('#6a3a1a', 0, 0.1)); m.set(5, 1, 6, C('#a8703a', 0, 0.1)); m.set(3, 1, 6, C('#c8b070', 0, 0.1)); }
  return m;
}
function tubModel(mugs, plates, clean) {
  const m = new Model(14, 8, 10, 1 / 32, [7, 0, 5]);
  if (!clean) { m.box(0, 0, 0, 14, 6, 10, C('#4a4e54', 0, 0.04)); m.box(1, 1, 1, 13, 6, 9, null); for (let x = 1; x < 13; x++) for (let z = 1; z < 9; z++) for (let y = 1; y < 6; y++) m.set(x, y, z, 0); }
  const n = Math.min(4, plates);
  for (let i = 0; i < n; i++) m.cyl(5, 5, 3.8, 1 + i, 2 + i, (x, y) => (clean ? W : (y & 1 ? W : C('#d8d0c0', 0, 0.05))));
  for (let i = 0; i < Math.min(3, mugs); i++) m.cyl(11, 2.5 + i * 2.6, 1.2, 1, 5, glaze);
  return m;
}

// little food icons, drawn on canvas: shared by the orders slip (as <img>) and the speech bubbles
const ICON_CACHE = {};
export const ICON_SRC = (kind) => {
  if (!ICON_CACHE[kind]) { const cv = document.createElement('canvas'); cv.width = cv.height = 72; const g = cv.getContext('2d'); g.translate(36, 36); drawIcon(g, kind); ICON_CACHE[kind] = cv.toDataURL(); }
  return ICON_CACHE[kind];
};

// one icon (an order item, or ! / ¥) drawn centered at the origin, about 64px across
function drawIcon(g, ic) {
  if (ic === '!' || ic === '¥' || ic === '…' || ic === '?') {
    g.fillStyle = ic === '¥' ? '#2a7a3a' : ic === '!' ? '#c8302a' : '#5a4a40'; g.font = '600 64px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, 0, 4);
  } else if (ic === 'tea') {
    g.fillStyle = '#6d7a5a'; g.strokeStyle = '#2a2a1a'; g.lineWidth = 4; g.beginPath(); g.roundRect(-17, -16, 34, 38, 6); g.fill(); g.stroke();
    g.fillStyle = '#a8cf62'; g.fillRect(-14, -13, 28, 6); g.fillStyle = '#a8b08a'; g.fillRect(-14, -4, 28, 4);
    g.strokeStyle = '#9a9a90'; g.lineWidth = 3; g.beginPath(); g.moveTo(-4, -20); g.quadraticCurveTo(2, -28, -2, -36); g.stroke();
  } else if (ic === 'sushi') {
    g.fillStyle = '#fbf8ee'; g.strokeStyle = '#3a2a20'; g.lineWidth = 4; g.beginPath(); g.roundRect(-26, -2, 52, 20, 9); g.fill(); g.stroke();
    g.fillStyle = '#f08a4a'; g.beginPath(); g.roundRect(-28, -14, 56, 16, 7); g.fill(); g.stroke();
    g.strokeStyle = '#fbd2b0'; g.lineWidth = 3; for (const x of [-14, 0, 14]) { g.beginPath(); g.moveTo(x - 4, -12); g.lineTo(x + 4, 0); g.stroke(); }
  } else if (ic === 'yakitori') {
    g.strokeStyle = '#c8b070'; g.lineWidth = 4; g.beginPath(); g.moveTo(-30, 26); g.lineTo(26, -28); g.stroke();
    [[-14, 10, '#7a3a18'], [0, -4, '#e8f0d0'], [14, -18, '#7a3a18']].forEach(([x, y, c]) => { g.fillStyle = c; g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.beginPath(); g.roundRect(x - 9, y - 8, 18, 16, 5); g.fill(); g.stroke(); });
  } else if (ic === 'gyoza') {
    for (const dx of [-16, 0, 16]) {
      g.fillStyle = '#f0e6d0'; g.strokeStyle = '#3a2a20'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(dx, 4, 9, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#c8862a'; g.beginPath(); g.ellipse(dx, 14, 7, 6, 0, 0, Math.PI); g.fill();
    }
  } else if (ic === 'onigiri') {
    g.fillStyle = '#fbf8ee'; g.strokeStyle = '#3a2a20'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(30, 20, 22, 22); g.lineTo(-22, 22); g.quadraticCurveTo(-30, 20, 0, -26); g.fill(); g.stroke();
    g.fillStyle = '#1b2a1a'; g.fillRect(-11, 4, 22, 18);
  } else if (ic === 'tempura') {
    for (const [x, y, r] of [[-12, 6, -0.5], [10, -2, 0.4]]) {
      g.save(); g.translate(x, y); g.rotate(r);
      g.fillStyle = '#f0c060'; g.strokeStyle = '#3a2a20'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 11, 24, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#f08a5a'; g.beginPath(); g.moveTo(-6, -22); g.lineTo(0, -32); g.lineTo(6, -22); g.fill();
      g.restore();
    }
  } else if (ic === 'ramen') {
    g.fillStyle = '#8a2a20'; g.strokeStyle = '#2a1a10'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-30, -4); g.lineTo(30, -4); g.quadraticCurveTo(26, 26, 0, 26); g.quadraticCurveTo(-26, 26, -30, -4); g.fill(); g.stroke();
    g.fillStyle = '#e8b060'; g.beginPath(); g.ellipse(0, -4, 30, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c840'; g.beginPath(); g.arc(-8, -5, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a3020'; g.lineWidth = 3; for (const dx of [6, 12]) { g.beginPath(); g.moveTo(dx, -6); g.lineTo(dx + 14, -34); g.stroke(); }
  }
}
// speech-bubble icon textures
const bubbleCache = new Map();
function bubbleTex(key) {
  if (bubbleCache.has(key)) return bubbleCache.get(key);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  const icons = key.split(',');
  const w = 64 + icons.length * 70;
  const x0 = (256 - w) / 2;
  g.fillStyle = 'rgba(250,244,232,0.95)'; g.strokeStyle = 'rgba(60,40,30,0.9)'; g.lineWidth = 5;
  g.beginPath(); g.roundRect(x0, 8, w, 90, 26); g.moveTo(118, 96); g.lineTo(128, 120); g.lineTo(140, 96); g.fill(); g.stroke();
  icons.forEach((ic, i) => {
    const cx = x0 + 32 + 35 + i * 70, cy = 53;
    g.save(); g.translate(cx, cy);
    drawIcon(g, ic);
    g.restore();
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  bubbleCache.set(key, t);
  return t;
}
function tagSprite() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.8, 0.2, 1); sp.renderOrder = 20;
  sp.userData.draw = (text, frac, color) => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 256, 64);
    if (!text) { sp.visible = false; return; }
    sp.visible = true;
    g.fillStyle = 'rgba(48,28,18,0.86)'; g.beginPath(); g.roundRect(4, 4, 248, 56, 28); g.fill();
    g.strokeStyle = 'rgba(255,220,170,0.22)'; g.lineWidth = 2; g.stroke();
    if (frac !== null) {
      g.fillStyle = 'rgba(255,236,210,0.14)'; g.beginPath(); g.roundRect(22, 44, 212, 8, 4); g.fill();
      g.fillStyle = color; g.beginPath(); g.roundRect(22, 44, Math.max(8, 212 * Math.min(1, frac)), 8, 4); g.fill();
    }
    g.fillStyle = '#fbefdc'; g.font = '500 24px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(text.toLowerCase(), 128, frac !== null ? 34 : 40);
    tex.needsUpdate = true;
  };
  return sp;
}

// ---------------------------------------------------------------- the shift
export class Service {
  constructor(o) {
    Object.assign(this, o); // scene, camera, crowd, audio, interactions, toast, litMat, emitMat, ui, player
    this.money = 0; this.tips = 0; this.served = 0; this.walkouts = 0; this.washed = 0; this.burnt = 0;
    // unlocks (see shift.js)
    this.handCap = 1;      // how many things you can carry at once
    this.washTime = 1.2;   // seconds per dish at the sink
    this.patience = 1;     // multiplier on how long customers wait
    this.stockMax = 6; this.stock = { mugs: 6, plates: 6 };
    this.patienceBonus = 1; this.menuKinds = new Set(['tea', 'sushi', 'yakitori', 'gyoza']); this.owned = [];
    this.sink = { mugs: 0, plates: 0 };
    this.rack = { mugs: 0, plates: 0 };
    this.washing = 0; this.washTotal = 0; this.washDone = 0; this.washer = null;
    // everyone has their own hands. Actions run "as" a player: this.hands points at that player's hands
    // while it runs, and at yours the rest of the time (for labels and what you see you're holding).
    this.me = 'local'; this.handsBy = { local: [] }; this.hands = this.handsBy.local; this.actor = this.me;
    this.role = 'solo'; this.net = null; // co-op: 'host' runs the shop, 'guest' mirrors it
    this.posOf = () => this.player.pos;   // where a player is (co-op swaps this in)
    this.counterItems = []; // things set down on a counter
    this.nextItemId = 1;
    this.queue = [];
    this.queueSpots = [[15.0, -2.3], [15.3, -2.85], [14.45, -2.75]];
    this.register = { x: 15.0, z: -1.35 };
    this.nameIdx = Math.floor(Math.random() * NAMES.length); // who walks in first changes every night
    this.models = {};
    this.heldLit = this.litMat.clone(); this.heldLit.depthTest = false;
    this.heldEmit = this.emitMat.clone(); this.heldEmit.depthTest = false;
    this.held = new THREE.Group(); this.camera.add(this.held);
    this.setupStations();
    this.belt = new Belt(this.scene, (type) => this.dishModel(type).mesh(this.litMat, this.emitMat));
    this.A = this.actions();
    this.setupInteractions();
    this.crowd.onSeated = (q) => this.seated(q);
    this.refreshUI(true);
  }
  model(key, build) { return this.models[key] || (this.models[key] = build()); }
  heldModel(h) { return h.type === 'tub' || h.type === 'clean' ? tubModel(h.mugs, h.plates, h.type === 'clean') : this.dishModel(h.type); }
  dishModel(type) {
    if (type === 'tea' || type === 'mug' || type === 'mugDirty') return this.model(type, () => mugModel(type === 'tea' ? 'coffee' : type === 'mug' ? 'empty' : 'dirty'));
    return this.model(type, () => plateModel(type === 'plate' ? null : type === 'plateDirty' ? 'dirty' : type));
  }

  // ------------------------------------------------ who did it, and who hears about it
  say(text, to = this.actor) { if (to === this.me) this.toast(text); else if (this.net) this.net.sendTo(to, { t: 'toast', text }); }
  sayAll(text) { this.toast(text); if (this.role === 'host') this.net.send({ t: 'toast', text }); }
  pop(text, to = this.actor) { if (to === this.me) { if (this.onPop) this.onPop(text); } else if (this.net) this.net.sendTo(to, { t: 'pop', text }); }
  sfx(name, to = this.actor) { if (to === this.me) this.audio[name](); else if (this.net) this.net.sendTo(to, { t: 'sfx', name }); }
  sfxAll(name) { this.audio[name](); if (this.role === 'host') this.net.send({ t: 'sfx', name }); }
  // you clicked something: do it here, or ask the host to
  request(name, ...args) {
    if (this.role === 'guest') return this.net.sendHost({ t: 'act', name, args });
    this.runAs(this.me, name, args);
  }
  runAs(pid, name, args) {
    const fn = this.A[name]; if (!fn) return;
    const prevHands = this.hands, prevActor = this.actor;
    this.actor = pid; this.hands = this.handsBy[pid] ||= [];
    try { fn(...args); } finally { this.actor = prevActor; this.hands = prevHands; }
    this.redrawHands();
  }

  // ------------------------------------------------ customers
  seated(q) {
    q.svc = { phase: 'menu', t: 4 + Math.random() * 6, wait: 0, items: [], name: NAMES[this.nameIdx++ % NAMES.length] };
    q.svc.orderWait = 0; q.svc.foodWait = 0;
    this.addBubble(q);
  }
  addBubble(q) {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex('!'), transparent: true, depthWrite: false }));
    b.scale.set(0.42, 0.21, 1); b.renderOrder = 21; b.visible = false;
    q.person.group.add(b); q.svc.bubble = b;
  }
  makeOrder() {
    const r = Math.random(), items = [];
    if (r < 0.75) items.push('tea');
    // most guests eat something; what, depends on what's on the menu (the catalog adds dishes)
    const foods = Object.keys(FOOD_WEIGHT).filter((k) => this.menuKinds.has(k));
    if (Math.random() < 0.72) {
      let x = Math.random() * foods.reduce((a, k) => a + FOOD_WEIGHT[k], 0);
      for (const k of foods) { x -= FOOD_WEIGHT[k]; if (x <= 0) { items.push(k); break; } }
    }
    if (!items.length) items.push('tea');
    return items.map((kind) => ({ kind, done: false }));
  }
  bubbleKey(q) {
    const s = q.svc;
    if (s.phase === 'order') return '!';
    if (s.phase === 'food') return s.items.filter((i) => !i.done).map((i) => i.kind).join(',');
    if (s.phase === 'pay') return '¥';
    return null;
  }
  seatLabel(seat) {
    if (seat.kind === 'stool') return 'the counter';
    if (seat.kind === 'booth') return seat.z < 0 ? 'a booth by the window' : 'a booth at the belt';
    return 'a table';
  }

  // set a dish on the customer's table
  spot(seat, idx) {
    const fx = -Math.sin(seat.yaw), fz = -Math.cos(seat.yaw);
    const sx = -fz, sz = fx, side = (idx - 0.5) * 0.18;
    const surf = seat.surf ?? 1.0, reach = seat.reach ?? 0.42;
    return [seat.x + fx * reach + sx * side, surf, seat.z + fz * reach + sz * side];
  }
  dishGroup(seat) {
    if (!seat.dishGroup) { seat.dishGroup = new THREE.Group(); this.scene.add(seat.dishGroup); }
    return seat.dishGroup;
  }
  place(seat, type) {
    seat.dishes = seat.dishes || [];
    const [x, y, z] = this.spot(seat, seat.dishes.length % 2);
    const mesh = this.dishModel(type).mesh(this.litMat, this.emitMat);
    mesh.position.set(x, y + 0.002, z); mesh.rotation.y = seat.yaw;
    this.dishGroup(seat).add(mesh);
    seat.dishes.push({ type, mesh });
  }
  dirtyDishes(seat) {
    const grp = this.dishGroup(seat);
    for (const d of seat.dishes || []) {
      const dirty = d.type === 'tea' || d.type === 'mug' ? 'mugDirty' : 'plateDirty';
      grp.remove(d.mesh);
      d.type = dirty; d.mesh = this.dishModel(dirty).mesh(this.litMat, this.emitMat);
      const [x, y, z] = this.spot(seat, seat.dishes.indexOf(d) % 2);
      d.mesh.position.set(x, y + 0.002, z); d.mesh.rotation.y = seat.yaw; grp.add(d.mesh);
    }
    seat.needsBus = (seat.dishes || []).length > 0;
  }

  update(dt) {
    const sim = this.role !== 'guest'; // guests just show what the host sends
    for (const q of [...this.crowd.people]) {
      const s = q.svc; if (!s) continue;
      if (!sim) {}
      else if (s.phase === 'menu' && q.state === 'sit') { s.t -= dt; if (s.t < 0) { s.phase = 'order'; this.sfxAll('clickSound'); } }
      else if (s.phase === 'order') { s.orderWait += dt; if (s.orderWait > 150 * this.patience * this.patienceBonus) this.giveUp(q); }
      else if (s.phase === 'food') { s.foodWait += dt; if (s.foodWait > 300 * this.patience * this.patienceBonus) this.giveUp(q); }
      else if (s.phase === 'eat') { s.t -= dt; if (s.t < 0) this.doneEating(q); }
      const key = this.bubbleKey(q), b = s.bubble;
      if (b) {
        b.visible = !!key;
        if (key && b.userData.key !== key) { b.material.map = bubbleTex(key); b.material.needsUpdate = true; b.userData.key = key; b.scale.set(0.24 + key.split(',').length * 0.13, 0.21, 1); }
        b.position.y = q.state === 'sit' || q.state === 'sitting' ? (q.seat ? q.seat.y - q.pos.y : 0.5) + 1.0 : 2.0;
        if (key === '!' || key === '¥') b.position.y += Math.sin(performance.now() / 260) * 0.03;
      }
    }
    // the sushi belt: any guest whose seat it passes lifts off what they're waiting for
    this.belt.update(dt);
    if (sim) for (const p of [...this.belt.plates]) {
      if (!p.seg || p.seg === 'kitchen') continue;
      const q = this.crowd.people.find((c) => c.svc && c.svc.phase === 'food' && c.state === 'sit' && c.seat && this.beltS(c.seat) !== null &&
        this.belt.gap(this.beltS(c.seat), p.s) < 0.2 && c.svc.items.some((i) => !i.done && i.kind === p.type));
      if (!q) continue;
      this.belt.remove(p);
      this.serveItem(q, q.svc.items.find((i) => !i.done && i.kind === p.type));
      this.beltServed = (this.beltServed || 0) + 1;
      this.sfxAll('clickSound');
    }
    // cooking
    for (const st of this.stations) {
      if (!sim) {}
      else if (st.state === 'cooking') { st.t += dt; if (st.t >= st.cook) { st.state = 'ready'; st.t = 0; this.sfxAll('clickSound'); } }
      else if (st.state === 'ready') { st.t += dt; if (st.t > st.burn) { st.state = 'burnt'; this.burnt++; this.sayAll(`the ${st.label.toLowerCase()} burned`); } }
      st.redraw -= dt;
      if (st.redraw <= 0) {
        st.redraw = 0.2;
        if (st.state === 'idle') st.tag.userData.draw('');
        else if (st.state === 'cooking') st.tag.userData.draw(`${st.label} cooking`, st.t / st.cook, '#f0b45a');
        else if (st.state === 'ready') st.tag.userData.draw(`${st.label} ready!`, 1 - st.t / st.burn, '#a8e0a8');
        else st.tag.userData.draw('burnt :(', null);
      }
    }
    // washing happens while you stay at the sink
    if (sim && this.washing > 0) {
      const p = this.posOf(this.washer) || this.player.pos;
      if (Math.hypot(p.x - 5.6, p.z - 12.3) > 1.8) { this.washing = 0; this.washShow = 0; this.say('stopped washing — stay at the sink', this.washer); }
      else {
        this.washT = (this.washT || 0) + dt;
        if (this.washT > this.washTime) {
          this.washT = 0;
          if (this.sink.mugs > 0) { this.sink.mugs--; this.rack.mugs++; } else if (this.sink.plates > 0) { this.sink.plates--; this.rack.plates++; }
          this.washing--; this.washDone++; this.washed++;
          if (this.sink.mugs + this.sink.plates === 0 || this.washing <= 0) { this.washing = 0; this.washShow = 2.5; this.sfx('clickSound', this.washer); this.say('all clean — they\'re on the rack', this.washer); }
          this.refreshUI();
        }
      }
    }
    this.setWater(this.washing > 0);
    this.washShow = Math.max(0, (this.washShow || 0) - dt);
    this.washRedraw = (this.washRedraw || 0) - dt;
    if (this.washRedraw <= 0) {
      this.washRedraw = 0.1;
      if (this.washing > 0) this.washTag.userData.draw(`Washing ${this.washDone + 1}/${this.washTotal}`, (this.washDone + this.washT / this.washTime) / this.washTotal, '#9cc8e8');
      else if (this.washShow > 0) this.washTag.userData.draw('All clean!', 1, '#a8e0a8');
      else this.washTag.userData.draw('');
    }
    this.uiT = (this.uiT || 0) - dt;
    if (this.uiT < 0) { this.uiT = 0.25; this.refreshUI(); }
  }
  giveUp(q) {
    this.walkouts++;
    this.sayAll(`${q.svc.name} gave up waiting and left`);
    q.svc.phase = 'gone';
    if (q.seat) this.dirtyDishes(q.seat);
    this.crowd.rise(q);
  }
  doneEating(q) {
    q.svc.phase = 'walkpay';
    const seat = q.seat;
    this.dirtyDishes(seat);
    this.crowd.rise(q, () => this.joinQueue(q));
  }
  joinQueue(q) {
    this.queue.push(q);
    this.layoutQueue();
  }
  layoutQueue() {
    this.queue.forEach((q, i) => {
      const [x, z] = this.queueSpots[Math.min(i, this.queueSpots.length - 1)];
      const yaw = Math.atan2(-(this.register.x - x), -(this.register.z - z));
      if (q.svc.queueIdx !== i) {
        q.svc.queueIdx = i;
        this.crowd.goTo(q, x, z, yaw, () => { if (q.svc.phase === 'walkpay') q.svc.phase = 'pay'; });
      }
    });
  }
  bill(q) {
    const food = q.svc.items.filter((i) => i.done).reduce((a, i) => a + MENU[i.kind].price, 0);
    const sub = food + (food > 0 ? this.drinkBill || 0 : 0); // a drink from the fridge (and warm sake) with the meal
    const mood = Math.max(0.05, 0.25 - 0.1 * (q.svc.orderWait / 60) - 0.05 * (q.svc.foodWait / 90));
    return { sub, tip: Math.round(sub * mood / 10) * 10 };
  }

  // ------------------------------------------------ hands
  // the first thing goes in your right hand; with both hands unlocked the next one goes in your left
  get handsFree() { return this.handCap - this.hands.length - (this.hands.some((h) => h.type === 'tub' || h.type === 'clean') ? 1 : 0); }
  hold(item) {
    item.slot = item.type === 'tub' || item.type === 'clean' ? 'both' : this.hands.some((h) => h.slot === 'R') ? 'L' : 'R';
    this.hands.push(item); this.redrawHands();
  }
  takeHand(type) { const i = this.hands.findIndex((h) => h.type === type); if (i < 0) return null; const h = this.hands.splice(i, 1)[0]; this.redrawHands(); return h; }
  has(type) { return this.hands.some((h) => h.type === type); }
  redrawHands() {
    while (this.held.children.length) this.held.remove(this.held.children[0]);
    (this.handsBy[this.me] || []).forEach((h) => {
      const g = this.heldModel(h).mesh(this.heldLit, this.heldEmit);
      g.traverse((o) => { o.renderOrder = 30; });
      g.position.set(h.slot === 'both' ? 0 : h.slot === 'L' ? -0.17 : 0.17, -0.2, -0.5);
      g.rotation.x = 0.45; g.scale.setScalar(0.55);
      this.held.add(g);
    });
    this.refreshUI(true);
  }
  drop() {
    const h = this.hands[this.hands.length - 1];
    if (!h) return;
    if (h.type === 'tub') { this.say('take the dirty dishes to the sink in the kitchen'); return; }
    this.hands.pop();
    if (h.type === 'mug') this.stock.mugs++;
    else if (h.type === 'plate') this.stock.plates++;
    else if (h.type === 'clean') { this.rack.mugs += h.mugs; this.rack.plates += h.plates; this.say('put the clean dishes back on the rack'); }
    else { if (h.type === 'tea') this.sink.mugs++; else this.sink.plates++; this.say(`tossed the ${MENU[h.type] ? MENU[h.type].name.toLowerCase() : h.type}`); }
    this.sfx('clickSound');
    this.redrawHands();
  }

  // ------------------------------------------------ kitchen stations
  setupStations() {
    const mk = (label, kind, x, z, cook, shapeTag = `grill${x}`, idleText) => {
      const tag = tagSprite(); tag.position.set(x, 1.75, z - 0.3); this.scene.add(tag); tag.visible = false;
      return { label, kind, x, z, cook, baseCook: cook, burn: 30, state: 'idle', t: 0, tag, redraw: 0, shapeTag, idleText };
    };
    this.stations = [
      mk('Yakitori', 'yakitori', 9.65, 15.3, 10, undefined, 'Lay skewers on the grill'), mk('Yakitori', 'yakitori', 10.65, 15.3, 10, undefined, 'Lay skewers on the grill'),
      mk('Gyoza', 'gyoza', 8.1, 15.3, 13, undefined, 'Fry a batch of gyoza'),
      mk('Tempura', 'tempura', 6.78, 15.3, 11, 'fry', 'Drop tempura in the fryer'),
      mk('Ramen', 'ramen', 12.0, 15.3, 15, 'ramen', 'Start a bowl of ramen'),
    ];
    this.washTag = tagSprite(); this.washTag.position.set(5.65, 1.65, 12.3); this.washTag.visible = false; this.scene.add(this.washTag);
  }
  setWater(on) { if (!this.sinkWater) this.sinkWater = this.audio.water([5.5, 0.9, 12.3]); if (this.sinkWater) this.sinkWater.on = on; }

  // ------------------------------------------------ what you can click
  // everything you can do, run by whoever owns the shop (you, or the co-op host) as the player who clicked
  actions() {
    const T = (t) => this.say(t);
    const takePlate = () => {
      if (this.has('clean')) return this.restock();
      if (this.stock.plates <= 0) return T('no clean plates — wash some in the kitchen');
      if (this.handsFree < 1) return T(this.fullMsg());
      this.stock.plates--; this.hold({ type: 'plate' }); this.sfx('clickSound');
    };
    return {
      mug: () => {
        if (this.has('clean')) return this.restock();
        if (this.stock.mugs <= 0) return T('no clean cups — wash some in the kitchen');
        if (this.handsFree < 1) return T(this.fullMsg());
        this.stock.mugs--; this.hold({ type: 'mug' }); this.sfx('clickSound');
      },
      plate: takePlate,
      urn: () => {
        if (!this.has('mug')) return T('grab a clean cup from the shelf first');
        this.takeHand('mug'); this.hold({ type: 'tea' }); this.sfx('pour');
      },
      sushi: () => {
        if (!this.has('plate')) return T('grab a clean plate first');
        this.takeHand('plate'); this.hold({ type: 'sushi' }); this.sfx('clickSound');
      },
      onigiri: () => {
        if (!this.menuKinds.has('onigiri')) return;
        if (!this.has('plate')) return T('grab a clean plate first');
        this.takeHand('plate'); this.hold({ type: 'onigiri' }); this.sfx('clickSound');
      },
      openShop: () => { if (this.onOpenShop) this.onOpenShop(); },
      buy: (id) => { if (this.onBuy) this.onBuy(id); },
      bow: () => { if (this.onBow) this.onBow(this.actor); },
      placePiece: (key, x, z, rot) => { if (this.onPlace) this.onPlace(key, x, z, rot); },
      station: (i) => {
        const st = this.stations[i]; if (!st) return;
        if (st.state === 'idle') { st.state = 'cooking'; st.t = 0; this.sfx('sizzleBurst'); }
        else if (st.state === 'ready') {
          if (!this.has('plate')) return T('you need a clean plate');
          this.takeHand('plate'); this.hold({ type: st.kind }); st.state = 'idle'; this.sfx('clickSound');
        } else if (st.state === 'burnt') { st.state = 'idle'; this.sfx('sizzleBurst'); }
      },
      sink: () => {
        if (this.has('tub')) { const t = this.takeHand('tub'); this.sink.mugs += t.mugs; this.sink.plates += t.plates; this.sfx('clickSound'); return; }
        const food = this.hands.find((h) => MENU[h.type]);
        if (food) { this.takeHand(food.type); if (food.type === 'tea') this.sink.mugs++; else this.sink.plates++; return; }
        const n = this.sink.mugs + this.sink.plates;
        if (!n) return T('nothing to wash');
        if (this.washing) return T('already washing');
        this.washing = n; this.washTotal = n; this.washDone = 0; this.washT = 0; this.washer = this.actor;
      },
      rack: () => {
        const n = this.rack.mugs + this.rack.plates;
        if (!n) return T('nothing clean yet');
        if (this.hands.length) return T('empty your hands first');
        this.hold({ type: 'clean', mugs: this.rack.mugs, plates: this.rack.plates }); this.rack.mugs = this.rack.plates = 0; this.sfx('clickSound');
      },
      register: () => this.ringUp(),
      cust: (id) => { const q = this.crowd.people.find((p) => p.id === id); if (q && q.svc) this.custAct(q); },
      bus: (i) => { const seat = this.crowd.seats[i]; if (seat && seat.needsBus) this.bus(seat); },
      setDown: (x, y, z, yaw) => this.setDown(x, y, z, yaw),
      pickUp: (id) => { const c = this.counterItems.find((it) => it.id === id); if (c) this.pickUp(c); },
      drop: () => this.drop(),
      beltPut: (s) => {
        const h = this.hands[this.hands.length - 1];
        if (!h || !MENU[h.type]) return T('only finished dishes go on the belt');
        if (!this.belt.isFree(s)) return T('no room on the belt there');
        this.hands.pop(); this.belt.add(h.type, s); this.sfx('clickSound');
      },
      beltTake: (id) => {
        const p = this.belt.plates.find((q) => q.id === id); if (!p) return;
        if (this.handsFree < 1) return T(this.fullMsg());
        this.belt.remove(p); this.hold({ type: p.type }); this.sfx('clickSound');
      },
    };
  }
  setupInteractions() {
    const I = this.interactions, R = (name, ...a) => () => this.request(name, ...a);
    // what gets outlined when you look at a station: the props themselves (kept invisible, the outline pass still sees them)
    const shape = (tag) => { const m = this.batch.shape(tag); this.scene.add(m); return { highlight: m }; };
    const sinkMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 2.75), INVISIBLE);
    sinkMesh.position.set(5.5, 0.85, 12.25); this.scene.add(sinkMesh);
    // customers (seated, or waiting at the register)
    I.add(() => this.custBox, () => this.custLabel(), () => this.request('cust', this.target.id), () => this.pickCustomer());
    // dishes left on tables
    I.add(() => this.dirtyBox, () => {
      const n = this.dirtySeat.dishes.length;
      return this.hands.length && !this.has('tub') ? 'Hands full' : `Bus the table (${n} dish${n > 1 ? 'es' : ''})`;
    }, () => this.request('bus', this.crowd.seats.indexOf(this.dirtySeat)), () => this.pickDirty(), { highlight: () => this.dirtySeat.dishGroup });
    // tea cups along the shelf over the back bar
    I.add([6.9, 2.45, 9.8, 3.0, 0.12, 0.18], () => (this.has('clean') ? 'Restock cups & plates' : `Take a clean cup (${this.stock.mugs} left)`), R('mug'), null, shape('mugs'));
    // plate stacks (three on the back bar, two on the plating station under the pass)
    const plateLabel = () => (this.has('clean') ? 'Restock cups & plates' : `Take a clean plate (${this.stock.plates} left)`);
    I.add([7.95, 1.2, 9.7, 0.35, 0.25, 0.25], plateLabel, R('plate'), null, shape('platesA'));
    I.add([9.5, 1.2, 9.7, 0.2, 0.25, 0.25], plateLabel, R('plate'), null, shape('platesB'));
    I.add([11.75, 1.1, 10.48, 0.32, 0.24, 0.18], plateLabel, R('plate'), null, shape('platesK'));
    // tea urns
    I.add([6.3, 1.45, 9.65, 0.55, 0.45, 0.25], () => (this.has('mug') ? 'Pour a green tea' : 'Tea urn (grab a clean cup)'), R('urn'), null, shape('urns'));
    // the sushi case on the plating station, right by the belt
    I.add([13.1, 1.05, 10.98, 0.42, 0.2, 0.2], () => (this.has('plate') ? 'Make salmon nigiri' : 'Sushi case (grab a clean plate)'), R('sushi'), null, shape('sushi'));
    // the rice cookers: onigiri, once they're on the menu
    I.add([11.92, 1.05, 10.98, 0.45, 0.2, 0.2], () => (this.has('plate') ? 'Press a couple of onigiri' : 'Rice cookers (grab a clean plate for onigiri)'), R('onigiri'), () => this.menuKinds.has('onigiri'), shape('rice'));
    // the sushi belt: put finished dishes on it (in the kitchen, in the well or anywhere along it), or take one off
    I.add(() => this.beltBox, () => {
      const h = this.hands[this.hands.length - 1];
      if (h) return MENU[h.type] ? `Put the ${MENU[h.type].name.toLowerCase()} on the belt` : 'Sushi belt (finished dishes only)';
      return this.beltPlate ? `Take the ${MENU[this.beltPlate.type].name.toLowerCase()} off the belt` : 'Sushi belt · every guest takes what they ordered';
    }, () => {
      if (this.hands.length) this.request('beltPut', this.beltS);
      else if (this.beltPlate) this.request('beltTake', this.beltPlate.id);
    }, () => this.pickBelt(), { highlight: () => (this.beltPlate ? this.beltPlate.mesh : null) });
    // griddles + broiler
    this.stations.forEach((st, i) => {
      I.add([st.x, 1.15, st.z, st.kind === 'gyoza' ? 0.44 : st.kind === 'tempura' ? 0.62 : 0.48, 0.25, 0.42], () => {
        if (st.state === 'idle') return st.idleText;
        if (st.state === 'cooking') return `${st.label} cooking… ${Math.round(st.t / st.cook * 100)}%`;
        if (st.state === 'ready') return this.has('plate') ? `Plate the ${st.label.toLowerCase()}` : `${st.label} ready — grab a clean plate`;
        return 'Scrape off the burnt one';
      }, R('station', i), () => this.menuKinds.has(st.kind), shape(st.shapeTag));
    });
    // dish station sink
    I.add([5.5, 0.85, 12.25, 0.36, 0.22, 1.4], () => {
      if (this.has('tub')) return 'Drop the dirty dishes in the sink';
      const food = this.hands.find((h) => MENU[h.type]);
      if (food) return `Scrape the ${MENU[food.type].name.toLowerCase()} into the trash`;
      const n = this.sink.mugs + this.sink.plates;
      if (this.washing) return `Washing… (${n} left)`;
      return n ? `Wash dishes (${n} in the sink)` : 'Sink (empty)';
    }, R('sink'), null, { highlight: sinkMesh });
    // dish rack: carry the clean ones back out
    I.add([5.5, 1.0, 13.3, 0.32, 0.2, 0.3], () => {
      const n = this.rack.mugs + this.rack.plates;
      return n ? `Take the clean dishes (${this.rack.mugs} cups, ${this.rack.plates} plates)` : 'Dish rack (empty)';
    }, R('rack'), null, shape('dishRack'));
    // the register
    I.add([15.0, 1.12, -1.35, 0.24, 0.22, 0.22], () => {
      const q = this.queue[0];
      if (!q || !q.svc || q.svc.phase !== 'pay') return 'Register (nobody waiting)';
      const b = this.bill(q);
      return `Ring up ${q.svc.name} — ${yen(b.sub)}`;
    }, R('register'), null, shape('register'));
    // set things down on the kaiten counter, the back bar, the register counter or the kitchen counters
    I.add(() => this.counterBox, () => `Set down the ${this.itemLabel(this.hands[this.hands.length - 1])}`,
      () => { if (this.ghostMesh) this.ghostMesh.visible = false; this.request('setDown', ...this.counterSpot, this.player.yaw); }, () => this.pickCounter(),
      { highlight: () => this.ghost(), onHover: (on) => { if (!on && this.ghostMesh) this.ghostMesh.visible = false; } });
  }
  fullMsg() { return this.handCap < 2 ? 'one thing at a time — set it down on a counter first' : 'your hands are full'; }
  // a fresh shift: clear the tables, the sink and the counters, and start with a full stock of clean dishes
  resetForShift() {
    for (const seat of this.crowd.seats) { if (seat.dishGroup) seat.dishGroup.clear(); seat.dishes = []; seat.needsBus = false; }
    for (const c of [...this.counterItems]) this.removeCounterItem(c);
    for (const k in this.handsBy) this.handsBy[k].length = 0;
    this.redrawHands();
    this.stock = { mugs: this.stockMax, plates: this.stockMax }; this.sink = { mugs: 0, plates: 0 }; this.rack = { mugs: 0, plates: 0 };
    this.washing = 0; this.washer = null;
    for (const st of this.stations) { st.state = 'idle'; st.t = 0; }
    this.belt.clear();
    this.queue = [];
    this.refreshUI(true);
  }
  // where along the belt a seat meets it (null for a seat the belt doesn't pass)
  beltS(seat) {
    if (seat.beltS === undefined) seat.beltS = seat.beltAt ? this.belt.sAt(...seat.beltAt) : null;
    return seat.beltS;
  }
  itemLabel(h) {
    if (!h) return '';
    return h.type === 'tub' ? 'bus tub' : h.type === 'clean' ? 'clean dishes' : h.type === 'mug' ? 'clean cup' : h.type === 'plate' ? 'clean plate' : MENU[h.type].name.toLowerCase();
  }
  // where the reticle meets the sushi belt
  pickBelt() {
    const o = this.camera.getWorldPosition(new THREE.Vector3()), d = this.camera.getWorldDirection(new THREE.Vector3());
    if (d.y > -0.05) return false;
    for (const y of [1.125, 0.875]) {
      const t = (y + 0.03 - o.y) / d.y;
      if (t <= 0 || t > 2.3) continue;
      const x = o.x + d.x * t, z = o.z + d.z * t, s = this.belt.sAt(x, z, y);
      if (s === null) continue;
      this.beltS = s; this.beltPlate = this.hands.length ? null : this.belt.near(s);
      const q = this.belt.at(s);
      this.beltBox = [q.x, y + 0.05, q.z, 0.16, 0.06, 0.16];
      return true;
    }
    return false;
  }
  // where the reticle meets a counter top (only while carrying something)
  pickCounter() {
    if (!this.hands.length) return false;
    const o = this.camera.getWorldPosition(new THREE.Vector3()), d = this.camera.getWorldDirection(new THREE.Vector3());
    if (d.y > -0.05) return false;
    let best = null, bt = 2.3;
    for (const [x0, x1, z0, z1, y] of COUNTERS) {
      const t = (y - o.y) / d.y;
      if (t <= 0 || t >= bt) continue;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      bt = t; best = [x, y, z];
    }
    if (!best) return false;
    const [x, y, z] = best;
    if (KEEP_CLEAR.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r)) return false;
    const big = this.hands[this.hands.length - 1].type === 'tub' || this.hands[this.hands.length - 1].type === 'clean';
    if (this.counterItems.some((c) => Math.hypot(x - c.x, z - c.z) < (big || c.big ? 0.42 : 0.24))) return false;
    this.counterSpot = best;
    this.counterBox = [x, y + 0.06, z, big ? 0.24 : 0.13, 0.06, big ? 0.18 : 0.13];
    return true;
  }
  // a see-through preview of what you're holding, sitting where it would go
  ghost() {
    const h = this.hands[this.hands.length - 1];
    const key = h.type === 'tub' || h.type === 'clean' ? `${h.type}:${h.mugs}:${h.plates}` : h.type;
    if (this.ghostKey !== key) {
      if (this.ghostMesh) this.scene.remove(this.ghostMesh);
      this.ghostMat ||= new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false });
      const m = h.type === 'tub' || h.type === 'clean' ? tubModel(h.mugs, h.plates, h.type === 'clean') : this.dishModel(h.type);
      this.ghostMesh = m.mesh(this.ghostMat, this.ghostMat); this.ghostKey = key; this.scene.add(this.ghostMesh);
    }
    const [x, y, z] = this.counterSpot;
    this.ghostMesh.position.set(x, y + 0.002, z); this.ghostMesh.rotation.y = this.player.yaw; this.ghostMesh.visible = true;
    return this.ghostMesh;
  }
  setDown(x, y, z, yaw) {
    const h = this.hands[this.hands.length - 1]; if (!h) return;
    const big = h.type === 'tub' || h.type === 'clean';
    if (this.counterItems.some((c) => Math.hypot(x - c.x, z - c.z) < (big || c.big ? 0.42 : 0.24))) return this.say('no room there');
    this.hands.pop();
    this.addCounterItem(this.nextItemId++, h, x, y, z, yaw);
    this.sfx('clickSound');
  }
  addCounterItem(id, h, x, y, z, yaw) {
    const big = h.type === 'tub' || h.type === 'clean';
    const mesh = (big ? tubModel(h.mugs, h.plates, h.type === 'clean') : this.dishModel(h.type)).mesh(this.litMat, this.emitMat);
    mesh.position.set(x, y + 0.002, z); mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const c = { id, item: h, mesh, x, y, z, yaw, big };
    c.ix = this.interactions.add([x, y + 0.08, z, big ? 0.26 : 0.14, 0.1, big ? 0.2 : 0.14],
      () => (big && this.hands.length) || (!big && this.handsFree < 1) ? `${this.itemLabel(h)} (hands full)` : `Pick up the ${this.itemLabel(h)}`,
      () => this.request('pickUp', id), null, { highlight: mesh });
    this.counterItems.push(c);
    return c;
  }
  removeCounterItem(c) {
    this.scene.remove(c.mesh); this.interactions.remove(c.ix);
    this.counterItems.splice(this.counterItems.indexOf(c), 1);
  }
  pickUp(c) {
    if (c.big ? this.hands.length : this.handsFree < 1) return this.say(c.big ? 'empty your hands first' : this.fullMsg());
    this.removeCounterItem(c);
    this.hold(c.item); this.sfx('clickSound');
  }
  restock() {
    const c = this.takeHand('clean');
    this.stock.mugs += c.mugs; this.stock.plates += c.plates;
    this.say(`restocked ${c.mugs} cups and ${c.plates} plates`); this.sfx('clickSound');
  }
  bus(seat) {
    if (this.hands.length && !this.has('tub')) return this.say('your hands are full');
    let tub = this.hands.find((h) => h.type === 'tub');
    if (!tub) { tub = { type: 'tub', mugs: 0, plates: 0, slot: 'both' }; this.hands.push(tub); }
    for (const d of seat.dishes) { if (d.type === 'mugDirty') tub.mugs++; else tub.plates++; }
    this.dishGroup(seat).clear();
    seat.dishes = []; seat.needsBus = false;
    this.sfx('clickSound');
  }
  ringUp() {
    const q = this.queue[0];
    if (!q || q.svc.phase !== 'pay') return this.say("nobody's waiting to pay");
    const b = this.bill(q);
    this.money += b.sub + b.tip; this.tips += b.tip; this.served++;
    this.sfxAll('kaching');
    this.pop(b.tip > 0 ? `+${yen(b.tip)} tip!` : `+${yen(b.sub)}`);
    this.say(`${q.svc.name}: gochisōsama deshita! · ${yen(b.sub + b.tip)}`);
    q.svc.phase = 'gone';
    this.queue.shift();
    this.crowd.leave(q);
    this.layoutQueue();
  }

  // the customer under the reticle (computed per frame by the interaction system)
  pickCustomer() {
    let best = null, bd = 1e9;
    const cam = this.camera.position, dir = this.camera.getWorldDirection(new THREE.Vector3());
    for (const q of this.crowd.people) {
      if (!q.svc || q.svc.phase === 'gone') continue;
      if (!(q.state === 'sit' || q.state === 'stand')) continue;
      const h = q.state === 'sit' ? q.seat.y + 0.35 : q.pos.y + 1.1;
      const v = new THREE.Vector3(q.pos.x - cam.x, h - cam.y, q.pos.z - cam.z);
      const d = v.length(); if (d > 2.6) continue;
      const ang = v.normalize().dot(dir);
      if (ang > 0.93 && d < bd) { bd = d; best = q; }
    }
    this.target = best;
    if (best) { const h = best.state === 'sit' ? best.seat.y + 0.3 : best.pos.y + 1.0; this.custBox = [best.pos.x, h, best.pos.z, 0.32, 0.6, 0.32]; }
    return !!best;
  }
  custLabel() {
    const q = this.target; if (!q) return '';
    const s = q.svc, who = s.name;
    if (s.phase === 'menu') return `${who} is reading the menu`;
    if (s.phase === 'order') return `Take ${who}'s order`;
    if (s.phase === 'food') {
      const match = s.items.find((i) => !i.done && this.has(i.kind));
      if (match) return `Serve the ${MENU[match.kind].name.toLowerCase()}`;
      return `${who} is waiting on: ${s.items.filter((i) => !i.done).map((i) => MENU[i.kind].name.toLowerCase()).join(', ')}`;
    }
    if (s.phase === 'eat') return `${who} is enjoying it`;
    if (s.phase === 'pay' || s.phase === 'walkpay') return `${who} is ready to pay — use the register`;
    return who;
  }
  custAct(q) {
    const s = q.svc;
    if (s.phase === 'order') {
      s.items = this.makeOrder(); s.phase = 'food';
      this.sfx('clickSound');
      this.say(`${s.name} (${this.seatLabel(q.seat)}): ${s.items.map((i) => MENU[i.kind].name.toLowerCase()).join(' and ')}`);
    } else if (s.phase === 'food') {
      const item = s.items.find((i) => !i.done && this.has(i.kind));
      if (!item) return this.say(`they ordered ${s.items.filter((i) => !i.done).map((i) => MENU[i.kind].name.toLowerCase()).join(' and ')}`);
      this.takeHand(item.kind);
      this.serveItem(q, item);
      this.sfx('clickSound');
    }
  }
  // a dish reaches its guest, by hand or by belt
  serveItem(q, item) {
    const s = q.svc;
    item.done = true;
    this.place(q.seat, item.kind);
    if (s.items.every((i) => i.done)) { s.phase = 'eat'; s.t = 25 + Math.random() * 20; this.sayAll(`${s.name}: itadakimasu!`); }
  }
  pickDirty() {
    let best = null, bd = 1e9;
    const cam = this.camera.position, dir = this.camera.getWorldDirection(new THREE.Vector3());
    for (const seat of this.crowd.seats) {
      if (!seat.needsBus || seat.occupant) continue;
      const [x, y, z] = this.spot(seat, 0);
      const v = new THREE.Vector3(x - cam.x, y - cam.y, z - cam.z), d = v.length();
      if (d > 2.4) continue;
      if (v.normalize().dot(dir) > 0.94 && d < bd) { bd = d; best = seat; }
    }
    this.dirtySeat = best;
    if (best) { const [x, y, z] = this.spot(best, 0); this.dirtyBox = [x, y + 0.05, z, 0.3, 0.12, 0.3]; }
    return !!best;
  }

  // ------------------------------------------------ co-op: the host packs up the shop, guests unpack it
  snapshot() {
    const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
    const hand = (h) => [h.type, h.slot, h.mugs || 0, h.plates || 0];
    return {
      svc: this.crowd.people.filter((q) => q.svc).map((q) => [q.id, q.svc.phase, q.svc.name, q.svc.items.map((i) => i.kind + (i.done ? '+' : '')).join(',')]),
      seats: this.crowd.seats.map((st, i) => (st.dishes && st.dishes.length ? [i, st.dishes.map((d) => d.type).join(','), st.needsBus ? 1 : 0] : null)).filter(Boolean),
      st: this.stations.map((st) => [st.state, r2(st.t)]),
      sink: this.sink, rack: this.rack, stock: this.stock,
      wash: [this.washing, this.washTotal, this.washDone, r2(this.washT || 0), r2(this.washShow || 0)],
      items: this.counterItems.map((c) => [c.id, ...hand(c.item), r3(c.x), r3(c.y), r3(c.z), r2(c.yaw)]),
      hands: Object.fromEntries(Object.entries(this.handsBy).map(([k, v]) => [k, v.map(hand)])),
      queue: this.queue.map((q) => q.id),
      m: [this.money, this.tips, this.served, this.walkouts, this.washed, this.burnt],
      perks: [this.handCap, this.washTime, this.patience],
      belt: this.belt.snapshot(),
      own: this.owned,
      cash: Math.round(this.cashBox || 0),
      lay: this.layout || {},
    };
  }
  applySnapshot(d) {
    const byId = new Map(this.crowd.people.map((q) => [q.id, q]));
    for (const [id, phase, name, items] of d.svc) {
      const q = byId.get(id); if (!q) continue;
      if (!q.svc) { q.svc = { t: 0, orderWait: 0, foodWait: 0 }; this.addBubble(q); }
      q.svc.phase = phase; q.svc.name = name;
      q.svc.items = items ? items.split(',').map((k) => ({ kind: k.replace('+', ''), done: k.endsWith('+') })) : [];
    }
    const seatData = new Map(d.seats.map(([i, types, bus]) => [i, [types, bus]]));
    this.crowd.seats.forEach((seat, i) => {
      const [types, bus] = seatData.get(i) || ['', 0], key = `${types}|${bus}`;
      if ((seat._key || '|0') === key) return;
      seat._key = key;
      if (seat.dishGroup) seat.dishGroup.clear();
      seat.dishes = [];
      for (const t of types ? types.split(',') : []) this.place(seat, t);
      seat.needsBus = !!bus;
    });
    d.st.forEach(([state, t], i) => { this.stations[i].state = state; this.stations[i].t = t; });
    this.sink = d.sink; this.rack = d.rack; this.stock = d.stock;
    [this.washing, this.washTotal, this.washDone, this.washT, this.washShow] = d.wash;
    const hand = ([type, slot, mugs, plates]) => ({ type, slot, mugs, plates });
    const want = new Set(d.items.map((it) => it[0]));
    for (const c of [...this.counterItems]) if (!want.has(c.id)) this.removeCounterItem(c);
    for (const [id, type, slot, mugs, plates, x, y, z, yaw] of d.items)
      if (!this.counterItems.some((c) => c.id === id)) this.addCounterItem(id, hand([type, slot, mugs, plates]), x, y, z, yaw);
    const mine = JSON.stringify(d.hands[this.me] || []);
    this.handsBy = Object.fromEntries(Object.entries(d.hands).map(([k, v]) => [k, v.map(hand)]));
    this.hands = this.handsBy[this.me] ||= [];
    if (mine !== this._mine) { this._mine = mine; this.redrawHands(); }
    this.queue = d.queue.map((id) => byId.get(id)).filter(Boolean);
    [this.money, this.tips, this.served, this.walkouts, this.washed, this.burnt] = d.m;
    [this.handCap, this.washTime, this.patience] = d.perks;
    if (d.belt) this.belt.applySnapshot(d.belt);
    if (d.own && d.own.length !== this.owned.length && this.onOwned) this.onOwned(d.own);
    if (d.cash !== undefined) this.cashBox = d.cash;
    if (d.lay && JSON.stringify(d.lay) !== this._lay) { this._lay = JSON.stringify(d.lay); if (this.onLayout) this.onLayout(d.lay); }
  }
  // switch this game into co-op: you're `id`, and either run the shop ('host') or mirror it ('guest')
  goCoop(net, role) {
    this.net = net; this.role = role;
    this.handsBy = { [net.id]: this.handsBy[this.me] || [] };
    this.me = this.actor = net.id; this.hands = this.handsBy[this.me];
    if (role === 'guest') {
      // the host's shop replaces ours
      this.resetForShift();
      for (const seat of this.crowd.seats) { seat._key = undefined; seat.occupant = null; }
      this.crowd.clearAll(); this.crowd.puppet = true;
    }
  }

  // dirty dishes half-sunk in the sink wells, clean ones standing in the rack
  drawDishes() {
    const key = `${this.sink.mugs},${this.sink.plates},${this.rack.mugs},${this.rack.plates}`;
    if (this.dishKey === key) return;
    this.dishKey = key;
    if (!this.dishVis) { this.dishVis = new THREE.Group(); this.scene.add(this.dishVis); }
    this.dishVis.clear();
    const put = (type, x, y, z, rx, ry, rz) => {
      const m = this.dishModel(type).mesh(this.litMat, this.emitMat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz); this.dishVis.add(m);
    };
    // sink: plates lean in the first two wells, mugs bob in between; water is at 0.75
    const plateSlots = [11.0, 11.6, 12.0, 12.6, 11.3, 12.3], mugSlots = [[5.62, 11.15], [5.38, 11.45], [5.62, 12.15], [5.38, 12.45], [5.6, 11.7], [5.4, 12.0]];
    for (let i = 0; i < Math.min(this.sink.plates, plateSlots.length); i++) put('plateDirty', 5.47 + (i & 1) * 0.06, 0.72, plateSlots[i], 1.15 + (i % 3) * 0.12, 0, (i & 1 ? 0.15 : -0.15));
    for (let i = 0; i < Math.min(this.sink.mugs, mugSlots.length); i++) put('mugDirty', mugSlots[i][0], 0.66, mugSlots[i][1], 0.55, i * 1.7, 0.3);
    // rack: plates upright between the pegs, mugs upside down along the side
    for (let i = 0; i < Math.min(this.rack.plates, 6); i++) put('plate', 5.42, 1.04, 13.08 + i * 0.085, Math.PI / 2, 0, 0);
    for (let i = 0; i < Math.min(this.rack.mugs, 4); i++) put('mug', 5.67, 1.03, 13.1 + i * 0.13, Math.PI, 0, 0);
  }

  // ------------------------------------------------ HUD
  refreshUI(force) {
    this.drawDishes();
    const u = this.ui;
    // one tally for the whole room: how many of each thing to make, plus who's waiting on you
    const want = {}; let ordering = 0, paying = 0;
    for (const q of this.crowd.people) {
      const s = q.svc; if (!s) continue;
      if (s.phase === 'order') ordering++;
      else if (s.phase === 'pay' || s.phase === 'walkpay') paying++;
      else if (s.phase === 'food') for (const it of s.items) if (!it.done) want[it.kind] = (want[it.kind] || 0) + 1;
    }
    // dishes already riding the belt are on their way: count them off, and say so
    const riding = {};
    for (const p of this.belt.plates) riding[p.type] = (riding[p.type] || 0) + 1;
    const rows = Object.keys(MENU).filter((k) => want[k]).map((k) => {
      const onBelt = Math.min(want[k], riding[k] || 0), left = want[k] - onBelt;
      return `<div class="line${left ? '' : ' done'}"><div class="tile"><img src="${ICON_SRC(k)}" alt="${MENU[k].name}"></div><span class="n">×${left}</span>${onBelt ? `<span class="belt">${onBelt} on belt</span>` : ''}</div>`;
    }).join('');
    const tags = (ordering ? `<span class="tag ord">! ${ordering}</span>` : '') + (paying ? `<span class="tag pay">¥ ${paying}</span>` : '');
    const html = rows || tags ? `<div class="ttl hand">orders</div>${rows}${rows && tags ? '<div class="rule"></div>' : ''}${tags ? `<div class="tags">${tags}</div>` : ''}` : '';
    if (force || u.orders._html !== html) { u.orders.innerHTML = html; u.orders._html = html; }
  }
}
