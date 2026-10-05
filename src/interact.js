// Click-to-use: ray from the reticle to the nearest interactable box, blocked by walls.
import * as THREE from 'three';

const REACH = 2.3;

export class Interactions {
  constructor(camera, world, hintEl) {
    this.camera = camera; this.world = world; this.hintEl = hintEl; this.hintText = hintEl.querySelector('.txt') || hintEl;
    this.items = []; this.hover = null;
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3();
    this.outline = null; this.lit = null; // OutlinePass + the object it's currently outlining
  }
  attach(outlinePass) { this.outline = outlinePass; }
  // box: [cx, cy, cz, hx, hy, hz]; label(): string; act(): void
  // opts.highlight: the Object3D (or a function returning one) to outline on hover; opts.onHover(bool)
  add(box, label, act, enabled = null, opts = {}) { const it = { box, label, act, enabled, ...opts }; this.items.push(it); return it; }
  remove(it) {
    const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1);
    if (this.hover === it) this.hover = null;
    if (this.litItem === it) { this.lit = this.litItem = null; if (this.outline) this.outline.selectedObjects = []; }
  }

  rayBox(o, d, b) {
    let t0 = 0, t1 = REACH;
    for (let a = 0; a < 3; a++) {
      const inv = 1 / (d.getComponent(a) || 1e-9);
      let ta = (b[a] - b[a + 3] - o.getComponent(a)) * inv, tb = (b[a] + b[a + 3] - o.getComponent(a)) * inv;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return -1;
    }
    return t0;
  }
  // walls (static voxels) between the eye and the target hide it
  occluded(o, d, t) {
    const g = this.world.grid;
    for (let s = 0.15; s < t - 0.12; s += 0.06) {
      const i = this.world.cell(o.x + d.x * s, o.y + d.y * s, o.z + d.z * s);
      if (i >= 0 && g.d[i]) return true;
    }
    return false;
  }
  update() {
    const o = this.camera.getWorldPosition(this._o), d = this.camera.getWorldDirection(this._d);
    let best = null, bt = Infinity;
    for (const it of this.items) {
      if (it.enabled && !it.enabled()) continue;
      const t = this.rayBox(o, d, typeof it.box === 'function' ? it.box() : it.box);
      if (t >= 0 && t < bt) { bt = t; best = it; }
    }
    if (best && this.occluded(o, d, bt)) best = null;
    this.hover = best;
    const obj = best && best.highlight ? (typeof best.highlight === 'function' ? best.highlight() : best.highlight) : null;
    if (obj !== this.lit) {
      if (this.litItem && this.litItem.onHover) this.litItem.onHover(false);
      if (best && best.onHover) best.onHover(true);
      this.lit = obj; this.litItem = best;
      if (this.outline) this.outline.selectedObjects = obj ? [obj] : [];
    }
    const text = best ? best.label() : '';
    if (this.hintText.textContent !== text) this.hintText.textContent = text;
    this.hintEl.classList.toggle('show', !!best);
    document.getElementById('reticle')?.classList.toggle('active', !!best);
  }
  click() { if (this.hover) this.hover.act(); }
  // stop pointing at anything (when the game is paused)
  clear() {
    this.hover = null;
    if (this.litItem && this.litItem.onHover) this.litItem.onHover(false);
    this.lit = this.litItem = null;
    if (this.outline) this.outline.selectedObjects = [];
  }
}

// A hinged door that swings away from whoever opens it. Positive angle swings toward plusDir.
// With `slide` set, it's a sliding door instead: it runs `slide` metres along `slideDir` (default -x) into its pocket.
export class Door {
  constructor(mesh, { hinge, base = 0, plusDir, max = 1.55, block, bell = false, slide = 0, slideDir = [-1, 0] }) {
    Object.assign(this, { mesh, hinge, base, plusDir, max, block, bell, slide, slideDir });
    this.a = 0; this.target = 0; this.wasNear = false; this.openFor = 0; this.onAutoClose = null;
    this.width = Math.max(block[1] - block[0], block[3] - block[2]);
    this.center = { x: (block[0] + block[1]) / 2, z: (block[2] + block[3]) / 2 };
  }
  // clickable volume: the doorway plus wherever the panel has swung to, so it works from both sides
  box() {
    if (this.slide) { const [x0, x1, z0, z1] = this.block; return [(x0 + x1) / 2, 1.3, (z0 + z1) / 2, (x1 - x0) / 2 + 0.1, 1.05, (z1 - z0) / 2 + 0.18]; }
    const ang = this.base + this.a, ex = this.hinge.x + Math.cos(ang) * this.width, ez = this.hinge.z - Math.sin(ang) * this.width;
    const [x0, x1, z0, z1] = this.block, pad = 0.18;
    const minX = Math.min(x0, this.hinge.x, ex) - pad, maxX = Math.max(x1, this.hinge.x, ex) + pad;
    const minZ = Math.min(z0, this.hinge.z, ez) - pad, maxZ = Math.max(z1, this.hinge.z, ez) + pad;
    return [(minX + maxX) / 2, 1.3, (minZ + maxZ) / 2, (maxX - minX) / 2, 1.05, (maxZ - minZ) / 2];
  }
  get open() { return this.target !== 0; }
  // a locked door (one you haven't opened up yet) stays shut
  toggle(p) {
    if (this.locked) return null;
    if (this.target !== 0) { this.target = 0; return 'close'; }
    this.wasNear = false; this.openFor = 0;
    if (this.slide) { this.target = this.max; return 'open'; }
    const side = (p.x - this.hinge.x) * this.plusDir[0] + (p.z - this.hinge.z) * this.plusDir[1];
    this.target = side < 0 ? this.max : -this.max; // swing away from the player
    return 'open';
  }
  playerInDoorway(p) {
    const [x0, x1, z0, z1] = this.block, r = 0.3;
    return p.x > x0 - r && p.x < x1 + r && p.z > z0 - r && p.z < z1 + r;
  }
  // agents: positions of everyone who might be walking through (you and the customers)
  update(dt, agents) {
    // swing shut behind whoever opened it once they're through (or if nobody comes)
    if (this.target !== 0 && agents && !this.stuck) {
      this.openFor += dt;
      const dist = Math.min(...agents.map((p) => Math.hypot(p.x - this.center.x, p.z - this.center.z)));
      if (dist < 1.4) this.wasNear = true;
      if (((this.wasNear && dist > 2.0) || (!this.wasNear && this.openFor > 6)) && !agents.some((p) => this.playerInDoorway(p))) {
        this.target = 0;
        if (this.onAutoClose) this.onAutoClose();
      }
    }
    this.a += (this.target - this.a) * Math.min(1, dt * (this.target ? 4 : 2.2));
    if (this.slide) {
      const k = Math.abs(this.a) / this.max * this.slide;
      this.mesh.position.x = this.hinge.x + this.slideDir[0] * k; this.mesh.position.z = this.hinge.z + this.slideDir[1] * k;
    }
    else this.mesh.rotation.y = this.base + this.a;
  }
  // closed doors are solid
  blocks(x, y, z) {
    if (Math.abs(this.a) > 0.5 || y > 2.3) return false;
    const [x0, x1, z0, z1] = this.block;
    return x > x0 && x < x1 && z > z0 && z < z1;
  }
}
