// Hōrokudama: the old clay fire-pots, black and round, a fuse fizzing out of the top. G throws one (you get two each
// round, up to four); it bounces, rolls, and goes off a couple of seconds later: a flash, a blast that throws the
// yōkai apart (limbs, heads, the lot) and knocks the rest down, embers, smoke and a scorch on the floor.
import * as THREE from 'three';
import { Model, C } from '../voxel.js';

export const MAX_GRENADES = 4, PER_ROUND = 2;
const FUSE = 2.3, RADIUS = 4.6;

let potM = null;
export function potModel() {
  if (potM) return potM;
  const m = new Model(8, 9, 8, 1 / 64, [4, 0, 4]);
  const clay = C('#2a2420', 0, 0.06), band = C('#6a4a2a', 0, 0.05), fuse = C('#c8b080', 0, 0.05);
  m.sphere(4, 3.6, 4, 3.6, 3.6, 3.6, (x, y) => (y === 3 ? band : clay));
  m.box(3, 7, 3, 5, 8, 5, band); m.set(4, 8, 4, fuse);
  return (potM = m);
}

export class Grenades {
  constructor({ scene, world, horde, gore, mats, audio, onDamage, onBlast }) {
    Object.assign(this, { scene, world, horde, gore, mats, audio, onDamage, onBlast });
    this.left = PER_ROUND; this.live = []; this.round = 1;
    this.light = new THREE.PointLight(0xffa040, 0, 14, 1.6); scene.add(this.light);
    this.spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.4, 0.6), toneMapped: false }));
  }
  newRound() { this.left = Math.min(MAX_GRENADES, this.left + PER_ROUND); }
  throw(camera, power = 1) {
    if (this.left <= 0) return false;
    this.left--;
    const o = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
    const mesh = potModel().mesh(this.mats.lit, this.mats.emit); mesh.scale.setScalar(1.2);
    const spark = this.spark.clone(); spark.position.set(0, 0.16, 0); mesh.add(spark);
    const p = o.clone().addScaledVector(d, 0.45); p.y -= 0.12;
    mesh.position.copy(p); this.scene.add(mesh);
    const v = d.clone().multiplyScalar(13 * power).add(new THREE.Vector3(0, 2.6, 0));
    this.live.push({ mesh, spark, p, v, t: 0, w: new THREE.Vector3(6, 3, 4) });
    return true;
  }
  solid(x, y, z) { return this.world.solid(x, y, z); }
  update(dt) {
    this.light.intensity = Math.max(0, this.light.intensity - dt * 90);
    for (let i = this.live.length - 1; i >= 0; i--) {
      const G = this.live[i]; G.t += dt;
      // fly, bounce off the walls and the floor, roll to a stop (an axis at a time)
      const R = 0.07, P = G.p, V = G.v;
      V.y -= 9.8 * dt;
      let nx = P.x + V.x * dt, nz = P.z + V.z * dt, ny = P.y + V.y * dt;
      if (this.solid(nx, P.y, P.z)) { V.x *= -0.4; nx = P.x; }
      if (this.solid(nx, P.y, nz)) { V.z *= -0.4; nz = P.z; }
      if (V.y < 0 && this.solid(nx, ny - R, nz)) {
        if (V.y < -1.5 && this.audio && this.audio.ctx) this.audio.burst(this.audio.ctx.currentTime, 0.05, 420, 2, 0.12);
        V.y = V.y < -1.2 ? -V.y * 0.35 : 0; V.x *= 0.7; V.z *= 0.7; ny = P.y;
      } else if (V.y > 0 && this.solid(nx, ny + R, nz)) { V.y = 0; ny = P.y; }
      if (V.y === 0 && this.solid(nx, ny - R - 0.02, nz)) { V.x *= 1 - Math.min(1, dt * 3); V.z *= 1 - Math.min(1, dt * 3); }
      P.set(nx, ny, nz); G.mesh.position.copy(P);
      G.mesh.rotation.x += G.w.x * dt * Math.min(1, G.v.length()); G.mesh.rotation.z += G.w.z * dt * Math.min(1, G.v.length());
      // the fuse fizzes
      if (Math.random() < dt * 30) this.gore.ember(G.p.x, G.p.y + 0.18, G.p.z, (Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6, 0xffc040, 0.025, 0.3);
      G.spark.visible = Math.floor(G.t * 16) % 2 === 0;
      if (G.t >= FUSE) { this.blast(G.p); this.scene.remove(G.mesh); this.live.splice(i, 1); }
    }
  }
  blast(at) {
    const gore = this.gore, ground = this.groundAt(at);
    this.light.position.set(at.x, at.y + 0.6, at.z); this.light.intensity = 60;
    gore.fire(at.x, at.y + 0.2, at.z, 70, 6);
    gore.burst(at.x, ground + 0.05, at.z, 26, [0x3a3632, 0x2a2420, 0x6a6460, 0x1a1816], 0.05, 5, ground);
    gore.splat(at.x, ground, at.z, 1.6, 0x141210);                     // the scorch
    for (const k of this.horde.list) {
      if (!k.alive) continue;
      const c = k.center(new THREE.Vector3()), d = c.distanceTo(at);
      if (d > RADIUS) continue;
      // anything behind a wall is spared
      if (this.wallBetween(at, c)) continue;
      const fall = 1 - d / RADIUS, dir = c.clone().sub(at).setY(0).normalize();
      const res = k.hurt({ dmg: (300 + this.round * 90) * (0.35 + fall), part: 'torso', blast: fall, dir, point: c, knock: 3 + fall * 5, blunt: true });
      this.onDamage && this.onDamage(k, res, { blast: true });
    }
    this.onBlast && this.onBlast(at);
  }
  groundAt(p) { for (let y = p.y + 0.2; y > p.y - 3; y -= 0.0625) if (this.solid(p.x, y, p.z)) return Math.floor((y + 0.25) / 0.125) * 0.125 - 0.25 + 0.125; return p.y - 0.2; }
  // a wall between them shields a yōkai; a table or a bench doesn't (the blast goes over it): it's cover only if the
  // line's blocked at every height, low, middle and high
  wallBetween(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    const blocked = (h) => { for (let t = 0.3; t < L - 0.3; t += 0.1) if (this.solid(a.x + dx / L * t, h, a.z + dz / L * t)) return true; return false; };
    return [0.4, 1.1, 1.8].every((h) => blocked(Math.max(a.y, b.y - 1) + h));
  }
  clear() { for (const G of this.live) this.scene.remove(G.mesh); this.live = []; this.left = PER_ROUND; }
}
