// Co-op glue. The host runs the shop and sends a snapshot ten times a second; guests mirror it and send
// their clicks to the host. Everyone sends where they are, and sees the others as their own characters.
import * as THREE from 'three';
import { Person } from './npc.js';

const SNAP_EVERY = 0.1, ME_EVERY = 1 / 15;

function nameTag(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
  const g = cv.getContext('2d');
  g.font = '500 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(248, g.measureText(text).width + 32);
  g.fillStyle = 'rgba(48,28,18,0.82)'; g.beginPath(); g.roundRect(128 - w / 2, 4, w, 40, 20); g.fill();
  g.strokeStyle = 'rgba(255,220,170,0.22)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fbefdc'; g.fillText(text, 128, 25);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.7, 0.13, 1); sp.position.y = 1.95; sp.renderOrder = 22;
  return sp;
}

export class Coop {
  constructor(o) {
    // net, service, crowd, shift, player, scene, litMat, emitMat, doors, audio, toast, onSummary, onShiftStart, onHostLeft
    Object.assign(this, o);
    this.avatars = new Map(); this.looks = {}; this.snapT = 0; this.meT = 0; this.fullLooksT = 0; this.sentLooks = new Set();
    this.isHost = this.net.isHost;
    const { net, service } = this;
    service.goCoop(net, this.isHost ? 'host' : 'guest');
    service.posOf = (id) => (id === service.me ? this.player.pos : this.avatars.get(id)?.pos);
    this.crowd.others = [];
    if (!this.isHost) this.shift.puppet = true;

    net.on('act', (m) => { if (this.isHost) service.runAs(m.from, m.name, m.args || []); });
    net.on('snap', (m) => { if (!this.isHost) this.applySnap(m); });
    net.on('toast', (m) => this.toast(m.text));
    net.on('pop', (m) => { if (service.onPop) service.onPop(m.text); });
    net.on('sfx', (m) => { if (this.audio[m.name]) this.audio[m.name](); });
    net.on('me', (m) => this.moveAvatar(m));
    net.on('summary', (m) => { if (!this.isHost) this.onSummary(m.r); });
    net.on('shiftStart', (m) => { if (!this.isHost) this.onShiftStart(m.n); });
    net.onClose = (why) => this.onHostLeft(why);
    net.on('hostLeft', () => this.onHostLeft('the host closed the shop'));
    // doors: guests ask the host to open/close them
    service.A.door = (i, x, z) => {
      const d = this.doors[i]; if (!d) return;
      const r = d.toggle({ x, z });
      this.audio.doorSound(r === 'open'); if (r === 'open' && d.bell) this.audio.doorBell();
    };
    this.syncAvatars();
  }

  // ---------------------------------------------------------------- other players
  syncAvatars() {
    const ids = new Set();
    for (const p of this.net.players) {
      if (p.id === this.net.id || !p.look) continue;
      ids.add(p.id);
      if (this.avatars.has(p.id)) continue;
      const person = new Person(p.look, this.litMat, this.emitMat);
      const held = new THREE.Group(); person.group.add(held);
      person.group.add(nameTag(p.name));
      person.group.visible = false; // until we hear where they are
      this.scene.add(person.group);
      this.avatars.set(p.id, { person, held, pos: new THREE.Vector3(), target: null, yaw: 0, pitch: 0, speed: 0, heldKey: '' });
    }
    for (const [id, a] of this.avatars) if (!ids.has(id)) { this.scene.remove(a.person.group); this.avatars.delete(id); }
    this.crowd.others = [...this.avatars.values()].map((a) => a.pos);
  }
  moveAvatar(m) {
    const a = this.avatars.get(m.from); if (!a) return;
    if (!a.target) a.pos.set(m.x, m.y, m.z);
    a.target = [m.x, m.y, m.z]; a.tyaw = m.yaw; a.pitch = m.pitch; a.seat = m.seat;
    a.person.group.visible = true;
  }
  drawHeld(a, hands) {
    const key = JSON.stringify(hands || []);
    if (key === a.heldKey) return;
    a.heldKey = key; a.held.clear();
    for (const h of hands || []) {
      const big = h.type === 'tub' || h.type === 'clean';
      const g = this.service.heldModel(h).mesh(this.litMat, this.emitMat);
      g.position.set(big ? 0 : h.slot === 'L' ? -0.2 : 0.2, 1.02, -0.3);
      a.held.add(g);
    }
  }
  updateAvatars(dt) {
    const k = Math.min(1, dt * 12);
    for (const [id, a] of this.avatars) {
      if (!a.target) continue;
      const [x, y, z] = a.target, before = a.pos.clone();
      a.pos.x += (x - a.pos.x) * k; a.pos.y += (y - a.pos.y) * k; a.pos.z += (z - a.pos.z) * k;
      let dy = a.tyaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * k;
      a.speed += (Math.hypot(a.pos.x - before.x, a.pos.z - before.z) / Math.max(dt, 1e-3) - a.speed) * Math.min(1, dt * 8);
      const seat = a.seat >= 0 ? this.crowd.seats[a.seat] : null;
      const p = a.person;
      p.pose(dt, a.speed, seat ? 1 : 0, seat ? Math.max(0.3, seat.y - a.pos.y) : 0.5, false, !!seat && seat.kind === 'zabuton');
      p.group.position.copy(a.pos); p.group.rotation.y = a.yaw;
      p.neck.rotation.x = -(a.pitch || 0) * 0.6;
      const hands = this.service.handsBy[id] || [];
      // arms up while carrying something
      for (const h of hands) {
        if (h.slot === 'both' || h.slot === 'R') p.arms[1].rotation.x = 1.25;
        if (h.slot === 'both' || h.slot === 'L') p.arms[0].rotation.x = 1.25;
      }
      this.drawHeld(a, hands);
    }
  }

  // ---------------------------------------------------------------- the shop itself
  sendSnap() {
    const crowd = this.crowd.snapshot(), looks = {};
    // looks only when someone new walks in, plus everyone now and then (in case a message went missing)
    const full = this.fullLooksT <= 0;
    if (full) this.fullLooksT = 2;
    for (const q of this.crowd.people) if (full || !this.sentLooks.has(q.id)) { looks[q.id] = q.look; this.sentLooks.add(q.id); }
    this.net.send({
      t: 'snap', crowd, looks, svc: this.service.snapshot(), shift: this.shift.snapshot(),
      doors: this.doors.map((d) => [d.target, Math.round(d.a * 100) / 100]),
    });
  }
  applySnap(m) {
    Object.assign(this.looks, m.looks);
    this.crowd.applySnapshot(m.crowd, this.looks);
    this.service.applySnapshot(m.svc);
    this.shift.applySnapshot(m.shift);
    m.doors.forEach(([target, a], i) => {
      const d = this.doors[i]; if (!d) return;
      if (d.target !== target) { this.audio.doorSound(target !== 0); if (target !== 0 && d.bell) this.audio.doorBell(0.6); }
      d.target = target;
      if (Math.abs(d.a - a) > 0.4) d.a = a;
    });
  }
  // a guest's door click goes to the host
  door(i) {
    if (this.isHost) return false;
    this.service.request('door', i, this.player.pos.x, this.player.pos.z);
    return true;
  }

  update(dt) {
    this.meT -= dt;
    if (this.meT <= 0) {
      this.meT = ME_EVERY;
      const p = this.player.pos, r2 = (v) => Math.round(v * 100) / 100;
      this.net.send({ t: 'me', x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(this.player.yaw), pitch: r2(this.player.pitch),
        seat: this.player.seated ? this.crowd.seats.indexOf(this.player.seated) : -1 });
    }
    if (this.isHost) {
      this.fullLooksT -= dt; this.snapT -= dt;
      if (this.snapT <= 0) { this.snapT = SNAP_EVERY; this.sendSnap(); }
    }
    this.updateAvatars(dt);
  }
}
