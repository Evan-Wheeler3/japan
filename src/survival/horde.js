// The horde: every yōkai on the lot, walking downhill on the flow field toward you, tearing the boards off the
// windows and climbing through, opening doors, crowding round you and pushing each other aside.
import * as THREE from 'three';
import { Yokai } from './yokai.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3();

export class Horde {
  constructor({ scene, mats, gore, nav, doors, onHit, onTear, onSound }) {
    Object.assign(this, { scene, mats, gore, nav, doors, onHit, onTear, onSound });
    this.list = [];
    this.flowT = 0;
    this.goalNode = -1;
  }
  get alive() { return this.list.filter((y) => y.alive); }
  // a new yōkai rising at (x, y, z); stats from the round
  spawn(kind, x, y, z, stats, opts = {}) {
    const k = new Yokai(kind, this, opts);
    k.pos.set(x, y, z); k.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    Object.assign(k, { hp: stats.hp, maxHp: stats.hp, walk: stats.speed, dmg: stats.dmg, reach: stats.reach, speedMul: 1, attackDur: stats.attackDur, hitAt: stats.hitAt, tearTime: stats.tearTime, climbTime: stats.climbTime });
    k.riseT = 0; k.state = 'rise'; k.replan = 0; k.cd = 0; k.wp = null;
    k.indoorRise = !!opts.indoor;
    this.list.push(k);
    this.riseFx(k);
    return k;
  }
  riseFx(k) {
    const g = this.gore, c = k.indoorRise ? [0x6c4429, 0x84583a, 0x3e2616] : [0xeef2f8, 0xc8d2e0, 0xdfe6ee];
    g.burst(k.pos.x, k.pos.y + 0.05, k.pos.z, k.kind === 'oni' ? 26 : 14, c, 0.07, 2.2, k.pos.y);
  }
  // so you can't walk through them
  blocks(x, y, z) {
    for (const k of this.list) {
      if (!k.alive || k.state === 'rise' || k.state === 'climb') continue;
      if (y < k.pos.y || y > k.pos.y + (k.crawl ? 0.45 : k.height)) continue;
      const r = k.size + 0.02;
      if ((x - k.pos.x) ** 2 + (z - k.pos.z) ** 2 < r * r) return true;
    }
    return false;
  }
  update(dt, player) {
    const nav = this.nav, P = player.pos;
    // the flow field follows you
    if ((this.flowT -= dt) <= 0) {
      this.flowT = 0.3;
      const g = nav.node(P.x, P.y, P.z, 1.2);
      if (g >= 0) { this.goalNode = g; nav.flow(g); }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i];
      k.t += dt; k.cd -= dt;
      if (k.state === 'dead') {
        k.pose(dt);
        if (k.t > 10.5) { k.remove(); this.list.splice(i, 1); }
        continue;
      }
      this.think(k, dt, P, player);
      k.pose(dt);
    }
    this.separate(dt);
    this.openDoors();
  }
  think(k, dt, P, player) {
    const nav = this.nav;
    const dx = P.x - k.pos.x, dz = P.z - k.pos.z, dp = Math.hypot(dx, dz), dy = P.y - k.pos.y;
    k.speed = 0;
    if (k.state === 'rise') {
      k.riseT += dt;
      if (k.riseT >= (k.kind === 'oni' ? 2.0 : 1.4)) { k.state = 'walk'; k.t = 0; if (k.kind === 'oni') this.onSound && this.onSound('roar', k); }
      k.yaw = turn(k.yaw, Math.atan2(-dx, -dz), dt * 2);
      return;
    }
    if (k.state === 'attack') {
      k.yaw = turn(k.yaw, Math.atan2(-dx, -dz), dt * 6);
      if (!k.struck && k.t >= k.hitAt) {
        k.struck = true;
        if (dp < k.reach + 0.45 && Math.abs(dy) < 1.2 && !player.dead) this.onHit(k);
      }
      if (k.t >= k.attackDur) { k.state = 'walk'; k.t = 0; k.cd = 0.35; }
      return;
    }
    if (k.state === 'toPortal') {
      const p = k.portal, tx = p.ext[0], tz = p.ext[2];
      const ex = tx - k.pos.x, ez = tz - k.pos.z, d = Math.hypot(ex, ez);
      if (d < 0.1) { k.state = 'tear'; k.t = 0; return; }
      this.step(k, ex, ez, d, dt);
      return;
    }
    if (k.state === 'tear') {
      const p = k.portal, b = p.barrier;
      k.yaw = turn(k.yaw, Math.atan2(-(p.int[0] - p.ext[0]), -(p.int[2] - p.ext[2])), dt * 6);
      if (b.boards > 0) {
        if (k.t >= k.tearTime) { k.t = 0; this.onTear(b, k); }
        return;
      }
      if (b.climber && b.climber !== k && b.climber.alive && b.climber.state === 'climb') return; // wait your turn
      b.climber = k; k.state = 'climb'; k.t = 0; k.from = k.pos.clone();
      this.onSound && this.onSound('climb', k);
      return;
    }
    if (k.state === 'climb') {
      const p = k.portal, b = p.barrier, u = Math.min(1, k.t / k.climbTime);
      const ty = nav.heightAt(p.int[0], p.int[1], p.int[2]);
      k.pos.x = k.from.x + (p.int[0] - k.from.x) * u; k.pos.z = k.from.z + (p.int[2] - k.from.z) * u;
      const base = k.from.y + (ty - k.from.y) * u;
      k.pos.y = base + Math.sin(u * Math.PI) * Math.max(0.3, (b.sill || 1.0) - base + 0.15);
      if (u >= 1) { k.pos.y = ty; b.climber = null; k.portal = null; k.state = 'walk'; k.t = 0; k.replan = 0; }
      return;
    }
    if (k.kind === 'oni' && this.oniThink(k, dt, P, player, dp, dy)) return;
    // walking: attack if you're in reach, otherwise follow the field
    const reach = k.reach * (k.crawl ? 0.9 : 1);
    if (dp < reach && Math.abs(dy) < 1.1 && k.cd <= 0 && !player.dead) {
      k.state = 'attack'; k.t = 0; k.struck = false;
      this.onSound && this.onSound('attack', k);
      return;
    }
    if ((k.replan -= dt) <= 0) { k.replan = 0.22 + Math.random() * 0.12; this.plan(k, P, dp, dy); }
    if (k.state !== 'walk') return;
    if (!k.wp) { k.yaw = turn(k.yaw, Math.atan2(-dx, -dz), dt * 2); return; } // no way to you yet: sway and wait
    const ex = k.wp[0] - k.pos.x, ez = k.wp[1] - k.pos.z, d = Math.hypot(ex, ez);
    if (d < 0.06) { k.replan = 0; return; }
    // stop short of you, don't climb into your lap
    if (dp < reach * 0.8 && Math.abs(dy) < 1.1) { k.yaw = turn(k.yaw, Math.atan2(-dx, -dz), dt * 6); return; }
    this.step(k, ex, ez, d, dt);
  }
  // an oni sizes you up: with a clear run at you it stamps, roars, lowers its head and charges in a straight line.
  // If it misses it skids to a stop and stands there blowing for a moment: that's your chance.
  oniThink(k, dt, P, player, dp, dy) {
    const nav = this.nav;
    k.chargeCD = (k.chargeCD ?? 0.5 + Math.random()) - dt;
    if (k.state === 'stomp') {
      k.yaw = turn(k.yaw, Math.atan2(-(P.x - k.pos.x), -(P.z - k.pos.z)), dt * 5);
      if (k.t >= 0.75) {
        k.state = 'charge'; k.t = 0;
        const dx = P.x - k.pos.x, dz = P.z - k.pos.z, d = Math.hypot(dx, dz) || 1;
        k.chargeDir = [dx / d, dz / d]; k.chargeLeft = d + 2.5; k.struck = false;
      }
      return true;
    }
    if (k.state === 'charge') {
      if (!k.chargeDir) { k.chargeDir = [-Math.sin(k.yaw), -Math.cos(k.yaw)]; k.chargeLeft = 6; }
      const sp = 4.2 * dt, nx = k.pos.x + k.chargeDir[0] * sp, nz = k.pos.z + k.chargeDir[1] * sp;
      k.speed = 4.2;
      const c = nav.col(nx, nz), ok = c >= 0 && nav.match(c, k.pos.y, 0.3) >= 0 && nav.straight(k.pos.x, k.pos.y, k.pos.z, nx + k.chargeDir[0] * 0.3, nz + k.chargeDir[1] * 0.3);
      if (!k.struck && dp < 1.15 && Math.abs(dy) < 1.1 && !player.dead) { k.struck = true; this.onHit(k); }
      if (!ok || (k.chargeLeft -= sp) <= 0) { k.state = 'stagger'; k.t = 0; k.chargeCD = 5 + Math.random() * 3; this.onSound && this.onSound(ok ? 'skid' : 'crash', k); return true; }
      k.pos.x = nx; k.pos.z = nz;
      const h = nav.heightAt(k.pos.x, k.pos.y, k.pos.z); k.pos.y += (h - k.pos.y) * Math.min(1, dt * 12);
      return true;
    }
    if (k.state === 'stagger') { if (k.t >= 1.3) { k.state = 'walk'; k.t = 0; k.replan = 0; } return true; }
    // (a clear run up to a step short of you: you might be standing by a stool or a wall)
    if (k.state === 'walk' && k.chargeCD <= 0 && dp > 3 && dp < 11 && Math.abs(dy) < 0.5 &&
      nav.straight(k.pos.x, k.pos.y, k.pos.z, P.x - (P.x - k.pos.x) / dp * 0.8, P.z - (P.z - k.pos.z) / dp * 0.8)) {
      k.state = 'stomp'; k.t = 0; this.onSound && this.onSound('roar', k);
      return true;
    }
    return false;
  }
  step(k, ex, ez, d, dt) {
    const sp = k.walk * (k.speedMul || 1) * (k.crawl ? 0.45 : 1);
    const st = Math.min(d, sp * dt);
    k.pos.x += ex / d * st; k.pos.z += ez / d * st;
    k.speed = sp;
    k.yaw = turn(k.yaw, Math.atan2(-ex, -ez), dt * (k.kind === 'oni' ? 4 : 7));
    const h = this.nav.heightAt(k.pos.x, k.pos.y, k.pos.z);
    k.pos.y += (h - k.pos.y) * Math.min(1, dt * 12);
  }
  plan(k, P, dp, dy) {
    const nav = this.nav;
    const n = nav.node(k.pos.x, k.pos.y, k.pos.z, 0.7);
    if (n < 0) { k.wp = [P.x, P.z]; return; } // lost: head straight for you
    if (dp < 7 && Math.abs(dy) < 0.5 && nav.straight(k.pos.x, k.pos.y, k.pos.z, P.x, P.z)) { k.wp = [P.x, P.z]; return; }
    if (nav.dist[n] === Infinity) { k.wp = null; return; }
    const st = nav.downhill(n);
    if (!st) { k.wp = [P.x, P.z]; return; }
    if (st.portal) { k.portal = st.portal; k.state = 'toPortal'; return; }
    let m = st.node, best = m;
    for (let i = 0; i < 10; i++) {
      const s2 = nav.downhill(m); if (!s2 || s2.portal) break;
      m = s2.node;
      const [mx, , mz] = nav.pos(m);
      if (nav.straight(k.pos.x, k.pos.y, k.pos.z, mx, mz)) best = m; else break;
    }
    const [bx, , bz] = nav.pos(best);
    k.wp = [bx, bz];
  }
  // shoulder to shoulder, not inside one another
  separate(dt) {
    const L = this.list, nav = this.nav;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!movable(a)) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (!movable(b) || Math.abs(a.pos.y - b.pos.y) > 1) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), r = (a.size + b.size) * 0.95;
        if (d >= r || d < 1e-4) continue;
        const push = Math.min(0.06, (r - d) * 0.5), nx = dx / d * push, nz = dz / d * push;
        nudge(nav, a, -nx, -nz); nudge(nav, b, nx, nz);
      }
    }
  }
  openDoors() {
    for (const door of this.doors) {
      if (door.locked || door.open) continue;
      for (const k of this.list) {
        if (!k.alive) continue;
        if (Math.hypot(door.center.x - k.pos.x, door.center.z - k.pos.z) < 1.1) { door.toggle(k.pos); this.onSound && this.onSound('door', k, door); break; }
      }
    }
  }
  // ---- weapons ask: who's in the line of fire, and who's in reach of a swing
  ray(o, d, maxT, pierce = 1) {
    const hits = [];
    for (const k of this.list) { const h = k.raycast(o, d, maxT); if (h) hits.push({ k, ...h }); }
    hits.sort((a, b) => a.t - b.t);
    return hits.slice(0, pierce);
  }
  inArc(o, yaw, pitch, range, arc) {
    const out = [];
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const k of this.list) {
      if (!k.alive || (k.state === 'rise' && k.riseT < 0.7)) continue;
      const c = k.center(_o), dx = c.x - o.x, dz = c.z - o.z, dist = Math.hypot(dx, dz);
      if (dist > range + k.size) continue;
      if (Math.abs(c.y - o.y) > 1.6) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (dist || 1))));
      if (dist > 0.45 && ang > arc / 2) continue;
      out.push({ k, dist });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }
  clear() { for (const k of this.list) k.remove(); this.list = []; }
}

const movable = (k) => k.alive && (k.state === 'walk' || k.state === 'attack' || k.state === 'toPortal' || k.state === 'stagger' || k.state === 'stomp');
function nudge(nav, k, dx, dz) {
  const x = k.pos.x + dx, z = k.pos.z + dz, c = nav.col(x, z);
  if (c < 0 || nav.match(c, k.pos.y, 0.3) < 0) return;
  for (const [ox, oz] of [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]]) { const c2 = nav.col(x + ox, z + oz); if (c2 < 0 || nav.match(c2, k.pos.y, 0.3) < 0) return; }
  k.pos.x = x; k.pos.z = z;
}
function turn(a, b, k) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); }
export { turn };
void _d;
