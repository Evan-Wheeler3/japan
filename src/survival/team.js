// The night parade with friends (up to four, over the same relay as the shop's co-op). The host's game is the real
// one: it raises the yōkai, moves them, decides every blow (and sends the dice, so everyone sees the same limb come
// off), opens the seals, runs the box and the rounds. Everyone else draws the horde where the host says it is, swings
// and shoots at it on their own screen and tells the host what they hit. Each player keeps their own points, weapons,
// blessings and health; the seals, the power, the boards, the box, the dishes and the gifts are shared.
// This file is the plumbing and the other players' bodies; mode.js says what each message means.
import * as THREE from 'three';
import { Person } from '../npc.js';
import { weaponModel } from './weapons.js';

const ME_EVERY = 1 / 15, SNAP_EVERY = 0.1;
export const UP = 0, DOWN = 1, DEAD = 2;

function nameTag(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
  const g = cv.getContext('2d');
  g.font = '500 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(248, g.measureText(text).width + 32);
  g.fillStyle = 'rgba(20,12,10,0.8)'; g.beginPath(); g.roundRect(128 - w / 2, 4, w, 40, 20); g.fill();
  g.fillStyle = '#f6e2b8'; g.fillText(text, 128, 25);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.7, 0.13, 1); sp.position.y = 2.0; sp.renderOrder = 22;
  return sp;
}
// over a friend who's down: a red cross, through the walls, so you can find them
function reviveMark() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(20,12,10,0.85)'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ff5a48'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#ff5a48'; g.fillRect(52, 28, 24, 72); g.fillRect(28, 52, 72, 24);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.42, 0.42, 1); sp.position.y = 1.4; sp.renderOrder = 32; sp.visible = false;
  return sp;
}

export class Team {
  constructor({ net, scene, litMat, emitMat }) {
    Object.assign(this, { net, scene, litMat, emitMat });
    this.isHost = net.isHost; this.me = net.id;
    this.avatars = new Map(); this.meT = 0; this.snapT = 0;
    this.onMsg = null;      // (msg) => mode.js handles 'pz' messages
    this.onLeave = null;    // (id) => someone left
    net.on('pz', (m) => { if (this.onMsg) this.onMsg(m); });
    net.on('pzme', (m) => this.heard(m));
    this.sync();
  }
  get size() { return Math.max(1, this.net.players.length); }
  name(id) { return id === this.me ? 'you' : this.net.nameOf(id); }
  // send to everyone (the relay doesn't echo it back), to one player, or to the host
  send(k, data = {}) { this.net.send({ t: 'pz', k, ...data }); }
  sendTo(id, k, data = {}) { this.net.sendTo(id, { t: 'pz', k, ...data }); }
  sendHost(k, data = {}) { this.net.sendHost({ t: 'pz', k, ...data }); }

  // ---------------------------------------------------------------- the others
  sync() {
    const ids = new Set();
    for (const p of this.net.players) {
      if (p.id === this.me) continue;
      ids.add(p.id);
      if (this.avatars.has(p.id)) { this.avatars.get(p.id).name = p.name; continue; }
      const person = new Person(p.look || {}, this.litMat, this.emitMat);
      const held = new THREE.Group(); held.position.set(0.24, 1.02, -0.32); person.group.add(held);
      const tag = nameTag(p.name); person.group.add(tag);
      const mark = reviveMark(); person.group.add(mark);
      person.group.visible = false; // until we hear where they are
      this.scene.add(person.group);
      this.avatars.set(p.id, { id: p.id, name: p.name, person, held, tag, mark, pos: new THREE.Vector3(), target: null, yaw: 0, tyaw: 0, pitch: 0, speed: 0,
        wid: '', st: UP, pts: 500, hp: 1, get dead() { return this.st !== UP || !this.target; } });
    }
    for (const [id, a] of this.avatars) if (!ids.has(id)) { this.scene.remove(a.person.group); this.avatars.delete(id); if (this.onLeave) this.onLeave(id); }
  }
  heard(m) {
    const a = this.avatars.get(m.from); if (!a) return;
    if (!a.target) a.pos.set(m.x, m.y, m.z);
    a.target = [m.x, m.y, m.z]; a.tyaw = m.yaw; a.pitch = m.pitch; a.pts = m.pts; a.hp = m.hp;
    const was = a.st; a.st = m.st;
    if (was !== m.st && this.onStatus) this.onStatus(a, m.st, was);
    if (a.wid !== m.w) { a.wid = m.w; a.held.clear(); if (m.w) { const w = weaponModel(m.w).mesh(this.litMat, this.emitMat); w.scale.setScalar(0.85); a.held.add(w); } }
    a.person.group.visible = true;
  }
  // the bodies: ease to where they say they are; down on the floor if they're down, flat out if they're dead
  draw(dt) {
    const k = Math.min(1, dt * 12);
    for (const a of this.avatars.values()) {
      if (!a.target) continue;
      const [x, y, z] = a.target, bx = a.pos.x, bz = a.pos.z;
      a.pos.x += (x - a.pos.x) * k; a.pos.y += (y - a.pos.y) * k; a.pos.z += (z - a.pos.z) * k;
      let dy = a.tyaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * k;
      a.speed += (Math.hypot(a.pos.x - bx, a.pos.z - bz) / Math.max(dt, 1e-3) - a.speed) * Math.min(1, dt * 8);
      const p = a.person, down = a.st === DOWN, dead = a.st === DEAD;
      p.pose(dt, down || dead ? 0 : a.speed, down ? 1 : 0, 0.32, false);
      p.group.position.copy(a.pos); p.group.rotation.set(dead ? -Math.PI / 2 : 0, a.yaw, 0, 'YXZ');
      if (dead) p.group.position.y += 0.2;
      p.neck.rotation.x = -(a.pitch || 0) * 0.6;
      // the weapon up in front of them
      p.arms[1].rotation.x = a.wid && !down && !dead ? 1.35 : p.arms[1].rotation.x;
      a.held.visible = !dead;
      a.mark.visible = down; a.mark.position.y = 1.35 + Math.sin(performance.now() / 260) * 0.05;
      a.tag.visible = !dead;
    }
  }
  // where everyone is, for the horde (host) and the gifts on the floor: you first
  everyone(me) { return [me, ...[...this.avatars.values()].filter((a) => a.target)]; }

  update(dt, me) {
    // you: where, which way, what you're holding, how you're doing (fifteen times a second)
    if ((this.meT -= dt) <= 0) {
      this.meT = ME_EVERY;
      const p = me.player.pos, r2 = (v) => Math.round(v * 100) / 100;
      this.net.send({ t: 'pzme', x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(me.player.yaw), pitch: r2(me.player.pitch), w: me.weaponId || '', st: me.status, pts: Math.round(me.points), hp: r2(me.hp / me.maxHp) });
    }
    // the host: the horde and the shared world, ten times a second
    if (this.isHost && (this.snapT -= dt) <= 0) { this.snapT = SNAP_EVERY; if (this.onSnap) this.send('snap', this.onSnap()); }
    this.draw(dt);
  }
  dispose() { for (const a of this.avatars.values()) this.scene.remove(a.person.group); this.avatars.clear(); }
}
