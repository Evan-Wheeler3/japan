// Phone and tablet controls. While you're playing: the left half of the screen is a thumbstick (it appears
// wherever your thumb lands), dragging on the right half looks around, and a quick tap on the right half
// uses whatever the reticle is on. Two small buttons stand in for Esc (pause) and Q (put away).

export const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches;

const TAP_MS = 260, TAP_MOVE = 12, STICK_R = 56;

export class TouchControls {
  constructor({ player, interactions, onPause, onDrop, canDrop }) {
    Object.assign(this, { player, interactions, onPause, onDrop, canDrop });
    this.stickId = null; this.lookId = null;
    document.body.classList.add('touch');

    // the thumbstick: a ring with a knob, shown where the left thumb touches down
    this.ring = document.createElement('div'); this.ring.id = 'stick';
    this.knob = document.createElement('div'); this.ring.appendChild(this.knob);
    document.body.appendChild(this.ring);
    const bar = document.createElement('div'); bar.id = 'touchbar';
    bar.innerHTML = '<button class="glass" id="t-drop">put away</button><button class="glass" id="t-pause" aria-label="pause"></button>';
    document.body.appendChild(bar);
    bar.querySelector('#t-pause').addEventListener('touchend', (e) => { e.preventDefault(); this.onPause(); });
    bar.querySelector('#t-drop').addEventListener('touchend', (e) => { e.preventDefault(); this.onDrop(); });
    this.dropBtn = bar.querySelector('#t-drop');

    const opts = { passive: false };
    addEventListener('touchstart', (e) => this.start(e), opts);
    addEventListener('touchmove', (e) => this.move(e), opts);
    addEventListener('touchend', (e) => this.end(e), opts);
    addEventListener('touchcancel', (e) => this.end(e), opts);
  }
  get playing() { return this.player.locked; }
  start(e) {
    if (!this.playing || (e.target.closest && e.target.closest('button, input, #overlay, #summary'))) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && this.stickId === null) {
        this.stickId = t.identifier; this.sx = t.clientX; this.sy = t.clientY;
        this.ring.style.left = `${t.clientX}px`; this.ring.style.top = `${t.clientY}px`;
        this.ring.classList.add('on'); this.knob.style.transform = 'translate(-50%, -50%)';
      } else if (t.clientX >= innerWidth / 2 && this.lookId === null) {
        this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY;
        this.tapX = t.clientX; this.tapY = t.clientY; this.tapT = performance.now();
      }
    }
  }
  move(e) {
    if (!this.playing) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        let dx = t.clientX - this.sx, dy = t.clientY - this.sy;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        this.player.stick.x = dx / STICK_R; this.player.stick.y = dy / STICK_R;
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (t.identifier === this.lookId) {
        const k = this.player.sens * 2.5, p = this.player;
        p.yaw -= (t.clientX - this.lx) * k;
        p.pitch = Math.max(-1.35, Math.min(1.35, p.pitch - (t.clientY - this.ly) * k));
        this.lx = t.clientX; this.ly = t.clientY;
      }
    }
  }
  end(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        this.stickId = null; this.player.stick.x = this.player.stick.y = 0; this.ring.classList.remove('on');
      } else if (t.identifier === this.lookId) {
        this.lookId = null;
        // a quick tap without much drag uses what you're looking at
        if (this.playing && performance.now() - this.tapT < TAP_MS && Math.hypot(t.clientX - this.tapX, t.clientY - this.tapY) < TAP_MOVE) this.interactions.click();
      }
    }
  }
  // stop moving if the game pauses mid-swipe
  reset() { this.stickId = this.lookId = null; this.player.stick.x = this.player.stick.y = 0; this.ring.classList.remove('on'); }
  update() { this.dropBtn.classList.toggle('show', this.playing && this.canDrop()); }
}

