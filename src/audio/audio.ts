export type Sfx =
  | 'pickup'
  | 'place'
  | 'reject'
  | 'ding'
  | 'start'
  | 'chop'
  | 'serve'
  | 'dishes'
  | 'wash'
  | 'clean'
  | 'order'
  | 'angry'
  | 'cash'
  | 'door'
  | 'step'
  | 'toast';

export type MusicMood = 'title' | 'service' | 'late' | 'sunrise' | 'quiet';

/** Japanese "in" scale (melancholy night) and "yo" scale (bright dawn), as semitone offsets. */
const IN_SCALE = [0, 1, 5, 7, 8];
const YO_SCALE = [0, 2, 5, 7, 9];
const ROOT_HZ = 293.66;

interface AudioParams {
  mood: MusicMood;
  busy: number;
  snow: number;
}

/** Fully procedural audio: no asset files. Created lazily on the first user gesture (autoplay policy). */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private oceanGain!: GainNode;
  private droneGain!: GainNode;
  private nextNote = 0;
  private melodyIdx = 5;
  private mood: MusicMood = 'title';
  private masterVol = 0.8;
  private musicVol = 0.6;
  private time = 0;

  resume(): void {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(master: number, music: number): void {
    this.masterVol = master;
    this.musicVol = music;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(master, this.ctx.currentTime, 0.05);
    this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
  }

  private init(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVol;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = this.bus(0.9);
    this.musicBus = this.bus(this.musicVol * 0.5);
    this.ambBus = this.bus(0.6);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Wind, muffled by the walls
    const wind = this.loopNoise();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 380;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);

    // Distant ocean swell
    const ocean = this.loopNoise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260;
    bp.Q.value = 0.6;
    this.oceanGain = ctx.createGain();
    this.oceanGain.gain.value = 0;
    ocean.connect(bp).connect(this.oceanGain).connect(this.ambBus);

    // Soft drone under the music
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 600;
    for (const [mult, detune] of [
      [0.5, -4],
      [0.5, 4],
      [0.75, 0],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = ROOT_HZ * mult;
      o.detune.value = detune;
      o.connect(droneFilter);
      o.start();
    }
    droneFilter.connect(this.droneGain).connect(this.musicBus);
    this.nextNote = ctx.currentTime + 0.5;
  }

  private bus(gain: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = gain;
    g.connect(this.master);
    return g;
  }

  private loopNoise(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, Math.random() * 2);
    return src;
  }

  update(dt: number, p: AudioParams): void {
    if (!this.ctx) return;
    this.time += dt;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.mood = p.mood;
    const gust = 0.5 + 0.5 * Math.sin(this.time * 0.23) * Math.sin(this.time * 0.61 + 1);
    const windLevel = (0.05 + p.snow * 0.22) * (0.6 + gust * 0.6) * (p.mood === 'sunrise' ? 0.4 : 1);
    this.windGain.gain.setTargetAtTime(windLevel, now, 0.3);
    this.windFilter.frequency.setTargetAtTime(280 + gust * 260, now, 0.3);
    const swell = 0.5 + 0.5 * Math.sin(this.time * 0.55);
    this.oceanGain.gain.setTargetAtTime((p.mood === 'sunrise' ? 0.16 : 0.08) * (0.4 + swell * 0.6), now, 0.4);
    const drone = p.mood === 'quiet' ? 0 : p.mood === 'sunrise' ? 0.09 : p.mood === 'late' ? 0.05 : 0.035;
    this.droneGain.gain.setTargetAtTime(drone, now, 1.5);

    if (p.mood === 'quiet') {
      this.nextNote = Math.max(this.nextNote, now + 0.5);
      return;
    }
    while (this.nextNote < now + 0.25) {
      this.scheduleNote(this.nextNote, p);
    }
  }

  private scheduleNote(at: number, p: AudioParams): void {
    const sunrise = this.mood === 'sunrise';
    const scale = sunrise ? YO_SCALE : IN_SCALE;
    const steps = scale.length * 2 + 1;
    this.melodyIdx = Math.max(0, Math.min(steps - 1, this.melodyIdx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
    const freq = (i: number) => {
      const octave = Math.floor(i / scale.length);
      return ROOT_HZ * Math.pow(2, (scale[i % scale.length] + 12 * octave) / 12);
    };
    const vel = 0.5 + Math.random() * 0.4;
    this.pluck(freq(this.melodyIdx), at, vel);
    if (Math.random() < (sunrise ? 0.45 : 0.2)) this.pluck(freq(Math.max(0, this.melodyIdx - 3)) / 2, at + 0.01, vel * 0.6);

    let gap: [number, number];
    switch (this.mood) {
      case 'title':
        gap = [1.1, 2.4];
        break;
      case 'late':
        gap = [1.3, 2.8];
        break;
      case 'sunrise':
        gap = [0.6, 1.3];
        break;
      default:
        gap = [1.1 - p.busy * 0.5, 2.0 - p.busy * 0.8];
    }
    let next = gap[0] + Math.random() * (gap[1] - gap[0]);
    if (Math.random() < 0.18) next *= 0.5;
    this.nextNote = at + next;
  }

  private pluck(freq: number, at: number, vel: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3600, at);
    f.frequency.exponentialRampToValueAtTime(700, at + 0.6);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
    f.connect(g).connect(this.musicBus);
    for (const [type, mult, level] of [
      ['triangle', 1, 1],
      ['sine', 2, 0.3],
      ['sine', 3, 0.08],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq * mult * 1.012, at);
      o.frequency.exponentialRampToValueAtTime(freq * mult, at + 0.05);
      const og = ctx.createGain();
      og.gain.value = level;
      o.connect(og).connect(f);
      o.start(at);
      o.stop(at + 2.3);
    }
  }

  // ---------- SFX primitives ----------
  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', endFreq?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private burst(at: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.02);
  }

  private bell(freq: number, at: number, gain: number, dur = 1.2): void {
    this.tone(freq, at, dur, gain);
    this.tone(freq * 2.76, at, dur * 0.4, gain * 0.25);
  }

  play(s: Sfx): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    switch (s) {
      case 'pickup':
        this.tone(520, t, 0.08, 0.12, 'triangle', 820);
        break;
      case 'place':
        this.burst(t, 0.05, 0.25, 'bandpass', 900, 2);
        this.tone(170, t, 0.09, 0.18, 'sine', 90);
        break;
      case 'reject':
        this.tone(150, t, 0.16, 0.08, 'square', 130);
        this.tone(143, t, 0.16, 0.06, 'square', 124);
        break;
      case 'ding':
        this.bell(1318.5, t, 0.1, 1.1);
        this.bell(1975.5, t + 0.12, 0.06, 0.9);
        break;
      case 'start':
        this.burst(t, 0.35, 0.12, 'lowpass', 700);
        this.tone(300, t, 0.05, 0.05, 'triangle');
        break;
      case 'chop':
        for (let i = 0; i < 4; i++) this.burst(t + i * 0.13, 0.04, 0.3, 'bandpass', 2600, 3);
        break;
      case 'serve':
        this.tone(2300, t, 0.25, 0.06);
        this.tone(3450, t + 0.01, 0.18, 0.03);
        this.burst(t, 0.04, 0.15, 'bandpass', 1200, 2);
        break;
      case 'dishes':
        for (let i = 0; i < 4; i++) this.tone(1900 + Math.random() * 1600, t + i * 0.04 + Math.random() * 0.02, 0.12, 0.04);
        this.burst(t, 0.08, 0.1, 'bandpass', 1500, 2);
        break;
      case 'wash':
        this.burst(t, 0.7, 0.12, 'bandpass', 1300, 0.7);
        this.burst(t + 0.25, 0.5, 0.08, 'bandpass', 2200, 0.7);
        break;
      case 'clean':
        this.tone(1760, t, 0.25, 0.05);
        this.tone(2349, t + 0.08, 0.3, 0.05);
        break;
      case 'order':
        this.bell(880, t, 0.06, 0.8);
        this.bell(1318.5, t + 0.1, 0.05, 0.8);
        break;
      case 'angry':
        this.tone(240, t, 0.45, 0.08, 'sawtooth', 120);
        break;
      case 'cash':
        this.bell(1046.5, t, 0.08, 0.7);
        this.bell(1568, t + 0.09, 0.08, 0.9);
        break;
      case 'door':
        [1568, 1318.5, 1760, 2093].forEach((f, i) => this.bell(f, t + i * 0.11 + Math.random() * 0.04, 0.05, 1.6));
        break;
      case 'step':
        this.burst(t, 0.06, 0.06 + Math.random() * 0.03, 'lowpass', 260 + Math.random() * 80);
        break;
      case 'toast':
        this.bell(659.25, t, 0.05, 0.9);
        this.bell(987.77, t + 0.12, 0.05, 1.1);
        break;
    }
  }
}
