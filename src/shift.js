// The night shift: a clock that runs from opening until dawn, customers arriving in waves,
// the sun coming up over Fuji when the last table leaves, a stats card and a new perk for each night.

export const START_HOUR = 22, HOURS = 8; // 10 PM until 6 AM, when the sun comes up
const SEC_PER_HOUR = 40;                 // a five-and-a-bit-minute night
const LAST_CALL = HOURS * 60 - 50;       // no new customers in the last 50 minutes
const WAVE_NAMES = ['the last ferry docks', 'the ski lodge closes', 'the onsen lets out', 'the night boats come in',
  'the snowplow crew takes a break', 'the first train crew'];

// perks you earn by finishing a shift (index = shift number just finished - 1)
export const UNLOCKS = [
  { name: 'Both hands', text: 'Carry two things at once: a second pick-up goes in your left hand.', apply: (s) => { s.handCap = 2; } },
  { name: 'Quick rinse', text: 'The sprayer gets fixed. Dishes wash 40% faster.', apply: (s) => { s.washTime = 0.72; } },
  { name: 'Regulars', text: 'Word gets around. Customers will wait 50% longer before giving up.', apply: (s) => { s.patience = 1.5; } },
];

export const clockText = (min) => {
  const total = (START_HOUR * 60 + Math.floor(min)) % (24 * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const hourText = (h) => `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`;

export class Shift {
  constructor({ service, crowd, audio, toast, ui, onEnd }) {
    Object.assign(this, { service, crowd, audio, toast, ui, onEnd });
    this.n = 0; this.active = false; this.t = 0; this.waves = []; this.pending = []; this.waveIdx = 0;
    this.puppet = false; // co-op guest: the host's clock is shown, not run
    this.players = () => 1; // how many people are working tonight (co-op sets this)
    crowd.auto = false;
  }
  snapshot() {
    return { n: this.n, t: Math.round(this.t * 10) / 10, active: this.active, closing: this.closing, waiting: this.waiting, p: this.pending.length, w: this.waveIdx,
      waves: this.waves.map((w) => [w.at, w.size, w.name]) };
  }
  applySnapshot(d) {
    this.n = d.n; this.t = d.t; this.active = d.active; this.closing = d.closing; this.waiting = d.waiting; this.waveIdx = d.w;
    this.pending = new Array(d.p).fill(0);
    this.waves = d.waves.map(([at, size, name]) => ({ at, size, name }));
    this.draw();
  }
  get range() { return `${hourText(START_HOUR)} – ${hourText(START_HOUR + HOURS)}`; }
  // game minutes since opening, for the wall clock too
  get minutes() { return this.t; }
  // how far toward sunrise the sky is: stays night until the small hours, then lightens toward 6 AM
  get dawn() { return Math.min(0.9, Math.max(0, (this.t - (HOURS - 3) * 60) / (3 * 60)) ** 1.4 * 0.9); }

  // A night begins with the shop closed: nothing happens (and the clock waits at 10 PM) until someone
  // turns the sign by the front door to OPEN.
  start(n) {
    this.n = n; this.t = 0; this.active = true; this.closing = false; this.waiting = true;
    this.service.resetForShift();
    const s = this.service;
    this.snap = { money: s.money, tips: s.tips, served: s.served, walkouts: s.walkouts, washed: s.washed, burnt: s.burnt };
    // waves get more frequent and bigger each shift
    const count = Math.min(5, 2 + n), first = 8, last = LAST_CALL - 50;
    this.waves = Array.from({ length: count }, (_, i) => ({
      at: first + (count > 1 ? i * (last - first) / (count - 1) : 0),
      size: Math.min(9, 2 + Math.floor(n / 2) + i) + (s.extraGuests || 0), // the back door brings a few more
      name: WAVE_NAMES[(i + n - 1) % WAVE_NAMES.length],
    }));
    this.pending = []; this.waveIdx = 0;
    this.draw(true);
    if (this.onStart) this.onStart(n);
  }
  openShop() {
    if (!this.active || !this.waiting) return false;
    this.waiting = false;
    this.service.sayAll(`Night ${this.n} · open until dawn`);
    this.service.sfxAll('doorBell');
    this.draw(true);
    return true;
  }

  activeCustomers() {
    return this.crowd.people.filter((q) => (q.svc ? q.svc.phase !== 'gone' : q.then === 'sitdown')).length;
  }

  update(dt) {
    if (this.puppet) { this.t += this.active && !this.closing && !this.waiting ? dt * 60 / SEC_PER_HOUR : 0; this.draw(); return; }
    if (!this.active) return;
    if (this.waiting) { this.draw(); return; }
    this.t += dt * 60 / SEC_PER_HOUR;
    const w = this.waves[this.waveIdx];
    if (w && this.t >= w.at) {
      this.waveIdx++;
      // spread the wave's arrivals over about half a game hour
      // more hands on shift, more mouths to feed: each wave scales with the number of players
      const size = Math.round(w.size * this.players());
      for (let i = 0; i < size; i++) this.pending.push(this.t + (i === 0 ? 0 : 3 + Math.random() * 30));
      this.pending.sort((a, b) => a - b);
      this.service.sayAll(`rush: ${w.name}`);
      this.service.sfxAll('doorBell');
    }
    while (this.pending.length && this.t >= this.pending[0]) { this.pending.shift(); this.crowd.arrive(); }
    if (this.t >= HOURS * 60) {
      this.t = HOURS * 60;
      if (!this.closing) { this.closing = true; this.pending = []; this.service.sayAll('the sky is getting light — finish up the last tables'); }
      if (this.activeCustomers() === 0) this.end();
    }
    this.draw();
  }

  draw(force) {
    this.redraw = (this.redraw || 0) - 1;
    if (!force && this.redraw > 0) return;
    this.redraw = 10;
    const next = this.waves[this.waveIdx];
    let status, calm = true;
    if (this.waiting) status = 'closed · turn the sign by the door to open';
    else if (this.closing) status = `closing · ${this.activeCustomers()} still here`;
    else if (this.pending.length) { status = `rush on · ${this.pending.length} more coming`; calm = false; }
    else if (this.t >= LAST_CALL) status = 'last orders · no more walk-ins';
    else if (next) status = `next rush ~${clockText(next.at).toLowerCase()}`;
    else status = 'quiet till dawn';
    this.t = Math.min(this.t, HOURS * 60);
    const frac = this.t / (HOURS * 60), [hm, ap] = clockText(this.t).split(' ');
    const html = `<div class="time glass"><b>${hm}</b><span>${ap.toLowerCase()}</span></div>` +
      `<div class="bar"><i style="width:${(frac * 100).toFixed(1)}%"></i>${this.waves.map((w) =>
        `<u class="${w.at <= this.t ? 'past' : ''}" style="left:${(w.at / (HOURS * 60) * 100).toFixed(1)}%"></u>`).join('')}</div>` +
      `<div class="status hand${calm ? ' calm' : ''}">${status}</div>`;
    if (this.ui.schedule._html !== html) { this.ui.schedule.innerHTML = html; this.ui.schedule._html = html; }
  }

  end() {
    this.active = false;
    const s = this.service, d = (k) => s[k] - this.snap[k];
    const served = d('served'), walk = d('walkouts');
    const stars = Math.max(1, Math.min(5, Math.round(5 * served / Math.max(1, served + walk * 1.5) + (d('burnt') ? -0.5 : 0))));
    const unlock = UNLOCKS[this.n - 1];
    if (unlock) unlock.apply(s);
    this.onEnd({
      n: this.n, range: this.range, closedAt: clockText(HOURS * 60).toLowerCase(), stars, unlock,
      fed: served, earned: d('money'), tips: d('tips'), walkouts: walk, washed: d('washed'), burnt: d('burnt'), till: s.money,
    });
  }
}
