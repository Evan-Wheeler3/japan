// The first night's walk-through: one thing at a time along the top of the screen, and a marker bobbing over where
// to go (it shows through walls). Each step ticks itself off when you've done it.
import * as THREE from 'three';
import { MAP } from './maps/index.js';
import { MENU } from './service.js';

function markerTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f0b45a'; g.strokeStyle = '#3a2216'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(32, 90); g.lineTo(8, 52); g.lineTo(20, 52); g.lineTo(20, 8); g.lineTo(44, 8); g.lineTo(44, 52); g.lineTo(56, 52); g.closePath(); g.fill(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Tutorial {
  constructor({ scene, service, shift, crowd, player, audio, el }) {
    Object.assign(this, { service, shift, crowd, player, audio, el });
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex(), transparent: true, depthTest: false, depthWrite: false }));
    this.marker.scale.set(0.32, 0.48, 1); this.marker.renderOrder = 40; this.marker.visible = false; scene.add(this.marker);
    this.on = false; this.i = 0; this.t = 0;
    const s = service, sign = MAP.shop.sign.pos, SK = MAP.shop.sink, R = MAP.shop.register;
    const guest = (f) => crowd.people.find((q) => q.svc && f(q.svc));
    const at = (q) => q && [q.pos.x, q.pos.y + 2.1, q.pos.z];
    const wanted = () => { const q = guest((v) => v.phase === 'food'); return q && q.svc.items.find((i) => !i.done); };
    // where whatever the first guest wants is made
    const makeAt = (kind) => {
      const B = MAP.shop.boxes;
      if (kind === 'tea') return s.has('mug') ? [B.urns[0], B.urns[1] + 0.6, B.urns[2]] : [B.mugs[0] - 1.5, B.mugs[1] + 0.3, B.mugs[2]];
      if (!s.has('plate')) return [B.plates[0][0][0], B.plates[0][0][1] + 0.6, B.plates[0][0][2]];
      const st = s.stations.find((x) => x.kind === kind); if (st) return [st.x, 1.9, st.z];
      const b = B[kind]; return b ? [b[0], b[1] + 0.6, b[2]] : null;
    };
    this.steps = [
      { text: "The shop's across the street, under the red lanterns. Walk over to the door (WASD to walk, the mouse to look).",
        done: () => Math.hypot(player.pos.x - sign[0], player.pos.z - sign[2]) < 3.2, at: () => [sign[0], sign[1] + 0.9, sign[2]] },
      { text: 'Turn the sign by the door to OPEN. Guests will start coming in.', done: () => !shift.waiting, at: () => [sign[0], sign[1] + 0.6, sign[2]] },
      { text: 'A guest with a ! over their head is ready to order. Walk up and click them.',
        done: () => !!guest((v) => v.phase === 'food' || v.phase === 'eat'), at: () => at(guest((v) => v.phase === 'order')) },
      { text: () => { const w = wanted(); if (!w) return 'Make what they ordered.';
          const how = w.kind === 'tea' ? 'take a clean cup from the shelf over the back bar, then pour at the tea urns'
            : w.kind === 'yakitori' || w.kind === 'gyoza' ? `start it in the kitchen (click the ${w.kind === 'gyoza' ? 'teppan' : 'grill'}), then plate it on a clean plate when it's ready`
            : 'grab a clean plate and make it at its station';
          return `They want ${MENU[w.kind].name.toLowerCase()}: ${how}.`; },
        done: () => s.hands.some((h) => MENU[h.type] && (h.type !== 'tea' || true)) || s.itemsServed > 0, at: () => { const w = wanted(); return w && makeAt(w.kind); } },
      { text: 'Now take it to them: click the guest while you hold it. (Guests at the counter will take it off the belt too.)',
        done: () => s.itemsServed > 0, at: () => { const k = s.hands.find((h) => MENU[h.type]); return at(k && guest((v) => v.phase === 'food' && v.items.some((i) => !i.done && i.kind === k.type))); } },
      { text: "When they've eaten they line up at the register by the door (¥). Ring them up.", done: () => s.served > 0,
        at: () => (guest((v) => v.phase === 'pay' || v.phase === 'walkpay') ? [R.x, 1.8, R.z] : null) },
      { text: 'Their table needs clearing: click the dirty dishes, carry them to the sink in the kitchen and wash up.', done: () => s.washed > 0,
        at: () => { if (s.has('tub') || s.sink.mugs + s.sink.plates) return [SK.x, 1.7, SK.z]; const seat = crowd.seats.find((x) => x.needsBus); return seat && [seat.x, 1.7, seat.z]; } },
      { text: "That's the job. Keep it up till dawn. Every guest counts toward milestones: new recipes, more of the building. (The catalog's on the kotatsu upstairs.)",
        done: () => this.t > 12, at: () => null },
    ];
  }
  start() { this.on = true; this.i = 0; this.t = 0; this.el.classList.add('on'); this.draw(); }
  stop() { this.on = false; this.marker.visible = false; this.el.classList.remove('on'); }
  draw() {
    const st = this.steps[this.i]; if (!st) return;
    const text = typeof st.text === 'function' ? st.text() : st.text;
    const html = `<b>${this.i + 1}/${this.steps.length}</b><span>${text}</span>`;
    if (this.el._h !== html) { this.el._h = html; this.el.innerHTML = html; }
  }
  update(dt) {
    if (!this.on) return;
    this.t += dt;
    const st = this.steps[this.i];
    if (!st) return this.stop();
    if (st.done()) {
      this.i++; this.t = 0;
      if (this.audio && this.audio.ctx) { const t = this.audio.ctx.currentTime; this.audio.tone(880, t, 0.12, 0.08, 'triangle'); this.audio.tone(1320, t + 0.08, 0.16, 0.07, 'triangle'); }
      this.el.classList.remove('tick'); void this.el.offsetWidth; this.el.classList.add('tick');
      if (!this.steps[this.i]) return this.stop();
    }
    this.draw();
    const p = this.steps[this.i].at();
    this.marker.visible = !!p;
    if (p) this.marker.position.set(p[0], p[1] + Math.sin(performance.now() / 220) * 0.08, p[2]);
  }
}
