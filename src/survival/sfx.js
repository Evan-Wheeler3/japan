// Sounds for the night parade, synthesized like everything else: taiko for a new round, a temple bell when it's
// over, groans that come from where the yōkai are, steel through the air, gunpowder, breaking plates and boards,
// and under it all a low drone with a shakuhachi breathing somewhere out in the snow.
export class ParadeSound {
  constructor(audio) {
    this.a = audio;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.on = false;
  }
  get ctx() { return this.a.ctx; }
  // ---- plumbing
  out(vol = 1, pos = null) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = vol;
    if (!pos) { g.connect(this.a.master); return g; }
    const L = this.listener, dx = pos.x - L.x, dz = pos.z - L.z, d = Math.hypot(dx, pos.y - L.y, dz);
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const side = (dx * rx + dz * rz) / (d || 1), front = (dx * fx + dz * fz) / (d || 1);
    g.gain.value = vol / (1 + d * d * 0.05);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = front < -0.3 ? 1800 : 9000; // behind you sounds duller
    if (pan) { pan.pan.value = Math.max(-0.9, Math.min(0.9, side)); g.connect(lp).connect(pan).connect(this.a.master); }
    else g.connect(lp).connect(this.a.master);
    return g;
  }
  noise(t, dur, freq, q, gain, dest, type = 'bandpass', sweepTo = null, buf = null) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf || this.a.pink;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
  }
  osc(t, dur, f0, f1, gain, dest, type = 'sine', attack = 0.005) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  // ---- the round
  taiko(hits = [0, 0.7, 1.25, 1.5]) {
    if (!this.ctx) return; const t0 = this.ctx.currentTime + 0.05, d = this.out(1.1);
    for (const h of hits) {
      const t = t0 + h;
      this.osc(t, 0.9, 92, 46, 0.9, d); this.osc(t, 0.5, 180, 90, 0.25, d);
      this.noise(t, 0.25, 220, 0.7, 0.6, d, 'lowpass', null, this.a.brown); this.noise(t, 0.04, 2400, 1.5, 0.12, d);
    }
  }
  bell() {
    if (!this.ctx) return; const t = this.ctx.currentTime + 0.05, d = this.out(0.6);
    for (const [f, g, dur] of [[98, 0.35, 7], [196.7, 0.22, 6], [233, 0.16, 4.5], [294.5, 0.12, 4], [392.8, 0.08, 3], [522, 0.04, 2]]) this.osc(t, dur, f, f * 0.998, g, d, 'sine', 0.01);
    this.noise(t, 0.12, 900, 1, 0.2, d);
  }
  // ---- the yōkai
  groan(pos, kind = 'gaki') {
    if (!this.ctx) return; const t = this.ctx.currentTime + Math.random() * 0.05, d = this.out(kind === 'oni' ? 1.1 : 0.7, pos);
    const ctx = this.ctx, dur = kind === 'oni' ? 1.6 : 0.9 + Math.random() * 0.8, f = kind === 'oni' ? 52 : 85 + Math.random() * 50;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (0.7 + Math.random() * 0.5), t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 5 + Math.random() * 4; const vg = ctx.createGain(); vg.gain.value = f * 0.06; vib.connect(vg).connect(o.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = kind === 'oni' ? 380 : 520 + Math.random() * 200; f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = kind === 'oni' ? 800 : 1100 + Math.random() * 300; f2.Q.value = 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'oni' ? 0.5 : 0.3, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(d);
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    this.noise(t, dur * 0.8, 700, 0.8, kind === 'oni' ? 0.2 : 0.08, d); // breath
  }
  rise(pos, indoor) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.8, pos);
    if (indoor) { this.noise(t, 0.25, 500, 1.2, 0.5, d); this.noise(t + 0.05, 0.1, 1800, 2, 0.25, d); } // floorboards splitting
    else for (let i = 0; i < 6; i++) this.noise(t + i * 0.04, 0.08, 900 + Math.random() * 1400, 1.4, 0.2, d); // snow
  }
  die(pos, kind = 'gaki') {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.7, pos);
    this.osc(t, 0.5, kind === 'oni' ? 70 : 110, 50, 0.18, d, 'sawtooth', 0.02);
    this.noise(t + 0.35, 0.18, 160, 1, 0.6, d, 'lowpass', null, this.a.brown); // the body hits the floor
  }
  // ---- steel and powder
  whoosh(k = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.55 * k + 0.1); this.noise(t, 0.2, 700, 1.4, 0.5, d, 'bandpass', 2600); }
  hit(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.9);
    if (kind === 'blade') { this.noise(t, 0.12, 1800, 2, 0.45, d); this.osc(t, 0.12, 140, 70, 0.4, d); this.noise(t + 0.03, 0.22, 900, 3, 0.3, d, 'bandpass', 300); }
    else if (kind === 'blunt') { this.osc(t, 0.25, 90, 40, 0.8, d); this.noise(t, 0.12, 500, 1, 0.6, d); this.noise(t + 0.02, 0.1, 2200, 2, 0.2, d); }
    else { this.osc(t, 0.15, 120, 60, 0.5, d); this.noise(t, 0.06, 600, 1, 0.3, d); }
  }
  shot(id) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(1.0);
    if (id === 'tanegashima') { this.noise(t, 0.9, 260, 0.6, 1.2, d, 'lowpass', null, this.a.brown); this.noise(t, 0.12, 1800, 0.7, 0.8, d); this.osc(t, 0.6, 70, 30, 0.9, d); for (let i = 0; i < 6; i++) this.noise(t + 0.2 + i * 0.09, 0.05, 2500, 2, 0.08, d); return; }
    const big = id === 'murata';
    this.noise(t, big ? 0.16 : 0.1, 2400, 0.8, big ? 1.0 : 0.8, d, 'highpass'); this.noise(t, big ? 0.5 : 0.3, 400, 0.7, big ? 0.9 : 0.6, d, 'lowpass', null, this.a.brown);
    this.osc(t, 0.2, big ? 110 : 150, 45, 0.5, d);
    this.noise(t + 0.25, big ? 0.9 : 0.5, 600, 0.5, 0.12, d, 'lowpass'); // the echo off the hills
  }
  reload(id) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.6);
    const n = id === 'revolver' ? 6 : id === 'murata' ? 3 : 2;
    for (let i = 0; i < n; i++) this.noise(t + 0.3 + i * (id === 'revolver' ? 0.22 : 0.6), 0.04, 3200, 3, 0.35, d);
    this.noise(t + 0.1, 0.06, 1400, 2, 0.3, d);
    if (id === 'tanegashima') { this.noise(t + 0.4, 0.6, 1800, 0.6, 0.15, d, 'bandpass', 600); } // ramming powder
  }
  click() { if (!this.ctx) return; this.noise(this.ctx.currentTime, 0.03, 3500, 4, 0.4, this.out(0.7)); }
  draw() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.25, 5000, 4, 0.12, this.out(0.6), 'bandpass', 8000); }
  smash(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.8);
    for (let i = 0; i < 7; i++) { const tt = t + Math.random() * 0.12; this.noise(tt, 0.05, 3000 + Math.random() * 4000, 4, 0.3, d); this.osc(tt, 0.08, 2800 + Math.random() * 3000, 2600, 0.04, d); }
    if (kind === 'tokkuri') this.noise(t, 0.3, 700, 1, 0.3, d, 'bandpass', 300);
  }
  board(tear, pos) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.9, pos);
    if (tear) { this.noise(t, 0.3, 380, 1.5, 0.7, d); this.osc(t, 0.25, 220, 120, 0.08, d, 'sawtooth'); this.noise(t + 0.25, 0.15, 180, 1, 0.5, d, 'lowpass', null, this.a.brown); }
    else { for (const k of [0, 0.16]) { this.noise(t + k, 0.07, 900, 2, 0.5, d); this.osc(t + k, 0.08, 300, 200, 0.2, d); } }
  }
  hurt() { if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(1); this.osc(t, 0.3, 80, 40, 0.8, d); this.noise(t, 0.2, 300, 1, 0.6, d, 'lowpass', null, this.a.brown); }
  beat() { if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.9); this.osc(t, 0.14, 60, 45, 0.6, d); this.osc(t + 0.2, 0.14, 55, 42, 0.45, d); }
  buy() { if (!this.ctx) return; this.a.coin ? this.a.coin() : this.a.kaching(); }
  drink() {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.7);
    for (let i = 0; i < 3; i++) { this.noise(t + i * 0.32, 0.12, 400, 3, 0.4, d, 'bandpass', 250); }
    for (const [k, f] of [[1.1, 1318], [1.25, 1760], [1.4, 2637]]) this.osc(t + k, 1.2, f, f, 0.08, d, 'sine', 0.005);
  }
  // each blessing's machine has its own little tune, a koto-ish pluck over a soft bass: played when you drink, and
  // now and then from the machine itself if you're near (the way the perk machines hum their jingles)
  jingle(id, pos = null) {
    if (!this.ctx) return; const t0 = this.ctx.currentTime + 0.05, d = this.out(pos ? 1.8 : 0.8, pos);
    const TUNES = {
      omamori: [[0, 0], [0.18, 4], [0.36, 7], [0.54, 9], [0.9, 7], [1.08, 4], [1.3, 12]],
      tetsu: [[0, -5], [0.28, 0], [0.56, -5], [0.84, 2], [1.12, 3], [1.5, 0], [1.62, 0]],
      hayate: [[0, 7], [0.12, 9], [0.24, 12], [0.36, 9], [0.48, 7], [0.6, 4], [0.72, 7], [0.96, 12]],
      sake: [[0, 0], [0.22, 3], [0.44, 5], [0.66, 7], [0.88, 10], [1.1, 7], [1.32, 12], [1.54, 15]],
      sanbon: [[0, 0], [0.3, 0], [0.6, 0], [0.9, 7], [1.2, 5], [1.5, 4], [1.8, 0]],
    };
    const base = { omamori: 523, tetsu: 220, hayate: 440, sake: 330, sanbon: 392 }[id] || 440;
    for (const [at, semi] of TUNES[id] || TUNES.omamori) {
      const f = base * 2 ** (semi / 12);
      this.osc(t0 + at, 0.55, f, f, 0.12, d, 'triangle', 0.003); this.osc(t0 + at, 0.22, f * 2, f * 2, 0.035, d, 'sine', 0.002);
    }
    this.osc(t0, 1.8, base / 2, base / 2, 0.07, d, 'sine', 0.02);
  }
  seal() {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.9);
    this.noise(t, 0.9, 800, 0.6, 0.5, d, 'bandpass', 2400); // paper catching
    for (let i = 0; i < 4; i++) this.noise(t + 0.3 + i * 0.18, 0.2, 300, 1.2, 0.5, d, 'lowpass', null, this.a.brown); // planks falling
    this.osc(t, 1.4, 880, 870, 0.05, d, 'sine', 0.01);
  }
  power(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.8);
    const notes = kind === 'nuke' ? [220, 165, 110] : [880, 1108, 1318, 1760];
    notes.forEach((f, i) => this.osc(t + i * 0.09, 0.9, f, f, 0.1, d, 'triangle', 0.005));
    if (kind === 'nuke') this.taiko([0, 0.18, 0.36]);
  }
  down() { if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(1); this.osc(t, 2.5, 220, 55, 0.3, d, 'sawtooth', 0.05); this.noise(t, 2, 300, 0.5, 0.4, d, 'lowpass', null, this.a.brown); }
  box() {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.8);
    for (let i = 0; i < 18; i++) this.noise(t + i * 0.13 + Math.random() * 0.03, 0.05, 1600 + Math.random() * 1200, 3, 0.25, d); // sticks rattling in the box
  }
  fortune(good) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(0.8);
    (good ? [659, 880, 1318] : [330, 311, 233]).forEach((f, i) => this.osc(t + i * 0.14, 1.0, f, f, 0.12, d, 'triangle', 0.005));
  }

  // ---- a low drone, and a shakuhachi now and then
  start() {
    if (!this.ctx || this.on) return;
    this.on = true;
    const ctx = this.ctx;
    this.drone = ctx.createGain(); this.drone.gain.value = 0; this.drone.connect(this.a.master);
    this.drone.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.connect(this.drone);
    for (const f of [55, 55.4, 82.6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.3; o.connect(g).connect(lp); o.start(); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
    this.nextFlute = ctx.currentTime + 6;
    this.timer = setInterval(() => this.tick(), 400);
  }
  tick() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    if (ctx.currentTime < this.nextFlute) return;
    const scale = [293.7, 311.1, 392, 440, 466.2, 587.3]; // the in scale, from D
    const t = ctx.currentTime + 0.1, n = 2 + Math.floor(Math.random() * 3), d = this.out(0.05);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)], dur = 1.2 + Math.random() * 1.8;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.97, tt); o.frequency.linearRampToValueAtTime(f, tt + 0.25);
      const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, tt); vg.gain.linearRampToValueAtTime(f * 0.012, tt + dur * 0.7); vib.connect(vg).connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(1, tt + 0.3); g.gain.setValueAtTime(1, tt + dur * 0.7); g.gain.linearRampToValueAtTime(0, tt + dur);
      o.connect(g).connect(d); o.start(tt); vib.start(tt); o.stop(tt + dur + 0.1); vib.stop(tt + dur + 0.1);
      this.noise(tt, dur, f * 2, 2, 0.25, d); // breath
      tt += dur + 0.15;
    }
    this.nextFlute = tt + 8 + Math.random() * 10;
  }
}
