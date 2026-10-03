// Working the night shift: take orders, make coffee and food, serve, ring up, bus and wash dishes, restock.
import * as THREE from 'three';
import { Model, C } from './voxel.js';

export const MENU = {
  coffee: { name: 'Coffee', price: 2.25 },
  pie: { name: 'Cherry pie', price: 4.5 },
  pancakes: { name: 'Pancakes', price: 7.5 },
  burger: { name: 'Burger', price: 9.25 },
};
const NAMES = ['the cab driver', 'a night nurse', 'the jazz pianist', 'an insomniac poet', 'a night-shift cop', 'a grad student', 'the baker next door',
  'an old regular', 'a theater usher', 'a tired line cook', 'a bike messenger', 'a couple of strangers', 'a nervous first date', 'the mailman', 'a painter', 'a doorman'];

// ---------------------------------------------------------------- little voxel models for dishes
const INVISIBLE = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

// counter tops you can set things on: [x0, x1, z0, z1, top y]. The bar counter stops short of the
// customers' side so their plates have room; spots near props on the counters are kept clear.
const COUNTERS = [
  [3.0, 13.25, 7.3, 7.8, 1.075],   // bar counter, your side
  [4.6, 13.2, 9.15, 9.5, 1.0],     // back bar, in front of the urns and plates
  [7.1, 11.9, 12.05, 12.8, 0.875], // kitchen prep island
  [10.55, 12.25, 10.3, 10.8, 0.875], // plating station under the pass (plate stacks at the east end)
  [10.8, 12.7, 9.8, 10.45, 1.125],  // the pass between the kitchen and the bar
];
const KEEP_CLEAR = [[3.4, 7.45, 0.35], [12.6, 7.45, 0.3], [5.4, 7.55, 0.25], [10.9, 7.55, 0.25], [8.2, 7.55, 0.22], [9.5, 12.4, 0.45]];

const W = C('#f2efe8', 0, 0.03), coffeeC = C('#2a1608', 0, 0.05), ring = C('#6a4a30', 0, 0.06);
function mugModel(state) {
  const m = new Model(5, 5, 4, 1 / 32, [2, 0, 2]);
  m.cyl(2, 2, 1.8, 0, 4, W, state === 'empty' ? 1.0 : -1);
  if (state === 'coffee') m.cyl(2, 2, 1.0, 3, 4, coffeeC);
  if (state === 'dirty') m.cyl(2, 2, 1.0, 1, 2, ring);
  m.set(4, 1, 2, W); m.set(4, 2, 2, W); m.set(4, 3, 2, W);
  return m;
}
function plateModel(food) {
  const m = new Model(10, 7, 10, 1 / 32, [5, 0, 5]);
  m.cyl(5, 5, 4.6, 0, 1, W);
  if (food === 'pancakes') { m.cyl(5, 5, 3.2, 1, 4, C('#d8a050', 0, 0.08)); m.cyl(5, 5, 2.2, 4, 5, C('#5a2c10', 0, 0.06)); m.set(5, 5, 5, C('#f6e070', 0, 0.03)); }
  if (food === 'pie') {
    const crust = C('#c99a5a', 0, 0.06), fill = C('#8e1a28', 0, 0.06);
    for (let i = 0; i < 5; i++) for (let j = 0; j <= i; j++) { m.set(3 + i, 1, 3 + j, i === 4 ? crust : fill); m.set(3 + i, 2, 3 + j, (i + j) & 1 ? crust : fill); }
    m.set(7, 3, 6, C('#f4f0e6', 0, 0.02));
  }
  if (food === 'burger') {
    m.cyl(4.5, 5, 2.6, 1, 2, C('#c08040', 0, 0.06)); m.cyl(4.5, 5, 2.8, 2, 3, C('#4a2614', 0, 0.06));
    m.cyl(4.5, 5, 2.8, 3, 4, C('#6fb03a', 0, 0.08)); m.cyl(4.5, 5, 2.6, 4, 6, C('#d39048', 0, 0.06));
    for (let i = 0; i < 3; i++) m.box(7, 1, 2 + i * 2, 9, 2, 3 + i * 2, C('#e8b040', 0, 0.08));
  }
  if (food === 'dirty') { m.set(4, 1, 4, C('#8a5a2a', 0, 0.1)); m.set(6, 1, 5, C('#6a3a1a', 0, 0.1)); m.set(5, 1, 6, C('#a8703a', 0, 0.1)); m.set(3, 1, 6, C('#8a5a2a', 0, 0.1)); }
  return m;
}
function tubModel(mugs, plates, clean) {
  const m = new Model(14, 8, 10, 1 / 32, [7, 0, 5]);
  if (!clean) { m.box(0, 0, 0, 14, 6, 10, C('#4a4e54', 0, 0.04)); m.box(1, 1, 1, 13, 6, 9, null); for (let x = 1; x < 13; x++) for (let z = 1; z < 9; z++) for (let y = 1; y < 6; y++) m.set(x, y, z, 0); }
  const n = Math.min(4, plates);
  for (let i = 0; i < n; i++) m.cyl(5, 5, 3.8, 1 + i, 2 + i, (x, y) => (clean ? W : (y & 1 ? W : C('#d8d0c0', 0, 0.05))));
  for (let i = 0; i < Math.min(3, mugs); i++) m.cyl(11, 2.5 + i * 2.6, 1.2, 1, 5, W);
  return m;
}

// pixel-art food icons, shared by the orders slip (as <img>) and the speech bubbles
export const ICON_SRC = (kind) => `src/icons/${kind}.png`;
const ICON_IMG = {};
for (const k of ['coffee', 'pie', 'pancakes', 'burger']) { const im = new Image(); im.src = ICON_SRC(k); ICON_IMG[k] = im; }
const iconReady = (ic) => !ICON_IMG[ic] || (ICON_IMG[ic].complete && ICON_IMG[ic].naturalWidth > 0);

// one icon (an order item, or ! / $) drawn centered at the origin, about 64px across
function drawIcon(g, ic) {
  if (ICON_IMG[ic] && iconReady(ic)) { g.imageSmoothingEnabled = false; g.drawImage(ICON_IMG[ic], -34, -34, 68, 68); return; }
  if (ic === '!' || ic === '$' || ic === '…' || ic === '?') {
    g.fillStyle = ic === '$' ? '#2a7a3a' : ic === '!' ? '#c8302a' : '#5a4a40'; g.font = '600 64px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, 0, 4);
  } else if (ic === 'coffee') {
    g.fillStyle = '#f4f0e8'; g.strokeStyle = '#3a2a20'; g.lineWidth = 4; g.beginPath(); g.roundRect(-18, -14, 30, 34, 5); g.fill(); g.stroke();
    g.beginPath(); g.arc(14, 2, 8, -1.3, 1.3); g.stroke(); g.fillStyle = '#3a1e0e'; g.fillRect(-15, -12, 24, 7);
    g.strokeStyle = '#9a8a80'; g.lineWidth = 3; g.beginPath(); g.moveTo(-6, -20); g.quadraticCurveTo(0, -28, -4, -36); g.stroke();
  } else if (ic === 'pancakes') {
    for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#c88a40' : '#e0a858'; g.beginPath(); g.ellipse(0, 14 - k * 10, 26, 8, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#6a3410'; g.beginPath(); g.ellipse(0, -10, 16, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f6e070'; g.fillRect(-5, -16, 10, 6);
  } else if (ic === 'pie') {
    g.fillStyle = '#c99a5a'; g.beginPath(); g.moveTo(-24, 18); g.lineTo(24, 18); g.lineTo(0, -22); g.closePath(); g.fill();
    g.fillStyle = '#9a1e2a'; g.beginPath(); g.moveTo(-15, 12); g.lineTo(15, 12); g.lineTo(0, -12); g.closePath(); g.fill();
  } else if (ic === 'burger') {
    g.fillStyle = '#d39048'; g.beginPath(); g.ellipse(0, -8, 24, 12, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#6fb03a'; g.fillRect(-24, -8, 48, 5); g.fillStyle = '#4a2614'; g.fillRect(-23, -3, 46, 9); g.fillStyle = '#c08040'; g.fillRect(-22, 6, 44, 8);
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
  if (icons.every(iconReady)) bubbleCache.set(key, t); // redraw later if an icon was still loading
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
    this.stock = { mugs: 6, plates: 6 };
    this.sink = { mugs: 0, plates: 0 };
    this.rack = { mugs: 0, plates: 0 };
    this.washing = 0; this.washTotal = 0; this.washDone = 0; this.washer = null;
    // everyone has their own hands. Actions run "as" a player: this.hands points at that player's hands
    // while it runs, and at yours the rest of the time (for labels and what you see you're holding).
    this.me = 'local'; this.handsBy = { local: [] }; this.hands = this.handsBy.local; this.actor = this.me;
    this.role = 'solo'; this.net = null; // co-op: 'host' runs the diner, 'guest' mirrors it
    this.posOf = () => this.player.pos;   // where a player is (co-op swaps this in)
    this.counterItems = []; // things set down on a counter
    this.nextItemId = 1;
    this.queue = [];
    this.queueSpots = [[2.45, 6.3], [2.45, 5.5], [2.35, 4.7], [2.35, 3.9]];
    this.register = { x: 3.4, z: 7.45 };
    this.nameIdx = Math.floor(Math.random() * NAMES.length); // who walks in first changes every night
    this.models = {};
    this.heldLit = this.litMat.clone(); this.heldLit.depthTest = false;
    this.heldEmit = this.emitMat.clone(); this.heldEmit.depthTest = false;
    this.held = new THREE.Group(); this.camera.add(this.held);
    this.setupStations();
    this.A = this.actions();
    this.setupInteractions();
    this.crowd.onSeated = (q) => this.seated(q);
    this.refreshUI(true);
  }
  model(key, build) { return this.models[key] || (this.models[key] = build()); }
  heldModel(h) { return h.type === 'tub' || h.type === 'clean' ? tubModel(h.mugs, h.plates, h.type === 'clean') : this.dishModel(h.type); }
  dishModel(type) {
    if (type === 'coffee' || type === 'mug' || type === 'mugDirty') return this.model(type, () => mugModel(type === 'coffee' ? 'coffee' : type === 'mug' ? 'empty' : 'dirty'));
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
    if (r < 0.75) items.push('coffee');
    const food = Math.random();
    if (food < 0.3) items.push('pancakes'); else if (food < 0.5) items.push('pie'); else if (food < 0.68) items.push('burger');
    if (!items.length) items.push('coffee');
    return items.map((kind) => ({ kind, done: false }));
  }
  bubbleKey(q) {
    const s = q.svc;
    if (s.phase === 'order') return '!';
    if (s.phase === 'food') return s.items.filter((i) => !i.done).map((i) => i.kind).join(',');
    if (s.phase === 'pay') return '$';
    return null;
  }
  seatLabel(seat) {
    if (seat.kind === 'stool') return 'the counter';
    if (seat.kind === 'booth') return seat.z < 1.5 && seat.x > 1 ? 'a front booth' : 'a window booth';
    if (seat.z < 0) return 'the glass room';
    return 'a table';
  }

  // set a dish on the customer's table
  spot(seat, idx) {
    const fx = -Math.sin(seat.yaw), fz = -Math.cos(seat.yaw);
    const sx = -fz, sz = fx, side = (idx - 0.5) * 0.18;
    const surf = seat.kind === 'stool' ? 1.075 : 1.0;
    return [seat.x + fx * 0.42 + sx * side, surf, seat.z + fz * 0.42 + sz * side];
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
      const dirty = d.type === 'coffee' || d.type === 'mug' ? 'mugDirty' : 'plateDirty';
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
      else if (s.phase === 'order') { s.orderWait += dt; if (s.orderWait > 150 * this.patience) this.giveUp(q); }
      else if (s.phase === 'food') { s.foodWait += dt; if (s.foodWait > 300 * this.patience) this.giveUp(q); }
      else if (s.phase === 'eat') { s.t -= dt; if (s.t < 0) this.doneEating(q); }
      const key = this.bubbleKey(q), b = s.bubble;
      if (b) {
        b.visible = !!key;
        if (key && b.userData.key !== key) { b.material.map = bubbleTex(key); b.material.needsUpdate = true; b.userData.key = key; b.scale.set(0.24 + key.split(',').length * 0.13, 0.21, 1); }
        b.position.y = q.state === 'sit' || q.state === 'sitting' ? (q.seat ? q.seat.y - q.pos.y : 0.5) + 1.0 : 2.0;
        if (key === '!' || key === '$') b.position.y += Math.sin(performance.now() / 260) * 0.03;
      }
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
    const sub = q.svc.items.filter((i) => i.done).reduce((a, i) => a + MENU[i.kind].price, 0);
    const mood = Math.max(0.05, 0.25 - 0.1 * (q.svc.orderWait / 60) - 0.05 * (q.svc.foodWait / 90));
    return { sub, tip: Math.round(sub * mood * 4) / 4 };
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
    else { if (h.type === 'coffee') this.sink.mugs++; else this.sink.plates++; this.say(`tossed the ${MENU[h.type] ? MENU[h.type].name.toLowerCase() : h.type}`); }
    this.sfx('clickSound');
    this.redrawHands();
  }

  // ------------------------------------------------ kitchen stations
  setupStations() {
    const mk = (label, kind, x, z, cook) => {
      const tag = tagSprite(); tag.position.set(x, 1.75, z - 0.3); this.scene.add(tag); tag.visible = false;
      return { label, kind, x, z, cook, burn: 30, state: 'idle', t: 0, tag, redraw: 0 };
    };
    this.stations = [mk('Pancakes', 'pancakes', 9.65, 15.3, 10), mk('Pancakes', 'pancakes', 10.65, 15.3, 10), mk('Burger', 'burger', 8.1, 15.3, 13)];
    this.washTag = tagSprite(); this.washTag.position.set(5.65, 1.65, 12.3); this.washTag.visible = false; this.scene.add(this.washTag);
  }
  setWater(on) { if (!this.sinkWater) this.sinkWater = this.audio.water([5.5, 0.9, 12.3]); if (this.sinkWater) this.sinkWater.on = on; }

  // ------------------------------------------------ what you can click
  // everything you can do, run by whoever owns the diner (you, or the co-op host) as the player who clicked
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
        if (this.stock.mugs <= 0) return T('no clean mugs — wash some in the kitchen');
        if (this.handsFree < 1) return T(this.fullMsg());
        this.stock.mugs--; this.hold({ type: 'mug' }); this.sfx('clickSound');
      },
      plate: takePlate,
      urn: () => {
        if (!this.has('mug')) return T('grab a clean mug from the back bar first');
        this.takeHand('mug'); this.hold({ type: 'coffee' }); this.sfx('pour');
      },
      pie: () => {
        if (!this.has('plate')) return T('grab a clean plate first');
        this.takeHand('plate'); this.hold({ type: 'pie' }); this.sfx('clickSound');
      },
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
        if (food) { this.takeHand(food.type); if (food.type === 'coffee') this.sink.mugs++; else this.sink.plates++; return; }
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
    // mugs hanging along the back bar
    I.add([9.0, 2.05, 9.75, 4.2, 0.18, 0.16], () => (this.has('clean') ? 'Restock mugs & plates' : `Take a clean mug (${this.stock.mugs} left)`), R('mug'), null, shape('mugs'));
    // plate stacks (two by the urns, one at the end of the back bar, two in the kitchen under the pass)
    const plateLabel = () => (this.has('clean') ? 'Restock mugs & plates' : `Take a clean plate (${this.stock.plates} left)`);
    I.add([10.35, 1.2, 9.7, 0.35, 0.25, 0.25], plateLabel, R('plate'), null, shape('platesA'));
    I.add([13.0, 1.2, 9.7, 0.2, 0.25, 0.25], plateLabel, R('plate'), null, shape('platesB'));
    I.add([12.6, 1.1, 10.55, 0.32, 0.24, 0.2], plateLabel, R('plate'), null, shape('platesK'));
    // coffee urns
    I.add([7.6, 1.45, 9.65, 0.55, 0.45, 0.25], () => (this.has('mug') ? 'Pour a coffee' : 'Coffee urn (grab a clean mug)'), R('urn'), null, shape('urns'));
    // pie rack on the counter
    I.add([12.6, 1.4, 7.45, 0.25, 0.35, 0.22], () => (this.has('plate') ? 'Plate a slice of pie' : 'Pie (grab a clean plate)'), R('pie'), null, shape('pie'));
    // griddles + broiler
    this.stations.forEach((st, i) => {
      I.add([st.x, 1.15, st.z, st.kind === 'burger' ? 0.44 : 0.48, 0.25, 0.42], () => {
        if (st.state === 'idle') return st.kind === 'burger' ? 'Throw a patty on the broiler' : 'Pour pancake batter';
        if (st.state === 'cooking') return `${st.label} cooking… ${Math.round(st.t / st.cook * 100)}%`;
        if (st.state === 'ready') return this.has('plate') ? `Plate the ${st.label.toLowerCase()}` : `${st.label} ready — grab a clean plate`;
        return 'Scrape off the burnt one';
      }, R('station', i), null, shape(`grill${st.x}`));
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
      return n ? `Take the clean dishes (${this.rack.mugs} mugs, ${this.rack.plates} plates)` : 'Dish rack (empty)';
    }, R('rack'), null, shape('dishRack'));
    // the register
    I.add([3.4, 1.25, 7.45, 0.24, 0.22, 0.22], () => {
      const q = this.queue[0];
      if (!q || !q.svc || q.svc.phase !== 'pay') return 'Register (nobody waiting)';
      const b = this.bill(q);
      return `Ring up ${q.svc.name} — $${b.sub.toFixed(2)}`;
    }, R('register'), null, shape('register'));
    // set things down on the bar counter, back bar or kitchen counters
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
    this.stock = { mugs: 6, plates: 6 }; this.sink = { mugs: 0, plates: 0 }; this.rack = { mugs: 0, plates: 0 };
    this.washing = 0; this.washer = null;
    for (const st of this.stations) { st.state = 'idle'; st.t = 0; }
    this.queue = [];
    this.refreshUI(true);
  }
  itemLabel(h) {
    if (!h) return '';
    return h.type === 'tub' ? 'bus tub' : h.type === 'clean' ? 'clean dishes' : h.type === 'mug' ? 'clean mug' : h.type === 'plate' ? 'clean plate' : MENU[h.type].name.toLowerCase();
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
    this.say(`restocked ${c.mugs} mugs and ${c.plates} plates`); this.sfx('clickSound');
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
    this.pop(b.tip > 0 ? `+$${b.tip.toFixed(2)} tip!` : `+$${b.sub.toFixed(2)}`);
    this.say(`rang up ${q.svc.name} · $${(b.sub + b.tip).toFixed(2)}`);
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
      this.takeHand(item.kind); item.done = true;
      this.place(q.seat, item.kind);
      this.sfx('clickSound');
      if (s.items.every((i) => i.done)) { s.phase = 'eat'; s.t = 25 + Math.random() * 20; this.say('thank you, hon'); }
    }
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

  // ------------------------------------------------ co-op: the host packs up the diner, guests unpack it
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
  }
  // switch this game into co-op: you're `id`, and either run the diner ('host') or mirror it ('guest')
  goCoop(net, role) {
    this.net = net; this.role = role;
    this.handsBy = { [net.id]: this.handsBy[this.me] || [] };
    this.me = this.actor = net.id; this.hands = this.handsBy[this.me];
    if (role === 'guest') {
      // the host's diner replaces ours
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
    const rows = Object.keys(MENU).filter((k) => want[k]).map((k) =>
      `<div class="line"><div class="tile"><img src="${ICON_SRC(k)}" alt="${MENU[k].name}"></div><span class="n">×${want[k]}</span></div>`).join('');
    const tags = (ordering ? `<span class="tag ord">! ${ordering}</span>` : '') + (paying ? `<span class="tag pay">$ ${paying}</span>` : '');
    const html = rows || tags ? `<div class="ttl hand">orders</div>${rows}${rows && tags ? '<div class="rule"></div>' : ''}${tags ? `<div class="tags">${tags}</div>` : ''}` : '';
    if (force || u.orders._html !== html) { u.orders.innerHTML = html; u.orders._html = html; }
  }
}
