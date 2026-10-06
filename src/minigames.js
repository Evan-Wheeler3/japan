// Little games that fill the screen when you earn something: learning a recipe (drag the ingredients onto the dish
// in the right order, worked out from the chef's notes), picking a lock (the walk-in freezer, the kura's padlock),
// and shovelling the drift off the back door. play(kind, id) resolves true when it's done, false if you put it off.
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the ingredients, drawn for their tiles
const ING = {
  rice: { name: 'Sushi rice', draw: (g) => { mound(g, '#f6f2ea', 30); grains(g, 30); } },
  rice2: { name: 'More rice', draw: (g) => { mound(g, '#f6f2ea', 30); grains(g, 30); } },
  wasabi: { name: 'Wasabi', draw: (g) => { blob(g, 0, 6, 18, 12, '#8cc63e'); blob(g, -4, 2, 6, 4, '#b4e06a'); } },
  salmon: { name: 'Salmon', draw: (g) => slab(g, '#f28c5a', '#fbd2b4') },
  nori: { name: 'Nori', draw: (g) => { g.fillStyle = '#1e2a1e'; rr(g, -30, -20, 60, 40, 4); g.fill(); g.strokeStyle = 'rgba(120,160,110,.35)'; g.lineWidth = 1.5; for (let i = -24; i < 30; i += 8) { g.beginPath(); g.moveTo(i, -18); g.lineTo(i + 4, 18); g.stroke(); } } },
  gari: { name: 'Pickled ginger', draw: (g) => { for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * 0.9 - 1.2); blob(g, 10, 0, 14, 7, i % 2 ? '#f4b6b0' : '#f8ccc4'); g.restore(); } } },
  flakes: { name: 'Salmon flakes', draw: (g) => { for (let i = 0; i < 18; i++) { const a = i * 2.4, r = 4 + (i * 7) % 16; blob(g, Math.cos(a) * r, Math.sin(a) * r * 0.6 + 4, 5, 3, i % 3 ? '#f0905e' : '#f8b48a'); } } },
  shrimp: { name: 'Shrimp', draw: (g) => shrimp(g, '#f4a0a0', '#e07070') },
  flour: { name: 'Flour', draw: (g) => { bowl(g, '#c8a878'); blob(g, 0, -6, 22, 8, '#fbf8f0'); } },
  batter: { name: 'Batter', draw: (g) => { bowl(g, '#c8a878'); blob(g, 0, -6, 22, 8, '#f2e2a8'); g.fillStyle = '#e8d090'; g.beginPath(); g.arc(-6, -7, 2.5, 0, TAU); g.arc(8, -5, 2, 0, TAU); g.fill(); } },
  oil: { name: 'Hot oil', draw: (g) => { pot(g); g.fillStyle = '#f0b440'; g.fillRect(-24, -10, 48, 8); g.fillStyle = 'rgba(255,240,180,.9)'; for (const [x, y] of [[-12, -12], [2, -13], [14, -11]]) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } } },
  soy: { name: 'Soy sauce', draw: (g) => { g.fillStyle = '#f4f0e6'; rr(g, -10, -22, 20, 40, 6); g.fill(); g.fillStyle = '#c8201a'; rr(g, -11, -26, 22, 8, 3); g.fill(); g.fillStyle = '#3a1a0a'; g.fillRect(-7, -2, 14, 16); } },
  noodles: { name: 'Noodles', draw: (g) => { g.strokeStyle = '#f0d070'; g.lineWidth = 3.5; for (let k = 0; k < 5; k++) { g.beginPath(); for (let x = -26; x <= 26; x += 2) g.lineTo(x, -10 + k * 6 + Math.sin(x * 0.35 + k) * 3); g.stroke(); } } },
  tare: { name: 'Miso tare', draw: (g) => { g.fillStyle = '#8a5a2a'; rr(g, -14, -14, 28, 28, 10); g.fill(); g.fillStyle = '#c8883a'; blob(g, 0, -12, 12, 4, '#a8682a'); g.fillStyle = '#e8d8b0'; g.fillRect(-14, -2, 28, 6); } },
  broth: { name: 'Broth', draw: (g) => { pot(g); g.fillStyle = '#d8a050'; g.fillRect(-24, -10, 48, 8); steam(g); } },
  chashu: { name: 'Chashu pork', draw: (g) => { for (const x of [-10, 10]) { blob(g, x, 0, 13, 12, '#8a4a2a'); blob(g, x, 0, 9, 8, '#e8a888'); blob(g, x, 0, 4, 3, '#f4d0b8'); } } },
  egg: { name: 'Soft egg', draw: (g) => { blob(g, 0, 0, 22, 16, '#f6f0e2'); blob(g, 0, 2, 11, 9, '#f2a628'); blob(g, -2, 0, 5, 4, '#f8c858'); } },
  negi: { name: 'Spring onion', draw: (g) => { for (let i = 0; i < 9; i++) { const x = ((i * 13) % 44) - 22, y = ((i * 7) % 24) - 10; g.strokeStyle = '#4a9a3a'; g.fillStyle = '#c8e8a0'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); g.stroke(); } } },
};
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function blob(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
function mound(g, c, w) { g.fillStyle = c; g.beginPath(); g.moveTo(-w, 14); g.quadraticCurveTo(-w, -16, 0, -16); g.quadraticCurveTo(w, -16, w, 14); g.closePath(); g.fill(); g.strokeStyle = 'rgba(160,140,110,.45)'; g.lineWidth = 2; g.stroke(); }
function grains(g, w) { g.fillStyle = 'rgba(200,190,170,.7)'; for (let i = 0; i < 26; i++) { const x = ((i * 37) % (w * 2 - 8)) - w + 4, y = ((i * 23) % 26) - 12; g.beginPath(); g.ellipse(x, y, 2.4, 1.2, i, 0, TAU); g.fill(); } }
function slab(g, c, stripe) { g.fillStyle = c; rr(g, -32, -12, 64, 24, 9); g.fill(); g.strokeStyle = stripe; g.lineWidth = 3; for (let x = -24; x < 30; x += 9) { g.beginPath(); g.moveTo(x, -11); g.quadraticCurveTo(x + 6, 0, x - 2, 11); g.stroke(); } }
function bowl(g, c) { g.fillStyle = c; g.beginPath(); g.moveTo(-28, -6); g.lineTo(28, -6); g.quadraticCurveTo(24, 22, 0, 22); g.quadraticCurveTo(-24, 22, -28, -6); g.fill(); }
function pot(g) { g.fillStyle = '#3a3e44'; rr(g, -28, -12, 56, 30, 6); g.fill(); g.fillStyle = '#5a5e64'; g.fillRect(-34, -8, 6, 4); g.fillRect(28, -8, 6, 4); }
function steam(g) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2.5; for (const x of [-10, 4, 16]) { g.beginPath(); g.moveTo(x, -16); g.bezierCurveTo(x - 6, -22, x + 6, -28, x, -34); g.stroke(); } }
function shrimp(g, c, d) { g.fillStyle = c; g.strokeStyle = d; g.lineWidth = 2; g.beginPath(); g.arc(0, 4, 20, Math.PI * 1.05, Math.PI * 1.95); g.arc(0, 4, 10, Math.PI * 1.95, Math.PI * 1.05, true); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#d84a3a'; g.beginPath(); g.moveTo(18, 0); g.lineTo(28, -8); g.lineTo(26, 6); g.fill(); }

// ---------------------------------------------------------------- the recipes: the steps in order, the decoys, the notes
export const RECIPES = {
  sushi: { title: 'Salmon nigiri', jp: '鮭の握り', steps: ['rice', 'wasabi', 'salmon'], decoys: ['nori', 'gari'],
    notes: ['The fish always goes on top.', 'The wasabi hides between the rice and the fish.', 'Nigiri wears no nori, and the ginger is for the side of the plate.'] },
  onigiri: { title: 'Onigiri', jp: 'おにぎり', steps: ['rice', 'flakes', 'rice2', 'nori'], decoys: ['wasabi', 'shrimp'],
    notes: ['The filling sits in the middle of the rice: rice under it, rice over it.', 'Wrap it last, so the nori stays crisp.', "Shrimp is tomorrow's tempura, and there's no wasabi in a rice ball."] },
  tempura: { title: 'Shrimp tempura', jp: '海老天', steps: ['shrimp', 'flour', 'batter', 'oil'], decoys: ['soy', 'noodles'],
    notes: ['Dust it dry before you dip it wet.', "Nothing goes in the oil until it's coated.", "The soy's for the table, not the fryer."] },
  ramen: { title: 'Miso ramen', jp: '味噌ラーメン', steps: ['tare', 'broth', 'noodles', 'chashu', 'egg', 'nori', 'negi'], decoys: ['wasabi', 'rice'],
    notes: ['Seasoning in the bowl first, then the hot broth over it.', 'The noodles go in before any toppings.', 'The pork lies on the noodles, and the egg is set down beside it.', 'The nori stands up at the back; the spring onion is scattered over everything, last.'] },
};

// ---------------------------------------------------------------- the dish taking shape, a stage at a time
function drawDish(g, id, n, W, H, t) {
  g.clearRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H * 0.62);
  if (id === 'sushi' || id === 'onigiri') { // a hinoki board
    g.fillStyle = '#d8b07c'; rr(g, -170, 40, 340, 34, 8); g.fill(); g.fillStyle = '#b88a56'; g.fillRect(-170, 66, 340, 8);
  }
  if (id === 'sushi') {
    if (n >= 1) { g.save(); g.translate(0, 8); g.scale(2.2, 1.8); mound(g, '#f6f2ea', 34); grains(g, 34); g.restore(); }
    if (n >= 2) blob(g, 0, -22, 32, 7, '#8cc63e');
    if (n >= 3) { g.save(); g.translate(0, -30); g.scale(2.6, 1.5); slab(g, '#f28c5a', '#fbd2b4'); g.restore(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-30, -42, 40, 5, -0.1, 0, TAU); g.fill(); }
  } else if (id === 'onigiri') {
    const tri = (c) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(10, -104, 84, 30); g.quadraticCurveTo(84, 40, 70, 40); g.lineTo(-70, 40); g.quadraticCurveTo(-84, 40, -84, 30); g.quadraticCurveTo(-10, -104, 0, -100); g.fill(); };
    if (n >= 1) { if (n >= 3) tri('#f6f2ea'); else { g.save(); g.translate(0, 10); g.scale(2.6, 1.6); mound(g, '#f6f2ea', 34); g.restore(); } }
    if (n === 2) for (let i = 0; i < 22; i++) { const a = i * 2.4, r = 6 + (i * 7) % 26; blob(g, Math.cos(a) * r, -24 + Math.sin(a) * r * 0.5, 8, 5, i % 3 ? '#f0905e' : '#f8b48a'); }
    if (n >= 3) { g.save(); g.scale(2.6, 2.6); g.translate(0, -8); grains(g, 22); g.restore(); }
    if (n >= 4) { g.fillStyle = '#1e2a1e'; g.fillRect(-46, -14, 92, 54); g.strokeStyle = 'rgba(120,160,110,.3)'; g.lineWidth = 2; for (let x = -40; x < 46; x += 10) { g.beginPath(); g.moveTo(x, -12); g.lineTo(x + 6, 38); g.stroke(); } }
  } else if (id === 'tempura') {
    // the shrimp, changing: raw, dusted, battered, fried golden; the fryer comes up behind it at the end
    if (n >= 4) { g.fillStyle = '#3a3e44'; rr(g, -190, -70, 380, 150, 18); g.fill(); g.fillStyle = '#e8a830'; rr(g, -176, -50, 352, 116, 12); g.fill();
      g.fillStyle = 'rgba(255,240,180,.85)'; for (let i = 0; i < 16; i++) { const x = -160 + ((i * 53) % 320), y = -40 + ((i * 29) % 90), r = 3 + (Math.sin(t * 6 + i) + 1) * 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }
    if (n >= 1) {
      g.save(); g.scale(3.4, 3.4); g.translate(0, -2);
      const body = n >= 4 ? ['#e8b048', '#c88a28'] : n >= 3 ? ['#f2e2a8', '#d8c080'] : n >= 2 ? ['#f8e8e4', '#e0c4c0'] : ['#f4a0a0', '#e07070'];
      shrimp(g, body[0], body[1]);
      if (n >= 3) { g.fillStyle = n >= 4 ? '#f0c060' : '#f6ecc0'; for (let i = 0; i < 9; i++) { const a = Math.PI * (1.08 + i * 0.1); g.beginPath(); g.arc(Math.cos(a) * 21, 4 + Math.sin(a) * 21, 2.2, 0, TAU); g.fill(); } }
      g.restore();
    }
  } else if (id === 'ramen') {
    // a red bowl, filled in layers from the bottom up, toppings set on in their places
    g.fillStyle = '#8a2a20'; g.beginPath(); g.moveTo(-190, -40); g.lineTo(190, -40); g.quadraticCurveTo(170, 90, 0, 92); g.quadraticCurveTo(-170, 90, -190, -40); g.fill();
    g.fillStyle = '#6a1a14'; g.fillRect(-60, 86, 120, 12);
    g.save(); g.beginPath(); g.ellipse(0, -40, 186, 30, 0, 0, TAU); g.clip();
    g.fillStyle = '#2a1a12'; g.fillRect(-200, -80, 400, 80);
    if (n >= 1) { g.fillStyle = '#7a4a1a'; g.fillRect(-200, -80, 400, 80); }
    if (n >= 2) { g.fillStyle = '#d8a050'; g.fillRect(-200, -80, 400, 80); g.fillStyle = 'rgba(255,220,140,.5)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(-150 + i * 27, -44 + Math.sin(i) * 10, 3, 0, TAU); g.fill(); } }
    if (n >= 3) { g.strokeStyle = '#f0d070'; g.lineWidth = 6; for (let k = 0; k < 6; k++) { g.beginPath(); for (let x = -150; x <= 60; x += 4) g.lineTo(x, -54 + k * 6 + Math.sin(x * 0.12 + k) * 4); g.stroke(); } }
    if (n >= 4) for (const x of [60, 110]) { blob(g, x, -46, 30, 18, '#8a4a2a'); blob(g, x, -46, 22, 13, '#e8a888'); blob(g, x, -46, 9, 6, '#f4d0b8'); }
    if (n >= 5) { blob(g, -20, -36, 24, 16, '#f6f0e2'); blob(g, -20, -34, 12, 9, '#f2a628'); }
    g.restore();
    if (n >= 6) { g.fillStyle = '#1e2a1e'; g.fillRect(120, -120, 46, 92); g.strokeStyle = 'rgba(120,160,110,.3)'; g.lineWidth = 2; for (let y = -112; y < -30; y += 10) { g.beginPath(); g.moveTo(122, y); g.lineTo(164, y + 4); g.stroke(); } }
    if (n >= 7) for (let i = 0; i < 16; i++) { const x = -140 + ((i * 61) % 260), y = -60 + ((i * 17) % 34); g.strokeStyle = '#4a9a3a'; g.fillStyle = '#c8e8a0'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.stroke(); }
    if (n >= 2) { g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 4; for (const x of [-60, 0, 60]) { const o = Math.sin(t * 2 + x) * 6; g.beginPath(); g.moveTo(x, -80); g.bezierCurveTo(x - 14 + o, -100, x + 14 - o, -120, x + o, -150); g.stroke(); } }
  }
  g.restore();
}

export class MiniGames {
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('mini') || document.createElement('div'); this.el.id = 'mini'; document.body.appendChild(this.el);
    this.open = false;
  }
  // sounds: a soft pop, a wrong-way thunk, a lock's click, a crunch of snow, a little fanfare
  snd(kind) {
    const a = this.audio; if (!a || !a.ctx) return; const t = a.ctx.currentTime;
    if (a.ctx.state === 'suspended') a.ctx.resume();
    if (kind === 'pop') { a.tone(660, t, 0.08, 0.12, 'sine'); a.tone(990, t + 0.05, 0.1, 0.09, 'sine'); }
    else if (kind === 'pick') a.burst(t, 0.02, 3000, 4, 0.06);
    else if (kind === 'no') { a.tone(180, t, 0.16, 0.12, 'triangle'); a.tone(140, t + 0.08, 0.16, 0.1, 'triangle'); }
    else if (kind === 'click') { a.burst(t, 0.025, 4200, 6, 0.35); a.burst(t + 0.012, 0.02, 2400, 5, 0.2); }
    else if (kind === 'drop') { for (let i = 0; i < 4; i++) a.burst(t + i * 0.04, 0.03, 2600 - i * 300, 5, 0.18); }
    else if (kind === 'crunch') { a.burst(t, 0.12, 900 + Math.random() * 400, 0.8, 0.22); a.burst(t + 0.03, 0.08, 2600, 1, 0.08); }
    else if (kind === 'whoosh') a.burst(t, 0.22, 1200, 0.6, 0.12);
    else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => a.tone(f, t + i * 0.09, 0.32, 0.12, 'triangle'));
    else if (kind === 'unlock') { a.burst(t, 0.06, 1400, 2, 0.4); a.tone(220, t + 0.05, 0.3, 0.12, 'triangle'); a.burst(t + 0.25, 0.3, 500, 0.7, 0.25); }
  }
  // the shell every game sits in: a title, a line of instructions, the stage, "later"
  frame(title, jp, how) {
    this.el.innerHTML = `<div class="mg-card"><div class="mg-head"><div><div class="mg-jp">${jp}</div><div class="mg-title">${title}</div></div>
      <button class="mg-later" data-act="later">later</button></div><div class="mg-how">${how}</div><div class="mg-stage"></div><div class="mg-foot"></div></div>`;
    this.el.classList.remove('on'); void this.el.offsetWidth; this.el.classList.add('on'); this.open = true; // (restart the fade in)
    return this.el.querySelector('.mg-stage');
  }
  finish(ok, text) {
    return new Promise((res) => {
      if (!ok) { this.close(); return res(false); }
      this.snd('win');
      const done = document.createElement('div'); done.className = 'mg-done';
      done.innerHTML = `<div class="mg-stamp">${text[0]}</div><div class="mg-done-t">${text[1]}</div><button class="pill-btn" data-act="ok">carry on</button>`;
      this.el.querySelector('.mg-card').appendChild(done);
      this.confetti();
      done.querySelector('[data-act="ok"]').onclick = () => { this.close(); res(true); };
    });
  }
  close() { this.el.classList.remove('on'); this.open = false; cancelAnimationFrame(this.raf); this.el.innerHTML = ''; }
  confetti() {
    const card = this.el.querySelector('.mg-card');
    for (let i = 0; i < 46; i++) {
      const c = document.createElement('i'); c.className = 'mg-conf';
      c.style.setProperty('--x', `${(Math.random() - 0.5) * 900}px`); c.style.setProperty('--y', `${-200 - Math.random() * 300}px`); c.style.setProperty('--r', `${Math.random() * 720}deg`);
      c.style.background = ['#f0b45a', '#c8302a', '#f4f0e6', '#8cc63e', '#f2b8c4'][i % 5]; c.style.animationDelay = `${Math.random() * 0.15}s`;
      card.appendChild(c); setTimeout(() => c.remove(), 1800);
    }
  }
  play(kind, id, name) {
    if (kind === 'recipe') return this.recipe(id);
    if (kind === 'lockpick') return this.lockpick(id, name);
    if (kind === 'shovel') return this.shovel();
    return Promise.resolve(false);
  }

  // ---------------------------------------------------------------- a recipe: the ingredients onto the dish, in order
  recipe(id) {
    const R = RECIPES[id]; if (!R) return Promise.resolve(true);
    const stage = this.frame(`learn a recipe · ${R.title.toLowerCase()}`, R.jp, "Drag the ingredients onto the dish in the right order. The chef's notes say how it goes.");
    stage.innerHTML = `<div class="mg-recipe"><div class="mg-notes"><div class="mg-notes-t">chef's notes</div>${R.notes.map((n) => `<p>${n}</p>`).join('')}<div class="mg-tries"></div></div>
      <div class="mg-dish"><canvas width="560" height="380"></canvas><div class="mg-step"></div></div></div><div class="mg-tray"></div>`;
    const cv = stage.querySelector('canvas'), g = cv.getContext('2d'), dish = stage.querySelector('.mg-dish'), tray = stage.querySelector('.mg-tray');
    const stepEl = stage.querySelector('.mg-step'), triesEl = stage.querySelector('.mg-tries');
    let n = 0, wrong = 0, bounce = 0;
    const all = [...R.steps, ...R.decoys].map((k, i) => ({ k, i })).sort(() => Math.random() - 0.5);
    const tiles = all.map(({ k }) => {
      const el = document.createElement('div'); el.className = 'mg-tile'; el.dataset.k = k;
      const c = document.createElement('canvas'); c.width = c.height = 96; const tg = c.getContext('2d'); tg.translate(48, 50); tg.scale(1.4, 1.4); ING[k].draw(tg);
      el.appendChild(c); const lab = document.createElement('span'); lab.textContent = ING[k].name; el.appendChild(lab);
      tray.appendChild(el); return el;
    });
    this.debugStep = (k) => { n = k; showStep(); }; // (for testing: jump to a stage)
    const showStep = () => { stepEl.textContent = n ? `${n} of ${R.steps.length}` : 'an empty board'; triesEl.textContent = wrong ? `${wrong} wrong turn${wrong > 1 ? 's' : ''}` : ''; };
    showStep();
    return new Promise((resolve) => {
      const t0 = performance.now();
      const loop = () => { bounce = Math.max(0, bounce - 0.06); dish.style.transform = `scale(${1 + Math.sin(bounce * Math.PI) * 0.04})`; drawDish(g, id, n, cv.width, cv.height, (performance.now() - t0) / 1000); this.raf = requestAnimationFrame(loop); };
      loop();
      this.el.querySelector('[data-act="later"]').onclick = () => { this.close(); resolve(false); };
      // after a few wrong turns, the next one glows
      const hint = () => { if (wrong >= 3) tiles.forEach((t) => t.classList.toggle('hint', t.dataset.k === R.steps[n] && !t.classList.contains('used'))); };
      for (const el of tiles) {
        el.addEventListener('pointerdown', (e) => {
          if (el.classList.contains('used') || el.classList.contains('out')) return;
          e.preventDefault(); el.setPointerCapture(e.pointerId);
          const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
          const ghost = el.cloneNode(true); ghost.classList.add('mg-ghost'); ghost.querySelector('canvas').getContext('2d').drawImage(el.querySelector('canvas'), 0, 0);
          ghost.style.left = `${r.left}px`; ghost.style.top = `${r.top}px`; ghost.style.width = `${r.width}px`; document.body.appendChild(ghost);
          el.classList.add('lifted'); this.snd('pick');
          let lx = e.clientX, vx = 0;
          const move = (ev) => {
            vx = vx * 0.7 + (ev.clientX - lx) * 0.3; lx = ev.clientX;
            ghost.style.left = `${ev.clientX - ox}px`; ghost.style.top = `${ev.clientY - oy}px`;
            ghost.style.transform = `scale(1.12) rotate(${Math.max(-16, Math.min(16, vx * 0.9))}deg)`;
            const d = dish.getBoundingClientRect(), over = ev.clientX > d.left && ev.clientX < d.right && ev.clientY > d.top && ev.clientY < d.bottom;
            dish.classList.toggle('over', over);
          };
          const up = (ev) => {
            el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
            dish.classList.remove('over');
            const d = dish.getBoundingClientRect(), over = ev.clientX > d.left && ev.clientX < d.right && ev.clientY > d.top && ev.clientY < d.bottom;
            const k = el.dataset.k;
            if (over && k === R.steps[n]) {
              // right: it drops onto the dish and the dish takes it in
              ghost.style.transition = 'left .18s ease-in, top .18s ease-in, transform .18s ease-in, opacity .18s';
              ghost.style.left = `${d.left + d.width / 2 - r.width / 2}px`; ghost.style.top = `${d.top + d.height * 0.45 - r.height / 2}px`; ghost.style.transform = 'scale(.4)'; ghost.style.opacity = '0';
              setTimeout(() => ghost.remove(), 200);
              el.classList.remove('lifted'); el.classList.add('used');
              n++; bounce = 1; this.snd('pop'); this.sparkle(dish); showStep(); hint();
              if (n >= R.steps.length) { setTimeout(() => this.finish(true, [wrong ? '覚' : '完璧', wrong ? `${R.title} learned. It's on the menu from tonight.` : `Perfect. ${R.title} is on the menu from tonight.`]).then(resolve), 450); }
            } else {
              // wrong (or dropped short): back to the tray with a shake
              if (over) {
                wrong++; this.snd('no');
                if (R.decoys.includes(k)) { el.classList.add('out'); el.title = "doesn't belong in this one"; }
                dish.classList.remove('shake'); void dish.offsetWidth; dish.classList.add('shake');
                showStep(); hint();
              }
              ghost.style.transition = 'left .28s cubic-bezier(.2,.8,.3,1.2), top .28s cubic-bezier(.2,.8,.3,1.2), transform .28s';
              ghost.style.left = `${r.left}px`; ghost.style.top = `${r.top}px`; ghost.style.transform = 'scale(1) rotate(0)';
              setTimeout(() => { ghost.remove(); el.classList.remove('lifted'); }, 290);
            }
          };
          el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        });
      }
    });
  }
  sparkle(host) {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('i'); s.className = 'mg-spark';
      const a = Math.random() * TAU, d = 60 + Math.random() * 90;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d - 30}px`);
      host.appendChild(s); setTimeout(() => s.remove(), 700);
    }
  }

  // ---------------------------------------------------------------- picking a lock: lift each pin to the shear line
  lockpick(id, name) {
    const pins = id === 'kura' ? 6 : 5, tight = id === 'kura' ? 5 : 7;
    const what = (name || 'the old kura').toLowerCase(), title = id === 'kura' ? `${what}'s padlock` : 'the walk-in freezer';
    const stage = this.frame(`pick the lock · ${title}`, id === 'kura' ? '南京錠' : '冷凍庫',
      "Move along the pins and hold the mouse to lift one (drag up). The one that's binding resists a little and trembles: lift it to the line and let go, and it sets with a click. Too far and they all drop.");
    stage.innerHTML = `<div class="mg-lock"><canvas width="760" height="420"></canvas></div>`;
    const cv = stage.querySelector('canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const SHEAR = 190, X0 = 190, GAP = 74;
    const order = [...Array(pins).keys()].sort(() => Math.random() - 0.5);
    const P = [...Array(pins).keys()].map((i) => ({ x: X0 + i * GAP, key: 34 + ((i * 17) % 4) * 9, lift: 0, set: false, drop: 0 }));
    let bind = 0, holding = false, mx = X0, my = 0, startY = 0, turn = 0, done = false, failT = 0;
    const cur = () => P.reduce((b, p, i) => (Math.abs(p.x - mx) < Math.abs(P[b].x - mx) ? i : b), 0);
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); holding = true; [mx, my] = pos(e); startY = my; this.snd('pick'); });
    cv.addEventListener('pointermove', (e) => { [mx, my] = pos(e); });
    const release = () => {
      if (!holding) return; holding = false;
      const i = cur(), p = P[i];
      if (p.set) return;
      const top = 300 - p.key - p.lift; // where the key pin's top sits
      if (order[bind] === i && Math.abs(top - SHEAR) <= tight) {
        p.set = true; p.lift = 300 - p.key - SHEAR; bind++; this.snd('click'); turn += 0.04;
        if (bind >= pins) open();
      } else p.lift = 0;
    };
    const open = () => { done = true; this.snd('unlock'); setTimeout(() => this.finish(true, ['開', id === 'kura' ? `The padlock springs open. ${what[0].toUpperCase() + what.slice(1)}'s yours.` : "The lock gives. The walk-in's open: mochi ice cream from tonight."]).then(this._res), 700); };
    this.debugWin = () => { for (const q of P) { q.set = true; q.lift = 300 - q.key - SHEAR; } bind = pins; open(); }; // (for testing)
    cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
    return new Promise((resolve) => {
      this._res = resolve;
      this.el.querySelector('[data-act="later"]').onclick = () => { this.close(); resolve(false); };
      const loop = () => {
        // lifting: the pin under the pick follows the mouse up; the binding one is stiff and trembles
        const i = cur(), p = P[i];
        if (holding && !p.set && !done) {
          const want = Math.max(0, Math.min(150, (startY - my) * 0.9));
          const stiff = order[bind] === i ? 0.18 : 0.4;
          p.lift += (want - p.lift) * stiff;
          const top = 300 - p.key - p.lift;
          if (order[bind] === i && top < SHEAR - tight - 10) { // overset: everything falls
            for (const q of P) { q.set = false; q.lift = 0; } bind = 0; turn = 0; holding = false; failT = 0.6; this.snd('drop');
          }
        }
        for (const q of P) if (!q.set && !(holding && q === P[cur()])) q.lift *= 0.7;
        failT = Math.max(0, failT - 1 / 60);
        // draw: the plug (brass) in its housing, the pins in their chambers, the pick, the tension wrench
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#2a2622'; rr(g, 120, 40, 520, 340, 24); g.fill();
        g.save(); g.translate(380, 300); g.rotate(turn * (done ? 4 : 1)); g.translate(-380, -300);
        g.fillStyle = failT > 0 ? '#c88a40' : '#d8a848'; rr(g, 140, SHEAR, 480, 160, 18); g.fill();
        g.fillStyle = '#1a1612'; g.fillRect(150, 300, 470, 26);                                         // the keyway
        g.restore();
        g.strokeStyle = 'rgba(120,255,160,.55)'; g.setLineDash([8, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(130, SHEAR); g.lineTo(630, SHEAR); g.stroke(); g.setLineDash([]);
        P.forEach((q, k) => {
          const trem = holding && cur() === k && order[bind] === k && !q.set ? (Math.random() - 0.5) * 2 : 0;
          const top = 300 - q.key - q.lift;
          g.fillStyle = '#141210'; g.fillRect(q.x - 14, 60, 28, 240);                                   // the chamber
          // spring, driver pin (steel), key pin (brass, its tip rounded)
          const dTop = top - 70;
          g.strokeStyle = '#9aa0a8'; g.lineWidth = 2; g.beginPath(); for (let y = 64; y < dTop; y += 6) { g.moveTo(q.x - 9, y); g.lineTo(q.x + 9, y + 3); } g.stroke();
          g.fillStyle = q.set ? '#8ad8a0' : '#b8c0c8'; rr(g, q.x - 11 + trem, dTop, 22, 70, 4); g.fill();
          g.fillStyle = '#e0b860'; rr(g, q.x - 11 + trem, top, 22, q.key, 4); g.fill();
          g.beginPath(); g.moveTo(q.x - 11 + trem, top + q.key - 4); g.lineTo(q.x + trem, top + q.key + 8); g.lineTo(q.x + 11 + trem, top + q.key - 4); g.fill();
        });
        // the pick, its tip under the pin you're on
        const tx = P[cur()].x, ty = 300 - P[cur()].lift * 0.4 + 6;
        g.strokeStyle = '#d8dce0'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(700, 318); g.lineTo(tx + 26, 318); g.quadraticCurveTo(tx + 6, 318, tx, ty); g.stroke();
        g.strokeStyle = '#7a8088'; g.lineWidth = 8; g.beginPath(); g.moveTo(150, 330); g.lineTo(100, 360); g.lineTo(60, 360); g.stroke();
        g.fillStyle = '#e8d8b8'; g.font = '600 18px Fredoka, sans-serif'; g.textAlign = 'center';
        g.fillText(`${P.filter((q) => q.set).length} of ${pins} set`, 380, 412);
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    });
  }

  // ---------------------------------------------------------------- the drift on the back door: shovel it away
  shovel() {
    const stage = this.frame('dig out the back door', '雪かき', 'Press into the snow and drag the shovel through it, then flick it away. Clear the drift off the door.');
    stage.innerHTML = '<div class="mg-snow"><canvas width="800" height="440"></canvas><div class="mg-bar"><i></i></div></div>';
    const cv = stage.querySelector('canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, bar = stage.querySelector('.mg-bar i');
    const N = 160, GROUND = 400, h0 = [], h = [];
    for (let i = 0; i < N; i++) { const x = i / N; const v = Math.max(0, 260 * Math.exp(-((x - 0.55) ** 2) / 0.06) + 40 * Math.sin(x * 9) * x + 30); h0.push(v); h.push(v); }
    const total = h0.reduce((a, b) => a + b, 0);
    const flakes = [];
    let down = false, mx = 0, my = 0, load = 0, lx = 0, ly = 0, done = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); down = true; [mx, my] = pos(e); lx = mx; ly = my; });
    cv.addEventListener('pointermove', (e) => { [mx, my] = pos(e); });
    const fling = (vx, vy) => {
      if (load < 1) return;
      this.snd('whoosh');
      for (let i = 0; i < Math.min(40, load / 6); i++) flakes.push({ x: mx, y: my - 10, vx: vx * 0.6 + (Math.random() - 0.5) * 120 - 160, vy: -260 - Math.random() * 220 + vy * 0.3, r: 4 + Math.random() * 7, life: 1.4 });
      load = 0;
    };
    const up = () => { if (!down) return; down = false; fling(mx - lx, my - ly); };
    this.debugWin = () => h.fill(0); // (for testing)
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    return new Promise((resolve) => {
      this.el.querySelector('[data-act="later"]').onclick = () => { this.close(); resolve(false); };
      let last = performance.now(), crunchT = 0;
      const loop = (now) => {
        const dt = Math.min(0.05, ((now || performance.now()) - last) / 1000); last = now || performance.now();
        // digging: the blade takes snow from under it as it's dragged through the drift
        if (down && !done) {
          const i0 = Math.floor((mx - 40) / W * N), i1 = Math.floor((mx + 40) / W * N), moved = Math.hypot(mx - lx, my - ly);
          let took = 0;
          for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
            const surf = GROUND - h[i];
            if (my > surf - 6 && load < 160) { const t = Math.min(h[i], moved * 0.35 + 0.6); h[i] -= t; took += t; }
          }
          load += took;
          if (took > 2 && (crunchT -= dt) <= 0) { crunchT = 0.12; this.snd('crunch'); }
          // a quick upward flick throws the load
          if (my - ly < -18 && load > 20) fling((mx - lx) / dt, (my - ly) / dt);
          lx = mx; ly = my;
          // the drift settles: a column can't stand much higher than its neighbours
          for (let k = 0; k < 2; k++) for (let i = 1; i < N - 1; i++) { const avg = (h[i - 1] + h[i + 1]) / 2; if (h[i] - avg > 14) { const d = (h[i] - avg - 14) * 0.5; h[i] -= d; h[i - 1] += d / 2; h[i + 1] += d / 2; } }
        }
        const left = h.reduce((a, b) => a + b, 0) / total;
        bar.style.width = `${Math.round((1 - left) * 100)}%`;
        if (left < 0.1 && !done) { done = true; for (let i = 0; i < N; i++) h[i] *= 0.2; this.snd('unlock'); setTimeout(() => this.finish(true, ['開', "The drift's gone and the back door opens. One more guest in every rush, and the trash can go out the back."]).then(resolve), 600); }
        for (const f of flakes) { f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; }
        for (let i = flakes.length - 1; i >= 0; i--) if (flakes[i].life <= 0 || flakes[i].y > H + 20) flakes.splice(i, 1);
        // draw: a block wall, the steel back door, the drift against it, the shovel
        g.fillStyle = '#1a1e2a'; g.fillRect(0, 0, W, H);
        for (let y = 0; y < GROUND; y += 30) for (let x = (y / 30) % 2 ? -40 : 0; x < W; x += 80) { g.fillStyle = (x + y) % 3 ? '#4a4e58' : '#525662'; g.fillRect(x + 2, y + 2, 76, 26); }
        g.fillStyle = '#2a2c30'; g.fillRect(360, 120, 200, 282); g.fillStyle = '#6a7078'; g.fillRect(372, 130, 176, 272); g.fillStyle = '#c8ccd0'; g.fillRect(520, 260, 18, 8);
        g.fillStyle = '#ffd8a0'; g.beginPath(); g.arc(460, 96, 10, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,216,160,.08)'; g.beginPath(); g.moveTo(460, 96); g.lineTo(300, GROUND); g.lineTo(620, GROUND); g.fill();
        g.fillStyle = '#eef3fb'; g.beginPath(); g.moveTo(0, GROUND); for (let i = 0; i < N; i++) g.lineTo(i / (N - 1) * W, GROUND - h[i]); g.lineTo(W, GROUND); g.closePath(); g.fill();
        g.strokeStyle = '#c8d4e8'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < N; i++) g.lineTo(i / (N - 1) * W, GROUND - h[i] + 2); g.stroke();
        g.fillStyle = '#d8e0ec'; g.fillRect(0, GROUND, W, H - GROUND);
        for (const f of flakes) { g.fillStyle = `rgba(240,246,255,${Math.min(1, f.life)})`; g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill(); }
        // the shovel: a long handle up and away, the blade (with whatever's on it) at the pointer
        g.save(); g.translate(mx, my); g.rotate(down ? -0.25 : -0.5);
        g.strokeStyle = '#8a5a32'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(20, -10); g.lineTo(150, -120); g.stroke();
        g.fillStyle = '#c84a2a'; rr(g, -44, -14, 72, 30, 6); g.fill();
        if (load > 1) { g.fillStyle = '#eef3fb'; g.beginPath(); g.ellipse(-8, -16, 30, Math.min(22, 6 + load / 10), 0, Math.PI, TAU); g.fill(); }
        g.restore();
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    });
  }
}
