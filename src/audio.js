// All sound is synthesized: rain, room tone, a generative jukebox, thunder, tires, bell, steps.
export class Ambience {
  constructor() { this.ctx = null; this.musicOn = true; this.musicVol = 1; this.rainVol = 1; } // vols: settings sliders, 0..1

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);

    // noise buffers
    const len = ctx.sampleRate * 4;
    const pink = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = pink.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    { const d = brown.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
    this.pink = pink; this.brown = brown;
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 3); return s; };
    this.loop = loop;

    // rain: bright hiss + body, through an "indoors" lowpass
    this.rainLP = ctx.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 900; this.rainLP.Q.value = 0.3;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0.5;
    this.rainLP.connect(this.rainGain).connect(this.master);
    const hiss = loop(pink); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const hissG = ctx.createGain(); hissG.gain.value = 0.3; hiss.connect(hp).connect(hissG).connect(this.rainLP);
    const body = loop(pink); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5;
    const bodyG = ctx.createGain(); bodyG.gain.value = 0.6; body.connect(bp).connect(bodyG).connect(this.rainLP);
    // patter on glass / awning
    this.patterGain = ctx.createGain(); this.patterGain.gain.value = 0.12; this.patterGain.connect(this.master);
    this.patterRate = 18;

    // room tone (fridge hum + low air)
    this.roomGain = ctx.createGain(); this.roomGain.gain.value = 0; this.roomGain.connect(this.master);
    const air = loop(brown); const airLP = ctx.createBiquadFilter(); airLP.type = 'lowpass'; airLP.frequency.value = 180;
    const airG = ctx.createGain(); airG.gain.value = 0.12; air.connect(airLP).connect(airG).connect(this.roomGain);
    const hum = ctx.createOscillator(); hum.frequency.value = 120; const humG = ctx.createGain(); humG.gain.value = 0.006;
    hum.connect(humG).connect(this.roomGain); hum.start();
    const hum2 = ctx.createOscillator(); hum2.frequency.value = 240.7; const hum2G = ctx.createGain(); hum2G.gain.value = 0.002;
    hum2.connect(hum2G).connect(this.roomGain); hum2.start();

    // jukebox chain: warm lowpass, slow tremolo, gentle crackle
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0;
    this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 2600;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.22;
    const trem = ctx.createOscillator(); trem.frequency.value = 4.2; const tremG = ctx.createGain(); tremG.gain.value = 0.05;
    trem.connect(tremG).connect(this.musicBus.gain); trem.start();
    this.musicBus.connect(this.musicLP).connect(this.musicGain).connect(this.master);
    const crackle = ctx.createBufferSource();
    { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.004;
      crackle.buffer = b; crackle.loop = true; crackle.start(); }
    const crG = ctx.createGain(); crG.gain.value = 0.35; crackle.connect(crG).connect(this.musicLP);
    this.nextBeat = ctx.currentTime + 0.5; this.beat = 0;
    this.sched = setInterval(() => this.schedule(), 90);

    // griddle sizzle in the kitchen: crackly high noise with a slow, uneven swell
    this.sizzleGain = ctx.createGain(); this.sizzleGain.gain.value = 0; this.sizzleGain.connect(this.master);
    const sz = loop(pink); const szHP = ctx.createBiquadFilter(); szHP.type = 'highpass'; szHP.frequency.value = 3500;
    const szAM = ctx.createGain(); szAM.gain.value = 0.6;
    const szLfo = ctx.createOscillator(); szLfo.frequency.value = 0.31; const szLfoG = ctx.createGain(); szLfoG.gain.value = 0.3;
    szLfo.connect(szLfoG).connect(szAM.gain); szLfo.start();
    sz.connect(szHP).connect(szAM).connect(this.sizzleGain);
    this.cars = new Map();
    this.lastPatter = 0;
  }

  // ------------------------------------------------ jukebox: slow jazzy changes on a soft FM e-piano
  schedule() {
    const ctx = this.ctx;
    const spb = 60 / 68;
    const chords = [
      [41, 52, 55, 57, 64], [38, 53, 57, 60, 64], [43, 53, 57, 58, 62], [36, 52, 57, 58, 62],
      [41, 52, 57, 60, 67], [45, 55, 59, 60, 64], [38, 53, 57, 60, 65], [43, 53, 58, 62, 64],
    ];
    const scale = [65, 67, 69, 72, 74, 77, 79, 81];
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const t = this.nextBeat, b = this.beat;
      const bar = Math.floor(b / 4), beat = b % 4;
      const ch = chords[Math.floor(bar / 2) % chords.length];
      if (beat === 0) { this.note(ch[0] - 12, t, spb * 3.5, 0.5); ch.slice(1).forEach((n, i) => this.note(n, t + i * 0.012, spb * 1.6, 0.16)); }
      if (beat === 1 && bar % 2 === 1) ch.slice(1).forEach((n, i) => this.note(n, t + spb * 0.66 + i * 0.01, spb * 1.2, 0.11));
      if (beat === 2) this.note(ch[0] - 5, t, spb * 1.8, 0.3);
      if (beat === 3 && bar % 2 === 0) ch.slice(2).forEach((n, i) => this.note(n, t + spb * 0.66, spb * 0.9, 0.09));
      if (Math.random() < 0.42) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.note(n, t + (Math.random() < 0.5 ? 0 : spb * 0.66), spb * (0.6 + Math.random()), 0.13);
      }
      this.nextBeat += spb; this.beat++;
    }
  }
  note(midi, t, dur, vel) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 1.0; car.detune.value = (Math.random() - 0.5) * 8;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.8);
    car.connect(g).connect(this.musicBus);
    car.start(t); mod.start(t); car.stop(t + dur + 1); mod.stop(t + dur + 1);
  }

  // ------------------------------------------------ one-shots
  burst(t, dur, freq, q, gain, dest = this.master, type = 'bandpass') {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.pink;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
  }
  step(indoor) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (indoor > 0.5) { this.burst(t, 0.09, 180, 1.2, 0.35); this.burst(t, 0.03, 2400, 2, 0.05); }
    else { this.burst(t, 0.16, 900, 0.8, 0.22); this.burst(t + 0.01, 0.12, 3200, 1.5, 0.08); }
  }
  doorBell(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, d] of [[1760, 0], [2217, 0.11]]) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o2.frequency.value = f * 2.76;
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.12 * vol, t + d + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 1.6);
      o.connect(g); o2.connect(g2).connect(g); g.connect(this.master);
      o.start(t + d); o2.start(t + d); o.stop(t + d + 1.7); o2.stop(t + d + 1.7);
    }
  }
  thunder(delay, power) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    for (let i = 0; i < 4; i++) {
      const s = ctx.createBufferSource(); s.buffer = this.brown;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140 + Math.random() * 160;
      const g = ctx.createGain(); const tt = t + i * (0.25 + Math.random() * 0.5);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(power * (1 - i * 0.18), tt + 0.15 + Math.random() * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, tt + 3 + Math.random() * 3);
      s.connect(f).connect(g).connect(this.master); s.start(tt, Math.random() * 2); s.stop(tt + 7);
    }
  }

  // ------------------------------------------------ things you can click
  src(buf = this.pink) { const s = this.ctx.createBufferSource(); s.buffer = buf; return s; }
  env(g, t, a, peak, hold, rel) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0005, t + a + hold + rel); }
  tone(f, t, dur, vol, type = 'sine') {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  flush() {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = this.src(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(350, t + 3.2);
    this.env(g, t, 0.12, 0.55, 1.2, 2.2); s.connect(lp).connect(g).connect(this.master); s.start(t, Math.random() * 2); s.stop(t + 4);
    const gu = this.src(), bp = ctx.createBiquadFilter(), gg = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 9;
    for (let i = 0; i < 24; i++) bp.frequency.setValueAtTime(180 + Math.random() * 420, t + 0.8 + i * 0.09);
    this.env(gg, t + 0.7, 0.2, 0.5, 1.4, 1.0); gu.connect(bp).connect(gg).connect(this.master); gu.start(t, Math.random() * 2); gu.stop(t + 4);
    const r = this.src(), hp = ctx.createBiquadFilter(), rg = ctx.createGain(); hp.type = 'bandpass'; hp.frequency.value = 3000; hp.Q.value = 1.5;
    this.env(rg, t + 2.6, 0.4, 0.06, 3.5, 1.5); r.connect(hp).connect(rg).connect(this.master); r.start(t + 2.6, Math.random() * 2); r.stop(t + 8.5);
  }
  dryer() {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = this.src(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    this.env(g, t, 0.3, 0.35, 3.2, 0.6); s.connect(bp).connect(g).connect(this.master); s.start(t, Math.random() * 2); s.stop(t + 4.5);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(2300, t + 0.4);
    this.env(og, t, 0.3, 0.012, 3.2, 0.6); o.connect(og).connect(this.master); o.start(t); o.stop(t + 4.5);
  }
  kaching() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.burst(t, 0.05, 2500, 3, 0.25); this.burst(t + 0.06, 0.04, 3200, 3, 0.2);
    this.tone(2093, t + 0.1, 1.4, 0.12); this.tone(2637, t + 0.1, 1.2, 0.08); this.tone(5274, t + 0.1, 0.5, 0.03);
    this.burst(t + 0.25, 0.35, 900, 1.2, 0.18);
  }
  gumball() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) this.burst(t + i * 0.09, 0.03, 2600, 4, 0.2);
    let tt = t + 0.5; for (let i = 0; i < 9; i++) { this.burst(tt, 0.02, 1800 - i * 60, 6, 0.12); tt += 0.09 - i * 0.006; }
    this.tone(320, tt + 0.05, 0.25, 0.15, 'triangle');
  }
  purr() {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = this.src(this.brown), lp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 260; am.gain.value = 0.5;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 24; lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start(t); lfo.stop(t + 2.6);
    this.env(g, t, 0.3, 0.9, 1.4, 0.8); s.connect(lp).connect(am).connect(g).connect(this.master); s.start(t, Math.random() * 2); s.stop(t + 2.6);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(520, t + 2.0); o.frequency.linearRampToValueAtTime(760, t + 2.2);
    this.env(og, t + 2.0, 0.03, 0.05, 0.08, 0.15); o.connect(og).connect(this.master); o.start(t + 2.0); o.stop(t + 2.5);
  }
  pour() {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = this.src(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1500, t + 2.2);
    this.env(g, t, 0.1, 0.35, 1.8, 0.4); s.connect(bp).connect(g).connect(this.master); s.start(t, Math.random() * 2); s.stop(t + 2.6);
  }
  sizzleBurst() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.burst(t, 0.06, 600, 1, 0.2); this.burst(t + 0.05, 2.2, 5000, 0.6, 0.3);
  }
  doorSound(open) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    if (open) { const o = this.tone(320, t, 0.3, 0.02, 'sawtooth'); o.frequency.linearRampToValueAtTime(540, t + 0.25); this.burst(t, 0.08, 400, 1, 0.15); }
    else this.burst(t + 0.35, 0.18, 140, 1, 0.5, this.master, 'lowpass');
  }
  rattle() { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.burst(t + i * 0.12, 0.08, 500, 2, 0.35); }
  clickSound() { if (!this.ctx) return; this.burst(this.ctx.currentTime, 0.02, 3000, 3, 0.2); }
  // looping, positional water (faucets)
  water(pos) {
    if (!this.ctx) return null;
    const ctx = this.ctx, s = this.loop(this.pink), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.4; g.gain.value = 0;
    s.connect(bp).connect(g).connect(this.master);
    const h = { pos, g, on: false };
    (this.spots || (this.spots = [])).push(h);
    return h;
  }

  // ------------------------------------------------ cars: wet tire hiss per vehicle
  carSound(id, active) {
    const ctx = this.ctx;
    if (!ctx) return null;
    let c = this.cars.get(id);
    if (!c && active) {
      const s = this.loop(this.pink);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createStereoPanner();
      s.connect(f).connect(g).connect(p).connect(this.master);
      c = { s, f, g, p };
      this.cars.set(id, c);
    }
    if (c && !active) { c.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); const s = c.s; setTimeout(() => s.stop(), 600); this.cars.delete(id); return null; }
    return c;
  }

  // Glide a param toward v. Called every frame, so it skips tiny changes and clears the old glide first:
  // otherwise each call leaves another event on the param's timeline and the audio thread slowly bogs down.
  set(param, v, tc) {
    if (param._v !== undefined && Math.abs(param._v - v) <= Math.abs(v) * 0.01 + 1e-4) return;
    param._v = v;
    const t = this.ctx.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t); else param.cancelScheduledValues(t);
    param.setTargetAtTime(v, t, tc);
  }

  // ------------------------------------------------ per-frame mix
  update(dt, s) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const ind = s.indoor; // 0 outside .. 1 deep inside
    this.set(this.rainLP.frequency, 700 + (1 - ind) * 9000, 0.15);
    this.set(this.rainGain.gain, (0.13 + (1 - ind) * 0.22) * this.rainVol, 0.15);
    this.set(this.patterGain.gain, 0.12 * this.rainVol, 0.15);
    this.set(this.roomGain.gain, ind * 0.8, 0.3);
    const md = s.musicDist;
    const mv = this.musicOn ? Math.min(1, 2.2 / (0.6 + md * 0.55)) * (0.25 + ind * 0.75) : 0;
    this.set(this.musicGain.gain, mv * this.musicVol, 0.25);
    this.set(this.musicLP.frequency, 600 + ind * 2400, 0.2);
    if (this.spots && s.listener) for (const h of this.spots) {
      const d = Math.hypot(h.pos[0] - s.listener.x, h.pos[1] - s.listener.y, h.pos[2] - s.listener.z);
      this.set(h.g.gain, h.on ? 0.3 / (1 + d * d * 0.4) : 0, 0.08);
    }
    if (s.sizzleDist !== undefined) this.set(this.sizzleGain.gain, Math.min(0.35, 1.2 / (1 + s.sizzleDist * s.sizzleDist * 0.6)) * ind, 0.3);
    // patter ticks (on glass when inside, on awning/street when outside)
    this.lastPatter += dt;
    const rate = s.underAwning ? 40 : ind > 0.5 ? 9 : 22;
    while (this.lastPatter > 1 / rate) {
      this.lastPatter -= 1 / rate * (0.4 + Math.random() * 1.2);
      const freq = s.underAwning ? 1800 + Math.random() * 1500 : ind > 0.5 ? 2500 + Math.random() * 3000 : 3000 + Math.random() * 4000;
      this.burst(t + Math.random() * 0.05, 0.02 + Math.random() * 0.03, freq, 4, (s.underAwning ? 0.12 : 0.05) * (0.3 + Math.random()), this.patterGain);
    }
  }
}
