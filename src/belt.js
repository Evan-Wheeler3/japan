// Kaiten sushi belt. Plates you set on it at the plating station in the kitchen ride straight out through the pass
// onto the kaiten counter's east leg and go round its U past the stools and the booths; any guest there can lift
// off what they ordered as it passes. Whatever nobody takes goes back into the kitchen through the hatch at the end
// of the west return. The corners are rounded, and the belt is drawn as one smooth strip.
import * as THREE from 'three';

export const BELT_SPEED = 0.42;   // metres per second
const SPACING = 0.32;              // plates keep at least this far apart
const LANE = 0.14;                 // half width of the belt
const Y = 1.125;                   // the counter tops it runs on (the plating station is the same height)
const RADIUS = 0.42;               // corner radius

// round each corner of a polyline (a quadratic curve through the corner, tangent to both runs)
function rounded(pts, r, steps = 12) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(r, la / 2, lb / 2);
    const s = [p[0] + (a[0] - p[0]) / la * k, p[1] + (a[1] - p[1]) / la * k], e = [p[0] + (b[0] - p[0]) / lb * k, p[1] + (b[1] - p[1]) / lb * k];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// the visible run: from the plating station, straight out under the pass, round the U, into the hatch
const PATH = rounded([[12.35, 11.1], [12.35, 10.0], [12.35, 6.15], [3.15, 6.15], [3.15, 7.85]], RADIUS); // (10.0: the wall)
const SEGS = [];
for (let i = 0; i < PATH.length - 1; i++) {
  const a = PATH[i], b = PATH[i + 1];
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue;
  SEGS.push({ a, b, y: Y, hidden: false, name: (a[1] + b[1]) / 2 > 10.0 ? 'kitchen' : 'counter' });
}
SEGS.push({ a: PATH[PATH.length - 1], b: PATH[0], y: 0.6, hidden: true, len: 1.8 }); // back to the kitchen under the floor

// a band following the path between two sideways offsets, from y0 up to y1: its top and both sides
function strip(path, o0, o1, y0, y1) {
  const pos = [], idx = [];
  const nrm = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz);
    return [-tz / l, tx / l];
  });
  const face = (fa, ya, fb, yb) => {
    const base = pos.length / 3;
    path.forEach((p, i) => pos.push(p[0] + nrm[i][0] * fa, ya, p[1] + nrm[i][1] * fa, p[0] + nrm[i][0] * fb, yb, p[1] + nrm[i][1] * fb));
    for (let i = 0; i < path.length - 1; i++) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  };
  face(o0, y1, o1, y1); face(o0, y0, o0, y1); face(o1, y1, o1, y0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

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
    this.visible = SEGS.filter((g) => !g.hidden);
    this.runLen = this.visible.reduce((a, g) => a + g.real, 0);
    // the belt: a dark channel with bright steel guards, and slats that crawl along it
    const side = THREE.DoubleSide;
    const chMat = new THREE.MeshLambertMaterial({ color: 0x2a2c30, side }), guardMat = new THREE.MeshLambertMaterial({ color: 0xb8bec6, side });
    this.root.add(new THREE.Mesh(strip(PATH, -(LANE + 0.04), LANE + 0.04, Y, Y + 0.02), chMat));
    for (const sgn of [-1, 1]) this.root.add(new THREE.Mesh(strip(PATH, sgn * (LANE + 0.02), sgn * (LANE + 0.04), Y, Y + 0.035), guardMat));
    const slatGeo = new THREE.BoxGeometry(0.06, 0.012, LANE * 2 - 0.02);
    this.slatCount = Math.floor(this.runLen / 0.09) + 1;
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
    for (let d = this.offset; d < this.runLen && i < this.slatCount; d += 0.09, i++) { // the visible run starts at s = 0
      const q = this.at(d);
      this.tmp.position.set(q.x, q.y + 0.026, q.z); this.tmp.rotation.set(0, q.yaw, 0);
      this.tmp.updateMatrix(); this.slats.setMatrixAt(i, this.tmp.matrix);
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
