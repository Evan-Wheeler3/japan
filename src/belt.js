// Kaiten sushi belt. Plates you set on it in the kitchen ride a short run along the plating station, slip
// through a hatch and come out at the east end of the island; they go round the island past the stools and the
// booths, dive under the floor and come up along the zashiki ledge past the window tables. Any guest can lift off
// what they ordered as it passes; whatever nobody takes goes back round to the kitchen.
import * as THREE from 'three';

export const BELT_SPEED = 0.42;   // metres per second
const SPACING = 0.32;              // plates keep at least this far apart
const LANE = 0.14;                 // half width of the belt

// The loop: visible runs on the plating station, round the island and along the zashiki; hidden runs (inside
// the walls and under the floor) shortened to a virtual length so plates don't vanish for long.
const SEGS = [
  { a: [10.7, 10.55], b: [12.25, 10.55], y: 0.875, hidden: false, name: 'kitchen' },
  { a: [12.25, 10.55], b: [11.75, 6.85], y: 1.0, hidden: true, len: 1.2 },
  { a: [11.75, 6.85], b: [3.15, 6.85], y: 1.125, hidden: false, name: 'stools' },
  { a: [3.15, 6.85], b: [3.15, 4.4], y: 1.125, hidden: false, name: 'west' },
  { a: [3.15, 4.4], b: [11.75, 4.4], y: 1.125, hidden: false, name: 'booths' },
  { a: [11.75, 4.4], b: [10.0, 0.0], y: 0.6, hidden: true, len: 1.4 },
  { a: [10.0, 0.0], b: [1.0, 0.0], y: 0.875, hidden: false, name: 'zashiki' },
  { a: [1.0, 0.0], b: [10.7, 10.55], y: 0.6, hidden: true, len: 2.0 },
];

export class Belt {
  constructor(scene, dishMesh) {
    this.scene = scene; this.dishMesh = dishMesh;
    this.plates = [];
    this.nextId = 1;
    let s = 0;
    for (const g of SEGS) {
      g.real = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
      g.len = g.len ?? g.real; g.s0 = s; s += g.len;
      g.dir = [(g.b[0] - g.a[0]) / g.real, (g.b[1] - g.a[1]) / g.real];
    }
    this.length = s;
    this.offset = 0;
    this.speed = BELT_SPEED; // the catalog's stronger motor raises this
    this.root = new THREE.Group(); scene.add(this.root);
    // the belt: a dark channel with bright steel guards, and slats that crawl along it
    const chMat = new THREE.MeshLambertMaterial({ color: 0x2a2c30 }), guardMat = new THREE.MeshLambertMaterial({ color: 0xb8bec6 });
    this.visible = SEGS.filter((g) => !g.hidden);
    for (const g of this.visible) {
      const cx = (g.a[0] + g.b[0]) / 2, cz = (g.a[1] + g.b[1]) / 2, ang = Math.atan2(-g.dir[1], g.dir[0]);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(g.real, 0.02, LANE * 2 + 0.04), chMat);
      ch.position.set(cx, g.y + 0.01, cz); ch.rotation.y = ang; this.root.add(ch);
      for (const side of [-1, 1]) {
        const gd = new THREE.Mesh(new THREE.BoxGeometry(g.real, 0.035, 0.02), guardMat);
        gd.position.set(cx - g.dir[1] * side * (LANE + 0.02), g.y + 0.0175, cz + g.dir[0] * side * (LANE + 0.02)); gd.rotation.y = ang; this.root.add(gd);
      }
    }
    const slatGeo = new THREE.BoxGeometry(0.06, 0.012, LANE * 2 - 0.02);
    this.slatCount = Math.floor(this.visible.reduce((a, g) => a + g.real, 0) / 0.09);
    this.slats = new THREE.InstancedMesh(slatGeo, new THREE.MeshLambertMaterial({ color: 0x8a9098 }), this.slatCount);
    this.slats.frustumCulled = false; this.root.add(this.slats);
    this.tmp = new THREE.Object3D();
  }

  // where a point s along the loop is
  at(s) {
    s = ((s % this.length) + this.length) % this.length;
    const g = SEGS.find((q) => s >= q.s0 && s < q.s0 + q.len) || SEGS[0];
    const k = (s - g.s0) / g.len;
    return { x: g.a[0] + (g.b[0] - g.a[0]) * k, z: g.a[1] + (g.b[1] - g.a[1]) * k, y: g.y, seg: g, yaw: Math.atan2(-g.dir[1], g.dir[0]) };
  }
  // the s of the visible belt point nearest (x, z), or null if (x, z) isn't over the belt
  sAt(x, z, y = null) {
    for (const g of this.visible) {
      if (y !== null && Math.abs(g.y - y) > 0.01) continue;
      const rx = x - g.a[0], rz = z - g.a[1], along = rx * g.dir[0] + rz * g.dir[1], across = -rx * g.dir[1] + rz * g.dir[0];
      if (along >= -0.05 && along <= g.real + 0.05 && Math.abs(across) <= LANE + 0.08) return g.s0 + Math.max(0, Math.min(g.real, along)) * (g.len / g.real);
    }
    return null;
  }
  gap(a, b) { const d = Math.abs(a - b) % this.length; return Math.min(d, this.length - d); }
  isFree(s) { return this.plates.every((p) => this.gap(p.s, s) >= SPACING); }
  near(s, within = 0.22) {
    let best = null, bd = within;
    for (const p of this.plates) { const d = this.gap(p.s, s); if (d <= bd && !this.at(p.s).seg.hidden) { bd = d; best = p; } }
    return best;
  }

  add(type, s, id = this.nextId++) {
    const mesh = this.dishMesh(type);
    this.root.add(mesh);
    const p = { id, type, s, mesh };
    this.nextId = Math.max(this.nextId, id + 1);
    this.plates.push(p); this.place(p);
    return p;
  }
  remove(p) {
    const i = this.plates.indexOf(p); if (i >= 0) this.plates.splice(i, 1);
    this.root.remove(p.mesh);
  }
  clear() { for (const p of [...this.plates]) this.remove(p); }
  place(p) {
    const q = this.at(p.s);
    p.mesh.visible = !q.seg.hidden;
    p.mesh.position.set(q.x, q.y + 0.022, q.z); p.mesh.rotation.y = q.yaw;
    p.x = q.x; p.z = q.z; p.seg = q.seg.name || null;
  }

  update(dt) {
    const ds = this.speed * dt;
    this.offset = (this.offset + ds) % 0.09;
    for (const p of this.plates) { p.s = (p.s + ds) % this.length; this.place(p); }
    let i = 0;
    for (const g of this.visible) {
      for (let d = this.offset; d < g.real && i < this.slatCount; d += 0.09, i++) {
        this.tmp.position.set(g.a[0] + g.dir[0] * d, g.y + 0.026, g.a[1] + g.dir[1] * d);
        this.tmp.rotation.set(0, Math.atan2(-g.dir[1], g.dir[0]), 0);
        this.tmp.updateMatrix(); this.slats.setMatrixAt(i, this.tmp.matrix);
      }
    }
    this.slats.count = i;
    this.slats.instanceMatrix.needsUpdate = true;
  }

  // co-op: the host sends where the plates are; guests rebuild to match
  snapshot() { return this.plates.map((p) => [p.id, p.type, Math.round(p.s * 100) / 100]); }
  applySnapshot(list) {
    const want = new Map(list.map(([id, type, s]) => [id, [type, s]]));
    for (const p of [...this.plates]) if (!want.has(p.id)) this.remove(p);
    for (const [id, [type, s]] of want) {
      const p = this.plates.find((q) => q.id === id);
      if (p) { if (this.gap(p.s, s) > 0.2) p.s = s; } else this.add(type, s, id);
    }
  }
}
